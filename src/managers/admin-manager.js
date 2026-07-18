// File: admin-manager.js
// Manager khusus untuk mengelola fitur-fitur administratif (Role Admin)
// Terinspirasi dari fungsi Operations, Communications, dan HR Admin Connecteam.
// Mode localStorage only

/**
 * Guard untuk memastikan hanya admin yang bisa memanggil fungsi
 * @throws {Error} Jika user bukan admin atau superadmin
 * @private
 */
function _requireAdmin() {
  if (appState.adminMode !== true && appState.superadminMode !== true) {
    throw new Error('Unauthorized: Admin access required');
  }
}

/**
 * Escape HTML entities untuk mencegah XSS
 * @param {string} str - String yang akan di-escape
 * @returns {string} - String yang sudah di-escape
 * @private
 */
const _escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  const text = String(str);
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
};

let classUuidMap = {}; // UUID -> Class Name
let classNameToUuidMap = {}; // Class Name -> UUID
let studentUuidMap = {}; // UUID -> Student Info

/**
 * Guard untuk memastikan hanya admin yang bisa memanggil fungsi
 * @throws {Error} Jika user bukan admin atau superadmin
 */
function _requireAdmin() {
  if (appState.adminMode !== true && appState.superadminMode !== true) {
    throw new Error('Unauthorized: Admin access required');
  }
}

/**
 * Inisialisasi peta UUID Kelas - menggunakan data lokal
 */
async function initAdminClassMap() {
  if (Object.keys(classUuidMap).length > 0) return;
  // Menggunakan MASTER_KELAS untuk mapping lokal
  Object.keys(MASTER_KELAS || {}).forEach(className => {
    classNameToUuidMap[className] = className;
    classUuidMap[className] = className;
  });
}

/**
 * Inisialisasi peta UUID Santri - menggunakan data lokal
 */
async function initAdminStudentMap() {
  if (Object.keys(studentUuidMap).length > 0) return;
  // Menggunakan MASTER_SANTRI untuk mapping lokal
  (MASTER_SANTRI || []).forEach(s => {
    const nis = String(s.nis || s.id || '').trim();
    if (nis) {
      studentUuidMap[nis] = { nis: nis, nama: s.nama || s.name || nis };
    }
  });
}

/**
 * 1. OPERATIONS: Memuat rekap absensi harian seluruh kelas untuk 6 sesi shalat
 * Menggunakan localStorage sebagai sumber data
 * @returns {Promise<{data: Object, error: Error|null}>}
 */
