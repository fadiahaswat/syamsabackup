-- ============================================================
-- M004: CLOUD-FIRST, SECURE RLS, REALTIME, AND LEGACY DOMAINS
-- ============================================================
-- Prerequisite: Google provider is enabled in Supabase Auth.
-- The browser signs in with supabase.auth.signInWithIdToken().

BEGIN;

DROP TRIGGER IF EXISTS sessions_last_used ON public.sessions;
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_device_id_fkey;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_device_id_fkey
  FOREIGN KEY (device_id) REFERENCES public.user_devices(id) ON DELETE SET NULL;

-- Link application users to the real Supabase Auth identity.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.attendances ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.tahfizh ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.users AS app_user
SET auth_user_id = auth_user.id
FROM auth.users AS auth_user
WHERE app_user.auth_user_id IS NULL
  AND lower(app_user.email) = lower(auth_user.email);

UPDATE public.users
SET auth_user_id = id::uuid
WHERE auth_user_id IS NULL
  AND id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

CREATE TABLE IF NOT EXISTS public.wali_students (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nis TEXT NOT NULL,
  kelas TEXT NOT NULL,
  relationship TEXT DEFAULT 'wali',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, nis)
);

CREATE TABLE IF NOT EXISTS public.wali_credentials (
  nis TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wali_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nis TEXT NOT NULL,
  kelas TEXT NOT NULL,
  student_name TEXT NOT NULL,
  guardian_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  kelas TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, role_id, kelas)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wali_registration_pending
  ON public.wali_registration_requests(nis) WHERE status = 'pending';

