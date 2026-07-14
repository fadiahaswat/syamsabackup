# Audit UI/UX Komprehensif Syamsa

Tanggal audit: 14 Juli 2026  
Basis: inspeksi source HTML/CSS/JS, layout, konfigurasi PWA, serta screenshot mobile dan desktop yang tersedia.  
Scope: Musyrif, Wali Santri, Admin; mobile dan desktop; UI, UX, aksesibilitas, dan performa. Audit ini bersifat rekomendasi dan tidak mengubah kode aplikasi.

## Ringkasan eksekutif

Syamsa sudah memiliki fondasi visual yang jelas: warna brand konsisten, navigasi mobile/desktop, dukungan dark mode, state loading, dan komponen berbasis role. Risiko terbesar ada pada kompleksitas operasional. Aplikasi memuat banyak widget, modal, status, dan variasi layout sehingga tugas utama mudah tenggelam.

Prioritas tertinggi:

1. Buat dashboard dan action queue yang berbeda untuk setiap role.
2. Jadikan presensi sebagai alur tercepat untuk Musyrif.
3. Pecah form izin menjadi alur bertahap.
4. Kurangi kepadatan visual dan standardisasi komponen.
5. Perbaiki responsive grid, keyboard/focus, modal semantics, dan motion.

## Matriks prioritas

| ID | Area | Prioritas | Dampak | Effort |
|---|---|---:|---|---:|
| UX-01 | Dashboard berbasis role | P0 | Tinggi | Tinggi |
| UX-02 | Alur presensi cepat dan bulk action | P0 | Tinggi | Tinggi |
| UX-03 | Form izin bertahap dan mobile-first | P0 | Tinggi | Sedang |
| UI-01 | Sederhanakan hierarchy visual | P1 | Tinggi | Sedang |
| NAV-01 | Maksimal 4 item navigasi utama mobile | P1 | Sedang | Rendah |
| A11Y-01 | Semantics, focus, keyboard, dialog | P1 | Tinggi | Sedang |
| RWD-01 | Audit grid tetap dan overflow | P1 | Tinggi | Sedang |
| PERF-01 | Kurangi blur, shadow, dan animasi bersamaan | P1 | Sedang | Sedang |
| UX-04 | Pindahkan fitur sekunder dari Profil | P2 | Sedang | Sedang |
| DS-01 | Dokumentasikan token dan komponen | P2 | Sedang | Sedang |

## Temuan dan rekomendasi

### UX-01 — Dashboard belum cukup role-specific (P0)

**Bukti:** struktur dashboard utama dan widget Wali berada dalam shell yang sama di [index.html](/D:/syamsa-backup/syamsabackup/index.html); pembagian role dilakukan melalui class/visibility dan widget yang banyak.

**Masalah:** Musyrif membutuhkan pekerjaan yang harus dilakukan sekarang, Wali membutuhkan kondisi anak, dan Admin membutuhkan monitoring lintas unit. Struktur yang sama memaksa ketiganya memindai informasi yang tidak sama relevansinya.

**Rekomendasi:** render tiga prioritas berbeda:

- Musyrif: `Perlu tindakan → Presensi sesi aktif → Izin pending → Santri berisiko → Rekap`.
- Wali: `Kondisi anak hari ini → Kehadiran → Tahfizh terakhir → Izin → Catatan pembinaan`.
- Admin: `Anomali lintas kelas → Persetujuan → Statistik operasional → Audit/log`.

**Acceptance criteria:** pengguna dapat menemukan aksi utama kurang dari 5 detik; tidak ada widget role lain di atas fold; setiap dashboard memiliki satu primary CTA; empty/error state tetap menjelaskan tindakan berikutnya.

### UX-02 — Presensi perlu menjadi workflow utama (P0)

**Bukti:** navigasi utama berada di [bottom-nav.html](/D:/syamsa-backup/syamsabackup/src/layouts/bottom-nav.html), sedangkan presensi diposisikan sebagai widget/overlay di dashboard.

**Masalah:** Musyrif harus menemukan sesi aktif, membuka tampilan presensi, lalu mengulang aksi pada banyak santri. Dalam kondisi operasional, ini meningkatkan waktu input dan risiko data belum lengkap.

**Rekomendasi:** tampilkan card `Presensi saat ini` dengan progress, `Buka presensi`, `Semua hadir`, filter `Belum`, dan filter `Bermasalah`. Setelah 100% selesai, tampilkan konfirmasi `Kirim rekap` atau `Lihat laporan`.

**Acceptance criteria:** default state menunjukkan sesi aktif; bulk action dapat dibatalkan; perubahan status memiliki feedback; progress diperbarui tanpa reload; data belum tersimpan diberi indikator jelas.

