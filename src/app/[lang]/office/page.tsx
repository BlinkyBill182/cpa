import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { setActiveTenantAction } from "./actions";

type OfficePageProps = PageProps<"/[lang]/office"> & {
  searchParams: Promise<{ error?: string }>;
};

export default async function OfficePage({ params, searchParams }: OfficePageProps) {
  const { lang } = await params;
  const { error } = await searchParams;
  const dict = await getDictionary(lang);
  const user = await requireUser(lang);

  const supabase = await createSupabaseServerClient();

  const { data: membershipRows } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", user.id);

  const tenantIds = (membershipRows ?? []).map((m) => m.tenant_id);

  const { data: tenants } =
    tenantIds.length > 0
      ? await supabase.from("tenants").select("id, name").in("id", tenantIds).order("name")
      : { data: [] };

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{dict.office.title}</h1>
        <p className="text-zinc-700">{dict.office.description}</p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.office.error}
        </p>
      ) : null}

      <form action={setActiveTenantAction.bind(null, lang)} className="flex max-w-sm flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.office.selectTenant}</span>
          <select
            name="tenantId"
            required
            className="rounded-md border border-zinc-300 px-3 py-2"
            defaultValue=""
          >
            <option value="" disabled>
              {dict.office.selectTenantPlaceholder}
            </option>
            {(tenants ?? []).map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50"
          >
            {dict.office.continue}
          </button>
        </div>
      </form>
    </section>
  );
}
