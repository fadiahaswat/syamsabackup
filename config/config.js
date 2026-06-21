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
// FIREBASE STORAGE CONFIGURATION
// ==========================================
window.APP_FIREBASE = {
  // Enable Firebase as primary storage (default: true)
  enabled: true,

  // Firebase database paths configuration
  paths: {
    attendance: 'attendance',           // /{musyrifId}/{date}/{slotId}
    permits: 'permits',                 // /{permitId}
    settings: 'settings',               // /{musyrifId}
    activityLog: 'activity_log',        // /{musyrifId}
    offlineQueue: 'offline_queue',      // /{musyrifId}/{timestamp}
    fcmTokens: 'fcm_tokens'             // (existing)
  },

  // Sync configuration
  sync: {
    // Auto-sync when coming online (default: true)
    autoSyncOnReconnect: true,
    // Debounce delay for batch saves (ms)
    saveDebounceMs: 500,
    // Max concurrent sync operations
    maxConcurrentSync: 3,
    // Retry failed operations
    retryFailedOps: true,
    // Max retry attempts per operation
    maxRetryAttempts: 3
  },

  // Offline mode configuration
  offline: {
    // Use localStorage as fallback when offline (default: true)
    useLocalStorageFallback: true,
    // Show offline indicator (default: true)
    showOfflineIndicator: true,
    // Cache data locally for offline access (default: true)
    cacheForOffline: true,
    // Queue operations for sync when back online (default: true)
    queueOperations: true
  },

  // Conflict resolution strategy
  conflictResolution: 'remote_wins',  // 'remote_wins' | 'local_wins' | 'merge'
  // 'remote_wins': Firebase data takes precedence (recommended for multi-device)
  // 'local_wins': Local changes take precedence
  // 'merge': Attempt to merge conflicting data
};
