/**
 * StorageManager - LocalStorage-based Storage Manager
 *
 * Semua data disimpan di localStorage.
 * Data otomatis tersimpan saat berubah (debounced auto-save).
 *
 * Architecture:
 * - Data disimpan di localStorage dengan key yang terstruktur
 * - Auto-save dengan debounce untuk mencegah excessive writes
 * - Online/offline detection untuk UI indicators
 */
class StorageManager {
  constructor() {
    // Storage keys from config
    this.keys = {
      attendance: APP_STORAGE?.keys?.attendance || 'musyrif_app_v5_fix',
      permits: APP_STORAGE?.keys?.permits || 'musyrif_permits_db',
      settings: APP_STORAGE?.keys?.settings || 'musyrif_settings',
      activityLog: APP_STORAGE?.keys?.activityLog || 'musyrif_activity_log',
      googleAuth: APP_STORAGE?.keys?.googleAuth || 'musyrif_google_session',
    };

    // Auto-save config
    this.autoSave = {
      debounceMs: APP_STORAGE?.autoSave?.debounceMs || 500,
      enabled: APP_STORAGE?.autoSave?.enabled !== false,
    };

    // State
    this.isOnline = navigator.onLine;
    this.musyrifId = null;
    this._saveTimer = null;
    this._lastSavedData = null;

    // Event callbacks
    this.onOnlineStatusChange = null;
    this.onDataUpdate = null;

    // Setup online/offline listeners
    this._setupConnectionListeners();
  }

