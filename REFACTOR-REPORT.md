# REFACTOR REPORT - index.html Modulary Architecture

**Tanggal:** 2026-06-26  
**Status:** PLANNING  
**Target:** Application Shell + Modular Components

---

## 📊 AUDIT SUMMARY

| Metric | Before | After (Target) |
|--------|--------|----------------|
| **File Size** | 424KB | ~30KB |
| **Lines** | 8,221 | ~800 |
| **Components** | 0 | 50+ |
| **Inline CSS** | 3,250 lines | 0 |
| **Modals** | 20 embedded | 20 separate files |
| **Views** | monolithic | 7 separate modules |

---

## 🔍 SECTION BREAKDOWN

### A. HEAD SECTION (Lines 1-3260)

| Component | Lines | Status | Action |
|-----------|-------|--------|--------|
| Meta/Favicon | ~30 | ✅ OK | Keep |
| PWA Manifest | ~5 | ✅ OK | Keep |
| Fonts | ~8 | ✅ OK | Keep |
| CSS Links | ~6 | ✅ OK | Keep |
| Libraries (Lucide, Chart.js, jsPDF) | ~8 | ✅ OK | Keep |
| **Inline CSS (theme vars)** | ~300 | ❌ EXTRACT | Move to `shell.css` |
| **Animation CSS** | ~500 | ❌ EXTRACT | Move to `animations.css` |
| **Component CSS** | ~1,000 | ❌ EXTRACT | Move to `components.css` |
| **Responsive CSS** | ~1,500 | ❌ EXTRACT | Move to `responsive.css` |
| **Dark Mode CSS** | ~200 | ❌ EXTRACT | Move to `dark-mode.css` |

### B. BODY SECTION (Lines 3262-8219)

#### 1. Loading Screen (Lines ~3280-3310)
| Element | Lines | Status |
|---------|-------|--------|
| Loading container | ~20 | ❌ EXTRACT |

#### 2. Onboarding View (Lines ~3316-3431)
| Element | Lines | Status |
|---------|-------|--------|
| Onboarding slider | ~120 | ❌ EXTRACT to `src/pages/auth/onboarding.html` |

#### 3. Login View (Lines ~3433-3678)
| Element | Lines | Status |
|---------|-------|--------|
| Login card | ~250 | ❌ EXTRACT to `src/pages/auth/login.html` |
| Google Auth | embedded | Extract |
| Wali Login Form | embedded | Extract |
| Musyrif Login Form | embedded | Extract |

#### 4. Desktop Sidebar (Lines ~3686-3769)
| Element | Lines | Status |
|---------|-------|--------|
| Sidebar container | ~90 | ❌ EXTRACT to `src/layouts/sidebar-desktop.html` |
| Brand section | ~20 | Extract |
| Nav items | ~40 | Extract |
| User info | ~25 | Extract |

#### 5. Bottom Navigation (Lines ~6483-6567)
| Element | Lines | Status |
|---------|-------|--------|
| Nav container | ~90 | ❌ EXTRACT to `src/layouts/bottom-nav.html` |
| Nav buttons | embedded | Extract |

#### 6. Dashboard/Home (Lines ~3771-4521)
| Element | Lines | Status |
|---------|-------|--------|
| **Header** | ~50 | ❌ EXTRACT to `src/layouts/header.html` |
| Greeting Panel | ~20 | ❌ EXTRACT to `src/pages/dashboard/widgets/greeting.html` |
| Main Card | ~150 | ❌ EXTRACT to `src/pages/dashboard/widgets/main-card.html` |
| Quick Access Grid | ~80 | ❌ EXTRACT to `src/pages/dashboard/widgets/quick-access.html` |
| Weekly Calendar | ~10 | ❌ EXTRACT to `src/pages/dashboard/widgets/weekly-calendar.html` |
| Slot Items | ~10 | ❌ EXTRACT to `src/templates/slot-item.html` |
| Salat Widget | ~80 | ❌ EXTRACT to `src/pages/dashboard/widgets/prayer-widget.html` |
| Permit Management | ~100 | ❌ EXTRACT to `src/pages/dashboard/widgets/permit-widget.html` |
| Stats Card | ~100 | ❌ EXTRACT to `src/pages/dashboard/widgets/stats-card.html` |
| Location Card | ~50 | ❌ EXTRACT to `src/pages/dashboard/widgets/location-card.html` |
| Countdown Widget | ~60 | ❌ EXTRACT to `src/pages/dashboard/widgets/countdown-widget.html` |

