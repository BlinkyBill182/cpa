import "server-only";

import type { User } from "@supabase/supabase-js";

import { logAuditEvent } from "@/lib/auth/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SyncResult = { count: number; firstSlug: string | null };

export const syncPendingInvitations = async (user: User): Promise<SyncResult> => {
  if (!user.email) return { count: 0, firstSlug: null };

  const email = user.email.toLowerCase();
  const admin = createSupabaseAdminClient();

  const { data: invitations } = await admin
    .from("tenant_invitations")
    .select("id, tenant_id, role")
    .eq("invited_email", email)
    .eq("status", "pending");

  if (!invitations || invitations.length === 0) return { count: 0, firstSlug: null };

  for (const invitation of invitations) {
    const { data: existingMembership } = await admin
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMembership && existingMembership.tenant_id !== invitation.tenant_id) {
      await admin.from("tenant_invitations").update({ status: "rejected" }).eq("id", invitation.id);
      continue;
    }

    await admin
      .from("tenant_memberships")
      .upsert(
        { tenant_id: invitation.tenant_id, user_id: user.id, role: invitation.role },
        { onConflict: "tenant_id,user_id" },
      );

    await admin
      .from("tenant_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_user_id: user.id,
      })
      .eq("id", invitation.id);

    await logAuditEvent({
      action: "tenant.invitation.accepted",
      actorUserId: user.id,
      tenantId: invitation.tenant_id,
      payload: { invitationId: invitation.id, role: invitation.role, email },
    });
  }

  const { data: firstTenant } = await admin
    .from("tenants")
    .select("slug")
    .eq("id", invitations[0].tenant_id)
    .single();

  return { count: invitations.length, firstSlug: firstTenant?.slug ?? null };
};
