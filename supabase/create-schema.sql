-- ============================================================
-- CREATE SCHEMA - For Fresh Database
-- ============================================================

-- 1. CREATE TABLES
-- ============================================================

-- ATTENDANCES
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

-- PERMITS
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

-- TAHFIZH
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

-- SETTINGS
CREATE TABLE public.settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}',
    _version INTEGER DEFAULT 1,
    "_updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ACTIVITY_LOGS
CREATE TABLE public.activity_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    "user" TEXT NOT NULL,
    kelas TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- MUSYRIF_JOURNALS
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
-- 2. CREATE INDEXES
-- ============================================================

CREATE INDEX idx_attendances_date ON public.attendances(date);
CREATE INDEX idx_attendances_slot ON public.attendances(slot);
CREATE INDEX idx_attendances_student ON public.attendances("studentId");
CREATE INDEX idx_attendances_kelas ON public.attendances(kelas);
CREATE INDEX idx_attendances_updated ON public.attendances("_updatedAt");

CREATE INDEX idx_permits_nis ON public.permits(nis);
CREATE INDEX idx_permits_kelas ON public.permits(kelas);
CREATE INDEX idx_permits_status ON public.permits(status);
CREATE INDEX idx_permits_updated ON public.permits("_updatedAt");

CREATE INDEX idx_tahfizh_nis ON public.tahfizh(nis);
CREATE INDEX idx_tahfizh_kelas ON public.tahfizh(kelas);
CREATE INDEX idx_tahfizh_tanggal ON public.tahfizh(tanggal);
CREATE INDEX idx_tahfizh_musyrif ON public.tahfizh(musyrif);
CREATE INDEX idx_tahfizh_updated ON public.tahfizh("_updatedAt");

CREATE INDEX idx_journals_musyrif ON public.musyrif_journals(musyrif_id);
CREATE INDEX idx_journals_kelas ON public.musyrif_journals(kelas);
CREATE INDEX idx_journals_tanggal ON public.musyrif_journals(tanggal);
CREATE INDEX idx_journals_updated ON public.musyrif_journals("_updatedAt");

-- ============================================================
-- 3. ENABLE RLS
-- ============================================================

ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tahfizh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.musyrif_journals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. CREATE RLS POLICIES
-- ============================================================

CREATE POLICY "attendances_all" ON public.attendances FOR ALL TO anon USING (true);
CREATE POLICY "permits_all" ON public.permits FOR ALL TO anon USING (true);
CREATE POLICY "tahfizh_all" ON public.tahfizh FOR ALL TO anon USING (true);
CREATE POLICY "settings_all" ON public.settings FOR ALL TO anon USING (true);
CREATE POLICY "activity_logs_all" ON public.activity_logs FOR ALL TO anon USING (true);
CREATE POLICY "journals_all" ON public.musyrif_journals FOR ALL TO anon USING (true);

-- ============================================================
-- 5. ENABLE REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.attendances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.permits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tahfizh;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.musyrif_journals;

-- ============================================================
-- 6. INSERT INITIAL DATA
-- ============================================================

INSERT INTO public.settings (id, data) VALUES (
    'app_config',
    '{"version": "1.0.0", "syncEnabled": true}'::jsonb
);

-- ============================================================
-- DONE
-- ============================================================
SELECT 'Schema created!' as status;
