-- ============================================================
-- MIGRATION: Add Multirole and Multidevice Support
-- ============================================================
-- This migration adds the necessary tables for:
-- 1. User management and authentication
-- 2. Role-based access control (RBAC)
-- 3. Device tracking for multidevice support
-- 4. Session management with remote logout
-- 5. Enhanced audit trail with user FK
-- ============================================================

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    auth_provider TEXT DEFAULT 'google',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

COMMENT ON TABLE public.users IS 'User accounts - synced from Google OAuth';

-- ============================================================
-- 2. ROLES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    priority INTEGER DEFAULT 0,  -- Higher = more privileged
    is_system BOOLEAN DEFAULT false,  -- System roles cannot be deleted
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.roles IS 'Available roles in the system';

-- ============================================================
-- 3. USER_ROLES TABLE (Role Assignment)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    kelas TEXT,  -- NULL means role applies globally, not to specific class
    assigned_by TEXT REFERENCES public.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- Optional expiration
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, role_id, kelas)
);

COMMENT ON TABLE public.user_roles IS 'Role assignments per user per class';

-- ============================================================
-- 4. USER_DEVICES TABLE (Multidevice Support)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,  -- Unique per device (UUID generated client-side)
    device_name TEXT,
    device_type TEXT,  -- mobile, tablet, desktop
    browser TEXT,
    os TEXT,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    last_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_current BOOLEAN DEFAULT false,
    is_trusted BOOLEAN DEFAULT false,
    UNIQUE(user_id, device_id)
);

COMMENT ON TABLE public.user_devices IS 'Tracked devices per user for multidevice support';

-- ============================================================
-- 5. SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_id TEXT REFERENCES public.user_devices(id),
    token_hash TEXT NOT NULL,  -- SHA256 hash of session token
    refresh_token_hash TEXT,
    user_agent TEXT,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT REFERENCES public.users(id)
);

COMMENT ON TABLE public.sessions IS 'Active sessions for remote logout capability';

-- ============================================================
-- 6. SYNC_STATE TABLE (Per-User Sync Tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sync_state (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,  -- attendances, permits, tahfizh, etc
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_version INTEGER DEFAULT 0,
    last_synced_id TEXT,
    client_device_id TEXT,
    UNIQUE(user_id, entity_type)
);

COMMENT ON TABLE public.sync_state IS 'Per-user sync state for incremental sync';

-- ============================================================
-- 7. ENHANCED ACTIVITY_LOGS
-- ============================================================
-- Add columns to existing activity_logs table (if not exists)
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS device_id TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES public.sessions(id);

-- Add metadata JSONB if not exists
ALTER TABLE public.activity_logs
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Drop old user column and rename (optional migration)
-- ALTER TABLE public.activity_logs DROP COLUMN IF EXISTS "user";
ALTER TABLE public.activity_logs RENAME COLUMN "user" TO user_name_old;

-- ============================================================
-- INDEXES
-- ============================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);

-- Roles indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_priority ON public.roles(priority);

-- User_roles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_kelas ON public.user_roles(kelas);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON public.user_roles(user_id, is_active);

-- User_devices indexes
CREATE INDEX IF NOT EXISTS idx_devices_user ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON public.user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_current ON public.user_devices(user_id, is_current);
CREATE INDEX IF NOT EXISTS idx_devices_last_active ON public.user_devices(last_active);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON public.sessions(user_id, revoked_at)
    WHERE revoked_at IS NULL;

-- Sync_state indexes
CREATE INDEX IF NOT EXISTS idx_sync_state_user ON public.sync_state(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_entity ON public.sync_state(entity_type);
CREATE INDEX IF NOT EXISTS idx_sync_state_user_entity ON public.sync_state(user_id, entity_type);

-- Activity_logs indexes (enhanced)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON public.activity_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);

-- ============================================================
-- SEED DATA: Default Roles
-- ============================================================

INSERT INTO public.roles (id, name, display_name, description, permissions, priority, is_system) VALUES
    ('role_superadmin', 'superadmin', 'Super Admin', 'Full system access',
     '["*"]', 100, true),
    ('role_admin', 'admin', 'Admin Musyrif', 'Administer all classes',
     '["read:*", "write:*", "approve:*", "report:*", "user:manage"]', 80, true),
    ('role_koordinator', 'koordinator', 'Koordinator Musyrif', 'Coordinate musyrif activities',
     '["read:*", "write:*", "approve:permits", "report:*"]', 70, true),
    ('role_musyrif', 'musyrif', 'Musyrif', 'Regular musyrif for own class',
     '["read:own_class", "write:own_class", "approve:own_permits"]', 50, true),
    ('role_wali', 'wali', 'Wali Santri', 'Parent/guardian access',
     '["read:own_children"]', 30, true),
    ('role_ustadz', 'ustadz', 'Ustadz', 'Islamic teacher role',
     '["read:*", "write:tahfizh"]', 60, true)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    permissions = EXCLUDED.permissions,
    priority = EXCLUDED.priority;

-- ============================================================
-- ENABLE RLS ON NEW TABLES
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Users: Users can read their own profile
CREATE POLICY "users_read_own" ON public.users FOR SELECT
    USING (true);  -- Allow read for all authenticated in app

CREATE POLICY "users_update_own" ON public.users FOR UPDATE
    USING (true);  -- Allow update for all

