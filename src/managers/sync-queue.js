/**
 * SyncQueue - IndexedDB-based Offline Sync Queue
 *
 * Menyimpan perubahan offline di IndexedDB dan memprosesnya
 * saat koneksi internet tersedia kembali.
 */

class SyncQueue {
  constructor() {
    this.dbName = 'syamsa_sync_queue';
    this.dbVersion = 1;
    this.db = null;
    this.isReady = false;

    // Pending sync count (for UI)
    this.pendingCount = 0;

    // Callbacks
    this.onSyncStart = null;
    this.onSyncComplete = null;
    this.onSyncError = null;
    this.onQueueChange = null;

    // Initialize
    this._initDB();
  }

  /**
   * Initialize IndexedDB
   */
  async _initDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('[SyncQueue] IndexedDB not available');
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('[SyncQueue] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('[SyncQueue] IndexedDB ready');
        this._updatePendingCount();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[SyncQueue] Upgrading database to version', event.newVersion);

        // Changes store - main queue
        if (!db.objectStoreNames.contains('changes')) {
          const changesStore = db.createObjectStore('changes', {
            keyPath: 'id',
            autoIncrement: false,
          });
          changesStore.createIndex('status', 'status');
          changesStore.createIndex('entityType', 'entityType');
          changesStore.createIndex('timestamp', 'timestamp');
          changesStore.createIndex('priority', 'priority');
        }

        // Conflicts store - for conflict resolution
        if (!db.objectStoreNames.contains('conflicts')) {
          const conflictsStore = db.createObjectStore('conflicts', {
            keyPath: 'id',
          });
          conflictsStore.createIndex('entityType', 'entityType');
          conflictsStore.createIndex('createdAt', 'createdAt');
        }

        // Metadata store - for sync state
        if (!db.objectStoreNames.contains('metadata')) {
          const metadataStore = db.createObjectStore('metadata', {
            keyPath: 'key',
          });
          metadataStore.createIndex('lastSync', 'lastSync');
        }
      };
    });
  }

  /**
   * Ensure DB is ready
   */
  async _ensureReady() {
    if (!this.isReady) {
      await this._initDB();
    }
  }

  /**
   * Add a change to the queue
   */
  async add(change) {
    await this._ensureReady();

    const record = {
      id: this._generateId(),
      entityType: change.entityType || 'unknown',
      entityId: change.entityId || '',
      operation: change.operation || 'update', // create, update, delete
      payload: change.payload || {},
      metadata: change.metadata || {},
      status: 'pending',
      attempts: 0,
      lastError: null,
      timestamp: Date.now(),
      priority: change.priority || 5, // 1-10, higher = more urgent
      retries: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readwrite');
      const store = tx.objectStore('changes');
      const request = store.add(record);

      request.onsuccess = () => {
        console.log('[SyncQueue] Added change:', record.id, record.entityType);
        this._updatePendingCount();
        if (this.onQueueChange) {
          this.onQueueChange(this.pendingCount);
        }
        resolve(record.id);
      };

      request.onerror = () => {
        console.error('[SyncQueue] Failed to add change:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Add attendance change
   */
  async addAttendanceChange(dateKey, slotId, data) {
    return this.add({
      entityType: 'attendance',
      entityId: `${dateKey}_${slotId}`,
      operation: 'upsert',
      payload: {
        dateKey,
        slotId,
        data,
      },
      priority: 8, // Higher priority for attendance
    });
  }

  /**
   * Add permit change
   */
  async addPermitChange(permit, operation = 'upsert') {
    return this.add({
      entityType: 'permit',
      entityId: permit.id,
      operation,
      payload: permit,
      priority: 7,
    });
  }

  /**
   * Add settings change
   */
  async addSettingsChange(settings) {
    return this.add({
      entityType: 'settings',
      entityId: 'user_settings',
      operation: 'upsert',
      payload: settings,
      priority: 3, // Lower priority for settings
    });
  }

  /**
   * Get pending changes (sorted by priority and timestamp)
   */
  async getPending(limit = 50) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readonly');
      const store = tx.objectStore('changes');
      const index = store.index('status');
      const request = index.getAll(IDBKeyRange.only('pending'));

      request.onsuccess = () => {
        let results = request.result || [];

        // Sort by priority (desc) then timestamp (asc)
        results.sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return a.timestamp - b.timestamp;
        });

        resolve(results.slice(0, limit));
      };

      request.onerror = () => {
        console.error('[SyncQueue] Failed to get pending:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all pending changes count
   */
  async getPendingCount() {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readonly');
      const store = tx.objectStore('changes');
      const index = store.index('status');
      const request = index.count(IDBKeyRange.only('pending'));

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update pending count
   */
  async _updatePendingCount() {
    try {
      this.pendingCount = await this.getPendingCount();
    } catch (e) {
      this.pendingCount = 0;
    }
  }

  /**
   * Get a change by ID
   */
  async getChange(id) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readonly');
      const store = tx.objectStore('changes');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Update change status
   */
  async updateStatus(id, status, extra = {}) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readwrite');
      const store = tx.objectStore('changes');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (!record) {
          resolve();
          return;
        }

        record.status = status;
        record.lastUpdated = Date.now();

        if (status === 'failed') {
          record.attempts = (record.attempts || 0) + 1;
        }

        Object.assign(record, extra);

        const updateRequest = store.put(record);
        updateRequest.onsuccess = () => {
          this._updatePendingCount();
          if (this.onQueueChange) {
            this.onQueueChange(this.pendingCount);
          }
          resolve();
        };

        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };
      };

      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
  }

  /**
   * Mark change as synced
   */
  async markSynced(id) {
    return this.updateStatus(id, 'synced', {
      syncedAt: Date.now(),
    });
  }

  /**
   * Mark change as failed
   */
  async markFailed(id, error) {
    return this.updateStatus(id, 'failed', {
      lastError: error?.message || String(error),
    });
  }

  /**
   * Mark change as conflict
   */
  async markConflict(id, serverData) {
    await this._ensureReady();

    // Store the conflict
    const change = await this.getChange(id);
    if (change) {
      await this.addConflict({
        ...change,
        serverData,
        createdAt: Date.now(),
      });
    }

    return this.updateStatus(id, 'conflict', {
      serverData,
    });
  }

  /**
   * Retry a failed change
   */
  async retryChange(id) {
    return this.updateStatus(id, 'pending', {
      lastError: null,
    });
  }

  /**
   * Delete a change
   */
  async deleteChange(id) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readwrite');
      const store = tx.objectStore('changes');
      const request = store.delete(id);

      request.onsuccess = () => {
        this._updatePendingCount();
        if (this.onQueueChange) {
          this.onQueueChange(this.pendingCount);
        }
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all synced changes
   */
  async clearSynced() {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readwrite');
      const store = tx.objectStore('changes');
      const index = store.index('status');
      const request = index.openCursor(IDBKeyRange.only('synced'));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          console.log('[SyncQueue] Cleared synced changes');
          resolve();
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all changes
   */
  async clearAll() {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readwrite');
      const store = tx.objectStore('changes');
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[SyncQueue] Cleared all changes');
        this.pendingCount = 0;
        if (this.onQueueChange) {
          this.onQueueChange(0);
        }
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // ============================================================
  // CONFLICTS STORE
  // ============================================================

  /**
   * Add a conflict record
   */
  async addConflict(conflict) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['conflicts'], 'readwrite');
      const store = tx.objectStore('conflicts');
      const request = store.add(conflict);

      request.onsuccess = () => resolve(conflict.id);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all unresolved conflicts
   */
  async getConflicts() {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['conflicts'], 'readonly');
      const store = tx.objectStore('conflicts');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(id, resolution) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['conflicts'], 'readwrite');
      const store = tx.objectStore('conflicts');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const conflict = getRequest.result;
        if (!conflict) {
          resolve();
          return;
        }

        conflict.resolved = true;
        conflict.resolution = resolution;
        conflict.resolvedAt = Date.now();

        const updateRequest = store.put(conflict);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete a conflict
   */
  async deleteConflict(id) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['conflicts'], 'readwrite');
      const store = tx.objectStore('conflicts');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================================
  // METADATA STORE
  // ============================================================

  /**
   * Get metadata
   */
  async getMetadata(key) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['metadata'], 'readonly');
      const store = tx.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set metadata
   */
  async setMetadata(key, value) {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['metadata'], 'readwrite');
      const store = tx.objectStore('metadata');
      const request = store.put({ key, value, lastSync: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime() {
    return this.getMetadata('lastSync');
  }

  /**
   * Set last sync timestamp
   */
  async setLastSyncTime(timestamp = Date.now()) {
    return this.setMetadata('lastSync', timestamp);
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  /**
   * Generate unique ID
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${timestamp}_${randomPart}`;
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    await this._ensureReady();

    const statuses = ['pending', 'synced', 'failed', 'conflict'];

    const stats = {
      pending: 0,
      synced: 0,
      failed: 0,
      conflict: 0,
      total: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readonly');
      const store = tx.objectStore('changes');
      let completed = 0;

      statuses.forEach((status) => {
        const index = store.index('status');
        const request = index.count(IDBKeyRange.only(status));

        request.onsuccess = () => {
          stats[status] = request.result;
          stats.total += request.result;
          completed++;

          if (completed === statuses.length) {
            resolve(stats);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    });
  }

  /**
   * Export queue for debugging
   */
  async export() {
    await this._ensureReady();

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['changes'], 'readonly');
      const store = tx.objectStore('changes');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const syncQueue = new SyncQueue();

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncQueue;
}

window.SyncQueue = SyncQueue;
window.syncQueue = syncQueue;

console.log('[SyncQueue] Module loaded');
