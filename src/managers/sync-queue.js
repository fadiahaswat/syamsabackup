/**
 * SyncQueue - Unified IndexedDB-based Offline Sync Queue
 *
 * Uses LocalDB (musyrif_local_db) with snake_case schema consistency.
 * Stores changes in 'sync_queue' store and conflicts in 'conflicts' store.
 *
 * IMPORTANT: All field names use snake_case for IndexedDB schema consistency.
 */

class SyncQueue {
  constructor() {
    this._db = null;
    this._readyPromise = null;
    this.isReady = false;
    this.pendingCount = 0;
    this._logger = window.SyncQueueLogger || console;
    this._initPromise = null;
  }

  /**
   * Initialize with shared LocalDB - ensures proper initialization order
   */
  async init(localDB) {
    if (this.isReady && this._db === localDB) return this;

    // Prevent multiple simultaneous init calls
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._doInit(localDB);
    return this._initPromise;
  }

  /**
   * Internal init - handles the actual initialization
   */
  async _doInit(localDB) {
    if (!localDB) {
      throw new Error('SyncQueue requires LocalDB instance');
    }

    this._db = localDB;

    // Ensure LocalDB is ready before proceeding
    if (!localDB.isReady) {
      await localDB.init();
    }

    await this._db.ensureReady();
    this.isReady = true;

    this._logger.info('Initialized with shared LocalDB');
    await this._updatePendingCount();

    return this;
  }

  /**
   * Ensure queue is ready
   */
  async _ensureReady() {
    if (!this.isReady || !this._db) {
      this._logger.warn('SyncQueue not ready, attempting re-init');
      if (window.localDB) {
        await this.init(window.localDB);
      } else {
        throw new Error('SyncQueue not initialized. Call init(localDB) first.');
      }
    }
    await this._db.ensureReady();
  }

  /**
   * Generate unique ID with snake_case prefix
   */
  _generateId(prefix = 'sync') {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `${prefix}_${timestamp}_${randomPart}`;
  }

  /**
   * Add a change to the queue (snake_case fields)
   */
  async add(change) {
    await this._ensureReady();

    const record = {
      id: this._generateId(),
      entity_type: change.entity_type || change.entityType || 'unknown',
      entity_id: change.entity_id || change.entityId || '',
      operation: change.operation || 'update',
      payload: change.payload || {},
      metadata: change.metadata || {},
      status: 'pending',
      attempts: 0,
      last_error: null,
      timestamp: Date.now(),
      priority: change.priority || 5,
    };

    const saved = await this._db.put('sync_queue', record);
    this._logger.debug('Added change:', record.id, record.entity_type);
    await this._updatePendingCount();

    return saved.id;
  }

  /**
   * Add attendance change
   */
  async addAttendanceChange(dateKey, slotId, data) {
    return this.add({
      entity_type: 'attendances',
      entity_id: `${dateKey}_${slotId}`,
      operation: 'upsert',
      payload: { dateKey, slotId, data },
      priority: 8,
    });
  }

  /**
   * Add permit change
   */
  async addPermitChange(permit, operation = 'upsert') {
    return this.add({
      entity_type: 'permits',
      entity_id: permit.id,
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
      entity_type: 'settings',
      entity_id: 'user_settings',
      operation: 'upsert',
      payload: settings,
      priority: 3,
    });
  }

