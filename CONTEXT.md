# Project Context — CPA SaaS Platform

> **For AI agents**: Read this file before making any changes. It describes the full architecture, conventions, data model, and current implementation state. Updating this file is part of every non-trivial task.

---

## 1. Business Purpose

A **multi-tenant SaaS platform** for a business that provides software services to CPA (Certified Public Accountant) offices in Israel.

- The **platform owner** (the developer / business operator) has a private back-office to manage all client tenants.
- Each **CPA office** is a tenant with its own back-office for managing its own employees and clients.
- Planned features include: seasonal income management, client file uploads, email/WhatsApp notifications, CRON jobs, and Google Sheets integration — all controlled in-house (no Make.com / n8n).

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Database / Auth | Supabase (PostgreSQL + GoTrue auth) |
| Validation | Zod 4 |
| i18n | Locale-based routing (`en`, `he`) with JSON dictionaries |
| Unit / Integration tests | Vitest 4 |
| E2E tests | Playwright |
| CI | GitHub Actions |
| Node version | 22 (`.nvmrc`) |
| Dev bundler | Webpack (`next dev --webpack`) — Turbopack disabled due to macOS worker-spawning issue |

---

## 3. Repository Structure

```
cpa/
├── src/
│   ├── app/
│   │   ├── [lang]/                     # All user-facing pages, locale-scoped
│   │   │   ├── layout.tsx              # Root localized layout (includes TopNav)
│   │   │   ├── page.tsx                # Home page — role-aware links
│   │   │   ├── login/
│   │   │   │   ├── page.tsx            # Login UI (password + magic link)
│   │   │   │   └── actions.ts          # signInAction (smart redirect), sendMagicLinkAction
│   │   │   ├── backoffice/             # Platform owner area (STATIC route — takes priority over [slug])
│   │   │   │   └── tenants/
│   │   │   │       ├── page.tsx        # Platform owner: list/create tenants
│   │   │   │       ├── actions.ts      # createTenantAction (validates reserved slugs)
│   │   │   │       └── [tenantId]/
│   │   │   │           ├── members/
│   │   │   │           │   ├── page.tsx    # Owner: manage members of a tenant
│   │   │   │           │   └── actions.ts  # assignMemberByUserIdAction
│   │   │   │           └── actions/
│   │   │   │               ├── page.tsx    # Owner: enable/disable actions per tenant
│   │   │   │               └── actions.ts  # toggleActionAction
│   │   │   └── [slug]/                 # DYNAMIC route — CPA office identified by slug
│   │   │       ├── page.tsx            # Public client portal (no auth required)
│   │   │       └── backoffice/
│   │   │           ├── page.tsx        # Tenant backoffice dashboard
│   │   │           ├── team/
│   │   │           │   ├── page.tsx    # Tenant admin: manage team members
│   │   │           │   └── actions.ts  # inviteMemberAction, removeMemberAction, updateMemberRoleAction
│   │   │           └── clients/
│   │   │               ├── page.tsx                        # Client list for the office
│   │   │               └── [clientId]/
│   │   │                   ├── page.tsx                    # Client detail + action marketplace
│   │   │                   └── actions/[actionKey]/
│   │   │                       └── page.tsx                # Action execution page (stub)
│   │   ├── auth/
│   │   │   └── callback/route.ts       # Supabase auth callback (magic link, invites)
│   │   ├── layout.tsx                  # Root layout (suppressHydrationWarning on body)
│   │   └── page.tsx                    # Root redirect → /en
│   ├── components/
│   │   ├── auth/login-form.tsx         # Reusable email/password form
│   │   └── layout/top-nav.tsx          # Navigation bar
│   ├── i18n/
│   │   ├── config.ts                   # locales, defaultLocale, hasLocale()
│   │   ├── get-dictionary.ts           # Server-only dictionary loader
│   │   └── dictionaries/
│   │       ├── en.json
│   │       └── he.json
│   ├── lib/
│   │   ├── actions/
│   │   │   ├── types.ts                # ActionDefinition interface, ActionDictNamespace union
│   │   │   ├── registry.ts             # getAllActions(), getAction(key), getActionsForTenant(slug)
│   │   │   └── definitions/
│   │   │       ├── annual-income-summary/definition.ts
│   │   │       ├── document-request/definition.ts
│   │   │       ├── tax-reminder/definition.ts
│   │   │       └── client-report/definition.ts   # office-specific example
│   │   ├── auth/
│   │   │   ├── audit.ts                # logAuditEvent() — writes to audit_logs
│   │   │   ├── constants.ts            # ACTIVE_TENANT_COOKIE, tenantRoles, TenantRole
│   │   │   ├── invitations.ts          # syncPendingInvitations(user) → { count, firstSlug }
│   │   │   ├── session.ts              # requireUser, requirePlatformOwner, requireTenantAccessBySlug, requireTenantAdminBySlug
│   │   │   └── tenant-context.ts       # setActiveTenant, getActiveTenant, clearActiveTenant (cookie helpers)
│   │   └── supabase/
│   │       ├── admin.ts                # Service-role client (bypasses RLS)
│   │       ├── client.ts               # Browser client (anon key)
│   │       ├── database.types.ts       # TypeScript types inferred from DB schema
│   │       ├── env.ts                  # Zod-validated env getters (lazy, avoids build-time errors)
│   │       └── server.ts               # Server client with cookie handling (for SSR/actions)
│   └── proxy.ts                        # Next.js middleware: locale redirect + path protection
├── supabase/
│   └── migrations/
│       ├── 0001_multi_tenant_foundation.sql
│       ├── 0002_tenant_member_invites.sql
│       ├── 0003_auto_profile_on_signup.sql
│       └── 0004_tenant_access_requests.sql
├── tests/
│   ├── setup.ts                        # Global mocks: server-only, next/headers, next/navigation, next/cache
│   ├── helpers/
│   │   ├── redirect.ts                 # parseRedirect(), expectRedirectTo()
│   │   └── supabase.ts                 # createTestUser, deleteTestUser, signInTestUser, getTestAdmin, etc.
│   ├── unit/
│   │   ├── i18n/has-locale.test.ts
│   │   ├── auth/constants.test.ts
│   │   └── actions/schemas.test.ts
│   ├── integration/
│   │   ├── auth/sync-invitations.test.ts
│   │   ├── auth/session-guards.test.ts
│   │   └── rls/tenant-isolation.test.ts
│   └── e2e/
│       ├── auth.spec.ts
│       └── tenant-management.spec.ts
├── .github/workflows/ci.yml            # CI: unit → integration + build → e2e (main only)
├── .env.example                        # Template for production env vars
├── .env.test.example                   # Template for test env vars
├── vitest.config.ts                    # Unit test config
├── vitest.integration.config.ts        # Integration test config (maps TEST_* → NEXT_PUBLIC_*)
├── playwright.config.ts                # E2E test config
└── CONTEXT.md                          # This file
```

