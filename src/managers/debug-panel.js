/**
 * DatabaseDebug - Simple Debug Panel for Local Database
 *
 * Features:
 * - View current state version
 * - View storage usage
 * - View recent state changes
 * - Toggle debug logging
 * - Force save
 * - Export data
 */

class DatabaseDebug {
  constructor() {
    this.isOpen = false;
    this.logs = [];
    this.maxLogs = 50;
    this.enabled = false; // Disabled by default
  }

  /**
   * Toggle debug panel
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Open debug panel
   */
  open() {
    if (this.isOpen) return;

    this.isOpen = true;

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'db-debug-panel';
    panel.className = 'fixed bottom-20 right-4 z-[9999] w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300';
    panel.innerHTML = this._getPanelHTML();

    document.body.appendChild(panel);

    // Setup event listeners
    this._setupListeners();

    // Refresh data
    this.refresh();

    console.log('[DatabaseDebug] Panel opened');
  }

  /**
   * Close debug panel
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;

    const panel = document.getElementById('db-debug-panel');
    if (panel) panel.remove();

    console.log('[DatabaseDebug] Panel closed');
  }

  /**
   * Get panel HTML
   */
  _getPanelHTML() {
    return `
      <div class="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
            </svg>
          </div>
          <span class="font-bold text-white text-sm">Database Debug</span>
        </div>
        <button onclick="window.dbDebug?.close()" class="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div class="p-4 space-y-4 max-h-96 overflow-y-auto" id="db-debug-content">
        <div class="text-center text-xs text-slate-400 py-8">Loading...</div>
      </div>

      <div class="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 flex gap-2">
        <button onclick="window.dbDebug?.refresh()" class="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors">
          Refresh
        </button>
        <button onclick="window.dbDebug?.forceSave()" class="flex-1 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 transition-colors">
          Force Save
        </button>
        <button onclick="window.dbDebug?.exportData()" class="flex-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 transition-colors">
          Export
        </button>
      </div>
    `;
  }

  /**
   * Setup event listeners
   */
  _setupListeners() {
    // No additional listeners needed
  }

