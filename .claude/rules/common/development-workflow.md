# Development Workflow

## Research First

1. **Check existing patterns** — Look at similar code in codebase
2. **Search npm** — Prefer battle-tested libraries over hand-rolled solutions
3. **Look at docs** — Use MDN, TailwindCSS docs for API behavior

## Feature Development

### 1. Understand the requirement
- Read PRD.md and design.md for context
- Check existing similar features
- Identify affected files

### 2. Plan if complex
- For new features > 100 lines, create implementation plan
- Identify dependencies and risks
- Break into small, testable pieces

### 3. Implement
- Follow coding standards (see coding-style.md)
- Use immutable patterns
- Add proper error handling
- Keep functions small and focused

### 4. Review
- Check for security issues
- Verify immutability patterns
- Ensure error handling
- Test in browser

### 5. Commit
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`
- Example: `feat: add bulk attendance action`

## File Change Guidelines

### Adding New Manager
1. Place in `src/managers/`
2. Follow naming: `*-manager.js`
3. Use class or module pattern with clear API
4. Add JSDoc for public methods
5. Handle errors gracefully

### Adding New Component
1. Place in appropriate directory (modals, pages, widgets)
2. Use HTML template pattern
3. Keep it focused (< 200 lines)
4. Include proper ARIA labels

### Modifying Existing Files
1. Check if similar pattern exists elsewhere
2. Update all references if renaming
3. Test related functionality

## PWA Development

- Test offline functionality
- Verify service worker registration
- Check manifest.json is valid
- Test install prompt
- Lighthouse audit before significant changes