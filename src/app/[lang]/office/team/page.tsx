import { tenantRoles } from "@/lib/auth/constants";
import { requireTenantAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { inviteMemberAction, removeMemberAction, updateMemberRoleAction } from "./actions";

type OfficeTeamPageProps = PageProps<"/[lang]/office/team"> & {
  searchParams: Promise<{ error?: string }>;
};

export default async function OfficeTeamPage({ params, searchParams }: OfficeTeamPageProps) {
  const { lang } = await params;
  const currentSearchParams = await searchParams;
  const { user, tenantId } = await requireTenantAdmin(lang);
  const supabase = await createSupabaseServerClient();

  const [{ data: memberships }, { data: invitations }, { data: tenant }] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("user_id, role, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    supabase
      .from("tenant_invitations")
      .select("id, invited_email, role, status, invited_at")
      .eq("tenant_id", tenantId)
      .order("invited_at", { ascending: false }),
    supabase.from("tenants").select("name").eq("id", tenantId).single(),
  ]);

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Team management</h1>
        <p className="text-zinc-700">Tenant: {tenant?.name ?? tenantId}</p>
      </header>

      {currentSearchParams.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Team action failed. Please verify input and permissions.
        </p>
      ) : null}

      <form action={inviteMemberAction.bind(null, lang)} className="grid max-w-3xl gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          <span>Email</span>
          <input required name="email" type="email" className="rounded-md border border-zinc-300 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Role</span>
          <select name="role" className="rounded-md border border-zinc-300 px-3 py-2">
            {tenantRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-3">
          <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-zinc-50">
            Invite member
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Current members</h2>
        {(memberships ?? []).map((membership) => (
          <article key={membership.user_id} className="rounded-md border border-zinc-200 px-4 py-3">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{membership.user_id}</p>
                <p className="text-sm text-zinc-600">{membership.role}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <form action={updateMemberRoleAction.bind(null, lang)} className="flex items-end gap-2">
                <input type="hidden" name="userId" value={membership.user_id} />
                <label className="flex flex-col gap-1 text-sm">
                  <span>Role</span>
                  <select name="role" defaultValue={membership.role} className="rounded-md border border-zinc-300 px-2 py-1">
                    {tenantRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1 text-sm">
                  Update role
                </button>
              </form>
              {membership.user_id !== user.id ? (
                <form action={removeMemberAction.bind(null, lang)}>
                  <input type="hidden" name="userId" value={membership.user_id} />
                  <button type="submit" className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700">
                    Remove
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Invitations</h2>
        {(invitations ?? []).length === 0 ? <p className="text-zinc-700">No invitations yet.</p> : null}
        {(invitations ?? []).map((invitation) => (
          <article key={invitation.id} className="rounded-md border border-zinc-200 px-4 py-3">
            <p className="font-medium">{invitation.invited_email}</p>
            <p className="text-sm text-zinc-600">
              {invitation.role} - {invitation.status}
            </p>
          </article>
        ))}
      </section>
    </section>
  );
}
