# Syriansa PWA

Aplikasi PWA untuk operasional asrama/pesantren dengan fitur presensi, izin, tahfizh, dan laporan.

## Tech Stack

- **Core:** Vanilla JavaScript (ES6+), HTML5
- **Styling:** TailwindCSS + custom CSS variables
- **Data:** LocalStorage + IndexedDB
- **PWA:** Service Worker, Web App Manifest
- **Icons:** Lucide Icons
- **Charts:** Recharts

## File Structure

```
src/
├── js/           # App logic, router, loader
├── managers/     # Business logic (auth, attendance, tahfizh, permit, etc.)
├── components/   # HTML templates, modals
├── pages/        # Page components (dashboard, tahfizh, report, profile)
├── layouts/      # Shell, navigation
├── styles/       # Base, components, theme CSS
├── core/         # Constants, templates
├── shared/       # Utilities
└── data/         # Static data (kelas, metadata)

root/
├── index.html    # Entry point
├── sw.js         # Service Worker
├── manifest.json # PWA manifest
├── style.css     # Custom styles
└── output.css    # Tailwind build output
```

## User Roles

| Role | Description |
|------|-------------|
| Musyrif | Input presensi cepat, approve izin, pantau santri |
| Wali Santri | Lihat kondisi anak, kehadiran, tahfizh, perizinan |
| Admin | Monitoring lintas kelas, audit, broadcast |

## Key Features

- **Presensi** — Multi-sesi harian (Shubuh, Sekolah, Ashar, Maghrib, Isya)
- **Perizinan** — Pengajuan dan approve izin (sakit, pulang, dll)
- **Tahfizh** — Setoran dan progres hafalan Al-Quran
- **Laporan** — Visualisasi data kehadiran dan hafalan

## Development

```bash
# Install dependencies
npm install

# Build Tailwind CSS
npm run build:css

# Watch mode for development
npm run watch:css

# Start local server
npx serve .
```

## Testing

- Manual testing via browser DevTools
- PWA testing dengan Lighthouse
- Offline functionality via DevTools > Application > Service Workers

---

Project instructions dan coding standards tersedia di [CLAUDE.md](CLAUDE.md).
