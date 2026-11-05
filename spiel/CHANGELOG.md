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

## 4.21 (5.11.2026) – Königsbild in der Spielerleiste
- Die Spielerleisten zeigen statt des Profilbilds das **Bild des Königs** auf dem Feld (Idee des Entwicklers); die Lebenspunkte stehen nur noch dort. Die Königskarte auf dem Feld trägt keine Zahl mehr (2D und 3D). Ohne Königsbild bleibt das Profilbild.

## 4.20 (5.11.2026) – Handy: Kamera denkt mit, größere Felder, König-Treffer sichtbar
- **Kamera denkt mit:** Beim Beschwören, in der eigenen Konterphase und beim Zaubern ist die Hand da und man sieht das ganze Feld. In Bewegung und Battlephase (ohne spielbaren Zauber/Fluch) gleitet die Hand weg und die Kamera fährt weich näher ans Feld – **Felder ca. 65 % größer** (Test: 33×27 → 55×48 Punkte), leichter zu treffen. Knopf „▲ Hand“ holt die Hand jederzeit zurück.
- **Kasten oben leichter:** halb durchsichtig, großes ✕ (beim Zaubern = Abbrechen). Tippen aufs Spielfeld schließt ihn und spielt direkt weiter.
- **König getroffen:** Der verlorene Teil der Lebensleiste leuchtet rot und läuft langsam ab, große Schadenszahl an der Leiste, Leiste zuckt; bei eigenem König kurzer roter Bildschirmrand.

## 4.19 (5.11.2026) – Angriff jederzeit zurücknehmen
- Fehler behoben (Handy): War ein Angreifer angetippt, verdeckte der Kasten oben die Angriffsliste – das ✕ zum Zurücknehmen war nicht erreichbar. Jetzt stehen die festgelegten Angriffe mit ✕ auch im Kasten. Zurücknehmen geht immer auf drei Wegen: Ziel nochmal antippen, ✕ in der Angriffsliste, oder (vor dem Festlegen) Angreifer nochmal antippen = abwählen. Test: `angriff-zurueck.js` (Handy 3D + PC).

## 4.18 (5.11.2026) – Gaben blockieren nichts mehr, Spielhilfe nur auf Wunsch
- **Fehler behoben:** Ein Held, der eine Gabe hätte nutzen können, zeigte einen Gaben-Knopf direkt auf dem Spielfeld – der lag über dem Angriffsziel, man kam nicht dran vorbei. Jetzt liegen **nie Knöpfe auf dem Spielfeld**. Handy: Gaben-Knöpfe im Kasten oben (1. Tipp: Beschreibung + Ziele leuchten, 2. Tipp: einsetzen); PC: wie bisher in der Leiste. Gaben sind freiwillig – angreifen geht direkt. Tests: `angriff-trotz-gabe.js`, `effekt-knoepfe.js`.
- **Spielhilfe nur noch auf Wunsch (💡):** Kein Fenster mehr beim Weiter-Knopf („Du hättest noch …“, „Ohne Angriff abschließen?“), keine Warnung vor einer Gabe, kein Hinweis nach dem Angriff, keine Meldung „Kartenbilder … gezeichnet“. Geblieben ist nur die Warnung vor der letzten Karte (sofortige Niederlage).

## 4.17 (5.11.2026) – Handy: Spielfeld bleibt beim Wirken und bei Gaben frei
- **Fehler behoben: Zauber nach „Abbrechen“ nicht mehr wirkbar.** Abbrechen ließ die Karte ausgewählt; der nächste Tipp schaltete die Info aus statt an, „Wirken“ war weg. Jetzt löst Abbrechen alles. Test: `ABORT=1 node test/zauber-ui-fuzz.js` (Abbrechen + erneut wirken).
- **Handy-Bühne:** Karten-Info, Zauber-Fenster und Gaben-Beschreibung stehen in einem kompakten Kasten **oben über der Thronhalle** – nie über dem Spielfeld; Ziele bleiben antippbar. Die Leisten bleiben immer Spielerleisten. Zauber-Fenster gekürzt (Titel, 2 Zeilen Text, Knöpfe).
- Gaben-Knopf an der Karte am Handy klein („Tippen = einsetzen“), Beschreibung oben im Kasten.
- Angriffsliste schwebt oben unter der Gegnerleiste, Spielhilfe als kleiner 💡-Knopf – der Kasten unten bleibt gleich hoch und schiebt nichts mehr über das Feld.
- Zauber-Probelauf jetzt auch im 3D-Handy-Modus (`DEV=handy3d`): alle Ziele auf der Leinwand frei antippbar.

