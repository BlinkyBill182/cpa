"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { requireTenantAdminBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(300);
const uuidSchema = z.string().uuid();

const parseFormats = (raw: FormDataEntryValue | null): string[] => {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
};

// ─── Create document type ──────────────────────────────────────────────────

export const createDocumentTypeAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);

  const parsed = z
    .object({
      name: nameSchema,
      allowed_formats: z.array(z.string()).default([]),
    })
    .safeParse({
      name: formData.get("name"),
      allowed_formats: parseFormats(formData.get("allowed_formats")),
    });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("document_types").insert({
    tenant_id: tenant.id,
    name: parsed.data.name,
    allowed_formats: parsed.data.allowed_formats,
  });

  if (error) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  await logAuditEvent({
    action: "document_type.created",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { name: parsed.data.name },
  });

  revalidatePath(`/${slug}/backoffice/document-types`);
  redirect(`/${slug}/backoffice/document-types?created=1`);
};

// ─── Update document type ──────────────────────────────────────────────────

export const updateDocumentTypeAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);

  const parsed = z
    .object({
      id: uuidSchema,
      name: nameSchema,
      allowed_formats: z.array(z.string()).default([]),
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      allowed_formats: parseFormats(formData.get("allowed_formats")),
    });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("document_types")
    .update({
      name: parsed.data.name,
      allowed_formats: parsed.data.allowed_formats,
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", tenant.id);

  if (error) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  await logAuditEvent({
    action: "document_type.updated",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { id: parsed.data.id, name: parsed.data.name },
  });

  revalidatePath(`/${slug}/backoffice/document-types`);
  redirect(`/${slug}/backoffice/document-types?updated=1`);
};

// ─── Adopt a global document type ─────────────────────────────────────────

export const adoptGlobalDocumentTypeAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);

  const parsed = z
    .object({ id: uuidSchema })
    .safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  // Fetch the global type (must have tenant_id IS NULL)
  const { data: globalType, error: fetchError } = await supabase
    .from("document_types")
    .select("name, allowed_formats")
    .eq("id", parsed.data.id)
    .is("tenant_id", null)
    .single();

  if (fetchError || !globalType) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  // Check for name collision in tenant's own types
  const { data: existing } = await supabase
    .from("document_types")
    .select("id")
    .eq("tenant_id", tenant.id)
    .ilike("name", globalType.name)
    .maybeSingle();

  if (existing) {
    redirect(`/${slug}/backoffice/document-types?error=already_exists`);
  }

  // Create the tenant's copy
  const { error: insertError } = await supabase.from("document_types").insert({
    tenant_id: tenant.id,
    name: globalType.name,
    allowed_formats: globalType.allowed_formats,
  });

  if (insertError) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  await logAuditEvent({
    action: "document_type.adopted_from_global",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { global_id: parsed.data.id, name: globalType.name },
  });

  revalidatePath(`/${slug}/backoffice/document-types`);
  redirect(`/${slug}/backoffice/document-types?adopted=1`);
};

// ─── Delete document type ──────────────────────────────────────────────────

export const deleteDocumentTypeAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);

  const parsed = z
    .object({ id: uuidSchema })
    .safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  // Confirm the type belongs to this tenant and read its name
  const { data: docType, error: fetchError } = await supabase
    .from("document_types")
    .select("id, name")
    .eq("id", parsed.data.id)
    .eq("tenant_id", tenant.id)
    .single();

  if (fetchError || !docType) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  // client_year_documents has CHECK (document_type_id IS NOT NULL OR custom_name IS NOT NULL)
  // and ON DELETE SET NULL on document_type_id — so copy the name first where needed.
  const { error: preserveError } = await supabase
    .from("client_year_documents")
    .update({ custom_name: docType.name })
    .eq("document_type_id", docType.id)
    .is("custom_name", null);

  if (preserveError) {
    console.error("[deleteDocumentType] preserve name failed:", preserveError);
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  const { error } = await supabase
    .from("document_types")
    .delete()
    .eq("id", docType.id)
    .eq("tenant_id", tenant.id);

  if (error) {
    console.error("[deleteDocumentType] delete failed:", error);
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  await logAuditEvent({
    action: "document_type.deleted",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { id: docType.id, name: docType.name },
  });

  revalidatePath(`/${slug}/backoffice/document-types`);
  redirect(`/${slug}/backoffice/document-types?deleted=1`);
};

// ─── Toggle active ─────────────────────────────────────────────────────────

export const toggleDocumentTypeActiveAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);

  const parsed = z
    .object({
      id: uuidSchema,
      is_active: z.coerce.boolean(),
    })
    .safeParse({
      id: formData.get("id"),
      is_active: formData.get("is_active") === "true",
    });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("document_types")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.id)
    .eq("tenant_id", tenant.id);

  if (error) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  await logAuditEvent({
    action: parsed.data.is_active ? "document_type.activated" : "document_type.deactivated",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { id: parsed.data.id },
  });

  revalidatePath(`/${slug}/backoffice/document-types`);
  redirect(`/${slug}/backoffice/document-types`);
};
