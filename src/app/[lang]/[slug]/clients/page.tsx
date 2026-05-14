import { getDictionary } from "@/i18n/get-dictionary";
import { requireTenantAccessBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClientsPageProps = {
  params: Promise<{ lang: string; slug: string }>;
};

export default async function ClientsPage({ params }: ClientsPageProps) {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang);
  const { tenant, role } = await requireTenantAccessBySlug(lang, slug);

  const supabase = await createSupabaseServerClient();
  const { data: clients } = await supabase
    .from("office_clients")
    .select("id, name, tax_id, created_at")
    .eq("tenant_id", tenant.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const canManage = role === "tenant_admin" || role === "manager";

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-blue-900">{dict.clients.title}</h1>
        <p className="text-slate-700">{dict.clients.description}</p>
        {canManage ? (
          <p>
            <a
              href={`/${slug}/backoffice/clients`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {dict.clients.manageClients}
            </a>
          </p>
        ) : null}
      </header>

      {(clients ?? []).length === 0 ? (
        <p className="text-slate-500">{dict.clients.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(clients ?? []).map((client) => (
            <li key={client.id}>
              <a
                href={`/${slug}/clients/${client.id}`}
                className="flex items-center justify-between rounded-md border border-blue-100 px-4 py-3 hover:bg-blue-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-blue-900">{client.name}</p>
                  {client.tax_id ? (
                    <p className="text-sm text-slate-500">
                      {dict.clients.companyNumber}: {client.tax_id}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
                  {dict.clients.viewActions}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