## 4.16 (5.11.2026) – Thronhalle, Kartenrückseite, Ziehen, feste Handy-Kamera
- **Thronhalle als Hintergrund** (Video vom Entwickler, Higgsfield): Feuerschalen, Glut, Nebel, Banner – hinter dem 3D-Spielfeld, unverzerrt, leicht abgedunkelt. Verkleinert von 15 MB auf 1,1 MB (`assets/arena/arena.mp4`), Standbild `arena.webp` sofort und als Ersatz, wenn das Handy Videos blockiert.
- **Kartenrückseite** (Bild vom Entwickler, `assets/rueckseite/`): für die gegnerische Hand, die große Kartenansicht und das Ziehen. Die gewählte Rückseiten-Farbe bleibt als Tönung erhalten.
- **Ziehen-Animation:** Der Stapel gleitet kurz am Rand herein, die oberste Karte hebt sich, dreht sich um und fliegt in die Hand; danach gleitet der Stapel hinaus (Gegner: verdeckt, zu seiner Leiste). Kein dauerhafter Stapel auf dem Feld (Wunsch des Entwicklers). Aus bei „Effekte: aus“.
- **Handy: Kamera fest** – kein Springen mehr zwischen zwei Ansichten; nahe Ansicht, Feld etwas höher, damit die eigene Königsreihe frei bleibt.

## 4.15 (5.11.2026) – Karten-Info auf dem Feld (Handy)
- Fehler behoben: Auf manchen Handys (Safari meldet beim Antippen keinen Finger-Typ) zeigte das Antippen einer Feldkarte keine Karten-Info – man musste die große Ansicht öffnen. Jetzt erscheint die Info wie bei Handkarten (Laufen, Angriff, Werte, Gaben). Test in `3d-handy.js`.

## 4.14 (5.11.2026) – fünf Wünsche des Entwicklers
- **Eigene und gegnerische Karten klar unterscheidbar:** Gegnerkarten stehen auf dem Kopf (zeigen zu ihrem Besitzer). Eigene Karten blau-silbern (wie die blauen Banner unten), Gegner dunkelrot (rote Banner oben): Sockel, leuchtender Rahmen, Wappen-Siegel mit Krone, Werte-Schild in Seitenfarbe. Gold/Rot ging im Feuerlicht unter. Karten im echten Format 2:3 (vorher gestaucht) und leicht zur Kamera aufgestellt.
- **Battlephase übersichtlich:** festgelegte Angriffe als leuchtende 3D-Bögen mit Spitze (laufendes Licht), Nummer = Reihenfolge, Fadenkreuz am Ziel, Ausgang groß über dem Ziel (BESIEGT / FÄLLT SELBST / BEIDE FALLEN / −Schaden am König). Beim Zielen steht der Ausgang an jedem möglichen Ziel. Angreifer leuchten. Angriffsliste im Phasenfeld (Handy: unten) mit ✕ zum Zurücknehmen. Gegnerische Angriffe in der Konterphase genauso (dunkelrot).
- **Effekte mit zwei Tipps direkt an der Karte:** Karte antippen → Knopf je JETZT einsetzbarer Gabe (Name + CT). 1. Tipp: ein Satz, was sie bewirkt, Ziele leuchten. 2. Tipp: wirkt (ein Ziel → sofort, sonst Ziel antippen). Karten mit einsetzbarer Gabe tragen ein pulsierendes ⚡.
- **Handy: Feld bis an die Ränder:** Spielfeld füllt die ganze Breite (Zierrand darf aus dem Bild), Leisten, Hand und Knöpfe schweben darüber. Karten-Info (Laufen, Angriff, Werte, Gaben) erscheint beim Antippen einer Karte – Hand oder Feld, eigene und gegnerische – und verschwindet wieder.
- PC: Hinweis-Kasten links nur noch, wenn er etwas zeigt.
- Tests: `effekt-knoepfe.js` (PC + Handy).

