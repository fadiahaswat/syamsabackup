/**
 * FCM Notification Server
 *
 * Server backend untuk mengirim push notifications via Firebase Cloud Messaging
 * juga bisa digunakan untuk cron job penjadwalan notifikasi otomatis
 *
 * Usage:
 *   node server.js                    # Start server
 *   node server.js --send-now         # Send test notification to all
 *   node server.js --schedule         # Run scheduler (for cron job)
 *   node server.js --list-tokens      # List all registered tokens
 *
 * Deployment:
 *   DEPLOYMENT_MODE=github-pages npm start   # For GitHub Pages
 *   npm start                                  # For local/Firebase Hosting
 */

const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const schedule = require("node-schedule");
const fs = require("fs");
const path = require("path");

// Deployment configuration
const DEPLOYMENT_MODE = process.env.DEPLOYMENT_MODE || "github-pages";
const BASE_URL = DEPLOYMENT_MODE === "github-pages"
  ? "https://fadiahaswat.github.io/syamsa/"
  : "https://syamsa-a3395.firebaseapp.com/";

console.log(`📍 Deployment Mode: ${DEPLOYMENT_MODE}`);
console.log(`📍 Base URL: ${BASE_URL}`);

// Load environment variables if .env exists
try {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    });
    console.log("✓ Environment loaded from .env");
  }
} catch (e) {
  console.log("No .env file found, trying service account file...");
}

// Initialize Firebase Admin SDK
let serviceAccount;
let adminApp;

// Try to load from service account file first
const serviceAccountPath = path.join(__dirname, "..", "syamsa-a3395-firebase-adminsdk-fbsvc-8044279ab8.json");
if (fs.existsSync(serviceAccountPath)) {
  try {
    serviceAccount = require(serviceAccountPath);
    console.log("✓ Service account file loaded");
  } catch (e) {
    console.error("Error loading service account file:", e.message);
  }
}

// Fallback to environment variables
if (!serviceAccount) {
  serviceAccount = {
    type: "service_account",
    project_id: "syamsa-a3395",
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: "102332826757312879493",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url:
      "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40syamsa-a3395.iam.gserviceaccount.com",
    universe_domain: "googleapis.com"
  };
}

try {
  adminApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://syamsa-a3395-default-rtdb.firebaseio.com",
  });
  console.log("✓ Firebase Admin initialized");
} catch (e) {
  console.error("Firebase Admin initialization error:", e.message);
  console.log("Make sure to set up service account credentials");
}

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all active FCM tokens from Realtime Database
 */
async function getAllTokens() {
  try {
    const db = admin.database();
    const tokensRef = db.ref("fcm_tokens");
    const snapshot = await tokensRef.orderByChild("active").equalTo(true).once("value");

    const tokens = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.token) {
        tokens.push({
          key: child.key,
          ...data,
        });
      }
    });

    return tokens;
  } catch (error) {
    console.error("Error getting tokens:", error);
    return [];
  }
}

/**
 * Send notification to a single token
 */
