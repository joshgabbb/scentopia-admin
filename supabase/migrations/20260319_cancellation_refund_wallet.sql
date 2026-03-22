-- Migration: Cancellation + Refund + Wallet Integration
-- Run this in your Supabase SQL Editor

-- 1. Add delay_compensation_sent to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delay_compensation_sent boolean NOT NULL DEFAULT false;

-- 2. Ensure cancelled_orders has refund_status column
ALTER TABLE cancelled_orders
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'Pending';

-- 3. Create refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  image_url text,
  amount numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Declined')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by order and user
CREATE INDEX IF NOT EXISTS refunds_order_id_idx ON refunds(order_id);
CREATE INDEX IF NOT EXISTS refunds_user_id_idx ON refunds(user_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON refunds(status);

-- Enable RLS
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- Users can read their own refunds
CREATE POLICY "Users can read own refunds"
  ON refunds FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own refunds
CREATE POLICY "Users can insert own refunds"
  ON refunds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role (admin API) can do everything
CREATE POLICY "Service role full access on refunds"
  ON refunds FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Auto-update updated_at on refunds
CREATE OR REPLACE FUNCTION update_refunds_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refunds_updated_at ON refunds;
CREATE TRIGGER refunds_updated_at
  BEFORE UPDATE ON refunds
  FOR EACH ROW EXECUTE FUNCTION update_refunds_updated_at();
