// File: config.js
// Konfigurasi terpusat — edit file ini untuk menyesuaikan deployment.
//
// ==========================================
// KEAMANAN: SEcrets Management
// ==========================================
// PENTING: Untuk production, buat file 'config.local.js' yang meng-override
// nilai-nilai sensitif di bawah ini. Pastikan config.local.js TIDAK di-commit ke repo.
//
// Contoh config.local.js:
//   window.APP_SECRETS = {
//     googleSheetUrl: "https://your-script.google.com/...",
//     googleClientId: "your-client-id.apps.googleusercontent.com",
//     adminEmails: ["admin@yourdomain.com"],
//     superadminHash: "sha256-hash-dari-password"
//   };
//
// Nilai di bawah ini adalah FALLBACK untuk development. Override di config.local.js.

// ==========================================
// KREDENSIAL & URL EKSTERNAL
// ==========================================
const _DEFAULT_CREDENTIALS = {
  googleSheetUrl: "",
  googleClientId: "",
  adminEmails: [],
  supabaseUrl: "",
  supabaseAnonKey: "",
  tahfizhScriptUrl: "https://script.google.com/macros/s/AKfycbyl2FCcGUtolkJIDsoiTYFKeKp8IQwHT0V3z8n1pOHH9CLiyvYZTBaimrojILJM_A-HLg/exec",
  adminWhatsAppNumber: "6285339213109",
};

// Override dengan secrets dari config.local.js atau window.APP_SECRETS
const _SECRETS = window.APP_SECRETS || {};

window.APP_CREDENTIALS = {
  googleSheetUrl: _SECRETS.googleSheetUrl || _DEFAULT_CREDENTIALS.googleSheetUrl,
  googleClientId: _SECRETS.googleClientId || _DEFAULT_CREDENTIALS.googleClientId,
  adminEmails: _SECRETS.adminEmails || _DEFAULT_CREDENTIALS.adminEmails,
  supabaseUrl: _SECRETS.supabaseUrl || _DEFAULT_CREDENTIALS.supabaseUrl,
  supabaseAnonKey: _SECRETS.supabaseAnonKey || _DEFAULT_CREDENTIALS.supabaseAnonKey,
  tahfizhScriptUrl: _SECRETS.tahfizhScriptUrl || _DEFAULT_CREDENTIALS.tahfizhScriptUrl,
  adminWhatsAppNumber: _SECRETS.adminWhatsAppNumber || _DEFAULT_CREDENTIALS.adminWhatsAppNumber,
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
  musyrifSortOrder: ['Andi Aqillah Fadia Haswat', 'Abdullah', 'Muhammad Zhafir Setiaji'],
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

  // Storage mode: 'supabase-sync' jika kredensial diatur, jika tidak fall back ke 'local-only'
  mode: (window.APP_CREDENTIALS?.supabaseUrl && window.APP_CREDENTIALS?.supabaseAnonKey) ? 'supabase-sync' : 'local-only',

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
