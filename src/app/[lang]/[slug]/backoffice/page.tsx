import Link from "next/link";

import { getDictionary } from "@/i18n/get-dictionary";
import { requireTenantAccessBySlug } from "@/lib/auth/session";

type TenantBackofficePageProps = {
  params: Promise<{ lang: string; slug: string }>;
};

export default async function TenantBackofficePage({ params }: TenantBackofficePageProps) {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang);
  const { tenant, role } = await requireTenantAccessBySlug(lang, slug);

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{tenant.name}</h1>
        <p className="text-zinc-700">{dict.tenantBackoffice.description}</p>
        <p className="text-sm text-zinc-500">
          {dict.tenantBackoffice.role}: <span className="font-medium">{role}</span>
        </p>
      </header>

      <nav className="flex gap-3">
        <Link
          href={`/${lang}/${slug}/backoffice/team`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {dict.tenantBackoffice.teamLink}
        </Link>
      </nav>
    </section>
  );
}
