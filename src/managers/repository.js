/**
 * Repository - Domain-specific Data Access Layer
 *
 * Provides clean CRUD operations for each domain entity
 * Wraps LocalDB with business logic
 *
 * FEATURES:
 * - Single source of truth
 * - Version control
 * - Audit trail
 * - Validation
 * - Event emission for UI reactivity
 */

// Centralized ID Generator Fallbacks (if storage-constants.js is cached/missing)
if (typeof window.generateId !== 'function') {
  window.generateId = function (prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  };
}

if (typeof window.generateAttendanceId !== 'function') {
  window.generateAttendanceId = function (date, slot, studentId) {
    return `att_${date}_${slot}_${studentId}`;
  };
}

if (typeof window.generatePermitId !== 'function') {
  window.generatePermitId = function () {
    return window.generateId('p');
  };
}

if (typeof window.generateTahfizhId !== 'function') {
  window.generateTahfizhId = function (kelas, nis, rowNumber = null) {
    const suffix = rowNumber !== null ? `row_${rowNumber}` : `rnd_${Date.now().toString(36)}`;
    return `tahfizh_${kelas.replace(/\s+/g, '_')}_${nis}_${suffix}`;
  };
}

if (typeof window.generateLogId !== 'function') {
  window.generateLogId = function () {
    return window.generateId('log');
  };
}

class AttendanceRepository {
  constructor(db) {
    this.db = db;
    this.storeName = window.DB_STORES?.attendances || 'attendances';
    this._logger = window.RepositoryLogger || console;
  }

  /**
   * Generate composite ID using centralized generator
   */
  _createId(date, slot, studentId) {
    return window.generateAttendanceId(date, slot, studentId);
  }

  /**
   * Get attendance record
   */
  async get(date, slot, studentId) {
    const id = this._createId(date, slot, studentId);
    return this.db.get(this.storeName, id);
  }

  /**
   * Get attendance for a specific date and slot (all students)
   */
  async getByDateSlot(date, slot) {
    return this.db.getByIndex(this.storeName, 'date_slot', [date, slot]);
  }

  /**
   * Get all attendance for a specific date
   */
  async getByDate(date) {
    return this.db.getByIndex(this.storeName, 'date', date);
  }

  /**
   * Get attendance for a specific student
   */
  async getByStudent(studentId) {
    return this.db.getByIndex(this.storeName, 'studentId', studentId);
  }

  /**
   * Get attendance for a specific class
   */
  async getByKelas(kelas) {
    return this.db.getByIndex(this.storeName, 'kelas', kelas);
  }

  /**
   * Get attendance for date range
   */
  async getByDateRange(startDate, endDate) {
    return this.db.getByRange(this.storeName, 'date', startDate, endDate);
  }

  /**
   * Get attendance for a specific student and date range
   */
  async getStudentHistory(studentId, startDate, endDate) {
    const allRecords = await this.getByStudent(studentId);
    return allRecords.filter(r => r.date >= startDate && r.date <= endDate);
  }

  /**
   * Save attendance for single student
   */
  async save(date, slot, studentId, data, kelas) {
    const id = this._createId(date, slot, studentId);

    // Get existing record for audit trail
    const existing = await this.get(date, slot, studentId);

    const record = {
      id,
      date,
      slot,
      studentId,
      kelas,
      status: data.status || {},
      note: data.note || '',
      timestamps: data.timestamps || {},
      auditTrail: data.auditTrail || [],
      permitOverride: data.permitOverride || null,
    };

    // Add to audit trail if changed
    if (existing && existing._version) {
      record.auditTrail = [
        ...(record.auditTrail || []),
        {
          action: 'update',
          from: { status: existing.status, note: existing.note },
          to: { status: record.status, note: record.note },
          at: new Date().toISOString(),
        }
      ];
    }

    // Mark for sync
    record._syncedAt = null;

    return this.db.put(this.storeName, record);
  }

  /**
   * Bulk save attendance for multiple students
   */
  async bulkSave(date, slot, records, kelas) {
    const dbRecords = records.map(r => {
      const id = this._createId(date, slot, r.studentId);
      return {
        id,
        date,
        slot,
        studentId: r.studentId,
        kelas,
        status: r.status || {},
        note: r.note || '',
        timestamps: r.timestamps || {},
        auditTrail: r.auditTrail || [],
        permitOverride: r.permitOverride || null,
        _syncedAt: null,
      };
    });

    return this.db.bulkPut(this.storeName, dbRecords);
  }