---

## 4. Database Schema

All tables live in the `public` schema with RLS enabled. Migrations are in `supabase/migrations/` and must be applied in order.

### Tables

| Table | Purpose |
|---|---|
| `profiles` | One row per Supabase auth user. `is_platform_owner` flags the SaaS owner. Auto-created by trigger on signup. |
| `tenants` | Each CPA office. Has `name`, `slug` (unique), `created_by`. |
| `tenant_memberships` | Junction: `user_id` ↔ `tenant_id` with a `role`. Unique per pair. |
| `tenant_invitations` | Pending email invites. `status`: `pending` → `accepted`. Resolved in `/auth/callback`. |
| `tenant_access_requests` | Self-service access requests from office login page. `status`: `pending` → `approved`/`rejected`. `role` is set at approval time. |
| `office_clients` | CPA office's end-clients. Scoped to `tenant_id`. |
| `seasonal_income_records` | Per-client annual income data. Scoped to `tenant_id`. |
| `office_action_configs` | Which actions are enabled per CPA office. Unique `(tenant_id, action_key)`. Platform owner writes; tenant members read. |
| `workflow_runs` | Reserved for future automation/CRON tracking. |
| `audit_logs` | Immutable event log. Written via `logAuditEvent()`. Never mutated. |

### RLS Policy Summary

