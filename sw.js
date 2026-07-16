/**
 * Service Worker for Syriansa PWA
 * Handles offline caching and Web Push Notifications.
 *
 * @version 2.4.8
 */

const CACHE_VERSION = "v291";
const CACHE_NAME = `musyrif-app-${CACHE_VERSION}`;

// Static assets to cache for offline functionality
const STATIC_ASSETS = [
  // Core entry point
  "./",
  "./index.html",
  "./output.css",
  "./style.css",
  "./manifest.json",

  // PWA Icons
  "./assets/icons/icon.svg",
  "./assets/icons/icon.webp",
  "./assets/icons/icon.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/app-icon.png",

  // Branding assets
  "./assets/branding/Logomark.webp",
  "./assets/branding/Primary%20Logo.webp",
  "./assets/branding/Logo%20Mu%27allimin.webp",
  "./assets/branding/Logo%20PP%20Muhammadiyah.webp",
  "./assets/branding/Logo%20Sekolah%20Pemimpin%20Bangsa.webp",
  "./assets/branding/Internastional%20Partners.webp",

  // Screenshots
  "./assets/screenshots/desktop-wide.png",
  "./assets/screenshots/mobile-narrow.png",

  // Illustrations
  "./assets/illustrations/kaaba.webp",

  // Core JS - precached for offline functionality
  "src/config/config.js",
  "src/config/config.local.js",
  "src/platform/supabase-client.js",
  "src/platform/cloud-domain-store.js",
  "src/core/app-init.js",
  "src/core/app-core.js",
  "src/core/script.js",
  "src/core/constants.js",
  "src/core/templates.js",
  "src/core/countdown.js",
  "src/core/pull-to-refresh.js",

  // App JS
  "src/js/app.js",
  "src/js/router.js",
  "src/js/loader.js",

  // Managers
  "src/managers/storage-manager.js",
  "src/managers/storage-manager-v2.js",
  "src/managers/state-manager.js",
  "src/managers/auth-manager.js",
  "src/managers/santri-manager.js",
  "src/managers/attendance-manager.js",
  "src/managers/permit-manager.js",
  "src/managers/permit-request-manager.js",
  "src/managers/tab-manager.js",
  "src/managers/export-manager.js",
  "src/managers/activity-logger.js",
  "src/managers/dashboard-manager.js",
  "src/managers/dashboard-widgets.js",
  "src/managers/dashboard-geolocation.js",
  "src/managers/analysis-manager.js",
  "src/managers/date-manager.js",
  "src/managers/sync-queue.js",
  "src/managers/sync-debug.js",
  "src/managers/database-schema.js",
  "src/managers/repository.js",
  "src/managers/supabase-sync.js",
  "src/managers/data-migrator.js",
  "src/managers/debug-panel.js",
  "src/managers/notification-manager.js",
  "src/managers/admin-manager.js",
  "src/managers/file-upload.js",

  // Data
  "src/data/data-santri.js",
  "src/data/data-kelas.js",
  "src/data/tahfizh_metadata.json",

  // Shared utilities
  "src/shared/utils.js",

  // Platform
  "src/platform/storage-service.js",

  // Tahfizh module
  "src/modules/tahfizh/tahfizh-module.js",
  "src/modules/tahfizh/tahfizh-integration.js",
  "src/modules/tahfizh/tahfizh-app-adapter.js",
  "src/modules/tahfizh/tahfizh-manager.js",
];

// JS files that should always be fetched fresh (dynamic features)
const ALWAYS_FRESH_JS = [
  "src/config/config.js",
  "src/modules/tahfizh/tahfizh-manager.js",
  "src/features/qibla.js",
];

// Check if URL should always be fetched fresh
function isAlwaysFreshJS(url) {
  const pathname = url.pathname.replace(/^\//, '');
  return ALWAYS_FRESH_JS.some(file => pathname.endsWith(file));
}

// Check if URL is a known static asset
function isStaticAsset(url) {
  const pathname = url.pathname.replace(/^\//, '');
  return STATIC_ASSETS.some(asset => {
    if (asset.startsWith('./')) {
      return pathname === asset.slice(2) || pathname.endsWith(asset.slice(2));
    }
    return pathname.endsWith(asset);
  });
}

// Check if URL is an image/font file
function isCacheableMedia(url) {
  return url.pathname.match(/\.(css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|eot)$/);
}

// 1. Install Service Worker & Cache Static Assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets for version', CACHE_VERSION);
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Some static assets failed to cache:', err);
        // Continue even if some assets fail
      });
    }).then(() => {
      // Skip waiting to activate immediately
      return self.skipWaiting();
    })
  );
});

// 2. Activate & Clean Old Caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('musyrif-app-')) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        }),
      );
    }).then(() => {
      console.log('[SW] Claiming clients for version', CACHE_VERSION);
      return self.clients.claim();
    })
  );
});

// Message Handler - Handle commands from main app
self.addEventListener("message", (event) => {
  if (!event.data || !event.data.type) return;

  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      console.log('[SW] Skipping waiting, activating new version...');
      self.skipWaiting();
      break;

    case 'SKIP_CACHE':
      console.log('[SW] Clearing all caches...');
      caches.keys().then(keys => {
        return Promise.all(keys.map(key => caches.delete(key)));
      }).then(() => {
        console.log('[SW] All caches cleared');
        // Notify clients
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        });
      });
      break;

    case 'GET_VERSION':
      event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION });
      break;

    case 'CACHE_URLS':
      // Dynamically cache additional URLs from app
      if (payload && payload.urls) {
        caches.open(CACHE_NAME).then(cache => {
          return cache.addAll(payload.urls).catch(err => {
            console.warn('[SW] Failed to cache URLs:', err);
          });
        });
      }
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// 3. Fetch Strategy
self.addEventListener("fetch", (event) => {
  // Ignore non-HTTP requests (chrome-extension, ws, etc.)
  if (!event.request.url.startsWith("http")) return;

  // Only handle GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === location.origin;

  if (isLocal) {
    handleLocalFetch(event, url);
  } else {
    handleExternalFetch(event, url);
  }
});

