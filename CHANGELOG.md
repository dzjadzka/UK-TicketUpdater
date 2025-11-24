# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Deprecated

- CLI flag `--source` now emits a deprecation warning and will be removed in v1.1.0. Use `--users` instead.

### Changed

- Removed JSON users mode. The CLI and app now operate exclusively with the SQLite database. `users.sample.json` is retained as a legacy example but no longer used by scripts.

## [1.0.0] - 2025-11-22

This is the first major release of UK-TicketUpdater, marking the completion of Phases 1-4 and establishing a production-ready multi-user ticket automation system.

### Summary

UK-TicketUpdater is now a complete, release-ready system with:

- **Hardened API** with JWT authentication, invite-only registration, and multi-level rate limiting
- **Persistent job queue** (SQLite-backed) with scheduler, retry logic, and restart safety
- **React frontend** for users (credential/profile management, ticket history) and admins (user management, job control, observability)
- **Production-grade observability** with structured logging, health probes, metrics endpoints, and audit trails
- **Docker deployment** with docker-compose configuration and multi-stage builds
- **Comprehensive test coverage** with Jest, Playwright e2e, and CI/CD automation

This release represents the culmination of 4 major development phases and over 175 automated tests.

### Added - Phase 1 (Authentication & User Management)

- **JWT Authentication System**:
  - User registration with invite-only tokens
  - Email/password login with JWT token generation
  - Token verification middleware for API endpoints
  - Password strength validation (8+ chars, upper, lower, number)
  - Email format validation
  - Configurable token expiry (default 7 days)

- **User Management**:
  - Role-based access control (admin/user roles)
  - Invite token generation and management (admin only)
  - User account enable/disable functionality
  - List all users endpoint for admins
  - Password hashing with bcrypt (10 rounds)

- **Credential Management**:
  - Encrypted credential storage with AES-256-GCM
  - Full CRUD API for ticket site credentials
  - User-scoped credential access
  - Label support for organizing multiple credentials

- **Custom Device Profiles** (F012 Complete):
  - User-defined device profiles with custom user agents
  - Viewport configuration per profile
  - Proxy URL configuration with validation
  - Geolocation (latitude/longitude) support with range validation
  - Timezone emulation (e.g., America/New_York, Europe/Berlin)
  - Locale customization per profile
  - Full integration with downloader (auto-detects custom profiles by UUID)
  - Comprehensive validation function with detailed error reporting
  - 15 new tests for device profile validation

- **Enhanced Database Schema**:
  - Updated users table with email, password_hash, role, locale, is_active
  - New invite_tokens table with expiration tracking
  - New credentials table with encrypted password storage
  - New device_profiles table for user-specific configurations
  - Database indexes for improved query performance

- **Security Enhancements**:
  - Environment variable support for JWT_SECRET and ENCRYPTION_KEY
  - Example .env file with all configuration options
  - Secure password storage (never plaintext)
  - Encrypted credential storage at rest
  - Protected admin endpoints with role checks

- **Testing**:
  - 60 new tests total (45 auth + 15 device profiles)
  - Comprehensive integration tests for auth API endpoints
  - Device profile validation tests (required fields, proxy, geolocation)
  - Test coverage increased from 52 to 112 tests
  - Tests for password hashing, JWT tokens, encryption, and validation

### Added - Phase 2 (Background Job System)

- **Job Queue & Scheduler**:
  - Background job queue with in-memory and SQLite-backed persistence options
  - Automatic scheduler for periodic base ticket checks (configurable interval, default 6h)
  - Configurable job concurrency control (default 2 parallel downloads)
  - Exponential backoff retry logic (3 attempts) with dead letter queue tracking
  - Job handlers: `checkBaseTicket`, `downloadTicketsForAllUsers`, `downloadTicketForUser`
- **Base Ticket Detection**:
  - SHA-256 hash-based change detection for base ticket
  - Automatic fan-out downloads when base ticket changes
  - `base_ticket_state` table tracking current hash and timestamps
  - Admin credentials for base ticket checks (TICKET_ADMIN_USERNAME/PASSWORD)