- **`profiles`**: Users read/update only their own row.
- **`tenants`**: Platform owner sees all. Members see only tenants they belong to.
- **`tenant_memberships`**: Members see their own memberships. `tenant_admin` manages their tenant. Platform owner manages all.
- **`tenant_invitations`**: `tenant_admin` creates invites for their tenant. Platform owner sees all.
- **`tenant_access_requests`**: Inserted via admin client (no INSERT policy needed). `tenant_admin` and platform owner can SELECT/UPDATE. Pending requests shown in team management page.
- **`office_clients`, `seasonal_income_records`**: Tenant members only see rows for their own tenant.
- **`office_action_configs`**: Platform owner has full CRUD. Tenant members read-only for their own tenant.
- **`audit_logs`**: Insert-only for authenticated users; no update/delete.

### Helper DB Functions

- `is_platform_owner(uid uuid)` — returns `true` if the given user has `profiles.is_platform_owner = true`; called as `is_platform_owner(auth.uid())` in RLS policies
- `has_tenant_access(tid uuid)` — returns `true` if the calling user has a row in `tenant_memberships` for `tid`
- `is_tenant_admin(tid uuid)` — returns `true` if the calling user has `role = 'tenant_admin'` for `tid`

---

## 5. Authentication & Authorization

### Auth flow

1. User visits `/[lang]/login` (platform) or `/[lang]/[slug]/login` (office-specific) and signs in.
2. Magic links and invite links redirect to `/auth/callback/route.ts`.

#### Office-specific access request flow

1. User visits `/{locale}/{slug}/login`, enters email, clicks "Send magic link".
2. Server creates a `tenant_access_requests` record (status=pending) and sends a magic link with `?slug=&locale=` encoded in the callback URL.
3. Admin reviews pending requests in `/{slug}/backoffice/team`, picks a role, and approves.
   - If the user already has an account: membership is created immediately.
   - If not yet: the role is stored on the request record.
4. User clicks the magic link → `/auth/callback` runs:
   - If membership exists → redirected to backoffice.
   - If `approved` request found → membership created on the spot → redirected to backoffice.
   - If still `pending` → redirected to `/{slug}/login?status=pending`.
3. Callback exchanges the code for a session, then calls `syncPendingInvitations(user)`.
4. If invitations were resolved, user is redirected to `/{locale}/{slug}/backoffice`; otherwise to `/{locale}`.
5. Password login (`signInAction`) reads role/memberships after sign-in and redirects:
   - Platform owner → `/{locale}/backoffice/tenants`
   - Tenant member → `/{locale}/{slug}/backoffice` (first tenant)
   - No tenant → `/{locale}` (home)

### Route structure

| URL pattern | Purpose |
|---|---|
| `/{locale}` | Home — role-aware links |
| `/{locale}/login` | Login page |
| `/{locale}/backoffice/tenants` | Platform owner: manage all tenants |
| `/{locale}/backoffice/tenants/{tenantId}/members` | Platform owner: manage tenant members |
| `/{locale}/{slug}` | Public client portal for a CPA office (no auth) |
| `/{locale}/{slug}/login` | Office-specific login + self-service access request |
| `/{locale}/{slug}/backoffice` | CPA office backoffice dashboard |
| `/{locale}/{slug}/backoffice/team` | CPA office team management |

Next.js gives static segments (`backoffice`) priority over the dynamic `[slug]` segment, so `/en/backoffice/...` is always the platform-owner area.

### Reserved slugs

