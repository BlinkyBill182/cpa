import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n/get-dictionary";
import { getActionsForTenant } from "@/lib/actions/registry";
import { requireTenantAccessBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signUploadToken } from "@/lib/upload-token";

type ClientDetailPageProps = {
  params: Promise<{ lang: string; slug: string; clientId: string }>;
};

const ACCOUNTING_STATUS_LABEL: Record<string, string> = {
  in_progress: "בעבודה",
  ready_missing: "מוכן – חוסרים",
  ready_for_review: "מוכן לביקורת",
  issue: "בעיה",
  skip: "לא עושים",
};

const REPORT_STATUS_LABEL: Record<string, string> = {
  ready_missing: "חוסרים",
  missing_completed: "חוסרים הושלמו",
  ready_for_check: "מוכן לבדיקה",
  issue: "בעיה",
  ready_for_signature: "מוכן לחתימה",
  submitted: "הוגש",
};

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { lang, slug, clientId } = await params;
  const dict = await getDictionary(lang);
  const { tenant } = await requireTenantAccessBySlug(lang, slug);

  const supabase = await createSupabaseServerClient();

  const [{ data: client }, { data: configs }, { data: clientYears }] = await Promise.all([
    supabase
      .from("office_clients")
      .select("id, name, tax_id, email, phone, first_name, last_name")
      .eq("id", clientId)
      .eq("tenant_id", tenant.id)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("office_action_configs")
      .select("action_key, is_enabled")
      .eq("tenant_id", tenant.id)
      .eq("is_enabled", true),
    supabase
      .from("client_years")
      .select("id, year, accounting_status, report_status")
      .eq("client_id", clientId)
      .eq("tenant_id", tenant.id)
      .order("year", { ascending: false })
      .limit(5),
  ]);

  if (!client) notFound();

  const enabledKeys = new Set((configs ?? []).map((c) => c.action_key));
  const availableActions = getActionsForTenant(slug).filter((a) =>
    enabledKeys.has(a.key),
  );

  const hasContact = client.email || client.phone || client.first_name || client.last_name;
  const years = clientYears ?? [];

  // Pre-sign a 90-day JWT upload token for each active year
  const yearsWithTokens = await Promise.all(
    years.map(async (cy) => ({
      ...cy,
      uploadToken: await signUploadToken(cy.id),
    })),
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
      </header>

      {hasContact ? (
        <div className="surface-card flex flex-wrap gap-6 p-4 text-sm">
          {(client.first_name || client.last_name) ? (
            <span className="text-foreground">
              {[client.first_name, client.last_name].filter(Boolean).join(" ")}
            </span>
          ) : null}
          {client.email ? (
            <a href={`mailto:${client.email}`} className="link-accent">
              {client.email}
            </a>
          ) : null}
          {client.phone ? (
            <a href={`tel:${client.phone}`} className="link-accent">
              {client.phone}
            </a>
          ) : null}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {dict.clients.activeProcesses}
        </h2>
        {years.length === 0 ? (
          <p className="text-sm text-muted">{dict.clients.noActiveProcesses}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {yearsWithTokens.map((cy) => (
              <li key={cy.id} className="surface-card flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="font-semibold text-foreground">{cy.year}</span>
                <span className="text-muted">|</span>
                <span className="text-muted">{dict.clients.bookkeepingStatus}:</span>
                <span className="text-foreground">
                  {ACCOUNTING_STATUS_LABEL[cy.accounting_status] ?? cy.accounting_status}
                </span>
                {cy.report_status ? (
                  <>
                    <span className="text-muted">|</span>
                    <span className="text-muted">{dict.clients.reportStatus}:</span>
                    <span className="text-foreground">
                      {REPORT_STATUS_LABEL[cy.report_status] ?? cy.report_status}
                    </span>
                  </>
                ) : null}
                <div className="ms-auto flex items-center gap-2">
                  <a
                    href={`/${slug}/clients/${clientId}/actions/annual-income-summary?year=${cy.year}`}
                    className="btn-secondary px-3 py-1 text-xs"
                  >
                    {dict.clients.viewProcess}
                  </a>
                  <a
                    href={`/upload/${cy.uploadToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary px-3 py-1 text-xs"
                  >
                    {dict.clients.uploadPortalLink} ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {dict.actions.marketplace.description}
        </h2>
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
    </section>
  );
}