## 4.13 (5.11.2026) – Handy-Fehler behoben, neue Beschwörungs- und Kampfeffekte
- **Fehler behoben (Handy, 3D):** Nach dem Antippen einer Handkarte wählte der Tipp ins 3D-Feld die Karte wieder ab – Beschwören ging nicht. Jetzt: Karte antippen → goldenes Feld antippen → beschwört. Test `3d-handy.js` (iPhone + Android: Beschwören und Laufen per Fingertipp).
- **Beschwören** statt gelbem Kreis: Runenkreis leuchtet auf und dreht sich, Lichtsäule, Karte fällt hinein, beim Aufprall Staubwolke, weiche Druckwelle, Funken, Lichtblitz, Wackeln. Werte erscheinen erst nach der Landung.
- **Zerstören:** Karte zittert, zerspringt in Splitter mit ihrem Bild, dunkler Rauch und rote Glut.
- **Treffer im Kampf:** Funkenregen, Druckwelle und Lichtblitz am Ziel.
- Ab jetzt keine ZIP mehr – PC-Version nur als EXE (Entwickler, 5.11.2026).

## 4.12 (4.11.2026) – PC/TV-Bühne wie bei Master Duel, echtes Feuer
- **PC/TV-Bühne** (Aufbau nach Yu-Gi-Oh! Master Duel): Der ganze Bildschirm ist die Szene, keine Webseiten-Seitenleiste mehr. 3D-Spielfeld groß in der Mitte; **Hand als Fächer** unten (Karte hebt sich beim Drüberfahren); **Lebenspunkte groß** mit Porträt – Gegner oben rechts, du unten links; **Phasenfeld** rechts; **Kartendetails links** groß mit Kartenbild, sobald die Maus über eine Karte (Hand oder Feld) fährt; Spielverlauf über 📜. Handy bleibt wie bisher.
- **Echtes Feuer:** Die vier Feuerschalen des Spielfelds brennen mit live berechneten Flammen (Shader), dazu aufsteigende Glut und Funken über dem Feld. Steinboden der Halle rund ums Feld.
- **Arena-Hintergrund vorbereitet:** `assets/arena/arena.mp4` (Video, Schleife) und/oder `arena.webp` werden beim Bauen eingebunden und unverzerrt hinter das Spielfeld gelegt; ohne Datei bleibt der Steinboden.
- Kamera passt das Feld in den freien Bereich zwischen Leisten, Hand und Seitenfeldern ein.
- Tests: `duell-buehne.js` (Bühne an am PC, aus am Handy, Fächer, Details links, Beschwören über 3D, Spielverlauf, nichts ragt heraus), `3d-felder.js`.

## 4.11 (4.11.2026) – 3D-Spielfeld und Vollbild
- **3D-Spielfeld (Prototyp):** Das Spielfeld liegt schräg im Raum, Karten sind flache 3D-Objekte mit Schatten, Fackeln flackern, Nachleuchten (Bloom). Beschwören: Karte fällt aufs Feld mit Staubring und Wackler. Laufen: Karte springt im Bogen. Angriff: Ausfallschritt mit Lichtblitz. Zerstören: Karte fliegt hoch und verblasst. Bedienung wie bisher (antippen, gedrückt halten bzw. Doppelklick = große Ansicht). Am PC nutzt das Feld jetzt die ganze Breite neben der Seitenleiste. An/aus im Menü „🧊 3D-Ansicht“; Tutorial und Wiederholung bleiben 2D. Code: `src/board3d.js`; Bibliotheken eingebaut (`assets/3d`, gebaut mit `tools/3d/build-3d.sh`).
- **Vollbild am PC:** Knopf ⛶ neben der Phasenanzeige, Taste **F** oder Menü „⛶ Vollbild“. PC-Fenster startet maximiert.
- Bibliotheken: three.js r169 (MIT), GSAP 3.13 (kostenlos, auch kommerziell) – siehe `LIZENZEN.txt`.
- Tests: `3d-felder.js` (alle 30 Felder per Klick auf die 3D-Ansicht in drei Fenstergrößen getroffen, keine Seitenfehler).

