# PRD Syamsa

## 1. Ringkasan Produk

Syamsa adalah aplikasi PWA untuk membantu pengelolaan operasional harian asrama dan sekolah berbasis santri. Aplikasi ini berfokus pada presensi kegiatan, pemantauan kondisi santri, perizinan, tahfizh, laporan, notifikasi, dan area pengelolaan untuk admin.

Produk ditujukan untuk mempersingkat pekerjaan musyrif, memberi wali santri visibilitas terhadap kondisi anak, dan menyediakan data operasional yang lebih rapi bagi pengelola.

## 2. Latar Belakang

Kegiatan asrama memiliki banyak titik pencatatan harian: shalat, sekolah, tahfizh, izin, sakit, pulang, pembinaan, dan laporan ke wali. Tanpa sistem terpusat, data rawan tersebar, terlambat, sulit diaudit, dan membutuhkan rekap manual.

Syamsa hadir sebagai aplikasi operasional yang bisa digunakan cepat dari ponsel, tetap nyaman di desktop, dan mendukung pola kerja harian musyrif maupun admin.

## 3. Tujuan Produk

- Mempercepat input presensi kelas oleh musyrif.
- Menyediakan status santri yang mudah dipantau oleh musyrif, wali, dan admin sesuai hak akses.
- Mengurangi pekerjaan rekap manual untuk presensi, izin, tahfizh, dan pembinaan.
- Membuat proses izin lebih tertib, terdokumentasi, dan dapat disetujui/ditolak.
- Memberikan notifikasi penting kepada wali dan musyrif.
- Menjadikan aplikasi dapat dipasang sebagai PWA dan tetap mendukung kebutuhan operasional harian.

## 4. Target Pengguna

### Musyrif

Pengguna utama harian. Membutuhkan input cepat, daftar santri per kelas, aksi massal, status otomatis dari izin, laporan masalah, dan riwayat aktivitas.

### Wali Santri

Pengguna pemantau. Membutuhkan informasi kondisi anak, presensi, tahfizh, pembinaan, izin aktif, riwayat, dan notifikasi status penting.

### Admin/Pengelola

Pengguna pengawasan lintas kelas. Membutuhkan monitoring, data sistem, pengelolaan akun/akses, audit, broadcast, laporan, dan operasi data.

## 5. Scope Produk

### In Scope

- Login berbasis kelas dan validasi akun.
- Mode role: musyrif, wali santri, dan admin.
- Dashboard operasional sesuai role.
- Presensi multi-sesi dan multi-kegiatan.
- Status kehadiran: Hadir, Alpa, Sakit, Izin, Pulang, Telat.
- Aksi massal presensi.
- Pembatasan waktu akses presensi.
- Dukungan geofencing jika diaktifkan.
- Perizinan sakit, izin kegiatan, dan pulang.
- Approval/rejection pengajuan izin.
- Lampiran dokumen izin.
- Riwayat dan audit trail izin.
- Modul tahfizh: input setoran, riwayat, rekap, analisis, ranking, dan status target.
- Laporan dan analisis presensi.
- Profil santri dan ringkasan aktivitas.
- Notifikasi lokal/in-app.
- PWA installable, manifest, service worker, dan update handling.
- Admin area untuk pengelolaan izin, tahfizh, operasi, logs, HR, dan broadcast.

### Out of Scope Saat Ini

- Backend penuh dengan autentikasi server-side yang matang.
- Integrasi pembayaran.
- Chat real-time.
- Mobile native app terpisah.
- Integrasi perangkat biometrik.
- Sistem akademik penuh di luar kebutuhan operasional asrama.

## 6. User Stories

### Musyrif

- Sebagai musyrif, saya ingin memilih kelas binaan agar hanya melihat santri kelas saya.
- Sebagai musyrif, saya ingin menandai semua santri hadir lalu mengubah pengecualian agar presensi cepat selesai.
- Sebagai musyrif, saya ingin status izin/sakit otomatis memengaruhi presensi agar tidak input ganda.
- Sebagai musyrif, saya ingin melihat santri bermasalah agar bisa segera menindaklanjuti.
- Sebagai musyrif, saya ingin menginput setoran tahfizh agar progres hafalan santri tercatat.
- Sebagai musyrif, saya ingin menyetujui atau menolak izin agar data izin resmi dan terlacak.

### Wali Santri

- Sebagai wali, saya ingin melihat kondisi anak hari ini agar tahu status terbaru.
- Sebagai wali, saya ingin melihat riwayat kehadiran dan tahfizh anak agar perkembangan anak mudah dipantau.
- Sebagai wali, saya ingin mengajukan izin dan melihat statusnya agar komunikasi dengan musyrif lebih tertib.
- Sebagai wali, saya ingin mendapat notifikasi jika anak alpa, sakit, telat, atau izin diproses.

### Admin

- Sebagai admin, saya ingin memantau data lintas kelas agar kondisi asrama terlihat menyeluruh.
- Sebagai admin, saya ingin melihat log aktivitas agar perubahan penting dapat diaudit.
- Sebagai admin, saya ingin mengelola broadcast agar informasi penting bisa disebarkan.
- Sebagai admin, saya ingin melihat data izin dan tahfizh lintas kelas agar pengawasan lebih mudah.

