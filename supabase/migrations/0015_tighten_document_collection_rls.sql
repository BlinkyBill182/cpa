-- Tighten document collection write access.
-- Migration 0012 granted broad tenant-member writes; this restores the DB
-- boundary to match the application roles for annual-income workflows.

create or replace function public.can_manage_document_collection(target_tenant uuid)
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

create or replace function public.enforce_client_year_client_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.office_clients oc
    where oc.id = new.client_id
      and oc.tenant_id = new.tenant_id
  ) then
    raise exception 'client_years client_id must belong to tenant_id'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_client_year_client_tenant on public.client_years;
create trigger enforce_client_year_client_tenant
  before insert or update of tenant_id, client_id
  on public.client_years
  for each row
  execute function public.enforce_client_year_client_tenant();

create or replace function public.enforce_client_year_update_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role'
    or public.is_platform_owner(auth.uid())
    or public.can_manage_document_collection(old.tenant_id)
  then
    return new;
  end if;

  if old.contractor_id = auth.uid() then
    if new.id is distinct from old.id
      or new.tenant_id is distinct from old.tenant_id
      or new.client_id is distinct from old.client_id
      or new.year is distinct from old.year
      or new.accountant_id is distinct from old.accountant_id
      or new.contractor_id is distinct from old.contractor_id
      or new.accounting_status is distinct from old.accounting_status
      or new.created_at is distinct from old.created_at
    then
      raise exception 'contractors may only update report status fields on assigned client years'
        using errcode = '42501';
    end if;

    if new.report_status is null
      or new.report_status in ('ready_for_signature'::public.report_status, 'submitted'::public.report_status)
    then
      raise exception 'contractors may not set this report status'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'not authorized to update client_years'
    using errcode = '42501';
end;
$$;

drop trigger if exists enforce_client_year_update_scope on public.client_years;
create trigger enforce_client_year_update_scope
  before update
  on public.client_years
  for each row
  execute function public.enforce_client_year_update_scope();

drop policy if exists "document_types_write" on public.document_types;

create policy "document_types_insert" on public.document_types
  for insert
  with check (
    public.is_platform_owner(auth.uid())
    or public.is_tenant_admin(tenant_id)
  );

create policy "document_types_update" on public.document_types
  for update
  using (
    public.is_platform_owner(auth.uid())
    or public.is_tenant_admin(tenant_id)
  )
  with check (
    public.is_platform_owner(auth.uid())
    or public.is_tenant_admin(tenant_id)
  );

create policy "document_types_delete" on public.document_types
  for delete
  using (
    public.is_platform_owner(auth.uid())
    or public.is_tenant_admin(tenant_id)
  );

drop policy if exists "client_years_write" on public.client_years;

create policy "client_years_insert" on public.client_years
  for insert
  with check (
    public.is_platform_owner(auth.uid())
    or public.can_manage_document_collection(tenant_id)
  );

create policy "client_years_update" on public.client_years
  for update
  using (
    public.is_platform_owner(auth.uid())
    or public.can_manage_document_collection(tenant_id)
    or contractor_id = auth.uid()
  )
  with check (
    public.is_platform_owner(auth.uid())
    or public.can_manage_document_collection(tenant_id)
    or contractor_id = auth.uid()
  );

create policy "client_years_delete" on public.client_years
  for delete
  using (
    public.is_platform_owner(auth.uid())
    or public.can_manage_document_collection(tenant_id)
  );

drop policy if exists "client_year_documents_write" on public.client_year_documents;

create policy "client_year_documents_insert" on public.client_year_documents
  for insert
  with check (
    exists (
      select 1
      from public.client_years cy
      where cy.id = client_year_id
        and (
          public.is_platform_owner(auth.uid())
          or public.can_manage_document_collection(cy.tenant_id)
          or cy.contractor_id = auth.uid()
        )
    )
  );

create policy "client_year_documents_update" on public.client_year_documents
  for update
  using (
    exists (
      select 1
      from public.client_years cy
      where cy.id = client_year_id
        and (
          public.is_platform_owner(auth.uid())
          or public.can_manage_document_collection(cy.tenant_id)
        )
    )
  )
  with check (
    exists (
      select 1
      from public.client_years cy
      where cy.id = client_year_id
        and (
          public.is_platform_owner(auth.uid())
          or public.can_manage_document_collection(cy.tenant_id)
        )
    )
  );

create policy "client_year_documents_delete" on public.client_year_documents
  for delete
  using (
    exists (
      select 1
      from public.client_years cy
      where cy.id = client_year_id
        and (
          public.is_platform_owner(auth.uid())
          or public.can_manage_document_collection(cy.tenant_id)
        )
    )
  );

drop policy if exists "uploaded_files_write" on public.uploaded_files;
