"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.object({ email: z.email() });

const passwordSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

const getTenantIdBySlug = async (slug: string) => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("tenants").select("id").eq("slug", slug).single();
  return data?.id ?? null;
};

export const signInForTenantAction = async (_locale: string, slug: string, formData: FormData) => {
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/${slug}/login?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await logAuditEvent({ action: "auth.sign_in.failed", payload: { email: parsed.data.email } });
    redirect(`/${slug}/login?error=auth`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  await logAuditEvent({
    action: "auth.sign_in.succeeded",
    actorUserId: user?.id,
    payload: { email: parsed.data.email },
  });

  if (!user) redirect(`/${slug}/login?error=auth`);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!tenant) redirect(`/${slug}/login?error=auth`);

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("role")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership) {
    redirect(
      membership.role === "tenant_admin"
        ? `/${slug}/backoffice`
        : `/${slug}/clients`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (profile?.is_platform_owner) {
    redirect(`/${slug}/backoffice`);
  }

  const email = parsed.data.email.toLowerCase();
  const { data: request } = await supabase
    .from("tenant_access_requests")
    .select("status")
    .eq("tenant_id", tenant.id)
    .eq("email", email)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (request?.status === "pending" || request?.status === "approved") {
    redirect(`/${slug}/login?status=pending`);
  }

  redirect(`/${slug}/login?status=no_access`);
};

export const sendMagicLinkForTenantAction = async (
  _locale: string,
  slug: string,
  formData: FormData,
) => {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/${slug}/login?error=validation`);
  }

  const email = parsed.data.email.toLowerCase();
  const admin = createSupabaseAdminClient();

  const tenantId = await getTenantIdBySlug(slug);
  if (!tenantId) redirect(`/${slug}/login?error=auth`);

  // Block duplicate pending requests
  const { data: existingRequest } = await admin
    .from("tenant_access_requests")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingRequest) {
    redirect(`/${slug}/login?status=already_requested`);
  }

  // Check if user exists and already has membership (skip creating a request)
  const { data: userList } = await admin.auth.admin.listUsers();
  const existingUser = userList?.users.find((u) => u.email?.toLowerCase() === email);

  if (existingUser) {
    const { data: membership } = await admin
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    const { data: profile } = await admin
      .from("profiles")
      .select("is_platform_owner")
      .eq("id", existingUser.id)
      .single();

    if (membership || profile?.is_platform_owner) {
      // Already a member — send a regular sign-in link
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?slug=${slug}`,
        },
      });
      redirect(`/${slug}/login?otp=sent`);
    }
  }

  // Create the access request
  await admin.from("tenant_access_requests").insert({
    tenant_id: tenantId,
    email,
  });

  await logAuditEvent({
    action: "tenant.access_request.created",
    tenantId,
    payload: { email },
  });

  // Send magic link — callback will check membership/request status
  const supabase = await createSupabaseServerClient();
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?slug=${slug}`,
    },
  });

  if (otpError) {
    redirect(`/${slug}/login?error=otp`);
  }

  redirect(`/${slug}/login?status=requested`);
};
