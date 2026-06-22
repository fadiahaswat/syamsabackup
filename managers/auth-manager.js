// File: auth-manager.js

// ==========================================
// 2. LOGIN LOGIC
// ==========================================

// ==========================================
// PWA UPDATE CHECKER
// ==========================================
window.checkForPWAUpdate = async function() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;

    // Check if there's a waiting Service Worker
    if (registration.waiting) {
      console.log('[PWA Update] New version waiting');
      window.showToast('Update tersedia! Refresh untuk memperbarui.', 'info');

      // Auto-update after 3 seconds
      setTimeout(() => {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }, 3000);
      return;
    }

    // Check for updates
    await registration.update();
    console.log('[PWA Update] Checked for updates');
  } catch (error) {
    console.warn('[PWA Update] Check failed:', error);
  }
};

// Force update Service Worker
window.forceSWUpdate = async function() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    } else {
      await registration?.update();
      window.showToast('Service Worker diperbarui', 'success');
    }
  } catch (error) {
    console.error('[SW Update] Failed:', error);
  }
};

// ==========================================
// AUTH MODE HELPERS
// ==========================================

window.getAuthMode = function () {
  const override = localStorage.getItem("override_login_mode");
  if (override === "testing" || override === "production") {
    return override;
  }
  return String(window.APP_AUTH?.loginMode || "production").toLowerCase();
};

window.getProfileDisplayName = function (profile) {
  if (!profile) return "Musyrif";
  return profile.given_name || profile.name || "Musyrif";
};

window.applyLoginModeUI = function () {
  const mode = window.getAuthMode();
  const isTestingMode = mode === "testing";
  
  const testingFields = document.getElementById("testing-credentials");
  const modeBadge = document.getElementById("login-mode-badge");
  const submitText = document.getElementById("login-submit-text");

  // Selalu sembunyikan testing fields karena user tidak butuh username & password testing lagi
  if (testingFields) testingFields.classList.add("hidden");
  
  if (modeBadge) {
    modeBadge.classList.toggle("hidden", !isTestingMode);
    modeBadge.classList.toggle("inline-flex", isTestingMode);
    modeBadge.innerHTML = '🧪 Mode Testing (Direct) — Klik untuk Production';
    modeBadge.style.cursor = "pointer";
    
    if (!modeBadge.dataset.hasListener) {
      modeBadge.dataset.hasListener = "true";
      modeBadge.addEventListener("click", () => {
        localStorage.setItem("override_login_mode", "production");
        window.applyLoginModeUI();
        window.showToast("Mode diubah ke Production (Google OAuth)", "info");
      });
    }
  }

  if (submitText) {
    submitText.textContent = isTestingMode
      ? "Masuk Dashboard (Testing Direct)"
      : "Masuk Dashboard";
  }
};

window.toggleLoginMode = function () {
  const currentMode = window.getAuthMode();
  const nextMode = currentMode === "production" ? "testing" : "production";
  localStorage.setItem("override_login_mode", nextMode);
  window.applyLoginModeUI();
  window.showToast(
    `Mode diubah ke: ${nextMode === "testing" ? "Testing (Direct)" : "Production (Google OAuth)"}`,
    "info"
  );
};

let devTapCount = 0;
let devTapTimeout;
window.handleDevTap = function () {
  devTapCount++;
  clearTimeout(devTapTimeout);
  
  if (devTapCount >= 5) {
    devTapCount = 0;
    window.toggleLoginMode();
    return;
  }
  
  devTapTimeout = setTimeout(() => {
    devTapCount = 0;
  }, 2000); // Reset count jika tidak ada klik dalam 2 detik
};