### UX-03 — Form izin terlalu panjang (P0)

**Bukti:** form izin tersebar pada modal di `src/components/modals/`, termasuk [modal-permit.html](/D:/syamsa-backup/syamsabackup/src/components/modals/modal-permit.html) dan [modal-wali-permit.html](/D:/syamsa-backup/syamsabackup/src/components/modals/modal-wali-permit.html).

**Masalah:** banyak field dan grid dua/ tiga kolom dalam modal menyulitkan pengguna mobile; identitas yang sudah diketahui berpotensi diminta kembali.

**Rekomendasi:** gunakan stepper `Jenis → Waktu & tujuan → Konfirmasi`; prefill identitas; simpan draft; tampilkan validasi dekat field; sticky footer dengan `Kembali` dan `Lanjutkan/Kirim`.

**Acceptance criteria:** pengguna selalu melihat tahap aktif; tidak kehilangan input saat kembali; error fokus ke field pertama yang bermasalah; tombol submit hanya aktif ketika data minimum valid; layout satu kolom di layar kecil.

### UI-01 — Hierarki visual terlalu padat (P1)

**Bukti:** penggunaan berulang `font-black`, `uppercase`, radius besar, shadow, dan `backdrop-blur` di [index.html](/D:/syamsa-backup/syamsabackup/index.html) dan [src/styles/components.css](/D:/syamsa-backup/syamsabackup/src/styles/components.css).

**Masalah:** status, heading, angka, dan metadata memiliki bobot visual yang terlalu mirip. Glassmorphism pada card konten juga dapat menurunkan keterbacaan dan menambah biaya rendering.

**Rekomendasi:** card operasional solid dengan radius 12–16px; blur hanya untuk overlay/nav; body text 14–16px; uppercase hanya untuk label pendek; satu primary color per action, bukan per widget.

**Acceptance criteria:** setiap viewport memiliki satu fokus utama; heading dapat dipindai; contrast teks normal minimal WCAG AA; card dekoratif tidak mendorong CTA utama ke bawah fold.

### NAV-01 — Navigasi utama mobile perlu dibatasi (P1)

**Bukti:** navigasi mobile berada di [bottom-nav.html](/D:/syamsa-backup/syamsabackup/src/layouts/bottom-nav.html), desktop di [sidebar-desktop.html](/D:/syamsa-backup/syamsabackup/src/layouts/sidebar-desktop.html).

**Rekomendasi:** pertahankan `Dashboard, Tahfizh, Laporan, Profil`; Admin masuk ke area khusus role Admin. Samakan label, aria-label, active state, dan title di mobile/desktop. Jangan menyembunyikan fitur penting hanya di icon-only control.

**Acceptance criteria:** maksimal 4 item di bottom nav; active state terlihat tanpa hanya mengandalkan warna; setiap item memiliki accessible name; target sentuh minimal 44×44px.

### RWD-01 — Grid tetap berisiko pada layar sempit (P1)

**Bukti:** pola `grid-cols-4`, `grid-cols-5`, dan `grid-cols-6` muncul di dashboard, laporan, tahfizh, profil, serta modal. Dokumentasi sebelumnya juga mencatat temuan ini di [AUDIT-AUTOLAYOUT.md](/D:/syamsa-backup/syamsabackup/AUDIT-AUTOLAYOUT.md).

**Masalah:** label pendek dapat terpotong, kontrol menjadi terlalu kecil, dan modal dua kolom sulit dibaca pada perangkat narrow.

**Rekomendasi:** gunakan `grid-cols-2 sm:grid-cols-4` sesuai konteks; modal menjadi satu kolom di bawah 640px; gunakan `min-w-0`, `truncate` hanya untuk metadata, dan horizontal scroll hanya untuk tabel yang memang membutuhkan.

**Acceptance criteria:** uji 320px, 375px, 768px, 1024px, dan 1440px; tidak ada horizontal page overflow; semua CTA dan field tetap terlihat tanpa overlap.

### A11Y-01 — Perkuat semantics dan keyboard flow (P1)

**Bukti:** beberapa navigasi menggunakan button dan aria-label dengan baik, tetapi layout juga memakai event inline dan elemen click-area non-button pada layout/sidebar.

**Rekomendasi:** gunakan button/link untuk semua aksi; tambahkan `aria-current="page"` pada nav aktif; dialog harus memiliki `role="dialog"`, `aria-modal`, labelled title, focus trap, dan restore focus; tekan Escape menutup dialog; beri `aria-live` untuk feedback status.

**Acceptance criteria:** seluruh alur utama dapat diselesaikan dengan keyboard; focus indicator terlihat; tab order logis; screen reader membaca nama kontrol dan status; tidak ada aksi penting yang hanya dipahami dari warna atau icon.