The following slugs are blocked from tenant creation (they conflict with static routes):  
`backoffice`, `login`, `auth`, `api`, `admin`, `en`, `he`

### Session guards (`src/lib/auth/session.ts`)

| Guard | Redirect on failure |
|---|---|
| `requireUser(locale)` | `/{locale}/login` |
| `requirePlatformOwner(locale)` | `/{locale}` |
| `requireTenantAccessBySlug(locale, slug)` | 404 if slug unknown; `/{locale}?error=tenant_access` if not a member |
| `requireTenantAdminBySlug(locale, slug)` | `/{locale}/{slug}/backoffice?error=forbidden` |

### Roles

Platform-scoped (stored in `profiles.is_platform_owner`):
- `platform_owner` — full control over all tenants

Tenant-scoped (stored in `tenant_memberships.role`):
- `tenant_admin` — manages team members, invites, and office settings
- `manager` — operational access
- `staff` — standard employee access
- `reviewer` — read-only access

---

## 6. i18n

- Supported locales: `en`, `he` (Hebrew is the primary market language)
- Default locale: `en`
- All routes are prefixed: `/en/...`, `/he/...`
- Dictionary files: `src/i18n/dictionaries/{locale}.json`
- **Rule**: Never hardcode user-facing strings. Always add keys to both dictionaries.
- The `src/proxy.ts` middleware handles locale detection and redirects.

---

## 7. Key Conventions

- **No hardcoded strings** — all UI text goes through the i18n dictionary.
- **No top-level `process.env` access** — use `getPublicSupabaseEnv()` / `getServerSupabaseEnv()` from `src/lib/supabase/env.ts` to avoid build-time evaluation errors.
- **`server-only`** is imported in all files that must never run client-side (`audit.ts`, `invitations.ts`, `admin.ts`, `server.ts`, `get-dictionary.ts`).
- **Audit everything** — all state-changing actions call `logAuditEvent()` with a namespaced action string (e.g. `tenant.created`, `tenant.member.invited`).
- **RLS is the security boundary** — never rely solely on application-level guards. Every table has RLS policies.
- **Zod for all external inputs** — server actions validate with Zod before touching the database.
- **TypeScript strict mode** is enabled. No `any`, no `@ts-ignore` without a comment explaining why.

---

## 8. Environment Variables

### Production / Development (`.env.local`)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, bypasses RLS) |
| `NEXT_PUBLIC_SITE_URL` | Full public URL of the app (e.g. `https://cpa.yourdomain.com`) |

### Test (`.env.test`) — gitignored, see `.env.test.example`

| Variable | Purpose |
|---|---|
| `TEST_SUPABASE_URL` | Dedicated test Supabase project URL |
| `TEST_SUPABASE_ANON_KEY` | Test project anon key |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Test project service role key |
| `E2E_OWNER_EMAIL` | Platform owner user email in test project |
| `E2E_OWNER_PASSWORD` | Platform owner user password in test project |

The integration test config (`vitest.integration.config.ts`) automatically maps `TEST_*` → `NEXT_PUBLIC_*` so the app code under test resolves correctly.

---

## 9. Testing

### Commands

```bash
npm run test:unit           # Vitest unit tests — no external deps, <1s
npm run test:integration    # Vitest integration tests — needs .env.test
npm run test:e2e            # Playwright E2E — needs .env.test + running app
npm run test:coverage       # Unit tests with V8 coverage report
```

### Layers

| Layer | Location | What it tests |
|---|---|---|
| Unit | `tests/unit/` | i18n helpers, auth constants, Zod validation schemas |
| Integration | `tests/integration/` | `syncPendingInvitations`, session guards, RLS tenant isolation — against real test Supabase |
| E2E | `tests/e2e/` | Login flow, protected route redirects, locale routing, tenant creation, office portal |

### Mocking strategy

