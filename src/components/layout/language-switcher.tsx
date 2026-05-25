"use client";

import { usePathname, useRouter } from "next/navigation";

import { locales, type Locale } from "@/i18n/config";

const localeLabels: Record<Locale, string> = {
  en: "English",
  he: "עברית",
};

export const LanguageSwitcher = ({ currentLocale }: { currentLocale: string }) => {
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (newLocale: Locale) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {locales.map((locale, i) => (
        <span key={locale} className="flex items-center gap-2">
          {i > 0 && <span className="text-border">|</span>}
          <button
            onClick={() => switchLocale(locale)}
            className={
              locale === currentLocale
                ? "font-semibold text-foreground"
                : "text-accent hover:text-accent"
            }
          >
            {localeLabels[locale]}
          </button>
        </span>
      ))}
    </div>
  );
};
