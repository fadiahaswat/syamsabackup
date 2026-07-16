/**
 * Logger - Centralized Logging Utility
 *
 * Provides conditional logging based on environment and debug flags.
 * All modules should use this instead of console.log directly.
 *
 * Usage:
 *   import { Logger } from './shared/logger.js';
 *   Logger.debug('[Module]', 'message');  // Only in debug mode
 *   Logger.info('[Module]', 'message');   // Only in debug mode (change to warn for always)
 *   Logger.warn('[Module]', 'message');   // Always shown
 *   Logger.error('[Module]', 'message'); // Always shown
 */

const Logger = {
  // Debug flag - check localStorage and URL params
  _isDebug: null,

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled() {
    if (this._isDebug === null) {
      this._isDebug =
        localStorage.getItem('DEBUG_LOGS') === 'true' ||
        location.search.includes('debug=true') ||
        location.search.includes('debug=logs');
    }
    return this._isDebug;
  },

  /**
   * Enable debug mode
   */
  enableDebug() {
    this._isDebug = true;
    localStorage.setItem('DEBUG_LOGS', 'true');
  },

  /**
   * Disable debug mode
   */
  disableDebug() {
    this._isDebug = false;
    localStorage.removeItem('DEBUG_LOGS');
  },

  /**
   * Debug log - only in debug mode
   */
  debug(module, ...args) {
    if (this.isDebugEnabled()) {
      console.debug(`[${module}]`, ...args);
    }
  },

  /**
   * Info log - only in debug mode (quiet by default)
   */
  info(module, ...args) {
    if (this.isDebugEnabled()) {
      console.info(`[${module}]`, ...args);
    }
  },

  /**
   * Warn log - always shown (but hidden in production if needed)
   */
  warn(module, ...args) {
    if (this.isDebugEnabled()) {
      console.warn(`[${module}]`, ...args);
    }
  },

  /**
   * Error log - always shown
   */
  error(module, ...args) {
    console.error(`[${module}]`, ...args);
  },

  /**
   * Group logs for readability
   */
  group(module, label, fn) {
    if (this.isDebugEnabled()) {
      console.group(`[${module}] ${label}`);
      fn();
      console.groupEnd();
    }
  },

  /**
   * Table log for structured data
   */
  table(module, data) {
    if (this.isDebugEnabled()) {
      console.log(`[${module}]`);
      console.table(data);
    }
  },

  /**
   * Time tracking
   */
  time(module) {
    if (this.isDebugEnabled()) {
      console.time(`[${module}]`);
    }
  },

  timeEnd(module) {
    if (this.isDebugEnabled()) {
      console.timeEnd(`[${module}]`);
    }
  },
};

// ==========================================
// MODULE-SPECIFIC LOGGERS
// ==========================================

const LocalDBLogger = {
  debug: (...args) => Logger.debug('LocalDB', ...args),
  info: (...args) => Logger.info('LocalDB', ...args),
  warn: (...args) => Logger.warn('LocalDB', ...args),
  error: (...args) => Logger.error('LocalDB', ...args),
};

const SyncQueueLogger = {
  debug: (...args) => Logger.debug('SyncQueue', ...args),
  info: (...args) => Logger.info('SyncQueue', ...args),
  warn: (...args) => Logger.warn('SyncQueue', ...args),
  error: (...args) => Logger.error('SyncQueue', ...args),
};

const StorageLogger = {
  debug: (...args) => Logger.debug('Storage', ...args),
  info: (...args) => Logger.info('Storage', ...args),
  warn: (...args) => Logger.warn('Storage', ...args),
  error: (...args) => Logger.error('Storage', ...args),
};

const RepositoryLogger = {
  debug: (...args) => Logger.debug('Repository', ...args),
  info: (...args) => Logger.info('Repository', ...args),
  warn: (...args) => Logger.warn('Repository', ...args),
  error: (...args) => Logger.error('Repository', ...args),
};

const MigratorLogger = {
  debug: (...args) => Logger.debug('DataMigrator', ...args),
  info: (...args) => Logger.info('DataMigrator', ...args),
  warn: (...args) => Logger.warn('DataMigrator', ...args),
  error: (...args) => Logger.error('DataMigrator', ...args),
};

const SupabaseSyncLogger = {
  debug: (...args) => Logger.debug('SupabaseSync', ...args),
  info: (...args) => Logger.info('SupabaseSync', ...args),
  warn: (...args) => Logger.warn('SupabaseSync', ...args),
  error: (...args) => Logger.error('SupabaseSync', ...args),
};

const StateLogger = {
  debug: (...args) => Logger.debug('StateManager', ...args),
  info: (...args) => Logger.info('StateManager', ...args),
  warn: (...args) => Logger.warn('StateManager', ...args),
  error: (...args) => Logger.error('StateManager', ...args),
};

// ==========================================
// EXPORTS
// ==========================================

window.Logger = Logger;
window.LocalDBLogger = LocalDBLogger;
window.SyncQueueLogger = SyncQueueLogger;
window.StorageLogger = StorageLogger;
window.RepositoryLogger = RepositoryLogger;
window.MigratorLogger = MigratorLogger;
window.SupabaseSyncLogger = SupabaseSyncLogger;
window.StateLogger = StateLogger;

// Also expose for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Logger,
    LocalDBLogger,
    SyncQueueLogger,
    StorageLogger,
    RepositoryLogger,
    MigratorLogger,
    SupabaseSyncLogger,
    StateLogger,
  };
}
