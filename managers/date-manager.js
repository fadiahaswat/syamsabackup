// File: date-manager.js

// ==========================================
// 6. DATE ACTIONS
// ==========================================

window.changeDateView = function (direction) {
  const current = new Date(appState.date);
  current.setDate(current.getDate() + direction);

  const nextDateStr = window.getLocalDateStr(current);
  const todayStr = window.getLocalDateStr();

  if (nextDateStr > todayStr) {
    return window.showToast("Masa depan belum terjadi 🚫", "warning");
  }

  appState.date = nextDateStr;
  window.updateDateDisplay();
  window.updateDashboard();
  window.showToast(`📅 ${window.formatDate(appState.date)}`, "info");
};

window.updateDateDisplay = function () {
  const el = document.getElementById("current-date-display");
  const input = document.getElementById("date-picker-input");

  if (el) el.textContent = window.formatDate(appState.date);
  if (input) input.value = appState.date;
};

window.handleDateChange = function (value) {
  if (!value) return;
  const todayStr = window.getLocalDateStr();

  if (value > todayStr) {
    window.showToast("Tidak bisa memilih tanggal masa depan 🚫", "warning");
    const input = document.getElementById("date-picker-input");
    if (input) input.value = appState.date;
    return;
  }

  appState.date = value;
  window.updateDateDisplay();
  window.updateDashboard();
  window.showToast("Tanggal berhasil diubah", "success");
};


window.startClock = function () {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  const updateClock = () => {
    const now = new Date();
    const el = document.getElementById("dash-clock");
    if (el) {
      el.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const secEl = document.getElementById("dash-clock-sec");
      if (secEl) secEl.textContent = String(now.getSeconds()).padStart(2, "0");
    }

    // PERBAIKAN: Cek pergantian hari (Midnight Rollover) yang benar
    const currentRealDate = window.getLocalDateStr(now);

    // Hanya eksekusi JIKA tanggal di dunia nyata benar-benar sudah berganti
    if (currentRealDate > lastRealDate) {
      // Jika user kebetulan SEDANG berada di tanggal "hari ini" (yang lama), ikut geser ke hari baru
      // Tapi jika user sengaja melihat data kemarin, biarkan saja tidak usah digeser
      if (appState.date === lastRealDate) {
        appState.date = currentRealDate;
        window.updateDateDisplay();
        window.updateDashboard();
      }
      lastRealDate = currentRealDate; // Update referensi tanggal nyata
    }

    const realCurrentSlot = window.getCurrentDashboardSlotId
      ? window.getCurrentDashboardSlotId(currentRealDate)
      : window.determineCurrentSlot();
    if (
      appState.date === currentRealDate &&
      appState.currentSlotId !== realCurrentSlot
    ) {
      appState.currentSlotId = realCurrentSlot;
      window.updateDashboard();
    }

    try {
      window.checkScheduledNotifications();
    } catch (e) {
      console.error("Notification error:", e);
    }
  };

  updateClock();
  clockInterval = setInterval(updateClock, 1000);
};


window.goToToday = function () {
  const today = window.getLocalDateStr();

  appState.date = today;

  appState.timesheetViewDate = today;

  window.updateDateDisplay();
  window.updateDashboard();
  window.renderTimesheetCalendar();

  window.showToast("Kembali ke hari ini", "success");
};

// ==========================================
// KALKULASI HIJRIAH & JADWAL SHALAT KHGT
// ==========================================

window.getHijriDateStr = function (dateObj = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    return formatter.format(dateObj) + " H";
  } catch (e) {
    return "26 Dzulhijjah 1447 H";
  }
};

// Shared MONTHS arrays (extracted to avoid duplication)
// eslint-disable-next-line no-unused-vars
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
// eslint-disable-next-line no-unused-vars
const MONTHS_FULL_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
// eslint-disable-next-line no-unused-vars
const DAYS_ID = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// Export to global
window.MONTHS_ID = MONTHS_ID;
window.MONTHS_FULL_ID = MONTHS_FULL_ID;
window.DAYS_ID = DAYS_ID;

