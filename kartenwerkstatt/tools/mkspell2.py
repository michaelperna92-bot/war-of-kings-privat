# Nacharbeit der Zauber-/Fluchvorlagen: „Zauberkarte“/„Fluchkarte“ unter dem Namen entfernen,
# Energie-Edelstein in der Kartenfarbe (Zauber grün, Fluch violett) statt blau.
import cv2, numpy as np, sys
HUE = {'zauber': 66, 'fluch': 140}   # OpenCV-Farbton (0–179)
for n in ['zauber', 'fluch']:
    p = 'work/spell/tpl_%s.png' % n
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED); bgr, a = im[:, :, :3].copy(), im[:, :, 3]
    # 1. Schriftzug im Namensbanner (unterer Teil) wegretuschieren
    x0, y0, x1, y1 = 230, 104, 800, 156
    reg = bgr[y0:y1, x0:x1]; g = cv2.cvtColor(reg, cv2.COLOR_BGR2GRAY)
    m = (g < 175).astype(np.uint8) * 255; m = cv2.dilate(m, np.ones((5, 5), np.uint8))
    full = np.zeros(bgr.shape[:2], np.uint8); full[y0:y1, x0:x1] = m
    bgr = cv2.inpaint(bgr, full, 7, cv2.INPAINT_TELEA)
    # 2. Edelstein umfärben
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV); yy, xx = np.mgrid[:bgr.shape[0], :bgr.shape[1]]
    circ = ((xx - 112) ** 2 + (yy - 112) ** 2) < 86 ** 2
    blue = (hsv[:, :, 0] > 90) & (hsv[:, :, 0] < 130) & (hsv[:, :, 1] > 60)
    sel = circ & blue
    hsv[:, :, 0][sel] = HUE[n]
    if n == 'zauber': hsv[:, :, 2][sel] = (hsv[:, :, 2][sel] * 0.92).astype(np.uint8)
    bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    cv2.imwrite(p, np.dstack([bgr, a]))
    print(n, 'Gem-Pixel', int(sel.sum()), 'Text-Pixel', int((full > 0).sum()))
