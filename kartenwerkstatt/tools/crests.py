import numpy as np, json, sys
from PIL import Image, ImageDraw, ImageFilter
W = Image.open('/home/claude/cc/src/wappen.png').convert('RGB')
G = Image.open('/home/claude/cc/src/gaben.png').convert('RGB')
OUT = '/home/claude/cc/work/crests/'
def soft_disc(size, r_in, r_out):
    y, x = np.mgrid[0:size, 0:size] - (size - 1) / 2
    d = np.hypot(x, y)
    a = np.clip((r_out - d) / max(1e-6, r_out - r_in), 0, 1)
    return Image.fromarray((a * 255).astype('uint8'))
def cut(img, cx, cy, size, out, r_in, r_out, scale=1):
    c = img.crop((int(cx - size / 2), int(cy - size / 2), int(cx + size / 2), int(cy + size / 2)))
    if scale != 1: c = c.resize((int(size * scale), int(size * scale)), Image.LANCZOS)
    m = soft_disc(c.width, r_in * scale, r_out * scale)
    c = c.convert('RGBA'); c.putalpha(m); c.save(OUT + out)
races = ['Menschen','Tierwesen','Bestien','Drachen','Maschinen','Elfen','Riesen','Dämonen','Engel','Vampire','Zwerge','Kobolde','Gargoyls']
rx = [124,224,323,425,529,634,742,849,957,1062,1166,1268,1370]
classes = ['Pirat','Samurai','Zombie','Magier/Hexe','Geist','Bestienbändiger','Demon Slayer','Cyborg']
cx_ = [153,325,492,659,826,999,1171,1341]
elems = ['Feuer','Wasser','Wind','Erde','Licht','Dunkelheit','Blitz']
ex = [154,261,368,477,582,692,805]
rar = ['Gewöhnlich','Ungewöhnlich','Selten','Legendär']
rrx = [1015,1123,1238,1343]
gifts = ['Mordlust','Entwaffnen','Doppelschlag','Poison','Eisenpanzer','Schütze','Blitzschritt']
gx = [122,326,528,730,935,1140,1390]
p = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
ry, rs = p.get('ry', 275), p.get('rs', 92)
cy, cs = p.get('cy', 605), p.get('cs', 118)
ey, es = p.get('ey', 855), p.get('es', 100)
gy, gs = p.get('gy', 228), p.get('gs', 196)
slug = lambda s: s.replace('/', '-').replace(' ', '_')
for n, x in zip(races, rx): cut(W, x, ry, rs, 'rasse_' + slug(n) + '.png', rs * .36, rs * .5, 2)
for n, x in zip(classes, cx_): cut(W, x, cy, cs, 'klasse_' + slug(n) + '.png', cs * .36, cs * .5, 1.6)
for n, x in zip(elems, ex): cut(W, x, ey, es, 'element_' + slug(n) + '.png', es * .455, es * .475, 2)
for n, x in zip(gifts, gx): cut(G, x, gy, gs, 'gabe_' + slug(n) + '.png', gs * .44, gs * .47, 1)
# Seltenheitskristalle: Raute als Maske, Hintergrund zusätzlich über Farbabstand
for n, x in zip(rar, rrx):
    s = 96; cy0 = p.get('kry', 880)
    c = W.crop((x - s // 2, cy0 - s // 2, x + s // 2, cy0 + s // 2)).resize((s * 2, s * 2), Image.LANCZOS)
    a = np.asarray(c).astype(float); bg = np.array([14, 18, 22.])
    d = np.sqrt(((a - bg) ** 2).sum(-1)); al = np.clip((d - 22) / 40, 0, 1)
    pm = Image.new('L', c.size, 0); S = c.width; k = p.get('kr', 0.47)
    ImageDraw.Draw(pm).polygon([(S/2, S/2 - S*k), (S/2 + S*k*0.82, S/2), (S/2, S/2 + S*k), (S/2 - S*k*0.82, S/2)], fill=255)
    pm = pm.filter(ImageFilter.GaussianBlur(2))
    al = al * (np.asarray(pm) / 255.)
    c = c.convert('RGBA'); c.putalpha(Image.fromarray((al * 255).astype('uint8'))); c.save(OUT + 'selten_' + slug(n) + '.png')
# Übersicht auf Schachbrett
import glob, os
fs = sorted(glob.glob(OUT + '*.png'))
cell = 170; cols = 8; rows = (len(fs) + cols - 1) // cols
sh = Image.new('RGB', (cols * cell, rows * cell), 'white'); dr = ImageDraw.Draw(sh)
for i in range(0, cols * cell, 10):
    for j in range(0, rows * cell, 10):
        if (i // 10 + j // 10) % 2: dr.rectangle((i, j, i + 9, j + 9), fill=(205, 205, 205))
for i, f in enumerate(fs):
    im = Image.open(f); im.thumbnail((150, 150)); sh.paste(im, ((i % cols) * cell + 10, (i // cols) * cell + 5), im)
    dr.text(((i % cols) * cell + 5, (i // cols) * cell + 155), os.path.basename(f)[:24], fill='black')
sh.save('/tmp/claude-0/-home-claude/6eaa5b5e-216d-5bed-8d22-ca88b85fcffb/scratchpad/crests.png')
print(len(fs), 'Wappen')
