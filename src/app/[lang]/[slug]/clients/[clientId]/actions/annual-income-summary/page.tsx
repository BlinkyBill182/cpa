import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n/get-dictionary";
import { requireTenantAccessBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  addCustomDocumentAction,
  addDocumentFromTypeAction,
  assignContractorAction,
  createClientYearAction,
  removeDocumentAction,
  revalidatePendingFileAction,
  updateAccountingStatusAction,
  updateReportStatusAction,
} from "./actions";
import { RecheckForm } from "./RecheckButton";

type Props = {
  params: Promise<{ lang: string; slug: string; clientId: string }>;
  searchParams: Promise<{ year?: string; error?: string }>;
};

const ACCOUNTING_STATUS_ORDER = [
  "in_progress",
  "ready_missing",
  "ready_for_review",
  "issue",
  "skip",
] as const;

const REPORT_STATUS_ORDER = [
  "ready_missing",
  "missing_completed",
  "ready_for_check",
  "issue",
  "ready_for_signature",
  "submitted",
] as const;

export default async function AnnualIncomeSummaryPage({ params, searchParams }: Props) {
  const { lang, slug, clientId } = await params;
  const { year: yearParam, error } = await searchParams;

  const dict = await getDictionary(lang);
  const { user, tenant, role } = await requireTenantAccessBySlug(lang, slug);
  const d = dict.actions.annualIncomeSummary;

  const supabase = await createSupabaseServerClient();

  // Verify action is enabled and client exists
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
      .eq("action_key", "annual-income-summary")
      .single(),
  ]);

  if (!client || !config?.is_enabled) notFound();

  const currentCalendarYear = new Date().getFullYear();
  const selectedYear = yearParam ? Math.max(2000, Math.min(2100, parseInt(yearParam, 10))) : currentCalendarYear - 1;
  const yearTabs = [currentCalendarYear - 2, currentCalendarYear - 1, currentCalendarYear];

  // Fetch client_year, document type library, and contractor memberships in parallel
  const [{ data: clientYear }, { data: documentTypes }, { data: contractorMemberships }] =
    await Promise.all([
      supabase
        .from("client_years")
        .select(
          `id, year, accountant_id, contractor_id, accounting_status, report_status, issue_notes,
           client_year_documents (
             id, document_type_id, custom_name, free_text, is_required,
             client_marked_none, none_reason, sort_order
           )`,
        )
        .eq("tenant_id", tenant.id)
        .eq("client_id", clientId)
        .eq("year", selectedYear)
        .order("sort_order", { referencedTable: "client_year_documents" })
        .maybeSingle(),
      supabase
        .from("document_types")
        .select("id, name")
        .eq("tenant_id", tenant.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("role", "contractor"),
    ]);

  // Fetch contractor profiles separately to avoid nested-join type inference issues
  const contractorIds = (contractorMemberships ?? []).map((m) => m.user_id);
  const { data: contractorProfiles } =
    contractorIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", contractorIds)
      : { data: [] };

  const contractorMap = new Map((contractorProfiles ?? []).map((p) => [p.id, p.full_name]));

  // Build a name lookup from the document type library so docs can resolve their type name locally
  const docTypeNameMap = new Map((documentTypes ?? []).map((dt) => [dt.id, dt.name]));

  const docs = clientYear?.client_year_documents ?? [];

  // Fetch uploaded files for all documents in this year
  const docIds = docs.map((d) => d.id);
  const { data: uploadedFiles } =
    docIds.length > 0
      ? await supabase
          .from("uploaded_files")
          .select("id, client_year_document_id, original_filename, file_size_kb, ai_status, ai_notes, ai_result, drive_url")
          .in("client_year_document_id", docIds)
          .order("uploaded_at", { ascending: false })
      : { data: [] };

  const uploadsByDoc = new Map<string, NonNullable<typeof uploadedFiles>>();
  for (const f of uploadedFiles ?? []) {
    const list = uploadsByDoc.get(f.client_year_document_id) ?? [];
    list.push(f);
    uploadsByDoc.set(f.client_year_document_id, list);
  }

  const isAdmin = role === "tenant_admin";
  const isManager = role === "manager" || isAdmin;
  const isContractor = role === "contractor";
  const isAssignedContractor = isContractor && clientYear?.contractor_id === user.id;
  const canEditAccounting = isManager;
  const canEditReport = isAdmin || (isManager && true) || isAssignedContractor;
  // Managers can only set missing_completed; shown conditionally in the form
  const canManageDocuments = isManager || isAssignedContractor;

  const createYearBound = createClientYearAction.bind(null, lang, slug, clientId, selectedYear);
  const updateAccountingBound = updateAccountingStatusAction.bind(null, lang, slug);
  const updateReportBound = updateReportStatusAction.bind(null, lang, slug);
  const assignContractorBound = assignContractorAction.bind(null, lang, slug);
  const addFromTypeBound = addDocumentFromTypeAction.bind(null, lang, slug);
  const addCustomBound = addCustomDocumentAction.bind(null, lang, slug);
  const removeDocBound = removeDocumentAction.bind(null, lang, slug);
  const recheckFileBound = revalidatePendingFileAction.bind(null, lang, slug);

  const statusLabelAccounting = (s: string) => {
    const map: Record<string, string> = {
      in_progress: d.accounting.inProgress,
      ready_missing: d.accounting.readyMissing,
      ready_for_review: d.accounting.readyForReview,
      issue: d.accounting.issue,
      skip: d.accounting.skip,
    };
    return map[s] ?? s;
  };

  const statusLabelReport = (s: string | null) => {
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

  const statusBadgeClass = (s: string | null) => {
    if (!s || s === "in_progress") return "bg-accent-soft text-accent-soft-foreground";
    if (s === "ready_for_review" || s === "ready_for_check" || s === "missing_completed")
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (s === "ready_missing" || s === "issue")
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    if (s === "ready_for_signature")
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    if (s === "submitted")
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (s === "skip")
      return "bg-surface text-muted border border-border";
    return "bg-accent-soft text-accent-soft-foreground";
  };

  // Build allowed accounting_status options per current status + role
  const allowedAccountingStatuses = (() => {
    if (!canEditAccounting) return [];
    return ACCOUNTING_STATUS_ORDER.filter((s) => s !== clientYear?.accounting_status);
  })();

  // Build allowed report_status options per role
  const allowedReportStatuses = (() => {
    if (!canEditReport || !clientYear) return [];
    if (isAdmin) return REPORT_STATUS_ORDER.filter((s) => s !== clientYear.report_status);
    if (isManager)
      return clientYear.report_status === "ready_missing" ? ["missing_completed" as const] : [];
    if (isAssignedContractor)
      return REPORT_STATUS_ORDER.filter(
        (s) =>
          s !== clientYear.report_status &&
          s !== "ready_for_signature" &&
          s !== "submitted",
      );
    return [];
  })();

  return (
    <section className="flex w-full flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <a href={`/${slug}/clients/${clientId}`} className="link-accent text-sm">
          ← {dict.actions.marketplace.backToActions}
        </a>
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none">📊</span>
          <div>
            <h1 className="page-title">{d.title}</h1>
            <p className="text-sm text-muted">{client.name}</p>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {error === "create"
            ? d.errors.createFailed
            : error === "status"
              ? d.errors.statusFailed
              : error === "doc_add"
                ? d.errors.docAddFailed
                : d.errors.docRemoveFailed}
        </p>
      )}

      {/* Year tabs */}
      <nav className="flex gap-2" aria-label={d.yearLabel}>
        {yearTabs.map((y) => (
          <a
            key={y}
            href={`/${slug}/clients/${clientId}/actions/annual-income-summary?year=${y}`}
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

      {/* No record yet */}
      {!clientYear ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <p className="mb-4 text-muted">{d.noRecord}</p>
          {isManager && (
            <form action={createYearBound}>
              <button type="submit" className="btn-primary">
                {d.startProcess} {selectedYear}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* ── Status section ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Accounting status */}
            <div className="surface-card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{d.accounting.label}</p>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-medium ${statusBadgeClass(clientYear.accounting_status)}`}
                >
                  {statusLabelAccounting(clientYear.accounting_status)}
                </span>
              </div>
              <p className="text-sm text-muted">
                {d.accountant}:{" "}
                <span className="font-medium text-foreground">
                  {clientYear.accountant_id ? clientYear.accountant_id.slice(0, 8) + "…" : d.notAssigned}
                </span>
              </p>
              {canEditAccounting && allowedAccountingStatuses.length > 0 && (
                <form action={updateAccountingBound} className="flex flex-col gap-2">
                  <input type="hidden" name="client_year_id" value={clientYear.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="year" value={selectedYear} />
                  <select
                    name="accounting_status"
                    className="input-field text-sm"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      — {d.saveStatus} —
                    </option>
                    {allowedAccountingStatuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabelAccounting(s)}
                      </option>
                    ))}
                  </select>
                  {(clientYear.accounting_status === "issue" ||
                    allowedAccountingStatuses.includes("issue")) && (
                    <input
                      type="text"
                      name="issue_notes"
                      placeholder={d.issueNotes}
                      defaultValue={clientYear.issue_notes ?? ""}
                      className="input-field text-sm"
                    />
                  )}
                  <button type="submit" className="btn-primary text-sm">
                    {d.saveStatus}
                  </button>
                </form>
              )}
            </div>

            {/* Report status */}
            <div className="surface-card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{d.report.label}</p>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-medium ${statusBadgeClass(clientYear.report_status)}`}
                >
                  {statusLabelReport(clientYear.report_status)}
                </span>
              </div>
              <p className="text-sm text-muted">
                {d.contractor}:{" "}
                <span className="font-medium text-foreground">
                  {clientYear.contractor_id
                    ? contractorMap.get(clientYear.contractor_id) ?? clientYear.contractor_id.slice(0, 8) + "…"
                    : d.notAssigned}
                </span>
              </p>

              {/* Assign contractor — admin only */}
              {isAdmin && (
                <form action={assignContractorBound} className="flex flex-col gap-2">
                  <input type="hidden" name="client_year_id" value={clientYear.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="year" value={selectedYear} />
                  <select
                    name="contractor_id"
                    className="input-field text-sm"
                    defaultValue={clientYear.contractor_id ?? ""}
                  >
                    <option value="">{d.notAssigned}</option>
                    {contractorIds.map((uid) => (
                      <option key={uid} value={uid}>
                        {contractorMap.get(uid) ?? uid.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-secondary text-sm">
                    {d.assignContractor}
                  </button>
                </form>
              )}

              {canEditReport && allowedReportStatuses.length > 0 && (
                <form action={updateReportBound} className="flex flex-col gap-2">
                  <input type="hidden" name="client_year_id" value={clientYear.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="year" value={selectedYear} />
                  <select
                    name="report_status"
                    className="input-field text-sm"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      — {d.saveStatus} —
                    </option>
                    {allowedReportStatuses.map((s) => (
                      <option key={s} value={s}>
                        {statusLabelReport(s)}
                      </option>
                    ))}
                  </select>
                  {(clientYear.report_status === "issue" ||
                    allowedReportStatuses.includes("issue")) && (
                    <input
                      type="text"
                      name="issue_notes"
                      placeholder={d.issueNotes}
                      defaultValue={clientYear.issue_notes ?? ""}
                      className="input-field text-sm"
                    />
                  )}
                  <button type="submit" className="btn-primary text-sm">
                    {d.saveStatus}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ── Documents section ── */}
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">{d.documents.title}</h2>

            {docs.length === 0 ? (
              <p className="text-sm text-muted">{d.documents.empty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {docs.map((doc) => {
                  const docName =
                    (doc.document_type_id ? docTypeNameMap.get(doc.document_type_id) : null) ??
                    doc.custom_name ??
                    "—";
                  const label = doc.free_text ? `${docName} — ${doc.free_text}` : docName;

                  return (
                    <li
                      key={doc.id}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-surface px-4 py-3"
                    >
                      {/* Doc name + AI summary chip + remove button */}
                      <div className="flex items-start gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {label}
                            </span>
                            {/* Document-level AI status summary */}
                            {(() => {
                              const files = uploadsByDoc.get(doc.id) ?? [];
                              if (files.length === 0) return null;
                              const hasInvalid = files.some((f) => f.ai_status === "invalid");
                              const hasPending = files.some((f) => f.ai_status === "pending");
                              const allValid = !hasInvalid && !hasPending;
                              return (
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                    hasInvalid
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                      : hasPending
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                  }`}
                                >
                                  {hasInvalid
                                    ? d.documents.aiInvalid
                                    : hasPending
                                      ? d.documents.aiPending
                                      : d.documents.aiValid}
                                </span>
                              );
                            })()}
                          </div>
                          <span className="text-xs text-muted">
                            {doc.is_required ? d.documents.requiredLabel : d.documents.optionalLabel}
                            {doc.client_marked_none && (
                              <> · {d.documents.clientMarkedNone}{doc.none_reason ? `: ${doc.none_reason}` : ""}</>
                            )}
                          </span>
                        </div>

                        {canManageDocuments && (
                          <form action={removeDocBound}>
                            <input type="hidden" name="document_id" value={doc.id} />
                            <input type="hidden" name="client_year_id" value={clientYear.id} />
                            <input type="hidden" name="client_id" value={clientId} />
                            <input type="hidden" name="year" value={selectedYear} />
                            <button
                              type="submit"
                              className="shrink-0 text-xs text-muted hover:text-foreground transition-colors"
                            >
                              {d.documents.remove}
                            </button>
                          </form>
                        )}
                      </div>

                      {/* Uploaded files for this document */}
                      {(() => {
                        const files = uploadsByDoc.get(doc.id) ?? [];
                        if (files.length === 0)
                          return (
                            <p className="text-xs text-muted">{d.documents.noUploads}</p>
                          );
                        return (
                          <ul className="flex flex-col gap-1">
                            {files.map((f) => {
                              type ValErr = { field: string; message: string };
                              type AIRes = { formType?: string | null; formYear?: number | null; errors?: ValErr[]; warnings?: ValErr[] } | null;
                              const result = f.ai_result as AIRes;
                              const errors: ValErr[] = result?.errors ?? [];
                              const warnings: ValErr[] = result?.warnings ?? [];
                              const formLabel = result?.formType
                                ? `${result.formType}${result.formYear ? ` · ${result.formYear}` : ""}`
                                : null;

                              return (
                                <li key={f.id} className="flex flex-col gap-1">
                                  {/* File header row */}
                                  <div className={`flex items-start gap-2 rounded-md px-3 py-1.5 text-xs ${
                                    f.ai_status === "invalid"
                                      ? "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                                      : f.ai_status === "valid"
                                        ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                                        : "bg-surface-muted text-muted"
                                  }`}>
                                    <span className="mt-0.5 shrink-0 leading-none">
                                      {f.ai_status === "valid" ? "✓" : f.ai_status === "invalid" ? "⚠" : "⏳"}
                                    </span>
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {f.drive_url ? (
                                          <a href={f.drive_url} target="_blank" rel="noopener noreferrer" className="truncate font-medium hover:underline">
                                            {f.original_filename}
                                          </a>
                                        ) : (
                                          <span className="truncate font-medium">{f.original_filename}</span>
                                        )}
                                        {formLabel && (
                                          <span className="shrink-0 rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold dark:bg-white/10">
                                            {formLabel}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {/* Re-check button */}
                                    {f.ai_status === "pending" && canManageDocuments && (
                                      <RecheckForm
                                        action={recheckFileBound}
                                        fileId={f.id}
                                        clientYearId={clientYear.id}
                                        clientId={clientId}
                                        year={selectedYear}
                                        labels={{
                                          recheck: d.documents.aiRecheck,
                                          checking: d.documents.aiChecking,
                                          recheckTitle: d.documents.aiRecheckTitle,
                                        }}
                                      />
                                    )}
                                  </div>

                                  {/* Errors */}
                                  {errors.length > 0 && (
                                    <ul className="flex flex-col gap-0.5 pl-7 pr-2">
                                      {errors.map((e, i) => (
                                        <li key={i} className="flex items-start gap-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                                          <span className="shrink-0 font-bold">✗</span>
                                          <span><span className="font-semibold">{e.field}:</span> {e.message}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}

                                  {/* Warnings */}
                                  {warnings.length > 0 && (
                                    <ul className="flex flex-col gap-0.5 pl-7 pr-2">
                                      {warnings.map((w, i) => (
                                        <li key={i} className="flex items-start gap-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                                          <span className="shrink-0">⚠</span>
                                          <span><span className="font-semibold">{w.field}:</span> {w.message}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}

                                  {/* Fallback plain note */}
                                  {!result && f.ai_status === "invalid" && f.ai_notes && (
                                    <p className="pl-7 text-xs text-red-600 dark:text-red-400">{f.ai_notes}</p>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        );
                      })()}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Add from standard list */}
            {canManageDocuments && (documentTypes ?? []).length > 0 && (
              <details className="surface-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-accent">
                  + {d.documents.addFromList}
                </summary>
                <form action={addFromTypeBound} className="flex flex-col gap-3 px-4 pb-4">
                  <input type="hidden" name="client_year_id" value={clientYear.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="year" value={selectedYear} />
                  <select name="document_type_id" className="input-field text-sm" required defaultValue="">
                    <option value="" disabled>
                      {d.documents.selectDocType}
                    </option>
                    {(documentTypes ?? []).map((dt) => (
                      <option key={dt.id} value={dt.id}>
                        {dt.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="free_text"
                    placeholder={d.documents.freeTextLabel}
                    className="input-field text-sm"
                  />
                  <button type="submit" className="btn-primary text-sm self-start">
                    {d.documents.add}
                  </button>
                </form>
              </details>
            )}

            {/* Add custom document */}
            {canManageDocuments && (
              <details className="surface-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-accent">
                  + {d.documents.addCustom}
                </summary>
                <form action={addCustomBound} className="flex flex-col gap-3 px-4 pb-4">
                  <input type="hidden" name="client_year_id" value={clientYear.id} />
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="year" value={selectedYear} />
                  <input
                    type="text"
                    name="custom_name"
                    placeholder={d.documents.customNameLabel}
                    className="input-field text-sm"
                    required
                  />
                  <input
                    type="text"
                    name="free_text"
                    placeholder={d.documents.freeTextLabel}
                    className="input-field text-sm"
                  />
                  <button type="submit" className="btn-primary text-sm self-start">
                    {d.documents.add}
                  </button>
                </form>
              </details>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
