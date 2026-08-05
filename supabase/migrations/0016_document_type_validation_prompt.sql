-- Migration 0016: Add per-document-type AI validation prompt
-- The prompt is written by the CPA admin and describes what to look for
-- when validating files of this document type (passed verbatim to Claude).

ALTER TABLE public.document_types
  ADD COLUMN IF NOT EXISTS validation_prompt TEXT;

COMMENT ON COLUMN public.document_types.validation_prompt IS
  'Optional CPA-written prompt that Claude uses when validating uploaded files of this type. Plain text, Hebrew or English.';
