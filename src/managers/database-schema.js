/**
 * LocalDB - IndexedDB-based Local Database
 *
 * Single Source of Truth using IndexedDB
 * Features: CRUD, Versioning, Conflict Detection, Migration Support
 *
 * SCHEMA:
 *
 * stores/attendances
 * ├── id: string (composite: {date}_{slot}_{studentId})
 * ├── date: string (YYYY-MM-DD)
 * ├── slot: string (shubuh|sekolah|ashar|maghrib|isya)
 * ├── studentId: string (NIS)
 * ├── kelas: string
 * ├── status: object { activityId: status }
 * ├── note: string
 * ├── timestamps: object { activityId: ISO8601 }
 * ├── auditTrail: array
 * ├── _version: number
 * ├── _createdAt: ISO8601
 * ├── _updatedAt: ISO8601
 * ├── _syncedAt: ISO8601 | null
 * └── indexes: [date, slot, studentId, kelas, [date+slot], [date+slot+kelas]]
 *
 * stores/permits
 * ├── id: string (UUID)
 * ├── nis: string
 * ├── kelas: string
 * ├── category: string (sakit|izin|pulang)
 * ├── reason: string
 * ├── start_date: string (YYYY-MM-DD)
 * ├── end_date: string (YYYY-MM-DD) | null
 * ├── start_session: string
 * ├── end_session: string | null
 * ├── status: string (pending|approved|rejected)
 * ├── is_active: boolean
 * ├── document: base64 | null
 * ├── audit_trail: array
 * ├── _version: number
 * ├── _createdAt: ISO8601
 * ├── _updatedAt: ISO8601
 * ├── _syncedAt: ISO8601 | null
 * └── indexes: [nis, kelas, status, category, [nis+start_date]]
 *
 * stores/tahfizh
 * ├── id: string (UUID)
 * ├── nis: string
 * ├── kelas: string
 * ├── program: string
 * ├── jenis: string (Ziyadah|Murojaah)
 * ├── juz: string
 * ├── halaman: string
 * ├── surat: string
 * ├── kualitas: string
 * ├── status: string (Pending|Verified|Rejected)
 * ├── musyrif: string
 * ├── tanggal: string (YYYY-MM-DD)
 * ├── _version: number
 * ├── _createdAt: ISO8601
 * ├── _updatedAt: ISO8601
 * ├── _syncedAt: ISO8601 | null
 * └── indexes: [nis, kelas, tanggal, status, musyrif]
 *
 * stores/settings
 * ├── id: string (user_settings|kelas_settings)
 * ├── data: object (JSON)
 * ├── _version: number
 * ├── _updatedAt: ISO8601
 * └── indexes: [id]
 *
 * stores/activity_logs
 * ├── id: string (UUID)
 * ├── action: string
 * ├── detail: string
 * ├── user: string
 * ├── kelas: string | null
 * ├── timestamp: ISO8601
 * └── indexes: [timestamp, action, kelas]
 *
 * stores/sync_queue (for cloud sync)
 * ├── id: string (UUID)
 * ├── entity_type: string
 * ├── entity_id: string
 * ├── operation: string (create|update|delete)
 * ├── payload: object
 * ├── status: string (pending|synced|failed|conflict)
 * ├── attempts: number
 * ├── last_error: string | null
 * ├── priority: number (1-10)
 * ├── timestamp: number
 * └── indexes: [status, entity_type, timestamp, priority]
 *
 * stores/conflicts
 * ├── id: string (UUID)
 * ├── entity_type: string
 * ├── entity_id: string
 * ├── local_data: object
 * ├── server_data: object
 * ├── created_at: ISO8601
 * ├── resolved: boolean
 * └── resolution: string | null
 */

const DB_NAME = window.DB_CONFIG?.name || 'musyrif_local_db';
const DB_VERSION = window.DB_CONFIG?.version || 1;

// ==========================================
// VALIDATION CONSTANTS
// ==========================================
const DB_VALIDATION = {
  MAX_STRING_LENGTH: 10000,
  MAX_NOTE_LENGTH: 5000,
  MAX_DOCUMENT_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_ARRAY_ITEMS: 1000,
};

