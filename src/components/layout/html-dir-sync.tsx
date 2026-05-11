"use client";

import { useEffect } from "react";

export const HtmlDirSync = ({ locale }: { locale: string }) => {
  useEffect(() => {
    const dir = locale === "he" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
};
