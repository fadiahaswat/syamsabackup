// File: export-manager.js

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

window.exportToPDF = function() {
  if (!appState.selectedClass || FILTERED_SANTRI.length === 0) {
    return window.showToast("Pilih kelas terlebih dahulu", "warning");
  }

  const dateKey = appState.date;
  const data = appState.attendanceData[dateKey];

  if (!data) {
    return window.showToast("Tidak ada data untuk tanggal ini", "warning");
  }
  
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return window.showToast("Gagal membuka jendela cetak. Pastikan pop-up diizinkan.", "error");
  }
  
  // Calculate stats for this date
  let totalHadir = 0;
  let totalTelat = 0;
  let totalSakit = 0;
  let totalIzin = 0;
  let totalPulang = 0;
  let totalAlpa = 0;
  let totalRequiredStatus = 0;

  const tableRows = FILTERED_SANTRI.map((s, idx) => {
    const id = String(s.nis || s.id);
    const statuses = Object.values(SLOT_WAKTU).map(slot => {
      const mainActId = slot.activities[0]?.id || "shalat";
      const isActiveSlot = !window.isSlotHoliday(slot.id, dateKey);
      const status = isActiveSlot
        ? data[slot.id]?.[id]?.status?.[mainActId] || "-"
        : "Libur";

      if (isActiveSlot) {
        totalRequiredStatus++;
        if (status === "Hadir" || status === "Ya") totalHadir++;
        else if (status === "Telat") totalTelat++;
        else if (status === "Sakit") totalSakit++;
        else if (status === "Izin") totalIzin++;
        else if (status === "Pulang") totalPulang++;
        else if (status === "Alpa") totalAlpa++;
      }

      return `
        <td class="px-3 py-2 text-center border border-slate-350">
          <span class="font-bold text-xs">${status}</span>
        </td>
      `;
    }).join("");
    
    return `
      <tr class="border-b border-slate-300">
        <td class="px-3 py-2 text-center border border-slate-350">${idx + 1}</td>
        <td class="px-3 py-2 border border-slate-350 font-bold">${s.nama}</td>
        <td class="px-3 py-2 text-center border border-slate-350">${s.nis}</td>
        ${statuses}
      </tr>
    `;
  }).join("");

  const headerSlots = Object.values(SLOT_WAKTU).map(slot => `
    <th class="px-3 py-2 text-center border border-slate-350 text-xs font-black uppercase bg-slate-100">${slot.label}</th>
  `).join("");
  
  const pctHadir = totalRequiredStatus > 0 ? Math.round((totalHadir / totalRequiredStatus) * 100) : 0;
  const actorName = window.getCurrentActorName
    ? window.getCurrentActorName()
    : "Musyrif Kelas";

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>Laporan Kehadiran Kelas ${appState.selectedClass} - ${dateKey}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;900&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .tabular-nums { font-family: 'DM Mono', monospace; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body class="bg-white text-slate-900 p-8">
      <div class="max-w-4xl mx-auto border border-slate-300 p-8 rounded-3xl shadow-sm bg-white">
        <div class="flex items-center justify-between border-b-4 border-slate-900 pb-4 mb-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white font-black text-2xl shadow-md">
              M
            </div>
            <div>
              <h1 class="text-2xl font-black tracking-tight leading-none">MA'HAD AL-QUR'AN TAHFIZH</h1>
              <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Sistem Administrasi Kedisiplinan & Presensi</p>
            </div>
          </div>
          <div class="text-right text-xs text-slate-500 font-bold">
            <p>Yogyakarta, Indonesia</p>
            <p class="mt-1 text-slate-800">Tanggal: ${window.formatDate(dateKey)}</p>
          </div>
        </div>

        <div class="text-center mb-6">
          <h2 class="text-xl font-black uppercase tracking-wider text-slate-800">Laporan Presensi Santri Harian</h2>
          <p class="text-sm font-bold text-slate-550 mt-1">Kelas Binaan: ${appState.selectedClass} | Musyrif: ${actorName}</p>
        </div>

        <div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6 text-center">
          <div class="bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
            <span class="block text-[9px] font-bold text-emerald-500 tracking-wider">Hadir</span>
            <span class="text-lg font-black text-emerald-600">${totalHadir}</span>
          </div>
          <div class="bg-cyan-50 border border-cyan-200 p-2 rounded-xl">
            <span class="block text-[9px] font-bold text-cyan-500 tracking-wider">Telat</span>
            <span class="text-lg font-black text-cyan-600">${totalTelat}</span>
          </div>
          <div class="bg-blue-50 border border-blue-200 p-2 rounded-xl">
            <span class="block text-[9px] font-bold text-blue-500 tracking-wider">Izin</span>
            <span class="text-lg font-black text-blue-600">${totalIzin}</span>
          </div>
          <div class="bg-purple-50 border border-purple-200 p-2 rounded-xl">
            <span class="block text-[9px] font-bold text-purple-500 tracking-wider">Pulang</span>
            <span class="text-lg font-black text-purple-600">${totalPulang}</span>
          </div>
          <div class="bg-amber-50 border border-amber-200 p-2 rounded-xl">
            <span class="block text-[9px] font-bold text-amber-500 tracking-wider">Sakit</span>
            <span class="text-lg font-black text-amber-600">${totalSakit}</span>
          </div>
          <div class="bg-red-50 border border-red-200 p-2 rounded-xl">
            <span class="block text-[9px] font-bold text-red-500 tracking-wider">Alpa</span>
            <span class="text-lg font-black text-red-600">${totalAlpa}</span>
          </div>
        </div>
        <div class="bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center mb-6">
          <span class="block text-[10px] font-bold text-slate-400 tracking-wider">Persentase Kehadiran (Hadir + Telat)</span>
          <span class="text-2xl font-black text-indigo-600">${pctHadir}%</span>
        </div>

        <div class="overflow-x-auto mb-8">
          <table class="w-full text-left border-collapse border border-slate-350">
            <thead>
              <tr class="bg-slate-100 border-b border-slate-350">
                <th class="px-3 py-2 text-center border border-slate-350 text-xs font-black uppercase bg-slate-100">No</th>
                <th class="px-3 py-2 border border-slate-350 text-xs font-black uppercase bg-slate-100">Nama Santri</th>
                <th class="px-3 py-2 text-center border border-slate-350 text-xs font-black uppercase bg-slate-100">NIS</th>
                ${headerSlots}
              </tr>
            </thead>
            <tbody class="text-xs divide-y divide-slate-350">
              ${tableRows}
            </tbody>
          </table>
        </div>

        <div class="flex justify-between items-end mt-12 pt-8 border-t border-dashed border-slate-300">
          <div>
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Diverifikasi Oleh</p>
            <div class="h-16"></div>
            <p class="text-sm font-black border-t border-slate-900 pt-1 mt-1">Pamong Asrama Mahad</p>
          </div>
          <div class="text-right">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dibuat Oleh</p>
            <div class="h-16"></div>
            <p class="text-sm font-black border-t border-slate-900 pt-1 mt-1">${actorName}</p>
          </div>
        </div>

        <div class="no-print mt-8 flex justify-center gap-4">
          <button onclick="window.print()" class="px-6 py-3 bg-indigo-650 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-colors">
            Cetak Laporan
          </button>
          <button onclick="window.close()" class="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-205 transition-colors">
            Tutup Halaman
          </button>
        </div>
      </div>
    </body>
    </html>
  `;
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  window.showToast("Print preview berhasil dibuka", "success");
  window.logActivity("Export PDF", `Mencetak rekap presensi kelas ${appState.selectedClass}`);
};
