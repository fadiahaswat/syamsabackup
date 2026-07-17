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

    // Device motion and GPS state
    this.isTracking = false;
    this.stepCount = 0;
    this.gpsWatchId = null;
    this.startCoords = null;
    this.maxDisplacement = 0;
    this.pathCoords = [];
    this.gpsActive = false;
    this.gpsAccuracy = 0;
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
          musyrifName,
          gpsVerified: false,
          maxDisplacement: 0,
          pathCoords: []
        };
        try {
          await this._repos.journal.put(record);
        } catch (dbErr) {
          this._logger.warn(`[JournalManager] Failed to persist prepopulated task ${task.taskId} locally:`, dbErr);
        }
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
   * Calculate current daily streak for the logged-in Musyrif
   */
  async getStreakCount() {
    if (!this._repos?.journal) return 0;
    
    const musyrifId = this.getMusyrifId();
    const allRecords = await this._repos.journal.getByMusyrif(musyrifId);
    
    // Group records by date string YYYY-MM-DD
    const recordsByDate = {};
    allRecords.forEach(r => {
      if (!recordsByDate[r.date]) {
        recordsByDate[r.date] = [];
      }
      recordsByDate[r.date].push(r);
    });
    
    // Helper to check if a date is completed (all 6 default tasks are completed)
    const isDateCompleted = (dateStr) => {
      const records = recordsByDate[dateStr] || [];
      if (records.length === 0) return false;
      return records.every(r => r.status === 'completed');
    };
    
    let checkDate = new Date();
    let streak = 0;
    
    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    let currentStr = formatDate(checkDate);
    
    // Check starting from today or yesterday
    if (isDateCompleted(currentStr)) {
      while (isDateCompleted(currentStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
        currentStr = formatDate(checkDate);
      }
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
      currentStr = formatDate(checkDate);
      if (isDateCompleted(currentStr)) {
        while (isDateCompleted(currentStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
          currentStr = formatDate(checkDate);
        }
      }
    }
    
    return streak;
  }

  /**
   * Start tracking motion steps and GPS displacement
   * @param {string} date - Journal date
   * @param {string} taskId - Task identifier
   * @param {Function} onStepCallback - Triggered on step count / coordinates update
   * @param {Function} onCompleteCallback - Triggered on completion (100 steps & 15m displacement)
   * @param {Function} onErrorCallback - Triggered if permission is denied or not supported
   */
  async startStepTracking(date, taskId, onStepCallback, onCompleteCallback, onErrorCallback) {
    this.stopStepTracking();

    this.stepCount = 0;
    this.maxDisplacement = 0;
    this.pathCoords = [];
    this.startCoords = null;
    this.gpsActive = false;
    this.isTracking = true;

    // 1. Initialize GPS Tracking (if supported)
    if (navigator.geolocation) {
      this.gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
          this.gpsActive = true;
          this.gpsAccuracy = position.coords.accuracy;
          
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const currentPoint = { latitude: lat, longitude: lon, timestamp: Date.now() };
          
          this.pathCoords.push(currentPoint);
          
          if (!this.startCoords) {
            this.startCoords = currentPoint;
          } else {
            const dist = this._calculateDistance(
              this.startCoords.latitude, this.startCoords.longitude,
              lat, lon
            );
            if (dist > this.maxDisplacement) {
              this.maxDisplacement = dist;
            }
          }
          
          if (onStepCallback) {
            onStepCallback({
              steps: this.stepCount,
              maxDisplacement: this.maxDisplacement,
              pathCoords: this.pathCoords,
              gpsActive: this.gpsActive,
              gpsAccuracy: this.gpsAccuracy
            });
          }
          
          this._checkCompletion(date, taskId, onCompleteCallback, onErrorCallback);
        },
        (err) => {
          this._logger.warn('[JournalManager] Geolocation tracking error:', err);
          this.gpsActive = false;
          // Fallback UI reporting
          if (onStepCallback) {
            onStepCallback({
              steps: this.stepCount,
              maxDisplacement: this.maxDisplacement,
              pathCoords: this.pathCoords,
              gpsActive: false,
              gpsAccuracy: 0,
              gpsError: err.message
            });
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }

    // 2. Initialize Device Motion (Steps)
    if (!window.DeviceMotionEvent) {
      this.isTracking = false;
      if (onErrorCallback) onErrorCallback('Sensor gerak tidak didukung di perangkat ini.');
      return;
    }

    const startListener = () => {
      let lastMag = 0;
      let lastStepTime = 0;
      const peakThreshold = 11.5; // gravity spike for step detection

      this._stepListener = (event) => {
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc) return;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;
        
        const mag = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        if (mag > peakThreshold && (now - lastStepTime > 350)) {
          if (Math.abs(mag - lastMag) > 1.5) {
            this.stepCount++;
            lastStepTime = now;
            
            if (onStepCallback) {
              onStepCallback({
                steps: this.stepCount,
                maxDisplacement: this.maxDisplacement,
                pathCoords: this.pathCoords,
                gpsActive: this.gpsActive,
                gpsAccuracy: this.gpsAccuracy
              });
            }

            this._checkCompletion(date, taskId, onCompleteCallback, onErrorCallback);
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
      startListener();
    }
  }

  /**
   * Stop tracking motion steps & GPS
   */
  stopStepTracking() {
    this.isTracking = false;
    if (this._stepListener) {
      window.removeEventListener('devicemotion', this._stepListener, true);
      this._stepListener = null;
      this._logger.info('[JournalManager] DeviceMotion listener stopped');
    }
    if (this.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
      this._logger.info('[JournalManager] Geolocation watch stopped');
    }
  }

  /**
   * Check if verification goals are satisfied
   * @private
   */
  _checkCompletion(date, taskId, onCompleteCallback, onErrorCallback) {
    const stepsGoal = 100;
    const displacementGoal = 15; // 15 meters

    // If GPS works, verify both. If GPS fails or is disabled/denied, fallback to steps only.
    const isGpsRequiredMet = !this.gpsActive || (this.maxDisplacement >= displacementGoal);

    if (this.stepCount >= stepsGoal && isGpsRequiredMet) {
      this._logger.info(`[JournalManager] Goals met: ${this.stepCount} steps, ${this.maxDisplacement.toFixed(1)}m displacement`);
      this.stopStepTracking();
      this._verifyTask(date, taskId)
        .then(onCompleteCallback)
        .catch(err => {
          if (onErrorCallback) onErrorCallback(err.message);
        });
    }
  }

  /**
   * Calculate distance between two coordinate pairs using Haversine formula
   * @private
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // meters
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
    task.gpsVerified = this.gpsActive && (this.maxDisplacement >= 15);
    task.maxDisplacement = this.maxDisplacement;
    task.pathCoords = this.pathCoords;

    await this._repos.journal.put(task);

    // Audit log
    if (typeof window.logActivity === 'function') {
      const gpsStatusText = task.gpsVerified ? `${this.maxDisplacement.toFixed(1)}m` : 'Tanpa GPS';
      window.logActivity('Jurnal Musyrif', `Menyelesaikan tugas: ${task.taskName} (${this.stepCount} langkah, gps: ${gpsStatusText})`);
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
