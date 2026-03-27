-- Run this in your Supabase SQL Editor
-- Adds bundle_id to the cart table to link paired bundle items together

ALTER TABLE public.cart
  ADD COLUMN IF NOT EXISTS bundle_id UUID;

-- Index for fast bundle-pair lookups (used when removing a bundle item)
CREATE INDEX IF NOT EXISTS idx_cart_bundle_id
  ON public.cart (bundle_id)
  WHERE bundle_id IS NOT NULL;
