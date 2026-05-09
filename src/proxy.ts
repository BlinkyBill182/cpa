import { NextRequest, NextResponse } from "next/server";

import { defaultLocale, locales } from "@/i18n/config";

const PUBLIC_FILE = /\.(.*)$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const pathnameHasLocale = locales.some((locale) => {
    return pathname === `/${locale}` || pathname.startsWith(`/${locale}/`);
  });

  if (!pathnameHasLocale) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(nextUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
