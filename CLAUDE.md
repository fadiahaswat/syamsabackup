# CLAUDE.md — Syamsa PWA

Aplikasi PWA untuk operasional asrama/pesantren dengan fitur presensi, izin, tahfizh, dan laporan.

## Project Overview

**Stack:** Vanilla JS + HTML + TailwindCSS, PWA dengan Service Worker
**Platform:** Mobile-first PWA (installable)
**Target Users:** Musyrif, Wali Santri, Admin/Pengelola

## Product Principles

### Role Priorities
- **Musyrif:** Input presensi cepat, approve izin, pantau santri bermasalah
- **Wali Santri:** Lihat kondisi anak, kehadiran, tahfizh, perizinan
- **Admin:** Monitoring lintas kelas, audit, broadcast

### Label Conventions
- Gunakan `Dashboard`, bukan `Home`
- Gunakan `Laporan`, bukan `Rekap`
- Gunakan `Area Pengelolaan` untuk admin
- Copy Wali: personal dan berorientasi anak
- Copy Musyrif/Admin: operasional dan berorientasi tindakan

## Tech Stack

- **Core:** Vanilla JavaScript (ES6+), HTML5
- **Styling:** TailwindCSS + custom CSS variables
- **Data:** LocalStorage + IndexedDB via storage managers
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
```

## Coding Standards

### Immutability (CRITICAL)
Selalu buat object baru, JANGAN mutate existing:
```javascript
// SALAH: Mutation
function updateSantri(santri, status) {
  santri.status = status;
  return santri;
}

// BENAR: Immutable
function updateSantri(santri, status) {
  return { ...santri, status };
}
```

### File Organization
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Organize by feature/domain, not by type
- Managers untuk business logic, components untuk UI

### Naming Conventions
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- HTML/CSS classes: `kebab-case`
- Booleans: `is`, `has`, `should`, `can` prefixes

### Error Handling
- Always handle errors explicitly
- User-friendly messages in UI code
- Log detailed context for debugging
- Never silently swallow errors

### Input Validation
- Validate all user input before processing
- Fail fast with clear error messages
- Never trust external data

## Status Presensi

| Code | Label | Hex | Description |
|------|-------|-----|-------------|
| H | Hadir | #10B981 | Present on time |
| Y | Ya | #10B981 | Boolean yes |
| T | Telat | #17C3D4 | Late |
| S | Sakit | #F59E0B | Sick leave |
| I | Izin | #3B82F6 | Approved leave |
| P | Pulang | #A855F7 | Go home |
| A | Alpa | #EF4444 | Absent without notice |
| - | Tidak | #64748B | Not applicable |

## Sesi Presensi

| Sesi | Time | Color |
|------|------|-------|
| Shubuh | 04:00-06:00 | #22C55E |
| Sekolah | 06:00-15:00 | #17C3D4 |
| Ashar | 15:00-17:00 | #EAB308 |
| Maghrib | 18:00-19:00 | #FB923C |
| Isya | 19:00-21:00 | #8B5CF6 |

## Security Guidelines

### Before Any Commit
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated
- [ ] XSS prevention (sanitize HTML)
- [ ] Authentication/authorization verified
- [ ] Error messages don't leak sensitive data
- [ ] No console.log in production code

### Secret Management
- NEVER hardcode secrets in source code
- Use environment variables or localStorage config
- Validate required secrets at startup

## Development Workflow

1. **Research First** — Check existing patterns in codebase
2. **Plan** — Create implementation plan for complex features
3. **Implement** — Follow coding standards, use immutable patterns
4. **Review** — Check for CRITICAL/HIGH issues
5. **Commit** — Conventional commits format

## Available Skills

| Task | Skill |
|------|-------|
| Code review | `/code-review` |
| Security scan | `/security-review` |
| Simplify code | `/simplify` |
| Run/verify app | `/verify` |

## Key Managers

- `AuthManager` — Authentication dan role management
- `AttendanceManager` — Presensi harian
- `PermitManager` — Perizinan (sakit, izin, pulang)
- `SantriManager` — Data dan profil santri
- `TahfizhManager` — Setoran dan progres hafalan
- `StorageManager` — LocalStorage/IndexedDB operations
- `StateManager` — Global state management
- `ActivityLogger` — Audit trail

## Testing

- Manual testing via browser DevTools
- PWA testing dengan Lighthouse
- Test offline functionality via DevTools > Application > Service Workers

## Color Tokens

```css
--color-brand-deep: #0C4E8C;
--color-brand-blue: #0C81E4;
--color-brand-cyan: #17C3D4;
--color-brand-mint: #4FE7AF;
--color-brand-navy: #0C1F3D;
--color-attendance: #10B981;
--color-tahfizh: #F97316;
--color-report: #3B82F6;
--color-profile: #A855F7;
```