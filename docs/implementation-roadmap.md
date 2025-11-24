# Implementation Roadmap for Production Readiness

This document tracks the implementation of issues identified in the UI review (`docs/ui-review-and-fixes.md`).

## Priority P0 (Critical - Must Fix Before Production)

### Issue 3: Robust Form Validation ✅ In Progress

**Labels**: priority: P0, area: forms, area: UX

**Tasks:**

- [ ] Add email format validation (regex)
- [ ] Add password strength validation (min 8 chars, complexity)
- [ ] Add required field validation
- [ ] Show inline validation errors
- [ ] Prevent submission when validation fails
- [ ] Add ARIA announcements for validation errors

**Acceptance Criteria:**

- Invalid forms show clear errors before API call
- All required fields are marked and validated
- Validation errors announced to screen readers

**Files to Update:**

- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/pages/Settings.jsx`
- `frontend/src/pages/DeviceProfiles.jsx`

---

### Issue 4: Accessibility Improvements ✅ In Progress

**Labels**: priority: P0, area: accessibility

**Tasks:**

- [ ] Add ARIA labels to icon-only buttons
- [ ] Implement "Skip to main content" link
- [ ] Ensure keyboard navigation works (Tab order)
- [ ] Add visible focus indicators
- [ ] Add role="alert" to error messages
- [ ] Add role="status" to success messages

**Acceptance Criteria:**

- App navigable with keyboard only
- Screen readers announce controls/notifications
- Skip link present and functional
- Passes Lighthouse a11y audit

**Files to Update:**

- `frontend/src/components/Layout.jsx`
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Tickets.jsx`
- All form pages

---

## Priority P1 (High - Should Fix Soon)

### Issue 5: Add Pagination

**Labels**: priority: P1, area: performance, area: UX

**Tasks:**

- [ ] Add pagination to Tickets page
- [ ] Add pagination to AdminUsers page
- [ ] Add page navigation controls
- [ ] Preserve filters when paginating
- [ ] Add query params for page state

**Acceptance Criteria:**

- Lists load quickly with 1000+ items
- Pagination state in URL
- Filters preserved across pages

**Files to Update:**

- `frontend/src/pages/Tickets.jsx`
- `frontend/src/admin/AdminUsers.jsx`

---

### Issue 6: Forgot Password Flow

**Labels**: priority: P1, area: auth, area: UX

**Tasks:**

- [ ] Add "Forgot password?" link to Login
- [ ] Create password reset request page
- [ ] Create password reset form page
- [ ] Wire to backend endpoints
- [ ] Add success/error states

**Acceptance Criteria:**

- Users can recover access via email
- Handles invalid/expired tokens
- Covered by basic tests

**Files to Create:**

- `frontend/src/pages/ForgotPassword.jsx`
- `frontend/src/pages/ResetPassword.jsx`

---

### Issue 7: Dashboard Error Details

**Labels**: priority: P1, area: UX, area: observability

**Tasks:**

- [ ] Add error tooltips to Dashboard cards
- [ ] Show error messages in ticket list
- [ ] Add expandable error details
- [ ] Sanitize error messages

**Acceptance Criteria:**

- Failed tickets show why they failed
- Hover/click reveals diagnostic info
- No sensitive data exposed

**Files to Update:**

- `frontend/src/pages/Dashboard.jsx`

---

### Issue 8: Responsive Fixes

**Labels**: priority: P1, area: responsive, area: UX

**Tasks:**

- [ ] Fix table horizontal scrolling
- [ ] Adjust card gaps for all breakpoints
- [ ] Test on mobile (375px)
- [ ] Test on tablet (768px)
- [ ] Test on desktop (1920px)

**Acceptance Criteria:**

- No horizontal overflow on mobile
- Layout consistent on all breakpoints
- Visual glitches resolved

**Files to Update:**

- `frontend/src/pages/DeviceProfiles.jsx`
- `frontend/src/admin/AdminUsers.jsx`
- `frontend/src/pages/Tickets.jsx`

---

### Issue 9: Retry & Error Handling

**Labels**: priority: P1, area: stability, area: networking

**Tasks:**

- [ ] Implement automatic retry for transient errors
- [ ] Add user-friendly timeout messages
- [ ] Detect expired sessions
- [ ] Centralize error handling

**Acceptance Criteria:**

- Network issues don't permanently break UI
- Expired sessions handled gracefully
- Consistent error handling across pages

**Files to Update:**

- `frontend/src/services/api.js`
- Add error boundary component

---

### Issue 10: Admin Metadata Display

**Labels**: priority: P1, area: admin, area: observability

**Tasks:**

- [ ] Add last_login_at to AdminUsers table
- [ ] Add created_at to AdminUsers table
- [ ] Add queue metrics to AdminOverview
- [ ] Add viewport sizes to DeviceProfiles table

**Acceptance Criteria:**

- Admins see user activity overview
- Job queue health visible
- DeviceProfiles show dimensions

**Files to Update:**

- `frontend/src/admin/AdminUsers.jsx`
- `frontend/src/admin/AdminOverview.jsx`
- `frontend/src/pages/DeviceProfiles.jsx`

---

## Implementation Order

1. **Phase 1 (P0 - This Sprint)**
   - Issue 3: Form Validation
   - Issue 4: Accessibility

2. **Phase 2 (P1 - Next Sprint)**
   - Issue 5: Pagination
   - Issue 7: Dashboard Error Details
   - Issue 8: Responsive Fixes

3. **Phase 3 (P1 - Following Sprint)**
   - Issue 6: Forgot Password
   - Issue 9: Retry & Error Handling
   - Issue 10: Admin Metadata

## Progress Tracking

- **Issues Completed**: 0/8
- **P0 Issues Completed**: 0/2
- **P1 Issues Completed**: 0/6

---

## Notes

- All issues derived from `docs/ui-review-and-fixes.md`
- Each issue should be completed with tests
- Document any API changes needed
- Update this roadmap as issues are completed
