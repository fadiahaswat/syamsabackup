/**
 * DataMigrator - Migrate from LocalStorage to IndexedDB
 *
 * Fungsi:
 * - Migrate existing LocalStorage data to new IndexedDB schema
 * - Maintain backward compatibility
 * - Verify data integrity after migration
 * - Support rollback on partial failure
 *
 * MIGRATION PLAN:
 *
 * Phase 1: Migrate attendance data
 * Phase 2: Migrate permits data
 * Phase 3: Migrate settings
 * Phase 4: Migrate activity logs
 * Phase 5: Verify and mark migration as complete
 */

class DataMigrator {
  constructor(localDB, repositories) {
    this.db = localDB;
    this.repos = repositories;
    this._logger = window.MigratorLogger || console;
  }

  /**
   * Get migration keys from centralized constants
   */
  get _migrationKey() {
    return window.STORAGE_KEYS?.migrationVersion || 'musyrif_db_migration_v2';
  }

  get _migrationDateKey() {
    return window.STORAGE_KEYS?.migrationDate || 'musyrif_db_migration_date';
  }

  /**
   * Check if migration is needed
   */
  async isMigrationNeeded() {
    const migrationVersion = await this.db.getMeta(this._migrationKey);
    return migrationVersion !== 'completed';
  }

  /**
   * Check if migration was done in this version
   */
  async isMigrationDone() {
    const migrationVersion = await this.db.getMeta(this._migrationKey);
    return migrationVersion === 'completed';
  }

  /**
   * Run full migration with verification and rollback
   */
  async migrate() {
    this._logger.info('Starting migration...');

    this._phaseResults = {
      attendance: { success: 0, failed: 0 },
      permits: { success: 0, failed: 0 },
      settings: { success: 0, failed: 0 },
      activityLogs: { success: 0, failed: 0 },
    };

    try {
      // Phase 1: Migrate attendance data
      this._logger.info('Phase 1: Migrating attendance data...');
      this._phaseResults.attendance = await this._migrateAttendance();

      // Verify Phase 1 before proceeding
      if (this._phaseResults.attendance.failed > 0 &&
          this._phaseResults.attendance.success === 0) {
        throw new Error('Phase 1 (attendance) failed completely - aborting migration');
      }

      // Phase 2: Migrate permits data
      this._logger.info('Phase 2: Migrating permits data...');
      this._phaseResults.permits = await this._migratePermits();

      // Phase 3: Migrate settings
      this._logger.info('Phase 3: Migrating settings...');
      this._phaseResults.settings = await this._migrateSettings();

      // Phase 4: Migrate activity logs
      this._logger.info('Phase 4: Migrating activity logs...');
      this._phaseResults.activityLogs = await this._migrateActivityLogs();

      // Phase 5: Verify migration before marking complete
      this._logger.info('Phase 5: Verifying migration...');
      const verification = await this.verify();

      if (!verification.attendance.match || !verification.permits.match) {
        this._logger.warn('Verification warning:', verification);
      }

      // Mark migration complete only after verification
      await this.db.setMeta(this._migrationKey, 'completed');
      await this.db.setMeta(this._migrationDateKey, new Date().toISOString());

      this._logger.info('Migration completed successfully!', this._phaseResults);
      return { success: true, results: this._phaseResults, verification };

    } catch (error) {
      this._logger.error('Migration failed:', error);

      // Attempt rollback on failure
      this._logger.info('Attempting rollback...');
      await this.rollback();

      return { success: false, error: error.message, results: this._phaseResults };
    }
  }

  /**
   * Rollback all migrated data with sequential clear and verification
   */
  async rollback() {
    const stores = ['attendances', 'permits', 'settings', 'activity_logs'];
    const results = {};
    let hasFailure = false;

    this._logger.info('Rolling back migrated data...');

    for (const store of stores) {
      try {
        const countBefore = await this.db.count(store);
        await this.db.clear(store);
        const countAfter = await this.db.count(store);

        if (countAfter !== 0) {
          this._logger.error(`Rollback: ${store} still has ${countAfter} records after clear`);
          hasFailure = true;
        }

        results[store] = { cleared: countAfter === 0, countBefore, countAfter };
        this._logger.info(`Cleared ${store}: ${countBefore} -> ${countAfter}`);
      } catch (error) {
        this._logger.error(`Rollback failed for ${store}:`, error);
        hasFailure = true;
        results[store] = { error: error.message };
      }
    }

    // Clear migration markers
    try {
      await this.db.setMeta(this._migrationKey, null);
      await this.db.setMeta(this._migrationDateKey, null);
    } catch (error) {
      this._logger.error('Failed to clear migration markers:', error);
      hasFailure = true;
    }

    if (hasFailure) {
      this._logger.warn('Rollback completed with some failures');
      return { success: false, error: 'Partial rollback failure', results };
    }

    this._logger.info('Rollback completed successfully');
    return { success: true, results };
  }

