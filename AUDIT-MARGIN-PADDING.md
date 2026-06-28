# Audit Margin dan Padding

Tanggal audit: 2026-06-28

## Ringkasan

Audit menemukan spacing aplikasi masih campuran antara Tailwind utility langsung, CSS override responsif, dan beberapa style kustom di JavaScript. Secara visual ini bisa bekerja, tetapi maintenance-nya cukup berat karena jarak layout utama sering ditentukan dari beberapa tempat sekaligus.

Temuan utama:

- Spacing paling banyak berada di `index.html`, lalu file modular di `src/pages`, `src/components`, `src/templates`, dan beberapa generator markup di `src/managers`/`src/core`.
- Layout utama sudah punya override responsif di `src/styles/shell.css`, terutama untuk `.tab-content`, kartu dashboard, report, profile, tahfizh, dan bottom navigation.
- Nilai spacing dominan relatif konsisten: `p-3`, `p-4`, `px-2`, `py-2`, `px-4`, `px-3`, `mt-1`, `py-0.5`, `py-3`, `mb-4`, `p-2`, `mb-3`, `mb-2`, `p-6`.
- Risiko terbesar bukan jumlah utility-nya, tetapi override yang bertumpuk dengan `!important`, negative margin dekoratif, dan padding bawah halaman yang tersebar (`pb-32`, `pb-40`, safe-area, dan override CSS).

## Area Paling Padat Spacing

File dengan jumlah kelas margin/padding terbanyak:

| Jumlah | File |
|---:|---|
| 1250 | `index.html` |
| 545 | `src/core/script.js` |
| 199 | `src/pages/tahfizh/tahfizh.html` |
| 193 | `src/pages/dashboard/dashboard.html` |
| 126 | `src/modules/tahfizh/tahfizh-manager.js` |
| 125 | `src/managers/dashboard-manager.js` |
| 123 | `src/pages/profile/profile.html` |
| 113 | `src/pages/admin/admin.html` |
| 110 | `src/pages/report/report.html` |
| 89 | `src/managers/admin-manager.js` |

Catatan: `index.html` tampak masih berisi hasil bundle/markup besar. Bila sumber modular sudah aktif, audit perbaikan sebaiknya difokuskan ke `src/`, lalu build ulang.

## Nilai Spacing yang Paling Sering

Nilai yang paling sering dipakai:

| Jumlah | Kelas |
|---:|---|
| 520 | `p-3` |
| 270 | `p-4` |
| 181 | `px-2` |
| 177 | `py-2` |
| 161 | `px-4` |
| 152 | `px-3` |
| 152 | `mt-1` |
| 139 | `py-0.5` |
| 129 | `py-3` |
| 118 | `mt-0.5` |
| 112 | `py-1` |
| 111 | `mb-1` |
| 108 | `mb-4` |
| 103 | `p-2` |
| 101 | `mb-3` |

Ini menunjukkan sistem spacing praktisnya sudah berkisar di skala 2, 3, 4, 5, 6, dan 8. Yang perlu dirapikan adalah pemakaian sporadis seperti `pt-24`, `pt-28`, `py-24`, negative margin besar, serta arbitrary spacing.

## Temuan Prioritas

### P1 - Padding halaman utama tersebar dan saling override

Lokasi utama:

- `src/layouts/app-layout.html`: `main-content` memakai `p-6 pt-safe pb-32`
- `src/styles/shell.css`: mobile/tablet/desktop mengubah padding `.tab-content` dengan `!important`
- Beberapa halaman memakai padding sendiri, misalnya `src/pages/report/report.html` dengan `p-6 pb-40 pt-safe`

Dampak:

- Ruang bawah halaman bisa terlalu lega atau terlalu sempit tergantung viewport.
- Sulit memastikan konten tidak ketutup bottom nav karena ada beberapa sumber `padding-bottom`.
- Halaman modular bisa terlihat berbeda dari halaman yang dimuat lewat `main-content`.

Rekomendasi:

- Jadikan `.tab-content` sebagai satu-satunya pemilik page padding.
- Halaman di `src/pages/*` sebaiknya tidak memakai `p-6`, `pb-40`, atau `pt-safe` sendiri kecuali ada kebutuhan khusus.
- Buat token/kelas semantik, misalnya `.page-shell`, `.page-stack`, `.safe-bottom-content`.

### P1 - Override `!important` terlalu banyak untuk spacing

Lokasi dominan:

- `src/styles/shell.css`
- `style.css`
- `src/styles/components.css`

