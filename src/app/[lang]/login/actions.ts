"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const otpSchema = z.object({
  email: z.email(),
});

const getPostLoginDestination = async (locale: string): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return `/${locale}/login`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (profile?.is_platform_owner) {
    return `/${locale}/backoffice/tenants`;
  }

  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenants(slug)")
    .eq("user_id", user.id)
    .limit(1);

  type MembershipRow = { tenant_id: string; tenants: { slug: string } | null };
  const firstSlug = (memberships as MembershipRow[] | null)?.[0]?.tenants?.slug ?? null;

  if (firstSlug) {
    return `/${locale}/${firstSlug}/backoffice`;
  }

  return `/${locale}`;
};

export const signInAction = async (locale: string, formData: FormData) => {
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/${locale}/login?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await logAuditEvent({ action: "auth.sign_in.failed", payload: { email: parsed.data.email } });
    redirect(`/${locale}/login?error=auth`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  await logAuditEvent({
    action: "auth.sign_in.succeeded",
    actorUserId: user?.id,
    payload: { email: parsed.data.email },
  });

  const destination = await getPostLoginDestination(locale);
  redirect(destination);
};

export const signOutAction = async (locale: string) => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  await logAuditEvent({ action: "auth.sign_out", actorUserId: user?.id });
  redirect(`/${locale}/login`);
};

export const sendMagicLinkAction = async (locale: string, formData: FormData) => {
  const parsed = otpSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    redirect(`/${locale}/login?error=validation`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/${locale}/login?error=otp`);
  }

  redirect(`/${locale}/login?otp=sent`);
};
