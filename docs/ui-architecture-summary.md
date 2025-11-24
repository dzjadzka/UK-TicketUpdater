# UI Architecture - Quick Reference

> **Complete documentation**: See [ui-information-architecture.md](./ui-information-architecture.md) for full details including user flows, states, and implementation notes.

## User Roles

| Role | Key Capabilities |
|------|------------------|
| **User** | Self-service: credentials, device profiles, ticket history |
| **Admin** | All user capabilities + user management + system operations + observability |

## Page Overview

### 🔓 Public Pages (No Auth)

| Page | URL | Main Purpose |
|------|-----|--------------|
| Login | `/login` | User authentication |
| Register | `/register?token=<token>` | Invite-based registration |

### 👤 User Pages (JWT Required)

| Page | URL | Main Purpose | Primary API Endpoints |
|------|-----|--------------|----------------------|
| Dashboard | `/dashboard` | Home with ticket status & quick actions | `GET /me`, `GET /me/credentials`, `GET /me/tickets` |
| Settings | `/settings` | Manage UK credentials & auto-download | `GET /me/credentials`, `PUT /me/credentials` |
| Device Profiles | `/device-profiles` | Custom device profile management | `GET/POST/PUT/DELETE /device-profiles` |
| Tickets | `/tickets` | Ticket download history | `GET /me/tickets` |
| Profile | `/profile` | User profile view/edit | `GET /me` |

### 👨‍💼 Admin Pages (JWT + Admin Role Required)

| Page | URL | Main Purpose | Primary API Endpoints |
|------|-----|--------------|----------------------|
| Admin Overview | `/admin/overview` | System dashboard with stats & job controls | `GET /admin/overview`, `GET /admin/observability/*`, `POST /admin/jobs/*` |
| Admin Users | `/admin/users` | User list with search/filters | `GET /admin/users` |
| Admin User Detail | `/admin/users/:id` | Full user profile & management | `GET /admin/users/:id`, `PUT /admin/users/:id`, `GET /tickets/:userId` |
| Admin Invites | `/admin/invites` | Invite token management | `GET/POST/DELETE /admin/invites` |
| Admin Observability | `/admin/observability` | System monitoring & job logs | `GET /admin/observability/errors`, `GET /admin/observability/job-summary`, etc. |

## API Endpoints by Category

### 🔐 Authentication (No Auth Required)

```
POST /auth/register     - Register with invite token
POST /auth/login        - Login with email/password
POST /auth/logout       - Logout (client-side JWT removal)
```

### 👤 User Self-Service (JWT Required)

```
GET    /me                  - Get current user profile
GET    /me/credentials      - Get masked UK credentials
PUT    /me/credentials      - Update UK credentials & auto-download
GET    /me/tickets          - List current user's tickets
DELETE /me                  - Soft delete account
```

### 🔧 Device Profiles (JWT Required)

```
GET    /device-profiles     - List custom profiles
POST   /device-profiles     - Create profile
PUT    /device-profiles/:id - Update profile
DELETE /device-profiles/:id - Delete profile
```

### 👨‍💼 Admin - Users (JWT + Admin Required)

```
GET    /admin/users         - List/search users (q, status, errors params)
GET    /admin/users/:id     - Full user details
PUT    /admin/users/:id     - Update user
DELETE /admin/users/:id     - Soft delete user
```

### 👨‍💼 Admin - Invites (JWT + Admin Required)

```
POST   /admin/invites       - Generate invite token
GET    /admin/invites       - List all invites
DELETE /admin/invites/:token - Delete invite
```

### 👨‍💼 Admin - Jobs (JWT + Admin Required)

```
POST /admin/jobs/check-base-ticket - Trigger base ticket check
POST /admin/jobs/download-all      - Trigger download for all users
```

### 👨‍💼 Admin - Overview & Stats (JWT + Admin Required)

```
GET /admin/overview - System overview stats
```

### 👨‍💼 Admin - Observability (JWT + Admin Required)

```
GET /admin/observability/errors      - Recent errors (limit param)
GET /admin/observability/job-summary - Job summary (hours param)
GET /admin/observability/queue       - Queue metrics
GET /admin/observability/base-ticket - Base ticket state
```

### 📊 Health & Metrics (No Auth Required)

```
GET /health   - Liveness check
GET /ready    - Readiness check (DB + queue)
GET /metrics  - Prometheus metrics
```

## Key User Flows