  /**
   * Setup online/offline connection listeners
   */
  _setupConnectionListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[StorageManager] Connection restored');
      if (this.onOnlineStatusChange) {
        this.onOnlineStatusChange(true);
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[StorageManager] Connection lost - offline mode');
      if (this.onOnlineStatusChange) {
        this.onOnlineStatusChange(false);
      }
    });
  }

  /**
   * Initialize the storage manager
   * @param {string} musyrifId - Unique identifier for the musyrif/class
   */
  init(musyrifId) {
    console.log('[StorageManager] Initializing with musyrifId:', musyrifId);
    this.musyrifId = musyrifId;

    // Load data from localStorage into appState
    this._loadFromStorage();

    console.log('[StorageManager] Initialization complete', {
      isOnline: this.isOnline,
      musyrifId: this.musyrifId
    });
  }

  /**
   * Get storage key for a data type
   */
  _getKey(type) {
    return this.keys[type] || type;
  }

  /**
   * Load all data from localStorage
   */
  _loadFromStorage() {
    console.log('[StorageManager] Loading data from localStorage...');

    // Load attendance data
    const attendanceData = this._get(this.keys.attendance);
    if (attendanceData && typeof appState !== 'undefined') {
      appState.attendanceData = attendanceData;
      console.log('[StorageManager] Attendance data loaded, dates:', Object.keys(attendanceData || {}));
    }

    // Load permits
    const permits = this._get(this.keys.permits);
    if (permits && typeof appState !== 'undefined') {
      appState.permits = permits;
      console.log('[StorageManager] Permits loaded:', permits.length);
    }

    // Load settings
    const settings = this._get(this.keys.settings);
    if (settings && typeof appState !== 'undefined') {
      appState.settings = { ...appState.settings, ...settings };
      console.log('[StorageManager] Settings loaded');
    }

    // Load activity log
    const activityLog = this._get(this.keys.activityLog);
    if (activityLog && typeof appState !== 'undefined') {
      appState.activityLog = activityLog;
    }
  }

  /**
   * Get data from localStorage
   */
  _get(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`[StorageManager] Error reading ${key}:`, error);
      return null;
    }
  }

  /**
   * Set data to localStorage
   */
  _set(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`[StorageManager] Error writing ${key}:`, error);
      if (error.name === 'QuotaExceededError') {
        window.showToast?.('Storage hampir penuh!', 'error');
      }
      return false;
    }
  }

  /**
   * Remove data from localStorage
   */
  _remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[StorageManager] Error removing ${key}:`, error);
      return false;
    }
  }

  /**
   * Save attendance data for a specific slot
   */
  saveAttendance(dateKey, slotId, data) {
    if (typeof appState === 'undefined' || !appState.attendanceData) {
      appState.attendanceData = {};
    }

    // Ensure nested structure
    if (!appState.attendanceData[dateKey]) {
      appState.attendanceData[dateKey] = {};
    }

    // Update the slot data with metadata
    appState.attendanceData[dateKey][slotId] = {
      ...data,
      _lastUpdated: Date.now(),
      _savedBy: this.musyrifId,
    };

    // Auto-save with debounce
    if (this.autoSave.enabled) {
      this._scheduleAutoSave();
    }

    // Callback
    if (this.onDataUpdate) {
      this.onDataUpdate('attendance', dateKey, slotId);
    }
  }

  /**
   * Save permits data
   */
  savePermits(permits) {
    if (typeof appState !== 'undefined') {
      appState.permits = permits;
    }
    this._set(this.keys.permits, permits);

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }
  }

  /**
   * Save a single permit
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
    this._set(this.keys.permits, permits);

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }
  }

  /**
   * Delete a permit
   */
  deletePermit(permitId) {
    if (typeof appState !== 'undefined' && Array.isArray(appState.permits)) {
      appState.permits = appState.permits.filter(p => p && String(p.id) !== String(permitId));
      this._set(this.keys.permits, appState.permits);
    }

    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }
  }

  /**
   * Save settings
   */
  saveSettings(settings) {
    if (typeof appState !== 'undefined') {
      appState.settings = { ...appState.settings, ...settings };
    }
    this._set(this.keys.settings, settings);

    if (this.onDataUpdate) {
      this.onDataUpdate('settings');
    }
  }

  /**
   * Save activity log
   */
  saveActivityLog(logs) {
    if (typeof appState !== 'undefined') {
      appState.activityLog = logs;
    }
    this._set(this.keys.activityLog, logs);

    if (this.onDataUpdate) {
      this.onDataUpdate('activityLog');
    }
  }

  /**
   * Schedule auto-save with debounce
   */
  _scheduleAutoSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
    }

    this._saveTimer = setTimeout(() => {
      this._performAutoSave();
    }, this.autoSave.debounceMs);
  }

  /**
   * Perform the actual auto-save
   */
  _performAutoSave() {
    this._saveTimer = null;

    if (typeof appState === 'undefined') return;

    // Only save if data changed
    const currentData = JSON.stringify(appState.attendanceData);
    if (currentData === this._lastSavedData) {
      return;
    }

    this._lastSavedData = currentData;

    // Save attendance data
    if (appState.attendanceData) {
      this._set(this.keys.attendance, appState.attendanceData);
    }

    // Save permits
    if (appState.permits) {
      this._set(this.keys.permits, appState.permits);
    }

    // Save settings
    if (appState.settings) {
      this._set(this.keys.settings, appState.settings);
    }

    // Save activity log
    if (appState.activityLog) {
      this._set(this.keys.activityLog, appState.activityLog);
    }

    console.log('[StorageManager] Data auto-saved');
  }

  /**
   * Force immediate save (no debounce)
   */
  saveNow() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    this._performAutoSave();
  }

  /**
   * Get sync status info
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      musyrifId: this.musyrifId,
      storageKeys: this.keys,
    };
  }

  /**
   * Check if storage is available
   */
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

  /**
   * Get storage usage info
   */
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

  /**
   * Clear all data (use with caution)
   */
  clearAll() {
    // Clear all storage keys
    for (const key of Object.values(this.keys)) {
      this._remove(key);
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
    console.log('[StorageManager] All data cleared');
  }

  /**
   * Cleanup - remove listeners and cleanup
   */
  destroy() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    console.log('[StorageManager] Destroyed');
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}

// Make available globally
window.StorageManager = StorageManager;

// Create global instance
window.storageManager = new StorageManager();

console.log('[StorageManager] Module loaded');
