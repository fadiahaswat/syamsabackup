# Deploy Syamsa ke iOS

Proyek ini adalah aplikasi web/PWA statis: `index.html`, `manifest.json`, `sw.js`, CSS, dan JavaScript biasa. Jadi ada dua jalur deploy ke iOS:

1. PWA: paling cepat, bisa dikerjakan dari Windows. User membuka link HTTPS di Safari lalu pilih Add to Home Screen.
2. App Store/TestFlight: aplikasi dibungkus menjadi app iOS memakai Capacitor. Untuk build final tetap butuh macOS, Xcode, dan Apple Developer Program.

## Jalur A: Deploy sebagai PWA

Ini jalur yang bisa dilakukan sekarang dari Windows.

### 1. Pastikan CSS sudah dibangun

```bash
npm run build:css
```

Di PowerShell Windows, kalau `npm` diblokir execution policy, pakai:

```bash
npm.cmd run build:css
```

### 2. Upload ke hosting HTTPS

Gunakan salah satu:

- Netlify: drag folder proyek ke Netlify Drop, atau connect repository.
- Vercel: import repository, framework pilih Other/static.
- GitHub Pages: upload folder ini ke repository lalu aktifkan Pages.

Pastikan file ini ikut ter-upload:

- `index.html`
- `manifest.json`
- `sw.js`
- `output.css`
- `style.css`
- folder `assets`
- folder `config`
- folder `core`
- folder `data`
- folder `features`
- folder `managers`
- folder `tahfizh`

### 3. Tes di iPhone

1. Buka link HTTPS aplikasi di Safari iPhone.
2. Tap Share.
3. Pilih Add to Home Screen.
4. Buka dari ikon Syamsa di Home Screen.
5. Tes login, presensi, tab tahfizh, export, dan fitur yang butuh internet.

Catatan: PWA iOS wajib lewat HTTPS agar manifest dan service worker aktif. `file://` tidak cukup untuk deploy.

## Jalur B: Deploy ke TestFlight/App Store

Jalur ini membuat aplikasi iOS sungguhan. Windows bisa dipakai untuk persiapan, tetapi proses archive dan upload ke App Store Connect harus memakai Mac dengan Xcode.

### 1. Syarat

- Mac atau akses Mac cloud build.
- Xcode terbaru dari App Store.
- Apple Account.
- Apple Developer Program aktif.
- App Store Connect access.
- Bundle ID, contoh: `id.syamsa.app`.

### 2. Siapkan Capacitor

Di folder proyek:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios --save-dev
npx cap init Syamsa id.syamsa.app --web-dir .
npx cap add ios
```

Karena proyek ini statis dan file utama ada di root, `--web-dir .` bisa dipakai untuk awal. Untuk rilis yang lebih rapi, buat folder build khusus seperti `dist` lalu salin hanya file yang diperlukan.

### 3. Sinkronkan ke iOS

Setiap kali ada perubahan web:

```bash
npm run build:css
npx cap sync ios
```

### 4. Buka di Xcode

```bash
npx cap open ios
```

Di Xcode:

1. Pilih target App.
2. Buka tab Signing & Capabilities.
3. Pilih Team Apple Developer.
4. Isi Bundle Identifier, contoh `id.syamsa.app`.
5. Set Version dan Build.
6. Pastikan App Icon terisi dari `assets/icons/app-icon.png`.

### 5. Tes di iPhone langsung

1. Sambungkan iPhone ke Mac.
2. Pilih device di Xcode.
3. Klik Run.
4. Kalau muncul trust prompt, buka Settings iPhone dan trust developer profile.
5. Tes fitur utama.

### 6. Upload ke TestFlight

Di Xcode:

1. Product > Archive.
2. Setelah archive selesai, buka Organizer.
3. Pilih archive terbaru.
4. Klik Distribute App.
5. Pilih App Store Connect.
6. Upload.

Di App Store Connect:

1. Buat app baru jika belum ada.
2. Pilih bundle ID yang sama.
3. Tunggu build selesai diproses.
4. Masuk TestFlight.
5. Tambahkan tester internal atau external.
6. Kirim build ke tester.

### 7. Submit ke App Store

Siapkan metadata:

- Nama aplikasi: Syamsa.
- Subtitle dan deskripsi.
- Screenshot iPhone.
- App Privacy.
- Age Rating.
- Support URL.
- Marketing URL, opsional.
- Kontak review Apple.

Lalu pilih build dari TestFlight/App Store Connect dan submit for review.

## Checklist sebelum dikirim

- Aplikasi dibuka dari HTTPS tanpa error.
- Semua file lokal tidak 404.
- Ikon 1024x1024 tersedia.
- Nama app dan splash tidak terlihat pecah di iPhone.
- Login Google dites di iOS, karena WebView/App Store kadang butuh konfigurasi OAuth tambahan.
- Fitur export PDF dites di iPhone.
- Fitur offline dites setelah app dibuka minimal sekali.
- Tidak ada data rahasia hardcoded di file JavaScript publik.

## Catatan penting untuk Syamsa

Saat ini app memuat beberapa library dari CDN:

- Lucide
- Chart.js
- jsPDF
- jsPDF AutoTable
- Google Identity Services

Artinya sebagian fitur butuh internet. Untuk PWA offline yang kuat atau aplikasi iOS yang lebih stabil, library non-login sebaiknya dibundel lokal, bukan dimuat dari CDN.
