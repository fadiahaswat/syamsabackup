// File: admin-manager.js
// Manager khusus untuk mengelola fitur-fitur administratif (Role Admin)
// Terinspirasi dari fungsi Operations, Communications, dan HR Admin Connecteam.

let classUuidMap = {}; // UUID -> Class Name
let classNameToUuidMap = {}; // Class Name -> UUID
let studentUuidMap = {}; // UUID -> Student Info

/**
 * Inisialisasi peta UUID Kelas dari Supabase
 */
async function initAdminClassMap() {
  if (Object.keys(classUuidMap).length > 0) return;
  if (!window.supabaseClient?.client) return;

  try {
    const { data, error } = await window.supabaseClient.client
      .from('kelas')
      .select('id, nama_kelas');
    if (data) {
      data.forEach(c => {
        classUuidMap[c.id] = c.nama_kelas;
        classNameToUuidMap[c.nama_kelas] = c.id;
      });
      console.log('[AdminManager] Class map initialized:', Object.keys(classUuidMap).length, 'classes');
    }
  } catch (e) {
    console.error('[AdminManager] Fail to init class map:', e);
  }
}

/**
 * Inisialisasi peta UUID Santri dari Supabase
 */
async function initAdminStudentMap() {
  if (Object.keys(studentUuidMap).length > 0) return;
  if (!window.supabaseClient?.client) return;

  try {
    const { data, error } = await window.supabaseClient.client
      .from('student')
      .select('id, nis, nama');
    if (data) {
      data.forEach(s => {
        studentUuidMap[s.id] = { nis: s.nis, nama: s.nama };
      });
      console.log('[AdminManager] Student map initialized:', Object.keys(studentUuidMap).length, 'students');
    }
  } catch (e) {
    console.error('[AdminManager] Fail to init student map:', e);
  }
}

/**
 * 1. OPERATIONS: Memuat rekap absensi harian seluruh kelas untuk 6 sesi shalat
 */
window.loadGlobalAttendance = async function () {
  if (!window.supabaseClient?.client) {
    return { data: null, error: 'Database offline' };
  }

  await initAdminClassMap();

  try {
    const { data, error } = await window.supabaseClient.client
      .from('attendance_record')
      .select('kelas_id, slot_id')
      .eq('date_key', appState.date);

    if (error) throw error;

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

    if (data) {
      data.forEach(row => {
        const className = classUuidMap[row.kelas_id];
        if (className && rekap[className]) {
          rekap[className][row.slot_id] = true; // Ditandai sudah diisi
        }
      });
    }

    return { data: rekap, error: null };
  } catch (error) {
    console.error('[AdminManager] loadGlobalAttendance error:', error);
    return { data: null, error };
  }
};

/**
 * 2. PERIZINAN: Memuat riwayat izin dari semua kelas
 */
window.loadGlobalPermits = async function () {
  if (!window.supabaseClient?.client) {
    return { data: null, error: 'Database offline' };
  }

  try {
    const { data, error } = await window.supabaseClient.client
      .from('permit')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Cari detail santri di cache lokal menggunakan NIS
    const permits = (data || []).map(p => {
      const student = window.findWaliSantriByNis(p.nis);
      return {
        ...p,
        studentName: student?.nama || p.nama_wali || 'Santri',
        className: student?.kelas || p.kelas_id || 'Kelas'
      };
    });

    return { data: permits, error: null };
  } catch (error) {
    console.error('[AdminManager] loadGlobalPermits error:', error);
    return { data: null, error };
  }
};

/**
 * 3. TAHFIZH: Memuat data setoran tahfizh global seluruh santri
 */
