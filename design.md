# Syamsa Design System

Status: spesifikasi teknis lengkap berdasarkan `Design system for app/src/app/App.tsx`, digabungkan dengan keputusan produk lama, 28 Juni 2026.

Dokumen ini adalah rujukan desain Syamsa PWA. Urutannya mengikuti halaman design system di `App.tsx`, tetapi keputusan label dan prinsip produk lama tetap dipertahankan bila lebih matang secara UX.

## Prinsip Produk

Syamsa adalah aplikasi operasional harian untuk lingkungan pesantren/sekolah. Desain harus membantu pengguna menyelesaikan tugas dengan cepat, jelas, dan minim kebingungan.

Prioritas role:

- Musyrif: input presensi cepat, approve izin, pantau santri bermasalah, dan melihat laporan harian.
- Wali Santri: melihat kondisi anak, kehadiran, tahfizh, pembinaan, perizinan, dan kontak musyrif.
- Admin/Pengelola: monitoring lintas kelas, akun wali, audit, broadcast, dan data sistem.

Keputusan label utama:

- Gunakan `Dashboard`, bukan `Home`, untuk produk utama.
- Gunakan `Laporan`, bukan `Rekap`, untuk navigasi utama laporan presensi.
- Gunakan `Area Pengelolaan` atau `Pengelolaan` untuk area admin. `Admin` hanya dipakai untuk role atau konteks teknis akun.
- Copy untuk Wali harus personal dan berorientasi anak.
- Copy untuk Musyrif/Admin harus operasional dan berorientasi tindakan.

## 00 Brand Assets

Logo resmi yang didokumentasikan di `App.tsx`:

- `Primary Logo`: logo horizontal utama, dipakai sebagai default.
- `Vertical Logo`: mark di atas wordmark, cocok untuk format portrait atau square.
- `Logomark`: ikon aplikasi, favicon, app icon, nav kecil.
- `Wordmark`: teks Syamsa untuk header atau watermark.
- Partner brand: `Mu'allimin` dan `PP Muhammadiyah`.

Varian penggunaan:

- Light background: gunakan logo asli di atas `--card` atau putih.
- Dark background: gunakan versi inverted/putih di atas `#0C1F3D` atau surface gelap.
- Brand gradient: gunakan versi inverted/putih di atas gradient brand.
- Compact lockup: partner logo + logomark + wordmark untuk ruang horizontal terbatas.

Skala logomark:

| Ukuran | Penggunaan |
| --- | --- |
| 16px | Favicon |
| 24px | Nav inline |
| 32px | Header |
| 48px | App icon small |
| 64px | App icon medium |
| 96px | Splash screen |
| 128px | App store / high-res asset |

Aturan logo:

- Gunakan `Primary Logo` untuk mayoritas kebutuhan.
- Gunakan `Logomark` saja untuk ukuran kecil di bawah 32px.
- Gunakan versi inverted di atas background gelap.
- Berikan clear space minimal 1x tinggi logomark di sekeliling logo.
- Jangan mengubah warna logo di luar palet resmi.
- Jangan stretch, distorsi, rotasi, menambah shadow, outline, atau efek visual pada logo.
- Jangan memakai logo di atas background dengan kontras rendah.

## 01 Color Palette

### Brand Utama

| Token | Hex | Fungsi |
| --- | --- | --- |
| `--color-brand-deep` | `#0C4E8C` | Heading gelap, hover brand, surface brand dalam |
| `--color-brand-blue` | `#0C81E4` | Primary CTA, link, aksi utama |
| `--color-brand-cyan` | `#17C3D4` | Accent, ring fokus, status telat |
| `--color-brand-mint` | `#4FE7AF` | Success highlight dan aksen positif |
| `--color-brand-navy` | `#0C1F3D` | Header/nav gelap, dark brand surface |

### Status Presensi

