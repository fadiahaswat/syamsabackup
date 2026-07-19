/**
 * SyncQueue - Unified IndexedDB-based Offline Sync Queue
 *
 * Uses LocalDB (musyrif_local_db) with snake_case schema consistency.
 * Stores changes in 'sync_queue' store and conflicts in 'conflicts' store.
 *
 * IMPORTANT: All field names use snake_case for IndexedDB schema consistency.
 *
 * ENHANCEMENT: Added retry mechanism with exponential backoff for failed items.
 */

class SyncQueue {
  constructor() {
    this._db = null;
    this._readyPromise = null;
    this.isReady = false;
    this.pendingCount = 0;
    this._logger = window.SyncQueueLogger || console;
    this._initPromise = null;

    // ENHANCEMENT: Retry configuration
    this._maxRetries = 3;
    this._retryBaseDelayMs = 1000; // 1 second base delay
    this._retryTimers = new Map(); // Track retry timers per item
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
   * FIX: Create unique ID per student for proper sync
   * Each student in a slot has their own record
   */
  async addAttendanceChange(dateKey, slotId, studentId, data) {
    // Create unique entity_id per student
    const entityId = `${dateKey}_${slotId}_${studentId}`;

    return this.add({
      entity_type: 'attendances',
      entity_id: entityId,
      operation: 'upsert',
      payload: {
        id: entityId,
        date: dateKey,
        slot: slotId,
        studentId: String(studentId),
        ...data
      },
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
    // Cancel any pending retry for this item
    this._cancelRetry(id);
    return this.updateStatus(id, 'synced', {
      synced_at: Date.now(),
      retry_count: 0, // Reset retry count on success
    });
  }

  /**
   * Mark change as failed and schedule automatic retry
   * ENHANCEMENT: Implements exponential backoff retry
   *
   * H-01 FIX: Check navigator.onLine before marking as permanently failed.
   * If offline, keep retrying when connection is restored.
   */
  async markFailed(id, error) {
    const change = await this.getChange(id);
    const retryCount = (change?.retry_count || 0) + 1;

    // H-01 FIX: If device is offline, don't mark as permanently failed
    // Just schedule retry for when online
    if (!navigator.onLine) {
      this._logger.info(`[SyncQueue] Device offline - scheduling retry for ${id} when online`);

      // Keep as pending with offline flag
      await this.updateStatus(id, 'pending', {
        last_error: error?.message || String(error),
        retry_count: retryCount,
        next_retry_at: null, // Will retry when online event fires
        offline_pending: true,
      });

      // Set up online listener to retry when connection restored
      this._setupOnlineRetry(id);

      return { scheduled: true, offline: true };
    }

    // Check if we should retry
    if (retryCount <= this._maxRetries) {
      // Calculate delay with exponential backoff
      const delayMs = this._retryBaseDelayMs * Math.pow(2, retryCount - 1);

      this._logger.info(`[SyncQueue] Scheduling retry ${retryCount}/${this._maxRetries} for ${id} in ${delayMs}ms`);

      // Update status and schedule retry
      await this.updateStatus(id, 'pending', {
        last_error: error?.message || String(error),
        retry_count: retryCount,
        next_retry_at: Date.now() + delayMs,
      });

      // Schedule automatic retry
      this._scheduleRetry(id, delayMs);

      return { scheduled: true, retryCount, delayMs };
    } else {
      // H-01 FIX: Even with max retries, if online, schedule retry after longer delay
      // Only mark permanently failed after even more retries OR user explicitly says so
      if (retryCount <= this._maxRetries * 2) {
        const delayMs = this._retryBaseDelayMs * Math.pow(2, retryCount - 1);
        this._logger.info(`[SyncQueue] Extended retry ${retryCount}/${this._maxRetries * 2} for ${id}`);

        await this.updateStatus(id, 'pending', {
          last_error: error?.message || String(error),
          retry_count: retryCount,
          next_retry_at: Date.now() + delayMs,
        });

        this._scheduleRetry(id, delayMs);
        return { scheduled: true, retryCount, delayMs, extended: true };
      }

      // Max extended retries exceeded - mark as permanently failed
      this._logger.warn(`[SyncQueue] Max retries exceeded for ${id}, marking as failed`);
      await this.updateStatus(id, 'failed', {
        last_error: error?.message || String(error),
        retry_count: retryCount,
        failed_permanently: true,
      });

      // Notify user about permanent failure
      window.showToast?.(`Sinkronisasi gagal setelah ${this._maxRetries} percobaan. Item perlu disinkronkan manual.`, 'warning');
      window.dispatchEvent(new CustomEvent('sync:permanent-failure', {
        detail: { changeId: id, error: error?.message || String(error) }
      }));

      return { scheduled: false, permanentlyFailed: true };
    }
  }

  /**
   * Schedule automatic retry for a failed item
   * @private
   */
  _scheduleRetry(id, delayMs) {
    // Cancel existing retry if any
    this._cancelRetry(id);

    const timer = setTimeout(async () => {
      try {
        const change = await this.getChange(id);
        if (change && change.status === 'pending' && change.retry_count > 0) {
          this._logger.info(`[SyncQueue] Executing auto-retry for ${id}`);
          // Trigger sync to retry this item
          if (window.supabaseSync?.syncOutbound) {
            await window.supabaseSync.syncOutbound();
          }
        }
      } catch (err) {
        this._logger.error(`[SyncQueue] Auto-retry failed for ${id}:`, err);
      } finally {
        this._retryTimers.delete(id);
      }
    }, delayMs);

    this._retryTimers.set(id, timer);
  }

  /**
   * H-01 FIX: Setup online listener for offline-retrying items
   * @private
   */
  _setupOnlineRetry(id) {
    // Check if we already have an online listener
    if (this._onlineRetryListener) return;

    const handler = async () => {
      this._logger.info('[SyncQueue] Device came online - retrying pending items');
      if (window.supabaseSync?.syncOutbound) {
        await window.supabaseSync.syncOutbound();
      }
    };

    window.addEventListener('online', handler);
    this._onlineRetryListener = handler;
  }

  /**
   * H-01 FIX: Clear online retry listener
   * @private
   */
  _clearOnlineRetryListener() {
    if (this._onlineRetryListener) {
      window.removeEventListener('online', this._onlineRetryListener);
      this._onlineRetryListener = null;
    }
  }

  /**
   * Cancel pending retry for an item
   * @private
   */
  _cancelRetry(id) {
    const existingTimer = this._retryTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this._retryTimers.delete(id);
      this._logger.debug(`[SyncQueue] Cancelled retry for ${id}`);
    }
  }

  /**
   * Get all items pending automatic retry
   */
  async getItemsPendingRetry() {
    await this._ensureReady();
    const now = Date.now();

    const allPending = await this._db.getByIndex('sync_queue', 'status', 'pending');
    return allPending.filter(item =>
      item.retry_count > 0 &&
      item.next_retry_at &&
      item.next_retry_at <= now
    );
  }

  /**
   * Mark change as conflict
   */
  async markConflict(id, serverData) {
    await this._ensureReady();

    // Cancel any pending retry
    this._cancelRetry(id);

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
      retry_count: 0,
    });
  }

