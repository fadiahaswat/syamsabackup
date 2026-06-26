// File: tahfizh-module.js
// Wrapper module untuk Tahfizh System sebagai bagian dari Presensi App
// Deprecated: alur aktif aplikasi memakai tahfizh-manager.js yang dimuat langsung oleh index.html.
// File ini dipertahankan sementara agar referensi lama tidak error, tetapi tidak lagi menginisialisasi UI terpisah.

let tahfizhInitialized = false;
let tahfizhAppState = null;

window.initTahfizhModule = async function () {
  console.warn("initTahfizhModule deprecated. Gunakan initTahfizhTab dari tahfizh-manager.js.");
  if (window.initTahfizhTab) {
    return window.initTahfizhTab();
  }

  if (tahfizhInitialized) {
    console.log("Tahfizh sudah diinisialisasi");
    // Tampilkan tab tahfizh
    const mainLayout = document.getElementById("main-layout");
    if (mainLayout) mainLayout.classList.remove("hidden");
    return;
  }

  try {
    console.log("Menginisialisasi Tahfizh Module...");

    const container = document.getElementById("tahfizh-container");
    if (!container) {
      console.error("Container tahfizh tidak ditemukan");
      return;
    }

    // Prepare Tahfizh Config from main config
    setupTahfizhConfig();

    // Load Tahfizh HTML template
    await loadTahfizhUI(container);

    // Load Tahfizh App Logic
    await loadTahfizhAppLogic();

    tahfizhInitialized = true;
    console.log("Tahfizh Module berhasil diinisialisasi");
  } catch (error) {
    console.error("Error initializing Tahfizh:", error);
    window.showToast("Gagal memuat modul Tahfizh", "error");
  }
};

// Setup Tahfizh Config from main config
function setupTahfizhConfig() {
  if (!window.AppConfig && window.APP_TAHFIZH_CONFIG) {
    window.AppConfig = {
      scriptURL:
        window.APP_CREDENTIALS?.tahfizhScriptUrl ||
        "https://script.google.com/macros/s/AKfycbyl2FCcGUtolkJIDsoiTYFKeKp8IQwHT0V3z8n1pOHH9CLiyvYZTBaimrojILJM_A-HLg/exec",
      classGroupOverrides: window.APP_TAHFIZH_CONFIG.classGroupOverrides || {},
      musyrifSortOrder: window.APP_TAHFIZH_CONFIG.musyrifSortOrder || [],
      deadlineJuz30Score: window.APP_TAHFIZH_CONFIG.deadlineJuz30Score,
      deadlineTahfizhTuntas: window.APP_TAHFIZH_CONFIG.deadlineTahfizhTuntas,
      perpulanganPeriods: window.APP_TAHFIZH_CONFIG.perpulanganPeriods || [],
      scoringTiers: window.APP_TAHFIZH_CONFIG.scoringTiers || [],
      hafalanData: null,
      santriList: [],
    };
  }
}

