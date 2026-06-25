// File: qibla.js
// Logika Kompas Kiblat Interaktif untuk Musyrif App

window.qiblaAngle = null;
window.qiblaDistance = null;
window.deviceHeading = null;
window.orientationListenerActive = false;
window.qiblaLocked = false;
window.qiblaSoundEnabled = false;
window.lastQiblaSoundTime = 0;
window.qiblaOriginalThemeColors = null;
window.compassTargetMode = "qibla";
window.compassTargetName = "Kakbah";
window.compassTargetRadius = null;
window.asramaGpsWatchId = null;
window.asramaCurrentTarget = null;
window.asramaPresensiShown = false;

// Fungsi untuk membuka halaman presensi dari navigasi asrama
window.openPresensiFromAsrama = function () {
  window.closeQiblaPage();
  window.openAttendance();
};

// Fungsi untuk update visibilitas tombol presensi berdasarkan jarak
window.updateAsramaPresensiButton = function (distance, radius) {
  const presensiBtn = document.getElementById("qibla-presensi-btn");
  if (!presensiBtn) return;

  const isInside = Number.isFinite(distance) && distance <= radius;

  if (isInside && !window.asramaPresensiShown) {
    // Tampilkan tombol dengan animasi
    presensiBtn.classList.remove("hidden");
    presensiBtn.classList.add("flex");
    presensiBtn.classList.add("animate-bounce");
    window.asramaPresensiShown = true;

    // Hapus animasi bounce setelah 2 detik
    setTimeout(() => {
      presensiBtn.classList.remove("animate-bounce");
    }, 2000);

    // Update theme ke hijau (tanda aman)
    window.setQiblaBrowserChrome("green");
  } else if (!isInside && !window.asramaPresensiShown) {
    // Jangan sembunyikan jika belum pernah shown, biarkan hidden
  } else if (!isInside && window.asramaPresensiShown) {
    // Jika keluar radius setelah sebelumnya sudah masuk, sembunyikan tombol
    presensiBtn.classList.add("hidden");
    presensiBtn.classList.remove("flex");
    window.asramaPresensiShown = false;
    window.setQiblaBrowserChrome("dark");
  }
};

// Lokasi Kakbah Makkah
const MECCA_LAT = 21.422487;
const MECCA_LNG = 39.826206;

// Fungsi hitung sudut arah kiblat (Bearing)
window.calculateQiblaBearing = function (lat, lng) {
  return window.calculateBearingTo(lat, lng, MECCA_LAT, MECCA_LNG);
};

