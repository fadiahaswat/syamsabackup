# 🚀 Panduan Setup Database Supabase - Syamsa PWA

Ikuti langkah-langkah berikut untuk mengatur database Supabase Anda agar PWA dapat melakukan sinkronisasi realtime secara cloud-local (offline-first).

---

## Langkah 1: Buat Proyek Supabase
1. Masuk ke [Supabase Dashboard](https://supabase.com/).
2. Klik **New Project** dan pilih Organization Anda.
3. Masukkan nama proyek (misal: `syamsa-database`), tentukan password database, dan pilih region terdekat (misal: `Singapore`).
4. Tunggu proyek Anda selesai dideploy (~1-2 menit).

---

## Langkah 2: Jalankan Schema SQL
1. Di dashboard Supabase proyek Anda, masuk ke menu **SQL Editor** (ikon terminal `SQL` di sidebar kiri).
2. Klik **New Query**.
3. Buka file `supabase/schema.sql` di editor lokal Anda, salin seluruh isinya (Ctrl+A -> Ctrl+C).
4. Tempel (Ctrl+V) ke dalam editor SQL Supabase.
5. Klik **Run** (tombol di kanan bawah editor).
6. Pastikan output menyatakan `Success. No rows returned` yang berarti semua tabel dan index telah sukses dibuat.

---

## Langkah 3: Aktifkan Realtime Replication
*Langkah ini penting agar data terupdate secara realtime otomatis di HP Musyrif lain saat ada perubahan.*
1. Masuk ke menu **Database** (ikon silinder/database di sidebar kiri).
2. Pilih sub-menu **Replication**.
3. Di bawah tabel **Publications**, cari publikasi bernama `supabase_realtime` (jika belum ada, klik **Create publication** dengan nama `supabase_realtime`).
4. Klik tombol di kolom **Source** / **Tables** untuk mengaktifkan replication pada tabel-tabel berikut:
   - `attendances`
   - `permits`
   - `tahfizh`
   - `settings`
5. *(Catatan: Di schema.sql di atas, perintah `ALTER PUBLICATION supabase_realtime ADD TABLE ...` sudah dijalankan secara otomatis. Di sini Anda hanya perlu memastikan statusnya aktif (toggle warna hijau/active) pada tabel-tabel di atas).*

---

## Langkah 4: Ambil API Credentials & Hubungkan ke Aplikasi
1. Pergi ke menu **Project Settings** (ikon gerigi di sidebar kiri bawah).
2. Pilih **API**.
3. Salin nilai dari:
   - **Project URL** (misal: `https://xxxxxx.supabase.co`)
   - **anon / public** API Key (token enkripsi panjang)
4. Buat file `src/config/config.local.js` di dalam direktori proyek Anda (jika belum ada).
5. Tempelkan kredensial tersebut ke dalam konfig sebagai berikut:

```javascript
// File: src/config/config.local.js
window.APP_SECRETS = {
  // Masukkan kredensial Supabase Anda di sini
  supabaseUrl: "https://your-project-id.supabase.co",
  supabaseAnonKey: "your-anon-public-key-here",
  
  // Tetap simpan URL google script untuk load data santri
  googleSheetUrl: "https://script.google.com/macros/s/AKfycbw-...",
  googleClientId: "your-client-id.apps.googleusercontent.com",
  adminEmails: ["admin@yourdomain.com"]
};
```

---

## Langkah 5: Muat Konfigurasi Default di Database Settings
Untuk memindahkan konfigurasi yang sebelumnya hardcoded di aplikasi (seperti GPS Geofencing koordinat, batas hari edit presensi, deadline tahfizh) agar tersimpan di database:
1. Masuk ke menu **Table Editor** (ikon tabel di sidebar kiri).
2. Pilih tabel **settings**.
3. Klik **Insert row**.
4. Isi kolom sebagai berikut:
   - `id`: `app_config`
   - `data`: (Masukkan JSON konfigurasi aplikasi Anda, contoh di bawah ini)
   - `_version`: `1`
5. Contoh isi JSON kolom `data`:

```json
{
  "gps": {
    "useGeofencing": true,
    "maxRadiusMeters": 50,
    "defaultPrayerLocation": {
      "lat": -7.807757,
      "lng": 110.350915,
      "label": "Wirobrajan, Yogyakarta"
    },
    "geofenceLocations": [
      {
        "name": "Masjid Jami' Mu'allimin",
        "lat": -7.8077573,
        "lng": 110.3509153
      },
      {
        "name": "Aula Asrama 10",
        "lat": -7.8076454,
        "lng": 110.3518028
      }
    ]
  },
  "limits": {
    "maxEditDaysBack": 3,
    "maxActivityLogEntries": 100
  },
  "tahfizh": {
    "deadlineJuz30Score": "2026-01-03T23:59:59",
    "deadlineTahfizhTuntas": "2026-06-27T12:30:00"
  }
}
```

6. Simpan baris tersebut. Sekarang aplikasi akan membaca konfigurasi ini langsung secara dinamis dari Supabase!
