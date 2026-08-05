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
      validation_prompt: z.string().trim().max(4000).optional().nullable(),
    })
    .safeParse({
      name: formData.get("name"),
      allowed_formats: parseFormats(formData.get("allowed_formats")),
      validation_prompt: formData.get("validation_prompt") || null,
    });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("document_types").insert({
    tenant_id: tenant.id,
    name: parsed.data.name,
    allowed_formats: parsed.data.allowed_formats,
    validation_prompt: parsed.data.validation_prompt ?? null,
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
      validation_prompt: z.string().trim().max(4000).optional().nullable(),
    })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      allowed_formats: parseFormats(formData.get("allowed_formats")),
      validation_prompt: formData.get("validation_prompt") || null,
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
      validation_prompt: parsed.data.validation_prompt ?? null,
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

  // Create the tenant's copy (no validation_prompt — tenant can add their own later)
  const { error: insertError } = await supabase.from("document_types").insert({
    tenant_id: tenant.id,
    name: globalType.name,
    allowed_formats: globalType.allowed_formats,
    validation_prompt: null,
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
