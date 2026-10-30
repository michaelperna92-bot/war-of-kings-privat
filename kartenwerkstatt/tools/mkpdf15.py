import json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
F = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('S', F + 'DejaVuSans.ttf')); pdfmetrics.registerFont(TTFont('SB', F + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('H', F + 'DejaVuSerif-Bold.ttf')); pdfmetrics.registerFont(TTFont('HI', F + 'DejaVuSerif.ttf'))
from reportlab.lib.fonts import addMapping
addMapping('S', 0, 0, 'S'); addMapping('S', 1, 0, 'SB')
d = json.load(open('/tmp/claude-0/pdfdata.json'))
NAVY = colors.HexColor('#16243d'); GOLD = colors.HexColor('#b8892e'); LINE = colors.HexColor('#c9ced8'); SOFT = colors.HexColor('#f1f3f7'); GOLDSOFT = colors.HexColor('#fbf3df')
RC = {'Gewöhnlich': '#8f9aa8', 'Ungewöhnlich': '#2fa35c', 'Selten': '#2f7fe6', 'Legendär': '#c9952f'}
st = lambda **k: ParagraphStyle('x', **k)
T = st(fontName='H', fontSize=20, leading=24, textColor=NAVY, spaceAfter=4)
SUB = st(fontName='HI', fontSize=10.5, leading=14, textColor=colors.HexColor('#5a6478'), spaceAfter=10)
H2 = st(fontName='H', fontSize=13, leading=16, textColor=NAVY, spaceBefore=12, spaceAfter=5)
P = st(fontName='S', fontSize=9.6, leading=13.4, textColor=colors.HexColor('#1d2433'), spaceAfter=5)
SM = st(fontName='S', fontSize=8.4, leading=11.4, textColor=colors.HexColor('#4a5366'), spaceAfter=4)
C = st(fontName='S', fontSize=9, leading=11.6); CB = st(fontName='SB', fontSize=9, leading=11.6)
CR = st(fontName='S', fontSize=9, leading=11.6, alignment=2); CBR = st(fontName='SB', fontSize=9, leading=11.6, alignment=2)
BOX = st(fontName='S', fontSize=9.6, leading=13.6, textColor=NAVY, backColor=GOLDSOFT, borderColor=GOLD, borderWidth=0.8, borderPadding=7, spaceBefore=4, spaceAfter=10)
fmt = lambda x: (str(round(x, 1)).rstrip('0').rstrip('.') if isinstance(x, float) else str(x)).replace('.', ',')
def sgn(x): return ('+' if x > 0 else '') + fmt(x)
def table(rows, widths, head=True, align_right=(), bold_last=False, extra=None):
    def sty(i, j):
        b = (head and i == 0) or (bold_last and i == len(rows) - 1)
        return (CBR if b else CR) if j in align_right else (CB if b else C)
    data = [[Paragraph(str(c), sty(i, j)) for j, c in enumerate(r)] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, hAlign='LEFT')
    s = [('GRID', (0, 0), (-1, -1), 0.4, LINE), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5)]
    if head: s += [('BACKGROUND', (0, 0), (-1, 0), SOFT)]
    if bold_last: s += [('BACKGROUND', (0, -1), (-1, -1), GOLDSOFT)]
    for c in align_right: s += [('ALIGN', (c, 0), (c, -1), 'RIGHT')]
    if extra: s += extra
    t.setStyle(TableStyle(s)); return t
story = []
story += [Paragraph('WAR OF KINGS – Power-Scaling V1.5', T),
          Paragraph('Punktesystem der Kartenwerkstatt · Entwurf vom 27.10.2026 · aufbauend auf Power-Scaling V1.4', SUB),
          Paragraph('<b>Status:</b> Provisorischer Balance-Entwurf. Keine Änderung des verbindlichen Master-Regelwerks. Alle Werte aus V1.4 bleiben gültig. '
                    'Neu in V1.5: Energiekosten zählen als Preis-Leistung in die Seltenheit, dazu Punkte für Laufrichtungen, Gabenanzahl und Gaben-Harmonie. '
                    'Die Kartenwerkstatt (Cloud- und PC-Version) rechnet genau nach diesem Dokument.', BOX)]
