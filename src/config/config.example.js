// File: config.example.js
// TEMPLATE untuk konfigurasi deployment-specific.
// Salin file ini ke config.local.js dan sesuaikan nilainya.
//
//
// CARA MENGGUNAKAN:
// 1. Buat salinan file ini dengan nama 'config.local.js'
// 2. Edit nilai-nilai di config.local.js sesuai kebutuhan deployment Anda
// 3. Pastikan config.local.js di-load SETELAH config.js
// 4. Hapus/seuestikan baris secrets sensitif dari repository
//
//
// KREDENSIAL YANG PERLU DIKONFIGURASI:
//
// 1. Google Apps Script URL
//    - Deploy Google Apps Script sebagai web app
//    - Set 'Who has access' ke 'Anyone' jika dari domain berbeda
const LOCAL_GOOGLE_SHEET_URL = "ISI_URL_GOOGLE_APPS_SCRIPT_ANDA_DISINI";
//
// 2. Google OAuth Client ID
//    - Buat project di Google Cloud Console
//    - Aktifkan Google+ API
//    - Buat OAuth 2.0 Client ID (Web Application)
const LOCAL_GOOGLE_CLIENT_ID = "ISI_CLIENT_ID_ANDA.apps.googleusercontent.com";
//
// 3. Admin Emails
//    - Daftar email yang bisa login sebagai Admin Musyrif
const LOCAL_ADMIN_EMAILS = [
  "email-admin-anda@domain.com"
];
//
// 4. Superadmin Password Hash (SHA-256)
//    - Hash password dengan: sha256("password_anda")
//    - Contoh: sha256("Rahasia2024") = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
const LOCAL_SUPERADMIN_HASH = "ISI_SUPERADMIN_HASH_SHA256_DISINI";

console.log('[Config] config.example.js loaded - copy to config.local.js for custom deployment');
