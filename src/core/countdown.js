/**
 * Countdown Timer Module
 * Handles the libur (holiday) countdown widget
 */

// Target: Libur Akhir Tahun - 27 Juni 2026, 12:30
const LIBUR_TARGET_DATE = new Date('2026-06-27T12:30:00').getTime();

function updateCountdown() {
  const now = new Date().getTime();
  const distance = LIBUR_TARGET_DATE - now;

  if (distance < 0) {
    document.getElementById('countdown-days').textContent = '00';
    document.getElementById('countdown-hours').textContent = '00';
    document.getElementById('countdown-minutes').textContent = '00';
    document.getElementById('countdown-seconds').textContent = '00';
    return;
  }

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);
  const pad = (n) => n.toString().padStart(2, '0');

  document.getElementById('countdown-days').textContent = pad(days);
  document.getElementById('countdown-hours').textContent = pad(hours);
  document.getElementById('countdown-minutes').textContent = pad(minutes);
  document.getElementById('countdown-seconds').textContent = pad(seconds);
}

function updateCountdownVisibility() {
  const widget = document.getElementById('countdown-libur-widget');
  const isAdmin = document.body.classList.contains('admin-mode');
  const isWali = document.body.classList.contains('wali-mode');
  const isMusyrif = !isAdmin && !isWali;
  // Widget hanya tampil untuk wali; sembunyikan untuk admin & musyrif
  if (widget) widget.classList.toggle('hidden', isAdmin || isMusyrif);
}

// Initialize countdown
function initCountdown() {
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
