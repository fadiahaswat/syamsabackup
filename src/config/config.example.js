// Salin menjadi `config.local.js`. File lokal tersebut sengaja diabaikan Git.
// Kunci anon/publishable Supabase aman berada di browser hanya bila RLS aktif;
// jangan pernah menaruh service-role key di aplikasi web.
window.APP_SECRETS = {
  supabaseUrl: "https://PROJECT_ID.supabase.co",
  supabaseAnonKey: "SUPABASE_PUBLISHABLE_OR_ANON_KEY",
  googleClientId: "GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com",

  // Sumber referensi santri/kelas lama. Data bisnis aplikasi tetap disimpan di
  // Supabase dan LocalStorage/IndexedDB hanya menjadi cache pendukung.
  googleSheetUrl: "",
  tahfizhScriptUrl: "",

  // Hanya untuk tampilan/kompatibilitas. Otorisasi sebenarnya berasal dari
  // tabel user_roles + RLS Supabase.
  adminEmails: [],
  adminWhatsAppNumber: "",
};
