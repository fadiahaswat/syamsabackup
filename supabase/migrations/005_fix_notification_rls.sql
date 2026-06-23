-- ============================================================
-- SYAMSA PWA - Supabase Migration 005
-- Fix notifications RLS policies to allow authenticated Musyrif
-- and anonymous Wali to perform CRUD operations.
-- ============================================================

-- Drop old restricted TO anon policies
DROP POLICY IF EXISTS "Allow anonymous select notifications" ON notifications;
DROP POLICY IF EXISTS "Allow anonymous insert notifications" ON notifications;
DROP POLICY IF EXISTS "Allow anonymous update notifications" ON notifications;

-- Create role-agnostic policies (applies to both anon and authenticated)
CREATE POLICY "Allow select notifications" ON notifications
    FOR SELECT USING (true);

CREATE POLICY "Allow insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update notifications" ON notifications
    FOR UPDATE USING (true);
