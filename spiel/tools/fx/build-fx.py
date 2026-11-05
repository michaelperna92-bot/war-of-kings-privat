# Effekt-Bilder aufbereiten (1.11.2026): Rohbilder aus assets/fx-roh → assets/fx (klein, webp, Spritesheets als Streifen)
# Aufruf: python3 tools/fx/build-fx.py
import os, math, colorsys
from PIL import Image, ImageDraw, ImageFilter
R = os.path.join(os.path.dirname(__file__), '..', '..', 'assets'); SRC = os.path.join(R, 'fx-roh'); DST = os.path.join(R, 'fx')
os.makedirs(DST, exist_ok=True)
F = 192  # Kantenlänge je Einzelbild
def save(im, name, q=82): im.save(os.path.join(DST, name + '.webp'), 'WEBP', quality=q, method=6)
def strip(name, cols, rows, out=None, n=None):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA'); W, H = im.size; cw, ch = W / cols, H / rows
    frames = []
    for r in range(rows):
        for c in range(cols):
            fr = im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
            s = max(fr.size); sq = Image.new('RGBA', (s, s)); sq.paste(fr, ((s - fr.size[0]) // 2, (s - fr.size[1]) // 2))
            frames.append(sq.resize((F, F), Image.LANCZOS))
    if n: frames = frames[:n]
    st = Image.new('RGBA', (F * len(frames), F))
    for i, f in enumerate(frames): st.paste(f, (i * F, 0))
    save(st, out or name); return len(frames)
meta = {}
for n, g in {'fx_blitz': (4, 2), 'fx_wind': (4, 2), 'fx_erde': (4, 2), 'fx_wasser': (4, 2), 'fx_feuer': (4, 2), 'fx_dunkelheit': (4, 2), 'fx_klinge': (4, 2), 'fx_staub_landung': (4, 2), 'fx_staub_landung2': (4, 2), 'fx_treffer_funken': (4, 2), 'fx_splitter': (4, 4)}.items():
    meta[n] = strip(n, *g)
# Licht: goldene Strahlen (aus Code, 8 Bilder, Schleife)
fr = []
for i in range(8):
    im = Image.new('RGBA', (F * 2, F * 2)); d = ImageDraw.Draw(im); c = F
    for k in range(12):
        a = (k / 12 + i / 96) * 2 * math.pi; w = 0.10 + 0.05 * math.sin(k * 1.7 + i * .8); L = F * (0.72 + 0.22 * math.sin(k * 2.3 + i))
        p = [(c, c), (c + L * math.cos(a - w), c + L * math.sin(a - w)), (c + L * math.cos(a + w), c + L * math.sin(a + w))]
        d.polygon(p, fill=(255, 226, 140, 150))
    im = im.filter(ImageFilter.GaussianBlur(F * .05))
    g = Image.new('RGBA', im.size); gd = ImageDraw.Draw(g)
    for r in range(int(F * .55), 0, -4): t = 1 - r / (F * .55); gd.ellipse((c - r, c - r, c + r, c + r), fill=(255, 245, 210, int(255 * t * t)))
    im.alpha_composite(g.filter(ImageFilter.GaussianBlur(6)))
    for k in range(10):  # Funkeln
        a = (k * 2.39 + i * .3); r = F * (.25 + .55 * ((k * 37 + i * 11) % 100) / 100); x, y = c + r * math.cos(a), c + r * math.sin(a); s = 3 + (k + i) % 4
        gd2 = ImageDraw.Draw(im); gd2.ellipse((x - s, y - s, x + s, y + s), fill=(255, 255, 230, 230))
    fr.append(im.resize((F, F), Image.LANCZOS))
st = Image.new('RGBA', (F * 8, F)); [st.paste(f, (i * F, 0)) for i, f in enumerate(fr)]; save(st, 'fx_licht'); meta['fx_licht'] = 8
# Leuchtpunkt (aus Code, sauberer als das Rohbild)
g = Image.new('RGBA', (256, 256)); gd = ImageDraw.Draw(g)
for r in range(128, 0, -1): t = 1 - r / 128; gd.ellipse((128 - r, 128 - r, 128 + r, 128 + r), fill=(255, 255, 255, int(255 * t ** 2.2)))
save(g.filter(ImageFilter.GaussianBlur(3)), 'fx_glow')
# Einzelbilder
def one(name, size, out=None, q=82):
    im = Image.open(os.path.join(SRC, name + '.png')); im = im.convert('RGBA') if im.mode in ('RGBA', 'LA', 'P') else im.convert('RGB')
    bb = im.getbbox() if im.mode == 'RGBA' else None
    if bb and im.mode == 'RGBA': im = im.crop(bb)
    im.thumbnail(size, Image.LANCZOS); save(im, out or name, q)
one('energie_voll', (96, 96)); one('energie_leer', (96, 96)); one('koenig_rahmen', (256, 256)); one('phasen_banner', (1000, 400))
one('sieg_hintergrund', (1400, 800), q=72); one('niederlage_hintergrund', (1400, 800), q=72)
one('glanz_ungewoehnlich', (360, 360)); one('glanz_legendaer', (360, 360))
# Selten: blauer Glanz aus dem grünen Rahmen (Farbton gedreht)
im = Image.open(os.path.join(SRC, 'glanz_ungewoehnlich.png')).convert('RGBA'); im = im.crop(im.getbbox())
px = im.load()
for y in range(im.size[1]):
    for x in range(im.size[0]):
        r, gg, b, a = px[x, y]
        if a:
            h, l, s = colorsys.rgb_to_hls(r / 255, gg / 255, b / 255); h = (h + 0.28) % 1; r2, g2, b2 = colorsys.hls_to_rgb(h, l, s); px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
im.thumbnail((360, 360), Image.LANCZOS); save(im, 'glanz_selten')
f = Image.open(os.path.join(SRC, 'glanz_folie.png')).convert('RGBA').resize((256, 256), Image.LANCZOS); save(f, 'glanz_folie', 70)
import json; json.dump(meta, open(os.path.join(DST, 'frames.json'), 'w'))
tot = sum(os.path.getsize(os.path.join(DST, x)) for x in os.listdir(DST)); print('fertig', len(os.listdir(DST)), 'Dateien', round(tot / 1024), 'KB', meta)
