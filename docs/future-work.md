# Future Work and Known Limitations

This document tracks known limitations, technical debt, and natural next features for UK-TicketUpdater. Items are structured to map directly to GitHub issues.

## Known Limitations

### L1: Single-Instance Queue Design

**Description**: The SQLite-backed persistent queue is designed for single-instance deployments. Multiple API instances writing to the same SQLite file can cause lock contention and race conditions. Job deduplication is not guaranteed across instances.

**Impact**: Prevents horizontal scaling of the API server with guaranteed job execution.

**Suggested Priority**: High (if multi-instance deployment is needed)

**Potential Solution**: Externalize queue to Redis with BullMQ or similar distributed queue system. Would require refactoring `src/jobs/queue.js` and `src/jobs/persistentQueue.js` to use a Redis backend.

---

### L2: In-Process Rate Limiting

**Description**: Rate limiters in `src/rateLimiter.js` maintain counters in Node.js process memory. When running multiple API instances behind a load balancer, each instance has independent rate limits, allowing clients to bypass limits by hitting different instances.

**Impact**: Rate limiting is not enforced consistently across multiple API instances.

**Suggested Priority**: Medium (becomes High with multi-instance deployments)

**Potential Solution**: Move rate limit state to Redis with TTL keys. Use packages like `rate-limiter-flexible` with Redis backend. Would require minimal changes to `src/server.js` middleware setup.

---

### L3: File-Based Download Storage

**Description**: Downloaded tickets are stored as HTML files under `downloads/<user-id>/` on local disk. This works for single-instance deployments but doesn't scale to multi-instance or distributed systems. Ticket files are not accessible across API instances.

**Impact**: Users may see different download history depending on which API instance handles their request. File downloads fail if files are on a different instance.

**Suggested Priority**: Medium (becomes High with multi-instance or cloud deployments)

**Potential Solution**: Store tickets in S3/MinIO or equivalent object storage. Update `src/downloader.js` to upload to object storage, and add presigned URL generation for ticket downloads. Alternatively, use shared NFS mount across instances.

---

### L4: No Automatic Credential Rotation

**Description**: User UK credentials are stored encrypted but never automatically rotated or expire. If credentials change externally (password reset on provider side), users must manually update them in the system.

**Impact**: Stale credentials cause download failures until manually updated. No proactive detection of credential expiration.

**Suggested Priority**: Low

**Potential Solution**: Add credential "last successful use" timestamp and "consecutive failures" counter. Flag credentials for user attention after N consecutive failures. Optional: support OAuth-like flows if provider adds API.

---

### L5: Limited Ticket Content Validation

**Description**: Ticket downloads are validated only by SHA-256 hash comparison. No structural validation of HTML content, no detection of error pages served with 200 status, no verification that ticket data is present.

**Impact**: Corrupted or invalid downloads may be stored as valid tickets. Users may download provider error pages instead of tickets.

**Suggested Priority**: Medium

**Potential Solution**: Add content validation in `src/downloader.js` to check for expected HTML elements (ticket number, user name, validity dates). Set validation thresholds (min/max file size, required text patterns). Add validation status to `tickets` table.

---

### L6: Browser Instance Reuse

**Description**: Each ticket download launches a new Puppeteer browser instance and closes it after download completes. This wastes resources (CPU, memory, time) on browser startup/teardown.

**Impact**: Slower downloads, higher resource usage, potential for resource leaks if browser cleanup fails.

**Suggested Priority**: Low

**Potential Solution**: Implement browser pool in `src/downloader.js` with configurable pool size. Reuse browser contexts across jobs, only relaunching on errors. Add browser health checks and periodic restarts to prevent memory leaks.

---

## Enhancement Opportunities

### E1: Distributed Tracing Integration

**Title**: Add OpenTelemetry support for distributed tracing

**Description**: Currently uses request IDs for correlation within a single service. Add OpenTelemetry tracing to track requests across API, queue, and download flows. Visualize end-to-end request paths with trace spans for database queries, job processing, and external API calls.

**Why**: Improves debugging of complex flows (base ticket check → fan-out → per-user downloads). Helps identify performance bottlenecks and latency sources.

**Suggested Priority**: Low