window.calculatePrayerTimes = function (dateObj = new Date(), lat = -7.8078, lng = 110.3509, timezone = 7) {
  const start = new Date(dateObj.getFullYear(), 0, 0);
  const diff = dateObj - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  const d = dayOfYear;
  const pi = Math.PI;
  const rad = pi / 180;
  
  const fractionalYear = (2 * pi / 365) * (d - 1);
  
  const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(fractionalYear) - 0.032077 * Math.sin(fractionalYear) 
              - 0.014615 * Math.cos(2 * fractionalYear) - 0.040849 * Math.sin(2 * fractionalYear));
              
  const decl = 0.006918 - 0.399912 * Math.cos(fractionalYear) + 0.070257 * Math.sin(fractionalYear) 
              - 0.006758 * Math.cos(2 * fractionalYear) + 0.000907 * Math.sin(2 * fractionalYear) 
              - 0.002697 * Math.cos(3 * fractionalYear) + 0.00148 * Math.sin(3 * fractionalYear);
              
  const noon = 12 + (timezone - lng / 15) - (eot / 60);
  
  const hourAngle = (angle, latRad, declRad) => {
    const cosH = (Math.sin(angle * rad) - Math.sin(latRad) * Math.sin(declRad)) / (Math.cos(latRad) * Math.cos(declRad));
    if (cosH > 1) return null;
    if (cosH < -1) return null;
    return Math.acos(cosH) / rad;
  };
  
  const latRad = lat * rad;
  const declRad = decl;
  
  const hSubuh = hourAngle(-20, latRad, declRad);
  const subuhTime = hSubuh ? noon - hSubuh / 15 : 4.5;
  
  const hSyuruk = hourAngle(-0.833, latRad, declRad);
  const syurukTime = hSyuruk ? noon - hSyuruk / 15 : 5.75;
  
  const dzuhurTime = noon + (2 / 60);
  
  const cotAlt = 1 + Math.abs(Math.tan(latRad - declRad));
  const altAshar = Math.atan(1 / cotAlt) / rad;
  const hAshar = hourAngle(altAshar, latRad, declRad);
  const asharTime = hAshar ? noon + hAshar / 15 : 15.0;
  
  const hMaghrib = hourAngle(-1, latRad, declRad);
  const maghribTime = hMaghrib ? noon + hMaghrib / 15 : 17.75;
  
  const hIsya = hourAngle(-18, latRad, declRad);
  const isyaTime = hIsya ? noon + hIsya / 15 : 18.9;
  
  const formatTime = (hoursFraction) => {
    let h = Math.floor(hoursFraction);
    let m = Math.floor((hoursFraction - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  return {
    subuh: formatTime(subuhTime),
    syuruk: formatTime(hSyuruk ? syurukTime : 5.45),
    dzuhur: formatTime(dzuhurTime),
    ashar: formatTime(asharTime),
    maghrib: formatTime(maghribTime),
    isya: formatTime(isyaTime)
  };
};

window.getFastingInfo = function (dateObj = new Date()) {
  const dayOfWeek = dateObj.getDay();
  let hDay = 1, hMonth = 1, hYear = 1447;
  try {
    const formatter = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "numeric",
      year: "numeric"
    });
    const parts = formatter.formatToParts(dateObj);
    hDay = Number(parts.find(p => p.type === "day").value);
    hMonth = Number(parts.find(p => p.type === "month").value);
    hYear = Number(parts.find(p => p.type === "year").value);
  } catch (e) {
    hDay = dateObj.getDate();
    hMonth = 1;
  }
  
  const fasts = [];
  
  if (hMonth === 9) {
    fasts.push("Puasa Ramadhan (Wajib)");
  }
  
  if (hMonth === 12 && hDay === 9) {
    fasts.push("Puasa Arafah (Sunnah)");
  }
  
  if (hMonth === 1 && hDay === 9) {
    fasts.push("Puasa Tasu'a (Sunnah)");
  }
  if (hMonth === 1 && hDay === 10) {
    fasts.push("Puasa Asyura (Sunnah)");
  }
  
  if (hMonth === 10 && hDay >= 2 && hDay <= 7) {
    fasts.push("Puasa Syawal (Sunnah)");
  }
  
  if ((hDay === 13 || hDay === 14 || hDay === 15) && !(hMonth === 12 && hDay === 13)) {
    fasts.push("Puasa Ayyamul Bidh (Sunnah)");
  }
  
  if (dayOfWeek === 1) {
    fasts.push("Puasa Senin (Sunnah)");
  } else if (dayOfWeek === 4) {
    fasts.push("Puasa Kamis (Sunnah)");
  }
  
  return fasts.length > 0 ? fasts.join(" & ") : null;
};
