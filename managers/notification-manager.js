// File: notification-manager.js

// ==========================================
// DAFTAR SEMUA JENIS NOTIFIKASI MUSYRIF
// ==========================================
window.MUSYRIF_NOTIFICATION_TYPES = {
  // --- Presensi ---
  sesi_presensi_mulai: { label: "Sesi presensi dimulai", category: "presensi" },
  sisa_5_menit: { label: "Sisa 5 menit deadline", category: "presensi" },
  sisa_1_menit: { label: "Sisa 1 menit deadline", category: "presensi" },
  ada_santri_belum: { label: "Ada santri belum dipresensi", category: "presensi" },
  belum_lengkap_kemarin: { label: "Presensi kemarin belum lengkap", category: "presensi" },
  sesi_terkunci: { label: "Sesi presensi terkunci", category: "presensi" },

  // --- KBM/Tahfizh ---
  sesi_mahad_mulai: { label: "KBM Tahfizh/Diniyah dimulai", category: "kbm" },
  pengingat_tahfizh: { label: "Pengingat tahfizh besok", category: "kbm" },
  setoran_pending: { label: "Ada setoran tahfizh pending", category: "kbm" },
  deadline_perpulangan_h: { label: "Deadline perpulangan (hari H)", category: "kbm" },
  pengingat_perpulangan: { label: "Pengingat perpulangan 3 hari lagi", category: "kbm" },

  // --- Perizinan ---
  ada_izin_belum_verif: { label: "Ada izin butuh verifikasi", category: "perizinan" },
  sakit_tanpa_surat: { label: "Sakit >2 hari tanpa surat dokter", category: "perizinan" },
  izin_lewat_deadline: { label: "Izin melewati deadline (Alpa)", category: "perizinan" },

  // --- Kegiatan/Agenda ---
  ada_rapat_musyrif: { label: "Pengingat rapat musyrif", category: "kegiatan" },
  ada_kegiatan_mulai: { label: "Pengingat kegiatan pondok", category: "kegiatan" },

  // --- Puasa ---
  pengingat_puasa: { label: "Pengingat sahur & buka puasa", category: "puasa" },

  // --- Sistem ---
  gps_error: { label: "GPS gagal verifikasi", category: "sistem" },
  storage_hampir_penuh: { label: "Storage hampir penuh", category: "sistem" },

  // --- Pembinaan ---
  alpa_menumpuk: { label: "Alpa menumpuk (butuh intervensi)", category: "pembinaan" },
  pola_alpa_berulang: { label: "Pola alpa berulang", category: "pembinaan" },
};

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

// Toggle specific notification types for Musyrif
window.toggleMusyrifNotificationType = function (key) {
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

// Render HTML untuk pengaturan notifikasi musyrif
window.renderMusyrifNotificationSettings = function () {
  const types = appState.settings.notificationTypes || {};
  const categories = {
    presensi: "Presensi",
    kbm: "KBM & Tahfizh",
    perizinan: "Perizinan",
    kegiatan: "Kegiatan",
    puasa: "Puasa",
    sistem: "Sistem",
    pembinaan: "Pembinaan",
  };

  let html = '<div class="space-y-6">';

  Object.entries(categories).forEach(([catKey, catLabel]) => {
    const items = Object.entries(window.MUSYRIF_NOTIFICATION_TYPES)
      .filter(([_, meta]) => meta.category === catKey);

    if (items.length === 0) return;

    html += `
      <div class="rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4">
        <h3 class="text-sm font-black text-slate-800 dark:text-white mb-3 flex items-center gap-2">
          ${catKey === "presensi" ? "📋" : catKey === "kbm" ? "📖" : catKey === "perizinan" ? "📝" : catKey === "kegiatan" ? "📅" : catKey === "puasa" ? "🌙" : catKey === "sistem" ? "⚙️" : "🎯"}
          ${catLabel}
        </h3>
        <div class="space-y-2">
    `;

    items.forEach(([key, meta]) => {
      const isActive = types[key] !== false; // Default: aktif
      html += `
        <button onclick="window.toggleMusyrifNotificationType('${key}')" class="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
          <span class="text-xs font-medium text-slate-700 dark:text-slate-200 text-left">${meta.label}</span>
          <span id="notif-badge-${key}" class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}">
            <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}"></span>
          </span>
        </button>
      `;
    });

    html += '</div></div>';
  });

  html += '</div>';
  return html;
};

// Legacy alias for backward compatibility
window.toggleNotificationType = window.toggleMusyrifNotificationType;

// Buka modal pengaturan notifikasi musyrif
window.openNotificationSettingsModal = function () {
  const modal = document.getElementById("modal-notification-settings");
  const content = document.getElementById("notification-settings-content");
  if (!modal || !content) return;

  // Pastikan settings terbaru dari localStorage
  const savedSettings = localStorage.getItem(APP_CONFIG?.settingsKey);
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      if (parsed.notificationTypes) {
        appState.settings.notificationTypes = parsed.notificationTypes;
      }
    } catch (e) {
      console.warn("Failed to parse saved settings:", e);
    }
  }

  content.innerHTML = window.renderMusyrifNotificationSettings();
  modal.classList.remove("hidden");
  if (window.lucide) window.lucide.createIcons();
};

