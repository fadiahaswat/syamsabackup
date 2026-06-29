// File: config.js
// Konfigurasi terpusat — edit file ini untuk menyesuaikan deployment.

// ==========================================
// KREDENSIAL & URL EKSTERNAL
// ==========================================
window.APP_CREDENTIALS = {
  // Google Apps Script (sumber data Santri & Kelas — URL yang sama)
  googleSheetUrl:
    "https://script.google.com/macros/s/AKfycbw-URYAsLTWCdnGurQhM1ZXa9N8vm-GBlHwtetDlin73-Ma8G0aAbFoboGGUI8GgVDl/exec",

  // Google OAuth Client ID (untuk login Musyrif)
  googleClientId:
    "336443539411-b7uv4udqqhbqpdmeuja54dhfsda4q7cm.apps.googleusercontent.com",

  // Daftar email yang terdaftar sebagai Admin Musyrif (Pengelola Utama)
  adminEmails: [
    "andiaqillah@muallimin.sch.id"
  ],
};

// ==========================================
// LOKASI & GPS
// ==========================================
window.APP_LOCATION = {
  gpsCacheKey: "presensi_gps_cache",
  gpsCacheDurationMs: 15 * 60 * 1000,
  gpsStatusTimeoutMs: 15 * 1000,
  gpsVerificationTimeoutMs: 20 * 1000,
  gpsVerificationGuardTimeoutMs: 22 * 1000,
  useGeofencing: true,
  maxRadiusMeters: 50,
  defaultPrayerLocation: {
    label: "Wirobrajan, Yogyakarta",
    lat: -7.807757,
    lng: 110.350915,
  },
  qiblaFallbackLocation: {
    lat: -7.801389,
    lng: 110.364444,
  },
  geofenceLocations: [
    {
      name: "Masjid Jami' Mu'allimin",
      lat: -7.807757309250455,
      lng: 110.35091531948025,
    },
    {
      name: "Aula Asrama 10",
      lat: -7.807645469455366,
      lng: 110.35180282962452,
    },
    {
      name: "Mushola Asrama 8",
      lat: -7.806781091907755,
      lng: 110.34871697299599,
    },
    {
      name: "Masjid Hajah Yuliana",
      lat: -7.807337010430911,
      lng: 110.26653812830205,
    },
    {
      name: "Kantor Muhammadiyah Supeno",
      lat: -7.8163746365704725,
      lng: 110.37986454893164,
    },
  ],
};

// ==========================================
// MODE AUTENTIKASI
// ==========================================
window.APP_AUTH = {
  // 'production' = PIN + Google OAuth
  loginMode: "production",
  allowTestingMode: false,
  testingAccounts: []
};

// ==========================================
// VERSI APLIKASI (untuk cache busting PWA)
// ==========================================
window.APP_VERSION = "2.2.8";

// Helper: Generate versioned script tag
window.versionedScript = function(src) {
  return src + '?v=' + window.APP_VERSION;
};

// ==========================================
// KONSTANTA APLIKASI (MAGIC NUMBERS)
// ==========================================
window.APP_CONSTANTS = {
  // Kunci localStorage untuk PIN Musyrif
  pinKey: "musyrif_pin",

  // Batas ukuran data sebelum peringatan storage penuh (~4.5 MB)
  maxStorageBytes: 4500000,

  // Batas maksimal entri log aktivitas yang disimpan
  maxActivityLogEntries: 50,

  // Berapa hari ke belakang data presensi masih bisa diedit
  maxEditDaysBack: 3,

  // Timeout (ms) untuk load data dari server saat startup
  dataLoadTimeoutMs: 8000,

  // Durasi cache data santri sebelum diperbarui dari server (24 jam)
  santriCacheExpiryMs: 24 * 60 * 60 * 1000,
};

// ==========================================
// TAHFIZH
// ==========================================
window.APP_TAHFIZH_CONFIG = {
  // Ubah target/deadline Tahfizh dari sini tanpa menyentuh modul utama.
  deadlineJuz30Score: "2026-01-03T23:59:59",
  deadlineTahfizhTuntas: "2026-06-27T12:30:00",
  perpulanganPeriods: [
    {
      name: "Perpulangan",
      deadline: "2026-06-27T12:30:00",
      required: [29, 30],
      type: "mutqin",
    },
  ],

  // Mode dummy hanya bisa aktif jika debug atau query `?debug=true`.
  allowDummyMode: false,
};

// ==========================================
// LOCAL STORAGE CONFIGURATION
// ==========================================
window.APP_STORAGE = {
  // Storage version for future migrations
  version: 3,

  // Storage mode: 'local-only' - semua data disimpan di browser localStorage
  mode: 'local-only',

  // Data storage keys
  keys: {
    attendance: 'musyrif_app_v5_fix',
    permits: 'musyrif_permits_db',
    settings: 'musyrif_settings',
    activityLog: 'musyrif_activity_log',
    googleAuth: 'musyrif_google_session',
  },

  // Auto-save configuration
  autoSave: {
    debounceMs: 500,
    enabled: true
  },
};
