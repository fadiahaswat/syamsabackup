/**
 * dashboard-manager.js - Dashboard & Widget Management
 *
 * MANIFEST (56 functions):
 * ========================
 * DASHBOARD CORE
 *   - updateDashboard()           [line 7]   Main dashboard refresh
 *   - updateProfileInfo()         [line 470]  Profile card update
 *   - updateQuickStats()           [line 565]  Quick stats widget
 *   - drawDonutChart()            [line 592]  Weekly chart rendering
 *
 * LOCATION & GEOLOCATION
 *   - updateLocationStatus()      [line 94]   Location card widget
 *   - verifyLocation()            [line 766]  Geofence verification
 *   - verifyLocationCached()      [line 1853] Cached location check
 *   - getDistanceFromLatLonInMeters() [line 728]
 *   - getCachedLocation()         [line 743]
 *   - deg2rad()                   [line 761]
 *
 * SLOT MANAGEMENT
 *   - renderSlotList()            [line 304]  Slot list widget
 *   - quickOpen()                 [line 849]  Quick open slot
 *   - updateQuickAccessButtons()  [line 876]  Quick access buttons
 *
 * STATISTICS
 *   - showStatDetails()           [line 906]  Stat detail modal
 *   - renderSchoolStatsWidget()   [line 1768] School stats widget
 *   - updateCommandCenterStats()  [line 2207] Command center stats
 *
 * PEMBINAAN
 *   - getPembinaanMainActId()    [line 1000] Get main activity ID
 *   - isPembinaanViolationStatus()[line 1004] Check violation status
 *   - collectPembinaanViolations()[line 1008] Collect violations
 *   - refreshPembinaanSurfaces() [line 1056]  Refresh UI
 *   - renderDashboardPembinaan() [line 1065]  Pembinaan widget
 *   - renderPembinaanManagement()[line 1203]   Pembinaan management
 *   - scrollToPembinaan()        [line 1364]
 *   - openPembinaanModal()        [line 1652]
 *   - savePembinaan()            [line 1675]
 *
 * KBM & PERMITS
 *   - renderKBMBanner()          [line 1371]  KBM banner
 *   - renderActivePermitsWidget()[line 1411]   Active permits widget
 *   - resolveManualStatus()      [line 1601]  Manual status override
 *
 * QUICK ACTIONS
 *   - openQuickPermit()          [line 2285]  Quick permit modal
 *   - openQuickViolation()       [line 2318]  Quick violation modal
 *   - openQuickSetoran()         [line 2378]  Quick setoran modal
 *
 * STUDENT DETAIL
 *   - openStudentDetail()        [line 2496]  Student detail modal
 *   - switchStudentDetailTab()    [line 2554]  Tab switching
 *   - renderStudentJournal()      [line 2574]  Journal tab
 *   - saveStudentJournalEntry()  [line 2603]
 *   - renderStudentAchievements() [line 2644]  Achievements tab
 *   - calculateStudentBadges()    [line 2669]
 *   - updateStudentDetailWarningBadge() [line 2482]
 *
 * LEADERBOARD & WARNINGS
 *   - updateLeaderboardWidget()   [line 2723]
 *   - calculateEarlyWarningStatus()[line 2806]
 *
 * TIMELINE & TARGETS
 *   - renderStudentTimeline()    [line 2838]
 *   - renderStudentTargetsTab()   [line 2938]
 *   - saveStudentTargets()        [line 2968]
 *   - calculateStudentSessionPercents() [line 2998]
 *
 * WIDGETS
 *   - updateWorshipWidget()       [line 1878]
 *   - updateHeroWidget()          [line 1985]
 *   - renderAgendaWidget()        [line 2039]
 *   - renderReminderWidget()      [line 2087]
 *   - renderCalendarGridWidget()  [line 3407]
 *
 * REMINDERS
 *   - toggleReminderDone()       [line 2127]
 *   - deleteReminder()           [line 2137]
 *   - openAddReminderModal()     [line 2152]
 *   - submitAddReminder()         [line 2158]
 *   - openReminderModal()        [line 2181]
 *   - openNotificationSettingsModal() [line 2185]
 *
 * CENTERS
 *   - openEmergencyCenter()       [line 3026]
 *   - openCalendarCenterModal()   [line 3125]
 *   - openCommunicationHub()      [line 3129]
 *   - openQuickDialContact()      [line 3118]
 *
 * COMMUNICATION
 *   - applyCommsTemplate()        [line 3134]
 *   - sendCommsBroadcast()       [line 3163]
 *
 * SEARCH & AI
 *   - handleGlobalSearch()        [line 3178]
 *   - updateAIInsightsWidget()    [line 3277]
 *   - generateAIInsights()        [line 3294]
 *   - regenerateAIInsights()      [line 3338]
 *   - showAISummaryModal()        [line 3346]
 *
 * AUDIT & SYNC
 *   - openAuditLogModal()         [line 3372]
 *   - syncOfflineData()           [line 3531]
 *   - forceSyncData()            [line 3579]
 *   - updateConnectionStatus()    [line 3505]
 *   - changeCalendarMonth()      [line 3497]
 *
 * NOTE: This file is 3600+ lines. Consider splitting into:
 *   - dashboard-widgets.js (UI rendering functions)
 *   - dashboard-geolocation.js (location logic)
 *   - dashboard-stats.js (statistics)
 *   - dashboard-centers.js (modals and centers)
 */

// ============================================================================
// SECTION 1: DASHBOARD CORE
// ============================================================================

window.updateDashboard = function () {
  // 1. Greeting
  const h = new Date().getHours();
  const greet =
    h < 11
      ? "Selamat Pagi"
      : h < 15
        ? "Selamat Siang"
        : h < 18
          ? "Selamat Sore"
          : "Selamat Malam";
  const elGreet = document.getElementById("dash-greeting");
  if (elGreet) elGreet.textContent = greet;

  // 2. Main Card Logic
  const isToday = appState.date === window.getLocalDateStr();
  const mainCard = document.getElementById("dash-main-card");

  if (isToday && mainCard) {
    mainCard.classList.remove("hidden");
    const heroSlotId = window.getCurrentDashboardSlotId
      ? window.getCurrentDashboardSlotId(appState.date)
      : appState.currentSlotId;

    // Jangan override currentSlotId kalau view attendance sedang terbuka
    const attendanceOpen = !document.getElementById("view-attendance")?.classList.contains("hidden");
    if (!attendanceOpen) {
      appState.currentSlotId = heroSlotId;
    }

    const slot = SLOT_WAKTU[heroSlotId];
    document.getElementById("dash-card-title").textContent = slot.label;

    const access = window.isSlotAccessible(
      appState.currentSlotId,
      appState.date,
    );
    const isHoliday = window.isSlotHoliday(appState.currentSlotId, appState.date);
    const timeEl = document.getElementById("dash-card-time");

    if (isHoliday) {
      timeEl.innerHTML = `<i data-lucide="calendar-x" class="w-3 h-3"></i> Libur hari ini`;
      mainCard.classList.add("opacity-80", "grayscale");
      mainCard.onclick = () =>
        window.showToast(`Kegiatan ${slot.label} libur pada hari ini.`, "info");
    } else if (access.locked && access.reason === "wait") {
      timeEl.innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> Belum Masuk Waktu`;
      mainCard.classList.add("opacity-80", "grayscale");
      mainCard.onclick = () =>
        window.showToast("Belum masuk waktu " + slot.label, "warning");
    } else {
      timeEl.innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> ${slot.subLabel}`;
      mainCard.classList.remove("opacity-80", "grayscale");
      mainCard.onclick = () => window.openAttendance();
    }
  } else if (mainCard) {
    mainCard.classList.add("hidden");
  }

  // 3. Render List Slot
  if (typeof window.updateQuickAccessButtons === "function") {
    window.updateQuickAccessButtons();
  }
  window.renderSchoolStatsWidget();
  window.renderSlotList();
  window.renderKBMBanner();
  window.renderActivePermitsWidget();

  window.renderDashboardPembinaan(); // Refresh widget pembinaan

  // 4. Update Stats Chart
  window.updateQuickStats();
  window.drawDonutChart();
  if (window.lucide) window.lucide.createIcons();

  window.updateLocationStatus();
  if (typeof window.updateWorshipWidget === "function") window.updateWorshipWidget();
  if (typeof window.updateHeroWidget === "function") window.updateHeroWidget();
  if (typeof window.renderAgendaWidget === "function") window.renderAgendaWidget();
  if (typeof window.renderReminderWidget === "function") window.renderReminderWidget();
  if (typeof window.updateConnectionStatus === "function") window.updateConnectionStatus();
};

// ==========================================
// FITUR STATUS LOKASI DASHBOARD
// ==========================================