  /**
   * Refresh panel data
   */
  refresh() {
    const content = document.getElementById('db-debug-content');
    if (!content) return;

    const version = appState?._version || 0;
    const attendanceDates = Object.keys(appState?.attendanceData || {}).length;
    const permitsCount = (appState?.permits || []).length;
    const settingsKeys = Object.keys(appState?.settings || {}).length;

    // Calculate storage usage
    let storageUsage = 0;
    const keys = ['musyrif_app_v5_fix', 'musyrif_permits_db', 'musyrif_settings', 'musyrif_activity_log'];
    const storageDetails = [];

    keys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          const size = new Blob([data]).size;
          storageUsage += size;
          storageDetails.push({
            key: key.replace('musyrif_', '').replace('_db', ''),
            size: this._formatSize(size)
          });
        }
      } catch (e) {}
    });

    // Recent activity logs
    const recentLogs = (appState?.activityLog || []).slice(0, 5).map(log => {
      const time = log.timestamp ? new Date(log.timestamp) : new Date();
      return {
        action: log.action || 'Unknown',
        detail: (log.detail || '').substring(0, 50),
        time: time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      };
    });

    content.innerHTML = `
      <!-- State Version -->
      <div class="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-4 border border-indigo-100 dark:border-indigo-800/30">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-indigo-600 dark:text-indigo-400">State Version</span>
          <span class="px-2 py-0.5 bg-indigo-500 text-white rounded-full text-xs font-bold">v${version}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <div class="text-lg font-bold text-slate-800 dark:text-white">${attendanceDates}</div>
            <div class="text-[10px] text-slate-500">Dates</div>
          </div>
          <div>
            <div class="text-lg font-bold text-slate-800 dark:text-white">${permitsCount}</div>
            <div class="text-[10px] text-slate-500">Permits</div>
          </div>
          <div>
            <div class="text-lg font-bold text-slate-800 dark:text-white">${settingsKeys}</div>
            <div class="text-[10px] text-slate-500">Settings</div>
          </div>
        </div>
      </div>

      <!-- Storage Usage -->
      <div class="rounded-xl bg-slate-50 dark:bg-slate-800/30 p-4 border border-slate-100 dark:border-slate-700/50">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400">LocalStorage Usage</span>
          <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${this._formatSize(storageUsage)}</span>
        </div>
        <div class="space-y-1.5">
          ${storageDetails.map(item => `
            <div class="flex justify-between items-center text-xs">
              <span class="text-slate-500 dark:text-slate-400">${item.key}</span>
              <span class="font-mono text-slate-600 dark:text-slate-300">${item.size}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Recent Logs -->
      <div class="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-100 dark:border-amber-800/30">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-medium text-amber-600 dark:text-amber-400">Recent Activity</span>
          <span class="text-[10px] text-amber-500">Last 5</span>
        </div>
        <div class="space-y-2">
          ${recentLogs.length > 0 ? recentLogs.map(log => `
            <div class="flex justify-between items-start gap-2 text-xs">
              <div class="flex-1 min-w-0">
                <div class="font-medium text-slate-700 dark:text-slate-300 truncate">${log.action}</div>
                <div class="text-slate-400 dark:text-slate-500 truncate">${log.detail}</div>
              </div>
              <span class="text-slate-400 dark:text-slate-500 shrink-0">${log.time}</span>
            </div>
          `).join('') : '<div class="text-xs text-slate-400 text-center py-2">No activity logs</div>'}
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="rounded-xl bg-slate-50 dark:bg-slate-800/30 p-4 border border-slate-100 dark:border-slate-700/50">
        <div class="text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">Quick Info</div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="bg-white dark:bg-slate-800 rounded-lg p-2">
            <div class="font-bold text-emerald-600 dark:text-emerald-400">${navigator.onLine ? '🟢 Online' : '🔴 Offline'}</div>
            <div class="text-slate-400">Connection</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg p-2">
            <div class="font-bold text-slate-700 dark:text-slate-300">${appState?.selectedClass || 'None'}</div>
            <div class="text-slate-400">Class</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg p-2">
            <div class="font-bold text-slate-700 dark:text-slate-300">${appState?.currentSlotId || 'shubuh'}</div>
            <div class="text-slate-400">Slot</div>
          </div>
          <div class="bg-white dark:bg-slate-800 rounded-lg p-2">
            <div class="font-bold text-slate-700 dark:text-slate-300">${FILTERED_SANTRI?.length || 0}</div>
            <div class="text-slate-400">Students</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Force save data
   */
  forceSave() {
    if (window.saveData) {
      window.saveData();
    }

    if (window.storageManager?.saveNow) {
      window.storageManager.saveNow();
    }

    // Also save directly
    try {
      localStorage.setItem('musyrif_app_v5_fix', JSON.stringify(appState?.attendanceData || {}));
      localStorage.setItem('musyrif_permits_db', JSON.stringify(appState?.permits || []));
      localStorage.setItem('musyrif_settings', JSON.stringify(appState?.settings || {}));
      localStorage.setItem('musyrif_activity_log', JSON.stringify(appState?.activityLog || []));

      window.showToast?.('Data tersimpan!', 'success');
    } catch (e) {
      window.showToast?.('Gagal menyimpan: ' + e.message, 'error');
    }

    this.refresh();
  }

  /**
   * Export all data
   */
  exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      appVersion: window.APP_VERSION || 'unknown',
      state: {
        selectedClass: appState?.selectedClass,
        currentSlotId: appState?.currentSlotId,
        date: appState?.date,
        _version: appState?._version,
      },
      attendanceData: appState?.attendanceData || {},
      permits: appState?.permits || [],
      settings: appState?.settings || {},
      activityLog: appState?.activityLog || [],
      localStorage: {}
    };

    // Add localStorage data
    ['musyrif_app_v5_fix', 'musyrif_permits_db', 'musyrif_settings', 'musyrif_activity_log', 'musyrif_google_session'].forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          data.localStorage[key] = JSON.parse(value);
        }
      } catch (e) {}
    });

    // Download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `musyrif_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    window.showToast?.('Data berhasil di-export!', 'success');
  }

  /**
   * Format byte size
   */
  _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  /**
   * Log to debug panel
   */
  log(action, detail) {
    this.logs.unshift({
      action,
      detail,
      timestamp: new Date()
    });

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    console.log(`[DatabaseDebug] ${action}: ${detail}`);
  }
}

// Create singleton
const dbDebug = new DatabaseDebug();

// Export
window.DatabaseDebug = DatabaseDebug;
window.dbDebug = dbDebug;

// Add keyboard shortcut: Ctrl+Shift+D
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    dbDebug.toggle();
  }
});

console.log('[DatabaseDebug] Module loaded - Press Ctrl+Shift+D to open');
