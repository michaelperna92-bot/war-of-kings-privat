exec(open('/home/claude/cc/tools/mkpdf15.py').read().split("story = []")[0])
LI = st(fontName='S', fontSize=9.4, leading=12.8, textColor=colors.HexColor('#1d2433'), leftIndent=11, bulletIndent=2, spaceAfter=2)
def ul(items): return [Paragraph(t, LI, bulletText='•') for t in items]
def sec(title, items, intro=None):
    b = ul(items); return [KeepTogether([Paragraph(title, H2)] + b[:2])] + b[2:]
S = [Paragraph('War of Kings – Kartenwerkstatt', T),
     Paragraph('Funktionsübersicht · Stand 28.10.2026 · Cloud-Version 24 · PC-Version 8.7', SUB),
     Paragraph('Die Kartenwerkstatt ist ein Editor für Heldenkarten des Strategie-Kartenspiels <b>War of Kings</b> (1 gegen 1). '
               'Sie gestaltet Karten, berechnet ihre Stärke nach dem Power-Scaling, prüft sie gegen die Regeln und exportiert sie für Druck und Spiel-Engines. '
               'Es gibt zwei Ausgaben mit gleichem Funktionsumfang: eine <b>Cloud-Version</b> im Browser (auch am Handy) und eine <b>PC-Version</b> für Windows, die komplett offline läuft.', BOX)]
S += sec('1. Karten gestalten', [
    'Live-Vorschau der Karte im Format 2:3 (1024 × 1536 px), drei Rahmenvarianten mit 2, 3 oder 4 Kammern für Rasse und Klasse.',
    'Name, Energie, ATK, DEF, Element (bis zu 2, geteiltes Abzeichen), Rasse (bis zu 2), Klasse (bis zu 2), Seltenheit.',
    'Angriffs- und Laufraster mit 8 Richtungen, Pfeillängen 1–2 bzw. Zahl für bis zu 3 Laufschritte.',
    'Bis zu 3 Gaben aus dem Regelwerk (13 Gaben mit Wappen, Kurztext auf der Karte, Langtext im Export, CT bzw. Permanent-Box).',
    'Illustration hochladen, zoomen, verschieben, ganz zeigen oder füllen; Randfüllung unscharf oder in Farbe.',
    '7 Rahmendesigns (z. B. Saphirblau, Karmesin, Obsidian, Elfenbein), 11 Edelsteinfarben je Feld (Energie, ATK, DEF, Element), 10 Pfeilfarben.',
    '9 Schriftsätze, mehrere Namensstile (z. B. Blattgold), Schrift je Rolle einzeln wählbar.',
    'Wappenbibliothek: 13 Rassen, 11 Klassen, 7 Elemente, 4 Seltenheiten, 13 Gabenwappen; eigene Wappen hochladbar.',
    'Vorlagen-Editor: Positionen aller Felder auf der Kartenvorlage einstellbar.'])
S += sec('2. Power-Scaling 2.1 (Teststand)', [
    'Gesamt-Power = ATK + DEF + Energie + Laufrichtungen + Angriffsfelder + Laufschritte + Gaben + Gabenanzahlbonus + Harmonie + Sonder-Synergie.',
    'ATK/DEF: Stützpunkte 500 → 11, 1.000 → 16,5, 1.500 → 22, 2.000 → 44, 3.500 → 66 (linear dazwischen, max. 3.500 in 100er-Schritten).',
    'Energie 0–10 nach fester Tabelle (+50 bis −15); Laufrichtungen und Angriffsfelder je 2 Punkte; Laufschritte 1/2/3 → 2/8/16.',
    'Gaben 6–15 Punkte, Bonus für 2 Gaben +2, für 3 Gaben +5. Harmonie (max. 9) noch ungeprüft und mit 0 gerechnet; Sonder-Synergie von Hand 0/3/6/9.',
    'Seltenheit: unter 70 Gewöhnlich, ab 70 Ungewöhnlich, ab 120 Selten, ab 140 Legendär; ab 200 Balancewarnung.',
    'Gabenlimit: Gewöhnlich 1, Ungewöhnlich 1, Selten 2, Legendär 3.',
    'Offene Aufschlüsselung aller Punkte, Seltenheit automatisch oder von Hand; bestehende Karten werden bei Systemänderungen automatisch neu berechnet.'])
S += sec('3. Prüfung und Freigabe', [
    'Automatische Prüfung jeder Karte: fehlende Angaben, ungültige Werte, unbekannte Gaben, Gabenlimit, Power-Bereich passt nicht zur Seltenheit, zu lange Texte.',
    'Statusmeldungen: „Berechnung gültig“, „Gabenlimit überschritten“, „Power-Bereich passt nicht zur Seltenheit“, „Unbekannte Gabe“, „Ungültiger Kartenwert“, „Balanceprüfung erforderlich“, „Regelprüfung unvollständig“.',
    'Fehler werden angezeigt, nie still korrigiert. Status Entwurf/Freigegeben; Freigabe nur ohne Fehler.'])