## 7. Requirement Fungsional

### 7.1 Autentikasi dan Role

- Aplikasi harus menyediakan login berbasis kelas.
- Aplikasi harus mendukung Google OAuth pada mode produksi.
- Aplikasi harus memiliki mode testing untuk kebutuhan development/demo.
- Aplikasi harus memisahkan tampilan dan akses berdasarkan role musyrif, wali, dan admin.
- Musyrif hanya boleh memproses data kelas binaannya kecuali pengguna admin.

### 7.2 Dashboard

- Dashboard harus menampilkan ringkasan kegiatan hari ini.
- Dashboard musyrif harus menonjolkan aksi presensi, status santri, izin aktif, pembinaan, dan perhatian khusus.
- Dashboard wali harus menonjolkan status anak, tahfizh terakhir, izin aktif, pembinaan, dan laporan.
- Dashboard admin harus mendukung monitoring lintas kelas dan akses ke area pengelolaan.

### 7.3 Presensi

- Aplikasi harus menyediakan presensi berdasarkan tanggal dan sesi.
- Sesi minimal meliputi shubuh, sekolah, ashar, maghrib, dan isya sesuai konfigurasi.
- Setiap sesi dapat memiliki beberapa aktivitas, seperti shalat, dzikir/rawatib, sekolah, KBM, dan ibadah sunnah.
- Default presensi harus memudahkan pola "semua hadir, ubah pengecualian".
- Aplikasi harus mendukung pencarian santri.
- Aplikasi harus mendukung filter santri bermasalah.
- Aplikasi harus mendukung aksi massal.
- Aplikasi harus menyimpan timestamp dan audit trail perubahan status.
- Aplikasi harus membatasi akses data masa depan dan data lampau sesuai aturan.
- Jika geofencing aktif, aplikasi harus memverifikasi lokasi sebelum presensi dibuka.

### 7.4 Perizinan

- Aplikasi harus mendukung kategori sakit, izin, dan pulang.
- Musyrif/admin dapat membuat, mengubah, menghapus, memperpanjang, menandai sembuh, dan menandai kembali.
- Wali dapat mengajukan izin sesuai mode wali.
- Pengajuan izin harus memiliki status pending, approved, atau rejected.
- Izin aktif harus otomatis memengaruhi status presensi.
- Izin terlambat kembali harus dapat berubah menjadi status alpa pada sesi yang relevan.
- Aplikasi harus mendukung lampiran foto/PDF.
- Setiap perubahan izin harus memiliki audit trail.
- Wali harus menerima notifikasi ketika izin disetujui atau ditolak.

### 7.5 Tahfizh

- Musyrif dapat mencatat setoran tahfizh.
- Data setoran harus mencakup tanggal, musyrif, santri, kelas, jenis setoran, juz, surat/halaman, dan status.
- Jenis setoran minimal meliputi Ziyadah, Murajaah, dan Mutqin.
- Aplikasi harus menampilkan riwayat setoran dengan pencarian dan filter.
- Aplikasi harus menampilkan rekap per kelas/musyrif.
- Aplikasi harus menampilkan analisis santri untuk wali atau musyrif.
- Aplikasi harus mendukung target seperti mutqin juz tertentu, setengah juz, dan status tuntas.
- Wali harus mendapat notifikasi ketika setoran anak diverifikasi.

### 7.6 Laporan dan Analisis

- Aplikasi harus menyediakan laporan presensi berdasarkan tanggal, santri, kelas, dan status.
- Aplikasi harus menampilkan ringkasan statistik kehadiran.
- Aplikasi harus membantu identifikasi santri yang perlu pembinaan.
- Data laporan harus dapat digunakan untuk rekap operasional oleh musyrif/admin.

### 7.7 Profil Santri

- Profil harus menampilkan identitas dasar santri.
- Profil harus menampilkan ringkasan presensi, izin, pembinaan, dan tahfizh.
- Profil harus dapat diakses sesuai role dan hak akses.

### 7.8 Notifikasi

- Aplikasi harus mendukung notifikasi in-app/lokal.
- Notifikasi harus dapat dikirim untuk perubahan presensi penting, izin, tahfizh, dan perhatian khusus.
- Pengguna harus dapat mengatur preferensi notifikasi jika tersedia.

### 7.9 Admin Area

- Admin area harus hanya muncul untuk role admin/pengelola.
- Admin harus dapat mengakses sub-area tahfizh, permits, operations, logs, HR, dan broadcast.
- Admin harus dapat memantau dan mengelola data lintas kelas sesuai kebutuhan.

## 8. Requirement Non-Fungsional

### Usability

- Aplikasi harus mobile-first karena musyrif dan wali banyak memakai ponsel.
- Touch target minimal 44px.
- Alur input presensi harus cepat dan minim langkah.
- Copy harus memakai bahasa operasional yang mudah dipahami.

### Performance

- Halaman utama harus terasa cepat saat dibuka.
- Rendering daftar santri harus tetap responsif.
- Aksi presensi dan izin harus memberi feedback langsung.