-- Bridge table for business domains that previously only existed in
-- LocalStorage. `entity_type` is constrained so arbitrary client tables
-- cannot be created through this bridge.
CREATE TABLE IF NOT EXISTS public.app_records (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'announcement', 'violation', 'violation_rule', 'student_target',
    'student_log', 'reminder', 'permit_request', 'permit_document',
    'disciplinary_document', 'holiday_schedule', 'notification',
    'gps_config', 'tahfizh_snapshot'
  )),
  kelas TEXT,
  nis TEXT,
  owner_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  _version INTEGER NOT NULL DEFAULT 1 CHECK (_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wali_students_user ON public.wali_students(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_wali_students_nis ON public.wali_students(nis, is_active);
CREATE INDEX IF NOT EXISTS idx_app_records_type ON public.app_records(entity_type);
CREATE INDEX IF NOT EXISTS idx_app_records_kelas ON public.app_records(kelas);
CREATE INDEX IF NOT EXISTS idx_app_records_nis ON public.app_records(nis);
CREATE INDEX IF NOT EXISTS idx_app_records_updated ON public.app_records(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_records_active ON public.app_records(entity_type, deleted_at);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'permit-documents',
  'permit-documents',
  false,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Resolve the application user through the verified Supabase JWT. All
-- authorization helpers are SECURITY DEFINER to avoid recursive RLS.
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
     OR lower(u.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(
  role_names TEXT[],
  target_kelas TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = public.current_app_user_id()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND r.name = ANY(role_names)
      AND (target_kelas IS NULL OR ur.kelas IS NULL OR ur.kelas = target_kelas)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_access_nis(target_nis TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], NULL)
    OR EXISTS (
      SELECT 1 FROM public.wali_students ws
      WHERE ws.user_id = public.current_app_user_id()
        AND ws.nis = target_nis
        AND ws.is_active = true
    );
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_role(TEXT[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_can_access_nis(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_nis(TEXT) TO authenticated;

-- Preserve roles on pre-existing application profiles when the corresponding
-- Supabase Auth identity is created later (for example, first Google login).
CREATE OR REPLACE FUNCTION public.link_existing_app_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.users
  SET auth_user_id = NEW.id,
      updated_at = NOW()
  WHERE auth_user_id IS NULL
    AND lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.link_existing_app_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS auth_user_link_existing_app_user ON auth.users;
CREATE TRIGGER auth_user_link_existing_app_user
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.link_existing_app_user();

-- Retire legacy SECURITY DEFINER RPCs that trusted caller-supplied user IDs.
REVOKE ALL ON FUNCTION public.get_user_roles(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_has_role_for_kelas(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_highest_role(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_device(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_other_sessions(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_active_sessions(TEXT) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS permit_documents_select ON storage.objects;
CREATE POLICY permit_documents_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'permit-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.app_records ar
      WHERE ar.entity_type = 'permit_document'
        AND ar.deleted_at IS NULL
        AND ar.data ->> 'bucket' = bucket_id
        AND ar.data ->> 'path' = name
        AND (
          public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], ar.kelas)
          OR (ar.kelas IS NOT NULL AND public.current_user_has_role(ARRAY['musyrif'], ar.kelas))
          OR (ar.nis IS NOT NULL AND public.current_user_can_access_nis(ar.nis))
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.permits p
      WHERE (
        p.document = 'storage://permit-documents/' || name
        OR p.metadata ->> 'surat_dokter' = 'storage://permit-documents/' || name
      )
      AND (
        public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], p.kelas)
        OR public.current_user_has_role(ARRAY['musyrif'], p.kelas)
        OR public.current_user_can_access_nis(p.nis)
      )
    )
  )
);
DROP POLICY IF EXISTS permit_documents_insert ON storage.objects;
CREATE POLICY permit_documents_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'permit-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS permit_documents_delete ON storage.objects;
CREATE POLICY permit_documents_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'permit-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.current_user_has_role(ARRAY['superadmin','admin'], NULL)
  )
);

-- Server owns revision numbers. Inbound clients must preserve the returned
-- value and updates use `_version` as an optimistic-concurrency predicate.
CREATE OR REPLACE FUNCTION public.bump_record_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW._version := COALESCE(NEW._version, 1);
  ELSE
    NEW._version := OLD._version + 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_app_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.updated_by := public.current_app_user_id();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'attendances','permits','tahfizh','settings','musyrif_journals','app_records'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_revision ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER %I_revision BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bump_record_revision()',
      table_name, table_name
    );
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS app_records_touch ON public.app_records;
CREATE TRIGGER app_records_touch
BEFORE INSERT OR UPDATE ON public.app_records
FOR EACH ROW EXECUTE FUNCTION public.touch_app_record();

-- Remove permissive and recursive policies from the original schema.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY(ARRAY[
        'attendances','permits','tahfizh','settings','activity_logs',
        'musyrif_journals','users','roles','user_roles','user_devices',
        'sessions','sync_state','wali_students','wali_credentials',
        'wali_registration_requests','role_invitations','app_records'
      ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.wali_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wali_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wali_registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_records ENABLE ROW LEVEL SECURITY;

-- Profile and role administration.
CREATE POLICY users_select_self_or_admin ON public.users FOR SELECT TO authenticated
USING (
  id = public.current_app_user_id()
  OR public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], NULL)
);
CREATE POLICY users_insert_self ON public.users FOR INSERT TO authenticated
WITH CHECK (auth_user_id = auth.uid() AND lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY users_update_self_or_admin ON public.users FOR UPDATE TO authenticated
USING (
  id = public.current_app_user_id()
  OR public.current_user_has_role(ARRAY['superadmin','admin'], NULL)
)
WITH CHECK (
  id = public.current_app_user_id()
  OR public.current_user_has_role(ARRAY['superadmin','admin'], NULL)
);

CREATE POLICY roles_select_authenticated ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY user_roles_select_scoped ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = public.current_app_user_id()
  OR public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], kelas)
);
CREATE POLICY user_roles_manage_admin ON public.user_roles FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin'], kelas))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin'], kelas));

CREATE POLICY role_invitations_admin ON public.role_invitations FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin'], kelas))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin'], kelas));

CREATE POLICY wali_students_select_scoped ON public.wali_students FOR SELECT TO authenticated
USING (
  user_id = public.current_app_user_id()
  OR public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas)
);
CREATE POLICY wali_students_manage_admin ON public.wali_students FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin'], kelas))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin'], kelas));

CREATE POLICY wali_registration_admin ON public.wali_registration_requests FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin'], NULL))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin'], NULL));

CREATE OR REPLACE FUNCTION public.assign_invited_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (id, user_id, role_id, kelas, assigned_at, is_active)
  SELECT
    'ur_' || md5(NEW.id || ':' || ri.role_id || ':' || COALESCE(ri.kelas, '*')),
    NEW.id,
    ri.role_id,
    ri.kelas,
    NOW(),
    true
  FROM public.role_invitations ri
  WHERE lower(ri.email) = lower(NEW.email)
    AND ri.is_active = true
    AND (ri.expires_at IS NULL OR ri.expires_at > NOW())
  ON CONFLICT (user_id, role_id, kelas) DO UPDATE SET is_active = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_assign_invited_roles ON public.users;
CREATE TRIGGER users_assign_invited_roles
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.assign_invited_roles();

