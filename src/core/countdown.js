/**
 * Countdown Timer Module
 * Handles the locally configured holiday countdown widget.
 */

const HOLIDAY_COUNTDOWN_STORAGE_KEY = 'syamsa_holiday_countdown_schedule_v1';
let holidayCountdownEditMode = false;
const DEFAULT_HOLIDAY_NAME = 'Libur Kenaikan Kelas';

function getHolidaySchedule() {
  try {
    return JSON.parse(localStorage.getItem(HOLIDAY_COUNTDOWN_STORAGE_KEY) || '{}');
  } catch (error) {
    return {};
  }
}

function getActiveHolidayCountdown(schedule = getHolidaySchedule()) {
  const now = Date.now();
  const perpulanganAt = schedule.perpulanganAt ? new Date(schedule.perpulanganAt).getTime() : NaN;
  const balikPondokAt = schedule.balikPondokAt ? new Date(schedule.balikPondokAt).getTime() : NaN;
  const holidayName = schedule.holidayName || DEFAULT_HOLIDAY_NAME;

  if (Number.isFinite(perpulanganAt) && now < perpulanganAt) {
    return {
      title: `Menuju Perpulangan '${holidayName}'`,
      targetAt: perpulanganAt,
      phase: 'perpulangan'
    };
  }

  if (Number.isFinite(balikPondokAt) && now < balikPondokAt) {
    return {
      title: `Balik Pondok '${holidayName}'`,
      targetAt: balikPondokAt,
      phase: 'balik-pondok'
    };
  }

  return null;
}

function formatHolidayDate(targetAt) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(targetAt));
}

function formatHolidayTime(targetAt) {
  return `${new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(targetAt))} WIB`;
}

function formatHolidayDateTime(value) {
  const targetAt = new Date(value).getTime();
  if (!Number.isFinite(targetAt)) return '-';
  return `${formatHolidayDate(targetAt)}, ${formatHolidayTime(targetAt)}`;
}

function formatHolidayDateValue(value) {
  if (!value) return 'Pilih tanggal';
  const targetAt = new Date(`${value}T00:00:00`).getTime();
  if (!Number.isFinite(targetAt)) return 'Pilih tanggal';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(targetAt));
}

function formatHolidayTimeValue(value) {
  return value ? `${value} WIB` : 'Pilih jam';
}

function hasHolidaySchedule(schedule = getHolidaySchedule()) {
  return Boolean(schedule.perpulanganAt && schedule.balikPondokAt);
}

function splitDateTime(value) {
  if (!value) return { date: '', time: '' };
  const [date = '', time = ''] = String(value).split('T');
  return { date, time: time.slice(0, 5) };
}

function combineDateTime(date, time) {
  if (!date || !time) return '';
  return `${date}T${time}`;
}

function getHolidayFormInputs() {
  return [
    document.getElementById('holiday-name-input'),
    document.getElementById('holiday-return-home-date-input'),
    document.getElementById('holiday-return-home-time-input'),
    document.getElementById('holiday-return-pondok-date-input'),
    document.getElementById('holiday-return-pondok-time-input')
  ].filter(Boolean);
}

function setCountdownDigits(days = 0, hours = 0, minutes = 0, seconds = 0) {
  const pad = (n) => n.toString().padStart(2, '0');
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = pad(value);
  };

  setText('countdown-days', days);
  setText('countdown-hours', hours);
  setText('countdown-minutes', minutes);
  setText('countdown-seconds', seconds);
}

function updateCountdown() {
  const activeCountdown = getActiveHolidayCountdown();
  renderHolidayCountdownManager();
  updateCountdownVisibility(activeCountdown);

  if (!activeCountdown) {
    setCountdownDigits();
    return;
  }

  const titleEl = document.getElementById('countdown-title');
  const dateEl = document.getElementById('countdown-date-label');
  const timeEl = document.getElementById('countdown-time-label');
  if (titleEl) titleEl.textContent = activeCountdown.title;
  if (dateEl) dateEl.textContent = formatHolidayDate(activeCountdown.targetAt);
  if (timeEl) timeEl.textContent = formatHolidayTime(activeCountdown.targetAt);

  const distance = activeCountdown.targetAt - Date.now();

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  setCountdownDigits(days, hours, minutes, seconds);
}