class LocalDB {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.isInitializing = false;
    this.readyPromise = null;
    this.isSyncing = false;
    this._logger = window.LocalDBLogger || console;
  }

  /**
   * Initialize database - Call once at app start
   */
  async init() {
    if (this.isReady) return this.db;
    if (this.isInitializing) return this.readyPromise;

    this.isInitializing = true;
    this.readyPromise = this._initDatabase();

    try {
      this.db = await this.readyPromise;
      this.isReady = true;
      this._logger.info('Database initialized successfully');
      return this.db;
    } catch (error) {
      this._logger.error('Failed to initialize database:', error);
      this._handleInitError(error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Handle initialization errors gracefully
   */
  _handleInitError(error) {
    if (error.name === 'QuotaExceededError') {
      this._logger.error('Storage quota exceeded!');
      window.showToast?.('Storage hampir penuh! Hapus data lama untuk melanjutkan.', 'error');
    } else if (error.name === 'VersionError') {
      this._logger.error('Database version error - may need to clear old data');
      this._offerClearOldData();
    } else if (error.name === 'NotAllowedError') {
      this._logger.error('IndexedDB not allowed - check browser settings');
      window.showToast?.('IndexedDB tidak tersedia. Gunakan browser lain.', 'error');
    }
  }

  /**
   * Offer to clear old database data
   */
  _offerClearOldData() {
    const msg = 'Database lama perlu dihapus untuk upgrade. Lanjutkan?';
    if (typeof window !== 'undefined' && window.confirm?.(msg)) {
      this._clearOldDatabase().then(() => {
        window.location.reload();
      });
    }
  }

  /**
   * Clear old database
   */
  async _clearOldDatabase() {
    return new Promise((resolve, reject) => {
      const deleteReq = indexedDB.deleteDatabase(DB_NAME);
      deleteReq.onsuccess = () => {
        this._logger.info('Old database cleared');
        resolve();
      };
      deleteReq.onerror = () => reject(deleteReq.error);
    });
  }

  /**
   * Internal init - creates database and stores
   */
  _initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this._logger.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onblocked = () => {
        this._logger.warn('Database blocked - another tab may have it open');
        window.showToast?.('Buka tab lain yang menggunakan aplikasi ini terlebih dahulu.', 'warning');
      };

      request.onsuccess = () => {
        const db = request.result;

        db.onversionchange = () => {
          this._logger.info('Database version change detected - reloading...');
          window.location.reload();
        };

        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this._logger.info('Upgrading database to version', event.newVersion);
        this._createStores(db);
      };
    });
  }

  /**
   * Create all stores with indexes
   */
  _createStores(db) {
    // ==========================================
    // STORE: attendances
    // ==========================================
    if (!db.objectStoreNames.contains('attendances')) {
      const store = db.createObjectStore('attendances', { keyPath: 'id' });

      store.createIndex('date', 'date', { unique: false });
      store.createIndex('slot', 'slot', { unique: false });
      store.createIndex('studentId', 'studentId', { unique: false });
      store.createIndex('kelas', 'kelas', { unique: false });
      store.createIndex('date_slot', ['date', 'slot'], { unique: false });
      store.createIndex('date_slot_kelas', ['date', 'slot', 'kelas'], { unique: false });
      store.createIndex('updatedAt', '_updatedAt', { unique: false });
      store.createIndex('syncedAt', '_syncedAt', { unique: false });

      this._logger.info('Created store: attendances');
    }

    // ==========================================
    // STORE: permits
    // ==========================================
    if (!db.objectStoreNames.contains('permits')) {
      const store = db.createObjectStore('permits', { keyPath: 'id' });

      store.createIndex('nis', 'nis', { unique: false });
      store.createIndex('kelas', 'kelas', { unique: false });
      store.createIndex('status', 'status', { unique: false });
      store.createIndex('category', 'category', { unique: false });
      store.createIndex('nis_start', ['nis', 'start_date'], { unique: false });
      store.createIndex('is_active', 'is_active', { unique: false });
      store.createIndex('updatedAt', '_updatedAt', { unique: false });

      this._logger.info('Created store: permits');
    }

    // ==========================================
    // STORE: tahfizh
    // ==========================================
    if (!db.objectStoreNames.contains('tahfizh')) {
      const store = db.createObjectStore('tahfizh', { keyPath: 'id' });

      store.createIndex('nis', 'nis', { unique: false });
      store.createIndex('kelas', 'kelas', { unique: false });
      store.createIndex('tanggal', 'tanggal', { unique: false });
      store.createIndex('status', 'status', { unique: false });
      store.createIndex('musyrif', 'musyrif', { unique: false });
      store.createIndex('jenis', 'jenis', { unique: false });

      // Note: nis_tanggal composite index removed (not used in queries)

      this._logger.info('Created store: tahfizh');
    }

    // ==========================================
    // STORE: settings
    // ==========================================
    if (!db.objectStoreNames.contains('settings')) {
      const store = db.createObjectStore('settings', { keyPath: 'id' });
      store.createIndex('updatedAt', '_updatedAt', { unique: false });
      this._logger.info('Created store: settings');
    }

    // ==========================================
    // STORE: activity_logs
    // ==========================================
    if (!db.objectStoreNames.contains('activity_logs')) {
      const store = db.createObjectStore('activity_logs', { keyPath: 'id' });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('action', 'action', { unique: false });
      store.createIndex('kelas', 'kelas', { unique: false });
      store.createIndex('user', 'user', { unique: false });
      store.createIndex('timestamp_idx', 'timestamp', { unique: false });

      this._logger.info('Created store: activity_logs');
    }

    // ==========================================
    // STORE: sync_queue (snake_case for schema consistency)
    // ==========================================
    if (!db.objectStoreNames.contains('sync_queue')) {
      const store = db.createObjectStore('sync_queue', { keyPath: 'id' });

      store.createIndex('status', 'status', { unique: false });
      store.createIndex('entity_type', 'entity_type', { unique: false });
      store.createIndex('entity_id', 'entity_id', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('priority', 'priority', { unique: false });
      store.createIndex('status_priority', ['status', 'priority'], { unique: false });

      this._logger.info('Created store: sync_queue');
    }

    // ==========================================
    // STORE: sync_metadata (for sync state)
    // ==========================================
    if (!db.objectStoreNames.contains('sync_metadata')) {
      const store = db.createObjectStore('sync_metadata', { keyPath: 'key' });
      store.createIndex('lastSync', 'lastSync', { unique: false });
      this._logger.info('Created store: sync_metadata');
    }

    // ==========================================
    // STORE: conflicts (for cloud sync)
    // ==========================================
    if (!db.objectStoreNames.contains('conflicts')) {
      const store = db.createObjectStore('conflicts', { keyPath: 'id' });
      store.createIndex('entity_type', 'entity_type', { unique: false });
      store.createIndex('entity_id', 'entity_id', { unique: false });
      store.createIndex('resolved', 'resolved', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });

      this._logger.info('Created store: conflicts');
    }

    // ==========================================
    // STORE: meta (database metadata)
    // ==========================================
    if (!db.objectStoreNames.contains('meta')) {
      const store = db.createObjectStore('meta', { keyPath: 'key' });

      store.put({
        key: 'schema_version',
        value: DB_VERSION,
        _updatedAt: new Date().toISOString()
      });
      store.put({
        key: 'last_cleanup',
        value: Date.now(),
        _updatedAt: new Date().toISOString()
      });

      this._logger.info('Created store: meta');
    }

    // ==========================================
    // STORE: musyrif_journals
    // ==========================================
    if (!db.objectStoreNames.contains('musyrif_journals')) {
      const store = db.createObjectStore('musyrif_journals', { keyPath: 'id' });

      store.createIndex('date', 'date', { unique: false });
      store.createIndex('status', 'status', { unique: false });
      store.createIndex('musyrifId', 'musyrifId', { unique: false });
      store.createIndex('date_musyrif', ['date', 'musyrifId'], { unique: false });

      this._logger.info('Created store: musyrif_journals');
    }

    this._logger.info('All stores created successfully');
  }

  /**
   * Ensure database is ready before any operation
   */
  async ensureReady() {
    if (this.isReady && this.db) return this.db;
    return this.init();
  }

  /**
   * Generate unique ID
   */
  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  /**
   * Create attendance composite ID
   */
  createAttendanceId(date, slot, studentId) {
    return `${date}_${slot}_${studentId}`;
  }

  /**
   * Validate record before write
   */
  _validateRecord(storeName, data) {
    const errors = [];

    if (['meta', 'sync_metadata', 'sync_queue', 'conflicts'].includes(storeName)) {
      return { valid: true, errors: [] };
    }

    switch (storeName) {
      case 'attendances':
        if (!data.id && !(data.date && data.slot && data.studentId)) {
          errors.push('id or (date, slot, studentId) required');
        }
        if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
          errors.push('date must be YYYY-MM-DD format');
        }
        if (data.studentId && typeof data.studentId !== 'string') {
          errors.push('studentId must be string');
        }
        if (data.note && data.note.length > DB_VALIDATION.MAX_NOTE_LENGTH) {
          errors.push(`note exceeds max length of ${DB_VALIDATION.MAX_NOTE_LENGTH}`);
        }
        break;

      case 'permits':
        if (!data.id) errors.push('id required');
        if (!data.nis) errors.push('nis required');
        if (!data.category) errors.push('category required');
        if (data.category && !['sakit', 'izin', 'pulang'].includes(data.category)) {
          errors.push('category must be sakit, izin, or pulang');
        }
        if (data.status && !['pending', 'approved', 'rejected'].includes(data.status)) {
          errors.push('status must be pending, approved, or rejected');
        }
        if (data.reason && data.reason.length > DB_VALIDATION.MAX_STRING_LENGTH) {
          errors.push(`reason exceeds max length of ${DB_VALIDATION.MAX_STRING_LENGTH}`);
        }
        if (data.document && data.document.length > DB_VALIDATION.MAX_DOCUMENT_SIZE) {
          errors.push('document exceeds max size of 5MB');
        }
        break;

      case 'tahfizh':
        if (!data.id) errors.push('id required');
        if (!data.nis) errors.push('nis required');
        if (!data.musyrif) errors.push('musyrif required');
        if (data.halaman && data.halaman.length > 50) {
          errors.push('halaman exceeds max length of 50');
        }
        break;

      case 'activity_logs':
        if (!data.id) errors.push('id required');
        if (!data.action) errors.push('action required');
        if (data.detail && data.detail.length > DB_VALIDATION.MAX_STRING_LENGTH) {
          errors.push(`detail exceeds max length of ${DB_VALIDATION.MAX_STRING_LENGTH}`);
        }
        break;

      case 'settings':
        if (!data.id) errors.push('id required');
        break;

      case 'musyrif_journals':
        if (!data.id) errors.push('id required');
        if (!data.date) errors.push('date required');
        if (!data.taskId) errors.push('taskId required');
        if (!data.musyrifId) errors.push('musyrifId required');
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Sanitize string value
   */
  _sanitizeString(value, maxLength = DB_VALIDATION.MAX_STRING_LENGTH) {
    if (typeof value !== 'string') return '';
    return value.slice(0, maxLength).replace(/[<>]/g, '');
  }

  /**
   * Create or update record (upsert)
   */
  async put(storeName, data) {
    const db = await this.ensureReady();

    const validation = this._validateRecord(storeName, data);
    if (!validation.valid) {
      this._logger.warn(`Validation failed for ${storeName}:`, validation.errors);
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      const now = new Date().toISOString();
      const record = {
        ...data,
        _updatedAt: now,
      };

      if (!record._createdAt) {
        record._createdAt = now;
        record._version = 1;
      } else {
        record._version = (record._version || 0) + 1;
      }

      const request = store.put(record);

      request.onsuccess = () => {
        if (!this.isSyncing && window.isSupabaseEnabled && window.syncQueue &&
            !['sync_queue', 'conflicts', 'sync_metadata', 'meta'].includes(storeName)) {
          // Use snake_case for sync queue to match schema
          window.syncQueue.add({
            entity_type: storeName,
            entity_id: record.id,
            operation: 'upsert',
            payload: record,
            priority: storeName === 'attendances' ? 8 : (storeName === 'permits' ? 7 : (storeName === 'tahfizh' ? 7 : 5))
          }).then(() => {
            if (window.supabaseSync && navigator.onLine) {
              window.supabaseSync.syncOutbound();
            }
          });
        }
        resolve(record);
      };

      request.onerror = (event) => {
        const error = event.target.error;
        this._logger.error(`Error putting in ${storeName}:`, error);

        if (error.name === 'QuotaExceededError') {
          window.showToast?.('Storage hampir penuh! Data tidak tersimpan.', 'error');
        }
        reject(error);
      };
    });
  }

  /**
   * Get record by ID
   */
  async get(storeName, id) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        this._logger.error(`Error getting from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get record by index
   */
  async getByIndex(storeName, indexName, value) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        this._logger.error(`Error getting by index ${indexName} from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get single record by index
   */
  async getOneByIndex(storeName, indexName, value) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.get(value);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        this._logger.error(`Error getting by index ${indexName} from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all records from store
   */
  async getAll(storeName) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        this._logger.error(`Error getting all from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get records by multiple values (IN query)
   */
  async getByIndexIn(storeName, indexName, values) {
    if (!values || values.length === 0) return [];

    const db = await this.ensureReady();
    const BATCH_SIZE = 10;
    const results = [];

    for (let i = 0; i < values.length; i += BATCH_SIZE) {
      const batch = values.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(value => this.getByIndex(storeName, indexName, value))
      );
      results.push(...batchResults.flat());
    }

    return results;
  }

  /**
   * Query with range
   */
  async getByRange(storeName, indexName, lowerBound, upperBound, exclusive = false) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);

      const range = exclusive
        ? IDBKeyRange.bound(lowerBound, upperBound, true, true)
        : IDBKeyRange.bound(lowerBound, upperBound);

      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => {
        this._logger.error(`Error getting by range from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete record by ID
   */
  async delete(storeName, id) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        if (!this.isSyncing && window.isSupabaseEnabled && window.syncQueue &&
            !['sync_queue', 'conflicts', 'sync_metadata', 'meta'].includes(storeName)) {
          window.syncQueue.add({
            entity_type: storeName,
            entity_id: id,
            operation: 'delete',
            payload: null,
            priority: 7
          }).then(() => {
            if (window.supabaseSync && navigator.onLine) {
              window.supabaseSync.syncOutbound();
            }
          });
        }
        resolve(true);
      };

      request.onerror = () => {
        this._logger.error(`Error deleting from ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete multiple records by index
   */
  async deleteByIndex(storeName, indexName, value) {
    const records = await this.getByIndex(storeName, indexName, value);
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      let completed = 0;

      if (records.length === 0) {
        resolve(0);
        return;
      }

      records.forEach(record => {
        const request = store.delete(record.id);
        request.onsuccess = () => {
          completed++;
          if (completed === records.length) resolve(records.length);
        };
        request.onerror = () => {
          completed++;
          if (completed === records.length) resolve(completed);
        };
      });
    });
  }

  /**
   * Bulk insert/update with proper transaction handling
   */
  async bulkPut(storeName, records) {
    if (!records || records.length === 0) return { success: [], failed: [], total: 0 };

    const db = await this.ensureReady();
    const now = new Date().toISOString();
    const results = [];
    const failed = [];
    let hasError = false;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      let completed = 0;
      const total = records.length;

      // Handle transaction errors
      tx.onerror = () => {
        this._logger.error(`Transaction error in bulkPut for ${storeName}`);
        hasError = true;
      };

      records.forEach(data => {
        const record = {
          ...data,
          _updatedAt: now,
        };

        if (!record._createdAt) {
          record._createdAt = now;
          record._version = 1;
        } else {
          record._version = (record._version || 0) + 1;
        }

        const request = store.put(record);

        request.onsuccess = () => {
          results.push(request.result);

          if (!this.isSyncing && window.isSupabaseEnabled && window.syncQueue &&
              !['sync_queue', 'conflicts', 'sync_metadata', 'meta'].includes(storeName)) {
            window.syncQueue.add({
              entity_type: storeName,
              entity_id: record.id,
              operation: 'upsert',
              payload: record,
              priority: storeName === 'attendances' ? 8 : (storeName === 'permits' ? 7 : 5)
            });
          }

          completed++;

          if (completed === total) {
            if (window.supabaseSync && navigator.onLine && !this.isSyncing && window.isSupabaseEnabled) {
              window.supabaseSync.syncOutbound();
            }
            if (hasError) {
              this._logger.warn(`bulkPut completed with ${failed.length} errors`);
            }
            resolve({ success: results, failed, total, hasErrors: hasError });
          }
        };

        request.onerror = (event) => {
          hasError = true;
          const error = event.target.error;
          this._logger.error('bulkPut error:', data.id || data, error);
          failed.push({ data: data.id || data, error: error.message });
          completed++;

          if (completed === total) {
            if (error.name === 'QuotaExceededError') {
              window.showToast?.('Storage hampir penuh! Sebagian data tidak tersimpan.', 'error');
            }
            resolve({ success: results, failed, total, hasErrors: true });
          }
        };
      });

      if (records.length === 0) {
        resolve({ success: [], failed: [], total: 0, hasErrors: false });
      }
    });
  }

  /**
   * Clear all records from store
   */
  async clear(storeName) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        this._logger.error(`Error clearing ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Count records in store
   */
  async count(storeName) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this._logger.error(`Error counting ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Count records by index
   */
  async countByIndex(storeName, indexName, value) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.count(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this._logger.error(`Error counting by index ${indexName} in ${storeName}:`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get meta value
   */
  async getMeta(key) {
    const record = await this.get('meta', key);
    return record ? record.value : null;
  }

  /**
   * Set meta value
   */
  async setMeta(key, value) {
    return this.put('meta', {
      key,
      value,
      _updatedAt: new Date().toISOString()
    });
  }

  /**
   * Cleanup old records
   */
  async cleanup(storeName, maxAgeMs = 90 * 24 * 60 * 60 * 1000) {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

    if (storeName === 'activity_logs') {
      return this._cleanupActivityLogs(cutoff);
    }

    const records = await this.getAll(storeName);
    const toDelete = records.filter(r => r.timestamp && r.timestamp < cutoff);

    if (toDelete.length === 0) return { success: 0, failed: 0, total: 0 };

    return this.bulkDelete(storeName, toDelete.map(r => r.id));
  }

  /**
   * Cleanup activity logs using timestamp index
   */
  async _cleanupActivityLogs(cutoff) {
    try {
      const oldLogs = await this.getAll('activity_logs');
      const toDelete = oldLogs.filter(r => r.timestamp && r.timestamp < cutoff);

      if (toDelete.length === 0) return { success: 0, failed: 0, total: 0 };

      return this.bulkDelete('activity_logs', toDelete.map(r => r.id));
    } catch (error) {
      this._logger.error('Activity logs cleanup failed:', error);
      return { success: 0, failed: 0, total: 0, error: error.message };
    }
  }

  /**
   * Bulk delete with tracking
   */
  async bulkDelete(storeName, ids) {
    if (!ids || ids.length === 0) return { success: 0, failed: 0, total: 0 };

    const db = await this.ensureReady();
    let deleted = 0;
    let failed = 0;
    const failedIds = [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      tx.onerror = () => {
        this._logger.error(`Transaction error in bulkDelete for ${storeName}`);
      };

      ids.forEach(id => {
        const request = store.delete(id);
        request.onsuccess = () => deleted++;
        request.onerror = (event) => {
          failed++;
          failedIds.push(id);
          this._logger.error(`bulkDelete failed for id: ${id}`, event.target.error);
        };
      });

      tx.oncomplete = () => {
        if (failed > 0) {
          this._logger.warn(`bulkDelete completed with ${failed} failures:`, failedIds);
        }
        resolve({ success: deleted, failed, failedIds, total: ids.length });
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Close database
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isReady = false;
      this._logger.info('Database closed');
    }
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================
const localDB = new LocalDB();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalDB;
}

window.LocalDB = LocalDB;
window.localDB = localDB;
