import Link from "next/link";

import { getDictionary } from "@/i18n/get-dictionary";
import { requireTenantAdminBySlug } from "@/lib/auth/session";

type TenantBackofficePageProps = {
  params: Promise<{ lang: string; slug: string }>;
};

export default async function TenantBackofficePage({ params }: TenantBackofficePageProps) {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang);
  const { tenant, role } = await requireTenantAdminBySlug(lang, slug);

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="page-title">{tenant.name}</h1>
        <p className="text-muted">{dict.tenantBackoffice.description}</p>
        <p className="text-sm text-muted">
          {dict.tenantBackoffice.role}: <span className="font-medium">{role}</span>
        </p>
      </header>

      <nav className="flex flex-wrap gap-3">
        <Link
          href={`/${slug}/clients`}
          className="btn-secondary"
        >
          {dict.tenantBackoffice.viewClientList}
        </Link>
        <Link
          href={`/${slug}/backoffice/clients`}
          className="btn-primary"
        >
          {dict.tenantBackoffice.manageClients}
        </Link>
        <Link
          href={`/${slug}/backoffice/team`}
          className="btn-secondary"
        >
          {dict.tenantBackoffice.teamLink}
        </Link>
        <Link
          href={`/${slug}/backoffice/document-types`}
          className="btn-secondary"
        >
          {dict.tenantBackoffice.documentTypesLink}
        </Link>
        <Link
          href={`/${slug}/annual-income`}
          className="btn-primary"
        >
          {dict.tenantBackoffice.annualIncomeLink}
        </Link>
      </nav>
    </section>
  );
}
