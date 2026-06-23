-- ============================================================
-- SYAMSA PWA - Supabase Migration 004
-- Create notifications table for in-app notification center
-- ============================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('musyrif', 'wali')),
    recipient_id TEXT NOT NULL, -- Email Musyrif ATAU NIS Santri
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL, -- 'permit', 'attendance', 'tahfizh', 'announcement', 'system'
    is_read BOOLEAN DEFAULT FALSE,
    deep_link TEXT, -- format query: 'tab=report' atau 'tab=home&action=verify&id=123'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for speed
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (since Wali/Santri logs in anonymously/client-side)
CREATE POLICY "Allow anonymous select notifications" ON notifications
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert notifications" ON notifications
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update notifications" ON notifications
    FOR UPDATE TO anon USING (true);

-- Enable Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