#### 7. Notifications Tab (Lines ~4524-4634)
| Element | Lines | Status |
|---------|-------|--------|
| Notification list | ~110 | ❌ EXTRACT to `src/pages/notifications/notifications.html` |
| Filter chips | ~20 | Extract |
| Stats grid | ~40 | Extract |

#### 8. Report Tab (Lines ~4635-5296)
| Element | Lines | Status |
|---------|-------|--------|
| Report header | ~60 | ❌ EXTRACT to `src/pages/report/report.html` |
| Mode tabs | ~30 | Extract |
| Report table | ~50 | Extract |
| Analysis section | ~200 | ❌ EXTRACT to `src/pages/report/analysis.html` |
| Metric cards | ~150 | Extract |

#### 9. Tahfizh Tab (Lines ~5892-6173)
| Element | Lines | Status |
|---------|-------|--------|
| Tahfizh header | ~40 | ❌ EXTRACT to `src/pages/tahfizh/tahfizh.html` |
| Hero card | ~100 | ❌ EXTRACT to `src/pages/tahfizh/widgets/hero-card.html` |
| Beranda page | ~100 | ❌ EXTRACT to `src/pages/tahfizh/pages/beranda.html` |
| Form page | ~40 | ❌ EXTRACT to `src/pages/tahfizh/pages/form.html` |
| Analisis page | ~20 | ❌ EXTRACT to `src/pages/tahfizh/pages/analisis.html` |
| Riwayat page | ~30 | ❌ EXTRACT to `src/pages/tahfizh/pages/riwayat.html` |
| Rekap page | ~10 | ❌ EXTRACT to `src/pages/tahfizh/pages/rekap.html` |
| Sub-nav | ~10 | Extract |
| Templates | ~50 | ❌ EXTRACT to `src/templates/tahfizh/` |

#### 10. Profile Tab (Lines ~5375-5890)
| Element | Lines | Status |
|---------|-------|--------|
| Hero card | ~80 | ❌ EXTRACT to `src/pages/profile/widgets/profile-hero.html` |
| Timesheet | ~90 | ❌ EXTRACT to `src/pages/profile/widgets/timesheet.html` |
| Biodata card | ~50 | ❌ EXTRACT to `src/pages/profile/widgets/biodata-card.html` |
| Pembinaan section | ~100 | ❌ EXTRACT to `src/pages/profile/widgets/pembinaan.html` |
| Permit archive | ~60 | ❌ EXTRACT to `src/pages/profile/widgets/permit-archive.html` |
| System settings | ~50 | ❌ EXTRACT to `src/pages/profile/widgets/system-settings.html` |

#### 11. Admin Tab (Lines ~6175-6480)
| Element | Lines | Status |
|---------|-------|--------|
| Admin header | ~30 | ❌ EXTRACT to `src/pages/admin/admin.html` |
| Sub-nav | ~20 | Extract |
| Operations matrix | ~40 | ❌ EXTRACT to `src/pages/admin/subtabs/operations.html` |
| HR management | ~40 | ❌ EXTRACT to `src/pages/admin/subtabs/hr.html` |
| Tahfizh management | ~40 | ❌ EXTRACT to `src/pages/admin/subtabs/tahfizh.html` |
| Permits management | ~70 | ❌ EXTRACT to `src/pages/admin/subtabs/permits.html` |
| Broadcast | ~30 | ❌ EXTRACT to `src/pages/admin/subtabs/broadcast.html` |
| Logs | ~25 | ❌ EXTRACT to `src/pages/admin/subtabs/logs.html` |

