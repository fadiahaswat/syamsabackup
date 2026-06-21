# Syamsa

Struktur proyek ini dipertahankan sederhana karena aplikasi masih berjalan sebagai aplikasi web statis.

## Entry point

- `index.html` adalah halaman utama aplikasi.
- `output.css` adalah hasil build Tailwind.
- `style.css` berisi gaya tambahan yang belum masuk Tailwind.
- `sw.js` dan `manifest.json` mengatur PWA/offline support.

## Folder aktif

- `config/` berisi konfigurasi aplikasi.
- `core/` berisi bootstrap dan logic utama aplikasi.
- `data/` berisi data kelas dan santri.
- `docs/` berisi dokumentasi, checklist, dan design system.
- `features/` berisi fitur mandiri seperti kiblat.
- `managers/` berisi modul pengelola fitur.
- `tahfizh/` berisi modul tahfizh.
- `assets/` berisi ikon, branding, ilustrasi, dan screenshot.
- `src/` berisi sumber CSS untuk proses build Tailwind.

## Arsip

- `_legacy/root-flat-files/` berisi salinan file lama yang sebelumnya berada di root.
- `_legacy/syamsa-main-lama/` adalah snapshot proyek lama.

File di folder arsip tidak dipakai langsung oleh `index.html`.
