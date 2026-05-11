import { getDictionary } from "@/i18n/get-dictionary";
import { tenantRoles } from "@/lib/auth/constants";
import { requireTenantAdminBySlug } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { inviteMemberAction, removeMemberAction, updateMemberRoleAction } from "./actions";

type TenantTeamPageProps = {
  params: Promise<{ lang: string; slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function TenantTeamPage({ params, searchParams }: TenantTeamPageProps) {
  const { lang, slug } = await params;
  const { error } = await searchParams;
  const dict = await getDictionary(lang);
  const { user, tenant } = await requireTenantAdminBySlug(lang, slug);
  const supabase = await createSupabaseServerClient();

  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("user_id, role, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tenant_invitations")
      .select("id, invited_email, role, status, invited_at")
      .eq("tenant_id", tenant.id)
      .order("invited_at", { ascending: false }),
  ]);

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-blue-900">{dict.ownerMembers.title}</h1>
        <p className="text-slate-700">
          {dict.ownerMembers.tenantLabel}: {tenant.name}
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.ownerMembers.error}
        </p>
      ) : null}

      <form
        action={inviteMemberAction.bind(null, lang, slug)}
        className="grid max-w-3xl gap-4 md:grid-cols-3"
      >
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span>{dict.login.email}</span>
          <input
            required
            name="email"
            type="email"
            className="rounded-md border border-blue-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
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
        <div className="md:col-span-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {dict.ownerMembers.inviteButton}
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
            <div className="mb-3">
              <p className="font-medium">{membership.user_id}</p>
              <p className="text-sm text-slate-600">{membership.role}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <form action={updateMemberRoleAction.bind(null, lang, slug)} className="flex items-end gap-2">
                <input type="hidden" name="userId" value={membership.user_id} />
                <label className="flex flex-col gap-1 text-sm">
                  <span>{dict.ownerMembers.role}</span>
                  <select
                    name="role"
                    defaultValue={membership.role}
                    className="rounded-md border border-blue-200 px-2 py-1"
                  >
                    {tenantRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-blue-200 px-3 py-1 text-sm text-blue-700 hover:bg-blue-50"
                >
                  {dict.ownerMembers.updateRoleButton}
                </button>
              </form>
              {membership.user_id !== user.id ? (
                <form action={removeMemberAction.bind(null, lang, slug)}>
                  <input type="hidden" name="userId" value={membership.user_id} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                  >
                    {dict.ownerMembers.removeButton}
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{dict.ownerMembers.invitationsHeading}</h2>
        {(invitations ?? []).length === 0 ? (
          <p className="text-slate-700">{dict.ownerMembers.emptyInvitations}</p>
        ) : null}
        {(invitations ?? []).map((invitation) => (
          <article key={invitation.id} className="rounded-md border border-blue-100 px-4 py-3">
            <p className="font-medium">{invitation.invited_email}</p>
            <p className="text-sm text-slate-600">
              {invitation.role} — {invitation.status}
            </p>
          </article>
        ))}
      </section>
    </section>
  );
}
