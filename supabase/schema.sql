-- SQL Schema untuk database Supabase (Syamsa PWA)

-- 1. Tabel: attendances (Data Presensi)
CREATE TABLE IF NOT EXISTS public.attendances (
    id TEXT PRIMARY KEY, -- Format composite: {date}_{slot}_{studentId}
    date TEXT NOT NULL, -- YYYY-MM-DD
    slot TEXT NOT NULL, -- shubuh | sekolah | ashar | maghrib | isya
    "studentId" TEXT NOT NULL, -- NIS Santri
    kelas TEXT NOT NULL, -- Nama Kelas
    status JSONB NOT NULL DEFAULT '{}'::jsonb, -- { activityId: status }
    note TEXT DEFAULT '',
    timestamps JSONB DEFAULT '{}'::jsonb, -- { activityId: ISO8601 }
    "auditTrail" JSONB DEFAULT '[]'::jsonb, -- Log perubahan data
    _version INTEGER DEFAULT 1, -- Optimistic locking version
    "_createdAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    "_updatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes untuk query cepat
CREATE INDEX IF NOT EXISTS idx_attendances_date ON public.attendances(date);
CREATE INDEX IF NOT EXISTS idx_attendances_slot ON public.attendances(slot);
CREATE INDEX IF NOT EXISTS idx_attendances_student ON public.attendances("studentId");
CREATE INDEX IF NOT EXISTS idx_attendances_kelas ON public.attendances(kelas);
CREATE INDEX IF NOT EXISTS idx_attendances_date_slot ON public.attendances(date, slot);
CREATE INDEX IF NOT EXISTS idx_attendances_date_slot_kelas ON public.attendances(date, slot, kelas);

-- 2. Tabel: permits (Data Perizinan)
CREATE TABLE IF NOT EXISTS public.permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nis TEXT NOT NULL,
    kelas TEXT NOT NULL,
    category TEXT NOT NULL, -- sakit | izin | pulang
    reason TEXT NOT NULL,
    start_date TEXT NOT NULL, -- YYYY-MM-DD
    end_date TEXT, -- YYYY-MM-DD
    start_session TEXT,
    end_session TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    is_active BOOLEAN DEFAULT true,
    document TEXT, -- Dokumen pendukung (Base64 atau URL)
    audit_trail JSONB DEFAULT '[]'::jsonb,
    _version INTEGER DEFAULT 1,
    "_createdAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    "_updatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_permits_nis ON public.permits(nis);
CREATE INDEX IF NOT EXISTS idx_permits_kelas ON public.permits(kelas);
CREATE INDEX IF NOT EXISTS idx_permits_status ON public.permits(status);
CREATE INDEX IF NOT EXISTS idx_permits_nis_start ON public.permits(nis, start_date);

-- 3. Tabel: tahfizh (Data Setoran Hafalan)
CREATE TABLE IF NOT EXISTS public.tahfizh (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nis TEXT NOT NULL,
    kelas TEXT NOT NULL,
    program TEXT NOT NULL, -- Ziyadah | Murojaah
    jenis TEXT NOT NULL, -- Ziyadah | Murojaah
    juz TEXT NOT NULL,
    halaman TEXT NOT NULL,
    surat TEXT NOT NULL,
    kualitas TEXT NOT NULL, -- Lancar | Sedang | Kurang
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending | Verified | Rejected
    musyrif TEXT NOT NULL,
    tanggal TEXT NOT NULL, -- YYYY-MM-DD
    _version INTEGER DEFAULT 1,
    "_createdAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    "_updatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tahfizh_nis ON public.tahfizh(nis);
CREATE INDEX IF NOT EXISTS idx_tahfizh_kelas ON public.tahfizh(kelas);
CREATE INDEX IF NOT EXISTS idx_tahfizh_tanggal ON public.tahfizh(tanggal);
CREATE INDEX IF NOT EXISTS idx_tahfizh_status ON public.tahfizh(status);

-- 4. Tabel: settings (Konfigurasi Aplikasi & User Settings)
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY, -- 'user_settings' | 'kelas_settings' | 'app_config'
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    _version INTEGER DEFAULT 1,
    "_updatedAt" TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Tabel: activity_logs (Log Audit Trail)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    detail TEXT NOT NULL,
    "user" TEXT NOT NULL,
    kelas TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index log
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON public.activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_kelas ON public.activity_logs(kelas);

-- ============================================================
-- ENABLE REALTIME REPLICATION
-- ============================================================

-- Menyalakan fitur realtime replication di Supabase untuk sinkronisasi instan
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.permits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tahfizh;
ALTER PUBLICATION supabase_realtime ADD TABLE public.settings;
