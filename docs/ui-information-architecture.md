# UI Information Architecture

## Overview

This document provides a comprehensive information architecture for the UK-TicketUpdater web UI, including user roles, flows, page specifications, and API endpoint mappings.

## User Roles and Flows

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **User** | Standard registered user | - View/update own profile and credentials<br>- Manage UK ticket credentials<br>- Create/manage custom device profiles<br>- View own ticket history<br>- Download own tickets<br>- Opt in/out of auto-download |
| **Admin** | System administrator | - All user permissions<br>- View all users<br>- Manage user accounts (enable/disable/delete)<br>- Update user credentials<br>- Generate invite tokens<br>- Trigger manual download jobs<br>- View system observability data<br>- Access job logs and error reports |

### Core User Flows

#### 1. New User Registration Flow
```
1. Admin generates invite token → /admin/invites (POST)
2. User receives invite link with token
3. User clicks invite link → /register?token=<invite_token>
4. User fills registration form (email, password, locale, auto-download preference)
5. System validates invite token → /auth/register (POST)
6. User is logged in automatically with JWT
7. User is redirected to dashboard → /dashboard
8. User adds UK credentials → /settings
```

#### 2. Existing User Login Flow
```
1. User visits login page → /login
2. User enters email and password
3. System validates credentials → /auth/login (POST)
4. JWT token stored in localStorage
5. User redirected to dashboard → /dashboard
```

#### 3. Ticket Download Flow
```
User initiated:
1. User navigates to dashboard → /dashboard
2. User clicks "Download Now" button
3. System enqueues download job → /downloads (POST) [Admin only in current API]
4. User sees "Queued" status
5. Background job processes download
6. User refreshes ticket history → /me/tickets (GET)
7. User sees new ticket version

Automatic:
1. Scheduler checks base ticket every 6 hours
2. If ticket changed, system enqueues downloads for all users with auto_download_enabled
3. User can view results in ticket history
```

#### 4. Credential Management Flow
```
1. User navigates to settings → /settings
2. User views masked UK credentials → /me/credentials (GET)
3. User updates UK number and/or password → /me/credentials (PUT)
4. User toggles auto-download → /me/credentials (PUT)
5. System encrypts and stores credentials
6. User sees confirmation
```

#### 5. Device Profile Management Flow
```
1. User navigates to device profiles → /device-profiles
2. User views list of custom profiles → /device-profiles (GET)
3. User creates new profile with custom settings → /device-profiles (POST)
   - User agent, viewport size, locale, timezone, proxy, geolocation
4. User edits existing profile → /device-profiles/:id (PUT)
5. User deletes profile → /device-profiles/:id (DELETE)
```

#### 6. Admin User Management Flow
```
1. Admin navigates to admin overview → /admin/overview
2. Admin views system stats and recent errors → /admin/overview (GET)
3. Admin navigates to user list → /admin/users
4. Admin searches/filters users → /admin/users?q=<query>&status=<status> (GET)
5. Admin clicks user to view details → /admin/users/:id
6. Admin views full user profile → /admin/users/:id (GET)
7. Admin updates user (credentials, flags) → /admin/users/:id (PUT)
8. Admin disables/deletes user → /admin/users/:id (DELETE)
```

#### 7. Admin Invite Management Flow
```
1. Admin navigates to admin overview → /admin/overview
2. Admin clicks "Create Invite"
3. Admin sets expiration hours
4. System generates invite token → /admin/invites (POST)
5. Admin copies invite link
6. Admin shares link with new user
7. Admin can view/revoke invites → /admin/invites (GET/DELETE)
```

#### 8. Admin Job Trigger Flow
```
1. Admin navigates to admin overview → /admin/overview
2. Admin clicks "Check Base Ticket Now" → /admin/jobs/check-base-ticket (POST)
3. System queues base ticket check job
4. Admin sees "Queued" status
5. Admin clicks "Download All Tickets" → /admin/jobs/download-all (POST)
6. System queues download jobs for all active users
7. Admin views job results in observability section
```