S += sec('4. KI-Funktionen', [
    'KI-Modus: mehrere Illustrationen hochladen, die KI erkennt das Motiv und wählt Name, Element, Rasse und Klasse; Werte, Gaben und Seltenheit würfelt die Werkstatt regelkonform nach Power-Scaling.',
    'Wählbare Seltenheit oder „Gemischt“ (64/24/10/2 %), Season-1-Filter, Neu würfeln je Karte.',
    'KI-Namensfindung für einzelne Karten.',
    'Indoor-KI: funktioniert ohne Internet (Farbanalyse des Bildes, Namensgenerator).',
    'Cloud: KI über Claude. PC: wählbare Anbindung an Ollama (lokal, kostenlos), Google Gemini, ChatGPT-API oder Claude-API, mit Verbindungstest und KI-Statusanzeige.',
    'Die KI darf keine Rassen, Klassen, Elemente, Seltenheiten, Gaben oder Sonderregeln erfinden.'])
S += sec('5. Bibliothek und Datensicherung', [
    'Kartenbibliothek mit Suche, Filtern und Vorschaubildern, Duplizieren, Löschen.',
    'Cloud: Karten sind über alle Geräte hinweg gleich. PC: Karten als Dateien unter Dokumente\\War of Kings Kartenwerkstatt.',
    'Sicherung als JSON-Datei mit eingebetteten Bildern; Import führt zusammen, ohne Duplikate (neuere Fassung gewinnt) – so lassen sich PC und Cloud abgleichen.',
    'Ganze Bibliothek als Bilder herunterladen (ZIP bzw. Ordner).'])
S += sec('6. Export', [
    'PNG in Originalgröße und im Yu-Gi-Oh-Format; Druck-PDF (59 × 86 mm, 600 dpi, mit Beschnitt).',
    'Engine-Export „wok-cardpack“ für Unity, Godot, Unreal, GameMaker, Web oder Allgemein: Kartendaten als JSON, Vorlagen mit relativen Positionen, Bausteine als PNG, Vorschaubilder, JSON-Schemas, README. Extras: Unity UI-Toolkit (UXML/USS), Unreal-CSV, GameMaker-Spriteliste, Web-Viewer.',
    'Zusätzlich „Komplettes Asset-Set“ (wok-assetkit): alle Bausteine für jede mögliche Karte – Rahmen je Design, Steinfarben-Überlagerungen, alle Wappen, 49 Element-Abzeichen, 520 Rasterteile (Pfeile je Farbe/Richtung/Länge), UI-Teile, Katalog mit allen Texten und Punktwerten, Web-Baukasten.',
    'PC: Exportziel je Engine wählbar (z. B. direkt in den Unity-Assets-Ordner); erneuter Export überschreibt statt zu verdoppeln.'])
S += sec('7. Technik', [
    'Cloud: eine Web-Seite, läuft im Browser und am Handy. PC: Windows-Installer ohne Administratorrechte, eigenes App-Fenster, offline nutzbar, ersetzt beim Start ältere laufende Versionen.',
    'Neue Versionen erscheinen immer gleichzeitig für Cloud und PC.'])
S += sec('8. Offene Punkte (Stand heute)', [
    'Automatischer Unity-Importer (AssetPostprocessor, ScriptableObjects) ist noch nicht gebaut; der Export liefert die fertigen Dateien.',
    'Gaben-Harmonie hat noch keine bestätigte Grundlage; Seltenheitsgrenzen sind vorläufig.',
    'Vorgaben für die KI-Kartenerstellung (Abschnitt 18 des Power-Systems) fehlen noch.',
    'Power-System und Rassen-/Klassen-Erweiterungen sind noch nicht ins Master-Regelwerk übernommen; das Regelwerk hat Vorrang.'])
def deco(c, doc):
    c.saveState(); c.setStrokeColor(GOLD); c.setLineWidth(0.6); c.line(16 * mm, 14 * mm, A4[0] - 16 * mm, 14 * mm)
    c.setFont('S', 7.8); c.setFillColor(colors.HexColor('#5a6478'))
    c.drawString(16 * mm, 9.5 * mm, 'War of Kings · Kartenwerkstatt · Funktionsübersicht'); c.drawRightString(A4[0] - 16 * mm, 9.5 * mm, 'Seite %d' % doc.page); c.restoreState()
doc = SimpleDocTemplate('/home/claude/cc/docs/WoK_Kartenwerkstatt_Funktionsuebersicht.pdf', pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=15 * mm, bottomMargin=20 * mm,
                        title='War of Kings – Kartenwerkstatt – Funktionsübersicht', author='War of Kings Kartenwerkstatt')
doc.build(S, onFirstPage=deco, onLaterPages=deco); print('ok')
