# Feature Implementation Plan

## Overview

This document tracks all planned and in-progress features discovered from repository documentation. It serves as the master inventory for systematic implementation.

**Last Updated**: 2025-11-20  
**Repository**: UK-TicketUpdater  
**Current Version**: 1.1.0

---

## Feature Inventory

| ID | Source | Summary | Status | Risk | Priority |
|----|--------|---------|--------|------|----------|
| F001 | FRONTEND_IMPROVEMENT_PLAN.md | React/Vite frontend scaffold with dev tooling | planned | medium | high |
| F002 | FRONTEND_IMPROVEMENT_PLAN.md | Invite-only authentication system with token-based auth | planned | high | high |
| F003 | FRONTEND_IMPROVEMENT_PLAN.md | Credential & device management UI (CRUD operations) | planned | medium | high |
| F004 | FRONTEND_IMPROVEMENT_PLAN.md | Download triggers and status/history views | planned | low | medium |
| F005 | FRONTEND_IMPROVEMENT_PLAN.md | Ticket file access and retention controls | planned | low | low |
| F006 | FRONTEND_IMPROVEMENT_PLAN.md | Internationalization (EN/DE) with react-i18next | planned | low | medium |
| F007 | FRONTEND_IMPROVEMENT_PLAN.md | Frontend testing with Vitest/RTL and quality gates | planned | medium | medium |
| F008 | FRONTEND_IMPROVEMENT_PLAN.md | Dev/prod configuration with environment variables | planned | low | high |
| F009 | FRONTEND_IMPROVEMENT_PLAN.md | Component library and layout system with theming | planned | low | low |
| F010 | MULTIUSER_EXPANSION_PLAN.md | Role-based access control (admin/user roles) | done | high | high |
| F011 | MULTIUSER_EXPANSION_PLAN.md | Invitation-only onboarding flow | done | high | high |
| F012 | MULTIUSER_EXPANSION_PLAN.md | Enhanced device emulation with proxy/geolocation support | in_progress | medium | medium |
| F013 | MULTIUSER_EXPANSION_PLAN.md | Queue-driven job runner with BullMQ/Redis | planned | high | low |
| F014 | MULTIUSER_EXPANSION_PLAN.md | Password encryption at rest with local key storage | done | high | high |
| F015 | REPOSITORY_ANALYSIS.md | Externalize credentials via environment variables/config | done | high | high |
| F016 | REPOSITORY_ANALYSIS.md | Health checks for download success validation | planned | medium | medium |
| F017 | REPOSITORY_ANALYSIS.md | Lightweight CLI with option parsing (yargs/commander) | planned | low | low |
| F018 | REPOSITORY_ANALYSIS.md | Browser context reuse to reduce resource usage | planned | low | low |
| F019 | REPOSITORY_ANALYSIS.md | Docker support with Dockerfile and docker-compose | planned | low | low |

---

## Prioritized Feature Queue

### Phase 1: Core Backend Enhancements (Foundation)
**Goal**: Establish secure, robust backend foundation before frontend work

#### 1. Authentication & Authorization System (F010, F011, F014)
**Priority**: CRITICAL  
**Dependencies**: None  
**Risk**: High (security-critical)

**Specification**:
- Implement role-based access control with two roles: `admin` and `user`
- Add invite token generation and validation system
- Implement JWT-based authentication or session management
- Add password hashing with bcrypt/argon2
- Store encrypted credentials with local key management

**Expected Behavior**:
- Admins can generate invite tokens that expire after use or timeout
- New users can only register with valid invite tokens
- Passwords are never stored in plaintext
- API endpoints respect role-based permissions
- Tokens include user ID, role, and expiration

**Edge Cases**:
- Expired invite tokens should be rejected
- Duplicate registrations should be prevented
- Password reset flow for existing users
- Token refresh for long-running sessions

