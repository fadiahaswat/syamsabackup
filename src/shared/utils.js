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

  window.SharedUtils = {
    DAYS_ID,
    MONTHS_SHORT_ID,
    MONTHS_FULL_ID,
    escapeHtml,
    escapeAttr,
    escapeForEventHandler,
    sanitizeHTML,
    safeJsonParse,
    getLocalDateStr,
    formatDate,
    getGrade,
    getPredikat,
    getPredikatMeaning,
    deg2rad,
    getDistanceFromLatLonInMeters,
  };

  window.DAYS_ID = window.DAYS_ID || DAYS_ID;
  window.MONTHS_ID = window.MONTHS_ID || MONTHS_SHORT_ID;
  window.MONTHS_FULL_ID = window.MONTHS_FULL_ID || MONTHS_FULL_ID;
  window.escapeHtml = window.escapeHtml || escapeHtml;
  window.escapeAttr = window.escapeAttr || escapeAttr;
  window.escapeForEventHandler = window.escapeForEventHandler || escapeForEventHandler;
  window.sanitizeHTML = window.sanitizeHTML || sanitizeHTML;
  window.safeJsonParse = window.safeJsonParse || safeJsonParse;
  window.getLocalDateStr = window.getLocalDateStr || getLocalDateStr;
  window.formatDate = window.formatDate || formatDate;
  window.getGrade = window.getGrade || getGrade;
  window.getPredikat = window.getPredikat || getPredikat;
  window.getPredikatMeaning = window.getPredikatMeaning || getPredikatMeaning;
  window.deg2rad = window.deg2rad || deg2rad;
  window.getDistanceFromLatLonInMeters =
    window.getDistanceFromLatLonInMeters || getDistanceFromLatLonInMeters;
})();
