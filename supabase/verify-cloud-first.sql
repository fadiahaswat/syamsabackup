-- Read-only post-deployment checks. Expected result is noted per section.

-- 1) All business tables must have RLS enabled: every row should be true.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = ANY (ARRAY[
    'attendances','permits','tahfizh','settings','activity_logs',
    'musyrif_journals','users','roles','user_roles','user_devices','sessions',
    'sync_state','wali_students','wali_credentials','wali_registration_requests',
    'role_invitations','app_records'
  ])
ORDER BY c.relname;

-- 2) Anon must have no direct table privileges: expected 0 rows.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name = ANY (ARRAY[
    'attendances','permits','tahfizh','settings','activity_logs',
    'musyrif_journals','users','user_roles','user_devices','sessions',
    'sync_state','wali_students','wali_credentials','wali_registration_requests',
    'role_invitations','app_records'
  ]);

-- 3) Every listed domain must be in Supabase Realtime: expected 15 rows.
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename = ANY (ARRAY[
    'attendances','permits','tahfizh','settings','activity_logs',
    'musyrif_journals','users','roles','user_roles','user_devices','sessions',
    'wali_students','wali_registration_requests','role_invitations','app_records'
  ])
ORDER BY tablename;

-- 4) Private document bucket: expected public=false and 5 MB limit.
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'permit-documents';

-- 5) No duplicate active role assignment (NULL class included): expected 0 rows.
SELECT user_id, role_id, COALESCE(kelas, '*') AS scope, COUNT(*)
FROM public.user_roles
WHERE is_active = true
GROUP BY user_id, role_id, COALESCE(kelas, '*')
HAVING COUNT(*) > 1;

-- 6) Legacy app profiles not linked to Auth: review any returned rows.
SELECT id, email
FROM public.users
WHERE auth_user_id IS NULL;

