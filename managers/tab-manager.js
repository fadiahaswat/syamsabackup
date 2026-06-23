// File: tab-manager.js

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Fade out backdrop using motion standard duration (200ms) and standard ease exit
  modal.style.opacity = "0";
  modal.style.transition = "opacity var(--motion-standard) var(--ease-exit)";

  const children = Array.from(modal.children);
  const panel = children.length > 1 ? children[1] : children[0];
  if (panel) {
    panel.style.opacity = "0";
    panel.style.transform = "scale(0.95) translateY(12px)";
    panel.style.transition = "opacity var(--motion-standard) var(--ease-exit), transform var(--motion-standard) var(--ease-exit)";
  }

  const index = modalStack.indexOf(modalId);
  if (index > -1) modalStack.splice(index, 1);

  if (modal._escHandler) {
    document.removeEventListener("keydown", modal._escHandler);
    delete modal._escHandler;
  }

  modal.removeAttribute("aria-modal");
  modal.removeAttribute("role");

  // Wait for transition animation to finish before adding hidden class
  setTimeout(() => {
    if (modal.style.opacity === "0") {
      modal.classList.add("hidden");
      // Reset inline styles
      modal.style.opacity = "";
      modal.style.transition = "";
      if (panel) {
        panel.style.opacity = "";
        panel.style.transform = "";
        panel.style.transition = "";
      }
    }
  }, 200); // 200ms matches --motion-standard
};


window.showToast = function (message, type = "info", isPersistent = false) {
  if (!appState.settings.notifications && !isPersistent) return;

  const container = document.getElementById("toast-container");
  if (!container) return;

  // PERBAIKAN: Cegah Toast Dobel dengan mengecek pesan yang identik
  const existingToasts = container.querySelectorAll(".toast-msg-text");
  for (let i = 0; i < existingToasts.length; i++) {
    if (existingToasts[i].textContent === message) {
      // Batalkan pembuatan toast baru jika pesan yang sama persis masih ada di layar
      return existingToasts[i].closest(".toast-element");
    }
  }

  const toast = document.createElement("div");
  const icons = {
    success: "check-circle",
    error: "x-circle",
    warning: "alert-triangle",
    info: "info",
  };

  // Tambahkan class penanda 'toast-element' agar lebih mudah diidentifikasi
  // Motion: animate-toast-enter (250ms ease-enter) - using motion tokens from design system
  toast.className = `toast-element ${UI_COLORS[type] || UI_COLORS.info} text-white px-4 sm:px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-toast-enter mb-3 z-[9999] cursor-pointer pointer-events-auto`;

  // Tambahkan class penanda 'toast-msg-text' pada bagian teks
  toast.innerHTML = `
        <i data-lucide="${icons[type] || "info"}" class="w-5 h-5" aria-hidden="true"></i>
        <span class="toast-msg-text font-bold text-xs" role="alert">${window.sanitizeHTML(message)}</span>
    `;

  // Fitur Tambahan: Toast sekarang bisa ditutup instan jika di-klik/disentuh (Anti-annoying)
  // Motion: toast-exit (200ms ease-exit) untuk keluar smooth
  toast.onclick = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    toast.style.transition = "opacity 200ms cubic-bezier(0.4, 0, 1, 1), transform 200ms cubic-bezier(0.4, 0, 1, 1)";
    setTimeout(() => toast.remove(), 200);
  };

  container.appendChild(toast);
  window.refreshIcons();

  if (!isPersistent) {
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      toast.style.transition = "opacity 200ms cubic-bezier(0.4, 0, 1, 1), transform 200ms cubic-bezier(0.4, 0, 1, 1)";
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  } else {
    setTimeout(() => toast.remove(), 10000);
  }

  return toast;
};


window.toggleDarkMode = function () {
  document.documentElement.classList.toggle("dark");
  appState.settings.darkMode =
    document.documentElement.classList.contains("dark");
  localStorage.setItem(
    APP_CONFIG.settingsKey,
    JSON.stringify(appState.settings),
  );
  window.showToast(
    `Mode ${appState.settings.darkMode ? "Gelap" : "Terang"} Aktif`,
    "success",
  );
};


// ==========================================
// 9. TABS & NAVIGATION
// ==========================================