#### 12. Attendance View (Lines ~6570-6686)
| Element | Lines | Status |
|---------|-------|--------|
| Attendance page | ~120 | ❌ EXTRACT to `src/pages/attendance/attendance.html` |
| Search bar | ~25 | ❌ EXTRACT to `src/pages/attendance/widgets/search-bar.html` |
| Summary widget | ~30 | ❌ EXTRACT to `src/pages/attendance/widgets/summary-widget.html` |

#### 13. Qibla View (Lines ~6689-6799)
| Element | Lines | Status |
|---------|-------|--------|
| Qibla page | ~120 | ❌ EXTRACT to `src/pages/qibla/qibla.html` |

#### 14. Modals (Lines ~6801-7985)
| Modal | Lines | Status |
|-------|-------|--------|
| Modal Rekap | ~30 | ❌ EXTRACT to `src/components/modals/modal-rekap.html` |
| Modal Activity | ~30 | ❌ EXTRACT to `src/components/modals/modal-activity.html` |
| Modal Confirm | ~50 | ❌ EXTRACT to `src/components/modals/modal-confirm.html` |
| Modal Wali Permit | ~90 | ❌ EXTRACT to `src/components/modals/modal-wali-permit.html` |
| Modal Musyrif Approval | ~25 | ❌ EXTRACT to `src/components/modals/modal-musyrif-approval.html` |
| Modal Exit Ticket | ~110 | ❌ EXTRACT to `src/components/modals/modal-exit-ticket.html` |
| Modal Edit Wali Permit | ~75 | ❌ EXTRACT to `src/components/modals/modal-edit-wali-permit.html` |
| Modal Delete Wali Permit | ~40 | ❌ EXTRACT to `src/components/modals/modal-delete-wali-permit.html` |
| Modal Permit | ~160 | ❌ EXTRACT to `src/components/modals/modal-permit.html` |
| Modal Bulk Actions | ~40 | ❌ EXTRACT to `src/components/modals/modal-bulk-actions.html` |
| Modal Stat Detail | ~40 | ❌ EXTRACT to `src/components/modals/modal-stat-detail.html` |
| Modal Edit Permit | ~100 | ❌ EXTRACT to `src/components/modals/modal-edit-permit.html` |
| Modal Input Pembinaan | ~110 | ❌ EXTRACT to `src/components/modals/modal-pembinaan.html` |
| Modal GPS Guide | ~140 | ❌ EXTRACT to `src/components/modals/modal-gps-guide.html` |
| Modal Bento Detail | ~70 | ❌ EXTRACT to `src/components/modals/modal-bento-detail.html` |
| Modal Notification Settings | ~30 | ❌ EXTRACT to `src/components/modals/modal-notification-settings.html` |

#### 15. Templates (Lines ~7987-8101)
| Template | Lines | Status |
|---------|-------|--------|
| tpl-slot-item | ~40 | ❌ EXTRACT to `src/templates/slot-item.html` |
| tpl-slot-item-wide | ~40 | ❌ EXTRACT to `src/templates/slot-item-wide.html` |
| tpl-santri-row | ~35 | ❌ EXTRACT to `src/templates/santri-row.html` |
| tpl-activity-btn | ~10 | ❌ EXTRACT to `src/templates/activity-btn.html` |
| Tahfizh Templates | ~50 | ❌ EXTRACT to `src/templates/tahfizh/` |

#### 16. Toast Container (Lines ~3274-3278)
| Element | Lines | Status |
|---------|-------|--------|
| Toast container | ~5 | ❌ EXTRACT to `src/components/shared/toast-container.html` |

---

## 🎯 DEPENDENCY MAP

```
index.html (SHELL)
├── src/styles/shell.css (NEW)
├── src/styles/theme.css (EXISTING)
├── src/styles/components.css (EXISTING)
├── src/styles/base.css (EXISTING)
├── src/styles/report.css (EXISTING)
├── src/js/loader.js (NEW)
├── src/js/router.js (NEW)
└── src/core/script.js (EXISTING)
```

