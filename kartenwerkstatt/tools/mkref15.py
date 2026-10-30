import json, re
exec(open('/home/claude/cc/tools/mkpdf15.py').read().split("story = []")[0])  # Schriften, Farben, Stile, table()
R = json.load(open('/tmp/claude-0/refdata.json'))
H3 = st(fontName='SB', fontSize=10, leading=13, textColor=NAVY, spaceBefore=7, spaceAfter=3)
LI = st(fontName='S', fontSize=9.4, leading=13, textColor=colors.HexColor('#1d2433'), leftIndent=11, bulletIndent=2, spaceAfter=2.5)
def ul(items): return [Paragraph(t, LI, bulletText='•') for t in items]
def side(*tables, widths):
    t = Table([list(tables)], colWidths=widths, hAlign='LEFT'); t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)])); return t
S = []
S += [Paragraph('WAR OF KINGS – Power-Scaling V1.6', T),
      Paragraph('Vollständige Referenz: So rechnet die Kartenwerkstatt die Seltenheit · Stand 28.10.2026 · Version 1.6', SUB),
      Paragraph('<b>Status:</b> Provisorischer Balance-Entwurf, aufbauend auf Power-Scaling V1.4. Keine Änderung des verbindlichen Master-Regelwerks. '
                'Dieses Dokument beschreibt jede Regel genau so, wie sie im Programm (Cloud-, Handy- und PC-Version) umgesetzt ist, inklusive Sonderfällen, Rundung und Zufallsgenerator.', BOX)]
S += [Paragraph('0. Überblick in sechs Schritten', H2)] + ul([
    '<b>Schritt 1 – Kampfwerte:</b> ATK und DEF werden in Punkte umgerechnet.',
    '<b>Schritt 2 – Bewegung und Angriff:</b> Reichweite, Anzahl der Laufrichtungen und Anzahl der Angriffsfelder bringen Punkte.',
    '<b>Schritt 3 – Gaben:</b> jede Gabe einzeln, dazu ein Bonus für die Anzahl und für Gabenpaare, die harmonieren.',
    '<b>Schritt 4 – Sonder-Synergie:</b> optionaler Bonus von Hand für das Gesamtpaket. Summe aus 1–4 = <b>Grundwert</b>.',
    '<b>Schritt 5 – Energie:</b> Aus dem Grundwert ergibt sich ein fairer Preis. Weicht die tatsächliche Energie davon ab, gibt es Plus- oder Minuspunkte.',
    '<b>Schritt 6 – Seltenheit:</b> Grundwert + Energiepunkte = <b>Gesamt-Power</b>. Die Gesamt-Power bestimmt die Seltenheit.'])
S += [Paragraph('1. Seltenheits-Grenzen', H2),
      table([['Seltenheit', 'Gesamt-Power', 'Typische Energie (Richtwert)'], ['Gewöhnlich', 'kleiner als 30', '1–3'], ['Ungewöhnlich', '30 bis kleiner als 50', '3–5'], ['Selten', '50 bis kleiner als 75', '5–7'], ['Legendär', '75 und mehr', '7–10']], [40 * mm, 50 * mm, 55 * mm])] + ul([
    'Die Grenzen gelten exakt, auch mit Nachkommastellen: 29,9 ist Gewöhnlich, 30,0 ist Ungewöhnlich; 74,9 ist Selten, 75,0 ist Legendär.',
    'Nach oben gibt es keine Grenze. Ab mehr als 100 Punkten zeigt die Werkstatt die Warnung „Über 100 Punkte: gesondert prüfen.“',
    'Die Spalte „Typische Energie“ ist nur Orientierung; gerechnet wird mit dem fairen Preis aus Abschnitt 9.'])
st_rows = R['stats']; q = (len(st_rows) + 3) // 4
blocks = [table([['Wert', 'Punkte']] + [[f"{v:,}".replace(',', '.'), fmt(p)] for v, p in st_rows[i * q:(i + 1) * q]], [20 * mm, 17 * mm], align_right=(1,)) for i in range(4)]
S += [KeepTogether([Paragraph('2. Angriff (ATK) und Verteidigung (DEF)', H2),
      Paragraph('<b>Formel (neu in V1.6):</b> Punkte = Wert ÷ 100, also 1 Punkt je 100. Höchstwert 3.500 = 35 Punkte. ATK und DEF werden getrennt gerechnet und addiert. Ein leeres Feld zählt 0.', P),
      side(*blocks, widths=[44 * mm] * 4)])] + ul([
    'ATK und DEF sind auf 3.500 begrenzt. Höhere Eingaben sind ein Fehler in der Prüfliste und zählen nur wie 3.500. Der Zufallsgenerator nutzt 300 bis 3.500 in 100er-Schritten.',
    'Krumme Werte (z. B. 1.250) werden genau gerechnet (7,5 Punkte).'])
