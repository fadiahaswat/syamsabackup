/**
 * Supabase Client - Cloud Storage Adapter
 *
 * Wrapper untuk Supabase client dengan integrasi Google OAuth.
 * Mengelola autentikasi dan operasi database.
 */

class SupabaseClient {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.isOnline = navigator.onLine;
    this.currentSession = null;
    this.currentUser = null;
    this.realtimeChannels = [];
    this.initPromise = null;

    // Callbacks
    this.onAuthStateChange = null;
    this.onConnectionChange = null;
    this.onSyncStatusChange = null;
    this.onAttendanceChange = null;
    this.onPermitChange = null;

    // Setup connection listeners
    this._setupConnectionListeners();
  }

  /**
   * Initialize Supabase client
   */
  async init(config) {
    if (this.isInitialized) {
      console.log('[SupabaseClient] Already initialized');
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const url = config?.url || APP_STORAGE?.supabase?.url;
      const anonKey = config?.anonKey || APP_STORAGE?.supabase?.anonKey;

      if (!url || !anonKey) {
        console.warn('[SupabaseClient] Supabase config not found - cloud storage disabled');
        return;
      }

      try {
        // Dynamic import Supabase client
        const { createClient } = await import(
          'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
        );

        this.client = createClient(url, anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
          global: {
            headers: {
              'x-app-version': window.APP_VERSION || '2.2.8',
            },
          },
        });

        // Check initial session
        const { data: sessionData } = await this.client.auth.getSession();
        if (sessionData?.session) {
          this._handleSession(sessionData.session);
        }

        // Listen for auth changes
        this.client.auth.onAuthStateChange((event, session) => {
          console.log('[SupabaseClient] Auth event:', event);
          if (session) {
            this._handleSession(session);
          } else {
            this.currentSession = null;
            this.currentUser = null;
          }

          if (this.onAuthStateChange) {
            this.onAuthStateChange(event, session);
          }
        });

        this.isInitialized = true;
        console.log('[SupabaseClient] Initialized successfully');

      } catch (error) {
        console.error('[SupabaseClient] Initialization failed:', error);
        this.isInitialized = false;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Handle incoming session
   */
  _handleSession(session) {
    this.currentSession = session;
    if (session?.user) {
      this.currentUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email,
        supabaseToken: session.access_token,
      };
    }
  }

  /**
   * Setup online/offline listeners
   */
  _setupConnectionListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[SupabaseClient] Connection restored');
      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[SupabaseClient] Connection lost');
      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }
    });
  }

  /**
   * Subscribe to realtime changes (attendance & permits)
   */
  async subscribeToRealtime(kelasId) {
    if (!this.client) {
      console.warn('[SupabaseClient] Cannot subscribe - client not initialized');
      return;
    }

    // Unsubscribe from previous channels
    this.unsubscribeRealtime();

    console.log('[SupabaseClient] Subscribing to realtime for kelas:', kelasId);

    // Subscribe to attendance changes
    const attendanceChannel = this.client
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_record',
          filter: `kelas_id=eq.${kelasId}`
        },
        (payload) => {
          console.log('[SupabaseClient] Attendance changed:', payload);
          if (this.onAttendanceChange) {
            this.onAttendanceChange(payload);
          }
        }
      )
      .subscribe();

    // Subscribe to permit changes
    const permitChannel = this.client
      .channel('permit-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'permit',
          filter: `kelas_id=eq.${kelasId}`
        },
        (payload) => {
          console.log('[SupabaseClient] Permit changed:', payload);
          if (this.onPermitChange) {
            this.onPermitChange(payload);
          }
        }
      )
      .subscribe();

    // Subscribe to notification changes for the logged-in recipient
    let notificationChannel = null;
    const recipient = window.getNotificationRecipientInfo?.() || {};
    const recipientId = recipient.id || '';
    if (recipientId) {
      console.log('[SupabaseClient] Subscribing to notifications for recipient_id:', recipientId);
      notificationChannel = this.client
        .channel('notification-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${recipientId}`
          },
          (payload) => {
            console.log('[SupabaseClient] Notification changed:', payload);
            if (this.onNotificationChange) {
              this.onNotificationChange(payload);
            }
          }
        )
        .subscribe();
    }

    this.realtimeChannels = [attendanceChannel, permitChannel];
    if (notificationChannel) {
      this.realtimeChannels.push(notificationChannel);
    }
    console.log('[SupabaseClient] Realtime subscribed');
  }

  /**
   * Unsubscribe from realtime channels
   */
  unsubscribeRealtime() {
    if (this.realtimeChannels.length > 0) {
      console.log('[SupabaseClient] Unsubscribing from realtime');
      this.realtimeChannels.forEach(channel => {
        this.client?.removeChannel(channel);
      });
      this.realtimeChannels = [];
    }
  }

  /**
   * Sign in with Google OAuth (using existing Google credential)
   */
  async signInWithGoogle(googleCredential) {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await this.client.auth.signInWithIdToken({
        provider: 'google',
        token: googleCredential,
      });

      if (error) {
        console.error('[SupabaseClient] Google sign-in failed:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Sign-in error:', error);
      return { data: null, error };
    }
  }

  /**
   * Sign out current user
   */
  async signOut() {
    if (!this.client) return;

    try {
      await this.client.auth.signOut();
      this.currentSession = null;
      this.currentUser = null;
    } catch (error) {
      console.error('[SupabaseClient] Sign-out error:', error);
    }
  }

  /**
   * Get current session
   */
  getSession() {
    return this.currentSession;
  }

  /**
   * Get current user
   */
  getUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser && !!this.currentSession;
  }

  // ============================================================
  // ATTENDANCE OPERATIONS
  // ============================================================

  /**
   * Load attendance data for a specific date
   */
  async loadAttendance(kelasId, dateKey) {
    if (!this.client || !this.isOnline) {
      return { data: null, error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('attendance_record')
        .select('*')
        .eq('kelas_id', kelasId)
        .eq('date_key', dateKey);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Load attendance error:', error);
      return { data: null, error };
    }
  }

  /**
   * Load all attendance records for a class (no date filter)
   */
  async loadAllAttendance(kelasId) {
    if (!this.client || !this.isOnline) {
      return { data: null, error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('attendance_record')
        .select('*')
        .eq('kelas_id', kelasId);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Load all attendance error:', error);
      return { data: null, error };
    }
  }

  /**
   * Save attendance record (upsert)
   */
  async saveAttendance(record) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('attendance_record')
        .upsert(record, {
          onConflict: 'kelas_id,student_id,date_key,slot_id',
        });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Save attendance error:', error);
      return { data: null, error };
    }
  }

  /**
   * Bulk save attendance records
   */
  async bulkSaveAttendance(records) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('attendance_record')
        .upsert(records, {
          onConflict: 'kelas_id,student_id,date_key,slot_id',
        });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Bulk save attendance error:', error);
      return { data: null, error };
    }
  }

  /**
   * Get attendance range
   */
  async getAttendanceRange(kelasId, startDate, endDate) {
    if (!this.client || !this.isOnline) {
      return { data: null, error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('attendance_record')
        .select('*')
        .eq('kelas_id', kelasId)
        .gte('date_key', startDate)
        .lte('date_key', endDate);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Get attendance range error:', error);
      return { data: null, error };
    }
  }

  // ============================================================
  // PERMIT OPERATIONS
  // ============================================================

  /**
   * Load all permits for a class
   */
  async loadPermits(kelasId) {
    if (!this.client || !this.isOnline) {
      return { data: null, error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('permit')
        .select('*')
        .eq('kelas_id', kelasId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Load permits error:', error);
      return { data: null, error };
    }
  }

  /**
   * Save permit (upsert)
   */
  async savePermit(permit) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('permit')
        .upsert(permit, { onConflict: 'id' });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Save permit error:', error);
      return { data: null, error };
    }
  }

  /**
   * Delete permit
   */
  async deletePermit(permitId) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { error } = await this.client
        .from('permit')
        .delete()
        .eq('id', permitId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[SupabaseClient] Delete permit error:', error);
      return { error };
    }
  }

  // ============================================================
  // USER SETTINGS OPERATIONS
  // ============================================================

  /**
   * Load user settings
   */
  async loadSettings(userId) {
    if (!this.client || !this.isOnline) {
      return { data: null, error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('user_settings')
        .select('settings')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return { data: data?.settings, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Load settings error:', error);
      return { data: null, error };
    }
  }

  /**
   * Save user settings
   */
  async saveSettings(userId, settings) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('user_settings')
        .upsert({
          user_id: userId,
          settings,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Save settings error:', error);
      return { data: null, error };
    }
  }

  // ============================================================
  // ACTIVITY LOG OPERATIONS
  // ============================================================

  /**
   * Log activity
   */
  async logActivity(userId, userName, action, detail) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { error } = await this.client
        .from('activity_log')
        .insert({
          user_id: userId,
          user_name: userName,
          action,
          detail,
        });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[SupabaseClient] Log activity error:', error);
      return { error };
    }
  }

  // ============================================================
  // MASTER DATA OPERATIONS
  // ============================================================

  /**
   * Load students for a class
   */
  async loadStudents(kelasId) {
    if (!this.client || !this.isOnline) {
      return { data: null, error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('student')
        .select('*')
        .eq('kelas_id', kelasId)
        .order('nama');

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Load students error:', error);
      return { data: null, error };
    }
  }

  /**
   * Load class info
   */
  async loadKelas(kelasId) {
    if (!this.client || !this.isOnline) {
      return { data: null, error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('kelas')
        .select('*')
        .eq('id', kelasId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Load kelas error:', error);
      return { data: null, error };
    }
  }

  // ============================================================
  // FILE STORAGE OPERATIONS
  // ============================================================

  /**
   * Upload file to storage bucket
   */
  async uploadFile(bucket, path, file, options = {}) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: options.cacheControl || '3600',
          upsert: options.upsert || false,
        });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[SupabaseClient] Upload file error:', error);
      return { data: null, error };
    }
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(bucket, path) {
    if (!this.client) return null;

    try {
      const { data } = this.client.storage
        .from(bucket)
        .getPublicUrl(path);
      return data.publicUrl;
    } catch (error) {
      console.error('[SupabaseClient] Get public URL error:', error);
      return null;
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(bucket, path) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { error } = await this.client.storage
        .from(bucket)
        .remove([path]);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[SupabaseClient] Delete file error:', error);
      return { error };
    }
  }

  // ============================================================
  // SYNC UTILITIES
  // ============================================================

  /**
   * Get sync metadata
   */
  async getSyncMetadata(userId, entityType) {
    if (!this.client || !this.isOnline) {
      return { data: null, error: 'Offline or not initialized' };
    }

    try {
      const { data, error } = await this.client
        .from('sync_metadata')
        .select('*')
        .eq('user_id', userId)
        .eq('entity_type', entityType)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      // Not found is OK
      return { data: null, error: null };
    }
  }

  /**
   * Update sync metadata
   */
  async updateSyncMetadata(userId, entityType) {
    if (!this.client || !this.isOnline) {
      return { error: 'Offline or not initialized' };
    }

    try {
      const { error } = await this.client
        .from('sync_metadata')
        .upsert({
          user_id: userId,
          entity_type: entityType,
          last_sync_at: new Date().toISOString(),
          last_sync_version: 1,
        }, {
          onConflict: 'user_id,entity_type',
        });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('[SupabaseClient] Update sync metadata error:', error);
      return { error };
    }
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const supabaseClient = new SupabaseClient();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseClient;
}

window.SupabaseClient = SupabaseClient;
window.supabaseClient = supabaseClient;

console.log('[SupabaseClient] Module loaded');
