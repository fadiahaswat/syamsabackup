/**
 * dashboard-geolocation.js - Geolocation & Location Features
 *
 * Extracted from dashboard-manager.js for better organization.
 * Contains geofencing and location verification logic.
 */

// ============================================================================
// GEOLOCATION UTILITIES
// ============================================================================

/**
 * Calculate distance between two coordinates in meters
 * Uses Haversine formula
 */
window.getDistanceFromLatLonInMeters = function (lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = window.deg2rad(lat2 - lat1);
  const dLon = window.deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(window.deg2rad(lat1)) *
      Math.cos(window.deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert degrees to radians
 */
window.deg2rad = function (deg) {
  return deg * (Math.PI / 180);
};

/**
 * Get cached location from storage
 */
window.getCachedLocation = function () {
  try {
    const cached = localStorage.getItem("user_location");
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is still valid (15 minutes)
      if (data.timestamp && Date.now() - data.timestamp < 15 * 60 * 1000) {
        return { lat: data.lat, lng: data.lng };
      }
    }
  } catch (e) {
    console.warn("[Location] Failed to get cached location:", e);
  }
  return null;
};

/**
 * Verify user's location against geofence
 */
window.verifyLocation = function (options = {}) {
  const {
    onSuccess,
    onError,
    onNotInRange,
    showLoading = true,
    forceRefresh = false,
  } = options;

  const container = document.getElementById("location-status-card");
  const loadingEl = document.getElementById("location-loading");
  const statusEl = document.getElementById("location-status");

  // Check if geofencing is enabled
  if (!GEO_CONFIG.useGeofencing) {
    if (statusEl) {
      statusEl.innerHTML = `<span class="text-emerald-600"><i data-lucide="check-circle" class="w-4 h-4"></i> Lokasi tidak required</span>`;
    }
    if (window.lucide) window.lucide.createIcons();
    if (onSuccess) onSuccess(null);
    return Promise.resolve(null);
  }

  // Show loading state
  if (showLoading) {
    if (loadingEl) loadingEl.classList.remove("hidden");
  }

  return new Promise((resolve, reject) => {
    // Check for cached location first
    if (!forceRefresh) {
      const cached = window.getCachedLocation();
      if (cached) {
        const distance = window.getDistanceFromLatLonInMeters(
          cached.lat,
          cached.lng,
          GEO_CONFIG.latitude,
          GEO_CONFIG.longitude,
        );

        if (distance <= GEO_CONFIG.radius) {
          if (showLoading && loadingEl) loadingEl.classList.add("hidden");
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-emerald-600"><i data-lucide="map-pin" class="w-4 h-4"></i> Di lokasi (${Math.round(distance)}m)</span>`;
          }
          if (window.lucide) window.lucide.createIcons();
          if (container) {
            container.classList.remove("border-red-200", "bg-red-50");
            container.classList.add("border-emerald-200", "bg-emerald-50");
          }
          if (onSuccess) onSuccess(cached);
          resolve(cached);
          return;
        } else {
          if (showLoading && loadingEl) loadingEl.classList.add("hidden");
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-red-600"><i data-lucide="map-pin-off" class="w-4 h-4"></i> ${Math.round(distance)}m dari lokasi</span>`;
          }
          if (window.lucide) window.lucide.createIcons();
          if (container) {
            container.classList.remove("border-emerald-200", "bg-emerald-50");
            container.classList.add("border-red-200", "bg-red-50");
          }
          if (onNotInRange) onNotInRange(distance);
          resolve(null);
          return;
        }
      }
    }

    // Get fresh location
    if (!navigator.geolocation) {
      if (showLoading && loadingEl) loadingEl.classList.add("hidden");
      if (statusEl) {
        statusEl.innerHTML = `<span class="text-amber-600"><i data-lucide="alert-triangle" class="w-4 h-4"></i> Geolocation tidak didukung</span>`;
      }
      if (window.lucide) window.lucide.createIcons();
      if (onError) onError(new Error("Geolocation not supported"));
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;

        // Cache the location
        try {
          localStorage.setItem(
            "user_location",
            JSON.stringify({ lat, lng, timestamp: Date.now() }),
          );
        } catch (e) {
          console.warn("[Location] Failed to cache location:", e);
        }

        const distance = window.getDistanceFromLatLonInMeters(
          lat,
          lng,
          GEO_CONFIG.latitude,
          GEO_CONFIG.longitude,
        );

        if (showLoading && loadingEl) loadingEl.classList.add("hidden");

        if (distance <= GEO_CONFIG.radius) {
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-emerald-600"><i data-lucide="map-pin" class="w-4 h-4"></i> Di lokasi (${Math.round(distance)}m)</span>`;
          }
          if (window.lucide) window.lucide.createIcons();
          if (container) {
            container.classList.remove("border-red-200", "bg-red-50");
            container.classList.add("border-emerald-200", "bg-emerald-50");
          }
          if (onSuccess) onSuccess({ lat, lng });
          resolve({ lat, lng });
        } else {
          if (statusEl) {
            statusEl.innerHTML = `<span class="text-red-600"><i data-lucide="map-pin-off" class="w-4 h-4"></i> ${Math.round(distance)}m dari lokasi</span>`;
          }
          if (window.lucide) window.lucide.createIcons();
          if (container) {
            container.classList.remove("border-emerald-200", "bg-emerald-50");
            container.classList.add("border-red-200", "bg-red-50");
          }
          if (onNotInRange) onNotInRange(distance);
          resolve(null);
        }
      },
      (error) => {
        if (showLoading && loadingEl) loadingEl.classList.add("hidden");

        let errorMsg = "Tidak dapat mendapatkan lokasi";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Izin lokasi ditolak";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Lokasi tidak tersedia";
            break;
          case error.TIMEOUT:
            errorMsg = "Waktu habis untuk lokasi";
            break;
        }

        if (statusEl) {
          statusEl.innerHTML = `<span class="text-amber-600"><i data-lucide="alert-triangle" class="w-4 h-4"></i> ${errorMsg}</span>`;
        }
        if (window.lucide) window.lucide.createIcons();

        if (onError) onError(error);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  });
};

/**
 * Verify location with cached data (async)
 */
window.verifyLocationCached = async function () {
  return window.verifyLocation({ showLoading: false });
};