## Page Specifications

### Public Pages (No Authentication Required)

| Page | URL | Purpose | API Endpoints | Key UI Elements | States |
|------|-----|---------|--------------|-----------------|--------|
| **Login** | `/login` | User authentication | `POST /auth/login` | - Email input<br>- Password input<br>- Login button<br>- "Register" link | **Loading**: Disable form, show spinner<br>**Error**: Show error message (invalid credentials, account disabled)<br>**Success**: Redirect to dashboard |
| **Register** | `/register?token=<invite_token>` | New user registration with invite token | `POST /auth/register` | - Invite token (pre-filled from URL)<br>- Email input<br>- Password input<br>- Locale selector<br>- Auto-download checkbox<br>- Register button | **Loading**: Disable form, show spinner<br>**Error**: Show error message (invalid token, token expired, email exists, weak password)<br>**Success**: Redirect to dashboard |

### User Pages (Authentication Required)

| Page | URL | Purpose | API Endpoints | Key UI Elements | States |
|------|-----|---------|--------------|-----------------|--------|
| **Dashboard** | `/dashboard` | User home page with ticket status and quick actions | `GET /me`<br>`GET /me/credentials`<br>`GET /me/tickets` | - Welcome message with user email<br>- Credential status card (configured/not configured)<br>- Latest ticket info (version, date)<br>- Auto-download status indicator<br>- Quick action buttons (Update Credentials, View Tickets)<br>- Recent activity feed | **Loading**: Show skeleton loaders<br>**Empty**: Show onboarding prompts if no credentials<br>**Error**: Show error banner with retry<br>**Success**: Display all data with real-time status |
| **Settings** | `/settings` | Manage UK credentials and auto-download | `GET /me/credentials`<br>`PUT /me/credentials`<br>`DELETE /me` | - Profile section (email, locale, role)<br>- UK credentials form (number masked, password hidden)<br>- Auto-download toggle<br>- Save button<br>- Last login status (success/error)<br>- Delete account button (with confirmation) | **Loading**: Disable form during save<br>**Empty**: Show "No credentials" if not configured<br>**Error**: Show validation/save errors inline<br>**Success**: Show success toast, update masked values |
| **Device Profiles** | `/device-profiles` | Create and manage custom device profiles | `GET /device-profiles`<br>`POST /device-profiles`<br>`PUT /device-profiles/:id`<br>`DELETE /device-profiles/:id` | - Preset profiles info section<br>- Custom profiles list table<br>- "Create Profile" button<br>- Profile form modal (name, user agent, viewport, locale, timezone, proxy, geolocation)<br>- Edit/Delete actions per profile | **Loading**: Show table skeleton<br>**Empty**: Show "No custom profiles" message with create CTA<br>**Error**: Show error in modal for validation/save failures<br>**Success**: Update table, close modal, show success toast |
| **Tickets** | `/tickets` or `/me/tickets` | View ticket download history | `GET /me/tickets` | - Tickets table (version, date, status)<br>- Download links for successful tickets<br>- Error messages for failed downloads<br>- Filter by status (all/success/error)<br>- Sort by date<br>- Pagination | **Loading**: Show table skeleton<br>**Empty**: Show "No tickets yet" message<br>**Error**: Show error banner<br>**Success**: Display paginated table with filters |
| **Profile** | `/profile` or integrated in `/settings` | View and update user profile | `GET /me`<br>`PUT /me` (if profile editing is implemented) | - Email (read-only)<br>- Role badge (user/admin)<br>- Locale selector<br>- Created date<br>- Account status | **Loading**: Show skeleton<br>**Error**: Show error banner<br>**Success**: Display profile data |

### Admin Pages (Admin Role Required)

