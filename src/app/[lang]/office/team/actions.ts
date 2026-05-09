"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { tenantRoles } from "@/lib/auth/constants";
import { requireTenantAdmin } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(tenantRoles),
});

const removeSchema = z.object({
  userId: z.uuid(),
});

const updateRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(tenantRoles),
});

export const inviteMemberAction = async (locale: string, formData: FormData) => {
  const { user, tenantId } = await requireTenantAdmin(locale);
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(`/${locale}/office/team?error=validation`);
  }

  const email = parsed.data.email.toLowerCase();
  const admin = createSupabaseAdminClient();

  await admin.auth.admin.inviteUserByEmail(email);

  const { error } = await admin.from("tenant_invitations").insert({
    tenant_id: tenantId,
    invited_email: email,
    role: parsed.data.role,
    invited_by: user.id,
  });

  if (error) {
    redirect(`/${locale}/office/team?error=invite`);
  }

  await logAuditEvent({
    action: "tenant.member.invited",
    actorUserId: user.id,
    tenantId,
    payload: { email, role: parsed.data.role },
  });

  revalidatePath(`/${locale}/office/team`);
};

export const removeMemberAction = async (locale: string, formData: FormData) => {
  const { user, tenantId } = await requireTenantAdmin(locale);
  const parsed = removeSchema.safeParse({ userId: formData.get("userId") });

  if (!parsed.success || parsed.data.userId === user.id) {
    redirect(`/${locale}/office/team?error=remove`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    redirect(`/${locale}/office/team?error=remove`);
  }

  await logAuditEvent({
    action: "tenant.member.removed",
    actorUserId: user.id,
    tenantId,
    payload: { targetUserId: parsed.data.userId },
  });

  revalidatePath(`/${locale}/office/team`);
};

export const updateMemberRoleAction = async (locale: string, formData: FormData) => {
  const { user, tenantId } = await requireTenantAdmin(locale);
  const parsed = updateRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(`/${locale}/office/team?error=role`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({ role: parsed.data.role })
    .eq("tenant_id", tenantId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    redirect(`/${locale}/office/team?error=role`);
  }

  await logAuditEvent({
    action: "tenant.member.role_changed",
    actorUserId: user.id,
    tenantId,
    payload: { targetUserId: parsed.data.userId, role: parsed.data.role },
  });

  revalidatePath(`/${locale}/office/team`);
};
