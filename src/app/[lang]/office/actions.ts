"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { setActiveTenant } from "@/lib/auth/tenant-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const chooseTenantSchema = z.object({
  tenantId: z.uuid(),
});

export const setActiveTenantAction = async (locale: string, formData: FormData) => {
  const user = await requireUser(locale);
  const parsed = chooseTenantSchema.safeParse({
    tenantId: formData.get("tenantId"),
  });

  if (!parsed.success) {
    redirect(`/${locale}/office?error=tenant_required`);
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("tenant_id", parsed.data.tenantId)
    .eq("user_id", user.id)
    .single();

  if (!data) {
    redirect(`/${locale}/office?error=tenant_access`);
  }

  await setActiveTenant(parsed.data.tenantId);
  revalidatePath(`/${locale}/office`);
  redirect(`/${locale}/office/team`);
};
