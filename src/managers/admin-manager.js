// File: admin-manager.js
// Manager khusus untuk mengelola fitur-fitur administratif (Role Admin)
// Terinspirasi dari fungsi Operations, Communications, dan HR Admin Connecteam.
// Mode localStorage only

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
  console.log('[AdminManager] Class map initialized:', Object.keys(classUuidMap).length, 'classes');
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
  console.log('[AdminManager] Student map initialized:', Object.keys(studentUuidMap).length, 'students');
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
        syuruq: false,
        dzuhur: false,
        ashar: false,
        maghrib: false,
        isya: false
      };
    });

    // Ambil data dari localStorage untuk setiap kelas
    const slots = ['shubuh', 'syuruq', 'dzuhur', 'ashar', 'maghrib', 'isya'];
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
        console.warn('[AdminManager] Error reading attendance for', className, e);
      }
    }

    return { data: rekap, error: null };
  } catch (error) {
    console.error('[AdminManager] loadGlobalAttendance error:', error);
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
        console.warn('[AdminManager] Error reading permits from localStorage', e);
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
    console.error('[AdminManager] loadGlobalPermits error:', error);
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
      console.warn('[AdminManager] Error reading tahfizh from localStorage', e);
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
    console.error('[AdminManager] loadGlobalTahfizh error:', error);
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
    console.error('[AdminManager] resetWaliPassword error:', error);
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
    console.error('[AdminManager] changeWaliPassword error:', error);
    return { success: false, error };
  }
};

/**
 * 7. COMMUNICATIONS: Membuat pengumuman broadcast baru
 * Menggunakan localStorage
 */
