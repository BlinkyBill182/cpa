# src/ — Next.js App Router Conventions

## Server vs Client

- Pages and layouts are **Server Components** by default — no `"use client"` unless you need browser APIs or state.
- Data mutations go in `actions.ts` files next to the page, marked `"use server"`.
- Never call a server action from another server action — extract shared logic into `src/lib/`.

## Route protection

Always guard pages with the appropriate session helper at the top:

```ts
const user = await requireUser(lang);              // any authenticated user
const user = await requirePlatformOwner(lang);     // platform owner only
const { user, tenantId, role } = await requireTenantAccess(lang);  // tenant member
const membership = await requireTenantAdmin(lang); // tenant_admin role only
```

## i18n

Every page receives `params: Promise<{ lang: string }>`. Resolve it and load the dictionary:

```ts
const { lang } = await params;
const dict = await getDictionary(lang as Locale);
```

Never use raw strings in JSX — always `dict.some.key`.

## Supabase clients

| Context | Import |
|---|---|
| Server component / action | `createSupabaseServerClient()` from `@/lib/supabase/server` |
| Admin / service role | `createSupabaseAdminClient()` from `@/lib/supabase/admin` |
| Browser component | `createSupabaseBrowserClient()` from `@/lib/supabase/client` |

## Error handling in actions

Return `{ error: string }` from server actions — never throw to the client. Display errors via URL search params or returned state.
