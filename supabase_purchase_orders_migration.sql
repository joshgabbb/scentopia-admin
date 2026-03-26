-- ============================================================
-- Purchase Order Module Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  address     TEXT,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number    TEXT UNIQUE NOT NULL,
  supplier_id  UUID NOT NULL REFERENCES suppliers(id),
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','scheduled','sent','received','cancelled','failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  received_at  TIMESTAMPTZ,
  notes        TEXT,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Purchase Order Items table (one row per product + size)
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id      UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  size       TEXT NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status      ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier    ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_scheduled   ON purchase_orders(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po     ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id);

-- RLS: enable but allow service role (admin client) full access
ALTER TABLE suppliers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