story += [Paragraph('1. Berechnungsmodell', H2),
          Paragraph('<b>Grundwert</b> = ATK + DEF + Bewegung (Reichweite + Laufrichtungen) + Angriffsfelder + Gaben + Gabenanzahl + Gaben-Harmonie + Sonder-Synergie', P),
          Paragraph('<b>Energiepunkte</b> = Grundwert × (Energiefaktor der Karte ÷ Energiefaktor zum fairen Preis − 1)', P),
          Paragraph('<b>Gesamt-Power</b> = Grundwert + Energiepunkte. Die Seltenheit richtet sich nach der Gesamt-Power.', P),
          Paragraph('Kostet eine Karte weniger als ihr fairer Preis, gibt es Pluspunkte, die mit ihrer Stärke wachsen. Kostet sie mehr, gibt es Minuspunkte. '
                    'Eine schwache, billige Karte bleibt deshalb gewöhnlich; eine starke, billige Karte mit Gaben steigt auf.', P)]
story += [Paragraph('2. Seltenheiten', H2),
          table([['Seltenheit', 'Gesamt-Power', 'Typische Energie'], ['Gewöhnlich', 'unter 30', '1–3'], ['Ungewöhnlich', '30 bis unter 50', '3–5'], ['Selten', '50 bis unter 75', '5–7'], ['Legendär', 'ab 75', '7–10']],
                [45 * mm, 45 * mm, 45 * mm], extra=[('TEXTCOLOR', (0, i), (0, i), colors.HexColor(RC[n])) for i, n in [(1, 'Gewöhnlich'), (2, 'Ungewöhnlich'), (3, 'Selten'), (4, 'Legendär')]]),
          Paragraph('Werte über 100 Punkte erfordern Einzelprüfung. Grenzen unverändert aus V1.4.', SM)]
story += [Paragraph('3. Angriff und Verteidigung', H2),
          table([['ATK oder DEF', 'Punkte'], ['500', '3'], ['1.000', '6'], ['1.500', '9'], ['2.000', '12'], ['2.500', '15'], ['3.000', '18'], ['3.500', '21']], [45 * mm, 25 * mm], align_right=(1,)),
          Paragraph('Zwischenwerte: Wert ÷ 500 × 3. Testskala, keine offizielle Wertebegrenzung.', SM)]
mv = table([['Reichweite', 'Punkte'], ['1 Feld (Standard)', '3'], ['2 Felder', '8'], ['3 Felder (sehr selten)', '13']], [45 * mm, 20 * mm], align_right=(1,))
md = table([['Laufrichtungen', 'Punkte'], ['1 (Standard)', '0'], ['2', '+1'], ['3', '+2'], ['4', '+3'], ['5', '+4'], ['6–8', '+5']], [35 * mm, 20 * mm], align_right=(1,))
af = table([['Angriffsfelder', 'Punkte'], ['1', '2'], ['2', '5'], ['3', '8'], ['4', '11'], ['5–8', '14']], [35 * mm, 20 * mm], align_right=(1,))
row3 = Table([[mv, md, af]], colWidths=[70 * mm, 58 * mm, 58 * mm], hAlign='LEFT'); row3.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
story += [KeepTogether([Paragraph('4. Bewegung und Angriffsrichtungen', H2), row3,
          Paragraph('Neu in V1.5: Die Anzahl der Laufrichtungen zählt dezent mit, weil mehr Richtungen strategisch flexibler sind. Reichweite und Laufrichtungen werden addiert. '
                    'Fernangriffe zählen nicht als zusätzliche Angriffsfelder; besondere Bewegungsgaben werden separat über die Gabe bewertet.', SM)])]
story += [Paragraph('5. Gaben', H2),
          table([['Gabe', 'Art', 'Punkte'], ['Rückzug', 'CT 4', '6'], ['Eisenpanzer', 'CT 5', '7'], ['Mordlust', 'CT 2', '8'], ['Entwaffnen', 'CT 2', '8'], ['Blitzschritt', 'CT 3', '9'],
                 ['Tausch', 'CT 4', '10'], ['Poison', 'permanent', '13'], ['Doppelschlag', 'permanent', '14'], ['Göttlicher Segen', 'permanent', '15']], [50 * mm, 30 * mm, 20 * mm], align_right=(2,)),
          Paragraph('Werte unverändert aus V1.4. Noch nicht bewertet (offene Entwürfe): Heilung [3], Fesseln [4], Durchbruch [4]. Karten mit diesen Gaben werden zu niedrig eingestuft und in der Werkstatt markiert.', SM)]
story += [KeepTogether([Paragraph('6. Gabenanzahl (neu)', H2),
          table([['Anzahl Gaben', 'Bonus'], ['0', '0'], ['1', '0'], ['2', '+2'], ['3', '+5']], [35 * mm, 20 * mm], align_right=(1,)),
          Paragraph('Mehrere Gaben bedeuten mehr Handlungsmöglichkeiten pro Zug; dieser Bonus kommt zu den Punkten der einzelnen Gaben dazu.', SM)])]
