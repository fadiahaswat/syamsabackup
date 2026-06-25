# 📚 Local Database Integration Guide

## Overview

Sistem database baru menggunakan **IndexedDB** sebagai primary storage dengan **localStorage** sebagai fallback.

## File Structure

```
src/managers/
├── database-schema.js      # IndexedDB schema & operations
├── repository.js           # Domain-specific CRUD operations
├── state-manager.js       # Reactive state management
├── data-migrator.js       # LocalStorage → IndexedDB migration
└── storage-manager-v2.js  # Backward-compatible wrapper
```

## Quick Start

### 1. Initialize Database (do once at app start)

```javascript
// In your app initialization
async function initApp() {
  // Initialize the database system
  await initDatabase();

  // Or with custom options
  const result = await initDatabase();
  // result = { localDB, repos, stateManager, compatibilityLayer }
}
```

### 2. Using Repositories (Recommended)

```javascript
// Get repositories instance
const repos = getRepositories();

// ATTENDANCE
// Save attendance for one student
await repos.attendance.save(
  '2026-06-25',
  'shubuh',
  '12345',
  { status: { shalat: 'Hadir' }, note: '' },
  'XI-A'
);

// Get attendance for a student
const record = await repos.attendance.get('2026-06-25', 'shubuh', '12345');

// Get all attendance for a date
const dayRecords = await repos.attendance.getByDate('2026-06-25');

// Get attendance for a date and slot
const slotRecords = await repos.attendance.getByDateSlot('2026-06-25', 'shubuh');

// Get attendance for a class
const classRecords = await repos.attendance.getByKelas('XI-A');

// Update status with audit trail
await repos.attendance.updateStatus(
  '2026-06-25',
  'shubuh',
  '12345',
  'shalat',
  'Hadir',
  'Ustadz Ahmad'
);

// Get statistics
const stats = await repos.attendance.getStats('2026-06-25', 'shubuh');
// stats = { total: 30, Hadir: 25, Alpa: 3, Sakit: 2 }

// PERMITS
// Create permit
const permit = await repos.permit.create({
  nis: '12345',
  kelas: 'XI-A',
  category: 'sakit',
  reason: 'Demam',
  start_date: '2026-06-25',
  end_date: '2026-06-27',
  createdBy: 'Ustadz Ahmad'
});

// Get permits for student
const studentPermits = await repos.permit.getByStudent('12345');

// Get pending permits for class
const pending = await repos.permit.getPendingForKelas('XI-A');

// Get active permits for student
const active = await repos.permit.getActiveForStudent('12345');

// Approve permit
await repos.permit.approve(permit.id, 'Ustadz Ahmad');

// Reject permit
await repos.permit.reject(permit.id, 'Ustadz Ahmad', 'Tidak ada alasan kuat');

// Mark as returned
await repos.permit.markReturned(permit.id);

// Get statistics
const stats = await repos.permit.getStats('XI-A');

// TAHFIZH
// Create setoran
await repos.tahfizh.create({
  nis: '12345',
  nama_santri: 'Ahmad Santoso',
  kelas: 'XI-A',
  program: 'Ziyadah',
  jenis: 'Ziyadah',
  juz: '30',
  halaman: '1-5',
  kualitas: 'Lancar',
  musyrif: 'Ustadz Ahmad',
  tanggal: '2026-06-25'
});

// Verify setoran
await repos.tahfizh.verify(setoranId, 'Ustadz Ahmad');

// Get pending setoran for musyrif
const pending = await repos.tahfizh.getPendingForMusyrif('Ustadz Ahmad');

// SETTINGS
// Save user settings
await repos.settings.saveUserSettings({
  darkMode: true,
  notifications: false
});

// Get user settings
const settings = await repos.settings.getUserSettings();

// Update specific setting
await repos.settings.updateSetting('darkMode', false);

// ACTIVITY LOG
// Log activity
await repos.activityLog.log(
  'Attendance Update',
  'Student 12345 marked as Hadir',
  'Ustadz Ahmad',
  'XI-A'
);

// Get recent logs
const logs = await repos.activityLog.getRecent(50);

// Get logs by class
const classLogs = await repos.activityLog.getByKelas('XI-A');
```

### 3. Using StateManager (Reactive State)

```javascript
// Initialize
await stateManager.init(localDB, repos);

// Set state
stateManager.set({
  selectedClass: 'XI-A',
  currentSlotId: 'shubuh'
});

// Get state
const state = stateManager.getState();
const kelas = stateManager.get('selectedClass');

// Subscribe to changes
const unsubscribe = stateManager.subscribe((changedKeys) => {
  console.log('State changed:', changedKeys);
});

// Subscribe to specific key
const unsubscribeSettings = stateManager.subscribeToKey('settings', (newSettings) => {
  console.log('Settings updated:', newSettings);
});

// Update attendance with persistence
await stateManager.updateAttendance(
  '2026-06-25',
  'shubuh',
  '12345',
  'shalat',
  'Hadir',
  'Ustadz Ahmad'
);

// Update settings
await stateManager.updateSettings({ darkMode: true });

// Force persist
await stateManager.forcePersist();
```

### 4. Using StorageManagerV2 (Backward Compatible)

