import { NextRequest, NextResponse } from "next/server";

import { validateUploadedDocument } from "@/lib/ai-validation";
import { uploadToDrive } from "@/lib/google-drive";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyUploadToken } from "@/lib/upload-token";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const FORMAT_TO_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  xls: ["application/vnd.ms-excel"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  doc: ["application/msword"],
  csv: ["text/csv", "application/csv"],
  zip: ["application/zip"],
};

function formatsToMimes(formats: string[]): Set<string> {
  return new Set(formats.flatMap((f) => FORMAT_TO_MIME[f.toLowerCase()] ?? []));
}

function err(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(request: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return err("Invalid request body", 400);
  }

  const token = formData.get("token");
  const clientYearDocumentId = formData.get("clientYearDocumentId");
  const file = formData.get("file");

  if (typeof token !== "string" || typeof clientYearDocumentId !== "string" || !(file instanceof File)) {
    return err("Missing required fields", 400);
  }

  // ── Verify JWT ──────────────────────────────────────────────────────────────
  const payload = await verifyUploadToken(token);
  if (!payload) return err("הקישור אינו תקף או פג תוקפו", 401);

  if (file.size > MAX_SIZE_BYTES) return err("הקובץ גדול מדי (מקסימום 10MB)", 413);

  const supabase = createSupabaseAdminClient();

  // ── Load document + verify it belongs to this client year ───────────────────
  const { data: doc } = await supabase
    .from("client_year_documents")
    .select("id, allowed_formats, document_type_id, custom_name, client_year_id")
    .eq("id", clientYearDocumentId)
    .eq("client_year_id", payload.clientYearId)
    .single();

  if (!doc) return err("המסמך לא נמצא", 404);

  // ── Resolve allowed formats ─────────────────────────────────────────────────
  let allowedFormats: string[] = doc.allowed_formats ?? [];
  if (allowedFormats.length === 0 && doc.document_type_id) {
    const { data: dt } = await supabase
      .from("document_types")
      .select("allowed_formats, name")
      .eq("id", doc.document_type_id)
      .single();
    allowedFormats = dt?.allowed_formats ?? [];
  }

  if (allowedFormats.length > 0) {
    const allowed = formatsToMimes(allowedFormats);
    if (allowed.size > 0 && !allowed.has(file.type)) {
      return err(`סוג הקובץ אינו מורשה. פורמטים: ${allowedFormats.join(", ")}`, 415);
    }
  }

  // ── Load tenant config: Drive folder ID ─────────────────────────────────────
  const { data: clientYear } = await supabase
    .from("client_years")
    .select("year, tenant_id, client_id")
    .eq("id", payload.clientYearId)
    .single();

  if (!clientYear) return err("שנת הלקוח לא נמצאה", 404);

  const { data: actionConfig } = await supabase
    .from("office_action_configs")
    .select("config")
    .eq("tenant_id", clientYear.tenant_id)
    .eq("action_key", "annual-income-summary")
    .eq("is_enabled", true)
    .single();

  const driveFolderId = (actionConfig?.config as Record<string, string> | null)?.drive_folder_id;

  if (!driveFolderId) {
    return err("מערכת ההעלאה טרם הוגדרה על ידי המשרד. אנא פנו לרואה החשבון.", 503);
  }

  // ── Load OAuth refresh token from tenant_secrets ────────────────────────────
  const { data: oauthSecret } = await supabase
    .from("tenant_secrets")
    .select("encrypted_key")
    .eq("tenant_id", clientYear.tenant_id)
    .eq("service", "google_drive_oauth")
    .eq("is_active", true)
    .single();

  if (!oauthSecret) {
    return err("חיבור Google Drive טרם הוגדר. אנא פנו לרואה החשבון.", 503);
  }

  const refreshToken = oauthSecret.encrypted_key;

  // ── Load client name for folder path ────────────────────────────────────────
  const { data: client } = await supabase
    .from("office_clients")
    .select("name")
    .eq("id", clientYear.client_id)
    .single();

  // ── Get document display name for folder ────────────────────────────────────
  let documentName = doc.custom_name ?? "מסמך";
  let validationPrompt: string | null = null;
  if (doc.document_type_id) {
    const { data: dt } = await supabase
      .from("document_types")
      .select("name, validation_prompt")
      .eq("id", doc.document_type_id)
      .single();
    if (dt?.name && !doc.custom_name) documentName = dt.name;
    validationPrompt = dt?.validation_prompt ?? null;
  }

  // ── Upload to Google Drive ───────────────────────────────────────────────────
  const fileBuffer = await file.arrayBuffer();

  let driveResult: { fileId: string; webViewLink: string };
  try {
    driveResult = await uploadToDrive({
      refreshToken,
      rootFolderId: driveFolderId,
      clientName: client?.name ?? clientYear.client_id,
      year: clientYear.year,
      documentName,
      fileName: file.name,
      fileBuffer,
      mimeType: file.type,
    });
  } catch (e) {
    console.error("[api/upload] Drive upload error:", e instanceof Error ? e.message : e);
    return err("שגיאה בהעלאה לדרייב. נסה שוב.", 500);
  }

  // ── Record metadata in DB ────────────────────────────────────────────────────
  const { data: record, error: dbError } = await supabase
    .from("uploaded_files")
    .insert({
      client_year_document_id: clientYearDocumentId,
      original_filename: file.name,
      file_size_kb: Math.ceil(file.size / 1024),
      drive_url: driveResult.webViewLink,
      upload_status: "in_drive",
      ai_status: "pending",
    })
    .select("id, original_filename, file_size_kb, uploaded_at, upload_status, ai_status, ai_notes, ai_result")
    .single();

  if (dbError) {
    console.error("[api/upload] DB insert error:", dbError.message);
    return err("הקובץ הועלה אך לא נשמר. פנה לתמיכה.", 500);
  }

  // ── AI validation (best-effort — never blocks or fails the upload) ──────────
  const validation = await validateUploadedDocument({
    fileBuffer,
    mimeType: file.type,
    documentName,
    year: clientYear.year,
    validationPrompt,
  });

  const { data: finalRecord } = await supabase
    .from("uploaded_files")
    .update({
      ai_status: validation.valid ? "valid" : "invalid",
      ai_notes: validation.notes,
      ai_result: {
        formType: validation.formType,
        formYear: validation.formYear,
        isValid: validation.valid,
        confidence: validation.confidence,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    })
    .eq("id", record!.id)
    .select("id, original_filename, file_size_kb, uploaded_at, upload_status, ai_status, ai_notes, ai_result")
    .single();

  return NextResponse.json({ file: finalRecord ?? record }, { status: 201 });
}