**Implementation Notes**: Add `@opentelemetry/api` and `@opentelemetry/sdk-node`. Instrument Express with auto-instrumentation. Add manual spans for job processing and Puppeteer operations. Export to Jaeger or Zipkin.

---

### E2: Webhook Notifications

**Title**: Support webhooks for download completion and failure events

**Description**: Allow users and admins to register webhook URLs that receive HTTP callbacks when downloads complete, fail, or when base ticket changes are detected. Webhook payloads include event type, user ID, ticket info, status, and timestamps.

**Why**: Enables integration with external systems (notification services, logging platforms, automation tools). Users can receive real-time download notifications without polling the API.

**Suggested Priority**: Medium

**Implementation Notes**: Add `webhooks` table to store user/admin webhook configs. Add webhook delivery job type. Handle retry logic for failed webhook deliveries with exponential backoff. Consider HMAC signatures for webhook security.

---

### E3: Ticket Retention Policies

**Title**: Implement configurable ticket retention and cleanup

**Description**: Add per-user or system-wide policies for ticket retention. Automatically delete or archive old tickets after N days. Support retention rules like "keep last 5 tickets per user" or "delete tickets older than 90 days". Add cleanup job that runs periodically.

**Why**: Prevents unbounded storage growth. Allows compliance with data retention requirements. Gives users control over their historical data.

**Suggested Priority**: Low

**Implementation Notes**: Add `retention_policy` fields to users table or create `retention_policies` table. Add cleanup job handler in `src/jobs/handlers.js`. Consider archival to object storage before deletion. Expose retention settings in frontend Settings page.

---

### E4: Multi-Language Frontend

**Title**: Add German language support to frontend with i18next

**Description**: The backend supports locale preferences (`locale` field in users table), but frontend is English-only. Add react-i18next and German translations for all UI strings. Support runtime language switching with persistence in localStorage or user preferences.

**Why**: Many users are German-speaking. Localized UI improves accessibility and user experience.

**Suggested Priority**: Medium

**Implementation Notes**: Install `react-i18next` and `i18next`. Create `frontend/src/locales/en.json` and `frontend/src/locales/de.json`. Wrap strings with `t()` function. Add language switcher component. Sync with backend `locale` field on user update.

---

### E5: Ticket Preview and Rendering

**Title**: Add in-browser ticket preview with HTML sanitization

**Description**: Currently users can download ticket HTML but must open it locally to view. Add preview functionality in the frontend that fetches and displays ticket HTML in a sandboxed iframe or sanitized container.

**Why**: Improves user experience by allowing ticket viewing without leaving the app or downloading files.

**Suggested Priority**: Low

**Implementation Notes**: Add `GET /api/tickets/:ticketId/content` endpoint that returns sanitized HTML. Use DOMPurify or similar to sanitize HTML before rendering. Consider rendering as image (puppeteer screenshot) for extra safety. Show preview modal in Tickets page.

---

### E6: Bulk User Import

**Title**: Support CSV/JSON bulk user import for admins

**Description**: Admins currently create users one-by-one via invite tokens. Add bulk import feature that accepts CSV or JSON file with user email list, generates invite tokens for all, and optionally sends invitation emails (if email service is configured).

**Why**: Simplifies onboarding for organizations with many users. Reduces manual work for admins.

**Suggested Priority**: Low

**Implementation Notes**: Add `POST /admin/users/bulk-import` endpoint accepting multipart form data. Validate CSV/JSON structure. Generate invite tokens in batch. Optionally integrate with email service (SendGrid, SES). Return import summary with success/failure counts.

---

### E7: Download Analytics Dashboard

**Title**: Add analytics dashboard for download trends and patterns

**Description**: Admins currently see job summaries and error lists. Add analytics dashboard with charts showing: downloads over time, success/failure rates, average download duration, top error types, per-user download frequency, device profile usage distribution.

**Why**: Provides insights into system usage, helps identify trends, enables data-driven optimization decisions.

**Suggested Priority**: Low

**Implementation Notes**: Add analytics queries to `src/db.js` aggregating `download_history` and `tickets` tables. Create AdminAnalytics component with chart library (recharts or Chart.js). Add time range selectors (last 7/30/90 days). Cache aggregation results for performance.

---

### E8: Email Notifications

**Title**: Support email notifications for download failures and ticket changes

**Description**: Notify users via email when: their download fails repeatedly, credentials are invalid, new ticket version is available. Allow users to configure notification preferences (frequency, events).

