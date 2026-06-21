// File: notification-manager.js

window.toggleNotifications = function () {
  appState.settings.notifications = !appState.settings.notifications;
  localStorage.setItem(
    APP_CONFIG.settingsKey,
    JSON.stringify(appState.settings),
  );

  const btn = document.getElementById("btn-notifications");
  if (btn) btn.classList.toggle("opacity-50", !appState.settings.notifications);

  window.showToast(
    `Notifikasi ${appState.settings.notifications ? "Aktif" : "Nonaktif"}`,
    "info",
  );
};

// Toggle specific notification types
window.toggleNotificationType = function (key) {
  if (!appState.settings.notificationTypes) {
    appState.settings.notificationTypes = {};
  }
  appState.settings.notificationTypes[key] = !appState.settings.notificationTypes[key];
  localStorage.setItem(
    APP_CONFIG.settingsKey,
    JSON.stringify(appState.settings),
  );
  
  // Instantly update UI toggle switch if element exists
  const btn = document.getElementById("notif-toggle-" + key);
  if (btn) {
    const active = appState.settings.notificationTypes[key];
    btn.classList.toggle("bg-emerald-500", active);
    btn.classList.toggle("bg-slate-200", !active);
    btn.classList.toggle("dark:bg-slate-700", !active);
    const dot = btn.querySelector("div");
    if (dot) {
      dot.classList.toggle("left-5", active);
      dot.classList.toggle("left-1", !active);
    }
  }
  
  window.showToast("Pengaturan notifikasi disimpan", "success");
};

// ==========================================
// FITUR NOTIFIKASI PINTAR (REMINDER)
// ==========================================

// 1. Meminta Izin Notifikasi (Dipanggil tombol lonceng)
window.requestNotificationPermission = async function () {
  if (!("Notification" in window)) {
    return window.showToast("Browser Anda tidak mendukung notifikasi", "error");
  }

  if (Notification.permission === "granted") {
    window.sendLocalNotification(
      "Notifikasi Aktif ✅",
      "Anda akan diingatkan saat waktu presensi tiba.",
      "info",
    );
  } else {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      window.showToast("Notifikasi berhasil diaktifkan!", "success");
      window.sendLocalNotification(
        "Assalamu'alaikum!",
        "Sistem pengingat presensi Musyrif aktif.",
        "info",
      );

      const badge = document.getElementById("notif-badge");
      if (badge) badge.classList.add("hidden");
    } else {
      window.showToast("Izin notifikasi ditolak", "warning");
    }
  }
};

// 2. Fungsi Mengirim Notifikasi
window.sendLocalNotification = function (title, body, type = "info") {
  if (!appState.settings.notifications) return;
  if (Notification.permission === "granted") {
    const options = {
      body: body,
      icon: "https://api.iconify.design/lucide/shield-check.svg?color=%2310b981", 
      badge: "https://api.iconify.design/lucide/bell.svg?color=%23ffffff",
      vibrate: [200, 100, 200], 
      tag: title, 
    };

    new Notification(title, options);
  }
};

