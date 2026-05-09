import "server-only";

import { notFound } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { hasLocale } from "@/i18n/config";

type Dictionary = typeof import("@/i18n/dictionaries/en.json");

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  en: () => import("@/i18n/dictionaries/en.json").then((module) => module.default),
  he: () => import("@/i18n/dictionaries/he.json").then((module) => module.default),
};

export const getDictionary = async (locale: string) => {
  if (!hasLocale(locale)) {
    notFound();
  }

  return dictionaries[locale]();
};
