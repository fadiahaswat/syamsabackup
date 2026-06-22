/**
 * FirebaseStorageManager - Primary storage manager using Firebase Realtime Database
 *
 * Handles all data storage operations with automatic online/offline detection.
 * Uses localStorage as fallback when offline.
 *
 * Architecture:
 * - Online: Direct Firebase read/write with real-time listeners
 * - Offline: localStorage fallback + queue operations for later sync
 */
class FirebaseStorageManager {
  constructor() {
    // State
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.musyrifId = null;
    this.db = null;
    this.ref = null;
    this.set = null;
    this.get = null;
    this.push = null;
    this.remove = null;
    this.onValue = null;

    // Real-time listeners for sync
    this.listeners = new Map();

    // Sync status
    this.lastSyncTime = null;
    this.lastError = null;

    // Event callbacks
    this.onOnlineStatusChange = null;
    this.onSyncStart = null;
    this.onSyncComplete = null;
    this.onSyncError = null;
    this.onDataUpdate = null;
  }

  /**
   * Initialize the storage manager
   * @param {string} musyrifId - Unique identifier for the musyrif
   */
  async init(musyrifId) {
    // Sanitize musyrifId for Firebase path (no spaces, special chars)
    const sanitizedId = musyrifId
      ? String(musyrifId).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
      : this.getMusyrifId();

    console.log('[FirebaseStorageManager] Initializing with musyrifId:', sanitizedId);
    this.musyrifId = sanitizedId || this.getMusyrifId();

    // Setup online/offline listeners
    this.setupConnectionListeners();

    // Initialize Firebase
    await this.initFirebase();

    // Load data from Firebase or localStorage
    await this.loadInitialData();

    // Setup real-time listeners
    this.setupRealtimeListeners();

    console.log('[FirebaseStorageManager] Initialization complete', {
      isOnline: this.isOnline,
      musyrifId: this.musyrifId
    });
  }

  /**
   * Get musyrif ID from appState or generate from user info
   */
  getMusyrifId() {
    if (typeof appState !== 'undefined' && appState.userProfile?.id) {
      return appState.userProfile.id;
    }
    if (typeof appState !== 'undefined' && appState.selectedClass) {
      return `class_${appState.selectedClass}`;
    }
    return 'anonymous';
  }

  /**
   * Initialize Firebase database connection
   */
  async initFirebase() {
    try {
      // Use window globals set by firebase-config.js
      if (window.FIREBASE_DB) {
        this.db = window.FIREBASE_DB;

        // Compat SDK uses db.ref(path) instead of ref(db, path)
        this.ref = (path) => window.FIREBASE_DB.ref(path);
        this.set = (ref, data) => ref.set(data);
        this.get = async (ref) => {
          const snapshot = await ref.once('value');
          return snapshot;
        };
        this.push = (ref) => ref.push();
        this.remove = (ref) => ref.remove();
        this.onValue = (ref, callback) => ref.on('value', callback);

        console.log('[FirebaseStorageManager] Firebase initialized from window globals (Compat SDK)');
      } else {
        throw new Error('Firebase not available. Make sure firebase-config.js is loaded.');
      }
    } catch (error) {
      console.error('[FirebaseStorageManager] Firebase init error:', error);
      this.lastError = error;
      // Will fallback to localStorage
    }
  }

  /**
   * Setup online/offline connection listeners
   */
  setupConnectionListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  /**
   * Handle coming online
   */
  async handleOnline() {
    console.log('[FirebaseStorageManager] Connection restored');
    this.isOnline = true;

    if (this.onOnlineStatusChange) {
      this.onOnlineStatusChange(true);
    }

    // Re-initialize Firebase if needed
    if (!this.db) {
      await this.initFirebase();
    }

    // Sync pending operations
    await this.syncPendingOperations();

    // Refresh data from Firebase
    await this.refreshData();

    window.showToast?.('Koneksi terhubung. Sinkronisasi selesai.', 'success');
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    console.log('[FirebaseStorageManager] Connection lost - entering offline mode');
    this.isOnline = false;

    if (this.onOnlineStatusChange) {
      this.onOnlineStatusChange(false);
    }

    window.showToast?.('Koneksi terputus. Mode offline aktif.', 'warning');
  }