**API/Schema Changes**:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  invite_token TEXT,
  invited_by TEXT,
  locale TEXT DEFAULT 'en',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invite_tokens (
  token TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  used_by TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
```

**New API Endpoints**:
- `POST /auth/register` - Accept invite and create user
- `POST /auth/login` - Authenticate and receive token
- `POST /auth/refresh` - Refresh authentication token
- `POST /auth/logout` - Invalidate token
- `POST /admin/invites` - Generate invite token (admin only)
- `GET /admin/invites` - List invite tokens (admin only)
- `DELETE /admin/invites/:token` - Revoke invite token (admin only)
- `GET /admin/users` - List all users (admin only)
- `PUT /admin/users/:id/disable` - Disable user account (admin only)

**Integration Points**:
- All existing API endpoints need auth middleware
- Database schema updates required
- Environment variables: JWT_SECRET, TOKEN_EXPIRY

**Tasks**:
1. Add bcrypt dependency and password hashing utilities
2. Design and implement users table schema
3. Create invite token generation and validation logic
4. Implement JWT token creation and verification middleware
5. Add authentication endpoints (register, login, refresh, logout)
6. Add admin-only invite management endpoints
7. Update existing API endpoints with auth middleware
8. Add comprehensive tests for auth flows
9. Document authentication in README and API docs

---

#### 2. Credential Management System (F015)
**Priority**: HIGH  
**Dependencies**: F010 (Auth system)  
**Risk**: High (credential security)

**Specification**:
- Move all credentials from hardcoded values to secure storage
- Support environment variables for deployment configs
- Add database table for user credentials (login credentials for ticket site)
- Encrypt sensitive credential data at rest

**Expected Behavior**:
- Credentials never appear in source code or logs
- Each user can manage multiple credential sets
- Credentials are encrypted before database storage
- Support for credential rotation without code changes

**Edge Cases**:
- Handle missing environment variables gracefully
- Validate credential format before storage
- Prevent credential exposure in error messages
- Handle encryption key rotation

**API/Schema Changes**:
```sql
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  login_name TEXT NOT NULL,
  login_password_encrypted TEXT NOT NULL,
  label TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**New API Endpoints**:
- `GET /credentials` - List user's credentials
- `POST /credentials` - Create new credential set
- `PUT /credentials/:id` - Update credential set
- `DELETE /credentials/:id` - Delete credential set
- `GET /credentials/:id` - Get specific credential (without password)

**Environment Variables**:
- `ENCRYPTION_KEY` - Key for encrypting credentials at rest
- `API_TOKEN` - Already exists, document usage
- `DB_PATH` - Already exists
- `PORT` - Already exists

**Integration Points**:
- Update downloader.js to accept credential objects
- Modify download endpoints to use credential IDs
- Add encryption/decryption layer for sensitive data

**Tasks**:
1. Add crypto utilities for encryption/decryption
2. Create credentials table schema and migrations
3. Implement credential CRUD API endpoints
4. Update downloader to accept credential objects instead of hardcoded values
5. Add environment variable validation and documentation
6. Create example .env.sample file
7. Add credential management tests
8. Update documentation with security best practices

---

### Phase 2: Enhanced Backend Features

#### 3. Enhanced Device Profile Management (F012)
**Priority**: MEDIUM  
**Dependencies**: F010 (Auth), F015 (Credentials)  
**Risk**: Medium

**Specification**:
- Allow users to create and manage custom device profiles
- Add proxy and geolocation configuration per profile
- Extend device profiles with custom user agents and viewports
- Persist user-specific device profiles in database

**Expected Behavior**:
- Users can clone existing profiles and customize
- Profiles can include proxy settings (URL, auth)
- Optional geolocation override for testing
- Profiles are validated before use

**Edge Cases**:
- Invalid proxy URLs should be rejected
- Viewport dimensions must be positive integers
- Malformed user agents should be caught
- Circular profile references prevented

**API/Schema Changes**:
```sql
CREATE TABLE device_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  viewport_width INTEGER NOT NULL,
  viewport_height INTEGER NOT NULL,
  locale TEXT DEFAULT 'de-DE',
  timezone TEXT DEFAULT 'Europe/Berlin',
  proxy_url TEXT,
  geolocation_latitude REAL,
  geolocation_longitude REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**New API Endpoints**:
- `GET /device-profiles` - List user's device profiles
- `POST /device-profiles` - Create custom profile
- `PUT /device-profiles/:id` - Update profile
- `DELETE /device-profiles/:id` - Delete profile
- `GET /device-profiles/presets` - List system presets

**Integration Points**:
- Update deviceProfiles.js to support custom profiles
- Modify downloader to apply proxy and geolocation settings
- Update download endpoints to accept device profile IDs

**Tasks**:
1. Create device_profiles table schema
2. Implement device profile CRUD endpoints
3. Add proxy configuration to Puppeteer launch options
4. Add geolocation override in browser context
5. Validate device profile configurations
6. Add tests for custom device profiles
7. Update documentation with device profile examples

---

#### 4. Download Health Checks & Validation (F016)
**Priority**: MEDIUM  
**Dependencies**: None  
**Risk**: Medium

**Specification**:
- Validate successful authentication before considering download complete
- Check for expected ticket content in downloaded HTML
- Add retry logic for transient failures
- Improve error messages with actionable information

**Expected Behavior**:
- Downloads fail fast if authentication fails
- Ticket HTML is validated for expected content markers
- Failed downloads return specific error codes
- History records include detailed failure reasons

**Edge Cases**:
- Network timeouts during authentication
- Unexpected page structure changes
- Cookie/session expiration mid-download
- Concurrent downloads with same credentials

**API/Schema Changes**:
- Update history table with more detailed error information
- Add validation_status field to tickets table

**Integration Points**:
- Enhance downloader.js with validation steps
- Update history recording with validation results
- Add health check endpoint for monitoring

**Tasks**:
1. Add content validation after ticket download
2. Implement retry logic with exponential backoff
3. Improve error messages and categorization
4. Add validation status to history records
5. Create health check endpoint for monitoring
6. Add comprehensive tests for validation logic
7. Document validation criteria and error codes

---

### Phase 3: Frontend Development

#### 5. Frontend Scaffold (F001, F008)
**Priority**: HIGH (for frontend phase)  
**Dependencies**: F010 (Auth API), F015 (Credentials API)  
**Risk**: Medium

**Specification**:
- Set up React + Vite project in `frontend/` directory
- Configure Tailwind CSS for styling
- Set up development and production builds
- Configure API proxy to backend during development
- Add environment variable handling

**Expected Behavior**:
- `npm run dev:frontend` starts development server
- `npm run build:frontend` creates production build
- Hot module replacement works during development
- API calls proxy to backend in dev mode
- Production build is optimized and minified

**Tasks**:
1. Initialize Vite + React project in frontend/ directory
2. Install and configure Tailwind CSS
3. Set up Vite proxy for API calls
4. Create .env.frontend.example with API_BASE_URL
5. Add npm scripts to root package.json for frontend commands
6. Configure build output directory
7. Update .gitignore for frontend artifacts
8. Create basic App shell with routing
9. Add development documentation to README

---

#### 6. Authentication UI (F002)
**Priority**: HIGH (for frontend phase)  
**Dependencies**: F001 (Frontend scaffold), F010 (Auth API)  
**Risk**: Medium

**Specification**:
- Create invite acceptance and signup page
- Create login page with email and password
- Implement secure token storage (memory + httpOnly cookies)
- Add route guards for protected pages
- Create logout functionality

**Expected Behavior**:
- Users can accept invite with token and set password
- Login form validates credentials and stores token
- Protected routes redirect to login if unauthenticated
- Token is included in all API requests
- Logout clears token and redirects to login

**Tasks**:
1. Create signup page with invite token input
2. Create login page with email/password form
3. Implement auth context and token storage
4. Create route guard HOC/component
5. Add logout button and functionality
6. Add form validation with helpful error messages
7. Style forms consistently with design system
8. Add tests for auth flows
9. Document authentication flow

---

#### 7. Credential & Device Management UI (F003, F012)
**Priority**: HIGH (for frontend phase)  
**Dependencies**: F002 (Auth UI), F015 (Credentials API)  
**Risk**: Low

**Specification**:
- Create credential management page with CRUD operations
- Create device profile management page
- Add forms for creating/editing credentials and profiles
- Display lists with search and filtering
- Implement inline validation

**Expected Behavior**:
- Users can view all their credentials and profiles
- Create/edit forms validate input before submission
- Deletion requires confirmation
- Search/filter works across fields
- Changes are immediately reflected in lists

**Tasks**:
1. Create credentials list component with table/cards
2. Create credential form (create/edit)
3. Add credential deletion with confirmation
4. Create device profiles list and forms
5. Add device profile presets selector
6. Implement search and filtering
7. Add form validation and error handling
8. Style components consistently
9. Add tests for CRUD operations

---

#### 8. Download Management & History (F004)
**Priority**: MEDIUM (for frontend phase)  
**Dependencies**: F003 (Credential UI)  
**Risk**: Low

**Specification**:
- Create page to trigger downloads per credential
- Display download history with status and details
- Show in-progress downloads with status updates
- Provide access to downloaded ticket files

**Expected Behavior**:
- Users can trigger downloads for selected credentials
- History table shows all past downloads with status
- In-progress downloads show real-time status
- Users can download or view ticket HTML files
- Pagination works for large history lists

**Tasks**:
1. Create download trigger interface
2. Create history table with sorting and pagination
3. Add status badges (success, failed, in-progress)
4. Implement ticket file download/view
5. Add filtering by date range and status
6. Show detailed error messages for failures
7. Style with consistent design
8. Add tests for download flows

---

#### 9. Internationalization (F006)
**Priority**: LOW  
**Dependencies**: F001 (Frontend scaffold)  
**Risk**: Low

**Specification**:
- Set up react-i18next with EN and DE locales
- Translate all UI strings to both languages
- Add language switcher component
- Persist language preference

**Expected Behavior**:
- All UI text uses translation keys
- Language switcher changes locale immediately
- Selected language persists across sessions
- Dates and numbers format according to locale

**Tasks**:
1. Install and configure react-i18next
2. Create translation files for EN and DE
3. Wrap all UI strings with translation function
4. Create language switcher component
5. Persist language preference in localStorage
6. Add date/number formatting helpers
7. Test all pages in both languages
8. Document translation process for contributors

---

### Phase 4: Advanced Features (Future)

#### 10. Job Queue System (F013)
**Priority**: LOW  
**Dependencies**: F010, F015  
**Risk**: High

**Note**: This is a more advanced feature that may not be needed initially. Consider implementing only if:
- Concurrent download volume requires queuing
- Need better isolation between downloads
- Want to scale across multiple workers

**Specification**:
- Implement job queue with BullMQ or similar
- Queue downloads instead of running immediately
- Support job prioritization and retry logic
- Add worker process for executing jobs

---

#### 11. Component Library & Theming (F009)
**Priority**: LOW  
**Dependencies**: F001 (Frontend scaffold)  
**Risk**: Low

**Specification**:
- Create reusable component library
- Implement dark/light theme support
- Ensure consistent styling across app
- Add theme preference persistence

---

#### 12. Frontend Testing & Quality (F007)
**Priority**: MEDIUM (during frontend development)  
**Dependencies**: F001 (Frontend scaffold)  
**Risk**: Medium

**Specification**:
- Set up Vitest or Jest for component testing
- Add React Testing Library
- Write tests for critical user flows
- Add ESLint and Prettier for frontend
- Set up pre-commit hooks

---

#### 13. Docker Support (F019)
**Priority**: LOW  
**Dependencies**: None  
**Risk**: Low

**Specification**:
- Create Dockerfile for production deployment
- Create docker-compose.yml for development
- Include Chromium in Docker image
- Document Docker deployment process

---

#### 14. CLI Improvements (F017, F018)
**Priority**: LOW  
**Dependencies**: None  
**Risk**: Low

**Specification**:
- Replace custom parseArgs with yargs or commander
- Add better help text and usage examples
- Implement browser context reuse
- Add progress indicators for downloads

---

## Implementation Guidelines

### Before Starting Each Feature
1. Read all relevant source files
2. Understand current implementation
3. Identify all integration points
4. Review tests for affected areas

### During Implementation
1. Make minimal, focused changes
2. Test each change incrementally
3. Keep existing functionality working
4. Add tests alongside code changes

### After Implementation
1. Run full test suite
2. Update documentation
3. Mark feature as complete in this file
4. Report progress with git commit

### Code Style Requirements
- Follow existing ESLint configuration
- Use Prettier formatting
- Add JSDoc comments for public functions
- Match existing naming conventions
- Keep functions small and focused

---

## Risk Assessment

### High Risk Features
- F010: Authentication system (security-critical)
- F011: Invite system (security-critical)
- F014: Password encryption (security-critical)
- F015: Credential management (data security)
- F013: Job queue (architectural complexity)

### Medium Risk Features
- F001: Frontend scaffold (architectural decision)
- F003: Credential UI (data handling)
- F007: Frontend testing (tooling complexity)
- F012: Enhanced device profiles (Puppeteer complexity)
- F016: Health checks (validation logic)

### Low Risk Features
- F004: Download UI (read-only views)
- F005: Ticket file access (file serving)
- F006: Internationalization (UI strings)
- F008: Environment config (configuration)
- F009: Component library (styling)
- F017: CLI improvements (developer experience)
- F018: Browser reuse (optimization)
- F019: Docker support (deployment)

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Users can be created with invite tokens
- [ ] Authentication works on all API endpoints
- [ ] Credentials are stored encrypted
- [ ] Device profiles can be customized
- [ ] Downloads validate success/failure
- [ ] All tests pass with >60% coverage

### Phase 2 Complete When:
- [ ] Backend APIs support all frontend needs
- [ ] Health checks prevent invalid downloads
- [ ] Custom device profiles work with proxy/geo settings
- [ ] Error handling is comprehensive

### Phase 3 Complete When:
- [ ] Frontend is deployed and accessible
- [ ] Users can register and login
- [ ] All CRUD operations work in UI
- [ ] Downloads can be triggered from UI
- [ ] History is viewable and filterable
- [ ] Both EN and DE locales work

### Phase 4 Complete When:
- [ ] All planned features are implemented
- [ ] Documentation is comprehensive
- [ ] Test coverage is >80%
- [ ] Docker deployment works
- [ ] System is production-ready

---

## Notes

- This plan follows the principle of making minimal, incremental changes
- Each phase builds on previous phases
- High-risk features are addressed first to validate architecture
- Frontend development waits for stable backend APIs
- All features maintain backward compatibility where possible
- Security is prioritized throughout implementation

---

## Implementation Progress

### Completed Features

#### F010: Role-based Access Control ✅
- **Status**: Complete
- **Date**: 2024-11-20
- **Implementation**: 
  - Added admin and user roles to database schema
  - Implemented requireAdmin middleware for protected endpoints
  - All admin endpoints enforce role checks
  - Users can only access their own resources

#### F011: Invitation-only Onboarding ✅
- **Status**: Complete
- **Date**: 2024-11-20
- **Implementation**:
  - Invite token generation with configurable expiration
  - Admin-only invite management endpoints
  - Registration validates invite tokens
  - Tokens are single-use and expire after 72 hours (configurable)
  - Tokens track who created them and who used them

#### F014: Password Encryption at Rest ✅
- **Status**: Complete
- **Date**: 2024-11-20
- **Implementation**:
  - Bcrypt password hashing with 10 rounds
  - AES-256-GCM encryption for credential storage
  - Configurable encryption key via ENCRYPTION_KEY env var
  - Password strength validation enforced
  - All sensitive data encrypted before database storage

#### F015: Externalized Credentials ✅
- **Status**: Complete
- **Date**: 2024-11-20
- **Implementation**:
  - .env.example file with all configuration options
  - Support for JWT_SECRET, ENCRYPTION_KEY, API_TOKEN
  - Encrypted credential storage in database
  - Full CRUD API for credential management
  - Credentials scoped to user accounts

#### F012: Enhanced Device Emulation ✅
- **Status**: Complete
- **Date**: 2024-11-21
- **Implementation**:
  - Database schema with proxy_url, geolocation fields, and timezone
  - Full CRUD API endpoints for custom device profiles
  - Validation function for all device profile fields
  - Downloader integration with timezone, geolocation, and proxy support
  - Automatic detection of custom profiles (UUID format)
  - 15 new tests for validation logic
  - Documentation with examples

---

**Status**: Phase 1 complete (5/5 features)