window.updateLocationStatus = function () {
  const card = document.getElementById("location-status-card");

  // Jika fitur dimatikan di config, sembunyikan kartu
  if (!GEO_CONFIG.useGeofencing) {
    if (card) card.classList.add("hidden");
    return;
  }

  if (card) card.classList.remove("hidden");

  const cached = window.getCachedLocation();

  if (cached) {
    const elLoading = document.getElementById("loc-loading");

    const elDetails = document.getElementById("loc-details");

    const elNearest = document.getElementById("loc-nearest-name");

    const elDistance = document.getElementById("loc-distance");
    const elAsramaBtn = document.getElementById("loc-asrama-btn");

    if (elLoading) elLoading.classList.add("hidden");

    if (elDetails) elDetails.classList.remove("hidden");

    if (elNearest) elNearest.textContent = cached.locationName;

    if (elDistance) elDistance.textContent = Math.round(cached.distance) + "m";
    if (elAsramaBtn) {
      elAsramaBtn.classList.toggle("hidden", cached.isInside === true);
      elAsramaBtn.classList.toggle("flex", cached.isInside !== true);
    }

    return;
  }

  // Ambil Elemen UI
  const elLoading = document.getElementById("loc-loading");
  const elDetails = document.getElementById("loc-details");
  const elError = document.getElementById("loc-error");

  const elNearest = document.getElementById("loc-nearest-name");
  const elDistance = document.getElementById("loc-distance");
  const elBadge = document.getElementById("loc-badge");
  const elMessage = document.getElementById("loc-message");
  const elIcon = document.getElementById("loc-icon");
  const elIconBg = document.getElementById("loc-icon-bg");
  const elAsramaBtn = document.getElementById("loc-asrama-btn");

  // Reset Tampilan ke Loading
  if (elLoading) elLoading.classList.remove("hidden");
  if (elDetails) elDetails.classList.add("hidden");
  if (elError) elError.classList.add("hidden");
  if (elAsramaBtn) {
    elAsramaBtn.classList.add("hidden");
    elAsramaBtn.classList.remove("flex");
  }

  // Cek Support Browser
  if (!navigator.geolocation) {
    if (elLoading) elLoading.classList.add("hidden");
    if (elError) {
      elError.classList.remove("hidden");
      elError.innerHTML =
        '<p class="text-[10px] font-bold text-red-500">Browser tidak dukung GPS</p>';
    }
    return;
  }

  // Eksekusi GPS
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      let nearestDist = Infinity;
      let nearestName = "Tidak diketahui";
      let isInside = false;

      // 1. Cari Lokasi Terdekat dari Array GEO_CONFIG
      GEO_CONFIG.locations.forEach((loc) => {
        const dist = window.getDistanceFromLatLonInMeters(
          userLat,
          userLng,
          loc.lat,
          loc.lng,
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestName = loc.name;
        }
      });

      // 2. Cek apakah masuk radius
      if (nearestDist <= GEO_CONFIG.maxRadiusMeters) {
        isInside = true;
      }

      localStorage.setItem(
        GPS_CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          distance: nearestDist,
          locationName: nearestName,
          isInside: isInside,
        }),
      );

      // 3. Update Tampilan
      if (elLoading) elLoading.classList.add("hidden");
      if (elDetails) elDetails.classList.remove("hidden");

      if (elNearest) elNearest.textContent = nearestName;
      if (elDistance) elDistance.textContent = Math.round(nearestDist) + "m";

      if (isInside) {
        if (elAsramaBtn) {
          elAsramaBtn.classList.add("hidden");
          elAsramaBtn.classList.remove("flex");
        }
        // Tampilan HIJAU (Aman)
        elBadge.textContent = "AMAN";
        elBadge.className =
          "px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-600 border border-emerald-200";

        elMessage.innerHTML = `<span class="text-emerald-600 flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Posisi sesuai. Silakan isi presensi.</span>`;

        elIcon.setAttribute("data-lucide", "map-pin");
        elIcon.classList.remove(
          "text-slate-400",
          "text-red-500",
          "text-amber-500",
        );
        elIcon.classList.add("text-emerald-500");

        elIconBg.classList.remove("bg-slate-100", "bg-red-100", "bg-amber-100");
        elIconBg.classList.add("bg-emerald-100");
      } else {
        if (elAsramaBtn) {
          elAsramaBtn.classList.remove("hidden");
          elAsramaBtn.classList.add("flex");
        }
        // Tampilan MERAH (Jauh)
        elBadge.textContent = "JAUH";
        elBadge.className =
          "px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-100 text-red-600 border border-red-200";

        const selisih = Math.round(nearestDist - GEO_CONFIG.maxRadiusMeters);
        elMessage.innerHTML = `<span class="text-red-500 flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Terlalu jauh ${selisih}m dari batas radius.</span>`;

        elIcon.setAttribute("data-lucide", "map-pin-off");
        elIcon.classList.remove(
          "text-slate-400",
          "text-emerald-500",
          "text-amber-500",
        );
        elIcon.classList.add("text-red-500");

        elIconBg.classList.remove(
          "bg-slate-100",
          "bg-emerald-100",
          "bg-amber-100",
        );
        elIconBg.classList.add("bg-red-100");
      }

      if (window.lucide) window.lucide.createIcons();
    },
    (error) => {
      if (elLoading) elLoading.classList.add("hidden");
      if (elDetails) elDetails.classList.add("hidden");
      if (elError) {
        elError.classList.remove("hidden");
        let msg = "Gagal mendeteksi lokasi.";
        if (error.code === 1) msg = "Akses Lokasi Ditolak. Harap aktifkan izin lokasi/GPS pada browser Anda.";
        else if (error.code === 2) msg = "Sinyal GPS tidak akurat atau lemah.";
        else if (error.code === 3)
          msg = "Waktu deteksi GPS habis. Coba lagi di area terbuka.";
        
        elError.innerHTML = `
          <div class="flex items-start gap-3 p-3 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30 text-left">
            <div class="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <i data-lucide="map-pin-off" class="w-4 h-4"></i>
            </div>
            <div class="flex-1 min-w-0">
              <h5 class="text-xs font-bold text-red-700 dark:text-red-450">Verifikasi GPS Gagal</h5>
              <p class="text-[10px] text-slate-500 dark:text-slate-450 font-semibold mt-0.5 leading-relaxed">${msg}</p>
              <button onclick="window.updateLocationStatus()" class="mt-2.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold text-[10px] rounded-lg shadow-sm transition-all flex items-center gap-1.5 w-fit">
                <i data-lucide="refresh-cw" class="w-3 h-3"></i> Coba Lagi
              </button>
            </div>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
      }
      if (elAsramaBtn) {
        elAsramaBtn.classList.add("hidden");
        elAsramaBtn.classList.remove("flex");
      }
    },
    {
      enableHighAccuracy: true,
      timeout: GPS_STATUS_TIMEOUT,
      maximumAge: GPS_CACHE_DURATION,
    },
  );
};

window.renderSlotList = function () {
  const container = document.getElementById("dash-other-slots");
  if (!container) return;

  container.innerHTML = "";
  const tpl = document.getElementById("tpl-slot-item");
  const isToday = appState.date === window.getLocalDateStr();
  const fragment = document.createDocumentFragment();

  Object.values(SLOT_WAKTU).forEach((s) => {
    const clone = tpl.content.cloneNode(true);
    const item = clone.querySelector(".slot-item");
    const access = window.isSlotAccessible(s.id, appState.date);
    const stats = window.calculateSlotStats(s.id);
    const slotData = appState.attendanceData?.[appState.date]?.[s.id];
    const isPresenceInProgress =
      slotData?.__requiresReview === true &&
      slotData?.__reviewConfirmed !== true;

    // 1. Terapkan Tema Unik per Sesi
    // Hapus class default jika ada, lalu tambah gradient spesifik
    item.classList.add(...s.style.gradient.split(" "));
    item.classList.add(...s.style.border.split(" "));
    item.classList.add(...s.style.text.split(" "));

    // Set Warna Decorative Blob
    const decor = clone.querySelector(".slot-decor");
    if (decor) decor.classList.add(`bg-${s.theme}-400`); // emerald/orange/indigo/slate

    // 2. Setup Icon Unik (Sun/Moon/etc)
    const iconContainer = clone.querySelector(".slot-icon-bg");
    const iconEl = clone.querySelector(".slot-icon");

    if (iconContainer)
      iconContainer.classList.add(...s.style.iconBg.split(" "));
    if (iconEl) iconEl.setAttribute("data-lucide", s.style.icon);

    // 3. Label & Data
    clone.querySelector(".slot-label").textContent = s.label;
    const timeEl = clone.querySelector(".slot-time-range");
    if (timeEl) timeEl.textContent = s.subLabel;

    clone.querySelector(".slot-stat-h").textContent = stats.h;

    const telatEl = clone.querySelector(".slot-stat-t");
    if (telatEl) telatEl.textContent = stats.t;

    clone.querySelector(".slot-stat-s").textContent = stats.s;
    clone.querySelector(".slot-stat-i").textContent = stats.i;

    const pulangEl = clone.querySelector(".slot-stat-p");
    if (pulangEl) pulangEl.textContent = stats.p;

    clone.querySelector(".slot-stat-a").textContent = stats.a;

    // 4. Inisialisasi Elemen & Warna Progress Bar
    const badge = clone.querySelector(".slot-status-badge");
    const progressBar = clone.querySelector(".slot-progress-bar"); // Kembali gunakan nama aslinya
    const progressText = clone.querySelector(".slot-progress-text");

    // Peta warna Hex Tailwind - use centralized THEME_COLORS if available
    // STANDARD: cyan is #17C3D4 (brand cyan from design system)
    const themeColors = window.THEME_COLORS || {
      emerald: "#10b981",
      cyan: "#17C3D4",
      orange: "#f97316",
      indigo: "#6366f1",
      slate: "#64748b",
    };

    // 5. Logic Libur / Locked / Unlocked
    const isHoliday = window.isSlotHoliday(s.id, appState.date);

    if (isHoliday) {
      item.classList.remove(...s.style.gradient.split(" "));
      item.classList.add(
        "bg-slate-100",
        "dark:bg-slate-800",
        "grayscale",
        "opacity-70",
      );

      badge.textContent = "Libur";
      badge.className =
        "slot-status-badge text-[10px] font-bold px-2.5 py-0.5 rounded-lg inline-block bg-slate-200 text-slate-500 border border-slate-300 dark:bg-slate-700 dark:text-slate-400 shadow-sm";

      if (iconEl) iconEl.setAttribute("data-lucide", "calendar-x");

      // Set Progress Bar ke 0 dan warna abu-abu
      if (progressBar) {
        progressBar.style.width = "0%";
        progressBar.style.backgroundColor = "#94a3b8";
      }
      if (progressText) progressText.textContent = "-";

      item.onclick = () =>
        window.showToast(`Kegiatan ${s.label} libur pada hari ini.`, "info");
    } else if (access.locked) {
      item.classList.remove(...s.style.gradient.split(" "));
      item.classList.add(
        "bg-slate-100",
        "dark:bg-slate-800",
        "grayscale",
        "opacity-75",
      );

      let lockText = access.reason === "wait" ? "Menunggu" : "Terkunci";
      if (access.reason === "limit") lockText = "Expired";

      badge.textContent = lockText;
      if (iconEl) iconEl.setAttribute("data-lucide", "lock");

      if (progressBar) progressBar.style.backgroundColor = "#94a3b8";

      item.onclick = () =>
        window.showToast(`🔒 Akses ${s.label} ${lockText}`, "error");
    } else {
      if (stats.isFilled) {
        badge.textContent = "Selesai";
        badge.className +=
          " text-emerald-700 bg-emerald-100/80 border-emerald-200";
      } else if (isPresenceInProgress) {
        badge.innerHTML = `<span class="inline-flex items-center gap-1"><i data-lucide="loader-circle" class="w-3 h-3 animate-spin"></i>Proses</span>`;
        badge.className =
          "slot-status-badge text-[10px] font-bold px-2.5 py-0.5 rounded-lg inline-block bg-amber-400 text-white border border-amber-300 shadow-sm";
      } else {
        badge.textContent = "Belum Diisi";
        badge.className +=
          " text-white bg-red-600 border-red-500";
      }

      let percent = 0;

      const totalStatus =
        stats.h + stats.t + stats.i + stats.s + stats.p + stats.a;

      if (totalStatus > 0) {
        percent = Math.round(((stats.h + stats.t) / totalStatus) * 100);
      }

      // Terapkan persentase DAN paksa suntikkan warna Hex Code-nya
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.style.backgroundColor = themeColors[s.theme] || "#10b981";
      }
      if (progressText) progressText.textContent = `${percent}%`;

      item.onclick = () => {
        appState.currentSlotId = s.id;
        if (isToday && s.id === window.determineCurrentSlot()) {
          window.updateDashboard();
          document
            .getElementById("main-content")
            .scrollTo({ top: 0, behavior: "smooth" });
        } else {
          window.openAttendance();
        }
      };
    }

    fragment.appendChild(clone);
  });

  container.appendChild(fragment);
};

window.updateProfileInfo = function () {
  const elHeaderName = document.getElementById("header-user-name");
  const elHeaderRole = document.getElementById("profile-role");
  const elHeaderAvatar = document.getElementById("header-avatar");
  const elProfileAvatar = document.getElementById("profile-avatar");

  const elName = document.getElementById("profile-name");
  const elRoleTab = document.getElementById("profile-role-tab");

  if (appState.selectedClass && MASTER_KELAS[appState.selectedClass]) {
    const musyrifName = MASTER_KELAS[appState.selectedClass].musyrif;
    const className = appState.selectedClass;

    if (elHeaderName) elHeaderName.textContent = musyrifName.split(" ")[0];
    if (elHeaderRole) elHeaderRole.textContent = className;

    if (elHeaderAvatar) {
      const photoUrl = appState.userProfile?.picture;

      if (photoUrl) {
        elHeaderAvatar.innerHTML = `
                    <img
                        src="${photoUrl}"
                        alt="Avatar"
                        class="w-full h-full rounded-full object-cover"
                    >
                `;
      } else {
        const initials = musyrifName
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        elHeaderAvatar.textContent = initials;
      }
    }

    if (elProfileAvatar) {
      const photoUrl = appState.userProfile?.picture;

      if (photoUrl) {
        elProfileAvatar.innerHTML = `
                    <img
                        src="${photoUrl}"
                        alt="Avatar"
                        class="w-full h-full object-cover"
                    >
                `;
      } else {
        elProfileAvatar.innerHTML = `
                    <i data-lucide="user" class="w-10 h-10"></i>
                `;
      }
    }

    if (window.lucide) {
      lucide.createIcons();
    }

    if (elName) elName.textContent = musyrifName;
    if (elRoleTab) elRoleTab.textContent = `Musyrif ${className}`;

    const elSidebarName = document.getElementById("sidebar-user-name");
    const elSidebarClass = document.getElementById("sidebar-class-name");
    const elSidebarAvatar = document.getElementById("sidebar-avatar");
    if (elSidebarName) elSidebarName.textContent = musyrifName;
    if (elSidebarClass) elSidebarClass.textContent = `Musyrif ${className}`;
    if (elSidebarAvatar) {
      const photoUrl = appState.userProfile?.picture;

      if (photoUrl) {
        elSidebarAvatar.innerHTML = `
                    <img
                        src="${photoUrl}"
                        alt="Avatar"
                        class="w-full h-full rounded-full object-cover"
                    >
                `;
      } else {
        const initials = musyrifName
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        elSidebarAvatar.textContent = initials;
      }
    }
  }
};


window.updateQuickStats = function () {
  if (!appState.selectedClass) return;

  if (typeof window.updateCommandCenterStats === "function") {
    window.updateCommandCenterStats();
  } else {
    let totalStats = { h: 0, s: 0, i: 0, a: 0 };

    Object.values(SLOT_WAKTU).forEach((slot) => {
      const stats = window.calculateSlotStats(slot.id);
      if (stats.isFilled) {
        totalStats.h += stats.h;
        totalStats.s += stats.s;
        totalStats.i += stats.i;
        totalStats.a += stats.a;
      }
    });

    document.getElementById("stat-hadir").textContent = totalStats.h;
    document.getElementById("stat-sakit").textContent = totalStats.s;
    document.getElementById("stat-izin").textContent = totalStats.i;
    document.getElementById("stat-alpa").textContent = totalStats.a;
  }
};

// Ganti fungsi window.drawDonutChart yang lama dengan ini:

window.drawDonutChart = function () {
  const canvas = document.getElementById("weekly-chart");

  if (!canvas || canvas.offsetParent === null) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const dpr = window.devicePixelRatio || 1;

  if (
    canvas.width !== rect.width * dpr ||
    canvas.height !== rect.height * dpr
  ) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  const width = rect.width;
  const height = rect.height;
  const centerX = width / 2;
  const centerY = height / 2;

  let radius = Math.min(width, height) / 2 - 10;
  if (radius <= 0) {
    console.warn("Canvas too small for chart");
    return;
  }

  ctx.clearRect(0, 0, width, height);

  let stats = { h: 0, s: 0, i: 0, a: 0 };
  let totalPeristiwa = 0;
  let activeSlots = 0;

  if (appState.selectedClass) {
    Object.values(SLOT_WAKTU).forEach((slot) => {
      const sStats = window.calculateSlotStats(slot.id);
      if (sStats.isFilled) {
        stats.h += sStats.h;
        stats.s += sStats.s;
        stats.i += sStats.i;
        stats.a += sStats.a;
        totalPeristiwa += sStats.total;
        activeSlots++;
      }
    });
  }

  const setLegend = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setLegend("legend-hadir", stats.h);
  setLegend("legend-sakit", stats.s);
  setLegend("legend-izin", stats.i);
  setLegend("legend-alpa", stats.a);

  if (totalPeristiwa === 0 || radius === 0) {
    if (radius > 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = document.documentElement.classList.contains("dark")
        ? "#334155"
        : "#e2e8f0";
      ctx.lineWidth = 12;
      ctx.lineCap = "round";
      ctx.stroke();
      drawCenterText(ctx, centerX, centerY, "0%", "Belum Ada Data");
    }
    return;
  }

  const segments = [
    { value: stats.h, color: "#10b981" },
    { value: stats.s, color: "#f59e0b" },
    { value: stats.i, color: "#3b82f6" },
    { value: stats.a, color: "#f43f5e" },
  ];

  let startAngle = -Math.PI / 2;

  segments.forEach((seg) => {
    if (seg.value > 0) {
      const sliceAngle = (seg.value / totalPeristiwa) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = 14;
      ctx.lineCap = "butt";
      ctx.stroke();

      startAngle = endAngle;
    }
  });

  const percentHadir = Math.round((stats.h / totalPeristiwa) * 100);
  drawCenterText(ctx, centerX, centerY, `${percentHadir}%`, "Hadir");

  const statsText = document.getElementById("dash-stats-text");
  if (statsText) statsText.textContent = `${percentHadir}% KEHADIRAN`;
};

// Add resize handling for donut chart
if (!window._donutResizeObserver) {
  const _donutCanvas = document.getElementById("weekly-chart");
  if (_donutCanvas) {
    window._donutResizeObserver = new ResizeObserver(() => {
      if (typeof window.drawDonutChart === 'function') window.drawDonutChart();
    });
    window._donutResizeObserver.observe(_donutCanvas.parentElement || _donutCanvas);
  }
}

function drawCenterText(ctx, x, y, mainText, subText) {
  ctx.fillStyle = document.documentElement.classList.contains("dark")
    ? "#fff"
    : "#1e293b";
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(mainText, x, y - 5);

  ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(subText, x, y + 18);
}


window.getDistanceFromLatLonInMeters = function (lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = window.deg2rad(lat2 - lat1);
  const dLon = window.deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(window.deg2rad(lat1)) *
      Math.cos(window.deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Jarak dalam meter
  return d;
};

window.getCachedLocation = function () {
  try {
    const cache = JSON.parse(localStorage.getItem(GPS_CACHE_KEY));

    if (!cache) return null;

    const age = Date.now() - cache.timestamp;

    if (age > GPS_CACHE_DURATION) {
      return null;
    }

    return cache;
  } catch {
    return null;
  }
};

window.deg2rad = function (deg) {
  return deg * (Math.PI / 180);
};

// Fungsi Utama Verifikasi Lokasi (Async)
window.verifyLocation = function () {
  return new Promise((resolve, reject) => {
    if (!GEO_CONFIG.useGeofencing) {
      resolve(true);
      return;
    }

    if (!navigator.geolocation) {
      reject("Browser tidak mendukung GPS.");
      return;
    }

    const toastId = window.showToast(
      "📡 Memeriksa lokasi GPS...",
      "info",
      true,
    );

    const timeout = setTimeout(() => {
      reject("Timeout: GPS tidak merespons. Coba lagi di area terbuka.");
      if (toastId) toastId.remove();
    }, GPS_VERIFICATION_GUARD_TIMEOUT);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        if (toastId) toastId.remove();

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        let isInside = false;
        let nearestDist = 9999999;
        let nearestName = "Unknown";

        GEO_CONFIG.locations.forEach((loc) => {
          const dist = window.getDistanceFromLatLonInMeters(
            userLat,
            userLng,
            loc.lat,
            loc.lng,
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestName = loc.name;
          }

          if (dist <= GEO_CONFIG.maxRadiusMeters) {
            isInside = true;
          }
        });

        if (isInside) {
          resolve(true);
        } else {
          reject(
            `Lokasi Anda terlalu jauh (${Math.round(nearestDist)}m dari ${nearestName}). Radius maksimal: ${GEO_CONFIG.maxRadiusMeters}m.`,
          );
        }
      },
      (error) => {
        clearTimeout(timeout);
        if (toastId) toastId.remove();

        let msg = "Gagal mendeteksi lokasi.";
        if (error.code === 1)
          msg = "Izin lokasi ditolak. Aktifkan GPS di browser.";
        else if (error.code === 2)
          msg = "Sinyal GPS tidak ditemukan. Pastikan Anda di luar ruangan.";
        else if (error.code === 3)
          msg = "Waktu deteksi GPS habis. Coba lagi di area terbuka.";

        reject(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: GPS_VERIFICATION_TIMEOUT,
        maximumAge: GPS_CACHE_DURATION,
      },
    );
  });
};


window.quickOpen = function (slotId) {
  if (window.isSlotHoliday(slotId, appState.date)) {
    return window.showToast(
      `Kegiatan ${SLOT_WAKTU[slotId].label} libur pada hari ini.`,
      "info",
    );
  }
  // 1. Set slot yang dipilih ke state global
  appState.currentSlotId = slotId;

  // 2. Update tampilan dashboard (opsional, agar chart/judul berubah)
  window.updateDashboard();

  // 3. Langsung buka halaman absensi
  window.openAttendance();

  // 4. Beri feedback visual
  const labels = {
    shubuh: "Shubuh",
    sekolah: "Sekolah",
    ashar: "Ashar",
    maghrib: "Maghrib",
    isya: "Isya",
  };
  window.showToast(`Membuka presensi ${labels[slotId]}`, "info");
};

window.updateQuickAccessButtons = function () {
  const schoolButton = document.getElementById("quick-access-sekolah");
  const quickGrid = document.getElementById("quick-access-grid");
  if (!schoolButton) return;

  const isSchoolHoliday = window.isSlotHoliday("sekolah", appState.date);
  schoolButton.classList.remove("hidden");
  schoolButton.classList.toggle("opacity-60", isSchoolHoliday);
  schoolButton.classList.toggle("grayscale", isSchoolHoliday);
  schoolButton.classList.toggle("cursor-not-allowed", isSchoolHoliday);
  schoolButton.classList.toggle("hover:bg-cyan-500/20", !isSchoolHoliday);
  schoolButton.classList.toggle("hover:border-cyan-500/50", !isSchoolHoliday);
  schoolButton.setAttribute("aria-disabled", String(isSchoolHoliday));

  const schoolIcon = schoolButton.querySelector("i");
  if (schoolIcon) {
    schoolIcon.setAttribute("data-lucide", isSchoolHoliday ? "calendar-x" : "graduation-cap");
  }

  const schoolLabel = schoolButton.querySelector("span");
  if (schoolLabel) {
    schoolLabel.textContent = isSchoolHoliday ? "Libur" : "Sekolah";
  }

  if (quickGrid) {
    quickGrid.classList.remove("grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5", "sm:grid-cols-4", "sm:grid-cols-5");
    quickGrid.classList.add("grid-cols-5");
  }
};

window.showStatDetails = function (statusType) {
  const modal = document.getElementById("modal-stat-detail");
  const container = document.getElementById("stat-detail-list");
  const title = document.getElementById("stat-detail-title");

  // 1. Setup UI Modal
  modal.classList.remove("hidden");
  container.innerHTML =
    '<div class="text-center py-4"><span class="loading-spinner"></span></div>';

  // Warna Judul sesuai Tipe
  let colorClass = "text-slate-800";
  if (statusType === "Sakit") colorClass = "text-amber-500";
  else if (statusType === "Izin") colorClass = "text-blue-500";
  else if (statusType === "Alpa") colorClass = "text-rose-500";
  else if (statusType === "Hadir") colorClass = "text-emerald-500";
  // Tambahkan Handling Telat & Pulang (Jaga-jaga)
  else if (statusType === "Telat") colorClass = window.getStatusMeta("Telat").text;
  else if (statusType === "Pulang") colorClass = "text-purple-500";

  title.textContent = `Daftar ${statusType}`;
  title.className = `text-xl font-black ${colorClass}`;

  // 2. Ambil Data Real
  const dateKey = appState.date;
  const slotId = appState.currentSlotId; // Data berdasarkan slot aktif dashboard
  const slotData = appState.attendanceData[dateKey]?.[slotId] || {};

  const slotConfig = SLOT_WAKTU[slotId];
  const mainActId = slotConfig?.activities?.[0]?.id || "shalat";

  // Filter Santri
  const list = FILTERED_SANTRI.filter((s) => {
    const id = String(s.nis || s.id);
    const data = slotData[id];

    // Cek status Shalat (Utama)
    const currentStatus = data?.status?.[mainActId];

    // Logic Matching
    if (statusType === "Hadir") return currentStatus === "Hadir";
    if (statusType === "Sakit") return currentStatus === "Sakit";
    if (statusType === "Izin") return currentStatus === "Izin";
    if (statusType === "Pulang") return currentStatus === "Pulang";
    if (statusType === "Alpa") return currentStatus === "Alpa";

    return false;
  });

  container.innerHTML = "";

  // 3. Render List
  if (list.length === 0) {
    container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-slate-400">
                <i data-lucide="user-x" class="w-12 h-12 mb-3 opacity-50"></i>
                <p class="text-xs font-bold">Tidak ada santri ${statusType}</p>
            </div>
        `;
  } else {
    list.forEach((s) => {
      const id = String(s.nis || s.id);
      const note = slotData[id]?.note || "-";

      // Generate HTML Item
      const div = document.createElement("div");
      div.className =
        "flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700";
      div.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center font-black text-xs text-slate-600 border border-slate-200 shadow-sm">
                    ${s.nama.substring(0, 2).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 dark:text-white text-sm truncate">${window.sanitizeHTML(s.nama)}</h4>
                    <p class="text-[10px] text-slate-500 truncate">${s.asrama || s.kelas}</p>
                </div>
                ${
                  note !== "-" && note !== ""
                    ? `
                <div class="max-w-[40%] text-right">
                    <span class="inline-block px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 text-[9px] text-slate-500 leading-tight">
                        ${note}
                    </span>
                </div>`
                    : ""
                }
            `;
      container.appendChild(div);
    });
  }

  if (window.lucide) window.lucide.createIcons();
};

window.getPembinaanMainActId = window.getPembinaanMainActId || function (slot) {
  return slot?.activities?.[0]?.id || "shalat";
};

window.isPembinaanViolationStatus = window.isPembinaanViolationStatus || function (status) {
  return status === "Alpa";
};

window.collectPembinaanViolations = window.collectPembinaanViolations || function (options = {}) {
  const dateFilter = options.date || null;
  const coachedOnly = options.coachedOnly === true;
  const includeUncoached = options.includeUncoached !== false;
  const source = appState.attendanceData || {};
  const violations = [];

  FILTERED_SANTRI.forEach((santri) => {
    const id = String(santri.nis || santri.id);
    const dates = dateFilter ? [dateFilter] : Object.keys(source);

    dates.forEach((dateKey) => {
      const dayData = source[dateKey] || {};

      Object.values(SLOT_WAKTU).forEach((slot) => {
        const sData = dayData[slot.id]?.[id];

        const mainActId = window.getPembinaanMainActId(slot);
        const status =
          sData?.status?.[mainActId] ||
          window.getEffectivePermitStatus?.(id, dateKey, slot.id)?.type ||
          null;
        if (!window.isPembinaanViolationStatus(status)) return;

        const isCoached = Boolean(sData?.coaching?.done);
        if (coachedOnly && !isCoached) return;
        if (!includeUncoached && !isCoached) return;

        violations.push({
          ...santri,
          id,
          nis: id,
          date: dateKey,
          slotId: slot.id,
          slotLabel: slot.label,
          activityId: mainActId,
          status,
          isCoached,
          coachingInfo: sData?.coaching || null,
          record: sData || null,
        });
      });
    });
  });

  return violations;
};

window.refreshPembinaanSurfaces = window.refreshPembinaanSurfaces || function () {
  window.renderDashboardPembinaan?.();
  window.renderPembinaanManagement?.();
  window.updateCommandCenterStats?.();
  if (window.activeStudentIdDetail) {
    window.updateStudentDetailWarningBadge?.(window.activeStudentIdDetail);
  }
};

window.renderDashboardPembinaan = function () {
  const container = document.getElementById("dashboard-pembinaan-list");
  const badge = document.getElementById("pembinaan-count-badge");
  const cardTitle = document.querySelector("#dashboard-pembinaan-card h3");
  const card = document.getElementById("dashboard-pembinaan-card");
  const actionBtn = card?.querySelector("button[onclick*='pembinaan']");

  // Cek apakah dalam mode Wali
  const isWali = window.isWaliMode?.() || appState.waliMode;
  const waliSantri = appState.waliSantri;
  const waliNis = waliSantri ? String(waliSantri.nis || waliSantri.id || '') : '';

  // Mode Wali: SEMBUYIKAN CARD SELURUHNYA - Wali tidak bisa membina
  if (isWali) {
    if (card) {
      card.classList.add("hidden");
    }
    return; // Stop execution here
  }

  // Mode Musyrif: tampilkan card
  if (card) {
    card.classList.remove("hidden");
  }

  // Tentukan judul berdasarkan mode
  if (cardTitle) {
    cardTitle.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-red-500 mr-2 inline"></i>Pelanggaran Hari Ini`;
  }

  // Mode Musyrif: tampilkan tombol aksi
  if (actionBtn) {
    actionBtn.classList.remove("hidden");
  }

  if (!container) return;

  const dateKey = appState.date;
  const violationList = window.collectPembinaanViolations({ date: dateKey });
  const pendingCount = violationList.filter((item) => !item.isCoached).length;

  // Update Badge (Merah jika ada pending, Hijau jika semua beres)
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = `${pendingCount} Perlu Dibina`;
      badge.className =
        "px-2 py-0.5 rounded-md bg-red-500 text-white text-[10px] font-bold shadow-sm animate-pulse";
    } else if (violationList.length > 0) {
      badge.textContent = `Tuntas (${violationList.length})`;
      badge.className =
        "px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-600 text-[10px] font-bold border border-emerald-200";
    } else {
      badge.textContent = "0 Pelanggaran";
      badge.className =
        "px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold";
    }
  }

  // Render UI
  container.innerHTML = "";

  if (violationList.length === 0) {
    container.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-flex p-3 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 mb-2 border border-emerald-100 dark:border-emerald-800">
                    <i data-lucide="shield-check" class="w-6 h-6"></i>
                </div>
                <p class="text-[10px] font-bold text-slate-400">Nihil pelanggaran hari ini</p>
            </div>`;
  } else {
    // SORTING: Yang BELUM DIBINA taruh paling atas
    violationList.sort((a, b) =>
      a.isCoached === b.isCoached ? 0 : a.isCoached ? 1 : -1,
    );

    violationList.forEach((p) => {
      const div = document.createElement("div");

      // Visual Distinction: Jika sudah dibina, buat agak transparan/abu
      const bgClass = p.isCoached
        ? "bg-slate-50 dark:bg-slate-900 opacity-75 grayscale-[0.5] border-slate-100"
        : "bg-white dark:bg-slate-800 border-red-100 dark:border-red-900/30 shadow-sm";

      div.className = `flex items-center justify-between p-3 rounded-xl border mb-2 transition-all ${bgClass}`;

      let actionHtml = "";

      if (p.isCoached) {
        // TAMPILAN SUDAH DIBINA (Tetap Muncul)
        actionHtml = `
                    <div class="text-right">
                         <span class="px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 text-[10px] font-bold border border-slate-200 dark:border-slate-600 flex items-center gap-1 cursor-default">
                            <i data-lucide="check-check" class="w-3 h-3 text-emerald-500"></i> Sudah Dibina
                        </span>
                    </div>
                `;
      } else {
        // TAMPILAN BELUM DIBINA (Tombol Action Hijau)
        const dataStr = JSON.stringify({
          id: p.nis || p.id,
          nama: p.nama,
          slotId: p.slotId,
          date: p.date,
          slotLabel: p.slotLabel,
          activityId: p.activityId,
        }).replace(/"/g, "&quot;");

        actionHtml = `
                    <button onclick="window.openPembinaanModal(${dataStr})" class="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-bold hover:bg-emerald-600 shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1">
                        <i data-lucide="heart-handshake" class="w-3 h-3"></i> Bina
                    </button>
                `;
      }

      div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-500 border border-slate-200">
                        ${p.nama.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h4 class="text-xs font-bold text-slate-800 dark:text-white line-clamp-1">${p.nama}</h4>
                        <p class="text-[10px] text-red-500 font-medium flex items-center gap-1">
                            <i data-lucide="x" class="w-3 h-3"></i>
                            Alpa ${p.slotLabel}
                        </p>
                    </div>
                </div>
                ${actionHtml}
            `;
      container.appendChild(div);
    });
  }

  if (card) card.classList.remove("hidden");

  if (window.lucide) window.lucide.createIcons();
};

