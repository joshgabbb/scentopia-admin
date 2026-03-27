-- Run this in your Supabase SQL Editor
-- Creates the product_bundles table for the Bundle Deals feature

CREATE TABLE IF NOT EXISTS public.product_bundles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  product_1_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_2_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  bundle_price        NUMERIC(10, 2) NOT NULL,
  original_price      NUMERIC(10, 2) NOT NULL,
  discount_percentage INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  reasoning           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Index for fast active-bundle lookups (used by mobile app)
CREATE INDEX IF NOT EXISTS idx_product_bundles_active
  ON public.product_bundles (is_active)
  WHERE is_active = TRUE;

-- Allow anyone (including anon/mobile) to read active bundles
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active bundles"
  ON public.product_bundles FOR SELECT
  USING (is_active = TRUE);

-- Only service role (admin API) can insert/update/delete
CREATE POLICY "Service role manages bundles"
  ON public.product_bundles FOR ALL
  USING (auth.role() = 'service_role');
