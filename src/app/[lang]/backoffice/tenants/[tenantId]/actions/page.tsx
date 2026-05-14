import { getDictionary } from "@/i18n/get-dictionary";
import { getAllActions } from "@/lib/actions/registry";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { ActionEnableToggle } from "./action-enable-toggle";

type OwnerActionsPageProps = {
  params: Promise<{ lang: string; tenantId: string }>;
};

export default async function OwnerActionsPage({ params }: OwnerActionsPageProps) {
  const { lang, tenantId } = await params;
  const dict = await getDictionary(lang);
  await requirePlatformOwner(lang);

  const admin = createSupabaseAdminClient();

  const [{ data: tenant }, { data: configs }] = await Promise.all([
    admin.from("tenants").select("id, name, slug").eq("id", tenantId).single(),
    admin
      .from("office_action_configs")
      .select("action_key, is_enabled")
      .eq("tenant_id", tenantId),
  ]);

  const enabledKeys = new Set(
    (configs ?? []).filter((c) => c.is_enabled).map((c) => c.action_key),
  );

  const allActions = getAllActions();

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <a href="/backoffice/tenants" className="text-sm text-blue-600 hover:underline">
          ← {dict.ownerActions.backToTenants}
        </a>
        <h1 className="text-3xl font-semibold text-blue-900">{dict.ownerActions.title}</h1>
        <p className="text-slate-700">
          {dict.ownerMembers.tenantLabel}: <span className="font-medium">{tenant?.name ?? tenantId}</span>
        </p>
        <p className="text-sm text-slate-500">{dict.ownerActions.description}</p>
      </header>

      {allActions.length === 0 ? (
        <p className="text-slate-700">{dict.ownerActions.noActions}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {allActions.map((action) => {
            const isEnabled = enabledKeys.has(action.key);
            const actionDict = dict.actions[action.dictNamespace];
            return (
              <li
                key={action.key}
                className="flex items-center justify-between rounded-md border border-blue-100 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-2xl leading-none">{action.icon}</span>
                  <div>
                    <p id={`owner-action-${action.key}`} className="font-medium">
                      {actionDict.title}
                      {action.officeSpecific?.length ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-700">
                          {dict.ownerActions.officeSpecific}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-slate-500">{actionDict.description}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{action.key}</p>
                  </div>
                </div>

                <ActionEnableToggle
                  lang={lang}
                  tenantId={tenantId}
                  actionKey={action.key}
                  initialEnabled={isEnabled}
                  labelId={`owner-action-${action.key}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