// Tutup modal pengaturan notifikasi
window.closeNotificationSettingsModal = function () {
  const modal = document.getElementById("modal-notification-settings");
  if (modal) modal.classList.add("hidden");
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

// ==========================================
// DEBUG MODE - Set true untuk melihat log notifikasi
// ==========================================
window.NOTIF_DEBUG = false; // Ubah ke true untuk debug

function notifLog(...args) {
  if (window.NOTIF_DEBUG) {
    console.log("[NOTIF]", ...args);
  }
}

// 2. Fungsi Mengirim Notifikasi (IMPROVED)
window.sendLocalNotification = function (title, body, type = "info") {
  // Debug log
  console.log("[NOTIF] sendLocalNotification called:", title, body, type);

  // Check if notifications are enabled
  if (appState.settings && appState.settings.notifications === false) {
    console.log("[NOTIF] ❌ Notifications disabled in settings");
    return;
  }
  console.log("[NOTIF] ✅ Settings check passed");

  // Check browser support
  if (!("Notification" in window)) {
    console.log("[NOTIF] ❌ Browser does not support notifications");
    return;
  }
  console.log("[NOTIF] ✅ Notification API supported");

  // Check permission
  if (Notification.permission !== "granted") {
    console.log("[NOTIF] ❌ Permission not granted:", Notification.permission);
    return;
  }
  console.log("[NOTIF] ✅ Permission granted");

  const options = {
    body: body,
    icon: "./assets/icons/icon.webp",
    badge: "./assets/icons/icon.png",
    vibrate: [200, 100, 200],
    tag: title,
    renotify: false,
    requireInteraction: false,
    data: { url: location.href, type },
  };

  console.log("[NOTIF] Options:", options);

  // Try using Service Worker first
  if ("serviceWorker" in navigator) {
    console.log("[NOTIF] Using Service Worker...");
    navigator.serviceWorker.ready
      .then((registration) => {
        console.log("[NOTIF] SW ready, registration:", registration.scope);
        registration.showNotification(title, options)
          .then(() => {
            console.log("[NOTIF] ✅ Notification shown via SW!");
          })
          .catch((err) => {
            console.error("[NOTIF] ❌ SW showNotification failed:", err);
            console.log("[NOTIF] Falling back to direct Notification");
            new Notification(title, options);
          });
      })
      .catch((err) => {
        console.error("[NOTIF] ❌ SW.ready failed:", err);
        console.log("[NOTIF] Falling back to direct Notification");
        new Notification(title, options);
      });
  } else {
    console.log("[NOTIF] No SW, using direct Notification");
    new Notification(title, options);
  }
};

// 3. Penjadwal Otomatis (Cek Waktu Setiap Menit)
window.checkScheduledNotifications = function () {
  // Debug logging
  notifLog("=== checkScheduledNotifications called ===");
  notifLog("Notification in window:", "Notification" in window);

  if (!("Notification" in window)) {
    notifLog("Browser does not support notifications");
    return;
  }

  notifLog("Notification.permission:", Notification.permission);
  if (Notification.permission !== "granted") {
    notifLog("Permission not granted, skipping");
    return;
  }

  notifLog("appState.settings:", appState.settings);
  if (appState.settings && appState.settings.notifications === false) {
    notifLog("Notifications disabled in settings");
    return;
  }

  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  notifLog(`Current time: ${h}:${m}:${s}`);

  // Eksekusi hanya di detik ke-0 (setiap menit pas) agar tidak spam
  if (s !== 0) {
    notifLog("Not at second 0, skipping");
    return;
  }

  const types = appState.settings.notificationTypes || {};
  notifLog("Notification types settings:", types);

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

  // 13. Sakit lebih dari 2 hari tanpa surat dokter (sakit_tanpa_surat)
  // Dicek jam 09:00 dan 15:00
  if (types.sakit_tanpa_surat && (h === 9 || h === 15) && m === 0) {
    const todayStr = window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().split("T")[0];
    const activeSickPermits = (appState.permits || []).filter((p) => {
      return p.is_active !== false && p.category === "sakit" && !p.hasDocument;
    });

    activeSickPermits.forEach((permit) => {
      if (!permit.start_date) return;
      const startDate = new Date(permit.start_date);
      const today = new Date(todayStr);
      const diffDays = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

      if (diffDays >= 2) {
        const studentId = permit.nis || permit.studentId || "Santri";
        window.sendLocalNotification(
          "⚠️ Wajib Surat Dokter!",
          `${studentId} sakit lebih dari ${diffDays} hari - Surat dokter wajib diupload.`
        );
      }
    });
  }

  // 14. Izin/Pulang melewati deadline - Otomatis jadi Alpa (izin_lewat_deadline)
  // Dicek jam 08:00 dan 17:00
  if (types.izin_lewat_deadline && (h === 8 || h === 17) && m === 0) {
    const todayStr = window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().split("T")[0];
    const expiredPermits = (appState.permits || []).filter((p) => {
      if (p.is_active === false) return false;
      if (p.category === "sakit") return false; // Sakit tidak expire otomatis
      if (!p.end_date) return false;
      return p.end_date < todayStr;
    });

    expiredPermits.forEach((permit) => {
      const studentId = permit.nis || permit.studentId || "Santri";
      const permitType = permit.category === "pulang" ? "Izin Pulang" : "Izin";

      // Tandai permit sebagai expired
      permit.is_active = false;
      permit.expiredByNotification = true;

      window.sendLocalNotification(
        "⚠️ Izin Kadaluarsa - Alpa!",
        `${studentId}: ${permitType} telah melewati deadline - status otomatis berubah menjadi Alpa.`
      );
    });

    // Simpan perubahan jika ada yang expire
    if (expiredPermits.length > 0 && window.persistPermits) {
      window.persistPermits();
      window.refreshPermitSurfaces?.();
    }
  }

  // 15. Ada setoran tahfizh menunggu validasi (setoran_pending)
  // Dicek jam 08:00 dan 14:00
  if (types.setoran_pending && (h === 8 || h === 14) && m === 0) {
    // Cek TahfizhState jika tersedia (dari tahfizh-manager.js)
    const pendingCount = window.TahfizhState?.pendingSetoran?.length;
    if (pendingCount !== undefined && pendingCount > 0) {
      window.sendLocalNotification(
        "📝 Setoran Menunggu Validasi",
        `Ada ${pendingCount} setoran hafalan yang menunggu persetujuan Anda.`
      );
    }
  }

  // 16. Deadline perpulangan Hari H (deadline_perpulangan_h)
  // Dicek jam 07:00 pada hari perpulangan
  if (types.deadline_perpulangan_h && h === 7 && m === 0) {
    const todayStr = window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().split("T")[0];
    const perpulanganHariIni = (appState.agendas || []).filter(a =>
      a.type === "perpulangan" && a.date === todayStr
    );

    if (perpulanganHariIni.length > 0) {
      window.sendLocalNotification(
        "🚨 Perpulangan Hari Ini!",
        "Waktunya perpulangan - cek kesiapan hafalan dan dokumen."
      );
    }
  }

  // 17. Sesi presensi terkunci (sesi_terkunci)
  // Dicek jam 08:00 - cek sesi kemarin yang mungkin terkunci
  if (types.sesi_terkunci && h === 8 && m === 0) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    Object.keys(SLOT_WAKTU).forEach((slotId) => {
      const access = window.isSlotAccessible ? window.isSlotAccessible(slotId, yesterdayStr) : { locked: false };
      if (access.locked && access.reason === "limit") {
        const slotData = appState.attendanceData?.[yesterdayStr]?.[slotId];
        const filledCount = FILTERED_SANTRI.filter((s) => {
          const id = String(s.nis || s.id);
          return !!slotData?.[id];
        }).length;

        if (filledCount > 0 && filledCount < FILTERED_SANTRI.length) {
          window.sendLocalNotification(
            "🔒 Sesi Terkunci",
            `Sesi ${SLOT_WAKTU[slotId]?.label} kemarin (${yesterdayStr}) terkunci - ada ${FILTERED_SANTRI.length - filledCount} data yang belum terisi.`
          );
        }
      }
    });
  }

  // 18. Storage hampir penuh (storage_hampir_penuh)
  // Dicek jam 09:00 setiap hari
  if (types.storage_hampir_penuh && h === 9 && m === 0) {
    const maxBytes = window.APP_CONSTANTS?.maxStorageBytes || 5 * 1024 * 1024; // Default 5MB
    const warningThreshold = maxBytes * 0.8; // 80% dari max

    // Hitung total usage semua key localStorage
    let totalSize = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        try {
          totalSize += localStorage[key].length + key.length;
        } catch (e) {}
      }
    }

    if (totalSize > warningThreshold) {
      const usedMB = (totalSize / (1024 * 1024)).toFixed(2);
      const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
      window.sendLocalNotification(
        "💾 Storage Hampir Penuh",
        `Penggunaan storage ${usedMB}MB / ${maxMB}MB. Segera backup atau export data.`
      );
    }
  }

  // 19. Alpa menumpuk - perlu pembinaan (alpa_menumpuk)
  // Dicek jam 10:00 setiap hari
  if (types.alpa_menumpuk && h === 10 && m === 0) {
    const daysToCheck = 30; // Cek dalam 30 hari terakhir
    const alpaThreshold = 5; // Threshold: 5x alpa
    const alpaMap = {}; // { nis: count }

    for (let i = 0; i < daysToCheck; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayData = appState.attendanceData?.[dateStr];

      if (dayData) {
        Object.keys(dayData).forEach((slotId) => {
          const slotData = dayData[slotId];
          Object.keys(slotData).forEach((nis) => {
            const status = slotData[nis];
            if (status === "Alpa" || status === "A") {
              alpaMap[nis] = (alpaMap[nis] || 0) + 1;
            }
          });
        });
      }
    }

    // Filter yang melebihi threshold
    const highAlpa = Object.entries(alpaMap).filter(([_, count]) => count >= alpaThreshold);
    if (highAlpa.length > 0) {
      // Ambil data nama santri
      const studentMap = {};
      (FILTERED_SANTRI || []).forEach((s) => {
        const nis = String(s.nis || s.id);
        studentMap[nis] = s.nama || s.name || nis;
      });

      highAlpa.forEach(([nis, count]) => {
        const name = studentMap[nis] || nis;
        window.sendLocalNotification(
          "⚠️ Santri Perlu Pembinaan",
          `${name}: ${count}x Alpa dalam 30 hari terakhir - memerlukan intervensi.`
        );
      });
    }
  }

  // 20. Pola alpa berulang - alpa di hari yang sama terus (pola_alpa_berulang)
  // Dicek jam 11:00 setiap hari
  if (types.pola_alpa_berulang && h === 11 && m === 0) {
    const daysToCheck = 60; // Cek 60 hari terakhir
    const patternThreshold = 3; // Minimal 3x di hari yang sama
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const patternMap = {}; // { nis: { dayIndex: [dates] } }

    for (let i = 0; i < daysToCheck; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayIndex = date.getDay();
      const dayData = appState.attendanceData?.[dateStr];

      if (dayData) {
        Object.keys(dayData).forEach((slotId) => {
          const slotData = dayData[slotId];
          Object.keys(slotData).forEach((nis) => {
            const status = slotData[nis];
            if (status === "Alpa" || status === "A") {
              if (!patternMap[nis]) patternMap[nis] = {};
              if (!patternMap[nis][dayIndex]) patternMap[nis][dayIndex] = [];
              patternMap[nis][dayIndex].push(dateStr);
            }
          });
        });
      }
    }

    // Filter yang punya pola (3x+ di hari yang sama)
    const studentMap = {};
    (FILTERED_SANTRI || []).forEach((s) => {
      const nis = String(s.nis || s.id);
      studentMap[nis] = s.nama || s.name || nis;
    });

    Object.entries(patternMap).forEach(([nis, dayPatterns]) => {
      Object.entries(dayPatterns).forEach(([dayIndex, dates]) => {
        if (dates.length >= patternThreshold) {
          const name = studentMap[nis] || nis;
          const dayName = dayNames[parseInt(dayIndex)];
          window.sendLocalNotification(
            "🔄 Pola Alpa Terdeteksi",
            `${name}: ${dates.length}x Alpa di hari ${dayName} - perlu perhatian khusus.`
          );
        }
      });
    });
  }
};

