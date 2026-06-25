// File: santri-manager.js

// Variabel global untuk menyimpan database terstruktur
window.santriDB = {};

window.SantriManager = {
  getPrefs: (nis) => {
    if (!nis) return { password: null, avatar: null, linkedEmail: null };
    const data = localStorage.getItem(`santri_pref_${nis}`);
    return data
      ? JSON.parse(data)
      : { password: null, avatar: null, linkedEmail: null };
  },

  savePrefs: (nis, newPrefs) => {
    if (!nis) return null;
    const current = window.SantriManager.getPrefs(nis);
    const updated = { ...current, ...newPrefs };
    localStorage.setItem(`santri_pref_${nis}`, JSON.stringify(updated));
    return updated;
  },

  // Simpan nomor HP orang tua
  saveParentPhone: (nis, phone) => {
    if (!nis) return false;
    const prefs = window.SantriManager.getPrefs(nis);
    prefs.parentPhone = phone;
    localStorage.setItem(`santri_pref_${nis}`, JSON.stringify(prefs));
    return true;
  },

  // Ambil nomor HP orang tua
  getParentPhone: (nis) => {
    if (!nis) return null;
    const prefs = window.SantriManager.getPrefs(nis);
    return prefs.parentPhone || null;
  },

  // Ambil semua nomor HP orang tua
  getAllParentPhones: () => {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("santri_pref_")) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          const nis = key.replace("santri_pref_", "");
          if (data.parentPhone) {
            result[nis] = data.parentPhone;
          }
        } catch (e) {
          continue;
        }
      }
    }
    return result;
  },

  findNisByEmail: (email) => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("santri_pref_")) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          if (data.linkedEmail === email) {
            return key.replace("santri_pref_", "");
          }
        } catch (e) {
          continue;
        }
      }
    }
    return null;
  },
};

window.parseSantriData = function () {
  // Mengambil data mentah dari window.santriData (yang diload dari data-santri.js)
  if (
    typeof window.santriData === "undefined" ||
    !Array.isArray(window.santriData)
  ) {
    console.warn("parseSantriData: window.santriData belum tersedia.");
    return;
  }

  window.santriDB = {};

  window.santriData.forEach((item) => {
    const rombel = item.kelas || item.rombel || "";
    const nis = item.nis || "";
    const nama = item.nama || "";

    const waliKhusus = item.wali_khusus || "";
    const musyrifKhusus = item.musyrif_khusus || "";

    if (!rombel) return;

    const level = rombel.charAt(0); // Misal "1A" -> Level "1"

    if (!window.santriDB[level]) window.santriDB[level] = {};
    if (!window.santriDB[level][rombel]) window.santriDB[level][rombel] = [];

    window.santriDB[level][rombel].push({
      nama,
      nis,
      rombel,
      waliKhusus,
      musyrifKhusus,
    });
  });

  console.log("Database Santri (santriDB) Berhasil Disusun.");
};
