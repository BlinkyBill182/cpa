import { notFound } from "next/navigation";

import { TopNav } from "@/components/layout/top-nav";
import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

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

  return (
    <>
      <TopNav locale={lang} labels={dict.nav} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
