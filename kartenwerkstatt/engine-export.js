'use strict';
/* ================= Export für Spiel-Engines =================
 * Ein neutrales Kartenpaket („wok-cardpack“, Formatversion 1), das jede Engine lesen kann:
 *   manifest.json · cards/*.json · templates/*.json · assets/** (PNG) · previews/*.png · schema/*.json
 * Dazu je Ziel passende Extras (Unity: UI-Toolkit-Vorlage, Unreal: CSV, Web: Viewer …).
 * Karten werden nicht als 200 Einzelbilder gedacht: Rahmen, Wappen und Abzeichen liegen nur einmal vor,
 * Texte und Werte stehen als Daten im JSON und werden in der Engine dynamisch dargestellt.
 */
const EXPORT_FORMAT = 'wok-cardpack', EXPORT_VERSION = 1, PACK_ROOT = 'WoK_Kartenwerkstatt';
const ENGINE_TARGETS = [
  { id: 'unity', name: 'Unity', note: 'Kartendaten, Bausteine, UI-Toolkit-Vorlage (UXML/USS) und Sammeldatei für JsonUtility. Automatischer Unity-Importer: in Arbeit, bis dahin fertige Dateien.' },
  { id: 'godot', name: 'Godot', note: 'Kartendaten und Bausteine mit Anleitung für Godot (res://). Importer: noch nicht vorhanden, Dateien sind vorbereitet.' },
  { id: 'unreal', name: 'Unreal Engine', note: 'Zusätzlich eine CSV-Tabelle für Unreal-DataTables. Importer: noch nicht vorhanden, Dateien sind vorbereitet.' },
  { id: 'gamemaker', name: 'GameMaker', note: 'Bausteine mit Sprite-Namensliste (spr_wok_…). Importer: noch nicht vorhanden, Dateien sind vorbereitet.' },
  { id: 'web', name: 'Web / HTML-Spiel', note: 'Kartendaten als JavaScript plus Viewer-Seite, die jede Karte aus den Bausteinen zusammensetzt.' },
  { id: 'generic', name: 'Allgemein', note: 'Das komplette neutrale Paket mit allen Extras, für jedes andere Programm.' }
];
const TEXT_LAYERS = ['energy', 'name', 'elementLabel', 'slotLabels', 'stats', 'banner', 'giftsTitle', 'giftTexts', 'giftCtText', 'rarityLabel'];

function exSlug(s) {
  return String(s || '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'ae').replace(/Ö/g, 'oe').replace(/Ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'x';
}
const r4 = v => Math.round(v * 10000) / 10000;
function exLoadPrefs() { try { return Object.assign({ target: 'unity', what: 'cards', scope: 'current', scale: 1, previews: true, textOverlay: false }, JSON.parse(localStorage.getItem('wok-engine-export') || '{}')); } catch (e) { return { target: 'unity', what: 'cards', scope: 'current', scale: 1, previews: true, textOverlay: false }; } }
function exSavePrefs(p) { try { localStorage.setItem('wok-engine-export', JSON.stringify(p)); } catch (e) {} }
function canvasBlob(cv) { return new Promise(r => cv.toBlob(b => r(b), 'image/png')); }
async function sha1Hex(buf) {
  try { const h = await crypto.subtle.digest('SHA-1', buf); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 2166136261; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
}
function cropCanvas(src, rect, k) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(rect.w * k)); c.height = Math.max(1, Math.round(rect.h * k));
  c.getContext('2d').drawImage(src, Math.round(rect.x * k), Math.round(rect.y * k), c.width, c.height, 0, 0, c.width, c.height);
  return c;
}
function imgCanvas(im) {
  const c = document.createElement('canvas'); c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height;
  c.getContext('2d').drawImage(im, 0, 0); return c;
}