window.startAuthenticatedSession = async function (targetClass, profile, supabaseSession = null) {
  const authData = {
    kelas: targetClass,
    profile: profile,
    supabaseSession: supabaseSession,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(APP_CONFIG.googleAuthKey, JSON.stringify(authData));

  appState.selectedClass = targetClass;
  appState.userProfile = profile;

  // ========== SUPABASE INTEGRATION ==========
  // Initialize hybrid storage if cloud mode is enabled
  if (window.APP_STORAGE?.mode !== 'local-only' && window.hybridStorageManager) {
    try {
      // Get kelas ID for the selected class
      const kelasInfo = MASTER_KELAS?.[targetClass];
      const kelasId = kelasInfo?.supabaseId || kelasInfo?.id || targetClass;

      await window.hybridStorageManager.init(kelasId);
      console.log('[AuthManager] Hybrid storage initialized for class:', targetClass);
    } catch (error) {
      console.warn('[AuthManager] Hybrid storage init failed:', error);
    }
  }

  // ========== PWA UPDATE CHECK ==========
  // Cek update PWA setiap login untuk memastikan dapat data terbaru
  window.checkForPWAUpdate();

  FILTERED_SANTRI = MASTER_SANTRI.filter((s) => {
    const sKelas = String(s.kelas || s.rombel || "").trim();
    return sKelas === targetClass;
  }).sort((a, b) => a.nama.localeCompare(b.nama));

  document.getElementById("view-login").classList.add("hidden");
  document.getElementById("view-main").classList.remove("hidden");

  window.updateDashboard();
  window.updateProfileInfo();
};

window.handleLogin = async function () {
  const kelas = document.getElementById("login-kelas").value;

  if (!kelas) {
    window.showToast("Pilih kelas dulu!", "warning");
    return;
  }

  if (!MASTER_KELAS[kelas]) {
    return window.showToast("Kelas tidak valid.", "error");
  }

  const mode = window.getAuthMode();
  if (mode === "testing") {
    // Mode Testing: Login langsung tanpa Google OAuth / Password
    const profileName = String(MASTER_KELAS[kelas].musyrif || "Musyrif").trim();
    const profile = {
      name: profileName,
      given_name: profileName.split(/\s+/)[0] || "Musyrif",
      email: MASTER_KELAS[kelas].email || `${kelas.toLowerCase()}@musyrif.local`,
      authProvider: "testing",
    };

    window.startAuthenticatedSession(kelas, profile);
    window.showToast("Login Berhasil (Testing Mode)!", "success");
    return;
  }

  // Mode Production: Wajib Google OAuth
  appState.tempClass = kelas;

  const modal = document.getElementById("modal-google-auth");
  const classLbl = document.getElementById("lbl-google-class");
  if (classLbl) classLbl.textContent = kelas;

  if (modal) {
    window.openModal("modal-google-auth");

    // Render tombol login Google
    if (window.google) {
      google.accounts.id.initialize({
        client_id: window.APP_CREDENTIALS.googleClientId,
        callback: window.handleGoogleCallback,
      });
      google.accounts.id.renderButton(
        document.getElementById("google-btn-container"),
        { theme: "outline", size: "large", type: "standard" }
      );
    } else {
      window.showToast("Gagal memuat API Google. Pastikan Anda terhubung ke internet.", "error");
    }
  }
};

window.handleGoogleCallback = async function (response) {
  try {
    const profile = window.parseJwt(response.credential);
    console.log(profile);
    const userEmail = profile.email;
    if (!userEmail) {
      return window.showToast("Google tidak mengirim alamat email.", "error");
    }
    const targetClass = appState.tempClass;

    // 1. AMBIL DATA KELAS DARI VARIABLE GLOBAL (yang diload data-kelas.js)
    // Pastikan variabelnya window.classData (sesuai data-kelas.js Anda)
    const classInfo =
      window.classData?.[targetClass] || MASTER_KELAS?.[targetClass];

    if (!classInfo) {
      return window.showToast(
        "Data kelas belum siap. Silakan coba lagi.",
        "warning",
      );
    }

    // 2. VALIDASI EMAIL (KEAMANAN UTAMA)
    // Jika di sheet kolom email kosong, kita tolak demi keamanan
    if (!classInfo.email) {
      return window.showToast(
        "Admin belum mendaftarkan email untuk kelas ini.",
        "warning",
      );
    }

    const allowedEmails = String(classInfo.email || "")
      .split(/[;,]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const normalizedUserEmail = String(userEmail || "")
      .trim()
      .toLowerCase();

    if (!allowedEmails.includes(normalizedUserEmail)) {
      return window.showToast(
        "AKSES DITOLAK! Email Anda tidak terdaftar untuk kelas ini.",
        "error",
      );
    }

    // 3. SUPABASE AUTH (jika cloud mode enabled)
    let supabaseSession = null;
    if (window.APP_STORAGE?.mode !== 'local-only' && window.supabaseClient) {
      try {
        const { data: sbData } = await window.supabaseClient.signInWithGoogle(
          response.credential
        );
        if (sbData?.session) {
          supabaseSession = sbData.session;
          console.log('[AuthManager] Supabase auth successful');
        }
      } catch (sbError) {
        console.warn('[AuthManager] Supabase sign-in failed:', sbError);
        // Continue without Supabase - local storage still works
      }
    }

    // 4. JIKA LOLOS -> SIMPAN SESI
    await window.startAuthenticatedSession(targetClass, profile, supabaseSession);
    window.closeModal("modal-google-auth");
    window.showToast("Login Berhasil!", "success");
  } catch (e) {
    console.error(e);
    window.showToast("Gagal memproses login Google.", "error");
  }
};

window.handleLogout = async function () {
  window.showConfirmModal(
    "Keluar dari Akun?",
    "Sesi saat ini akan ditutup dan Anda kembali ke layar login.",
    "Keluar",
    "Batal",
    async () => {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  // Supabase sign out
  if (window.supabaseClient) {
    try {
      await window.supabaseClient.signOut();
    } catch (e) {
      console.warn('[AuthManager] Supabase sign-out error:', e);
    }
  }

  // Cleanup hybrid storage
  if (window.hybridStorageManager) {
    window.hybridStorageManager.destroy();
  }

  localStorage.removeItem(APP_CONFIG.googleAuthKey);
  appState.selectedClass = null;

  document.getElementById("view-main").classList.add("hidden");
  document.getElementById("view-login").classList.remove("hidden");
  document.getElementById("login-kelas").value = "";
  const userEl = document.getElementById("login-username");
  const passEl = document.getElementById("login-password");
  if (userEl) userEl.value = "";
  if (passEl) passEl.value = "";

  location.reload();
    },
  );
};
