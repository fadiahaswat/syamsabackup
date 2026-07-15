// File: activity-logger.js

// ==========================================
// LOG & MISC
// ==========================================

const ActivityLogger$Logger = {
  debug: (...args) => window.Logger?.debug('ActivityLogger', ...args),
  info: (...args) => window.Logger?.info('ActivityLogger', ...args),
  warn: (...args) => window.Logger?.warn('ActivityLogger', ...args),
  error: (...args) => window.Logger?.error('ActivityLogger', ...args),
};

// CRITICAL FIX: Tambahkan cleanup function untuk mencegah memory leak
// Cleanup berdasarkan age (max 90 hari) dan max entries (1000)
window.cleanupActivityLogs = function (maxDays = 90, maxEntries = 1000) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);
  const cutoffTimestamp = cutoffDate.getTime();

  const beforeCount = appState.activityLog.length;

  // Filter berdasarkan age
  appState.activityLog = appState.activityLog.filter(log => {
    try {
      const logTimestamp = new Date(log.timestamp).getTime();
      return logTimestamp >= cutoffTimestamp;
    } catch (e) {
      return false;
    }
  });

  // Limit berdasarkan jumlah entries
  if (appState.activityLog.length > maxEntries) {
    appState.activityLog = appState.activityLog.slice(0, maxEntries);
  }

  const removedCount = beforeCount - appState.activityLog.length;

  // Simpan jika ada perubahan
  if (removedCount > 0) {
    try {
      localStorage.setItem(
        APP_CONFIG.activityLogKey,
        JSON.stringify(appState.activityLog),
      );
      ActivityLogger$Logger.info(`Cleanup: removed ${removedCount} old entries, ${appState.activityLog.length} remaining`);
    } catch (e) {
      ActivityLogger$Logger.error('Failed to save cleaned logs:', e);
    }
  }

  return { removed: removedCount, remaining: appState.activityLog.length };
};

window.logActivity = function (action, detail) {
  const log = {
    timestamp: new Date().toISOString(),
    action: action,
    detail: detail,
    user: appState.selectedClass
      ? MASTER_KELAS[appState.selectedClass].musyrif
      : "Unknown",
  };

  appState.activityLog.unshift(log);

  // Limit entries (soft cap)
  const maxEntries = window.APP_CONSTANTS?.maxActivityLogEntries || 1000;
  if (appState.activityLog.length > maxEntries) {
    appState.activityLog = appState.activityLog.slice(0, maxEntries);
  }

  // CRITICAL: Periodic cleanup saat log terlalu besar
  // Cleanup saat sudah > 500 entries (berdasarkan age)
  if (appState.activityLog.length > 500) {
    // Async cleanup untuk tidak blocking
    setTimeout(() => {
      window.cleanupActivityLogs(90, 1000);
    }, 0);
  }

  try {
    localStorage.setItem(
      APP_CONFIG.activityLogKey,
      JSON.stringify(appState.activityLog),
    );
  } catch (e) {
    // localStorage penuh, coba cleanup dan simpan lagi
    window.cleanupActivityLogs(30, 500);
    try {
      localStorage.setItem(
        APP_CONFIG.activityLogKey,
        JSON.stringify(appState.activityLog),
      );
    } catch (e2) {
      console.error('[ActivityLogger] Failed to save logs even after cleanup:', e2);
    }
  }
};



window.kirimLaporanWA = function () {
  if (!FILTERED_SANTRI.length) {
    window.showToast("Pilih kelas terlebih dahulu", "warning");
    return;
  }

  const dateKey = appState.date;
  const attendance = appState.attendanceData[dateKey];
  const actorName = window.getCurrentActorName
    ? window.getCurrentActorName()
    : "Ustadz Binaan";
  
  let msg = `*LAPORAN HARIAN GABUNGAN - KELAS ${appState.selectedClass}*\n`;
  msg += `📅 Tanggal: ${window.formatDate(dateKey)}\n`;
  msg += `👤 Musyrif: ${actorName}\n`;
  msg += `===================================\n\n`;

  Object.values(SLOT_WAKTU).forEach(slot => {
    let h = 0, s = 0, i = 0, a = 0;
    const dbSlot = attendance?.[slot.id];
    const mainActId = slot.activities[0]?.id || "shalat";
    
    FILTERED_SANTRI.forEach(stInfo => {
      const id = String(stInfo.nis || stInfo.id);
      const st = dbSlot?.[id]?.status?.[mainActId] || "Alpa";
      if (st === "Hadir" || st === "Ya" || st === "Telat") h++;
      else if (st === "Sakit") s++;
      else if (st === "Izin" || st === "Pulang") i++;
      else if (st === "Alpa" || st === "Tidak") a++;
    });

    msg += `*📌 Sesi: ${slot.label}*\n`;
    msg += `• Hadir: ${h} | Sakit: ${s} | Izin: ${i} | Alpa: ${a}\n`;
    
    const notPresent = [];
    FILTERED_SANTRI.forEach(stInfo => {
      const id = String(stInfo.nis || stInfo.id);
      const st = dbSlot?.[id]?.status?.[mainActId] || "Alpa";
      if (st === "Alpa" || st === "Sakit" || st === "Izin" || st === "Pulang") {
        const note = dbSlot?.[id]?.note || "";
        const noteStr = note ? ` (${note})` : "";
        notPresent.push(`  - ${stInfo.nama}: ${st}${noteStr}`);
      }
    });
    
    if (notPresent.length > 0) {
      msg += `• Keterangan:\n${notPresent.join("\n")}\n`;
    }
    msg += `\n`;
  });
  
  msg += `===================================\n`;
  msg += `_Laporan otomatis dikirim via Musyrif SuperApp_`;

  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
};