/* ---------- Layout-Vorlagen in relativen Koordinaten ---------- */
function exTemplate(variant, king) {
  const L = G.layout, D4 = R.defaultLayout(), W = L.W, H = L.H, P = k => L[k] || D4[k];
  const rect = (x, y, w, h) => ({ x: r4(x / W), y: r4(y / H), w: r4(w / W), h: r4(h / H) });
  const circ = c => rect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  const txt = (id, t, role, extra) => Object.assign({ id, kind: 'text', rect: rect(t.x - (t.w || 200) / 2, t.y - t.size * 0.68, t.w || 200, t.size * 1.36), align: 'center', fontRole: role, fontSizeRel: r4(t.size / H) }, extra || {});
  const gridRect = g => rect(g.x - 8, g.titleY - 14, g.w + 22, g.y + g.h - (g.titleY - 14) + 8);
  const slotKeys = variant === 4 ? ['slot4a', 'slot4b', 'slot4c', 'slot4d'] : variant === 3 ? ['race', 'class1b', 'class2'] : ['race', 'class1'];
  const slots = [
    { id: 'art', kind: 'image', source: 'visual.art', rect: rect(L.window.x, L.window.y, L.window.w, L.window.h), order: 0 },
    { id: 'frame', kind: 'image', source: 'visual.frame', rect: rect(0, 0, W, H), order: 1 },
    king ? { id: 'crown', kind: 'image', source: 'visual.crown', rect: rect(P('energy').x - 60, P('energy').y - 56, 120, 112), order: 2, note: 'Könige: Krone statt Energiekosten' } : Object.assign(txt('energy', Object.assign({ w: 150 }, P('energy')), 'num', { source: 'energy', color: '#f3f6ff', stroke: '#0b1a3d', order: 2 })),
    Object.assign(txt('name', P('name'), 'name', { source: 'name', color: '#1a120b', order: 2 })),
    { id: 'elementBadge', kind: 'image', source: 'visual.elementBadge', rect: circ(P('element')), order: 2 },
    Object.assign(txt('elementLabel', P('elementLabel'), 'title', { source: 'texts.elementLabel', color: '#f4ecd6', stroke: '#000000', order: 3 }))
  ];
  slotKeys.forEach((k, i) => {
    slots.push({ id: 'slot' + (i + 1) + 'Crest', kind: 'image', source: 'visual.slots[' + i + '].crest', rect: circ(P(k)), order: 2 });
    slots.push(Object.assign(txt('slot' + (i + 1) + 'Label', P(k + 'Label'), 'title', { source: 'visual.slots[' + i + '].name', color: '#efe6d2', stroke: '#000000', order: 3 })));
  });
  slots.push(
    Object.assign(txt('atk', Object.assign({ w: 140 }, P('atk')), 'num', { source: 'atk', color: '#ffffff', order: 3 })),
    Object.assign(txt('atkLabel', Object.assign({ w: 100 }, P('atkLabel')), 'title', { source: 'const:ATK', color: '#ffffff', order: 3 })),
    Object.assign(txt(king ? 'hp' : 'def', Object.assign({ w: 140 }, P('def')), 'num', { source: king ? 'hp' : 'def', color: '#ffffff', order: 3 })),
    Object.assign(txt(king ? 'hpLabel' : 'defLabel', Object.assign({ w: 100 }, P('defLabel')), 'title', { source: king ? 'const:HP' : 'const:DEF', color: '#ffffff', order: 3 })),
    { id: 'attackGrid', kind: 'image', source: 'visual.attackGrid', rect: gridRect(king ? R.kingBox(L) : P('attackGrid')), order: 2, note: 'Zusätzlich als Daten: attack.directions' + (king ? ' (Könige: ein mittiges Feld)' : '') },
    ...(king ? [] : [{ id: 'moveGrid', kind: 'image', source: 'visual.moveGrid', rect: gridRect(P('moveGrid')), order: 2, note: 'Zusätzlich als Daten: movement.directions' }]),
    Object.assign(txt('banner', P('banner'), 'title', { source: 'texts.banner', color: '#1d150d', order: 3 })),
    { id: 'giftsTitle', kind: 'text', source: 'texts.giftsTitle', rect: rect(P('giftsTitle').x, P('giftsTitle').y - P('giftsTitle').size * 0.68, 220, P('giftsTitle').size * 1.36), align: 'left', fontRole: 'title', fontSizeRel: r4(P('giftsTitle').size / H), color: '#f2ecdc', order: 3 }
  );
  (L.gifts || D4.gifts).forEach((g, i) => {
    const n = i + 1;
    slots.push(
      { id: 'gift' + n + 'Crest', kind: 'image', source: 'gifts[' + i + '].crest', rect: rect(g.crest.x, g.crest.y, g.crest.w, g.crest.h), order: 2 },
      { id: 'gift' + n + 'Title', kind: 'text', source: 'gifts[' + i + '].title', rect: rect(g.text.x, g.text.y, g.text.w, 29), align: 'left', fontRole: 'title', fontSizeRel: r4(26 / H), color: '#ffcf63', order: 3 },
      { id: 'gift' + n + 'Text', kind: 'text', source: 'gifts[' + i + '].short', rect: rect(g.text.x, g.text.y + 29, g.text.w, g.text.h - 33), align: 'left', wrap: true, fontRole: 'text', fontSizeRel: r4(21 / H), minFontSizeRel: r4(13 / H), color: '#ece5d3', order: 3 },
      { id: 'gift' + n + 'Ct', kind: 'box', source: 'gifts[' + i + ']', rect: rect(g.ct.x, g.ct.y, g.ct.w, g.ct.h), order: 2, note: 'kind=permanent: visual.permanentBox darüberlegen und „Permanent / Kein CT“ schreiben; sonst „CT“ und „<ct> Runden“' }
    );
  });
  const ra = P('rarity');
  slots.push(
    { id: 'rarityCrest', kind: 'image', source: 'visual.rarityCrest', rect: rect(ra.x - ra.size / 2, ra.y - ra.size / 2, ra.size, ra.size), order: 2 },
    Object.assign(txt('rarityLabel', P('rarityLabel'), 'title', { source: 'rarityName', color: '#f4f6ff', order: 3 }))
  );
  return { formatVersion: EXPORT_VERSION, id: (king ? 'king_v' : 'hero_v') + variant, cardType: king ? 'king' : 'hero', chambers: variant, reference: { w: W, h: H, aspect: '2:3' }, units: 'Anteile von Breite und Höhe der Karte (0 bis 1), Ursprung oben links', slots };
}

