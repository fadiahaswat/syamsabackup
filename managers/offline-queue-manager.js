/**
 * OfflineQueueManager - Manages offline operation queue
 *
 * Handles queuing operations when offline and syncing when back online.
 * Uses localStorage for persistence across page reloads.
 */
class OfflineQueueManager {
  static QUEUE_KEY = 'firebase_offline_queue_v1';
  static MAX_QUEUE_SIZE = 500;
  static MAX_RETRY_ATTEMPTS = 3;
  static OPERATION_ID_COUNTER_KEY = 'firebase_queue_id_counter';

  /**
   * Get the current queue from localStorage
   */
  static getQueue() {
    try {
      const queueData = localStorage.getItem(this.QUEUE_KEY);
      if (!queueData) return [];
      return JSON.parse(queueData);
    } catch (e) {
      console.error('[OfflineQueueManager] Error reading queue:', e);
      return [];
    }
  }

  /**
   * Save queue to localStorage
   */
  static saveQueue(queue) {
    try {
      // Enforce max queue size (FIFO - remove oldest)
      while (queue.length > this.MAX_QUEUE_SIZE) {
        queue.shift();
        console.warn('[OfflineQueueManager] Queue overflow, removed oldest item');
      }
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('[OfflineQueueManager] Error saving queue:', e);
      if (e.name === 'QuotaExceededError') {
        // Remove oldest 50% and retry
        const half = Math.floor(queue.length / 2);
        queue.splice(0, half);
        try {
          localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
        } catch (retryErr) {
          console.error('[OfflineQueueManager] Failed to save even after cleanup:', retryErr);
        }
      }
    }
  }

  /**
   * Generate unique operation ID
   */
  static generateOperationId() {
    const counter = parseInt(localStorage.getItem(this.OPERATION_ID_COUNTER_KEY) || '0', 10);
    const newCounter = counter + 1;
    localStorage.setItem(this.OPERATION_ID_COUNTER_KEY, String(newCounter));
    return `${Date.now()}_${newCounter}`;
  }

  /**
   * Add operation to queue
   *
   * @param {string} type - Operation type: 'attendance' | 'permit' | 'settings' | 'activity_log'
   * @param {string} operation - Operation: 'set' | 'update' | 'delete'
   * @param {string} path - Firebase path
   * @param {any} data - Data to save
   * @param {object} options - Additional options
   * @returns {object} The queued operation
   */
  static enqueue(type, operation, path, data, options = {}) {
    const queue = this.getQueue();

    const operationItem = {
      id: this.generateOperationId(),
      type,
      operation,
      path,
      data,
      queuedAt: Date.now(),
      retryCount: 0,
      lastError: null,
      priority: options.priority || 0,
      ...options
    };

    queue.push(operationItem);
    this.saveQueue(queue);

    console.log(`[OfflineQueueManager] Enqueued: ${type} ${operation} at ${path}`, {
      queueLength: queue.length,
      operationId: operationItem.id
    });

    return operationItem;
  }

  /**
   * Remove operation from queue by ID
   */
  static dequeue(operationId) {
    const queue = this.getQueue();
    const index = queue.findIndex(op => op.id === operationId);

    if (index !== -1) {
      const removed = queue.splice(index, 1)[0];
      this.saveQueue(queue);
      console.log(`[OfflineQueueManager] Dequeued: ${removed.id}`);
      return removed;
    }

    return null;
  }

  /**
   * Remove operations by path (for deduplication)
   */
  static removeByPath(path) {
    const queue = this.getQueue();
    const originalLength = queue.length;
    const filteredQueue = queue.filter(op => op.path !== path);

    if (filteredQueue.length !== originalLength) {
      this.saveQueue(filteredQueue);
      console.log(`[OfflineQueueManager] Removed ${originalLength - filteredQueue.length} operations for path: ${path}`);
    }

    return originalLength - filteredQueue.length;
  }

  /**
   * Get operation by ID
   */
  static getOperation(operationId) {
    const queue = this.getQueue();
    return queue.find(op => op.id === operationId) || null;
  }

  /**
   * Update operation in queue
   */
  static updateOperation(operationId, updates) {
    const queue = this.getQueue();
    const index = queue.findIndex(op => op.id === operationId);

    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      this.saveQueue(queue);
      return queue[index];
    }

