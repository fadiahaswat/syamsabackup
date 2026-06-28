/**
 * Service Worker for Syriansa PWA
 * Handles offline caching and Web Push Notifications.
 */

const CACHE_VERSION = "v249-local-only";
const CACHE_NAME = `musyrif-app-${CACHE_VERSION}`;

// Assets to cache (static assets + core JS/CSS for offline)
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./output.css",
  "./style.css",
  // PWA Icons
  "./assets/icons/icon.svg",
  "./assets/icons/icon.webp",
  "./assets/icons/icon.png",
  "./assets/icons/app-icon.png",
  // Branding
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
  // Manifest
  "./manifest.json",
  // Core JS - precached for offline functionality
  "src/config/config.js",
  "src/core/app-init.js",
  "src/core/app-core.js",
  "src/core/script.js",
  "src/js/app.js",
  "src/js/router.js",
  "src/js/loader.js",
  "src/js/render.js",
  "src/managers/storage-manager.js",
  "src/managers/state-manager.js",
  "src/managers/auth-manager.js",
  "src/managers/santri-manager.js",
  "src/managers/attendance-manager.js",
  "src/managers/permit-manager.js",
  "src/managers/tab-manager.js",
  "src/managers/export-manager.js",
  "src/data/data-santri.js",
  "src/data/data-kelas.js",
  "src/data/tahfizh_metadata.json",
];

// Legacy key - kept for compatibility
const ALWAYS_FRESH_JS = [
  "src/features/qibla.js",
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

    // JS files → Stale-While-Revalidate for best performance
    // Serve cached version immediately, update cache in background
    if (isAlwaysFreshJS(url) || url.pathname.endsWith('.js')) {
      event.respondWith(
        caches.match(event.request).then(cachedResponse => {
          // Start network fetch in background
          const fetchPromise = fetch(event.request).then(networkResponse => {
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          }).catch(() => null);

          // Return cached response if available, otherwise wait for network
          return cachedResponse || fetchPromise || new Response(
            "Failed to load JavaScript. Please check your connection.",
            { status: 503, statusText: "Service Unavailable" }
          );
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
              return fallback || caches.match("./offline.html") || new Response(
                "<html><body style='font-family:sans-serif;text-align:center;padding:2rem'><h1>Offline</h1><p>Tidak ada koneksi internet. Silakan coba lagi nanti.</p></body></html>",
                { status: 503, headers: { 'Content-Type': 'text/html' } }
              );
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
    // ========== EXTERNAL FILES (CDN, Google Fonts) ==========
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

  // Extract target URL from notification data
  let targetUrl = event.notification.data?.url || "./index.html";

  // Adjust URL for GitHub Pages if relative
  if (targetUrl.startsWith("./") && !targetUrl.includes("/syamsa/")) {
    targetUrl = targetUrl.replace("./", "./syamsa/");
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Find open window and focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      // If no open window, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener("push", (event) => {
  console.log("[SW] Push event received:", event);

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

  console.log("[SW] Parsed push payload:", payload);

  // Extract title and body
  const title = payload.notification?.title || payload.data?.title || "Syamsa";
  const body = payload.notification?.body || payload.data?.body || "Ada pembaruan baru.";
  const icon = payload.notification?.icon || payload.data?.icon || "./assets/icons/icon.webp";
  const badge = payload.notification?.badge || payload.data?.badge || "./assets/icons/icon.png";

  // Extract URL for click action
  let clickUrl = payload.data?.url || payload.notification?.click_action || "./index.html";

  // Adjust URL for GitHub Pages if relative
  if (clickUrl.startsWith("./") && !clickUrl.includes("/syamsa/")) {
    clickUrl = clickUrl.replace("./", "./syamsa/");
  }

  const notificationOptions = {
    body: body,
    icon: icon,
    badge: badge,
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || payload.notification?.tag || "syamsa-push",
    data: {
      url: clickUrl,
      ...payload.data
    },
    // Keep interaction for important alerts (like Alpa notifications)
    requireInteraction: payload.data?.type === "alpa_notification" || payload.notification?.requireInteraction === "true" || false
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// 4. Background Sync - Process offline changes when back online
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-changes') {
    event.waitUntil(processOfflineChanges());
  }
});

/**
 * Process offline changes from IndexedDB SyncQueue
 * This is called when the app comes back online
 */
async function processOfflineChanges() {
  try {
    // Open IndexedDB
    const db = await openSyncDB();
    const changes = await getPendingChanges(db);

    if (!changes || changes.length === 0) {
      console.log('[SW] No pending changes to sync');
      return;
    }

    console.log('[SW] Processing', changes.length, 'pending changes');

    for (const change of changes) {
      try {
        // Process based on entity type
        await processChange(change, db);
        await markChangeComplete(db, change.id);
        console.log('[SW] Synced change:', change.id, change.entityType);
      } catch (err) {
        console.error('[SW] Failed to sync change:', change.id, err);
        await markChangeFailed(db, change.id, err.message);
      }
    }

    // Notify the app that sync is complete
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', count: changes.length });
    });

  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}

/**
 * Open SyncQueue IndexedDB
 */
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('syamsa_sync_queue', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('changes')) {
        db.createObjectStore('changes', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Get pending changes from IndexedDB
 */
function getPendingChanges(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['changes'], 'readonly');
    const store = tx.objectStore('changes');
    const index = store.index('status');
    const request = index.getAll(IDBKeyRange.only('pending'));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Process a single change
 */
async function processChange(change, db) {
  // For now, changes are stored locally
  // In a real app, this would sync to a backend API
  console.log('[SW] Processing:', change.entityType, change.operation);

  // The actual sync logic depends on your backend
  // This is a placeholder for the sync endpoint
  switch (change.entityType) {
    case 'attendance':
      // Sync attendance data
      break;
    case 'permit':
      // Sync permit data
      break;
    case 'settings':
      // Sync settings
      break;
    default:
      console.log('[SW] Unknown entity type:', change.entityType);
  }
}

/**
 * Mark a change as complete
 */
function markChangeComplete(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['changes'], 'readwrite');
    const store = tx.objectStore('changes');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.status = 'complete';
        record.completedAt = Date.now();
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Mark a change as failed
 */
function markChangeFailed(db, id, error) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['changes'], 'readwrite');
    const store = tx.objectStore('changes');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.status = 'failed';
        record.lastError = error;
        record.attempts = (record.attempts || 0) + 1;
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else {
        resolve();
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}