/* ---------- Paket bauen ---------- */
async function buildEnginePack(cards, P, progress) {
  const k = +P.scale || 1, L = G.layout, files = new Map(), assets = new Map(), report = [];
  const put = (path, data, kind, meta) => { files.set(path, data); if (kind) assets.set(path, Object.assign({ path, kind }, meta || {})); };
  const putJSON = (path, obj) => files.set(path, new TextEncoder().encode(JSON.stringify(obj, null, 2)));
  const putText = (path, txt) => files.set(path, new TextEncoder().encode(txt));
  const putCanvas = async (path, cv, kind, meta) => { if (files.has(path)) return path; const b = await canvasBlob(cv); const u8 = new Uint8Array(await b.arrayBuffer()); put(path, u8, kind, Object.assign({ w: cv.width, h: cv.height, bytes: u8.length, sha1: await sha1Hex(u8) }, meta || {})); return path; };
  const byHash = new Map();
  const putShared = async (dir, prefix, cv, kind, meta) => { const b = await canvasBlob(cv); const u8 = new Uint8Array(await b.arrayBuffer()); const h = await sha1Hex(u8); if (byHash.has(h)) return byHash.get(h); const path = dir + '/' + prefix + '_' + h.slice(0, 8) + '.png'; put(path, u8, kind, Object.assign({ w: cv.width, h: cv.height, bytes: u8.length, sha1: h }, meta || {})); byHash.set(h, path); return path; };
  const W = L.W, H = L.H, fonts = new Map(), templates = new Map(), out = [];
  const full = () => { const c = document.createElement('canvas'); c.width = W * k; c.height = H * k; return c; };
  const crestPath = async (key, dir) => { const im = G.crests[key]; if (!im) return ''; return putCanvas('assets/' + dir + '/' + exSlug(key) + '.png', imgCanvas(im), dir.slice(0, -1)); };
  let permBox = '';
  for (let i = 0; i < cards.length; i++) {
    const card = normalize(clone(cards[i])), cid = 'wok_' + exSlug(card.id || ('karte_' + i));
    progress && progress(i, cards.length, card.name || 'Ohne Namen');
    if (card.type === 'spell' || card.type === 'curse') { report.push({ id: cid, name: card.name || cid, errors: 0, warnings: 1, skipped: true, note: 'Zauber- und Fluchkarten sind im Engine-Paket (Format für Helden und Könige) nicht enthalten. Für das Probe-Spiel „Fürs Probe-Spiel exportieren“ nutzen.' }); continue; }
    const info = {};
    // Vorschau (vollständige Karte) – berechnet nebenbei Variante und Hinweise
    const pv = full(); const issues = await renderTo(pv, card, { placeholder: false, info });
    const king = card.type === 'king', variant = info.variant || 2, tid = (king ? 'king_v' : 'hero_v') + variant;
    if (!templates.has(tid)) templates.set(tid, exTemplate(variant, king));
    let crownPath = '';
    if (king) { const cc = full(); await renderTo(cc, card, { placeholder: false, layers: new Set(['crown']) }); const E0 = L.energy; crownPath = await putCanvas('assets/ui/crown.png', cropCanvas(cc, { x: E0.x - 60, y: E0.y - 56, w: 120, h: 112 }, k), 'ui'); }
    const preview = P.previews ? await putCanvas('previews/' + cid + '.png', pv, 'preview') : '';
    // Rahmen (geteilt je Gestaltung und Variante)
    const st = Object.assign({}, STYLE_DEFAULT, card.style || {});
    let fr = framesFor(st)[variant === 4 ? 3 : variant === 3 ? 2 : 1]; if (fr && king) fr = R.kingFrame(fr, L);
    let framePath = '';
    if (fr) { const fc = full(); fc.getContext('2d').drawImage(fr, 0, 0, fc.width, fc.height); framePath = await putCanvas('assets/frames/frame_' + (king ? 'king_' : '') + 'v' + variant + '_' + exSlug([st.theme, st.energy, st.atk, st.def, st.element].join('_')) + '.png', fc, 'frame', { variant }); }
    // Illustration im Bildfenster (wie auf der Karte zugeschnitten)
    const la = full(); await renderTo(la, card, { placeholder: false, layers: new Set(['art']) });
    const artPath = card.art && card.art.id ? await putCanvas('assets/art/' + cid + '.png', cropCanvas(la, L.window, k), 'art') : '';
    // Element-Abzeichen (geteilt), Raster (geteilt per Inhalt)
    const E = L.element, eb = full(); await renderTo(eb, card, { placeholder: false, layers: new Set(['elementCrest']) });
    const elIds = [card.element, card.element2].filter(Boolean);
    const elPath = elIds.length ? await putCanvas('assets/badges/element_' + elIds.map(exSlug).join('_') + '.png', cropCanvas(eb, { x: E.x - E.r, y: E.y - E.r, w: E.r * 2, h: E.r * 2 }, k), 'badge') : '';
    const gl = full(); await renderTo(gl, card, { placeholder: false, layers: new Set(['grids']) });
    const gr = g => ({ x: g.x - 8, y: g.titleY - 14, w: g.w + 22, h: g.y + g.h - (g.titleY - 14) + 8 });
    const atkGrid = await putShared('assets/grids', 'attack', cropCanvas(gl, gr(king ? R.kingBox(L) : L.attackGrid), k), 'grid');
    const movGrid = king ? '' : await putShared('assets/grids', 'move', cropCanvas(gl, gr(L.moveGrid), k), 'grid');
    // optional: alle Texte als transparente Ebene
    let textPath = '';
    if (P.textOverlay) { const tl = full(); await renderTo(tl, card, { placeholder: false, layers: new Set(TEXT_LAYERS) }); textPath = await putCanvas('assets/text/' + cid + '.png', tl, 'text'); }
    // Wappen (geteilt)
    const race = D.RACES.find(x => x.id === card.race), race2 = card.race2 && card.race2 !== card.race ? D.RACES.find(x => x.id === card.race2) : null;
    const cl = card.classes.map(id => D.CLASSES.find(x => x.id === id)).filter(Boolean);
    const slotItems = [race && ['race', race], race2 && ['race', race2], ...cl.map(c => ['class', c])].filter(Boolean);
    const slots = [];
    for (let j = 0; j < slotItems.length; j++) { const [kind, it] = slotItems[j]; slots.push({ slot: 'slot' + (j + 1), kind, id: it.id, name: it.name, crest: await crestPath(it.crest, 'crests') }); }
    const ra = D.RARITIES.find(x => x.id === card.rarity);
    const rarityCrest = ra ? await crestPath(ra.crest, 'crests') : '';
    const elems = elIds.map(id => D.ELEMENTS.find(x => x.id === id)).filter(Boolean);
    for (const e of elems) await crestPath(e.crest, 'crests'); // Einzelwappen zusätzlich, für eigene Darstellungen
    const gifts = [];
    for (const gs of card.gifts) {
      const g = (king ? (D.ROYAL_GIFTS || []) : D.GIFTS).find(x => x.id === gs.id); if (!g) continue;
      const im = G.giftCrests[g.id]; let crest = '';
      if (im) crest = await putCanvas('assets/gifts/' + exSlug(g.id) + '.png', imgCanvas(im), 'gift');
      if (g.kind === 'permanent' && !permBox) {
        const pc = full(); await renderTo(pc, Object.assign(clone(card), { gifts: [{ id: g.id }] }), { placeholder: false, layers: new Set(['giftCtBg']) });
        const C = (L.gifts || R.defaultLayout().gifts)[0].ct; permBox = await putCanvas('assets/ui/permanent_box.png', cropCanvas(pc, { x: C.x - 2, y: C.y - 2, w: C.w + 4, h: C.h + 4 }, k), 'ui');
      }
      const pts = g.royal ? PW.royalPts(g, gs) : PW.GIFT_PTS[g.id];
      gifts.push({ id: g.id, name: g.name, title: D.giftTitle(g), kind: g.kind, ct: g.ct || 0, cost: g.cost || g.ct || 0, role: g.role || '', short: D.giftShort(g, gs), royal: !!g.royal, scope: g.royal ? (gs.scope || 'all') : '', target: g.royal ? (gs.target || '') : '', amount: g.royal ? D.royalAmount(g, gs) : 0, stat: g.royal ? g.param.stat : '', text: g.text || '', powerPoints: pts === undefined ? 0 : pts, crest });
    }
    // Schriften
    const F = R.resolveFonts(st);
    for (const [role, f] of Object.entries(F)) { const e = fonts.get(f.family) || { family: f.family, roles: [], weights: [] }; if (!e.roles.includes(role)) e.roles.push(role); for (const w of f.w) if (!e.weights.includes(w)) e.weights.push(w); fonts.set(f.family, e); }
    // Spielwerte und Prüfung
    const ev = PW.evaluate(Object.assign({}, card, { rarity: null }));
    const val = validate(card, issues);
    const dirs = spec => Object.entries((spec || {}).dirs || {}).filter(([, v]) => v).map(([dir, v]) => ({ dir, length: v === true ? 1 : +v }));
    const doc = {
      formatVersion: EXPORT_VERSION, id: cid, sourceId: card.id || '', name: card.name || '', type: king ? 'king' : 'hero', hp: king ? +card.hp || 0 : 0, status: card.status || 'entwurf',
      updated: card.updated ? new Date(card.updated).toISOString() : '', released: card.released || '',
      rarity: card.rarity || '', rarityName: ra ? ra.name : '', energy: +card.energy || 0, atk: +card.atk || 0, def: +card.def || 0,
      elements: elems.map(e => ({ id: e.id, name: e.name, crest: 'assets/crests/' + exSlug(e.crest) + '.png' })),
      races: [race, race2].filter(Boolean).map(r => ({ id: r.id, name: r.name })),
      classes: cl.map(c => ({ id: c.id, name: c.name })),
      movement: { range: (card.move.showNumber && +card.move.number) || Math.max(0, ...dirs(card.move).map(d => d.length)), directions: dirs(card.move), showNumber: !!card.move.showNumber, number: +card.move.number || 0 },
      attack: { fields: dirs(card.attack).length, directions: dirs(card.attack), showNumber: !!card.attack.showNumber, number: +card.attack.number || 0 },
      gifts,
      power: { version: PW.SOURCE, base: ev.base, energyPoints: ev.energyPts, total: ev.total, giftLimit: PW.GIFT_LIMIT[card.rarity || ev.rarity] || 0, status: ev.status.map(x => x.text), breakdown: ev.rows.map(r => ({ label: r[0], points: r[1] === null ? 0 : +r[1] })) },
      template: tid,
      texts: { banner: slotItems.map(x => x[1].name).join(' / '), elementLabel: elems.map(e => e.name).join(' · '), giftsTitle: king ? 'Königliche Gaben:' : 'Gaben:', atkLabel: 'ATK', defLabel: king ? 'HP' : 'DEF' },
      visual: { crown: crownPath, frame: framePath, art: artPath, elementBadge: elPath, slots, attackGrid: atkGrid, moveGrid: movGrid, rarityCrest, permanentBox: gifts.some(g => g.kind === 'permanent') ? permBox : '', preview, textOverlay: textPath,
        artFit: card.art ? { sourceWidth: card.art.w || 0, sourceHeight: card.art.h || 0, fill: card.art.fill || 'blur' } : { sourceWidth: 0, sourceHeight: 0, fill: '' } },
      style: { theme: st.theme, nameStyle: st.name, fontSet: st.fontSet, gems: { energy: st.energy, atk: st.atk, def: st.def, element: st.element }, atkArrow: st.atkArrow, movArrow: st.movArrow,
        fonts: Object.entries(F).map(([role, f]) => ({ role, family: f.family, weights: f.w.slice() })) },
      validation: { errors: val.filter(v => v.level === 'error').map(v => v.text), warnings: val.filter(v => v.level === 'warn').map(v => v.text) }
    };
    putJSON('cards/' + cid + '.json', doc);
    out.push(doc);
    report.push({ id: cid, name: doc.name, errors: doc.validation.errors.length, warnings: doc.validation.warnings.length });
  }
  for (const [tid, t] of templates) putJSON('templates/' + tid + '.json', t);
  putJSON('cards/_alle_karten.json', { formatVersion: EXPORT_VERSION, cards: out });
  // Referenzprüfung: jede Bildreferenz muss im Paket liegen
  const missing = [];
  const check = (cid, p) => { if (p && !files.has(p)) missing.push(cid + ': ' + p); };
  for (const c of out) { const v = c.visual; [v.crown, v.frame, v.art, v.elementBadge, v.attackGrid, v.moveGrid, v.rarityCrest, v.permanentBox, v.preview, v.textOverlay].forEach(p => check(c.id, p)); v.slots.forEach(s => check(c.id, s.crest)); c.gifts.forEach(g => check(c.id, g.crest)); c.elements.forEach(e => check(c.id, e.crest)); }
  const target = ENGINE_TARGETS.find(t => t.id === P.target) || ENGINE_TARGETS[5];
  const manifest = {
    format: EXPORT_FORMAT, formatVersion: EXPORT_VERSION, target: { id: target.id, name: target.name },
    created: new Date().toISOString(), tool: { name: 'War of Kings Kartenwerkstatt', edition: window.WOK_DESKTOP ? 'PC' : 'Cloud' },
    powerScaling: PW.SOURCE, scale: k, canvas: { w: W * k, h: H * k, aspect: '2:3' },
    cards: out.map(c => ({ id: c.id, name: c.name, file: 'cards/' + c.id + '.json', rarity: c.rarity, status: c.status, template: c.template, errors: c.validation.errors.length })),
    templates: [...templates.keys()].map(t => 'templates/' + t + '.json'),
    assets: [...assets.values()].sort((a, b) => a.path < b.path ? -1 : 1),
    fonts: [...fonts.values()].map(f => Object.assign(f, { license: 'SIL Open Font License', source: 'https://fonts.google.com/specimen/' + f.family.replace(/ /g, '+') })),
    check: { missingReferences: missing, cardsWithErrors: report.filter(r => r.errors).length, cardsWithWarnings: report.filter(r => r.warnings).length },
    files: []
  };
  putJSON('schema/card.schema.json', CARD_SCHEMA); putJSON('schema/manifest.schema.json', MANIFEST_SCHEMA); putJSON('schema/template.schema.json', TEMPLATE_SCHEMA);
  addTargetExtras(target.id, out, [...templates.values()], manifest, putText, putJSON);
  putText('README.md', packReadme(target, manifest));
  manifest.files = [...files.keys(), 'manifest.json'].sort();
  putJSON('manifest.json', manifest);
  return { files, manifest, target };
}