S += [KeepTogether([Paragraph('3. Bewegung – Reichweite', H2),
      side(table([['Reichweite', 'Punkte'], ['0 (keine Bewegung)', '0'], ['1 Feld (Standard)', '3'], ['2 Felder', '8'], ['3 Felder (sehr selten)', '13'], ['mehr als 3', '0 + Warnung']], [42 * mm, 26 * mm], align_right=(1,)),
           table([['So wird die Reichweite bestimmt'], ['1. Ist „Zahl neben dem Raster“ beim Laufen angehakt, zählt diese Zahl.'], ['2. Sonst zählt der längste Laufpfeil: einmal antippen = 1 Feld, zweimal = 2 Felder.'],
                  ['3. Kein Laufpfeil und keine Zahl = Reichweite 0.'], ['4. 3 Felder gehen nur über die Zahl, da Pfeile höchstens doppelt lang sind.']], [102 * mm]), widths=[74 * mm, 104 * mm])])]
S += [KeepTogether([Paragraph('4. Bewegung – Laufrichtungen (V1.6: wie Angriffsrichtungen)', H2),
      side(table([['Laufrichtungen', 'Punkte']] + [[str(n) + (' (Standard)' if n == 1 else ''), sgn(p) if p else '0'] for n, p in enumerate([0, 2, 5, 8, 11, 14, 14, 14, 14])], [36 * mm, 20 * mm], align_right=(1,)),
           table([['Zählregel'], ['Gezählt werden die angetippten Pfeile im Laufraster (bis zu 8).'], ['Ein doppelt langer Pfeil zählt als eine Richtung; seine Länge zählt nur bei der Reichweite.'],
                  ['Laufrichtungen sind genauso wichtig wie Angriffsrichtungen und bekommen dieselben Punkte (höchstens 14 ab 5 Richtungen). Reichweite und Laufrichtungen werden addiert. Beispiel: 2 Felder in 8 Richtungen = 8 + 14 = 22 Punkte.']], [118 * mm]), widths=[60 * mm, 120 * mm])])]
S += [KeepTogether([Paragraph('5. Angriffsfelder', H2),
      side(table([['Angriffsfelder', 'Punkte']] + [[str(n), str(p)] for n, p in enumerate([0, 2, 5, 8, 11, 14, 14, 14, 14])], [36 * mm, 20 * mm], align_right=(1,)),
           table([['Zählregel'], ['Gezählt werden die angetippten Pfeile im Angriffsraster (bis zu 8).'], ['Ein doppelt langer Angriffspfeil zählt als ein Feld.'],
                  ['Die „Zahl neben dem Raster“ beim Angriff ist nur Anzeige und bringt keine Punkte.'], ['Fernangriffe (z. B. über Durchbruch) zählen nicht als Angriffsfeld, sondern über die Gabe.']], [118 * mm]), widths=[60 * mm, 120 * mm])])]
