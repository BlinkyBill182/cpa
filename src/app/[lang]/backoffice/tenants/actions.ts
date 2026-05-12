"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const RESERVED_SLUGS = new Set(["backoffice", "login", "auth", "api", "admin", "en", "he"]);

const tenantSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
});

export const createTenantAction = async (locale: string, formData: FormData) => {
  const user = await requirePlatformOwner(locale);
  const supabase = await createSupabaseServerClient();

  const parsed = tenantSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  if (!parsed.success) {
    redirect("/backoffice/tenants?error=validation");
  }

  if (RESERVED_SLUGS.has(parsed.data.slug)) {
    redirect("/backoffice/tenants?error=reserved_slug");
  }

  const { error } = await supabase.from("tenants").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    created_by: user.id,
  });

  if (error) {
    redirect("/backoffice/tenants?error=insert");
  }

  await logAuditEvent({
    action: "tenant.created",
    actorUserId: user.id,
    payload: { name: parsed.data.name, slug: parsed.data.slug },
  });

  revalidatePath(`/${locale}/backoffice/tenants`);
};
