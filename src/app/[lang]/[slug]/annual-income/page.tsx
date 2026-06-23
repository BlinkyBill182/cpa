import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n/get-dictionary";
import { requireTenantAccessBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ year?: string }>;
};

const ACCOUNTING_STATUS_COLOR: Record<string, string> = {
  in_progress: "bg-accent-soft text-accent-soft-foreground",
  ready_missing: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  ready_for_review: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  issue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  skip: "bg-surface text-muted border border-border",
};

const REPORT_STATUS_COLOR: Record<string, string> = {
  ready_missing: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  missing_completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ready_for_check: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  issue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  ready_for_signature: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  submitted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

export default async function AnnualIncomeDashboardPage({ params, searchParams }: Props) {
  const { lang, slug } = await params;
  const { year: yearParam } = await searchParams;

  const dict = await getDictionary(lang);
  const d = dict.actions.annualIncomeSummary;
  const { tenant, role } = await requireTenantAccessBySlug(lang, slug);

  const supabase = await createSupabaseServerClient();

  // Action must be enabled for this tenant
  const { data: config } = await supabase
    .from("office_action_configs")
    .select("is_enabled")
    .eq("tenant_id", tenant.id)
    .eq("action_key", "annual-income-summary")
    .maybeSingle();

  if (!config?.is_enabled) notFound();

  const currentCalendarYear = new Date().getFullYear();
  const selectedYear = yearParam
    ? Math.max(2000, Math.min(2100, parseInt(yearParam, 10)))
    : currentCalendarYear - 1;
  const yearTabs = [currentCalendarYear - 2, currentCalendarYear - 1, currentCalendarYear];

  const isManager = role === "manager" || role === "tenant_admin";

  // Fetch all active clients
  const { data: clients } = await supabase
    .from("office_clients")
    .select("id, name, tax_id")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name");

  const activeClients = clients ?? [];

  // Auto-create client_years for all active clients (managers only)
  if (isManager && activeClients.length > 0) {
    const inserts = activeClients.map((c) => ({
      tenant_id: tenant.id,
      client_id: c.id,
      year: selectedYear,
    }));
    await supabase
      .from("client_years")
      .upsert(inserts, { onConflict: "tenant_id,client_id,year", ignoreDuplicates: true });
  }

  // Fetch all client_years for the selected year
  const { data: clientYears } = await supabase
    .from("client_years")
    .select("id, client_id, accounting_status, report_status")
    .eq("tenant_id", tenant.id)
    .eq("year", selectedYear);

  // Fetch document counts per client_year
  const yearIds = (clientYears ?? []).map((cy) => cy.id);
  const { data: docCounts } =
    yearIds.length > 0
      ? await supabase
          .from("client_year_documents")
          .select("client_year_id")
          .in("client_year_id", yearIds)
      : { data: [] };

  // Fetch uploaded file counts per client_year
  const docIds = (docCounts ?? []).map((d) => d.client_year_id);
  const { data: uploadCounts } =
    docIds.length > 0
      ? await supabase
          .from("uploaded_files")
          .select("client_year_document_id")
          .in("client_year_document_id", docIds)
      : { data: [] };

  // Build lookup maps
  const yearByClient = new Map((clientYears ?? []).map((cy) => [cy.client_id, cy]));
  const docCountByYear = new Map<string, number>();
  for (const d of docCounts ?? []) {
    docCountByYear.set(d.client_year_id, (docCountByYear.get(d.client_year_id) ?? 0) + 1);
  }

  const accountingLabel = (s: string) => {
    const map: Record<string, string> = {
      in_progress: d.accounting.inProgress,
      ready_missing: d.accounting.readyMissing,
      ready_for_review: d.accounting.readyForReview,
      issue: d.accounting.issue,
      skip: d.accounting.skip,
    };
    return map[s] ?? s;
  };

  const reportLabel = (s: string | null) => {
    if (!s) return d.report.notStarted;
    const map: Record<string, string> = {
      ready_missing: d.report.readyMissing,
      missing_completed: d.report.missingCompleted,
      ready_for_check: d.report.readyForCheck,
      issue: d.report.issue,
      ready_for_signature: d.report.readyForSignature,
      submitted: d.report.submitted,
    };
    return map[s] ?? s;
  };

  return (
    <section className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="page-title">{d.dashboardTitle}</h1>
        <p className="text-sm text-muted">{d.dashboardDescription}</p>
      </header>

      {/* Year tabs */}
      <nav className="flex gap-2" aria-label={d.yearLabel}>
        {yearTabs.map((y) => (
          <a
            key={y}
            href={`/${slug}/annual-income?year=${y}`}
            className={
              y === selectedYear
                ? "rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground"
                : "btn-secondary text-sm"
            }
          >
            {y}
          </a>
        ))}
      </nav>

      {activeClients.length === 0 ? (
        <p className="text-muted">{dict.clients.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left">
                <th className="px-4 py-3 font-semibold text-foreground">{d.clientColumn}</th>
                <th className="px-4 py-3 font-semibold text-foreground">{d.bookkeepingColumn}</th>
                <th className="px-4 py-3 font-semibold text-foreground">{d.reportColumn}</th>
                <th className="px-4 py-3 font-semibold text-foreground text-center">{d.docsColumn}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeClients.map((client) => {
                const cy = yearByClient.get(client.id);
                const docCount = cy ? (docCountByYear.get(cy.id) ?? 0) : 0;
                const detailUrl = `/${lang}/${slug}/clients/${client.id}/actions/annual-income-summary?year=${selectedYear}`;

                return (
                  <tr key={client.id} className="bg-surface hover:bg-surface-muted transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{client.name}</p>
                      {client.tax_id && (
                        <p className="text-xs text-muted">{client.tax_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cy ? (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCOUNTING_STATUS_COLOR[cy.accounting_status] ?? "bg-surface text-muted"}`}
                        >
                          {accountingLabel(cy.accounting_status)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {cy?.report_status ? (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${REPORT_STATUS_COLOR[cy.report_status] ?? "bg-surface text-muted"}`}
                        >
                          {reportLabel(cy.report_status)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">{d.report.notStarted}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-medium text-foreground">{docCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href={detailUrl} className="btn-secondary px-3 py-1 text-xs">
                        {d.openButton}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
