# Security Guidelines

## Mandatory Security Checks

### Before ANY Commit
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated and sanitized
- [ ] XSS prevention (sanitize HTML user input)
- [ ] Authentication/authorization verified on all data access
- [ ] Error messages don't leak sensitive data
- [ ] No console.log statements in production code
- [ ] Role-based access control enforced

## User Input Security

### Validation
```javascript
// Selalu validasi input pengguna
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '').trim();
}

function validateSantriId(id) {
  if (!id || typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}
```

### HTML Sanitization
- Never use `innerHTML` with user-generated content
- Use `textContent` or sanitized HTML only
- Escape special characters in user display

## Secret Management

- NEVER hardcode secrets in source code
- Use LocalStorage or environment variables
- Validate required secrets at startup
- Rotate any secrets that may have been exposed

## Data Privacy

- Santri data is sensitive — treat with care
- Only show data to authorized users based on role
- Audit trail for all sensitive operations
- No data leakage in error messages

## Security Response Protocol

If security issue found:
1. STOP immediately
2. Fix CRITICAL issues before continuing
3. Review entire codebase for similar issues
4. Test the fix thoroughly