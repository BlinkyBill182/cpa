create table if not exists public.tenant_access_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  role public.tenant_role,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz
);

-- One pending request per email per tenant
create unique index if not exists tenant_access_requests_pending_unique
on public.tenant_access_requests (tenant_id, lower(email))
where status = 'pending';

alter table public.tenant_access_requests enable row level security;

create policy "tenant_access_requests_select"
on public.tenant_access_requests
for select
using (
  public.is_platform_owner(auth.uid())
  or public.is_tenant_admin(tenant_id)
);

create policy "tenant_access_requests_update"
on public.tenant_access_requests
for update
using (
  public.is_platform_owner(auth.uid())
  or public.is_tenant_admin(tenant_id)
)
with check (
  public.is_platform_owner(auth.uid())
  or public.is_tenant_admin(tenant_id)
);
