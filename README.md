# UK-TicketUpdater

Multi-user automation to download NVV semester tickets from `https://ticket.astakassel.de` using Puppeteer. Phase 1 provides an authenticated API and CLI to trigger downloads on demand; scheduling, polling of the base ticket page, and queued automation are deferred to later phases. Tickets and run history can be written to JSON or SQLite through the backend.

## What this project does
- Runs as a backend with JWT-protected routes that let admins trigger downloads for active users and users manage their own credentials/device profiles.
- Records run history (status/message/file path) in `data/history.json` or in SQLite when configured.
- Supports manual, on-demand downloads via CLI or the admin `/downloads` endpoint; legacy single-user scripts remain in `legacy/` for reference only.

## Architecture at a glance
- **API server:** `src/server.js` hosts the JWT-protected routes. Downloads run when invoked (no scheduler/polling loop yet).
- **Downloader:** `src/downloader.js` handles Puppeteer interactions with device-profile presets from `src/deviceProfiles.js`.
- **Persistence:** `src/history.js` (JSON history) and `src/db.js` (SQLite users/credentials/history/tickets).
- **Control surface:** API routes under `/downloads`, `/history`, `/tickets/:userId`, `/credentials`, and `/device-profiles` handle admin/user controls.

## Prerequisites
- Node.js 18+ and npm.
- Chromium/Chrome available for Puppeteer (set `PUPPETEER_SKIP_DOWNLOAD=1` if you provide the browser yourself).
- Network access to `https://ticket.astakassel.de`.

## Configuration (environment variables)
- `JWT_SECRET` (required in production): secret used to sign JWTs. Phase 1 accepts a dev default only outside production.
- `JWT_EXPIRY` (optional): token lifetime (default `7d`).
- `ENCRYPTION_KEY` (required in production): 32-byte key for encrypting stored credentials.
- `DB_PATH` (optional): SQLite path for the API/CLI (default `./data/app.db`).
- `OUTPUT_ROOT` (optional): Base output directory for downloads (default `./downloads`).
- `DEFAULT_DEVICE` (optional): Default device profile if none is provided per user (default `desktop_chrome`).
- `PORT` (optional): API server port (default `3000`).
- `PUPPETEER_SKIP_DOWNLOAD` (optional): Set to `1` during `npm install` to skip bundled Chromium if a system browser exists.

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
# Start the API server (manual download triggers, no polling loop yet)
ENCRYPTION_KEY=32-byte-key npm run api
```
Key routes (see `src/server.js` for full logic):
- `POST /downloads`: enqueue downloads for all active users.
- `GET /history`: view run history (from JSON or SQLite).
- `GET /tickets/:userId`: retrieve the latest ticket for a user.
- `GET/POST/PUT/DELETE /credentials`: manage ticket-site credentials (encrypted at rest).
- `GET/POST/PUT/DELETE /device-profiles`: manage per-user device presets.

## Legacy components
- `legacy/ticket-downloader.js`: Original single-user Firefox/Puppeteer script.
- `legacy/ticket-uploader.sh`: Example Nextcloud/WebDAV uploader.
These are archived for reference and are not part of the main supported flow.

## Limitations and cautions
- Downloads run sequentially per user; there is no job queue or concurrency control.
- Error reporting is primarily console-based; structured logging/metrics are limited.
- No automated CI is configured; Jest/ESLint scripts exist but may require manual setup.

## Roadmap / next steps
- Harden secrets/logging, enforce active-user filtering everywhere, and add retries/concurrency limits for the downloader.
- Expand automated tests (unit + API integration + Puppeteer smoke) and wire a simple CI workflow.
- Add scheduler/base-ticket polling and queued downloads in later phases once the core auth/data model is stable.
