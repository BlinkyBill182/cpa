# CPA Platform Foundation

This repository contains the first infrastructure baseline for a multi-tenant CPA SaaS:

- Supabase-backed database and authentication
- Owner backoffice route for tenant management
- Tenant-aware schema and row-level security policies
- Locale-based routing (`en`, `he`)

## Stack

- Next.js 16 (App Router, `proxy.ts`)
- TypeScript strict mode
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)
- PostgreSQL migration under `supabase/migrations`

## 1) Configure environment variables

Copy `.env.example` to `.env.local` and set values from your Supabase project:

```bash
cp .env.example .env.local
```

Required keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 2) Apply database migration

Run SQL from `supabase/migrations/0001_multi_tenant_foundation.sql` in your Supabase SQL editor.

After creating your own user in Supabase Auth, mark it as platform owner:

```sql
insert into public.profiles (id, is_platform_owner)
values ('<your-auth-user-id>', true)
on conflict (id) do update
set is_platform_owner = excluded.is_platform_owner;
```

## 3) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`, then use:

- `/en/login` for authentication
- `/en/owner/tenants` for owner tenant management
- `/en/office` as the protected office area placeholder

## Current foundation scope

- Multi-tenant base entities (`tenants`, `tenant_memberships`, `office_clients`, `seasonal_income_records`)
- Owner-vs-tenant access boundaries using RLS policies
- Login flow with Supabase password auth
- Owner-only tenant creation flow

Next implementation step is tenant employee management and tenant-scoped office client workflows.
