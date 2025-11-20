# UK-TicketUpdater
Ein kleines Script zum automatisieren des monatlichen Downloads des Semstertickets.

Die Datei `ticket-downloader.js` beinhaltet das eigentliche Download-Script, die Datei `ticket-uploader.sh` ist ein Beispiel, wie man das Ticket nach dem Download automatisch in eine Cloud laden kann. Ich nutze dafür NextCloud, es sollte aber ohne Probleme an jede andere Cloud anpassbar sein (ChatGPT/Copilot/... ist dein Freund). Alternativ zu einem eigenen Upload-Script kann auch [rclone](https://rclone.org/) genutzt werden.

Das hier gegebene Upload-Script dient lediglich als Beispiel/Anregung, wie ein Upload an einen Ort erfolgen kann, von dem aus das Ticket genutzt werden soll (auf einem Raspberry Pi irgendwo in einer Ecke bringt das Ticket schließlich nichts...).

Das Download-Script einfach auf einem Linux-System mit nodejs, puppeteer und chromium-browser ablegen und per Cronjob immer am Ersten des Monats ausführen lassen.

Nicht vergessen die Felder `Your-UK-Number`, `Your-UK-Password` (oben im Script), sowie `/Path/To/File` und `Filename.html` (unten im Script) anzupassen!

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

## Frontend-Dashboard (Next.js)

Ein einfaches Frontend für Einladungen, Benutzerübersicht und Download-Historie liegt unter `frontend/` (Next.js + React mit i18n für Englisch/Deutsch). Das Frontend nutzt die API aus `src/server.js`.

### Entwicklung
1. API starten (optional, falls Daten vom Backend geladen werden sollen):
   ```
   npm run start:server
   ```
2. Frontend im Entwicklungsmodus starten:
   ```
   npm run dev:frontend
   ```
   Standard-Port: `http://localhost:3000`

### Produktion/Build
1. Frontend bauen:
   ```
   npm run build:frontend
   ```
2. Produktionsserver des Frontends starten (im `frontend`-Ordner):
   ```
   npm --prefix frontend run start
   ```
3. Optional API auf Port 4000 starten:
   ```
   npm run start:server
   ```

Das Frontend erwartet die API standardmäßig unter `http://localhost:4000`. Bei Bedarf kann der Endpunkt über die Variable `NEXT_PUBLIC_API_BASE_URL` angepasst werden.
