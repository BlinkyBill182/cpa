import { getDictionary } from "@/i18n/get-dictionary";
import { tenantRoles } from "@/lib/auth/constants";
import { requireTenantAdminBySlug } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  approveAccessRequestAction,
  inviteMemberAction,
  rejectAccessRequestAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "./actions";

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

  const admin = createSupabaseAdminClient();

  const [{ data: memberships }, { data: invitations }, { data: accessRequests }] =
    await Promise.all([
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
      admin
        .from("tenant_access_requests")
        .select("id, email, requested_at")
        .eq("tenant_id", tenant.id)
        .eq("status", "pending")
        .order("requested_at", { ascending: false }),
    ]);

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="page-title">{dict.ownerMembers.title}</h1>
        <p className="text-muted">
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
            className="input-field"
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
        <div className="md:col-span-3">
          <button
            type="submit"
            className="btn-primary"
          >
            {dict.ownerMembers.inviteButton}
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
            <div className="mb-3">
              <p className="font-medium">{membership.user_id}</p>
              <p className="text-sm text-muted">{membership.role}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <form action={updateMemberRoleAction.bind(null, lang, slug)} className="flex items-end gap-2">
                <input type="hidden" name="userId" value={membership.user_id} />
                <label className="flex flex-col gap-1 text-sm">
                  <span>{dict.ownerMembers.role}</span>
                  <select
                    name="role"
                    defaultValue={membership.role}
                    className="input-field px-2 py-1"
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
                  className="btn-secondary px-3 py-1 text-sm"
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
          <p className="text-muted">{dict.ownerMembers.emptyInvitations}</p>
        ) : null}
        {(invitations ?? []).map((invitation) => (
          <article key={invitation.id} className="rounded-xl border border-border bg-surface px-4 py-3">
            <p className="font-medium">{invitation.invited_email}</p>
            <p className="text-sm text-muted">
              {invitation.role} — {invitation.status}
            </p>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{dict.ownerMembers.accessRequestsHeading}</h2>
        {(accessRequests ?? []).length === 0 ? (
          <p className="text-muted">{dict.ownerMembers.emptyAccessRequests}</p>
        ) : null}
        {(accessRequests ?? []).map((req) => (
          <article
            key={req.id}
            className="rounded-md border border-amber-100 bg-amber-50 px-4 py-3"
          >
            <div className="mb-3">
              <p className="font-medium">{req.email}</p>
              <p className="text-sm text-muted">
                {dict.ownerMembers.requestedAt}:{" "}
                {new Date(req.requested_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <form
                action={approveAccessRequestAction.bind(null, lang, slug)}
                className="flex items-end gap-2"
              >
                <input type="hidden" name="requestId" value={req.id} />
                <label className="flex flex-col gap-1 text-sm">
                  <span>{dict.ownerMembers.role}</span>
                  <select name="role" className="input-field px-2 py-1">
                    {tenantRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="btn-primary px-3 py-1"
                >
                  {dict.ownerMembers.approveButton}
                </button>
              </form>
              <form action={rejectAccessRequestAction.bind(null, lang, slug)}>
                <input type="hidden" name="requestId" value={req.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50"
                >
                  {dict.ownerMembers.rejectButton}
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
