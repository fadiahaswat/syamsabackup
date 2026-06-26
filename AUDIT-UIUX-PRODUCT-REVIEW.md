# Audit UI/UX Produk Syamsa

Tanggal audit: 26 Juni 2026  
Basis audit: `index.html`, `src/pages/**`, `src/layouts/**`, `src/components/**`, `src/managers/**`, `src/styles/**`, `README.md`, dan `perbaikanUIUX.md`.

Catatan konteks: brief meminta audit terhadap `design.md`, tetapi file tersebut tidak ditemukan di workspace. Audit design system memakai baseline aktual dari `src/styles/theme.css`, `src/styles/components.css`, `tailwind.config.js`, dan pola UI yang sudah berjalan.

## 1. Product Review Summary

Syamsa adalah PWA operasional untuk presensi, monitoring asrama, tahfizh, pembinaan, perizinan, laporan, notifikasi, dan admin. Produk ini sudah kaya fitur, tetapi pengalaman utamanya masih terasa sebagai satu aplikasi besar yang disaring dengan class role (`musyrif-only`, `wali-only`, `admin-only`), bukan sebagai pengalaman yang benar-benar dirancang per role.

Masalah terbesar bukan estetika. Masalah terbesar adalah prioritas kerja harian yang belum tegas:

- Musyrif butuh kecepatan input, kontrol kelas, status santri bermasalah, izin pending, dan rekap cepat.
- Wali Santri butuh kondisi anak, kehadiran anak, tahfizh anak, pembinaan anak, status izin, dan kontak musyrif.
- Admin butuh monitoring lintas kelas, pengelolaan akun wali, audit, broadcast, dan data operasional lintas unit.

Saat ini dashboard dan navigasi mencampurkan kebutuhan itu. Akibatnya aplikasi tampak lengkap, tetapi beberapa workflow penting membutuhkan terlalu banyak pemindaian visual dan keputusan kecil.

## 2. Information Architecture Audit

Peta IA saat ini:

```text
Login / Onboarding
Main App
  Dashboard / Home
    Greeting
    Status GPS
    Slot presensi aktif
    Perizinan musyrif
    Perizinan wali
    Pembinaan
    Statistik presensi
  Tahfizh
    Beranda
    Form input
    Analisis
    Riwayat
    Rekap
  Laporan / Rekap
    Rekap kelas
    Analisis santri
  Admin
    Operations
    HR & Wali
    Tahfizh
    Perizinan
    Broadcast
    Logs
  Profil
    Profil user
    Biodata wali/santri
    Timesheet
    Pembinaan
    Arsip izin
    Manajemen data
    Sistem
  Notifikasi
  Attendance overlay
  Qibla / Asrama
```

Temuan utama:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Navigasi utama | P0 | Label beda antara mobile dan desktop: `Home`, `Dashboard`, `Rekap`, `Rekap Presensi`, `Laporan Kelas`. | Pengguna lama bisa beradaptasi, pengguna baru sulit membangun peta mental. | Tetapkan kosakata tunggal: Dashboard, Tahfizh, Laporan, Profil. | Samakan label, aria-label, dan title. | `[Dashboard] [Tahfizh] [Laporan] [Profil]` | Ubah `src/layouts/bottom-nav.html`, `src/layouts/sidebar-desktop.html`, dan markup di `index.html`. |
| Tab Admin | P0 | Admin muncul sebagai destinasi utama untuk musyrif, padahal secara IA ini area pengelolaan pusat. | Navigasi utama terlalu berat dan membingungkan role non-admin. | Jadikan Admin sebagai entry dalam Profil atau menu khusus bila role admin/pengelola. | Sembunyikan dari bottom nav, tampilkan di sidebar desktop hanya untuk admin/pengelola. | `Profil > Pengelolaan Sistem` | Gunakan permission model eksplisit, bukan hanya class visibility. |
| Profil | P1 | Profil memuat identitas, timesheet, pembinaan, arsip izin, backup, sistem. | Profil menjadi tempat buangan fitur. | Pecah menjadi Profil, Pengaturan, dan Arsip/Manajemen jika dibutuhkan. | Gunakan section sederhana dengan heading konsisten. | `Profil: identitas + kontak + pengaturan` | Pindahkan arsip izin ke Laporan/Perizinan untuk musyrif. |
| Tahfizh | P1 | Sub halaman Tahfizh ada Beranda, Form, Analisis, Riwayat, Rekap; sebagian disembunyikan di tombol icon. | Pengguna perlu belajar struktur internal. | Jadikan 3 tugas utama: Input, Monitoring, Riwayat/Rekap. | Segmented control 3 item, CTA input tetap. | `[Input] [Monitoring] [Riwayat]` | Gabungkan Analisis dan Rekap sebagai mode dalam Monitoring. |
| Attendance overlay | P1 | Presensi bukan tab, tetapi full-screen overlay yang dipanggil dari dashboard. | Sulit ditemukan ulang jika pengguna ingin langsung presensi. | Jadikan presensi sebagai task utama dashboard dan deep link dari notifikasi/timesheet. | Header presensi lebih ringkas dengan progress kelas. | `Presensi Shubuh | 24/30 selesai | Cari | Aksi massal` | Tambah route/state eksplisit `attendance?slot=...`. |

