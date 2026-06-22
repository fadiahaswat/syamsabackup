/**
 * FCM Manager - Handle Firebase Cloud Messaging for Push Notifications
 * Fixed: Update existing token instead of creating new one
 */

class FCMManager {
  constructor() {
    this.messaging = null;
    this.token = null;
    this.isSupported = false;
    this.db = null;
    this.userId = null;
    this.isInitialized = false;
    this.debugMode = true; // Enable debug logging
  }

  /**
   * Debug log helper
   */
  log(...args) {
    if (this.debugMode) {
      console.log(`[FCM]`, ...args);
    }
  }

  /**
   * Initialize FCM - request permission and get token
   */
  async init() {
    if (this.isInitialized) {
      this.log("Already initialized, skipping...");
      return true;
    }

    // Check if messaging is supported
    if (!("Notification" in window)) {
      this.log("This browser does not support notifications");
      return false;
    }

    if (!("serviceWorker" in navigator)) {
      this.log("Service workers are not supported");
      return false;
    }

    this.isSupported = true;

    try {
      this.log("Starting FCM initialization...");

      // Wait for Firebase to be initialized
      if (window.initFirebase) {
        this.log("Waiting for Firebase init...");
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

      if (!this.messaging) {
        this.log("Firebase Messaging not available");
        return false;
      }

      this.log("Firebase Messaging is available");

      // Request notification permission
      const permission = await Notification.requestPermission();
      this.log("Permission result:", permission);

      if (permission === "granted") {
        this.log("Notification permission granted");

        // Get and save FCM token
        await this.getFCMToken();

        // Listen for foreground messages
        this.listenForForegroundMessages();

        // Setup token refresh listener
        this.setupTokenRefresh();

        this.isInitialized = true;
        return true;
      } else {
        this.log("Notification permission denied");
        return false;
      }
    } catch (error) {
      console.error("[FCM] Error initializing FCM:", error);
      return false;
    }
  }

  /**
   * Get FCM registration token
   */
  async getFCMToken() {
    try {
      this.log("Registering service worker...");

      // Register service worker
      const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
      this.log("Service worker registered:", registration);

      this.log("Getting FCM token...");

      // Get token
      this.token = await this.getToken(this.messaging, {
        vapidKey: this.vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (this.token) {
        this.log("FCM Token obtained:", this.token.substring(0, 20) + "...");

        // Save token to Firebase Realtime Database (will update if exists)
        await this.saveTokenToFirebase(this.token);

        // Also save to localStorage as backup
        localStorage.setItem("fcm_token", this.token);

        return this.token;
      }
    } catch (error) {
      console.error("[FCM] Error getting FCM token:", error);
    }
    return null;
  }

  /**
   * Save token to Firebase Realtime Database
   * FIXED: Check for existing token first, update if exists
   */
  async saveTokenToFirebase(token) {
    try {
      this.log("Saving token to Firebase...");

      // Get user info from app state (if available)
      const userInfo = this.getUserInfo();
      const deviceInfo = this.getDeviceInfo();

      // Check for existing token for this user/device
      const existingKey = await this.findExistingTokenKey(userInfo.userId, deviceInfo.platform);

      // Create token data (remove undefined values - Firebase doesn't allow them)
      const tokenData = {
        token: token,
        userId: userInfo.userId || "anonymous",
        userName: userInfo.userName || "Unknown",
        kelas: userInfo.kelas || null,
        device: deviceInfo,
        lastActive: Date.now(),
        active: true
      };

      // Only set createdAt for new tokens
      if (!existingKey) {
        tokenData.createdAt = Date.now();
      }

      if (existingKey) {
        // Update existing token
        this.log("Updating existing token:", existingKey);
        const tokenRef = this.dbRef(this.database, `fcm_tokens/${existingKey}`);
        await this.dbSet(tokenRef, tokenData, { merge: true });
        localStorage.setItem("fcm_token_key", existingKey);
        this.log("Token updated successfully");
      } else {
        // Create new token
        this.log("Creating new token entry...");
        const tokensRef = this.dbRef(this.database, "fcm_tokens");
        const newTokenRef = this.dbPush(tokensRef);
        await this.dbSet(newTokenRef, tokenData);
        localStorage.setItem("fcm_token_key", newTokenRef.key);
        this.log("New token saved:", newTokenRef.key);
      }

      return localStorage.getItem("fcm_token_key");
    } catch (error) {
      console.error("[FCM] Error saving token to Firebase:", error);
      // Fallback to localStorage
      localStorage.setItem("fcm_token", token);
    }
  }

  /**
   * Find existing token key for this user/device
   */
  async findExistingTokenKey(userId, platform) {
    try {
      if (!this.database) return null;

      const tokensRef = this.dbRef(this.database, "fcm_tokens");
      const snapshot = await this.dbGet(tokensRef);

      if (!snapshot.exists()) return null;

      // Look for existing token with same userId and device platform
      for (const [key, data] of Object.entries(snapshot.val() || {})) {
        if (data.userId === userId && data.device?.platform === platform && data.active) {
          this.log("Found existing token for:", userId, platform);
          return key;
        }
      }

      return null;
    } catch (error) {
      this.log("Error finding existing token:", error);
      return null;
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
    if (!this.onMessage || !this.messaging) {
      this.log("Cannot listen for messages - messaging not available");
      return;
    }

    this.log("Setting up foreground message listener...");

    this.onMessage(this.messaging, (payload) => {
      this.log("Foreground message received:", payload);

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
   * Setup token refresh listener
   * FCM tokens can change, we need to handle this
   */
  setupTokenRefresh() {
    if (!this.messaging) return;

    this.log("Setting up token refresh listener...");

    // Listen for token refresh
    if (this.messaging.onTokenRefresh) {
      this.messaging.onTokenRefresh(async () => {
        this.log("Token refresh triggered!");
        try {
          const registration = await navigator.serviceWorker.ready;
          const newToken = await this.getToken(this.messaging, {
            vapidKey: this.vapidKey,
            serviceWorkerRegistration: registration,
          });

          if (newToken) {
            this.log("New token after refresh:", newToken.substring(0, 20) + "...");
            await this.saveTokenToFirebase(newToken);
          }
        } catch (error) {
          console.error("[FCM] Error refreshing token:", error);
        }
      });
    }
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
      console.error("[FCM] Error updating last active:", error);
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

      this.log("Token deleted");
    } catch (error) {
      console.error("[FCM] Error deleting token:", error);
    }
  }
}

// Create global instance
window.fcmManager = new FCMManager();

// Periodically update last active (every 5 minutes)
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    setInterval(() => {
      if (window.fcmManager && window.fcmManager.updateLastActive && Notification.permission === "granted") {
        window.fcmManager.updateLastActive();
      }
    }, 5 * 60 * 1000);
  });
}

console.log("[FCM] FCM Manager loaded");