```javascript
// Old API still works
storageManagerV2.saveAttendance(dateKey, slotId, data);
const data = storageManagerV2.getAttendance(dateKey, slotId);
storageManagerV2.savePermits(permits);
storageManagerV2.saveSettings(settings);

// Check storage status
const status = storageManagerV2.getStatus();
// status = { isOnline: true, useIndexedDB: true, ... }
```

## Database Schema

### attendances

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| id | string | PK | `{date}_{slot}_{studentId}` |
| date | string | Yes | YYYY-MM-DD |
| slot | string | Yes | shubuh, sekolah, ashar, maghrib, isya |
| studentId | string | Yes | NIS |
| kelas | string | Yes | Class name |
| status | object | No | `{activityId: status}` |
| note | string | No | Attendance note |
| timestamps | object | No | `{activityId: ISO8601}` |
| auditTrail | array | No | Change history |
| _version | number | No | Optimistic lock |
| _createdAt | ISO8601 | No | Record creation |
| _updatedAt | ISO8601 | Yes | Last update |
| _syncedAt | ISO8601 | Yes | Last sync (future) |

### permits

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| id | string | PK | UUID |
| nis | string | Yes | Student NIS |
| kelas | string | Yes | Class name |
| category | string | Yes | sakit, izin, pulang |
| reason | string | No | Permit reason |
| start_date | string | No | Start date |
| end_date | string | No | End date |
| status | string | Yes | pending, approved, rejected |
| is_active | boolean | Yes | Active flag |
| document | string | No | Base64 document |
| audit_trail | array | No | Change history |
| _version | number | No | Optimistic lock |
| _createdAt | ISO8601 | No | Record creation |
| _updatedAt | ISO8601 | Yes | Last update |

### tahfizh

| Field | Type | Index | Description |
|-------|------|-------|-------------|
| id | string | PK | UUID |
| nis | string | Yes | Student NIS |
| kelas | string | Yes | Class name |
| jenis | string | Yes | Ziyadah, Murojaah |
| juz | string | No | Quran Juz |
| halaman | string | No | Page range |
| surat | string | No | Surah name |
| kualitas | string | No | Lancar, Sedang, Kurang |
| status | string | Yes | Pending, Verified, Rejected |
| musyrif | string | Yes | Checking musyrif |
| tanggal | string | Yes | Date |
| _version | number | No | Optimistic lock |
| _createdAt | ISO8601 | No | Record creation |
| _updatedAt | ISO8601 | Yes | Last update |

## Migration

### Check if migration is needed

```javascript
const migrator = new DataMigrator(localDB, getRepositories());
const isNeeded = await migrator.isMigrationNeeded();
console.log('Migration needed:', isNeeded);
```

### Run migration manually

```javascript
const result = await migrator.migrate();
console.log('Migration result:', result);
```

### Verify migration

```javascript
const verification = await migrator.verify();
console.log('Verification:', verification);
// { attendance: { localCount: 100, indexedCount: 100, match: true }, ... }
```

### Rollback migration

```javascript
await migrator.rollback();
```

## Diagnostics

```javascript
// Get full diagnostics
const diagnostics = await getDatabaseDiagnostics();
// {
//   localDB: { isReady: true },
//   repos: { attendance, permit, tahfizh, settings, activityLog },
//   stateManager: { _initialized: true },
//   compatibility: { useNewStorage: true }
// }

// Check IndexedDB record counts
const usage = await storageManagerV2.getIndexedDBUsage();
// { attendances: 500, permits: 50, tahfizh: 200, ... }
```

## Best Practices

### 1. Use Repositories for CRUD Operations

```javascript
// ✅ Good
const record = await repos.attendance.get(date, slot, studentId);
await repos.attendance.save(date, slot, studentId, data, kelas);

// ❌ Avoid (bypasses versioning & audit trail)
appState.attendanceData[date][slot][studentId] = data;
```

### 2. Always Use Audit Trail

```javascript
// ✅ Good
await repos.attendance.updateStatus(
  date, slot, studentId, activityId, newStatus,
  getCurrentActorName()  // For audit trail
);

// ❌ Avoid
await repos.attendance.save(date, slot, studentId, data, kelas);
// No audit trail
```

### 3. Handle Async Properly

```javascript
// ✅ Good
async function loadAttendance() {
  const records = await repos.attendance.getByDate(date);
  return records;
}

// ❌ Avoid
function loadAttendance() {
  const records = repos.attendance.getByDate(date); // Returns Promise!
  return records; // Returns Promise, not data
}
```

### 4. Use StateManager for Reactive Updates

```javascript
// ✅ Good
stateManager.subscribe((changedKeys) => {
  if (changedKeys.includes('attendanceData')) {
    renderAttendanceList();
  }
});

// ❌ Avoid
// Manually calling renderAttendanceList() without subscribing to state changes
```

## Error Handling

```javascript
try {
  const record = await repos.attendance.get(date, slot, studentId);
  if (!record) {
    console.log('Record not found');
  }
} catch (error) {
  console.error('Database error:', error);
  // Fallback or retry logic
}
```

## Future: Cloud Sync

The schema includes `_syncedAt` fields and a `sync_queue` store for future cloud synchronization:

```javascript
// Get unsynced records
const unsynced = await repos.attendance.getUnsynced();

// Mark as synced
await repos.attendance.markSynced(date, slot, studentId);
```

When cloud sync is implemented, the system will:
1. Queue changes in `sync_queue`
2. Process queue when online
3. Handle conflicts using `_version`
4. Update `_syncedAt` on success
