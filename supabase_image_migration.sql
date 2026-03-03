-- =====================================================
-- SCENTOPIA: Add image_url column to notifications
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add image_url column to admin_notifications if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_notifications'
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE admin_notifications ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Add image_url column to notifications if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'image_url'
    ) THEN
        ALTER TABLE notifications ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- Add is_archived column to admin_notifications if it doesn't exist (for archive functionality)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'admin_notifications'
        AND column_name = 'is_archived'
    ) THEN
        ALTER TABLE admin_notifications ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Create index for image_url queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_notifications_image_url ON notifications(image_url) WHERE image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_notifications_image_url ON admin_notifications(image_url) WHERE image_url IS NOT NULL;

-- Confirmation
SELECT 'Migration complete! Columns added:' as status;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('notifications', 'admin_notifications')
AND column_name IN ('image_url', 'is_archived')
ORDER BY table_name, column_name;
