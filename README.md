# CPA Platform

A multi-tenant SaaS platform for CPA offices. Each office (tenant) gets its own backoffice for managing staff and clients. The platform owner has a separate backoffice to manage all tenants.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript strict |
| Database / Auth | Supabase (PostgreSQL + GoTrue) |
| Styling | Tailwind CSS 4 |
| Validation | Zod 4 |
| i18n | `en` / `he` locale routing |
| Tests | Vitest (unit + integration) + Playwright (E2E) |
| CI | GitHub Actions |

## Routes

| URL | Purpose |
|---|---|
| `/{locale}/login` | Login (password + magic link) |
| `/{locale}/backoffice/tenants` | Platform owner: manage all offices |
| `/{locale}/backoffice/tenants/{id}/members` | Platform owner: manage office members |
| `/{locale}/{slug}` | Public client portal for a CPA office |
| `/{locale}/{slug}/backoffice` | CPA office staff backoffice |
| `/{locale}/{slug}/backoffice/team` | CPA office team management |

## Access hierarchy

```
Platform Owner                → profiles.is_platform_owner = true
└── tenant_admin              → manages team members and office settings
    └── manager               → operational access
        └── staff             → standard employee access
            └── reviewer      → read-only access
```

The platform owner is a single super-admin (the developer / business operator) who can access every tenant's backoffice without being a member. Tenant roles are scoped per office and stored in `tenant_memberships.role`.

---

## Setup

### 1. Node version

```bash
nvm use   # pins to Node 22 via .nvmrc
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in the values from your Supabase project dashboard:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → Publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → Secret key |
| `NEXT_PUBLIC_SITE_URL` | Your app's public URL (e.g. `http://localhost:3000`) |

### 4. Apply database migrations

Run each file in `supabase/migrations/` in order via the Supabase SQL editor, then mark your user as platform owner:

```sql
insert into public.profiles (id, is_platform_owner)
values ('<your-auth-user-id>', true)
on conflict (id) do update set is_platform_owner = excluded.is_platform_owner;
```

### 5. Install local git hooks

The repository ships a post-commit code review hook. Install it once after cloning:

```bash
ln -sf "$(pwd)/.cursor/hooks/git-post-commit.sh" .git/hooks/post-commit
chmod +x .cursor/hooks/git-post-commit.sh
```

After every `git commit` the terminal will display the changed files and copy a formatted code review prompt to your clipboard. Paste it into Cursor to run an AI review against the project conventions.

### 6. Run the app

```bash
npm run dev
```

Open `http://localhost:3000` and sign in at `/en/login`.

---

## Testing

```bash
npm run test:unit          # Vitest unit tests — no secrets needed
npm run test:integration   # Vitest integration tests — needs .env.test
npm run test:e2e           # Playwright E2E — needs .env.test + running app
npm run test:coverage      # Unit tests with V8 coverage report
```

Copy `.env.test.example` to `.env.test` and fill in a dedicated test Supabase project (never use the production project for tests).

---

## Project documentation

Full architecture, conventions, DB schema, and session guard reference:

- [`CONTEXT.md`](./CONTEXT.md) — full project context for AI agents and developers
- [`CLAUDE.md`](./CLAUDE.md) — quick-reference guide for Claude Code