**Why**: Proactive problem detection. Users don't need to check the dashboard to know when action is needed.

**Suggested Priority**: Low

**Implementation Notes**: Add email configuration (SMTP settings or SendGrid/SES API keys) to environment variables. Create `notification_preferences` table. Add email sending utility in `src/notifications.js`. Trigger emails from job handlers on failure thresholds. Add notification settings page to frontend.

---

### E9: API Rate Limit Visualization

**Title**: Show current rate limit status in API responses

**Description**: Add rate limit headers to API responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Display rate limit status in frontend for user awareness. Show "slow down" warnings when nearing limits.

**Why**: Improves developer experience. Users understand why requests are rejected. Helps diagnose rate limit issues.

**Suggested Priority**: Low

**Implementation Notes**: Update `src/rateLimiter.js` middleware to add headers to all responses. Extract remaining tokens/requests from limiter state. Display rate limit info in frontend header or settings. Add "rate limit exceeded" error UI.

---

### E10: Backup and Restore Tools

**Title**: Add CLI commands for database backup and restore

**Description**: Provide CLI tools to backup SQLite database (including blob exports for encrypted credentials), verify backup integrity, and restore from backup. Support scheduled backups via cron or built-in scheduler.

**Why**: Prevents data loss. Essential for production deployments. Enables disaster recovery and migration.

**Suggested Priority**: High

**Implementation Notes**: Add `npm run backup` and `npm run restore` scripts wrapping `src/backup.js` utility. Use SQLite `.backup` command or filesystem copy with integrity checks. Support backup to local file, S3, or rsync. Document backup strategy in operations guide. Consider encrypting backups at rest.

---

### E11: Provider Change Detection

**Title**: Detect and alert on provider site changes

**Description**: Monitor ticket provider website for structural changes (DOM element changes, authentication flow changes). Alert admins when Puppeteer selectors may be outdated. Log detected changes for investigation.

**Why**: Provider websites change over time. Proactive detection prevents silent download failures. Reduces downtime when provider updates break scraping.

**Suggested Priority**: Medium

**Implementation Notes**: Add checksum tracking for key page structures (login form, ticket page selectors). Compare checksums on each download attempt. Alert on threshold (e.g., 3 consecutive changes). Add `provider_checks` table to track structural changes. Expose provider health in admin observability dashboard.

---

### E12: Performance Benchmarking

**Title**: Add performance test suite and benchmarks

**Description**: Create benchmark suite measuring: API request latency (p50, p95, p99), download duration, job throughput, database query performance. Track benchmarks over time to detect regressions. Add to CI pipeline.

**Why**: Ensures performance doesn't degrade with new features. Identifies bottlenecks before they impact users. Provides baseline for optimization efforts.

**Suggested Priority**: Low

**Implementation Notes**: Use `autocannon` or `k6` for API load testing. Add `__benchmarks__/` directory with test scripts. Measure operations: user login, credential CRUD, download job processing. Store results in JSON. Compare against baseline in CI. Document expected performance characteristics in README.

---

### E13: Credential Audit Trail

**Title**: Add detailed audit log for credential access and modifications

**Description**: Track all credential reads (decryption events), updates, and deletions with timestamps, user IDs, and IP addresses. Provide audit trail view for admins. Alert on suspicious patterns (many failed decryptions, unusual access times).

**Why**: Security compliance. Helps investigate security incidents. Detects unauthorized credential access attempts.

**Suggested Priority**: Medium

**Implementation Notes**: Add `credential_audit_log` table with event type, credential ID, user ID, IP, timestamp, success/failure. Log events in `src/auth.js` encryption/decryption functions. Add `GET /admin/audit/credentials` endpoint with filtering. Implement anomaly detection rules (rate thresholds, time-of-day patterns).

---

### E14: Mobile-Responsive Admin Dashboard

**Title**: Improve mobile/tablet experience for admin dashboard

**Description**: Current frontend works on mobile but admin dashboard is optimized for desktop. Improve responsive design for admin pages: user list, user detail, observability charts. Use collapsible sections, bottom sheets, mobile-friendly tables.

**Why**: Admins may need to respond to issues while mobile. Improves accessibility and admin productivity.

**Suggested Priority**: Low

