-- Allow unauthenticated visitors to read tenant name and slug.
-- This is needed for the public office portal and the per-office login page.
create policy "tenants_public_read"
  on public.tenants
  for select
  using (true);
