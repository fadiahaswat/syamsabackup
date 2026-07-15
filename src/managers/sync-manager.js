/**
 * SyncManager - Cross-Role Data Synchronization
 *
 * Handles data synchronization between Musyrif, Admin, and Wali roles.
 * Each role has different data access:
 *
 * - Musyrif: Own class data (attendances, permits, tahfizh)
 * - Admin: All classes data (full access)
 * - Wali: Own child's data (read-only, filtered by child NIS)
 *
 * This manager ensures all roles see consistent data when online.
 */

class SyncManager {
  constructor() {
    this._db = null;
    this._repos = null;
    this._userRole = null;
    this._userKelas = null;
    this._userNis = null; // For Wali role
    this.isSyncing = false;
    this._syncInterval = null;
    this._syncIntervalMs = 30000; // 30 seconds

    // Logger
    this._logger = {
      debug: (...args) => window.Logger?.debug('SyncManager', ...args),
      info: (...args) => window.Logger?.info('SyncManager', ...args),
      warn: (...args) => window.Logger?.warn('SyncManager', ...args),
      error: (...args) => window.Logger?.error('SyncManager', ...args),
    };

    // Event callbacks
    this.onSyncStart = null;
    this.onSyncComplete = null;
    this.onSyncError = null;
    this.onDataUpdate = null;
  }

  /**
   * Initialize SyncManager
   */
  async init(localDB, repositories, userProfile) {
    this._db = localDB;
    this._repos = repositories;
    this._userRole = userProfile?.role || 'musyrif';
    this._userKelas = userProfile?.kelas || userProfile?.selectedClass;
    this._userNis = userProfile?.nis;

    this._logger.info('Initialized', {
      role: this._userRole,
      kelas: this._userKelas,
      nis: this._userNis
    });

    // Setup auto-sync if Supabase is enabled
    if (window.isSupabaseEnabled) {
      this.startAutoSync();
    }

    // Setup online/offline listeners
    window.addEventListener('online', () => {
      this._logger.info('Network online - triggering sync');
      this.syncAll();
    });

    return this;
  }

  /**
   * Get current user role
   */
  getRole() {
    return this._userRole;
  }

  /**
   * Check if user has admin privileges
   */
  isAdmin() {
    return this._userRole === 'admin' ||
           this._userRole === 'pengelola' ||
           this._userKelas === 'admin musyrif';
  }

  /**
   * Check if user is Wali (parent)
   */
  isWali() {
    return this._userRole === 'wali';
  }