## 3. Navigation Audit

Navigasi bawah saat ini punya 5 item ketika admin aktif. Ini padat untuk mobile dan membuat target lebih kecil. Ada juga perilaku nav menyusut saat scroll pada CSS root `index.html`, yang berisiko mengganggu muscle memory.

Temuan:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Bottom nav | P0 | 5 item termasuk Admin. | Thumb reachability turun, label sempit. | Maksimum 4 item utama. | Fixed bottom nav, tanpa shrink otomatis. | `[Dashboard] [Tahfizh] [Laporan] [Profil]` | Admin pindah ke Profil atau sidebar admin. |
| Header notifikasi | P1 | Notifikasi ada di header tetapi bukan nav utama; tidak ada label. | Pengguna baru bisa melewatkan notifikasi penting. | Untuk pending penting, tampilkan task card di dashboard. | Badge count jelas, bukan titik saja. | `Perlu tindakan: 3` | Hubungkan `notification-manager` dengan dashboard action list. |
| Back button di tab | P2 | Header Tahfizh/Laporan/Admin punya tombol kembali ke Home, sementara nav juga ada. | Duplikasi navigasi. | Pada tab utama tidak perlu back. | Hilangkan back di desktop/mobile tab utama; pakai title saja. | `Tahfizh` tanpa back | Biarkan back hanya pada overlay/deep page. |

## 4. Dashboard Audit

Dashboard harus menjawab "apa yang harus saya lakukan sekarang?". Saat ini dashboard memuat greeting, countdown, GPS, slot, izin, pembinaan, statistik, dan widget wali. Banyak informasi baik, tetapi urutannya belum role-specific.

Temuan:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Dashboard Wali | P0 | Wali masih berada di struktur dashboard yang sama dengan musyrif. | Informasi anak tidak menjadi pusat pengalaman. | Buat Wali Dashboard khusus: status anak hari ini, tahfizh terakhir, izin aktif, pembinaan, kontak musyrif. | Card kecil, personal, tanpa statistik kelas. | `Ananda hari ini: Hadir 5/6, Tahfizh: terakhir, Izin: pending` | Buat render branch dashboard berdasarkan role. |
| Dashboard Musyrif | P0 | Aksi paling penting bersaing dengan dekorasi, greeting, countdown, chart. | Input presensi dan approval tidak langsung jadi fokus. | Urutan: Perlu Tindakan, Presensi Saat Ini, Santri Perlu Perhatian, Sesi Lain, Rekap. | Kurangi hero tinggi dan efek visual. | `Perlu Tindakan -> Buka Presensi -> Ringkasan` | Susun ulang `src/pages/dashboard/dashboard.html`. |
| Statistik presensi | P1 | Chart dan KPI presentase bisa terasa seperti KPI palsu jika tidak langsung dipakai harian. | Pengguna membaca angka tanpa tindakan. | Tambahkan insight operasional: siapa belum diinput, kelas mana turun, santri risiko. | Statistik menjadi ringkasan + CTA detail. | `3 santri sering alpa -> Lihat` | Tambah rules insight di `dashboard-manager.js`. |
| GPS card | P1 | GPS status tampil cukup teknis dan memakan ruang kerja. | Bisa mengalihkan fokus dari input presensi. | Tampilkan hanya saat dibutuhkan untuk validasi presensi. | Banner compact dengan tindakan `Ulangi`/`Panduan`. | `Lokasi belum valid | Ulangi` | Trigger berdasarkan state, bukan selalu hadir. |

