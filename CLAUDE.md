# War of Kings – Projektregeln (dauerhaft)

Gilt für das Spiel (`spiel/`, lokal `wokgame/`) und die Kartenwerkstatt (`kartenwerkstatt/`, lokal `cc/`).
Sprache mit dem Entwickler: **Deutsch**.

## Verbindliche Regeln
1. **War of Kings** und die **WoK-Kartenwerkstatt** sind eigenständige, aber miteinander verbundene Anwendungen.
2. Beide werden aus einer gemeinsamen, wartbaren Architektur entwickelt: Die Werkstatt ist die Quelle für Stammdaten
   (`data.js`), Zauber/Fluch-Format (`effects.js`) und Kartenrenderer (`render.js`, `assets.js`); das Spiel bettet diese
   Dateien beim Bauen unverändert ein (`spiel/build.js`). Nichts davon wird im Spiel ein zweites Mal programmiert.
3. Bei jeder relevanten Veröffentlichung werden **alle Ausgaben** berücksichtigt:
   - Windows (PC-Installer `release/*.zip`),
   - Web (Spielserver + `dist/web`, über HTTPS),
   - Browser-Datei (`dist/WoK-Probe-Spiel-Browser.html`),
   - Claude-Artefakt (Cloud-Vorschau).
4. Bestehende Bilder, Animationen, Sounds, Spielregeln und Karten dürfen nicht unbeabsichtigt verloren gehen.
   Bestehende Werkstatt-Funktionen werden nicht verändert, nur ergänzt.
5. Multiplayer-Änderungen erfordern Synchronisierungs- und Regressionstests (`test/srvproto.js`, `test/onlinesrv.js`, `test/online*.js`).
6. Keine Funktion wird als fertig gemeldet, bevor sie tatsächlich getestet wurde. Lokale Tests werden als lokal benannt –
   nie „Online funktioniert“, wenn nur lokal geprüft.
7. Builds sind reproduzierbar: `node build.js` (Spiel) bzw. `node build.js` (Werkstatt), Windows-Build mit festen Go-Flags (unten).
8. Sämtliche Änderungen werden dokumentiert: Commit-Nachricht + `LIESMICH.txt` im Release + `CHANGELOG.md`.

## Weitere Festlegungen des Entwicklers
- Keine Regeln erfinden. Das Master-Regelwerk hat Vorrang; der Entwickler darf neue Regeln setzen.
  Vorschläge/Annahmen der Werkstatt als solche kennzeichnen (`ASSUMPTIONS` in `src/engine.js`).
- Keine kostenpflichtigen Dienste. Higgsfield nur für Medien.
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
4. ZIP mit `LIESMICH.txt` (CRLF) + EXE + Browser-Datei.
5. Tests (unten) laufen lassen.
6. Commit (Autor Michael Perna), Artefakt veröffentlichen, Server neu bereitstellen (Push auf GitHub → Render baut automatisch).

## Tests
```
node test/rules.js && node test/spells.js && node test/spells2.js   # Regeln/Engine
node test/srvproto.js        # Server-Protokoll: KI gegen KI über den Server, Zauber/Konter, Wiederverbindung
node test/onlinesrv.js       # 2 Browser-Sitzungen über Einladungslink gegen echten Server (Playwright)
node test/srvkarten.js       # offizielle Karten veröffentlichen/laden
node test/onlinenet.js       # Notfall-Weg MQTT (lokaler Test-Broker test/mqbroker.js)
```
UI-Tests brauchen den lokalen Testserver (Port 8765 → `dist/`).