S += [Paragraph('6. Gaben (jede einzeln)', H2),
      table([['Gabe', 'Art / Abklingzeit', 'Punkte', 'Kurzwirkung'],
             ['Rückzug (geändert)', 'CT 4', '6', 'Eigene Battlephase: eigenes oder gegnerisches Monster (auch sich selbst) weicht nach seinem Angriff 1 Feld gerade zurück'], ['Eisenpanzer', 'CT 5', '7', '+300 DEF für 2 Runden'], ['Mordlust', 'CT 2', '8', '+500 ATK bis Zugende'],
             ['Entwaffnen', 'CT 2', '8', 'Gegner −500 DEF bis Zugende'], ['Blitzschritt (geändert)', 'CT 3', '8', 'Offensive Mobilität: eigene Battlephase 1 Feld extra, danach angreifen; nicht zum Ausweichen'], 
             ['Heilung (geändert)', 'CT 3', '10', 'Alle negativen Effekte eines eigenen Helden aufheben, auch bei sich selbst'],
             ['Durchbruch (neu bewertet)', 'CT 4', '9', 'Angriff auf 2 Felder Entfernung'],
             ['Tausch', 'CT 4', '10', 'Platz mit eigenem Helden tauschen'], ['Fesseln (neu bewertet)', 'CT 4', '10', 'Gegner 2 Runden bewegungsunfähig'], ['Ansturm (neu)', 'permanent', '12', 'Hebt die Beschwörungssperre auf'],
             ['Poison', 'permanent', '13', 'Gegner fallen nach einer Runde'], ['Doppelschlag', 'permanent', '14', 'Zwei Helden angreifen, König doppelt'], ['Göttlicher Segen', 'permanent', '15', 'Immun gegen negative Effekte']],
            [36 * mm, 32 * mm, 20 * mm, 90 * mm], align_right=(2,))] + ul([
    'Höchstens 3 Gaben pro Karte. Die Abklingzeit (CT) selbst bringt keine eigenen Punkte; sie steckt im Wert der Gabe.',
    'Neu: Fesseln 10, Durchbruch 9 und Ansturm 12 laut Balance-Ergänzung im Master-Regelwerk (Stand 27.10.2026, Entwurf). Die übrigen Werte stammen aus V1.4.',
    'Blitzschritt ist seit 28.10.2026 nur noch offensiv (darum 8 statt 9 Punkte, Werkstatt-Entwurf). Rückzug wirkt jetzt in der eigenen Battlephase auf ein eigenes oder gegnerisches Monster, auch auf sich selbst; der Wert bleibt vorerst 6.',
    'Heilung wurde am 28.10.2026 geändert: Sie hebt jetzt alle negativen Effekte auf (vorher die Hälfte) und wirkt auch auf den Helden selbst. Darum 10 statt der 8 Punkte aus dem Regelwerk (Werkstatt-Entwurf).',
    'Ansturm hebt die Beschwörungssperre auf (Regelwerk Abschnitt 8): Der Held darf sofort laufen und angreifen, besonders stark bei niedriger Energie.',
    'Dieselbe Gabe doppelt ist ein Fehler in der Prüfliste; eine solche Karte kann nicht freigegeben werden.'])
S += [KeepTogether([Paragraph('7. Gabenanzahl (neu in V1.5)', H2),
      side(table([['Anzahl', 'Bonus'], ['0', '0'], ['1', '0'], ['2', '+2'], ['3', '+5']], [24 * mm, 20 * mm], align_right=(1,)),
           table([['Regel'], ['Der Bonus kommt zu den Punkten der einzelnen Gaben dazu.'], ['Jede Gabe zählt bei der Anzahl mit, egal wie stark sie ist.']], [128 * mm]), widths=[48 * mm, 130 * mm])])]
S += [KeepTogether([Paragraph('8. Gaben-Harmonie (neu in V1.5, automatisch)', H2),
      table([['Gabenpaar', 'Warum es harmoniert', 'Bonus'],
             ['Poison + Doppelschlag', 'vergiftet zwei Gegner pro Angriff', '+6'], ['Mordlust + Doppelschlag', '+500 ATK auf beide Ziele', '+4'],
             ['Mordlust + Entwaffnen', '1.000 Punkte Unterschied in einem Kampf', '+3'], ['Eisenpanzer + Göttlicher Segen', 'Panzer, der nicht geschwächt werden kann', '+3'],
             ['Poison + Göttlicher Segen', 'Giftträger ohne Schwächen', '+3'], ['Entwaffnen + Doppelschlag', 'geschwächtes Ziel plus zweiter Angriff', '+2'],
             ['Ansturm + Doppelschlag (neu)', 'trifft gleich beim Beschwören zwei Gegner', '+3'], ['Ansturm + Mordlust (neu)', 'Überraschungsangriff mit +500 ATK', '+3'],
             ['Durchbruch + Poison (neu)', 'vergiftet aus der Distanz', '+3'], ['Fesseln + Durchbruch (neu)', 'festhalten und aus der Ferne treffen', '+3'],
             ['Ansturm + Durchbruch (neu)', 'sofortiger Angriff auf 2 Felder Entfernung', '+2'], ['Fesseln + Entwaffnen (neu)', 'Gegner festgehalten und geschwächt', '+2'],
             ['Heilung + Eisenpanzer (neu)', 'zäher Verteidiger, der sich selbst reinigt', '+2'],
             ['Tausch + Rückzug', 'doppelte Fluchtmöglichkeit', '+2'], ['Tausch + Blitzschritt', 'hohe Beweglichkeit', '+2'], ['Blitzschritt + Rückzug', 'vorstoßen und wieder zurückweichen', '+2']],
            [55 * mm, 95 * mm, 18 * mm], align_right=(2,))] + ul([
    'Jedes Paar zählt, wenn beide Gaben auf der Karte sind. Mit 3 Gaben können bis zu 3 Paare gleichzeitig greifen.',
    'Gerechnet wird vom stärksten Paar abwärts, zusammen höchstens +9. Beispiel Raiden (Mordlust, Entwaffnen, Doppelschlag): 4 + 3 + 2 = 9.',
    'Die mit „neu“ markierten Paare sind Werkstatt-Entwürfe und noch nicht im Regelwerk bestätigt.',
    'Andere Kombinationen bringen keinen automatischen Bonus; dafür gibt es die Sonder-Synergie.']))]
