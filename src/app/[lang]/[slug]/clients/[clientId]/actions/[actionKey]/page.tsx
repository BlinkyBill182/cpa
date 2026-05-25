import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n/get-dictionary";
import { getAction } from "@/lib/actions/registry";
import { requireTenantAccessBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActionExecutionPageProps = {
  params: Promise<{ lang: string; slug: string; clientId: string; actionKey: string }>;
};

export default async function ActionExecutionPage({ params }: ActionExecutionPageProps) {
  const { lang, slug, clientId, actionKey } = await params;
  const dict = await getDictionary(lang);
  const { tenant } = await requireTenantAccessBySlug(lang, slug);

  const action = getAction(actionKey);
  if (!action) notFound();

  const supabase = await createSupabaseServerClient();

  const [{ data: client }, { data: config }] = await Promise.all([
    supabase
      .from("office_clients")
      .select("id, name, tax_id")
      .eq("id", clientId)
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("office_action_configs")
      .select("is_enabled")
      .eq("tenant_id", tenant.id)
      .eq("action_key", actionKey)
      .single(),
  ]);

  if (!client || !config?.is_enabled) notFound();

  const actionDict = dict.actions[action.dictNamespace];

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <a
          href={`/${slug}/clients/${clientId}`}
          className="link-accent text-sm"
        >
          ← {dict.actions.marketplace.backToActions}
        </a>
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none">{action.icon}</span>
          <div>
            <h1 className="page-title">{actionDict.title}</h1>
            <p className="text-sm text-muted">{client.name}</p>
          </div>
        </div>
        <p className="text-muted">{actionDict.description}</p>
      </header>

      <div className="rounded-xl border border-dashed border-border bg-accent-soft/40 px-6 py-10 text-center">
        <p className="text-lg font-medium text-accent">{dict.actions.marketplace.comingSoon}</p>
        <p className="mt-1 text-sm text-muted">{action.key}</p>
      </div>

      <div>
        <a
          href={`/${slug}/clients/${clientId}`}
          className="btn-secondary"
        >
          {dict.actions.marketplace.backToClient}
        </a>
      </div>
    </section>
  );
}