window.switchTab = function (tabName) {
  // 1. Sembunyikan semua konten tab
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.add("hidden"));

  // 2. Atur visibilitas Main Content (Dashboard)
  const mainContent = document.getElementById("main-content");
  if (tabName === "home") {
    mainContent.classList.remove("hidden");
  } else {
    mainContent.classList.add("hidden");
  }

  // 3. Tampilkan Tab Target (Laporan/Profil/Analisis)
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.remove("hidden");

  // 4. Update Style Tombol Navigasi
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (btn.dataset.target === tabName) {
      btn.classList.add("active");
      if (tabName === "tahfizh") {
        btn.classList.add("text-orange-500");
        btn.classList.remove("text-emerald-500", "text-slate-400");
      } else {
        btn.classList.add("text-emerald-500");
        btn.classList.remove("text-orange-500", "text-slate-400");
      }
    } else {
      btn.classList.remove("active", "text-emerald-500", "text-orange-500");
      btn.classList.add("text-slate-400");
    }
  });

  // 5. Jalankan Logika Spesifik per Tab
  if (tabName === "home") {
    window.updateDashboard();
  } else if (tabName === "report") {
    window.updateReportTab();
  } else if (tabName === "tahfizh") {
    if (window.initTahfizhTab) {
      window.initTahfizhTab();
    }
  } else if (tabName === "profile") {
    appState.timesheetViewDate = appState.date; // <--- TAMBAHKAN INI
    window.updateProfileStats();
    window.renderTimesheetCalendar();
    window.renderPembinaanManagement(); // Refresh list di profil
    window.renderPermitHistory();
  } else if (tabName === "permits") {
    if (typeof window.initPermitsTab === "function") window.initPermitsTab();
  } else if (tabName === "fasting") {
    if (typeof window.initFastingTab === "function") window.initFastingTab();
  } else if (tabName === "performance") {
    if (typeof window.initPerformanceTab === "function") window.initPerformanceTab();
  } else if (tabName === "notifications") {
    if (typeof window.fetchNotifications === "function") {
      window.fetchNotifications();
    }
  }
  // 6. Refresh Icon Lucide
  if (window.lucide) window.lucide.createIcons();
};

// Grade helpers - delegates to centralized functions in app-core.js
window.getGrade = function (score) {
  return typeof getGrade === 'function' ? getGrade(score) : (function(s) {
    if (s >= 97) return "A";
    if (s >= 93) return "A-";
    if (s >= 89) return "B+";
    if (s >= 85) return "B";
    if (s >= 80) return "B-";
    if (s >= 75) return "C+";
    if (s >= 70) return "C";
    return "D";
  })(score);
};

window.getPredikat = function (grade) {
  return typeof getPredikat === 'function' ? getPredikat(grade) : (function(g) {
    if (g === "A" || g === "A-") return "Mumtaz";
    if (g === "B+" || g === "B") return "Jayyid Jiddan";
    if (g === "B-" || g === "C+") return "Jayyid";
    return "Maqbul";
  })(grade);
};