## 4.10 (4.11.2026) – Deinstallieren
- **Deinstallieren** für Probe-Spiel und Kartenwerkstatt (12.10): Startmenü-Ordner „War of Kings“ mit „… deinstallieren“ (zusätzlich wie bisher Windows-Einstellungen → Apps). Entfernt Programm, Verknüpfungen, Apps-Eintrag und Zwischenspeicher. Auf Wunsch auch alle eigenen Daten (Dokumente-Ordner) – mit zweiter Sicherheitsabfrage. Der gemeinsame Ordner „War of Kings Spielpakete“ wird nur gelöscht, wenn das andere Programm nicht mehr installiert ist. Code: `desktop/uninst_windows.go` (in beiden Programmen gleich).

## 4.9 (1.11.2026) – neues Spielfeld mit 6 Reihen
- **Neues Spielfeld** (Festlegung des Entwicklers, Regelwerk Abschnitt 2): König mit Wachen, Beschwörungsreihe (7), **zwei Mittelreihen (je 5, B–F)**, Beschwörungsreihe (7), König mit Wachen. Jede Seite hat drei Reihen. Neues, scharfes Bild (3700 × 3700, hochskaliert), quadratisch; Felder automatisch im Bild erkannt (`assets/spielfeld/layout.json`). Altes 5-Reihen-Feld in `assets/spielfeld/original-5-reihen/`.
- Engine: `LAYOUTS[6]` ist Standard; 5 und 7 bleiben für Tests verfügbar. Spielstände vom 5-Reihen-Feld werden mit Hinweis verworfen.
- KI-Simulation (300 Partien): 0 Fehler, im Schnitt 69,5 Züge (5 Reihen: 62,9).
- Fehler behoben (Handy): Gedrückthalten öffnete die große Kartenansicht, das Loslassen tippte dort sofort „Zurück“ an.
- Tests: `feld6.js`; UI-Tests auf die neuen Felder umgestellt. Tutorial: Gaben-Hinweis zeigt auf die Gaben-Knöpfe in der Spielerleiste.

## 4.8 (1.11.2026) – Optik und Spielfluss
- **Konter ohne Möglichkeiten wird übersprungen:** Hat der Verteidiger keine Energie für Zauber/Flüche und keine einsetzbare Heldengabe, entfällt die Konterphase (Hinweis „Kein Konter möglich“); mit einsetzbarer Gabe läuft sie. Im eigenen Zug laufen alle Phasen wie bisher (die kurz eingebaute Abkürzung „Zug beenden“ ist auf Wunsch des Entwicklers wieder entfernt). Tests: `konter-skip.js`, `zugende.js`.
- **Effekte mit eigenen Bildern** (`assets/fx`, aufbereitet mit `tools/fx/build-fx.py`): Staubring beim Beschwören, Schwerthieb + Funken im Kampf, Splitter beim Zerstören, Funken + wackelnde Leiste bei König-Schaden, Element-Effekt beim Zaubern (Feuer, Wasser, Erde, Wind, Blitz, Licht, Dunkelheit), Leuchten bei Gaben. Laufen parallel, blockieren nichts.
- **Phasenband** über dem Spielfeld (DEINE BATTLEPHASE, KONTERPHASE, EFFEKTE WERDEN AUFGELÖST, GEGNER AM ZUG) – blockiert nichts.
- **Energie-Kristalle** und **Königsrahmen** am Porträt. (Farbige Seltenheits-Rahmen und Folienschimmer wieder entfernt – Entwickler: „sehen billig aus“.)
- **Lebendes Spielfeld:** Fackellicht flackert, Staub schwebt, warmes Licht auf deiner Seite in deinem Zug, blaues im Konter.
- **Sieg- und Niederlage-Bildschirm** mit eigenen Hintergründen.
- **Tempo:** Zauber-, Legendär- und Ketten-Einblendungen kürzer (1,0 s statt 1,4 s) und blockieren nicht mehr.
- Menü ☰ → „✨ Effekte: voll / wenig / aus“.
- Permanente Gaben zeigen **∞** statt „permanent“ (Werte-Leiste, Kartendetails, Regeln).

