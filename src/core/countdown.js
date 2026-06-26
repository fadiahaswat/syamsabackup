/**
 * Countdown Timer Module
 * Handles the locally configured holiday countdown widget.
 */

const HOLIDAY_COUNTDOWN_STORAGE_KEY = 'syamsa_holiday_countdown_schedule_v1';
let holidayCountdownEditMode = false;

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

  if (Number.isFinite(perpulanganAt) && now < perpulanganAt) {
    return {
      title: "Menuju Perpulangan 'Libur Kenaikan Kelas'",
      targetAt: perpulanganAt,
      phase: 'perpulangan'
    };
  }

  if (Number.isFinite(balikPondokAt) && now < balikPondokAt) {
    return {
      title: 'Balik Pondok',
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

function hasHolidaySchedule(schedule = getHolidaySchedule()) {
  return Boolean(schedule.perpulanganAt && schedule.balikPondokAt);
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
  if (widget) widget.classList.toggle('hidden', isAdmin || !activeCountdown);
}

function loadHolidayCountdownForm() {
  const schedule = getHolidaySchedule();
  const perpulanganInput = document.getElementById('holiday-return-home-input');
  const balikPondokInput = document.getElementById('holiday-return-pondok-input');
  if (perpulanganInput) perpulanganInput.value = schedule.perpulanganAt || '';
  if (balikPondokInput) balikPondokInput.value = schedule.balikPondokAt || '';
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
  const perpulanganInput = document.getElementById('holiday-return-home-input');
  const balikPondokInput = document.getElementById('holiday-return-pondok-input');

  if (statusBadge) {
    statusBadge.textContent = !hasSchedule ? 'Belum Aktif' : activeCountdown ? 'Aktif' : 'Selesai';
    statusBadge.className = activeCountdown
      ? 'shrink-0 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[9px] font-black text-emerald-600 dark:text-emerald-300 uppercase tracking-wider'
      : 'shrink-0 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-900/60 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider';
  }

  if (summary) summary.classList.toggle('hidden', !hasSchedule);
  if (summaryTitle && hasSchedule) {
    summaryTitle.textContent = activeCountdown ? activeCountdown.title : 'Rentang perpulangan selesai';
  }
  if (summaryMeta && hasSchedule) {
    summaryMeta.textContent = `${formatHolidayDateTime(schedule.perpulanganAt)} - ${formatHolidayDateTime(schedule.balikPondokAt)}`;
  }

  if (perpulanganInput) perpulanganInput.disabled = hasSchedule && !holidayCountdownEditMode;
  if (balikPondokInput) balikPondokInput.disabled = hasSchedule && !holidayCountdownEditMode;
  [perpulanganInput, balikPondokInput].forEach((input) => {
    if (!input) return;
    input.classList.toggle('opacity-70', input.disabled);
    input.classList.toggle('cursor-not-allowed', input.disabled);
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
  const perpulanganAt = document.getElementById('holiday-return-home-input')?.value || '';
  const balikPondokAt = document.getElementById('holiday-return-pondok-input')?.value || '';

  if (!perpulanganAt || !balikPondokAt) {
    window.showToast?.('Lengkapi mulai perpulangan dan batas balik pondok.', 'warning');
    return;
  }

  if (new Date(balikPondokAt).getTime() <= new Date(perpulanganAt).getTime()) {
    window.showToast?.('Batas balik pondok harus setelah mulai perpulangan.', 'warning');
    return;
  }

  localStorage.setItem(HOLIDAY_COUNTDOWN_STORAGE_KEY, JSON.stringify({ perpulanganAt, balikPondokAt }));
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
