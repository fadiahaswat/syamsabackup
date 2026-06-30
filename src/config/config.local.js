// File: config.local.js
// Konfigurasi deployment-specific (TIDAK di-commit ke repository)
// SALIN dari config.example.js dan sesuaikan nilainya

// ==========================================
// SEKRET KONFIGURASI
// ==========================================
// File ini di-load SEBELUM config.js untuk override nilai default

// Jika window.APP_SECRETS belum ada, buat baru
if (typeof window.APP_SECRETS === 'undefined') {
  window.APP_SECRETS = {};
}

// Set nilai-nilai default/placeholder (akan di-override oleh config.js)
// Kosongkan atau isi sesuai kebutuhan deployment Anda
window.APP_SECRETS.googleSheetUrl = "https://script.google.com/macros/s/AKfycbw-URYAsLTWCdnGurQhM1ZXa9N8vm-GBlHwtetDlin73-Ma8G0aAbFoboGGUI8GgVDl/exec";
window.APP_SECRETS.googleClientId = "336443539411-b7uv4udqqhbqpdmeuja54dhfsda4q7cm.apps.googleusercontent.com";
window.APP_SECRETS.adminEmails = ["andiaqillah@muallimin.sch.id"];
window.APP_SECRETS.superadminHash = null;
