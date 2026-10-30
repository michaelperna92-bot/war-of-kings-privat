/* WAR OF KINGS – Probe-Spiel: zeichnet Karten im vollen Design der Kartenwerkstatt.
 * Nutzt unverändert den Kartenrenderer, die Stammdaten und die Vorlagen der Werkstatt (render.js, data.js, assets.js),
 * die beim Bauen nur kopiert werden. Ergebnis: fertiges Kartenbild + Bildausschnitt für die Spielfigur.
 */
window.WOK_CARDART = (function () {
  'use strict';
  const R = window.WOK_RENDER, A = window.WOK_ASSETS, D = window.WOK_DATA;
  const VERSION = 'r2';
  const STYLE_DEFAULT = { theme: 'blau', name: 'normal', energy: 'original', atk: 'original', def: 'original', element: 'original', atkArrow: '#e3261d', movArrow: '#2f8df5', fontSet: 'original', fonts: {} };
  const clone = o => JSON.parse(JSON.stringify(o));
  let L = null, frames = {}, crests = {}, giftCrests = {}, spellFrames = {}, ready = null;
  const frameCache = new Map(), fontsDone = new Set();
  function mergeLayout(saved) {
    const base = R.defaultLayout(); if (!saved) return base;
    const s = clone(saved); delete s.templates; // eigene Vorlagen liegen nur in der Werkstatt
    const deep = (a, b) => { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deep(a[k], b[k]); else a[k] = b[k]; } return a; };
    return deep(base, s);
  }
  function init(savedLayout) {
    if (ready && !savedLayout) return ready;
    ready = (async () => {
      L = mergeLayout(savedLayout); frameCache.clear();
      for (const v of ['1', '2', '3']) { const img = await R.loadImage(A.templates[v]); frames[v] = img ? R.computeFrame(img, L.mask, +v).canvas : null; }
      await Promise.all(Object.keys(A.crests).map(async k => { crests[k] = await R.loadImage(A.crests[k]); }));
      for (const k of ['spell', 'curse']) if (A.spellTemplates && A.spellTemplates[k]) spellFrames[k] = await R.loadImage(A.spellTemplates[k]);
      for (const g of D.GIFTS.concat(D.ROYAL_GIFTS || [])) { const key = g.crest || ('gabe_' + g.id); if (crests[key]) giftCrests[g.id] = crests[key]; }
      return true;
    })();
    return ready;
  }
  function framesFor(style) {
    const st = Object.assign({}, STYLE_DEFAULT, style || {}), key = [st.theme, st.energy, st.atk, st.def, st.element].join('|');
    if (!frameCache.has(key)) frameCache.set(key, { 1: frames[1] && R.styleFrame(frames[1], L, st), 2: frames[2] && R.styleFrame(frames[2], L, st), 3: frames[3] && R.styleFrame(frames[3], L, st) });
    return frameCache.get(key);
  }
  async function ensureFonts(style) {
    const list = R.fontsNeeded(style).filter(x => !fontsDone.has(x)); if (!list.length) return;
    await Promise.race([Promise.all(list.map(f => document.fonts.load(f).catch(() => null))), new Promise(r => setTimeout(r, 5000))]);
    list.forEach(x => fontsDone.add(x));
  }
  function normalize(c) {
    const o = Object.assign({ type: 'hero', hp: '', name: '', nameScale: 100, energy: '', atk: '', def: '', element: null, element2: null, race: null, race2: null, classes: [null, null], rarity: null, gifts: [], art: null }, clone(c));
    o.classes = [(o.classes || [])[0] || null, (o.classes || [])[1] || null];
    o.attack = Object.assign({ dirs: {}, showNumber: false, number: 1 }, o.attack || {});
    o.move = Object.assign({ dirs: {}, showNumber: false, number: 1 }, o.move || {});
    o.gifts = (o.gifts || []).filter(g => g && g.id).slice(0, 3);
    o.style = Object.assign(clone(STYLE_DEFAULT), c.style || {});
    o.type = o.type === 'king' ? 'king' : (o.type === 'spell' || o.type === 'curse') ? o.type : 'hero';
    if (o.type === 'spell' || o.type === 'curse') { o.spell = window.WOK_EFFECTS ? window.WOK_EFFECTS.normalizeSpell(o.spell, o.type) : o.spell; o.ruleText = o.ruleText || ''; }
    delete o.giftDetails;
    return o;
  }
  const blob = (cv, type, q) => new Promise(r => cv.toBlob(r, type, q));
  // raw = Karte im Format der Werkstatt-Sicherung, artSrc = Blob/URL der Illustration (oder null)
  async function render(raw, artSrc, scale) {
    await init();
    const card = normalize(raw); scale = scale || 0.75;
    await ensureFonts(card.style);
    let art = null, url = null;
    if (artSrc) { url = typeof artSrc === 'string' ? artSrc : URL.createObjectURL(artSrc); art = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; }); }
    const cv = document.createElement('canvas'); cv.width = Math.round(L.W * scale); cv.height = Math.round(L.H * scale);
    const f = framesFor(card.style);
    R.draw(cv.getContext('2d'), card, L, { frame1: f[1], frame2: f[2], frame3: f[3], art, crests, giftCrests, spellFrames }, { scale, placeholder: false, watermark: false });
    const full = await blob(cv, 'image/jpeg', 0.9);
    // Ausschnitt fürs Spielbrett: das Bildfenster der Karte (ohne Bild: Name und Werte oben)
    const Wn = card.type === 'spell' || card.type === 'curse' ? R.SPELL_L.window : L.window, k = scale, sq = document.createElement('canvas');
    const side = Math.round(Wn.h * k); sq.width = sq.height = Math.min(320, side);
    const sx = (Wn.x + (Wn.w - Wn.h) / 2) * k, sy = Wn.y * k;
    if (art) sq.getContext('2d').drawImage(cv, sx, sy, side, side, 0, 0, sq.width, sq.height);
    const crop = art ? await blob(sq, 'image/jpeg', 0.88) : null;
    if (url && typeof artSrc !== 'string') URL.revokeObjectURL(url);
    return { full, art: crop };
  }
  return { VERSION, init, render, normalize };
})();
