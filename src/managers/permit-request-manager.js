/**
 * permit-request-manager.js
 *
 * Mengelola permohonan perizinan siswa oleh Wali (Orang Tua)
 * dan sistem persetujuan oleh Musyrif kelas.
 * Menggunakan localStorage untuk penyimpanan data.
 */

(function() {
  // Unified storage keys - use same key as StorageManager
  const STORAGE_KEY = 'permit_requests'; // Legacy: keep for migration
  const PERMITS_STORAGE_KEY = 'musyrif_permits_db'; // Main permits storage

  // MEDIUM FIX: Use shared constants instead of duplicating
  const DAYS = window.SHARED_CONSTANTS?.DAYS_INDO || ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTHS = window.SHARED_CONSTANTS?.MONTHS_FULL || [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  function formatIndonesianDate(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = DAYS[date.getDay()];
    const dateNum = date.getDate();
    const month = MONTHS[date.getMonth()];
    const year = date.getFullYear();
    return `${day}, ${dateNum} ${month} ${year}`;
  }

  function normalizeValue(value) {
    return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
  }

  function getStudentId(student) {
    return String(student?.nis || student?.id || "").trim();
  }

  function getPermitStudentId(permit) {
    return String(permit?.nis || permit?.studentId || "").trim();
  }

  function getPermitStudent(permit) {
    const nis = getPermitStudentId(permit);
    if (!nis) return null;
    if (typeof window.findWaliSantriByNis === "function") {
      const found = window.findWaliSantriByNis(nis);
      if (found) return found;
    }
    const master = window.MASTER_SANTRI || (typeof MASTER_SANTRI !== "undefined" ? MASTER_SANTRI : []);
    return Array.isArray(master)
      ? master.find(s => String(s.nis || s.id) === nis) || null
      : null;
  }

  function getPermitClass(permit) {
    const student = getPermitStudent(permit);
    return String(permit?.kelas || student?.kelas || student?.rombel || "").trim();
  }

  function isAdminContext() {
    const profileRole = String(appState?.userProfile?.role || "").toLowerCase();
    const selectedClass = String(appState?.selectedClass || "").toLowerCase();
    return profileRole.includes("admin") || selectedClass.includes("admin") ||
           appState?.adminMode === true || appState?.superadminMode === true;
  }

  function isPermitOwnedByCurrentWali(permit) {
    const waliStudentId = getStudentId(appState?.waliSantri);
    return Boolean(waliStudentId) && getPermitStudentId(permit) === waliStudentId;
  }

  function isPermitInSelectedMusyrifClass(permit) {
    if (isAdminContext()) return true;
    const selectedClass = appState?.selectedClass;
    if (!selectedClass) return false;

    const permitClass = getPermitClass(permit);
    if (permitClass && normalizeValue(permitClass) === normalizeValue(selectedClass)) return true;

    const classNisList = typeof FILTERED_SANTRI !== "undefined" && Array.isArray(FILTERED_SANTRI)
      ? FILTERED_SANTRI.map(s => String(s.nis || s.id))
      : [];
    return classNisList.includes(getPermitStudentId(permit));
  }

  function dedupePermits(permits) {
    const byId = new Map();
    (Array.isArray(permits) ? permits : []).forEach(permit => {
      if (!permit?.id) return;
      byId.set(String(permit.id), { ...(byId.get(String(permit.id)) || {}), ...permit });
    });
    return Array.from(byId.values());
  }

  function persistPermitList(permits) {
    const deduped = dedupePermits(permits);
    appState.permits = deduped;
    if (window.storageManager?.savePermits) {
      window.storageManager.savePermits(deduped);
    } else {
      localStorage.setItem(PERMITS_STORAGE_KEY, JSON.stringify(deduped));
    }
    return deduped;
  }

  function persistSinglePermit(permit) {
    const existing = Array.isArray(appState.permits) ? appState.permits : [];
    const next = [...existing.filter(p => String(p?.id) !== String(permit.id)), permit];
    return persistPermitList(next).find(p => String(p.id) === String(permit.id)) || permit;
  }

  function notifyUser(recipientType, recipientId, title, body, type = "permit", deepLink = "") {
    const notify = window.addNotification || window.addLocalNotification;
    if (typeof notify === "function") {
      notify(recipientType, recipientId, title, body, type, deepLink);
    }
  }

  // Helper: Get all permit requests from localStorage
  function getAllRequests() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  // Helper: Save all permit requests to localStorage
  function saveAllRequests(requests) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  }

  // Helper: Get requests by NIS
  function getRequestsByNis(nis) {
    const all = getAllRequests();
    return Object.values(all).filter(r => r && String(r.nis) === String(nis));
  }

  // =========================================================================
  // 1. FUNGSI UNTUK WALI (ORANG TUA)
  // =========================================================================

  /**
   * Membuka modal pengajuan izin untuk Wali
   */
  window.openWaliPermitModal = function() {
    if (!window.isWaliMode || !window.isWaliMode()) {
      return window.showToast("Fitur ini khusus untuk akun Wali Santri.", "warning");
    }

    const siswa = appState.waliSantri;
    if (!siswa) return window.showToast("Data siswa tidak ditemukan.", "error");

    // Reset Form
    const form = document.getElementById("wali-permit-form");
    if (form) form.reset();

    // Autofill & Lock Fields
    const elNamaSiswa = document.getElementById("wali-permit-nama-santri");
    const elKelasSiswa = document.getElementById("wali-permit-kelas-santri");
    const elNamaWali = document.getElementById("wali-permit-nama-wali");
    const elAlamatWali = document.getElementById("wali-permit-alamat-wali");

    if (elNamaSiswa) elNamaSiswa.value = siswa.nama || "";
    if (elKelasSiswa) elKelasSiswa.value = appState.waliKelas || siswa.kelas || "";
    if (elNamaWali) elNamaWali.value = appState.userProfile?.name?.replace("Wali ", "") || "";
    if (elAlamatWali) {
      elAlamatWali.value = siswa.alamat_wali || siswa.alamatWali || siswa.alamat_ortu || siswa.alamat || "";
    }

    // Set Default Tanggal ke Hari Ini
    const elDate = document.getElementById("wali-permit-date");
    if (elDate) elDate.value = window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().split("T")[0];

    // Populate Time Dropdowns
    const elStartTime = document.getElementById("wali-permit-start-time");
    const elEndTime = document.getElementById("wali-permit-end-time");

    if (elStartTime) populateTimeDropdown(elStartTime, 6, 21, "08:00");
    if (elEndTime) populateTimeDropdown(elEndTime, 6, 21, "17:00");

    window.openModal("modal-wali-permit");
  };

  /**
   * Mengisi jam pada dropdown select
   */
  function populateTimeDropdown(selectEl, startHour, endHour, defaultValue = "") {
    selectEl.innerHTML = "";
    for (let i = startHour; i <= endHour; i++) {
      for (let j = 0; j < 60; j += 15) {
        if (i === endHour && j > 0) continue;
        const hour = i.toString().padStart(2, '0');
        const minute = j.toString().padStart(2, '0');
        const time = `${hour}:${minute}`;
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        if (time === defaultValue) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      }
    }
  }

  /**
   * Mengirim permohonan izin Wali
   */
  window.submitWaliPermit = async function(event) {
    if (event) event.preventDefault();

    const form = document.getElementById("wali-permit-form");
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const siswa = appState.waliSantri;
    if (!siswa) return window.showToast("Sesi Wali Santri kedaluwarsa.", "error");

    const namaWali = document.getElementById("wali-permit-nama-wali").value.trim();
    const alamatWali = document.getElementById("wali-permit-alamat-wali").value.trim();
    const category = document.getElementById("wali-permit-category").value;
    const reason = document.getElementById("wali-permit-reason").value.trim();
    const date = document.getElementById("wali-permit-date").value;
    const startTime = document.getElementById("wali-permit-start-time").value;
    const endTime = document.getElementById("wali-permit-end-time").value;
    const destination = document.getElementById("wali-permit-destination").value.trim();

    // Validasi Tanggal & Jam
    if (startTime >= endTime) {
      return window.showToast("Jam kembali harus setelah jam keluar.", "warning");
    }

    const requestId = 'req_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const requestData = {
      id: requestId,
      nis: String(siswa.nis || siswa.id || ""),
      studentId: String(siswa.id || siswa.nis || ""),
      nama: siswa.nama,
      kelas: String(appState.waliKelas || siswa.kelas || "").trim(),
      nama_wali: namaWali,
      alamat_wali: alamatWali,
      category: category,
      reason: reason,
      start_date: date,
      end_date: date,
      start_time_limit: startTime,
      end_time_limit: endTime,
      destination: destination,
      location: destination,
      status: 'pending',
      timestamp: new Date().toISOString(),
      status_label: category === 'sakit' ? 'S' : 'P',
      requested_by: 'wali',
      audit_trail: [
        {
          action: "Diajukan wali",
          by: namaWali || appState.userProfile?.name || "Wali Santri",
          time: new Date().toISOString()
        }
      ]
    };

    persistSinglePermit(requestData);

    // Trigger notification to Musyrif of the class
    let musyrifEmail = "";
    const targetKelasNormalized = String(requestData.kelas || "").replace(/\s+/g, "").toLowerCase();

    permitDebugLog("[PermitRequest Debug] Resolving Musyrif email for class:", requestData.kelas, `(normalized: ${targetKelasNormalized})`);

    // 1. First try: Check if we have cached musyrif email for this class from login
    const cachedMusyrifEmail = localStorage.getItem(`musyrif_email_${targetKelasNormalized}`);
    if (cachedMusyrifEmail) {
      musyrifEmail = cachedMusyrifEmail;
      permitDebugLog("[PermitRequest Debug] Source: LocalStorage Cache ->", musyrifEmail);
    }

    // 2. Second try: Get from class data sources
    const classDataSource = window.classData || window.MASTER_KELAS || (typeof MASTER_KELAS !== "undefined" ? MASTER_KELAS : null);
    if (!musyrifEmail && classDataSource) {
      const matchedKey = Object.keys(classDataSource).find(k =>
        String(k).replace(/\s+/g, "").toLowerCase() === targetKelasNormalized
      );
      if (matchedKey) {
        musyrifEmail = classDataSource[matchedKey]?.email || "";
        if (musyrifEmail) {
          localStorage.setItem(`musyrif_email_${targetKelasNormalized}`, musyrifEmail);
        }
      }
    }

    // 3. Third try: Fallback to constructed email based on kelas
    if (!musyrifEmail) {
      musyrifEmail = `${targetKelasNormalized}@musyrif.local`;
      permitDebugLog("[PermitRequest Debug] Source: Fallback local email ->", musyrifEmail);
    }
    musyrifEmail = musyrifEmail.trim().toLowerCase();

    permitDebugLog("[PermitRequest Debug] Final resolved musyrifEmail:", musyrifEmail);

    notifyUser(
      "musyrif",
      musyrifEmail,
      "Pengajuan Izin Baru",
      `Wali dari ${siswa.nama} mengajukan izin ${category} (${reason}) pada tanggal ${date}.`,
      "permit",
      `tab=home&action=verify&id=${requestId}`
    );

    window.showToast("Permohonan izin berhasil disimpan!", "success");
    window.closeModal("modal-wali-permit");
    window.loadWaliPermitHistory();
    window.refreshPermitSurfaces?.();
  };

  /**
   * Memuat riwayat pengajuan izin khusus Wali
   */
  window.loadWaliPermitHistory = function() {
    const container = document.getElementById("wali-permit-history-list");
    if (!container) return;

    const siswa = appState.waliSantri;
    if (!siswa) {
      container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Sesi tidak valid</div>`;
      return;
    }
    const nis = String(siswa.nis || siswa.id || "");

    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div class="w-8 h-8 rounded-full border-4 border-slate-200 border-t-palette-blue animate-spin mb-3"></div>
        <p class="text-xs font-semibold">Mengambil riwayat pengajuan...</p>
      </div>
    `;

    // Load from appState.permits
    const permits = appState.permits || [];
    const studentPermits = permits.filter(p => p && String(p.nis) === nis);

    // Sort descending by timestamp / start_date
    studentPermits.sort((a, b) => new Date(b.timestamp || b.created_at || Date.now()) - new Date(a.timestamp || a.created_at || Date.now()));

    renderWaliPermitHistoryList(studentPermits);
  };

  /**
   * Merender daftar riwayat perizinan Wali
   */
  function renderWaliPermitHistoryList(list) {
    const container = document.getElementById("wali-permit-history-list");
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mb-2 opacity-60"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p class="text-xs font-bold">Belum Ada Pengajuan Izin</p>
          <p class="text-[10px] text-slate-400 mt-0.5">Semua riwayat pengajuan Anda akan muncul di sini.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    list.forEach(req => {
      const card = document.createElement("div");
      card.className = "p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3 transition-all hover:border-slate-200 dark:hover:border-slate-700/80";

      let statusBadge = "";
      let ticketBtn = "";

      if (req.status === "pending") {
        statusBadge = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40">Menunggu</span>`;
      } else if (req.status === "approved") {
        statusBadge = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40">Disetujui</span>`;
        const escapedData = encodeURIComponent(JSON.stringify(req));
        ticketBtn = `
          <button onclick="window.showExitTicket('${escapedData}')" class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13 2 2 4-4"/></svg>
            <span>Tampilkan Tiket Keluar</span>
          </button>
        `;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40">Ditolak</span>`;
      }

      const formattedDate = formatIndonesianDate(req.start_date);
      const categoryText = req.category === 'sakit' ? 'Sakit / Medis' : 'Izin Keperluan';

      // Action buttons: only for pending status
      let actionButtons = '';
      if (req.status === 'pending') {
        actionButtons = `
          <div class="flex gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button onclick="window.openEditWaliPermitModal('${req.id}')" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold transition-all active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              <span>Edit</span>
            </button>
            <button onclick="window.confirmDeleteWaliPermit('${req.id}')" class="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-bold transition-all active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              <span>Batalkan</span>
            </button>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">${categoryText}</span>
            <h4 class="text-xs font-bold text-slate-800 dark:text-white leading-tight">${window.sanitizeHTML(req.reason)}</h4>
          </div>
          ${statusBadge}
        </div>

        <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <div>
            <span class="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Waktu Keluar</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">${formattedDate}</span>
            <span class="block text-[9px] font-semibold mt-0.5">${req.start_time_limit} - ${req.end_time_limit} WIB</span>
          </div>
          <div>
            <span class="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tempat Tujuan</span>
            <span class="font-bold text-slate-700 dark:text-slate-300 block truncate">${window.sanitizeHTML(req.destination || req.location || '')}</span>
          </div>
        </div>

        ${ticketBtn}
        ${actionButtons}
      `;
      container.appendChild(card);
    });
  }

  /**
   * Menampilkan popup Tiket Keluar Digital (Wali/Satpam)
   */
  window.showExitTicket = function(escapedData) {
    const req = JSON.parse(decodeURIComponent(escapedData));

    const studentInfo = window.findWaliSantriByNis ? window.findWaliSantriByNis(req.nis) : null;
    const studentName = studentInfo?.nama || req.nama || "Santri";
    const studentClass = studentInfo?.kelas || studentInfo?.rombel || req.kelas || appState.waliKelas || "Kelas";

    document.getElementById("ticket-student-name").textContent = studentName;
    document.getElementById("ticket-student-nis").textContent = `NIS: ${req.nis}`;
    document.getElementById("ticket-student-class").textContent = `Kelas: ${studentClass}`;

    document.getElementById("ticket-wali-name").textContent = req.nama_wali || "-";
    document.getElementById("ticket-wali-address").textContent = req.alamat_wali || "-";
    document.getElementById("ticket-destination").textContent = req.destination || req.location || req.reason;
    document.getElementById("ticket-reason").textContent = req.reason;

    const validDateStr = `${formatIndonesianDate(req.start_date)} Pukul ${req.start_time_limit} - ${req.end_time_limit} WIB`;
    document.getElementById("ticket-valid-time").textContent = validDateStr;

    document.getElementById("ticket-approver").textContent = req.approvedBy || "Musyrif";

    const formattedApprovedAt = req.approvedAt ? new Date(req.approvedAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + " WIB" : "-";
    document.getElementById("ticket-approved-time").textContent = formattedApprovedAt;

    // Generate pseudo-barcode lines inside SVG
    const svgBarcode = document.getElementById("ticket-barcode-svg");
    if (svgBarcode) {
      svgBarcode.innerHTML = "";
      let x = 10;
      const barColor = '#0f172a';
      while (x < 290) {
        const width = [1, 2, 3, 4][Math.floor(Math.random() * 4)];
        const spacing = [2, 3, 4][Math.floor(Math.random() * 3)];

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", "5");
        rect.setAttribute("width", width);
        rect.setAttribute("height", "40");
        rect.setAttribute("fill", barColor);

        svgBarcode.appendChild(rect);
        x += width + spacing;
      }
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", "150");
      text.setAttribute("y", "56");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#334155");
      text.setAttribute("font-size", "9px");
      text.setAttribute("font-family", "monospace");
      text.setAttribute("font-weight", "bold");
      text.textContent = `SYM-${req.id.toUpperCase()}`;
      svgBarcode.appendChild(text);
    }

    window.openModal("modal-exit-ticket");
  };

  // =========================================================================
  // 1b. CRUD UNTUK WALI (EDIT & DELETE)
  // =========================================================================

  /**
   * Membuka modal edit pengajuan izin untuk Wali
   */
  window.openEditWaliPermitModal = function(requestId) {
    const permits = appState.permits || [];
    const permit = permits.find(p => p && String(p.id) === String(requestId));

    if (!permit) {
      return window.showToast("Data pengajuan tidak ditemukan.", "error");
    }

    if (!isPermitOwnedByCurrentWali(permit)) {
      return window.showToast("Anda tidak dapat mengedit pengajuan santri lain.", "error");
    }

    if (permit.status !== 'pending') {
      return window.showToast("Hanya pengajuan dengan status 'Menunggu' yang dapat diedit.", "warning");
    }

    window.editingPermitId = requestId;

    const elNamaWali = document.getElementById("edit-wali-permit-nama-wali");
    const elAlamatWali = document.getElementById("edit-wali-permit-alamat-wali");
    const elCategory = document.getElementById("edit-wali-permit-category");
    const elReason = document.getElementById("edit-wali-permit-reason");
    const elDate = document.getElementById("edit-wali-permit-date");
    const elStartTime = document.getElementById("edit-wali-permit-start-time");
    const elEndTime = document.getElementById("edit-wali-permit-end-time");
    const elDestination = document.getElementById("edit-wali-permit-destination");

    if (elNamaWali) elNamaWali.value = permit.nama_wali || "";
    if (elAlamatWali) elAlamatWali.value = permit.alamat_wali || "";
    if (elCategory) elCategory.value = permit.category || "pulang";
    if (elReason) elReason.value = permit.reason || "";
    if (elDate) elDate.value = permit.start_date || "";
    if (elDestination) elDestination.value = permit.destination || permit.location || "";

    if (elStartTime) {
      populateTimeDropdown(elStartTime, 6, 21, permit.start_time_limit || "08:00");
    }
    if (elEndTime) {
      populateTimeDropdown(elEndTime, 6, 21, permit.end_time_limit || "17:00");
    }

    const elInfo = document.getElementById("edit-wali-permit-info");
    if (elInfo) {
      elInfo.textContent = `Mengedit pengajuan izin untuk ${permit.nama} (${formatIndonesianDate(permit.start_date)})`;
    }

    window.openModal("modal-edit-wali-permit");
  };

  /**
   * Menyimpan perubahan pengajuan izin setelah diedit
   */
  window.submitEditWaliPermit = async function(event) {
    if (event) event.preventDefault();

    const requestId = window.editingPermitId;
    if (!requestId) return window.showToast("Sesi edit berakhir. Silakan coba lagi.", "error");

    const permits = appState.permits || [];
    const permitIndex = permits.findIndex(p => p && String(p.id) === String(requestId));

    if (permitIndex === -1) {
      return window.showToast("Data pengajuan tidak ditemukan.", "error");
    }

    const permit = permits[permitIndex];

    if (!isPermitOwnedByCurrentWali(permit)) {
      window.editingPermitId = null;
      return window.showToast("Anda tidak dapat mengedit pengajuan santri lain.", "error");
    }

    if (permit.status !== 'pending') {
      return window.showToast("Hanya pengajuan dengan status 'Menunggu' yang dapat diedit.", "warning");
    }

    const form = document.getElementById("edit-wali-permit-form");
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const namaWali = document.getElementById("edit-wali-permit-nama-wali").value.trim();
    const alamatWali = document.getElementById("edit-wali-permit-alamat-wali").value.trim();
    const category = document.getElementById("edit-wali-permit-category").value;
    const reason = document.getElementById("edit-wali-permit-reason").value.trim();
    const date = document.getElementById("edit-wali-permit-date").value;
    const startTime = document.getElementById("edit-wali-permit-start-time").value;
    const endTime = document.getElementById("edit-wali-permit-end-time").value;
    const destination = document.getElementById("edit-wali-permit-destination").value.trim();

    if (startTime >= endTime) {
      return window.showToast("Jam kembali harus setelah jam keluar.", "warning");
    }

    permit.nama_wali = namaWali;
    permit.alamat_wali = alamatWali;
    permit.category = category;
    permit.reason = reason;
    permit.start_date = date;
    permit.end_date = date;
    permit.start_time_limit = startTime;
    permit.end_time_limit = endTime;
    permit.destination = destination;
    permit.location = destination;
    permit.updated_at = new Date().toISOString();
    permit.status_label = category === 'sakit' ? 'S' : 'P';

    persistSinglePermit(permit);

    window.editingPermitId = null;

    window.showToast("Pengajuan izin berhasil diperbarui!", "success");
    window.closeModal("modal-edit-wali-permit");
    window.loadWaliPermitHistory();
    window.refreshPermitSurfaces?.();
  };

  /**
   * Konfirmasi pembatalan pengajuan izin
   */
  window.confirmDeleteWaliPermit = function(requestId) {
    const permits = appState.permits || [];
    const permit = permits.find(p => p && String(p.id) === String(requestId));

    if (!permit) {
      return window.showToast("Data pengajuan tidak ditemukan.", "error");
    }

    if (!isPermitOwnedByCurrentWali(permit)) {
      return window.showToast("Anda tidak dapat membatalkan pengajuan santri lain.", "error");
    }

    if (permit.status !== 'pending') {
      return window.showToast("Hanya pengajuan dengan status 'Menunggu' yang dapat dibatalkan.", "warning");
    }

    window.deletingPermitId = requestId;

    document.getElementById("delete-permit-nama").textContent = permit.nama;
    document.getElementById("delete-permit-reason").textContent = permit.reason;
    document.getElementById("delete-permit-date").textContent = formatIndonesianDate(permit.start_date);

    window.openModal("modal-delete-wali-permit");
  };

  /**
   * Menghapus/batalkan pengajuan izin
   */
  window.executeDeleteWaliPermit = function() {
    const requestId = window.deletingPermitId;
    if (!requestId) return window.showToast("Sesi penghapusan berakhir. Silakan coba lagi.", "error");

    const permits = appState.permits || [];
    const permitIndex = permits.findIndex(p => p && String(p.id) === String(requestId));

    if (permitIndex === -1) {
      return window.showToast("Data pengajuan tidak ditemukan.", "error");
    }

    const permit = permits[permitIndex];

    if (!isPermitOwnedByCurrentWali(permit)) {
      window.deletingPermitId = null;
      window.closeModal("modal-delete-wali-permit");
      return window.showToast("Anda tidak dapat membatalkan pengajuan santri lain.", "error");
    }

    if (permit.status !== 'pending') {
      window.closeModal("modal-delete-wali-permit");
      return window.showToast("Hanya pengajuan dengan status 'Menunggu' yang dapat dibatalkan.", "warning");
    }

    appState.permits = permits.filter(p => String(p?.id) !== String(requestId));
    if (window.storageManager?.deletePermit) {
      window.storageManager.deletePermit(requestId);
    } else {
      persistPermitList(appState.permits);
    }

    window.deletingPermitId = null;

    window.showToast("Pengajuan izin berhasil dibatalkan.", "success");
    window.closeModal("modal-delete-wali-permit");
    window.loadWaliPermitHistory();
    window.refreshPermitSurfaces?.();
  };

  /**
   * Tutup modal edit tanpa menyimpan
   */
  window.closeEditWaliPermitModal = function() {
    window.editingPermitId = null;
    window.closeModal("modal-edit-wali-permit");
  };

  /**
   * Tutup modal hapus tanpa menghapus
   */
  window.closeDeleteWaliPermitModal = function() {
    window.deletingPermitId = null;
    window.closeModal("modal-delete-wali-permit");
  };

  // =========================================================================
  // 2. FUNGSI UNTUK MUSYRIF (PERSETUJUAN IZIN)
  // =========================================================================

  const permitDebugLog = (...args) => {
    if (localStorage.getItem("DEBUG_LOGS") === "true" || location.search.includes("debug=true")) {
      console.log(...args);
    }
  };

  let currentPendingRequests = [];

  /**
   * Inisialisasi listener untuk Musyrif
   */
  window.initPermitRequestListener = function() {
    const kelas = appState.selectedClass;
    if (!kelas) return;

    permitDebugLog(`[PermitRequestManager] Loading requests for Class ${kelas}`);
    loadMusyrifRequests();
  };

  /**
   * Load requests for musyrif from localStorage
   */
  function loadMusyrifRequests() {
    const kelas = appState.selectedClass;
    if (!kelas) {
      permitDebugLog("[PermitRequestManager] loadMusyrifRequests skipped: no class selected");
      return;
    }

    permitDebugLog("[PermitRequestManager] loadMusyrifRequests called for class:", kelas);

    let permits = dedupePermits(appState.permits || []);
    permitDebugLog("[PermitRequestManager] Permits from appState:", permits.length);

    // Also try to load from localStorage directly for fresh data
    try {
      const storedPermits = localStorage.getItem('musyrif_permits_db');
      if (storedPermits) {
        const parsed = JSON.parse(storedPermits);
        const parsedArray = Array.isArray(parsed)
          ? parsed
          : (parsed && typeof parsed === 'object' ? Object.values(parsed) : []);

        if (parsedArray.length > 0) {
          permitDebugLog("[PermitRequestManager] Permits from localStorage:", parsedArray.length);
          permits = dedupePermits([...permits, ...parsedArray]);
          appState.permits = permits;
        }
      }
    } catch (e) {
      console.warn("[PermitRequestManager] Error loading permits from storage:", e);
    }

    currentPendingRequests = permits.filter(r =>
      r && r.status === "pending" && isPermitInSelectedMusyrifClass(r)
    );

    permitDebugLog("[PermitRequestManager] Pending requests:", currentPendingRequests.length);

    currentPendingRequests.forEach(req => {
      const studentInfo = getPermitStudent(req);
      if (!req.nama) req.nama = studentInfo?.nama || "Santri";
      if (!req.kelas) req.kelas = studentInfo?.kelas || studentInfo?.rombel || appState.selectedClass || "";
    });

    renderMusyrifApprovalWidget(currentPendingRequests.length);
  }

  window.loadMusyrifRequests = loadMusyrifRequests;

  /**
   * Merender Widget Badge Pending Izin di Dasbor Musyrif
   */
  function renderMusyrifApprovalWidget(count) {
    const elWidget = document.getElementById("musyrif-approval-widget");
    if (!elWidget) return;

    if (count === 0) {
      elWidget.classList.add("hidden");
      return;
    }

    elWidget.classList.remove("hidden");

    const elCount = document.getElementById("approval-pending-count");
    const elBadge = document.getElementById("approval-pending-badge");

    if (elCount) elCount.textContent = `${count} Pengajuan Menunggu Persetujuan`;
    if (elBadge) elBadge.textContent = count;

    if (count > 0 && window.showToast) {
      window.showToast(`Ada ${count} pengajuan izin yang menunggu persetujuan`, 'info', false, 3000);
    }
  }

  window.renderMusyrifApprovalWidget = renderMusyrifApprovalWidget;

  // Polling functions for local-only mode
  window.startApprovalPolling = function() {
    permitDebugLog("[PermitRequestManager] Polling started (local-only mode)");
    loadMusyrifRequests();
  };

  window.stopApprovalPolling = function() {
    permitDebugLog("[PermitRequestManager] Polling stopped");
  };

  /**
   * Membuka modal daftar persetujuan Musyrif
   */
  window.openMusyrifApprovalModal = function() {
    loadMusyrifRequests();
    window.updateMusyrifApprovalModalList();
    window.openModal("modal-musyrif-approval");
  };

  /**
   * Mengupdate isi daftar persetujuan Musyrif di dalam modal
   */
  window.updateMusyrifApprovalModalList = function() {
    const container = document.getElementById("musyrif-approval-list");
    if (!container) return;

    if (currentPendingRequests.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mb-2 text-emerald-500 opacity-80"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/><path d="m9 12 2 2 4-4"/></svg>
          <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Semua Pengajuan Selesai</p>
          <p class="text-[10px] mt-0.5 text-slate-400">Tidak ada permohonan izin yang menunggu persetujuan.</p>
        </div>
      `;
      setTimeout(() => {
        window.closeModal("modal-musyrif-approval");
      }, 1500);
      return;
    }

    container.innerHTML = "";

    currentPendingRequests.forEach(req => {
      const el = document.createElement("div");
      el.className = "p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3";

      const formattedDate = formatIndonesianDate(req.start_date);
      const categoryLabel = req.category === "sakit" ? "Sakit / Medis" : "Izin / Pulang";
      const badgeColor = req.category === "sakit"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200/50"
        : "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200/50";

      el.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <div>
            <h4 class="text-sm font-black text-slate-800 dark:text-white leading-tight">${window.sanitizeHTML(req.nama)}</h4>
            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">NIS: ${req.nis}</span>
          </div>
          <span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${badgeColor}">${categoryLabel}</span>
        </div>

        <div class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <p><strong>Wali:</strong> ${window.sanitizeHTML(req.nama_wali)} (${window.sanitizeHTML(req.alamat_wali || '-')})</p>
          <p><strong>Keperluan:</strong> <span class="text-slate-800 dark:text-slate-200 font-medium">${window.sanitizeHTML(req.reason)}</span></p>
          <p><strong>Waktu:</strong> ${formattedDate} (${req.start_time_limit} - ${req.end_time_limit} WIB)</p>
          <p><strong>Tujuan:</strong> ${window.sanitizeHTML(req.destination || req.location || '')}</p>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-1">
          <button onclick="window.processPermitRequest('${req.id}', 'reject')" class="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all active:scale-95">
            Tolak
          </button>
          <button onclick="window.processPermitRequest('${req.id}', 'approve')" class="py-2 px-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95">
            Setujui
          </button>
        </div>
      `;
      container.appendChild(el);
    });
  };

  /**
   * Menangani persetujuan atau penolakan pengajuan izin oleh Musyrif
   */
  window.processPermitRequest = function(requestId, action) {
    if (!appState.permits) appState.permits = [];
    const permitIndex = appState.permits.findIndex(p => p && String(p.id) === String(requestId));
    if (permitIndex === -1) {
      return window.showToast("Data pengajuan tidak ditemukan.", "error");
    }

    const permit = appState.permits[permitIndex];
    const musyrifName = appState.userProfile?.name || "Musyrif";

    if (!isPermitInSelectedMusyrifClass(permit)) {
      return window.showToast("Pengajuan ini bukan dari kelas binaan Anda.", "error");
    }

    if (permit.status !== "pending") {
      return window.showToast("Pengajuan ini sudah diproses.", "warning");
    }

    if (action === "approve") {
      permit.status = "approved";
      permit.approvedBy = musyrifName;
      permit.approvedAt = new Date().toISOString();
      permit.is_active = true;
      if (!permit.audit_trail) permit.audit_trail = [];
      permit.audit_trail.push({ action: "Disetujui", by: musyrifName, time: new Date().toISOString() });
      persistSinglePermit(permit);

      notifyUser(
        "wali",
        permit.nis,
        "Status Izin Disetujui",
        `Pengajuan izin untuk ${permit.nama} (${permit.category}) telah disetujui oleh Musyrif.`,
        "permit",
        "tab=home"
      );

      window.showToast("Izin berhasil disetujui!", "success");
    } else if (action === "reject") {
      permit.status = "rejected";
      permit.rejectedBy = musyrifName;
      permit.rejectedAt = new Date().toISOString();
      permit.is_active = false;
      if (!permit.audit_trail) permit.audit_trail = [];
      permit.audit_trail.push({ action: "Ditolak", by: musyrifName, time: new Date().toISOString() });
      persistSinglePermit(permit);

      notifyUser(
        "wali",
        permit.nis,
        "Status Izin Ditolak",
        `Pengajuan izin untuk ${permit.nama} (${permit.category}) ditolak oleh Musyrif.`,
        "permit",
        "tab=home"
      );

      window.showToast("Pengajuan izin ditolak.", "info");
    }

    window.refreshPermitSurfaces?.();

    currentPendingRequests = currentPendingRequests.filter(r => String(r.id) !== String(requestId));
    window.updateMusyrifApprovalModalList();
  };
  window.loadMusyrifRequests = loadMusyrifRequests;

})();
