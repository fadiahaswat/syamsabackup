-- ============================================================
-- RESET DATABASE - Complete Clean Slate
-- ============================================================
-- This script will:
-- 1. Drop all tables
-- 2. Drop all functions/triggers
-- 3. Drop all types
-- 4. Create fresh schema
-- 5. Insert initial data
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DROP ALL TABLES (cascade will handle publications)
-- ============================================================
DROP TABLE IF EXISTS public.musyrif_journals CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.tahfizh CASCADE;
DROP TABLE IF EXISTS public.permits CASCADE;
DROP TABLE IF EXISTS public.attendances CASCADE;

-- ============================================================
-- 3. DROP ALL FUNCTIONS & TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION drop_all_functions()
RETURNS void AS $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN SELECT proname, oid FROM pg_proc WHERE pronamespace = 'public'::regnamespace LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || func_record.proname || ' CASCADE';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT drop_all_functions();
DROP FUNCTION IF EXISTS drop_all_functions();

-- ============================================================
-- 4. VERIFY CLEAN
-- ============================================================
DO $$
DECLARE
    table_count INTEGER;
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count FROM information_schema.tables WHERE table_schema = 'public';
    SELECT COUNT(*) INTO func_count FROM pg_proc WHERE pronamespace = 'public'::regnamespace;

    RAISE NOTICE 'Tables remaining: %', table_count;
    RAISE NOTICE 'Functions remaining: %', func_count;

    IF table_count > 0 OR func_count > 0 THEN
        RAISE WARNING 'Schema may not be completely clean!';
    ELSE
        RAISE NOTICE 'Schema is clean!';
    END IF;
END $$;

-- ============================================================
-- 5. CREATE TABLES
-- ============================================================

