import sys, numpy as np
from PIL import Image, ImageFilter
from collections import deque
src, out, LUM, SAT = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
t = np.asarray(Image.open(src).convert('RGB')).astype(int)
H, W, _ = t.shape
lum = (t[..., 0]*299 + t[..., 1]*587 + t[..., 2]*114)//1000
sat = t.max(-1) - t.min(-1)
ok = (lum < LUM) & (sat < SAT)
bx0,by0,bx1,by1 = [int(v) for v in sys.argv[5].split(',')]
lim = np.zeros((H, W), bool); lim[by0:by1, bx0:bx1] = True
from PIL import ImageDraw
for r in sys.argv[6:]:
    if r.startswith('poly:'):
        pts = [tuple(int(v) for v in pt.split(',')) for pt in r[5:].split(';')]
        pm = Image.new('L', (W, H), 0); ImageDraw.Draw(pm).polygon(pts, fill=255)
        lim &= ~(np.asarray(pm) > 0)
    else:
        a,b,c,d = [int(v) for v in r.split(',')]; lim[b:d, a:c] = False
ok &= lim
m = np.zeros((H, W), bool)
q = deque([(int(W*0.5), int(H*0.29))])
while q:
    x, y = q.popleft()
    if x < 0 or y < 0 or x >= W or y >= H or m[y, x] or not ok[y, x]: continue
    m[y, x] = True
    q.extend(((x+1, y), (x-1, y), (x, y+1), (x, y-1)))
img = Image.fromarray((m*255).astype('uint8'))
# Löcher (Lichtreflexe der Textur) schließen, Kanten glätten
img = img.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
img = img.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
img.save(out)
a = np.asarray(img) > 128
ys, xs = np.where(a)
print('Fläche', a.mean().round(3), 'BBox', xs.min(), ys.min(), xs.max(), ys.max())
