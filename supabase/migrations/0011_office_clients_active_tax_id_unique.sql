-- One active client per (tenant, national / company id) when tax_id is set.
create unique index if not exists office_clients_tenant_tax_id_active_unique
  on public.office_clients (tenant_id, tax_id)
  where deleted_at is null and tax_id is not null and length(trim(tax_id)) > 0;
