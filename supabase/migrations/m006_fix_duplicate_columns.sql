-- ============================================================
-- MIGRATION: Fix Duplicate Columns in Users Table (M006)
-- ============================================================
-- Problem: Table has duplicate columns (id text, id uuid) and (email text, email varchar)
-- This causes RLS policies to fail and INSERT to break
-- ============================================================

BEGIN;

-- 1. Check current state of columns
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Drop all existing policies first
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- 3. Create backup table with correct schema
CREATE TABLE IF NOT EXISTS public.users_backup AS
SELECT
    -- Keep only the UUID id, discard the text one
    id::uuid as id,
    email::text as email,
    name,
    picture,
    auth_provider,
    is_active,
    created_at,
    updated_at,
    last_login,
    metadata,
    -- Convert auth_user_id to UUID if it's text
    CASE
        WHEN auth_user_id IS NULL THEN NULL
        WHEN auth_user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN auth_user_id::uuid
        ELSE NULL
    END as auth_user_id
FROM public.users;

-- 4. Drop the broken table
DROP TABLE IF EXISTS public.users CASCADE;

-- 5. Create correct table with proper schema
CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    auth_provider TEXT DEFAULT 'google',
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- 6. Copy data back
INSERT INTO public.users (
    id, email, name, picture, auth_provider, auth_user_id, is_active,
    created_at, updated_at, last_login, metadata
)
SELECT
    id, email, name, picture, COALESCE(auth_provider, 'google'), auth_user_id,
    COALESCE(is_active, true),
    COALESCE(created_at, NOW()),
    COALESCE(updated_at, NOW()),
    last_login,
    COALESCE(metadata, '{}'::jsonb)
FROM public.users_backup;

-- 7. Drop backup
DROP TABLE IF EXISTS public.users_backup;

-- 8. Create proper indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);

-- 9. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 10. Create FIXED RLS policies
-- Allow SELECT for authenticated users
CREATE POLICY "users_select_authenticated" ON public.users FOR SELECT TO authenticated
    USING (true);

-- Allow INSERT for authenticated users
-- id must match auth.uid() OR email must match JWT email
CREATE POLICY "users_insert_authenticated" ON public.users FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
        id = auth.uid()
        OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
);

-- Allow users to UPDATE their own profile
CREATE POLICY "users_update_self" ON public.users FOR UPDATE TO authenticated
    USING (
        id = public.current_app_user_id()
        OR auth_user_id = auth.uid()
    )
    WITH CHECK (
        id = public.current_app_user_id()
        OR auth_user_id = auth.uid()
    );

-- Allow admins to update any user
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE TO authenticated
    USING (public.current_user_has_role(ARRAY['superadmin','admin'], NULL))
    WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin'], NULL));

-- 11. Grant permissions
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO authenticated;

-- 12. Trigger for updated_at
DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'Users table fixed!' as status;

-- Check final column structure
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check policies
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Check row count
SELECT 'Row count: ' || COUNT(*)::text as status FROM public.users;
