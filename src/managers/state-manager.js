/**
 * StateManager - Reactive State Management with IndexedDB Persistence
 *
 * Fungsi:
 * - Centralized state management
 * - Reactive updates (UI automatically updates when state changes)
 * - Persistent storage (automatic save to IndexedDB)
 * - Version tracking untuk conflict detection
 * - Event emission untuk komponen UI
 *
 * ARCHITECTURE:
 *
 * UI Component → StateManager.set() → State Change → Persist to IndexedDB
 *                                                       ↓
 *                                              Emit 'change' event
 *                                                       ↓
 *                                              UI Components re-render
 */

class StateManager {
  constructor() {
    // Internal state
    this._state = {
      // User session
      selectedClass: null,
      userProfile: null,
      isAdmin: false,
      isWali: false,
      waliSantri: null,

      // App state
      currentSlotId: 'shubuh',
      activeAttendanceSlotId: null,
      date: this._getLocalDateStr(),
      searchQuery: '',
      filterProblemOnly: false,

      // Data caches (synced from IndexedDB)
      attendanceData: {},      // Legacy format for compatibility
      permits: [],
      filteredSantri: [],
      settings: {},
      activityLog: [],

      // Meta
      _version: 0,
      _lastSync: null,
      _isDirty: false,
    };

    // Event listeners
    this._listeners = new Map();

    // Debounce timer for persistence
    this._persistTimer = null;
    this._persistDelay = 300; // 300ms debounce

    // Database reference
    this._db = null;
    this._repos = null;

    // Initialized flag
    this._initialized = false;
  }

  /**
   * Initialize StateManager with database
   */
  async init(db, repositories) {
    if (this._initialized) return;

    this._db = db;
    this._repos = repositories;

    // Load persisted state from IndexedDB
    await this._loadPersistedState();

    this._initialized = true;
    console.log('[StateManager] Initialized');
  }

  /**
   * Get current date string
   */
  _getLocalDateStr(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Load persisted state from IndexedDB
   */
  async _loadPersistedState() {
    try {
      // Load user settings
      const settings = await this._repos.settings.getUserSettings();
      this._state.settings = settings;

      // Load today's attendance data from IndexedDB
      await this._loadAttendanceForDate(this._state.date);

      // Load permits
      const permits = await this._repos.permit.getByKelas(this._state.selectedClass);
      this._state.permits = permits || [];

      // Load activity log
      const logs = await this._repos.activityLog.getRecent(50);
      this._state.activityLog = logs || [];

      console.log('[StateManager] Loaded persisted state:', {
        settings: Object.keys(this._state.settings).length,
        permits: this._state.permits.length,
        attendanceRecords: Object.keys(this._state.attendanceData).length,
      });
    } catch (error) {
      console.error('[StateManager] Failed to load persisted state:', error);
    }
  }

  /**
   * Load attendance data for a specific date
   */
  async _loadAttendanceForDate(date) {
    if (!this._repos || !this._repos.attendance) return;

    const kelas = this._state.selectedClass;
    if (!kelas) {
      this._state.attendanceData = {};
      return;
    }

    try {
      // Get all attendance records for this date and class
      const records = await this._repos.attendance.getByKelas(kelas);

      // Filter by date
      const dateRecords = records.filter(r => r.date === date);

      // Transform to legacy format for compatibility
      const attendanceData = {};

      dateRecords.forEach(record => {
        if (!attendanceData[record.date]) {
          attendanceData[record.date] = {};
        }
        if (!attendanceData[record.date][record.slot]) {
          attendanceData[record.date][record.slot] = {};
        }

        attendanceData[record.date][record.slot][record.studentId] = {
          status: record.status || {},
          note: record.note || '',
          timestamps: record.timestamps || {},
          permitOverride: record.permitOverride,
        };
      });

      this._state.attendanceData = attendanceData;
    } catch (error) {
      console.error('[StateManager] Failed to load attendance:', error);
      this._state.attendanceData = {};
    }
  }

  /**
   * Get current state (read-only)
   */
  getState() {
    return { ...this._state };
  }

  /**
   * Get specific state value
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Set state (triggers persist)
   */
  set(partial) {
    const changedKeys = [];

    for (const [key, value] of Object.entries(partial)) {
      if (this._state[key] !== value) {
        this._state[key] = value;
        changedKeys.push(key);
      }
    }

    if (changedKeys.length > 0) {
      // Increment version
      this._state._version++;

      // Mark as dirty
      this._state._isDirty = true;

      // Emit change events
      this._emit('change', changedKeys);
      changedKeys.forEach(key => {
        this._emit(`change:${key}`, this._state[key]);
      });

      // Persist with debounce
      this._schedulePersist();
    }

    return changedKeys;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback) {
    if (!this._listeners.has('change')) {
      this._listeners.set('change', new Set());
    }
    this._listeners.get('change').add(callback);

    // Return unsubscribe function
    return () => {
      this._listeners.get('change')?.delete(callback);
    };
  }

  /**
   * Subscribe to specific key changes
   */
  subscribeToKey(key, callback) {
    const eventName = `change:${key}`;
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(callback);

    return () => {
      this._listeners.get(eventName)?.delete(callback);
    };
  }

  /**
   * Emit event to listeners
   */
  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[StateManager] Listener error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Schedule persistence with debounce
   */
  _schedulePersist() {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
    }

    this._persistTimer = setTimeout(() => {
      this._persist();
    }, this._persistDelay);
  }

