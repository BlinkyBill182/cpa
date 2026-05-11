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
        <h1 className="text-3xl font-semibold text-blue-900">{dict.ownerMembers.title}</h1>
        <p className="text-slate-700">
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
            className="rounded-md border border-blue-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            minLength={36}
            maxLength={36}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.ownerMembers.role}</span>
          <select name="role" className="rounded-md border border-blue-200 px-3 py-2">
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
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {dict.ownerMembers.submit}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{dict.ownerMembers.membersHeading}</h2>
        {(memberships ?? []).length === 0 ? (
          <p className="text-slate-700">{dict.ownerMembers.empty}</p>
        ) : null}
        {(memberships ?? []).map((membership) => (
          <article key={membership.user_id} className="rounded-md border border-blue-100 px-4 py-3">
            <p className="font-mono text-sm font-medium">{membership.user_id}</p>
            <p className="text-sm text-slate-600">{membership.role}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
