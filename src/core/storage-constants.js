/**
 * Storage Constants - Centralized storage key definitions and ID generators
 *
 * All storage keys and ID generators should be imported from here, not hardcoded.
 * Uses snake_case for IndexedDB schema consistency.
 */

// ==========================================
// LOCALSTORAGE KEYS
// ==========================================
const STORAGE_KEYS = {
  // Primary data
  attendance: 'musyrif_app_v5_fix',
  permits: 'musyrif_permits_db',
  settings: 'musyrif_settings',
  activityLog: 'musyrif_activity_log',

  // Auth & Session
  googleSession: 'musyrif_google_session',

  // Cache
  cacheSantri: 'cache_data_santri_full',
  cacheKelas: 'cache_data_kelas',

  // Config
  gpsConfig: 'syamsa_gps_config',

  // Violations
  violations: 'musyrif_violations_db',

  // Student targets
  studentTargets: 'musyrif_student_targets',

  // Debug
  debugLogs: 'DEBUG_LOGS',

  // Migration
  migrationVersion: 'musyrif_db_migration_v2',
  migrationDate: 'musyrif_db_migration_date',
};

// ==========================================
// INDEXEDDB CONFIG
// ==========================================
const DB_CONFIG = {
  name: 'musyrif_local_db',
  version: 2,
};

// ==========================================
// STORE NAMES (IndexedDB) - snake_case
// ==========================================
const DB_STORES = {
  attendances: 'attendances',
  permits: 'permits',
  tahfizh: 'tahfizh',
  settings: 'settings',
  activity_logs: 'activity_logs',
  sync_queue: 'sync_queue',
  sync_metadata: 'sync_metadata',
  conflicts: 'conflicts',
  meta: 'meta',
  musyrif_journals: 'musyrif_journals',
};

// ==========================================
// INDEX NAMES (snake_case for schema)
// ==========================================
const DB_INDEXES = {
  // Attendance indexes
  attendance: {
    date: 'date',
    slot: 'slot',
    student_id: 'studentId',
    kelas: 'kelas',
    date_slot: 'date_slot',
    date_slot_kelas: 'date_slot_kelas',
    updated_at: 'updatedAt',
    synced_at: 'syncedAt',
  },
  // Permit indexes
  permit: {
    nis: 'nis',
    kelas: 'kelas',
    status: 'status',
    category: 'category',
    nis_start: 'nis_start',
    is_active: 'is_active',
    updated_at: 'updatedAt',
  },
  // Tahfizh indexes
  tahfizh: {
    nis: 'nis',
    kelas: 'kelas',
    tanggal: 'tanggal',
    status: 'status',
    musyrif: 'musyrif',
    jenis: 'jenis',
  },
  // Activity log indexes
  activity_log: {
    timestamp: 'timestamp',
    action: 'action',
    kelas: 'kelas',
    user: 'user',
  },
  // Sync queue indexes
  sync_queue: {
    status: 'status',
    entity_type: 'entity_type',
    entity_id: 'entity_id',
    timestamp: 'timestamp',
    priority: 'priority',
  },
};

// ==========================================
// CENTRALIZED ID GENERATORS
// ==========================================

/**
 * Generate unique ID with timestamp and random suffix
 * @param {string} prefix - ID prefix (e.g., 'p', 't', 'log', 'sync')
 * @returns {string} Generated ID
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Generate attendance composite ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} slot - Slot ID
 * @param {string} studentId - Student NIS
 * @returns {string} Composite ID: {date}_{slot}_{studentId}
 */
function generateAttendanceId(date, slot, studentId) {
  return `${date}_${slot}_${studentId}`;
}

/**
 * Generate permit ID
 * @returns {string} Permit ID with 'p_' prefix
 */
function generatePermitId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Generate tahfizh ID
 * @param {string} kelas - Class name
 * @param {string} nis - Student NIS
 * @param {string|number} rowNumber - Row number
 * @returns {string} Tahfizh ID: t_{kelas}_{nis}_{rowNumber}
 */
