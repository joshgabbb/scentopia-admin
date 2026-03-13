-- Remove ALL "10ml" size variants from all products.
-- Handles: "10ml", "10 ml", "10 ML", "10ML", "10", " 10ml", etc.
-- Uses the same normalization logic as the admin panel:
--   1. lowercase  2. strip spaces  3. strip trailing "ml"
-- Any key that normalizes to "10" is removed.
--
-- Products are NOT deleted — only the 10ml size/stock entry is stripped.

UPDATE public.products
SET
  sizes = (
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM jsonb_each(COALESCE(sizes, '{}'::jsonb)) j(k, v)
    WHERE lower(regexp_replace(regexp_replace(k, '\s+', '', 'g'), 'ml$', '')) <> '10'
  ),
  stocks = (
    SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM jsonb_each(COALESCE(stocks, '{}'::jsonb)) j(k, v)
    WHERE lower(regexp_replace(regexp_replace(k, '\s+', '', 'g'), 'ml$', '')) <> '10'
  ),
  updated_at = NOW()
WHERE
  EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(sizes,  '{}'::jsonb)) k
    WHERE lower(regexp_replace(regexp_replace(k, '\s+', '', 'g'), 'ml$', '')) = '10'
  )
  OR EXISTS (
    SELECT 1 FROM jsonb_object_keys(COALESCE(stocks, '{}'::jsonb)) k
    WHERE lower(regexp_replace(regexp_replace(k, '\s+', '', 'g'), 'ml$', '')) = '10'
  );
