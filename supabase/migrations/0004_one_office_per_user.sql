-- Enforce that each user can belong to at most one CPA office.
-- The existing unique constraint is on (tenant_id, user_id).
-- This adds a unique constraint on user_id alone.

ALTER TABLE public.tenant_memberships
  ADD CONSTRAINT tenant_memberships_one_office_per_user UNIQUE (user_id);
