import { redirect } from "next/navigation";

import type { TenantRole } from "@/lib/auth/constants";
import { getActiveTenant } from "@/lib/auth/tenant-context";
import { syncPendingInvitations } from "@/lib/auth/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const requireUser = async (locale: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect(`/${locale}/login`);
  }

  await syncPendingInvitations(data.user);

  return data.user;
};

export const requirePlatformOwner = async (locale: string) => {
  const user = await requireUser(locale);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (error || !data?.is_platform_owner) {
    redirect(`/${locale}`);
  }

  return user;
};

export const requireTenantAccess = async (locale: string) => {
  const user = await requireUser(locale);
  const activeTenantId = await getActiveTenant();

  if (!activeTenantId) {
    redirect(`/${locale}/office?error=tenant_required`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("tenant_id", activeTenantId)
    .eq("user_id", user.id)
    .single();

  if (error || !data) {
    redirect(`/${locale}/office?error=tenant_access`);
  }

  return {
    user,
    tenantId: data.tenant_id,
    role: data.role as TenantRole,
  };
};

export const requireTenantAdmin = async (locale: string) => {
  const membership = await requireTenantAccess(locale);

  if (membership.role !== "tenant_admin") {
    redirect(`/${locale}/office?error=forbidden`);
  }

  return membership;
};