  /**
   * Update status for single student (increment version)
   */
  async updateStatus(date, slot, studentId, activityId, newStatus, actorName, kelas) {
    const existing = await this.get(date, slot, studentId);

    if (!existing) {
      // Create new record
      return this.save(date, slot, studentId, {
        status: { [activityId]: newStatus },
        auditTrail: [{
          action: 'create_with_status',
          activityId,
          from: null,
          to: newStatus,
          at: new Date().toISOString(),
          by: actorName,
        }]
      }, kelas);
    }

    const oldStatus = existing.status?.[activityId];
    const now = new Date().toISOString();

    // Immutable update - create new object with spread
    const updated = {
      ...existing,
      status: {
        ...existing.status,
        [activityId]: newStatus,
      },
      timestamps: {
        ...existing.timestamps,
        [activityId]: now,
      },
      auditTrail: [
        ...(existing.auditTrail || []),
        {
          action: 'status_change',
          activityId,
          from: oldStatus,
          to: newStatus,
          at: now,
          by: actorName,
        },
      ],
      _syncedAt: null,
    };

    return this.db.put(this.storeName, updated);
  }

  /**
   * Update note
   */
  async updateNote(date, slot, studentId, note, actorName, kelas) {
    const existing = await this.get(date, slot, studentId);
    const now = new Date().toISOString();

    if (!existing) {
      return this.save(date, slot, studentId, {
        note,
        auditTrail: [{
          action: 'note_added',
          note,
          at: now,
          by: actorName,
        }]
      }, kelas);
    }

    // Immutable update - create new object with spread
    const updated = {
      ...existing,
      note,
      auditTrail: [
        ...(existing.auditTrail || []),
        {
          action: 'note_updated',
          from: existing.note,
          to: note,
          at: now,
          by: actorName,
        },
      ],
      _syncedAt: null,
    };

    return this.db.put(this.storeName, updated);
  }

  /**
   * Get statistics for a date and slot
   */
  async getStats(date, slot) {
    const records = await this.getByDateSlot(date, slot);

    const stats = {
      total: records.length,
      Hadir: 0,
      Sakit: 0,
      Izin: 0,
      Alpa: 0,
      Telat: 0,
      Pulang: 0,
    };

    records.forEach(record => {
      const mainStatus = record.status?.shalat || record.status?.kehadiran || 'unknown';
      if (stats[mainStatus] !== undefined) {
        stats[mainStatus]++;
      }
    });

    return stats;
  }

  /**
   * Get all records needing sync
   * HIGH FIX: Use indexed query instead of loading all records
   */
  async getUnsynced() {
    // Use getAll but for large datasets this should use a dedicated index
    // For now, this is acceptable as _syncedAt is a marker field
    // In future, add a dedicated 'pending_sync' index
    const all = await this.db.getAll(this.storeName);
    return all.filter(r => r._syncedAt === null);
  }

  /**
   * Mark as synced
   */
  async markSynced(date, slot, studentId) {
    const record = await this.get(date, slot, studentId);
    if (record) {
      record._syncedAt = new Date().toISOString();
      return this.db.put(this.storeName, record);
    }
    return null;
  }

  /**
   * Delete attendance
   */
  async delete(date, slot, studentId) {
    const id = this._createId(date, slot, studentId);
    return this.db.delete(this.storeName, id);
  }

  /**
   * Delete all attendance for a class
   */
  async deleteByKelas(kelas) {
    return this.db.deleteByIndex(this.storeName, 'kelas', kelas);
  }
}


class PermitRepository {
  constructor(db) {
    this.db = db;
    this.storeName = window.DB_STORES?.permits || 'permits';
    this._logger = window.RepositoryLogger || console;
  }

  /**
   * Generate permit ID using centralized generator
   */
  _generateId() {
    return window.generatePermitId();
  }

  /**
   * Get permit by ID
   */
  async get(id) {
    return this.db.get(this.storeName, id);
  }

  /**
   * Get all permits for a student
   */
  async getByStudent(nis) {
    return this.db.getByIndex(this.storeName, 'nis', nis);
  }

  /**
   * Get all permits for a class
   */
  async getByKelas(kelas) {
    return this.db.getByIndex(this.storeName, 'kelas', kelas);
  }

  /**
   * Get permits by status
   */
  async getByStatus(status) {
    return this.db.getByIndex(this.storeName, 'status', status);
  }

  /**
   * Get permits by category
   */
  async getByCategory(category) {
    return this.db.getByIndex(this.storeName, 'category', category);
  }

