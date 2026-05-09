create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  is_platform_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create type public.tenant_role as enum ('tenant_admin', 'manager', 'staff', 'reviewer');

create table if not exists public.tenant_memberships (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.tenant_role not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.office_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  tax_id text,
  created_at timestamptz not null default now()
);

create type public.seasonal_income_status as enum ('pending_review', 'approved', 'rejected');

create table if not exists public.seasonal_income_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  office_client_id uuid not null references public.office_clients (id) on delete cascade,
  year integer not null,
  status public.seasonal_income_status not null default 'pending_review',
  gross_income numeric(14, 2) not null,
  taxable_income numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  flow_type text not null,
  status text not null check (status in ('queued', 'running', 'failed', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_owner(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid and p.is_platform_owner = true
  );
$$;

create or replace function public.has_tenant_access(target_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = target_tenant and tm.user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.office_clients enable row level security;
alter table public.seasonal_income_records enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid() or public.is_platform_owner(auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid() or public.is_platform_owner(auth.uid()))
with check (id = auth.uid() or public.is_platform_owner(auth.uid()));

drop policy if exists "tenants_select_owner_or_member" on public.tenants;
create policy "tenants_select_owner_or_member"
on public.tenants
for select
using (public.is_platform_owner(auth.uid()) or public.has_tenant_access(id));

drop policy if exists "tenants_insert_owner_only" on public.tenants;
create policy "tenants_insert_owner_only"
on public.tenants
for insert
with check (public.is_platform_owner(auth.uid()));

drop policy if exists "tenants_update_owner_only" on public.tenants;
create policy "tenants_update_owner_only"
on public.tenants
for update
using (public.is_platform_owner(auth.uid()))
with check (public.is_platform_owner(auth.uid()));

drop policy if exists "tenant_memberships_select" on public.tenant_memberships;
create policy "tenant_memberships_select"
on public.tenant_memberships
for select
using (
  public.is_platform_owner(auth.uid())
  or user_id = auth.uid()
  or public.has_tenant_access(tenant_id)
);

drop policy if exists "tenant_memberships_owner_write" on public.tenant_memberships;
create policy "tenant_memberships_owner_write"
on public.tenant_memberships
for all
using (public.is_platform_owner(auth.uid()))
with check (public.is_platform_owner(auth.uid()));

drop policy if exists "office_clients_tenant_access" on public.office_clients;
create policy "office_clients_tenant_access"
on public.office_clients
for all
using (public.is_platform_owner(auth.uid()) or public.has_tenant_access(tenant_id))
with check (public.is_platform_owner(auth.uid()) or public.has_tenant_access(tenant_id));

drop policy if exists "seasonal_income_tenant_access" on public.seasonal_income_records;
create policy "seasonal_income_tenant_access"
on public.seasonal_income_records
for all
using (public.is_platform_owner(auth.uid()) or public.has_tenant_access(tenant_id))
with check (public.is_platform_owner(auth.uid()) or public.has_tenant_access(tenant_id));

drop policy if exists "workflow_runs_tenant_access" on public.workflow_runs;
create policy "workflow_runs_tenant_access"
on public.workflow_runs
for all
using (public.is_platform_owner(auth.uid()) or public.has_tenant_access(tenant_id))
with check (public.is_platform_owner(auth.uid()) or public.has_tenant_access(tenant_id));

drop policy if exists "audit_logs_select_tenant_access" on public.audit_logs;
create policy "audit_logs_select_tenant_access"
on public.audit_logs
for select
using (
  public.is_platform_owner(auth.uid())
  or (tenant_id is not null and public.has_tenant_access(tenant_id))
);

drop policy if exists "audit_logs_insert_platform_or_tenant_member" on public.audit_logs;
create policy "audit_logs_insert_platform_or_tenant_member"
on public.audit_logs
for insert
with check (
  public.is_platform_owner(auth.uid())
  or (tenant_id is not null and public.has_tenant_access(tenant_id))
);