window.calculateBearingTo = function (lat, lng, targetLat, targetLng) {
  const phi1 = lat * Math.PI / 180;
  const phi2 = targetLat * Math.PI / 180;
  const lambda1 = lng * Math.PI / 180;
  const lambda2 = targetLng * Math.PI / 180;
  const dLng = lambda2 - lambda1;

  const y = Math.sin(dLng);
  const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

// Fungsi hitung jarak ke Kakbah (Haversine Formula)
window.calculateQiblaDistance = function (lat, lng) {
  return window.calculateDistanceMeters(lat, lng, MECCA_LAT, MECCA_LNG) / 1000;
};

window.calculateDistanceMeters = function (lat, lng, targetLat, targetLng) {
  const R = 6371e3;
  const dLat = (targetLat - lat) * Math.PI / 180;
  const dLng = (targetLng - lng) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

window.findNearestAsramaTarget = function (lat, lng) {
  const locations = window.APP_LOCATION?.geofenceLocations || [];
  let nearest = null;
  let nearestDistance = Infinity;

  locations.forEach((loc) => {
    const distance = window.calculateDistanceMeters(lat, lng, loc.lat, loc.lng);
    if (distance < nearestDistance) {
      nearest = loc;
      nearestDistance = distance;
    }
  });

  return nearest ? { ...nearest, distance: nearestDistance } : null;
};

// Main function to open and init Qibla Page
window.openQiblaPage = function () {
  window.compassTargetMode = "qibla";
  window.compassTargetName = "Kakbah";
  const viewMain = document.getElementById("view-main");
  const viewQibla = document.getElementById("view-qibla");
  if (!viewQibla) return;

  window.qiblaLocked = false;
  if (window.qiblaLockTimer) {
    clearTimeout(window.qiblaLockTimer);
    window.qiblaLockTimer = null;
  }
  window.preparePrecisionQiblaUI();
  window.setQiblaBrowserChrome("dark");
  window.setQiblaPrecisionState("searching");
  viewQibla.classList.remove("hidden");
  viewQibla.classList.add("flex");
  viewQibla.scrollTop = 0;
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => {
    if (viewMain) viewMain.classList.add("hidden");
  }, 250);

  // Show GPS loading
  document.getElementById("qibla-loading").classList.remove("hidden");
  document.getElementById("qibla-content-wrapper").classList.add("hidden");
  document.getElementById("qibla-sensor-permission-btn").classList.add("hidden");

  // Get current position - hanya minta izin di awal saja
  const gpsPermissionKey = "gps_permission_denied_" + window.APP_CONFIG?.appName?.replace(/\s+/g, "_").toLowerCase() || "syamsa_app";
  const denied = sessionStorage.getItem(gpsPermissionKey);

  if (denied) {
    // Skip GPS, gunakan fallback langsung
    useFallbackLocation();
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        window.qiblaAngle = window.calculateQiblaBearing(lat, lng);
        window.qiblaDistance = window.calculateQiblaDistance(lat, lng);

        // Update UI
        document.getElementById("qibla-angle-txt").textContent = Math.round(window.qiblaAngle) + "\u00b0";
        document.getElementById("qibla-distance-txt").textContent = Math.round(window.qiblaDistance).toLocaleString("id-ID") + " km";

        document.getElementById("qibla-loading").classList.add("hidden");
        document.getElementById("qibla-content-wrapper").classList.remove("hidden");
        window.setQiblaPrecisionState("calibrating");

        // Request Compass/Orientation permission
        window.initCompass();
      },
      (error) => {
        console.error("GPS error for Qibla:", error);
        // Tandai bahwa user pernah tolak izin GPS
        sessionStorage.setItem(gpsPermissionKey, "true");
        useFallbackLocation();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else {
    window.showToast("Browser Anda tidak mendukung GPS.", "error");
    useFallbackLocation();
  }
};

// Fungsi fallback menggunakan koordinat regional
function useFallbackLocation() {
  const fallbackLocation = window.APP_LOCATION?.qiblaFallbackLocation || {
    lat: -7.801389,
    lng: 110.364444,
  };
  const fallbackLat = fallbackLocation.lat;
  const fallbackLng = fallbackLocation.lng;

  window.qiblaAngle = window.calculateQiblaBearing(fallbackLat, fallbackLng);
  window.qiblaDistance = window.calculateQiblaDistance(fallbackLat, fallbackLng);

  document.getElementById("qibla-angle-txt").textContent = Math.round(window.qiblaAngle) + "\u00b0 (Perkiraan)";
  document.getElementById("qibla-distance-txt").textContent = Math.round(window.qiblaDistance).toLocaleString("id-ID") + " km";

  document.getElementById("qibla-loading").classList.add("hidden");
  document.getElementById("qibla-content-wrapper").classList.remove("hidden");
  window.setQiblaPrecisionState("calibrating");

  window.initCompass();
  window.showToast("Gagal GPS. Menggunakan estimasi koordinat regional.", "info");
}

window.openAsramaPage = function () {
  window.compassTargetMode = "asrama";
  window.compassTargetName = "Asrama";
  const viewMain = document.getElementById("view-main");
  const viewQibla = document.getElementById("view-qibla");
  if (!viewQibla) return;

  window.qiblaLocked = false;
  if (window.qiblaLockTimer) {
    clearTimeout(window.qiblaLockTimer);
    window.qiblaLockTimer = null;
  }
  window.preparePrecisionQiblaUI();
  window.setQiblaBrowserChrome("dark");
  window.setQiblaPrecisionState("searching");
  viewQibla.classList.remove("hidden");
  viewQibla.classList.add("flex");
  viewQibla.scrollTop = 0;
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => {
    if (viewMain) viewMain.classList.add("hidden");
  }, 250);

  document.getElementById("qibla-loading").classList.remove("hidden");
  document.getElementById("qibla-content-wrapper").classList.add("hidden");
  document.getElementById("qibla-sensor-permission-btn").classList.add("hidden");

  const openWithPosition = (lat, lng) => {
    const target = window.findNearestAsramaTarget(lat, lng);

    if (!target) {
      window.showToast("Target asrama belum tersedia di konfigurasi lokasi.", "warning");
      window.closeQiblaPage();
      return;
    }

    window.compassTargetName = target.name || "Asrama";
    window.compassTargetRadius = target.radiusMeters || target.radius || window.APP_LOCATION?.maxRadiusMeters || 50;
    window.asramaCurrentTarget = target;
    window.qiblaAngle = window.calculateBearingTo(lat, lng, target.lat, target.lng);
    window.qiblaDistance = target.distance;

    document.getElementById("qibla-angle-txt").textContent = Math.round(window.qiblaAngle) + "\u00b0";
    document.getElementById("qibla-distance-txt").textContent = window.formatAsramaDistance(window.qiblaDistance);
    document.getElementById("qibla-loading").classList.add("hidden");
    document.getElementById("qibla-content-wrapper").classList.remove("hidden");
    window.setQiblaPrecisionState("calibrating");
    window.initCompass();

    // Check apakah sudah di dalam radius
    window.updateAsramaPresensiButton(window.qiblaDistance, window.compassTargetRadius);
  };

  const updateAsramaPosition = (lat, lng) => {
    if (!window.asramaCurrentTarget) return;

    const distance = window.calculateDistanceMeters(lat, lng, window.asramaCurrentTarget.lat, window.asramaCurrentTarget.lng);
    window.qiblaDistance = distance;
    window.qiblaAngle = window.calculateBearingTo(lat, lng, window.asramaCurrentTarget.lat, window.asramaCurrentTarget.lng);

    document.getElementById("qibla-angle-txt").textContent = Math.round(window.qiblaAngle) + "\u00b0";
    document.getElementById("qibla-distance-txt").textContent = window.formatAsramaDistance(distance);

    // Update tombol presensi berdasarkan jarak
    window.updateAsramaPresensiButton(distance, window.compassTargetRadius);

    // Trigger update compass UI dengan heading terakhir jika ada
    if (window.deviceHeading !== null) {
      window.updateCompassUI(window.deviceHeading);
    }
  };

  if (window.asramaNavigationTestEnabled) {
    const target = window.APP_LOCATION?.geofenceLocations?.[0];
    if (!target) {
      window.showToast("Target asrama belum tersedia di konfigurasi lokasi.", "warning");
      window.closeQiblaPage();
      return;
    }
    // Offset kecil ke barat daya agar simulasi terlihat jauh dari radius.
    openWithPosition(target.lat - 0.0018, target.lng - 0.0018);
    return;
  }

  // Cek apakah GPS sudah pernah ditolak di session ini
  const gpsPermissionKey = "gps_permission_denied_" + window.APP_CONFIG?.appName?.replace(/\s+/g, "_").toLowerCase() || "syamsa_app";
  const gpsDenied = sessionStorage.getItem(gpsPermissionKey);

  if (!navigator.geolocation) {
    window.showToast("Browser Anda tidak mendukung GPS.", "error");
    return;
  }

  // Hentikan watch sebelumnya jika ada
  if (window.asramaGpsWatchId !== null) {
    navigator.geolocation.clearWatch(window.asramaGpsWatchId);
  }

  // Jika GPS sudah pernah ditolak, gunakan mode tanpa GPS dengan fallback
  if (gpsDenied) {
    const fallbackTarget = window.APP_LOCATION?.geofenceLocations?.[0];
    if (fallbackTarget) {
      // Gunakan fallback tanpa GPS tracking
      openWithPosition(fallbackTarget.lat, fallbackTarget.lng);
      window.showToast("GPS dinonaktifkan. Menggunakan mode tanpa GPS.", "info");
    } else {
      window.showToast("Tidak ada data asrama dan GPS tidak tersedia.", "warning");
      window.closeQiblaPage();
    }
    return;
  }

  // Gunakan watchPosition untuk update GPS real-time
  window.asramaGpsWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // Update posisi awal
      if (window.asramaCurrentTarget === null) {
        openWithPosition(lat, lng);
      } else {
        // Update jarak dan arah secara real-time
        updateAsramaPosition(lat, lng);
      }
    },
    (error) => {
      console.error("GPS error for Asrama:", error);
      // Tandai bahwa GPS ditolak, skip untuk session ini
      sessionStorage.setItem(gpsPermissionKey, "true");
      const fallbackTarget = window.APP_LOCATION?.geofenceLocations?.[0];
      if (fallbackTarget) {
        openWithPosition(fallbackTarget.lat, fallbackTarget.lng);
        window.showToast("GPS ditolak. Menggunakan mode tanpa GPS.", "info");
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
};

window.formatAsramaDistance = function (meters) {
  if (!Number.isFinite(meters)) return "--";
  if (meters >= 1000) return `${(meters / 1000).toFixed(2).replace(".", ",")} km`;
  return `${Math.round(meters)} m`;
};

window.closeQiblaPage = function () {
  const viewMain = document.getElementById("view-main");
  const viewQibla = document.getElementById("view-qibla");
  if (viewMain) viewMain.classList.remove("hidden");
  if (viewQibla) {
    viewQibla.classList.add("hidden");
    viewQibla.classList.remove("flex");
  }
  window.restoreQiblaBrowserChrome();
  window.stopCompassListener();

  // Reset tombol presensi
  const presensiBtn = document.getElementById("qibla-presensi-btn");
  if (presensiBtn) {
    presensiBtn.classList.add("hidden");
    presensiBtn.classList.remove("flex", "animate-bounce");
  }

  // Hentikan GPS watch untuk mode asrama
  if (window.asramaGpsWatchId !== null) {
    navigator.geolocation.clearWatch(window.asramaGpsWatchId);
    window.asramaGpsWatchId = null;
  }
  window.asramaCurrentTarget = null;
  window.asramaPresensiShown = false;
  window.compassTargetRadius = null;
};

window.setQiblaBrowserChrome = function (tone = "dark") {
  const color = tone === "green" ? "#25d654" : "#070707";
  const root = document.documentElement;
  const body = document.body;
  root.classList.add("qibla-browser-active");
  body?.classList.add("qibla-browser-active");
  root.classList.toggle("qibla-browser-green", tone === "green");
  body?.classList.toggle("qibla-browser-green", tone === "green");

  const themeMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  if (!window.qiblaOriginalThemeColors) {
    window.qiblaOriginalThemeColors = themeMetas.map((meta) => meta.getAttribute("content"));
  }
  themeMetas.forEach((meta) => meta.setAttribute("content", color));
};

window.restoreQiblaBrowserChrome = function () {
  document.documentElement.classList.remove("qibla-browser-active", "qibla-browser-green");
  document.body?.classList.remove("qibla-browser-active", "qibla-browser-green");

  const themeMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  if (window.qiblaOriginalThemeColors) {
    themeMetas.forEach((meta, index) => {
      if (window.qiblaOriginalThemeColors[index]) meta.setAttribute("content", window.qiblaOriginalThemeColors[index]);
    });
  }
  window.qiblaOriginalThemeColors = null;
};

window.preparePrecisionQiblaUI = function () {
  const viewQibla = document.getElementById("view-qibla");
  const qiblaNeedle = document.getElementById("qibla-needle");
  const wrapper = document.querySelector("#view-qibla > div");
  if (!viewQibla || !wrapper) return;

  const headerLabel = viewQibla.querySelector("header p");
  const headerTitle = viewQibla.querySelector("header h3");
  const angleLabel = document.getElementById("qibla-angle-label");
  const distanceLabel = document.getElementById("qibla-distance-label");
  const isAsrama = window.compassTargetMode === "asrama";
  if (headerLabel) headerLabel.textContent = isAsrama ? "Navigasi GPS" : "Syamsa";
  if (headerTitle) headerTitle.textContent = isAsrama ? "Ke Asrama" : "Cari Kiblat";
  if (angleLabel) angleLabel.textContent = isAsrama ? "Sudut Tujuan" : "Sudut Kiblat";
  if (distanceLabel) distanceLabel.textContent = isAsrama ? "Jarak Asrama" : "Jarak Ke Makkah";

  if (qiblaNeedle && !qiblaNeedle.dataset.precisionReady) {
    qiblaNeedle.innerHTML = `
      <img src="assets/illustrations/arrow-up.webp" alt="" aria-hidden="true" class="qibla-arrow-img">
    `;
    qiblaNeedle.dataset.precisionReady = "true";
  }

  if (!document.getElementById("qibla-bottom-actions")) {
    const actions = document.createElement("div");
    actions.id = "qibla-bottom-actions";
    actions.className = "qibla-bottom-actions";
    actions.innerHTML = `
      <button type="button" onclick="window.closeQiblaPage()" aria-label="Tutup"><i data-lucide="x"></i></button>
      <button id="qibla-sound-btn" type="button" onclick="window.toggleQiblaSound()" aria-label="Aktifkan suara" aria-pressed="false"><i data-lucide="volume-x"></i></button>
    `;
    wrapper.appendChild(actions);
    if (window.lucide) window.lucide.createIcons();
  }
};

window.setQiblaPrecisionState = function (state, diff = null, directionText = "") {
  const viewQibla = document.getElementById("view-qibla");
  const loading = document.getElementById("qibla-loading");
  const content = document.getElementById("qibla-content-wrapper");
  const title = viewQibla?.querySelector("header h3");
  const subtitle = viewQibla?.querySelector("header p");
  const angleTxt = document.getElementById("qibla-angle-txt");
  const indicator = document.getElementById("qibla-alignment-indicator");
  const arrow = document.getElementById("qibla-needle");
  if (!viewQibla) return;

  if (viewQibla.dataset.qiblaState !== state) {
    viewQibla.classList.remove("qibla-state-enter");
    void viewQibla.offsetWidth;
    viewQibla.classList.add("qibla-state-enter");
  }
  viewQibla.dataset.qiblaState = state;
  window.setQiblaBrowserChrome(["closer", "almost", "perfect", "locked"].includes(state) ? "green" : "dark");
  const isAsrama = window.compassTargetMode === "asrama";
  const asramaRadius = window.compassTargetRadius || window.APP_LOCATION?.maxRadiusMeters || 50;
  const asramaOutsideRadius = isAsrama && Number.isFinite(window.qiblaDistance) && window.qiblaDistance > asramaRadius;
  const asramaRemaining = asramaOutsideRadius ? window.formatAsramaDistance(window.qiblaDistance - asramaRadius) : "";
  if (asramaOutsideRadius && (state === "perfect" || state === "locked")) {
    state = "almost";
    directionText = `Arah sudah tepat, lanjut ${asramaRemaining} lagi sampai radius.`;
  }
  if (subtitle) subtitle.textContent = isAsrama ? (window.compassTargetName || "Asrama") : "Syamsa";
  if (loading) loading.classList.toggle("hidden", state !== "searching");
  if (content) content.classList.toggle("hidden", state === "searching");

  const roundedDiff = diff === null ? null : Math.round(diff);
  if (state === "searching") {
    if (title) title.textContent = isAsrama ? "Mencari Asrama" : "Cari Kiblat";
    if (indicator) indicator.textContent = isAsrama ? "Menentukan arah ke asrama..." : "Menentukan arah kiblat...";
    if (arrow) {
      arrow.classList.remove("qibla-arrow-small");
      arrow.style.visibility = "visible";
    }
    return;
  }
  if (state === "calibrating") {
    if (title) title.textContent = "Aktifkan Kompas";
    if (angleTxt) angleTxt.textContent = "";
    if (indicator) indicator.textContent = isAsrama
      ? "Izinkan akses sensor gerak agar arah asrama bisa dibaca secara presisi."
      : "Izinkan akses sensor gerak agar arah kiblat bisa dibaca secara presisi.";
    if (arrow) arrow.style.opacity = "0";
    if (arrow) {
      arrow.classList.remove("qibla-arrow-small");
      arrow.style.visibility = "hidden";
    }
    // Panggil startCompassListener untuk Android (iOS perlu klik tombol izin)
    if (window.orientationListenerActive === false) {
      window.startCompassListener();
    }
    return;
  }
  if (arrow) arrow.style.opacity = "";
  if (arrow) arrow.style.visibility = "visible";
  if (arrow) arrow.classList.toggle("qibla-arrow-small", state === "almost");
  if (state === "perfect") {
    if (title) title.textContent = isAsrama ? "Arah Asrama Tepat" : "Kiblat Ditemukan";
    if (angleTxt) angleTxt.textContent = "";
    if (indicator) indicator.textContent = isAsrama ? "Ikuti arah ini" : "Siap Shalat";
    if (arrow) {
      arrow.classList.remove("qibla-arrow-small");
      arrow.style.opacity = "0";
      arrow.style.visibility = "hidden";
    }
    return;
  }
  if (state === "locked") {
    if (title) title.textContent = isAsrama ? "Arah Asrama Terkunci" : "Arah Kiblat Terkunci";
    if (angleTxt) angleTxt.textContent = Math.round(window.qiblaAngle || 0) + "\u00b0";
    if (indicator) indicator.textContent = isAsrama ? "Arah tujuan stabil" : "Siap digunakan saat shalat";
    if (arrow) {
      arrow.classList.remove("qibla-arrow-small");
      arrow.style.opacity = "0";
      arrow.style.visibility = "hidden";
    }
    return;
  }

  if (title) title.textContent = state === "almost" ? "Hampir Tepat" : (isAsrama ? "Ke Asrama" : "Cari Kiblat");
  if (isAsrama && state === "almost" && asramaOutsideRadius && title) title.textContent = "Dekati Asrama";
  if (arrow) arrow.style.visibility = "visible";
  if (angleTxt && roundedDiff !== null) angleTxt.textContent = `${roundedDiff}\u00b0`;
  if (indicator) indicator.textContent = directionText;
};

window.openQiblaModal = window.openQiblaPage;
window.closeQiblaModal = window.closeQiblaPage;

// Initialize Compass Sensor
window.initCompass = function () {
  document.getElementById("qibla-sensor-permission-btn")?.classList.remove("hidden");
};

// Handle iOS permission request click
window.requestQiblaSensorPermission = async function () {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        window.showToast("Izin sensor ditolak. Kompas tidak dapat aktif.", "warning");
        return;
      }
    }
    document.getElementById("qibla-sensor-permission-btn")?.classList.add("hidden");
    window.setQiblaPrecisionState("far", 45, "mencari arah");
    window.startCompassListener();
  } catch (error) {
    console.error("Error requesting compass permission:", error);
    window.showToast("Kompas belum bisa diaktifkan di perangkat ini.", "warning");
  }
};

