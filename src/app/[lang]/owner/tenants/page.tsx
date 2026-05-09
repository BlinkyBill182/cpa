import Link from "next/link";

import { getDictionary } from "@/i18n/get-dictionary";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createTenantAction } from "./actions";

type OwnerTenantsPageProps = PageProps<"/[lang]/owner/tenants"> & {
  searchParams: Promise<{ error?: string }>;
};

export default async function OwnerTenantsPage({ params, searchParams }: OwnerTenantsPageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const currentSearchParams = await searchParams;
  await requirePlatformOwner(lang);

  const supabase = await createSupabaseServerClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{dict.ownerTenants.title}</h1>
        <p className="text-zinc-700">{dict.ownerTenants.description}</p>
      </header>

      {currentSearchParams.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.login.error}
        </p>
      ) : null}

      <form action={createTenantAction.bind(null, lang)} className="grid max-w-2xl gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.ownerTenants.name}</span>
          <input
            required
            name="name"
            className="rounded-md border border-zinc-300 px-3 py-2"
            minLength={2}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.ownerTenants.slug}</span>
          <input
            required
            name="slug"
            className="rounded-md border border-zinc-300 px-3 py-2"
            pattern="^[a-z0-9-]+$"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50"
          >
            {dict.ownerTenants.submit}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        {(tenants ?? []).length === 0 ? <p className="text-zinc-700">{dict.ownerTenants.empty}</p> : null}
        {(tenants ?? []).map((tenant) => (
          <article key={tenant.id} className="rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="font-medium">{tenant.name}</h2>
            <p className="text-sm text-zinc-600">{tenant.slug}</p>
            <Link
              href={`/${lang}/owner/tenants/${tenant.id}/members`}
              className="mt-2 inline-block text-sm font-medium text-zinc-900 underline"
            >
              {dict.ownerTenants.manageMembers}
            </Link>
          </article>
        ))}
      </section>
    </section>
  );
}
