# Agent Hinweise
- CLI-Parameter (`--proxy`, `--geolocation`, `--list-devices`) und Gerätepreset-Namen müssen zwischen `ticket-downloader.js`, `db/config.json` und der README konsistent bleiben.
- Device-Profile stammen aus den eingebauten Puppeteer/Chrome DevTools Presets und werden in `src/deviceProfiles.js` gepflegt.
- Bei Änderungen an der Downloadlogik bitte die Protokollierung (Metadatei & `data/history.json`) beibehalten.
