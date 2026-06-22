const CACHE_VERSION = "v228-sync-fix";
const CACHE_NAME = `musyrif-app-${CACHE_VERSION}`;

// Assets to cache (static assets only)
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./output.css",
  "./assets/icons/icon.svg",
  "./assets/icons/icon.webp",
  "./assets/icons/icon.png",
  "./assets/icons/app-icon.png",
  "./assets/branding/Logomark.webp",
  "./assets/branding/Primary%20Logo.webp",
  "./assets/branding/Logo%20Mu%27allimin.webp",
  "./assets/branding/Logo%20PP%20Muhammadiyah.webp",
  "./assets/branding/Logo%20Sekolah%20Pemimpin%20Bangsa.webp",
  "./assets/branding/Logo%20Sekolah%20Pemimpin%20Bangsa.webp",
  "./assets/branding/Internastional%20Partners.webp",
  "./assets/screenshots/desktop-wide.png",
  "./assets/screenshots/mobile-narrow.png",
  "./assets/illustrations/arrow-up.webp",
  "./assets/illustrations/kaaba.webp",
  "./manifest.json",
];

// JS files that should ALWAYS be fetched from network (for sync)
const ALWAYS_FRESH_JS = [
  "config/config.js",
  "core/app-core.js",
  "core/script.js",
  "managers/firebase-storage-manager.js",
  "managers/auth-manager.js",
  "managers/santri-manager.js",
  "managers/attendance-manager.js",
  "managers/offline-queue-manager.js",
  "managers/notification-manager.js",
  "managers/fcm-manager.js",
  "data/data-santri.js",
  "data/data-kelas.js",
  "data/tahfizh_metadata.json",
  "firebase-config.js",
  "firebase-messaging-sw.js",
  "features/qibla.js",
];

// Check if URL is a JS file that should always be fresh
function isAlwaysFreshJS(url) {
  const pathname = url.pathname.replace(/^\//, '');
  return ALWAYS_FRESH_JS.some(file => pathname.endsWith(file));
}

// Check if URL is a static asset
function isStaticAsset(url) {
  const pathname = url.pathname.replace(/^\//, '');
  return STATIC_ASSETS.some(asset => {
    if (asset.startsWith('./')) {
      return pathname === asset.slice(2) || pathname.endsWith(asset.slice(2));
    }
    return pathname.endsWith(asset);
  });
}

// 1. Install Service Worker & Cache Static Assets
self.addEventListener("install", (event) => {
  self.skipWaiting(); // FORCE ACTIVATE IMMEDIATELY
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache static assets only, not JS files (they should always be fresh)
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('[SW] Some static assets failed to cache:', err);
      });
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

// Message Handler - Handle update commands from main app
self.addEventListener("message", (event) => {
  if (!event.data || !event.data.type) return;

  console.log('[SW] Message received:', event.data.type);

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting, activating new version...');
    self.skipWaiting();
  }

  if (event.data.type === 'SKIP_CACHE') {
    // Clear all caches to force fresh load
    console.log('[SW] Clearing all caches...');
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => caches.delete(key)));
    }).then(() => {
      console.log('[SW] All caches cleared');
    });
  }
});

// 3. Fetch Strategy: Smart Caching
self.addEventListener("fetch", (event) => {
  // Abaikan request selain HTTP/HTTPS (seperti ws:// atau chrome-extension://)
  if (!event.request.url.startsWith("http")) return;
  // Hanya tangani GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === location.origin;

  if (isLocal) {
    // ========== LOCAL FILES ==========

    // JS files → ALWAYS fetch from network (Critical for sync!)
    if (isAlwaysFreshJS(url) || url.pathname.endsWith('.js')) {
      event.respondWith(
        fetch(event.request).then(response => {
          // Cache successful responses for offline fallback
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        }).catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request).then(response => {
            return response || new Response("Network error - please check connection", {
              status: 503,
              statusText: "Service Unavailable"
            });
          });
        })
      );
      return;
    }

    // Static assets → Cache First for performance
    if (isStaticAsset(url) || url.pathname.match(/\.(css|png|jpg|jpeg|webp|svg|ico|woff2?)$/)) {
      event.respondWith(
        caches.match(event.request).then((response) => {
          if (response) return response;
          return fetch(event.request).then(fetchResponse => {
            if (fetchResponse.ok) {
              const clone = fetchResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return fetchResponse;
          }).catch(() => {
            return caches.match("./index.html").then(fallback => {
              return fallback || new Response("File not found", { status: 404, statusText: "Not Found" });
            });
          });
        })
      );
      return;
    }

    // Default: Network First
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((response) => {
          return response || caches.match("./index.html");
        });
      })
    );

  } else {
    // ========== EXTERNAL FILES (CDN, Firebase, Google Fonts) ==========
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
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
