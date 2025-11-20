# UK-TicketUpdater

[![CI](https://github.com/dzjadzka/UK-TicketUpdater/actions/workflows/ci.yml/badge.svg)](https://github.com/dzjadzka/UK-TicketUpdater/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

Multi-user automation to download NVV semester tickets from `https://ticket.astakassel.de` with device-profile emulation. Tickets and run history can be stored in JSON or SQLite; an optional Express API enables programmatic access.

## Features

- 🎫 **Multi-user downloads** in one execution
- 📱 **Device emulation** (desktop Chrome, Android, iPhone, iPad)
- 💾 **Flexible storage** (JSON files or SQLite database)
- 🔒 **Secure API** with bearer token authentication and rate limiting
- ⚡ **Automated CI/CD** with GitHub Actions
- 🧪 **Comprehensive test suite** (56% coverage, 52 tests)
- 📝 **Well-documented** with JSDoc and contribution guidelines

## Prerequisites

- **Node.js** >= 18 (LTS recommended) and npm
- **Puppeteer** with Chromium - or skip download with `PUPPETEER_SKIP_DOWNLOAD=1` and provide system Chrome/Chromium
- Network access to `https://ticket.astakassel.de`

## Quick Start

```bash
# Install dependencies
PUPPETEER_SKIP_DOWNLOAD=1 npm install

# Configure users
cp config/users.sample.json config/users.json
# Edit config/users.json with your credentials

# Download tickets
npm run download

# Run tests
npm test

# Start API server
API_TOKEN=your-secret-token npm run api
```

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
  - `--db <path>`: path to SQLite database. When provided, users/history/tickets are read/written there.

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

## Development Commands

```bash
# Run tests
npm test                    # Run all tests with linting
npm run test:coverage       # Run tests with coverage report
npm run test:watch          # Run tests in watch mode

# Code quality
npm run lint                # Check code with ESLint
npm run lint:fix            # Auto-fix linting issues
npm run format              # Format code with Prettier
npm run format:check        # Check formatting without changes
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed development guidelines.

## API server (SQLite-backed)

### API-Zugriff absichern

Der neue Server (`src/server.js`) erwartet standardmäßig ein API-Token, damit nur berechtigte Clients auf die Endpunkte zugreifen können. Setze vor dem Start die Umgebungsvariable `API_TOKEN` und sende das Token anschließend als `Authorization: Bearer <Token>` im Request-Header.

- Start the API (uses `data/app.db` by default):
  ```bash
  API_TOKEN=choose-a-token npm run api
  # oder:
  export API_TOKEN=mein-geheimes-token
  npm start
  ```
- Endpoints:
  - `POST /downloads` with optional body `{ "userIds": ["user-1"], "deviceProfile": "mobile_android", "outputDir": "./downloads" }` to trigger downloads for all or selected users.
  - `GET /history?limit=50` to list recent runs from the DB.
  - `GET /tickets/:userId` to list stored tickets for a user.
- Provide `Authorization: Bearer <API_TOKEN>` when `API_TOKEN` is set.

Sollte der Betrieb ohne Token zwingend nötig sein (z. B. in einer geschlossenen Testumgebung), kann der Schutz mit `ALLOW_INSECURE=true` explizit deaktiviert werden. Ohne `API_TOKEN` **und** ohne `ALLOW_INSECURE=true` antwortet der Server mit HTTP 401.

## Legacy scripts / Alte Skripte

Die Datei `ticket-downloader.js` beinhaltet das eigentliche Download-Script, die Datei `ticket-uploader.sh` ist ein Beispiel, wie man das Ticket nach dem Download automatisch in eine Cloud laden kann. Ich nutze dafür NextCloud, es sollte aber ohne Probleme an jede andere Cloud anpassbar sein (ChatGPT/Copilot/... ist dein Freund). Alternativ zu einem eigenen Upload-Script kann auch [rclone](https://rclone.org/) genutzt werden.

Das hier gegebene Upload-Script dient lediglich als Beispiel/Anregung, wie ein Upload an einen Ort erfolgen kann, von dem aus das Ticket genutzt werden soll (auf einem Raspberry Pi irgendwo in einer Ecke bringt das Ticket schließlich nichts...).

- `ticket-downloader.js`: original single-user downloader (Firefox-based). Retained for reference.
- `ticket-uploader.sh`: example Nextcloud/WebDAV uploader. Currently not part of the main flow.

## Cron example

Run the multi-user downloader on the 1st of each month, hours 0–10 (once per hour):

```cron
0 0-10 1 * * /usr/bin/node /path/to/repo/src/index.js --users /path/to/config/users.json --output /path/to/downloads
```

Ensure the configured user has permission to write into the output and history directories.

### Update 09.2025!

Wechsel zu Firefox wegen fehlender Abhängigkeiten unter Debian 13. Der Prozess sollte davon abgesehen auch unter Debian 13 weiter funktionieren.

### Update 01.2025!

Sollte Puppeteer beim Ausführen des Skripts einen Fehler anzeigen, dass der Browser nicht gestartet werden konnte, kann das unter Debian 12 daran liegen, dass die Bibliothek `libnss3` fehlt, diese lässt sich einfach allerdings einfach nachinstallieren:

```bash
apt-get install libnss3
```

## Wie installiere ich nodejs unter Debian 12?

Auf einem neuen Debian 12:

```bash
apt update && apt upgrade -y
apt install nodejs npm
apt install firefox-esr
```

Danach noch einen Benutzer für nodejs anlegen:

```bash
adduser nodejs
```

Zum neuen Nutzer wechseln:

```bash
su nodejs
cd ~
```

Und puppeteer installieren:

```bash
npm install puppeteer
```

Das Script sollte nun mit dem nodejs Benutzer ausführbar sein.

## Wie erstelle ich einen Cronjob?

(Anmerkung: Jeder Benutzer hat seine eigene crontab-Datei, der Cronjob muss also auf dem nodejs Benutzer erstellt werden!)

Die crontab-Datei öffnen und mit dem Editor deiner Wahl bearbeiten:

```bash
crontab -e
```

Am Ende der Datei folgende Zeile hinzufügen:

```cron
0 0-10 1 * * /Path/To/Script.sh
```

Jetzt wird das Script immer am ersten des Monats von 0 bis 10 Uhr zu jeder vollen Stunde einmal ausgeführt (Falls die Uni Server ausnahmweise mal Probleme machen sollten).
