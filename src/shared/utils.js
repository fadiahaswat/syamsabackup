(function () {
  const DAYS_ID = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const MONTHS_SHORT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  const MONTHS_FULL_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const GRADE_THRESHOLDS = [
    { min: 97, grade: "A", predikat: "Mumtaz", meaning: "Sempurna" },
    { min: 93, grade: "A-", predikat: "Mumtaz", meaning: "Istimewa" },
    { min: 89, grade: "B+", predikat: "Jayyid Jiddan", meaning: "Baik Sekali" },
    { min: 85, grade: "B", predikat: "Jayyid Jiddan", meaning: "Baik Sekali" },
    { min: 80, grade: "B-", predikat: "Jayyid", meaning: "Baik" },
    { min: 75, grade: "C+", predikat: "Jayyid", meaning: "Baik" },
    { min: 70, grade: "C", predikat: "Maqbul", meaning: "Cukup" },
    { min: 0, grade: "D", predikat: "Maqbul", meaning: "Kurang" },
  ];

  const escapeHtml = function (str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement("div");
    div.textContent = String(str);
    return div.innerHTML;
  };

  const escapeAttr = function (str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const escapeForEventHandler = function (str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/`/g, "&#96;").replace(/\$/g, "&#36;");
  };

  const sanitizeHTML = function (str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };

  const safeJsonParse = function (str, fallback = null) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      console.warn("[SafeJsonParse] Invalid JSON, using fallback:", e.message);
      return fallback;
    }
  };

  const getLocalDateStr = function (dateObj = new Date()) {
    try {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const day = String(dateObj.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch (e) {
      console.error("Date conversion error:", e);
      return new Date().toISOString().split("T")[0];
    }
  };

  const formatDate = function (dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr + "T12:00:00");
    return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]} ${d.getFullYear()}`;
  };

  const TAHFIZH_SETORAN_KEY = "tahfizh_local_setoran";
  const normalizeTahfizhSetoran = function (entry = {}) {
    const rowNumber = entry.rowNumber || entry.RowNumber || entry.row_number || entry.id || Date.now();
    const nis = String(entry.nis || entry.Nis || entry.NIS || entry.studentId || entry.santriId || "").trim();
    const namaSantri = entry.namaSantri || entry.NamaSantri || entry.nama_santri || entry.nama || entry.Nama || "";
    const tanggal = entry.tanggal || entry.Tanggal || entry.date || entry.timestamp || entry.localCreatedAt || new Date().toISOString();
    const status = entry.status || entry.Status || "Verified";

    return {
      ...entry,
      id: entry.id || `tahfizh_${nis || "unknown"}_${rowNumber}`,
      rowNumber,
      RowNumber: rowNumber,
      nis,
      Nis: nis,
      santriId: entry.santriId || nis,
      namaSantri,
      NamaSantri: namaSantri,
      kelas: entry.kelas || entry.className || "",
      program: entry.program || "",
      jenis: entry.jenis || entry.Jenis || entry.type || "Ziyadah",
      juz: entry.juz || entry.Juz || "",
      surat: entry.surat || entry.Surat || "",
      halaman: entry.halaman || entry.Halaman || "",
      ayatMulai: Number(entry.ayatMulai || entry.ayat_mulai || entry.metadata?.ayatMulai || entry.metadata?.ayat_mulai) || null,
      ayatAkhir: Number(entry.ayatAkhir || entry.ayat_akhir || entry.metadata?.ayatAkhir || entry.metadata?.ayat_akhir) || null,
      metadata: {
        ...(entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {}),
        ayatMulai: Number(entry.ayatMulai || entry.ayat_mulai || entry.metadata?.ayatMulai || entry.metadata?.ayat_mulai) || null,
        ayatAkhir: Number(entry.ayatAkhir || entry.ayat_akhir || entry.metadata?.ayatAkhir || entry.metadata?.ayat_akhir) || null,
      },
      kualitas: entry.kualitas || entry.Kualitas || "Lancar",
      status,
      Status: status,
      tanggal,
      Tanggal: tanggal,
      source: entry.source || "local",
      localCreatedAt: entry.localCreatedAt || entry.timestamp || new Date().toISOString(),
    };
  };

  const getTahfizhSetoran = function () {
    if (typeof appState !== 'undefined' && appState.tahfizhSetoran) {
      return appState.tahfizhSetoran;
    }
    const raw = localStorage.getItem(TAHFIZH_SETORAN_KEY);
    const list = safeJsonParse(raw, []);
    return Array.isArray(list) ? list.map(normalizeTahfizhSetoran) : [];
  };

  const saveTahfizhSetoran = function (records) {
    const list = Array.isArray(records) ? records.map(normalizeTahfizhSetoran) : [];
    if (window.storageManager && typeof window.storageManager.saveTahfizhSetoran === 'function') {
      window.storageManager.saveTahfizhSetoran(list);
    } else {
      localStorage.setItem(TAHFIZH_SETORAN_KEY, JSON.stringify(list));
    }
    return list;
  };

  const addTahfizhSetoran = function (record) {
    const list = getTahfizhSetoran();
    const normalized = normalizeTahfizhSetoran(record);
    list.unshift(normalized);
    saveTahfizhSetoran(list);
    return normalized;
  };

  const getGrade = function (score) {
    const threshold = GRADE_THRESHOLDS.find((item) => score >= item.min);
    return threshold ? threshold.grade : "D";
  };

  const getPredikat = function (grade) {
    const threshold = GRADE_THRESHOLDS.find((item) => item.grade === grade);
    return threshold ? threshold.predikat : "Maqbul";
  };

  const getPredikatMeaning = function (grade) {
    const threshold = GRADE_THRESHOLDS.find((item) => item.grade === grade);
    return threshold ? threshold.meaning : "Kurang";
  };

  const deg2rad = function (deg) {
    return deg * (Math.PI / 180);
  };

  const getDistanceFromLatLonInMeters = function (lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // ============================================================
  // FORM INPUT ERROR STATE UTILITIES
  // ============================================================

  /**
   * Show error state on an input element
   * @param {string} inputId - The ID of the input element
   * @param {string} message - Error message to display
   */
  const showInputError = function (inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');

    // Find or create error message element
    const container = input.closest('div') || input.parentElement;
    let errorEl = container?.querySelector('.input-error-message');

    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'input-error-message';
      input.insertAdjacentElement('afterend', errorEl);
    }

    errorEl.textContent = message;
    errorEl.setAttribute('role', 'alert');
  };

  /**
   * Clear error state from an input element
   * @param {string} inputId - The ID of the input element
   */
  const clearInputError = function (inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.classList.remove('input-error');
    input.removeAttribute('aria-invalid');

    // Remove error message element
    const container = input.closest('div') || input.parentElement;
    const errorEl = container?.querySelector('.input-error-message');
    if (errorEl) {
      errorEl.remove();
    }
  };

  /**
   * Clear all input errors within a container
   * @param {string} containerId - The ID of the container element
   */
  const clearAllInputErrors = function (containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const errorInputs = container.querySelectorAll('.input-error');
    errorInputs.forEach(input => {
      input.classList.remove('input-error');
      input.removeAttribute('aria-invalid');
    });

    const errorMessages = container.querySelectorAll('.input-error-message');
    errorMessages.forEach(el => el.remove());
  };

  /**
   * Validate that a field has value
   * @param {string} inputId - The ID of the input element
   * @param {string} fieldName - Human-readable field name for error message
   * @returns {boolean} - True if valid
   */
  const validateRequired = function (inputId, fieldName) {
    const input = document.getElementById(inputId);
    if (!input) return true;

    const value = input.value?.trim();
    if (!value) {
      showInputError(inputId, `${fieldName} wajib diisi`);
      return false;
    }
    clearInputError(inputId);
    return true;
  };

  /**
   * Validate date is not in the future (for sick permits)
   * @param {string} inputId - The ID of the date input element
   * @param {string} errorMessage - Custom error message
   * @returns {boolean} - True if valid
   */
  const validateDateNotFuture = function (inputId, errorMessage = "Tanggal tidak boleh di masa depan") {
    const input = document.getElementById(inputId);
    if (!input || !input.value) return true;

    const today = getLocalDateStr();
    if (input.value > today) {
      showInputError(inputId, errorMessage);
      return false;
    }
    clearInputError(inputId);
    return true;
  };

  /**
   * Validate end date is after or equal to start date
   * @param {string} startInputId - Start date input ID
   * @param {string} endInputId - End date input ID
   * @returns {boolean} - True if valid
   */
  const validateDateRange = function (startInputId, endInputId) {
    const startInput = document.getElementById(startInputId);
    const endInput = document.getElementById(endInputId);
    if (!startInput || !endInput || !startInput.value || !endInput.value) return true;

    if (endInput.value < startInput.value) {
      showInputError(endInputId, "Tanggal selesai tidak boleh sebelum tanggal mulai");
      return false;
    }
    clearInputError(endInputId);
    return true;
  };

  /**
   * Show error state on a radio button group
   * @param {string} groupName - The name attribute of the radio inputs
   * @param {string} message - Error message to display
   */
  const showRadioGroupError = function (groupName, message) {
    const radios = document.querySelectorAll(`input[name="${groupName}"]`);
    if (radios.length === 0) return;

    const container = radios[0].closest('div');
    if (container) {
      container.classList.add('radio-group-error');
      let errorEl = container.querySelector('.input-error-message');
      if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.className = 'input-error-message';
        container.appendChild(errorEl);
      }
      errorEl.textContent = message;
      errorEl.setAttribute('role', 'alert');
    }
  };

  /**
   * Clear error state from a radio button group
   * @param {string} groupName - The name attribute of the radio inputs
   */
  const clearRadioGroupError = function (groupName) {
    const radios = document.querySelectorAll(`input[name="${groupName}"]`);
    if (radios.length === 0) return;

    const container = radios[0].closest('div');
    if (container) {
      container.classList.remove('radio-group-error');
      const errorEl = container.querySelector('.input-error-message');
      if (errorEl) errorEl.remove();
    }
  };

  window.SharedUtils = {
    DAYS_ID,
    MONTHS_SHORT_ID,
    MONTHS_FULL_ID,
    escapeHtml,
    escapeAttr,
    escapeForEventHandler,
    sanitizeHTML,
    safeJsonParse,
    TAHFIZH_SETORAN_KEY,
    normalizeTahfizhSetoran,
    getTahfizhSetoran,
    saveTahfizhSetoran,
    addTahfizhSetoran,
    getLocalDateStr,
    formatDate,
    getGrade,
    getPredikat,
    getPredikatMeaning,
    deg2rad,
    getDistanceFromLatLonInMeters,
    showInputError,
    clearInputError,
    clearAllInputErrors,
    validateRequired,
    validateDateNotFuture,
    validateDateRange,
    showRadioGroupError,
    clearRadioGroupError,
  };

  window.DAYS_ID = window.DAYS_ID || DAYS_ID;
  window.MONTHS_ID = window.MONTHS_ID || MONTHS_SHORT_ID;
  window.MONTHS_FULL_ID = window.MONTHS_FULL_ID || MONTHS_FULL_ID;
  window.escapeHtml = window.escapeHtml || escapeHtml;
  window.escapeAttr = window.escapeAttr || escapeAttr;
  window.escapeForEventHandler = window.escapeForEventHandler || escapeForEventHandler;
  window.sanitizeHTML = window.sanitizeHTML || sanitizeHTML;
  window.safeJsonParse = window.safeJsonParse || safeJsonParse;
  window.TAHFIZH_SETORAN_KEY = window.TAHFIZH_SETORAN_KEY || TAHFIZH_SETORAN_KEY;
  window.normalizeTahfizhSetoran = window.normalizeTahfizhSetoran || normalizeTahfizhSetoran;
  window.getTahfizhSetoran = getTahfizhSetoran;
  window.saveTahfizhSetoran = saveTahfizhSetoran;
  window.addTahfizhSetoran = addTahfizhSetoran;
  window.getLocalDateStr = window.getLocalDateStr || getLocalDateStr;
  window.formatDate = window.formatDate || formatDate;
  window.getGrade = window.getGrade || getGrade;
  window.getPredikat = window.getPredikat || getPredikat;
  window.getPredikatMeaning = window.getPredikatMeaning || getPredikatMeaning;
  window.deg2rad = window.deg2rad || deg2rad;
  window.getDistanceFromLatLonInMeters =
    window.getDistanceFromLatLonInMeters || getDistanceFromLatLonInMeters;

  // Form validation utilities exposed to window
  window.showInputError = window.showInputError || showInputError;
  window.clearInputError = window.clearInputError || clearInputError;
  window.clearAllInputErrors = window.clearAllInputErrors || clearAllInputErrors;
  window.validateRequired = window.validateRequired || validateRequired;
  window.validateDateNotFuture = window.validateDateNotFuture || validateDateNotFuture;
  window.validateDateRange = window.validateDateRange || validateDateRange;
  window.showRadioGroupError = window.showRadioGroupError || showRadioGroupError;
  window.clearRadioGroupError = window.clearRadioGroupError || clearRadioGroupError;
})();
