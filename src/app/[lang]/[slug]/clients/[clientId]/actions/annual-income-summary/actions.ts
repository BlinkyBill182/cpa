"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { requireTenantAccessBySlug } from "@/lib/auth/session";
import type { AccountingStatus, ReportStatus } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuidSchema = z.string().uuid();
const yearSchema = z.coerce.number().int().min(2000).max(2100);

const accountingStatusValues = [
  "in_progress",
  "ready_missing",
  "ready_for_review",
  "issue",
  "skip",
] as const;

const reportStatusValues = [
  "ready_missing",
  "missing_completed",
  "ready_for_check",
  "issue",
  "ready_for_signature",
  "submitted",
] as const;

const basePath = (slug: string, clientId: string, year: number) =>
  `/${slug}/clients/${clientId}/actions/annual-income-summary?year=${year}`;

// ─── Create client year ────────────────────────────────────────────────────

export const createClientYearAction = async (
  locale: string,
  slug: string,
  clientId: string,
  year: number,
) => {
  const { user, tenant, role } = await requireTenantAccessBySlug(locale, slug);

  if (role !== "tenant_admin" && role !== "manager") {
    redirect(`/?error=forbidden`);
  }

  const clientParsed = uuidSchema.safeParse(clientId);
  const yearParsed = yearSchema.safeParse(year);
  if (!clientParsed.success || !yearParsed.success) {
    redirect(basePath(slug, clientId, year) + "&error=validation");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("client_years").insert({
    tenant_id: tenant.id,
    client_id: clientParsed.data,
    year: yearParsed.data,
    accountant_id: user.id,
  });

  if (error) {
    redirect(basePath(slug, clientId, year) + "&error=create");
  }

  await logAuditEvent({
    action: "client_year.created",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { clientId: clientParsed.data, year: yearParsed.data },
  });

  revalidatePath(basePath(slug, clientId, year));
  redirect(basePath(slug, clientId, year));
};

// ─── Update accounting status ──────────────────────────────────────────────

export const updateAccountingStatusAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant, role } = await requireTenantAccessBySlug(locale, slug);

  if (role !== "tenant_admin" && role !== "manager") {
    redirect(`/?error=forbidden`);
  }

  const parsed = z
    .object({
      client_year_id: uuidSchema,
      client_id: uuidSchema,
      year: yearSchema,
      accounting_status: z.enum(accountingStatusValues),
      issue_notes: z.string().trim().max(2000).optional().nullable(),
    })
    .safeParse({
      client_year_id: formData.get("client_year_id"),
      client_id: formData.get("client_id"),
      year: formData.get("year"),
      accounting_status: formData.get("accounting_status"),
      issue_notes: formData.get("issue_notes") || null,
    });

  if (!parsed.success) {
    redirect("/?error=validation");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("client_years")
    .update({
      accounting_status: parsed.data.accounting_status as AccountingStatus,
      issue_notes: parsed.data.issue_notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.client_year_id)
    .eq("tenant_id", tenant.id);

  if (error) {
    redirect(basePath(slug, parsed.data.client_id, parsed.data.year) + "&error=status");
  }

  await logAuditEvent({
    action: "client_year.accounting_status.updated",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: {
      clientYearId: parsed.data.client_year_id,
      accounting_status: parsed.data.accounting_status,
    },
  });

  revalidatePath(basePath(slug, parsed.data.client_id, parsed.data.year));
  redirect(basePath(slug, parsed.data.client_id, parsed.data.year));
};

// ─── Update report status ──────────────────────────────────────────────────

export const updateReportStatusAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant, role } = await requireTenantAccessBySlug(locale, slug);

  const parsed = z
    .object({
      client_year_id: uuidSchema,
      client_id: uuidSchema,
      year: yearSchema,
      report_status: z.enum(reportStatusValues),
      issue_notes: z.string().trim().max(2000).optional().nullable(),
    })
    .safeParse({
      client_year_id: formData.get("client_year_id"),
      client_id: formData.get("client_id"),
      year: formData.get("year"),
      report_status: formData.get("report_status"),
      issue_notes: formData.get("issue_notes") || null,
    });

  if (!parsed.success) {
    redirect("/?error=validation");
  }

  const supabase = await createSupabaseServerClient();

  // Contractors may only update report_status for client_years assigned to them
  if (role === "contractor") {
    const { data: cy } = await supabase
      .from("client_years")
      .select("contractor_id")
      .eq("id", parsed.data.client_year_id)
      .eq("tenant_id", tenant.id)
      .single();

    if (cy?.contractor_id !== user.id) {
      redirect(`/?error=forbidden`);
    }

    // Contractors cannot set ready_for_signature or submitted
    if (
      parsed.data.report_status === "ready_for_signature" ||
      parsed.data.report_status === "submitted"
    ) {
      redirect(`/?error=forbidden`);
    }
  } else if (role !== "tenant_admin" && role !== "manager") {
    redirect(`/?error=forbidden`);
  }

  // Managers may only set missing_completed
  if (role === "manager" && parsed.data.report_status !== "missing_completed") {
    redirect(`/?error=forbidden`);
  }

  const { error } = await supabase
    .from("client_years")
    .update({
      report_status: parsed.data.report_status as ReportStatus,
      issue_notes: parsed.data.issue_notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.client_year_id)
    .eq("tenant_id", tenant.id);

  if (error) {
    redirect(basePath(slug, parsed.data.client_id, parsed.data.year) + "&error=status");
  }

  await logAuditEvent({
    action: "client_year.report_status.updated",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: {
      clientYearId: parsed.data.client_year_id,
      report_status: parsed.data.report_status,
    },
  });

  revalidatePath(basePath(slug, parsed.data.client_id, parsed.data.year));
  redirect(basePath(slug, parsed.data.client_id, parsed.data.year));
};

