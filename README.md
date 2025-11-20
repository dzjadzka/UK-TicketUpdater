# UK-TicketUpdater
Ein kleines Script zum automatisieren des monatlichen Downloads des Semstertickets.

Die Datei `ticket-downloader.js` beinhaltet das eigentliche Download-Script, die Datei `ticket-uploader.sh` ist ein Beispiel, wie man das Ticket nach dem Download automatisch in eine Cloud laden kann. Ich nutze dafür NextCloud, es sollte aber ohne Probleme an jede andere Cloud anpassbar sein (ChatGPT/Copilot/... ist dein Freund). Alternativ zu einem eigenen Upload-Script kann auch [rclone](https://rclone.org/) genutzt werden.

Das hier gegebene Upload-Script dient lediglich als Beispiel/Anregung, wie ein Upload an einen Ort erfolgen kann, von dem aus das Ticket genutzt werden soll (auf einem Raspberry Pi irgendwo in einer Ecke bringt das Ticket schließlich nichts...).

## Konfiguration (Pseudo-DB)
Die Konfiguration wird in `db/config.json` gehalten und dient als kleine, dateibasierte „DB“. Hier werden Zugangsdaten, Ausgabeort, Device-Profile sowie optionale Netzwerkparameter hinterlegt:

```json
{
  "credentials": {
    "username": "Your-UK-Number",
    "password": "Your-UK-Password"
  },
  "output": {
    "directory": "./downloads",
    "fileName": "ticket.html"
  },
  "browser": {
    "product": "firefox",
    "headless": true,
    "deviceProfile": "Desktop Chrome",
    "geolocation": null
  },
  "network": {
    "proxy": null
  }
}
```

- `browser.deviceProfile` akzeptiert die eingebauten Puppeteer/Chrome DevTools Presets (z. B. `Desktop Chrome`, `iPhone 12 Pro`, `Pixel 5`, `iPad Mini`, `Galaxy S9+`, `iPhone SE`).
- Proxy (`network.proxy`) und Geolocation (`browser.geolocation`) lassen sich auch über die CLI überschreiben (siehe unten).

## CLI-Parameter
`ticket-downloader.js` akzeptiert optionale Parameter:

- `--proxy <url>`: Aktiviert den Download über einen Proxy (http/https/socks4/socks5). Eingaben werden validiert.
- `--geolocation <lat,lon>`: Setzt eine Geolocation für die Browser-Session (Breiten-/Längengrad, jeweils dezimal). Werte werden auf gültige Bereiche geprüft.
- `--list-devices`: Gibt alle verfügbaren Device-Profile aus den eingebauten Puppeteer/Chrome DevTools Presets aus.

Die CLI-Werte überschreiben die Werte aus `db/config.json`.

## Verlauf & Metadaten
Jeder Lauf wird mit dem verwendeten Device-Profile sowie Proxy/Geolocation in `data/history.json` protokolliert. Zusätzlich wird neben der heruntergeladenen Datei eine Metadatei `<Dateiname>.meta.json` abgelegt.

## Ablauf
Das Download-Script einfach auf einem Linux-System mit nodejs, puppeteer und chromium-browser ablegen und per Cronjob immer am Ersten des Monats ausführen lassen.

Nicht vergessen die Felder `Your-UK-Number`, `Your-UK-Password` sowie Ausgabeort/Dateiname in `db/config.json` anzupassen!
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