S += [KeepTogether([Paragraph('9. Sonder-Synergie (von Hand)', H2),
      table([['Auswahl im Editor', 'Bonus'], ['Keine Sonder-Synergie', '0'], ['Sinnvolles Gesamtpaket', '+3'], ['Sehr starkes Gesamtpaket', '+6'], ['Außergewöhnliches Gesamtpaket', '+9']], [62 * mm, 20 * mm], align_right=(1,)),
      Paragraph('Wird nur von Hand gewählt (Standard 0). Gedacht für Stärken, die keine Einzelregel erfasst. Der Zufallsgenerator setzt immer 0.', SM)])]
S += [Paragraph('10. Grundwert und Rundung', H2),
      Paragraph('<b>Grundwert</b> = ATK-Punkte + DEF-Punkte + Reichweite + Laufrichtungen + Angriffsfelder + Gabenpunkte + Gabenanzahl + Harmonie + Sonder-Synergie', P)] + ul([
    'Alle Bausteine werden exakt addiert, danach wird der Grundwert auf eine Nachkommastelle gerundet (kaufmännisch: ab ,05 aufwärts).',
    'Mit diesem gerundeten Grundwert wird der faire Preis berechnet. Die Energiepunkte werden ebenfalls auf eine Nachkommastelle gerundet.',
    'Gesamt-Power = Grundwert + Energiepunkte, nochmals auf eine Nachkommastelle gerundet.'])
S += [PageBreak(), Paragraph('11. Energie als Preis-Leistung', H2),
      Paragraph('<b>a) Wann zählt die Energie?</b> Nur wenn eine Energie von mindestens 1 eingetragen ist. Ist das Feld leer, sind die Energiepunkte 0 („Energie noch offen“). '
                'Mehr als 10 Energie wird wie 10 gerechnet und mit der Warnung „Mehr als 10 Energie ist nicht vorgesehen“ markiert.', P),
      Paragraph('<b>b) Fairer Preis.</b> Stufenlos aus den Energie-Richtwerten von V1.4, zwischen diesen Stützpunkten geradlinig verbunden:', P),
      table([['Grundwert', '0–9', '30', '50', '75', '100 und mehr'], ['Fairer Preis', '1', '3', '5', '7', '10']], [28 * mm] + [26 * mm] * 5, align_right=tuple(range(1, 6))),
      Paragraph('Zwischen 9 und 30 steigt der Preis um 2 je 21 Punkte, zwischen 30 und 50 um 2 je 20, zwischen 50 und 75 um 2 je 25, zwischen 75 und 100 um 3 je 25.', SM),
      Paragraph('<b>c) Energiefaktoren</b> (aus V1.4). Liegt der faire Preis zwischen zwei ganzen Zahlen, wird auch der Faktor dazwischen geradlinig gemittelt.', P),
      table([['Energie'] + [str(e) for e in range(1, 11)], ['Faktor'] + ['×' + f for f in ['1,35', '1,30', '1,25', '1,15', '1,00', '0,95', '0,90', '0,85', '0,80', '0,75']]], [24 * mm] + [15.3 * mm] * 10, align_right=tuple(range(1, 11))),
      Paragraph('<b>d) Formel:</b> Energiepunkte = Grundwert × (Faktor der eingetragenen Energie ÷ Faktor des fairen Preises − 1)', P)]
