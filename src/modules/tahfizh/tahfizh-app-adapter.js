// File: tahfizh-app-adapter.js
// Bridge adapter to integrate tahfizh app.js with Presensi system
// This file modifies the tahfizh app to work within the presensi container
// Deprecated: alur aktif aplikasi memakai tahfizh-manager.js.

// Global State and DOM objects for tahfizh (extracted from app.js)
window.TahfizhState = window.TahfizhState || {
  allSetoran: [],
  verifiedSetoran: [],
  pendingSetoran: [],
  rawSantriList: [],
  santriData: [],
  classGroups: {},
  currentRole: null,
  userPassword: null,
  setoranIdToDelete: null,
  searchDebounceTimer: null,
  santriNameMap: new Map(),
  chartInstance: null,
  countdownInterval: null,
};

// Modified DOM caching for tahfizh to work with new container
window.TahfizhDOM = {};

function cacheTahfizhDOMElements() {
  const elementMapping = {
    // Layout & Navigation
    mainLayout: "main-layout",
    mainNav: "main-nav",
    mainContent: "main-content",
    datetimeContainer: "datetime-container",

    // Role Selection Modal
    roleSelectionModal: "role-selection-modal",
    roleButtonsContainer: "role-buttons",

    // Navigation menu items (simplified for presensi integration)
    navItemInput: "nav-item-input",
    navItemAnalisis: "nav-item-analisis",
  };

  for (const [key, id] of Object.entries(elementMapping)) {
    window.TahfizhDOM[key] = document.getElementById(id) || null;
  }
}

// Initialize Tahfizh App Adapter
window.initTahfizhAdapter = async function () {
  try {
    console.log("Initializing Tahfizh Adapter...");

    // Cache DOM elements
    cacheTahfizhDOMElements();

    // Set up config
    if (window.AppConfig && !window.APP_TAHFIZH_CONFIG) {
      window.APP_TAHFIZH_CONFIG = window.AppConfig;
    }

    // Initialize role if not set
    if (!localStorage.getItem("tahfizh_role")) {
      showTahfizhRoleSelectionModal();
    } else {
      const savedRole = localStorage.getItem("tahfizh_role");
      await initializeTahfizhWithRole(savedRole);
    }

    console.log("Tahfizh Adapter initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing Tahfizh Adapter:", error);
    throw error;
  }
};

// Show Role Selection Modal
function showTahfizhRoleSelectionModal() {
  const modal = document.getElementById("role-selection-modal");
  if (modal) {
    modal.classList.remove("hidden");
  }

  // Hide loading and layout
  const loading = document.getElementById("tahfizh-loading");
  if (loading) loading.classList.add("hidden");

  const layout = document.getElementById("main-layout");
  if (layout) layout.classList.add("hidden");
}

// Initialize Tahfizh with selected role
window.initializeTahfizhWithRole = async function (role) {
  try {
    // Set role
    window.TahfizhState.currentRole = role;
    localStorage.setItem("tahfizh_role", role);

    // Hide role modal
    const modal = document.getElementById("role-selection-modal");
    if (modal) modal.classList.add("hidden");

    // Show layout
    const layout = document.getElementById("main-layout");
    if (layout) {
      layout.classList.remove("hidden");
    }

    // Hide loading
    const loading = document.getElementById("tahfizh-loading");
    if (loading) loading.classList.add("hidden");

    // Create pages divs if they don't exist
    const mainContent = document.getElementById("main-content");
    if (mainContent && mainContent.children.length === 0) {
      mainContent.innerHTML = `
                <div id="page-beranda" class=""></div>
                <div id="page-input" class="hidden"></div>
                <div id="page-analisis" class="hidden"></div>
                <div id="page-validasi" class="hidden"></div>
            `;
    }

    // Render navigation based on role
    renderTahfizhNavigation(role);

    // Show first page
    window.switchTahfizhPage("page-beranda");

    // Simulate data loading
    await simulateTahfizhDataLoading();

    console.log(`Tahfizh initialized with role: ${role}`);

    return true;
  } catch (error) {
    console.error("Error initializing with role:", error);
    window.showToast(
      "Gagal menginisialisasi Tahfizh dengan role yang dipilih",
      "error",
    );
    return false;
  }
};

// Render navigation based on role
function renderTahfizhNavigation(role) {
  const nav = document.getElementById("tahfizh-nav");
  if (!nav) return;

  let navHTML = `<div class="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 py-1 mb-3">
        Mode: ${role.charAt(0).toUpperCase() + role.slice(1)}
    </div>`;

  // Common navigation items
  const navItems = [
    { icon: "📊", label: "Dashboard", id: "page-beranda" },
    { icon: "📝", label: "Input Setor", id: "page-input" },
    { icon: "📈", label: "Analisis", id: "page-analisis" },
  ];

  // Role-specific items
  if (role === "musyrif") {
    navItems.push({ icon: "✅", label: "Validasi", id: "page-validasi" });
  }

  navItems.forEach((item) => {
    navHTML += `
            <button onclick="window.switchTahfizhPage('${item.id}')" 
                    data-page="${item.id}"
                    class="w-full p-2 text-left text-sm font-medium rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <span>${item.icon}</span> ${item.label}
            </button>
        `;
  });

  nav.innerHTML = navHTML;
}

