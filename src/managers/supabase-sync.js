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

    // Callbacks untuk UI
    this.onStatusChange = null;

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

    // 3. Setup event listener koneksi internet
    window.addEventListener('online', () => {
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this.updateStatus('offline');
    });
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

    try {
      // 1. Tarik data konfigurasi dinamis (settings) dulu agar batas-batas terupdate
      await this.syncInboundConfig();

      // 2. Kirim perubahan lokal ke cloud
      await this.syncOutbound();

      // 3. Tarik data terbaru dari cloud
      await this.syncInboundData();

      this.updateStatus('synced');
      this._history.unshift({ timestamp: new Date().toISOString(), status: 'success' });
      this._history = this._history.slice(0, 50);
    } catch (error) {
      this._logger.error('[SupabaseSync] Sync cycle failed:', error);
      this.updateStatus('error');
      this._history.unshift({ timestamp: new Date().toISOString(), status: 'error', message: error.message });
    } finally {
      this.isSyncing = false;
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

    } catch (err) {
      this._logger.error('[SupabaseSync] syncOutbound error:', err);
    } finally {
      this.isSyncingOutbound = false;
      if (failCount === 0 && successCount > 0) {
        this.updateStatus('synced');
      } else if (failCount > 0) {
        this.updateStatus('error');
      }
    }
  }

  _hasLocalStore(table) {
    return ['attendances', 'permits', 'tahfizh', 'settings', 'activity_logs', 'musyrif_journals'].includes(table);
  }

  _isVersionedTable(table) {
    return ['attendances', 'permits', 'tahfizh', 'settings', 'musyrif_journals', 'app_records'].includes(table);
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

    try {
      // 1. Sync Tabel Attendances
      let queryAtt = window.supabaseClient.from('attendances').select('*');
      if (!isAdmin) {
        queryAtt = queryAtt.eq('kelas', kelas);
      }
      const { data: cloudAttendances, error: errAtt } = await queryAtt;

      if (errAtt) {
        this._logger.error('[SupabaseSync] Error fetching attendances:', errAtt);
        throw errAtt;
      }

      this._logger.info(`[SupabaseSync] Got ${cloudAttendances?.length || 0} attendance records from cloud`);

      if (cloudAttendances && cloudAttendances.length > 0) {
        for (const record of cloudAttendances) {
          // Transform Supabase format to local format
          const localRecord = await this._db.get('attendances', record.id);
          const transformedRecord = this._toLocalFormat(record, 'attendances');

          if (!localRecord || (record._version > (localRecord._version || 0))) {
            this._logger.debug(`[SupabaseSync] Updating local attendance: ${record.id}`);
            await this._db.putFromCloud('attendances', transformedRecord);
          }
        }
      }
      await this._pruneLocalRows('attendances', cloudAttendances || [], record => isAdmin || record.kelas === kelas);

      // 2. Sync Tabel Permits
      let queryPerm = window.supabaseClient.from('permits').select('*');
      if (!isAdmin) {
        queryPerm = queryPerm.eq('kelas', kelas);
      }
      const { data: cloudPermits, error: errPerm } = await queryPerm;

      if (errPerm) throw errPerm;
      if (cloudPermits) {
        for (const record of cloudPermits) {
          const localRecord = await this._db.get('permits', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.putFromCloud('permits', record);
          }
        }
      }
      await this._pruneLocalRows('permits', cloudPermits || [], record => isAdmin || record.kelas === kelas);

      // 3. Sync Tabel Tahfizh
      let queryTah = window.supabaseClient.from('tahfizh').select('*');
      if (!isAdmin) {
        queryTah = queryTah.eq('kelas', kelas);
      }
      const { data: cloudTahfizh, error: errTah } = await queryTah;

      if (errTah) throw errTah;
      if (cloudTahfizh) {
        for (const record of cloudTahfizh) {
          const localRecord = await this._db.get('tahfizh', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.putFromCloud('tahfizh', record);
          }
        }
      }
      await this._pruneLocalRows('tahfizh', cloudTahfizh || [], record => isAdmin || record.kelas === kelas);

      // 4. Sync Tabel Jurnal Musyrif
      let queryJr = window.supabaseClient.from('musyrif_journals').select('*');
      if (!isAdmin) {
        const musyrifId = window.journalManager?.getMusyrifId() || 'unknown_musyrif';
        queryJr = queryJr.eq('musyrif_id', musyrifId);
      }
      const { data: cloudJournals, error: errJr } = await queryJr;

      if (errJr) throw errJr;
      if (cloudJournals) {
        for (const record of cloudJournals) {
          const localRecord = await this._db.get('musyrif_journals', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.putFromCloud('musyrif_journals', this._toLocalFormat(record, 'musyrif_journals'));
          }
        }
      }
      await this._pruneLocalRows('musyrif_journals', cloudJournals || [], record => {
        const recordKelas = record.kelas || appState?.selectedClass;
        return isAdmin || recordKelas === kelas;
      });

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

              // Re-trigger UI Update
              if (table === 'user_roles' && window.authMultiRole?.currentUser) {
                window.authMultiRole.roles = await window.authMultiRole.getUserRoles();
                sessionStorage.setItem('multirole_roles', JSON.stringify(window.authMultiRole.roles));
              }

              if (table === 'sessions' && window.authMultiRole?.currentUser) {
                const valid = await window.authMultiRole.validateSession();
                if (!valid?.valid) window.handleForcedLogout?.();
              }

              if (window.stateManager && this._hasLocalStore(table)) {
                await window.stateManager._loadPersistedState();
                if (typeof window.stateManager._emit === 'function') {
                  window.stateManager._emit('change', ['attendanceData', 'permits', 'tahfizh', 'settings']);
                }
              }

              // Reload tahfizh data if tahfizh table changed
              if (table === 'tahfizh' && typeof window.reloadTahfizhData === 'function') {
                window.reloadTahfizhData();
              }
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
   * NOTE: Supabase schema uses JSONB for status field which can store objects,
   * so no transformation is needed. The local status object {shalat: "Hadir"}
   * is sent directly to Supabase.
   */
  _SUPABASE_FIELDS = {
    attendances: ['id', 'date', 'slot', 'studentId', 'kelas', 'status', 'note', 'timestamps', 'auditTrail', 'metadata', '_version', '_updatedAt'],
    permits: ['id', 'nis', 'kelas', 'category', 'reason', 'start_date', 'end_date', 'start_session', 'end_session', 'status', 'is_active', 'document', 'audit_trail', 'metadata', '_version'],
    tahfizh: ['id', 'nis', 'kelas', 'program', 'jenis', 'juz', 'halaman', 'surat', 'kualitas', 'status', 'musyrif', 'tanggal', 'metadata', '_version'],
    settings: ['id', 'data', '_version', '_updatedAt'],
    musyrif_journals: ['id', 'musyrif_id', 'kelas', 'tanggal', 'content', '_version'],
    activity_logs: ['id', 'action', 'detail', 'user_id', 'user_name_old', 'device_id', 'session_id', 'kelas', 'timestamp', 'metadata'],
    app_records: ['id', 'entity_type', 'kelas', 'nis', 'owner_user_id', 'data', '_version', 'deleted_at'],
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

// Singleton Instance
window.supabaseSync = new SupabaseSync();
window.syncManager = window.supabaseSync;
