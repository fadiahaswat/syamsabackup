// File: data-kelas.js

window.classData = {}; // Variabel global penampung data kelas
const classDataDebugLog = (...args) => {
  if (localStorage.getItem("DEBUG_LOGS") === "true" || location.search.includes("debug=true")) {
    console.log(...args);
  }
};

async function loadClassData() {
  try {
    classDataDebugLog("Mengambil data Kelas & Email Musyrif...");

    // Cek Cache dulu agar cepat
    const cache = localStorage.getItem("cache_data_kelas");
    if (cache) {
      window.classData = JSON.parse(cache);
      classDataDebugLog("Data Kelas dimuat dari cache lokal.");

      // Auto-update global state & UI dropdown dari cache segera
      window.MASTER_KELAS = window.classData;
      if (typeof MASTER_KELAS !== "undefined") {
        MASTER_KELAS = window.classData;
      }
      if (window.populateClassDropdown) {
        window.populateClassDropdown();
      }

      // Fetch background untuk update cache (silent update)
      fetchClassBackground();
      return window.classData;
    }

    // Skip fetch jika googleSheetUrl belum dikonfigurasi
    if (!window.APP_CREDENTIALS?.googleSheetUrl) {
      classDataDebugLog("loadClassData dilewati: googleSheetUrl belum dikonfigurasi");
      return window.classData || {};
    }

    // Jika tidak ada cache, ambil langsung
    const response = await fetch(
      `${window.APP_CREDENTIALS.googleSheetUrl}?type=kelas`,
    );
    if (!response.ok) throw new Error("Gagal koneksi server kelas");

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error("Response bukan JSON valid");
    }

    const rawData = await response.json();

    // Konversi Array ke Object agar mudah dicari: { "1A": {wali: "...", musyrif: "...", email: "..."}, ... }
    window.classData = {};
    rawData.forEach((row) => {
      if (row.kelas) {
        window.classData[row.kelas] = {
          wali: row.wali || "-",
          musyrif: row.musyrif || "-",
          email: row.email || "",
          id: row.id || "",
        };
      }
    });

    // Simpan ke cache
    localStorage.setItem("cache_data_kelas", JSON.stringify(window.classData));
    classDataDebugLog(
      "Data Kelas berhasil diunduh:",
      Object.keys(window.classData).length,
      "kelas.",
    );

    // Auto-update global state & UI dropdown jika sudah terunduh
    window.MASTER_KELAS = window.classData;
    if (typeof MASTER_KELAS !== "undefined") {
      MASTER_KELAS = window.classData;
    }
    if (window.populateClassDropdown) {
      window.populateClassDropdown();
    }

    return window.classData;
  } catch (error) {
    console.error("Error loadClassData:", error);
    return {};
  }
}

// Fungsi update cache di background (tanpa loading screen)
async function fetchClassBackground() {
  try {
    // Skip if googleSheetUrl is not configured
    if (!window.APP_CREDENTIALS?.googleSheetUrl) {
      classDataDebugLog("Background update kelas dilewati: googleSheetUrl belum dikonfigurasi");
      return;
    }

    const response = await fetch(
      `${window.APP_CREDENTIALS.googleSheetUrl}?type=kelas`,
    );

    // Check for HTTP errors
    if (!response.ok) {
      classDataDebugLog(`Background update kelas gagal: HTTP ${response.status}`);
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      classDataDebugLog("Background update kelas gagal: response bukan JSON");
      return;
    }

    const rawData = await response.json();
    const newData = {};
    rawData.forEach((row) => {
      if (row.kelas) {
        newData[row.kelas] = {
          wali: row.wali || "-",
          musyrif: row.musyrif || "-",
          email: row.email || "",
          id: row.id || "",
        };
      }
    });
    localStorage.setItem("cache_data_kelas", JSON.stringify(newData));

    window.classData = newData;
    // Auto-update global state & UI dropdown saat background update selesai
    window.MASTER_KELAS = newData;
    if (typeof MASTER_KELAS !== "undefined") {
      MASTER_KELAS = newData;
    }
    if (window.populateClassDropdown) {
      window.populateClassDropdown();
    }
  } catch (e) {
    classDataDebugLog("Background update kelas gagal:", e.message);
    // Silent fail untuk background update - jangan tampilkan error
  }
}

// Ekspos ke global window
window.loadClassData = loadClassData;
