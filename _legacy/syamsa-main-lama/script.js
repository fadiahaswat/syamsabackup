window.updateMetaThemeColor = function () {
  const isDark = document.documentElement.classList.contains("dark");
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  metas.forEach(meta => {
    meta.setAttribute("content", isDark ? "#0f172a" : "#f8fafc");
  });
};

window.initApp = async function () {
  const loadingEl = document.getElementById("view-loading");
  try {
    try {
      window.startClock();
      window.updateDateDisplay();
      window.refreshIcons();
      if (window.initSalatHijriWidget) window.initSalatHijriWidget();
      if (window.applyLoginModeUI) window.applyLoginModeUI();
    } catch (uiError) {
      console.error("UI Init Error:", uiError);
    }
    try {
      const savedSettings = localStorage.getItem(APP_CONFIG.settingsKey);
      if (savedSettings) {
        appState.settings = {
          ...appState.settings,
          ...JSON.parse(savedSettings),
        };
        if (appState.settings.darkMode) {
          document.documentElement.classList.add("dark");
        }
        window.updateMetaThemeColor();
      }
      const savedData = localStorage.getItem(APP_CONFIG.storageKey);
      if (savedData) appState.attendanceData = JSON.parse(savedData);
      const savedLog = localStorage.getItem(APP_CONFIG.activityLogKey);
      if (savedLog) appState.activityLog = JSON.parse(savedLog);
      appState.permits = [];
      const savedPermits = localStorage.getItem(APP_CONFIG.permitKey);
      if (savedPermits) {
        try {
          appState.permits = JSON.parse(savedPermits);
        } catch (permitError) {
          console.error("Error parsing permits:", permitError);
          appState.permits = [];
        }
      }
    } catch (storageError) {
      console.error("Storage Error:", storageError);
      if (!appState.permits) appState.permits = [];
    }
    appState.currentSlotId = window.determineCurrentSlot();
    const dataLoadingPromise = Promise.all([
      window.loadClassData ? window.loadClassData() : Promise.resolve({}),
      window.loadSantriData ? window.loadSantriData() : Promise.resolve([]),
    ]);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Koneksi lambat (Timeout)")),
        window.APP_CONSTANTS.dataLoadTimeoutMs,
      ),
    );
    try {
      const [kelasData, santriData] = await Promise.race([
        dataLoadingPromise,
        timeoutPromise,
      ]);
      MASTER_KELAS = kelasData || {};
      MASTER_SANTRI = santriData || [];
      window.populateClassDropdown();
      const savedAuth = localStorage.getItem(APP_CONFIG.googleAuthKey);
      if (savedAuth) {
        try {
          const authData = JSON.parse(savedAuth);
          const LOGIN_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
          const loginTime = new Date(authData.timestamp).getTime();
          if (!loginTime || Date.now() - loginTime > LOGIN_MAX_AGE) {
            throw new Error("Sesi login kadaluarsa");
          }
          if (
            authData?.profile?.authProvider === "testing" &&
            window.getAuthMode &&
            window.getAuthMode() !== "testing"
          ) {
            throw new Error(
              "Sesi testing dinonaktifkan karena aplikasi berjalan di mode production.",
            );
          }
          if (authData.kelas && MASTER_KELAS[authData.kelas]) {
            appState.selectedClass = authData.kelas;
            appState.userProfile = authData.profile;
            FILTERED_SANTRI = MASTER_SANTRI.filter((s) => {
              const sKelas = String(s.kelas || s.rombel || "").trim();
              return sKelas === appState.selectedClass;
            }).sort((a, b) => a.nama.localeCompare(b.nama));
            if (FILTERED_SANTRI.length > 0) {
              document.getElementById("view-login").classList.add("hidden");
              document.getElementById("view-main").classList.remove("hidden");
              window.updateDashboard();
              window.updateProfileInfo();
              const greetName = window.getProfileDisplayName(authData.profile);
              setTimeout(
                () => window.showToast(`Ahlan, ${greetName}`, "success"),
                500,
              );
            }
          } else {
            throw new Error("Data kelas tidak valid");
          }
        } catch (authError) {
          console.error("Auto-login error:", authError);
          localStorage.removeItem(APP_CONFIG.googleAuthKey);
        }
      }
    } catch (fetchError) {
      console.error("Data Fetch Error:", fetchError);
      window.showToast("Gagal memuat data santri (Offline/Lambat)", "warning");
    }
  } catch (criticalError) {
    console.error("Critical Init Error:", criticalError);
    alert("Terjadi kesalahan sistem: " + criticalError.message);
  } finally {
    if (loadingEl) {
      loadingEl.classList.add("opacity-0", "pointer-events-none");
      setTimeout(() => {
        loadingEl.style.display = "none";
      }, 500);
    }
    window.initBottomNavScroll();
  }
};

window.initBottomNavScroll = function () {
  const bottomNav = document.querySelector("nav");
  if (!bottomNav) return;

  const handleScroll = (e) => {
    const container = e.currentTarget || e.target;
    if (!container) return;
    const scrollTop = container.scrollTop;

    if (scrollTop > 20) {
      bottomNav.classList.add("nav-expanded");
    } else {
      bottomNav.classList.remove("nav-expanded");
    }

    if (container.id === "main-content") {
      const heroCard = document.getElementById("dash-main-card");
      const heroWrapper = document.getElementById("dash-main-card-wrapper");
      if (heroCard && heroWrapper) {
        if (window.innerWidth < 1024 && scrollTop > 80) {
          heroCard.classList.add("sticky-hero");
          heroWrapper.classList.remove("relative");
          heroWrapper.classList.add("sticky", "top-2", "sm:top-3");
        } else {
          heroCard.classList.remove("sticky-hero");
          heroWrapper.classList.remove("sticky", "top-2", "sm:top-3");
          heroWrapper.classList.add("relative");
        }
      }
    }

  };

  const tabContents = document.querySelectorAll(".tab-content");
  tabContents.forEach((container) => {
    container.removeEventListener("scroll", handleScroll);
    container.addEventListener("scroll", handleScroll, { passive: true });
  });
};

window.populateClassDropdown = function () {
  const select = document.getElementById("login-kelas");
  if (!select) return;

  select.innerHTML =
    '<option value="" disabled selected>-- Pilih Kelas --</option>';
  Object.keys(MASTER_KELAS)
    .sort()
    .forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = `${k} - ${MASTER_KELAS[k].musyrif}`;
      select.appendChild(opt);
    });
};

// ==========================================
// 2. LOGIN LOGIC
// ==========================================

let loginIconClickCount = 0;
let loginIconClickTimeout = null;
window.googleBypassActive = false;

window.handleLogoClick = function () {
  loginIconClickCount++;
  clearTimeout(loginIconClickTimeout);
  
  if (loginIconClickCount >= 5) {
    loginIconClickCount = 0;
    window.toggleGoogleBypassMode();
  } else {
    loginIconClickTimeout = setTimeout(() => {
      loginIconClickCount = 0;
    }, 3000);
  }
};

window.toggleGoogleBypassMode = function () {
  window.googleBypassActive = !window.googleBypassActive;
  
  const modeBadge = document.getElementById("login-mode-badge");
  if (modeBadge) {
    if (window.googleBypassActive) {
      modeBadge.textContent = "Google Bypass Active";
      modeBadge.classList.remove("hidden");
      modeBadge.classList.add("inline-flex");
      window.showToast("Google login bypass diaktifkan!", "success");
    } else {
      modeBadge.textContent = "Testing Mode";
      const isTestingMode = window.getAuthMode() === "testing";
      modeBadge.classList.toggle("hidden", !isTestingMode);
      modeBadge.classList.toggle("inline-flex", isTestingMode);
      window.showToast("Google login bypass dinonaktifkan!", "info");
    }
  }
};

window.getAuthMode = function () {
  const mode = String(window.APP_AUTH?.loginMode || "production").toLowerCase();
  const allowTestingMode = window.APP_AUTH?.allowTestingMode === true;
  return mode === "testing" && allowTestingMode ? "testing" : "production";
};

window.getTestingAccounts = function () {
  return Array.isArray(window.APP_AUTH?.testingAccounts)
    ? window.APP_AUTH.testingAccounts
    : [];
};

window.getProfileDisplayName = function (profile) {
  if (!profile) return "Musyrif";
  return profile.given_name || profile.name || "Musyrif";
};

window.applyLoginModeUI = function () {
  const isTestingMode = window.getAuthMode() === "testing";
  const testingFields = document.getElementById("testing-credentials");
  const modeBadge = document.getElementById("login-mode-badge");
  const submitText = document.getElementById("login-submit-text");
  const googleModal = document.getElementById("modal-google-auth");

  if (testingFields) testingFields.classList.toggle("hidden", !isTestingMode);
  if (modeBadge) {
    modeBadge.classList.toggle("hidden", !isTestingMode);
    modeBadge.classList.toggle("inline-flex", isTestingMode);
  }
  if (submitText)
    submitText.textContent = isTestingMode
      ? "Masuk Dashboard (Testing)"
      : "Masuk Dashboard";
  if (googleModal && isTestingMode) googleModal.classList.add("hidden");
};

window.sha256Hex = async function (input) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

window.startAuthenticatedSession = function (targetClass, profile) {
  const authData = {
    kelas: targetClass,
    profile: profile,
    timestamp: new Date().toISOString(),
  };
  localStorage.setItem(APP_CONFIG.googleAuthKey, JSON.stringify(authData));

  appState.selectedClass = targetClass;
  appState.userProfile = profile;

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
  const authMode = window.getAuthMode();

  if (!kelas) return alert("Pilih kelas dulu!");

  if (window.googleBypassActive) {
    const classInfo = MASTER_KELAS[kelas];
    if (!classInfo) return window.showToast("Kelas tidak valid.", "error");

    const profileName = String(classInfo.musyrif || "Musyrif").trim();
    const profile = {
      name: profileName,
      given_name: profileName.split(/\s+/)[0] || "Musyrif",
      email: classInfo.email || "musyrif@testing.local",
      authProvider: "google",
    };

    window.startAuthenticatedSession(kelas, profile);
    window.showToast("Login bypass berhasil (Mode Testing)!", "success");
    return;
  }

  if (authMode === "testing") {
    try {
      const username = String(
        document.getElementById("login-username")?.value || "",
      )
        .trim()
        .toLowerCase();
      const password = String(
        document.getElementById("login-password")?.value || "",
      );
      if (!username || !password)
        return alert("Isi username & password testing!");
      if (!MASTER_KELAS[kelas])
        return window.showToast("Kelas tidak valid.", "error");

      const accounts = window.getTestingAccounts();
      const account = accounts.find((acc) => {
        if (!acc) return false;
        const accUser = String(acc.username || "")
          .trim()
          .toLowerCase();
        const accKelas = String(acc.kelas || "").trim();
        return accUser === username && accKelas === kelas;
      });

      if (!account || !account.passwordHash) {
        return window.showToast(
          "Akun testing tidak terdaftar untuk kelas ini.",
          "error",
        );
      }

      // Catatan: hash di sisi client ini hanya untuk mode testing lokal/non-produksi, bukan keamanan production.
      const inputHash = await window.sha256Hex(password);
      if (inputHash !== String(account.passwordHash).toLowerCase().trim()) {
        return window.showToast("Password testing salah.", "error");
      }

      const profileName = String(
        MASTER_KELAS[kelas].musyrif || username || "Musyrif",
      ).trim();
      const profile = {
        name: profileName,
        given_name: profileName.split(/\s+/)[0] || "Musyrif",
        email: account.email || `${username}@testing.local`,
        authProvider: "testing",
      };

      window.startAuthenticatedSession(kelas, profile);
      window.showToast("Login Testing Berhasil!", "success");
      return;
    } catch (err) {
      console.error("Testing login error:", err);
      return window.showToast("Gagal memproses login testing.", "error");
    }
  }

  // Simpan kelas sementara
  appState.tempClass = kelas;

  // Tampilkan Modal Google
  const modal = document.getElementById("modal-google-auth");
  document.getElementById("lbl-google-class").textContent = kelas;

  if (modal) {
    window.openModal("modal-google-auth");

    // Render Tombol Google
    if (window.google) {
      google.accounts.id.initialize({
        client_id: APP_CONFIG.googleClientId,
        callback: window.handleGoogleCallback,
      });
      google.accounts.id.renderButton(
        document.getElementById("google-btn-container"),
        { theme: "outline", size: "large", type: "standard" },
      );
    } else {
      alert("Gagal memuat Google. Cek koneksi internet.");
    }
  }
};

window.handleGoogleCallback = function (response) {
  try {
    const profile = window.parseJwt(response.credential);
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

    // 3. JIKA LOLOS -> SIMPAN SESI
    window.startAuthenticatedSession(targetClass, profile);
    window.closeModal("modal-google-auth");
    window.showToast("Login Berhasil!", "success");
  } catch (e) {
    console.error(e);
    window.showToast("Gagal memproses login Google.", "error");
  }
};

window.handleLogout = function () {
  if (!confirm("Keluar dari akun ini?")) return;

  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
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
};

const getGreetingTranslation = function (arabic, hour) {
  const isSore = hour >= 15 && hour < 18;
  const translations = {
    "صباح الخير": "Selamat Pagi ☀️",
    "صباح النور": "Pagi Penuh Cahaya ✨",
    "صباح الورد": "Pagi Penuh Bunga 🌹",
    "صباح الياسمين": "Pagi Penuh Melati 🌼",
    "طاب صباحك": "Semoga Pagimu Indah ☕",
    "أهلاً وسهلاً": "Selamat Datang 👋",
    "السلام عليكم": "Semoga Damai Bersamamu 🤝",
    "مرحباً بك": "Selamat Datang 🌟",
    "كيف حالك": "Bagaimana Kabarmu? 😊",
    "طاب يومك": "Semoga Harimu Menyenangkan ☀️",
    "مساء الورد": isSore ? "Sore Penuh Bunga 🌹" : "Malam Penuh Bunga 🌹",
    "مساء النور": isSore ? "Sore Penuh Cahaya ✨" : "Malam Penuh Cahaya ✨",
    "مساء الخير": isSore ? "Selamat Sore 🌙" : "Selamat Malam 🌙",
    "طابت ليلتك": "Semoga Malammu Nyaman 🌌",
    "ليلة سعيدة": "Malam yang Bahagia 😴"
  };
  return translations[arabic] || arabic;
};

window.startGreetingLoop = function () {
  const el = document.getElementById("dash-title-sub-greeting");
  if (!el) return;

  const activeGreetingKey = `${window.currentSessionGreeting || ""}:${window.currentSessionGreetingHour ?? ""}`;
  if (window.greetingLoopGreetingKey === activeGreetingKey && window.greetingIntervalId) {
    return;
  }
  window.greetingLoopGreetingKey = activeGreetingKey;

  if (window.greetingIntervalId) {
    clearTimeout(window.greetingIntervalId);
  }

  let showTranslation = true;

  function runStep() {
    const arabic = window.currentSessionGreeting || "صباح الخير";
    const hour = window.currentSessionGreetingHour !== undefined ? window.currentSessionGreetingHour : new Date().getHours();
    const translation = getGreetingTranslation(arabic, hour);

    // 1. Fade out with a small vertical drift for a softer language switch.
    el.style.transition = "opacity 420ms ease, transform 420ms ease";
    el.style.transform = "translateY(-4px)";
    el.classList.add("opacity-0");

    window.greetingIntervalId = setTimeout(() => {
      // Reset translation/scroll styles
      el.style.transition = "opacity 420ms ease, transform 420ms ease";
      el.style.transform = "";

      if (showTranslation) {
        // Set translation content
        el.textContent = translation;
        el.style.fontFamily = "";
        
        // Measure sizes
        const textWidth = el.scrollWidth;
        const parentWidth = el.parentElement.clientWidth || 150;

        // Fade back in
        el.classList.remove("opacity-0");

        if (textWidth > parentWidth) {
          // If translation is longer than the wrapper width, scroll it
          const distance = textWidth - parentWidth;
          const speed = 35; // Pixels per second
          const duration = distance / speed;

          // Wait 1 second of pause before starting to scroll
          window.greetingIntervalId = setTimeout(() => {
            el.style.transition = `transform ${duration}s linear`;
            el.style.transform = `translateX(-${distance}px)`;

            // Wait until the scroll finishes + 1.5 seconds pause at the end, then switch back to Arabic
            window.greetingIntervalId = setTimeout(() => {
              showTranslation = false;
              runStep();
            }, (duration + 1.5) * 1000);
          }, 1000);
        } else {
          // Shorter translations stay static for 4 seconds
          window.greetingIntervalId = setTimeout(() => {
            showTranslation = false;
            runStep();
          }, 4000);
        }
      } else {
        // Show Arabic greeting
        el.textContent = arabic;
        el.style.fontFamily = "'Rubik', sans-serif";

        // Fade back in
        el.classList.remove("opacity-0");

        window.greetingIntervalId = setTimeout(() => {
          showTranslation = true;
          runStep();
        }, 4000);
      }
    }, 500);
  }

  runStep();
};

window.updateDashboard = function () {
  // 1. Greeting
  const h = new Date().getHours();
  const greet =
    h < 11
      ? "Selamat Pagi"
      : h < 15
        ? "Selamat Siang"
        : h < 18
          ? "Selamat Sore"
          : "Selamat Malam";
  const elGreet = document.getElementById("dash-greeting");
  if (elGreet) elGreet.textContent = greet;

  // Dynamic Title Greeting (Islamic Arabic Greetings)
  const elTitleGreet = document.getElementById("dash-title-greeting");
  const elTitleSubGreet = document.getElementById("dash-title-sub-greeting");

  if (!window.currentSessionGreeting || window.currentSessionGreetingHour !== h) {
    // Determine greeting options based on the time range
    let greetingOptions = [];
    if (h >= 3 && h < 11) {
      greetingOptions = [
        "صباح الخير",
        "صباح النور",
        "صباح الورد",
        "صباح الياسمين",
        "طاب صباحك",
        "أهلاً وسهلاً",
        "السلام عليكم",
        "مرحباً بك"
      ];
    } else if (h >= 11 && h < 18) {
      greetingOptions = [
        "كيف حالك",
        "طاب يومك",
        "أهلاً وسهلاً",
        "السلام عليكم",
        "مرحباً بك"
      ];
      if (h >= 15) {
        greetingOptions.push("مساء الورد", "مساء النور");
      }
    } else {
      greetingOptions = [
        "مساء الخير",
        "طابت ليلتك",
        "ليلة سعيدة",
        "أهلاً وسهلاً",
        "السلام عليكم",
        "مرحباً بك"
      ];
    }
    const idx = Math.floor(Math.random() * greetingOptions.length);
    window.currentSessionGreeting = greetingOptions[idx];
    window.currentSessionGreetingHour = h;
  }

  let arabicGreet = window.currentSessionGreeting || "صباح الخير";

  if (elTitleSubGreet) {
    elTitleSubGreet.textContent = arabicGreet;
    elTitleSubGreet.style.fontFamily = "'Rubik', sans-serif";
    window.startGreetingLoop();
  }

  if (elTitleGreet) {
    let displayName = "Ustadz";
    if (appState.selectedClass && typeof MASTER_KELAS !== "undefined" && MASTER_KELAS[appState.selectedClass]) {
      const musyrifName = MASTER_KELAS[appState.selectedClass].musyrif;
      if (musyrifName && musyrifName !== "-") {
        // Bersihkan prefix gelar "Ustadz", "Ustad", "Ust.", "Ust"
        const cleanName = musyrifName.replace(/^(ustadz|ustad|ust\.|ust\b)/i, "").trim();
        const words = cleanName.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 0) {
          displayName = "Ustadz " + words.slice(0, 2).join(" ");
        }
      }
    }
    const nameMarqueeClass = displayName.length > 24 ? "dashboard-name-marquee" : "";
    elTitleGreet.innerHTML = `<span class="dashboard-name-wrap"><span class="dashboard-name-text ${nameMarqueeClass} text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-teal-500 dark:from-emerald-400 dark:to-teal-300 font-black">${displayName}!</span></span>`;
  }

  // 2. Main Card Logic
  const isToday = appState.date === window.getLocalDateStr();
  const mainCard = document.getElementById("dash-main-card");

  if (mainCard) {
    mainCard.classList.remove("hidden");
    const heroSlotId = window.getCurrentDashboardSlotId
      ? window.getCurrentDashboardSlotId(appState.date)
      : appState.currentSlotId;
    appState.currentSlotId = heroSlotId;
    const slot = SLOT_WAKTU[heroSlotId];
    document.getElementById("dash-card-title").textContent = slot.label;

    // Update badge dynamically based on whether it is today's date
    const badgeDot = document.getElementById("dash-card-badge-dot");
    const badgeText = document.getElementById("dash-card-badge-text");
    if (badgeDot && badgeText) {
      if (isToday) {
        badgeDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse";
        badgeText.textContent = window.getDashboardDateBadgeLabel(appState.date);
      } else {
        badgeDot.className = "w-1.5 h-1.5 rounded-full bg-amber-400";
        badgeText.textContent = window.getDashboardDateBadgeLabel(appState.date);
      }
    }

    // Static solid color mapping for the hero card (always bg-slate-900 and dark:bg-black)
    const solidMap = {
      shubuh: ["bg-slate-900", "dark:bg-black"],
      sekolah: ["bg-slate-900", "dark:bg-black"],
      ashar: ["bg-slate-900", "dark:bg-black"],
      maghrib: ["bg-slate-900", "dark:bg-black"],
      isya: ["bg-slate-900", "dark:bg-black"]
    };

    // Remove any previous gradient/solid background classes
    mainCard.classList.remove(
      "bg-slate-900", "dark:bg-black", "bg-gradient-to-br",
      "from-teal-800", "to-emerald-700", "dark:from-teal-950", "dark:to-emerald-900",
      "from-cyan-800", "to-blue-700", "dark:from-cyan-950", "dark:to-blue-900",
      "from-orange-700", "to-amber-600", "dark:from-orange-950", "dark:to-amber-900",
      "from-indigo-800", "to-purple-700", "dark:from-indigo-950", "dark:to-purple-900",
      "from-slate-800", "to-zinc-900", "dark:from-slate-950", "dark:to-black",
      "from-slate-900", "to-black",
      "from-slate-900", "via-teal-950/95", "to-emerald-950/90", "dark:from-black", "dark:via-teal-950/80", "dark:to-black",
      "from-slate-900", "via-blue-950/95", "to-indigo-950/90", "dark:from-black", "dark:via-blue-950/80", "dark:to-black",
      "from-slate-900", "via-orange-950/90", "to-amber-950/90", "dark:from-black", "dark:via-orange-950/80", "dark:to-black",
      "from-slate-900", "via-indigo-950/95", "to-purple-950/90", "dark:from-black", "dark:via-indigo-950/80", "dark:to-black",
      "from-slate-900", "via-slate-800/95", "to-zinc-900/90", "dark:from-black", "dark:via-slate-900/80", "dark:to-black",
      "bg-emerald-900", "dark:bg-emerald-950",
      "bg-blue-900", "dark:bg-blue-950",
      "bg-orange-900", "dark:bg-orange-950",
      "bg-indigo-900", "dark:bg-indigo-950",
      "bg-slate-900", "dark:bg-slate-950",
      "bg-emerald-950", "bg-cyan-950", "bg-orange-950", "bg-indigo-950", "bg-slate-950"
    );

    // Add current slot solid classes
    const currentClasses = solidMap[appState.currentSlotId] || ["bg-slate-950"];
    mainCard.classList.add(...currentClasses);

    const access = window.isSlotAccessible(
      appState.currentSlotId,
      appState.date,
    );
    const isHoliday = window.isSlotHoliday(appState.currentSlotId, appState.date);
    const timeEl = document.getElementById("dash-card-time");
    const heroActionBtn = mainCard.querySelector("button");

    if (isHoliday) {
      mainCard.classList.add("opacity-80", "grayscale");
      if (badgeDot && badgeText) {
        badgeDot.className = "w-1.5 h-1.5 rounded-full bg-slate-300";
        badgeText.textContent = "Libur";
      }
      if (timeEl) {
        timeEl.innerHTML = `<i data-lucide="calendar-x" class="w-3 h-3"></i> Libur hari ini`;
      }
      if (heroActionBtn) {
        heroActionBtn.className =
          "w-14 h-14 rounded-2xl bg-white/20 text-white/70 flex items-center justify-center shadow-sm border border-white/10 cursor-not-allowed transition-all duration-300 group/btn";
        heroActionBtn.onclick = (event) => {
          event.stopPropagation();
          window.showToast(`Kegiatan ${slot.label} libur pada hari ini.`, "info");
        };
      }
      mainCard.onclick = () =>
        window.showToast(`Kegiatan ${slot.label} libur pada hari ini.`, "info");
    } else if (access.locked) {
      mainCard.classList.add("opacity-80", "grayscale");
      if (heroActionBtn) {
        heroActionBtn.className =
          "w-14 h-14 rounded-2xl bg-white/20 text-white/70 flex items-center justify-center shadow-sm border border-white/10 transition-all duration-300 group/btn";
      }
      if (access.reason === "wait") {
        timeEl.innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> Belum Masuk Waktu`;
        mainCard.onclick = () => window.showToast("Belum masuk waktu " + slot.label, "warning");
      } else if (access.reason === "limit") {
        timeEl.innerHTML = `<i data-lucide="lock" class="w-3 h-3"></i> Terkunci (Lampau)`;
        mainCard.onclick = () => window.showToast("Data lampau (>3 hari) terkunci", "warning");
      } else if (access.reason === "future") {
        timeEl.innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> Belum Masuk Waktu`;
        mainCard.onclick = () => window.showToast("Belum bisa mengisi tanggal masa depan", "warning");
      } else {
        timeEl.innerHTML = `<i data-lucide="lock" class="w-3 h-3"></i> Terkunci`;
        mainCard.onclick = () => window.showToast("Akses dibatasi", "warning");
      }
    } else {
      timeEl.innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> ${slot.subLabel}`;
      mainCard.classList.remove("opacity-80", "grayscale");
      if (heroActionBtn) {
        heroActionBtn.className =
          "w-14 h-14 rounded-2xl bg-white text-slate-900 flex items-center justify-center shadow-lg shadow-white/10 hover:scale-110 hover:rotate-3 active:scale-95 transition-all duration-300 group/btn";
        heroActionBtn.onclick = (event) => {
          event.stopPropagation();
          window.openAttendance();
        };
      }
      mainCard.onclick = () => window.openAttendance();
    }
  }

  // 3. Render List Slot
  if (typeof window.updateQuickAccessButtons === "function") {
    window.updateQuickAccessButtons();
  }
  window.renderSchoolStatsWidget();
  window.renderSlotList();
  window.renderKBMBanner();
  window.renderActivePermitsWidget();

  window.renderDashboardPembinaan(); // Refresh widget pembinaan

  // 4. Update Stats Chart
  window.updateQuickStats();
  window.drawDonutChart();
  if (window.lucide) window.lucide.createIcons();

  window.updateLocationStatus();
  if (window.initSalatHijriWidget) {
    window.initSalatHijriWidget().catch(err => console.error("Gagal update salat widget:", err));
  }
};

// ==========================================
// FITUR STATUS LOKASI DASHBOARD
// ==========================================

window.gpsBypassEnabled = false;
window.gpsTestMode = "off";
window.asramaNavigationTestEnabled = false;
let locationCardClickCount = 0;
let locationCardClickTimeout;
window.handleLocationCardClick = function () {
  locationCardClickCount++;
  clearTimeout(locationCardClickTimeout);

  if (locationCardClickCount >= 5) {
    if (window.gpsTestMode === "off") {
      window.gpsTestMode = "bypass";
      window.gpsBypassEnabled = true;
      window.asramaNavigationTestEnabled = false;
      window.showToast("Bypass GPS Aktif (Mode Testing)", "warning");
    } else if (window.gpsTestMode === "bypass") {
      window.gpsTestMode = "asrama";
      window.gpsBypassEnabled = false;
      window.asramaNavigationTestEnabled = true;
      localStorage.removeItem(GPS_CACHE_KEY);
      window.showToast("Testing Ke Asrama Aktif", "warning");
    } else {
      window.gpsTestMode = "off";
      window.gpsBypassEnabled = false;
      window.asramaNavigationTestEnabled = false;
      localStorage.removeItem(GPS_CACHE_KEY);
      window.showToast("Mode Testing GPS Dinonaktifkan", "info");
    }
    locationCardClickCount = 0;
    window.updateLocationStatus();
    return;
  }

  if (locationCardClickCount >= 5) {
    window.gpsBypassEnabled = !window.gpsBypassEnabled;
    locationCardClickCount = 0;
    if (window.gpsBypassEnabled) {
      window.showToast("Bypass GPS Aktif (Mode Testing) ⚠️", "warning");
    } else {
      window.showToast("Bypass GPS Dinonaktifkan", "info");
    }
    window.updateLocationStatus();
  } else {
    locationCardClickTimeout = setTimeout(() => {
      locationCardClickCount = 0;
    }, 2000);
  }
};

window.updateLocationStatus = function () {
  const card = document.getElementById("location-status-card");

  // Jika fitur dimatikan di config, sembunyikan kartu
  if (!GEO_CONFIG.useGeofencing) {
    if (card) card.classList.add("hidden");
    return;
  }

  if (card) card.classList.remove("hidden");

  // Jika bypass aktif, tunjukkan status bypass khusus
  if (window.gpsBypassEnabled) {
    const elLoading = document.getElementById("loc-loading");
    const elDetails = document.getElementById("loc-details");
    const elNearest = document.getElementById("loc-nearest-name");
    const elDistance = document.getElementById("loc-distance");
    const elBadge = document.getElementById("loc-badge");
    const elStatusWrapper = document.getElementById("loc-status-wrapper");
    const elIcon = document.getElementById("loc-icon");
    const elIconBg = document.getElementById("loc-icon-bg");
    const elError = document.getElementById("loc-error");
    const elAsramaBtn = document.getElementById("loc-asrama-btn");

    if (elLoading) elLoading.classList.add("hidden");
    if (elError) elError.classList.add("hidden");
    if (elDetails) elDetails.classList.remove("hidden");
    if (elStatusWrapper) elStatusWrapper.classList.remove("hidden");
    if (elAsramaBtn) {
      elAsramaBtn.classList.add("hidden");
      elAsramaBtn.classList.remove("flex");
    }
    if (elNearest) elNearest.textContent = "Bypass GPS Aktif";
    if (elDistance) elDistance.textContent = "0m";
    if (elBadge) {
      elBadge.textContent = "TESTING";
      elBadge.className = "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 shrink-0";
    }
    if (elIcon) {
      elIcon.setAttribute("data-lucide", "shield-alert");
      elIcon.className = "text-amber-500 dark:text-amber-400 transition-colors duration-500";
    }
    if (elIconBg) {
      elIconBg.className = "w-6 h-6 shrink-0 rounded-full bg-amber-100/80 dark:bg-amber-900/50 flex items-center justify-center text-amber-500 dark:text-amber-400 transition-colors duration-500";
    }
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  if (window.gpsTestMode === "asrama") {
    const elLoading = document.getElementById("loc-loading");
    const elDetails = document.getElementById("loc-details");
    const elNearest = document.getElementById("loc-nearest-name");
    const elDistance = document.getElementById("loc-distance");
    const elBadge = document.getElementById("loc-badge");
    const elStatusWrapper = document.getElementById("loc-status-wrapper");
    const elIcon = document.getElementById("loc-icon");
    const elIconBg = document.getElementById("loc-icon-bg");
    const elError = document.getElementById("loc-error");
    const elAsramaBtn = document.getElementById("loc-asrama-btn");
    const target = window.APP_LOCATION?.geofenceLocations?.[0];
    const testDistance = Math.max((window.APP_LOCATION?.maxRadiusMeters || 50) + 180, 230);

    if (elLoading) elLoading.classList.add("hidden");
    if (elError) elError.classList.add("hidden");
    if (elDetails) elDetails.classList.remove("hidden");
    if (elStatusWrapper) elStatusWrapper.classList.remove("hidden");
    if (elNearest) elNearest.textContent = target?.name ? `Test: ${target.name}` : "Test: Asrama";
    if (elDistance) elDistance.textContent = `${testDistance}m`;
    if (elBadge) {
      elBadge.textContent = "TEST JAUH";
      elBadge.className = "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 shrink-0";
    }
    if (elAsramaBtn) {
      elAsramaBtn.classList.remove("hidden");
      elAsramaBtn.classList.add("flex");
    }
    if (elIcon) {
      elIcon.setAttribute("data-lucide", "navigation");
      elIcon.className = "text-rose-500 dark:text-rose-400 transition-colors duration-500";
    }
    if (elIconBg) {
      elIconBg.className = "w-6 h-6 shrink-0 rounded-full bg-rose-100/80 dark:bg-rose-900/50 flex items-center justify-center text-rose-500 dark:text-rose-400 transition-colors duration-500";
    }
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const cached = window.getCachedLocation();

  if (cached) {
    const elLoading = document.getElementById("loc-loading");
    const elDetails = document.getElementById("loc-details");
    const elNearest = document.getElementById("loc-nearest-name");
    const elDistance = document.getElementById("loc-distance");
    const elBadge = document.getElementById("loc-badge");
    const elStatusWrapper = document.getElementById("loc-status-wrapper");
    const elIcon = document.getElementById("loc-icon");
    const elIconBg = document.getElementById("loc-icon-bg");

    if (elLoading) elLoading.classList.add("hidden");
    if (elDetails) elDetails.classList.remove("hidden");
    if (elStatusWrapper) elStatusWrapper.classList.remove("hidden");
    if (elNearest) elNearest.textContent = cached.locationName;
    if (elDistance) elDistance.textContent = Math.round(cached.distance) + "m";

    if (elBadge) {
      if (cached.isInside) {
        elBadge.textContent = "Aman";
        elBadge.className = "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-palette-mint/10 text-slate-800 dark:text-palette-mint border border-palette-mint/30 shrink-0";
      } else {
        elBadge.textContent = "Jauh";
        elBadge.className = "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 shrink-0";
      }
    }

    if (cached.isInside) {
      if (elIcon) {
        elIcon.setAttribute("data-lucide", "map-pin");
        elIcon.className = "text-palette-blue dark:text-palette-cyan transition-colors duration-500";
      }
      if (elIconBg) {
        elIconBg.className = "w-6 h-6 shrink-0 rounded-full bg-palette-blue/10 dark:bg-palette-blue/20 flex items-center justify-center text-palette-blue dark:text-palette-cyan transition-colors duration-500";
      }
    } else {
      if (elIcon) {
        elIcon.setAttribute("data-lucide", "map-pin-off");
        elIcon.className = "text-red-500 dark:text-red-400 transition-colors duration-500";
      }
      if (elIconBg) {
        elIconBg.className = "w-6 h-6 shrink-0 rounded-full bg-red-100/80 dark:bg-red-900/50 flex items-center justify-center text-red-500 dark:text-red-400 transition-colors duration-500";
      }
    }

    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Ambil Elemen UI
  const elLoading = document.getElementById("loc-loading");
  const elDetails = document.getElementById("loc-details");
  const elError = document.getElementById("loc-error");

  const elNearest = document.getElementById("loc-nearest-name");
  const elDistance = document.getElementById("loc-distance");
  const elBadge = document.getElementById("loc-badge");
  const elStatusWrapper = document.getElementById("loc-status-wrapper");
  const elMessage = document.getElementById("loc-message");
  const elIcon = document.getElementById("loc-icon");
  const elIconBg = document.getElementById("loc-icon-bg");
  const elAsramaBtn = document.getElementById("loc-asrama-btn");

  // Reset Tampilan ke Loading
  if (elLoading) elLoading.classList.remove("hidden");
  if (elDetails) elDetails.classList.add("hidden");
  if (elError) elError.classList.add("hidden");
  if (elStatusWrapper) elStatusWrapper.classList.add("hidden");
  if (elAsramaBtn) {
    elAsramaBtn.classList.add("hidden");
    elAsramaBtn.classList.remove("flex");
  }

  // Cek Support Browser
  if (!navigator.geolocation) {
    if (elLoading) elLoading.classList.add("hidden");
    if (elError) {
      elError.classList.remove("hidden");
      elError.innerHTML =
        '<p class="text-[10px] font-bold text-red-500">Browser tidak dukung GPS</p>';
    }
    if (elBadge) {
      elBadge.textContent = "Tdk Ditempat";
      elBadge.className = "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0";
    }
    if (elStatusWrapper) elStatusWrapper.classList.remove("hidden");
    return;
  }

  // Eksekusi GPS
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      let nearestDist = Infinity;
      let nearestName = "Tidak diketahui";
      let isInside = false;

      // 1. Cari Lokasi Terdekat dari Array GEO_CONFIG
      GEO_CONFIG.locations.forEach((loc) => {
        const dist = window.getDistanceFromLatLonInMeters(
          userLat,
          userLng,
          loc.lat,
          loc.lng,
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestName = loc.name;
        }
      });

      // 2. Cek apakah masuk radius
      if (nearestDist <= GEO_CONFIG.maxRadiusMeters) {
        isInside = true;
      }

      localStorage.setItem(
        GPS_CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          distance: nearestDist,
          locationName: nearestName,
          isInside: isInside,
        }),
      );

      // 3. Update Tampilan
      if (elLoading) elLoading.classList.add("hidden");
      if (elDetails) elDetails.classList.remove("hidden");
      const elStatusWrapper = document.getElementById("loc-status-wrapper");
      if (elStatusWrapper) elStatusWrapper.classList.remove("hidden");

      if (elNearest) elNearest.textContent = nearestName;
      if (elDistance) elDistance.textContent = Math.round(nearestDist) + "m";

      if (isInside) {
        if (elAsramaBtn) {
          elAsramaBtn.classList.add("hidden");
          elAsramaBtn.classList.remove("flex");
        }
        // Tampilan HIJAU (Aman)
        if (elBadge) {
          elBadge.textContent = "Aman";
          elBadge.className =
            "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-palette-mint/10 text-slate-800 dark:text-palette-mint border border-palette-mint/30 shrink-0";
        }

        if (elMessage) {
          elMessage.innerHTML = `<span class="text-palette-blue flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Posisi sesuai. Silakan isi presensi.</span>`;
        }

        if (elIcon) {
          elIcon.setAttribute("data-lucide", "map-pin");
          elIcon.className = "text-palette-blue dark:text-palette-cyan transition-colors duration-500";
        }

        if (elIconBg) {
          elIconBg.className = "w-6 h-6 shrink-0 rounded-full bg-palette-blue/10 dark:bg-palette-blue/20 flex items-center justify-center text-palette-blue dark:text-palette-cyan transition-colors duration-500";
        }
      } else {
        if (elAsramaBtn) {
          elAsramaBtn.classList.remove("hidden");
          elAsramaBtn.classList.add("flex");
        }
        // Tampilan MERAH (Jauh)
        if (elBadge) {
          elBadge.textContent = "Jauh";
          elBadge.className =
            "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 shrink-0";
        }

        const selisih = Math.round(nearestDist - GEO_CONFIG.maxRadiusMeters);
        if (elMessage) {
          elMessage.innerHTML = `<span class="text-red-500 flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Terlalu jauh ${selisih}m dari batas radius.</span>`;
        }

        if (elIcon) {
          elIcon.setAttribute("data-lucide", "map-pin-off");
          elIcon.className = "text-red-500 dark:text-red-400 transition-colors duration-500";
        }

        if (elIconBg) {
          elIconBg.className = "w-6 h-6 shrink-0 rounded-full bg-red-100/80 dark:bg-red-900/50 flex items-center justify-center text-red-500 dark:text-red-400 transition-colors duration-500";
        }
      }

      if (window.lucide) window.lucide.createIcons();
    },
    (error) => {
      if (elLoading) elLoading.classList.add("hidden");
      if (elError) {
        elError.classList.remove("hidden");
        let msg = "Gagal deteksi lokasi.";
        if (error.code === 1) msg = "Izin lokasi ditolak.";
        else if (error.code === 2) msg = "Sinyal GPS lemah.";
        else if (error.code === 3) msg = "Waktu GPS habis.";
        elError.innerHTML = `<p class="text-[10px] font-bold text-red-500 leading-tight">${msg}</p>`;
      }
      const elBadge = document.getElementById("loc-badge");
      const elStatusWrapper = document.getElementById("loc-status-wrapper");
      if (elBadge) {
        elBadge.textContent = "Tdk Ditempat";
        elBadge.className = "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0";
      }
      if (elStatusWrapper) elStatusWrapper.classList.remove("hidden");
      const elAsramaBtn = document.getElementById("loc-asrama-btn");
      if (elAsramaBtn) {
        elAsramaBtn.classList.add("hidden");
        elAsramaBtn.classList.remove("flex");
      }
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: GPS_CACHE_DURATION },
  );
};

