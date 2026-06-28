# JavaScript Coding Style

> Extends common/coding-style.md

## ES6+ Features

### Use Const/Let, Avoid Var
```javascript
// SALAH
var name = 'test';
var count = 0;

// BENAR
const APP_NAME = 'Syamsa';
let count = 0;
```

### Arrow Functions
```javascript
// Prefer arrow functions for callbacks
const activeSantri = this.santriList.filter(s => s.status !== 'A');

// Named for readability in event handlers
const handleSave = () => { /* ... */ };
element.addEventListener('click', handleSave);
```

### Destructuring
```javascript
// Object destructuring
const { id, name, status } = santri;

// With defaults
const { role = 'wali', email } = userData;

// Array destructuring
const [first, second, ...rest] = items;
```

### Template Literals
```javascript
// Instead of string concatenation
const greeting = `Halo ${name}, ${count} santri hadir.`;

// Multi-line
const html = `
  <div class="card">
    <h3>${title}</h3>
  </div>
`;
```

## Immutability Patterns

### Object Updates
```javascript
// SALAH: Mutation
function updateStatus(santri, newStatus) {
  return Object.assign(santri, { status: newStatus });
}

// BENAR: Immutable spread
function updateStatus(santri, newStatus) {
  return { ...santri, status: newStatus };
}
```

### Array Operations
```javascript
// Filter creates new array
const activeSantri = this.santriList.filter(s => s.status !== 'A');

// Map creates new array
const names = this.santriList.map(s => s.name);

// Reduce for aggregations
const countByStatus = this.santriList.reduce((acc, s) => {
  acc[s.status] = (acc[s.status] || 0) + 1;
  return acc;
}, {});
```

## Class/Module Pattern

```javascript
/**
 * Manager for attendance operations
 */
class AttendanceManager {
  constructor(storageManager) {
    this.storage = storageManager;
    this.listeners = [];
  }

  getSantriByDate(date) {
    const key = this.getStorageKey(date);
    const data = this.storage.get(key);
    return data || this.getDefaultAttendance();
  }

  updateStatus(date, SantriId, status) {
    const data = this.getSantriByDate(date);
    const updated = {
      ...data,
      [santriId]: { ...data[santriId], status, updatedAt: Date.now() }
    };
    this.storage.set(this.getStorageKey(date), updated);
    this.notifyListeners('attendanceUpdated', { date, SantriId, status });
    return updated;
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }
}
```

## Async/Await

```javascript
async function loadSantriData(kelasId) {
  try {
    const response = await fetch(`/api/santri/${kelasId}`);
    if (!response.ok) throw new Error('Failed to load');
    return await response.json();
  } catch (error) {
    console.error('Load failed:', error);
    return null;
  }
}

// Parallel operations
const [santri, permits, tahfizh] = await Promise.all([
  loadSantri(kelasId),
  loadPermits(kelasId),
  loadTahfizh(kelasId)
]);
```

## DOM Manipulation

### Use textContent for User Data
```javascript
// SALAH: XSS risk
element.innerHTML = userInput;

// BENAR: Safe
element.textContent = userInput;

// For trusted HTML only
element.innerHTML = this.getTrustedTemplate(data);
```

### Event Delegation
```javascript
// Instead of individual handlers
container.addEventListener('click', (e) => {
  const button = e.target.closest('[data-action]');
  if (!button) return;
  
  const action = button.dataset.action;
  const id = button.dataset.id;
  
  this.handleAction(action, id);
});
```

## JSDoc Comments

```javascript
/**
 * Get attendance data for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object} Attendance data keyed by SantriId
 */
getAttendanceByDate(date) {
  // ...
}

/**
 * Update Santri attendance status
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} SantriId - Santri identifier
 * @param {string} status - New status code (H, A, S, I, P, T)
 * @returns {Object} Updated attendance data
 */
updateStatus(date, SantriId, status) {
  // ...
}
```

## No Console.log in Production

```javascript
// Use logger pattern instead
const Logger = {
  debug: (...args) => {
    if (DEBUG_MODE) console.debug('[DEBUG]', ...args);
  },
  info: (...args) => console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};
```