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
        <h1 className="text-3xl font-semibold text-blue-900">{dict.home.title}</h1>
        <p className="text-slate-700">{dict.home.description}</p>
        <Link
          href={`/${lang}/login`}
          className="w-fit rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
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
        <h1 className="text-3xl font-semibold text-blue-900">{dict.home.title}</h1>
        <p className="text-slate-700">{dict.home.description}</p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.login.error}
        </p>
      ) : null}

      {isOwner ? (
        <div className="flex flex-col gap-3">
          <Link
            href={`/${lang}/backoffice/tenants`}
            className="w-fit rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
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
              href={`/${lang}/${m.tenants!.slug}/backoffice`}
              className="flex w-fit items-center gap-2 rounded-md border border-blue-200 px-5 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
            >
              {m.tenants!.name}
            </Link>
          ))}
        </div>
      ) : !isOwner ? (
        <p className="text-slate-500">{dict.home.noOffices}</p>
      ) : null}
    </section>
  );
}