window.toggleQiblaSound = function () {
  window.qiblaSoundEnabled = !window.qiblaSoundEnabled;
  const soundBtn = document.getElementById("qibla-sound-btn");
  if (soundBtn) {
    soundBtn.classList.toggle("is-active", window.qiblaSoundEnabled);
    soundBtn.setAttribute("aria-pressed", String(window.qiblaSoundEnabled));
    soundBtn.setAttribute("aria-label", window.qiblaSoundEnabled ? "Matikan suara" : "Aktifkan suara");
    soundBtn.innerHTML = `<i data-lucide="${window.qiblaSoundEnabled ? "volume-2" : "volume-x"}"></i>`;
    if (window.lucide) window.lucide.createIcons();
  }
  window.playQiblaTone(window.qiblaSoundEnabled ? 660 : 330, 70);
};

window.playQiblaTone = function (frequency = 520, duration = 60) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = window.qiblaAudioContext || new AudioContext();
    window.qiblaAudioContext = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration / 1000);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration / 1000 + 0.02);
  } catch (error) {
    console.warn("Qibla sound unavailable:", error);
  }
};

window.playQiblaGuidanceSound = function (state, diff) {
  if (!window.qiblaSoundEnabled) return;
  const now = Date.now();
  const gap = state === "almost" || state === "perfect" ? 350 : 850;
  if (now - window.lastQiblaSoundTime < gap) return;
  window.lastQiblaSoundTime = now;
  const frequency = state === "perfect" ? 880 : Math.max(360, 760 - diff * 7);
  window.playQiblaTone(frequency, state === "perfect" ? 120 : 55);
};

