export const locales = ["en", "he"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

export const localePrefix = "always";

export const hasLocale = (value: string): value is Locale => {
  return locales.includes(value as Locale);
};
