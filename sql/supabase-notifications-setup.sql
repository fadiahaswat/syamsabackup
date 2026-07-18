-- ==========================================
-- SUPABASE SETUP: Notifications Table
-- ==========================================
-- Run this in Supabase Dashboard > SQL Editor
-- Safe to re-run - handles existing constraints/indexes
-- ==========================================

-- 1. Create notifications table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'notifications'
  ) THEN
    CREATE TABLE notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_type TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      type TEXT DEFAULT 'info',
      deep_link TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      source_device TEXT
    );
  END IF;
END $$;

-- 2. Create indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(recipient_type, recipient_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(recipient_type, recipient_id, is_read)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_created
  ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type
  ON notifications(recipient_type, recipient_id, type);

-- 3. Enable Row Level Security (RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policy
    WHERE polname = 'users_can_view_own_notifications'
  ) THEN
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 4. Create policies (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policy
    WHERE polname = 'users_can_view_own_notifications'
  ) THEN
    -- Policy for viewing own notifications
    CREATE POLICY "users_can_view_own_notifications"
      ON notifications
      FOR SELECT
      USING (
        (recipient_type = 'wali' AND recipient_id = auth.jwt() ->> 'nis')
        OR
        (recipient_type = 'musyrif' AND recipient_id = auth.jwt() ->> 'email')
        OR
        (recipient_type = 'admin')
      );

    -- Policy for inserting own notifications
    CREATE POLICY "users_can_insert_own_notifications"
      ON notifications
      FOR INSERT
      WITH CHECK (
        (recipient_type = 'wali' AND recipient_id = auth.jwt() ->> 'nis')
        OR
        (recipient_type = 'musyrif' AND recipient_id = auth.jwt() ->> 'email')
        OR
        (recipient_type = 'admin')
      );

    -- Policy for updating own notifications
    CREATE POLICY "users_can_update_own_notifications"
      ON notifications
      FOR UPDATE
      USING (
        (recipient_type = 'wali' AND recipient_id = auth.jwt() ->> 'nis')
        OR
        (recipient_type = 'musyrif' AND recipient_id = auth.jwt() ->> 'email')
        OR
        (recipient_type = 'admin')
      );
  END IF;
END $$;

-- 5. Enable Realtime for notifications
DO $$
BEGIN
  -- Check if publication exists and add if not
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if already added or publication doesn't exist
  NULL;
END $$;

-- 6. Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 7. Create/update trigger for synced_at
DROP TRIGGER IF EXISTS trigger_update_notifications_synced_at ON notifications;
CREATE TRIGGER trigger_update_notifications_synced_at
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_synced_at();

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
-- Run these to check setup:

-- Check table structure:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'notifications';

-- Check indexes:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'notifications';

-- Check RLS:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'notifications';

-- Check policies:
-- SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'notifications'::regclass;
