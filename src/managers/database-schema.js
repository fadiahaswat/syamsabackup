/**
 * LocalDB - IndexedDB-based Local Database
 *
 * Arsitektur Database Lokal yang Solid untuk Musyrif SuperApp
 *
 * FEATURES:
 * - Single Source of Truth menggunakan IndexedDB
 * - Proper CRUD operations
 * - Versioning untuk optimistic locking
 * - Conflict detection
 * - Efficient indexing
 * - Migration support
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
 * stores/sync_queue (for future cloud sync)
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

const DB_NAME = 'musyrif_local_db';
const DB_VERSION = 1;

class LocalDB {
  constructor() {
    this.db = null;
    this.isReady = false;
    this.isInitializing = false;
    this.readyPromise = null;
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
      console.log('[LocalDB] Database initialized successfully');
      return this.db;
    } catch (error) {
      console.error('[LocalDB] Failed to initialize database:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Internal init - creates database and stores
   */
  _initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[LocalDB] IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onblocked = () => {
        console.warn('[LocalDB] Database blocked - may need to close other tabs');
      };

      request.onsuccess = () => {
        const db = request.result;

        // Handle version change
        db.onversionchange = () => {
          console.log('[LocalDB] Database version change detected');
        };

        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[LocalDB] Upgrading database to version', event.newVersion);

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

      // Primary index: by date
      store.createIndex('date', 'date', { unique: false });

      // Primary index: by slot
      store.createIndex('slot', 'slot', { unique: false });

      // Primary index: by student
      store.createIndex('studentId', 'studentId', { unique: false });

      // Primary index: by class
      store.createIndex('kelas', 'kelas', { unique: false });

      // Composite index: date + slot (for daily attendance view)
      store.createIndex('date_slot', ['date', 'slot'], { unique: false });

      // Composite index: date + slot + kelas (for class view)
      store.createIndex('date_slot_kelas', ['date', 'slot', 'kelas'], { unique: false });

      // Index: updated_at (for sync)
      store.createIndex('updatedAt', '_updatedAt', { unique: false });

      // Index: synced_at (for pending sync)
      store.createIndex('syncedAt', '_syncedAt', { unique: false });

      console.log('[LocalDB] Created store: attendances');
    }

    // ==========================================
    // STORE: permits
    // ==========================================
    if (!db.objectStoreNames.contains('permits')) {
      const store = db.createObjectStore('permits', { keyPath: 'id' });

      // Primary index: by student
      store.createIndex('nis', 'nis', { unique: false });

      // Primary index: by class
      store.createIndex('kelas', 'kelas', { unique: false });

      // Primary index: by status
      store.createIndex('status', 'status', { unique: false });

      // Primary index: by category
      store.createIndex('category', 'category', { unique: false });

      // Composite index: nis + start_date (for student history)
      store.createIndex('nis_start', ['nis', 'start_date'], { unique: false });

      // Index: active permits (is_active + end_date)
      store.createIndex('is_active', 'is_active', { unique: false });

      // Index: updated_at
      store.createIndex('updatedAt', '_updatedAt', { unique: false });

      console.log('[LocalDB] Created store: permits');
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

      // Composite: nis + tanggal (for student history)
      store.createIndex('nis_tanggal', ['nis', 'tanggal'], { unique: false });

      // Index: pending setoran
      store.createIndex('pending', 'status', { unique: false });

      console.log('[LocalDB] Created store: tahfizh');
    }

    // ==========================================
    // STORE: settings
    // ==========================================
    if (!db.objectStoreNames.contains('settings')) {
      const store = db.createObjectStore('settings', { keyPath: 'id' });
      store.createIndex('updatedAt', '_updatedAt', { unique: false });
      console.log('[LocalDB] Created store: settings');
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

      // TTL index: auto-cleanup old logs
      store.createIndex('timestamp_idx', 'timestamp', { unique: false });

      console.log('[LocalDB] Created store: activity_logs');
    }

    // ==========================================
    // STORE: sync_queue (for future cloud sync)
    // ==========================================
    if (!db.objectStoreNames.contains('sync_queue')) {
      const store = db.createObjectStore('sync_queue', { keyPath: 'id' });

      store.createIndex('status', 'status', { unique: false });
      store.createIndex('entity_type', 'entity_type', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
      store.createIndex('priority', 'priority', { unique: false });

      // Composite: status + priority (for processing order)
      store.createIndex('status_priority', ['status', 'priority'], { unique: false });

      console.log('[LocalDB] Created store: sync_queue');
    }

    // ==========================================
    // STORE: conflicts (for future cloud sync)
    // ==========================================
    if (!db.objectStoreNames.contains('conflicts')) {
      const store = db.createObjectStore('conflicts', { keyPath: 'id' });
      store.createIndex('entity_type', 'entity_type', { unique: false });
      store.createIndex('entity_id', 'entity_id', { unique: false });
      store.createIndex('resolved', 'resolved', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });

      console.log('[LocalDB] Created store: conflicts');
    }

    // ==========================================
    // STORE: meta (database metadata)
    // ==========================================
    if (!db.objectStoreNames.contains('meta')) {
      const store = db.createObjectStore('meta', { keyPath: 'key' });

      // Initialize default meta
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

      console.log('[LocalDB] Created store: meta');
    }

    console.log('[LocalDB] All stores created successfully');
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
   * Generic CRUD operations
   */

  /**
   * Create or update record (upsert)
   */
  async put(storeName, data) {
    const db = await this.ensureReady();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      // Add metadata
      const now = new Date().toISOString();
      const record = {
        ...data,
        _updatedAt: now,
      };

      // If new record
      if (!record._createdAt) {
        record._createdAt = now;
        record._version = 1;
      } else {
        record._version = (record._version || 0) + 1;
      }

      const request = store.put(record);

      request.onsuccess = () => {
        resolve(record);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error putting in ${storeName}:`, request.error);
        reject(request.error);
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

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error getting from ${storeName}:`, request.error);
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

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error getting by index ${indexName} from ${storeName}:`, request.error);
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

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error getting by index ${indexName} from ${storeName}:`, request.error);
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

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error getting all from ${storeName}:`, request.error);
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
    const results = [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);

      let completed = 0;

      values.forEach(value => {
        const request = index.getAll(value);

        request.onsuccess = () => {
          results.push(...(request.result || []));
          completed++;

          if (completed === values.length) {
            resolve(results);
          }
        };

        request.onerror = () => {
          completed++;
          if (completed === values.length) {
            resolve(results);
          }
        };
      });

      // Handle empty values
      if (values.length === 0) {
        resolve([]);
      }
    });
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

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error getting by range from ${storeName}:`, request.error);
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
        resolve(true);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error deleting from ${storeName}:`, request.error);
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
          if (completed === records.length) {
            resolve(records.length);
          }
        };

        request.onerror = () => {
          completed++;
          if (completed === records.length) {
            resolve(completed);
          }
        };
      });
    });
  }

  /**
   * Bulk insert/update
   */
  async bulkPut(storeName, records) {
    if (!records || records.length === 0) return [];

    const db = await this.ensureReady();
    const now = new Date().toISOString();
    const results = [];

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      let completed = 0;

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
          completed++;

          if (completed === records.length) {
            resolve(results);
          }
        };

        request.onerror = () => {
          completed++;
          if (completed === records.length) {
            resolve(results);
          }
        };
      });

      if (records.length === 0) {
        resolve([]);
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

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error clearing ${storeName}:`, request.error);
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

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error counting ${storeName}:`, request.error);
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

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`[LocalDB] Error counting by index ${indexName} in ${storeName}:`, request.error);
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
   * Cleanup old records (TTL based)
   */
  async cleanup(storeName, maxAgeMs = 90 * 24 * 60 * 60 * 1000) {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

    const records = await this.getAll(storeName);
    const toDelete = records.filter(r => r.timestamp && r.timestamp < cutoff);

    if (toDelete.length === 0) return 0;

    return this.bulkDelete(storeName, toDelete.map(r => r.id));
  }

  /**
   * Bulk delete
   */
  async bulkDelete(storeName, ids) {
    if (!ids || ids.length === 0) return 0;

    const db = await this.ensureReady();
    let deleted = 0;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      ids.forEach(id => {
        const request = store.delete(id);
        request.onsuccess = () => deleted++;
      });

      tx.oncomplete = () => resolve(deleted);
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
      console.log('[LocalDB] Database closed');
    }
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================
const localDB = new LocalDB();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocalDB;
}

window.LocalDB = LocalDB;
window.localDB = localDB;

console.log('[LocalDB] Module loaded');
