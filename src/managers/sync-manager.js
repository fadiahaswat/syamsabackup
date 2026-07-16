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
 *
 * Features:
 * - Auto-sync with configurable interval
 * - Pause/resume functionality
 * - Sync progress tracking
 * - Sync history/audit log
 * - Selective sync by table/date range
 * - Offline change indicators
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

    // NEW: Pause/Resume state
    this._isPaused = false;
    this._pauseTime = null;

    // NEW: Progress tracking
    this._progress = {
      current: 0,
      total: 0,
      phase: 'idle', // 'idle' | 'outbound' | 'inbound' | 'complete'
      lastOutbound: 0,
      lastInbound: 0,
      errors: []
    };

    // NEW: Sync history
    this._history = [];
    this._maxHistoryItems = 50;

    // NEW: Selective sync options
    this._syncOptions = {
      tables: ['attendances', 'permits', 'tahfizh', 'settings'],
      dateRange: null, // { start: Date, end: Date }
      forceFullSync: false
    };

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
    this.onProgressUpdate = null; // NEW
    this.onConflictDetected = null; // NEW
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

    // Setup auto-sync if Supabase is enabled
    if (window.isSupabaseEnabled) {
      this.startAutoSync();
    }

    // Setup online/offline listeners
    window.addEventListener('online', () => {
      if (!this._isPaused) {
        this.syncAll();
      }
    });

    // Load sync history from storage
    await this._loadHistory();

    return this;
  }

  // ============================================================
  // PAUSE / RESUME
  // ============================================================

  /**
   * Pause automatic sync
   */
  pause() {
    this._isPaused = true;
    this._pauseTime = Date.now();

    // Save pause state to localStorage
    localStorage.setItem('sync_paused', 'true');
    localStorage.setItem('sync_paused_at', this._pauseTime.toString());

    // Emit event
    this._emitProgress();
  }

  /**
   * Resume automatic sync
   */
  resume() {
    this._isPaused = false;

    // Clear pause state
    localStorage.removeItem('sync_paused');
    localStorage.removeItem('sync_paused_at');

    // Trigger immediate sync
    this.syncAll();

    // Emit event
    this._emitProgress();
  }

  /**
   * Check if sync is paused
   */
  isPaused() {
    return this._isPaused;
  }

  /**
   * Toggle pause/resume
   */
  togglePause() {
    if (this._isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this._isPaused;
  }

  // ============================================================
  // PROGRESS TRACKING
  // ============================================================

  /**
   * Get current progress
   */
  getProgress() {
    return { ...this._progress };
  }

  /**
   * Update progress
   */
  _updateProgress(updates) {
    this._progress = { ...this._progress, ...updates };
    this._emitProgress();
  }

  /**
   * Emit progress event
   */
  _emitProgress() {
    if (this.onProgressUpdate) {
      this.onProgressUpdate(this._progress);
    }

    // Update UI indicator if available
    const indicator = document.getElementById('supabase-sync-status');
    if (indicator) {
      this._updateStatusIndicator();
    }
  }

  /**
   * Update status indicator in UI
   */
  _updateStatusIndicator() {
    const indicator = document.getElementById('supabase-sync-status');
    if (!indicator) return;

    let icon = 'cloud';
    let text = 'Supabase Cloud';
    let colorClass = 'text-slate-400';
    let animateClass = '';

    if (!window.isSupabaseEnabled) {
      icon = 'cloud-off';
      text = 'Lokal Only';
    } else if (this._isPaused) {
      icon = 'pause';
      text = 'Sync Dijeda';
      colorClass = 'text-amber-500';
    } else if (this.isSyncing) {
      icon = 'refresh-cw';
      text = `Sinkron... ${this._progress.current}/${this._progress.total}`;
      colorClass = 'text-blue-500';
      animateClass = 'animate-spin';
    } else if (this._progress.errors.length > 0) {
      icon = 'alert-circle';
      text = 'Sync Error';
      colorClass = 'text-red-500';
    } else {
      icon = 'cloud-check';
      text = 'Cloud Terhubung';
      colorClass = 'text-emerald-500';
    }

    indicator.className = `relative p-2.5 rounded-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none ${colorClass}`;
    indicator.title = `${text} (Klik untuk opsi sinkronisasi)`;
    indicator.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 block ${animateClass}"></i>`;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // ============================================================
  // SYNC HISTORY
  // ============================================================

  /**
   * Get sync history
   */
  getHistory(limit = 20) {
    return this._history.slice(0, limit);
  }

  /**
   * Add entry to sync history
   */
  async _addToHistory(entry) {
    const historyEntry = {
      id: Date.now().toString(36),
      timestamp: Date.now(),
      ...entry
    };

    this._history.unshift(historyEntry);

    // Trim history if needed
    if (this._history.length > this._maxHistoryItems) {
      this._history = this._history.slice(0, this._maxHistoryItems);
    }

    // Save to localStorage
    await this._saveHistory();
  }

  /**
   * Load history from localStorage
   */
  async _loadHistory() {
    try {
      const saved = localStorage.getItem('sync_history');
      if (saved) {
        this._history = JSON.parse(saved);
      }
    } catch (e) {
      this._logger.warn('Failed to load sync history:', e);
      this._history = [];
    }
  }

  /**
   * Save history to localStorage
   */
  async _saveHistory() {
    try {
      localStorage.setItem('sync_history', JSON.stringify(this._history));
    } catch (e) {
      this._logger.warn('Failed to save sync history:', e);
    }
  }

  /**
   * Clear sync history
   */
  clearHistory() {
    this._history = [];
    localStorage.removeItem('sync_history');
  }

  // ============================================================
  // SELECTIVE SYNC
  // ============================================================

  /**
   * Get current sync options
   */
  getSyncOptions() {
    return { ...this._syncOptions };
  }

  /**
   * Set sync options
   */
  setSyncOptions(options) {
    this._syncOptions = { ...this._syncOptions, ...options };
    this._logger.info('Sync options updated:', this._syncOptions);
  }

  /**
   * Enable selective sync for specific tables
   */
  setTablesToSync(tables) {
    this._syncOptions.tables = tables;
  }

  /**
   * Set date range for sync
   */
  setDateRange(start, end) {
    this._syncOptions.dateRange = { start, end };
  }

  /**
   * Clear date range (sync all)
   */
  clearDateRange() {
    this._syncOptions.dateRange = null;
  }

  /**
   * Force full sync on next sync
   */
  forceFullSync() {
    this._syncOptions.forceFullSync = true;
    this._syncOptions.dateRange = null;
  }

  // ============================================================
  // CORE SYNC METHODS
  // ============================================================

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
           this._userKelas === 'admin musyrif' ||
           appState?.adminMode === true ||
           appState?.superadminMode === true;
  }

  /**
   * Check if user is Wali (parent)
   */
  isWali() {
    return this._userRole === 'wali' || appState?.waliMode === true;
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
      if (navigator.onLine && window.isSupabaseEnabled && !this.isSyncing && !this._isPaused) {
        this.syncAll();
      }
    }, this._syncIntervalMs);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
    }
  }

  /**
   * Full sync - both directions
   */
  async syncAll(options = {}) {
    if (this.isSyncing || !window.isSupabaseEnabled || !navigator.onLine) {
      return;
    }

    if (this._isPaused) {
      this._logger.info('Sync skipped - paused');
      return;
    }

    this.isSyncing = true;
    this._progress = {
      current: 0,
      total: 0,
      phase: 'idle',
      lastOutbound: 0,
      lastInbound: 0,
      errors: []
    };

    this._updateProgress({ phase: 'idle' });

    if (this.onSyncStart) {
      this.onSyncStart();
    }

    const startTime = Date.now();

    try {
      // Step 1: Push local changes to cloud
      this._updateProgress({ phase: 'outbound' });
      await this.syncOutbound(options);

      // Step 2: Pull cloud changes to local
      this._updateProgress({ phase: 'inbound' });
      await this.syncInbound(options);

      const duration = Date.now() - startTime;

      this._updateProgress({
        phase: 'complete',
        current: this._progress.total,
        total: this._progress.total
      });

      this._logger.info('Full sync completed', {
        outbound: this._progress.lastOutbound,
        inbound: this._progress.lastInbound,
        duration: `${duration}ms`
      });

      // Add to history
      await this._addToHistory({
        type: 'full',
        success: true,
        outbound: this._progress.lastOutbound,
        inbound: this._progress.lastInbound,
        duration,
        errors: this._progress.errors.length
      });

      if (this.onSyncComplete) {
        this.onSyncComplete({
          success: true,
          outbound: this._progress.lastOutbound,
          inbound: this._progress.lastInbound,
          duration
        });
      }

      if (this.onDataUpdate) {
        this.onDataUpdate();
      }

    } catch (error) {
      this._logger.error('Sync failed:', error);

      // Add failed sync to history
      await this._addToHistory({
        type: 'full',
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      });

      if (this.onSyncError) {
        this.onSyncError(error);
      }
    } finally {
      this.isSyncing = false;
      this._updateStatusIndicator();
    }
  }

  /**
   * Push local changes to cloud
   */
  async syncOutbound(options = {}) {
    if (!window.syncQueue) return;

    const pendingChanges = await window.syncQueue.getPending(100);
    if (pendingChanges.length === 0) {
      this._progress.lastOutbound = 0;
      return;
    }

    this._logger.debug(`Pushing ${pendingChanges.length} changes to cloud`);

    const total = pendingChanges.length;
    this._updateProgress({ total, current: 0 });

    let synced = 0;

    for (let i = 0; i < pendingChanges.length; i++) {
      const change = pendingChanges[i];

      try {
        const table = change.entity_type || change.entityType;
        const entityId = change.entity_id || change.entityId;

        // Skip local-only tables
        if (['sync_queue', 'conflicts', 'sync_metadata', 'meta'].includes(table)) {
          await window.syncQueue.deleteChange(change.id);
          continue;
        }

        // Skip tables not in sync options
        if (this._syncOptions.tables.length > 0 && !this._syncOptions.tables.includes(table)) {
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
        synced++;

        this._updateProgress({ current: i + 1, lastOutbound: synced });

      } catch (error) {
        this._logger.error(`Failed to sync change ${change.id}:`, error);
        this._progress.errors.push({ id: change.id, error: error.message });
        await window.syncQueue.markFailed(change.id, error);
      }
    }

    this._progress.lastOutbound = synced;
  }

  /**
   * Pull cloud changes to local
   */
  async syncInbound(options = {}) {
    const db = this._db;
    db.isSyncing = true;

    try {
      const tables = this._syncOptions.tables;
      let totalInbound = 0;

      // Determine which tables to sync based on role and options
      for (const table of tables) {
        if (this.isAdmin()) {
          const count = await this._syncTableInbound(table);
          totalInbound += count;
        } else if (this.isWali()) {
          const count = await this._syncWaliTableInbound(table);
          totalInbound += count;
        } else {
          const count = await this._syncKelasTableInbound(table, this._userKelas);
          totalInbound += count;
        }

        this._updateProgress({
          current: this._progress.total + totalInbound,
          lastInbound: totalInbound
        });
      }

      // Reload state
      if (window.stateManager) {
        await window.stateManager._loadPersistedState();
        window.stateManager._emit?.('change', ['attendanceData', 'permits', 'tahfizh']);
      }

      this._progress.lastInbound = totalInbound;

    } finally {
      db.isSyncing = false;
    }
  }

  /**
   * Sync inbound for a specific table (Admin)
   */
  async _syncTableInbound(table) {
    if (table === 'settings') {
      // Settings always synced for everyone
      try {
        const { data, error } = await window.supabaseClient.from(table).select('*');
        if (error) throw error;
        if (data && data.length > 0) {
          for (const record of data) {
            const localRecord = await this._db.get(table, record.id);
            if (!localRecord || (record._version > (localRecord._version || 0))) {
              await this._db.put(table, record);
            }
          }
          return data.length;
        }
      } catch (error) {
        this._logger.error(`Failed to sync ${table}:`, error);
      }
      return 0;
    }

    try {
      let query = window.supabaseClient.from(table).select('*');

      // Apply date range filter if set
      if (this._syncOptions.dateRange) {
        const dateField = table === 'attendances' ? 'date' : 'tanggal';
        query = query.gte(dateField, this._syncOptions.dateRange.start)
                       .lte(dateField, this._syncOptions.dateRange.end);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data && data.length > 0) {
        await this._db.bulkPut(table, data);
        this._logger.debug(`Synced ${data.length} records for ${table}`);
        return data.length;
      }
    } catch (error) {
      this._logger.error(`Failed to sync ${table}:`, error);
    }
    return 0;
  }

  /**
   * Sync inbound for a specific table (Musyrif)
   */
  async _syncKelasTableInbound(table, kelas) {
    if (!kelas) return 0;

    try {
      let query = window.supabaseClient.from(table).select('*').eq('kelas', kelas);

      // Apply date range filter if set
      if (this._syncOptions.dateRange) {
        const dateField = table === 'attendances' ? 'date' : 'tanggal';
        query = query.gte(dateField, this._syncOptions.dateRange.start)
                       .lte(dateField, this._syncOptions.dateRange.end);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data && data.length > 0) {
        await this._db.bulkPut(table, data);
        this._logger.debug(`Synced ${data.length} ${table} records for kelas ${kelas}`);
        return data.length;
      }
    } catch (error) {
      this._logger.error(`Failed to sync ${table} for kelas ${kelas}:`, error);
    }
    return 0;
  }

  /**
   * Sync inbound for a specific table (Wali)
   */
  async _syncWaliTableInbound(table) {
    if (!this._userNis) return 0;

    const nisField = table === 'attendances' ? 'studentId' : 'nis';

    try {
      let query = window.supabaseClient.from(table).select('*').eq(nisField, this._userNis);

      // Apply date range filter if set
      if (this._syncOptions.dateRange) {
        const dateField = table === 'attendances' ? 'date' : 'tanggal';
        query = query.gte(dateField, this._syncOptions.dateRange.start)
                       .lte(dateField, this._syncOptions.dateRange.end);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data && data.length > 0) {
        await this._db.bulkPut(table, data);
        this._logger.debug(`Synced ${data.length} ${table} records for NIS ${this._userNis}`);
        return data.length;
      }
    } catch (error) {
      this._logger.error(`Failed to sync ${table} for NIS ${this._userNis}:`, error);
    }
    return 0;
  }

  /**
   * Force sync specific table
   */
  async forceSyncTable(tableName) {
    if (!window.isSupabaseEnabled || !navigator.onLine) {
      this._logger.warn('Cannot force sync - offline or Supabase disabled');
      return;
    }

    if (this._isPaused) {
      this._logger.warn('Cannot force sync - sync is paused');
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
        const nisField = tableName === 'attendances' ? 'studentId' : 'nis';
        const { data, error } = await window.supabaseClient
          .from(tableName)
          .select('*')
          .eq(nisField, this._userNis);
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

      // Add to history
      await this._addToHistory({
        type: 'force',
        table: tableName,
        success: true
      });

    } catch (error) {
      this._logger.error(`Force sync failed for ${tableName}:`, error);

      await this._addToHistory({
        type: 'force',
        table: tableName,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isSyncing: this.isSyncing,
      isPaused: this._isPaused,
      role: this._userRole,
      kelas: this._userKelas,
      isOnline: navigator.onLine,
      isSupabaseEnabled: window.isSupabaseEnabled,
      autoSyncActive: !!this._syncInterval,
      progress: this.getProgress(),
      historyCount: this._history.length
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
