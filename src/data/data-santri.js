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

    // 1. Load dari Cache segera jika tersedia (Sangat Cepat)
    if (cachedStr) {
      window.santriData = JSON.parse(cachedStr);
      if (typeof MASTER_SANTRI !== "undefined") {
        MASTER_SANTRI = window.santriData;
      } else {
        window.MASTER_SANTRI = window.santriData;
      }

      // Jika cache sudah kadaluarsa (lebih dari 24 jam), perbarui di background
      if (now - cachedTime > EXPIRY_MS) {
        fetchSantriBackground();
      }

      console.log("✅ Data Santri dimuat dari cache lokal (Cepat).");
      return window.santriData;
    }

    // 2. Jika Cache Kosong (Pertama kali buka), Download Baru secara sinkron
    console.log("🌐 Mengunduh data santri pertama kali dari server...");
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
    return [];
  }
}

// Fungsi update cache di background (tanpa memblokir loading screen startup)
async function fetchSantriBackground() {
  const CACHE_KEY = "cache_data_santri_full";
  const CACHE_TIME = "time_data_santri";
  try {
    const response = await fetch(window.APP_CREDENTIALS.googleSheetUrl);
    if (!response.ok) throw new Error("Gagal koneksi server santri");

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Format data santri salah");

    window.santriData = data;
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME, new Date().getTime());

    if (typeof MASTER_SANTRI !== "undefined") {
      MASTER_SANTRI = data;
    } else {
      window.MASTER_SANTRI = data;
    }

    console.log("✅ Data Santri background update selesai.");
  } catch (e) {
    console.warn("Background update santri gagal:", e);
  }
}

// Ekspos ke global window
window.loadSantriData = loadSantriData;