w = R['walk']
S += [Paragraph('Rechenweg am Beispiel', H3),
      table([['Schritt', 'Rechnung', 'Ergebnis'],
             ['Grundwert', 'aus Abschnitt 2–9', '60'],
             ['Fairer Preis', '5 + (60 − 50) × 2 ÷ 25', '5,8'],
             ['Faktor fairer Preis', '1,00 + (0,95 − 1,00) × 0,8', '0,96'],
             ['Faktor eingetragene Energie 2', 'Tabelle c)', '1,30'],
             ['Verhältnis', '1,30 ÷ 0,96', '1,3542'],
             ['Energiepunkte', '60 × (1,3542 − 1) = 21,25 → gerundet', '+21,3'],
             ['Gesamt-Power', '60 + 21,3', '81,3 → Legendär']], [52 * mm, 86 * mm, 34 * mm], align_right=(2,))]
mrows = [['Grundwert'] + [str(e) for e in range(1, 11)]]; ex = []
for i, m in enumerate(R['matrix']):
    mrows.append([str(m['b'])] + [sgn(v) for v in m['vals']])
    for j, v in enumerate(m['vals']):
        c = colors.HexColor('#dff3e6') if v >= 3 else colors.HexColor('#fbe3e0') if v <= -3 else None
        if c: ex.append(('BACKGROUND', (j + 1, i + 1), (j + 1, i + 1), c))
S += [Paragraph('Energiepunkte je Grundwert (Zeile) und eingetragener Energie (Spalte)', H3),
      table(mrows, [24 * mm] + [15.3 * mm] * 10, align_right=tuple(range(1, 11)), extra=ex),
      Paragraph('Grün: mindestens 3 Punkte günstiger als fair. Rot: mindestens 3 Punkte teurer. Je stärker die Karte, desto stärker wirkt der Preis.', SM)]
tr = [['Energie', 'Ungewöhnlich ab Grundwert', 'Selten ab Grundwert', 'Legendär ab Grundwert']] + [[str(r[0]), fmt(r[1]), fmt(r[2]), fmt(r[3])] for r in R['thr']]
S += [KeepTogether([Paragraph('Welcher Grundwert reicht für welche Seltenheit?', H3),
      table(tr, [24 * mm, 50 * mm, 46 * mm, 50 * mm], align_right=(1, 2, 3)),
      Paragraph('Beispiel: Eine Karte für 2 Energie ist ab einem Grundwert von 56,3 schon Legendär; für 10 Energie braucht sie dafür 84,4.', SM)])]
fr = R['fair']; cols = 5; per = (len(fr) + cols - 1) // cols
fblocks = [table([['GW', 'fair', 'E']] + [[str(b), fmt(f), str(a)] for b, f, a in fr[i * per:(i + 1) * per]], [12 * mm, 11.5 * mm, 10.5 * mm], align_right=(0, 1, 2)) for i in range(cols)]
S += [PageBreak(), Paragraph('Nachschlagetabelle: fairer Preis für jeden Grundwert von 0 bis 100', H3),
      Paragraph('GW = Grundwert, fair = genauer fairer Preis, E = Energie, die die Energie-Automatik einträgt (gerundet, 1 bis 10).', SM),
      side(*fblocks, widths=[36 * mm] * cols)]
S += [Paragraph('12. Automatik im Editor', H2)] + ul([
    'Gerechnet wird, sobald ATK und DEF eingetragen sind. Die Gesamtpunkte oben rechts und die Aufschlüsselung aktualisieren sich bei jeder Eingabe.',
    '<b>Energie automatisch</b> (Standard an): trägt den gerundeten fairen Preis ein. Dann sind die Energiepunkte nahe 0.',
    'Tippst du selbst eine Energie ein, schaltet sich die Energie-Automatik ab. Ab dann zählen Plus- oder Minuspunkte für deinen Preis.',
    '<b>Seltenheit automatisch</b> (Standard an): setzt die Seltenheit aus der Gesamt-Power. Reihenfolge: erst Energie, dann Seltenheit.',
    'Wählst du die Seltenheit von Hand, schaltet sich die Seltenheits-Automatik ab; weicht sie vom Ergebnis ab, erscheint eine Warnung.',
    'Der Knopf „Vorschlag übernehmen und Automatik einschalten“ stellt beides zurück auf automatisch.'])
