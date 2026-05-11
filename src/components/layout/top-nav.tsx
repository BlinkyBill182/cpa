import Link from "next/link";

import { LanguageSwitcher } from "./language-switcher";

type TopNavProps = {
  locale: string;
  isOwner: boolean;
  isLoggedIn: boolean;
  signOut: () => Promise<void>;
  labels: {
    home: string;
    logout: string;
    backoffice: string;
  };
};

export const TopNav = ({ locale, isOwner, isLoggedIn, signOut, labels }: TopNavProps) => {
  return (
    <header className="border-b border-blue-100">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link className="font-semibold text-blue-900" href={`/${locale}`}>
          {labels.home}
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <LanguageSwitcher currentLocale={locale} />
          {isOwner ? (
            <Link href={`/${locale}/backoffice/tenants`} className="text-blue-700 hover:text-blue-900">
              {labels.backoffice}
            </Link>
          ) : null}
          {isLoggedIn ? (
            <form action={signOut}>
              <button type="submit" className="cursor-pointer text-blue-700 hover:text-blue-900">
                {labels.logout}
              </button>
            </form>
          ) : null}
        </div>
      </nav>
    </header>
  );
};