**Implementation Notes**: Audit all admin components for mobile breakpoints. Use Tailwind responsive utilities. Convert tables to card layouts on mobile. Test on real mobile devices. Consider progressive web app (PWA) features for offline admin access.

---

### E15: Test Environment Provisioning

**Title**: Add scripts for local test environment setup

**Description**: Provide one-command setup of complete test environment with: seeded database, test users (admin + regular), sample credentials, mock tickets. Enable developers to quickly spin up environment for testing and demo.

**Why**: Reduces friction for new contributors. Enables rapid testing of features. Useful for demos and QA.

**Suggested Priority**: Low

**Implementation Notes**: Create `scripts/seed-test-env.js` that initializes DB, creates test users, generates invite tokens, adds sample credentials. Add `npm run seed:test` script. Document in CONTRIBUTING.md. Consider docker-compose profile for test environment with pre-seeded data.

---

## Technical Debt

### T1: Test Coverage Gaps

**Title**: Increase test coverage for downloader and job handlers

**Description**: Core modules like `src/downloader.js` (14% coverage) and complex job flows are under-tested. Puppeteer integration tests are difficult but unit-testable logic exists. Job handlers have integration tests but lack unit tests for edge cases.

**Why**: Improves confidence in changes. Catches bugs earlier. Enables safer refactoring.

**Suggested Priority**: Medium

**Implementation Notes**: Mock Puppeteer for unit tests of downloader logic. Add tests for error cases: network failures, authentication errors, invalid credentials. Test job retry logic, dead letter queue, concurrency limits. Target 70%+ coverage for critical paths. Add coverage reporting to CI.

---

### T2: Error Handling Consistency

**Title**: Standardize error handling and error response format

**Description**: Error handling varies across modules. API error responses don't follow consistent format. Some errors logged but not returned to client. Some stack traces leak in production.

**Why**: Inconsistent UX. Difficult debugging. Security risk from stack trace leaks.

**Suggested Priority**: Medium

**Implementation Notes**: Create error middleware in `src/errors.js` with standard format: `{ error: { code, message, details, requestId } }`. Add error classes for common scenarios (ValidationError, AuthError, etc.). Standardize HTTP status codes. Never expose stack traces in production responses. Log all errors with context.

---

### T3: Environment Variable Validation

**Title**: Add startup validation for required environment variables

**Description**: Some environment variables (JWT_SECRET, ENCRYPTION_KEY) use defaults in development. No validation of format or security requirements. Server starts even with insecure defaults in production.

**Why**: Prevents production deployments with development defaults. Catches config errors at startup instead of runtime.

**Suggested Priority**: High

**Implementation Notes**: Add `src/config.js` that validates all environment variables on startup. Check: required variables are set, secrets meet length requirements (JWT_SECRET >= 32 chars, ENCRYPTION_KEY = 32 bytes), URLs are valid, numeric values are in range. Fail fast with clear error messages. Document all variables in `.env.example`.

---

### T4: Database Migration System

**Title**: Implement formal database migration framework

**Description**: Database schema changes are currently manual or via `setupDb.js` seed script. No versioning, no rollback capability, no production migration path. Schema changes risk data loss or inconsistency.

**Why**: Safe schema evolution. Enables zero-downtime deployments. Prevents data loss from manual migrations.

**Suggested Priority**: High

**Implementation Notes**: Add migration framework (e.g., `node-pg-migrate` adapted for SQLite, or custom). Create `migrations/` directory with versioned SQL files. Add `npm run migrate` and `npm run migrate:rollback`. Track applied migrations in `schema_migrations` table. Document migration process in operations guide.

---

### T5: Dependency Updates and Security Scanning

**Title**: Automate dependency updates and vulnerability scanning

**Description**: Dependencies are manually updated. No automated checks for outdated packages or known vulnerabilities. Dependabot is not configured.

**Why**: Security vulnerabilities accumulate. Missing bug fixes and performance improvements. Manual updates are time-consuming and error-prone.

**Suggested Priority**: Medium

**Implementation Notes**: Enable Dependabot for GitHub repo (`.github/dependabot.yml`). Add `npm audit` to CI pipeline with failure threshold. Consider `npm-check-updates` for major version updates. Schedule monthly dependency review. Document update process in CONTRIBUTING.md.

---

## Operational Improvements

