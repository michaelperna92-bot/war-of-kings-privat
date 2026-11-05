# War of Kings – Projektregeln (dauerhaft)

Gilt für das Spiel (`spiel/`, lokal `wokgame/`) und die Kartenwerkstatt (`kartenwerkstatt/`, lokal `cc/`).
Sprache mit dem Entwickler: **Deutsch**.

## Verbindliche Regeln
1. **War of Kings** und die **WoK-Kartenwerkstatt** sind eigenständige, aber miteinander verbundene Anwendungen.
2. Beide werden aus einer gemeinsamen, wartbaren Architektur entwickelt: Die Werkstatt ist die Quelle für Stammdaten
   (`data.js`), Zauber/Fluch-Format (`effects.js`) und Kartenrenderer (`render.js`, `assets.js`); das Spiel bettet diese
   Dateien beim Bauen unverändert ein (`spiel/build.js`). Nichts davon wird im Spiel ein zweites Mal programmiert.
3. Bei jeder relevanten Veröffentlichung werden **alle Ausgaben** berücksichtigt:
   - Windows (PC-Installer `release/WoK-Probe-Spiel-Setup.exe`, seit 5.11.2026 ohne ZIP),
   - Web (Spielserver + `dist/web`, über HTTPS),
   - Browser-Datei (`dist/WoK-Probe-Spiel-Browser.html`) – wird weiter gebaut, aber **nicht mehr ausgeliefert** (Entwickler, 31.10.2026: „brauche ich nicht mehr“),
   - Claude-Artefakt (Cloud-Vorschau).
4. Bestehende Bilder, Animationen, Sounds, Spielregeln und Karten dürfen nicht unbeabsichtigt verloren gehen.
   Bestehende Werkstatt-Funktionen werden nicht verändert, nur ergänzt.
5. Multiplayer-Änderungen erfordern Synchronisierungs- und Regressionstests (`test/srvproto.js`, `test/onlinesrv.js`, `test/online*.js`).
6. Keine Funktion wird als fertig gemeldet, bevor sie tatsächlich getestet wurde. Lokale Tests werden als lokal benannt –
   nie „Online funktioniert“, wenn nur lokal geprüft.
7. Builds sind reproduzierbar: `node build.js` (Spiel) bzw. `node build.js` (Werkstatt), Windows-Build mit festen Go-Flags (unten).
8. Sämtliche Änderungen werden dokumentiert: Commit-Nachricht + `LIESMICH.txt` im Release + `CHANGELOG.md`.

## Weitere Festlegungen des Entwicklers
- **Veröffentlichung in zwei Schritten (31.10.2026):** Zuerst Artefakt (plus PC-Zip zum Testen) an den Entwickler.
  **GitHub/Spielserver erst nach seinem OK** – vorher kein Push.
- **Werkstatt und Spiel bleiben abgestimmt:** Jede Werkstatt-Version (z. B. geänderte oder neue Effekte) zieht automatisch
  eine neue Spielversion nach. Vor jeder Version läuft der Probelauf (`test/probelauf.js` und `WOK_PROBE=… node test/srvproto.js`):
  Werkstatt-Zufallskarten werden im Spiel geladen, gewirkt und in KI-Partien gespielt – veröffentlicht wird nur fehlerfrei.
  Karten mit neueren Wirkungen tragen eine höhere Formatversion (`EF.needVersion`); ältere Spiele zeigen „braucht neuere Spielversion“.
- Werkstatt-Texte einfach und verständlich halten.
- Keine Regeln erfinden. Das Master-Regelwerk hat Vorrang; der Entwickler darf neue Regeln setzen.
  Vorschläge/Annahmen der Werkstatt als solche kennzeichnen (`ASSUMPTIONS` in `src/engine.js`).
- Kostenpflichtiges ist seit 5.11.2026 erlaubt (Entwickler, Budget ca. 400–500 €): Unity-Asset-Store-Pakete, UI-Designer,
  später Apple Developer Program und Server-Tarif. Vor jedem Kauf Empfehlung + Prüfung, ob es passt. Higgsfield nur für Medien,
  und nur, wenn die Datei zu Claude kommen kann (Entwickler lädt herunter und schickt sie).
- **Weg zum Profispiel (5.11.2026):** Neue Oberfläche in **Unity 6 (LTS)** auf dem PC des Entwicklers; Regel-Engine `engine.js`
  läuft dort über Jint weiter (eine Quelle), Werkstatt/Server/Kartendaten bleiben. Schritt für Schritt in Meilensteinen,
  sparsam mit Tokens: je Meilenstein ein Durchgang, Rückmeldungen gesammelt. App-Store-Version erst, wenn es wie ein Profispiel aussieht.
  Die Web-/PC-Version bleibt Testversion (Regeln, Balance, Online).
