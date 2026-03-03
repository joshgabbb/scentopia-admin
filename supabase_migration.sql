-- =====================================================
-- SCENTOPIA: Notification & Feedback System Migration
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Ensure tables have correct structure
-- =====================================================

-- 1A. Verify/Create admin_notifications table (for admin to create/manage)
CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'announcement', -- announcement, promotion, alert, update, newsletter
    status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, sent, failed
    target_audience TEXT NOT NULL DEFAULT 'customers', -- all, customers, admins
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    recipient_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 1B. Verify/Create notifications table (user-facing notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT DEFAULT 'general',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    admin_notification_id UUID REFERENCES admin_notifications(id) -- Link to source admin notification
);

-- 1C. Verify/Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID, -- Optional: link to specific order
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- general, product_issue, delivery, suggestion, complaint, other
    priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
    status TEXT DEFAULT 'pending', -- pending, in_progress, resolved, closed
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
    admin_response TEXT,
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 2: Create indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status);

-- =====================================================
-- PART 3: Function to broadcast notification to users
-- =====================================================

CREATE OR REPLACE FUNCTION broadcast_admin_notification(admin_notif_id UUID)
RETURNS INTEGER AS $$
DECLARE
    notif_record RECORD;
    target_users UUID[];
    user_id UUID;
    notif_type TEXT;
    inserted_count INTEGER := 0;
BEGIN
    -- Get the admin notification
    SELECT * INTO notif_record FROM admin_notifications WHERE id = admin_notif_id;

    IF notif_record IS NULL THEN
        RAISE EXCEPTION 'Admin notification not found';
    END IF;

    -- Map admin notification type to mobile notification type
    CASE notif_record.type
        WHEN 'promotion' THEN notif_type := 'promotion';
        WHEN 'alert' THEN notif_type := 'warning';
        WHEN 'update' THEN notif_type := 'information';
        WHEN 'newsletter' THEN notif_type := 'information';
        ELSE notif_type := 'general';
    END CASE;

    -- Get target users based on audience
    IF notif_record.target_audience = 'all' THEN
        SELECT ARRAY_AGG(id) INTO target_users FROM profiles;
    ELSIF notif_record.target_audience = 'customers' THEN
        SELECT ARRAY_AGG(id) INTO target_users FROM profiles WHERE account_role = 'customer' OR account_role IS NULL;
    ELSIF notif_record.target_audience = 'admins' THEN
        SELECT ARRAY_AGG(id) INTO target_users FROM profiles WHERE account_role = 'admin';
    END IF;

    -- Insert notification for each target user
    IF target_users IS NOT NULL THEN
        FOREACH user_id IN ARRAY target_users
        LOOP
            INSERT INTO notifications (
                user_id,
                notification_type,
                title,
                body,
                is_read,
                created_at,
                metadata,
                admin_notification_id
            ) VALUES (
                user_id,
                notif_type,
                notif_record.title,
                notif_record.message,
                FALSE,
                NOW(),
                jsonb_build_object(
                    'admin_notification_id', admin_notif_id,
                    'type', notif_record.type,
                    'action', 'promotion-redirect'
                ),
                admin_notif_id
            );
            inserted_count := inserted_count + 1;
        END LOOP;
    END IF;

    -- Update admin notification with actual recipient count
    UPDATE admin_notifications
    SET recipient_count = inserted_count,
        sent_at = NOW(),
        status = 'sent'
    WHERE id = admin_notif_id;

    RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PART 4: Trigger for automatic broadcast on status change
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_broadcast_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when status changes to 'sent'
    IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status != 'sent') THEN
        PERFORM broadcast_admin_notification(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_admin_notification_sent ON admin_notifications;
CREATE TRIGGER on_admin_notification_sent
    AFTER UPDATE ON admin_notifications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_broadcast_notification();

-- =====================================================
-- PART 5: Function to notify user when admin responds to feedback
-- =====================================================

CREATE OR REPLACE FUNCTION notify_feedback_response()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when admin_response is added
    IF NEW.admin_response IS NOT NULL AND (OLD.admin_response IS NULL OR OLD.admin_response != NEW.admin_response) THEN
        INSERT INTO notifications (
            user_id,
            notification_type,
            title,
            body,
            is_read,
            created_at,
            metadata
        ) VALUES (
            NEW.user_id,
            'information',
            'Response to Your Feedback',
            'An admin has responded to your feedback: "' || LEFT(NEW.subject, 50) || '..."',
            FALSE,
            NOW(),
            jsonb_build_object(
                'feedback_id', NEW.id,
                'action', 'feedback-redirect'
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists and create new one
DROP TRIGGER IF EXISTS on_feedback_response ON feedback;
CREATE TRIGGER on_feedback_response
    AFTER UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION notify_feedback_response();

-- =====================================================
-- PART 6: Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can only see their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
CREATE POLICY "Users can delete own notifications" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

-- Feedback: Users can view and create their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON feedback;
CREATE POLICY "Users can view own feedback" ON feedback
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create feedback" ON feedback;
CREATE POLICY "Users can create feedback" ON feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all feedback" ON feedback;
CREATE POLICY "Admins can view all feedback" ON feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.account_role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update feedback" ON feedback;
CREATE POLICY "Admins can update feedback" ON feedback
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.account_role = 'admin'
        )
    );

-- Admin notifications: Only admins can manage
DROP POLICY IF EXISTS "Admins can manage notifications" ON admin_notifications;
CREATE POLICY "Admins can manage notifications" ON admin_notifications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.account_role = 'admin'
        )
    );

-- =====================================================
-- PART 7: Enable Realtime for tables
-- =====================================================

-- Enable realtime for notifications table (for mobile app)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable realtime for feedback table (for admin dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE feedback;

-- =====================================================
-- VERIFICATION QUERIES (Run these to check setup)
-- =====================================================

-- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('notifications', 'feedback', 'admin_notifications');

-- Check triggers exist
-- SELECT trigger_name, event_manipulation, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Test broadcast function (replace with actual UUID)
-- SELECT broadcast_admin_notification('your-admin-notification-uuid');
