-- 0017_global_document_types.sql
-- Allow the platform owner to define global document types (tenant_id IS NULL)
-- that any office can adopt (copy) into their own library.

-- 1. Remove the NOT NULL constraint so global types can have tenant_id = NULL
ALTER TABLE public.document_types ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Update SELECT policy: global types are visible to any authenticated user
DROP POLICY IF EXISTS "document_types_select" ON public.document_types;
CREATE POLICY "document_types_select" ON public.document_types
  FOR SELECT
  USING (
    tenant_id IS NULL                        -- global type: any authenticated user
    OR is_platform_owner(auth.uid())         -- platform owner sees all
    OR has_tenant_access(tenant_id)          -- tenant member sees their own
  );

-- 3. Update write policy: platform owner writes global types; tenant members write their own
DROP POLICY IF EXISTS "document_types_write" ON public.document_types;
CREATE POLICY "document_types_write" ON public.document_types
  FOR ALL
  USING (
    is_platform_owner(auth.uid())
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  )
  WITH CHECK (
    is_platform_owner(auth.uid())
    OR (tenant_id IS NOT NULL AND has_tenant_access(tenant_id))
  );
