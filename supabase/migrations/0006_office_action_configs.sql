-- Action configuration per CPA office.
-- The platform owner enables / disables actions for each tenant.
-- Action definitions live in code (src/lib/actions/registry.ts); this table
-- only stores the enabled state and optional office-level config per action.

create table public.office_action_configs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  action_key  text not null,
  is_enabled  boolean not null default false,
  config      jsonb,
  updated_at  timestamptz not null default now(),
  unique (tenant_id, action_key)
);

alter table public.office_action_configs enable row level security;

-- Platform owner has full access to all rows
create policy "platform_owner_full_access" on public.office_action_configs
  for all
  using (is_platform_owner(auth.uid()));

-- Tenant members can read the config for their own office
create policy "tenant_member_read" on public.office_action_configs
  for select
  using (has_tenant_access(tenant_id));