window.renderSlotList = function () {
  const container = document.getElementById("dash-other-slots");
  if (!container) return;

  container.innerHTML = "";
  const tpl = document.getElementById("tpl-slot-item");
  const tplWide = document.getElementById("tpl-slot-item-wide");
  const isToday = appState.date === window.getLocalDateStr();
  const fragment = document.createDocumentFragment();

  // Custom ordering: Shubuh & Ashar side-by-side, Sekolah below, Maghrib & Isya side-by-side
  const renderOrder = ["shubuh", "ashar", "sekolah", "maghrib", "isya"];

  renderOrder.forEach((slotId) => {
    const s = SLOT_WAKTU[slotId];
    if (!s) return;
    if (s.id === "sekolah" && window.isSlotHoliday(s.id, appState.date)) {
      return;
    }

    const activeTpl = (s.id === "sekolah" && tplWide) ? tplWide : tpl;
    const clone = activeTpl.content.cloneNode(true);
    const item = clone.querySelector(".slot-item");
    const access = window.isSlotAccessible(s.id, appState.date);
    const stats = window.calculateSlotStats(s.id);
    const slotData = appState.attendanceData?.[appState.date]?.[s.id];
    const isPresenceInProgress =
      slotData?.__requiresReview === true &&
      slotData?.__reviewConfirmed !== true;

    const iconContainer = clone.querySelector(".slot-icon-bg");
    const iconEl = clone.querySelector(".slot-icon");
    const badge = clone.querySelector(".slot-status-badge");
    const progressBar = clone.querySelector(".slot-progress-bar");
    const progressStatusEl = clone.querySelector(".slot-progress-status");
    const progressTextEl = clone.querySelector(".slot-progress-text");

    // Populate the standard labels and static times
    clone.querySelector(".slot-label").textContent = s.label;
    const timeEl = clone.querySelector(".slot-time-range");
    if (timeEl) timeEl.textContent = s.subLabel;

    // Reset item classes using correct grid layout columns
    item.className = "slot-item flex flex-col p-3.5 sm:p-4 rounded-3xl border cursor-pointer transition-all duration-300 group relative overflow-hidden " +
      (s.id === "sekolah" ? "col-span-2" : "col-span-1");

    // Calculate duration-based progress
    let timeProgressPercent = 0;
    const todayStr = window.getLocalDateStr();
    if (appState.date < todayStr) {
      timeProgressPercent = 100;
    } else if (appState.date > todayStr) {
      timeProgressPercent = 0;
    } else {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const match = s.subLabel.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
      if (match) {
        const startMins = parseInt(match[1]) * 60 + parseInt(match[2]);
        const endMins = parseInt(match[3]) * 60 + parseInt(match[4]);
        if (currentMinutes >= endMins) {
          timeProgressPercent = 100;
        } else if (currentMinutes >= startMins) {
          const totalDuration = endMins - startMins;
          const elapsed = currentMinutes - startMins;
          timeProgressPercent = Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100)));
        }
      }
    }

    if (progressBar) {
      progressBar.style.width = `${timeProgressPercent}%`;
    }

    const isHoliday = window.isSlotHoliday(s.id, appState.date);

    // Style according to state
    if (isHoliday) {
      // 1. STATUS: LIBUR (Muted Gray Card)
      item.classList.add("bg-slate-100/40", "dark:bg-slate-800/20", "border-slate-200/60", "dark:border-slate-800/40", "text-slate-400", "dark:text-slate-500", "grayscale", "opacity-70");
      if (iconContainer) iconContainer.className = "slot-icon-bg w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50 bg-slate-200/30 dark:bg-slate-700/30 text-slate-400 dark:text-slate-500 shrink-0";
      if (iconEl) iconEl.setAttribute("data-lucide", "calendar-x");
      
      badge.textContent = "Libur";
      badge.className = "slot-status-badge text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-200/50 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400";
      
      if (progressBar) {
        progressBar.className = "slot-progress-bar h-full rounded-full bg-slate-300 dark:bg-slate-700 transition-all duration-500";
        progressBar.style.backgroundColor = "";
      }

      if (progressStatusEl) progressStatusEl.textContent = "Libur";
      if (progressTextEl) progressTextEl.textContent = "0%";

    } else if (access.locked) {
      // 2. STATUS: TERKUNCI / MENUNGGU (Muted Faded Lock Card)
      item.classList.add("bg-slate-100/60", "dark:bg-slate-800/40", "border-slate-200", "dark:border-slate-700/60", "text-slate-400", "dark:text-slate-500", "opacity-75");
      if (iconContainer) iconContainer.className = "slot-icon-bg w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50 bg-slate-200/50 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 shrink-0";
      if (iconEl) iconEl.setAttribute("data-lucide", access.reason === "wait" ? s.style.icon : "lock");
      
      let lockText = access.reason === "wait" ? "Menunggu" : "Terkunci";
      if (access.reason === "limit") lockText = "Expired";
      
      badge.textContent = lockText;
      badge.className = "slot-status-badge text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-200/50 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400";
      
      if (progressBar) {
        progressBar.className = "slot-progress-bar h-full rounded-full bg-slate-400 dark:bg-slate-600 transition-all duration-500";
        progressBar.style.backgroundColor = "";
      }

      if (progressStatusEl) progressStatusEl.textContent = lockText;
      if (progressTextEl) progressTextEl.textContent = lockText === "Expired" ? "100%" : "0%";

    } else {
      // 3. STATUS: AKTIF (Rich Solid Session Background Theme)
      const themeSolidClasses = {
        emerald: "bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-950 dark:to-teal-900/80 text-white border-emerald-500/30 shadow-[0_8px_25px_rgba(16,185,129,0.12)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(16,185,129,0.2)]",
        cyan: "bg-gradient-to-br from-sky-500 to-indigo-600 dark:from-sky-950 dark:to-indigo-900/80 text-white border-sky-500/30 shadow-[0_8px_25px_rgba(14,165,233,0.12)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(14,165,233,0.2)]",
        orange: "bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-950 dark:to-orange-900/80 text-white border-amber-500/30 shadow-[0_8px_25px_rgba(245,158,11,0.12)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(245,158,11,0.2)]",
        indigo: "bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-950 dark:to-purple-900/80 text-white border-indigo-500/30 shadow-[0_8px_25px_rgba(99,102,241,0.12)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(99,102,241,0.2)]",
        slate: "bg-gradient-to-br from-slate-600 to-slate-700 dark:from-slate-800 dark:to-slate-900 text-white border-slate-500/30 shadow-[0_8px_25px_rgba(100,116,139,0.12)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(100,116,139,0.2)]"
      };

      item.classList.add(...(themeSolidClasses[s.theme] || themeSolidClasses.emerald).split(" "));

      if (iconContainer) {
        iconContainer.className = "slot-icon-bg w-10 h-10 rounded-xl flex items-center justify-center border border-white/20 bg-white/25 text-white group-hover:scale-105 transition-transform shrink-0";
      }
      if (iconEl) iconEl.setAttribute("data-lucide", s.style.icon);

      if (progressStatusEl) {
        if (timeProgressPercent === 100) {
          progressStatusEl.textContent = "Selesai";
        } else if (timeProgressPercent > 0) {
          progressStatusEl.textContent = "Sesi Berjalan";
        } else {
          progressStatusEl.textContent = "Mulai";
        }
      }
      if (progressTextEl) {
        progressTextEl.textContent = `${timeProgressPercent}%`;
      }

      const isCurrentRunningSlot = isToday && s.id === window.determineCurrentSlot();
      if (stats.isFilled) {
        badge.innerHTML = `<span class="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check text-current"><path d="M20 6 9 17l-5-5"/></svg>
          Selesai
        </span>`;
        badge.className = "slot-status-badge text-[9px] font-black px-2 py-0.5 rounded-full bg-white/90 text-emerald-950 border border-white/30 shadow-sm";
      } else if (isPresenceInProgress) {
        badge.innerHTML = `<span class="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Proses
        </span>`;
        badge.className = "slot-status-badge text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-white border border-amber-300 shadow-md";
      } else if (isCurrentRunningSlot) {
        badge.innerHTML = `<span class="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-unlock text-current"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
          Terbuka
        </span>`;
        badge.className = "slot-status-badge text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white border border-emerald-400 shadow-md";
      } else {
        badge.innerHTML = `<span class="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x text-current"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          Belum Diisi
        </span>`;
        badge.className = "slot-status-badge text-[9px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white border border-red-500 shadow-md";
      }

      if (progressBar) {
        progressBar.className = "slot-progress-bar h-full rounded-full bg-gradient-to-r from-white/70 to-white animate-pulse-subtle transition-all duration-500 shadow-[0_0_8px_rgba(255,255,255,0.8)]";
        progressBar.style.backgroundColor = "";
      }

      const hasNonHStats = (stats.t > 0 || stats.s > 0 || stats.i > 0 || stats.p > 0 || stats.a > 0);
      const statsContainer = clone.querySelector(".slot-card-stats");
      if (statsContainer) {
        if (hasNonHStats) {
          statsContainer.innerHTML = `
            <div class="flex flex-wrap sm:flex-nowrap gap-0.5 mt-0.5 justify-end max-w-[52px] sm:max-w-none">
              ${stats.t > 0 ? `<span class="flex items-center justify-center w-4 h-4 rounded-full bg-cyan-500 text-white shadow-sm" title="Telat: ${stats.t}"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="text-current"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg></span>` : ''}
              ${stats.s > 0 ? `<span class="flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 text-white shadow-sm" title="Sakit: ${stats.s}"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="text-current"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span>` : ''}
              ${stats.i > 0 ? `<span class="flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white shadow-sm" title="Izin: ${stats.i}"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="text-current"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg></span>` : ''}
              ${stats.p > 0 ? `<span class="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500 text-white shadow-sm" title="Pulang: ${stats.p}"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="text-current"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>` : ''}
              ${stats.a > 0 ? `<span class="flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white shadow-sm" title="Alpa: ${stats.a}"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" class="text-current"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"/></svg></span>` : ''}
            </div>
          `;
          statsContainer.classList.remove("hidden");
        } else {
          statsContainer.innerHTML = "";
          statsContainer.classList.add("hidden");
        }
      }
    }

    // Open detail for active slots; holiday cards answer immediately.
    item.onclick = () => {
      if (isHoliday) {
        return window.showToast(`Kegiatan ${s.label} libur pada hari ini.`, "info");
      }
      window.openBentoModal(s, access, stats);
    };

    fragment.appendChild(clone);
  });

  container.appendChild(fragment);
};
window.updateProfileInfo = function () {
  const elHeaderName = document.getElementById("header-user-name");
  const elHeaderRole = document.getElementById("profile-role");
  const elHeaderAvatar = document.getElementById("header-avatar");
  const elProfileAvatar = document.getElementById("profile-avatar");

  const elName = document.getElementById("profile-name");
  const elRoleTab = document.getElementById("profile-role-tab");

  if (appState.selectedClass && MASTER_KELAS[appState.selectedClass]) {
    const musyrifName = MASTER_KELAS[appState.selectedClass].musyrif;
    const className = appState.selectedClass;

    if (elHeaderName) elHeaderName.textContent = musyrifName.split(" ")[0];
    if (elHeaderRole) elHeaderRole.textContent = className;

    if (elHeaderAvatar) {
      const photoUrl = appState.userProfile?.picture;

      if (photoUrl) {
        elHeaderAvatar.innerHTML = `
                    <img
                        src="${photoUrl}"
                        alt="Avatar"
                        class="w-full h-full rounded-full object-cover"
                    >
                `;
      } else {
        const initials = musyrifName
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        elHeaderAvatar.textContent = initials;
      }
    }

    if (elProfileAvatar) {
      const photoUrl = appState.userProfile?.picture;

      if (photoUrl) {
        elProfileAvatar.innerHTML = `
                    <img
                        src="${photoUrl}"
                        alt="Avatar"
                        class="w-full h-full object-cover"
                    >
                `;
      } else {
        elProfileAvatar.innerHTML = `
                    <i data-lucide="user" class="w-10 h-10"></i>
                `;
      }
    }

    if (window.lucide) {
      lucide.createIcons();
    }

    if (elName) elName.textContent = musyrifName;
    if (elRoleTab) elRoleTab.textContent = `Musyrif ${className}`;

    const elSidebarName = document.getElementById("sidebar-user-name");
    const elSidebarClass = document.getElementById("sidebar-class-name");
    const elSidebarAvatar = document.getElementById("sidebar-avatar");
    if (elSidebarName) elSidebarName.textContent = musyrifName;
    if (elSidebarClass) elSidebarClass.textContent = `Musyrif ${className}`;
    if (elSidebarAvatar) {
      const photoUrl = appState.userProfile?.picture;

      if (photoUrl) {
        elSidebarAvatar.innerHTML = `
                    <img
                        src="${photoUrl}"
                        alt="Avatar"
                        class="w-full h-full rounded-full object-cover"
                    >
                `;
      } else {
        const initials = musyrifName
          .split(" ")
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        elSidebarAvatar.textContent = initials;
      }
    }
  }
};

// ==========================================
// 4. LOGIC PERHITUNGAN (REFACTORED)
// ==========================================

window.isHoliday = function (
  dateStr,
  slotId = null,
  activityId = null,
  category = null,
) {
  const holidays = appState.holidays || [];
  return (
    holidays.find((h) => {
      if (h.date !== dateStr) return false;
      if (h.type === "activity" && activityId) {
        return h.activityId === activityId;
      }
      if (h.type === "slot" && slotId) {
        return h.slotId === slotId;
      }
      if (h.type === "category" && category) {
        return h.category === category;
      }
      return false;
    }) || null
  );
};

window.isActivityHoliday = function (dateStr, slotId, activityId) {
  return !!window.isHoliday(dateStr, slotId, activityId);
};

window.isCategoryHoliday = function (dateStr, category) {
  return !!window.isHoliday(dateStr, null, null, category);
};

window.isSlotHoliday = function (slotId, dateStr) {
  const slotHoliday = window.isHoliday(dateStr, slotId);
  if (slotHoliday) {
    return true;
  }
  const dayNum = new Date(dateStr).getDay();
  const slotConfig = SLOT_WAKTU[slotId];
  if (!slotConfig || !slotConfig.activities) {
    return true;
  }
  const activeActs = slotConfig.activities.filter((act) => {
    if (window.isActivityHoliday(dateStr, slotId, act.id)) {
      return false;
    }
    if (window.isCategoryHoliday(dateStr, act.category)) {
      return false;
    }
    if (act.showOnDays && !act.showOnDays.includes(dayNum)) return false;
    if (act.onlyRamadhan && !window.isRamadhan(dateStr)) return false;
    return true;
  });
  return activeActs.length === 0;
};

window.calculateSlotStats = function (slotId, customDate = null) {
  const stats = {
    h: 0,
    t: 0,
    i: 0,
    s: 0,
    p: 0,
    a: 0,
    total: 0,
    isFilled: false,
  };

  // Cegah error jika data santri belum siap
  if (!FILTERED_SANTRI || FILTERED_SANTRI.length === 0) return stats;

  const dateKey = customDate || appState.date;

  // JIKA LIBUR, otomatis kembalikan angka 0 (Progress Bar akan kosong/aman)
  if (window.isSlotHoliday(slotId, dateKey)) return stats;

  const slotData = appState.attendanceData[dateKey]?.[slotId];
  if (!slotData) return stats;

  const dayNum = new Date(dateKey).getDay();
  const slotConfig = SLOT_WAKTU[slotId];

  const mainAct = slotConfig.activities.find((act) => {
    if (act.showOnDays && !act.showOnDays.includes(dayNum)) return false;
    if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return false;
    if (window.isActivityHoliday(dateKey, slotId, act.id)) {
      return false;
    }

    if (window.isCategoryHoliday(dateKey, act.category)) {
      return false;
    }
    return true;
  });

  if (!mainAct) return stats;

  // Hitung spesifik untuk santri yang sedang difilter saja (mencegah progress > 100%)
  FILTERED_SANTRI.forEach((s) => {
    const id = String(s.nis || s.id);
    const status = slotData[id]?.status?.[mainAct.id];

    if (status) {
      if (status === "Hadir") stats.h++;
      else if (status === "Telat") stats.t++;
      else if (status === "Izin") stats.i++;
      else if (status === "Sakit") stats.s++;
      else if (status === "Pulang") stats.p++;
      else if (status === "Alpa") stats.a++;
      stats.total++; // Ini jumlah anak yang SUDAH diabsen
    }
  });

  stats.isFilled =
    slotData.__reviewConfirmed === true ||
    (slotData.__requiresReview !== true &&
      stats.total === FILTERED_SANTRI.length);

  return stats;
};

window.getSlotCompletionStatus = function (slotId, dateStr) {
  const slotData = appState.attendanceData?.[dateStr]?.[slotId];

  if (!slotData) {
    return {
      total: 0,
      filled: 0,
      complete: false,
    };
  }

  let totalSantri = 0;
  let filledSantri = 0;

  FILTERED_SANTRI.forEach((s) => {
    const id = String(s.nis || s.id);

    totalSantri++;

    const status = window.getAttendanceStatus(id, slotId, dateStr);

    if (status) {
      filledSantri++;
    }
  });

  return {
    total: totalSantri,
    filled: filledSantri,
    complete: filledSantri === totalSantri,
  };
};

