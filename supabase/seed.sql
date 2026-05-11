-- =============================================================================
-- Development seed — local environment only
-- Creates a platform owner and a sample tenant with members
-- DO NOT use these credentials in production
-- =============================================================================

-- Platform owner
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'owner@local.dev',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Platform Owner"}',
  false,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Tenant admin for "Cohen CPA"
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  'admin@cohen-cpa.dev',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Cohen Admin"}',
  false,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Staff member for "Cohen CPA"
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '00000000-0000-0000-0000-000000000003',
  'staff@cohen-cpa.dev',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Cohen Staff"}',
  false,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Profiles (trigger handles new signups, but seed users bypass the trigger)
INSERT INTO public.profiles (id, full_name, is_platform_owner) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Platform Owner', true),
  ('00000000-0000-0000-0000-000000000002', 'Cohen Admin',    false),
  ('00000000-0000-0000-0000-000000000003', 'Cohen Staff',    false)
ON CONFLICT (id) DO NOTHING;

-- Sample tenant
INSERT INTO public.tenants (id, name, slug, created_by) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Cohen CPA', 'cohen-cpa', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Tenant memberships
INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'tenant_admin'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', 'staff')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Sample office clients
INSERT INTO public.office_clients (tenant_id, name, tax_id) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Goldberg Ltd',   '123456789'),
  ('00000000-0000-0000-0000-000000000010', 'Levi Holdings',  '987654321'),
  ('00000000-0000-0000-0000-000000000010', 'Mizrahi Group',  '555444333')
ON CONFLICT DO NOTHING;
