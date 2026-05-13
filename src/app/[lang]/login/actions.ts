"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { logAuditEvent } from "@/lib/auth/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

const otpSchema = z.object({
  email: z.email(),
});

const getPostLoginDestination = async (): Promise<string> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return "/login";

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  if (profile?.is_platform_owner) {
    return "/backoffice/tenants";
  }

  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, tenants(slug)")
    .eq("user_id", user.id)
    .limit(1);

  type MembershipRow = { tenant_id: string; role: string; tenants: { slug: string } | null };
  const first = (memberships as MembershipRow[] | null)?.[0] ?? null;

  if (first?.tenants?.slug) {
    const { slug } = first.tenants;
    return first.role === "tenant_admin"
      ? `/${slug}/backoffice`
      : `/${slug}/clients`;
  }

  return "/";
};

export const signInAction = async (_locale: string, formData: FormData) => {
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=validation");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await logAuditEvent({ action: "auth.sign_in.failed", payload: { email: parsed.data.email } });
    redirect("/login?error=auth");
  }

  const { data: { user } } = await supabase.auth.getUser();
  await logAuditEvent({
    action: "auth.sign_in.succeeded",
    actorUserId: user?.id,
    payload: { email: parsed.data.email },
  });

  const destination = await getPostLoginDestination();
  redirect(destination);
};

export const signOutAction = async () => {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  await logAuditEvent({ action: "auth.sign_out", actorUserId: user?.id });
  redirect("/login");
};

export const sendMagicLinkAction = async (_locale: string, formData: FormData) => {
  const parsed = otpSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    redirect("/login?error=validation");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    redirect("/login?error=otp");
  }

  redirect("/login?otp=sent");
};
