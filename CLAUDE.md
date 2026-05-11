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
