/**
 * StorageManagerV2 - Optimized IndexedDB-First Storage
 *
 * OPTIMIZATION: Uses IndexedDB as PRIMARY storage only.
 * LocalStorage is kept for read-only caching (backup display),
 * but writes go to IndexedDB only - eliminating dual write overhead.
 *
 * FEATURES:
 * - IndexedDB as single source of truth
 * - Delta sync with timestamp-based tracking
 * - Auto-persistence with debouncing
 * - Version tracking
 * - Event callbacks
 * - Reduced storage write operations
 */

class StorageManagerV2 {
  constructor() {
    // Config - matches old StorageManager API
    this.keys = {
      attendance: 'musyrif_app_v5_fix',
      permits: 'musyrif_permits_db',
      settings: 'musyrif_settings',
      activityLog: 'musyrif_activity_log',
      googleAuth: 'musyrif_google_session',
      tahfizh: 'tahfizh_local_setoran',
    };

    this.autoSave = {
      debounceMs: 500,
      enabled: true
    };

    // State
    this.isOnline = navigator.onLine;
    this.musyrifId = null;
    this._saveTimer = null;
    this._lastSavedData = null;
    this._lastSavedVersion = 0;

    // NEW: Timestamp-based delta sync
    this._lastSyncTime = null;
    this._syncVersion = 0;

    // Database references
    this._db = null;
    this._repos = null;
    this._stateManager = null;
    this._initialized = false;

    // Event callbacks
    this.onOnlineStatusChange = null;
    this.onDataUpdate = null;

    // Mode flag - true = IndexedDB primary (optimized), false = localStorage fallback
    this._useIndexedDB = false;

    // OPTIMIZATION: Track dirty state to avoid unnecessary writes
    this._isDirty = false;

    // Setup connection listeners
    this._setupConnectionListeners();
  }

  /**
   * Initialize StorageManager
   */
  async init(musyrifId) {
    this.musyrifId = musyrifId;

    // Load last sync time from localStorage
    this._lastSyncTime = parseInt(localStorage.getItem('sync_last_time') || '0', 10) || null;

    try {
      // Initialize the database system
      const result = await initDatabase();

      this._db = result.localDB;
      this._repos = result.repos;
      this._stateManager = result.stateManager;
      this._useIndexedDB = true;

      // Setup state subscriptions
      this._setupStateSubscriptions();

      // Cloud is authoritative: complete inbound/outbound reconciliation
      // before hydrating application state from the device cache.
      if (window.supabaseSync) {
        await window.supabaseSync.init(this._db, this._repos);
      }

      await this._loadFromDatabase();

      this._initialized = true;

    } catch (error) {
      console.error('[StorageManagerV2] Cache initialization failed:', error);
      this._useIndexedDB = false;
      window.showToast?.('Cache perangkat gagal. Data lokal tidak digunakan sebagai sumber utama.', 'error');
      this._initialized = true;
    }

    // Auto-trigger dashboard refresh once initialization is complete
    if (typeof window.updateDashboard === 'function') {
      window.updateDashboard();
    }
  }

