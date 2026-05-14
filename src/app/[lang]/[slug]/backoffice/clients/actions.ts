"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireTenantManagerOrAdminBySlug } from "@/lib/auth/session";
import { parseOfficeClientsCsv } from "@/lib/csv/parse-office-clients-csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(500);
const taxIdSchema = z.string().trim().max(120).optional().nullable();
const uuidSchema = z.string().uuid();

export const createOfficeClientAction = async (_locale: string, slug: string, formData: FormData) => {
  const { tenant } = await requireTenantManagerOrAdminBySlug(_locale, slug);

  const parsed = z
    .object({
      name: nameSchema,
      tax_id: z.preprocess((v) => (v === "" || v == null ? null : v), taxIdSchema),
    })
    .safeParse({
      name: formData.get("name"),
      tax_id: formData.get("tax_id"),
    });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/clients?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("office_clients").insert({
    tenant_id: tenant.id,
    name: parsed.data.name,
    tax_id: parsed.data.tax_id ?? null,
  });

  if (error) {
    redirect(`/${slug}/backoffice/clients?error=save`);
  }

  revalidatePath(`/${slug}/backoffice/clients`);
  revalidatePath(`/${slug}/clients`);
  redirect(`/${slug}/backoffice/clients?created=1`);
};

export const updateOfficeClientAction = async (_locale: string, slug: string, formData: FormData) => {
  const { tenant } = await requireTenantManagerOrAdminBySlug(_locale, slug);

  const idParsed = uuidSchema.safeParse(formData.get("client_id"));
  if (!idParsed.success) redirect(`/${slug}/backoffice/clients?error=validation`);

  const parsed = z
    .object({
      name: nameSchema,
      tax_id: z.preprocess((v) => (v === "" || v == null ? null : v), taxIdSchema),
    })
    .safeParse({
      name: formData.get("name"),
      tax_id: formData.get("tax_id"),
    });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/clients?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("office_clients")
    .update({
      name: parsed.data.name,
      tax_id: parsed.data.tax_id ?? null,
    })
    .eq("id", idParsed.data)
    .eq("tenant_id", tenant.id);

  if (error) {
    redirect(`/${slug}/backoffice/clients?error=save`);
  }

  revalidatePath(`/${slug}/backoffice/clients`);
  revalidatePath(`/${slug}/clients`);
  redirect(`/${slug}/backoffice/clients?updated=1`);
};

export const softDeleteOfficeClientAction = async (_locale: string, slug: string, formData: FormData) => {
  const { tenant } = await requireTenantManagerOrAdminBySlug(_locale, slug);

  const idParsed = uuidSchema.safeParse(formData.get("client_id"));
  if (!idParsed.success) redirect(`/${slug}/backoffice/clients?error=validation`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("office_clients")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", idParsed.data)
    .eq("tenant_id", tenant.id);

  if (error) {
    redirect(`/${slug}/backoffice/clients?error=save`);
  }

  revalidatePath(`/${slug}/backoffice/clients`);
  revalidatePath(`/${slug}/clients`);
  redirect(`/${slug}/backoffice/clients?archived=1`);
};

export const importOfficeClientsCsvAction = async (_locale: string, slug: string, formData: FormData) => {
  const { tenant } = await requireTenantManagerOrAdminBySlug(_locale, slug);

  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0 || file.size > 2_000_000) {
    redirect(`/${slug}/backoffice/clients?error=csv`);
  }

  const text = await file.text();
  const { rows, headers } = parseOfficeClientsCsv(text);
  if (headers.length === 0 || rows.length === 0) {
    redirect(`/${slug}/backoffice/clients?error=csv_empty`);
  }

  const supabase = await createSupabaseServerClient();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.id) {
      const idCheck = uuidSchema.safeParse(row.id);
      if (!idCheck.success) {
        skipped++;
        continue;
      }

      const { data: existing } = await supabase
        .from("office_clients")
        .select("id")
        .eq("id", idCheck.data)
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (!existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("office_clients")
        .update({
          name: row.name,
          tax_id: row.tax_id,
          deleted_at: null,
        })
        .eq("id", idCheck.data)
        .eq("tenant_id", tenant.id);

      if (error) skipped++;
      else updated++;
    } else {
      const { error } = await supabase.from("office_clients").insert({
        tenant_id: tenant.id,
        name: row.name,
        tax_id: row.tax_id,
      });

      if (error) skipped++;
      else inserted++;
    }
  }

  revalidatePath(`/${slug}/backoffice/clients`);
  revalidatePath(`/${slug}/clients`);
  redirect(
    `/${slug}/backoffice/clients?imported=${inserted}&updated=${updated}&skipped=${skipped}`,
  );
};
