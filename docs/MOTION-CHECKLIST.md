# Motion System Validation Checklist

**Project:** Samsya Attendance System  
**Version:** 1.0.0  
**Date:** 2026-06-19  
**Status:** Draft - Ready for Implementation

---

## Quick Reference: Motion Tokens

### Duration Scale
| Token | Value | Use Case |
|-------|-------|----------|
| `micro` | 100ms | Button press feedback |
| `fast` | 150ms | Hover, focus states |
| `standard` | 200ms | Tabs, toggles, small transitions |
| `comfortable` | 250ms | Dropdowns, tooltips, moderate panels |
| `large` | 300ms | Cards, modals, major components |
| `page` | 350ms | Full page/view transitions |
| `emphasis` | 400ms | Success/error feedback |
| `celebration` | 600ms | Success animations |

### Easing Scale
| Token | Value | Character |
|-------|-------|-----------|
| `standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Balanced, natural |
| `enter` | `cubic-bezier(0, 0, 0.2, 1)` | Elements appearing |
| `exit` | `cubic-bezier(0.4, 0, 1, 1)` | Elements disappearing |
| `emphasized` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Attention, bounce |
| `decelerate` | `cubic-bezier(0, 0, 0.2, 1)` | Natural slowdown |
| `accelerate` | `cubic-bezier(0.4, 0, 1, 1)` | Natural speed up |

---

## Pre-Flight Check

### CSS Variables
```css
:root {
  /* Durations */
  --motion-micro: 100ms;
  --motion-fast: 150ms;
  --motion-standard: 200ms;
  --motion-comfortable: 250ms;
  --motion-large: 300ms;
  --motion-page: 350ms;
  --motion-emphasis: 400ms;
  
  /* Easings */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-emphasized: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);
}
```

**Pre-Flight Checklist:**
- [ ] CSS variables defined in `:root`
- [ ] `prefers-reduced-motion` media query added
- [ ] Tailwind config updated with custom durations
- [ ] No inline animation/transition values remaining

---

## Component Validation

### Buttons

**Criteria:**
- [ ] Hover: 150ms, `scale(1.02)`, subtle shadow increase
- [ ] Press: 100ms, `scale(0.96)`, no delay
- [ ] Focus: 150ms, ring appears (accessibility)
- [ ] Disabled: 150ms, `opacity(0.5)`, no pointer events
- [ ] Loading: Continuous, spinner visible

**Common Issues:**
- ❌ Press scale too aggressive (`scale(0.9)`)
- ❌ Hover transition too slow (>200ms)
- ❌ Missing focus state

---

### Cards

**Criteria:**
- [ ] Hover lift: 200ms, `translateY(-2px)`, shadow increase
- [ ] Press: 100ms, `scale(0.98)`
- [ ] Expand: 300ms, height + opacity
- [ ] Collapse: 200ms, height + opacity

**Sticky Hero Cards:**
- [ ] Collapse: 240ms all properties synced
- [ ] No property transitioning at different speeds
- [ ] Smooth scroll into sticky position

---

### Modals & Bottom Sheets

**Modal Criteria:**
- [ ] Open: 300ms, `scale(0.95→1)` + `opacity(0→1)`
- [ ] Close: 200ms, `scale(1→0.95)` + `opacity(1→0)`
- [ ] Backdrop: 200ms fade

**Bottom Sheet Criteria:**
- [ ] Open: 300ms, `translateY(100%→0)`
- [ ] Close: 250ms, `translateY(0→100%)`
- [ ] Drag gesture works smoothly

---

### Toast Notifications

**Criteria:**
- [ ] Enter: 250ms, `translateY(-20px→0)` + fade
- [ ] Exit: 200ms, `translateY(0→-20px)` + fade
- [ ] Auto-dismiss: 3000ms
- [ ] Click to dismiss: Immediate response + 200ms exit

**Validation:**
```css
/* Enter */
animation: toastEnter 250ms cubic-bezier(0, 0, 0.2, 1) forwards;

