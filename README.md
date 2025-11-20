# UK-TicketUpdater

Multi-user automation to download NVV semester tickets from `https://ticket.astakassel.de` with device-profile emulation. Tickets and run history can be stored in JSON or SQLite; an optional legacy uploader script remains for reference but is not maintained.

## Features
- Run downloads for multiple users in one execution.
- Emulate common device types (desktop, Android, iPhone, iPad) via user-agent and viewport settings.
- Store per-user tickets under `downloads/<user-id>/` (configurable per user) and append a run history to `data/history.json` or SQLite.
- Simple CLI flags to pick config paths, default device profile, output directories, or a SQLite database.
- Optional Express API to trigger downloads and read history/tickets from the database.

## Prerequisites
- Node.js (>=18 recommended) and npm.
- Puppeteer dependency installed with Chromium available. To skip the Chromium download during install, set `PUPPETEER_SKIP_DOWNLOAD=1` and ensure a system Chromium/Chrome is present.
- Network access to `https://ticket.astakassel.de`.

## Setup
1. Install dependencies (skip browser download if you already have Chromium):
   ```bash
   PUPPETEER_SKIP_DOWNLOAD=1 npm install
   ```
2. Create a users config from the sample and fill in credentials (kept locally):
   ```bash
   cp config/users.sample.json config/users.json
   # edit config/users.json with your accounts, deviceProfile, and optional outputDir
   ```

3. (Optional) Initialize SQLite and import users:
   ```bash
   npm run setup:db
   ```
   By default this creates `data/app.db` and imports users from `config/users.json` when it exists.

## Running downloads
- Using your config:
  ```bash
  npm run download
  ```
- Against the sample config (placeholders only):
  ```bash
  npm run download:sample
  ```
- Using SQLite (reads users from `data/app.db`):
  ```bash
  npm run download:db
  ```
- CLI flags (optional):
  - `--users <path>`: path to users config (default `./config/users.json`).
  - `--output <path>`: base output directory (default `./downloads`).
  - `--device <profile>`: default device profile if a user entry does not specify one (default `desktop_chrome`).
  - `--history <path>`: where to store the run history JSON (default `./data/history.json`). Ignored when using SQLite.
  - `--db <path>`: path to SQLite database. When provided, users and history/tickets are read/written there.

Each user entry results in one ticket file named `ticket-<timestamp>.html` saved to its configured directory. History entries contain user id, device profile, status, message, and file path (if any).

## Users config format
`config/users.json` should be an array of user objects:
```json
[
  {
    "id": "user-1",
    "username": "Your-UK-Number",
    "password": "Your-UK-Password",
    "deviceProfile": "desktop_chrome",
    "outputDir": "./downloads/user-1"
  }
]
```
- `deviceProfile` options: `desktop_chrome`, `mobile_android`, `iphone_13`, `tablet_ipad`.
- `outputDir` is optional; falls back to `<output base>/<user-id>`.

## API server (SQLite-backed)
- Start the API (uses `data/app.db` by default):
  ```bash
  API_TOKEN=choose-a-token npm run api
  ```
- Endpoints:
  - `POST /downloads` with optional body `{ "userIds": ["user-1"], "deviceProfile": "mobile_android", "outputDir": "./downloads" }` to trigger downloads for all or selected users.
  - `GET /history?limit=50` to list recent runs from the DB.
  - `GET /tickets/:userId` to list stored tickets for a user.
- Provide `Authorization: Bearer <API_TOKEN>` when `API_TOKEN` is set; otherwise the API is open (not recommended).

## Legacy scripts
- `ticket-downloader.js`: original single-user downloader (Firefox-based). Retained for reference.
- `ticket-uploader.sh`: example Nextcloud/WebDAV uploader. Currently not part of the main flow.

## Cron example
Run the multi-user downloader on the 1st of each month, hours 0–10 (once per hour):
```cron
0 0-10 1 * * /usr/bin/node /path/to/repo/src/index.js --users /path/to/config/users.json --output /path/to/downloads
```
Ensure the configured user has permission to write into the output and history directories.