window.createAnnouncement = async function (title, content) {
  try {
    const announcementKey = 'local_announcements';
    const saved = localStorage.getItem(announcementKey);
    let announcements = saved ? JSON.parse(saved) : [];

    const newAnnouncement = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      title,
      content,
      created_by: appState.userProfile?.name || 'Admin',
      created_at: new Date().toISOString()
    };

    announcements.unshift(newAnnouncement);
    // Simpan maksimal 50 pengumuman
    localStorage.setItem(announcementKey, JSON.stringify(announcements.slice(0, 50)));

    // Catat ke audit log
    if (window.logActivityAudit) {
      window.logActivityAudit('Broadcast', 'Semua Musyrif', `Mengirim pengumuman: "${title}"`);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('[AdminManager] createAnnouncement error:', error);
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
    console.error('[AdminManager] loadAnnouncements error:', error);
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
    console.error('[AdminManager] loadGlobalActivityLogs error:', error);
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
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">Memuat matriks...</td></tr>`;

  const { data: rekap, error } = await window.loadGlobalAttendance();
  if (error || !rekap) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-red-500">Gagal memuat matriks: ${error || 'Offline'}</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  const kelasKeys = Object.keys(MASTER_KELAS).filter(k => k?.toLowerCase() !== "admin musyrif");

  if (kelasKeys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">Tidak ada data kelas.</td></tr>`;
    return;
  }

  kelasKeys.forEach(className => {
    const classInfo = MASTER_KELAS[className];
    const musyrifName = classInfo.musyrif || "Musyrif";

    // Cari hp musyrif secara cerdas
    let musyrifPhone = classInfo.hp_musyrif || classInfo.phone || "";
    if (!musyrifPhone && typeof MASTER_SANTRI !== "undefined") {
      const sampleSantri = MASTER_SANTRI.find(s => String(s.kelas || s.rombel || "").trim() === className);
      if (sampleSantri && sampleSantri.hp_musyrif) {
        musyrifPhone = sampleSantri.hp_musyrif;
      }
    }

    const rowRekap = rekap[className] || { shubuh: false, syuruq: false, dzuhur: false, ashar: false, maghrib: false, isya: false };

    const slots = ["shubuh", "syuruq", "dzuhur", "ashar", "maghrib", "isya"];
    const slotCells = slots.map(slotId => {
      const isFilled = rowRekap[slotId];
      const colorClass = isFilled ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500 shadow-red-500/20";
      const icon = isFilled ? "check" : "x";
      const title = isFilled ? "Sudah Diisi" : "Belum Diisi";

      return `
        <td class="p-3 text-center">
          <button onclick="window.overrideAttendance('${className}', '${slotId}')" title="Override ${className} - ${slotId} (${title})" class="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] ${colorClass} shadow-sm active:scale-95 transition-all">
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
          <div class="font-black text-slate-800 dark:text-white">${className}</div>
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
  });

  if (window.lucide) window.lucide.createIcons();
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
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Memuat data...</td></tr>`;

  try {
    // Ambil daftar NIS dengan password kustom dari localStorage
    const passwordKey = 'wali_passwords_db';
    const saved = localStorage.getItem(passwordKey);
    const customPasswords = saved ? JSON.parse(saved) : {};
    const customNisSet = new Set(Object.keys(customPasswords));

    const searchQuery = (document.getElementById("admin-hr-search")?.value || "").toLowerCase().trim();

    tbody.innerHTML = "";

    let filtered = MASTER_SANTRI || [];
    if (searchQuery) {
      filtered = (MASTER_SANTRI || []).filter(s =>
        (s.nama && s.nama.toLowerCase().includes(searchQuery)) ||
        (s.nis && String(s.nis).includes(searchQuery)) ||
        (s.wali && s.wali.toLowerCase().includes(searchQuery))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ada santri ditemukan.</td></tr>`;
      return;
    }

    filtered.slice(0, 100).forEach(s => {
      const nisStr = String(s.nis || s.id || '').trim();
      const hasCustom = customNisSet.has(nisStr);
      const statusBadge = hasCustom
        ? `<span class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px]">Kustom</span>`
        : `<span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">Default (NIS)</span>`;

      const resetBtn = hasCustom
        ? `<button onclick="window.handleResetPasswordClick('${nisStr}')" class="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:text-red-400 text-[10px] font-black active:scale-[0.98] transition-all">Reset Password</button>`
        : `<button disabled class="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 text-[10px] font-black cursor-not-allowed">Reset Password</button>`;

      tbody.innerHTML += `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
          <td class="p-3">
            <div class="font-black text-slate-800 dark:text-white">${s.nama || s.name || '-'}</div>
          </td>
          <td class="p-3 text-slate-600 dark:text-slate-300">${s.kelas || s.rombel || "-"}</td>
          <td class="p-3 text-slate-500 font-mono">${nisStr || '-'}</td>
          <td class="p-3 text-slate-600 dark:text-slate-300">${s.wali || "-"}</td>
          <td class="p-3">${statusBadge}</td>
          <td class="p-3 text-center">${resetBtn}</td>
        </tr>
      `;
    });

    if (filtered.length > 100) {
      tbody.innerHTML += `<tr><td colspan="6" class="p-3 text-center text-slate-400 font-bold text-[10px]">Menampilkan 100 dari ${filtered.length} santri. Silakan gunakan pencarian untuk memfilter lebih spesifik.</td></tr>`;
    }
  } catch (err) {
    console.error('[AdminManager] renderAdminHRList error:', err);
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error: ${err.message || err}</td></tr>`;
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
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Memuat setoran tahfizh...</td></tr>`;

  const { data, error } = await window.loadGlobalTahfizh();
  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">Gagal memuat tahfizh: ${error || 'Offline'}</td></tr>`;
    return;
  }

  const searchQuery = document.getElementById("admin-tahfizh-search")?.value?.toLowerCase().trim() || "";

  tbody.innerHTML = "";

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

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white">${safeTahfizhText(r.nama_santri)}</div>
          <div class="text-[9px] text-slate-400 font-mono">${safeTahfizhText(r.santrialias || r.santri_id)}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${safeTahfizhText(r.kelas)}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${safeTahfizhText(r.program, "Sabaq")}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${setoranDesc}</td>
        <td class="p-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${qColor}">${safeKualitas}</span>
        </td>
        <td class="p-3 text-slate-400 font-mono text-[10px]">${safeTahfizhText(r.tanggal ? window.formatDate(r.tanggal) : "-")}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${safeTahfizhText(r.musyrif)}</td>
      </tr>
    `;
  });

  if (filtered.length > 100) {
    tbody.innerHTML += `<tr><td colspan="7" class="p-3 text-center text-slate-400 font-bold text-[10px]">Menampilkan 100 dari ${filtered.length} setoran. Silakan gunakan pencarian untuk lebih spesifik.</td></tr>`;
  }
};

let adminPermitSubView = "list"; // list, monitor

window.switchAdminPermitSubView = function (view) {
  adminPermitSubView = view;
  const listBtn = document.getElementById("admin-permit-subview-btn-list");
  const monitorBtn = document.getElementById("admin-permit-subview-btn-monitor");
  const listView = document.getElementById("admin-permit-subview-list");
  const monitorView = document.getElementById("admin-permit-subview-monitor");

  if (view === "list") {
    if (listBtn) listBtn.className = "px-3 py-1.5 rounded-lg text-xs font-black bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
    if (monitorBtn) monitorBtn.className = "px-3 py-1.5 rounded-lg text-xs font-black text-slate-400 dark:text-slate-500";
    if (listView) listView.classList.remove("hidden");
    if (monitorView) monitorView.classList.add("hidden");
    window.renderAdminPermits();
  } else {
    if (monitorBtn) monitorBtn.className = "px-3 py-1.5 rounded-lg text-xs font-black bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
    if (listBtn) listBtn.className = "px-3 py-1.5 rounded-lg text-xs font-black text-slate-400 dark:text-slate-500";
    if (monitorView) monitorView.classList.remove("hidden");
    if (listView) listView.classList.add("hidden");
    window.renderAdminDormMonitor();
  }
};

window.renderAdminPermits = async function () {
  const tbody = document.getElementById("admin-permits-table-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Memuat riwayat perizinan...</td></tr>`;

  const { data, error } = await window.loadGlobalPermits();
  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">Gagal memuat perizinan: ${error || 'Offline'}</td></tr>`;
    return;
  }

  const searchQuery = document.getElementById("admin-permit-search")?.value?.toLowerCase().trim() || "";
  const statusFilter = document.getElementById("admin-permit-status-filter")?.value || "all";

  tbody.innerHTML = "";

  // Filter search and status
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
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Tidak ada riwayat perizinan ditemukan.</td></tr>`;
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

    // Safe ID for event handlers - escape backticks and $
    const safePermitId = String(p.id || p.nis || '').replace(/[`$\\]/g, '\\$&');
    const actions = (statusLower === "pending")
      ? `<div class="flex items-center justify-center gap-1">
          <button onclick="window.approveOrRejectPermit('${safePermitId}', true)" class="px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black active:scale-[0.98] transition-all">Setujui</button>
          <button onclick="window.approveOrRejectPermit('${safePermitId}', false)" class="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-[10px] font-black active:scale-[0.98] transition-all">Tolak</button>
         </div>`
      : `<span class="text-slate-400 text-[10px]">-</span>`;

    // Sanitize user-provided fields to prevent XSS
    const safeStudentName = window.sanitizeHTML(p.studentName || 'Santri');
    const safeReason = window.sanitizeHTML(p.keperluan || p.reason || '-');

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white">${safeStudentName}</div>
          <div class="text-[9px] text-slate-400 font-mono">${window.sanitizeHTML(p.nis || '-')}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${window.sanitizeHTML(p.className || "-")}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${window.sanitizeHTML(p.tipe_izin || p.category || "Izin")}</td>
        <td class="p-3 text-slate-500 text-[10px]">
          <div>Mulai: ${window.sanitizeHTML(p.tanggal_mulai || p.start_date || "-")}</div>
          <div>Selesai: ${window.sanitizeHTML(p.tanggal_selesai || p.end_date || "-")}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title="${safeReason}">${safeReason}</td>
        <td class="p-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${statusClass}">${displayStatus}</span>
        </td>
        <td class="p-3 text-center">${actions}</td>
      </tr>
    `;
  });

  if (filtered.length > 100) {
    tbody.innerHTML += `<tr><td colspan="7" class="p-3 text-center text-slate-400 font-bold text-[10px]">Menampilkan 100 dari ${filtered.length} perizinan. Silakan gunakan pencarian atau filter status untuk lebih spesifik.</td></tr>`;
  }

  if (window.lucide) window.lucide.createIcons();
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
      console.error('[AdminManager] approveOrRejectPermit error:', err);
      window.showToast(`Gagal memperbarui status izin: ${err.message || err}`, "error");
    }
  }
};

window.renderAdminDormMonitor = async function () {
  const tbody = document.getElementById("admin-dorm-monitor-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Memuat status santri di luar...</td></tr>`;

  const { data, error } = await window.loadGlobalPermits();
  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Gagal memuat monitor: ${error || 'Offline'}</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  const currentDate = appState.date || new Date().toISOString().split('T')[0];

  // Filter yang statusnya disetujui (approved) dan belum kembali (is_active !== false) dan sudah mulai masuk rentang izin (currentDate >= start_date)
  const activeOut = data.filter(p => {
    const statusLower = String(p.status || "approved").toLowerCase();
    const isActive = p.is_active !== false;
    const hasStarted = p.start_date && currentDate >= p.start_date;
    return statusLower === "approved" && isActive && hasStarted;
  });

  if (activeOut.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ada santri di luar asrama.</td></tr>`;
    return;
  }

  activeOut.forEach(p => {
    const start = new Date(p.start_date);
    const end = p.end_date ? new Date(p.end_date) : null;
    let durationText = "-";
    if (end) {
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      durationText = `${diffDays} Hari`;
    }

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white">${p.studentName || 'Santri'}</div>
          <div class="text-[9px] text-slate-400 font-mono">${p.nis || '-'}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${p.className || "-"}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">${p.tanggal_mulai || p.start_date || "-"}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">${p.tanggal_selesai || p.end_date || "-"}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title="${p.keperluan || p.reason || '-'}">${p.keperluan || p.reason || "-"}</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${durationText}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">Keluar</span>
          </div>
        </td>
      </tr>
    `;
  });
};

