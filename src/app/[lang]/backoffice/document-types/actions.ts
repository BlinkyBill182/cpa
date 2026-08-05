"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { requirePlatformOwner } from "@/lib/auth/session";
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

// ─── Create global document type ────────────────────────────────────────────

export const createGlobalDocumentTypeAction = async (
  locale: string,
  formData: FormData,
) => {
  const user = await requirePlatformOwner(locale);

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
    redirect(`/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("document_types").insert({
    tenant_id: null, // global type — no tenant
    name: parsed.data.name,
    allowed_formats: parsed.data.allowed_formats,
  });

  if (error) {
    redirect(`/backoffice/document-types?error=save`);
  }

  await logAuditEvent({
    action: "global_document_type.created",
    actorUserId: user.id,
    payload: { name: parsed.data.name },
  });

  revalidatePath(`/backoffice/document-types`);
  redirect(`/backoffice/document-types?created=1`);
};

// ─── Update global document type ────────────────────────────────────────────

export const updateGlobalDocumentTypeAction = async (
  locale: string,
  formData: FormData,
) => {
  const user = await requirePlatformOwner(locale);

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
    redirect(`/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("document_types")
    .update({
      name: parsed.data.name,
      allowed_formats: parsed.data.allowed_formats,
    })
    .eq("id", parsed.data.id)
    .is("tenant_id", null); // only global types

  if (error) {
    redirect(`/backoffice/document-types?error=save`);
  }

  await logAuditEvent({
    action: "global_document_type.updated",
    actorUserId: user.id,
    payload: { id: parsed.data.id, name: parsed.data.name },
  });

  revalidatePath(`/backoffice/document-types`);
  redirect(`/backoffice/document-types?updated=1`);
};

// ─── Toggle active ───────────────────────────────────────────────────────────

export const toggleGlobalDocumentTypeActiveAction = async (
  locale: string,
  formData: FormData,
) => {
  const user = await requirePlatformOwner(locale);

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
    redirect(`/backoffice/document-types?error=save`);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("document_types")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.id)
    .is("tenant_id", null);

  if (error) {
    redirect(`/backoffice/document-types?error=save`);
  }

  await logAuditEvent({
    action: parsed.data.is_active
      ? "global_document_type.activated"
      : "global_document_type.deactivated",
    actorUserId: user.id,
    payload: { id: parsed.data.id },
  });

  revalidatePath(`/backoffice/document-types`);
  redirect(`/backoffice/document-types`);
};