## 5. Musyrif Experience Audit

Workflow harian musyrif:

1. Buka aplikasi.
2. Cek sesi aktif.
3. Input presensi banyak santri.
4. Tandai sakit/izin/pulang.
5. Approve izin wali.
6. Pantau santri bermasalah.
7. Rekap/WA laporan.

Temuan:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Input presensi | P0 | Presensi banyak santri masih membutuhkan pencarian dan aksi berulang. | Waktu input tinggi, rawan lupa saat operasional ramai. | Default semua hadir, lalu musyrif mengubah pengecualian. | Toolbar: `Semua Hadir`, filter `Belum`, filter `Bermasalah`. | `30 santri | Semua Hadir | Belum 6 | Bermasalah 2` | Perkuat bulk action sebagai tindakan utama, bukan menu tersembunyi. |
| Approval izin | P0 | Approval widget hanya muncul sebagai card kecil. | Permintaan wali bisa telat diproses. | Jadikan pending izin sebagai prioritas tertinggi. | Top action bar dengan count dan CTA. | `3 Izin menunggu | Proses` | Dashboard action queue. |
| Pembinaan | P1 | Pembinaan ada di dashboard dan profil; hubungan ke presensi kurang jelas. | Musyrif harus membuka tempat berbeda untuk memahami masalah santri. | Tampilkan pembinaan sebagai warning pada row santri saat presensi. | Badge kecil di list presensi. | `Ahmad | Alpa 2 | Pembinaan 10 poin` | Integrasi `pembinaan` data ke attendance row. |
| Laporan WA/PDF | P1 | Aksi export ada di Laporan, tidak tampak dari selesai presensi. | Setelah input, user harus pindah tab untuk melapor. | Beri next action setelah presensi lengkap. | Bottom sheet: `Presensi selesai. Kirim rekap?` | `Kirim WA | Lihat Rekap` | Trigger saat slot mencapai 100% input. |

## 6. Wali Experience Audit

Workflow harian wali:

1. Login dengan NIS/password.
2. Melihat kondisi anak hari ini.
3. Mengecek kehadiran/tahfizh/pembinaan.
4. Mengajukan izin.
5. Melihat status approval dan riwayat.
6. Menghubungi musyrif.

Temuan:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Dashboard Wali | P0 | Belum ada landing yang benar-benar menjawab "bagaimana anak saya hari ini?". | Wali harus menafsirkan struktur aplikasi yang dibuat untuk operasional. | Dashboard personal anak. | Hero kecil berisi nama anak, kelas, status hari ini. | `Ahmad hari ini: Hadir, Tahfizh terakhir, Izin aktif` | Buat `WaliDashboard` atau conditional block besar di dashboard. |
| Form izin wali | P0 | Banyak field: nama wali, alamat, kategori, alasan, tanggal, jam keluar/kembali, tujuan. | Barrier tinggi, terutama mobile. | Prefill identitas, stepper 2-3 tahap, simpan draft. | Step chips: Jenis -> Waktu -> Konfirmasi. | `Jenis izin -> Detail -> Kirim` | Refactor `modal-wali-permit.html` dan manager terkait. |
| Tahfizh untuk wali | P1 | Tahfizh berorientasi input/rekap musyrif. | Wali tidak butuh input, butuh progress anak. | Buat read-only tahfizh anak. | Progress juz, setoran terakhir, catatan musyrif. | `Progress 70% | Setoran terakhir | Target berikutnya` | Role gate subtab Tahfizh. |
| Pembinaan untuk wali | P1 | Pembinaan berada di Profil dan berbahasa operasional. | Wali bisa merasa menerima data hukuman tanpa konteks tindak lanjut. | Tampilkan sebagai "Catatan Pembinaan" dengan status dan saran. | Nada teks empatik, bukan hanya poin. | `Perlu pendampingan: terlambat 2x | Hubungi musyrif` | Copywriting dan permission display. |

## 7. Visual Hierarchy Audit