// ==========================================
// IN-APP NOTIFICATION CENTER (POPOVER)
// ==========================================

// State global untuk data notifikasi
window.currentNotificationsList = [];
window.currentNotificationFilter = "all";

// Helper: Ambil informasi penerima berdasarkan mode login
window.getNotificationRecipientInfo = function () {
  if (appState.waliMode === true) {
    return {
      type: "wali",
      id: String(appState.waliSantri?.nis || appState.waliSantri?.id || "").trim().toLowerCase()
    };
  } else {
    return {
      type: "musyrif",
      id: String(appState.userProfile?.email || "").trim().toLowerCase()
    };
  }
};

// Toggle visibility dropdown
// Fetch notifications from Supabase with LocalStorage cache fallback
window.fetchNotifications = async function () {
  const recipient = window.getNotificationRecipientInfo();
  console.log("[NotificationManager] fetchNotifications called:", recipient);

  if (!recipient.id) {
    console.log("[NotificationManager] Skip fetch: No recipient ID logged in");
    window.renderNotificationsUI([]);
    return;
  }

  const cacheKey = `local_notifs_${recipient.type}_${recipient.id}`;
  console.log("[NotificationManager] Cache key:", cacheKey);
  let notificationsList = [];

  // Try to load cached first
  try {
    const cached = localStorage.getItem(cacheKey);
    console.log("[NotificationManager] Cached data:", cached ? "exists" : "empty");
    if (cached) {
      notificationsList = JSON.parse(cached);
      console.log("[NotificationManager] Loaded from cache, count:", notificationsList.length);
      window.renderNotificationsUI(notificationsList);
    }
  } catch (e) {
    console.warn("Failed to load cached notifications", e);
  }

  // Fetch from Supabase if online
  if (window.supabaseClient && window.supabaseClient.isOnline && window.supabaseClient.client) {
    try {
      console.log("[NotificationManager] Fetching from Supabase...");
      const { data, error } = await window.supabaseClient.client
        .from("notifications")
        .select("*")
        .eq("recipient_type", recipient.type)
        .eq("recipient_id", recipient.id)
        .order("created_at", { ascending: false })
        .limit(50); // Increased limit for full-page tab

      if (error) {
        console.error("[NotificationManager] Supabase error:", error);
        throw error;
      }

      console.log("[NotificationManager] Supabase response, count:", data?.length || 0);
      if (data && data.length > 0) {
        notificationsList = data;
        localStorage.setItem(cacheKey, JSON.stringify(data));
        window.renderNotificationsUI(notificationsList);
      }
    } catch (err) {
      console.error("Error fetching notifications from Supabase:", err);
    }
  } else {
    console.log("[NotificationManager] Supabase not available, showing cached data");
    // If local-only or offline, render cached (already done above, but refresh badge)
    window.renderNotificationsUI(notificationsList);
  }
};