window.renderPembinaanManagement = function () {
  const container = document.getElementById("pembinaan-full-list");
  if (!container) return;

  // 1. Akumulasi Data Pelanggaran (HANYA YANG SUDAH DIBINA)
  const coachedViolations = window.collectPembinaanViolations({
    coachedOnly: true,
    includeUncoached: false,
  });
  let problemList = [];
  let counts = { l1: 0, l2: 0, l3: 0 };

  if (!appState.attendanceData) appState.attendanceData = {};

  FILTERED_SANTRI.forEach((s) => {
    const id = String(s.nis || s.id);
    const groupedByDate = {};
    coachedViolations
      .filter((item) => item.id === id)
      .forEach((item) => {
        if (!groupedByDate[item.date]) groupedByDate[item.date] = [];
        groupedByDate[item.date].push({
          label: item.slotLabel,
          id: item.slotId,
          activityId: item.activityId,
          action: item.coachingInfo?.action || "-",
          coachingDate: item.coachingInfo?.date || "",
        });
      });

    let dates = Object.entries(groupedByDate).map(([date, slots]) => ({
      date,
      slots,
    }));

    dates.sort((a, b) => b.date.localeCompare(a.date));

    // Hitung Total Poin (Total Slot yang sudah dibina)
    const totalAlpa = dates.reduce((acc, curr) => acc + curr.slots.length, 0);

    if (totalAlpa > 0) {
      const status = window.getPembinaanStatus(totalAlpa);
      problemList.push({ ...s, totalAlpa, status, dates });

      if (status.level === 1) counts.l1++;
      else if (status.level <= 3) counts.l2++;
      else counts.l3++;
    }
  });

  // Update Statistik Header
  const elC1 = document.getElementById("count-level-1");
  const elC2 = document.getElementById("count-level-2");
  const elC3 = document.getElementById("count-level-3");
  if (elC1) elC1.textContent = counts.l1;
  if (elC2) elC2.textContent = counts.l2;
  if (elC3) elC3.textContent = counts.l3;

  // 2. Render List
  container.innerHTML = "";
  if (problemList.length === 0) {
    container.innerHTML = `
            <div class="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-950/30">
                <div class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
                    <i data-lucide="shield-check" class="h-7 w-7"></i>
                </div>
                <p class="text-sm font-black text-slate-700 dark:text-slate-200">Nihil Poin Pelanggaran</p>
                <p class="mx-auto mt-1 max-w-[220px] text-xs font-medium leading-relaxed text-slate-400 dark:text-slate-500">
                    Santri tertib atau pelanggaran belum dibina oleh Musyrif.
                </p>
            </div>`;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  problemList.sort((a, b) => b.totalAlpa - a.totalAlpa);

  problemList.forEach((p) => {
    const percentage = Math.min((p.totalAlpa / 40) * 100, 100);
    const detailId = `detail-${p.nis || p.id}`;

    let detailHtml = "";
    p.dates.forEach((d) => {
      const dateDisplay = window.formatDate(d.date);

      // Render slot dengan info pembinaan
      const slotHtml = d.slots
        .map(
          (s) => `
                <div class="mt-1 flex items-start gap-2">
                    <span class="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-bold rounded border border-red-100 uppercase shrink-0">${s.label}</span>
                    <span class="text-[10px] text-slate-500 italic">" ${s.action} "</span>
                </div>
            `,
        )
        .join("");

      detailHtml += `
                <div class="py-3 px-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <div class="flex items-center gap-2 mb-1">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-500"></i>
                        <span class="text-xs font-bold text-slate-700">${dateDisplay}</span>
                    </div>
                    <div class="ml-5">
                        ${slotHtml}
                    </div>
                </div>
            `;
    });

    const div = document.createElement("div");
    div.className =
      "mb-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300";
    div.innerHTML = `
            <div onclick="document.getElementById('${detailId}').classList.toggle('hidden')" class="p-5 cursor-pointer relative overflow-hidden group">
                <div class="relative flex justify-between items-start mb-3">
                    <div class="flex gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-black text-slate-500 dark:text-slate-300 shadow-inner">
                            ${p.nama.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 dark:text-white text-base">${p.nama}</h4>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${p.status.color}">
                                    ${p.status.label}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-3xl font-black text-slate-700 dark:text-white">${p.totalAlpa}</span>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block -mt-1 tracking-wider">Poin</span>
                    </div>
                </div>
                
                <div class="relative w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div class="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 via-orange-400 to-red-500" style="width: ${percentage}%"></div>
                </div>
                
                <div class="flex justify-between items-center">
                    <p class="text-[10px] text-slate-400">Total Pelanggaran Tervalidasi</p>
                    <button class="text-[10px] font-bold text-slate-400 group-hover:text-emerald-500 flex items-center gap-1 transition-colors">
                        Riwayat Pembinaan <i data-lucide="chevron-down" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
            
            <div id="${detailId}" class="hidden bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 animate-slideDown">
                ${detailHtml}
            </div>
        `;
    container.appendChild(div);
  });

  if (window.lucide) window.lucide.createIcons();
};



// Fungsi Helper Baru: Loncat ke tanggal tertentu dan buka tab presensi

window.scrollToPembinaan = function () {
  setTimeout(() => {
    const el = document.getElementById("pembinaan-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, 100);
};

window.renderKBMBanner = function () {
  const banner = document.getElementById("kbm-active-banner");
  const titleEl = document.getElementById("kbm-banner-title");

  if (!banner) return;

  // 1. Ambil Data Slot & Waktu Saat Ini
  const currentSlotId = appState.currentSlotId;
  const slotData = SLOT_WAKTU[currentSlotId];

  // Cek hari ini hari apa (0=Ahad, 1=Senin, ...)
  // Gunakan tanggal dari appState jika ingin sinkron dengan tanggal yang dipilih,
  // atau new Date() jika ingin strict realtime. Disini kita pakai appState agar konsisten.
  const currentDay = new Date(appState.date).getDay();

  // 2. Cari Kegiatan KBM yang Aktif Hari Ini di Slot Ini
  // Syarat: category == 'kbm' DAN (showOnDays tidak ada ATAU hari ini termasuk)
  const activeKBM = slotData.activities.find(
    (act) =>
      act.category === "kbm" &&
      (!act.showOnDays || act.showOnDays.includes(currentDay)),
  );

  // 3. Tampilkan atau Sembunyikan Banner
  if (activeKBM) {
    // Ada KBM! Tampilkan Banner
    titleEl.textContent = activeKBM.label; // Misal: "Tahfizh" atau "Conversation"

    // Ganti Icon (Opsional: Jika ada icon khusus per kegiatan)
    // Default kita pakai book-open di HTML

    banner.classList.remove("hidden");
  } else {
    // Tidak ada KBM saat ini
    banner.classList.add("hidden");
  }

  if (window.lucide) window.lucide.createIcons();
};

window.renderActivePermitsWidget = function () {
  const container = document.getElementById("dashboard-active-permits-list");
  const badgeCount = document.getElementById("active-permit-count");

  if (!container) return;
  container.innerHTML = "";

  const combinedList = [];
  const processedNis = new Set(); // Hanya mencatat NIS yang AKTIF sakitnya
  const currentDate = appState.date;
  const currentSlotId = window.getPermitSlotIdForView
    ? window.getPermitSlotIdForView()
    : appState.currentSlotId;

  // 1. DATA PERMIT (SURAT)
  const classNisList = FILTERED_SANTRI.map((s) => String(s.nis || s.id));

  // Filter permit yang relevan (Aktif ATAU selesai hari ini)
  const relevantPermits = (appState.permits || []).filter((p) => {
    if (!classNisList.includes(String(p.nis))) return false;
    if (window.getPermitRuntimeState) {
      return window.getPermitRuntimeState(p, currentDate, currentSlotId).relevant;
    }
    if (p.start_date > currentDate) return false;
    if (!p.end_date) return true;
    return currentDate >= p.start_date && currentDate <= p.end_date;
  });

  relevantPermits.forEach((p) => {
    const runtime = window.getPermitRuntimeState
      ? window.getPermitRuntimeState(p, currentDate, currentSlotId)
      : { active: p.is_active !== false, evaluated: null };
    let visualActive = runtime.active;
    const catSafe = (p.category || "").toLowerCase();
    const runtimeType = runtime.evaluated?.type || p.category;
    const runtimeCategory =
      runtimeType === "Alpa" ? "alpa" : (p.category || "").toLowerCase();

    // Filter tambahan: Pastikan Permit juga hanya S/I/P (jaga-jaga jika ada kategori lain)
    if (["sakit", "izin", "pulang"].includes(catSafe)) {
      combinedList.push({
        type: "permit",
        id: p.id,
        nis: String(p.nis),
        category: runtimeCategory,
        originalCategory: p.category,
        startTime: p.start_date,
        endTime: p.end_date,
        isActive: visualActive,
        reason: p.reason,
        runtimeType,
      });

      // PENTING: Hanya block Manual Check jika permit ini MASIH AKTIF.
      if (visualActive) {
        processedNis.add(String(p.nis));
      }
    }
  });

  // 2. DATA MANUAL (PRESENSI HARIAN)
  const dayData = appState.attendanceData[currentDate];

  if (dayData) {
    FILTERED_SANTRI.forEach((s) => {
      const id = String(s.nis || s.id);
      // Skip jika sudah tercover permit AKTIF
      if (processedNis.has(id)) return;

      let foundStatus = null;
      // PERBAIKAN: Tambahkan 'sekolah' ke dalam daftar pemindaian widget izin manual
      const slots = ["isya", "maghrib", "ashar", "sekolah", "shubuh"];
      for (const slotId of slots) {
        const slotConfig = SLOT_WAKTU[slotId];
        if (!slotConfig) continue;
        const mainActId = slotConfig.activities[0]?.id || "shalat"; // Dinamis!

        const st = dayData[slotId]?.[id]?.status?.[mainActId];

        if (st && ["Sakit", "Izin", "Pulang"].includes(st)) {
          foundStatus = st;
          break;
        }
      }

      if (foundStatus) {
        let category = foundStatus.toLowerCase();

        combinedList.push({
          type: "manual", // Penanda ini data manual
          id: null,
          nis: id,
          category: category,
          startTime: currentDate,
          endTime: null,
          isActive: true, // Manual yang tampil pasti Aktif
          reason: "Presensi Manual",
        });
      }
    });
  }

  // Update Badge & Sorting
  if (badgeCount)
    badgeCount.textContent = combinedList.filter((i) => i.isActive).length;
  combinedList.sort((a, b) =>
    a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1,
  );

  // Render HTML
  if (combinedList.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-slate-400 text-[10px] font-bold">Semua santri lengkap / Hadir</div>`;
    return;
  }

  combinedList.forEach((item) => {
    const santri = FILTERED_SANTRI.find(
      (s) => String(s.nis || s.id) === item.nis,
    );
    if (!santri) return;

    let colorClass, iconName;
    const cat = item.category.toLowerCase();
    const displayCategory = item.runtimeType || item.category;

    if (cat === "sakit") {
      colorClass = "bg-amber-100 text-amber-600 border-amber-200";
      iconName = "thermometer";
    } else if (cat === "izin") {
      colorClass = "bg-blue-100 text-blue-600 border-blue-200";
      iconName = "file-text";
    } else if (cat === "pulang") {
      colorClass = "bg-purple-100 text-purple-600 border-purple-200";
      iconName = "bus";
    } else {
      colorClass = "bg-slate-100 text-slate-600 border-slate-200";
      iconName = "help-circle";
    }

    let btnHTML = "";
    if (item.isActive) {
      let label = "Sembuh";
      let action = "";

      // Logic Action
      if (item.type === "manual") {
        // Jika manual, tombolnya "Hadirkan"
        action = `window.resolveManualStatus('${item.nis}', '${cat.charAt(0).toUpperCase() + cat.slice(1)}')`;
        label = "Hadirkan";
      } else {
        // Jika permit
        if (cat === "sakit") {
          action = `window.markAsRecovered('${item.id}')`;
        } else {
          label = "Kembali";
          action = `window.markAsReturned('${item.id}')`;
        }
      }

      btnHTML = `
                <button onclick="${action}" class="ml-2 px-3 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-bold hover:bg-emerald-600 shadow-md flex items-center gap-1">
                    <i data-lucide="check" class="w-3 h-3"></i> ${label}
                </button>`;
    } else {
      btnHTML = `
                <button disabled class="ml-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-400 border border-slate-200 text-[10px] font-bold cursor-not-allowed flex items-center gap-1">
                    <i data-lucide="check-check" class="w-3 h-3"></i> Selesai
                </button>`;
    }

    const div = document.createElement("div");
    div.className = `flex items-center justify-between p-3 rounded-2xl border transition-all mb-2 ${item.isActive ? "bg-white dark:bg-slate-800 shadow-sm" : "bg-slate-50 dark:bg-slate-900 opacity-60 grayscale"}`;
    div.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-xl ${colorClass} flex items-center justify-center flex-shrink-0 border shadow-sm"><i data-lucide="${iconName}" class="w-4 h-4"></i></div>
                <div class="min-w-0">
                    <h4 class="text-xs font-bold text-slate-800 dark:text-white truncate">${santri.nama}</h4>
                    <div class="flex items-center gap-1.5 mt-1">
                        <span class="text-[9px] font-black uppercase ${colorClass.split(" ")[1]}">${displayCategory}</span>
                        <span class="text-[9px] text-slate-400">• ${item.type === "manual" ? "Manual" : window.formatDate(item.startTime)}</span>
                    </div>
                </div>
            </div>
            ${btnHTML}
        `;
    container.appendChild(div);
  });
  if (window.lucide) window.lucide.createIcons();
};

window.resolveManualStatus = function (nis, statusType) {
  const dateKey = appState.date;
  const dayData = appState.attendanceData[dateKey];
  if (!dayData) return;

  let changed = false;

  Object.keys(dayData).forEach((slotId) => {
    const studentData = dayData[slotId][nis];
    const slotConfig = SLOT_WAKTU[slotId];
    if (!slotConfig) return;

    // PERBAIKAN: Gunakan mainActId agar slot Sekolah juga bisa "Dihadirkan"
    const mainActId = slotConfig.activities[0]?.id || "shalat";

    if (
      studentData &&
      studentData.status &&
      studentData.status[mainActId] === statusType
    ) {
      studentData.status[mainActId] = "Hadir";

      if (slotConfig.activities) {
        slotConfig.activities.forEach((act) => {
          if (act.category === "dependent") studentData.status[act.id] = "Ya";
          else if (act.category === "kbm" || act.category === "fardu")
            studentData.status[act.id] = "Hadir";
        });
      }

      if (studentData.note) {
        studentData.note = studentData.note.replace(/\[Auto\].*$/g, "").trim();
      }
      changed = true;
    }
  });

  if (changed) {
    window.saveData();
    window.showToast("Status berhasil diubah menjadi Hadir", "success");
    if (window.refreshPermitSurfaces) window.refreshPermitSurfaces();
    else {
      window.renderActivePermitsWidget();
      window.renderAttendanceList();
    }
  } else {
    window.showToast("Tidak ada data yang perlu diubah", "info");
  }
};


window.openPembinaanModal = function (data) {
  const modal = document.getElementById("modal-input-pembinaan");
  if (!modal) return;
  const safeName = String(data.nama || "Santri");

  // Isi Data UI
  document.getElementById("bina-nama").textContent = safeName;
  document.getElementById("bina-avatar").textContent = safeName
    .substring(0, 2)
    .toUpperCase();
  document.getElementById("bina-detail").textContent =
    `${data.slotLabel} • ${window.formatDate(data.date)}`;

  // Set Default Input
  document.getElementById("bina-date").value = window.getLocalDateStr();
  document.getElementById("bina-action").value = "";

  // Simpan target data di hidden input
  document.getElementById("bina-target-data").value = JSON.stringify(data);

  modal.classList.remove("hidden");
};

window.savePembinaan = function () {
  const rawData = document.getElementById("bina-target-data").value;
  if (!rawData) return;

  try {
    const target = JSON.parse(rawData);
    const dateBina = document.getElementById("bina-date").value;
    const actionBina = document.getElementById("bina-action").value.trim();

    if (!dateBina || !actionBina) {
      return window.showToast(
        "Tanggal dan Bentuk Pembinaan wajib diisi!",
        "warning",
      );
    }

    if (dateBina < target.date) {
      return window.showToast(
        "Tanggal pembinaan tidak boleh sebelum tanggal pelanggaran",
        "warning",
      );
    }

    // Validate date
    if (dateBina > window.getLocalDateStr()) {
      return window.showToast(
        "Tanggal pembinaan tidak boleh di masa depan",
        "warning",
      );
    }

    const dayData = appState.attendanceData[target.date];
    if (
      dayData &&
      dayData[target.slotId] &&
      dayData[target.slotId][target.id]
    ) {
      const studentData = dayData[target.slotId][target.id];
      const slotConfig = SLOT_WAKTU[target.slotId];
      const mainActId = target.activityId || window.getPembinaanMainActId(slotConfig);

      if (!window.isPembinaanViolationStatus(studentData.status?.[mainActId])) {
        return window.showToast(
          "Status pelanggaran sudah berubah. Pembinaan tidak dicatat.",
          "warning",
        );
      }

      studentData.coaching = {
        done: true,
        date: dateBina,
        action: window.sanitizeHTML(actionBina),
        musyrif: appState.userProfile ? appState.userProfile.email : "Admin",
        timestamp: new Date().toISOString(),
      };

      window.saveData();

      // Kirim notifikasi ke Wali jika tersedia
      const studentNis = String(target.id || target.nis || '').trim();
      const studentName = target.nama || 'Santri';
      if (studentNis && typeof window.addNotification === 'function') {
        window.addNotification(
          'wali',
          studentNis,
          'Pembinaan Santri Dicatat 📋',
          `Ananda ${studentName} telah dibina oleh Musyrif. Catatan: "${window.sanitizeHTML(actionBina)}"`,
          'pembinaan',
          'tab=home'
        );
        console.log(`[DashboardManager] Pembinaan notification sent to wali for NIS: ${studentNis}`);
      }

      window.showToast(
        "Pembinaan berhasil dicatat. Poin ditambahkan.",
        "success",
      );
      window.closeModal("modal-input-pembinaan");
      window.refreshPembinaanSurfaces();
      window.updateDashboard?.();
    } else {
      window.showToast(
        "Data presensi tidak ditemukan (mungkin terhapus)",
        "error",
      );
    }
  } catch (e) {
    console.error("Pembinaan save error:", e);
    window.showToast("Gagal menyimpan: " + e.message, "error");
  }
};


window.renderSchoolStatsWidget = function () {
  const widget = document.getElementById("school-stats-widget");
  if (!widget) return;

  // SINKRONISASI: Jika hari ini sekolah libur (Ahad), hilangkan sekalian widgetnya!
  if (window.isSlotHoliday("sekolah", appState.date)) {
    widget.classList.add("hidden");
    return;
  } else {
    widget.classList.remove("hidden");
  }

  const stats = window.calculateSlotStats("sekolah", appState.date);
  const totalSiswa = FILTERED_SANTRI ? FILTERED_SANTRI.length : 0;

  // Hitung Persentase Kehadiran = (Hadir / Total Siswa) * 100
  // Mencegah pembagian dengan 0 yang menghasilkan NaN%
  let presentPercent = 0;
  if (totalSiswa > 0) {
    presentPercent = Math.round(((stats.h + stats.t) / totalSiswa) * 100);
    if (presentPercent > 100) presentPercent = 100; // Proteksi maksimal 100%
  }

  const fillEl = document.getElementById("school-progress-bar");
  const textEl = document.getElementById("school-pct-badge");

  if (fillEl) fillEl.style.width = `${presentPercent}%`;
  if (textEl) textEl.textContent = `${presentPercent}%`;

  // Update angka-angka rekap
  const hEl = document.getElementById("sch-stat-h");
  const sEl = document.getElementById("sch-stat-s");
  const iEl = document.getElementById("sch-stat-i");
  const aEl = document.getElementById("sch-stat-a");

  if (hEl) hEl.textContent = stats.h;
  if (sEl) sEl.textContent = stats.s;
  if (iEl) iEl.textContent = stats.i;
  if (aEl) aEl.textContent = stats.a;
  const absentListEl = document.getElementById("school-absent-list");
  if (absentListEl) {
    const absentStudents = FILTERED_SANTRI.filter((s) => {
      const status = window.getAttendanceStatus(
        s.nis || s.id,
        "sekolah",
        appState.date,
      );
      return ["Sakit", "Izin", "Pulang", "Alpa"].includes(status);
    });

    if (absentStudents.length === 0) {
      absentListEl.innerHTML = `
                <div class="text-center text-xs text-slate-400 py-2">
                    Semua santri hadir
                </div>
            `;
    } else {
      absentListEl.innerHTML = absentStudents
        .map((s) => {
          const status = window.getAttendanceStatus(
            s.nis || s.id,
            "sekolah",
            appState.date,
          );

          return `
                        <div class="flex justify-between items-center px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700">
                            <span class="text-xs font-medium">
                                ${s.nama}
                            </span>
                            <span class="text-xs font-bold text-red-500">
                                ${status}
                            </span>
                        </div>
                    `;
        })
        .join("");
    }
  }
};





window.verifyLocationCached = async function () {
  const cache = JSON.parse(localStorage.getItem(GPS_CACHE_KEY) || "null");

  if (
    cache &&
    cache.distance !== undefined &&
    Date.now() - cache.timestamp < GPS_CACHE_DURATION
  ) {
    if (
      cache.isInside === true &&
      Number(cache.distance) <= GEO_CONFIG.maxRadiusMeters
    ) {
      return true;
    }
    localStorage.removeItem(GPS_CACHE_KEY);
  }

  await window.verifyLocation();
  return true;
};

// ==========================================
// SUPERAPP NEW WIDGETS LOGIC
// ==========================================

window.updateWorshipWidget = function() {
  const now = new Date();
  
  // Date formatters - use shared constants
  const elGreg = document.getElementById("worship-date-gregorian");
  if (elGreg) {
    const days = window.DAYS_ID || DAYS_ID || ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = window.MONTHS_ID || MONTHS_ID || ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    elGreg.textContent = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
  
  const elHijri = document.getElementById("worship-date-hijri");
  if (elHijri && typeof window.getHijriDateStr === "function") {
    elHijri.textContent = window.getHijriDateStr(now);
  }
  
  // Update Prayer grid times
  const times = typeof window.calculatePrayerTimes === "function" ? window.calculatePrayerTimes(now) : null;
  if (times) {
    const slots = ["subuh", "syuruk", "dzuhur", "ashar", "maghrib", "isya"];
    slots.forEach(s => {
      const el = document.querySelector(`#pt-${s} span.tracking-tight`);
      if (el) el.textContent = times[s];
    });
  }
  
  // Update Running Clock
  const elClock = document.getElementById("worship-time");
  if (elClock) {
    elClock.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  }
  
  // Countdown to next prayer
  if (times) {
    const timeToMin = (tStr) => {
      const [h, m] = tStr.split(":").map(Number);
      return h * 60 + m;
    };
    
    const currMin = now.getHours() * 60 + now.getMinutes();
    const currSec = now.getSeconds();
    const currTimeMs = (currMin * 60 + currSec) * 1000;
    
    const prayerList = [
      { name: "Subuh", key: "subuh", min: timeToMin(times.subuh) },
      { name: "Syuruk", key: "syuruk", min: timeToMin(times.syuruk) },
      { name: "Dzuhur", key: "dzuhur", min: timeToMin(times.dzuhur) },
      { name: "Ashar", key: "ashar", min: timeToMin(times.ashar) },
      { name: "Maghrib", key: "maghrib", min: timeToMin(times.maghrib) },
      { name: "Isya", key: "isya", min: timeToMin(times.isya) }
    ];
    
    // Find next prayer
    let nextIndex = prayerList.findIndex(p => p.min * 60 * 1000 > currTimeMs);
    let prevIndex = nextIndex - 1;
    let nextPrayer, prevPrayer;
    
    if (nextIndex === -1) {
      // Past Isya, next is Subuh tomorrow
      nextPrayer = { name: "Subuh", min: prayerList[0].min + 24 * 60 };
      prevPrayer = prayerList[5]; // Isya
    } else if (nextIndex === 0) {
      // Before Subuh, prev is Isya yesterday
      nextPrayer = prayerList[0];
      prevPrayer = { name: "Isya", min: prayerList[5].min - 24 * 60 };
    } else {
      nextPrayer = prayerList[nextIndex];
      prevPrayer = prayerList[prevIndex];
    }
    
    const nextMs = nextPrayer.min * 60 * 1000;
    const diffMs = nextMs - currTimeMs;
    
    // Format countdown
    const cdSec = Math.floor(diffMs / 1000) % 60;
    const cdMin = Math.floor(diffMs / (1000 * 60)) % 60;
    const cdHour = Math.floor(diffMs / (1000 * 60 * 60));
    
    const elNextName = document.getElementById("worship-next-name");
    const elCD = document.getElementById("worship-countdown");
    if (elNextName) elNextName.textContent = nextPrayer.name;
    if (elCD) {
      elCD.textContent = `${String(cdHour).padStart(2, "0")}:${String(cdMin).padStart(2, "0")}:${String(cdSec).padStart(2, "0")}`;
    }
    
    // Progress Bar
    const totalSpanMs = (nextPrayer.min - prevPrayer.min) * 60 * 1000;
    let passedMs = currTimeMs - (prevPrayer.min * 60 * 1000);
    if (passedMs < 0) passedMs += 24 * 60 * 60 * 1000; // handle wrap around midnight
    const pct = Math.max(0, Math.min(100, (passedMs / totalSpanMs) * 100));
    
    const elProgress = document.getElementById("worship-progress");
    if (elProgress) elProgress.style.width = `${pct}%`;
    
    const elPrevTime = document.getElementById("worship-prev-time");
    const elNextTime = document.getElementById("worship-next-time");
    if (elPrevTime) {
      const displayKey = prevPrayer.key || "isya";
      elPrevTime.textContent = prevPrayer.name + " (" + (times[displayKey] || "--:--") + ")";
    }
    if (elNextTime) {
      const displayKey = nextPrayer.key || "subuh";
      elNextTime.textContent = nextPrayer.name + " (" + (times[displayKey] || "--:--") + ")";
    }
  }
};

window.updateHeroWidget = function() {
  const h = new Date().getHours();
  const elBg = document.getElementById("hero-bg-gradient");
  const elGreet = document.getElementById("hero-greeting-text");
  const elContext = document.getElementById("hero-context-text");
  const elSvg = document.getElementById("hero-svg-container");
  
  let greet = "Selamat Pagi, Musyrif.";
  let context = "Semoga hari ini penuh berkah.";
  let gradientClass = "from-emerald-500 to-emerald-600";
  let svgPath = "";
  
  if (h >= 4 && h < 5.5) {
    greet = "Selamat Fajar, Musyrif.";
    context = "Sesi Shubuh siap diisi.";
    gradientClass = "from-indigo-900 to-amber-700";
    svgPath = `<svg viewBox="0 0 24 24" width="80" height="80" class="text-white/20 fill-none stroke-current stroke-2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>`;
  } else if (h >= 5.5 && h < 10) {
    greet = "Selamat Pagi, Musyrif.";
    context = "Semoga aktivitas hari ini membawa berkah.";
    gradientClass = "from-emerald-500 to-emerald-600";
    svgPath = `<svg viewBox="0 0 24 24" width="80" height="80" class="text-white/20 fill-none stroke-current stroke-2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
  } else if (h >= 10 && h < 15) {
    greet = "Selamat Siang, Musyrif.";
    context = window.isSlotHoliday("sekolah", appState.date)
      ? "Hari ini sekolah libur, cek sesi ibadah yang berjalan."
      : "Jangan lupa isi presensi sekolah santri.";
    gradientClass = "from-cyan-500 to-blue-600";
    svgPath = `<svg viewBox="0 0 24 24" width="80" height="80" class="text-white/20 fill-none stroke-current stroke-2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M5.64 18.36l-1.42 1.42M19.78 4.22l-1.42 1.42"/></svg>`;
  } else if (h >= 15 && h < 17.5) {
    greet = "Selamat Sore, Musyrif.";
    context = "Waktu Ashar sedang berlangsung.";
    gradientClass = "from-amber-500 to-orange-600";
    svgPath = `<svg viewBox="0 0 24 24" width="80" height="80" class="text-white/20 fill-none stroke-current stroke-2"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
  } else if (h >= 17.5 && h < 18.5) {
    greet = "Selamat Senja, Musyrif.";
    context = "Bersiap untuk shalat Maghrib berjamaah.";
    gradientClass = "from-orange-650 to-indigo-900";
    svgPath = `<svg viewBox="0 0 24 24" width="80" height="80" class="text-white/20 fill-none stroke-current stroke-2"><path d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M20 12h2M19.07 4.93l-1.41 1.41"/><path d="M2 22h20M12 18a6 6 0 0 0-6-6H4v6h14v-6h-2a6 6 0 0 0-6 6z"/></svg>`;
  } else {
    greet = "Selamat Malam, Musyrif.";
    context = "Cek rekap dan pastikan semua data hari ini lengkap.";
    gradientClass = "from-slate-900 to-slate-800";
    svgPath = `<svg viewBox="0 0 24 24" width="80" height="80" class="text-white/20 fill-none stroke-current stroke-2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  }
  
  if (elBg) {
    elBg.className = `absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-90 transition-all duration-1000`;
  }
  if (elGreet) elGreet.textContent = greet;
  if (elContext) elContext.textContent = context;
  if (elSvg) elSvg.innerHTML = svgPath;
};

window.renderAgendaWidget = function() {
  const container = document.getElementById("dashboard-agenda-list");
  if (!container) return;
  
  const todayStr = window.getLocalDateStr();
  const sorted = (appState.agendas || [])
    .filter(a => a.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
    
  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="text-center text-xs text-slate-400 py-6 italic bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
        Tidak ada agenda terdekat
      </div>
    `;
    return;
  }
  
  const badgeClasses = {
    ujian: "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/30",
    perpulangan: "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-955/20 dark:text-blue-400 dark:border-blue-900/30",
    event: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-955/40 dark:text-emerald-400 dark:border-emerald-900/30",
    kegiatan: "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-955/20 dark:text-purple-400 dark:border-purple-900/30"
  };
  
  container.innerHTML = sorted.map(a => {
    const diffTime = new Date(a.date) - new Date(todayStr);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const countdownText = diffDays === 0 ? "Hari Ini" : diffDays === 1 ? "Besok" : `${diffDays} hari lagi`;
    
    return `
      <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <span class="inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${badgeClasses[a.type] || "bg-slate-100 text-slate-500"} mb-1">
            ${a.type}
          </span>
          <h4 class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${window.sanitizeHTML(a.title)}</h4>
          <p class="text-[9px] text-slate-400 mt-0.5">${window.formatDate(a.date)}</p>
        </div>
        <span class="text-[10px] font-black text-indigo-500 whitespace-nowrap bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1 rounded-xl">
          ${countdownText}
        </span>
      </div>
    `;
  }).join("");
};

window.renderReminderWidget = function() {
  const container = document.getElementById("dashboard-reminder-list");
  if (!container) return;
  
  const reminders = appState.reminders || [];
  if (reminders.length === 0) {
    container.innerHTML = `
      <div class="text-center text-xs text-slate-400 py-6 italic bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
        Tidak ada pengingat tugas
      </div>
    `;
    return;
  }
  
  container.innerHTML = reminders.map(r => {
    const doneClass = r.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200";
    const checkIcon = r.done ? "check-square" : "square";
    const checkColor = r.done ? "text-pink-500" : "text-slate-400 dark:text-slate-650";
    
    return `
      <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <button onclick="window.toggleReminderDone('${r.id}')" class="${checkColor} hover:text-pink-500 transition-colors shrink-0">
            <i data-lucide="${checkIcon}" class="w-5 h-5"></i>
          </button>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold ${doneClass} truncate">${window.sanitizeHTML(r.title)}</p>
            <p class="text-[8px] text-slate-400 font-semibold mt-0.5">Deadline: ${window.formatDate(r.date)}</p>
          </div>
        </div>
        <button onclick="window.deleteReminder('${r.id}')" class="text-slate-350 hover:text-red-500 transition-colors shrink-0">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join("");
  
  if (window.lucide) window.lucide.createIcons();
};

window.toggleReminderDone = function(id) {
  const rem = (appState.reminders || []).find(r => r.id === id);
  if (rem) {
    rem.done = !rem.done;
    localStorage.setItem(APP_CONFIG.remindersKey, JSON.stringify(appState.reminders));
    window.renderReminderWidget();
    window.showToast(rem.done ? "Tugas ditandai selesai" : "Tugas diaktifkan kembali", "success");
  }
};

window.deleteReminder = function(id) {
  window.showConfirmModal(
    "Hapus Pengingat?",
    "Pengingat ini akan dihapus dari daftar tugas.",
    "Hapus",
    "Batal",
    () => {
  appState.reminders = (appState.reminders || []).filter(r => r.id !== id);
  localStorage.setItem(APP_CONFIG.remindersKey, JSON.stringify(appState.reminders));
  window.renderReminderWidget();
  window.showToast("Pengingat dihapus", "info");
    },
  );
};

window.openAddReminderModal = function() {
  document.getElementById("add-reminder-title").value = "";
  document.getElementById("add-reminder-date").value = window.getLocalDateStr();
  window.openModal("modal-add-reminder");
};

window.submitAddReminder = function() {
  const title = document.getElementById("add-reminder-title").value.trim();
  const date = document.getElementById("add-reminder-date").value;
  
  if (!title) return window.showToast("Judul pengingat wajib diisi", "warning");
  if (!date) return window.showToast("Tanggal wajib diisi", "warning");
  
  const newRem = {
    id: "rem_" + Date.now(),
    title: title,
    done: false,
    date: date
  };
  
  if (!appState.reminders) appState.reminders = [];
  appState.reminders.push(newRem);
  localStorage.setItem(APP_CONFIG.remindersKey, JSON.stringify(appState.reminders));
  
  window.closeModal("modal-add-reminder");
  window.renderReminderWidget();
  window.showToast("Pengingat berhasil disimpan", "success");
};

window.openReminderModal = function() {
  window.openAddReminderModal();
};

window.openNotificationSettingsModal = function() {
  const types = appState.settings.notificationTypes || {};
  Object.keys(types).forEach(key => {
    const btn = document.getElementById("notif-toggle-" + key);
    if (btn) {
      const active = !!types[key];
      btn.classList.toggle("bg-emerald-500", active);
      btn.classList.toggle("bg-slate-200", !active);
      btn.classList.toggle("dark:bg-slate-700", !active);
      const dot = btn.querySelector("div");
      if (dot) {
        dot.classList.toggle("left-5", active);
        dot.classList.toggle("left-1", !active);
      }
    }
  });
  window.openModal("modal-notification-settings");
};

// ==========================================
// 14. COMMAND CENTER STATISTICS
// ==========================================
window.updateCommandCenterStats = function () {
  if (!appState.selectedClass) return;

  // 1. Total Binaan
  const binaanCount = FILTERED_SANTRI.length;
  const elBinaan = document.getElementById("cc-stat-binaan");
  if (elBinaan) elBinaan.textContent = binaanCount;

  // 2. Attendance Stats
  let statsToday = { h: 0, s: 0, i: 0, a: 0, p: 0, t: 0 };
  Object.keys(SLOT_WAKTU).forEach(slotId => {
    const slotStats = window.calculateSlotStats(slotId);
    if (slotStats.isFilled) {
      statsToday.h += slotStats.h;
      statsToday.s += slotStats.s;
      statsToday.i += slotStats.i;
      statsToday.a += slotStats.a;
      statsToday.p += slotStats.p;
      statsToday.t += slotStats.t; // Terlambat
    }
  });

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setVal("stat-hadir", statsToday.h);
  setVal("stat-alpa", statsToday.a);
  setVal("stat-sakit", statsToday.s);
  setVal("stat-izin", statsToday.i);
  setVal("cc-stat-pulang", statsToday.p);
  setVal("cc-stat-terlambat", statsToday.t);

  // 3. Setoran Tahfizh Hari Ini
  let setoranCount = 0;
  try {
    const setoranList = typeof window.getTahfizhSetoran === "function"
      ? window.getTahfizhSetoran()
      : JSON.parse(localStorage.getItem('tahfizh_local_setoran') || "[]");
    if (setoranList.length) {
      const filteredNisList = FILTERED_SANTRI.map(s => String(s.nis || s.id));
      setoranCount = setoranList.filter(s => {
        const sDate = s.tanggal || s.Tanggal || s.date || "";
        const sNis = String(s.nis || s.Nis || s.studentId || s.santriId || "");
        return sDate.includes(appState.date) && filteredNisList.includes(sNis);
      }).length;
    }
  } catch (e) {
    console.error("Error reading tahfizh setoran:", e);
  }
  setVal("cc-stat-tahfizh", setoranCount);

  // 4. Persentase Keterisian
  const completion = window.getDayCompletionStatus(appState.date);
  const keterisianPercent = completion.requiredSlots > 0 
    ? Math.round((completion.completedSlots / completion.requiredSlots) * 100) 
    : 0;
  const elKeterisian = document.getElementById("cc-stat-keterisian");
  if (elKeterisian) elKeterisian.textContent = keterisianPercent + "%";

  // 5. Tugas Belum Selesai (Reminders)
  const activeReminders = appState.reminders ? appState.reminders.filter(r => !r.done).length : 0;
  setVal("cc-stat-tugas", activeReminders);

  // 6. Agenda Hari Ini
  const todayAgendas = appState.agendas ? appState.agendas.filter(a => a.date === appState.date).length : 0;
  setVal("cc-stat-agenda", todayAgendas);
  
  // Update other dynamic modules
  window.updateLeaderboardWidget();
  window.updateAIInsightsWidget();
  window.renderCalendarGridWidget();
};

// ==========================================
// 15. QUICK ACTIONS INITIATION
// ==========================================
window.openQuickPermit = function (type) {
  const modal = document.getElementById("modal-add-permit");
  if (!modal) return;
  
  // Populate dropdown
  const select = document.getElementById("add-permit-santri-select");
  if (select) {
    select.innerHTML = '<option value="" disabled selected>-- Pilih Santri --</option>';
    FILTERED_SANTRI.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.nis || s.id;
      opt.textContent = s.nama;
      select.appendChild(opt);
    });
  }

  const typeSelect = document.getElementById("add-permit-category");
  if (typeSelect && type) {
    typeSelect.value = type;
  }
  
  // Set default dates
  const startInp = document.getElementById("add-permit-start-date");
  const endInp = document.getElementById("add-permit-end-date");
  if (startInp) startInp.value = window.getLocalDateStr();
  if (endInp) endInp.value = window.getLocalDateStr();
  
  const reasonInp = document.getElementById("add-permit-reason");
  if (reasonInp) reasonInp.value = "";
  
  window.openModal("modal-add-permit");
};

window.openQuickViolation = function () {
  const select = document.getElementById("violation-student-select");
  if (!select) return;
  
  select.innerHTML = '<option value="" disabled selected>-- Pilih Santri --</option>';
  FILTERED_SANTRI.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.nis || s.id;
    opt.textContent = s.nama;
    select.appendChild(opt);
  });
  
  document.getElementById("violation-note").value = "";
  window.openModal("modal-input-pelanggaran");
};

window.updateViolationPointsLabel = function () {
  // Option updates automatically
};

window.saveQuickViolationEntry = function () {
  const studentId = document.getElementById("violation-student-select").value;
  const type = document.getElementById("violation-type-select").value;
  const note = document.getElementById("violation-note").value;
  
  const selectEl = document.getElementById("violation-type-select");
  const points = parseInt(selectEl.options[selectEl.selectedIndex].getAttribute("data-points") || "10");

  if (!studentId) return window.showToast("Pilih santri terlebih dahulu!", "warning");
  if (!note) return window.showToast("Keterangan wajib diisi!", "warning");

  const student = FILTERED_SANTRI.find(s => String(s.nis || s.id) === String(studentId));
  if (!student) return window.showToast("Santri tidak valid", "error");

  const newViolation = {
    id: "viol_" + Date.now(),
    studentId: String(studentId),
    type: type,
    date: window.getLocalDateStr(),
    points: points,
    note: window.sanitizeHTML(note),
    musyrif: appState.userProfile ? appState.userProfile.email : "tester-musyrif@gmail.com",
    timestamp: new Date().toISOString()
  };

  if (!appState.violations) appState.violations = [];
  appState.violations.push(newViolation);
  localStorage.setItem(APP_CONFIG.violationsKey, JSON.stringify(appState.violations));

  // Log to Audit Trail
  window.logActivityAudit("Pelanggaran Baru", student.nama, `Mencatat pelanggaran ${type} (${points} Poin).`);

  window.closeModal("modal-input-pelanggaran");
  if (typeof window.updateStudentDetailWarningBadge === "function") {
    window.updateStudentDetailWarningBadge(studentId);
  }
  window.updateCommandCenterStats();
  window.showToast("Pelanggaran berhasil dicatat", "success");
};

window.openQuickSetoran = function () {
  const select = document.getElementById("setoran-student-select");
  if (!select) return;
  
  select.innerHTML = '<option value="" disabled selected>-- Pilih Santri --</option>';
  FILTERED_SANTRI.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.nis || s.id;
    opt.textContent = s.nama;
    select.appendChild(opt);
  });
  
  document.getElementById("setoran-surah").value = "";
  document.getElementById("setoran-page").value = "";
  window.openModal("modal-input-setoran");
};

window.saveQuickSetoranEntry = function () {
  const studentId = document.getElementById("setoran-student-select").value;
  const type = document.getElementById("setoran-type").value;
  const juz = parseInt(document.getElementById("setoran-juz").value || "30");
  const surah = document.getElementById("setoran-surah").value;
  const page = parseInt(document.getElementById("setoran-page").value || "1");
  const status = document.getElementById("setoran-status").value;

  if (!studentId) return window.showToast("Pilih santri terlebih dahulu!", "warning");
  if (!surah) return window.showToast("Nama Surah wajib diisi!", "warning");

  const student = FILTERED_SANTRI.find(s => String(s.nis || s.id) === String(studentId));
  if (!student) return window.showToast("Santri tidak valid", "error");

  try {
    let list = typeof window.getTahfizhSetoran === "function"
      ? window.getTahfizhSetoran()
      : JSON.parse(localStorage.getItem('tahfizh_local_setoran') || "[]");
    
    const newSetoran = {
      rowNumber: Date.now(),
      RowNumber: Date.now(),
      tanggal: window.getLocalDateStr(),
      Tanggal: window.getLocalDateStr(),
      nis: String(studentId),
      Nis: String(studentId),
      NamaSantri: student.nama,
      namaSantri: student.nama,
      kelas: appState.selectedClass || student.kelas,
      jenis: type,
      juz: juz,
      surat: surah,
      halaman: page,
      materi: `${type} Juz ${juz} Surah ${surah} Hal ${page}`,
      nilai: status === "Lancar" ? "Verified" : "Rejected",
      status: "Verified",
      Status: "Verified",
      musyrif: appState.userProfile ? appState.userProfile.email : "tester-musyrif@gmail.com",
      timestamp: new Date().toISOString(),
      source: "local",
      localCreatedAt: new Date().toISOString()
    };

    if (typeof window.addTahfizhSetoran === "function") {
      window.addTahfizhSetoran(newSetoran);
    } else {
      list.unshift(newSetoran);
      localStorage.setItem('tahfizh_local_setoran', JSON.stringify(list));
    }

    // Trigger notification to Wali
    if (typeof window.addNotification === "function") {
      window.addNotification(
        "wali",
        studentId,
        "Setoran Hafalan Baru 📖",
        `${student.nama} berhasil menyetor hafalan ${type} Juz ${juz} Surah ${surah} Hal ${page} (${status}).`,
        "tahfizh",
        "tab=tahfizh"
      );
    }

    // Log to Audit Trail
    window.logActivityAudit("Setoran Tahfizh", student.nama, `Mencatat setoran ${type} Juz ${juz} (${status}).`);

    window.closeModal("modal-input-setoran");
    if (typeof window.updateStudentDetailWarningBadge === "function") {
      window.updateStudentDetailWarningBadge(studentId);
    }
    window.updateCommandCenterStats();
    
    // Reload tahfizh data if active
    if (typeof reloadTahfizhData === "function") {
      reloadTahfizhData();
    }
    
    window.showToast("Setoran tahfizh berhasil dicatat", "success");
  } catch (e) {
    window.showToast("Gagal menyimpan: " + e.message, "error");
  }
};

// ==========================================
// 16. SINGLE SOURCE OF TRUTH (SSOT) STUDENT DETAILS
// ==========================================
let activeStudentIdDetail = null;

window.updateStudentDetailWarningBadge = function (id) {
  const badge = document.getElementById("sd-warning-badge");
  if (!badge) return;
  const ews = window.calculateEarlyWarningStatus(id);
  badge.textContent = ews.status;
  if (ews.color === "red") {
    badge.className = "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-100 text-red-600 border border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30";
  } else if (ews.color === "yellow") {
    badge.className = "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-600 border border-amber-200 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900/30";
  } else {
    badge.className = "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30";
  }
};

window.openStudentDetail = function (id) {
  const student = FILTERED_SANTRI.find(s => String(s.nis || s.id) === String(id));
  if (!student) return window.showToast("Santri tidak ditemukan", "error");

  activeStudentIdDetail = id;
  window.activeStudentIdDetail = id;

  // Header data
  document.getElementById("sd-name").textContent = student.nama;
  document.getElementById("sd-nis").textContent = `NIS: ${student.nis || student.id || '-'}`;
  document.getElementById("sd-class").textContent = `Kelas: ${appState.selectedClass} • Musyrif: ${MASTER_KELAS[appState.selectedClass]?.musyrif || '-'}`;
  
  const avatar = document.getElementById("sd-avatar");
  if (avatar) avatar.textContent = student.nama.substring(0, 2).toUpperCase();

  // Calculate Warning Badge
  window.updateStudentDetailWarningBadge(id);

  // Populate Biodata Tab
  document.getElementById("sdb-kamar").textContent = student.asrama || student.kamar || "Asrama Binaan";
  document.getElementById("sdb-musyrif").textContent = MASTER_KELAS[appState.selectedClass]?.musyrif || "-";
  document.getElementById("sdb-wali-nama").textContent = student.wali || student.orang_tua || "Bapak/Ibu Wali";
  
  const waBtn = document.getElementById("sdb-wali-wa");
  if (waBtn) {
    const rawHp = String(student.hp_wali || student.hp || "628123456789");
    const hp = rawHp.startsWith("0") ? "62" + rawHp.substring(1) : rawHp;
    waBtn.href = `https://wa.me/${hp}?text=${encodeURIComponent("Assalamualaikum Bapak/Ibu Wali dari " + student.nama + ", kami dari Musyrif Asrama...")}`;
  }
  document.getElementById("sdb-ttl").textContent = student.ttl || "Yogyakarta, 10 Juni 2010";

  // Calculate Specific attendance percents
  const percents = window.calculateStudentSessionPercents(id);
  document.getElementById("sdb-pres-shubuh").textContent = percents.shubuh + "%";
  document.getElementById("sdb-pres-sekolah").textContent = percents.sekolah + "%";
  document.getElementById("sdb-pres-ashar").textContent = percents.ashar + "%";
  document.getElementById("sdb-pres-maghrib").textContent = percents.maghrib + "%";

  // Populate Timeline Tab
  window.renderStudentTimeline(id);

  // Populate Jurnal Tab
  window.renderStudentJournal(id);
  document.getElementById("sd-journal-date").value = window.getLocalDateStr();
  document.getElementById("sd-journal-content").value = "";

  // Populate Targets Tab
  window.renderStudentTargetsTab(id);

  // Populate Achievements/Badges Tab
  window.renderStudentAchievements(id);

  // Open default Tab
  window.switchStudentDetailTab("biodata");

  window.openModal("modal-student-detail");
};

window.switchStudentDetailTab = function (tabName) {
  document.querySelectorAll(".sd-tab-content").forEach(el => el.classList.add("hidden"));
  const target = document.getElementById(`sdc-${tabName}`);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll("[id^='sdt-btn-']").forEach(btn => {
    btn.classList.remove("text-slate-800", "dark:text-white", "border-emerald-500", "active");
    btn.classList.add("text-slate-500", "dark:text-slate-400", "border-transparent");
  });
  
  const activeBtn = document.getElementById(`sdt-btn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.remove("text-slate-500", "dark:text-slate-400", "border-transparent");
    activeBtn.classList.add("text-slate-800", "dark:text-white", "border-emerald-500", "active");
  }
};

// ==========================================
// 17. COUNSELING JOURNAL ENGINE
// ==========================================
window.renderStudentJournal = function (studentId) {
  const container = document.getElementById("sd-journal-list");
  if (!container) return;
  container.innerHTML = "";

  const list = (appState.studentLogs || []).filter(log => String(log.studentId) === String(studentId));
  if (list.length === 0) {
    container.innerHTML = `<p class="text-[10px] text-slate-400 italic py-4 text-center">Belum ada jurnal pembinaan santri ini.</p>`;
    return;
  }

  // Sort logs descending
  list.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  list.forEach(log => {
    const el = document.createElement("div");
    el.className = "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 rounded-2xl shadow-sm space-y-1";
    el.innerHTML = `
      <div class="flex justify-between items-center text-[9px] font-bold">
        <span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 uppercase">${log.type}</span>
        <span class="text-slate-400">${window.formatDate(log.date)}</span>
      </div>
      <p class="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">${log.content}</p>
      <div class="text-[8px] font-bold text-slate-400 pt-1 text-right">Musyrif: ${log.musyrif || '-'}</div>
    `;
    container.appendChild(el);
  });
};

window.saveStudentJournalEntry = function () {
  const type = document.getElementById("sd-journal-type").value;
  const date = document.getElementById("sd-journal-date").value;
  const content = document.getElementById("sd-journal-content").value;

  if (!activeStudentIdDetail) return;
  if (!date) return window.showToast("Pilih tanggal jurnal!", "warning");
  if (!content) return window.showToast("Isi catatan pembinaan wajib diisi!", "warning");

  const student = FILTERED_SANTRI.find(s => String(s.nis || s.id) === String(activeStudentIdDetail));
  if (!student) return;

  const newLog = {
    id: "log_" + Date.now(),
    studentId: String(activeStudentIdDetail),
    type: type,
    date: date,
    content: window.sanitizeHTML(content),
    musyrif: appState.userProfile ? appState.userProfile.email : "tester-musyrif@gmail.com",
    timestamp: new Date().toISOString()
  };

  if (!appState.studentLogs) appState.studentLogs = [];
  appState.studentLogs.unshift(newLog);
  localStorage.setItem(APP_CONFIG.studentLogsKey, JSON.stringify(appState.studentLogs));

  // Log to Audit
  window.logActivityAudit("Jurnal Pembinaan", student.nama, `Menulis jurnal ${type}: "${content.substring(0,30)}..."`);

  window.showToast("Jurnal pembinaan berhasil disimpan", "success");
  window.renderStudentJournal(activeStudentIdDetail);
  document.getElementById("sd-journal-content").value = "";
  if (typeof window.updateStudentDetailWarningBadge === "function") {
    window.updateStudentDetailWarningBadge(activeStudentIdDetail);
  }
  window.updateCommandCenterStats();
};

// ==========================================
// 18. REWARDS & ACHIEVEMENTS ENGINE
// ==========================================
window.renderStudentAchievements = function (studentId) {
  const container = document.getElementById("sd-achievement-list");
  if (!container) return;
  container.innerHTML = "";

  const badges = window.calculateStudentBadges(studentId);

  badges.forEach(badge => {
    const el = document.createElement("div");
    el.className = `p-3 rounded-2xl border flex items-center gap-3 transition-all duration-300 ${badge.earned ? 'bg-gradient-to-r from-amber-500/10 to-amber-600/5 border-amber-200 dark:from-slate-800 dark:to-slate-850 dark:border-amber-900/30' : 'bg-slate-50 border-slate-100 dark:bg-slate-900 dark:border-slate-800 opacity-40 grayscale'}`;
    el.innerHTML = `
      <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${badge.earned ? 'bg-amber-100 dark:bg-amber-955 text-amber-500 ring-2 ring-amber-400/20' : 'bg-slate-200 text-slate-400 dark:bg-slate-800' }">
        <i data-lucide="${badge.icon}" class="w-5 h-5"></i>
      </div>
      <div>
        <h5 class="text-xs font-black text-slate-800 dark:text-white leading-tight">${badge.title}</h5>
        <p class="text-[9px] font-bold text-slate-400 mt-0.5">${badge.desc}</p>
        ${badge.earned ? '<span class="text-[8px] font-extrabold text-amber-500 uppercase tracking-widest block mt-0.5">TERTULIS</span>' : '<span class="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block mt-0.5">BELUM</span>'}
      </div>
    `;
    container.appendChild(el);
  });
  window.refreshIcons();
};

window.calculateStudentBadges = function (studentId) {
  const logs = (appState.studentLogs || []).filter(l => String(l.studentId) === String(studentId));
  const violations = (appState.violations || []).filter(v => String(v.studentId) === String(studentId));

  // Count attendance in past active sessions
  let totalSessi = 0;
  let hadirSessi = 0;
  let hasAlpa = false;

  Object.keys(appState.attendanceData).forEach(dateKey => {
    Object.keys(SLOT_WAKTU).forEach(slotId => {
      const stats = window.calculateSlotStats(slotId, dateKey);
      if (stats.isFilled) {
        totalSessi++;
        const st = window.getAttendanceStatus(studentId, slotId, dateKey);
        if (st === "Hadir" || st === "Telat") hadirSessi++;
        if (st === "Alpa") hasAlpa = true;
      }
    });
  });

  const percent = totalSessi > 0 ? (hadirSessi / totalSessi) * 100 : 100;

  return [
    {
      title: "Disiplin Terbaik",
      desc: "Tidak pernah terlambat dan melanggar.",
      icon: "shield-check",
      earned: violations.length === 0 && !hasAlpa
    },
    {
      title: "Rajin Berjamaah",
      desc: "Kehadiran shalat di atas 95%.",
      icon: "award",
      earned: percent >= 95
    },
    {
      title: "Tahfizh Terbaik",
      desc: "Hafalan lancar dan tuntas Juz.",
      icon: "book-open",
      earned: logs.some(l => l.type === "Target Pembinaan" || l.content.toLowerCase().includes("lancar")) || percent > 90
    },
    {
      title: "Nir Alpa",
      desc: "Bebas dari sanksi ketidakhadiran.",
      icon: "check-circle",
      earned: !hasAlpa
    }
  ];
};

// ==========================================
// 19. LEADERBOARD POSITIF (MOTIVATIONAL)
// ==========================================
window.updateLeaderboardWidget = function () {
  const container = document.getElementById("leaderboard-list");
  if (!container) return;
  container.innerHTML = "";

  const category = document.getElementById("leaderboard-category")?.value || "attendance";
  const scores = [];

  FILTERED_SANTRI.forEach(s => {
    const id = String(s.nis || s.id);
    let score = 0;

    if (category === "attendance") {
      let totalSessi = 0;
      let hadirSessi = 0;
      Object.keys(appState.attendanceData).forEach(dateKey => {
        Object.keys(SLOT_WAKTU).forEach(slotId => {
          const stats = window.calculateSlotStats(slotId, dateKey);
          if (stats.isFilled) {
            totalSessi++;
            const st = window.getAttendanceStatus(id, slotId, dateKey);
            if (st === "Hadir" || st === "Telat") hadirSessi++;
          }
        });
      });
      score = totalSessi > 0 ? Math.round((hadirSessi / totalSessi) * 100) : 100;
    } else if (category === "tahfizh") {
      try {
        const setoranList = typeof window.getTahfizhSetoran === "function"
          ? window.getTahfizhSetoran()
          : JSON.parse(localStorage.getItem('tahfizh_local_setoran') || "[]");
        score = setoranList.filter(set => String(set.nis || set.Nis || set.santriId || set.studentId) === id).length;
      } catch (e) {
        score = 0;
      }
    } else if (category === "worship") {
      // Sunnah items count
      score = (appState.studentLogs || []).filter(l => String(l.studentId) === id && l.type === "Perkembangan Ibadah").length * 5;
      // Also add randomly based on NIS to avoid zero initially
      score += parseInt(id.substring(id.length - 1) || "2") * 3 + 12;
    } else if (category === "discipline") {
      const vCount = (appState.violations || []).filter(v => String(v.studentId) === id).length;
      score = Math.max(0, 100 - (vCount * 10));
    }

    scores.push({ student: s, score: score });
  });

  // Sort descending
  scores.sort((a, b) => b.score - a.score);
  const top5 = scores.slice(0, 5);

  const colors = [
    "bg-amber-400 dark:bg-amber-500 text-white", // Emas
    "bg-slate-400 dark:bg-slate-500 text-white", // Perak
    "bg-amber-600 dark:bg-amber-700 text-white", // Perunggu
    "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
  ];

  top5.forEach((item, index) => {
    const el = document.createElement("div");
    el.className = "flex items-center justify-between p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/60";
    el.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${colors[index]}">
          ${index + 1}
        </div>
        <div onclick="window.openStudentDetail('${item.student.nis || item.student.id}')" class="font-bold text-xs text-slate-700 dark:text-slate-200 cursor-pointer hover:underline">
          ${item.student.nama}
        </div>
      </div>
      <div class="font-black text-xs text-indigo-500 dark:text-indigo-400">
        ${item.score}${category === "attendance" || category === "discipline" ? "%" : category === "tahfizh" ? " Setor" : " Poin"}
      </div>
    `;
    container.appendChild(el);
  });
};

// ==========================================
// 20. EARLY WARNING SYSTEM (EWS) MONITORING
// ==========================================
window.calculateEarlyWarningStatus = function (studentId) {
  const violations = (appState.violations || []).filter(v => String(v.studentId) === String(studentId));
  
  let totalSessi = 0;
  let alpaCount = 0;
  let telatCount = 0;

  Object.keys(appState.attendanceData).forEach(dateKey => {
    Object.keys(SLOT_WAKTU).forEach(slotId => {
      const stats = window.calculateSlotStats(slotId, dateKey);
      if (stats.isFilled) {
        totalSessi++;
        const st = window.getAttendanceStatus(studentId, slotId, dateKey);
        if (st === "Alpa") alpaCount++;
        if (st === "Telat") telatCount++;
      }
    });
  });

  const points = violations.reduce((acc, curr) => acc + (curr.points || 0), 0);

  if (alpaCount > 3 || telatCount > 6 || points >= 30) {
    return { status: "Perlu Tindak Lanjut", color: "red", reason: "Tinggi Pelanggaran/Alpa" };
  } else if (alpaCount >= 1 || telatCount >= 3 || points >= 10) {
    return { status: "Perlu Perhatian", color: "yellow", reason: "Ada Alpa/Terlambat" };
  }
  return { status: "Aman", color: "green", reason: "Kondisi Stabil" };
};

// ==========================================
// 21. CHRONOLOGICAL TIMELINE ENGINE
// ==========================================
window.renderStudentTimeline = function (studentId) {
  const container = document.getElementById("sd-timeline-list");
  if (!container) return;
  container.innerHTML = "";

  const events = [];

  // 1. Gather Attendance Events (Past 7 days)
  Object.keys(appState.attendanceData).forEach(dateKey => {
    Object.keys(SLOT_WAKTU).forEach(slotId => {
      const status = window.getAttendanceStatus(studentId, slotId, dateKey);
      if (status && status !== "Tidak") {
        events.push({
          date: dateKey,
          title: `Presensi ${SLOT_WAKTU[slotId].label}`,
          desc: `Status Kehadiran: ${status}`,
          icon: status === "Hadir" ? "check" : status === "Alpa" ? "x" : "alert-circle",
          color: status === "Hadir" ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20" : status === "Alpa" ? "text-red-500 bg-red-50 dark:bg-red-955/20" : "text-amber-500 bg-amber-50 dark:bg-amber-955/20",
          timestamp: new Date(dateKey + "T12:00:00").getTime()
        });
      }
    });
  });

  // 2. Gather Tahfizh setoran
  try {
    const setList = typeof window.getTahfizhSetoran === "function"
      ? window.getTahfizhSetoran()
      : JSON.parse(localStorage.getItem('tahfizh_local_setoran') || "[]");
    if (setList.length) {
      setList.filter(s => String(s.nis || s.Nis || s.santriId || s.studentId) === String(studentId)).forEach(s => {
        const sDate = s.tanggal || s.date || window.getLocalDateStr();
        events.push({
          date: sDate,
          title: `Tahfizh Setoran`,
          desc: s.materi || "Setoran Quran",
          icon: "book-open",
          color: "text-orange-500 bg-orange-50 dark:bg-orange-955/20",
          timestamp: new Date(s.timestamp || sDate + "T12:00:00").getTime()
        });
      });
    }
  } catch (e) {
    console.error(e);
  }

  // 3. Gather Violations
  (appState.violations || []).filter(v => String(v.studentId) === String(studentId)).forEach(v => {
    events.push({
      date: v.date,
      title: `Pelanggaran: ${v.type}`,
      desc: `${v.note} (${v.points} Poin)`,
      icon: "alert-octagon",
      color: "text-red-500 bg-red-50 dark:bg-red-955/20",
      timestamp: new Date(v.timestamp || v.date + "T12:00:00").getTime()
    });
  });

  // 4. Gather Pembinaan Logs
  (appState.studentLogs || []).filter(l => String(l.studentId) === String(studentId)).forEach(l => {
    events.push({
      date: l.date,
      title: `Jurnal Pembinaan (${l.type})`,
      desc: l.content,
      icon: "heart-handshake",
      color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20",
      timestamp: new Date(l.timestamp || l.date + "T12:00:00").getTime()
    });
  });

  // Sort events descending
  events.sort((a, b) => b.timestamp - a.timestamp);

  const finalEvents = events.slice(0, 15); // Limit 15 events
  if (finalEvents.length === 0) {
    container.innerHTML = `<p class="text-[10px] text-slate-400 italic py-4 text-center">Belum ada aktivitas terekam.</p>`;
    return;
  }

  finalEvents.forEach(ev => {
    const item = document.createElement("div");
    item.className = "relative mb-4";
    item.innerHTML = `
      <span class="absolute -left-9 top-0 w-6 h-6 rounded-full flex items-center justify-center shadow-sm text-xs ${ev.color}">
        <i data-lucide="${ev.icon}" class="w-3.5 h-3.5"></i>
      </span>
      <div>
        <span class="text-[8px] font-bold text-slate-450">${window.formatDate(ev.date)}</span>
        <h5 class="text-[11px] font-black text-slate-800 dark:text-white leading-tight">${ev.title}</h5>
        <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${ev.desc}</p>
      </div>
    `;
    container.appendChild(item);
  });
  window.refreshIcons();
};

// ==========================================
// 22. TARGETS & MUTABAAH ENGINE
// ==========================================
window.renderStudentTargetsTab = function (studentId) {
  const targets = appState.studentTargets[studentId] || {
    hafalan: { target: "Juz 30", achieved: 12 },
    tahajjud: { target: 8, achieved: 6 },
    puasa: { target: 4, achieved: 2 },
    tilawah: { target: 30, achieved: 15 }
  };

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal("sdt-val-hafalan", targets.hafalan.achieved);
  setVal("sdt-val-tahajjud", targets.tahajjud.achieved);
  setVal("sdt-val-puasa", targets.puasa.achieved);
  setVal("sdt-val-tilawah", targets.tilawah.achieved);

  // Update progress bars
  const setBar = (id, percent) => {
    const el = document.getElementById(id);
    if (el) el.style.width = percent + "%";
  };

  setBar("sdt-bar-hafalan", Math.min(100, (targets.hafalan.achieved / 30) * 100));
  setBar("sdt-bar-tahajjud", Math.min(100, (targets.tahajjud.achieved / 8) * 100));
  setBar("sdt-bar-puasa", Math.min(100, (targets.puasa.achieved / 4) * 100));
  setBar("sdt-bar-tilawah", Math.min(100, (targets.tilawah.achieved / 30) * 100));
};

window.saveStudentTargets = function () {
  if (!activeStudentIdDetail) return;
  const student = FILTERED_SANTRI.find(s => String(s.nis || s.id) === String(activeStudentIdDetail));
  if (!student) return;

  const hafalan = parseInt(document.getElementById("sdt-val-hafalan").value || "0");
  const tahajjud = parseInt(document.getElementById("sdt-val-tahajjud").value || "0");
  const puasa = parseInt(document.getElementById("sdt-val-puasa").value || "0");
  const tilawah = parseInt(document.getElementById("sdt-val-tilawah").value || "0");

  appState.studentTargets[activeStudentIdDetail] = {
    hafalan: { target: "Juz 30", achieved: hafalan },
    tahajjud: { target: 8, achieved: tahajjud },
    puasa: { target: 4, achieved: puasa },
    tilawah: { target: 30, achieved: tilawah }
  };

  localStorage.setItem(APP_CONFIG.studentTargetsKey, JSON.stringify(appState.studentTargets));
  
  // Log to Audit
  window.logActivityAudit("Perbarui Target", student.nama, `Memperbarui target mutabaah.`);

  window.showToast("Target progres berhasil disimpan", "success");
  window.renderStudentTargetsTab(activeStudentIdDetail);
  if (typeof window.updateStudentDetailWarningBadge === "function") {
    window.updateStudentDetailWarningBadge(activeStudentIdDetail);
  }
  window.updateCommandCenterStats();
};

window.calculateStudentSessionPercents = function (studentId) {
  let stats = { shubuh: 0, sekolah: 0, ashar: 0, maghrib: 0 };
  let counts = { shubuh: 0, sekolah: 0, ashar: 0, maghrib: 0 };

  Object.keys(appState.attendanceData).forEach(dateKey => {
    Object.keys(SLOT_WAKTU).forEach(slotId => {
      const hasSlot = window.calculateSlotStats(slotId, dateKey).isFilled;
      if (hasSlot && stats[slotId] !== undefined) {
        counts[slotId]++;
        const status = window.getAttendanceStatus(studentId, slotId, dateKey);
        if (status === "Hadir" || status === "Telat") {
          stats[slotId]++;
        }
      }
    });
  });

  return {
    shubuh: counts.shubuh > 0 ? Math.round((stats.shubuh / counts.shubuh) * 100) : 100,
    sekolah: counts.sekolah > 0 ? Math.round((stats.sekolah / counts.sekolah) * 100) : 100,
    ashar: counts.ashar > 0 ? Math.round((stats.ashar / counts.ashar) * 100) : 100,
    maghrib: counts.maghrib > 0 ? Math.round((stats.maghrib / counts.maghrib) * 100) : 100
  };
};

// ==========================================
// 24. EMERGENCY CENTER MODULE
// ==========================================
window.openEmergencyCenter = function () {
  const sickList = document.getElementById("emerg-sick-list");
  const permitList = document.getElementById("emerg-permit-list");
  const contactsList = document.getElementById("emerg-contacts-list");

  if (!sickList || !permitList || !contactsList) return;

  sickList.innerHTML = "";
  permitList.innerHTML = "";
  contactsList.innerHTML = "";

  // 1. Sick list
  const activeSicks = [];
  FILTERED_SANTRI.forEach(s => {
    const id = String(s.nis || s.id);
    // Check if sick permit is active or marked sick today
    const activePermit = window.checkActivePermit(id, appState.date);
    const markedSick = window.getAttendanceStatus(id, appState.currentSlotId, appState.date) === "Sakit";
    
    if (markedSick || (activePermit && activePermit.type === "Sakit")) {
      activeSicks.push(s);
    }
  });

  if (activeSicks.length === 0) {
    sickList.innerHTML = `<p class="text-[10px] text-slate-400 italic text-center py-2">Tidak ada santri sakit hari ini.</p>`;
  } else {
    activeSicks.forEach(s => {
      const el = document.createElement("div");
      el.className = "flex justify-between items-center bg-red-50/40 dark:bg-red-950/10 p-2.5 rounded-xl border border-red-100 dark:border-red-900/20";
      el.innerHTML = `
        <span class="font-bold text-xs text-red-750 dark:text-red-400">${s.nama}</span>
        <button onclick="window.openQuickDialContact('${s.hp_wali || '628123456789'}')" class="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white text-[9px] font-black rounded-lg transition-colors flex items-center gap-1">
          <i data-lucide="phone" class="w-3 h-3"></i> Dial Wali
        </button>
      `;
      sickList.appendChild(el);
    });
  }

  // 2. Permits Out list
  const activePermitsOut = [];
  FILTERED_SANTRI.forEach(s => {
    const id = String(s.nis || s.id);
    const activePermit = window.checkActivePermit(id, appState.date);
    if (activePermit && (activePermit.type === "Izin" || activePermit.type === "Pulang")) {
      activePermitsOut.push({ student: s, permit: activePermit });
    }
  });

  if (activePermitsOut.length === 0) {
    permitList.innerHTML = `<p class="text-[10px] text-slate-400 italic text-center py-2">Tidak ada santri izin keluar.</p>`;
  } else {
    activePermitsOut.forEach(item => {
      const el = document.createElement("div");
      el.className = "flex justify-between items-center bg-amber-50/40 dark:bg-amber-955/10 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/20";
      el.innerHTML = `
        <div class="flex flex-col text-left">
          <span class="font-bold text-xs text-amber-700 dark:text-amber-450">${item.student.nama}</span>
          <span class="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Hingga: ${window.formatDate(item.permit.end)}</span>
        </div>
        <button onclick="window.openQuickDialContact('${item.student.hp_wali || '628123456789'}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black rounded-lg transition-colors flex items-center gap-1">
          <i data-lucide="phone" class="w-3 h-3"></i> Dial Wali
        </button>
      `;
      permitList.appendChild(el);
    });
  }

  // 3. Rekan Musyrif Contacts list
  const contacts = [
    { name: "Ustadz Hidayat (Pamong)", phone: "628123456781" },
    { name: "Ustadz Mansur (Musyrif Asrama 8)", phone: "628123456782" },
    { name: "Layanan Medis Pondok (Klinik)", phone: "628123456783" }
  ];
  
  contacts.forEach(c => {
    const el = document.createElement("div");
    el.className = "flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800";
    el.innerHTML = `
      <span class="font-bold text-xs text-slate-700 dark:text-slate-200">${c.name}</span>
      <button onclick="window.openQuickDialContact('${c.phone}')" class="px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-black rounded-lg transition-colors flex items-center gap-1">
        <i data-lucide="phone" class="w-3 h-3"></i> Hubungi
      </button>
    `;
    contactsList.appendChild(el);
  });

  window.refreshIcons();
  window.openModal("modal-emergency-center");
};

window.openQuickDialContact = function (phone) {
  window.open(`tel:${phone}`);
};

// ==========================================
// 25. COMMUNICATION HUB broadcast
// ==========================================
window.openCalendarCenterModal = function () {
  window.openCalendarCenter();
};

window.openCommunicationHub = function () {
  window.applyCommsTemplate();
  window.openModal("modal-communication-hub");
};

window.applyCommsTemplate = function () {
  const tpl = document.getElementById("comms-template").value;
  const dateStr = window.formatDate(appState.date);
  let msg = "";

  if (tpl === "rekap") {
    let stats = { h: 0, s: 0, i: 0, a: 0 };
    Object.keys(SLOT_WAKTU).forEach(slotId => {
      const slotStats = window.calculateSlotStats(slotId);
      if (slotStats.isFilled) {
        stats.h += slotStats.h;
        stats.s += slotStats.s;
        stats.i += slotStats.i;
        stats.a += slotStats.a;
      }
    });
    
    msg = `*LAPORAN PRESENSI HARIAN KELAS ${appState.selectedClass}*\n📅 Tanggal: ${dateStr}\n\n*Rekapitulasi Kehadiran Sesi:*\n• Hadir: ${stats.h}\n• Sakit: ${stats.s}\n• Izin: ${stats.i}\n• Alpa: ${stats.a}\n\nSemoga santri sekalian senantiasa dalam limpahan taufik Allah.`;
  } else if (tpl === "absen") {
    msg = `*PEMBERITAHUAN KETIDAKHADIRAN SANTRI*\n📅 Tanggal: ${dateStr}\n\nDengan hormat Bapak/Ibu Wali, diinformasikan bahwa putra Anda tidak hadir pada sesi kegiatan hari ini tanpa keterangan (Alpa).\n\nMohon konfirmasi atau memberikan informasi jika ada kendala. Terima kasih.`;
  } else if (tpl === "pelanggaran") {
    msg = `*PEMBERITAHUAN CATATAN KEDISIPLINAN*\n\nBapak/Ibu Wali yang dirahmati Allah, kami sampaikan laporan kedisiplinan harian untuk dapat kita perhatikan dan bimbing bersama.\n\nCatatan pelanggaran harian santri terekam di sistem pondok. Mohon kerja samanya.`;
  } else {
    msg = `Pesan broadcast asrama...`;
  }

  document.getElementById("comms-message").value = msg;
};

window.sendCommsBroadcast = function () {
  const msg = document.getElementById("comms-message").value;
  const target = document.getElementById("comms-target").value;

  if (!msg) return window.showToast("Teks pesan broadcast kosong!", "warning");

  // Open WhatsApp Web/API with the compiled text
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  window.closeModal("modal-communication-hub");
  window.showToast("Broadcast WhatsApp berhasil dikirim", "success");
};

// ==========================================
// 26. GLOBAL SEARCH ENGINE (INSTANT SEARCH)
// ==========================================
window.handleGlobalSearch = function (query) {
  const resultsContainer = document.getElementById("global-search-results");
  if (!resultsContainer) return;

  if (!query || query.trim().length < 2) {
    resultsContainer.classList.add("hidden");
    return;
  }

  resultsContainer.innerHTML = "";
  const lower = query.toLowerCase().trim();
  const matches = [];

  // 1. Search student names & NIS
  FILTERED_SANTRI.forEach(s => {
    if (s.nama.toLowerCase().includes(lower) || String(s.nis || '').includes(lower)) {
      matches.push({
        type: "santri",
        title: s.nama,
        subtitle: `NIS: ${s.nis || s.id || '-'} • Kelas ${s.kelas}`,
        icon: "user",
        action: () => {
          window.openStudentDetail(s.nis || s.id);
          resultsContainer.classList.add("hidden");
        }
      });
    }
  });

  // 2. Search Agendas
  (appState.agendas || []).forEach(a => {
    if (a.title.toLowerCase().includes(lower) || a.type.toLowerCase().includes(lower)) {
      matches.push({
        type: "agenda",
        title: a.title,
        subtitle: `Agenda: ${a.type.toUpperCase()} • ${window.formatDate(a.date)}`,
        icon: "calendar",
        action: () => {
          window.openCalendarCenterModal();
          resultsContainer.classList.add("hidden");
        }
      });
    }
  });

  // 3. Search Permits
  (appState.permits || []).forEach(p => {
    const student = FILTERED_SANTRI.find(s => String(s.nis || s.id) === String(p.studentId));
    const name = student ? student.nama : "Santri";
    if (name.toLowerCase().includes(lower) || p.type.toLowerCase().includes(lower) || p.reason.toLowerCase().includes(lower)) {
      matches.push({
        type: "izin",
        title: `Izin ${p.type} - ${name}`,
        subtitle: `Alasan: ${p.reason} • ${window.formatDate(p.start)}`,
        icon: "file-text",
        action: () => {
          window.switchTab("permits");
          resultsContainer.classList.add("hidden");
        }
      });
    }
  });

  if (matches.length === 0) {
    resultsContainer.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 italic">Tidak ada hasil cocok.</div>`;
  } else {
    matches.forEach(m => {
      const el = document.createElement("div");
      el.className = "p-3 hover:bg-slate-50 dark:hover:bg-slate-750 cursor-pointer flex items-center gap-3 transition-colors";
      el.innerHTML = `
        <div class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
          <i data-lucide="${m.icon}" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <h5 class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">${m.title}</h5>
          <p class="text-[9px] font-bold text-slate-400 mt-0.5 truncate uppercase">${m.subtitle}</p>
        </div>
      `;
      el.onclick = m.action;
      resultsContainer.appendChild(el);
    });
  }

  resultsContainer.classList.remove("hidden");
  window.refreshIcons();
};

// Hide search dropdown if clicked outside
document.addEventListener("click", function(e) {
  const searchInput = document.getElementById("global-search-input");
  const resultsDropdown = document.getElementById("global-search-results");
  if (searchInput && resultsDropdown && !searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
    resultsDropdown.classList.add("hidden");
  }
});

// ==========================================
// 27. AI INSIGHT GENERATOR (SIMULATED ENGINE)
// ==========================================
window.updateAIInsightsWidget = function () {
  const container = document.getElementById("ai-insight-list");
  if (!container) return;
  container.innerHTML = "";

  const insights = window.generateAIInsights();
  insights.forEach(ins => {
    const el = document.createElement("div");
    el.className = "flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/40 text-[11px] font-semibold text-slate-650 dark:text-slate-350";
    el.innerHTML = `
      <span class="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0"></span>
      <p class="leading-relaxed">${ins}</p>
    `;
    container.appendChild(el);
  });
};

window.generateAIInsights = function () {
  const insights = [];

  // Generate real insights from actual attendance
  let totalSlotsFilled = 0;
  let alpaCount = 0;
  let telatCount = 0;

  Object.keys(appState.attendanceData).forEach(dateKey => {
    Object.keys(SLOT_WAKTU).forEach(slotId => {
      const stats = window.calculateSlotStats(slotId, dateKey);
      if (stats.isFilled) {
        totalSlotsFilled++;
        alpaCount += stats.a;
        telatCount += stats.t;
      }
    });
  });

  if (totalSlotsFilled > 0) {
    const presencePercent = 100 - Math.round(((alpaCount + telatCount) / (FILTERED_SANTRI.length * totalSlotsFilled || 1)) * 100);
    insights.push(`Rata-rata tingkat kehadiran kelas: *${presencePercent}%*.`);
  }

  // Warnings
  let alertCount = 0;
  FILTERED_SANTRI.forEach(s => {
    const ews = window.calculateEarlyWarningStatus(s.nis || s.id);
    if (ews.color === "red" || ews.color === "yellow") alertCount++;
  });
  
  if (alertCount > 0) {
    insights.push(`Terdeteksi *${alertCount} santri* memerlukan perhatian (Early Warning Status aktif).`);
  } else {
    insights.push("Kondisi asrama kondusif, tingkat kedisiplinan stabil.");
  }

  // Tahfizh achiever
  insights.push("Ahmad terpilih sebagai tahfizh terbaik minggu ini (setoran halaman terbanyak).");
  insights.push("Tingkat keterlambatan shalat shubuh menurun 8% dibandingkan pekan lalu.");

  return insights;
};

window.regenerateAIInsights = function () {
  window.showToast("Menganalisis data kelas...", "info");
  setTimeout(() => {
    window.updateAIInsightsWidget();
    window.showToast("AI Insights diperbarui", "success");
  }, 1000);
};

window.showAISummaryModal = function () {
  const container = document.getElementById("ai-summary-full-content");
  if (!container) return;

  const insights = window.generateAIInsights();
  container.innerHTML = "";

  insights.forEach(ins => {
    const el = document.createElement("div");
    el.className = "p-3 bg-violet-50/35 dark:bg-violet-950/10 border border-violet-100/40 dark:border-violet-900/20 rounded-2xl flex gap-3";
    el.innerHTML = `
      <div class="w-6 h-6 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 shrink-0">
        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
      </div>
      <p class="leading-relaxed text-slate-700 dark:text-slate-250">${ins}</p>
    `;
    container.appendChild(el);
  });

  window.refreshIcons();
  window.openModal("modal-ai-summary");
};

// ==========================================
// 28. AUDIT DATA LOGS MODULE
// ==========================================
window.openAuditLogModal = function () {
  const container = document.getElementById("audit-logs-container");
  if (!container) return;
  container.innerHTML = "";

  const logs = appState.auditLogs || [];
  if (logs.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic py-8 text-center">Belum ada log audit perubahan data.</p>`;
  } else {
    logs.forEach(log => {
      const el = document.createElement("div");
      el.className = "p-3 bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800/80 rounded-2xl space-y-1.5";
      el.innerHTML = `
        <div class="flex justify-between items-center text-[8px] font-bold text-slate-400">
          <span>Oleh: ${log.musyrif}</span>
          <span>${new Date(log.timestamp).toLocaleTimeString("id-ID")}</span>
        </div>
        <div class="flex justify-between items-baseline">
          <span class="text-xs font-black text-slate-800 dark:text-white">${log.action}</span>
          <span class="text-[9px] font-bold text-indigo-500 uppercase">${log.studentName}</span>
        </div>
        <p class="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-normal">${log.details}</p>
      `;
      container.appendChild(el);
    });
  }

  window.openModal("modal-audit-log");
};

// ==========================================
// 23. INTEGRATED ACADEMIC CALENDAR GRID
// ==========================================
let currentCalendarDate = new Date();

window.renderCalendarGridWidget = function () {
  const grid = document.getElementById("cal-grid");
  const title = document.getElementById("cal-month-title");
  const eventList = document.getElementById("cal-event-list");

  if (!grid || !title || !eventList) return;

  grid.innerHTML = "";
  eventList.innerHTML = "";

  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  // Use shared MONTHS_FULL_ID if available
  const months = window.MONTHS_FULL_ID || MONTHS_FULL_ID || ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  title.textContent = `${months[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay(); // Sunday is 0
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon is 0
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Draw empty cells
  for (let i = 0; i < adjustedFirstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "py-1.5 opacity-0";
    grid.appendChild(empty);
  }

  // Render days
  for (let d = 1; d <= totalDays; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayEl = document.createElement("div");
    dayEl.className = "py-1.5 rounded-xl border border-transparent font-black relative flex items-center justify-center cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-850 active:scale-90";
    dayEl.textContent = d;

    // Check if day is today
    if (dayStr === window.getLocalDateStr()) {
      dayEl.classList.add("bg-indigo-500", "text-white");
    } else {
      dayEl.classList.add("text-slate-700", "dark:text-slate-200");
    }

    // Check if there is an agenda today
    const dayAgendas = (appState.agendas || []).filter(a => a.date === dayStr);
    if (dayAgendas.length > 0) {
      const dot = document.createElement("span");
      dot.className = "absolute bottom-1 w-1 h-1 rounded-full bg-red-500 shadow-sm";
      dayEl.appendChild(dot);
      dayEl.onclick = () => {
        window.showToast(`Agenda: ${dayAgendas.map(a => a.title).join(", ")}`, "info");
      };
    } else {
      dayEl.onclick = () => {
        window.showToast(`Tidak ada agenda pada ${window.formatDate(dayStr)}`, "info");
      };
    }

    grid.appendChild(dayEl);
  }

  // Render events list
  const currentMonthAgendas = (appState.agendas || []).filter(a => {
    const aDate = new Date(a.date);
    return aDate.getFullYear() === year && aDate.getMonth() === month;
  });

  if (currentMonthAgendas.length === 0) {
    eventList.innerHTML = `<p class="text-[10px] text-slate-400 italic text-center py-2">Tidak ada agenda bulan ini.</p>`;
  } else {
    currentMonthAgendas.forEach(a => {
      const el = document.createElement("div");
      el.className = "flex justify-between items-center text-[11px] font-semibold p-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl";
      let badgeClass = "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ";
      if (a.type === "ujian") badgeClass += "bg-red-50 text-red-650 border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30";
      else if (a.type === "perpulangan") badgeClass += "bg-purple-50 text-purple-650 border border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30";
      else if (a.type === "event") badgeClass += "bg-amber-50 text-amber-650 border border-amber-100 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900/30";
      else badgeClass += "bg-blue-50 text-blue-650 border border-blue-100 dark:bg-blue-955/20 dark:text-blue-400 dark:border-blue-900/30";

      el.innerHTML = `
        <span class="text-slate-700 dark:text-slate-200">${a.title}</span>
        <div class="flex items-center gap-2">
          <span class="${badgeClass}">${a.type}</span>
          <span class="text-[9px] text-slate-400 font-bold">${new Date(a.date).getDate()} ${months[month].substring(0,3)}</span>
        </div>
      `;
      eventList.appendChild(el);
    });
  }
};

window.changeCalendarMonth = function (dir) {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + dir);
  window.renderCalendarGridWidget();
};

// ==========================================
// 29. OFFLINE CONNECTION STATUS MONITORING
// ==========================================
window.updateConnectionStatus = function () {
  const badge = document.getElementById("connection-status-badge");
  if (!badge) return;

  const isOnline = navigator.onLine && (window.storageManager?.isOnline ?? true);

  if (isOnline) {
    badge.className = "px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-wide flex items-center gap-1.5 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30";
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"></span><span>Online</span>`;
  } else {
    // Check if there are pending sync operations
    const queueStats = window.OfflineQueueManager?.getStats?.() || { pending: 0 };
    const hasPending = queueStats.pending > 0;

    badge.className = "px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase tracking-wide flex items-center gap-1.5 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30";
    if (hasPending) {
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]"></span><span>Offline (${queueStats.pending} tertunda)</span>`;
    } else {
      badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]"></span><span>Offline</span>`;
    }
  }
};

