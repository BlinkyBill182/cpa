import "server-only";

import { notFound, redirect } from "next/navigation";

import type { TenantRole } from "@/lib/auth/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const requireUser = async (_locale?: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return data.user;
};

export const requirePlatformOwner = async (_locale?: string) => {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (error || !data?.is_platform_owner) {
    redirect("/");
  }

  return user;
};

export const requireTenantAccessBySlug = async (_locale: string, slug: string) => {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect("/login");
  }

  const user = authData.user;

  // Admin client bypasses RLS: a non-member cannot see a tenant row via their
  // own session, so we'd get a false 404 instead of the correct "access denied".
  const admin = createSupabaseAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!tenant) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (profile?.is_platform_owner) {
    return { user, tenant, role: "tenant_admin" as TenantRole };
  }

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect(`/?error=tenant_access`);
  }

  return { user, tenant, role: membership.role as TenantRole };
};

export const requireTenantAdminBySlug = async (_locale: string, slug: string) => {
  const access = await requireTenantAccessBySlug(_locale, slug);

  if (access.role !== "tenant_admin") {
    redirect(`/${slug}/backoffice?error=forbidden`);
  }

  return access;
};