window.loadGlobalTahfizh = async function () {
  if (!window.supabaseClient?.client) {
    return { data: null, error: 'Database offline' };
  }

  try {
    const { data, error } = await window.supabaseClient.client
      .from('tahfizh_record')
      .select('*')
      .order('tanggal', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[AdminManager] loadGlobalTahfizh error:', error);
    return { data: null, error };
  }
};

/**
 * 4. TAHFIZH SYNC: Menyelaraskan setoran tahfizh lokal ke Supabase di background
 */
window.syncTahfizhToCloud = async function () {
  if (!window.supabaseClient?.client || !navigator.onLine || window.APP_STORAGE?.mode === 'local-only') return;

  const localSetoran = localStorage.getItem('tahfizh_local_setoran');
  if (!localSetoran) return;

  try {
    let list = JSON.parse(localSetoran);
    let needsUpdate = false;

    // Ambil maksimal 15 record per batch sync agar cepat
    const unsynced = list.filter(r => !r.synced).slice(0, 15);
    if (unsynced.length === 0) return;

    console.log('[TahfizhSync] Syncing', unsynced.length, 'records to Supabase...');

    for (let record of unsynced) {
      const id = `${record.kelas}_${record.santriId || record.nis || 'unknown'}_${record.rowNumber}`.replace(/\s+/g, '_');
      
      const { error } = await window.supabaseClient.client
        .from('tahfizh_record')
        .upsert({
          id,
          musyrif: record.musyrif || '',
          nama_santri: record.namaSantri || '',
          santri_id: record.santriId || record.nis || '',
          kelas: record.kelas || '',
          program: record.program || '',
          jenis: record.jenis || '',
          juz: String(record.juz || ''),
          tanggal: record.tanggal ? record.tanggal.split('T')[0] : new Date().toISOString().split('T')[0],
          kualitas: record.kualitas || 'Lancar',
          status: record.status || 'Verified',
          surat: record.surat || '',
          halaman: String(record.halaman || ''),
          row_number: Number(record.rowNumber || 0)
        });

      if (!error) {
        // Cari dan perbarui status sync di array asli
        const originalIndex = list.findIndex(r => r.rowNumber === record.rowNumber && r.kelas === record.kelas && r.santriId === record.santriId);
        if (originalIndex !== -1) {
          list[originalIndex].synced = true;
          needsUpdate = true;
        }
      } else {
        console.warn('[TahfizhSync] Failed to sync record:', id, error);
      }
    }

    if (needsUpdate) {
      localStorage.setItem('tahfizh_local_setoran', JSON.stringify(list));
      console.log('[TahfizhSync] Local setoran cache marked as synced.');
      
      // Reload UI jika fungsi tersedia
      if (typeof reloadTahfizhData === 'function') {
        reloadTahfizhData();
      }
    }
  } catch (err) {
    console.error('[TahfizhSync] Sync process failed:', err);
  }
};

/**
 * 5. HR & WALI: Reset password kustom Wali agar kembali ke default (NIS)
 */
window.resetWaliPassword = async function (nis) {
  if (!window.supabaseClient?.client) {
    return { success: false, error: 'Database offline' };
  }

  try {
    const { error } = await window.supabaseClient.client
      .from('wali_password')
      .delete()
      .eq('nis', nis);

    if (error) throw error;
    
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
 * 6. HR & WALI: Ubah/Setel password Wali Santri (digunakan oleh Wali atau Admin)
 */
window.changeWaliPassword = async function (nis, newPassword) {
  if (!window.supabaseClient?.client) {
    return { success: false, error: 'Database offline' };
  }

  try {
    const hash = await window.sha256Hex(newPassword);
    const { error } = await window.supabaseClient.client
      .from('wali_password')
      .upsert({ nis, password_hash: hash });

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error('[AdminManager] changeWaliPassword error:', error);
    return { success: false, error };
  }
};

/**
 * 7. COMMUNICATIONS: Membuat pengumuman broadcast baru
 */
window.createAnnouncement = async function (title, content) {
  if (!window.supabaseClient?.client) {
    return { success: false, error: 'Database offline' };
  }

  try {
    const { error } = await window.supabaseClient.client
      .from('announcements')
      .insert({
        title,
        content,
        created_by: appState.userProfile?.name || 'Admin'
      });

    if (error) throw error;
    
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
 */
window.loadAnnouncements = async function () {
  if (!window.supabaseClient?.client) {
    return { data: null, error: 'Database offline' };
  }

  try {
    const { data, error } = await window.supabaseClient.client
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[AdminManager] loadAnnouncements error:', error);
    return { data: null, error };
  }
};

/**
 * 9. AUDIT LOGS: Memuat seluruh log aktivitas sistem secara global
 */
window.loadGlobalActivityLogs = async function () {
  if (!window.supabaseClient?.client) {
    return { data: null, error: 'Database offline' };
  }

  try {
    const { data, error } = await window.supabaseClient.client
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[AdminManager] loadGlobalActivityLogs error:', error);
    return { data: null, error };
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
    
    const rowRekap = rekap[className] || { subh: false, syur: false, dzuh: false, ash: false, magh: false, isya: false };
    
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
  
  // Init Hybrid Storage for class sync
  if (window.APP_STORAGE?.mode !== 'local-only' && window.hybridStorageManager) {
    const kelasInfo = MASTER_KELAS?.[className];
    const kelasId = kelasInfo?.supabaseId || kelasInfo?.id || className;
    window.hybridStorageManager.init(kelasId).catch(err => {
      console.warn('[AdminOverride] Hybrid storage init failed:', err);
    });
  }
  
  // Open attendance
  window.openAttendance();
};

window.renderAdminHRList = async function () {
  const tbody = document.getElementById("admin-hr-table-body");
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Memuat data...</td></tr>`;
  
  if (!window.supabaseClient?.client) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Database offline.</td></tr>`;
    return;
  }
  
  try {
    const { data: customPws, error } = await window.supabaseClient.client
      .from('wali_password')
      .select('nis');
      
    if (error) throw error;
    
    const customNisSet = new Set((customPws || []).map(p => String(p.nis).trim()));
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
      const nisStr = String(s.nis).trim();
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
            <div class="font-black text-slate-800 dark:text-white">${s.nama}</div>
          </td>
          <td class="p-3 text-slate-600 dark:text-slate-300">${s.kelas || s.rombel || "-"}</td>
          <td class="p-3 text-slate-500 font-mono">${nisStr}</td>
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
  
  const searchQuery = (document.getElementById("admin-tahfizh-search")?.value || "").toLowerCase().trim();
  
  tbody.innerHTML = "";
  
  let filtered = data;
  if (searchQuery) {
    filtered = data.filter(r => 
      (r.nama_santri && r.nama_santri.toLowerCase().includes(searchQuery)) ||
      String(r.santri_id).includes(searchQuery) ||
      (r.kelas && r.kelas.toLowerCase().includes(searchQuery))
    );
  }
  
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Tidak ada catatan tahfizh ditemukan.</td></tr>`;
    return;
  }
  
  filtered.slice(0, 100).forEach(r => {
    const qColor = r.kualitas === "Lancar" ? "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400" :
                   r.kualitas === "Sedang" ? "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400" :
                   "bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400";
                   
    const setoranDesc = r.jenis === "Ziyadah" 
      ? `<span class="text-orange-500">Ziyadah: Juz ${r.juz || '-'} (Hlm ${r.halaman || '-'})</span>` 
      : `<span class="text-indigo-500">Murojaah: Juz ${r.juz || '-'} (Surat ${r.surat || '-'})</span>`;
      
    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white">${r.nama_santri}</div>
          <div class="text-[9px] text-slate-400 font-mono">${r.santri_id}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${r.kelas || "-"}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${r.program || "Sabaq"}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${setoranDesc}</td>
        <td class="p-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${qColor}">${r.kualitas || "Lancar"}</span>
        </td>
        <td class="p-3 text-slate-400 font-mono text-[10px]">${r.tanggal ? window.formatDate(r.tanggal) : "-"}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${r.musyrif || "-"}</td>
      </tr>
    `;
  });
  
  if (filtered.length > 100) {
    tbody.innerHTML += `<tr><td colspan="7" class="p-3 text-center text-slate-400 font-bold text-[10px]">Menampilkan 100 dari ${filtered.length} setoran. Silakan gunakan pencarian untuk memfilter lebih spesifik.</td></tr>`;
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
  
  tbody.innerHTML = "";
  
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Tidak ada riwayat perizinan.</td></tr>`;
    return;
  }
  
  data.forEach(p => {
    let statusClass = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
    if (p.status === "Disetujui" || p.status === "Approved") statusClass = "bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400";
    if (p.status === "Ditolak" || p.status === "Rejected") statusClass = "bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-400";
    if (p.status === "Diajukan" || p.status === "Pending") statusClass = "bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400";
    if (p.status === "Kembali") statusClass = "bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-400";
    
    const actions = (p.status === "Diajukan" || p.status === "Pending")
      ? `<div class="flex items-center justify-center gap-1">
          <button onclick="window.approveOrRejectPermit('${p.id}', true)" class="px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 text-[10px] font-black active:scale-[0.98] transition-all">Setujui</button>
          <button onclick="window.approveOrRejectPermit('${p.id}', false)" class="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-[10px] font-black active:scale-[0.98] transition-all">Tolak</button>
         </div>`
      : `<span class="text-slate-400 text-[10px]">-</span>`;
      
    tbody.innerHTML += `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
        <td class="p-3">
          <div class="font-black text-slate-800 dark:text-white">${p.studentName || 'Santri'}</div>
          <div class="text-[9px] text-slate-400 font-mono">${p.nis || '-'}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300">${p.className || "-"}</td>
        <td class="p-3 text-slate-600 dark:text-slate-300 font-bold">${p.tipe_izin || p.type || "Izin"}</td>
        <td class="p-3 text-slate-500 text-[10px]">
          <div>Mulai: ${p.tanggal_mulai || p.start_date || "-"}</div>
          <div>Selesai: ${p.tanggal_selesai || p.end_date || "-"}</div>
        </td>
        <td class="p-3 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title="${p.keperluan || p.reason || '-'}">${p.keperluan || p.reason || "-"}</td>
        <td class="p-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-black ${statusClass}">${p.status || "Diajukan"}</span>
        </td>
        <td class="p-3 text-center">${actions}</td>
      </tr>
    `;
  });
  
  if (window.lucide) window.lucide.createIcons();
};

window.approveOrRejectPermit = async function (permitId, approved) {
  if (!window.supabaseClient?.client) {
    window.showToast("Database offline.", "error");
    return;
  }
  
  const statusStr = approved ? "Disetujui" : "Ditolak";
  const actionText = approved ? "menyetujui" : "menolak";
  
  if (confirm(`Apakah Anda yakin ingin ${actionText} permohonan izin ini?`)) {
    try {
      const { error } = await window.supabaseClient.client
        .from('permit')
        .update({ 
          status: statusStr,
          approved_by: appState.userProfile?.name || 'Admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', permitId);
        
      if (error) throw error;
      
      window.showToast(`Izin berhasil di-${statusStr.toLowerCase()}.`, "success");
      
      // Catat ke audit log
      if (window.logActivityAudit) {
        window.logActivityAudit('Otorisasi Izin', `ID ${permitId}`, `${statusStr} izin santri`);
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
  
  // Filter yang statusnya disetujui tapi belum kembali (status = "Disetujui" atau status = "Keluar")
  const activeOut = data.filter(p => p.status === "Disetujui" || p.status === "Keluar");
  
  if (activeOut.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Tidak ada santri di luar asrama.</td></tr>`;
    return;
  }
  
  activeOut.forEach(p => {
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
          <span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">Keluar</span>
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
    container.innerHTML += `
      <div class="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
        <div class="flex justify-between items-start gap-2 mb-1">
          <h4 class="text-xs font-black text-slate-800 dark:text-white">${ann.title}</h4>
          <span class="text-[9px] text-slate-400 font-mono">${ann.created_at ? new Date(ann.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : '-'}</span>
        </div>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold whitespace-pre-line">${ann.content}</p>
        <div class="text-[9px] text-slate-400 font-bold mt-2">Oleh: ${ann.created_by || 'Admin'}</div>
      </div>
    `;
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
  
  if (window.supabaseClient?.client) {
    try {
      const { error } = await window.supabaseClient.client
        .from('activity_log')
        .insert({
          user_name: appState.userProfile?.name || 'Admin',
          action: action,
          detail: `${target}: ${description}`
        });
      if (error) console.error('[AuditLog] Supabase save error:', error);
    } catch (e) {
      console.error('[AuditLog] Supabase save exception:', e);
    }
  }
};
