-- ============================================================
-- SYAMSA PWA - Supabase Migration 001
-- Initial Schema for Hybrid Cloud Storage
-- ============================================================

-- Enable UUID extension
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

-- Index for email lookups
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

-- Index for musyrif lookups (GIN for array contains)
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

-- Musyrif policies (users can only see/edit their own data)
-- Note: Using email as identifier since google_subject may vary

CREATE POLICY "Musyrif can view own profile" ON musyrif
    FOR SELECT USING (
        auth.jwt() ->> 'email' = email
    );

CREATE POLICY "Musyrif can update own profile" ON musyrif
    FOR UPDATE USING (
        auth.jwt() ->> 'email' = email
    );

-- Kelas policies (musyrif can access classes where their email is registered)
CREATE POLICY "Musyrif can view assigned classes" ON kelas
    FOR SELECT USING (
        musyrif_email @> ARRAY[auth.jwt() ->> 'email']
    );

CREATE POLICY "Musyrif can update assigned classes" ON kelas
    FOR UPDATE USING (
        musyrif_email @> ARRAY[auth.jwt() ->> 'email']
    );

-- Student policies
CREATE POLICY "Musyrif can view students in their classes" ON student
    FOR SELECT USING (
        kelas_id IN (
            SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email']
        )
    );

CREATE POLICY "Musyrif can insert students in their classes" ON student
    FOR INSERT WITH CHECK (
        kelas_id IN (
            SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email']
        )
    );

CREATE POLICY "Musyrif can update students in their classes" ON student
    FOR UPDATE USING (
        kelas_id IN (
            SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email']
        )
    );

-- Attendance policies
CREATE POLICY "Musyrif can CRUD attendance in their classes" ON attendance_record
    FOR ALL USING (
        kelas_id IN (
            SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email']
        )
    );

-- Permit policies
CREATE POLICY "Musyrif can CRUD permits in their classes" ON permit
    FOR ALL USING (
        kelas_id IN (
            SELECT id FROM kelas WHERE musyrif_email @> ARRAY[auth.jwt() ->> 'email']
        )
    );

-- User settings policies
CREATE POLICY "Musyrif can view own settings" ON user_settings
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Musyrif can update own settings" ON user_settings
    FOR ALL USING (
        user_id IN (
            SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email'
        )
    );

-- Activity log policies
CREATE POLICY "Musyrif can view activity logs" ON activity_log
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email'
        )
    );

CREATE POLICY "Musyrif can insert activity logs" ON activity_log
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email'
        )
    );

-- Sync metadata policies
CREATE POLICY "Musyrif can manage own sync metadata" ON sync_metadata
    FOR ALL USING (
        user_id IN (
            SELECT id FROM musyrif WHERE email = auth.jwt() ->> 'email'
        )
    );

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

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to get musyrif ID by email
CREATE OR REPLACE FUNCTION get_musyrif_id_by_email(user_email TEXT)
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT id FROM musyrif WHERE email = user_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create musyrif record
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

-- Function to upsert attendance record
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
