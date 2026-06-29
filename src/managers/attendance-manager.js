// File: attendance-manager.js

// ==========================================
// 5. ATTENDANCE ACTIONS
// ==========================================

window.openAttendance = async function () {
  if (window.isSlotHoliday(appState.currentSlotId, appState.date)) {
    return window.showToast(
      `Kegiatan ${SLOT_WAKTU[appState.currentSlotId].label} libur pada hari ini.`,
      "info",
    );
  }
  // 1. Cek Kunci Waktu (Logic Lama)
  const access = window.isSlotAccessible(appState.currentSlotId, appState.date);
  if (access.locked) {
    let msg = "Akses ditolak.";
    if (access.reason === "wait") msg = "Belum masuk waktu presensi";
    if (access.reason === "limit") msg = "Data lampau (>3 hari) terkunci.";
    if (access.reason === "future") msg = "Belum bisa mengisi masa depan.";
    return window.showToast(msg, "warning");
  }

  // 2. CEK LOKASI (LOGIC BARU)
  if (GEO_CONFIG.useGeofencing) {
    try {
      await window.verifyLocationCached();
      window.showToast("Lokasi Terverifikasi ✅", "success");
    } catch (errorMsg) {
      window.showToast("🚫 Akses Ditolak: " + errorMsg, "error");

      // Log aktivitas percobaan akses ilegal (Opsional)
      window.logActivity("Akses Ditolak", `Gagal GPS: ${errorMsg}`);
      return; // STOP! Jangan buka halaman absen
    }
  }

  // 3. Buka Halaman Absen (Logic Lama)
  document.getElementById("view-main").classList.add("hidden");
  document.getElementById("view-attendance").classList.remove("hidden");

  const slot = SLOT_WAKTU[appState.currentSlotId];
  document.getElementById("att-slot-title").textContent = slot.label;
  const listContainer = document.getElementById("attendance-list-container");
  if (listContainer) {
    listContainer.dataset.attendanceRenderKey = "";
    listContainer.scrollTop = 0;
  }
  window.renderAttendanceList();
};

window.closeAttendance = function () {
  if (window.clearAttendanceReviewGate) window.clearAttendanceReviewGate();
  document.getElementById("view-attendance").classList.add("hidden");
  document.getElementById("view-main").classList.remove("hidden");
  window.updateDashboard();
};

