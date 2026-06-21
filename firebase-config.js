/**
 * Firebase Configuration & Initialization
 * Uses Firebase Compat (UMD) builds for classic script tag compatibility
 */

(function() {
  // Firebase configuration
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDNCThjnwBxvwdrre7QxLD7IRR_YmdVXGg",
    authDomain: "syamsa-a3395.firebaseapp.com",
    databaseURL: "https://syamsa-a3395-default-rtdb.firebaseio.com",
    projectId: "syamsa-a3395",
    storageBucket: "syamsa-a3395.firebasestorage.app",
    messagingSenderId: "166579449286",
    appId: "1:166579449286:web:d0f6af6a59ce5d0c31d6c7"
  };

  // VAPID Key for FCM
  const VAPID_KEY = "BBFXqqlP-a_QcDVQNX0Z2iYkCn3SgmROrYACxjDoyqRU0p2ZYGMHisHPTwYm2xH6FXb2Gorb7q0em7hBFIppIrA";

  // Track initialization state
  let isInitialized = false;
  let initPromise = null;
  let firebaseApp = null;
  let firebaseDb = null;
  let firebaseMessaging = null;

  /**
   * Load a script dynamically
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        resolve();
        return;
      }

      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function() { resolve(); };
      script.onerror = function() { reject(new Error('Failed to load: ' + src)); };
      document.head.appendChild(script);
    });
  }

  /**
   * Initialize Firebase
   */
  async function initFirebase() {
    if (isInitialized) return Promise.resolve();
    if (initPromise) return initPromise;

    initPromise = new Promise(async function(resolve, reject) {
      try {
        console.log('[FirebaseConfig] Loading Firebase SDKs (Compat/UMD builds)...');

        // Load Firebase App Compat (UMD build)
        await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');

        if (typeof firebase === 'undefined') {
          throw new Error('Firebase App failed to load');
        }

        // Initialize Firebase App
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        console.log('[FirebaseConfig] Firebase App initialized');

        // Load Firebase Database Compat
        await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js');

        if (typeof firebase.database === 'undefined') {
          throw new Error('Firebase Database failed to load');
        }

        // Initialize Database
        firebaseDb = firebase.database(firebaseApp);

        // Expose database functions to window using firebase namespace
        window.FIREBASE_DB = firebaseDb;
        window.FIREBASE_APP = firebaseApp;
        window.FIREBASE_CONFIG = FIREBASE_CONFIG;
        window.VAPID_KEY = VAPID_KEY;

        // Convenience functions for firebase-storage-manager
        window.FIREBASE_REF = function(path) {
          return firebaseDb.ref(path);
        };

        window.FIREBASE_SET = function(ref, data) {
          return ref.set(data);
        };

        window.FIREBASE_GET = function(ref) {
          return ref.once('value');
        };

        window.FIREBASE_PUSH = function(ref) {
          return ref.push();
        };

        window.FIREBASE_REMOVE = function(ref) {
          return ref.remove();
        };

        window.FIREBASE_ON_VALUE = function(ref, callback) {
          return ref.on('value', callback);
        };

        console.log('[FirebaseConfig] Firebase Database initialized');

        // Load Firebase Messaging Compat (optional - may fail on HTTP)
        try {
          await loadScript('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

          if (typeof firebase.messaging !== 'undefined') {
            firebaseMessaging = firebase.messaging(firebaseApp);

            window.FIREBASE_MESSAGING = firebaseMessaging;
            window.FIREBASE_GET_TOKEN = function(options) {
              return firebaseMessaging.getToken(options);
            };
            window.FIREBASE_ON_MESSAGE = function(callback) {
              return firebaseMessaging.onMessage(callback);
            };

            console.log('[FirebaseConfig] Firebase Messaging initialized');
          }
        } catch (msgErr) {
          console.warn('[FirebaseConfig] Firebase Messaging not available:', msgErr);
        }

        isInitialized = true;
        console.log('[FirebaseConfig] All Firebase SDKs loaded successfully');
        resolve();

      } catch (error) {
        console.error('[FirebaseConfig] Firebase initialization failed:', error);
        reject(error);
      }
    });

    return initPromise;
  }

  // Expose functions globally
  window.initFirebase = initFirebase;
  window.FIREBASE_IS_READY = function() { return isInitialized; };
  window.FIREBASE_WAIT_FOR_READY = function() { return initFirebase(); };

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebase);
  } else {
    initFirebase();
  }

  console.log('[FirebaseConfig] Script loaded. Firebase will initialize automatically.');
})();