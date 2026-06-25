// File: activity-logger.js

// ==========================================
// 8. LOG & MISC
// ==========================================

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
  if (
    appState.activityLog.length > window.APP_CONSTANTS.maxActivityLogEntries
  ) {
    appState.activityLog = appState.activityLog.slice(
      0,
      window.APP_CONSTANTS.maxActivityLogEntries,
    );
  }

  localStorage.setItem(
    APP_CONFIG.activityLogKey,
    JSON.stringify(appState.activityLog),
  );
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
