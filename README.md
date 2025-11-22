# UK-TicketUpdater

[![CI](https://github.com/UK-TicketUpdater/UK-TicketUpdater/actions/workflows/ci.yml/badge.svg)](https://github.com/UK-TicketUpdater/UK-TicketUpdater/actions/workflows/ci.yml)
[![Scheduled multi-user download](https://github.com/UK-TicketUpdater/UK-TicketUpdater/actions/workflows/scheduled-download.yml/badge.svg)](https://github.com/UK-TicketUpdater/UK-TicketUpdater/actions/workflows/scheduled-download.yml)

Multi-user automation to download NVV semester tickets from `https://ticket.astakassel.de` using Puppeteer. Phase 3 adds a selectable persistent queue backend, end-to-end rate limiting for the ticket provider, Prometheus-friendly metrics, and a minimal React dashboard for users and admins.

## What this project does
- **Automated ticket monitoring**: Periodically checks for base ticket changes using admin credentials and triggers user downloads when changes are detected.
- **Background job queue**: Processes ticket downloads with configurable concurrency, retry logic, and error handling (memory or SQLite-backed persistence).
- **User management**: JWT-protected API for users to manage credentials and view their ticket history.
- **Admin dashboard API**: Endpoints for user management, job control, and observability (error tracking, job statistics).
- **Ticket versioning**: Detects duplicate tickets via content hashing to avoid redundant downloads.
- Records history and tickets in SQLite with structured logging for production observability.
- **Frontend dashboard**: React UI for users (tickets, credentials, device profiles) and admins (overview, user management, manual jobs).

## Architecture at a glance
- **API server:** `src/server.js` hosts JWT-protected routes for user and admin operations.
- **Job system:** `src/jobs/` provides a background queue with scheduler for automated base ticket checks and user downloads.
- **Downloader:** `src/downloader.js` handles Puppeteer interactions with device-profile presets from `src/deviceProfiles.js`.
- **Persistence:** `src/db.js` (SQLite for users/credentials/tickets/history/base_ticket_state).
- **Observability:** Structured JSON logging (`src/logger.js`) with credential redaction and admin observability endpoints.

## Prerequisites
- Node.js 18+ and npm.
- Chromium/Chrome available for Puppeteer (set `PUPPETEER_SKIP_DOWNLOAD=1` if you provide the browser yourself).
- Network access to `https://ticket.astakassel.de`.

## Configuration (environment variables)

### Required in Production
- `JWT_SECRET`: Secret used to sign JWTs. Dev default only outside production.
- `ENCRYPTION_KEY`: 32-byte key for encrypting stored UK credentials.
- `TICKET_ADMIN_USERNAME` (or `ADMIN_TICKET_USERNAME`): Admin account username for base ticket checks.
- `TICKET_ADMIN_PASSWORD` (or `ADMIN_TICKET_PASSWORD`): Admin account password for base ticket checks.

### Optional
- `JWT_EXPIRY`: Token lifetime (default `7d`).
- `DB_PATH`: SQLite database path (default `./data/app.db`).
- `OUTPUT_ROOT`: Base output directory for downloads (default `./downloads`).
- `DEFAULT_DEVICE`: Default device profile (default `desktop_chrome`).
- `PORT`: API server port (default `3000`).
- `JOB_CONCURRENCY`: Max concurrent download jobs (default `2`).
- `JOB_QUEUE_BACKEND`: `persistent` (SQLite-backed queue for restart safety, default when DB is available) or `memory`.
- `BASE_TICKET_CHECK_INTERVAL_HOURS`: Hours between base ticket checks (default `6`).
- `JOBS_SCHEDULER_ENABLED`: Set to `false` to disable automatic scheduler (default `true`).
- `PUPPETEER_SKIP_DOWNLOAD`: Set to `1` during `npm install` to skip bundled Chromium.
- `TICKET_RATE_LIMIT_PER_MINUTE`: Token bucket limit for outbound ticket-provider calls (default `12`).
- `TICKET_RATE_LIMIT_WINDOW_MS`: Override token bucket window (default `60000`).
- `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS`: Per-user/IP API limiter (default 300 requests per 15 minutes).

## Setup
```bash
# Install dependencies (skip Chromium download if you have one installed)
PUPPETEER_SKIP_DOWNLOAD=1 npm install

# Prepare a users config (JSON mode)
cp config/users.sample.json config/users.json
# Fill username/password and optional deviceProfile/outputDir per entry

# Initialize SQLite from JSON users (recommended path)
npm run setup:db
```

## Running downloads (CLI)
```bash
# Using JSON users
npm run download

# Using the sample placeholder config
npm run download:sample

# Using SQLite users/history/tickets (after npm run setup:db)
npm run download:db

# Show full CLI help (all flags)
node src/index.js --help
```
CLI flags:
- `--users <path>`: Users config path (default `./config/users.json`).
- `--output <path>`: Base download directory (default `./downloads`).
- `--device <profile>`: Default device profile (`desktop_chrome`, `mobile_android`, `iphone_13`, `iphone_15_pro`, `desktop_firefox`, `mac_safari`, `tablet_ipad`).
- `--history <path>`: JSON history path (default `./data/history.json`; ignored when using `--db`).
- `--db <path>`: SQLite path; when set, users/history/tickets are read/written there.
- `--queue-backend <memory|persistent>`: Switch background queue backend (default `memory` unless DB persistent mode chosen).
- `--concurrency <number>`: Override job concurrency for CLI downloads.

> Deprecated: The `--source` flag is still accepted as an alias for `--users` but will emit a warning and is scheduled for removal in v1.1.0. Migrate any scripts to use `--users`.

## API server
```bash
# Start the API server with background job scheduler
JWT_SECRET=your-secret ENCRYPTION_KEY=32-byte-key \
TICKET_ADMIN_USERNAME=admin TICKET_ADMIN_PASSWORD=admin-pass \
npm run api
```

The server starts the base ticket scheduler automatically unless `JOBS_SCHEDULER_ENABLED=false`. Scheduler cadence comes from `BASE_TICKET_CHECK_INTERVAL_HOURS` (default 6h) and each `checkBaseTicket` run enqueues per-user downloads when the base ticket hash changes. Request rate limiting caps traffic at 100 requests per 15 minutes per IP plus a per-user limiter (`AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS`). Health probes: `GET /health` (liveness) and `GET /ready` (DB + queue readiness).

## Frontend dashboard
- Development server: `npm run dev:frontend`
- Production build: `npm run build:frontend`

The dashboard expects the API at `VITE_API_BASE_URL` (default `/api` when reverse-proxied). Users can log in, view ticket history, update credentials, and manage device profiles. Admins see an overview tab, user management, and manual job triggers. In Docker images, the static build is served at `/app` by the backend container.

### User Routes
- `POST /auth/register`: Register with invite token
- `POST /auth/login`: Authenticate and get JWT
- `GET /me`: Get current user profile
- `PUT /me/credentials`: Update UK credentials and auto-download setting
- `GET /me/tickets`: View personal ticket history
- `DELETE /me`: Delete account

### Admin Routes
- `GET /admin/users`: List/search users with filtering
- `GET /admin/users/:id`: View user detail with credential status
- `PUT /admin/users/:id`: Update user credentials/flags
- `DELETE /admin/users/:id`: Soft delete user
- `POST /admin/jobs/check-base-ticket`: Manually trigger base ticket check
- `POST /admin/jobs/download-all`: Manually trigger download for all users
- `GET /admin/overview`: View system overview (user counts, base ticket state)
- `GET /admin/observability/errors`: View recent download failures
- `GET /admin/observability/job-summary`: View job statistics
- `GET /admin/observability/base-ticket`: View current base ticket state

See `src/server.js` for complete API documentation.

## How it works (Phase 2)

### Background Job System
1. **Scheduler** runs base ticket check every N hours (configurable via `BASE_TICKET_CHECK_INTERVAL_HOURS`)
2. **Base ticket check** job:
   - Logs in using admin credentials
   - Downloads the "base" ticket (template used for all users)
   - Computes SHA-256 hash of content
   - Compares with stored hash in database
3. **If ticket changed**:
   - Updates `base_ticket_state` table with new hash and timestamp
   - Enqueues `downloadTicketsForAllUsers` job
4. **Per-user download jobs**:
   - Only process users with `auto_download_enabled=true`
   - Load encrypted UK credentials from database
   - Log in and download ticket via Puppeteer
   - Compute content hash to detect duplicates
   - Update ticket history and credential status

### Job Queue Features
- **Concurrency control**: Limit parallel downloads to avoid overwhelming the ticket site
- **Retry with backoff**: Failed jobs retry up to 3 times with exponential backoff
- **Dead letter queue**: Permanently failed jobs tracked for admin review
- **Structured logging**: All job events logged as JSON with request IDs for tracing

See [`docs/operations.md`](docs/operations.md) for an operations-focused view of how jobs are started, controlled, monitored, and rate-limited in production.

## Operations and observability
- Background scheduler is enabled by default when running `npm run api`; set `JOBS_SCHEDULER_ENABLED=false` to disable.
- Job concurrency can be tuned with `JOB_CONCURRENCY`, scheduler cadence via `BASE_TICKET_CHECK_INTERVAL_HOURS`, and queue backend via `JOB_QUEUE_BACKEND` (`persistent` recommended for API/server runs).
- Observability endpoints surface recent errors, job summaries, base ticket state, queue metrics (`/admin/observability/queue`), and Prometheus text metrics at `/metrics`.
- Health probes: `/health` (liveness) and `/ready` (DB + queue readiness) for load balancers.
- Logs redact credentials and include request/job IDs for correlation.
- API rate limiting: global IP limit plus per-user limiter; outbound ticket-provider calls are throttled by `TICKET_RATE_LIMIT_PER_MINUTE`.
- CI: GitHub Actions workflow `.github/workflows/ci.yml` runs lint, backend/frontend tests, and Playwright smoke tests on pushes/PRs; `.github/workflows/scheduled-download.yml` runs a scheduled downloader when a `USERS_JSON` secret is configured.

See [`docs/operations.md`](docs/operations.md) for detailed deployment guidance and [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) for pre-deployment validation.

## Docker / deployment
- Build: `docker build -t uk-ticket-updater .`
- Run locally: `docker-compose up --build` (serves API on `localhost:3000`, mounts `./data` and `./downloads`).
- Configure via environment variables listed above; `JOB_QUEUE_BACKEND=persistent` is recommended for containers so jobs survive restarts.

## Testing and linting
- Run unit/integration tests: `npm test` (runs ESLint first via `pretest`)
- Lint code: `npm run lint`
- End-to-end Playwright suite (API): `npm run test:e2e`
- Tests log warnings when default `JWT_SECRET`/`ENCRYPTION_KEY` values are used; set these env vars locally if you want to silence the notices.

## Documentation

### Architecture & Design
- [**Architecture Overview**](docs/architecture.md) - System components, data flows, and technology stack
- [Database Schema](docs/db-schema.md) - Table definitions and relationships
- [Operations Guide](docs/operations.md) - Deployment, monitoring, and operational procedures

### Release & Planning
- [**CHANGELOG**](CHANGELOG.md) - Version history and release notes (see v1.0.0 for complete feature list)
- [**Release Checklist**](RELEASE_CHECKLIST.md) - Pre-deployment validation and production readiness
- [Future Work & Limitations](docs/future-work.md) - Known limitations and enhancement roadmap

### Development
- [CONTRIBUTING](CONTRIBUTING.md) - Development setup and contribution guidelines
- [AGENTS](AGENTS.md) - AI agent instructions and project overview

## Limitations and known issues
- SQLite-backed persistence is provided for both app data and the job queue; ensure the database file is backed up or mounted on durable storage in production.
- Rate limiting is in-process; distributed deployments should externalize limits (e.g., Redis) if multiple API instances run concurrently.
- Single-instance queue design: the SQLite queue is not designed for multi-instance horizontal scaling.

For detailed limitations and future enhancements, see [`docs/future-work.md`](docs/future-work.md).