- `tests/setup.ts` globally mocks `server-only`, `next/headers`, `next/navigation`, `next/cache`.
- `vi.mock(...)` calls must be at the **top level** of the test file (Vitest hoists them).
- Integration tests mock `@/lib/supabase/server` and inject real authenticated clients via `Authorization: Bearer <token>` headers.
- The `tests/helpers/redirect.ts` helper converts redirects (thrown as errors) into assertable strings.

### CI Pipeline (`.github/workflows/ci.yml`)

```
push / PR
  └─ unit (always, fast)
       ├─ integration (parallel with build)
       └─ build
            └─ e2e (main branch only, reuses build artifact)
```

Required GitHub Secrets: `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`.

---

## 10. Action System

The client action marketplace lets staff run configurable operations on individual clients.

### Architecture

- **Action definitions live in code** (`src/lib/actions/definitions/`). Each definition is an `ActionDefinition` object with a unique `key`, `icon`, `dictNamespace`, and optional `officeSpecific` slug list.
- **Registry** (`src/lib/actions/registry.ts`) exports `getAllActions()`, `getAction(key)`, and `getActionsForTenant(slug)`. Adding a new action is a pure code change — no DB migration needed.
- **`office_action_configs` table** stores which actions are enabled per office. The platform owner toggles this from `/backoffice/tenants/{id}/actions`.
- **Marketplace UI** at `/{slug}/backoffice/clients/{clientId}` shows a card grid of enabled actions for the office (filtered by both DB config and `officeSpecific`).
- **Execution pages** at `/{slug}/backoffice/clients/{clientId}/actions/{actionKey}` — currently stubs; real logic is added per action as it is built.

### Adding a new action

1. Create `src/lib/actions/definitions/{action-key}/definition.ts` exporting an `ActionDefinition`.
2. Add the definition to the array in `src/lib/actions/registry.ts`.
3. Add `actions.{camelCaseKey}.title` and `.description` to both `en.json` and `he.json`, and add the namespace to the `ActionDictNamespace` union in `types.ts`.
4. Build the execution page at `src/app/[lang]/[slug]/backoffice/clients/[clientId]/actions/{action-key}/page.tsx`.
5. Platform owner enables the action per office via the UI.

### Office-specific actions

Set `officeSpecific: ["office-slug"]` in the definition. The action will only appear in the registry results for matching offices and will be marked with an "Office-specific" badge in the platform owner toggle UI.

---

## 11. Known Decisions & Trade-offs

| Decision | Reason |
|---|---|
| Webpack dev bundler instead of Turbopack | Turbopack spawns many worker processes on macOS, triggering `MallocStackLogging` system warnings that slow down the laptop. |
| `syncPendingInvitations` only in `/auth/callback` | Moved from `requireUser()` (ran on every authenticated page load) to the callback to avoid redundant DB queries. |
| `suppressHydrationWarning` on `<body>` | Grammarly and similar browser extensions inject attributes that cause React hydration mismatches. |
| Lazy env getters (`getPublicSupabaseEnv`) | Calling `process.env` at module evaluation time causes Next.js build failures. Lazy getters defer access until runtime. |
| Separate test Supabase project | Never run integration/E2E tests against the production database. |
| E2E only on `main` in CI | E2E tests are slow and require a running server. PRs get unit + integration + build checks which catch the majority of regressions. |
| Slug-based routing for tenant backoffice (`/[slug]/backoffice`) | Bookmarkable, shareable URLs. No need for a cookie or session-level tenant selector. Each CPA office has its own unique URL. |
| Static `backoffice` segment takes priority over `[slug]` | Next.js always matches static segments before dynamic ones, so `/en/backoffice` unambiguously routes to the platform-owner area. |

---

## 12. What Is Not Yet Built

- Actual execution logic for individual actions (all action execution pages are stubs)
- Seasonal income management feature (data entry, Google Sheets import)
- Client file upload page
- Email notifications (transactional)
- WhatsApp notifications
- CRON jobs / scheduled tasks
- Dashboard / analytics views
- Billing / subscription management
- Production deployment configuration (Vercel / custom)
