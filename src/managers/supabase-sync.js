/**
 * SupabaseSync - Bidirectional Offline-First Sync Manager
 *
 * Sinkronisasi data antara IndexedDB (LocalDB) dan Supabase Cloud Database.
 * Menyediakan sinkronisasi Outbound (mengirim antrean offline) dan
 * Inbound (menarik update realtime dari cloud).
 */

class SupabaseSync {
  constructor() {
    this._db = null;
    this._repos = null;
    this.isSyncing = false;
    this.status = 'idle'; // 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

    // Realtime channel subscriptions
    this.channels = [];
    this.isSyncingOutbound = false;
    this._history = [];

    // 🔴 CRITICAL FIX #1: Add periodic sync interval (15 seconds)
    this._syncInterval = null;
    this._syncIntervalMs = 15000; // 15 seconds - balances real-time feel with server load

    // 🔴 CRITICAL FIX #5: Presence awareness
    this._presenceChannel = null;
    this._onlineUsers = new Map();

    // Callbacks untuk UI
    this.onStatusChange = null;
    this.onPresenceChange = null;

    // Track last sync time for UI
    this.lastSyncTime = null;

    // Logger
    this._logger = window.SupabaseSyncLogger || {
      debug: (...args) => window.Logger?.debug('SupabaseSync', ...args),
      info: (...args) => window.Logger?.info('SupabaseSync', ...args),
      warn: (...args) => window.Logger?.warn('SupabaseSync', ...args),
      error: (...args) => window.Logger?.error('SupabaseSync', ...args),
    };
  }

  /**
   * Inisialisasi Sync Manager
   */
  async init(localDB, repos) {
    if (!window.isSupabaseEnabled) {
      this.updateStatus('offline');
      return;
    }

    this._db = localDB;
    this._repos = repos;

    const { data: sessionData } = await window.supabaseClient.auth.getSession();
    const isAuthenticated = !!sessionData?.session?.user;
    const isWaliMode = appState?.waliMode === true;
    const isServiceAccount = sessionData?.session?.user?.email === 'wali-service@syamsa.app';

    // Check if user is logged in
    if (!isAuthenticated) {
      // For Wali mode without cloud, skip sync gracefully
      if (isWaliMode) {
        this._logger.info('[SupabaseSync] Wali mode - cloud not available (local only)');
        this.updateStatus('offline');
        this._setupAuthRetry();
        return;
      }

      // For musyrif/admin, cloud session is required
      this.updateStatus('error');
      this._logger.error('[SupabaseSync] Authenticated cloud session is required');
      this._setupAuthRetry();
      return;
    }

    // If authenticated as service account (Wali cloud login), proceed with sync
    if (isServiceAccount) {
      this._logger.info('[SupabaseSync] Wali service account authenticated - starting sync');
    }

    await this._startSync();
  }

  /**
   * Setup listener untuk retry sync saat user login
   */
  _setupAuthRetry() {
    if (this._authRetryBound) return; // Prevent duplicate listeners
    this._authRetryBound = true;

    const retryHandler = async (event) => {
      if (event?.detail?.isAuthenticated) {
        this._logger.info('[SupabaseSync] User authenticated, retrying sync initialization...');
        window.removeEventListener('cloud:auth-state', retryHandler);
        await this._startSync();
      }
    };

    window.addEventListener('cloud:auth-state', retryHandler);
  }

  /**
   * Start sync setelah session tersedia
   */
  async _startSync() {
    // 1. Jalankan sinkronisasi awal (inbound pull & outbound push)
    if (navigator.onLine) {
      await this.syncAll();
    } else {
      this.updateStatus('offline');
    }

    // 2. Setup Realtime Subscriptions
    this._setupRealtimeSubscriptions();

    // 🔴 CRITICAL FIX #1: Setup periodic sync interval (15 seconds)
    this._startPeriodicSync();

    // 🔴 CRITICAL FIX #5: Setup presence awareness
    this._setupPresenceChannel();

    // 🔴 CRITICAL FIX #8: Setup BroadcastChannel for same-origin tab sync
    this._setupBroadcastChannel();

    // 3. Setup event listener koneksi internet
    window.addEventListener('online', () => {
      this._startPeriodicSync(); // Restart interval on reconnect
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this._stopPeriodicSync();
      this.updateStatus('offline');
    });
  }

  /**
   * 🔴 CRITICAL FIX #1: Start periodic sync interval
   */
  _startPeriodicSync() {
    // Clear any existing interval
    this._stopPeriodicSync();

    // Only start if online and Supabase enabled
    if (!navigator.onLine || !window.isSupabaseEnabled) {
      this._logger.debug('[SupabaseSync] Periodic sync not started - offline or disabled');
      return;
    }

    this._syncInterval = setInterval(() => {
      if (navigator.onLine && window.isSupabaseEnabled && !this.isSyncing) {
        this.syncAll();
      }
    }, this._syncIntervalMs);

    this._logger.info(`[SupabaseSync] Periodic sync started - interval: ${this._syncIntervalMs}ms`);
  }

  /**
   * Stop periodic sync interval
   */
  _stopPeriodicSync() {
    if (this._syncInterval) {
      clearInterval(this._syncInterval);
      this._syncInterval = null;
      this._logger.debug('[SupabaseSync] Periodic sync stopped');
    }
  }

