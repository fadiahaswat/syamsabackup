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
    "694043281368-cqf9tji9rsv2k2gtfu7pbicdsc1gcvk7.apps.googleusercontent.com",
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
  // 'testing' = PIN + username/password lokal (tanpa Google)
  loginMode: "production",
  allowTestingMode: false,

  // Akun khusus pengujian (password hash SHA-256 hex) — hanya untuk non-produksi
  // Contoh generate hash: echo -n "password-anda" | shasum -a 256
  // Catatan: kelas harus sesuai kelas yang valid di data-kelas
  testingAccounts: [
    {
      username: "tester-musyrif",
      kelas: "XI-A",
      passwordHash:
        "b822f1cd2dcfc685b47e83e3980289fd5d8e3ff3a82def24d7d1d68bb272eb32",
    },
  ],
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
// LOCAL STORAGE CONFIGURATION
// ==========================================
window.APP_STORAGE = {
  // Storage version for future migrations
  version: 2,

  // Storage mode: 'local-only' | 'hybrid' | 'cloud-primary'
  // 'local-only': Default, no cloud sync (existing behavior)
  // 'hybrid': Cloud backup + offline-first (recommended)
  // 'cloud-primary': Cloud-first with local cache
  mode: 'hybrid', // Aktifkan hybrid mode untuk cloud sync

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

  // ==========================================
  // SUPABASE CLOUD STORAGE CONFIG
  // ==========================================
  supabase: {
    url: 'https://ioyqnmvrnpzdztpkgaxt.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlveXFubXZycG56ZHp0cGtnYXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzI2NjAsImV4cCI6MjA2NTEwODY2MH0.sb_publishable_1ipdE1TbfNSTGCmz91vqDg_SFREVaF5',
  },

  // Sync configuration
  sync: {
    // Enable automatic background sync
    autoSync: true,

    // Sync interval in milliseconds (default: 30 seconds)
    syncInterval: 30000,

    // Conflict resolution: 'server-wins' | 'client-wins' | 'manual'
    // 'server-wins': Server data overwrites local (safer)
    // 'client-wins': Local changes overwrite server
    // 'manual': Prompt user to resolve conflicts
    conflictResolution: 'server-wins',

    // Max retry attempts for failed syncs
    retryAttempts: 3,

    // Batch size for bulk operations
    batchSize: 50,
  },

  // File upload configuration
  fileUpload: {
    // Max file size in bytes (default: 5MB)
    maxSizeBytes: 5 * 1024 * 1024,

    // Allowed MIME types
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],

    // Storage bucket name
    bucket: 'permit-documents',
  }
};
