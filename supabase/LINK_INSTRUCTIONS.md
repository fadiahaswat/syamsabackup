# Cara Push Migrations ke Supabase

## Opsi 1: Via Supabase Dashboard (Paling Mudah)

1. Buka https://supabase.com/dashboard
2. Pilih project Anda: **ilrpgbrqlfpzvxxbhuhk**
3. Buka **SQL Editor** di menu kiri
4. Copy isi file `supabase/migrations/combined_001_to_006.sql` dan paste
5. Klik **Run** (atau Ctrl+Enter)

---

## Opsi 2: Via Supabase CLI

Buka terminal baru (Command Prompt atau PowerShell) dan jalankan:

```bash
# 1. Login ke Supabase
supabase login

# 2. Masuk ke folder project
cd d:\syamsa-backup\syamsabackup

# 3. Link project
supabase link --project-ref ilrpgbrqlfpzvxxbhuhk

# 4. Push migrations
supabase db push
```

---

## Opsi 3: Reset Database (Hapus semua dan buat ulang)

```bash
cd d:\syamsa-backup\syamsabackup
supabase db reset --project-ref ilrpgbrqlfpzvxxbhuhk
```

---

## Checklist Setup Supabase

### 1. Enable Google OAuth Provider (Jika belum)

1. Buka **Authentication** > **Providers** > **Google**
2. Aktifkan Google provider
3. Masukkan:
   - **Google Client ID**: (dari Google Cloud Console)
   - **Google Client Secret**: (dari Google Cloud Console)
4. **Authorized Redirect URI**: `https://ilrpgbrqlfpzvxxbhuhk.supabase.co/auth/v1/callback`

### 2. Enable Realtime (Jika belum)

1. Buka **Database** > **Replication**
2. Pastikan publication `supabase_realtime` ada
3. Add tables yang diperlukan:
   - `permit`
   - `attendance_record`
   - `notifications`
   - `announcements`
   - `wali_password`
   - `tahfizh_record`

### 3. Create Storage Bucket (Optional)

1. Buka **Storage** di menu kiri
2. Klik **New Bucket**
3. Name: `permit-documents`
4. Set as **Private**
5. Allowed MIME types: `image/jpeg, image/png, image/webp, application/pdf`
6. Max file size: `5MB` (5242880 bytes)

---

## Struktur Database

| Table | Purpose |
|-------|---------|
| `musyrif` | Akun musyrif/guru dengan Google OAuth |
| `kelas` | Data kelas (multi-tenant dengan musyrif_email array) |
| `student` | Data santri dengan relasi ke kelas |
| `attendance_record` | Data absensi dengan JSONB status |
| `permit` | Data izin sakit/izin/pulang |
| `tahfizh_record` | Record hafalan Al-Quran |
| `notifications` | In-app notifications |
| `user_settings` | Pengaturan pengguna |
| `activity_log` | Log aktivitas audit |
| `sync_metadata` | Metadata sinkronisasi |
| `admin_emails` | Email admin dengan bypass RLS |
| `announcements` | Pengumuman sistem |
| `wali_password` | Password untuk akses Wali |

---

## Row Level Security (RLS) Policies

| Table | Policies |
|-------|----------|
| `musyrif` | User dapat melihat/mengubah profil sendiri |
| `kelas` | Musyrif dapat akses kelas yang emailnya ada di musyrif_email |
| `student` | Musyrif dapat akses santri di kelasnya |
| `attendance_record` | Musyrif dapat CRUD absensi di kelasnya |
| `permit` | Musyrif CRUD di kelasnya, Wali ANON dapat SELECT/INSERT/UPDATE |
| `notifications` | Semua user dapat SELECT/INSERT/UPDATE |
| `tahfizh_record` | Semua user dapat SELECT/INSERT/UPDATE |
| Admin tables | Admin email bypass untuk full CRUD |

---

## Konfigurasi Aplikasi

File `config/config.js` sudah dikonfigurasi dengan:

```javascript
window.APP_STORAGE = {
  mode: 'cloud-only',
  supabase: {
    url: 'https://ilrpgbrqlfpzvxxbhuhk.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlscnBnYnJxbGZwenZ4eGJodWhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMDc4MTQsImV4cCI6MjA5Nzg4MzgxNH0.75g3TvrYcRx9CEPB0C8HNadc-zwQPVKuUVOFS-tCLrg',
  },
};
```
