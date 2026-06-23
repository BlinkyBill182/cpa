# src/ — Next.js App Router Conventions

## Server vs Client

- Pages and layouts are **Server Components** by default — no `"use client"` unless you need browser APIs or state.
- Data mutations go in `actions.ts` files next to the page, marked `"use server"`.
- Never call a server action from another server action — extract shared logic into `src/lib/`.

## Route structure

| Pattern | Area | Notes |
|---|---|---|
| `/[lang]/backoffice/...` | Platform owner | Static segment — always takes priority over `[slug]` |
| `/[lang]/[slug]/backoffice/...` | CPA office staff | `slug` identifies the tenant from the URL |
| `/[lang]/[slug]/backoffice/document-types` | Office document library | Admin-only; manage standard document types |
| `/[lang]/[slug]/clients/[clientId]/actions/annual-income-summary` | Annual doc collection | Static route overrides `[actionKey]`; full 7-step workflow |
| `/[lang]/[slug]` | Public client portal | No auth required |
| `/upload/[token]` | Client upload portal | Public, JWT-gated (Phase 2); token tied to client_year_id, 90-day expiry |

## Route protection

Always guard pages with the appropriate session helper at the top:

```ts
const user = await requireUser(lang);
const user = await requirePlatformOwner(lang);

// Slug comes from URL params — pass it directly:
const { user, tenant, role } = await requireTenantAccessBySlug(lang, slug);
const { user, tenant, role } = await requireTenantAdminBySlug(lang, slug);
```

`requireTenantAccessBySlug` calls `notFound()` if the slug doesn't match any tenant, and redirects to `/{locale}?error=tenant_access` if the user is not a member. Never use the old cookie-based `requireTenantAccess` — it no longer exists.

## i18n

Pages under `[lang]/[slug]/...` receive both params:

```ts
const { lang, slug } = await params;
const dict = await getDictionary(lang);
```

Never use raw strings in JSX — always `dict.some.key`. Add every new key to **both** `en.json` and `he.json`.

### Current top-level dict namespaces

| Key | Used by |
|---|---|
| `app` | App name |
| `nav` | TopNav |
| `home` | Home page |
| `login` | Login page and actions |
| `ownerTenants` | `/backoffice/tenants` |
| `ownerMembers` | `/backoffice/tenants/[id]/members` and `/[slug]/backoffice/team` |
| `tenantBackoffice` | `/[slug]/backoffice` |
| `documentTypes` | `/[slug]/backoffice/document-types` |
| `actions.annualIncomeSummary` | `/[slug]/clients/[clientId]/actions/annual-income-summary` |

## Supabase clients

| Context | Import |
|---|---|
| Server component / action | `createSupabaseServerClient()` from `@/lib/supabase/server` |
| Admin / service role | `createSupabaseAdminClient()` from `@/lib/supabase/admin` |
| Browser component | `createSupabaseBrowserClient()` from `@/lib/supabase/client` |

## Server actions with slug

Actions under `[slug]/backoffice/` receive `slug` as a bound argument (not from `formData`):

```ts
// In the page:
<form action={inviteMemberAction.bind(null, lang, slug)}>

// In the action:
export const inviteMemberAction = async (locale: string, slug: string, formData: FormData) => {
  const { user, tenant } = await requireTenantAdminBySlug(locale, slug);
  // tenant.id is now safe to use — access has been verified
};
```

## Error handling in actions

Redirect with an `?error=key` search param — never throw to the client. The page reads `searchParams.error` and renders the appropriate dict string.
