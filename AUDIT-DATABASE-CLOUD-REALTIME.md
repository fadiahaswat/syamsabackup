# Audit Database Cloud & Realtime

Tanggal audit: 16 Juli 2026  
Ruang lingkup: source code aplikasi, schema/migration Supabase, konfigurasi deployment, dan pemeriksaan read-only REST API Supabase.

## Status remediasi repository

Status kode per 16 Juli 2026: **SELESAI DI REPOSITORY, MENUNGGU DEPLOYMENT CLOUD**.

Temuan di bawah adalah baseline sebelum perbaikan. Remediasi sudah ditambahkan
melalui migration `m004_cloud_first_hardening.sql`, satu coordinator sinkronisasi,
cloud domain bridge, Supabase Auth untuk Google/Wali, RLS berbasis role/kelas/NIS,
optimistic concurrency, Realtime seluruh domain, bucket dokumen private, serta
Edge Functions Wali. `config.local.js` juga sudah dikeluarkan dari pelacakan Git.

Status produksi belum dapat dinyatakan selesai sampai pemilik proyek menerapkan
migration, men-deploy Edge Functions, dan menjalankan `verify-cloud-first.sql`.
Panduan lengkap ada di `supabase/DEPLOY-CLOUD-FIRST.md`.

## Kesimpulan baseline sebelum perbaikan

Status: **BELUM MEMENUHI** target "cloud sebagai sumber data utama, lokal hanya pendukung, sinkron realtime antar-role dan antar-device".

Arsitektur aktif masih local-first/offline-first. IndexedDB menjadi sumber utama pada perangkat, LocalStorage masih menyimpan banyak data bisnis, lalu sebagian data dikirim ke Supabase. Realtime baru mencakup empat tabel dan kontrol role masih dilakukan terutama di client. Kondisi ini memungkinkan perbedaan data antarperangkat, data bisnis hanya ada pada satu browser, pembaruan realtime terlewat, serta akses data melampaui role yang semestinya.

## Verifikasi cloud saat audit

Supabase dapat dijangkau menggunakan konfigurasi aplikasi. Pemeriksaan read-only menghasilkan:

| Tabel | Record | Status API |
|---|---:|---|
| `attendances` | 92 | dapat dibaca |
| `permits` | 0 | dapat dibaca |
| `tahfizh` | 0 | dapat dibaca |
| `settings` | 2 | dapat dibaca |
| `activity_logs` | 0 | dapat dibaca |
| `musyrif_journals` | 0 | dapat dibaca |
| `users` | 0 | dapat dibaca |
| `roles` | 6 | dapat dibaca |
| `user_roles` | tidak dapat dihitung | HTTP 500 |
| `user_devices` | 0 | dapat dibaca |
| `sessions` | 0 | dapat dibaca |
| `sync_state` | 0 | dapat dibaca |

HTTP 500 pada `user_roles` konsisten dengan policy `user_roles_manage_admin` yang membaca `public.user_roles` dari policy pada tabel `public.user_roles` itu sendiri. Policy ini berisiko memicu rekursi RLS.

## Temuan kritis

### C-01 — Cloud bukan source of truth

`StorageManagerV2` secara eksplisit menetapkan IndexedDB sebagai primary storage. Data aplikasi dimuat dari IndexedDB ke `appState`, dan jika IndexedDB gagal aplikasi kembali ke LocalStorage. `manualSync()` bahkan memuat ulang dari LocalStorage, bukan dari cloud.

Dampak: data yang belum terkirim, gagal antre, atau dibuat lewat jalur lokal lain hanya terlihat pada perangkat tersebut. Perangkat baru tidak dijamin mendapatkan state yang sama.

### C-02 — Banyak domain bisnis masih hanya lokal

Selain cache teknis dan preferensi UI yang memang layak lokal, kode masih menyimpan data bisnis berikut di LocalStorage:

- pelanggaran/pembinaan (`musyrif_violations_db`, aturan pelanggaran, dokumen SP);
- target santri dan student logs;
- pengumuman;
- reminder;
- permohonan izin wali dan salinan izin;
- dokumen izin/base64;
- konfigurasi GPS dan kalender/libur kustom;
- log aktivitas lokal;
- setoran dan metadata tahfizh pada sejumlah jalur fallback;
- data presensi, izin, settings, dan tahfizh sebagai cache yang masih dapat menjadi fallback baca/tulis.

Sebagian besar domain tersebut tidak memiliki tabel cloud pada schema utama dan tidak masuk subscription realtime.

### C-03 — Bug versioning dapat menghentikan update realtime lanjutan

