import { getDictionary } from "@/i18n/get-dictionary";
import { tenantRoles } from "@/lib/auth/constants";
import { requirePlatformOwner } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { assignMemberByUserIdAction } from "./actions";

type OwnerTenantMembersPageProps = PageProps<"/[lang]/owner/tenants/[tenantId]/members"> & {
  searchParams: Promise<{ error?: string }>;
};

export default async function OwnerTenantMembersPage({
  params,
  searchParams,
}: OwnerTenantMembersPageProps) {
  const { lang, tenantId } = await params;
  const dict = await getDictionary(lang);
  const currentSearchParams = await searchParams;
  await requirePlatformOwner(lang);

  const admin = createSupabaseAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug")
    .eq("id", tenantId)
    .single();

  const { data: memberships } = await admin
    .from("tenant_memberships")
    .select("user_id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return (
    <section className="flex w-full flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{dict.ownerMembers.title}</h1>
        <p className="text-zinc-700">
          {dict.ownerMembers.tenantLabel}: {tenant?.name ?? tenantId}
        </p>
      </header>

      {currentSearchParams.error ? (
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
            className="rounded-md border border-zinc-300 px-3 py-2"
            minLength={36}
            maxLength={36}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{dict.ownerMembers.role}</span>
          <select name="role" className="rounded-md border border-zinc-300 px-3 py-2">
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
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50"
          >
            {dict.ownerMembers.submit}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        {(memberships ?? []).length === 0 ? (
          <p className="text-zinc-700">{dict.ownerMembers.empty}</p>
        ) : null}
        {(memberships ?? []).map((membership) => (
          <article key={membership.user_id} className="rounded-md border border-zinc-200 px-4 py-3">
            <h2 className="font-medium">{membership.user_id}</h2>
            <p className="text-sm text-zinc-600">{membership.role}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
