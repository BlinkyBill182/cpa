import Link from "next/link";

import {
  createOfficeClientAction,
  importOfficeClientsCsvAction,
  softDeleteOfficeClientAction,
  updateOfficeClientAction,
} from "./actions";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireTenantManagerOrAdminBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ManageClientsPageProps = {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    archived?: string;
    imported?: string;
    skipped?: string;
    error?: string;
    showArchived?: string;
  }>;
};

export default async function ManageClientsPage({ params, searchParams }: ManageClientsPageProps) {
  const { lang, slug } = await params;
  const sp = await searchParams;
  const dict = await getDictionary(lang);
  const m = dict.clientManage;
  const { tenant, role } = await requireTenantManagerOrAdminBySlug(lang, slug);
  const showArchived = sp.showArchived === "1";

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("office_clients")
    .select("id, name, tax_id, created_at, deleted_at")
    .eq("tenant_id", tenant.id)
    .order("name", { ascending: true });

  if (!showArchived) {
    query = query.is("deleted_at", null);
  }

  const { data: clients } = await query;

  const banner = (() => {
    if (sp.error === "validation") return { tone: "err" as const, text: m.errorValidation };
    if (sp.error === "save") return { tone: "err" as const, text: m.errorSave };
    if (sp.error === "csv") return { tone: "err" as const, text: m.errorCsv };
    if (sp.error === "csv_empty") return { tone: "err" as const, text: m.errorCsvEmpty };
    if (sp.created === "1") return { tone: "ok" as const, text: m.successCreated };
    if (sp.updated === "1") return { tone: "ok" as const, text: m.successUpdated };
    if (sp.archived === "1") return { tone: "ok" as const, text: m.successArchived };
    if (sp.imported != null || sp.skipped != null) {
      const i = Number(sp.imported ?? 0);
      const u = Number(sp.updated ?? 0);
      const s = Number(sp.skipped ?? 0);
      return {
        tone: "ok" as const,
        text: `${m.importComplete} ${m.importAdded}: ${i}, ${m.importUpdated}: ${u}, ${m.importSkipped}: ${s}.`,
      };
    }
    return null;
  })();

  return (
    <section className="flex w-full flex-col gap-10">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href={`/${slug}/clients`} className="link-accent">
            ← {m.backToClients}
          </Link>
          {role === "tenant_admin" ? (
            <Link href={`/${slug}/backoffice`} className="link-accent">
              ← {m.backToOfficeBackoffice}
            </Link>
          ) : null}
        </div>
        <h1 className="page-title">{m.title}</h1>
        <p className="text-muted">{m.description}</p>
      </header>

      {banner ? (
        <p
          className={
            banner.tone === "err"
              ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              : "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
          }
        >
          {banner.text}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <Link
          href={showArchived ? `/${slug}/backoffice/clients` : `/${slug}/backoffice/clients?showArchived=1`}
          className="link-accent text-sm"
        >
          {showArchived ? m.hideArchived : m.showArchived}
        </Link>
      </div>

      <section className="surface-card flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-foreground">{m.addClient}</h2>
        <form action={createOfficeClientAction.bind(null, lang, slug)} className="flex max-w-xl flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span>{m.name}</span>
            <input
              required
              name="name"
              type="text"
              className="input-field"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>{m.companyNumber}</span>
            <input
              name="tax_id"
              type="text"
              className="input-field"
            />
          </label>
          <button
            type="submit"
            className="w-fit btn-primary"
          >
            {m.create}
          </button>
        </form>
      </section>

      <section className="surface-card flex flex-col gap-4 p-6">
        <h2 className="text-lg font-semibold text-foreground">{m.csvImport}</h2>
        <p className="text-sm text-muted">{m.csvHint}</p>
        <form action={importOfficeClientsCsvAction.bind(null, lang, slug)} className="flex max-w-xl flex-col gap-3">
          <input
            required
            name="csv"
            type="file"
            accept=".csv,text/csv"
            className="text-sm"
          />
          <button
            type="submit"
            className="w-fit btn-secondary"
          >
            {m.csvSubmit}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-foreground">{m.listHeading}</h2>
        {(clients ?? []).length === 0 ? (
          <p className="text-muted">{m.empty}</p>
        ) : (
          <ul className="flex flex-col gap-6">
            {(clients ?? []).map((client) => {
              const archived = client.deleted_at != null;
              return (
                <li
                  key={client.id}
                  className="surface-card p-4"
                >
                  <form
                    action={updateOfficeClientAction.bind(null, lang, slug)}
                    className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end"
                  >
                    <input type="hidden" name="client_id" value={client.id} />
                    <div className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
                      <span>{m.clientId}</span>
                      <code className="rounded-md border border-border bg-accent-soft/30 px-2 py-2 text-xs">
                        {client.id}
                      </code>
                    </div>
                    <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm">
                      <span>{m.name}</span>
                      <input
                        required
                        name="name"
                        type="text"
                        defaultValue={client.name}
                        className="input-field"
                      />
                    </label>
                    <label className="flex min-w-[140px] flex-1 flex-col gap-1 text-sm">
                      <span>{m.companyNumber}</span>
                      <input
                        name="tax_id"
                        type="text"
                        defaultValue={client.tax_id ?? ""}
                        className="input-field"
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn-primary"
                    >
                      {m.save}
                    </button>
                  </form>
                  {!archived ? (
                    <form
                      action={softDeleteOfficeClientAction.bind(null, lang, slug)}
                      className="mt-3 flex items-center gap-2"
                    >
                      <input type="hidden" name="client_id" value={client.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                      >
                        {m.archive}
                      </button>
                    </form>
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      {m.archivedAt}{" "}
                      {client.deleted_at ? new Date(client.deleted_at).toLocaleString() : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
