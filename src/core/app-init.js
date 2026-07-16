/**
 * App Initialization Module
 * Handles Service Worker registration and Notification setup
 */

// Service Worker Registration
const appInitDebugLog = (...args) => {
  if (localStorage.getItem("DEBUG_LOGS") === "true" || location.search.includes("debug=true")) {
    console.log(...args);
  }
};

function initServiceWorker() {
  appInitDebugLog("[SW] Starting service worker registration...");
  appInitDebugLog("[SW] Protocol:", window.location.protocol);
  appInitDebugLog("[SW] SW supported:", "serviceWorker" in navigator);

  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SYNC_AUTH_REQUIRED' && window.cloudSessionReady) {
        window.supabaseSync?.syncAll?.();
      }
    });
    window.addEventListener("load", async () => {
      appInitDebugLog("[SW] Window loaded, registering service worker...");

      try {
        const swReg = await navigator.serviceWorker.register("./sw.js");
        appInitDebugLog("[SW] Consolidated SW registered:", swReg);
      } catch (err) {
        console.warn("[SW] Gagal daftar SW:", err);
      }
    });
  } else {
    if (window.location.protocol === "file:") {
      console.info("[SW] Notifikasi/service worker dinonaktifkan pada file:// (membutuhkan HTTPS atau localhost)");
    } else {
      console.warn("[SW] Service worker tidak didukung browser ini");
    }
  }
}

// Notification Permission Management
function initNotifications() {
  if (!("Notification" in window) || window.location.protocol === "file:") {
    return;
  }

  window.addEventListener("load", async () => {
    // Tunda sebentar agar semua script load dulu
    await new Promise(resolve => setTimeout(resolve, 500));

    appInitDebugLog("[Notification] Checking permission state:", Notification.permission);

    // AUTO INIT: Langsung inisialisasi jika izin sudah diberikan
    if (Notification.permission === "granted") {
      appInitDebugLog("[Notification] Permission already granted");
      window.updateNotificationUI?.("granted");
    } else if (Notification.permission === "denied") {
      console.warn("[Notification] Izin notifikasi diblokir browser");
      window.updateNotificationUI?.("denied");
    } else {
      appInitDebugLog("[Notification] Permission is default. Waiting for user click to request permission.");
      window.updateNotificationUI?.("default");
    }
  });

  // Button click handler
  window.addEventListener("load", () => {
    const notifyBtn = document.getElementById("notification-permission-btn");
    if (notifyBtn) {
      notifyBtn.addEventListener("click", async () => {
        if (Notification.permission === "denied") {
          window.showToast?.("Buka pengaturan browser untuk aktifkan notifikasi", "warning");
          return;
        }

        if (Notification.permission === "granted") {
          window.showToast?.("Notifikasi sudah aktif!", "info");
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          window.updateNotificationUI?.("granted");
          window.showToast?.("Notifikasi aktif! 🎉", "success");
        } else {
          window.updateNotificationUI?.("denied");
          window.showToast?.("Izin notifikasi diperlukan", "warning");
        }
      });
    }
  });
}

// Update Notification UI based on permission state
window.updateNotificationUI = function(permission) {
  const notifyBtn = document.getElementById("notification-permission-btn");
  if (!notifyBtn) return;

  if (permission === "granted") {
    notifyBtn.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="bell-ring" class="w-4 h-4"></i> Notifikasi Aktif</span>';
    notifyBtn.classList.remove("bg-slate-100", "dark:bg-slate-800", "bg-red-100", "dark:bg-red-900/30");
    notifyBtn.classList.add("bg-green-100", "dark:bg-green-900/30", "text-green-700", "dark:text-green-400");
  } else if (permission === "denied") {
    notifyBtn.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="bell-off" class="w-4 h-4"></i> Notifikasi Ditolak</span>';
    notifyBtn.classList.remove("bg-slate-100", "dark:bg-slate-800", "bg-green-100", "dark:bg-green-900/30");
    notifyBtn.classList.add("bg-red-100", "dark:bg-red-900/30", "text-red-700", "dark:text-red-400");
  } else {
    notifyBtn.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="bell" class="w-4 h-4"></i> Aktifkan Notifikasi</span>';
    notifyBtn.classList.remove("bg-green-100", "dark:bg-green-900/30", "bg-red-100", "dark:bg-red-900/30");
    notifyBtn.classList.add("bg-slate-100", "dark:bg-slate-800", "text-slate-700", "dark:text-slate-300");
  }

  // Update lucide icons
  if (window.lucide) window.lucide.createIcons();

  // Save permission state
  if (appState?.settings) {
    appState.settings.notifications = permission === "granted";
    localStorage.setItem("musyrif_settings", JSON.stringify(appState.settings));
  }
};

// HIGH FIX: Event Listener Registry untuk cleanup memory leak
const ListenerRegistry = {
  listeners: [],
  observers: [],

  // Register event listener for cleanup later
  addEventListener: function(element, event, handler, options) {
    if (!element || !event || !handler) {
      console.warn('[ListenerRegistry] Invalid parameters');
      return null;
    }

    element.addEventListener(event, handler, options);
    const registration = { element, event, handler, options };
    this.listeners.push(registration);

    return registration;
  },

  // Register ResizeObserver for cleanup
  addResizeObserver: function(element, callback) {
    if (!element || !callback) {
      console.warn('[ListenerRegistry] Invalid observer parameters');
      return null;
    }

    const observer = new ResizeObserver(callback);
    observer.observe(element);
    const registration = { observer, element };
    this.observers.push(registration);

    return observer;
  },

  // Cleanup all registered listeners
  cleanup: function() {
    // Cleanup event listeners
    this.listeners.forEach(({ element, event, handler, options }) => {
      try {
        element.removeEventListener(event, handler, options);
      } catch (e) {
        console.warn('[ListenerRegistry] Failed to remove listener:', e);
      }
    });
    this.listeners = [];

    // Cleanup ResizeObservers
    this.observers.forEach(({ observer, element }) => {
      try {
        observer.unobserve(element);
        observer.disconnect();
      } catch (e) {
        console.warn('[ListenerRegistry] Failed to disconnect observer:', e);
      }
    });
    this.observers = [];

    console.log('[ListenerRegistry] All listeners and observers cleaned up');
  },

  // Cleanup on page unload
  init: function() {
    window.addEventListener('beforeunload', () => this.cleanup());
  }
};

// Initialize listener cleanup on load
ListenerRegistry.init();

// DOM cleanup - remove stray comment markers
function initDOMCleanup() {
  document.addEventListener("DOMContentLoaded", () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const strayNodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.textContent.trim() === "-->") {
        strayNodes.push(walker.currentNode);
      }
    }
    strayNodes.forEach((node) => node.remove());
  });
}

// Initialize all
function initApp() {
  initServiceWorker();
  initNotifications();
  initDOMCleanup();
}

// Auto-init
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