Dampak:

- Utility Tailwind di komponen sering kalah oleh CSS global.
- Perbaikan kecil di markup bisa tidak terlihat karena tertimpa aturan global.
- Risiko regresi tinggi saat breakpoint berubah.

Rekomendasi:

- Pertahankan `!important` hanya untuk hardening viewport dan safe-area.
- Pindahkan spacing komponen ke kelas reusable atau langsung di markup sumber.
- Hindari selector panjang seperti `#main-content > .max-w-7xl > .grid...` untuk spacing yang bisa diatur oleh struktur komponen.

### P2 - Negative margin dekoratif tercampur dengan spacing layout

Contoh yang muncul:

- `-mr-16`, `-mt-16`, `-mb-12`, `-ml-12`
- `-mx-5`
- `-mt-8`, `-mr-12`, `-mb-14`

Dampak:

- Negative margin untuk efek dekoratif bisa memicu overflow atau clipping di layar kecil.
- Sulit membedakan mana dekorasi dan mana koreksi layout.

Rekomendasi:

- Negative margin besar hanya boleh dipakai pada elemen dekoratif `absolute` dengan `pointer-events-none`.
- Untuk layout konten, ganti `-mx-*` dengan wrapper scroll/padding yang eksplisit.

### P2 - Spacing kecil sangat granular

Contoh:

- `py-0.5`, `mt-0.5`, `mb-0.5`, `pb-[2px]`, `p-[1px]`, `px-0.5`

Dampak:

- Untuk badge dan micro UI masih wajar.
- Jika dipakai di layout teks/section, hasilnya rentan terlihat tidak rata antar halaman.

Rekomendasi:

- Izinkan granular spacing untuk badge, chip, icon button, dan table density.
- Untuk section/card/header, batasi ke skala utama: `2`, `3`, `4`, `5`, `6`, `8`.

### P2 - Spacing berada di JavaScript generator markup

Lokasi:

- `src/core/script.js`
- `src/managers/dashboard-manager.js`
- `src/managers/admin-manager.js`
- `src/modules/tahfizh/tahfizh-manager.js`

Dampak:

- Audit dan refactor spacing lebih sulit karena markup tidak semuanya ada di template HTML.
- Perubahan design system bisa terlewat di string HTML dalam JS.

Rekomendasi:

- Untuk komponen yang sering muncul, pindahkan markup ke template HTML atau helper render kecil.
- Minimal, samakan kelas container/card/button di JS dengan pola template HTML.

## Standar Spacing yang Disarankan

Gunakan pola berikut sebagai patokan:

| Elemen | Mobile | Desktop |
|---|---:|---:|
| Page padding horizontal | `px-4` | `px-8` |
| Page padding top | `pt-safe` / `pt-5` | `pt-6` sampai `pt-8` |
| Page padding bottom | safe-area + nav height | `pb-6` sampai `pb-8` |
| Section gap | `gap-4` | `gap-5` / `gap-6` |
| Card padding compact | `p-3` | `p-4` |
| Card padding normal | `p-4` / `p-5` | `p-5` / `p-6` |
| Dense table cell | `p-3` / `p-3.5` | `p-3.5` |
| Button compact | `px-3 py-2` | `px-3 py-2` |
| Button normal | `px-4 py-3` | `px-4 py-3` |
| Badge/chip | `px-2 py-0.5` | `px-2.5 py-1` |

## Rekomendasi Urutan Perbaikan

1. Rapikan `src/layouts/app-layout.html` dan `src/styles/shell.css` agar page padding dikendalikan dari satu tempat.
2. Audit halaman utama: dashboard, report, profile, tahfizh, admin. Hilangkan `p-6`, `pb-40`, atau margin wrapper yang bentrok dengan `.tab-content`.
3. Buat utilitas semantik untuk container, card, toolbar, modal body, dan table cell.
4. Pindahkan markup spacing besar dari JS generator ke template/helper bila komponennya sering dipakai.
5. Setelah itu rebuild CSS dan cek screenshot mobile narrow, tablet, dan desktop wide.

## Kesimpulan

Spacing aplikasi belum rusak secara sistemik, tetapi sumber aturannya terlalu tersebar. Fokus terbaik adalah menyatukan page-level padding terlebih dahulu, lalu baru merapikan card/button/table secara bertahap. Perbaikan paling terasa akan datang dari mengurangi override `!important` dan menjadikan `.tab-content` sebagai kontrak layout utama.
