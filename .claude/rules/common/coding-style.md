# Coding Style — Common Rules

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:

```javascript
// SALAH: Mutation
function updateSantri(santri, status) {
  Object.assign(santri, { status });
  return santri;
}

// BENAR: Immutable
function updateSantri(santri, status) {
  return { ...santri, status };
}
```

## Core Principles

### KISS (Keep It Simple)
- Prefer the simplest solution that works
- Avoid premature optimization
- Optimize for clarity over cleverness

### DRY (Don't Repeat Yourself)
- Extract repeated logic into shared functions
- Avoid copy-paste implementation drift
- Introduce abstractions when repetition is real

### YAGNI (You Aren't Gonna Need It)
- Do not build features before they are needed
- Avoid speculative generality
- Start simple, then refactor when needed

## File Organization

MANY SMALL FILES > FEW LARGE FILES:
- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Organize by feature/domain, not by type

## Error Handling

ALWAYS handle errors comprehensively:
- Handle errors explicitly at every level
- Provide user-friendly error messages in UI-facing code
- Log detailed error context in managers
- Never silently swallow errors

```javascript
// Contoh pattern error handling
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}
```

## Input Validation

ALWAYS validate at system boundaries:
- Validate all user input before processing
- Fail fast with clear error messages
- Never trust external data (LocalStorage, API responses)

## Naming Conventions

- Variables and functions: `camelCase`
- Booleans: `is`, `has`, `should`, `can` prefixes
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case`
- Private methods: `_prefixedWithUnderscore`

## Code Smells to Avoid

### Deep Nesting
- Avoid more than 3 levels of nesting
- Use early returns

### Magic Numbers
- Use named constants for meaningful thresholds

### Long Functions
- Split functions > 50 lines into focused pieces

## Code Quality Checklist

Before marking work complete:
- [ ] Code is readable and well-named
- [ ] Functions are small (< 50 lines)
- [ ] Files are focused (< 800 lines)
- [ ] No deep nesting (> 4 levels)
- [ ] Proper error handling
- [ ] No hardcoded values
- [ ] Immutability patterns used
- [ ] No console.log in production code