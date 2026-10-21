-- Run this once in Supabase SQL Editor before deploying the matching application code.
-- It allows the existing claims table to reference either a found item or a verified lost report.
-- Existing found-item claims are preserved.

ALTER TABLE public.claims
  ALTER COLUMN found_item_id DROP NOT NULL;

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS lost_item_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.claims'::regclass
      AND conname = 'claims_lost_item_id_fkey'
  ) THEN
    ALTER TABLE public.claims
      ADD CONSTRAINT claims_lost_item_id_fkey
      FOREIGN KEY (lost_item_id) REFERENCES public.lost_items(lost_item_id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.claims'::regclass
      AND conname = 'claims_exactly_one_item_check'
  ) THEN
    ALTER TABLE public.claims
      ADD CONSTRAINT claims_exactly_one_item_check
      CHECK ((found_item_id IS NOT NULL AND lost_item_id IS NULL)
          OR (found_item_id IS NULL AND lost_item_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS claims_lost_item_id_idx
  ON public.claims(lost_item_id);
