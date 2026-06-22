# Cara Push Migrations ke Supabase

## Opsi 1: Via Supabase Dashboard (Paling Mudah)

1. Buka https://supabase.com/dashboard
2. Pilih project Anda: **ioyqnmvrnpzdztpkgaxt**
3. Buka **SQL Editor** di menu kiri
4. Copy isi file `supabase/migrations/001_initial_schema.sql` dan paste
5. Klik **Run** (atau Ctrl+Enter)

Lakukan hal yang sama untuk `supabase/migrations/002_storage_buckets.sql`.

---

## Opsi 2: Via Supabase CLI

Buka terminal baru (Command Prompt atau PowerShell) dan jalankan:

```bash
# 1. Login ke Supabase
supabase login

# 2. Masuk ke folder project
cd d:\syamsa-backup\syamsabackup

# 3. Link project
supabase link --project-ref ioyqnmvrnpzdztpkgaxt
# Masukkan password database: FREVaF5

# 4. Push migrations
supabase db push
```

---

## Opsi 3: Generate SQL dari project lokal

```bash
cd d:\syamsa-backup\syamsabackup
supabase db reset --db-url postgresql://postgres:FREVaF5@db.ioyqnmvrnpzdztpkgaxt.supabase.co:5432/postgres
```

---

## Checklist Setup Supabase

### 1. Enable Google OAuth Provider

1. Buka **Authentication** > **Providers** > **Google**
2. Aktifkan Google provider
3. Masukkan:
   - **Google Client ID**: (dari Google Cloud Console)
   - **Google Client Secret**: (dari Google Cloud Console)
4. **Authorized Redirect URI**: `https://ioyqnmvrnpzdztpkgaxt.supabase.co/auth/v1/callback`

### 2. Enable Email Provider (untuk allow email login)

1. Buka **Authentication** > **Providers** > **Email**
2. Aktifkan jika belum aktif
3. Disable "Confirm email" untuk testing

---

## Update Config.js

Edit `config/config.js` dengan credentials Supabase Anda:

```javascript
window.APP_STORAGE = {
  mode: 'hybrid',
  supabase: {
    url: 'https://ioyqnmvrnpzdztpkgaxt.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlveXFubXZycG56ZHp0cGtnYXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MzI2NjAsImV4cCI6MjA2NTEwODY2MH0.sb_publishable_1ipdE1TbfNSTGCmz91vqDg_SFREVaF5',
  },
  // ...
};
```

---

## Struktur Database yang Akan Dibuat

| Table | Purpose |
|-------|---------|
| `musyrif` | Akun musyrif/guru |
| `kelas` | Data kelas (multi-tenant) |
| `student` | Data santri |
| `attendance_record` | Data absensi |
| `permit` | Data izin sakit/izin/pulang |
| `user_settings` | Pengaturan pengguna |
| `activity_log` | Log aktivitas |
| `sync_metadata` | Metadata sinkronisasi |