| Page | URL | Purpose | API Endpoints | Key UI Elements | States |
|------|-----|---------|--------------|-----------------|--------|
| **Admin Overview** | `/admin/overview` | System-wide dashboard with stats and quick actions | `GET /admin/overview`<br>`GET /admin/observability/errors`<br>`GET /admin/observability/job-summary`<br>`GET /admin/observability/queue`<br>`GET /admin/observability/base-ticket`<br>`POST /admin/jobs/check-base-ticket`<br>`POST /admin/jobs/download-all` | - User count cards (total, active, disabled, deleted)<br>- Login errors count<br>- Base ticket state (hash, last checked)<br>- Queue metrics (pending, running, completed, failed)<br>- Recent errors list (limit 10)<br>- Job summary (last 24h)<br>- Action buttons (Check Base Ticket, Download All, Create Invite)<br>- Quick links (Users, Invites) | **Loading**: Show skeleton for each section<br>**Error**: Show error per section (others still load)<br>**Success**: Display all metrics with auto-refresh option |
| **Admin Users** | `/admin/users` | List and search all users | `GET /admin/users?q=<query>&status=<status>&errors=<true/false>` | - Search bar (email/ID)<br>- Status filter tabs (Active, Disabled, Deleted, All)<br>- Show errors only checkbox<br>- Users table (email, role, status, auto-download, last login status, created date)<br>- Actions per user (View, Edit, Disable, Delete)<br>- Pagination | **Loading**: Show table skeleton<br>**Empty**: Show "No users found" for filters<br>**Error**: Show error banner<br>**Success**: Display filtered/paginated table |
| **Admin User Detail** | `/admin/users/:id` | Full user profile and management | `GET /admin/users/:id`<br>`PUT /admin/users/:id`<br>`DELETE /admin/users/:id`<br>`GET /tickets/:userId` | - User profile card (email, role, status, dates)<br>- Credential summary (masked UK number, last login status/error/date)<br>- Latest ticket info (version, date, status)<br>- Ticket statistics (total downloads, success rate)<br>- Full ticket history table<br>- Edit forms (UK credentials, auto-download, is_active)<br>- Action buttons (Save, Disable Account, Delete Account) | **Loading**: Show skeleton for sections<br>**Error**: Show error per section<br>**Success**: Display all data with inline editing |
| **Admin Invites** | `/admin/invites` or modal in `/admin/overview` | Manage invite tokens | `GET /admin/invites`<br>`POST /admin/invites`<br>`DELETE /admin/invites/:token` | - "Create Invite" button<br>- Invite creation form (expiration hours)<br>- Invites table (token, created by, expires at, used by, created date)<br>- Copy link button per invite<br>- Delete button per unused invite<br>- Status indicator (active/expired/used) | **Loading**: Show table skeleton during fetch<br>**Empty**: Show "No invites" message<br>**Error**: Show error in form/delete action<br>**Success**: Update table, show success toast with copy-to-clipboard |
| **Admin Observability** | `/admin/observability` | Detailed system monitoring and job logs | `GET /admin/observability/errors?limit=<n>`<br>`GET /admin/observability/job-summary?hours=<n>`<br>`GET /admin/observability/queue`<br>`GET /admin/observability/base-ticket` | - Time range selector (1h, 6h, 24h, 7d)<br>- Refresh button/auto-refresh toggle<br>- Error log table (timestamp, user, message, type)<br>- Job summary cards (total, success, failed, retries)<br>- Queue metrics (backend, pending, running, completed, failed, retries)<br>- Base ticket state (hash, effective from, last checked)<br>- Charts/graphs for job trends | **Loading**: Show section skeletons<br>**Empty**: Show "No errors/jobs in timeframe"<br>**Error**: Show error per section<br>**Success**: Display all data with real-time updates option |

### Shared Components

