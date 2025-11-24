# Repository Analysis

## Current scope

- Multi-user NVV semester ticket automation built on Node.js (CommonJS) with Puppeteer for browser control.
- SQLite-backed persistence for users, encrypted credentials, tickets, download history, base ticket state, and invite tokens.
- Express API (`src/server.js`) exposing auth, user self-service, admin management, download triggers, and observability endpoints.
- Background job system (`src/jobs/`) that polls the base ticket, compares hashes, and fans out per-user downloads via an in-memory queue.
- Device emulation presets plus optional per-user custom profiles stored in the database.

## Structure

- `src/index.js`: CLI entrypoint for JSON- or DB-backed downloads.
- `src/server.js`: API server with JWT authentication/authorization, credential management, job/admin endpoints, and observability routes.
- `src/jobs/`: Queue, scheduler, and handlers for base ticket checks and user downloads.
- `src/downloader.js`: Puppeteer navigation, login helpers, and ticket retrieval logic.
- `src/db.js`: SQLite schema, data access helpers, and credential encryption integration.
- `frontend/`: Vite/React scaffold not yet wired to the backend (API-only for now).
- `legacy/`: Archived single-user scripts retained solely for reference and not invoked by current code or scripts.

## Build, run, and tests

- Install dependencies: `PUPPETEER_SKIP_DOWNLOAD=1 npm install` (or allow Chromium download).
- CLI downloads: `npm run download` (JSON) or `npm run download:db` after `npm run setup:db`.
- API with scheduler: `npm run api` with `JWT_SECRET`, `ENCRYPTION_KEY`, and admin ticket credentials set; scheduler can be disabled via `JOBS_SCHEDULER_ENABLED=false`.
- Validation: `npm test` for unit/integration coverage, `npm run lint` for static analysis, and `npm run test:e2e` for Playwright checks.

## Notable behaviors

- Auto-download is gated by `auto_download_enabled` and active/non-deleted users; missing credentials mark errors in `user_credentials`.
- Base ticket changes trigger a hash update and queue fan-out; unchanged hashes only refresh timestamps.
- Ticket deduplication uses SHA-256 hashes to avoid storing duplicate versions; download history captures both successes and failures for admin review.

## Open risks / follow-ups

- Job queue is in-memory; a restart clears pending work. Consider Redis/SQLite-backed persistence for durability.
- No production-ready frontend yet; users and admins interact via CLI/API or tooling layered on top.
- Observability focuses on logs and API summaries; metrics/alerts should be added for deployments.

## Cleanup phase status

- **Phase 0 – Discovery & Plan:** Complete. Repository inventory and cleanup plan drafted covering documentation accuracy, quality gates, dead code review, structural tidy, implementation cleanup, and DX updates.
- **Phase 1 – Safety Net (Tests / Lint / Format):** In progress. Jest suite verified via `npm test --silent` (runs lint via pretest); no added tooling or coverage yet.
- **Phase 2 – Dead Code and Duplication:** Not started. Checklist of unused/legacy modules still pending before removals.
- **Phase 3 – Structure, Naming, and Organization:** Not started. Awaiting dead code review to guide targeted refactors.
- **Phase 4 – Implementation Cleanup:** Not started. Complexity/duplication cleanup queued after structural review.
- **Phase 5 – Dependencies, Config, and DX:** Not started. Dependency audit and DX improvements will follow earlier phases.
