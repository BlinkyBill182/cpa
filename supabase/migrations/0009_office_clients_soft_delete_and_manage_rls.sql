-- Soft delete for office clients + RLS: staff read-only (active rows only);
-- tenant_admin and manager can read all rows (including archived) and write.

alter table public.office_clients
  add column if not exists deleted_at timestamptz;

create index if not exists office_clients_tenant_active_idx
  on public.office_clients (tenant_id)
  where deleted_at is null;

create or replace function public.can_manage_office_clients(target_tenant uuid)
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
      and tm.role in ('tenant_admin', 'manager')
  );
$$;

drop policy if exists "office_clients_tenant_access" on public.office_clients;

create policy "office_clients_select"
  on public.office_clients
  for select
  using (
    public.is_platform_owner(auth.uid())
    or public.can_manage_office_clients(tenant_id)
    or (public.has_tenant_access(tenant_id) and deleted_at is null)
  );

create policy "office_clients_insert"
  on public.office_clients
  for insert
  with check (
    public.is_platform_owner(auth.uid())
    or public.can_manage_office_clients(tenant_id)
  );

create policy "office_clients_update"
  on public.office_clients
  for update
  using (
    public.is_platform_owner(auth.uid())
    or public.can_manage_office_clients(tenant_id)
  )
  with check (
    public.is_platform_owner(auth.uid())
    or public.can_manage_office_clients(tenant_id)
  );

create policy "office_clients_delete"
  on public.office_clients
  for delete
  using (false);
