/**
 * dashboard-widgets.js - Dashboard Widget Rendering
 *
 * Extracted from dashboard-manager.js for better organization.
 * Contains UI rendering functions for dashboard widgets.
 */

// ============================================================================
// SLOT LIST WIDGET
// ============================================================================

/**
 * Render slot list on dashboard
 */
window.renderSlotList = function () {
  const container = document.getElementById("slot-list-container");
  if (!container) return;

  const today = window.getLocalDateStr();
  const dateKey = appState.date;
  const isToday = dateKey === today;
  const isHoliday = window.checkHoliday(dateKey);

  let html = `<div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">`;

  Object.values(SLOT_WAKTU).forEach((slot) => {
    if (!slot || slot.isHoliday) return;

    const isActive = appState.currentSlotId === slot.id;
    const access = window.isSlotAccessible(slot.id, dateKey);
    const slotHoliday = isSlotHoliday(slot.id, dateKey);
    const filledClass = isActive ? "ring-2 ring-emerald-500" : "";
    const statusBg = slotHoliday
      ? "bg-slate-100 dark:bg-slate-800 opacity-50"
      : access.locked
        ? "bg-amber-50 dark:bg-amber-950/30"
        : "bg-white dark:bg-slate-900";

    html += `
      <button onclick="window.quickOpen('${slot.id}')"
              class="flex-shrink-0 px-3 py-2 rounded-xl ${statusBg} ${filledClass} border border-slate-200 dark:border-slate-700 hover:border-emerald-400 transition-all text-left min-w-[100px]">
        <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400">${slot.label}</div>
        <div class="text-xs font-black text-slate-800 dark:text-white">${slot.subLabel || slot.time}</div>
        ${isHoliday ? `<div class="text-[9px] text-slate-400">Libur</div>` : ""}
      </button>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
};

// ============================================================================
// PROFILE INFO WIDGET
// ============================================================================

/**
 * Update profile info on dashboard
 */
window.updateProfileInfo = function () {
  const profileName = document.getElementById("profile-name");
  const profileClass = document.getElementById("profile-class");
  const profileRole = document.getElementById("profile-role");

  if (profileName) {
    const name = window.AppStorage.getItem("user_name") || appState.userName || "";
    profileName.textContent = name;
  }

  if (profileClass) {
    const kelas = appState.selectedClass || window.AppStorage.getItem("selected_class") || "";
    profileClass.textContent = kelas;
  }

  if (profileRole) {
    let roleText = "Musyrif";
    if (appState.adminMode) roleText = "Admin";
    else if (appState.waliMode) roleText = "Wali Santri";
    profileRole.textContent = roleText;
  }
};

// ============================================================================
// QUICK ACCESS BUTTONS
// ============================================================================

/**
 * Update quick access buttons
 */
window.updateQuickAccessButtons = function () {
  const container = document.getElementById("quick-actions-container");
  if (!container) return;

  const isAdmin = appState.adminMode;
  const isWali = appState.waliMode;

  const actions = [];

  if (!isWali) {
    actions.push(
      { icon: "calendar-check", label: "Presensi", action: "window.openAttendance()", color: "emerald" },
      { icon: "file-plus", label: "Izin", action: "window.openQuickPermit('izin')", color: "blue" },
    );

    if (isAdmin) {
      actions.push(
        { icon: "megaphone", label: "Broadcast", action: "window.openAdminBroadcast()", color: "purple" },
        { icon: "bar-chart-3", label: "Laporan", action: "window.navigateTo('report')", color: "amber" },
      );
    }

    actions.push(
      { icon: "book-open", label: "Tahfizh", action: "window.navigateTo('tahfizh')", color: "orange" },
      { icon: "settings", label: "Pengaturan", action: "window.openSettings()", color: "slate" },
    );
  } else {
    actions.push(
      { icon: "file-plus", label: "Ajukan Izin", action: "window.openWaliPermitRequest()", color: "blue" },
      { icon: "book-open", label: "Progress", action: "window.navigateTo('tahfizh')", color: "orange" },
      { icon: "settings", label: "Pengaturan", action: "window.openSettings()", color: "slate" },
    );
  }

  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
    blue: "bg-blue-50 text-blue-600 hover:bg-blue-100",
    purple: "bg-purple-50 text-purple-600 hover:bg-purple-100",
    amber: "bg-amber-50 text-amber-600 hover:bg-amber-100",
    orange: "bg-orange-50 text-orange-600 hover:bg-orange-100",
    slate: "bg-slate-50 text-slate-600 hover:bg-slate-100",
  };

  let html = `<div class="grid grid-cols-4 gap-2">`;
  actions.forEach((action) => {
    html += `
      <button onclick="${action.action}"
              class="flex flex-col items-center gap-1 p-3 rounded-xl ${colorMap[action.color]} transition-all active:scale-95">
        <i data-lucide="${action.icon}" class="w-5 h-5"></i>
        <span class="text-[10px] font-bold">${action.label}</span>
      </button>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
};

// ============================================================================
// KBM BANNER
// ============================================================================

/**
 * Render KBM (Kegiatan Belajar Mengajar) banner
 */
window.renderKBMBanner = function () {
  const container = document.getElementById("kbm-banner");
  if (!container) return;

  const today = new Date();
  const dayName = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][today.getDay()];

  // Check if weekend
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;

  if (isWeekend) {
    container.innerHTML = `
      <div class="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl text-white">
        <div class="p-2 bg-white/20 rounded-xl">
          <i data-lucide="sun" class="w-6 h-6"></i>
        </div>
        <div>
          <div class="font-black text-sm">${dayName} - Tidak Ada KBM</div>
          <div class="text-xs opacity-80">Kegiatan akan kembali besok</div>
        </div>
      </div>
    `;
  } else {
    const currentHour = today.getHours();
    let greeting = "";
    let activity = "";

    if (currentHour < 6) {
      greeting = "Shubuh";
      activity = "Sholat Shubuh Berjamaah";
    } else if (currentHour < 9) {
      greeting = "Pagi";
      activity = "Kegiatan Belajar";
    } else if (currentHour < 12) {
      greeting = "Siang";
      activity = "Kegiatan Belajar";
    } else if (currentHour < 15) {
      greeting = "Sore";
      activity = "Kegiatan Sore";
    } else {
      greeting = "Malam";
      activity = "Kegiatan Malam";
    }

    container.innerHTML = `
      <div class="flex items-center gap-3 p-4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl text-white">
        <div class="p-2 bg-white/20 rounded-xl">
          <i data-lucide="book-open" class="w-6 h-6"></i>
        </div>
        <div>
          <div class="font-black text-sm">Selamat ${greeting}</div>
          <div class="text-xs opacity-80">${activity}</div>
        </div>
      </div>
    `;
  }

  if (window.lucide) window.lucide.createIcons();
};

// ============================================================================
// ACTIVE PERMITS WIDGET
// ============================================================================

/**
 * Render active permits widget
 */
window.renderActivePermitsWidget = function () {
  const container = document.getElementById("active-permits-container");
  if (!container) return;

  const permits = (appState.permits || []).filter((p) => {
    if (!p || p.status === "rejected" || p.status === "selesai") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(p.end_date || p.tanggal_selesai || p.start_date || today);
    endDate.setHours(23, 59, 59, 999);
    return endDate >= today;
  });

  if (permits.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-slate-400">
        <i data-lucide="check-circle" class="w-6 h-6 mx-auto mb-2 opacity-50"></i>
        <p class="text-xs">Tidak ada izin aktif</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const categoryColors = {
    sakit: "bg-amber-50 text-amber-600 border-amber-200",
    izin: "bg-blue-50 text-blue-600 border-blue-200",
    pulang: "bg-purple-50 text-purple-600 border-purple-200",
  };

  let html = `<div class="space-y-2">`;
  permits.slice(0, 5).forEach((p) => {
    const category = (p.category || p.tipe_izin || "izin").toLowerCase();
    const colorClass = categoryColors[category] || categoryColors.izin;
    const student = window.getSantriByNis(p.nis);
    const studentName = student?.nama || p.studentName || "Santri";
    const endDate = p.end_date || p.tanggal_selesai || "-";

    html += `
      <div class="flex items-center justify-between p-2 rounded-lg ${colorClass} border">
        <div class="flex items-center gap-2">
          <i data-lucide="user" class="w-4 h-4"></i>
          <span class="text-xs font-bold">${window.sanitizeHTML(studentName)}</span>
        </div>
        <div class="text-[10px]">Selesai: ${window.sanitizeHTML(endDate)}</div>
      </div>
    `;
  });
  html += `</div>`;

  if (permits.length > 5) {
    html += `
      <button onclick="window.navigateTo('permits')" class="w-full mt-2 text-xs text-emerald-600 font-bold hover:underline">
        +${permits.length - 5} lainnya
      </button>
    `;
  }

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
};

// ============================================================================
// REMINDER WIDGET
// ============================================================================

/**
 * Render reminder widget
 */
window.renderReminderWidget = function () {
  const container = document.getElementById("reminder-container");
  if (!container) return;

  const reminders = (appState.reminders || []).filter((r) => !r.done);

  if (reminders.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-slate-400">
        <i data-lucide="check-check" class="w-6 h-6 mx-auto mb-2 opacity-50"></i>
        <p class="text-xs">Semua tugas selesai</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  let html = `<div class="space-y-2">`;
  reminders.slice(0, 3).forEach((r) => {
    const isOverdue = new Date(r.dueDate) < new Date();
    html += `
      <div class="flex items-center gap-2 p-2 rounded-lg ${isOverdue ? "bg-red-50 text-red-600 border border-red-200" : "bg-slate-50 dark:bg-slate-800"}">
        <button onclick="window.toggleReminderDone('${r.id}')" class="shrink-0">
          <i data-lucide="${r.done ? "check-square" : "square"}" class="w-4 h-4"></i>
        </button>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold truncate">${window.sanitizeHTML(r.title)}</div>
          <div class="text-[10px] ${isOverdue ? "text-red-500" : "text-slate-500"}">${window.sanitizeHTML(r.dueDate)}</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
};

// ============================================================================
// LEADERBOARD WIDGET
// ============================================================================

/**
 * Update leaderboard widget
 */
window.updateLeaderboardWidget = function () {
  const container = document.getElementById("leaderboard-container");
  if (!container) return;

  // Calculate top hafizh students
  const tahfizhData = appState.tahfizhData || {};
  const rankings = Object.entries(tahfizhData)
    .map(([nis, data]) => ({
      nis,
      name: window.getSantriByNis(nis)?.nama || "Unknown",
      pages: data.totalPages || 0,
    }))
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 5);

  if (rankings.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-slate-400">
        <p class="text-xs">Belum ada data tahfizh</p>
      </div>
    `;
    return;
  }

  let html = `<div class="space-y-2">`;
  rankings.forEach((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    html += `
      <div class="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
        <span class="text-sm">${medal}</span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-bold truncate">${window.sanitizeHTML(r.name)}</div>
        </div>
        <span class="text-xs font-black text-amber-600">${r.pages} hal.</span>
      </div>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
};

// ============================================================================
// HERO WIDGET
// ============================================================================

/**
 * Update hero widget
 */
window.updateHeroWidget = function () {
  const container = document.getElementById("hero-widget");
  if (!container) return;

  const hour = new Date().getHours();
  let greeting = "";
  let icon = "sun";
  let gradient = "from-amber-400 to-orange-500";

  if (hour >= 5 && hour < 10) {
    greeting = "Selamat Pagi";
    icon = "sunrise";
    gradient = "from-amber-400 to-orange-500";
  } else if (hour >= 10 && hour < 15) {
    greeting = "Selamat Siang";
    icon = "sun";
    gradient = "from-yellow-400 to-amber-500";
  } else if (hour >= 15 && hour < 18) {
    greeting = "Selamat Sore";
    icon = "sunset";
    gradient = "from-orange-400 to-red-500";
  } else {
    greeting = "Selamat Malam";
    icon = "moon";
    gradient = "from-indigo-500 to-purple-600";
  }

  container.innerHTML = `
    <div class="flex items-center gap-4 p-4 bg-gradient-to-r ${gradient} rounded-2xl text-white">
      <div class="p-3 bg-white/20 rounded-2xl">
        <i data-lucide="${icon}" class="w-8 h-8"></i>
      </div>
      <div>
        <div class="text-lg font-black">${greeting}</div>
        <div class="text-sm opacity-90">${window.sanitizeHTML(appState.userName || "Musyrif")}</div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
};

// ============================================================================
// WORSHIP WIDGET
// ============================================================================

/**
 * Update worship widget (jadwal sholat)
 */
window.updateWorshipWidget = function () {
  const container = document.getElementById("worship-widget");
  if (!container) return;

  const now = new Date();
  const times = window.getPrayerTimes?.(now) || {
    Shubuh: "04:30",
    Dzuhur: "11:45",
    Ashar: "15:15",
    Maghrib: "18:00",
    Isya: "19:15",
  };

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const prayerOrder = ["Shubuh", "Dzuhur", "Ashar", "Maghrib", "Isya"];
  let nextPrayer = "";
  let nextTime = "";

  for (const prayer of prayerOrder) {
    const [h, m] = times[prayer].split(":").map(Number);
    if (h * 60 + m > currentMinutes) {
      nextPrayer = prayer;
      nextTime = times[prayer];
      break;
    }
  }

  if (!nextPrayer) {
    nextPrayer = "Shubuh besok";
    nextTime = times.Shubuh;
  }

  let html = `<div class="grid grid-cols-5 gap-1 text-center">`;
  prayerOrder.forEach((prayer) => {
    const [h, m] = times[prayer].split(":").map(Number);
    const isActive = h * 60 + m <= currentMinutes && currentMinutes < h * 60 + m + 30;
    const isNext = prayer === nextPrayer;

    html += `
      <div class="p-2 rounded-lg ${isActive ? "bg-emerald-500 text-white" : isNext ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600" : "bg-slate-50 dark:bg-slate-800"}">
        <div class="text-[9px] font-bold">${prayer.slice(0, 3)}</div>
        <div class="text-xs font-black">${times[prayer]}</div>
      </div>
    `;
  });
  html += `</div>`;

  if (nextPrayer && nextPrayer !== "Shubuh besok") {
    html += `
      <div class="mt-2 text-center text-xs text-slate-500">
        Sholat <span class="font-bold text-emerald-600">${nextPrayer}</span> pukul ${nextTime}
      </div>
    `;
  }

  container.innerHTML = html;
};

// ============================================================================
// AGENDA WIDGET
// ============================================================================

/**
 * Render agenda widget
 */
window.renderAgendaWidget = function () {
  const container = document.getElementById("agenda-container");
  if (!container) return;

  const today = new Date().toISOString().split("T")[0];
  const agenda = (appState.agenda || []).filter((a) => a.date === today);

  if (agenda.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-slate-400">
        <i data-lucide="calendar" class="w-6 h-6 mx-auto mb-2 opacity-50"></i>
        <p class="text-xs">Tidak ada agenda hari ini</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  let html = `<div class="space-y-2">`;
  agenda.forEach((a) => {
    html += `
      <div class="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500">
        <div class="text-xs font-mono text-blue-600">${window.sanitizeHTML(a.time || "")}</div>
        <div class="flex-1">
          <div class="text-xs font-bold text-slate-800 dark:text-white">${window.sanitizeHTML(a.title)}</div>
        </div>
      </div>
    `;
  });
  html += `</div>`;

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
};