// Add new notification (inserts to Supabase if online, and local storage cache)
window.addNotification = async function (recipientType, recipientId, title, body, type = "default", deepLink = "") {
  if (!recipientId) {
    console.log("[NotificationManager] addNotification skipped: no recipientId");
    return;
  }

  // Handle multiple Musyrif recipients separated by commas or semicolons
  if (recipientType === "musyrif" && (recipientId.includes(",") || recipientId.includes(";"))) {
    const emails = String(recipientId)
      .split(/[;,]/)
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    
    if (emails.length > 1) {
      console.log("[NotificationManager] Splitting notification for multiple Musyrifs:", emails);
      const promises = emails.map(email => 
        window.addNotification(recipientType, email, title, body, type, deepLink)
      );
      await Promise.all(promises);
      return;
    } else if (emails.length === 1) {
      recipientId = emails[0];
    }
  }

  console.log("[NotificationManager] addNotification called:", { recipientType, recipientId, title, body });

  const newNotif = {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
    recipient_type: recipientType,
    recipient_id: String(recipientId).trim().toLowerCase(),
    title,
    body,
    type,
    is_read: false,
    deep_link: deepLink,
    created_at: new Date().toISOString()
  };

  // 1. Update cache of recipient (if recipient is currently logged in)
  const currentRecipient = window.getNotificationRecipientInfo();
  console.log("[NotificationManager] Current recipient:", currentRecipient);
  console.log("[NotificationManager] Match?:", currentRecipient.type === recipientType && currentRecipient.id === newNotif.recipient_id);

  // Selalu simpan ke cache, baik match maupun tidak (untuk mode Wali/Musyrif berbeda)
  const cacheKey = `local_notifs_${recipientType}_${newNotif.recipient_id}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    let list = cached ? JSON.parse(cached) : [];
    list.unshift(newNotif);
    localStorage.setItem(cacheKey, JSON.stringify(list.slice(0, 50)));
    console.log("[NotificationManager] Cached notification for:", cacheKey);

    // Update UI hanya jika recipient yang login match
    if (currentRecipient.type === recipientType && currentRecipient.id === newNotif.recipient_id) {
      window.renderNotificationsUI(list);
    }
  } catch (e) {
    console.warn("Error updating local cache for new notification", e);
  }

  // 2. Insert to Supabase
  if (window.supabaseClient && window.supabaseClient.client && window.supabaseClient.isOnline) {
    try {
      const dbNotif = { ...newNotif };
      // Delete temporary ID if not a valid UUID format
      if (dbNotif.id.length < 30) delete dbNotif.id;

      const { error } = await window.supabaseClient.client
        .from("notifications")
        .insert(dbNotif);
      if (error) throw error;
      console.log("[NotificationManager] Notification saved to Supabase");
    } catch (err) {
      console.error("Error saving notification to Supabase:", err);
    }
  }
};

// Mark single notification as read
window.markNotificationAsRead = async function (id) {
  const recipient = window.getNotificationRecipientInfo();
  if (!recipient.id) return;

  const cacheKey = `local_notifs_${recipient.type}_${recipient.id}`;

  // 1. Update local cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      let list = JSON.parse(cached);
      list = list.map(item => item.id === id ? { ...item, is_read: true } : item);
      localStorage.setItem(cacheKey, JSON.stringify(list));
      window.renderNotificationsUI(list);
    }
  } catch (e) {
    console.warn("Error updating cache for mark as read", e);
  }

  // 2. Update Supabase
  if (window.supabaseClient && window.supabaseClient.client && window.supabaseClient.isOnline) {
    try {
      const { error } = await window.supabaseClient.client
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    } catch (err) {
      console.error("Error marking notification as read in Supabase:", err);
    }
  }
};

// Mark all as read
window.markAllNotificationsAsRead = async function (event) {
  if (event) event.stopPropagation();
  const recipient = window.getNotificationRecipientInfo();
  if (!recipient.id) return;

  const cacheKey = `local_notifs_${recipient.type}_${recipient.id}`;

  // 1. Update cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      let list = JSON.parse(cached);
      list = list.map(item => ({ ...item, is_read: true }));
      localStorage.setItem(cacheKey, JSON.stringify(list));
      window.renderNotificationsUI(list);
    }
  } catch (e) {
    console.warn("Error updating cache for mark all as read", e);
  }

  // 2. Update Supabase
  if (window.supabaseClient && window.supabaseClient.client && window.supabaseClient.isOnline) {
    try {
      const { error } = await window.supabaseClient.client
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_type", recipient.type)
        .eq("recipient_id", recipient.id)
        .eq("is_read", false);
      if (error) throw error;
      window.showToast("Semua notifikasi ditandai dibaca", "success");
    } catch (err) {
      console.error("Error marking all notifications as read in Supabase:", err);
    }
  }
};

// Handle Click on Notification Item
window.handleNotificationClick = function (id, deepLink) {
  // Mark as read
  window.markNotificationAsRead(id);
  // Deep link navigate
  window.executeDeepLink(deepLink);
};

// Execute Deep Link
window.executeDeepLink = function (deepLink) {
  if (!deepLink) return;
  const params = new URLSearchParams(deepLink);
  const tab = params.get("tab");

  if (tab) {
    if (typeof window.switchTab === "function") {
      window.switchTab(tab);
    } else if (typeof switchTab === "function") {
      switchTab(tab);
    }
  }

  const action = params.get("action");
  if (action === "verify") {
    setTimeout(() => {
      // Buka modal approval izin langsung
      if (typeof window.openMusyrifApprovalModal === "function") {
        window.openMusyrifApprovalModal();
      }
    }, 300);
  }
};

// Render UI Tab
window.renderNotificationsUI = function (notificationsList = []) {
  window.currentNotificationsList = notificationsList;

  // Update Stats UI
  const totalEl = document.getElementById("notif-stat-total");
  const unreadEl = document.getElementById("notif-stat-unread");
  const attEl = document.getElementById("notif-stat-attendance");
  const permitEl = document.getElementById("notif-stat-permit");

  const totalCount = notificationsList.length;
  const unreadCount = notificationsList.filter(item => !item.is_read).length;
  const attCount = notificationsList.filter(item => item.type === "attendance").length;
  const permitCount = notificationsList.filter(item => item.type === "permit").length;

  if (totalEl) totalEl.textContent = totalCount;
  if (unreadEl) unreadEl.textContent = unreadCount;
  if (attEl) attEl.textContent = attCount;
  if (permitEl) permitEl.textContent = permitCount;

  // Update badge in header
  const badge = document.getElementById("notif-badge");
  if (badge) {
    if (unreadCount > 0) {
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  // Render list berdasarkan filter yang aktif saat ini
  window.renderFilteredNotifications();
};

// Filter Notifikasi
window.filterNotifications = function (category) {
  window.currentNotificationFilter = category;
  
  // Update state active tombol filter chip
  document.querySelectorAll(".notif-filter-btn").forEach(btn => {
    const isTarget = btn.id === `notif-filter-${category}`;
    if (isTarget) {
      btn.className = "notif-filter-btn px-4 py-2 rounded-full text-xs font-bold transition-all bg-palette-blue text-white shadow-sm hover:scale-[1.02] active:scale-95 shrink-0";
    } else {
      btn.className = "notif-filter-btn px-4 py-2 rounded-full text-xs font-bold transition-all bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:scale-[1.02] active:scale-95 shrink-0";
    }
  });
  
  window.renderFilteredNotifications();
};

// Render Filtered Notifications
window.renderFilteredNotifications = function () {
  const listContainer = document.getElementById("tab-notification-list");
  if (!listContainer) return;

  const filter = window.currentNotificationFilter || "all";
  const rawList = window.currentNotificationsList || [];
  
  // Saring berdasarkan kategori
  const filteredList = rawList.filter(item => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  listContainer.innerHTML = '';

  if (filteredList.length === 0) {
    let emptyMsg = "Tidak ada notifikasi baru";
    let emptyIcon = "bell-off";
    if (filter !== "all") {
      const catLabels = {
        attendance: "Kehadiran",
        permit: "Perizinan",
        tahfizh: "Tahfizh",
        system: "Sistem"
      };
      emptyMsg = `Tidak ada notifikasi kategori ${catLabels[filter] || filter}`;
    }
    listContainer.innerHTML = `
      <div class="p-12 text-center text-slate-400 dark:text-slate-550">
        <i data-lucide="${emptyIcon}" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
        <p class="text-sm font-semibold">${emptyMsg}</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const categoryIcons = {
    permit: "file-text",
    attendance: "calendar",
    tahfizh: "book-open",
    system: "alert-triangle",
    announcement: "megaphone",
    default: "bell"
  };

  const categoryColors = {
    permit: "text-amber-500 bg-amber-50 dark:bg-amber-950/20",
    attendance: "text-blue-500 bg-blue-50 dark:bg-blue-950/20",
    tahfizh: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20",
    system: "text-rose-500 bg-rose-50 dark:bg-rose-950/20",
    announcement: "text-purple-500 bg-purple-50 dark:bg-purple-950/20",
    default: "text-slate-500 bg-slate-50 dark:bg-slate-950/20"
  };

  const categoryBorders = {
    permit: "border-amber-500",
    attendance: "border-blue-500",
    tahfizh: "border-emerald-500",
    system: "border-rose-500",
    announcement: "border-purple-500",
    default: "border-slate-300 dark:border-slate-700"
  };

  let html = "";
  filteredList.forEach(item => {
    const icon = categoryIcons[item.type] || categoryIcons.default;
    const colorClass = categoryColors[item.type] || categoryColors.default;
    const borderClass = categoryBorders[item.type] || categoryBorders.default;
    const isUnread = !item.is_read;
    const dateStr = item.created_at ? window.formatNotificationTime(item.created_at) : "";

    html += `
      <div onclick="window.handleNotificationClick('${item.id}', '${item.deep_link || ""}')" 
           class="p-5 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-all active:scale-[0.99] relative border-l-4 ${isUnread ? borderClass : "border-transparent"} ${isUnread ? "bg-slate-50/10 dark:bg-slate-850/5" : ""}">
        <div class="p-2.5 rounded-2xl shrink-0 ${colorClass}">
          <i data-lucide="${icon}" class="w-5 h-5"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-baseline gap-2">
            <h4 class="text-sm font-black text-slate-850 dark:text-white truncate ${isUnread ? "font-extrabold text-palette-blue dark:text-sky-400" : ""}">${item.title}</h4>
            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">${dateStr}</span>
          </div>
          <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">${item.body}</p>
        </div>
        ${isUnread ? `
          <span class="absolute top-1/2 right-4 -translate-y-1/2 w-2 h-2 rounded-full bg-palette-blue dark:bg-sky-400 animate-pulse"></span>
        ` : ""}
      </div>
    `;
  });

  listContainer.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();
};

