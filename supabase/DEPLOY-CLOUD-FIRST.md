# Deploy cloud-first SYAMSA

Perubahan aplikasi sudah menempatkan Supabase sebagai sumber data utama. Cache
browser hanya dipakai untuk membantu UI dan antrean sementara. Langkah berikut
memerlukan akses pemilik proyek Supabase dan harus dijalankan berurutan.

## 1. Siapkan autentikasi

Aktifkan provider Google di **Authentication > Providers > Google**. Tambahkan
origin aplikasi dan callback Supabase ke konfigurasi OAuth Google.

Sebelum login pertama admin, buat undangan role melalui SQL Editor (ganti email):

```sql
INSERT INTO public.role_invitations (email, role_id, kelas)
VALUES ('admin@example.com', 'role_admin', NULL)
ON CONFLICT (email, role_id, kelas)
DO UPDATE SET is_active = true, expires_at = NULL;
```

Jika admin tersebut sudah ada di `public.users`, pastikan role-nya sudah aktif di
`public.user_roles`; undangan terutama dipakai untuk akun baru.

## 2. Terapkan migration

Jalankan `m003_add_multirole_multidevice.sql` bila belum pernah diterapkan, lalu
jalankan `m004_cloud_first_hardening.sql`. Migration m004 memperbaiki RLS
rekursif, mengikat user ke Supabase Auth, mengaktifkan Realtime, membuat bucket
private, menambah optimistic versioning, dan mencabut akses anonim data bisnis.

Dengan CLI yang sudah terhubung ke proyek:

```text
supabase db push
```

Atau tempel isi file migration ke SQL Editor. Jangan menjalankan file reset/drop.

## 3. Deploy Edge Functions

```text
supabase functions deploy wali-auth --project-ref PROJECT_REF
supabase functions deploy wali-register --project-ref PROJECT_REF
supabase functions deploy wali-admin --project-ref PROJECT_REF
```

Pengaturan JWT sudah dikunci di `supabase/config.toml`: login/registrasi Wali
dapat dipanggil sebelum ada sesi, sedangkan `wali-admin` wajib memakai verifikasi
JWT. Function admin mengelola
approval akun dan password wali melalui Supabase Auth; browser tidak lagi
menyimpan hash password.

## 4. Konfigurasi aplikasi

Salin `src/config/config.example.js` menjadi `src/config/config.local.js`, lalu isi
URL proyek, publishable/anon key, dan Google Client ID. Jangan pernah memasukkan
service-role key ke file browser. `config.local.js` sudah diabaikan Git.

Jika konfigurasi lama pernah dipublikasikan saat RLS masih permisif, rotasi key
lama dari dashboard setelah migration berhasil dan perbarui deployment aplikasi.

## 5. Verifikasi

Jalankan `verify-cloud-first.sql` di SQL Editor. Setelah itu uji minimal:

1. Login admin dan musyrif di dua perangkat.
2. Ubah satu presensi, izin, tahfizh, jurnal, dan pengumuman.
3. Pastikan perangkat kedua menerima perubahan tanpa reload.
4. Login wali dan pastikan hanya NIS yang terhubung yang terlihat.
5. Cabut satu sesi dari perangkat admin dan pastikan perangkat tersebut logout.
6. Unggah surat dokter dan pastikan URL yang tersimpan diawali `storage://`, bukan
   `data:`/base64.

Sebelum m004 dan ketiga function benar-benar terpasang, jangan menganggap
deployment produksi sudah aman atau realtime penuh.
