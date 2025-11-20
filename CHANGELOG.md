# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