### Layouts
```
layouts/
├── shell.html (mount point)
├── header.html
│   └── (uses: branding assets)
├── sidebar-desktop.html
│   └── (uses: user data from appState)
├── bottom-nav.html
│   └── (uses: route state)
└── app-layout.html
    └── (composes: header + sidebar + main content)
```

### Pages
```
pages/
├── dashboard/
│   ├── dashboard.html
│   └── widgets/
│       ├── greeting.html
│       ├── main-card.html
│       ├── quick-access.html
│       ├── prayer-widget.html
│       ├── stats-card.html
│       ├── permit-widget.html
│       ├── location-card.html
│       └── countdown-widget.html
├── tahfizh/
│   ├── tahfizh.html
│   └── pages/
│       ├── beranda.html
│       ├── form.html
│       ├── analisis.html
│       ├── riwayat.html
│       └── rekap.html
├── report/
│   ├── report.html
│   └── analysis.html
├── profile/
│   ├── profile.html
│   └── widgets/
│       ├── profile-hero.html
│       ├── timesheet.html
│       └── ...
├── notifications/
│   └── notifications.html
├── admin/
│   ├── admin.html
│   └── subtabs/
│       ├── operations.html
│       ├── hr.html
│       └── ...
├── attendance/
│   └── attendance.html
└── auth/
    ├── login.html
    └── onboarding.html
```

### Components
```
components/
├── modals/
│   ├── modal-confirm.html
│   ├── modal-permit.html
│   └── ...
├── dialogs/
│   └── tahfizh-detail.html
├── auth/
│   └── login.html
└── shared/
    ├── toast-container.html
    ├── loading-screen.html
    └── empty-state.html
```

---

## 📁 STRUKTUR FOLDER BARU