window.getAttendanceEntryInputDate = function (entry) {
  const raw = entry?.inputDate || entry?.updatedAt || entry?.timestamp || entry?.createdAt;
  if (!raw) return "";
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

window.isSlotCompletedOnSameDay = function (slotId, dateStr) {
  const slotData = appState.attendanceData?.[dateStr]?.[slotId];
  if (!slotData) return false;

  const completion = window.getSlotCompletionStatus(slotId, dateStr);
  if (!completion.complete) return false;

  return FILTERED_SANTRI.every((s) => {
    const id = String(s.nis || s.id);
    const entry = slotData[id];
    return entry && window.getAttendanceEntryInputDate(entry) === dateStr;
  });
};

window.getAttendanceStatus = function (santriId, slotId, customDate = null) {
  try {
    const dateKey = customDate || appState.date;

    const slotData = appState.attendanceData?.[dateKey]?.[slotId];

    if (!slotData) return null;

    const dayNum = new Date(dateKey).getDay();

    const slotConfig = SLOT_WAKTU[slotId];

    if (!slotConfig) return null;

    const mainAct = slotConfig.activities.find((act) => {
      if (act.showOnDays && !act.showOnDays.includes(dayNum)) return false;

      if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return false;

      return true;
    });

    if (!mainAct) return null;

    const id = String(santriId);

    return slotData[id]?.status?.[mainAct.id] || null;
  } catch (err) {
    console.error("getAttendanceStatus error:", err);
    return null;
  }
};

// Global Percentage (Untuk Chart)
window.calculateGlobalStats = function () {
  if (!appState.selectedClass) return 0;

  let checks = 0,
    totalExpected = 0;

  Object.values(SLOT_WAKTU).forEach((slot) => {
    // Cek apakah slot ini sudah ada datanya
    const stats = window.calculateSlotStats(slot.id);
    if (stats.isFilled) {
      checks += stats.h + stats.t;
      totalExpected += stats.total;
    }
  });

  return totalExpected === 0 ? 0 : Math.round((checks / totalExpected) * 100);
};

// ==========================================
// 5. ATTENDANCE ACTIONS
// ==========================================

window.openAttendance = async function () {
  if (window.isSlotHoliday(appState.currentSlotId, appState.date)) {
    return window.showToast(
      `Kegiatan ${SLOT_WAKTU[appState.currentSlotId].label} libur pada hari ini.`,
      "info",
    );
  }
  // 1. Cek Kunci Waktu (Logic Lama)
  const access = window.isSlotAccessible(appState.currentSlotId, appState.date);
  if (access.locked) {
    let msg = "Akses ditolak.";
    if (access.reason === "wait") msg = "Belum masuk waktu presensi";
    if (access.reason === "limit") msg = "Data lampau (>3 hari) terkunci.";
    if (access.reason === "future") msg = "Belum bisa mengisi masa depan.";
    return window.showToast(msg, "warning");
  }

  // 2. CEK LOKASI (LOGIC BARU)
  if (GEO_CONFIG.useGeofencing && !window.gpsBypassEnabled) {
    try {
      await window.verifyLocationCached();
      window.showToast("Lokasi Terverifikasi ✅", "success");
    } catch (errorMsg) {
      window.showToast("🚫 Akses Ditolak: " + errorMsg, "error");

      // Log aktivitas percobaan akses ilegal (Opsional)
      window.logActivity("Akses Ditolak", `Gagal GPS: ${errorMsg}`);
      return; // STOP! Jangan buka halaman absen
    }
  }

  // 3. Buka Halaman Absen (Logic Lama)
  const viewMain = document.getElementById("view-main");
  const viewAttendance = document.getElementById("view-attendance");
  
  viewAttendance.classList.remove("animate-slide-down-custom");
  viewAttendance.classList.remove("hidden");
  viewAttendance.classList.add("animate-slide-up-custom");
  
  setTimeout(() => {
    viewMain.classList.add("hidden");
  }, 400);

  const slot = SLOT_WAKTU[appState.currentSlotId];
  document.getElementById("att-slot-title").textContent = slot.label;
  
  const slotDuration = document.getElementById("att-slot-duration");
  if (slotDuration) {
    slotDuration.innerHTML = `<i data-lucide="clock" class="w-3.5 h-3.5"></i> <span>${slot.subLabel}</span>`;
    if (window.lucide) window.lucide.createIcons();
  }
  
  const dateDisplay = document.getElementById("att-date-display");
  if (dateDisplay) {
    dateDisplay.textContent = window.formatDate(appState.date);
  }
  
  if (window.updateConnectionStatusUI) {
    window.updateConnectionStatusUI();
  }

  const listContainer = document.getElementById("attendance-list-container");
  if (listContainer) {
    listContainer.dataset.attendanceRenderKey = "";
    listContainer.scrollTop = 0;
  }

  window.renderAttendanceList();

  // Morphing bottom search bar on scroll
  const bottomBar = document.getElementById("att-bottom-bar");
  const searchInput = document.getElementById("att-search");
  
  if (listContainer && bottomBar) {
    // Reset to collapsed when entering page
    bottomBar.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 collapsed";
    
    // Clear search value
    if (searchInput) searchInput.value = "";
    
    // Scroll listener on container
    listContainer.onscroll = () => {
      // If user has entered text in search or input has focus, keep it expanded
      if (searchInput && (document.activeElement === searchInput || searchInput.value.trim() !== "")) {
        return;
      }
      if (listContainer.scrollTop > 15) {
        bottomBar.classList.add("expanded");
        bottomBar.classList.remove("collapsed");
      } else {
        bottomBar.classList.add("collapsed");
        bottomBar.classList.remove("expanded");
      }
    };

    if (searchInput) {
      searchInput.onfocus = () => {
        bottomBar.classList.add("expanded");
        bottomBar.classList.remove("collapsed");
      };
      // If search loses focus and is empty, collapse it if scrollTop is <= 15
      searchInput.onblur = () => {
        if (searchInput.value.trim() === "" && listContainer.scrollTop <= 15) {
          bottomBar.classList.add("collapsed");
          bottomBar.classList.remove("expanded");
        }
      };
    }
  }
};

window.closeAttendance = function () {
  const viewMain = document.getElementById("view-main");
  const viewAttendance = document.getElementById("view-attendance");
  if (window.clearAttendanceReviewGate) window.clearAttendanceReviewGate();
  
  viewMain.classList.remove("hidden");
  viewAttendance.classList.remove("animate-slide-up-custom");
  viewAttendance.classList.add("animate-slide-down-custom");
  
  setTimeout(() => {
    viewAttendance.classList.add("hidden");
    viewAttendance.classList.remove("animate-slide-down-custom");
    window.updateDashboard();
  }, 350);
};

window.renderAttendanceList = function () {
  const container = document.getElementById("attendance-list-container");
  if (!container) return;

  container.innerHTML = "";

  // --- START LOGIC ABSENSI (ORIGINAL - TIDAK DIUBAH) ---
  const slot = SLOT_WAKTU[appState.currentSlotId];
  const dateKey = appState.date;
  const currentDay = new Date(appState.date).getDay();
  const attendanceRenderKey = `${dateKey}:${slot.id}`;
  const isNewAttendanceView =
    container.dataset.attendanceRenderKey !== attendanceRenderKey;

  if (!appState.attendanceData[dateKey]) appState.attendanceData[dateKey] = {};
  if (!appState.attendanceData[dateKey][slot.id])
    appState.attendanceData[dateKey][slot.id] = {};

  if (isNewAttendanceView) {
    if (container._attendanceReviewScrollHandler) {
      container.removeEventListener(
        "scroll",
        container._attendanceReviewScrollHandler,
      );
      delete container._attendanceReviewScrollHandler;
    }
    container.scrollTop = 0;
    container.dataset.attendanceRenderKey = attendanceRenderKey;
  }

  const dbSlot = appState.attendanceData[dateKey][slot.id];
  let hasAutoChanges = false;

  let summaryCount = { Sakit: 0, Izin: 0, Pulang: 0, Alpa: 0, Telat: 0 };
  let summaryList = [];

  const PREV_SLOT_MAP = { ashar: "shubuh", maghrib: "ashar", isya: "maghrib" };
  const prevSlotId = PREV_SLOT_MAP[slot.id];
  const prevSlotData = prevSlotId
    ? appState.attendanceData[dateKey][prevSlotId]
    : null;

  const mainActId = slot.activities[0]?.id || "shalat";

  // PERBAIKAN: Inisialisasi struktur data kosong untuk SEMUA santri DULU sebelum di-filter
  FILTERED_SANTRI.forEach((santri) => {
    const id = String(santri.nis || santri.id);
    if (!dbSlot[id]) {
      hasAutoChanges = true;
      dbSlot.__requiresReview = true;
      dbSlot.__reviewConfirmed = false;

      const defStatus = {};
      slot.activities.forEach((a) => {
        if (a.onlyRamadhan && !window.isRamadhan(dateKey)) return;
        if (a.category === "sunnah") defStatus[a.id] = "Tidak";
        else defStatus[a.id] = a.type === "mandator" ? "Hadir" : "Ya";
      });
      dbSlot[id] = { status: defStatus, note: "" };
    }
  });

  // BARU jalankan filter setelah semua punya status dasar
  const list = FILTERED_SANTRI.filter((s) => {
    const matchName = s.nama
      .toLowerCase()
      .includes(appState.searchQuery.toLowerCase());
    if (appState.filterProblemOnly) {
      const st = dbSlot[String(s.nis || s.id)]?.status?.[mainActId];
      return (
        matchName && ["Alpa", "Sakit", "Izin", "Pulang", "Telat"].includes(st)
      );
    }
    return matchName;
  });

  const countEl = document.getElementById("att-santri-count");
  if (countEl) countEl.textContent = `${list.length} Santri`;

  const tplRow = document.getElementById("tpl-santri-row");
  const tplBtn = document.getElementById("tpl-activity-btn");

  if (!tplRow || !tplBtn) {
    console.error("Template HTML tidak ditemukan!");
    return;
  }

  const fragment = document.createDocumentFragment();

  list.forEach((santri) => {
    const id = String(santri.nis || santri.id);

    const sData = dbSlot[id];
    const activePermit = window.checkActivePermit(id, dateKey, slot.id);
    const isAutoMarked = sData.note && sData.note.includes("[Auto]");

    if (activePermit) {
      slot.activities.forEach((act) => {
        let target = null;
        if (["fardu", "kbm", "school"].includes(act.category))
          target = activePermit.type;
        else target = "Tidak";

        if (sData.status[act.id] !== target) {
          sData.status[act.id] = target;
          hasAutoChanges = true;
        }
      });
      const autoNote = `[Auto] ${activePermit.type} s/d ${window.formatDate(activePermit.end)}`;
      if (!sData.note || !sData.note.includes(activePermit.type)) {
        sData.note = autoNote;
        hasAutoChanges = true;
      }
    } else if (isAutoMarked) {
      slot.activities.forEach((act) => {
        if (["fardu", "kbm", "school"].includes(act.category))
          sData.status[act.id] = "Hadir";
        else if (act.category === "dependent") sData.status[act.id] = "Ya";
        else sData.status[act.id] = "Tidak";
      });
      sData.note = "";
      hasAutoChanges = true;
    }

    const currentStatus = sData.status?.[mainActId] || "Hadir";

    if (["Sakit", "Izin", "Pulang", "Alpa", "Telat"].includes(currentStatus)) {
      summaryCount[currentStatus] = (summaryCount[currentStatus] || 0) + 1;
      summaryList.push({ nama: santri.nama, status: currentStatus });
    }
    // --- END LOGIC ABSENSI ---

    // ==========================================
    // COMPACT UI IMPLEMENTATION
    // Static card, dark mode, minimal design
    // ==========================================

    const clone = tplRow.content.cloneNode(true);
    const cardContainer = clone.querySelector(".santri-row");

    // STATIC CARD STYLING - Same for all
    cardContainer.className =
      "santri-row bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 shadow-sm relative overflow-hidden transition-all hover:shadow-md mb-4";

    // Visual highlight untuk active permit (optional subtle ring)
    if (activePermit) {
      if (activePermit.type === "Sakit") {
        cardContainer.classList.add(
          "ring-1",
          "ring-amber-200",
          "dark:ring-amber-800/50",
        );
      } else if (activePermit.type === "Izin") {
        cardContainer.classList.add(
          "ring-1",
          "ring-blue-200",
          "dark:ring-blue-800/50",
        );
      } else if (activePermit.type === "Pulang") {
        cardContainer.classList.add(
          "ring-1",
          "ring-purple-200",
          "dark:ring-purple-800/50",
        );
      }
    }

    // HEADER SECTION
    const headerContainer = clone.querySelector(".header-container");
    headerContainer.className = "flex justify-between items-start mb-4";

    const infoSection = clone.querySelector(".info-section");
    infoSection.className = "flex items-center gap-3.5";

    // AVATAR - Stable personality marker per santri.
    const avatarEl = clone.querySelector(".santri-avatar");
    const avatarOptions = [
      { icon: "🌿", class: "from-emerald-50 to-teal-100 text-emerald-700 dark:from-emerald-900/30 dark:to-teal-900/30 dark:text-emerald-300" },
      { icon: "✨", class: "from-sky-50 to-blue-100 text-sky-700 dark:from-sky-900/30 dark:to-blue-900/30 dark:text-sky-300" },
      { icon: "📘", class: "from-indigo-50 to-violet-100 text-indigo-700 dark:from-indigo-900/30 dark:to-violet-900/30 dark:text-indigo-300" },
      { icon: "🕌", class: "from-cyan-50 to-slate-100 text-cyan-700 dark:from-cyan-900/30 dark:to-slate-800 dark:text-cyan-300" },
      { icon: "⭐", class: "from-amber-50 to-yellow-100 text-amber-700 dark:from-amber-900/30 dark:to-yellow-900/20 dark:text-amber-300" },
    ];
    const avatarSeed = Array.from(String(santri.id || santri.nis || santri.nama || id)).reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    const avatar = avatarOptions[avatarSeed % avatarOptions.length];
    avatarEl.className =
      `w-10 h-10 rounded-xl bg-gradient-to-br ${avatar.class} flex items-center justify-center text-lg shadow-inner shrink-0 ring-1 ring-white/70 dark:ring-white/10 cursor-pointer hover:scale-105 transition-transform`;
    avatarEl.textContent = avatar.icon;
    avatarEl.onclick = () => { if (window.openStudentDetail) window.openStudentDetail(id); };
    const iconAvatarOptions = [
      { icon: "user-round", class: "from-sky-50 to-blue-100 text-sky-700 dark:from-sky-900/30 dark:to-blue-900/30 dark:text-sky-300" },
      { icon: "book-open", class: "from-indigo-50 to-violet-100 text-indigo-700 dark:from-indigo-900/30 dark:to-violet-900/30 dark:text-indigo-300" },
      { icon: "sparkles", class: "from-amber-50 to-yellow-100 text-amber-700 dark:from-amber-900/30 dark:to-yellow-900/20 dark:text-amber-300" },
      { icon: "leaf", class: "from-emerald-50 to-teal-100 text-emerald-700 dark:from-emerald-900/30 dark:to-teal-900/30 dark:text-emerald-300" },
      { icon: "graduation-cap", class: "from-cyan-50 to-slate-100 text-cyan-700 dark:from-cyan-900/30 dark:to-slate-800 dark:text-cyan-300" },
      { icon: "badge-check", class: "from-teal-50 to-emerald-100 text-teal-700 dark:from-teal-900/30 dark:to-emerald-900/20 dark:text-teal-300" },
      { icon: "notebook-tabs", class: "from-violet-50 to-fuchsia-100 text-violet-700 dark:from-violet-900/30 dark:to-fuchsia-900/20 dark:text-violet-300" },
      { icon: "shield-check", class: "from-slate-50 to-slate-200 text-slate-600 dark:from-slate-800 dark:to-slate-700 dark:text-slate-300" },
      { icon: "map-pin", class: "from-rose-50 to-pink-100 text-rose-700 dark:from-rose-900/30 dark:to-pink-900/20 dark:text-rose-300" },
      { icon: "circle-user-round", class: "from-blue-50 to-cyan-100 text-blue-700 dark:from-blue-900/30 dark:to-cyan-900/20 dark:text-blue-300" },
      { icon: "school", class: "from-orange-50 to-amber-100 text-orange-700 dark:from-orange-900/30 dark:to-amber-900/20 dark:text-orange-300" },
      { icon: "scan-face", class: "from-lime-50 to-green-100 text-lime-700 dark:from-lime-900/30 dark:to-green-900/20 dark:text-lime-300" },
    ];
    const iconAvatar = iconAvatarOptions[avatarSeed % iconAvatarOptions.length];
    const profileStats = { Hadir: 0, Sakit: 0, Izin: 0, Pulang: 0, Alpa: 0, Telat: 0 };
    Object.values(appState.attendanceData || {}).forEach((dateSlots) => {
      Object.values(dateSlots || {}).forEach((slotRecords) => {
        const record = slotRecords?.[id];
        Object.values(record?.status || {}).forEach((status) => {
          if (profileStats[status] !== undefined) profileStats[status] += 1;
        });
      });
    });
    const issueStatus = ["Sakit", "Izin", "Pulang", "Alpa", "Telat"].sort(
      (a, b) => profileStats[b] - profileStats[a],
    )[0];
    const profileAvatar =
      profileStats[issueStatus] >= 2
        ? {
            Sakit: { icon: window.getStatusMeta("Sakit").icon, class: window.getStatusMeta("Sakit").text },
            Izin: { icon: window.getStatusMeta("Izin").icon, class: window.getStatusMeta("Izin").text },
            Pulang: { icon: window.getStatusMeta("Pulang").icon, class: window.getStatusMeta("Pulang").text },
            Alpa: { icon: window.getStatusMeta("Alpa").icon, class: window.getStatusMeta("Alpa").text },
            Telat: { icon: window.getStatusMeta("Telat").icon, class: window.getStatusMeta("Telat").text },
          }[issueStatus]
        : profileStats.Hadir >= 2 || currentStatus === "Hadir"
          ? { icon: "flame", class: "text-orange-500" }
          : { icon: iconAvatar.icon, class: "text-slate-500 dark:text-slate-300" };
    avatarEl.className =
      "w-10 h-10 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center shadow-inner shrink-0 cursor-pointer hover:scale-105 hover:bg-slate-200 dark:hover:bg-slate-700 transition-transform";
    avatarEl.innerHTML = `<i data-lucide="${profileAvatar.icon}" class="w-5 h-5 ${profileAvatar.class}"></i>`;

    // NAME & INFO
    const nameContainer = clone.querySelector(".name-container");
    nameContainer.className = "flex-1 min-w-0";

    const nameRow = clone.querySelector(".name-row");
    nameRow.className = "flex items-center gap-2";

    const nameText = clone.querySelector(".santri-name");
    nameText.className =
      "font-bold text-slate-800 dark:text-white text-sm leading-tight line-clamp-1 cursor-pointer hover:underline hover:text-emerald-505 transition-all";
    nameText.textContent = window.sanitizeHTML(santri.nama);
    nameText.onclick = () => { if (window.openStudentDetail) window.openStudentDetail(id); };

    // BADGE - Only for active permit (inline conditional)
    const badgeContainer = clone.querySelector(".badge-container");
    badgeContainer.innerHTML = "";
    if (activePermit) {
      const badge = document.createElement("span");
      let badgeClass =
        "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border align-middle";

      if (activePermit.type === "Sakit") {
        badgeClass +=
          " bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700";
      } else if (activePermit.type === "Izin") {
        badgeClass +=
          " bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700";
      } else if (activePermit.type === "Pulang") {
        badgeClass +=
          " bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700";
      }

      badge.className = badgeClass;
      badge.textContent = activePermit.type;
      badgeContainer.appendChild(badge);
    }

    // Room metadata is intentionally hidden to keep this card header clean.
    const roomRow = clone.querySelector(".room-row");
    roomRow.className = "hidden";

    const roomLabel = clone.querySelector(".room-label");
    roomLabel.textContent = "";

    const roomValue = clone.querySelector(".santri-kamar");
    roomValue.textContent = "";
    const kelasText = String(santri.kelas || "-");
    const asramaText = String(santri.asrama || "-");
    roomRow.className = "flex items-center gap-1.5 mt-1.5 min-w-0";
    roomLabel.className =
      "meta-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 text-[8px] font-black uppercase tracking-wide border border-slate-200/70 dark:border-slate-700/70 max-w-[64px]";
    roomLabel.innerHTML = `<i data-lucide="school" class="w-2.5 h-2.5 shrink-0"></i><span class="meta-chip-text">${window.sanitizeHTML(kelasText)}</span>`;
    roomValue.className =
      "meta-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 text-[8px] font-bold border border-slate-200/70 dark:border-slate-700/70 max-w-[150px]";
    roomValue.innerHTML = `<i data-lucide="home" class="w-2.5 h-2.5 shrink-0"></i><span class="meta-chip-text">${window.sanitizeHTML(asramaText)}</span>`;

    // EDIT NOTE BUTTON
    const editBtn = clone.querySelector(".btn-edit-note");
    editBtn.className =
      "w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all";

    // ACTIVITY BUTTONS SECTION - HORIZONTAL LAYOUT
    const btnCont = clone.querySelector(".activity-container");
    const visibleActivities = slot.activities.filter((act) => {
      if (act.showOnDays && !act.showOnDays.includes(currentDay)) return false;
      if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return false;
      return true;
    });
    const isCenteredActivityRow = visibleActivities.length <= 3;
    const activityAlignClass = isCenteredActivityRow
      ? "justify-center gap-5 sm:gap-6"
      : "justify-between gap-2 sm:gap-2.5";
    btnCont.className = `flex ${activityAlignClass} overflow-x-auto hide-scrollbar px-1 pb-2 pt-1`;
    btnCont.innerHTML = "";

    visibleActivities.forEach((act) => {
      const isActivityLibur = window.isActivityHoliday(
        dateKey,
        slot.id,
        act.id,
      );

      const isCategoryLibur = window.isCategoryHoliday(dateKey, act.category);

      const isLibur = isActivityLibur || isCategoryLibur;

      const bClone = tplBtn.content.cloneNode(true);
      const btnWrapper = bClone.querySelector(".btn-wrapper");
      btnWrapper.className =
        "flex flex-col items-center gap-1 cursor-pointer group select-none w-11 sm:w-[58px] shrink-0";

      const btn = bClone.querySelector(".btn-status");
      const lbl = bClone.querySelector(".lbl-status");

      const curr = sData.status?.[act.id] || "Tidak";
      const uiBtn = STATUS_UI[curr] || STATUS_UI["Tidak"];
      const hasPermitConflict =
        activePermit && ["fardu", "kbm", "school"].includes(act.category);

      let btnClass = `btn-status w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm transition-all active:scale-95 border-[2.5px] font-black text-sm sm:text-base ${uiBtn.class}`;

      let ringClass = "";
      if (curr === "Hadir" || curr === "Ya") {
        ringClass =
          "ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-800";
      } else if (["Telat", "Sakit", "Izin", "Alpa", "Pulang"].includes(curr)) {
        ringClass =
          `ring-2 ${window.getStatusMeta(curr).ring} ring-offset-2 ring-offset-white dark:ring-offset-slate-800`;
      } else {
        ringClass =
          "ring-2 ring-slate-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-800";
      }

      btn.className = btnClass + " " + ringClass;

      if (isLibur) {
        btn.className =
          "btn-status w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center border-2 border-slate-300 bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 grayscale opacity-70";
      }

      if (hasPermitConflict) {
        btn.classList.add("ring-4", "ring-offset-4");
      }

      if (isLibur) {
        btn.innerHTML = '<i data-lucide="calendar-x" class="w-5 h-5"></i>';
      } else {
        btn.textContent = uiBtn.label;
      }

      btn.onclick = (e) => {
        if (isLibur) {
          return;
        }

        e.stopPropagation();
        if (hasPermitConflict) {
          if (
            !confirm(
              `Santri tercatat ${activePermit.type}. Ubah manual jadi HADIR?`,
            )
          )
            return;
          if (sData.note && sData.note.includes("[Auto]")) sData.note = "";
        }
        window.toggleStatus(id, act.id, act.type);
      };

      lbl.className =
        "lbl-status text-[9px] font-bold text-slate-400 text-center truncate w-full group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors leading-tight";
      if (isLibur) {
        lbl.innerHTML = `
                    <span>${act.label}</span>
                    <span class="block text-[8px] uppercase font-black text-slate-400">
                        Libur
                    </span>
                `;
      } else {
        lbl.textContent = act.label;
      }

      btnCont.appendChild(bClone);
    });

    const noteBox = clone.querySelector(".note-section");
    const noteInp = clone.querySelector(".input-note");

    if (noteInp && noteBox) {
      noteBox.className =
        "note-section hidden mt-3 animate-fade-in border-t border-slate-100 dark:border-slate-700 pt-3";
      noteInp.value = sData.note || "";
      noteInp.className =
        "input-note w-full text-xs font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 focus:border-emerald-500 dark:focus:border-emerald-400 outline-none transition-colors placeholder-slate-400 dark:placeholder-slate-500 text-slate-700 dark:text-slate-200";
      noteInp.placeholder = "Catatan kejadian...";

      noteInp.onchange = (e) => {
        sData.note = window.sanitizeHTML(e.target.value);
        window.saveData();
      };

      editBtn.onclick = () => {
        noteBox.classList.toggle("hidden");
        if (!noteBox.classList.contains("hidden")) {
          noteInp.focus();
        }
      };
    }

    fragment.appendChild(clone);
  });

  container.appendChild(fragment);
  if (isNewAttendanceView) container.scrollTop = 0;

  // ==========================================
  // SUMMARY WIDGET - Clean badges
  // ==========================================
  const summaryWidget = document.getElementById("att-summary-widget");
  const summaryBadges = document.getElementById("att-summary-badges");
  const summaryNames = document.getElementById("att-summary-names");

  const totalProblem =
    summaryCount.Sakit +
    summaryCount.Izin +
    summaryCount.Pulang +
    summaryCount.Alpa +
    summaryCount.Telat;

  if (summaryWidget && summaryBadges && summaryNames) {
    if (totalProblem > 0) {
      summaryWidget.classList.remove("hidden");
      summaryBadges.innerHTML = "";
      summaryNames.innerHTML = "";

      const makeBadge = (count, label, colorClass) => {
        if (count > 0) {
          const pill = document.createElement("div");
          pill.className = `px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm border ${colorClass}`;
          pill.textContent = `${count} ${label}`;
          summaryBadges.appendChild(pill);
        }
      };

      makeBadge(
        summaryCount.Sakit,
        "Sakit",
        window.getStatusMeta("Sakit").pill,
      );
      makeBadge(
        summaryCount.Izin,
        "Izin",
        window.getStatusMeta("Izin").pill,
      );
      makeBadge(
        summaryCount.Pulang,
        "Pulang",
        window.getStatusMeta("Pulang").pill,
      );
      makeBadge(
        summaryCount.Alpa,
        "Alpa",
        window.getStatusMeta("Alpa").pill,
      );
      makeBadge(
        summaryCount.Telat,
        "Telat",
        window.getStatusMeta("Telat").pill,
      );

      summaryList.forEach((item) => {
        let badgeClass =
          "px-2 py-1 rounded-md text-[10px] font-bold inline-block m-0.5 border";
        badgeClass += ` ${window.getStatusMeta(item.status).pill}`;

        const badge = document.createElement("span");
        badge.className = badgeClass;
        badge.textContent = window.sanitizeHTML(item.nama);
        summaryNames.appendChild(badge);
      });
    } else {
      summaryWidget.classList.add("hidden");
    }
  }

  const initializedCount = FILTERED_SANTRI.filter((s) => {
    const id = String(s.nis || s.id);

    return dbSlot[id];
  }).length;

  if (
    initializedCount === FILTERED_SANTRI.length &&
    !hasAutoChanges &&
    dbSlot.__requiresReview !== true &&
    dbSlot.__reviewConfirmed !== true
  ) {
    dbSlot.__reviewConfirmed = true;
  }

  const needsReview =
    initializedCount === FILTERED_SANTRI.length &&
    dbSlot.__requiresReview === true &&
    dbSlot.__reviewConfirmed !== true;

  if (window.renderAttendanceReviewGate) {
    window.renderAttendanceReviewGate(
      container,
      dateKey,
      slot.id,
      needsReview,
    );
  }

  if (
    (initializedCount === FILTERED_SANTRI.length || hasAutoChanges) &&
    !needsReview
  ) {
    window.saveData();
  }
  if (window.refreshIcons) window.refreshIcons();
};

// ==========================================
// PERBAIKAN FUNGSI TOGGLE STATUS
// ==========================================

window.toggleStatus = function (id, actId, type) {
  const slotId = appState.currentSlotId;
  const dateKey = appState.date;

  // Safety check data
  if (!appState.attendanceData[dateKey]) appState.attendanceData[dateKey] = {};
  if (!appState.attendanceData[dateKey][slotId])
    appState.attendanceData[dateKey][slotId] = {};
  if (!appState.attendanceData[dateKey][slotId][id])
    appState.attendanceData[dateKey][slotId][id] = { status: {}, note: "" };

  const sData = appState.attendanceData[dateKey][slotId][id];
  const curr = sData.status[actId] || (type === "mandator" ? "Hadir" : "Ya");
  let next = "";

  // 1. TENTUKAN STATUS BARU (LOGIKA SIKLUS)
  if (type === "mandator") {
    if (curr === "Hadir") next = "Alpa";
    else if (curr === "Alpa") next = "Sakit";
    else if (curr === "Sakit") next = "Izin";
    else if (curr === "Izin") next = "Pulang";
    else if (curr === "Pulang") next = "Telat";
    else next = "Hadir";
  } else {
    // Siklus Sunnah: Ya -> Tidak -> Ya
    next = curr === "Ya" ? "Tidak" : "Ya";
  }

  // Terapkan status baru ke tombol yang diklik
  sData.status[actId] = next;
  sData.inputDate = window.getLocalDateStr();
  sData.updatedAt = new Date().toISOString();

  // 2. LOGIKA OTOMATIS (CASCADING)
  // Cek konfigurasi kegiatan yang sedang diklik
  const currentSlotConfig = SLOT_WAKTU[slotId];
  const clickedActConfig = currentSlotConfig.activities.find(
    (a) => a.id === actId,
  );

  // JIKA YANG DIKLIK ADALAH 'FARDU' (SHALAT UTAMA)
  // Maka kegiatan lain harus menyesuaikan
  if (
    clickedActConfig &&
    clickedActConfig.category === "fardu" &&
    actId === "shalat"
  ) {
    const isNonHadir = ["Sakit", "Izin", "Pulang", "Alpa"].includes(next);

    currentSlotConfig.activities.forEach((otherAct) => {
      if (otherAct.id === actId) return; // Jangan ubah diri sendiri

      if (isNonHadir) {
        // KASUS: SHALAT TIDAK HADIR (S/I/A)

        if (otherAct.category === "dependent") {
          // Dzikir/Rawatib -> Otomatis TIDAK
          sData.status[otherAct.id] = "Tidak";
        } else if (otherAct.category === "kbm") {
          // Tahfizh/Conver -> Mengikuti status shalat (misal: Sakit)
          sData.status[otherAct.id] = next;
        } else if (otherAct.category === "sunnah") {
          // Tahajjud/Dhuha -> Otomatis TIDAK
          sData.status[otherAct.id] = "Tidak";
        }
      } else {
        // KASUS: SHALAT KEMBALI HADIR

        if (otherAct.category === "dependent") {
          // Dzikir/Rawatib -> Reset ke YA
          sData.status[otherAct.id] = "Ya";
        } else if (otherAct.category === "kbm") {
          // Tahfizh/Conver -> Reset ke HADIR
          sData.status[otherAct.id] = "Hadir";
        }
        // Untuk kategori 'sunnah' biasa (Tahajjud), biarkan apa adanya
        // agar tidak mereset inputan manual musyrif.
      }
    });
  }

  // Simpan & Refresh UI
  window.saveData();
  window.renderAttendanceList(); // Render ulang agar perubahan otomatis terlihat

  if (appState.date === window.getLocalDateStr()) {
    window.updateDashboard();
  }
};

// Fungsi untuk membuka Modal Menu Bulk (Akan dipanggil dari HTML)
window.openBulkMenu = function () {
  const modal = document.getElementById("modal-bulk-actions");
  if (modal) {
    modal.classList.remove("hidden");
    window.generateBulkButtons(); // Generate tombol sesuai slot aktif
  }
};

// Fungsi generate tombol dinamis berdasarkan kegiatan yang ada di slot saat ini
window.generateBulkButtons = function () {
  const container = document.getElementById("bulk-actions-content");
  const slot = SLOT_WAKTU[appState.currentSlotId];
  const currentDay = new Date(appState.date).getDay();

  container.innerHTML = "";

  // Cek ketersediaan kategori di slot ini
  const acts = slot.activities.filter(
    (a) =>
      (!a.showOnDays || a.showOnDays.includes(currentDay)) &&
      (!a.onlyRamadhan || window.isRamadhan(appState.date)),
  );
  const hasFardu = acts.some((a) => a.category === "fardu");
  const hasSchool = acts.some((a) => a.category === "school");
  const hasKbm = acts.some((a) => a.category === "kbm");
  const sunnahActs = acts.filter((a) => a.category === "sunnah");

  let html = "";

  // 1. Bagian Shalat Fardu (Otomatis handle dependent: Qabliyah/Badiyah/Dzikir)
  if (hasFardu) {
    html += `
        <div class="mb-4">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Shalat & Rawatib</p>
            <div class="flex gap-2">
                <button onclick="window.applyBulkAction('fardu', 'Hadir')" class="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/30 active:scale-95 transition-all">
                    Hadir Semua
                </button>
                <button onclick="window.applyBulkAction('fardu', 'Alpa')" class="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold text-xs border border-red-200 active:scale-95 transition-all">
                    Alpa Semua
                </button>
            </div>
            <p class="text-[9px] text-slate-400 mt-1.5 italic">*Dzikir & Rawatib akan menyesuaikan status shalat.</p>
        </div>`;
  }

  if (hasSchool) {
    html += `
        <div class="mb-4">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Berangkat Sekolah
            </p>
    
            <div class="flex gap-2">
    
                <button
                    onclick="window.applyBulkAction('school','Hadir')"
                    class="flex-1 py-3 rounded-xl bg-cyan-500 text-white font-bold text-xs">
    
                    Hadir Semua
    
                </button>
    
                <button
                    onclick="window.applyBulkAction('school','Alpa')"
                    class="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold text-xs">
    
                    Alpa Semua
    
                </button>
    
            </div>
        </div>
        `;
  }

  // 2. Bagian KBM Asrama
  if (hasKbm) {
    html += `
        <div class="mb-4">
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pembelajaran Asrama</p>
            <div class="flex gap-2">
                <button onclick="window.applyBulkAction('kbm', 'Hadir')" class="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 active:scale-95 transition-all">
                    Hadir Semua
                </button>
                <button onclick="window.applyBulkAction('kbm', 'Alpa')" class="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold text-xs border border-red-200 active:scale-95 transition-all">
                    Alpa Semua
                </button>
            </div>
        </div>`;
  }

  // 3. Bagian Sunnah Spesifik (Tahajjud, Dhuha, dll)
  if (sunnahActs.length > 0) {
    html += `<div class="mb-2"><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ibadah Sunnah</p><div class="grid grid-cols-2 gap-2">`;

    sunnahActs.forEach((act) => {
      html += `
            <div class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${act.label}</span>
                </div>
                <div class="flex gap-1">
                    <button onclick="window.applyBulkAction('specific', 'Ya', '${act.id}')" class="flex-1 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition-colors">Ya</button>
                    <button onclick="window.applyBulkAction('specific', 'Tidak', '${act.id}')" class="flex-1 py-1.5 rounded-lg bg-slate-200 text-slate-500 text-[10px] font-bold hover:bg-slate-300 transition-colors">Tdk</button>
                </div>
            </div>`;
    });

    html += `</div></div>`;
  }

  container.innerHTML = html;
};

// Logika Eksekusi Bulk Action
window.applyBulkAction = function (targetCategory, value, specificId = null) {
  const slotId = appState.currentSlotId;
  const dateKey = appState.date;
  const slot = SLOT_WAKTU[slotId];
  const currentDay = new Date(appState.date).getDay();

  // Prepare structure
  if (!appState.attendanceData[dateKey]) appState.attendanceData[dateKey] = {};
  if (!appState.attendanceData[dateKey][slotId])
    appState.attendanceData[dateKey][slotId] = {};
  const dbSlot = appState.attendanceData[dateKey][slotId];

  FILTERED_SANTRI.forEach((s) => {
    const id = String(s.nis || s.id);
    if (!dbSlot[id]) dbSlot[id] = { status: {}, note: "" };

    slot.activities.forEach((act) => {
      if (window.isActivityHoliday(dateKey, slot.id, act.id)) {
        return;
      }
      if (window.isCategoryHoliday(dateKey, act.category)) {
        return;
      }
      if (act.showOnDays && !act.showOnDays.includes(currentDay)) return;
      if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return;

      // LOGIKA 1: Fardu & Dependent (Ikut Shalat)
      if (targetCategory === "fardu") {
        if (act.category === "fardu") {
          dbSlot[id].status[act.id] = value; // Hadir / Alpa
        } else if (act.category === "dependent") {
          // Jika Shalat Hadir -> Dependent = Ya
          // Jika Shalat Alpa/Sakit -> Dependent = Tidak
          dbSlot[id].status[act.id] = value === "Hadir" ? "Ya" : "Tidak";
        }
      }

      // LOGIKA 2: KBM Asrama
      else if (targetCategory === "kbm" && act.category === "kbm") {
        dbSlot[id].status[act.id] = value; // Hadir / Alpa
      } else if (targetCategory === "school" && act.category === "school") {
        dbSlot[id].status[act.id] = value;
      }

      // LOGIKA 3: Specific Sunnah (Dhuha, Tahajjud, dll)
      else if (targetCategory === "specific" && act.id === specificId) {
        dbSlot[id].status[act.id] = value; // Ya / Tidak
      }
    });

    if (Object.keys(dbSlot[id].status || {}).length > 0) {
      dbSlot[id].inputDate = window.getLocalDateStr();
      dbSlot[id].updatedAt = new Date().toISOString();
    }
  });

  window.saveData();
  window.renderAttendanceList();
  window.showToast("Data berhasil diperbarui secara massal", "success");
  window.closeModal("modal-bulk-actions");
};

window.toggleProblemFilter = function () {
  appState.filterProblemOnly = !appState.filterProblemOnly;
  const btn = document.getElementById("btn-filter-problem");

  if (appState.filterProblemOnly) {
    btn.classList.add("text-red-500", "bg-red-50", "border-red-200");
    btn.classList.remove("text-slate-500", "bg-white");
  } else {
    btn.classList.remove("text-red-500", "bg-red-50", "border-red-200");
    btn.classList.add("text-slate-500", "bg-white");
  }

  window.renderAttendanceList();
};

window.handleSearch = function (val) {
  appState.searchQuery = val;
  window.renderAttendanceList();
};

// ==========================================
// 6. DATE ACTIONS
// ==========================================

window.changeDateView = function (direction) {
  const current = new Date(appState.date);
  current.setDate(current.getDate() + direction);

  const nextDateStr = window.getLocalDateStr(current);
  const todayStr = window.getLocalDateStr();

  if (nextDateStr > todayStr) {
    return window.showToast("Masa depan belum terjadi 🚫", "warning");
  }

  appState.date = nextDateStr;
  window.updateDateDisplay();
  window.updateDashboard();
  window.showToast(`📅 ${window.formatDate(appState.date)}`, "info");
};

window.updateDateDisplay = function () {
  const el = document.getElementById("current-date-display");
  const input = document.getElementById("date-picker-input");

  if (el) el.textContent = window.formatDate(appState.date);
  if (input) input.value = appState.date;
};

window.handleDateChange = function (value) {
  if (!value) return;
  const todayStr = window.getLocalDateStr();

  if (value > todayStr) {
    window.showToast("Tidak bisa memilih tanggal masa depan 🚫", "warning");
    const input = document.getElementById("date-picker-input");
    if (input) input.value = appState.date;
    return;
  }

  appState.date = value;
  window.updateDateDisplay();
  window.updateDashboard();
  window.showToast("Tanggal berhasil diubah", "success");
};

// ==========================================
// 7. EXPORT & REPORT
// ==========================================

window.exportToExcel = function () {
  if (!appState.selectedClass || FILTERED_SANTRI.length === 0) {
    return window.showToast("Pilih kelas terlebih dahulu", "warning");
  }

  const dateKey = appState.date;
  const data = appState.attendanceData[dateKey];

  if (!data) {
    return window.showToast("Tidak ada data untuk tanggal ini", "warning");
  }

  let csv = "No,Nama,NIS,Kelas";
  Object.values(SLOT_WAKTU).forEach((slot) => (csv += `,${slot.label}`));
  csv += "\n";

  FILTERED_SANTRI.forEach((s, idx) => {
    const id = String(s.nis || s.id);
    csv += `${idx + 1},"${s.nama}",${s.nis || s.id},${s.kelas}`;

    Object.values(SLOT_WAKTU).forEach((slot) => {
      const mainActId = slot.activities[0]?.id || "shalat"; // <-- PERBAIKAN DI SINI
      const status = data[slot.id]?.[id]?.status?.[mainActId] || "-";
      csv += `,${status}`;
    });
    csv += "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Presensi_${appState.selectedClass}_${appState.date}.csv`;
  link.click();

  window.showToast("File berhasil diunduh", "success");
  window.logActivity("Export Data", `Mengexport data ke Excel`);
};

window.exportToPDF = function () {
  if (!appState.selectedClass || FILTERED_SANTRI.length === 0) {
    return window.showToast("Pilih kelas terlebih dahulu", "warning");
  }

  const table = document.querySelector("#report-section table");
  if (!table) {
    return window.showToast("Tabel laporan belum siap", "warning");
  }

  const rangeLabel =
    document.getElementById("report-date-range")?.textContent || appState.date;
  const title = `Laporan Presensi ${appState.selectedClass}`;
  const printedAt = new Date().toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return window.showToast("Izinkan pop-up untuk membuat PDF", "warning");
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${window.sanitizeHTML(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Inter, Arial, sans-serif; color: #0f172a; margin: 32px; }
          header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; }
          h1 { margin: 0; font-size: 22px; letter-spacing: -0.02em; }
          p { margin: 4px 0 0; color: #64748b; font-size: 12px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f8fafc; color: #475569; text-transform: uppercase; letter-spacing: .08em; font-size: 9px; text-align: left; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; vertical-align: middle; }
          td { color: #334155; }
          tr:nth-child(even) td { background: #fbfdff; }
          .meta { text-align: right; }
          @media print { body { margin: 18mm; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>${window.sanitizeHTML(title)}</h1>
            <p>${window.sanitizeHTML(rangeLabel)}</p>
          </div>
          <div class="meta">
            <p>Dicetak ${window.sanitizeHTML(printedAt)}</p>
            <p>Mode: ${window.sanitizeHTML(appState.reportMode || "daily")}</p>
          </div>
        </header>
        ${table.outerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);

  window.showToast("Siap dicetak sebagai PDF", "success");
  window.logActivity("Export Data", "Membuat laporan PDF");
};

window.viewRekapBulanan = function () {
  const modal = document.getElementById("modal-rekap");
  if (modal) {
    modal.classList.remove("hidden");
    window.generateRekapBulanan();
  }
};

window.closeModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.classList.add("hidden");

  const index = modalStack.indexOf(modalId);
  if (index > -1) modalStack.splice(index, 1);

  if (modal._escHandler) {
    document.removeEventListener("keydown", modal._escHandler);
    delete modal._escHandler;
  }

  modal.removeAttribute("aria-modal");
  modal.removeAttribute("role");
};

window.generateRekapBulanan = function () {
  const container = document.getElementById("rekap-list");
  if (!container) return;

  container.innerHTML = "";

  if (FILTERED_SANTRI.length === 0) {
    container.innerHTML =
      '<p class="text-center text-slate-400 py-8">Tidak ada data</p>';
    return;
  }

  const now = new Date(appState.date + "T12:00:00");
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const fragment = document.createDocumentFragment();

  FILTERED_SANTRI.forEach((santri) => {
    const id = String(santri.nis || santri.id);
    let h = 0,
      s = 0,
      i = 0,
      p = 0,
      a = 0;

    // Loop Days of Month (actual days)
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const monthStr = String(month + 1).padStart(2, "0");
      const dateKey = `${year}-${monthStr}-${dayStr}`;

      const dayData = appState.attendanceData[dateKey];
      if (dayData) {
        Object.values(SLOT_WAKTU).forEach((slot) => {
          const st = dayData[slot.id]?.[id]?.status?.shalat;
          if (st === "Hadir" || st === "Telat") h++;
          else if (st === "Sakit") s++;
          else if (st === "Izin") i++;
          else if (st === "Pulang") p++;
          else if (st === "Alpa") a++;
        });
      }
    }

    const total = h + s + i + p + a;
    const percent = total === 0 ? 0 : Math.round((h / total) * 100);

    const div = document.createElement("div");
    div.className =
      "glass-card p-4 rounded-2xl flex items-center justify-between mb-2";
    div.innerHTML = `
            <div class="flex-1">
                <h4 class="font-bold text-slate-800 dark:text-white">${window.sanitizeHTML(santri.nama)}</h4>
                <div class="flex gap-4 mt-2 text-xs font-bold">
                    <span class="text-emerald-600">H: ${h}</span>
                    <span class="text-amber-600">S: ${s}</span>
                    <span class="text-blue-600">I: ${i}</span>
                    <span class="text-purple-600">P: ${p}</span>
                    <span class="text-red-600">A: ${a}</span>
                </div>
            </div>
            <div class="text-right">
                <div class="text-2xl font-black ${percent >= 80 ? "text-emerald-500" : percent >= 60 ? "text-amber-500" : "text-red-500"}">${percent}%</div>
                <div class="w-20 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                    <div class="h-full bg-emerald-500 rounded-full transition-all" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    fragment.appendChild(div);
  });

  container.appendChild(fragment);
};

// ==========================================
// 8. LOG & MISC
// ==========================================

window.logActivity = function (action, detail) {
  const log = {
    timestamp: new Date().toISOString(),
    action: action,
    detail: detail,
    user: appState.selectedClass
      ? MASTER_KELAS[appState.selectedClass].musyrif
      : "Unknown",
  };

  appState.activityLog.unshift(log);
  if (
    appState.activityLog.length > window.APP_CONSTANTS.maxActivityLogEntries
  ) {
    appState.activityLog = appState.activityLog.slice(
      0,
      window.APP_CONSTANTS.maxActivityLogEntries,
    );
  }

  localStorage.setItem(
    APP_CONFIG.activityLogKey,
    JSON.stringify(appState.activityLog),
  );
};

window.viewActivityLog = function () {
  const modal = document.getElementById("modal-activity");
  if (modal) {
    modal.classList.remove("hidden");
    const container = document.getElementById("activity-list");
    if (!container) return;

    container.innerHTML = "";
    if (appState.activityLog.length === 0) {
      container.innerHTML =
        '<p class="text-center text-slate-400 py-8">Belum ada aktivitas</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    appState.activityLog.forEach((log) => {
      const time = new Date(log.timestamp);
      const div = document.createElement("div");
      div.className = "glass-card p-4 rounded-2xl flex gap-4 mb-2";
      div.innerHTML = `
                <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="activity" class="w-5 h-5 text-emerald-600"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 dark:text-white text-sm">${window.sanitizeHTML(log.action)}</h4>
                    <p class="text-xs text-slate-500 truncate">${window.sanitizeHTML(log.detail)}</p>
                    <p class="text-[10px] text-slate-400 mt-1">${time.toLocaleString("id-ID")}</p>
                </div>
            `;
      fragment.appendChild(div);
    });
    container.appendChild(fragment);
    if (window.lucide) window.lucide.createIcons();
  }
};

window.kirimLaporanWA = function () {
  if (!FILTERED_SANTRI.length) return alert("Pilih kelas dulu");

  const slot = SLOT_WAKTU[appState.currentSlotId];
  const stats = window.calculateSlotStats(slot.id);
  const dbSlot = appState.attendanceData[appState.date]?.[slot.id];

  // PERBAIKAN: Dinamis ambil ID aktivitas utama (shalat atau kbm_sekolah)
  const mainActId = slot.activities[0]?.id || "shalat";

  let msg = `*LAPORAN ${appState.selectedClass} - ${slot.label}*\n`;
  msg += `📅 ${window.formatDate(appState.date)}\n\n`;
  msg += `✅ Hadir: ${stats.h}\n`;
  msg += `🤒 Sakit: ${stats.s}\n`;
  msg += `📝 Izin: ${stats.i}\n`;
  msg += `❌ Alpa: ${stats.a}\n\n`;

  const notPresent = [];
  FILTERED_SANTRI.forEach((s) => {
    const id = String(s.nis || s.id);
    const st = dbSlot?.[id]?.status?.[mainActId]; // <-- PERBAIKAN DI SINI
    if (st === "Alpa" || st === "Sakit" || st === "Izin" || st === "Pulang") {
      notPresent.push(`- ${s.nama} (${st})`);
    }
  });

  if (notPresent.length) {
    msg += `*Detail Tidak Hadir:*\n${notPresent.join("\n")}\n`;
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`);
};

window.showToast = function (message, type = "info", isPersistent = false) {
  if (!appState.settings.notifications && !isPersistent) return;

  const container = document.getElementById("toast-container");
  if (!container) return;

  // PERBAIKAN: Cegah Toast Dobel dengan mengecek pesan yang identik
  const existingToasts = container.querySelectorAll(".toast-msg-text");
  for (let i = 0; i < existingToasts.length; i++) {
    if (existingToasts[i].textContent === message) {
      // Batalkan pembuatan toast baru jika pesan yang sama persis masih ada di layar
      return existingToasts[i].closest(".toast-element");
    }
  }

  const toast = document.createElement("div");
  const icons = {
    success: "check-circle",
    error: "x-circle",
    warning: "alert-triangle",
    info: "info",
  };

  // Tambahkan class penanda 'toast-element' agar lebih mudah diidentifikasi
  toast.className = `toast-element ${UI_COLORS[type] || UI_COLORS.info} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-[slideUp_0.3s_ease-out] mb-3 z-[9999] cursor-pointer pointer-events-auto`;

  // Tambahkan class penanda 'toast-msg-text' pada bagian teks
  toast.innerHTML = `
        <i data-lucide="${icons[type] || "info"}" class="w-5 h-5" aria-hidden="true"></i>
        <span class="toast-msg-text font-bold text-xs" role="alert">${window.sanitizeHTML(message)}</span>
    `;

  // Fitur Tambahan: Toast sekarang bisa ditutup instan jika di-klik/disentuh (Anti-annoying)
  toast.onclick = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-20px)";
    setTimeout(() => toast.remove(), 300);
  };

  container.appendChild(toast);
  window.refreshIcons();

  if (!isPersistent) {
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  } else {
    setTimeout(() => toast.remove(), 10000);
  }

  return toast;
};

window.toggleDarkMode = function () {
  document.documentElement.classList.toggle("dark");
  appState.settings.darkMode =
    document.documentElement.classList.contains("dark");
  localStorage.setItem(
    APP_CONFIG.settingsKey,
    JSON.stringify(appState.settings),
  );
  window.updateMetaThemeColor();
  window.showToast(
    `Mode ${appState.settings.darkMode ? "Gelap" : "Terang"} Aktif`,
    "success",
  );
};

window.toggleNotifications = function () {
  appState.settings.notifications = !appState.settings.notifications;
  localStorage.setItem(
    APP_CONFIG.settingsKey,
    JSON.stringify(appState.settings),
  );

  const btn = document.getElementById("btn-notifications");
  if (btn) btn.classList.toggle("opacity-50", !appState.settings.notifications);

  window.showToast(
    `Notifikasi ${appState.settings.notifications ? "Aktif" : "Nonaktif"}`,
    "info",
  );
};

window.saveData = function () {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const dataStr = JSON.stringify(appState.attendanceData);

      // Check localStorage quota (iOS Safari limit ~5MB)
      if (dataStr.length > window.APP_CONSTANTS.maxStorageBytes) {
        console.warn("Data mendekati batas storage!");
        window.showToast("Data hampir penuh. Pertimbangkan export.", "warning");
      }




      const indicator = document.getElementById("save-indicator");
      if (appState.settings.autoSave && indicator) {
        const reviewStatus =
          indicator.dataset.attendanceReviewStatus === "idle"
            ? ""
            : indicator.dataset.attendanceReviewStatus;
        if (!reviewStatus) {
          indicator.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5 text-amber-500"></i>';
          if (window.lucide) window.lucide.createIcons();
        }
        
        setTimeout(() => {
          try {
            localStorage.setItem(APP_CONFIG.storageKey, dataStr);
            if (indicator) {
              if (indicator.dataset.attendanceReviewStatus) {
                const latestReviewStatus = indicator.dataset.attendanceReviewStatus;
                window.setAttendanceSaveIndicator?.(latestReviewStatus);
              } else {
                indicator.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5 text-emerald-400"></i>';
                if (window.lucide) window.lucide.createIcons();
                setTimeout(() => {
                  if (indicator && !indicator.dataset.attendanceReviewStatus) {
                    indicator.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5 text-slate-400"></i>';
                    if (window.lucide) window.lucide.createIcons();
                  }
                }, 1500);
              }
            }
          } catch (innerErr) {
            console.error("Inner save error:", innerErr);
          }
        }, 500);
      } else {
        localStorage.setItem(APP_CONFIG.storageKey, dataStr);
      }
    } catch (e) {
      if (e.name === "QuotaExceededError") {
        window.showToast("Storage penuh! Hapus data lama.", "error");
      } else {
        window.showToast("Gagal menyimpan: " + e.message, "error");
      }
      console.error("Save error:", e);
    }
  }, 500); // Increased debounce for better batching
};

window.changeStatsRange = function (range) {
  appState.statsRange = range;
  
  const buttons = ['weekly', 'monthly', 'semester'];
  buttons.forEach(btnKey => {
    const el = document.getElementById(`stats-range-${btnKey}`);
    if (el) {
      if (btnKey === range) {
        el.className = "flex-1 md:flex-none px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-200/50 dark:border-slate-700/50";
      } else {
        el.className = "flex-1 md:flex-none px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent";
      }
    }
  });

  window.updateQuickStats();
  window.drawDonutChart();
};

window.updateQuickStats = function () {
  if (!appState.selectedClass) return;

  const range = appState.statsRange || 'weekly';
  let daysCount = 7;
  if (range === 'monthly') daysCount = 30;
  if (range === 'semester') daysCount = 180;

  // Helper to generate dates list
  const getDatesForRange = (baseDateStr, count, offset = 0) => {
    const dates = [];
    const baseDate = new Date(baseDateStr);
    baseDate.setDate(baseDate.getDate() - offset);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  };

  const currentDates = getDatesForRange(appState.date, daysCount, 0);
  const prevDates = getDatesForRange(appState.date, daysCount, daysCount);

  // Compute stats for current period
  let totalStats = { h: 0, s: 0, i: 0, p: 0, t: 0, a: 0, total: 0 };
  let daysWithData = 0;

  currentDates.forEach((dateKey) => {
    let dayFilled = false;
    let dayStats = { h: 0, s: 0, i: 0, p: 0, t: 0, a: 0, total: 0 };
    Object.values(SLOT_WAKTU).forEach((slot) => {
      const stats = window.calculateSlotStats(slot.id, dateKey);
      if (stats.isFilled) {
        dayStats.h += stats.h;
        dayStats.s += stats.s;
        dayStats.i += stats.i;
        dayStats.p += stats.p || 0;
        dayStats.t += stats.t || 0;
        dayStats.a += stats.a;
        dayStats.total += stats.total;
        dayFilled = true;
      }
    });
    if (dayFilled) {
      totalStats.h += dayStats.h;
      totalStats.s += dayStats.s;
      totalStats.i += dayStats.i;
      totalStats.p += dayStats.p;
      totalStats.t += dayStats.t;
      totalStats.a += dayStats.a;
      totalStats.total += dayStats.total;
      daysWithData++;
    }
  });

  const divisor = daysWithData > 0 ? daysWithData : 1;

  // Set numeric indicators (percentage of total events in this period)
  const totalPeriodPeristiwa = totalStats.total > 0 ? totalStats.total : 1;
  const hadirCount = totalStats.h + totalStats.t;
  const tidakHadirCount = totalStats.s + totalStats.i + totalStats.p + totalStats.a;

  if (document.getElementById("stat-hadir")) {
    document.getElementById("stat-hadir").textContent = Math.round((hadirCount / totalPeriodPeristiwa) * 100) + "%";
  }
  if (document.getElementById("stat-tidak-hadir")) {
    document.getElementById("stat-tidak-hadir").textContent = Math.round((tidakHadirCount / totalPeriodPeristiwa) * 100) + "%";
  }

  // Calculate current & previous period attendance rate
  const calculateRate = (datesList) => {
    let hadir = 0;
    let total = 0;
    datesList.forEach(dateKey => {
      Object.values(SLOT_WAKTU).forEach(slot => {
        const sStats = window.calculateSlotStats(slot.id, dateKey);
        if (sStats.isFilled) {
          hadir += sStats.h;
          total += sStats.total;
        }
      });
    });
    return total > 0 ? (hadir / total) * 100 : 100; // default to 100% if empty
  };

  const currentRate = calculateRate(currentDates);
  const prevRate = calculateRate(prevDates);
  const rateDiff = currentRate - prevRate;

  // Set top percentage label
  document.getElementById("stats-current-percentage").innerHTML = `${currentRate.toFixed(1)}% <span class="text-xl sm:text-2xl font-bold text-slate-400 dark:text-slate-500">Hadir</span>`;

  // Set comparison badge
  const comparisonEl = document.getElementById("stats-comparison-badge");
  if (comparisonEl) {
    const periodLabel = range === 'weekly' ? 'pekan lalu' : range === 'monthly' ? 'bulan lalu' : 'semester lalu';
    if (rateDiff >= 0) {
      comparisonEl.className = "flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-sm shrink-0";
      comparisonEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
        <span>+${rateDiff.toFixed(1)}% vs ${periodLabel}</span>
      `;
    } else {
      comparisonEl.className = "flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 shadow-sm shrink-0";
      comparisonEl.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-down"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
        <span>${rateDiff.toFixed(1)}% vs ${periodLabel}</span>
      `;
    }
  }
};

window.drawDonutChart = function () {
  const canvas = document.getElementById("weekly-chart");

  if (!canvas || canvas.offsetParent === null) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const dpr = window.devicePixelRatio || 1;

  if (
    canvas.width !== rect.width * dpr ||
    canvas.height !== rect.height * dpr
  ) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }

  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const range = appState.statsRange || 'weekly';
  const getDatesForRange = (baseDateStr, count) => {
    const dates = [];
    const baseDate = new Date(baseDateStr);
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  };

  // 1. Group/Retrieve data points based on selected range
  const groupedData = [];
  const classSize = (FILTERED_SANTRI && FILTERED_SANTRI.length) || 30;

  const getStatsForDates = (datesList) => {
    let stats = { h: 0, s: 0, i: 0, p: 0, t: 0, a: 0 };
    let filledSlots = 0;
    datesList.forEach(dateKey => {
      Object.values(SLOT_WAKTU).forEach(slot => {
        const sStats = window.calculateSlotStats(slot.id, dateKey);
        if (sStats.isFilled) {
          stats.h += sStats.h;
          stats.s += sStats.s;
          stats.i += sStats.i;
          stats.p += sStats.p || 0;
          stats.t += sStats.t || 0;
          stats.a += sStats.a;
          filledSlots++;
        }
      });
    });

    const div = filledSlots > 0 ? filledSlots : 1;
    return {
      hadir: stats.h / div,
      sakit: stats.s / div,
      izin: stats.i / div,
      pulang: stats.p / div,
      telat: stats.t / div,
      alpa: stats.a / div,
      hasData: filledSlots > 0
    };
  };

  if (range === 'weekly') {
    const dates = getDatesForRange(appState.date, 7);
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    dates.forEach(dateKey => {
      const stats = getStatsForDates([dateKey]);
      const dateObj = new Date(dateKey);
      groupedData.push({
        label: dayNames[dateObj.getDay()],
        stats: stats.hasData ? stats : { hadir: classSize, sakit: 0, izin: 0, pulang: 0, telat: 0, alpa: 0 }
      });
    });
  } else if (range === 'monthly') {
    // 4 points (4 weeks)
    const dates = getDatesForRange(appState.date, 28);
    for (let w = 0; w < 4; w++) {
      const weekDates = dates.slice(w * 7, (w + 1) * 7);
      const stats = getStatsForDates(weekDates);
      groupedData.push({
        label: `W-${4 - w}`,
        stats: stats.hasData ? stats : { hadir: classSize, sakit: 0, izin: 0, pulang: 0, telat: 0, alpa: 0 }
      });
    }
  } else if (range === 'semester') {
    // 6 points (6 months)
    const baseDate = new Date(appState.date);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    for (let m = 5; m >= 0; m--) {
      const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - m, 1);
      const y = targetDate.getFullYear();
      const mIdx = targetDate.getMonth();
      const daysCount = new Date(y, mIdx + 1, 0).getDate();
      const monthDates = [];
      for (let d = 1; d <= daysCount; d++) {
        const dd = String(d).padStart(2, '0');
        const mm = String(mIdx + 1).padStart(2, '0');
        monthDates.push(`${y}-${mm}-${dd}`);
      }
      const stats = getStatsForDates(monthDates);
      groupedData.push({
        label: monthNames[mIdx],
        stats: stats.hasData ? stats : { hadir: classSize, sakit: 0, izin: 0, pulang: 0, telat: 0, alpa: 0 }
      });
    }
  }

  // Draw chart elements
  const paddingLeft = 25;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxY = Math.max(classSize, 10);
  const minY = 0;

  const isDark = document.documentElement.classList.contains("dark");
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const labelColor = isDark ? "#64748b" : "#94a3b8";

  // Y-axis grid & labels
  const gridSteps = 3;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = labelColor;
  ctx.font = "bold 9px 'Plus Jakarta Sans', sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= gridSteps; i++) {
    const val = Math.round(minY + (maxY - minY) * (i / gridSteps));
    const y = paddingTop + chartHeight - (i / gridSteps) * chartHeight;

    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    ctx.fillText(val.toString(), paddingLeft - 6, y);
  }

  // Coordinates
  const points = { h: [], nh: [] };
  const pointKeys = ['h', 'nh'];

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const dataLength = groupedData.length;
  groupedData.forEach((d, idx) => {
    const x = paddingLeft + (idx / (dataLength - 1)) * chartWidth;
    
    // Draw X label
    ctx.fillText(d.label, x, height - paddingBottom + 6);

    const valHadir = d.stats.hadir + d.stats.telat;
    const valTidakHadir = d.stats.sakit + d.stats.izin + d.stats.pulang + d.stats.alpa;

    // Y coords
    points.h.push({ x, y: paddingTop + chartHeight - (valHadir / maxY) * chartHeight });
    points.nh.push({ x, y: paddingTop + chartHeight - (valTidakHadir / maxY) * chartHeight });
  });

  // Helper to draw lines
  function drawSmoothLine(pts, strokeColor, fillColor) {
    if (pts.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let idx = 0; idx < pts.length - 1; idx++) {
      const p0 = pts[idx];
      const p1 = pts[idx + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
      const cpY2 = p1.y;

      ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, p1.x, p1.y);
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();

    if (fillColor) {
      ctx.lineTo(pts[pts.length - 1].x, paddingTop + chartHeight);
      ctx.lineTo(pts[0].x, paddingTop + chartHeight);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
  }

  // Draw 2 curves with specific colors
  const colors = {
    h: '#3b82f6',  // Hadir - Blue
    nh: '#f43f5e'  // Tidak Hadir - Rose/Red
  };

  // Gradients for area fills
  const gradHadir = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  gradHadir.addColorStop(0, "rgba(59, 130, 246, 0.08)");
  gradHadir.addColorStop(1, "rgba(59, 130, 246, 0.0)");

  const gradTidakHadir = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  gradTidakHadir.addColorStop(0, "rgba(244, 63, 94, 0.05)");
  gradTidakHadir.addColorStop(1, "rgba(244, 63, 94, 0.0)");

  // Draw curves
  drawSmoothLine(points.nh, colors.nh, gradTidakHadir);
  drawSmoothLine(points.h, colors.h, gradHadir);

  // Draw circular points for interaction/detail
  groupedData.forEach((_, idx) => {
    pointKeys.forEach(k => {
      const pt = points[k][idx];
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
      ctx.fillStyle = colors[k];
      ctx.fill();
      ctx.strokeStyle = isDark ? "#1e293b" : "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
  });
};

// ==========================================
// 9. TABS & NAVIGATION
// ==========================================

window.switchTab = function (tabName) {
  // 1. Sembunyikan semua konten tab
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.add("hidden"));

  // 2. Atur visibilitas Main Content (Dashboard)
  const mainContent = document.getElementById("main-content");
  if (tabName === "home") {
    mainContent.classList.remove("hidden");
  } else {
    mainContent.classList.add("hidden");
  }

  // 3. Tampilkan Tab Target (Laporan/Profil/Analisis)
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.remove("hidden");

  // 4. Update Style Tombol Navigasi
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (btn.dataset.target === tabName) {
      btn.classList.add("active");
      btn.classList.remove("text-emerald-500", "text-orange-500", "text-slate-400");
    } else {
      btn.classList.remove("active", "text-emerald-500", "text-orange-500");
      btn.classList.add("text-slate-400");
    }
  });

  // 4.5. Update Bottom Nav Expansion State for new tab
  const bottomNav = document.querySelector("nav");
  if (bottomNav) {
    const activeTab = tabName === "home" ? document.getElementById("main-content") : document.getElementById(`tab-${tabName}`);
    if (activeTab && activeTab.scrollTop > 20) {
      bottomNav.classList.add("nav-expanded");
    } else {
      bottomNav.classList.remove("nav-expanded");
    }
  }

  // 5. Jalankan Logika Spesifik per Tab
  if (tabName === "home") {
    window.updateDashboard();
  } else if (tabName === "report") {
    window.updateReportTab();
  } else if (tabName === "tahfizh") {
    if (window.initTahfizhTab) window.initTahfizhTab();
  } else if (tabName === "profile") {
    appState.timesheetViewDate = appState.date; // <--- TAMBAHKAN INI
    window.updateProfileStats();
    window.renderTimesheetCalendar();
    window.renderPembinaanManagement(); // Refresh list di profil
    window.renderPermitHistory();
  }
  // 6. Refresh Icon Lucide
  if (window.lucide) window.lucide.createIcons();
};

window.getGrade = function (score) {
  if (score >= 97) return "A";
  if (score >= 93) return "A-";
  if (score >= 89) return "B+";
  if (score >= 85) return "B";
  if (score >= 80) return "B-";
  if (score >= 75) return "C+";
  if (score >= 70) return "C";
  return "D";
};

window.getPredikat = function (grade) {
  if (grade === "A" || grade === "A-") {
    return "Mumtaz";
  }
  if (grade === "B+" || grade === "B") {
    return "Jayyid Jiddan";
  }
  if (grade === "B-" || grade === "C+") {
    return "Jayyid";
  }
  return "Maqbul";
};

window.getPredikatMeaning = function (grade) {
  if (grade === "A") return "Sempurna";
  if (grade === "A-") return "Istimewa";
  if (grade === "B+" || grade === "B") return "Baik Sekali";
  if (grade === "B-" || grade === "C+") return "Baik";
  if (grade === "C") return "Cukup";
  return "Kurang";
};

window.renderReportTableLegend = function () {
  const legend = document.getElementById("report-table-legend");
  if (!legend) return;

  const statusItems = [
    ["Hadir", "H"],
    ["Telat", "T"],
    ["Sakit", "S"],
    ["Izin", "I"],
    ["Pulang", "P"],
    ["Alpa", "A"],
    ["Tidak", "-"],
  ];
  const statusChips = statusItems
    .map(([status, code]) => {
      const meta = window.getStatusMeta(status);
      return `
        <span class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 ${meta.pill} shrink-0" title="${status}">
          <i data-lucide="${meta.icon}" class="w-3 h-3"></i>
          <span class="text-[9px] font-black uppercase tracking-wide">${code}</span>
          <span class="text-[9px] font-bold hidden sm:inline">${status}</span>
        </span>
      `;
    })
    .join("");

  const slotChips =
    appState.reportMode === "daily"
      ? `
        <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0"></span>
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-500 dark:text-slate-300 shrink-0">
          <span class="text-[9px] font-black">S</span>
          <span class="text-[9px] font-bold">Shubuh</span>
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-500 dark:text-slate-300 shrink-0">
          <span class="text-[9px] font-black">A</span>
          <span class="text-[9px] font-bold">Ashar</span>
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-500 dark:text-slate-300 shrink-0">
          <span class="text-[9px] font-black">M</span>
          <span class="text-[9px] font-bold">Maghrib</span>
        </span>
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-500 dark:text-slate-300 shrink-0">
          <span class="text-[9px] font-black">I</span>
          <span class="text-[9px] font-bold">Isya</span>
        </span>
      `
      : "";

  legend.innerHTML = `
    <div class="flex items-center gap-2 overflow-x-auto hide-scrollbar">
      <span class="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
        <i data-lucide="info" class="w-3 h-3"></i>
        Legenda
      </span>
      ${statusChips}
      <span class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-slate-500 dark:text-slate-300 shrink-0" title="Libur">
        <i data-lucide="calendar-x" class="w-3 h-3"></i>
        <span class="text-[9px] font-black">L</span>
        <span class="text-[9px] font-bold hidden sm:inline">Libur</span>
      </span>
      <span class="inline-flex items-center gap-1.5 rounded-lg border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300 shrink-0" title="Perlu review">
        <i data-lucide="loader-circle" class="w-3 h-3"></i>
        <span class="text-[9px] font-black">P</span>
        <span class="text-[9px] font-bold hidden sm:inline">Proses</span>
      </span>
      ${slotChips}
    </div>
  `;
};

window.updateReportTab = function () {
  const tbody = document.getElementById("daily-recap-tbody");
  const rangeLabel = document.getElementById("report-date-range");
  const thead = document.querySelector("#tab-report thead tr");

  if (thead) {
    let headerHTML = `
            <th class="p-3.5 font-black w-10 text-center">No</th>
            <th class="p-3.5 font-black min-w-[160px]"><span class="inline-flex items-center gap-1.5"><i data-lucide="user-round" class="w-3.5 h-3.5"></i> Santri</span></th>
        `;

    if (appState.reportMode === "daily") {
      headerHTML += `
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="moon" class="w-3.5 h-3.5 text-emerald-500"></i> Shalat</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="graduation-cap" class="w-3.5 h-3.5 text-cyan-500"></i> Sekolah</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="book-open" class="w-3.5 h-3.5 text-blue-500"></i> Ma'had</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-500"></i> Sunnah</span></th>
            `;
    } else if (
      appState.reportMode === "weekly" ||
      appState.reportMode === "monthly"
    ) {
      headerHTML += `
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="moon" class="w-3.5 h-3.5 text-emerald-500"></i> Shalat</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="graduation-cap" class="w-3.5 h-3.5 text-cyan-500"></i> Sekolah</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="book-open" class="w-3.5 h-3.5 text-blue-500"></i> Ma'had</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-500"></i> Sunnah</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="trending-up" class="w-3.5 h-3.5 text-palette-blue"></i> Tren</span></th>
            `;
    } else if (appState.reportMode === "semester") {
      headerHTML += `
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="moon" class="w-3.5 h-3.5 text-emerald-500"></i> Shalat</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="graduation-cap" class="w-3.5 h-3.5 text-cyan-500"></i> Sekolah</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="book-open" class="w-3.5 h-3.5 text-blue-500"></i> Ma'had</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-amber-500"></i> Sunnah</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="award" class="w-3.5 h-3.5 text-palette-blue"></i> Grade</span></th>
                <th class="p-3.5 font-black text-center"><span class="inline-flex items-center gap-1.5"><i data-lucide="trending-up" class="w-3.5 h-3.5 text-palette-blue"></i> Tren</span></th>
            `;
    }

    thead.innerHTML = headerHTML;
    if (window.lucide) window.lucide.createIcons();
  }

  window.renderReportTableLegend();

  if (!tbody) return;
  tbody.innerHTML = "";

  window.syncPeriodPicker("report");
  const range = window.getReportDateRange(appState.reportMode);
  if (rangeLabel) rangeLabel.textContent = range.label;

  const colspan = appState.reportMode === "semester" ? 8 : (appState.reportMode === "weekly" || appState.reportMode === "monthly" ? 7 : 6);

  if (!appState.selectedClass || FILTERED_SANTRI.length === 0) {
    tbody.innerHTML =
      `<tr><td colspan="${colspan}" class="p-4 text-center text-xs text-slate-400">Pilih kelas terlebih dahulu</td></tr>`;
    return;
  }

  const STATUS_WEIGHT = {
    Hadir: 100,
    Telat: 90,

    Izin: 75,
    Sakit: 75,

    Pulang: 0,

    Alpa: -50,

    Ya: 100,
    Tidak: 0,
  };
  const getPoint = (status) => window.getStatusScore?.(status) ?? STATUS_WEIGHT[status] ?? 0;

  // OPTIMIZATION: Use Map for O(1) lookup
  const santriStatsMap = new Map();
  FILTERED_SANTRI.forEach((s) => {
    santriStatsMap.set(s.nis || s.id, {
      shalat: {
        score: 0,
        total: 0,
        h: 0,
      },

      sunnah: {
        score: 0,
        total: 0,
        y: 0,
      },

      sekolah: {
        score: 0,
        total: 0,
        h: 0,
      },

      mahad: {
        score: 0,
        total: 0,
        h: 0,
      },
    });
  });

  // OPTIMIZATION: Pre-calculate date range (avoid while loop)
  const startTime = range.start.getTime();
  const endTime = range.end.getTime();
  const dayInMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.min(
    Math.ceil((endTime - startTime) / dayInMs) + 1,
    370,
  );
  const trendPrevRange = (() => {
    if (appState.reportMode === "weekly") {
      const prevBase = new Date(range.start);
      prevBase.setDate(prevBase.getDate() - 7);
      return window.getDateRange("weekly", window.getLocalDateStr(prevBase));
    }
    if (appState.reportMode === "monthly") {
      const prevBase = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
      return window.getDateRange("monthly", window.getLocalDateStr(prevBase));
    }
    if (appState.reportMode === "semester") {
      const prevBase = new Date(range.start.getFullYear(), range.start.getMonth() - 6, 1);
      return window.getDateRange("semester", window.getLocalDateStr(prevBase));
    }
    return null;
  })();

  for (let i = 0; i < totalDays; i++) {
    const currentDate = new Date(startTime + i * dayInMs);
    const dateKey = window.getLocalDateStr(currentDate);
    const dayNum = currentDate.getDay();
    const dayData = appState.attendanceData[dateKey];

    if (!dayData) continue;

    Object.values(SLOT_WAKTU).forEach((slot) => {
      if (window.isSlotHoliday(slot.id, dateKey)) return;
      const slotData = dayData[slot.id];
      if (!window.isAttendanceSlotFinalForReport(slotData)) return;

      FILTERED_SANTRI.forEach((s) => {
        const id = String(s.nis || s.id);
        const sData = slotData?.[id];
        const stats = santriStatsMap.get(id);

        if (!sData || !stats) return;

        slot.activities.forEach((act) => {
          if (act.showOnDays && !act.showOnDays.includes(dayNum)) return;
          if (act.onlyRamadhan && !window.isRamadhan(dateKey)) return;
          if (window.isActivityHoliday(dateKey, slot.id, act.id)) return;
          if (window.isCategoryHoliday(dateKey, act.category)) return;

          const st = sData.status[act.id];

          const point = getPoint(st) ?? 0;

          if (act.category === "fardu") {
            stats.shalat.score += point;
          } else if (act.category === "sunnah") {
            stats.sunnah.score += point;
          } else if (act.category === "school") {
            stats.sekolah.score += point;
          } else if (act.category === "kbm") {
            stats.mahad.score += point;
          }

          if (act.category === "fardu") {
            stats.shalat.total++;

            if (st === "Hadir" || st === "Telat") {
              stats.shalat.h++;
            }
          } else if (act.category === "school") {
            stats.sekolah.total++;

            if (st === "Hadir" || st === "Telat") {
              stats.sekolah.h++;
            }
          } else if (act.category === "kbm") {
            stats.mahad.total++;

            if (st === "Hadir" || st === "Telat") {
              stats.mahad.h++;
            }
          } else if (act.category === "sunnah") {
            stats.sunnah.total++;

            if (st === "Ya" || st === "Hadir") {
              stats.sunnah.y++;
            }
          }
        });
      });
    });
  }

  // RENDER with DocumentFragment
  const fragment = document.createDocumentFragment();
  const makeBar = (pct, color) => {
    const hasValue = pct !== null && pct !== undefined;
    const safePct = hasValue ? Math.max(0, Math.min(100, pct)) : 0;
    return `
        <div class="flex flex-col items-center gap-1">
            <span class="text-[10px] font-black ${!hasValue ? "text-slate-400" : pct < 60 ? "text-red-500" : "text-slate-700 dark:text-slate-200"}">${hasValue ? `${pct}%` : "-"}</span>
            <div class="w-14 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div class="h-full ${hasValue ? color : "bg-slate-300 dark:bg-slate-700"} transition-all duration-300" style="width: ${safePct}%"></div>
            </div>
        </div>`;
  };
  const renderTrend = (currentScore, previousScore) => {
    if (currentScore === null) {
      return `<span class="inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 px-2.5 py-1.5 text-[10px] font-black">Belum</span>`;
    }
    if (previousScore === null) {
      return `<span class="inline-flex items-center gap-1 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 px-2.5 py-1.5 text-[10px] font-black"><i data-lucide="sparkles" class="w-3 h-3"></i> Baru</span>`;
    }
    const diff = currentScore - previousScore;
    if (diff >= 5) {
      return `<span class="inline-flex items-center gap-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-2.5 py-1.5 text-[10px] font-black"><i data-lucide="trending-up" class="w-3 h-3"></i> Naik ${diff}</span>`;
    }
    if (diff <= -5) {
      return `<span class="inline-flex items-center gap-1 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 px-2.5 py-1.5 text-[10px] font-black"><i data-lucide="trending-down" class="w-3 h-3"></i> Turun ${Math.abs(diff)}</span>`;
    }
    return `<span class="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1.5 text-[10px] font-black"><i data-lucide="minus" class="w-3 h-3"></i> Stabil</span>`;
  };

  FILTERED_SANTRI.forEach((s, idx) => {
    const id = String(s.nis || s.id);
    const stats = santriStatsMap.get(id);
    if (!stats) return;

    const shalatPct = stats.shalat.total
      ? stats.shalat.score / stats.shalat.total
      : 0;

    const sunnahPct = stats.sunnah.total
      ? stats.sunnah.score / stats.sunnah.total
      : 0;

    const sekolahPct = stats.sekolah.total
      ? stats.sekolah.score / stats.sekolah.total
      : 0;

    const mahadPct = stats.mahad.total
      ? stats.mahad.score / stats.mahad.total
      : 0;

    const scoreList = [];

    if (stats.shalat.total > 0) scoreList.push(shalatPct);

    if (stats.sekolah.total > 0) scoreList.push(sekolahPct);

    if (stats.mahad.total > 0) scoreList.push(mahadPct);

    if (stats.sunnah.total > 0) scoreList.push(sunnahPct);

    const hasReportScore = scoreList.length > 0;
    const finalScore = hasReportScore
      ? Math.round(scoreList.reduce((a, b) => a + b, 0) / scoreList.length)
      : null;

    const shalatGrade = stats.shalat.total ? window.getGrade(Math.round(shalatPct)) : "-";

    const sunnahGrade = stats.sunnah.total ? window.getGrade(Math.round(sunnahPct)) : "-";

    const sekolahGrade = stats.sekolah.total ? window.getGrade(Math.round(sekolahPct)) : "-";

    const mahadGrade = stats.mahad.total ? window.getGrade(Math.round(mahadPct)) : "-";

    const shalatPredikat = stats.shalat.total ? window.getPredikat(shalatGrade) : "Tidak dinilai";

    const sunnahPredikat = stats.sunnah.total ? window.getPredikat(sunnahGrade) : "Tidak dinilai";

    const sekolahPredikat = stats.sekolah.total ? window.getPredikat(sekolahGrade) : "Tidak dinilai";

    const mahadPredikat = stats.mahad.total ? window.getPredikat(mahadGrade) : "Tidak dinilai";

    const grade = hasReportScore ? window.getGrade(finalScore) : "-";

    const predikat = hasReportScore ? window.getPredikat(grade) : "Tidak dinilai";

    const tr = document.createElement("tr");
    tr.className =
      "group hover:bg-blue-50/40 dark:hover:bg-slate-800/70 transition-colors border-b border-slate-100/80 dark:border-slate-800";

    let shalatCol, schoolCol, kbmCol, sunnahCol;
    let trendCol = "";

    if (appState.reportMode === "daily") {
      const dateKey = appState.reportDate || appState.date;
      const dayData = appState.attendanceData[dateKey] || {};

      let badges = "";
      ["shubuh", "ashar", "maghrib", "isya"].forEach((sid) => {
        const meta = window.getDailyReportStatusMeta(
          dateKey,
          sid,
          id,
          "shalat",
        );
        const label = meta.status && !["Libur", "Proses"].includes(meta.status)
          ? sid[0].toUpperCase()
          : meta.label;
        badges += `<span class="w-5 h-5 flex items-center justify-center rounded border ${meta.className} text-[9px] font-black" aria-label="${meta.aria}">${label}</span>`;
      });
      shalatCol = `<div class="flex justify-center gap-1" role="list">${badges}</div>`;

      const schoolMeta = window.getDailyReportStatusMeta(
        dateKey,
        "sekolah",
        id,
        "kbm_sekolah",
      );
      if (schoolMeta.status === "Hadir") {
        schoolMeta.className = "bg-cyan-100 text-cyan-600 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30";
      }
      schoolCol = `<div class="flex justify-center"><span class="w-6 h-6 flex items-center justify-center rounded-lg border ${schoolMeta.className} text-[10px] font-black shadow-sm" aria-label="${schoolMeta.aria}">${schoolMeta.label}</span></div>`;

      const kbmTotal = stats.mahad.total || 0;
      const sunnahTotal = stats.sunnah.total || 0;
      const isKbmActiveToday = window.isReportCategoryActiveOnDate(dateKey, "kbm");
      const isSunnahActiveToday = window.isReportCategoryActiveOnDate(dateKey, "sunnah");
      kbmCol = `
        <div class="inline-flex items-center gap-2 rounded-xl ${isKbmActiveToday ? "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"} border px-2.5 py-1.5 min-w-[76px] justify-center">
          <i data-lucide="${isKbmActiveToday ? "book-open-check" : "calendar-x"}" class="w-3.5 h-3.5 ${isKbmActiveToday ? "text-blue-500" : "text-slate-400"}"></i>
          <span class="font-black ${isKbmActiveToday ? "text-blue-700 dark:text-blue-300" : "text-slate-500"}">${kbmTotal ? stats.mahad.h : (isKbmActiveToday ? "-" : "L")}</span>
          <span class="text-[9px] font-bold ${isKbmActiveToday ? "text-blue-400" : "text-slate-400"}">${kbmTotal ? `/${kbmTotal}` : ""}</span>
        </div>
      `;
      sunnahCol = `
        <div class="inline-flex items-center gap-2 rounded-xl ${isSunnahActiveToday ? "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"} border px-2.5 py-1.5 min-w-[76px] justify-center">
          <i data-lucide="${isSunnahActiveToday ? "sparkles" : "calendar-x"}" class="w-3.5 h-3.5 ${isSunnahActiveToday ? "text-amber-500" : "text-slate-400"}"></i>
          <span class="font-black ${isSunnahActiveToday ? "text-amber-700 dark:text-amber-300" : "text-slate-500"}">${sunnahTotal ? stats.sunnah.y : (isSunnahActiveToday ? "-" : "L")}</span>
          <span class="text-[9px] font-bold ${isSunnahActiveToday ? "text-amber-400" : "text-slate-400"}">${sunnahTotal ? `/${sunnahTotal}` : ""}</span>
        </div>
      `;
    } else {
      const pctShalat = stats.shalat.total
        ? Math.round(stats.shalat.score / stats.shalat.total)
        : null;

      const pctSekolah = stats.sekolah.total
        ? Math.round(stats.sekolah.score / stats.sekolah.total)
        : null;

      const pctMahad = stats.mahad.total
        ? Math.round(stats.mahad.score / stats.mahad.total)
        : null;

      const pctSunnah = stats.sunnah.total
        ? Math.round(stats.sunnah.score / stats.sunnah.total)
        : null;

      shalatCol = makeBar(pctShalat, "bg-emerald-500");
      schoolCol = makeBar(pctSekolah, "bg-cyan-500");
      kbmCol = makeBar(pctMahad, "bg-blue-500");
      sunnahCol = makeBar(pctSunnah, "bg-amber-500");
      if ((appState.reportMode === "weekly" || appState.reportMode === "monthly") && trendPrevRange) {
        const previous = window.calculateReportScoreForStudentRange(id, trendPrevRange);
        trendCol = renderTrend(finalScore, previous.score);
      }
    }

    if (appState.reportMode === "semester" && trendPrevRange) {
      const previous = window.calculateReportScoreForStudentRange(id, trendPrevRange);
      trendCol = renderTrend(finalScore, previous.score);
    }

    let scoreColor = "text-slate-400";
    if (hasReportScore && finalScore >= 85) scoreColor = "text-emerald-500";
    else if (hasReportScore && finalScore >= 70) scoreColor = "text-blue-500";
    else if (hasReportScore && finalScore >= 50) scoreColor = "text-amber-500";
    else if (hasReportScore) scoreColor = "text-red-500";

    let gradeCells = "";

    if (appState.reportMode === "semester") {
      const renderGrade = (gradeValue, predikatValue, colorClass) => `
        <div class="inline-flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-3 py-2 min-w-[96px] justify-center">
          <span class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center font-black ${gradeValue === "-" ? "text-slate-400" : colorClass} text-sm shadow-sm">${gradeValue}</span>
          <span class="text-left">
            <span class="block text-[10px] font-black text-slate-700 dark:text-slate-200">${predikatValue}</span>
            <span class="block text-[9px] font-bold text-slate-400">${gradeValue === "-" ? "Belum ada presensi" : window.getPredikatMeaning(gradeValue)}</span>
          </span>
        </div>`;
      gradeCells = `
                <td class="p-3 text-center">
                    ${renderGrade(shalatGrade, shalatPredikat, "text-emerald-500")}
                </td>
        
                <td class="p-3 text-center">
                    ${renderGrade(sekolahGrade, sekolahPredikat, "text-cyan-500")}
                </td>
        
                <td class="p-3 text-center">
                    ${renderGrade(mahadGrade, mahadPredikat, "text-blue-500")}
        
                </td>

                <td class="p-3 text-center">
                    ${renderGrade(sunnahGrade, sunnahPredikat, "text-amber-500")}
                
                </td>
        
                <td class="p-3 text-center">
                    ${renderGrade(grade, predikat, scoreColor)}
                </td>

                <td class="p-3 text-center">
                    ${trendCol}
                </td>
            `;
    }

    tr.innerHTML = `
            <td class="p-3.5 text-center">
                <span class="inline-flex w-6 h-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">${idx + 1}</span>
            </td>
        
            <td class="p-3.5">
                <div class="font-black text-slate-800 dark:text-slate-100 text-xs">
                    ${window.sanitizeHTML(s.nama)}
                </div>
            </td>
        
            ${
              appState.reportMode === "semester"
                ? gradeCells
                : `
                    <td class="p-3.5 text-center align-middle">
                        ${shalatCol}
                    </td>
        
                    <td class="p-3.5 text-center align-middle bg-cyan-50/30 dark:bg-cyan-900/10 border-x border-cyan-100 dark:border-cyan-900/20">
                        ${schoolCol}
                    </td>
        
                    <td class="p-3.5 text-center align-middle">
                        ${kbmCol}
                    </td>
        
                    <td class="p-3.5 text-center align-middle">
                        ${sunnahCol}
                    </td>
                    ${
                      appState.reportMode === "weekly" || appState.reportMode === "monthly"
                        ? `<td class="p-3.5 text-center align-middle">${trendCol}</td>`
                        : ""
                    }
                `
            }
        `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
  if (window.lucide) window.lucide.createIcons();
};

window.updateProfileStats = function () {
  if (!appState.selectedClass) return;

  // Hitung rata-rata
  let totalPercent = 0,
    daysCount = 0;

  // Loop semua tanggal yang ada di DB
  Object.keys(appState.attendanceData).forEach((dateKey) => {
    const dailyStats = { h: 0, total: 0 };
    let hasData = false;

    // Loop Slots
    Object.values(SLOT_WAKTU).forEach((slot) => {
      const stats = window.calculateSlotStats(slot.id, dateKey);
      if (stats.isFilled) {
        dailyStats.h += stats.h;
        dailyStats.total += stats.total;
        hasData = true;
      }
    });

    if (hasData) {
      const pct = dailyStats.total === 0 ? 0 : dailyStats.h / dailyStats.total;
      totalPercent += pct;
      daysCount++;
    }
  });

  const avgEl = document.getElementById("profile-avg-attendance");
  if (avgEl) {
    const avg =
      daysCount === 0 ? 0 : Math.round((totalPercent / daysCount) * 100);
    avgEl.textContent = avg + "%";
  }

  const daysEl = document.getElementById("profile-days-count");
  if (daysEl) daysEl.textContent = daysCount;
};

// 1. Cek Slot Accessible
window.isSlotAccessible = function (slotId, dateStr) {
  const todayStr = window.getLocalDateStr();

  if (dateStr > todayStr) return { locked: true, reason: "future" };

  // Hitung selisih hari (Ms ke Hari)
  const diffTime = Math.abs(new Date(todayStr) - new Date(dateStr));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > window.APP_CONSTANTS.maxEditDaysBack)
    return { locked: true, reason: "limit" };

  if (dateStr === todayStr) {
    const currentHour = new Date().getHours();
    const slotStart = SLOT_WAKTU[slotId].startHour;
    if (currentHour < slotStart) return { locked: true, reason: "wait" };
  }

  return { locked: false, reason: "" };
};

// 2. Default Slot
window.determineCurrentSlot = function () {
  const h = new Date().getHours();
  if (h >= 19) return "isya";
  if (h >= 18) return "maghrib";
  if (h >= 15) return "ashar";
  if (h >= 6) return "sekolah"; // <-- JAM 06:00 - 15:00 = SEKOLAH
  return "shubuh";
};

window.handleClearData = function () {
  window.showConfirmModal(
    "Hapus Data Hari Ini?",
    "Data presensi hari ini akan dihapus permanen.",
    "Hapus",
    "Batal",
    () => {
      delete appState.attendanceData[appState.date];
      window.saveData();
      window.updateDashboard();
      window.showToast("Data berhasil dihapus", "success");
      window.logActivity(
        "Hapus Data",
        `Menghapus data tanggal ${appState.date}`,
      );
    },
  );
};

window.showConfirmModal = function (
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
) {
  const modal = document.getElementById("modal-confirm");
  if (modal) {
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-message").textContent = message;

    const btnYes = document.getElementById("confirm-yes");
    const btnNo = document.getElementById("confirm-no");

    btnYes.textContent = confirmText;
    btnYes.onclick = () => {
      onConfirm();
      modal.classList.add("hidden");
    };

    btnNo.textContent = cancelText;
    btnNo.onclick = () => modal.classList.add("hidden");

    modal.classList.remove("hidden");
  }
};

// Backup Restore Logic
window.backupData = function () {
  const backup = {
    version: "1.0",
    date: new Date().toISOString(),
    class: appState.selectedClass,
    attendance: appState.attendanceData,
    activityLog: appState.activityLog,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `backup_${appState.selectedClass}_${window.getLocalDateStr()}.json`;
  link.click();

  window.showToast("Backup berhasil diunduh", "success");
};

window.restoreData = function () {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        if (!backup.attendance) throw new Error("Format salah");

        window.showConfirmModal(
          "Restore Data?",
          "Data saat ini akan tertimpa.",
          "Restore",
          "Batal",
          () => {
            appState.attendanceData = backup.attendance;
            if (backup.activityLog) appState.activityLog = backup.activityLog;
            window.saveData();
            window.updateDashboard();
            window.showToast("Data berhasil di-restore", "success");
          },
        );
      } catch (err) {
        window.showToast("Gagal: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };
  input.click();
};

// Tambahkan variabel ini di luar/di atas fungsi startClock untuk melacak hari secara real-time
let lastRealDate = window.getLocalDateStr();

window.startClock = function () {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }

  const updateClock = () => {
    const now = new Date();
    const el = document.getElementById("dash-clock");
    if (el) {
      el.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const secEl = document.getElementById("dash-clock-sec");
      if (secEl) secEl.textContent = String(now.getSeconds()).padStart(2, "0");
    }

    // PERBAIKAN: Cek pergantian hari (Midnight Rollover) yang benar
    const currentRealDate = window.getLocalDateStr(now);

    // Hanya eksekusi JIKA tanggal di dunia nyata benar-benar sudah berganti
    if (currentRealDate > lastRealDate) {
      // Jika user kebetulan SEDANG berada di tanggal "hari ini" (yang lama), ikut geser ke hari baru
      // Tapi jika user sengaja melihat data kemarin, biarkan saja tidak usah digeser
      if (appState.date === lastRealDate) {
        appState.date = currentRealDate;
        window.updateDateDisplay();
        window.updateDashboard();
      }
      lastRealDate = currentRealDate; // Update referensi tanggal nyata
    }

    const realCurrentSlot = window.getCurrentDashboardSlotId
      ? window.getCurrentDashboardSlotId(currentRealDate)
      : window.determineCurrentSlot();
    if (
      appState.date === currentRealDate &&
      appState.currentSlotId !== realCurrentSlot
    ) {
      appState.currentSlotId = realCurrentSlot;
      window.updateDashboard();
    }

    try {
      window.checkScheduledNotifications();
    } catch (e) {
      console.error("Notification error:", e);
    }
  };

  updateClock();
  clockInterval = setInterval(updateClock, 1000);
};

window.printReport = function () {
  window.print();
};

// ==========================================
// FITUR PERIZINAN / SAKIT (DURASI)
// ==========================================

// --- FITUR PERIZINAN (UPDATED) ---

// Variable state tambahan
let currentPermitTab = "sakit";

// 1. Fungsi Buka Modal & Setup Tab
// Variable global untuk mode modal saat ini
let currentModalMode = "daily"; // 'daily' atau 'pulang'

// Update fungsi Open Modal untuk menerima parameter mode
let isAllSelected = false;

window.openPermitModal = function (mode = "daily") {
  if (!appState.selectedClass)
    return window.showToast("Pilih kelas terlebih dahulu!", "warning");

  // RESET STATE
  isAllSelected = false;
  currentModalMode = mode;

  const modal = document.getElementById("modal-permit");
  const btnSelect = document.getElementById("btn-select-all-permit");
  if (btnSelect) btnSelect.textContent = "Pilih Semua";

  const tabSakit = document.getElementById("tab-btn-sakit");
  const tabIzin = document.getElementById("tab-btn-izin");
  const tabPulang = document.getElementById("tab-btn-pulang");
  const modalTitle = modal.querySelector("h3");
  const modalDesc = modal.querySelector("p");

  tabSakit.classList.remove("hidden");
  tabIzin.classList.remove("hidden");
  tabPulang.classList.remove("hidden");

  if (mode === "daily") {
    tabPulang.classList.add("hidden");
    window.setPermitTab("sakit");
    if (modalTitle) modalTitle.textContent = "Input Perizinan Harian";
    if (modalDesc) modalDesc.textContent = "Sakit & Izin Kegiatan";
  } else {
    tabSakit.classList.add("hidden");
    tabIzin.classList.add("hidden");
    window.setPermitTab("pulang");
    if (modalTitle) modalTitle.textContent = "Manajemen Perpulangan";
    if (modalDesc) modalDesc.textContent = "Izin Pulang & Liburan";
  }

  document.getElementById("permit-search-santri").value = "";
  window.renderPermitChecklist(FILTERED_SANTRI);
  window.updatePermitCount();
  window.renderPermitList();

  window.openModal("modal-permit"); // Use improved modal function
};

window.renderPermitChecklist = function (list) {
  const container = document.getElementById("permit-santri-checklist");
  if (!container) return;
  container.innerHTML = "";

  list.forEach((s) => {
    const id = String(s.nis || s.id);
    const div = document.createElement("label");
    div.className =
      "flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 cursor-pointer hover:border-emerald-500 transition-all group select-none";
    div.innerHTML = `
            <input type="checkbox" name="permit_santri_select" value="${id}" onchange="window.updatePermitCount()" class="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500 rounded-md cursor-pointer accent-emerald-500">
            <span class="text-xs font-bold text-slate-600 dark:text-slate-300 truncate group-hover:text-slate-800 dark:group-hover:text-white">${window.sanitizeHTML(s.nama)}</span>
        `;
    container.appendChild(div);
  });
};

window.filterPermitSantri = function (val) {
  const search = val.toLowerCase();
  const filtered = FILTERED_SANTRI.filter((s) =>
    s.nama.toLowerCase().includes(search),
  );
  window.renderPermitChecklist(filtered);
};

window.updatePermitCount = function () {
  const checked = document.querySelectorAll(
    'input[name="permit_santri_select"]:checked',
  ).length;
  const el = document.getElementById("permit-selected-count");
  if (el) el.textContent = checked;
};

window.deletePermit = function (id) {
  if (!confirm("Hapus data izin ini? Status akan dikembalikan ke default."))
    return;

  appState.permits = appState.permits.filter((p) => p.id !== id);
  localStorage.setItem(APP_CONFIG.permitKey, JSON.stringify(appState.permits));

  window.renderPermitList();
  window.showToast("Data izin dihapus", "info");

  // Trigger re-render untuk menjalankan logika RESET
  window.renderAttendanceList();
  window.updateDashboard();
};

window.renderPermitList = function () {
  const container = document.getElementById("permit-list-container");
  container.innerHTML = "";

  const classNisList = FILTERED_SANTRI.map((s) => String(s.nis || s.id));
  // Filter izin aktif milik kelas ini
  let activePermits = appState.permits.filter((p) => {
    const isMyClass = classNisList.includes(p.nis);
    const isActive = p.is_active !== false;

    // Cek jika ini sakit yang sudah sembuh (punya end_date)
    const isRecoveredSakit = p.category === "sakit" && p.end_date !== null;

    return isMyClass && isActive && !isRecoveredSakit;
  });

  if (currentModalMode === "daily") {
    activePermits = activePermits.filter(
      (p) => p.category === "sakit" || p.category === "izin",
    );
  } else {
    activePermits = activePermits.filter((p) => p.category === "pulang");
  }

  if (activePermits.length === 0) {
    container.innerHTML =
      '<div class="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold">Tidak ada yang izin/sakit</div>';
    return;
  }

  activePermits.forEach((p) => {
    const santri = FILTERED_SANTRI.find((s) => String(s.nis || s.id) === p.nis);
    if (!santri) return;

    // Tampilan Beda Tiap Kategori
    let badgeColor = "bg-slate-100 text-slate-600";
    let detailText = "";
    let actionBtn = "";

    if (p.category === "sakit") {
      badgeColor = "bg-amber-100 text-amber-600 border border-amber-200";
      detailText = `Mulai: ${window.formatDate(p.start_date)} (${p.start_session}) • ${p.location}`;
      // Tombol Sembuh
      actionBtn = `<button onclick="window.markAsRecovered('${p.id}')" class="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow hover:bg-emerald-600">Sembuh</button>`;
    } else {
      if (p.category === "izin")
        badgeColor = "bg-blue-100 text-blue-600 border border-blue-200";
      else
        badgeColor = "bg-purple-100 text-purple-600 border border-purple-200";

      detailText = `Sampai: ${window.formatDate(p.end_date)} ${p.end_time_limit}`;

      // Tombol Perpanjang / Sudah Kembali
      actionBtn = `
                <div class="flex gap-1">
                    <button onclick="window.extendPermit('${p.id}')" class="px-2 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-[10px] font-bold">Perpanjang</button>
                    <button onclick="window.markAsReturned('${p.id}')" class="px-2 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-[10px] font-bold">Kembali</button>
                </div>
            `;
    }

    const div = document.createElement("div");
    div.className =
      "p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm flex justify-between items-center";
    div.innerHTML = `
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${badgeColor}">${window.sanitizeHTML(p.category)}</span>
                    <span class="font-bold text-slate-800 dark:text-white text-xs">${window.sanitizeHTML(santri.nama)}</span>
                </div>
                <p class="text-[10px] font-bold text-slate-500">${window.sanitizeHTML(p.reason)}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">${window.sanitizeHTML(detailText)}</p>
            </div>
            <div class="flex flex-col gap-1 items-end">
                ${actionBtn}
                <button onclick="window.deletePermit('${p.id}')" class="text-[9px] text-red-400 underline mt-1">Hapus Data</button>
            </div>
        `;
    container.appendChild(div);
  });
};

window.evaluatePermitForSlot = function (permit, currentDateStr, currentSlotId) {
  if (!permit || !currentDateStr || !currentSlotId) return null;
  const currentOrder = SESSION_ORDER[currentSlotId] ?? 0;
  const startOrder = SESSION_ORDER[permit.start_session] ?? 0;
  const endOrder = SESSION_ORDER[permit.end_session] ?? 999;

  // --- LOGIKA SAKIT ---
  if (permit.category === "sakit") {
    // Validasi Awal Tanggal
    if (currentDateStr < permit.start_date) return null;
    if (
      currentDateStr === permit.start_date &&
      currentOrder < startOrder
    )
      return null;

    // Validasi Sembuh (End Date)
    if (permit.end_date) {
      // Jika sudah lewat tanggal sembuh -> Sehat
      if (currentDateStr > permit.end_date) return null;

      // Jika hari ini tanggal sembuh, cek sesinya
      if (currentDateStr === permit.end_date && permit.end_session) {
        // Logic: Jika sesi sekarang SUDAH MELEWATI atau SAMA DENGAN sesi sembuh -> Sehat
        // Contoh: End Session = Shubuh. Buka Ashar (2) > Shubuh (1) -> Sehat.
        // Tapi tunggu, "End Session" biasanya menandakan sesi TERAKHIR dia sakit.
        // Jadi: Jika Sesi Sekarang > Sesi Terakhir Sakit, maka Null.
        if (currentOrder > endOrder) {
          return null;
        }
      }
    }
    return {
      type: "Sakit",
      label: "S",
      end: permit.end_date,
      note: `[Sakit] ${permit.reason}`,
    };
  }

  // --- LOGIKA IZIN & PULANG ---
  else {
    if (!permit.end_date) return null;
    if (currentDateStr < permit.start_date) return null;
    if (
      currentDateStr === permit.start_date &&
      currentOrder < startOrder
    )
      return null;

    // Cek Deadline Kembali
    if (currentDateStr > permit.end_date) {
      return {
        type: "Alpa",
        label: "A",
        end: permit.end_date,
        note: `[Terlambat] Deadline ${window.formatDate(permit.end_date)}`,
      };
    }

    if (currentDateStr === permit.end_date) {
      const deadlineTime = permit.end_time_limit || "17:00";
      const deadlineHour = parseInt(deadlineTime.split(":")[0]);
      const slotStartHour = SLOT_WAKTU[currentSlotId].startHour;

      // Jika waktu presensi sudah melewati jam deadline -> Alpa
      if (slotStartHour >= deadlineHour) {
        return {
          type: "Alpa",
          label: "A",
          end: permit.end_date,
          note: `[Terlambat] Deadline jam ${deadlineTime}`,
        };
      }
    }

    const cat = (permit.category || "").toLowerCase();
    const label = cat === "pulang" ? "Pulang" : "Izin";
    const code = cat === "pulang" ? "P" : "I";

    return {
      type: label,
      label: code,
      end: permit.end_date,
      note: `[${label}] ${permit.reason}`,
    };
  }
};

window.checkActivePermit = function (nis, currentDateStr, currentSlotId) {
  const activePermits = (appState.permits || [])
    .filter((p) => {
      const status = String(p.status || "approved").toLowerCase();
      return (
        String(p.nis) === String(nis) &&
        p.is_active !== false &&
        status === "approved"
      );
    })
    .sort((a, b) => {
      const byStart = String(b.start_date || "").localeCompare(
        String(a.start_date || ""),
      );
      if (byStart !== 0) return byStart;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  for (const permit of activePermits) {
    const evaluated = window.evaluatePermitForSlot(
      permit,
      currentDateStr,
      currentSlotId,
    );
    if (evaluated) return evaluated;
  }

  return null;
};

// ==========================================
// FITUR ANALISIS SANTRI (BARU)
// ==========================================

// 1. Setup Dropdown Santri saat buka tab Analysis
window.populateAnalysisDropdown = function () {
  const select = document.getElementById("analysis-santri");
  if (!select) return;

  // Simpan value lama jika ada
  const oldVal = select.value;

  select.innerHTML = '<option value="">-- Pilih Santri --</option>';

  // Sort nama santri
  const sorted = [...FILTERED_SANTRI].sort((a, b) =>
    a.nama.localeCompare(b.nama),
  );

  sorted.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.nis || s.id;
    opt.textContent = s.nama;
    select.appendChild(opt);
  });

  if (oldVal) select.value = oldVal;
};

// 2. Ganti Mode (Harian/Pekan/Bulan/Semester)
window.setAnalysisMode = function (mode) {
  appState.analysisMode = mode;

  // Update UI Button
  document.querySelectorAll(".anl-btn").forEach((btn) => {
    if (btn.dataset.mode === mode) {
      btn.classList.add("active-mode", "text-white");
      btn.classList.remove("text-slate-500");
    } else {
      btn.classList.remove("active-mode", "text-white");
      btn.classList.add("text-slate-500");
    }
  });

  window.syncPeriodPicker("analysis");
  window.runAnalysis();
};

// 3. Helper: Mendapatkan Rentang Tanggal
window.getDateRange = function (mode, baseDate) {
  const today = new Date(baseDate || appState.date);
  let start = new Date(today);
  let end = new Date(today);
  let label = "";

  if (mode === "daily") {
    label = window.formatDate(window.getLocalDateStr(today));
  } else if (mode === "weekly") {
    const day = today.getDay(); // 0 (Sun) - 6 (Sat)
    // Adjust agar Senin jadi hari pertama (Opsional, tergantung kebiasaan pondok)
    // Disini asumsi Senin = start
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    end.setDate(start.getDate() + 6);
    label = `${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  } else if (mode === "monthly") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const months = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    label = `${months[today.getMonth()]} ${today.getFullYear()}`;
  } else if (mode === "semester") {
    // Semester 1: Jan - Jun, Semester 2: Jul - Des
    if (today.getMonth() < 6) {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 5, 30);
      label = `Semester Genap (Jan-Jun ${today.getFullYear()})`;
    } else {
      start = new Date(today.getFullYear(), 6, 1);
      end = new Date(today.getFullYear(), 11, 31);
      label = `Semester Ganjil (Jul-Des ${today.getFullYear()})`;
    }
  }

  return { start, end, label };
};

window.getSemesterStartDate = function (dateObj = new Date()) {
  return new Date(
    dateObj.getFullYear(),
    dateObj.getMonth() < 6 ? 0 : 6,
    1,
  );
};

window.getPreviousSemesterStartDate = function (dateObj = new Date()) {
  const currentStart = window.getSemesterStartDate(dateObj);
  return currentStart.getMonth() === 0
    ? new Date(currentStart.getFullYear() - 1, 6, 1)
    : new Date(currentStart.getFullYear(), 0, 1);
};

window.getWeekStartDate = function (dateObj = new Date()) {
  const date = new Date(dateObj);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

window.normalizeReportDateForMode = function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (appState.reportMode === "daily") {
    const selected = new Date(`${appState.reportDate || window.getLocalDateStr()}T00:00:00`);
    const minDate = new Date(today);
    minDate.setDate(today.getDate() - 60);
    if (selected > today) appState.reportDate = window.getLocalDateStr(today);
    if (selected < minDate) appState.reportDate = window.getLocalDateStr(minDate);
  } else if (appState.reportMode === "weekly") {
    const selected = new Date(`${appState.reportDate || window.getLocalDateStr()}T00:00:00`);
    const selectedWeekStart = window.getWeekStartDate(selected);
    const selectedWeekEnd = new Date(selectedWeekStart);
    selectedWeekEnd.setDate(selectedWeekStart.getDate() + 6);
    const currentWeekStart = window.getWeekStartDate(today);
    const touchesCurrentMonth =
      selectedWeekStart.getMonth() === today.getMonth() ||
      selectedWeekEnd.getMonth() === today.getMonth();

    if (!touchesCurrentMonth || selectedWeekStart > currentWeekStart) {
      appState.reportDate = window.getLocalDateStr(currentWeekStart);
    } else {
      appState.reportDate = window.getLocalDateStr(selectedWeekStart);
    }
  } else if (appState.reportMode === "monthly") {
    const selected = new Date(`${appState.reportDate || window.getLocalDateStr()}T00:00:00`);
    const semesterStart = window.getSemesterStartDate(today);
    const selectedMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (selectedMonth < semesterStart || selectedMonth > currentMonth) {
      appState.reportDate = window.getLocalDateStr(currentMonth);
    }
  } else if (appState.reportMode === "semester") {
    const currentSemester = window.getSemesterStartDate(today);
    const previousSemester = window.getPreviousSemesterStartDate(today);
    const selected = new Date(`${appState.reportDate || window.getLocalDateStr()}T00:00:00`);
    const selectedSemester = window.getSemesterStartDate(selected);
    const selectedKey = window.getLocalDateStr(selectedSemester);
    const currentKey = window.getLocalDateStr(currentSemester);
    const previousKey = window.getLocalDateStr(previousSemester);
    if (selectedKey !== currentKey && selectedKey !== previousKey) {
      appState.reportDate = currentKey;
    }
  }
};

window.syncPeriodPicker = function (scope) {
  if (scope === "report" && typeof window.normalizeReportDateForMode === "function") {
    window.normalizeReportDateForMode();
  }
  const mode = scope === "analysis" ? appState.analysisMode : appState.reportMode;
  const dateValue =
    scope === "analysis"
      ? appState.analysisDate || appState.date
      : appState.reportDate || appState.date;
  const button = document.getElementById(
    scope === "analysis" ? "analysis-date-range" : "report-date-range",
  );
  if (!button) return;

  const range = window.getDateRange(mode, dateValue);
  button.textContent = range.label;
  button.title = "Pilih periode";
  window.renderPeriodMenu(scope);
};

window.handleReportPeriodChange = function (value) {
  if (!value) return;
  appState.reportDate = value.length === 7 ? `${value}-01` : value;
  window.syncPeriodPicker("report");
  window.updateReportTab();
};

window.handleAnalysisPeriodChange = function (value) {
  if (!value) return;
  appState.analysisDate = value.length === 7 ? `${value}-01` : value;
  window.syncPeriodPicker("analysis");
  window.runAnalysis();
};

window.togglePeriodMenu = function (scope) {
  const menu = document.getElementById(
    scope === "analysis" ? "analysis-period-menu" : "report-period-menu",
  );
  if (!menu) return;
  const other = document.getElementById(
    scope === "analysis" ? "report-period-menu" : "analysis-period-menu",
  );
  if (other) other.classList.add("hidden");
  window.renderPeriodMenu(scope);
  const willOpen = menu.classList.contains("hidden");
  document.querySelectorAll(".period-popover").forEach((el) => el.classList.add("hidden"));
  if (willOpen) {
    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }
    menu.classList.remove("hidden");
    window.ensurePeriodBackdrop(scope);
  } else {
    window.closePeriodMenu(scope);
  }
};

window.ensurePeriodBackdrop = function (scope) {
  let backdrop = document.getElementById("period-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "period-backdrop";
    backdrop.className = "period-backdrop";
    document.body.appendChild(backdrop);
  }
  backdrop.onclick = () => window.closePeriodMenu(scope);
};

window.closePeriodMenu = function (scope) {
  const menu = document.getElementById(`${scope}-period-menu`);
  if (menu) menu.classList.add("hidden");
  const backdrop = document.getElementById("period-backdrop");
  if (backdrop) backdrop.remove();
};

window.selectPeriodDate = function (scope, value) {
  if (scope === "analysis") {
    appState.analysisDate = value;
    window.syncPeriodPicker("analysis");
    window.runAnalysis();
  } else {
    appState.reportDate = value;
    window.syncPeriodPicker("report");
    window.updateReportTab();
  }
  const menu = document.getElementById(`${scope}-period-menu`);
  window.closePeriodMenu(scope);
};

window.renderPeriodMenu = function (scope) {
  const mode = scope === "analysis" ? appState.analysisMode : appState.reportMode;
  const dateValue =
    scope === "analysis"
      ? appState.analysisDate || appState.date
      : appState.reportDate || appState.date;
  const menu = document.getElementById(`${scope}-period-menu`);
  if (!menu) return;

  const base = new Date(dateValue);
  const toDateStr = (date) => window.getLocalDateStr(date);
  const optionButton = (label, value, active = false) => `
    <button type="button" onclick="window.selectPeriodDate('${scope}', '${value}')"
      class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${active ? "bg-palette-blue text-white shadow-sm shadow-blue-500/20" : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"}">
      <span class="text-xs font-black truncate">${window.sanitizeHTML(label)}</span>
      ${active ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ""}
    </button>`;

  let options = [];
  if (scope === "report" && mode === "daily") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let offset = 0; offset <= 60; offset++) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const value = toDateStr(date);
      const label = offset === 0 ? `Hari ini - ${window.formatDate(value)}` : window.formatDate(value);
      options.push(optionButton(label, value, value === dateValue));
    }
  } else if (scope === "report" && mode === "weekly") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let cursor = window.getWeekStartDate(firstDayOfMonth);
    const currentWeekStart = window.getWeekStartDate(today);

    while (cursor <= currentWeekStart) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(cursor.getDate() + 6);
      const touchesCurrentMonth =
        cursor.getMonth() === today.getMonth() || weekEnd.getMonth() === today.getMonth();

      if (touchesCurrentMonth) {
        const value = toDateStr(cursor);
        const range = window.getDateRange("weekly", value);
        const selectedWeekStart = toDateStr(window.getWeekStartDate(base));
        options.push(optionButton(range.label, value, value === selectedWeekStart));
      }

      cursor.setDate(cursor.getDate() + 7);
    }
  } else if (scope === "report" && mode === "monthly") {
    const today = new Date();
    const semesterStart = window.getSemesterStartDate(today);
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const selectedMonthKey = dateValue.slice(0, 7);
    let cursor = new Date(semesterStart);

    while (cursor <= currentMonth) {
      const value = toDateStr(cursor);
      const range = window.getDateRange("monthly", value);
      options.push(optionButton(range.label, value, value.slice(0, 7) === selectedMonthKey));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else if (scope === "report" && mode === "semester") {
    const today = new Date();
    const semesterOptions = [
      window.getSemesterStartDate(today),
      window.getPreviousSemesterStartDate(today),
    ];
    const selectedSemesterKey = toDateStr(window.getSemesterStartDate(base));

    semesterOptions.forEach((date) => {
      const value = toDateStr(date);
      const range = window.getDateRange("semester", value);
      options.push(optionButton(range.label, value, value === selectedSemesterKey));
    });
  } else if (mode === "daily") {
    for (let offset = -10; offset <= 10; offset++) {
      const date = new Date(base);
      date.setDate(base.getDate() + offset);
      const value = toDateStr(date);
      const label = offset === 0 ? `Hari ini - ${window.formatDate(value)}` : window.formatDate(value);
      options.push(optionButton(label, value, value === dateValue));
    }
  } else if (mode === "weekly") {
    for (let offset = -8; offset <= 8; offset++) {
      const date = new Date(base);
      date.setDate(base.getDate() + offset * 7);
      const value = toDateStr(date);
      const range = window.getDateRange("weekly", value);
      options.push(optionButton(range.label, value, value === dateValue));
    }
  } else if (mode === "monthly") {
    for (let offset = -12; offset <= 12; offset++) {
      const date = new Date(base.getFullYear(), base.getMonth() + offset, 1);
      const value = toDateStr(date);
      const range = window.getDateRange("monthly", value);
      options.push(optionButton(range.label, value, value.slice(0, 7) === dateValue.slice(0, 7)));
    }
  } else {
    const y = base.getFullYear();
    [
      [`Semester Genap ${y - 2}`, `${y - 2}-01-01`],
      [`Semester Ganjil ${y - 2}`, `${y - 2}-07-01`],
      [`Semester Genap ${y - 1}`, `${y - 1}-01-01`],
      [`Semester Ganjil ${y - 1}`, `${y - 1}-07-01`],
      [`Semester Genap ${y}`, `${y}-01-01`],
      [`Semester Ganjil ${y}`, `${y}-07-01`],
      [`Semester Genap ${y + 1}`, `${y + 1}-01-01`],
      [`Semester Ganjil ${y + 1}`, `${y + 1}-07-01`],
    ].forEach(([label, value]) => {
      const same =
        new Date(value).getFullYear() === base.getFullYear() &&
        Math.floor(new Date(value).getMonth() / 6) === Math.floor(base.getMonth() / 6);
      options.push(optionButton(label, value, same));
    });
  }

  menu.innerHTML = `
    <div class="flex items-center justify-between px-2 pb-2">
      <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Pilih ${mode === "daily" ? "hari" : mode === "weekly" ? "pekan" : mode === "monthly" ? "bulan" : "semester"}</p>
      <button type="button" onclick="window.closePeriodMenu('${scope}')" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>
    </div>
    <div class="grid gap-1 overflow-y-auto custom-scrollbar pr-1" style="max-height: 340px">${options.join("")}</div>
  `;
  if (window.lucide) window.lucide.createIcons();
};

// 4. ENGINE ANALISIS UTAMA
window.runAnalysis = function () {
  const santriId = document.getElementById("analysis-santri").value;
  if (!santriId) {
    document.getElementById("analysis-result").classList.add("hidden");
    document.getElementById("analysis-empty").classList.remove("hidden");
    return;
  }

  document.getElementById("analysis-result").classList.remove("hidden");
  document.getElementById("analysis-empty").classList.add("hidden");

  window.syncPeriodPicker("analysis");
  const range = window.getDateRange(
    appState.analysisMode,
    appState.analysisDate || appState.date,
  );
  document.getElementById("analysis-date-range").textContent = range.label;

  const selectedSantri = FILTERED_SANTRI.find(
    (s) => String(s.nis || s.id) === String(santriId),
  );

  let stats = {
    school: {
      score: 0,
      h: 0,
      m: 0,
      total: 0,
    },
    fardu: {
      score: 0,
      h: 0,
      m: 0,
      total: 0,
    },
    kbm: {
      score: 0,
      h: 0,
      m: 0,
      total: 0,
    },
    sunnah: {
      score: 0,
      y: 0,
      t: 0,
      total: 0,
    },
    issues: {
      Sakit: 0,
      Izin: 0,
      Pulang: 0,
      Alpa: 0,
      Telat: 0,
    },
    sunnahByAct: {},
    timeline: [],
    events: [],
  };

  let curr = new Date(range.start);
  const end = new Date(range.end);
  let loopGuard = 0;

  while (curr <= end && loopGuard < 370) {
    const prevTime = curr.getTime();

    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, "0");
    const d = String(curr.getDate()).padStart(2, "0");
    const safeDateKey = `${y}-${m}-${d}`;

    const dayData = appState.attendanceData[safeDateKey];
    const dayNum = curr.getDay();
    let dayGood = 0;
    let dayTotal = 0;
    let dayScore = 0;
    let dayIssues = 0;

    if (dayData) {
      Object.values(SLOT_WAKTU).forEach((slot) => {
        if (window.isSlotHoliday(slot.id, safeDateKey)) return;

        const slotData = dayData[slot.id];
        if (!window.isAttendanceSlotFinalForReport(slotData)) return;

        const sData = slotData?.[santriId];
        if (sData) {
          slot.activities.forEach((act) => {
            if (act.showOnDays && !act.showOnDays.includes(dayNum)) return;
            if (act.onlyRamadhan && !window.isRamadhan(safeDateKey)) return;
            if (window.isActivityHoliday(safeDateKey, slot.id, act.id)) return;
            if (window.isCategoryHoliday(safeDateKey, act.category)) return;

            const st = sData.status[act.id];
            if (!st) return;
            const statusScore = window.getStatusScore?.(st);
            stats.events.push({
              date: safeDateKey,
              slot: slot.label || slot.id,
              activity: act.label || act.id,
              status: st,
            });

            if (act.category === "school") {
              stats.school.total++;
              dayTotal++;
              dayScore += statusScore ?? 0;
              stats.school.score += statusScore ?? 0;
              if (st === "Hadir" || st === "Telat") stats.school.h++;
              else stats.school.m++;
              if (st === "Hadir" || st === "Telat") dayGood++;
            } else if (act.category === "fardu") {
              stats.fardu.total++;
              dayTotal++;
              dayScore += statusScore ?? 0;
              stats.fardu.score += statusScore ?? 0;
              if (st === "Hadir" || st === "Telat") {
                stats.fardu.h++;
                dayGood++;
              } else {
                stats.fardu.m++;
              }
            } else if (act.category === "kbm") {
              stats.kbm.total++;
              dayTotal++;
              dayScore += statusScore ?? 0;
              stats.kbm.score += statusScore ?? 0;
              if (st === "Hadir" || st === "Telat") {
                stats.kbm.h++;
                dayGood++;
              } else {
                stats.kbm.m++;
              }
            } else if (
              act.category === "sunnah" ||
              act.category === "dependent"
            ) {
              stats.sunnah.total++;
              dayTotal++;
              dayScore += statusScore ?? 0;
              stats.sunnah.score += statusScore ?? 0;
              let sunnahKey = null;
              if (act.category === "sunnah") {
                sunnahKey = String(act.label || act.id).toLowerCase();
                if (!stats.sunnahByAct[sunnahKey]) {
                  stats.sunnahByAct[sunnahKey] = {
                    label: act.label || act.id,
                    y: 0,
                    t: 0,
                    total: 0,
                  };
                }
                stats.sunnahByAct[sunnahKey].total++;
              }
              if (st === "Ya" || st === "Hadir") {
                stats.sunnah.y++;
                if (sunnahKey) stats.sunnahByAct[sunnahKey].y++;
                dayGood++;
              } else {
                stats.sunnah.t++;
                if (sunnahKey) stats.sunnahByAct[sunnahKey].t++;
              }
            }

            if (Object.prototype.hasOwnProperty.call(stats.issues, st)) {
              stats.issues[st]++;
              if (st !== "Telat") dayIssues++;
            }
          });
        }
      });
    }

    if (dayTotal > 0) {
      stats.timeline.push({
        date: safeDateKey,
        score: Math.round(dayScore / dayTotal),
        issues: dayIssues,
      });
    }

    curr.setDate(curr.getDate() + 1);
    loopGuard++;

    if (curr.getTime() === prevTime) {
      console.error("Date increment stuck! Breaking loop.");
      break;
    }
  }

  window.renderBar("school", stats.school.h, stats.school.m);
  window.renderBar("fardu", stats.fardu.h, stats.fardu.m);
  window.renderBar("kbm", stats.kbm.h, stats.kbm.m);
  window.renderBar("sunnah", stats.sunnah.y, stats.sunnah.t);

  const pctSchool = stats.school.total
    ? Math.round((stats.school.score / stats.school.total))
    : 0;
  const pctFardu = stats.fardu.total
    ? Math.round((stats.fardu.score / stats.fardu.total))
    : 0;
  const pctKbm = stats.kbm.total
    ? Math.round((stats.kbm.score / stats.kbm.total))
    : 0;
  const pctSunnah = stats.sunnah.total
    ? Math.round((stats.sunnah.score / stats.sunnah.total))
    : 0;

  let totalScore = 0;
  let divider = 0;

  if (stats.school.total) {
    totalScore += pctSchool * 0.35;
    divider += 0.35;
  }
  if (stats.fardu.total) {
    totalScore += pctFardu * 0.3;
    divider += 0.3;
  }
  if (stats.kbm.total) {
    totalScore += pctKbm * 0.2;
    divider += 0.2;
  }
  if (stats.sunnah.total) {
    totalScore += pctSunnah * 0.15;
    divider += 0.15;
  }

  const finalScore = divider ? Math.round(totalScore / divider) : 0;
  const totalRecords =
    stats.school.total + stats.fardu.total + stats.kbm.total + stats.sunnah.total;
  const issueCount = Object.values(stats.issues).reduce((sum, count) => sum + count, 0);
  const dominantIssue = Object.entries(stats.issues).sort((a, b) => b[1] - a[1])[0];
  const midpoint = Math.ceil(stats.timeline.length / 2);
  const firstHalf = stats.timeline.slice(0, midpoint);
  const secondHalf = stats.timeline.slice(midpoint);
  const avgScore = (items) =>
    items.length
      ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length)
      : 0;
  const trendDelta = avgScore(secondHalf.length ? secondHalf : stats.timeline) - avgScore(firstHalf);

  document.getElementById("anl-total-score").textContent = `${finalScore}%`;
  document.getElementById("stat-hadir-mini").textContent =
    stats.school.h + stats.fardu.h + stats.kbm.h + stats.sunnah.y;
  document.getElementById("stat-masalah-mini").textContent = issueCount;

  const profileName = document.getElementById("anl-student-name");
  const profileClass = document.getElementById("anl-student-class");
  const profileAsrama = document.getElementById("anl-student-asrama");
  const profileStatus = document.getElementById("anl-student-status");
  const profileRecords = document.getElementById("anl-total-records");
  const profileIssues = document.getElementById("anl-issue-count");
  const profileDominant = document.getElementById("anl-dominant-issue");
  const profileIcon = document.getElementById("anl-profile-icon");

  if (selectedSantri) {
    if (profileName) profileName.textContent = selectedSantri.nama || "-";
    if (profileClass) profileClass.textContent = selectedSantri.kelas || selectedSantri.rombel || "-";
    if (profileAsrama) profileAsrama.textContent = selectedSantri.asrama || "-";
  }
  if (profileRecords) profileRecords.textContent = totalRecords;
  if (profileIssues) profileIssues.textContent = issueCount;
  if (profileDominant) {
    profileDominant.textContent = dominantIssue && dominantIssue[1] > 0 ? dominantIssue[0] : "Tidak ada";
  }
  if (profileStatus) {
    const statusTone =
      finalScore >= 90
        ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
        : finalScore >= 75
          ? "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400"
          : finalScore >= 60
            ? "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400"
            : "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400";
    profileStatus.textContent =
      finalScore >= 90 ? "Sangat baik" : finalScore >= 75 ? "Baik" : finalScore >= 60 ? "Perlu dampingan" : "Prioritas";
    profileStatus.className =
      `inline-flex items-center justify-center px-2.5 py-1 rounded-full border text-[10px] font-black whitespace-nowrap ${statusTone}`;
  }
  if (profileIcon) {
    const issueIcon =
      stats.issues.Sakit >= Math.max(stats.issues.Izin, stats.issues.Pulang, stats.issues.Alpa)
        ? "thermometer"
        : stats.issues.Izin >= Math.max(stats.issues.Pulang, stats.issues.Alpa)
          ? "clipboard-check"
          : stats.issues.Pulang >= stats.issues.Alpa
            ? "home"
            : "alert-triangle";
    const iconName = issueCount === 0 && finalScore >= 90 ? "flame" : issueIcon;
    const iconColor =
      issueCount === 0 && finalScore >= 90
        ? "text-orange-500 bg-orange-50 dark:bg-orange-500/10"
        : finalScore >= 75
          ? "text-blue-500 bg-blue-50 dark:bg-blue-500/10"
          : finalScore >= 60
            ? "text-amber-500 bg-amber-50 dark:bg-amber-500/10"
            : "text-red-500 bg-red-50 dark:bg-red-500/10";
    profileIcon.className = `w-12 h-12 rounded-2xl ${iconColor} flex items-center justify-center shrink-0`;
    profileIcon.innerHTML = `<i data-lucide="${iconName}" class="w-5 h-5"></i>`;
  }

  const trendText = document.getElementById("anl-trend-text");
  const trendPill = document.getElementById("anl-trend-pill");
  if (trendText) {
    trendText.textContent = stats.timeline.length
      ? `${stats.timeline.length} hari data, ${trendDelta >= 0 ? "naik" : "turun"} ${Math.abs(trendDelta)} poin`
      : "Belum ada data timeline";
  }
  if (trendPill) {
    trendPill.textContent = `${trendDelta >= 0 ? "+" : ""}${trendDelta}%`;
    trendPill.className =
      trendDelta >= 0
        ? "px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[10px] font-black text-emerald-600 dark:text-emerald-300"
        : "px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-[10px] font-black text-red-600 dark:text-red-300";
  }

  window.renderAnalysisTrendChart(stats.timeline);

  window.renderAnalysisTimeline(stats, range);

  const sunnahDetail = document.getElementById("anl-sunnah-detail");
  if (sunnahDetail) {
    const items = Object.values(stats.sunnahByAct);
    sunnahDetail.innerHTML = items.length
      ? items
          .map((item) => {
            const pct = item.total ? Math.round((item.y / item.total) * 100) : 0;
            return `
              <div class="rounded-lg bg-amber-50/70 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 p-2 min-h-[64px]">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-[10px] font-black text-slate-800 dark:text-slate-100 truncate">${window.sanitizeHTML(item.label)}</p>
                  <span class="text-[10px] font-black text-amber-600 dark:text-amber-300">${pct}%</span>
                </div>
                <div class="h-1 rounded-full bg-white/80 dark:bg-slate-800 overflow-hidden mt-1.5">
                  <div class="h-full bg-amber-400" style="width:${pct}%"></div>
                </div>
                <p class="text-[9px] font-bold text-amber-700 dark:text-amber-300 mt-1">${item.y}/${item.total}</p>
              </div>`;
          })
          .join("")
      : `<div class="col-span-full rounded-xl bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center text-[10px] font-bold text-slate-400">Belum ada data sunnah</div>`;
  }

  const badgesEl = document.getElementById("anl-badges");
  if (badgesEl) {
    const badges = [];
    const badgeClass = {
      emerald: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
      amber: "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-300",
      blue: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-300",
    };
    if (finalScore >= 90) badges.push(["Mumtaz", "award", badgeClass.emerald]);
    if (pctFardu >= 90) badges.push(["Fardhu Kuat", "moon", badgeClass.emerald]);
    if (pctSunnah >= 80) badges.push(["Sunnah Aktif", "sparkles", badgeClass.amber]);
    if (issueCount === 0) badges.push(["Tanpa Catatan", "shield-check", badgeClass.blue]);
    if (trendDelta > 0) badges.push(["Tren Naik", "trending-up", badgeClass.emerald]);
    if (!badges.length) badges.push(["Perlu Dampingan", "hand-heart", badgeClass.amber]);
    badgesEl.innerHTML = badges
      .map(([label, icon, colorClass]) => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black ${colorClass}">
          <i data-lucide="${icon}" class="w-3 h-3"></i>${label}
        </span>
      `)
      .join("");
  }

  const elVerdict = document.getElementById("anl-verdict");
  const verdictBaseClass =
    "w-full rounded-xl border px-2 py-1.5 truncate font-black text-[10px] leading-none";
  if (finalScore >= 90) {
    elVerdict.textContent = "Mumtaz (Sangat Baik)";
    elVerdict.className = `${verdictBaseClass} bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300`;
  } else if (finalScore >= 75) {
    elVerdict.textContent = "Jayyid (Baik)";
    elVerdict.className = `${verdictBaseClass} bg-blue-50/70 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-300`;
  } else if (finalScore >= 60) {
    elVerdict.textContent = "Maqbul (Cukup)";
    elVerdict.className = `${verdictBaseClass} bg-amber-50/70 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-300`;
  } else {
    elVerdict.textContent = "Naqis (Kurang)";
    elVerdict.className = `${verdictBaseClass} bg-red-50/70 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-300`;
  }

  document.getElementById("anl-score-school").textContent =
    Math.round(pctSchool) + "%";
  document.getElementById("anl-score-fardu").textContent =
    Math.round(pctFardu) + "%";
  document.getElementById("anl-score-kbm").textContent =
    Math.round(pctKbm) + "%";
  document.getElementById("anl-score-sunnah").textContent =
    Math.round(pctSunnah) + "%";

  if (window.lucide) window.lucide.createIcons();
};

window.renderAnalysisTimeline = function (stats, range) {
  const el = document.getElementById("anl-timeline");
  if (!el) return;

  const mode = appState.analysisMode || "daily";
  const events = stats.events || [];
  const safe = (value) => window.sanitizeHTML(String(value || "-"));
  const statusTone = (status) => window.getStatusMeta(status).pill;
  const countStatuses = (items) => {
    const counts = { hadir: 0, sakit: 0, izin: 0, pulang: 0, alpa: 0, total: 0 };
    items.forEach((item) => {
      counts.total++;
      if (item.status === "Hadir" || item.status === "Ya" || item.status === "Telat") counts.hadir++;
      else if (item.status === "Sakit") counts.sakit++;
      else if (item.status === "Izin") counts.izin++;
      else if (item.status === "Pulang") counts.pulang++;
      else if (item.status === "Alpa") counts.alpa++;
    });
    return counts;
  };
  const percent = (good, total) => (total ? Math.round((good / total) * 100) : 0);

  if (mode === "daily") {
    const dateKey = appState.analysisDate || appState.date;
    const dailyEvents = events.filter((item) => item.date === dateKey);
    const slots = [
      { title: "Shubuh", icon: "sunrise", accent: "emerald", match: (slot) => slot.includes("shubuh") },
      { title: "Sekolah", icon: "graduation-cap", accent: "cyan", match: (slot) => slot.includes("sekolah") },
      { title: "Ashar", icon: "sun", accent: "amber", match: (slot) => slot.includes("ashar") },
      { title: "Maghrib", icon: "sunset", accent: "violet", match: (slot) => slot.includes("maghrib") },
      { title: "Isya", icon: "moon", accent: "blue", match: (slot) => slot.includes("isya") },
    ];
    const accentMap = {
      emerald: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-300",
      cyan: "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-100 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-300",
      amber: "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-300",
      violet: "bg-violet-50 dark:bg-violet-500/10 border-violet-100 dark:border-violet-500/20 text-violet-600 dark:text-violet-300",
      blue: "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-300",
    };

    el.className = "grid grid-cols-1 sm:grid-cols-2 gap-2";
    el.innerHTML = slots
      .map((slot) => {
        const items = dailyEvents.filter((item) => slot.match(String(item.slot || "").toLowerCase()));
        const counts = countStatuses(items);
        const pct = percent(counts.hadir, counts.total);
        return `
          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 min-h-[124px] shadow-sm overflow-hidden relative">
            <div class="absolute inset-x-0 top-0 h-1 ${slot.accent === "emerald" ? "bg-emerald-400" : slot.accent === "cyan" ? "bg-cyan-400" : slot.accent === "amber" ? "bg-amber-400" : slot.accent === "violet" ? "bg-violet-400" : "bg-blue-400"}"></div>
            <div class="flex items-center justify-between mb-2.5 pt-1">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-8 h-8 rounded-xl border flex items-center justify-center ${accentMap[slot.accent]}">
                  <i data-lucide="${slot.icon}" class="w-4 h-4"></i>
                </span>
                <div class="min-w-0">
                  <p class="text-xs font-black text-slate-800 dark:text-slate-100 truncate">${slot.title}</p>
                  <p class="text-[9px] font-bold text-slate-400">${pct}% hadir</p>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <span class="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-[9px] font-black text-emerald-600 dark:text-emerald-300">H ${counts.hadir}</span>
                <span class="px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-500/10 text-[9px] font-black text-red-500">M ${counts.alpa + counts.sakit + counts.izin + counts.pulang}</span>
              </div>
            </div>
            <div class="space-y-1">
              ${
                items.length
                  ? items
                      .map((item) => `
                        <div class="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 bg-slate-50/80 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700">
                          <span class="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">${safe(item.activity)}</span>
                          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[8px] font-black uppercase ${statusTone(item.status)}">
                            <i data-lucide="${window.getStatusMeta(item.status).icon}" class="w-2.5 h-2.5"></i>${safe(item.status)}
                          </span>
                        </div>
                      `)
                      .join("")
                  : `<div class="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-3 text-center text-[10px] font-bold text-slate-400">Belum ada data</div>`
              }
            </div>
          </div>`;
      })
      .join("");
  } else if (mode === "weekly") {
    const dayNames = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Ahad"];
    el.className = "grid grid-cols-2 sm:grid-cols-4 gap-2";
    el.innerHTML = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(range.start);
      date.setDate(range.start.getDate() + idx);
      const dateKey = window.getLocalDateStr(date);
      const items = events.filter((item) => item.date === dateKey);
      const counts = countStatuses(items);
      const pct = percent(counts.hadir, counts.total);
      return `
        <div class="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3">
          <div class="flex items-center justify-between">
            <p class="text-xs font-black text-slate-800 dark:text-slate-100">${dayNames[idx]}</p>
            <span class="text-sm font-black text-palette-blue">${pct}%</span>
          </div>
          <div class="mt-2 grid grid-cols-4 gap-1 text-[9px] font-black">
            <span class="text-emerald-600">H ${counts.hadir}</span>
            <span class="text-red-500">A ${counts.alpa}</span>
            <span class="text-amber-500">S ${counts.sakit}</span>
            <span class="text-blue-500">I ${counts.izin}</span>
          </div>
        </div>`;
    }).join("");
  } else if (mode === "monthly") {
    const monthDate = new Date(appState.analysisDate || appState.date);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const firstIndex = (new Date(year, month, 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < firstIndex; i++) cells.push(`<div></div>`);
    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const items = events.filter((item) => item.date === dateKey);
      const hasSick = items.some((item) => item.status === "Sakit");
      const hasAlpa = items.some((item) => item.status === "Alpa");
      const hasIzin = items.some((item) => item.status === "Izin");
      const hasData = items.length > 0;
      const status = hasSick ? "Sakit" : hasAlpa ? "Alpa" : hasIzin ? "Izin" : hasData ? "Hadir" : "Tidak";
      const icon = hasData ? window.getStatusMeta(status).icon : "";
      const tone = window.getStatusMeta(status).pill;
      cells.push(`
        <div class="aspect-square rounded-lg border ${tone} dark:bg-slate-900 dark:border-slate-700 flex flex-col items-center justify-center gap-1">
          <span class="text-[10px] font-black">${d}</span>
          ${icon ? `<i data-lucide="${icon}" class="w-3 h-3"></i>` : `<span class="w-3 h-3"></span>`}
        </div>`);
    }
    el.className = "grid grid-cols-7 gap-1";
    el.innerHTML = ["S", "S", "R", "K", "J", "S", "A"]
      .map((day) => `<div class="text-center text-[9px] font-black text-slate-400 pb-1">${day}</div>`)
      .join("") + cells.join("");
  } else {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
    const startMonth = range.start.getMonth();
    const year = range.start.getFullYear();
    el.className = "grid grid-cols-2 sm:grid-cols-3 gap-2";
    el.innerHTML = Array.from({ length: 6 }, (_, idx) => {
      const date = new Date(year, startMonth + idx, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const items = events.filter((item) => item.date.startsWith(key));
      const counts = countStatuses(items);
      const pct = percent(counts.hadir, counts.total);
      return `
        <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-black text-slate-800 dark:text-slate-100">${monthNames[date.getMonth()]}</p>
            <span class="text-sm font-black text-palette-blue">${pct}%</span>
          </div>
          <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div class="h-full bg-palette-blue" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join("");
  }

  if (window.lucide) window.lucide.createIcons();
};

window.renderAnalysisTrendChart = function (timeline) {
  const canvas = document.getElementById("anl-trend-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, rect.width || canvas.width / dpr);
  const height = Math.max(120, rect.height || canvas.height / dpr);

  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  ctx.clearRect(0, 0, width, height);
  const isDark = document.documentElement.classList.contains("dark");
  const data = (timeline || []).slice(-14);
  const pad = { top: 14, right: 16, bottom: 22, left: 28 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  ctx.strokeStyle = isDark ? "rgba(148,163,184,.16)" : "rgba(148,163,184,.22)";
  ctx.lineWidth = 1;
  ctx.font = "700 10px Inter, sans-serif";
  ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
  [0, 50, 100].forEach((tick) => {
    const y = pad.top + chartH - (tick / 100) * chartH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(String(tick), 4, y + 3);
  });

  if (!data.length) {
    ctx.fillStyle = isDark ? "#64748b" : "#94a3b8";
    ctx.textAlign = "center";
    ctx.fillText("Belum ada data tren", width / 2, height / 2);
    ctx.textAlign = "left";
    return;
  }

  const points = data.map((item, idx) => {
    const x = pad.left + (data.length === 1 ? chartW / 2 : (idx / (data.length - 1)) * chartW);
    const y = pad.top + chartH - (item.score / 100) * chartH;
    return { x, y, score: item.score };
  });

  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  grad.addColorStop(0, "rgba(12,129,228,.22)");
  grad.addColorStop(1, "rgba(12,129,228,0)");
  ctx.beginPath();
  points.forEach((pt, idx) => (idx ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
  ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
  ctx.lineTo(points[0].x, pad.top + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((pt, idx) => (idx ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
  ctx.strokeStyle = "#0C81E4";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  points.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = pt.score >= 75 ? "#10b981" : pt.score >= 55 ? "#f59e0b" : "#ef4444";
    ctx.fill();
    ctx.strokeStyle = isDark ? "#0f172a" : "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
};

// 5. Render Bar Helper
window.renderBar = function (type, good, bad) {
  const total = good + bad;
  if (total === 0) {
    // Untuk Sunnah id nya beda (y/t) tapi kita mapping manual disini biar gampang
    if (type === "sunnah") {
      document.getElementById(`bar-${type}-y`).style.width = "0%";
      document.getElementById(`txt-${type}-y`).textContent = "0";
      document.getElementById(`bar-${type}-t`).style.width = "0%";
      document.getElementById(`txt-${type}-t`).textContent = "0";
    } else {
      document.getElementById(`bar-${type}-h`).style.width = "0%";
      document.getElementById(`txt-${type}-h`).textContent = "0";
      document.getElementById(`bar-${type}-m`).style.width = "0%";
      document.getElementById(`txt-${type}-m`).textContent = "0";
    }
    return;
  }

  const pctGood = (good / total) * 100;
  const pctBad = (bad / total) * 100;

  if (type === "sunnah") {
    document.getElementById(`bar-${type}-y`).style.width = `${pctGood}%`;
    document.getElementById(`txt-${type}-y`).textContent = good;
    document.getElementById(`bar-${type}-t`).style.width = `${pctBad}%`;
    document.getElementById(`txt-${type}-t`).textContent = bad;
  } else {
    document.getElementById(`bar-${type}-h`).style.width = `${pctGood}%`;
    document.getElementById(`txt-${type}-h`).textContent = good;
    document.getElementById(`bar-${type}-m`).style.width = `${pctBad}%`;
    document.getElementById(`txt-${type}-m`).textContent = bad;
  }
};

window.timesheetStreakTestMode = false;

window.updateTimesheetStreakTestButton = function () {
  const btn = document.getElementById("ts-streak-test-toggle");
  const enabled = window.timesheetStreakTestMode === true;
  if (btn) btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  const flame = document.getElementById("ts-streak-title-flame");
  const streakEl = document.getElementById("ts-streak-count");
  const streakCount = Number(streakEl?.textContent || 0);
  if (flame) flame.classList.toggle("hidden", !(enabled || streakCount >= 3));
};

window.toggleTimesheetStreakTestMode = function () {
  window.timesheetStreakTestMode = !window.timesheetStreakTestMode;
  if (window.showToast) {
    window.showToast(
      window.timesheetStreakTestMode ? "Mode testing streak aktif." : "Mode testing streak dimatikan.",
      "info",
    );
  }
  window.renderTimesheetCalendar();
};

window.setupTimesheetSecretTrigger = function () {
  const trigger = document.getElementById("timesheet-secret-trigger");
  if (!trigger || trigger.dataset.secretReady === "true") return;
  trigger.dataset.secretReady = "true";
  let taps = 0;
  let timer = null;
  trigger.addEventListener("click", () => {
    taps += 1;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      taps = 0;
      timer = null;
    }, 1400);
    if (taps >= 5) {
      taps = 0;
      if (timer) clearTimeout(timer);
      timer = null;
      window.toggleTimesheetStreakTestMode();
    }
  });
};

window.getTimesheetSlotEndMinutes = function (slotId) {
  const slot = SLOT_WAKTU[slotId];
  const match = String(slot?.subLabel || "").match(/-\s*(\d{1,2}):(\d{2})/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const ordered = Object.values(SLOT_WAKTU).sort((a, b) => a.startHour - b.startHour);
  const idx = ordered.findIndex((s) => s.id === slotId);
  const next = ordered[idx + 1];
  return (next?.startHour ?? (slot?.startHour ?? 0) + 2) * 60;
};

window.getTimesheetMetrics = function (year, month, totalDays) {
  const today = window.getLocalDateStr();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let expected = 0;
  let filled = 0;
  let onTime = 0;
  let timedEntries = 0;
  let speedTotal = 0;
  let speedEntries = 0;

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dateStr > today) continue;
    Object.values(SLOT_WAKTU).forEach((slot) => {
      if (window.isSlotHoliday(slot.id, dateStr)) return;
      const slotStartMinutes = slot.startHour * 60;
      const slotHasStarted = dateStr < today || nowMinutes >= slotStartMinutes;
      if (!slotHasStarted) return;

      const slotData = appState.attendanceData?.[dateStr]?.[slot.id] || {};
      const slotStart = new Date(`${dateStr}T${String(slot.startHour).padStart(2, "0")}:00:00`);
      const slotEndMinutes = window.getTimesheetSlotEndMinutes(slot.id);

      FILTERED_SANTRI.forEach((s) => {
        const id = String(s.nis || s.id);
        expected += 1;
        const entry = slotData[id];
        if (!entry || Object.keys(entry.status || {}).length === 0) return;
        filled += 1;

        const updatedAt = entry.updatedAt ? new Date(entry.updatedAt) : null;
        if (!updatedAt || Number.isNaN(updatedAt.getTime())) return;

        const deltaMinutes = Math.max(0, Math.round((updatedAt - slotStart) / 60000));
        speedTotal += deltaMinutes;
        speedEntries += 1;

        const inputDate = window.getLocalDateStr(updatedAt);
        const inputMinutes = updatedAt.getHours() * 60 + updatedAt.getMinutes();
        timedEntries += 1;
        if (inputDate === dateStr && inputMinutes <= slotEndMinutes) onTime += 1;
      });
    });
  }

  return {
    expected,
    filled,
    fillRate: expected > 0 ? Math.round((filled / expected) * 100) : 0,
    avgSpeed: speedEntries > 0 ? Math.round(speedTotal / speedEntries) : null,
    compliance: timedEntries > 0 ? Math.round((onTime / timedEntries) * 100) : 0,
    onTime,
    timedEntries,
  };
};

window.renderTimesheetMetrics = function (year, month, totalDays) {
  const metrics = window.getTimesheetMetrics(year, month, totalDays);
  const fillRateEl = document.getElementById("ts-fill-rate");
  const fillDetailEl = document.getElementById("ts-fill-rate-detail");
  const speedEl = document.getElementById("ts-fill-speed");
  const complianceEl = document.getElementById("ts-time-compliance");
  const complianceDetailEl = document.getElementById("ts-time-compliance-detail");

  if (fillRateEl) fillRateEl.textContent = `${metrics.fillRate}%`;
  if (fillDetailEl) fillDetailEl.textContent = `${metrics.filled} dari ${metrics.expected} entri`;
  if (speedEl) speedEl.textContent = metrics.avgSpeed === null ? "-" : `${metrics.avgSpeed}m`;
  if (complianceEl) complianceEl.textContent = `${metrics.compliance}%`;
  if (complianceDetailEl) complianceDetailEl.textContent = `${metrics.onTime} dari ${metrics.timedEntries} tepat waktu`;
};

window.renderTimesheetCalendar = function () {
  const container = document.getElementById("timesheet-calendar");
  const label = document.getElementById("timesheet-month-label");
  if (!container) return;
  window.setupTimesheetSecretTrigger();

  container.innerHTML = "";

  // UBAH: Gunakan appState.timesheetViewDate
  const currentViewDate = new Date(appState.timesheetViewDate || appState.date);
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth();

  // Set Label
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  if (label) label.textContent = `${months[month]} ${year}`;

  // Sync input picker
  const picker = document.getElementById("timesheet-month-picker");
  if (picker) picker.value = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Logika Kalender
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Adjustment agar Senin = index 0 (JS default Minggu = 0)
  let startDayIndex = firstDay.getDay() - 1;
  if (startDayIndex === -1) startDayIndex = 6;

  const totalDays = lastDay.getDate();

  let monthlyComplete = 0;
  let monthlyPartial = 0;
  let monthlyLocked = 0;
  const streakInfo = window.getTimesheetStreakInfo(year, month, totalDays);

  // Empty cells before start
  for (let i = 0; i < startDayIndex; i++) {
    const div = document.createElement("div");
    container.appendChild(div);
  }

  // Date cells
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    const today = window.getLocalDateStr();

    const diffDays = Math.floor(
      (new Date(today) - new Date(dateStr)) / 86400000,
    );

    let requiredSlots = 0;
    let completedSlots = 0;
    let progressSlots = 0;

    Object.values(SLOT_WAKTU).forEach((slot) => {
      if (window.isSlotHoliday(slot.id, dateStr)) return;

      requiredSlots++;

      const slotData = appState.attendanceData?.[dateStr]?.[slot.id];

      let totalSantri = 0;
      let processedSantri = 0;

      FILTERED_SANTRI.forEach((s) => {
        const santriId = String(s.nis || s.id);

        totalSantri++;

        if (slotData?.[santriId]) {
          processedSantri++;
        }
      });

      if (totalSantri > 0 && processedSantri === totalSantri) {
        completedSlots++;
      }
    });

    const dayInfo = window.getDayCompletionStatus(dateStr);

    let status = "";

    if (dateStr > today) {
      status = "future";
    } else if (dateStr === today) {
      status = "today";
    } else if (dayInfo.complete) {
      status = "completed";
    } else {
      const access = window.isSlotAccessible(
        Object.keys(SLOT_WAKTU)[0],
        dateStr,
      );

      if (access.locked) {
        status = "locked";
      } else {
        status = "partial";
      }
    }

    if (status === "completed") monthlyComplete++;

    if (status === "partial") monthlyPartial++;

    if (status === "locked") monthlyLocked++;

    let bgColor = "";
    let textColor = "";

    switch (status) {
      case "locked":
        bgColor = "#ef4444";
        textColor = "#fff";
        break;

      case "partial":
        bgColor = "#fbbf24";
        textColor = "#fff";
        break;

      case "completed":
        bgColor = "#10b981";
        textColor = "#fff";
        break;

      case "today":
        bgColor = "#0ea5e9";
        textColor = "#fff";
        break;

      case "future":
        bgColor = "#e2e8f0";
        textColor = "#64748b";
        break;
    }

    const isToday = dateStr === today;

    const borderClass = isToday
      ? "ring-2 ring-indigo-500 ring-offset-2"
      : "";

    const div = document.createElement("div");

    div.className = `
aspect-square
relative
flex
flex-col
items-center
justify-center
rounded-xl
text-xs
font-bold
transition-all
hover:scale-110
cursor-pointer
${borderClass}
    `;
    div.style.backgroundColor = bgColor;
    div.style.color = textColor;

    div.innerHTML = `
        <span>${d}</span>
        ${
          status === "today"
            ? `<span class="text-[9px] opacity-90">
                      ${completedSlots}/${requiredSlots}
                 </span>`
            : ""
        }
    `;

    if (status !== "future" && status !== "locked") {
      div.onclick = () => {
        window.handleDateChange(dateStr);
        window.switchTab("home");
      };
    }

    container.appendChild(div);
  }
  const completeEl = document.getElementById("ts-complete-count");

  const partialEl = document.getElementById("ts-partial-count");

  const lockedEl = document.getElementById("ts-locked-count");
  const streakEl = document.getElementById("ts-streak-count");

  if (completeEl) completeEl.textContent = monthlyComplete;

  if (partialEl) partialEl.textContent = monthlyPartial;

  if (lockedEl) lockedEl.textContent = monthlyLocked;
  const visibleStreak = window.timesheetStreakTestMode
    ? Math.max(streakInfo.activeStreak, 3)
    : (streakInfo.activeStreak >= 3 ? streakInfo.activeStreak : 0);
  if (streakEl) streakEl.textContent = visibleStreak;
  window.renderTimesheetMetrics(year, month, totalDays);
  window.updateTimesheetStreakTestButton();
  if (window.lucide) window.lucide.createIcons();
};

window.changeTimesheetMonth = function (direction) {
  // Ambil tanggal view saat ini, set ke tgl 1 agar tidak error saat melompati bulan (misal dari 31 Jan ke Feb)
  const d = new Date(appState.timesheetViewDate || appState.date);
  d.setDate(1);
  d.setMonth(d.getMonth() + direction);

  appState.timesheetViewDate = window.getLocalDateStr(d);
  window.renderTimesheetCalendar();
};

window.setTimesheetMonth = function (val) {
  if (!val) return;
  // val dari input type="month" formatnya YYYY-MM
  appState.timesheetViewDate = val + "-01";
  window.renderTimesheetCalendar();
};

// --- LOGIKA LAPORAN REKAP ---

// 1. Set Mode Laporan
window.setReportMode = function (mode) {
  appState.reportMode = mode;

  // Update UI Button
  document.querySelectorAll(".rpt-btn").forEach((btn) => {
    if (btn.dataset.mode === mode) {
      btn.classList.add("active-mode", "text-white");
      btn.classList.remove("text-slate-500");
    } else {
      btn.classList.remove("active-mode", "text-white");
      btn.classList.add("text-slate-500");
    }
  });

  window.syncPeriodPicker("report");
  window.updateReportTab(); // Refresh tabel
};

// 2. Helper Range Tanggal (Update support Yearly)
window.getReportDateRange = function (mode) {
  const today = new Date(appState.reportDate || appState.date);
  const range = window.getDateRange(mode, appState.reportDate || appState.date);
  // Override labels with shorter format for the report view
  if (mode === "monthly") {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Ags",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    range.label = `${months[today.getMonth()]} ${today.getFullYear()}`;
  } else if (mode === "semester") {
    range.label =
      today.getMonth() < 6
        ? `Sem. Genap ${today.getFullYear()}`
        : `Sem. Ganjil ${today.getFullYear()}`;
  }
  return range;
};

// --- FITUR GEOFENCING ---

// Rumus Haversine untuk menghitung jarak antar 2 koordinat (dalam meter)
window.getDistanceFromLatLonInMeters = function (lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius bumi dalam meter
  const dLat = window.deg2rad(lat2 - lat1);
  const dLon = window.deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(window.deg2rad(lat1)) *
      Math.cos(window.deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Jarak dalam meter
  return d;
};

window.getCachedLocation = function () {
  try {
    const cache = JSON.parse(localStorage.getItem(GPS_CACHE_KEY));

    if (!cache || cache.distance === undefined) return null;

    const age = Date.now() - cache.timestamp;

    if (age > GPS_CACHE_DURATION) {
      return null;
    }

    return cache;
  } catch {
    return null;
  }
};

window.deg2rad = function (deg) {
  return deg * (Math.PI / 180);
};

// Fungsi Utama Verifikasi Lokasi (Async)
window.verifyLocation = function () {
  return new Promise((resolve, reject) => {
    if (!GEO_CONFIG.useGeofencing) {
      resolve(true);
      return;
    }

    if (!navigator.geolocation) {
      reject("Browser tidak mendukung GPS.");
      return;
    }

    const toastId = window.showToast(
      "📡 Memeriksa lokasi GPS...",
      "info",
      true,
    );

    const timeout = setTimeout(() => {
      reject("Timeout: GPS tidak merespons dalam 10 detik");
      if (toastId) toastId.remove();
    }, 10000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        if (toastId) toastId.remove();

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        let isInside = false;
        let nearestDist = 9999999;
        let nearestName = "Unknown";

        GEO_CONFIG.locations.forEach((loc) => {
          const dist = window.getDistanceFromLatLonInMeters(
            userLat,
            userLng,
            loc.lat,
            loc.lng,
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestName = loc.name;
          }

          if (dist <= GEO_CONFIG.maxRadiusMeters) {
            isInside = true;
          }
        });

        if (isInside) {
          localStorage.setItem(
            GPS_CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              distance: nearestDist,
              locationName: nearestName,
              isInside: isInside,
            }),
          );
          resolve(true);
        } else {
          localStorage.setItem(
            GPS_CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              distance: nearestDist,
              locationName: nearestName,
              isInside: isInside,
            }),
          );
          reject(
            `Lokasi Anda terlalu jauh (${Math.round(nearestDist)}m dari ${nearestName}). Radius maksimal: ${GEO_CONFIG.maxRadiusMeters}m.`,
          );
        }
      },
      (error) => {
        clearTimeout(timeout);
        if (toastId) toastId.remove();

        let msg = "Gagal mendeteksi lokasi.";
        if (error.code === 1)
          msg = "Izin lokasi ditolak. Aktifkan GPS di browser.";
        else if (error.code === 2)
          msg = "Sinyal GPS tidak ditemukan. Pastikan Anda di luar ruangan.";
        else if (error.code === 3) msg = "Waktu deteksi GPS habis. Coba lagi.";

        reject(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: GPS_CACHE_DURATION,
      },
    );
  });
};

// ==========================================
// FITUR NOTIFIKASI PINTAR (REMINDER)
// ==========================================

// 1. Meminta Izin Notifikasi (Dipanggil tombol lonceng)
window.requestNotificationPermission = async function () {
  if (!("Notification" in window)) {
    return window.showToast("Browser Anda tidak mendukung notifikasi", "error");
  }

  if (Notification.permission === "granted") {
    // Jika sudah aktif, kirim tes notifikasi
    window.sendLocalNotification(
      "Notifikasi Aktif ✅",
      "Anda akan diingatkan saat waktu presensi tiba.",
      "info",
    );
  } else {
    // Jika belum, minta izin
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      window.showToast("Notifikasi berhasil diaktifkan!", "success");
      window.sendLocalNotification(
        "Assalamu'alaikum!",
        "Sistem pengingat presensi Syamsa aktif.",
        "info",
      );

      // Sembunyikan badge merah di tombol jika ada
      const badge = document.getElementById("notif-badge");
      if (badge) badge.classList.add("hidden");
    } else {
      window.showToast("Izin notifikasi ditolak", "warning");
    }
  }
};

// 2. Fungsi Mengirim Notifikasi
window.sendLocalNotification = function (title, body, type = "info") {
  if (Notification.permission === "granted") {
    // Cek mode HP (Vibrate)
    const options = {
      body: body,
      icon: "https://api.iconify.design/lucide/shield-check.svg?color=%2310b981", // Icon App
      badge: "https://api.iconify.design/lucide/bell.svg?color=%23ffffff",
      vibrate: [200, 100, 200], // Getaran: zzz-z-zzz
      tag: title, // Agar notifikasi dengan judul sama tidak menumpuk
    };

    new Notification(title, options);
  }
};

// 3. Penjadwal Otomatis (Cek Waktu Setiap Menit)
window.checkScheduledNotifications = function () {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();

  // Eksekusi hanya di detik ke-0 (setiap menit pas) agar tidak spam
  if (s !== 0) return;

  // --- TIPE 1: REMINDER MASUK WAKTU (Saat jam mulai pas) ---
  // Shubuh (04:00), Ashar (15:00), Maghrib (18:00), Isya (19:00)
  Object.values(SLOT_WAKTU).forEach((slot) => {
    if (h === slot.startHour && m === 0) {
      window.sendLocalNotification(
        `Waktunya ${slot.label}! 🕌`,
        `Sudah masuk waktu ${slot.label}. Silakan cek kehadiran santri.`,
      );
    }
  });

  // --- TIPE 2: REMINDER DEADLINE (30 Menit Sebelum Habis) ---
  // Shubuh habis jam 06:00 -> Ingatkan jam 05:30
  if (h === 5 && m === 30) {
    window.sendLocalNotification(
      "30 Menit Lagi! ⏳",
      "Waktu presensi Shubuh segera berakhir.",
    );
  }
  // Ashar habis jam 17:00 -> Ingatkan jam 16:30
  if (h === 16 && m === 30) {
    window.sendLocalNotification(
      "Hampir Habis! ⏳",
      "Segera selesaikan presensi Ashar.",
    );
  }
  // Maghrib habis jam 19:00 -> Ingatkan jam 18:45 (15 menit aja karena singkat)
  if (h === 18 && m === 45) {
    window.sendLocalNotification(
      "Segera Isya! ⚠️",
      "Waktu Maghrib tinggal 15 menit.",
    );
  }
  // Isya habis jam 21:00 -> Ingatkan jam 20:30
  if (h === 20 && m === 30) {
    window.sendLocalNotification(
      "Jangan Lupa! 🌙",
      "Pastikan semua santri sudah diabsen Isya.",
    );
  }

  // --- TIPE 3: MOTIVASI HARIAN (Opsional) ---
  // Jam 08:00 Pagi
  if (h === 8 && m === 0) {
    window.sendLocalNotification(
      "Semangat Pagi! ☀️",
      "Semoga hari ini penuh keberkahan dalam mengasuh santri.",
    );
  }
};

window.requestNotificationPermission = async function () {
  if (!("Notification" in window)) {
    return window.showToast("Browser Anda tidak mendukung notifikasi", "error");
  }

  if (Notification.permission === "granted") {
    window.sendLocalNotification(
      "Notifikasi Aktif",
      "Anda akan diingatkan saat waktu presensi tiba.",
      "info",
      "notification-test",
    );
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    window.showToast("Notifikasi berhasil diaktifkan!", "success");
    window.sendLocalNotification(
      "Assalamu'alaikum!",
      "Sistem pengingat presensi Syamsa aktif.",
      "info",
      "notification-enabled",
    );
    document.getElementById("notif-badge")?.classList.add("hidden");
  } else {
    window.showToast("Izin notifikasi ditolak", "warning");
  }
};

window.isNotificationTypeEnabled = function (key) {
  const types = appState.settings.notificationTypes || {};
  return types[key] !== false;
};

window.shouldSendScheduledNotification = function (key, now = new Date()) {
  const minuteKey = `${window.getLocalDateStr(now)}-${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}-${key}`;
  const storageKey = `syamsa_notification_sent_${minuteKey}`;
  if (localStorage.getItem(storageKey) === "true") return false;
  localStorage.setItem(storageKey, "true");
  return true;
};

window.sendLocalNotification = function (title, body, type = "info", tag = title) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (appState.settings && appState.settings.notifications === false) return;

  const options = {
    body,
    icon: "icon.webp",
    badge: "icon.png",
    vibrate: [160, 70, 160],
    tag,
    renotify: false,
    data: { url: location.href, type },
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.showNotification(title, options))
      .catch(() => new Notification(title, options));
    return;
  }

  new Notification(title, options);
};

window.getSlotEndMinutesForNotification = function (slotId) {
  if (window.getTimesheetSlotEndMinutes) return window.getTimesheetSlotEndMinutes(slotId);
  const slot = SLOT_WAKTU[slotId];
  const match = String(slot?.subLabel || "").match(/-\s*(\d{1,2}):(\d{2})/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  return ((slot?.startHour || 0) + 2) * 60;
};

window.getIncompleteAttendanceCountForDate = function (dateStr) {
  let missing = 0;
  Object.values(SLOT_WAKTU).forEach((slot) => {
    if (window.isSlotHoliday(slot.id, dateStr)) return;
    const slotData = appState.attendanceData?.[dateStr]?.[slot.id] || {};
    FILTERED_SANTRI.forEach((s) => {
      const id = String(s.nis || s.id);
      if (!slotData[id] || Object.keys(slotData[id].status || {}).length === 0) missing += 1;
    });
  });
  return missing;
};

window.checkScheduledNotifications = function () {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (appState.settings && appState.settings.notifications === false) return;

  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const currentMinutes = h * 60 + m;

  Object.values(SLOT_WAKTU).forEach((slot) => {
    const startMinutes = slot.startHour * 60;
    if (currentMinutes === startMinutes && window.isNotificationTypeEnabled("sesi_presensi_mulai")) {
      const key = `slot-open-${slot.id}`;
      if (window.shouldSendScheduledNotification(key, now)) {
        window.sendLocalNotification(
          `Sesi ${slot.label} telah terbuka`,
          `Presensi ${slot.label} sudah bisa diisi untuk kelas aktif.`,
          "session",
          key,
        );
      }
    }

    const endMinutes = window.getSlotEndMinutesForNotification(slot.id);
    if (endMinutes - currentMinutes === 10 && window.isNotificationTypeEnabled("sisa_10_menit")) {
      const key = `slot-close-10-${slot.id}`;
      if (window.shouldSendScheduledNotification(key, now)) {
        window.sendLocalNotification(
          "10 menit lagi sesi tutup",
          `Segera selesaikan presensi ${slot.label} sebelum sesi terkunci.`,
          "warning",
          key,
        );
      }
    }
  });

  if (window.todaySalatTimings && window.isNotificationTypeEnabled("pengingat_salat")) {
    Object.entries(window.todaySalatTimings).forEach(([name, timeStr]) => {
      const minutes = window.parseSalatTimeToMinutes?.(timeStr);
      if (Number.isFinite(minutes) && minutes - currentMinutes === 15) {
        const key = `salat-15-${name}`;
        if (window.shouldSendScheduledNotification(key, now)) {
          window.sendLocalNotification(
            `15 menit menuju ${name}`,
            `Bersiap masuk waktu ${name} pukul ${timeStr}.`,
            "prayer",
            key,
          );
        }
      }
    });
  }

  if ((h === 7 && m === 30) || (h === 20 && m === 0)) {
    const lockDate = new Date();
    lockDate.setDate(lockDate.getDate() - 3);
    const lockDateStr = window.getLocalDateStr(lockDate);
    const missing = window.getIncompleteAttendanceCountForDate(lockDateStr);
    if (missing > 0 && window.isNotificationTypeEnabled("presensi_hampir_terkunci")) {
      const key = `almost-locked-${lockDateStr}`;
      if (window.shouldSendScheduledNotification(key, now)) {
        window.sendLocalNotification(
          "Presensi hampir terkunci",
          `Presensi ${window.formatDate(lockDateStr)} masih kosong ${missing} entri. Segera lengkapi sebelum benar-benar terkunci.`,
          "warning",
          key,
        );
      }
    }
  }

  if ((h === 6 && m === 30) || (h === 17 && m === 0)) {
    const activePermits = (appState.permits || []).filter((p) => p.is_active !== false && ["sakit", "izin", "pulang"].includes(p.category));
    if (activePermits.length > 0 && window.isNotificationTypeEnabled("cek_perizinan_aktif")) {
      const key = `active-permit-check-${h}`;
      if (window.shouldSendScheduledNotification(key, now)) {
        window.sendLocalNotification(
          "Cek kondisi santri berizin",
          `Ada ${activePermits.length} santri sakit/izin/pulang. Pastikan sudah sembuh atau kembali bila waktunya.`,
          "permit",
          key,
        );
      }
    }
  }

  if (h === 17 && m === 0 && window.isNotificationTypeEnabled("pengingat_puasa")) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowFasting = window.getFastingInfo?.(tomorrow);
    if (tomorrowFasting) {
      const key = "fasting-tomorrow";
      if (window.shouldSendScheduledNotification(key, now)) {
        window.sendLocalNotification(
          "Besok jadwal puasa",
          `Besok ${tomorrowFasting}. Pastikan santri siap niat dan sahur.`,
          "fasting",
          key,
        );
      }
    }
  }
};

// 2. Logika Pindah Tab (UI Change)
window.setPermitTab = function (tab) {
  currentPermitTab = tab;

  // 1. Reset Semua Input Form agar bersih
  const inputsToReset = ["permit-reason", "permit-pickup", "permit-vehicle"];
  inputsToReset.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset Date ke Default Tanggal Yang Sedang Dilihat (User Friendly)
  const defaultDate = appState.date || window.getLocalDateStr();
  document.getElementById("permit-start-date").value = defaultDate;
  document.getElementById("permit-end-date").value = defaultDate;
  document.getElementById("permit-start-session").value = "shubuh";

  // 2. UI Update (Sama seperti sebelumnya)
  document.querySelectorAll(".permit-tab").forEach((btn) => {
    btn.className =
      "permit-tab flex-1 py-2 rounded-lg text-xs font-bold transition-all text-slate-500 hover:bg-slate-50";
  });
  const activeBtn = document.getElementById(`tab-btn-${tab}`);

  // Warna Tab
  if (tab === "sakit")
    activeBtn.className =
      "permit-tab flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-amber-50 text-amber-600 shadow-sm border border-amber-100";
  else if (tab === "izin")
    activeBtn.className =
      "permit-tab flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-blue-50 text-blue-600 shadow-sm border border-blue-100";
  else if (tab === "pulang")
    activeBtn.className =
      "permit-tab flex-1 py-2 rounded-lg text-xs font-bold transition-all bg-purple-50 text-purple-600 shadow-sm border border-purple-100";

  // Show/Hide Fields
  const fieldEnd = document.getElementById("field-end-time");
  const fieldLoc = document.getElementById("field-location");
  const fieldTrans = document.getElementById("field-transport");
  const infoSakit = document.getElementById("info-sakit");
  const btnSelectAll = document.getElementById("btn-select-all-permit");
  const listReasons = document.getElementById("reasons-list");
  const lblReason = document.getElementById("lbl-reason");

  listReasons.innerHTML = ""; // Reset suggestion

  if (tab === "sakit") {
    lblReason.textContent = "Sakit Apa?";
    fieldEnd.classList.add("hidden");
    fieldLoc.classList.remove("hidden");
    fieldTrans.classList.add("hidden");
    infoSakit.classList.remove("hidden");
    if (btnSelectAll) btnSelectAll.parentElement.classList.add("hidden"); // Sembunyikan pilih semua utk sakit

    [
      "Demam",
      "Flu/Batuk",
      "Sakit Gigi",
      "Diare",
      "Tifus",
      "Cacar",
      "Maag",
      "Kecapekan",
    ].forEach((r) => {
      listReasons.innerHTML += `<option value="${r}">`;
    });
  } else {
    // Logic Izin & Pulang
    fieldEnd.classList.remove("hidden");
    fieldLoc.classList.add("hidden");
    infoSakit.classList.add("hidden");
    if (btnSelectAll) btnSelectAll.parentElement.classList.remove("hidden"); // Munculkan utk izin/pulang

    if (tab === "izin") {
      lblReason.textContent = "Keperluan Apa?";
      fieldTrans.classList.add("hidden");
      [
        "Acara Keluarga",
        "Menikah",
        "Wisuda Kakak",
        "Lomba",
        "Tugas Madrasah",
        "Check-up Dokter",
      ].forEach((r) => {
        listReasons.innerHTML += `<option value="${r}">`;
      });
    } else {
      lblReason.textContent = "Jenis Kepulangan?";
      fieldTrans.classList.remove("hidden");
      [
        "Pulang Bulanan",
        "Libur Semester",
        "Libur Lebaran",
        "Pulang Sakit Panjang",
      ].forEach((r) => {
        listReasons.innerHTML += `<option value="${r}">`;
      });
    }
  }
};

// 3. Logic Simpan Data (Advanced)
window.savePermitLogic = function () {
  const checkboxes = document.querySelectorAll(
    'input[name="permit_santri_select"]:checked',
  );
  const selectedNis = Array.from(checkboxes).map((cb) => cb.value);

  if (selectedNis.length === 0)
    return window.showToast("Pilih minimal 1 santri", "warning");

  const reason = document.getElementById("permit-reason").value;
  const startDate = document.getElementById("permit-start-date").value;
  const startSession = document.getElementById("permit-start-session").value;

  if (!reason) return window.showToast("Isi alasannya dulu", "warning");
  if (!startDate)
    return window.showToast("Tanggal mulai wajib diisi", "warning");

  let permitData = {
    category: currentPermitTab, // sakit, izin, pulang
    reason: reason,
    start_date: startDate,
    start_session: startSession,
    timestamp: new Date().toISOString(),
    is_active: true, // Flag utama
  };

  // Tambahan Data per Kategori
  if (currentPermitTab === "sakit") {
    // SAKIT: Open ended (end_date null)
    permitData.location = document.querySelector(
      'input[name="loc_sakit"]:checked',
    )?.value || "Asrama";
    permitData.end_date = null;
    permitData.status_label = "S";
  } else {
    // IZIN & PULANG: Punya Deadline
    const endDate = document.getElementById("permit-end-date").value;
    const endTime = document.getElementById("permit-end-time").value || "17:00";

    if (!endDate)
      return window.showToast("Tanggal selesai wajib diisi", "warning");
    if (endDate < startDate)
      return window.showToast("Tanggal selesai error", "error");

    permitData.end_date = endDate;
    permitData.end_time_limit = endTime;

    if (currentPermitTab === "izin") {
      permitData.status_label = "I";
    } else {
      permitData.status_label = "P";
      permitData.pickup = document.getElementById("permit-pickup").value;
      permitData.vehicle = document.getElementById("permit-vehicle").value;
    }
  }

  // Simpan Loop
  selectedNis.forEach((nis) => {
    const uniqueId =
      Date.now().toString() + Math.random().toString(36).substr(2, 5);
    appState.permits.push({ ...permitData, id: uniqueId, nis: nis });
  });

  localStorage.setItem(APP_CONFIG.permitKey, JSON.stringify(appState.permits));

  window.showToast(`${selectedNis.length} Data Berhasil Disimpan`, "success");
  window.renderPermitList();

  // Reset Checkbox
  checkboxes.forEach((cb) => (cb.checked = false));
  window.updatePermitCount();

  // Refresh Dashboard jika tanggal relevan
  if (appState.date >= startDate) {
    window.renderAttendanceList();
    window.updateDashboard();
  }
};

// 1. SAKIT -> SEMBUH
window.markAsRecovered = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (permit) {
    // PERBAIKAN: Dialog yang lebih jelas & Logika Default yang Aman
    // Default (OK) sekarang adalah: Sembuh SEKARANG (Sesi ini tetap dihitung sakit, baru sehat sesi depan)
    // Ini mencegah status Shubuh berubah jadi Hadir.

    const keepSick = confirm(
      "Konfirmasi Kesembuhan:\n\n" +
        "[OK] = Baru Sembuh SEKARANG (Sesi ini tetap tercatat Sakit)\n" +
        "[Cancel] = Sudah sehat SEJAK AWAL sesi ini (Ubah status sesi ini jadi Hadir)",
    );

    permit.end_date = appState.date;

    // Logika Index Sesi — gunakan SESSION_KEYS agar 'sekolah' ikut tertangani
    const SESSION_KEYS = [
      "kemarin",
      "shubuh",
      "sekolah",
      "ashar",
      "maghrib",
      "isya",
    ];
    const currIdx = SESSION_KEYS.indexOf(appState.currentSlotId);

    if (keepSick) {
      // Pilihan OK (Default): Sembuh NANTI/SEKARANG.
      // Sesi saat ini masih dianggap Sakit.
      permit.end_session = appState.currentSlotId;
    } else {
      // Pilihan Cancel: Sembuh DARI TADI.
      // Sesi saat ini dianggap sudah sehat (Hadir).
      // End Session = Sesi Sebelumnya.
      permit.end_session = currIdx <= 0 ? "kemarin" : SESSION_KEYS[currIdx - 1];
    }

    // Simpan
    localStorage.setItem(
      APP_CONFIG.permitKey,
      JSON.stringify(appState.permits),
    );
    window.showToast("Status kesembuhan diperbarui", "success");

    // Refresh UI
    window.renderAttendanceList();
    window.renderActivePermitsWidget();
    window.renderPermitHistory(); // Refresh profil juga
  }
};

// 2. IZIN/PULANG -> KEMBALI LEBIH AWAL
window.markAsReturned = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (permit) {
    // Kalau pulang tepat waktu, kita set is_active false
    // Agar sesi hari ini bisa diisi Hadir manual oleh Musyrif
    permit.is_active = false;

    localStorage.setItem(
      APP_CONFIG.permitKey,
      JSON.stringify(appState.permits),
    );
    window.showToast(
      "Santri sudah kembali. Silakan presensi manual.",
      "success",
    );
    window.renderPermitList();
    window.renderAttendanceList();
    if (window.renderActivePermitsWidget) window.renderActivePermitsWidget();
  }
};

// 3. PERPANJANG IZIN (P -> I atau I -> I)
// 2. PULANG -> PERPANJANG (Poin 5: Pulang -> Izin)
window.extendPermit = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (!permit) return;

  const newDate = prompt(
    "Perpanjang sampai tanggal berapa? (YYYY-MM-DD)",
    permit.end_date,
  );
  if (!newDate) return;

  permit.end_date = newDate;

  // Poin 5: "mengabari jadi I Izin"
  // Jika asalnya Pulang, kita ubah jadi Izin karena sudah lewat jatah pulang.
  if (permit.category === "pulang") {
    permit.category = "izin";
    permit.status_label = "I";
    permit.reason += " (Diperpanjang/Telat)";
    window.showToast("Status diubah ke Izin (Diperpanjang)", "info");
  } else {
    window.showToast("Masa izin diperpanjang", "success");
  }

  localStorage.setItem(APP_CONFIG.permitKey, JSON.stringify(appState.permits));
  window.renderPermitList();
  window.renderAttendanceList();
};

window.toggleSelectAllPermit = function () {
  const btn = document.getElementById("btn-select-all-permit");
  const checkboxes = document.querySelectorAll(
    'input[name="permit_santri_select"]',
  );

  isAllSelected = !isAllSelected;

  let actuallySelected = 0;
  checkboxes.forEach((cb) => {
    // Only toggle visible checkboxes
    if (cb.offsetParent !== null) {
      cb.checked = isAllSelected;
      if (isAllSelected) actuallySelected++;
    }
  });

  // Update button text based on actual state
  if (btn) {
    if (isAllSelected) {
      btn.innerHTML =
        '<i data-lucide="x-circle" class="w-4 h-4 mr-1"></i> Batal Pilih';
    } else {
      btn.innerHTML =
        '<i data-lucide="check-circle" class="w-4 h-4 mr-1"></i> Pilih Semua';
    }
    window.refreshIcons();
  }

  window.updatePermitCount();
};

window.goToToday = function () {
  const today = window.getLocalDateStr();

  appState.date = today;

  appState.timesheetViewDate = today;

  window.updateDateDisplay();
  window.updateDashboard();
  window.renderTimesheetCalendar();

  window.showToast("Kembali ke hari ini", "success");
};

// Tambahkan ini di script.js
window.quickOpen = function (slotId) {
  if (window.isSlotHoliday(slotId, appState.date)) {
    return window.showToast(
      `Kegiatan ${SLOT_WAKTU[slotId].label} libur pada hari ini.`,
      "info",
    );
  }
  // 1. Set slot yang dipilih ke state global
  appState.currentSlotId = slotId;

  // 2. Update tampilan dashboard (opsional, agar chart/judul berubah)
  window.updateDashboard();

  // 3. Langsung buka halaman absensi
  window.openAttendance();

  // 4. Beri feedback visual
  const labels = {
    shubuh: "Shubuh",
    sekolah: "Sekolah",
    ashar: "Ashar",
    maghrib: "Maghrib",
    isya: "Isya",
  };
  window.showToast(`Membuka presensi ${labels[slotId]}`, "info");
};

window.updateQuickAccessButtons = function () {
  const schoolButton = document.getElementById("quick-access-sekolah");
  const quickGrid = document.getElementById("quick-access-grid");
  if (!schoolButton) return;

  const isSchoolHoliday = window.isSlotHoliday("sekolah", appState.date);
  schoolButton.classList.toggle("hidden", isSchoolHoliday);

  if (quickGrid) {
    quickGrid.classList.toggle("grid-cols-5", !isSchoolHoliday);
    quickGrid.classList.toggle("grid-cols-4", isSchoolHoliday);
  }
};

window.showStatDetails = function (statusType) {
  const modal = document.getElementById("modal-stat-detail");
  const container = document.getElementById("stat-detail-list");
  const title = document.getElementById("stat-detail-title");
  let filledSantri = 0;

  // 1. Setup UI Modal
  modal.classList.remove("hidden");
  container.innerHTML =
    '<div class="text-center py-4"><span class="loading-spinner"></span></div>';

  // Warna Judul sesuai Tipe
  let colorClass = "text-slate-800";
  if (statusType === "Hadir") colorClass = "text-blue-500";
  else if (statusType === "Tidak Hadir") colorClass = "text-rose-500";
  else if (statusType === "Sakit") colorClass = window.getStatusMeta("Sakit").text;
  else if (statusType === "Izin") colorClass = "text-blue-500";
  else if (statusType === "Alpa") colorClass = "text-red-500";
  else if (statusType === "Telat") colorClass = "text-cyan-500";
  else if (statusType === "Pulang") colorClass = "text-purple-500";

  title.textContent = `Daftar ${statusType}`;
  title.className = `text-xl font-black ${colorClass}`;

  // 2. Ambil Data Real
  const dateKey = appState.date;
  const slotId = appState.currentSlotId; // Data berdasarkan slot aktif dashboard
  const slotData = appState.attendanceData[dateKey]?.[slotId] || {};

  // Filter Santri
  const list = FILTERED_SANTRI.filter((s) => {
    const id = String(s.nis || s.id);
    const data = slotData[id];

    if (data && data.status && Object.keys(data.status).length > 0) {
      filledSantri++;
    }

    // Cek status Shalat (Utama)
    const currentStatus = data?.status?.[mainActId]; // <-- PERBAIKAN DI SINI

    // Logic Matching
    if (statusType === "Hadir") return currentStatus === "Hadir" || currentStatus === "Telat";
    if (statusType === "Tidak Hadir") return currentStatus === "Sakit" || currentStatus === "Izin" || currentStatus === "Pulang" || currentStatus === "Alpa";
    if (statusType === "Sakit") return currentStatus === "Sakit";
    if (statusType === "Izin") return currentStatus === "Izin";
    if (statusType === "Pulang") return currentStatus === "Pulang";
    if (statusType === "Alpa") return currentStatus === "Alpa";

    return false;
  });

  container.innerHTML = "";

  // 3. Render List
  if (list.length === 0) {
    container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-10 text-slate-400">
                <i data-lucide="user-x" class="w-12 h-12 mb-3 opacity-50"></i>
                <p class="text-xs font-bold">Tidak ada santri ${statusType}</p>
            </div>
        `;
  } else {
    list.forEach((s) => {
      const id = String(s.nis || s.id);
      const note = slotData[id]?.note || "-";

      // Generate HTML Item
      const div = document.createElement("div");
      div.className =
        "flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700";
      div.innerHTML = `
                <div class="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center font-black text-xs text-slate-600 border border-slate-200 shadow-sm">
                    ${s.nama.substring(0, 2).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 dark:text-white text-sm truncate">${window.sanitizeHTML(s.nama)}</h4>
                    <p class="text-[10px] text-slate-500 truncate">${s.asrama || s.kelas}</p>
                </div>
                ${
                  note !== "-" && note !== ""
                    ? `
                <div class="max-w-[40%] text-right">
                    <span class="inline-block px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 text-[9px] text-slate-500 leading-tight">
                        ${note}
                    </span>
                </div>`
                    : ""
                }
            `;
      container.appendChild(div);
    });
  }

  if (window.lucide) window.lucide.createIcons();
};

window.renderDashboardPembinaan = function () {
  const container = document.getElementById("dashboard-pembinaan-list");
  const badge = document.getElementById("pembinaan-count-badge");
  const cardTitle = document.querySelector("#dashboard-pembinaan-card h3");

  // Ubah Judul Widget agar mencakup semua (yang sudah & belum dibina)
  if (cardTitle)
    cardTitle.textContent = "Pelanggaran Hari Ini";

  if (!container) return;

  const dateKey = appState.date;
  const dayData = appState.attendanceData[dateKey];

  let violationList = [];
  let pendingCount = 0;

  if (dayData) {
    FILTERED_SANTRI.forEach((s) => {
      const id = String(s.nis || s.id);

      Object.values(SLOT_WAKTU).forEach((slot) => {
        const sData = dayData[slot.id]?.[id];
        const st = sData?.status?.shalat;

        // Syarat: Status ALPA (Tidak peduli sudah dibina atau belum)
        if (st === "Alpa") {
          const isCoached = sData.coaching && sData.coaching.done;

          // Hitung yang belum dibina untuk badge notifikasi
          if (!isCoached) pendingCount++;

          violationList.push({
            ...s,
            slotLabel: slot.label,
            slotId: slot.id,
            date: dateKey,
            isCoached: isCoached,
            coachingInfo: sData.coaching, // Bawa info jika perlu ditampilkan
          });
        }
      });
    });
  }

  // Update Badge (Merah jika ada pending, Hijau jika semua beres)
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = `${pendingCount} Perlu Dibina`;
      badge.className =
        "px-2 py-0.5 rounded-md bg-red-500 text-white text-[10px] font-bold shadow-sm animate-pulse whitespace-nowrap";
    } else if (violationList.length > 0) {
      badge.textContent = `Tuntas (${violationList.length})`;
      badge.className =
        "px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-600 text-[10px] font-bold border border-emerald-200 whitespace-nowrap";
    } else {
      badge.textContent = "0 Pelanggaran";
      badge.className =
        "px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold whitespace-nowrap";
    }
  }

  // Render UI
  container.innerHTML = "";

  if (violationList.length === 0) {
    container.innerHTML = `
      <div class="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <div class="text-left">
            <p class="text-[11px] sm:text-xs font-black text-emerald-700 dark:text-emerald-400">Aman Terkendali</p>
            <p class="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-400/70">Nihil pelanggaran hari ini</p>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400/50 mr-1 shrink-0"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      </div>`;
  } else {
    violationList.sort((a, b) =>
      a.isCoached === b.isCoached ? 0 : a.isCoached ? 1 : -1,
    );
    violationList.forEach((p) => {
      const div = document.createElement("div");

      const initials = p.nama.substring(0, 2).toUpperCase();

      if (p.isCoached) {
        // TAMPILAN SUDAH DIBINA
        div.className = "relative flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden mb-1.5";
        div.innerHTML = `
          <!-- Pattern Overlay -->
          <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSJyZ2JhKDE1NiwgMTYzLCAxNzUsIDAuMikiIHN0cm9rZS13aWR0aD0iMSI+PHBhdGggZD0iTTAgNDBsNDAtNDAiLz48L2c+PC9zdmc+')] opacity-50 dark:opacity-20 pointer-events-none"></div>
          
          <div class="flex items-center gap-2.5 min-w-0 relative z-10 opacity-70 grayscale-[0.3]">
            <!-- Avatar Inisial -->
            <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 border border-slate-300 dark:border-slate-700 shrink-0">
              ${initials}
            </div>
            <!-- Detail Santri -->
            <div class="min-w-0">
              <h4 class="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-400 truncate pr-2 line-through decoration-slate-400/50">${p.nama}</h4>
              <p class="text-[8px] font-black uppercase text-slate-400 flex items-center gap-0.5 tracking-wider mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                Alpa ${p.slotLabel}
              </p>
            </div>
          </div>
          
          <!-- Label Status -->
          <div class="shrink-0 relative z-10">
            <span class="px-2 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-emerald-600 dark:text-emerald-500 text-[9px] font-black border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-1 cursor-default shadow-sm tracking-wide">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 text-emerald-500"><path d="M18 6 7 17l-5-5"></path><path d="m22 10-7.5 7.5L13 16"></path></svg>
              Selesai
            </span>
          </div>
        `;
      } else {
        // TAMPILAN BELUM DIBINA (Tombol Action Bina)
        const dataStr = JSON.stringify({
          id: p.nis || p.id,
          nama: p.nama,
          slotId: p.slotId,
          date: p.date,
          slotLabel: p.slotLabel,
        }).replace(/"/g, "&quot;");

        div.className = "flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-800/50 border border-red-100/50 dark:border-red-500/20 shadow-sm group hover:border-red-300 dark:hover:border-red-500/50 transition-colors mb-1.5";
        div.innerHTML = `
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Avatar Inisial -->
            <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-xs font-black text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 shrink-0">
              ${initials}
            </div>
            <!-- Detail Santri -->
            <div class="min-w-0">
              <h4 class="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-white truncate pr-2">${p.nama}</h4>
              <p class="text-[8px] font-black uppercase text-red-500 flex items-center gap-0.5 tracking-wider mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-2.5 h-2.5"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                Alpa ${p.slotLabel}
              </p>
            </div>
          </div>
          
          <!-- Tombol Aksi Bina -->
          <button onclick="window.openPembinaanModal(${dataStr})" class="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-500 text-white text-[9px] sm:text-[10px] font-bold hover:bg-emerald-600 shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3"><path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"></path></svg>
            Bina
          </button>
        `;
      }

      container.appendChild(div);
    });
  }

  const card = document.getElementById("dashboard-pembinaan-card");
  if (card) card.classList.remove("hidden");

  if (window.lucide) window.lucide.createIcons();
};

window.renderPembinaanManagement = function () {
  const container = document.getElementById("pembinaan-full-list");
  if (!container) return;

  // 1. Akumulasi Data Pelanggaran (HANYA YANG SUDAH DIBINA)
  let problemList = [];
  let counts = { l1: 0, l2: 0, l3: 0 };

  if (!appState.attendanceData) appState.attendanceData = {};

  FILTERED_SANTRI.forEach((s) => {
    const id = String(s.nis || s.id);

    let dates = [];
    Object.keys(appState.attendanceData).forEach((date) => {
      const dayData = appState.attendanceData[date];
      if (!dayData) return;

      let slots = [];

      Object.values(SLOT_WAKTU).forEach((slot) => {
        const sData = dayData[slot.id]?.[id];
        const st = sData?.status?.shalat;

        // --- LOGIKA POIN BARU ---
        // Hanya hitung poin JIKA Alpa DAN sudah ada data coaching (done: true)
        if (st === "Alpa" && sData.coaching && sData.coaching.done) {
          slots.push({
            label: slot.label,
            id: slot.id,
            action: sData.coaching.action, // Simpan info tindakan utk ditampilkan
          });
        }
      });

      if (slots.length > 0) {
        dates.push({ date: date, slots: slots });
      }
    });

    dates.sort((a, b) => b.date.localeCompare(a.date));

    // Hitung Total Poin (Total Slot yang sudah dibina)
    const totalAlpa = dates.reduce((acc, curr) => acc + curr.slots.length, 0);

    if (totalAlpa > 0) {
      const status = window.getPembinaanStatus(totalAlpa);
      problemList.push({ ...s, totalAlpa, status, dates });

      if (status.level === 1) counts.l1++;
      else if (status.level <= 3) counts.l2++;
      else counts.l3++;
    }
  });

  // Update Statistik Header
  const elC1 = document.getElementById("count-level-1");
  const elC2 = document.getElementById("count-level-2");
  const elC3 = document.getElementById("count-level-3");
  if (elC1) elC1.textContent = counts.l1;
  if (elC2) elC2.textContent = counts.l2;
  if (elC3) elC3.textContent = counts.l3;

  // 2. Render List
  container.innerHTML = "";
  if (problemList.length === 0) {
    container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-100 rounded-3xl">
                <div class="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <i data-lucide="shield-check" class="w-8 h-8 text-emerald-500"></i>
                </div>
                <p class="text-sm font-bold text-slate-600">Nihil Poin Pelanggaran</p>
                <p class="text-xs text-slate-400 text-center max-w-[200px]">
                    Santri tertib atau pelanggaran belum dibina oleh Musyrif.
                </p>
            </div>`;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  problemList.sort((a, b) => b.totalAlpa - a.totalAlpa);

  problemList.forEach((p) => {
    const percentage = Math.min((p.totalAlpa / 40) * 100, 100);
    const detailId = `detail-${p.nis || p.id}`;

    let detailHtml = "";
    p.dates.forEach((d) => {
      const dateDisplay = window.formatDate(d.date);

      // Render slot dengan info pembinaan
      const slotHtml = d.slots
        .map(
          (s) => `
                <div class="mt-1 flex items-start gap-2">
                    <span class="px-1.5 py-0.5 bg-red-50 text-red-600 text-[9px] font-bold rounded border border-red-100 uppercase shrink-0">${s.label}</span>
                    <span class="text-[10px] text-slate-500 italic">" ${s.action} "</span>
                </div>
            `,
        )
        .join("");

      detailHtml += `
                <div class="py-3 px-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <div class="flex items-center gap-2 mb-1">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-500"></i>
                        <span class="text-xs font-bold text-slate-700">${dateDisplay}</span>
                    </div>
                    <div class="ml-5">
                        ${slotHtml}
                    </div>
                </div>
            `;
    });

    const div = document.createElement("div");
    div.className =
      "mb-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300";
    div.innerHTML = `
            <div onclick="document.getElementById('${detailId}').classList.toggle('hidden')" class="p-5 cursor-pointer relative overflow-hidden group">
                <div class="relative flex justify-between items-start mb-3">
                    <div class="flex gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm font-black text-slate-500 dark:text-slate-300 shadow-inner">
                            ${p.nama.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 dark:text-white text-base">${p.nama}</h4>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${p.status.color}">
                                    ${p.status.label}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-3xl font-black text-slate-700 dark:text-white">${p.totalAlpa}</span>
                        <span class="text-[10px] text-slate-400 font-bold uppercase block -mt-1 tracking-wider">Poin</span>
                    </div>
                </div>
                
                <div class="relative w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div class="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 via-orange-400 to-red-500" style="width: ${percentage}%"></div>
                </div>
                
                <div class="flex justify-between items-center">
                    <p class="text-[10px] text-slate-400">Total Pelanggaran Tervalidasi</p>
                    <button class="text-[10px] font-bold text-slate-400 group-hover:text-emerald-500 flex items-center gap-1 transition-colors">
                        Riwayat Pembinaan <i data-lucide="chevron-down" class="w-3 h-3"></i>
                    </button>
                </div>
            </div>
            
            <div id="${detailId}" class="hidden bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-700 animate-slideDown">
                ${detailHtml}
            </div>
        `;
    container.appendChild(div);
  });

  if (window.lucide) window.lucide.createIcons();
};

// --- FUNGSI BARU UNTUK HAPUS PELANGGARAN LANGSUNG ---
window.deleteViolationRecord = function (studentId, dateKey) {
  if (
    !confirm(
      `Hapus status ALPA untuk santri ini pada tanggal ${window.formatDate(dateKey)}?\n\nStatus akan diubah menjadi 'Hadir'.`,
    )
  )
    return;

  const dayData = appState.attendanceData[dateKey];
  if (!dayData) return;

  let changed = false;

  // Loop semua slot di hari itu, jika Alpa ubah jadi Hadir
  Object.values(SLOT_WAKTU).forEach((slot) => {
    const studentSlot = dayData[slot.id]?.[studentId];
    const mainActId = slot.activities[0]?.id || "shalat"; // PERBAIKAN: Ambil ID dinamis

    if (studentSlot && studentSlot.status?.[mainActId] === "Alpa") {
      studentSlot.status[mainActId] = "Hadir"; // Ubah jadi Hadir

      // Reset juga status dependent jika ada
      slot.activities.forEach((act) => {
        if (act.category === "dependent") studentSlot.status[act.id] = "Ya";
        else if (act.category === "kbm") studentSlot.status[act.id] = "Hadir";
      });

      changed = true;
    }
  });

  if (changed) {
    window.saveData(); // Simpan ke LocalStorage/Cloud
    window.renderPembinaanManagement(); // Refresh halaman manajemen ini
    window.showToast(
      "Pelanggaran dihapus (Status diubah jadi Hadir)",
      "success",
    );

    // Jika sedang membuka tanggal yang sama di dashboard, refresh juga
    if (appState.date === dateKey) {
      window.updateDashboard();
    }
  } else {
    window.showToast("Data tidak ditemukan / sudah berubah", "error");
  }
};

// Fungsi Helper Baru: Loncat ke tanggal tertentu dan buka tab presensi
window.jumpToDate = function (dateStr) {
  if (
    confirm(
      `Buka data presensi tanggal ${window.formatDate(dateStr)} untuk mengedit/menghapus pelanggaran?`,
    )
  ) {
    appState.date = dateStr;
    window.updateDateDisplay();
    window.updateDashboard(); // Refresh dashboard data sesuai tanggal baru

    // Pindah ke tab Home dan scroll ke atas
    window.switchTab("home");
    window.scrollTo(0, 0);

    window.showToast(`Mode Edit: ${window.formatDate(dateStr)}`, "info");
  }
};

// Helper untuk Scroll ke section ini dari Dashboard
window.scrollToPembinaan = function () {
  setTimeout(() => {
    const el = document.getElementById("pembinaan-section");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, 100);
};

window.renderKBMBanner = function () {
  const banner = document.getElementById("kbm-active-banner");
  const titleEl = document.getElementById("kbm-banner-title");

  if (!banner) return;

  // 1. Ambil Data Slot & Waktu Saat Ini
  const currentSlotId = appState.currentSlotId;
  const slotData = SLOT_WAKTU[currentSlotId];

  // Cek hari ini hari apa (0=Ahad, 1=Senin, ...)
  // Gunakan tanggal dari appState jika ingin sinkron dengan tanggal yang dipilih,
  // atau new Date() jika ingin strict realtime. Disini kita pakai appState agar konsisten.
  const currentDay = new Date(appState.date).getDay();

  // 2. Cari Kegiatan KBM yang Aktif Hari Ini di Slot Ini
  // Syarat: category == 'kbm' DAN (showOnDays tidak ada ATAU hari ini termasuk)
  const activeKBM = slotData.activities.find(
    (act) =>
      act.category === "kbm" &&
      (!act.showOnDays || act.showOnDays.includes(currentDay)),
  );

  // 3. Tampilkan atau Sembunyikan Banner
  if (activeKBM) {
    // Ada KBM! Tampilkan Banner
    titleEl.textContent = activeKBM.label; // Misal: "Tahfizh" atau "Conversation"

    // Ganti Icon (Opsional: Jika ada icon khusus per kegiatan)
    // Default kita pakai book-open di HTML

    banner.classList.remove("hidden");
    banner.removeAttribute("hidden");
  } else {
    // Tidak ada KBM saat ini
    banner.classList.add("hidden");
    banner.setAttribute("hidden", "");
  }

  if (window.lucide) window.lucide.createIcons();
};

window.renderActivePermitsWidget = function () {
  const container = document.getElementById("dashboard-active-permits-list");
  const badgeCount = document.getElementById("active-permit-count");

  if (!container) return;
  container.innerHTML = "";

  const combinedList = [];
  const processedNis = new Set(); // Hanya mencatat NIS yang AKTIF sakitnya
  const currentDate = appState.date;

  // 1. DATA PERMIT (SURAT)
  const classNisList = FILTERED_SANTRI.map((s) => String(s.nis || s.id));

  // Filter permit yang relevan (Aktif ATAU selesai hari ini)
  const relevantPermits = appState.permits.filter((p) => {
    if (!classNisList.includes(p.nis)) return false;
    if (p.start_date > currentDate) return false; // Masa depan skip

    // Tampilkan jika belum ada end_date (aktif selamanya)
    // ATAU range tanggal mencakup hari ini
    if (!p.end_date) return true;
    if (currentDate >= p.start_date && currentDate <= p.end_date) return true;
    return false;
  });

  relevantPermits.forEach((p) => {
    let visualActive = p.is_active !== false;
    const catSafe = (p.category || "").toLowerCase();

    // Logika Visual Selesai (Abu-abu)
    if (catSafe === "sakit" && p.end_date) {
      // Jika hari ini > tanggal sembuh -> nonaktif
      if (currentDate > p.end_date) visualActive = false;
      // Jika hari ini == tanggal sembuh, cek sesi
      else if (currentDate === p.end_date && p.end_session) {
        // Jika sesi sekarang > sesi akhir sakit -> nonaktif
        if (
          SESSION_ORDER[appState.currentSlotId] > SESSION_ORDER[p.end_session]
        ) {
          visualActive = false;
        }
      }
    }
    // Logika Izin/Pulang Selesai
    else if (
      (catSafe === "izin" || catSafe === "pulang") &&
      p.end_date &&
      currentDate > p.end_date
    ) {
      visualActive = false;
    } else if (p.is_active === false) {
      visualActive = false; // Jika database bilang false, maka false
    }

    // Filter tambahan: Pastikan Permit juga hanya S/I/P (jaga-jaga jika ada kategori lain)
    if (["sakit", "izin", "pulang"].includes(catSafe)) {
      combinedList.push({
        type: "permit",
        id: p.id,
        nis: p.nis,
        category: p.category,
        startTime: p.start_date,
        endTime: p.end_date,
        isActive: visualActive,
        reason: p.reason,
      });

      // PENTING: Hanya block Manual Check jika permit ini MASIH AKTIF.
      if (visualActive) {
        processedNis.add(p.nis);
      }
    }
  });

  // 2. DATA MANUAL (PRESENSI HARIAN)
  const dayData = appState.attendanceData[currentDate];

  if (dayData) {
    FILTERED_SANTRI.forEach((s) => {
      const id = String(s.nis || s.id);
      // Skip jika sudah tercover permit AKTIF
      if (processedNis.has(id)) return;

      let foundStatus = null;
      // PERBAIKAN: Tambahkan 'sekolah' ke dalam daftar pemindaian widget izin manual
      const slots = ["isya", "maghrib", "ashar", "sekolah", "shubuh"];
      for (const slotId of slots) {
        const slotConfig = SLOT_WAKTU[slotId];
        if (!slotConfig) continue;
        const mainActId = slotConfig.activities[0]?.id || "shalat"; // Dinamis!

        const st = dayData[slotId]?.[id]?.status?.[mainActId];

        if (st && ["Sakit", "Izin", "Pulang"].includes(st)) {
          foundStatus = st;
          break;
        }
      }

      if (foundStatus) {
        let category = foundStatus.toLowerCase();

        combinedList.push({
          type: "manual", // Penanda ini data manual
          id: null,
          nis: id,
          category: category,
          startTime: currentDate,
          endTime: null,
          isActive: true, // Manual yang tampil pasti Aktif
          reason: "Presensi Manual",
        });
      }
    });
  }

  // Update Badge & Sorting
  if (badgeCount)
    badgeCount.textContent = combinedList.filter((i) => i.isActive).length;
  combinedList.sort((a, b) =>
    a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1,
  );

  // Render HTML
  if (combinedList.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-slate-400 text-[10px] font-bold">Semua santri lengkap / Hadir</div>`;
    return;
  }

  combinedList.forEach((item) => {
    const santri = FILTERED_SANTRI.find(
      (s) => String(s.nis || s.id) === item.nis,
    );
    if (!santri) return;

    let colorClass, textLabelColorClass, iconSVG, displayCategory;
    const cat = item.category.toLowerCase();
    displayCategory = item.category;

    if (cat === "sakit") {
      colorClass = "bg-amber-50 text-amber-500 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20";
      textLabelColorClass = "text-amber-600 dark:text-amber-400";
      iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/><path d="M12 7v4"/></svg>`;
    } else if (cat === "izin") {
      colorClass = "bg-blue-50 text-blue-500 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20";
      textLabelColorClass = "text-blue-600 dark:text-blue-400";
      iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`;
    } else if (cat === "pulang") {
      colorClass = "bg-purple-50 text-purple-500 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20";
      textLabelColorClass = "text-purple-600 dark:text-purple-400";
      iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"></path><path d="M15 6v6"></path><path d="M2 12h19.6"></path><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"></path><circle cx="7" cy="18" r="2"></circle><path d="M9 18h5"></path><circle cx="16" cy="18" r="2"></circle></svg>`;
    } else {
      colorClass = "bg-rose-50 text-rose-500 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20";
      textLabelColorClass = "text-rose-600 dark:text-rose-400";
      iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;
    }

    if (!item.isActive) {
      if (cat === "sakit") {
        displayCategory = "Sembuh";
      } else {
        displayCategory = "Kembali";
      }
      colorClass = "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20";
      textLabelColorClass = "text-emerald-600 dark:text-emerald-400";
    }

    let btnHTML = "";
    if (item.isActive) {
      let label = "Sembuh";
      let action = "";

      // Logic Action
      if (item.type === "manual") {
        action = `window.resolveManualStatus('${item.nis}', '${cat.charAt(0).toUpperCase() + cat.slice(1)}')`;
        label = "Hadirkan";
      } else {
        if (cat === "sakit") {
          action = `window.markAsRecovered('${item.id}')`;
        } else {
          label = "Kembali";
          action = `window.markAsReturned('${item.id}')`;
        }
      }

      btnHTML = `
        <button onclick="${action}" class="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20 text-[9px] font-bold hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white hover:border-emerald-500 transition-all flex items-center gap-1 active:scale-95">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
          ${label}
        </button>
      `;
    } else {
      btnHTML = `
        <button disabled class="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-[9px] font-bold cursor-not-allowed flex items-center gap-1">
          Selesai
        </button>
      `;
    }

    const div = document.createElement("div");
    div.className = `flex items-center justify-between p-2 rounded-xl border transition-colors ${
      item.isActive 
        ? "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700/50 shadow-sm group hover:border-slate-300 dark:hover:border-slate-600" 
        : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800 opacity-60 grayscale"
    }`;
    div.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0">
        <!-- Ikon Status -->
        <div class="w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center shrink-0">
          ${iconSVG}
        </div>
        <!-- Info Santri -->
        <div class="min-w-0">
          <h4 class="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-2">${santri.nama}</h4>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-[8px] font-black uppercase ${textLabelColorClass} tracking-wider">${displayCategory}</span>
            <span class="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            <span class="text-[8px] font-semibold text-slate-400">${item.type === "manual" ? "Manual" : window.formatDate(item.startTime)}</span>
          </div>
        </div>
      </div>
      ${btnHTML}
    `;
    container.appendChild(div);
  });
  if (window.lucide) window.lucide.createIcons();
};

window.resolveManualStatus = function (nis, statusType) {
  const dateKey = appState.date;
  const dayData = appState.attendanceData[dateKey];
  if (!dayData) return;

  let changed = false;

  Object.keys(dayData).forEach((slotId) => {
    const studentData = dayData[slotId][nis];
    const slotConfig = SLOT_WAKTU[slotId];
    if (!slotConfig) return;

    // PERBAIKAN: Gunakan mainActId agar slot Sekolah juga bisa "Dihadirkan"
    const mainActId = slotConfig.activities[0]?.id || "shalat";

    if (
      studentData &&
      studentData.status &&
      studentData.status[mainActId] === statusType
    ) {
      studentData.status[mainActId] = "Hadir";

      if (slotConfig.activities) {
        slotConfig.activities.forEach((act) => {
          if (act.category === "dependent") studentData.status[act.id] = "Ya";
          else if (act.category === "kbm" || act.category === "fardu")
            studentData.status[act.id] = "Hadir";
        });
      }

      if (studentData.note) {
        studentData.note = studentData.note.replace(/\[Auto\].*$/g, "").trim();
      }
      changed = true;
    }
  });

  if (changed) {
    window.saveData();
    window.renderActivePermitsWidget();
    window.renderAttendanceList();
    window.showToast("Status berhasil diubah menjadi Hadir", "success");
  } else {
    window.showToast("Tidak ada data yang perlu diubah", "info");
  }
};

// ==========================================
// MANAJEMEN RIWAYAT PERIZINAN (PROFIL)
// ==========================================

window.renderPermitHistory = function () {
  const container = document.getElementById("permit-history-list");
  if (!container) return;
  container.innerHTML = "";

  // --- Baca nilai search & filter dari HTML ---
  const searchVal = (document.getElementById("hist-search")?.value || "")
    .toLowerCase()
    .trim();
  const filterCat = document.getElementById("hist-filter-cat")?.value || "all";

  let history = [...appState.permits].map((p) => ({ ...p, source: "permit" }));
  const classNisList = FILTERED_SANTRI.map((s) => String(s.nis || s.id));

  // Buat Set untuk pengecekan cepat apakah entri manual sudah ter-cover surat izin
  const permitLookup = new Set();
  appState.permits.forEach((p) => {
    if (p.start_date && p.end_date) {
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = `${p.nis}_${window.getLocalDateStr(d)}_${p.category}`;
        permitLookup.add(key);
      }
    }
  });

  // Scan entri manual dari data presensi harian
  Object.keys(appState.attendanceData).forEach((date) => {
    const daySlots = appState.attendanceData[date];

    classNisList.forEach((nis) => {
      let foundSt = null;
      ["isya", "maghrib", "ashar", "shubuh"].forEach((slot) => {
        const st = daySlots[slot]?.[nis]?.status?.shalat;
        if (st && ["Sakit", "Izin", "Pulang"].includes(st)) foundSt = st;
      });

      const key = `${nis}_${date}_${foundSt?.toLowerCase()}`;
      if (foundSt && !permitLookup.has(key)) {
        history.push({
          id: `manual_${date}_${nis}`,
          nis: nis,
          category: foundSt.toLowerCase(),
          reason: "Input Manual (Tanpa Surat)",
          start_date: date,
          end_date: date,
          is_active: false,
          source: "manual",
          timestamp: date,
        });
      }
    });
  });

  // Urutkan terbaru dulu
  history.sort(
    (a, b) =>
      new Date(b.timestamp || b.start_date) -
      new Date(a.timestamp || a.start_date),
  );

  // Filter: hanya entri milik kelas ini
  history = history.filter((p) => classNisList.includes(String(p.nis)));

  // Filter: berdasarkan kategori dropdown
  if (filterCat !== "all") {
    history = history.filter((p) => p.category === filterCat);
  }

  // Filter: berdasarkan search nama santri
  if (searchVal) {
    history = history.filter((p) => {
      const santri = FILTERED_SANTRI.find(
        (s) => String(s.nis || s.id) === String(p.nis),
      );
      return santri && santri.nama.toLowerCase().includes(searchVal);
    });
  }

  if (history.length === 0) {
    container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                <i data-lucide="folder-open" class="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600 stroke-1"></i>
                <p class="text-xs font-bold text-slate-400 dark:text-slate-500">
                    ${searchVal || filterCat !== "all" ? "Tidak ada hasil yang cocok" : "Belum ada riwayat perizinan"}
                </p>
            </div>`;
    window.refreshIcons();
    return;
  }

  const fragment = document.createDocumentFragment();

  history.forEach((p) => {
    const santri = FILTERED_SANTRI.find(
      (s) => String(s.nis || s.id) === String(p.nis),
    );
    if (!santri) return;

    // --- Tema warna per kategori ---
    const catMap = {
      sakit: {
        icon: window.getStatusMeta("Sakit").icon,
        iconBg:
          "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
        border: "border-amber-200 dark:border-amber-800",
        catLabel:
          "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
      },
      izin: {
        icon: window.getStatusMeta("Izin").icon,
        iconBg:
          "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-800",
        catLabel:
          "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
      },
      pulang: {
        icon: window.getStatusMeta("Pulang").icon,
        iconBg:
          "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
        border: "border-purple-200 dark:border-purple-800",
        catLabel:
          "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
      },
    };
    const theme = catMap[p.category] || {
      icon: "file-text",
      iconBg: "bg-slate-100 dark:bg-slate-700 text-slate-500",
      border: "border-slate-200 dark:border-slate-700",
      catLabel: "bg-slate-100 text-slate-500 border-slate-200",
    };

    // --- Badge status ---
    let statusBadge = "";
    if (p.source === "manual") {
      statusBadge = `<span class="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-black border border-slate-200 dark:border-slate-600 uppercase tracking-wider">MANUAL</span>`;
    } else {
      let isActive = p.is_active !== false;
      const cat = (p.category || "").toLowerCase();
      if (cat === "sakit" && p.end_date) isActive = false;
      if (
        (cat === "izin" || cat === "pulang") &&
        p.end_date &&
        p.end_date < window.getLocalDateStr()
      )
        isActive = false;

      statusBadge = isActive
        ? `<span class="shrink-0 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-black border border-emerald-200 dark:border-emerald-700 uppercase tracking-wider">AKTIF</span>`
        : `<span class="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-black border border-slate-200 dark:border-slate-600 uppercase tracking-wider">SELESAI</span>`;
    }

    // --- Tombol aksi (horizontal, di pojok kanan atas) ---
    let actionButtons = "";
    if (p.source === "permit") {
      actionButtons = `
                <div class="flex gap-1.5 shrink-0 self-start">
                    <button onclick="window.openEditHistory('${p.id}')"
                        class="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800 transition-colors"
                        title="Edit" aria-label="Edit izin ${window.sanitizeHTML(santri.nama)}">
                        <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="window.deleteHistoryPermit('${p.id}')"
                        class="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800 transition-colors"
                        title="Hapus" aria-label="Hapus izin ${window.sanitizeHTML(santri.nama)}">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>`;
    } else {
      actionButtons = `
                <div class="shrink-0 self-start">
                    <div class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-700/50 text-slate-300 dark:text-slate-600 border border-slate-100 dark:border-slate-700 cursor-not-allowed" title="Manual — tidak bisa diedit">
                        <i data-lucide="lock" class="w-3.5 h-3.5"></i>
                    </div>
                </div>`;
    }

    // --- Tampilan rentang tanggal ---
    const dateDisplay =
      p.end_date && p.end_date !== p.start_date
        ? `${window.formatDate(p.start_date)} — ${window.formatDate(p.end_date)}`
        : window.formatDate(p.start_date);

    const div = document.createElement("div");
    div.className = `rounded-2xl bg-white dark:bg-slate-800 border ${theme.border} shadow-sm hover:shadow-md transition-shadow`;
    div.innerHTML = `
            <div class="p-3.5 flex items-start gap-3">

                <!-- Ikon kategori -->
                <div class="w-9 h-9 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0 mt-0.5">
                    <i data-lucide="${theme.icon}" class="w-4 h-4"></i>
                </div>

                <!-- Konten utama -->
                <div class="flex-1 min-w-0">

                    <!-- Baris: nama + status badge + tombol aksi -->
                    <div class="flex items-start gap-2">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${theme.catLabel}">${window.sanitizeHTML(p.category)}</span>
                                ${statusBadge}
                            </div>
                            <p class="font-bold text-slate-800 dark:text-white text-sm mt-0.5 truncate">${window.sanitizeHTML(santri.nama)}</p>
                        </div>
                        ${actionButtons}
                    </div>

                    <!-- Tanggal -->
                    <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1 font-medium">
                        <i data-lucide="calendar-days" class="w-3 h-3 shrink-0"></i>
                        <span class="truncate">${dateDisplay}</span>
                    </p>

                    <!-- Alasan -->
                    <p class="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-2 leading-relaxed line-clamp-2 bg-slate-50 dark:bg-slate-700/40 rounded-lg px-2.5 py-1.5 border border-slate-100 dark:border-slate-700">
                        "${window.sanitizeHTML(p.reason || "-")}"
                    </p>

                </div>
            </div>
        `;
    fragment.appendChild(div);
  });

  container.appendChild(fragment);
  window.refreshIcons();
};

// 1. Fungsi Hapus (Khusus History)
window.deleteHistoryPermit = function (id) {
  if (
    !confirm(
      "⚠️ PERINGATAN HAPUS\n\nApakah Anda yakin ingin menghapus data izin ini secara permanen? Data yang dihapus tidak bisa dikembalikan.",
    )
  )
    return;

  // Filter array untuk membuang ID yang cocok
  appState.permits = appState.permits.filter((p) => p.id !== id);

  // Simpan perubahan ke LocalStorage
  localStorage.setItem(APP_CONFIG.permitKey, JSON.stringify(appState.permits));

  // Refresh UI
  window.renderPermitHistory(); // Refresh list profil
  window.renderActivePermitsWidget(); // Refresh widget dashboard (jika yang dihapus hari ini)
  window.renderAttendanceList(); // Refresh list absen (mungkin statusnya berubah jadi Hadir)

  window.showToast("Data izin berhasil dihapus", "success");
};

// 2. Fungsi Toggle Status (Aktif <-> Selesai)
window.togglePermitStatus = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (!permit) return;

  permit.is_active = permit.is_active === false;

  // Jika diaktifkan kembali, pastikan end_date dihapus jika itu permit Sakit (agar logic sembuh tidak bentrok)
  // Atau biarkan apa adanya jika itu izin berjangka.
  // Kita reset end_date hanya jika user mengaktifkan kembali permit Sakit yg sudah sembuh.
  if (permit.is_active && permit.category === "sakit" && permit.end_date) {
    if (
      confirm("Hapus tanggal kesembuhan agar santri kembali berstatus Sakit?")
    ) {
      permit.end_date = null;
    }
  }

  localStorage.setItem(APP_CONFIG.permitKey, JSON.stringify(appState.permits));

  window.renderPermitHistory();
  window.renderActivePermitsWidget();
  window.renderAttendanceList();
  window.showToast(
    `Status izin: ${permit.is_active ? "AKTIF" : "SELESAI"}`,
    "info",
  );
};

// 3. Fungsi Edit (Buka Modal)
window.openEditHistory = function (id) {
  const permit = appState.permits.find((p) => p.id === id);
  if (!permit) return window.showToast("Data tidak ditemukan", "error");

  // Isi Form Modal dengan Data Lama
  document.getElementById("edit-permit-id").value = permit.id;
  document.getElementById("edit-permit-reason").value = permit.reason || "";
  document.getElementById("edit-permit-start").value = permit.start_date || "";
  document.getElementById("edit-permit-end").value = permit.end_date || "";
  document.getElementById("edit-permit-active").checked = permit.is_active !== false;

  // Buka Modal
  const modal = document.getElementById("modal-edit-permit");
  modal.classList.remove("hidden");
};

// 4. Fungsi Simpan Edit
window.savePermitEdit = function () {
  const id = document.getElementById("edit-permit-id").value;
  const reason = document.getElementById("edit-permit-reason").value;
  const start = document.getElementById("edit-permit-start").value;
  const end = document.getElementById("edit-permit-end").value;
  const isActive = document.getElementById("edit-permit-active").checked;

  if (!reason || !start)
    return window.showToast("Alasan dan Tanggal Mulai wajib diisi", "warning");

  // Cari index data di array
  const index = appState.permits.findIndex((p) => p.id === id);
  if (index === -1) return;

  // Update Data
  appState.permits[index].reason = reason;
  appState.permits[index].start_date = start;

  // Logic End Date: Jika kosong string, jadikan null (Sakit belum sembuh)
  appState.permits[index].end_date = end ? end : null;

  appState.permits[index].is_active = isActive;

  // Simpan ke Storage
  localStorage.setItem(APP_CONFIG.permitKey, JSON.stringify(appState.permits));

  // Tutup Modal & Refresh
  window.closeModal("modal-edit-permit");
  window.showToast("Perubahan berhasil disimpan", "success");

  // Refresh Semua UI Terkait
  window.renderPermitHistory();
  window.renderActivePermitsWidget();
  window.renderAttendanceList();
};

// --- FITUR PEMBINAAN (Baru) ---

window.openPembinaanModal = function (data) {
  const modal = document.getElementById("modal-input-pembinaan");
  if (!modal) return;

  // Isi Data UI
  document.getElementById("bina-nama").textContent = data.nama;
  document.getElementById("bina-avatar").textContent = data.nama
    .substring(0, 2)
    .toUpperCase();
  document.getElementById("bina-detail").textContent =
    `${data.slotLabel} • ${window.formatDate(data.date)}`;

  // Set Default Input
  document.getElementById("bina-date").value = window.getLocalDateStr();
  document.getElementById("bina-action").value = "";

  // Simpan target data di hidden input
  document.getElementById("bina-target-data").value = JSON.stringify(data);

  modal.classList.remove("hidden");
};

window.savePembinaan = function () {
  const rawData = document.getElementById("bina-target-data").value;
  if (!rawData) return;

  try {
    const target = JSON.parse(rawData);
    const dateBina = document.getElementById("bina-date").value;
    const actionBina = document.getElementById("bina-action").value;

    if (!dateBina || !actionBina) {
      return window.showToast(
        "Tanggal dan Bentuk Pembinaan wajib diisi!",
        "warning",
      );
    }

    // Validate date
    if (dateBina > window.getLocalDateStr()) {
      return window.showToast(
        "Tanggal pembinaan tidak boleh di masa depan",
        "warning",
      );
    }

    const dayData = appState.attendanceData[target.date];
    if (
      dayData &&
      dayData[target.slotId] &&
      dayData[target.slotId][target.id]
    ) {
      const studentData = dayData[target.slotId][target.id];

      studentData.coaching = {
        done: true,
        date: dateBina,
        action: window.sanitizeHTML(actionBina),
        musyrif: appState.userProfile ? appState.userProfile.email : "Admin",
        timestamp: new Date().toISOString(),
      };

      window.saveData();

      // Refresh UI safely
      if (typeof window.renderDashboardPembinaan === "function") {
        window.renderDashboardPembinaan();
      }
      if (typeof window.renderPembinaanManagement === "function") {
        window.renderPembinaanManagement();
      }

      window.showToast(
        "Pembinaan berhasil dicatat. Poin ditambahkan.",
        "success",
      );
      window.closeModal("modal-input-pembinaan");
    } else {
      window.showToast(
        "Data presensi tidak ditemukan (mungkin terhapus)",
        "error",
      );
    }
  } catch (e) {
    console.error("Pembinaan save error:", e);
    window.showToast("Gagal menyimpan: " + e.message, "error");
  }
};

window.renderSchoolStatsWidget = function () {
  const widget = document.getElementById("school-stats-widget");
  if (!widget) return;

  // SINKRONISASI: Jika hari ini sekolah libur (Ahad), hilangkan sekalian widgetnya!
  if (window.isSlotHoliday("sekolah", appState.date)) {
    widget.classList.add("hidden");
    return;
  } else {
    widget.classList.remove("hidden");
  }

  const stats = window.calculateSlotStats("sekolah", appState.date);
  const totalSiswa = FILTERED_SANTRI ? FILTERED_SANTRI.length : 0;

  // Hitung Persentase Kehadiran = (Hadir / Total Siswa) * 100
  // Mencegah pembagian dengan 0 yang menghasilkan NaN%
  let presentPercent = 0;
  if (totalSiswa > 0) {
    presentPercent = Math.round((stats.h / totalSiswa) * 100);
    if (presentPercent > 100) presentPercent = 100; // Proteksi maksimal 100%
  }

  const fillEl = document.getElementById("school-progress-bar");
  const textEl = document.getElementById("school-pct-badge");

  if (fillEl) fillEl.style.width = `${presentPercent}%`;
  if (textEl) textEl.textContent = `${presentPercent}%`;

  // Update angka-angka rekap
  const hEl = document.getElementById("sch-stat-h");
  const sEl = document.getElementById("sch-stat-s");
  const iEl = document.getElementById("sch-stat-i");
  const aEl = document.getElementById("sch-stat-a");

  if (hEl) hEl.textContent = stats.h;
  if (sEl) sEl.textContent = stats.s;
  if (iEl) iEl.textContent = stats.i;
  if (aEl) aEl.textContent = stats.a;
  const absentListEl = document.getElementById("school-absent-list");
  if (absentListEl) {
    const absentStudents = FILTERED_SANTRI.filter((s) => {
      const status = window.getAttendanceStatus(
        s.nis || s.id,
        "sekolah",
        appState.date,
      );
      return ["Sakit", "Izin", "Pulang", "Alpa"].includes(status);
    });

    if (absentStudents.length === 0) {
      absentListEl.innerHTML = `
                <div class="text-center text-xs text-slate-400 py-2">
                    Semua santri hadir
                </div>
            `;
    } else {
      absentListEl.innerHTML = absentStudents
        .map((s) => {
          const status = window.getAttendanceStatus(
            s.nis || s.id,
            "sekolah",
            appState.date,
          );

          return `
                        <div class="flex justify-between items-center px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700">
                            <span class="text-xs font-medium">
                                ${s.nama}
                            </span>
                            <span class="text-xs font-bold text-red-500">
                                ${status}
                            </span>
                        </div>
                    `;
        })
        .join("");
    }
  }
};

window.openModal = function (modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const baseZIndex = 1000;
  const zIndex = baseZIndex + modalStack.length * 10;

  modal.style.zIndex = zIndex;
  modal.classList.remove("hidden");
  modalStack.push(modalId);

  const escHandler = (e) => {
    if (e.key === "Escape") {
      window.closeModal(modalId);
    }
  };

  document.addEventListener("keydown", escHandler);
  modal._escHandler = escHandler;
  modal.setAttribute("aria-modal", "true"); // Accessibility
  modal.setAttribute("role", "dialog"); // Accessibility
};

window.toggleSchoolAbsentList = function () {
  const list = document.getElementById("school-absent-list");

  const icon = document.getElementById("school-absent-icon");

  const hidden = list.classList.toggle("hidden");

  if (icon) {
    icon.style.transform = hidden ? "rotate(0deg)" : "rotate(180deg)";
  }
};

window.isDateAccessible = function (dateStr) {
  return Object.values(SLOT_WAKTU).some((slot) =>
    window.isSlotAccessible(slot.id, dateStr),
  );
};

window.getDayCompletionStatus = function (dateStr) {
  let requiredSlots = 0;
  let completedSlots = 0;

  Object.values(SLOT_WAKTU).forEach((slot) => {
    if (window.isSlotHoliday(slot.id, dateStr)) {
      return;
    }

    requiredSlots++;

    const completion = window.getSlotCompletionStatus(slot.id, dateStr);

    if (completion.complete) {
      completedSlots++;
    }
  });

  return {
    requiredSlots,
    completedSlots,
    complete: requiredSlots > 0 && completedSlots >= requiredSlots,
  };
};

window.getTimesheetStreakInfo = function (year, month, totalDays) {
  const today = window.getLocalDateStr();
  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - 45);
  const end = new Date(year, month, totalDays);
  const dayMs = 86400000;
  const days = {};
  let running = 0;
  let currentMonthBest = 0;
  let currentMonthStreakDays = 0;
  let activeStreak = 0;
  let lastCompletedStreak = 0;

  for (let time = start.getTime(); time <= end.getTime(); time += dayMs) {
    const date = new Date(time);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const info = window.getDayCompletionStatus(dateStr);
    const isEligible = dateStr <= today && info.complete && Object.values(SLOT_WAKTU).every((slot) => {
      if (window.isSlotHoliday(slot.id, dateStr)) return true;
      return window.isSlotCompletedOnSameDay(slot.id, dateStr);
    });

    running = isEligible ? running + 1 : 0;
    days[dateStr] = running;
    if (isEligible) lastCompletedStreak = running;
    if (dateStr === today) activeStreak = isEligible ? running : lastCompletedStreak;

    if (date.getFullYear() === year && date.getMonth() === month && running >= 3) {
      currentMonthStreakDays++;
      currentMonthBest = Math.max(currentMonthBest, running);
    }
  }

  return {
    days,
    activeStreak,
    currentMonthBest,
    currentMonthStreakDays,
  };
};

window.verifyLocationCached = async function () {
  if (window.gpsBypassEnabled) return true;
  const cache = JSON.parse(localStorage.getItem(GPS_CACHE_KEY) || "null");

  if (
    cache &&
    cache.distance !== undefined &&
    Date.now() - cache.timestamp < GPS_CACHE_DURATION
  ) {
    if (
      cache.isInside === true &&
      Number(cache.distance) <= GEO_CONFIG.maxRadiusMeters
    ) {
      return true;
    }
    localStorage.removeItem(GPS_CACHE_KEY);
  }

  await window.verifyLocation();
  return true;
};

window.switchReportView = function (view) {
  const report = document.getElementById("report-section");
  const analysis = document.getElementById("analysis-section");
  const btnReport = document.getElementById("report-view-btn");
  const btnAnalysis = document.getElementById("analysis-view-btn");
  const activeClass =
    "px-3 sm:px-4 py-2 flex items-center justify-center gap-2 rounded-full bg-palette-blue text-white text-xs font-black shadow-sm shadow-blue-500/20 transition-all duration-300 active:scale-[0.98]";
  const inactiveClass =
    "px-3 sm:px-4 py-2 flex items-center justify-center gap-2 rounded-full text-xs font-black text-slate-500 hover:text-palette-blue dark:hover:text-white transition-all duration-300 active:scale-[0.98]";

  if (view === "report") {
    report.classList.remove("hidden");
    analysis.classList.add("hidden");
    if (btnReport) btnReport.className = activeClass;
    if (btnAnalysis) btnAnalysis.className = inactiveClass;
  } else {
    report.classList.add("hidden");
    analysis.classList.remove("hidden");
    if (btnAnalysis) btnAnalysis.className = activeClass;
    if (btnReport) btnReport.className = inactiveClass;

    window.populateAnalysisDropdown();
    window.runAnalysis();
  }
};

window.parseSalatTimeToMinutes = function (timeStr) {
  const match = String(timeStr || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

window.getNextSalatTarget = function (salatMap, now = new Date()) {
  const order = ["Subuh", "Syuruq", "Dzuhur", "Ashar", "Maghrib", "Isya"];
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  let next = null;

  order.forEach((name) => {
    const minutes = window.parseSalatTimeToMinutes(salatMap?.[name]);
    if (minutes === null) return;
    let diffMinutes = minutes - currentMinutes;
    if (diffMinutes <= 0) diffMinutes += 24 * 60;
    if (!next || diffMinutes < next.diffMinutes) {
      const target = new Date(now);
      target.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
      next = { name, target, diffMinutes };
    }
  });

  return next;
};

window.initSalatHijriWidget = async function () {
  const hijriEl = document.getElementById("widget-hijri-date");
  if (!hijriEl) return;

  const todayStr = (window.appState && window.appState.date) || (window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().split("T")[0]);

  const masehiEl = document.getElementById("widget-masehi-date");
  if (masehiEl) {
    const targetDate = new Date(todayStr);
    const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
    masehiEl.textContent = targetDate.toLocaleDateString('id-ID', options);
  }

  // Set tanggal masehi lokal segera di widget GPS
  const gpsGregorianEl = document.getElementById("gps-gregorian-date");
  if (gpsGregorianEl) {
    const targetDate = new Date(todayStr);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    gpsGregorianEl.textContent = targetDate.toLocaleDateString('id-ID', options);
  }

  const defaultPrayerLocation = window.APP_LOCATION?.defaultPrayerLocation || {
    label: "Wirobrajan, Yogyakarta",
    lat: -7.807757,
    lng: 110.350915,
  };
  let lat = defaultPrayerLocation.lat;
  let lng = defaultPrayerLocation.lng;
  let locationLabel = defaultPrayerLocation.label;

  // Coba dapatkan lokasi asli pengguna
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
    });
    lat = position.coords.latitude;
    lng = position.coords.longitude;
    
    // Reverse geocode to get human-readable location
    try {
      const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`, {
        headers: { "Accept-Language": "id" }
      });
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (geoData && geoData.address) {
          const addr = geoData.address;
          const suburb = addr.suburb || addr.village || addr.neighbourhood || addr.subdistrict || "";
          const city = addr.city || addr.regency || addr.municipality || addr.town || "";
          if (suburb && city) {
            locationLabel = `${suburb}, ${city}`;
          } else if (city) {
            locationLabel = city;
          } else if (geoData.display_name) {
            locationLabel = geoData.display_name.split(",")[0] || "Lokasi Anda";
          }
        }
      }
    } catch (geoErr) {
      console.warn("Gagal reverse geocode:", geoErr);
      locationLabel = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  } catch (locErr) {
    console.warn("Menggunakan lokasi default:", locErr.message);
  }

  // Update subtitle
  const subtitleEl = document.getElementById("salat-location-subtitle");
  if (subtitleEl) {
    subtitleEl.textContent = locationLabel;
  }

  // Format tanggal ke DD-MM-YYYY untuk Aladhan API
  const [year, month, day] = todayStr.split("-");
  const formattedDate = `${day}-${month}-${year}`;

  const apiUrl = `https://api.aladhan.com/v1/timings/${formattedDate}?latitude=${lat}&longitude=${lng}&method=5&tune=0,8,0,0,0,0,0,0,0`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error("Gagal mengambil data dari API");
    
    const resData = await response.json();
    const data = resData.data;

    // 1. Tampilkan Hijri Date
    const hijri = data.date.hijri;
    const monthTranslation = {
      1: "Muharram", 2: "Safar", 3: "Rabiul Awal", 4: "Rabiul Akhir",
      5: "Jumadil Awal", 6: "Jumadil Akhir", 7: "Rajab", 8: "Sya'ban",
      9: "Ramadhan", 10: "Syawal", 11: "Dzulqa'dah", 12: "Dzulhijjah"
    };
    const indonesianMonth = monthTranslation[hijri.month.number] || hijri.month.en;
    const hijriDateDisplay = `${hijri.day} ${indonesianMonth} ${hijri.year} H`;
    hijriEl.textContent = hijriDateDisplay;

    const gpsHijriEl = document.getElementById("gps-hijri-date");
    if (gpsHijriEl) {
      gpsHijriEl.textContent = hijriDateDisplay;
    }

    // 2. Isi data jadwal salat
    const timings = data.timings;
    const salatMap = {
      Subuh: timings.Fajr,
      Syuruq: timings.Sunrise,
      Dzuhur: timings.Dhuhr,
      Ashar: timings.Asr,
      Maghrib: timings.Maghrib,
      Isya: timings.Isha
    };

    // Update UI dan highlight yang aktif
    const now = new Date();
    const nextSalatTarget = window.getNextSalatTarget(salatMap, now);
    let nextSalat = nextSalatTarget?.name || "Subuh";

    Object.keys(salatMap).forEach((name) => {
      const timeStr = salatMap[name];
      const el = document.getElementById(`prayer-${name}`);
      if (el) {
        el.querySelector(".prayer-time").textContent = timeStr;
      }
    });

    // Berikan ring highlight pada jadwal salat berikutnya
    Object.keys(salatMap).forEach((name) => {
      const el = document.getElementById(`prayer-${name}`);
      if (el) {
        const patternOverlay = el.querySelector(".pattern-overlay");
        const svgEl = el.querySelector("svg");
        const nameLabel = el.querySelector("span:not(.prayer-time)");
        const timeEl = el.querySelector(".prayer-time");

        if (name === nextSalat) {
          // Active state classes for card
          el.classList.remove(
            "bg-slate-50", "dark:bg-slate-900/40", "border-slate-100", "dark:border-slate-800/40",
            "hover:bg-slate-100", "dark:hover:bg-slate-900/60", "hover:shadow-sm", "hover:-translate-y-1"
          );
          el.classList.add(
            "bg-gradient-to-b", "from-emerald-500", "to-emerald-600", "dark:from-emerald-600", "dark:to-emerald-800",
            "border-none", "shadow-lg", "shadow-emerald-500/30", "z-10"
          );
          
          if (patternOverlay) patternOverlay.classList.remove("hidden");
          
          if (svgEl) {
            svgEl.classList.remove("text-slate-400", "group-hover/card:text-emerald-500");
            svgEl.classList.add("text-white", "relative", "z-10");
          }
          
          if (nameLabel) {
            nameLabel.classList.remove("text-slate-500", "dark:text-slate-400");
            nameLabel.classList.add("text-emerald-50", "dark:text-emerald-100", "relative", "z-10");
          }
          
          if (timeEl) {
            timeEl.classList.remove("text-[10px]", "text-slate-800", "dark:text-slate-100");
            timeEl.classList.add("text-xs", "text-white", "relative", "z-10");
          }
        } else {
          // Inactive state classes for card
          el.classList.remove(
            "bg-gradient-to-b", "from-emerald-500", "to-emerald-600", "dark:from-emerald-600", "dark:to-emerald-800",
            "border-none", "shadow-lg", "shadow-emerald-500/30", "z-10"
          );
          el.classList.add(
            "bg-slate-50", "dark:bg-slate-900/40", "border-slate-100", "dark:border-slate-800/40",
            "hover:bg-slate-100", "dark:hover:bg-slate-900/60", "hover:shadow-sm", "hover:-translate-y-1"
          );
          
          if (patternOverlay) patternOverlay.classList.add("hidden");
          
          if (svgEl) {
            svgEl.classList.remove("text-white", "relative", "z-10");
            svgEl.classList.add("text-slate-400", "group-hover/card:text-emerald-500");
          }
          
          if (nameLabel) {
            nameLabel.classList.remove("text-emerald-50", "dark:text-emerald-100", "relative", "z-10");
            nameLabel.classList.add("text-slate-500", "dark:text-slate-400");
          }
          
          if (timeEl) {
            timeEl.classList.remove("text-xs", "text-white", "relative", "z-10");
            timeEl.classList.add("text-[10px]", "text-slate-800", "dark:text-slate-100");
          }
        }
      }
    });

    // Sunnah Fasting Reminder Banner
    const fastingReminderEl = document.getElementById("widget-fasting-reminder");
    if (fastingReminderEl) {
      const dayOfWeek = now.getDay(); // Sunday=0, Monday=1, ..., Saturday=6
      const hijriDay = parseInt(hijri.day, 10);
      let reminderText = "";

      if (dayOfWeek === 0) {
        reminderText = "✨ Pengingat: Besok hari Senin, Sunnah Puasa Senin.";
      } else if (dayOfWeek === 3) {
        reminderText = "✨ Pengingat: Besok hari Kamis, Sunnah Puasa Kamis.";
      } else if (hijriDay === 12 || hijriDay === 13 || hijriDay === 14) {
        reminderText = `✨ Pengingat: Besok tanggal ${hijriDay + 1} Hijriah, Sunnah Puasa Ayyamul Bidh.`;
      } else if (hijri.month.number === 9) {
        reminderText = "🌙 Marhaban ya Ramadhan, Selamat menunaikan Ibadah Puasa Wajib.";
      }

      if (reminderText) {
        fastingReminderEl.innerHTML = `<span class="flex items-center gap-1.5 leading-tight">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          ${reminderText}
        </span>`;
        fastingReminderEl.classList.remove("hidden");
        fastingReminderEl.classList.add("flex");
      } else {
        fastingReminderEl.classList.add("hidden");
        fastingReminderEl.classList.remove("flex");
      }
    }

    window.todaySalatTimings = salatMap; // Simpan untuk countdown

    // Mulai hitung mundur
    if (window.prayerCountdownInterval) {
      clearInterval(window.prayerCountdownInterval);
    }
    window.prayerCountdownInterval = setInterval(window.updatePrayerCountdown, 1000);
    window.updatePrayerCountdown();

  } catch (err) {
    console.error("Gagal memuat Widget Salat:", err);
    hijriEl.textContent = "Gagal memuat jadwal offline";
  }
};

window.refreshPrayerLocation = async function () {
  if (window.showToast) window.showToast("📍 Mencari koordinat GPS...", "info");
  await window.initSalatHijriWidget();
};

window.updatePrayerCountdown = function () {
  const countdownEl = document.getElementById("header-prayer-countdown");
  if (countdownEl && window.todaySalatTimings) {
    const now = new Date();
    const nextSalat = window.getNextSalatTarget(window.todaySalatTimings, now);

    if (nextSalat?.target) {
      const diffMs = nextSalat.target.getTime() - now.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(diffSecs / 3600);
      const mins = Math.floor((diffSecs % 3600) / 60);
      const secs = diffSecs % 60;

      const pad = (num) => String(num).padStart(2, "0");
      
      const labelEl = countdownEl.querySelector(".countdown-label");
      const timeEl = countdownEl.querySelector(".countdown-time");
      
      if (labelEl && timeEl) {
        labelEl.textContent = `Ke ${nextSalat.name}`;
        timeEl.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
      } else {
        countdownEl.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)} Ke ${nextSalat.name}`;
      }
      
      countdownEl.classList.remove("hidden");
      countdownEl.classList.add("flex");
    } else {
      countdownEl.classList.add("hidden");
      countdownEl.classList.remove("flex");
    }
  }

};

window.toggleSlotStatsAccordion = function (btn) {
  const card = btn.closest(".slot-item");
  if (!card) return;
  const accordionContent = card.querySelector(".slot-stats-accordion");
  const chevron = btn.querySelector(".chevron-icon");

  if (accordionContent) {
    const isOpen = accordionContent.classList.contains("grid-rows-[1fr]");
    if (isOpen) {
      accordionContent.classList.remove("grid-rows-[1fr]");
      accordionContent.classList.add("grid-rows-[0fr]");
      if (chevron) chevron.classList.remove("rotate-180");
    } else {
      accordionContent.classList.remove("grid-rows-[0fr]");
      accordionContent.classList.add("grid-rows-[1fr]");
      if (chevron) chevron.classList.add("rotate-180");
    }
  }
};

window.openBentoModal = function (s, access, stats) {
  const modal = document.getElementById("bento-detail-modal");
  const modalContent = document.getElementById("bento-modal-content");
  if (!modal || !modalContent) return;

  const isHoliday = window.isSlotHoliday(s.id, appState.date);
  const isToday = appState.date === window.getLocalDateStr();

  // Populate basic info
  document.getElementById("bento-modal-title").textContent = s.label;
  document.getElementById("bento-modal-time").textContent = s.subLabel;

  // Set icon inside modal header
  const iconEl = document.getElementById("bento-modal-icon");
  if (iconEl) {
    iconEl.setAttribute("data-lucide", isHoliday ? "calendar-x" : (access.locked ? "lock" : s.style.icon));
  }

  // Header background theme
  const header = document.getElementById("bento-modal-header");
  if (header) {
    header.className = "relative p-6 text-white flex flex-col justify-end min-h-[130px] bg-gradient-to-br";
    const gradientMap = {
      emerald: ["from-emerald-600", "to-teal-500"],
      cyan: ["from-cyan-600", "to-blue-500"],
      orange: ["from-orange-500", "to-amber-500"],
      indigo: ["from-indigo-600", "to-purple-600"],
      slate: ["from-slate-700", "to-slate-800"]
    };
    header.classList.add(...(gradientMap[s.theme] || gradientMap.emerald));
  }

  // Status badge inside modal
  const badge = document.getElementById("bento-modal-status");
  if (badge) {
    if (isHoliday) {
      badge.textContent = "Libur";
      badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-lg border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    } else if (access.locked) {
      let lockText = access.reason === "wait" ? "Menunggu" : "Terkunci";
      if (access.reason === "limit") lockText = "Expired";
      badge.textContent = lockText;
      badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-lg border bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    } else if (stats.isFilled) {
      badge.textContent = "Selesai";
      badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-lg border text-emerald-700 bg-emerald-100 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30";
    } else {
      badge.textContent = "Belum Diisi";
      badge.className = "text-[10px] font-bold px-2.5 py-0.5 rounded-lg border text-amber-700 bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
    }
  }

  // Calculate duration-based progress
  let timeProgressPercent = 0;
  const todayStr = window.getLocalDateStr();
  if (appState.date < todayStr) {
    timeProgressPercent = 100;
  } else if (appState.date > todayStr) {
    timeProgressPercent = 0;
  } else {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const match = s.subLabel.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
    if (match) {
      const startMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      const endMins = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
      if (currentMinutes >= endMins) {
        timeProgressPercent = 100;
      } else if (currentMinutes >= startMins) {
        const totalDuration = endMins - startMins;
        const elapsed = currentMinutes - startMins;
        timeProgressPercent = Math.max(0, Math.min(100, Math.round((elapsed / totalDuration) * 100)));
      }
    }
  }

  if (isHoliday) {
    timeProgressPercent = 0;
  }

  const pBar = document.getElementById("bento-modal-progress-bar");
  const pText = document.getElementById("bento-modal-progress-text");
  if (pBar) {
    pBar.style.width = `${timeProgressPercent}%`;
    if (isHoliday || access.locked) {
      pBar.className = "h-full rounded-full transition-all duration-500 bg-slate-400 dark:bg-slate-600";
      pBar.style.backgroundColor = "";
    } else {
      const themeColors = {
        emerald: "from-emerald-500 to-teal-500",
        cyan: "from-sky-500 to-indigo-500",
        orange: "from-amber-500 to-orange-500",
        indigo: "from-indigo-500 to-purple-500",
        slate: "from-slate-500 to-slate-600"
      };
      const themeGrad = themeColors[s.theme] || themeColors.emerald;
      pBar.className = `h-full rounded-full transition-all duration-500 bg-gradient-to-r ${themeGrad} animate-pulse-subtle shadow-[0_0_8px_rgba(255,255,255,0.3)]`;
      pBar.style.backgroundColor = "";
    }
  }
  if (pText) {
    pText.textContent = `${timeProgressPercent}%`;
    const themeTextColors = {
      emerald: "text-emerald-500 dark:text-emerald-400",
      cyan: "text-sky-500 dark:text-sky-400",
      orange: "text-orange-500 dark:text-orange-400",
      indigo: "text-indigo-500 dark:text-indigo-400",
      slate: "text-slate-500 dark:text-slate-400"
    };
    pText.className = `font-black text-xs ${isHoliday || access.locked ? "text-slate-400 dark:text-slate-500" : (themeTextColors[s.theme] || "text-emerald-500")}`;
  }

  // Populate H S I P A Stats inside modal
  document.getElementById("bento-modal-h").textContent = stats.h;
  document.getElementById("bento-modal-t").textContent = stats.t;
  document.getElementById("bento-modal-i").textContent = stats.i;
  document.getElementById("bento-modal-s").textContent = stats.s;
  document.getElementById("bento-modal-p").textContent = stats.p;
  document.getElementById("bento-modal-a").textContent = stats.a;

  // CTA Button setup
  const ctaBtn = document.getElementById("bento-modal-cta");
  const ctaText = ctaBtn.querySelector("span");

  if (isHoliday) {
    ctaText.textContent = "Libur (Akses Ditolak)";
    ctaBtn.className = "w-full py-3.5 rounded-2xl font-bold text-sm bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed flex items-center justify-center gap-2";
    ctaBtn.onclick = () => window.showToast(`Kegiatan ${s.label} libur pada hari ini.`, "info");
  } else if (access.locked) {
    let lockText = access.reason === "wait" ? "Belum Masuk Waktu" : "Akses Terkunci";
    if (access.reason === "limit") lockText = "Expired (Batas 3 Hari)";
    ctaText.textContent = lockText;
    ctaBtn.className = "w-full py-3.5 rounded-2xl font-bold text-sm bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed flex items-center justify-center gap-2";
    ctaBtn.onclick = () => window.showToast(`🔒 Akses ${s.label} ${lockText}`, "error");
  } else {
    ctaText.textContent = stats.isFilled ? "Ubah Presensi" : "Mulai Presensi";
    const btnThemeMap = {
      emerald: "from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/20",
      cyan: "from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-cyan-500/20",
      orange: "from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20",
      indigo: "from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shadow-indigo-500/20",
      slate: "from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 shadow-slate-600/20"
    };
    const themeClass = btnThemeMap[s.theme] || btnThemeMap.emerald;
    ctaBtn.className = `w-full py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r ${themeClass} text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2`;

    ctaBtn.onclick = () => {
      window.closeBentoModal();
      appState.currentSlotId = s.id;
      window.openAttendance();
    };
  }

  // Open modal with fade-in and scale-up effect
  modal.classList.remove("hidden");
  modal.offsetHeight; // force reflow
  modal.classList.remove("opacity-0");
  modalContent.classList.remove("scale-95");
  modalContent.classList.add("scale-100");

  if (window.lucide) window.lucide.createIcons();
};

window.closeBentoModal = function () {
  const modal = document.getElementById("bento-detail-modal");
  const modalContent = document.getElementById("bento-modal-content");
  if (!modal || !modalContent) return;

  modal.classList.add("opacity-0");
  modalContent.classList.remove("scale-100");
  modalContent.classList.add("scale-95");

  setTimeout(() => {
    modal.classList.add("hidden");
  }, 300);
};

// Start App
window.onload = window.initApp;

window.toggleSalatAccordion = function () {
  const content = document.getElementById("salat-accordion-content");
  const chevron = document.getElementById("salat-accordion-chevron");
  const label = document.getElementById("salat-accordion-label");
  const wrapper = document.getElementById("salat-accordion-wrapper");
  if (!content || !chevron) return;
  const isExpanded = content.classList.contains("grid-rows-[1fr]");
  if (isExpanded) {
    if (wrapper) wrapper.classList.remove("is-expanded");
    content.classList.remove("grid-rows-[1fr]");
    content.classList.add("grid-rows-[0fr]");
    chevron.classList.remove("rotate-180");
    if (label) label.textContent = "Lihat Jadwal Salat";
  } else {
    if (wrapper) wrapper.classList.add("is-expanded");
    content.classList.remove("grid-rows-[0fr]");
    content.classList.add("grid-rows-[1fr]");
    chevron.classList.add("rotate-180");
    if (label) label.textContent = "Jadwal Salat";
  }
};