function updateCountdownVisibility(activeCountdown = getActiveHolidayCountdown()) {
  const widget = document.getElementById('countdown-libur-widget');
  const isAdmin = document.body.classList.contains('admin-mode');
  const isWali = document.body.classList.contains('wali-mode');
  if (widget) widget.classList.toggle('hidden', isAdmin || !isWali || !activeCountdown);
}

function loadHolidayCountdownForm() {
  const schedule = getHolidaySchedule();
  const holidayNameInput = document.getElementById('holiday-name-input');
  const perpulanganDateInput = document.getElementById('holiday-return-home-date-input');
  const perpulanganTimeInput = document.getElementById('holiday-return-home-time-input');
  const balikPondokDateInput = document.getElementById('holiday-return-pondok-date-input');
  const balikPondokTimeInput = document.getElementById('holiday-return-pondok-time-input');
  const perpulangan = splitDateTime(schedule.perpulanganAt);
  const balikPondok = splitDateTime(schedule.balikPondokAt);

  if (holidayNameInput) holidayNameInput.value = schedule.holidayName || DEFAULT_HOLIDAY_NAME;
  if (perpulanganDateInput) perpulanganDateInput.value = perpulangan.date;
  if (perpulanganTimeInput) perpulanganTimeInput.value = perpulangan.time;
  if (balikPondokDateInput) balikPondokDateInput.value = balikPondok.date;
  if (balikPondokTimeInput) balikPondokTimeInput.value = balikPondok.time;
  holidayCountdownEditMode = !hasHolidaySchedule(schedule);
  renderHolidayCountdownManager(schedule);
}

function renderHolidayCountdownManager(schedule = getHolidaySchedule()) {
  const hasSchedule = hasHolidaySchedule(schedule);
  const activeCountdown = getActiveHolidayCountdown(schedule);
  const statusBadge = document.getElementById('holiday-countdown-status-badge');
  const summary = document.getElementById('holiday-countdown-summary');
  const summaryTitle = document.getElementById('holiday-countdown-summary-title');
  const summaryMeta = document.getElementById('holiday-countdown-summary-meta');
  const saveBtn = document.getElementById('holiday-countdown-save-btn');
  const saveLabel = document.getElementById('holiday-countdown-save-label');
  const cancelBtn = document.getElementById('holiday-countdown-cancel-btn');
  const formInputs = getHolidayFormInputs();
  const labelMap = [
    ['holiday-return-home-date-label', 'holiday-return-home-date-input', formatHolidayDateValue],
    ['holiday-return-home-time-label', 'holiday-return-home-time-input', formatHolidayTimeValue],
    ['holiday-return-pondok-date-label', 'holiday-return-pondok-date-input', formatHolidayDateValue],
    ['holiday-return-pondok-time-label', 'holiday-return-pondok-time-input', formatHolidayTimeValue]
  ];

  if (statusBadge) {
    statusBadge.textContent = !hasSchedule ? 'Belum Aktif' : activeCountdown ? 'Aktif' : 'Selesai';
    statusBadge.className = activeCountdown
      ? 'shrink-0 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[9px] font-black text-emerald-600 dark:text-emerald-300 uppercase tracking-wider'
      : 'shrink-0 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900/60 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider';
  }

  if (summary) summary.classList.toggle('hidden', !hasSchedule);
  if (summaryTitle && hasSchedule) {
    summaryTitle.textContent = activeCountdown ? activeCountdown.title : `${schedule.holidayName || DEFAULT_HOLIDAY_NAME} selesai`;
  }
  if (summaryMeta && hasSchedule) {
    summaryMeta.textContent = `${formatHolidayDateTime(schedule.perpulanganAt)} - ${formatHolidayDateTime(schedule.balikPondokAt)}`;
  }

  formInputs.forEach((input) => {
    input.disabled = hasSchedule && !holidayCountdownEditMode;
    if (!input) return;
    input.classList.toggle('opacity-70', input.disabled);
    input.classList.toggle('cursor-not-allowed', input.disabled);
  });

  labelMap.forEach(([labelId, inputId, formatter]) => {
    const label = document.getElementById(labelId);
    const input = document.getElementById(inputId);
    if (label && input) label.textContent = formatter(input.value);
  });

  if (saveLabel) saveLabel.textContent = hasSchedule ? 'Update Rentang Libur' : 'Simpan Rentang Libur';
  if (saveBtn) {
    saveBtn.disabled = hasSchedule && !holidayCountdownEditMode;
    saveBtn.classList.toggle('opacity-60', saveBtn.disabled);
    saveBtn.classList.toggle('cursor-not-allowed', saveBtn.disabled);
  }
  if (cancelBtn) {
    cancelBtn.classList.toggle('hidden', !hasSchedule || !holidayCountdownEditMode);
    cancelBtn.classList.toggle('flex', hasSchedule && holidayCountdownEditMode);
  }
}

