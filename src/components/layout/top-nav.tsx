import Link from "next/link";

type TopNavProps = {
  locale: string;
  isOwner: boolean;
  labels: {
    home: string;
    login: string;
    ownerTenants: string;
    office: string;
  };
};

export const TopNav = ({ locale, isOwner, labels }: TopNavProps) => {
  return (
    <header className="border-b border-zinc-200">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link className="font-semibold" href={`/${locale}`}>
          {labels.home}
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {isOwner ? <Link href={`/${locale}/owner/tenants`}>{labels.ownerTenants}</Link> : null}
          <Link href={`/${locale}/office`}>{labels.office}</Link>
          <Link href={`/${locale}/login`}>{labels.login}</Link>
        </div>
      </nav>
    </header>
  );
};
