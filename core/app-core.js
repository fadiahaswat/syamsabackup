// File: app-core.js

let saveTimeout = null;
let clockInterval = null;
let lucideTimeout = null;
let modalStack = [];

// ==========================================
// FIREBASE STORAGE MANAGER INSTANCE
// ==========================================
let storageManager = null;

window.addEventListener("beforeunload", () => {
  if (clockInterval) clearInterval(clockInterval);

  // Paksa simpan data secara sinkron sebelum browser ditutup
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    if (typeof appState !== "undefined" && appState.attendanceData) {
      // Simpan ke localStorage sebagai backup
      localStorage.setItem(
        APP_CONFIG.storageKey,
        JSON.stringify(appState.attendanceData),
      );
      // Jika storage manager ada, trigger sync
      if (storageManager && window.OfflineQueueManager) {
        const queue = window.OfflineQueueManager.getQueue();
        if (queue.length > 0) {
          console.log(`[beforeunload] ${queue.length} operations queued for sync`);
        }
      }
    }
  }

  if (lucideTimeout) clearTimeout(lucideTimeout);
});

// ==========================================
// CONFIG & CONSTANTS
// ==========================================
const APP_CONFIG = {
  storageKey: "musyrif_app_v5_fix",
  permitKey: "musyrif_permits_db",
  pinDefault: 1234,
  activityLogKey: "musyrif_activity_log",
  settingsKey: "musyrif_settings",
  googleAuthKey: "musyrif_google_session",
  googleClientId: window.APP_CREDENTIALS.googleClientId,
};

// ==========================================
// FIREBASE STORAGE HELPER FUNCTIONS
// ==========================================

/**
 * Initialize Firebase Storage Manager
 * Call this after user login to set the musyrifId
 */
window.initFirebaseStorage = async function(musyrifId) {
  if (!window.APP_FIREBASE?.enabled) {
    console.log('[FirebaseStorage] Firebase storage disabled in config');
    return null;
  }

  try {
    // Create new instance if not exists
    if (!storageManager) {
      storageManager = new window.FirebaseStorageManager();
    }

    // Initialize with musyrif ID
    await storageManager.init(musyrifId);

    // Make available globally
    window.storageManager = storageManager;

    console.log('[FirebaseStorage] Initialized for musyrifId:', musyrifId);

    // ========== FORCE REFRESH FROM FIREBASE (PWA Fix) ==========
    // PWA memiliki localStorage terpisah, jadi kita harus force pull dari Firebase
    // Tunda 1 detik agar Firebase SDK selesai load
    setTimeout(async () => {
      try {
        console.log('[FirebaseStorage] Force refreshing from Firebase for PWA...');
        await storageManager.refreshData();

        // Update UI setelah data di-refresh
        if (typeof window.updateDashboard === 'function') {
          window.updateDashboard();
        }
        console.log('[FirebaseStorage] Force refresh complete');
      } catch (refreshError) {
        console.warn('[FirebaseStorage] Force refresh failed:', refreshError);
      }
    }, 1000);

    return storageManager;
  } catch (error) {
    console.error('[FirebaseStorage] Initialization failed:', error);
    return null;
  }
};

/**
 * Get current storage manager instance
 */
window.getStorageManager = function() {
  return storageManager;
};

/**
 * Check if storage manager is online
 */
window.isStorageOnline = function() {
  return storageManager?.isOnline ?? navigator.onLine;
};

/**
 * Force sync pending operations
 */
window.syncPendingData = async function() {
  if (!storageManager) {
    console.warn('[FirebaseStorage] Storage manager not initialized');
    return { status: 'not_initialized' };
  }
  return await storageManager.syncPendingOperations();
};

/**
 * Get storage status info
 */
window.getStorageStatus = function() {
  if (!storageManager) {
    return { initialized: false };
  }
  return storageManager.getStatus();
};

/**
 * Manual sync - Force refresh from Firebase (PWA Fix)
 */
