-- ============================================================
-- DROP ALL TABLES (Reset Database)
-- ============================================================
-- Run this first to clean slate, then run schema.sql

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS public.musyrif_journals CASCADE;
DROP TABLE IF EXISTS public.activity_logs CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.tahfizh CASCADE;
DROP TABLE IF EXISTS public.permits CASCADE;
DROP TABLE IF EXISTS public.attendances CASCADE;

-- Drop functions/triggers if any
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Verify deletion
SELECT 'All tables dropped!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
