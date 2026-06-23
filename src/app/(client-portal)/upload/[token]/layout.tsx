import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "העלאת מסמכים",
  description: "פורטל העלאת מסמכים ללקוחות משרד רואי חשבון",
};

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f8f9fb]">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">📁 העלאת מסמכים</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            לקוח
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-0 px-4 pb-20 pt-6">
        {children}
      </main>
      <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/90 px-4 py-3 text-center backdrop-blur-sm">
        <p className="text-xs text-gray-400">
          מערכת מאובטחת לניהול מסמכים · CPA Platform
        </p>
      </footer>
    </div>
  );
}
