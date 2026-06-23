"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireTenantManagerOrAdminBySlug } from "@/lib/auth/session";
import { parseOfficeClientsCsv } from "@/lib/csv/parse-office-clients-csv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const nameSchema = z.string().trim().min(1).max(500);
const taxIdSchema = z.string().trim().max(120).optional().nullable();
const emailSchema = z.string().trim().email().max(320).optional().nullable();
const phoneSchema = z.string().trim().max(50).optional().nullable();
const namePartSchema = z.string().trim().max(200).optional().nullable();
const uuidSchema = z.string().uuid();

export const createOfficeClientAction = async (_locale: string, slug: string, formData: FormData) => {
  const { tenant } = await requireTenantManagerOrAdminBySlug(_locale, slug);

  const nullify = (v: unknown) => (v === "" || v == null ? null : v);
  const parsed = z
    .object({
      name: nameSchema,
      tax_id: z.preprocess(nullify, taxIdSchema),
      email: z.preprocess(nullify, emailSchema),
      phone: z.preprocess(nullify, phoneSchema),
      first_name: z.preprocess(nullify, namePartSchema),
      last_name: z.preprocess(nullify, namePartSchema),
    })
    .safeParse({
      name: formData.get("name"),
      tax_id: formData.get("tax_id"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
    });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/clients?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("office_clients").insert({
    tenant_id: tenant.id,
    name: parsed.data.name,
    tax_id: parsed.data.tax_id ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    first_name: parsed.data.first_name ?? null,
    last_name: parsed.data.last_name ?? null,
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

  const nullify = (v: unknown) => (v === "" || v == null ? null : v);
  const parsed = z
    .object({
      name: nameSchema,
      tax_id: z.preprocess(nullify, taxIdSchema),
      email: z.preprocess(nullify, emailSchema),
      phone: z.preprocess(nullify, phoneSchema),
      first_name: z.preprocess(nullify, namePartSchema),
      last_name: z.preprocess(nullify, namePartSchema),
    })
    .safeParse({
      name: formData.get("name"),
      tax_id: formData.get("tax_id"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
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
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      first_name: parsed.data.first_name ?? null,
      last_name: parsed.data.last_name ?? null,
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
    } else if (row.tax_id) {
      const tax = row.tax_id.trim();
      const { data: matches } = await supabase
        .from("office_clients")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("tax_id", tax)
        .limit(2);

      if ((matches?.length ?? 0) > 1) {
        skipped++;
        continue;
      }

      const existing = matches?.[0];
      if (existing) {
        const { error } = await supabase
          .from("office_clients")
          .update({
            name: row.name,
            tax_id: tax,
            deleted_at: null,
          })
          .eq("id", existing.id)
          .eq("tenant_id", tenant.id);

        if (error) skipped++;
        else updated++;
      } else {
        const { error } = await supabase.from("office_clients").insert({
          tenant_id: tenant.id,
          name: row.name,
          tax_id: tax,
        });

        if (error) skipped++;
        else inserted++;
      }
    } else {
      const { error } = await supabase.from("office_clients").insert({
        tenant_id: tenant.id,
        name: row.name,
        tax_id: null,
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
