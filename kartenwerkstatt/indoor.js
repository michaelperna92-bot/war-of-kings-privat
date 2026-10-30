/* Indoor-KI: läuft komplett offline im Gerät.
 * - Farbanalyse der Illustration → Element-Vorschlag mit Begründung
 * - Namensvorschlag aus Silben (Beiname passend zum Element + Rufname)
 * Werte, Gaben, Energie und Seltenheit kommen weiter aus dem Power-Scaling-Generator (WOK_POWER.generate).
 */
window.WOK_INDOOR = (function () {
  'use strict';
  const D = window.WOK_DATA, PW = window.WOK_POWER;

  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    }
    return [h, s, l];
  }
  // Farbklassen → Element
  const BUCKETS = [
    ['feuer', 'Rot- und Orangetöne'], ['erde', 'Braun- und Ockertöne'], ['blitz', 'gelbe, grelle Töne'],
    ['wind', 'helle Grün- und Türkistöne'], ['wasser', 'Blautöne'], ['dunkelheit', 'dunkle, violette Töne'], ['licht', 'helle, goldweiße Töne']
  ];
  function classify(h, s, l) {
    if (l < 0.13) return 'dunkelheit';
    if (l > 0.82 && s < 0.45) return 'licht';
    if (s < 0.16) return l > 0.62 ? 'licht' : l < 0.3 ? 'dunkelheit' : null;
    if (h >= 255 && h < 320) return 'dunkelheit';
    if (h >= 320 || h < 18) return 'feuer';
    if (h < 45) return (l < 0.42 || s < 0.45) ? 'erde' : 'feuer';
    if (h < 68) return (l > 0.6 && s < 0.6) ? 'licht' : 'blitz';
    if (h < 165) return l < 0.33 ? 'erde' : 'wind';
    if (h < 195) return l > 0.5 ? 'wind' : 'wasser';
    return 'wasser';
  }
  async function analyzeImage(src, allowed) {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const W = 64, H = Math.max(16, Math.round(64 * im.naturalHeight / Math.max(1, im.naturalWidth)));
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H);
      const px = x.getImageData(0, 0, W, H).data, score = {}; let lum = 0, n = 0;
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
        const i = (y * W + xx) * 4; const [h, s, l] = hsl(px[i], px[i + 1], px[i + 2]);
        // Bildmitte zählt doppelt (dort steht meist die Figur), kräftige Farben zählen mehr
        const dx = (xx / W - 0.5) * 2, dy = (y / H - 0.5) * 2, w = (1.6 - Math.min(1, Math.hypot(dx, dy))) * (0.35 + s);
        const k = classify(h, s, l); if (k) score[k] = (score[k] || 0) + w;
        lum += l; n++;
      }
      lum /= n;
      if (lum < 0.2) score.dunkelheit = (score.dunkelheit || 0) * 1.4;
      if (lum > 0.65) score.licht = (score.licht || 0) * 1.3;
      const ok = allowed && allowed.length ? allowed : D.ELEMENTS.map(e => e.id);
      const ranked = Object.entries(score).filter(([k]) => ok.includes(k)).sort((a, b) => b[1] - a[1]);
      const total = ranked.reduce((s, [, v]) => s + v, 0) || 1;
      if (!ranked.length) return { element: null, element2: null, share: 0, reason: '' };
      const lab = k => (BUCKETS.find(b => b[0] === k) || [, ''])[1];
      const [el, v] = ranked[0], p1 = Math.round(v / total * 100);
      // Zweites Element nur bei zwei klar getrennten, fast gleich starken Farbwelten
      const sec = ranked[1], p2 = sec ? Math.round(sec[1] / total * 100) : 0;
      if (sec && p2 >= 30 && p1 <= 55) return { element: el, element2: sec[0], share: p1, reason: 'Indoor-KI Farbanalyse: ' + lab(el) + ' (' + p1 + ' %) und ' + lab(sec[0]) + ' (' + p2 + ' %)' };
      return { element: el, element2: null, share: p1, reason: 'Indoor-KI Farbanalyse: überwiegend ' + lab(el) + ' (' + p1 + ' %)' };
    } catch (e) { return { element: null, element2: null, share: 0, reason: '' }; }
    finally { if (typeof src !== 'string') URL.revokeObjectURL(url); }
  }

  /* ---------- Namen ---------- */
  const EPI = {
    feuer: ['Glut', 'Flammen', 'Asche', 'Brand', 'Lohen', 'Funkel'], wasser: ['Flut', 'Tiden', 'Gischt', 'Perl', 'Strom', 'Nebel'],
    erde: ['Stein', 'Fels', 'Erz', 'Wurzel', 'Granit', 'Moos'], wind: ['Sturm', 'Böen', 'Wolken', 'Feder', 'Himmels', 'Wirbel'],
    blitz: ['Donner', 'Funken', 'Blitz', 'Gewitter', 'Sturm', 'Volt'], licht: ['Sonnen', 'Licht', 'Glanz', 'Morgen', 'Stern', 'Gold'],
    dunkelheit: ['Schatten', 'Nacht', 'Dämmer', 'Finster', 'Mond', 'Raben']
  };
  const TAIL = ['klinge', 'herz', 'schwinge', 'faust', 'auge', 'wächter', 'brecher', 'ruf', 'zahn', 'kralle', 'dorn', 'seele'];
  const RACE_TAIL = { drachen: ['schwinge', 'zahn', 'kralle', 'atem'], bestien: ['kralle', 'zahn', 'fell'], tierwesen: ['pfote', 'kralle', 'fell'], maschinen: ['kern', 'werk', 'faust'], engel: ['schwinge', 'feder', 'krone'], daemonen: ['horn', 'brand', 'seele'], vampire: ['zahn', 'kuss', 'seele'], zwerge: ['hammer', 'bart', 'axt'], riesen: ['faust', 'hammer'], elfen: ['blatt', 'pfeil', 'lied'], kobolde: ['dorn', 'grinsen'], gargoyls: ['horn', 'stein'] };
  const CLASS_TAIL = { samurai: ['klinge'], pirat: ['säbel', 'anker'], magier: ['stab', 'zauber'], slayer: ['klinge'], baendiger: ['peitsche', 'ruf'], cyborg: ['kern'], geist: ['schleier', 'hauch'], zombie: ['knochen', 'grab'], tueftler: ['werk', 'zahnrad', 'hammer'], krieger: ['klinge', 'faust', 'schild'], ritter: ['schild', 'lanze', 'wacht'] };
  const S1 = ['Ka', 'Rai', 'Ze', 'Mor', 'Tha', 'Ul', 'Vey', 'Dra', 'Syl', 'Kor', 'Ny', 'Ae', 'Bal', 'Ish', 'Ren', 'Tor', 'Va', 'Xe', 'Lu', 'Gar', 'Sa', 'Fen', 'Ori', 'Ky'];
  const S2 = ['el', 'den', 'ros', 'ar', 'ira', 'ul', 'on', 'eth', 'is', 'ak', 'mir', 'wen', 'gor', 'ra', 'an', 'yx', 'ion', 'ka'];
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];
  function makeName(identity, rng) {
    rng = rng || Math.random;
    const epi = pick(rng, EPI[identity.element] || EPI.licht);
    const pool = TAIL.concat(RACE_TAIL[identity.race] || [], RACE_TAIL[identity.race] || [], CLASS_TAIL[(identity.classes || [])[0]] || []);
    let tail = pick(rng, pool); if (epi.toLowerCase().endsWith(tail.slice(0, 3))) tail = 'herz';
    let given = pick(rng, S1) + pick(rng, S2); if (rng() < 0.18) given += pick(rng, ['', 'a', 'o']);
    const name = epi + tail + ' ' + given;
    return name.length > 24 ? epi + tail : name;
  }

  // Komplette Offline-Identität für eine Illustration
  async function identify(file, season1, rng) {
    rng = rng || Math.random;
    const allowE = season1 ? PW.SEASON1.elements : null;
    const base = PW.randomIdentity(rng, season1);
    const a = await analyzeImage(file, allowE);
    const idn = { element: a.element || base.element, element2: a.element2 || null, race: base.race, race2: null, classes: base.classes, fromAI: false, indoor: true };
    idn.name = makeName(idn, rng);
    idn.reason = a.element ? a.reason + '. Rasse und Klasse zufällig.' : 'Indoor-KI: Element, Rasse und Klasse zufällig.';
    return idn;
  }
  return { analyzeImage, makeName, identify };
})();
