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

## 4.5 (30.10.2026)
- **Neue Regel: einmaliger Starthandwechsel** (Festlegung des Entwicklers, Regelwerk Abschnitt 3). Vor dem ersten Zug entscheidet jeder Spieler unabhängig: „Hand behalten“ oder „Neue 5 Karten ziehen“. Beim Neuziehen kommen alle 5 Karten zurück in den eigenen Stapel, der komplett neu gemischt wird; die zweite Hand ist endgültig. Kein Kartenverlust, keine Energie, Münzwurf und erster Nachzug unverändert.
  - Engine: neue Phase `mulligan`, Aktion `{ type: 'mulligan', p, redraw }`, `W.actor`, `W.mulliganOpen`. Nur einmal pro Spieler, nur vor dem ersten Zug.
  - Online (Spielserver): beide entscheiden gleichzeitig; der Server nimmt jede Entscheidung genau einmal an (auch nach Verbindungsabbruch). Gleichzeitig gesendete Wünsche werden nach dem Abgleich automatisch neu geschickt.
  - KI tauscht nur anhand ihrer eigenen Hand (kein Held oder keine Karte mit höchstens 2 Energie – Werkstatt-Vorschlag).
  - Zu zweit an einem Gerät: Startspieler zuerst, dann Gerät übergeben. Mit Zuguhr: 60 s Bedenkzeit, danach „Hand behalten“ (Werkstatt-Vorschlag). Tutorial ohne Wechsel.
- **Handkarten-Schnellvorschau:** PC – Maus über eine Handkarte zeigt sofort das große Kartenbild oberhalb der Hand (feste Position, fängt keine Mausereignisse ab), wechselt beim Weiterfahren, verschwindet beim Verlassen. Handy/Tablet – Karte berühren und ohne Absetzen über die Hand streichen (bei vielen Karten rollt die Hand am Rand mit), die letzte Karte bleibt stehen, Tippen außerhalb schließt. Streichen löst keine Spielaktion aus. Doppelklick bzw. Gedrückthalten öffnet wie bisher die große Ansicht. Auch in der Starthand-Auswahl.
- **Schnellwirken:** Zauber und Flüche, die man gerade wirken kann, glühen auf der Hand (Zauber grün, Flüche violett, wie magisches Feuer). Ein Antippen öffnet die Wirkung direkt über dem Spielfeld – auf der Seite ohne Ziele –, dann nur noch Ziel antippen und „Verbindlich ausspielen“. Nochmal antippen oder „Abbrechen“ bricht ab. Nicht wirkbare Karten zeigen wie bisher die Begründung.
- **Fehler behoben – „Todesapperatur“ und ähnliche Karten:** Auslöser „bei einem gegnerischen Angriff“ mit gegnerischem Ziel hatte nie ein gültiges Ziel (die Engine erlaubte dort nur angegriffene eigene Helden), deshalb war der Fluch trotz Maschine auf dem Feld nicht wirkbar. Jetzt: eigenes Ziel = angegriffene eigene Helden, gegnerisches Ziel = angreifende gegnerische Helden (Werkstatt-Vorschlag nach dem Kartentext, in den offenen Punkten vermerkt). Werkstatt 12.8 beschreibt das als „angreifenden gegnerischen Helden“.
- **Online: Versionsprüfung.** Der Spielserver nimmt Partien nur mit derselben Spielversion an; ältere Versionen bekommen den Hinweis, die neue Version zu holen (statt in einer Partie mit anderen Regeln hängen zu bleiben).
- Tests: `test/starthand.js` (Engine), `test/srvstarthand.js` (Server, gleichzeitig, Wiederverbindung), `test/starthand-ui.js` (PC, zu zweit, Handy mit 10 Karten), `test/schnellwirken.js` (PC und Handy), `test/todesapperatur.js` (Originalkarten aus dem offiziellen Paket). Bestehende Tests auf die Starthand-Phase umgestellt.

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
