# CPA SaaS Platform — Claude Code Guide

Full project context: @CONTEXT.md

---

## Critical Rules (read before any change)

- **i18n first** — no hardcoded user-facing strings. Add keys to both `src/i18n/dictionaries/en.json` and `he.json`.
- **No top-level `process.env`** — use `getPublicSupabaseEnv()` / `getServerSupabaseEnv()` from `src/lib/supabase/env.ts`.
- **Audit everything** — every state-changing server action must call `logAuditEvent()`.
- **RLS is the real boundary** — application guards (`requireUser`, etc.) are a UX layer, not security. DB policies enforce access.
- **`server-only`** — import it at the top of any file that must never run in the browser (`admin.ts`, `audit.ts`, `invitations.ts`, etc.).
- **Zod for all inputs** — validate server action form data with Zod before touching the database.
- **TypeScript strict** — no `any`, no `@ts-ignore` without an explanatory comment.
- **Update CONTEXT.md** — after any non-trivial change, update the relevant section of `CONTEXT.md`.
- **Keep Notion in sync** — when routes, guards/roles, env vars, migrations/RLS, or tenant-level features materially change for operators, update the CPA pages under **Projects → CPA** (e.g. **Project Overview**, **Environment Variables**, **Role Permissions**). Use Notion MCP in Cursor in the **same workflow** as code/CONTEXT updates.

## Route overview

```
/[locale]/backoffice/tenants                                         → Platform owner: list/create tenants (STATIC)
/[locale]/backoffice/tenants/[id]/members                            → Platform owner: manage tenant members (STATIC)
/[locale]/backoffice/document-types                                  → Platform owner: manage global document types (STATIC)
/[locale]/[slug]                                                     → Public client portal (no auth) (DYNAMIC)
/[locale]/[slug]/backoffice                                          → CPA office backoffice (DYNAMIC)
/[locale]/[slug]/backoffice/team                                     → CPA office team management (DYNAMIC)
/[locale]/[slug]/backoffice/document-types                           → Standard document library — admin only (DYNAMIC)
/[locale]/[slug]/annual-income                                       → Office-wide annual income dashboard; auto-creates client_years on load (DYNAMIC)
/[locale]/[slug]/clients/[clientId]/actions/annual-income-summary    → Per-client doc collection detail; accessed from annual-income dashboard (DYNAMIC)
/upload/[token]                                                      → Client upload portal — isolated (client-portal) route group, NO auth/lang
                                                                        token = HS256 JWT (90-day) with clientYearId as `sub`; invalid/expired → Hebrew error screen
                                                                        sign: signUploadToken(id) · verify: verifyUploadToken(token) in src/lib/upload-token.ts
```

Static routes always win over `[slug]`. Reserved slugs (`backoffice`, `login`, `auth`, `api`, `admin`, `en`, `he`) are blocked at tenant creation time.

## Session guards quick reference

```ts
await requireUser(locale)                              // any authenticated user
await requirePlatformOwner(locale)                     // platform owner only
await requireTenantAccessBySlug(locale, slug)          // any tenant member: admin | manager | staff | reviewer | contractor
await requireTenantAdminBySlug(locale, slug)           // tenant_admin only
await requireTenantManagerOrAdminBySlug(locale, slug)  // manager or admin (blocks staff, reviewer, contractor)
```

## Running the project

```bash
nvm use              # Node 22
npm run dev          # Webpack dev server (not Turbopack)
npm run build        # Production build check
npm run test:unit    # Vitest unit tests (no secrets needed)
npm run test:integration  # Needs .env.test
npm run test:e2e     # Needs .env.test + running app
```

## Active Supabase project

Production project ref: `dafyhdjcpaqksjdciipb`  
Test project ref: `otvichurcbmevysnsxkn`  
Never run integration tests against the production project.