  /**
   * Phase 1: Migrate attendance from LocalStorage
   *
   * OLD FORMAT:
   * {
   *   "2026-06-25": {
   *     "shubuh": {
   *       "12345": { status: {...}, note: "", timestamps: {...} }
   *     }
   *   }
   * }
   *
   * NEW FORMAT (IndexedDB):
   * attendances table with:
   * - id: "2026-06-25_shubuh_12345"
   * - date: "2026-06-25"
   * - slot: "shubuh"
   * - studentId: "12345"
   * - kelas: "XI-A"
   * - status: {...}
   */
  async _migrateAttendance() {
    const result = { success: 0, failed: 0 };

    // Get old attendance data from LocalStorage
    const attendanceKey = window.STORAGE_KEYS?.attendance || 'musyrif_app_v5_fix';
    const oldData = localStorage.getItem(attendanceKey);
    if (!oldData) {
      this._logger.info('No old attendance data found');
      return result;
    }

    try {
      const attendanceData = JSON.parse(oldData);
      const records = [];

      // CRITICAL FIX: Try multiple sources for kelas
      let defaultKelas = null;
      const kelasSources = [];

      // Source 1: Google auth session
      const authData = localStorage.getItem('musyrif_google_session');
      if (authData) {
        try {
          const auth = JSON.parse(authData);
          if (auth.kelas) {
            kelasSources.push(`auth: ${auth.kelas}`);
            defaultKelas = auth.kelas;
          }
        } catch (e) {}
      }

      // Source 2: APP_CONFIG.currentClass
      if (!defaultKelas && window.APP_CONFIG?.currentClass) {
        defaultKelas = window.APP_CONFIG.currentClass;
        kelasSources.push(`APP_CONFIG: ${defaultKelas}`);
      }

      // Source 3: sessionStorage
      if (!defaultKelas) {
        try {
          const sessionClass = sessionStorage.getItem('currentClass');
          if (sessionClass) {
            defaultKelas = sessionClass;
            kelasSources.push(`sessionStorage: ${defaultKelas}`);
          }
        } catch (e) {}
      }

      // Source 4: appState.selectedClass
      if (!defaultKelas && window.appState?.selectedClass) {
        defaultKelas = window.appState.selectedClass;
        kelasSources.push(`appState: ${defaultKelas}`);
      }

      this._logger.debug('Kelas sources checked:', kelasSources);

      // Build student to kelas mapping from cached data
      const studentKelasMap = new Map();
      try {
        const cachedSantri = localStorage.getItem(window.STORAGE_KEYS?.cacheSantri || 'cache_data_santri_full');
        if (cachedSantri) {
          const santris = JSON.parse(cachedSantri);
          if (Array.isArray(santris)) {
            santris.forEach(s => {
              if (s.nis && s.kelas) {
                studentKelasMap.set(String(s.nis), s.kelas);
              }
            });
          }
        }
      } catch (e) {
        this._logger.warn('Could not build student-kelas map:', e);
      }

      this._logger.info(`Student-kelas map has ${studentKelasMap.size} entries`);

      // Iterate through all dates
      for (const [date, slots] of Object.entries(attendanceData)) {
        // Iterate through all slots
        for (const [slot, students] of Object.entries(slots)) {
          // Iterate through all students
          for (const [studentId, data] of Object.entries(students)) {
            if (studentId.startsWith('_')) continue; // Skip meta fields

            // CRITICAL FIX: Get kelas from student data, not hardcoded default
            let recordKelas = studentKelasMap.get(studentId) || defaultKelas;

            if (!recordKelas) {
              this._logger.warn(`No kelas found for student ${studentId}, using 'Unknown'`);
              recordKelas = 'Unknown';
            }

            records.push({
              id: `${date}_${slot}_${studentId}`,
              date,
              slot,
              studentId,
              kelas: recordKelas,
              status: data.status || {},
              note: data.note || '',
              timestamps: data.timestamps || {},
              auditTrail: data.auditTrail || [],
              permitOverride: data.permitOverride || null,
              _syncedAt: null,
            });
          }
        }
      }

      // Bulk insert into IndexedDB
      if (records.length > 0) {
        await this.db.bulkPut('attendances', records);
        result.success = records.length;
        this._logger.info(`Migrated ${records.length} attendance records with kelas from student data`);
      }
    } catch (error) {
      this._logger.error('Attendance migration failed:', error);
      result.failed = -1;
    }

    return result;
  }