story += [KeepTogether([Paragraph('7. Gaben-Harmonie (neu, automatisch)', H2),
          table([['Gabenpaar', 'Warum es harmoniert', 'Bonus'],
                 ['Poison + Doppelschlag', 'vergiftet zwei Gegner pro Angriff', '+6'], ['Mordlust + Doppelschlag', '+500 ATK auf beide Ziele', '+4'],
                 ['Mordlust + Entwaffnen', '1.000 Punkte Unterschied in einem Kampf', '+3'], ['Eisenpanzer + Göttlicher Segen', 'Panzer, der nicht geschwächt werden kann', '+3'],
                 ['Poison + Göttlicher Segen', 'Giftträger ohne Schwächen', '+3'], ['Entwaffnen + Doppelschlag', 'geschwächtes Ziel plus zweiter Angriff', '+2'],
                 ['Tausch + Rückzug', 'doppelte Fluchtmöglichkeit', '+2'], ['Tausch + Blitzschritt', 'hohe Beweglichkeit', '+2'], ['Blitzschritt + Rückzug', 'zweifaches Ausweichen', '+2']],
                [55 * mm, 85 * mm, 18 * mm], align_right=(2,)),
          Paragraph('Mehrere Paare zählen zusammen, höchstens +9 pro Karte. Poison + Doppelschlag gilt laut V1.4 als besonders starke Kombination; der Zufallsgenerator vergibt sie nur bei Legendär.', SM)])]
story += [KeepTogether([Paragraph('8. Sonder-Synergie (von Hand)', H2),
          table([['Gesamtpaket', 'Bonus'], ['Keine Sonder-Synergie', '0'], ['Sinnvolles Gesamtpaket', '+3'], ['Sehr starkes Gesamtpaket', '+6'], ['Außergewöhnliches Gesamtpaket', '+9']], [60 * mm, 20 * mm], align_right=(1,)),
          Paragraph('Für das große Ganze, das die automatische Harmonie nicht erfasst, z. B. wenn Werte, Richtungen und Gaben zusammen eine besondere Rolle ergeben. Wird im Editor gewählt.', SM)])]
story += [PageBreak(), Paragraph('9. Energie als Preis-Leistung (neu)', H2),
          Paragraph('Zuerst wird aus dem Grundwert ein <b>fairer Preis</b> bestimmt (stufenlos aus den Energie-Richtwerten von V1.4). Dann wird der Energiefaktor der tatsächlichen Kosten mit dem Faktor des fairen Preises verglichen.', P)]
fair = table([['Grundwert', 'Fairer Preis']] + [[str(b), fmt(f) + (' → ' + str(r) if abs(f - r) > 0.05 else '')] for b, f, r in d['fair']], [28 * mm, 32 * mm], align_right=(1,))
fac = table([['Energie', 'Faktor (V1.4)']] + [[str(e), f] for e, f in [(1, '×1,35'), (2, '×1,30'), (3, '×1,25'), (4, '×1,15'), (5, '×1,00'), (6, '×0,95'), (7, '×0,90'), (8, '×0,85'), (9, '×0,80'), (10, '×0,75')]], [24 * mm, 30 * mm], align_right=(1,))
r2 = Table([[fair, fac]], colWidths=[70 * mm, 60 * mm], hAlign='LEFT'); r2.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0)]))
story += [r2, Spacer(1, 6), Paragraph('Mit Energie-Automatik setzt die Werkstatt den fairen Preis (gerundet); dann sind die Energiepunkte etwa 0. Wer die Energie von Hand senkt, bekommt Pluspunkte, wer sie erhöht, Minuspunkte, und die Seltenheit folgt automatisch.', SM)]
mrows = [['Grundwert'] + [str(e) for e in range(1, 11)]]
for m in d['matrix']: mrows.append([str(m['b'])] + [sgn(v) for v in m['vals']])
ex = []
for i, m in enumerate(d['matrix']):
    for j, v in enumerate(m['vals']):
        c = colors.HexColor('#dff3e6') if v >= 3 else colors.HexColor('#fbe3e0') if v <= -3 else None
        if c: ex.append(('BACKGROUND', (j + 1, i + 1), (j + 1, i + 1), c))
story += [Paragraph('Energiepunkte je nach Grundwert und Energiekosten', st(fontName='SB', fontSize=10, leading=13, textColor=NAVY, spaceBefore=6, spaceAfter=4)),
          table(mrows, [24 * mm] + [15.1 * mm] * 10, align_right=tuple(range(1, 11)), extra=ex),
          Paragraph('Grün: deutlich günstiger als fair. Rot: deutlich teurer als fair. Man sieht: Je stärker die Karte, desto mehr wirkt sich der Preis aus.', SM)]
