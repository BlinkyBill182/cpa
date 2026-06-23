import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n/get-dictionary";
import { getAllActions } from "@/lib/actions/registry";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { saveActionConfigAction } from "./actions";
import { ActionEnableToggle } from "./action-enable-toggle";

type OwnerActionsPageProps = {
  params: Promise<{ lang: string; tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OwnerActionsPage({ params, searchParams }: OwnerActionsPageProps) {
  const { lang, tenantId } = await params;
  const sp = await searchParams;
  const driveConnected = sp.drive_connected === "1";
  const driveError = typeof sp.drive_error === "string" ? sp.drive_error : null;

  const dict = await getDictionary(lang);
  await requirePlatformOwner(lang);

  const supabase = await createSupabaseServerClient();
  const adminSupabase = createSupabaseAdminClient();

  const [{ data: tenant }, { data: configs }, { data: oauthSecret }] = await Promise.all([
    supabase.from("tenants").select("id, name, slug").eq("id", tenantId).single(),
    supabase.from("office_action_configs").select("action_key, is_enabled, config").eq("tenant_id", tenantId),
    adminSupabase
      .from("tenant_secrets")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("service", "google_drive_oauth")
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (!tenant) notFound();

  const isDriveOAuthConnected = !!oauthSecret;

  const configMap = new Map(
    (configs ?? []).map((c) => [c.action_key, { is_enabled: c.is_enabled, config: c.config }]),
  );

  const allActions = getAllActions();
  const saveConfigBound = saveActionConfigAction.bind(null, lang, tenantId);
  const returnTo = `/${lang}/backoffice/tenants/${tenantId}/actions`;

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <a href="/backoffice/tenants" className="link-accent text-sm">
          ← {dict.ownerActions.backToTenants}
        </a>
        <h1 className="page-title">{dict.ownerActions.title}</h1>
        <p className="text-muted">
          {dict.ownerMembers.tenantLabel}: <span className="font-medium">{tenant.name}</span>
        </p>
        <p className="text-sm text-muted">{dict.ownerActions.description}</p>

        {/* Drive OAuth status banners */}
        {driveConnected && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            ✓ {dict.ownerActions.driveConnectSuccess}
          </p>
        )}
        {driveError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {dict.ownerActions.driveConnectError} ({driveError})
          </p>
        )}
      </header>

      {allActions.length === 0 ? (
        <p className="text-muted">{dict.ownerActions.noActions}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {allActions.map((action) => {
            const entry = configMap.get(action.key);
            const isEnabled = entry?.is_enabled ?? false;
            const cfg = (entry?.config ?? {}) as Record<string, Json>;
            const actionDict = dict.actions[action.dictNamespace];
            return (
              <li
                key={action.key}
                className="rounded-xl border border-border bg-surface"
              >
                <div className="flex items-center justify-between px-4 py-3">
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
                      <p className="text-sm text-muted">{actionDict.description}</p>
                      <p className="mt-0.5 font-mono text-xs text-muted">{action.key}</p>
                    </div>
                  </div>

                  <ActionEnableToggle
                    lang={lang}
                    tenantId={tenantId}
                    actionKey={action.key}
                    initialEnabled={isEnabled}
                    labelId={`owner-action-${action.key}`}
                  />
                </div>

                {/* Drive / n8n config — only for annual-income-summary when enabled */}
                {action.key === "annual-income-summary" && isEnabled && (
                  <div className="flex flex-col gap-4 border-t border-border px-4 py-3">
                    {/* Google Drive OAuth connection */}
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">
                        Google Drive OAuth
                      </p>
                      {isDriveOAuthConnected ? (
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            {dict.ownerActions.driveConnected}
                          </span>
                          <a
                            href={`/api/google-auth?tenantId=${tenantId}&returnTo=${encodeURIComponent(returnTo)}`}
                            className="text-xs text-accent hover:underline"
                          >
                            {dict.ownerActions.driveReconnect}
                          </a>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-muted">{dict.ownerActions.driveConnectDescription}</p>
                          <a
                            href={`/api/google-auth?tenantId=${tenantId}&returnTo=${encodeURIComponent(returnTo)}`}
                            className="btn-primary self-start px-3 py-1.5 text-xs"
                          >
                            {dict.ownerActions.driveConnect}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Drive folder ID + n8n webhook */}
                    <div>
                      <p className="mb-2 text-xs font-semibold text-muted uppercase tracking-wide">
                        {dict.ownerActions.driveConfig}
                      </p>
                      <form action={saveConfigBound} className="flex flex-col gap-2">
                        <input type="hidden" name="actionKey" value={action.key} />
                        <input
                          type="text"
                          name="drive_folder_id"
                          placeholder={dict.ownerActions.driveFolderIdLabel}
                          defaultValue={typeof cfg.drive_folder_id === "string" ? cfg.drive_folder_id : ""}
                          className="input-field text-sm"
                        />
                        <button type="submit" className="btn-secondary self-start text-sm">
                          {dict.ownerActions.saveConfig}
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
