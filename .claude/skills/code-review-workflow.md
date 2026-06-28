# Code Review Workflow

## When to Use

Use this skill when:
- You just finished implementing a feature
- You're about to commit changes
- You want to identify potential bugs or improvements
- You're reviewing another developer's code

## How It Works

### 1. Gather Changed Files
Identify all files that were modified or added:
```bash
git diff --name-only
git diff --cached --name-only
```

### 2. Review Each File

For **JavaScript files**, check:
- [ ] Functions are small (< 50 lines)
- [ ] Proper error handling with try-catch
- [ ] Immutability patterns (spread operators, no mutation)
- [ ] No `console.log` statements
- [ ] Input validation on public methods
- [ ] XSS-safe DOM manipulation (use textContent, not innerHTML with user data)
- [ ] Clear, descriptive naming
- [ ] JSDoc for public APIs

For **HTML files**, check:
- [ ] Proper semantic HTML
- [ ] ARIA labels on interactive elements
- [ ] Accessible focus states
- [ ] No inline event handlers (use addEventListener)

For **CSS files**, check:
- [ ] CSS variables for theme values
- [ ] No duplicate styles
- [ ] Responsive breakpoints make sense

### 3. Check for Common Issues

#### Immutability Violations
```javascript
// BAD - mutates original object
function updateStatus(santri, newStatus) {
  Object.assign(santri, { status: newStatus });
  return santri;
}

// GOOD - returns new object
function updateStatus(santri, newStatus) {
  return { ...santri, status: newStatus };
}
```

#### XSS Vulnerabilities
```javascript
// BAD - XSS risk
element.innerHTML = userInput;

// GOOD - safe
element.textContent = userInput;
```

#### Missing Error Handling
```javascript
// BAD - errors silently swallowed
function getData(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    // empty catch
  }
}

// GOOD - proper error handling
function getData(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    console.error('Failed to parse data:', e);
    return null;
  }
}
```

### 4. Report Findings

Group findings by severity:
- **CRITICAL**: Security vulnerabilities, data loss risks
- **HIGH**: Bugs, broken functionality
- **MEDIUM**: Performance issues, maintainability concerns
- **LOW**: Style preferences, minor improvements

## Examples

### Example Review Checklist

```markdown
## Code Review: Feature Attendance Bulk Action

**Files:** 
- `src/js/attendance-bulk.js`
- `src/components/modals/modal-bulk-actions.html`

### Issues Found

| Severity | File | Line | Issue | Fix |
|----------|------|------|-------|-----|
| HIGH | attendance-bulk.js | 45 | Mutation detected | Use spread operator |
| MEDIUM | modal-bulk-actions.html | 23 | Missing aria-label | Add aria-label |

### Summary
- Total: 2 issues
- Critical: 0
- High: 1
- Medium: 1

### Recommendations
Consider extracting the status validation into a shared utility.
```

## Tips

1. **Be specific** - Reference exact lines and provide code snippets
2. **Explain why** - Don't just say "bad", explain the consequence
3. **Offer solutions** - Suggest concrete fixes
4. **Distinguish severity** - Not everything is equally important
5. **Consider context** - Prototype code has different standards than production