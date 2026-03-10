-- =====================================================
-- SCENTOPIA: Audit Logs — Fix Constraints Migration
-- Run this in Supabase SQL Editor AFTER supabase_audit_v2_migration.sql
-- Safe to run even if already applied (uses IF EXISTS / IF NOT EXISTS).
-- =====================================================

-- ─── STEP 1: Expand the action CHECK constraint ───────────────────────────
-- The old constraint only allowed 6 lowercase values.
-- We need to support all new action types (kept lowercase to match DB convention).

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
  CHECK (action = ANY (ARRAY[
    -- Original values (kept for backward compat)
    'create', 'update', 'delete', 'view', 'login', 'logout',
    -- New action types
    'login_failed', 'password_change',
    'account_create', 'account_deactivate', 'account_reactivate', 'role_change',
    'stock_in', 'stock_out', 'stock_adjust', 'bulk_import',
    'settings_update', 'config_change', 'image_upload', 'export'
  ]));

-- ─── STEP 2: Make entity_type nullable ────────────────────────────────────
-- entity_type is a legacy column; `module` is the canonical column now.
-- Making it nullable lets the logger omit it for auth/system/report events.

ALTER TABLE audit_logs ALTER COLUMN entity_type DROP NOT NULL;

-- ─── STEP 3: Drop the entity_type CHECK constraint (too restrictive) ──────
-- The old constraint did not include auth/system/report module mappings.
-- Removing it lets us store whatever mapping value is appropriate (or NULL).

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_entity_type_check;

-- ─── STEP 4: Verify ───────────────────────────────────────────────────────
-- Run these after applying to confirm:
--
-- SELECT constraint_name, check_clause
-- FROM   information_schema.check_constraints
-- WHERE  constraint_schema = 'public'
--   AND  constraint_name LIKE 'audit_logs%';
--
-- SELECT column_name, is_nullable
-- FROM   information_schema.columns
-- WHERE  table_schema = 'public' AND table_name = 'audit_logs'
--   AND  column_name IN ('action', 'entity_type');