// ─── Assign contractor ─────────────────────────────────────────────────────

export const assignContractorAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant, role } = await requireTenantAccessBySlug(locale, slug);

  if (role !== "tenant_admin") {
    redirect(`/?error=forbidden`);
  }

  const parsed = z
    .object({
      client_year_id: uuidSchema,
      client_id: uuidSchema,
      year: yearSchema,
      contractor_id: z.union([uuidSchema, z.literal("")]),
    })
    .safeParse({
      client_year_id: formData.get("client_year_id"),
      client_id: formData.get("client_id"),
      year: formData.get("year"),
      contractor_id: formData.get("contractor_id"),
    });

  if (!parsed.success) {
    redirect("/?error=validation");
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("client_years")
    .update({
      contractor_id: parsed.data.contractor_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.client_year_id)
    .eq("tenant_id", tenant.id);

  if (error) {
    redirect(basePath(slug, parsed.data.client_id, parsed.data.year) + "&error=assign");
  }

  await logAuditEvent({
    action: "client_year.contractor.assigned",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: {
      clientYearId: parsed.data.client_year_id,
      contractorId: parsed.data.contractor_id || null,
    },
  });

  revalidatePath(basePath(slug, parsed.data.client_id, parsed.data.year));
  redirect(basePath(slug, parsed.data.client_id, parsed.data.year));
};

// ─── Add document from standard list ─────────────────────────────────────

export const addDocumentFromTypeAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant, role } = await requireTenantAccessBySlug(locale, slug);

  const parsed = z
    .object({
      client_year_id: uuidSchema,
      client_id: uuidSchema,
      year: yearSchema,
      document_type_id: uuidSchema,
      free_text: z.string().trim().max(500).optional().nullable(),
    })
    .safeParse({
      client_year_id: formData.get("client_year_id"),
      client_id: formData.get("client_id"),
      year: formData.get("year"),
      document_type_id: formData.get("document_type_id"),
      free_text: formData.get("free_text") || null,
    });

  if (!parsed.success) {
    redirect("/?error=validation");
  }

  // Only manager, admin, or the assigned contractor may add documents
  const supabase = await createSupabaseServerClient();

  if (role === "contractor") {
    const { data: cy } = await supabase
      .from("client_years")
      .select("contractor_id")
      .eq("id", parsed.data.client_year_id)
      .eq("tenant_id", tenant.id)
      .single();

    if (cy?.contractor_id !== user.id) {
      redirect(`/?error=forbidden`);
    }
  } else if (role !== "tenant_admin" && role !== "manager") {
    redirect(`/?error=forbidden`);
  }

  const { error } = await supabase.from("client_year_documents").insert({
    client_year_id: parsed.data.client_year_id,
    document_type_id: parsed.data.document_type_id,
    free_text: parsed.data.free_text ?? null,
  });

  if (error) {
    redirect(basePath(slug, parsed.data.client_id, parsed.data.year) + "&error=doc_add");
  }

  await logAuditEvent({
    action: "client_year_document.added",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { clientYearId: parsed.data.client_year_id, documentTypeId: parsed.data.document_type_id },
  });

  revalidatePath(basePath(slug, parsed.data.client_id, parsed.data.year));
  redirect(basePath(slug, parsed.data.client_id, parsed.data.year));
};

