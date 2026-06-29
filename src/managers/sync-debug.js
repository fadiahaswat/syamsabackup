/**
 * SyncDebug - Debug Console for LocalStorage Data
 *
 * Tool untuk debugging data lokal dan storage.
 * Buka dengan menjalankan: window.openSyncDebug()
 * Konversi dari cloud sync debug ke localStorage only mode.
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

    // Auto-refresh every 10 seconds
    this.autoRefreshInterval = setInterval(() => this.refresh(), 10000);

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
        <div class="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-blue-500">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"/>
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-bold text-white">Storage Debug Console</h2>
              <p class="text-xs text-white/70">LocalStorage data management</p>
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
              Refresh
            </button>
            <button onclick="window.syncDebug?.exportData()" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              Export Data
            </button>
            <button onclick="window.syncDebug?.clearData()" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">
              Clear All Data
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
        storageInfo,
        appDataInfo,
        permitsInfo,
        tahfizhInfo,
        recentLogs
      ] = await Promise.all([
        this.getStorageInfo(),
        this.getAppDataInfo(),
        this.getPermitsInfo(),
        this.getTahfizhInfo(),
        this.getRecentLogs()
      ]);

      content.innerHTML = `
        <!-- Storage Overview -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            Storage Overview
          </div>
          <div class="p-4 grid grid-cols-2 gap-4">
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full ${storageInfo.available ? 'bg-emerald-500' : 'bg-red-500'}"></div>
              <span>LocalStorage: ${storageInfo.available ? 'Available' : 'Unavailable'}</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full ${storageInfo.quotaPercent < 80 ? 'bg-emerald-500' : storageInfo.quotaPercent < 95 ? 'bg-amber-500' : 'bg-red-500'}"></div>
              <span>Usage: ${storageInfo.quotaPercent.toFixed(1)}%</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Mode: Local Only</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-3 h-3 rounded-full bg-slate-400"></div>
              <span>Keys: ${storageInfo.keyCount}</span>
            </div>
          </div>
        </div>

        <!-- App Data -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            App Data
          </div>
          <div class="p-4">
            <div class="grid grid-cols-4 gap-4 text-center mb-4">
              <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <div class="text-2xl font-bold text-blue-600">${appDataInfo.attendanceCount}</div>
                <div class="text-xs text-blue-600">Attendance Records</div>
              </div>
              <div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                <div class="text-2xl font-bold text-emerald-600">${permitsInfo.totalCount}</div>
                <div class="text-xs text-emerald-600">Permits</div>
              </div>
              <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <div class="text-2xl font-bold text-purple-600">${tahfizhInfo.totalCount}</div>
                <div class="text-xs text-purple-600">Tahfizh Records</div>
              </div>
              <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <div class="text-2xl font-bold text-amber-600">${recentLogs.length}</div>
                <div class="text-xs text-amber-600">Activity Logs</div>
              </div>
            </div>
            <div class="text-sm text-slate-500">
              Storage Used: ${(appDataInfo.totalSize + permitsInfo.size + tahfizhInfo.size).toFixed(2)} KB
            </div>
          </div>
        </div>

        <!-- Storage Keys -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            Storage Keys (${storageInfo.keyCount})
          </div>
          <div class="p-4 max-h-48 overflow-y-auto">
            ${storageInfo.keys.length > 0 ? storageInfo.keys.map(key => `
              <div class="text-xs font-mono py-1 px-2 rounded mb-1 bg-slate-50 dark:bg-slate-800 flex justify-between">
                <span class="truncate">${key.name}</span>
                <span class="text-slate-400">${key.size} B</span>
              </div>
            `).join('') : '<div class="text-slate-400 text-sm">No keys found</div>'}
          </div>
        </div>

        <!-- Permits Summary -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            Permits Summary
          </div>
          <div class="p-4">
            <div class="grid grid-cols-3 gap-4 text-center">
              <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                <div class="text-xl font-bold text-amber-600">${permitsInfo.pendingCount}</div>
                <div class="text-xs text-amber-600">Pending</div>
              </div>
              <div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
                <div class="text-xl font-bold text-emerald-600">${permitsInfo.approvedCount}</div>
                <div class="text-xs text-emerald-600">Approved</div>
              </div>
              <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                <div class="text-xl font-bold text-red-600">${permitsInfo.rejectedCount}</div>
                <div class="text-xs text-red-600">Rejected</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tahfizh Summary -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            Tahfizh Summary
          </div>
          <div class="p-4">
            <div class="grid grid-cols-2 gap-4 text-center">
              <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                <div class="text-xl font-bold text-purple-600">${tahfizhInfo.syncedCount}</div>
                <div class="text-xs text-purple-600">Saved</div>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <div class="text-xl font-bold text-slate-600">${(tahfizhInfo.size / 1024).toFixed(2)} KB</div>
                <div class="text-xs text-slate-600">Storage Size</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Activity Logs -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-bold text-sm flex items-center gap-2">
            Recent Activity Logs (Last 5)
          </div>
          <div class="p-4 max-h-48 overflow-y-auto">
            ${recentLogs.length > 0 ? recentLogs.map(log => `
              <div class="py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div class="text-xs font-bold text-slate-700 dark:text-slate-300">${log.action || 'System'}</div>
                <div class="text-xs text-slate-500 truncate">${log.detail || ''}</div>
                <div class="text-[10px] text-slate-400 mt-1">${log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}</div>
              </div>
            `).join('') : '<div class="text-slate-400 text-sm">No activity logs</div>'}
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
   * Get storage overview info
   */
  getStorageInfo() {
    let totalSize = 0;
    const keys = [];

    try {
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key);
          const size = (key.length + (value?.length || 0)) * 2; // UTF-16 encoding
          totalSize += size;
          keys.push({ name: key, size: size });
        }
      }
    } catch (e) {
      console.error('[SyncDebug] Error getting storage info:', e);
    }

    // Estimate quota (localStorage typically has ~5MB limit)
    const estimatedQuota = 5 * 1024 * 1024; // 5MB
    const quotaPercent = (totalSize / estimatedQuota) * 100;

    return {
      available: true,
      totalSize,
      quotaPercent,
      keyCount: keys.length,
      keys: keys.sort((a, b) => b.size - a.size).slice(0, 20)
    };
  }

  /**
   * Get app data info
   */
  getAppDataInfo() {
    let totalSize = 0;
    let attendanceCount = 0;

    try {
      // Count attendance records
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key) && key.startsWith('musyrif_attendance_')) {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            // Count dates with data
            attendanceCount += Object.keys(parsed).length;
            totalSize += data.length * 2;
          }
        }
      }

      // Auth data
      const authKey = localStorage.getItem('musyrif_auth_v2');
      if (authKey) totalSize += authKey.length * 2;
    } catch (e) {
      console.error('[SyncDebug] Error getting app data:', e);
    }

    return { totalSize, attendanceCount };
  }

  /**
   * Get permits info
   */
  getPermitsInfo() {
    let size = 0;
    let totalCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    try {
      const permitsData = localStorage.getItem('musyrif_permits_db');
      if (permitsData) {
        const permits = JSON.parse(permitsData);
        totalCount = permits.length;

        permits.forEach(p => {
          const status = String(p.status || '').toLowerCase();
          if (status === 'pending') pendingCount++;
          else if (status === 'approved') approvedCount++;
          else if (status === 'rejected') rejectedCount++;
        });

        size = permitsData.length * 2;
      }
    } catch (e) {
      console.error('[SyncDebug] Error getting permits info:', e);
    }

    return { size, totalCount, pendingCount, approvedCount, rejectedCount };
  }

  /**
   * Get tahfizh info
   */
  getTahfizhInfo() {
    let size = 0;
    let totalCount = 0;
    let syncedCount = 0;

    try {
      const setoranData = localStorage.getItem('tahfizh_local_setoran');
      if (setoranData) {
        const setoran = JSON.parse(setoranData);
        totalCount = setoran.length;
        syncedCount = setoran.filter(r => r.synced).length;
        size = setoranData.length * 2;
      }
    } catch (e) {
      console.error('[SyncDebug] Error getting tahfizh info:', e);
    }

    return { size, totalCount, syncedCount };
  }

  /**
   * Get recent logs
   */
  getRecentLogs() {
    try {
      const logsData = localStorage.getItem('local_activity_logs');
      if (logsData) {
        const logs = JSON.parse(logsData);
        return logs.slice(0, 10);
      }
    } catch (e) {
      console.error('[SyncDebug] Error getting logs:', e);
    }
    return [];
  }

  /**
   * Export all data as JSON
   */
  exportData() {
    try {
      const data = {};

      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          try {
            data[key] = JSON.parse(localStorage.getItem(key));
          } catch {
            data[key] = localStorage.getItem(key);
          }
        }
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `musyrif_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      window.showToast?.('Data exported successfully!', 'success');
    } catch (error) {
      window.showToast?.('Export failed: ' + error.message, 'error');
    }
  }

  /**
   * Clear all localStorage data (with confirmation)
   */
  clearData() {
    if (!confirm('Clear ALL localStorage data? This cannot be undone!')) return;

    if (!confirm('Are you absolutely sure? All attendance, permits, and settings will be deleted!')) return;

    try {
      localStorage.clear();
      window.showToast?.('All data cleared. Refreshing...', 'info');
      setTimeout(() => location.reload(), 1000);
    } catch (error) {
      window.showToast?.('Clear failed: ' + error.message, 'error');
    }
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

console.log('[SyncDebug] Debug module loaded (localStorage mode). Run window.openSyncDebug() to open.');