| Kode | Label | Hex | Background | Score |
| --- | --- | --- | --- | --- |
| `H` | Hadir | `#10B981` | `rgba(16,185,129,0.12)` | `100` |
| `Y` | Ya | `#10B981` | `rgba(16,185,129,0.12)` | `100` |
| `T` | Telat | `#17C3D4` | `rgba(23,195,212,0.12)` | `80` |
| `S` | Sakit | `#F59E0B` | `rgba(245,158,11,0.12)` | `75` |
| `I` | Izin | `#3B82F6` | `rgba(59,130,246,0.12)` | `75` |
| `P` | Pulang | `#A855F7` | `rgba(168,85,247,0.12)` | `0` |
| `A` | Alpa | `#EF4444` | `rgba(239,68,68,0.12)` | `-50` |
| `-` | Tidak | `#64748B` | `rgba(100,116,139,0.12)` | `0` |

Urutan tap cycle resmi: `H -> A -> S -> I -> P -> T -> H`.

### Sesi Presensi

| Sesi | Jam | Hex | CSS Variable | Deskripsi |
| --- | --- | --- | --- | --- |
| Shubuh | `04:00-06:00` | `#22C55E` | `--color-sesi-shubuh` | Fardu, sunnah, tahfizh |
| Sekolah | `06:00-15:00` | `#17C3D4` | `--color-sesi-sekolah` | KBM sekolah |
| Ashar | `15:00-17:00` | `#EAB308` | `--color-sesi-ashar` | Fardu, dzikir |
| Maghrib | `18:00-19:00` | `#FB923C` | `--color-sesi-maghrib` | Fardu, sunnah, KBM mahad |
| Isya | `19:00-21:00` | `#8B5CF6` | `--color-sesi-isya` | Fardu, sunnah, Al-Kahfi |

### Feature Domain

| Domain | Hex | Fungsi |
| --- | --- | --- |
| Attendance/Presensi | `#10B981` | Dashboard presensi, status hadir |
| Tahfizh | `#F97316` | Modul Qur'an, setoran, progres hafalan |
| Laporan | `#3B82F6` | Navigasi laporan, grafik, rekap data |
| Profil | `#A855F7` | Profil pengguna dan pengaturan personal |

### Surface

| Token | Hex | Fungsi |
| --- | --- | --- |
| Background | `#F4F8FF` | Page background |
| Muted | `#EEF3FB` | Input, subtle background, empty blocks |
| Card | `#FFFFFF` | Card surface |
| Muted foreground | `#5B7099` | Label, caption, metadata |

Gunakan warna untuk memperjelas status, bukan sebagai satu-satunya penanda. Semua badge/status wajib tetap memiliki teks atau ikon yang bermakna.

## 02 Typography

Font:

- Primary UI font: `Plus Jakarta Sans`.
- Data/technical font: `DM Mono`.
- Arabic/Qur'an font: `Rubik` dengan `dir="rtl"` dan `lang="ar"`.

Skala teks:

| Style | Rekomendasi | Penggunaan |
| --- | --- | --- |
| Display | `text-4xl font-black` | Hero atau specimen brand saja |
| H1 | `text-3xl font-bold` | Judul halaman utama |
| H2 | `text-2xl font-bold` | Judul section |
| H3 | `text-xl font-semibold` | Subsection/card besar |
| H4 | `text-lg font-semibold` | Panel kecil |
| Body | `text-base font-normal` | Paragraf utama |
| Body SM | `text-sm font-normal` | Deskripsi dan konten card |
| Caption | `text-xs font-medium` | Metadata penting |
| Label | `text-[10px] font-semibold uppercase` | Label specimen/design system |
| Mono | `DM Mono`, tabular nums | Waktu, NIS, score, angka teknis |

Aturan praktis:

- Hindari `font-black` untuk semua elemen. Pakai hanya untuk angka penting, hero, dan emphasis terbatas.
- Body dan metadata penting minimal 12px di mobile.
- Jangan terlalu sering memakai uppercase dan tracking lebar pada label operasional.
- Gunakan tabular nums untuk angka statistik, jam, score, dan counter.
- Teks Arab harus disimpan UTF-8, tampil RTL, dan punya line-height longgar.

## 03 Buttons

Varian tombol:

| Variant | Warna | Fungsi |
| --- | --- | --- |
| Primary | `#0C81E4` + teks putih | Aksi utama layar |
| Attendance | `#10B981` + teks putih | Aksi presensi |
| Tahfizh | `#F97316` + teks putih | Aksi modul tahfizh |
| Danger | `#EF4444` + teks putih | Hapus/tolak/aksi berisiko |
| Secondary | `bg-card`, border `--border` | Aksi pendukung |
| Ghost | transparan | Aksi ringan/familiar |

