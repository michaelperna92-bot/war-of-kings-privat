# Änderungen – War of Kings Probe-Spiel

## 4.0 (30.10.2026)
- **Eigener Spielserver** (`server/server.js`, ohne externe Pakete): private Räume, Einladungslink `?raum=CODE`,
  serverautoritative Züge (Server prüft jede Aktion mit der Engine), doppelte/veraltete Züge abgefangen,
  Wiederverbinden nach Abbruch, Räume räumen sich auf, ungültige Links melden sich.
- **Web-Version** `dist/web` wird vom Server ausgeliefert (HTTPS über den Hoster), inkl. Musik und Händler-Video.
- **Offizielle Karten**: Entwickler veröffentlicht ein Spielpaket auf dem Server, alle Spieler bekommen es angeboten.
- Fehler behoben: Online-Karten verloren bei doppelter Aufbereitung ihre Laufrichtungen (Server bekommt jetzt Originaldaten).
- Bereitstellung: `render.yaml` (Render.com, kostenlos), `package.json`, `CLAUDE.md`, Startanleitung in `README.md`.
- Pfade im Build und in Tests relativ (`ccpath.js`) – läuft im gemeinsamen Repository.

## 3.x
Siehe `LIESMICH.txt` im jeweiligen PC-Release (Online-Duell MQTT/Cloud, Starter-Set/Packs, Deck-Übersicht, Kontrolle sofort u. v. m.).
