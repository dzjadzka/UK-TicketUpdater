# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2024-11-21

### Added

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

- **Documentation**:
  - Complete authentication flow documentation in README
  - API endpoint reference with request/response examples
  - Security features and password requirements documentation
  - Bootstrap instructions for first admin user creation
  - Custom device profiles section with examples and validation rules
  - FEATURE_PLAN.md updated to reflect Phase 1 completion (5/5 features)

### Changed

- Database schema updated to support authentication (backward compatible)
- Users table now supports both legacy (username/password) and new (email/password_hash) fields
- API endpoints now require JWT authentication (legacy API_TOKEN removed)

### Security

- All passwords now hashed with bcrypt before storage
- Ticket site credentials encrypted with AES-256-GCM
- JWT tokens prevent unauthorized API access
- Invite-only registration prevents open signups
- Role-based access control limits admin operations

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

## [1.0.0] - Earlier

### Added

- Multi-user ticket downloading with device emulation
- SQLite database support for users, history, and tickets
- Express REST API with bearer token authentication
- Device profiles: desktop_chrome, mobile_android, iphone_13, tablet_ipad
- CLI with flags for users config, output dir, device profile, history path, and database
- npm scripts for running downloads, API server, and database setup

[1.1.0]: https://github.com/dzjadzka/UK-TicketUpdater/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/dzjadzka/UK-TicketUpdater/releases/tag/v1.0.0