story += [Paragraph('10. Rechenbeispiele', H2)]
ov = [['Karte', 'Grund', 'Energie', 'E-Punkte', 'Gesamt', 'Seltenheit']]
exs = []
for i, e in enumerate(d['examples']):
    en = [r for r in e['rows'] if str(r[0]).startswith('Energie ')][0][0].split(' ')[1]
    ov.append([e['t'], fmt(e['base']), en + ' (fair ≈ ' + fmt(e['fair']) + ')', sgn(e['ep']), fmt(e['total']), e['rar']])
    exs.append(('TEXTCOLOR', (5, i + 1), (5, i + 1), colors.HexColor(RC[e['rar']])))
story += [table(ov, [52 * mm, 17 * mm, 30 * mm, 22 * mm, 20 * mm, 31 * mm], align_right=(1, 3, 4), extra=exs + [('FONTNAME', (4, 1), (5, -1), 'SB')]),
          Paragraph('Grund = Grundwert, E-Punkte = Energiepunkte. Die schwache Karte bleibt trotz 1 Energie gewöhnlich; dieselbe starke Karte ist für 2 Energie legendär, für 8 Energie nur selten.', SM)]
for idx in (4, 7):
    e = d['examples'][idx]
    rows = [['Baustein', 'Punkte']] + [[r[0], sgn(r[1]) if str(r[0]).startswith('Energie') else fmt(r[1])] for r in e['rows'] if r[0] != 'Grundwert'] \
        + [['Grundwert', fmt(e['base'])], ['Gesamt-Power → ' + e['rar'], fmt(e['total'])]]
    t = table(rows, [125 * mm, 25 * mm], align_right=(1,), bold_last=True, extra=[('FONTNAME', (0, len(rows) - 2), (-1, len(rows) - 2), 'SB'), ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor(RC[e['rar']]))])
    story += [KeepTogether([Paragraph('Ausführlich: ' + e['t'], st(fontName='SB', fontSize=9.8, leading=13, textColor=NAVY, spaceBefore=8, spaceAfter=3)), t])]
story += [KeepTogether([Paragraph('11. Änderungen gegenüber V1.4', H2),
          table([['Bereich', 'V1.4', 'V1.5'],
                 ['Energie', 'nur Diagnose (Balancepunkte), ändert die Seltenheit nicht', 'Preis-Leistung: fließt als Energiepunkte in die Gesamt-Power und damit in die Seltenheit'],
                 ['Laufrichtungen', 'nicht bewertet', '+1 je zusätzliche Richtung, höchstens +5'],
                 ['Gabenanzahl', 'nicht bewertet', '2 Gaben +2, 3 Gaben +5'],
                 ['Gaben-Harmonie', 'nur Hinweis (Poison + Doppelschlag manuell prüfen)', 'feste Paarliste, automatisch, höchstens +9'],
                 ['Synergiebonus', '0 / 3 / 6 / 9', 'bleibt als Sonder-Synergie für das Gesamtpaket'],
                 ['ATK/DEF, Reichweite, Angriffsfelder, Gabenwerte, Grenzen', 'wie festgelegt', 'unverändert']],
                [42 * mm, 62 * mm, 82 * mm]),
          Spacer(1, 8),
          Paragraph('Hinweis für die Weitergabe: Sämtliche Zahlen sind provisorische Balancing-Vorschläge. Bestätigte Regeln und Kartendaten des aktuellen WoK-Master-Regelwerks haben Vorrang.', SM)])]
def deco(c, doc):
    c.saveState(); c.setStrokeColor(GOLD); c.setLineWidth(0.6); c.line(18 * mm, 14 * mm, A4[0] - 18 * mm, 14 * mm)
    c.setFont('S', 7.8); c.setFillColor(colors.HexColor('#5a6478'))
    c.drawString(18 * mm, 9.5 * mm, 'WoK · Power-Scaling V1.5 · Entwurf'); c.drawRightString(A4[0] - 18 * mm, 9.5 * mm, 'Seite %d' % doc.page); c.restoreState()
doc = SimpleDocTemplate('/home/claude/cc/docs/WoK_Power_Scaling_V1_5_Entwurf.pdf', pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=20 * mm,
                        title='War of Kings – Power-Scaling V1.5', author='War of Kings Kartenwerkstatt', subject='Punktesystem für die Seltenheit der Heldenkarten')
doc.build(story, onFirstPage=deco, onLaterPages=deco)
print('ok')