### O1: Structured Logging Levels

**Title**: Add configurable log levels and filtering

**Description**: Logger supports INFO/WARN/ERROR but no runtime configuration of log levels. Cannot filter logs by module or user. All logs written regardless of severity.

**Why**: High log volume in production. Difficult to focus on important events. No way to debug specific users or modules without all logs.

**Suggested Priority**: Low

**Implementation Notes**: Add `LOG_LEVEL` environment variable (DEBUG, INFO, WARN, ERROR). Support module-specific levels (e.g., `LOG_LEVEL_JOBS=DEBUG`). Add filtering by user ID for debugging. Consider structured logging library (pino, winston) for better performance and features.

---

### O2: Graceful Shutdown Handling

**Title**: Implement graceful shutdown for API server and job scheduler

**Description**: SIGTERM/SIGINT kill server immediately, potentially interrupting in-flight requests and job processing. No cleanup of browser instances or database connections.

**Why**: Requests fail during rolling deployments. Jobs interrupted mid-download. Resource leaks on shutdown.

**Suggested Priority**: High

**Implementation Notes**: Add signal handlers in `src/server.js` and `src/jobs/scheduler.js`. On SIGTERM: stop accepting new requests, wait for in-flight requests (with timeout), close DB connections, stop scheduler, finish running jobs (with timeout), close browsers. Add shutdown timeout (default 30s). Log shutdown progress.

---

### O3: Job Priority System

**Title**: Add priority levels for different job types

**Description**: All jobs processed in FIFO order. Manual admin-triggered downloads compete with scheduled downloads. No way to expedite urgent jobs or throttle low-priority ones.

**Why**: Manual admin actions should be fast. Bulk operations shouldn't block individual user requests. Priority enables better resource allocation.

**Suggested Priority**: Low

**Implementation Notes**: Add priority field to job queue (HIGH, NORMAL, LOW). Process high-priority jobs first. Reserve concurrency slots for high-priority jobs. Admin-triggered downloads are HIGH. Scheduled downloads are NORMAL. Bulk imports are LOW. Add priority parameter to job enqueue methods.

---

### O4: Configuration Management UI

**Title**: Add admin UI for runtime configuration management

**Description**: Most configuration is via environment variables, requiring restart to change. No visibility into current settings. Admins can't adjust rate limits, concurrency, or intervals without deployment.

**Why**: Enables quick response to issues (e.g., provider slow, increase rate limit buffer). Improves operational flexibility. Reduces need for redeployments.

**Suggested Priority**: Low

**Implementation Notes**: Add `system_config` table for runtime settings. Add `GET/PUT /admin/config` endpoints with validation. Frontend admin page for config management. Support hot-reload of select configs (rate limits, concurrency). Maintain environment variables as defaults. Audit config changes.

---

### O5: Job Scheduling Dashboard

**Title**: Add visual timeline of scheduled and running jobs

**Description**: Admins see job counts and recent errors but not job schedule or active job details. No visibility into what jobs will run next or which users are being processed.

**Why**: Helps understand system activity. Useful for debugging scheduling issues. Shows impact of manual job triggers.

**Suggested Priority**: Low

**Implementation Notes**: Add `GET /admin/jobs/timeline` endpoint returning: scheduled job times, running jobs with progress, queued jobs with position, recently completed jobs. Frontend component with timeline visualization (Gantt-style). Show job details on hover/click. Add filtering by job type and user.

---

## Contributing

When creating GitHub issues from these items:

1. Use the title as the issue title
2. Include the full description and "Why" sections
3. Add priority label (Low/Medium/High)
4. Tag with appropriate labels: `enhancement`, `technical-debt`, `limitation`, `operational`
5. Link to this document for context
6. Add "help wanted" for items suitable for community contributions

For proposing new items:

1. Follow the same structure (Title, Description, Why, Priority, Implementation Notes)
2. Categorize appropriately (Limitation, Enhancement, Technical Debt, Operational)
3. Link to related issues or code sections
4. Consider impact, effort, and priority before submission

## References

- [Architecture Overview](./architecture.md) - System design and component details
- [Operations Guide](./operations.md) - Current operational procedures
- [CHANGELOG](../CHANGELOG.md) - Past changes and version history
- [CONTRIBUTING](../CONTRIBUTING.md) - Development guidelines and workflow
