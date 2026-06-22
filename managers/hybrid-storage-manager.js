/**
 * HybridStorageManager - Cloud-Enabled Storage with Offline-First Support
 *
 * Orchestrator yang menggabungkan:
 * - LocalStorage untuk akses cepat dan offline
 * - Supabase untuk cloud persistence dan sync
 * - SyncQueue untuk mengelola perubahan offline
 *
 * Strategy: Optimistic updates - UI langsung berubah, sync di background
 */

class HybridStorageManager {
  constructor() {
    // Storage mode: 'local-only', 'hybrid', 'cloud-primary'
    this.mode = APP_STORAGE?.mode || 'local-only';

    // Check if Supabase is configured
    this.supabaseConfigured = !!(APP_STORAGE?.supabase?.url && APP_STORAGE?.supabase?.anonKey);

    // Local storage adapter (existing StorageManager)
    this.local = window.storageManager;

    // Remote storage adapter (Supabase)
    this.remote = window.supabaseClient;

    // Sync queue
    this.queue = window.syncQueue;

    // State
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.isInitialized = false;
    this.syncInterval = null;
    this.kelasId = null;

    // Sync configuration
    this.config = {
      autoSync: APP_STORAGE?.sync?.autoSync !== false,
      syncInterval: APP_STORAGE?.sync?.syncInterval || 30000, // 30 seconds
      conflictResolution: APP_STORAGE?.sync?.conflictResolution || 'server-wins',
      retryAttempts: APP_STORAGE?.sync?.retryAttempts || 3,
      batchSize: 50,
    };

    // Event callbacks
    this.onSyncStart = null;
    this.onSyncComplete = null;
    this.onSyncError = null;
    this.onDataUpdate = null;
    this.onConnectionChange = null;
    this.onConflictDetected = null;

    // Pending sync count
    this.pendingCount = 0;

    // Setup listeners
    this._setupListeners();
  }

  /**
   * Initialize the hybrid storage
   */
  async init(kelasId) {
    if (this.isInitialized && this.kelasId === kelasId) {
      console.log('[HybridStorageManager] Already initialized');
      return;
    }

    console.log('[HybridStorageManager] Initializing...');
    this.kelasId = kelasId;

    // Initialize local storage
    if (this.local) {
      this.local.init(kelasId);
    }

    // Initialize Supabase if configured and in hybrid/cloud mode
    if (this.supabaseConfigured && this.mode !== 'local-only') {
      await this._initRemote();

      // DOWNLOAD data dari cloud saat init (jika online)
      if (this.isOnline && this.remote.isAuthenticated()) {
        console.log('[HybridStorageManager] Downloading cloud data...');
        await this._downloadCloudData();
      }
    }

    // Start auto-sync if enabled
    if (this.config.autoSync && this.mode !== 'local-only') {
      this._startAutoSync();
    }

    // Setup queue listeners
    if (this.queue) {
      this.queue.onQueueChange = (count) => {
        this.pendingCount = count;
        this._updateSyncStatusUI();
      };
    }

    this.isInitialized = true;
    console.log('[HybridStorageManager] Initialized', {
      mode: this.mode,
      supabaseConfigured: this.supabaseConfigured,
      isOnline: this.isOnline,
    });
  }

  /**
   * Download data dari cloud
   */
  async _downloadCloudData() {
    if (!this.kelasId) return;

    try {
      // Download attendance data
      const { data: attendanceData, error: attError } = await this.remote.loadAllAttendance(this.kelasId);
      if (attError) {
        console.warn('[HybridStorageManager] Download attendance error:', attError);
      } else if (attendanceData && attendanceData.length > 0) {
        console.log('[HybridStorageManager] Downloaded', attendanceData.length, 'attendance records from cloud');
        // Merge dengan local data
        await this._mergeAttendanceData(attendanceData);
      }

      // Download permits
      const { data: permitsData, error: permitError } = await this.remote.loadPermits(this.kelasId);
      if (permitError) {
        console.warn('[HybridStorageManager] Download permits error:', permitError);
      } else if (permitsData && permitsData.length > 0) {
        console.log('[HybridStorageManager] Downloaded', permitsData.length, 'permits from cloud');
        await this._mergePermitsData(permitsData);
      }

      // Trigger UI refresh
      if (this.onDataUpdate) {
        this.onDataUpdate('cloud_sync_complete');
      }

      console.log('[HybridStorageManager] Cloud data download complete');
    } catch (error) {
      console.error('[HybridStorageManager] Cloud download failed:', error);
    }
  }

