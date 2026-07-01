// File: data-santri.js

window.santriData = []; // Variabel global penampung data santri
const santriDataDebugLog = (...args) => {
  if (localStorage.getItem("DEBUG_LOGS") === "true" || location.search.includes("debug=true")) {
    console.log(...args);
  }
};

async function loadSantriData() {
  const CACHE_KEY = "cache_data_santri_full";
  const CACHE_TIME = "time_data_santri";
  const EXPIRY_MS = window.APP_CONSTANTS.santriCacheExpiryMs;

  try {
    santriDataDebugLog("Mengambil data Santri...");
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

      // Jika cache sudah kadaluarsa (lebih dari 24 jam), perbarui di background jika bukan file://
      if (now - cachedTime > EXPIRY_MS) {
        if (window.location.protocol !== "file:") {
          fetchSantriBackground();
        } else {
          santriDataDebugLog("Background update santri dilewati pada file://");
        }
      }

      santriDataDebugLog("Data Santri dimuat dari cache lokal (Cepat).");
      return window.santriData;
    }

    // Skip fetch jika dijalankan via file://
    if (window.location.protocol === "file:") {
      santriDataDebugLog("loadSantriData dilewati pada file:// karena CORS");
      return window.santriData || [];
    }

    // Skip fetch jika googleSheetUrl belum dikonfigurasi
    if (!window.APP_CREDENTIALS?.googleSheetUrl) {
      santriDataDebugLog("loadSantriData dilewati: googleSheetUrl belum dikonfigurasi");
      return window.santriData || [];
    }

    // 2. Jika Cache Kosong (Pertama kali buka), Download Baru secara sinkron
    santriDataDebugLog("Mengunduh data santri pertama kali dari server...");
    const response = await fetch(window.APP_CREDENTIALS.googleSheetUrl);

    if (!response.ok) throw new Error("Gagal koneksi server santri");

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error("Response bukan JSON valid");
    }

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

    santriDataDebugLog("Data Santri berhasil diunduh:", data.length, "santri.");
    return window.santriData;
  } catch (error) {
    santriDataDebugLog("Error loadSantriData:", error.message);
    return [];
  }
}

// Fungsi update cache di background (tanpa memblokir loading screen startup)
async function fetchSantriBackground() {
  const CACHE_KEY = "cache_data_santri_full";
  const CACHE_TIME = "time_data_santri";

  try {
    // Skip if running on file:// protocol due to CORS
    if (window.location.protocol === "file:") {
      santriDataDebugLog("Background update santri dilewati pada file://");
      return;
    }

    // Skip if googleSheetUrl is not configured
    if (!window.APP_CREDENTIALS?.googleSheetUrl) {
      santriDataDebugLog("Background update santri dilewati: googleSheetUrl belum dikonfigurasi");
      return;
    }

    const response = await fetch(window.APP_CREDENTIALS.googleSheetUrl);

    // Check for HTTP errors
    if (!response.ok) {
      santriDataDebugLog(`Background update santri gagal: HTTP ${response.status}`);
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      santriDataDebugLog("Background update santri gagal: response bukan JSON");
      return;
    }

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

    santriDataDebugLog("Data Santri background update selesai.");
  } catch (e) {
    santriDataDebugLog("Background update santri gagal:", e.message);
    // Silent fail untuk background update - jangan tampilkan error
  }
}

// Ekspos ke global window
window.loadSantriData = loadSantriData;