// ─── Add custom document ───────────────────────────────────────────────────

export const addCustomDocumentAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant, role } = await requireTenantAccessBySlug(locale, slug);

  const parsed = z
    .object({
      client_year_id: uuidSchema,
      client_id: uuidSchema,
      year: yearSchema,
      custom_name: z.string().trim().min(1).max(300),
      free_text: z.string().trim().max(500).optional().nullable(),
    })
    .safeParse({
      client_year_id: formData.get("client_year_id"),
      client_id: formData.get("client_id"),
      year: formData.get("year"),
      custom_name: formData.get("custom_name"),
      free_text: formData.get("free_text") || null,
    });

  if (!parsed.success) {
    redirect("/?error=validation");
  }

  const supabase = await createSupabaseServerClient();

  if (role === "contractor") {
    const { data: cy } = await supabase
      .from("client_years")
      .select("contractor_id")
      .eq("id", parsed.data.client_year_id)
      .eq("tenant_id", tenant.id)
      .single();

    if (cy?.contractor_id !== user.id) {
      redirect(`/?error=forbidden`);
    }
  } else if (role !== "tenant_admin" && role !== "manager") {
    redirect(`/?error=forbidden`);
  }

  const { error } = await supabase.from("client_year_documents").insert({
    client_year_id: parsed.data.client_year_id,
    custom_name: parsed.data.custom_name,
    free_text: parsed.data.free_text ?? null,
  });

  if (error) {
    redirect(basePath(slug, parsed.data.client_id, parsed.data.year) + "&error=doc_add");
  }

  await logAuditEvent({
    action: "client_year_document.added_custom",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { clientYearId: parsed.data.client_year_id, customName: parsed.data.custom_name },
  });

  revalidatePath(basePath(slug, parsed.data.client_id, parsed.data.year));
  redirect(basePath(slug, parsed.data.client_id, parsed.data.year));
};

// ─── Remove document ──────────────────────────────────────────────────────

