# UK-TicketUpdater

Multi-user automation to download NVV semester tickets from `https://ticket.astakassel.de` using Puppeteer. Tickets and run history can be written to JSON or SQLite, and an Express API exposes download and management endpoints. A Vite/React frontend scaffold exists but is not yet connected to the backend.

## What this project does
- Runs headless browser sessions per user to fetch the current semester ticket HTML and save it under `downloads/<user-id>/`.
- Records run history (status/message/file path) in `data/history.json` or in SQLite when configured.
- Provides an optional Express server with JWT-based auth (with invite tokens) plus a legacy API-token mode for triggering downloads, viewing history, and managing credentials/device profiles.
- Legacy single-user scripts remain in `legacy/` for reference only.

## Architecture at a glance
- **CLI entrypoint:** `src/index.js` orchestrates multi-user downloads (JSON config or SQLite users/history).
- **Downloader:** `src/downloader.js` handles Puppeteer interactions with device-profile presets from `src/deviceProfiles.js`.
- **Persistence:** `src/history.js` (JSON history) and `src/db.js` (SQLite users/credentials/history/tickets, invite tokens).
- **API server:** `src/server.js` exposes `/auth`, `/credentials`, `/device-profiles`, `/admin/*`, `/downloads`, `/history`, and `/tickets/:userId` with JWT or legacy API-token protection.
- **Frontend:** `frontend/` is a Vite/React/Tailwind scaffold with placeholder scripts; no production UI is implemented.

## Prerequisites
- Node.js 18+ and npm.
- Chromium/Chrome available for Puppeteer (set `PUPPETEER_SKIP_DOWNLOAD=1` if you provide the browser yourself).
- Network access to `https://ticket.astakassel.de`.

## Configuration (environment variables)
- `API_TOKEN` (optional): Token for legacy bearer auth on download/history/ticket routes. If unset, `ALLOW_INSECURE=true` must be provided to bypass.
- `ALLOW_INSECURE` (optional): Set to `true` only in closed/dev environments to permit unauthenticated legacy routes.
- `JWT_SECRET` (recommended): Secret for signing JWTs (required in production); falls back to a dev default otherwise.
- `JWT_EXPIRY` (optional): JWT expiry, defaults to `7d`.
- `ENCRYPTION_KEY` (recommended): 32-byte key for encrypting stored credentials (required in production).
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
# Legacy API-token mode (protects /downloads, /history, /tickets/:userId)
API_TOKEN=choose-a-token npm run api

# JWT + invite flow (credentials/device-profiles/admin routes)
JWT_SECRET=strong-secret ENCRYPTION_KEY=32-byte-key npm run api
```
Key routes (see `src/server.js` for full logic):
- `POST /auth/register` (invite required) and `POST /auth/login` for JWTs.
- `GET/POST/PUT/DELETE /credentials` for ticket-site credentials (encrypted at rest).
- `GET/POST/PUT/DELETE /device-profiles` for per-user device presets.
- Admin-only: `POST/GET/DELETE /admin/invites`, `GET /admin/users`, `PUT /admin/users/:id/disable`.
- Legacy download surface: `POST /downloads`, `GET /history`, `GET /tickets/:userId` (API token or `ALLOW_INSECURE=true`).

## Legacy components
- `legacy/ticket-downloader.js`: Original single-user Firefox/Puppeteer script.
- `legacy/ticket-uploader.sh`: Example Nextcloud/WebDAV uploader.
These are archived for reference and are not part of the main supported flow.

## Limitations and cautions
- Downloads run sequentially per user; there is no job queue or concurrency control.
- Error reporting is primarily console-based; structured logging/metrics are limited.
- Frontend is a placeholder and not wired to the API.
- No automated CI is configured; Jest/ESLint scripts exist but may require manual setup.

## Roadmap / next steps
- Update documentation set (architecture, operations, legacy notes) to match the backend-centric flow.
- Harden secrets/logging and add retries/concurrency limits for the downloader.
- Expand automated tests (unit + API integration + Puppeteer smoke) and wire a simple CI workflow.
- Revisit frontend implementation once backend is hardened.
