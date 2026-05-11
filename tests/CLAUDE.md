# tests/ — Testing Conventions

## Three layers

| Folder | Tool | Needs secrets |
|---|---|---|
| `unit/` | Vitest | No |
| `integration/` | Vitest | Yes — `.env.test` |
| `e2e/` | Playwright | Yes — `.env.test` + running app |

## Global mocks (`tests/setup.ts`)

Already mocked for all tests: `server-only`, `next/headers`, `next/navigation`, `next/cache`.

## Integration test rules

- `vi.mock(...)` must be at the **top level** of the file — Vitest hoists them before any test runs.
- Use `vi.mocked(fn).mockResolvedValue(...)` inside `beforeEach` or individual tests to control per-test behavior.
- Call `vi.clearAllMocks()` in `afterEach`.
- Use `tests/helpers/supabase.ts` to create/delete test users and seed data.
- Use `tests/helpers/redirect.ts` to assert that session guards redirected correctly (`expectRedirectTo(error, "tenant_access")`).
- Always clean up created DB rows in `afterEach` — use unique slug/email prefixes based on `Date.now()`.

## Integration test env

The integration Vitest config maps `TEST_SUPABASE_*` → `NEXT_PUBLIC_SUPABASE_*` automatically, so app code under test resolves the correct project. You only need `TEST_*` vars in `.env.test`.

## E2E test rules

- Skip tests that need credentials using `test.skip(!EMAIL || !PASSWORD, "reason")`.
- Clean up any DB rows created during E2E tests in `test.afterAll`.
- Use `page.getByRole(...)` and `page.getByLabel(...)` — avoid CSS selectors.
- After owner login, `signInAsOwner` waits for `/en/backoffice/tenants` (smart redirect destination for platform owners).
- Tenant backoffice URLs follow the pattern `/en/{slug}/backoffice` — use the tenant's slug, not its UUID.