| Component | Purpose | Props | States |
|-----------|---------|-------|--------|
| **Layout** | Main app layout with navigation | `children`, `hideNav` (for login/register) | - Show user menu with logout<br>- Highlight active nav item<br>- Show admin nav section only for admins |
| **ProtectedRoute** | Route wrapper for authentication check | `children`, `adminOnly` | - Redirect to /login if not authenticated<br>- Show 403 if adminOnly and not admin |
| **LoadingSpinner** | Reusable loading indicator | `size`, `message` | - Show/hide based on loading state |
| **ErrorBanner** | Display error messages | `error`, `onRetry`, `onDismiss` | - Show error message with retry option<br>- Auto-dismiss after timeout |
| **SuccessToast** | Show success feedback | `message`, `duration` | - Slide in from top/corner<br>- Auto-dismiss after duration |
| **ConfirmDialog** | Confirmation modal for destructive actions | `title`, `message`, `onConfirm`, `onCancel` | - Show modal overlay<br>- Disable confirm during action |
| **DataTable** | Reusable table with sorting/filtering/pagination | `columns`, `data`, `onSort`, `onFilter`, `onPageChange` | - Show loading skeleton<br>- Show empty state<br>- Handle pagination |
| **FormField** | Reusable form input with validation | `label`, `type`, `value`, `onChange`, `error`, `required` | - Show validation errors<br>- Show required indicator |

## API Endpoint Summary

### Authentication & User Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | None | Register new user with invite token |
| `/auth/login` | POST | None | Login with email/password |
| `/auth/logout` | POST | JWT | Logout (client-side token removal) |
| `/me` | GET | JWT | Get current user profile |
| `/me/credentials` | GET | JWT | Get current user's UK credentials (masked) |
| `/me/credentials` | PUT | JWT | Update UK credentials and auto-download |
| `/me/tickets` | GET | JWT | List current user's tickets |
| `/me` | DELETE | JWT | Soft delete current user account |

### Device Profiles

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/device-profiles` | GET | JWT | List user's custom device profiles |
| `/device-profiles` | POST | JWT | Create new device profile |
| `/device-profiles/:id` | PUT | JWT | Update device profile |
| `/device-profiles/:id` | DELETE | JWT | Delete device profile |

### Admin - User Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/users` | GET | JWT + Admin | List/search users with filters |
| `/admin/users/:id` | GET | JWT + Admin | Get full user details |
| `/admin/users/:id` | PUT | JWT + Admin | Update user credentials/flags |
| `/admin/users/:id` | DELETE | JWT + Admin | Soft delete user |

### Admin - Invite Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/invites` | POST | JWT + Admin | Generate new invite token |
| `/admin/invites` | GET | JWT + Admin | List all invite tokens |
| `/admin/invites/:token` | DELETE | JWT + Admin | Delete invite token |

### Admin - Jobs & Operations

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/jobs/check-base-ticket` | POST | JWT + Admin | Trigger base ticket check |
| `/admin/jobs/download-all` | POST | JWT + Admin | Trigger download for all users |
| `/admin/overview` | GET | JWT + Admin | Get system overview stats |

### Admin - Observability

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/admin/observability/errors` | GET | JWT + Admin | Get recent errors (limit query param) |
| `/admin/observability/job-summary` | GET | JWT + Admin | Get job summary (hours query param) |
| `/admin/observability/queue` | GET | JWT + Admin | Get queue metrics |
| `/admin/observability/base-ticket` | GET | JWT + Admin | Get base ticket state |

### Legacy/Admin Endpoints (Currently Admin-Only)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/downloads` | POST | JWT + Admin | Trigger download for specific users |
| `/history` | GET | JWT + Admin | Get download history (limit query param) |
| `/tickets/:userId` | GET | JWT + Admin | Get tickets for specific user |

### Health & Metrics

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | None | Liveness check |
| `/ready` | GET | None | Readiness check (DB + queue) |
| `/metrics` | GET | None | Prometheus metrics |

## UI States Reference

### Common States Across All Pages