### Reliability

- Data lokal harus tersimpan secara konsisten.
- Aplikasi harus menangani kondisi offline/online secara wajar melalui PWA/service worker.
- Perubahan data penting harus memiliki feedback sukses/gagal.

### Security dan Privacy

- Akses data harus dibatasi berdasarkan role dan kelas.
- Email yang tidak terdaftar tidak boleh masuk ke kelas terkait.
- Data anak/santri harus diperlakukan sebagai data sensitif.
- Lampiran izin tidak boleh tampil untuk pengguna yang tidak berwenang.

### Accessibility

- Tombol ikon harus memiliki label aksesibilitas.
- Status tidak boleh bergantung pada warna saja.
- Modal dan bottom sheet harus dapat ditutup dengan jelas.
- Kontras teks harus memadai di mode terang dan gelap.

## 9. Prioritas MVP

### P0

- Login role musyrif/wali/admin.
- Dashboard sesuai role.
- Presensi harian per sesi.
- Aksi massal presensi.
- Perizinan sakit/izin/pulang.
- Approval izin.
- Laporan dasar presensi.
- Profil santri dasar.
- PWA installable.

### P1

- Notifikasi wali dan musyrif.
- Audit trail lengkap.
- Tahfizh input, riwayat, rekap, dan analisis.
- Pembinaan dan perhatian khusus.
- Admin area lintas kelas.
- Geofencing presensi.

### P2

- Export laporan.
- Sinkronisasi backend yang lebih kuat.
- Broadcast terjadwal.
- Dashboard analitik lintas periode.
- Preferensi notifikasi lebih detail.

## 10. Acceptance Criteria Utama

- Musyrif dapat menyelesaikan presensi satu kelas untuk satu sesi dalam waktu kurang dari 2 menit pada kondisi normal.
- Status sakit/izin/pulang aktif otomatis tercermin dalam presensi.
- Pengajuan izin pending dapat disetujui/ditolak dan statusnya terlihat di riwayat.
- Wali hanya dapat melihat data anak terkait.
- Admin dapat melihat area pengelolaan dan data lintas kelas.
- Aplikasi dapat dipasang sebagai PWA dan dibuka dalam mode standalone.
- Perubahan penting menampilkan feedback yang jelas kepada pengguna.

## 11. Metrik Keberhasilan

- Waktu rata-rata input presensi per kelas.
- Persentase presensi harian yang selesai tepat waktu.
- Jumlah koreksi manual setelah presensi.
- Jumlah pengajuan izin yang diproses tanpa komunikasi manual tambahan.
- Jumlah wali aktif yang membuka laporan anak.
- Jumlah setoran tahfizh yang tercatat per pekan.
- Penurunan rekap manual oleh musyrif/admin.

## 12. Risiko dan Mitigasi

- Risiko data lokal tidak sinkron.
  Mitigasi: tambah status sinkronisasi, backup, dan strategi backend bertahap.

- Risiko akses role tidak cukup kuat jika hanya mengandalkan front-end.
  Mitigasi: pindahkan otorisasi kritikal ke backend pada fase berikutnya.

- Risiko UI terlalu padat untuk mobile.
  Mitigasi: prioritaskan alur utama, gunakan bottom sheet, dan uji viewport kecil.

- Risiko notifikasi terlalu banyak.
  Mitigasi: sediakan kategori notifikasi dan aturan throttle.

- Risiko lampiran izin membebani storage.
  Mitigasi: batasi ukuran file, kompres gambar, dan gunakan penyimpanan terkelola.

## 13. Dependency

- Data master santri dan kelas.
- Konfigurasi slot kegiatan.
- Google OAuth untuk mode produksi.
- LocalStorage/storage manager untuk penyimpanan saat ini.
- Service worker dan manifest untuk PWA.
- Data/script tahfizh eksternal bila sinkronisasi aktif.

## 14. Open Questions

- Apakah Syamsa akan tetap static-first atau akan dipindah ke backend penuh?
- Siapa pemilik final data master santri dan kelas?
- Apakah wali boleh mengajukan izin langsung untuk semua kategori?
- Apakah approval izin membutuhkan satu level atau multi-level?
- Apakah data presensi harus bisa diekspor ke format resmi sekolah?
- Berapa batas waktu edit presensi yang disepakati secara operasional?
- Apakah geofencing wajib untuk semua sesi atau hanya sesi tertentu?

## 15. Rekomendasi Roadmap

### Fase 1: Stabilkan Operasional Harian

- Rapikan presensi, izin, dashboard, profil, dan laporan.
- Pastikan role dan akses data bekerja konsisten.
- Lengkapi empty state, error state, dan feedback.

### Fase 2: Perkuat Monitoring dan Komunikasi

- Matangkan notifikasi.
- Lengkapi pembinaan dan perhatian khusus.
- Perkuat laporan untuk wali dan admin.

### Fase 3: Backend dan Audit Serius

- Pindahkan autentikasi dan otorisasi penting ke backend.
- Tambahkan sinkronisasi cloud.
- Tambahkan export, backup, dan audit log yang lebih formal.

