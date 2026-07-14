/**
 * Storage Constants - Centralized storage key definitions
 *
 * LOW FIX: Consolidate storage keys to single source of truth
 * All storage keys should be imported from here, not hardcoded
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
  version: 1,
};

// ==========================================
// STORE NAMES (IndexedDB)
// ==========================================
const DB_STORES = {
  attendances: 'attendances',
  permits: 'permits',
  tahfizh: 'tahfizh',
  settings: 'settings',
  activityLogs: 'activity_logs',
  syncQueue: 'sync_queue',
  changes: 'changes',
  syncMetadata: 'sync_metadata',
  conflicts: 'conflicts',
  meta: 'meta',
};

// ==========================================
// INDEX NAMES
// ==========================================
const DB_INDEXES = {
  // Attendance indexes
  attendance: {
    date: 'date',
    slot: 'slot',
    studentId: 'studentId',
    kelas: 'kelas',
    dateSlot: 'date_slot',
    dateSlotKelas: 'date_slot_kelas',
    updatedAt: 'updatedAt',
    syncedAt: 'syncedAt',
  },
  // Permit indexes
  permit: {
    nis: 'nis',
    kelas: 'kelas',
    status: 'status',
    category: 'category',
    nisStart: 'nis_start',
    isActive: 'is_active',
    updatedAt: 'updatedAt',
  },
  // Tahfizh indexes
  tahfizh: {
    nis: 'nis',
    kelas: 'kelas',
    tanggal: 'tanggal',
    status: 'status',
    musyrif: 'musyrif',
    jenis: 'jenis',
    nisTanggal: 'nis_tanggal',
  },
  // Activity log indexes
  activityLog: {
    timestamp: 'timestamp',
    action: 'action',
    kelas: 'kelas',
    user: 'user',
  },
};

// ==========================================
// ID GENERATORS
// ==========================================

/**
 * Generate unique ID with prefix
 * LOW FIX: Consolidate ID generation to single function
 * @param {string} prefix - ID prefix (e.g., 'p', 't', 'log')
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
 * @returns {string} Composite ID
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
 * @returns {string} Tahfizh ID
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
    return { valid: errors.length === 0, errors };
  },

  tahfizh: (data) => {
    const errors = [];
    if (!data.id) errors.push('id required');
    if (!data.nis) errors.push('nis required');
    if (!data.musyrif) errors.push('musyrif required');
    return { valid: errors.length === 0, errors };
  },

  activityLog: (data) => {
    const errors = [];
    if (!data.id) errors.push('id required');
    if (!data.action) errors.push('action required');
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

// Make available globally
window.STORAGE_KEYS = STORAGE_KEYS;
window.DB_CONFIG = DB_CONFIG;
window.DB_STORES = DB_STORES;
window.DB_INDEXES = DB_INDEXES;
window.generateId = generateId;
window.generateAttendanceId = generateAttendanceId;
window.generatePermitId = generatePermitId;
window.generateTahfizhId = generateTahfizhId;
window.generateLogId = generateLogId;
window.VALIDATORS = VALIDATORS;

// Also export as ES module if supported
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
    VALIDATORS,
  };
}

console.log('[StorageConstants] Module loaded');
