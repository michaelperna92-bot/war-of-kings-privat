import json
exec(open('/home/claude/cc/tools/mkpdf15.py').read().split("story = []")[0])
R = json.load(open('/tmp/claude-0/pd17.json')); K = R['consts']
LI = st(fontName='S', fontSize=9.4, leading=13, textColor=colors.HexColor('#1d2433'), leftIndent=11, bulletIndent=2, spaceAfter=2.5)
def ul(items): return [Paragraph(t, LI, bulletText='•') for t in items]
def side(*tables, widths):
    t = Table([list(tables)], colWidths=widths, hAlign='LEFT'); t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)])); return t
S = [Paragraph('WAR OF KINGS – Power-Scaling V1.7', T),
     Paragraph('Realistische Grenzwerte · Balancierte Punktetabelle · Stand 28.10.2026', SUB),
     Paragraph('<b>Status:</b> Werkstatt-Entwurf auf Basis von V1.6, keine Änderung des Master-Regelwerks (das Regelwerk hat Vorrang). '
               '<b>Ziel:</b> Eine Karte, in der alles perfekt ist, darf nicht mehr bei 300 Punkten landen. Jeder Baustein hat jetzt eine feste Obergrenze, '
               'die Energie verschiebt höchstens ±16 Punkte, und Energie 0 zählt als günstigster Preis. Die Seltenheitsgrenzen 30 / 50 / 75 bleiben.', BOX)]
S += [Paragraph('1. Grenzwerte je Baustein', H2),
      table([['Baustein', 'Höchstwert V1.6', 'Höchstwert V1.7', 'Anteil am Maximum']] + [
          ['ATK (3.500)', '35', '18', '17 %'], ['DEF (3.500)', '35', '18', '17 %'], ['Schritte (3 Felder)', '13', '16', '15 %'], ['Laufrichtungen (8)', '14', '10', '10 %'], ['Angriffsrichtungen (8)', '14', '10', '10 %'],
          ['Gaben (3 Topgaben)', '42', '21', '20 %'], ['Gabenanzahl (3 Gaben)', '5', '2,5', '2 %'], ['Gaben-Harmonie', '9', '4,5', '4 %'], ['Sonder-Synergie (von Hand)', '9', '4,5', '4 %'],
          ['<b>Grundwert gesamt</b>', '<b>176</b>', '<b>104,5</b>', '100 %'], ['Energie (Preis)', 'bis +141', '−16 bis +16', '–'], ['<b>Gesamt-Power möglich</b>', '<b>0 bis ≈ 317</b>', '<b>0 bis 120,5</b>', '–']],
          [62 * mm, 36 * mm, 36 * mm, 34 * mm], align_right=(1, 2, 3)),
      Paragraph('Designrahmen: Karten über ' + str(K['MAX']) + ' Gesamtpunkten zeigt die Werkstatt als „außerhalb des Designrahmens (zu stark)“ an. Die Kluft zwischen der schwächsten (0) und der stärksten denkbaren Karte (120,5) ist damit endlich und überschaubar.', SM)]
S += [Paragraph('2. Seltenheit (unverändert)', H2),
      table([['Seltenheit', 'Gesamt-Power', 'Typische Energie'], ['Gewöhnlich', 'unter 30', '0–3'], ['Ungewöhnlich', '30 bis unter 50', '3–5'], ['Selten', '50 bis unter 75', '5–7'], ['Legendär', '75 bis 100', '7–10']],
            [45 * mm, 45 * mm, 45 * mm], extra=[('TEXTCOLOR', (0, i), (0, i), colors.HexColor(RC[n])) for i, n in [(1, 'Gewöhnlich'), (2, 'Ungewöhnlich'), (3, 'Selten'), (4, 'Legendär')]])]
S += [KeepTogether([Paragraph('3. Angriff und Verteidigung', H2),
      Paragraph('Punkte = Wert ÷ 3.500 × 18 (gleich für ATK und DEF, ungefähr 0,5 Punkte je 100). Höchstwert 3.500.', P),
      table([['Wert'] + [f"{v:,}".replace(',', '.') for v, _ in R['stats']], ['Punkte'] + [fmt(p) for _, p in R['stats']]], [20 * mm] + [19.5 * mm] * 8, align_right=tuple(range(1, 9)))])]
S += [KeepTogether([Paragraph('4. Bewegung und Angriff – Schritte sind der wichtigste Wert', H2),
      side(table([['Schritte', 'V1.6', 'V1.7'], ['0', '0', '0'], ['1 Feld', '3', '4'], ['2 Felder', '8', '10'], ['3 Felder', '13', '16']], [26 * mm, 16 * mm, 16 * mm], align_right=(1, 2)),
           table([['Richtungen', 'Laufen', 'Angreifen']] + [[str(n), fmt(p), fmt(p)] for n, p in enumerate(K['DIRS'])], [26 * mm, 18 * mm, 20 * mm], align_right=(1, 2)), widths=[66 * mm, 70 * mm])])] + ul([
    'Jeder zusätzliche Schritt ist mehr wert als der vorige (4 → 10 → 16): Reichweite entscheidet, wie schnell ein Held Druck macht oder entkommt.',
    'Lauf- und Angriffsrichtungen zählen gleich, mit abnehmendem Zuwachs: die ersten Richtungen sind am wertvollsten, alle 8 Richtungen bringen 10.'])
