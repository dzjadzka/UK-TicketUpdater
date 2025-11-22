# Operations guide

This document captures how the current system starts, schedules background work, and exposes operational controls based on the implemented code paths.

## Runtime entrypoints
- **API server**: `npm run api` (alias of `npm start`) executes `src/server.js`, initializes SQLite (`DB_PATH`, default `./data/app.db`), and starts the background scheduler unless `JOBS_SCHEDULER_ENABLED=false`.
- **Downloader CLI**: `npm run download` (JSON users) or `npm run download:db` (SQLite-backed) executes `src/index.js` with the configured user source. Flags include `--users`, `--db`, `--output`, `--device`, `--history`, `--queue-backend`, and `--concurrency`. Run `npm run download -- --help` for full usage.
- **Database setup**: `npm run setup:db` seeds `data/app.db` from `config/users.json` when present.
- **Frontend**: `npm run dev:frontend` for local development, `npm run build:frontend` for a production bundle. Point `VITE_API_BASE_URL` at the API origin when reverse-proxying.

## Background jobs and scheduler
- **Scheduler cadence**: `BASE_TICKET_CHECK_INTERVAL_HOURS` sets the interval for `checkBaseTicket`; defaults to 6 hours via `JobScheduler` (`src/jobs/scheduler.js`).
- **Enable/disable**: Scheduler starts automatically from `src/server.js` when the API boots. Disable by exporting `JOBS_SCHEDULER_ENABLED=false`.
- **Base ticket check**: `checkBaseTicket` logs in with `TICKET_ADMIN_USERNAME`/`TICKET_ADMIN_PASSWORD` (or `ADMIN_TICKET_USERNAME`/`ADMIN_TICKET_PASSWORD`), fetches the base ticket HTML, computes a SHA-256 hash, and updates `base_ticket_state`. On change, it enqueues `downloadTicketsForAllUsers`.
- **Per-user downloads**: `downloadTicketsForAllUsers` enqueues `downloadTicketForUser` for active users with `auto_download_enabled=true`. Each job decrypts stored credentials, prepares a device profile (including custom DB-backed profiles), downloads HTML via Puppeteer, hashes content to deduplicate, writes files under the user output directory, and records runs and ticket versions in SQLite.
- **Queue behavior**: Two backends are available. In-memory `JobQueue` (`JOB_QUEUE_BACKEND=memory`) remains for lightweight/dev use. When a DB is present the default is the SQLite-backed `job_queue` (`JOB_QUEUE_BACKEND=persistent`) for restart safety. Metrics (enqueued/completed/failed/retries/pending) are exposed at `GET /admin/observability/queue` and `/metrics`.

## Request handling and rate limits
- API requests receive unique request IDs and structured JSON logging via `src/server.js`.
- Global IP limit: 100 requests per 15 minutes.
- Authenticated limiter: `AUTH_RATE_LIMIT_MAX` over `AUTH_RATE_LIMIT_WINDOW_MS` (default 300 requests/15m) keyed by user ID/IP.
- Outbound token bucket to the ticket provider: tune with `TICKET_RATE_LIMIT_PER_MINUTE` / `TICKET_RATE_LIMIT_WINDOW_MS`.

## Observability endpoints (admin JWT required)
- `GET /admin/observability/errors`: recent download failures.
- `GET /admin/observability/job-summary`: job counts over the last N hours (`hours` query param, default 24).
- `GET /admin/observability/base-ticket`: current base ticket hash and timestamps.
- `GET /admin/observability/queue`: queue metrics (backend, pending/running counts, retry/failure counters).
- `GET /metrics`: Prometheus-format queue and rate-limiter gauges/counters for scraping.
- `POST /admin/jobs/check-base-ticket`: manual base ticket run.
- `POST /admin/jobs/download-all`: enqueue downloads for all auto-enabled users.
- `GET /health`: liveness signal (no auth).
- `GET /ready`: readiness (DB reachability + queue metrics) for load balancers (no auth).

## Data and secrets
- SQLite path: `DB_PATH` (default `./data/app.db`). History JSON path defaults to `./data/history.json` when not using SQLite.
- Downloads: `OUTPUT_ROOT` sets the base directory (`./downloads` default) when not overridden per user.
- Secrets: `JWT_SECRET` for API auth; `ENCRYPTION_KEY` (32 bytes) encrypts stored credentials; admin ticket credentials required for base ticket checks.

## Security & secrets
- Use environment variables for all secrets (JWT, encryption key, admin ticket credentials). Avoid committing `.env` files.
- Audit logs emit for invite creation/deletion/redemption, credential updates, and device profile changes with user IDs for traceability.
- For production, run behind TLS termination and rotate JWT/encryption keys using your secrets manager of choice.

## Automated workflows
- **CI (`.github/workflows/ci.yml`)**: runs ESLint via `pretest`, backend Jest suites, frontend tests, installs Playwright, and executes Playwright API smoke tests on pushes/PRs.
- **Scheduled downloader (`.github/workflows/scheduled-download.yml`)**: cron-triggered workflow that writes `config/users.ci.json` from the `USERS_JSON` secret and runs `npm run download -- --users ./config/users.ci.json --output ./downloads/ci`.

## Containers and deployment
- **Build**: `docker build -t uk-ticket-updater .`
- **Compose**: `docker-compose up --build` brings up the API with persistent SQLite-backed queue (volumes `./data` and `./downloads`).
- Static frontend bundle from `frontend/dist` is served at `/app` when present in the container.

## Release readiness checklist (quick)
- Secrets set: `JWT_SECRET`, `ENCRYPTION_KEY`, admin ticket credentials, and rate-limit knobs.
- Storage mounted: `DB_PATH` directory and `OUTPUT_ROOT` are writable/persistent.
- Queue backend confirmed: `JOB_QUEUE_BACKEND=persistent` for API deployments; `/ready` and `/metrics` healthy.
- CI green: GitHub Actions `CI` and `Scheduled multi-user download` badges passing.
- Monitoring: scrape `/metrics`, `/health`, `/ready`; alert on queue failures/retries and rate-limit drops.
