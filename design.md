# Syamsa Design System

Status: baseline awal dari audit UI/UX, 26 Juni 2026.

## Prinsip Produk

Syamsa adalah aplikasi operasional harian. Desain harus membantu pengguna menyelesaikan tugas cepat, bukan hanya terlihat ramai atau dekoratif.

Prioritas role:

- Musyrif: input presensi cepat, approve izin, pantau santri bermasalah, rekap harian.
- Wali Santri: kondisi anak, kehadiran anak, tahfizh anak, pembinaan anak, perizinan, kontak musyrif.
- Admin: monitoring lintas kelas, akun wali, audit, broadcast, dan data sistem.

## Navigasi

Gunakan label utama yang konsisten:

- Dashboard
- Tahfizh
- Laporan
- Profil

Admin adalah area pengelolaan, bukan label umum untuk semua pengguna. Tampilkan hanya untuk role admin/pengelola.

## Token Visual

Warna utama:

- Brand: `#0C81E4`
- Brand hover: `#0C4E8C`
- Mint/accent: `#4FE7AF`
- Tahfizh: orange (`#F97316` atau token Tailwind orange-500)
- Danger: red/rose
- Warning: amber
- Success: emerald

Radius:

- Control: 12-14px
- Card operasional: 16-20px
- Modal/bottom sheet: 20-24px
- Pill/chip: full radius

Shadow:

- Gunakan shadow ringan untuk card data.
- Hindari shadow besar untuk elemen yang muncul berulang.
- Gunakan backdrop blur hanya untuk nav, overlay, atau modal; jangan jadikan default semua card.

## Typography

- Hindari `font-black` untuk semua elemen.
- Gunakan heading bold untuk judul halaman atau angka penting.
- Gunakan semibold untuk label aksi.
- Hindari teks 8-9px untuk informasi penting.
- Body dan metadata penting minimal 12px di mobile.
- Jangan terlalu sering memakai uppercase dan tracking lebar pada label operasional.

## Komponen

Button:

- Primary: satu aksi utama per layar.
- Secondary: aksi pendukung.
- Ghost/icon: hanya untuk aksi familiar, wajib punya `aria-label`.
- Touch target minimum 44px, ideal 48px.

Card:

- Card harus punya tujuan jelas: status, aksi, data, atau daftar.
- Jangan membuat card dekoratif tanpa tugas.
- Hindari card di dalam card kecuali item list yang memang perlu frame.

Badge:

- Status: pending, approved, rejected, active.
- Count: angka tugas.
- Tag/domain: Tahfizh, Presensi, Perizinan.
- Jangan mengandalkan warna saja; selalu sertakan teks.

Empty state:

- Jelaskan kondisi.
- Jelaskan tindakan berikutnya.
- Tambahkan CTA bila relevan.

Error state:

- Jelaskan masalah dengan bahasa pengguna.
- Beri tindakan pemulihan.
- Hindari pesan teknis mentah.

## Mobile UX

- Bottom navigation harus stabil dan tidak berubah ukuran saat scroll.
- Kontrol utama berada di area mudah dijangkau jempol.
- Tabel lebar harus punya alternatif list/card di mobile.
- Bottom sheet harus punya sticky footer action bila form panjang.
- Hormati safe area dan `prefers-reduced-motion`.

## Pola Workflow

Presensi:

- Target: pengguna dapat menyelesaikan input kelas dengan default hadir + ubah pengecualian.
- Tampilkan progress, autosave, dan aksi massal secara jelas.

Perizinan:

- Wali tidak perlu mengisi ulang identitas yang sudah diketahui.
- Gunakan step ringkas: jenis izin, detail waktu/alasan, konfirmasi.

Dashboard:

- Musyrif: tampilkan perlu tindakan, presensi saat ini, santri perlu perhatian, lalu ringkasan.
- Wali: tampilkan kondisi anak hari ini, tahfizh terakhir, izin aktif, pembinaan, kontak musyrif.