window.manualSync = async function() {
  console.log('[ManualSync] Starting manual sync...');

  const syncBtn = document.getElementById('pwa-sync-btn');
  if (syncBtn) {
    syncBtn.classList.add('animate-spin');
  }

  try {
    // Force refresh from Firebase
    if (storageManager) {
      await storageManager.refreshData();

      // Update UI
      if (typeof window.updateDashboard === 'function') {
        window.updateDashboard();
      }

      // Show success
      window.showToast?.('Sinkronisasi berhasil!', 'success');
    } else {
      // If no storage manager, try direct Firebase fetch
      console.log('[ManualSync] No storage manager, refreshing page...');
      window.location.reload();
    }
  } catch (error) {
    console.error('[ManualSync] Sync failed:', error);
    window.showToast?.('Sinkronisasi gagal: ' + error.message, 'error');
  } finally {
    if (syncBtn) {
      syncBtn.classList.remove('animate-spin');
    }
  }
};

/**
 * Get debug info for troubleshooting
 */
window.getDebugInfo = function() {
  const info = {
    appVersion: window.APP_VERSION || 'unknown',
    storageInitialized: !!storageManager,
    isOnline: navigator.onLine,
    storageManagerStatus: storageManager?.getStatus(),
    localStorageKeys: Object.keys(localStorage),
    lastFirebaseSync: storageManager?.lastSyncTime,
    musyrifId: storageManager?.musyrifId,
  };
  console.table(info);
  return info;
};

// ==========================================
// KONFIGURASI LOKASI (GEOFENCING)
// ==========================================

const GPS_CACHE_KEY = window.APP_LOCATION?.gpsCacheKey || "presensi_gps_cache";

const GPS_CACHE_DURATION = window.APP_LOCATION?.gpsCacheDurationMs || 15 * 60 * 1000;

const GPS_STATUS_TIMEOUT = window.APP_LOCATION?.gpsStatusTimeoutMs || 15 * 1000;

const GPS_VERIFICATION_TIMEOUT =
  window.APP_LOCATION?.gpsVerificationTimeoutMs || 20 * 1000;

const GPS_VERIFICATION_GUARD_TIMEOUT =
  window.APP_LOCATION?.gpsVerificationGuardTimeoutMs ||
  GPS_VERIFICATION_TIMEOUT + 2 * 1000;

const GEO_CONFIG = {
  useGeofencing: window.APP_LOCATION?.useGeofencing !== false,
  maxRadiusMeters: window.APP_LOCATION?.maxRadiusMeters || 50,
  locations: window.APP_LOCATION?.geofenceLocations || [],
};

// ==========================================
// UI COLOR SCHEME
// ==========================================
const UI_COLORS = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

// Toast Icons Mapping
const TOAST_ICONS = {
  success: "check-circle",
  error: "x-circle",
  warning: "alert-triangle",
  info: "info",
};

// Grade Threshold Configuration
const GRADE_THRESHOLDS = [
  { min: 97, grade: "A", predikat: "Mumtaz" },
  { min: 93, grade: "A-", predikat: "Mumtaz" },
  { min: 89, grade: "B+", predikat: "Jayyid Jiddan" },
  { min: 85, grade: "B", predikat: "Jayyid Jiddan" },
  { min: 80, grade: "B-", predikat: "Jayyid" },
  { min: 75, grade: "C+", predikat: "Jayyid" },
  { min: 70, grade: "C", predikat: "Maqbul" },
  { min: 0, grade: "D", predikat: "Maqbul" },
];

// Theme Colors for Charts
// STANDARD: cyan is #17C3D4 (brand cyan from design system)
const THEME_COLORS = {
  emerald: "#10b981",
  cyan: "#17C3D4",
  orange: "#f97316",
  indigo: "#6366f1",
  slate: "#64748b",
};

// ==========================================
// GRADE HELPERS (Extracted for reusability)
// ==========================================
function getGrade(score) {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min) return t.grade;
  }
  return "D";
}

function getPredikat(grade) {
  for (const t of GRADE_THRESHOLDS) {
    if (t.grade === grade) return t.predikat;
  }
  return "Maqbul";
}

window.sanitizeHTML = function (str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.textContent; // Return text, NOT innerHTML
};

window.getCurrentActorName = function () {
  return (
    appState.userProfile?.name ||
    appState.userProfile?.email ||
    MASTER_KELAS?.[appState.selectedClass]?.musyrif ||
    "Admin"
  );
};

window.getAttendanceSlotData = function (dateKey, slotId) {
  return appState.attendanceData?.[dateKey]?.[slotId] || null;
};