// 3. Penjadwal Otomatis (Cek Waktu Setiap Menit)
window.checkScheduledNotifications = function () {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (!appState.settings.notifications) return;

  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  // Eksekusi hanya di detik ke-0 (setiap menit pas) agar tidak spam
  if (s !== 0) return;

  const types = appState.settings.notificationTypes || {};

  // 1. Sesi presensi telah dimulai (sesi_presensi_mulai)
  if (types.sesi_presensi_mulai && m === 0) {
    Object.values(SLOT_WAKTU).forEach((slot) => {
      if (h === slot.startHour) {
        window.sendLocalNotification(
          `Waktunya ${slot.label}! 🕌`,
          `Sesi presensi ${slot.label} telah dimulai. Silakan isi kehadiran santri.`
        );
      }
    });
  }

  // 2. Sesi Mahad telah dimulai (sesi_mahad_mulai)
  if (types.sesi_mahad_mulai) {
    // Tahfizh Subuh jam 05:00 pagi
    if (h === 5 && m === 0) {
      window.sendLocalNotification(
        "KBM Tahfizh Dimulai 📖",
        "Sesi KBM Tahfizh pagi telah dimulai di Asrama."
      );
    }
    // Kegiatan Maghrib jam 18:15 sore
    if (h === 18 && m === 15) {
      window.sendLocalNotification(
        "KBM Sore/Diniyah 🕌",
        "Sesi KBM Sore (Tahsin/Vocab) telah dimulai."
      );
    }
  }

  // 3 & 4. Sisa Waktu Presensi 5 Menit & 1 Menit Sebelum Ditutup (sisa_5_menit, sisa_1_menit)
  const slotsConfig = {
    shubuh: { endH: 6, endM: 0 },
    sekolah: { endH: 15, endM: 0 },
    ashar: { endH: 17, endM: 0 },
    maghrib: { endH: 19, endM: 0 },
    isya: { endH: 21, endM: 0 }
  };

  Object.entries(slotsConfig).forEach(([slotId, limit]) => {
    let diffMins = (limit.endH - h) * 60 + (limit.endM - m);
    if (diffMins === 5 && types.sisa_5_menit) {
      const slotLabel = SLOT_WAKTU[slotId]?.label || slotId;
      window.sendLocalNotification(
        "Sisa 5 Menit! ⏳",
        `Waktu presensi ${slotLabel} tersisa 5 menit lagi sebelum ditutup.`
      );
    }
    if (diffMins === 1 && types.sisa_1_menit) {
      const slotLabel = SLOT_WAKTU[slotId]?.label || slotId;
      window.sendLocalNotification(
        "Sisa 1 Menit! 🚨",
        `Segera simpan! Presensi ${slotLabel} akan ditutup dalam 1 menit.`
      );
    }
  });

  // 5. Presensi hari sebelumnya masih belum lengkap (belum_lengkap_kemarin)
  // Dicek tiap jam 07:30 pagi
  if (types.belum_lengkap_kemarin && h === 7 && m === 30) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = window.getLocalDateStr(yesterday);
    
    let incomplete = false;
    Object.keys(SLOT_WAKTU).forEach((slotId) => {
      const slotData = appState.attendanceData?.[yesterdayStr]?.[slotId];
      const filledCount = FILTERED_SANTRI.filter((s) => {
        const id = String(s.nis || s.id);
        return !!slotData?.[id];
      }).length;
      if (!slotData || filledCount < FILTERED_SANTRI.length) {
        incomplete = true;
      }
    });

    if (incomplete && appState.selectedClass) {
      window.sendLocalNotification(
        "Presensi Belum Lengkap ⚠️",
        "Presensi hari kemarin masih belum lengkap. Silakan periksa kembali."
      );
    }
  }

  // 6. Ada santri yang belum dipresensi (ada_santri_belum)
  // Dicek 15 menit sebelum slot berakhir
  if (types.ada_santri_belum) {
    Object.entries(slotsConfig).forEach(([slotId, limit]) => {
      let diffMins = (limit.endH - h) * 60 + (limit.endM - m);
      if (diffMins === 15) {
        const slotData = appState.attendanceData?.[appState.date]?.[slotId] || {};
        const filledCount = FILTERED_SANTRI.filter((s) => {
          const id = String(s.nis || s.id);
          return !!slotData[id];
        }).length;
        if (FILTERED_SANTRI.length > 0 && filledCount < FILTERED_SANTRI.length) {
          window.sendLocalNotification(
            "Santri Belum Lengkap 👥",
            `Ada ${FILTERED_SANTRI.length - filledCount} santri belum diabsen di sesi ${SLOT_WAKTU[slotId]?.label}.`
          );
        }
      }
    });
  }

  // 7. Ada data izin yang belum diverifikasi (ada_izin_belum_verif)
  // Dicek jam 09:00 pagi dan 16:00 sore
  if (types.ada_izin_belum_verif && m === 0 && (h === 9 || h === 16)) {
    const pendingPermits = (appState.permits || []).filter((p) => {
      const status = String(p.status || "").toLowerCase();
      return status === "pending" || status === "perlu verifikasi";
    });
    if (pendingPermits.length > 0) {
      window.sendLocalNotification(
        "Verifikasi Izin Santri 📝",
        `Ada ${pendingPermits.length} data perizinan santri menunggu persetujuan Anda.`
      );
    }
  }

  // 8 & 9. Ada kegiatan/rapat yang akan dimulai (ada_kegiatan_mulai, ada_rapat_musyrif)
  // Check reminders or agendas starting in 15 minutes
  if (m === 0 || m === 30) {
    const todayStr = window.getLocalDateStr();
    
    if (types.ada_rapat_musyrif) {
      const hasRapat = (appState.reminders || []).some(r => !r.done && r.title.toLowerCase().includes("rapat") && r.date === todayStr);
      if (hasRapat && h === 8) { // Remind at 8 AM
        window.sendLocalNotification(
          "Pengingat Rapat Musyrif 👥",
          "Ada agenda rapat Musyrif yang dijadwalkan berlangsung hari ini."
        );
      }
    }

    if (types.ada_kegiatan_mulai) {
      const hasKegiatan = (appState.agendas || []).some(a => a.type === "kegiatan" && a.date === todayStr);
      if (hasKegiatan && h === 7) { // Remind at 7 AM
        window.sendLocalNotification(
          "Kegiatan Pondok Hari Ini 📅",
          "Ada kegiatan/agenda pondok yang akan berlangsung hari ini."
        );
      }
    }
  }

  // 10. Pengingat perpulangan (pengingat_perpulangan)
  // Dicek jam 08:00 pagi jika ada perpulangan dalam 3 hari ke depan
  if (types.pengingat_perpulangan && h === 8 && m === 0) {
    const today = new Date();
    (appState.agendas || []).forEach(a => {
      if (a.type === "perpulangan") {
        const agendaDate = new Date(a.date);
        const diffDays = Math.ceil((agendaDate - today) / (1000 * 3600 * 24));
        if (diffDays >= 0 && diffDays <= 3) {
          window.sendLocalNotification(
            "Persiapan Perpulangan ✈️",
            `Agenda ${a.title} dalam ${diffDays} hari lagi. Siapkan dokumen perpulangan.`
          );
        }
      }
    });
  }

  // 11. Pengingat puasa sunnah & wajib (pengingat_puasa)
  // Dicek jam 04:00 (Sahur) dan jam 17:00 (Persiapan Iftar)
  if (types.pengingat_puasa) {
    if (h === 4 && m === 0) {
      const todayFasting = window.getFastingInfo(now);
      if (todayFasting) {
        window.sendLocalNotification(
          "Waktunya Sahur! 🌙",
          `Hari ini dijadwalkan ${todayFasting}. Selamat sahur.`
        );
      }
    }
    if (h === 17 && m === 0) {
      const todayFasting = window.getFastingInfo(now);
      const tomorrowFasting = window.getFastingInfo(new Date(Date.now() + 24*3600*1000));
      if (todayFasting) {
        window.sendLocalNotification(
          "Persiapan Buka Puasa 🌅",
          `Selamat bersiap berbuka puasa untuk ${todayFasting}.`
        );
      } else if (tomorrowFasting) {
        window.sendLocalNotification(
          "Besok Puasa! 🌙",
          `Besok dijadwalkan ${tomorrowFasting}. Jangan lupa berniat dan sahur nanti.`
        );
      }
    }
  }

  // 12. Pengingat jadwal tahfizh (pengingat_tahfizh)
  // Dicek jam 15:30 sebelum sesi tahfizh sore (jika ada) atau jam 20:00 untuk tahfizh besok pagi
  if (types.pengingat_tahfizh) {
    if (h === 20 && m === 0) {
      window.sendLocalNotification(
        "Jadwal Tahfizh Besok Pagi 📖",
        "Ingatkan santri untuk mempersiapkan hafalan setorannya besok pagi."
      );
    }
  }
};
