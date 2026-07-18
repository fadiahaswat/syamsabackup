/**
 * Firebase Cloud Messaging (FCM) Setup for Push Notifications
 *
 * This enables push notifications even when the app is closed/background.
 * Works with Firebase Console for manual sends, or integrate with your backend.
 */

// Get Firebase configuration from APP_SECRETS or use fallback
const FCM_CONFIG = window.APP_SECRETS?.firebaseConfig || {
  apiKey: "AIzaSyB0cD9V4SpOb4NT1tO7CEXRKlS-Ue1H4Yg",
  authDomain: "syamsa-app-4dd5a.firebaseapp.com",
  projectId: "syamsa-app-4dd5a",
  storageBucket: "syamsa-app-4dd5a.firebasestorage.app",
  messagingSenderId: "974889231190",
  appId: "1:974889231190:web:0fc1478bb3586e031b2cf7"
};

// VAPID key for web push - from Firebase Console > Cloud Messaging > Web Push certificates
const VAPID_KEY = window.APP_SECRETS?.fcmVapidKey || '';

/**
 * Initialize Firebase Messaging
 */
async function initFirebaseMessaging() {
  // Check if already initialized
  if (window.firebaseMessaging) {
    console.log('[FCM] Already initialized');
    return window.firebaseMessaging;
  }

  try {
    // Import Firebase modules dynamically
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getMessaging, getToken, onMessage, deleteToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

    // Initialize Firebase
    const app = initializeApp(FCM_CONFIG);
    const messaging = getMessaging(app);

    // Store globally
    window.firebaseApp = app;
    window.firebaseMessaging = messaging;

    console.log('[FCM] Firebase Messaging initialized successfully');

    return messaging;
  } catch (error) {
    console.error('[FCM] Failed to initialize Firebase Messaging:', error);
    return null;
  }
}

/**
 * Request notification permission and get FCM token
 */
async function requestFCMPermission() {
  try {
    const messaging = await initFirebaseMessaging();
    if (!messaging) {
      console.warn('[FCM] Messaging not available');
      return null;
    }

    // Check notification permission
    if (!('Notification' in window)) {
      console.warn('[FCM] Browser does not support notifications');
      return null;
    }

    if (Notification.permission === 'denied') {
      console.warn('[FCM] Notification permission denied');
      return null;
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[FCM] Service Worker registered:', registration.scope);
        window.swRegistration = registration;
      } catch (swError) {
        console.warn('[FCM] Service Worker registration failed:', swError);
        // Try with firebase-messaging-sw.js in root
        try {
          const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[FCM] Firebase SW registered:', registration.scope);
          window.swRegistration = registration;
        } catch (e) {
          console.warn('[FCM] Firebase SW also failed:', e);
        }
      }
    }

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: window.swRegistration
    });

    if (token) {
      console.log('[FCM] FCM Token obtained:', token.substring(0, 20) + '...');

      // Save token to server/local storage for sending notifications later
      await saveFCMToken(token);

      return token;
    } else {
      console.warn('[FCM] No token available - permission may not be granted');
      return null;
    }

  } catch (error) {
    console.error('[FCM] Error getting FCM permission/token:', error);
    return null;
  }
}

/**
 * Save FCM token to Supabase for sending notifications later
 */
async function saveFCMToken(token) {
  try {
    const recipient = window.getNotificationRecipientInfo?.() || { type: 'unknown', id: 'anonymous' };
    const userId = `${recipient.type}_${recipient.id}`;

    if (window.supabaseClient && window.isSupabaseEnabled) {
      const { data, error } = await window.supabaseClient
        .from('fcm_tokens')
        .upsert({
          token: token,
          user_type: recipient.type,
          user_id: recipient.id,
          device_info: navigator.userAgent,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'token'
        });

      if (error) {
        console.warn('[FCM] Failed to save token to Supabase:', error);
      } else {
        console.log('[FCM] Token saved to Supabase');
      }
    }

    // Also save locally
    localStorage.setItem('fcm_token', token);
    localStorage.setItem('fcm_token_time', Date.now().toString());

    return token;
  } catch (error) {
    console.error('[FCM] Error saving token:', error);
    return null;
  }
}

/**
 * Delete FCM token (on logout)
 */
async function deleteFCMToken() {
  try {
    const token = localStorage.getItem('fcm_token');
    if (token && window.supabaseClient && window.isSupabaseEnabled) {
      await window.supabaseClient
        .from('fcm_tokens')
        .delete()
        .eq('token', token);
    }

    localStorage.removeItem('fcm_token');
    localStorage.removeItem('fcm_token_time');

    if (window.firebaseMessaging) {
      const { deleteToken } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');
      await deleteToken(window.firebaseMessaging);
    }

    console.log('[FCM] Token deleted');
  } catch (error) {
    console.error('[FCM] Error deleting token:', error);
  }
}

/**
 * Handle foreground messages (when app is open)
 */
async function setupForegroundMessageHandler() {
  try {
    const messaging = await initFirebaseMessaging();
    if (!messaging) return;

    const { onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);

      const notificationTitle = payload.notification?.title || payload.data?.title || 'Notifikasi Baru';
      const notificationBody = payload.notification?.body || payload.data?.body || '';

      // Show browser notification
      if (typeof window.sendLocalNotification === 'function') {
        window.sendLocalNotification(
          notificationTitle,
          notificationBody,
          payload.data?.type || 'info'
        );
      }

      // Dispatch custom event for app handling
      window.dispatchEvent(new CustomEvent('fcm:message', {
        detail: payload
      }));

      // Show toast
      if (typeof window.showToast === 'function') {
        window.showToast(`${notificationTitle}: ${notificationBody}`, 'info');
      }
    });

    console.log('[FCM] Foreground message handler set up');
  } catch (error) {
    console.error('[FCM] Error setting up foreground handler:', error);
  }
}

/**
 * Check if FCM is supported
 */
function isFCMSupported() {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'crypto' in window
  );
}

/**
 * Initialize FCM - call this on app load
 */
window.initFCM = async function() {
  if (!isFCMSupported()) {
    console.warn('[FCM] FCM not supported in this browser');
    return false;
  }

  // Only request permission if not already granted
  if (Notification.permission === 'granted') {
    console.log('[FCM] Permission already granted');
    await setupForegroundMessageHandler();

    // Get token if we don't have one
    if (!localStorage.getItem('fcm_token')) {
      await requestFCMPermission();
    }
    return true;
  }

  if (Notification.permission === 'denied') {
    console.warn('[FCM] Permission denied');
    return false;
  }

  // Request permission
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('[FCM] Permission granted');
    await setupForegroundMessageHandler();
    await requestFCMPermission();
    return true;
  }

  console.warn('[FCM] Permission not granted:', permission);
  return false;
};

// Auto-init when loaded (can be called manually)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Delay to ensure other initialization complete
    setTimeout(() => {
      if (window.APP_CREDENTIALS?.enableFCM !== false) {
        window.initFCM();
      }
    }, 2000);
  });
} else {
  setTimeout(() => {
    if (window.APP_CREDENTIALS?.enableFCM !== false) {
      window.initFCM();
    }
  }, 2000);
}

console.log('[FCM] Firebase Messaging module loaded');
