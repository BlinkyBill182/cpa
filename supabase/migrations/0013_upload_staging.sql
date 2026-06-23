-- Migration 0013: client upload staging
-- Files land in Supabase Storage first; n8n moves them to Drive later.

-- 1. Make drive_url nullable — files start in Storage, not Drive
alter table public.uploaded_files
  alter column drive_url drop not null;

-- 2. Track where the file currently lives and its lifecycle state
alter table public.uploaded_files
  add column storage_path  text,
  add column upload_status text not null default 'staged'
    check (upload_status in ('staged', 'in_drive', 'failed'));

-- 3. Enforce that at least one location is always set
alter table public.uploaded_files
  add constraint uploaded_files_has_location
    check (storage_path is not null or drive_url is not null);

-- Note: files go directly to Google Drive via the tenant's Service Account.
-- Supabase Storage is not used for client uploads.