window.updateReportTab = function () {
  const tbody = document.getElementById("daily-recap-tbody");
  const rangeLabel = document.getElementById("report-date-range");
  const thead = document.querySelector("#tab-report thead tr");

  if (thead) {
    let headerHTML = `
            <th class="p-3 font-bold w-8 text-center">No</th>
            <th class="p-3 font-bold min-w-[100px] sm:min-w-[140px]">Nama Santri</th>
        `;

    if (appState.reportMode === "daily") {
      headerHTML += `
                <th class="p-3 text-center">Shalat</th>
                <th class="p-3 text-center">Sekolah</th>
                <th class="p-3 text-center">Ma'had</th>
                <th class="p-3 text-center">Sunnah</th>
            `;
    } else if (
      appState.reportMode === "weekly" ||
      appState.reportMode === "monthly"
    ) {
      headerHTML += `
                <th class="p-3 text-center">Shalat %</th>
                <th class="p-3 text-center">Sekolah %</th>
                <th class="p-3 text-center">Ma'had %</th>
                <th class="p-3 text-center">Sunnah %</th>
                <th class="p-3 text-center">Tren</th>
            `;
    } else if (appState.reportMode === "semester") {
      headerHTML += `
                <th class="p-3 text-center">Shalat</th>
                <th class="p-3 text-center">Sekolah</th>
                <th class="p-3 text-center">Ma'had</th>
                <th class="p-3 text-center">Sunnah</th>
                <th class="p-3 text-center">Grade</th>
                <th class="p-3 text-center">Tren</th>
            `;
    }

    thead.innerHTML = headerHTML;
  }

  if (!tbody) return;
  tbody.innerHTML = "";

  const range = window.getReportDateRange(appState.reportMode);
  if (rangeLabel) rangeLabel.textContent = range.label;

  const colspan = appState.reportMode === "semester" ? 8 : (appState.reportMode === "weekly" || appState.reportMode === "monthly" ? 7 : 6);

  if (!appState.selectedClass || FILTERED_SANTRI.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="${colspan}" class="p-4 text-center text-xs text-slate-400">Pilih kelas terlebih dahulu</td></tr>`;
    return;
  }

  // Use centralized STATUS_SCORE from app-core.js
  const getPoint = (status) => window.getStatusScore?.(status) ?? (window.STATUS_SCORE?.[status] ?? 0);

  // OPTIMIZATION: Use Map for O(1) lookup
  const santriStatsMap = new Map();
  FILTERED_SANTRI.forEach((s) => {
    santriStatsMap.set(s.nis || s.id, {
      shalat: {
        score: 0,
        total: 0,
        h: 0,
      },

      sunnah: {
        score: 0,
        total: 0,
        y: 0,
      },

      sekolah: {
        score: 0,
        total: 0,
        h: 0,
      },

      mahad: {
        score: 0,
        total: 0,
        h: 0,
      },
    });
  });

  // OPTIMIZATION: Pre-calculate date range (avoid while loop)
  const startTime = range.start.getTime();
  const endTime = range.end.getTime();
  const dayInMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.min(
    Math.ceil((endTime - startTime) / dayInMs) + 1,
    370,
  );
  const trendPrevRange = (() => {
    if (appState.reportMode === "weekly") {
      const prevBase = new Date(range.start);
      prevBase.setDate(prevBase.getDate() - 7);
      return window.getDateRange("weekly", window.getLocalDateStr(prevBase));
    }
    if (appState.reportMode === "monthly") {
      const prevBase = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
      return window.getDateRange("monthly", window.getLocalDateStr(prevBase));
    }
    if (appState.reportMode === "semester") {
      const prevBase = new Date(range.start.getFullYear(), range.start.getMonth() - 6, 1);
      return window.getDateRange("semester", window.getLocalDateStr(prevBase));
    }
    return null;
  })();

  for (let i = 0; i < totalDays; i++) {
    const currentDate = new Date(startTime + i * dayInMs);
    const dateKey = window.getLocalDateStr(currentDate);
    const dayNum = currentDate.getDay();
    const dayData = appState.attendanceData[dateKey];

    if (!dayData) continue;

    Object.values(SLOT_WAKTU).forEach((slot) => {
      if (window.isSlotHoliday(slot.id, dateKey)) return;
      const slotData = dayData[slot.id];
      if (!window.isAttendanceSlotFinalForReport(slotData)) return;

      FILTERED_SANTRI.forEach((s) => {
        const id = String(s.nis || s.id);
        const sData = slotData?.[id];
        const stats = santriStatsMap.get(id);

        if (!sData || !stats) return;

        slot.activities.forEach((act) => {
          if (act.showOnDays && !act.showOnDays.includes(dayNum)) return;
          if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return;
          if (window.isActivityHoliday(dateKey, slot.id, act.id)) return;
          if (window.isCategoryHoliday(dateKey, act.category)) return;

          const st = sData.status[act.id];

          const point = getPoint(st) ?? 0;

          if (act.category === "fardu") {
            stats.shalat.score += point;
          } else if (act.category === "sunnah") {
            stats.sunnah.score += point;
          } else if (act.category === "school") {
            stats.sekolah.score += point;
          } else if (act.category === "kbm") {
            stats.mahad.score += point;
          }

          if (act.category === "fardu") {
            stats.shalat.total++;

            if (st === "Hadir" || st === "Telat") {
              stats.shalat.h++;
            }
          } else if (act.category === "school") {
            stats.sekolah.total++;

            if (st === "Hadir" || st === "Telat") {
              stats.sekolah.h++;
            }
          } else if (act.category === "kbm") {
            stats.mahad.total++;

            if (st === "Hadir" || st === "Telat") {
              stats.mahad.h++;
            }
          } else if (act.category === "sunnah") {
            stats.sunnah.total++;

            if (st === "Ya" || st === "Hadir") {
              stats.sunnah.y++;
            }
          }
        });
      });
    });
  }

  // RENDER with DocumentFragment
  const fragment = document.createDocumentFragment();
  const makeBar = (pct, color) => {
    const hasValue = pct !== null && pct !== undefined;
    const safePct = hasValue ? Math.max(0, Math.min(100, pct)) : 0;
    return `
        <div class="flex flex-col items-center">
            <span class="text-[10px] font-bold ${!hasValue ? "text-slate-400" : pct < 60 ? "text-red-500" : "text-slate-600"}">${hasValue ? `${pct}%` : "-"}</span>
            <div class="w-8 sm:w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full ${hasValue ? color : "bg-slate-300"} transition-all duration-300" style="width: ${safePct}%"></div>
            </div>
        </div>`;
  };
  const renderTrend = (currentScore, previousScore) => {
    if (currentScore === null) {
      return `<span class="inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 px-2 py-1 text-[10px] font-black">Belum</span>`;
    }
    if (previousScore === null) {
      return `<span class="inline-flex items-center gap-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 px-2 py-1 text-[10px] font-black"><i data-lucide="sparkles" class="w-3 h-3"></i> Baru</span>`;
    }
    const diff = currentScore - previousScore;
    if (diff >= 5) {
      return `<span class="inline-flex items-center gap-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-2 py-1 text-[10px] font-black"><i data-lucide="trending-up" class="w-3 h-3"></i> Naik ${diff}</span>`;
    }
    if (diff <= -5) {
      return `<span class="inline-flex items-center gap-1 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 px-2 py-1 text-[10px] font-black"><i data-lucide="trending-down" class="w-3 h-3"></i> Turun ${Math.abs(diff)}</span>`;
    }
    return `<span class="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 text-[10px] font-black"><i data-lucide="minus" class="w-3 h-3"></i> Stabil</span>`;
  };

  FILTERED_SANTRI.forEach((s, idx) => {
    const id = String(s.nis || s.id);
    const stats = santriStatsMap.get(id);
    if (!stats) return;

    const shalatPct = stats.shalat.total
      ? stats.shalat.score / stats.shalat.total
      : 0;

    const sunnahPct = stats.sunnah.total
      ? stats.sunnah.score / stats.sunnah.total
      : 0;

    const sekolahPct = stats.sekolah.total
      ? stats.sekolah.score / stats.sekolah.total
      : 0;

    const mahadPct = stats.mahad.total
      ? stats.mahad.score / stats.mahad.total
      : 0;

    const scoreList = [];

    if (stats.shalat.total > 0) scoreList.push(shalatPct);

    if (stats.sekolah.total > 0) scoreList.push(sekolahPct);

    if (stats.mahad.total > 0) scoreList.push(mahadPct);

    if (stats.sunnah.total > 0) scoreList.push(sunnahPct);

    const hasReportScore = scoreList.length > 0;
    const finalScore = hasReportScore
      ? Math.round(scoreList.reduce((a, b) => a + b, 0) / scoreList.length)
      : null;

    const shalatGrade = stats.shalat.total ? window.getGrade(Math.round(shalatPct)) : "-";

    const sunnahGrade = stats.sunnah.total ? window.getGrade(Math.round(sunnahPct)) : "-";

    const sekolahGrade = stats.sekolah.total ? window.getGrade(Math.round(sekolahPct)) : "-";

    const mahadGrade = stats.mahad.total ? window.getGrade(Math.round(mahadPct)) : "-";

    const shalatPredikat = stats.shalat.total ? window.getPredikat(shalatGrade) : "Tidak dinilai";

    const sunnahPredikat = stats.sunnah.total ? window.getPredikat(sunnahGrade) : "Tidak dinilai";

    const sekolahPredikat = stats.sekolah.total ? window.getPredikat(sekolahGrade) : "Tidak dinilai";

    const mahadPredikat = stats.mahad.total ? window.getPredikat(mahadGrade) : "Tidak dinilai";

    const grade = hasReportScore ? window.getGrade(finalScore) : "-";

    const predikat = hasReportScore ? window.getPredikat(grade) : "Tidak dinilai";

    const tr = document.createElement("tr");
    tr.className =
      "hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors border-b border-slate-50 dark:border-slate-700/50";

    let shalatCol, schoolCol, kbmCol, sunnahCol;
    let trendCol = "";

    if (appState.reportMode === "daily") {
      const dateKey = appState.reportDate || appState.date;
      const dayData = appState.attendanceData[dateKey] || {};

      let badges = "";
      ["shubuh", "ashar", "maghrib", "isya"].forEach((sid) => {
        const meta = window.getDailyReportStatusMeta(
          dateKey,
          sid,
          id,
          "shalat",
        );
        const label = meta.status && !["Libur", "Proses"].includes(meta.status)
          ? sid[0].toUpperCase()
          : meta.label;
        badges += `<span class="w-5 h-5 flex items-center justify-center rounded ${meta.className} text-[9px] font-black" aria-label="${meta.aria}">${label}</span>`;
      });
      shalatCol = `<div class="flex justify-center gap-1" role="list">${badges}</div>`;

      const schoolMeta = window.getDailyReportStatusMeta(
        dateKey,
        "sekolah",
        id,
        "kbm_sekolah",
      );
      if (schoolMeta.status === "Hadir") {
        schoolMeta.className = "bg-cyan-100 text-cyan-600 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30";
      }
      schoolCol = `<div class="flex justify-center"><span class="w-6 h-6 flex items-center justify-center rounded-lg ${schoolMeta.className} text-[10px] font-black shadow-sm" aria-label="${schoolMeta.aria}">${schoolMeta.label}</span></div>`;

      const isKbmActiveToday = window.isReportCategoryActiveOnDate(dateKey, "kbm");
      const isSunnahActiveToday = window.isReportCategoryActiveOnDate(dateKey, "sunnah");
      kbmCol = stats.mahad.total
        ? `<span class="font-bold text-slate-600 dark:text-slate-400">${stats.mahad.h}</span>`
        : `<span class="font-bold ${isKbmActiveToday ? "text-slate-300" : "text-slate-400"}">${isKbmActiveToday ? "-" : "L"}</span>`;
      sunnahCol = stats.sunnah.total
        ? `<span class="font-bold text-slate-600 dark:text-slate-400">${stats.sunnah.y}</span>`
        : `<span class="font-bold ${isSunnahActiveToday ? "text-slate-300" : "text-slate-400"}">${isSunnahActiveToday ? "-" : "L"}</span>`;
    } else {
      const pctShalat = stats.shalat.total
        ? Math.round(stats.shalat.score / stats.shalat.total)
        : null;

      const pctSekolah = stats.sekolah.total
        ? Math.round(stats.sekolah.score / stats.sekolah.total)
        : null;

      const pctMahad = stats.mahad.total
        ? Math.round(stats.mahad.score / stats.mahad.total)
        : null;

      const pctSunnah = stats.sunnah.total
        ? Math.round(stats.sunnah.score / stats.sunnah.total)
        : null;

      shalatCol = makeBar(pctShalat, "bg-emerald-500");
      schoolCol = makeBar(pctSekolah, "bg-cyan-500");
      kbmCol = makeBar(pctMahad, "bg-blue-500");
      sunnahCol = makeBar(pctSunnah, "bg-amber-500");
      if ((appState.reportMode === "weekly" || appState.reportMode === "monthly") && trendPrevRange) {
        const previous = window.calculateReportScoreForStudentRange(id, trendPrevRange);
        trendCol = renderTrend(finalScore, previous.score);
      }
    }

    if (appState.reportMode === "semester" && trendPrevRange) {
      const previous = window.calculateReportScoreForStudentRange(id, trendPrevRange);
      trendCol = renderTrend(finalScore, previous.score);
    }

    let scoreColor = "text-slate-400";
    if (hasReportScore && finalScore >= 85) scoreColor = "text-emerald-500";
    else if (hasReportScore && finalScore >= 70) scoreColor = "text-blue-500";
    else if (hasReportScore && finalScore >= 50) scoreColor = "text-amber-500";
    else if (hasReportScore) scoreColor = "text-red-500";

    let gradeCells = "";

    if (appState.reportMode === "semester") {
      gradeCells = `
                <td class="p-3 text-center">
        
                    <div class="font-black text-lg">
                        ${shalatGrade}
                    </div>
        
                    <div class="text-[9px] text-slate-500">
                        ${shalatPredikat}
                    </div>
        
                </td>
        
                <td class="p-3 text-center">
        
                    <div class="font-black text-lg">
                        ${sekolahGrade}
                    </div>
        
                    <div class="text-[9px] text-slate-500">
                        ${sekolahPredikat}
                    </div>
        
                </td>
        
                <td class="p-3 text-center">
        
                    <div class="font-black text-lg">
                        ${mahadGrade}
                    </div>
        
                    <div class="text-[9px] text-slate-500">
                        ${mahadPredikat}
                    </div>
        
                </td>

                <td class="p-3 text-center">

                    <div class="font-black text-lg">
                        ${sunnahGrade}
                    </div>
                
                    <div class="text-[9px] text-slate-500">
                        ${sunnahPredikat}
                    </div>
                
                </td>
        
                <td class="p-3 text-center">
        
                    <div class="font-black ${scoreColor} text-lg">
                        ${grade}
                    </div>
        
                    <div class="text-[9px] text-slate-500">
                        ${predikat}
                    </div>
        
                </td>

                <td class="p-3 text-center">
                    ${trendCol}
                </td>
            `;
    }

    tr.innerHTML = `
            <td class="p-3 text-center text-slate-500 text-[10px] font-bold">
                ${idx + 1}
            </td>
        
            <td class="p-3">
                <div onclick="window.openStudentDetail('${s.nis || s.id}')" class="font-bold text-slate-700 dark:text-slate-200 text-xs cursor-pointer hover:underline hover:text-emerald-500 transition-colors">
                    ${window.sanitizeHTML(s.nama)}
                </div>
            </td>
        
            ${
              appState.reportMode === "semester"
                ? gradeCells
                : `
                    <td class="p-3 text-center align-middle">
                        ${shalatCol}
                    </td>
        
                    <td class="p-3 text-center align-middle bg-cyan-50/30 dark:bg-cyan-900/10 border-x border-cyan-100 dark:border-cyan-900/20">
                        ${schoolCol}
                    </td>
        
                    <td class="p-3 text-center align-middle">
                        ${kbmCol}
                    </td>
        
                    <td class="p-3 text-center align-middle">
                        ${sunnahCol}
                    </td>
                    ${
                      appState.reportMode === "weekly" || appState.reportMode === "monthly"
                        ? `<td class="p-3 text-center align-middle">${trendCol}</td>`
                        : ""
                    }
                `
            }
        `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
};

window.updateProfileStats = function () {
  if (!appState.selectedClass) return;

  // Hitung rata-rata
  let totalPercent = 0,
    daysCount = 0;

  // Loop semua tanggal yang ada di DB
  Object.keys(appState.attendanceData).forEach((dateKey) => {
    const dailyStats = { h: 0, total: 0 };
    let hasData = false;

    // Loop Slots
    Object.values(SLOT_WAKTU).forEach((slot) => {
      const stats = window.calculateSlotStats(slot.id, dateKey);
      if (stats.isFilled) {
        dailyStats.h += stats.h;
        dailyStats.total += stats.total;
        hasData = true;
      }
    });

    if (hasData) {
      const pct = dailyStats.total === 0 ? 0 : dailyStats.h / dailyStats.total;
      totalPercent += pct;
      daysCount++;
    }
  });

  const avgEl = document.getElementById("profile-avg-attendance");
  if (avgEl) {
    const avg =
      daysCount === 0 ? 0 : Math.round((totalPercent / daysCount) * 100);
    avgEl.textContent = avg + "%";
  }

  const daysEl = document.getElementById("profile-days-count");
  if (daysEl) daysEl.textContent = daysCount;
};

// 1. Cek Slot Accessible
window.isSlotAccessible = function (slotId, dateStr) {
  const todayStr = window.getLocalDateStr();

  if (dateStr > todayStr) return { locked: true, reason: "future" };

  // Hitung selisih hari (Ms ke Hari)
  const diffTime = Math.abs(new Date(todayStr) - new Date(dateStr));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > window.APP_CONSTANTS.maxEditDaysBack)
    return { locked: true, reason: "limit" };

  if (dateStr === todayStr) {
    const currentHour = new Date().getHours();
    const slotStart = SLOT_WAKTU[slotId].startHour;
    if (currentHour < slotStart) return { locked: true, reason: "wait" };
  }

  return { locked: false, reason: "" };
};

// 2. Default Slot
window.determineCurrentSlot = function () {
  const h = new Date().getHours();
  if (h >= 19) return "isya";
  if (h >= 18) return "maghrib";
  if (h >= 15) return "ashar";
  if (h >= 6) return "sekolah"; // <-- JAM 06:00 - 15:00 = SEKOLAH
  return "shubuh";
};

window.handleClearData = function () {
  window.showConfirmModal(
    "Hapus Data Hari Ini?",
    "Data presensi hari ini akan dihapus permanen.",
    "Hapus",
    "Batal",
    () => {
      delete appState.attendanceData[appState.date];
      window.saveData();
      window.updateDashboard();
      window.showToast("Data berhasil dihapus", "success");
      window.logActivity(
        "Hapus Data",
        `Menghapus data tanggal ${appState.date}`,
      );
    },
  );
};

window.showConfirmModal = function (
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
) {
  const modal = document.getElementById("modal-confirm");
  if (modal) {
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-message").textContent = message;

    const btnYes = document.getElementById("confirm-yes");
    const btnNo = document.getElementById("confirm-no");

    btnYes.textContent = confirmText;
    btnYes.onclick = () => {
      onConfirm();
      modal.classList.add("hidden");
    };

    btnNo.textContent = cancelText;
    btnNo.onclick = () => modal.classList.add("hidden");

    modal.classList.remove("hidden");
  }
};

// Backup Restore Logic
window.backupData = function () {
  const backup = {
    version: "1.0",
    date: new Date().toISOString(),
    class: appState.selectedClass,
    attendance: appState.attendanceData,
    activityLog: appState.activityLog,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup_${appState.selectedClass}_${window.getLocalDateStr()}.json`;
  link.click();

  window.showToast("Backup berhasil diunduh", "success");
};

window.restoreData = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (!backup.attendance) throw new Error("Format salah");

        window.showConfirmModal(
          "Restore Data?",
          "Data saat ini akan tertimpa.",
          "Restore",
          "Batal",
          () => {
            appState.attendanceData = backup.attendance;
            if (backup.activityLog) appState.activityLog = backup.activityLog;
            window.saveData();
            window.updateDashboard();
            window.showToast("Data berhasil di-restore", "success");
          },
        );
      } catch (err) {
        window.showToast("Gagal: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

// Tambahkan variabel ini di luar/di atas fungsi startClock untuk melacak hari secara real-time
let lastRealDate = window.getLocalDateStr();


window.openModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const baseZIndex = 100;
  const zIndex = baseZIndex + modalStack.length * 10;

  modal.style.zIndex = zIndex;
  modal.classList.remove("hidden");
  modalStack.push(modalId);

  const escHandler = (e) => {
    if (e.key === "Escape") {
      window.closeModal(modalId);
    }
  };

  document.addEventListener("keydown", escHandler);
  modal._escHandler = escHandler;
  modal.setAttribute("aria-modal", "true"); // Accessibility
  modal.setAttribute("role", "dialog"); // Accessibility
};


window.switchReportView = function (view) {
  const report = document.getElementById("report-section");
  const analysis = document.getElementById("analysis-section");
  const btnReport = document.getElementById("report-view-btn");
  const btnAnalysis = document.getElementById("analysis-view-btn");

  if (view === "report") {
    report.classList.remove("hidden");
    analysis.classList.add("hidden");

    btnReport.classList.add("bg-white", "dark:bg-slate-700", "text-indigo-600", "dark:text-indigo-400", "shadow-sm");
    btnReport.classList.remove("text-slate-500", "hover:text-slate-700", "dark:hover:text-slate-300");

    btnAnalysis.classList.remove("bg-white", "dark:bg-slate-700", "text-indigo-600", "dark:text-indigo-400", "shadow-sm");
    btnAnalysis.classList.add("text-slate-500", "hover:text-slate-700", "dark:hover:text-slate-300");
  } else {
    report.classList.add("hidden");
    analysis.classList.remove("hidden");

    btnAnalysis.classList.add("bg-white", "dark:bg-slate-700", "text-indigo-600", "dark:text-indigo-400", "shadow-sm");
    btnAnalysis.classList.remove("text-slate-500", "hover:text-slate-700", "dark:hover:text-slate-300");

    btnReport.classList.remove("bg-white", "dark:bg-slate-700", "text-indigo-600", "dark:text-indigo-400", "shadow-sm");
    btnReport.classList.add("text-slate-500", "hover:text-slate-700", "dark:hover:text-slate-300");

    window.populateAnalysisDropdown();
    window.runAnalysis();
  }
};