  /**
   * Start automatic sync
   */
  startAutoSync(intervalMs = null) {
    if (intervalMs) {
      this._syncIntervalMs = intervalMs;
    }

    this.stopAutoSync();
    this._syncInterval = setInterval(() => {
      if (navigator.onLine && window.isSupabaseEnabled && !this.isSyncing) {
        this.syncAll();
      }
    }, this._syncIntervalMs);

    this._logger.info(`Auto-sync started (interval: ${this._syncIntervalMs}ms)`);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
      this._logger.info('Auto-sync stopped');
    }
  }

  /**
   * Full sync - both directions
   */
  async syncAll() {
    if (this.isSyncing || !window.isSupabaseEnabled || !navigator.onLine) {
      return;
    }

    this.isSyncing = true;

    if (this.onSyncStart) {
      this.onSyncStart();
    }

    try {
      // Step 1: Push local changes to cloud
      await this.syncOutbound();

      // Step 2: Pull cloud changes to local
      await this.syncInbound();

      this._logger.info('Full sync completed');

      if (this.onSyncComplete) {
        this.onSyncComplete({ success: true });
      }

      if (this.onDataUpdate) {
        this.onDataUpdate();
      }

    } catch (error) {
      this._logger.error('Sync failed:', error);

      if (this.onSyncError) {
        this.onSyncError(error);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push local changes to cloud
   */
  async syncOutbound() {
    if (!window.syncQueue) return;

    const pendingChanges = await window.syncQueue.getPending(100);
    if (pendingChanges.length === 0) return;

    this._logger.debug(`Pushing ${pendingChanges.length} changes to cloud`);

    for (const change of pendingChanges) {
      try {
        const table = change.entity_type || change.entityType;
        const entityId = change.entity_id || change.entityId;

        // Skip local-only tables
        if (['sync_queue', 'conflicts', 'sync_metadata', 'meta'].includes(table)) {
          await window.syncQueue.deleteChange(change.id);
          continue;
        }

        if (change.operation === 'upsert') {
          const { error } = await window.supabaseClient
            .from(table)
            .upsert(change.payload);

          if (error) throw error;
        } else if (change.operation === 'delete') {
          const { error } = await window.supabaseClient
            .from(table)
            .delete()
            .eq('id', entityId);

          if (error) throw error;
        }

        await window.syncQueue.markSynced(change.id);
        await window.syncQueue.deleteChange(change.id);

      } catch (error) {
        this._logger.error(`Failed to sync change ${change.id}:`, error);
        await window.syncQueue.markFailed(change.id, error);
      }
    }
  }

  /**
   * Pull cloud changes to local
   */
  async syncInbound() {
    const db = this._db;
    db.isSyncing = true;

    try {
      if (this.isAdmin()) {
        // Admin: sync all classes
        await this._syncAllClasses();
      } else if (this.isWali()) {
        // Wali: sync only own child's data
        await this._syncWaliData();
      } else {
        // Musyrif: sync own class
        await this._syncKelasData(this._userKelas);
      }

      // Reload state
      if (window.stateManager) {
        await window.stateManager._loadPersistedState();
        window.stateManager._emit?.('change', ['attendanceData', 'permits', 'tahfizh']);
      }

    } finally {
      db.isSyncing = false;
    }
  }

  /**
   * Sync data for all classes (Admin only)
   */
  async _syncAllClasses() {
    this._logger.info('Syncing all classes (admin mode)');

    const tables = ['attendances', 'permits', 'tahfizh', 'settings'];

    for (const table of tables) {
      try {
        const { data, error } = await window.supabaseClient
          .from(table)
          .select('*');

        if (error) throw error;

        if (data && data.length > 0) {
          await this._db.bulkPut(table, data);
          this._logger.debug(`Synced ${data.length} records for ${table}`);
        }
      } catch (error) {
        this._logger.error(`Failed to sync ${table}:`, error);
      }
    }
  }

  /**
   * Sync data for specific kelas (Musyrif)
   */
  async _syncKelasData(kelas) {
    if (!kelas) return;

    this._logger.info(`Syncing data for kelas: ${kelas}`);

    const tables = ['attendances', 'permits', 'tahfizh'];

    for (const table of tables) {
      try {
        const { data, error } = await window.supabaseClient
          .from(table)
          .select('*')
          .eq('kelas', kelas);

        if (error) throw error;

        if (data && data.length > 0) {
          await this._db.bulkPut(table, data);
          this._logger.debug(`Synced ${data.length} ${table} records`);
        }
      } catch (error) {
        this._logger.error(`Failed to sync ${table}:`, error);
      }
    }

    // Settings should be synced regardless of kelas
    try {
      const { data, error } = await window.supabaseClient
        .from('settings')
        .select('*');

      if (!error && data) {
        for (const record of data) {
          const localRecord = await this._db.get('settings', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.put('settings', record);
          }
        }
      }
    } catch (error) {
      this._logger.error('Failed to sync settings:', error);
    }
  }

  /**
   * Sync data for Wali (parent) - only child's data
   */
  async _syncWaliData() {
    if (!this._userNis) {
      this._logger.warn('Wali has no NIS - cannot sync child data');
      return;
    }

    this._logger.info(`Syncing data for child NIS: ${this._userNis}`);

    // Sync attendances for this NIS
    try {
      const { data, error } = await window.supabaseClient
        .from('attendances')
        .select('*')
        .eq('studentId', this._userNis);

      if (!error && data) {
        for (const record of data) {
          const localRecord = await this._db.get('attendances', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.put('attendances', record);
          }
        }
      }
    } catch (error) {
      this._logger.error('Failed to sync wali attendances:', error);
    }

    // Sync permits for this NIS
    try {
      const { data, error } = await window.supabaseClient
        .from('permits')
        .select('*')
        .eq('nis', this._userNis);

      if (!error && data) {
        for (const record of data) {
          const localRecord = await this._db.get('permits', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.put('permits', record);
          }
        }
      }
    } catch (error) {
      this._logger.error('Failed to sync wali permits:', error);
    }

    // Sync tahfizh for this NIS
    try {
      const { data, error } = await window.supabaseClient
        .from('tahfizh')
        .select('*')
        .eq('nis', this._userNis);

      if (!error && data) {
        for (const record of data) {
          const localRecord = await this._db.get('tahfizh', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.put('tahfizh', record);
          }
        }
      }
    } catch (error) {
      this._logger.error('Failed to sync wali tahfizh:', error);
    }
  }

  /**
   * Force sync specific table
   */
  async forceSyncTable(tableName) {
    if (!window.isSupabaseEnabled || !navigator.onLine) {
      this._logger.warn('Cannot force sync - offline or Supabase disabled');
      return;
    }

    this._logger.info(`Force syncing table: ${tableName}`);

    try {
      if (this.isAdmin()) {
        const { data, error } = await window.supabaseClient.from(tableName).select('*');
        if (!error && data) {
          await this._db.bulkPut(tableName, data);
        }
      } else if (this.isWali()) {
        const { data, error } = await window.supabaseClient
          .from(tableName)
          .select('*')
          .eq('studentId', this._userNis);
        if (!error && data) {
          await this._db.bulkPut(tableName, data);
        }
      } else {
        const { data, error } = await window.supabaseClient
          .from(tableName)
          .select('*')
          .eq('kelas', this._userKelas);
        if (!error && data) {
          await this._db.bulkPut(tableName, data);
        }
      }
    } catch (error) {
      this._logger.error(`Force sync failed for ${tableName}:`, error);
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      role: this._userRole,
      kelas: this._userKelas,
      isOnline: navigator.onLine,
      isSupabaseEnabled: window.isSupabaseEnabled,
      autoSyncActive: !!this._syncInterval,
    };
  }

  /**
   * Get pending sync count
   */
  async getPendingCount() {
    if (!window.syncQueue) return 0;
    return window.syncQueue.getPendingCount();
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopAutoSync();
    this._logger.info('Destroyed');
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const syncManager = new SyncManager();

// Export
window.SyncManager = SyncManager;
window.syncManager = syncManager;

window.SyncManagerLogger = {
  debug: (...args) => Logger?.debug('SyncManager', ...args),
  info: (...args) => Logger?.info('SyncManager', ...args),
  warn: (...args) => Logger?.warn('SyncManager', ...args),
  error: (...args) => Logger?.error('SyncManager', ...args),
};