-- Core business tables.
CREATE POLICY attendances_select_scoped ON public.attendances FOR SELECT TO authenticated
USING (
  public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas)
  OR public.current_user_can_access_nis("studentId")
);
CREATE POLICY attendances_write_staff ON public.attendances FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas));

CREATE POLICY permits_select_scoped ON public.permits FOR SELECT TO authenticated
USING (
  public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas)
  OR public.current_user_can_access_nis(nis)
);
CREATE POLICY permits_write_staff ON public.permits FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas));

CREATE POLICY tahfizh_select_scoped ON public.tahfizh FOR SELECT TO authenticated
USING (
  public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif','ustadz'], kelas)
  OR public.current_user_can_access_nis(nis)
);
CREATE POLICY tahfizh_write_staff ON public.tahfizh FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif','ustadz'], kelas))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif','ustadz'], kelas));

CREATE POLICY settings_select_authenticated ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_manage_admin ON public.settings FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin'], NULL))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin'], NULL));

CREATE POLICY journals_select_scoped ON public.musyrif_journals FOR SELECT TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas));
CREATE POLICY journals_write_scoped ON public.musyrif_journals FOR ALL TO authenticated
USING (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas))
WITH CHECK (public.current_user_has_role(ARRAY['superadmin','admin','koordinator','musyrif'], kelas));

CREATE POLICY activity_logs_select_scoped ON public.activity_logs FOR SELECT TO authenticated
USING (
  user_id = public.current_app_user_id()
  OR public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], kelas)
);
CREATE POLICY activity_logs_insert_self ON public.activity_logs FOR INSERT TO authenticated
WITH CHECK (user_id = public.current_app_user_id());

CREATE POLICY app_records_select_scoped ON public.app_records FOR SELECT TO authenticated
USING (
  entity_type IN ('announcement','violation_rule','holiday_schedule','gps_config')
  OR
  public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], kelas)
  OR (kelas IS NOT NULL AND public.current_user_has_role(ARRAY['musyrif','ustadz'], kelas))
  OR (nis IS NOT NULL AND public.current_user_can_access_nis(nis))
  OR owner_user_id = public.current_app_user_id()
);
CREATE POLICY app_records_write_scoped ON public.app_records FOR ALL TO authenticated
USING (
  public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], kelas)
  OR (kelas IS NOT NULL AND public.current_user_has_role(ARRAY['musyrif','ustadz'], kelas))
  OR owner_user_id = public.current_app_user_id()
)
WITH CHECK (
  public.current_user_has_role(ARRAY['superadmin','admin','koordinator'], kelas)
  OR (kelas IS NOT NULL AND public.current_user_has_role(ARRAY['musyrif','ustadz'], kelas))
  OR owner_user_id = public.current_app_user_id()
);

-- Device, session, and sync state are always owner scoped.
CREATE POLICY devices_owner ON public.user_devices FOR ALL TO authenticated
USING (user_id = public.current_app_user_id())
WITH CHECK (user_id = public.current_app_user_id());
CREATE POLICY sessions_owner ON public.sessions FOR ALL TO authenticated
USING (user_id = public.current_app_user_id())
WITH CHECK (user_id = public.current_app_user_id());
CREATE POLICY sync_state_owner ON public.sync_state FOR ALL TO authenticated
USING (user_id = public.current_app_user_id())
WITH CHECK (user_id = public.current_app_user_id());

-- Explicit grants; anon receives no business-table privileges.
REVOKE ALL ON TABLE public.attendances, public.permits, public.tahfizh,
  public.settings, public.activity_logs, public.musyrif_journals,
  public.users, public.roles, public.user_roles, public.user_devices,
  public.sessions, public.sync_state, public.wali_students, public.wali_credentials,
  public.wali_registration_requests, public.role_invitations, public.app_records
FROM anon;
REVOKE ALL ON TABLE public.wali_credentials FROM authenticated;
GRANT SELECT, UPDATE ON TABLE public.wali_registration_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendances, public.permits,
  public.tahfizh, public.settings, public.activity_logs, public.musyrif_journals,
  public.users, public.user_roles, public.user_devices, public.sessions,
  public.sync_state, public.wali_students, public.app_records TO authenticated;
GRANT SELECT ON TABLE public.roles TO authenticated;

-- Add every live domain to the realtime publication idempotently.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'attendances','permits','tahfizh','settings','activity_logs',
    'musyrif_journals','users','roles','user_roles','user_devices',
    'sessions','wali_students','wali_registration_requests','role_invitations','app_records'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', table_name);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;

COMMIT;
