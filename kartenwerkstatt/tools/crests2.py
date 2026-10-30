# Neue Klassenwappen (Tüftler, Krieger, Ritter): Hintergrund per Flutfüllung vom Rand freistellen
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
SRC = Image.open('/home/claude/cc/src/klassen2.png').convert('RGB')
OUT = '/home/claude/cc/work/crests/'
items = [('Tüftler', 283), ('Krieger', 851), ('Ritter', 1418)]
Y0, Y1, HW = 118, 672, 280
CX, CY, R = 280, 397 - 118, 214
for name, cx in items:
    c = SRC.crop((cx - HW, Y0, cx + HW, Y1))
    a = np.asarray(c).astype(int)
    lum = (a[..., 0] * 299 + a[..., 1] * 587 + a[..., 2] * 114) // 1000
    sat = a.max(-1) - a.min(-1)
    cand = ((lum < 52) & (sat < 30)).astype('uint8') * 255
    m = Image.fromarray(cand, 'L').copy()
    W, H = m.size
    for pt in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1), (W // 2, 0), (0, H // 2), (W - 1, H // 2), (W // 2, H - 1)]:
        if m.getpixel(pt) == 255: ImageDraw.floodfill(m, pt, 128)
    bg = (np.asarray(m) == 128)
    # Wappenkörper (Kreis bis zum Außenring) immer deckend
    yy, xx = np.mgrid[0:H, 0:W]
    bg &= np.hypot(xx - CX, yy - CY) > R
    alpha = Image.fromarray(((~bg) * 255).astype('uint8'), 'L')
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    rgba = c.convert('RGBA'); rgba.putalpha(alpha)
    bb = rgba.getbbox(); rgba = rgba.crop(bb)
    s = max(rgba.size); sq = Image.new('RGBA', (s, s), (0, 0, 0, 0)); sq.paste(rgba, ((s - rgba.width) // 2, (s - rgba.height) // 2))
    sq = sq.resize((188, 188), Image.LANCZOS)
    sq.save(OUT + 'klasse_' + name + '.png'); print(name, bb, s)
# Vorschau auf hellem und dunklem Grund
pv = Image.new('RGB', (188 * 3 * 2 + 40, 210), (230, 230, 230))
for i, (n, _) in enumerate(items):
    im = Image.open(OUT + 'klasse_' + n + '.png')
    pv.paste(im, (i * 190, 10), im)
    dark = Image.new('RGB', (188, 188), (40, 30, 70)); dark.paste(im, (0, 0), im); pv.paste(dark, (600 + i * 190, 10))
pv.save('/tmp/claude-0/new_crests.png')
