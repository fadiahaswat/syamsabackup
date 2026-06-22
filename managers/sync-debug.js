/**
 * SyncDebug - Debug Console for Cloud Sync Issues
 *
 * Tool untuk debugging sinkronisasi data antar device.
 * Buka dengan menjalankan: window.openSyncDebug()
 */

class SyncDebug {
  constructor() {
    this.modalId = 'sync-debug-modal';
    this.isOpen = false;
  }

  /**
   * Open debug modal
   */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;

    const modal = document.createElement('div');
    modal.id = this.modalId;
    modal.className = 'fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML = this.getModalHTML();

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.close();
    });

    // Initial refresh
    this.refresh();

    // Auto-refresh every 5 seconds
    this.autoRefreshInterval = setInterval(() => this.refresh(), 5000);

    console.log('[SyncDebug] Debug panel opened');
  }

  /**
   * Close debug modal
   */
  close() {
    this.isOpen = false;
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
    const modal = document.getElementById(this.modalId);
    if (modal) modal.remove();
    console.log('[SyncDebug] Debug panel closed');
  }

  /**
   * Get modal HTML
   */
  getModalHTML() {
    return `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-500 to-teal-500">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-bold text-white">Sync Debug Console</h2>
              <p class="text-xs text-white/70">Troubleshooting cloud synchronization</p>
            </div>
          </div>
          <button onclick="window.syncDebug?.close()" class="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4" id="sync-debug-content">
          Loading...
        </div>

        <!-- Footer Actions -->
        <div class="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div class="flex flex-wrap gap-2">
            <button onclick="window.syncDebug?.refresh()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">
              🔄 Refresh
            </button>
            <button onclick="window.syncDebug?.forceSync()" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              ⚡ Force Sync Now
            </button>
            <button onclick="window.syncDebug?.clearQueue()" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors">
              🗑️ Clear Queue
            </button>
            <button onclick="window.syncDebug?.testConnection()" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors">
              🌐 Test Connection
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Refresh debug info
   */
  async refresh() {
    const content = document.getElementById('sync-debug-content');
    if (!content) return;

    try {
      const [
        syncStatus,
        queueStats,
        localStorageSize,
        supabaseStatus,
        lastLogs
      ] = await Promise.all([
        window.hybridStorageManager?.getSyncStatus() || {},
        window.syncQueue?.getStats() || {},
        this.getLocalStorageSize(),
        this.getSupabaseStatus(),
        this.getRecentLogs()
      ]);

      content.innerHTML = `
        <!-- Connection Status -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            🌐 Connection Status
          </div>
          <div class="p-4 grid grid-cols-2 gap-4">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full ${syncStatus.isOnline ? 'bg-emerald-500' : 'bg-red-500'}"></div>
              <span>${syncStatus.isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full ${supabaseStatus.configured ? 'bg-emerald-500' : 'bg-red-500'}"></div>
              <span>Supabase: ${supabaseStatus.configured ? 'Configured' : 'Not Configured'}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full ${supabaseStatus.authenticated ? 'bg-emerald-500' : 'bg-amber-500'}"></div>
              <span>Auth: ${supabaseStatus.authenticated ? 'Logged In' : 'Not Logged In'}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full ${syncStatus.isSyncing ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}"></div>
              <span>${syncStatus.isSyncing ? 'Syncing...' : 'Idle'}</span>
            </div>
          </div>
        </div>

        <!-- Sync Queue -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            📋 Sync Queue Status
          </div>
          <div class="p-4">
            <div class="grid grid-cols-4 gap-4 text-center mb-4">
              <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <div class="text-2xl font-bold text-amber-600">${queueStats.pending || 0}</div>
                <div class="text-xs text-amber-600">Pending</div>
              </div>
              <div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                <div class="text-2xl font-bold text-emerald-600">${queueStats.synced || 0}</div>
                <div class="text-xs text-emerald-600">Synced</div>
              </div>
              <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <div class="text-2xl font-bold text-red-600">${queueStats.failed || 0}</div>
                <div class="text-xs text-red-600">Failed</div>
              </div>
              <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <div class="text-2xl font-bold text-purple-600">${queueStats.conflict || 0}</div>
                <div class="text-xs text-purple-600">Conflicts</div>
              </div>
            </div>
            <div class="text-sm text-slate-500">
              Last Sync: ${syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString('id-ID') : 'Never'}
            </div>
          </div>
        </div>

        <!-- Storage Info -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            💾 Local Storage
          </div>
          <div class="p-4 grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm text-slate-500">Attendance Data</div>
              <div class="font-medium">${localStorageSize.attendance} KB</div>
            </div>
            <div>
              <div class="text-sm text-slate-500">Permits</div>
              <div class="font-medium">${localStorageSize.permits} KB</div>
            </div>
            <div>
              <div class="text-sm text-slate-500">Total Used</div>
              <div class="font-medium">${localStorageSize.total} KB</div>
            </div>
            <div>
              <div class="text-sm text-slate-500">Mode</div>
              <div class="font-medium">${window.APP_STORAGE?.mode || 'unknown'}</div>
            </div>
          </div>
        </div>

        <!-- Supabase Info -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            ☁️ Supabase Details
          </div>
          <div class="p-4">
            <div class="grid grid-cols-1 gap-2 text-sm">
              <div><span class="text-slate-500">URL:</span> <span class="font-mono text-xs">${supabaseStatus.url || 'Not configured'}</span></div>
              <div><span class="text-slate-500">User:</span> ${supabaseStatus.userEmail || 'Not logged in'}</div>
              <div><span class="text-slate-500">Storage Mode:</span> ${window.APP_STORAGE?.mode}</div>
            </div>
          </div>
        </div>

        <!-- Pending Changes -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            📝 Pending Changes (Last 10)
          </div>
          <div class="p-4 max-h-48 overflow-y-auto">
            ${lastLogs.length > 0 ? lastLogs.map(log => `
              <div class="text-xs font-mono py-1 px-2 rounded mb-1 ${log.type === 'attendance' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-purple-50 dark:bg-purple-900/20'}">
                <span class="font-bold">[${log.entityType}]</span> ${log.operation} - ${new Date(log.timestamp).toLocaleTimeString('id-ID')}
                <br><span class="text-slate-500">ID: ${log.entityId}</span>
              </div>
            `).join('') : '<div class="text-slate-400 text-sm">No pending changes</div>'}
          </div>
        </div>

        <!-- Recent Console Logs -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            📜 Recent Logs
          </div>
          <div class="p-4 max-h-48 overflow-y-auto font-mono text-xs">
            ${lastLogs.slice(0, 5).map(log => `
              <div class="py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <span class="text-slate-400">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="ml-2">${log.message}</span>
              </div>
            `).join('') || '<div class="text-slate-400 text-sm">No logs available</div>'}
          </div>
        </div>
      `;
    } catch (error) {
      content.innerHTML = `
        <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-red-600">
          <strong>Error loading debug info:</strong><br>
          ${error.message}
        </div>
      `;
    }
  }

  /**
   * Get local storage size
   */
  getLocalStorageSize() {
    let attendance = 0;
    let permits = 0;
    let total = 0;

    try {
      const attData = localStorage.getItem('musyrif_app_v5_fix');
      const permitData = localStorage.getItem('musyrif_permits_db');

      if (attData) attendance = new Blob([attData]).size / 1024;
      if (permitData) permits = new Blob([permitData]).size / 1024;
      total = attendance + permits;
    } catch (e) {
      console.error('[SyncDebug] Error getting storage size:', e);
    }

    return {
      attendance: attendance.toFixed(2),
      permits: permits.toFixed(2),
      total: total.toFixed(2)
    };
  }

  /**
   * Get Supabase status
   */
  getSupabaseStatus() {
    const config = window.APP_STORAGE?.supabase || {};
    const client = window.supabaseClient;

    return {
      configured: !!(config.url && config.anonKey),
      url: config.url || null,
      authenticated: !!(client?.currentUser),
      userEmail: client?.currentUser?.email || null
    };
  }

  /**
   * Get recent logs from sync queue
   */
  async getRecentLogs() {
    try {
      if (!window.syncQueue?.db) return [];
      const changes = await window.syncQueue.export();
      return changes.slice(-10).reverse();
    } catch (e) {
      return [];
    }
  }

  /**
   * Force sync now
   */
  async forceSync() {
    console.log('[SyncDebug] Force sync triggered');

    const status = window.hybridStorageManager?.getSyncStatus();
    if (!status?.isOnline) {
      window.showToast?.('Cannot sync while offline!', 'error');
      return;
    }

    try {
      await window.hybridStorageManager?.syncNow();
      window.showToast?.('Sync triggered! Check console for details.', 'success');
      setTimeout(() => this.refresh(), 1000);
    } catch (error) {
      window.showToast?.('Sync failed: ' + error.message, 'error');
    }
  }

  /**
   * Clear sync queue
   */
  async clearQueue() {
    if (!confirm('Clear all pending sync changes? This cannot be undone!')) return;

    try {
      await window.syncQueue?.clearAll();
      window.showToast?.('Sync queue cleared!', 'success');
      this.refresh();
    } catch (error) {
      window.showToast?.('Failed to clear queue: ' + error.message, 'error');
    }
  }

  /**
   * Test connection to Supabase
   */
  async testConnection() {
    console.log('[SyncDebug] Testing Supabase connection...');

    const status = this.getSupabaseStatus();

    if (!status.configured) {
      window.showToast?.('Supabase not configured!', 'error');
      return;
    }

    try {
      const startTime = Date.now();
      const response = await fetch(status.url + '/rest/v1/', {
        method: 'GET',
        headers: {
          'apikey': window.APP_STORAGE.supabase.anonKey,
          'Authorization': `Bearer ${window.APP_STORAGE.supabase.anonKey}`
        }
      });
      const latency = Date.now() - startTime;

      if (response.ok) {
        window.showToast?.(`Connection OK! Latency: ${latency}ms`, 'success');
      } else {
        window.showToast?.(`Connection error: ${response.status}`, 'error');
      }
    } catch (error) {
      window.showToast?.('Connection failed: ' + error.message, 'error');
    }

    this.refresh();
  }

  /**
   * Add debug log entry
   */
  log(message, type = 'info') {
    const logEntry = {
      timestamp: Date.now(),
      message,
      type
    };
    console.log(`[SyncDebug] ${message}`);
  }
}

// Create singleton instance
const syncDebug = new SyncDebug();

// Export
window.SyncDebug = SyncDebug;
window.syncDebug = syncDebug;

// Also create global function for easy access
window.openSyncDebug = () => syncDebug.open();
window.closeSyncDebug = () => syncDebug.close();

console.log('[SyncDebug] Debug module loaded. Run window.openSyncDebug() to open.');
