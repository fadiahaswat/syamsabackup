/**
 * Firebase Messaging Service Worker
 *
 * Handles push notifications when the app is in the background or closed.
 * This file must be in the root directory (public folder) for GitHub Pages.
 */

// Import Firebase SDK for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration (same as in firebase-messaging.js)
// Note: Service Worker runs in isolated context, no window.APP_SECRETS available
const firebaseConfig = {
  apiKey: "AIzaSyB0cD9V4SpOb4NT1tO7CEXRKlS-Ue1H4Yg",
  authDomain: "syamsa-app-4dd5a.firebaseapp.com",
  projectId: "syamsa-app-4dd5a",
  storageBucket: "syamsa-app-4dd5a.firebasestorage.app",
  messagingSenderId: "974889231190",
  appId: "1:974889231190:web:0fc1478bb3586e031b2cf7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging
const messaging = firebase.messaging();

// Use same VAPID key as in firebase-messaging.js
// Note: In production, consider passing VAPID key via URL params or hardcode in SW
// The messaging object uses the VAPID key from Firebase Console project settings

// Background message handler - when app is closed/background
messaging.onBackgroundMessage((payload) => {
  console.log('[Firebase SW] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Syamsa PWA';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Ada notifikasi baru',
    icon: '/assets/icons/icon.png',
    badge: '/assets/icons/badge.png',
    tag: payload.data?.tag || 'syamsa-notif',
    data: payload.data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Buka' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Firebase SW] Notification click:', event);

  event.notification.close();

  // Handle action
  if (event.action === 'dismiss') {
    return;
  }

  // Default action - open the app
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: event.notification.data
          });
          return;
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle push events (fallback)
self.addEventListener('push', (event) => {
  console.log('[Firebase SW] Push event:', event);

  if (!event.data) return;

  try {
    const payload = event.data.json();

    // If Firebase handled it, this won't fire
    // This is a fallback for non-Firebase pushes
    if (payload.notification || payload.data) {
      const notificationTitle = payload.notification?.title || payload.data?.title || 'Syamsa';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || '',
        icon: '/assets/icons/icon.png',
        badge: '/assets/icons/badge.png',
        data: payload.data
      };

      event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
      );
    }
  } catch (error) {
    console.error('[Firebase SW] Error handling push:', error);
  }
});

console.log('[Firebase SW] Service Worker loaded and ready');