  /**
   * Merge attendance data dari cloud ke local
   */
  async _mergeAttendanceData(cloudRecords) {
    if (!cloudRecords || cloudRecords.length === 0) return;

    // Transform cloud records ke format local
    const mergedData = {};

    for (const record of cloudRecords) {
      const dateKey = record.date_key;
      const slotId = record.slot_id;
      const studentId = record.student_id;

      if (!mergedData[dateKey]) {
        mergedData[dateKey] = {};
      }
      if (!mergedData[dateKey][slotId]) {
        mergedData[dateKey][slotId] = {};
      }

      mergedData[dateKey][slotId][studentId] = {
        status: record.status || {},
        timestamps: record.timestamps || {},
        auditTrail: record.audit_trail || [],
        note: record.note || '',
        permitManualOverride: record.permit_manual_override || false,
      };
    }

    // Merge dengan appState.attendanceData (cloud wins untuk data yang lebih baru)
    if (typeof appState !== 'undefined' && appState.attendanceData) {
      for (const [dateKey, slots] of Object.entries(mergedData)) {
        if (!appState.attendanceData[dateKey]) {
          appState.attendanceData[dateKey] = {};
        }
        for (const [slotId, students] of Object.entries(slots)) {
          if (!appState.attendanceData[dateKey][slotId]) {
            appState.attendanceData[dateKey][slotId] = {};
          }
          for (const [studentId, data] of Object.entries(students)) {
            // Check jika local data lebih lama dari cloud
            const localRecord = appState.attendanceData[dateKey][slotId][studentId];
            if (!localRecord) {
              // Tidak ada local, pakai cloud
              appState.attendanceData[dateKey][slotId][studentId] = data;
            }
            // Jika ada local dan cloud, tetap pakai local (last-write-wins dari user)
            // Karena sync queue sudah handle upload
          }
        }
      }

      // Simpan ke localStorage
      localStorage.setItem('musyrif_app_v5_fix', JSON.stringify(appState.attendanceData));
      console.log('[HybridStorageManager] Merged attendance data with local storage');
    }
  }

  /**
   * Merge permits data dari cloud ke local
   */
  async _mergePermitsData(cloudPermits) {
    if (!cloudPermits || cloudPermits.length === 0) return;

    if (typeof appState !== 'undefined' && appState.permits) {
      const localPermitIds = new Set(appState.permits.map(p => p.id));

      // Add permits yang tidak ada di local
      for (const permit of cloudPermits) {
        if (!localPermitIds.has(permit.id)) {
          appState.permits.push(permit);
        }
      }

      // Simpan ke localStorage
      localStorage.setItem('musyrif_permits_db', JSON.stringify(appState.permits));
      console.log('[HybridStorageManager] Merged permits data with local storage');
    }
  }

  /**
   * Initialize remote storage (Supabase)
   */
  async _initRemote() {
    try {
      await this.remote.init();

      // Setup connection listener
      this.remote.onConnectionChange = (isOnline) => {
        this.isOnline = isOnline;
        if (this.onConnectionChange) {
          this.onConnectionChange(isOnline);
        }
        if (isOnline) {
          this._processQueue();
        }
      };

      // Setup auth listener
      this.remote.onAuthStateChange = (event, session) => {
        console.log('[HybridStorageManager] Auth changed:', event);
        if (session) {
          this._processQueue();
        }
      };

      console.log('[HybridStorageManager] Remote initialized');
    } catch (error) {
      console.error('[HybridStorageManager] Remote init failed:', error);
    }
  }

