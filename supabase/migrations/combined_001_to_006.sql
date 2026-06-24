-- ============================================================
-- SYAMSA PWA - Complete Supabase Migration
-- Combined from migrations 001-006
-- Run this file in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

BEGIN;

-- ============================================================
-- Enable UUID extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: musyrif (Teacher/Monitor accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS musyrif (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    google_subject TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_musyrif_email ON musyrif(email);

-- ============================================================
-- TABLE: kelas (Classes - multi-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS kelas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_kelas TEXT UNIQUE NOT NULL,
    wali_kelas TEXT,
    musyrif_id UUID REFERENCES musyrif(id) ON DELETE SET NULL,
    musyrif_email TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kelas_musyrif_email ON kelas USING GIN (musyrif_email);
CREATE INDEX IF NOT EXISTS idx_kelas_musyrif_id ON kelas(musyrif_id);

-- ============================================================
-- TABLE: student (Santri - Student data)
-- ============================================================
CREATE TABLE IF NOT EXISTS student (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nis TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    kelas_id UUID REFERENCES kelas(id) ON DELETE CASCADE,
    asrama TEXT,
    wali_khusus TEXT DEFAULT '',
    musyrif_khusus TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_nis ON student(nis);
CREATE INDEX IF NOT EXISTS idx_student_kelas ON student(kelas_id);

-- ============================================================
-- TABLE: attendance_record (Data Absensi)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_record (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kelas_id UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    date_key DATE NOT NULL,
    slot_id TEXT NOT NULL,
    status JSONB NOT NULL DEFAULT '{}',
    timestamps JSONB DEFAULT '{}',
    audit_trail JSONB DEFAULT '[]',
    note TEXT DEFAULT '',
    permit_manual_override BOOLEAN DEFAULT FALSE,
    requires_review BOOLEAN DEFAULT TRUE,
    review_confirmed BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(kelas_id, student_id, date_key, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_lookup ON attendance_record(kelas_id, date_key, slot_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_record(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_record(date_key);

-- ============================================================
-- TABLE: permit (Izin Sakit/Izin/Pulang)
-- ============================================================
CREATE TABLE IF NOT EXISTS permit (
    id TEXT PRIMARY KEY,
    kelas_id UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
    nis TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('sakit', 'izin', 'pulang')),
    reason TEXT NOT NULL,
    start_date DATE NOT NULL,
    start_session TEXT,
    end_date DATE,
    end_session TEXT,
    end_time_limit TIME,
    start_time_limit TIME,
    location TEXT,
    pickup TEXT,
    vehicle TEXT,
    status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    status_label TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    requires_surat_dokter BOOLEAN DEFAULT FALSE,
    document_url TEXT,
    audit_trail JSONB DEFAULT '[]',
    nama_wali TEXT,
    alamat_wali TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permit_student ON permit(student_id);
CREATE INDEX IF NOT EXISTS idx_permit_nis ON permit(nis);
CREATE INDEX IF NOT EXISTS idx_permit_dates ON permit(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_permit_active ON permit(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_permit_kelas ON permit(kelas_id);

-- ============================================================
-- TABLE: user_settings (Preferensi Pengguna)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES musyrif(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{"darkMode":false,"notifications":true,"autoSave":true,"notificationTypes":{}}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

-- ============================================================
-- TABLE: activity_log (Audit Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES musyrif(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(created_at DESC);

-- ============================================================
-- TABLE: sync_metadata (Track sync state per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES musyrif(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_sync_metadata_user ON sync_metadata(user_id);

-- ============================================================
-- TABLE: notifications (In-app notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('musyrif', 'wali')),
    recipient_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    deep_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- TABLE: admin_emails (Admin bypass configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_emails (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: announcements (System announcements)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: wali_password (Wali authentication)
-- ============================================================
CREATE TABLE IF NOT EXISTS wali_password (
    nis TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: tahfizh_record (Quran memorization records)
-- ============================================================
CREATE TABLE IF NOT EXISTS tahfizh_record (
    id TEXT PRIMARY KEY,
    musyrif TEXT NOT NULL,
    nama_santri TEXT NOT NULL,
    kelas TEXT NOT NULL,
    program TEXT,
    jenis TEXT,
    juz TEXT,
    tanggal DATE,
    kualitas TEXT,
    status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE musyrif ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE student ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE wali_password ENABLE ROW LEVEL SECURITY;
ALTER TABLE tahfizh_record ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Musyrif Policies (authenticated users)
-- ============================================================
CREATE POLICY "Musyrif can view own profile" ON musyrif
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Musyrif can update own profile" ON musyrif
    FOR UPDATE USING (auth.jwt() ->> 'email' = email);

-- ============================================================
-- Kelas Policies
-- ============================================================
CREATE POLICY "Musyrif can view assigned classes" ON kelas
    FOR SELECT USING (musyrif_email @> ARRAY[auth.jwt() ->> 'email']);

CREATE POLICY "Musyrif can update assigned classes" ON kelas
    FOR UPDATE USING (musyrif_email @> ARRAY[auth.jwt() ->> 'email']);

-- Anonymous access for Wali mode
CREATE POLICY "Allow anonymous select kelas" ON kelas
    FOR SELECT TO anon USING (true);

-- Admin bypass
CREATE POLICY "Admin can manage all kelas" ON kelas
    FOR ALL USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- Student Policies
-- ============================================================
CREATE POLICY "Musyrif can view students in their classes" ON student
    FOR SELECT USING (
        kelas_id IN (SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email'])
    );

CREATE POLICY "Musyrif can insert students in their classes" ON student
    FOR INSERT WITH CHECK (
        kelas_id IN (SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email'])
    );

CREATE POLICY "Musyrif can update students in their classes" ON student
    FOR UPDATE USING (
        kelas_id IN (SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email'])
    );

-- Anonymous access for Wali mode
CREATE POLICY "Allow anonymous select student" ON student
    FOR SELECT TO anon USING (true);

-- Admin bypass
CREATE POLICY "Admin can manage all student" ON student
    FOR ALL USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- Attendance Policies
-- ============================================================
CREATE POLICY "Musyrif can CRUD attendance in their classes" ON attendance_record
    FOR ALL USING (
        kelas_id IN (SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email'])
    );

-- Anonymous access for Wali mode
CREATE POLICY "Allow anonymous select attendance" ON attendance_record
    FOR SELECT TO anon USING (true);

-- Admin bypass
CREATE POLICY "Admin can manage all attendance" ON attendance_record
    FOR ALL USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- Permit Policies
-- ============================================================
CREATE POLICY "Musyrif can CRUD permits in their classes" ON permit
    FOR ALL USING (
        kelas_id IN (SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email'])
    );

-- Anonymous access for Wali mode
CREATE POLICY "Allow anonymous select permit" ON permit
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous insert permit" ON permit
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous update permit" ON permit
    FOR UPDATE TO anon USING (true);

-- Admin bypass
CREATE POLICY "Admin can manage all permit" ON permit
    FOR ALL USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- User Settings Policies
-- ============================================================
CREATE POLICY "Musyrif can view own settings" ON user_settings
    FOR SELECT USING (
        user_id IN (SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email')
    );

CREATE POLICY "Musyrif can update own settings" ON user_settings
    FOR ALL USING (
        user_id IN (SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email')
    );

-- Admin bypass
CREATE POLICY "Admin can manage all user_settings" ON user_settings
    FOR ALL USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- Activity Log Policies
-- ============================================================
CREATE POLICY "Musyrif can view activity logs" ON activity_log
    FOR SELECT USING (
        user_id IN (SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email')
    );

CREATE POLICY "Musyrif can insert activity logs" ON activity_log
    FOR INSERT WITH CHECK (
        user_id IN (SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email')
    );

-- Admin bypass
CREATE POLICY "Admin can manage all activity_log" ON activity_log
    FOR ALL USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- Sync Metadata Policies
-- ============================================================
CREATE POLICY "Musyrif can manage own sync metadata" ON sync_metadata
    FOR ALL USING (
        user_id IN (SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email')
    );

-- Admin bypass
CREATE POLICY "Admin can manage all sync_metadata" ON sync_metadata
    FOR ALL USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- Notifications Policies
-- ============================================================
CREATE POLICY "Allow select notifications" ON notifications
    FOR SELECT USING (true);

CREATE POLICY "Allow insert notifications" ON notifications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update notifications" ON notifications
    FOR UPDATE USING (true);

-- ============================================================
-- Admin Emails Policies
-- ============================================================
CREATE POLICY "Allow select admin_emails" ON admin_emails
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert admin_emails" ON admin_emails
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update admin_emails" ON admin_emails
    FOR UPDATE TO authenticated USING (true);

-- ============================================================
-- Announcements Policies
-- ============================================================
CREATE POLICY "Allow select announcements" ON announcements
    FOR SELECT USING (true);

CREATE POLICY "Allow admin CRUD announcements" ON announcements
    FOR ALL USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- Wali Password Policies
-- ============================================================
CREATE POLICY "Allow select wali_password" ON wali_password
    FOR SELECT USING (true);

CREATE POLICY "Allow insert wali_password" ON wali_password
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update wali_password" ON wali_password
    FOR UPDATE USING (true);

CREATE POLICY "Allow admin delete wali_password" ON wali_password
    FOR DELETE USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- Tahfizh Record Policies
-- ============================================================
CREATE POLICY "Allow select tahfizh_record" ON tahfizh_record
    FOR SELECT USING (true);

CREATE POLICY "Allow all insert tahfizh_record" ON tahfizh_record
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update tahfizh_record" ON tahfizh_record
    FOR UPDATE USING (true);

CREATE POLICY "Allow admin delete tahfizh_record" ON tahfizh_record
    FOR DELETE USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_emails));

-- ============================================================
-- TRIGGERS for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER musyrif_updated_at
    BEFORE UPDATE ON musyrif
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER kelas_updated_at
    BEFORE UPDATE ON kelas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER student_updated_at
    BEFORE UPDATE ON student
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER permit_updated_at
    BEFORE UPDATE ON permit
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sync_metadata_updated_at
    BEFORE UPDATE ON sync_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION get_musyrif_id_by_email(user_email TEXT)
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM musyrif WHERE email = user_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_or_create_musyrif(
    p_email TEXT,
    p_name TEXT,
    p_google_subject TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    musyrif_id UUID;
BEGIN
    SELECT id INTO musyrif_id FROM musyrif WHERE email = p_email;
    IF musyrif_id IS NULL THEN
        INSERT INTO musyrif (email, name, google_subject)
        VALUES (p_email, p_name, p_google_subject)
        RETURNING id INTO musyrif_id;
    END IF;
    RETURN musyrif_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION upsert_attendance(
    p_kelas_id UUID,
    p_student_id UUID,
    p_date_key DATE,
    p_slot_id TEXT,
    p_status JSONB,
    p_timestamps JSONB DEFAULT '{}',
    p_audit_trail JSONB DEFAULT '[]',
    p_note TEXT DEFAULT '',
    p_permit_manual_override BOOLEAN DEFAULT FALSE
)
RETURNS UUID AS $$
DECLARE
    record_id UUID;
BEGIN
    INSERT INTO attendance_record (
        kelas_id, student_id, date_key, slot_id,
        status, timestamps, audit_trail, note, permit_manual_override
    ) VALUES (
        p_kelas_id, p_student_id, p_date_key, p_slot_id,
        p_status, p_timestamps, p_audit_trail, p_note, p_permit_manual_override
    )
    ON CONFLICT (kelas_id, student_id, date_key, slot_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        timestamps = EXCLUDED.timestamps,
        audit_trail = EXCLUDED.audit_trail,
        note = EXCLUDED.note,
        permit_manual_override = EXCLUDED.permit_manual_override,
        updated_at = NOW()
    RETURNING id INTO record_id;

    RETURN record_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Enable Realtime Publications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE permit;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_record;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE wali_password;
ALTER PUBLICATION supabase_realtime ADD TABLE tahfizh_record;

COMMIT;

-- ============================================================
-- POST-MIGRATION: Create Storage Bucket (run separately if needed)
-- ============================================================
-- Note: Storage buckets are best created via Supabase Dashboard
-- Go to: Storage > New Bucket > Name: permit-documents > Set as Private
-- Then apply storage RLS policies below:

/*
-- Run these AFTER creating the bucket via dashboard:

-- Create bucket via SQL (alternative)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'permit-documents',
    'permit-documents',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "musyrif_upload_own_documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'permit-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "musyrif_view_own_documents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'permit-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "musyrif_update_own_documents" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'permit-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "musyrif_delete_own_documents" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'permit-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
*/