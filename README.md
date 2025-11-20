# UK-TicketUpdater
Ein kleines Script zum automatisieren des monatlichen Downloads des Semstertickets.

Die Datei `ticket-downloader.js` beinhaltet das eigentliche Download-Script, die Datei `ticket-uploader.sh` ist ein Beispiel, wie man das Ticket nach dem Download automatisch in eine Cloud laden kann. Ich nutze dafür NextCloud, es sollte aber ohne Probleme an jede andere Cloud anpassbar sein (ChatGPT/Copilot/... ist dein Freund). Alternativ zu einem eigenen Upload-Script kann auch [rclone](https://rclone.org/) genutzt werden.

Das hier gegebene Upload-Script dient lediglich als Beispiel/Anregung, wie ein Upload an einen Ort erfolgen kann, von dem aus das Ticket genutzt werden soll (auf einem Raspberry Pi irgendwo in einer Ecke bringt das Ticket schließlich nichts...).

Das Download-Script einfach auf einem Linux-System mit nodejs, puppeteer und chromium-browser ablegen und per Cronjob immer am Ersten des Monats ausführen lassen.

Nicht vergessen die Felder `Your-UK-Number`, `Your-UK-Password` (oben im Script), sowie `/Path/To/File` und `Filename.html` (unten im Script) anzupassen!

## Retention/Cleanup

Neben dem Download-Script gibt es nun eine kleine Verwaltungsschicht für die erzeugten Dateien. Die SQLite-Datenbank (per Voreinstellung `data/tickets.db`) besitzt eine Tabelle `files` mit folgenden Spalten:

- `userId`
- `path`
- `createdAt`
- `status`

Der Standard-TTL beträgt 720 Stunden (30 Tage) und kann über die Umgebungsvariable `DEFAULT_TTL_HOURS` angepasst werden.

### CLI

Der neue CLI-Einstiegspunkt liegt unter `src/index.js` (Start per `npm run cli -- <command>`):

- `register --user <id> --path <pfad> [--status <status>]`: legt einen Eintrag in der `files`-Tabelle an.
- `list [--user <id>]`: gibt die gespeicherten Dateien aus.
- `download --ids 1,2 --output ./zielverzeichnis`: kopiert selektierte Dateien anhand ihrer IDs in ein Zielverzeichnis.
- `cleanup [--ttl <stunden>]`: löscht Dateien und DB-Einträge, die älter als der TTL sind (Standard 720 Stunden).
- `remove <id>`: entfernt einen einzelnen Eintrag und löscht die Datei, falls vorhanden.

### API

Über `npm start` wird ein kleiner HTTP-Server gestartet (Standard-Port 3000), der folgende Endpunkte bereitstellt:

- `GET /files[?userId=<id>]`: listet die gespeicherten Dateien.
- `POST /files` mit Payload `{ "userId": "...", "path": "...", "status": "optional" }`: legt einen Eintrag an.
- `DELETE /files/expired[?ttlHours=72]`: löscht abgelaufene Einträge/Dateien anhand des TTL (Fallback auf `DEFAULT_TTL_HOURS`).
- `DELETE /files/:id`: entfernt einen einzelnen Eintrag samt Datei.
# Update 09.2025!
Wechsel zu Firefox wegen fehlender Abhängigkeiten unter Debian 13
Der Prozess sollte davon abgesehen auch unter Debian 13 weiter funktionieren.
# Update 01.2025!
Sollte Puppeteer beim Ausführen des Skripts einen Fehler anzeigen, dass der Browser nicht gestartet werden konnte, kann das unter Debian 12 daran liegen, dass die Bibliothek `libnss3` fehlt, diese lässt sich einfach allerdings einfach nachinstallieren:
```
apt-get install libnss3
```

## Wie installiere ich nodejs unter Debian 12?
Auf einem neuen Debian 12:
```
apt update && apt upgrade -y
apt install nodejs npm
apt install firefox-esr
```

Danach noch einen Benutzer für nodejs anlegen:
```
adduser nodejs
```

Zum neuen Nutzer wechseln:
```
su nodejs
cd ~
```

Und puppeteer installieren:
```
npm install puppeteer
```

Das Script sollte nun mit dem nodejs Benutzer ausführbar sein.

## Wie erstelle ich einen Cronjob?
(Anmerkung: Jeder Benutzer hat seine eigene crontab-Datei, der Cronjob muss also auf dem nodejs Benutzer erstellt werden!)

Die crontab-Datei öffnen und mit dem Editor deiner Wahl barbeiten:
```
crontab -e
```

Am Ende der Datei folgende Zeile hinzufügen:
```
0 0-10 1 * * /Path/To/Script.sh
```

Jetzt wird das Script immer am ersten des Monats von 0 bis 10 Uhr zu jeder vollen Stunde einmal ausgeführt (Falls die Uni Server ausnahmweise mal Probleme machen sollten).
