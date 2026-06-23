// File: data-santri.js

window.santriData = []; // Variabel global penampung data santri

async function loadSantriData() {
  const CACHE_KEY = "cache_data_santri_full";
  const CACHE_TIME = "time_data_santri";
  const EXPIRY_MS = window.APP_CONSTANTS.santriCacheExpiryMs;

  try {
    console.log("📥 Mengambil data Santri...");
    const now = new Date().getTime();
    const cachedStr = localStorage.getItem(CACHE_KEY);
    const cachedTime = Number(localStorage.getItem(CACHE_TIME) || 0);

    // Load cache immediately as a fallback/placeholder
    if (cachedStr) {
      window.santriData = JSON.parse(cachedStr);
      if (typeof MASTER_SANTRI !== "undefined") {
        MASTER_SANTRI = window.santriData;
      } else {
        window.MASTER_SANTRI = window.santriData;
      }
    }

    // 1. Gunakan Cache jika Valid
    if (cachedStr && cachedTime > 0 && now - cachedTime < EXPIRY_MS) {
      console.log("✅ Data Santri dimuat dari cache (Cepat).");
      return window.santriData;
    }

    // 2. Jika Cache Expired/Kosong, Download Baru
    console.log("🌐 Mengunduh data santri terbaru dari server...");
    const response = await fetch(window.APP_CREDENTIALS.googleSheetUrl);

    if (!response.ok) throw new Error("Gagal koneksi server santri");

    const data = await response.json();

    if (!Array.isArray(data)) throw new Error("Format data santri salah");

    // Simpan ke Global & Cache
    window.santriData = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME, now);

    if (typeof MASTER_SANTRI !== "undefined") {
      MASTER_SANTRI = data;
    } else {
      window.MASTER_SANTRI = data;
    }

    console.log("✅ Data Santri berhasil diunduh:", data.length, "santri.");
    return window.santriData;
  } catch (error) {
    console.error("❌ Error loadSantriData:", error);

    // Fallback: Pakai cache lama meskipun expired daripada error
    const oldCache = localStorage.getItem(CACHE_KEY);
    if (oldCache) {
      console.warn("⚠️ Menggunakan data cache lawas (Offline Mode).");
      window.santriData = JSON.parse(oldCache);
      if (typeof MASTER_SANTRI !== "undefined") {
        MASTER_SANTRI = window.santriData;
      } else {
        window.MASTER_SANTRI = window.santriData;
      }
      return window.santriData;
    }

    return [];
  }
}

// Ekspos ke global window
window.loadSantriData = loadSantriData;