S += [KeepTogether([Paragraph('13. Hinweise und Warnungen', H2),
      table([['Auslöser', 'Meldung'],
             ['Energiepunkte ≥ +8', 'Sehr günstig für ihre Stärke (Info)'], ['Energiepunkte ≤ −8', 'Teuer für ihre Stärke (Info)'],
             ['Gesamt-Power über 100', 'Gesondert prüfen (Warnung)'], ['Energie über 10', 'Nicht vorgesehen (Warnung)'],
             ['Reichweite über 3', 'Nicht vorgesehen, 0 Punkte (Warnung)'], ['Gabe, die es nicht mehr gibt', 'Gabe entfernen (Fehler, Karte nicht freigebbar)'],
             ['Gewählte Seltenheit ≠ Ergebnis', 'Gewählt ist …, das Power-Scaling ergibt … (Warnung)']], [62 * mm, 110 * mm])])]
S += [KeepTogether([Paragraph('14. Was nicht zählt', H2)] + ul([
    'Element und zweites Element, Rasse und zweite Rasse, Klasse und zweite Klasse.',
    'Name, Illustration, Gestaltung (Rahmen, Schriften, Farben), Status (Entwurf oder freigegeben).',
    'Die Länge von Angriffspfeilen und die „Zahl neben dem Raster“ beim Angriff.',
    'Die Abklingzeit (CT) einer Gabe als eigener Wert sowie die Seltenheitswappen und Kartenlimits pro Deck.']))]
S += [PageBreak(), Paragraph('15. Zufallsgenerator (AI-Modus und Indoor-KI)', H2),
      Paragraph('Der Generator würfelt Werte, Richtungen, Gaben und Energie und prüft jede Karte mit genau der Formel oben. Name, Element, Rasse und Klasse kommen von Claude, der KI-Verbindung oder der Indoor-KI.', P),
      Paragraph('Seltenheit bei „Gemischt“', H3),
      table([['Gewöhnlich', 'Ungewöhnlich', 'Selten', 'Legendär'], ['64 %', '24 %', '10 %', '2 %']], [40 * mm] * 4, align_right=(0, 1, 2, 3)),
      Paragraph('Verteilung aus Balancing.xlsx.', SM),
      Paragraph('Würfel-Profile je Seltenheit', H3),
      table([['', 'Gewöhnlich', 'Ungewöhnlich', 'Selten', 'Legendär'],
             ['Ziel-Grundwert', '9–29', '30–49', '50–74', '75–100'],
             ['Anzahl Gaben', '0: 50 %, 1: 50 %', '0: 15 %, 1: 70 %, 2: 15 %', '1: 45 %, 2: 55 %', '2: 60 %, 3: 40 %'],
             ['Reichweite', '1: 88 %, 2: 12 %', '1: 60 %, 2: 35 %, 3: 5 %', '1: 35 %, 2: 50 %, 3: 15 %', '1: 20 %, 2: 50 %, 3: 30 %'],
             ['Angriffsfelder', '1: 25 %, 2: 40 %, 3: 35 %', '2: 35 %, 3: 50 %, 4: 15 %', '3: 50 %, 4: 40 %, 5: 10 %', '3: 30 %, 4: 45 %, 5: 25 %'],
             ['Laufrichtungen', '1 oder 3', '3 oder 2', '4', '4 oder 6']],
            [30 * mm, 35 * mm, 38 * mm, 37 * mm, 38 * mm])] + ul([
    'Gaben werden zufällig aus allen 13 Heldengaben gezogen, ohne Wiederholung.',
    'Poison + Doppelschlag zusammen gibt es nur bei Legendär.',
    'ATK und DEF: Die restlichen Punkte bis zum Ziel werden in Werte umgerechnet und zufällig aufgeteilt (ATK 35–65 %), auf 100 gerundet, zwischen 300 und 3.500.',
    'Energie: meist der faire Preis (60 %); sonst 1 billiger (20 %), 1 teurer (15 %) oder 2 billiger (5 %), immer zwischen 1 und 10. Im AI-Modus steht dann „(günstig)“ oder „(teuer)“.',
    'Danach werden ATK und DEF in 100er-Schritten angepasst, bis die Gesamt-Power in der gewünschten Seltenheit liegt. Klappt das nicht, wird neu gewürfelt (bis zu 80 Versuche).',
    'Gewürfelte Karten haben die Seltenheits-Automatik an; die Energie-Automatik nur, wenn der faire Preis gewürfelt wurde.',
    'Prüfung: 20.000 gewürfelte Testkarten lagen alle in der gewünschten Seltenheit.'])