S += [KeepTogether([Paragraph('5. Gaben', H2),
      table([['Gabe', 'Rolle', 'V1.6', 'V1.7']] + [[g[0], g[3], fmt(g[1]), fmt(g[2])] for g in R['gifts']], [52 * mm, 70 * mm, 20 * mm, 20 * mm], align_right=(2, 3)),
      Paragraph('Alle Gabenwerte sind halbiert; Reihenfolge und Abstände bleiben wie bisher. Gabenanzahl: 2 Gaben +1, 3 Gaben +2,5. Sonder-Synergie von Hand: 0 / 1,5 / 3 / 4,5.', SM)])]
S += [KeepTogether([Paragraph('6. Gaben-Harmonie (automatisch, höchstens +4,5)', H2),
      table([['Paar', 'Punkte', 'Grund']] + [[h[0], fmt(h[1]), h[2]] for h in R['harmony']], [64 * mm, 18 * mm, 96 * mm], align_right=(1,))])]
S += [KeepTogether([Paragraph('7. Energie – der Preis', H2),
      Paragraph('<b>Fairer Preis</b> aus dem Grundwert (stufenlos): 0 Punkte → 0 Energie, 9 → 1, 30 → 3, 50 → 5, 75 → 7, 100 → 10. '
                '<b>Energiepunkte</b> = (fairer Preis − Energie der Karte) × ' + str(K['STEP']) + ', begrenzt auf ±' + str(K['CAP']) + '. '
                'Eine Energiestufe entspricht damit etwa 1.550 ATK oder einem halben Schritt – Energie ist so wichtig wie die Kampfwerte, kann eine Karte aber nie ins Unendliche treiben.', P),
      side(table([['Grundwert', 'fair', 'Vorschlag']] + [[fmt(b), fmt(f), str(e)] for b, f, e in R['fair']], [24 * mm, 18 * mm, 22 * mm], align_right=(0, 1, 2)),
           table([['Energie gegenüber fair', 'Punkte']] + [[('+' if d > 0 else '') + str(d) + (' (teurer)' if d > 0 else ' (billiger)' if d < 0 else ' (fair)'), sgn(p) if p else '0'] for d, p in R['etab']], [52 * mm, 20 * mm], align_right=(1,)), widths=[70 * mm, 80 * mm])])] + ul([
    'Energie 0 ist erlaubt und zählt als günstigster Preis – sie wird nicht mehr wie „keine Angabe“ behandelt.',
    'Ab 2 Energie Abweichung vom fairen Preis warnt die Werkstatt (zu günstig bzw. zu teuer).'])
S += [KeepTogether([Paragraph('8. Beispiele: V1.6 gegen V1.7', H2),
      table([['Karte', 'Grund', 'Energie', 'Gesamt V1.7', 'V1.7', 'Gesamt V1.6']] + [[e[0], fmt(e[1]), sgn(e[2]) if e[2] else '0', '<b>' + fmt(e[3]) + '</b>', e[4], fmt(e[5])] for e in R['ex']],
            [70 * mm, 16 * mm, 18 * mm, 22 * mm, 30 * mm, 22 * mm], align_right=(1, 2, 3, 5))])]
S += [Paragraph('9. Was sich für bestehende Karten ändert', H2)] + ul([
    'Beim nächsten Start rechnet die Werkstatt alle Karten mit V1.7 neu (Cloud und PC). Automatische Energie und Seltenheit werden angepasst, bewusst von Hand gesetzte Werte bleiben.',
    'Eine von Hand gesetzte Sonder-Synergie (3 / 6 / 9) wird automatisch halbiert (1,5 / 3 / 4,5).',
    'Der Zufallsgenerator erzeugt in allen vier Seltenheiten passende Karten (20.000 Testkarten, keine Abweichung).'])
S += [Spacer(1, 6), Paragraph('Hinweis: Alle Zahlen sind ein Balancing-Vorschlag der Werkstatt. Bestätigte Regeln und Kartendaten des WoK-Master-Regelwerks haben Vorrang.', SM)]
def deco(c, doc):
    c.saveState(); c.setStrokeColor(GOLD); c.setLineWidth(0.6); c.line(16 * mm, 14 * mm, A4[0] - 16 * mm, 14 * mm)
    c.setFont('S', 7.8); c.setFillColor(colors.HexColor('#5a6478'))
    c.drawString(16 * mm, 9.5 * mm, 'WoK · Power-Scaling V1.7 · Werkstatt-Entwurf'); c.drawRightString(A4[0] - 16 * mm, 9.5 * mm, 'Seite %d' % doc.page); c.restoreState()
doc = SimpleDocTemplate('/home/claude/cc/docs/WoK_Power_Scaling_V1_7_Tabelle.pdf', pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm, topMargin=15 * mm, bottomMargin=20 * mm,
                        title='War of Kings – Power-Scaling V1.7', author='War of Kings Kartenwerkstatt', subject='Realistische Grenzwerte und balancierte Punktetabelle')
doc.build(S, onFirstPage=deco, onLaterPages=deco)
print('ok')
