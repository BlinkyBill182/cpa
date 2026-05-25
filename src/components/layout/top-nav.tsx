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
  backButton: ReactNode;
};

export const TopNav = ({ isOwner, isLoggedIn, signOut, labels, darkModeToggle, backButton }: TopNavProps) => {
  return (
    <header className="border-b border-border bg-surface">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link className="font-semibold text-brand" href="/">
            {labels.home}
          </Link>
          {backButton}
        </div>
        <div className="flex items-center gap-4 text-sm">
          {isOwner ? (
            <Link href="/backoffice/tenants" className="text-accent hover:text-foreground">
              {labels.backoffice}
            </Link>
          ) : null}
          {isLoggedIn ? (
            <form action={signOut}>
              <button type="submit" className="cursor-pointer text-accent hover:text-foreground">
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