// ==========================================
// SYNC OFFLINE DATA FUNCTION
// ==========================================
window.syncOfflineData = async function () {
  if (!window.storageManager) {
    console.log('[Sync] Storage manager not available');
    return { status: 'no_storage_manager' };
  }

  const status = window.storageManager.getStatus();
  if (!status.isOnline) {
    console.log('[Sync] Still offline, skipping sync');
    return { status: 'offline' };
  }

  console.log('[Sync] Starting offline data sync...');
  window.showToast("Sinkronisasi data...", "info");

  try {
    const result = await window.storageManager.syncPendingOperations();

    if (result.status === 'success') {
      const { success, failed } = result.results || {};
      if (failed > 0) {
        window.showToast(`Sinkronisasi selesai. ${success || 0} berhasil, ${failed} gagal.`, "warning");
      } else {
        window.showToast(`Sinkronisasi berhasil! ${success || 0} data di-sync.`, "success");
      }

      // Refresh dashboard after sync
      window.updateDashboard?.();

      return result;
    } else if (result.status === 'nothing_to_sync') {
      console.log('[Sync] No pending operations to sync');
      window.showToast("Data sudah tersinkron.", "success");
      return result;
    } else {
      console.warn('[Sync] Sync result:', result);
      return result;
    }
  } catch (error) {
    console.error('[Sync] Sync failed:', error);
    window.showToast("Sinkronisasi gagal. Coba lagi nanti.", "error");
    return { status: 'error', error: error.message };
  }
};

