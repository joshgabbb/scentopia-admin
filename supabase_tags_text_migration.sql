-- Fix: Convert product tag columns from rigid enum arrays to flexible text[]
-- This allows newly created tags (from the Tags page) to be assigned to products.
--
-- The USING clause preserves all existing tag values by casting each enum
-- element to its text representation.

ALTER TABLE public.products
  ALTER COLUMN occasions_tags    TYPE text[] USING occasions_tags::text[],
  ALTER COLUMN weather_tags      TYPE text[] USING weather_tags::text[],
  ALTER COLUMN top_notes_tags    TYPE text[] USING top_notes_tags::text[],
  ALTER COLUMN other_options_tags TYPE text[] USING other_options_tags::text[];