Temuan:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Seluruh app | P1 | Terlalu banyak elemen memakai font black, uppercase, shadow, rounded besar. | Semua terlihat penting, prioritas visual melemah. | Tetapkan skala prioritas: task, status, metadata. | Body 12-14 regular/semibold, heading bold, label tidak selalu uppercase. | `Judul jelas > angka > metadata kecil` | Audit class `font-black`, `uppercase`, `tracking-widest`. |
| Hero cards | P1 | Card gelap besar, gradient/orb, logo watermark berulang. | Area kerja terdorong ke bawah. | Hero hanya untuk task utama. | Tinggi compact, CTA jelas. | `Sesi saat ini + buka presensi + ringkasan` | Kurangi dekorasi di dashboard/tahfizh/profile. |
| CTA | P1 | CTA utama kadang bersaing dengan icon-only button. | Pengguna perlu menebak tindakan utama. | Satu primary action per view. | Primary full-width atau prominent; secondary ghost. | `Buka Presensi` dominan | Standardisasi komponen button. |

## 8. Design System Audit

Baseline aktual:

- Token warna dan radius ada di `src/styles/theme.css`.
- Komponen banyak memakai Tailwind langsung di HTML.
- `components.css` memaksa radius besar dan shadow pada banyak selector.
- Belum ada `design.md`.

Temuan:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Design documentation | P0 | `design.md` tidak ada. | Review dan implementasi rawan subjektif. | Buat sumber kebenaran design system. | Token, komponen, pola role, spacing, copy. | `Design principles -> Tokens -> Components -> Patterns` | Tambah `design.md` atau `docs/design-system.md`. |
| Radius | P1 | Radius 24-28px dipakai hampir di semua card, modal, nav. | UI terasa berat dan kurang padat untuk operasional. | Radius berbeda sesuai fungsi. | Card 12-16px, modal 20-24px, pill full. | `Card 16, control 12, pill full` | Sesuaikan token `--radius-card`, `--radius-control`. |
| Glassmorphism | P1 | Banyak card memakai `backdrop-blur`. | Membuat hierarchy kabur dan performa mobile turun. | Gunakan blur hanya untuk overlay/nav. | Card reguler solid. | `Surface solid + border tipis` | Kurangi `bg-white/80 backdrop-blur-xl` di screen utama. |
| Warna role | P2 | Home emerald, Tahfizh orange, Report emerald/blue, Admin indigo, Profile mint/purple. | Warna menjadi dekorasi, bukan sistem makna. | Tetapkan warna berdasarkan status dan domain. | Domain: Tahfizh orange; status: success/warning/danger. | `Warning selalu amber, danger selalu red` | Definisikan token semantic. |

## 9. Component Consistency Audit

| Komponen | Prioritas | Temuan | Rekomendasi |
|---|---:|---|---|
| Button | P1 | Ukuran, radius, berat teks, dan icon placement bervariasi. | Buat variant: primary, secondary, ghost, icon, danger, segmented. |
| Card | P1 | Banyak card dekoratif dengan shadow/glass/orb. | Card operasional solid, padding 12-16, heading ringkas. |
| Badge | P2 | Badge dipakai untuk status, metadata, domain, dan count sekaligus. | Pisahkan badge status, count, tag, dan domain. |
| Modal/bottom sheet | P1 | Modal izin panjang dan bottom sheet tidak selalu step-based. | Gunakan bottom sheet mobile dengan sticky footer action. |
| Search/filter | P1 | Search berada di berbagai tempat dengan pola berbeda. | Standard search row: search, filter, sort. |
| Form/input | P0 | Form izin dan tahfizh punya banyak field dalam satu layar. | Progressive disclosure dan prefill data. |
| Navigation/tab | P1 | Tab utama, subtab, segmented control, icon action bercampur. | Tetapkan kapan memakai tab vs segmented vs toolbar. |
| Toast/error | P1 | Butuh pesan solusi, bukan hanya status. | Format: apa terjadi, dampak, tindakan. |
| Empty state | P1 | Shared empty state generik. | Empty state per konteks dengan CTA relevan. |

## 10. Mobile UX Audit

