// File: app-core.js

let saveTimeout = null;
let clockInterval = null;
let lucideTimeout = null;
let modalStack = [];

if (!window.AppStorage) {
  window.AppStorage = {
    setJson(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ==========================================
// STORAGE MANAGER INSTANCE (LocalStorage-based)
// ==========================================

window.addEventListener("beforeunload", () => {
  if (clockInterval) clearInterval(clockInterval);

  // Paksa simpan data secara sinkron sebelum browser ditutup
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    if (typeof appState !== "undefined" && appState.attendanceData) {
      // Simpan ke localStorage sebagai backup
      window.AppStorage.setJson(APP_CONFIG.storageKey, appState.attendanceData);
      // Force save if storage manager exists
      if (window.storageManager) {
        window.storageManager.saveNow();
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
  violationsKey: "musyrif_violations_db",
  studentTargetsKey: "musyrif_student_targets",
};

// ==========================================
// SECURITY HELPER FUNCTIONS (XSS Prevention)
// ==========================================

// CRITICAL FIX: Escape HTML entities untuk mencegah XSS
// Gunakan ini untuk semua user-provided values yang di-render ke HTML
window.escapeHtml = function(str) {
  if (window.SharedUtils?.escapeHtml) return window.SharedUtils.escapeHtml(str);
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
};

// Escape untuk attribute values (double quotes context)
window.escapeAttr = function(str) {
  if (window.SharedUtils?.escapeAttr) return window.SharedUtils.escapeAttr(str);
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

// Escape untuk inline event handlers (paling aman: gunakan data-attribute pattern)
window.escapeForEventHandler = function(str) {
  if (window.SharedUtils?.escapeForEventHandler) {
    return window.SharedUtils.escapeForEventHandler(str);
  }
  if (str === null || str === undefined) return "";
  return String(str).replace(/`/g, "&#96;").replace(/\$/g, "&#36;");
};

// CRITICAL FIX: Safe JSON parse - prevents crash on malformed data
window.safeJsonParse = function(str, fallback = null) {
  if (window.SharedUtils?.safeJsonParse) {
    return window.SharedUtils.safeJsonParse(str, fallback);
  }
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn("[SafeJsonParse] Invalid JSON, using fallback:", e.message);
    return fallback;
  }
};

// ==========================================
// STORAGE HELPER FUNCTIONS (LocalStorage)
// ==========================================

const appCoreDebugLog = (...args) => {
  if (localStorage.getItem("DEBUG_LOGS") === "true" || location.search.includes("debug=true")) {
    console.log(...args);
  }
};

/**
 * Initialize Storage Manager
 * Call this after user login to set the musyrifId
 */
window.initStorage = function(musyrifId) {
  appCoreDebugLog('[Storage] Initializing with musyrifId:', musyrifId);

  try {
    // Use the global storage manager instance
    const sm = window.storageManager;

    // Force musyrifId to be class-based if appState.selectedClass is available
    let finalMusyrifId = musyrifId;
    if (typeof appState !== 'undefined' && appState.selectedClass) {
      finalMusyrifId = `class_${appState.selectedClass}`;
    } else if (musyrifId && !musyrifId.startsWith('class_') && musyrifId !== 'anonymous') {
      // Look up class by email from window.classData if available
      if (typeof window.classData === 'object' && appState?.userProfile?.email) {
        const foundClass = Object.keys(window.classData).find(
          c => window.classData[c]?.email === appState.userProfile.email
        );
        if (foundClass) {
          finalMusyrifId = `class_${foundClass}`;
        }
      }
    }

    // Ensure finalMusyrifId is not empty and defaults properly
    if (!finalMusyrifId || finalMusyrifId === 'anonymous') {
      if (typeof appState !== 'undefined' && appState.waliMode && appState.waliKelas) {
        finalMusyrifId = `class_${appState.waliKelas}`;
      }
    }

    // Initialize with musyrif ID
    sm.init(finalMusyrifId);

    appCoreDebugLog('[Storage] Initialized for musyrifId:', finalMusyrifId);

    return sm;
  } catch (error) {
    console.error('[Storage] Initialization failed:', error);
    return null;
  }
};

/**
 * Get current storage manager instance
 */
window.getStorageManager = function() {
  return window.storageManager;
};

/**
 * Check if storage manager is online
 */
window.isStorageOnline = function() {
  return window.storageManager?.isOnline ?? navigator.onLine;
};

/**
 * Force save all data
 */
window.saveAllData = function() {
  if (window.storageManager) {
    window.storageManager.saveNow();
    console.log('[Storage] All data saved');
  }
};

/**
 * Get storage status info
 */
window.getStorageStatus = function() {
  if (!window.storageManager) {
    return { initialized: false };
  }
  return window.storageManager.getStatus();
};

/**
 * Manual sync - Reload data from localStorage
 */
window.manualSync = async function() {
  console.log('[ManualSync] Refreshing data from localStorage...');

  const syncBtn = document.getElementById('pwa-sync-btn');
  if (syncBtn) {
    syncBtn.classList.add('animate-spin');
  }

  try {
    // Reload data from localStorage
    if (window.storageManager) {
      window.storageManager._loadFromStorage();

      // Update UI
      if (typeof window.updateDashboard === 'function') {
        window.updateDashboard();
      }

      window.showToast?.('Data diperbarui!', 'success');
    } else {
      window.location.reload();
    }
  } catch (error) {
    console.error('[ManualSync] Refresh failed:', error);
    window.showToast?.('Gagal memperbarui data', 'error');
  } finally {
    if (syncBtn) {
      syncBtn.classList.remove('animate-spin');
    }
  }
};

// Keep old function for backward compatibility
window.syncPendingData = window.saveAllData;

/**
 * Get debug info for troubleshooting
 */
window.getDebugInfo = function() {
  const sm = window.storageManager;
  const usage = sm?.getStorageUsage?.() || null;

  const info = {
    appVersion: window.APP_VERSION || 'unknown',
    storageInitialized: !!sm,
    isOnline: navigator.onLine,
    storageUsage: usage,
    musyrifId: sm?.musyrifId,
    storageAvailable: sm?.isStorageAvailable?.() ?? true,
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

try {
  const localGpsConfig = localStorage.getItem("syamsa_gps_config");
  if (localGpsConfig) {
    const parsedGpsConfig = JSON.parse(localGpsConfig);
    if (parsedGpsConfig.useGeofencing !== undefined) {
      GEO_CONFIG.useGeofencing = parsedGpsConfig.useGeofencing === true || parsedGpsConfig.useGeofencing === "true";
    }
    if (parsedGpsConfig.maxRadiusMeters !== undefined) {
      GEO_CONFIG.maxRadiusMeters = Number(parsedGpsConfig.maxRadiusMeters) || 50;
    }
    if (Array.isArray(parsedGpsConfig.locations)) {
      GEO_CONFIG.locations = parsedGpsConfig.locations;
    }
  }
} catch (e) {
  console.warn("[AppCore] Failed to load local GPS override:", e);
}

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
  if (window.SharedUtils?.sanitizeHTML) return window.SharedUtils.sanitizeHTML(str);
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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
  const existingBanner = document.getElementById("attendance-review-banner");
  if (existingBanner) existingBanner.remove();

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
      const banner = document.createElement("div");
      banner.id = "attendance-review-banner";
      banner.className =
        "sticky top-0 z-20 mb-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 shadow-sm backdrop-blur-xl";
      banner.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 min-w-0">
            <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <i data-lucide="clipboard-check" class="h-4 w-4" aria-hidden="true"></i>
            </div>
            <div class="min-w-0">
              <p class="text-xs font-black text-amber-900 dark:text-amber-100">Default hadir belum dikonfirmasi</p>
              <p class="mt-0.5 text-[11px] font-semibold leading-relaxed text-amber-700 dark:text-amber-200">Periksa santri yang sakit, izin, pulang, telat, atau alpa. Setelah sesuai, tekan tombol konfirmasi.</p>
            </div>
          </div>
          <button type="button" onclick="window.markAttendanceReviewConfirmed('${dateKey}', '${slotId}'); document.getElementById('attendance-review-banner')?.remove();" class="shrink-0 rounded-xl bg-amber-600 px-3 py-2 text-[10px] font-black text-white shadow-sm active:scale-95">
            Sudah dicek
          </button>
        </div>
      `;
      scrollContainer.prepend(banner);
      if (window.refreshIcons) window.refreshIcons();

      const confirmWhenAtBottom = () => {
        if (scrollContainer.scrollTop > 12) {
          window.setAttendanceSaveIndicator("pending");
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
  document.getElementById("attendance-review-banner")?.remove();

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
  if (current === "sekolah") return current;
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
  if (window.SharedUtils?.getLocalDateStr) {
    return window.SharedUtils.getLocalDateStr(dateObj);
  }
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
  if (window.SharedUtils?.formatDate) return window.SharedUtils.formatDate(dateStr);
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

// CRITICAL FIX: Version counter untuk optimistic locking
// Setiap write ke appState harus increment version ini
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
  adminMode: false,
  date: window.getLocalDateStr(),
  reportDate: window.getLocalDateStr(),
  analysisDate: window.getLocalDateStr(),
  timesheetViewDate: window.getLocalDateStr(),
  activityLog: [],
  violations: JSON.parse(localStorage.getItem("musyrif_violations_db") || "[]"),
  studentTargets: JSON.parse(localStorage.getItem("musyrif_student_targets") || "{}"),
  settings: {
    darkMode: false,
    notifications: true,
    autoSave: true,
    notificationTypes: {}, // Diinisialisasi untuk menyimpan preferensi notifikasi per jenis
  },
  _version: 0, // CRITICAL: Version counter untuk race condition prevention
};

// Helper untuk increment version saat state berubah
window.incrementStateVersion = function() {
  appState._version++;
  console.log(`[State] Version incremented to ${appState._version}`);
  return appState._version;
};

// CENTRALIZED STATE MUTATION - Always use this for state changes
// This ensures version tracking and triggers auto-save
window.mutateState = function(partial, { autoSave = true, silent = false } = {}) {
  const changedKeys = [];

  for (const [key, value] of Object.entries(partial)) {
    if (appState[key] !== value) {
      appState[key] = value;
      changedKeys.push(key);
    }
  }

  if (changedKeys.length > 0) {
    // Always increment version on any state change
    window.incrementStateVersion();

    // Notify listeners if StateStore is available
    if (window.StateStore?.listeners) {
      window.StateStore._notify(changedKeys);
    }

    // Trigger auto-save
    if (autoSave && window.saveData) {
      window.saveData();
    }

    if (!silent) {
      console.log(`[State] Mutated: ${changedKeys.join(', ')}`);
    }
  }

  return changedKeys;
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

// HIGH FIX: Student Index untuk O(1) lookup
// Mencegah O(n) linear search setiap kali akses student by NIS
let STUDENT_INDEX = new Map(); // key: NIS/ID string, value: student object

// Build/update student index dari array
window.buildStudentIndex = function(students) {
  STUDENT_INDEX.clear();
  students.forEach(s => {
    const key = String(s.nis || s.id || '');
    if (key) {
      STUDENT_INDEX.set(key, s);
    }
  });
  console.log(`[StudentIndex] Built index with ${STUDENT_INDEX.size} students`);
  return STUDENT_INDEX;
};

// Get student by NIS dengan O(1) lookup
window.getStudentByNis = function(nis) {
  if (!nis) return null;
  return STUDENT_INDEX.get(String(nis)) || null;
};

// Add/update single student in index
window.indexStudent = function(student) {
  const key = String(student.nis || student.id || '');
  if (key) {
    STUDENT_INDEX.set(key, student);
  }
};

// Remove student from index
window.removeStudentFromIndex = function(nis) {
  if (nis) {
    STUDENT_INDEX.delete(String(nis));
  }
};

// Rebuild FILTERED_SANTRI and update index
window.updateFilteredSantri = function(students, classFilter) {
  MASTER_SANTRI = students || [];
  FILTERED_SANTRI = classFilter
    ? MASTER_SANTRI.filter(s => s.kelas === classFilter)
    : [...MASTER_SANTRI];
  // Update index
  window.buildStudentIndex(FILTERED_SANTRI);
  return FILTERED_SANTRI;
};

// HIGH FIX: Error Boundary & Global Error Handler
// Standardisasi error handling untuk seluruh aplikasi

// Error levels untuk categorizing
const ERROR_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
  CRITICAL: 4
};

// Global error handler
window.handleError = function(error, context = 'Unknown', level = 'ERROR') {
  const errorObj = {
    message: error?.message || String(error),
    stack: error?.stack || '',
    context,
    level,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
  };

  // Log based on level
  switch (level) {
    case 'CRITICAL':
    case 'ERROR':
      console.error(`[${level}] ${context}:`, errorObj.message, errorObj);
      break;
    case 'WARNING':
      console.warn(`[${level}] ${context}:`, errorObj.message);
      break;
    default:
      console.log(`[${level}] ${context}:`, errorObj.message);
  }

  return errorObj;
};

// Wrapper untuk async functions dengan error handling
window.withErrorHandler = function(asyncFn, context = 'AsyncFunction', fallback = null) {
  return async function(...args) {
    try {
      return await asyncFn.apply(this, args);
    } catch (error) {
      window.handleError(error, context);
      return fallback;
    }
  };
};

// Wrapper untuk promise dengan timeout
window.promiseWithTimeout = function(promise, timeoutMs = 5000, timeoutMsg = 'Operation timed out') {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
};

// Safe function caller - catches all errors
window.safeCall = function(fn, fallback = null, context = 'SafeCall') {
  try {
    return fn();
  } catch (error) {
    window.handleError(error, context, 'WARNING');
    return fallback;
  }
};

// ==========================================
// MEDIUM FIX #9: LOADING STATES (Skeleton Loaders)
// ==========================================

/**
 * Show skeleton loader in a container element
 * @param {string|HTMLElement} container - Container element or selector
 * @param {string} type - Type of skeleton: 'table', 'card', 'list', 'text'
 * @param {number} rows - Number of skeleton rows for list/table types
 */
window.showSkeleton = function(container, type = 'list', rows = 5) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  const skeletonTemplates = {
    table: Array(rows).fill(`
      <tr class="animate-pulse">
        <td class="p-3"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div></td>
        <td class="p-3"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div></td>
        <td class="p-3"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div></td>
        <td class="p-3"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div></td>
      </tr>
    `).join(''),
    card: `
      <div class="animate-pulse space-y-4 p-4">
        <div class="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-4/6"></div>
      </div>
    `,
    list: Array(rows).fill(`
      <div class="flex items-center gap-3 p-3 animate-pulse">
        <div class="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
        <div class="flex-1 space-y-2">
          <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
          <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
        </div>
      </div>
    `).join(''),
    text: Array(rows).fill(`
      <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2"></div>
    `).join(''),
    stats: `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
        ${Array(4).fill('<div class="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>').join('')}
      </div>
    `
  };

  el.innerHTML = skeletonTemplates[type] || skeletonTemplates.list;
};

/**
 * Show inline loading spinner
 * @param {string|HTMLElement} container - Container element or selector
 * @param {string} message - Optional loading message
 */
window.showLoadingSpinner = function(container, message = 'Memuat...') {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  el.innerHTML = `
    <div class="flex flex-col items-center justify-center p-6 gap-3" role="status" aria-live="polite">
      <div class="w-8 h-8 border-3 border-slate-200 border-t-palette-blue rounded-full animate-spin"></div>
      <span class="text-sm text-slate-500 dark:text-slate-400 font-medium">${window.escapeHtml(message)}</span>
    </div>
  `;
};

/**
 * Show error state in a container
 * @param {string|HTMLElement} container - Container element or selector
 * @param {string} message - Error message to display
 * @param {Function} retryFn - Optional retry callback function
 */
window.showErrorState = function(container, message = 'Terjadi kesalahan', retryFn = null) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  const retryButton = retryFn ? `
    <button onclick="window.showLoadingSpinner('${typeof container === 'string' ? container : '#' + container.id}'); setTimeout(${retryFn.toString()}, 100);"
      class="mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors">
      Coba Lagi
    </button>
  ` : '';

  el.innerHTML = `
    <div class="flex flex-col items-center justify-center p-6 gap-2 text-center" role="alert">
      <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-300 font-medium">${window.escapeHtml(message)}</p>
      ${retryButton}
    </div>
  `;
};

/**
 * Show empty state in a container
 * @param {string|HTMLElement} container - Container element or selector
 * @param {string} title - Empty state title
 * @param {string} message - Empty state description
 * @param {string} icon - Lucide icon name (optional)
 */
window.showEmptyState = function(container, title = 'Tidak ada data', message = '', icon = 'inbox') {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return;

  el.innerHTML = `
    <div class="flex flex-col items-center justify-center p-8 gap-3 text-center">
      <div class="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
        <i data-lucide="${icon}" class="w-8 h-8 text-slate-400"></i>
      </div>
      <p class="text-sm font-bold text-slate-600 dark:text-slate-300">${window.escapeHtml(title)}</p>
      ${message ? `<p class="text-xs text-slate-400">${window.escapeHtml(message)}</p>` : ''}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
};

// ==========================================
// MEDIUM FIX #10: ERROR RECOVERY (Timeout Notifications)
// ==========================================

/**
 * Execute async operation with timeout and user notification
 * @param {Promise} promise - The promise to execute
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10 seconds)
 * @param {string} operationName - Name of operation for notification
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
window.executeWithTimeoutNotification = async function(promise, timeoutMs = 10000, operationName = 'Operasi') {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`timeout:${operationName}`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return { success: true, data: result };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.message?.startsWith('timeout:')) {
      const opName = error.message.replace('timeout:', '');
      // User notification on timeout
      window.showToast(`${opName} membutuhkan waktu terlalu lama. Data mungkin tidak tersimpan sepenuhnya.`, 'warning', true);
      window.handleError(error, `Timeout: ${opName}`, 'WARNING');
      return {
        success: false,
        error: 'timeout',
        message: `${opName} timeout setelah ${timeoutMs / 1000} detik`
      };
    }

    window.handleError(error, `Execute: ${operationName}`, 'ERROR');
    return { success: false, error: 'operation_failed', message: error.message };
  }
};

/**
 * Show persistent error notification with recovery suggestion
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @param {string[]} suggestions - Array of recovery suggestions
 */
window.showPersistentError = function(title, message, suggestions = []) {
  const suggestionText = suggestions.length > 0
    ? suggestions.map(s => `• ${s}`).join('\n')
    : '';

  const fullMessage = suggestionText ? `${message}\n\n💡 Saran:\n${suggestionText}` : message;

  window.showToast(fullMessage, 'error', true);
  window.handleError(new Error(message), title, 'ERROR');
};

/**
 * Recovery helper - retry with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} baseDelayMs - Base delay in ms (default: 1000)
 * @returns {Promise<any>}
 */
window.retryWithBackoff = async function(fn, maxRetries = 3, baseDelayMs = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1); // Exponential: 1s, 2s, 4s
        console.log(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

// HIGH FIX: Attendance Index untuk O(1) lookup
// Format: ATTENDANCE_INDEX[dateKey][slotId][studentId] = status
let ATTENDANCE_INDEX = null;

window.buildAttendanceIndex = function() {
  ATTENDANCE_INDEX = {};
  const data = appState.attendanceData || {};

  for (const [dateKey, dayData] of Object.entries(data)) {
    ATTENDANCE_INDEX[dateKey] = {};

    for (const [slotId, slotData] of Object.entries(dayData)) {
      ATTENDANCE_INDEX[dateKey][slotId] = {};

      for (const [studentId, studentRecord] of Object.entries(slotData)) {
        // Store the entire record for O(1) access to status, note, etc.
        ATTENDANCE_INDEX[dateKey][slotId][studentId] = studentRecord;
      }
    }
  }

  console.log(`[AttendanceIndex] Built index: ${Object.keys(ATTENDANCE_INDEX).length} dates`);
  return ATTENDANCE_INDEX;
};

// O(1) lookup untuk attendance data
window.getAttendanceRecord = function(dateKey, slotId, studentId) {
  if (!ATTENDANCE_INDEX) {
    window.buildAttendanceIndex();
  }
  return ATTENDANCE_INDEX?.[dateKey]?.[slotId]?.[studentId] || null;
};

// O(1) lookup untuk status tertentu
window.getAttendanceStatus = function(dateKey, slotId, studentId, activityId) {
  const record = window.getAttendanceRecord(dateKey, slotId, studentId);
  return record?.status?.[activityId] || null;
};

// Invalidate index saat attendance berubah
window.invalidateAttendanceIndex = function() {
  ATTENDANCE_INDEX = null;
};

// HIGH FIX: Centralized State Store Pattern
// Single source of truth untuk app state mutations

const StateStore = {
  listeners: new Set(),

  // Subscribe to state changes
  subscribe: function(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback); // Returns unsubscribe function
  },

  // Notify all listeners
  _notify: function(changedKeys) {
    this.listeners.forEach(callback => {
      try {
        callback(changedKeys);
      } catch (e) {
        console.error('[StateStore] Listener error:', e);
      }
    });
  },

  // Safe state mutation with automatic version increment
  setState: function(partial, skipVersionIncrement = false) {
    const changedKeys = [];

    for (const [key, value] of Object.entries(partial)) {
      if (appState[key] !== value) {
        appState[key] = value;
        changedKeys.push(key);
      }
    }

    // Increment version for tracking
    if (changedKeys.length > 0 && !skipVersionIncrement) {
      window.incrementStateVersion();
    }

    // Notify listeners
    if (changedKeys.length > 0) {
      this._notify(changedKeys);
    }

    return changedKeys;
  },

  // Get specific state
  getState: function(key) {
    return appState[key];
  },

  // Get all state (read-only copy)
  getAll: function() {
    return { ...appState };
  }
};

// Export to global scope
window.StateStore = StateStore;

// HIGH FIX: Input Validation Schema
// Schema-based validation untuk forms dan data

const ValidationSchemas = {
  // Permit form validation
  permit: {
    reason: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 500,
      message: 'Keterangan izin harus 3-500 karakter'
    },
    start_date: {
      type: 'string',
      required: true,
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      message: 'Format tanggal mulai tidak valid (YYYY-MM-DD)'
    },
    end_date: {
      type: 'string',
      required: false,
      pattern: /^\d{4}-\d{2}-\d{2}$/,
      message: 'Format tanggal selesai tidak valid (YYYY-MM-DD)'
    },
    nis: {
      type: 'string',
      required: true,
      minLength: 1,
      message: 'NIS harus diisi'
    },
    category: {
      type: 'string',
      required: true,
      enum: ['sakit', 'izin', 'khitan', 'wali'],
      message: 'Kategori izin tidak valid'
    }
  },

  // Attendance status validation
  attendance: {
    status: {
      type: 'string',
      required: true,
      enum: ['Hadir', 'Telat', 'Sakit', 'Izin', 'Alpa', 'Pulang'],
      message: 'Status tidak valid'
    },
    note: {
      type: 'string',
      required: false,
      maxLength: 500,
      message: 'Keterangan terlalu panjang (max 500 karakter)'
    }
  },

  // Student data validation
  student: {
    nis: {
      type: 'string',
      required: true,
      minLength: 1,
      pattern: /^\d+$/,
      message: 'NIS harus berupa angka'
    },
    nama: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 100,
      message: 'Nama harus 2-100 karakter'
    },
    kelas: {
      type: 'string',
      required: true,
      minLength: 1,
      message: 'Kelas harus diisi'
    }
  }
};

// Generic validator function
window.validate = function(data, schema) {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        message: rules.message || `${field} harus diisi`,
        code: 'REQUIRED'
      });
      continue;
    }

    // Skip further validation if not required and empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }

    // Type check
    if (rules.type && typeof value !== rules.type) {
      errors.push({
        field,
        message: `${field} harus berupa ${rules.type}`,
        code: 'TYPE_MISMATCH'
      });
      continue;
    }

    // String length checks
    if (rules.minLength && value.length < rules.minLength) {
      errors.push({
        field,
        message: rules.message || `${field} terlalu pendek`,
        code: 'TOO_SHORT'
      });
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push({
        field,
        message: rules.message || `${field} terlalu panjang`,
        code: 'TOO_LONG'
      });
    }

    // Pattern check
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push({
        field,
        message: rules.message || `Format ${field} tidak valid`,
        code: 'INVALID_FORMAT'
      });
    }

    // Enum check
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field,
        message: rules.message || `${field} tidak valid`,
        code: 'INVALID_ENUM'
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Validate permit form
window.validatePermitForm = function(data) {
  return window.validate(data, ValidationSchemas.permit);
};

// Validate attendance
window.validateAttendance = function(data) {
  return window.validate(data, ValidationSchemas.attendance);
};

// Validate student
window.validateStudent = function(data) {
  return window.validate(data, ValidationSchemas.student);
};

// Helper: Quick form validation with toast
window.validateAndNotify = function(data, schema, showToastOnError = true) {
  const result = window.validate(data, schema);
  if (!result.valid && showToastOnError) {
    const firstError = result.errors[0];
    window.showToast(firstError.message, 'error');
  }
  return result;
};
window.setAttendanceData = function(dateKey, slotId, studentId, data) {
  if (!appState.attendanceData[dateKey]) {
    appState.attendanceData[dateKey] = {};
  }
  if (!appState.attendanceData[dateKey][slotId]) {
    appState.attendanceData[dateKey][slotId] = {};
  }

  const isNew = !appState.attendanceData[dateKey][slotId][studentId];
  appState.attendanceData[dateKey][slotId][studentId] = {
    ...appState.attendanceData[dateKey][slotId][studentId],
    ...data
  };

  // Invalidate attendance index cache
  window.invalidateAttendanceIndex();

  // Trigger auto-save
  if (window.storageManager?.triggerAutoSave) {
    window.storageManager.triggerAutoSave();
  }

  window.incrementStateVersion();
  return isNew;
};

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