### PERF-01 — Kurangi biaya efek visual (P1)

**Bukti:** banyak elemen menggunakan `backdrop-blur`, shadow besar, animasi slide/scale, dan gambar dekoratif pada halaman utama.

**Rekomendasi:** batasi blur pada satu layer aktif; gunakan shadow kecil; lazy-load gambar nonkritis; hindari animasi pada seluruh card sekaligus; dukung `prefers-reduced-motion: reduce`; ukur LCP, CLS, dan INP pada perangkat low-end.

**Acceptance criteria:** tidak ada layout shift ketika dashboard selesai loading; animasi non-esensial dapat dimatikan; first meaningful content muncul sebelum dekorasi; tidak ada frame drop saat scrolling daftar presensi.

### UX-04 — Profil terlalu menjadi tempat penampungan fitur (P2)

**Bukti:** struktur profil dan widget terkait berada di [src/pages/profile/](/D:/syamsa-backup/syamsabackup/src/pages/profile/).

**Rekomendasi:** Profil hanya memuat identitas, kontak, dan preferensi. Timesheet masuk ke Laporan/Operasional; arsip izin masuk ke Perizinan; pengaturan sistem dan backup hanya untuk Admin.

**Acceptance criteria:** pengguna dapat membedakan `Profil`, `Pengaturan`, dan `Arsip`; fitur sensitif tidak tampil pada role yang tidak berwenang; breadcrumb/back behavior konsisten.

### DS-01 — Dokumentasikan design system (P2)

**Bukti:** token tersebar di [src/styles/theme.css](/D:/syamsa-backup/syamsabackup/src/styles/theme.css), Tailwind config, dan class inline; [design.md](/D:/syamsa-backup/syamsabackup/design.md) tersedia sebagai referensi tetapi belum berfungsi sebagai katalog komponen yang tervalidasi.

**Rekomendasi:** dokumentasikan token warna semantic, typography scale, spacing, radius, elevation, button, card, badge, modal, input, table, empty state, loading, error, dan pola role.

**Acceptance criteria:** komponen baru dapat memilih variant tanpa membuat class visual baru; semua status memakai token semantic; ada contoh state default, hover, focus, disabled, loading, error, dan empty.

## Checklist QA sebelum rilis

### UX

- [ ] Musyrif dapat menyelesaikan presensi satu sesi tanpa membuka lebih dari satu konteks utama.
- [ ] Wali memahami kondisi anak dari layar pertama.
- [ ] Admin dapat menemukan anomali lintas kelas tanpa melewati widget personal.
- [ ] Semua error menjelaskan penyebab dan tindakan pemulihan.
- [ ] Empty state berisi konteks dan CTA.

### Responsive

- [ ] 320px dan 375px tidak horizontal overflow.
- [ ] Modal, tabel, chart, dan bottom nav tidak menutupi CTA.
- [ ] Text truncation tidak menghilangkan informasi penting.
- [ ] Desktop memiliki content width yang nyaman dan tidak terlalu melebar.

### Aksesibilitas

- [ ] Kontras minimal WCAG AA.
- [ ] Keyboard navigation lengkap.
- [ ] Focus visible pada seluruh kontrol.
- [ ] Dialog memiliki label, focus management, dan Escape handling.
- [ ] Status perubahan diumumkan lewat live region.
- [ ] Motion mengikuti `prefers-reduced-motion`.

### Performa

- [ ] Tidak ada layout shift pada loading.
- [ ] Gambar dekoratif dikompresi dan lazy-loaded jika tidak kritis.
- [ ] Blur/shadow tidak digunakan berlebihan pada daftar panjang.
- [ ] Scroll presensi tetap lancar di perangkat low-end.

## Urutan pengerjaan yang disarankan

1. Role dashboard dan action queue.
2. Presensi cepat dan bulk action.
3. Form izin bertahap.
4. Responsive grid dan modal mobile.
5. Semantics, keyboard, focus, dan dialog.
6. Penyederhanaan visual dan pengurangan efek.
7. Pemisahan Profil/Arsip/Pengaturan.
8. Dokumentasi design system.

## Kesimpulan

Syamsa tidak membutuhkan lebih banyak dekorasi atau fitur pada tahap ini. Nilai terbesar datang dari penyederhanaan: satu tujuan utama per layar, dashboard sesuai role, alur presensi cepat, form izin bertahap, dan state yang mudah dipahami. Perubahan ini akan memperbaiki kecepatan kerja Musyrif, kejelasan bagi Wali, dan kemampuan monitoring Admin sekaligus memperkuat dasar aksesibilitas serta performa.