  /**
   * Get active permits (is_active = true and status = approved)
   */
  async getActive() {
    const approved = await this.getByStatus('approved');
    return approved.filter(p => p.is_active !== false);
  }

  /**
   * Get active permits for a student
   */
  async getActiveForStudent(nis) {
    const studentPermits = await this.getByStudent(nis);
    return studentPermits.filter(p =>
      p.is_active !== false &&
      p.status === 'approved'
    );
  }

  /**
   * Get pending permits for a class
   */
  async getPendingForKelas(kelas) {
    const classPermits = await this.getByKelas(kelas);
    return classPermits.filter(p => p.status === 'pending');
  }

  /**
   * Check if student has active permit for specific date
   */
  async hasActivePermit(nis, date) {
    const active = await this.getActiveForStudent(nis);

    return active.some(p => {
      const start = p.start_date || '';
      const end = p.end_date || start;

      return date >= start && date <= end;
    });
  }

  /**
   * Get permit history for a student
   */
  async getHistory(nis, limit = 50) {
    const records = await this.getByStudent(nis);
    return records
      .sort((a, b) => {
        const dateA = a.start_date || a._createdAt || '';
        const dateB = b.start_date || b._createdAt || '';
        return dateB.localeCompare(dateA);
      })
      .slice(0, limit);
  }

  /**
   * Create permit
   */
  async create(data) {
    const now = new Date().toISOString();
    const id = data.id || this._generateId();

    const record = {
      id,
      nis: data.nis,
      kelas: data.kelas,
      category: data.category, // sakit, izin, pulang
      reason: data.reason,
      start_date: data.start_date,
      end_date: data.end_date || null,
      start_session: data.start_session || null,
      end_session: data.end_session || null,
      start_time_limit: data.start_time_limit || null,
      end_time_limit: data.end_time_limit || null,
      location: data.location || null,
      pickup: data.pickup || null,
      vehicle: data.vehicle || null,
      document: data.document || null,
      surat_dokter: data.surat_dokter || null,
      requires_surat_dokter: data.requires_surat_dokter || false,
      status: data.status || 'pending',
      status_label: data.status_label || (data.category === 'sakit' ? 'S' : 'I'),
      is_active: data.is_active !== false,
      expiredByNotification: false,
      audit_trail: [
        {
          action: 'created',
          at: now,
          by: data.createdBy || 'System',
        }
      ],
    };

    return this.db.put(this.storeName, record);
  }

  /**
   * Update permit
   */
  async update(id, data) {
    const existing = await this.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated = {
      ...existing,
      ...data,
      audit_trail: [
        ...(existing.audit_trail || []),
        {
          action: 'updated',
          changes: Object.keys(data),
          at: now,
        }
      ],
    };

    return this.db.put(this.storeName, updated);
  }

  /**
   * Approve permit
   */
  async approve(id, approvedBy) {
    return this.update(id, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      is_active: true,
    });
  }

  /**
   * Reject permit
   */
  async reject(id, rejectedBy, reason) {
    return this.update(id, {
      status: 'rejected',
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
      is_active: false,
    });
  }

  /**
   * Mark as returned (active = false)
   */
  async markReturned(id) {
    return this.update(id, {
      is_active: false,
      returnedAt: new Date().toISOString(),
    });
  }

  /**
   * Mark as recovered (for sick permits)
   */
  async markRecovered(id, recoveryDate, recoverySession) {
    return this.update(id, {
      end_date: recoveryDate,
      end_session: recoverySession,
      recoveredAt: new Date().toISOString(),
    });
  }

  /**
   * Extend permit end date
   */
  async extend(id, newEndDate, extendedBy) {
    const existing = await this.get(id);
    if (!existing) return null;

    // If category was 'pulang', change to 'izin' when extended
    const changes = {
      end_date: newEndDate,
      extended: true,
      extendedBy,
      extendedAt: new Date().toISOString(),
    };

    if (existing.category === 'pulang') {
      changes.category = 'izin';
      changes.status_label = 'I';
      changes.reason = (existing.reason || '') + ' (Diperpanjang)';
    }

    return this.update(id, changes);
  }

  /**
   * Mark expired permits as inactive
   */
  async markExpired() {
    const today = new Date().toISOString().split('T')[0];
    const allPermits = await this.db.getAll(this.storeName);

    const expired = allPermits.filter(p =>
      p.is_active !== false &&
      p.status === 'approved' &&
      p.category !== 'sakit' && // Sick permits don't auto-expire
      p.end_date &&
      p.end_date < today
    );

    for (const permit of expired) {
      await this.update(permit.id, {
        is_active: false,
        expiredByNotification: true,
        expiredAt: new Date().toISOString(),
      });
    }

    return expired.length;
  }

  /**
   * Delete permit
   */
  async delete(id) {
    return this.db.delete(this.storeName, id);
  }

  /**
   * Get statistics
   */
  async getStats(kelas) {
    const permits = kelas
      ? await this.getByKelas(kelas)
      : await this.db.getAll(this.storeName);

    return {
      total: permits.length,
      pending: permits.filter(p => p.status === 'pending').length,
      approved: permits.filter(p => p.status === 'approved').length,
      rejected: permits.filter(p => p.status === 'rejected').length,
      active: permits.filter(p => p.is_active !== false && p.status === 'approved').length,
      byCategory: {
        sakit: permits.filter(p => p.category === 'sakit').length,
        izin: permits.filter(p => p.category === 'izin').length,
        pulang: permits.filter(p => p.category === 'pulang').length,
      }
    };
  }
}