```
syamsabackup/
├── index.html                          # Application Shell (NEW - ~800 lines)
├── output.css                          # Tailwind build (unchanged)
├── style.css                           # Additional styles (unchanged)
├── manifest.json                       # PWA manifest (unchanged)
├── sw.js                              # Service worker (unchanged)
│
├── src/
│   ├── js/
│   │   ├── loader.js                  # Component loader (NEW)
│   │   ├── router.js                  # Client-side router (NEW)
│   │   ├── app.js                     # App initialization (NEW)
│   │   │
│   │   ├── config/
│   │   │   └── config.js              # App configuration (EXISTING)
│   │   │
│   │   ├── core/
│   │   │   ├── script.js              # Main script (EXISTING - refactor later)
│   │   │   ├── app-core.js            # Core functions (EXISTING)
│   │   │   ├── app-init.js             # App init (EXISTING)
│   │   │   ├── templates.js           # Template helpers (EXISTING)
│   │   │   ├── constants.js           # Constants (EXISTING)
│   │   │   ├── countdown.js           # Countdown timer (EXISTING)
│   │   │   └── pull-to-refresh.js    # Pull to refresh (EXISTING)
│   │   │
│   │   ├── managers/
│   │   │   ├── attendance-manager.js   # Attendance logic (EXISTING)
│   │   │   ├── tahfizh-manager.js    # Tahfizh logic (EXISTING)
│   │   │   ├── permit-manager.js     # Permit logic (EXISTING)
│   │   │   ├── notification-manager.js (EXISTING)
│   │   │   ├── admin-manager.js       # Admin logic (EXISTING)
│   │   │   ├── state-manager.js      # State management (EXISTING)
│   │   │   ├── storage-manager.js    # Storage logic (EXISTING)
│   │   │   └── ...
│   │   │
│   │   ├── modules/
│   │   │   └── tahfizh/
│   │   │       ├── tahfizh-module.js (EXISTING)
│   │   │       └── ...
│   │   │
│   │   ├── features/
│   │   │   └── qibla.js             # Qibla feature (EXISTING)
│   │   │
│   │   └── data/
│   │       ├── data-kelas.js         # Class data (EXISTING)
│   │       └── data-santri.js        # Student data (EXISTING)
│   │
│   ├── styles/
│   │   ├── shell.css                 # Shell layout styles (NEW)
│   │   ├── theme.css                 # CSS variables (EXISTING)
│   │   ├── base.css                  # Reset/typography (EXISTING)
│   │   ├── components.css            # UI components (EXISTING)
│   │   ├── report.css               # Report styles (EXISTING)
│   │   └── pages/                   # Page-specific styles (NEW)
│   │       ├── dashboard.css
│   │       ├── tahfizh.css
│   │       ├── report.css
│   │       ├── profile.css
│   │       └── admin.css
│   │
│   ├── layouts/                      # Layout components (NEW)
│   │   ├── shell.html               # Root mount point
│   │   ├── header.html             # Dashboard header
│   │   ├── sidebar-desktop.html     # Desktop sidebar
│   │   ├── bottom-nav.html         # Mobile bottom nav
│   │   └── app-layout.html         # Full app layout
│   │
│   ├── pages/                       # Page components (NEW)
│   │   ├── dashboard/
│   │   │   ├── dashboard.html
│   │   │   └── widgets/
│   │   │       ├── greeting.html
│   │   │       ├── main-card.html
│   │   │       ├── quick-access.html
│   │   │       ├── prayer-widget.html
│   │   │       ├── stats-card.html
│   │   │       ├── permit-widget.html
│   │   │       ├── location-card.html
│   │   │       ├── countdown-widget.html
│   │   │       └── weekly-calendar.html
│   │   │
│   │   ├── tahfizh/
│   │   │   ├── tahfizh.html
│   │   │   ├── tahfizh-header.html
│   │   │   ├── sub-nav.html
│   │   │   ├── pages/
│   │   │   │   ├── beranda.html
│   │   │   │   ├── form.html
│   │   │   │   ├── analisis.html
│   │   │   │   ├── riwayat.html
│   │   │   │   └── rekap.html
│   │   │   └── widgets/
│   │   │       ├── hero-card.html
│   │   │       ├── progress-card.html
│   │   │       └── peringkat.html
│   │   │
│   │   ├── report/
│   │   │   ├── report.html
│   │   │   └── analysis.html
│   │   │
│   │   ├── profile/
│   │   │   ├── profile.html
│   │   │   └── widgets/
│   │   │       ├── profile-hero.html
│   │   │       ├── biodata-card.html
│   │   │       ├── timesheet.html
│   │   │       ├── permit-archive.html
│   │   │       ├── pembinaan.html
│   │   │       └── system-settings.html
│   │   │
│   │   ├── notifications/
│   │   │   └── notifications.html
│   │   │
│   │   ├── admin/
│   │   │   ├── admin.html
│   │   │   └── subtabs/
│   │   │       ├── operations.html
│   │   │       ├── hr.html
│   │   │       ├── tahfizh.html
│   │   │       ├── permits.html
│   │   │       ├── broadcast.html
│   │   │       └── logs.html
│   │   │
│   │   ├── attendance/
│   │   │   ├── attendance.html
│   │   │   ├── attendance-header.html
│   │   │   └── widgets/
│   │   │       ├── search-bar.html
│   │   │       └── summary-widget.html
│   │   │
│   │   ├── qibla/
│   │   │   └── qibla.html
│   │   │
│   │   └── auth/
│   │       ├── login.html
│   │       └── onboarding.html
│   │
│   ├── components/                  # Reusable components (NEW)
│   │   ├── modals/
│   │   │   ├── modal-confirm.html
│   │   │   ├── modal-permit.html
│   │   │   ├── modal-wali-permit.html
│   │   │   ├── modal-musyrif-approval.html
│   │   │   ├── modal-exit-ticket.html
│   │   │   ├── modal-edit-wali-permit.html
│   │   │   ├── modal-delete-wali-permit.html
│   │   │   ├── modal-bulk-actions.html
│   │   │   ├── modal-stat-detail.html
│   │   │   ├── modal-edit-permit.html
│   │   │   ├── modal-pembinaan.html
│   │   │   ├── modal-gps-guide.html
│   │   │   ├── modal-bento-detail.html
│   │   │   ├── modal-notification-settings.html
│   │   │   ├── modal-rekap.html
│   │   │   └── modal-activity.html
│   │   │
│   │   ├── dialogs/
│   │   │   ├── tahfizh-detail.html
│   │   │   └── tahfizh-confirm.html
│   │   │
│   │   └── shared/
│   │       ├── toast-container.html
│   │       ├── loading-screen.html
│   │       ├── loading-overlay.html
│   │       └── empty-state.html
│   │
│   └── templates/                    # Reusable templates (NEW)
│       ├── slot-item.html
│       ├── slot-item-wide.html
│       ├── Santri-row.html
│       ├── activity-btn.html
│       └── tahfizh/
│           ├── jadwal-perpulangan.html
│           ├── accordion-item.html
│           ├── peringkat-section.html
│           ├── peringkat-item.html
│           ├── tahfizh-section.html
│           ├── tahfizh-content.html
│           ├── history-row.html
│           ├── rekap-content.html
│           ├── rekap-row.html
│           ├── juz-block.html
│           ├── analisis-prompt.html
│           └── analisis-dashboard.html
│
├── assets/
│   ├── icons/                      # App icons (unchanged)
│   ├── branding/                   # Branding assets (unchanged)
│   └── ...
│
└── docs/
    └── design.md                    # Design system (unchanged)
```

