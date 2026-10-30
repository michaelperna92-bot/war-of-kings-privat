# War of Kings

Strategie-Kartenspiel 1 gegen 1 mit eigener Kartenwerkstatt.

| Ordner | Inhalt |
|---|---|
| `spiel/` | Probe-Spiel: Engine, Oberfläche, KI, **Spielserver**, Windows-Hülle, Tests |
| `kartenwerkstatt/` | WoK-Kartenwerkstatt: Karten gestalten, Regeln prüfen, Spielpakete exportieren |

Regeln für die Weiterentwicklung (auch für Claude Code): **`CLAUDE.md`**.

## Starten (lokal)
Voraussetzung: Node.js ≥ 18. Keine Pakete installieren nötig.
```
cd spiel
node build.js            # baut alle Ausgaben des Spiels
node server/server.js    # Spielserver + Web-Version auf http://localhost:8080
```
Kartenwerkstatt: `cd kartenwerkstatt && node build.js` → `dist/kartenwerkstatt.html` im Browser öffnen.

## Ausgaben
| Ausgabe | Wie | Ergebnis |
|---|---|---|
| **Web (HTTPS)** | Render.com Blueprint (`render.yaml`) | `https://<name>.onrender.com` – Online-PvP mit Einladungslink |
| **Windows** | Go-Build (siehe `spiel/CLAUDE.md`, Abschnitt Release) | `spiel/release/WoK-Probe-Spiel-<v>.zip` mit Installer-EXE |
| **Browser-Datei** | `node build.js` | `spiel/dist/WoK-Probe-Spiel-Browser.html` (eine Datei, inkl. Musik/Video) |
| **Claude-Artefakt** | `spiel/dist/wok-spiel.html` veröffentlichen | Vorschau in der Claude-Cloud |

## Bereitstellung (einmalig, kostenlos)
1. Dieses Repository liegt auf GitHub.
2. render.com → „Sign in with GitHub“ → **New → Blueprint** → Repository wählen → **Apply**.
3. Nach ein paar Minuten: Adresse unter „war-of-kings“ kopieren (z. B. `https://war-of-kings.onrender.com`).
4. Adresse in `spiel/server-url.txt` eintragen und neu bauen → PC-Version und Browser-Datei verbinden sich damit.
5. Entwickler-Schlüssel für offizielle Karten: Render → war-of-kings → Environment → `WOK_ADMIN_KEY` (anzeigen).

Hinweis Gratis-Plan: Ohne Spieler schläft der Server nach ~15 Minuten ein; das erste Öffnen dauert dann bis zu einer Minute.
Räume liegen im Arbeitsspeicher – bei einem Neustart des Servers enden laufende Partien.

## Online spielen
Spieler A: Online-Duell → **Raum eröffnen & Link schicken**. Spieler B öffnet den Link im Browser → landet direkt im Raum → **Beitreten**.
In der PC-Version kann man statt des Links den 6-stelligen Code eingeben.

## Tests
```
cd spiel
node test/rules.js && node test/spells.js && node test/spells2.js
node test/srvproto.js      # KI gegen KI über den echten Server (Zauber, Konterphase, Wiederverbindung)
```
Browser-Tests (Playwright) siehe `spiel/CLAUDE.md`.

## Export / Karten ins Spiel
Kartenwerkstatt → „♛ Fürs Probe-Spiel“ → Spielpaket. Im Spiel „Spielpaket laden“ (Test) oder „⇪ Veröffentlichen“ (für alle Spieler, mit Schlüssel).