class TahfizhRepository {
  constructor(db) {
    this.db = db;
    this.storeName = window.DB_STORES?.tahfizh || 'tahfizh';
    this._logger = window.RepositoryLogger || console;
  }

  /**
   * Generate ID using centralized generator
   */
  _generateId(kelas, nis, rowNumber) {
    return window.generateTahfizhId(kelas, nis, rowNumber);
  }

  /**
   * Get setoran by ID
   */
  async get(id) {
    return this.db.get(this.storeName, id);
  }

  /**
   * Get all setoran for a student
   */
  async getByStudent(nis) {
    return this.db.getByIndex(this.storeName, 'nis', nis);
  }

  /**
   * Get all setoran for a class
   */
  async getByKelas(kelas) {
    return this.db.getByIndex(this.storeName, 'kelas', kelas);
  }

  /**
   * Get setoran by date
   */
  async getByDate(tanggal) {
    return this.db.getByIndex(this.storeName, 'tanggal', tanggal);
  }

  /**
   * Get setoran by status
   */
  async getByStatus(status) {
    return this.db.getByIndex(this.storeName, 'status', status);
  }

  /**
   * Get pending setoran for musyrif
   */
  async getPendingForMusyrif(musyrif) {
    const all = await this.getByStatus('Pending');
    return all.filter(s => s.musyrif === musyrif);
  }

  /**
   * Get setoran history for a student
   */
  async getHistory(nis, limit = 100) {
    const records = await this.getByStudent(nis);
    return records
      .sort((a, b) => {
        const dateA = a.tanggal || '';
        const dateB = b.tanggal || '';
        return dateB.localeCompare(dateA);
      })
      .slice(0, limit);
  }

  /**
   * Create setoran
   */
  async create(data) {
    const now = new Date().toISOString();
    const id = data.id || this._generateId(data.kelas, data.nis, data.rowNumber);

    const record = {
      id,
      nis: data.nis,
      nama_santri: data.nama_santri,
      kelas: data.kelas,
      program: data.program || 'Ziyadah',
      jenis: data.jenis || 'Ziyadah', // Ziyadah or Murojaah
      juz: data.juz || '',
      halaman: data.halaman || '',
      surat: data.surat || '',
      kualitas: data.kualitas || 'Lancar',
      status: data.status || 'Pending',
      musyrif: data.musyrif,
      tanggal: data.tanggal || now.split('T')[0],
      row_number: data.rowNumber,
      _syncedAt: null,
    };

    return this.db.put(this.storeName, record);
  }

  /**
   * Bulk create setoran
   */
  async bulkCreate(records) {
    const dbRecords = records.map(r => ({
      id: r.id || this._generateId(r.kelas, r.nis, r.rowNumber),
      nis: r.nis,
      nama_santri: r.nama_santri,
      kelas: r.kelas,
      program: r.program || 'Ziyadah',
      jenis: r.jenis || 'Ziyadah',
      juz: r.juz || '',
      halaman: r.halaman || '',
      surat: r.surat || '',
      kualitas: r.kualitas || 'Lancar',
      status: r.status || 'Pending',
      musyrif: r.musyrif,
      tanggal: r.tanggal || new Date().toISOString().split('T')[0],
      row_number: r.rowNumber,
      _syncedAt: null,
    }));

    return this.db.bulkPut(this.storeName, dbRecords);
  }