// Initialize countdown
function initCountdown() {
  loadHolidayCountdownForm();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  updateCountdownVisibility();
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCountdown);
} else {
  initCountdown();
}

// Export to window for external access
window.refreshCountdownVisibility = updateCountdownVisibility;
window.loadHolidayCountdownForm = loadHolidayCountdownForm;
window.saveHolidayCountdownSchedule = function () {
  const holidayName = (document.getElementById('holiday-name-input')?.value || DEFAULT_HOLIDAY_NAME).trim() || DEFAULT_HOLIDAY_NAME;
  const perpulanganAt = combineDateTime(
    document.getElementById('holiday-return-home-date-input')?.value || '',
    document.getElementById('holiday-return-home-time-input')?.value || ''
  );
  const balikPondokAt = combineDateTime(
    document.getElementById('holiday-return-pondok-date-input')?.value || '',
    document.getElementById('holiday-return-pondok-time-input')?.value || ''
  );

  if (!perpulanganAt || !balikPondokAt) {
    window.showToast?.('Lengkapi tanggal dan jam pulang serta balik pondok.', 'warning');
    return;
  }

  if (new Date(balikPondokAt).getTime() <= new Date(perpulanganAt).getTime()) {
    window.showToast?.('Batas balik pondok harus setelah mulai perpulangan.', 'warning');
    return;
  }

  localStorage.setItem(HOLIDAY_COUNTDOWN_STORAGE_KEY, JSON.stringify({ holidayName, perpulanganAt, balikPondokAt }));
  holidayCountdownEditMode = false;
  renderHolidayCountdownManager();
  updateCountdown();
  window.showToast?.('Rentang libur tersimpan.', 'success');
};
window.resetHolidayCountdownSchedule = function () {
  localStorage.removeItem(HOLIDAY_COUNTDOWN_STORAGE_KEY);
  holidayCountdownEditMode = true;
  loadHolidayCountdownForm();
  updateCountdown();
  window.showToast?.('Rentang libur dihapus.', 'info');
};
window.editHolidayCountdownSchedule = function () {
  holidayCountdownEditMode = true;
  renderHolidayCountdownManager();
};
window.cancelHolidayCountdownEdit = function () {
  holidayCountdownEditMode = false;
  loadHolidayCountdownForm();
};
window.renderHolidayCountdownManager = renderHolidayCountdownManager;
window.openHolidayPicker = function (inputId) {
  const input = document.getElementById(inputId);
  if (!input || input.disabled) return;
  if (typeof input.showPicker === 'function') {
    input.showPicker();
  } else {
    input.focus();
    input.click();
  }
};
