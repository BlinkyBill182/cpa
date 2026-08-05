-- Migration 0015: Add ai_result JSONB column to uploaded_files
-- Stores the structured validation result from Claude:
-- { formType, formYear, isValid, confidence, errors[], warnings[] }

ALTER TABLE public.uploaded_files
  ADD COLUMN IF NOT EXISTS ai_result JSONB;

COMMENT ON COLUMN public.uploaded_files.ai_result IS
  'Structured AI validation result: { formType, formYear, isValid, confidence, errors[], warnings[] }';
