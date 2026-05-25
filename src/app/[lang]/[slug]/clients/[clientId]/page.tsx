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
        <a href={`/${slug}/clients`} className="link-accent text-sm">
          ← {dict.clients.title}
        </a>
        <h1 className="page-title">{client.name}</h1>
        {client.tax_id ? (
          <p className="text-sm text-muted">
            {dict.clients.companyNumber}: {client.tax_id}
          </p>
        ) : null}
        <p className="text-muted">{dict.actions.marketplace.description}</p>
      </header>

      {availableActions.length === 0 ? (
        <p className="rounded-md border border-border bg-accent-soft/30 px-4 py-6 text-center text-sm text-muted">
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
                  className="action-card"
                >
                  <span className="text-4xl leading-none">{action.icon}</span>
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-foreground">{actionDict.title}</p>
                    <p className="text-sm text-muted">{actionDict.description}</p>
                  </div>
                  <span className="mt-auto inline-block btn-primary px-3 py-1.5 text-center">
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
