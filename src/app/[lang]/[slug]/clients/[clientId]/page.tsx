import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n/get-dictionary";
import { getActionsForTenant } from "@/lib/actions/registry";
import { requireTenantAccessBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClientDetailPageProps = {
  params: Promise<{ lang: string; slug: string; clientId: string }>;
};

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { lang, slug, clientId } = await params;
  const dict = await getDictionary(lang);
  const { tenant } = await requireTenantAccessBySlug(lang, slug);

  const supabase = await createSupabaseServerClient();

  const [{ data: client }, { data: configs }] = await Promise.all([
    supabase
      .from("office_clients")
      .select("id, name, tax_id")
      .eq("id", clientId)
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("office_action_configs")
      .select("action_key, is_enabled")
      .eq("tenant_id", tenant.id)
      .eq("is_enabled", true),
  ]);

  if (!client) notFound();

  const enabledKeys = new Set((configs ?? []).map((c) => c.action_key));
  const availableActions = getActionsForTenant(slug).filter((a) =>
    enabledKeys.has(a.key),
  );

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <a href={`/${slug}/clients`} className="text-sm text-blue-600 hover:underline">
          ← {dict.clients.title}
        </a>
        <h1 className="text-3xl font-semibold text-blue-900">{client.name}</h1>
        {client.tax_id ? (
          <p className="text-sm text-slate-500">
            {dict.clients.companyNumber}: {client.tax_id}
          </p>
        ) : null}
        <p className="text-slate-700">{dict.actions.marketplace.description}</p>
      </header>

      {availableActions.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          {dict.actions.marketplace.empty}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableActions.map((action) => {
            const actionDict = dict.actions[action.dictNamespace];
            return (
              <li key={action.key}>
                <a
                  href={`/${slug}/clients/${clientId}/actions/${action.key}`}
                  className="flex h-full flex-col gap-3 rounded-xl border border-blue-100 p-5 shadow-sm transition-shadow hover:shadow-md hover:border-blue-300"
                >
                  <span className="text-4xl leading-none">{action.icon}</span>
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-blue-900">{actionDict.title}</p>
                    <p className="text-sm text-slate-500">{actionDict.description}</p>
                  </div>
                  <span className="mt-auto inline-block rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white text-center">
                    {dict.actions.marketplace.run}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
