/**
 * SyncQueue - Unified IndexedDB-based Offline Sync Queue
 *
 * Uses LocalDB (musyrif_local_db) instead of separate database.
 * Stores changes in 'changes' store and conflicts in 'conflicts' store.
 *
 * NOTE: This module now uses the shared LocalDB from database-schema.js
 * Instead of creating its own IndexedDB connection.
 */

class SyncQueue {
  constructor() {
    // Use shared LocalDB instance instead of separate database
    this._db = null;
    this.isReady = false;

    // Pending sync count (for UI)
    this.pendingCount = 0;

    // Callbacks
    this.onSyncStart = null;
    this.onSyncComplete = null;
    this.onSyncError = null;
    this.onQueueChange = null;
  }

  /**
   * Initialize with shared LocalDB
   */
  async init(localDB) {
    if (!localDB) {
      throw new Error('SyncQueue requires LocalDB instance');
    }

    this._db = localDB;
    await this._db.ensureReady();
    this.isReady = true;

    console.log('[SyncQueue] Initialized with shared LocalDB');
    await this._updatePendingCount();

    return this;
  }

  /**
   * Ensure DB is ready
   */
  async _ensureReady() {
    if (!this.isReady || !this._db) {
      throw new Error('SyncQueue not initialized. Call init(localDB) first.');
    }
    await this._db.ensureReady();
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

    const saved = await this._db.put('sync_queue', record);
    console.log('[SyncQueue] Added change:', record.id, record.entityType);
    await this._updatePendingCount();

    if (this.onQueueChange) {
      this.onQueueChange(this.pendingCount);
    }

    return saved.id;
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

    // Get all pending records
    const results = await this._db.getByIndex('sync_queue', 'status', 'pending');

    // Sort by priority (desc) then timestamp (asc)
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
      console.warn('[SyncQueue] Record not found:', id);
      return null;
    }

    const updated = {
      ...record,
      status,
      lastUpdated: Date.now(),
      ...(status === 'failed' ? { attempts: (record.attempts || 0) + 1 } : {}),
      ...extra,
    };

    await this._db.put('sync_queue', updated);
    await this._updatePendingCount();

    if (this.onQueueChange) {
      this.onQueueChange(this.pendingCount);
    }

    return updated;
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

    await this._db.delete('sync_queue', id);
    await this._updatePendingCount();

    if (this.onQueueChange) {
      this.onQueueChange(this.pendingCount);
    }
  }

  /**
   * Clear all synced changes
   */
  async clearSynced() {
    await this._ensureReady();

    const synced = await this._db.getByIndex('sync_queue', 'status', 'synced');
    const ids = synced.map(r => r.id);

    await this._db.bulkDelete('sync_queue', ids);
    console.log('[SyncQueue] Cleared', ids.length, 'synced changes');
  }

  /**
   * Clear all changes
   */
  async clearAll() {
    await this._ensureReady();

    await this._db.clear('sync_queue');
    this.pendingCount = 0;

    if (this.onQueueChange) {
      this.onQueueChange(0);
    }

    console.log('[SyncQueue] Cleared all changes');
  }

  // ============================================================
  // CONFLICTS STORE (using unified LocalDB)
  // ============================================================

  /**
   * Add a conflict record
   */
  async addConflict(conflict) {
    await this._ensureReady();

    const record = {
      id: this._generateId(),
      entityType: conflict.entityType || conflict.entity_type || 'unknown',
      entityId: conflict.entityId || conflict.entity_id || '',
      localData: conflict.localData || conflict.local_data || {},
      serverData: conflict.serverData || conflict.server_data || {},
      createdAt: conflict.createdAt || new Date().toISOString(),
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
      console.warn('[SyncQueue] Conflict not found:', id);
      return null;
    }

    const updated = {
      ...conflict,
      resolved: true,
      resolution,
      resolvedAt: Date.now(),
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
  // METADATA STORE (using unified LocalDB)
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
   * Generate unique ID
   */
  _generateId() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    return `sync_${timestamp}_${randomPart}`;
  }

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

    return {
      pending,
      synced,
      failed,
      conflict,
      total: pending + synced + failed + conflict,
    };
  }

  /**
   * Export queue for debugging
   */
  async export() {
    await this._ensureReady();
    return this._db.getAll('sync_queue');
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const syncQueue = new SyncQueue();

// Backward compatibility - old initialization
if (typeof localDB !== 'undefined' && localDB.isReady) {
  syncQueue.init(localDB);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncQueue;
}

window.SyncQueue = SyncQueue;
window.syncQueue = syncQueue;

console.log('[SyncQueue] Module loaded - using unified LocalDB');