Ukuran:

- Small: `h-8 px-4 text-xs`.
- Medium: `h-10 px-5 text-sm`.
- Large: `h-12 px-6 text-base`.
- Touch target minimum 44px untuk aksi utama di produk, ideal 48px.

State:

- Loading: tampilkan spinner `Loader` dan disable tombol.
- Disabled: opacity rendah dan cursor disabled.
- Focused: gunakan ring `#17C3D4` atau token focus ring.
- Active: boleh memakai scale kecil, tetapi hormati `prefers-reduced-motion`.

Icon button:

- Pakai ikon Lucide bila tersedia.
- Tombol ikon wajib punya `aria-label`.
- Icon-only control idealnya `40-44px`, tergantung density layar.

## 04 Badges & Pills

Jenis badge:

- Status presensi compact: kode `H`, `T`, `S`, `I`, `P`, `A`, `Y`, `-`.
- Status presensi pill: label penuh seperti `Hadir`, `Telat`, `Sakit`.
- Permit category: `Sakit`, `Izin Kegiatan`, `Izin Pulang`.
- Permit status: `Pending`, `Approved`, `Rejected`, `Aktif`, `Selesai`.
- Context badge: `Online`, `Offline`, count badge, domain tag.

Aturan:

- Badge status wajib memakai teks/kode, bukan warna saja.
- Badge compact cocok untuk tabel dan row padat.
- Pill cocok untuk filter, detail, atau ringkasan.
- Gunakan warna yang sama dengan token status agar konsisten lintas halaman.

## 05 Cards & Panels

Jenis card:

- Solid card: card standar untuk data, form, atau konten berulang.
- Interactive card: punya hover, affordance, dan ikon panah bila membuka detail.
- Stat card: angka besar, label kecil, ikon domain, dan delta/trend.
- Alert card: background status, ikon alert, pesan singkat.
- Brand gradient card: hero operasional atau modul penting.
- Tahfizh hero card: gradient orange untuk progres hafalan.
- Glass card: hanya untuk nav, overlay, modal, atau panel di atas background brand.

Aturan:

- Card harus punya tujuan jelas: status, aksi, data, atau daftar.
- Jangan membuat card dekoratif tanpa tugas.
- Hindari card di dalam card kecuali list item yang memang perlu frame.
- Shadow harus ringan untuk card berulang.
- Jangan jadikan glassmorphism sebagai default semua card.

## 06 Kartu Sesi

Kartu sesi memakai data dari `SESI_META`.

Struktur minimal:

- Icon square dengan warna sesi.
- Badge status seperti `Aktif`.
- Nama sesi.
- Jam sesi dalam `DM Mono`.
- Deskripsi pendek.
- Progress hadir, misalnya `24/30`.
- Progress bar sesuai warna sesi.

Aturan:

- Warna sesi harus konsisten dengan token sesi.
- Kartu aktif boleh lebih tegas, tetapi tetap mudah discan dalam grid.
- Pada mobile, kartu sesi dapat menjadi list vertikal atau grid 1 kolom.
- Aksi utama sesi harus jelas, misalnya `Buka Presensi`.

## 07 Form & Input

Komponen form yang harus tersedia:

- Text input empty.
- Text input focused.
- Text input valid.
- Text input invalid.
- Disabled input.
- Password input dengan show/hide.
- Search input dengan ikon search.
- Select/dropdown visual.
- Textarea.
- Checkbox.
- Toggle switch.

Aturan input:

- Tinggi input minimal 44px.
- Radius mengikuti `--radius-control` atau `0.875rem`.
- Background input menggunakan surface muted/input.
- Invalid state wajib punya pesan bantuan, bukan border merah saja.
- Search sebaiknya punya clear button bila input aktif.
- Toggle dipakai untuk state biner seperti notifikasi aktif.
- Checkbox dipakai untuk pilihan eksplisit seperti `Tandai semua hadir`.

## 08 Attendance Status

`STATUS_META` adalah sumber kebenaran tunggal untuk warna, ikon, label, dan score status presensi.

Implementasi:

- Semua tabel, row santri, badge, chart, dan filter status harus mengambil warna dari token status.
- Score digunakan untuk kalkulasi disiplin atau evaluasi konsistensi.
- Status `Y` dipakai untuk konteks boolean positif, sedangkan `H` khusus presensi hadir.
- Status `-` dipakai untuk `Tidak`, kosong, atau belum berlaku.

Row santri:

- Avatar/inisial memakai warna status atau role, sesuai konteks.
- Nama santri harus truncate dengan aman.
- Metadata seperti kamar/catatan tampil kecil tapi terbaca.
- Status badge selalu berada di sisi kanan pada row list.

## 09 Toast & Empty State

Toast:

| Type | Warna | Contoh konteks |
| --- | --- | --- |
| Success | `#10B981` | Presensi tersimpan |
| Info | `#3B82F6` | Sesi akan dimulai |
| Warning | `#F59E0B` | Santri belum hadir |
| Error | `#EF4444` | Gagal menyimpan |

Aturan toast:

- Judul singkat dan actionable.
- Deskripsi menjelaskan dampak atau langkah berikutnya.
- Tombol tutup icon-only wajib punya `aria-label`.
- Jangan tampilkan pesan teknis mentah ke pengguna.

Empty state:

- Jelaskan kondisi.
- Jelaskan tindakan berikutnya.
- Tambahkan CTA bila relevan.
- Gunakan shared empty state kecuali konteks membutuhkan ilustrasi khusus.

Contoh empty state:

- Semua santri lengkap.
- Belum ada izin.
- Belum ada setoran.

## 10 Navigation

Navigasi produk utama:

- `Dashboard`
- `Tahfizh`
- `Laporan`
- `Profil`

Catatan: `App.tsx` masih menampilkan contoh `Home` dan `Rekap`; untuk produk final gunakan keputusan label lama: `Dashboard` dan `Laporan`.

Pola navigasi:

- Sticky header untuk halaman design system atau desktop admin.
- Bottom navigation glass untuk mobile PWA.
- Tabs underline untuk mode setara seperti `Rekap`/`Analisis`.
- Segmented control untuk filter/mode setara seperti `Sakit`, `Izin`, `Pulang`.

Bottom navigation:

- Stabil, tidak berubah ukuran saat scroll.
- Icon Lucide + label aktif.
- Active background memakai glow sesuai domain.
- Kontrol utama harus mudah dijangkau jempol.
- Hormati safe area di iOS/Android.

## 11 Glassmorphism

Pola resmi:

- Dark nav glass: `bg-slate-950/90`, `backdrop-blur-xl`, `border-white/10`, `rounded-full`, shadow floating.
- Light glass: `rgba(255,255,255,0.18)`, blur 16px, border putih transparan.
- Dark glass card: `rgba(2,6,23,0.55)`, blur 16px, border putih 10%.
- Tinted brand glass: blue/cyan transparan untuk panel di atas gradient.

Aturan:

- Gunakan glass untuk nav, header, overlay, modal, atau panel yang menempel di atas background visual.
- Jangan pakai glass sebagai default card operasional karena keterbacaan bisa turun.
- Pastikan kontras teks cukup di atas glass.
- Sediakan fallback surface solid bila blur tidak didukung.

## 12 Statistics & Data Viz

Komponen statistik:

- KPI card.
- Stat grid.
- Progress bar.
- Circular progress.
- Trend area chart.
- Bar chart per kelas.
- Stacked bar komposisi status.
- Horizontal ranking bar.
- Pie chart.
- Donut chart.
- Calendar heatmap.
- Status distribution.
- Comparison card.
- Sparkline.
- Data table.

Aturan data viz:

- Gunakan warna status yang sama dengan `STATUS_META`.
- Gunakan `ResponsiveContainer` untuk chart Recharts.
- Chart harus punya judul, konteks waktu, dan label/metrik yang jelas.
- Jangan mengandalkan pie/donut untuk data yang butuh perbandingan presisi.
- Ranking lebih baik memakai horizontal bar.
- Heatmap cocok untuk presensi bulanan atau streak.
- Angka penting pakai tabular nums.
- Mobile harus tetap bisa discan; tabel lebar perlu scroll horizontal atau versi list/card.

Contoh KPI:

- Total Santri.
- Hadir Hari Ini.
- Telat Hari Ini.
- Alpa Hari Ini.

Contoh status distribution:

- Hadir: emerald.
- Telat: cyan.
- Sakit: amber.
- Izin: blue.
- Alpa: red.

## 13 Streak

Streak adalah pola gamifikasi untuk motivasi konsistensi kehadiran santri.

Tier:

| Tier | Rentang | Visual |
| --- | --- | --- |
| Pemula | 1-6 hari | Orange ringan |
| Konsisten | 7-29 hari | Orange kuat |
| Legenda | 30-99 hari | Deep orange |
| Dewa Api | 100+ hari | Violet/indigo special tier |

Komponen:

- Streak counter compact.
- Broken streak badge.
- Streak profile card aktif.
- Broken streak profile card.
- Streak calendar 4 minggu.
- Milestone badges.
- Streak toast.
- Streak leaderboard.

Aturan:

- Gunakan ikon `Flame` dari Lucide untuk UI utama.
- Emoji boleh dipakai sebagai aksen, tetapi jangan menjadi satu-satunya indikator.
- Streak putus harus disampaikan suportif, bukan menghukum.
- Berikan konteks target berikutnya.
- Leaderboard harus tetap sehat secara motivasi; hindari mempermalukan santri.

## 14 Al-Qur'an & Tahfizh

Modul Qur'an memakai warm palette berbasis orange.

Token domain:

- Primary Tahfizh: `#F97316`.
- Deep warm: `#7C2D12`.
- Strong warm: `#C2410C`.
- Highlight: `#FCD34D`.
- Success hafal: `#10B981`.
- Proses: `#F59E0B`.
- Ulang/kurang serius: `#EF4444`.

Komponen:

- Warm hero `Al-Qur'an & Tahfizh`.
- Arabic typography specimen.
- Ayat display full card.
- Compact ayat mode hafalan.
- Surah list item.
- Juz map 30 juz.
- Form setoran.
- Riwayat setoran.
- Hafalan progress card.

Aturan Arabic/RTL:

- Simpan teks Arab dalam UTF-8 yang benar.
- Gunakan `dir="rtl"` dan `lang="ar"`.
- Gunakan font yang nyaman untuk Arab, di design system saat ini `Rubik`.
- Gunakan line-height longgar untuk ayat.
- Jangan menyalin karakter rusak dari file encoding bermasalah.

Aturan Tahfizh:

- Status hafalan: `Hafal`, `Proses`, `Belum`.
- Nilai setoran: `Lancar`, `Kurang`, `Ulang`.
- Progress juz dan ayat harus menampilkan angka serta bar/circular progress.
- Riwayat setoran harus mudah discan berdasarkan tanggal, surah, ayat, dan nilai.

## 15 Role Icons

Role icon memakai Lucide icon dengan warna dan background khusus.

Role:

| Role | Warna | Background | Ikon |
| --- | --- | --- | --- |
| Santri Kelas 1 | `#2563EB` | `#DBEAFE` | `GraduationCap` + badge `1` |
| Santri Kelas 2 | `#7C3AED` | `#EDE9FE` | `GraduationCap` + badge `2` |
| Santri Kelas 3 | `#059669` | `#D1FAE5` | `GraduationCap` + badge `3` |
| Santri Kelas 4 | `#D97706` | `#FEF3C7` | `GraduationCap` + badge `4` |
| Santri Kelas 5 | `#0891B2` | `#CFFAFE` | `GraduationCap` + badge `5` |
| Santri Kelas 6 | `#4F46E5` | `#E0E7FF` | `GraduationCap` + badge `6` |
| Program Unggulan | `#B45309` | `#FEF3C7` | `Star` |
| Program Internasional | `#0C81E4` | `#E0F2FE` | `Globe` |
| Musyrif | `#0C4E8C` | `#DBEAFE` | `ClipboardList` |
| Pamong | `#78350F` | `#FEF3C7` | `UserCheck` |
| Mujanib | `#374151` | `#F3F4F6` | `Wrench` |
| Guru | `#1D4ED8` | `#DBEAFE` | `BookMarked` |
| Direksi | `#0C1F3D` | `#E0E7FF` | `Crown` |
| Satpam | `#1F2937` | `#F3F4F6` | `ShieldCheck` |
| Dokter | `#0891B2` | `#CFFAFE` | `Stethoscope` |
| Perawat | `#BE185D` | `#FCE7F3` | `HeartPulse` |

