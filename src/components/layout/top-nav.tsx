import Link from "next/link";
import type { ReactNode } from "react";

type TopNavProps = {
  isOwner: boolean;
  isLoggedIn: boolean;
  signOut: () => Promise<void>;
  labels: {
    home: string;
    logout: string;
    backoffice: string;
  };
  darkModeToggle: ReactNode;
};

export const TopNav = ({ isOwner, isLoggedIn, signOut, labels, darkModeToggle }: TopNavProps) => {
  return (
    <header className="border-b border-blue-100 dark:border-slate-700 dark:bg-slate-900">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link className="font-semibold text-blue-900 dark:text-blue-300" href="/">
          {labels.home}
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {isOwner ? (
            <Link href="/backoffice/tenants" className="text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200">
              {labels.backoffice}
            </Link>
          ) : null}
          {isLoggedIn ? (
            <form action={signOut}>
              <button type="submit" className="cursor-pointer text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200">
                {labels.logout}
              </button>
            </form>
          ) : null}
          {darkModeToggle}
        </div>
      </nav>
    </header>
  );
};
