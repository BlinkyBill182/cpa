-- Allow authenticated users to read their own access requests (match auth.users email).
-- Needed for office login flow after sign-in when user has no membership yet.
create policy "tenant_access_requests_select_own"
on public.tenant_access_requests
for select
using (
  auth.uid() is not null
  and lower(trim(email)) = lower(trim((select u.email::text from auth.users u where u.id = auth.uid())))
);
