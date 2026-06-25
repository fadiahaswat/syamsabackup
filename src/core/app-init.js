/**
 * App Initialization Module
 * Handles Service Worker registration and Notification setup
 */

// Service Worker Registration
function initServiceWorker() {
  console.log("[SW] Starting service worker registration...");
  console.log("[SW] Protocol:", window.location.protocol);
  console.log("[SW] SW supported:", "serviceWorker" in navigator);

  if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    window.addEventListener("load", async () => {
      console.log("[SW] Window loaded, registering service worker...");

      try {
        const swReg = await navigator.serviceWorker.register("./sw.js");
        console.log("[SW] Consolidated SW registered:", swReg);
      } catch (err) {
        console.warn("[SW] Gagal daftar SW:", err);
      }
    });
  } else {
    console.log("[SW] Service workers not available or running from file://");
    if (window.location.protocol === "file:") {
      console.log("[SW] NOTE: Notifications require HTTPS or localhost, not file:// protocol");
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

    console.log("[Notification] Checking permission state:", Notification.permission);

    // AUTO INIT: Langsung inisialisasi jika izin sudah diberikan
    if (Notification.permission === "granted") {
      console.log("[Notification] Permission already granted");
      window.updateNotificationUI?.("granted");
    } else if (Notification.permission === "denied") {
      console.log("[Notification] Permission denied - user blocked notifications");
      window.updateNotificationUI?.("denied");
    } else {
      console.log("[Notification] Permission is default. Waiting for user click to request permission.");
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
