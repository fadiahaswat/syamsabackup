/**
 * permit-request-manager.js
 * 
 * Mengelola permohonan perizinan santri oleh Wali (Orang Tua)
 * dan sistem persetujuan oleh Musyrif kelas.
 * Terintegrasi dengan Firebase Realtime Database.
 */

(function() {
  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTHS = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  function formatIndonesianDate(dateStr) {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = DAYS[date.getDay()];
    const dateNum = date.getDate();
    const month = MONTHS[date.getMonth()];
    const year = date.getFullYear();
    return `${day}, ${dateNum} ${month} ${year}`;
  }

  // State
  let activeListenerRef = null;
  let currentPendingRequests = [];

  // =========================================================================
  // 1. FUNGSI UNTUK WALI (ORANG TUA)
  // =========================================================================

  /**
   * Membuka modal pengajuan izin untuk Wali
   */
  window.openWaliPermitModal = function() {
    if (!window.isWaliMode || !window.isWaliMode()) {
      return window.showToast("Fitur ini khusus untuk akun Wali Santri.", "warning");
    }

    const santri = appState.waliSantri;
    if (!santri) return window.showToast("Data santri tidak ditemukan.", "error");

    // Reset Form
    const form = document.getElementById("wali-permit-form");
    if (form) form.reset();

    // Autofill & Lock Fields
    const elNamaSantri = document.getElementById("wali-permit-nama-santri");
    const elKelasSantri = document.getElementById("wali-permit-kelas-santri");
    const elNamaWali = document.getElementById("wali-permit-nama-wali");

    if (elNamaSantri) elNamaSantri.value = santri.nama || "";
    if (elKelasSantri) elKelasSantri.value = appState.waliKelas || santri.kelas || "";
    if (elNamaWali) elNamaWali.value = appState.userProfile?.name?.replace("Wali ", "") || "";

    // Set Default Tanggal ke Hari Ini
    const elDate = document.getElementById("wali-permit-date");
    if (elDate) elDate.value = window.getLocalDateStr ? window.getLocalDateStr() : new Date().toISOString().split("T")[0];

    // Populate Time Dropdowns
    const elStartTime = document.getElementById("wali-permit-start-time");
    const elEndTime = document.getElementById("wali-permit-end-time");
    
    if (elStartTime) populateTimeDropdown(elStartTime, 6, 21, "08:00");
    if (elEndTime) populateTimeDropdown(elEndTime, 6, 21, "17:00");

    window.openModal("modal-wali-permit");
  };

  /**
   * Mengisi jam pada dropdown select
   */
  function populateTimeDropdown(selectEl, startHour, endHour, defaultValue = "") {
    selectEl.innerHTML = "";
    for (let i = startHour; i <= endHour; i++) {
      for (let j = 0; j < 60; j += 15) {
        if (i === endHour && j > 0) continue;
        const hour = i.toString().padStart(2, '0');
        const minute = j.toString().padStart(2, '0');
        const time = `${hour}:${minute}`;
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        if (time === defaultValue) {
          option.selected = true;
        }
        selectEl.appendChild(option);
      }
    }
  }

  /**
   * Mengirim permohonan izin Wali ke Firebase
   */
  window.submitWaliPermit = function(event) {
    if (event) event.preventDefault();

    const form = document.getElementById("wali-permit-form");
    if (form && !form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const santri = appState.waliSantri;
    if (!santri) return window.showToast("Sesi Wali Santri kedaluwarsa.", "error");

    const namaWali = document.getElementById("wali-permit-nama-wali").value.trim();
    const alamatWali = document.getElementById("wali-permit-alamat-wali").value.trim();
    const category = document.getElementById("wali-permit-category").value; // 'sakit' atau 'pulang' (all others are pulang)
    const reason = document.getElementById("wali-permit-reason").value.trim();
    const date = document.getElementById("wali-permit-date").value;
    const startTime = document.getElementById("wali-permit-start-time").value;
    const endTime = document.getElementById("wali-permit-end-time").value;
    const destination = document.getElementById("wali-permit-destination").value.trim();

    // Validasi Tanggal & Jam
    if (startTime >= endTime) {
      return window.showToast("Jam kembali harus setelah jam keluar.", "warning");
    }

    const requestId = 'req_' + Date.now() + Math.random().toString(36).substr(2, 5);
    const requestData = {
      id: requestId,
      nis: String(santri.nis || santri.id || ""),
      nama: santri.nama,
      kelas: String(appState.waliKelas || santri.kelas || "").trim(),
      nama_wali: namaWali,
      alamat_wali: alamatWali,
      category: category,
      reason: reason,
      start_date: date,
      end_date: date, // Harian (same day)
      start_time_limit: startTime,
      end_time_limit: endTime,
      destination: destination,
      status: 'pending',
      timestamp: new Date().toISOString(),
      status_label: category === 'sakit' ? 'S' : 'P'
    };

    if (window.FIREBASE_DB) {
      window.showLoading?.(true);
      window.FIREBASE_DB.ref(`permit_requests/${requestId}`).set(requestData)
        .then(() => {
          window.showLoading?.(false);
          window.showToast("Permohonan izin berhasil dikirim!", "success");
          window.closeModal("modal-wali-permit");
          window.loadWaliPermitHistory(); // Reload history
        })
        .catch(err => {
          window.showLoading?.(false);
          console.error('[PermitRequest] Firebase save error:', err);
          window.showToast("Gagal menyimpan ke database cloud.", "error");
        });
    } else {
      // Fallback LocalStorage
      let localReqs = JSON.parse(localStorage.getItem("local_permit_requests") || "[]");
      localReqs.push(requestData);
      localStorage.setItem("local_permit_requests", JSON.stringify(localReqs));
      
      window.showToast("Permohonan disimpan secara lokal (Offline).", "info");
      window.closeModal("modal-wali-permit");
      window.loadWaliPermitHistory();
    }
  };

  /**
   * Memuat riwayat pengajuan izin khusus Wali
   */
  window.loadWaliPermitHistory = function() {
    const container = document.getElementById("wali-permit-history-list");
    if (!container) return;

    const santri = appState.waliSantri;
    if (!santri) {
      container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Sesi tidak valid</div>`;
      return;
    }
    const nis = String(santri.nis || santri.id || "");

    container.innerHTML = `
      <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div class="w-8 h-8 rounded-full border-4 border-slate-200 border-t-palette-blue animate-spin mb-3"></div>
        <p class="text-xs font-semibold">Mengambil riwayat pengajuan...</p>
      </div>
    `;

    if (window.FIREBASE_DB) {
      window.FIREBASE_DB.ref("permit_requests").once("value")
        .then(snapshot => {
          const data = snapshot.val() || {};
          const list = Object.values(data).filter(r => r && String(r.nis) === nis);
          list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          renderWaliPermitHistoryList(list);
        })
        .catch(err => {
          console.error('[PermitRequest] Load history error:', err);
          container.innerHTML = `<div class="p-4 text-center text-xs text-red-500 font-bold">Gagal memuat dari server.</div>`;
        });
    } else {
      let localReqs = JSON.parse(localStorage.getItem("local_permit_requests") || "[]");
      localReqs = localReqs.filter(r => String(r.nis) === nis);
      localReqs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      renderWaliPermitHistoryList(localReqs);
    }
  };

  /**
   * Merender daftar riwayat perizinan Wali
   */
  function renderWaliPermitHistoryList(list) {
    const container = document.getElementById("wali-permit-history-list");
    if (!container) return;

    if (list.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mb-2 opacity-60"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p class="text-xs font-bold">Belum Ada Pengajuan Izin</p>
          <p class="text-[10px] text-slate-400 mt-0.5">Semua riwayat pengajuan Anda akan muncul di sini.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = "";

    list.forEach(req => {
      const card = document.createElement("div");
      card.className = "p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3 transition-all hover:border-slate-200 dark:hover:border-slate-700/80";

      let statusBadge = "";
      let ticketBtn = "";

      if (req.status === "pending") {
        statusBadge = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40">Menunggu</span>`;
      } else if (req.status === "approved") {
        statusBadge = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40">Disetujui</span>`;
        // Stringify req securely to avoid syntax issues in HTML onclick
        const escapedData = encodeURIComponent(JSON.stringify(req));
        ticketBtn = `
          <button onclick="window.showExitTicket('${escapedData}')" class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13 2 2 4-4"/></svg>
            <span>Tampilkan Tiket Keluar</span>
          </button>
        `;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40">Ditolak</span>`;
      }

      const formattedDate = formatIndonesianDate(req.start_date);
      const categoryText = req.category === 'sakit' ? 'Sakit / Medis' : 'Izin Keperluan';

      card.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <span class="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">${categoryText}</span>
            <h4 class="text-xs font-bold text-slate-800 dark:text-white leading-tight">${window.sanitizeHTML(req.reason)}</h4>
          </div>
          ${statusBadge}
        </div>
        
        <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <div>
            <span class="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Waktu Keluar</span>
            <span class="font-bold text-slate-700 dark:text-slate-300">${formattedDate}</span>
            <span class="block text-[9px] font-semibold mt-0.5">${req.start_time_limit} - ${req.end_time_limit} WIB</span>
          </div>
          <div>
            <span class="block text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tempat Tujuan</span>
            <span class="font-bold text-slate-700 dark:text-slate-300 block truncate">${window.sanitizeHTML(req.destination)}</span>
          </div>
        </div>

        ${ticketBtn}
      `;
      container.appendChild(card);
    });
  }

  /**
   * Menampilkan popup Tiket Keluar Digital (Wali/Satpam)
   */
  window.showExitTicket = function(escapedData) {
    const req = JSON.parse(decodeURIComponent(escapedData));
    
    document.getElementById("ticket-student-name").textContent = req.nama;
    document.getElementById("ticket-student-nis").textContent = `NIS: ${req.nis}`;
    document.getElementById("ticket-student-class").textContent = `Kelas: ${req.kelas}`;
    
    document.getElementById("ticket-wali-name").textContent = req.nama_wali || "-";
    document.getElementById("ticket-wali-address").textContent = req.alamat_wali || "-";
    document.getElementById("ticket-destination").textContent = req.destination;
    document.getElementById("ticket-reason").textContent = req.reason;
    
    const validDateStr = `${formatIndonesianDate(req.start_date)} Pukul ${req.start_time_limit} - ${req.end_time_limit} WIB`;
    document.getElementById("ticket-valid-time").textContent = validDateStr;

    document.getElementById("ticket-approver").textContent = req.approvedBy || "Musyrif";
    
    const formattedApprovedAt = req.approvedAt ? new Date(req.approvedAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) + " WIB" : "-";
    document.getElementById("ticket-approved-time").textContent = formattedApprovedAt;

    // Generate pseudo-barcode lines inside SVG
    const svgBarcode = document.getElementById("ticket-barcode-svg");
    if (svgBarcode) {
      svgBarcode.innerHTML = "";
      // Create random width vertical bars
      let x = 10;
      const barColor = document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a';
      while (x < 290) {
        const width = [1, 2, 3, 4][Math.floor(Math.random() * 4)];
        const spacing = [2, 3, 4][Math.floor(Math.random() * 3)];
        
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", "5");
        rect.setAttribute("width", width);
        rect.setAttribute("height", "40");
        rect.setAttribute("fill", barColor);
        
        svgBarcode.appendChild(rect);
        x += width + spacing;
      }
      // Add text label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", "150");
      text.setAttribute("y", "56");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#64748b");
      text.setAttribute("font-size", "9px");
      text.setAttribute("font-family", "monospace");
      text.setAttribute("font-weight", "bold");
      text.textContent = `SYM-${req.id.toUpperCase()}`;
      svgBarcode.appendChild(text);
    }

    window.openModal("modal-exit-ticket");
  };


  // =========================================================================
  // 2. FUNGSI UNTUK MUSYRIF (PERSETUJUAN IZIN)
  // =========================================================================

  /**
   * Inisialisasi Real-Time Listener untuk Musyrif
   */
  window.initPermitRequestListener = function() {
    if (!window.FIREBASE_DB) return;
    
    const kelas = appState.selectedClass;
    if (!kelas) return;

    // Bersihkan listener lama jika ada
    window.cleanupPermitRequestListener();

    console.log(`[PermitRequestManager] Listening to permit_requests for Class ${kelas}`);
    
    const ref = window.FIREBASE_DB.ref("permit_requests");
    activeListenerRef = ref;

    ref.on("value", snapshot => {
      try {
        const data = snapshot.val() || {};
        const requests = Object.values(data).filter(r => r && String(r.kelas).trim() === String(kelas).trim());
        
        // Filter pending requests for widget
        currentPendingRequests = requests.filter(r => r.status === "pending");
        
        renderMusyrifApprovalWidget(currentPendingRequests.length);
      } catch (err) {
        console.error('[PermitRequestManager] Listener value error:', err);
      }
    });
  };

  /**
   * Membersihkan listener real-time Firebase
   */
  window.cleanupPermitRequestListener = function() {
    if (activeListenerRef) {
      activeListenerRef.off();
      activeListenerRef = null;
      console.log("[PermitRequestManager] Listener removed.");
    }
  };

  /**
   * Merender Widget Badge Pending Izin di Dasbor Musyrif
   */
  function renderMusyrifApprovalWidget(count) {
    const elWidget = document.getElementById("musyrif-approval-widget");
    if (!elWidget) return;

    if (count === 0) {
      elWidget.classList.add("hidden");
      return;
    }

    elWidget.classList.remove("hidden");
    
    // Update label text & count
    const elCount = document.getElementById("approval-pending-count");
    const elBadge = document.getElementById("approval-pending-badge");
    
    if (elCount) elCount.textContent = `${count} Pengajuan Pending`;
    if (elBadge) elBadge.textContent = count;
  }

  /**
   * Membuka modal daftar persetujuan Musyrif
   */
  window.openMusyrifApprovalModal = function() {
    window.updateMusyrifApprovalModalList();
    window.openModal("modal-musyrif-approval");
  };

  /**
   * Mengupdate isi daftar persetujuan Musyrif di dalam modal
   */
  window.updateMusyrifApprovalModalList = function() {
    const container = document.getElementById("musyrif-approval-list");
    if (!container) return;

    if (currentPendingRequests.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center p-8 text-center text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mb-2 text-emerald-500 opacity-80"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/><path d="m9 12 2 2 4-4"/></svg>
          <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Semua Pengajuan Selesai</p>
          <p class="text-[10px] mt-0.5 text-slate-400">Tidak ada permohonan izin yang menunggu persetujuan.</p>
        </div>
      `;
      setTimeout(() => {
        window.closeModal("modal-musyrif-approval");
      }, 1500);
      return;
    }

    container.innerHTML = "";

    currentPendingRequests.forEach(req => {
      const el = document.createElement("div");
      el.className = "p-4 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-3";

      const formattedDate = formatIndonesianDate(req.start_date);
      const categoryLabel = req.category === "sakit" ? "Sakit / Medis" : "Izin / Pulang";
      const badgeColor = req.category === "sakit" 
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200/50" 
        : "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border border-purple-200/50";

      el.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <div>
            <h4 class="text-sm font-black text-slate-800 dark:text-white leading-tight">${window.sanitizeHTML(req.nama)}</h4>
            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider">NIS: ${req.nis}</span>
          </div>
          <span class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${badgeColor}">${categoryLabel}</span>
        </div>

        <div class="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 bg-white/50 dark:bg-slate-900/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
          <p><strong>Wali:</strong> ${window.sanitizeHTML(req.nama_wali)} (${window.sanitizeHTML(req.alamat_wali || '-')})</p>
          <p><strong>Keperluan:</strong> <span class="text-slate-800 dark:text-slate-200 font-medium">${window.sanitizeHTML(req.reason)}</span></p>
          <p><strong>Waktu:</strong> ${formattedDate} (${req.start_time_limit} - ${req.end_time_limit} WIB)</p>
          <p><strong>Tujuan:</strong> ${window.sanitizeHTML(req.destination)}</p>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-1">
          <button onclick="window.processPermitRequest('${req.id}', 'reject')" class="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all active:scale-95">
            Tolak
          </button>
          <button onclick="window.processPermitRequest('${req.id}', 'approve')" class="py-2 px-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95">
            Setujui (Approve)
          </button>
        </div>
      `;
      container.appendChild(el);
    });
  };

  /**
   * Menangani persetujuan atau penolakan pengajuan izin oleh Musyrif
   */
  window.processPermitRequest = function(requestId, action) {
    if (!window.FIREBASE_DB) {
      return window.showToast("Database cloud tidak tersedia. Pengoperasian dibatalkan.", "error");
    }

    const requestData = currentPendingRequests.find(r => r.id === requestId);
    if (!requestData) return window.showToast("Data pengajuan tidak ditemukan.", "error");

    const musyrifName = appState.userProfile?.name || "Musyrif";

    window.showLoading?.(true);

    if (action === "approve") {
      const permitId = 'p_' + Date.now() + Math.random().toString(36).substr(2, 4);
      
      // 1. Buat object permit utama
      const newPermit = {
        id: permitId,
        nis: requestData.nis,
        category: requestData.category, // 'sakit' atau 'pulang'
        reason: requestData.reason,
        start_date: requestData.start_date,
        end_date: requestData.end_date,
        start_time_limit: requestData.start_time_limit,
        end_time_limit: requestData.end_time_limit,
        status_label: requestData.status_label,
        is_active: true,
        timestamp: new Date().toISOString()
      };

      // Simpan ke node permits utama
      if (window.storageManager && window.storageManager.savePermit) {
        window.storageManager.savePermit(newPermit)
          .then(() => {
            // Update lokal appState
            if (!appState.permits) appState.permits = [];
            appState.permits.push(newPermit);
            localStorage.setItem(APP_CONFIG.permitKey, JSON.stringify(appState.permits));

            // Update status pengajuan
            return window.FIREBASE_DB.ref(`permit_requests/${requestId}`).update({
              status: 'approved',
              approvedBy: musyrifName,
              approvedAt: new Date().toISOString()
            });
          })
          .then(() => {
            window.showLoading?.(false);
            window.showToast("Izin berhasil disetujui dan dicatat!", "success");
            window.refreshPermitSurfaces?.();
            
            // Render ulang modal
            currentPendingRequests = currentPendingRequests.filter(r => r.id !== requestId);
            window.updateMusyrifApprovalModalList();
          })
          .catch(err => {
            window.showLoading?.(false);
            console.error('[PermitApproval] Error approving permit:', err);
            window.showToast("Gagal menyimpan persetujuan.", "error");
          });
      } else {
        // Fallback jika storageManager error
        window.FIREBASE_DB.ref(`permits/${permitId}`).set(newPermit)
          .then(() => {
            return window.FIREBASE_DB.ref(`permit_requests/${requestId}`).update({
              status: 'approved',
              approvedBy: musyrifName,
              approvedAt: new Date().toISOString()
            });
          })
          .then(() => {
            window.showLoading?.(false);
            window.showToast("Izin berhasil disetujui!", "success");
            
            // Reload local permits dari Firebase
            if (window.storageManager?.refreshData) {
              window.storageManager.refreshData();
            } else {
              window.refreshPermitSurfaces?.();
            }

            currentPendingRequests = currentPendingRequests.filter(r => r.id !== requestId);
            window.updateMusyrifApprovalModalList();
          })
          .catch(err => {
            window.showLoading?.(false);
            console.error(err);
            window.showToast("Gagal menyetujui izin.", "error");
          });
      }
    } else if (action === "reject") {
      // Tolak pengajuan
      window.FIREBASE_DB.ref(`permit_requests/${requestId}`).update({
        status: 'rejected',
        rejectedBy: musyrifName,
        rejectedAt: new Date().toISOString()
      })
      .then(() => {
        window.showLoading?.(false);
        window.showToast("Pengajuan izin ditolak.", "info");
        
        currentPendingRequests = currentPendingRequests.filter(r => r.id !== requestId);
        window.updateMusyrifApprovalModalList();
      })
      .catch(err => {
        window.showLoading?.(false);
        console.error('[PermitApproval] Error rejecting permit:', err);
        window.showToast("Gagal menolak pengajuan.", "error");
      });
    }
  };

})();
