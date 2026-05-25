import Link from "next/link";

import { getDictionary } from "@/i18n/get-dictionary";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HomePageProps = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const { lang } = await params;
  const { error } = await searchParams;
  const dict = await getDictionary(lang);
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <section className="flex flex-col gap-6">
        <h1 className="page-title">{dict.home.title}</h1>
        <p className="text-muted">{dict.home.description}</p>
        <Link
          href="/login"
          className="w-fit btn-primary px-5 py-2.5"
        >
          {dict.nav.login}
        </Link>
      </section>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_owner")
    .eq("id", user.id)
    .single();

  const isOwner = profile?.is_platform_owner ?? false;

  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("role, tenants(name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  type MembershipRow = { role: string; tenants: { name: string; slug: string } | null };
  const offices = (memberships as MembershipRow[] | null ?? []).filter((m) => m.tenants !== null);

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="page-title">{dict.home.title}</h1>
        <p className="text-muted">{dict.home.description}</p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.login.error}
        </p>
      ) : null}

      {isOwner ? (
        <div className="flex flex-col gap-3">
          <Link
            href="/backoffice/tenants"
            className="w-fit btn-primary px-5 py-2.5"
          >
            {dict.home.ownerAction}
          </Link>
        </div>
      ) : null}

      {offices.length > 0 ? (
        <div className="flex flex-col gap-3">
          {offices.map((m) => (
            <Link
              key={m.tenants!.slug}
              href={`/${m.tenants!.slug}/clients`}
              className="btn-secondary w-fit gap-2 px-5 py-2.5"
            >
              {m.tenants!.name}
            </Link>
          ))}
        </div>
      ) : !isOwner ? (
        <p className="text-muted">{dict.home.noOffices}</p>
      ) : null}
    </section>
  );
}