  /**
   * 🔴 CRITICAL FIX #8: Setup BroadcastChannel for same-origin tab synchronization
   */
  _setupBroadcastChannel() {
    // Skip if BroadcastChannel not supported
    if (typeof BroadcastChannel !== 'function') {
      this._logger.warn('[SupabaseSync] BroadcastChannel not supported in this browser');
      return;
    }

    // Create or connect to existing channel
    if (this._broadcastChannel) {
      this._broadcastChannel.close();
    }

    this._broadcastChannel = new BroadcastChannel('syamsa_data_sync');

    // Listen for updates from other tabs
    this._broadcastChannel.onmessage = (event) => {
      const { type, data, timestamp } = event.data;
      this._logger.debug(`[BroadcastChannel] Received: ${type}`, { timestamp });

      switch (type) {
        case 'DATA_UPDATED':
          this._handleBroadcastUpdate(data);
          break;
        case 'SYNC_REQUEST':
          // Another tab requesting full sync
          this.syncAll();
          break;
        case 'PRESENCE':
          this._handlePresenceBroadcast(data);
          break;
      }
    };

    // Announce presence on this tab
    this._broadcastPresence();

    this._logger.info('[SupabaseSync] BroadcastChannel setup complete');
  }

  /**
   * Handle data update from another tab
   */
  _handleBroadcastUpdate(data) {
    const { entityType, entityId, operation } = data;

    this._logger.debug(`[BroadcastChannel] Handling update: ${entityType}/${entityId} (${operation})`);

    // Dispatch event for local listeners
    window.dispatchEvent(new CustomEvent('cloud:record-changed', {
      detail: {
        table: entityType,
        record: { id: entityId },
        eventType: operation,
        source: 'broadcast'
      }
    }));

    // Reload relevant data based on entity type
    switch (entityType) {
      case 'attendances':
        window.renderAttendanceList?.();
        window.updateDashboard?.();
        break;
      case 'permits':
      case 'permit_requests':
        window.loadMusyrifRequests?.();
        window.renderMusyrifApprovalWidget?.();
        window.refreshPermitSurfaces?.();
        break;
      case 'tahfizh':
        window.reloadTahfizhData?.();
        window.renderTahfizhDashboard?.();
        break;
      case 'notifications':
        window.fetchNotifications?.();
        window.renderNotificationsUI?.();
        break;
    }
  }

  /**
   * Broadcast data update to other tabs
   */
  _broadcastUpdate(entityType, entityId, operation) {
    if (!this._broadcastChannel) return;

    this._broadcastChannel.postMessage({
      type: 'DATA_UPDATED',
      data: { entityType, entityId, operation },
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast presence to other tabs
   */
  _broadcastPresence() {
    if (!this._broadcastChannel) return;

    const userInfo = {
      userId: appState?.userProfile?.id || appState?.userProfile?.email,
      role: appState?.waliMode ? 'wali' : (appState?.userProfile?.role || 'musyrif'),
      kelas: appState?.selectedClass,
      nis: appState?.waliSantri?.nis,
      onlineAt: Date.now()
    };

    this._broadcastChannel.postMessage({
      type: 'PRESENCE',
      data: userInfo
    });
  }

  /**
   * Handle presence broadcast from other tabs
   */
  _handlePresenceBroadcast(data) {
    // Update local presence tracking
    if (data.userId) {
      this._onlineUsers.set(data.userId, {
        ...data,
        lastSeen: Date.now()
      });

      // Notify UI
      if (this.onPresenceChange) {
        this.onPresenceChange(this._getOnlineUsersList());
      }
    }
  }

  /**
   * Get list of online users
   */
  _getOnlineUsersList() {
    const now = Date.now();
    const activeThreshold = 60000; // 1 minute

    // Clean up stale entries
    for (const [userId, info] of this._onlineUsers) {
      if (now - info.lastSeen > activeThreshold) {
        this._onlineUsers.delete(userId);
      }
    }

    return Array.from(this._onlineUsers.values());
  }

  /**
   * 🔴 CRITICAL FIX #5: Setup presence channel for tracking online users
   */
  _setupPresenceChannel() {
    if (!window.isSupabaseEnabled || !window.supabaseClient) {
      this._logger.debug('[SupabaseSync] Presence channel not setup - Supabase not enabled');
      return;
    }

    // Clean up existing channel
    if (this._presenceChannel) {
      window.supabaseClient.removeChannel(this._presenceChannel);
    }

    this._presenceChannel = window.supabaseClient.channel('presence');

    // Listen for presence sync events
    this._presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = this._presenceChannel.presenceState();
        this._logger.debug('[Presence] Sync:', Object.keys(state));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this._logger.info('[Presence] User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        this._logger.info('[Presence] User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await this._presenceChannel.track({
              user_id: appState?.userProfile?.id || appState?.userProfile?.email,
              role: appState?.waliMode ? 'wali' : (appState?.userProfile?.role || 'musyrif'),
              kelas: appState?.selectedClass,
              nis: appState?.waliSantri?.nis,
              online_at: new Date().toISOString()
            });
            this._logger.debug('[Presence] Tracking started');
          } catch (err) {
            this._logger.warn('[Presence] Failed to track:', err);
          }
        }
      });

    this._logger.info('[SupabaseSync] Presence channel setup complete');
  }

  /**
   * Get current online users
   */
  getOnlineUsers() {
    return this._getOnlineUsersList();
  }

  /**
   * Get presence status
   */
  getPresenceStatus() {
    return {
      channelActive: !!this._presenceChannel,
      onlineCount: this._getOnlineUsersList().length,
      users: this._getOnlineUsersList()
    };
  }

