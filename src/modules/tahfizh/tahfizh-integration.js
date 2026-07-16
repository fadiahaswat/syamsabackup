// File: tahfizh-integration.js
// Integration layer for Tahfizh System with Presensi App
// This file handles loading tahfizh app.js and adapting it to work with the new UI structure
// Deprecated: jangan memuat aplikasi Tahfizh eksternal; alur aktif ada di tahfizh-manager.js.

let tahfizhLoaded = false;
let tahfizhAppInstance = null;

// Load external dependencies for Tahfizh
async function loadTahfizhDependencies() {
  const dependencies = [
    { name: "Chart", url: "https://cdn.jsdelivr.net/npm/chart.js" },
    {
      name: "jsPDF",
      url: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    },
  ];

  for (const dep of dependencies) {
    if (!window[dep.name]) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = dep.url;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        console.log(`${dep.name} loaded successfully`);
      } catch (error) {
        console.warn(`Failed to load ${dep.name}:`, error);
      }
    }
  }
}

// Initialize Tahfizh App
window.initTahfizhFromModule = async function () {
  console.warn("initTahfizhFromModule deprecated. Gunakan initTahfizhTab dari tahfizh-manager.js.");
  if (window.initTahfizhTab) {
    return window.initTahfizhTab();
  }

  if (tahfizhLoaded) {
    console.log("Tahfizh sudah diinisialisasi");
    return;
  }

  try {
    console.log("Memulai inisialisasi Tahfizh...");

    // Load dependencies
    await loadTahfizhDependencies();

    // Load tahfizh HTML structure
    await loadTahfizhHTMLStructure();

    // Load tahfizh config and app
    await loadTahfizhScripts();

    // Initialize tahfizh app
    if (window.initializeTahfizhApp) {
      await window.initializeTahfizhApp();
    }

    tahfizhLoaded = true;
    console.log("Tahfizh berhasil diinisialisasi");
  } catch (error) {
    console.error("Error initializing Tahfizh:", error);
    window.showToast("Gagal memuat Tahfizh System", "error");
  }
};

// Load Tahfizh HTML Structure from sistemtahfizh-main/index.html
async function loadTahfizhHTMLStructure() {
  try {
    const response = await fetch(
      "/tmp/workspace/fadiahaswat/presensi/sistemtahfizh-main/index.html",
    );
    if (!response.ok) throw new Error("Failed to load tahfizh HTML");

    const html = await response.text();

    // Extract key sections from tahfizh HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Extract main content from tahfizh HTML
    const mainContent =
      doc.querySelector('main[role="main"]') ||
      doc.querySelector(".main-layout") ||
      doc.body;

    if (mainContent) {
      const container = document.getElementById("tahfizh-container");
      if (container) {
        // Clear existing content
        container.innerHTML = "";

        // Clone and append tahfizh content
        const clonedContent = mainContent.cloneNode(true);
        container.appendChild(clonedContent);

        console.log("Tahfizh HTML structure loaded");
      }
    }
  } catch (error) {
    console.warn(
      "Could not load tahfizh HTML from file, using fallback:",
      error,
    );
    // Fallback: use basic structure
    createTahfizhBasicStructure();
  }
}

// Create basic Tahfizh structure if HTML loading fails
function createTahfizhBasicStructure() {
  const container = document.getElementById("tahfizh-container");
  if (!container) return;

  container.innerHTML = `
        <div id="main-layout" class="w-full h-full flex">
            <!-- Sidebar -->
            <aside id="main-nav" class="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto p-4">
                <h1 class="text-lg font-bold mb-4">Setor.in</h1>
                <nav id="nav-menu" class="space-y-2"></nav>
            </aside>
            
            <!-- Main Content -->
            <main id="main-content" class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                <div id="page-beranda" class="hidden">Loading...</div>
                <div id="page-input" class="hidden">Input Form</div>
                <div id="page-analisis" class="hidden">Analysis</div>
            </main>
        </div>
    `;
}

// Load Tahfizh config and app scripts
async function loadTahfizhScripts() {
  try {
    // Configuration is loaded by the main application. Never execute remote
    // or workspace scripts dynamically.
    if (window.APP_TAHFIZH_CONFIG) {
      window.AppConfig = {
        ...(window.AppConfig || {}),
        ...window.APP_TAHFIZH_CONFIG,
      };
    }

    console.log("Tahfizh config loaded");
  } catch (error) {
    console.warn("Could not load tahfizh scripts:", error);
  }
}

// Function to properly initialize Tahfizh app (called from tahfizh-module)
window.initializeTahfizhApp = async function () {
  try {
    // Hide loading
    const loading = document.getElementById("tahfizh-loading");
    if (loading) loading.classList.add("hidden");

    // Show main layout
    const layout = document.getElementById("main-layout");
    if (layout) layout.classList.remove("hidden");

    // Initialize role selection if needed
    const roleModal = document.getElementById("role-selection-modal");
    if (roleModal && !localStorage.getItem("tahfizh_role")) {
      roleModal.classList.remove("hidden");
    } else {
      // Load existing role
      const savedRole = localStorage.getItem("tahfizh_role");
      if (savedRole) {
        await window.tahfizhSetRole(savedRole);
      }
    }
  } catch (error) {
    console.error("Error in initializeTahfizhApp:", error);
  }
};

// Set Tahfizh Role
window.tahfizhSetRole = async function (role) {
  try {
    // Save role to localStorage
    localStorage.setItem("tahfizh_role", role);

    // Hide role selection modal
    const roleModal = document.getElementById("role-selection-modal");
    if (roleModal) roleModal.classList.add("hidden");

    // Store role in window for tahfizh app
    window.TahfizhRole = role;

    console.log(`Tahfizh role set to: ${role}`);

    // Trigger tahfizh initialization with role
    if (window.Core && window.Core.reloadData) {
      await window.Core.reloadData();
    }
  } catch (error) {
    console.error("Error setting tahfizh role:", error);
    window.showToast("Gagal mengatur mode Tahfizh", "error");
  }
};

// Export module
window.TahfizhIntegration = {
  load: window.initTahfizhFromModule,
  setRole: window.tahfizhSetRole,
};

console.log("Tahfizh Integration module loaded");