  /**
   * Retry a failed change (manual retry)
   */
  async retryChange(id) {
    return this.updateStatus(id, 'pending', {
      last_error: null,
      retry_count: 0, // Reset retry count for manual retry
      next_retry_at: null,
    });
  }

  /**
   * Retry all failed items
   */
  async retryAllFailed() {
    await this._ensureReady();

    const failed = await this._db.getByIndex('sync_queue', 'status', 'failed');
    const results = [];

    for (const item of failed) {
      // Skip items marked as permanently failed
      if (item.failed_permanently) {
        this._logger.warn(`[SyncQueue] Skipping permanently failed item ${item.id}`);
        continue;
      }
      const result = await this.retryChange(item.id);
      results.push({ id: item.id, result });
    }

    this._logger.info(`[SyncQueue] Retrying ${results.length} failed items`);

    // Trigger sync
    if (window.supabaseSync?.syncOutbound) {
      window.supabaseSync.syncOutbound();
    }

    return results;
  }

  /**
   * Cleanup method to prevent memory leaks
   * Call when the app or component unmounts
   */
  destroy() {
    // Cancel all pending retry timers
    for (const [id, timer] of this._retryTimers) {
      clearTimeout(timer);
      this._logger.debug(`[SyncQueue] Cancelled retry for ${id} on destroy`);
    }
    this._retryTimers.clear();

    // Cancel scheduled cleanup interval
    this._stopScheduledCleanup();

    this._logger.info('[SyncQueue] Destroyed, all timers cleared');
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

  // ============================================================
  // SCHEDULED CLEANUP
  // ============================================================

  /**
   * ENHANCEMENT: Start scheduled cleanup interval
   * Cleans up old synced items periodically to prevent database bloat
   * @param {number} intervalMs - Cleanup interval in ms (default: 1 hour)
   */
  startScheduledCleanup(intervalMs = 3600000) { // 1 hour default
    // Cancel existing cleanup timer
    this._stopScheduledCleanup();

    this._cleanupInterval = setInterval(() => {
      this.performScheduledCleanup().catch(err => {
        this._logger.error('[SyncQueue] Scheduled cleanup failed:', err);
      });
    }, intervalMs);

    this._logger.info(`[SyncQueue] Scheduled cleanup started (every ${intervalMs / 1000 / 60} minutes)`);
  }

  /**
   * Stop scheduled cleanup
   * @private
   */
  _stopScheduledCleanup() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
  }