function generateTahfizhId(kelas, nis, rowNumber = null) {
  const suffix = rowNumber || Date.now().toString(36);
  return `t_${kelas}_${nis}_${suffix}`;
}

/**
 * Generate activity log ID
 * @returns {string} Log ID with 'log_' prefix
 */
function generateLogId() {
  return 'log_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

/**
 * Generate sync queue ID
 * @returns {string} Sync ID with 'sync_' prefix
 */
function generateSyncId() {
  return 'sync_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

/**
 * Generate conflict ID
 * @returns {string} Conflict ID with 'conflict_' prefix
 */
function generateConflictId() {
  return 'conflict_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

/**
 * Generate UUID v4 compatible string
 * @returns {string} UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==========================================
// SCHEMA VALIDATORS
// ==========================================

const VALIDATORS = {
  attendance: (data) => {
    const errors = [];
    if (!data.id && !(data.date && data.slot && data.studentId)) {
      errors.push('id or (date, slot, studentId) required');
    }
    if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      errors.push('date must be YYYY-MM-DD format');
    }
    if (data.studentId && typeof data.studentId !== 'string') {
      errors.push('studentId must be string');
    }
    if (data.note && data.note.length > 5000) {
      errors.push('note exceeds max length of 5000');
    }
    return { valid: errors.length === 0, errors };
  },

  permit: (data) => {
    const errors = [];
    if (!data.id) errors.push('id required');
    if (!data.nis) errors.push('nis required');
    if (!data.category) errors.push('category required');
    if (data.category && !['sakit', 'izin', 'pulang'].includes(data.category)) {
      errors.push('category must be sakit, izin, or pulang');
    }
    if (data.status && !['pending', 'approved', 'rejected'].includes(data.status)) {
      errors.push('status must be pending, approved, or rejected');
    }
    if (data.reason && data.reason.length > 10000) {
      errors.push('reason exceeds max length of 10000');
    }
    if (data.document && data.document.length > 5 * 1024 * 1024) {
      errors.push('document exceeds max size of 5MB');
    }
    return { valid: errors.length === 0, errors };
  },

  tahfizh: (data) => {
    const errors = [];
    if (!data.id) errors.push('id required');
    if (!data.nis) errors.push('nis required');
    if (!data.musyrif) errors.push('musyrif required');
    if (data.halaman && data.halaman.length > 50) {
      errors.push('halaman exceeds max length of 50');
    }
    return { valid: errors.length === 0, errors };
  },

  activityLog: (data) => {
    const errors = [];
    if (!data.id) errors.push('id required');
    if (!data.action) errors.push('action required');
    if (data.detail && data.detail.length > 10000) {
      errors.push('detail exceeds max length of 10000');
    }
    return { valid: errors.length === 0, errors };
  },

  settings: (data) => {
    const errors = [];
    if (!data.id) errors.push('id required');
    return { valid: errors.length === 0, errors };
  },
};

// ==========================================
// EXPORTS
// ==========================================

window.STORAGE_KEYS = STORAGE_KEYS;
window.DB_CONFIG = DB_CONFIG;
window.DB_STORES = DB_STORES;
window.DB_INDEXES = DB_INDEXES;
window.generateId = generateId;
window.generateAttendanceId = generateAttendanceId;
window.generatePermitId = generatePermitId;
window.generateTahfizhId = generateTahfizhId;
window.generateLogId = generateLogId;
window.generateSyncId = generateSyncId;
window.generateConflictId = generateConflictId;
window.generateUUID = generateUUID;
window.VALIDATORS = VALIDATORS;

// ES module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STORAGE_KEYS,
    DB_CONFIG,
    DB_STORES,
    DB_INDEXES,
    generateId,
    generateAttendanceId,
    generatePermitId,
    generateTahfizhId,
    generateLogId,
    generateSyncId,
    generateConflictId,
    generateUUID,
    VALIDATORS,
  };
}
