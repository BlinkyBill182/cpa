import { NextRequest, NextResponse } from "next/server";

import { validateUploadedDocument } from "@/lib/ai-validation";
import { downloadFromDrive, extractDriveFileId } from "@/lib/google-drive";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Infer MIME type from original filename extension. */
function inferMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    csv: "text/csv",
  };
  return map[ext] ?? "application/octet-stream";
}

/**
 * POST /api/admin/revalidate-pending
 *
 * Re-downloads every uploaded_file with ai_status = 'pending' from Google Drive
 * and runs it through Claude validation, updating ai_status / ai_notes.
 *
 * Optional query params:
 *   ?tenantId=<uuid>   — limit to a single tenant
 *   ?fileId=<uuid>     — limit to a single uploaded_file row
 *
 * Auth: platform owner only.
 */
export async function POST(request: NextRequest) {
  await requirePlatformOwner();

  const { searchParams } = request.nextUrl;
  const filterTenantId = searchParams.get("tenantId");
  const filterFileId = searchParams.get("fileId");

  const supabase = createSupabaseAdminClient();

  // ── 1. Fetch all pending uploaded_files with their context ───────────────────
  let query = supabase
    .from("uploaded_files")
    .select(
      `id, drive_url, original_filename,
       client_year_document_id,
       client_year_documents (
         id, document_type_id, custom_name,
         client_years ( id, year, tenant_id )
       )`,
    )
    .eq("ai_status", "pending");

  if (filterFileId) query = query.eq("id", filterFileId);

  const { data: pendingFiles, error: fetchErr } = await query;

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!pendingFiles || pendingFiles.length === 0) {
    return NextResponse.json({ message: "No pending files found", processed: 0, succeeded: 0, failed: 0 });
  }

  // ── 2. Optionally filter by tenant ───────────────────────────────────────────
  const files = filterTenantId
    ? pendingFiles.filter(
        (f) =>
          (f.client_year_documents as { client_years?: { tenant_id?: string } } | null)
            ?.client_years?.tenant_id === filterTenantId,
      )
    : pendingFiles;

  if (files.length === 0) {
    return NextResponse.json({ message: "No pending files for this tenant", processed: 0, succeeded: 0, failed: 0 });
  }

  // ── 3. Load OAuth tokens grouped by tenant ───────────────────────────────────
  const tenantIds = [
    ...new Set(
      files
        .map(
          (f) =>
            (f.client_year_documents as { client_years?: { tenant_id?: string } } | null)
              ?.client_years?.tenant_id,
        )
        .filter(Boolean) as string[],
    ),
  ];

  const { data: secrets } = await supabase
    .from("tenant_secrets")
    .select("tenant_id, encrypted_key")
    .in("tenant_id", tenantIds)
    .eq("service", "google_drive_oauth")
    .eq("is_active", true);

  const tokenMap = new Map((secrets ?? []).map((s) => [s.tenant_id, s.encrypted_key]));

  // ── 4. Process each file ─────────────────────────────────────────────────────
  let processed = 0, succeeded = 0, failed = 0, skipped = 0;

  for (const file of files) {
    processed++;

    const cyd = file.client_year_documents as {
      id: string;
      document_type_id: string | null;
      custom_name: string | null;
      client_years: { id: string; year: number; tenant_id: string } | null;
    } | null;

    const tenantId = cyd?.client_years?.tenant_id;
    const year = cyd?.client_years?.year ?? new Date().getFullYear();

    if (!tenantId) {
      console.warn(`[revalidate-pending] File ${file.id}: missing tenant context — skipping`);
      skipped++;
      continue;
    }

    const refreshToken = tokenMap.get(tenantId);
    if (!refreshToken) {
      console.warn(`[revalidate-pending] File ${file.id}: no OAuth token for tenant ${tenantId} — skipping`);
      skipped++;
      continue;
    }

    const fileId = extractDriveFileId(file.drive_url);
    if (!fileId) {
      console.warn(`[revalidate-pending] File ${file.id}: cannot extract Drive fileId from ${file.drive_url}`);
      failed++;
      await supabase
        .from("uploaded_files")
        .update({ ai_status: "invalid", ai_notes: "לא ניתן לאמת — קישור Drive שגוי" })
        .eq("id", file.id);
      continue;
    }

    try {
      // Download from Drive
      const fileBuffer = await downloadFromDrive({ refreshToken, fileId });
      const mimeType = inferMimeType(file.original_filename);

      // Resolve document name
      let documentName = cyd?.custom_name ?? "מסמך";
      if (!cyd?.custom_name && cyd?.document_type_id) {
        const { data: dt } = await supabase
          .from("document_types")
          .select("name")
          .eq("id", cyd.document_type_id)
          .single();
        documentName = dt?.name ?? documentName;
      }

      // Run AI validation
      const validation = await validateUploadedDocument({ fileBuffer, mimeType, documentName, year });

      await supabase
        .from("uploaded_files")
        .update({
          ai_status: validation.valid ? "valid" : "invalid",
          ai_notes: validation.notes,
        })
        .eq("id", file.id);

      console.log(
        `[revalidate-pending] File ${file.id} (${file.original_filename}): ${validation.valid ? "valid" : "invalid"} (confidence ${validation.confidence})`,
      );
      succeeded++;
    } catch (e) {
      console.error(`[revalidate-pending] File ${file.id} failed:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  return NextResponse.json({
    processed,
    succeeded,
    failed,
    skipped,
    message: `Revalidated ${succeeded}/${processed} files. ${failed} failed, ${skipped} skipped.`,
  });
}