Saat record cloud diterima, `SupabaseSync` membandingkan `_version` cloud dengan versi lokal lalu memanggil `LocalDB.put()`. Namun `LocalDB.put()` selalu menaikkan `_version` lagi bila record memiliki `_createdAt`, termasuk saat `db.isSyncing = true`.

Contoh: cloud versi 2 diterapkan menjadi lokal versi 3. Ketika cloud kemudian menjadi versi 3, kondisi `cloud 3 > lokal 3` bernilai salah sehingga update diabaikan. Pola ini berlaku pada inbound awal dan handler realtime.

### C-04 — Otorisasi role tidak ditegakkan di database

Schema utama memberi role `anon` akses `FOR ALL ... USING (true)` pada data presensi, izin, tahfizh, settings, log, dan jurnal. Migration multirole juga banyak memakai `USING (true)`. Filtering kelas/NIS dilakukan di JavaScript.

Karena anon key berada di client, siapa pun yang memiliki aplikasi dapat memanggil REST API langsung dan melewati filter UI. Ini bukan RLS berbasis user/role yang aman.

### C-05 — `user_roles` rusak di deployment aktif

Endpoint `user_roles` mengembalikan HTTP 500 saat audit. Tanpa tabel assignment role yang dapat dibaca dengan benar, role cloud tidak dapat menjadi dasar akses konsisten antarperangkat.

### C-06 — File konfigurasi deployment terlacak Git

`src/config/config.local.js` terlacak dalam repository dan berisi konfigurasi deployment. Ini bertentangan dengan komentar file dan pedoman proyek yang menyatakan file lokal/credential tidak boleh di-commit. `.gitignore` belum mengecualikan file tersebut.

Anon key memang dirancang untuk berada di client, tetapi tetap hanya aman jika RLS benar. Dalam kondisi RLS saat ini yang terbuka, kebocoran konfigurasi memperbesar risiko akses langsung ke seluruh data.

## Temuan tinggi

### H-01 — Realtime tidak mencakup semua tabel

Client hanya subscribe ke `attendances`, `permits`, `tahfizh`, dan `settings`. `activity_logs` serta `musyrif_journals` sudah dimasukkan publication pada schema, tetapi tidak disubscribe client. Tabel multirole/multidevice juga tidak memiliki alur realtime client untuk perubahan role, pencabutan sesi, atau perubahan device.

### H-02 — Filter realtime wali tidak berbasis anak/NIS

Handler realtime hanya menyaring berdasarkan `record.kelas` bagi non-admin. Wali berpotensi menerima seluruh record satu kelas ke penyimpanan browser, bukan hanya data anaknya. RLS server juga tidak membatasi NIS wali.

### H-03 — Konflik antarperangkat tidak aman

Outbound menggunakan `upsert` tanpa kondisi versi (`WHERE version = expected_version`) atau RPC transaksional. Dua perangkat dapat menimpa record yang sama; yang terakhir sampai menang. Infrastruktur conflict queue tersedia lokal, tetapi alur outbound tidak melakukan deteksi konflik server-side yang atomik.

### H-04 — Schema cloud tidak menampung seluruh payload bisnis

Whitelist outbound membuang field yang tidak terdapat di schema. Contoh pada izin: lokasi, penjemput, kendaraan, surat dokter, approval metadata, dan sejumlah status tambahan dibuat oleh repository lokal tetapi tidak semuanya masuk whitelist/schema cloud. Pada tahfizh, nama santri, row number, verification metadata, dan rejection metadata juga tidak seluruhnya terkirim.

Akibatnya record cloud bukan representasi lengkap record pada perangkat.

### H-05 — Dua mesin sinkronisasi dengan perilaku berbeda

`sync-manager.js` dan `supabase-sync.js` sama-sama dimuat. Storage menginisialisasi `supabaseSync`, sedangkan UI status masih merujuk sebagian ke `syncManager`. Keduanya memiliki daftar tabel, filter role, interval, dan status berbeda. Ini meningkatkan risiko indikator "tersinkron" tidak menggambarkan kondisi sebenarnya.

### H-06 — Background Sync memakai versi IndexedDB yang salah

Aplikasi membuka `musyrif_local_db` versi 2, sedangkan service worker membukanya sebagai versi 1. Membuka IndexedDB dengan versi lebih rendah dapat menghasilkan `VersionError`, sehingga antrean background sync tidak dapat diandalkan.

### H-07 — Mode offline read-only belum ditegakkan

UI memiliki banner "data hanya dapat dilihat", tetapi banyak fungsi simpan tetap menulis ke LocalStorage/IndexedDB saat offline. Tidak ditemukan guard terpusat yang menolak seluruh mutasi bisnis ketika cloud tidak tersedia.