  /**
   * Setup online/offline listeners
   */
  _setupConnectionListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      if (this.onOnlineStatusChange) {
        this.onOnlineStatusChange(true);
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      if (this.onOnlineStatusChange) {
        this.onOnlineStatusChange(false);
      }
    });
  }

  /**
   * Setup state subscriptions for reactivity
   */
  _setupStateSubscriptions() {
    if (!this._stateManager) return;

    this._stateManager.subscribe((changedKeys) => {
      if (this.onDataUpdate) {
        changedKeys.forEach(key => {
          this.onDataUpdate(key);
        });
      }

      // Mark as dirty for batch sync
      this._isDirty = true;

      // Auto-refresh dashboard and leaderboard on inbound sync updates
      if (changedKeys.includes('attendanceData') || changedKeys.includes('permits') || changedKeys.includes('attendance') || changedKeys.includes('tahfizh') || changedKeys.includes('tahfizhSetoran')) {
        if (typeof window.updateDashboard === 'function') {
          if (typeof appState !== 'undefined' && (appState.adminMode || appState.superadminMode)) {
            if (window._repos?.attendance) {
              window._repos.attendance.getByDate(appState.date).then(records => {
                window.adminAttendanceCache = records;
                window.updateDashboard();
                if (typeof window.renderMusyrifLeaderboard === 'function') {
                  window.renderMusyrifLeaderboard();
                }
              }).catch(err => console.warn('[StorageManagerV2] Failed to refresh admin attendance cache:', err));
            } else {
              window.updateDashboard();
            }
          } else {
            window.updateDashboard();
          }
        }
      }
    });
  }

  /**
   * Load data from IndexedDB into appState
   * OPTIMIZATION: Uses delta sync - only load records changed since last sync
   */
  async _loadFromDatabase() {
    if (!this._repos || !this._db) return;

    try {
      const kelas = this.musyrifId?.replace('class_', '') || 'Unknown';

      // OPTIMIZATION: Delta sync - only load records changed since last sync
      let attendanceRecords;
      if (this._lastSyncTime && !this._syncVersion) {
        attendanceRecords = await this._repos.attendance.getByKelasModifiedAfter(kelas, this._lastSyncTime);
      } else {
        attendanceRecords = await this._repos.attendance.getByKelas(kelas);
      }

      // Transform IndexedDB records to legacy appState format
      const attendanceData = {};
      attendanceRecords.forEach(record => {
        if (!attendanceData[record.date]) {
          attendanceData[record.date] = {};
        }
        if (!attendanceData[record.date][record.slot]) {
          attendanceData[record.date][record.slot] = {};
        }
        attendanceData[record.date][record.slot][record.studentId] = {
          status: record.status || {},
          note: record.note || '',
          timestamps: record.timestamps || {},
          _lastUpdated: record._updatedAt ? new Date(record._updatedAt).getTime() : Date.now(),
        };
      });

      if (typeof appState !== 'undefined') {
        appState.attendanceData = attendanceData;
      }

      // Load permits
      const permits = await this._repos.permit.getByKelas(kelas);
      if (typeof appState !== 'undefined') {
        appState.permits = permits || [];
      }

      // Load tahfizh
      if (this._repos?.tahfizh) {
        const tahfizhList = await this._repos.tahfizh.getAll();
        if (typeof appState !== 'undefined') {
          appState.tahfizhSetoran = tahfizhList || [];
        }
      }

      // Load settings
      const settings = await this._repos.settings.getUserSettings();
      if (typeof appState !== 'undefined') {
        appState.settings = { ...appState.settings, ...settings };
      }

      // Load activity log
      const activityLog = await this._repos.activityLog.getRecent(50);
      if (typeof appState !== 'undefined') {
        appState.activityLog = activityLog || [];
      }

      // OPTIMIZATION: Update localStorage cache (read-only) for backup display
      this._updateLocalStorageCache();

    } catch (error) {
      console.error('[StorageManagerV2] Failed to load from IndexedDB:', error);
    }
  }

  /**
   * OPTIMIZATION: Update localStorage cache (read-only backup)
   * Only updates cache, does NOT write to IndexedDB
   */
  async _updateLocalStorageCache() {
    if (typeof appState === 'undefined') return;

    try {
      // Only update if data has changed
      const currentData = JSON.stringify(appState.attendanceData);
      if (currentData === this._lastSavedData) return;

      // Update localStorage cache for fallback/backup
      this._set(this.keys.attendance, appState.attendanceData);
      this._set(this.keys.permits, appState.permits);
      this._set(this.keys.settings, appState.settings);
      this._set(this.keys.activityLog, appState.activityLog);
      this._set(this.keys.tahfizh, appState.tahfizhSetoran || []);

      this._lastSavedData = currentData;

    } catch (error) {
      console.error('[StorageManagerV2] Failed to update localStorage cache:', error);
    }
  }

  /**
   * Load data from localStorage (fallback only)
   */
  _loadFromStorage() {
    // Load attendance
    const attendanceData = this._get(this.keys.attendance);
    if (attendanceData && typeof appState !== 'undefined') {
      appState.attendanceData = attendanceData;
    }

    // Load permits
    const permits = this._get(this.keys.permits);
    if (permits && typeof appState !== 'undefined') {
      appState.permits = permits;
    }

    // Load settings
    const settings = this._get(this.keys.settings);
    if (settings && typeof appState !== 'undefined') {
      appState.settings = { ...appState.settings, ...settings };
    }

    // Load activity log
    const activityLog = this._get(this.keys.activityLog);
    if (activityLog && typeof appState !== 'undefined') {
      appState.activityLog = activityLog;
    }

    // Load tahfizh
    const tahfizhSetoran = this._get(this.keys.tahfizh);
    if (tahfizhSetoran && typeof appState !== 'undefined') {
      appState.tahfizhSetoran = tahfizhSetoran;
    }
  }

  // ==========================================
  // LOCAL STORAGE HELPERS (cache only, not primary)
  // ==========================================

  _get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`[StorageManagerV2] Error reading ${key}:`, error);
      return null;
    }
  }

  _set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`[StorageManagerV2] Error writing ${key}:`, error);
      if (error.name === 'QuotaExceededError') {
        window.showToast?.('Storage hampir penuh!', 'error');
      }
      return false;
    }
  }

  // ==========================================
  // ATTENDANCE OPERATIONS
  // ==========================================

  /**
   * Save attendance data
   * OPTIMIZATION: Single write to IndexedDB, no dual write
   */
  saveAttendance(dateKey, slotId, data) {
    if (typeof appState === 'undefined') return;

    // Ensure structure
    if (!appState.attendanceData[dateKey]) {
      appState.attendanceData[dateKey] = {};
    }
    if (!appState.attendanceData[dateKey][slotId]) {
      appState.attendanceData[dateKey][slotId] = {};
    }

    // Update with metadata
    appState.attendanceData[dateKey][slotId] = {
      ...appState.attendanceData[dateKey][slotId],
      ...data,
      _lastUpdated: Date.now(),
      _savedBy: this.musyrifId,
    };

    // Mark dirty and schedule save
    this._isDirty = true;
    if (this.autoSave.enabled) {
      this._scheduleAutoSave();
    }

    // Callback
    if (this.onDataUpdate) {
      this.onDataUpdate('attendance', dateKey, slotId);
    }

    return appState.attendanceData[dateKey][slotId];
  }

  /**
   * Get attendance data
   */
  getAttendance(dateKey, slotId) {
    if (typeof appState === 'undefined') return {};
    return appState.attendanceData[dateKey]?.[slotId] || {};
  }

  /**
   * Get all attendance for date
   */
  getAttendanceByDate(dateKey) {
    if (typeof appState === 'undefined') return {};
    return appState.attendanceData[dateKey] || {};
  }

  // ==========================================
  // PERMIT OPERATIONS
  // ==========================================

  /**
   * Save permits (full array)
   * OPTIMIZATION: Single write to IndexedDB only
   */
  async savePermits(permits) {
    if (typeof appState !== 'undefined') {
      appState.permits = permits;
    }

    // OPTIMIZATION: IndexedDB is PRIMARY - localStorage only as read cache
    if (this._useIndexedDB && this._repos?.permit) {
      try {
        for (const permit of permits) {
          const existing = await this._repos.permit.get(permit.id);
          if (existing) {
            await this._repos.permit.update(permit.id, permit);
          } else {
            await this._repos.permit.create(permit);
          }
        }
      } catch (err) {
        console.error('[StorageManagerV2] Failed to save permits to IndexedDB:', err);
      }
    }

    // Update localStorage cache (not primary)
    this._set(this.keys.permits, permits);

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }

    return permits;
  }

  /**
   * Save single permit - immutable update
   * OPTIMIZATION: Single write to IndexedDB only
   */
  async savePermit(permit) {
    if (typeof appState === 'undefined') {
      return permit;
    }

    const permits = appState.permits || [];
    const index = permits.findIndex(p => p && String(p.id) === String(permit.id));

    // Immutable update
    let updatedPermits;
    if (index !== -1) {
      updatedPermits = permits.map((p, i) => i === index ? permit : p);
    } else {
      updatedPermits = [...permits, permit];
    }

    appState.permits = updatedPermits;

    // OPTIMIZATION: IndexedDB primary - no dual write
    if (this._useIndexedDB && this._repos?.permit) {
      try {
        const existing = await this._repos.permit.get(permit.id);
        if (existing) {
          await this._repos.permit.update(permit.id, permit);
        } else {
          await this._repos.permit.create(permit);
        }
      } catch (err) {
        console.error('[StorageManagerV2] Failed to save permit to IndexedDB:', err);
      }
    }

    // Update localStorage cache only
    this._set(this.keys.permits, updatedPermits);

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }

    return permit;
  }

  /**
   * Delete permit - immutable update
   * OPTIMIZATION: Single delete from IndexedDB only
   */
  async deletePermit(permitId) {
    if (typeof appState !== 'undefined' && Array.isArray(appState.permits)) {
      // Immutable update
      appState.permits = appState.permits.filter(p => String(p.id) !== String(permitId));
    }

    // OPTIMIZATION: IndexedDB primary - no dual write
    if (this._useIndexedDB && this._repos?.permit) {
      try {
        await this._repos.permit.delete(permitId);
      } catch (err) {
        console.error('[StorageManagerV2] Failed to delete permit from IndexedDB:', err);
      }
    }

    // Update localStorage cache only
    if (typeof appState !== 'undefined') {
      this._set(this.keys.permits, appState.permits);
    }

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }
  }

  // ==========================================
  // TAHFIZH OPERATIONS
  // ==========================================

  /**
   * Save tahfizh setoran (full array)
   */
  async saveTahfizhSetoran(records) {
    if (typeof appState !== 'undefined') {
      appState.tahfizhSetoran = records;
    }

    if (this._useIndexedDB && this._repos?.tahfizh) {
      try {
        // Since it's a full array save (overwrite style), delete items that are no longer present
        const currentDB = await this._repos.tahfizh.getAll();
        const recordIds = new Set(records.map(r => String(r.id || window.generateTahfizhId(r.kelas, r.nis, r.rowNumber))));
        
        for (const item of currentDB) {
          if (!recordIds.has(String(item.id))) {
            await this._repos.tahfizh.delete(item.id);
          }
        }

        for (const record of records) {
          const normalized = window.normalizeTahfizhSetoran(record);
          const existing = await this._repos.tahfizh.get(normalized.id);
          if (existing) {
            await this._repos.tahfizh.update(normalized.id, normalized);
          } else {
            await this._repos.tahfizh.create(normalized);
          }
        }
      } catch (err) {
        console.error('[StorageManagerV2] Failed to save tahfizh setoran to IndexedDB:', err);
      }
    }

    this._set(this.keys.tahfizh, records);

    if (this.onDataUpdate) {
      this.onDataUpdate('tahfizh');
    }

    return records;
  }

  /**
   * Save single tahfizh record
   */
  async saveTahfizh(record) {
    if (typeof appState === 'undefined') return record;

    const normalized = window.normalizeTahfizhSetoran(record);
    const list = appState.tahfizhSetoran || [];
    const index = list.findIndex(r => r && String(r.id) === String(normalized.id));

    let updatedList;
    if (index !== -1) {
      updatedList = list.map((r, i) => i === index ? normalized : r);
    } else {
      updatedList = [normalized, ...list];
    }

    appState.tahfizhSetoran = updatedList;

    if (this._useIndexedDB && this._repos?.tahfizh) {
      try {
        const existing = await this._repos.tahfizh.get(normalized.id);
        if (existing) {
          await this._repos.tahfizh.update(normalized.id, normalized);
        } else {
          await this._repos.tahfizh.create(normalized);
        }
      } catch (err) {
        console.error('[StorageManagerV2] Failed to save tahfizh record to IndexedDB:', err);
      }
    }

    this._set(this.keys.tahfizh, updatedList);

    if (this.onDataUpdate) {
      this.onDataUpdate('tahfizh');
    }

    return normalized;
  }

  /**
   * Delete tahfizh record
   */
  async deleteTahfizh(id) {
    if (typeof appState !== 'undefined' && Array.isArray(appState.tahfizhSetoran)) {
      appState.tahfizhSetoran = appState.tahfizhSetoran.filter(r => String(r.id) !== String(id));
    }

    if (this._useIndexedDB && this._repos?.tahfizh) {
      try {
        await this._repos.tahfizh.delete(id);
      } catch (err) {
        console.error('[StorageManagerV2] Failed to delete tahfizh record from IndexedDB:', err);
      }
    }

    if (typeof appState !== 'undefined') {
      this._set(this.keys.tahfizh, appState.tahfizhSetoran);
    }

    if (this.onDataUpdate) {
      this.onDataUpdate('tahfizh');
    }
  }

  // ==========================================
  // SETTINGS OPERATIONS
  // ==========================================

  saveSettings(settings) {
    if (typeof appState !== 'undefined') {
      appState.settings = { ...appState.settings, ...settings };
    }

    // OPTIMIZATION: IndexedDB primary
    if (this._useIndexedDB && this._stateManager) {
      this._stateManager.updateSettings(settings);
    }

    // Update cache only
    this._set(this.keys.settings, settings);

    if (this.onDataUpdate) {
      this.onDataUpdate('settings');
    }

    return appState.settings;
  }

  // ==========================================
  // ACTIVITY LOG OPERATIONS
  // ==========================================

  saveActivityLog(logs) {
    if (typeof appState !== 'undefined') {
      appState.activityLog = logs;
    }

    // Update cache only (activity logs are local)
    this._set(this.keys.activityLog, logs);

    if (this.onDataUpdate) {
      this.onDataUpdate('activityLog');
    }
  }

  // ==========================================
  // PERSISTENCE MANAGEMENT
  // ==========================================

  /**
   * FIX: Immediate write to IndexedDB to prevent data loss.
   * Browser crash/close within debounce window no longer causes data loss.
   */
  _scheduleAutoSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }

    // FIXED: Write to IndexedDB IMMEDIATELY for data safety.
    // This ensures data is persisted even if browser crashes.
    // Debounce is only for localStorage cache update (non-critical).
    this._immediateIndexedDBWrite();

    // Debounce localStorage cache update (optional, non-critical)
    this._saveTimer = setTimeout(() => {
      this._updateLocalStorageCache();
    }, this.autoSave.debounceMs);
  }

  /**
   * FIXED: Immediate write to IndexedDB on every change.
   * This prevents data loss on browser crash/close.
   */
  async _immediateIndexedDBWrite() {
    if (typeof appState === 'undefined') return;

    const currentVersion = appState._version || 0;

    // Skip if no actual changes
    if (this._lastSavedVersion === currentVersion && !this._isDirty) {
      return;
    }

    this._lastSavedVersion = currentVersion;
    this._isDirty = false;

    if (this._useIndexedDB && this._stateManager) {
      try {
        // FIXED: Use forcePersist which now writes to IndexedDB immediately
        await this._stateManager.forcePersist();
        Logger.debug('[StorageManagerV2] IndexedDB write (v' + currentVersion + ')');
      } catch (err) {
        this._logger.error('[StorageManagerV2] IndexedDB write failed:', err);
        // Fallback: try to save to localStorage immediately
        this._emergencyLocalStorageBackup();
      }
    }
  }

  /**
   * Emergency backup to localStorage if IndexedDB fails
   */
  _emergencyLocalStorageBackup() {
    if (typeof appState === 'undefined') return;

    try {
      if (appState.attendanceData) {
        this._set(this.keys.attendance, appState.attendanceData);
      }
      if (appState.permits) {
        this._set(this.keys.permits, appState.permits);
      }
      Logger.warn('[StorageManagerV2] Emergency backup to localStorage');
    } catch (err) {
      this._logger.error('[StorageManagerV2] Emergency backup also failed:', err);
    }
  }

  _performAutoSave() {
    this._saveTimer = null;

    if (typeof appState === 'undefined') return;

    // Check for changes
    const currentData = JSON.stringify(appState.attendanceData);
    const currentVersion = appState._version || 0;

    if (currentData === this._lastSavedData &&
        currentVersion === this._lastSavedVersion &&
        !this._isDirty) {
      return; // No changes
    }

    this._lastSavedData = currentData;
    this._lastSavedVersion = currentVersion;
    this._isDirty = false;

    if (this._useIndexedDB && this._stateManager) {
      // Use state manager for IndexedDB (PRIMARY)
      this._stateManager.forcePersist();

      // Update localStorage cache in background
      this._updateLocalStorageCache();

    } else {
      // Fall back to localStorage only
      if (appState.attendanceData) {
        this._set(this.keys.attendance, appState.attendanceData);
      }
      if (appState.permits) {
        this._set(this.keys.permits, appState.permits);
      }
      if (appState.settings) {
        this._set(this.keys.settings, appState.settings);
      }
      if (appState.activityLog) {
        this._set(this.keys.activityLog, appState.activityLog);
      }
    }

    Logger.debug('[StorageManagerV2] Auto-saved (v' + currentVersion + ')');
  }

  /**
   * Force immediate save
   */
  saveNow() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._performAutoSave();
  }

  // ==========================================
  // DELTA SYNC METHODS (NEW)
  // ==========================================

  /**
   * Update last sync timestamp for delta sync
   */
  updateLastSyncTime(timestamp = Date.now()) {
    this._lastSyncTime = timestamp;
    localStorage.setItem('sync_last_time', timestamp.toString());
    this._syncVersion++;
    Logger.debug('[StorageManagerV2] Last sync updated:', new Date(timestamp).toISOString());
  }

  /**
   * Get last sync time
   */
  getLastSyncTime() {
    return this._lastSyncTime;
  }

  /**
   * Force full sync on next load (bypass delta)
   */
  forceFullSync() {
    this._lastSyncTime = null;
    this._syncVersion = 0;
    localStorage.removeItem('sync_last_time');
    Logger.debug('[StorageManagerV2] Full sync enforced on next load');
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  getStatus() {
    return {
      isOnline: this.isOnline,
      musyrifId: this.musyrifId,
      storageKeys: this.keys,
      useIndexedDB: this._useIndexedDB,
      initialized: this._initialized,
      lastSyncTime: this._lastSyncTime,
      isDirty: this._isDirty
    };
  }

  isStorageAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  getStorageUsage() {
    let totalSize = 0;
    const details = {};

    for (const key of Object.values(this.keys)) {
      const data = localStorage.getItem(key);
      if (data) {
        const size = new Blob([data]).size;
        details[key] = size;
        totalSize += size;
      }
    }

    return {
      totalBytes: totalSize,
      totalKB: Math.round(totalSize / 1024 * 100) / 100,
      details,
    };
  }

  async getIndexedDBUsage() {
    if (!this._db) return null;

    try {
      return {
        attendances: await this._db.count('attendances'),
        permits: await this._db.count('permits'),
        tahfizh: await this._db.count('tahfizh'),
        activityLogs: await this._db.count('activity_logs'),
        settings: await this._db.count('settings'),
      };
    } catch (e) {
      return null;
    }
  }

  // ==========================================
  // ENHANCEMENT: PROACTIVE QUOTA MONITORING
  // ==========================================

  /**
   * ENHANCEMENT: Check storage quota and alert user proactively
   * Call this periodically or before large operations
   * @param {Object} options - Configuration options
   * @param {number} options.warnThreshold - Warning threshold (0-1), default 0.7 (70%)
   * @param {number} options.criticalThreshold - Critical threshold (0-1), default 0.9 (90%)
   * @returns {Object} Quota status
   */
  async checkQuota(options = {}) {
    const {
      warnThreshold = 0.7,  // 70%
      criticalThreshold = 0.9, // 90%
    } = options;

    try {
      // Check localStorage quota
      const localStorageResult = await this._checkLocalStorageQuota(warnThreshold, criticalThreshold);

      // Check IndexedDB usage (approximate)
      const indexedDBResult = await this._checkIndexedDBUsage(warnThreshold, criticalThreshold);

      const status = {
        localStorage: localStorageResult,
        indexedDB: indexedDBResult,
        isWarning: localStorageResult.isWarning || indexedDBResult.isWarning,
        isCritical: localStorageResult.isCritical || indexedDBResult.isCritical,
        timestamp: Date.now(),
      };

      // Dispatch event for UI to handle
      if (status.isWarning || status.isCritical) {
        window.dispatchEvent(new CustomEvent('storage:quota-warning', { detail: status }));
      }

      return status;
    } catch (e) {
      Logger.error('[StorageManagerV2] Quota check failed:', e);
      return null;
    }
  }

  /**
   * Check localStorage quota usage
   * @private
   */
  async _checkLocalStorageQuota(warnThreshold, criticalThreshold) {
    try {
      // Estimate localStorage usage
      const usage = this.getStorageUsage();
      const estimatedQuota = 5 * 1024 * 1024; // ~5MB typical localStorage
      const usedPercent = usage.totalBytes / estimatedQuota;

      const result = {
        type: 'localStorage',
        usedBytes: usage.totalBytes,
        estimatedQuotaBytes: estimatedQuota,
        usedPercent,
        isWarning: usedPercent >= warnThreshold && usedPercent < criticalThreshold,
        isCritical: usedPercent >= criticalThreshold,
      };

      // Show proactive warnings
      if (result.isWarning && !this._quotaWarningShown) {
        this._quotaWarningShown = true;
        window.showToast?.(`Storage lokal ${Math.round(usedPercent * 100)}% terpakai. Pertimbangkan untuk menghapus data lama.`, 'warning');
      } else if (result.isCritical && !this._quotaCriticalShown) {
        this._quotaCriticalShown = true;
        window.showToast?.(`Storage lokal hampir penuh (${Math.round(usedPercent * 100)}%)! Hapus data tidak terpakai segera.`, 'error');
      }

      return result;
    } catch (e) {
      return { type: 'localStorage', error: e.message };
    }
  }

  /**
   * Check IndexedDB usage
   * @private
   */
  async _checkIndexedDBUsage(warnThreshold, criticalThreshold) {
    try {
      if (!this._db) {
        return { type: 'indexedDB', error: 'DB not initialized' };
      }

      // Estimate IndexedDB usage based on record counts
      const counts = await this.getIndexedDBUsage();
      if (!counts) {
        return { type: 'indexedDB', error: 'Could not get counts' };
      }

      // Rough estimate: 1KB per record average
      const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
      const estimatedBytes = totalRecords * 1024;
      const estimatedQuota = 50 * 1024 * 1024; // ~50MB typical IndexedDB

      const usedPercent = estimatedBytes / estimatedQuota;

      return {
        type: 'indexedDB',
        usedBytes: estimatedBytes,
        estimatedQuotaBytes: estimatedQuota,
        usedPercent,
        recordCounts: counts,
        isWarning: usedPercent >= warnThreshold && usedPercent < criticalThreshold,
        isCritical: usedPercent >= criticalThreshold,
      };
    } catch (e) {
      return { type: 'indexedDB', error: e.message };
    }
  }

  /**
   * ENHANCEMENT: Start periodic quota monitoring
   * @param {number} intervalMs - Check interval in ms (default: 5 minutes)
   */
  startQuotaMonitoring(intervalMs = 300000) { // 5 minutes
    this.stopQuotaMonitoring();
    this._quotaInterval = setInterval(() => {
      this.checkQuota().catch(e => Logger.error('[StorageManagerV2] Quota check failed:', e));
    }, intervalMs);
    Logger.info('[StorageManagerV2] Quota monitoring started');
  }

  /**
   * Stop quota monitoring
   */
  stopQuotaMonitoring() {
    if (this._quotaInterval) {
      clearInterval(this._quotaInterval);
      this._quotaInterval = null;
    }
  }

  async clearAll() {
    // Clear localStorage
    for (const key of Object.values(this.keys)) {
      localStorage.removeItem(key);
    }

    // Clear IndexedDB
    if (this._db) {
      try {
        await Promise.all([
          this._db.clear('attendances'),
          this._db.clear('permits'),
          this._db.clear('tahfizh'),
          this._db.clear('activity_logs'),
          this._db.clear('settings'),
        ]);
      } catch (e) {
        console.error('[StorageManagerV2] Failed to clear IndexedDB:', e);
      }
    }

    // Reset appState immutably
    if (typeof appState !== 'undefined') {
      appState.attendanceData = {};
      appState.permits = [];
      appState.activityLog = [];
      appState.settings = {
        darkMode: false,
        notifications: true,
        autoSave: true,
      };
    }

    // Reset delta sync
    this._lastSyncTime = null;
    this._syncVersion = 0;
    localStorage.removeItem('sync_last_time');
    this._lastSavedData = null;
    this._lastSavedVersion = 0;

    Logger.debug('[StorageManagerV2] All data cleared');
  }

  destroy() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }

    // ENHANCEMENT: Stop quota monitoring
    this.stopQuotaMonitoring();

    if (this._stateManager) {
      this._stateManager = null;
    }

  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const storageManagerV2 = new StorageManagerV2();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManagerV2;
}

window.StorageManagerV2 = StorageManagerV2;
window.storageManagerV2 = storageManagerV2;
window.storageManager = storageManagerV2; // Override legacy manager with V2

// Also create global alias for easy access
window.newStorageManager = storageManagerV2;
