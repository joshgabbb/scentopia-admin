-- =====================================================
-- SCENTOPIA: Audit Logs — Safe Setup Migration
-- Run this in Supabase SQL Editor.
-- Safe to run even if audit_logs already exists.
-- =====================================================

-- ─── STEP 1: Create table (if it does not exist) ──────────────────────────
-- If it already exists, this is a no-op.

CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_name   TEXT        NOT NULL DEFAULT 'Unknown',
    admin_email  TEXT        NOT NULL DEFAULT 'unknown@example.com',
    admin_role   TEXT        NOT NULL DEFAULT 'admin',
    action       TEXT        NOT NULL,
    module       TEXT        NOT NULL DEFAULT 'SYSTEM',
    entity_id    TEXT        NOT NULL DEFAULT '',
    entity_label TEXT,
    old_value    JSONB,
    new_value    JSONB,
    metadata     JSONB       DEFAULT '{}'::jsonb,
    ip_address   TEXT        NOT NULL DEFAULT 'unknown',
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Legacy columns kept for backward-compat with old logger
    entity_type  TEXT,
    changes      JSONB
);

-- ─── STEP 2: Add missing columns if table already existed ─────────────────

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module       TEXT        NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id    TEXT        NOT NULL DEFAULT '';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_label TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value    JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value    JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata     JSONB       DEFAULT '{}'::jsonb;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_name   TEXT        NOT NULL DEFAULT 'Unknown';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_email  TEXT        NOT NULL DEFAULT 'unknown@example.com';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS admin_role   TEXT        NOT NULL DEFAULT 'admin';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type  TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS changes      JSONB;

-- ─── STEP 3: Backfill from old schema if rows exist ───────────────────────

-- Copy entity_type → module for any old rows
UPDATE audit_logs
SET    module = UPPER(entity_type)
WHERE  module = 'SYSTEM'
  AND  entity_type IS NOT NULL;

-- Copy old changes JSONB → old_value / new_value
UPDATE audit_logs
SET
    old_value = CASE WHEN changes ? 'old' THEN changes -> 'old' ELSE NULL END,
    new_value = CASE WHEN changes ? 'new' THEN changes -> 'new' ELSE NULL END
WHERE changes IS NOT NULL
  AND (old_value IS NULL OR new_value IS NULL);

-- ─── STEP 4: Performance indexes ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_user_id     ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module      ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_action      ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id   ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_module_date ON audit_logs(module, created_at DESC);

-- ─── STEP 5: Row Level Security ───────────────────────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can SELECT all logs
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
CREATE POLICY "Admins can read audit logs" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE  profiles.id = auth.uid()
            AND    profiles.account_role = 'admin'
        )
    );

-- Any authenticated request can INSERT (server-side routes only)
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE or DELETE policies — logs are append-only

-- ─── STEP 6: Verify ───────────────────────────────────────────────────────

-- Run these to confirm everything is set up:
--
-- SELECT column_name, data_type
-- FROM   information_schema.columns
-- WHERE  table_schema = 'public' AND table_name = 'audit_logs'
-- ORDER  BY ordinal_position;
--
-- SELECT COUNT(*) FROM audit_logs;