| State | Description | UI Treatment |
|-------|-------------|--------------|
| **Loading** | Data is being fetched or action is in progress | - Show skeleton loaders or spinners<br>- Disable interactive elements<br>- Show loading text |
| **Empty** | No data available (first time or after filters) | - Show empty state illustration/icon<br>- Provide helpful message<br>- Show CTA to create/add data |
| **Error** | Request failed or validation error | - Show error message with details<br>- Provide retry button<br>- Log error for debugging |
| **Success** | Data loaded or action completed successfully | - Display data in appropriate format<br>- Show success toast for actions<br>- Enable all interactions |

### Page-Specific States

#### Dashboard States
- **New User**: No credentials configured → Show onboarding card with setup CTA
- **Credentials Configured, No Tickets**: Show "waiting for first download" message
- **Auto-Download Disabled**: Show prompt to enable auto-download
- **Recent Error**: Highlight last login error with fix suggestions

#### Settings States
- **First Time Setup**: Empty credentials → Show info about UK number/password
- **Update Mode**: Existing credentials → Mask UK number, hide password, show last login status
- **Save Success**: Show success message, update displayed values
- **Delete Account Confirmation**: Show warning modal before deletion

#### Device Profiles States
- **No Custom Profiles**: Show preset info + create prompt
- **Profile Form**: Validate fields in real-time, show examples for each field
- **Delete Confirmation**: Show warning modal listing profile name

#### Admin Users States
- **Search Results**: Show count, highlight matching text
- **Filter Applied**: Show active filter badge with clear option
- **Errors Only**: Highlight users with login errors

#### Admin User Detail States
- **User Not Found**: Show 404 error with back link
- **Deleted User**: Show warning banner, limit actions
- **Inline Editing**: Show save/cancel buttons when form is dirty

#### Admin Overview States
- **Base Ticket Check Running**: Disable "Check Now" button, show progress
- **Download All Running**: Disable button, show queued count
- **No Recent Errors**: Show success message

## Notes for Implementation

### Authentication & Security
- Store JWT in `localStorage` for persistence
- Add token to all authenticated requests via axios interceptor
- Redirect to `/login` on 401 responses
- Clear token on logout
- Implement CSRF protection for forms if needed

### User Experience
- Use optimistic updates where appropriate (device profiles, settings)
- Implement debounced search (300ms delay)
- Add loading indicators for all async operations
- Use toast notifications for transient feedback
- Use modals for confirmations and forms
- Implement auto-refresh for dashboard/observability pages (every 30-60s)

### Accessibility
- All forms must have proper labels and ARIA attributes
- Error messages must be announced to screen readers
- Keyboard navigation must work for all interactive elements
- Color contrast must meet WCAG 2.1 AA standards
- Focus indicators must be visible

### Performance
- Lazy load admin pages (code splitting)
- Implement virtual scrolling for large tables
- Cache API responses where appropriate
- Use React.memo for expensive components
- Implement pagination for all lists (default 50 items per page)

### Mobile Responsiveness
- All pages must be responsive (mobile-first approach)
- Use hamburger menu for navigation on mobile
- Tables should scroll horizontally or switch to card layout
- Forms should stack vertically on mobile
- Touch targets should be at least 44x44px

### Error Handling
- Network errors: Show "Connection lost" message with retry
- Validation errors: Show inline per field
- Server errors: Show error code and user-friendly message
- 403 Forbidden: Redirect to dashboard with "Access denied" message
- 404 Not Found: Show custom 404 page with navigation

### Future Enhancements
- Add real-time updates via WebSocket or Server-Sent Events
- Implement notification system for job completions
- Add export functionality for ticket history (CSV/PDF)
- Add bulk actions for admin user management
- Implement user-configurable dashboard widgets
- Add system logs viewer for admins
- Implement two-factor authentication (2FA)
- Add password reset flow (currently placeholder)