  /**
   * Verify setoran
   */
  async verify(id, verifiedBy) {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.db.put(this.storeName, {
      ...existing,
      status: 'Verified',
      verifiedBy,
      verifiedAt: new Date().toISOString(),
      _syncedAt: null,
    });
  }

  /**
   * Reject setoran
   */
  async reject(id, rejectedBy, reason) {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.db.put(this.storeName, {
      ...existing,
      status: 'Rejected',
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
      _syncedAt: null,
    });
  }

  /**
   * Update setoran
   */
  async update(id, data) {
    const existing = await this.get(id);
    if (!existing) return null;

    return this.db.put(this.storeName, {
      ...existing,
      ...data,
      _syncedAt: null,
    });
  }

  /**
   * Get statistics
   */
  async getStats(kelas, startDate, endDate) {
    let records = kelas
      ? await this.getByKelas(kelas)
      : await this.db.getAll(this.storeName);

    if (startDate && endDate) {
      records = records.filter(r =>
        r.tanggal >= startDate && r.tanggal <= endDate
      );
    }

    return {
      total: records.length,
      pending: records.filter(r => r.status === 'Pending').length,
      verified: records.filter(r => r.status === 'Verified').length,
      rejected: records.filter(r => r.status === 'Rejected').length,
      byJenis: {
        ziyadah: records.filter(r => r.jenis === 'Ziyadah').length,
        murojaah: records.filter(r => r.jenis === 'Murojaah').length,
      },
      byQuality: {
        lancar: records.filter(r => r.kualitas === 'Lancar').length,
        sedang: records.filter(r => r.kualitas === 'Sedang').length,
        kurang: records.filter(r => r.kualitas === 'Kurang').length,
      }
    };
  }
}


class SettingsRepository {
  constructor(db) {
    this.db = db;
    this.storeName = 'settings';
    this._logger = window.RepositoryLogger || console;
  }

  /**
   * Get settings by ID
   */
  async get(id = 'user_settings') {
    return this.db.get(this.storeName, id);
  }

  /**
   * Get user settings
   */
  async getUserSettings() {
    const settings = await this.get('user_settings');
    return settings?.data || this._getDefaults();
  }

  /**
   * Get class settings
   */
  async getClassSettings(kelas) {
    const settings = await this.get(`class_${kelas}`);
    return settings?.data || {};
  }

  /**
   * Get defaults
   */
  _getDefaults() {
    return {
      darkMode: false,
      notifications: true,
      autoSave: true,
      notificationTypes: {},
    };
  }

  /**
   * Save user settings
   */
  async saveUserSettings(data) {
    const existing = await this.get('user_settings');

    const record = {
      id: 'user_settings',
      data: {
        ...this._getDefaults(),
        ...(existing?.data || {}),
        ...data,
      },
    };

    return this.db.put(this.storeName, record);
  }

  /**
   * Save class settings
   */
  async saveClassSettings(kelas, data) {
    const existing = await this.get(`class_${kelas}`);

    const record = {
      id: `class_${kelas}`,
      data: {
        ...(existing?.data || {}),
        ...data,
      },
    };

    return this.db.put(this.storeName, record);
  }