- **Admin Observability API**:
  - `GET /admin/observability/errors` - Recent download failures
  - `GET /admin/observability/job-summary` - Job statistics (last N hours)
  - `GET /admin/observability/base-ticket` - Current base ticket state
  - `POST /admin/jobs/check-base-ticket` - Manual base ticket check
  - `POST /admin/jobs/download-all` - Manual download trigger for all users
  - `GET /admin/overview` - System overview (user counts, base ticket state)
- **Enhanced History & Tickets**:
  - `download_history` table with detailed run records (status, message, timestamps)
  - `tickets` table with version tracking and content-hash deduplication
  - Download status tracking (success, failed, duplicate detected)

### Added - Phase 3 (Hardening & Observability)

- **Persistent SQLite Queue**:
  - SQLite-backed job queue for restart safety (`JOB_QUEUE_BACKEND=persistent`)
  - Queue state persistence: pending jobs survive API restarts
  - Job queue table with status tracking (pending, processing, completed, failed)
  - Metrics: enqueued, completed, failed, retries, pending jobs
- **Multi-Level Rate Limiting**:
  - Global IP rate limiter (100 requests per 15 minutes)
  - Per-user authenticated rate limiter (300 requests per 15 minutes, configurable)
  - Outbound provider rate limiter with token bucket (12 req/min default)
  - Rate limit configuration via environment variables
- **Health & Metrics Endpoints**:
  - `GET /health` - Liveness probe (always returns 200)
  - `GET /ready` - Readiness probe (checks DB + queue)
  - `GET /metrics` - Prometheus-compatible metrics (queue stats, rate limiters)
  - `GET /admin/observability/queue` - Queue backend and metrics details
- **Audit Logging**:
  - Structured JSON logs with severity levels (INFO, WARN, ERROR)
  - Request ID tracking for correlation across logs
  - Automatic credential field redaction
  - Audit events: invite creation/deletion, credential updates, device profile changes
  - Context enrichment: user_id, route, method, status, duration_ms