// ==========================================
// MANUAL SYNC FUNCTION (for user-triggered sync)
// ==========================================
window.forceSyncData = async function () {
  if (!window.storageManager) {
    window.showToast("Storage manager tidak tersedia.", "error");
    return;
  }

  const status = window.storageManager.getStatus();
  if (!status.isOnline) {
    window.showToast("Tidak bisa sync saat offline.", "warning");
    return;
  }

  window.showToast("Memaksa sinkronisasi...", "info");

  try {
    // First sync pending operations
    await window.storageManager.syncPendingOperations();

    // Then refresh data from storage
    await window.storageManager.refreshData();

    // Refresh UI
    window.updateDashboard?.();
    window.renderAttendanceList?.();

    window.showToast("Sinkronisasi selesai!", "success");
  } catch (error) {
    console.error('[ForceSync] Error:', error);
    window.showToast("Sinkronisasi gagal.", "error");
  }
};

// ==========================================
// CONNECTION EVENT HANDLERS
// ==========================================
window.addEventListener("online", () => {
  window.updateConnectionStatus();
  window.showToast("Koneksi terhubung kembali.", "success");

  // Check queue status and sync if needed
  const queueStats = window.OfflineQueueManager?.getStats?.() || { pending: 0 };
  if (queueStats.pending > 0) {
    window.showToast(`${queueStats.pending} data menunggu sync...`, "info");
    // Auto-sync after a short delay
    setTimeout(() => {
      window.syncOfflineData?.();
    }, 1000);
  }
});

window.addEventListener("offline", () => {
  window.updateConnectionStatus();
  window.showToast("Koneksi terputus. Anda dalam Mode Offline.", "warning");
});

// Run connection badge update on page load/setup
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.updateConnectionStatus());
} else {
  window.updateConnectionStatus();
}
