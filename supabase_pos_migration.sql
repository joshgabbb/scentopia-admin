-- ============================================================
-- Scentopia POS Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. POS Transactions table
CREATE TABLE IF NOT EXISTS pos_transactions (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number TEXT          NOT NULL UNIQUE,
  total_amount       NUMERIC(10,2) NOT NULL,
  cash_received      NUMERIC(10,2) NOT NULL DEFAULT 0,
  change_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method     TEXT          NOT NULL DEFAULT 'cash',
  sale_source        TEXT          NOT NULL DEFAULT 'physical_store',
  notes              TEXT,
  created_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. POS Transaction Items table
CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID          NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
  product_id     UUID          NOT NULL,
  product_name   TEXT          NOT NULL,
  size           TEXT          NOT NULL,
  quantity       INTEGER       NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(10,2) NOT NULL,
  subtotal       NUMERIC(10,2) NOT NULL
);

-- 3. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pos_transactions_created_at
  ON pos_transactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_transactions_sale_source
  ON pos_transactions (sale_source);

CREATE INDEX IF NOT EXISTS idx_pos_transaction_items_transaction_id
  ON pos_transaction_items (transaction_id);

CREATE INDEX IF NOT EXISTS idx_pos_transaction_items_product_id
  ON pos_transaction_items (product_id);

-- 4. Enable Row Level Security (restrict to authenticated users)
ALTER TABLE pos_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transaction_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated (admin) users to read and insert
CREATE POLICY "Admins can read pos_transactions"
  ON pos_transactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert pos_transactions"
  ON pos_transactions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can read pos_transaction_items"
  ON pos_transaction_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert pos_transaction_items"
  ON pos_transaction_items FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- Verification query — run after migration to confirm tables
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('pos_transactions', 'pos_transaction_items');
