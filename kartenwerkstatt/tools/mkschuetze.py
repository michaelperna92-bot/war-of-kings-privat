# Erzeugt das Gabenwappen „Schütze“ im Stil der vorhandenen runden Gabenwappen (Ring aus gabe_Doppelschlag, eigenes Motiv: Bogen mit Pfeil)
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math
base = Image.open('work/crests/gabe_Doppelschlag.png').convert('RGBA'); W, H = base.size; cx, cy = W / 2, H / 2
S = 4; w, h = W * S, H * S; C = (w / 2, h / 2)
# Hintergrund: dunkle Scheibe mit warmem Glühen
bg = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(bg)
for r in range(int(80 * S), 0, -2):
    t = r / (80 * S); col = (int(8 + 150 * (1 - t) ** 2.2), int(4 + 70 * (1 - t) ** 2.4), int(2 + 12 * (1 - t) ** 3), 255)
    d.ellipse([C[0] - r, C[1] - r, C[0] + r, C[1] + r], fill=col)
# Motiv auf eigener Ebene: Bogen (Kreisbogen), Sehne, Pfeil diagonal
m = Image.new('RGBA', (w, h), (0, 0, 0, 0)); md = ImageDraw.Draw(m)
R = 58 * S; ang0, ang1 = -150, -30  # Bogen links oben bis rechts oben, um 45° gedreht
rot = 45
def P(a, rr=R): a = math.radians(a + rot); return (C[0] + rr * math.cos(a) - 14 * S, C[1] + rr * math.sin(a) + 14 * S)
pts = [P(a) for a in range(ang0, ang1 + 1, 2)]
gold = (255, 200, 90, 255); hot = (255, 240, 190, 255)
md.line(pts, fill=gold, width=int(9 * S), joint='curve')
md.line(pts, fill=hot, width=int(3 * S), joint='curve')
a, b = P(ang0), P(ang1); md.line([a, b], fill=(255, 230, 170, 255), width=int(2.2 * S))
# Pfeil von unten links nach oben rechts
mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); apex = P(-90); vx, vy = apex[0] - mid[0], apex[1] - mid[1]; vl = math.hypot(vx, vy); vx, vy = vx / vl, vy / vl
p0 = (mid[0] - vx * 26 * S, mid[1] - vy * 26 * S); p1 = (apex[0] + vx * 22 * S, apex[1] + vy * 22 * S)
md.line([p0, p1], fill=gold, width=int(5 * S)); md.line([p0, p1], fill=hot, width=int(2 * S))
ux, uy = (p1[0] - p0[0]), (p1[1] - p0[1]); L = math.hypot(ux, uy); ux, uy = ux / L, uy / L; nx, ny = -uy, ux
tip = (p1[0] + ux * 16 * S, p1[1] + uy * 16 * S)
md.polygon([tip, (p1[0] + nx * 9 * S, p1[1] + ny * 9 * S), (p1[0] - nx * 9 * S, p1[1] - ny * 9 * S)], fill=hot)
for k in (0, 7, 14):
    q = (p0[0] + ux * k * S, p0[1] + uy * k * S)
    md.line([q, (q[0] - ux * 10 * S + nx * 9 * S, q[1] - uy * 10 * S + ny * 9 * S)], fill=gold, width=int(3 * S))
    md.line([q, (q[0] - ux * 10 * S - nx * 9 * S, q[1] - uy * 10 * S - ny * 9 * S)], fill=gold, width=int(3 * S))
glow = m.filter(ImageFilter.GaussianBlur(7 * S)); glow2 = m.filter(ImageFilter.GaussianBlur(2.5 * S))
inner = Image.alpha_composite(bg, glow); inner = Image.alpha_composite(inner, glow); inner = Image.alpha_composite(inner, glow2); inner = Image.alpha_composite(inner, m)
inner = inner.resize((W, H), Image.LANCZOS)
# Scheibe ausschneiden und den Metallring des Originals darüberlegen
disc = Image.new('L', (W, H), 0); ImageDraw.Draw(disc).ellipse([cx - 80, cy - 80, cx + 80, cy + 80], fill=255); disc = disc.filter(ImageFilter.GaussianBlur(1))
out = Image.new('RGBA', (W, H), (0, 0, 0, 0)); out.paste(inner, (0, 0), disc)
ring = base.copy(); rm = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(rm); dr.ellipse([cx - 78, cy - 78, cx + 78, cy + 78], fill=255)
dr.polygon([(cx - 13, cy - 80), (cx + 13, cy - 80), (cx, cy - 63)], fill=0)  # Zierspitze oben behalten
ra = ImageChops.subtract(base.getchannel('A'), rm); ring.putalpha(ra)
out = Image.alpha_composite(out, ring)
out.save('work/crests/gabe_Schütze.png'); print('ok', out.size)
