-- ============================================================
-- MIGRATION: Wali Cloud Sync Setup (M007)
-- ============================================================
-- Enables Wali users to sync data to cloud via service account
-- 1. Creates wali_credentials table with password_hash
-- 2. Sets up RLS policies
-- 3. Updates permits RLS for Wali service account access
-- ============================================================

BEGIN;

-- 1. Create/update wali_credentials table
DROP TABLE IF EXISTS public.wali_credentials;

CREATE TABLE public.wali_credentials (
    nis TEXT PRIMARY KEY,
    nama TEXT,
    kelas TEXT,
    password_hash TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    password_changed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_wali_credentials_nis ON public.wali_credentials(nis);
CREATE INDEX IF NOT EXISTS idx_wali_credentials_kelas ON public.wali_credentials(kelas);

-- 3. Enable RLS
ALTER TABLE public.wali_credentials ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies
DROP POLICY IF EXISTS "wali_credentials_all" ON public.wali_credentials;
DROP POLICY IF EXISTS "wali_credentials_service" ON public.wali_credentials;
DROP POLICY IF EXISTS "wali_credentials_read_musyrif" ON public.wali_credentials;
DROP POLICY IF EXISTS "wali_credentials_read" ON public.wali_credentials;

-- 5. Create RLS policies
-- Service account (wali-service@syamsa.app) can do everything
CREATE POLICY "wali_credentials_service" ON public.wali_credentials FOR ALL
TO authenticated
USING (
    auth.jwt() ->> 'email' = 'wali-service@syamsa.app'
);

-- Anyone authenticated can read (for login verification)
CREATE POLICY "wali_credentials_read" ON public.wali_credentials FOR SELECT
TO authenticated USING (true);

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE ON TABLE public.wali_credentials TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 7. Create trigger for updated_at
DROP TRIGGER IF EXISTS wali_credentials_updated_at ON public.wali_credentials;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wali_credentials_updated_at
    BEFORE UPDATE ON public.wali_credentials
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Update permits RLS to allow Wali (service account)
-- Drop old policies and recreate
DROP POLICY IF EXISTS "permits_insert_wali" ON public.permits;
DROP POLICY IF EXISTS "permits_select_wali" ON public.permits;
DROP POLICY IF EXISTS "permits_all" ON public.permits;
DROP POLICY IF EXISTS "permits_select_scoped" ON public.permits;
DROP POLICY IF EXISTS "permits_write_staff" ON public.permits;

-- Musyrif/Admin can read all
CREATE POLICY "permits_select_scoped" ON public.permits FOR SELECT TO authenticated
USING (
    -- Musyrif/Admin can read
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        JOIN public.users u ON u.id = ur.user_id
        WHERE u.auth_user_id = auth.uid()
        AND ur.is_active = true
        AND r.name IN ('admin', 'superadmin', 'koordinator', 'musyrif')
    )
    OR
    -- Service account (Wali) can read
    auth.jwt() ->> 'email' = 'wali-service@syamsa.app'
);

-- Musyrif/Admin can write
CREATE POLICY "permits_write_staff" ON public.permits FOR ALL TO authenticated
USING (
    -- Musyrif/Admin can write
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        JOIN public.users u ON u.id = ur.user_id
        WHERE u.auth_user_id = auth.uid()
        AND ur.is_active = true
        AND r.name IN ('admin', 'superadmin', 'koordinator', 'musyrif')
    )
    OR
    -- Service account (Wali) can insert/update permits
    auth.jwt() ->> 'email' = 'wali-service@syamsa.app'
);

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'Wali Cloud Sync setup complete!' as status;

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'wali_credentials'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('wali_credentials', 'permits')
ORDER BY tablename, policyname;