---

## 📝 FILE LIST

### Files to CREATE (NEW)
| Path | Lines | Priority |
|------|-------|----------|
| `src/js/loader.js` | ~100 | HIGH |
| `src/js/router.js` | ~80 | HIGH |
| `src/js/app.js` | ~50 | HIGH |
| `src/styles/shell.css` | ~300 | HIGH |
| `src/styles/pages/*.css` | ~500 total | MEDIUM |
| `src/layouts/shell.html` | ~50 | HIGH |
| `src/layouts/header.html` | ~60 | HIGH |
| `src/layouts/sidebar-desktop.html` | ~100 | HIGH |
| `src/layouts/bottom-nav.html` | ~100 | HIGH |
| `src/layouts/app-layout.html` | ~30 | HIGH |
| `src/pages/dashboard/dashboard.html` | ~50 | HIGH |
| `src/pages/auth/login.html` | ~250 | HIGH |
| `src/pages/auth/onboarding.html` | ~120 | MEDIUM |
| `src/pages/tahfizh/tahfizh.html` | ~40 | MEDIUM |
| `src/pages/tahfizh/pages/*.html` | ~200 total | MEDIUM |
| `src/pages/report/report.html` | ~60 | MEDIUM |
| `src/pages/report/analysis.html` | ~200 | MEDIUM |
| `src/pages/profile/profile.html` | ~50 | MEDIUM |
| `src/pages/notifications/notifications.html` | ~110 | LOW |
| `src/pages/admin/admin.html` | ~30 | MEDIUM |
| `src/pages/admin/subtabs/*.html` | ~250 total | LOW |
| `src/pages/attendance/attendance.html` | ~40 | MEDIUM |
| `src/pages/qibla/qibla.html` | ~120 | LOW |
| `src/components/modals/*.html` | ~1000 total | HIGH |
| `src/components/shared/*.html` | ~100 total | MEDIUM |
| `src/templates/*.html` | ~300 total | MEDIUM |

### Files to UPDATE
| Path | Changes |
|------|---------|
| `index.html` | Rewrite as Application Shell (~800 lines) |
| `src/styles/theme.css` | Add shell-specific variables |
| `src/core/script.js` | Add component mounting logic |

### Files to DELETE (after migration)
| Path | Reason |
|------|--------|
| None initially | Keep all files during migration for rollback |

---

## 🔧 IMPLEMENTATION STEPS

### Phase 1: Foundation (HIGH PRIORITY)
1. Create `src/js/loader.js` - Component loader
2. Create `src/js/router.js` - Router
3. Create `src/styles/shell.css` - Shell layout styles
4. Extract critical CSS from index.html to shell.css
5. Create minimal Application Shell (index.html)

