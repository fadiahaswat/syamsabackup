# Simplify & Cleanup Workflow

## When to Use

Use this skill when:
- Code is overly complex or hard to understand
- There are repeated patterns that could be extracted
- Functions are too long
- Files are getting too large
- You're improving existing code

## Simplification Principles

### 1. Keep Functions Small

**Rule:** Functions should do one thing well, ideally < 30 lines.

```javascript
// BEFORE: One long function doing multiple things
function processAttendance(date, action, data) {
  // Validate date
  if (!date || !isValidDate(date)) return false;
  
  // Get current data
  const current = getAttendance(date);
  if (!current) return false;
  
  // Process based on action
  if (action === 'update') {
    // Update logic
    // ...
  } else if (action === 'bulk') {
    // Bulk logic
    // ...
  }
  
  // Save
  saveAttendance(date, current);
  return true;
}

// AFTER: Small, focused functions
function processAttendance(date, action, data) {
  if (!validateDate(date)) return false;
  
  const current = getAttendance(date);
  if (!current) return false;
  
  const updated = applyAction(current, action, data);
  saveAttendance(date, updated);
  return true;
}

function validateDate(date) {
  return date && isValidDate(date);
}

function applyAction(data, action, payload) {
  const handlers = {
    update: applyUpdate,
    bulk: applyBulk,
  };
  
  const handler = handlers[action];
  return handler ? handler(data, payload) : data;
}
```

### 2. Extract Repeated Logic

**Rule:** If you copy-paste code, extract it into a function.

```javascript
// BEFORE: Repeated validation
function createSantri(data) {
  if (!data.name) throw new Error('Name required');
  if (!data.kelas) throw new Error('Class required');
  // ...
}

function updateSantri(id, data) {
  if (!data.name) throw new Error('Name required');
  if (!data.kelas) throw new Error('Class required');
  // ...
}

// AFTER: Shared validation
function validateSantriData(data) {
  if (!data.name) throw new Error('Name required');
  if (!data.kelas) throw new Error('Class required');
}

function createSantri(data) {
  validateSantriData(data);
  // ...
}

function updateSantri(id, data) {
  validateSantriData(data);
  // ...
}
```

### 3. Use Clear Naming

**Rule:** Variable and function names should reveal intent.

```javascript
// UNCLEAR
const d = new Date();
const r = data.filter(x => x.s === 'H');
const fn = () => { /* ... */ };

// CLEAR
const today = new Date();
const presentSantri = SantriList.filter(s => s.status === 'H');
const calculateAttendanceStats = () => { /* ... */ };
```

### 4. Reduce Nesting

**Rule:** Early returns reduce cognitive load.

```javascript
// BEFORE: Deep nesting
function processRequest(data) {
  if (data) {
    if (data.user) {
      if (hasPermission(data.user)) {
        // Actual logic here
      }
    }
  }
}

// AFTER: Early returns
function processRequest(data) {
  if (!data) return null;
  if (!data.user) return null;
  if (!hasPermission(data.user)) return null;
  
  // Actual logic here
}
```

### 5. Prefer Composition Over Inheritance

```javascript
// Instead of class inheritance
class Animal {}
class Dog extends Animal {}
class Cat extends Animal {}

// Use composition
const canBark = {
  bark() { console.log('Woof'); }
};

const canMeow = {
  meow() { console.log('Meow'); }
};

const dog = { ...canBark };
const cat = { ...canMeow };
```

## Simplification Checklist

### Code Structure
- [ ] No function > 50 lines
- [ ] No file > 800 lines
- [ ] No deeply nested code (> 4 levels)
- [ ] No repeated code blocks

### Naming
- [ ] Variables explain their purpose
- [ ] Functions are named by what they do
- [ ] Boolean variables use `is`, `has`, `can` prefixes
- [ ] No single-letter names (except loops)

### Logic
- [ ] Early returns for error cases
- [ ] Clear conditional logic
- [ ] No complex ternaries chained
- [ ] Switch cases have default

### Reusability
- [ ] Shared logic extracted to utilities
- [ ] Constants defined (no magic numbers)
- [ ] Helper functions created for repeated patterns

## Examples

### Example: Simplifying a Long Function

```markdown
## Simplification: AttendanceManager.updateStatus

**Before:** 85 lines
**After:** 45 lines

### Changes Made

1. Extracted date validation → `isValidDate()`
2. Extracted status validation → `isValidStatus()`
3. Extracted storage key generation → `getStorageKey()`
4. Added early returns for error cases

### Result
- More readable
- Easier to test
- Reusable utilities
```

## Tips

1. **Don't over-engineer** - Simple is better than clever
2. **Test after each change** - Ensure functionality preserved
3. **One change at a time** - Easier to track what broke
4. **Keep related code together** - Reduces cognitive load
5. **Comment why, not what** - Code should be self-documenting