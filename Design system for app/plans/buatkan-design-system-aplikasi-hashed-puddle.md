# Plan: Perbaiki, Perbarui, dan Kembangkan design.md

## Konteks

File `/src/imports/design.md` adalah design system reference resmi untuk Syamsa — Student Activity Attendance and Monitoring System Application (PWA). Dokumen ini dibuat dari reverse engineering aplikasi yang ada, mencakup token, komponen, pola UX, dan audit.

User meminta agar dokumen ini **diperbaiki, diperbarui, dan dikembangkan** — bukan dibuatkan app baru. Output akhir adalah `design.md` yang jauh lebih lengkap, akurat, dan actionable.

---

## Perubahan yang Akan Dilakukan

### 1. Perbaikan (Fix)

- **Typo & bahasa:** konsistensi tulisan (santri, musyrif, capitalize) dan kalimat yang terpotong.
- **Status Telat:** diperbarui dari "Cyan #06b6d4" ke `#17C3D4` (sesuai logo brand) untuk konsistensi penuh.
- **Mermaid diagram:** tambahkan node yang hilang (Wali sub-pages tidak lengkap).
- **Tabel status:** tambahkan kolom CSS var name dan Tailwind class untuk reference cepat.
- **Inkonsistensi section:** ubah dari daftar masalah ke tabel "Status Resolusi" (Resolved / In Progress / Pending).

### 2. Pembaruan (Update)

- **Section 4 – Design Tokens:**
  - Tambahkan nama CSS variable resmi untuk setiap token (`--color-brand-blue`, `--color-status-hadir`, dsb.)
  - Tambahkan blok token dark mode lengkap.
  - Tambahkan sistem gradient resmi (nav active, hero, tahfizh, CTA).
  - Tambahkan elevation/shadow scale bernomor (elevation-1 s/d elevation-4).

- **Section 5 – Layout System:**
  - Tambahkan breakpoint resmi (mobile 375px, tablet 768px, desktop 1024px+).
  - Tambahkan pola safe area: `env(safe-area-inset-*)` untuk iOS PWA.
  - Tambahkan scroll behavior: `overflow-y: auto; -webkit-overflow-scrolling: touch`.

- **Section 6 – Component Library:**
  - Setiap komponen kini punya: Anatomy, Props/Variants, States, Do, Don't, dan Dark Mode note.
  - Tambahkan komponen yang belum ada: Form/Input, Date Picker, File Upload, Progress Bar, Skeleton Loader, Swipe Action Row, Drag Handle.

- **Section 7 – Attendance Design Rules:**
  - Tambahkan tabel CSS vars per status.
  - Tambahkan tap cycle order resmi dengan arah panah.
  - Tambahkan rules untuk sesi locked/holiday/waiting state.

- **Section 8 – Data Visualization Rules:**
  - Tambahkan library standard: Chart.js (existing) + Recharts (web makeover).
  - Tambahkan pola chart per fitur: Donut (dashboard), Bar (laporan), Line (analisis trend), Ring (tahfizh), Heatmap (kalender).

- **Section 9 – UX Patterns:**
  - Tambahkan pattern: Swipe gesture (swipe-to-change-status), Pull-to-refresh, Skeleton loading, Virtual scroll / lazy load.
  - Tambahkan confirmation dialog pattern yang lengkap.
  - Tambahkan offline/PWA state pattern.

### 3. Pengembangan (Develop / Tambahan Baru)

- **Section 15 – Iconography:**
  - Library resmi: Lucide React.
  - Size scale: 14px, 16px, 18px, 20px, 24px, 32px, 40px.
  - Icon per status/fitur tabel.
  - Rules: jangan campur Heroicons/FontAwesome; gunakan `strokeWidth={1.5}` untuk ikon besar.

- **Section 16 – Motion & Animation System:**
  - Skala durasi resmi: instant (0ms), fast (100ms), normal (200ms), slow (350ms), deliberate (500ms).
  - Easing functions: `ease-out` untuk enter, `ease-in` untuk exit, `ease-in-out` untuk repositioning.
  - Rules kapan animasi boleh/tidak boleh.

- **Section 17 – Form & Validation:**
  - States: empty, focused, valid, invalid, disabled, loading.
  - Error message placement: di bawah field, merah, font-size 12px.
  - Pattern untuk form multi-step (input presensi bulk, permit form).

- **Section 18 – PWA & Offline States:**
  - Offline indicator pattern.
  - Sync queue visual feedback.
  - Service worker states: installing, waiting, active.
  - Cache strategy per fitur (presensi local-first, laporan network-first).

- **Section 19 – Permission & Role Matrix:**
  - Tabel visual: role (Musyrif, Wali, Santri, Superadmin) × fitur × akses (View / Edit / None).

- **Section 20 – Design QA Checklist:**
  - Checklist sebelum rilis setiap fitur/screen: light/dark, touch target, safe area, empty/loading/error, role gate, status color, accessibility, export color.

- **Section 21 – Migration Tracker:**
  - Progress tabel untuk setiap inkonsistensi yang ditemukan di audit: siapa yang fix, status (todo/in-progress/done), file target.

---

## Strategi Penulisan

- Bahasa: **Indonesia** (sesuai dokumen asli).
- Format: Markdown dengan heading, tabel, code blocks.
- Mermaid diagram diperbarui inline.
- Tidak menghapus section yang ada — hanya memperluas dan memperbaiki.
- Dokumen target: ~1200–1500 baris (dari 747 baris saat ini, ~2× lipat dengan konten bermakna).

---

## File yang Diubah

| File | Perubahan |
|------|-----------|
| `/workspaces/default/code/src/imports/design.md` | Overwrite dengan versi baru yang diperbaiki, diperbarui, dan dikembangkan |

Tidak ada perubahan pada `App.tsx`, `theme.css`, atau file lain.

---

## Verifikasi

Setelah selesai:
1. File terbuka dan terbaca tanpa error Markdown.
2. Semua tabel memiliki kolom yang rata.
3. Mermaid diagram valid.
4. Tidak ada section lama yang hilang.
5. Semua inkonsistensi lama tetap ada di section audit (dengan status baru).
