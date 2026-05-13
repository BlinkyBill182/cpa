-- =============================================================================
-- Development seed — local environment only
-- DO NOT use these credentials in production
--
-- Users                    Password
--   owner@test.example   → cpa123  (Platform Owner — Ben)
--   admin@cohen-cpa.dev  → cpa123  (Tenant Admin   — cohen-cpa)
--   manager@cohen-cpa.dev→ cpa123  (Manager        — cohen-cpa)
--   staff@cohen-cpa.dev  → cpa123  (Staff member   — cohen-cpa)
-- =============================================================================

-- ── Auth users ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  instance_id,
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role, aud,
    confirmation_token, recovery_token,
  email_change_token_new, email_change,
  phone_change, phone_change_token,
  email_change_token_current, email_change_confirm_status
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'owner@test.example',
    crypt('cpa123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ben Cohen"}',
    false, 'authenticated', 'authenticated',
    '', '', '', '', '', '', '', 0
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'admin@cohen-cpa.dev',
    crypt('cpa123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Cohen Admin"}',
    false, 'authenticated', 'authenticated',
    '', '', '', '', '', '', '', 0
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'manager@cohen-cpa.dev',
    crypt('cpa123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Cohen Manager"}',
    false, 'authenticated', 'authenticated',
    '', '', '', '', '', '', '', 0
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000004',
    'staff@cohen-cpa.dev',
    crypt('cpa123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Cohen Staff"}',
    false, 'authenticated', 'authenticated',
    '', '', '', '', '', '', '', 0
  )
ON CONFLICT (id) DO UPDATE SET
  email                    = EXCLUDED.email,
  encrypted_password       = EXCLUDED.encrypted_password,
  raw_user_meta_data       = EXCLUDED.raw_user_meta_data,
  confirmation_token         = EXCLUDED.confirmation_token,
  recovery_token             = EXCLUDED.recovery_token,
  email_change_token_new     = EXCLUDED.email_change_token_new,
  email_change               = EXCLUDED.email_change,
  phone_change               = EXCLUDED.phone_change,
  phone_change_token         = EXCLUDED.phone_change_token,
  email_change_token_current = EXCLUDED.email_change_token_current;

-- ── Auth identities (required for email login in Supabase v2) ─────────────────

INSERT INTO auth.identities (
  id, user_id, provider, provider_id, identity_data,
  last_sign_in_at, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'email', 'owner@test.example',
    '{"sub":"00000000-0000-0000-0000-000000000001","email":"owner@test.example"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'email', 'admin@cohen-cpa.dev',
    '{"sub":"00000000-0000-0000-0000-000000000002","email":"admin@cohen-cpa.dev"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    'email', 'manager@cohen-cpa.dev',
    '{"sub":"00000000-0000-0000-0000-000000000003","email":"manager@cohen-cpa.dev"}',
    now(), now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004',
    'email', 'staff@cohen-cpa.dev',
    '{"sub":"00000000-0000-0000-0000-000000000004","email":"staff@cohen-cpa.dev"}',
    now(), now(), now()
  )
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ── Profiles ──────────────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, full_name, is_platform_owner) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Ben Cohen',      true),
  ('00000000-0000-0000-0000-000000000002', 'Cohen Admin',    false),
  ('00000000-0000-0000-0000-000000000003', 'Cohen Manager',  false),
  ('00000000-0000-0000-0000-000000000004', 'Cohen Staff',    false)
ON CONFLICT (id) DO UPDATE SET
  full_name         = EXCLUDED.full_name,
  is_platform_owner = EXCLUDED.is_platform_owner;

-- ── Sample tenant ─────────────────────────────────────────────────────────────

INSERT INTO public.tenants (id, name, slug, created_by) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Cohen CPA', 'cohen-cpa', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ── Tenant memberships ────────────────────────────────────────────────────────

INSERT INTO public.tenant_memberships (tenant_id, user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'tenant_admin'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000003', 'manager'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000004', 'staff')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ── Sample office clients ─────────────────────────────────────────────────────

INSERT INTO public.office_clients (tenant_id, name, tax_id) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Goldberg Ltd',  '123456789'),
  ('00000000-0000-0000-0000-000000000010', 'Levi Holdings', '987654321'),
  ('00000000-0000-0000-0000-000000000010', 'Mizrahi Group', '555444333')
ON CONFLICT DO NOTHING;
