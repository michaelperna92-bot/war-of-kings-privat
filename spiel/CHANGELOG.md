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

## 4.4 (30.10.2026)
- **Neue Energieregel (Festlegung des Entwicklers):** Unverbrauchte Energie verfällt am Zugende nicht mehr. Sie bleibt für Konter in der gegnerischen Konterphase (Zauber, Flüche) und verfällt erst nach dessen Schadensberechnung bzw. am Ende seines Zuges. Zu Beginn des eigenen Zuges wird wie bisher aufgefüllt – kein Ansparen. Gilt lokal, gegen die KI und online (Server). Die bisherige Testoption entfällt. Die Energieanzeige zeigt die aufgehobene Energie auch im gegnerischen Zug.
- **Neue Königsregel (Festlegung des Entwicklers):** Könige haben 8.000–12.000 HP. Ältere Karten werden beim Laden umgerechnet: Grabeskönig Vorhaltar → 10.000; andere Könige anteilig aus dem alten Bereich 10.000–20.000 (Werkstatt-Vorschlag). Offizielles Kartenpaket auf dem Server aktualisiert (König 10.000 HP). Demo- und Tutorial-Könige angepasst.
- Regelwerk-Text (Abschnitte 4 und 5) entsprechend ergänzt. Neuer Test `test/energiereserve.js`.
- Kartenwerkstatt 12.7: Königs-HP 8.000–12.000 (Editor, Zufallsgenerator, KI-Modus, Power-Scaling 3.6), bestehende Könige in der Bibliothek werden automatisch umgerechnet.

## 4.3 (30.10.2026)
- **Neue Gabenregel:** Aktivierbare Heldengaben gehen in der eigenen Battlephase **und** in der eigenen Konterphase (0 Energie, Abklingzeiten unverändert, unwiderruflich). Die Konterphase bleibt einmalig. Sie wird jetzt auch angeboten, wenn der Verteidiger nur eine einsetzbare Gabe hat.
- **Taktische Spielhilfe für Gaben:** Vor jeder Aktivierung rechnet das Spiel die Wirkung mit der echten Engine durch (geplante und mögliche Angriffe, nächster gegnerischer Angriff, Schutz, laufende Flüche). Hinweis bei sinnvollen Gaben, Rückfrage bei voraussichtlich wirkungslosen oder nachteiligen – nichts wird verboten oder automatisch ausgelöst. Abschaltbar über „Spielhilfe“.
- KI setzt in ihrer Konterphase eine Gabe ein, wenn sie einen festgelegten Angriff zu ihren Gunsten verändert.
- Kartenwerkstatt 12.6: Gabentexte angepasst.
- Online: Abgleich nach Abbrüchen schickt keine Kartenbilder mehr mit und wird entprellt – vorher konnten sich bei vielen Abgleichen bis zu 12 MB pro Nachricht stauen, Züge kamen dann verspätet an.
