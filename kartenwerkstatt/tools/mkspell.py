# Erzeugt aus den Layout-Bildern des Nutzers (Zauber grün, Fluch lila) leere Vorlagen für die Kartenwerkstatt:
# Bildfenster durchsichtig, Name, Energiezahl, Untertitel-Banner und Platzhaltertext entfernt.
import cv2, numpy as np, sys
from PIL import Image
W, H = 1024, 1536
def clean(src, out):
    im = cv2.imread(src, cv2.IMREAD_COLOR)
    hsv = cv2.cvtColor(im, cv2.COLOR_BGR2HSV)
    mask = np.zeros((H, W), np.uint8)
    # 1) Energiezahl im Edelstein: helle Ziffer + dunkle Kontur
    gem = np.zeros_like(mask); cv2.circle(gem, (112, 112), 62, 255, -1)
    v = hsv[:, :, 2]; s = hsv[:, :, 1]
    digit = ((s < 70) & (v > 150)) | (v < 45)
    mask |= (digit & (gem > 0)).astype(np.uint8) * 255
    # 2) dunkle Schrift auf Pergament (Name, Untertyp-Banner)
    for (x0, y0, x1, y1) in [(250, 50, 790, 116), (330, 962, 700, 1010)]:
        reg = np.zeros_like(mask); reg[y0:y1, x0:x1] = 255
        mask |= ((v < 120) & (reg > 0)).astype(np.uint8) * 255
    # 3) heller Platzhaltertext im Wirkungsfeld
    reg = np.zeros_like(mask); reg[1140:1200, 105:700] = 255
    mask |= ((v > 110) & (reg > 0)).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    out_im = cv2.inpaint(im, mask, 7, cv2.INPAINT_TELEA)
    # Bildfenster durchsichtig (abgerundetes Rechteck), Rahmenteile darüber bleiben erhalten
    alpha = np.full((H, W), 255, np.uint8)
    win = np.zeros_like(alpha)
    x0, y0, x1, y1, r = 47, 150, 979, 946, 36
    cv2.rectangle(win, (x0 + r, y0), (x1 - r, y1), 255, -1); cv2.rectangle(win, (x0, y0), (x1, y1 - r), 255, -1)
    for cx, cy in [(x0 + r, y1 - r), (x1 - r, y1 - r)]: cv2.circle(win, (cx, cy), r, 255, -1)
    # silberne Rahmenverzierungen am Fensterrand behalten (wenig Sättigung, hell), nur in einem schmalen Randstreifen
    inner = cv2.erode(win, np.ones((3, 3), np.uint8), iterations=26)
    band = (win > 0) & (inner == 0)
    silver = (s < 45) & (v > 125)
    keep = (band & silver).astype(np.uint8) * 255
    keep = cv2.morphologyEx(keep, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # nur große Stücke, die den Fensterrand berühren (Rahmenverzierungen), keine Regentropfen aus dem Bild
    edge = (win > 0) & (cv2.erode(win, np.ones((3, 3), np.uint8), iterations=4) == 0)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(keep, 8)
    good = np.zeros_like(keep)
    for i in range(1, n):
        comp = lab == i
        if stats[i, cv2.CC_STAT_AREA] > 350 and (comp & edge).any(): good[comp] = 255
    keep = good
    # Edelstein und Titelbanner überlappen das Fenster: alles oberhalb von y=165 im Bereich des Banners behalten
    top = np.zeros_like(alpha); top[:166, 190:860] = 255; top[140:216, 822:1006] = 255; cv2.circle(top, (112, 112), 105, 255, -1)
    alpha[(win > 0) & (keep == 0) & (top == 0)] = 0
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    rgba = cv2.cvtColor(out_im, cv2.COLOR_BGR2BGRA); rgba[:, :, 3] = alpha
    cv2.imwrite(out, rgba)
for kind in ['zauber', 'fluch']:
    clean('src_' + kind + '.png', 'tpl_' + kind + '.png')
print('ok')