window.renderAttendanceList = function () {
  const container = document.getElementById("attendance-list-container");
  if (!container) return;

  container.innerHTML = "";

  // --- START LOGIC ABSENSI (ORIGINAL - TIDAK DIUBAH) ---
  const slot = SLOT_WAKTU[appState.currentSlotId];
  const dateKey = appState.date;
  const currentDay = new Date(appState.date).getDay();
  const attendanceRenderKey = `${dateKey}:${slot.id}`;
  const isNewAttendanceView =
    container.dataset.attendanceRenderKey !== attendanceRenderKey;

  // SINKRONISASI SAKIT: Saat membuka sesi baru (view baru), sync sakit dari sesi sebelumnya
  // Ini memastikan jika input sakit di sesi subuh, maka saat buka sesi sekolah/ashar/etc
  // status sakit otomatis tersinkron
  if (isNewAttendanceView && window.syncSickPermitAcrossSessions) {
    window.syncSickPermitAcrossSessions(null, dateKey);
  }

  if (!appState.attendanceData[dateKey]) appState.attendanceData[dateKey] = {};
  if (!appState.attendanceData[dateKey][slot.id])
    appState.attendanceData[dateKey][slot.id] = {};

  if (isNewAttendanceView) {
    if (container._attendanceReviewScrollHandler) {
      container.removeEventListener(
        "scroll",
        container._attendanceReviewScrollHandler,
      );
      delete container._attendanceReviewScrollHandler;
    }
    container.scrollTop = 0;
    container.dataset.attendanceRenderKey = attendanceRenderKey;
  }

  const dbSlot = appState.attendanceData[dateKey][slot.id];
  let hasAutoChanges = false;

  let summaryCount = { Sakit: 0, Izin: 0, Pulang: 0, Alpa: 0, Telat: 0 };
  let summaryList = [];

  const PREV_SLOT_MAP = { ashar: "shubuh", maghrib: "ashar", isya: "maghrib" };
  const prevSlotId = PREV_SLOT_MAP[slot.id];
  const prevSlotData = prevSlotId
    ? appState.attendanceData[dateKey][prevSlotId]
    : null;

  const mainActId = slot.activities[0]?.id || "shalat";

  // PERBAIKAN: Inisialisasi struktur data kosong untuk SEMUA santri DULU sebelum di-filter
  FILTERED_SANTRI.forEach((santri) => {
    const id = String(santri.nis || santri.id);
    if (!dbSlot[id]) {
      hasAutoChanges = true;
      dbSlot.__requiresReview = true;
      dbSlot.__reviewConfirmed = false;

      const defStatus = {};
      slot.activities.forEach((a) => {
        if (a.onlyRamadhan && !window.isRamadhan(dateKey)) return;
        if (a.category === "sunnah") defStatus[a.id] = "Tidak";
        else defStatus[a.id] = a.type === "mandator" ? "Hadir" : "Ya";
      });
      dbSlot[id] = { status: defStatus, note: "" };
    }
  });

  // BARU jalankan filter setelah semua punya status dasar
  const list = FILTERED_SANTRI.filter((s) => {
    const matchName = s.nama
      .toLowerCase()
      .includes(appState.searchQuery.toLowerCase());
    if (appState.filterProblemOnly) {
      const st = dbSlot[String(s.nis || s.id)]?.status?.[mainActId];
      return (
        matchName && ["Alpa", "Sakit", "Izin", "Pulang", "Telat"].includes(st)
      );
    }
    return matchName;
  });

  const countEl = document.getElementById("att-santri-count");
  if (countEl) countEl.textContent = `${list.length} Santri`;

  const tplRow = document.getElementById("tpl-santri-row");
  const tplBtn = document.getElementById("tpl-activity-btn");

  if (!tplRow || !tplBtn) {
    console.error("Template HTML tidak ditemukan!");
    return;
  }

  const fragment = document.createDocumentFragment();

  if (list.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm text-center animate-[fadeIn_0.3s_ease-out] w-full">
        <div class="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
          <i data-lucide="${appState.searchQuery ? 'search' : 'users'}" class="w-8 h-8"></i>
        </div>
        <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200">
          ${appState.searchQuery ? 'Tidak Ada Hasil' : 'Daftar Kosong'}
        </h3>
        <p class="text-xs text-slate-400 mt-1 max-w-[240px] leading-relaxed">
          ${appState.searchQuery ? `Tidak ada santri bernama "${appState.searchQuery}"` : 'Semua santri di kelas ini sudah diabsen atau tidak ada data.'}
        </p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  list.forEach((santri) => {
    const id = String(santri.nis || santri.id);

    const sData = dbSlot[id];
    const activePermit = window.checkActivePermit(id, dateKey, slot.id);
    const isAutoMarked = sData.note && sData.note.includes("[Auto]");

    const hasPermitManualOverride =
      activePermit && sData.permitManualOverride === true;

    if (activePermit && !hasPermitManualOverride) {
      slot.activities.forEach((act) => {
        let target = null;
        if (["fardu", "kbm", "school"].includes(act.category))
          target = activePermit.type;
        else target = "Tidak";

        if (sData.status[act.id] !== target) {
          sData.status[act.id] = target;
          hasAutoChanges = true;
        }
      });
      const autoNote = `[Auto] ${activePermit.type} s/d ${window.formatDate(activePermit.end)}`;
      if (!sData.note || !sData.note.includes(activePermit.type)) {
        sData.note = autoNote;
        hasAutoChanges = true;
      }
    } else if (!activePermit && isAutoMarked) {
      slot.activities.forEach((act) => {
        if (["fardu", "kbm", "school"].includes(act.category))
          sData.status[act.id] = "Hadir";
        else if (act.category === "dependent") sData.status[act.id] = "Ya";
        else sData.status[act.id] = "Tidak";
      });
      sData.note = "";
      hasAutoChanges = true;
    }
    if (!activePermit && sData.permitManualOverride) {
      delete sData.permitManualOverride;
      hasAutoChanges = true;
    }

    const currentStatus = sData.status?.[mainActId] || "Hadir";

    if (["Sakit", "Izin", "Pulang", "Alpa", "Telat"].includes(currentStatus)) {
      summaryCount[currentStatus] = (summaryCount[currentStatus] || 0) + 1;
      summaryList.push({ nama: santri.nama, status: currentStatus });
    }
    // --- END LOGIC ABSENSI ---

    // ==========================================
    // COMPACT UI IMPLEMENTATION
    // Static card, dark mode, minimal design
    // ==========================================

    const clone = tplRow.content.cloneNode(true);
    const cardContainer = clone.querySelector(".santri-row");

    // STATIC CARD STYLING - Same for all
    cardContainer.className =
      "santri-row bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm relative overflow-hidden transition-all hover:shadow-md mb-4";

    // Visual highlight untuk active permit (optional subtle ring)
    if (activePermit && !hasPermitManualOverride) {
      if (activePermit.type === "Sakit") {
        cardContainer.classList.add(
          "ring-2",
          "ring-amber-200",
          "dark:ring-amber-800/50",
        );
      } else if (activePermit.type === "Izin") {
        cardContainer.classList.add(
          "ring-2",
          "ring-blue-200",
          "dark:ring-blue-800/50",
        );
      } else if (activePermit.type === "Pulang") {
        cardContainer.classList.add(
          "ring-2",
          "ring-purple-200",
          "dark:ring-purple-800/50",
        );
      } else if (activePermit.type === "Alpa") {
        cardContainer.classList.add(
          "ring-2",
          "ring-red-200",
          "dark:ring-red-800/50",
        );
      }
    }

    // HEADER SECTION
    const headerContainer = clone.querySelector(".header-container");
    headerContainer.className = "flex justify-between items-start mb-4";

    const infoSection = clone.querySelector(".info-section");
    infoSection.className = "flex items-center gap-3.5";

    // AVATAR - Stable personality marker per santri.
    const avatarEl = clone.querySelector(".santri-avatar");
    const avatarOptions = [
      { icon: "🌿", class: "from-emerald-50 to-emerald-100 text-emerald-700 dark:from-emerald-900/30 dark:to-emerald-900/30 dark:text-emerald-300" },
      { icon: "✨", class: "from-sky-50 to-blue-100 text-sky-700 dark:from-sky-900/30 dark:to-blue-900/30 dark:text-sky-300" },
      { icon: "📘", class: "from-indigo-50 to-violet-100 text-indigo-700 dark:from-indigo-900/30 dark:to-violet-900/30 dark:text-indigo-300" },
      { icon: "🕌", class: "from-cyan-50 to-slate-100 text-cyan-700 dark:from-cyan-900/30 dark:to-slate-800 dark:text-cyan-300" },
      { icon: "⭐", class: "from-amber-50 to-yellow-100 text-amber-700 dark:from-amber-900/30 dark:to-yellow-900/20 dark:text-amber-300" },
    ];
    const avatarSeed = Array.from(String(santri.id || santri.nis || santri.nama || id)).reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    const avatar = avatarOptions[avatarSeed % avatarOptions.length];
    avatarEl.className =
      `w-10 h-10 rounded-xl ${avatar.class} flex items-center justify-center text-lg shadow-inner shrink-0 ring-1 ring-white/70 dark:ring-white/10 cursor-pointer hover:scale-105 transition-transform`;
    avatarEl.textContent = avatar.icon;
    avatarEl.onclick = () => { if (window.openStudentDetail) window.openStudentDetail(id); };
    const iconAvatarOptions = [
      { icon: "user-round", class: "from-sky-50 to-blue-100 text-sky-700 dark:from-sky-900/30 dark:to-blue-900/30 dark:text-sky-300" },
      { icon: "book-open", class: "from-indigo-50 to-violet-100 text-indigo-700 dark:from-indigo-900/30 dark:to-violet-900/30 dark:text-indigo-300" },
      { icon: "sparkles", class: "from-amber-50 to-yellow-100 text-amber-700 dark:from-amber-900/30 dark:to-yellow-900/20 dark:text-amber-300" },
      { icon: "leaf", class: "from-emerald-50 to-emerald-100 text-emerald-700 dark:from-emerald-900/30 dark:to-emerald-900/30 dark:text-emerald-300" },
      { icon: "graduation-cap", class: "from-cyan-50 to-slate-100 text-cyan-700 dark:from-cyan-900/30 dark:to-slate-800 dark:text-cyan-300" },
      { icon: "badge-check", class: "from-cyan-50 to-emerald-100 text-cyan-700 dark:from-cyan-900/30 dark:to-emerald-900/20 dark:text-cyan-300" },
      { icon: "notebook-tabs", class: "from-violet-50 to-fuchsia-100 text-violet-700 dark:from-violet-900/30 dark:to-fuchsia-900/20 dark:text-violet-300" },
      { icon: "shield-check", class: "from-slate-50 to-slate-200 text-slate-600 dark:from-slate-800 dark:to-slate-700 dark:text-slate-300" },
      { icon: "map-pin", class: "from-rose-50 to-pink-100 text-rose-700 dark:from-rose-900/30 dark:to-pink-900/20 dark:text-rose-300" },
      { icon: "circle-user-round", class: "from-blue-50 to-cyan-100 text-blue-700 dark:from-blue-900/30 dark:to-cyan-900/20 dark:text-blue-300" },
      { icon: "school", class: "from-orange-50 to-amber-100 text-orange-700 dark:from-orange-900/30 dark:to-amber-900/20 dark:text-orange-300" },
      { icon: "scan-face", class: "from-lime-50 to-green-100 text-lime-700 dark:from-lime-900/30 dark:to-green-900/20 dark:text-lime-300" },
    ];
    const iconAvatar = iconAvatarOptions[avatarSeed % iconAvatarOptions.length];
    const profileStats = { Hadir: 0, Sakit: 0, Izin: 0, Pulang: 0, Alpa: 0, Telat: 0 };
    Object.values(appState.attendanceData || {}).forEach((dateSlots) => {
      Object.values(dateSlots || {}).forEach((slotRecords) => {
        const record = slotRecords?.[id];
        Object.values(record?.status || {}).forEach((status) => {
          if (profileStats[status] !== undefined) profileStats[status] += 1;
        });
      });
    });
    const issueStatus = ["Sakit", "Izin", "Pulang", "Alpa", "Telat"].sort(
      (a, b) => profileStats[b] - profileStats[a],
    )[0];
    const profileAvatar =
      profileStats[issueStatus] >= 2
        ? {
            Sakit: { icon: window.getStatusMeta("Sakit").icon, class: window.getStatusMeta("Sakit").text },
            Izin: { icon: window.getStatusMeta("Izin").icon, class: window.getStatusMeta("Izin").text },
            Pulang: { icon: window.getStatusMeta("Pulang").icon, class: window.getStatusMeta("Pulang").text },
            Alpa: { icon: window.getStatusMeta("Alpa").icon, class: window.getStatusMeta("Alpa").text },
            Telat: { icon: window.getStatusMeta("Telat").icon, class: window.getStatusMeta("Telat").text },
          }[issueStatus]
        : profileStats.Hadir >= 2 || currentStatus === "Hadir"
          ? { icon: "flame", class: "text-orange-500" }
          : { icon: iconAvatar.icon, class: "text-slate-500 dark:text-slate-300" };
    avatarEl.className =
      "w-10 h-10 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center shadow-inner shrink-0 cursor-pointer hover:scale-105 hover:bg-slate-200 dark:hover:bg-slate-700 transition-transform";
    avatarEl.innerHTML = `<i data-lucide="${profileAvatar.icon}" class="w-5 h-5 ${profileAvatar.class}"></i>`;

    // NAME & INFO
    const nameContainer = clone.querySelector(".name-container");
    nameContainer.className = "flex-1 min-w-0";

    const nameRow = clone.querySelector(".name-row");
    nameRow.className = "flex items-center gap-2";

    const nameText = clone.querySelector(".santri-name");
    nameText.className =
      "font-bold text-slate-800 dark:text-white text-sm leading-tight line-clamp-1 cursor-pointer hover:underline hover:text-emerald-505 transition-all";
    nameText.textContent = window.sanitizeHTML(santri.nama);
    nameText.onclick = () => { if (window.openStudentDetail) window.openStudentDetail(id); };

    // BADGE - Only for active permit (inline conditional)
    const badgeContainer = clone.querySelector(".badge-container");
    badgeContainer.innerHTML = "";
    if (activePermit && !hasPermitManualOverride) {
      const badge = document.createElement("span");
      let badgeClass =
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border align-middle";
      let badgeIcon = "badge-alert";

      if (activePermit.type === "Sakit") {
        badgeIcon = "thermometer";
        badgeClass +=
          " bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700";
      } else if (activePermit.type === "Izin") {
        badgeIcon = "calendar";
        badgeClass +=
          " bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700";
      } else if (activePermit.type === "Pulang") {
        badgeIcon = "bus";
        badgeClass +=
          " bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700";
      } else if (activePermit.type === "Alpa") {
        badgeIcon = "alert-triangle";
        badgeClass +=
          " bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700";
      }

      badge.className = badgeClass;
      badge.innerHTML = `<i data-lucide="${badgeIcon}" class="w-2.5 h-2.5"></i><span>${activePermit.type}</span>`;
      badgeContainer.appendChild(badge);
    }

    // Room metadata is intentionally hidden to keep this card header clean.
    const roomRow = clone.querySelector(".room-row");
    roomRow.className = "hidden";

    const roomLabel = clone.querySelector(".room-label");
    roomLabel.textContent = "";

    const roomValue = clone.querySelector(".santri-kamar");
    roomValue.textContent = "";
    const kelasText = String(santri.kelas || "-");
    const asramaText = String(santri.asrama || "-");
    roomRow.className = "flex items-center gap-1.5 mt-1.5 min-w-0";
    roomLabel.className =
      "meta-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 text-[8px] font-black uppercase tracking-wide border border-slate-200/70 dark:border-slate-700/70 max-w-[64px]";
    roomLabel.innerHTML = `<i data-lucide="school" class="w-2.5 h-2.5 shrink-0"></i><span class="meta-chip-text">${window.sanitizeHTML(kelasText)}</span>`;
    roomValue.className =
      "meta-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 text-[8px] font-bold border border-slate-200/70 dark:border-slate-700/70 max-w-[150px]";
    roomValue.innerHTML = `<i data-lucide="home" class="w-2.5 h-2.5 shrink-0"></i><span class="meta-chip-text">${window.sanitizeHTML(asramaText)}</span>`;

    // EDIT NOTE BUTTON
    const editBtn = clone.querySelector(".btn-edit-note");
    editBtn.className =
      "w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all";

    // ACTIVITY BUTTONS SECTION - HORIZONTAL LAYOUT
    const btnCont = clone.querySelector(".activity-container");
    const visibleActivities = slot.activities.filter((act) => {
      if (act.showOnDays && !act.showOnDays.includes(currentDay)) return false;
      if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return false;
      return true;
    });
    const isCenteredActivityRow = visibleActivities.length <= 3;
    const activityAlignClass = isCenteredActivityRow
      ? "justify-center gap-5 sm:gap-6"
      : "justify-between gap-2 sm:gap-2.5";
    btnCont.className = `flex ${activityAlignClass} overflow-x-auto hide-scrollbar px-1 pb-2 pt-1`;
    btnCont.innerHTML = "";

    visibleActivities.forEach((act) => {
      const isActivityLibur = window.isActivityHoliday(
        dateKey,
        slot.id,
        act.id,
      );

      const isCategoryLibur = window.isCategoryHoliday(dateKey, act.category);

      const isLibur = isActivityLibur || isCategoryLibur;

      const bClone = tplBtn.content.cloneNode(true);
      const btnWrapper = bClone.querySelector(".btn-wrapper");
      btnWrapper.className =
        "flex flex-col items-center gap-1 cursor-pointer group select-none w-11 sm:w-[58px] shrink-0";

      const btn = bClone.querySelector(".btn-status");
      const lbl = bClone.querySelector(".lbl-status");

      const curr = sData.status?.[act.id] || "Tidak";
      const uiBtn = STATUS_UI[curr] || STATUS_UI["Tidak"];
      const hasPermitConflict =
        activePermit &&
        !sData.permitManualOverride &&
        ["fardu", "kbm", "school"].includes(act.category);

      let btnClass = `btn-status w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm transition-all active:scale-95 border-[2.5px] font-black text-sm sm:text-base ${uiBtn.class}`;

      let ringClass = "";
      if (curr === "Hadir" || curr === "Ya") {
        ringClass =
          "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-800";
      } else if (["Telat", "Sakit", "Izin", "Alpa", "Pulang"].includes(curr)) {
        ringClass =
          `ring-2 ${window.getStatusMeta(curr).ring} ring-offset-2 ring-offset-white dark:ring-offset-slate-800`;
      } else {
        ringClass =
          "ring-2 ring-slate-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-800";
      }

      btn.className = btnClass + " " + ringClass;

      if (isLibur) {
        btn.className =
          "btn-status w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center border-2 border-slate-300 bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 grayscale opacity-70";
      }

      if (isLibur) {
        btn.innerHTML = '<i data-lucide="calendar-x" class="w-5 h-5"></i>';
      } else {
        btn.textContent = uiBtn.label;
      }

      btn.onclick = (e) => {
        if (isLibur) {
          return;
        }

        e.stopPropagation();
        if (hasPermitConflict) {
          window.showConfirmModal(
            "Ubah Manual Jadi Hadir?",
            `Santri tercatat ${activePermit.type}. Status otomatis akan ditimpa untuk sesi ini.`,
            "Ubah Hadir",
            "Batal",
            () => {
          sData.permitManualOverride = true;
          const recoveredSickPermit =
            activePermit.type === "Sakit" &&
            window.markSickPermitRecoveredBeforeSlot?.(
              activePermit.permitId,
              slot.id,
            );
          if (sData.note && sData.note.includes("[Auto]")) sData.note = "";
          sData.status[act.id] = "Hadir";
          if (act.category === "fardu" && act.id === "shalat") {
            slot.activities.forEach((otherAct) => {
              if (otherAct.category === "dependent")
                sData.status[otherAct.id] = "Ya";
              else if (["kbm", "school"].includes(otherAct.category))
                sData.status[otherAct.id] = "Hadir";
            });
          }
          window.saveData();
          window.renderAttendanceList();
          window.refreshPembinaanSurfaces?.();
          if (recoveredSickPermit) {
            window.renderActivePermitsWidget?.();
            window.renderPermitHistory?.();
          }
          if (appState.date === window.getLocalDateStr()) {
            window.updateDashboard();
          }
            },
          );
          return;
        }
        window.toggleStatus(id, act.id, act.type);
      };

      lbl.className =
        "lbl-status text-[9px] font-bold text-slate-400 text-center truncate w-full group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors leading-tight";
      if (isLibur) {
        lbl.innerHTML = `
                    <span>${act.label}</span>
                    <span class="block text-[8px] uppercase font-black text-slate-400">
                        Libur
                    </span>
                `;
      } else {
        lbl.textContent = act.label;
      }

      btnCont.appendChild(bClone);
    });

    const noteBox = clone.querySelector(".note-section");
    const noteInp = clone.querySelector(".input-note");

    if (noteInp && noteBox) {
      noteBox.className =
        "note-section hidden mt-3 animate-fade-in border-t border-slate-100 dark:border-slate-700 pt-3";
      noteInp.value = sData.note || "";
      noteInp.className =
        "input-note w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 focus:border-emerald-500 dark:focus:border-emerald-400 outline-none transition-colors placeholder-slate-400 dark:placeholder-slate-500 text-slate-700 dark:text-slate-200";
      noteInp.placeholder = "Catatan kejadian...";

      noteInp.onchange = (e) => {
        sData.note = window.sanitizeHTML(e.target.value);
        window.saveData();
      };

      editBtn.onclick = () => {
        noteBox.classList.toggle("hidden");
        if (!noteBox.classList.contains("hidden")) {
          noteInp.focus();
        }
      };
    }

    fragment.appendChild(clone);
  });

  container.appendChild(fragment);
  if (isNewAttendanceView) container.scrollTop = 0;
  if (window.lucide) window.lucide.createIcons();

  // ==========================================
  // SUMMARY WIDGET - Clean badges
  // ==========================================
  const summaryWidget = document.getElementById("att-summary-widget");
  const summaryBadges = document.getElementById("att-summary-badges");
  const summaryNames = document.getElementById("att-summary-names");

  const totalProblem =
    summaryCount.Sakit +
    summaryCount.Izin +
    summaryCount.Pulang +
    summaryCount.Alpa +
    summaryCount.Telat;

  if (summaryWidget && summaryBadges && summaryNames) {
    if (totalProblem > 0) {
      summaryWidget.classList.remove("hidden");
      summaryBadges.innerHTML = "";
      summaryNames.innerHTML = "";

      const makeBadge = (count, label, colorClass) => {
        if (count > 0) {
          const pill = document.createElement("div");
          pill.className = `px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm border ${colorClass}`;
          pill.textContent = `${count} ${label}`;
          summaryBadges.appendChild(pill);
        }
      };

      makeBadge(
        summaryCount.Sakit,
        "Sakit",
        window.getStatusMeta("Sakit").pill,
      );
      makeBadge(
        summaryCount.Izin,
        "Izin",
        window.getStatusMeta("Izin").pill,
      );
      makeBadge(
        summaryCount.Pulang,
        "Pulang",
        window.getStatusMeta("Pulang").pill,
      );
      makeBadge(
        summaryCount.Alpa,
        "Alpa",
        window.getStatusMeta("Alpa").pill,
      );
      makeBadge(
        summaryCount.Telat,
        "Telat",
        window.getStatusMeta("Telat").pill,
      );

      summaryList.forEach((item) => {
        let badgeClass =
          "px-2 py-1 rounded-md text-[10px] font-bold inline-block m-0.5 border";

        badgeClass += ` ${window.getStatusMeta(item.status).pill}`;

        const badge = document.createElement("span");
        badge.className = badgeClass;
        badge.textContent = window.sanitizeHTML(item.nama);
        summaryNames.appendChild(badge);
      });
    } else {
      summaryWidget.classList.add("hidden");
    }
  }

  const initializedCount = FILTERED_SANTRI.filter((s) => {
    const id = String(s.nis || s.id);

    return dbSlot[id];
  }).length;

  if (
    initializedCount === FILTERED_SANTRI.length &&
    !hasAutoChanges &&
    dbSlot.__requiresReview !== true &&
    dbSlot.__reviewConfirmed !== true
  ) {
    dbSlot.__reviewConfirmed = true;
  }

  const needsReview =
    initializedCount === FILTERED_SANTRI.length &&
    dbSlot.__requiresReview === true &&
    dbSlot.__reviewConfirmed !== true;

  if (window.renderAttendanceReviewGate) {
    window.renderAttendanceReviewGate(
      container,
      dateKey,
      slot.id,
      needsReview,
    );
  }

  if (
    (initializedCount === FILTERED_SANTRI.length || hasAutoChanges) &&
    !needsReview
  ) {
    window.saveData();
  }
  if (window.refreshIcons) window.refreshIcons();
};

// ==========================================
// PERBAIKAN FUNGSI TOGGLE STATUS
// ==========================================

window.toggleStatus = function (id, actId, type) {
  console.log("[AttendanceManager] toggleStatus called:", { id, actId, type, slotId: appState.currentSlotId, date: appState.date });

  const slotId = appState.currentSlotId;
  const dateKey = appState.date;

  // Safety check data
  if (!appState.attendanceData[dateKey]) appState.attendanceData[dateKey] = {};
  if (!appState.attendanceData[dateKey][slotId])
    appState.attendanceData[dateKey][slotId] = {};
  if (!appState.attendanceData[dateKey][slotId][id])
    appState.attendanceData[dateKey][slotId][id] = { status: {}, note: "" };

  const sData = appState.attendanceData[dateKey][slotId][id];
  const curr = sData.status[actId] || (type === "mandator" ? "Hadir" : "Ya");
  let next = "";

  // 1. TENTUKAN STATUS BARU (LOGIKA SIKLUS)
  if (type === "mandator") {
    if (curr === "Hadir") next = "Alpa";
    else if (curr === "Alpa") next = "Sakit";
    else if (curr === "Sakit") next = "Izin";
    else if (curr === "Izin") next = "Pulang";
    else if (curr === "Pulang") next = "Telat";
    else next = "Hadir";
  } else {
    // Siklus Sunnah: Ya -> Tidak -> Ya
    next = curr === "Ya" ? "Tidak" : "Ya";
  }

  // Terapkan status baru ke tombol yang diklik
  sData.status[actId] = next;

  // TIMESTAMP - Catat waktu presensi
  if (!sData.timestamps) sData.timestamps = {};
  sData.timestamps[actId] = new Date().toISOString();

  // AUDIT TRAIL - Catat perubahan status
  if (!sData.auditTrail) sData.auditTrail = [];
  sData.auditTrail.push({
    action: "status_change",
    from: curr,
    to: next,
    activity: actId,
    slot: slotId,
    at: new Date().toISOString(),
    by: window.getCurrentActorName ? window.getCurrentActorName() : "Musyrif"
  });

  // LOGIKA OTOMATIS (CASCADING)
  // Cek konfigurasi kegiatan yang sedang diklik
  const currentSlotConfig = SLOT_WAKTU[slotId];
  const clickedActConfig = currentSlotConfig.activities.find(
    (a) => a.id === actId,
  );

  // JIKA YANG DIKLIK ADALAH 'FARDU' (SHALAT UTAMA)
  // Maka kegiatan lain harus menyesuaikan
  if (
    clickedActConfig &&
    clickedActConfig.category === "fardu" &&
    actId === "shalat"
  ) {
    const isNonHadir = ["Sakit", "Izin", "Pulang", "Alpa"].includes(next);

    currentSlotConfig.activities.forEach((otherAct) => {
      if (otherAct.id === actId) return; // Jangan ubah diri sendiri

      if (isNonHadir) {
        // KASUS: SHALAT TIDAK HADIR (S/I/A)

        if (otherAct.category === "dependent") {
          // Dzikir/Rawatib -> Otomatis TIDAK
          sData.status[otherAct.id] = "Tidak";
        } else if (otherAct.category === "kbm") {
          // Tahfizh/Conver -> Mengikuti status shalat (misal: Sakit)
          sData.status[otherAct.id] = next;
        } else if (otherAct.category === "sunnah") {
          // Tahajjud/Dhuha -> Otomatis TIDAK
          sData.status[otherAct.id] = "Tidak";
        }
      } else {
        // KASUS: SHALAT KEMBALI HADIR

        if (otherAct.category === "dependent") {
          // Dzikir/Rawatib -> Reset ke YA
          sData.status[otherAct.id] = "Ya";
        } else if (otherAct.category === "kbm") {
          // Tahfizh/Conver -> Reset ke HADIR
          sData.status[otherAct.id] = "Hadir";
        }
        // Untuk kategori 'sunnah' biasa (Tahajjud), biarkan apa adanya
        // agar tidak mereset inputan manual musyrif.
      }
    });
  }

  // Trigger notifications based on attendance status
  if (type === "mandator") {
    const student = (Array.isArray(FILTERED_SANTRI) ? FILTERED_SANTRI : []).find(s => String(s.nis || s.id) === String(id));
    const studentName = student ? (student.nama || student.name) : "Santri";

    console.log("[AttendanceManager] Notification check - type:", type, "id:", id, "next:", next, "FILTERED_SANTRI:", FILTERED_SANTRI?.length);

    // 1. Notify Wali if not present (Alpa/Sakit/Izin/Telat)
    if (["Alpa", "Sakit", "Izin", "Telat"].includes(next)) {
      console.log("[AttendanceManager] Sending notification to Wali for:", studentName, next);
      if (typeof window.addNotification === "function") {
        const slotLabel = SLOT_WAKTU[slotId]?.label || slotId;
        window.addNotification(
          "wali",
          id,
          "Laporan Kehadiran 📋",
          `${studentName} dicatat "${next}" pada sesi presensi ${slotLabel} tanggal ${dateKey}.`,
          "attendance",
          "tab=report"
        );
      } else {
        console.warn("[AttendanceManager] addNotification function not found!");
      }

      // 2. Notify Musyrif if student accumulates >= 3 Alpas in 30 days
      if (next === "Alpa") {
        try {
          let alpaCount = 0;
          const daysToCheck = 30;
          for (let i = 0; i < daysToCheck; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split("T")[0];
            const dayData = appState.attendanceData?.[dateStr];
            if (dayData) {
              Object.keys(dayData).forEach((sId) => {
                const slotData = dayData[sId];
                const statusObj = slotData[id];
                if (statusObj && statusObj.status) {
                  const mainStatus = statusObj.status.shalat || statusObj.status.kehadiran || statusObj.status.subuh || "";
                  if (mainStatus === "Alpa" || mainStatus === "A") {
                    alpaCount++;
                  }
                }
              });
            }
          }
          if (alpaCount >= 3) {
            const musyrifEmail = appState.userProfile?.email || "musyrif@syamsa.local";
            if (typeof window.addNotification === "function") {
              window.addNotification(
                "musyrif",
                musyrifEmail,
                "Perhatian Khusus ⚠️",
                `${studentName} tercatat telah ${alpaCount}x Alpa dalam 30 hari terakhir. Perlu pembinaan khusus.`,
                "system",
                "tab=home"
              );
            }
          }
        } catch (err) {
          console.warn("Failed to check alpa count trigger:", err);
        }
      }
    }
  }

  // Simpan & Refresh UI
  window.saveData();
  window.renderAttendanceList(); // Render ulang agar perubahan otomatis terlihat
  window.refreshPembinaanSurfaces?.();

  if (appState.date === window.getLocalDateStr()) {
    window.updateDashboard();
  }
};

// Fungsi untuk membuka Modal Menu Bulk (Akan dipanggil dari HTML)
window.openBulkMenu = function () {
  const modal = document.getElementById("modal-bulk-actions");
  if (modal) {
    modal.classList.remove("hidden");
    window.generateBulkButtons(); // Generate tombol sesuai slot aktif
  }
};

// Fungsi generate tombol dinamis berdasarkan kegiatan yang ada di slot saat ini
window.generateBulkButtons = function () {
  const container = document.getElementById("bulk-actions-content");
  const slot = SLOT_WAKTU[appState.currentSlotId];
  const currentDay = new Date(appState.date).getDay();

  container.innerHTML = "";

  // Cek ketersediaan kategori di slot ini
  const acts = slot.activities.filter(
    (a) =>
      (!a.showOnDays || a.showOnDays.includes(currentDay)) &&
      (!a.onlyRamadhan || window.isRamadhan(appState.date)),
  );
  const hasFardu = acts.some((a) => a.category === "fardu");
  const hasSchool = acts.some((a) => a.category === "school");
  const hasKbm = acts.some((a) => a.category === "kbm");
  const sunnahActs = acts.filter((a) => a.category === "sunnah");

  let html = "";
  const slotLabel = slot?.label || "Sesi ini";
  html += `
      <div class="rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 p-3">
          <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                  <p class="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Aksi tercepat</p>
                  <p class="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">Tandai semua santri hadir untuk ${window.sanitizeHTML(slotLabel)}, lalu ubah pengecualian satu per satu.</p>
              </div>
          </div>
          <button onclick="window.applyBulkPresentForCurrentSlot()" class="mt-3 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-sm shadow-emerald-500/20 active:scale-95 transition-all">
              Tandai Semua Hadir
          </button>
      </div>`;

  // 1. Bagian Shalat Fardu (Otomatis handle dependent: Qabliyah/Badiyah/Dzikir)
  if (hasFardu) {
    html += `
        <div class="mb-4">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Shalat & Rawatib</p>
            <div class="grid grid-cols-3 gap-2">
                <button onclick="window.applyBulkAction('fardu', 'Hadir')" class="py-3 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/30 active:scale-95 transition-all">
                    Hadir
                </button>
                <button onclick="window.applyBulkAction('fardu', 'Telat')" class="py-3 rounded-xl bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/30 active:scale-95 transition-all">
                    Telat
                </button>
                <button onclick="window.applyBulkAction('fardu', 'Alpa')" class="py-3 rounded-xl bg-red-100 text-red-600 font-bold text-xs border border-red-200 active:scale-95 transition-all">
                    Alpa
                </button>
            </div>
            <p class="text-[9px] text-slate-400 mt-1.5 italic">*Dzikir & Rawatib akan menyesuaikan status shalat.</p>
        </div>`;
  }

  if (hasSchool) {
    html += `
        <div class="mb-4">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Berangkat Sekolah
            </p>
    
            <div class="flex gap-2">
    
                <button
                    onclick="window.applyBulkAction('school','Hadir')"
                    class="flex-1 py-3 rounded-xl bg-cyan-500 text-white font-bold text-xs">
    
                    Hadir Semua
    
                </button>
    
                <button
                    onclick="window.applyBulkAction('school','Alpa')"
                    class="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold text-xs">
    
                    Alpa Semua
    
                </button>
    
            </div>
        </div>
        `;
  }

  // 2. Bagian KBM Asrama
  if (hasKbm) {
    html += `
        <div class="mb-4">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pembelajaran Asrama</p>
            <div class="flex gap-2">
                <button onclick="window.applyBulkAction('kbm', 'Hadir')" class="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
                    Hadir Semua
                </button>
                <button onclick="window.applyBulkAction('kbm', 'Alpa')" class="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold text-xs border border-red-200 active:scale-95 transition-all">
                    Alpa Semua
                </button>
            </div>
        </div>`;
  }

  // 3. Bagian Sunnah Spesifik (Tahajjud, Dhuha, dll)
  if (sunnahActs.length > 0) {
    html += `<div class="mb-2"><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ibadah Sunnah</p><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">`;

    sunnahActs.forEach((act) => {
      html += `
            <div class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${act.label}</span>
                </div>
                <div class="flex gap-1">
                    <button onclick="window.applyBulkAction('specific', 'Ya', '${act.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-colors">Ya</button>
                    <button onclick="window.applyBulkAction('specific', 'Tidak', '${act.id}')" class="flex-1 py-1.5 rounded-lg bg-slate-200 text-slate-500 text-[10px] font-bold hover:bg-slate-300 transition-colors">Tdk</button>
                </div>
            </div>`;
    });

    html += `</div></div>`;
  }

  container.innerHTML = html;
};

window.applyBulkPresentForCurrentSlot = function () {
  const slotId = appState.activeAttendanceSlotId || appState.currentSlotId;
  const dateKey = appState.date;
  const slot = SLOT_WAKTU[slotId];
  const currentDay = new Date(dateKey).getDay();
  if (!slot) return;

  if (!appState.attendanceData[dateKey]) appState.attendanceData[dateKey] = {};
  if (!appState.attendanceData[dateKey][slotId]) appState.attendanceData[dateKey][slotId] = {};
  const dbSlot = appState.attendanceData[dateKey][slotId];

  FILTERED_SANTRI.forEach((s) => {
    const id = String(s.nis || s.id);
    if (!dbSlot[id]) dbSlot[id] = { status: {}, note: "" };

    slot.activities.forEach((act) => {
      if (window.isActivityHoliday(dateKey, slot.id, act.id)) return;
      if (window.isCategoryHoliday(dateKey, act.category)) return;
      if (act.showOnDays && !act.showOnDays.includes(currentDay)) return;
      if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return;

      if (["fardu", "school", "kbm"].includes(act.category)) {
        dbSlot[id].status[act.id] = "Hadir";
      } else if (["dependent", "sunnah"].includes(act.category)) {
        dbSlot[id].status[act.id] = "Ya";
      }
    });

    if (Object.keys(dbSlot[id].status || {}).length > 0) {
      dbSlot[id].inputDate = window.getLocalDateStr();
      dbSlot[id].updatedAt = new Date().toISOString();
    }
  });

  window.saveData();
  window.renderAttendanceList();
  window.refreshPembinaanSurfaces?.();
  window.showToast("Semua santri ditandai hadir. Ubah pengecualian bila ada.", "success");
  window.closeModal("modal-bulk-actions");
};

// Logika Eksekusi Bulk Action
window.applyBulkAction = function (targetCategory, value, specificId = null) {
  console.log("[AttendanceManager] applyBulkAction called:", { targetCategory, value, specificId });

  const slotId = appState.currentSlotId;
  const dateKey = appState.date;
  const slot = SLOT_WAKTU[slotId];
  const currentDay = new Date(appState.date).getDay();

  // Prepare structure
  if (!appState.attendanceData[dateKey]) appState.attendanceData[dateKey] = {};
  if (!appState.attendanceData[dateKey][slotId])
    appState.attendanceData[dateKey][slotId] = {};
  const dbSlot = appState.attendanceData[dateKey][slotId];

  FILTERED_SANTRI.forEach((s) => {
    const id = String(s.nis || s.id);
    if (!dbSlot[id]) dbSlot[id] = { status: {}, note: "" };

    slot.activities.forEach((act) => {
      if (window.isActivityHoliday(dateKey, slot.id, act.id)) {
        return;
      }
      if (window.isCategoryHoliday(dateKey, act.category)) {
        return;
      }
      if (act.showOnDays && !act.showOnDays.includes(currentDay)) return;
      if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return;

      // LOGIKA 1: Fardu & Dependent (Ikut Shalat)
      if (targetCategory === "fardu") {
        if (act.category === "fardu") {
          dbSlot[id].status[act.id] = value; // Hadir / Alpa
        } else if (act.category === "dependent") {
          // Jika Shalat Hadir -> Dependent = Ya
          // Jika Shalat Alpa/Sakit -> Dependent = Tidak
          dbSlot[id].status[act.id] = value === "Hadir" ? "Ya" : "Tidak";
        }
      }

      // LOGIKA 2: KBM Asrama
      else if (targetCategory === "kbm" && act.category === "kbm") {
        dbSlot[id].status[act.id] = value; // Hadir / Alpa
      } else if (targetCategory === "school" && act.category === "school") {
        dbSlot[id].status[act.id] = value;
      }

      // LOGIKA 3: Specific Sunnah (Dhuha, Tahajjud, dll)
      else if (targetCategory === "specific" && act.id === specificId) {
        dbSlot[id].status[act.id] = value; // Ya / Tidak
      }
    });
  });

  window.saveData();
  window.renderAttendanceList();
  window.refreshPembinaanSurfaces?.();
  window.showToast("Data berhasil diperbarui secara massal", "success");
  window.closeModal("modal-bulk-actions");
};

window.toggleProblemFilter = function () {
  appState.filterProblemOnly = !appState.filterProblemOnly;
  const btn = document.getElementById("btn-filter-problem");

  if (appState.filterProblemOnly) {
    btn.classList.add("text-red-500", "bg-red-50", "border-red-200");
    btn.classList.remove("text-slate-500", "bg-white");
  } else {
    btn.classList.remove("text-red-500", "bg-red-50", "border-red-200");
    btn.classList.add("text-slate-500", "bg-white");
  }

  window.renderAttendanceList();
};

window.handleSearch = function (val) {
  appState.searchQuery = val;
  window.renderAttendanceList();
};

window.handleQuickPresence = function () {
  const currentSlot = window.determineCurrentSlot();
  if (currentSlot && SLOT_WAKTU[currentSlot]) {
    appState.currentSlotId = currentSlot;
    
    // Check if slot is holiday today
    if (window.isSlotHoliday(currentSlot, appState.date)) {
      return window.showToast(
        `Sesi presensi ${SLOT_WAKTU[currentSlot].label} libur hari ini.`,
        "info"
      );
    }
    
    // Check if slot is accessible
    const access = window.isSlotAccessible(currentSlot, appState.date);
    if (access.locked) {
      let msg = `Sesi ${SLOT_WAKTU[currentSlot].label} (${SLOT_WAKTU[currentSlot].subLabel || ''}) belum dibuka/diakses saat ini.`;
      if (access.reason === "wait") {
        msg = `Sesi ${SLOT_WAKTU[currentSlot].label} (${SLOT_WAKTU[currentSlot].subLabel || ''}) belum masuk waktu presensi.`;
      } else if (access.reason === "limit") {
        msg = `Akses sesi ${SLOT_WAKTU[currentSlot].label} dikunci (batas edit data lampau).`;
      }
      return window.showToast(msg, "warning");
    }

    // Open presence panel
    window.openAttendance();
  } else {
    window.showToast("Tidak ada sesi presensi aktif saat ini.", "info");
  }
};
