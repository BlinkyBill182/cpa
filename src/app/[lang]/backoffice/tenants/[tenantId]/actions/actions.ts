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

const saveConfigSchema = z.object({
  actionKey: z.string().min(1),
  drive_folder_id: z.string().trim().max(300).optional().nullable(),
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

export const saveActionConfigAction = async (
  _lang: string,
  tenantId: string,
  formData: FormData,
) => {
  const user = await requirePlatformOwner();

  const parsed = saveConfigSchema.safeParse({
    actionKey: formData.get("actionKey"),
    drive_folder_id: formData.get("drive_folder_id") || null,
  });

  if (!parsed.success) return;

  const { actionKey, drive_folder_id } = parsed.data;

  const config: Record<string, string | null> = {};
  if (drive_folder_id !== undefined) config.drive_folder_id = drive_folder_id;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("office_action_configs")
    .update({ config, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("action_key", actionKey);

  if (error) return;

  await logAuditEvent({
    action: "office_action.config_saved",
    actorUserId: user.id,
    tenantId,
    payload: { actionKey, drive_folder_id },
  });

  revalidatePath(`/backoffice/tenants/${tenantId}/actions`);
};
