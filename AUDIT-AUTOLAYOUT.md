# Audit Autolayout & Responsive Spacing

Tanggal Audit: 2026-06-30

## 1. Fixed Pixel Dimensions (Lebar/Tinggi Tetap)
Penggunaan ukuran piksel tetap (`w-[...px]` atau inline style) dapat merusak sifat responsif dari Autolayout.

| File | Baris | Kode / Kelas |
| --- | --- | --- |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 3 | `h-[130px]` |
| [modal-edit-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-permit.html) | 7 | `w-[400px]` |
| [loading-overlay.html](file:///D:/syamsa-backup/syamsabackup/src/components/shared/loading-overlay.html) | 7 | `w-[160px]` |
| [loading-screen.html](file:///D:/syamsa-backup/syamsabackup/src/components/shared/loading-screen.html) | 7 | `w-[220px]` |
| [loading-screen.html](file:///D:/syamsa-backup/syamsabackup/src/components/shared/loading-screen.html) | 7 | `w-[280px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 3675 | `w-[76px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 3718 | `w-[52px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 4670 | `w-[64px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 4673 | `w-[150px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 4709 | `w-[58px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 7346 | `w-[160px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 7668 | `w-[76px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 7675 | `w-[76px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 7723 | `w-[96px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 11410 | `w-[220px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 13763 | `w-[120px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 3344 | `h-[52px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 3464 | `h-[52px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 7169 | `h-[40px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 7191 | `h-[500px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 8964 | `style="max-height: 340px` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 9312 | `h-[64px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 9430 | `h-[124px]` |
| [script.js](file:///D:/syamsa-backup/syamsabackup/src/core/script.js) | 12996 | `h-[130px]` |
| [admin-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/admin-manager.js) | 919 | `w-[150px]` |
| [admin-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/admin-manager.js) | 1070 | `w-[150px]` |
| [admin-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/admin-manager.js) | 1385 | `w-[200px]` |
| [admin-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/admin-manager.js) | 1981 | `w-[150px]` |
| [attendance-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/attendance-manager.js) | 164 | `w-[240px]` |
| [attendance-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/attendance-manager.js) | 390 | `w-[64px]` |
| [attendance-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/attendance-manager.js) | 393 | `w-[150px]` |
| [attendance-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/attendance-manager.js) | 429 | `w-[58px]` |
| [dashboard-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/dashboard-manager.js) | 1383 | `w-[220px]` |
| [dashboard-widgets.js](file:///D:/syamsa-backup/syamsabackup/src/managers/dashboard-widgets.js) | 41 | `w-[100px]` |
| [notification-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/notification-manager.js) | 1273 | `w-[18px]` |
| [notification-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/notification-manager.js) | 1273 | `h-[18px]` |
| [tab-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/tab-manager.js) | 161 | `w-[100px]` |
| [tab-manager.js](file:///D:/syamsa-backup/syamsabackup/src/managers/tab-manager.js) | 161 | `w-[140px]` |
| [tahfizh-manager.js](file:///D:/syamsa-backup/syamsabackup/src/modules/tahfizh/tahfizh-manager.js) | 1101 | `h-[60px]` |
| [attendance.html](file:///D:/syamsa-backup/syamsabackup/src/pages/attendance/attendance.html) | 66 | `w-[380px]` |
| [login.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/login.html) | 49 | `h-[100px]` |
| [login.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/login.html) | 58 | `h-[18px]` |
| [login.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/login.html) | 232 | `h-[20px]` |
| [login.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/login.html) | 233 | `h-[22px]` |
| [login.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/login.html) | 234 | `h-[18px]` |
| [onboarding.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/onboarding.html) | 37 | `w-[280px]` |
| [onboarding.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/onboarding.html) | 37 | `w-[320px]` |
| [onboarding.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/onboarding.html) | 50 | `w-[280px]` |
| [onboarding.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/onboarding.html) | 50 | `w-[320px]` |
| [onboarding.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/onboarding.html) | 63 | `w-[280px]` |
| [onboarding.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/onboarding.html) | 63 | `w-[320px]` |
| [onboarding.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/onboarding.html) | 76 | `w-[280px]` |
| [onboarding.html](file:///D:/syamsa-backup/syamsabackup/src/pages/auth/onboarding.html) | 76 | `w-[320px]` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 81 | `w-[240px]` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 122 | `w-[24px]` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 130 | `w-[24px]` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 138 | `w-[24px]` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 146 | `w-[24px]` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 1060 | `w-[700px]` |
| [countdown-widget.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/widgets/countdown-widget.html) | 23 | `w-[24px]` |
| [countdown-widget.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/widgets/countdown-widget.html) | 31 | `w-[24px]` |
| [countdown-widget.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/widgets/countdown-widget.html) | 39 | `w-[24px]` |
| [countdown-widget.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/widgets/countdown-widget.html) | 47 | `w-[24px]` |
| [greeting.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/widgets/greeting.html) | 2 | `w-[240px]` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 186 | `w-[120px]` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 186 | `w-[140px]` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 371 | `w-[140px]` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 305 | `h-[260px]` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 403 | `h-[420px]` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 566 | `h-[160px]` |
| [pembinaan.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/widgets/pembinaan.html) | 55 | `h-[260px]` |
| [permit-archive.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/widgets/permit-archive.html) | 3 | `h-[420px]` |
| [qibla.html](file:///D:/syamsa-backup/syamsabackup/src/pages/qibla/qibla.html) | 9 | `w-[520px]` |
| [qibla.html](file:///D:/syamsa-backup/syamsabackup/src/pages/qibla/qibla.html) | 10 | `w-[360px]` |
| [qibla.html](file:///D:/syamsa-backup/syamsabackup/src/pages/qibla/qibla.html) | 9 | `h-[520px]` |
| [qibla.html](file:///D:/syamsa-backup/syamsabackup/src/pages/qibla/qibla.html) | 10 | `h-[360px]` |
| [analysis.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/analysis.html) | 133 | `w-[150px]` |
| [report-section.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report-section.html) | 74 | `w-[680px]` |
| [report-section.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report-section.html) | 82 | `w-[160px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 17 | `w-[170px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 17 | `w-[240px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 146 | `w-[680px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 154 | `w-[160px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 327 | `w-[150px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 686 | `w-[600px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 881 | `w-[600px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 915 | `w-[500px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 943 | `w-[500px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 994 | `w-[500px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 1045 | `w-[700px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 1125 | `w-[600px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 17 | `h-[15px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 17 | `h-[18px]` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 993 | `h-[300px]` |
| [riwayat.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/pages/riwayat.html) | 20 | `w-[680px]` |
| [riwayat.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/pages/riwayat.html) | 20 | `w-[180px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 16 | `w-[170px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 16 | `w-[240px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 362 | `w-[680px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 362 | `w-[180px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 377 | `w-[200px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 385 | `w-[700px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 527 | `w-[680px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 531 | `w-[150px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 16 | `h-[15px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 16 | `h-[18px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 505 | `h-[300px]` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 520 | `h-[300px]` |
| [analisis-dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/templates/tahfizh/analisis-dashboard.html) | 13 | `w-[150px]` |
| [rekap-content.html](file:///D:/syamsa-backup/syamsabackup/src/templates/tahfizh/rekap-content.html) | 1 | `w-[680px]` |
| [tahfizh-content.html](file:///D:/syamsa-backup/syamsabackup/src/templates/tahfizh/tahfizh-content.html) | 62 | `h-[300px]` |
| [tahfizh-content.html](file:///D:/syamsa-backup/syamsabackup/src/templates/tahfizh/tahfizh-content.html) | 77 | `h-[300px]` |

## 2. Grid Tanpa Responsivitas (`grid-cols-X` Tanpa Breakpoint)
Grid layout dengan beberapa kolom yang tidak menyesuaikan jumlah kolomnya di layar kecil (mobile) dapat menyebabkan konten terpotong atau terlalu sempit.

| File | Baris | Kelas Grid |
| --- | --- | --- |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 37 | `grid grid-cols-6 gap-1.5` |
| [modal-edit-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-permit.html) | 35 | `grid grid-cols-2 gap-3` |
| [modal-edit-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-wali-permit.html) | 50 | `grid grid-cols-2 gap-4` |
| [modal-exit-ticket.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-exit-ticket.html) | 53 | `grid grid-cols-2 gap-4` |
| [modal-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-permit.html) | 86 | `grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar` |
| [modal-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-permit.html) | 115 | `grid grid-cols-3 gap-2` |
| [modal-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-permit.html) | 199 | `grid grid-cols-2 gap-2` |
| [modal-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-permit.html) | 222 | `grid grid-cols-2 gap-2` |
| [modal-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-permit.html) | 252 | `grid grid-cols-2 gap-2` |
| [modal-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-wali-permit.html) | 30 | `grid grid-cols-2 gap-4` |
| [modal-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-wali-permit.html) | 63 | `grid grid-cols-2 gap-4` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 255 | `grid grid-cols-4 gap-1.5 sm:gap-3` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 358 | `grid grid-cols-5 gap-2 sm:gap-3` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 450 | `grid grid-cols-2 gap-3 sm:gap-4 w-full auto-rows-max` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 567 | `grid grid-cols-3 gap-1.5 sm:gap-2` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 816 | `grid grid-cols-2 gap-2.5 mt-0` |
| [dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/dashboard.html) | 985 | `grid grid-cols-2 gap-2.5 mt-0` |
| [main-card.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/widgets/main-card.html) | 67 | `grid grid-cols-5 gap-2 sm:gap-3` |
| [other-slots.html](file:///D:/syamsa-backup/syamsabackup/src/pages/dashboard/widgets/other-slots.html) | 1 | `grid grid-cols-2 gap-3 sm:gap-4 w-full auto-rows-max` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 64 | `grid grid-cols-2 gap-2` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 114 | `grid grid-cols-2 gap-2 text-xs font-bold` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 232 | `grid grid-cols-7 gap-2 text-center mb-3` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 242 | `grid grid-cols-7 gap-1.5 sm:gap-2 text-center` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 276 | `mb-4 grid grid-cols-3 gap-2` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 319 | `grid grid-cols-4 gap-1 text-center` |
| [profile.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/profile.html) | 546 | `grid grid-cols-2 gap-2` |
| [pembinaan.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/widgets/pembinaan.html) | 26 | `mb-4 grid grid-cols-3 gap-2` |
| [pembinaan.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/widgets/pembinaan.html) | 69 | `grid grid-cols-4 gap-1 text-center` |
| [profile-hero.html](file:///D:/syamsa-backup/syamsabackup/src/pages/profile/widgets/profile-hero.html) | 60 | `grid grid-cols-2 gap-2` |
| [qibla.html](file:///D:/syamsa-backup/syamsabackup/src/pages/qibla/qibla.html) | 95 | `grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-lg text-center` |
| [analysis.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/analysis.html) | 64 | `grid grid-cols-4 gap-1 p-1 bg-slate-100/80 dark:bg-slate-950/60 rounded-xl border border-slate-200/50 dark:border-slate-800` |
| [analysis.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/analysis.html) | 142 | `grid grid-cols-3 gap-2 mt-3` |
| [analysis.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/analysis.html) | 189 | `mt-1.5 grid grid-cols-2 gap-1.5` |
| [analysis.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/analysis.html) | 235 | `grid grid-cols-2 gap-1.5` |
| [analysis.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/analysis.html) | 238 | `grid grid-cols-2 gap-3 md:col-span-2` |
| [report-section.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report-section.html) | 3 | `bg-slate-100/80 dark:bg-slate-950/60 p-1 rounded-xl grid grid-cols-4 min-w-0` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 75 | `bg-slate-100/80 dark:bg-slate-950/60 p-1 rounded-xl grid grid-cols-4 min-w-0` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 258 | `grid grid-cols-4 gap-1 p-1 bg-slate-100/80 dark:bg-slate-950/60 rounded-xl border border-slate-200/50 dark:border-slate-800` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 336 | `grid grid-cols-3 gap-2 mt-3` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 383 | `mt-1.5 grid grid-cols-2 gap-1.5` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 429 | `grid grid-cols-2 gap-1.5` |
| [report.html](file:///D:/syamsa-backup/syamsabackup/src/pages/report/report.html) | 432 | `grid grid-cols-2 gap-3 md:col-span-2` |
| [beranda.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/pages/beranda.html) | 36 | `tahfizh-hero-stats relative z-10 mt-4 grid grid-cols-3 gap-2` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 141 | `grid grid-cols-3 gap-2 sm:gap-3` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 462 | `mt-3 grid grid-cols-3 gap-2` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 529 | `block-grid grid grid-cols-5 gap-1.5` |
| [tahfizh.html](file:///D:/syamsa-backup/syamsabackup/src/pages/tahfizh/tahfizh.html) | 531 | `grid grid-cols-3 gap-2.5 mt-4` |
| [analisis-dashboard.html](file:///D:/syamsa-backup/syamsabackup/src/templates/tahfizh/analisis-dashboard.html) | 23 | `grid grid-cols-3 gap-2.5 mt-4` |
| [juz-block.html](file:///D:/syamsa-backup/syamsabackup/src/templates/tahfizh/juz-block.html) | 1 | `block-grid grid grid-cols-5 gap-1.5` |
| [tahfizh-content.html](file:///D:/syamsa-backup/syamsabackup/src/templates/tahfizh/tahfizh-content.html) | 19 | `mt-3 grid grid-cols-3 gap-2` |

## 3. Flexbox Tanpa Spacing Gap (`flex` Tanpa `gap-X`)
Penggunaan flexbox tanpa gap memaksa developer menggunakan margin manual di setiap child element. Direkomendasikan menggunakan kelas `gap` pada parent untuk pengelolaan jarak yang lebih konsisten.

| File | Baris | Kelas Flex |
| --- | --- | --- |
| [modal-activity.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-activity.html) | 3 | `fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-md hidden flex items-end sm:items-center justify-center p-4` |
| [modal-activity.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-activity.html) | 6 | `bg-white dark:bg-slate-900 w-full max-w-lg rounded-[1.75rem] p-6 max-h-[85vh] flex flex-col shadow-2xl animate-slide-up border border-white/10` |
| [modal-activity.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-activity.html) | 8 | `flex justify-between items-center mb-6` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 1 | `fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md hidden opacity-0 transition-opacity duration-300` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 2 | `bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-100 dark:border-slate-800/80 w-full max-w-sm overflow-hidden shadow-2xl transform scale-95 transition-transform duration-300 flex flex-col` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 3 | `relative p-6 text-white flex flex-col justify-end min-h-[130px] bg-emerald-500` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 4 | `absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-colors` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 9 | `w-12 h-12 rounded-2xl flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/10 text-white` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 20 | `flex justify-between items-center` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 26 | `flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 38 | `flex flex-col items-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 39 | `flex flex-col items-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 40 | `flex flex-col items-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 41 | `flex flex-col items-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 42 | `flex flex-col items-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50` |
| [modal-bento-detail.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bento-detail.html) | 43 | `flex flex-col items-center py-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50` |
| [modal-bulk-actions.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bulk-actions.html) | 3 | `fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md hidden flex items-end sm:items-center justify-center p-4 transition-all` |
| [modal-bulk-actions.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bulk-actions.html) | 8 | `flex justify-between items-center mb-6` |
| [modal-bulk-actions.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-bulk-actions.html) | 11 | `w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center` |
| [modal-confirm.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-confirm.html) | 12 | `w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 mx-auto mb-4 flex items-center justify-center` |
| [modal-delete-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-delete-wali-permit.html) | 1 | `fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md hidden flex items-end sm:items-center justify-center p-4 transition-all` |
| [modal-delete-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-delete-wali-permit.html) | 2 | `bg-white dark:bg-slate-900 w-full max-w-sm rounded-[1.75rem] p-6 animate-slide-up border border-white/10 shadow-2xl flex flex-col max-h-[90vh]` |
| [modal-delete-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-delete-wali-permit.html) | 3 | `flex flex-col items-center text-center` |
| [modal-delete-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-delete-wali-permit.html) | 4 | `w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-4` |
| [modal-edit-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-permit.html) | 9 | `flex justify-between items-center mb-6` |
| [modal-edit-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-permit.html) | 59 | `flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700` |
| [modal-edit-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-permit.html) | 64 | `relative inline-flex items-center cursor-pointer` |
| [modal-edit-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-wali-permit.html) | 1 | `fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md hidden flex items-end sm:items-center justify-center p-4 transition-all` |
| [modal-edit-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-wali-permit.html) | 2 | `bg-white dark:bg-slate-900 w-full max-w-lg rounded-[1.75rem] p-6 animate-slide-up border border-white/10 shadow-2xl flex flex-col max-h-[90vh]` |
| [modal-edit-wali-permit.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-edit-wali-permit.html) | 3 | `flex justify-between items-center mb-4` |
| [modal-exit-ticket.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-exit-ticket.html) | 1 | `fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md hidden flex items-end sm:items-center justify-center p-4 transition-all` |
| [modal-exit-ticket.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-exit-ticket.html) | 2 | `bg-white dark:bg-slate-950 w-full max-w-md rounded-[1.75rem] p-6 animate-slide-up border border-slate-200/10 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh]` |
| [modal-exit-ticket.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-exit-ticket.html) | 4 | `flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3` |
| [modal-exit-ticket.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-exit-ticket.html) | 24 | `flex justify-between items-start z-10` |
| [modal-exit-ticket.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-exit-ticket.html) | 34 | `w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-extrabold text-sm shadow-md` |
| [modal-exit-ticket.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-exit-ticket.html) | 72 | `flex justify-between items-center bg-slate-200/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 p-3 rounded-2xl z-10 relative` |
| [modal-exit-ticket.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-exit-ticket.html) | 84 | `flex flex-col items-center justify-center bg-white rounded-2xl p-3 z-10 shadow-inner` |
| [modal-gps-guide.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-gps-guide.html) | 3 | `fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md hidden flex items-center justify-center p-4 transition-all` |
| [modal-gps-guide.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-gps-guide.html) | 6 | `bg-white dark:bg-slate-900 w-full max-w-md rounded-[1.75rem] p-6 sm:p-8 animate-slide-up border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh]` |
| [modal-gps-guide.html](file:///D:/syamsa-backup/syamsabackup/src/components/modals/modal-gps-guide.html) | 8 | `flex justify-between items-start mb-4` |
| ... | ... | *(Total 381 temuan)* |

## 4. Icon di Flexbox Tanpa `shrink-0` / `flex-shrink-0`
Ikon di dalam container flexbox sering terdistorsi (menyusut) saat teks di sebelahnya terlalu panjang jika tidak diberi kelas `shrink-0`.

*Semua ikon sudah menggunakan shrink-0.*

