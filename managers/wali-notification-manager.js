/**
 * Wali Notification Manager
 *
 * Sistem notifikasi untuk wali siswa ketika anak ditandai Alpa
 *
 * Struktur Data di Firebase:
 * /wali_tokens/{nis}/
 *   namaWali: "Budi Santoso"
 *   noHP: "081234567890"
 *   email: "budi@email.com"
 *   fcmToken: "..." (token browser/HP wali)
 *   lastActive: timestamp
 *   active: true
 */

class WaliNotificationManager {
  constructor() {
    this.db = null;
    this.dbRef = null;
    this.dbSet = null;
    this.dbPush = null;
    this.dbGet = null;
    this.isInitialized = false;
    this.debugMode = true;
  }

  /**
   * Debug log
   */
  log(...args) {
    if (this.debugMode) {
      console.log("[WALI-NOTIF]", ...args);
    }
  }

  /**
   * Initialize Wali Notification Manager
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Wait for Firebase
      if (window.initFirebase) {
        await window.initFirebase();
      }

      this.db = window.FIREBASE_DB;
      this.dbRef = window.FIREBASE_REF;
      this.dbSet = window.FIREBASE_SET;
      this.dbGet = window.FIREBASE_GET;
      this.dbPush = window.FIREBASE_PUSH;

      if (!this.db) {
        this.log("Firebase not available");
        return;
      }

      this.isInitialized = true;
      this.log("Wali Notification Manager initialized");
    } catch (error) {
      console.error("[WALI-NOTIF] Init error:", error);
    }
  }

  /**
   * Register wali's device/token for notifications
   * Dipanggil saat wali login/register di aplikasi
   */
  async registerWali(nis, waliData) {
    if (!this.isInitialized) await this.init();

    try {
      const token = localStorage.getItem("fcm_token");

      const waliRecord = {
        nis: nis,
        namaWali: waliData.namaWali || "Wali",
        noHP: waliData.noHP || "",
        email: waliData.email || "",
        fcmToken: token || null,
        registeredAt: Date.now(),
        lastActive: Date.now(),
        active: true
      };

      // Save to Firebase
      const ref = this.dbRef(this.db, `wali_tokens/${nis}`);
      await this.dbSet(ref, waliRecord, { merge: true });

      // Also save locally for quick lookup
      localStorage.setItem(`wali_${nis}`, JSON.stringify(waliRecord));

      this.log(`Wali registered for NIS ${nis}`);
      return true;
    } catch (error) {
      console.error("[WALI-NOTIF] Register error:", error);
      return false;
    }
  }

  /**
   * Get wali info by NIS
   */
  async getWaliByNis(nis) {
    if (!this.isInitialized) await this.init();

    try {
      // Check localStorage first
      const local = localStorage.getItem(`wali_${nis}`);
      if (local) {
        return JSON.parse(local);
      }

      // Fetch from Firebase
      const ref = this.dbRef(this.db, `wali_tokens/${nis}`);
      const snapshot = await this.dbGet(ref);

      if (snapshot.exists()) {
        const data = snapshot.val();
        // Cache locally
        localStorage.setItem(`wali_${nis}`, JSON.stringify(data));
        return data;
      }

      return null;
    } catch (error) {
      console.error("[WALI-NOTIF] Get wali error:", error);
      return null;
    }
  }