Temuan:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Bottom nav | P0 | Fixed bottom dengan 5 item dan shrink behavior. | Sulit dijangkau dan tidak stabil. | 4 item stabil. | Target 48px, label konsisten. | `[Dashboard] [Tahfizh] [Laporan] [Profil]` | Hapus shrink behavior untuk nav utama. |
| Attendance bottom bar | P1 | Search pill + bulk action mengambang di area gesture. | Bisa bentrok dengan safe area dan keyboard. | Sticky toolbar dengan safe-area padding. | Saat input search aktif, toolbar naik. | `Cari | Filter | Aksi` | Perbaiki bottom offset dengan keyboard/safe area. |
| Tap target | P1 | Beberapa button kecil 7x7, label 9px. | Sulit disentuh di lapangan. | Minimum 44/48px untuk action. | Icon button 44px. | `Icon button 44` | Audit `w-7 h-7`, `h-9`, `text-[9px]`. |
| Tables | P1 | Banyak tabel min-width 600-700px. | Mobile harus scroll horizontal. | Untuk mobile, ubah tabel menjadi list cards. | Desktop table, mobile list. | `Nama | status chips | aksi` | Responsive renderer per report/admin/tahfizh. |

## 11. Workflow Audit

Estimasi langkah saat ini vs target:

| Workflow | Saat ini | Target | Prioritas | Hambatan | Perbaikan |
|---|---:|---:|---:|---|---|
| Input presensi sesi aktif | 5-8 langkah + repetisi per santri | 2-4 langkah | P0 | CTA tidak selalu pertama, aksi massal tersembunyi | Default semua hadir, ubah pengecualian, auto-save jelas |
| Input tahfizh | 7-10 input | 4-6 input | P1 | Banyak field teknis, select berurutan | Prefill musyrif/kelas, pencarian santri cepat, template setoran |
| Input pembinaan | Tidak cukup prominent dari presensi | 2-3 langkah dari row santri | P1 | Terpisah di profil/modal | Tambah aksi pembinaan dari profile/attendance row |
| Ajukan izin wali | 8-10 field | 3 tahap | P0 | Identitas diminta ulang, form panjang | Prefill, stepper, validasi per tahap |
| Approve izin | Widget -> modal -> tindakan | 1-2 langkah per izin | P0 | Pending tidak menjadi action queue utama | Card prioritas + approve/reject cepat |
| Membuka laporan | Tab -> pilih mode -> periode -> export | 3-5 langkah | P1 | Mode dan rentang terpisah | Preset "Hari ini", "Kirim rekap sekarang" |
| Membaca notifikasi | Header icon -> tab notifikasi | 2 langkah | P2 | Badge titik tidak menjelaskan urgency | Action cards di dashboard untuk notifikasi kritis |

## 12. Data Presentation Audit

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Laporan tabel | P1 | Tabel lengkap tetapi padat dan horizontal. | Mobile sulit memindai. | Card/list mobile dengan prioritas nilai dan masalah. | Desktop tetap tabel. | `Ahmad | 86 | Shalat 5/6 | Catatan 1` | Renderer mobile alternatif. |
| Dashboard chart | P2 | Chart garis presensi mungkin kurang actionable. | Membaca tren tanpa tahu siapa harus ditindak. | Insight-first. | Tampilkan "3 santri turun" sebelum chart. | `Butuh perhatian: A, B, C` | Tambah computed insight. |
| Tahfizh progress | P1 | Banyak visual progress, ranking, target dalam satu area. | Musyrif sulit memilih tindakan berikutnya. | Kelompokkan: perlu input, belum target, sudah tuntas. | List prioritas bukan hanya angka. | `Belum setor hari ini` | Tambah filter actionable. |
| Admin tables | P1 | Semua admin subtab memakai tabel lebar. | Kurang nyaman untuk mobile admin. | Admin mobile minimal: monitor dan approve; editing detail desktop. | Mobile list + expandable row. | `Kelas 2A | Subuh selesai | Hubungi` | Breakpoint-specific layout. |

## 13. Accessibility Audit

