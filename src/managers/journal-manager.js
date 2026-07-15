/**
 * JournalManager - Business Logic for Musyrif Daily Journal
 * Handles IndexedDB operations, task prepopulation, and DeviceMotion API step counting.
 */

class JournalManager {
  constructor() {
    this._db = null;
    this._repos = null;
    this._stepListener = null;
    this._logger = window.Logger || console;

    // Daily tasks configuration
    this.defaultTasks = [
      { taskId: 'tahajjud_subuh', taskName: 'Membangunkan Tahajjud & Subuh', timeWindow: '04:00 - 05:15' },
      { taskId: 'sekolah', taskName: 'Ngoprak-ngoprak Berangkat Sekolah', timeWindow: '06:15 - 07:15' },
      { taskId: 'ashar', taskName: 'Ngoprak-ngoprak Berangkat Ashar', timeWindow: '15:00 - 15:45' },
      { taskId: 'mandi', taskName: 'Ngoprak-ngoprak Mandi Sore', timeWindow: '17:00 - 17:45' },
      { taskId: 'sebelum_magrib', taskName: 'Mengecek Kamar Sebelum Magrib', timeWindow: '17:45 - 18:15' },
      { taskId: 'malam', taskName: 'Mengecek Kamar Malam (Jam Tidur)', timeWindow: '21:00 - 22:00' }
    ];

    // Device motion state
    this.isTracking = false;
    this.stepCount = 0;
  }

  /**
   * Initialize manager
   */
  async init(db, repositories) {
    this._db = db;
    this._repos = repositories;
    this._logger.info('[JournalManager] Initialized');
  }

  /**
   * Get unique Musyrif identifier
   */
  getMusyrifId() {
    if (typeof appState === 'undefined') return 'unknown_musyrif';
    return appState.userProfile?.email || appState.selectedClass || 'unknown_musyrif';
  }

  /**
   * Get Musyrif display name
   */
  getMusyrifName() {
    if (typeof appState === 'undefined') return 'Musyrif';
    return appState.userProfile?.name || appState.selectedClass || 'Musyrif';
  }

  /**
   * Get journal entries for a specific date. Prepopulates if date is today and no records exist.
   * @param {string} date - Date string YYYY-MM-DD
   */
  async getJournalForDate(date) {
    if (!this._repos?.journal) {
      this._logger.warn('[JournalManager] Repositories not ready');
      return [];
    }

    const musyrifId = this.getMusyrifId();
    let records = await this._repos.journal.getByDateMusyrif(date, musyrifId);

    // If it is today and records are empty, prepopulate them
    const today = this._getLocalDateStr();
    if (records.length === 0 && date === today) {
      const prepopulated = [];
      const musyrifName = this.getMusyrifName();

      for (const task of this.defaultTasks) {
        const id = `jr_${date}_${task.taskId}_${musyrifId}`;
        const record = {
          id,
          date,
          taskId: task.taskId,
          taskName: task.taskName,
          timeWindow: task.timeWindow,
          status: 'pending',
          verifiedAt: null,
          stepsCount: 0,
          musyrifId,
          musyrifName
        };
        await this._repos.journal.put(record);
        prepopulated.push(record);
      }
      records = prepopulated;
      this._logger.info(`[JournalManager] Prepopulated ${records.length} tasks for date ${date}`);
    }

    // Sort based on defaultTasks order
    const orderMap = this.defaultTasks.reduce((acc, t, idx) => {
      acc[t.taskId] = idx;
      return acc;
    }, {});

    return records.sort((a, b) => (orderMap[a.taskId] ?? 99) - (orderMap[b.taskId] ?? 99));
  }

  /**
   * Get all journal entries for a date (used by Admin)
   * @param {string} date - Date string YYYY-MM-DD
   */
  async getAdminReportForDate(date) {
    if (!this._repos?.journal) return [];
    return this._repos.journal.getByDate(date);
  }

  /**
   * Start tracking motion steps
   * @param {string} date - Journal date
   * @param {string} taskId - Task identifier
   * @param {Function} onStepCallback - Triggered on step count update
   * @param {Function} onCompleteCallback - Triggered on completion (50 steps)
   * @param {Function} onErrorCallback - Triggered if permission is denied or not supported
   */
  async startStepTracking(date, taskId, onStepCallback, onCompleteCallback, onErrorCallback) {
    if (this.isTracking) {
      this.stopStepTracking();
    }

    this.stepCount = 0;
    this.isTracking = true;

    // Check device support
    if (!window.DeviceMotionEvent) {
      this.isTracking = false;
      if (onErrorCallback) onErrorCallback('Sensor gerak tidak didukung di perangkat ini.');
      return;
    }

    const startListener = () => {
      let lastMag = 0;
      let lastStepTime = 0;
      const peakThreshold = 11.5; // gravity is ~9.8, step adds spike

      this._stepListener = (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc) return;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;
        
        // Calculate magnitude
        const mag = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        // Simple peak detector with 350ms debounce
        if (mag > peakThreshold && (now - lastStepTime > 350)) {
          // Check for change in magnitude to avoid continuous trigger
          if (Math.abs(mag - lastMag) > 1.5) {
            this.stepCount++;
            lastStepTime = now;
            
            if (onStepCallback) onStepCallback(this.stepCount);

            if (this.stepCount >= 50) {
              this._logger.info('[JournalManager] Verification goal reached: 50 steps');
              this.stopStepTracking();
              this._verifyTask(date, taskId)
                .then(onCompleteCallback)
                .catch(err => {
                  if (onErrorCallback) onErrorCallback(err.message);
                });
            }
          }
        }
        lastMag = mag;
      };

      window.addEventListener('devicemotion', this._stepListener, true);
      this._logger.info('[JournalManager] DeviceMotion listener active');
    };

    // iOS 13+ permission request
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceMotionEvent.requestPermission();
        if (permissionState === 'granted') {
          startListener();
        } else {
          this.isTracking = false;
          if (onErrorCallback) onErrorCallback('Izin sensor gerak ditolak.');
        }
      } catch (error) {
        this.isTracking = false;
        this._logger.error('[JournalManager] iOS Permission error:', error);
        if (onErrorCallback) onErrorCallback('Gagal meminta izin sensor gerak.');
      }
    } else {
      // Android / Older browsers
      startListener();
    }
  }

  /**
   * Stop tracking motion steps
   */
  stopStepTracking() {
    this.isTracking = false;
    if (this._stepListener) {
      window.removeEventListener('devicemotion', this._stepListener, true);
      this._stepListener = null;
      this._logger.info('[JournalManager] DeviceMotion listener stopped');
    }
  }

  /**
   * Mark task as completed in DB
   * @private
   */
  async _verifyTask(date, taskId) {
    if (!this._repos?.journal) {
      throw new Error('Repository tidak siap');
    }

    const musyrifId = this.getMusyrifId();
    const task = await this._repos.journal.get(date, taskId, musyrifId);

    if (!task) {
      throw new Error('Tugas tidak ditemukan');
    }

    task.status = 'completed';
    task.verifiedAt = new Date().toISOString();
    task.stepsCount = this.stepCount;

    await this._repos.journal.put(task);

    // Audit log
    if (typeof window.logActivity === 'function') {
      window.logActivity('Jurnal Musyrif', `Menyelesaikan tugas: ${task.taskName} (${this.stepCount} langkah)`);
    }

    return task;
  }

  /**
   * Helper to get local date string YYYY-MM-DD
   */
  _getLocalDateStr() {
    const dateObj = new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Export singleton instance
window.journalManager = new JournalManager();
