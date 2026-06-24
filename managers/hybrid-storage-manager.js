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
      if (this.isOnline && (this.remote.isAuthenticated() || (typeof appState !== 'undefined' && appState.waliMode))) {
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

    // Setup realtime callbacks
    this._setupRealtimeCallbacks();

    // Subscribe to realtime changes
    if (this.supabaseConfigured && this.mode !== 'local-only' && this.remote.isInitialized) {
      await this._subscribeToRealtime();
    }

    this.isInitialized = true;
    console.log('[HybridStorageManager] Initialized', {
      mode: this.mode,
      supabaseConfigured: this.supabaseConfigured,
      isOnline: this.isOnline,
    });

    // Re-sync any pending permits that are in localStorage but not in the sync queue
    // This fixes permits that failed silently due to UUID mismatch or were submitted offline
    if (this.isOnline && this.supabaseConfigured && this.mode !== 'local-only') {
      setTimeout(() => this._resyncPendingPermits(), 3000);
    }
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
      console.log('[HybridStorageManager] Downloading permits for kelasId:', this.kelasId);
      const { data: permitsData, error: permitError } = await this.remote.loadPermits(this.kelasId);
      if (permitError) {
        console.warn('[HybridStorageManager] Download permits error:', permitError);
      } else {
        console.log('[HybridStorageManager] Permits download result: count =', permitsData ? permitsData.length : 0);
        if (permitsData && permitsData.length > 0) {
          console.log('[HybridStorageManager] Downloaded', permitsData.length, 'permits from cloud');
          await this._mergePermitsData(permitsData);
        } else {
          console.log('[HybridStorageManager] No permits found in cloud for this class');
        }
      }

      // Trigger UI refresh
      this._refreshUI();

      console.log('[HybridStorageManager] Cloud data download complete');
    } catch (error) {
      console.error('[HybridStorageManager] Cloud download failed:', error);
    }
  }

  /**
   * Re-sync permits from localStorage that are not yet in Supabase.
   * This handles permits submitted when offline, or when sync failed due to UUID mismatch.
   */
  async _resyncPendingPermits() {
    if (!this.queue || !this.remote || !this.remote.client) return;

    const isWali = typeof appState !== 'undefined' && appState.waliMode;

    // Only run for wali mode OR when queue is empty but local permits exist
    const localPermits = (typeof appState !== 'undefined' ? appState.permits : null) || [];
    const pendingLocal = localPermits.filter(p => p && p.status === 'pending');

    if (pendingLocal.length === 0) return;

    console.log('[HybridStorageManager] _resyncPendingPermits: Found', pendingLocal.length, 'pending permits in localStorage');

    // Check which ones are already in the sync queue (avoid re-adding)
    let queuedIds = new Set();
    try {
      const pending = await this.queue.getPending(200);
      pending.forEach(c => { if (c.entityType === 'permit') queuedIds.add(String(c.entityId)); });
    } catch(e) {}

    // Re-queue permits that are not in the sync queue
    let requeued = 0;
    for (const permit of pendingLocal) {
      if (!queuedIds.has(String(permit.id))) {
        console.log('[HybridStorageManager] _resyncPendingPermits: Re-queuing permit:', permit.id);
        try {
          await this.queue.addPermitChange(permit);
          requeued++;
        } catch(e) {
          console.warn('[HybridStorageManager] _resyncPendingPermits: Failed to re-queue:', permit.id, e);
        }
      }
    }

    if (requeued > 0) {
      console.log('[HybridStorageManager] _resyncPendingPermits: Re-queued', requeued, 'permits, processing queue...');
      this._processQueue();
    }
  }

  /**
   * Refresh approval widget and show notification banner
   */
  _refreshApprovalWidget() {
    console.log('[HybridStorageManager] _refreshApprovalWidget called');

    // Reload musyrif requests
    if (typeof window.loadMusyrifRequests === 'function') {
      console.log('[HybridStorageManager] Calling loadMusyrifRequests...');
      window.loadMusyrifRequests();
    } else {
      console.log('[HybridStorageManager] loadMusyrifRequests not available!');
    }

    // Also try direct widget manipulation
    const widget = document.getElementById("musyrif-approval-widget");
    const permits = appState.permits || [];
    const pendingCount = permits.filter(p => p && p.status === 'pending').length;

    console.log('[HybridStorageManager] Widget element:', widget, 'Pending count:', pendingCount);

    if (widget) {
      if (pendingCount > 0) {
        widget.classList.remove("hidden");
        const badge = document.getElementById("approval-pending-badge");
        const count = document.getElementById("approval-pending-count");
        if (badge) badge.textContent = pendingCount;
        if (count) count.textContent = `${pendingCount} Pengajuan Pending`;
        console.log('[HybridStorageManager] Widget shown with pending:', pendingCount);
      } else {
        widget.classList.add("hidden");
        console.log('[HybridStorageManager] Widget hidden - no pending');
      }
    }
  }

  _refreshUI(source = 'cloud_sync') {
    // Trigger global refresh callbacks
    if (this.onDataUpdate) {
      this.onDataUpdate('cloud_sync_complete');
    }

    // Refresh attendance list if available
    if (typeof window.renderAttendanceList === 'function') {
      window.renderAttendanceList();
    }

    // Refresh dashboard
    if (typeof window.updateDashboard === 'function') {
      window.updateDashboard();
    }

    // Refresh permit requests and approval list (Musyrif)
    if (typeof window.loadMusyrifRequests === 'function') {
      window.loadMusyrifRequests();
    }
    const modalEl = document.getElementById("modal-musyrif-approval");
    if (modalEl && !modalEl.classList.contains("hidden") && typeof window.updateMusyrifApprovalModalList === 'function') {
      window.updateMusyrifApprovalModalList();
    }

    // Refresh Wali permit history list
    if (typeof window.loadWaliPermitHistory === 'function') {
      window.loadWaliPermitHistory();
    }

    // Refresh permit surfaces
    if (typeof window.refreshPermitSurfaces === 'function') {
      window.refreshPermitSurfaces();
    }

    // Show subtle notification for realtime updates (not for local sync)
    if (source === 'realtime' && window.showToast) {
      window.showToast('🔄 Data diperbarui secara real-time', 'info', false, 2000);
    }
  }

  /**
   * Merge attendance data dari cloud ke local
   */
  async _mergeAttendanceData(cloudRecords) {
    if (!cloudRecords || cloudRecords.length === 0) return;

    // Get all pending attendance changes from the sync queue to protect unsynced local edits
    const pendingChanges = this.queue ? await this.queue.getPending() : [];
    const pendingKeys = new Set(
      pendingChanges
        .filter(c => c && c.entityType === 'attendance')
        .map(c => `${c.payload.dateKey}_${c.payload.slotId}`)
    );

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

    // Merge dengan appState.attendanceData (cloud wins untuk data yang lebih baru/tidak pending)
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
            const localRecord = appState.attendanceData[dateKey][slotId][studentId];
            const isPending = pendingKeys.has(`${dateKey}_${slotId}`);

            if (!localRecord || !isPending) {
              // Jika tidak ada data lokal, atau jika data lokal TIDAK sedang tertahan di antrean sinkronisasi (pending),
              // gunakan data dari cloud (server wins) agar sinkronisasi multi-device berjalan.
              appState.attendanceData[dateKey][slotId][studentId] = data;
            }
          }

          // Sync slot metadata (review status) dari cloud
          // Cek dari record pertama yang punya slot metadata
          const firstRecord = Object.values(students).find(r => r && typeof r === 'object' && r.review_confirmed !== undefined);
          if (firstRecord && firstRecord.review_confirmed === true) {
            appState.attendanceData[dateKey][slotId].__reviewConfirmed = true;
            appState.attendanceData[dateKey][slotId].__reviewedAt = firstRecord.reviewed_at;
            appState.attendanceData[dateKey][slotId].__reviewedBy = firstRecord.reviewed_by;
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

    if (typeof appState !== 'undefined') {
      if (!appState.permits) appState.permits = [];

      // Ambil semua perubahan perizinan yang sedang tertahan di antrean sinkronisasi
      const pendingChanges = this.queue ? await this.queue.getPending() : [];
      const pendingIds = new Set(
        pendingChanges
          .filter(c => c && c.entityType === 'permit')
          .map(c => String(c.entityId))
      );

      const transformedCloudPermits = cloudPermits.map(p => this._transformRemotePermit(p));

      // Gunakan map agar dapat menimpa data ID yang sudah ada secara efisien
      const localPermitMap = new Map(appState.permits.map(p => [String(p.id), p]));

      // Gabungkan data dari cloud ke local map
      for (const cloudPermit of transformedCloudPermits) {
        const permitId = String(cloudPermit.id);
        const isPending = pendingIds.has(permitId);

        if (!localPermitMap.has(permitId) || !isPending) {
          // Jika tidak ada data lokal, atau jika data lokal TIDAK sedang pending di sync queue,
          // maka gunakan data dari cloud (server wins).
          localPermitMap.set(permitId, cloudPermit);
        }
      }

      appState.permits = Array.from(localPermitMap.values());

      // Simpan ke localStorage
      localStorage.setItem('musyrif_permits_db', JSON.stringify(appState.permits));
      console.log('[HybridStorageManager] Merged permits data with local storage');
    }
  }

  /**
   * Setup realtime callbacks on the remote client
   */
  _setupRealtimeCallbacks() {
    if (!this.remote) return;

    // Handle realtime attendance changes
    this.remote.onAttendanceChange = (payload) => {
      console.log('[HybridStorageManager] Realtime attendance change:', payload);
      this._handleRealtimeAttendanceChange(payload);
    };

    // Handle realtime permit changes
    this.remote.onPermitChange = (payload) => {
      console.log('[HybridStorageManager] Realtime permit change:', payload);
      this._handleRealtimePermitChange(payload);
    };

    // Handle realtime tahfizh changes
    this.remote.onTahfizhChange = (payload) => {
      console.log('[HybridStorageManager] Realtime tahfizh change:', payload);
      this._handleRealtimeTahfizhChange(payload);
    };
  }

  /**
   * Subscribe to realtime changes for the current class
   */
  async _subscribeToRealtime() {
    if (!this.kelasId) {
      console.warn('[HybridStorageManager] Cannot subscribe to realtime - no kelasId');
      return;
    }

    try {
      const isUuid = (str) => typeof str === 'string' && str.length > 30 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

      // Resolve class UUID — only from cache, no Supabase kelas table query
      // (kelas table query returns 400 — column name mismatch or table missing)
      let resolvedKelasUuid = null;

      if (isUuid(this.kelasId)) {
        resolvedKelasUuid = this.kelasId;
      } else {
        const classSource = window.classData || window.MASTER_KELAS;
        if (classSource) {
          const matched = Object.keys(classSource).find(k => k.replace(/\s+/g, '').toLowerCase() === String(this.kelasId).replace(/\s+/g, '').toLowerCase());
          if (matched && classSource[matched]) {
            const uuid = classSource[matched].supabaseId || classSource[matched].id;
            if (isUuid(uuid)) resolvedKelasUuid = uuid;
          }
        }
      }

      if (!resolvedKelasUuid) {
        console.warn('[HybridStorageManager] Permit UUID not resolvable for class:', this.kelasId,
          '— permit realtime subscription unavailable. Updates will arrive via notification channel.');
      }

      await this.remote.subscribeToRealtime(this.kelasId, resolvedKelasUuid);
      console.log('[HybridStorageManager] Subscribed to realtime for kelas:', this.kelasId, 'UUID:', resolvedKelasUuid);
    } catch (error) {
      console.error('[HybridStorageManager] Failed to subscribe to realtime:', error);
    }
  }


  /**
   * Unsubscribe from realtime changes
   */
  unsubscribeRealtime() {
    if (this.remote) {
      this.remote.unsubscribeRealtime();
      console.log('[HybridStorageManager] Unsubscribed from realtime');
    }
  }

  /**
   * Handle realtime attendance change from another client
   */
  _handleRealtimeAttendanceChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    // Update local appState with the changed data
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const { date_key, slot_id, student_id, status, timestamps, audit_trail, note } = newRecord;

      if (!appState.attendanceData[date_key]) {
        appState.attendanceData[date_key] = {};
      }
      if (!appState.attendanceData[date_key][slot_id]) {
        appState.attendanceData[date_key][slot_id] = {};
      }

      // Update student attendance
      appState.attendanceData[date_key][slot_id][student_id] = {
        status: status || {},
        timestamps: timestamps || {},
        auditTrail: audit_trail || [],
        note: note || '',
      };

      // Sync slot metadata if present
      if (newRecord.review_confirmed === true) {
        appState.attendanceData[date_key][slot_id].__reviewConfirmed = true;
        appState.attendanceData[date_key][slot_id].__reviewedAt = newRecord.reviewed_at;
        appState.attendanceData[date_key][slot_id].__reviewedBy = newRecord.reviewed_by;
      }

      // Save to localStorage
      localStorage.setItem('musyrif_app_v5_fix', JSON.stringify(appState.attendanceData));
    }

    if (eventType === 'DELETE') {
      const { date_key, slot_id, student_id } = oldRecord;
      if (appState.attendanceData[date_key]?.[slot_id]?.[student_id]) {
        delete appState.attendanceData[date_key][slot_id][student_id];
        localStorage.setItem('musyrif_app_v5_fix', JSON.stringify(appState.attendanceData));
      }
    }

    // Trigger UI refresh
    this._refreshUI('realtime');
  }

  /**
   * Handle realtime permit change from another client
   */
  _handleRealtimePermitChange(payload) {
    console.log('[HybridStorageManager] _handleRealtimePermitChange called:', payload);
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const permit = this._transformRemotePermit(newRecord);
      console.log('[HybridStorageManager] Transformed permit:', permit);

      // Find existing permit index
      const existingIndex = appState.permits.findIndex(p => p.id === permit.id);

      if (existingIndex >= 0) {
        // Update existing
        appState.permits[existingIndex] = permit;
        console.log('[HybridStorageManager] Updated existing permit at index:', existingIndex);
      } else {
        // Add new permit at the beginning
        appState.permits.unshift(permit);
        console.log('[HybridStorageManager] Added new permit, total permits:', appState.permits.length);

        // Show local system and in-app alerts if this is a new pending permit request and user is Musyrif
        const currentRecipient = window.getNotificationRecipientInfo?.() || {};
        console.log('[HybridStorageManager] Current recipient:', currentRecipient);
        console.log('[HybridStorageManager] Checking conditions - type:', currentRecipient.type, 'status:', permit.status);

        if (eventType === 'INSERT' && currentRecipient.type === 'musyrif' && permit.status === 'pending') {
          const studentName = permit.nama || 'Santri';
          const categoryLabel = permit.category === 'sakit' ? 'Sakit' : permit.category === 'izin' ? 'Izin' : 'Pulang';

          console.log(`[HybridStorageManager] New permit request detected, showing notification for: ${studentName}`);

          if (typeof window.sendLocalNotification === 'function') {
            window.sendLocalNotification(
              "Pengajuan Izin Baru 📝",
              `Santri ${studentName} mengajukan ${categoryLabel}: ${permit.reason || ''}`,
              "permit"
            );
          }

          if (window.showToast) {
            window.showToast(`Izin Baru: ${studentName} mengajukan ${categoryLabel}`, 'info');
          }

          // Refresh approval widget and show banner
          this._refreshApprovalWidget();
        }

        // Also notify Wali if permit was approved/rejected
        if (currentRecipient.type === 'wali') {
          const studentNis = String(permit.nis || '').trim();
          if (studentNis === currentRecipient.id && (permit.status === 'approved' || permit.status === 'rejected')) {
            const studentName = permit.nama || 'Santri';
            const statusLabel = permit.status === 'approved' ? 'Disetujui' : 'Ditolak';
            if (typeof window.addNotification === 'function') {
              window.addNotification(
                'wali',
                studentNis,
                `Status Izin ${statusLabel} 📝`,
                `Pengajuan izin untuk ${studentName} telah ${statusLabel.toLowerCase()}.`,
                'permit',
                'tab=home'
              );
            }
          }
        }
      }

      // Save to localStorage
      localStorage.setItem('musyrif_permits_db', JSON.stringify(appState.permits));
    }

    if (eventType === 'DELETE') {
      const permitId = oldRecord.id;
      appState.permits = appState.permits.filter(p => p.id !== permitId);
      localStorage.setItem('musyrif_permits_db', JSON.stringify(appState.permits));
    }

    // Trigger UI refresh
    this._refreshUI('realtime');
  }

  _handleRealtimeTahfizhChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      this._mergeTahfizhData([newRecord]);
      
      // Notify Wali of new setoran verified or input by Musyrif
      const currentRecipient = window.getNotificationRecipientInfo?.() || {};
      if (eventType === 'INSERT' && currentRecipient.type === 'wali' && newRecord.status === 'Verified') {
        const studentNis = String(newRecord.santri_id || '');
        if (studentNis === currentRecipient.id) {
          const juzLabel = newRecord.juz ? `Juz ${newRecord.juz}` : '';
          const suratLabel = newRecord.surat ? `Surat ${newRecord.surat}` : '';
          const detail = [juzLabel, suratLabel].filter(Boolean).join(', ');
          
          if (typeof window.sendLocalNotification === 'function') {
            window.sendLocalNotification(
              "Setoran Tahfizh Masuk 📖",
              `Ananda ${newRecord.nama_santri} menyetorkan hafalan baru (${newRecord.jenis || 'Ziyadah'}): ${detail}`,
              "tahfizh"
            );
          }
          
          if (window.showToast) {
            window.showToast(`Setoran Baru: ${newRecord.nama_santri} - ${newRecord.jenis || 'Ziyadah'} ${detail}`, 'success');
          }
        }
      }
    }

    if (eventType === 'DELETE') {
      const recordId = oldRecord.id;
      try {
        const parts = recordId.split('_');
        if (parts.length >= 3) {
          const rowNumber = Number(parts[parts.length - 1]);
          const localSetoranStr = localStorage.getItem('tahfizh_local_setoran');
          if (localSetoranStr) {
            let list = JSON.parse(localSetoranStr);
            list = list.filter(r => r.rowNumber !== rowNumber);
            localStorage.setItem('tahfizh_local_setoran', JSON.stringify(list));
            if (typeof reloadTahfizhData === 'function') {
              reloadTahfizhData();
            }
          }
        }
      } catch (e) {
        console.warn('[HybridStorageManager] Failed to delete local tahfizh record:', e);
      }
    }
  }

  _mergeTahfizhData(cloudRecords) {
    if (!cloudRecords || cloudRecords.length === 0) return;

    try {
      const localSetoranStr = localStorage.getItem('tahfizh_local_setoran');
      let localRecords = localSetoranStr ? JSON.parse(localSetoranStr) : [];

      const getUniqueKey = (r) => {
        const sId = r.santriId || r.santri_id || r.nis || '';
        const rNum = r.rowNumber || r.row_number || 0;
        const kl = r.kelas || '';
        return `${kl}_${sId}_${rNum}`;
      };

      const localMap = new Map(localRecords.map(r => [getUniqueKey(r), r]));

      cloudRecords.forEach(cr => {
        const key = getUniqueKey(cr);
        const mappedRecord = {
          musyrif: cr.musyrif || '',
          namaSantri: cr.nama_santri || cr.namaSantri || '',
          santriId: cr.santri_id || cr.santriId || '',
          kelas: cr.kelas || '',
          program: cr.program || '',
          jenis: cr.jenis || '',
          juz: cr.juz || '',
          tanggal: cr.tanggal || '',
          kualitas: cr.kualitas || 'Lancar',
          status: cr.status || 'Verified',
          surat: cr.surat || '',
          halaman: cr.halaman || '',
          rowNumber: cr.row_number || cr.rowNumber || 0,
          synced: true
        };

        localMap.set(key, mappedRecord);
      });

      const merged = Array.from(localMap.values());
      merged.sort((a, b) => {
        const dateDiff = new Date(b.tanggal || 0) - new Date(a.tanggal || 0);
        if (dateDiff !== 0) return dateDiff;
        return (b.rowNumber || 0) - (a.rowNumber || 0);
      });

      localStorage.setItem('tahfizh_local_setoran', JSON.stringify(merged));
      console.log('[HybridStorageManager] Merged tahfizh data with local storage, count:', merged.length);

      if (typeof reloadTahfizhData === 'function') {
        reloadTahfizhData();
      }
    } catch (e) {
      console.warn('[HybridStorageManager] Failed to merge tahfizh data:', e);
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
          // Re-subscribe to realtime on successful auth
          if (this.supabaseConfigured && this.kelasId) {
            this._subscribeToRealtime();
          }
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
        // Re-subscribe to realtime after coming online
        if (this.supabaseConfigured && this.kelasId) {
          this._subscribeToRealtime();
        }
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
        if (typeof window.syncTahfizhToCloud === 'function') {
          window.syncTahfizhToCloud();
        }
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
    // Note: also trigger sync for wali mode since _processQueue() has its own wali bypass check
    const isWaliSubmit = typeof appState !== 'undefined' && appState.waliMode;
    if (this.isOnline && this.supabaseConfigured && (this.remote.isAuthenticated() || isWaliSubmit)) {
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
      destination: remote.location || remote.destination,
      pickup: remote.pickup,
      vehicle: remote.vehicle,
      status: remote.status,
      status_label: remote.status_label,
      is_active: remote.is_active,
      requires_surat_dokter: remote.requires_surat_dokter,
      surat_dokter: remote.document_url,
      audit_trail: remote.audit_trail || [],
      timestamp: remote.created_at,
      nama_wali: remote.nama_wali,
      alamat_wali: remote.alamat_wali,
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

    // Check authentication (bypass if in Wali mode, since unauthenticated inserts are allowed by anon RLS policy)
    const isWali = typeof appState !== 'undefined' && appState.waliMode;
    if (this.supabaseConfigured && !this.remote.isAuthenticated() && !isWali) {
      console.log('[HybridStorageManager] Not authenticated and not in Wali mode, skipping sync');
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
      // Skip metadata keys BUT include slot status metadata
      if (studentId.startsWith('_')) {
        // Sync slot metadata status (requires_review, review_confirmed, reviewed_at, reviewed_by)
        if (studentId === '__requiresReview' || studentId === '__reviewConfirmed' ||
            studentId === '__reviewedAt' || studentId === '__reviewedBy') {
          // These are slot-level metadata - we'll sync them with each record
          continue;
        }
        continue;
      }

      // Generate unique ID for each record
      const recordId = `${this.kelasId}_${studentId}_${dateKey}_${slotId}`.replace(/\s+/g, '_');

      // Get slot-level metadata from parent 'data' object
      const slotReviewConfirmed = data.__reviewConfirmed;
      const slotRequiresReview = data.__requiresReview;
      const slotReviewedAt = data.__reviewedAt;
      const slotReviewedBy = data.__reviewedBy;

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
        // Slot metadata
        requires_review: slotRequiresReview,
        review_confirmed: slotReviewConfirmed,
        reviewed_at: slotReviewedAt || null,
        reviewed_by: slotReviewedBy || null,
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

    // Resolve kelas UUID (CRITICAL: permit table kelas_id column is UUID type, not text)
    const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    let kelasId = this.kelasId || permit.kelas_id || permit.kelas || (typeof appState !== 'undefined' ? appState.waliKelas : null);

    if (kelasId && !isUuid(kelasId)) {
      // Step 1: Look up in MASTER_KELAS cache
      const classSource = window.classData || window.MASTER_KELAS;
      if (classSource) {
        const matched = Object.keys(classSource).find(k => k.replace(/\s+/g, '').toLowerCase() === String(kelasId).replace(/\s+/g, '').toLowerCase());
        if (matched && classSource[matched]) {
          const uuid = classSource[matched].supabaseId || classSource[matched].id;
          if (isUuid(uuid)) kelasId = uuid;
        }
      }

      // Step 2: If UUID still not resolved, use null for kelas_id
      // The permit will still be saved and can be queried by NIS (loadPermits fallback)
      if (!isUuid(kelasId)) {
        console.warn('[HybridStorageManager] _syncPermit: Cannot resolve UUID for kelas:', kelasId, '— will save with kelas_id=null');
        kelasId = null;
      }
    }

    // Store text kelas name for reference even when UUID is unavailable
    const kelasNama = this.kelasId || permit.kelas || permit.kelas_id || (typeof appState !== 'undefined' ? appState.waliKelas : null);

    // Transform to remote format
    const remotePermit = {
      id: permitId,
      kelas_id: isUuid(kelasId) ? kelasId : null,  // null if UUID not resolved (avoids FK violation)
      kelas_nama: typeof kelasNama === 'string' && !isUuid(kelasNama) ? kelasNama : null,
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
      location: permit.location || permit.destination,
      pickup: permit.pickup,
      vehicle: permit.vehicle,
      status: permit.status || 'pending',
      status_label: permit.status_label,
      is_active: permit.is_active !== false,
      requires_surat_dokter: permit.requires_surat_dokter || false,
      document_url: permit.surat_dokter || permit.document,
      audit_trail: permit.audit_trail || [],
      nama_wali: permit.nama_wali,
      alamat_wali: permit.alamat_wali,
    };

    console.log('[HybridStorageManager] _syncPermit: Upserting permit to Supabase:', permitId, 'kelas_id:', kelasId);
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
    this.unsubscribeRealtime();
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
