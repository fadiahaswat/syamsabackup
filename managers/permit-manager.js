// File: permit-manager.js

// ==========================================
// FITUR PERIZINAN / SAKIT (DURASI)
// ==========================================

// --- CENTRALIZED PERMIT THEMES (extracted to avoid duplication) ---
const PERMIT_THEMES = {
  sakit: {
    icon: "thermometer",
    iconBg: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    catLabel: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  izin: {
    icon: "calendar",
    iconBg: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    catLabel: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  pulang: {
    icon: "bus",
    iconBg: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-800",
    catLabel: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  },
};
window.PERMIT_THEMES = PERMIT_THEMES;

// --- UTILITY FUNCTIONS ---
window.fileToBase64 = function(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// --- FITUR PERIZINAN (UPDATED) ---

// Variable state tambahan
let currentPermitTab = "sakit";

// 1. Fungsi Buka Modal & Setup Tab
// Variable global untuk mode modal saat ini
let currentModalMode = "daily"; // 'daily' atau 'pulang'

// Update fungsi Open Modal untuk menerima parameter mode
let isAllSelected = false;

window.openPermitModal = function (mode = "daily") {
  if (!appState.selectedClass)
    return window.showToast("Pilih kelas terlebih dahulu!", "warning");

  // RESET STATE
  isAllSelected = false;
  currentModalMode = mode;

  const modal = document.getElementById("modal-permit");
  const btnSelect = document.getElementById("btn-select-all-permit");
  if (btnSelect) btnSelect.textContent = "Pilih Semua";

  const tabSakit = document.getElementById("tab-btn-sakit");
  const tabIzin = document.getElementById("tab-btn-izin");
  const tabPulang = document.getElementById("tab-btn-pulang");
  const modalTitle = modal.querySelector("h3");
  const modalDesc = modal.querySelector("p");

  tabSakit.classList.remove("hidden");
  tabIzin.classList.remove("hidden");
  tabPulang.classList.remove("hidden");

  if (mode === "daily") {
    // Tab Pulang tetap muncul di mode daily
    window.setPermitTab("sakit");
    if (modalTitle) modalTitle.textContent = "Input Perizinan Harian";
    if (modalDesc) modalDesc.textContent = "Sakit, Izin & Pulang";
  } else {
    tabSakit.classList.add("hidden");
    tabIzin.classList.add("hidden");
    window.setPermitTab("pulang");
    if (modalTitle) modalTitle.textContent = "Manajemen Perpulangan";
    if (modalDesc) modalDesc.textContent = "Izin Pulang & Liburan";
  }

  document.getElementById("permit-search-santri").value = "";
  window.renderPermitChecklist(FILTERED_SANTRI);
  window.updatePermitCount();
  window.renderPermitList();

  window.openModal("modal-permit"); // Use improved modal function
};

window.renderPermitChecklist = function (list) {
  const container = document.getElementById("permit-santri-checklist");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((s) => {
    const id = String(s.nis || s.id);
    const div = document.createElement("label");
    div.className =
      "flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-emerald-500 transition-all group select-none";
    div.innerHTML = `
            <input type="checkbox" name="permit_santri_select" value="${id}" onchange="window.updatePermitCount()" class="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 rounded-md cursor-pointer accent-emerald-500">
            <span class="text-xs font-bold text-slate-600 dark:text-slate-300 truncate group-hover:text-slate-800 dark:group-hover:text-white">${window.sanitizeHTML(s.nama)}</span>
        `;
    container.appendChild(div);
  });
};

window.filterPermitSantri = function (val) {
  const search = val.toLowerCase();
  const filtered = FILTERED_SANTRI.filter((s) =>
    s.nama.toLowerCase().includes(search),
  );
  window.renderPermitChecklist(filtered);
};

window.updatePermitCount = function () {
  const checked = document.querySelectorAll(
    'input[name="permit_santri_select"]:checked',
  ).length;
  const el = document.getElementById("permit-selected-count");
  if (el) el.textContent = checked;
};

window.persistPermits = window.persistPermits || function () {
  // Always save to localStorage as primary storage
  localStorage.setItem(APP_CONFIG.permitKey, JSON.stringify(appState.permits || []));

  // Use HybridStorageManager if cloud mode is enabled
  if (window.APP_STORAGE?.mode !== 'local-only' && window.hybridStorageManager?.isInitialized) {
    // Save each permit individually to enable proper sync
    const permits = appState.permits || [];
    permits.forEach(permit => {
      window.hybridStorageManager.savePermit(permit).catch(err => {
        console.error('[PermitManager] Hybrid save error:', err);
      });
    });
  } else if (window.storageManager) {
    // Local-only mode: use traditional storage manager
    window.storageManager.savePermits(appState.permits || []).catch(err => {
      console.error('[PermitManager] Save error:', err);
    });
  }
};

window.refreshPermitSurfaces = window.refreshPermitSurfaces || function () {
  window.renderPermitList?.();
  window.renderActivePermitsWidget?.();
  window.renderPermitHistory?.();
  window.filterPermitsTabList?.();
  window.renderAttendanceList?.();
  window.updateDashboard?.();
};

window.getPermitSlotIdForView = window.getPermitSlotIdForView || function () {
  return appState.activeAttendanceSlotId || appState.currentSlotId;
};

window.getPermitRuntimeState = window.getPermitRuntimeState || function (
  permit,
  currentDateStr = appState.date,
  currentSlotId = window.getPermitSlotIdForView?.() || appState.currentSlotId || "shubuh",
) {
  if (!permit || !currentDateStr) {
    return { relevant: false, active: false, evaluated: null };
  }

  // Fallback slotId jika tidak ada
  const effectiveSlotId = currentSlotId || "shubuh";

  const status = String(permit.status || "approved").toLowerCase();
  if (status !== "approved") return { relevant: false, active: false, evaluated: null };
  if (permit.start_date && permit.start_date > currentDateStr) {
    return { relevant: false, active: false, evaluated: null };
  }

  const evaluated = window.evaluatePermitForSlot?.(
    permit,
    currentDateStr,
    effectiveSlotId,
  ) || null;
  const hasReachedDate =
    !permit.start_date || currentDateStr >= permit.start_date;
  const inDateRange =
    hasReachedDate &&
    (!permit.end_date ||
      (currentDateStr >= permit.start_date && currentDateStr <= permit.end_date));
  const relevant = Boolean(inDateRange || evaluated);
  const active = permit.is_active !== false && Boolean(evaluated);

  return { relevant, active, evaluated };
};

window.deletePermit = function (id) {
  window.showConfirmModal(
    "Hapus Data Izin?",
    "Status kehadiran santri akan dikembalikan ke default.",
    "Hapus",
    "Batal",
    async () => {
  appState.permits = appState.permits.filter((p) => p.id !== id);

  // Use HybridStorageManager if cloud mode is enabled
  if (window.APP_STORAGE?.mode !== 'local-only' && window.hybridStorageManager?.isInitialized) {
    await window.hybridStorageManager.deletePermit(id).catch(err => {
      console.error('[PermitManager] Delete permit error:', err);
    });
  }

  window.persistPermits();

  window.showToast("Data izin dihapus", "info");
  window.refreshPermitSurfaces();
    },
  );
};

window.renderPermitList = function () {
  const container = document.getElementById("permit-list-container");
  container.innerHTML = "";

  const classNisList = FILTERED_SANTRI.map((s) => String(s.nis || s.id));
  // Filter izin aktif milik kelas ini
  let activePermits = (appState.permits || []).filter((p) => {
    const isMyClass = classNisList.includes(String(p.nis));
    const runtime = window.getPermitRuntimeState(p);
    return isMyClass && runtime.active;
  });

  if (currentModalMode === "daily") {
    activePermits = activePermits.filter(
      (p) => p.category === "sakit" || p.category === "izin",
    );
  } else {
    activePermits = activePermits.filter((p) => p.category === "pulang");
  }

  if (activePermits.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-10 px-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm text-center w-full">
        <div class="w-12 h-12 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-3 text-slate-450 dark:text-slate-500">
          <i data-lucide="shield-check" class="w-6 h-6"></i>
        </div>
        <p class="text-xs font-bold text-slate-500 dark:text-slate-400">Semua santri lengkap / Hadir</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  activePermits.forEach((p) => {
    const santri = FILTERED_SANTRI.find((s) => String(s.nis || s.id) === p.nis);
    if (!santri) return;

    // Tampilan Beda Tiap Kategori
    let badgeColor = "bg-slate-100 text-slate-600";
    let detailText = "";
    let actionBtn = "";

    if (p.category === "sakit") {
      badgeColor = "bg-amber-100 text-amber-600 border border-amber-200";
      detailText = `Mulai: ${window.formatDate(p.start_date)} (${p.start_session}) • ${p.location}`;
      // Tombol Sembuh
      actionBtn = `<button onclick="window.markAsRecovered('${p.id}')" class="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow hover:bg-emerald-600">Sembuh</button>`;
    } else {
      if (p.category === "izin")
        badgeColor = "bg-blue-100 text-blue-600 border border-blue-200";
      else
        badgeColor = "bg-purple-100 text-purple-600 border border-purple-200";

      detailText = `Sampai: ${window.formatDate(p.end_date)} ${p.end_time_limit}`;

      // Tombol Perpanjang / Sudah Kembali
      actionBtn = `
                <div class="flex gap-1">
                    <button onclick="window.extendPermit('${p.id}')" class="px-2 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-[10px] font-bold">Perpanjang</button>
                    <button onclick="window.markAsReturned('${p.id}')" class="px-2 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold">Kembali</button>
                </div>
            `;
    }

    const div = document.createElement("div");
    div.className =
      "p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex flex-wrap justify-between items-start gap-3";
    div.innerHTML = `
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${badgeColor}">${window.sanitizeHTML(p.category)}</span>
                    <span class="font-bold text-slate-800 dark:text-white text-xs">${window.sanitizeHTML(santri.nama)}</span>
                </div>
                <p class="text-[10px] font-bold text-slate-500">${window.sanitizeHTML(p.reason)}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">${window.sanitizeHTML(detailText)}</p>
            </div>
            <div class="flex flex-col gap-1 items-end">
                ${actionBtn}
                <button onclick="window.deletePermit('${p.id}')" class="text-[9px] text-red-400 underline mt-1">Hapus Data</button>
            </div>
        `;
    container.appendChild(div);
  });
};

window.evaluatePermitForSlot = function (permit, currentDateStr, currentSlotId) {
  // Sesi Absensi dengan Jam Mulai dan Jam Selesai
  const SLOT_HOURS = {
    shubuh: { start: 4, end: 6 },
    sekolah: { start: 6, end: 15 },
    ashar: { start: 15, end: 17 },
    maghrib: { start: 18, end: 19 },
    isya: { start: 19, end: 21 }
  };

  // --- LOGIKA SAKIT ---
  if (permit.category === "sakit") {
    // Validasi Awal Tanggal
    if (currentDateStr < permit.start_date) return null;
    if (
      currentDateStr === permit.start_date &&
      SESSION_ORDER[currentSlotId] < SESSION_ORDER[permit.start_session]
    )
      return null;

    // Validasi Sembuh (End Date)
    if (permit.end_date) {
      // Jika sudah lewat tanggal sembuh -> Sehat
      if (currentDateStr > permit.end_date) return null;

      // Jika hari ini tanggal sembuh, cek sesinya
      if (currentDateStr === permit.end_date && permit.end_session) {
        // Logic: Jika sesi sekarang SUDAH MELEWATI atau SAMA DENGAN sesi sembuh -> Sehat
        // Contoh: End Session = Shubuh. Buka Ashar (2) > Shubuh (1) -> Sehat.
        // Tapi tunggu, "End Session" biasanya menandakan sesi TERAKHIR dia sakit.
        // Jadi: Jika Sesi Sekarang > Sesi Terakhir Sakit, maka Null.
        if (SESSION_ORDER[currentSlotId] > SESSION_ORDER[permit.end_session]) {
          return null;
        }
      }
    }
    return {
      type: "Sakit",
      label: "S",
      end: permit.end_date,
      note: `[Sakit] ${permit.reason}`,
    };
  }

  // --- LOGIKA IZIN & PULANG ---
  else {
    if (currentDateStr < permit.start_date) return null;

    // Cek Waktu Mulai Izin (jika hari ini mulai izin dan ada jam mulai spesifik)
    if (currentDateStr === permit.start_date && permit.start_time_limit) {
      const startTime = permit.start_time_limit;
      const startHour = parseInt(startTime.split(":")[0]);
      const slotConfig = SLOT_HOURS[currentSlotId];
      if (slotConfig && slotConfig.end <= startHour) {
        return null; // Sesi absensi berakhir sebelum izin dimulai
      }
    }

    // Cek jika start_session ada (metode izin presensi manual musyrif)
    if (
      currentDateStr === permit.start_date &&
      permit.start_session &&
      SESSION_ORDER[currentSlotId] < SESSION_ORDER[permit.start_session]
    ) {
      return null;
    }

    // Cek Deadline Kembali
    if (currentDateStr > permit.end_date) {
      return {
        type: "Alpa",
        label: "A",
        end: permit.end_date,
        note: `[Terlambat] Deadline ${window.formatDate(permit.end_date)}`,
      };
    }

    if (currentDateStr === permit.end_date) {
      const deadlineTime = permit.end_time_limit || "17:00";
      const deadlineHour = parseInt(deadlineTime.split(":")[0]);
      const slotConfig = SLOT_HOURS[currentSlotId];

      // Jika sesi absensi dimulai pada atau setelah jam deadline kembali -> Alpa
      if (slotConfig && slotConfig.start >= deadlineHour) {
        return {
          type: "Alpa",
          label: "A",
          end: permit.end_date,
          note: `[Terlambat] Deadline jam ${deadlineTime}`,
        };
      }
    }

    const cat = (permit.category || "").toLowerCase();
    const label = cat === "pulang" ? "Pulang" : "Izin";
    const code = cat === "pulang" ? "P" : "I";

    return {
      type: label,
      label: code,
      end: permit.end_date,
      note: `[${label}] ${permit.reason}`,
    };
  }
};

window.checkActivePermit = function (nis, currentDateStr, currentSlotId) {
  const activePermits = (appState.permits || [])
    .filter((p) => {
      const status = String(p.status || "approved").toLowerCase();
      return (
        String(p.nis) === String(nis) &&
        p.is_active &&
        status === "approved"
      );
    })
    .sort((a, b) => {
      const byStart = String(b.start_date || "").localeCompare(
        String(a.start_date || ""),
      );
      if (byStart !== 0) return byStart;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  for (const permit of activePermits) {
    const evaluated = window.evaluatePermitForSlot(
      permit,
      currentDateStr,
      currentSlotId,
    );
    if (evaluated) {
      return {
        ...evaluated,
        permitId: permit.id,
        category: permit.category,
      };
    }
  }

  return null;
};


window.setPermitTab = function (tab) {
  currentPermitTab = tab;

  // 1. Reset Semua Input Form agar bersih
  const inputsToReset = ["permit-reason", "permit-pickup", "permit-vehicle"];
  inputsToReset.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset Date ke Default Tanggal Yang Sedang Dilihat (User Friendly)
  const defaultDate = appState.date || window.getLocalDateStr();
  document.getElementById("permit-start-date").value = defaultDate;
  document.getElementById("permit-end-date").value = defaultDate;
  document.getElementById("permit-start-session").value = "shubuh";

  // 2. UI Update (Sama seperti sebelumnya)
  document.querySelectorAll(".permit-tab").forEach((btn) => {
    btn.className =
      "permit-tab flex-1 py-2 rounded-lg text-xs font-bold transition-all text-slate-500 hover:bg-slate-50";
  });
  const activeBtn = document.getElementById(`tab-btn-${tab}`);

  // Warna Tab
  if (tab === "sakit")
    activeBtn.className =
      "permit-tab flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-amber-50 text-amber-600 shadow-sm border border-amber-100";
  else if (tab === "izin")
    activeBtn.className =
      "permit-tab flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-blue-50 text-blue-600 shadow-sm border border-blue-100";
  else if (tab === "pulang")
    activeBtn.className =
      "permit-tab flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-purple-50 text-purple-600 shadow-sm border border-purple-100";

  // Show/Hide Fields
  const fieldEnd = document.getElementById("field-end-time");
  const fieldLoc = document.getElementById("field-location");
  const fieldTrans = document.getElementById("field-transport");
  const infoSakit = document.getElementById("info-sakit");
  const btnSelectAll = document.getElementById("btn-select-all-permit");
  const listReasons = document.getElementById("reasons-list");
  const lblReason = document.getElementById("lbl-reason");

  listReasons.innerHTML = ""; // Reset suggestion

  if (tab === "sakit") {
    lblReason.textContent = "Sakit Apa?";
    fieldEnd.classList.add("hidden");
    fieldLoc.classList.remove("hidden");
    fieldTrans.classList.add("hidden");
    infoSakit.classList.remove("hidden");

    // Setup tanggal selesai sakit default (hari ini + 2 hari)
    const endDateInput = document.getElementById("permit-end-date-sick");
    if (endDateInput) {
      const startDateVal = document.getElementById("permit-start-date")?.value || window.getLocalDateStr();
      const startDate = new Date(startDateVal);
      startDate.setDate(startDate.getDate() + 2); // Default 2 hari
      endDateInput.value = window.getLocalDateStr(startDate);
      endDateInput.min = startDateVal;
      // Maksimal 7 hari dari mulai
      const maxDate = new Date(startDateVal);
      maxDate.setDate(maxDate.getDate() + 7);
      endDateInput.max = window.getLocalDateStr(maxDate);
    }

    // Setup event listener untuk update durasi info
    setTimeout(() => {
      const endDateInput = document.getElementById("permit-end-date-sick");
      const startDateInput = document.getElementById("permit-start-date");
      const durationInfo = document.getElementById("sick-duration-info");
      const fieldSuratDokter = document.getElementById("field-surat-dokter");

      const updateDurationInfo = () => {
        if (!startDateInput?.value || !endDateInput?.value || !durationInfo) return;

        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays <= 0) {
          durationInfo.textContent = "";
          fieldSuratDokter?.classList.add("hidden");
          return;
        }

        if (diffDays === 1) {
          durationInfo.textContent = "Durasi: 1 hari";
        } else {
          durationInfo.textContent = `Durasi: ${diffDays} hari`;
        }

        // Tampilkan field surat dokter jika lebih dari 2 hari
        if (diffDays > 2) {
          fieldSuratDokter?.classList.remove("hidden");
        } else {
          fieldSuratDokter?.classList.add("hidden");
        }
      };

      endDateInput?.addEventListener("change", updateDurationInfo);
      startDateInput?.addEventListener("change", () => {
        if (endDateInput) {
          const startDate = new Date(startDateInput.value);
          startDate.setDate(startDate.getDate() + 2);
          endDateInput.value = window.getLocalDateStr(startDate);
          endDateInput.min = startDateInput.value;
        }
        updateDurationInfo();
      });

      updateDurationInfo();
    }, 100);

    [
      "Demam",
      "Flu/Batuk",
      "Sakit Gigi",
      "Diare",
      "Tifus",
      "Cacar",
      "Maag",
      "Kecapekan",
    ].forEach((r) => {
      listReasons.innerHTML += `<option value="${r}">`;
    });
  } else {
    // Logic Izin & Pulang
    fieldEnd.classList.remove("hidden");
    fieldLoc.classList.add("hidden");
    infoSakit.classList.add("hidden");

    if (tab === "izin") {
      lblReason.textContent = "Keperluan Apa?";
      fieldTrans.classList.add("hidden");
      [
        "Acara Keluarga",
        "Menikah",
        "Wisuda Kakak",
        "Lomba",
        "Tugas Madrasah",
        "Check-up Dokter",
      ].forEach((r) => {
        listReasons.innerHTML += `<option value="${r}">`;
      });
    } else {
      lblReason.textContent = "Jenis Kepulangan?";
      fieldTrans.classList.remove("hidden");
      [
        "Pulang Bulanan",
        "Libur Semester",
        "Libur Lebaran",
        "Pulang Sakit Panjang",
      ].forEach((r) => {
        listReasons.innerHTML += `<option value="${r}">`;
      });
    }
  }
};

// 3. Logic Simpan Data (Advanced)
window.savePermitLogic = async function () {
  const checkboxes = document.querySelectorAll(
    'input[name="permit_santri_select"]:checked',
  );
  const selectedNis = Array.from(checkboxes).map((cb) => cb.value);

  if (selectedNis.length === 0)
    return window.showToast("Pilih minimal 1 santri", "warning");

  const reason = document.getElementById("permit-reason").value;
  const startDate = document.getElementById("permit-start-date").value;
  const startSession = document.getElementById("permit-start-session").value;
  const todayStr = window.getLocalDateStr();

  if (!reason) return window.showToast("Isi alasannya dulu", "warning");
  if (!startDate)
    return window.showToast("Tanggal mulai wajib diisi", "warning");

  // VALIDASI: Sakit tidak bisa direncanakan untuk masa depan
  if (currentPermitTab === "sakit" && startDate > todayStr) {
    return window.showToast("Sakit tidak bisa direncanakan! Input untuk hari ini atau sebelumnya.", "warning");
  }

  let permitData = {
    category: currentPermitTab, // sakit, izin, pulang
    reason: reason,
    start_date: startDate,
    start_session: startSession,
    timestamp: new Date().toISOString(),
    is_active: true, // Flag utama
  };

  // Tambahan Data per Kategori
  if (currentPermitTab === "sakit") {
    const endDateSick = document.getElementById("permit-end-date-sick")?.value;
    const location = document.querySelector('input[name="loc_sakit"]:checked')?.value || "Asrama";

    // Hitung durasi sakit
    const startDateObj = new Date(startDate);
    const endDateObj = endDateSick ? new Date(endDateSick) : new Date(startDate);
    endDateObj.setDate(endDateObj.getDate() + 1); // Inclusive
    const diffDays = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;

    // VALIDASI: Jika lebih dari 2 hari, harus ada surat dokter
    let suratDokterUrl = null;
    if (diffDays > 2) {
      const suratDokterFile = document.getElementById("permit-surat-dokter")?.files[0];
      if (!suratDokterFile) {
        return window.showToast("Sakit lebih dari 2 hari wajib upload surat dokter!", "warning");
      }
      // Upload using FileUploadManager (supports Supabase Storage + local fallback)
      try {
        if (window.fileUploadManager) {
          // Generate temporary permit ID for upload
          const tempPermitId = `temp_${Date.now()}`;
          const userId = window.supabaseClient?.getUser()?.id || 'anonymous';
          const uploadResult = await window.fileUploadManager.uploadDocument(
            userId,
            tempPermitId,
            suratDokterFile
          );
          suratDokterUrl = uploadResult.finalUrl;
        } else {
          // Fallback to direct base64 conversion
          suratDokterUrl = await window.fileToBase64(suratDokterFile);
        }
      } catch (e) {
        return window.showToast("Gagal upload surat dokter. Coba lagi.", "error");
      }
    }

    permitData.location = location;
    permitData.end_date = endDateSick || startDate; // Default sama dengan start
    permitData.end_session = null;
    permitData.status_label = "S";
    permitData.requires_surat_dokter = diffDays > 2;
    permitData.surat_dokter = suratDokterUrl;
  } else {
    // IZIN & PULANG: Punya Deadline
    const endDate = document.getElementById("permit-end-date").value;
    const endTime = document.getElementById("permit-end-time").value;

    if (!endDate)
      return window.showToast("Tanggal selesai wajib diisi", "warning");
    if (endDate < startDate)
      return window.showToast("Tanggal selesai error", "error");

    permitData.end_date = endDate;
    permitData.end_time_limit = endTime;

    if (currentPermitTab === "izin") {
      permitData.status_label = "I";
    } else {
      permitData.status_label = "P";
      permitData.pickup = document.getElementById("permit-pickup").value;
      permitData.vehicle = document.getElementById("permit-vehicle").value;
    }
  }

  // Simpan Loop
  const savedPermits = [];
  selectedNis.forEach((nis) => {
    const uniqueId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
    const newPermit = { ...permitData, id: uniqueId, nis: nis };
    appState.permits.push(newPermit);
    savedPermits.push(newPermit);
  });

  window.persistPermits();

  // SINKRONISASI: Jika sakit, sync ke SEMUA sesi untuk SETIAP sambutri
  if (currentPermitTab === "sakit" && savedPermits.length > 0) {
    // Sync untuk setiap permit yang disimpan
    savedPermits.forEach(permit => {
      window.syncSickPermitAcrossSessions(permit.id, startDate);
    });
    window.renderAttendanceList?.();
  }

  window.showToast(`${selectedNis.length} Data Berhasil Disimpan`, "success");

  // Reset Checkbox
  checkboxes.forEach((cb) => (cb.checked = false));
  window.updatePermitCount();

  // Refresh Dashboard jika tanggal relevan
  if (appState.date >= startDate) {
    window.refreshPermitSurfaces();
  } else {
    window.renderPermitList();
    window.renderActivePermitsWidget?.();
  }
};

window.getPreviousAttendanceSessionId = function (slotId) {
  const sessionKeys = [
    "kemarin",
    "shubuh",
    "sekolah",
    "ashar",
    "maghrib",
    "isya",
  ];
  const currentIndex = sessionKeys.indexOf(slotId);
  return currentIndex <= 0 ? "kemarin" : sessionKeys[currentIndex - 1];
};

window.markSickPermitRecoveredBeforeSlot = function (permitId, slotId) {
  const permit = appState.permits.find((p) => p.id === permitId);
  if (!permit || permit.category !== "sakit") return false;

  permit.end_date = appState.date;
  permit.end_session = window.getPreviousAttendanceSessionId(slotId);
  permit.is_active = true;
  window.persistPermits();
  return true;
};

// ==========================================
// SINKRONISASI SAKIT ANTAR SESI
// Memastikan sakit dari subuh tersinkron ke sekolah, ashar, maghrib, isya
// ==========================================

const SESSION_CHAIN_ORDER = ["shubuh", "sekolah", "ashar", "maghrib", "isya"];

/**
 * Sinkronkan status sakit ke semua sesi yang relevan dalam satu hari.
 * @param {string} permitId - ID permit sakit (opsional, jika null semua sakit aktif di-sync)
 * @param {string} targetDate - Tanggal target (default: appState.date)
 */
window.syncSickPermitAcrossSessions = function (permitId = null, targetDate = null) {
  const dateKey = targetDate || appState.date;
  if (!dateKey) return;

  // Tentukan sesi saat ini berdasarkan urutan
  const currentSlotId = appState.currentSlotId || window.determineCurrentSlot?.();
  const currentSessionIdx = currentSlotId ? SESSION_CHAIN_ORDER.indexOf(currentSlotId) : -1;

  // 1. Cari permit sakit yang perlu di-sync
  let permitsToSync = [];

  if (permitId) {
    // Sync permit spesifik
    const permit = appState.permits.find(p => p.id === permitId);
    if (permit && permit.category === "sakit") {
      permitsToSync.push(permit);
    }
  } else {
    // Sync semua permit sakit aktif untuk tanggal ini
    permitsToSync = (appState.permits || []).filter(p => {
      if (p.category !== "sakit") return false;
      if (p.status && p.status.toLowerCase() !== "approved") return false;

      // Cek tanggal relevan
      if (p.start_date && p.start_date > dateKey) return false;
      if (p.end_date && p.end_date < dateKey) return false;

      return true;
    });
  }

  if (permitsToSync.length === 0) return;

  // 2. Untuk setiap permit, sync ke sesi-sesi berikutnya
  let anyChanged = false; // Track changes globally for saveData
  permitsToSync.forEach(permit => {
    const nis = String(permit.nis);
    const startSession = permit.start_session || "shubuh";
    const startIdx = SESSION_CHAIN_ORDER.indexOf(startSession);

    // Tentukan sesi mana saja yang perlu di-sync (dari start_session sampai akhir hari)
    const sessionsToSync = SESSION_CHAIN_ORDER.filter((sessionId, idx) => {
      // Selalu sync sesi yang >= start_session
      if (idx < startIdx) return false;

      // Jika permitId spesifik diberikan (input sakit baru), WAJIB sync ke SEMUA sesi
      // dari start_session, termasuk sesi yang sudah lewat dan sudah ada datanya
      // Ini agar sakit "mulai dari Shubuh" bisa diterapkan ke Shubuh meskipun sudah lewat
      if (permitId) {
        return true; // Sync semua sesi dari start_session ke akhir
      }

      // Untuk sync umum (tanpa permitId - saat buka attendance view):
      // Sync sesi yang LEBIH DULU dari sesi saat ini tapi BELUM punya data
      // Ini untuk menangkap kasus "lompat sesi" (misal: dari Shubuh langsung ke Ashar)
      if (currentSessionIdx >= 0) {
        // Cek apakah sesi ini belum punya data attendance
        const slotData = appState.attendanceData?.[dateKey]?.[sessionId]?.[nis];
        const hasExistingData = slotData && Object.keys(slotData.status || {}).length > 0;

        // Jika sesi ini sudah punya data dan BUKAN sesi saat ini, skip
        if (hasExistingData && idx < currentSessionIdx) {
          return false;
        }
        // Jika sesi ini sudah punya data dan ADALAH sesi saat ini, skip juga (sudah ditangani)
        if (hasExistingData && idx === currentSessionIdx) {
          return false;
        }
      }

      return true;
    });

    // 3. Apply status sakit ke setiap sesi
    sessionsToSync.forEach(sessionId => {
      const slot = SLOT_WAKTU[sessionId];
      if (!slot) return;

      // Skip jika sesi ini libur di tanggal tersebut
      if (window.isSlotHoliday?.(sessionId, dateKey)) return;

      // Inisialisasi struktur data jika belum ada
      if (!appState.attendanceData) appState.attendanceData = {};
      if (!appState.attendanceData[dateKey]) appState.attendanceData[dateKey] = {};
      if (!appState.attendanceData[dateKey][sessionId]) {
        appState.attendanceData[dateKey][sessionId] = {};
      }

      const dbSlot = appState.attendanceData[dateKey][sessionId];
      if (!dbSlot[nis]) {
        dbSlot[nis] = { status: {}, note: "" };
      }

      const sData = dbSlot[nis];
      const hasPermitOverride = sData.permitManualOverride === true;

      // Jangan overwrite jika ada override manual
      if (hasPermitOverride) return;

      // Apply status sakit ke semua aktivitas wajib
      slot.activities.forEach(act => {
        // Skip jika aktivitas libur
        if (window.isActivityHoliday?.(dateKey, sessionId, act.id)) return;
        if (window.isCategoryHoliday?.(dateKey, act.category)) return;

        // Tentukan target status
        let targetStatus = "Tidak";
        if (["fardu", "kbm", "school"].includes(act.category)) {
          targetStatus = "Sakit";
        }

        if (sData.status[act.id] !== targetStatus) {
          sData.status[act.id] = targetStatus;
          anyChanged = true;
        }
      });

      // Update note dengan info sakit
      const autoNote = `[Auto] Sakit s/d ${window.formatDate(permit.end_date || 'belum sembuh')}`;
      if (!sData.note || !sData.note.includes("[Auto]")) {
        sData.note = autoNote;
        anyChanged = true;
      } else if (!sData.note.includes("Sakit")) {
        sData.note = autoNote;
        anyChanged = true;
      }
    });
  });

  // 4. Simpan perubahan
  if (anyChanged) {
    window.saveData?.();
  }
};

// ==========================================
// SINKRONISASI SAAT INPUT SAKIT BARU
// Dipanggil setelah savePermitLogic() selesai
// ==========================================
window.syncAfterNewSickPermit = function (savedPermit) {
  if (!savedPermit || savedPermit.category !== "sakit") return;

  // Sinkronkan ke semua sesi dari start_session
  window.syncSickPermitAcrossSessions(savedPermit.id);
};

// ==========================================
// SINKRONISASI SAAT SEMBUH
// Dipanggil setelah markAsRecovered()
// ==========================================
window.syncAfterRecovered = function (permitId) {
  const permit = appState.permits.find(p => p.id === permitId);
  if (!permit || permit.category !== "sakit") return;

  const nis = String(permit.nis);
  const dateKey = appState.date;
  const endSession = permit.end_session || appState.currentSlotId;
  const endSessionIdx = SESSION_CHAIN_ORDER.indexOf(endSession);

  // Iterate semua sesi dan ubah status sakit jadi Hadir
  SESSION_CHAIN_ORDER.forEach((sessionId, idx) => {
    if (idx <= endSessionIdx) {
      // Sesi ini dan sebelumnya dianggap sudah sembuh
      const dbSlot = appState.attendanceData?.[dateKey]?.[sessionId];
      if (!dbSlot || !dbSlot[nis]) return;

      const sData = dbSlot[nis];
      if (sData.note?.includes("[Auto] Sakit")) {
        const slot = SLOT_WAKTU[sessionId];
        if (slot) {
          slot.activities.forEach(act => {
            if (["fardu", "kbm", "school"].includes(act.category)) {
              if (sData.status[act.id] === "Sakit") {
                sData.status[act.id] = "Hadir";
              }
            }
          });
        }
        sData.note = "";
        window.saveData?.();
      }
    }
  });
};

// 1. SAKIT -> SEMBUH
window.markAsRecovered = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (permit) {
    const applyRecovery = (keepSick) => {

    permit.end_date = appState.date;

    // Logika Index Sesi — gunakan SESSION_KEYS agar 'sekolah' ikut tertangani
    const currentSlotId = appState.activeAttendanceSlotId || appState.currentSlotId;

    if (keepSick) {
      // Pilihan OK (Default): Sembuh NANTI/SEKARANG.
      // Sesi saat ini masih dianggap Sakit.
      permit.end_session = currentSlotId;
    } else {
      // Pilihan Cancel: Sembuh DARI TADI.
      // Sesi saat ini dianggap sudah sehat (Hadir).
      // End Session = Sesi Sebelumnya.
      permit.end_session = window.getPreviousAttendanceSessionId(currentSlotId);
    }

    // Simpan
    window.persistPermits();

    // SINKRONISASI: Update semua sesi setelah sembuh
    window.syncAfterRecovered(id);

    window.showToast("Status kesembuhan diperbarui", "success");

    window.refreshPermitSurfaces();
    window.renderAttendanceList?.();
    };

    window.showConfirmModal(
      "Konfirmasi Kesembuhan",
      "Pilih cara mencatat kesembuhan santri untuk sesi presensi saat ini.",
      "Baru Sembuh Sekarang",
      "Sehat Sejak Awal",
      () => applyRecovery(true),
      () => applyRecovery(false),
    );
  }
};

// 2. IZIN/PULANG -> KEMBALI LEBIH AWAL
window.markAsReturned = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (permit) {
    // Kalau pulang tepat waktu, kita set is_active false
    // Agar sesi hari ini bisa diisi Hadir manual oleh Musyrif
    permit.is_active = false;

    window.persistPermits();
    window.showToast(
      "Santri sudah kembali. Silakan presensi manual.",
      "success",
    );
    window.refreshPermitSurfaces();
  }
};

// 3. PERPANJANG IZIN (P -> I atau I -> I)
// 2. PULANG -> PERPANJANG (Poin 5: Pulang -> Izin)
window.extendPermit = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (!permit) return;

  const newDate = prompt(
    "Perpanjang sampai tanggal berapa? (YYYY-MM-DD)",
    permit.end_date,
  );
  if (!newDate) return;

  permit.end_date = newDate;

  // Poin 5: "mengabari jadi I Izin"
  // Jika asalnya Pulang, kita ubah jadi Izin karena sudah lewat jatah pulang.
  if (permit.category === "pulang") {
    permit.category = "izin";
    permit.status_label = "I";
    permit.reason += " (Diperpanjang/Telat)";
    window.showToast("Status diubah ke Izin (Diperpanjang)", "info");
  } else {
    window.showToast("Masa izin diperpanjang", "success");
  }

  window.persistPermits();
  window.refreshPermitSurfaces();
};

window.toggleSelectAllPermit = function () {
  const btn = document.getElementById("btn-select-all-permit");
  const checkboxes = document.querySelectorAll(
    'input[name="permit_santri_select"]',
  );

  isAllSelected = !isAllSelected;

  let actuallySelected = 0;
  checkboxes.forEach((cb) => {
    // Only toggle visible checkboxes
    if (cb.offsetParent !== null) {
      cb.checked = isAllSelected;
      if (isAllSelected) actuallySelected++;
    }
  });

  // Update button text based on actual state
  if (btn) {
    if (isAllSelected) {
      btn.innerHTML =
        '<i data-lucide="x-circle" class="w-4 h-4 mr-1"></i> Batal Pilih';
    } else {
      btn.innerHTML =
        '<i data-lucide="check-circle" class="w-4 h-4 mr-1"></i> Pilih Semua';
    }
    window.refreshIcons();
  }

  window.updatePermitCount();
};


// ==========================================
// MANAJEMEN RIWAYAT PERIZINAN (PROFIL)
// ==========================================

window.renderPermitHistory = function () {
  const container = document.getElementById("permit-history-list");
  if (!container) return;
  container.innerHTML = "";

  // --- Baca nilai search & filter dari HTML ---
  const searchVal = (document.getElementById("hist-search")?.value || "")
    .toLowerCase()
    .trim();
  const filterCat = document.getElementById("hist-filter-cat")?.value || "all";

  let history = [...appState.permits].map((p) => ({ ...p, source: "permit" }));
  const classNisList = FILTERED_SANTRI.map((s) => String(s.nis || s.id));

  // Buat Set untuk pengecekan cepat apakah entri manual sudah ter-cover surat izin
  const permitLookup = new Set();
  appState.permits.forEach((p) => {
    if (p.start_date && p.end_date) {
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = `${p.nis}_${window.getLocalDateStr(d)}_${p.category}`;
        permitLookup.add(key);
      }
    }
  });

  // Scan entri manual dari data presensi harian
  Object.keys(appState.attendanceData).forEach((date) => {
    const daySlots = appState.attendanceData[date];

    classNisList.forEach((nis) => {
      let foundSt = null;
      ["isya", "maghrib", "ashar", "shubuh"].forEach((slot) => {
        const st = daySlots[slot]?.[nis]?.status?.shalat;
        if (st && ["Sakit", "Izin", "Pulang"].includes(st)) foundSt = st;
      });

      const key = `${nis}_${date}_${foundSt?.toLowerCase()}`;
      if (foundSt && !permitLookup.has(key)) {
        history.push({
          id: `manual_${date}_${nis}`,
          nis: nis,
          category: foundSt.toLowerCase(),
          reason: "Input Manual (Tanpa Surat)",
          start_date: date,
          end_date: date,
          is_active: false,
          source: "manual",
          timestamp: date,
        });
      }
    });
  });

  // Urutkan terbaru dulu
  history.sort(
    (a, b) =>
      new Date(b.timestamp || b.start_date) -
      new Date(a.timestamp || a.start_date),
  );

  // Filter: hanya entri milik kelas ini
  history = history.filter((p) => classNisList.includes(String(p.nis)));

  // Filter: berdasarkan kategori dropdown
  if (filterCat !== "all") {
    history = history.filter((p) => p.category === filterCat);
  }

  // Filter: berdasarkan search nama santri
  if (searchVal) {
    history = history.filter((p) => {
      const santri = FILTERED_SANTRI.find(
        (s) => String(s.nis || s.id) === String(p.nis),
      );
      return santri && santri.nama.toLowerCase().includes(searchVal);
    });
  }

  if (history.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 px-4 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800 text-center w-full">
        <div class="w-12 h-12 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-slate-100 dark:border-slate-700">
          <i data-lucide="folder-open" class="w-6 h-6"></i>
        </div>
        <p class="text-xs font-bold text-slate-500 dark:text-slate-400">
          ${searchVal || filterCat !== "all" ? "Tidak ada hasil yang cocok" : "Belum ada riwayat perizinan"}
        </p>
      </div>`;
    window.refreshIcons();
    return;
  }

  const fragment = document.createDocumentFragment();

  history.forEach((p) => {
    const santri = FILTERED_SANTRI.find(
      (s) => String(s.nis || s.id) === String(p.nis),
    );
    if (!santri) return;

    // --- Tema warna per kategori --- Use centralized PERMIT_THEMES
    const theme = (window.PERMIT_THEMES || PERMIT_THEMES)[p.category] || {
      icon: "file-text",
      iconBg: "bg-slate-100 dark:bg-slate-700 text-slate-500",
      border: "border-slate-200 dark:border-slate-700",
      catLabel: "bg-slate-100 text-slate-500 border-slate-200",
    };

    // --- Badge status ---
    let statusBadge = "";
    if (p.source === "manual") {
      statusBadge = `<span class="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-black border border-slate-200 dark:border-slate-600 uppercase tracking-wider">MANUAL</span>`;
    } else {
      let isActive = p.is_active;
      const cat = (p.category || "").toLowerCase();
      if (cat === "sakit" && p.end_date) isActive = false;
      if (
        (cat === "izin" || cat === "pulang") &&
        p.end_date &&
        p.end_date < window.getLocalDateStr()
      )
        isActive = false;

      statusBadge = isActive
        ? `<span class="shrink-0 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-black border border-emerald-200 dark:border-emerald-700 uppercase tracking-wider">AKTIF</span>`
        : `<span class="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-black border border-slate-200 dark:border-slate-600 uppercase tracking-wider">SELESAI</span>`;
    }

    // --- Tombol aksi (horizontal, di pojok kanan atas) ---
    let actionButtons = "";
    if (p.source === "permit") {
      actionButtons = `
                <div class="flex gap-1.5 shrink-0 self-start">
                    <button onclick="window.openEditHistory('${p.id}')"
                        class="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 transition-colors"
                        title="Edit" aria-label="Edit izin ${window.sanitizeHTML(santri.nama)}">
                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="window.deleteHistoryPermit('${p.id}')"
                        class="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800 transition-colors"
                        title="Hapus" aria-label="Hapus izin ${window.sanitizeHTML(santri.nama)}">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>`;
    } else {
      actionButtons = `
                <div class="shrink-0 self-start">
                    <div class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-300 dark:text-slate-600 border border-slate-100 dark:border-slate-700 cursor-not-allowed" title="Manual — tidak bisa diedit">
                        <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                    </div>
                </div>`;
    }

    // --- Tampilan rentang tanggal ---
    const dateDisplay =
      p.end_date && p.end_date !== p.start_date
        ? `${window.formatDate(p.start_date)} — ${window.formatDate(p.end_date)}`
        : window.formatDate(p.start_date);

    const div = document.createElement("div");
    div.className = `rounded-2xl bg-white dark:bg-slate-800 border ${theme.border} shadow-sm hover:shadow-md transition-shadow`;
    div.innerHTML = `
            <div class="p-3.5 flex items-start gap-3">

                <!-- Ikon kategori -->
                <div class="w-9 h-9 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="${theme.icon}" class="w-4 h-4"></i>
                </div>

                <!-- Konten utama -->
                <div class="flex-1 min-w-0">

                    <!-- Baris: nama + status badge + tombol aksi -->
                    <div class="flex items-start gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${theme.catLabel}">${window.sanitizeHTML(p.category)}</span>
                                ${statusBadge}
                            </div>
                            <p class="font-bold text-slate-800 dark:text-white text-sm mt-0.5 truncate">${window.sanitizeHTML(santri.nama)}</p>
                        </div>
                        ${actionButtons}
                    </div>

                    <!-- Tanggal -->
                    <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
                        <i data-lucide="calendar-days" class="w-3 h-3 shrink-0"></i>
                        <span class="truncate">${dateDisplay}</span>
                    </p>

                    <!-- Alasan -->
                    <p class="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-2 leading-relaxed line-clamp-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg px-2.5 py-1.5 border border-slate-100 dark:border-slate-700">
                        "${window.sanitizeHTML(p.reason || "-")}"
                    </p>

                </div>
            </div>
        `;
    fragment.appendChild(div);
  });

  container.appendChild(fragment);
  window.refreshIcons();
};

// 1. Fungsi Hapus (Khusus History)
window.deleteHistoryPermit = function (id) {
  window.showConfirmModal(
    "Hapus Data Izin?",
    "Data izin akan dihapus permanen dan tidak bisa dikembalikan.",
    "Hapus",
    "Batal",
    () => {
  // Filter array untuk membuang ID yang cocok
  appState.permits = appState.permits.filter((p) => p.id !== id);

  // Simpan perubahan ke LocalStorage
  window.persistPermits();

  window.showToast("Data izin berhasil dihapus", "success");
  window.refreshPermitSurfaces();
    },
  );
};


// 3. Fungsi Edit (Buka Modal)
window.openEditHistory = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (!permit) return window.showToast("Data tidak ditemukan", "error");

  // Isi Form Modal dengan Data Lama
  document.getElementById("edit-permit-id").value = permit.id;
  document.getElementById("edit-permit-reason").value = permit.reason || "";
  document.getElementById("edit-permit-start").value = permit.start_date || "";
  document.getElementById("edit-permit-end").value = permit.end_date || "";
  document.getElementById("edit-permit-active").checked = permit.is_active;

  // Buka Modal
  const modal = document.getElementById("modal-edit-permit");
  modal.classList.remove("hidden");
};

// 4. Fungsi Simpan Edit
window.savePermitEdit = function () {
  const id = document.getElementById("edit-permit-id").value;
  const reason = document.getElementById("edit-permit-reason").value;
  const start = document.getElementById("edit-permit-start").value;
  const end = document.getElementById("edit-permit-end").value;
  const isActive = document.getElementById("edit-permit-active").checked;

  if (!reason || !start)
    return window.showToast("Alasan dan Tanggal Mulai wajib diisi", "warning");

  if (end && end < start)
    return window.showToast("Tanggal selesai error", "error");

  // Cari index data di array
  const index = appState.permits.findIndex((p) => p.id === id);
  if (index === -1) return;

  // Update Data
  appState.permits[index].reason = reason;
  appState.permits[index].start_date = start;

  // Logic End Date: Jika kosong string, jadikan null (Sakit belum sembuh)
  appState.permits[index].end_date = end ? end : null;

  appState.permits[index].is_active = isActive;

  // Simpan ke Storage
  window.persistPermits();

  // Tutup Modal & Refresh
  window.closeModal("modal-edit-permit");
  window.showToast("Perubahan berhasil disimpan", "success");
  window.refreshPermitSurfaces();
};

// --- FITUR PEMBINAAN (Baru) ---

// ==========================================
// CENTRALIZED PERMITS TAB HANDLERS
// ==========================================

window.lastUploadedDocBase64 = null;

window.initPermitsTab = function() {
  // Populate student dropdown in centralized modal
  const select = document.getElementById("add-permit-santri-select");
  if (select) {
    const listToUse = FILTERED_SANTRI && FILTERED_SANTRI.length > 0 ? FILTERED_SANTRI : MASTER_SANTRI;
    select.innerHTML = listToUse.map(s => `<option value="${s.nis || s.id}">${window.sanitizeHTML(s.nama)} (${s.kelas})</option>`).join("");
  }
  
  // Reset fields in central form
  document.getElementById("add-permit-reason").value = "";
  document.getElementById("add-permit-start-date").value = window.getLocalDateStr();
  document.getElementById("add-permit-end-date").value = "";
  document.getElementById("add-permit-file").value = "";
  document.getElementById("add-permit-file-label").textContent = "Pilih file foto/PDF";
  window.lastUploadedDocBase64 = null;
  
  window.filterPermitsTabList();
};

window.handlePermitFileChange = function(input) {
  const file = input.files[0];
  const label = document.getElementById("add-permit-file-label");
  if (!file) {
    if (label) label.textContent = "Pilih file foto/PDF";
    window.lastUploadedDocBase64 = null;
    return;
  }
  
  if (label) label.textContent = file.name + " (" + Math.round(file.size / 1024) + " KB)";
  
  const reader = new FileReader();
  reader.onload = function(e) {
    window.lastUploadedDocBase64 = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.submitAddPermit = function() {
  const select = document.getElementById("add-permit-santri-select");
  const nis = select ? select.value : "";
  const category = document.getElementById("add-permit-category").value;
  const startDate = document.getElementById("add-permit-start-date").value;
  const endDate = document.getElementById("add-permit-end-date").value;
  const reason = document.getElementById("add-permit-reason").value.trim();
  
  if (!nis) return window.showToast("Pilih santri terlebih dahulu", "warning");
  if (!startDate) return window.showToast("Pilih tanggal mulai", "warning");
  if (!reason) return window.showToast("Masukkan alasan izin", "warning");
  
  const newPermit = {
    id: "p_" + Date.now(),
    nis: nis,
    category: category,
    start_date: startDate,
    end_date: endDate || null,
    reason: reason,
    status: "pending",
    document: window.lastUploadedDocBase64 || null,
    audit_trail: [
      {
        action: "Dibuat",
        by: "Musyrif " + (window.getCurrentActorName ? window.getCurrentActorName() : "Admin"),
        time: new Date().toISOString()
      }
    ],
    is_active: true
  };
  
  if (!appState.permits) appState.permits = [];
  appState.permits.push(newPermit);
  window.persistPermits();

  window.closeModal("modal-add-permit");
  window.showToast("Pengajuan izin berhasil dibuat", "success");
  window.refreshPermitSurfaces();
};

window.filterPermitsTabList = function() {
  const container = document.getElementById("permits-list-content");
  if (!container) return;
  
  const query = (document.getElementById("permits-search-input")?.value || "").toLowerCase();
  const typeFilter = document.getElementById("permits-filter-type")?.value || "all";
  const statusFilter = document.getElementById("permits-filter-status")?.value || "all";
  
  const filtered = (appState.permits || []).filter(p => {
    // 1. Search Query
    const santri = MASTER_SANTRI.find(s => String(s.nis || s.id) === String(p.nis));
    const name = (santri ? santri.nama : "").toLowerCase();
    const matchesSearch = name.includes(query) || String(p.nis).includes(query);
    
    // 2. Type Filter
    const matchesType = typeFilter === "all" || p.category.toLowerCase() === typeFilter.toLowerCase();
    
    // 3. Status Filter
    const status = p.status || "approved";
    const matchesStatus = statusFilter === "all" || status.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesType && matchesStatus;
  });
  
  // Update badge count
  const badge = document.getElementById("permits-count-badge");
  if (badge) badge.textContent = filtered.length + " Pengajuan";
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center text-xs text-slate-400 py-12 italic bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/60 shadow-sm">
        Tidak ada data perizinan yang sesuai
      </div>
    `;
    return;
  }
  
  // Sort by start_date descending
  filtered.sort((a, b) => b.start_date.localeCompare(a.start_date) || b.id.localeCompare(a.id));
  
  const catTheme = {
    sakit: { label: "Sakit", badge: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30" },
    izin: { label: "Izin Kegiatan", badge: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-955/20 dark:text-blue-400 dark:border-blue-900/30" },
    pulang: { label: "Izin Pulang", badge: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-955/20 dark:text-purple-400 dark:border-purple-900/30" }
  };
  
  const statusTheme = {
    pending: "bg-yellow-50 text-yellow-600 border-yellow-100 dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-900/30",
    approved: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-955/20 dark:text-emerald-400 dark:border-emerald-900/30",
    rejected: "bg-red-50 text-red-600 border-red-100 dark:bg-red-955/20 dark:text-red-400 dark:border-red-900/30"
  };
  
  container.innerHTML = filtered.map(p => {
    const santri = MASTER_SANTRI.find(s => String(s.nis || s.id) === String(p.nis));
    const name = santri ? santri.nama : "Santri Tidak Dikenal";
    const kelas = santri ? santri.kelas : "-";
    
    const cat = p.category.toLowerCase();
    const theme = catTheme[cat] || { label: p.category, badge: "bg-slate-50 text-slate-600 border-slate-100" };
    const stClass = statusTheme[p.status || "approved"] || "bg-slate-50 text-slate-600";
    
    return `
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-start mb-3">
            <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${theme.badge}">
              ${theme.label}
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${stClass}">
              ${p.status || "approved"}
            </span>
          </div>
          
          <h4 class="font-black text-slate-800 dark:text-white text-sm truncate">${window.sanitizeHTML(name)}</h4>
          <p class="text-[9px] text-slate-400 font-bold mt-0.5">NIS: ${p.nis} | Kelas: ${kelas}</p>
          
          <div class="my-3 text-xs text-slate-600 dark:text-slate-350 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <p class="font-bold">Alasan: <span class="font-semibold text-slate-500 dark:text-slate-400">${window.sanitizeHTML(p.reason || "-")}</span></p>
            <p class="font-bold mt-1.5">Tanggal: <span class="font-semibold text-slate-500 dark:text-slate-400">${window.formatDate(p.start_date)} ${p.end_date ? ' s/d ' + window.formatDate(p.end_date) : '(Harian)'}</span></p>
          </div>
          
          ${p.document ? `
            <div class="mb-3">
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lampiran Dokumen</p>
              <img src="${p.document}" class="w-full max-h-32 object-cover rounded-2xl border border-slate-200 dark:border-slate-700 cursor-zoom-in" onclick="window.zoomPermitDocument('${p.document}')" />
            </div>
          ` : ''}
          
          <!-- Audit Trail -->
          <div class="border-t border-slate-100 dark:border-slate-750 pt-2 mt-2">
            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Audit Trail</p>
            <div class="space-y-1 text-[9px] text-slate-400 dark:text-slate-500">
              ${(p.audit_trail || []).map(a => `
                <div class="flex justify-between">
                  <span>${a.action} oleh ${a.by}</span>
                  <span class="font-bold">${new Date(a.time).toLocaleDateString()}</span>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
        
        <!-- Action Buttons if Pending -->
        ${p.status === "pending" ? `
          <div class="flex gap-2 mt-4">
            <button onclick="window.rejectPermit('${p.id}')" class="flex-1 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 font-bold rounded-2xl text-xs transition-colors hover:bg-red-100 dark:hover:bg-red-950/40">
              Tolak
            </button>
            <button onclick="window.approvePermit('${p.id}')" class="flex-1 py-2 text-white bg-blue-500 font-bold rounded-2xl text-xs transition-colors hover:bg-blue-600 shadow-md">
              Setujui
            </button>
          </div>
        ` : `
          <div class="mt-4 flex justify-end">
            <button onclick="window.deletePermitsTabItem('${p.id}')" class="text-[10px] text-slate-450 hover:text-red-500 transition-colors font-bold flex items-center gap-1">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus Izin
            </button>
          </div>
        `}
      </div>
    `;
  }).join("");
  
  if (window.lucide) window.lucide.createIcons();
};

window.approvePermit = function(id) {
  const idx = appState.permits.findIndex(p => p.id === id);
  if (idx !== -1) {
    appState.permits[idx].status = "approved";
    if (!appState.permits[idx].audit_trail) appState.permits[idx].audit_trail = [];
    appState.permits[idx].audit_trail.push({
      action: "Disetujui",
      by: "Musyrif " + (window.getCurrentActorName ? window.getCurrentActorName() : "Admin"),
      time: new Date().toISOString()
    });
    window.persistPermits();
    window.showToast("Pengajuan izin disetujui", "success");
    window.refreshPermitSurfaces();
  }
};

window.rejectPermit = function(id) {
  const idx = appState.permits.findIndex(p => p.id === id);
  if (idx !== -1) {
    appState.permits[idx].status = "rejected";
    if (!appState.permits[idx].audit_trail) appState.permits[idx].audit_trail = [];
    appState.permits[idx].audit_trail.push({
      action: "Ditolak",
      by: "Musyrif " + (window.getCurrentActorName ? window.getCurrentActorName() : "Admin"),
      time: new Date().toISOString()
    });
    window.persistPermits();
    window.showToast("Pengajuan izin ditolak", "warning");
    window.refreshPermitSurfaces();
  }
};

window.deletePermitsTabItem = function(id) {
  window.showConfirmModal(
    "Hapus Data Izin?",
    "Status kehadiran santri akan dikembalikan ke default.",
    "Hapus",
    "Batal",
    () => {
  appState.permits = appState.permits.filter(p => p.id !== id);
  window.persistPermits();
  window.showToast("Data izin berhasil dihapus", "info");
  window.refreshPermitSurfaces();
    },
  );
};

window.zoomPermitDocument = function(src) {
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out animate-fade-in";
  overlay.innerHTML = `<img src="${src}" class="max-w-full max-h-[90vh] rounded-3xl shadow-2xl border border-white/10" /><button class="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition-colors" onclick="this.parentElement.remove()"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
};