window.markAttendanceReviewConfirmed = function (dateKey, slotId) {
  const slotData = window.getAttendanceSlotData(dateKey, slotId);
  if (!slotData) return;

  slotData.__reviewConfirmed = true;
  slotData.__requiresReview = false;
  slotData.__reviewedAt = new Date().toISOString();
  slotData.__reviewedBy = window.getCurrentActorName();
  window.saveData();
  window.setAttendanceSaveIndicator("success");
  setTimeout(() => {
    const currentSlotData = window.getAttendanceSlotData(dateKey, slotId);
    if (currentSlotData?.__reviewConfirmed === true) {
      window.setAttendanceSaveIndicator("saved");
    }
  }, 900);
  window.updateDashboard();
};

window.setAttendanceSaveIndicator = function (status) {
  const indicator = document.getElementById("save-indicator");
  if (!indicator) return;

  if (indicator.dataset.attendanceReviewStatus === status) return;

  if (status === "idle") {
    delete indicator.dataset.attendanceReviewStatus;
  } else {
    indicator.dataset.attendanceReviewStatus = status;
  }

  const states = {
    notStarted: {
      title: "Belum dipresensi",
      className:
        "flex items-center justify-center p-2 rounded-lg bg-red-500 border-0 shrink-0 text-white shadow-lg shadow-red-950/20 transition-all transition-duration-standard",
      icon: "save",
    },
    pending: {
      title: "Proses presensi, scroll sampai bawah",
      className:
        "flex items-center justify-center p-2 rounded-lg bg-amber-400 border-0 shrink-0 text-white shadow-lg shadow-amber-950/20 transition-all transition-duration-standard",
      icon: "loader-circle",
      spin: true,
    },
    success: {
      title: "Presensi selesai dicek",
      className:
        "flex items-center justify-center p-2 rounded-lg bg-emerald-500 border-0 shrink-0 text-white shadow-lg shadow-emerald-950/20 transition-all transition-duration-standard scale-success-pop",
      icon: "check",
    },
    saved: {
      title: "Presensi tersimpan",
      className:
        "flex items-center justify-center p-2 rounded-lg bg-emerald-500 border-0 shrink-0 text-white shadow-lg shadow-emerald-950/20 transition-all transition-duration-standard",
      icon: "save",
    },
    idle: {
      title: "Status Autosave",
      className:
        "flex items-center justify-center p-2 rounded-lg bg-white/5 border border-white/5 shrink-0 text-slate-400",
      icon: "save",
    },
  };

  const state = states[status] || states.idle;
  indicator.className = state.className;
  indicator.title = state.title;
  indicator.setAttribute("aria-label", state.title);
  indicator.innerHTML = `<i data-lucide="${state.icon}" class="w-3.5 h-3.5${state.spin ? " animate-spin" : ""}"></i>`;

  if (window.refreshIcons) window.refreshIcons();
};

window.renderAttendanceReviewGate = function (
  scrollContainer,
  dateKey,
  slotId,
  needsReview,
) {
  if (scrollContainer && scrollContainer._attendanceReviewScrollHandler) {
    scrollContainer.removeEventListener(
      "scroll",
      scrollContainer._attendanceReviewScrollHandler,
    );
    delete scrollContainer._attendanceReviewScrollHandler;
  }

  const slotData = window.getAttendanceSlotData(dateKey, slotId);
  const confirmed = slotData?.__reviewConfirmed === true;

  if (needsReview && !confirmed) {
    window.setAttendanceSaveIndicator("notStarted");

    if (scrollContainer) {
      const confirmWhenAtBottom = () => {
        if (scrollContainer.scrollTop > 12) {
          window.setAttendanceSaveIndicator("pending");
        }
        const atBottom =
          scrollContainer.scrollTop + scrollContainer.clientHeight >=
          scrollContainer.scrollHeight - 24;
        if (atBottom) {
          scrollContainer.removeEventListener("scroll", confirmWhenAtBottom);
          delete scrollContainer._attendanceReviewScrollHandler;
          window.markAttendanceReviewConfirmed(dateKey, slotId);
        }
      };
      scrollContainer._attendanceReviewScrollHandler = confirmWhenAtBottom;
      scrollContainer.addEventListener("scroll", confirmWhenAtBottom, {
        passive: true,
      });
    }
  } else {
    window.setAttendanceSaveIndicator("saved");
  }
};

window.clearAttendanceReviewGate = function () {
  const container = document.getElementById("attendance-list-container");
  if (container && container._attendanceReviewScrollHandler) {
    container.removeEventListener(
      "scroll",
      container._attendanceReviewScrollHandler,
    );
    delete container._attendanceReviewScrollHandler;
  }
  const indicator = document.getElementById("save-indicator");
  if (indicator) {
    delete indicator.dataset.attendanceReviewStatus;
    window.setAttendanceSaveIndicator("idle");
  }
};