/* ---------- Extras je Zielprogramm ---------- */
function addTargetExtras(tid, cards, templates, manifest, putText, putJSON) {
  const all = tid === 'generic';
  if (tid === 'unity' || all) {
    if (typeof unityTemplateFiles === 'function') unityTemplateFiles(templates, putText);
    else for (const t of templates) {
      putText('unity/' + t.id + '.uxml', '<ui:UXML xmlns:ui="UnityEngine.UIElements">\n  <!-- War of Kings Kartenvorlage ' + t.id + ' (aus der Kartenwerkstatt erzeugt). Inhalte setzt der Importer bzw. euer Code. -->\n  <ui:VisualElement name="wok-card" class="wok-card ' + t.id + '">\n'
        + t.slots.slice().sort((a, b) => a.order - b.order).map(s => s.kind === 'text' ? '    <ui:Label name="' + s.id + '" class="wok-slot wok-' + s.id + '" text="" />' : '    <ui:VisualElement name="' + s.id + '" class="wok-slot wok-' + s.id + '" />').join('\n') + '\n  </ui:VisualElement>\n</ui:UXML>\n');
      putText('unity/' + t.id + '.uss', '/* Positionen in Prozent der Kartengröße (aus templates/' + t.id + '.json). Kartengröße über .wok-card festlegen. */\n.wok-card { width: 360px; height: 540px; position: relative; }\n.wok-slot { position: absolute; -unity-background-scale-mode: stretch-to-fill; }\n'
        + t.slots.map(s => '.' + t.id + ' .wok-' + s.id + ' { left: ' + r4(s.rect.x * 100) + '%; top: ' + r4(s.rect.y * 100) + '%; width: ' + r4(s.rect.w * 100) + '%; height: ' + r4(s.rect.h * 100) + '%;' + (s.kind === 'text' ? ' -unity-text-align: ' + (s.align === 'left' ? 'upper-left' : 'middle-center') + '; color: ' + (s.color || '#ffffff') + ';' + (s.wrap ? ' white-space: normal;' : '') : '') + ' }').join('\n') + '\n');
    }
  }
  if (tid === 'unreal' || all) {
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const rows = [['---', 'Name', 'Status', 'Rarity', 'Energy', 'Atk', 'Def', 'Elements', 'Races', 'Classes', 'Gifts', 'MoveRange', 'MoveDirections', 'AttackDirections', 'PowerTotal', 'Template', 'ArtTexture', 'FrameTexture', 'PreviewTexture']];
    for (const c of cards) rows.push([c.id, c.name, c.status, c.rarity, c.energy, c.atk, c.def, c.elements.map(e => e.id).join('|'), c.races.map(e => e.id).join('|'), c.classes.map(e => e.id).join('|'), c.gifts.map(g => g.id).join('|'), c.movement.range, c.movement.directions.map(d => d.dir + d.length).join('|'), c.attack.directions.map(d => d.dir).join('|'), c.power.total, c.template, c.visual.art, c.visual.frame, c.visual.preview]);
    putText('unreal/WoK_Cards.csv', rows.map(r => r.map(esc).join(',')).join('\r\n') + '\r\n');
  }
  if (tid === 'gamemaker' || all) {
    putText('gamemaker/sprites.txt', '# Vorschlag für Sprite-Namen in GameMaker (Datei → Sprite)\n' + manifest.assets.map(a => 'spr_wok_' + exSlug(a.path.replace(/^assets\//, '').replace(/\.png$/, '')) + '\t' + a.path).join('\n') + '\n');
  }
  if (tid === 'godot' || all) {
    putText('godot/LIESMICH.txt', 'Ordner WoK_Kartenwerkstatt nach res://wok_cards/ kopieren. Karten mit FileAccess + JSON.parse_string aus cards/*.json lesen,\nBilder mit load("res://wok_cards/" + pfad) laden. Die Platzierung steht in templates/*.json (Anteile 0–1 der Kartengröße).\n');
  }
  if (tid === 'web' || all) {
    putText('web/cards.js', 'window.WOK_PACK = ' + JSON.stringify({ manifest: { format: manifest.format, formatVersion: manifest.formatVersion, fonts: manifest.fonts }, templates, cards }) + ';\n');
    putText('web/index.html', WEB_VIEWER);
  }
}
function packReadme(target, m) {
  const t = target.id;
  return '# War of Kings – Kartenpaket für ' + target.name + '\n\n'
    + 'Erstellt am ' + new Date(m.created).toLocaleString('de-DE') + ' mit der Kartenwerkstatt (' + m.tool.edition + '-Version). Format **' + m.format + '**, Version ' + m.formatVersion + '. ' + m.cards.length + (m.cards.length === 1 ? ' Karte' : ' Karten') + ', Power-Scaling: ' + m.powerScaling + '.\n\n'
    + '## Inhalt\n\n| Ordner/Datei | Inhalt |\n|---|---|\n| `manifest.json` | Übersicht: Ziel, Karten, alle Bilder mit Größe und Prüfsumme, Schriften, Prüfergebnis |\n| `cards/<id>.json` | Eine Datei je Karte: Werte, Texte, Gaben, Richtungen, Power-Scaling, Bildreferenzen |\n| `cards/_alle_karten.json` | Alle Karten in einer Datei (`{ "cards": [...] }`, für Unity JsonUtility geeignet) |\n| `templates/hero_v2/3/4.json` | Platzierung aller Bausteine in Anteilen (0–1) der Kartengröße; v2/v3/v4 = Anzahl Kammern links |\n| `assets/frames/` | Rahmen inkl. Edelsteinfarben, Bildfenster transparent (geteilt) |\n| `assets/art/` | Illustration je Karte, exakt wie im Bildfenster zugeschnitten |\n| `assets/crests/`, `assets/gifts/`, `assets/badges/` | Wappen, Gabenwappen und Element-Abzeichen (geteilt) |\n| `assets/grids/` | Angriffs- und Laufraster als Bild (geteilt, gleiche Muster nur einmal) |\n| `assets/ui/` | Wiederverwendbare UI-Teile, z. B. die Permanent-Box |\n| `previews/` | Fertige Kartenbilder als Rückfall und Vorschau |\n| `schema/` | JSON-Schemas zur automatischen Prüfung der Dateien |\n\n'
    + '## Karte zusammensetzen\n\n1. Kartengröße wählen (Seitenverhältnis 2:3).\n2. `template` der Karte laden. Jeder Eintrag in `slots` hat `rect` (x, y, w, h als Anteil) und `order` (0 = unten).\n3. `kind: image` → Bild aus `source` zeichnen; `kind: text` → Text aus `source` mit `fontRole`, `fontSizeRel` (× Kartenhöhe) und `color`.\n4. Gaben: `gifts[i]` füllt `gift<i+1>Crest/Title/Text/Ct`. Bei `kind: permanent` die Permanent-Box darüberlegen.\n5. Werte (Energie, ATK, DEF, Texte) immer aus den Daten anzeigen, nie aus dem Vorschaubild.\n\n'
    + '## Aktualisieren\n\nKarte in der Werkstatt ändern und erneut exportieren. Karten-IDs (`wok_…`) und Dateinamen bleiben gleich; Dateien werden überschrieben statt doppelt angelegt.\n\n'
    + (t === 'unity' ? '## Unity\n\n- Ordner `WoK_Kartenwerkstatt` nach `Assets/WoK/Kartenwerkstatt/` legen (in der PC-Version direkt als Exportziel einstellbar).\n- Bilder als **Sprite (2D and UI)**, ohne Kompression für Rahmen, Max Size 2048.\n- `unity/hero_v*.uxml/.uss`: Vorlagen für UI Toolkit (das Projekt nutzt UI Toolkit). Bilder per `style.backgroundImage` setzen, Texte über die Labels.\n- `cards/_alle_karten.json` lässt sich mit `JsonUtility.FromJson` lesen (keine `null`-Werte, nur Listen von Objekten).\n- Der automatische Importer (AssetPostprocessor, ScriptableObjects, Importprotokoll) folgt als nächster Schritt.\n\n' : '')
    + (t === 'unreal' ? '## Unreal\n\n`unreal/WoK_Cards.csv` als DataTable importieren (Zeilenname = Karten-ID). Texturen aus `assets/` importieren; Pfade stehen in den Spalten.\n\n' : '')
    + (t === 'gamemaker' ? '## GameMaker\n\n`gamemaker/sprites.txt` enthält Sprite-Namen für jede Bilddatei. JSON mit `json_parse` lesen.\n\n' : '')
    + (t === 'godot' ? '## Godot\n\nSiehe `godot/LIESMICH.txt`.\n\n' : '')
    + (t === 'web' || t === 'generic' ? '## Web\n\n`web/index.html` im Browser öffnen: Die Seite setzt jede Karte aus Bausteinen und Daten zusammen (Referenz-Umsetzung).\n\n' : '')
    + '## Schriften\n\n' + m.fonts.map(f => '- ' + f.family + ' (' + f.roles.join(', ') + '; Stärken ' + f.weights.join(', ') + ') – ' + f.license + ', ' + f.source).join('\n') + '\n\n'
    + '## Prüfung\n\n- Fehlende Bildreferenzen: ' + (m.check.missingReferences.length || 'keine') + '\n- Karten mit Fehlern: ' + m.check.cardsWithErrors + ', mit Hinweisen: ' + m.check.cardsWithWarnings + ' (Details je Karte unter `validation`).\n';
}

/* ---------- JSON-Schemas (Draft-07) ---------- */
const STR = { type: 'string' }, NUM = { type: 'number' }, INT = { type: 'integer' }, BOOL = { type: 'boolean' };
const IDNAME = { type: 'object', required: ['id', 'name'], properties: { id: STR, name: STR } };
const DIR = { type: 'object', required: ['dir', 'length'], properties: { dir: { enum: ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] }, length: INT } };
const CARD_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#', $id: 'wok-cardpack/card.schema.json', title: 'War of Kings Heldenkarte', type: 'object',
  required: ['formatVersion', 'id', 'name', 'type', 'rarity', 'energy', 'atk', 'def', 'elements', 'races', 'classes', 'movement', 'attack', 'gifts', 'power', 'template', 'visual'],
  properties: {
    formatVersion: { const: 1 }, id: { type: 'string', pattern: '^wok_[a-z0-9_]+$' }, sourceId: STR, name: STR, type: { enum: ['hero', 'king'] }, hp: INT, status: { enum: ['entwurf', 'freigegeben'] },
    updated: STR, released: STR, rarity: { enum: ['', 'gewoehnlich', 'ungewoehnlich', 'selten', 'legendaer'] }, rarityName: STR,
    energy: INT, atk: INT, def: INT,
    elements: { type: 'array', maxItems: 2, items: { type: 'object', required: ['id', 'name'], properties: { id: STR, name: STR, crest: STR } } },
    races: { type: 'array', maxItems: 2, items: IDNAME }, classes: { type: 'array', maxItems: 2, items: IDNAME },
    movement: { type: 'object', required: ['range', 'directions'], properties: { range: INT, directions: { type: 'array', items: DIR }, showNumber: BOOL, number: INT } },
    attack: { type: 'object', required: ['fields', 'directions'], properties: { fields: INT, directions: { type: 'array', items: DIR }, showNumber: BOOL, number: INT } },
    gifts: { type: 'array', maxItems: 3, items: { type: 'object', required: ['id', 'name', 'kind', 'short', 'text'], properties: { id: STR, name: STR, title: STR, kind: { enum: ['ct', 'permanent'] }, ct: INT, cost: INT, role: STR, short: STR, text: STR, powerPoints: NUM, crest: STR } } },
    power: { type: 'object', required: ['base', 'total'], properties: { version: STR, base: NUM, energyPoints: NUM, total: NUM, giftLimit: INT, status: { type: 'array', items: STR }, breakdown: { type: 'array', items: { type: 'object', properties: { label: STR, points: NUM } } } } },
    template: { type: 'string', pattern: '^(hero|king)_v[234]$' },
    texts: { type: 'object' },
    visual: { type: 'object', required: ['frame', 'art', 'slots', 'attackGrid', 'moveGrid'], properties: { frame: STR, art: STR, elementBadge: STR, slots: { type: 'array', items: { type: 'object', required: ['slot', 'kind', 'id', 'crest'], properties: { slot: STR, kind: { enum: ['race', 'class'] }, id: STR, name: STR, crest: STR } } }, attackGrid: STR, moveGrid: STR, rarityCrest: STR, permanentBox: STR, preview: STR, textOverlay: STR, artFit: { type: 'object' } } },
    style: { type: 'object' }, validation: { type: 'object', properties: { errors: { type: 'array', items: STR }, warnings: { type: 'array', items: STR } } }
  }
};
const MANIFEST_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#', $id: 'wok-cardpack/manifest.schema.json', title: 'War of Kings Kartenpaket', type: 'object',
  required: ['format', 'formatVersion', 'target', 'created', 'cards', 'templates', 'assets', 'check', 'files'],
  properties: {
    format: { const: 'wok-cardpack' }, formatVersion: { const: 1 }, target: { type: 'object', required: ['id', 'name'], properties: { id: { enum: ENGINE_TARGETS.map(t => t.id) }, name: STR } },
    created: STR, tool: { type: 'object' }, powerScaling: STR, scale: NUM, canvas: { type: 'object' },
    cards: { type: 'array', items: { type: 'object', required: ['id', 'file'], properties: { id: STR, name: STR, file: STR, rarity: STR, status: STR, template: STR, errors: INT } } },
    templates: { type: 'array', items: STR },
    assets: { type: 'array', items: { type: 'object', required: ['path', 'kind'], properties: { path: STR, kind: STR, w: INT, h: INT, bytes: INT, sha1: STR } } },
    fonts: { type: 'array' }, check: { type: 'object', required: ['missingReferences'], properties: { missingReferences: { type: 'array', maxItems: 0 } } }, files: { type: 'array', items: STR }
  }
};
const TEMPLATE_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#', $id: 'wok-cardpack/template.schema.json', title: 'War of Kings Kartenvorlage', type: 'object',
  required: ['formatVersion', 'id', 'slots'],
  properties: { formatVersion: { const: 1 }, id: STR, cardType: STR, chambers: INT, reference: { type: 'object' }, units: STR,
    slots: { type: 'array', items: { type: 'object', required: ['id', 'kind', 'rect'], properties: { id: STR, kind: { enum: ['image', 'text', 'box'] }, source: STR, order: INT,
      rect: { type: 'object', required: ['x', 'y', 'w', 'h'], properties: { x: NUM, y: NUM, w: NUM, h: NUM } } } } } }
};

