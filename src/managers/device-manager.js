/**
 * DeviceManager - Client-side device management for multidevice support
 *
 * Handles UI interactions for:
 * - Opening/closing device manager modal
 * - Loading and displaying devices
 * - Loading and displaying sessions
 * - Device removal
 * - Session revocation
 * - Logout other devices
 */

(function() {
  'use strict';

  // ============================================================
  // GLOBAL FUNCTIONS (exposed to window)
  // ============================================================

  /**
   * Open the device manager modal
   */
  window.openDeviceManager = async function() {
    const modal = document.getElementById('modal-device-manager');
    if (!modal) {
      console.error('Device manager modal not found');
      return;
    }

    // Show modal
    modal.classList.remove('hidden');

    // Load data
    await loadDeviceManagerData();

    // Re-init icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  };

  /**
   * Close the device manager modal
   */
  window.closeDeviceManagerModal = function() {
    const modal = document.getElementById('modal-device-manager');
    if (modal) {
      modal.classList.add('hidden');
    }
  };

  /**
   * Logout all other devices
   */
  window.logoutOtherDevices = async function() {
    const confirmed = confirm('Yakin ingin logout dari semua perangkat lain?\n\nAnda akan tetap login di perangkat ini.');
    if (!confirmed) return;

    try {
      if (window.authMultiRole && window.authMultiRole.supabase) {
        await window.authMultiRole.init(window.supabaseClient);
        const count = await window.authMultiRole.logoutOtherDevices();
        window.showToast?.(`${count} perangkat berhasil di-logout`, 'success');
        await loadDeviceManagerData();
      } else {
        // Fallback: clear local sessions
        const sessionKeys = Object.keys(localStorage).filter(k => k.startsWith('session_'));
        sessionKeys.forEach(k => localStorage.removeItem(k));
        window.showToast?.('Session lain telah dihapus', 'success');
      }
    } catch (error) {
      console.error('Logout other devices failed:', error);
      window.showToast?.('Gagal logout perangkat lain', 'error');
    }
  };

  // ============================================================
  // INTERNAL FUNCTIONS
  // ============================================================

  /**
   * Load all data for the device manager
   */
  async function loadDeviceManagerData() {
    await Promise.all([
      loadCurrentDevice(),
      loadOtherDevices(),
      loadSessions()
    ]);
  }

  /**
   * Load and display current device info
   */
  async function loadCurrentDevice() {
    const nameEl = document.getElementById('dm-current-name');
    const metaEl = document.getElementById('dm-current-meta');
    const activeEl = document.getElementById('dm-current-active');

    if (!nameEl || !metaEl || !activeEl) return;

    // Get device info from browser
    const deviceInfo = getDeviceInfo();
    const deviceId = localStorage.getItem('device_id') || deviceInfo.deviceId;

    nameEl.textContent = deviceInfo.name;
    metaEl.textContent = `${deviceInfo.type} • ${deviceInfo.browser} • ${deviceInfo.os}`;
    activeEl.textContent = `Device ID: ${deviceId.substring(0, 20)}...`;

    // Try to get more info from server if available
    if (window.authMultiRole && window.authMultiRole.supabase) {
      try {
        await window.authMultiRole.init(window.supabaseClient);
        const devices = await window.authMultiRole.getDevices();
        const current = devices.find(d => d.device_id === deviceId);
        if (current && current.last_active) {
          activeEl.textContent = `Aktif terakhir: ${formatRelativeTime(current.last_active)}`;
        }
      } catch (e) {
        // Silently fail - we already have basic info
      }
    }
  }

  /**
   * Load and display other devices
   */
  async function loadOtherDevices() {
    const container = document.getElementById('dm-other-devices');
    if (!container) return;

    const deviceId = localStorage.getItem('device_id');

    // If authMultiRole is available, use it
    if (window.authMultiRole && window.authMultiRole.supabase) {
      try {
        await window.authMultiRole.init(window.supabaseClient);
        const devices = await window.authMultiRole.getDevices();
        const otherDevices = devices.filter(d => d.device_id !== deviceId);

        if (otherDevices.length === 0) {
          container.innerHTML = `
            <div class="text-center py-4 text-xs text-slate-400">
              <i data-lucide="check-circle" class="w-5 h-5 mx-auto mb-2 text-emerald-400"></i>
              Tidak ada perangkat lain yang terhubung
            </div>
          `;
          if (window.lucide) window.lucide.createIcons();
          return;
        }

        container.innerHTML = '';
        for (const device of otherDevices) {
          const card = createDeviceCard(device);
          container.appendChild(card);
        }
        if (window.lucide) window.lucide.createIcons();
        return;
      } catch (e) {
        console.error('Error loading devices:', e);
      }
    }

    // Fallback: show placeholder
    container.innerHTML = `
      <div class="text-center py-4 text-xs text-slate-400">
        <i data-lucide="info" class="w-5 h-5 mx-auto mb-2"></i>
        Hubungkan ke Supabase untuk melihat perangkat lain
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  /**
   * Load and display active sessions
   */
  async function loadSessions() {
    const container = document.getElementById('dm-sessions');
    if (!container) return;

    if (window.authMultiRole && window.authMultiRole.supabase) {
      try {
        await window.authMultiRole.init(window.supabaseClient);
        const sessions = await window.authMultiRole.getActiveSessions();
        const currentDeviceId = localStorage.getItem('device_id');

        if (sessions.length === 0) {
          container.innerHTML = `
            <div class="text-center py-3 text-xs text-slate-400">
              Tidak ada sesi aktif
            </div>
          `;
          return;
        }

        container.innerHTML = '';
        for (const session of sessions) {
          const row = createSessionRow(session, currentDeviceId);
          container.appendChild(row);
        }
        return;
      } catch (e) {
        console.error('Error loading sessions:', e);
      }
    }

    // Fallback
    container.innerHTML = `
      <div class="text-center py-3 text-xs text-slate-400">
        Tidak ada data sesi
      </div>
    `;
  }

  /**
   * Create a device card element
   */
  function createDeviceCard(device) {
    const template = document.getElementById('dm-device-card-template');
    if (!template) {
      // Create element manually
      const card = document.createElement('div');
      card.className = 'dm-device-card flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors';
      card.innerHTML = `
        <div class="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
          <i data-lucide="monitor" class="w-5 h-5"></i>
        </div>
        <div class="flex-1 min-w-0">
          <span class="dm-device-name font-medium text-slate-700 dark:text-slate-300 text-sm block truncate">${device.device_name || 'Unknown Device'}</span>
          <p class="dm-device-meta text-xs text-slate-500 dark:text-slate-400 mt-0.5">${device.device_type || '-'} • ${device.browser || '-'} • ${device.os || '-'}</p>
          <p class="dm-device-active text-[10px] text-slate-400 dark:text-slate-500 mt-1">Aktif: ${formatRelativeTime(device.last_active)}</p>
        </div>
        <button class="dm-remove-btn w-8 h-8 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center justify-center text-rose-500 hover:text-rose-600 transition-colors shrink-0" title="Hapus" data-device-id="${device.device_id}">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      `;
      return card;
    }

    const content = template.content.cloneNode(true);
    const card = content.querySelector('.dm-device-card');

    // Fill in data
    const nameEl = card.querySelector('.dm-device-name');
    const metaEl = card.querySelector('.dm-device-meta');
    const activeEl = card.querySelector('.dm-device-active');
    const removeBtn = card.querySelector('.dm-remove-btn');

    if (nameEl) nameEl.textContent = device.device_name || 'Unknown Device';
    if (metaEl) {
      const parts = [];
      if (device.device_type) parts.push(device.device_type);
      if (device.browser) parts.push(device.browser);
      if (device.os) parts.push(device.os);
      metaEl.textContent = parts.join(' • ') || '-';
    }
    if (activeEl) activeEl.textContent = `Aktif: ${formatRelativeTime(device.last_active)}`;

    if (removeBtn) {
      removeBtn.dataset.deviceId = device.device_id;
      removeBtn.addEventListener('click', () => removeDevice(device.device_id));
    }

    return card;
  }

  /**
   * Create a session row element
   */
  function createSessionRow(session, currentDeviceId) {
    const template = document.getElementById('dm-session-row-template');
    const row = document.createElement('div');
    row.className = 'dm-session-row flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50';

    const isCurrent = session.device_id === currentDeviceId;

    row.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <i data-lucide="${isCurrent ? 'check-circle' : 'clock'}" class="w-4 h-4 ${isCurrent ? 'text-emerald-500' : 'text-slate-400'} flex-shrink-0"></i>
        <div class="min-w-0">
          <span class="dm-session-name text-xs font-medium ${isCurrent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'} block truncate">
            ${session.device_name || 'Unknown'}
            ${isCurrent ? ' (saat ini)' : ''}
          </span>
          <p class="dm-session-meta text-[10px] text-slate-500 dark:text-slate-400">
            ${session.created_at ? 'Dibuat: ' + formatRelativeTime(session.created_at) : 'Tidak ada info'}
          </p>
        </div>
      </div>
      ${!isCurrent ? `
        <button class="dm-revoke-btn px-2 py-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 hover:text-rose-600 text-[10px] font-bold transition-colors" data-session-id="${session.session_id}">
          Cabut
        </button>
      ` : ''}
    `;

    const revokeBtn = row.querySelector('.dm-revoke-btn');
    if (revokeBtn) {
      revokeBtn.addEventListener('click', () => revokeSession(session.session_id));
    }

    return row;
  }

  /**
   * Remove a device
   */
  async function removeDevice(deviceId) {
    const confirmed = confirm('Yakin ingin menghapus perangkat ini?\n\nPerangkat tidak akan bisa mengakses akun Anda.');
    if (!confirmed) return;

    try {
      if (window.authMultiRole && window.authMultiRole.supabase) {
        await window.authMultiRole.init(window.supabaseClient);
        await window.authMultiRole.removeDevice(deviceId);
        window.showToast?.('Perangkat berhasil dihapus', 'success');
        await loadOtherDevices();
      } else {
        window.showToast?.('Fitur memerlukan koneksi Supabase', 'warning');
      }
    } catch (error) {
      console.error('Remove device failed:', error);
      window.showToast?.('Gagal menghapus perangkat', 'error');
    }
  }

  /**
   * Revoke a session
   */
  async function revokeSession(sessionId) {
    const confirmed = confirm('Yakin ingin mencabut sesi ini?\n\nPerangkat harus login ulang.');
    if (!confirmed) return;

    try {
      if (window.authMultiRole && window.authMultiRole.supabase) {
        await window.authMultiRole.init(window.supabaseClient);
        await window.authMultiRole.revokeSession(sessionId);
        window.showToast?.('Sesi berhasil dicabut', 'success');
        await loadSessions();
      } else {
        window.showToast?.('Fitur memerlukan koneksi Supabase', 'warning');
      }
    } catch (error) {
      console.error('Revoke session failed:', error);
      window.showToast?.('Gagal mencabut sesi', 'error');
    }
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  /**
   * Get device info from browser
   */
  function getDeviceInfo() {
    const ua = navigator.userAgent;

    let deviceType = 'desktop';
    if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
      deviceType = /ipad|tablet/i.test(ua) ? 'tablet' : 'mobile';
    }

    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return {
      deviceId: generateDeviceId(),
      name: `${browser} on ${os}`,
      type: deviceType,
      browser,
      os
    };
  }

  /**
   * Generate unique device ID
   */
  function generateDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Format date as relative time
   */
  function formatRelativeTime(dateStr) {
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

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} hari lalu`;
    }

    // Format as date
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Initialize device manager
   * Called when app is ready
   */
  window.initDeviceManager = async function() {
    // Generate device ID if not exists
    generateDeviceId();

    // Register close on backdrop click
    const modal = document.getElementById('modal-device-manager');
    if (modal) {
      const backdrop = modal.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', window.closeDeviceManagerModal);
      }
    }

    // Log initialization
    if (localStorage.getItem('DEBUG_LOGS') === 'true') {
      console.log('[DeviceManager] Initialized with device ID:', localStorage.getItem('device_id'));
    }
  };

})();
