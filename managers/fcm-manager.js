/**
 * FCM Manager - Handle Firebase Cloud Messaging for Push Notifications
 */

class FCMManager {
  constructor() {
    this.messaging = null;
    this.token = null;
    this.isSupported = false;
    this.db = null;
    this.userId = null;
  }

  /**
   * Initialize FCM - request permission and get token
   */
  async init() {
    // Check if messaging is supported
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return false;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("Service workers are not supported");
      return false;
    }

    this.isSupported = true;

    try {
      // Wait for Firebase to be initialized
      if (window.initFirebase) {
        await window.initFirebase();
      }

      // Use window globals set by firebase-config.js
      this.messaging = window.FIREBASE_MESSAGING;
      this.getToken = window.FIREBASE_GET_TOKEN;
      this.onMessage = window.FIREBASE_ON_MESSAGE;
      this.database = window.FIREBASE_DB;
      this.dbRef = window.FIREBASE_REF;
      this.dbSet = window.FIREBASE_SET;
      this.dbGet = window.FIREBASE_GET;
      this.dbPush = window.FIREBASE_PUSH;
      this.vapidKey = window.VAPID_KEY;

      // Request notification permission
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        console.log("Notification permission granted");
        await this.getFCMToken();
        this.listenForForegroundMessages();
        return true;
      } else {
        console.log("Notification permission denied");
        return false;
      }
    } catch (error) {
      console.error("Error initializing FCM:", error);
      return false;
    }
  }

  /**
   * Get FCM registration token
   */
  async getFCMToken() {
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");

      // Get token
      this.token = await this.getToken(this.messaging, {
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (this.token) {
        console.log("FCM Token:", this.token);

        // Save token to Firebase Realtime Database
        await this.saveTokenToFirebase(this.token);

        // Also save to localStorage as backup
        localStorage.setItem("fcm_token", this.token);

        return this.token;
      }
    } catch (error) {
      console.error("Error getting FCM token:", error);
    }
    return null;
  }

  /**
   * Save token to Firebase Realtime Database
   */
  async saveTokenToFirebase(token) {
    try {
      // Get user info from app state (if available)
      const userInfo = this.getUserInfo();

      // Create token data
      const tokenData = {
        token: token,
        userId: userInfo.userId || "anonymous",
        userName: userInfo.userName || "Unknown",
        kelas: userInfo.kelas || null,
        device: this.getDeviceInfo(),
        createdAt: Date.now(),
        lastActive: Date.now(),
        active: true
      };

      // Save to Firebase Realtime Database
      // Path: fcm_tokens/{pushId}
      const tokensRef = this.dbRef(this.database, "fcm_tokens");
      const newTokenRef = this.dbPush(tokensRef);
      await this.dbSet(newTokenRef, tokenData);

      // Also save the key for easy retrieval/update
      localStorage.setItem("fcm_token_key", newTokenRef.key);

      console.log("Token saved to Firebase:", newTokenRef.key);
      return newTokenRef.key;
    } catch (error) {
      console.error("Error saving token to Firebase:", error);
      // Fallback to localStorage
      localStorage.setItem("fcm_token", token);
    }
  }

  /**
   * Get user info from app state
   */
  getUserInfo() {
    try {
      if (window.appState && window.appState.user) {
        return {
          userId: window.appState.user.id || window.appState.user.nama || "anonymous",
          userName: window.appState.user.nama || "Unknown User",
          kelas: window.appState.user.kelas || null
        };
      }
    } catch (e) {
      // App state not available yet
    }
    return {
      userId: localStorage.getItem("user_id") || "anonymous",
      userName: localStorage.getItem("user_name") || "Unknown User",
      kelas: localStorage.getItem("user_kelas") || null
    };
  }

  /**
   * Get device info
   */
  getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenWidth: screen.width,
      screenHeight: screen.height
    };
  }

  /**
   * Listen for messages when app is in foreground
   */
  listenForForegroundMessages() {
    this.onMessage(this.messaging, (payload) => {
      console.log("Foreground message received:", payload);

      const notificationTitle = payload.notification?.title || "Syamsa";
      const notificationOptions = {
        body: payload.notification?.body || "Ada notifikasi baru",
        icon: payload.notification?.icon || "./assets/icons/icon.webp",
        badge: "./assets/icons/icon.png",
        tag: "syamsa-foreground",
        data: payload.data,
      };

      // Show notification
      if (Notification.permission === "granted") {
        new Notification(notificationTitle, notificationOptions);
      }
    });
  }

  /**
   * Get current token
   */
  getCurrentToken() {
    return this.token || localStorage.getItem("fcm_token");
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive() {
    try {
      const tokenKey = localStorage.getItem("fcm_token_key");
      if (tokenKey && this.database) {
        const tokenRef = this.dbRef(this.database, `fcm_tokens/${tokenKey}`);
        await this.dbSet(tokenRef, { lastActive: Date.now() }, { merge: true });
      }
    } catch (error) {
      console.error("Error updating last active:", error);
    }
  }

  /**
   * Delete the current registration token
   */
  async deleteToken() {
    try {
      const tokenKey = localStorage.getItem("fcm_token_key");
      if (tokenKey && this.database) {
        // Remove from Firebase
        const tokenRef = this.dbRef(this.database, `fcm_tokens/${tokenKey}`);
        await this.dbSet(tokenRef, { active: false });
      }

      // Clear local storage
      localStorage.removeItem("fcm_token");
      localStorage.removeItem("fcm_token_key");
      this.token = null;

      console.log("Token deleted");
    } catch (error) {
      console.error("Error deleting token:", error);
    }
  }
}

// Create global instance
window.fcmManager = new FCMManager();

// Periodically update last active (every 5 minutes)
if ("Notification" in window && Notification.permission === "granted") {
  setInterval(() => {
    if (window.fcmManager && window.fcmManager.updateLastActive) {
      window.fcmManager.updateLastActive();
    }
  }, 5 * 60 * 1000);
}
