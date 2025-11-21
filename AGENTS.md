# AGENTS.md

## Project overview

- Multi-user NVV semester ticket downloader using Puppeteer with device-profile emulation.
- Core code lives in `src/` with per-user configuration in `config/users.json` (sample provided).
- Downloads HTML tickets to `downloads/<user-id>/` and records run history in `data/history.json`.
- Legacy scripts: `ticket-downloader.js` (single-user, Firefox) and `ticket-uploader.sh` (Nextcloud/WebDAV example) are kept for reference only.

## Setup commands

- Install Node.js (>=18 recommended) and npm.
- Install dependencies (skip bundled Chromium if you provide your own):
  - `PUPPETEER_SKIP_DOWNLOAD=1 npm install`
- Copy and edit the users config (if using JSON):
  - `cp config/users.sample.json config/users.json`
  - Fill `username`, `password`, and optional `deviceProfile`/`outputDir` per user.
- (Optional) Initialize SQLite and import users from JSON:
  - `npm run setup:db` (creates `data/app.db` and imports users if config exists).

## Dev environment tips

- Main entrypoint: `src/index.js`. Run with `node src/index.js --users ./config/users.json` or `npm run download`.
- SQLite mode: seed with `npm run setup:db` then run `npm run download:db` (users/history/tickets come from DB).
- API server: `npm run api` (JWT-protected endpoints like `/downloads`, `/history`, `/tickets/:userId`, and admin/user management).
- All server endpoints are protected by JWT authentication in `src/server.js`. Requests must include `Authorization: Bearer <JWT>`.
- Device profiles available: `desktop_chrome`, `mobile_android`, `iphone_13`, `tablet_ipad` (see `src/deviceProfiles.js`).
- CLI flags:
  - `--users <path>` users config (default `./config/users.json`).
  - `--output <path>` base downloads directory (default `./downloads`).
  - `--device <profile>` default device profile if a user lacks one (default `desktop_chrome`).
  - `--history <path>` history JSON path (default `./data/history.json`), ignored when using `--db`.
  - `--db <path>` SQLite path; when set, users/history/tickets persist in DB.
- History entries (per run/per user) are appended automatically; directories are created if missing.
- Keep credentials only in local `config/users.json` or your DB. Do not commit real data.

## Testing instructions

- No automated tests are present. Basic verification commands:
  - `npm run download:sample` (uses placeholder users).
  - `npm run download -- --users ./config/users.json` (after filling credentials).
  - `npm run download:db` after running `npm run setup:db`.
- Update tests when changing authentication logic to ensure `/downloads`, `/history`, and `/tickets/:userId` require JWT auth (and admin role where applicable).
- If Puppeteer cannot find a browser, either allow it to download Chromium (remove `PUPPETEER_SKIP_DOWNLOAD`) or install system Chromium/Chrome and rerun.

## Code style

- CommonJS JavaScript targeting Node.js. Use async/await and keep helper modules under `src/`.
- Maintain 2-space indentation and single quotes as used in the new modules.
- Avoid committing generated artifacts (`downloads/`, `data/history.json`, `config/users.json`).

## PR / commit instructions

- Write clear commit messages summarizing behavior changes.
- Since CI is absent, manually run the downloader (sample or real config) after changes touching `src/`.

## Security & safety notes

- Never commit real credentials, tickets, or history files. `config/users.json`, `downloads/`, `data/history.json`, and `data/*.db` are git-ignored.
- Set `JWT_SECRET` when running the API to avoid unauthenticated access; do not log or commit secrets.
- The downloader writes to paths you configure; ensure the executing user has write permissions and paths are safe.
- The legacy uploader script uses basic auth for WebDAV; treat its placeholders as secrets if you ever adapt it.

## CI & deployment notes

- No CI or deployment automation. Scripts are run directly (e.g., cron on a host). Keep commands deterministic and avoid destructive side effects.