  /**
   * ENHANCEMENT: Perform scheduled cleanup
   * Cleans up synced items older than retention period
   * @param {number} retentionDays - Days to keep synced items (default: 7 days)
   */
  async performScheduledCleanup(retentionDays = 7) {
    await this._ensureReady();

    const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    this._logger.info(`[SyncQueue] Starting cleanup (retention: ${retentionDays} days)`);

    // Get synced items older than retention period
    const syncedItems = await this._db.getByIndex('sync_queue', 'status', 'synced');
    const oldSyncedItems = syncedItems.filter(item =>
      item.synced_at && item.synced_at < cutoffTime
    );

    if (oldSyncedItems.length === 0) {
      this._logger.debug('[SyncQueue] No old synced items to clean up');
      return { cleaned: 0 };
    }

    // Delete old synced items
    const idsToDelete = oldSyncedItems.map(item => item.id);
    await this._db.bulkDelete('sync_queue', idsToDelete);

    // Also clean up old conflicts (resolved conflicts older than 30 days)
    const conflicts = await this._db.getAll('conflicts');
    const oldConflicts = conflicts.filter(conflict =>
      conflict.resolved && conflict.resolved_at && conflict.resolved_at < cutoffTime * 4 // 30 days for conflicts
    );

    let conflictsCleaned = 0;
    if (oldConflicts.length > 0) {
      for (const conflict of oldConflicts) {
        await this._db.delete('conflicts', conflict.id);
        conflictsCleaned++;
      }
    }

    // Update pending count
    await this._updatePendingCount();

    this._logger.info(`[SyncQueue] Cleanup complete: ${idsToDelete.length} synced, ${conflictsCleaned} conflicts removed`);

    return {
      cleaned: idsToDelete.length,
      conflictsCleaned,
      total: idsToDelete.length + conflictsCleaned
    };
  }

  /**
   * ENHANCEMENT: Get cleanup status
   */
  async getCleanupStatus() {
    await this._ensureReady();

    const syncedItems = await this._db.getByIndex('sync_queue', 'status', 'synced');
    const conflicts = await this._db.getAll('conflicts');
    const unresolvedConflicts = conflicts.filter(c => !c.resolved);

    return {
      syncedItemsCount: syncedItems.length,
      conflictsCount: conflicts.length,
      unresolvedConflictsCount: unresolvedConflicts.length,
      hasScheduledCleanup: !!this._cleanupInterval,
    };
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
