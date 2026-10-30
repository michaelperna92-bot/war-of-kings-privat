# Erzeugt die Vorlage mit 4 Kammern (2 Rassen + 2 Klassen) aus den vorhandenen Vorlagen.
from PIL import Image
base = Image.open('src/leer.png').convert('RGB')    # 2 Kammern, darunter freies Bildfenster
src = Image.open('work/leer2.png').convert('RGB')   # 3 Kammern als Teilequelle
X0, X1 = 40, 172
out = base.copy()
head = src.crop((X0, 195, X1, 219))      # Kopf der Leiste
div = src.crop((X0, 335, X1, 354))       # Trenner
body = src.crop((X0, 360, X1, 465))      # Kammerfläche (Textur)
bottom = src.crop((X0, 600, X1, 668))    # Ende der letzten Kammer + Spitze
BH = 111
y = 195
out.paste(head, (X0, y)); y += head.height
centers = []
for i in range(4):
    h = BH if i < 3 else BH - 30
    top = y
    out.paste(body.resize((X1 - X0, h), Image.LANCZOS), (X0, y)); y += h
    if i < 3:
        centers.append((top, top + h)); out.paste(div, (X0, y)); y += div.height
    else:
        out.paste(bottom, (X0, y)); centers.append((top, y + 30)); y += bottom.height
print('Kammern', centers, 'Ende', y)
out.save('work/leer4.png')