/* ---------- Referenz-Viewer für Web/HTML ---------- */
const WEB_VIEWER = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WoK Kartenpaket · Viewer</title>
<style>body{margin:0;background:#0b0f16;color:#dfe5ee;font:15px system-ui,sans-serif}header{padding:14px 18px;border-bottom:1px solid #223}main{display:flex;flex-wrap:wrap;gap:18px;padding:18px}
.card{position:relative;width:300px;aspect-ratio:2/3;background:#07090b;container-type:inline-size;overflow:hidden;border-radius:4px}.slot{position:absolute;box-sizing:border-box}.slot img{width:100%;height:100%;display:block}
.txt{display:flex;align-items:center;justify-content:center;text-align:center;white-space:nowrap;line-height:1;font-weight:700}.txt.left{justify-content:flex-start;text-align:left}.txt.wrap{white-space:normal;align-items:flex-start;font-weight:500;line-height:1.14}
.perm{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f4eedc;font-weight:700;line-height:1.1}.pair{display:flex;gap:6px;align-items:flex-start}figcaption{font-size:12px;color:#8e9bb0;margin-top:4px}</style>
<script src="cards.js"><\/script></head><body><header><b>War of Kings · Kartenpaket</b> – jede Karte wird hier aus Bausteinen und Daten zusammengesetzt (links), rechts das Vorschaubild zum Vergleich.</header><main id="m"></main>
<script>
const P=window.WOK_PACK,T={};P.templates.forEach(t=>T[t.id]=t);
const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?'+P.manifest.fonts.map(f=>'family='+f.family.replace(/ /g,'+')).join('&')+'&display=swap';document.head.appendChild(link);
function get(c,src){if(src.startsWith('const:'))return src.slice(6);return src.replace(/\\[(\\d+)\\]/g,'.$1').split('.').reduce((o,k)=>o==null?o:o[k],c);}
function font(c,role){const f=(c.style.fonts||[]).find(x=>x.role===role);return f?'"'+f.family+'", Georgia, serif':'Georgia, serif';}
function build(c){const t=T[c.template],el=document.createElement('div');el.className='card';
 for(const s of t.slots.slice().sort((a,b)=>a.order-b.order)){const d=document.createElement('div');d.className='slot';const r=s.rect;Object.assign(d.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'});
  if(s.kind==='image'){const p=get(c,s.source);if(!p)continue;const i=new Image();i.src='../'+p;d.appendChild(i);}
  else if(s.kind==='text'){let v=get(c,s.source);if(v==null||v==='')continue;if(s.id==='energy'&&!v)continue;d.textContent=v;d.className+=' txt'+(s.align==='left'?' left':'')+(s.wrap?' wrap':'');d.style.color=s.color||'#fff';d.style.fontFamily=font(c,s.fontRole);d.style.fontSize=(s.fontSizeRel*150)+'cqi';if(s.stroke)d.style.textShadow='0 0 3px '+s.stroke+',0 0 2px '+s.stroke;}
  else if(s.kind==='box'){const g=get(c,s.source);if(!g)continue;if(g.kind==='permanent'&&c.visual.permanentBox){const i=new Image();i.src='../'+c.visual.permanentBox;d.appendChild(i);const q=document.createElement('div');q.className='perm';q.innerHTML='<span style="font-size:2.05cqi">Permanent</span><span style="font-size:1.76cqi;font-weight:600">Kein CT</span>';d.appendChild(q);}else{const q=document.createElement('div');q.className='perm';q.style.color='#fff';q.innerHTML='<span style="font-size:2.34cqi">CT</span><span style="font-size:2.15cqi">'+g.ct+(g.ct===1?' Runde':' Runden')+'</span>';d.appendChild(q);}}
  el.appendChild(d);}return el;}
function fit(root){root.querySelectorAll('.txt:not(.wrap)').forEach(d=>{let f=parseFloat(d.style.fontSize);for(let i=0;i<30&&d.scrollWidth>d.clientWidth+1;i++){f*=0.94;d.style.fontSize=f+'cqi';}});}
for(const c of P.cards){const f=document.createElement('figure');f.style.margin='0';const pr=document.createElement('div');pr.className='pair';pr.appendChild(build(c));if(c.visual.preview){const i=new Image();i.src='../'+c.visual.preview;i.style.width='300px';pr.appendChild(i);}f.appendChild(pr);const cap=document.createElement('figcaption');cap.textContent=c.name+' · '+c.rarityName+' · '+c.power.total+' Punkte · '+c.id;f.appendChild(cap);document.getElementById('m').appendChild(f);fit(f);}
document.fonts&&document.fonts.ready.then(()=>document.querySelectorAll('figure').forEach(fit));
<\/script></body></html>
`;

/* ---------- Dialog ---------- */
function engineExportDialog() {
  const p = G.ex || (G.ex = exLoadPrefs()), sc = libDlScopes();
  const n = { current: G.card ? 1 : 0, freigegeben: sc.freigegeben.length, alle: sc.alle.length, filter: sc.filter.length };
  const scopeOpt = (k, t) => '<label class="inline"><input type="radio" name="ex-scope" value="' + k + '" ' + (p.scope === k ? 'checked' : '') + ' ' + (n[k] ? '' : 'disabled') + '> ' + t + ' <span class="muted">(' + n[k] + ')</span></label>';
  showModal('Für Spiel-Engine exportieren', `<p style="font-size:13.5px">Wähle, <b>wofür</b> du exportierst. Das Ziel steht später im Paket, im Ordner- bzw. Dateinamen und in <code>manifest.json</code>.</p>
    <div class="ex-targets">${ENGINE_TARGETS.map(t => '<label class="ex-target"><input type="radio" name="ex-target" value="' + t.id + '" ' + (p.target === t.id ? 'checked' : '') + '><span><b>' + esc(t.name) + '</b><small>' + esc(t.note) + '</small></span></label>').join('')}</div>
    <div class="eyebrow" style="margin-top:10px">Inhalt</div>
    <div style="display:grid;gap:6px;margin-top:4px">${[['cards', 'Karten', 'die fertigen Karten wie bisher'], ['kit', 'Komplettes Asset-Set', 'alle Bausteine für jede mögliche Karte: Rahmen, Steinfarben, Wappen, Element-Abzeichen, Pfeile, UI, Katalog'], ['both', 'Beides', 'Karten und Asset-Set zusammen']].map(([k, t, d]) => '<label class="inline"><input type="radio" name="ex-what" value="' + k + '" ' + (p.what === k ? 'checked' : '') + '> <b>' + t + '</b> <span class="muted">– ' + d + '</span></label>').join('')}</div>
    <div id="ex-cardopts"><div class="eyebrow" style="margin-top:10px">Welche Karten</div>
    <div style="display:grid;gap:6px;margin-top:4px">${scopeOpt('current', 'Nur die geöffnete Karte')}${scopeOpt('freigegeben', 'Alle freigegebenen Karten')}${scopeOpt('alle', 'Alle Karten')}${scopeOpt('filter', 'Wie in der Bibliothek gefiltert')}</div></div>
    <label>Auflösung<select id="ex-scale"><option value="1" ${+p.scale === 1 ? 'selected' : ''}>Standard · Karte 1024 × 1536</option><option value="2" ${+p.scale === 2 ? 'selected' : ''}>Hoch · Karte 2048 × 3072</option></select></label>
    <div class="inline"><label><input type="checkbox" id="ex-prev" ${p.previews ? 'checked' : ''}> Fertige Kartenbilder als Vorschau mitliefern</label></div>
    <div class="inline"><label><input type="checkbox" id="ex-text" ${p.textOverlay ? 'checked' : ''}> Texte zusätzlich als Bildebene (für Programme ohne eigene Schriftdarstellung)</label></div>
    ${window.WOK_DESKTOP ? '<div id="ex-dest" class="muted" style="font-size:12.5px"></div><div class="inline"><button data-act="ex-pick">Zielordner wählen …</button><button data-act="ex-reset">Standardordner</button></div>' : '<p class="muted" style="font-size:12.5px">Das Paket kommt als ZIP-Datei. Darin liegt der Ordner <code>WoK_Kartenwerkstatt</code>.</p>'}
    <p id="ex-status" style="font-size:13px"></p>`,
    '<button data-act="close">Schließen</button><button class="gold" data-act="ex-go" id="ex-go">Exportieren</button>');
  $$('input[name=ex-target]').forEach(r => r.onchange = () => { p.target = r.value; exSavePrefs(p); exShowDest(); });
  const what = () => { const v = ($('input[name=ex-what]:checked') || {}).value || 'cards'; p.what = v; const o = $('#ex-cardopts'); o.style.opacity = v === 'kit' ? 0.45 : 1; o.querySelectorAll('input').forEach(i => { if (v === 'kit') i.dataset.kit = '1'; i.disabled = v === 'kit' || (n[i.value] === 0); }); exSavePrefs(p); };
  $$('input[name=ex-what]').forEach(r => r.onchange = what); what();
  exShowDest();
}
async function exShowDest() {
  const el = $('#ex-dest'); if (!el) return;
  const t = (G.ex && G.ex.target) || 'unity';
  try { const j = await (await fetch('/api/pack/where?target=' + t)).json(); el.innerHTML = 'Ziel für <b>' + esc((ENGINE_TARGETS.find(x => x.id === t) || {}).name || t) + '</b>: ' + esc(j.dir) + (j.custom ? ' <span style="color:var(--ok)">(eigener Ordner)</span>' : ''); }
  catch (e) { el.textContent = ''; }
}
async function exPickFolder() {
  const t = G.ex.target; $('#ex-status').textContent = 'Ordnerauswahl ist geöffnet …';
  try {
    const r = await fetch('/api/pack/pick?target=' + t, { method: 'POST' }); const j = await r.json().catch(() => ({}));
    $('#ex-status').textContent = r.ok ? (j.dir ? 'Gespeichert: Exporte für ' + ((ENGINE_TARGETS.find(x => x.id === t) || {}).name || t) + ' gehen künftig nach ' + j.dir : 'Keine Änderung.') : (j.message || 'Ordnerauswahl nicht möglich.');
  } catch (e) { $('#ex-status').textContent = 'Ordnerauswahl nicht möglich.'; }
  exShowDest();
}
async function exResetFolder() { await fetch('/api/pack/pick?target=' + G.ex.target + '&reset=1', { method: 'POST' }).catch(() => {}); exShowDest(); }
async function engineExportRun() {
  if (G.exBusy) return;
  const p = G.ex; p.what = ($('input[name=ex-what]:checked') || {}).value || 'cards';
  p.scope = ($('input[name=ex-scope]:checked') || {}).value || p.scope || 'current'; p.scale = +$('#ex-scale').value; p.previews = $('#ex-prev').checked; p.textOverlay = $('#ex-text').checked; exSavePrefs(p);
  const wantCards = p.what !== 'kit', wantKit = p.what !== 'cards';
  const sc = libDlScopes(), list = !wantCards ? [] : p.scope === 'current' ? (G.card ? [Object.assign(clone(G.card), { id: G.cardId || G.card.id || 'neu' })] : []) : (sc[p.scope] || []);
  const st = $('#ex-status'); if (wantCards && !list.length) { st.textContent = 'Keine Karten in dieser Auswahl.'; return; }
  if (wantCards && p.scope === 'current' && G.dirty) toast('Hinweis: Exportiert wird der aktuelle Stand im Editor, auch ungespeicherte Änderungen.', 5000);
  G.exBusy = true; const go = $('#ex-go'); go.disabled = true;
  try {
    const packs = [];
    if (wantCards) { const pk = await buildEnginePack(list, p, (i, n, name) => { st.textContent = 'Karte ' + (i + 1) + ' von ' + n + ': ' + name + ' …'; }); packs.push({ kind: 'cards', root: PACK_ROOT, files: pk.files, target: pk.target, sum: pk.manifest.cards.length + (pk.manifest.cards.length === 1 ? ' Karte' : ' Karten') + ', ' + pk.manifest.assets.length + ' Bilder' + (pk.manifest.check.missingReferences.length ? ', ' + pk.manifest.check.missingReferences.length + ' fehlende Referenzen!' : '') + (pk.manifest.check.cardsWithErrors ? ', ' + pk.manifest.check.cardsWithErrors + ' mit Fehlern (siehe validation)' : '') }); }
    if (wantKit) { const kt = await buildAssetKit(p, t => { st.textContent = 'Asset-Set: ' + t; }); packs.push({ kind: 'kit', root: KIT_ROOT, files: kt.files, target: kt.target, sum: 'Asset-Set mit ' + kt.manifest.assets.length + ' Bildern' + (kt.manifest.check.missingReferences.length ? ', ' + kt.manifest.check.missingReferences.length + ' fehlende Referenzen!' : '') }); }
    const target = packs[0].target, label = target.name, sum = packs.map(x => x.sum).join(' · ');
    if (window.WOK_DESKTOP) {
      const total = packs.reduce((a, x) => a + x.files.size, 0); let k = 0;
      for (const pk of packs) {
        for (const [path, data] of pk.files) {
          const r = await fetch('/api/pack/file?target=' + target.id + '&pack=' + pk.kind + '&path=' + encodeURIComponent(path), { method: 'POST', body: data });
          if (!r.ok) throw new Error(path + ': ' + r.status);
          if (++k % 10 === 0) st.textContent = 'Dateien werden geschrieben … ' + k + ' / ' + total;
        }
        if (pk.kind === 'kit' || p.scope === 'alle') await fetch('/api/pack/clean?target=' + target.id + '&pack=' + pk.kind, { method: 'POST', body: JSON.stringify([...pk.files.keys()]) }).catch(() => {});
      }
      const j = await (await fetch('/api/pack/where?target=' + target.id)).json().catch(() => ({}));
      st.innerHTML = '✓ Für <b>' + esc(label) + '</b> exportiert: ' + esc(sum) + '<br><span class="muted">' + esc(packs.map(x => (j.dir || '') + '\\' + x.root).join(' · ')) + '</span>';
      fetch('/api/pack/open?target=' + target.id + '&pack=' + packs[0].kind, { method: 'POST' }).catch(() => {});
    } else {
      st.textContent = 'ZIP wird gepackt …';
      const entries = []; for (const pk of packs) for (const [name, data] of pk.files) entries.push({ name: pk.root + '/' + name, data });
      const zip = makeZip(entries);
      const nw = new Date(), z = n => String(n).padStart(2, '0');
      const fname = (p.what === 'kit' ? 'WoK_AssetSet_' : p.what === 'both' ? 'WoK_Karten_und_AssetSet_' : 'WoK_Kartenpaket_') + exSlug(label).replace(/_/g, '-') + '_' + nw.getFullYear() + '-' + z(nw.getMonth() + 1) + '-' + z(nw.getDate()) + '.zip';
      const ok = await saveFile(fname, zip);
      st.innerHTML = ok ? '✓ Für <b>' + esc(label) + '</b> exportiert: ' + esc(sum) + ' · ' + (zip.size / 1048576).toFixed(1).replace('.', ',') + ' MB<br><span class="muted">' + esc(fname) + '</span>' : 'Speichern abgebrochen.';
    }
  } catch (e) { console.error(e); st.textContent = 'Export fehlgeschlagen: ' + (e && e.message || e); }
  finally { G.exBusy = false; const b = $('#ex-go'); if (b) b.disabled = false; }
}
