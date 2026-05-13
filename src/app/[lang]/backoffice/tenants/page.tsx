import { getDictionary } from "@/i18n/get-dictionary";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createTenantAction } from "./actions";

type BackofficeTenantsPageProps = {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function BackofficeTenantsPage({ params, searchParams }: BackofficeTenantsPageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const { error } = await searchParams;
  await requirePlatformOwner(lang);

  const supabase = await createSupabaseServerClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-blue-900">{dict.ownerTenants.title}</h1>
        <p className="text-slate-700">{dict.ownerTenants.description}</p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.ownerTenants.error}
        </p>
      ) : null}

      <form action={createTenantAction.bind(null, lang)} className="grid max-w-2xl gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.ownerTenants.name}</span>
          <input
            required
            name="name"
            className="rounded-md border border-blue-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            minLength={2}
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <label className="flex flex-col gap-1">
            <span>{dict.ownerTenants.slug}</span>
            <input
              required
              name="slug"
              className="rounded-md border border-blue-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              pattern="^[a-z0-9-]+$"
            />
          </label>
          <span className="text-xs text-slate-500">{dict.ownerTenants.slugHint}</span>
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {dict.ownerTenants.submit}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        {(tenants ?? []).length === 0 ? (
          <p className="text-slate-700">{dict.ownerTenants.empty}</p>
        ) : null}
        {(tenants ?? []).map((tenant) => (
          <article
            key={tenant.id}
            className="flex items-center justify-between rounded-md border border-blue-100 px-4 py-3"
          >
            <div>
              <h2 className="font-medium">{tenant.name}</h2>
              <p className="text-sm text-slate-600">{tenant.slug}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`/backoffice/tenants/${tenant.id}/members`}
                className="rounded-md border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {dict.ownerTenants.manageMembers}
              </a>
              <a
                href={`/backoffice/tenants/${tenant.id}/actions`}
                className="rounded-md border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {dict.ownerTenants.manageActions}
              </a>
              <a
                href={`/${tenant.slug}/backoffice`}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                {dict.ownerTenants.openBackoffice}
              </a>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
