/**
 * CloudDomainStore
 *
 * Compatibility bridge for business domains that historically wrote directly
 * to LocalStorage. Supabase `app_records` is authoritative; LocalStorage is a
 * device cache used by legacy UI code until each manager is fully repository-
 * based.
 */
(function () {
  const DOMAIN_KEYS = [
    { pattern: /^local_announcements$/, type: 'announcement' },
    { pattern: /^musyrif_violations_db$/, type: 'violation' },
    { pattern: /^syamsa_violation_rules$/, type: 'violation_rule' },
    { pattern: /^musyrif_student_targets$/, type: 'student_target' },
    { pattern: /student_logs/i, type: 'student_log' },
    { pattern: /reminder/i, type: 'reminder' },
    { pattern: /permit_requests?/i, type: 'permit_request' },
    { pattern: /musyrif_sp_docs|sp_documents|disciplinary/i, type: 'disciplinary_document' },
    { pattern: /custom_holidays|holiday_countdown/i, type: 'holiday_schedule' },
    { pattern: /notification/i, type: 'notification' },
    { pattern: /^syamsa_gps_config$/, type: 'gps_config' },
    { pattern: /^tahfizh_local_(setoran|metadata)$/, type: 'tahfizh_snapshot' },
  ];

  class CloudDomainStore {
    constructor() {
      this.client = null;
      this.userId = null;
      this.versions = new Map();
      this.snapshots = new Map();
      this.remoteStorageKeys = new Set();
      this.timer = null;
      this.isApplyingCloud = false;
      this.isScanning = false;
      this.refreshTimer = null;
    }

    async init(client, userId) {
      if (!client || !userId || this.timer) return;
      this.client = client;
      this.userId = userId;
      // Legacy password hashes must never remain in browser storage.
      localStorage.removeItem('wali_passwords_db');
      await this.pull();
      await this.migrateLocalOnlyKeys();
      this.captureSnapshots();
      this.timer = setInterval(() => this.scan().catch(error => {
        window.Logger?.error?.('CloudDomainStore', error);
      }), 1500);

      window.addEventListener('cloud:record-changed', event => {
        if (event.detail?.table === 'app_records') this.applyCloudRecord(event.detail.record);
      });
      window.addEventListener('cloud:record-deleted', event => {
        if (event.detail?.table === 'app_records') this.applyCloudDelete(event.detail.record);
      });
    }

    resolveDomain(key) {
      return DOMAIN_KEYS.find(item => item.pattern.test(key)) || null;
    }

    getTrackedKeys() {
      return Object.keys(localStorage).filter(key => this.resolveDomain(key));
    }

    getScope() {
      const state = typeof appState !== 'undefined' ? appState : null;
      const kelas = state?.selectedClass || null;
      const nis = state?.waliSantri?.nis || state?.userProfile?.nis || null;
      return { kelas, nis };
    }

    makeId(key) {
      const { kelas, nis } = this.getScope();
      const input = `${key}|${kelas || '*'}|${nis || '*'}`;
      let hash = 2166136261;
      for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return `legacy_${(hash >>> 0).toString(16)}`;
    }

    captureSnapshots() {
      this.getTrackedKeys().forEach(key => this.snapshots.set(key, localStorage.getItem(key)));
    }

    async pull() {
      const { data, error } = await this.client
        .from('app_records')
        .select('*')
        .is('deleted_at', null);
      if (error) throw error;
      (data || []).forEach(record => this.applyCloudRecord(record));
    }

    async migrateLocalOnlyKeys() {
      if (!navigator.onLine) return;
      for (const key of this.getTrackedKeys()) {
        if (!this.remoteStorageKeys.has(key)) {
          await this.pushKey(key, localStorage.getItem(key));
        }
      }
    }

    async scan() {
      if (this.isScanning || this.isApplyingCloud || !navigator.onLine) return;
      const { data: sessionData } = await this.client.auth.getSession();
      if (!sessionData?.session) return;

      this.isScanning = true;
      try {
        for (const key of this.getTrackedKeys()) {
          const current = localStorage.getItem(key);
          if (this.snapshots.get(key) === current) continue;
          await this.pushKey(key, current);
          this.snapshots.set(key, current);
        }
      } finally {
        this.isScanning = false;
      }
    }

    async pushKey(key, rawValue) {
      const domain = this.resolveDomain(key);
      if (!domain) return;
      const id = this.makeId(key);
      const scope = this.getScope();
      let value = rawValue;
      try { value = JSON.parse(rawValue); } catch { /* keep string */ }

      const payload = {
        id,
        entity_type: domain.type,
        kelas: scope.kelas,
        nis: scope.nis,
        owner_user_id: this.userId,
        data: { storageKey: key, value },
        _version: (this.versions.get(id) || 0) + 1,
        deleted_at: null,
      };

      const baseVersion = this.versions.get(id) || 0;
      const saved = window.supabaseSync?._writeCloudRecord
        ? await window.supabaseSync._writeCloudRecord('app_records', payload, baseVersion)
        : await this.fallbackWrite(payload, baseVersion);
      this.versions.set(id, Number(saved?._version || payload._version));
    }

    async fallbackWrite(payload, baseVersion) {
      if (baseVersion === 0) {
        const { data, error } = await this.client.from('app_records').insert(payload).select().single();
        if (error) throw error;
        return data;
      }
      const updatePayload = { ...payload };
      delete updatePayload._version;
      const { data, error } = await this.client
        .from('app_records')
        .update(updatePayload)
        .eq('id', payload.id)
        .eq('_version', baseVersion)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    applyCloudRecord(record) {
      const key = record?.data?.storageKey;
      if (!key || !this.resolveDomain(key) || record.deleted_at) return;
      this.remoteStorageKeys.add(key);
      this.versions.set(record.id, Number(record._version || 1));
      const raw = typeof record.data.value === 'string'
        ? record.data.value
        : JSON.stringify(record.data.value);

      this.isApplyingCloud = true;
      try {
        localStorage.setItem(key, raw);
        this.snapshots.set(key, raw);
      } finally {
        this.isApplyingCloud = false;
      }
      window.dispatchEvent(new CustomEvent('cloud:legacy-cache-updated', {
        detail: { key, value: record.data.value }
      }));
      this.applyToRuntimeState(key, record.data.value);
    }

    applyCloudDelete(record) {
      const key = record?.data?.storageKey;
      if (!key || !this.resolveDomain(key)) return;
      this.isApplyingCloud = true;
      try {
        localStorage.removeItem(key);
        this.snapshots.delete(key);
        this.versions.delete(record.id);
        this.remoteStorageKeys.delete(key);
      } finally {
        this.isApplyingCloud = false;
      }
      this.applyToRuntimeState(key, null);
    }

    applyToRuntimeState(key, value) {
      const state = typeof appState !== 'undefined' ? appState : null;
      if (state) {
        if (key === 'musyrif_violations_db') state.violations = Array.isArray(value) ? value : [];
        if (key === 'musyrif_student_targets') state.studentTargets = value || {};
        const config = typeof APP_CONFIG !== 'undefined' ? APP_CONFIG : {};
        if (key === config.studentLogsKey) state.studentLogs = Array.isArray(value) ? value : [];
        if (key === config.remindersKey) state.reminders = Array.isArray(value) ? value : [];
        if (key === 'tahfizh_local_setoran') state.tahfizhSetoran = Array.isArray(value) ? value : [];
      }

      clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => {
        window.updateDashboard?.();
        window.refreshPermitSurfaces?.();
        window.renderAdminData?.();
        window.renderTahfizhDashboard?.();
      }, 100);
    }
  }

  window.cloudDomainStore = new CloudDomainStore();
})();
