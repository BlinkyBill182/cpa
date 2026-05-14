-- Restrict public tenant listing to unauthenticated requests only.
-- Logged-in users still use existing member/owner policies (no cross-tenant enumeration).
drop policy if exists "tenants_public_read" on public.tenants;

create policy "tenants_public_read"
  on public.tenants
  for select
  using (auth.uid() is null);