// Switch Tahfizh page
window.switchTahfizhPage = function (pageId) {
  console.log(`Switching to tahfizh page: ${pageId}`);

  // Hide all pages
  const pages = [
    "page-beranda",
    "page-input",
    "page-analisis",
    "page-validasi",
  ];
  pages.forEach((page) => {
    const pageEl = document.getElementById(page);
    if (pageEl) pageEl.classList.add("hidden");
  });

  // Show selected page
  const selectedPage = document.getElementById(pageId);
  if (selectedPage) {
    selectedPage.classList.remove("hidden");
    renderTahfizhPage(pageId);
  }

  // Update active nav item
  document.querySelectorAll("[data-page]").forEach((btn) => {
    if (btn.dataset.page === pageId) {
      btn.classList.add(
        "bg-orange-100",
        "dark:bg-orange-900/30",
        "text-orange-600",
        "dark:text-orange-400",
      );
    } else {
      btn.classList.remove(
        "bg-orange-100",
        "dark:bg-orange-900/30",
        "text-orange-600",
        "dark:text-orange-400",
      );
    }
  });
};

// Render Tahfizh page content
function renderTahfizhPage(pageId) {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;

  let content = "";
  const role = window.TahfizhState.currentRole;

  switch (pageId) {
    case "page-beranda":
      content = renderTahfizhDashboard();
      break;
    case "page-input":
      content = renderTahfizhInputForm();
      break;
    case "page-analisis":
      content = renderTahfizhAnalysis();
      break;
    case "page-validasi":
      content = renderTahfizhValidation();
      break;
    default:
      content = '<p class="p-4 text-slate-500">Pilih menu di sidebar</p>';
  }

  mainContent.innerHTML = content;

  // Re-initialize lucide icons if available
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Render Dashboard
function renderTahfizhDashboard() {
  const role = window.TahfizhState.currentRole;

  return `
        <div class="p-6 space-y-6">
            <div class="glass-card p-6 rounded-xl bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
                <h2 class="text-2xl font-bold text-orange-900 dark:text-orange-300">Sistem Tahfizh</h2>
                <p class="text-orange-700 dark:text-orange-400 mt-2">Mode: ${role}</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="glass-card p-4 rounded-lg text-center">
                    <p class="text-slate-600 dark:text-slate-400 text-sm">Total Santri</p>
                    <p class="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">42</p>
                </div>
                <div class="glass-card p-4 rounded-lg text-center">
                    <p class="text-slate-600 dark:text-slate-400 text-sm">Setor Hari Ini</p>
                    <p class="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">8</p>
                </div>
                <div class="glass-card p-4 rounded-lg text-center">
                    <p class="text-slate-600 dark:text-slate-400 text-sm">Menunggu Validasi</p>
                    <p class="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">3</p>
                </div>
            </div>
            
            <div class="glass-card p-6 rounded-lg">
                <h3 class="font-bold text-slate-800 dark:text-white mb-4">Status Terbaru</h3>
                <p class="text-sm text-slate-600 dark:text-slate-400">Data akan dimuat dari server...</p>
            </div>
        </div>
    `;
}

// Render Input Form
function renderTahfizhInputForm() {
  return `
        <div class="p-6 max-w-2xl">
            <div class="glass-card p-6 rounded-lg">
                <h2 class="text-xl font-bold text-slate-800 dark:text-white mb-6">Input Setor Hafalan</h2>
                
                <form class="space-y-4" onsubmit="event.preventDefault(); window.showToast('Form submission akan diimplementasikan', 'info');">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tanggal</label>
                        <input type="datetime-local" class="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" required>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Jenis Program</label>
                        <select class="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" required>
                            <option>Mutqin</option>
                            <option>Ziyadah</option>
                            <option>Murajaah</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Surat / Juz</label>
                        <input type="text" class="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" required>
                    </div>
                    
                    <button type="submit" class="w-full p-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors">
                        Kirim Setor
                    </button>
                </form>
            </div>
        </div>
    `;
}

// Render Analysis
function renderTahfizhAnalysis() {
  return `
        <div class="p-6">
            <div class="glass-card p-6 rounded-lg">
                <h2 class="text-xl font-bold text-slate-800 dark:text-white mb-4">Analisis Hafalan</h2>
                <p class="text-slate-600 dark:text-slate-400">Fitur analisis akan ditampilkan di sini...</p>
                <div class="mt-6 h-64 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                    <p class="text-slate-400">Chart akan ditampilkan di sini</p>
                </div>
            </div>
        </div>
    `;
}

// Render Validation (for musyrif only)
function renderTahfizhValidation() {
  return `
        <div class="p-6">
            <div class="glass-card p-6 rounded-lg">
                <h2 class="text-xl font-bold text-slate-800 dark:text-white mb-4">Validasi Setor</h2>
                <p class="text-slate-600 dark:text-slate-400">Setor yang menunggu validasi akan ditampilkan di sini...</p>
            </div>
        </div>
    `;
}

// Simulate data loading
async function simulateTahfizhDataLoading() {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Tahfizh data loading simulation complete");
      resolve();
    }, 500);
  });
}

// Export functions
window.TahfizhAdapter = {
  init: window.initTahfizhAdapter,
  initWithRole: window.initializeTahfizhWithRole,
  switchPage: window.switchTahfizhPage,
};

console.log("Tahfizh App Adapter loaded");