  /**
   * Load initial data from Firebase (online) or localStorage (offline)
   */
  async loadInitialData() {
    if (this.isOnline && this.db) {
      try {
        await this.loadFromFirebase();
        return;
      } catch (error) {
        console.warn('[FirebaseStorageManager] Firebase load failed, falling back to localStorage:', error);
        this.lastError = error;
      }
    }

    // Fallback to localStorage
    await this.loadFromLocalStorage();
  }

  /**
   * Load data from Firebase
   */
  async loadFromFirebase() {
    if (!this.db || !this.musyrifId) {
      throw new Error('Firebase not initialized or no musyrifId');
    }

    console.log('[FirebaseStorageManager] Loading from Firebase...');

    const basePath = `/${this.musyrifId}`;

    // Load attendance data
    const attendanceRef = this.ref( `attendance${basePath}`);
    const attendanceSnapshot = await this.get(attendanceRef);

    if (attendanceSnapshot.exists()) {
      const remoteData = attendanceSnapshot.val();
      const localData = this.getLocalStorageData(APP_CONFIG.storageKey);

      // Merge data: prefer remote (Firebase) as source of truth
      if (localData && typeof localData === 'object') {
        // Merge with conflict resolution (last-write-wins based on timestamp)
        const mergedData = this.mergeData(localData, remoteData);
        this.setLocalStorageData(APP_CONFIG.storageKey, mergedData);
        if (typeof appState !== 'undefined') {
          appState.attendanceData = mergedData;
        }
      } else {
        if (typeof appState !== 'undefined') {
          appState.attendanceData = remoteData;
        }
        this.setLocalStorageData(APP_CONFIG.storageKey, remoteData);
      }

      console.log('[FirebaseStorageManager] Attendance data loaded from Firebase');
    }

    // Load permits
    const permitsRef = this.ref( 'permits');
    const permitsSnapshot = await this.get(permitsRef);

    if (permitsSnapshot.exists()) {
      const permitsData = permitsSnapshot.val();
      const permitsArray = Object.values(permitsData).filter(p => p);
      this.setLocalStorageData(APP_CONFIG.permitKey, permitsArray);
      if (typeof appState !== 'undefined') {
        appState.permits = permitsArray;
      }
      console.log('[FirebaseStorageManager] Permits data loaded from Firebase');
    }

    // Load settings
    const settingsRef = this.ref( `settings${basePath}`);
    const settingsSnapshot = await this.get(settingsRef);

    if (settingsSnapshot.exists()) {
      const remoteSettings = settingsSnapshot.val();
      this.setLocalStorageData(APP_CONFIG.settingsKey, remoteSettings);
      if (typeof appState !== 'undefined') {
        appState.settings = { ...appState.settings, ...remoteSettings };
      }
      console.log('[FirebaseStorageManager] Settings loaded from Firebase');
    }

    this.lastSyncTime = Date.now();
  }

  /**
   * Load data from localStorage (offline fallback)
   */
  async loadFromLocalStorage() {
    console.log('[FirebaseStorageManager] Loading from localStorage (offline mode)...');

    const savedData = this.getLocalStorageData(APP_CONFIG.storageKey);
    if (savedData && typeof appState !== 'undefined') {
      appState.attendanceData = savedData;
    }

    const savedPermits = this.getLocalStorageData(APP_CONFIG.permitKey);
    if (savedPermits && typeof appState !== 'undefined') {
      appState.permits = savedPermits;
    }

    const savedSettings = this.getLocalStorageData(APP_CONFIG.settingsKey);
    if (savedSettings && typeof appState !== 'undefined') {
      appState.settings = { ...appState.settings, ...savedSettings };
    }

    const savedLog = this.getLocalStorageData(APP_CONFIG.activityLogKey);
    if (savedLog && typeof appState !== 'undefined') {
      appState.activityLog = savedLog;
    }

    console.log('[FirebaseStorageManager] Data loaded from localStorage');
  }

  /**
   * Setup real-time listeners for data sync
   */
  setupRealtimeListeners() {
    if (!this.db || !this.musyrifId) return;

    const basePath = `/${this.musyrifId}`;

    // Listen to attendance changes
    this.listenTo(`attendance${basePath}`, (data) => {
      if (data && typeof appState !== 'undefined') {
        appState.attendanceData = data;
        this.setLocalStorageData(APP_CONFIG.storageKey, data);
        if (this.onDataUpdate) this.onDataUpdate('attendance', data);
      }
    });

    // Listen to permits changes
    this.listenTo(`permits`, (data) => {
      if (typeof appState !== 'undefined') {
        const permitsArray = data ? Object.values(data).filter(p => p) : [];
        appState.permits = permitsArray;
        this.setLocalStorageData(APP_CONFIG.permitKey, permitsArray);
        if (window.refreshPermitSurfaces) window.refreshPermitSurfaces();
      }
    });

    // Listen to settings changes
    this.listenTo(`settings${basePath}`, (data) => {
      if (data && typeof appState !== 'undefined') {
        appState.settings = { ...appState.settings, ...data };
        this.setLocalStorageData(APP_CONFIG.settingsKey, data);
        if (this.onDataUpdate) this.onDataUpdate('settings', data);
      }
    });
  }