window.handleAdminBroadcastSubmit = async function (e) {
  e.preventDefault();

  const titleInput = document.getElementById("admin-broadcast-title");
  const contentInput = document.getElementById("admin-broadcast-content");
  if (!titleInput || !contentInput) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) return;

  const { success, error } = await window.createAnnouncement(title, content);
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
    item.className = 'p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30';

    const title = document.createElement('h4');
    title.className = 'text-xs font-black text-slate-800 dark:text-white';
    title.textContent = window.sanitizeHTML(ann.title) || '';

    const date = document.createElement('span');
    date.className = 'text-[9px] text-slate-400 font-mono';
    date.textContent = ann.created_at ? new Date(ann.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : '-';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'flex justify-between items-start gap-2 mb-1';
    headerDiv.appendChild(title);
    headerDiv.appendChild(date);

    const content = document.createElement('p');
    content.className = 'text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold whitespace-pre-line';
    content.textContent = window.sanitizeHTML(ann.content) || '';

    const byline = document.createElement('div');
    byline.className = 'text-[9px] text-slate-400 font-bold mt-2';
    byline.textContent = `Oleh: ${window.sanitizeHTML(ann.created_by) || 'Admin'}`;

    item.appendChild(headerDiv);
    item.appendChild(content);
    item.appendChild(byline);
    container.appendChild(item);
  });
};

window.renderAdminLogs = async function () {
  const tbody = document.getElementById("admin-logs-tbody");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Memuat logs...</td></tr>`;

  const { data, error } = await window.loadGlobalActivityLogs();
  if (error || !data) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Gagal memuat logs: ${error || 'Offline'}</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400">Tidak ada log aktivitas.</td></tr>`;
    return;
  }

  data.forEach(log => {
    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3 text-[10px] text-slate-400 font-mono">${log.created_at ? new Date(log.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'}) : '-'}</td>
        <td class="p-3 text-slate-700 dark:text-slate-300">${log.user_name || 'System'}</td>
        <td class="p-3 text-slate-800 dark:text-white font-bold"><span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">${log.action || '-'}</span></td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold max-w-[200px] truncate" title="${log.detail || ''}">${log.detail || '-'}</td>
      </tr>
    `;
  });
};

window.logActivityAudit = async function (action, target, description) {
  console.log('[AuditLog]', action, '-', target, '-', description);

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
    console.error('[AuditLog] Error saving to localStorage:', e);
  }
};