window.isAttendanceSlotFinalForReport = function (slotData) {
  if (!slotData) return false;
  return slotData.__reviewConfirmed === true || slotData.__requiresReview !== true;
};

window.getDailyReportStatusMeta = function (
  dateKey,
  slotId,
  studentId,
  activityId,
) {
  if (window.isSlotHoliday && window.isSlotHoliday(slotId, dateKey)) {
    return {
      status: "Libur",
      label: "L",
      className: "bg-slate-200 text-slate-500",
      aria: `${slotId}: Libur`,
    };
  }

  const slotData = appState.attendanceData?.[dateKey]?.[slotId];
  if (slotData?.__requiresReview === true && slotData.__reviewConfirmed !== true) {
    return {
      status: "Proses",
      label: "P",
      className: "bg-amber-100 text-amber-600",
      aria: `${slotId}: Proses presensi`,
    };
  }

  if (!window.isAttendanceSlotFinalForReport(slotData)) {
    return {
      status: null,
      label: "-",
      className: "bg-slate-100 text-slate-300",
      aria: `${slotId}: Belum diisi`,
    };
  }

  const st = slotData?.[String(studentId)]?.status?.[activityId];
  const meta = window.getStatusMeta?.(st) || STATUS_META.Tidak;
  return {
    status: st || null,
    label: meta.label || "-",
    className: meta.className || meta.pill,
    aria: `${slotId}: ${st || "Belum diisi"}`,
  };
};

window.STATUS_SCORE = {
  Hadir: 100,
  Telat: 80,
  Izin: 75,
  Sakit: 75,
  Pulang: 0,
  Alpa: -50,
  Ya: 100,
  Tidak: 0,
};

window.getStatusScore = function (status) {
  return window.STATUS_SCORE[status] ?? null;
};

window.isReportCategoryActiveOnDate = function (dateKey, category) {
  if (!dateKey || !category) return false;
  const selectedDate = new Date(`${dateKey}T00:00:00`);
  const dayNum = selectedDate.getDay();

  return Object.values(SLOT_WAKTU).some((slot) => {
    if (window.isSlotHoliday && window.isSlotHoliday(slot.id, dateKey)) return false;

    return slot.activities.some((act) => {
      if (act.category !== category) return false;
      if (act.showOnDays && !act.showOnDays.includes(dayNum)) return false;
      if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return false;
      if (window.isActivityHoliday && window.isActivityHoliday(dateKey, slot.id, act.id)) return false;
      if (window.isCategoryHoliday && window.isCategoryHoliday(dateKey, act.category)) return false;
      return true;
    });
  });
};

window.calculateReportScoreForStudentRange = function (studentId, range) {
  if (!studentId || !range?.start || !range?.end) {
    return { score: null, total: 0 };
  }

  const categoryStats = {
    shalat: { score: 0, total: 0 },
    sekolah: { score: 0, total: 0 },
    mahad: { score: 0, total: 0 },
    sunnah: { score: 0, total: 0 },
  };
  const startTime = range.start.getTime();
  const endTime = range.end.getTime();
  const dayInMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.min(Math.ceil((endTime - startTime) / dayInMs) + 1, 370);

  for (let i = 0; i < totalDays; i++) {
    const currentDate = new Date(startTime + i * dayInMs);
    const dateKey = window.getLocalDateStr(currentDate);
    const dayNum = currentDate.getDay();
    const dayData = appState.attendanceData?.[dateKey];
    if (!dayData) continue;

    Object.values(SLOT_WAKTU).forEach((slot) => {
      if (window.isSlotHoliday(slot.id, dateKey)) return;
      const slotData = dayData[slot.id];
      if (!window.isAttendanceSlotFinalForReport(slotData)) return;

      const studentData = slotData?.[String(studentId)];
      if (!studentData) return;

      slot.activities.forEach((act) => {
        if (act.showOnDays && !act.showOnDays.includes(dayNum)) return;
        if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return;
        if (window.isActivityHoliday(dateKey, slot.id, act.id)) return;
        if (window.isCategoryHoliday(dateKey, act.category)) return;

        const score = window.getStatusScore(studentData.status?.[act.id]);
        if (score === null) return;

        const bucket =
          act.category === "fardu" ? categoryStats.shalat :
          act.category === "school" ? categoryStats.sekolah :
          act.category === "kbm" ? categoryStats.mahad :
          act.category === "sunnah" ? categoryStats.sunnah :
          null;
        if (!bucket) return;

        bucket.score += score;
        bucket.total++;
      });
    });
  }

  const scores = Object.values(categoryStats)
    .filter((item) => item.total > 0)
    .map((item) => item.score / item.total);

  return {
    score: scores.length
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : null,
    total: Object.values(categoryStats).reduce((sum, item) => sum + item.total, 0),
  };
};

