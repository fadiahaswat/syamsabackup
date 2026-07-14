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

    // Callbacks untuk UI
    this.onStatusChange = null;
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

    console.log('[SupabaseSync] Initializing Sync Manager...');

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
      console.log('[SupabaseSync] Network online, starting sync...');
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
      console.log('[SupabaseSync] Starting full sync cycle...');
      // 1. Tarik data konfigurasi dinamis (settings) dulu agar batas-batas terupdate
      await this.syncInboundConfig();

      // 2. Kirim perubahan lokal ke cloud
      await this.syncOutbound();

      // 3. Tarik data terbaru dari cloud
      await this.syncInboundData();

      this.updateStatus('synced');
      console.log('[SupabaseSync] Full sync cycle completed successfully');
    } catch (error) {
      console.error('[SupabaseSync] Sync cycle failed:', error);
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
    if (!window.syncQueue) return;
    const pendingChanges = await window.syncQueue.getPending(100);

    if (pendingChanges.length === 0) {
      console.log('[SupabaseSync] No outbound changes to sync');
      return;
    }

    console.log(`[SupabaseSync] Syncing ${pendingChanges.length} outbound changes...`);

    for (const change of pendingChanges) {
      try {
        const table = change.entityType; // Nama store di IndexedDB dipetakan ke nama tabel Supabase
        const entityId = change.entityId;

        // Skip table yang bukan milik Supabase
        if (['sync_queue', 'conflicts', 'sync_metadata'].includes(table)) {
          await window.syncQueue.deleteChange(change.id);
          continue;
        }

        if (change.operation === 'upsert') {
          const payload = change.payload;
          const { error } = await window.supabaseClient
            .from(table)
            .upsert(payload);

          if (error) throw error;
        } else if (change.operation === 'delete') {
          const { error } = await window.supabaseClient
            .from(table)
            .delete()
            .eq('id', entityId);

          if (error) throw error;
        }

        // Tandai sebagai sukses ter-sync
        await window.syncQueue.markSynced(change.id);
        // Hapus langsung dari queue jika sudah ter-sync agar queue tetap bersih
        await window.syncQueue.deleteChange(change.id);

      } catch (err) {
        console.error(`[SupabaseSync] Failed to sync change ${change.id}:`, err);
        await window.syncQueue.markFailed(change.id, err);
      }
    }
  }

  /**
   * SINKRONISASI INBOUND (Supabase -> Local)
   * Menarik data terbaru untuk kelas yang sedang aktif
   */
  async syncInboundData() {
    const kelas = appState?.selectedClass;
    if (!kelas) {
      console.log('[SupabaseSync] Inbound data sync skipped: No selected class');
      return;
    }

    console.log(`[SupabaseSync] Pulling latest data for class: ${kelas}`);

    // Menandai agar write ke local DB tidak di-queue ulang ke sync_queue
    this._db.isSyncing = true;

    try {
      // 1. Sync Tabel Attendances
      const { data: cloudAttendances, error: errAtt } = await window.supabaseClient
        .from('attendances')
        .select('*')
        .eq('kelas', kelas);

      if (errAtt) throw errAtt;
      if (cloudAttendances) {
        for (const record of cloudAttendances) {
          const localRecord = await this._db.get('attendances', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.put('attendances', record);
          }
        }
      }

      // 2. Sync Tabel Permits
      const { data: cloudPermits, error: errPerm } = await window.supabaseClient
        .from('permits')
        .select('*')
        .eq('kelas', kelas);

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
      const { data: cloudTahfizh, error: errTah } = await window.supabaseClient
        .from('tahfizh')
        .select('*')
        .eq('kelas', kelas);

      if (errTah) throw errTah;
      if (cloudTahfizh) {
        for (const record of cloudTahfizh) {
          const localRecord = await this._db.get('tahfizh', record.id);
          if (!localRecord || (record._version > (localRecord._version || 0))) {
            await this._db.put('tahfizh', record);
          }
        }
      }

      // Re-trigger UI Update setelah inbound sync selesai
      if (window.stateManager) {
        await window.stateManager._loadPersistedState();
        if (typeof window.stateManager._emit === 'function') {
          window.stateManager._emit('change', ['attendanceData', 'permits']);
        }
      }

    } catch (err) {
      console.error('[SupabaseSync] Inbound data sync failed:', err);
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
    console.log('[SupabaseSync] Pulling app config & settings...');
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
      console.error('[SupabaseSync] Pulling app config failed:', err);
      throw err;
    } finally {
      this._db.isSyncing = false;
    }
  }

  /**
   * Menerapkan konfigurasi dinamis dari database ke variabel global aplikasi secara runtime
   */
  _applyDynamicAppConfig(config) {
    console.log('[SupabaseSync] Applying dynamic app_config parameters:', config);
    
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
            console.log(`[SupabaseSync] Realtime change detected on ${table}:`, payload);
            
            // Bypass sync_queue
            this._db.isSyncing = true;
            
            try {
              if (payload.eventType === 'DELETE') {
                await this._db.delete(table, payload.old.id);
              } else {
                // INSERT atau UPDATE
                const record = payload.new;
                
                // Khusus untuk tabel spesifik kelas, pastikan kelasnya cocok dengan kelas saat ini
                if (table !== 'settings' && record.kelas !== appState?.selectedClass) {
                  return; // Abaikan data kelas lain
                }

                const localRecord = await this._db.get(table, record.id);
                if (!localRecord || (record._version > (localRecord._version || 0))) {
                  await this._db.put(table, record);
                  
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
              
              console.log(`[SupabaseSync] Realtime update applied for ${table}`);
            } catch (err) {
              console.error(`[SupabaseSync] Failed to apply realtime change on ${table}:`, err);
            } finally {
              this._db.isSyncing = false;
            }
          }
        )
        .subscribe();

      this.channels.push(channel);
    });

    console.log(`[SupabaseSync] Realtime listener subscribed to tables: ${tables.join(', ')}`);
  }
}

// Singleton Instance
window.supabaseSync = new SupabaseSync();
console.log('[SupabaseSync] Module loaded');