// Helper: format notification timestamp nicely (e.g. "Just now", "5m ago", "12:30", "Yesterday")
window.formatNotificationTime = function (isoString) {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins}m lalu`;
    if (diffHours < 24) {
      if (date.getDate() === now.getDate()) {
        return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      }
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate()) {
      return "Kemarin";
    }

    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  } catch (e) {
    return "";
  }
};

// Trigger fetch ketika login / perubahan data akun selesai dilakukan
document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.syncRoleModeUI === "function") {
    const originalSyncRoleModeUI = window.syncRoleModeUI;
    window.syncRoleModeUI = function (...args) {
      originalSyncRoleModeUI(...args);
      setTimeout(() => {
        window.fetchNotifications();
      }, 1000);
    };
  } else {
    window.syncRoleModeUI = function () {
      setTimeout(() => {
        window.fetchNotifications();
      }, 1000);
    };
  }

  // Jaminan melakukan fetch awal setelah DOM termuat
  setTimeout(() => {
    window.fetchNotifications();
  }, 1000);
});

// Bind realtime notification changes callback
if (window.supabaseClient) {
  window.supabaseClient.onNotificationChange = (payload) => {
    console.log('[NotificationManager] Realtime notification change:', payload);
    window.fetchNotifications();

    // Tampilkan Toast & system notification untuk notifikasi baru yang masuk
    if (payload.eventType === 'INSERT' && !payload.new.is_read) {
      const currentRecipient = window.getNotificationRecipientInfo?.() || {};

      // Untuk notifikasi permit di Musyrif - refresh widget approval
      if (payload.new.type === 'permit' && currentRecipient.type === 'musyrif') {
        // Refresh approval widget to show new pending request
        if (typeof window.loadMusyrifRequests === 'function') {
          window.loadMusyrifRequests();
        }
        // Show toast
        window.showToast?.(`Pengajuan Izin Baru: ${payload.new.title}`, 'info');
        if (typeof window.sendLocalNotification === 'function') {
          window.sendLocalNotification(payload.new.title, payload.new.body, payload.new.type || 'info');
        }
        return;
      }

      window.showToast?.(`Notifikasi Baru: ${payload.new.title}`, 'info');

      if (typeof window.sendLocalNotification === 'function') {
        window.sendLocalNotification(payload.new.title, payload.new.body, payload.new.type || 'info');
      }
    }
  };
}