window.loadGlobalAttendance = async function () {
  _requireAdmin();
  try {
    await initAdminClassMap();

    // Inisialisasi matriks rekap kelas
    const rekap = {};
    Object.keys(MASTER_KELAS).forEach(k => {
      // Abaikan kelas admin
      if (k?.toLowerCase() === 'admin musyrif') return;

      rekap[k] = {
        shubuh: false,
        sekolah: false,
        ashar: false,
        maghrib: false,
        isya: false
      };
    });

    const slots = ['shubuh', 'sekolah', 'ashar', 'maghrib', 'isya'];
    const dateKey = appState.date || new Date().toISOString().split('T')[0];

    const useIndexedDB = window.storageManager?.getStatus()?.useIndexedDB && window._repos?.attendance;

    if (useIndexedDB) {
      try {
        const allDateRecords = await window._repos.attendance.getByDate(dateKey);
        allDateRecords.forEach(record => {
          const className = record.kelas;
          const slotId = record.slot;
          if (rekap[className] && rekap[className].hasOwnProperty(slotId)) {
            if (record.status && Object.keys(record.status).length > 0) {
              rekap[className][slotId] = true;
            }
          }
        });
      } catch (err) {
        console.error('[AdminManager] Failed to load global attendance from IndexedDB, falling back:', err);
      }
    } else {
      // Fallback ke LocalStorage (cara lama)
      for (const className of Object.keys(rekap)) {
        try {
          const storageKey = `musyrif_attendance_${className.replace(/\s+/g, '_')}`;
          const savedData = localStorage.getItem(storageKey);
          if (savedData) {
            const attendanceData = window.safeJsonParse(savedData, {});
            if (!attendanceData) continue;
            const dayData = attendanceData[dateKey];
            if (dayData) {
              slots.forEach(slotId => {
                if (dayData[slotId] && Object.keys(dayData[slotId]).length > 0) {
                  rekap[className][slotId] = true;
                }
              });
            }
          }
        } catch (e) {
          // Silent fail for individual class - continue processing others
        }
      }
    }

    return { data: rekap, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * 2. PERIZINAN: Memuat riwayat izin dari semua kelas
 * Menggunakan localStorage sebagai sumber data
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
window.loadGlobalPermits = async function () {
  _requireAdmin();
  try {
    await initAdminStudentMap();

    // Ambil permits dari appState atau localStorage
    let allPermits = appState.permits || [];

    // Fallback ke localStorage
    if (allPermits.length === 0) {
      try {
        const saved = localStorage.getItem('musyrif_permits_db');
        if (saved) {
          allPermits = window.safeJsonParse(saved, []);
        }
      } catch (e) {
        // Silent fail - permits may not exist yet
      }
    }

    // Cari detail santri di cache lokal menggunakan NIS
    const permits = allPermits.map(p => {
      const student = window.findWaliSantriByNis ? window.findWaliSantriByNis(p.nis) : null;
      // Coba cari di MASTER_SANTRI
      const masterStudent = (MASTER_SANTRI || []).find(s => String(s.nis || s.id) === String(p.nis));
      return {
        ...p,
        studentName: student?.nama || masterStudent?.nama || p.nama_wali || 'Santri',
        className: student?.kelas || masterStudent?.kelas || p.kelas_id || 'Kelas'
      };
    });

    return { data: permits, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

/**
 * 3. TAHFIZH: Memuat data setoran tahfizh global seluruh santri
 * Menggunakan localStorage sebagai sumber data
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
window.loadGlobalTahfizh = async function () {
  _requireAdmin();
  try {
    // Ambil setoran dari localStorage
    let allSetoran = [];

    try {
      allSetoran = typeof window.getTahfizhSetoran === "function"
        ? window.getTahfizhSetoran()
        : window.safeJsonParse(localStorage.getItem('tahfizh_local_setoran'), []);
    } catch (e) {
      // Silent fail - tahfizh data may not exist yet
    }

    // Transform ke format standar
    const formatted = allSetoran.map(r => ({
      id: `${r.kelas}_${r.santriId || r.nis || 'unknown'}_${r.rowNumber}`,
      musyrif: r.musyrif || '',
      nama_santri: r.namaSantri || '',
      santrialias: r.nis || r.santriId || '',
      kelas: r.kelas || '',
      program: r.program || '',
      jenis: r.jenis || '',
      juz: String(r.juz || ''),
      tanggal: r.tanggal ? r.tanggal.split('T')[0] : new Date().toISOString().split('T')[0],
      kualitas: r.kualitas || 'Lancar',
      status: r.status || 'Verified',
      surat: r.surat || '',
      halaman: String(r.halaman || ''),
      row_number: Number(r.rowNumber || 0),
      synced: r.synced || false
    }));

    return { data: formatted, error: null };
  } catch (error) {
    return { data: [], error };
  }
};

/**
 * 4. HR & WALI: Reset password Wali melalui Supabase Auth.
 * @param {string} nis - NIS Wali Santri
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
window.resetWaliPassword = async function (nis) {
  _requireAdmin();
  try {
    if (!window.supabaseClient) throw new Error('Cloud database tidak tersedia');
    const { data, error } = await window.supabaseClient.functions.invoke('wali-admin', {
      body: { action: 'reset_password', nis: String(nis) }
    });
    if (error || !data?.success) throw error || new Error(data?.message || 'Reset password gagal');

    // Catat ke audit log
    if (window.logActivityAudit) {
      window.logActivityAudit('Reset Password', `Wali ${nis}`, 'Mereset password Wali Santri kembali ke default (NIS)');
    }

    return { success: true, temporaryPassword: data.temporaryPassword, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

/**
 * 6. HR & WALI: Ubah/Setel password Wali Santri
 * Password dikelola oleh Supabase Auth; browser tidak menyimpan hash/password.
 * @param {string} nis - NIS Wali Santri
 * @param {string} newPassword - Password baru
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
window.changeWaliPassword = async function (nis, newPassword) {
  _requireAdmin();
  try {
    if (!window.supabaseClient) throw new Error('Cloud database tidak tersedia');
    const { data, error } = await window.supabaseClient.functions.invoke('wali-admin', {
      body: { action: 'set_password', nis: String(nis), password: String(newPassword) }
    });
    if (error || !data?.success) throw error || new Error(data?.message || 'Ubah password gagal');
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

/**
 * 7. COMMUNICATIONS: Membuat pengumuman broadcast baru
 * Menggunakan localStorage
 * @param {string} title - Judul pengumuman (max 200 karakter)
 * @param {string} content - Isi pengumuman (max 5000 karakter)
 * @param {string} target - Target: 'musyrif', 'wali', atau 'all'
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
window.createAnnouncement = async function (title, content, target = "musyrif") {
  _requireAdmin();
  try {
    const announcementKey = 'local_announcements';
    const saved = localStorage.getItem(announcementKey);
    let announcements = [];
    try { announcements = saved ? JSON.parse(saved) : []; } catch { announcements = []; }

    const newAnnouncement = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      title,
      content,
      target,
      created_by: appState.userProfile?.name || 'Admin',
      created_at: new Date().toISOString()
    };

    announcements.unshift(newAnnouncement);
    // Simpan maksimal 50 pengumuman
    localStorage.setItem(announcementKey, JSON.stringify(announcements.slice(0, 50)));

    // Catat ke audit log
    if (window.logActivityAudit) {
      window.logActivityAudit('Broadcast', target === 'musyrif' ? 'Semua Musyrif' : target === 'wali' ? 'Semua Wali' : 'Semua Musyrif & Wali', `Mengirim pengumuman: "${title}"`);
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

/**
 * 8. COMMUNICATIONS: Memuat daftar pengumuman terbaru
 * Menggunakan localStorage
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
window.loadAnnouncements = async function () {
  _requireAdmin();
  try {
    const announcementKey = 'local_announcements';
    const saved = localStorage.getItem(announcementKey);
    let announcements = [];
    try { announcements = saved ? JSON.parse(saved) : []; } catch { announcements = []; }

    // Urutkan dari terbaru
    announcements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { data: announcements.slice(0, 3), error: null };
  } catch (error) {
    return { data: [], error };
  }
};

/**
 * 9. AUDIT LOGS: Memuat seluruh log aktivitas sistem secara global
 * Menggunakan localStorage
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
window.loadGlobalActivityLogs = async function () {
  _requireAdmin();
  try {
    const logsKey = 'local_activity_logs';
    const saved = localStorage.getItem(logsKey);
    let logs = [];
    try { logs = saved ? JSON.parse(saved) : []; } catch { logs = []; }

    // Urutkan dari terbaru dan ambil 100
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { data: logs.slice(0, 100), error: null };
  } catch (error) {
    return { data: [], error };
  }
};

// ============================================================
// ANNOUNCEMENT BANNER SYSTEM (Cross-Role)
// ============================================================

/**
 * Load announcements yang relevan untuk user saat ini
 * Mengecek target audience: musyrif, wali, atau all
 * @returns {Promise<Array>} Array announcement yang relevan
 */
window.loadRelevantAnnouncements = async function () {
  try {
    const announcementKey = 'local_announcements';
    const saved = localStorage.getItem(announcementKey);
    let announcements = [];
    try { announcements = saved ? JSON.parse(saved) : []; } catch { announcements = []; }

    // Tentukan role user saat ini
    const isWali = appState?.waliMode === true;
    const isMusyrif = appState?.musyrifMode === true || (appState?.adminMode === true || appState?.superadminMode === true);
    const isAdmin = appState?.adminMode === true || appState?.superadminMode === true;

    // Filter berdasarkan target
    const relevantAnnouncements = announcements.filter(ann => {
      // Admin melihat semua
      if (isAdmin) return true;

      // Musyrif melihat musyrif dan all
      if (isMusyrif && !isWali) {
        return ann.target === 'musyrif' || ann.target === 'all';
      }

      // Wali melihat wali dan all
      if (isWali) {
        return ann.target === 'wali' || ann.target === 'all';
      }

      return false;
    });

    // Urutkan dari terbaru
    relevantAnnouncements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return relevantAnnouncements;
  } catch (error) {
    console.error('[Announcement] Failed to load relevant announcements:', error);
    return [];
  }
};

/**
 * Get dismissed announcement IDs dari localStorage
 * @returns {Array<string>} Array ID announcement yang sudah dismissed
 */
window.getDismissedAnnouncements = function () {
  try {
    const key = 'syamsa_dismissed_announcements';
    const saved = localStorage.getItem(key);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch (e) {
    return [];
  }
};

/**
 * Dismiss announcement (tandai sudah dibaca)
 * @param {string} announcementId - ID announcement
 */
window.dismissAnnouncement = function (announcementId) {
  try {
    const dismissed = window.getDismissedAnnouncements();
    if (!dismissed.includes(announcementId)) {
      dismissed.push(announcementId);
      localStorage.setItem('syamsa_dismissed_announcements', JSON.stringify(dismissed));
    }
    // Hide banner dengan animasi
    const banner = document.getElementById('announcement-banner-container');
    if (banner) {
      banner.classList.remove('animate-slide-up');
      banner.classList.add('animate-fade-out');
      setTimeout(() => {
        banner.classList.add('hidden');
        banner.classList.remove('animate-fade-out');
      }, 300);
    }
  } catch (error) {
    console.error('[Announcement] Failed to dismiss:', error);
  }
};

/**
 * Render announcement banner di header dashboard
 * Dipanggil saat updateDashboard
 */
window.renderAnnouncementBanner = async function () {
  const container = document.getElementById('announcement-banner-container');
  if (!container) return;

  // Jangan tampilkan banner untuk admin (mereka sudah punya panel broadcast)
  if (appState?.adminMode === true || appState?.superadminMode === true) {
    container.classList.add('hidden');
    return;
  }

  try {
    const announcements = await window.loadRelevantAnnouncements();
    const dismissed = window.getDismissedAnnouncements();

    // Ambil announcement terbaru yang belum di-dismiss
    const activeAnnouncement = announcements.find(ann => !dismissed.includes(ann.id));

    if (!activeAnnouncement) {
      container.classList.add('hidden');
      return;
    }

    // Tentukan styling berdasarkan target
    const targetColors = {
      musyrif: {
        bg: 'bg-teal-500/10 dark:bg-teal-500/15',
        border: 'border-teal-500/30 dark:border-teal-500/40',
        icon: 'text-teal-500',
        badge: 'bg-teal-500/20 text-teal-600 dark:text-teal-400'
      },
      wali: {
        bg: 'bg-amber-500/10 dark:bg-amber-500/15',
        border: 'border-amber-500/30 dark:border-amber-500/40',
        icon: 'text-amber-500',
        badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
      },
      all: {
        bg: 'bg-purple-500/10 dark:bg-purple-500/15',
        border: 'border-purple-500/30 dark:border-purple-500/40',
        icon: 'text-purple-500',
        badge: 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
      }
    };

    const colors = targetColors[activeAnnouncement.target] || targetColors.all;
    const targetLabel = activeAnnouncement.target === 'wali' ? 'Wali Santri' :
                       activeAnnouncement.target === 'all' ? 'Semua User' : 'Musyrif';

    // Format tanggal
    const dateStr = activeAnnouncement.created_at
      ? new Date(activeAnnouncement.created_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';

    // Escape content untuk prevent XSS
    const safeTitle = window.sanitizeHTML(activeAnnouncement.title || '');
    const safeContent = window.sanitizeHTML(activeAnnouncement.content || '');

    container.innerHTML = `
      <div class="rounded-2xl ${colors.bg} border ${colors.border} p-4 shadow-lg backdrop-blur-sm">
        <div class="flex items-start gap-3">
          <!-- Icon -->
          <div class="shrink-0 w-10 h-10 rounded-xl ${colors.badge} flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${colors.icon}">
              <path d="m3 11 18-5v12L3 13v-2z"/>
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
            </svg>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${colors.badge}">
                ${targetLabel}
              </span>
              <span class="text-[9px] text-slate-400 font-mono">${dateStr}</span>
            </div>
            <h4 class="text-sm font-black text-slate-800 dark:text-white leading-tight mb-1">
              ${safeTitle}
            </h4>
            <p class="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed line-clamp-2">
              ${safeContent}
            </p>
            <button onclick="window.dismissAnnouncement('${activeAnnouncement.id}')"
              class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Tandai Sudah Dibaca
            </button>
          </div>

          <!-- Close Button -->
          <button onclick="window.dismissAnnouncement('${activeAnnouncement.id}')"
            class="shrink-0 w-8 h-8 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            aria-label="Tutup pengumuman">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Tampilkan banner dengan animasi
    container.classList.remove('hidden');
    container.classList.add('animate-slide-up');

  } catch (error) {
    console.error('[Announcement] Failed to render banner:', error);
    container.classList.add('hidden');
  }
};

// ============================================================
// ADMIN DASHBOARD RENDERING & EVENT CONTROLLERS
// ============================================================

/**
 * Switch sub-tab di halaman admin
 * @param {string} subTabName - Nama sub-tab: 'operations', 'hr', 'tahfizh', 'permits', 'broadcast', 'logs'
 */
window.switchAdminSubTab = function (subTabName) {
  _requireAdmin();
  // Sembunyikan semua konten subtab admin
  document.querySelectorAll(".admin-subtab-content").forEach(el => el.classList.add("hidden"));

  // Tampilkan subtab target
  const target = document.getElementById(`admin-subtab-${subTabName}`);
  if (target) target.classList.remove("hidden");

  // Atur kelas aktif pada tombol navigasi subtab
  document.querySelectorAll(".admin-sub-nav-btn").forEach(btn => {
    if (btn.dataset.adminsubtab === subTabName) {
      btn.className = "admin-sub-nav-btn active px-4 py-2.5 rounded-full text-xs font-black shadow-sm flex items-center gap-1.5 transition-all bg-syamsa-deep text-white dark:bg-syamsa-blue";
    } else {
      btn.className = "admin-sub-nav-btn px-4 py-2.5 rounded-full text-xs font-black shadow-sm flex items-center gap-1.5 transition-all bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700";
    }
  });

  // Trigger data loader sesuai subtab
  if (subTabName === "operations") {
    window.renderAdminOpsMatrix();
  } else if (subTabName === "hr") {
    window.renderAdminHRList();
  } else if (subTabName === "tahfizh") {
    window.renderAdminTahfizhList();
  } else if (subTabName === "permits") {
    window.renderAdminPermits();
  } else if (subTabName === "broadcast") {
    window.renderRecentBroadcasts();
  } else if (subTabName === "logs") {
    window.renderAdminLogs();
  }

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Render matriks operasi presensi seluruh kelas
 * Menampilkan status pengisian 5 sesi shalat per kelas
 */
window.renderAdminOpsMatrix = async function () {
  _requireAdmin();
  const tbody = document.getElementById("admin-ops-matrix-body");
  const mobileList = document.getElementById("admin-ops-matrix-mobile-list");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">Memuat matriks...</td></tr>`;
  if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Memuat matriks...</p>`;

  const { data: rekap, error } = await window.loadGlobalAttendance();
  if (error || !rekap) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-red-500">Gagal memuat matriks: ${error || 'Offline'}</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-red-500 font-bold p-4 text-center">Gagal memuat matriks: ${error || 'Offline'}</p>`;
    return;
  }

  tbody.innerHTML = "";
  if (mobileList) mobileList.innerHTML = "";

  const kelasKeys = Object.keys(MASTER_KELAS)
    .filter(k => k?.toLowerCase() !== "admin musyrif")
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (kelasKeys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">Tidak ada data kelas.</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Tidak ada data kelas.</p>`;
    return;
  }

  kelasKeys.forEach(className => {
    const classInfo = MASTER_KELAS[className];
    const safeClassName = _escapeHtml(className);
    const musyrifName = _escapeHtml(classInfo.musyrif || "Musyrif");

    // Cari hp musyrif secara cerdas
    let musyrifPhone = classInfo.hp_musyrif || classInfo.phone || "";
    if (!musyrifPhone && typeof MASTER_SANTRI !== "undefined") {
      const sampleSantri = MASTER_SANTRI.find(s => String(s.kelas || s.rombel || "").trim() === className);
      if (sampleSantri && sampleSantri.hp_musyrif) {
        musyrifPhone = sampleSantri.hp_musyrif;
      }
    }

    const rowRekap = rekap[className] || { shubuh: false, sekolah: false, ashar: false, maghrib: false, isya: false };

    const slots = ["shubuh", "sekolah", "ashar", "maghrib", "isya"];
    const slotLabels = { shubuh: "Subuh", sekolah: "Sekolah", ashar: "Ashar", maghrib: "Maghrib", isya: "Isya" };

    const slotCells = slots.map(slotId => {
      const isFilled = rowRekap[slotId];
      const colorClass = isFilled 
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 shadow-emerald-500/5" 
        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 shadow-rose-500/5";
      const icon = isFilled ? "check" : "x";
      const title = isFilled ? "Sudah Diisi" : "Belum Diisi";

      return `
        <td class="p-3 text-center">
          <button onclick="window.overrideAttendance('${safeClassName}', '${slotId}')" title="Override ${safeClassName} - ${slotId} (${title})" class="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] ${colorClass} shadow-sm active:scale-95 transition-all">
            <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      `;
    }).join("");

    // Hubungi buttons
    const waLink = musyrifPhone ? `https://wa.me/${musyrifPhone.replace(/[^0-9]/g, "")}?text=Assalamu'alaikum%20Ustadz%20${encodeURIComponent(musyrifName)},%20mohon%20segera%20mengisi%20presensi%20shalat%20untuk%20kelas%20${encodeURIComponent(className)}` : "#";
    const phoneLink = musyrifPhone ? `tel:${musyrifPhone}` : "#";

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3 font-black text-slate-800 dark:text-white">${safeClassName}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${musyrifName}</td>
        ${slotCells}
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <a href="${waLink}" target="_blank" class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 hover:bg-emerald-500/20 hover:scale-105 active:scale-95 transition-all" title="WhatsApp Musyrif">
              <i data-lucide="message-square" class="w-4 h-4"></i>
            </a>
            <a href="${phoneLink}" class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 hover:bg-blue-500/20 hover:scale-105 active:scale-95 transition-all" title="Call Musyrif">
              <i data-lucide="phone" class="w-4 h-4"></i>
            </a>
          </div>
        </td>
      </tr>
    `;

    // Populate mobile cards view
    if (mobileList) {
      const mobileSlotsHTML = slots.map(slotId => {
        const isFilled = rowRekap[slotId];
        const colorClass = isFilled 
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
        const label = slotLabels[slotId];
        return `
          <div class="flex flex-col items-center gap-1">
            <span class="text-[8px] font-black text-slate-400 uppercase tracking-wider">${label}</span>
            <button onclick="window.overrideAttendance('${safeClassName}', '${slotId}')" class="w-full py-2 rounded-xl text-[9px] font-black ${colorClass} shadow-sm active:scale-95 transition-all">
              ${isFilled ? 'Diisi' : 'Belum'}
            </button>
          </div>
        `;
      }).join("");

      mobileList.innerHTML += `
        <div class="bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80 rounded-[1.25rem] p-4 shadow-sm backdrop-blur-xl space-y-3">
          <div class="flex justify-between items-center">
            <div>
              <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeClassName}</h3>
              <p class="text-[10px] text-slate-400 font-bold">${musyrifName}</p>
            </div>
            <div class="flex gap-2">
              <a href="${waLink}" target="_blank" class="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 active:scale-95 transition-all" title="WhatsApp Musyrif">
                <i data-lucide="message-square" class="w-4 h-4"></i>
              </a>
              <a href="${phoneLink}" class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 active:scale-95 transition-all" title="Call Musyrif">
                <i data-lucide="phone" class="w-4 h-4"></i>
              </a>
            </div>
          </div>
          <div class="h-px bg-slate-100 dark:bg-slate-800/60"></div>
          <div class="grid grid-cols-5 gap-2">
            ${mobileSlotsHTML}
          </div>
        </div>
      `;
    }
  });

  if (window.lucide) window.lucide.createIcons();
  
  if (window.renderMusyrifLeaderboard) {
    window.renderMusyrifLeaderboard();
  }
  if (window.renderViolationLeaderboard) {
    window.renderViolationLeaderboard();
  }
  if (window.renderAdminViolationsList) {
    window.renderAdminViolationsList();
  }
  if (window.renderAdminViolationRules) {
    window.renderAdminViolationRules();
  }
  if (window.renderAdminIbadahAnalytics) {
    window.renderAdminIbadahAnalytics();
  }
};

/**
 * Override attendance untuk kelas tertentu - buka presensi
 * @param {string} className - Nama kelas
 * @param {string} slotId - ID sesi: 'shubuh', 'sekolah', 'ashar', 'maghrib', 'isya'
 */
window.overrideAttendance = function (className, slotId) {
  _requireAdmin();
  // Set class & update data sources
  appState.selectedClass = className;
  if (typeof MASTER_SANTRI !== "undefined") {
    FILTERED_SANTRI = MASTER_SANTRI.filter((s) => {
      const sKelas = String(s.kelas || s.rombel || "").trim();
      return sKelas === className;
    }).sort((a, b) => a.nama.localeCompare(b.nama));
  }

  // Set target slot
  appState.currentSlotId = slotId;
  appState.activeAttendanceSlotId = slotId;

  // Initialize Storage Manager for this class context
  const musyrifId = `class_${className}`;
  window.initStorage?.(musyrifId);

  // Open attendance
  window.openAttendance();
};

/**
 * Render daftar Santri untuk manajemen HR
 */
window.setAdminHRSearch = function (value) {
  const input = document.getElementById("admin-hr-search");
  if (input) {
    input.value = value;
    window.renderAdminHRList();
  }
};

window.renderAdminHRList = async function () {
  _requireAdmin();
  const tbody = document.getElementById("admin-hr-table-body");
  const mobileList = document.getElementById("admin-hr-mobile-list");
  const desktopView = document.getElementById("admin-hr-desktop-view");
  if (!tbody) return;

  const searchQuery = (document.getElementById("admin-hr-search")?.value || "").toLowerCase().trim();
  const kelasFilter = (document.getElementById("admin-hr-kelas-filter")?.value || "").trim();

  // Show/Hide search clear button
  const clearBtn = document.getElementById("admin-hr-search-clear");
  if (clearBtn) {
    if (searchQuery) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }

  // Always show the list area
  if (desktopView) desktopView.classList.remove("hidden");
  if (mobileList) mobileList.classList.remove("hidden");

  // If no search query AND no kelas filter, show empty state with search prompt
  if (!searchQuery && !kelasFilter) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="p-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <p class="text-sm text-slate-400 font-bold">Ketik nama, NIS, atau wali untuk mencari</p>
          <p class="text-[10px] text-slate-300 dark:text-slate-600">Maksimal 20 hasil per pencarian</p>
        </div>
      </td></tr>`;
    if (mobileList) mobileList.innerHTML = `
      <div class="flex flex-col items-center gap-3 p-12 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.3-4.3"/>
        </svg>
        <p class="text-sm text-slate-400 font-bold text-center">Ketik nama, NIS, atau wali untuk mencari</p>
        <p class="text-[10px] text-slate-300 dark:text-slate-600">Maksimal 20 hasil per pencarian</p>
      </div>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Memuat data...</td></tr>`;
  if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Memuat data...</p>`;

  try {
    // Status akun berasal dari cloud, bukan cache kredensial perangkat.
    let cloudCredentials = [];
    if (window.supabaseClient) {
      const { data: response, error } = await window.supabaseClient.functions.invoke('wali-admin', {
        body: { action: 'list' }
      });
      if (error || !response?.success) throw error || new Error(response?.message || 'Gagal memuat akun wali');
      cloudCredentials = response.data || [];
    }
    const customNisSet = new Set(cloudCredentials.filter(item => item.is_active).map(item => String(item.nis)));

    tbody.innerHTML = "";
    if (mobileList) mobileList.innerHTML = "";

    let filtered = MASTER_SANTRI || [];
    if (searchQuery || kelasFilter) {
      filtered = (MASTER_SANTRI || []).filter(s => {
        const matchSearch = !searchQuery ||
          (s.nama && s.nama.toLowerCase().includes(searchQuery)) ||
          (s.nis && String(s.nis).includes(searchQuery)) ||
          (s.wali && s.wali.toLowerCase().includes(searchQuery)) ||
          (s.kelas && String(s.kelas).toLowerCase().includes(searchQuery)) ||
          (s.rombel && String(s.rombel).toLowerCase().includes(searchQuery));

        const matchKelas = !kelasFilter ||
          (s.kelas && s.kelas === kelasFilter) ||
          (s.rombel && s.rombel === kelasFilter);

        return matchSearch && matchKelas;
      });
    }

    if (filtered.length === 0) {
      const emptyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="11" y2="11"/></svg>`;
      tbody.innerHTML = `<tr><td colspan="6" class="p-12 text-center"><div class="flex flex-col items-center gap-3">${emptyIcon}<p class="text-xs text-slate-400 font-bold">Tidak ada santri ditemukan</p></div></td></tr>`;
      if (mobileList) mobileList.innerHTML = `<div class="flex flex-col items-center gap-3 p-8 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800"><svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="11" y2="11"/></svg><p class="text-xs text-slate-400 font-bold text-center">Tidak ada santri ditemukan</p></div>`;
      return;
    }

    // Limit to 20 results max for search
    const maxResults = 20;
    const resultsToShow = filtered.slice(0, maxResults);

    resultsToShow.forEach(s => {
      const nisStr = String(s.nis || s.id || '').trim();
      const safeNisStr = _escapeHtml(nisStr);
      const safeName = _escapeHtml(s.nama || s.name || '-');
      const safeKelas = _escapeHtml(s.kelas || s.rombel || "-");
      const safeWali = _escapeHtml(s.wali || "-");
      const hasCustom = customNisSet.has(nisStr);

      const statusBadge = hasCustom
        ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500 dark:bg-indigo-400/10 dark:text-indigo-400 text-[10px] font-black"><i data-lucide="key" class="w-3 h-3"></i> Kustom</span>`
        : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-500 dark:bg-slate-400/10 dark:text-slate-400 text-[10px] font-black"><i data-lucide="lock" class="w-3 h-3"></i> Default</span>`;

      const resetBtn = hasCustom
        ? `<button onclick="window.handleResetPasswordClick('${safeNisStr.replace(/'/g, "\\'")}')" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:text-red-400 text-[10px] font-black border border-red-100 dark:border-red-900/30 active:scale-95 transition-all shadow-sm hover:shadow">Reset Password</button>`
        : `<button disabled class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 text-[10px] font-black border border-slate-100/40 dark:border-slate-800/40 cursor-not-allowed">Reset Password</button>`;

      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
          <td class="p-3">
            <div class="font-black text-slate-800 dark:text-white text-xs">${safeName}</div>
          </td>
          <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${safeKelas}</td>
          <td class="p-3 text-slate-500 font-mono text-[11px] font-bold">${safeNisStr || '-'}</td>
          <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${safeWali}</td>
          <td class="p-3">${statusBadge}</td>
          <td class="p-3 text-center">${resetBtn}</td>
        </tr>
      `;

      if (mobileList) {
        mobileList.innerHTML += `
          <div class="relative bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-2.5 overflow-hidden">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${hasCustom ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-800'}"></div>
            <div class="flex justify-between items-start pl-1">
              <div>
                <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeName}</h3>
                <p class="text-[9px] text-slate-400 font-mono mt-0.5 font-bold">NIS: ${safeNisStr || '-'}</p>
              </div>
              <div>
                ${statusBadge}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 pl-1">
              <div>
                <span class="block text-[8px] text-slate-400 uppercase tracking-wider font-extrabold mb-0.5">Kelas</span>
                <span class="text-slate-700 dark:text-slate-300">${safeKelas}</span>
              </div>
              <div>
                <span class="block text-[8px] text-slate-400 uppercase tracking-wider font-extrabold mb-0.5">Wali Santri</span>
                <span class="text-slate-700 dark:text-slate-300">${safeWali}</span>
              </div>
            </div>
            <div class="pt-2.5 flex justify-end border-t border-slate-50 dark:border-slate-800/80 pl-1">
              ${resetBtn}
            </div>
          </div>
        `;
      }
    });

    if (filtered.length > maxResults) {
      const moreText = `Menampilkan ${maxResults} dari ${filtered.length} hasil. Gunakan kata kunci lebih spesifik.`;
      tbody.innerHTML += `<tr><td colspan="6" class="p-3 text-center text-slate-400 font-bold text-[10px]">${moreText}</td></tr>`;
      if (mobileList) {
        mobileList.innerHTML += `<p class="text-xs text-slate-400 font-bold p-3 text-center">${moreText}</p>`;
      }
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error memuat data HR</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-red-500 font-bold p-4 text-center">Error memuat data HR</p>`;
  }
};

/**
 * Handle reset password Wali Santri via click
 * @param {string} nis - NIS Wali Santri
 */
window.handleResetPasswordClick = async function (nis) {
  _requireAdmin();
  if (confirm(`Reset password Wali dengan NIS ${nis}? Sistem akan membuat password sementara yang aman.`)) {
    const { success, temporaryPassword, error } = await window.resetWaliPassword(nis);
    if (success) {
      window.showToast(`Password Wali ${nis} berhasil direset.`, "success");
      alert(`Password sementara Wali ${nis}:\n\n${temporaryPassword}\n\nSalin sekarang dan sampaikan melalui kanal yang aman.`);
      window.renderAdminHRList();
    } else {
      window.showToast(`Gagal reset password: ${error?.message || error}`, "error");
    }
  }
};

/**
 * Render daftar setoran Tahfizh untuk admin
 */
window.renderAdminTahfizhList = async function () {
  _requireAdmin();
  const tbody = document.getElementById("admin-tahfizh-table-body");
  const mobileList = document.getElementById("admin-tahfizh-mobile-list");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Memuat setoran tahfizh...</td></tr>`;
  if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Memuat setoran tahfizh...</p>`;

  const { data, error } = await window.loadGlobalTahfizh();
  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">Gagal memuat tahfizh: ${error || 'Offline'}</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-red-500 font-bold p-4 text-center">Gagal memuat tahfizh: ${error || 'Offline'}</p>`;
    return;
  }

  const searchQuery = document.getElementById("admin-tahfizh-search")?.value?.toLowerCase().trim() || "";

  tbody.innerHTML = "";
  if (mobileList) mobileList.innerHTML = "";

  let filtered = data;
  if (searchQuery) {
    filtered = data.filter(r =>
      (r.nama_santri && r.nama_santri.toLowerCase().includes(searchQuery)) ||
      String(r.santri_id || r.santrialias || '').includes(searchQuery) ||
      (r.kelas && r.kelas.toLowerCase().includes(searchQuery))
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Tidak ada catatan tahfizh ditemukan.</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Tidak ada catatan tahfizh ditemukan.</p>`;
    return;
  }

  const safeTahfizhText = (value, fallback = "-") => {
    const text = value === null || value === undefined || value === "" ? fallback : String(value);
    return typeof window.sanitizeHTML === "function"
      ? window.sanitizeHTML(text)
      : text.replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]);
  };

  // Pagination: 50 items per page
  const ITEMS_PER_PAGE = 50;
  const currentPage = window.adminTahfizhPage || 1;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  paginatedData.forEach(r => {
    const qColor = r.kualitas === "Lancar" ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400" :
                   r.kualitas === "Sedang" ? "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400" :
                   "bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400";

    const safeJuz = safeTahfizhText(r.juz);
    const safeHalaman = safeTahfizhText(r.halaman);
    const safeSurat = safeTahfizhText(r.surat);
    const safeKualitas = safeTahfizhText(r.kualitas, "Lancar");
    const setoranDesc = r.jenis === "Ziyadah"
      ? `<span class="text-orange-500">Ziyadah: Juz ${safeJuz} (Hlm ${safeHalaman})</span>`
      : `<span class="text-indigo-500">Murojaah: Juz ${safeJuz} (Surat ${safeSurat})</span>`;

    const safeNamaSantri = safeTahfizhText(r.nama_santri);
    const safeAlias = safeTahfizhText(r.santrialias || r.santri_id);
    const safeKelas = safeTahfizhText(r.kelas);
    const safeProgram = safeTahfizhText(r.program, "Sabaq");
    const safeDate = safeTahfizhText(r.tanggal ? window.formatDate(r.tanggal) : "-");
    const safeMusyrif = safeTahfizhText(r.musyrif);

    const safeRecordId = String(r.id).replace(/[`$\\]/g, '\\$&');
    const actions = `
      <div class="flex items-center justify-center gap-1.5">
        <button onclick="window.editAdminTahfizh('${safeRecordId}')" class="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400 flex items-center justify-center border border-orange-100 dark:border-orange-900/35 hover:scale-105 active:scale-95 transition-all animate-fade-in" title="Edit Catatan">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-edit-2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button onclick="window.deleteAdminTahfizh('${safeRecordId}')" class="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 flex items-center justify-center border border-red-100 dark:border-red-900/35 hover:scale-105 active:scale-95 transition-all animate-fade-in" title="Hapus Catatan">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
        </button>
      </div>
    `;

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white">${safeNamaSantri}</div>
          <div class="text-[9px] text-slate-400 font-mono">${safeAlias}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${safeKelas}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${safeProgram}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${setoranDesc}</td>
        <td class="p-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${qColor}">${safeKualitas}</span>
        </td>
        <td class="p-3 text-slate-400 font-mono text-[10px]">${safeDate}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${safeMusyrif}</td>
        <td class="p-3 text-center">${actions}</td>
      </tr>
    `;

    if (mobileList) {
      mobileList.innerHTML += `
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeNamaSantri}</h3>
              <p class="text-[9px] text-slate-400 font-mono mt-0.5">NIS: ${safeAlias}</p>
            </div>
            <div>
              <span class="px-2 py-0.5 rounded text-[9px] font-black ${qColor}">${safeKualitas}</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500">
            <div>
              <span class="block text-[8px] text-slate-400 uppercase">Kelas & Program</span>
              <span class="text-slate-700 dark:text-slate-300">${safeKelas} (${safeProgram})</span>
            </div>
            <div>
              <span class="block text-[8px] text-slate-400 uppercase">Tanggal</span>
              <span class="text-slate-700 dark:text-slate-300">${safeDate}</span>
            </div>
            <div class="col-span-2">
              <span class="block text-[8px] text-slate-400 uppercase">Detail Setoran</span>
              <span class="text-slate-700 dark:text-slate-300 font-extrabold">${setoranDesc}</span>
            </div>
          </div>
          <div class="pt-2 flex justify-between items-center border-t border-slate-50 dark:border-slate-800/80 text-[10px] font-bold text-slate-400">
            <span>Musyrif:</span>
            <span class="text-slate-700 dark:text-slate-300 font-black">${safeMusyrif}</span>
          </div>
          <div class="pt-2 flex gap-2 w-full mt-2">
            <button onclick="window.editAdminTahfizh('${safeRecordId}')" class="flex-1 py-2 rounded-xl bg-orange-500 text-white font-black text-xs active:scale-[0.98] transition-all text-center">Edit</button>
            <button onclick="window.deleteAdminTahfizh('${safeRecordId}')" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-black text-xs active:scale-[0.98] transition-all text-center">Hapus</button>
          </div>
        </div>
      `;
    }
  });

  // Pagination controls
  if (totalPages > 1) {
    const prevDisabled = currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50';
    const nextDisabled = currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50';

    const paginationHtml = `
      <tr><td colspan="8" class="p-3">
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-slate-400 font-bold">Menampilkan ${startIdx + 1}-${Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} dari ${filtered.length}</span>
          <div class="flex items-center gap-1">
            <button onclick="window.adminTahfizhPage=Math.max(1,window.adminTahfizhPage-1);window.renderAdminTahfizhList();" class="px-2 py-1 rounded-lg ${prevDisabled} text-slate-500 font-bold text-xs transition-all ${currentPage <= 1 ? '' : 'dark:hover:bg-slate-700'}">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            <span class="px-2 py-1 text-[10px] text-slate-500 font-bold">${currentPage}/${totalPages}</span>
            <button onclick="window.adminTahfizhPage=Math.min(${totalPages},window.adminTahfizhPage+1);window.renderAdminTahfizhList();" class="px-2 py-1 rounded-lg ${nextDisabled} text-slate-500 font-bold text-xs transition-all ${currentPage >= totalPages ? '' : 'dark:hover:bg-slate-700'}">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </td></tr>`;
    tbody.innerHTML += paginationHtml;
    mobileList.innerHTML += `
      <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <span class="text-[10px] text-slate-400 font-bold">${startIdx + 1}-${Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} dari ${filtered.length}</span>
        <div class="flex items-center gap-1">
          <button onclick="window.adminTahfizhPage=Math.max(1,window.adminTahfizhPage-1);window.renderAdminTahfizhList();" class="w-8 h-8 rounded-lg ${prevDisabled} text-slate-500 flex items-center justify-center transition-all ${currentPage <= 1 ? '' : 'dark:hover:bg-slate-700'}">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </button>
          <span class="px-2 py-1 text-[10px] text-slate-500 font-bold">${currentPage}/${totalPages}</span>
          <button onclick="window.adminTahfizhPage=Math.min(${totalPages},window.adminTahfizhPage+1);window.renderAdminTahfizhList();" class="w-8 h-8 rounded-lg ${nextDisabled} text-slate-500 flex items-center justify-center transition-all ${currentPage >= totalPages ? '' : 'dark:hover:bg-slate-700'}">
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>
      </div>`;
  } else if (filtered.length > 0) {
    const moreText = `Menampilkan ${filtered.length} setoran.`;
    tbody.innerHTML += `<tr><td colspan="8" class="p-3 text-center text-slate-400 font-bold text-[10px]">${moreText}</td></tr>`;
    if (mobileList) {
      mobileList.innerHTML += `<p class="text-xs text-slate-400 font-bold p-3 text-center">${moreText}</p>`;
    }
  }
};



/**
 * Render daftar perizinan untuk admin
 */
window.renderAdminPermits = async function () {
  _requireAdmin();
  const tbodyDashboard = document.getElementById("admin-dashboard-permits-tbody");
  const mobileListDashboard = document.getElementById("admin-dashboard-permits-mobile-list");
  const badgeDashboard = document.getElementById("admin-pending-permits-count-badge");

  const tbodyReport = document.getElementById("admin-permits-table-body");
  const mobileListReport = document.getElementById("admin-permits-mobile-list");

  const { data, error } = await window.loadGlobalPermits();
  if (error || !data) {
    if (tbodyReport) {
      tbodyReport.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">Gagal memuat perizinan: ${error || 'Offline'}</td></tr>`;
    }
    return;
  }

  // 1. POPULATE DASHBOARD PERSUB (PENDING ONLY)
  if (tbodyDashboard) {
    const pendingPermits = data.filter(p => String(p.status || "approved").toLowerCase() === "pending");
    if (badgeDashboard) badgeDashboard.textContent = `${pendingPermits.length} Pending`;

    tbodyDashboard.innerHTML = "";
    if (mobileListDashboard) mobileListDashboard.innerHTML = "";

    if (pendingPermits.length === 0) {
      tbodyDashboard.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ada pengajuan izin pending.</td></tr>`;
      if (mobileListDashboard) mobileListDashboard.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Tidak ada pengajuan izin pending.</p>`;
    } else {
      pendingPermits.forEach(p => {
        const safePermitId = String(p.id || p.nis || '').replace(/[`$\\]/g, '\\$&');
        const safeStudentName = window.sanitizeHTML(p.studentName || 'Santri');
        const safeNis = window.sanitizeHTML(p.nis || '-');
        const safeClassName = window.sanitizeHTML(p.className || "-");
        const safeType = window.sanitizeHTML(p.tipe_izin || p.category || "Izin");
        const safeStartDate = window.sanitizeHTML(p.tanggal_mulai || p.start_date || "-");
        const safeEndDate = window.sanitizeHTML(p.tanggal_selesai || p.end_date || "-");
        const safeReason = window.sanitizeHTML(p.keperluan || p.reason || '-');

        tbodyDashboard.innerHTML += `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
            <td class="p-3">
              <div class="font-black text-slate-800 dark:text-white">${safeStudentName}</div>
              <div class="text-[9px] text-slate-400 font-mono">${safeNis}</div>
            </td>
            <td class="p-3 text-slate-600 dark:text-slate-300">${safeClassName}</td>
            <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${safeType}</td>
            <td class="p-3 text-slate-500 text-[10px]">
              <div>Mulai: ${safeStartDate}</div>
              <div>Selesai: ${safeEndDate}</div>
            </td>
            <td class="p-3 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title="${safeReason}">${safeReason}</td>
            <td class="p-3 text-center">
              <div class="flex items-center justify-center gap-1.5">
                <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black active:scale-[0.98] transition-all shadow-sm shadow-emerald-500/10">Setujui</button>
                <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black active:scale-[0.98] transition-all shadow-sm shadow-rose-500/10">Tolak</button>
              </div>
            </td>
          </tr>
        `;

        if (mobileListDashboard) {
          mobileListDashboard.innerHTML += `
            <div class="bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-xl space-y-2.5">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeStudentName}</h3>
                  <p class="text-[9px] text-slate-400 font-mono mt-0.5">${safeClassName} • NIS: ${safeNis}</p>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Pending</span>
              </div>
              <div class="text-[11px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                <p><span class="text-slate-400">Tipe:</span> ${safeType}</p>
                <p><span class="text-slate-400">Waktu:</span> ${safeStartDate} s/d ${safeEndDate}</p>
                <p class="mt-1"><span class="text-slate-400">Keperluan:</span> "${safeReason}"</p>
              </div>
              <div class="flex gap-2 w-full mt-2">
                <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs active:scale-[0.98] transition-all text-center">Setujui</button>
                <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="flex-1 py-2 rounded-xl bg-rose-500 text-white font-black text-xs active:scale-[0.98] transition-all text-center">Tolak</button>
              </div>
            </div>
          `;
        }
      });
    }
  }

  // 2. POPULATE LAPORAN ARSIP (ALL WITH SEARCH / FILTERS / FORCE RETURN)
  if (tbodyReport) {
    const searchQuery = document.getElementById("admin-permit-search")?.value?.toLowerCase().trim() || "";
    const statusFilter = document.getElementById("admin-permit-status-filter")?.value || "all";

    tbodyReport.innerHTML = "";
    if (mobileListReport) mobileListReport.innerHTML = "";

    let filtered = data;

    if (searchQuery) {
      filtered = filtered.filter(p =>
        (p.studentName && p.studentName.toLowerCase().includes(searchQuery)) ||
        (p.nis && String(p.nis).includes(searchQuery)) ||
        (p.className && p.className.toLowerCase().includes(searchQuery)) ||
        (p.tipe_izin && p.tipe_izin.toLowerCase().includes(searchQuery)) ||
        (p.category && p.category.toLowerCase().includes(searchQuery)) ||
        (p.keperluan && p.keperluan.toLowerCase().includes(searchQuery)) ||
        (p.reason && p.reason.toLowerCase().includes(searchQuery))
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(p => {
        const statusLower = String(p.status || "approved").toLowerCase();
        const isActive = p.is_active !== false;

        if (statusFilter === "pending") {
          return statusLower === "pending";
        } else if (statusFilter === "approved_active") {
          return statusLower === "approved" && isActive;
        } else if (statusFilter === "kembali") {
          return statusLower === "approved" && !isActive;
        } else if (statusFilter === "rejected") {
          return statusLower === "rejected";
        }
        return true;
      });
    }

    // Sort permits: latest first (perizinan terakhir)
    filtered.sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      if (idA && idB && idA !== idB) return idB - idA;

      const dateA = new Date(a.tanggal_mulai || a.start_date || 0);
      const dateB = new Date(b.tanggal_mulai || b.start_date || 0);
      return dateB - dateA;
    });

    if (filtered.length === 0) {
      tbodyReport.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Tidak ada riwayat perizinan ditemukan.</td></tr>`;
      if (mobileListReport) mobileListReport.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Tidak ada riwayat perizinan ditemukan.</p>`;
      return;
    }

    // Pagination: 20 items per page
    const ITEMS_PER_PAGE = 20;
    const currentPage = window.adminPermitPage || 1;
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedData = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

    let tbodyHtml = "";
    let mobileListHtml = "";

    paginatedData.forEach(p => {
      const statusLower = String(p.status || "approved").toLowerCase();
      const isActive = p.is_active !== false;

      let displayStatus = "Disetujui";
      let statusClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";

      if (statusLower === "pending") {
        displayStatus = "Diajukan";
        statusClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
      } else if (statusLower === "rejected") {
        displayStatus = "Ditolak";
        statusClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
      } else if (!isActive) {
        displayStatus = "Kembali";
        statusClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
      }

      const safePermitId = String(p.id || p.nis || '').replace(/[`$\\]/g, '\\$&');
      
      let actions = `<span class="text-slate-400 text-[10px] font-bold">-</span>`;
      let mobileActions = "";

      if (statusLower === "pending") {
        actions = `
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black active:scale-[0.98] transition-all">Setujui</button>
            <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="px-2 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black active:scale-[0.98] transition-all">Tolak</button>
          </div>
        `;
        mobileActions = `
          <div class="flex gap-2 w-full mt-2">
            <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black active:scale-[0.98] transition-all text-center">Setujui</button>
            <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="flex-1 py-2 rounded-xl bg-rose-500 text-white text-[10px] font-black active:scale-[0.98] transition-all text-center">Tolak</button>
          </div>
        `;
      } else if (statusLower === "approved" && isActive) {
        actions = `
          <button onclick="window.forceReturnPermit('${safePermitId}')" class="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black active:scale-95 transition-all shadow-sm">
            Paksa Kembali
          </button>
        `;
        mobileActions = `
          <button onclick="window.forceReturnPermit('${safePermitId}')" class="w-full mt-2 py-2 rounded-xl bg-amber-500 text-white text-[10px] font-black active:scale-95 transition-all text-center shadow-sm">
            Paksa Kembali
          </button>
        `;
      }

      const safeStudentName = window.sanitizeHTML(p.studentName || 'Santri');
      const safeNis = window.sanitizeHTML(p.nis || '-');
      const safeClassName = window.sanitizeHTML(p.className || "-");
      const safeType = window.sanitizeHTML(p.tipe_izin || p.category || "Izin");
      const safeStartDate = window.sanitizeHTML(p.tanggal_mulai || p.start_date || "-");
      const safeEndDate = window.sanitizeHTML(p.tanggal_selesai || p.end_date || "-");
      const safeReason = window.sanitizeHTML(p.keperluan || p.reason || '-');

      tbodyHtml += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
          <td class="p-3">
            <div class="font-black text-slate-800 dark:text-white">${safeStudentName}</div>
            <div class="text-[9px] text-slate-400 font-mono">${safeNis}</div>
          </td>
          <td class="p-3 text-slate-600 dark:text-slate-300">${safeClassName}</td>
          <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${safeType}</td>
          <td class="p-3 text-slate-500 text-[10px]">
            <div>Mulai: ${safeStartDate}</div>
            <div>Selesai: ${safeEndDate}</div>
          </td>
          <td class="p-3 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title="${safeReason}">${safeReason}</td>
          <td class="p-3 text-center">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${statusClass}">${displayStatus}</span>
          </td>
          <td class="p-3 text-center">${actions}</td>
        </tr>
      `;

      if (mobileListReport) {
        mobileListHtml += `
          <div class="bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-xl space-y-2.5">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeStudentName}</h3>
                <p class="text-[9px] text-slate-400 font-mono mt-0.5">NIS: ${safeNis} (${safeClassName})</p>
              </div>
              <div>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${statusClass}">${displayStatus}</span>
              </div>
            </div>
            <div class="text-[11px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
              <p><span class="text-slate-400">Tipe:</span> ${safeType}</p>
              <p><span class="text-slate-400">Waktu:</span> ${safeStartDate} s/d ${safeEndDate}</p>
              <p class="mt-1"><span class="text-slate-400">Keperluan:</span> "${safeReason}"</p>
            </div>
            ${mobileActions}
          </div>
        `;
      }
    });

    // Pagination controls
    if (totalPages > 1) {
      const prevDisabled = currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50';
      const nextDisabled = currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50';

      const paginationHtml = `
        <tr><td colspan="7" class="p-3">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-slate-400 font-bold">Menampilkan ${startIdx + 1}-${Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} dari ${filtered.length}</span>
            <div class="flex items-center gap-1">
              <button onclick="window.adminPermitPage=Math.max(1,window.adminPermitPage-1);window.renderAdminPermits();" class="px-2 py-1 rounded-lg ${prevDisabled} text-slate-500 font-bold text-xs transition-all ${currentPage <= 1 ? '' : 'dark:hover:bg-slate-700'}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
              </button>
              <span class="px-2 py-1 text-[10px] text-slate-500 font-bold">${currentPage}/${totalPages}</span>
              <button onclick="window.adminPermitPage=Math.min(${totalPages},window.adminPermitPage+1);window.renderAdminPermits();" class="px-2 py-1 rounded-lg ${nextDisabled} text-slate-500 font-bold text-xs transition-all ${currentPage >= totalPages ? '' : 'dark:hover:bg-slate-700'}">
                <i data-lucide="chevron-right" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </td></tr>`;
      tbodyHtml += paginationHtml;
      mobileListHtml += `
        <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
          <span class="text-[10px] text-slate-400 font-bold">${startIdx + 1}-${Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} dari ${filtered.length}</span>
          <div class="flex items-center gap-1">
            <button onclick="window.adminPermitPage=Math.max(1,window.adminPermitPage-1);window.renderAdminPermits();" class="w-8 h-8 rounded-lg ${prevDisabled} text-slate-500 flex items-center justify-center transition-all ${currentPage <= 1 ? '' : 'dark:hover:bg-slate-700'}">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            <span class="px-2 py-1 text-[10px] text-slate-500 font-bold">${currentPage}/${totalPages}</span>
            <button onclick="window.adminPermitPage=Math.min(${totalPages},window.adminPermitPage+1);window.renderAdminPermits();" class="w-8 h-8 rounded-lg ${nextDisabled} text-slate-500 flex items-center justify-center transition-all ${currentPage >= totalPages ? '' : 'dark:hover:bg-slate-700'}">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>
        </div>`;
    } else {
      const moreText = `Menampilkan ${filtered.length} perizinan.`;
      tbodyHtml += `<tr><td colspan="7" class="p-3 text-center text-slate-400 font-bold text-[10px]">${moreText}</td></tr>`;
      if (mobileListReport) {
        mobileListHtml += `<p class="text-xs text-slate-400 font-bold p-3 text-center">${moreText}</p>`;
      }
    }

    tbodyReport.innerHTML = tbodyHtml;
    if (mobileListReport) {
      mobileListReport.innerHTML = mobileListHtml;
    }
  }

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Paksa kembali santri dari izin
 * @param {string} permitId - ID permit
 */
window.forceReturnPermit = async function (permitId) {
  _requireAdmin();
  if (!confirm("Apakah Anda yakin ingin mematikan izin ini dan memaksa status santri kembali ke pondok?")) return;

  try {
    const permitKey = 'musyrif_permits_db';
    const saved = localStorage.getItem(permitKey);
    let permits = [];
    try { permits = saved ? JSON.parse(saved) : []; } catch { permits = []; }

    const permitIdx = permits.findIndex(p => String(p.id || p.nis) === String(permitId));
    if (permitIdx === -1) {
      window.showToast?.("Izin tidak ditemukan!", "error");
      return;
    }

    const kembaliDate = new Date().toISOString().split('T')[0] + " " + new Date().toTimeString().split(' ')[0];
    const permit = permits[permitIdx];

    // Immutable update: create new array with updated item
    permits = permits.map((p, i) =>
      i === permitIdx
        ? { ...p, is_active: false, tanggal_kembali: kembaliDate }
        : p
    );

    localStorage.setItem(permitKey, JSON.stringify(permits));

    // Immutable update in appState if present
    if (appState.permits) {
      appState.permits = appState.permits.map(p =>
        String(p.id || p.nis) === String(permitId)
          ? { ...p, is_active: false, tanggal_kembali: kembaliDate }
          : p
      );
    }

    const studentName = permit.studentName || "Santri";

    window.logActivityAudit("Force Return", studentName, `Memaksa kembali santri dari izin ${permit.tipe_izin || 'Izin'}.`);
    window.showToast?.(`Status ${studentName} direset ke Pondok!`, "success");

    // Re-render
    window.renderAdminPermits();
  } catch (err) {
    window.showToast("Gagal melakukan force return", "error");
  }
};

/**
 * Setujui atau tolak permohonan izin
 * @param {string} permitId - ID permit
 * @param {boolean} approved - true = setujui, false = tolak
 */
window.approveOrRejectPermit = async function (permitId, approved) {
  _requireAdmin();
  const statusStr = approved ? "approved" : "rejected";
  const actionText = approved ? "menyetujui" : "menolak";
  const displayStatusStr = approved ? "Disetujui" : "Ditolak";

  if (confirm(`Apakah Anda yakin ingin ${actionText} permohonan izin ini?`)) {
    try {
      // Update di localStorage
      const permitKey = 'musyrif_permits_db';
      const saved = localStorage.getItem(permitKey);
      let permits = [];
      try { permits = saved ? JSON.parse(saved) : []; } catch { permits = []; }
      const updatedAt = new Date().toISOString();
      const approvedBy = appState.userProfile?.name || 'Admin';

      // Immutable update
      permits = permits.map(p =>
        (p.id || p.nis) === permitId
          ? { ...p, status: statusStr, approved_by: approvedBy, updated_at: updatedAt }
          : p
      );

      localStorage.setItem(permitKey, JSON.stringify(permits));

      // Immutable update appState jika ada
      if (appState.permits) {
        appState.permits = appState.permits.map(p =>
          (p.id || p.nis) === permitId
            ? { ...p, status: statusStr, approved_by: approvedBy, updated_at: updatedAt }
            : p
        );
      }

      window.showToast(`Izin berhasil di-${displayStatusStr.toLowerCase()}.`, "success");

      // Catat ke audit log
      if (window.logActivityAudit) {
        window.logActivityAudit('Otorisasi Izin', `ID ${permitId}`, `${displayStatusStr} izin santri`);
      }

      window.renderAdminPermits();
    } catch (err) {
      window.showToast("Gagal memperbarui status izin", "error");
    }
  }
};




/**
 * Handle submit form broadcast pengumuman
 * @param {Event} e - Submit event
 */
window.handleAdminBroadcastSubmit = async function (e) {
  _requireAdmin();
  e.preventDefault();

  const titleInput = document.getElementById("admin-broadcast-title");
  const contentInput = document.getElementById("admin-broadcast-content");
  const targetInput = document.getElementById("admin-broadcast-target");
  if (!titleInput || !contentInput) return;

  // Length limits and sanitization
  const MAX_TITLE_LENGTH = 200;
  const MAX_CONTENT_LENGTH = 5000;

  let title = titleInput.value.trim().slice(0, MAX_TITLE_LENGTH);
  let content = contentInput.value.trim().slice(0, MAX_CONTENT_LENGTH);
  const target = targetInput ? targetInput.value : "musyrif";

  // Validate required fields
  if (!title || !content) {
    window.showToast("Judul dan isi pengumuman wajib diisi!", "warning");
    return;
  }

  // Sanitize: remove HTML tags and escape special characters
  const sanitizeText = (text) => {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove potential XSS chars
      .trim();
  };

  title = sanitizeText(title);
  content = sanitizeText(content);

  // Re-validate after sanitization
  if (!title || !content) {
    window.showToast("Pengumuman tidak valid setelah disanitasi!", "warning");
    return;
  }

  const { success, error } = await window.createAnnouncement(title, content, target);
  if (success) {
    window.showToast("Broadcast pengumuman berhasil dikirim!", "success");
    titleInput.value = "";
    contentInput.value = "";
    window.renderRecentBroadcasts();
  } else {
    window.showToast(`Gagal mengirim broadcast: ${error?.message || error}`, "error");
  }
};

/**
 * Render daftar broadcast terbaru
 */
window.renderRecentBroadcasts = async function () {
  _requireAdmin();
  const container = document.getElementById("admin-recent-broadcasts");
  if (!container) return;

  container.innerHTML = `<p class="text-xs text-slate-400 font-bold">Memuat pengumuman...</p>`;

  const { data, error } = await window.loadAnnouncements();
  if (error || !data) {
    container.innerHTML = `<p class="text-xs text-red-500">Gagal memuat pengumuman: ${error || 'Offline'}</p>`;
    return;
  }

  container.innerHTML = "";

  if (data.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 font-bold">Belum ada broadcast pengumuman.</p>`;
    return;
  }

  data.forEach(ann => {
    // Safe DOM construction to prevent XSS
    const item = document.createElement('div');
    item.className = 'p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 space-y-2';

    const title = document.createElement('h4');
    title.className = 'text-xs font-black text-slate-800 dark:text-white';
    title.textContent = window.sanitizeHTML(ann.title) || '';

    const date = document.createElement('span');
    date.className = 'text-[9px] text-slate-400 font-mono shrink-0';
    date.textContent = ann.created_at ? new Date(ann.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : '-';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex justify-between items-start gap-2';
    headerDiv.appendChild(title);
    headerDiv.appendChild(date);

    // Target badge display
    const targetBadge = document.createElement('div');
    const targetText = ann.target === 'wali' ? 'Wali Santri' : ann.target === 'all' ? 'Semua User' : 'Musyrif';
    const targetColor = ann.target === 'wali' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400' :
                        ann.target === 'all' ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400' :
                        'bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-950/30 dark:text-teal-400';
    targetBadge.className = `inline-flex text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${targetColor}`;
    targetBadge.textContent = targetText;

    const content = document.createElement('p');
    content.className = 'text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold whitespace-pre-line';
    content.textContent = window.sanitizeHTML(ann.content) || '';

    const byline = document.createElement('div');
    byline.className = 'text-[9px] text-slate-400 font-bold';
    byline.textContent = `Oleh: ${window.sanitizeHTML(ann.created_by) || 'Admin'}`;

    item.appendChild(headerDiv);
    item.appendChild(targetBadge);
    item.appendChild(content);
    item.appendChild(byline);
    container.appendChild(item);
  });
};


/**
 * Render log aktivitas sistem
 */
window.renderAdminLogs = async function () {
  _requireAdmin();
  const tbody = document.getElementById("admin-logs-tbody");
  const mobileList = document.getElementById("admin-logs-mobile-list");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Memuat logs...</td></tr>`;
  if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Memuat logs...</p>`;

  const { data, error } = await window.loadGlobalActivityLogs();
  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat logs: ${error || 'Offline'}</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-red-500 font-bold p-4 text-center">Gagal memuat logs: ${error || 'Offline'}</p>`;
    return;
  }

  tbody.innerHTML = "";
  if (mobileList) mobileList.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Tidak ada log aktivitas.</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Tidak ada log aktivitas.</p>`;
    return;
  }

  data.forEach(log => {
    const safeUserName = _escapeHtml(log.user_name || 'System');
    const safeAction = _escapeHtml(log.action || '-');
    const safeDetail = _escapeHtml(log.detail || '-');
    const formattedDate = log.created_at
      ? new Date(log.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'})
      : '-';

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3 text-[10px] text-slate-400 font-mono">${formattedDate}</td>
        <td class="p-3 text-slate-700 dark:text-slate-300">${safeUserName}</td>
        <td class="p-3 text-slate-800 dark:text-white font-bold"><span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">${safeAction}</span></td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold max-w-[200px] truncate" title="${safeDetail}">${safeDetail}</td>
      </tr>
    `;

    if (mobileList) {
      mobileList.innerHTML += `
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeUserName}</h3>
              <p class="text-[9px] text-slate-400 font-mono mt-0.5">${formattedDate}</p>
            </div>
            <div>
              <span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[9px] font-black">${safeAction}</span>
            </div>
          </div>
          <p class="text-[10px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">${safeDetail}</p>
        </div>
      `;
    }
  });
};

window.logActivityAudit = async function (action, target, description) {
  try {
    // Simpan ke localStorage
    const logsKey = 'local_activity_logs';
    const saved = localStorage.getItem(logsKey);
    let logs = [];
    try { logs = saved ? JSON.parse(saved) : []; } catch { logs = []; }

    logs.unshift({
      user_name: appState.userProfile?.name || 'Admin',
      action: action,
      detail: `${target}: ${description}`,
      created_at: new Date().toISOString()
    });

    // Simpan maksimal 500 log
    localStorage.setItem(logsKey, JSON.stringify(logs.slice(0, 500)));
  } catch (e) {
    // Silent fail - audit log is non-critical
  }
};

window.openAdminBroadcast = function () {
  _requireAdmin();
  window.switchTab('profile');
  // Scroll to broadcast form
  setTimeout(() => {
    const broadcastForm = document.getElementById("admin-broadcast-form");
    if (broadcastForm) {
      broadcastForm.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
};

// ==========================================
// CONFIGURASI GPS & GEOFENCING OVERRIDE (ADMIN ONLY)
// ==========================================

/**
 * Render konfigurasi GPS/Geofencing
 */
window.renderAdminGPSConfig = function () {
  _requireAdmin();
  const toggle = document.getElementById("admin-gps-geofencing-toggle");
  const radiusInput = document.getElementById("admin-gps-radius-input");
  const radiusVal = document.getElementById("admin-gps-radius-val");
  const listContainer = document.getElementById("admin-gps-locations-list");

  if (!toggle || !radiusInput || !listContainer) return;

  // Set values from current GEO_CONFIG
  toggle.checked = GEO_CONFIG.useGeofencing;
  radiusInput.value = GEO_CONFIG.maxRadiusMeters;
  if (radiusVal) radiusVal.textContent = GEO_CONFIG.maxRadiusMeters + "m";

  // Render list of locations
  listContainer.innerHTML = "";
  if (!GEO_CONFIG.locations || GEO_CONFIG.locations.length === 0) {
    listContainer.innerHTML = `<p class="text-[10px] font-bold text-slate-400 p-2 text-center">Belum ada lokasi terdaftar</p>`;
  } else {
    GEO_CONFIG.locations.forEach((loc, idx) => {
      const item = document.createElement("div");
      item.className = "flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300";
      item.innerHTML = `
        <div class="min-w-0 pr-2">
          <p class="truncate font-black text-slate-900 dark:text-white leading-tight">${loc.name || 'Lokasi'}</p>
          <p class="text-[9px] text-slate-400 font-semibold mt-0.5">${Number(loc.lat).toFixed(6)}, ${Number(loc.lng).toFixed(6)}</p>
        </div>
        <button type="button" onclick="window.deleteAdminGPSLocation(${idx})" class="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-100 shrink-0 active:scale-95 transition-all">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      `;
      listContainer.appendChild(item);
    });
  }

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Simpan konfigurasi GPS
 */
window.saveAdminGPSConfig = function () {
  _requireAdmin();
  const toggle = document.getElementById("admin-gps-geofencing-toggle");
  const radiusInput = document.getElementById("admin-gps-radius-input");

  if (!toggle || !radiusInput) return;

  const isChecked = toggle.checked;
  // Validate radius: 5 to 5000 meters
  const rawRadius = parseInt(radiusInput.value) || 50;
  const radius = Math.max(5, Math.min(5000, rawRadius)); // Clamp between 5-5000m

  // Update GEO_CONFIG in memory
  GEO_CONFIG.useGeofencing = isChecked;
  GEO_CONFIG.maxRadiusMeters = radius;

  // Persist to localStorage
  const gpsConfig = {
    useGeofencing: isChecked,
    maxRadiusMeters: radius,
    locations: GEO_CONFIG.locations
  };
  localStorage.setItem("syamsa_gps_config", JSON.stringify(gpsConfig));
  window.logActivityAudit("Update GPS", "Geofencing", `Mengubah status geofencing ke ${isChecked} dengan radius ${radius}m.`);

  window.showToast?.("Pengaturan GPS disimpan!", "success");
};

/**
 * Tambah lokasi GPS baru
 */
window.addAdminGPSLocation = function () {
  _requireAdmin();
  const nameEl = document.getElementById("admin-gps-new-name");
  const latEl = document.getElementById("admin-gps-new-lat");
  const lngEl = document.getElementById("admin-gps-new-lng");

  if (!nameEl || !latEl || !lngEl) return;

  const name = nameEl.value.trim().slice(0, 100); // Limit name length
  const rawLat = latEl.value.trim();
  const rawLng = lngEl.value.trim();
  const lat = parseFloat(rawLat);
  const lng = parseFloat(rawLng);

  // Validate coordinates: lat -90 to 90, lng -180 to 180
  if (!name) {
    window.showToast?.("Nama lokasi wajib diisi!", "warning");
    return;
  }
  if (isNaN(lat) || lat < -90 || lat > 90) {
    window.showToast?.("Latitude tidak valid! Range: -90 s/d 90", "warning");
    return;
  }
  if (isNaN(lng) || lng < -180 || lng > 180) {
    window.showToast?.("Longitude tidak valid! Range: -180 s/d 180", "warning");
    return;
  }

  // Immutable update: create new array with new location
  GEO_CONFIG.locations = [...(GEO_CONFIG.locations || []), { name, lat, lng }];

  // Save config
  window.saveAdminGPSConfig();

  // Clear inputs
  nameEl.value = "";
  latEl.value = "";
  lngEl.value = "";

  // Re-render
  window.renderAdminGPSConfig();
  window.showToast?.("Lokasi baru ditambahkan!", "success");
};

/**
 * Hapus lokasi GPS
 * @param {number} idx - Index lokasi
 */
window.deleteAdminGPSLocation = function (idx) {
  _requireAdmin();
  if (!GEO_CONFIG.locations || idx < 0 || idx >= GEO_CONFIG.locations.length) return;

  const deleted = GEO_CONFIG.locations[idx];

  // Immutable update: filter out the deleted location
  GEO_CONFIG.locations = GEO_CONFIG.locations.filter((_, i) => i !== idx);

  // Save config
  window.saveAdminGPSConfig();

  // Re-render
  window.renderAdminGPSConfig();
  window.showToast?.(`Lokasi ${deleted.name} dihapus!`, "info");
};

// ==========================================
// LEADERBOARD KEPATUHAN MUSYRIF (STREAK HARIAN)
// ==========================================

/**
 * Hitung streak kepatuhan Musyrif
 * @returns {Array} Array streak data per kelas
 */
window.calculateMusyrifStreaks = async function () {
  const result = [];
  const slots = ['shubuh', 'sekolah', 'ashar', 'maghrib', 'isya'];
  const todayStr = window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().split('T')[0];

  // Helper to subtract days
  const subtractDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const useIndexedDB = window.storageManager?.getStatus()?.useIndexedDB && window._repos?.attendance;
  let allRecords = [];

  if (useIndexedDB) {
    try {
      allRecords = await window._repos.attendance.db.getAll('attendances');
    } catch (err) {
      console.error('[AdminManager] Failed to get all attendance records from IndexedDB:', err);
    }
  }

  const classNames = Object.keys(MASTER_KELAS);

  for (const className of classNames) {
    if (className.toLowerCase() === 'admin musyrif') continue;

    const classInfo = MASTER_KELAS[className];
    let totalSlotsFilled = 0;
    let filledDatesSet = new Set();

    if (useIndexedDB) {
      const classRecords = allRecords.filter(r => r.kelas === className);
      classRecords.forEach(record => {
        const dateKey = record.date;
        const slotId = record.slot;
        if (slots.includes(slotId) && record.status && Object.keys(record.status).length > 0) {
          totalSlotsFilled++;
          filledDatesSet.add(dateKey);
        }
      });
    } else {
      const storageKey = `musyrif_attendance_${className.replace(/\s+/g, '_')}`;
      const savedData = localStorage.getItem(storageKey);
      
      if (savedData) {
        const attendanceData = window.safeJsonParse(savedData, {});
        if (attendanceData) {
          Object.keys(attendanceData).forEach(dateKey => {
            const dayData = attendanceData[dateKey];
            if (dayData) {
              let dayHasData = false;
              slots.forEach(slotId => {
                if (dayData[slotId] && Object.keys(dayData[slotId]).length > 0) {
                  totalSlotsFilled++;
                  dayHasData = true;
                }
              });
              if (dayHasData) {
                filledDatesSet.add(dateKey);
              }
            }
          });
        }
      }
    }

    // Compute current streak
    let currentStreak = 0;
    const todayFilled = filledDatesSet.has(todayStr);
    const yesterdayStr = subtractDays(todayStr, 1);
    const yesterdayFilled = filledDatesSet.has(yesterdayStr);

    if (todayFilled) {
      currentStreak = 1;
      let dayOffset = 1;
      while (true) {
        const prevDate = subtractDays(todayStr, dayOffset);
        if (filledDatesSet.has(prevDate)) {
          currentStreak++;
          dayOffset++;
        } else {
          break;
        }
      }
    } else if (yesterdayFilled) {
      currentStreak = 1;
      let dayOffset = 2;
      while (true) {
        const prevDate = subtractDays(todayStr, dayOffset);
        if (filledDatesSet.has(prevDate)) {
          currentStreak++;
          dayOffset++;
        } else {
          break;
        }
      }
    }

    // Compute compliance rate (percentage of days filled in the last 14 days)
    let filledLast14 = 0;
    for (let i = 0; i < 14; i++) {
      const dateToCheck = subtractDays(todayStr, i);
      if (filledDatesSet.has(dateToCheck)) {
        filledLast14++;
      }
    }
    const complianceRate = Math.round((filledLast14 / 14) * 100);

    result.push({
      className,
      musyrif: classInfo.musyrif || 'Musyrif',
      streak: currentStreak,
      totalSlots: totalSlotsFilled,
      compliance: complianceRate
    });
  }

  // Sort by streak desc, then by compliance desc, then by totalSlots desc
  result.sort((a, b) => b.streak - a.streak || b.compliance - a.compliance || b.totalSlots - a.totalSlots);
  return result;
};

/**
 * Render leaderboard kepatuhan Musyrif
 */
window.renderMusyrifLeaderboard = async function () {
  _requireAdmin();
  const tbody = document.getElementById("admin-musyrif-streak-body");
  if (!tbody) return;

  const data = await window.calculateMusyrifStreaks();

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Tidak ada data kepatuhan Musyrif.</td></tr>`;
    return;
  }

  data.forEach((row, index) => {
    const rank = index + 1;
    const badgeColor = rank === 1 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25" :
                       rank === 2 ? "bg-slate-400/10 text-slate-600 dark:text-slate-400 border border-slate-400/25" :
                       rank === 3 ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/25" :
                       "bg-slate-500/5 text-slate-500 dark:text-slate-400 border border-slate-500/10";
                       
    const streakDisplay = row.streak > 0 ? `🔥 <span class="text-amber-500 font-black">${row.streak} Hari</span>` : `<span class="text-slate-400 font-bold">-</span>`;
    
    // Compliance progress bar color
    const progressColor = row.compliance >= 80 ? "bg-emerald-500 shadow-emerald-500/20" :
                          row.compliance >= 50 ? "bg-amber-500 shadow-amber-500/20" :
                          "bg-rose-500 shadow-rose-500/20";

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3 text-center">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${badgeColor}">${rank}</span>
        </td>
        <td class="p-3 text-slate-900 dark:text-white font-black">${_escapeHtml(row.musyrif)}</td>
        <td class="p-3 text-slate-500 dark:text-slate-400 font-bold">${_escapeHtml(row.className)}</td>
        <td class="p-3 text-center font-black text-xs">${streakDisplay}</td>
        <td class="p-3 text-center font-bold text-slate-600 dark:text-slate-300">${row.totalSlots} Sesi</td>
        <td class="p-3">
          <div class="flex items-center gap-2">
            <div class="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-200/10">
              <div class="${progressColor} h-2 rounded-full transition-all duration-500" style="width: ${row.compliance}%"></div>
            </div>
            <span class="text-[10px] font-black text-slate-600 dark:text-slate-300 shrink-0 w-8 text-right">${row.compliance}%</span>
          </div>
        </td>
      </tr>
    `;
  });

  if (window.lucide) window.lucide.createIcons();
};

// ==========================================
// MANAJEMEN PELANGGARAN & POIN DENDA (ADMIN ONLY)
// ==========================================

const DEFAULT_VIOLATION_RULES = {
  "Kabur dari Asrama": 50,
  "Merusak Fasilitas": 30,
  "Membawa HP / Elektronik": 20,
  "Melanggar Aturan Busana": 10,
  "Terlambat Sesi Shalat": 5,
  "Lainnya": 10
};

/**
 * Get aturan pelanggaran dari storage
 * @returns {Object} Object dengan key nama aturan dan value poin
 */
window.getViolationRules = function () {
  try {
    const saved = localStorage.getItem("syamsa_violation_rules");
    if (!saved) return DEFAULT_VIOLATION_RULES;
    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_VIOLATION_RULES;
    }
  } catch (e) {
    return DEFAULT_VIOLATION_RULES;
  }
};

/**
 * Render form aturan pelanggaran
 */
window.renderAdminViolationRules = function () {
  _requireAdmin();
  const container = document.getElementById("admin-violation-rules-list");
  if (!container) return;

  const rules = window.getViolationRules();
  container.innerHTML = "";

  Object.keys(rules).forEach(ruleName => {
    const points = rules[ruleName];
    const item = document.createElement("div");
    item.className = "flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/50 dark:border-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300";
    item.innerHTML = `
      <span class="truncate pr-2 font-black">${ruleName}</span>
      <div class="flex items-center gap-1 shrink-0">
        <input type="number" data-rule="${ruleName}" value="${points}" min="1" max="100" class="w-14 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1 text-center text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:border-teal-500" />
        <span class="text-[9px] font-extrabold text-slate-400">Poin</span>
      </div>
    `;
    container.appendChild(item);
  });
};

/**
 * Simpan aturan pelanggaran
 */
window.saveAdminViolationRules = function () {
  _requireAdmin();
  const inputs = document.querySelectorAll("#admin-violation-rules-list input[type='number']");
  const rules = {};

  inputs.forEach(input => {
    const ruleName = input.getAttribute("data-rule");
    const points = parseInt(input.value) || 10;
    rules[ruleName] = points;
  });

  localStorage.setItem("syamsa_violation_rules", JSON.stringify(rules));
  
  // Also update options inside violation-type-select if it exists
  const typeSelect = document.getElementById("violation-type-select");
  if (typeSelect) {
    typeSelect.innerHTML = "";
    Object.keys(rules).forEach(ruleName => {
      const opt = document.createElement("option");
      opt.value = ruleName;
      opt.setAttribute("data-points", rules[ruleName]);
      opt.textContent = `${ruleName} (${rules[ruleName]} Poin)`;
      typeSelect.appendChild(opt);
    });
  }

  window.logActivityAudit("Update Bobot Pelanggaran", "Sistem", "Mengubah denda bobot poin pelanggaran pesantren.");
  window.showToast?.("Bobot poin pelanggaran berhasil disimpan!", "success");
  
  // Refresh views
  window.renderViolationLeaderboard();
  window.renderAdminViolationsList();
};

/**
 * Render leaderboard pelanggaran
 */
window.renderViolationLeaderboard = function () {
  _requireAdmin();
  const tbody = document.getElementById("admin-violation-leaderboard-body");
  if (!tbody) return;

  const violations = appState.violations || [];
  const rules = window.getViolationRules();

  // Aggregate points per student
  const studentPointsMap = {};
  violations.forEach(v => {
    const studentId = String(v.studentId);
    // Use rule point if type exists, else fallback to log point
    const points = rules[v.type] !== undefined ? rules[v.type] : (v.points || 0);
    
    if (!studentPointsMap[studentId]) {
      studentPointsMap[studentId] = {
        studentId: studentId,
        points: 0,
        count: 0
      };
    }
    studentPointsMap[studentId].points += points;
    studentPointsMap[studentId].count++;
  });

  // Convert to array and enrich with student name and class
  const data = [];
  Object.keys(studentPointsMap).forEach(studentId => {
    const record = studentPointsMap[studentId];
    const student = (typeof MASTER_SANTRI !== "undefined") ? MASTER_SANTRI.find(s => String(s.nis || s.id) === studentId) : null;
    
    if (student) {
      data.push({
        studentId: studentId,
        name: student.nama,
        className: student.kelas || student.rombel || "-",
        points: record.points,
        count: record.count
      });
    }
  });

  // Sort by points desc
  data.sort((a, b) => b.points - a.points);

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Belum ada catatan pelanggaran aktif.</td></tr>`;
    return;
  }

  data.forEach((row, index) => {
    const rank = index + 1;
    const badgeColor = rank === 1 ? "bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/25" :
                       rank === 2 ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25" :
                       rank === 3 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25" :
                       "bg-slate-500/5 text-slate-500 dark:text-slate-400 border border-slate-500/10";
                       
    // Status text based on points severity
    const statusText = row.points >= 100 ? "SP3 (Skorsing)" :
                       row.points >= 75 ? "SP2 (Keras)" :
                       row.points >= 50 ? "SP1 (Intensif)" :
                       row.points >= 25 ? "Ringan" :
                       "Teguran";

    const statusBadgeClass = row.points >= 100 ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" :
                             row.points >= 75 ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20" :
                             row.points >= 50 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                             row.points >= 25 ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" :
                             "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20";

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors text-[11px] font-bold">
        <td class="p-3 text-center">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${badgeColor}">${rank}</span>
        </td>
        <td class="p-3 text-slate-900 dark:text-white font-black">${_escapeHtml(row.name)}</td>
        <td class="p-3 text-slate-500 dark:text-slate-400 font-bold">${_escapeHtml(row.className)}</td>
        <td class="p-3 text-center font-black text-xs text-red-600 dark:text-red-400">${row.points} Poin</td>
        <td class="p-3 text-center">
          <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black inline-block ${statusBadgeClass}">${statusText}</span>
        </td>
        <td class="p-3 text-center">
          <button type="button" onclick="window.recordCoachingDirect('${row.studentId}', '${_escapeHtml(row.name)}')" class="py-1 px-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-black active:scale-95 hover:bg-teal-500/25 transition-all">
            Bina Santri
          </button>
        </td>
      </tr>
    `;
  });
};

/**
 * Render daftar pelanggaran
 */
window.renderAdminViolationsList = function () {
  _requireAdmin();
  const tbody = document.getElementById("admin-violations-log-body");
  if (!tbody) return;

  const searchQuery = (document.getElementById("admin-violation-search")?.value || "").toLowerCase().trim();
  const violations = appState.violations || [];
  const rules = window.getViolationRules();

  tbody.innerHTML = "";
  
  // Filter search
  const filtered = violations.filter(v => {
    const student = (typeof MASTER_SANTRI !== "undefined") ? MASTER_SANTRI.find(s => String(s.nis || s.id) === String(v.studentId)) : null;
    const studentName = student ? student.nama.toLowerCase() : "";
    const note = (v.note || "").toLowerCase();
    const type = (v.type || "").toLowerCase();
    return studentName.includes(searchQuery) || note.includes(searchQuery) || type.includes(searchQuery);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400">Tidak ada log pelanggaran yang cocok.</td></tr>`;
    return;
  }

  // Sort logs by newest first
  filtered.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime());

  filtered.forEach(v => {
    const student = (typeof MASTER_SANTRI !== "undefined") ? MASTER_SANTRI.find(s => String(s.nis || s.id) === String(v.studentId)) : null;
    const studentName = student ? student.nama : `ID: ${v.studentId}`;
    const className = student ? (student.kelas || student.rombel || "-") : "-";
    const points = rules[v.type] !== undefined ? rules[v.type] : (v.points || 10);
    const dateFormatted = v.date || new Date(v.timestamp).toISOString().split('T')[0];

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors text-[11px] font-bold">
        <td class="p-2">
          <div class="font-black text-slate-900 dark:text-white leading-tight">${_escapeHtml(studentName)}</div>
          <div class="text-[9px] text-slate-400 mt-0.5">${_escapeHtml(className)}</div>
        </td>
        <td class="p-2 text-slate-700 dark:text-slate-300 font-black">${_escapeHtml(v.type)}</td>
        <td class="p-2 text-center text-red-500 font-black">${points}</td>
        <td class="p-2 text-slate-500 dark:text-slate-400 max-w-[150px] truncate" title="${_escapeHtml(v.note)}">${_escapeHtml(v.note)}</td>
        <td class="p-2 text-center">
          <button type="button" onclick="window.deleteAdminViolation('${v.id}')" class="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-100 shrink-0 active:scale-95 transition-all">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `;
  });

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Hapus pelanggaran
 * @param {string} id - ID pelanggaran
 */
window.deleteAdminViolation = function (id) {
  _requireAdmin();
  if (!appState.violations || appState.violations.length === 0) return;

  const targetIdx = appState.violations.findIndex(v => String(v.id) === String(id));
  if (targetIdx === -1) return;

  const deleted = appState.violations[targetIdx];
  const student = (typeof MASTER_SANTRI !== "undefined") ? MASTER_SANTRI.find(s => String(s.nis || s.id) === String(deleted.studentId)) : null;
  const name = student ? student.nama : `Santri ID: ${deleted.studentId}`;

  // Immutable update: filter out the deleted item
  const updatedViolations = appState.violations.filter((_, i) => i !== targetIdx);
  appState.violations = updatedViolations;
  localStorage.setItem("musyrif_violations_db", JSON.stringify(updatedViolations));

  window.logActivityAudit("Hapus Pelanggaran", name, `Menghapus catatan pelanggaran ${deleted.type} (${deleted.points} Poin).`);
  window.showToast?.("Log pelanggaran berhasil dihapus!", "info");

  // Re-render lists
  window.renderViolationLeaderboard();
  window.renderAdminViolationsList();
};

/**
 * Rekam pembinaan langsung
 * @param {string} studentId - ID Santri
 * @param {string} name - Nama Santri
 */
window.recordCoachingDirect = function (studentId, name) {
  _requireAdmin();
  const modal = document.getElementById("modal-input-pembinaan");
  if (!modal) {
    const action = prompt(`Masukkan tindakan pembinaan/pendampingan untuk ${name}:`);
    if (action && action.trim()) {
      window.logActivityAudit("Pembinaan Langsung", name, `Tindakan pembinaan: ${action.trim()}`);
      window.showToast?.(`Pembinaan untuk ${name} berhasil dicatat!`, "success");
    }
    return;
  }

  const studentSelect = document.getElementById("pembinaan-student-select");
  if (studentSelect) {
    studentSelect.innerHTML = `<option value="${studentId}" selected>${name}</option>`;
    studentSelect.disabled = true;
  }

  const noteInput = document.getElementById("pembinaan-note");
  if (noteInput) noteInput.value = "";

  window.openModal("modal-input-pembinaan");
};

// ============================================================
// SURAT PERINGATAN (SP) APPROVAL HUB & GENERATOR
// ============================================================

/**
 * Generate draft Surat Peringatan
 * @returns {Array} Array SP documents
 */
window.generateSPDrafts = function () {
  _requireAdmin();
  try {
    const spKey = "musyrif_sp_docs";
    const saved = localStorage.getItem(spKey);
    let spDocs = [];
    try { spDocs = saved ? JSON.parse(saved) : []; } catch { spDocs = []; }

    // Loop all master students
    const students = typeof MASTER_SANTRI !== "undefined" ? MASTER_SANTRI : [];
    students.forEach(s => {
      const studentId = String(s.nis || s.id || '').trim();
      if (!studentId) return;

      const totalAlpa = window.countTotalAlpa?.(studentId) || 0;
      const statusObj = window.getPembinaanStatus?.(totalAlpa);
      
      if (statusObj && statusObj.level >= 2 && statusObj.level <= 4) {
        const level = statusObj.level;
        const spName = `SP ${level - 1}`;
        const docId = `sp-${studentId}-${level}`;

        const exists = spDocs.some(d => d.id === docId);
        if (!exists) {
          spDocs.push({
            id: docId,
            studentId,
            studentName: s.nama,
            className: s.kelas || s.rombel || "-",
            level,
            spName,
            alpaCount: totalAlpa,
            status: "pending",
            created_at: new Date().toISOString(),
            approved_by: ""
          });
        } else {
          const idx = spDocs.findIndex(d => d.id === docId);
          if (idx !== -1 && spDocs[idx].status === "pending") {
            spDocs[idx].alpaCount = totalAlpa;
          }
        }
      }
    });

    localStorage.setItem(spKey, JSON.stringify(spDocs));
    return spDocs;
  } catch (e) {
    console.error("[SP Draft] Error generating SP drafts:", e);
    return [];
  }
};

/**
 * Render hub Surat Peringatan
 */
window.renderAdminSPHub = function () {
  _requireAdmin();
  const tbody = document.getElementById("admin-pending-sp-tbody");
  const mobileList = document.getElementById("admin-pending-sp-mobile-list");
  const badge = document.getElementById("admin-pending-sp-count-badge");
  if (!tbody) return;

  const spDocs = window.generateSPDrafts() || [];
  const pending = spDocs.filter(d => d.status === "pending");

  if (badge) badge.textContent = `${pending.length} Pending`;

  tbody.innerHTML = "";
  if (mobileList) mobileList.innerHTML = "";

  if (pending.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Tidak ada penerbitan SP pending.</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Tidak ada penerbitan SP pending.</p>`;
    return;
  }

  pending.forEach(p => {
    const safeSpId = String(p.id).replace(/[`$\\]/g, '\\$&');
    const safeStudentName = window.sanitizeHTML(p.studentName || 'Santri');
    const safeClassName = window.sanitizeHTML(p.className || "-");
    const safeSpName = window.sanitizeHTML(p.spName || "SP");

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white">${safeStudentName}</div>
          <div class="text-[9px] text-slate-400 font-mono">${p.studentId}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${safeClassName}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
            Draft ${safeSpName}
          </span>
        </td>
        <td class="p-3 text-center text-slate-700 dark:text-slate-300 font-black">${p.alpaCount} Sesi Alpa</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="window.approveOrRejectSP('${safeSpId}', true)" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black active:scale-[0.98] transition-all">Setujui</button>
            <button onclick="window.approveOrRejectSP('${safeSpId}', false)" class="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-black active:scale-[0.98] transition-all">Tolak</button>
          </div>
        </td>
      </tr>
    `;

    if (mobileList) {
      mobileList.innerHTML += `
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeStudentName}</h3>
              <p class="text-[9px] text-slate-400 font-mono mt-0.5">${safeClassName} • NIS: ${p.studentId}</p>
            </div>
            <span class="px-2 py-0.5 rounded text-[9px] font-black bg-rose-50 text-rose-500 border border-rose-100">Draft ${safeSpName}</span>
          </div>
          <div class="text-[11px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
            <p><span class="text-slate-400">Akumulasi:</span> ${p.alpaCount} Sesi Alpa</p>
          </div>
          <div class="flex gap-2 w-full mt-2">
            <button onclick="window.approveOrRejectSP('${safeSpId}', true)" class="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs active:scale-[0.98] transition-all text-center">Setujui</button>
            <button onclick="window.approveOrRejectSP('${safeSpId}', false)" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-black text-xs active:scale-[0.98] transition-all text-center">Tolak</button>
          </div>
        </div>
      `;
    }
  });

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Setujui atau tolak Surat Peringatan
 * @param {string} spId - ID SP
 * @param {boolean} approved - true = setujui, false = tolak
 */
window.approveOrRejectSP = async function (spId, approved) {
  _requireAdmin();
  const actionText = approved ? "menyetujui penerbitan" : "menolak/menahan";
  const displayStatus = approved ? "approved" : "rejected";

  if (!confirm(`Apakah Anda yakin ingin ${actionText} dokumen Surat Peringatan ini?`)) return;

  try {
    const spKey = "musyrif_sp_docs";
    const saved = localStorage.getItem(spKey);
    let spDocs = [];
    try { spDocs = saved ? JSON.parse(saved) : []; } catch { spDocs = []; }

    const idx = spDocs.findIndex(d => String(d.id) === String(spId));
    if (idx !== -1) {
      spDocs[idx].status = displayStatus;
      spDocs[idx].approved_by = appState.userProfile?.name || 'Admin';
      spDocs[idx].updated_at = new Date().toISOString();
      localStorage.setItem(spKey, JSON.stringify(spDocs));

      window.showToast?.(`Penerbitan SP berhasil di-${approved ? 'setujui' : 'tolak'}.`, "success");
      
      if (window.logActivityAudit) {
        window.logActivityAudit('Otorisasi SP', spDocs[idx].studentName, `${approved ? 'Menyetujui' : 'Menolak'} penerbitan ${spDocs[idx].spName}`);
      }

      window.renderAdminSPHub();
      
      // Refresh Wali view if Wali mode is open (helps on local testing)
      if (window.updateWaliDashboardSummary) window.updateWaliDashboardSummary();
    }
  } catch (err) {
    window.showToast?.("Gagal memproses Surat Peringatan", "error");
  }
};

/**
 * Buka modal SP
 * @param {string} spDocId - ID dokumen SP
 */
window.openSPModal = function (spDocId) {
  _requireAdmin();
  try {
    const spKey = "musyrif_sp_docs";
    const saved = localStorage.getItem(spKey);
    let spDocs = [];
    try { spDocs = saved ? JSON.parse(saved) : []; } catch { spDocs = []; }
    
    const doc = spDocs.find(d => String(d.id) === String(spDocId));
    if (!doc) {
      window.showToast?.("Dokumen SP tidak ditemukan!", "error");
      return;
    }

    const titleEl = document.getElementById("sp-letter-title");
    const numEl = document.getElementById("sp-letter-number");
    const studentEl = document.getElementById("sp-letter-student");
    const nisEl = document.getElementById("sp-letter-nis");
    const classEl = document.getElementById("sp-letter-class");
    const alpaEl = document.getElementById("sp-letter-alpa");
    const dateEl = document.getElementById("sp-letter-date");
    const signerEl = document.getElementById("sp-letter-signer");

    if (titleEl) titleEl.textContent = `Surat Peringatan (${doc.spName})`;
    if (numEl) numEl.textContent = `Nomor: SP/2026/06/${String(doc.studentId).slice(-3)}-0${doc.level}`;
    if (studentEl) studentEl.textContent = doc.studentName || "-";
    if (nisEl) nisEl.textContent = doc.studentId || "-";
    if (classEl) classEl.textContent = doc.className || "-";
    if (alpaEl) alpaEl.textContent = `${doc.alpaCount} Sesi`;
    if (dateEl) {
      const dateObj = doc.created_at ? new Date(doc.created_at) : new Date();
      dateEl.textContent = dateObj.toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'});
    }
    if (signerEl) signerEl.textContent = doc.approved_by || "Kepala Divisi Kesiswaan Admin";

    // Show modal
    const modal = document.getElementById("modal-view-sp");
    if (modal) modal.classList.remove("hidden");
  } catch (err) {
    console.error("[SP Modal] Error opening SP modal:", err);
  }
};

/**
 * Print Surat Peringatan
 */
window.printSPLetter = function () {
  const paper = document.getElementById("sp-letter-paper");
  if (!paper) return;

  const printContent = paper.outerHTML;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Surat Peringatan</title>
        <style>
          body { font-family: serif; padding: 40px; color: #333; line-height: 1.6; font-size: 14px; }
          .border-b-2 { border-bottom: 2px solid #ccc; }
          .border-double { border-style: double; }
          .pb-4 { padding-bottom: 16px; }
          .mb-6 { margin-bottom: 24px; }
          .mb-4 { margin-bottom: 16px; }
          .mt-8 { margin-top: 32px; }
          .mt-12 { margin-top: 48px; }
          .text-center { text-align: center; }
          .text-justify { text-align: justify; }
          .underline { text-decoration: underline; }
          .uppercase { text-transform: uppercase; }
          .font-sans { font-family: sans-serif; }
          .font-black { font-weight: 900; }
          .font-bold { font-weight: bold; }
          .text-sm { font-size: 14px; }
          .text-xs { font-size: 12px; }
          .text-[9px] { font-size: 11px; }
          .text-[8px] { font-size: 10px; }
          .w-full { width: 100%; }
          .w-28 { width: 112px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .px-2 { padding-left: 8px; padding-right: 8px; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-end { align-items: flex-end; }
          .text-right { text-align: right; }
          .text-rose-600 { color: #dc2626; }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

/**
 * Render analytics ibadah
 */
window.renderAdminIbadahAnalytics = function () {
  _requireAdmin();
  const classAveragesEl = document.getElementById("ibadah-class-averages");
  const topPerformersEl = document.getElementById("ibadah-top-performers");
  const lowPerformersEl = document.getElementById("ibadah-low-performers");
  const globalTableBody = document.getElementById("ibadah-global-table-body");
  if (!classAveragesEl && !globalTableBody) return;

  const students = typeof MASTER_SANTRI !== "undefined" ? MASTER_SANTRI : [];
  const targetsDb = appState.studentTargets || {};

  const classGroups = {};
  const studentPerformances = [];

  students.forEach(s => {
    const studentId = String(s.nis || s.id || '').trim();
    if (!studentId) return;

    const className = s.kelas || s.rombel || "Lainnya";
    if (!classGroups[className]) {
      classGroups[className] = [];
    }

    const t = targetsDb[studentId] || {
      hafalan: { target: "Juz 30", achieved: 0 },
      tahajjud: { target: 8, achieved: 0 },
      puasa: { target: 4, achieved: 0 },
      tilawah: { target: 30, achieved: 0 }
    };

    const pctTahajjud = Math.min(100, Math.round((t.tahajjud.achieved / (t.tahajjud.target || 8)) * 100));
    const pctPuasa = Math.min(100, Math.round((t.puasa.achieved / (t.puasa.target || 4)) * 100));
    const pctTilawah = Math.min(100, Math.round((t.tilawah.achieved / (t.tilawah.target || 30)) * 100));
    const overallPct = Math.round((pctTahajjud + pctPuasa + pctTilawah) / 3);

    const perfRecord = {
      studentId,
      name: s.nama,
      className,
      tahajjud: t.tahajjud.achieved,
      puasa: t.puasa.achieved,
      tilawah: t.tilawah.achieved,
      overallPct
    };

    classGroups[className].push(perfRecord);
    studentPerformances.push(perfRecord);
  });

  const classAverages = [];
  Object.keys(classGroups).forEach(cName => {
    const list = classGroups[cName];
    const total = list.length;
    if (total === 0) return;

    const avgTahajjud = Math.round(list.reduce((acc, curr) => acc + curr.tahajjud, 0) / total * 10) / 10;
    const avgPuasa = Math.round(list.reduce((acc, curr) => acc + curr.puasa, 0) / total * 10) / 10;
    const avgTilawah = Math.round(list.reduce((acc, curr) => acc + curr.tilawah, 0) / total * 10) / 10;
    const avgOverall = Math.round(list.reduce((acc, curr) => acc + curr.overallPct, 0) / total);

    classAverages.push({
      className: cName,
      avgTahajjud,
      avgPuasa,
      avgTilawah,
      avgOverall
    });
  });

  // Menggunakan globalTableBody yang sudah di-deklarasi di atas
  if (globalTableBody) {
    classAverages.sort((a, b) => b.avgOverall - a.avgOverall);
    if (classAverages.length === 0) {
      globalTableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ada data mutabaah kelas.</td></tr>`;
    } else {
      let htmlContent = "";
      classAverages.forEach((c, idx) => {
        htmlContent += `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
            <td class="p-3 text-center text-slate-400">${idx + 1}</td>
            <td class="p-3 font-black text-slate-800 dark:text-white">Kelas ${window.sanitizeHTML(c.className)}</td>
            <td class="p-3 text-center text-slate-600 dark:text-slate-300 font-mono font-bold">${c.avgTahajjud} <span class="text-[9px] text-slate-400">/ 8</span></td>
            <td class="p-3 text-center text-slate-600 dark:text-slate-300 font-mono font-bold">${c.avgPuasa} <span class="text-[9px] text-slate-400">/ 4</span></td>
            <td class="p-3 text-center text-slate-600 dark:text-slate-300 font-mono font-bold">${c.avgTilawah} <span class="text-[9px] text-slate-400">/ 30</span></td>
            <td class="p-3 text-center">
              <span class="inline-flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 rounded">
                ${c.avgOverall}% Tercapai
              </span>
            </td>
          </tr>
        `;
      });
      globalTableBody.innerHTML = htmlContent;
    }
  }

  classAverages.sort((a, b) => b.avgOverall - a.avgOverall);

  if (classAveragesEl) {
    classAveragesEl.innerHTML = "";
    if (classAverages.length === 0) {
      classAveragesEl.innerHTML = `<p class="text-xs text-slate-400 font-bold p-2 text-center">Tidak ada data kelas.</p>`;
    } else {
      classAverages.forEach(c => {
        classAveragesEl.innerHTML += `
          <div class="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
            <div class="flex justify-between items-center">
              <span class="text-xs font-black text-slate-800 dark:text-white">Kelas ${window.sanitizeHTML(c.className)}</span>
              <span class="text-[10px] font-black px-2 py-0.5 rounded bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">${c.avgOverall}% Tercapai</span>
            </div>
            <div class="grid grid-cols-3 gap-1 text-[9px] font-bold text-slate-500">
              <div class="text-center bg-slate-50 dark:bg-slate-950 p-1 rounded">
                <span class="block text-slate-400">Tahajjud</span>
                <span class="text-slate-700 dark:text-slate-300 font-black">${c.avgTahajjud} / 8</span>
              </div>
              <div class="text-center bg-slate-50 dark:bg-slate-950/50 p-1 rounded">
                <span class="block text-slate-400">Puasa</span>
                <span class="text-slate-700 dark:text-slate-300 font-black">${c.avgPuasa} / 4</span>
              </div>
              <div class="text-center bg-slate-50 dark:bg-slate-950 p-1 rounded">
                <span class="block text-slate-400">Tilawah</span>
                <span class="text-slate-700 dark:text-slate-300 font-black">${c.avgTilawah} / 30</span>
              </div>
            </div>
          </div>
        `;
      });
    }
  }

  studentPerformances.sort((a, b) => b.overallPct - a.overallPct);
  const topPerformers = studentPerformances.slice(0, 5);

  if (topPerformersEl) {
    topPerformersEl.innerHTML = "";
    if (topPerformers.length === 0) {
      topPerformersEl.innerHTML = `<p class="text-xs text-slate-400 font-bold p-2 text-center">Tidak ada data santri.</p>`;
    } else {
      topPerformers.forEach(p => {
        topPerformersEl.innerHTML += `
          <div class="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <h4 class="text-xs font-black text-slate-800 dark:text-white">${window.sanitizeHTML(p.name)}</h4>
              <p class="text-[9px] text-slate-400 font-bold mt-0.5">Kelas ${window.sanitizeHTML(p.className)}</p>
            </div>
            <div class="text-right">
              <span class="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                ${p.overallPct}%
              </span>
            </div>
          </div>
        `;
      });
    }
  }

  studentPerformances.sort((a, b) => a.overallPct - b.overallPct);
  const lowPerformers = studentPerformances.filter(p => p.overallPct < 50).slice(0, 5);

  if (lowPerformersEl) {
    lowPerformersEl.innerHTML = "";
    if (lowPerformers.length === 0) {
      lowPerformersEl.innerHTML = `
        <div class="p-4 text-center border border-dashed border-emerald-100 bg-emerald-50/20 dark:border-emerald-950/30 dark:bg-emerald-950/10 rounded-xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check w-6 h-6 text-emerald-500 mx-auto mb-1"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
          <p class="text-[10px] font-black text-emerald-700 dark:text-emerald-400">Semua Santri Tertib</p>
          <p class="text-[8px] text-slate-400 font-semibold mt-0.5">Tidak ada santri di bawah 50% target.</p>
        </div>
      `;
    } else {
      lowPerformers.forEach(p => {
        lowPerformersEl.innerHTML += `
          <div class="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between">
            <div>
              <h4 class="text-xs font-black text-slate-800 dark:text-white">${window.sanitizeHTML(p.name)}</h4>
              <p class="text-[9px] text-slate-400 font-bold mt-0.5">Kelas ${window.sanitizeHTML(p.className)}</p>
            </div>
            <div class="text-right">
              <span class="inline-flex items-center gap-1 text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded">
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-down"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>
                ${p.overallPct}%
              </span>
            </div>
          </div>
        `;
      });
    }
  }

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Hapus setoran Tahfizh
 * @param {string} id - ID setoran
 */
window.deleteAdminTahfizh = async function (id) {
  _requireAdmin();
  if (!confirm("Apakah Anda yakin ingin menghapus catatan setoran tahfizh ini?")) return;

  try {
    const list = typeof window.getTahfizhSetoran === "function" ? window.getTahfizhSetoran() : [];
    const beforeLength = list.length;
    const filtered = list.filter(r => {
      const generatedId = r.id || `${r.kelas}_${r.santriId || r.nis || 'unknown'}_${r.rowNumber}`;
      return generatedId !== id;
    });

    if (filtered.length === beforeLength) {
      window.showToast?.("Catatan setoran tidak ditemukan!", "error");
      return;
    }

    if (typeof window.saveTahfizhSetoran === "function") {
      window.saveTahfizhSetoran(filtered);
    } else {
      localStorage.setItem('tahfizh_local_setoran', JSON.stringify(filtered));
    }
    window.showToast?.("Setoran tahfizh berhasil dihapus!", "success");
    
    if (window.logActivityAudit) {
      window.logActivityAudit("Hapus Tahfizh", "Admin", "Menghapus catatan setoran tahfizh.");
    }
    
    window.renderAdminTahfizhList();
  } catch (err) {
    window.showToast?.("Gagal menghapus setoran tahfizh", "error");
  }
};

/**
 * Edit setoran Tahfizh
 * @param {string} id - ID setoran
 */
window.editAdminTahfizh = function (id) {
  _requireAdmin();
  try {
    const list = typeof window.getTahfizhSetoran === "function" ? window.getTahfizhSetoran() : [];
    const item = list.find(r => {
      const generatedId = r.id || `${r.kelas}_${r.santriId || r.nis || 'unknown'}_${r.rowNumber}`;
      return generatedId === id;
    });

    if (!item) {
      window.showToast?.("Catatan setoran tidak ditemukan!", "error");
      return;
    }

    document.getElementById("edit-tahfizh-id").value = id;
    document.getElementById("edit-tahfizh-name").value = item.namaSantri || "";
    document.getElementById("edit-tahfizh-program").value = item.program || "Sabaq";
    document.getElementById("edit-tahfizh-jenis").value = item.jenis || "Ziyadah";
    document.getElementById("edit-tahfizh-juz").value = item.juz || "";
    document.getElementById("edit-tahfizh-halaman").value = item.halaman || "";
    document.getElementById("edit-tahfizh-kualitas").value = item.kualitas || "Lancar";
    document.getElementById("edit-tahfizh-surat").value = item.surat || "";

    document.getElementById("modal-edit-tahfizh").classList.remove("hidden");
  } catch (err) {
    console.error("[Edit Tahfizh] Error loading form:", err);
  }
};

/**
 * Handle submit edit Tahfizh
 * @param {Event} e - Submit event
 */
window.handleEditTahfizhSubmit = function (e) {
  _requireAdmin();
  e.preventDefault();

  try {
    const id = document.getElementById("edit-tahfizh-id").value;
    const program = document.getElementById("edit-tahfizh-program").value;
    const jenis = document.getElementById("edit-tahfizh-jenis").value;
    const juz = document.getElementById("edit-tahfizh-juz").value;
    const halaman = document.getElementById("edit-tahfizh-halaman").value.trim();
    const kualitas = document.getElementById("edit-tahfizh-kualitas").value;
    const surat = document.getElementById("edit-tahfizh-surat").value.trim();

    const list = typeof window.getTahfizhSetoran === "function" ? window.getTahfizhSetoran() : [];
    const idx = list.findIndex(r => {
      const generatedId = r.id || `${r.kelas}_${r.santriId || r.nis || 'unknown'}_${r.rowNumber}`;
      return generatedId === id;
    });

    if (idx === -1) {
      window.showToast?.("Catatan setoran tidak ditemukan!", "error");
      return;
    }

    const updatedAt = new Date().toISOString();

    // Immutable update: map to new array with updated item
    const updatedList = list.map((r, i) =>
      i === idx
        ? { ...r, program, jenis, juz, halaman, kualitas, surat, updated_at: updatedAt }
        : r
    );

    if (typeof window.saveTahfizhSetoran === "function") {
      window.saveTahfizhSetoran(updatedList);
    } else {
      localStorage.setItem('tahfizh_local_setoran', JSON.stringify(updatedList));
    }
    window.showToast?.("Koreksi setoran berhasil disimpan!", "success");

    if (window.logActivityAudit) {
      window.logActivityAudit("Koreksi Tahfizh", list[idx].namaSantri, `Mengoreksi setoran Juz ${juz}.`);
    }

    document.getElementById("modal-edit-tahfizh").classList.add("hidden");
    window.renderAdminTahfizhList();
  } catch (err) {
    window.showToast?.("Gagal menyimpan koreksi setoran", "error");
  }
};

// ==========================================
// TASK 9: PLOTTING & AKUN MUSYRIF MANAGEMENT
// ==========================================

/**
 * Tampilkan view manajemen Musyrif
 */
window.showAdminMusyrifView = function () {
  _requireAdmin();
  const view = document.getElementById("view-admin-musyrif");
  if (view) {
    view.classList.remove("hidden");
    const searchInput = document.getElementById("admin-musyrif-search");
    if (searchInput) searchInput.value = "";
    window.adminMusyrifShowAll = false;
    window.renderAdminMusyrifList();
    if (window.lucide) window.lucide.createIcons();
  }
};

/**
 * Tutup view manajemen Musyrif
 */
window.closeAdminMusyrifView = function () {
  _requireAdmin();
  const view = document.getElementById("view-admin-musyrif");
  if (view) view.classList.add("hidden");
};

/**
 * Render daftar Musyrif
 */
window.setAdminMusyrifSearch = function (value) {
  const input = document.getElementById("admin-musyrif-search");
  if (input) {
    input.value = value;
    window.renderAdminMusyrifList();
  }
};

window.renderAdminMusyrifList = function (forceShowAll = false) {
  _requireAdmin();
  if (forceShowAll) {
    window.adminMusyrifShowAll = true;
  }
  const tbody = document.getElementById("admin-musyrif-table-body");
  const mobileList = document.getElementById("admin-musyrif-mobile-list");
  const stepFilter = document.getElementById("admin-musyrif-step-filter");
  const desktopView = document.getElementById("admin-musyrif-desktop-view");
  if (!tbody) return;

  const searchQuery = (document.getElementById("admin-musyrif-search")?.value || "").toLowerCase().trim();

  // Show/Hide search clear button
  const clearBtn = document.getElementById("admin-musyrif-search-clear");
  if (clearBtn) {
    if (searchQuery) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }

  // Read from the classData cache (writable local copy)
  const classDb = window.classData || MASTER_KELAS || {};
  const entries = Object.entries(classDb).filter(([kelas]) =>
    String(kelas).toLowerCase() !== "admin musyrif"
  );

  // If no search query and not show all, render the step filter
  if (!searchQuery && !window.adminMusyrifShowAll) {
    if (stepFilter) stepFilter.classList.remove("hidden");
    if (desktopView) desktopView.classList.add("hidden");
    if (mobileList) mobileList.classList.add("hidden");

    // Generate unique classes dynamically
    const classes = entries.map(([kelas]) => kelas).sort();
    const classRows = classes.map(cls => `
      <button onclick="window.setAdminMusyrifSearch('${cls.replace(/'/g, "\\'")}')" class="w-full flex items-center justify-between p-3.5 border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-violet-500/5 dark:hover:bg-violet-400/5 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 font-black text-xs active:scale-[0.99] transition-all text-left">
        <span class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center text-[10.5px] font-black border border-violet-500/15">#</span>
          Kelas ${cls}
        </span>
        <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400"></i>
      </button>
    `).join("");

    if (stepFilter) {
      stepFilter.innerHTML = `
        <div class="max-w-md mx-auto space-y-6 flex flex-col items-center py-8">
          <div class="w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 animate-pulse">
            <i data-lucide="user-cog" class="w-8 h-8"></i>
          </div>
          <div class="space-y-2 text-center">
            <h3 class="font-black text-slate-800 dark:text-white text-lg">Plotting & Akun Musyrif</h3>
            <p class="text-xs text-slate-400 dark:text-slate-500 max-w-xs mx-auto leading-relaxed">Kelola pemetaan kelas untuk setiap ustadz/musyrif dan tautkan akun login Google mereka dengan mudah.</p>
          </div>

          <div class="w-full space-y-3">
            <span class="block text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center">Pilih Kelas Plotting</span>
            <div class="flex flex-col border border-slate-200/60 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/65 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 shadow-md">
              ${classRows || '<p class="text-xs text-slate-400 font-bold p-4 text-center">Tidak ada data kelas</p>'}
            </div>
          </div>

          <div class="w-full flex items-center gap-3 pt-2">
            <div class="h-[1px] bg-slate-200 dark:bg-slate-800 flex-1"></div>
            <span class="text-[9px] font-extrabold text-slate-400 dark:text-slate-500">ATAU</span>
            <div class="h-[1px] bg-slate-200 dark:bg-slate-800 flex-1"></div>
          </div>

          <button onclick="window.renderAdminMusyrifList(true)" class="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 active:scale-95 text-white text-xs font-black shadow-lg shadow-violet-500/25 transition-all duration-200 flex items-center justify-center gap-2">
            Tampilkan Semua Kelas Plotting
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
    return;
  }

  // Otherwise, show list
  if (stepFilter) stepFilter.classList.add("hidden");
  if (desktopView) desktopView.classList.remove("hidden");
  if (mobileList) mobileList.classList.remove("hidden");

  const filtered = searchQuery
    ? entries.filter(([kelas, info]) =>
        String(kelas).toLowerCase().includes(searchQuery) ||
        String(info.musyrif || "").toLowerCase().includes(searchQuery) ||
        String(info.wali || "").toLowerCase().includes(searchQuery)
      )
    : entries;

  const _safe = (v, fallback = "-") => {
    const text = v === null || v === undefined || v === "" ? fallback : String(v);
    return typeof window.sanitizeHTML === "function" ? window.sanitizeHTML(text) : text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  };

  tbody.innerHTML = "";
  if (mobileList) mobileList.innerHTML = "";

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400 font-bold">${searchQuery ? "Tidak ada kelas ditemukan." : "Tidak ada data kelas."}</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">${searchQuery ? "Tidak ada kelas ditemukan." : "Tidak ada data kelas."}</p>`;
    return;
  }

  filtered.sort(([a], [b]) => String(a).localeCompare(String(b)));

  filtered.forEach(([kelas, info]) => {
    const safeKelas = _safe(kelas);
    const safeMusyrif = _safe(info.musyrif, "Belum diisi");
    const safeEmail = _safe(info.email, "Belum ada email");
    const safeWali = _safe(info.wali, "-");
    const hasEmail = Boolean(info.email);

    const emailBadge = hasEmail
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10.5px] border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${safeEmail}</span>`
      : `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 font-bold text-[10.5px] italic border border-red-500/20"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Belum ada email</span>`;

    // Desktop row
    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors">
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white text-xs">${safeKelas}</div>
        </td>
        <td class="p-3 text-slate-700 dark:text-slate-300 font-bold text-xs">${safeMusyrif}</td>
        <td class="p-3">${emailBadge}</td>
        <td class="p-3 text-slate-500 dark:text-slate-400 font-bold text-xs">${safeWali}</td>
        <td class="p-3 text-center">
          <button onclick="window.editAdminMusyrif('${safeKelas}')" class="w-8 h-8 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:hover:bg-violet-900/30 dark:text-violet-400 flex items-center justify-center border border-violet-150 dark:border-violet-900/40 hover:scale-105 active:scale-95 transition-all mx-auto shadow-sm" title="Edit Musyrif">
            <i data-lucide="edit-2" class="w-3 h-3"></i>
          </button>
        </td>
      </tr>
    `;

    // Mobile card
    if (mobileList) {
      mobileList.innerHTML += `
        <div class="relative bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5 overflow-hidden">
          <div class="absolute left-0 top-0 bottom-0 w-1 ${hasEmail ? 'bg-violet-500' : 'bg-red-400'}"></div>
          <div class="flex justify-between items-start pl-1">
            <div>
              <h3 class="font-black text-slate-800 dark:text-white text-xs">Kelas ${safeKelas}</h3>
              <p class="text-xs font-bold text-slate-500 mt-0.5">${safeMusyrif}</p>
            </div>
            <button onclick="window.editAdminMusyrif('${safeKelas}')" class="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-500 dark:text-violet-400 flex items-center justify-center border border-violet-100 dark:border-violet-900/35 active:scale-95 transition-all" title="Edit">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
          <div class="space-y-1 text-[11px] font-bold pl-1">
            <div class="flex justify-between">
              <span class="text-slate-400">Wali Kelas</span>
              <span class="text-slate-700 dark:text-slate-300">${safeWali}</span>
            </div>
            <div class="flex justify-between gap-2 pt-1 border-t border-slate-50 dark:border-slate-800/80 mt-1">
              <span class="text-slate-400 shrink-0">Email Login</span>
              <span class="${hasEmail ? "text-emerald-600 dark:text-emerald-400 text-right" : "text-red-500 italic"}">${hasEmail ? safeEmail : "Belum ada"}</span>
            </div>
          </div>
        </div>
      `;
    }
  });

  if (window.lucide) window.lucide.createIcons();
};

/**
 * Edit Musyrif
 * @param {string} kelas - Nama kelas
 */
window.editAdminMusyrif = function (kelas) {
  _requireAdmin();
  const classDb = window.classData || MASTER_KELAS || {};
  const info = classDb[kelas];
  if (!info) {
    window.showToast?.("Data kelas tidak ditemukan!", "error");
    return;
  }

  document.getElementById("edit-musyrif-kelas").value = kelas;
  document.getElementById("edit-musyrif-kelas-display").value = kelas;
  document.getElementById("edit-musyrif-nama").value = info.musyrif || "";
  document.getElementById("edit-musyrif-email").value = info.email || "";
  document.getElementById("edit-musyrif-wali").value = info.wali || "";
  document.getElementById("edit-musyrif-subtitle").textContent = `Kelas ${kelas}`;

  document.getElementById("modal-edit-musyrif").classList.remove("hidden");
};

/**
 * Handle submit edit Musyrif
 * @param {Event} e - Submit event
 */
window.handleEditMusyrifSubmit = function (e) {
  _requireAdmin();
  e.preventDefault();
  try {
    const kelas = document.getElementById("edit-musyrif-kelas").value;
    const nama = document.getElementById("edit-musyrif-nama").value.trim();
    const email = document.getElementById("edit-musyrif-email").value.trim();
    const wali = document.getElementById("edit-musyrif-wali").value.trim();

    if (!kelas) {
      window.showToast?.("Data kelas tidak valid!", "error");
      return;
    }

    // Update in-memory classData
    if (window.classData) {
      if (!window.classData[kelas]) window.classData[kelas] = {};
      window.classData[kelas].musyrif = nama;
      window.classData[kelas].email = email;
      window.classData[kelas].wali = wali;
    }

    // Update global MASTER_KELAS reference
    if (typeof MASTER_KELAS !== "undefined") {
      if (!MASTER_KELAS[kelas]) MASTER_KELAS[kelas] = {};
      MASTER_KELAS[kelas].musyrif = nama;
      MASTER_KELAS[kelas].email = email;
      MASTER_KELAS[kelas].wali = wali;
    }

    // Persist to local cache
    try {
      let cached = {};
      try { cached = JSON.parse(localStorage.getItem("cache_data_kelas") || "{}"); } catch { cached = {}; }
      if (!cached[kelas]) cached[kelas] = {};
      cached[kelas].musyrif = nama;
      cached[kelas].email = email;
      cached[kelas].wali = wali;
      localStorage.setItem("cache_data_kelas", JSON.stringify(cached));
    } catch (cacheErr) {
      console.warn("[EditMusyrif] Cache update failed:", cacheErr);
    }

    window.logActivityAudit?.("Edit Musyrif", "Admin", `Memperbarui data Musyrif untuk Kelas ${kelas}.`);
    window.showToast?.("Data Musyrif berhasil diperbarui!", "success");

    document.getElementById("modal-edit-musyrif").classList.add("hidden");
    window.renderAdminMusyrifList();
    
    // Also refresh the Musyrif Leaderboard if visible
    if (window.renderMusyrifLeaderboard) window.renderMusyrifLeaderboard();
  } catch (err) {
    console.error("[EditMusyrif] Submit error:", err);
    window.showToast?.("Gagal menyimpan data Musyrif!", "error");
  }
};

// ==========================================
// TASK 10: GLOBAL DATA HUB (EXPORT & BACKUP)
// ==========================================

function _downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

function _arrayToCSV(rows) {
  return rows.map(row =>
    row.map(cell => {
      const str = String(cell === null || cell === undefined ? "" : cell);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  ).join("\n");
}

/**
 * Export data ke CSV
 * @param {string} type - Tipe: 'presensi', 'tahfizh', 'pelanggaran'
 */
window.exportAdminCSV = async function (type) {
  _requireAdmin();
  try {
    const today = new Date().toISOString().split("T")[0];
    let rows = [];
    let filename = "";

    if (type === "presensi") {
      // Get attendance data
      let attendanceRaw = {};
      try { attendanceRaw = JSON.parse(localStorage.getItem(APP_CONFIG.storageKey) || "{}"); } catch { attendanceRaw = {}; }
      rows.push(["Tanggal", "Kelas", "NIS", "Nama Santri", "Sesi", "Status", "Keterangan"]);

      Object.entries(attendanceRaw).forEach(([dateKey, dateData]) => {
        if (typeof dateData !== "object") return;
        Object.entries(dateData).forEach(([slotKey, slotData]) => {
          if (typeof slotData !== "object") return;
          Object.entries(slotData).forEach(([studentId, statusVal]) => {
            const student = typeof MASTER_SANTRI !== "undefined"
              ? MASTER_SANTRI.find(s => String(s.nis || s.id) === String(studentId))
              : null;
            const nama = student?.nama || studentId;
            const kelas = student?.kelas || student?.rombel || "-";
            const status = typeof statusVal === "object" ? (statusVal.status || "-") : String(statusVal);
            const ket = typeof statusVal === "object" ? (statusVal.keterangan || "") : "";
            rows.push([dateKey, kelas, studentId, nama, slotKey, status, ket]);
          });
        });
      });

      filename = `presensi_export_${today}.csv`;

      const setoranList = typeof window.getTahfizhSetoran === "function" ? window.getTahfizhSetoran() : [];
      rows.push(["Tanggal", "Kelas", "NIS", "Nama Santri", "Program", "Jenis", "Juz", "Surat/Halaman", "Kualitas", "Musyrif"]);

      setoranList.forEach(r => {
        const detail = r.jenis === "Ziyadah"
          ? `Hlm ${r.halaman || "-"}`
          : `Surat ${r.surat || "-"}`;
        rows.push([
          r.tanggal || "-",
          r.kelas || "-",
          r.nis || r.santriId || "-",
          r.namaSantri || "-",
          r.program || "-",
          r.jenis || "-",
          r.juz || "-",
          detail,
          r.kualitas || "-",
          r.musyrif || "-"
        ]);
      });

      filename = `tahfizh_export_${today}.csv`;

    } else if (type === "pelanggaran") {
      const violations = appState.violations || [];
      rows.push(["Tanggal", "NIS", "Nama Santri", "Kelas", "Jenis Pelanggaran", "Poin", "Sesi", "Status Pembinaan"]);

      violations.forEach(v => {
        const student = typeof MASTER_SANTRI !== "undefined"
          ? MASTER_SANTRI.find(s => String(s.nis || s.id) === String(v.studentId))
          : null;
        const nama = student?.nama || v.studentId || "-";
        const kelas = student?.kelas || student?.rombel || "-";
        rows.push([
          v.date || "-",
          v.studentId || "-",
          nama,
          kelas,
          v.label || "-",
          v.points || 0,
          v.slotLabel || "-",
          v.isCoached ? "Sudah Dibina" : "Belum Dibina"
        ]);
      });

      filename = `pelanggaran_export_${today}.csv`;
    }

    if (rows.length <= 1) {
      window.showToast?.("Tidak ada data untuk diekspor.", "warning");
      return;
    }

    const csv = "\uFEFF" + _arrayToCSV(rows); // BOM for Excel UTF-8
    _downloadFile(filename, csv, "text/csv;charset=utf-8;");
    window.showToast?.(`Berhasil mengekspor ${rows.length - 1} baris data!`, "success");
    window.logActivityAudit?.("Export CSV", "Admin", `Mengekspor data ${type} ke CSV.`);

  } catch (err) {
    console.error("[ExportCSV] Error:", err);
    window.showToast?.("Gagal mengekspor data!", "error");
  }
};

/**
 * Backup semua data ke JSON
 */
window.adminBackupJSON = async function () {
  _requireAdmin();
  try {
    if (!window.supabaseClient) throw new Error('Cloud database tidak tersedia');
    const tables = ['attendances', 'permits', 'tahfizh', 'settings', 'musyrif_journals', 'app_records'];
    const entries = await Promise.all(tables.map(async table => {
      const { data, error } = await window.supabaseClient.from(table).select('*');
      if (error) throw error;
      return [table, data || []];
    }));

    const backup = {
      _meta: {
        created_at: new Date().toISOString(),
        version: "syamsa_cloud_backup_v2",
        app: "Musyrif App",
        source: "supabase"
      },
      tables: Object.fromEntries(entries),
    };

    const today = new Date().toISOString().split("T")[0];
    const filename = `syamsa_backup_${today}.json`;
    _downloadFile(filename, JSON.stringify(backup, null, 2), "application/json");
    window.showToast?.("✅ Super Backup berhasil diunduh!", "success");
    window.logActivityAudit?.("Super Backup", "Admin", "Membuat backup JSON seluruh data aplikasi.");

  } catch (err) {
    console.error("[Backup] Error:", err);
    window.showToast?.("Gagal membuat backup!", "error");
  }
};

/**
 * Restore data dari JSON backup
 * @param {Event} event - File input change event
 */
window.adminRestoreJSON = function (event) {
  _requireAdmin();
  const file = event.target.files?.[0];
  if (!file) return;

  // File size validation: max 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_FILE_SIZE) {
    window.showToast?.(`File terlalu besar! Maksimal 10MB. Ukuran file: ${(file.size / (1024 * 1024)).toFixed(2)}MB`, "error");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data._meta || data._meta.version !== "syamsa_cloud_backup_v2" || !data.tables) {
        window.showToast?.("File backup tidak valid atau versi tidak cocok!", "error");
        return;
      }

      const confirmed = confirm(
        true ? `Restore Cloud Backup\n\nIni akan menimpa data cloud sesuai hak akses Anda dengan backup dari:\n${data._meta.created_at}\n\nLanjutkan?` :
        `⚠️ Restore Backup\n\nIni akan menimpa data lokal Anda dengan backup dari:\n${data._meta.created_at}\n\nLanjutkan?`
      );
      if (!confirmed) return;

      let restoredCount = 0;
      const allowedTables = new Set(['attendances', 'permits', 'tahfizh', 'settings', 'musyrif_journals', 'app_records']);
      for (const [table, records] of Object.entries(data.tables)) {
        if (!allowedTables.has(table) || !Array.isArray(records)) continue;
        for (const record of records) {
          if (!record?.id) continue;
          const { data: current, error: readError } = await window.supabaseClient
            .from(table)
            .select('_version')
            .eq('id', record.id)
            .maybeSingle();
          if (readError) throw readError;
          await window.supabaseSync._writeCloudRecord(table, record, Number(current?._version || 0));
          restoredCount++;
        }
      }

      window.logActivityAudit?.("Restore Backup", "Admin", `Memulihkan ${restoredCount} kunci data dari backup.`);
      window.showToast?.(`✅ Restore berhasil! ${restoredCount} data dipulihkan. Halaman akan dimuat ulang.`, "success");

      await window.manualSync?.();
      setTimeout(() => location.reload(), 2500);
    } catch (parseErr) {
      console.error("[Restore] Parse error:", parseErr);
      window.showToast?.("File backup tidak valid atau rusak!", "error");
    }
  };

  reader.onerror = () => window.showToast?.("Gagal membaca file!", "error");
  reader.readAsText(file);

  // Reset file input so user can re-upload same file
  event.target.value = "";
};
