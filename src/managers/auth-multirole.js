/**
 * AuthMultiRole.js - Multirole & Multidevice Authentication Manager
 *
 * Provides enhanced authentication for multirole and multidevice support:
 * - User registration and profile management
 * - Role-based access control (RBAC)
 * - Device tracking and management
 * - Remote session logout
 * - Enhanced audit trail
 *
 * Usage:
 *   await AuthMultiRole.init(supabaseClient);
 *   const roles = await AuthMultiRole.getUserRoles();
 *   const devices = await AuthMultiRole.getDevices();
 *   await AuthMultiRole.logoutOtherDevices();
 */

class AuthMultiRole {
  constructor() {
    this.supabase = null;
    this.currentUser = null;
    this.currentDeviceId = null;
    this.currentDeviceRecordId = null;
    this.roles = [];
    this._logger = window.Logger || console;
  }

  /**
   * Initialize the AuthMultiRole manager
   * @param {Object} supabaseClient - Supabase client instance
   */
  async init(supabaseClient) {
    this.supabase = supabaseClient;
    await this._loadDeviceId();
    return this;
  }

  /**
   * Generate or load device ID for this browser
   */
  async _loadDeviceId() {
    let deviceId = localStorage.getItem('device_id');

    if (!deviceId) {
      deviceId = this._generateDeviceId();
      localStorage.setItem('device_id', deviceId);
    }

    this.currentDeviceId = deviceId;
    return deviceId;
  }

