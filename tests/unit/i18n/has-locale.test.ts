import { describe, expect, it } from "vitest";
import { defaultLocale, hasLocale, locales } from "@/i18n/config";

describe("hasLocale", () => {
  it("returns true for every supported locale", () => {
    for (const locale of locales) {
      expect(hasLocale(locale)).toBe(true);
    }
  });

  it("returns false for unsupported locales", () => {
    expect(hasLocale("fr")).toBe(false);
    expect(hasLocale("de")).toBe(false);
    expect(hasLocale("")).toBe(false);
  });

  it("is case-sensitive — uppercase locale is rejected", () => {
    expect(hasLocale("EN")).toBe(false);
    expect(hasLocale("HE")).toBe(false);
  });

  it("default locale passes the check", () => {
    expect(hasLocale(defaultLocale)).toBe(true);
  });
});

describe("locales array", () => {
  it("contains at least two locales", () => {
    expect(locales.length).toBeGreaterThanOrEqual(2);
  });

  it("contains en and he", () => {
    expect(locales).toContain("en");
    expect(locales).toContain("he");
  });
});
