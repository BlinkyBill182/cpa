create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invited_email text not null,
  role public.tenant_role not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid not null references auth.users (id) on delete restrict,
  accepted_user_id uuid references auth.users (id) on delete set null,
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists tenant_invitations_pending_unique
on public.tenant_invitations (tenant_id, lower(invited_email))
where status = 'pending';

create or replace function public.is_tenant_admin(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = target_tenant
      and tm.user_id = auth.uid()
      and tm.role = 'tenant_admin'
  );
$$;

alter table public.tenant_invitations enable row level security;

drop policy if exists "tenant_memberships_tenant_admin_write" on public.tenant_memberships;
create policy "tenant_memberships_tenant_admin_write"
on public.tenant_memberships
for all
using (public.is_platform_owner(auth.uid()) or public.is_tenant_admin(tenant_id))
with check (public.is_platform_owner(auth.uid()) or public.is_tenant_admin(tenant_id));

drop policy if exists "tenant_invitations_select" on public.tenant_invitations;
create policy "tenant_invitations_select"
on public.tenant_invitations
for select
using (
  public.is_platform_owner(auth.uid())
  or public.is_tenant_admin(tenant_id)
);

drop policy if exists "tenant_invitations_write" on public.tenant_invitations;
create policy "tenant_invitations_write"
on public.tenant_invitations
for all
using (
  public.is_platform_owner(auth.uid())
  or public.is_tenant_admin(tenant_id)
)
with check (
  public.is_platform_owner(auth.uid())
  or public.is_tenant_admin(tenant_id)
);