  /**
   * Generate unique device ID
   */
  _generateDeviceId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `device_${timestamp}_${random}`;
  }

  /**
   * Get device info from browser
   */
  _getDeviceInfo() {
    const ua = navigator.userAgent;

    let deviceType = 'desktop';
    if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
      deviceType = /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
    }

    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    const deviceName = `${browser} on ${os}`;

    return { deviceId: this.currentDeviceId, deviceName, deviceType, browser, os };
  }

  // ============================================================
  // USER MANAGEMENT
  // ============================================================

  /**
   * Get or create user from Google profile
   * @param {Object} googleProfile - Parsed Google JWT payload
   */
  async getOrCreateUser(googleProfile) {
    const email = googleProfile.email?.toLowerCase();
    const name = googleProfile.name || googleProfile.given_name || 'User';
    const picture = googleProfile.picture || null;

    if (!email) {
      throw new Error('Email is required');
    }

    const { data: authData, error: authError } = await this.supabase.auth.getUser();
    const authUser = authData?.user;
    if (authError || !authUser) {
      throw authError || new Error('Authenticated Supabase user is required');
    }

    // Check if user exists by verified auth identity first.
    const { data: existingUser, error: fetchError } = await this.supabase
      .from('users')
      .select('*')
      .eq('auth_user_id', authUser.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      this._logger.error('Error fetching user:', fetchError);
      throw fetchError;
    }

    if (existingUser) {
      // Update last login
      await this.supabase
        .from('users')
        .update({
          last_login: new Date().toISOString(),
          name,
          picture,
        })
        .eq('id', existingUser.id);

      this.currentUser = existingUser;
      return existingUser;
    }

    // Fallback: Check if user exists by email (pre-seeded users with NULL auth_user_id)
    const { data: userByEmail, error: fetchEmailError } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (fetchEmailError) {
      this._logger.error('Error fetching user by email:', fetchEmailError);
      throw fetchEmailError;
    }

    if (userByEmail) {
      this._logger.info('[AuthMultiRole] Found existing user by email, linking auth_user_id...');
      const { data: linkedUser, error: linkError } = await this.supabase
        .from('users')
        .update({
          auth_user_id: authUser.id,
          last_login: new Date().toISOString(),
          name,
          picture,
        })
        .eq('id', userByEmail.id)
        .select()
        .single();

      if (linkError) {
        this._logger.error('[AuthMultiRole] Failed to link auth_user_id:', linkError);
        throw linkError;
      }

      this.currentUser = linkedUser;
      return linkedUser;
    }

    // Create new user
    const newUser = {
      id: authUser.id,
      auth_user_id: authUser.id,
      email,
      name,
      picture,
      auth_provider: 'google',
      is_active: true,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      metadata: {
        google_sub: googleProfile.sub,
        google_iss: googleProfile.iss,
      },
    };

    const { data: createdUser, error: createError } = await this.supabase
      .from('users')
      .insert(newUser)
      .select()
      .single();

    if (createError) {
      this._logger.error('Error creating user:', createError);
      // Try to fetch again in case of race condition
      const { data: retryUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single();
      if (retryUser) {
        this.currentUser = retryUser;
        return retryUser;
      }
      throw createError;
    }

    this.currentUser = createdUser;
    return createdUser;
  }

  /**
   * Get current user profile
   */
  async getCurrentUser() {
    return this.currentUser;
  }

  // ============================================================
  // ROLE MANAGEMENT
  // ============================================================

  /**
   * Get all roles for current user
   */
  async getUserRoles(userId = null) {
    const targetUserId = userId || this.currentUser?.id;
    if (!targetUserId) return [];

    const { data, error } = await this.supabase
      .from('user_roles')
      .select(`
        *,
        roles (*)
      `)
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()');

    if (error) {
      this._logger.error('Error fetching user roles:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get roles for specific user
   */
  async getRolesForUser(userId) {
    return this.getUserRoles(userId);
  }

  /**
   * Get user's highest priority role
   */
  async getHighestRole(userId = null) {
    const roles = await this.getUserRoles(userId);
    if (roles.length === 0) return null;

    return roles.reduce((highest, current) => {
      const currentPriority = current.roles?.priority || 0;
      const highestPriority = highest.roles?.priority || 0;
      return currentPriority > highestPriority ? current : highest;
    });
  }

  /**
   * Check if user has specific role
   * @param {string} roleName - Role name (e.g., 'admin', 'musyrif')
   * @param {string} kelas - Optional class filter
   */
  async hasRole(roleName, kelas = null) {
    const roles = await this.getUserRoles();
    return roles.some(r => {
      if (r.roles?.name !== roleName) return false;
      if (kelas && r.kelas && r.kelas !== kelas) return false;
      return true;
    });
  }

  /**
   * Check if user is admin (any level)
   */
  async isAdmin() {
    const roles = await this.getUserRoles();
    return roles.some(r =>
      ['superadmin', 'admin', 'koordinator'].includes(r.roles?.name)
    );
  }

  /**
   * Get all available roles
   */
  async getAvailableRoles() {
    const { data, error } = await this.supabase
      .from('roles')
      .select('*')
      .order('priority', { ascending: false });

    if (error) {
      this._logger.error('Error fetching roles:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Assign role to user (admin only)
   */
  async assignRole(userId, roleId, kelas = null, expiresAt = null) {
    // Verify admin permission
    const isAdmin = await this.isAdmin();
    if (!isAdmin) {
      throw new Error('Only admins can assign roles');
    }

    const userRole = {
      id: `ur_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`,
      user_id: userId,
      role_id: roleId,
      kelas,
      assigned_by: this.currentUser?.id,
      assigned_at: new Date().toISOString(),
      expires_at: expiresAt,
      is_active: true,
    };

    const { data, error } = await this.supabase
      .from('user_roles')
      .upsert(userRole, { onConflict: 'user_id,role_id,kelas' })
      .select()
      .single();

    if (error) {
      this._logger.error('Error assigning role:', error);
      throw error;
    }

    return data;
  }

  // ============================================================
  // DEVICE MANAGEMENT
  // ============================================================

  /**
   * Register current device
   */
  async registerDevice() {
    if (!this.currentUser) {
      this._logger.warn('Cannot register device: no user logged in');
      return null;
    }

    const deviceInfo = this._getDeviceInfo();

    const recordId = `dev_${this.currentUser.id}_${deviceInfo.deviceId}`;
    const { data, error } = await this.supabase
      .from('user_devices')
      .upsert({
        id: recordId,
        user_id: this.currentUser.id,
        device_id: deviceInfo.deviceId,
        device_name: deviceInfo.deviceName,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        last_active: new Date().toISOString(),
        is_current: true,
      }, { onConflict: 'user_id,device_id' })
      .select()
      .single();

    if (error) {
      this._logger.error('Error registering device:', error);
      return null;
    }

    this.currentDeviceRecordId = data.id;
    return data;
  }

  /**
   * Get all devices for current user
   */
  async getDevices() {
    if (!this.currentUser) return [];

    const { data, error } = await this.supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .order('last_active', { ascending: false });

    if (error) {
      this._logger.error('Error fetching devices:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get active sessions
   */
  async getActiveSessions() {
    if (!this.currentUser) return [];

    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('user_id', this.currentUser.id)
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('last_used', { ascending: false });

    if (error) {
      this._logger.error('Error fetching sessions:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId) {
    const { error } = await this.supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId)
      .is('revoked_at', null);

    if (error) {
      this._logger.error('Error revoking session:', error);
      throw error;
    }

    return true;
  }

  /**
   * Logout all other devices (except current)
   */
  async logoutOtherDevices() {
    if (!this.currentUser || !this.currentDeviceId) {
      return 0;
    }

    const currentSessionId = localStorage.getItem('app_session_id');
    const { data, error } = await this.supabase
      .from('sessions')
      .update({ revoked_at: new Date().toISOString(), revoked_by: this.currentUser.id })
      .eq('user_id', this.currentUser.id)
      .neq('id', currentSessionId || '')
      .is('revoked_at', null)
      .select('id');

    if (error) {
      this._logger.error('Error logging out other devices:', error);
      return 0;
    }

    // Update device trust status
    await this.supabase
      .from('user_devices')
      .update({ is_trusted: true })
      .eq('device_id', this.currentDeviceId);

    return data?.length || 0;
  }

  /**
   * Remove a specific device
   */
  async removeDevice(deviceId) {
    const { data: device } = await this.supabase
      .from('user_devices')
      .select('id')
      .eq('device_id', deviceId)
      .eq('user_id', this.currentUser?.id)
      .maybeSingle();
    if (device?.id) {
      await this.supabase
        .from('sessions')
        .update({ revoked_at: new Date().toISOString(), revoked_by: this.currentUser.id })
        .eq('device_id', device.id)
        .is('revoked_at', null);
    }
    const { error } = await this.supabase
      .from('user_devices')
      .delete()
      .eq('device_id', deviceId)
      .eq('user_id', this.currentUser?.id);

    if (error) {
      this._logger.error('Error removing device:', error);
      throw error;
    }

    return true;
  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================

  /**
   * Create a new session
   */
  async createSession() {
    if (!this.currentUser) {
      throw new Error('No user logged in');
    }

    if (!this.currentDeviceRecordId) await this.registerDevice();
    let sessionId = localStorage.getItem('app_session_id');
    const { data: authData } = await this.supabase.auth.getSession();
    const authSession = authData?.session;
    if (!authSession) throw new Error('Supabase session is required');

    if (sessionId) {
      const { data: existing } = await this.supabase.from('sessions').select('*').eq('id', sessionId).maybeSingle();
      if (existing?.revoked_at) throw new Error('Sesi perangkat telah dicabut');
      if (existing) {
        await this.supabase.from('sessions').update({ last_used: new Date().toISOString() }).eq('id', sessionId);
        return existing;
      }
    }

    sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 15)}`;
    const expiresAt = authSession.expires_at
      ? new Date(authSession.expires_at * 1000)
      : new Date(Date.now() + 60 * 60 * 1000);
    const tokenHash = await this._sha256(authSession.access_token);

    const session = {
      id: sessionId,
      user_id: this.currentUser.id,
      device_id: this.currentDeviceRecordId,
      token_hash: tokenHash,
      user_agent: navigator.userAgent,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('sessions')
      .insert(session)
      .select()
      .single();

    if (error) {
      this._logger.error('Error creating session:', error);
      return null;
    }

    localStorage.setItem('app_session_id', sessionId);
    return data;
  }

  /**
   * Validate current session
   */
  async validateSession() {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', localStorage.getItem('app_session_id') || '')
      .is('revoked_at', null)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error) {
      return { valid: false, session: null };
    }

    // Update last used
    await this.supabase
      .from('sessions')
      .update({ last_used: new Date().toISOString() })
      .eq('id', data.id);

    return { valid: true, session: data };
  }

  async _sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // ============================================================
  // SYNC STATE MANAGEMENT
  // ============================================================

  /**
   * Get sync state for current user
   */
  async getSyncState(entityType = null) {
    if (!this.currentUser) return [];

    let query = this.supabase
      .from('sync_state')
      .select('*')
      .eq('user_id', this.currentUser.id);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    const { data, error } = await query;

    if (error) {
      this._logger.error('Error fetching sync state:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update sync state
   */
  async updateSyncState(entityType, lastVersion, lastId = null) {
    if (!this.currentUser) return null;

    const syncState = {
      id: `sync_${this.currentUser.id}_${entityType}`,
      user_id: this.currentUser.id,
      entity_type: entityType,
      last_sync_at: new Date().toISOString(),
      last_synced_version: lastVersion,
      last_synced_id: lastId,
      client_device_id: this.currentDeviceId,
    };

    const { data, error } = await this.supabase
      .from('sync_state')
      .upsert(syncState, { onConflict: 'user_id,entity_type' })
      .select()
      .single();

    if (error) {
      this._logger.error('Error updating sync state:', error);
      return null;
    }

    return data;
  }

  // ============================================================
  // AUDIT TRAIL
  // ============================================================

  /**
   * Log activity with user context
   */
  async logActivity(action, detail, additionalData = {}) {
    const logEntry = {
      id: `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`,
      action,
      detail,
      user_id: this.currentUser?.id || null,
      user_name_old: this.currentUser?.name || this.currentUser?.email || 'Anonymous',
      device_id: this.currentDeviceId,
      session_id: additionalData.sessionId || null,
      ip_address: null, // Client-side can't get real IP
      kelas: additionalData.kelas || null,
      timestamp: new Date().toISOString(),
      metadata: additionalData.metadata || {},
    };

    const { error } = await this.supabase
      .from('activity_logs')
      .insert(logEntry);

    if (error) {
      this._logger.error('Error logging activity:', error);
    }

    return logEntry;
  }

  /**
   * Get activity logs for current user
   */
  async getActivityLogs(limit = 50) {
    const { data, error } = await this.supabase
      .from('activity_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      this._logger.error('Error fetching activity logs:', error);
      return [];
    }

    return data || [];
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Search users (for admin)
   */
  async searchUsers(query, limit = 20) {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .or(`email.ilike.%${query}%,name.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(limit);

    if (error) {
      this._logger.error('Error searching users:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Clear all local session data
   */
  clearLocalSession() {
    sessionStorage.removeItem('multirole_user_id');
    sessionStorage.removeItem('multirole_roles');
    localStorage.removeItem('app_session_id');
    // Keep device_id for device tracking
  }

  /**
   * Get current device ID
   */
  getDeviceId() {
    return this.currentDeviceId;
  }

  /**
   * Check if current device is trusted
   */
  async isCurrentDeviceTrusted() {
    if (!this.currentUser) return false;

    const { data, error } = await this.supabase
      .from('user_devices')
      .select('is_trusted')
      .eq('user_id', this.currentUser.id)
      .eq('device_id', this.currentDeviceId)
      .single();

    if (error) return false;

    return data?.is_trusted || false;
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const authMultiRole = new AuthMultiRole();

window.AuthMultiRole = AuthMultiRole;
window.authMultiRole = authMultiRole;

console.log('[AuthMultiRole] Module loaded');
