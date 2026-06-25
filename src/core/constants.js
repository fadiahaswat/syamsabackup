// File: constants.js
// SHARED CONSTANTS - Single Source of Truth
// Menghindari duplicate definitions di multiple files

// ==========================================
// DATE & TIME CONSTANTS
// ==========================================

// Nama hari lengkap (ISO format - Ahad adalah Minggu)
const DAYS_FULL = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// Nama hari singkat
const DAYS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Ahd"];

// Nama hari untuk permit/form (Indonesian Sunday-first)
const DAYS_INDO = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// Nama bulan lengkap
const MONTHS_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Nama bulan singkat
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

// ==========================================
// TIME CALCULATION CONSTANTS
// ==========================================

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// ==========================================
// ATTENDANCE STATUS CONSTANTS
// ==========================================

const STATUS_HADIR = "Hadir";
const STATUS_ALPA = "Alpa";
const STATUS_SAKIT = "Sakit";
const STATUS_IZIN = "Izin";
const STATUS_TELAT = "Telat";
const STATUS_PULANG = "Pulang";

// ==========================================
// PERMIT CATEGORY CONSTANTS
// ==========================================

const PERMIT_CATEGORY_SAKIT = "sakit";
const PERMIT_CATEGORY_IZIN = "izin";
const PERMIT_CATEGORY_KHITAN = "khitan";
const PERMIT_CATEGORY_WALI = "wali";

// ==========================================
// EXPORT KE GLOBAL SCOPE
// ==========================================

window.SHARED_CONSTANTS = {
  DAYS_FULL,
  DAYS_SHORT,
  DAYS_INDO,
  MONTHS_FULL,
  MONTHS_SHORT,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  STATUS_HADIR,
  STATUS_ALPA,
  STATUS_SAKIT,
  STATUS_IZIN,
  STATUS_TELAT,
  STATUS_PULANG,
  PERMIT_CATEGORY_SAKIT,
  PERMIT_CATEGORY_IZIN,
  PERMIT_CATEGORY_KHITAN,
  PERMIT_CATEGORY_WALI,
};