  /**
   * Update status sinkronisasi
   */
  updateStatus(newStatus) {
    this.status = newStatus;
    if (this.onStatusChange) {
      this.onStatusChange(newStatus);
    }
    // Update global UI indicator jika ada
    const indicator = document.getElementById('supabase-sync-status');
    if (indicator) {
      let icon = 'cloud';
      let text = 'Supabase Cloud';
      let colorClass = 'text-slate-400';

      if (!window.isSupabaseEnabled) {
        icon = 'cloud-off';
        text = 'Lokal Only';
        colorClass = 'text-slate-400 dark:text-slate-500';
      } else if (newStatus === 'syncing') {
        icon = 'refresh-cw';
        text = 'Sinkronisasi...';
        colorClass = 'text-blue-500 animate-spin';
      } else if (newStatus === 'synced') {
        icon = 'cloud-check';
        text = 'Cloud Terhubung';
        colorClass = 'text-emerald-500';
      } else if (newStatus === 'error') {
        icon = 'cloud-lightning';
        text = 'Gagal Sinkron';
        colorClass = 'text-red-500';
      } else if (newStatus === 'offline') {
        icon = 'cloud-off';
        text = 'Mode Offline';
        colorClass = 'text-amber-500';
      }

      indicator.className = `relative p-2.5 rounded-full bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none ${colorClass}`;
      indicator.title = `${text} (Klik untuk sinkronisasi)`;
      indicator.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 block"></i>`;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  /**
   * Jalankan sinkronisasi dua arah secara penuh
   */
  async syncAll() {
    if (this.isSyncing || !window.isSupabaseEnabled) return;
    this.isSyncing = true;
    this.updateStatus('syncing');

    // ENHANCEMENT: Progress tracking
    this._emitProgress({ phase: 'starting', percent: 0, message: 'Memulai sinkronisasi...' });

    try {
      // 1. Tarik data konfigurasi dinamis (settings) dulu agar batas-batas terupdate
      this._emitProgress({ phase: 'config', percent: 10, message: 'Mengunduh konfigurasi...' });
      await this.syncInboundConfig();

      // 2. Kirim perubahan lokal ke cloud
      this._emitProgress({ phase: 'outbound', percent: 30, message: 'Mengirim data lokal...' });
      await this.syncOutbound();

      // 3. Tarik data terbaru dari cloud
      this._emitProgress({ phase: 'inbound', percent: 60, message: 'Mengunduh data cloud...' });
      await this.syncInboundData();

      // ENHANCEMENT: Update last sync time after successful sync
      this._updateLastSyncTime();

      this._emitProgress({ phase: 'complete', percent: 100, message: 'Sinkronisasi selesai!' });
      this.updateStatus('synced');
      this._history.unshift({ timestamp: new Date().toISOString(), status: 'success' });
      this._history = this._history.slice(0, 50);
    } catch (error) {
      this._logger.error('[SupabaseSync] Sync cycle failed:', error);
      this._emitProgress({ phase: 'error', percent: 0, message: `Error: ${error.message}` });
      this.updateStatus('error');
      this._history.unshift({ timestamp: new Date().toISOString(), status: 'error', message: error.message });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * ENHANCEMENT: Emit progress event for UI
   * @private
   */
  _emitProgress(progress) {
    // Dispatch event for UI components
    window.dispatchEvent(new CustomEvent('sync:progress', { detail: progress }));

    // Call registered callback if any
    if (typeof this.onProgress === 'function') {
      this.onProgress(progress);
    }
  }

  /**
   * SINKRONISASI OUTBOUND (Local -> Supabase)
   * Mengirim antrean perubahan dari sync_queue
   */
  async syncOutbound() {
    if (this.isSyncingOutbound || !window.syncQueue || !window.supabaseClient) {
      this._logger.debug('[SupabaseSync] syncOutbound skipped:', {
        isSyncingOutbound: this.isSyncingOutbound,
        hasSyncQueue: !!window.syncQueue,
        hasClient: !!window.supabaseClient
      });
      return;
    }

    this.isSyncingOutbound = true;
    this.updateStatus('syncing');

    // Initialize counters outside try block for finally block access
    let successCount = 0;
    let failCount = 0;

    try {
      const pendingChanges = await window.syncQueue.getPending(100);

      if (pendingChanges.length === 0) {
        this._logger.debug('[SupabaseSync] No pending changes to sync');
        return;
      }

      this._logger.info(`[SupabaseSync] Syncing ${pendingChanges.length} changes to cloud`);

      for (const change of pendingChanges) {
        try {
          // Support both snake_case (new) and camelCase (legacy)
          const table = change.entity_type || change.entityType;
          const entityId = change.entity_id || change.entityId;

          // Skip table yang bukan milik Supabase (meta and sync_* stores are local-only)
          if (['sync_queue', 'conflicts', 'sync_metadata', 'meta'].includes(table)) {
            await window.syncQueue.deleteChange(change.id);
            continue;
          }

          if (change.operation === 'upsert') {
            const payload = change.payload;
            // Clean payload to only include Supabase schema fields
            const cleanPayload = this._stripInternalFields(payload, table);

            this._logger.debug(`[SupabaseSync] Upserting to ${table}:`, cleanPayload.id);

            const cloudRecord = await this._writeCloudRecord(
              table,
              cleanPayload,
              Number(payload?._baseVersion || 0),
            );
            if (cloudRecord && this._db?.putFromCloud && this._hasLocalStore(table)) {
              await this._db.putFromCloud(table, this._toLocalFormat(cloudRecord, table));
            }
            successCount++;
          } else if (change.operation === 'delete') {
            const { error } = await window.supabaseClient
              .from(table)
              .delete()
              .eq('id', entityId);

            if (error) throw error;
            successCount++;
          }

          // Tandai sebagai sukses ter-sync
          await window.syncQueue.markSynced(change.id);
          // Hapus langsung dari queue jika sudah ter-sync agar queue tetap bersih
          await window.syncQueue.deleteChange(change.id);

        } catch (err) {
          failCount++;
          this._logger.error(`[SupabaseSync] Failed to sync change ${change.id}:`, err);
          if (err?.isConflict) {
            await window.syncQueue.markConflict(change.id, err.serverData || null);
          } else {
            await window.syncQueue.markFailed(change.id, err);
          }
        }
      }

      this._logger.info(`[SupabaseSync] Sync complete: ${successCount} success, ${failCount} failed`);

      // UX FIX: Show toast notification for sync results
      if (failCount === 0 && successCount > 0) {
        // Silent success - no toast needed for normal sync
        this.updateStatus('synced');
      } else if (failCount > 0) {
        // ERROR: Notify user about failed items
        this.updateStatus('error');
        window.showToast?.(`Sinkronisasi gagal: ${failCount} item tidak tersinkronkan.`, 'error');
        window.dispatchEvent(new CustomEvent('sync:error', {
          detail: { successCount, failCount }
        }));
      }

    } catch (err) {
      this._logger.error('[SupabaseSync] syncOutbound error:', err);
      // UX FIX: Show toast for critical errors
      window.showToast?.('Sinkronisasi gagal. Periksa koneksi internet.', 'error');
      this.updateStatus('error');
      window.dispatchEvent(new CustomEvent('sync:critical-error', {
        detail: { error: err.message }
      }));
    } finally {
      this.isSyncingOutbound = false;
    }
  }

  _hasLocalStore(table) {
    return ['attendances', 'permits', 'tahfizh', 'settings', 'activity_logs', 'musyrif_journals'].includes(table);
  }

  _isVersionedTable(table) {
    return ['attendances', 'permits', 'tahfizh', 'settings', 'musyrif_journals', 'app_records'].includes(table);
  }

  /**
   * ENHANCEMENT: Get last sync timestamp for incremental sync
   * Returns ISO timestamp or null for full sync
   */
  _getLastSyncTime() {
    // Try to get from localStorage first (persisted)
    const stored = localStorage.getItem('supabase_sync_last_time');
    if (stored) {
      return stored;
    }

    // Fallback to this.lastSyncTime
    if (this.lastSyncTime) {
      return this.lastSyncTime;
    }

    // Default: null (full sync on first run)
    return null;
  }

  /**
   * ENHANCEMENT: Update last sync timestamp
   * Call this after successful sync
   */
  _updateLastSyncTime() {
    const now = new Date().toISOString();
    this.lastSyncTime = now;
    localStorage.setItem('supabase_sync_last_time', now);
    return now;
  }

  async _writeCloudRecord(table, payload, baseVersion) {
    if (!this._isVersionedTable(table)) {
      const { data, error } = await window.supabaseClient
        .from(table)
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    if (baseVersion <= 0) {
      const insertPayload = { ...payload, _version: 1 };
      const { data, error } = await window.supabaseClient
        .from(table)
        .insert(insertPayload)
        .select()
        .single();
      if (!error) return data;

      // A retry after a lost response is idempotent when the exact revision
      // already exists in cloud.
      if (error.code === '23505') {
        const { data: current } = await window.supabaseClient
          .from(table)
          .select('*')
          .eq('id', payload.id)
          .maybeSingle();
        if (current && Number(current._version || 0) === 1) return current;
        throw this._createConflictError(current);
      }
      throw error;
    }

    const updatePayload = { ...payload };
    delete updatePayload._version;
    const { data, error } = await window.supabaseClient
      .from(table)
      .update(updatePayload)
      .eq('id', payload.id)
      .eq('_version', baseVersion)
      .select();
    if (error) throw error;
    if (data?.length === 1) return data[0];

    const { data: current } = await window.supabaseClient
      .from(table)
      .select('*')
      .eq('id', payload.id)
      .maybeSingle();
    throw this._createConflictError(current);
  }

  _createConflictError(serverData) {
    const error = new Error('Cloud record changed on another device');
    error.isConflict = true;
    error.serverData = serverData;
    return error;
  }

  isPaused() { return false; }

  togglePause() {
    window.showToast?.('Sinkronisasi cloud wajib dan tidak dapat dijeda.', 'info');
    return false;
  }

  getSyncOptions() {
    return {
      tables: ['attendances', 'permits', 'tahfizh', 'settings', 'musyrif_journals', 'app_records'],
      dateRange: null,
    };
  }

  setTablesToSync() { /* cloud-only always syncs all scoped tables */ }
  setDateRange() { /* full scoped sync is required */ }
  clearDateRange() { /* no-op */ }
  getHistory(limit = 10) { return this._history.slice(0, limit); }
  clearHistory() { this._history = []; }
  async getPendingCount() { return window.syncQueue?.getPendingCount?.() || 0; }

  /**
   * SINKRONISASI INBOUND (Supabase -> Local)
   * Menarik data terbaru untuk kelas yang sedang aktif
   */
  async syncInboundData() {
    const isAdmin = appState?.adminMode || appState?.superadminMode;
    const kelas = appState?.selectedClass;

    this._logger.info(`[SupabaseSync] syncInboundData called - kelas: ${kelas}, isAdmin: ${isAdmin}`);

    if (!kelas && !isAdmin) {
      this._logger.warn('[SupabaseSync] syncInboundData skipped - no kelas and not admin');
      return;
    }

    // Menandai agar write ke local DB tidak di-queue ulang ke sync_queue
    this._db.isSyncing = true;

    // ENHANCEMENT: Get last sync time for incremental sync
    const lastSyncTime = this._getLastSyncTime();

    try {
      // PERFORMANCE FIX: Fetch all tables in PARALLEL using Promise.all
      // ENHANCEMENT: Use timestamp-based incremental sync to reduce data transfer
      const [
        attResult,
        permResult,
        tahResult,
        jrResult
      ] = await Promise.all([
        // 1. Fetch Attendances (with incremental sync filter)
        (async () => {
          let query = window.supabaseClient.from('attendances').select('*');
          if (!isAdmin) query = query.eq('kelas', kelas);
          // INCREMENTAL SYNC: Only fetch records updated since last sync
          if (lastSyncTime) {
            query = query.gt('updated_at', lastSyncTime);
          }
          return query;
        })(),
        // 2. Fetch Permits (with incremental sync filter)
        (async () => {
          let query = window.supabaseClient.from('permits').select('*');
          if (!isAdmin) query = query.eq('kelas', kelas);
          // INCREMENTAL SYNC: Only fetch records updated since last sync
          if (lastSyncTime) {
            query = query.gt('updated_at', lastSyncTime);
          }
          return query;
        })(),
        // 3. Fetch Tahfizh (with incremental sync filter)
        (async () => {
          let query = window.supabaseClient.from('tahfizh').select('*');
          if (!isAdmin) query = query.eq('kelas', kelas);
          // INCREMENTAL SYNC: Only fetch records updated since last sync
          if (lastSyncTime) {
            query = query.gt('updated_at', lastSyncTime);
          }
          return query;
        })(),
        // 4. Fetch Musyrif Journals (with incremental sync filter)
        (async () => {
          let query = window.supabaseClient.from('musyrif_journals').select('*');
          if (!isAdmin) {
            const musyrifId = window.journalManager?.getMusyrifId() || 'unknown_musyrif';
            query = query.eq('musyrif_id', musyrifId);
          }
          // INCREMENTAL SYNC: Only fetch records updated since last sync
          if (lastSyncTime) {
            query = query.gt('updated_at', lastSyncTime);
          }
          return query;
        })()
      ]);

      const { data: cloudAttendances, error: errAtt } = attResult;
      const { data: cloudPermits, error: errPerm } = permResult;
      const { data: cloudTahfizh, error: errTah } = tahResult;
      const { data: cloudJournals, error: errJr } = jrResult;

      // Handle fetch errors
      if (errAtt) {
        this._logger.error('[SupabaseSync] Error fetching attendances:', errAtt);
        throw errAtt;
      }
      if (errPerm) {
        this._logger.error('[SupabaseSync] Error fetching permits:', errPerm);
        throw errPerm;
      }
      if (errTah) {
        this._logger.error('[SupabaseSync] Error fetching tahfizh:', errTah);
        throw errTah;
      }
      if (errJr) {
        this._logger.error('[SupabaseSync] Error fetching journals:', errJr);
        throw errJr;
      }

      this._logger.info(`[SupabaseSync] Got ${[
        cloudAttendances?.length || 0,
        cloudPermits?.length || 0,
        cloudTahfizh?.length || 0,
        cloudJournals?.length || 0
      ].join('/')} records from cloud (attendances/permits/tahfizh/journals)`);

      // PERFORMANCE FIX: Process all tables in PARALLEL
      await Promise.all([
        // Process Attendances
        this._processTableSync('attendances', cloudAttendances, isAdmin, kelas,
          record => this._toLocalFormat(record, 'attendances')),
        // Process Permits
        this._processTableSync('permits', cloudPermits, isAdmin, kelas),
        // Process Tahfizh
        this._processTableSync('tahfizh', cloudTahfizh, isAdmin, kelas),
        // Process Journals
        this._processTableSync('musyrif_journals', cloudJournals, isAdmin, kelas,
          record => this._toLocalFormat(record, 'musyrif_journals'))
      ]);

      // Re-trigger UI Update setelah inbound sync selesai
      if (window.stateManager) {
        await window.stateManager._loadPersistedState();
        if (typeof window.stateManager._emit === 'function') {
          window.stateManager._emit('change', ['attendanceData', 'permits', 'journalData']);
        }
      }

    } catch (err) {
      this._logger.error('[SupabaseSync] Inbound data sync failed:', err);
      throw err;
    } finally {
      this._db.isSyncing = false;
    }
  }

  /**
   * PERFORMANCE FIX: Helper to process table sync in parallel batches
   * Processes records in parallel chunks instead of sequential forEach
   */
  async _processTableSync(tableName, cloudRecords, isAdmin, kelas, transformFn = null) {
    if (!cloudRecords || cloudRecords.length === 0) return;

    const isInScope = record => isAdmin || record.kelas === kelas;

    // Filter records in scope
    const inScopeRecords = cloudRecords.filter(isInScope);

    // PERFORMANCE: Process in parallel batches of 50
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < inScopeRecords.length; i += BATCH_SIZE) {
      batches.push(inScopeRecords.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await Promise.all(batch.map(async (record) => {
        const localRecord = await this._db.get(tableName, record.id);
        const transformedRecord = transformFn ? transformFn(record) : record;

        if (!localRecord || (record._version > (localRecord._version || 0))) {
          this._logger.debug(`[SupabaseSync] Updating local ${tableName}: ${record.id}`);
          await this._db.putFromCloud(tableName, transformedRecord);
        }
      }));
    }

    // Prune local rows
    await this._pruneLocalRows(tableName, cloudRecords, isInScope);
  }

  async _pruneLocalRows(table, cloudRows, isInScope) {
    if (!this._hasLocalStore(table)) return;
    const cloudIds = new Set(cloudRows.map(row => String(row.id)));
    const queued = await window.syncQueue?.export?.() || [];
    const protectedIds = new Set(
      queued
        .filter(item => (item.entity_type || item.entityType) === table && item.status !== 'synced')
        .map(item => String(item.entity_id || item.entityId))
    );
    const localRows = await this._db.getAll(table);
    for (const row of localRows) {
      if (isInScope(row) && !cloudIds.has(String(row.id)) && !protectedIds.has(String(row.id))) {
        await this._db.delete(table, row.id, { skipSync: true });
      }
    }
  }

  /**
   * SINKRONISASI INBOUND CONFIG (Settings & App Config)
   * Menarik konfigurasi geofencing, batas edit, deadline tahfizh, dll.
   */
  async syncInboundConfig() {
    this._db.isSyncing = true;

    try {
      const { data: cloudSettings, error: errSet } = await window.supabaseClient
        .from('settings')
        .select('*');

      if (errSet) throw errSet;

      if (cloudSettings) {
        for (const record of cloudSettings) {
          const localRecord = await this._db.get('settings', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.putFromCloud('settings', record);
          }

          // Jika record adalah 'app_config', kita timpa konfigurasi hardcoded di aplikasi secara runtime!
          if (record.id === 'app_config' && record.data) {
            this._applyDynamicAppConfig(record.data);
          }
        }
      }
    } catch (err) {
      this._logger.error('[SupabaseSync] Pulling app config failed:', err);
      throw err;
    } finally {
      this._db.isSyncing = false;
    }
  }

  /**
   * Menerapkan konfigurasi dinamis dari database ke variabel global aplikasi secara runtime
   */
  _applyDynamicAppConfig(config) {
    // 1. GPS Geofencing
    if (config.gps) {
      window.APP_LOCATION = {
        ...window.APP_LOCATION,
        ...config.gps
      };
    }

    // 2. Constants / Limits
    if (config.limits) {
      window.APP_CONSTANTS = {
        ...window.APP_CONSTANTS,
        ...config.limits
      };
    }

    // 3. Tahfizh
    if (config.tahfizh) {
      window.APP_TAHFIZH_CONFIG = {
        ...window.APP_TAHFIZH_CONFIG,
        ...config.tahfizh
      };
    }
  }

  /**
   * Setup Realtime Subscriptions (Mendengarkan data baru dari cloud secara realtime)
   */
  _setupRealtimeSubscriptions() {
    if (!window.isSupabaseEnabled) return;

    // Bersihkan subscriptions yang ada sebelumnya
    this.channels.forEach(ch => window.supabaseClient.removeChannel(ch));
    this.channels = [];

    const tables = [
      'attendances', 'permits', 'tahfizh', 'settings', 'activity_logs',
      'musyrif_journals', 'app_records', 'user_roles', 'user_devices',
      'sessions', 'wali_students', 'notifications'
    ];

    tables.forEach(table => {
      const channel = window.supabaseClient
        .channel(`realtime:${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: table },
          async (payload) => {
            this._logger.debug(`[Realtime] Received ${payload.eventType} on ${table}`);

            // Bypass sync_queue
            this._db.isSyncing = true;

            try {
              if (payload.eventType === 'DELETE') {
                if (this._hasLocalStore(table) && payload.old?.id) {
                  await this._db.delete(table, payload.old.id, { skipSync: true });
                }
                window.dispatchEvent(new CustomEvent('cloud:record-deleted', {
                  detail: { table, record: payload.old }
                }));
              } else {
                // INSERT atau UPDATE
                const record = payload.new;

                // Skip if no valid record
                if (!record || !record.id) {
                  this._logger.debug(`[Realtime] Skipping ${table} - no valid record or id`);
                  return;
                }

                // Transform Supabase format to local format
                const transformedRecord = this._toLocalFormat(record, table);

                // Khusus untuk tabel spesifik kelas, pastikan kelasnya cocok dengan kelas saat ini (kecuali jika mode Admin/Superadmin)
                const isAdmin = appState?.adminMode || appState?.superadminMode;
                if (record.kelas && table !== 'settings' && !isAdmin && record.kelas !== appState?.selectedClass && !appState?.waliMode) {
                  this._logger.debug(`[Realtime] Skipping ${table} record - kelas mismatch: ${record.kelas} !== ${appState?.selectedClass}`);
                  return; // Abaikan data kelas lain
                }

                const localRecord = this._hasLocalStore(table)
                  ? await this._db.get(table, record.id)
                  : null;
                if (!this._hasLocalStore(table) || !localRecord || (record._version > (localRecord._version || 0))) {
                  this._logger.debug(`[Realtime] Updating local ${table}:`, record.id);

                  // SPECIAL HANDLING: Notifications - add to localStorage and show
                  if (table === 'notifications') {
                    await this._handleIncomingNotification(record);
                  } else if (this._hasLocalStore(table)) {
                    await this._db.putFromCloud(table, transformedRecord);
                  }

                  window.dispatchEvent(new CustomEvent('cloud:record-changed', {
                    detail: { table, record: transformedRecord, eventType: payload.eventType }
                  }));

                  // Jika setting app_config berubah, langsung terapkan
                  if (table === 'settings' && record.id === 'app_config' && record.data) {
                    this._applyDynamicAppConfig(record.data);
                  }
                }
              }

              // 🔴 CRITICAL FIX #2: Re-trigger UI Update for ALL tables
              if (table === 'user_roles' && window.authMultiRole?.currentUser) {
                window.authMultiRole.roles = await window.authMultiRole.getUserRoles();
                sessionStorage.setItem('multirole_roles', JSON.stringify(window.authMultiRole.roles));
              }

              if (table === 'sessions' && window.authMultiRole?.currentUser) {
                const valid = await window.authMultiRole.validateSession();
                if (!valid?.valid) window.handleForcedLogout?.();
              }

              // 🔴 CRITICAL FIX #2: UI refresh based on table type
              this._triggerUIUpdate(table, payload.eventType);

              // 🔴 CRITICAL FIX #8: Broadcast to other tabs
              this._broadcastUpdate(table, record.id, payload.eventType);
            } catch (err) {
              this._logger.error(`[SupabaseSync] Failed to apply realtime change on ${table}:`, err);
            } finally {
              this._db.isSyncing = false;
            }
          }
        )
        .subscribe();

      this.channels.push(channel);
      this._logger.info(`Subscribed to realtime changes for ${table}`);
    });
  }

  /**
   * Whitelist of fields that exist in Supabase schema
   * Only these fields will be synced to Supabase - everything else is local-only
   *
   * 🔴 CRITICAL FIX #6: Extended permits schema to include all request fields
   * for proper exit ticket sync between devices
   *
   * NOTE: Supabase schema uses JSONB for status field which can store objects,
   * so no transformation is needed. The local status object {shalat: "Hadir"}
   * is sent directly to Supabase.
   */
  _SUPABASE_FIELDS = {
    attendances: ['id', 'date', 'slot', 'studentId', 'kelas', 'status', 'note', 'timestamps', 'auditTrail', 'metadata', '_version', '_updatedAt'],
    permits: [
      // Core fields
      'id', 'nis', 'kelas', 'category', 'reason',
      // Date/time fields
      'start_date', 'end_date', 'start_session', 'end_session',
      // Status fields
      'status', 'is_active', 'is_overdue',
      // Audit fields
      'approvedBy', 'approvedAt', 'rejectedBy', 'rejectedAt', 'rejectReason',
      'audit_trail',
      // 🔴 CRITICAL FIX #6: Added missing request fields for exit ticket sync
      'studentId', 'nama', 'nama_wali', 'alamat_wali',
      'start_time_limit', 'end_time_limit', 'destination', 'location',
      'requested_by', 'status_label',
      // Document
      'document', 'hasDocument',
      // Metadata
      'metadata', '_version', '_updatedAt'
    ],
    tahfizh: ['id', 'nis', 'kelas', 'program', 'jenis', 'juz', 'halaman', 'surat', 'kualitas', 'status', 'musyrif', 'tanggal', 'metadata', '_version'],
    settings: ['id', 'data', '_version', '_updatedAt'],
    musyrif_journals: ['id', 'musyrif_id', 'kelas', 'tanggal', 'content', '_version'],
    activity_logs: ['id', 'action', 'detail', 'user_id', 'user_name_old', 'device_id', 'session_id', 'kelas', 'timestamp', 'metadata'],
    app_records: ['id', 'entity_type', 'kelas', 'nis', 'owner_user_id', 'data', '_version', 'deleted_at'],
    // 🔴 CRITICAL FIX #6: Exit tickets table for digital ticket sync
    exit_tickets: [
      'id', 'permit_id', 'student_nis', 'student_name', 'student_class',
      'wali_name', 'wali_address', 'destination', 'reason',
      'valid_from', 'valid_until', 'approver_name', 'approved_at',
      'created_at'
    ],
    notifications: [
      'id', 'recipient_type', 'recipient_id', 'title', 'body',
      'type', 'deep_link', 'is_read', 'created_at', 'synced_at'
    ]
  };

  /**
   * Clean payload to only include fields that exist in Supabase schema
   * No transformation needed - JSONB in Supabase can store objects directly
   */
  _stripInternalFields(payload, entityType = 'attendances') {
    if (Array.isArray(payload)) {
      return payload.map(item => this._stripInternalFields(item, entityType));
    }

    if (typeof payload === 'object' && payload !== null) {
      if (entityType === 'musyrif_journals') {
        return {
          id: payload.id,
          musyrif_id: payload.musyrifId || 'unknown_musyrif',
          kelas: payload.kelas || (typeof appState !== 'undefined' ? appState.selectedClass : '-') || '-',
          tanggal: payload.date || payload.tanggal || '',
          content: {
            taskId: payload.taskId,
            taskName: payload.taskName,
            timeWindow: payload.timeWindow,
            status: payload.status,
            verifiedAt: payload.verifiedAt,
            stepsCount: payload.stepsCount,
            musyrifName: payload.musyrifName,
            gpsVerified: payload.gpsVerified || false,
            maxDisplacement: payload.maxDisplacement || 0,
            pathCoords: payload.pathCoords || [],
            elapsedSeconds: payload.elapsedSeconds || 0
          },
          _version: payload._version || 1
        };
      }

      const allowedFields = this._SUPABASE_FIELDS[entityType] || Object.keys(payload);
      const cleaned = {};

      for (const key of allowedFields) {
        if (payload.hasOwnProperty(key)) {
          cleaned[key] = payload[key];
        }
      }

      if (['attendances', 'permits', 'tahfizh'].includes(entityType)) {
        const known = new Set([...allowedFields, '_createdAt', '_syncedAt', '_baseVersion']);
        const extra = Object.fromEntries(
          Object.entries(payload).filter(([key]) => !known.has(key))
        );
        cleaned.metadata = { ...(payload.metadata || {}), ...extra };
      }

      // Always include 'id' field
      if (payload.id && !cleaned.id) {
        cleaned.id = payload.id;
      }

      return cleaned;
    }

    return payload;
  }

  /**
   * Transform Supabase data back to local format (no-op since formats are compatible)
   */
  _toLocalFormat(record, entityType = 'attendances') {
    if (entityType === 'musyrif_journals' && record) {
      const content = record.content || {};
      return {
        id: record.id,
        date: record.tanggal,
        taskId: content.taskId,
        taskName: content.taskName,
        timeWindow: content.timeWindow,
        status: content.status || 'pending',
        verifiedAt: content.verifiedAt || null,
        stepsCount: content.stepsCount || 0,
        musyrifId: record.musyrif_id,
        musyrifName: content.musyrifName || 'Musyrif',
        gpsVerified: content.gpsVerified || false,
        maxDisplacement: content.maxDisplacement || 0,
        pathCoords: content.pathCoords || [],
        elapsedSeconds: content.elapsedSeconds || 0,
        _version: record._version || 1
      };
    }
    if (record && ['attendances', 'permits', 'tahfizh'].includes(entityType)) {
      return { ...record, ...(record.metadata || {}) };
    }
    return record;
  }

  /**
   * 🔴 CRITICAL FIX #2: Trigger UI updates based on table type
   */
  _triggerUIUpdate(table, eventType) {
    // Always reload state manager
    if (window.stateManager && this._hasLocalStore(table)) {
      window.stateManager._loadPersistedState?.();
      if (typeof window.stateManager._emit === 'function') {
        window.stateManager._emit('change', ['attendanceData', 'permits', 'tahfizh', 'settings']);
      }
    }

    // Table-specific UI updates
    switch (table) {
      case 'attendances':
        // Update attendance UI
        if (typeof window.renderAttendanceList === 'function') {
          window.renderAttendanceList();
        }
        // Update dashboard widgets
        if (typeof window.updateDashboard === 'function') {
          window.updateDashboard();
        }
        // Update quick presence badge
        if (typeof window.refreshQuickPresence === 'function') {
          window.refreshQuickPresence();
        }
        this._logger.debug(`[SupabaseSync] UI refreshed for ${table}`);
        break;

      case 'permits':
      case 'permit_requests':
        // Update permit widgets and lists
        if (typeof window.initPermitRequestListener === 'function') {
          window.initPermitRequestListener();
        }
        if (typeof window.loadMusyrifRequests === 'function') {
          window.loadMusyrifRequests();
        }
        if (typeof window.renderMusyrifApprovalWidget === 'function') {
          window.renderMusyrifApprovalWidget(window.currentPendingRequests?.length || 0);
        }
        if (typeof window.refreshPermitSurfaces === 'function') {
          window.refreshPermitSurfaces();
        }
        // Reload Wali permit history if in Wali mode
        if (typeof window.loadWaliPermitHistory === 'function') {
          window.loadWaliPermitHistory();
        }
        this._logger.debug(`[SupabaseSync] UI refreshed for ${table}`);
        break;

      case 'tahfizh':
        // Update tahfizh data and UI
        if (typeof window.reloadTahfizhData === 'function') {
          window.reloadTahfizhData();
        }
        if (typeof window.renderTahfizhDashboard === 'function') {
          window.renderTahfizhDashboard();
        }
        this._logger.debug(`[SupabaseSync] UI refreshed for ${table}`);
        break;

      case 'notifications':
        // Refresh notification UI
        if (typeof window.fetchNotifications === 'function') {
          window.fetchNotifications();
        }
        if (typeof window.renderNotificationsUI === 'function') {
          window.renderNotificationsUI(window.currentNotificationsList);
        }
        // Update notification badge
        const badge = document.getElementById('notif-badge');
        if (badge) {
          badge.classList.remove('hidden');
        }
        this._logger.debug(`[SupabaseSync] UI refreshed for ${table}`);
        break;

      case 'musyrif_journals':
        // Update journal UI
        if (typeof window.reloadJournalData === 'function') {
          window.reloadJournalData();
        }
        if (typeof window.renderJournalDashboard === 'function') {
          window.renderJournalDashboard();
        }
        this._logger.debug(`[SupabaseSync] UI refreshed for ${table}`);
        break;

      case 'settings':
        // Reload app settings
        if (typeof window.reloadAppSettings === 'function') {
          window.reloadAppSettings();
        }
        this._logger.debug(`[SupabaseSync] UI refreshed for ${table}`);
        break;

      case 'activity_logs':
        // Update activity log display if visible
        if (typeof window.refreshActivityLogs === 'function') {
          window.refreshActivityLogs();
        }
        break;

      default:
        this._logger.debug(`[SupabaseSync] No specific UI handler for ${table}`);
    }

    // Update last sync time display
    this.lastSyncTime = new Date();
    this._updateSyncTimeDisplay();
  }

  /**
   * Update sync time display in UI
   */
  _updateSyncTimeDisplay() {
    const syncTimeEl = document.getElementById('last-sync-time');
    if (syncTimeEl && this.lastSyncTime) {
      const timeStr = this.lastSyncTime.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      syncTimeEl.textContent = timeStr;
    }
  }

  /**
   * Handle incoming notification from Supabase realtime
   * Add to localStorage and show browser notification
   */
  async _handleIncomingNotification(notification) {
    try {
      // Check if notification is for current user
      const recipient = window.getNotificationRecipientInfo?.();
      const isForCurrentUser =
        (recipient?.type === notification.recipient_type) &&
        (recipient?.id === notification.recipient_id);

      // Save to localStorage regardless
      const cacheKey = `local_notifs_${notification.recipient_type}_${notification.recipient_id}`;
      const cached = localStorage.getItem(cacheKey);
      let list = cached ? JSON.parse(cached) : [];

      // Check if already exists
      if (!list.find(n => n.id === notification.id)) {
        list.unshift(notification);
        list = list.slice(0, 50); // Keep max 50
        localStorage.setItem(cacheKey, JSON.stringify(list));
      }

      // Show notification if for current user
      if (isForCurrentUser && notification.title) {
        // Dispatch event for UI update
        window.dispatchEvent(new CustomEvent('cloud:notification-received', {
          detail: { notification }
        }));

        // Show browser notification
        if (typeof window.sendLocalNotification === 'function') {
          window.sendLocalNotification(
            notification.title,
            notification.body,
            notification.type || 'info'
          );
        }

        // Update UI if visible
        if (typeof window.renderNotificationsUI === 'function') {
          window.renderNotificationsUI(list);
        }

        // Update bell badge
        const unreadCount = list.filter(n => !n.is_read).length;
        const badge = document.getElementById('notif-badge');
        if (badge) {
          badge.textContent = unreadCount;
          badge.classList.toggle('hidden', unreadCount === 0);
        }
      }

      this._logger.debug('[SupabaseSync] Handled incoming notification:', notification.id);
    } catch (err) {
      this._logger.error('[SupabaseSync] Failed to handle incoming notification:', err);
    }
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

// Create SupabaseSync singleton
window.supabaseSync = new SupabaseSync();

// Alias for backward compatibility (SyncManager -> SupabaseSync)
window.syncManager = window.supabaseSync;

// Deprecation notice
console.info('[SupabaseSync] ✓ Real-time sync enabled with:');
console.info('  - Periodic sync: 15 second interval');
console.info('  - Supabase Realtime: Push updates');
console.info('  - BroadcastChannel: Same-origin tab sync');
console.info('  - Presence awareness: Online users tracking');