Size scale:

| Box | Icon | Radius | Penggunaan |
| --- | --- | --- | --- |
| 20px | 10px | `rounded-md` | Badge list |
| 32px | 14px | `rounded-xl` | Row item |
| 48px | 18px | `rounded-2xl` | Card |
| 56px | 22px | `rounded-2xl` | Profile |
| 80px | 28px | `rounded-3xl` | Detail page |

Aturan:

- Role icon boleh muncul bersama status badge, tetapi jangan menggantikan status.
- Badge angka kelas harus tetap terbaca di ukuran kecil.
- Gunakan warna role untuk identitas, warna status untuk kondisi presensi.

## 16 Radius & Elevation

Radius:

| Nama | Nilai | Penggunaan |
| --- | --- | --- |
| Chip | `0.5rem` / 8px | Badge kecil, chip compact |
| Control | `0.875rem` / 14px | Button, input, select |
| Panel | `1.5rem` / 24px | Card besar, modal content, section panel |
| Full/Pill | `999px` | Pill button, bottom nav, filter chip |

Catatan gabungan dari keputusan lama:

- Control: 12-14px.
- Card operasional: 16-24px tergantung density.
- Modal/bottom sheet: 20-24px.
- Pill/chip: full radius.

Elevation:

| Nama | Shadow | Penggunaan |
| --- | --- | --- |
| Elevation 0 | `none` | Flat/table row |
| Elevation 1 | `0 2px 8px -2px rgba(15,23,42,0.08)` | Card resting |
| Elevation 2 | `0 14px 40px -24px rgba(15,23,42,0.28)` | Card default |
| Elevation 3 | `0 18px 46px -26px rgba(12,78,140,0.32)` | Card hover |
| Floating | `0 10px 35px rgba(0,0,0,0.12)` | Bottom controls, nav, overlays |

Aturan:

- Gunakan shadow ringan untuk card data.
- Hindari shadow besar untuk elemen berulang.
- Hover elevation boleh dipakai pada card interaktif.
- Floating shadow hanya untuk elemen yang benar-benar melayang seperti nav, modal, atau bottom controls.

## Mobile UX

- Bottom navigation harus stabil dan tidak berubah ukuran saat scroll.
- Kontrol utama berada di area mudah dijangkau jempol.
- Tabel lebar harus punya alternatif list/card di mobile.
- Bottom sheet harus punya sticky footer action bila form panjang.
- Hormati safe area dan `prefers-reduced-motion`.
- Pastikan text tidak overlap, tidak keluar tombol, dan tetap terbaca pada viewport kecil.

## Workflow Produk

Presensi:

- Target: pengguna dapat menyelesaikan input kelas dengan default hadir lalu mengubah pengecualian.
- Tampilkan progress, autosave, dan aksi massal secara jelas.
- Santri bermasalah harus mudah ditemukan melalui filter/status.

Perizinan:

- Wali tidak perlu mengisi ulang identitas yang sudah diketahui.
- Gunakan step ringkas: jenis izin, detail waktu/alasan, konfirmasi.
- Status izin harus jelas: pending, approved, rejected, aktif, selesai.

Dashboard:

- Musyrif: tampilkan perlu tindakan, presensi saat ini, santri perlu perhatian, lalu ringkasan.
- Wali: tampilkan kondisi anak hari ini, tahfizh terakhir, izin aktif, pembinaan, kontak musyrif.
- Admin/Pengelola: tampilkan monitoring lintas kelas, anomali, audit, dan broadcast.

## Catatan Implementasi

- `App.tsx` saat ini adalah halaman specimen. Saat diterjemahkan ke produk, gunakan label produk final dari dokumen ini.
- Jangan menyalin karakter encoding rusak dari `App.tsx`; simpan dokumen dan source dalam UTF-8.
- Komponen yang menyimpan state visual di specimen perlu dipecah menjadi komponen reusable bila dipakai di aplikasi utama.
- Token warna/status sebaiknya dipindahkan ke satu file shared agar tidak duplikatif antara design system dan app produksi.