Temuan:

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Text kecil | P0 | Banyak teks 8-10px untuk label penting. | Sulit dibaca, terutama orang tua. | Minimum body 12px, label 11-12px. | Kurangi `text-[8px]`, `text-[9px]`. | `Label 12px` | Audit Tailwind arbitrary text size. |
| Kontras | P1 | `text-slate-400` sering dipakai untuk body/metadata penting. | Kontras rendah. | Metadata penting minimal slate-500/600. | Dark mode pakai slate-300/400 sesuai konteks. | `Secondary text #475569` | Token semantic text. |
| Icon-only button | P1 | Beberapa icon button punya title tapi tidak selalu aria-label. | Screen reader tidak konsisten. | Semua icon-only punya aria-label. | Hide decorative icon with `aria-hidden`. | `button aria-label="..."` | Audit button icon-only. |
| Motion | P1 | Banyak animate, pulse, ping, hover scale. | Mengganggu pengguna sensitif motion. | Respect reduced motion. | Global reduce motion CSS. | `prefers-reduced-motion` | Tambah CSS global. |
| Color dependency | P2 | Status sering dibedakan oleh warna. | Pengguna buta warna kehilangan makna. | Selalu sertakan teks/icon status. | `Disetujui`, `Pending`, `Ditolak`. | `Badge + label` | Audit status badges. |

## 14. Anti Design Slop Audit

Elemen yang perlu ditantang dengan pertanyaan "apakah membantu tugas harian?":

| Lokasi | Prioritas | Masalah | Dampak | Solusi UX | Solusi UI | Wireframe konseptual | Rekomendasi implementasi |
|---|---:|---|---|---|---|---|---|
| Gradient/orb/watermark | P1 | Banyak orb blur dan watermark besar di hero. | Mengambil ruang dan perhatian tanpa fungsi. | Hanya gunakan untuk brand moments, bukan task screen. | Hapus dari dashboard operasional. | `Task card bersih` | Audit `blur-[...]`, absolute decorative div. |
| Glass card everywhere | P1 | Glassmorphism dipakai sebagai default. | Produk operasional terasa kurang tegas. | Card solid untuk data. | Blur hanya nav/modal. | `Solid surface` | Refactor component surface. |
| Fake KPI | P1 | Percentage besar tanpa next action. | Pengguna merasa ada data tapi tidak terbantu. | Setiap KPI punya diagnosis atau CTA. | `99% hadir, 2 santri perlu perhatian`. | `KPI -> insight -> action` | Tambah insight generator. |
| Animasi dekoratif | P2 | Pulse/ping/hover scale di banyak elemen. | Noise visual. | Animasi hanya untuk state hidup atau feedback. | Hapus hover lift pada card data. | `Static cards` | Kurangi `animate-pulse`, `group-hover:scale`. |

## 15. Product Thinking per Halaman

| Halaman | Tujuan | Tugas utama | Evaluasi | Rekomendasi |
|---|---|---|---|---|
| Login/Onboarding | Masuk sesuai role | Pilih role dan autentikasi | Sudah menjelaskan produk, tetapi bisa terlalu marketing. | Fokus ke masuk cepat; bantu wali dengan NIS/password. |
| Dashboard | Menjawab tugas sekarang | Presensi, izin pending, status anak | Terlalu banyak peran dalam satu struktur. | Role-based dashboard. |
| Attendance | Input presensi cepat | Tandai hadir/telat/alpa/izin | Sudah punya autosave dan bulk menu, tetapi aksi utama belum cukup eksplisit. | Default hadir + exception workflow. |
| Tahfizh | Input/monitor hafalan | Input setoran, analisis, rekap | Kaya fitur tetapi IA internal padat. | Pisah pengalaman musyrif vs wali. |
| Report | Melihat dan mengirim rekap | Pilih periode, export, analisis santri | Bagus untuk desktop, berat di mobile. | Mobile list dan shortcut setelah presensi selesai. |
| Admin | Kelola sistem lintas kelas | Monitor, HR, izin, broadcast, logs | Tabel lengkap, tetapi mobile dan permission perlu diperkuat. | Admin sebagai area khusus, bukan tab umum. |
| Profile | Identitas dan pengaturan | Lihat profil, kontak, sistem | Terlalu banyak fitur manajemen. | Jadikan profil lebih personal; pindahkan fitur operasional. |
| Notifications | Membaca perubahan | Filter dan baca notifikasi | Perlu integrasi ke action queue. | Notifikasi kritis tampil di dashboard. |

## Ringkasan Akhir

### Top 20 Masalah UI