-- 5.1 ATTENDANCES
CREATE TABLE public.attendances (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    slot TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    kelas TEXT NOT NULL,
    status JSONB NOT NULL DEFAULT '{}',
    note TEXT DEFAULT '',
    timestamps JSONB DEFAULT '{}',
    "auditTrail" JSONB DEFAULT '[]',
    _version INTEGER DEFAULT 1,
    "_createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "_updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5.2 PERMITS
CREATE TABLE public.permits (
    id TEXT PRIMARY KEY,
    nis TEXT NOT NULL,
    kelas TEXT NOT NULL,
    category TEXT NOT NULL,
    reason TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    start_session TEXT,
    end_session TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    is_active BOOLEAN DEFAULT true,
    document TEXT,
    audit_trail JSONB DEFAULT '[]',
    _version INTEGER DEFAULT 1,
    "_createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "_updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5.3 TAHFIZH
CREATE TABLE public.tahfizh (
    id TEXT PRIMARY KEY,
    nis TEXT NOT NULL,
    kelas TEXT NOT NULL,
    program TEXT NOT NULL,
    jenis TEXT NOT NULL,
    juz TEXT NOT NULL,
    halaman TEXT NOT NULL,
    surat TEXT NOT NULL,
    kualitas TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    musyrif TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    _version INTEGER DEFAULT 1,
    "_createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "_updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5.4 SETTINGS
CREATE TABLE public.settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    _version INTEGER DEFAULT 1,
    "_updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5.5 ACTIVITY_LOGS
CREATE TABLE public.activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    "user" TEXT NOT NULL,
    kelas TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5.6 MUSYRIF_JOURNALS
CREATE TABLE public.musyrif_journals (
    id TEXT PRIMARY KEY,
    musyrif_id TEXT NOT NULL,
    kelas TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    _version INTEGER DEFAULT 1,
    "_createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "_updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. CREATE INDEXES
-- ============================================================

-- Attendances
CREATE INDEX idx_attendances_date ON public.attendances(date);
CREATE INDEX idx_attendances_slot ON public.attendances(slot);
CREATE INDEX idx_attendances_student ON public.attendances("studentId");
CREATE INDEX idx_attendances_kelas ON public.attendances(kelas);
CREATE INDEX idx_attendances_date_slot ON public.attendances(date, slot);
CREATE INDEX idx_attendances_date_kelas ON public.attendances(date, kelas);
CREATE INDEX idx_attendances_updated ON public.attendances("_updatedAt");

-- Permits
CREATE INDEX idx_permits_nis ON public.permits(nis);
CREATE INDEX idx_permits_kelas ON public.permits(kelas);
CREATE INDEX idx_permits_status ON public.permits(status);
CREATE INDEX idx_permits_nis_start ON public.permits(nis, start_date);
CREATE INDEX idx_permits_updated ON public.permits("_updatedAt");

-- Tahfizh
CREATE INDEX idx_tahfizh_nis ON public.tahfizh(nis);
CREATE INDEX idx_tahfizh_kelas ON public.tahfizh(kelas);
CREATE INDEX idx_tahfizh_tanggal ON public.tahfizh(tanggal);
CREATE INDEX idx_tahfizh_musyrif ON public.tahfizh(musyrif);
CREATE INDEX idx_tahfizh_updated ON public.tahfizh("_updatedAt");

-- Journals
CREATE INDEX idx_journals_musyrif ON public.musyrif_journals(musyrif_id);
CREATE INDEX idx_journals_kelas ON public.musyrif_journals(kelas);
CREATE INDEX idx_journals_tanggal ON public.musyrif_journals(tanggal);
CREATE INDEX idx_journals_updated ON public.musyrif_journals("_updatedAt");

-- ============================================================
-- 7. ENABLE RLS
-- ============================================================
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfizh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.musyrif_journals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. CREATE RLS POLICIES (Allow all for anon)
-- ============================================================

-- Attendances
CREATE POLICY "attendances_all" ON public.attendances FOR ALL TO anon USING (true);
CREATE POLICY "attendances_insert" ON public.attendances FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "attendances_update" ON public.attendances FOR UPDATE TO anon USING (true);
CREATE POLICY "attendances_delete" ON public.attendances FOR DELETE TO anon USING (true);

-- Permits
CREATE POLICY "permits_all" ON public.permits FOR ALL TO anon USING (true);
CREATE POLICY "permits_insert" ON public.permits FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "permits_update" ON public.permits FOR UPDATE TO anon USING (true);
CREATE POLICY "permits_delete" ON public.permits FOR DELETE TO anon USING (true);

-- Tahfizh
CREATE POLICY "tahfizh_all" ON public.tahfizh FOR ALL TO anon USING (true);
CREATE POLICY "tahfizh_insert" ON public.tahfizh FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "tahfizh_update" ON public.tahfizh FOR UPDATE TO anon USING (true);
CREATE POLICY "tahfizh_delete" ON public.tahfizh FOR DELETE TO anon USING (true);

-- Settings
CREATE POLICY "settings_all" ON public.settings FOR ALL TO anon USING (true);

-- Activity Logs
CREATE POLICY "activity_logs_all" ON public.activity_logs FOR ALL TO anon USING (true);

-- Journals
CREATE POLICY "journals_all" ON public.musyrif_journals FOR ALL TO anon USING (true);
CREATE POLICY "journals_insert" ON public.musyrif_journals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "journals_update" ON public.musyrif_journals FOR UPDATE TO anon USING (true);
CREATE POLICY "journals_delete" ON public.musyrif_journals FOR DELETE TO anon USING (true);

-- ============================================================
-- 9. ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.permits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tahfizh;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.musyrif_journals;

-- ============================================================
-- 10. INSERT INITIAL DATA
-- ============================================================
INSERT INTO public.settings (id, data) VALUES (
    'app_config',
    '{
        "version": "1.0.0",
        "syncEnabled": true,
        "gps": {
            "enabled": false,
            "latitude": -7.9,
            "longitude": 110.1,
            "radius": 500
        },
        "limits": {
            "maxEditDays": 7,
            "tahfizhDeadline": "23:59"
        },
        "tahfizh": {
            "dailyTarget": 1,
            "weeklyTarget": 5
        }
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE
    t TEXT;
    r INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DATABASE RESET COMPLETE';
    RAISE NOTICE '============================================';

    FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LOOP
        EXECUTE format('SELECT count(*) FROM public.%I', t) INTO r;
        RAISE NOTICE 'Table: % - Rows: %', t, r;
    END LOOP;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'All tables created successfully!';
    RAISE NOTICE 'RLS and Realtime enabled.';
    RAISE NOTICE '============================================';
END $$;