// Load Tahfizh UI
async function loadTahfizhUI(container) {
  // Create basic Tahfizh UI structure
  container.innerHTML = `
        <div id="tahfizh-app" class="w-full h-full">
            <!-- Loading -->
            <div id="tahfizh-loading" class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white dark:bg-slate-900">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                <p class="mt-4 text-slate-600 dark:text-slate-400">Memuat Sistem Tahfizh...</p>
            </div>

            <!-- Main Content (akan di-render oleh app.js) -->
            <div id="role-selection-modal" class="hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                    <h2 class="text-xl font-bold text-slate-800 dark:text-white mb-4">Pilih Mode Akses</h2>
                    
                    <div id="role-buttons" class="space-y-3">
                        <button onclick="window.tahfizhSetRole('santri')" class="w-full p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-bold hover:bg-blue-100 transition-all">
                            📚 Santri
                        </button>
                        <button onclick="window.tahfizhSetRole('musyrif')" class="w-full p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl font-bold hover:bg-amber-100 transition-all">
                            👨‍🏫 Musyrif
                        </button>
                        <button onclick="window.tahfizhSetRole('wali')" class="w-full p-4 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl font-bold hover:bg-purple-100 transition-all">
                            👤 Wali
                        </button>
                    </div>
                </div>
            </div>

            <!-- Tahfizh Main Layout -->
            <div id="main-layout" class="hidden w-full h-full">
                <!-- Sidebar Navigation -->
                <aside id="main-nav" class="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
                    <div class="p-4 text-center border-b border-slate-200 dark:border-slate-700">
                        <h1 class="text-lg font-bold text-slate-800 dark:text-white">Setor.in</h1>
                        <p class="text-xs text-slate-500 dark:text-slate-400">Aplikasi Tahfizh</p>
                    </div>
                    <nav class="p-4 space-y-2" id="tahfizh-nav">
                        <!-- Navigation items akan di-generate oleh app.js -->
                    </nav>
                </aside>

                <!-- Main Content Area -->
                <main id="main-content" class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                    <!-- Content akan di-generate oleh app.js -->
                </main>
            </div>
        </div>
    `;
}

// Load Tahfizh App Logic
async function loadTahfizhAppLogic() {
  try {
    // Use tahfizh app adapter
    if (window.initTahfizhAdapter) {
      await window.initTahfizhAdapter();
      return true;
    } else {
      console.warn("Tahfizh adapter not available");
      initializeTahfizhAppFallback();
    }
  } catch (error) {
    console.error("Error loading Tahfizh app logic:", error);
    // Use fallback
    initializeTahfizhAppFallback();
  }
}

// Fallback initialization for Tahfizh
function initializeTahfizhAppFallback() {
  console.log("Using fallback Tahfizh initialization");

  // Hide loading
  const loading = document.getElementById("tahfizh-loading");
  if (loading) loading.classList.add("hidden");

  // Show role selection
  const roleModal = document.getElementById("role-selection-modal");
  if (roleModal) roleModal.classList.remove("hidden");
}

// Set Tahfizh Role dan Load Data
window.tahfizhSetRole = async function (role) {
  try {
    // Sembunyikan modal
    document.getElementById("role-selection-modal").classList.add("hidden");
    document.getElementById("tahfizh-loading").classList.remove("hidden");

    // Initialize with role using adapter
    if (window.initializeTahfizhWithRole) {
      await window.initializeTahfizhWithRole(role);
    } else {
      // Fallback
      localStorage.setItem("tahfizh_role", role);
      window.TahfizhRole = role;

      // Simulate loading
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Hide loading dan tampilkan main layout
      document.getElementById("tahfizh-loading").classList.add("hidden");
      document.getElementById("main-layout").classList.remove("hidden");

      // Display role information
      const nav = document.getElementById("tahfizh-nav");
      if (nav) {
        const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
        nav.innerHTML = `
                    <div class="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 py-1">
                        Mode: ${roleLabel}
                    </div>
                    <button class="w-full p-2 text-left text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                        📊 Dashboard
                    </button>
                    <button class="w-full p-2 text-left text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                        📝 Setor Hafalan
                    </button>
                    <button class="w-full p-2 text-left text-sm rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                        📈 Analisis
                    </button>
                `;
      }
    }

    // Show status message
    window.showToast(`Mode ${role} diaktifkan`, "success");
  } catch (error) {
    console.error("Error setting Tahfizh role:", error);
    document.getElementById("tahfizh-loading").classList.add("hidden");
    window.showToast("Gagal mengatur mode Tahfizh", "error");
  }
};

// Cleanup function
window.closeTahfizhModule = function () {
  tahfizhInitialized = false;
  tahfizhAppState = null;
  document.getElementById("tahfizh-container").innerHTML = "";
};

// Export untuk testing
window.TahfizhModule = {
  init: window.initTahfizhModule,
  close: window.closeTahfizhModule,
  setRole: window.tahfizhSetRole,
};

console.log("Tahfizh Module loaded");