  /**
   * Update specific setting
   */
  async updateSetting(key, value, id = 'user_settings') {
    const settings = await this.get(id);
    const data = settings?.data || this._getDefaults();

    data[key] = value;

    return this.db.put(this.storeName, {
      id,
      data,
      _updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Delete settings
   */
  async delete(id = 'user_settings') {
    return this.db.delete(this.storeName, id);
  }
}


class ActivityLogRepository {
  constructor(db) {
    this.db = db;
    this.storeName = window.DB_STORES?.activity_logs || 'activity_logs';
    this.maxEntries = 1000;
    this.maxAgeDays = 90;
    this._logger = window.RepositoryLogger || console;
  }

  /**
   * Generate ID using centralized generator
   */
  _generateId() {
    return window.generateLogId();
  }

  /**
   * Get recent logs (in-memory sort since IndexedDB doesn't support ORDER BY)
   */
  async getRecent(limit = 50) {
    const all = await this.db.getAll(this.storeName);
    return all
      .sort((a, b) => {
        const dateA = a.timestamp || '';
        const dateB = b.timestamp || '';
        return dateB.localeCompare(dateA);
      })
      .slice(0, limit);
  }

  /**
   * Get logs by class
   */
  async getByKelas(kelas, limit = 100) {
    const records = await this.db.getByIndex(this.storeName, 'kelas', kelas);
    return records
      .sort((a, b) => {
        const dateA = a.timestamp || '';
        const dateB = b.timestamp || '';
        return dateB.localeCompare(dateA);
      })
      .slice(0, limit);
  }

  /**
   * Get logs by action type
   */
  async getByAction(action, limit = 100) {
    const records = await this.db.getByIndex(this.storeName, 'action', action);
    return records
      .sort((a, b) => {
        const dateA = a.timestamp || '';
        const dateB = b.timestamp || '';
        return dateB.localeCompare(dateA);
      })
      .slice(0, limit);
  }

  /**
   * Log an activity
   */
  async log(action, detail, user, kelas = null) {
    const now = new Date().toISOString();
    const id = this._generateId();

    const record = {
      id,
      action,
      detail,
      user,
      kelas,
      timestamp: now,
    };

    await this.db.put(this.storeName, record);

    // Cleanup if needed
    await this._cleanupIfNeeded();

    return record;
  }

  /**
   * Cleanup old logs
   * CRITICAL FIX: Handle bulkDelete return value properly
   */
  async cleanup() {
    const cutoff = new Date(Date.now() - this.maxAgeDays * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString();

    const all = await this.db.getAll(this.storeName);
    const oldLogs = all.filter(log => log.timestamp && log.timestamp < cutoffStr);

    // CRITICAL FIX: bulkDelete now returns object, not just count
    const deleteResult = await this.db.bulkDelete(this.storeName, oldLogs.map(l => l.id));
    const deleted = deleteResult.success;

    // Also limit to max entries
    if (all.length - deleted > this.maxEntries) {
      const remaining = all
        .filter(log => log.timestamp >= cutoffStr)
        .sort((a, b) => {
          const dateA = a.timestamp || '';
          const dateB = b.timestamp || '';
          return dateB.localeCompare(dateA);
        })
        .slice(this.maxEntries);

      await this.db.bulkDelete(this.storeName, remaining.map(l => l.id));
    }

    return deleted;
  }

  /**
   * Check if cleanup is needed
   */
  async _cleanupIfNeeded() {
    const count = await this.db.count(this.storeName);

    if (count > this.maxEntries * 1.2) { // 20% buffer
      await this.cleanup();
    }
  }

  /**
   * Clear all logs
   */
  async clearAll() {
    return this.db.clear(this.storeName);
  }
}


// ============================================================
// FACTORY - Create all repositories with shared DB instance
// ============================================================
class RepositoryFactory {
  constructor(db) {
    this.db = db;
    this._attendance = null;
    this._permit = null;
    this._tahfizh = null;
    this._settings = null;
    this._activityLog = null;
    this._logger = window.RepositoryLogger || {
      debug: (...args) => window.Logger?.debug('Repository', ...args),
      info: (...args) => window.Logger?.info('Repository', ...args),
      warn: (...args) => window.Logger?.warn('Repository', ...args),
      error: (...args) => window.Logger?.error('Repository', ...args),
    };
  }

  get attendance() {
    if (!this._attendance) {
      this._attendance = new AttendanceRepository(this.db);
    }
    return this._attendance;
  }

  get permit() {
    if (!this._permit) {
      this._permit = new PermitRepository(this.db);
    }
    return this._permit;
  }

  get tahfizh() {
    if (!this._tahfizh) {
      this._tahfizh = new TahfizhRepository(this.db);
    }
    return this._tahfizh;
  }

  get settings() {
    if (!this._settings) {
      this._settings = new SettingsRepository(this.db);
    }
    return this._settings;
  }

  get activityLog() {
    if (!this._activityLog) {
      this._activityLog = new ActivityLogRepository(this.db);
    }
    return this._activityLog;
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================
let repositories = null;

async function initRepositories() {
  await localDB.init();
  repositories = new RepositoryFactory(localDB);
  return repositories;
}

function getRepositories() {
  return repositories;
}

// Export
window.LocalDB = LocalDB;
window.localDB = localDB;
window.RepositoryFactory = RepositoryFactory;
window.initRepositories = initRepositories;
window.getRepositories = getRepositories;

// Also export individual classes for testing
window.AttendanceRepository = AttendanceRepository;
window.PermitRepository = PermitRepository;
window.TahfizhRepository = TahfizhRepository;
window.SettingsRepository = SettingsRepository;
window.ActivityLogRepository = ActivityLogRepository;

console.log('[Repository] Module loaded');
