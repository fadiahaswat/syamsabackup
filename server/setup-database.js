/**
 * Firebase Database Setup Script
 *
 * Run this script to test connection and verify database structure
 *
 * Usage: node setup-database.js
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

console.log(`
╔══════════════════════════════════════════════════════╗
║       Firebase Realtime Database Setup                ║
╚══════════════════════════════════════════════════════╝
`);

// Load service account
let serviceAccount;
const serviceAccountPath = path.join(__dirname, "..", "syamsa-a3395-firebase-adminsdk-fbsvc-8044279ab8.json");

if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(serviceAccountPath);
  console.log("✓ Service account loaded");
} else {
  console.error("✗ Service account file not found!");
  console.log("  Expected: " + serviceAccountPath);
  process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://syamsa-a3395-default-rtdb.firebaseio.com",
});

const db = admin.database();

async function setup() {
  try {
    // 1. Test connection
    console.log("\n📝 Step 1: Testing database connection...");
    const testRef = db.ref(".info/connected");
    const snapshot = await testRef.once("value");
    console.log("✓ Database connected");

    // 2. Create test entry to verify write access
    console.log("\n📝 Step 2: Testing write access...");
    const testWriteRef = db.ref("fcm_tokens/_setup_test");
    await testWriteRef.set({
      test: true,
      createdAt: Date.now(),
      message: "Setup test - will be removed"
    });
    console.log("✓ Write access verified");

    // 3. Verify data can be read
    console.log("\n📝 Step 3: Testing read access...");
    const readSnapshot = await testWriteRef.once("value");
    console.log("✓ Read access verified");

    // 4. Clean up test data
    console.log("\n📝 Step 4: Cleaning up test data...");
    await testWriteRef.remove();
    console.log("✓ Test data removed");

    // 5. Count existing tokens
    console.log("\n📝 Step 5: Checking existing tokens...");
    const tokensSnapshot = await db.ref("fcm_tokens").once("value");
    const tokenCount = tokensSnapshot.numChildren();
    console.log(`✓ Found ${tokenCount} existing token(s)`);

    console.log(`
╔══════════════════════════════════════════════════════╗
║                 Setup Complete! ✅                     ║
╠══════════════════════════════════════════════════════╣
║  Database: syamsa-a3395-default-rtdb               ║
║  Status: Connected & Verified                       ║
╚══════════════════════════════════════════════════════╝

✅ Connection: OK
✅ Write Access: OK
✅ Read Access: OK

📋 NEXT STEPS (Manual via Firebase Console):

1. SETUP REALTIME DATABASE RULES:
   - Go to: https://console.firebase.google.com/
   - Select project: syamsa-a3395
   - Click "Build" → "Realtime Database"
   - If no database exists, click "Create Database"
   - Choose location (nearest to you)
   - Start in "test mode"

2. SET DATABASE RULES (for production):
   In Firebase Console → Realtime Database → Rules tab:

   {
     "rules": {
       "fcm_tokens": {
         ".read": false,
         ".write": true,
         "$tokenId": {
           ".validate": "newData.hasChildren(['token', 'createdAt'])"
         }
       }
     }
   }

3. START THE SERVER:
   npm start

4. TEST THE APP:
   - Open app in browser
   - Enable notifications
   - Check tokens with: npm run list-tokens
   - Send test: npm run send-test
`);

    process.exit(0);
  } catch (error) {
    console.error("\n✗ Setup failed:", error.message);
    console.log(`

╔══════════════════════════════════════════════════════╗
║                  ERROR                                 ║
╚══════════════════════════════════════════════════════╝
Troubleshooting:

1. ❓ DATABASE NOT CREATED:
   → Go to Firebase Console
   → Build → Realtime Database
   → Click "Create Database"
   → Select location
   → Start in "test mode"

2. ❓ PERMISSION DENIED:
   → In Firebase Console, go to Rules tab
   → Set to test mode temporarily:

   {
     "rules": {
       ".read": true,
       ".write": true
     }
   }

3. ❓ API NOT ENABLED:
   → Go to Google Cloud Console
   → https://console.cloud.google.com/
   → Search "Firebase Realtime Database API"
   → Enable it
`);

    // Show specific error
    if (error.message.includes("permission_denied")) {
      console.log("\n→ Permission denied. Check Firebase Console rules.");
    } else if (error.message.includes("database not found")) {
      console.log("\n→ Database not found. Create one in Firebase Console.");
    }

    process.exit(1);
  }
}

setup();