    return null;
  }

  /**
   * Increment retry count for an operation
   */
  static incrementRetry(operationId, error) {
    const queue = this.getQueue();
    const index = queue.findIndex(op => op.id === operationId);

    if (index !== -1) {
      queue[index].retryCount++;
      queue[index].lastError = error;
      this.saveQueue(queue);
    }
  }

  /**
   * Get queue statistics
   */
  static getStats() {
    const queue = this.getQueue();
    const stats = {
      total: queue.length,
      byType: {},
      oldest: null,
      newest: null,
      pending: 0,
      failed: 0
    };

    queue.forEach(op => {
      // Count by type
      stats.byType[op.type] = (stats.byType[op.type] || 0) + 1;

      // Track oldest and newest
      if (!stats.oldest || op.queuedAt < stats.oldest.queuedAt) {
        stats.oldest = op;
      }
      if (!stats.newest || op.queuedAt > stats.newest.queuedAt) {
        stats.newest = op;
      }

      // Count pending and failed
      if (op.retryCount >= this.MAX_RETRY_ATTEMPTS) {
        stats.failed++;
      } else {
        stats.pending++;
      }
    });

    return stats;
  }

  /**
   * Clear entire queue
   */
  static clear() {
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify([]));
    console.log('[OfflineQueueManager] Queue cleared');
  }

  /**
   * Remove failed operations (exceeded max retries)
   */
  static clearFailed() {
    const queue = this.getQueue();
    const originalLength = queue.length;
    const filteredQueue = queue.filter(op => op.retryCount < this.MAX_RETRY_ATTEMPTS);

    if (filteredQueue.length !== originalLength) {
      this.saveQueue(filteredQueue);
      console.log(`[OfflineQueueManager] Cleared ${originalLength - filteredQueue.length} failed operations`);
    }

    return originalLength - filteredQueue.length;
  }

  /**
   * Process queue with given executor function
   *
   * @param {function} executor - Async function that executes a single operation
   * @param {object} options - Processing options
   * @returns {object} Processing result
   */
  static async processQueue(executor, options = {}) {
    const {
      onProgress = () => {},
      onError = () => {},
      onComplete = () => {},
      maxConcurrent = 1,
      stopOnError = false
    } = options;

    const queue = this.getQueue();
    const results = {
      total: queue.length,
      success: 0,
      failed: 0,
      skipped: 0,
      operations: []
    };

    // Sort by priority (higher first) then by queuedAt (older first)
    const sortedQueue = [...queue].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.queuedAt - b.queuedAt;
    });

    for (let i = 0; i < sortedQueue.length; i++) {
      const operation = sortedQueue[i];

      // Skip if already exceeded max retries
      if (operation.retryCount >= this.MAX_RETRY_ATTEMPTS) {
        results.skipped++;
        results.operations.push({ operation, status: 'skipped', reason: 'max_retries_exceeded' });
        continue;
      }

      onProgress({
        current: i + 1,
        total: sortedQueue.length,
        operation,
        results
      });

      try {
        await executor(operation);
        this.dequeue(operation.id);
        results.success++;
        results.operations.push({ operation, status: 'success' });
      } catch (error) {
        this.incrementRetry(operation.id, error.message);
        results.failed++;
        results.operations.push({ operation, status: 'failed', error: error.message });

        onError({
          operation,
          error,
          results,
          attempt: operation.retryCount + 1,
          maxRetries: this.MAX_RETRY_ATTEMPTS
        });

        if (stopOnError) {
          console.warn('[OfflineQueueManager] Stopping queue processing due to error');
          break;
        }
      }
    }

    onComplete(results);
    return results;
  }

  /**
   * Check if queue has pending operations
   */
  static hasPending() {
    const queue = this.getQueue();
    return queue.length > 0;
  }

  /**
   * Get estimated sync time based on average operation time
   */
  static estimateSyncTime(avgOperationTimeMs = 100) {
    const stats = this.getStats();
    return stats.pending * avgOperationTimeMs;
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OfflineQueueManager;
}

// Make available globally
window.OfflineQueueManager = OfflineQueueManager;

console.log('[OfflineQueueManager] Initialized');