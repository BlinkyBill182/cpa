import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CPA Platform",
  description: "Multi-tenant SaaS platform for CPA offices",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const locale = headersList.get("x-locale") ?? "he";
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${rubik.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {/* Runs before React hydration to prevent flash of wrong theme.
            next/script with beforeInteractive always injects into <head>. */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
