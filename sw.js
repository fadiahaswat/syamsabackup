const CACHE_NAME = "musyrif-app-v226-fcm-ready";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./output.css",
  "./config/config.js",
  "./core/app-core.js",
  "./core/script.js",
  "./features/qibla.js",
  "./firebase-config.js",
  "./firebase-messaging-sw.js",
  "./assets/icons/icon.svg",
  "./assets/icons/icon.webp",
  "./assets/icons/icon.png",
  "./assets/icons/app-icon.png",
  "./assets/branding/Logomark.webp",
  "./assets/branding/Primary%20Logo.webp",
  "./assets/branding/Logo%20Mu%27allimin.webp",
  "./assets/branding/Logo%20PP%20Muhammadiyah.webp",
  "./assets/branding/Logo%20Sekolah%20Pemimpin%20Bangsa.webp",
  "./assets/branding/Internastional%20Partners.webp",
  "./assets/screenshots/desktop-wide.png",
  "./assets/screenshots/mobile-narrow.png",
  "./assets/illustrations/arrow-up.webp",
  "./assets/illustrations/kaaba.webp",
  "./managers/santri-manager.js",
  "./managers/fcm-manager.js",
  "./data/data-santri.js",
  "./data/data-kelas.js",
  "./data/tahfizh_metadata.json",
  "./manifest.json",
];

// 1. Install Service Worker & Cache File
self.addEventListener("install", (event) => {
  self.skipWaiting(); // FORCE ACTIVATE IMMEDIATELY
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
});

// 2. Activate & Hapus Cache Lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        }),
      );
    }).then(() => {
      return self.clients.claim(); // TAKE CONTROL IMMEDIATELY
    })
  );
});

// 3. Fetch Strategy: Cache First, then Network
self.addEventListener("fetch", (event) => {
  // Abaikan request selain HTTP/HTTPS (seperti ws:// atau chrome-extension://)
  if (!event.request.url.startsWith("http")) return;
  // Hanya tangani GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === location.origin;

  if (isLocal) {
    // Untuk file lokal, gunakan Cache First (sesuai kode lama)
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) return response;
        return fetch(event.request).catch(() => {
          // Jika fetch gagal (file tidak ada), coba cari fallback atau return error
          return caches.match("./index.html").then(fallback => {
            return fallback || new Response("File not found", { status: 404, statusText: "Not Found" });
          });
        });
      })
    );
  } else {
    // Gunakan strategi Network First untuk file eksternal agar tidak error CORS
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // Kembalikan response kosong agar tidak memunculkan TypeError (Failed to convert value to 'Response')
          return new Response("", { status: 503, statusText: "Service Unavailable" });
        });
      })
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(targetUrl);
          return client;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = { body: event.data?.text() || "" };
  }

  const title = payload.title || "Syamsa";
  const options = {
    body: payload.body || "Ada pembaruan baru.",
    icon: payload.icon || "./assets/icons/icon.webp",
    badge: payload.badge || "./assets/icons/icon.png",
    tag: payload.tag || "syamsa-push",
    data: payload.data || { url: "./" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
