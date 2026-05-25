import { getDictionary } from "@/i18n/get-dictionary";
import { tenantRoles } from "@/lib/auth/constants";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { assignMemberByUserIdAction } from "./actions";

type BackofficeMembersPageProps = {
  params: Promise<{ lang: string; tenantId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function BackofficeMembersPage({
  params,
  searchParams,
}: BackofficeMembersPageProps) {
  const { lang, tenantId } = await params;
  const dict = await getDictionary(lang);
  const { error } = await searchParams;
  await requirePlatformOwner(lang);

  const admin = createSupabaseAdminClient();

  const [{ data: tenant }, { data: memberships }] = await Promise.all([
    admin.from("tenants").select("id, name, slug").eq("id", tenantId).single(),
    admin
      .from("tenant_memberships")
      .select("user_id, role, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="page-title">{dict.ownerMembers.title}</h1>
        <p className="text-muted">
          {dict.ownerMembers.tenantLabel}: {tenant?.name ?? tenantId}
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.ownerMembers.error}
        </p>
      ) : null}

      <form
        action={assignMemberByUserIdAction.bind(null, lang, tenantId)}
        className="grid max-w-3xl gap-4 md:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.ownerMembers.userId}</span>
          <input
            required
            name="userId"
            className="input-field font-mono text-sm"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            minLength={36}
            maxLength={36}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.ownerMembers.role}</span>
          <select name="role" className="input-field">
            {tenantRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            className="btn-primary"
          >
            {dict.ownerMembers.submit}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{dict.ownerMembers.membersHeading}</h2>
        {(memberships ?? []).length === 0 ? (
          <p className="text-muted">{dict.ownerMembers.empty}</p>
        ) : null}
        {(memberships ?? []).map((membership) => (
          <article key={membership.user_id} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="font-mono text-sm font-medium">{membership.user_id}</p>
            <p className="text-sm text-muted">{membership.role}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
