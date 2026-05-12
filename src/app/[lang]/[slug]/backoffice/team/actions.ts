"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { tenantRoles } from "@/lib/auth/constants";
import { requireTenantAdminBySlug } from "@/lib/auth/session";
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

const approveRequestSchema = z.object({
  requestId: z.uuid(),
  role: z.enum(tenantRoles),
});

const rejectRequestSchema = z.object({
  requestId: z.uuid(),
});

export const inviteMemberAction = async (locale: string, slug: string, formData: FormData) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/team?error=validation`);
  }

  const email = parsed.data.email.toLowerCase();
  const admin = createSupabaseAdminClient();

  const { data: existingUser } = await admin.auth.admin.listUsers();
  const match = existingUser?.users.find((u) => u.email?.toLowerCase() === email);

  if (match) {
    const { data: existingMembership } = await admin
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", match.id)
      .maybeSingle();

    if (existingMembership) {
      redirect(`/${slug}/backoffice/team?error=already_member`);
    }
  }

  await admin.auth.admin.inviteUserByEmail(email);

  const { error } = await admin.from("tenant_invitations").insert({
    tenant_id: tenant.id,
    invited_email: email,
    role: parsed.data.role,
    invited_by: user.id,
  });

  if (error) {
    redirect(`/${slug}/backoffice/team?error=invite`);
  }

  await logAuditEvent({
    action: "tenant.member.invited",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { email, role: parsed.data.role },
  });

  revalidatePath(`/${locale}/${slug}/backoffice/team`);
};

export const removeMemberAction = async (locale: string, slug: string, formData: FormData) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);
  const parsed = removeSchema.safeParse({ userId: formData.get("userId") });

  if (!parsed.success || parsed.data.userId === user.id) {
    redirect(`/${slug}/backoffice/team?error=remove`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("user_id", parsed.data.userId);

  if (error) {
    redirect(`/${slug}/backoffice/team?error=remove`);
  }

  await logAuditEvent({
    action: "tenant.member.removed",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { targetUserId: parsed.data.userId },
  });

  revalidatePath(`/${locale}/${slug}/backoffice/team`);
};

export const updateMemberRoleAction = async (locale: string, slug: string, formData: FormData) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);
  const parsed = updateRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/team?error=role`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({ role: parsed.data.role })
    .eq("tenant_id", tenant.id)
    .eq("user_id", parsed.data.userId);

  if (error) {
    redirect(`/${slug}/backoffice/team?error=role`);
  }

  await logAuditEvent({
    action: "tenant.member.role_changed",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { targetUserId: parsed.data.userId, role: parsed.data.role },
  });

  revalidatePath(`/${locale}/${slug}/backoffice/team`);
};

export const approveAccessRequestAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);
  const parsed = approveRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/team?error=validation`);
  }

  const admin = createSupabaseAdminClient();

  const { data: request } = await admin
    .from("tenant_access_requests")
    .select("id, email, tenant_id")
    .eq("id", parsed.data.requestId)
    .eq("tenant_id", tenant.id)
    .eq("status", "pending")
    .single();

  if (!request) {
    redirect(`/${slug}/backoffice/team?error=not_found`);
  }

  // If the user already has an account, create membership immediately
  const { data: userList } = await admin.auth.admin.listUsers();
  const existingUser = userList?.users.find(
    (u) => u.email?.toLowerCase() === request.email.toLowerCase(),
  );

  if (existingUser) {
    await admin
      .from("tenant_memberships")
      .upsert(
        { tenant_id: tenant.id, user_id: existingUser.id, role: parsed.data.role },
        { onConflict: "tenant_id,user_id" },
      );
  }

  // Store role on the request — used by the callback if user hasn't clicked the magic link yet
  await admin
    .from("tenant_access_requests")
    .update({
      status: "approved",
      role: parsed.data.role,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  await logAuditEvent({
    action: "tenant.access_request.approved",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { requestId: request.id, email: request.email, role: parsed.data.role },
  });

  revalidatePath(`/${locale}/${slug}/backoffice/team`);
};

export const rejectAccessRequestAction = async (
  locale: string,
  slug: string,
  formData: FormData,
) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);
  const parsed = rejectRequestSchema.safeParse({ requestId: formData.get("requestId") });

  if (!parsed.success) {
    redirect(`/${slug}/backoffice/team?error=validation`);
  }

  const admin = createSupabaseAdminClient();

  const { data: request } = await admin
    .from("tenant_access_requests")
    .select("id, email")
    .eq("id", parsed.data.requestId)
    .eq("tenant_id", tenant.id)
    .eq("status", "pending")
    .single();

  if (!request) {
    redirect(`/${slug}/backoffice/team?error=not_found`);
  }

  await admin
    .from("tenant_access_requests")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  await logAuditEvent({
    action: "tenant.access_request.rejected",
    actorUserId: user.id,
    tenantId: tenant.id,
    payload: { requestId: request.id, email: request.email },
  });

  revalidatePath(`/${locale}/${slug}/backoffice/team`);
};
