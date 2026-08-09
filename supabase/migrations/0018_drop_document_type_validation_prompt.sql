-- Per-type AI prompts removed; Claude uses the built-in Israeli CPA system prompt.
ALTER TABLE public.document_types
  DROP COLUMN IF EXISTS validation_prompt;