## 4.7 (31.10.2026) – Handy ohne Scrollen, „Du bist dran“, Spielfeld 5 Reihen
- **Spielfeld mit 5 Reihen** (Festlegung des Entwicklers, Regelwerk Abschnitt 2): Reihen 3 und 5 entfernt. Engine `LAYOUTS`/`setLayout(n)` (5 Standard, 7 für alte Tests), `s.rows` im Zustand; Partien vom 7-Reihen-Feld werden abgewiesen. Neues Spielfeldbild (`assets/spielfeld/battlefield.webp`, Original in `original-7-reihen/`). Alte Spielstände/Wiederholungen werden mit Hinweis verworfen.
- **Handy ohne Scrollen:** feste Leiste unter der Hand mit Hauptknopf, 📜 (Spielverlauf + Hinweise) und ☰ (Menü); kompakte Spielerleisten.
- **„Du bist dran“:** Einblendung, Ton, Vibration, Sprung zum Spielfeld, Leuchten; eigene KONTER-Anzeige.
- **Kartenwerte in der Spielerleiste (Handy):** Handkarte/Held antippen → Werte und „Wirken“ in der Leiste; daneben tippen → König-Leben und Energie. PC unverändert mit Aufploppen.
- **Stabilität – Zauber hängen nicht mehr:**
  - Ursache des gemeldeten Hängers: Am Handy lag das Wirk-Fenster über dem Spielfeld und verdeckte die Ziele (z. B. eigene Helden im Konter). Jetzt steht das Wirk-Panel in der eigenen Spielerleiste, das Spielfeld bleibt frei.
  - Feld-Ziele: Ein Held auf dem Zielfeld kann direkt angetippt werden.
  - Wiederbeleben mit mehreren Helden: Auswahl geht automatisch weiter, je Held ein Feld, dann „Bist du sicher?“. Ohne freies Feld keine Feldwahl mehr.
  - Handlimit-Fenster: bleibt bei Fehlschlag offen; Hauptknopf „Handlimit: Karte ablegen“ öffnet es wieder (auch nach Online-Abgleich).
  - Zuguhr: passt in der Konterphase automatisch; beendet eine laufende Vorschau sauber. Veraltete Fenster handeln nicht mehr für den Gegner.
  - Online: „Idee übernehmen“-Warteschlange wird bei Ablehnung/Zugwechsel/Abgleich geleert.
  - KI: Ausnahmen werden abgefangen, regelkonforme Ersatzaktion (Passen/Phase beenden); Wächter stößt eine stehengebliebene KI neu an, hängende Einblendungen werden nach 12 s beendet; Zeichenfehler stoppen den Ablauf nicht mehr.
  - **Fehlerprotokoll** (Menü ☰ → 🧾): Ausnahmen und Notfall-Eingriffe mit Zeit, Version und Phase, zum Kopieren.
  - Tests: `zauber-ui-fuzz.js` (Werkstatt-Zauber über die echte Oberfläche auf Handy und PC, jedes Ziel an der sichtbaren Stelle angetippt), `stabil.js`, `waechter.js`.
- **PC: Partie füllt den Bildschirm:** Spielfeld richtet sich nach der Fensterhöhe (z. B. 1920×1080: 915 statt 760 px breit), Spielerleisten und Hand so breit wie das Feld, größere Handkarten, Seitenleiste rechts. Fehler behoben: Lebensanzeige am PC lag über dem Spielernamen (Klassenname `hp` doppelt belegt).
- **Angriff wieder abwählen:** festgelegtes Ziel nochmal antippen oder eigenen Helden antippen → „↩ Angriff auf … zurücknehmen“ in der Leiste (Handy und PC), bis die Battlephase abgeschlossen ist.
- **Gaben in der Spielerleiste:** eigenen Helden antippen → seine Gaben stehen als Knöpfe in der Leiste (Handy und PC); das Kästchen auf dem Spielfeld entfällt, Angriffsziele bleiben frei.
- Fehler behoben: Angriffspfeile lagen auf dem 5-Reihen-Feld zu weit unten (Pfeil-Ebene war quadratisch) und sahen aus, als griffe der König an.
- **Spielhilfe „Idee übernehmen“:** Vorschlag (gleiche Logik wie die KI) als Vorschau, erst „Bestätigen“ führt aus, „Abbrechen“ stellt alles wieder her; „Nein, weiter“; ✕/daneben tippen schließt. Online nacheinander nach Server-Bestätigung.
- Tests: `feld5.js`, `handy-layout.js`, `zug-ui.js`, `idee.js`, `pfeil-gaben.js` (inkl. Abwählen); bestehende Tests auf 5 Reihen umgestellt (Regeltests laufen weiter auf 7 Reihen).

