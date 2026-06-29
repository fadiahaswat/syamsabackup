// File: admin-manager.js
// Manager khusus untuk mengelola fitur-fitur administratif (Role Admin)
// Terinspirasi dari fungsi Operations, Communications, dan HR Admin Connecteam.
// Mode localStorage only

/**
 * Escape HTML entities untuk mencegah XSS
 * @param {string} str - String yang akan di-escape
 * @returns {string} - String yang sudah di-escape
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
 */
window.loadGlobalAttendance = async function () {
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

    // Ambil data dari localStorage untuk setiap kelas
    const slots = ['shubuh', 'sekolah', 'ashar', 'maghrib', 'isya'];
    const dateKey = appState.date || new Date().toISOString().split('T')[0];

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

    return { data: rekap, error: null };
  } catch (error) {
    return { data: null, error };
  }
};

/**
 * 2. PERIZINAN: Memuat riwayat izin dari semua kelas
 * Menggunakan localStorage sebagai sumber data
 */
window.loadGlobalPermits = async function () {
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
 */
window.loadGlobalTahfizh = async function () {
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
 * 4. HR & WALI: Reset password kustom Wali agar kembali ke default (NIS)
 * Menggunakan localStorage
 */
window.resetWaliPassword = async function (nis) {
  try {
    // Hapus dari local storage password wali
    const passwordKey = 'wali_passwords_db';
    const saved = localStorage.getItem(passwordKey);
    let passwords = saved ? JSON.parse(saved) : {};

    delete passwords[nis];
    localStorage.setItem(passwordKey, JSON.stringify(passwords));

    // Catat ke audit log
    if (window.logActivityAudit) {
      window.logActivityAudit('Reset Password', `Wali ${nis}`, 'Mereset password Wali Santri kembali ke default (NIS)');
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

/**
 * 6. HR & WALI: Ubah/Setel password Wali Santri
 * Menggunakan localStorage
 */
window.changeWaliPassword = async function (nis, newPassword) {
  try {
    const hash = await window.sha256Hex(newPassword);

    // Simpan ke localStorage
    const passwordKey = 'wali_passwords_db';
    const saved = localStorage.getItem(passwordKey);
    let passwords = saved ? JSON.parse(saved) : {};

    passwords[nis] = {
      nis: nis,
      password_hash: hash,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem(passwordKey, JSON.stringify(passwords));

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
};

/**
 * 7. COMMUNICATIONS: Membuat pengumuman broadcast baru
 * Menggunakan localStorage
 */
window.createAnnouncement = async function (title, content, target = "musyrif") {
  try {
    const announcementKey = 'local_announcements';
    const saved = localStorage.getItem(announcementKey);
    let announcements = saved ? JSON.parse(saved) : [];

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
 */
window.loadAnnouncements = async function () {
  try {
    const announcementKey = 'local_announcements';
    const saved = localStorage.getItem(announcementKey);
    let announcements = saved ? JSON.parse(saved) : [];

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
 */
window.loadGlobalActivityLogs = async function () {
  try {
    const logsKey = 'local_activity_logs';
    const saved = localStorage.getItem(logsKey);
    let logs = saved ? JSON.parse(saved) : [];

    // Urutkan dari terbaru dan ambil 100
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { data: logs.slice(0, 100), error: null };
  } catch (error) {
    return { data: [], error };
  }
};

// ============================================================
// ADMIN DASHBOARD RENDERING & EVENT CONTROLLERS
// ============================================================

window.switchAdminSubTab = function (subTabName) {
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

window.renderAdminOpsMatrix = async function () {
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

  const kelasKeys = Object.keys(MASTER_KELAS).filter(k => k?.toLowerCase() !== "admin musyrif");

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
      const colorClass = isFilled ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500 shadow-red-500/20";
      const icon = isFilled ? "check" : "x";
      const title = isFilled ? "Sudah Diisi" : "Belum Diisi";

      return `
        <td class="p-3 text-center">
          <button onclick="window.overrideAttendance('${safeClassName}', '${slotId}')" title="Override ${safeClassName} - ${slotId} (${title})" class="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] ${colorClass} shadow-sm active:scale-95 transition-all">
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
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white">${safeClassName}</div>
          <div class="text-[10px] text-slate-400 font-bold">${musyrifName}</div>
        </td>
        ${slotCells}
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <a href="${waLink}" target="_blank" class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/35 hover:scale-105 active:scale-95 transition-all" title="WhatsApp Musyrif">
              <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
            </a>
            <a href="${phoneLink}" class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/35 hover:scale-105 active:scale-95 transition-all" title="Call Musyrif">
              <i data-lucide="phone" class="w-3.5 h-3.5"></i>
            </a>
          </div>
        </td>
      </tr>
    `;

    // Populate mobile cards view
    if (mobileList) {
      const mobileSlotsHTML = slots.map(slotId => {
        const isFilled = rowRekap[slotId];
        const colorClass = isFilled ? "bg-emerald-500 text-white" : "bg-red-500 text-white";
        const label = slotLabels[slotId];
        return `
          <div class="flex flex-col items-center gap-1">
            <span class="text-[8px] font-black text-slate-400 uppercase">${label}</span>
            <button onclick="window.overrideAttendance('${safeClassName}', '${slotId}')" class="w-full py-1.5 rounded-xl text-[9px] font-black ${colorClass} shadow-sm active:scale-95 transition-all">
              ${isFilled ? 'Diisi' : 'Belum'}
            </button>
          </div>
        `;
      }).join("");

      mobileList.innerHTML += `
        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div class="flex justify-between items-start">
            <div>
              <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeClassName}</h3>
              <p class="text-[9px] text-slate-400 font-bold">${musyrifName}</p>
            </div>
            <div class="flex gap-1.5">
              <a href="${waLink}" target="_blank" class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/35 active:scale-95 transition-all" title="WhatsApp Musyrif">
                <i data-lucide="message-square" class="w-4 h-4"></i>
              </a>
              <a href="${phoneLink}" class="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/35 active:scale-95 transition-all" title="Call Musyrif">
                <i data-lucide="phone" class="w-4 h-4"></i>
              </a>
            </div>
          </div>
          <div class="h-px bg-slate-50 dark:bg-slate-800/60"></div>
          <div class="grid grid-cols-3 gap-2">
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

window.overrideAttendance = function (className, slotId) {
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

window.renderAdminHRList = async function () {
  const tbody = document.getElementById("admin-hr-table-body");
  const mobileList = document.getElementById("admin-hr-mobile-list");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Memuat data...</td></tr>`;
  if (mobileList) mobileList.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Memuat data...</p>`;

  try {
    // Ambil daftar NIS dengan password kustom dari localStorage
    const passwordKey = 'wali_passwords_db';
    const saved = localStorage.getItem(passwordKey);
    const customPasswords = saved ? JSON.parse(saved) : {};
    const customNisSet = new Set(Object.keys(customPasswords));

    const searchQuery = (document.getElementById("admin-hr-search")?.value || "").toLowerCase().trim();

    tbody.innerHTML = "";
    if (mobileList) mobileList.innerHTML = "";

    let filtered = MASTER_SANTRI || [];
    if (searchQuery) {
      filtered = (MASTER_SANTRI || []).filter(s =>
        (s.nama && s.nama.toLowerCase().includes(searchQuery)) ||
        (s.nis && String(s.nis).includes(searchQuery)) ||
        (s.wali && s.wali.toLowerCase().includes(searchQuery))
      );
    }

    if (filtered.length === 0) {
      const emptyIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="11" y2="11"/></svg>`;
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center"><div class="flex flex-col items-center gap-3">${emptyIcon}<p class="text-xs text-slate-400 font-bold">Tidak ada santri ditemukan</p></div></td></tr>`;
      if (mobileList) mobileList.innerHTML = `<div class="flex flex-col items-center gap-3 p-6"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-300 dark:text-slate-600"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="11" y2="11"/></svg><p class="text-xs text-slate-400 font-bold text-center">Tidak ada santri ditemukan</p></div>`;
      return;
    }

    filtered.slice(0, 100).forEach(s => {
      const nisStr = String(s.nis || s.id || '').trim();
      const safeNisStr = _escapeHtml(nisStr);
      const safeName = _escapeHtml(s.nama || s.name || '-');
      const safeKelas = _escapeHtml(s.kelas || s.rombel || "-");
      const safeWali = _escapeHtml(s.wali || "-");
      const hasCustom = customNisSet.has(nisStr);
      const statusBadge = hasCustom
        ? `<span class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black">Kustom</span>`
        : `<span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-black">Default (NIS)</span>`;

      const resetBtn = hasCustom
        ? `<button onclick="window.handleResetPasswordClick('${safeNisStr.replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:text-red-400 text-[10px] font-black active:scale-[0.98] transition-all">Reset Password</button>`
        : `<button disabled class="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 text-[10px] font-black cursor-not-allowed">Reset Password</button>`;

      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
          <td class="p-3">
            <div class="font-black text-slate-800 dark:text-white">${safeName}</div>
          </td>
          <td class="p-3 text-slate-600 dark:text-slate-300">${safeKelas}</td>
          <td class="p-3 text-slate-500 font-mono">${safeNisStr || '-'}</td>
          <td class="p-3 text-slate-600 dark:text-slate-300">${safeWali}</td>
          <td class="p-3">${statusBadge}</td>
          <td class="p-3 text-center">${resetBtn}</td>
        </tr>
      `;

      if (mobileList) {
        mobileList.innerHTML += `
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeName}</h3>
                <p class="text-[9px] text-slate-400 font-mono mt-0.5">NIS: ${safeNisStr || '-'}</p>
              </div>
              <div>
                ${statusBadge}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500">
              <div>
                <span class="block text-[8px] text-slate-400 uppercase">Kelas</span>
                <span class="text-slate-700 dark:text-slate-300">${safeKelas}</span>
              </div>
              <div>
                <span class="block text-[8px] text-slate-400 uppercase">Wali Santri</span>
                <span class="text-slate-700 dark:text-slate-300">${safeWali}</span>
              </div>
            </div>
            <div class="pt-2 flex justify-end border-t border-slate-50 dark:border-slate-800/80">
              ${resetBtn}
            </div>
          </div>
        `;
      }
    });

    if (filtered.length > 100) {
      const moreText = `Menampilkan 100 dari ${filtered.length} santri. Silakan gunakan pencarian untuk memfilter lebih spesifik.`;
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

window.handleResetPasswordClick = async function (nis) {
  if (confirm(`Apakah Anda yakin ingin mereset password Wali dengan NIS ${nis}? Password akan kembali menggunakan default (NIS).`)) {
    const { success, error } = await window.resetWaliPassword(nis);
    if (success) {
      window.showToast(`Password Wali ${nis} berhasil direset ke default.`, "success");
      window.renderAdminHRList();
    } else {
      window.showToast(`Gagal reset password: ${error?.message || error}`, "error");
    }
  }
};

window.renderAdminTahfizhList = async function () {
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

  filtered.slice(0, 100).forEach(r => {
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

  if (filtered.length > 100) {
    const moreText = `Menampilkan 100 dari ${filtered.length} setoran. Silakan gunakan pencarian untuk lebih spesifik.`;
    tbody.innerHTML += `<tr><td colspan="8" class="p-3 text-center text-slate-400 font-bold text-[10px]">${moreText}</td></tr>`;
    if (mobileList) {
      mobileList.innerHTML += `<p class="text-xs text-slate-400 font-bold p-3 text-center">${moreText}</p>`;
    }
  }
};



window.renderAdminPermits = async function () {
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
                <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black active:scale-[0.98] transition-all">Setujui</button>
                <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-black active:scale-[0.98] transition-all">Tolak</button>
              </div>
            </td>
          </tr>
        `;

        if (mobileListDashboard) {
          mobileListDashboard.innerHTML += `
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
              <div class="flex justify-between items-start">
                <div>
                  <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeStudentName}</h3>
                  <p class="text-[9px] text-slate-400 font-mono mt-0.5">${safeClassName} • NIS: ${safeNis}</p>
                </div>
                <span class="px-2 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-500">Pending</span>
              </div>
              <div class="text-[11px] text-slate-600 dark:text-slate-400 font-bold leading-relaxed">
                <p><span class="text-slate-400">Tipe:</span> ${safeType}</p>
                <p><span class="text-slate-400">Waktu:</span> ${safeStartDate} s/d ${safeEndDate}</p>
                <p class="mt-1"><span class="text-slate-400">Keperluan:</span> "${safeReason}"</p>
              </div>
              <div class="flex gap-2 w-full mt-2">
                <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="flex-1 py-2 rounded-xl bg-emerald-500 text-white font-black text-xs active:scale-[0.98] transition-all text-center">Setujui</button>
                <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="flex-1 py-2 rounded-xl bg-red-500 text-white font-black text-xs active:scale-[0.98] transition-all text-center">Tolak</button>
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

    if (filtered.length === 0) {
      tbodyReport.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Tidak ada riwayat perizinan ditemukan.</td></tr>`;
      if (mobileListReport) mobileListReport.innerHTML = `<p class="text-xs text-slate-400 font-bold p-4 text-center">Tidak ada riwayat perizinan ditemukan.</p>`;
      return;
    }

    filtered.slice(0, 100).forEach(p => {
      const statusLower = String(p.status || "approved").toLowerCase();
      const isActive = p.is_active !== false;

      let displayStatus = "Disetujui";
      let statusClass = "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400";

      if (statusLower === "pending") {
        displayStatus = "Diajukan";
        statusClass = "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400";
      } else if (statusLower === "rejected") {
        displayStatus = "Ditolak";
        statusClass = "bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400";
      } else if (!isActive) {
        displayStatus = "Kembali";
        statusClass = "bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400";
      }

      const safePermitId = String(p.id || p.nis || '').replace(/[`$\\]/g, '\\$&');
      
      let actions = `<span class="text-slate-400 text-[10px]">-</span>`;
      let mobileActions = "";

      if (statusLower === "pending") {
        actions = `
          <div class="flex items-center justify-center gap-1">
            <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black active:scale-[0.98] transition-all">Setujui</button>
            <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-[10px] font-black active:scale-[0.98] transition-all">Tolak</button>
          </div>
        `;
        mobileActions = `
          <div class="flex gap-2 w-full mt-2">
            <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black active:scale-[0.98] transition-all text-center">Setujui</button>
            <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="flex-1 py-2 rounded-xl bg-red-500 text-white text-[10px] font-black active:scale-[0.98] transition-all text-center">Tolak</button>
          </div>
        `;
      } else if (statusLower === "approved" && isActive) {
        actions = `
          <button onclick="window.forceReturnPermit('${safePermitId}')" class="px-2.5 py-1 rounded-lg bg-orange-100 border border-orange-200 hover:bg-orange-200 text-orange-700 dark:bg-orange-950/40 dark:border-orange-900/35 dark:text-orange-400 text-[10px] font-black active:scale-95 transition-all">
            Paksa Kembali
          </button>
        `;
        mobileActions = `
          <button onclick="window.forceReturnPermit('${safePermitId}')" class="w-full mt-2 py-2 rounded-xl bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-black active:scale-95 transition-all text-center">
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

      tbodyReport.innerHTML += `
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
            <span class="px-2 py-0.5 rounded text-[10px] font-black ${statusClass}">${displayStatus}</span>
          </td>
          <td class="p-3 text-center">${actions}</td>
        </tr>
      `;

      if (mobileListReport) {
        mobileListReport.innerHTML += `
          <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-black text-slate-800 dark:text-white text-xs">${safeStudentName}</h3>
                <p class="text-[9px] text-slate-400 font-mono mt-0.5">NIS: ${safeNis} (${safeClassName})</p>
              </div>
              <div>
                <span class="px-2 py-0.5 rounded text-[9px] font-black ${statusClass}">${displayStatus}</span>
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

    if (filtered.length > 100) {
      const moreText = `Menampilkan 100 dari ${filtered.length} perizinan. Silakan gunakan pencarian atau filter status untuk lebih spesifik.`;
      tbodyReport.innerHTML += `<tr><td colspan="7" class="p-3 text-center text-slate-400 font-bold text-[10px]">${moreText}</td></tr>`;
      if (mobileListReport) {
        mobileListReport.innerHTML += `<p class="text-xs text-slate-400 font-bold p-3 text-center">${moreText}</p>`;
      }
    }
  }

  if (window.lucide) window.lucide.createIcons();
};

window.forceReturnPermit = async function (permitId) {
  if (!confirm("Apakah Anda yakin ingin mematikan izin ini dan memaksa status santri kembali ke pondok?")) return;

  try {
    const permitKey = 'musyrif_permits_db';
    const saved = localStorage.getItem(permitKey);
    let permits = saved ? JSON.parse(saved) : [];

    const permitIdx = permits.findIndex(p => String(p.id || p.nis) === String(permitId));
    if (permitIdx === -1) {
      window.showToast?.("Izin tidak ditemukan!", "error");
      return;
    }

    // Update permit status to returned (is_active = false)
    permits[permitIdx].is_active = false;
    permits[permitIdx].tanggal_kembali = new Date().toISOString().split('T')[0] + " " + new Date().toTimeString().split(' ')[0];
    
    localStorage.setItem(permitKey, JSON.stringify(permits));

    // Update in appState if present
    if (appState.permits) {
      const appStateIdx = appState.permits.findIndex(p => String(p.id || p.nis) === String(permitId));
      if (appStateIdx !== -1) {
        appState.permits[appStateIdx].is_active = false;
        appState.permits[appStateIdx].tanggal_kembali = permits[permitIdx].tanggal_kembali;
      }
    }

    const permit = permits[permitIdx];
    const studentName = permit.studentName || "Santri";
    
    window.logActivityAudit("Force Return", studentName, `Memaksa kembali santri dari izin ${permit.tipe_izin || 'Izin'}.`);
    window.showToast?.(`Status ${studentName} direset ke Pondok!`, "success");

    // Re-render
    window.renderAdminPermits();
  } catch (err) {
    window.showToast("Gagal melakukan force return", "error");
  }
};

  if (filtered.length > 100) {
    const moreText = `Menampilkan 100 dari ${filtered.length} perizinan. Silakan gunakan pencarian atau filter status untuk lebih spesifik.`;
    tbody.innerHTML += `<tr><td colspan="7" class="p-3 text-center text-slate-400 font-bold text-[10px]">${moreText}</td></tr>`;
    if (mobileList) {
      mobileList.innerHTML += `<p class="text-xs text-slate-400 font-bold p-3 text-center">${moreText}</p>`;
    }
  }

  if (window.lucide) window.lucide.createIcons();
  
  if (window.renderAdminSPHub) window.renderAdminSPHub();
};

window.approveOrRejectPermit = async function (permitId, approved) {
  const statusStr = approved ? "approved" : "rejected";
  const actionText = approved ? "menyetujui" : "menolak";
  const displayStatusStr = approved ? "Disetujui" : "Ditolak";

  if (confirm(`Apakah Anda yakin ingin ${actionText} permohonan izin ini?`)) {
    try {
      // Update di localStorage
      const permitKey = 'musyrif_permits_db';
      const saved = localStorage.getItem(permitKey);
      let permits = saved ? JSON.parse(saved) : [];

      const permitIndex = permits.findIndex(p => (p.id || p.nis) === permitId);
      if (permitIndex !== -1) {
        permits[permitIndex].status = statusStr;
        permits[permitIndex].approved_by = appState.userProfile?.name || 'Admin';
        permits[permitIndex].updated_at = new Date().toISOString();
        localStorage.setItem(permitKey, JSON.stringify(permits));

        // Update appState jika ada
        if (appState.permits) {
          const appStateIndex = appState.permits.findIndex(p => (p.id || p.nis) === permitId);
          if (appStateIndex !== -1) {
            appState.permits[appStateIndex].status = statusStr;
            appState.permits[appStateIndex].approved_by = appState.userProfile?.name || 'Admin';
            appState.permits[appStateIndex].updated_at = new Date().toISOString();
          }
        }
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




window.handleAdminBroadcastSubmit = async function (e) {
  e.preventDefault();

  const titleInput = document.getElementById("admin-broadcast-title");
  const contentInput = document.getElementById("admin-broadcast-content");
  const targetInput = document.getElementById("admin-broadcast-target");
  if (!titleInput || !contentInput) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const target = targetInput ? targetInput.value : "musyrif";

  if (!title || !content) return;

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

window.renderRecentBroadcasts = async function () {
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


window.renderAdminLogs = async function () {
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
    let logs = saved ? JSON.parse(saved) : [];

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

window.renderAdminGPSConfig = function () {
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

window.saveAdminGPSConfig = function () {
  const toggle = document.getElementById("admin-gps-geofencing-toggle");
  const radiusInput = document.getElementById("admin-gps-radius-input");

  if (!toggle || !radiusInput) return;

  const isChecked = toggle.checked;
  const radius = parseInt(radiusInput.value) || 50;

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

window.addAdminGPSLocation = function () {
  const nameEl = document.getElementById("admin-gps-new-name");
  const latEl = document.getElementById("admin-gps-new-lat");
  const lngEl = document.getElementById("admin-gps-new-lng");

  if (!nameEl || !latEl || !lngEl) return;

  const name = nameEl.value.trim();
  const lat = parseFloat(latEl.value);
  const lng = parseFloat(lngEl.value);

  if (!name || isNaN(lat) || isNaN(lng)) {
    window.showToast?.("Semua field lokasi baru wajib diisi secara valid!", "warning");
    return;
  }

  // Add to locations array
  if (!GEO_CONFIG.locations) GEO_CONFIG.locations = [];
  GEO_CONFIG.locations.push({ name, lat, lng });

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

window.deleteAdminGPSLocation = function (idx) {
  if (!GEO_CONFIG.locations || idx < 0 || idx >= GEO_CONFIG.locations.length) return;

  const deleted = GEO_CONFIG.locations[idx];
  GEO_CONFIG.locations.splice(idx, 1);

  // Save config
  window.saveAdminGPSConfig();

  // Re-render
  window.renderAdminGPSConfig();
  window.showToast?.(`Lokasi ${deleted.name} dihapus!`, "info");
};

// ==========================================
// LEADERBOARD KEPATUHAN MUSYRIF (STREAK HARIAN)
// ==========================================

window.calculateMusyrifStreaks = function () {
  const result = [];
  const slots = ['shubuh', 'sekolah', 'ashar', 'maghrib', 'isya'];
  const todayStr = window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().split('T')[0];

  // Helper to subtract days
  const subtractDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  Object.keys(MASTER_KELAS).forEach(className => {
    if (className.toLowerCase() === 'admin musyrif') return;

    const classInfo = MASTER_KELAS[className];
    const storageKey = `musyrif_attendance_${className.replace(/\s+/g, '_')}`;
    const savedData = localStorage.getItem(storageKey);
    
    let totalSlotsFilled = 0;
    let filledDatesSet = new Set();

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

    // Compute current streak
    let currentStreak = 0;
    
    // If today is not filled, check yesterday. If yesterday is also not filled, streak is 0
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
  });

  // Sort by streak desc, then by compliance desc, then by totalSlots desc
  result.sort((a, b) => b.streak - a.streak || b.compliance - a.compliance || b.totalSlots - a.totalSlots);
  return result;
};

window.renderMusyrifLeaderboard = function () {
  const tbody = document.getElementById("admin-musyrif-streak-body");
  if (!tbody) return;

  const data = window.calculateMusyrifStreaks();

  tbody.innerHTML = "";
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">Tidak ada data kepatuhan Musyrif.</td></tr>`;
    return;
  }

  data.forEach((row, index) => {
    const rank = index + 1;
    const badgeColor = rank === 1 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                       rank === 2 ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" :
                       rank === 3 ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" :
                       "bg-slate-50 text-slate-500 dark:bg-slate-900/50";
                       
    const streakDisplay = row.streak > 0 ? `🔥 <span class="text-amber-500">${row.streak} Hari</span>` : `<span class="text-slate-400">-</span>`;
    
    // Compliance progress bar color
    const progressColor = row.compliance >= 80 ? "bg-emerald-500" :
                          row.compliance >= 50 ? "bg-amber-500" :
                          "bg-rose-500";

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3 text-center">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${badgeColor}">${rank}</span>
        </td>
        <td class="p-3 text-slate-900 dark:text-white font-black">${_escapeHtml(row.musyrif)}</td>
        <td class="p-3 text-slate-500 dark:text-slate-400 font-bold">${_escapeHtml(row.className)}</td>
        <td class="p-3 text-center font-black text-xs">${streakDisplay}</td>
        <td class="p-3 text-center font-bold text-slate-600 dark:text-slate-300">${row.totalSlots} Sesi</td>
        <td class="p-3">
          <div class="flex items-center gap-2">
            <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
              <div class="${progressColor} h-2 rounded-full" style="width: ${row.compliance}%"></div>
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

window.getViolationRules = function () {
  try {
    const saved = localStorage.getItem("syamsa_violation_rules");
    return saved ? JSON.parse(saved) : DEFAULT_VIOLATION_RULES;
  } catch (e) {
    return DEFAULT_VIOLATION_RULES;
  }
};

window.renderAdminViolationRules = function () {
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

window.saveAdminViolationRules = function () {
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

window.renderViolationLeaderboard = function () {
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
    const badgeColor = rank === 1 ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
                       rank === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400" :
                       rank === 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                       "bg-slate-50 text-slate-500 dark:bg-slate-900/50";
                       
    // Status text based on points severity
    const statusText = row.points >= 100 ? "SP3 (Skorsing/Dikeluarkan)" :
                       row.points >= 75 ? "SP2 (Peringatan Keras)" :
                       row.points >= 50 ? "SP1 (Pembinaan Intensif)" :
                       row.points >= 25 ? "Peringatan Ringan" :
                       "Teguran Lisan";

    const statusColor = row.points >= 100 ? "text-red-600 dark:text-red-400" :
                        row.points >= 50 ? "text-orange-500 dark:text-orange-400" :
                        "text-slate-500 dark:text-slate-400";

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors text-[11px] font-bold">
        <td class="p-3 text-center">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${badgeColor}">${rank}</span>
        </td>
        <td class="p-3 text-slate-900 dark:text-white font-black">${_escapeHtml(row.name)}</td>
        <td class="p-3 text-slate-500 dark:text-slate-400 font-bold">${_escapeHtml(row.className)}</td>
        <td class="p-3 text-center font-black text-xs text-red-600 dark:text-red-400">${row.points} Poin</td>
        <td class="p-3 text-center font-bold text-[10px] ${statusColor}">${statusText}</td>
        <td class="p-3 text-center">
          <button type="button" onclick="window.recordCoachingDirect('${row.studentId}', '${_escapeHtml(row.name)}')" class="py-1 px-2.5 rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] font-black active:scale-95 transition-all">
            Bina Santri
          </button>
        </td>
      </tr>
    `;
  });
};

window.renderAdminViolationsList = function () {
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

window.deleteAdminViolation = function (id) {
  if (!appState.violations || appState.violations.length === 0) return;

  const targetIdx = appState.violations.findIndex(v => String(v.id) === String(id));
  if (targetIdx === -1) return;

  const deleted = appState.violations[targetIdx];
  const student = (typeof MASTER_SANTRI !== "undefined") ? MASTER_SANTRI.find(s => String(s.nis || s.id) === String(deleted.studentId)) : null;
  const name = student ? student.nama : `Santri ID: ${deleted.studentId}`;

  appState.violations.splice(targetIdx, 1);
  localStorage.setItem("musyrif_violations_db", JSON.stringify(appState.violations));

  window.logActivityAudit("Hapus Pelanggaran", name, `Menghapus catatan pelanggaran ${deleted.type} (${deleted.points} Poin).`);
  window.showToast?.("Log pelanggaran berhasil dihapus!", "info");

  // Re-render lists
  window.renderViolationLeaderboard();
  window.renderAdminViolationsList();
};

window.recordCoachingDirect = function (studentId, name) {
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

window.generateSPDrafts = function () {
  try {
    const spKey = "musyrif_sp_docs";
    const saved = localStorage.getItem(spKey);
    let spDocs = saved ? JSON.parse(saved) : [];

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

window.renderAdminSPHub = function () {
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

window.approveOrRejectSP = async function (spId, approved) {
  const actionText = approved ? "menyetujui penerbitan" : "menolak/menahan";
  const displayStatus = approved ? "approved" : "rejected";

  if (!confirm(`Apakah Anda yakin ingin ${actionText} dokumen Surat Peringatan ini?`)) return;

  try {
    const spKey = "musyrif_sp_docs";
    const saved = localStorage.getItem(spKey);
    let spDocs = saved ? JSON.parse(saved) : [];

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

window.openSPModal = function (spDocId) {
  try {
    const spKey = "musyrif_sp_docs";
    const saved = localStorage.getItem(spKey);
    const spDocs = saved ? JSON.parse(saved) : [];
    
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

window.renderAdminIbadahAnalytics = function () {
  const classAveragesEl = document.getElementById("ibadah-class-averages");
  const topPerformersEl = document.getElementById("ibadah-top-performers");
  const lowPerformersEl = document.getElementById("ibadah-low-performers");
  if (!classAveragesEl) return;

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

  classAverages.sort((a, b) => b.avgOverall - a.avgOverall);

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

  studentPerformances.sort((a, b) => b.overallPct - a.overallPct);
  const topPerformers = studentPerformances.slice(0, 5);

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

  studentPerformances.sort((a, b) => a.overallPct - b.overallPct);
  const lowPerformers = studentPerformances.filter(p => p.overallPct < 50).slice(0, 5);

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

  if (window.lucide) window.lucide.createIcons();
};

window.deleteAdminTahfizh = async function (id) {
  if (!confirm("Apakah Anda yakin ingin menghapus catatan setoran tahfizh ini?")) return;

  try {
    const saved = localStorage.getItem('tahfizh_local_setoran');
    let list = saved ? JSON.parse(saved) : [];

    const beforeLength = list.length;
    const filtered = list.filter(r => {
      const generatedId = `${r.kelas}_${r.santriId || r.nis || 'unknown'}_${r.rowNumber}`;
      return generatedId !== id;
    });

    if (filtered.length === beforeLength) {
      window.showToast?.("Catatan setoran tidak ditemukan!", "error");
      return;
    }

    localStorage.setItem('tahfizh_local_setoran', JSON.stringify(filtered));
    window.showToast?.("Setoran tahfizh berhasil dihapus!", "success");
    
    if (window.logActivityAudit) {
      window.logActivityAudit("Hapus Tahfizh", "Admin", "Menghapus catatan setoran tahfizh.");
    }
    
    window.renderAdminTahfizhList();
  } catch (err) {
    window.showToast?.("Gagal menghapus setoran tahfizh", "error");
  }
};

window.editAdminTahfizh = function (id) {
  try {
    const saved = localStorage.getItem('tahfizh_local_setoran');
    const list = saved ? JSON.parse(saved) : [];

    const item = list.find(r => {
      const generatedId = `${r.kelas}_${r.santriId || r.nis || 'unknown'}_${r.rowNumber}`;
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

window.handleEditTahfizhSubmit = function (e) {
  e.preventDefault();

  try {
    const id = document.getElementById("edit-tahfizh-id").value;
    const program = document.getElementById("edit-tahfizh-program").value;
    const jenis = document.getElementById("edit-tahfizh-jenis").value;
    const juz = document.getElementById("edit-tahfizh-juz").value;
    const halaman = document.getElementById("edit-tahfizh-halaman").value.trim();
    const kualitas = document.getElementById("edit-tahfizh-kualitas").value;
    const surat = document.getElementById("edit-tahfizh-surat").value.trim();

    const saved = localStorage.getItem('tahfizh_local_setoran');
    let list = saved ? JSON.parse(saved) : [];

    const idx = list.findIndex(r => {
      const generatedId = `${r.kelas}_${r.santriId || r.nis || 'unknown'}_${r.rowNumber}`;
      return generatedId === id;
    });

    if (idx === -1) {
      window.showToast?.("Catatan setoran tidak ditemukan!", "error");
      return;
    }

    list[idx].program = program;
    list[idx].jenis = jenis;
    list[idx].juz = juz;
    list[idx].halaman = halaman;
    list[idx].kualitas = kualitas;
    list[idx].surat = surat;
    list[idx].updated_at = new Date().toISOString();

    localStorage.setItem('tahfizh_local_setoran', JSON.stringify(list));
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



