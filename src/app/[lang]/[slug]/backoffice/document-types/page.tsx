import { getDictionary } from "@/i18n/get-dictionary";
import { requireTenantAdminBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  adoptGlobalDocumentTypeAction,
  createDocumentTypeAction,
  deleteDocumentTypeAction,
  toggleDocumentTypeActiveAction,
  updateDocumentTypeAction,
} from "./actions";

type Props = {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{
    error?: string;
    created?: string;
    updated?: string;
    adopted?: string;
    deleted?: string;
  }>;
};

export default async function DocumentTypesPage({ params, searchParams }: Props) {
  const { lang, slug } = await params;
  const { error, created, updated, adopted, deleted } = await searchParams;

  const dict = await getDictionary(lang);
  const { tenant } = await requireTenantAdminBySlug(lang, slug);
  const d = dict.documentTypes;

  const supabase = await createSupabaseServerClient();

  // Fetch tenant-specific types
  const { data: documentTypes } = await supabase
    .from("document_types")
    .select("id, name, allowed_formats, is_active")
    .eq("tenant_id", tenant.id)
    .order("name");

  // Fetch active global types
  const { data: globalTypes } = await supabase
    .from("document_types")
    .select("id, name, allowed_formats")
    .is("tenant_id", null)
    .eq("is_active", true)
    .order("name");

  // Names already in tenant's library (for "already in office" indicator)
  const adoptedNames = new Set(
    (documentTypes ?? []).map((dt) => dt.name.toLowerCase()),
  );

  const createBound = createDocumentTypeAction.bind(null, lang, slug);
  const updateBound = updateDocumentTypeAction.bind(null, lang, slug);
  const toggleBound = toggleDocumentTypeActiveAction.bind(null, lang, slug);
  const deleteBound = deleteDocumentTypeAction.bind(null, lang, slug);
  const adoptBound = adoptGlobalDocumentTypeAction.bind(null, lang, slug);

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <a href={`/${slug}/backoffice`} className="link-accent text-sm">
          ← {d.backToBackoffice}
        </a>
        <h1 className="page-title">{d.title}</h1>
        <p className="text-muted">{d.description}</p>
      </header>

      {/* Feedback banners */}
      {error === "save" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {d.errorSave}
        </p>
      )}
      {error === "already_exists" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          {d.errorAlreadyExists}
        </p>
      )}
      {created && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
          {d.successCreated}
        </p>
      )}
      {updated && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
          {d.successUpdated}
        </p>
      )}
      {adopted && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
          {d.successAdopted}
        </p>
      )}
      {deleted && (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
          {d.successDeleted}
        </p>
      )}

      {/* Add new document type */}
      <div className="surface-card p-6 flex flex-col gap-4">
        <h2 className="text-base font-semibold text-foreground">{d.add}</h2>
        <form action={createBound} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">{d.name}</label>
            <input
              type="text"
              name="name"
              required
              maxLength={300}
              className="input-field"
              placeholder={d.name}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">{d.allowedFormats}</label>
            <input
              type="text"
              name="allowed_formats"
              className="input-field"
              placeholder="PDF, JPEG, XLS"
            />
          </div>
          <button type="submit" className="btn-primary self-start">
            {d.add}
          </button>
        </form>
      </div>

      {/* Existing document types */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">{d.listHeading}</h2>

        {!documentTypes || documentTypes.length === 0 ? (
          <p className="text-sm text-muted">{d.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documentTypes.map((dt) => (
              <li key={dt.id} className="surface-card p-4 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5">
                    <p
                      className={`font-medium ${dt.is_active ? "text-foreground" : "text-muted line-through"}`}
                    >
                      {dt.name}
                    </p>
                    {dt.allowed_formats.length > 0 && (
                      <p className="text-xs text-muted">
                        {d.formats}: {dt.allowed_formats.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <form action={toggleBound}>
                      <input type="hidden" name="id" value={dt.id} />
                      <input type="hidden" name="is_active" value={String(!dt.is_active)} />
                      <button
                        type="submit"
                        className="text-xs text-muted hover:text-foreground transition-colors"
                      >
                        {dt.is_active ? d.deactivate : d.activate}
                      </button>
                    </form>
                    <form action={deleteBound}>
                      <input type="hidden" name="id" value={dt.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      >
                        {d.delete}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Inline edit form */}
                <details>
                  <summary className="cursor-pointer text-xs text-accent">
                    {d.save}
                  </summary>
                  <form action={updateBound} className="mt-3 flex flex-col gap-3">
                    <input type="hidden" name="id" value={dt.id} />
                    <input
                      type="text"
                      name="name"
                      required
                      maxLength={300}
                      defaultValue={dt.name}
                      className="input-field text-sm"
                    />
                    <input
                      type="text"
                      name="allowed_formats"
                      defaultValue={dt.allowed_formats.join(", ")}
                      className="input-field text-sm"
                      placeholder="PDF, JPEG, XLS"
                    />
                    <button type="submit" className="btn-primary text-sm self-start">
                      {d.save}
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Global library section */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">{d.globalLibraryHeading}</h2>
          <p className="text-sm text-muted">{d.globalLibraryDescription}</p>
        </div>

        {!globalTypes || globalTypes.length === 0 ? (
          <p className="text-sm text-muted">{d.globalEmpty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {globalTypes.map((gt) => {
              const isAdopted = adoptedNames.has(gt.name.toLowerCase());
              return (
                <li
                  key={gt.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface/60 px-4 py-3"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="font-medium text-foreground">{gt.name}</p>
                    {gt.allowed_formats.length > 0 && (
                      <p className="text-xs text-muted">
                        {d.formats}: {gt.allowed_formats.join(", ")}
                      </p>
                    )}
                  </div>

                  {isAdopted ? (
                    <span className="shrink-0 text-xs text-green-700 dark:text-green-400">
                      {d.alreadyInOffice}
                    </span>
                  ) : (
                    <form action={adoptBound} className="shrink-0">
                      <input type="hidden" name="id" value={gt.id} />
                      <button type="submit" className="btn-secondary text-xs px-3 py-1.5">
                        {d.adoptButton}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
