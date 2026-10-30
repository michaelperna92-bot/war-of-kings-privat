# Wappen für die drei königlichen Gaben (Werkstatt-Entwurf): Ring aus gabe_Doppelschlag, eigenes leuchtendes Motiv
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math
base = Image.open('work/crests/gabe_Doppelschlag.png').convert('RGBA'); W, H = base.size; cx, cy = W / 2, H / 2; S = 4; w, h = W * S, H * S; C = (w / 2, h / 2)
def disc(tint):
    bg = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(bg)
    for r in range(int(80 * S), 0, -2):
        t = (1 - r / (80 * S)); d.ellipse([C[0] - r, C[1] - r, C[0] + r, C[1] + r], fill=(int(6 + tint[0] * t ** 2.2), int(4 + tint[1] * t ** 2.2), int(4 + tint[2] * t ** 2.2), 255))
    return bg
def finish(inner_motif, tint, name):
    bg = disc(tint); m = inner_motif
    out = bg
    for rad in (8, 3):
        out = Image.alpha_composite(out, m.filter(ImageFilter.GaussianBlur(rad * S)))
    out = Image.alpha_composite(out, m).resize((W, H), Image.LANCZOS)
    dm = Image.new('L', (W, H), 0); ImageDraw.Draw(dm).ellipse([cx - 80, cy - 80, cx + 80, cy + 80], fill=255)
    res = Image.new('RGBA', (W, H), (0, 0, 0, 0)); res.paste(out, (0, 0), dm.filter(ImageFilter.GaussianBlur(1)))
    ring = base.copy(); rm = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(rm); dr.ellipse([cx - 78, cy - 78, cx + 78, cy + 78], fill=255)
    dr.polygon([(cx - 13, cy - 80), (cx + 13, cy - 80), (cx, cy - 63)], fill=0)
    ring.putalpha(ImageChops.subtract(base.getchannel('A'), rm)); res = Image.alpha_composite(res, ring)
    res.save('work/crests/' + name + '.png'); print(name)
P = lambda x, y: (C[0] + x * S, C[1] + y * S)
GOLD = (255, 205, 95, 255); HOT = (255, 244, 205, 255)
# 1) Gebot der Krone: Krone über einem nach unten zeigenden Pfeil (weniger Kosten)
m = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(m)
crown = [P(-40, 0), P(-44, -36), P(-20, -14), P(0, -46), P(20, -14), P(44, -36), P(40, 0)]
d.polygon(crown, fill=GOLD); d.rectangle([P(-40, 0), P(40, 10)], fill=HOT)
for x in (-44, 0, 44): y = -36 if x else -46; d.ellipse([P(x - 5, y - 5), P(x + 5, y + 5)], fill=HOT)
d.polygon([P(-14, 22), P(14, 22), P(14, 36), P(26, 36), P(0, 60), P(-26, 36), P(-14, 36)], fill=(120, 220, 255, 255))
finish(m, (60, 110, 170), 'koenig_Gebot_der_Krone')
# 2) Zorn des Imperators: aufrechtes Schwert mit Flammenkranz
m = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(m)
d.polygon([P(0, -60), P(9, -44), P(9, 26), P(-9, 26), P(-9, -44)], fill=HOT)
d.rectangle([P(-30, 26), P(30, 34)], fill=GOLD); d.rectangle([P(-6, 34), P(6, 56)], fill=GOLD); d.ellipse([P(-9, 54), P(9, 66)], fill=GOLD)
for a in range(-60, 61, 30):
    r = math.radians(a - 90); x, y = 36 * math.cos(r), 36 * math.sin(r) - 8
    d.polygon([P(x * 0.7, y * 0.7 + 4), P(x + 6 * math.sin(r), y), P(x * 1.35, y * 1.35 - 6)], fill=(255, 120, 40, 255))
finish(m, (190, 50, 20), 'koenig_Zorn_des_Imperators')
# 3) Ewiges Bollwerk: großer Wappenschild mit Mauerzinnen
m = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(m)
shield = [P(-44, -46), P(44, -46), P(44, 2), P(0, 58), P(-44, 2)]
d.polygon(shield, fill=GOLD); d.polygon([P(-34, -36), P(34, -36), P(34, 0), P(0, 44), P(-34, 0)], fill=(70, 120, 190, 255))
for i in range(-2, 3): d.rectangle([P(i * 14 - 5, -26), P(i * 14 + 5, -14)], fill=HOT)
d.rectangle([P(-30, -14), P(30, -4)], fill=HOT)
finish(m, (40, 90, 160), 'koenig_Ewiges_Bollwerk')