  /**
   * Listen to a Firebase path for real-time updates
   */
  listenTo(path, callback) {
    if (!this.db || !this.ref || !this.onValue) return;

    const dbRef = this.ref( path);
    const listener = (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null);
    };

    this.onValue(dbRef, listener);
    this.listeners.set(path, { ref: dbRef, callback });

    console.log(`[FirebaseStorageManager] Listening to: ${path}`);
  }

  /**
   * Stop listening to a path
   */
  unlisten(path) {
    if (this.listeners.has(path)) {
      const { ref } = this.listeners.get(path);
      if (this.onValue) {
        // Firebase v9+ doesn't have direct off(), we need to track callbacks
        // For now, just remove from map
      }
      this.listeners.delete(path);
      console.log(`[FirebaseStorageManager] Unlistening from: ${path}`);
    }
  }

  /**
   * Save attendance data
   */
  async saveAttendance(dateKey, slotId, data) {
    const path = `attendance/${this.musyrifId}/${dateKey}/${slotId}`;
    return this.save(path, data, 'attendance');
  }

  /**
   * Save permits data
   */
  async savePermits(permits) {
    // Save each permit as individual record
    const promises = permits.map(permit => {
      const path = `permits/${permit.id}`;
      return this.save(path, permit, 'permit');
    });
    return Promise.all(promises);
  }

  /**
   * Save a single permit
   */
  async savePermit(permit) {
    const path = `permits/${permit.id}`;
    return this.save(path, permit, 'permit');
  }

  /**
   * Delete a permit
   */
  async deletePermit(permitId) {
    const path = `permits/${permitId}`;
    return this.delete(path, 'permit');
  }

  /**
   * Save settings
   */
  async saveSettings(settings) {
    const path = `settings/${this.musyrifId}`;
    return this.save(path, settings, 'settings');
  }

  /**
   * Save activity log
   */
  async saveActivityLog(logs) {
    const path = `activity_log/${this.musyrifId}`;
    return this.save(path, logs, 'activity_log');
  }

  /**
   * Core save function - dispatches to Firebase or queues for offline
   */
  async save(path, data, type = 'unknown') {
    // Always save to localStorage first as backup
    this.saveToLocalStorage(path, data);

    if (this.isOnline && this.db) {
      try {
        const dbPath = path.replace(/\//g, '_').replace(/^_/, '');
        const dbRef = this.ref( path);

        await this.set(dbRef, {
          ...data,
          _lastUpdated: Date.now(),
          _musyrifId: this.musyrifId
        });

        console.log(`[FirebaseStorageManager] Saved to Firebase: ${path}`);
        return { success: true, source: 'firebase' };
      } catch (error) {
        console.error(`[FirebaseStorageManager] Firebase save error for ${path}:`, error);
        this.lastError = error;

        // Queue for later sync
        OfflineQueueManager.enqueue(type, 'set', path, data);
        return { success: false, source: 'queue', error: error.message };
      }
    } else {
      // Queue for later sync
      OfflineQueueManager.enqueue(type, 'set', path, data);
      return { success: true, source: 'local' };
    }
  }

  /**
   * Delete data from Firebase
   */
  async delete(path, type = 'unknown') {
    this.deleteFromLocalStorage(path);

    if (this.isOnline && this.db) {
      try {
        const dbRef = this.ref( path);
        await this.remove(dbRef);
        console.log(`[FirebaseStorageManager] Deleted from Firebase: ${path}`);
        return { success: true, source: 'firebase' };
      } catch (error) {
        console.error(`[FirebaseStorageManager] Firebase delete error for ${path}:`, error);
        this.lastError = error;
        OfflineQueueManager.enqueue(type, 'delete', path, null);
        return { success: false, source: 'queue', error: error.message };
      }
    } else {
      OfflineQueueManager.enqueue(type, 'delete', path, null);
      return { success: true, source: 'local' };
    }
  }

  /**
   * Save to localStorage with proper error handling
   */
  saveToLocalStorage(path, data) {
    try {
      const segments = path.split('/');
      const firstSegment = segments[0];

      if (firstSegment === 'attendance' && segments.length === 4) {
        const dateKey = segments[2];
        const slotId = segments[3];
        const localData = this.getLocalStorageData(APP_CONFIG.storageKey) || {};
        if (!localData[dateKey]) localData[dateKey] = {};
        localData[dateKey][slotId] = data;
        this.setLocalStorageData(APP_CONFIG.storageKey, localData);
      } else if (firstSegment === 'permits' && segments.length === 2) {
        const permitId = segments[1];
        let localData = this.getLocalStorageData(APP_CONFIG.permitKey) || [];
        if (!Array.isArray(localData)) localData = [];
        const index = localData.findIndex(p => p && String(p.id) === String(permitId));
        if (index !== -1) {
          localData[index] = data;
        } else {
          localData.push(data);
        }
        this.setLocalStorageData(APP_CONFIG.permitKey, localData);
      } else {
        const key = this.pathToLocalKey(path);
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (error) {
      console.error('[FirebaseStorageManager] localStorage save error:', error);
      if (error.name === 'QuotaExceededError') {
        window.showToast?.('Storage hampir penuh!', 'error');
      }
    }
  }

  /**
   * Get data from localStorage
   */
  getLocalStorageData(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[FirebaseStorageManager] localStorage read error:', error);
      return null;
    }
  }

  /**
   * Set data in localStorage
   */
  setLocalStorageData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('[FirebaseStorageManager] localStorage write error:', error);
    }
  }

  /**
   * Delete from localStorage
   */
  deleteFromLocalStorage(path) {
    const segments = path.split('/');
    const firstSegment = segments[0];

    if (firstSegment === 'permits' && segments.length === 2) {
      const permitId = segments[1];
      let localData = this.getLocalStorageData(APP_CONFIG.permitKey) || [];
      if (Array.isArray(localData)) {
        localData = localData.filter(p => p && String(p.id) !== String(permitId));
        this.setLocalStorageData(APP_CONFIG.permitKey, localData);
      }
    } else if (firstSegment === 'attendance' && segments.length === 4) {
      const dateKey = segments[2];
      const slotId = segments[3];
      const localData = this.getLocalStorageData(APP_CONFIG.storageKey);
      if (localData && localData[dateKey]) {
        delete localData[dateKey][slotId];
        if (Object.keys(localData[dateKey]).length === 0) {
          delete localData[dateKey];
        }
        this.setLocalStorageData(APP_CONFIG.storageKey, localData);
      }
    } else {
      const key = this.pathToLocalKey(path);
      localStorage.removeItem(key);
    }
  }

  /**
   * Convert Firebase path to localStorage key
   */
  pathToLocalKey(path) {
    const pathMap = {
      'attendance': APP_CONFIG.storageKey,
      'permits': APP_CONFIG.permitKey,
      'settings': APP_CONFIG.settingsKey,
      'activity_log': APP_CONFIG.activityLogKey
    };

    // Extract the first segment
    const firstSegment = path.split('/')[0];
    return pathMap[firstSegment] || `firebase_${path.replace(/\//g, '_')}`;
  }

  /**
   * Sync all pending offline operations
   */
  async syncPendingOperations() {
    if (this.syncInProgress) {
      console.log('[FirebaseStorageManager] Sync already in progress');
      return { status: 'already_syncing' };
    }

    if (!this.isOnline || !this.db) {
      console.log('[FirebaseStorageManager] Cannot sync - offline or Firebase not available');
      return { status: 'offline' };
    }

    const stats = OfflineQueueManager.getStats();
    if (stats.pending === 0) {
      console.log('[FirebaseStorageManager] No pending operations to sync');
      return { status: 'nothing_to_sync', stats };
    }

    this.syncInProgress = true;

    if (this.onSyncStart) {
      this.onSyncStart(stats);
    }

    console.log(`[FirebaseStorageManager] Starting sync of ${stats.pending} operations...`);

    try {
      const results = await OfflineQueueManager.processQueue(async (operation) => {
        await this.executeOperation(operation);
      }, {
        onProgress: (progress) => {
          console.log(`[FirebaseStorageManager] Syncing: ${progress.current}/${progress.total}`);
        },
        onError: (errorInfo) => {
          console.error('[FirebaseStorageManager] Sync operation failed:', errorInfo);
          if (this.onSyncError) this.onSyncError(errorInfo);
        }
      });

      this.syncInProgress = false;
      this.lastSyncTime = Date.now();

      if (this.onSyncComplete) {
        this.onSyncComplete(results);
      }

      console.log('[FirebaseStorageManager] Sync complete:', results);
      return { status: 'success', results };

    } catch (error) {
      this.syncInProgress = false;
      this.lastError = error;
      console.error('[FirebaseStorageManager] Sync failed:', error);

      if (this.onSyncError) {
        this.onSyncError({ error });
      }

      return { status: 'error', error: error.message };
    }
  }

  /**
   * Execute a single queued operation
   */
  async executeOperation(operation) {
    const { type, operation: op, path, data } = operation;

    const dbRef = this.ref( path);

    if (op === 'set' || op === 'update') {
      await this.set(dbRef, {
        ...data,
        _lastUpdated: Date.now(),
        _musyrifId: this.musyrifId,
        _syncedFromQueue: true
      });
    } else if (op === 'delete') {
      await this.remove(dbRef);
    }

    console.log(`[FirebaseStorageManager] Executed queued operation: ${type} ${op} at ${path}`);
  }

  /**
   * Refresh data from Firebase
   */
  async refreshData() {
    if (!this.isOnline || !this.db) {
      return { status: 'offline' };
    }

    try {
      await this.loadFromFirebase();
      return { status: 'success' };
    } catch (error) {
      console.error('[FirebaseStorageManager] Refresh failed:', error);
      return { status: 'error', error: error.message };
    }
  }

  /**
   * Merge local and remote data (conflict resolution)
   */
  mergeData(local, remote) {
    // Simple last-write-wins based on _lastUpdated timestamp
    const result = { ...local };

    for (const key in remote) {
      if (typeof remote[key] === 'object' && remote[key] !== null && !Array.isArray(remote[key])) {
        // Recursive merge for objects
        if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = this.mergeData(result[key], remote[key]);
        } else {
          result[key] = remote[key];
        }
      } else {
        // Check timestamps for conflict resolution
        const remoteTimestamp = remote[key]?._lastUpdated || 0;
        const localTimestamp = local[key]?._lastUpdated || 0;

        if (remoteTimestamp > localTimestamp) {
          result[key] = remote[key];
        }
      }
    }

    return result;
  }

  /**
   * Get sync status
   */
  getStatus() {
    const queueStats = OfflineQueueManager.getStats();

    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
      queueStats,
      musyrifId: this.musyrifId
    };
  }

  /**
   * Clear all data (use with caution)
   */
  async clearAll() {
    // Clear localStorage
    localStorage.removeItem(APP_CONFIG.storageKey);
    localStorage.removeItem(APP_CONFIG.permitKey);
    localStorage.removeItem(APP_CONFIG.activityLogKey);
    localStorage.removeItem(APP_CONFIG.settingsKey);

    // Clear queue
    OfflineQueueManager.clear();

    // Clear Firebase data for this musyrif
    if (this.isOnline && this.db) {
      try {
        const basePath = `/${this.musyrifId}`;
        await this.remove(this.ref( `attendance${basePath}`));
        await this.remove(this.ref( `settings${basePath}`));
        console.log('[FirebaseStorageManager] Firebase data cleared');
      } catch (error) {
        console.error('[FirebaseStorageManager] Failed to clear Firebase data:', error);
      }
    }

    // Reset appState
    if (typeof appState !== 'undefined') {
      appState.attendanceData = {};
      appState.permits = [];
      appState.activityLog = [];
      appState.settings = {
        darkMode: false,
        notifications: true,
        autoSave: true
      };
    }

    console.log('[FirebaseStorageManager] All data cleared');
  }

  /**
   * Cleanup - remove listeners and cleanup
   */
  destroy() {
    // Remove connection listeners
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    // Clear listeners map
    this.listeners.clear();

    // Reset state
    this.db = null;
    this.ref = null;
    this.set = null;
    this.get = null;
    this.push = null;
    this.remove = null;
    this.onValue = null;

    console.log('[FirebaseStorageManager] Destroyed');
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseStorageManager;
}

// Make available globally
window.FirebaseStorageManager = FirebaseStorageManager;

console.log('[FirebaseStorageManager] Module loaded');