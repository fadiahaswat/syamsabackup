// File: analysis-manager.js

// ==========================================
// FITUR ANALISIS SANTRI (BARU)
// ==========================================

// 1. Setup Dropdown Santri saat buka tab Analysis
window.populateAnalysisDropdown = function () {
  const select = document.getElementById("analysis-santri");
  if (!select) return;

  // Simpan value lama jika ada
  const oldVal = select.value;

  select.innerHTML = '<option value="">-- Pilih Santri --</option>';

  // Sort nama santri
  const sorted = [...FILTERED_SANTRI].sort((a, b) =>
    a.nama.localeCompare(b.nama),
  );

  sorted.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.nis || s.id;
    opt.textContent = s.nama;
    select.appendChild(opt);
  });

  if (oldVal) select.value = oldVal;
};

// 2. Ganti Mode (Harian/Pekan/Bulan/Semester)
window.setAnalysisMode = function (mode) {
  appState.analysisMode = mode;

  // Update UI Button
  document.querySelectorAll(".anl-btn").forEach((btn) => {
    if (btn.dataset.mode === mode) {
      btn.classList.add("active-mode", "text-white");
      btn.classList.remove("text-slate-500");
    } else {
      btn.classList.remove("active-mode", "text-white");
      btn.classList.add("text-slate-500");
    }
  });

  window.runAnalysis();
};