dd = json.load(open('/tmp/claude-0/pdfdata.json'))
ov = [['Karte', 'Grund', 'Energie', 'E-Punkte', 'Gesamt', 'Seltenheit']]
for e in dd['examples']:
    en = [r for r in e['rows'] if str(r[0]).startswith('Energie ')][0][0].split(' ')[1]
    ov.append([e['t'], fmt(e['base']), en + ' (fair ≈ ' + fmt(e['fair']) + ')', sgn(e['ep']), fmt(e['total']), e['rar']])
S += [KeepTogether([Paragraph('16. Beispiele', H2), table(ov, [52 * mm, 17 * mm, 30 * mm, 22 * mm, 20 * mm, 31 * mm], align_right=(1, 3, 4)),
      Paragraph('Grund = Grundwert, E-Punkte = Energiepunkte.', SM)])]
S += [KeepTogether([Paragraph('17. Änderungen gegenüber V1.4', H2),
      table([['Bereich', 'V1.4', 'V1.5 / V1.6'],
             ['ATK und DEF', 'je 500 = 3 Punkte, keine Obergrenze', 'V1.6: 1 Punkt je 100, höchstens 3.500 = 35 Punkte'],
             ['Laufrichtungen', 'nicht bewertet', 'V1.5: +1 je Richtung (max. +5) · V1.6: wie Angriffsfelder (1 = 2, 2 = 5, 3 = 8, 4 = 11, ab 5 = 14)'],
             ['Energie', 'nur Diagnose (Balancepunkte), ändert die Seltenheit nicht', 'Preis-Leistung: Energiepunkte zählen in die Gesamt-Power und damit in die Seltenheit'],
             ['Gabenanzahl', 'nicht bewertet', '2 Gaben +2, 3 Gaben +5'],
             ['Gaben-Harmonie', 'nur Hinweis bei Poison + Doppelschlag', 'feste Paarliste, automatisch, höchstens +9'],
             ['Gaben', 'Heilung, Fesseln, Durchbruch offen', 'Fesseln 10, Durchbruch 9, neu Ansturm 12 (Master-Regelwerk); Heilung geändert: alle Effekte, 10 Punkte'],
             ['Synergiebonus', '0 / 3 / 6 / 9', 'bleibt als Sonder-Synergie'],
             ['Reichweite, Angriffsfelder, Seltenheitsgrenzen', 'wie festgelegt', 'unverändert']], [42 * mm, 62 * mm, 74 * mm]),
      Spacer(1, 8), Paragraph('Hinweis für die Weitergabe: Sämtliche Zahlen sind provisorische Balancing-Vorschläge. Bestätigte Regeln und Kartendaten des aktuellen WoK-Master-Regelwerks haben Vorrang.', SM)])]
def deco2(c, doc):
    c.saveState(); c.setStrokeColor(GOLD); c.setLineWidth(0.6); c.line(16 * mm, 14 * mm, A4[0] - 16 * mm, 14 * mm)
    c.setFont('S', 7.8); c.setFillColor(colors.HexColor('#5a6478'))
    c.drawString(16 * mm, 9.5 * mm, 'WoK · Power-Scaling V1.6 · Vollständige Referenz · Entwurf'); c.drawRightString(A4[0] - 16 * mm, 9.5 * mm, 'Seite %d' % doc.page); c.restoreState()
doc = SimpleDocTemplate('/home/claude/cc/docs/WoK_Power_Scaling_V1_6_Vollstaendige_Referenz.pdf', pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=15 * mm, bottomMargin=20 * mm,
                        title='War of Kings – Power-Scaling V1.6 – Vollständige Referenz', author='War of Kings Kartenwerkstatt', subject='Alle Kriterien der Seltenheitsberechnung')
doc.build(S, onFirstPage=deco2, onLaterPages=deco2)
print('ok')