- **Kickstarter-Plan (5.11.2026):** Vorläufig mit den bisherigen Designs (KI-generierte Kartenbilder/-layouts, Spielfeld, Thronhalle).
  Ziel: Spiel läuft gut, starke Effekte → Kickstarter → davon echte Art-Designer, die jede Karte einzeln zeichnen.
  Darum zuerst ein vorzeigbarer Duell-Ausschnitt in Unity (für Trailer/Demo); Designer-Budget erst nach Kickstarter.
- Deckbau findet im Spiel statt. Sind eigene Karten geladen, erscheinen nur diese.
- Pack-Garantie (Pity) bleibt für Spieler unsichtbar.

## Aufbau
| Teil | Ort | Zweck |
|---|---|---|
| Engine (deterministisch) | `src/engine.js` | `apply(state, action)` – läuft im Client **und** auf dem Server |
| Spieloberfläche | `src/app.js`, `src/body.html`, `src/style.css` | eine Codebasis für alle Ausgaben |
| KI | `src/ai.js`, `src/advisor.js`, `src/deckbuilder.js` | |
| Spielserver | `server/server.js` | Node ≥ 18, **keine externen Pakete**; Räume, Einladungslinks, serverautoritative Züge, offizielle Karten |
| Windows-Hülle | `desktop/` (Go) | Installer-EXE, startet Edge/Chrome im App-Modus mit eingebautem lokalem Server |
| Build | `build.js` | erzeugt `dist/wok-spiel.html` (Artefakt), `dist/web/` (Server), `dist/WoK-Probe-Spiel-Browser.html`, `desktop/app/index.html` |

## Online-Spiel
- Hauptweg: **Spielserver** (`server/server.js`). Der Server prüft jede Aktion mit derselben Engine, nummeriert sie und verteilt sie.
  Clients wenden Züge erst nach Bestätigung an → keine abweichenden Zustände, keine illegalen Züge.
- Einladungslink: `https://<server>/?raum=CODE`. Wiederverbinden per Spieler-ID (`localStorage wok-spiel-netid`).
- Server-Adresse für PC-Version und Browser-Datei: Datei `server-url.txt` (eine Zeile, z. B. `https://war-of-kings.onrender.com`), dann neu bauen.
- Notfall-Weg ohne Server: öffentliche MQTT-Server (nur PC/Browser-Datei). Claude-Cloud: nur mit eingeladenem Konto (Artefakte blocken Außenverbindungen).
- Bekannte Grenze: Clients kennen den vollständigen Zustand (auch gegnerische Hand) – für Alpha-Tests akzeptiert.

## Release-Routine
1. Version erhöhen: `const VERSION` in `src/app.js`, `appVersion` in `desktop/main.go`, `version` in `desktop/app.manifest` (Werkstatt: `desktop/main.go` + `app.manifest`).
2. `node build.js`
3. Windows: `cd tools/mkrsrc && WOK_VERSION=X go run . ../../desktop/app/icon.ico ../../desktop/app.manifest ../../desktop/rsrc_windows_amd64.syso`
   dann `cd desktop && GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w -H windowsgui" -o ../release/WoK-Probe-Spiel-Setup.exe .`
4. **Keine ZIP mehr** (Entwickler, 5.11.2026): dem Entwickler nur die EXE geben; `LIESMICH.txt` (CRLF) und `LIZENZEN.txt` bleiben im Repo/Release-Ordner.
5. Tests (unten) laufen lassen.
6. Commit (Autor Michael Perna), Artefakt veröffentlichen und dem Entwickler geben. **Erst nach seinem OK:** Push auf GitHub → Render baut automatisch.

## Tests
```
node test/rules.js && node test/spells.js && node test/spells2.js   # Regeln/Engine
node test/srvproto.js        # Server-Protokoll: KI gegen KI über den Server, Zauber/Konter, Wiederverbindung
node test/onlinesrv.js       # 2 Browser-Sitzungen über Einladungslink gegen echten Server (Playwright)
node test/srvkarten.js       # offizielle Karten veröffentlichen/laden
node test/onlinenet.js       # Notfall-Weg MQTT (lokaler Test-Broker test/mqbroker.js)
node test/probelauf.js       # Probelauf: Werkstatt-Zufallskarten im Spiel (laden, wirken, KI-Partien)
WOK_PROBE=3 node test/srvproto.js   # Probelauf über den Spielserver
node test/perf.js nachher    # Flüssigkeit messen (Handy-Simulation)
```
UI-Tests brauchen den lokalen Testserver (Port 8765 → `dist/`).
