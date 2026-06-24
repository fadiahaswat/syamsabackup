-- ============================================================
-- SYAMSA PWA - Supabase Migration 006
-- Create admin_emails, announcements, wali_password, and tahfizh_record tables
-- Configure RLS policies for Admin bypass
-- ============================================================

-- 1. Create table admin_emails
CREATE TABLE IF NOT EXISTS admin_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on admin_emails
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;

-- Policies for admin_emails
CREATE POLICY "Allow select admin_emails" ON admin_emails
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert admin_emails" ON admin_emails
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update admin_emails" ON admin_emails
    FOR UPDATE TO authenticated USING (true);


-- 2. Create table announcements
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policies for announcements
CREATE POLICY "Allow select announcements" ON announcements
    FOR SELECT USING (true);

CREATE POLICY "Allow admin CRUD announcements" ON announcements
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );


-- 3. Create table wali_password
CREATE TABLE IF NOT EXISTS wali_password (
    nis TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on wali_password
ALTER TABLE wali_password ENABLE ROW LEVEL SECURITY;

-- Policies for wali_password
CREATE POLICY "Allow select wali_password" ON wali_password
    FOR SELECT USING (true);

CREATE POLICY "Allow insert wali_password" ON wali_password
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update wali_password" ON wali_password
    FOR UPDATE USING (true);

CREATE POLICY "Allow admin delete wali_password" ON wali_password
    FOR DELETE USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );


-- 4. Create table tahfizh_record
CREATE TABLE IF NOT EXISTS tahfizh_record (
    id TEXT PRIMARY KEY,
    musyrif TEXT NOT NULL,
    nama_santri TEXT NOT NULL,
    santri_id TEXT NOT NULL,
    kelas TEXT NOT NULL,
    program TEXT,
    jenis TEXT,
    juz TEXT,
    tanggal DATE,
    kualitas TEXT,
    status TEXT,
    surat TEXT,
    halaman TEXT,
    row_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on tahfizh_record
ALTER TABLE tahfizh_record ENABLE ROW LEVEL SECURITY;

-- Policies for tahfizh_record
CREATE POLICY "Allow select tahfizh_record" ON tahfizh_record
    FOR SELECT USING (true);

CREATE POLICY "Allow all insert tahfizh_record" ON tahfizh_record
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update tahfizh_record" ON tahfizh_record
    FOR UPDATE USING (true);

CREATE POLICY "Allow admin delete tahfizh_record" ON tahfizh_record
    FOR DELETE USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );


-- 5. Enable Admin Bypass Policies for Existing Tables

-- Policies for kelas
CREATE POLICY "Admin can manage all kelas" ON kelas
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );

-- Policies for student
CREATE POLICY "Admin can manage all student" ON student
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );

-- Policies for attendance_record
CREATE POLICY "Admin can manage all attendance" ON attendance_record
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );

-- Policies for permit
CREATE POLICY "Admin can manage all permit" ON permit
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );

-- Policies for user_settings
CREATE POLICY "Admin can manage all user_settings" ON user_settings
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );

-- Policies for activity_log
CREATE POLICY "Admin can manage all activity_log" ON activity_log
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );

-- Policies for sync_metadata
CREATE POLICY "Admin can manage all sync_metadata" ON sync_metadata
    FOR ALL USING (
        auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails)
    );


-- 6. Enable Realtime Publications for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE wali_password;
ALTER PUBLICATION supabase_realtime ADD TABLE tahfizh_record;
