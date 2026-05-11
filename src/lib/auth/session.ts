import "server-only";

import { notFound, redirect } from "next/navigation";

import type { TenantRole } from "@/lib/auth/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const requireUser = async (locale: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect(`/${locale}/login`);
  }

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

export const requireTenantAccessBySlug = async (locale: string, slug: string) => {
  const supabase = await createSupabaseServerClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect(`/${locale}/login`);
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

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect(`/${locale}?error=tenant_access`);
  }

  return { user, tenant, role: membership.role as TenantRole };
};

export const requireTenantAdminBySlug = async (locale: string, slug: string) => {
  const access = await requireTenantAccessBySlug(locale, slug);

  if (access.role !== "tenant_admin") {
    redirect(`/${locale}/${slug}/backoffice?error=forbidden`);
  }

  return access;
};