  /**
   * Persist state to IndexedDB
   */
  async _persist() {
    if (!this._db || !this._repos || !this._state._isDirty) return;

    try {
      // Save settings
      if (this._state.settings) {
        await this._repos.settings.saveUserSettings(this._state.settings);
      }

      // Save attendance data
      await this._persistAttendance();

      // Save permits
      // (Permits are saved individually via permit operations)

      // Update last sync time
      this._state._lastSync = new Date().toISOString();
      this._state._isDirty = false;

      console.log('[StateManager] State persisted to IndexedDB');
    } catch (error) {
      console.error('[StateManager] Failed to persist state:', error);
    }
  }

  /**
   * Persist attendance data to IndexedDB
   */
  async _persistAttendance() {
    const attendanceData = this._state.attendanceData;
    const kelas = this._state.selectedClass;

    if (!kelas || !attendanceData) return;

    const kelasRecords = [];

    for (const [date, slots] of Object.entries(attendanceData)) {
      for (const [slot, students] of Object.entries(slots)) {
        for (const [studentId, data] of Object.entries(students)) {
          kelasRecords.push({
            date,
            slot,
            studentId,
            kelas,
            status: data.status || {},
            note: data.note || '',
            timestamps: data.timestamps || {},
            permitOverride: data.permitOverride,
          });
        }
      }
    }

    if (kelasRecords.length > 0) {
      await this._repos.attendance.bulkSave(
        this._state.date,
        this._state.currentSlotId,
        kelasRecords.map(r => ({
          studentId: r.studentId,
          status: r.status,
          note: r.note,
          timestamps: r.timestamps,
        })),
        kelas
      );
    }
  }

  /**
   * Force immediate persist
   */
  async forcePersist() {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    await this._persist();
  }

  // ==========================================
  // DOMAIN-SPECIFIC OPERATIONS
  // ==========================================

  /**
   * Set selected class and load data
   */
  async setSelectedClass(kelas, userProfile = null) {
    // Update session state
    this.set({
      selectedClass: kelas,
      userProfile,
      isAdmin: kelas?.toLowerCase() === 'admin musyrif',
    });

    // Reload data for new class
    await this._loadAttendanceForDate(this._state.date);

    const permits = await this._repos.permit.getByKelas(kelas);
    this.set({ permits: permits || [] });
  }

  /**
   * Update attendance status
   */
  async updateAttendance(date, slot, studentId, activityId, newStatus, actorName) {
    const now = new Date().toISOString();
    const existingRecord = this._state.attendanceData[date]?.[slot]?.[studentId];
    const oldStatus = existingRecord?.status?.[activityId];

    // Immutable update - create new nested objects
    const updatedRecord = {
      status: {
        ...(existingRecord?.status || {}),
        [activityId]: newStatus,
      },
      timestamps: {
        ...(existingRecord?.timestamps || {}),
        [activityId]: now,
      },
      note: existingRecord?.note || '',
    };

    // Immutable update at each level
    this._state.attendanceData = {
      ...this._state.attendanceData,
      [date]: {
        ...(this._state.attendanceData[date] || {}),
        [slot]: {
          ...(this._state.attendanceData[date]?.[slot] || {}),
          [studentId]: updatedRecord,
        },
      },
    };

    // Mark dirty and increment version
    this._state._version++;
    this._state._isDirty = true;

    // Emit change
    this._emit('change', ['attendanceData']);
    this._emit('attendance:update', { date, slot, studentId, activityId, oldStatus, newStatus });

    // Persist to IndexedDB
    await this._repos.attendance.save(
      date,
      slot,
      studentId,
      updatedRecord,
      this._state.selectedClass
    );

    // Log activity
    await this._repos.activityLog.log(
      'Attendance Update',
      `${studentId}: ${activityId} changed from ${oldStatus} to ${newStatus}`,
      actorName,
      this._state.selectedClass
    );

    return updatedRecord;
  }

  /**
   * Update note
   */
  async updateNote(date, slot, studentId, note, actorName) {
    const existingRecord = this._state.attendanceData[date]?.[slot]?.[studentId];
    if (!existingRecord) {
      return null;
    }

    const oldNote = existingRecord.note;

    // Immutable update
    const updatedRecord = {
      ...existingRecord,
      note,
    };

    this._state.attendanceData = {
      ...this._state.attendanceData,
      [date]: {
        ...(this._state.attendanceData[date] || {}),
        [slot]: {
          ...(this._state.attendanceData[date]?.[slot] || {}),
          [studentId]: updatedRecord,
        },
      },
    };

    // Persist
    await this._repos.attendance.updateNote(
      date,
      slot,
      studentId,
      note,
      actorName,
      this._state.selectedClass
    );

    // Log
    await this._repos.activityLog.log(
      'Note Updated',
      `${studentId}: note changed from "${oldNote}" to "${note}"`,
      actorName,
      this._state.selectedClass
    );

    this._emit('change', ['attendanceData']);

    return updatedRecord;
  }