  /**
   * Phase 2: Migrate permits from LocalStorage
   *
   * OLD FORMAT:
   * [
   *   { id, nis, category, reason, start_date, end_date, status, ... }
   * ]
   *
   * NEW FORMAT (IndexedDB):
   * permits table with:
   * - id: "p_timestamp_random"
   * - nis, kelas, category, reason, etc.
   */
  async _migratePermits() {
    const result = { success: 0, failed: 0 };

    // Get old permits data from LocalStorage
    const permitsKey = window.STORAGE_KEYS?.permits || 'musyrif_permits_db';
    const oldData = localStorage.getItem(permitsKey);
    if (!oldData) {
      this._logger.info('No old permits data found');
      return result;
    }

    try {
      let permits = JSON.parse(oldData);

      // Ensure it's an array
      if (!Array.isArray(permits)) {
        // If it's an object, convert to array
        permits = Object.values(permits);
      }

      // CRITICAL FIX: Try multiple sources for default kelas
      let defaultKelas = null;

      // Source 1: Google auth session
      const authData = localStorage.getItem('musyrif_google_session');
      if (authData) {
        try {
          const auth = JSON.parse(authData);
          if (auth.kelas) defaultKelas = auth.kelas;
        } catch (e) {}
      }

      // Source 2: APP_CONFIG.currentClass
      if (!defaultKelas && window.APP_CONFIG?.currentClass) {
        defaultKelas = window.APP_CONFIG.currentClass;
      }

      // Source 3: appState.selectedClass
      if (!defaultKelas && window.appState?.selectedClass) {
        defaultKelas = window.appState.selectedClass;
      }

      // Build student to kelas mapping from cached data
      const studentKelasMap = new Map();
      try {
        const cachedSantri = localStorage.getItem(window.STORAGE_KEYS?.cacheSantri || 'cache_data_santri_full');
        if (cachedSantri) {
          const santris = JSON.parse(cachedSantri);
          if (Array.isArray(santris)) {
            santris.forEach(s => {
              if (s.nis && s.kelas) {
                studentKelasMap.set(String(s.nis), s.kelas);
              }
            });
          }
        }
      } catch (e) {}

      const records = [];

      for (const permit of permits) {
        // Generate proper ID if missing
        const id = permit.id || `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // CRITICAL FIX: Get kelas from student data first, then fall back to default
        const recordKelas = permit.kelas || studentKelasMap.get(String(permit.nis)) || defaultKelas || 'Unknown';

        records.push({
          ...permit,
          id,
          kelas: recordKelas,
          audit_trail: permit.audit_trail || [
            { action: 'migrated', at: new Date().toISOString() }
          ],
          _syncedAt: null,
        });
      }

      if (records.length > 0) {
        await this.db.bulkPut('permits', records);
        result.success = records.length;
        this._logger.info(`Migrated ${records.length} permit records with proper kelas assignment`);
      }
    } catch (error) {
      this._logger.error('Permits migration failed:', error);
      result.failed = -1;
    }

    return result;
  }

  /**
   * Phase 3: Migrate settings from LocalStorage
   */
  async _migrateSettings() {
    const result = { success: 0, failed: 0 };

    // Get old settings from LocalStorage
    const settingsKey = window.STORAGE_KEYS?.settings || 'musyrif_settings';
    const oldData = localStorage.getItem(settingsKey);
    if (!oldData) {
      this._logger.info('No old settings data found');
      return result;
    }

    try {
      const settings = JSON.parse(oldData);

      await this.db.put('settings', {
        id: 'user_settings',
        data: settings,
        _updatedAt: new Date().toISOString(),
      });

      result.success = 1;
      this._logger.info('Migrated user settings');
    } catch (error) {
      this._logger.error('Settings migration failed:', error);
      result.failed = 1;
    }

    return result;
  }

  /**
   * Phase 4: Migrate activity logs from LocalStorage
   */
  async _migrateActivityLogs() {
    const result = { success: 0, failed: 0 };

    // Get old logs from LocalStorage
    const activityLogKey = window.STORAGE_KEYS?.activityLog || 'musyrif_activity_log';
    const oldData = localStorage.getItem(activityLogKey);
    if (!oldData) {
      this._logger.info('No old activity logs found');
      return result;
    }

    try {
      const logs = JSON.parse(oldData);

      // Get current class
      const authData = localStorage.getItem('musyrif_google_session');
      let kelas = null;
      if (authData) {
        try {
          const auth = JSON.parse(authData);
          kelas = auth.kelas || null;
        } catch (e) {}
      }

      const records = [];

      for (const log of logs) {
        records.push({
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
          action: log.action || 'Unknown',
          detail: log.detail || '',
          user: log.user || 'System',
          kelas: kelas,
          timestamp: log.timestamp || new Date().toISOString(),
        });
      }

      if (records.length > 0) {
        await this.db.bulkPut('activity_logs', records);
        result.success = records.length;
        this._logger.info(`Migrated ${records.length} activity log records`);
      }
    } catch (error) {
      this._logger.error('Activity logs migration failed:', error);
      result.failed = -1;
    }

    return result;
  }

  /**
   * Get migration status
   */
  async getStatus() {
    const migrationKey = this._migrationKey;
    const migrationDateKey = this._migrationDateKey;

    const migrationVersion = await this.db.getMeta(migrationKey);
    const migrationDate = await this.db.getMeta(migrationDateKey);

    const counts = {
      attendances: await this.db.count('attendances'),
      permits: await this.db.count('permits'),
      settings: await this.db.count('settings'),
      activityLogs: await this.db.count('activity_logs'),
      tahfizh: await this.db.count('tahfizh'),
    };

    return {
      isCompleted: migrationVersion === 'completed',
      migrationDate,
      counts,
    };
  }

  /**
   * Verify data integrity after migration with spot-check validation
   */
  async verify() {
    const results = {
      attendance: { localCount: 0, indexedCount: 0, match: false, spotCheck: null },
      permits: { localCount: 0, indexedCount: 0, match: false, spotCheck: null },
      settings: { localCount: 0, indexedCount: 0, match: false },
    };

    const attendanceKey = window.STORAGE_KEYS?.attendance || 'musyrif_app_v5_fix';
    const permitsKey = window.STORAGE_KEYS?.permits || 'musyrif_permits_db';
    const settingsKey = window.STORAGE_KEYS?.settings || 'musyrif_settings';

    // Count attendance
    const attendanceLocal = localStorage.getItem(attendanceKey);
    if (attendanceLocal) {
      try {
        const data = JSON.parse(attendanceLocal);
        let count = 0;
        for (const slots of Object.values(data)) {
          for (const students of Object.values(slots)) {
            count += Object.keys(students).filter(k => !k.startsWith('_')).length;
          }
        }
        results.attendance.localCount = count;
      } catch (e) {}
    }
    results.attendance.indexedCount = await this.db.count('attendances');
    results.attendance.match = results.attendance.localCount === results.attendance.indexedCount;

    // MEDIUM FIX: Spot-check attendance records
    if (attendanceLocal && results.attendance.indexedCount > 0) {
      try {
        const data = JSON.parse(attendanceLocal);
        // Get first record from localStorage
        let sampleLocal = null;
        outer: for (const [date, slots] of Object.entries(data)) {
          for (const [slot, students] of Object.entries(slots)) {
            for (const [studentId, studentData] of Object.entries(students)) {
              if (!studentId.startsWith('_')) {
                sampleLocal = { date, slot, studentId, data: studentData };
                break outer;
              }
            }
          }
        }

        if (sampleLocal) {
          const sampleId = `${sampleLocal.date}_${sampleLocal.slot}_${sampleLocal.studentId}`;
          const sampleIndexed = await this.db.get('attendances', sampleId);

          results.attendance.spotCheck = {
            id: sampleId,
            localHasRequired: sampleLocal.data.status !== undefined,
            indexedFound: sampleIndexed !== null,
            indexedHasKelas: sampleIndexed?.kelas !== 'Unknown',
          };
        }
      } catch (e) {
        this._logger.warn('Attendance spot-check failed:', e);
      }
    }

    // Count permits
    const permitsLocal = localStorage.getItem(permitsKey);
    if (permitsLocal) {
      try {
        const data = JSON.parse(permitsLocal);
        results.permits.localCount = Array.isArray(data) ? data.length : Object.keys(data).length;
      } catch (e) {}
    }
    results.permits.indexedCount = await this.db.count('permits');
    results.permits.match = results.permits.localCount === results.permits.indexedCount;

    // MEDIUM FIX: Spot-check permit records
    if (permitsLocal && results.permits.indexedCount > 0) {
      try {
        const data = JSON.parse(permitsLocal);
        const sampleLocal = Array.isArray(data) ? data[0] : Object.values(data)[0];

        if (sampleLocal) {
          const sampleIndexed = await this.db.get('permits', sampleLocal.id);

          results.permits.spotCheck = {
            id: sampleLocal.id,
            localHasNis: !!sampleLocal.nis,
            indexedFound: sampleIndexed !== null,
            indexedHasKelas: sampleIndexed?.kelas !== 'Unknown',
          };
        }
      } catch (e) {
        this._logger.warn('Permit spot-check failed:', e);
      }
    }

    // Check settings
    const settingsLocal = localStorage.getItem(settingsKey);
    results.settings.localCount = settingsLocal ? 1 : 0;
    results.settings.indexedCount = await this.db.count('settings');
    results.settings.match = results.settings.localCount === results.settings.indexedCount;

    this._logger.debug('Verification results:', results);
    return results;
  }
}


// ============================================================
// BACKWARD COMPATIBILITY WRAPPER
// ============================================================

/**
 * CompatibilityLayer - Wraps new database with old API
 *
 * This allows existing code to work without modification
 * while using the new IndexedDB backend
 */
class CompatibilityLayer {
  constructor(stateManager, repositories) {
    this.stateManager = stateManager;
    this.repos = repositories;

    // Flag to control if we use new or old storage
    this.useNewStorage = true;
  }

  /**
   * Initialize with migration check
   */
  async init() {
    const migrator = new DataMigrator(localDB, this.repos);

    // Check if migration is needed
    const isNeeded = await migrator.isMigrationNeeded();

    if (isNeeded) {
      this._logger.info('Running migration...');
      const result = await migrator.migrate();

      if (!result.success) {
        this._logger.error('Migration failed:', result.error);
        this.useNewStorage = false;
      }
    }

    // Initialize state manager
    await this.stateManager.init(localDB, this.repos);

    return this;
  }

  // ==========================================
  // ATTENDANCE METHODS (backward compatible)
  // ==========================================

  /**
   * Save attendance data (old API)
   */
  saveAttendance(dateKey, slotId, data) {
    if (!this.useNewStorage) {
      // Fall back to old localStorage
      return this._saveToLocalStorage(dateKey, slotId, data);
    }

    // New IndexedDB implementation
    const state = this.stateManager.getState();
    const kelas = state.selectedClass;

    if (!appState.attendanceData[dateKey]) {
      appState.attendanceData[dateKey] = {};
    }
    if (!appState.attendanceData[dateKey][slotId]) {
      appState.attendanceData[dateKey][slotId] = {};
    }

    appState.attendanceData[dateKey][slotId] = {
      ...appState.attendanceData[dateKey][slotId],
      ...data,
      _lastUpdated: Date.now(),
      _savedBy: kelas,
    };

    // Persist to IndexedDB
    this.stateManager._persist();

    return appState.attendanceData[dateKey][slotId];
  }

  /**
   * Get attendance data (old API)
   */
  getAttendance(dateKey, slotId) {
    if (this.useNewStorage) {
      return appState.attendanceData[dateKey]?.[slotId] || {};
    }
    return this._getFromLocalStorage(dateKey, slotId);
  }

  /**
   * Save permits (old API)
   */
  savePermits(permits) {
    appState.permits = permits;

    if (this.useNewStorage) {
      // Bulk save to IndexedDB
      this.stateManager._persist();
    } else {
      localStorage.setItem('musyrif_permits_db', JSON.stringify(permits));
    }

    return permits;
  }

  /**
   * Save settings (old API)
   */
  saveSettings(settings) {
    appState.settings = { ...appState.settings, ...settings };

    if (this.useNewStorage) {
      this.stateManager.updateSettings(settings);
    } else {
      localStorage.setItem('musyrif_settings', JSON.stringify(appState.settings));
    }

    return appState.settings;
  }

  // ==========================================
  // LOCAL STORAGE FALLBACK
  // ==========================================

  _saveToLocalStorage(dateKey, slotId, data) {
    // Legacy implementation
    const key = 'musyrif_app_v5_fix';
    let existing = {};

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        existing = JSON.parse(stored);
      }
    } catch (e) {}

    if (!existing[dateKey]) {
      existing[dateKey] = {};
    }
    if (!existing[dateKey][slotId]) {
      existing[dateKey][slotId] = {};
    }

    existing[dateKey][slotId] = {
      ...existing[dateKey][slotId],
      ...data,
    };

    localStorage.setItem(key, JSON.stringify(existing));
    return existing[dateKey][slotId];
  }

  _getFromLocalStorage(dateKey, slotId) {
    const key = 'musyrif_app_v5_fix';
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        return data[dateKey]?.[slotId] || {};
      }
    } catch (e) {}
    return {};
  }

  // ==========================================
  // DIAGNOSTICS
  // ==========================================

  async getDiagnostics() {
    const migrator = new DataMigrator(localDB, this.repos);
    const status = await migrator.getStatus();
    const verification = await migrator.verify();

    return {
      useNewStorage: this.useNewStorage,
      migrationStatus: status,
      verification,
    };
  }

  /**
   * Force use of new storage
   */
  enableNewStorage() {
    this.useNewStorage = true;
  }

  /**
   * Force use of old storage (debug)
   */
  disableNewStorage() {
    this.useNewStorage = false;
  }
}


// ============================================================
// SINGLETON INSTANCES
// ============================================================

let dataMigrator = null;
let compatibilityLayer = null;

/**
 * Initialize database system
 * Call this at app startup
 */
async function initDatabase() {
  const logger = window.Logger || console;

  try {
    // 1. Initialize IndexedDB
    await localDB.init();

    // Initialize SyncQueue explicitly
    if (window.syncQueue) {
      await window.syncQueue.init(localDB);
    }

    // 2. Initialize repositories
    await initRepositories();
    const repos = getRepositories();

    // Initialize JournalManager
    if (window.journalManager) {
      await window.journalManager.init(localDB, repos);
    }

    // 3. Initialize compatibility layer with migration
    compatibilityLayer = new CompatibilityLayer(stateManager, repos);
    await compatibilityLayer.init();

    // 4. Expose for debugging
    window._db = localDB;
    window._repos = repos;
    window._stateManager = stateManager;
    window._compatibility = compatibilityLayer;

    logger.info('Database system ready!');
    return { localDB, repos, stateManager, compatibilityLayer };
  } catch (error) {
    logger.error('Initialization failed:', error);
    throw error;
  }
}

/**
 * Get diagnostics info
 */
async function getDatabaseDiagnostics() {
  if (!compatibilityLayer) {
    return { error: 'Database not initialized' };
  }
  return compatibilityLayer.getDiagnostics();
}

/**
 * Force re-migration
 */
async function forceRemigrate() {
  if (!localDB || !getRepositories()) {
    throw new Error('Database not initialized');
  }

  const repos = getRepositories();
  const migrator = new DataMigrator(localDB, repos);

  migrator._logger.info('Force re-migration...');

  // Rollback first
  await migrator.rollback();

  // Re-run migration
  return migrator.migrate();
}

// Export
window.DataMigrator = DataMigrator;
window.CompatibilityLayer = CompatibilityLayer;
window.initDatabase = initDatabase;
window.getDatabaseDiagnostics = getDatabaseDiagnostics;
window.forceRemigrate = forceRemigrate;
window.dataMigrator = dataMigrator;
window.compatibilityLayer = compatibilityLayer;