### 1. New User Onboarding
```
Admin creates invite → User registers → Auto-login → Dashboard → Add credentials
```

### 2. Ticket Download (Automatic)
```
Scheduler checks base ticket (6h) → Hash changed? → Queue user downloads → Users see new tickets
```

### 3. Admin User Management
```
Admin overview → User list → Search/filter → User detail → Edit/disable/delete
```

### 4. Device Profile Setup
```
Dashboard → Device Profiles → Create custom profile → Configure (viewport, user-agent, etc.) → Save
```

## UI States (All Pages)

| State | UI Treatment |
|-------|--------------|
| **Loading** | Skeleton loaders, spinners, disabled inputs |
| **Empty** | Empty state message + CTA to add data |
| **Error** | Error banner/toast + retry option |
| **Success** | Display data + enable interactions |

## Common Components

- **Layout**: Navigation + header + footer
- **ProtectedRoute**: Auth check + admin check
- **LoadingSpinner**: Reusable loading indicator
- **ErrorBanner**: Error display with retry
- **SuccessToast**: Success feedback
- **ConfirmDialog**: Confirmation modal
- **DataTable**: Table with sort/filter/pagination
- **FormField**: Input with validation

## Tech Stack

### Frontend
- React 18 + Vite
- React Router
- Tailwind CSS
- Axios (API client)
- React Context (state)

### Backend
- Node.js 18+ + Express 5
- SQLite (better-sqlite3)
- JWT + bcrypt
- Puppeteer (browser automation)
- Jest + Playwright (testing)

## Current Frontend Status

### ✅ Implemented Features:
- Login/Register pages
- Dashboard (basic with credential status)
- Settings (credentials management)
- Device Profiles (full CRUD)
- Admin Overview (stats + job triggers)
- Admin Users (list + detail)
- Auth flow + JWT handling
- Protected routes (user/admin)

### ❌ Planned Features (Not Yet Implemented):
These are described in the architecture as **ideal state** features that can be added incrementally:

- **Separate Tickets page**: Currently, ticket history is shown in dashboard. A dedicated page would provide more advanced features (filtering, sorting, pagination, detailed views).
- **Standalone Profile page**: Profile data is currently integrated in Settings. A separate page could be added for consistency or simplified navigation.
- **Dedicated Admin Invites page**: Invite functionality exists via API. UI can be a standalone page or remain integrated in Admin Overview as modal/section.
- **Comprehensive Admin Observability dashboard**: Basic metrics shown in Admin Overview. A dedicated page could add advanced monitoring, charts, and real-time job tracking.
- **Advanced features**: Real-time updates (WebSocket/SSE), notification system, export functionality (CSV/PDF), bulk actions.

### Implementation Flexibility
The architecture describes pages that can be implemented as:
- **Standalone pages**: Full dedicated routes (e.g., `/tickets`, `/profile`, `/admin/invites`)
- **Integrated sections**: Combined into existing pages to reduce clicks (e.g., Profile in Settings)
- **Modal overlays**: Quick actions without page navigation (e.g., Create Invite modal in Admin Overview)

Choose the approach based on user needs, navigation complexity, and responsive design requirements.

## Next Steps for Frontend Development

1. **Complete Missing Pages**
   - Separate Tickets page with full history
   - Standalone Profile page
   - Admin Invites management page
   - Admin Observability dashboard

2. **Enhance Existing Pages**
   - Dashboard: Add recent activity feed, charts
   - Settings: Add password change, locale selector
   - Admin Users: Add bulk actions, advanced filters
   - Admin User Detail: Add full ticket history table

3. **Improve UX**
   - Add real-time updates (polling or WebSocket)
   - Implement optimistic updates
   - Add loading skeletons everywhere
   - Improve error handling with specific messages
   - Add success/error toasts consistently

4. **Performance Optimization**
   - Implement code splitting for admin pages
   - Add virtual scrolling for large tables
   - Cache API responses
   - Lazy load images/components

5. **Accessibility**
   - Add ARIA labels
   - Keyboard navigation
   - Screen reader support
   - Focus management

6. **Testing**
   - Unit tests for components
   - Integration tests for flows
   - E2E tests for critical paths
   - Accessibility tests

## References

- **Full Architecture Document**: [ui-information-architecture.md](./ui-information-architecture.md)
- **System Architecture**: [architecture.md](./architecture.md)
- **Database Schema**: [db-schema.md](./db-schema.md)
- **Operations Guide**: [operations.md](./operations.md)
