/**
 * Firebase Messaging Service Worker
 * Handles push notifications when the app is in background or closed
 * Updated for GitHub Pages deployment (fadiahaswat.github.io/syamsa)
 */

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyDNCThjnwBxvwdrre7QxLD7IRR_YmdVXGg",
  authDomain: "syamsa-a3395.firebaseapp.com",
  databaseURL: "https://syamsa-a3395-default-rtdb.firebaseio.com",
  projectId: "syamsa-a3395",
  storageBucket: "syamsa-a3395.firebasestorage.app",
  messagingSenderId: "166579449286",
  appId: "1:166579449286:web:d0f6af6a59ce5d0c31d6c7"
});

const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
  console.log("Received background message:", payload);

  let notificationTitle = payload.notification?.title;
  let notificationBody = payload.notification?.body;
  let notificationIcon = payload.notification?.icon || "./assets/icons/icon.webp";
  let notificationBadge = "./assets/icons/icon.png";
  let notificationTag = "syamsa-background";
  let notificationData = payload.data || {};
  let clickUrl = payload.data?.url || "./index.html";

  // If no notification data, use data payload
  if (!notificationTitle) {
    notificationTitle = payload.data?.title || "Syamsa";
    notificationBody = payload.data?.body || "Ada notifikasi baru";
    notificationIcon = payload.data?.icon || "./assets/icons/icon.webp";
    notificationTag = payload.data?.tag || "syamsa-background";
    clickUrl = payload.data?.url || "./index.html";
  }

  // Adjust URL for GitHub Pages deployment
  // fadiahaswat.github.io/syamsa
  const baseUrl = "./index.html";
  const finalUrl = clickUrl.startsWith("./")
    ? clickUrl.replace("./", "./syamsa/")
    : clickUrl;

  const notificationOptions = {
    body: notificationBody,
    icon: notificationIcon,
    badge: notificationBadge,
    tag: notificationTag,
    data: notificationData,
    vibrate: [200, 100, 200],
    priority: "high",
    ttl: 86400,
    data: {
      url: finalUrl,
      ...notificationData
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  let urlToOpen = event.notification.data?.url || "./index.html";

  // Adjust for GitHub Pages
  if (urlToOpen.startsWith("./")) {
    urlToOpen = urlToOpen.replace("./", "./syamsa/");
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(urlToOpen);
          }
          return client;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener("push", (event) => {
  console.log("Push event received in SW:", event);
});