window.getCurrentDashboardSlotId = function (dateKey = appState.date) {
  const current = window.determineCurrentSlot
    ? window.determineCurrentSlot()
    : appState.currentSlotId;
  if (!window.isSlotHoliday(current, dateKey)) return current;

  const order = ["shubuh", "sekolah", "ashar", "maghrib", "isya"];
  const currentIndex = Math.max(0, order.indexOf(current));
  const fallbackOrder = [
    ...order.slice(currentIndex + 1),
    ...order.slice(0, currentIndex).reverse(),
  ];

  return (
    fallbackOrder.find((slotId) => !window.isSlotHoliday(slotId, dateKey)) ||
    current
  );
};

window.refreshIcons = function () {
  clearTimeout(lucideTimeout);
  lucideTimeout = setTimeout(() => {
    if (window.lucide) {
      try {
        window.lucide.createIcons();
      } catch (e) {
        console.warn("Lucide render error:", e);
      }
    }
  }, 150);
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

window.parseJwt = function (token) {
  var base64Url = token.split(".")[1];
  var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  var jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );
  return JSON.parse(jsonPayload);
};

// Helper Tanggal yang Aman (Local Time YYYY-MM-DD)
window.getLocalDateStr = function (dateObj = new Date()) {
  try {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error("Date conversion error:", e);
    return new Date().toISOString().split("T")[0];
  }
};