### Phase 2: Layout Components (HIGH PRIORITY)
6. Create `src/layouts/shell.html` - Mount point
7. Create `src/layouts/header.html`
8. Create `src/layouts/sidebar-desktop.html`
9. Create `src/layouts/bottom-nav.html`
10. Update index.html to use layouts

### Phase 3: Core Pages (MEDIUM PRIORITY)
11. Create `src/pages/auth/login.html`
12. Create `src/pages/auth/onboarding.html`
13. Create `src/pages/dashboard/dashboard.html`
14. Extract dashboard widgets

### Phase 4: Feature Pages (MEDIUM PRIORITY)
15. Create Tahfizh pages
16. Create Report pages
17. Create Profile pages
18. Create Admin pages
19. Create Attendance page
20. Create Qibla page
21. Create Notifications page

### Phase 5: Components (MEDIUM PRIORITY)
22. Extract all modals
23. Extract shared components
24. Extract templates

### Phase 6: Polish (LOW PRIORITY)
25. Add page-specific CSS files
26. Add lazy loading for non-critical pages
27. Optimize initial load
28. Test all functionality

---

## ⚠️ RISK ASSESSMENT

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|-------------|
| Breaking functionality | HIGH | MEDIUM | Test after each phase |
| CSS conflicts | MEDIUM | MEDIUM | Use unique prefixes |
| Event handlers lost | HIGH | HIGH | Update script.js references |
| Performance regression | LOW | LOW | Monitor load times |
| State management issues | MEDIUM | LOW | Keep existing state |

---

## 🧪 TESTING CHECKLIST

### Functional Tests
- [ ] Login flow works
- [ ] Onboarding works
- [ ] Dashboard loads correctly
- [ ] All tabs switch properly
- [ ] Bottom navigation works
- [ ] Sidebar navigation works (desktop)
- [ ] Attendance input works
- [ ] Permit modals open/close
- [ ] Tahfizh form submits
- [ ] Report generation works
- [ ] Admin functions work
- [ ] Qibla page works
- [ ] Dark mode works
- [ ] Responsive layout works

### Performance Tests
- [ ] Initial load time < 2s
- [ ] Tab switch time < 100ms
- [ ] Memory usage stable
- [ ] No duplicate DOM elements

### Compatibility Tests
- [ ] Chrome mobile
- [ ] Chrome desktop
- [ ] Safari iOS
- [ ] Firefox
- [ ] Edge

---

## 📦 MIGRATION STRATEGY

### Step-by-Step Migration

1. **Backup Current State**
   ```bash
   git commit -m "pre-refactor: backup index.html"
   ```

2. **Create Shell Structure**
   ```bash
   mkdir -p src/{layouts,pages/{dashboard/widgets,tahfizh/{pages,widgets},report,profile/widgets,notifications,admin/subtabs,attendance/widgets,qibla,auth},components/{modals,dialogs,shared},templates/tahfizh,styles/pages}
   ```

3. **Extract CSS First**
   - Copy theme.css variables to shell.css
   - Extract all CSS rules to appropriate files

4. **Extract Layout Components**
   - Create shell.html
   - Test basic rendering

5. **Extract One Page at a Time**
   - Start with login page
   - Test thoroughly
   - Proceed to next page

6. **Continuous Testing**
   - Test after each extraction
   - Fix issues immediately

---

## 🎯 SUCCESS CRITERIA

1. **index.html reduced to ~800 lines** (from 8,221)
2. **All functionality preserved** (no regressions)
3. **Components are reusable** (can be imported multiple times)
4. **Clear separation of concerns** (layouts, pages, components)
5. **Maintainable code** (easy to find and edit)
6. **Performance improved** (faster initial load)
7. **Scalable architecture** (easy to add new features)

---

## 📚 DOCUMENTATION

After refactoring, update:
- [ ] README.md - Update project structure
- [ ] CLAUDE.md - Add architecture notes
- [ ] Inline comments in key files
- [ ] API documentation for loader.js

---

**Last Updated:** 2026-06-26  
**Next Action:** Start Phase 1 - Create loader.js and router.js