  /**
   * Send notification to wali when student is marked Alpa
   * @param {string} nis - NIS siswa
   * @param {string} namaSantri - Nama siswa
   * @param {string} kelas - Kelas siswa
   * @param {string} slotLabel - Label sesi (Shubuh, Ashar, dll)
   * @param {string} tanggal - Tanggal presensi (YYYY-MM-DD)
   */
  async notifyWaliAlpa(nis, namaSantri, kelas, slotLabel, tanggal) {
    if (!this.isInitialized) await this.init();

    try {
      // Get wali data
      const wali = await this.getWaliByNis(nis);

      if (!wali) {
        this.log(`No wali registered for NIS ${nis}`);
        // Simpan ke queue untuk notifikasi nanti
        await this.queueNotification(nis, {
          type: "alpa",
          namaSantri,
          kelas,
          slotLabel,
          tanggal,
          timestamp: Date.now()
        });
        return { success: false, reason: "no_wali_registered", queued: true };
      }

      if (!wali.fcmToken) {
        this.log(`No FCM token for wali of NIS ${nis}`);
        await this.queueNotification(nis, {
          type: "alpa",
          namaSantri,
          kelas,
          slotLabel,
          tanggal,
          timestamp: Date.now()
        });
        return { success: false, reason: "no_token", queued: true };
      }

      // Kirim notifikasi via FCM
      const notification = {
        title: `⚠️ Info Presensi: ${namaSantri}`,
        body: `${namaSantri} (${kelas}) tidak hadir (Alpa) pada sesi ${slotLabel} tanggal ${this.formatTanggal(tanggal)}.`,
        tag: `alpa-${nis}-${tanggal}`,
        data: {
          type: "alpa_notification",
          nis: nis,
          namaSantri: namaSantri,
          kelas: kelas,
          slotLabel: slotLabel,
          tanggal: tanggal,
          url: "./?view=alpa-history"
        }
      };

      // Simpan ke history
      await this.saveNotificationHistory(nis, notification);

      // CRITICAL FIX: Actually trigger sending the notification via Firebase Realtime Database for the server to process!
      const sent = await this.sendFCMToToken(wali.fcmToken, notification);
      if (!sent) {
        this.log(`Failed to queue FCM token message for wali of ${namaSantri}`);
      }

      this.log(`Notification sent & queued for wali of ${namaSantri}:`, notification);
      return { success: true, notification };

    } catch (error) {
      console.error("[WALI-NOTIF] Notify error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Queue notification untuk wali yang belum register
   */
  async queueNotification(nis, data) {
    if (!this.isInitialized) await this.init();

    try {
      const queueRef = this.dbRef(this.db, `notif_queue/${nis}`);
      const newRef = this.dbPush(queueRef);
      await this.dbSet(newRef, {
        ...data,
        queuedAt: Date.now(),
        sent: false
      });
      this.log(`Notification queued for NIS ${nis}`);
    } catch (error) {
      console.error("[WALI-NOTIF] Queue error:", error);
    }
  }

  /**
   * Send queued notifications to a wali
   */
  async sendQueuedNotifications(nis) {
    if (!this.isInitialized) await this.init();

    try {
      const queueRef = this.dbRef(this.db, `notif_queue/${nis}`);
      const snapshot = await this.dbGet(queueRef);

      if (!snapshot.exists()) return;

      const queued = [];
      snapshot.forEach((child) => {
        queued.push({ key: child.key, ...child.val() });
      });

      // Process each queued notification
      for (const item of queued) {
        if (item.sent) continue;

        const wali = await this.getWaliByNis(nis);
        if (wali && wali.fcmToken) {
          // Kirim notification
          await this.sendFCMToToken(wali.fcmToken, {
            title: `⚠️ Info: ${item.namaSantri}`,
            body: `${item.namaSantri} (${item.kelas}) Alpa - ${item.slotLabel}, ${this.formatTanggal(item.tanggal)}`,
            data: item
          });

          // Mark as sent
          const itemRef = this.dbRef(this.db, `notif_queue/${nis}/${item.key}`);
          await this.dbSet(itemRef, { sent: true, sentAt: Date.now() }, { merge: true });

          this.log(`Sent queued notification to ${nis}`);
        }
      }
    } catch (error) {
      console.error("[WALI-NOTIF] Send queued error:", error);
    }
  }

  /**
   * Send FCM directly to a token
   * NOTE: Ini harus dilakukan dari SERVER, bukan dari browser
   * Untuk demo, kita simpan ke Firebase dan server yang kirim
   */
  async sendFCMToToken(token, notification) {
    try {
      // Simpan ke Firebase untuk diproses oleh server
      const pendingRef = this.dbRef(this.db, `pending_notifications/${Date.now()}`);
      await this.dbSet(pendingRef, {
        token: token,
        ...notification,
        createdAt: Date.now()
      });

      this.log("Notification saved to pending_notifications for server to process");
      return true;
    } catch (error) {
      console.error("[WALI-NOTIF] Send FCM error:", error);
      return false;
    }
  }

  /**
   * Save notification to history
   */
  async saveNotificationHistory(nis, notification) {
    if (!this.isInitialized) await this.init();

    try {
      const historyRef = this.dbRef(this.db, `notif_history/${nis}`);
      const newRef = this.dbPush(historyRef);
      await this.dbSet(newRef, {
        ...notification,
        sentAt: Date.now()
      });
    } catch (error) {
      console.error("[WALI-NOTIF] History save error:", error);
    }
  }

  /**
   * Format tanggal ke format Indonesia
   */
  formatTanggal(dateStr) {
    const bulan = [
      "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const [year, month, day] = dateStr.split("-");
    return `${parseInt(day)} ${bulan[parseInt(month)]} ${year}`;
  }

  /**
   * Check if student has registered wali
   */
  async hasRegisteredWali(nis) {
    const wali = await this.getWaliByNis(nis);
    return wali !== null && wali.fcmToken !== null;
  }
}

// Create global instance
window.waliNotificationManager = new WaliNotificationManager();

// Export for easy access
window.notifyWaliAlpa = async function(nis, namaSantri, kelas, slotLabel, tanggal) {
  return await window.waliNotificationManager.notifyWaliAlpa(nis, namaSantri, kelas, slotLabel, tanggal);
};

window.registerWali = async function(nis, waliData) {
  return await window.waliNotificationManager.registerWali(nis, waliData);
};

console.log("[WALI-NOTIF] Wali Notification Manager loaded");
