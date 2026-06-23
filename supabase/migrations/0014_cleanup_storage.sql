-- Migration 0014: remove Supabase Storage staging, drive_url is the single source of truth.
-- n8n webhook is also removed from the config surface (JSONB, no schema change needed).

-- 1. Drop the "at least one location" constraint (no longer valid without storage_path)
alter table public.uploaded_files
  drop constraint if exists uploaded_files_has_location;

-- 2. Remove the staging column — files go directly to Google Drive
alter table public.uploaded_files
  drop column if exists storage_path;

-- 3. Restore drive_url to NOT NULL (delete any orphaned rows first — should not exist)
delete from public.uploaded_files where drive_url is null;

alter table public.uploaded_files
  alter column drive_url set not null;
