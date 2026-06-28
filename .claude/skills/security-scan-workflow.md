# Security Scan Workflow

## When to Use

Use this skill when:
- Before committing code to production
- After adding user input handling
- When working with authentication/authorization
- When adding third-party scripts or dependencies
- When handling sensitive data (santri information)

## Security Checklist

### 1. Input Validation

- [ ] All user inputs are validated before processing
- [ ] Input type, length, format checked
- [ ] Special characters sanitized
- [ ] SQL injection prevention (if using DB)

```javascript
// Validate Santri ID format
function isValidSantriId(id) {
  return /^[a-zA-Z0-9_-]{1,20}$/.test(String(id));
}

// Sanitize text input
function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>'"&]/g, '').trim();
}
```

### 2. XSS Prevention

- [ ] No `innerHTML` with user-generated content
- [ ] Use `textContent` for displaying user data
- [ ] If HTML needed, use sanitization library

```javascript
// SAFE: Display user input
element.textContent = userInput;

// If HTML is needed (only for trusted content):
element.innerHTML = DOMPurify.sanitize(userHTML);
```

### 3. Authentication & Authorization

- [ ] Role-based access control enforced
- [ ] Users can only access their own data
- [ ] Admin actions require admin role
- [ ] No auth bypass vulnerabilities

```javascript
// Check role before data access
function getSantriForUser(santriId, user) {
  const Santri = findSantri(santriId);
  
  // Authorization check
  if (user.role === 'wali' && Santri.waliId !== user.id) {
    throw new Error('Unauthorized access');
  }
  
  return Santri;
}
```

### 4. Data Privacy

- [ ] No sensitive data in console logs
- [ ] Error messages don't leak internals
- [ ] Santri data treated as sensitive (PII)
- [ ] No data leakage between users

```javascript
// BAD - sensitive data in error
throw new Error(`Database error: ${connectionString}`);

// GOOD - generic error
throw new Error('An error occurred. Please try again.');
```

### 5. Storage Security

- [ ] No sensitive data in LocalStorage without encryption
- [ ] LocalStorage data validated on read
- [ ] Proper error handling for storage operations

```javascript
// Validate data from storage
function getStoredData(key) {
  try {
    const data = localStorage.getItem(key);
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    
    return parsed;
  } catch (e) {
    console.error('Storage read error');
    return null;
  }
}
```

### 6. PWA Security

- [ ] Service worker from trusted source
- [ ] No sensitive data in service worker cache
- [ ] HTTPS enforced for production

## Common Vulnerabilities to Watch

### Reflected XSS
User input reflected in page without sanitization.

### Stored XSS
Malicious script stored and later executed.

### Authorization Bypass
User accessing data they shouldn't see.

### Information Disclosure
Error messages or logs revealing system internals.

### Insecure Storage
Sensitive data in easily accessible storage.

## Response Protocol

If **CRITICAL** vulnerability found:

1. **STOP** - Don't continue until fixed
2. **REPORT** - Document the vulnerability clearly
3. **FIX** - Apply the fix immediately
4. **TEST** - Verify the fix works
5. **SCAN** - Run full security scan again

## Report Format

```markdown
## Security Scan Report

**Date:** [date]
**Scope:** [files/pages reviewed]

### Vulnerabilities Found

| Severity | Type | Location | Description | Fix |
|----------|------|----------|-------------|-----|
| CRITICAL | XSS | line 45 | innerHTML with user input | Use textContent |

### Summary
- Total: N
- Critical: X
- High: Y
- Medium: Z

### Recommendations
[General security improvements]
```