  /**
   * Get pending changes (sorted by priority and timestamp)
   */
  async getPending(limit = 50) {
    await this._ensureReady();

    const results = await this._db.getByIndex('sync_queue', 'status', 'pending');

    results.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });

    return results.slice(0, limit);
  }

  /**
   * Get all pending changes count
   */
  async getPendingCount() {
    await this._ensureReady();
    return this._db.countByIndex('sync_queue', 'status', 'pending');
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
    return this._db.get('sync_queue', id);
  }

  /**
   * Update change status
   */
  async updateStatus(id, status, extra = {}) {
    await this._ensureReady();

    const record = await this._db.get('sync_queue', id);
    if (!record) {
      this._logger.warn('Record not found:', id);
      return null;
    }

    const updated = {
      ...record,
      status,
      last_updated: Date.now(),
      ...(status === 'failed' ? { attempts: (record.attempts || 0) + 1 } : {}),
      ...extra,
    };

    await this._db.put('sync_queue', updated);
    await this._updatePendingCount();

    return updated;
  }

  /**
   * Mark change as synced
   */
  async markSynced(id) {
    return this.updateStatus(id, 'synced', {
      synced_at: Date.now(),
    });
  }

  /**
   * Mark change as failed
   */
  async markFailed(id, error) {
    return this.updateStatus(id, 'failed', {
      last_error: error?.message || String(error),
    });
  }

  /**
   * Mark change as conflict
   */
  async markConflict(id, serverData) {
    await this._ensureReady();

    const change = await this.getChange(id);
    if (change) {
      await this.addConflict({
        entity_type: change.entity_type,
        entity_id: change.entity_id,
        local_data: change.payload,
        server_data: serverData,
      });
    }

    return this.updateStatus(id, 'conflict', {
      server_data: serverData,
    });
  }

  /**
   * Retry a failed change
   */
  async retryChange(id) {
    return this.updateStatus(id, 'pending', {
      last_error: null,
    });
  }

  /**
   * Delete a change
   */
  async deleteChange(id) {
    await this._ensureReady();

    await this._db.delete('sync_queue', id);
    await this._updatePendingCount();
  }

  /**
   * Clear all synced changes
   */
  async clearSynced() {
    await this._ensureReady();

    const synced = await this._db.getByIndex('sync_queue', 'status', 'synced');
    const ids = synced.map(r => r.id);

    await this._db.bulkDelete('sync_queue', ids);
    this._logger.info('Cleared', ids.length, 'synced changes');
  }

  /**
   * Clear all changes
   */
  async clearAll() {
    await this._ensureReady();

    await this._db.clear('sync_queue');
    this.pendingCount = 0;

    this._logger.info('Cleared all changes');
  }

  // ============================================================
  // CONFLICTS STORE
  // ============================================================

  /**
   * Add a conflict record (snake_case fields)
   */
  async addConflict(conflict) {
    await this._ensureReady();

    const record = {
      id: this._generateId('conflict'),
      entity_type: conflict.entity_type || 'unknown',
      entity_id: conflict.entity_id || '',
      local_data: conflict.local_data || {},
      server_data: conflict.server_data || {},
      created_at: new Date().toISOString(),
      resolved: false,
      resolution: null,
    };

    return this._db.put('conflicts', record);
  }

  /**
   * Get all unresolved conflicts
   */
  async getConflicts() {
    await this._ensureReady();
    const all = await this._db.getAll('conflicts');
    return all.filter(c => !c.resolved);
  }

  /**
   * Resolve a conflict
   */
  async resolveConflict(id, resolution) {
    await this._ensureReady();

    const conflict = await this._db.get('conflicts', id);
    if (!conflict) {
      this._logger.warn('Conflict not found:', id);
      return null;
    }

    const updated = {
      ...conflict,
      resolved: true,
      resolution,
      resolved_at: Date.now(),
    };

    return this._db.put('conflicts', updated);
  }

  /**
   * Delete a conflict
   */
  async deleteConflict(id) {
    await this._ensureReady();
    return this._db.delete('conflicts', id);
  }

  // ============================================================
  // METADATA STORE
  // ============================================================

  /**
   * Get metadata
   */
  async getMetadata(key) {
    await this._ensureReady();
    const record = await this._db.get('sync_metadata', key);
    return record?.value;
  }

  /**
   * Set metadata
   */
  async setMetadata(key, value) {
    await this._ensureReady();
    return this._db.put('sync_metadata', {
      key,
      value,
      lastSync: Date.now(),
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
   * Get queue statistics
   */
  async getStats() {
    await this._ensureReady();

    const [pending, synced, failed, conflict] = await Promise.all([
      this._db.countByIndex('sync_queue', 'status', 'pending'),
      this._db.countByIndex('sync_queue', 'status', 'synced'),
      this._db.countByIndex('sync_queue', 'status', 'failed'),
      this._db.countByIndex('sync_queue', 'status', 'conflict'),
    ]);

    return { pending, synced, failed, conflict, total: pending + synced + failed + conflict };
  }

  /**
   * Export queue for debugging
   */
  async export() {
    await this._ensureReady();
    return this._db.getAll('sync_queue');
  }

  /**
   * Wait for initialization
   */
  async waitForInit() {
    if (this.isReady) return;
    if (this._initPromise) {
      await this._initPromise;
    }
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

window.SyncQueueLogger = window.SyncQueueLogger || {
  debug: (...args) => Logger?.debug('SyncQueue', ...args),
  info: (...args) => Logger?.info('SyncQueue', ...args),
  warn: (...args) => Logger?.warn('SyncQueue', ...args),
  error: (...args) => Logger?.error('SyncQueue', ...args),
};
