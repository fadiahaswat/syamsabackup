/**
 * File: pull-to-refresh.js
 * Deskripsi: Menambahkan perilaku tarik-ke-bawah untuk menyegarkan (Pull to Refresh) pada kontainer tab aplikasi.
 * Updated: localStorage-only mode
 */

(function () {
  // 1. Injeksi CSS secara dinamis agar mandiri (self-contained)
  const injectStyles = () => {
    const styleId = "ptr-custom-styles";
    if (document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      /* Container pull to refresh */
      .tab-content {
        position: relative;
      }

      /* PTR Floating Indicator */
      .ptr-indicator {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translate(-50%, -80px) scale(0.3);
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15), 0 1px 4px rgba(15, 23, 42, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        opacity: 0;
        pointer-events: none;
        border: 1px solid rgba(148, 163, 184, 0.15);
        transition: transform 0.15s cubic-bezier(0.18, 0.89, 0.32, 1.28), opacity 0.15s ease, background-color 0.2s ease, border-color 0.2s ease;
      }

      html.dark .ptr-indicator {
        background: #1e293b;
        border-color: rgba(148, 163, 184, 0.1);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      }

      /* Spinner Animation */
      .ptr-spinner {
        display: none;
        width: 22px;
        height: 22px;
        border: 2.5px solid rgba(12, 129, 228, 0.15);
        border-top-color: #0c81e4;
        border-radius: 50%;
        animation: ptr-spin-anim 0.8s linear infinite;
      }

      html.dark .ptr-spinner {
        border-top-color: #11c4d4;
        border-solid-color: rgba(17, 196, 212, 0.15);
      }

      .ptr-arrow-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        color: #0c81e4;
        transition: transform 0.1s linear, color 0.2s ease;
      }

      html.dark .ptr-arrow-wrapper {
        color: #11c4d4;
      }

      @keyframes ptr-spin-anim {
        to { transform: rotate(360deg); }
      }

      /* Membatasi scroll-bounce iOS bawaan jika memungkinkan */
      .tab-content.ptr-dragging {
        overscroll-behavior-y: contain;
      }
    `;
    document.head.appendChild(style);
  };

  // 2. HTML template untuk indikator
  const createIndicatorHTML = () => {
    const el = document.createElement("div");
    el.className = "ptr-indicator";
    el.innerHTML = `
      <div class="ptr-arrow-wrapper">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
      </div>
      <div class="ptr-spinner"></div>
    `;
    return el;
  };

  // 3. Logika utama pull to refresh
  const initPullToRefresh = () => {
    injectStyles();

    const containers = document.querySelectorAll(".tab-content");
    containers.forEach((container) => {
      // Pastikan hanya di-init sekali
      if (container.querySelector(".ptr-indicator")) return;

      const indicator = createIndicatorHTML();
      container.prepend(indicator);

      const arrowWrapper = indicator.querySelector(".ptr-arrow-wrapper");
      const spinner = indicator.querySelector(".ptr-spinner");

      let startY = 0;
      let currentY = 0;
      let isDragging = false;
      let hasVibrated = false;
      let isRefreshing = false;

      const threshold = 65; // px tarikan untuk refresh

      container.addEventListener("touchstart", (e) => {
        // Hanya izinkan jika scroll bar berada paling atas dan tidak sedang refresh
        if (container.scrollTop > 0 || isRefreshing) return;

        startY = e.touches[0].clientY;
        isDragging = true;
        hasVibrated = false;

        // Reset transisi indikator saat mulai diseret agar responsif
        indicator.style.transition = "none";
      }, { passive: true });

      container.addEventListener("touchmove", (e) => {
        if (!isDragging || isRefreshing) return;

        currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;

        // Jika menyeret ke bawah
        if (deltaY > 0) {
          // Cegah perilaku scroll browser bawaan (misal browser reload/pull-down bounce)
          if (e.cancelable) e.preventDefault();

          container.classList.add("ptr-dragging");

          // Terapkan hambatan (elastic damping)
          const pullDistance = Math.min(deltaY * 0.45, 120);

          // Update visual indikator
          // Transform dari translate(-50%, -80px) scale(0.3) ke translate(-50%, Xpx) scale(1)
          const scale = Math.min(0.3 + (pullDistance / threshold) * 0.7, 1);
          const translateY = -80 + pullDistance;
          indicator.style.transform = `translate(-50%, ${translateY}px) scale(${scale})`;
          indicator.style.opacity = Math.min(pullDistance / 30, 1).toString();

          // Putar panah seiring ditarik
          const rotation = pullDistance * 3.5;
          arrowWrapper.style.transform = `rotate(${rotation}deg)`;

          // Haptic feedback saat mencapai threshold
          if (pullDistance >= threshold && !hasVibrated) {
            try {
              if (navigator.vibrate) {
                navigator.vibrate(15); // Getar singkat 15ms
              }
            } catch (e) {
              // Ignore vibration errors (user hasn't interacted with frame)
            }
            hasVibrated = true;
            arrowWrapper.style.color = "#22c55e"; // Ubah jadi hijau saat siap lepas
          } else if (pullDistance < threshold && hasVibrated) {
            hasVibrated = false;
            // Kembalikan ke warna bawaan
            arrowWrapper.style.color = "";
          }
        }
      }, { passive: false });

      container.addEventListener("touchend", async (e) => {
        if (!isDragging) return;
        isDragging = false;
        container.classList.remove("ptr-dragging");

        // Aktifkan kembali transisi halus untuk animasi snap back / loading state
        indicator.style.transition = "";

        const deltaY = currentY - startY;
        const pullDistance = Math.min(deltaY * 0.45, 120);

        if (pullDistance >= threshold && !isRefreshing) {
          // Masuk ke Mode Refreshing
          isRefreshing = true;

          // Posisikan indikator di posisi loading (translateY 16px)
          indicator.style.transform = "translate(-50%, 16px) scale(1)";
          indicator.style.opacity = "1";

          // Sembunyikan panah, tampilkan spinner
          arrowWrapper.style.display = "none";
          spinner.style.display = "block";

          // Eksekusi fungsi update data
          try {
            if (window.performPullToRefresh) {
              await window.performPullToRefresh();
            } else {
              // Fallback jika fungsi belum di-load
              await new Promise((resolve) => setTimeout(resolve, 1500));
            }
          } catch (err) {
            console.error("Gagal melakukan pull to refresh:", err);
          } finally {
            // Selesai menyegarkan, kembalikan indikator ke atas
            resetIndicator();
          }
        } else {
          // Batal refresh, kembalikan indikator ke atas
          resetIndicator();
        }
      });

      const resetIndicator = () => {
        indicator.style.transform = "translate(-50%, -80px) scale(0.3)";
        indicator.style.opacity = "0";

        // Kembalikan konten visual setelah animasi keluar selesai
        setTimeout(() => {
          arrowWrapper.style.display = "flex";
          arrowWrapper.style.transform = "rotate(0deg)";
          arrowWrapper.style.color = "";
          spinner.style.display = "none";
          isRefreshing = false;
        }, 200);
      };
    });
  };

  // 4. Integrasikan fungsi update data global
  window.performPullToRefresh = async function () {
    try {
      console.log("🔄 Pull-To-Refresh: Menyegarkan data...");

      // Simpan data ke localStorage via storageManager
      if (window.storageManager) {
        window.storageManager.saveNow();
      }

      // Refresh UI setelah refresh
      if (window.updateDashboard) window.updateDashboard();
      if (window.renderAttendanceList) window.renderAttendanceList();
      if (window.renderPermitList) window.renderPermitList();
      if (window.refreshPermitSurfaces) window.refreshPermitSurfaces();

      window.showToast("Data berhasil disegarkan!", "success");
    } catch (error) {
      console.error("[PullToRefresh] Error:", error);
      window.showToast("Gagal menyegarkan: " + error.message, "error");
    }
  };

  // 5. Jalankan inisialisasi setelah DOM siap atau aplikasi diload
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPullToRefresh);
  } else {
    initPullToRefresh();
  }

  // Ekspos inisialisasi ulang jika ada tab dinamis
  window.reinitPullToRefresh = initPullToRefresh;
})();
