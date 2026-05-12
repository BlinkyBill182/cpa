"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { tenantRoles } from "@/lib/auth/constants";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const assignSchema = z.object({
  userId: z.uuid(),
  role: z.enum(tenantRoles),
});

export const assignMemberByUserIdAction = async (
  locale: string,
  tenantId: string,
  formData: FormData,
) => {
  const owner = await requirePlatformOwner(locale);
  const parsed = assignSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(`/backoffice/tenants/${tenantId}/members?error=validation`);
  }

  const admin = createSupabaseAdminClient();

  const { data: existingMembership } = await admin
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (existingMembership && existingMembership.tenant_id !== tenantId) {
    redirect(`/backoffice/tenants/${tenantId}/members?error=already_member`);
  }

  const { error } = await admin.from("tenant_memberships").upsert(
    {
      tenant_id: tenantId,
      user_id: parsed.data.userId,
      role: parsed.data.role,
    },
    { onConflict: "tenant_id,user_id" },
  );

  if (error) {
    redirect(`/backoffice/tenants/${tenantId}/members?error=assign`);
  }

  await logAuditEvent({
    action: "tenant.member.upserted_by_owner",
    actorUserId: owner.id,
    tenantId,
    payload: { targetUserId: parsed.data.userId, role: parsed.data.role },
  });

  revalidatePath(`/${locale}/backoffice/tenants/${tenantId}/members`);
};