1. Bottom nav terlalu padat saat Admin tampil.
2. Label navigasi tidak konsisten.
3. Terlalu banyak font black/uppercase.
4. Teks 8-10px dipakai untuk info penting.
5. Glassmorphism terlalu sering.
6. Radius terlalu besar di hampir semua komponen.
7. Hero card terlalu dominan.
8. CTA utama sering tidak cukup menonjol.
9. Icon-only action kadang kurang jelas.
10. Tabel mobile terlalu lebar.
11. Badge punya terlalu banyak makna.
12. Empty state generik.
13. Loading state belum konsisten.
14. Error state belum selalu memberi solusi.
15. Gradient/orb dekoratif berlebihan.
16. Animasi pulse/ping terlalu sering.
17. Header tab punya back button yang duplikatif.
18. Search/filter tidak punya pola seragam.
19. Modal form panjang tanpa step.
20. Dashboard statistik bersaing dengan task utama.

### Top 20 Masalah UX

1. Dashboard belum benar-benar role-based.
2. Wali belum punya portal personal anak.
3. Input presensi belum optimal untuk banyak santri.
4. Approval izin belum menjadi action utama.
5. Form izin wali terlalu panjang.
6. Identitas wali/santri tidak cukup diprefill.
7. Tahfizh wali belum read-only personal.
8. Pembinaan kurang terhubung dengan presensi.
9. Profil menjadi tempat terlalu banyak fitur.
10. Admin muncul sebagai navigasi utama.
11. Laporan butuh langkah ekstra setelah presensi selesai.
12. Notifikasi belum berubah menjadi tindakan.
13. Data chart belum memberi rekomendasi.
14. Workflow mobile admin berat.
15. Empty state tidak selalu memberi tindakan berikutnya.
16. Error teknis berpotensi membingungkan.
17. Tidak ada dokumentasi design system final.
18. Permission model terlihat berbasis class, bukan pengalaman role.
19. Peta IA sulit dipahami pengguna baru.
20. Pengguna lama bergantung pada hafalan posisi, bukan struktur yang jelas.

### Top 20 Inkonsistensi

1. Home vs Dashboard.
2. Rekap vs Laporan.
3. Rekap Presensi vs Laporan Kelas.
4. Admin sebagai tab vs area pengelolaan.
5. Card radius 2xl/3xl/1.75rem bercampur.
6. Button radius full/xl/2xl bercampur.
7. Shadow sm/lg/xl/2xl bercampur.
8. Surface solid dan glass bercampur tanpa aturan.
9. Role colors tidak terdokumentasi.
10. Status colors tidak selalu semantic.
11. Search input punya beberapa gaya.
12. Filter punya beberapa gaya.
13. Segmented control punya beberapa gaya.
14. Modal bottom sheet dan centered modal bercampur.
15. Empty state shared vs custom bercampur.
16. Table desktop dipakai juga mobile.
17. Header tiap tab berbeda terlalu jauh.
18. Aria-label tidak merata.
19. Loading text/spinner/skeleton tidak seragam.
20. Copywriting operasional dan wali bercampur.

### Top 20 Peluang Peningkatan

1. Wali Dashboard personal.
2. Musyrif action queue.
3. Presensi exception workflow.
4. Quick approve izin.
5. Stepper form izin.
6. Tahfizh read-only untuk wali.
7. Santri risk list.
8. Insight rekap otomatis.
9. Mobile report cards.
10. Design system documentation.
11. Component tokenization.
12. Better empty/loading/error states.
13. Reduced motion mode.
14. Admin mobile monitor mode.
15. Post-presensi next action.
16. Global role permission model.
17. Dashboard information pruning.
18. Unified navigation language.
19. Accessibility typography pass.
20. Offline/sync feedback yang lebih jelas.

### Prioritas Perbaikan

P0 - segera:

1. Buat dashboard berbeda untuk Musyrif dan Wali.
2. Sederhanakan bottom navigation menjadi 4 item utama.
3. Jadikan approval izin sebagai action queue prioritas.
4. Sederhanakan form izin wali dengan prefill dan stepper.
5. Optimalkan input presensi: default hadir, exception, bulk action.

P1 - berikutnya:

1. Buat design system documentation.
2. Rapikan visual hierarchy: font, radius, shadow, glass.
3. Ubah tabel mobile menjadi list cards.
4. Buat Tahfizh role-based.
5. Standarkan empty/loading/error states.

P2 - polish:

1. Kurangi animasi dekoratif.
2. Tambah reduced motion.
3. Perbaiki copywriting wali.
4. Rapikan badge taxonomy.
5. Tambah insight operasional pada statistik.