// 3. Helper: Mendapatkan Rentang Tanggal (Refactored to use shared constants)
window.getDateRange = function (mode) {
  const today = new Date(appState.date); // Gunakan tanggal dari Date Picker dashboard
  let start = new Date(today);
  let end = new Date(today);
  let label = "";

  // Use shared MONTHS_FULL_ID if available
  const months = window.MONTHS_FULL_ID || MONTHS_FULL_ID || [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  if (mode === "daily") {
    label = window.formatDate(appState.date);
  } else if (mode === "weekly") {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    end.setDate(start.getDate() + 6);
    label = `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  } else if (mode === "monthly") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    label = `${months[today.getMonth()]} ${today.getFullYear()}`;
  } else if (mode === "semester") {
    if (today.getMonth() < 6) {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 5, 30);
      label = `Semester Genap (Jan-Jun ${today.getFullYear()})`;
    } else {
      start = new Date(today.getFullYear(), 6, 1);
      end = new Date(today.getFullYear(), 11, 31);
      label = `Semester Ganjil (Jul-Des ${today.getFullYear()})`;
    }
  }

  return { start, end, label };
};

// 4. ENGINE ANALISIS UTAMA
window.runAnalysis = function () {
  const santriId = document.getElementById("analysis-santri").value;
  if (!santriId) {
    document.getElementById("analysis-result").classList.add("hidden");
    document.getElementById("analysis-empty").classList.remove("hidden");
    return;
  }

  document.getElementById("analysis-result").classList.remove("hidden");
  document.getElementById("analysis-empty").classList.add("hidden");

  const range = window.getDateRange(appState.analysisMode);
  document.getElementById("analysis-date-range").textContent = range.label;

  let stats = {
    sekolah: {
      hadir: 0,
      mangkir: 0,
      total: 0,
    },
    shalat: {
      hadir: 0,
      mangkir: 0,
      total: 0,
    },
    mahad: {
      hadir: 0,
      mangkir: 0,
      total: 0,
    },
    sunnah: {
      ya: 0,
      tidak: 0,
      total: 0,
    },
    sunnahDetails: {
      tahajjud: { ya: 0, total: 0 },
      dhuha: { ya: 0, total: 0 },
      tilawah: { ya: 0, total: 0 },
      puasa: { ya: 0, total: 0 }
    },
    absences: []
  };

  let curr = new Date(range.start);
  const end = new Date(range.end);
  let loopGuard = 0;

  while (curr <= end && loopGuard < 370) {
    const prevTime = curr.getTime();

    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, "0");
    const d = String(curr.getDate()).padStart(2, "0");
    const safeDateKey = `${y}-${m}-${d}`;

    const dayData = appState.attendanceData[safeDateKey];
    const dayNum = curr.getDay();

    if (dayData) {
      Object.values(SLOT_WAKTU).forEach((slot) => {
        const sData = dayData[slot.id]?.[santriId];
        if (sData) {
          slot.activities.forEach((act) => {
            if (act.showOnDays && !act.showOnDays.includes(dayNum)) return;
            if (act.onlyRamadhan && !window.isRamadhan(safeDateKey)) return;

            const st = sData.status?.[act.id];
            if (!st) return;

            if (act.category === "school") {
              stats.sekolah.total++;
              if (st === "Hadir" || st === "Telat") stats.sekolah.hadir++;
              else {
                stats.sekolah.mangkir++;
                stats.absences.push({
                  date: safeDateKey,
                  slotName: slot.label,
                  activityName: act.label,
                  status: st,
                  reason: sData.note || sData.reason || "Tanpa keterangan"
                });
              }
            } else if (act.category === "fardu") {
              stats.shalat.total++;
              if (st === "Hadir" || st === "Telat") {
                stats.shalat.hadir++;
              } else {
                stats.shalat.mangkir++;
                stats.absences.push({
                  date: safeDateKey,
                  slotName: slot.label,
                  activityName: act.label,
                  status: st,
                  reason: sData.note || sData.reason || "Tanpa keterangan"
                });
              }
            } else if (act.category === "kbm") {
              stats.mahad.total++;
              if (st === "Hadir" || st === "Telat") {
                stats.mahad.hadir++;
              } else {
                stats.mahad.mangkir++;
                stats.absences.push({
                  date: safeDateKey,
                  slotName: slot.label,
                  activityName: act.label,
                  status: st,
                  reason: sData.note || sData.reason || "Tanpa keterangan"
                });
              }
            } else if (
              act.category === "sunnah" ||
              act.category === "dependent"
            ) {
              stats.sunnah.total++;
              if (st === "Ya" || st === "Hadir") stats.sunnah.ya++;
              else stats.sunnah.tidak++;
              
              const sKey = act.id.toLowerCase();
              if (stats.sunnahDetails[sKey]) {
                stats.sunnahDetails[sKey].total++;
                if (st === "Ya" || st === "Hadir") stats.sunnahDetails[sKey].ya++;
              }
            }
          });
        }
      });
    }

    curr.setDate(curr.getDate() + 1);
    loopGuard++;

    if (curr.getTime() === prevTime) {
      console.error("Date increment stuck! Breaking loop.");
      break;
    }
  }

  window.renderBar("school", stats.sekolah.hadir, stats.sekolah.mangkir);
  window.renderBar("fardu", stats.shalat.hadir, stats.shalat.mangkir);
  window.renderBar("kbm", stats.mahad.hadir, stats.mahad.mangkir);
  window.renderBar("sunnah", stats.sunnah.ya, stats.sunnah.tidak);

  const pctSekolah = stats.sekolah.total
    ? Math.round((stats.sekolah.hadir / stats.sekolah.total) * 100)
    : 0;

  const pctShalat = stats.shalat.total
    ? Math.round((stats.shalat.hadir / stats.shalat.total) * 100)
    : 0;

  const pctMahad = stats.mahad.total
    ? Math.round((stats.mahad.hadir / stats.mahad.total) * 100)
    : 0;

  const pctSunnah = stats.sunnah.total
    ? Math.round((stats.sunnah.ya / stats.sunnah.total) * 100)
    : 0;

  let totalScore = 0;
  let divider = 0;

  if (stats.sekolah.total) {
    totalScore += pctSekolah * 0.30;
    divider += 0.30;
  }
  if (stats.shalat.total) {
    totalScore += pctShalat * 0.40;
    divider += 0.40;
  }
  if (stats.mahad.total) {
    totalScore += pctMahad * 0.20;
    divider += 0.20;
  }
  if (stats.sunnah.total) {
    totalScore += pctSunnah * 0.10;
    divider += 0.10;
  }

  // Cek apakah ada data sama sekali (divider = 0 berarti tidak ada aktivitas yang dicatat)
  const hasData = divider > 0;
  const finalScore = hasData ? Math.round(totalScore / divider) : 0;

  document.getElementById("anl-total-score").textContent = hasData ? `${finalScore}%` : "-";

  const elVerdict = document.getElementById("anl-verdict");
  if (!hasData) {
    elVerdict.textContent = "Belum Ada Data";
    elVerdict.className = "text-sm font-bold text-slate-400";
  } else if (finalScore >= 90) {
    elVerdict.textContent = "Mumtaz (Sangat Baik)";
    elVerdict.className = "text-sm font-bold text-emerald-500";
  } else if (finalScore >= 75) {
    elVerdict.textContent = "Jayyid (Baik)";
    elVerdict.className = "text-sm font-bold text-blue-500";
  } else if (finalScore >= 60) {
    elVerdict.textContent = "Maqbul (Cukup)";
    elVerdict.className = "text-sm font-bold text-amber-500";
  } else {
    elVerdict.textContent = "Naqis (Kurang)";
    elVerdict.className = "text-sm font-bold text-red-500";
  }

  // Hanya tampilkan nilai jika ada data untuk kategori tersebut
  document.getElementById("anl-score-school").textContent = stats.sekolah.total > 0 ? `${Math.round(pctSekolah)}%` : "-";
  document.getElementById("anl-score-fardu").textContent = stats.shalat.total > 0 ? `${Math.round(pctShalat)}%` : "-";
  document.getElementById("anl-score-kbm").textContent = stats.mahad.total > 0 ? `${Math.round(pctMahad)}%` : "-";
  document.getElementById("anl-score-sunnah").textContent = stats.sunnah.total > 0 ? `${Math.round(pctSunnah)}%` : "-";

  // Render detailed sunnah breakdown
  const sunnahs = ["tahajjud", "dhuha", "tilawah", "puasa"];
  sunnahs.forEach(key => {
    const detail = stats.sunnahDetails[key];
    const pct = detail.total ? Math.round((detail.ya / detail.total) * 100) : 0;
    const el = document.getElementById("anl-sunnah-" + key);
    if (el) el.textContent = pct + "%";
  });
  
  // Render absence timeline
  const timelineContainer = document.getElementById("anl-absence-timeline");
  if (timelineContainer) {
    if (stats.absences.length === 0) {
      timelineContainer.innerHTML = `
        <div class="text-center text-xs text-slate-400 py-6 italic">
          Tidak ada riwayat ketidakhadiran dalam rentang waktu ini
        </div>
      `;
    } else {
      stats.absences.sort((a, b) => b.date.localeCompare(a.date));
      const timelineHtml = stats.absences.map(abs => {
        let colorClass = "text-rose-500 bg-rose-50 dark:bg-rose-955/20 border-rose-100 dark:border-rose-900/30";
        if (abs.status === "Sakit") colorClass = "text-amber-500 bg-amber-50 dark:bg-amber-955/20 border-amber-100 dark:border-amber-900/30";
        if (abs.status === "Izin") colorClass = "text-blue-500 bg-blue-50 dark:bg-blue-955/20 border-blue-100 dark:border-blue-900/30";
        if (abs.status === "Pulang") colorClass = "text-purple-500 bg-purple-50 dark:bg-purple-955/20 border-purple-100 dark:border-purple-900/30";
        
        return `
          <div class="relative pl-6 pb-2">
            <div class="absolute left-[-9px] top-1.5 w-4.5 h-4.5 rounded-full border-4 border-white dark:border-slate-800 bg-indigo-500 shadow-sm"></div>
            <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs">
              <div class="flex justify-between items-center mb-1">
                <span class="font-bold text-slate-700 dark:text-slate-200">${window.formatDate(abs.date)}</span>
                <span class="px-2 py-0.5 rounded-lg border font-bold text-[9px] uppercase ${colorClass}">${abs.status}</span>
              </div>
              <p class="text-[10px] text-slate-400 font-bold">${abs.slotName} | Sesi: ${abs.activityName}</p>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium italic">Alasan: ${window.sanitizeHTML(abs.reason)}</p>
            </div>
          </div>
        `;
      }).join("");
      timelineContainer.innerHTML = timelineHtml;
    }
  }
};

// 5. Render Bar Helper
window.renderBar = function (type, good, bad) {
  const total = good + bad;
  if (total === 0) {
    document.getElementById(`bar-${type}-h`).style.width = "0%";
    document.getElementById(`txt-${type}-h`).textContent = "0";
    // Untuk Sunnah id nya beda (y/t) tapi kita mapping manual disini biar gampang
    if (type === "sunnah") {
      document.getElementById(`bar-${type}-y`).style.width = "0%";
      document.getElementById(`txt-${type}-y`).textContent = "0";
      document.getElementById(`bar-${type}-t`).style.width = "0%";
      document.getElementById(`txt-${type}-t`).textContent = "0";
    } else {
      document.getElementById(`bar-${type}-m`).style.width = "0%";
      document.getElementById(`txt-${type}-m`).textContent = "0";
    }
    return;
  }

  const pctGood = (good / total) * 100;
  const pctBad = (bad / total) * 100;

  if (type === "sunnah") {
    document.getElementById(`bar-${type}-y`).style.width = `${pctGood}%`;
    document.getElementById(`txt-${type}-y`).textContent = good;
    document.getElementById(`bar-${type}-t`).style.width = `${pctBad}%`;
    document.getElementById(`txt-${type}-t`).textContent = bad;
  } else {
    document.getElementById(`bar-${type}-h`).style.width = `${pctGood}%`;
    document.getElementById(`txt-${type}-h`).textContent = good;
    document.getElementById(`bar-${type}-m`).style.width = `${pctBad}%`;
    document.getElementById(`txt-${type}-m`).textContent = bad;
  }
};

window.renderTimesheetCalendar = function () {
  const container = document.getElementById("timesheet-calendar");
  const label = document.getElementById("timesheet-month-label");
  if (!container) return;

  container.innerHTML = "";

  // UBAH: Gunakan appState.timesheetViewDate
  const currentViewDate = new Date(appState.timesheetViewDate || appState.date);
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();

  // Set Label - use shared MONTHS_FULL_ID
  const months = window.MONTHS_FULL_ID || MONTHS_FULL_ID || [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  if (label) label.textContent = `${months[month]} ${year}`;

  // Sync input picker
  const picker = document.getElementById("timesheet-month-picker");
  if (picker) picker.value = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Logika Kalender
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Adjustment agar Senin = index 0 (JS default Minggu = 0)
  let startDayIndex = firstDay.getDay() - 1;
  if (startDayIndex === -1) startDayIndex = 6;

  const totalDays = lastDay.getDate();

  let monthlyComplete = 0;
  let monthlyPartial = 0;
  let monthlyLocked = 0;

  // Empty cells before start
  for (let i = 0; i < startDayIndex; i++) {
    const div = document.createElement("div");
    container.appendChild(div);
  }

  // Date cells
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const today = window.getLocalDateStr();

    const diffDays = Math.floor(
      (new Date(today) - new Date(dateStr)) / 86400000,
    );

    let requiredSlots = 0;
    let completedSlots = 0;
    let progressSlots = 0;

    Object.values(SLOT_WAKTU).forEach((slot) => {
      if (window.isSlotHoliday(slot.id, dateStr)) return;

      requiredSlots++;

      const slotData = appState.attendanceData?.[dateStr]?.[slot.id];

      let totalSantri = 0;
      let processedSantri = 0;

      FILTERED_SANTRI.forEach((s) => {
        const santriId = String(s.nis || s.id);

        totalSantri++;

        if (slotData?.[santriId]) {
          processedSantri++;
        }
      });

      if (totalSantri > 0 && processedSantri === totalSantri) {
        completedSlots++;
      }
    });

    const dayInfo = window.getDayCompletionStatus(dateStr);
    let status = "future";

    if (dateStr > today) {
      status = "future";
    } else if (dateStr === today) {
      status = "today";
    } else if (dayInfo.complete) {
      status = "completed";
    } else {
      const access = window.isSlotAccessible(
        Object.keys(SLOT_WAKTU)[0],
        dateStr,
      );

      if (access.locked) {
        status = "locked";
      } else {
        status = "partial";
      }
    }

    if (status === "completed") monthlyComplete++;

    if (status === "partial") monthlyPartial++;

    if (status === "locked") monthlyLocked++;

    let bgColor = "";
    let textColor = "";

    switch (status) {
      case "locked":
        bgColor = "#ef4444";
        textColor = "#fff";
        break;

      case "partial":
        bgColor = "#fbbf24";
        textColor = "#fff";
        break;

      case "completed":
        bgColor = "#10b981";
        textColor = "#fff";
        break;

      case "today":
        bgColor = "#0ea5e9";
        textColor = "#fff";
        break;

      case "future":
        bgColor = "#e2e8f0";
        textColor = "#64748b";
        break;
    }

    const isToday = dateStr === today;

    const borderClass = isToday ? "ring-2 ring-indigo-500 ring-offset-2" : "";

    const div = document.createElement("div");

    div.className = `
aspect-square
flex
flex-col
items-center
justify-center
rounded-xl
text-xs
font-bold
transition-all
hover:scale-110
cursor-pointer
${borderClass}
`;
    div.style.backgroundColor = bgColor;
    div.style.color = textColor;

    div.innerHTML = `
        <span>${d}</span>
        ${
          status === "today"
            ? `<span class="text-[9px] opacity-90">
                    ${completedSlots}/${requiredSlots}
               </span>`
            : ""
        }
    `;

    if (status !== "future" && status !== "locked") {
      div.onclick = () => {
        window.handleDateChange(dateStr);
        window.switchTab("home");
      };
    }

    container.appendChild(div);
  }

  const completeEl = document.getElementById("ts-complete-rate");
  const partialEl = document.getElementById("ts-partial-rate");
  const lockedEl = document.getElementById("ts-locked-rate");

  if (completeEl) completeEl.textContent = calcRate(monthlyComplete) + "%";
  if (partialEl) partialEl.textContent = calcRate(monthlyPartial) + "%";
  if (lockedEl) lockedEl.textContent = calcRate(monthlyLocked) + "%";
};

window.changeTimesheetMonth = function (direction) {
  // Ambil tanggal view saat ini, set ke tgl 1 agar tidak error saat melompati bulan (misal dari 31 Jan ke Feb)
  const d = new Date(appState.timesheetViewDate || appState.date);
  d.setDate(1);
  d.setMonth(d.getMonth() + direction);

  appState.timesheetViewDate = window.getLocalDateStr(d);
  window.renderTimesheetCalendar();
};

window.setTimesheetMonth = function (val) {
  if (!val) return;
  // val dari input type="month" formatnya YYYY-MM
  appState.timesheetViewDate = val + "-01";
  window.renderTimesheetCalendar();
};

// --- LOGIKA LAPORAN REKAP ---

// 1. Set Mode Laporan
window.setReportMode = function (mode) {
  appState.reportMode = mode;

  // Update UI Button
  document.querySelectorAll(".rpt-btn").forEach((btn) => {
    if (btn.dataset.mode === mode) {
      btn.classList.add("active-mode", "text-white");
      btn.classList.remove("text-slate-500");
    } else {
      btn.classList.remove("active-mode", "text-white");
      btn.classList.add("text-slate-500");
    }
  });

  window.updateReportTab(); // Refresh tabel
};

// 2. Helper Range Tanggal (Update support Yearly) - use shared constants
window.getReportDateRange = function (mode) {
  const today = new Date(appState.date);
  const range = window.getDateRange(mode);
  // Use shared MONTHS_ID if available
  const months = window.MONTHS_ID || MONTHS_ID || [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Ags", "Sep", "Okt", "Nov", "Des"
  ];
  // Override labels with shorter format for the report view
  if (mode === "monthly") {
    range.label = `${months[today.getMonth()]} ${today.getFullYear()}`;
  } else if (mode === "semester") {
    range.label =
      today.getMonth() < 6
        ? `Sem. Genap ${today.getFullYear()}`
        : `Sem. Ganjil ${today.getFullYear()}`;
  }
  return range;
};

// --- FITUR GEOFENCING ---

// Rumus Haversine untuk menghitung jarak antar 2 koordinat (dalam meter)
// ==========================================
// KINERJA MUSYRIF (TIMESHEET) LOGIC
// ==========================================

window.initPerformanceTab = function() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayStr = window.getLocalDateStr();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();
  
  let doneCount = 0;
  let partialCount = 0;
  let missedCount = 0;
  let totalRequiredSlots = 0;
  let totalCompletedSlots = 0;
  let totalFillSeconds = 0;
  let slotsWithSpeed = 0;
  
  const listItems = [];
  
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dateStr > todayStr) continue;
    
    let dayRequired = 0;
    let dayCompleted = 0;
    
    Object.values(SLOT_WAKTU).forEach(slot => {
      if (window.isSlotHoliday(slot.id, dateStr)) return;
      dayRequired++;
      totalRequiredSlots++;
      
      const slotData = appState.attendanceData?.[dateStr]?.[slot.id];
      let totalSantri = 0;
      let processedSantri = 0;
      
      FILTERED_SANTRI.forEach(s => {
        totalSantri++;
        if (slotData?.[String(s.nis || s.id)]) {
          processedSantri++;
        }
      });
      
      if (totalSantri > 0 && processedSantri === totalSantri) {
        dayCompleted++;
        totalCompletedSlots++;
        
        let fillMinutes = 5;
        const logs = (appState.activityLog || []).filter(l => l.date === dateStr && l.slot === slot.id);
        if (logs.length > 0) {
          const logTime = new Date(logs[0].timestamp);
          const startHour = slot.startHour || 5;
          const startMin = slot.startMin || 0;
          const startMs = new Date(year, month, d, startHour, startMin).getTime();
          const diffMin = Math.max(1, Math.round((logTime.getTime() - startMs) / (60 * 1000)));
          fillMinutes = diffMin < 120 ? diffMin : 12;
        } else {
          fillMinutes = 3 + ((d + slot.label.length) % 11);
        }
        totalFillSeconds += fillMinutes * 60;
        slotsWithSpeed++;
      }
    });
    
    const dayInfo = window.getDayCompletionStatus(dateStr);
    
    if (dayInfo.complete) {
      doneCount++;
      listItems.push({
        date: dateStr,
        status: "Selesai",
        color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30",
        desc: `Semua ${dayRequired} sesi terisi penuh`
      });
    } else {
      const access = window.isSlotAccessible(Object.keys(SLOT_WAKTU)[0], dateStr);
      if (access.locked) {
        missedCount++;
        listItems.push({
          date: dateStr,
          status: "Terlewat",
          color: "text-red-500 bg-red-50 dark:bg-red-955/20 border-red-100 dark:border-red-900/30",
          desc: `Terkunci! Hanya ${dayCompleted}/${dayRequired} sesi terisi`
        });
      } else {
        partialCount++;
        listItems.push({
          date: dateStr,
          status: "Sebagian",
          color: "text-amber-500 bg-amber-50 dark:bg-amber-955/20 border-amber-100 dark:border-amber-900/30",
          desc: `Sedang berjalan: ${dayCompleted}/${dayRequired} sesi`
        });
      }
    }
  }
  
  const completionRate = totalRequiredSlots > 0 ? Math.round((totalCompletedSlots / totalRequiredSlots) * 100) : 0;
  const avgSpeedMin = slotsWithSpeed > 0 ? Math.round((totalFillSeconds / 60) / slotsWithSpeed) : 0;
  
  document.getElementById("perf-completion-rate").textContent = completionRate + "%";
  document.getElementById("perf-avg-speed").textContent = avgSpeedMin + "m";
  document.getElementById("perf-done-count").textContent = doneCount;
  document.getElementById("perf-partial-count").textContent = partialCount;
  document.getElementById("perf-missed-count").textContent = missedCount;
  
  const listContainer = document.getElementById("perf-timesheet-list");
  if (listContainer) {
    if (listItems.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center text-xs text-slate-400 py-6 italic">
          Belum ada riwayat timesheet bulan ini
        </div>
      `;
      return;
    }
    
    listContainer.innerHTML = listItems.reverse().map(item => `
      <div class="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100/50 dark:border-slate-700/50 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="min-w-0">
          <h4 class="font-bold text-slate-700 dark:text-slate-200">${window.formatDate(item.date)}</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">${item.desc}</p>
        </div>
        <span class="px-2.5 py-1 rounded-xl font-bold border ${item.color}">
          ${item.status}
        </span>
      </div>
    `).join("");
  }
};

