// File: config.local.js
// Konfigurasi deployment-specific (TIDAK di-commit ke repository)
// Salin dari config.example.js dan sesuaikan nilainya

// ==========================================
// SEKRET KONFIGURASI
// ==========================================
// PENTING: Isi nilai sebenarnya di bawah ini, atau kosongkan jika belum tersedia
// Nilai kosong akan menampilkan warning di console

window.APP_SECRETS = window.APP_SECRETS || {};

// Google Apps Script URL untuk backend
// Deploy Google Apps Script sebagai web app dengan akses "Anyone"
window.APP_SECRETS.googleSheetUrl = window.APP_SECRETS.googleSheetUrl || "";

// Google OAuth Client ID dari Google Cloud Console
window.APP_SECRETS.googleClientId = window.APP_SECRETS.googleClientId || "";

// Daftar email admin yang bisa login sebagai Admin Musyrif
window.APP_SECRETS.adminEmails = window.APP_SECRETS.adminEmails || [];

// Superadmin Password Hash (SHA-256) - opsional
// Generate dengan: btoa("password_anda") atau sha256 hash
window.APP_SECRETS.superadminHash = window.APP_SECRETS.superadminHash || null;

console.log('[Config] config.local.js loaded');