/* Exit */
animation: toastExit 200ms cubic-bezier(0.4, 0, 1, 1) forwards;
```

---

### Tabs & Navigation

**Tab Criteria:**
- [ ] Switch: 200ms, no content flash
- [ ] Indicator: Slides smoothly with 200ms
- [ ] Content: Cross-fades or slides

**Bottom Nav:**
- [ ] Item hover: 150ms, subtle scale
- [ ] Active expand: 200ms, label reveals
- [ ] No jank during expand

---

### Search & Filter

**Search Pill Criteria:**
- [ ] Expand: 250ms, width grows smoothly
- [ ] Collapse: 200ms, width shrinks
- [ ] Focus triggers smoothly
- [ ] Results appear with 200ms fade

---

### Loading States

**Skeleton:**
- [ ] Pulse: 1500ms ease-in-out
- [ ] Shimmer: 2000ms linear (if used)
- [ ] No layout shift during load

**Spinner:**
- [ ] Continuous rotation, 800ms per rotation
- [ ] Respects `prefers-reduced-motion`

**Progress Bar:**
- [ ] Width change: 300ms ease-out
- [ ] No jerky movement

---

### Success, Error, Empty States

**Success:**
- [ ] 400ms total animation
- [ ] Scale: 0.8→1.05→1 (emphasized)
- [ ] Checkmark draws or fades in

**Error:**
- [ ] 300ms shake animation
- [ ] 3 shakes, ±4px displacement
- [ ] Color changes to red smoothly

**Empty:**
- [ ] 300ms fade in
- [ ] Icon may have subtle bounce
- [ ] Text appears with slight delay

---

### Lists & Items

**Insert:**
- [ ] 300ms, fade + slide from above
- [ ] No layout shift for other items

**Delete:**
- [ ] 200ms fade out
- [ ] Height collapses smoothly
- [ ] No empty space remains

**Update:**
- [ ] 250ms highlight flash
- [ ] Settles back to normal

---

### Page/View Transitions

**View Switch:**
- [ ] Enter: 350ms, fade + slide
- [ ] Exit: 250ms, fade out
- [ ] No white flash between views

**Attendance Screen:**
- [ ] Open: 350ms slide up + fade
- [ ] Close: 250ms slide down + fade

---

### Special Cases: Qibla Finder

| Element | Duration | Easing | Notes |
|---------|----------|--------|-------|
| Background | 1000ms | ease-in-out | State transitions |
| Needle | 500ms | ease-out | Direction changes |
| Angle text | 500ms | ease-out | Value updates |
| Alignment | 500ms | ease-out | Color changes |
| Success pulse | 1800ms | ease-in-out | Infinite loop |
| Kaaba enter | 700ms | ease-out | First appearance |

---

## Performance Checklist

### GPU Acceleration
- [ ] Only `transform` and `opacity` animated
- [ ] No `width`, `height`, `margin`, `padding` animations
- [ ] `will-change` used sparingly and removed after animation

### No Layout Trashing
- [ ] No reading layout properties in animation loop
- [ ] `requestAnimationFrame` used for JS animations
- [ ] Animations don't cause scroll jank

### Frame Rate
- [ ] Maintains 60fps on mobile
- [ ] No dropped frames during transitions
- [ ] Reduced motion on low-end devices

---

## Accessibility Checklist

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Validation:**
- [ ] Media query present
- [ ] All animations respect preference
- [ ] Critical UI still functional

### Focus Management
- [ ] Focus trapped in modals
- [ ] Focus returned on modal close
- [ ] Focus visible on all interactive elements

---

## Cross-Platform Check

### Mobile (Primary)
- [ ] Touch feedback immediate (<100ms)
- [ ] No hover-only interactions
- [ ] Bottom sheet works with swipe
- [ ] Performance on low-end devices

### Desktop
- [ ] Hover states work
- [ ] Keyboard navigation smooth
- [ ] Focus indicators visible

### Dark Mode
- [ ] Transitions work with theme change
- [ ] No jarring color flashes
- [ ] Shadows adjust appropriately

---

## Test Scenarios

### Smoke Tests
1. [ ] Open app → loading feels fast but not instant
2. [ ] Login → smooth transition to dashboard
3. [ ] Click attendance → full-screen slides up
4. [ ] Tap status button → immediate visual feedback
5. [ ] Close attendance → slides back smoothly
6. [ ] Open modal → smooth scale-in
7. [ ] Close modal → smooth scale-out
8. [ ] Submit form → success toast appears
9. [ ] Error occurs → error feedback visible
10. [ ] Scroll → hero card collapses smoothly

### Performance Tests
1. [ ] Open attendance with 50+ students
2. [ ] Rapidly tap multiple status buttons
3. [ ] Open/close modal 10 times rapidly
4. [ ] Scroll through long list
5. [ ] Check DevTools for dropped frames

### Edge Cases
1. [ ] Very long toast message
2. [ ] Modal with large content
3. [ ] Rapid tab switching
4. [ ] Offline mode transitions
5. [ ] Network error during loading

---

## Validation Sign-Off

### Implementation Complete
- [ ] All CSS variables defined
- [ ] No inline animation values
- [ ] All components use motion tokens
- [ ] Performance validated
- [ ] Accessibility validated

### Code Review
- [ ] Motion tokens documented in code
- [ ] No magic numbers for durations
- [ ] Comments explain unusual timing
- [ ] Reduced motion properly implemented

### QA Sign-Off
- [ ] Manual testing complete
- [ ] Performance testing complete
- [ ] Accessibility testing complete
- [ ] Edge cases handled

---

## Quick Fix Reference

### "Animation feels slow"
→ Reduce duration by 50ms

### "Animation feels rushed"
→ Increase duration by 50ms

### "Animation feels robotic"
→ Change easing from `ease` to `ease-out`

### "Animation causes jank"
→ Use only `transform` and `opacity`

### "Animation too bouncy"
→ Change from `ease-emphasized` to `ease-out`

### "Transition feels abrupt"
→ Add 50-100ms to duration

---

*Document Version: 1.0.0*  
*Last Updated: 2026-06-19*  
*Next Review: After implementation*