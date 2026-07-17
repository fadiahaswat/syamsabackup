-- ============================================================
-- MIGRATION: Fix ALL RLS Policies (M008)
-- ============================================================
-- Drops restrictive policies and creates permissive ones
-- for authenticated users (service account and Google OAuth)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. REVOKE ALL FROM ANON (optional but recommended)
-- ============================================================
REVOKE ALL ON SCHEMA public FROM anon;
REVOKE ALL ON TABLE public.attendances FROM anon;
REVOKE ALL ON TABLE public.permits FROM anon;
REVOKE ALL ON TABLE public.tahfizh FROM anon;
REVOKE ALL ON TABLE public.settings FROM anon;
REVOKE ALL ON TABLE public.activity_logs FROM anon;
REVOKE ALL ON TABLE public.musyrif_journals FROM anon;
REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM anon;
REVOKE ALL ON TABLE public.wali_credentials FROM anon;
REVOKE ALL ON TABLE public.app_records FROM anon;

-- ============================================================
-- 2. GRANT PERMISSIONS TO AUTHENTICATED
-- ============================================================

-- Core business tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendances TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.permits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tahfizh TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.settings TO authenticated;
GRANT SELECT, INSERT ON TABLE public.activity_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.musyrif_journals TO authenticated;

-- User management
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sync_state TO authenticated;

-- Wali
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wali_credentials TO authenticated;

-- App records
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_records TO authenticated;

-- Service functions
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_nis TO authenticated;

-- ============================================================
-- 3. DROP ALL EXISTING POLICIES
-- ============================================================

-- Drop attendances policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'attendances'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop permits policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'permits'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop tahfizh policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'tahfizh'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop settings policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop activity_logs policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'activity_logs'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop musyrif_journals policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'musyrif_journals'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop users policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop user_roles policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'user_roles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop wali_credentials policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'wali_credentials'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Drop app_records policies
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE tablename = 'app_records'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 4. CREATE NEW PERMISSIVE POLICIES FOR AUTHENTICATED
-- ============================================================

-- ATTENDANCES: Allow all authenticated users
CREATE POLICY "attendances_all_auth" ON public.attendances FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- PERMITS: Allow all authenticated users
CREATE POLICY "permits_all_auth" ON public.permits FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- TAHFIZH: Allow all authenticated users
CREATE POLICY "tahfizh_all_auth" ON public.tahfizh FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- SETTINGS: Allow all authenticated users
CREATE POLICY "settings_all_auth" ON public.settings FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- ACTIVITY_LOGS: Allow all authenticated users
CREATE POLICY "activity_logs_all_auth" ON public.activity_logs FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- MUSYRIF_JOURNALS: Allow all authenticated users
CREATE POLICY "journals_all_auth" ON public.musyrif_journals FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- USERS: Allow all authenticated users to read, insert, update
CREATE POLICY "users_all_auth" ON public.users FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- USER_ROLES: Allow all authenticated users
CREATE POLICY "user_roles_all_auth" ON public.user_roles FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- WALI_CREDENTIALS: Allow all authenticated users
CREATE POLICY "wali_credentials_all_auth" ON public.wali_credentials FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

-- APP_RECORDS: Allow all authenticated users
CREATE POLICY "app_records_all_auth" ON public.app_records FOR ALL TO authenticated USING (auth.uid() IS NOT NULL);

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'All RLS policies fixed!' as status;

-- Check policies
SELECT tablename, policyname, cmd, permissive
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
