import { getDictionary } from "@/i18n/get-dictionary";
import { requireUser } from "@/lib/auth/session";
import { getActiveTenant } from "@/lib/auth/tenant-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { setActiveTenantAction } from "./actions";

type OfficePageProps = PageProps<"/[lang]/office"> & {
  searchParams: Promise<{ error?: string }>;
};

export default async function OfficePage({ params, searchParams }: OfficePageProps) {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const currentSearchParams = await searchParams;
  const user = await requireUser(lang);
  const supabase = await createSupabaseServerClient();
  const activeTenantId = await getActiveTenant();
  const { data: memberships } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, tenants(name, slug)")
    .eq("user_id", user.id);

  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="text-3xl font-semibold">{dict.office.title}</h1>
      <p className="text-zinc-700">{dict.office.description}</p>
      {currentSearchParams.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.office.error}
        </p>
      ) : null}
      <form action={setActiveTenantAction.bind(null, lang)} className="flex max-w-xl flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.office.selectTenant}</span>
          <select
            name="tenantId"
            className="rounded-md border border-zinc-300 px-3 py-2"
            defaultValue={activeTenantId ?? ""}
          >
            <option value="" disabled>
              {dict.office.selectTenantPlaceholder}
            </option>
            {(memberships ?? []).map((membership) => (
              <option key={membership.tenant_id} value={membership.tenant_id}>
                {(membership.tenants as { name?: string } | null)?.name ?? membership.tenant_id} ({membership.role})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm text-zinc-50">
          {dict.office.continue}
        </button>
      </form>
    </section>
  );
}