## Penyimpanan lokal yang masih layak

Lokal dapat dipertahankan hanya untuk data pendukung berikut, tanpa menjadi sumber kebenaran:

- cache aset PWA/service worker;
- cache read-only data santri/kelas dengan TTL dan invalidasi;
- preferensi UI seperti tema, tab terakhir, dan role tampilan;
- device ID non-rahasia;
- cache GPS sementara dan status permission;
- antrean mutasi sementara bila produk tetap mengizinkan input offline, dengan status pending yang jelas dan idempotency key.

Session/token sebaiknya dikelola Supabase Auth, bukan session buatan sendiri yang dapat diakses lewat anon API.

## Arsitektur target

1. Semua data bisnis ditulis langsung ke Supabase melalui tabel/RPC yang memiliki validasi dan RLS.
2. UI melakukan optimistic update di memori; cache lokal hanya salinan read-only atau antrean sementara.
3. Setiap domain bisnis memiliki tabel cloud, `updated_at`, `updated_by`, revision/version server-side, dan audit trail.
4. Realtime subscription mengikuti scope yang diizinkan RLS: admin seluruh data, musyrif kelas yang ditugaskan, wali hanya anak yang terhubung.
5. Konflik memakai optimistic concurrency server-side atau RPC transaksional, bukan perbandingan versi lokal saja.
6. Perubahan role, device, dan pencabutan session berasal dari Supabase Auth/RLS dan dipantau realtime atau divalidasi ulang berkala.
7. Saat offline, pilihan produk harus eksplisit: benar-benar read-only, atau mutation queue terbatas yang tidak dianggap tersimpan sampai server mengakui.

## Urutan perbaikan yang disarankan

### Fase 0 — Pengamanan segera

1. Perbaiki RLS `user_roles` yang rekursif.
2. Ganti policy anon terbuka dengan policy berbasis `auth.uid()` dan relasi role/kelas/anak.
3. Keluarkan `config.local.js` dari Git, tambahkan ke `.gitignore`, dan rotasi credential yang perlu dirotasi.
4. Nonaktifkan mutasi UI bila sesi cloud tidak valid.

### Fase 1 — Benahi fondasi sinkronisasi

1. Jadikan Supabase repository sebagai jalur CRUD utama.
2. Perbaiki penerapan inbound agar mempertahankan versi server, bukan menaikkannya.
3. Satukan dua sync manager menjadi satu coordinator.
4. Selaraskan versi IndexedDB aplikasi dan service worker.
5. Tambahkan ack/error yang nyata; status hijau hanya setelah server mengonfirmasi.

### Fase 2 — Migrasi seluruh domain bisnis

Buat tabel dan migrasikan pelanggaran, pembinaan/SP, target santri, student logs, announcements, reminders, permit requests, file metadata/object storage, holiday schedule, notifications, dan konfigurasi operasional lain. Setelah backfill tervalidasi, hapus fallback tulis/baca data bisnis dari LocalStorage.

### Fase 3 — Realtime lintas role/device

1. Subscribe semua domain yang perlu live update.
2. Terapkan filter server-side sesuai assignment role.
3. Refresh atau invalidate view setiap event insert/update/delete.
4. Tambahkan realtime untuk role/session/device atau validasi session berkala.
5. Uji minimal dua role dan dua device secara bersamaan.

## Kriteria selesai

- Device baru setelah login menampilkan state yang sama tanpa import cache/backup lokal.
- Mutasi dari Device A terlihat di Device B dan role terkait dalam target maksimal 2 detik.
- Wali tidak dapat membaca NIS lain melalui UI maupun REST API langsung.
- Musyrif tidak dapat membaca/menulis kelas yang tidak ditugaskan.
- Konflik edit bersamaan menghasilkan hasil deterministik atau pesan konflik, bukan silent overwrite.
- Menghapus LocalStorage/IndexedDB lalu reload tidak menghilangkan data bisnis.
- Memutus internet membuat seluruh mutasi bisnis ditolak, atau masuk antrean eksplisit yang belum dianggap sukses.
- Seluruh tabel cloud memiliki RLS test untuk admin, musyrif, wali, anonymous, dan user tanpa role.
- Tidak ada credential deployment yang terlacak Git.

## Batas audit

Audit tidak melakukan perubahan schema atau data cloud. Pemeriksaan deployment dilakukan read-only melalui REST API dengan anon credential aplikasi. Metadata publication/realtime internal tidak dapat dibaca melalui anon API; status publication dinilai dari SQL repository dan perilaku client, sehingga perlu diverifikasi lagi menggunakan akses dashboard/service role saat implementasi.
