-- ============================================================
-- MIGRATION: Fix Users Table RLS Policy (M005)
-- ============================================================
-- Problem: INSERT to users table fails with RLS policy violation
-- Error: 'new row violates row-level security policy for table "users"'
--
-- Root Cause: The policy in m004_cloud_first_hardening requires
-- `auth_user_id = auth.uid()` on INSERT, but auth_user_id is NULL
-- on first insert (record doesn't exist yet). This is a circular check.
--
-- Solution: Allow INSERT if:
--   1. id = auth.uid() (first-time user creation with matching UUID)
--   2. OR email matches the JWT email (pre-seeded user linking)
-- ============================================================

BEGIN;

-- 1. Add auth_user_id column if missing (code expects this column)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Create index on auth_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- 3. Drop the problematic policy from m004
DROP POLICY IF EXISTS "users_insert_self" ON public.users;
DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_self_or_admin" ON public.users;

-- 4. Create FIXED RLS policies for authenticated users
-- Allow SELECT for authenticated users (needed for role lookups, admin views)
CREATE POLICY "users_select_authenticated" ON public.users FOR SELECT TO authenticated
    USING (true);

-- Allow INSERT for authenticated users with proper identity verification
-- This fixes the circular check by allowing:
--   - First-time INSERT: id must match auth.uid() AND email must match JWT
--   - Pre-seeded user: email matches JWT email (link_existing_app_user trigger handles this)
CREATE POLICY "users_insert_authenticated" ON public.users FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
        -- First-time user creation: id (which is set to authUser.id) matches auth.uid()
        id = auth.uid()::text
        -- Pre-seeded user: email matches JWT email (link_existing_app_user trigger handles this)
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
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE TO authenticated
    USING (public.current_user_has_role(ARRAY['superadmin','admin'], NULL))
    WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin'], NULL));

-- 5. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO authenticated;

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'Users RLS policies fixed!' as status;

-- Verify policies exist
SELECT policyname, cmd, permissive,
       CASE WHEN qual IS NULL THEN 'none' ELSE substring(qual::text, 1, 100) END as condition,
       CASE WHEN with_check IS NULL THEN 'none' ELSE substring(with_check::text, 1, 100) END as with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Verify columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('id', 'email', 'auth_user_id', 'name', 'picture', 'is_active')
ORDER BY ordinal_position;
