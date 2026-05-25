"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

import { logAuditEvent } from "@/lib/auth/audit";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const toggleSchema = z.object({
  actionKey: z.string().min(1),
  isEnabled: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export const toggleActionAction = async (
  _lang: string,
  tenantId: string,
  formData: FormData,
) => {
  const user = await requirePlatformOwner();

  const parsed = toggleSchema.safeParse({
    actionKey: formData.get("actionKey"),
    isEnabled: formData.get("isEnabled"),
  });

  if (!parsed.success) {
    return;
  }

  const { actionKey, isEnabled } = parsed.data;

  const supabase = await createSupabaseServerClient();

  const { error: upsertError } = await supabase.from("office_action_configs").upsert(
    {
      tenant_id: tenantId,
      action_key: actionKey,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,action_key" },
  );

  if (upsertError) {
    return;
  }

  await logAuditEvent({
    action: "office_action.toggled",
    actorUserId: user.id,
    tenantId,
    payload: { actionKey, isEnabled },
  });

  revalidatePath(`/backoffice/tenants/${tenantId}/actions`);
};
