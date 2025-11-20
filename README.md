# UK-TicketUpdater

Ein kleines Script zum automatisieren des monatlichen Downloads des Semestertickets – jetzt wahlweise per CLI oder über eine kleine Express-API.

## Installation

```bash
npm install
```

Optional können folgende Umgebungsvariablen gesetzt werden:

- `PORT`: Port für die API (Standard `3000`).
- `DOWNLOAD_DIRECTORY`: Speicherort für heruntergeladene Tickets (Standard `./downloads`).
- `HISTORY_FILE`: Pfad zur History-Datei (Standard `./data/history.json`).
- `BROWSER_PRODUCT`: Browser für Puppeteer (`firefox` oder `chrome`, Standard `firefox`).
- `API_TOKENS`: JSON-Array für Token- und Rollen-Definitionen, z. B. `[{"token":"admin-token","role":"admin"},{"token":"user-token","role":"user","userId":"student1"}]`.

## CLI

Tickets lassen sich weiterhin direkt per CLI herunterladen. Der Download läuft interaktiv, fehlende Parameter werden abgefragt:

```bash
npm run cli -- --userId student1 --username Your-UK-Number --password Your-UK-Password --filename student1.html
```

Der Download landet standardmäßig im Ordner `downloads/`.

## API

Die API startet mit:

```bash
npm run start
# oder im Watch-Modus
npm run dev:api
```

### Authentifizierung & Autorisierung

Jeder Request benötigt ein Token (HTTP Header `Authorization: Bearer <token>` oder `x-api-key`). Rollen werden per `API_TOKENS` gesetzt:

- `admin`: darf alle Endpunkte aufrufen und beliebige Nutzer/innen starten.
- `user`: darf nur für die eigene `userId` Downloads anstoßen und das eigene Ticket abrufen.

### Endpunkte

- `POST /downloads`
  - Startet einen oder mehrere Downloads.
  - Body: `{ "userId": "student1", "username": "Your-UK-Number", "password": "Your-UK-Password", "filename": "ticket.html" }`
  - Alternativ mehrere Jobs: `{ "requests": [ { ... }, { ... } ] }`.
  - Antwort enthält eine Ergebnisliste mit Status, Zeitstempeln und Pfad der Datei.

- `GET /history`
  - Nur für Admins.
  - Liefert die komplette Download-Historie aus `data/history.json`.

- `GET /tickets/:userId`
  - Liefert das zuletzt erfolgreich geladene Ticket für die angegebene `userId`.
  - `user`-Tokens dürfen nur die eigene `userId` abrufen.

## Cronjob-Hinweis

Das CLI-Script kann wie bisher per Cronjob ausgeführt werden. Beispiel:

```cron
0 0-10 1 * * cd /Path/To/UK-TicketUpdater && npm run cli -- --userId student1 --username Your-UK-Number --password Your-UK-Password --filename student1.html
```

## Legacy

Die ursprüngliche Datei `ticket-downloader.js` bleibt als Referenz erhalten, die aktuelle Logik steckt jedoch in `src/downloader.js` und wird sowohl von CLI als auch von der API verwendet.
