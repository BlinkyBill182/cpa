-- Document collection workflow.
-- Adds the contractor role, expands office_clients with contact fields,
-- and creates the four tables that power the annual income summary action.

-- 1. New tenant_role value for external contractors
alter type public.tenant_role add value if not exists 'contractor';

-- 2. Contact fields on office_clients (needed for notifications + upload portal)
alter table public.office_clients
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists phone      text,
  add column if not exists email      text;

-- 3. Status enums for the two parallel status tracks
create type public.accounting_status as enum (
  'in_progress',      -- בעבודה: documents being configured
  'ready_missing',    -- מוכן חוסרים: waiting for client to upload
  'ready_for_review', -- מוכן לביקורת: all docs OK, ready for contractor
  'issue',            -- בעיה: stuck, free-text note required
  'skip'              -- לא עושים: skip this client entirely
);

create type public.report_status as enum (
  'ready_missing',        -- מוכן חוסרים: contractor found a gap
  'missing_completed',    -- חוסרים הושלמו: accountant marked gaps resolved
  'ready_for_check',      -- מוכן לבדיקה: contractor done
  'issue',                -- בעיה: stuck
  'ready_for_signature',  -- מוכן לחתימה: office manager approved (admin-only transition)
  'submitted'             -- הוגש: filed (admin-only transition)
);

-- 4. is_tenant_admin helper used by tenant_secrets RLS
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
      and tm.user_id   = auth.uid()
      and tm.role      = 'tenant_admin'
  );
$$;

-- 5. document_types — standard document library per office
create table public.document_types (
  id              uuid      primary key default gen_random_uuid(),
  tenant_id       uuid      not null references public.tenants(id) on delete cascade,
  name            text      not null,
  allowed_formats text[]    not null default '{}',
  is_active       boolean   not null default true,
  created_at      timestamptz not null default now()
);

alter table public.document_types enable row level security;

create policy "document_types_select" on public.document_types
  for select
  using (is_platform_owner(auth.uid()) or has_tenant_access(tenant_id));

create policy "document_types_write" on public.document_types
  for all
  using  (is_platform_owner(auth.uid()) or has_tenant_access(tenant_id))
  with check (is_platform_owner(auth.uid()) or has_tenant_access(tenant_id));

-- 6. client_years — one row per client × tax year
create table public.client_years (
  id                uuid                      primary key default gen_random_uuid(),
  tenant_id         uuid                      not null references public.tenants(id) on delete cascade,
  client_id         uuid                      not null references public.office_clients(id) on delete cascade,
  year              integer                   not null,
  accountant_id     uuid                      references auth.users(id) on delete set null,
  contractor_id     uuid                      references auth.users(id) on delete set null,
  accounting_status public.accounting_status  not null default 'in_progress',
  report_status     public.report_status,
  issue_notes       text,
  created_at        timestamptz               not null default now(),
  updated_at        timestamptz               not null default now(),
  unique (tenant_id, client_id, year)
);

alter table public.client_years enable row level security;

create policy "client_years_select" on public.client_years
  for select
  using (is_platform_owner(auth.uid()) or has_tenant_access(tenant_id));

create policy "client_years_write" on public.client_years
  for all
  using  (is_platform_owner(auth.uid()) or has_tenant_access(tenant_id))
  with check (is_platform_owner(auth.uid()) or has_tenant_access(tenant_id));

-- 7. client_year_documents — documents required for a specific client × year
create table public.client_year_documents (
  id                 uuid      primary key default gen_random_uuid(),
  client_year_id     uuid      not null references public.client_years(id) on delete cascade,
  document_type_id   uuid      references public.document_types(id) on delete set null,
  custom_name        text,
  free_text          text,
  allowed_formats    text[],
  is_required        boolean   not null default true,
  client_marked_none boolean   not null default false,
  none_reason        text,
  sort_order         integer   not null default 0,
  created_at         timestamptz not null default now(),
  constraint document_requires_name check (
    document_type_id is not null or custom_name is not null
  )
);

alter table public.client_year_documents enable row level security;

create policy "client_year_documents_select" on public.client_year_documents
  for select
  using (
    exists (
      select 1 from public.client_years cy
      where cy.id = client_year_id
        and (is_platform_owner(auth.uid()) or has_tenant_access(cy.tenant_id))
    )
  );

create policy "client_year_documents_write" on public.client_year_documents
  for all
  using (
    exists (
      select 1 from public.client_years cy
      where cy.id = client_year_id
        and (is_platform_owner(auth.uid()) or has_tenant_access(cy.tenant_id))
    )
  )
  with check (
    exists (
      select 1 from public.client_years cy
      where cy.id = client_year_id
        and (is_platform_owner(auth.uid()) or has_tenant_access(cy.tenant_id))
    )
  );

-- 8. uploaded_files — metadata only; actual files live in Google Drive
create table public.uploaded_files (
  id                          uuid        primary key default gen_random_uuid(),
  client_year_document_id     uuid        not null references public.client_year_documents(id) on delete cascade,
  drive_url                   text        not null,
  original_filename           text        not null,
  file_size_kb                integer,
  uploaded_at                 timestamptz not null default now(),
  ai_status                   text        not null default 'pending'
                                            check (ai_status in ('pending', 'valid', 'invalid')),
  ai_notes                    text,
  accountant_approved         boolean,
  accountant_rejection_reason text
);

alter table public.uploaded_files enable row level security;

create policy "uploaded_files_select" on public.uploaded_files
  for select
  using (
    exists (
      select 1
      from public.client_year_documents cyd
      join public.client_years cy on cy.id = cyd.client_year_id
      where cyd.id = client_year_document_id
        and (is_platform_owner(auth.uid()) or has_tenant_access(cy.tenant_id))
    )
  );

create policy "uploaded_files_write" on public.uploaded_files
  for all
  using (
    exists (
      select 1
      from public.client_year_documents cyd
      join public.client_years cy on cy.id = cyd.client_year_id
      where cyd.id = client_year_document_id
        and (is_platform_owner(auth.uid()) or has_tenant_access(cy.tenant_id))
    )
  )
  with check (
    exists (
      select 1
      from public.client_year_documents cyd
      join public.client_years cy on cy.id = cyd.client_year_id
      where cyd.id = client_year_document_id
        and (is_platform_owner(auth.uid()) or has_tenant_access(cy.tenant_id))
    )
  );

-- 9. tenant_secrets — encrypted per-tenant API keys (WhatsApp, OpenAI, etc.)
-- Only platform_owner and tenant_admin may read or write these.
create table public.tenant_secrets (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  service       text        not null,
  encrypted_key text        not null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  is_active     boolean     not null default true,
  unique (tenant_id, service)
);

alter table public.tenant_secrets enable row level security;

create policy "tenant_secrets_admin_only" on public.tenant_secrets
  for all
  using (
    is_platform_owner(auth.uid())
    or is_tenant_admin(tenant_id)
  )
  with check (
    is_platform_owner(auth.uid())
    or is_tenant_admin(tenant_id)
  );