// Start device orientation listener
window.startCompassListener = function () {
  if (window.orientationListenerActive) return;

  const onOrientation = (event) => {
    let heading = null;

    if (event.webkitCompassHeading !== undefined) {
      heading = event.webkitCompassHeading; // iOS absolute heading
    } else if (event.alpha !== null) {
      // Android alpha: z-axis rotation. Usually absolute if absolute event is used.
      heading = (360 - event.alpha) % 360;
    }

    if (heading !== null) {
      window.deviceHeading = heading;
      window.updateCompassUI(heading);
    }
  };

  // Use absolute orientation event on Android/Chrome to avoid compass drift
  if ("ondeviceorientationabsolute" in window) {
    window.addEventListener("deviceorientationabsolute", onOrientation);
    window.activeOrientationEvent = "deviceorientationabsolute";
  } else {
    window.addEventListener("deviceorientation", onOrientation);
    window.activeOrientationEvent = "deviceorientation";
  }
  window.activeOrientationCallback = onOrientation;
  window.orientationListenerActive = true;
};

// Stop listening
window.stopCompassListener = function () {
  if (window.orientationListenerActive && window.activeOrientationCallback) {
    window.removeEventListener(window.activeOrientationEvent, window.activeOrientationCallback);
    window.orientationListenerActive = false;
  }
};

