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
window.APP_VERSION = "2.3.10";

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

  // Master target mingguan per jenjang. Nama surat menggunakan nama baku
  // yang sama dengan referensi Tahfizh agar pencocokan setoran konsisten.
  weeklyTargetsByGrade: {
    "1": [
      { week: 1, deadline: "2026-07-25T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Ikhlas - An-Nas", surahs: ["Al-Ikhlas", "Al-Falaq", "An-Nas"] },
      { week: 2, deadline: "2026-08-01T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "An-Nasr - Al-Lahab", surahs: ["An-Nasr", "Al-Lahab"] },
      { week: 3, deadline: "2026-08-08T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Kafirun", surahs: ["Al-Kafirun"] },
      { week: 4, deadline: "2026-08-15T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Ma'un - Al-Kautsar", surahs: ["Al-Ma'un", "Al-Kautsar"] },
      { week: 5, deadline: "2026-08-22T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Fil - Quraysh", surahs: ["Al-Fil", "Quraysh"] },
      { week: 6, deadline: "2026-08-29T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Humazah", surahs: ["Al-Humazah"] },
      { week: 7, deadline: "2026-09-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "At-Takatsur - Al-'Ashr", surahs: ["At-Takatsur", "Al-'Ashr"] },
      { week: 8, deadline: "2026-09-12T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Qari'ah", surahs: ["Al-Qari'ah"] },
      { week: 9, deadline: "2026-09-19T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-'Adiyat", surahs: ["Al-'Adiyat"] },
      { week: 10, deadline: "2026-09-26T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Az-Zalzalah", surahs: ["Az-Zalzalah"] },
      { week: 11, deadline: "2026-10-03T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Qadr - Al-Bayyinah", surahs: ["Al-Qadr", "Al-Bayyinah"] },
      { week: 12, deadline: "2026-10-10T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-'Alaq", surahs: ["Al-'Alaq"] },
      { week: 13, deadline: "2026-10-17T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Insyirah - At-Tin", surahs: ["Al-Insyirah", "At-Tin"] },
      { week: 14, deadline: "2026-10-24T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Ad-Duha", surahs: ["Ad-Duha"] },
      { week: 15, deadline: "2026-10-31T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Lail", surahs: ["Al-Lail"] },
      { week: 16, deadline: "2026-11-07T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Asy-Syams", surahs: ["Asy-Syams"] },
      { week: 17, deadline: "2026-11-14T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Balad", surahs: ["Al-Balad"] },
      { week: 18, deadline: "2026-11-21T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Fajr", surahs: ["Al-Fajr"] },
      { week: 19, deadline: "2026-11-28T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Ghasyiyah", surahs: ["Al-Ghasyiyah"] },
      { week: 20, deadline: "2026-12-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-A'la", surahs: ["Al-A'la"] },
      { week: 21, deadline: "2026-12-12T23:59:59+07:00", score: 20, type: "Mutqin", targetLabel: "Al-A'la - An-Nas (Mutqin)", surahs: ["Al-A'la", "Al-Ghasyiyah", "Al-Fajr", "Al-Balad", "Asy-Syams", "Al-Lail", "Ad-Duha", "Al-Insyirah", "At-Tin", "Al-'Alaq", "Al-Bayyinah", "Al-Qadr", "Az-Zalzalah", "Al-'Adiyat", "Al-Qari'ah", "Al-'Ashr", "At-Takatsur", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kautsar", "Al-Kafirun", "Al-Lahab", "An-Nasr", "Al-Ikhlas", "Al-Falaq", "An-Nas"] },
      { week: 22, deadline: "2027-01-16T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-A'la", surahs: ["Al-A'la"] },
      { week: 23, deadline: "2027-01-23T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Ghasyiyah", surahs: ["Al-Ghasyiyah"] },
      { week: 24, deadline: "2027-01-30T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Fajr", surahs: ["Al-Fajr"] },
      { week: 25, deadline: "2027-02-06T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Balad", surahs: ["Al-Balad"] },
      { week: 26, deadline: "2027-02-13T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Asy-Syams", surahs: ["Asy-Syams"] },
      { week: 27, deadline: "2027-02-20T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Lail", surahs: ["Al-Lail"] },
      { week: 28, deadline: "2027-02-27T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Ad-Duha, Al-Insyirah, At-Tin", surahs: ["Ad-Duha", "Al-Insyirah", "At-Tin"] },
      { week: 29, deadline: "2027-04-03T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-'Alaq", surahs: ["Al-'Alaq"] },
      { week: 30, deadline: "2027-04-10T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Bayyinah, Al-Qadr", surahs: ["Al-Bayyinah", "Al-Qadr"] },
      { week: 31, deadline: "2027-04-17T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Az-Zalzalah, Al-'Adiyat, Al-Qari'ah", surahs: ["Az-Zalzalah", "Al-'Adiyat", "Al-Qari'ah"] },
      { week: 32, deadline: "2027-04-24T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-'Ashr, At-Takatsur, Al-Humazah, Quraysh, Al-Fil", surahs: ["Al-'Ashr", "At-Takatsur", "Al-Humazah", "Quraysh", "Al-Fil"] },
      { week: 33, deadline: "2027-05-08T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Ma'un, Al-Kautsar, Al-Kafirun", surahs: ["Al-Ma'un", "Al-Kautsar", "Al-Kafirun"] },
      { week: 34, deadline: "2027-05-22T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Lahab, An-Nasr, Al-Ikhlas, Al-Falaq, An-Nas", surahs: ["Al-Lahab", "An-Nasr", "Al-Ikhlas", "Al-Falaq", "An-Nas"] }
    ],
    "2": [
      { week: 1, deadline: "2026-07-25T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "An-Naba': 1-16", requirements: [{ surah: "An-Naba", ayatStart: 1, ayatEnd: 16 }] },
      { week: 2, deadline: "2026-08-01T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "An-Naba': 17-30", requirements: [{ surah: "An-Naba", ayatStart: 17, ayatEnd: 30 }] },
      { week: 3, deadline: "2026-08-08T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "An-Naba': 31-40", requirements: [{ surah: "An-Naba", ayatStart: 31, ayatEnd: 40 }] },
      { week: 4, deadline: "2026-08-15T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "An-Nazi'at: 1-14", requirements: [{ surah: "An-Nazi'at", ayatStart: 1, ayatEnd: 14 }] },
      { week: 5, deadline: "2026-08-22T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "An-Nazi'at: 15-33", requirements: [{ surah: "An-Nazi'at", ayatStart: 15, ayatEnd: 33 }] },
      { week: 6, deadline: "2026-08-29T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "An-Nazi'at: 34-46", requirements: [{ surah: "An-Nazi'at", ayatStart: 34, ayatEnd: 46 }] },
      { week: 7, deadline: "2026-09-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Abasa: 1-16", requirements: [{ surah: "Abasa", ayatStart: 1, ayatEnd: 16 }] },
      { week: 8, deadline: "2026-09-12T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Abasa: 17-32", requirements: [{ surah: "Abasa", ayatStart: 17, ayatEnd: 32 }] },
      { week: 9, deadline: "2026-09-19T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Abasa: 33-42", requirements: [{ surah: "Abasa", ayatStart: 33, ayatEnd: 42 }] },
      { week: 10, deadline: "2026-09-26T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "At-Takwir: 1-14", requirements: [{ surah: "At-Takwir", ayatStart: 1, ayatEnd: 14 }] },
      { week: 11, deadline: "2026-10-03T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "At-Takwir: 15-29", requirements: [{ surah: "At-Takwir", ayatStart: 15, ayatEnd: 29 }] },
      { week: 12, deadline: "2026-10-10T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Infitar: 1-9", requirements: [{ surah: "Al-Infithor", ayatStart: 1, ayatEnd: 9 }] },
      { week: 13, deadline: "2026-10-17T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Infitar: 10-19", requirements: [{ surah: "Al-Infithor", ayatStart: 10, ayatEnd: 19 }] },
      { week: 14, deadline: "2026-10-24T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muthaffifin: 1-17", requirements: [{ surah: "Al-Muthoffifin", ayatStart: 1, ayatEnd: 17 }] },
      { week: 15, deadline: "2026-10-31T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muthaffifin: 18-28", requirements: [{ surah: "Al-Muthoffifin", ayatStart: 18, ayatEnd: 28 }] },
      { week: 16, deadline: "2026-11-07T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muthaffifin: 29-36", requirements: [{ surah: "Al-Muthoffifin", ayatStart: 29, ayatEnd: 36 }] },
      { week: 17, deadline: "2026-11-14T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Insyiqaq: 1-15", requirements: [{ surah: "Al-Insyiqaq", ayatStart: 1, ayatEnd: 15 }] },
      { week: 18, deadline: "2026-11-21T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Insyiqaq: 16-25", requirements: [{ surah: "Al-Insyiqaq", ayatStart: 16, ayatEnd: 25 }] },
      { week: 19, deadline: "2026-11-28T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Buruj", requirements: [{ surah: "Al-Buruj", ayatStart: 1, ayatEnd: 22 }] },
      { week: 20, deadline: "2026-12-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Ath-Thariq", requirements: [{ surah: "Ath-Thariq", ayatStart: 1, ayatEnd: 17 }] },
      { week: 21, deadline: "2026-12-12T23:59:59+07:00", score: 20, type: "Mutqin", targetLabel: "An-Naba' - Ath-Thariq (Mutqin)", surahs: ["An-Naba", "An-Nazi'at", "Abasa", "At-Takwir", "Al-Infithor", "Al-Muthoffifin", "Al-Insyiqaq", "Al-Buruj", "Ath-Thariq"] },
      { week: 22, deadline: "2027-01-16T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin An-Naba': 1-20", requirements: [{ surah: "An-Naba", ayatStart: 1, ayatEnd: 20 }] },
      { week: 23, deadline: "2027-01-23T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin An-Naba': 21-40", requirements: [{ surah: "An-Naba", ayatStart: 21, ayatEnd: 40 }] },
      { week: 24, deadline: "2027-01-30T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin An-Nazi'at: 1-26", requirements: [{ surah: "An-Nazi'at", ayatStart: 1, ayatEnd: 26 }] },
      { week: 25, deadline: "2027-02-06T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin An-Nazi'at: 27-46", requirements: [{ surah: "An-Nazi'at", ayatStart: 27, ayatEnd: 46 }] },
      { week: 26, deadline: "2027-02-13T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Abasa: 1-23", requirements: [{ surah: "Abasa", ayatStart: 1, ayatEnd: 23 }] },
      { week: 27, deadline: "2027-02-20T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Abasa: 24-42", requirements: [{ surah: "Abasa", ayatStart: 24, ayatEnd: 42 }] },
      { week: 28, deadline: "2027-02-27T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin At-Takwir", requirements: [{ surah: "At-Takwir", ayatStart: 1, ayatEnd: 29 }] },
      { week: 29, deadline: "2027-04-03T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Infitar", requirements: [{ surah: "Al-Infithor", ayatStart: 1, ayatEnd: 19 }] },
      { week: 30, deadline: "2027-04-10T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Muthaffifin: 1-17", requirements: [{ surah: "Al-Muthoffifin", ayatStart: 1, ayatEnd: 17 }] },
      { week: 31, deadline: "2027-04-17T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Muthaffifin: 18-36", requirements: [{ surah: "Al-Muthoffifin", ayatStart: 18, ayatEnd: 36 }] },
      { week: 32, deadline: "2027-04-24T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Insyiqaq", requirements: [{ surah: "Al-Insyiqaq", ayatStart: 1, ayatEnd: 25 }] },
      { week: 33, deadline: "2027-05-08T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Buruj", requirements: [{ surah: "Al-Buruj", ayatStart: 1, ayatEnd: 22 }] },
      { week: 34, deadline: "2027-05-22T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Ath-Thariq", requirements: [{ surah: "Ath-Thariq", ayatStart: 1, ayatEnd: 17 }] }
    ],
    "3": [
      { week: 1, deadline: "2026-07-25T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Mulk: 1-6", requirements: [{ surah: "Al-Mulk", ayatStart: 1, ayatEnd: 6 }] },
      { week: 2, deadline: "2026-08-01T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Mulk: 7-12", requirements: [{ surah: "Al-Mulk", ayatStart: 7, ayatEnd: 12 }] },
      { week: 3, deadline: "2026-08-08T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Mulk: 13-19", requirements: [{ surah: "Al-Mulk", ayatStart: 13, ayatEnd: 19 }] },
      { week: 4, deadline: "2026-08-15T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Mulk: 20-26", requirements: [{ surah: "Al-Mulk", ayatStart: 20, ayatEnd: 26 }] },
      { week: 5, deadline: "2026-08-22T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Mulk: 27-30", requirements: [{ surah: "Al-Mulk", ayatStart: 27, ayatEnd: 30 }] },
      { week: 6, deadline: "2026-08-29T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Qalam: 1-15", requirements: [{ surah: "Al-Qalam", ayatStart: 1, ayatEnd: 15 }] },
      { week: 7, deadline: "2026-09-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Qalam: 16-33", requirements: [{ surah: "Al-Qalam", ayatStart: 16, ayatEnd: 33 }] },
      { week: 8, deadline: "2026-09-12T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Qalam: 34-42", requirements: [{ surah: "Al-Qalam", ayatStart: 34, ayatEnd: 42 }] },
      { week: 9, deadline: "2026-09-19T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Qalam: 43-52", requirements: [{ surah: "Al-Qalam", ayatStart: 43, ayatEnd: 52 }] },
      { week: 10, deadline: "2026-09-26T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Haqqah: 1-8", requirements: [{ surah: "Al-Haqqah", ayatStart: 1, ayatEnd: 8 }] },
      { week: 11, deadline: "2026-10-03T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Haqqah: 9-18", requirements: [{ surah: "Al-Haqqah", ayatStart: 9, ayatEnd: 18 }] },
      { week: 12, deadline: "2026-10-10T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Haqqah: 19-34", requirements: [{ surah: "Al-Haqqah", ayatStart: 19, ayatEnd: 34 }] },
      { week: 13, deadline: "2026-10-17T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Haqqah: 35-52", requirements: [{ surah: "Al-Haqqah", ayatStart: 35, ayatEnd: 52 }] },
      { week: 14, deadline: "2026-10-24T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Ma'arij: 1-10", requirements: [{ surah: "Al-Ma'arij", ayatStart: 1, ayatEnd: 10 }] },
      { week: 15, deadline: "2026-10-31T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Ma'arij: 11-23", requirements: [{ surah: "Al-Ma'arij", ayatStart: 11, ayatEnd: 23 }] },
      { week: 16, deadline: "2026-11-07T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Ma'arij: 24-35", requirements: [{ surah: "Al-Ma'arij", ayatStart: 24, ayatEnd: 35 }] },
      { week: 17, deadline: "2026-11-14T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Ma'arij: 36-44", requirements: [{ surah: "Al-Ma'arij", ayatStart: 36, ayatEnd: 44 }] },
      { week: 18, deadline: "2026-11-21T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Nuh: 1-10", requirements: [{ surah: "Nuh", ayatStart: 1, ayatEnd: 10 }] },
      { week: 19, deadline: "2026-11-28T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Nuh: 11-20", requirements: [{ surah: "Nuh", ayatStart: 11, ayatEnd: 20 }] },
      { week: 20, deadline: "2026-12-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Nuh: 21-28", requirements: [{ surah: "Nuh", ayatStart: 21, ayatEnd: 28 }] },
      { week: 21, deadline: "2026-12-12T23:59:59+07:00", score: 20, type: "Mutqin", juz: 29, targetLabel: "Al-Mulk - Nuh (Mutqin)", surahs: ["Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij", "Nuh"] },
      { week: 22, deadline: "2027-01-16T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Mulk: 1-15", requirements: [{ surah: "Al-Mulk", ayatStart: 1, ayatEnd: 15 }] },
      { week: 23, deadline: "2027-01-23T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Mulk: 16-30", requirements: [{ surah: "Al-Mulk", ayatStart: 16, ayatEnd: 30 }] },
      { week: 24, deadline: "2027-01-30T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Qalam: 1-19", requirements: [{ surah: "Al-Qalam", ayatStart: 1, ayatEnd: 19 }] },
      { week: 25, deadline: "2027-02-06T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Qalam: 20-38", requirements: [{ surah: "Al-Qalam", ayatStart: 20, ayatEnd: 38 }] },
      { week: 26, deadline: "2027-02-13T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Qalam: 39-52", requirements: [{ surah: "Al-Qalam", ayatStart: 39, ayatEnd: 52 }] },
      { week: 27, deadline: "2027-02-20T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Haqqah: 1-18", requirements: [{ surah: "Al-Haqqah", ayatStart: 1, ayatEnd: 18 }] },
      { week: 28, deadline: "2027-02-27T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Haqqah: 19-34", requirements: [{ surah: "Al-Haqqah", ayatStart: 19, ayatEnd: 34 }] },
      { week: 29, deadline: "2027-04-03T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Haqqah: 34-52", requirements: [{ surah: "Al-Haqqah", ayatStart: 34, ayatEnd: 52 }] },
      { week: 30, deadline: "2027-04-10T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Ma'arij: 1-14", requirements: [{ surah: "Al-Ma'arij", ayatStart: 1, ayatEnd: 14 }] },
      { week: 31, deadline: "2027-04-17T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Ma'arij: 15-28", requirements: [{ surah: "Al-Ma'arij", ayatStart: 15, ayatEnd: 28 }] },
      { week: 32, deadline: "2027-04-24T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Ma'arij: 29-44", requirements: [{ surah: "Al-Ma'arij", ayatStart: 29, ayatEnd: 44 }] },
      { week: 33, deadline: "2027-05-08T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Nuh: 1-14", requirements: [{ surah: "Nuh", ayatStart: 1, ayatEnd: 14 }] },
      { week: 34, deadline: "2027-05-22T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Nuh: 15-28", requirements: [{ surah: "Nuh", ayatStart: 15, ayatEnd: 28 }] }
    ],
    "4": [
      { week: 1, deadline: "2026-07-25T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Jinn: 1-8", requirements: [{ surah: "Al-Jinn", ayatStart: 1, ayatEnd: 8 }] },
      { week: 2, deadline: "2026-08-01T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Jinn: 9-13", requirements: [{ surah: "Al-Jinn", ayatStart: 9, ayatEnd: 13 }] },
      { week: 3, deadline: "2026-08-08T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Jinn: 14-22", requirements: [{ surah: "Al-Jinn", ayatStart: 14, ayatEnd: 22 }] },
      { week: 4, deadline: "2026-08-15T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Jinn: 23-28", requirements: [{ surah: "Al-Jinn", ayatStart: 23, ayatEnd: 28 }] },
      { week: 5, deadline: "2026-08-22T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muzzammil: 1-9", requirements: [{ surah: "Al-Muzzammil", ayatStart: 1, ayatEnd: 9 }] },
      { week: 6, deadline: "2026-08-29T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muzzammil: 10-19", requirements: [{ surah: "Al-Muzzammil", ayatStart: 10, ayatEnd: 19 }] },
      { week: 7, deadline: "2026-09-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muzzammil: 20", requirements: [{ surah: "Al-Muzzammil", ayatStart: 20, ayatEnd: 20 }] },
      { week: 8, deadline: "2026-09-12T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muddatstsir: 1-17", requirements: [{ surah: "Al-Muddatsir", ayatStart: 1, ayatEnd: 17 }] },
      { week: 9, deadline: "2026-09-19T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muddatstsir: 18-30", requirements: [{ surah: "Al-Muddatsir", ayatStart: 18, ayatEnd: 30 }] },
      { week: 10, deadline: "2026-09-26T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muddatstsir: 31-42", requirements: [{ surah: "Al-Muddatsir", ayatStart: 31, ayatEnd: 42 }] },
      { week: 11, deadline: "2026-10-03T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Muddatstsir: 43-56", requirements: [{ surah: "Al-Muddatsir", ayatStart: 43, ayatEnd: 56 }] },
      { week: 12, deadline: "2026-10-10T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Qiyamah: 1-19", requirements: [{ surah: "Al-Qiyamah", ayatStart: 1, ayatEnd: 19 }] },
      { week: 13, deadline: "2026-10-17T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Qiyamah: 20-40", requirements: [{ surah: "Al-Qiyamah", ayatStart: 20, ayatEnd: 40 }] },
      { week: 14, deadline: "2026-10-24T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Insan: 1-9", requirements: [{ surah: "Al-Insaan", ayatStart: 1, ayatEnd: 9 }] },
      { week: 15, deadline: "2026-10-31T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Insan: 10-19", requirements: [{ surah: "Al-Insaan", ayatStart: 10, ayatEnd: 19 }] },
      { week: 16, deadline: "2026-11-07T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Insan: 20-25", requirements: [{ surah: "Al-Insaan", ayatStart: 20, ayatEnd: 25 }] },
      { week: 17, deadline: "2026-11-14T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Insan: 26-31", requirements: [{ surah: "Al-Insaan", ayatStart: 26, ayatEnd: 31 }] },
      { week: 18, deadline: "2026-11-21T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Mursalat: 1-19", requirements: [{ surah: "Al-Mursalat", ayatStart: 1, ayatEnd: 19 }] },
      { week: 19, deadline: "2026-11-28T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Mursalat: 20-34", requirements: [{ surah: "Al-Mursalat", ayatStart: 20, ayatEnd: 34 }] },
      { week: 20, deadline: "2026-12-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Mursalat: 35-50", requirements: [{ surah: "Al-Mursalat", ayatStart: 35, ayatEnd: 50 }] },
      { week: 21, deadline: "2026-12-12T23:59:59+07:00", score: 20, type: "Mutqin", juz: 29, targetLabel: "Al-Jinn - Al-Mursalat (Mutqin)", surahs: ["Al-Jinn", "Al-Muzzammil", "Al-Muddatsir", "Al-Qiyamah", "Al-Insaan", "Al-Mursalat"] },
      { week: 22, deadline: "2027-01-16T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Jinn: 1-13", requirements: [{ surah: "Al-Jinn", ayatStart: 1, ayatEnd: 13 }] },
      { week: 23, deadline: "2027-01-23T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Jinn: 14-28", requirements: [{ surah: "Al-Jinn", ayatStart: 14, ayatEnd: 28 }] },
      { week: 24, deadline: "2027-01-30T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Muzzammil", requirements: [{ surah: "Al-Muzzammil", ayatStart: 1, ayatEnd: 20 }] },
      { week: 25, deadline: "2027-02-06T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Muddatstsir: 1-17", requirements: [{ surah: "Al-Muddatsir", ayatStart: 1, ayatEnd: 17 }] },
      { week: 26, deadline: "2027-02-13T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Muddatstsir: 18-37", requirements: [{ surah: "Al-Muddatsir", ayatStart: 18, ayatEnd: 37 }] },
      { week: 27, deadline: "2027-02-20T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Muddatstsir: 38-56", requirements: [{ surah: "Al-Muddatsir", ayatStart: 38, ayatEnd: 56 }] },
      { week: 28, deadline: "2027-02-27T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Qiyamah: 1-19", requirements: [{ surah: "Al-Qiyamah", ayatStart: 1, ayatEnd: 19 }] },
      { week: 29, deadline: "2027-04-03T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Qiyamah: 20-40", requirements: [{ surah: "Al-Qiyamah", ayatStart: 20, ayatEnd: 40 }] },
      { week: 30, deadline: "2027-04-10T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Insan: 1-16", requirements: [{ surah: "Al-Insaan", ayatStart: 1, ayatEnd: 16 }] },
      { week: 31, deadline: "2027-04-17T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Insan: 17-31", requirements: [{ surah: "Al-Insaan", ayatStart: 17, ayatEnd: 31 }] },
      { week: 32, deadline: "2027-04-24T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Mursalat: 1-19", requirements: [{ surah: "Al-Mursalat", ayatStart: 1, ayatEnd: 19 }] },
      { week: 33, deadline: "2027-05-08T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Mursalat: 20-34", requirements: [{ surah: "Al-Mursalat", ayatStart: 20, ayatEnd: 34 }] },
      { week: 34, deadline: "2027-05-22T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Mursalat: 35-50", requirements: [{ surah: "Al-Mursalat", ayatStart: 35, ayatEnd: 50 }] }
    ],
    "5": [
      { week: 1, deadline: "2025-07-26T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Fatihah - Al-Baqarah: 9", requirements: [{ surah: "Al-Fatihah", ayatStart: 1, ayatEnd: 7 }, { surah: "Al-Baqarah", ayatStart: 1, ayatEnd: 9 }] },
      { week: 2, deadline: "2025-08-02T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 10-16", requirements: [{ surah: "Al-Baqarah", ayatStart: 10, ayatEnd: 16 }] },
      { week: 3, deadline: "2025-08-09T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 17-20", requirements: [{ surah: "Al-Baqarah", ayatStart: 17, ayatEnd: 20 }] },
      { week: 4, deadline: "2025-08-16T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 21-24", requirements: [{ surah: "Al-Baqarah", ayatStart: 21, ayatEnd: 24 }] },
      { week: 5, deadline: "2025-08-23T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 25-26", requirements: [{ surah: "Al-Baqarah", ayatStart: 25, ayatEnd: 26 }] },
      { week: 6, deadline: "2025-08-30T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 27-29", requirements: [{ surah: "Al-Baqarah", ayatStart: 27, ayatEnd: 29 }] },
      { week: 7, deadline: "2025-09-06T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 30-32", requirements: [{ surah: "Al-Baqarah", ayatStart: 30, ayatEnd: 32 }] },
      { week: 8, deadline: "2025-09-13T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 33-37", requirements: [{ surah: "Al-Baqarah", ayatStart: 33, ayatEnd: 37 }] },
      { week: 9, deadline: "2025-09-20T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 38-42", requirements: [{ surah: "Al-Baqarah", ayatStart: 38, ayatEnd: 42 }] },
      { week: 10, deadline: "2025-09-27T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 43-48", requirements: [{ surah: "Al-Baqarah", ayatStart: 43, ayatEnd: 48 }] },
      { week: 11, deadline: "2025-10-04T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 49-53", requirements: [{ surah: "Al-Baqarah", ayatStart: 49, ayatEnd: 53 }] },
      { week: 12, deadline: "2025-10-11T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 54-57", requirements: [{ surah: "Al-Baqarah", ayatStart: 54, ayatEnd: 57 }] },
      { week: 13, deadline: "2025-10-18T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 58-60", requirements: [{ surah: "Al-Baqarah", ayatStart: 58, ayatEnd: 60 }] },
      { week: 14, deadline: "2025-10-25T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 61", requirements: [{ surah: "Al-Baqarah", ayatStart: 61, ayatEnd: 61 }] },
      { week: 15, deadline: "2025-11-01T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 62-64", requirements: [{ surah: "Al-Baqarah", ayatStart: 62, ayatEnd: 64 }] },
      { week: 16, deadline: "2025-11-08T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 65-66", requirements: [{ surah: "Al-Baqarah", ayatStart: 65, ayatEnd: 66 }] },
      { week: 17, deadline: "2025-11-15T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 67-69", requirements: [{ surah: "Al-Baqarah", ayatStart: 67, ayatEnd: 69 }] },
      { week: 18, deadline: "2025-11-22T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 70-71", requirements: [{ surah: "Al-Baqarah", ayatStart: 70, ayatEnd: 71 }] },
      { week: 19, deadline: "2025-11-29T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 72-74", requirements: [{ surah: "Al-Baqarah", ayatStart: 72, ayatEnd: 74 }] },
      { week: 20, deadline: "2025-12-06T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 75-76", requirements: [{ surah: "Al-Baqarah", ayatStart: 75, ayatEnd: 76 }] },
      { week: 21, deadline: "2026-01-03T23:59:59+07:00", score: 20, type: "Mutqin", juz: 1, targetLabel: "Al-Baqarah: 1-76 (Mutqin)", requirements: [{ surah: "Al-Baqarah", ayatStart: 1, ayatEnd: 76 }] },
      { week: 22, deadline: "2026-01-17T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 23, deadline: "2026-01-24T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 24, deadline: "2026-01-31T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 25, deadline: "2026-02-07T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 26, deadline: "2026-02-14T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 27, deadline: "2026-02-28T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin (Ramadhan)", minimumSetoran: 1 },
      { week: 28, deadline: "2026-03-07T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin (Ramadhan)", minimumSetoran: 1 },
      { week: 29, deadline: "2026-04-18T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 30, deadline: "2026-04-25T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 31, deadline: "2026-05-02T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 32, deadline: "2026-05-09T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 33, deadline: "2026-05-16T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 },
      { week: 34, deadline: "2026-05-23T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin", minimumSetoran: 1 }
    ],
    "6": [
      { week: 1, deadline: "2026-07-25T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 77-80", requirements: [{ surah: "Al-Baqarah", ayatStart: 77, ayatEnd: 80 }] },
      { week: 2, deadline: "2026-08-01T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 81-83", requirements: [{ surah: "Al-Baqarah", ayatStart: 81, ayatEnd: 83 }] },
      { week: 3, deadline: "2026-08-08T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 84-85", requirements: [{ surah: "Al-Baqarah", ayatStart: 84, ayatEnd: 85 }] },
      { week: 4, deadline: "2026-08-15T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 86-88", requirements: [{ surah: "Al-Baqarah", ayatStart: 86, ayatEnd: 88 }] },
      { week: 5, deadline: "2026-08-22T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 89-90", requirements: [{ surah: "Al-Baqarah", ayatStart: 89, ayatEnd: 90 }] },
      { week: 6, deadline: "2026-08-29T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 91-93", requirements: [{ surah: "Al-Baqarah", ayatStart: 91, ayatEnd: 93 }] },
      { week: 7, deadline: "2026-09-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 94-97", requirements: [{ surah: "Al-Baqarah", ayatStart: 94, ayatEnd: 97 }] },
      { week: 8, deadline: "2026-09-12T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 98-101", requirements: [{ surah: "Al-Baqarah", ayatStart: 98, ayatEnd: 101 }] },
      { week: 9, deadline: "2026-09-19T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 102", requirements: [{ surah: "Al-Baqarah", ayatStart: 102, ayatEnd: 102 }] },
      { week: 10, deadline: "2026-09-26T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 103-105", requirements: [{ surah: "Al-Baqarah", ayatStart: 103, ayatEnd: 105 }] },
      { week: 11, deadline: "2026-10-03T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 106-109", requirements: [{ surah: "Al-Baqarah", ayatStart: 106, ayatEnd: 109 }] },
      { week: 12, deadline: "2026-10-10T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 110-112", requirements: [{ surah: "Al-Baqarah", ayatStart: 110, ayatEnd: 112 }] },
      { week: 13, deadline: "2026-10-17T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 113-115", requirements: [{ surah: "Al-Baqarah", ayatStart: 113, ayatEnd: 115 }] },
      { week: 14, deadline: "2026-10-24T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 116-119", requirements: [{ surah: "Al-Baqarah", ayatStart: 116, ayatEnd: 119 }] },
      { week: 15, deadline: "2026-10-31T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 120-123", requirements: [{ surah: "Al-Baqarah", ayatStart: 120, ayatEnd: 123 }] },
      { week: 16, deadline: "2026-11-07T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 124-126", requirements: [{ surah: "Al-Baqarah", ayatStart: 124, ayatEnd: 126 }] },
      { week: 17, deadline: "2026-11-14T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 127-130", requirements: [{ surah: "Al-Baqarah", ayatStart: 127, ayatEnd: 130 }] },
      { week: 18, deadline: "2026-11-21T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 131-134", requirements: [{ surah: "Al-Baqarah", ayatStart: 131, ayatEnd: 134 }] },
      { week: 19, deadline: "2026-11-28T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 135-137", requirements: [{ surah: "Al-Baqarah", ayatStart: 135, ayatEnd: 137 }] },
      { week: 20, deadline: "2026-12-05T23:59:59+07:00", score: 4, type: "Ziyadah", targetLabel: "Al-Baqarah: 138-141", requirements: [{ surah: "Al-Baqarah", ayatStart: 138, ayatEnd: 141 }] },
      { week: 21, deadline: "2026-12-12T23:59:59+07:00", score: 20, type: "Mutqin", juz: 1, targetLabel: "Al-Baqarah: 77-141 (Mutqin)", requirements: [{ surah: "Al-Baqarah", ayatStart: 77, ayatEnd: 141 }] },
      { week: 22, deadline: "2027-01-16T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Baqarah: 77-85", requirements: [{ surah: "Al-Baqarah", ayatStart: 77, ayatEnd: 85 }] },
      { week: 23, deadline: "2027-01-23T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Baqarah: 86-93", requirements: [{ surah: "Al-Baqarah", ayatStart: 86, ayatEnd: 93 }] },
      { week: 24, deadline: "2027-01-30T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Baqarah: 94-102", requirements: [{ surah: "Al-Baqarah", ayatStart: 94, ayatEnd: 102 }] },
      { week: 25, deadline: "2027-02-06T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Baqarah: 103-112", requirements: [{ surah: "Al-Baqarah", ayatStart: 103, ayatEnd: 112 }] },
      { week: 26, deadline: "2027-02-13T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Baqarah: 113-123", requirements: [{ surah: "Al-Baqarah", ayatStart: 113, ayatEnd: 123 }] },
      { week: 27, deadline: "2027-02-20T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Baqarah: 124-134", requirements: [{ surah: "Al-Baqarah", ayatStart: 124, ayatEnd: 134 }] },
      { week: 28, deadline: "2027-02-27T23:59:59+07:00", score: 0, type: "Murajaah", targetLabel: "Murajaah dan Tahsin Al-Baqarah: 135-141", requirements: [{ surah: "Al-Baqarah", ayatStart: 135, ayatEnd: 141 }] },
      { week: 29, deadline: "2027-04-03T23:59:59+07:00", score: 0, type: "Mutqin", juz: 1, targetLabel: "Mutqin Al-Baqarah: 77-141", requirements: [{ surah: "Al-Baqarah", ayatStart: 77, ayatEnd: 141 }] },
      { week: 30, deadline: "2027-04-10T23:59:59+07:00", score: 0, type: "Agenda", targetLabel: "Belum ditentukan" },
      { week: 31, deadline: "2027-04-17T23:59:59+07:00", score: 0, type: "Agenda", targetLabel: "Belum ditentukan" },
      { week: 32, deadline: "2027-04-24T23:59:59+07:00", score: 0, type: "Agenda", targetLabel: "Belum ditentukan" },
      { week: 33, deadline: "2027-05-08T23:59:59+07:00", score: 0, type: "Agenda", targetLabel: "Belum ditentukan" },
      { week: 34, deadline: "2027-05-22T23:59:59+07:00", score: 0, type: "Agenda", targetLabel: "Belum ditentukan" }
    ]
  },

  // Mode dummy hanya bisa aktif jika debug atau query `?debug=true`.
  allowDummyMode: false,
};

// Kalender Kelas 5 mengikuti tahun ajaran 2026/2027 seperti kelas lainnya.
[
  "2026-07-25", "2026-08-01", "2026-08-08", "2026-08-15", "2026-08-22", "2026-08-29",
  "2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26", "2026-10-03", "2026-10-10",
  "2026-10-17", "2026-10-24", "2026-10-31", "2026-11-07", "2026-11-14", "2026-11-21",
  "2026-11-28", "2026-12-05", "2026-12-12", "2027-01-16", "2027-01-23", "2027-01-30",
  "2027-02-06", "2027-02-13", "2027-02-20", "2027-02-27", "2027-04-03", "2027-04-10",
  "2027-04-17", "2027-04-24", "2027-05-08", "2027-05-22"
].forEach((date, index) => {
  const target = window.APP_TAHFIZH_CONFIG.weeklyTargetsByGrade?.["5"]?.[index];
  if (target) target.deadline = `${date}T23:59:59+07:00`;
});

// ==========================================
// LOCAL STORAGE CONFIGURATION
// ==========================================
window.APP_STORAGE = {
  // Storage version for future migrations
  version: 3,

  // Business data is cloud-authoritative. IndexedDB/LocalStorage are caches
  // and temporary mutation queues only.
  mode: 'cloud-only',
  cloudOnly: true,

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
