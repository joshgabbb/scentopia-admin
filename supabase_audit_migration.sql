-- =====================================================
-- SCENTOPIA: Complete Audit Trail System Migration
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Create audit_logs table
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    -- Primary key
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who performed the action
    user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    admin_name      TEXT NOT NULL DEFAULT 'Unknown',
    admin_email     TEXT NOT NULL DEFAULT 'unknown@example.com',
    admin_role      TEXT NOT NULL DEFAULT 'admin',

    -- What happened
    action          TEXT NOT NULL,
    -- Allowed values: CREATE | UPDATE | DELETE | LOGIN | LOGOUT |
    --                 LOGIN_FAILED | PASSWORD_CHANGE | ACCOUNT_CREATE |
    --                 ACCOUNT_DEACTIVATE | ACCOUNT_REACTIVATE | VIEW |
    --                 STOCK_IN | STOCK_OUT | STOCK_ADJUST | BULK_IMPORT |
    --                 SETTINGS_UPDATE | CONFIG_CHANGE | IMAGE_UPLOAD | EXPORT

    module          TEXT NOT NULL,
    -- Allowed values: PRODUCT | CATEGORY | TAG | SIZE | ORDER |
    --                 USER | INVENTORY | NOTIFICATION | FEEDBACK |
    --                 AUTH | SETTINGS | SYSTEM | REPORT

    entity_id       TEXT NOT NULL DEFAULT '',
    -- The ID of the affected record (product_id, order_id, etc.)
    -- Empty string when no specific entity (e.g., LOGIN, SETTINGS_UPDATE)

    entity_label    TEXT,
    -- Human-readable name of the entity (e.g., product name, user email)
    -- Makes logs readable without joining other tables

    -- Change data (tamper-evident JSONB)
    old_value       JSONB,   -- State before the change (NULL for CREATE / LOGIN)
    new_value       JSONB,   -- State after the change  (NULL for DELETE / LOGOUT)
    metadata        JSONB DEFAULT '{}'::jsonb,
    -- Extra context: reason, notes, bulk count, etc.

    -- Request context
    ip_address      TEXT NOT NULL DEFAULT 'unknown',
    user_agent      TEXT,

    -- Immutable timestamp — do NOT use updated_at on this table
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PART 2: Indexes for query performance
-- =====================================================

-- Most common queries: recent logs, by user, by module, by action
CREATE INDEX IF NOT EXISTS idx_audit_user_id      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_module        ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_action        ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id     ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at    ON audit_logs(created_at DESC);

-- Composite indexes for filtered dashboards
CREATE INDEX IF NOT EXISTS idx_audit_module_action ON audit_logs(module, action);
CREATE INDEX IF NOT EXISTS idx_audit_user_created  ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_module_date   ON audit_logs(module, created_at DESC);

-- =====================================================
-- PART 3: Row Level Security (tamper prevention)
-- =====================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ✅ Admins can read all audit logs
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;
CREATE POLICY "Admins can read audit logs" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.account_role = 'admin'
        )
    );

-- ✅ System (server-side / service role) can INSERT logs
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT
    WITH CHECK (true);

-- 🚫 NO UPDATE policy — logs are immutable
-- 🚫 NO DELETE policy — logs cannot be deleted via client

-- =====================================================
-- PART 4: Prevent tampering via trigger
-- Block any UPDATE or DELETE on audit_logs at DB level
-- =====================================================

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable. Modification is not permitted.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON audit_logs;
CREATE TRIGGER trg_prevent_audit_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON audit_logs;
CREATE TRIGGER trg_prevent_audit_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_log_modification();

-- =====================================================
-- PART 5: Constraint on action and module values
-- =====================================================

ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS chk_audit_action;
ALTER TABLE audit_logs
    ADD CONSTRAINT chk_audit_action CHECK (
        action IN (
            'CREATE', 'UPDATE', 'DELETE', 'VIEW',
            'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
            'PASSWORD_CHANGE', 'ACCOUNT_CREATE',
            'ACCOUNT_DEACTIVATE', 'ACCOUNT_REACTIVATE',
            'STOCK_IN', 'STOCK_OUT', 'STOCK_ADJUST', 'BULK_IMPORT',
            'SETTINGS_UPDATE', 'CONFIG_CHANGE',
            'IMAGE_UPLOAD', 'EXPORT', 'ROLE_CHANGE'
        )
    );

ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS chk_audit_module;
ALTER TABLE audit_logs
    ADD CONSTRAINT chk_audit_module CHECK (
        module IN (
            'PRODUCT', 'CATEGORY', 'TAG', 'SIZE',
            'ORDER', 'USER', 'INVENTORY',
            'NOTIFICATION', 'FEEDBACK',
            'AUTH', 'SETTINGS', 'SYSTEM', 'REPORT'
        )
    );

-- =====================================================
-- PART 6: Example performance queries
-- =====================================================

-- Filter by date range:
-- SELECT * FROM audit_logs
-- WHERE created_at BETWEEN '2026-01-01' AND '2026-03-31'
-- ORDER BY created_at DESC
-- LIMIT 50 OFFSET 0;

-- Filter by user:
-- SELECT * FROM audit_logs
-- WHERE user_id = '<uuid>'
-- ORDER BY created_at DESC;

-- Filter by module:
-- SELECT * FROM audit_logs
-- WHERE module = 'PRODUCT'
-- ORDER BY created_at DESC;

-- Filter by action and module:
-- SELECT * FROM audit_logs
-- WHERE module = 'INVENTORY' AND action IN ('STOCK_IN', 'STOCK_OUT')
-- ORDER BY created_at DESC;

-- Search by admin email:
-- SELECT * FROM audit_logs
-- WHERE admin_email ILIKE '%gabriel%'
-- ORDER BY created_at DESC;

-- Recent login events:
-- SELECT user_id, admin_email, action, ip_address, created_at
-- FROM audit_logs
-- WHERE module = 'AUTH'
-- ORDER BY created_at DESC
-- LIMIT 100;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'audit_logs';

-- SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs';

-- SELECT trigger_name FROM information_schema.triggers
-- WHERE event_object_table = 'audit_logs';
