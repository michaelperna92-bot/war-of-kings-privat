# WoK-Kartenwerkstatt – Projektregeln

Die verbindlichen Regeln für **War of Kings und die Kartenwerkstatt** stehen in `../spiel/CLAUDE.md`
(lokal `/home/claude/wokgame/CLAUDE.md`) und gelten hier genauso. Kurzfassung:

1. Werkstatt und Spiel sind eigenständig, aber verbunden. Die Werkstatt ist die **Quelle** für `data.js`, `effects.js`,
   `render.js`, `assets.js` – das Spiel bettet sie beim Bauen ein. Nicht doppelt programmieren.
2. Jede relevante Veröffentlichung: Windows (PC-Installer), Web/Cloud (Artefakt) – und **immer eine neue Spielversion nachziehen**
   (31.10.2026), mit Probelauf der Werkstatt-Karten im Spiel (`spiel/test/probelauf.js`). GitHub erst nach OK des Entwicklers.
3. Bestehende Funktionen nicht verändern, nur ergänzen. Keine Bilder/Vorlagen/Karten verlieren.
4. Nichts als fertig melden, was nicht getestet ist. Builds reproduzierbar (`node build.js`, Go-Build mit festen Flags).
5. Änderungen dokumentieren (Commit + LIESMICH im Release).
6. Sprache mit dem Entwickler: Deutsch. Keine Regeln erfinden – Vorschläge kennzeichnen.

## Karten ins Spiel bringen (kontrollierte Veröffentlichung)
1. Bibliothek → Karten markieren → „🎁 Ins Starter-Set“ / „📦 In die Packs“ / „Nur Test“.
2. „♛ Fürs Probe-Spiel“ → Starter-Set, Pack-Karten oder alle Karten als Spielpaket exportieren.
3. Testen: im Spiel „Spielpaket laden“.
4. Für alle Spieler veröffentlichen: im Spiel (Web oder PC) „Kartensammlung → ⇪ Veröffentlichen“ mit dem Entwickler-Schlüssel
   (Server-Variable `WOK_ADMIN_KEY`) – oder die Datei als `spiel/server/data/offiziell.wokspiel` ins Repository legen.

## Release
Version in `desktop/main.go` und `desktop/app.manifest`, `node build.js`, Windows-Build wie im Spiel beschrieben,
ZIP mit LIESMICH, Artefakt veröffentlichen.
