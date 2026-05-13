import { notFound, redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getDictionary } from "@/i18n/get-dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { sendMagicLinkForTenantAction, signInForTenantAction } from "./actions";

type OfficeLoginPageProps = {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ error?: string; otp?: string; status?: string }>;
};

export default async function OfficeLoginPage({ params, searchParams }: OfficeLoginPageProps) {
  const { lang, slug } = await params;
  const { error, otp, status } = await searchParams;
  const dict = await getDictionary(lang);

  const supabase = await createSupabaseServerClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!tenant) notFound();

  // Redirect already-authenticated members straight to their destination
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const [{ data: membership }, { data: profile }] = await Promise.all([
      supabase
        .from("tenant_memberships")
        .select("role")
        .eq("tenant_id", tenant.id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("is_platform_owner")
        .eq("id", user.id)
        .single(),
    ]);

    if (profile?.is_platform_owner) {
      redirect(`/${slug}/backoffice`);
    }
    if (membership) {
      redirect(
        membership.role === "tenant_admin"
          ? `/${slug}/backoffice`
          : `/${slug}/clients`,
      );
    }
  }

  const statusMessage = (() => {
    if (status === "requested") return dict.officeLogin.statusRequested;
    if (status === "pending") return dict.officeLogin.statusPending;
    if (status === "already_requested") return dict.officeLogin.statusAlreadyRequested;
    if (status === "rejected") return dict.officeLogin.statusRejected;
    if (status === "no_access") return dict.officeLogin.statusNoAccess;
    return null;
  })();

  const isWarning = status === "no_access" || status === "rejected";

  return (
    <section className="flex w-full max-w-sm flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-blue-600">{dict.officeLogin.signInTo}</p>
        <h1 className="text-3xl font-semibold text-blue-900">{tenant.name}</h1>
        <p className="text-slate-600">{dict.officeLogin.description}</p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.login.error}
        </p>
      ) : null}

      {statusMessage ? (
        <p
          className={`rounded-md border px-3 py-2 text-sm ${
            isWarning
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          {statusMessage}
        </p>
      ) : null}

      {otp === "sent" ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {dict.login.otpSent}
        </p>
      ) : null}

      <LoginForm
        emailLabel={dict.login.email}
        passwordLabel={dict.login.password}
        submitLabel={dict.login.submit}
        action={signInForTenantAction.bind(null, lang, slug)}
      />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-blue-100" />
        <span className="text-xs text-slate-500">{dict.login.orLabel}</span>
        <span className="h-px flex-1 bg-blue-100" />
      </div>

      <form action={sendMagicLinkForTenantAction.bind(null, lang, slug)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.login.email}</span>
          <input
            required
            name="email"
            type="email"
            className="rounded-md border border-blue-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          {dict.login.magicLink}
        </button>
      </form>
    </section>
  );
}