// Update Compass rotation & alignment styles in real-time
let lastVibrateTime = 0;
window.updateCompassUI = function (heading) {
  const compassDial = document.getElementById("qibla-compass-dial");
  const qiblaArrow = document.getElementById("qibla-needle");
  const headingTxt = document.getElementById("qibla-current-heading-txt");
  const alignmentIndicator = document.getElementById("qibla-alignment-indicator");

  if (!qiblaArrow || window.qiblaAngle === null) return;

  // Round heading
  const roundedHeading = Math.round(heading);
  if (headingTxt) headingTxt.textContent = roundedHeading + "\u00b0 " + window.getCompassDirectionName(roundedHeading);

  // Compass Dial rotates inverse of heading so North stays North
  if (compassDial) compassDial.style.transform = `rotate(${-heading}deg)`;

  // Compass needle rotates relative to device: qiblaAngle - heading
  const signedDiff = ((window.qiblaAngle - heading + 540) % 360) - 180;
  const diff = Math.abs(signedDiff);
  const directionText = signedDiff > 0 ? "ke kanan" : "ke kiri";
  const isAsrama = window.compassTargetMode === "asrama";
  const asramaRadius = window.compassTargetRadius || window.APP_LOCATION?.maxRadiusMeters || 50;
  const asramaOutsideRadius = isAsrama && Number.isFinite(window.qiblaDistance) && window.qiblaDistance > asramaRadius;
  const asramaRemainingText = asramaOutsideRadius
    ? `Arah benar, lanjut ${window.formatAsramaDistance(window.qiblaDistance - asramaRadius)} lagi sampai radius.`
    : directionText;
  const arrowScale = diff > 1 && diff <= 4 && !window.qiblaLocked ? 0.64 : 1;
  qiblaArrow.style.transform = `translate(-50%, -50%) rotate(${signedDiff}deg) scale(${arrowScale})`;

  if (window.qiblaLocked && diff > 2) {
    window.qiblaLocked = false;
  }

  if (window.qiblaLocked && diff <= 2) {
    if (asramaOutsideRadius) {
      window.qiblaLocked = false;
      window.setQiblaPrecisionState("almost", diff, asramaRemainingText);
      return;
    }
    qiblaArrow.classList.add("qibla-active");
    if (alignmentIndicator) alignmentIndicator.classList.add("qibla-aligned");
    window.setQiblaPrecisionState("locked", diff, directionText);
    window.playQiblaGuidanceSound("perfect", diff);
    return;
  }

  // If phone is pointing to Qibla (within ±4 degrees)
  if (diff <= 4) {
    qiblaArrow.classList.add("qibla-active");
    if (alignmentIndicator) alignmentIndicator.classList.toggle("qibla-aligned", !asramaOutsideRadius);
    window.setQiblaPrecisionState(asramaOutsideRadius ? "almost" : (diff <= 1 ? "perfect" : "almost"), diff, asramaOutsideRadius ? asramaRemainingText : directionText);
    window.playQiblaGuidanceSound(diff <= 1 ? "perfect" : "almost", diff);
    if (diff <= 1 && !asramaOutsideRadius && !window.qiblaLockTimer) {
      window.qiblaLockTimer = setTimeout(() => {
        window.qiblaLockTimer = null;
        if (document.getElementById("view-qibla")?.dataset.qiblaState === "perfect" && window.deviceHeading !== null) {
          window.qiblaLocked = true;
          window.setQiblaPrecisionState("locked", diff, directionText);
        }
      }, 900);
    }
    if (diff > 1 && window.qiblaLockTimer) {
      clearTimeout(window.qiblaLockTimer);
      window.qiblaLockTimer = null;
    }

    // Trigger haptic vibrate feedback on Android (max once every 1 second to not annoy user)
    if (navigator.vibrate && Date.now() - lastVibrateTime > 1000) {
      navigator.vibrate(80);
      lastVibrateTime = Date.now();
    }
  } else {
    window.qiblaLocked = false;
    if (window.qiblaLockTimer) {
      clearTimeout(window.qiblaLockTimer);
      window.qiblaLockTimer = null;
    }
    qiblaArrow.classList.remove("qibla-active");
    if (alignmentIndicator) alignmentIndicator.classList.remove("qibla-aligned");
    window.setQiblaPrecisionState(diff <= 15 ? "closer" : "far", diff, directionText);
    window.playQiblaGuidanceSound(diff <= 15 ? "closer" : "far", diff);
  }
};

// Convert degrees to cardinal direction name
window.getCompassDirectionName = function (deg) {
  const directions = ["U", "TL", "T", "TG", "S", "BD", "B", "BL"];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return directions[index];
};