  /**
   * Create permit
   */
  async createPermit(permitData, createdBy) {
    const permit = await this._repos.permit.create({
      ...permitData,
      createdBy,
    });

    // Add to local state
    this.set({
      permits: [...this._state.permits, permit],
    });

    // Log
    await this._repos.activityLog.log(
      'Permit Created',
      `New ${permitData.category} permit for ${permitData.nis}`,
      createdBy,
      this._state.selectedClass
    );

    return permit;
  }

  /**
   * Update permit
   */
  async updatePermit(id, data, updatedBy) {
    const permit = await this._repos.permit.update(id, data);

    // Update local state
    const permits = this._state.permits.map(p =>
      p.id === id ? { ...p, ...permit } : p
    );
    this.set({ permits });

    // Log
    await this._repos.activityLog.log(
      'Permit Updated',
      `Permit ${id} updated`,
      updatedBy,
      this._state.selectedClass
    );

    return permit;
  }

  /**
   * Approve permit
   */
  async approvePermit(id, approvedBy) {
    const permit = await this._repos.permit.approve(id, approvedBy);

    // Update local state
    const permits = this._state.permits.map(p =>
      p.id === id ? { ...p, ...permit } : p
    );
    this.set({ permits });

    // Log
    await this._repos.activityLog.log(
      'Permit Approved',
      `Permit ${id} approved by ${approvedBy}`,
      approvedBy,
      this._state.selectedClass
    );

    return permit;
  }

  /**
   * Reject permit
   */
  async rejectPermit(id, rejectedBy, reason) {
    const permit = await this._repos.permit.reject(id, rejectedBy, reason);

    // Update local state
    const permits = this._state.permits.map(p =>
      p.id === id ? { ...p, ...permit } : p
    );
    this.set({ permits });

    // Log
    await this._repos.activityLog.log(
      'Permit Rejected',
      `Permit ${id} rejected by ${rejectedBy}: ${reason}`,
      rejectedBy,
      this._state.selectedClass
    );

    return permit;
  }

  /**
   * Delete permit
   */
  async deletePermit(id, deletedBy) {
    await this._repos.permit.delete(id);

    // Update local state
    const permits = this._state.permits.filter(p => p.id !== id);
    this.set({ permits });

    // Log
    await this._repos.activityLog.log(
      'Permit Deleted',
      `Permit ${id} deleted`,
      deletedBy,
      this._state.selectedClass
    );

    return true;
  }

  /**
   * Update settings
   */
  async updateSettings(partial) {
    const newSettings = { ...this._state.settings, ...partial };
    this.set({ settings: newSettings });

    await this._repos.settings.saveUserSettings(newSettings);

    return newSettings;
  }

  /**
   * Change date and load attendance
   */
  async changeDate(newDate) {
    this.set({ date: newDate });
    await this._loadAttendanceForDate(newDate);
    this._emit('change', ['attendanceData', 'date']);
  }

  /**
   * Change slot
   */
  changeSlot(slotId) {
    this.set({
      currentSlotId: slotId,
      activeAttendanceSlotId: slotId,
    });
  }

  /**
   * Set filtered students
   */
  setFilteredSantri(students) {
    this.set({ filteredSantri: students });
  }

  /**
   * Get attendance record for student
   */
  getAttendance(date, slot, studentId) {
    return this._state.attendanceData?.[date]?.[slot]?.[studentId] || null;
  }

  /**
   * Get permits for student
   */
  getPermitsForStudent(nis) {
    return this._state.permits.filter(p => p.nis === nis);
  }

  /**
   * Check if student has active permit for date
   */
  hasActivePermit(nis, date) {
    const permits = this.getPermitsForStudent(nis);
    return permits.some(p =>
      p.is_active !== false &&
      p.status === 'approved' &&
      p.start_date <= date &&
      (!p.end_date || p.end_date >= date)
    );
  }

  /**
   * Clear all data (logout)
   */
  async clearAll() {
    this._state.attendanceData = {};
    this._state.permits = [];
    this._state.filteredSantri = [];
    this._state.activityLog = [];
    this._state.selectedClass = null;
    this._state.userProfile = null;
    this._state._version = 0;
    this._state._isDirty = false;

    this._emit('clear', {});
  }
}


// ==========================================
// SINGLETON INSTANCE
// ============================================================
const stateManager = new StateManager();

// Export
window.StateManager = StateManager;
window.stateManager = stateManager;

console.log('[StateManager] Module loaded');