/**
 * Handle fetch for local files
 */
function handleLocalFetch(event, url) {
  // Dynamic JS features → Network first, fallback to cache
  if (isAlwaysFreshJS(url)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then(response => {
          return response || new Response(
            "Failed to load. Please check your connection.",
            { status: 503, statusText: "Service Unavailable" }
          );
        });
      })
    );
    return;
  }

  // Regular JS files → Stale-While-Revalidate
  if (url.pathname.endsWith('.js')) {
    event.respondWith(
      staleWhileRevalidate(event.request)
    );
    return;
  }

  // Static assets & media → Cache First
  if (isStaticAsset(url) || isCacheableMedia(url)) {
    event.respondWith(
      cacheFirst(event.request)
    );
    return;
  }

  // HTML pages → Network First with fallback
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      networkFirst(event.request, './index.html')
    );
    return;
  }

  // Default → Network First
  event.respondWith(
    networkFirst(event.request)
  );
}

/**
 * Handle fetch for external resources (CDN, fonts, etc.)
 */
function handleExternalFetch(event, url) {
  // Google Fonts → Cache First with network fallback
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      cacheFirst(event.request)
    );
    return;
  }

  // Other external resources → Network First
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("", { status: 503 });
    })
  );
}

/**
 * Cache First strategy - try cache, then network
 */
function cacheFirst(request) {
  return caches.match(request).then((response) => {
    if (response) return response;

    return fetch(request).then((fetchResponse) => {
      if (fetchResponse.ok) {
        const clone = fetchResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, clone);
        });
      }
      return fetchResponse;
    }).catch(() => {
      return getOfflineFallback(request);
    });
  });
}

/**
 * Stale-While-Revalidate - serve cached, update in background
 */
function staleWhileRevalidate(request) {
  return caches.match(request).then((cachedResponse) => {
    const fetchPromise = fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, clone);
        });
      }
      return networkResponse;
    }).catch(() => null);

    return cachedResponse || fetchPromise || new Response(
      "Failed to load. Please check your connection.",
      { status: 503, statusText: "Service Unavailable" }
    );
  });
}

/**
 * Network First strategy - try network, fallback to cache
 */
function networkFirst(request, fallbackUrl = null) {
  return fetch(request).catch(() => {
    return caches.match(request).then((response) => {
      return response || (fallbackUrl ? caches.match(fallbackUrl) : null) || getOfflineFallback(request);
    });
  });
}

/**
 * Get offline fallback response
 */
function getOfflineFallback(request) {
  // For navigation requests, return the app shell
  if (request.mode === 'navigate') {
    return caches.match('./index.html').then(response => {
      return response || new Response(
        '<html><body style="font-family:sans-serif;text-align:center;padding:2rem;background:#0f172a;color:#fff"><h1>Offline</h1><p>Tidak ada koneksi internet.<br>Silakan coba lagi nanti.</p><button onclick="location.reload()" style="padding:0.75rem 1.5rem;background:#0C4E8C;color:#fff;border:none;border-radius:0.5rem;cursor:pointer">Coba Lagi</button></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html' } }
      );
    });
  }

  // For other requests, return empty response
  return new Response("", { status: 503 });
}

// 4. Push Notification Handler
self.addEventListener("push", (event) => {
  console.log("[SW] Push event received");

  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      try {
        payload = { body: event.data.text() };
      } catch (err) {
        payload = { body: "Ada notifikasi baru." };
      }
    }
  }

  const title = payload.notification?.title || payload.data?.title || "Syamsa";
  const body = payload.notification?.body || payload.data?.body || "Ada pembaruan baru.";
  const icon = payload.notification?.icon || payload.data?.icon || "./assets/icons/icon.webp";
  const badge = payload.notification?.badge || payload.data?.badge || "./assets/icons/icon.png";

  let clickUrl = payload.data?.url || payload.notification?.click_action || "./index.html";
  clickUrl = normalizePath(clickUrl);

  const notificationOptions = {
    body,
    icon,
    badge,
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || "syamsa-push",
    data: { url: clickUrl, ...payload.data },
    requireInteraction: payload.data?.type === "alpa_notification"
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// 5. Notification Click Handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let targetUrl = event.notification.data?.url || "./index.html";
  targetUrl = normalizePath(targetUrl);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 6. Background Sync Handler
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-changes') {
    event.waitUntil(processOfflineChanges());
  }
});

// Helper function to normalize paths for GitHub Pages
function normalizePath(path) {
  if (path.startsWith("./") && !path.includes("/syamsa/")) {
    return path.replace("./", "./syamsa/");
  }
  return path;
}

/**
 * Process offline changes from IndexedDB SyncQueue
 * Actually syncs to Supabase when network is available
 */
async function processOfflineChanges() {
  // Business writes require the authenticated foreground Supabase session so
  // RLS and optimistic concurrency remain enforceable. The service worker
  // only wakes an open client; it never writes with the public anon key.
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(client => client.postMessage({ type: 'SYNC_AUTH_REQUIRED' }));
}


console.log('[SW] Service Worker loaded, version:', CACHE_VERSION);
