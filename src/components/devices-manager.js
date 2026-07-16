/**
 * DeviceManager Component - UI for Multidevice Management
 *
 * Provides UI for:
 * - Viewing connected devices
 * - Managing active sessions
 * - Remote logout
 * - Device removal
 */

class DeviceManager {
  constructor(authManager) {
    this.authManager = authManager;
    this.container = null;
    this.currentDeviceId = null;
    this._logger = window.Logger || console;
  }

  /**
   * Initialize the component
   * @param {HTMLElement|string} container - Container element or selector
   */
  async init(container) {
    if (typeof container === 'string') {
      this.container = document.querySelector(container);
    } else {
      this.container = container;
    }

    if (!this.container) {
      this._logger.error('DeviceManager: Container not found');
      return;
    }

    this.currentDeviceId = this.authManager.getDeviceId();
    await this.render();
    this.attachEventListeners();
  }

  /**
   * Load and render template
   */
  async render() {
    const template = document.getElementById('device-manager-template');
    if (!template) {
      this._logger.error('DeviceManager: Template not found');
      return;
    }

    const content = template.content.cloneNode(true);
    this.container.innerHTML = '';
    this.container.appendChild(content);

    await this.loadDevices();
    await this.loadSessions();

    // Re-initialize icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /**
   * Load and display devices
   */
  async loadDevices() {
    try {
      const devices = await this.authManager.getDevices();
      const currentDeviceCard = document.getElementById('current-device-card');
      const otherDevicesList = document.getElementById('other-devices-list');
      const emptyState = document.getElementById('devices-empty');

      if (!devices || devices.length === 0) {
        if (currentDeviceCard) currentDeviceCard.classList.add('hidden');
        if (otherDevicesList) otherDevicesList.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }

      // Separate current device from others
      const currentDevice = devices.find(d => d.device_id === this.currentDeviceId);
      const otherDevices = devices.filter(d => d.device_id !== this.currentDeviceId);

      // Render current device
      if (currentDevice) {
        this._renderCurrentDevice(currentDevice);
        if (currentDeviceCard) currentDeviceCard.classList.remove('hidden');
      }

      // Render other devices
      if (otherDevices.length > 0) {
        if (otherDevicesList) {
          otherDevicesList.classList.remove('hidden');
          otherDevicesList.innerHTML = '';
          otherDevices.forEach(device => {
            const row = this._createDeviceRow(device, false);
            otherDevicesList.appendChild(row);
          });
        }
      } else {
        if (otherDevicesList) otherDevicesList.classList.add('hidden');
      }

      if (emptyState) emptyState.classList.add('hidden');

    } catch (error) {
      this._logger.error('Error loading devices:', error);
    }
  }

  /**
   * Render current device info
   */
  _renderCurrentDevice(device) {
    const nameEl = document.getElementById('current-device-name');
    const metaEl = document.getElementById('current-device-meta');
    const lastActiveEl = document.getElementById('current-device-last-active');

    if (nameEl) {
      nameEl.textContent = device.device_name || 'Perangkat Ini';
    }

    if (metaEl) {
      const parts = [];
      if (device.device_type) parts.push(device.device_type);
      if (device.browser) parts.push(device.browser);
      if (device.os) parts.push(device.os);
      metaEl.textContent = parts.join(' • ') || '-';
    }

    if (lastActiveEl) {
      lastActiveEl.textContent = `Aktif terakhir: ${this._formatDate(device.last_active)}`;
    }
  }

  /**
   * Create device row element
   */
  _createDeviceRow(device, isCurrent) {
    const template = document.getElementById('device-card-template');
    if (!template) return null;

    const content = template.content.cloneNode(true);
    const row = content.querySelector('.device-card');

    if (isCurrent) {
      row.classList.add('current');
    }

    const nameEl = row.querySelector('.device-name');
    const metaEl = row.querySelector('.device-meta');
    const lastActiveEl = row.querySelector('.device-last-active');
    const removeBtn = row.querySelector('.btn-remove-device');

    if (nameEl) nameEl.textContent = device.device_name || 'Unknown Device';

    if (metaEl) {
      const parts = [];
      if (device.device_type) parts.push(device.device_type);
      if (device.browser) parts.push(device.browser);
      if (device.os) parts.push(device.os);
      metaEl.textContent = parts.join(' • ') || '-';
    }

    if (lastActiveEl) {
      lastActiveEl.textContent = `Aktif terakhir: ${this._formatDate(device.last_active)}`;
    }

    if (removeBtn && !isCurrent) {
      removeBtn.addEventListener('click', () => this._removeDevice(device.device_id));
    } else if (removeBtn) {
      removeBtn.classList.add('hidden');
    }

    return row;
  }

  /**
   * Load and display sessions
   */
  async loadSessions() {
    try {
      const sessions = await this.authManager.getActiveSessions();
      const sessionsList = document.getElementById('sessions-list');

      if (!sessionsList) return;

      sessionsList.innerHTML = '';

      if (!sessions || sessions.length === 0) {
        sessionsList.innerHTML = `
          <div class="text-center py-4 text-sm text-slate-500 dark:text-slate-400">
            Tidak ada sesi aktif
          </div>
        `;
        return;
      }

      sessions.forEach(session => {
        const row = this._createSessionRow(session);
        sessionsList.appendChild(row);
      });

    } catch (error) {
      this._logger.error('Error loading sessions:', error);
    }
  }

  /**
   * Create session row element
   */
  _createSessionRow(session) {
    const template = document.getElementById('session-row-template');
    if (!template) return null;

    const content = template.content.cloneNode(true);
    const row = content.querySelector('.session-row');

    const nameEl = row.querySelector('.device-name');
    const metaEl = row.querySelector('.session-meta');
    const revokeBtn = row.querySelector('.btn-revoke-session');

    if (nameEl) {
      nameEl.textContent = session.device_name || 'Unknown Device';
    }

    if (metaEl) {
      const expiresText = session.expires_at
        ? `Berakhir: ${this._formatDate(session.expires_at)}`
        : 'Tidak ada batas waktu';
      metaEl.textContent = expiresText;
    }

    // Hide revoke for current session
    if (session.is_current) {
      if (revokeBtn) revokeBtn.classList.add('hidden');
    } else if (revokeBtn) {
      revokeBtn.addEventListener('click', () => this._revokeSession(session.session_id));
    }

    return row;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('btn-refresh-devices');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('animate-spin');
        Promise.all([this.loadDevices(), this.loadSessions()]).finally(() => {
          refreshBtn.classList.remove('animate-spin');
        });
      });
    }

    // Logout other devices button
    const logoutBtn = document.getElementById('btn-logout-other-devices');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this._logoutOtherDevices());
    }
  }

  /**
   * Remove a device
   */
  async _removeDevice(deviceId) {
    const confirmed = await this._showConfirm(
      'Hapus Perangkat?',
      'Perangkat ini tidak akan bisa mengakses akun Anda lagi.'
    );

    if (!confirmed) return;

    try {
      await this.authManager.removeDevice(deviceId);
      window.showToast('Perangkat berhasil dihapus', 'success');
      await this.loadDevices();
    } catch (error) {
      this._logger.error('Error removing device:', error);
      window.showToast('Gagal menghapus perangkat', 'error');
    }
  }

  /**
   * Revoke a session
   */
  async _revokeSession(sessionId) {
    const confirmed = await this._showConfirm(
      'Cabut Sesi?',
      'Sesi ini akan diakhiri dan perangkat harus login ulang.'
    );

    if (!confirmed) return;

    try {
      await this.authManager.revokeSession(sessionId);
      window.showToast('Sesi berhasil dicabut', 'success');
      await this.loadSessions();
    } catch (error) {
      this._logger.error('Error revoking session:', error);
      window.showToast('Gagal mencabut sesi', 'error');
    }
  }

  /**
   * Logout all other devices
   */
  async _logoutOtherDevices() {
    const confirmed = await this._showConfirm(
      'Logout Semua Perangkat Lain?',
      'Semua perangkat lain akan keluar dari akun Anda. Anda tetap login di perangkat ini.'
    );

    if (!confirmed) return;

    try {
      const count = await this.authManager.logoutOtherDevices();
      window.showToast(`${count} perangkat berhasil logout`, 'success');
      await Promise.all([this.loadDevices(), this.loadSessions()]);
    } catch (error) {
      this._logger.error('Error logging out other devices:', error);
      window.showToast('Gagal logout perangkat lain', 'error');
    }
  }

  /**
   * Show confirmation dialog
   */
  _showConfirm(title, message) {
    return new Promise((resolve) => {
      if (window.showConfirmModal) {
        window.showConfirmModal(title, message, 'Ya', 'Batal', (confirmed) => {
          resolve(confirmed);
        });
      } else {
        resolve(confirm(`${title}\n\n${message}`));
      }
    });
  }

  /**
   * Format date for display
   */
  _formatDate(dateStr) {
    if (!dateStr) return '-';

    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return 'Baru saja';

    // Less than 1 hour
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins} menit lalu`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} jam lalu`;
    }

    // Format as date
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Refresh the component
   */
  async refresh() {
    await Promise.all([this.loadDevices(), this.loadSessions()]);
  }
}

// ============================================================
// USAGE EXAMPLE
// ============================================================

/*
// In your app initialization:
import './components/devices-manager.html'; // Load template

// Initialize when auth is ready
async function initDeviceManager() {
  // Wait for authMultiRole to be initialized
  await authMultiRole.init(window.supabaseClient);

  // Initialize the UI component
  const deviceManager = new DeviceManager(authMultiRole);
  await deviceManager.init('#device-manager-container');

  // You can also refresh programmatically
  // await deviceManager.refresh();
}

// Or use as standalone:
const dm = new DeviceManager(authMultiRole);
dm.init('#my-device-manager');
*/

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeviceManager;
}

window.DeviceManager = DeviceManager;
