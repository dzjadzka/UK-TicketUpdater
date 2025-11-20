# UK-TicketUpdater
Ein kleines Script zum automatisieren des monatlichen Downloads des Semstertickets.

Die Datei `ticket-downloader.js` beinhaltet das eigentliche Download-Script, die Datei `ticket-uploader.sh` ist ein Beispiel, wie man das Ticket nach dem Download automatisch in eine Cloud laden kann. Ich nutze dafür NextCloud, es sollte aber ohne Probleme an jede andere Cloud anpassbar sein (ChatGPT/Copilot/... ist dein Freund). Alternativ zu einem eigenen Upload-Script kann auch [rclone](https://rclone.org/) genutzt werden.

Das hier gegebene Upload-Script dient lediglich als Beispiel/Anregung, wie ein Upload an einen Ort erfolgen kann, von dem aus das Ticket genutzt werden soll (auf einem Raspberry Pi irgendwo in einer Ecke bringt das Ticket schließlich nichts...).

Das Download-Script einfach auf einem Linux-System mit nodejs, puppeteer und chromium-browser ablegen und per Cronjob immer am Ersten des Monats ausführen lassen.

Für die Automatisierung genügt es, die Zugangsdaten in der `users.json` und ein Ausgabeverzeichnis zu hinterlegen (siehe unten).

### Neue CLI-Optionen
Die automatisierten Tests erwarten eine `users.json` mit folgendem Aufbau:

```
[
  { "username": "Your-UK-Number", "password": "Your-UK-Password" }
]
```

Wichtige Parameter des Download-Skripts (alle optional, Standardwerte in Klammern):

- `--users=/pfad/zur/users.json` (`./users.json`)
- `--output=/pfad/zum/zielordner` (aktuelles Arbeitsverzeichnis)
- `--file=filename.html` (`ticket.html`)
- `--db=/pfad/zur/download-history.json` (`./download-history.json`)
- `--product=firefox` (Browser-Engine für Puppeteer)
- `--headful` (deaktiviert headless-Betrieb)

## Update 09.2025!
Wechsel zu Firefox wegen fehlender Abhängigkeiten unter Debian 13
Der Prozess sollte davon abgesehen auch unter Debian 13 weiter funktionieren.

## Update 01.2025!
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

## Entwicklung

### Lokale Installation
```
npm ci
```

### Wichtige Befehle
- `npm run lint` – führt ESLint mit der Prettier-Integration aus.
- `npm test` – führt die Jest-Tests aus (inklusive Puppeteer-Mocks).
- `npm run test:api` – führt die API-/Integrations-Tests aus.

### Continuous Integration
GitHub Actions führt bei jedem Push und Pull Request automatisch `npm ci`, `npm run lint` und `npm test` aus (siehe `.github/workflows/ci.yml`).