CREATE POLICY "users_insert_auth" ON public.users FOR INSERT
    WITH CHECK (true);

-- Roles: Read-only for all in app
CREATE POLICY "roles_read_all" ON public.roles FOR SELECT
    USING (true);

-- User_roles: Users can read their own roles
CREATE POLICY "user_roles_read_own" ON public.user_roles FOR SELECT
    USING (true);

CREATE POLICY "user_roles_manage_admin" ON public.user_roles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE r.name IN ('admin', 'superadmin')
        )
    );

-- User_devices: Users can manage their own devices
CREATE POLICY "devices_read_own" ON public.user_devices FOR SELECT
    USING (true);

CREATE POLICY "devices_insert_own" ON public.user_devices FOR INSERT
    WITH CHECK (true);

CREATE POLICY "devices_update_own" ON public.user_devices FOR UPDATE
    USING (true);

CREATE POLICY "devices_delete_own" ON public.user_devices FOR DELETE
    USING (true);

-- Sessions: Users can manage their own sessions
CREATE POLICY "sessions_read_own" ON public.sessions FOR SELECT
    USING (true);

CREATE POLICY "sessions_insert_own" ON public.sessions FOR INSERT
    WITH CHECK (true);

CREATE POLICY "sessions_update_own" ON public.sessions FOR UPDATE
    USING (
        true  -- Allow users to revoke their own sessions
    );

-- Sync_state: Users can read/write their own sync state
CREATE POLICY "sync_state_read_own" ON public.sync_state FOR SELECT
    USING (true);

CREATE POLICY "sync_state_write_own" ON public.sync_state FOR INSERT
    WITH CHECK (true);

CREATE POLICY "sync_state_update_own" ON public.sync_state FOR UPDATE
    USING (true);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to get user roles
CREATE OR REPLACE FUNCTION public.get_user_roles(p_user_id TEXT)
RETURNS TABLE(role_id TEXT, role_name TEXT, role_display_name TEXT, kelas TEXT, permissions JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id::TEXT,
        r.name::TEXT,
        r.display_name::TEXT,
        ur.kelas::TEXT,
        r.permissions::JSONB
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$;

-- Function to check if user has role for specific class
CREATE OR REPLACE FUNCTION public.user_has_role_for_kelas(
    p_user_id TEXT,
    p_role_name TEXT,
    p_kelas TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = p_user_id
          AND r.name = p_role_name
          AND (ur.kelas = p_kelas OR ur.kelas IS NULL)
          AND ur.is_active = true
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$;

-- Function to get user's highest priority role
CREATE OR REPLACE FUNCTION public.get_user_highest_role(p_user_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_role_name TEXT;
BEGIN
    SELECT r.name INTO v_role_name
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY r.priority DESC
    LIMIT 1;

    RETURN v_role_name;
END;
$$;

-- Function to register device (upsert)
CREATE OR REPLACE FUNCTION public.register_device(
    p_user_id TEXT,
    p_device_id TEXT,
    p_device_name TEXT,
    p_device_type TEXT,
    p_browser TEXT,
    p_os TEXT
)
RETURNS public.user_devices
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_device public.user_devices;
BEGIN
    INSERT INTO public.user_devices (
        id, user_id, device_id, device_name, device_type, browser, os,
        is_current, last_active
    ) VALUES (
        gen_random_uuid()::TEXT,
        p_user_id,
        p_device_id,
        p_device_name,
        p_device_type,
        p_browser,
        p_os,
        true,
        NOW()
    )
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET
        device_name = COALESCE(p_device_name, user_devices.device_name),
        device_type = COALESCE(p_device_type, user_devices.device_type),
        browser = COALESCE(p_browser, user_devices.browser),
        os = COALESCE(p_os, user_devices.os),
        last_active = NOW(),
        is_current = true
    RETURNING * INTO v_device;

    -- Set other devices of same user to not current
    UPDATE public.user_devices
    SET is_current = false
    WHERE user_id = p_user_id AND device_id != p_device_id;

    RETURN v_device;
END;
$$;

-- Function to revoke all sessions except current
CREATE OR REPLACE FUNCTION public.revoke_other_sessions(
    p_user_id TEXT,
    p_device_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.sessions
    SET revoked_at = NOW()
    WHERE user_id = p_user_id
      AND device_id != p_device_id
      AND revoked_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Function to get active sessions count
CREATE OR REPLACE FUNCTION public.get_active_sessions(p_user_id TEXT)
RETURNS TABLE(
    session_id TEXT,
    device_id TEXT,
    device_name TEXT,
    created_at TIMESTAMPTZ,
    last_used TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_current BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id::TEXT,
        s.device_id::TEXT,
        COALESCE(d.device_name, 'Unknown')::TEXT,
        s.created_at,
        s.last_used,
        s.expires_at,
        COALESCE(d.is_current, false)::BOOLEAN
    FROM public.sessions s
    LEFT JOIN public.user_devices d ON s.device_id = d.device_id
    WHERE s.user_id = p_user_id
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
    ORDER BY s.last_used DESC;
END;
$$;

-- ============================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS sessions_last_used ON public.sessions;
CREATE TRIGGER sessions_last_used
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'Multirole & Multidevice tables created successfully!' as status;

-- List new tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'roles', 'user_roles', 'user_devices', 'sessions', 'sync_state')
ORDER BY table_name;
