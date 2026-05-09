import "server-only";

import type { User } from "@supabase/supabase-js";

import { logAuditEvent } from "@/lib/auth/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const syncPendingInvitations = async (user: User) => {
  if (!user.email) {
    return;
  }

  const email = user.email.toLowerCase();
  const admin = createSupabaseAdminClient();

  const { data: invitations } = await admin
    .from("tenant_invitations")
    .select("id, tenant_id, role")
    .eq("invited_email", email)
    .eq("status", "pending");

  if (!invitations || invitations.length === 0) {
    return;
  }

  for (const invitation of invitations) {
    await admin
      .from("tenant_memberships")
      .upsert({ tenant_id: invitation.tenant_id, user_id: user.id, role: invitation.role }, { onConflict: "tenant_id,user_id" });

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
};
