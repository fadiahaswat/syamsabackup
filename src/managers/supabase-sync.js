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

    // 1. Jalankan sinkronisasi awal (inbound pull & outbound push)
    if (navigator.onLine) {
      this.syncAll();
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
    } catch (error) {
      this._logger.error('[SupabaseSync] Sync cycle failed:', error);
      this.updateStatus('error');
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

    try {
      const pendingChanges = await window.syncQueue.getPending(100);

      if (pendingChanges.length === 0) {
        this._logger.debug('[SupabaseSync] No pending changes to sync');
        return;
      }

      this._logger.info(`[SupabaseSync] Syncing ${pendingChanges.length} changes to cloud`);

      let successCount = 0;
      let failCount = 0;

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

            const { error } = await window.supabaseClient
              .from(table)
              .upsert(cleanPayload);

            if (error) {
              this._logger.error(`[SupabaseSync] Upsert error for ${table}:`, error);
              throw error;
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
          await window.syncQueue.markFailed(change.id, err);
        }
      }

      this._logger.info(`[SupabaseSync] Sync complete: ${successCount} success, ${failCount} failed`);

    } catch (err) {
      this._logger.error('[SupabaseSync] syncOutbound error:', err);
    } finally {
      this.isSyncingOutbound = false;
      if (failCount === 0) {
        this.updateStatus('synced');
      } else {
        this.updateStatus('error');
      }
    }
  }

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
            await this._db.put('attendances', transformedRecord);
          }
        }
      }

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
            await this._db.put('permits', record);
          }
        }
      }

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
            await this._db.put('tahfizh', record);
          }
        }
      }

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
            await this._db.put('musyrif_journals', record);
          }
        }
      }

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
            await this._db.put('settings', record);
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

    const tables = ['attendances', 'permits', 'tahfizh', 'settings'];

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
                await this._db.delete(table, payload.old.id);
              } else {
                // INSERT atau UPDATE
                const record = payload.new;

                // Transform Supabase format to local format
                const transformedRecord = this._toLocalFormat(record, table);

                // Khusus untuk tabel spesifik kelas, pastikan kelasnya cocok dengan kelas saat ini (kecuali jika mode Admin/Superadmin)
                const isAdmin = appState?.adminMode || appState?.superadminMode;
                if (table !== 'settings' && !isAdmin && record.kelas !== appState?.selectedClass) {
                  this._logger.debug(`[Realtime] Skipping ${table} record - kelas mismatch: ${record.kelas} !== ${appState?.selectedClass}`);
                  return; // Abaikan data kelas lain
                }

                const localRecord = await this._db.get(table, record.id);
                if (!localRecord || (record._version > (localRecord._version || 0))) {
                  this._logger.debug(`[Realtime] Updating local ${table}:`, record.id);
                  await this._db.put(table, transformedRecord);

                  // Jika setting app_config berubah, langsung terapkan
                  if (table === 'settings' && record.id === 'app_config' && record.data) {
                    this._applyDynamicAppConfig(record.data);
                  }
                }
              }

              // Re-trigger UI Update
              if (window.stateManager) {
                await window.stateManager._loadPersistedState();
                if (typeof window.stateManager._emit === 'function') {
                  window.stateManager._emit('change', ['attendanceData', 'permits', 'settings']);
                }
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
    attendances: ['id', 'date', 'slot', 'studentId', 'kelas', 'status', 'note', 'timestamps', 'auditTrail', '_version', '_updatedAt'],
    permits: ['id', 'nis', 'kelas', 'category', 'reason', 'start_date', 'end_date', 'start_session', 'end_session', 'status', 'is_active', 'document', 'audit_trail', '_version'],
    tahfizh: ['id', 'nis', 'kelas', 'program', 'jenis', 'juz', 'halaman', 'surat', 'kualitas', 'status', 'musyrif', 'tanggal', '_version'],
    settings: ['id', 'data', 'updated_at'],
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
      const allowedFields = this._SUPABASE_FIELDS[entityType] || Object.keys(payload);
      const cleaned = {};

      for (const key of allowedFields) {
        if (payload.hasOwnProperty(key)) {
          cleaned[key] = payload[key];
        }
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
    return record;
  }
}

// Singleton Instance
window.supabaseSync = new SupabaseSync();