export const removeDocumentAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant, role } = await requireTenantAccessBySlug(locale, slug);

  const parsed = z
    .object({
      document_id: uuidSchema,
      client_year_id: uuidSchema,
      client_id: uuidSchema,
      year: yearSchema,
    })
    .safeParse({
      document_id: formData.get("document_id"),
      client_year_id: formData.get("client_year_id"),
      client_id: formData.get("client_id"),
      year: formData.get("year"),
    });

  if (!parsed.success) {
    redirect("/?error=validation");
  }

  if (role !== "tenant_admin" && role !== "manager") {
    redirect(`/?error=forbidden`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("client_year_documents")
    .delete()
    .eq("id", parsed.data.document_id)
    .eq("client_year_id", parsed.data.client_year_id);

  if (error) {
    redirect(basePath(slug, parsed.data.client_id, parsed.data.year) + "&error=doc_remove");
  }

  await logAuditEvent({
    action: "client_year_document.removed",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { documentId: parsed.data.document_id, clientYearId: parsed.data.client_year_id },
  });

  revalidatePath(basePath(slug, parsed.data.client_id, parsed.data.year));
  redirect(basePath(slug, parsed.data.client_id, parsed.data.year));
};

// ─────────────────────────────────────────────────────────────────────────────
// Revalidate pending AI status for a specific uploaded_file
// ─────────────────────────────────────────────────────────────────────────────

export type RecheckResult =
  | { status: "ok"; aiStatus: "valid" | "invalid"; notes: string | null }
  | { status: "error"; message: string }
  | null;

const revalidateFileSchema = z.object({
  file_id: uuidSchema,
  client_year_id: uuidSchema,
  client_id: uuidSchema,
  year: yearSchema,
});

export const revalidatePendingFileAction = async (
  lang: string,
  slug: string,
  _prevState: RecheckResult,
  formData: FormData,
): Promise<RecheckResult> => {
  const { tenant } = await requireTenantAccessBySlug(lang, slug);
  const parsed = revalidateFileSchema.safeParse({
    file_id: formData.get("file_id"),
    client_year_id: formData.get("client_year_id"),
    client_id: formData.get("client_id"),
    year: formData.get("year"),
  });
  if (!parsed.success) return { status: "error", message: "נתונים שגויים" };

  // Call the admin revalidate endpoint internally — re-use the same logic
  // by importing helpers directly (avoids HTTP round-trip in server action)
  const { validateUploadedDocument } = await import("@/lib/ai-validation");
  const { downloadFromDrive, extractDriveFileId } = await import("@/lib/google-drive");
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");

  const adminClient = createSupabaseAdminClient();

  // Load the file record. Admin client bypasses RLS, so every subsequent check
  // must prove this file belongs to the caller's tenant + the submitted client year.
  const { data: file } = await adminClient
    .from("uploaded_files")
    .select("id, drive_url, original_filename, client_year_document_id")
    .eq("id", parsed.data.file_id)
    .single();

  if (!file) return { status: "error", message: "הקובץ לא נמצא" };

  // uploaded_file → client_year_document must match the submitted client_year_id
  const { data: cyd } = await adminClient
    .from("client_year_documents")
    .select("id, custom_name, document_type_id, client_year_id")
    .eq("id", file.client_year_document_id)
    .eq("client_year_id", parsed.data.client_year_id)
    .single();

  if (!cyd) return { status: "error", message: "הקובץ לא נמצא" };

  // client_year must belong to this tenant and match the submitted client/year
  const { data: cy } = await adminClient
    .from("client_years")
    .select("year, tenant_id, client_id")
    .eq("id", cyd.client_year_id)
    .eq("tenant_id", tenant.id)
    .eq("client_id", parsed.data.client_id)
    .eq("year", parsed.data.year)
    .single();

  if (!cy) return { status: "error", message: "שנת הלקוח לא נמצאה" };

  let documentName = cyd.custom_name ?? "מסמך";
  let validationPrompt: string | null = null;
  if (cyd.document_type_id) {
    const { data: dt } = await adminClient
      .from("document_types")
      .select("name, validation_prompt")
      .eq("id", cyd.document_type_id)
      .single();
    if (dt?.name && !cyd.custom_name) documentName = dt.name;
    validationPrompt = dt?.validation_prompt ?? null;
  }

  // Get OAuth token
  const { data: secret } = await adminClient
    .from("tenant_secrets")
    .select("encrypted_key")
    .eq("tenant_id", tenant.id)
    .eq("service", "google_drive_oauth")
    .eq("is_active", true)
    .single();

  if (!secret) return { status: "error", message: "חיבור Google Drive לא מוגדר" };

  const fileId = extractDriveFileId(file.drive_url);
  if (!fileId) return { status: "error", message: "קישור Drive שגוי" };

  let result: RecheckResult;
  try {
    const fileBuffer = await downloadFromDrive({ refreshToken: secret.encrypted_key, fileId });
    const mimeType = file.original_filename.endsWith(".pdf")
      ? "application/pdf"
      : file.original_filename.match(/\.(jpg|jpeg)$/i)
        ? "image/jpeg"
        : file.original_filename.match(/\.png$/i)
          ? "image/png"
          : "application/octet-stream";

    const validation = await validateUploadedDocument({
      fileBuffer,
      mimeType,
      documentName,
      year: cy.year,
      validationPrompt,
    });

    await adminClient
      .from("uploaded_files")
      .update({
        ai_status: validation.valid ? "valid" : "invalid",
        ai_notes: validation.notes,
      })
      .eq("id", file.id);

    result = { status: "ok", aiStatus: validation.valid ? "valid" : "invalid", notes: validation.notes };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה לא ידועה";
    console.error("[revalidatePendingFileAction] error:", msg);
    // Leave ai_status unchanged on infrastructure failure (Drive/network).
    // Marking invalid here corrupted status on transient errors and, before the
    // ownership join above, could be abused cross-client via a crafted file_id.
    result = { status: "error", message: `שגיאה בהורדת הקובץ מ-Drive: ${msg}` };
  }

  revalidatePath(basePath(slug, parsed.data.client_id, parsed.data.year));
  return result;
};