- **Security Enhancements**:
  - Security headers (HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
  - Request tracing with unique IDs
  - Rate limit enforcement on all API endpoints
  - Protected admin endpoints with role checks

### Added - Phase 4 (Frontend & Deployment)

- **React Frontend**:
  - User pages: Login, Register, Dashboard, Profile, Credentials, Device Profiles, Tickets, History, Downloads
  - Admin pages: Overview, User Management, User Detail, Job Triggers
  - JWT authentication with secure token storage
  - Role-based route protection
  - CRUD interfaces for credentials and device profiles
  - Download history viewing and ticket access
  - Admin observability dashboards
  - Responsive design with Tailwind CSS
- **Docker Support**:
  - Multi-stage Dockerfile for production deployments
  - docker-compose.yml with volume mounts and environment configuration
  - Frontend build bundled and served by backend at `/app`
  - Health checks integrated for container orchestrators
- **CI/CD Pipeline**:
  - GitHub Actions workflow for automated testing (`.github/workflows/ci.yml`)
  - Lint, backend tests, frontend tests, Playwright e2e suite
  - Matrix testing on Node 18 and 20
  - Scheduled downloader workflow (`.github/workflows/scheduled-download.yml`)
- **Testing & Quality**:
  - 175 automated tests (Jest + Playwright)
  - Integration tests for API endpoints (auth, downloads, history, admin)
  - Job queue and scheduler tests
  - Rate limiter tests
  - E2E tests covering full invite→login→credential→download flow
  - 60%+ test coverage for core modules
- **Documentation**:
  - Architecture overview with component diagrams and data flows (`docs/architecture.md`)
  - Operations guide with deployment checklist (`docs/operations.md`)
  - Database schema reference (`docs/db-schema.md`)
  - Release checklist for pre-deployment validation (`RELEASE_CHECKLIST.md`)
  - Comprehensive README with setup, API reference, Docker instructions
  - CONTRIBUTING.md with development guidelines

### Changed

- Database schema extended for Phase 2-4 features:
  - Added `base_ticket_state`, `download_history`, `tickets`, `job_queue` tables
  - Enhanced `user_credentials` with login telemetry fields
  - Added audit timestamp fields across tables
- API endpoints now require JWT authentication for all protected routes
- Background scheduler enabled by default when running API server
- Queue backend defaults to persistent when database is available
- Download history records now include device profile and detailed error messages
- CLI now supports `--queue-backend` and `--concurrency` flags

### Fixed

- Browser instances properly clean up resources even on errors
- Queue jobs retry with exponential backoff instead of failing immediately
- Download failures captured with detailed error context
- Rate limiting prevents API abuse and provider overload

### Security

- Multi-level rate limiting prevents abuse
- Audit logging tracks all security-relevant events
- Credential redaction in all log outputs
- Security headers protect against common web vulnerabilities
- Health endpoints exclude sensitive system information

### Known Limitations

See [docs/future-work.md](docs/future-work.md) for detailed limitations and enhancement opportunities:

- SQLite queue not designed for multi-instance deployments
- In-process rate limiting not shared across API instances
- File-based download storage not suitable for distributed systems
- No automatic credential rotation
- No ticket content validation beyond hash comparison
- Browser instances not reused (performance opportunity)

### Migration Notes

**Upgrading from 1.1.0 or earlier**:

1. Run `npm install` to get new dependencies
2. Set required environment variables (see README)
3. Database migrations are automatic on first run
4. Frontend requires build: `npm run build:frontend`
5. For Docker: rebuild images with `docker-compose build`

**First-time Setup**:

1. Initialize database: `npm run setup:db`
2. Set secrets: `JWT_SECRET`, `ENCRYPTION_KEY`, admin credentials
3. Create first admin user via database seed
4. Generate invite token for additional users
5. Configure scheduler interval and queue backend
6. Deploy with Docker or run directly: `npm run api`

## [1.1.0] - 2024-11-20

### Added

- **CI/CD Pipeline**: GitHub Actions workflow for automated testing and linting on Node 18 & 20
- **Code Quality Tools**:
  - ESLint 9 with flat config for code linting
  - Prettier for consistent code formatting
  - npm scripts: `lint`, `lint:fix`, `format`, `format:check`, `test:coverage`, `test:watch`
- **Comprehensive Test Suite**:
  - 52 unit tests across all core modules
  - Test coverage increased from ~36% to 56%
  - Tests for deviceProfiles, history, database, index, and server
- **Security Enhancements**:
  - Rate limiting on API endpoints (100 requests per 15 minutes per IP)
  - Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, XSS-Protection)
  - Request ID logging for traceability
  - Input validation on all API endpoints
- **Documentation**:
  - JSDoc comments on all public functions
  - CONTRIBUTING.md with development guidelines
  - CHANGELOG.md for version tracking
  - Legacy scripts moved to `legacy/` directory with README
- **Code Improvements**:
  - Constants extracted for timeouts and selectors
  - Better error handling in database operations
  - Improved browser cleanup to prevent resource leaks
  - Consistent argument parsing across modules

### Changed

- Test coverage now includes silent mode for cleaner output
- Pretest hook now runs linting automatically before tests
- Legacy `ticket-downloader.js` and `ticket-uploader.sh` moved to `legacy/` directory

### Fixed

- Browser instances now properly close even on errors
- Database operations have proper error handling and validation
- History append validates userId before writing

## [0.1.0] - 2024-11-18 (Pre-Phase 1)

### Added

- Initial multi-user ticket downloading with device emulation
- SQLite database support for users, history, and tickets
- Basic Express REST API with bearer token authentication
- Device profiles: desktop_chrome, mobile_android, iphone_13, tablet_ipad
- CLI with flags for users config, output dir, device profile, history path, and database
- npm scripts for running downloads, API server, and database setup

[1.0.0]: https://github.com/dzjadzka/UK-TicketUpdater/releases/tag/v1.0.0
[1.1.0]: https://github.com/dzjadzka/UK-TicketUpdater/releases/tag/v1.1.0
[0.1.0]: https://github.com/dzjadzka/UK-TicketUpdater/releases/tag/v0.1.0
