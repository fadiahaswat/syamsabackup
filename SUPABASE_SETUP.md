# Supabase Cloud Storage Setup Guide

Panduan untuk mengaktifkan cloud storage menggunakan Supabase.

## Prerequisites

1. Akun Supabase (gratis di https://supabase.com)
2. Project Supabase baru

---

## Step 1: Buat Project Supabase

1. Kunjungi https://supabase.com
2. Klik "Start your project"
3. Buat project baru dengan nama misalnya "syamsa-attendance"
4. Simpan **Project URL** dan **anon/public key** dari Settings > API

---

## Step 2: Enable Google OAuth

1. Buka Supabase Dashboard > Authentication > Providers
2. Aktifkan Google provider
3. Masukkan Google OAuth Client ID dan Client Secret
4. Callback URL: `https://[your-project].supabase.co/auth/v1/callback`

---

## Step 3: Run Database Migrations

1. Buka Supabase Dashboard > SQL Editor
2. Copy isi file `supabase/migrations/001_initial_schema.sql`
3. Paste dan execute

### Untuk Storage Bucket:

1. Buka Supabase Dashboard > Storage
2. Create New Bucket:
   - Name: `permit-documents`
   - Set as Private (not public)
3. Setelah bucket dibuat, execute SQL berikut di SQL Editor:

```sql
-- Policy: Users can upload their own documents
CREATE POLICY "musyrif_upload_own_documents"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'permit-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own documents
CREATE POLICY "musyrif_view_own_documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'permit-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own documents
CREATE POLICY "musyrif_delete_own_documents"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'permit-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
```

---

## Step 4: Configure Application

Edit file `config/config.js`:

```javascript
window.APP_STORAGE = {
  mode: 'hybrid', // Aktifkan hybrid mode

  supabase: {
    url: 'https://xxxxx.supabase.co', // Ganti dengan URL project Anda
    anonKey: 'eyJhbGciOiJIUzI1NiIs...', // Ganti dengan anon key Anda
  },

  sync: {
    autoSync: true,
    syncInterval: 30000,
    conflictResolution: 'server-wins',
  },
};
```

---

## Step 5: Seed Initial Data (Opsional)

Jika Anda ingin migrasi data dari LocalStorage ke Supabase:

1. Buka browser (dev mode)
2. Buka DevTools > Console
3. Jalankan script migrasi:

```javascript
// Contoh migrasi data attendance
async function migrateData() {
  const attendanceData = JSON.parse(localStorage.getItem('musyrif_app_v5_fix'));
  const permits = JSON.parse(localStorage.getItem('musyrif_permits_db'));

  console.log('Attendance records:', Object.keys(attendanceData || {}).length);
  console.log('Permits:', permits?.length || 0);

  // Lanjutkan dengan upload ke Supabase...
}
migrateData();
```

---

## Storage Modes

### Mode `local-only` (Default)
- Semua data tersimpan di LocalStorage browser
- Tidak ada sinkronisasi cloud
- Cocok untuk development atau penggunaan offline

### Mode `hybrid` (Recommended)
- Data tersimpan di LocalStorage (offline-first)
- Perubahan di-sync ke Supabase saat online
- Sinkronisasi otomatis setiap 30 detik
- Multi-device sync tersedia

### Mode `cloud-primary`
- Cloud sebagai sumber data utama
- LocalStorage sebagai cache offline
- Cocok untuk koneksi internet stabil

---

## Troubleshooting

### Error: "Supabase client not initialized"
- Pastikan URL dan anon key benar di config
- Pastikan Supabase project aktif

### Error: "Access denied" pada storage
- Cek RLS policies sudah di-set dengan benar
- Pastikan user sudah login dengan Google

### Data tidak sync
- Cek koneksi internet
- Cek apakah mode hybrid sudah aktif
- Buka DevTools > Console untuk melihat log sync

### Conflict resolution
- Default: `server-wins` (data server overwrite local)
- Untuk `client-wins`, ubah di config
- Untuk manual resolution, perlu UI tambahan

---

## File Structure

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql   # Database tables
│   ├── 002_storage_buckets.sql  # Storage bucket config
│   ├── 003_permit_rls_wali.sql   # Alter permit table & anonymous RLS policies
│   ├── 004_add_notifications_table.sql # Notifications table & RLS policies
│   └── 005_fix_notification_rls.sql    # Fix notifications RLS for authenticated users

managers/
├── supabase-client.js           # Supabase client wrapper
├── sync-queue.js                # IndexedDB sync queue
├── hybrid-storage-manager.js     # Main storage orchestrator
├── file-upload.js               # Document upload handler
└── notification-manager.js      # Notification manager (in-app + push)
```

---

## Security Notes

1. **RLS (Row Level Security)** sudah dikonfigurasi untuk multi-tenant
2. Setiap musyrif hanya bisa akses data kelas mereka sendiri
3. Document uploads terikat dengan user ID
4. Jangan expose service role key di client-side code
