# Bettet die Zauber-/Fluch-Vorlagen (work/spell/tpl_*.png) als WEBP in assets.js ein (Schlüssel spellTemplates).
import json, base64, io
from PIL import Image
p = '/home/claude/cc/assets.js'
s = open(p, encoding='utf-8').read()
pre = s[:s.index('=') + 1]; data = json.loads(s[s.index('=') + 1:].strip().rstrip(';'))
out = {}
for k, f in [('spell', 'zauber'), ('curse', 'fluch')]:
    im = Image.open('/home/claude/cc/work/spell/tpl_' + f + '.png').convert('RGBA')
    b = io.BytesIO(); im.save(b, 'WEBP', quality=90, method=6)
    out[k] = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    print(k, len(b.getvalue()) // 1024, 'KB')
data['spellTemplates'] = out
open(p, 'w', encoding='utf-8').write(pre + json.dumps(data) + ';\n')