## 4.6 (31.10.2026) – großes Update Zauber/Flüche, Handkarten, Flüssigkeit
- **Zerstörungsflüche im Konter: Abwehren oder Durchgehen** (Festlegung des Entwicklers). Die Karte nennt es im Text. Abwehren: Zerstörung vor dem Kampf, der Angreifer greift nicht an. Durchgehen: normaler Kampf, danach wird der Angreifer trotzdem zerstört. Ohne Angabe: abwehren.
- **Kontrolle übernehmen und Wiederbeleben:** In der eigenen Battlephase wirken sie sofort, der Held greift noch in derselben Battlephase an (steht immer auf der Karte). Je Karte einstellbar: vorher einmal laufen (nach eigener Laufrichtung und Schrittzahl).
- **Wiederbeleben-Ablauf:** Auswahl aus dem Ablagestapel als Kartenbilder → automatisch zurück zum Spielfeld → freie Beschwörungs- und Wachfelder leuchten → Feld antippen → „Bist du sicher?“. Keine Feldnamen wie „B6“ mehr; auch Ziele und Felder anderer Zauber wählt man direkt auf dem Brett.
- **Handkarten neu:** normal große Karten im echten Design; Wischen blättert die Hand flüssig (natives Scrollen). Maus darüber (PC) bzw. einmal antippen (Handy) → Werte ploppen an der Karte auf (Energie, ATK/DEF, Lauf- und Angriffsrichtung, Gaben, Wirkungstext, Knopf „Wirken“). Nochmal tippen oder daneben tippen schließt. Doppelklick/Doppeltipp oder Gedrückthalten = ganze Karte. Auch Helden auf dem Brett zeigen beim Antippen ihre Werte. Ersetzt die große Handy-Vorschau aus 4.5.
- **Flüssigkeit:** Hand nur noch neu zeichnen, wenn sich etwas ändert; kleine Vorschaubilder für die Hand; Glühen ohne teure Schatten-Animation; zügigere Einblendungen (VS, Ketten, Zauber) und KI-Pausen; kürzere Animation der großen Ansicht. Messung (Handy-Simulation, CPU 4× gedrosselt, `test/perf.js`): Hand scrollt beim Wischen (vorher 2 px, jetzt über 400 px), Spielfeld nach Antippen zu ca. 21 % statt 100 % verdeckt, Bildrate 60 fps beim Wischen und mit Glühen, Neuzeichnen unverändert ca. 3–6 ms.
- **Werkstatt-Karten bleiben spielbar:** Formatversion 2 für Karten mit neuen Wirkungen – ältere Spiele zeigen „braucht neuere Spielversion“ statt falsch zu spielen. Neuer Probelauf `test/probelauf.js` (600 Werkstatt-Zufallskarten laden/wirken + 60 KI-Partien) und `WOK_PROBE=… test/srvproto.js` (über den Server).
- Regelwerk ergänzt, offene Punkte (Werkstatt-Vorschläge) in `ASSUMPTIONS`. Projektregeln: GitHub/Server erst nach OK des Entwicklers; jede Werkstatt-Version zieht eine Spielversion nach.
- Kartenwerkstatt 12.9: Einstellungen „Angriff abwehren / durchgehen“ und „sofort angreifen / erst laufen“ mit einfachen Erklärungen, Phasen-Vorschlag mit „übernehmen“, Hinweise bei unsinnigen Kombinationen, Generator und KI-Modus wählen die passende Phase.
- Tests: `update46.js`, `wiederbeleben-ui.js`, `probelauf.js`, `perf.js`; `starthand-ui.js` und `schnellwirken.js` auf die neue Bedienung umgestellt.

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
