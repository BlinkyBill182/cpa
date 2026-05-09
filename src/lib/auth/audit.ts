import "server-only";

import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditInput = {
  action: string;
  actorUserId?: string;
  tenantId?: string;
  payload?: Json;
};

export const logAuditEvent = async ({ action, actorUserId, tenantId, payload = {} }: AuditInput) => {
  const admin = createSupabaseAdminClient();

  await admin.from("audit_logs").insert({
    action,
    actor_user_id: actorUserId ?? null,
    tenant_id: tenantId ?? null,
    payload,
  });
};