window.getDashboardDateBadgeLabel = function (dateStr = appState.date) {
  const parseLocalDate = (value) => {
    const [year, month, day] = String(value || "").split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const selectedDate = parseLocalDate(dateStr);
  if (!selectedDate) return "Lampau";

  const today = parseLocalDate(window.getLocalDateStr());
  const diffDays = Math.round((today - selectedDate) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Hari ini";
  if (diffDays === 1) return "Kemarin";
  if (diffDays === 2) return "Kemarin Lusa";
  return "Lampau";
};

// ==========================================
// SHARED CONSTANTS - DAYS and MONTHS (extracted to avoid duplication)
// ==========================================
const DAYS_ID = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
const MONTHS_FULL_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Export to global
window.DAYS_ID = DAYS_ID;
window.MONTHS_ID = MONTHS_SHORT_ID;
window.MONTHS_FULL_ID = MONTHS_FULL_ID;

// Format tanggal ke "Senin, 1 Jan 2025"
window.formatDate = function (dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`;
};

// Cek apakah tanggal Masehi (YYYY-MM-DD) jatuh di bulan Ramadhan (Hijriyah ke-9)
window.isRamadhan = function (dateStr) {
  try {
    const d = new Date(dateStr + "T12:00:00");
    // Gunakan Intl.DateTimeFormat untuk mendapatkan bulan Hijriyah
    const hijriMonth = new Intl.DateTimeFormat("id-ID-u-ca-islamic", {
      month: "numeric",
    }).format(d);
    return Number(hijriMonth) === 9;
  } catch (e) {
    return false;
  }
};

// Polyfill Canvas roundRect
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x,
    y,
    width,
    height,
    radii,
  ) {
    const radius = Array.isArray(radii) ? radii[0] : radii;
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
    return this;
  };
}

// ==========================================
// STATE MANAGEMENT
// ==========================================
let appState = {
  selectedClass: null,
  currentSlotId: "shubuh",
  activeAttendanceSlotId: null, // slot yang sedang aktif di view attendance — tidak ditimpa clock
  attendanceData: {},
  permits: [],
  holidays: [],
  searchQuery: "",
  analysisMode: "daily", // daily, weekly, monthly, semester
  reportMode: "daily", // daily, weekly, monthly, semester, yearly <-- BARU
  analysisSantriId: null,
  filterProblemOnly: false,
  waliMode: false,
  waliSantri: null,
  waliKelas: null,
  date: window.getLocalDateStr(),
  reportDate: window.getLocalDateStr(),
  analysisDate: window.getLocalDateStr(),
  timesheetViewDate: window.getLocalDateStr(),
  activityLog: [],
  settings: {
    darkMode: false,
    notifications: true,
    autoSave: true,
    notificationTypes: {}, // Diinisialisasi untuk menyimpan preferensi notifikasi per jenis
  },
};

if (!appState.holidays || appState.holidays.length === 0) {
  appState.holidays = [
    {
      id: "holiday1",
      title: "Tahsin Libur",
      type: "activity",
      date: "2026-06-09",
      activityId: "vocabularies",
    },
  ];
}

// DATA STORE
let MASTER_SANTRI = [];
let MASTER_KELAS = {};
let FILTERED_SANTRI = [];

// ==========================================
// SLOT & STATUS CONFIGURATION (UPDATED)
// ==========================================
const SLOT_WAKTU = {
  shubuh: {
    id: "shubuh",
    label: "Shubuh",
    subLabel: "04:00 - 06:00",
    theme: "emerald",
    startHour: 4,
    style: {
      icon: "sunrise",
      progressBg: "bg-emerald-500", // <-- TAMBAHKAN INI
      gradient:
        "from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-900/20",
      border: "hover:border-emerald-300 dark:hover:border-emerald-700",
      text: "text-emerald-700 dark:text-emerald-300",
      iconBg:
        "bg-emerald-100 text-emerald-600 dark:bg-emerald-800 dark:text-emerald-200",
    },
    activities: [
      { id: "shalat", label: "Shubuh", type: "mandator", category: "fardu" },
      {
        id: "qabliyah",
        label: "Qabliyah",
        type: "sunnah",
        category: "dependent",
      },
      {
        id: "dzikir_pagi",
        label: "Dzikir",
        type: "sunnah",
        category: "dependent",
      },

      // PERBAIKAN 1: Tahfizh hanya muncul Senin (1) s/d Sabtu (6). Ahad (0) libur.
      {
        id: "tahfizh",
        label: "Tahfizh",
        type: "mandator",
        category: "kbm",
        showOnDays: [1, 2, 3, 4, 5, 6],
      },

      { id: "tahajjud", label: "Tahajjud", type: "sunnah", category: "sunnah" },
      // Ahad pagi diganti Conversation (sudah benar sesuai kode awal)
      {
        id: "conversation",
        label: "Conver",
        type: "mandator",
        category: "kbm",
        showOnDays: [0],
      },
    ],
  },

  // --- SESI BARU: SEKOLAH ---
  sekolah: {
    id: "sekolah",
    label: "Sekolah",
    subLabel: "06:00 - 15:00",
    theme: "cyan",
    startHour: 6,
    style: {
      icon: "graduation-cap",
      progressBg: "bg-cyan-500", // <-- TAMBAHKAN INI
      gradient:
        "from-cyan-50 to-blue-100 dark:from-cyan-900/40 dark:to-blue-900/20",
      border: "hover:border-cyan-300 dark:hover:border-cyan-700",
      text: "text-cyan-700 dark:text-cyan-300",
      iconBg: "bg-cyan-100 text-cyan-600 dark:bg-cyan-800 dark:text-cyan-200",
    },
    activities: [
      // PERBAIKAN 2: Sekolah hanya muncul Senin (1) s/d Sabtu (6). Ahad (0) libur.
      {
        id: "kbm_sekolah",
        label: "KBM Sekolah",
        type: "mandator",
        category: "school",
        showOnDays: [1, 2, 3, 4, 5, 6],
      },
    ],
  },
  ashar: {
    id: "ashar",
    label: "Ashar",
    subLabel: "15:00 - 17:00",
    theme: "orange",
    startHour: 15,
    style: {
      icon: "sun",
      progressBg: "bg-orange-500", // <-- TAMBAHKAN INI
      gradient:
        "from-orange-50 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/20",
      border: "hover:border-orange-300 dark:hover:border-orange-700",
      text: "text-orange-700 dark:text-orange-300",
      iconBg:
        "bg-orange-100 text-orange-600 dark:bg-orange-800 dark:text-orange-200",
    },
    activities: [
      { id: "shalat", label: "Ashar", type: "mandator", category: "fardu" },
      {
        id: "dzikir_petang",
        label: "Dzikir",
        type: "sunnah",
        category: "dependent",
      },
    ],
  },
  maghrib: {
    id: "maghrib",
    label: "Maghrib",
    subLabel: "18:00 - 19:00",
    theme: "indigo",
    startHour: 18,
    style: {
      icon: "sunset",
      progressBg: "bg-indigo-500", // <-- TAMBAHKAN INI
      gradient:
        "from-indigo-50 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/20",
      border: "hover:border-indigo-300 dark:hover:border-indigo-700",
      text: "text-indigo-700 dark:text-indigo-300",
      iconBg:
        "bg-indigo-100 text-indigo-600 dark:bg-indigo-800 dark:text-indigo-200",
    },
    activities: [
      { id: "shalat", label: "Maghrib", type: "mandator", category: "fardu" },
      {
        id: "bakdiyah",
        label: "Ba'diyah",
        type: "sunnah",
        category: "dependent",
      },
      { id: "dhuha", label: "Dhuha", type: "sunnah", category: "sunnah" },
      { id: "puasa", label: "Puasa", type: "sunnah", category: "sunnah" },
      {
        id: "puasa_ramadhan",
        label: "P.Rmdn",
        type: "mandator",
        category: "fardu",
        onlyRamadhan: true,
      },
      {
        id: "tahsin",
        label: "Tahsin",
        type: "mandator",
        category: "kbm",
        showOnDays: [4, 5],
      },
      {
        id: "conversation",
        label: "Conver",
        type: "mandator",
        category: "kbm",
        showOnDays: [3],
      },
      {
        id: "vocabularies",
        label: "Vocab",
        type: "mandator",
        category: "kbm",
        showOnDays: [1, 2],
      },
    ],
  },
  isya: {
    id: "isya",
    label: "Isya",
    subLabel: "19:00 - 21:00",
    theme: "slate",
    startHour: 19,
    style: {
      icon: "moon",
      progressBg: "bg-slate-500", // <-- TAMBAHKAN INI
      gradient:
        "from-slate-50 to-blue-100 dark:from-slate-800 dark:to-blue-900/40",
      border: "hover:border-blue-300 dark:hover:border-blue-700",
      text: "text-slate-700 dark:text-slate-300",
      iconBg:
        "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
    },
    activities: [
      { id: "shalat", label: "Isya", type: "mandator", category: "fardu" },
      {
        id: "bakdiyah",
        label: "Ba'diyah",
        type: "sunnah",
        category: "dependent",
      },
      {
        id: "alkahfi",
        label: "Al-Kahfi",
        type: "sunnah",
        category: "sunnah",
        showOnDays: [4],
      },
      {
        id: "tarawih",
        label: "Tarawih",
        type: "sunnah",
        category: "sunnah",
        onlyRamadhan: true,
      },
    ],
  },
};

const STATUS_UI = {
  Hadir: {
    class: "bg-emerald-500 text-white border-emerald-500",
    label: "H",
    icon: "check",
  },
  Ya: {
    class: "bg-emerald-500 text-white border-emerald-500",
    label: "Y",
    icon: "check",
  },
  Telat: {
    class:
      "bg-cyan-100 text-cyan-600 border-cyan-500 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800",
    label: "T",
    icon: "clock-alert",
  },
  Izin: {
    class:
      "bg-blue-100 text-blue-600 border-blue-500 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    label: "I",
    icon: "file-text",
  },
  Sakit: {
    class:
      "bg-amber-100 text-amber-600 border-amber-500 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    label: "S",
    icon: "thermometer",
  },
  Alpa: {
    class:
      "bg-red-100 text-red-600 border-red-500 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
    label: "A",
    icon: "alert-triangle",
  },
  Pulang: {
    class:
      "bg-purple-100 text-purple-600 border-purple-500 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800",
    label: "P",
    icon: "home",
  },
  Tidak: {
    class:
      "bg-slate-100 text-slate-400 border-slate-400 dark:bg-slate-700 dark:text-slate-500 dark:border-slate-500",
    label: "-",
    icon: "minus",
  },
};

const STATUS_META = {
  Hadir: {
    label: "H",
    icon: "check",
    text: "text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
    solid: "bg-emerald-500 text-white",
    ring: "ring-emerald-500",
    hex: "#10B981",
  },
  Ya: {
    label: "Y",
    icon: "check",
    text: "text-emerald-600 dark:text-emerald-400",
    pill: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
    className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
    solid: "bg-emerald-500 text-white",
    ring: "ring-emerald-500",
    hex: "#10B981",
  },
  Sakit: {
    label: "S",
    icon: "thermometer",
    text: "text-amber-600 dark:text-amber-400",
    pill: "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-300",
    className: "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
    solid: "bg-amber-500 text-white",
    ring: "ring-amber-500",
    hex: "#F59E0B",
  },
  Alpa: {
    label: "A",
    icon: "alert-triangle",
    text: "text-red-600 dark:text-red-400",
    pill: "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-300",
    className: "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400",
    solid: "bg-red-500 text-white",
    ring: "ring-red-500",
    hex: "#EF4444",
  },
  Izin: {
    label: "I",
    icon: "file-text",
    text: "text-blue-600 dark:text-blue-400",
    pill: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-300",
    className: "bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
    solid: "bg-blue-500 text-white",
    ring: "ring-blue-500",
    hex: "#3B82F6",
  },
  Pulang: {
    label: "P",
    icon: "home",
    text: "text-purple-600 dark:text-purple-400",
    pill: "bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20 text-purple-700 dark:text-purple-300",
    className: "bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400",
    solid: "bg-purple-500 text-white",
    ring: "ring-purple-500",
    hex: "#A855F7",
  },
  Telat: {
    label: "T",
    icon: "clock-alert",
    text: "text-cyan-600 dark:text-cyan-400",
    pill: "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-100 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-300",
    className: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-400",
    solid: "bg-cyan-500 text-white",
    ring: "ring-cyan-500",
    hex: "#17C3D4",
  },
  Tidak: {
    label: "-",
    icon: "minus",
    text: "text-slate-500 dark:text-slate-400",
    pill: "bg-slate-50 dark:bg-slate-700/40 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-300",
    className: "bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-400",
    solid: "bg-slate-400 text-white",
    ring: "ring-slate-400",
    hex: "#64748B",
  },
};

window.getStatusMeta = function (status) {
  return STATUS_META[status] || STATUS_META.Tidak;
};

// Tambahkan 'kemarin': 0 agar logika matematika berjalan
const SESSION_ORDER = {
  kemarin: 0,
  shubuh: 1,
  sekolah: 2,
  ashar: 3,
  maghrib: 4,
  isya: 5,
};

// ==========================================
// KONFIGURASI PEMBINAAN (Disciplinary Rules)
// ==========================================
const PEMBINAAN_RULES = [
  {
    min: 1,
    max: 10,
    level: 1,
    label: "Bimbingan Musyrif",
    action: "Lembar Pembinaan",
    color: "text-yellow-600 bg-yellow-100 border-yellow-200",
  },
  {
    min: 11,
    max: 20,
    level: 2,
    label: "SP1 - Pamong",
    action: "Surat Pernyataan I",
    color: "text-orange-600 bg-orange-100 border-orange-200",
  },
  {
    min: 21,
    max: 30,
    level: 3,
    label: "SP2 - SU. KIS",
    action: "Panggil Ortu & SP II",
    color: "text-orange-700 bg-orange-200 border-orange-300",
  },
  {
    min: 31,
    max: 40,
    level: 4,
    label: "SP3 - Wadir IV",
    action: "Panggil Ortu & SP III",
    color: "text-red-600 bg-red-100 border-red-200",
  },
  {
    min: 41,
    max: 999,
    level: 5,
    label: "Direktur - SPT",
    action: "Surat Pernyataan Terakhir/Keluar",
    color: "text-white bg-red-600 border-red-700",
  },
];

// Helper: Hitung Total Alpa Santri
window.countTotalAlpa = function (studentId) {
  let total = 0;
  // Loop semua tanggal yang ada di data
  Object.keys(appState.attendanceData).forEach((date) => {
    const dayData = appState.attendanceData[date];
    // Loop semua slot (shubuh, ashar, etc)
    Object.values(SLOT_WAKTU).forEach((slot) => {
      const status = dayData[slot.id]?.[studentId]?.status?.shalat;
      if (status === "Alpa") total++;
    });
  });
  return total;
};

// Helper: Tentukan Status Pembinaan
window.getPembinaanStatus = function (alpaCount) {
  if (alpaCount === 0) return null;
  return (
    PEMBINAAN_RULES.find((r) => alpaCount >= r.min && alpaCount <= r.max) ||
    PEMBINAAN_RULES[PEMBINAAN_RULES.length - 1]
  );
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
