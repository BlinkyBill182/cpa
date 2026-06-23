# supabase/ — Migration Conventions

## Adding a new migration

1. Name it `NNNN_short_description.sql` where `NNNN` is the next number in sequence.
2. Every new table needs:
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
   - At minimum a SELECT policy scoped to `has_tenant_access(tenant_id)` or `auth.uid() = user_id`
   - An INSERT policy that sets `tenant_id` from the user's active membership
3. Never modify an existing migration — always create a new one.
4. After writing the migration, update `src/lib/supabase/database.types.ts` to match.

## RLS helper functions (already defined)

```sql
is_platform_owner(uid uuid)   -- true if profiles.is_platform_owner = true for the given uid; call as is_platform_owner(auth.uid())
has_tenant_access(tid uuid)   -- true if user has a row in tenant_memberships for tid
is_tenant_admin(tid uuid)     -- true if user has role = 'tenant_admin' for tid  (added in migration 0012)
```

## tenant_role enum values

`tenant_admin` | `manager` | `staff` | `reviewer` | `contractor`

`contractor` was added in migration 0012. Contractors can change `report_status` only for `client_years` where they are the assigned `contractor_id`.

## Applying migrations

Run the SQL manually in the Supabase dashboard SQL editor for both the production and test projects.