async function sendToToken(token, notification) {
  try {
    const message = {
      token: token,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl || "./assets/icons/icon.webp",
      },
      webpush: {
        fcm_options: {
          link: notification.link || BASE_URL,
        },
        headers: {
          URGENCY: "high",
        },
        notification: {
          icon: "./assets/icons/icon.webp",
          badge: "./assets/icons/icon.png",
          tag: notification.tag || "syamsa-notification",
          requireInteraction: notification.requireInteraction || false,
          vibrate: [200, 100, 200],
        },
      },
      data: notification.data || {},
      android: {
        priority: "high",
        notification: {
          channel_id: "syamsa_channel",
        },
      },
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error("Error sending to token:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification to multiple tokens
 */
async function sendToMultiple(tokens, notification) {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const tokenData of tokens) {
    const result = await sendToToken(tokenData.token, notification);
    if (result.success) {
      results.success++;
    } else {
      results.failed++;
      results.errors.push({
        token: tokenData.key,
        error: result.error,
      });
    }
  }

  return results;
}

/**
 * Send notification by kelas (class)
 */
async function sendByKelas(kelas, notification) {
  try {
    const db = admin.database();
    const tokensRef = db.ref("fcm_tokens");
    const snapshot = await tokensRef
      .orderByChild("kelas")
      .equalTo(kelas)
      .once("value");

    const tokens = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.token && data.active) {
        tokens.push({ key: child.key, ...data });
      }
    });

    return await sendToMultiple(tokens, notification);
  } catch (error) {
    console.error("Error sending by kelas:", error);
    return { success: 0, failed: 0, error: error.message };
  }
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Get all registered tokens
app.get("/api/tokens", async (req, res) => {
  try {
    const tokens = await getAllTokens();
    res.json({
      total: tokens.length,
      tokens: tokens.map((t) => ({
        key: t.key,
        userName: t.userName,
        kelas: t.kelas,
        device: t.device?.platform,
        lastActive: t.lastActive ? new Date(t.lastActive).toISOString() : null,
        active: t.active,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tokens by kelas
app.get("/api/tokens/:kelas", async (req, res) => {
  try {
    const db = admin.database();
    const tokensRef = db.ref("fcm_tokens");
    const snapshot = await tokensRef.orderByChild("kelas").equalTo(req.params.kelas).once("value");

    const tokens = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.token && data.active) {
        tokens.push({ key: child.key, ...data });
      }
    });

    res.json({ total: tokens.length, tokens });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send notification to all devices
app.post("/api/send-all", async (req, res) => {
  try {
    const { title, body, link, data, tag, requireInteraction } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }

    const tokens = await getAllTokens();
    const results = await sendToMultiple(tokens, { title, body, link, data, tag, requireInteraction });

    res.json({
      message: "Notifications sent",
      ...results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send notification to specific token
app.post("/api/send-token", async (req, res) => {
  try {
    const { token, title, body, link, data } = req.body;

    if (!token || !title || !body) {
      return res.status(400).json({ error: "token, title, and body are required" });
    }

    const result = await sendToToken(token, { title, body, link, data });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send notification by kelas
app.post("/api/send-kelas", async (req, res) => {
  try {
    const { kelas, title, body, link, data } = req.body;

    if (!kelas || !title || !body) {
      return res.status(400).json({ error: "kelas, title, and body are required" });
    }

    const results = await sendByKelas(kelas, { title, body, link, data });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SCHEDULED NOTIFICATIONS
// ============================================

// Jadwal shalat (WIB) - bisa disesuaikan
const jadwalShalat = {
  imsak: "04:30",
  subuh: "04:45",
  terbit: "05:55",
  dzuhur: "11:45",
  ashar: "15:10",
  maghrib: "17:50",
  isya: "19:05",
};

// Schedule daily notifications
function scheduleDailyNotifications() {
  console.log("Setting up scheduled notifications...");

  // Notifikasi Subuh
  schedule.scheduleJob("30 4 * * *", async () => {
    console.log("Sending Subuh notification...");
    const tokens = await getAllTokens();
    await sendToMultiple(tokens, {
      title: "🌅 Subuh",
      body: "Waktunya sholat Subuh. Semoga bermanfaat!",
      tag: "jadwal-sholat",
    });
  });

  // Notifikasi Dzuhur
  schedule.scheduleJob("40 11 * * *", async () => {
    console.log("Sending Dzuhur notification...");
    const tokens = await getAllTokens();
    await sendToMultiple(tokens, {
      title: "☀️ Dzuhur",
      body: "Waktunya sholat Dzuhur. Jangan lupa!",
      tag: "jadwal-sholat",
    });
  });

  // Notifikasi Ashar
  schedule.scheduleJob("05 15 * * *", async () => {
    console.log("Sending Ashar notification...");
    const tokens = await getAllTokens();
    await sendToMultiple(tokens, {
      title: "🌤️ Ashar",
      body: "Waktunya sholat Ashar. Jangan tertinggal!",
      tag: "jadwal-sholat",
    });
  });

  // Notifikasi Maghrib
  schedule.scheduleJob("45 17 * * *", async () => {
    console.log("Sending Maghrib notification...");
    const tokens = await getAllTokens();
    await sendToMultiple(tokens, {
      title: "🌆 Maghrib",
      body: "Waktunya sholat Maghrib. Buka puasa dulu jika berpuasa!",
      tag: "jadwal-sholat",
    });
  });

  // Notifikasi Isya
  schedule.scheduleJob("00 19 * * *", async () => {
    console.log("Sending Isya notification...");
    const tokens = await getAllTokens();
    await sendToMultiple(tokens, {
      title: "🌙 Isya",
      body: "Waktunya sholat Isya. Jangan lupa!",
      tag: "jadwal-sholat",
    });
  });

  // Notifikasi Pembinaan (setiap Senin-Jumat, jam 7 pagi)
  schedule.scheduleJob("0 7 * * 1-5", async () => {
    console.log("Sending Pembinaan reminder...");
    const tokens = await getAllTokens();
    await sendToMultiple(tokens, {
      title: "📚 Pembinaan",
      body: "Jangan lupa mengikuti pembinaan hari ini!",
      tag: "pembinaan",
    });
  });

  console.log("Scheduled notifications configured!");
}

// ============================================
// COMMAND LINE HANDLERS
// ============================================

const args = process.argv.slice(2);

if (args.includes("--send-now")) {
  // Send test notification to all
  console.log("Sending test notification to all devices...");
  getAllTokens().then(async (tokens) => {
    console.log(`Found ${tokens.length} tokens`);
    const results = await sendToMultiple(tokens, {
      title: "🔔 Test Notifikasi",
      body: "Ini adalah notifikasi test dari server FCM!",
      link: "/",
    });
    console.log("Results:", results);
    process.exit(0);
  });
} else if (args.includes("--list-tokens")) {
  // List all tokens
  console.log("Fetching all tokens...");
  getAllTokens().then((tokens) => {
    console.log(`Found ${tokens.length} active tokens:`);
    tokens.forEach((t, i) => {
      console.log(`${i + 1}. ${t.userName || "Unknown"} (${t.kelas || "no kelas"}) - ${t.device?.platform || "unknown device"}`);
    });
    process.exit(0);
  });
} else if (args.includes("--schedule")) {
  // Run scheduler only
  console.log("Starting scheduler mode...");
  scheduleDailyNotifications();
  console.log("Scheduler running. Press Ctrl+C to stop.");
} else {
  // Start full server
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║           FCM Notification Server Started               ║
╠═══════════════════════════════════════════════════════╣
║  Port: ${PORT}                                              ║
║  Mode: Full Server                                      ║
╠═══════════════════════════════════════════════════════╣
║  Endpoints:                                             ║
║  - GET  /health              Health check               ║
║  - GET  /api/tokens         List all tokens            ║
║  - POST /api/send-all        Send to all devices        ║
║  - POST /api/send-token     Send to specific token     ║
║  - POST /api/send-kelas     Send by class              ║
╠═══════════════════════════════════════════════════════╣
║  Scheduled: Shalat (5x) + Pembinaan (weekdays 7AM)     ║
╚═══════════════════════════════════════════════════════╝
    `);

    // Start scheduler
    scheduleDailyNotifications();
  });
}
