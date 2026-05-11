import { notFound } from "next/navigation";

import { HtmlDirSync } from "@/components/layout/html-dir-sync";
import { TopNav } from "@/components/layout/top-nav";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { signOutAction } from "@/app/[lang]/login/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;

  if (!hasLocale(lang)) {
    notFound();
  }

  const dict = await getDictionary(lang);

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isOwner = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("is_platform_owner")
      .eq("id", user.id)
      .single();
    isOwner = data?.is_platform_owner ?? false;
  }

  return (
    <>
      <HtmlDirSync locale={lang} />
      <TopNav
        locale={lang}
        isOwner={isOwner}
        isLoggedIn={!!user}
        signOut={signOutAction.bind(null, lang)}
        labels={dict.nav}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