  /**
   * Setup connection and sync listeners
   */
  _setupListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[HybridStorageManager] Online');
      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }
      // Trigger sync when coming online
      if (this.mode !== 'local-only') {
        this._processQueue();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[HybridStorageManager] Offline');
      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }
    });
  }

  /**
   * Start auto-sync interval
   */
  _startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this._processQueue();
      }
    }, this.config.syncInterval);

    console.log('[HybridStorageManager] Auto-sync started, interval:', this.config.syncInterval);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // ============================================================
  // ATTENDANCE OPERATIONS
  // ============================================================

  /**
   * Save attendance data (optimistic update)
   */
  async saveAttendance(dateKey, slotId, data) {
    console.log('[HybridStorageManager] Saving attendance:', dateKey, slotId);

    // 1. Always save locally first (instant)
    if (this.local) {
      this.local.saveAttendance(dateKey, slotId, data);
    }

    // 2. Add to sync queue
    if (this.queue && this.mode !== 'local-only') {
      await this.queue.addAttendanceChange(dateKey, slotId, data);
    }

    // 3. Try immediate sync if online and authenticated
    if (this.isOnline && this.supabaseConfigured && this.remote.isAuthenticated()) {
      this._processQueue();
    }

    // 4. Notify data update
    if (this.onDataUpdate) {
      this.onDataUpdate('attendance', dateKey, slotId);
    }
  }

  /**
   * Load attendance data
   */
  async loadAttendance(dateKey) {
    // In hybrid mode, try remote first, fallback to local
    if (this.mode === 'cloud-primary' && this.isOnline && this.supabaseConfigured) {
      try {
        const result = await this.remote.loadAttendance(this.kelasId, dateKey);
        if (result.data) {
          // Transform remote data to local format
          const localFormat = this._transformRemoteAttendance(result.data);
          // Also save to local for offline access
          if (this.local) {
            this.local._set(this.local.keys.attendance, localFormat);
          }
          return localFormat;
        }
      } catch (error) {
        console.warn('[HybridStorageManager] Remote load failed, using local:', error);
      }
    }

    // Fallback to local storage
    if (this.local) {
      return this.local._get(this.local.keys.attendance);
    }

    return null;
  }

  /**
   * Transform remote attendance data to local format
   */
  _transformRemoteAttendance(remoteData) {
    const result = {};

    for (const record of remoteData) {
      const { date_key, slot_id, student_id, status, timestamps, audit_trail, note } = record;

      if (!result[date_key]) {
        result[date_key] = {};
      }

      if (!result[date_key][slot_id]) {
        result[date_key][slot_id] = {};
      }

      result[date_key][slot_id][student_id] = {
        status: status || {},
        timestamps: timestamps || {},
        auditTrail: audit_trail || [],
        note: note || '',
      };
    }

    return result;
  }

  // ============================================================
  // PERMIT OPERATIONS
  // ============================================================

  /**
   * Save permit (optimistic update)
   */
  async savePermit(permit) {
    console.log('[HybridStorageManager] Saving permit:', permit.id);

    // 1. Save locally first
    if (this.local) {
      this.local.savePermit(permit);
    }

    // 2. Add to sync queue
    if (this.queue && this.mode !== 'local-only') {
      await this.queue.addPermitChange(permit);
    }

    // 3. Try immediate sync
    if (this.isOnline && this.supabaseConfigured && this.remote.isAuthenticated()) {
      this._processQueue();
    }

    // 4. Notify
    if (this.onDataUpdate) {
      this.onDataUpdate('permits');
    }
  }

  /**
   * Delete permit
   */
  async deletePermit(permitId) {
    console.log('[HybridStorageManager] Deleting permit:', permitId);

    // 1. Delete locally
    if (this.local) {
      this.local.deletePermit(permitId);
    }

    // 2. Add to queue as delete operation
    if (this.queue && this.mode !== 'local-only') {
      await this.queue.add({
        entityType: 'permit',
        entityId: permitId,
        operation: 'delete',
        payload: { id: permitId },
      });
    }

    // 3. Try immediate sync
    if (this.isOnline && this.supabaseConfigured && this.remote.isAuthenticated()) {
      this._processQueue();
    }
  }

  /**
   * Load permits
   */
  async loadPermits() {
    if (this.mode === 'cloud-primary' && this.isOnline && this.supabaseConfigured) {
      try {
        const result = await this.remote.loadPermits(this.kelasId);
        if (result.data) {
          // Transform to local format
          const localFormat = result.data.map(p => this._transformRemotePermit(p));
          if (this.local) {
            this.local._set(this.local.keys.permits, localFormat);
          }
          return localFormat;
        }
      } catch (error) {
        console.warn('[HybridStorageManager] Remote load permits failed:', error);
      }
    }

    if (this.local) {
      return this.local._get(this.local.keys.permits) || [];
    }

    return [];
  }

  /**
   * Transform remote permit to local format
   */
  _transformRemotePermit(remote) {
    return {
      id: remote.id,
      nis: remote.nis,
      category: remote.category,
      reason: remote.reason,
      start_date: remote.start_date,
      end_date: remote.end_date,
      start_session: remote.start_session,
      end_session: remote.end_session,
      start_time_limit: remote.start_time_limit,
      end_time_limit: remote.end_time_limit,
      location: remote.location,
      pickup: remote.pickup,
      vehicle: remote.vehicle,
      status: remote.status,
      status_label: remote.status_label,
      is_active: remote.is_active,
      requires_surat_dokter: remote.requires_surat_dokter,
      surat_dokter: remote.document_url,
      audit_trail: remote.audit_trail || [],
      timestamp: remote.created_at,
    };
  }

  // ============================================================
  // SETTINGS OPERATIONS
  // ============================================================

  /**
   * Save settings
   */
  async saveSettings(settings) {
    if (this.local) {
      this.local.saveSettings(settings);
    }

    if (this.queue && this.mode !== 'local-only') {
      await this.queue.addSettingsChange(settings);
    }

    if (this.isOnline && this.supabaseConfigured && this.remote.isAuthenticated()) {
      this._processQueue();
    }
  }

  /**
   * Load settings
   */
  async loadSettings() {
    if (this.local) {
      return this.local._get(this.local.keys.settings);
    }
    return null;
  }

  // ============================================================
  // SYNC OPERATIONS
  // ============================================================

  /**
   * Process the sync queue
   */
  async _processQueue() {
    if (!this.queue || !this.isOnline || this.isSyncing) {
      return;
    }

    // Check authentication
    if (this.supabaseConfigured && !this.remote.isAuthenticated()) {
      console.log('[HybridStorageManager] Not authenticated, skipping sync');
      return;
    }

    this.isSyncing = true;
    if (this.onSyncStart) {
      this.onSyncStart();
    }

    try {
      const pending = await this.queue.getPending(this.config.batchSize);
      console.log('[HybridStorageManager] Processing', pending.length, 'pending changes');

      for (const change of pending) {
        try {
          await this._syncChange(change);
          await this.queue.markSynced(change.id);
        } catch (error) {
          console.error('[HybridStorageManager] Sync error for', change.id, error);

          if (error?.code === '409' || error?.message?.includes('conflict')) {
            await this._handleConflict(change, error);
          } else if (change.attempts >= this.config.retryAttempts) {
            await this.queue.markFailed(change.id, error);
          } else {
            await this.queue.updateStatus(change.id, 'pending', {
              attempts: change.attempts + 1,
              lastError: error?.message,
            });
          }
        }
      }

      // Update sync metadata
      if (this.supabaseConfigured && this.remote.isAuthenticated()) {
        const userId = this.remote.getUser()?.id;
        if (userId) {
          await this.remote.updateSyncMetadata(userId, 'all');
        }
      }

      await this.queue.setLastSyncTime();

      // Clean up old synced entries
      await this.queue.clearSynced();

      console.log('[HybridStorageManager] Sync complete');
      if (this.onSyncComplete) {
        this.onSyncComplete();
      }

    } catch (error) {
      console.error('[HybridStorageManager] Queue processing error:', error);
      if (this.onSyncError) {
        this.onSyncError(error);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single change
   */
  async _syncChange(change) {
    switch (change.entityType) {
      case 'attendance':
        return this._syncAttendance(change);
      case 'permit':
        return this._syncPermit(change);
      case 'settings':
        return this._syncSettings(change);
      default:
        console.warn('[HybridStorageManager] Unknown entity type:', change.entityType);
    }
  }

  /**
   * Sync attendance change
   */
  async _syncAttendance(change) {
    const { dateKey, slotId, data } = change.payload;

    // Transform local format to remote format
    const records = [];

    for (const [studentId, studentData] of Object.entries(data)) {
      if (studentId.startsWith('_')) continue; // Skip metadata keys

      // Generate unique ID for each record
      const recordId = `${this.kelasId}_${studentId}_${dateKey}_${slotId}`.replace(/\s+/g, '_');

      records.push({
        id: recordId,
        kelas_id: this.kelasId,
        student_id: studentId,
        date_key: dateKey,
        slot_id: slotId,
        status: studentData.status || {},
        timestamps: studentData.timestamps || {},
        audit_trail: studentData.auditTrail || [],
        note: studentData.note || '',
        permit_manual_override: studentData.permitManualOverride || false,
      });
    }

    if (records.length === 0) return;

    return this.remote.bulkSaveAttendance(records);
  }

  /**
   * Sync permit change
   */
  async _syncPermit(change) {
    const permit = change.payload;

    if (change.operation === 'delete') {
      return this.remote.deletePermit(change.entityId);
    }

    // Generate ID if missing
    const permitId = permit.id || `permit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Transform to remote format
    const remotePermit = {
      id: permitId,
      kelas_id: this.kelasId,
      student_id: permit.studentId || permit.nis,
      nis: permit.nis,
      category: permit.category,
      reason: permit.reason,
      start_date: permit.start_date,
      end_date: permit.end_date,
      start_session: permit.start_session,
      end_session: permit.end_session,
      start_time_limit: permit.start_time_limit,
      end_time_limit: permit.end_time_limit,
      location: permit.location,
      pickup: permit.pickup,
      vehicle: permit.vehicle,
      status: permit.status || 'approved',
      status_label: permit.status_label,
      is_active: permit.is_active !== false,
      requires_surat_dokter: permit.requires_surat_dokter || false,
      document_url: permit.surat_dokter || permit.document,
      audit_trail: permit.audit_trail || [],
    };

    return this.remote.savePermit(remotePermit);
  }

  /**
   * Sync settings change
   */
  async _syncSettings(change) {
    const userId = this.remote.getUser()?.id;
    if (!userId) return;

    return this.remote.saveSettings(userId, change.payload);
  }

  /**
   * Handle conflict
   */
  async _handleConflict(change, error) {
    const serverData = error?.serverData;

    if (this.config.conflictResolution === 'server-wins') {
      // Server wins - update local with server data
      await this.queue.markConflict(change.id, serverData);
      await this._applyServerData(change.entityType, serverData);
    } else if (this.config.conflictResolution === 'client-wins') {
      // Force overwrite server
      await this.queue.updateStatus(change.id, 'pending', { _forceOverwrite: true });
    } else {
      // Manual resolution
      await this.queue.markConflict(change.id, serverData);
      if (this.onConflictDetected) {
        this.onConflictDetected(change, serverData);
      }
    }
  }

  /**
   * Apply server data to local storage
   */
  async _applyServerData(entityType, serverData) {
    if (entityType === 'attendance') {
      const { date_key, slot_id } = serverData;
      // Merge server data into local
      if (this.local) {
        const localData = this.local._get(this.local.keys.attendance) || {};
        if (!localData[date_key]) localData[date_key] = {};
        if (!localData[date_key][slot_id]) localData[date_key][slot_id] = {};

        // Server data wins
        for (const [studentId, data] of Object.entries(serverData.students || {})) {
          localData[date_key][slot_id][studentId] = data;
        }

        this.local._set(this.local.keys.attendance, localData);
      }
    }

    if (this.onDataUpdate) {
      this.onDataUpdate(entityType);
    }
  }

  /**
   * Force sync now
   */
  async syncNow() {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    await this._processQueue();
  }

  /**
   * Resolve a conflict manually
   */
  async resolveConflict(changeId, useServerData) {
    const change = await this.queue.getChange(changeId);
    if (!change) return;

    if (useServerData) {
      await this._applyServerData(change.entityType, change.serverData);
      await this.queue.markSynced(changeId);
    } else {
      // Re-queue client data with force flag
      await this.queue.updateStatus(changeId, 'pending', { _forceOverwrite: true });
      await this._processQueue();
    }
  }

  // ============================================================
  // UTILITY METHODS
  // ============================================================

  /**
   * Get sync status
   */
  async getSyncStatus() {
    const stats = await this.queue?.getStats() || {};
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pending: stats.pending || 0,
      failed: stats.failed || 0,
      conflicts: stats.conflict || 0,
      lastSync: await this.queue?.getLastSyncTime() || null,
    };
  }

  /**
   * Update sync status UI
   */
  _updateSyncStatusUI() {
    const statusEl = document.getElementById('sync-status-indicator');
    if (!statusEl) return;

    if (!this.supabaseConfigured || this.mode === 'local-only') {
      statusEl.innerHTML = '<span class="text-slate-400">Local</span>';
      return;
    }

    if (!this.isOnline) {
      statusEl.innerHTML = `<span class="text-amber-500">Offline (${this.pendingCount} pending)</span>`;
      return;
    }

    if (this.isSyncing) {
      statusEl.innerHTML = '<span class="text-blue-500 animate-pulse">Syncing...</span>';
      return;
    }

    if (this.pendingCount > 0) {
      statusEl.innerHTML = `<span class="text-amber-500">${this.pendingCount} pending</span>`;
      return;
    }

    statusEl.innerHTML = '<span class="text-emerald-500">Synced</span>';
  }

  /**
   * Clear all local data
   */
  clearLocal() {
    if (this.local) {
      this.local.clearAll();
    }
  }

  /**
   * Change storage mode
   */
  setMode(mode) {
    this.mode = mode;
    console.log('[HybridStorageManager] Mode changed to:', mode);

    if (mode === 'local-only') {
      this.stopAutoSync();
    } else {
      this._startAutoSync();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopAutoSync();
    if (this.local) {
      this.local.destroy();
    }
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const hybridStorageManager = new HybridStorageManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HybridStorageManager;
}

window.HybridStorageManager = HybridStorageManager;
window.hybridStorageManager = hybridStorageManager;

console.log('[HybridStorageManager] Module loaded');