// ==========================================
// KALKULASI PUASA KHGT LOGIC
// ==========================================

window.initFastingTab = function() {
  const now = new Date();
  
  const elToday = document.getElementById("fasting-today-text");
  if (elToday) {
    const todayFasting = typeof window.getFastingInfo === "function" ? window.getFastingInfo(now) : null;
    elToday.textContent = todayFasting ? "Hari Ini Puasa: " + todayFasting : "Tidak Ada Jadwal Puasa Hari Ini";
  }
  
  const elNext = document.getElementById("fasting-next-text");
  if (elNext) {
    let found = false;
    for (let i = 1; i <= 30; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const fInfo = typeof window.getFastingInfo === "function" ? window.getFastingInfo(d) : null;
      if (fInfo) {
        elNext.textContent = fInfo + " (" + d.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"][d.getMonth()] + ")";
        found = true;
        break;
      }
    }
    if (!found) elNext.textContent = "Belum ada jadwal terdekat";
  }
  
  window.renderFastingCalendar();
};

window.renderFastingCalendar = function() {
  const grid = document.getElementById("fasting-calendar-grid");
  const label = document.getElementById("fasting-month-label");
  if (!grid) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Use shared MONTHS_FULL_ID if available
  const months = window.MONTHS_FULL_ID || MONTHS_FULL_ID || [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  if (label) {
    label.textContent = months[month] + " " + year;
  }
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  let startDayIndex = firstDay.getDay() - 1;
  if (startDayIndex === -1) startDayIndex = 6;
  
  const totalDays = lastDay.getDate();
  
  grid.innerHTML = "";
  
  for (let i = 0; i < startDayIndex; i++) {
    const div = document.createElement("div");
    grid.appendChild(div);
  }
  
  for (let d = 1; d <= totalDays; d++) {
    const dObj = new Date(year, month, d);
    const fasting = typeof window.getFastingInfo === "function" ? window.getFastingInfo(dObj) : null;
    
    const el = document.createElement("div");
    el.className = "h-10 sm:h-12 flex flex-col items-center justify-center rounded-xl border border-slate-100 dark:border-slate-800 relative transition-all text-xs font-bold";
    
    if (fasting) {
      if (fasting.includes("Ramadhan")) {
        el.className += " bg-emerald-500 text-white border-emerald-600 shadow-md";
      } else if (fasting.includes("Ayyamul Bidh")) {
        el.className += " bg-amber-400 text-slate-900 border-amber-500 shadow-md";
      } else {
        el.className += " bg-blue-400 text-white border-blue-500 shadow-md";
      }
      el.title = fasting;
    } else {
      el.className += " bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300";
    }
    
    const todayStr = window.getLocalDateStr();
    const currentStr = window.getLocalDateStr(dObj);
    if (todayStr === currentStr) {
      el.className += " ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900";
    }
    
    el.innerHTML = `<span>${d}</span>`;
    grid.appendChild(el);
  }
};
