# UK-TicketUpdater

Multi-user automation to download NVV semester tickets from `https://ticket.astakassel.de` using Puppeteer. **Phase 2** includes a background job queue, automated base ticket monitoring, and admin observability endpoints. The system automatically detects ticket changes and downloads updated tickets for users with auto-download enabled.

## What this project does
- **Automated ticket monitoring**: Periodically checks for base ticket changes using admin credentials and triggers user downloads when changes are detected.
- **Background job queue**: Processes ticket downloads with configurable concurrency, retry logic, and error handling.
- **User management**: JWT-protected API for users to manage credentials and view their ticket history.
- **Admin dashboard API**: Endpoints for user management, job control, and observability (error tracking, job statistics).
- **Ticket versioning**: Detects duplicate tickets via content hashing to avoid redundant downloads.
- Records history and tickets in SQLite with structured logging for production observability.

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
- `BASE_TICKET_CHECK_INTERVAL_HOURS`: Hours between base ticket checks (default `6`).
- `JOBS_SCHEDULER_ENABLED`: Set to `false` to disable automatic scheduler (default `true`).
- `PUPPETEER_SKIP_DOWNLOAD`: Set to `1` during `npm install` to skip bundled Chromium.

## Setup
```bash
# Install dependencies (skip Chromium download if you have one installed)
PUPPETEER_SKIP_DOWNLOAD=1 npm install

# Prepare a users config (JSON mode)
cp config/users.sample.json config/users.json
# Fill username/password and optional deviceProfile/outputDir per entry

# (Optional) Initialize SQLite from JSON users
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
```
CLI flags:
- `--users <path>`: Users config path (default `./config/users.json`).
- `--output <path>`: Base download directory (default `./downloads`).
- `--device <profile>`: Default device profile (`desktop_chrome`, `mobile_android`, `iphone_13`, `tablet_ipad`).
- `--history <path>`: JSON history path (default `./data/history.json`; ignored when using `--db`).
- `--db <path>`: SQLite path; when set, users/history/tickets are read/written there.

## API server
```bash
# Start the API server with background job scheduler
JWT_SECRET=your-secret ENCRYPTION_KEY=32-byte-key \
TICKET_ADMIN_USERNAME=admin TICKET_ADMIN_PASSWORD=admin-pass \
npm run api
```

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

## Legacy components
- `legacy/ticket-downloader.js`: Original single-user Firefox/Puppeteer script.
- `legacy/ticket-uploader.sh`: Example Nextcloud/WebDAV uploader.
These are archived for reference and are not part of the main supported flow.

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

## Limitations and cautions
- Job queue is in-memory (resets on restart); persistent queue planned for Phase 3.
- No rate limiting per user for external API calls yet.
- No automated CI/CD pipeline configured (manual testing required).

## Roadmap / next steps (Phase 3)
- Persistent job queue (Redis or database-backed)
- Frontend UI for admin dashboard and user self-service
- CI/CD pipeline with automated tests
- Metrics and alerting (Prometheus/Grafana)
- Rate limiting and request throttling
