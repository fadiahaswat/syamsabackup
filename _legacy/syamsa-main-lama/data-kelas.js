// File: data-kelas.js

window.classData = {}; // Variabel global penampung data kelas

async function loadClassData() {
  try {
    console.log("📥 Mengambil data Kelas & Email Musyrif...");

    // Cek Cache dulu agar cepat
    const cache = localStorage.getItem("cache_data_kelas");
    if (cache) {
      window.classData = JSON.parse(cache);
      console.log("✅ Data Kelas dimuat dari cache lokal.");
      // Fetch background untuk update cache (silent update)
      fetchClassBackground();
      return window.classData;
    }

    // Jika tidak ada cache, ambil langsung
    const response = await fetch(
      `${window.APP_CREDENTIALS.googleSheetUrl}?type=kelas`,
    );
    if (!response.ok) throw new Error("Gagal koneksi server kelas");

    const rawData = await response.json();

    // Konversi Array ke Object agar mudah dicari: { "1A": {wali: "...", musyrif: "...", email: "..."}, ... }
    window.classData = {};
    rawData.forEach((row) => {
      if (row.kelas) {
        window.classData[row.kelas] = {
          wali: row.wali || "-",
          musyrif: row.musyrif || "-",
          email: row.email || "",
        };
      }
    });

    // Simpan ke cache
    localStorage.setItem("cache_data_kelas", JSON.stringify(window.classData));
    console.log(
      "✅ Data Kelas berhasil diunduh:",
      Object.keys(window.classData).length,
      "kelas.",
    );

    return window.classData;
  } catch (error) {
    console.error("❌ Error loadClassData:", error);
    return {};
  }
}

// Fungsi update cache di background (tanpa loading screen)
async function fetchClassBackground() {
  try {
    const response = await fetch(
      `${window.APP_CREDENTIALS.googleSheetUrl}?type=kelas`,
    );
    const rawData = await response.json();
    const newData = {};
    rawData.forEach((row) => {
      if (row.kelas) {
        newData[row.kelas] = {
          wali: row.wali || "-",
          musyrif: row.musyrif || "-",
          email: row.email || "",
        };
      }
    });
    localStorage.setItem("cache_data_kelas", JSON.stringify(newData));
  } catch (e) {
    console.warn("Background update kelas gagal:", e);
  }
}

// Ekspos ke global window
window.loadClassData = loadClassData;
