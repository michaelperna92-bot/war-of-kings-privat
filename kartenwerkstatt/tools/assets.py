import base64, io, json, os, glob
from PIL import Image
def uri(img, fmt='JPEG', q=92):
    b = io.BytesIO()
    if fmt == 'JPEG': img.convert('RGB').save(b, 'JPEG', quality=q, optimize=True, progressive=True, subsampling=0)
    elif fmt == 'WEBP': img.save(b, 'WEBP', quality=90, method=6)
    else: img.save(b, 'PNG', optimize=True)
    return 'data:image/' + fmt.lower() + ';base64,' + base64.b64encode(b.getvalue()).decode()
A = {'templates': {}, 'crests': {}, 'refs': {}}
A['templates']['1'] = uri(Image.open('src/leer.png'), q=93)
A['templates']['2'] = uri(Image.open('work/leer2.png'), q=93)
A['templates']['3'] = uri(Image.open('work/leer4.png'), q=93)
for f in sorted(glob.glob('work/crests/*.png')):
    im = Image.open(f)
    if im.width > 200: im = im.resize((200, int(im.height * 200 / im.width)), Image.LANCZOS)
    A['crests'][os.path.basename(f)[:-4]] = uri(im, 'WEBP')
A['refs']['raiden'] = uri(Image.open('src/pdfimg/img-001.png'), q=82)
A['refs']['akuma'] = uri(Image.open('src/pdfimg/img-002.png'), q=82)
s = 'window.WOK_ASSETS=' + json.dumps(A) + ';'
open('assets.js', 'w').write(s)
print('assets.js', len(s) // 1024, 'KB', {k: len(json.dumps(v)) // 1024 for k, v in A.items()})
