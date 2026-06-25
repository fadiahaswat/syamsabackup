/**
 * StorageManagerV2 - Backward Compatible Storage Wrapper
 *
 * Wraps the new IndexedDB-based storage system while maintaining
 * the same API as the old StorageManager for zero-breaking changes
 *
 * FEATURES:
 * - Seamless migration from localStorage to IndexedDB
 * - Maintains existing appState references
 * - Auto-persistence with debouncing
 * - Version tracking
 * - Event callbacks
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

    // Database references
    this._db = null;
    this._repos = null;
    this._stateManager = null;
    this._initialized = false;

    // Event callbacks
    this.onOnlineStatusChange = null;
    this.onDataUpdate = null;

    // Legacy mode flag (true = use new IndexedDB, false = use localStorage)
    this._useIndexedDB = false;

    // Setup connection listeners
    this._setupConnectionListeners();
  }

  /**
   * Initialize StorageManager
   */
  async init(musyrifId) {
    console.log('[StorageManagerV2] Initializing with musyrifId:', musyrifId);
    this.musyrifId = musyrifId;

    try {
      // Initialize the database system
      const result = await initDatabase();

      this._db = result.localDB;
      this._repos = result.repos;
      this._stateManager = result.stateManager;
      this._useIndexedDB = true;

      // Load data into appState
      await this._loadFromDatabase();

      // Setup state subscriptions
      this._setupStateSubscriptions();

      this._initialized = true;
      console.log('[StorageManagerV2] Initialized with IndexedDB');

    } catch (error) {
      console.error('[StorageManagerV2] IndexedDB init failed, falling back to localStorage:', error);
      this._useIndexedDB = false;

      // Fall back to legacy localStorage
      this._loadFromStorage();
      this._initialized = true;
    }

    console.log('[StorageManagerV2] Initialization complete', {
      useIndexedDB: this._useIndexedDB,
      isOnline: this.isOnline,
      musyrifId: this.musyrifId
    });
  }

  /**
   * Setup online/offline listeners
   */
  _setupConnectionListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[StorageManagerV2] Connection restored');
      if (this.onOnlineStatusChange) {
        this.onOnlineStatusChange(true);
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[StorageManagerV2] Connection lost - offline mode');
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
    });
  }

  /**
   * Load data from IndexedDB into appState
   */
  async _loadFromDatabase() {
    if (!this._repos || !this._db) return;

    console.log('[StorageManagerV2] Loading data from IndexedDB...');

    try {
      // Load attendance data
      const kelas = this.musyrifId?.replace('class_', '') || 'Unknown';
      const today = new Date().toISOString().split('T')[0];
      const attendanceRecords = await this._repos.attendance.getByKelas(kelas);

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
        console.log('[StorageManagerV2] Attendance loaded:', Object.keys(attendanceData).length, 'dates');
      }

      // Load permits
      const permits = await this._repos.permit.getByKelas(kelas);
      if (typeof appState !== 'undefined') {
        appState.permits = permits || [];
        console.log('[StorageManagerV2] Permits loaded:', permits?.length || 0);
      }

      // Load settings
      const settings = await this._repos.settings.getUserSettings();
      if (typeof appState !== 'undefined') {
        appState.settings = { ...appState.settings, ...settings };
        console.log('[StorageManagerV2] Settings loaded');
      }

      // Load activity log
      const activityLog = await this._repos.activityLog.getRecent(50);
      if (typeof appState !== 'undefined') {
        appState.activityLog = activityLog || [];
      }

    } catch (error) {
      console.error('[StorageManagerV2] Failed to load from IndexedDB:', error);
    }
  }

  /**
   * Load data from localStorage (fallback)
   */
  _loadFromStorage() {
    console.log('[StorageManagerV2] Loading data from localStorage...');

    // Load attendance
    const attendanceData = this._get(this.keys.attendance);
    if (attendanceData && typeof appState !== 'undefined') {
      appState.attendanceData = attendanceData;
      console.log('[StorageManagerV2] Attendance loaded, dates:', Object.keys(attendanceData || {}));
    }

    // Load permits
    const permits = this._get(this.keys.permits);
    if (permits && typeof appState !== 'undefined') {
      appState.permits = permits;
      console.log('[StorageManagerV2] Permits loaded:', permits.length);
    }

    // Load settings
    const settings = this._get(this.keys.settings);
    if (settings && typeof appState !== 'undefined') {
      appState.settings = { ...appState.settings, ...settings };
      console.log('[StorageManagerV2] Settings loaded');
    }

    // Load activity log
    const activityLog = this._get(this.keys.activityLog);
    if (activityLog && typeof appState !== 'undefined') {
      appState.activityLog = activityLog;
    }
  }

  // ==========================================
  // LOCAL STORAGE HELPERS (fallback)
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

    // Auto-save
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
   */
  savePermits(permits) {
    if (typeof appState !== 'undefined') {
      appState.permits = permits;
    }

    if (this._useIndexedDB && this._repos) {
      // Save to IndexedDB
      permits.forEach(async (permit) => {
        await this._repos.permit.db.put('permits', permit);
      });
    }

    // Always save to localStorage for backup
    this._set(this.keys.permits, permits);

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }

    return permits;
  }

  /**
   * Save single permit
   */
  savePermit(permit) {
    if (typeof appState === 'undefined') {
      appState.permits = [];
    }

    const permits = appState.permits || [];
    const index = permits.findIndex(p => p && String(p.id) === String(permit.id));

    if (index !== -1) {
      permits[index] = permit;
    } else {
      permits.push(permit);
    }

    appState.permits = permits;

    if (this._useIndexedDB && this._repos) {
      this._repos.permit.db.put('permits', permit);
    }

    this._set(this.keys.permits, permits);

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }

    return permit;
  }

  /**
   * Delete permit
   */
  deletePermit(permitId) {
    if (typeof appState !== 'undefined' && Array.isArray(appState.permits)) {
      appState.permits = appState.permits.filter(p => p && String(p.id) !== String(permitId));
      this._set(this.keys.permits, appState.permits);
    }

    if (this._useIndexedDB && this._repos) {
      this._repos.permit.db.delete('permits', permitId);
    }

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }
  }

  // ==========================================
  // SETTINGS OPERATIONS
  // ==========================================

  saveSettings(settings) {
    if (typeof appState !== 'undefined') {
      appState.settings = { ...appState.settings, ...settings };
    }

    if (this._useIndexedDB && this._stateManager) {
      this._stateManager.updateSettings(settings);
    }

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

    if (this._useIndexedDB && this._repos) {
      logs.forEach(async (log) => {
        await this._repos.activityLog.db.put('activity_logs', log);
      });
    }

    this._set(this.keys.activityLog, logs);

    if (this.onDataUpdate) {
      this.onDataUpdate('activityLog');
    }
  }

  // ==========================================
  // PERSISTENCE MANAGEMENT
  // ==========================================

  _scheduleAutoSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }

    this._saveTimer = setTimeout(() => {
      this._performAutoSave();
    }, this.autoSave.debounceMs);
  }

  _performAutoSave() {
    this._saveTimer = null;

    if (typeof appState === 'undefined') return;

    // Check for changes
    const currentData = JSON.stringify(appState.attendanceData);
    const currentVersion = appState._version || 0;

    if (currentData === this._lastSavedData &&
        currentVersion === this._lastSavedVersion) {
      return; // No changes
    }

    this._lastSavedData = currentData;
    this._lastSavedVersion = currentVersion;

    if (this._useIndexedDB && this._stateManager) {
      // Use new state manager for IndexedDB
      this._stateManager.forcePersist();
    } else {
      // Fall back to localStorage
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

    console.log('[StorageManagerV2] Auto-saved (v' + currentVersion + ')');
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
  // UTILITY METHODS
  // ==========================================

  getStatus() {
    return {
      isOnline: this.isOnline,
      musyrifId: this.musyrifId,
      storageKeys: this.keys,
      useIndexedDB: this._useIndexedDB,
      initialized: this._initialized,
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

  clearAll() {
    // Clear localStorage
    for (const key of Object.values(this.keys)) {
      localStorage.removeItem(key);
    }

    // Clear IndexedDB
    if (this._db) {
      this._db.clear('attendances');
      this._db.clear('permits');
      this._db.clear('tahfizh');
      this._db.clear('activity_logs');
      this._db.clear('settings');
    }

    // Reset appState
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

    this._lastSavedData = null;
    this._lastSavedVersion = 0;

    console.log('[StorageManagerV2] All data cleared');
  }

  destroy() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }

    if (this._stateManager) {
      this._stateManager = null;
    }

    console.log('[StorageManagerV2] Destroyed');
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

// Also create global alias for easy access
window.newStorageManager = storageManagerV2;

console.log('[StorageManagerV2] Module loaded');
