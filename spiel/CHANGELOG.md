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

## 4.3 (30.10.2026)
- **Neue Gabenregel:** Aktivierbare Heldengaben gehen in der eigenen Battlephase **und** in der eigenen Konterphase (0 Energie, Abklingzeiten unverändert, unwiderruflich). Die Konterphase bleibt einmalig. Sie wird jetzt auch angeboten, wenn der Verteidiger nur eine einsetzbare Gabe hat.
- **Taktische Spielhilfe für Gaben:** Vor jeder Aktivierung rechnet das Spiel die Wirkung mit der echten Engine durch (geplante und mögliche Angriffe, nächster gegnerischer Angriff, Schutz, laufende Flüche). Hinweis bei sinnvollen Gaben, Rückfrage bei voraussichtlich wirkungslosen oder nachteiligen – nichts wird verboten oder automatisch ausgelöst. Abschaltbar über „Spielhilfe“.
- KI setzt in ihrer Konterphase eine Gabe ein, wenn sie einen festgelegten Angriff zu ihren Gunsten verändert.
- Kartenwerkstatt 12.6: Gabentexte angepasst.
- Online: Abgleich nach Abbrüchen schickt keine Kartenbilder mehr mit und wird entprellt – vorher konnten sich bei vielen Abgleichen bis zu 12 MB pro Nachricht stauen, Züge kamen dann verspätet an.
