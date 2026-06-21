# 🔔 Sistem Notifikasi Push - Syamsa

## Overview

Sistem notifikasi push untuk aplikasi web姆斯a menggunakan Firebase Cloud Messaging (FCM).

## Arsitektur

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   App Client    │      │  Firebase RTDB  │      │  FCM Server     │
│   (Browser)     │ ───▶ │  (Token Store)  │ ◀─── │  (Node.js)     │
│                 │      │                 │      │                 │
│ - fcm-manager   │      │ fcm_tokens/     │      │ - Schedule job  │
│ - firebase-sdk  │      │   { pushId }    │      │ - API endpoints │
└─────────────────┘      └─────────────────┘      └─────────────────┘
         │                                                │
         │         ┌─────────────────┐                   │
         └────────▶│ Firebase FCM    │◀──────────────────┘
                   │ (Push Service) │
                   └─────────────────┘
```

## Struktur File

```
syamsa-main/
├── firebase-config.js           # Konfigurasi Firebase SDK (Client)
├── firebase-messaging-sw.js     # Service Worker untuk FCM
├── managers/
│   └── fcm-manager.js          # Logic untuk request & manage token
├── manifest.json               # PWA manifest dengan push config
└── server/                     # Backend server (Node.js)
    ├── server.js              # FCM notification server
    ├── package.json           # Dependencies
    ├── .env.example           # Template environment variables
    └── README.md              # Dokumentasi ini
```

## Setup

### 1. Setup Firebase Console

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Pilih project **syamsa-a3395**
3. **Build** → **Realtime Database** → **Create Database**
   - Pilih lokasi (sesuaikan dengan timezone)
   - Start in **test mode** (untuk development)
4. **Project Settings** → **Cloud Messaging**
   - Scroll ke **Web Push Certificates**
   - Generate **Web Push Keypair** jika belum ada
   - Copy VAPID Key ke `firebase-config.js`

### 2. Service Account (Sudah Ada! ✅)

File service account sudah tersedia: `../syamsa-a3395-firebase-adminsdk-fbsvc-8044279ab8.json`

Server otomatis mendeteksi file ini.

### 3. Install & Run Server

```bash
cd server

# Install dependencies
npm install

# Start server
npm start
```

> **Note:** Server secara otomatis menggunakan file `syamsa-a3395-firebase-adminsdk-fbsvc-8044279ab8.json` di root project.

## API Endpoints

### Health Check
```bash
GET /health
```

### List All Tokens
```bash
GET /api/tokens
```
Response:
```json
{
  "total": 5,
  "tokens": [
    {
      "key": "-Nabc123",
      "userName": "Ahmad Fauzi",
      "kelas": "7A",
      "device": "iPhone",
      "lastActive": "2024-01-15T10:30:00.000Z",
      "active": true
    }
  ]
}
```

### Send to All Devices
```bash
POST /api/send-all
Content-Type: application/json

{
  "title": "🔔 Notifikasi Title",
  "body": "Isi pesan notifikasi",
  "link": "/",
  "tag": "custom-tag",
  "requireInteraction": false
}
```

### Send to Specific Token
```bash
POST /api/send-token
Content-Type: application/json

{
  "token": "dGVzdC10b2tlbi...",
  "title": "Direct Message",
  "body": "Pesan untuk satu device"
}
```

### Send by Class (Kelas)
```bash
POST /api/send-kelas
Content-Type: application/json

{
  "kelas": "7A",
  "title": "📚 Info Kelas 7A",
  "body": "Pemberitahuan khusus kelas 7A"
}
```

## Scheduled Notifications

Server menjalankan jadwal notifikasi otomatis:

| Waktu | Notifikasi | Deskripsi |
|-------|------------|-----------|
| 04:30 | 🌅 Subuh | Pengingat sholat Subuh |
| 11:45 | ☀️ Dzuhur | Pengingat sholat Dzuhur |
| 15:10 | 🌤️ Ashar | Pengingat sholat Ashar |
| 17:50 | 🌆 Maghrib | Pengingat sholat Maghrib |
| 19:05 | 🌙 Isya | Pengingat sholat Isya |
| 07:00 ( weekdays) | 📚 Pembinaan | Reminder pembinaan |

## Command Line Tools

```bash
# Send test notification to all devices
npm run send-test

# List all registered tokens
npm run list-tokens

# Run scheduler only (for cron job)
npm run scheduler
```

## Troubleshooting

### Token tidak tersimpan ke Firebase
1. Cek Realtime Database rules (allow read/write)
2. Pastikan Firebase SDK loaded correctly
3. Check browser console untuk error

### Notifikasi tidak muncul
1. Pastikan permission notification granted
2. Cek Service Worker registered
3. Test dengan Firebase Console → Messaging → Test

### Server error saat kirim
1. Cek credentials Firebase Admin SDK
2. Pastikan service account punya permission FCM
3. Check network/firewall

## Development

### Test Lokal

1. Jalankan server: `npm start`
2. Buka app di browser
3. Aktifkan notifikasi
4. Check token tersimpan di Firebase Console
5. Kirim test: `npm run send-test`

### Production Deployment

Untuk server production, bisa gunakan:
- **Railway** - Easy Node.js deployment
- **Render** - Free tier available
- **Google Cloud Run** - Scalable container
- **PM2** - Process manager

```bash
# PM2 for production
npm install -g pm2
pm2 start server.js --name syamsa-notif
pm2 save
pm2 startup
```

## Database Structure

```
syamsa-a3395-default-rtdb/
└── fcm_tokens/
    └── -Nabc123xyz/
        ├── token: "firebase-token-string"
        ├── userId: "user-id"
        ├── userName: "Nama User"
        ├── kelas: "7A"
        ├── device/
        │   ├── platform: "iPhone"
        │   ├── userAgent: "..."
        │   └── screenWidth: 390
        ├── createdAt: 1705312200000
        ├── lastActive: 1705312200000
        └── active: true
```

## Security Notes

1. **Realtime Database Rules** - Atur rules untuk production:
   ```json
   {
     "rules": {
       "fcm_tokens": {
         ".read": false,
         ".write": true
       }
     }
   }
   ```

2. **Service Account** - Jangan commit `.env` ke git!

3. **Token Refresh** - Token bisa expire, handle refresh di client

## License

ISC
