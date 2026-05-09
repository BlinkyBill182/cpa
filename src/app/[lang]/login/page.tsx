import { LoginForm } from "@/components/auth/login-form";
import { getDictionary } from "@/i18n/get-dictionary";

import { signInAction } from "./actions";

type LoginPageProps = PageProps<"/[lang]/login"> & {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { lang } = await params;
  const currentSearchParams = await searchParams;
  const dict = await getDictionary(lang);

  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="text-3xl font-semibold">{dict.login.title}</h1>
      <p className="text-zinc-700">{dict.login.description}</p>
      {currentSearchParams.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.login.error}
        </p>
      ) : null}
      <LoginForm
        emailLabel={dict.login.email}
        passwordLabel={dict.login.password}
        submitLabel={dict.login.submit}
        action={signInAction.bind(null, lang)}
      />
    </section>
  );
}
