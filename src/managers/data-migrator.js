/**
 * DataMigrator - Migrate from LocalStorage to IndexedDB
 *
 * Fungsi:
 * - Migrate existing LocalStorage data to new IndexedDB schema
 * - Maintain backward compatibility
 * - Verify data integrity after migration
 *
 * MIGRATION PLAN:
 *
 * Phase 1: Migrate attendance data
 * Phase 2: Migrate permits data
 * Phase 3: Migrate settings
 * Phase 4: Migrate activity logs
 * Phase 5: Mark migration as complete
 */

class DataMigrator {
  constructor(localDB, repositories) {
    this.db = localDB;
    this.repos = repositories;
    this.migrationKey = 'musyrif_db_migration_v2';
  }

  /**
   * Check if migration is needed
   */
  async isMigrationNeeded() {
    const migrationVersion = await this.db.getMeta(this.migrationKey);
    return migrationVersion !== 'completed';
  }

  /**
   * Check if migration was done in this version
   */
  async isMigrationDone() {
    const migrationVersion = await this.db.getMeta(this.migrationKey);
    return migrationVersion === 'completed';
  }

  /**
   * Run full migration
   */
  async migrate() {
    console.log('[DataMigrator] Starting migration...');

    const results = {
      attendance: { success: 0, failed: 0 },
      permits: { success: 0, failed: 0 },
      settings: { success: 0, failed: 0 },
      activityLogs: { success: 0, failed: 0 },
    };

    try {
      // Phase 1: Migrate attendance data
      console.log('[DataMigrator] Phase 1: Migrating attendance data...');
      results.attendance = await this._migrateAttendance();

      // Phase 2: Migrate permits data
      console.log('[DataMigrator] Phase 2: Migrating permits data...');
      results.permits = await this._migratePermits();

      // Phase 3: Migrate settings
      console.log('[DataMigrator] Phase 3: Migrating settings...');
      results.settings = await this._migrateSettings();

      // Phase 4: Migrate activity logs
      console.log('[DataMigrator] Phase 4: Migrating activity logs...');
      results.activityLogs = await this._migrateActivityLogs();

      // Phase 5: Mark migration complete
      await this.db.setMeta(this.migrationKey, 'completed');
      await this.db.setMeta('migration_date', new Date().toISOString());

      console.log('[DataMigrator] Migration completed!', results);
      return { success: true, results };
    } catch (error) {
      console.error('[DataMigrator] Migration failed:', error);
      return { success: false, error, results };
    }
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
    const oldData = localStorage.getItem('musyrif_app_v5_fix');
    if (!oldData) {
      console.log('[DataMigrator] No old attendance data found');
      return result;
    }

    try {
      const attendanceData = JSON.parse(oldData);
      const records = [];

      // Get current class from storage or session
      const authData = localStorage.getItem('musyrif_google_session');
      let kelas = 'Unknown';
      if (authData) {
        try {
          const auth = JSON.parse(authData);
          kelas = auth.kelas || 'Unknown';
        } catch (e) {}
      }

      // Iterate through all dates
      for (const [date, slots] of Object.entries(attendanceData)) {
        // Iterate through all slots
        for (const [slot, students] of Object.entries(slots)) {
          // Iterate through all students
          for (const [studentId, data] of Object.entries(students)) {
            if (studentId.startsWith('_')) continue; // Skip meta fields

            records.push({
              id: `${date}_${slot}_${studentId}`,
              date,
              slot,
              studentId,
              kelas,
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
        console.log(`[DataMigrator] Migrated ${records.length} attendance records`);
      }
    } catch (error) {
      console.error('[DataMigrator] Attendance migration failed:', error);
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
    const oldData = localStorage.getItem('musyrif_permits_db');
    if (!oldData) {
      console.log('[DataMigrator] No old permits data found');
      return result;
    }

    try {
      let permits = JSON.parse(oldData);

      // Ensure it's an array
      if (!Array.isArray(permits)) {
        // If it's an object, convert to array
        permits = Object.values(permits);
      }

      // Get current class
      const authData = localStorage.getItem('musyrif_google_session');
      let kelas = 'Unknown';
      if (authData) {
        try {
          const auth = JSON.parse(authData);
          kelas = auth.kelas || 'Unknown';
        } catch (e) {}
      }

      const records = [];

      for (const permit of permits) {
        // Generate proper ID if missing
        const id = permit.id || `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        records.push({
          ...permit,
          id,
          kelas: permit.kelas || kelas,
          audit_trail: permit.audit_trail || [
            { action: 'migrated', at: new Date().toISOString() }
          ],
          _syncedAt: null,
        });
      }

      if (records.length > 0) {
        await this.db.bulkPut('permits', records);
        result.success = records.length;
        console.log(`[DataMigrator] Migrated ${records.length} permit records`);
      }
    } catch (error) {
      console.error('[DataMigrator] Permits migration failed:', error);
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
    const oldData = localStorage.getItem('musyrif_settings');
    if (!oldData) {
      console.log('[DataMigrator] No old settings data found');
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
      console.log('[DataMigrator] Migrated user settings');
    } catch (error) {
      console.error('[DataMigrator] Settings migration failed:', error);
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
    const oldData = localStorage.getItem('musyrif_activity_log');
    if (!oldData) {
      console.log('[DataMigrator] No old activity logs found');
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
        console.log(`[DataMigrator] Migrated ${records.length} activity log records`);
      }
    } catch (error) {
      console.error('[DataMigrator] Activity logs migration failed:', error);
      result.failed = -1;
    }

    return result;
  }

  /**
   * Rollback migration (delete all IndexedDB data)
   */
  async rollback() {
    console.log('[DataMigrator] Rolling back migration...');

    try {
      await this.db.clear('attendances');
      await this.db.clear('permits');
      await this.db.clear('settings');
      await this.db.clear('activity_logs');
      await this.db.clear('tahfizh');
      await this.db.clear('sync_queue');
      await this.db.clear('conflicts');

      await this.db.setMeta(this.migrationKey, null);

      console.log('[DataMigrator] Rollback completed');
      return { success: true };
    } catch (error) {
      console.error('[DataMigrator] Rollback failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Get migration status
   */
  async getStatus() {
    const migrationVersion = await this.db.getMeta(this.migrationKey);
    const migrationDate = await this.db.getMeta('migration_date');

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
   * Verify data integrity after migration
   */
  async verify() {
    const results = {
      attendance: { localCount: 0, indexedCount: 0, match: false },
      permits: { localCount: 0, indexedCount: 0, match: false },
      settings: { localCount: 0, indexedCount: 0, match: false },
    };

    // Count attendance
    const attendanceLocal = localStorage.getItem('musyrif_app_v5_fix');
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

    // Count permits
    const permitsLocal = localStorage.getItem('musyrif_permits_db');
    if (permitsLocal) {
      try {
        const data = JSON.parse(permitsLocal);
        results.permits.localCount = Array.isArray(data) ? data.length : Object.keys(data).length;
      } catch (e) {}
    }
    results.permits.indexedCount = await this.db.count('permits');
    results.permits.match = results.permits.localCount === results.permits.indexedCount;

    // Check settings
    const settingsLocal = localStorage.getItem('musyrif_settings');
    results.settings.localCount = settingsLocal ? 1 : 0;
    results.settings.indexedCount = await this.db.count('settings');
    results.settings.match = results.settings.localCount === results.settings.indexedCount;

    console.log('[DataMigrator] Verification results:', results);
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
      console.log('[CompatibilityLayer] Running migration...');
      const result = await migrator.migrate();

      if (!result.success) {
        console.error('[CompatibilityLayer] Migration failed:', result.error);
        // Continue with old storage if migration fails
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
  console.log('[Database] Initializing database system...');

  try {
    // 1. Initialize IndexedDB
    await localDB.init();
    console.log('[Database] IndexedDB initialized');

    // 2. Initialize repositories
    await initRepositories();
    const repos = getRepositories();
    console.log('[Database] Repositories initialized');

    // 3. Initialize compatibility layer with migration
    compatibilityLayer = new CompatibilityLayer(stateManager, repos);
    await compatibilityLayer.init();
    console.log('[Database] Compatibility layer initialized');

    // 4. Expose for debugging
    window._db = localDB;
    window._repos = repos;
    window._stateManager = stateManager;
    window._compatibility = compatibilityLayer;

    console.log('[Database] Database system ready!');
    return { localDB, repos, stateManager, compatibilityLayer };
  } catch (error) {
    console.error('[Database] Initialization failed:', error);
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

  console.log('[Database] Force re-migration...');

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

console.log('[DataMigrator] Module loaded');
