import { LoginForm } from "@/components/auth/login-form";
import { getDictionary } from "@/i18n/get-dictionary";

import { sendMagicLinkAction, signInAction } from "./actions";

type LoginPageProps = PageProps<"/[lang]/login"> & {
  searchParams: Promise<{ error?: string; otp?: string }>;
};

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { lang } = await params;
  const currentSearchParams = await searchParams;
  const dict = await getDictionary(lang);

  return (
    <section className="flex w-full max-w-sm flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="page-title">{dict.login.title}</h1>
        <p className="text-muted">{dict.login.description}</p>
      </header>

      {currentSearchParams.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.login.error}
        </p>
      ) : null}

      {currentSearchParams.otp === "sent" ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {dict.login.otpSent}
        </p>
      ) : null}

      <LoginForm
        emailLabel={dict.login.email}
        passwordLabel={dict.login.password}
        submitLabel={dict.login.submit}
        action={signInAction.bind(null, lang)}
      />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">{dict.login.orLabel}</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={sendMagicLinkAction.bind(null, lang)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.login.email}</span>
          <input
            required
            name="email"
            type="email"
            className="input-field"
          />
        </label>
        <button
          type="submit"
          className="btn-secondary"
        >
          {dict.login.magicLink}
        </button>
      </form>
    </section>
  );
}
