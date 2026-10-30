'use strict';
/* ================= Komplettes Asset-Set („wok-assetkit“, Formatversion 1) =================
 * Zusätzlich zum Kartenpaket: ALLE Bausteine, aus denen sich jede Karte zusammensetzen lässt –
 * unabhängig davon, welche Karten es schon gibt. Für Programmierer, die Karten selbst im Spiel bauen.
 *   frames/<rahmen>/frame_v2|v3|v4.png   Rahmen je Design, Steine im Original
 *   gems/<feld>/<stein>.png              Stein-Überlagerungen (Energie, ATK, DEF, Element) mit Position
 *   crests/races|classes|elements|rarities/<id>.png · gifts/<id>.png
 *   badges/elements/<e>.png, <e1>__<e2>.png   Element-Abzeichen einzeln und geteilt (Reihenfolge zählt)
 *   grids/<attack|move>/…                Rastertitel je Schriftsatz, Mittelpunkt, Pfeile je Farbe/Richtung/Länge, Zahlenkreis
 *   ui/ · templates/ · catalog.json · manifest.json · schema/ · README.md · Extras je Zielprogramm
 * Kein Teil davon verändert Regeln: Texte, Punkte und Grenzen kommen 1:1 aus der Werkstatt.
 */
const KIT_FORMAT = 'wok-assetkit', KIT_VERSION = 1, KIT_ROOT = 'WoK_AssetSet';
const KIT_FIELDS = ['energy', 'atk', 'def', 'element'];
const KIT_ARROWS = () => [['standard_angriff', 'Standard Angriff', STYLE_DEFAULT.atkArrow], ['standard_lauf', 'Standard Lauf', STYLE_DEFAULT.movArrow]]
  .concat(ARROW_COLORS.map(([n, hex]) => [exSlug(n), n, hex]));

async function buildAssetKit(P, progress) {
  const k = +P.scale || 1, L = G.layout, W = L.W, H = L.H, files = new Map(), assets = [];
  const say = t => progress && progress(t);
  const putJSON = (path, obj) => files.set(path, new TextEncoder().encode(JSON.stringify(obj, null, 2)));
  const putText = (path, txt) => files.set(path, new TextEncoder().encode(txt));
  const putCanvas = async (path, cv, kind, meta) => {
    const b = await canvasBlob(cv), u8 = new Uint8Array(await b.arrayBuffer());
    files.set(path, u8); assets.push(Object.assign({ path, kind, w: cv.width, h: cv.height, bytes: u8.length, sha1: await sha1Hex(u8) }, meta || {})); return path;
  };
  const full = () => { const c = document.createElement('canvas'); c.width = W * k; c.height = H * k; return c; };
  const rel = r => ({ x: r4(r.x / W), y: r4(r.y / H), w: r4(r.w / W), h: r4(r.h / H) });
  const px = r => ({ x: Math.round(r.x * k), y: Math.round(r.y * k), w: Math.round(r.w * k), h: Math.round(r.h * k) });
  const tick = () => new Promise(r => setTimeout(r, 0));
  const variants = [[1, 2], [2, 3], [3, 4]].filter(([i]) => G.frames[i]);

  /* 1. Rahmen je Design (Steine im Original) */
  const themes = [];
  for (const [tk, t] of Object.entries(R.THEMES)) {
    say('Rahmen ' + t.name + ' …'); await tick();
    const fr = {};
    for (const [i, v] of variants) {
      const sf = R.styleFrame(G.frames[i], L, Object.assign({}, STYLE_DEFAULT, { theme: tk }));
      const c = full(); c.getContext('2d').drawImage(sf, 0, 0, c.width, c.height);
      fr['v' + v] = await putCanvas('frames/' + tk + '/frame_v' + v + '.png', c, 'frame', { theme: tk, variant: v });
      const kc = full(); kc.getContext('2d').drawImage(R.kingFrame(sf, L), 0, 0, kc.width, kc.height);
      fr['king_v' + v] = await putCanvas('frames/' + tk + '/frame_king_v' + v + '.png', kc, 'frame', { theme: tk, variant: v, cardType: 'king' });
    }
    themes.push({ id: tk, name: t.name, frames: fr });
  }

  /* 2. Stein-Überlagerungen: färben nie mit dem Rahmen-Design mit, deshalb für jedes Design gültig */
  const gems = [], regions = {};
  for (const [i, v] of variants) regions[v] = R.gemRegions(G.frames[i], L);
  const sxF = G.frames[variants[0][0]].width / W; // Pixel des Rahmens je Referenz-Pixel
  for (const [gk, gm] of Object.entries(R.GEMS)) {
    const entry = { id: gk, name: gm.name, swatch: gm.swatch || [], overlays: [] };
    gems.push(entry);
    if (gk === 'original') continue; // Original = Rahmen ohne Überlagerung
    say('Stein ' + gm.name + ' …'); await tick();
    for (const f of KIT_FIELDS) {
      const per = [];
      for (const [i, v] of variants) {
        const rg = regions[v][f], sf = R.styleFrame(G.frames[i], L, Object.assign({}, STYLE_DEFAULT, { [f]: gk }));
        const c = document.createElement('canvas'); c.width = rg.w; c.height = rg.h;
        const g = c.getContext('2d'); g.drawImage(sf, rg.x, rg.y, rg.w, rg.h, 0, 0, rg.w, rg.h);
        const id = g.getImageData(0, 0, rg.w, rg.h); for (let j = 0; j < rg.alpha.length; j++) if (!rg.alpha[j]) id.data[j * 4 + 3] = 0;
        g.putImageData(id, 0, 0);
        const out = document.createElement('canvas'); out.width = Math.round(rg.w / sxF * k); out.height = Math.round(rg.h / sxF * k);
        out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
        const b = new Uint8Array(await (await canvasBlob(out)).arrayBuffer());
        per.push({ v, out, rect: { x: rg.x / sxF, y: rg.y / sxF, w: rg.w / sxF, h: rg.h / sxF }, hash: await sha1Hex(b) });
      }
      const same = per.every(p => p.hash === per[0].hash && p.rect.x === per[0].rect.x && p.rect.y === per[0].rect.y);
      for (const p of (same ? [per[0]] : per)) {
        const path = 'gems/' + f + '/' + gk + (same ? '' : '_v' + p.v) + '.png';
        await putCanvas(path, p.out, 'gem', { field: f, gem: gk });
        entry.overlays.push({ field: f, variants: same ? per.map(q => q.v) : [p.v], path, rect: rel(p.rect), rectPx: px(p.rect) });
      }
    }
  }

  /* 3. Wappen */
  say('Wappen …'); await tick();
  const crest = async (cat, item, kind) => { const im = G.crests[item.crest]; return im ? putCanvas('crests/' + cat + '/' + exSlug(item.id) + '.png', imgCanvas(im), kind || 'crest', { group: cat, id: item.id }) : ''; };
  const races = [], classes = [], elements = [], rarities = [], gifts = [];
  for (const r of D.RACES) races.push({ id: r.id, name: r.name, crest: await crest('races', r), crestStatus: r.crestStatus || '' });
  for (const c of D.CLASSES) classes.push({ id: c.id, name: c.name, crest: await crest('classes', c), crestStatus: c.crestStatus || '' });
  for (const e of D.ELEMENTS) elements.push({ id: e.id, name: e.name, crest: await crest('elements', e), badge: '' });
  const band = id => PW.BANDS.find(b => b.id === id) || {};
  for (const r of D.RARITIES) { const b = band(r.id); rarities.push({ id: r.id, name: r.name, crest: await crest('rarities', r), points: { from: b.lo, to: b.hi }, energy: b.energy || [] }); }
  for (const g of D.GIFTS) {
    const im = G.giftCrests[g.id], pts = PW.GIFT_PTS[g.id];
    gifts.push({ id: g.id, name: g.name, title: D.giftTitle(g), kind: g.kind, ct: g.ct || 0, cost: g.cost || g.ct || 0, role: g.role || '', short: D.giftShort(g), text: g.text || '',
      powerPoints: pts === undefined ? 0 : pts, crest: im ? await putCanvas('gifts/' + exSlug(g.id) + '.png', imgCanvas(im), 'gift', { id: g.id }) : '' });
  }

  const royalGifts = [];
  for (const g of (D.ROYAL_GIFTS || [])) {
    const im = G.giftCrests[g.id];
    royalGifts.push({ id: g.id, name: g.name, kind: g.kind, text: g.text, stat: g.param.stat, amount: { min: g.param.min, max: g.param.max, step: g.param.step, default: g.param.def }, scopes: ['all', 'race', 'class', 'element'],
      points: { maxPerGift: 110 / 3, scopeFactor: PW.ROYAL_SCOPE_FACTOR, formula: 'maxPerGift × (0,35 + 0,65 × ((amount − min)/(max − min))^1,2) × scopeFactor × (CT ? 0,85 : 1)', exampleAtDefault: PW.royalPts(g, { amount: g.param.def, scope: 'all' }) },
      crest: im ? await putCanvas('gifts/royal/' + exSlug(g.id) + '.png', imgCanvas(im), 'gift', { id: g.id, royal: true }) : '' });
  }
  /* 4. Element-Abzeichen: einzeln und geteilt (erstes Element unten links, zweites oben rechts) */
  say('Element-Abzeichen …'); await tick();
  const E = L.element, er = { x: E.x - E.r, y: E.y - E.r, w: E.r * 2, h: E.r * 2 }, pairs = [];
  const badge = async (e1, e2) => {
    const c = full(); await renderTo(c, Object.assign(blankCard(), { element: e1, element2: e2 || null }), { placeholder: false, layers: new Set(['elementCrest']) });
    return putCanvas('badges/elements/' + exSlug(e1) + (e2 ? '__' + exSlug(e2) : '') + '.png', cropCanvas(c, er, k), 'badge', { elements: [e1, e2].filter(Boolean) });
  };
  for (const e of elements) e.badge = await badge(e.id);
  for (const a of D.ELEMENTS) for (const b of D.ELEMENTS) if (a.id !== b.id) pairs.push({ elements: [a.id, b.id], badge: await badge(a.id, b.id) });

  /* 5. Raster: Titel, Mittelpunkt, Pfeile, Zahlenkreis – alle Teile haben dieselbe Größe und liegen genau übereinander */
  const arrowColors = KIT_ARROWS().map(([id, name, hex]) => ({ id, name, hex }));
  const gr = g => ({ x: g.x - 8, y: g.titleY - 14, w: g.w + 22, h: g.y + g.h - (g.titleY - 14) + 8 });
  const grids = {};
  for (const [kind, key, styleKey, specKey] of [['attack', 'attackGrid', 'atkArrow', 'attack'], ['move', 'moveGrid', 'movArrow', 'move']]) {
    const GR = L[key], rect = gr(GR), part = async (path, card, parts, meta) => {
      const c = full(); await renderTo(c, card, { placeholder: false, layers: new Set(['grids']), gridOnly: kind, gridParts: new Set(parts) });
      return putCanvas(path, cropCanvas(c, rect, k), 'grid', Object.assign({ grid: kind }, meta || {}));
    };
    const info = { rect: rel(rect), rectPx: px(rect), order: ['title', 'arrows', 'center', 'number'], titles: {}, center: '', arrows: [], numbers: {},
      numberText: { x: r4((GR.x + GR.w - 15 - rect.x) / rect.w), y: r4((GR.y + 15 - rect.y) / rect.h), fontRole: 'num', fontSizeRel: r4(19 / rect.h), color: '#ffffff', note: 'Ziffer mittig auf den Zahlenkreis schreiben' } };
    say('Raster ' + (kind === 'attack' ? 'Angriff' : 'Lauf') + ' …'); await tick();
    for (const fs of Object.keys(R.FONT_SETS)) info.titles[fs] = await part('grids/' + kind + '/title_' + fs + '.png', Object.assign(blankCard(), { style: Object.assign({}, STYLE_DEFAULT, { fontSet: fs }) }), ['title'], { fontSet: fs });
    info.center = await part('grids/' + kind + '/center.png', blankCard(), ['dot']);
    for (const col of arrowColors) {
      say('Pfeile ' + (kind === 'attack' ? 'Angriff' : 'Lauf') + ' · ' + col.name + ' …'); await tick();
      const st = Object.assign({}, STYLE_DEFAULT, { [styleKey]: col.hex });
      info.numbers[col.id] = await part('grids/' + kind + '/number_' + col.id + '.png', Object.assign(blankCard(), { style: st, [specKey]: { dirs: {}, showNumber: true, number: 1 } }), ['number'], { color: col.id });
      for (const dir of Object.keys(R.DIRS)) for (const n of [1, 2, 3]) {
        const path = await part('grids/' + kind + '/arrows/' + col.id + '/' + dir + '_' + n + '.png', Object.assign(blankCard(), { style: st, [specKey]: { dirs: { [dir]: n }, showNumber: false, number: 1 } }), ['arrows'], { color: col.id, dir, length: n });
        info.arrows.push({ color: col.id, dir, length: n, path });
      }
    }
    grids[kind] = info;
  }

  /* 6. UI-Teile */
  say('UI-Teile …'); await tick();
  const perm = D.GIFTS.find(g => g.kind === 'permanent'), ui = {};
  if (perm) {
    const C = (L.gifts || R.defaultLayout().gifts)[0].ct, pc = full();
    await renderTo(pc, Object.assign(blankCard(), { gifts: [{ id: perm.id }] }), { placeholder: false, layers: new Set(['giftCtBg']) });
    ui.permanentBox = { path: await putCanvas('ui/permanent_box.png', cropCanvas(pc, { x: C.x - 2, y: C.y - 2, w: C.w + 4, h: C.h + 4 }, k), 'ui'), note: 'Über das CT-Feld einer permanenten Gabe legen, darauf „Permanent“ und „Kein CT“ schreiben' };
  }

  { // Königskrone (statt Energiekosten auf Königskarten)
    const cc = full(), E0 = L.energy; await renderTo(cc, Object.assign(blankCard(), { type: 'king' }), { placeholder: false, layers: new Set(['crown']) });
    ui.crown = { path: await putCanvas('ui/crown.png', cropCanvas(cc, { x: E0.x - 60, y: E0.y - 56, w: 120, h: 112 }, k), 'ui'), note: 'Königskarten: Krone an der Stelle der Energiekosten (Vorlage king_v*: Slot crown)' };
  }
  /* 7. Vorlagen, Katalog, Schemas, Extras */
  const templates = variants.map(([, v]) => exTemplate(v)).concat(variants.map(([, v]) => exTemplate(v, true)));  // Helden- und Königsvorlagen
  for (const t of templates) putJSON('templates/' + t.id + '.json', t);
  const plain = o => JSON.parse(JSON.stringify(o));
  const catalog = {
    formatVersion: KIT_VERSION, units: 'rect: Anteile (0–1) der Kartengröße, Ursprung oben links; rectPx: Pixel bei der exportierten Auflösung',
    canvas: { w: W * k, h: H * k, aspect: '2:3' },
    composeOrder: ['art (Bildfenster templates.slots.art)', 'frames/<design>/frame_v<2|3|4>', 'gems/<feld>/<stein> je Feld (nur wenn nicht Original)', 'badges/elements', 'crests (Rasse/Klasse in den Kammern, Seltenheit)', 'grids: title → arrows → center → number', 'gifts + ui/permanent_box', 'Texte aus den Kartendaten'],
    themes, gems, races, classes, elements, elementPairs: pairs, rarities, gifts, royalGifts, arrowColors,
    directions: Object.entries(R.DIRS).map(([id, [dx, dy]]) => ({ id, dx, dy })),
    grids, ui,
    templates: templates.map(t => 'templates/' + t.id + '.json'),
    variants: { v2: 'zwei Kammern (Rasse, Klasse)', v3: 'drei Kammern', v4: 'vier Kammern (zwei Rassen oder zwei Klassen)' },
    fontSets: Object.entries(R.FONT_SETS).map(([id, s]) => ({ id, name: s.name, fonts: Object.entries(R.resolveFonts({ fontSet: id })).map(([role, f]) => ({ role, family: f.family, weights: f.w.slice() })) })),
    nameStyles: Object.entries(R.NAME_STYLES).map(([id, s]) => ({ id, name: s.name })),
    king: { atk: PW.KING.atk, hp: PW.KING.hp, attackDirections: PW.KING.dirs, royalGifts: PW.KING.gifts, hpPoints: PW.KING_HP_TABLE.map(([v, q]) => ({ hp: v, points: q })), royalGiftList: plain(D.ROYAL_GIFTS || []), note: 'Könige: keine Energie, keine DEF, kein Laufen. HP-Punkte sind ein Werkstatt-Entwurf.' },
    limits: { statMax: PW.STAT_MAX, energy: [0, 10], moveSteps: [1, 3], gifts: 3, elements: 2, races: 2, classes: 2 },
    powerScaling: { version: PW.VERSION, source: PW.SOURCE, statMax: PW.STAT_MAX, statTable: PW.STAT_TABLE.map(([v, p]) => ({ value: v, points: p })), energyPoints: plain(PW.ENERGY_PTS),
      bands: PW.BANDS.map((b, i) => { const nx = PW.BANDS[i + 1]; return nx ? { id: b.id, from: b.lo, [nx.above ? 'upTo' : 'below']: nx.lo } : { id: b.id, [b.above ? 'above' : 'from']: b.lo }; }), balanceWarningAt: PW.WARN_AT, giftLimit: plain(PW.GIFT_LIMIT),
      moveStepPoints: plain(PW.MOVE_PTS), moveDirectionPoints: plain(PW.MOVE_DIR_PTS), attackFieldPoints: plain(PW.FIELD_PTS), giftPoints: plain(PW.GIFT_PTS), giftCountPoints: plain(PW.COUNT_PTS),
      harmony: { confirmed: PW.HARMONY_CONFIRMED, max: PW.HARMONY_MAX, note: 'Noch keine bestätigte Grundlage: wird mit 0 gerechnet und als ungeprüft gekennzeichnet. Liste = Werkstatt-Vorschlag.', proposals: PW.HARMONY.map(h => ({ a: h[0], b: h[1], points: h[2], reason: h[3] || '' })) },
      synergy: PW.SYNERGY.map(s => ({ points: s[0], label: s[1] })), statusMessages: plain(PW.STATUS),
      formula: 'Gesamt-Power = ATK-Power + DEF-Power + Energie-Power + Laufrichtungen×2 + Angriffsfelder×2 + Laufschritte (1→2, 2→8, 3→16) + Gaben + Gabenanzahlbonus + Gaben-Harmonie + Sonder-Synergie' }
  };
  putJSON('catalog.json', catalog);
  const target = ENGINE_TARGETS.find(t => t.id === P.target) || ENGINE_TARGETS[5];
  // Referenzprüfung
  const missing = [], chk = (p, what) => { if (p && !files.has(p)) missing.push(what + ': ' + p); };
  themes.forEach(t => Object.values(t.frames).forEach(p => chk(p, 'Rahmen ' + t.id)));
  gems.forEach(g => g.overlays.forEach(o => chk(o.path, 'Stein ' + g.id)));
  [...races, ...classes, ...elements, ...rarities, ...gifts].forEach(x => chk(x.crest, x.id)); elements.forEach(e => chk(e.badge, e.id)); pairs.forEach(p => chk(p.badge, p.elements.join('+')));
  Object.values(grids).forEach(g => { Object.values(g.titles).forEach(p => chk(p, 'Titel')); chk(g.center, 'Mitte'); g.arrows.forEach(a => chk(a.path, 'Pfeil')); Object.values(g.numbers).forEach(p => chk(p, 'Zahl')); });
  const empty = [...races, ...classes, ...elements, ...rarities, ...gifts].filter(x => !x.crest).map(x => x.id);
  const count = {}; assets.forEach(a => count[a.kind] = (count[a.kind] || 0) + 1);
  const manifest = {
    format: KIT_FORMAT, formatVersion: KIT_VERSION, target: { id: target.id, name: target.name }, created: new Date().toISOString(),
    tool: { name: 'War of Kings Kartenwerkstatt', edition: window.WOK_DESKTOP ? 'PC' : 'Cloud' }, powerScaling: PW.SOURCE, scale: k, canvas: { w: W * k, h: H * k, aspect: '2:3' },
    counts: count, catalog: 'catalog.json', templates: catalog.templates,
    assets: assets.slice().sort((a, b) => a.path < b.path ? -1 : 1),
    check: { missingReferences: missing, withoutCrest: empty }, files: []
  };
  putJSON('schema/assetkit.schema.json', KIT_MANIFEST_SCHEMA); putJSON('schema/catalog.schema.json', KIT_CATALOG_SCHEMA); putJSON('schema/template.schema.json', TEMPLATE_SCHEMA);
  kitTargetExtras(target.id, catalog, templates, manifest, putText);
  putText('README.md', kitReadme(target, manifest, catalog));
  manifest.files = [...files.keys(), 'manifest.json'].sort();
  putJSON('manifest.json', manifest);
  return { files, manifest, target, catalog };
}

function kitTargetExtras(tid, cat, templates, manifest, putText) {
  const all = tid === 'generic', pct = v => r4(v * 100) + '%';
  if (tid === 'unity' || all) {
    unityTemplateFiles(templates, putText);
    // Ebenen für eigene Kartenbauer: Stein-Überlagerungen und Rasterteile
    const ov = {}; cat.gems.forEach(g => g.overlays.forEach(o => { if (!ov[o.field]) ov[o.field] = o.rect; }));
    putText('unity/wok_layers.uss', '/* Positionen der Ebenen aus catalog.json, in Prozent der Kartengröße. Elternelement: .wok-card */\n'
      + Object.entries(ov).map(([f, r]) => '.wok-gem-' + f + ' { position: absolute; left: ' + pct(r.x) + '; top: ' + pct(r.y) + '; width: ' + pct(r.w) + '; height: ' + pct(r.h) + '; }').join('\n') + '\n'
      + Object.entries(cat.grids).map(([k, g]) => '.wok-grid-' + k + ' { position: absolute; left: ' + pct(g.rect.x) + '; top: ' + pct(g.rect.y) + '; width: ' + pct(g.rect.w) + '; height: ' + pct(g.rect.h) + '; }').join('\n') + '\n');
  }
  if (tid === 'unreal' || all) {
    const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
    const rows = [['---', 'Path', 'Kind', 'Width', 'Height', 'Info']];
    manifest.assets.forEach(a => rows.push([exSlug(a.path.replace(/\.png$/, '')), a.path, a.kind, a.w, a.h, [a.theme, a.variant && 'v' + a.variant, a.field, a.gem, a.group, a.id, a.grid, a.color, a.dir, a.length, a.fontSet].filter(x => x !== undefined && x !== '').join('|')]));
    putText('unreal/WoK_Assets.csv', rows.map(r => r.map(esc).join(',')).join('\r\n') + '\r\n');
  }
  if (tid === 'gamemaker' || all) putText('gamemaker/sprites.txt', '# Vorschlag für Sprite-Namen in GameMaker\n' + manifest.assets.map(a => 'spr_wok_' + exSlug(a.path.replace(/\.png$/, '')) + '\t' + a.path).join('\n') + '\n');
  if (tid === 'godot' || all) putText('godot/LIESMICH.txt', 'Ordner WoK_AssetSet nach res://wok_assets/ kopieren. catalog.json mit FileAccess + JSON.parse_string lesen,\nBilder mit load("res://wok_assets/" + pfad) laden. Ebenen in der Reihenfolge aus catalog.composeOrder übereinanderlegen;\nPositionen stehen als rect (Anteile 0–1) bzw. rectPx in catalog.json.\n');
  if (tid === 'web' || all) { putText('web/kit.js', 'window.WOK_KIT = ' + JSON.stringify({ catalog: cat, templates }) + ';\n'); putText('web/index.html', KIT_VIEWER); }
}
function unityTemplateFiles(templates, putText) {
  for (const t of templates) {
    putText('unity/' + t.id + '.uxml', '<ui:UXML xmlns:ui="UnityEngine.UIElements">\n  <!-- War of Kings Kartenvorlage ' + t.id + ' (aus der Kartenwerkstatt erzeugt). Inhalte setzt der Importer bzw. euer Code. -->\n  <ui:VisualElement name="wok-card" class="wok-card ' + t.id + '">\n'
      + t.slots.slice().sort((a, b) => a.order - b.order).map(s => s.kind === 'text' ? '    <ui:Label name="' + s.id + '" class="wok-slot wok-' + s.id + '" text="" />' : '    <ui:VisualElement name="' + s.id + '" class="wok-slot wok-' + s.id + '" />').join('\n') + '\n  </ui:VisualElement>\n</ui:UXML>\n');
    putText('unity/' + t.id + '.uss', '/* Positionen in Prozent der Kartengröße (aus templates/' + t.id + '.json). Kartengröße über .wok-card festlegen. */\n.wok-card { width: 360px; height: 540px; position: relative; }\n.wok-slot { position: absolute; -unity-background-scale-mode: stretch-to-fill; }\n'
      + t.slots.map(s => '.' + t.id + ' .wok-' + s.id + ' { left: ' + r4(s.rect.x * 100) + '%; top: ' + r4(s.rect.y * 100) + '%; width: ' + r4(s.rect.w * 100) + '%; height: ' + r4(s.rect.h * 100) + '%;' + (s.kind === 'text' ? ' -unity-text-align: ' + (s.align === 'left' ? 'upper-left' : 'middle-center') + '; color: ' + (s.color || '#ffffff') + ';' + (s.wrap ? ' white-space: normal;' : '') : '') + ' }').join('\n') + '\n');
  }
}
function kitReadme(target, m, c) {
  const n = m.counts, t = target.id;
  return '# War of Kings – Komplettes Asset-Set für ' + target.name + '\n\n'
    + 'Erstellt am ' + new Date(m.created).toLocaleString('de-DE') + ' mit der Kartenwerkstatt (' + m.tool.edition + '-Version). Format **' + m.format + '**, Version ' + m.formatVersion + ', Power-Scaling ' + m.powerScaling + '.\n\n'
    + 'Das Set enthält **alle Bausteine**, aus denen sich jede mögliche Heldenkarte zusammensetzen lässt – auch Kombinationen, die es als Karte noch nicht gibt. '
    + 'Die fertigen Karten selbst liefert weiterhin das Kartenpaket (`WoK_Kartenwerkstatt`). Beide Pakete nutzen dieselben Vorlagen (`templates/hero_v*.json`).\n\n'
    + '## Inhalt\n\n| Ordner/Datei | Inhalt | Anzahl |\n|---|---|---|\n'
    + '| `frames/<design>/frame_v2/3/4.png` | Rahmen je Design (' + c.themes.map(x => x.name).join(', ') + '), Steine im Original, Bildfenster transparent | ' + (n.frame || 0) + ' |\n'
    + '| `gems/<feld>/<stein>.png` | Stein-Überlagerungen für Energie, ATK, DEF und Element (inkl. Schild) in ' + (c.gems.length - 1) + ' Farben; Position in `catalog.json → gems[].overlays[].rect` | ' + (n.gem || 0) + ' |\n'
    + '| `crests/races|classes|elements|rarities/` | Wappen (' + c.races.length + ' Rassen, ' + c.classes.length + ' Klassen, ' + c.elements.length + ' Elemente, ' + c.rarities.length + ' Seltenheiten) | ' + (n.crest || 0) + ' |\n'
    + '| `gifts/` | Gabenwappen (' + c.gifts.length + ') | ' + (n.gift || 0) + ' |\n'
    + '| `badges/elements/` | Element-Abzeichen: ' + c.elements.length + ' einzeln, ' + c.elementPairs.length + ' geteilt (`erstes__zweites`, Reihenfolge zählt) | ' + (n.badge || 0) + ' |\n'
    + '| `grids/attack|move/` | Rastertitel je Schriftsatz, Mittelpunkt, Pfeile in ' + c.arrowColors.length + ' Farben × 8 Richtungen × Länge 1–3, Zahlenkreis je Farbe | ' + (n.grid || 0) + ' |\n'
    + '| `ui/` | Permanent-Box | ' + (n.ui || 0) + ' |\n'
    + '| `templates/` | Platzierung aller Bausteine (Anteile 0–1) für 2, 3 und 4 Kammern | ' + c.templates.length + ' |\n'
    + '| `catalog.json` | Alles als Daten: Designs, Steine, Rassen, Klassen, Elemente, Seltenheiten, Gaben (Texte, CT, Punkte), Pfeilfarben, Richtungen, Schriftsätze, Power-Scaling-Konstanten | 1 |\n'
    + '| `manifest.json` | Alle Dateien mit Größe und Prüfsumme | 1 |\n| `schema/` | JSON-Schemas zur Prüfung | 3 |\n\n'
    + '## Karte zusammensetzen\n\n1. Kartengröße mit Seitenverhältnis 2:3 wählen; alle Positionen sind Anteile der Kartengröße.\n2. Reihenfolge (unten → oben): ' + c.composeOrder.join(' → ') + '.\n'
    + '3. Steine: Für jedes Feld, dessen Stein nicht „Original“ ist, die passende Datei aus `gems/` an `rect` legen. Die Überlagerungen gelten für **jedes** Rahmen-Design, weil Steine beim Design nie mitgefärbt werden.\n'
    + '4. Raster: Alle Teile eines Rasters haben dieselbe Größe und dieselbe Position (`grids.<attack|move>.rect`) – einfach übereinanderlegen: Titel, je Richtung ein Pfeil, Mittelpunkt, optional Zahlenkreis mit Ziffer.\n'
    + '5. Zwei Elemente: `badges/elements/<erstes>__<zweites>.png`. Einzelnes Element: `badges/elements/<id>.png`.\n6. Texte (Name, Energie, ATK, DEF, Gaben, Banner) immer aus den Kartendaten setzen; Schriften stehen in `catalog.fontSets`.\n\n'
    + '## Regeln\n\nTexte, CT, Punkte und Grenzen stammen unverändert aus der Werkstatt (Power-Scaling ' + m.powerScaling + '). Das Master-Regelwerk hat Vorrang. Als „Entwurf“ markierte Wappen (`crestStatus`) sind Werkstatt-Entwürfe.\n\n'
    + (t === 'unity' || t === 'generic' ? '## Unity\n\n- Ordner nach `Assets/WoK/AssetSet/` legen (PC-Version: Zielordner einstellbar).\n- Bilder als **Sprite (2D and UI)**, Rahmen ohne Kompression, Max Size 2048.\n- `unity/hero_v*.uxml/.uss` (UI Toolkit) und `unity/wok_layers.uss` für Stein- und Rasterebenen.\n- `catalog.json` ist mit Newtonsoft JSON oder eigenen Klassen lesbar; `JsonUtility` kann die Wörterbücher (`frames`, `titles`, `numbers`) nicht direkt lesen.\n\n' : '')
    + (t === 'unreal' || t === 'generic' ? '## Unreal\n\n`unreal/WoK_Assets.csv` listet alle Bilder (Name, Pfad, Art, Größe, Merkmale) für eine DataTable.\n\n' : '')
    + (t === 'gamemaker' || t === 'generic' ? '## GameMaker\n\n`gamemaker/sprites.txt` enthält Sprite-Namen für jede Bilddatei.\n\n' : '')
    + (t === 'godot' || t === 'generic' ? '## Godot\n\nSiehe `godot/LIESMICH.txt`.\n\n' : '')
    + (t === 'web' || t === 'generic' ? '## Web\n\n`web/index.html` öffnen: Galerie aller Bausteine und ein Baukasten, der Karten live aus den Ebenen zusammensetzt.\n\n' : '')
    + '## Prüfung\n\n- Fehlende Referenzen: ' + (m.check.missingReferences.length || 'keine') + '\n- Ohne Wappenbild: ' + (m.check.withoutCrest.length ? m.check.withoutCrest.join(', ') : 'keine') + '\n';
}

const KIT_MANIFEST_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#', $id: 'wok-assetkit/assetkit.schema.json', title: 'War of Kings Asset-Set', type: 'object',
  required: ['format', 'formatVersion', 'target', 'created', 'counts', 'catalog', 'assets', 'check', 'files'],
  properties: {
    format: { const: 'wok-assetkit' }, formatVersion: { const: 1 }, target: { type: 'object', required: ['id', 'name'], properties: { id: { enum: ENGINE_TARGETS.map(t => t.id) }, name: STR } },
    created: STR, tool: { type: 'object' }, powerScaling: STR, scale: NUM, canvas: { type: 'object' }, counts: { type: 'object', additionalProperties: INT }, catalog: STR, templates: { type: 'array', items: STR },
    assets: { type: 'array', items: { type: 'object', required: ['path', 'kind', 'w', 'h', 'sha1'], properties: { path: STR, kind: { enum: ['frame', 'gem', 'crest', 'gift', 'badge', 'grid', 'ui'] }, w: INT, h: INT, bytes: INT, sha1: STR } } },
    check: { type: 'object', required: ['missingReferences'], properties: { missingReferences: { type: 'array', maxItems: 0 }, withoutCrest: { type: 'array', items: STR } } }, files: { type: 'array', items: STR }
  }
};
const KIT_RECT = { type: 'object', required: ['x', 'y', 'w', 'h'], properties: { x: NUM, y: NUM, w: NUM, h: NUM } };
const KIT_CATALOG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#', $id: 'wok-assetkit/catalog.schema.json', title: 'War of Kings Asset-Katalog', type: 'object',
  required: ['formatVersion', 'themes', 'gems', 'races', 'classes', 'elements', 'elementPairs', 'rarities', 'gifts', 'arrowColors', 'directions', 'grids', 'templates', 'powerScaling'],
  properties: {
    formatVersion: { const: 1 },
    themes: { type: 'array', items: { type: 'object', required: ['id', 'name', 'frames'], properties: { id: STR, name: STR, frames: { type: 'object', additionalProperties: STR } } } },
    gems: { type: 'array', items: { type: 'object', required: ['id', 'name', 'overlays'], properties: { id: STR, name: STR, overlays: { type: 'array', items: { type: 'object', required: ['field', 'variants', 'path', 'rect'], properties: { field: { enum: KIT_FIELDS }, variants: { type: 'array', items: INT }, path: STR, rect: KIT_RECT, rectPx: KIT_RECT } } } } } },
    races: { type: 'array', items: IDNAME }, classes: { type: 'array', items: IDNAME }, elements: { type: 'array', items: IDNAME },
    elementPairs: { type: 'array', items: { type: 'object', required: ['elements', 'badge'], properties: { elements: { type: 'array', minItems: 2, maxItems: 2, items: STR }, badge: STR } } },
    rarities: { type: 'array', items: IDNAME },
    gifts: { type: 'array', items: { type: 'object', required: ['id', 'name', 'kind', 'short', 'text', 'powerPoints'], properties: { id: STR, name: STR, kind: { enum: ['ct', 'permanent'] }, ct: INT, short: STR, text: STR, powerPoints: NUM, crest: STR } } },
    arrowColors: { type: 'array', items: { type: 'object', required: ['id', 'name', 'hex'], properties: { id: STR, name: STR, hex: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' } } } },
    directions: { type: 'array', minItems: 8, maxItems: 8 },
    grids: { type: 'object', required: ['attack', 'move'], additionalProperties: { type: 'object', required: ['rect', 'titles', 'center', 'arrows', 'numbers'], properties: { rect: KIT_RECT, arrows: { type: 'array', items: { type: 'object', required: ['color', 'dir', 'length', 'path'] } } } } },
    templates: { type: 'array', items: STR }, powerScaling: { type: 'object', required: ['version', 'statMax', 'bands', 'giftPoints'] }
  }
};

/* ---------- Web: Galerie und Baukasten ---------- */
const KIT_VIEWER = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WoK Asset-Set</title>
<style>body{margin:0;background:#0b0f16;color:#dfe5ee;font:14px system-ui,sans-serif}header{padding:14px 18px;border-bottom:1px solid #223}h2{font-size:15px;margin:22px 18px 8px;color:#e8c77a}
.wrap{display:flex;flex-wrap:wrap;gap:18px;padding:0 18px}.card{position:relative;width:340px;aspect-ratio:2/3;background:#07090b;overflow:hidden;border-radius:4px;flex:none}.card img{position:absolute;display:block}
form{display:grid;grid-template-columns:auto 1fr;gap:6px 10px;align-content:start;min-width:260px;max-width:420px}select{background:#141b27;color:#dfe5ee;border:1px solid #2a3446;border-radius:5px;padding:4px}
.dirs{display:flex;flex-wrap:wrap;gap:4px}.dirs label{font-size:12px}.gal{display:flex;flex-wrap:wrap;gap:8px;padding:0 18px}.gal figure{margin:0;width:96px;text-align:center;font-size:11px;color:#8e9bb0}.gal img{max-width:96px;max-height:96px;background:repeating-conic-gradient(#1a2130 0 25%,#141a26 0 50%) 0 0/12px 12px}</style>
<script src="kit.js"><\/script></head><body><header><b>War of Kings · Komplettes Asset-Set</b> – Baukasten: jede Karte entsteht hier nur aus den Ebenen des Sets.</header>
<div class="wrap" style="margin-top:16px"><div class="card" id="card"></div><form id="f"></form></div><div id="gal"></div>
<script>
const C=window.WOK_KIT.catalog,T={};window.WOK_KIT.templates.forEach(t=>T[t.id]=t);const S={theme:C.themes[0].id,v:'2',energy:'original',atk:'original',def:'original',element:'original',e1:C.elements[0].id,e2:'',race:C.races[0].id,cls:C.classes[0].id,rarity:C.rarities[0].id,atkCol:C.arrowColors[0].id,movCol:C.arrowColors[1].id,font:'original',ad:{n:1},md:{n:1,e:2}};
const opt=(k,list,lab)=>{const s=document.createElement('select');list.forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(String(S[k])===String(v))o.selected=true;s.appendChild(o);});s.onchange=()=>{S[k]=s.value;draw();};const l=document.createElement('label');l.textContent=lab;f.appendChild(l);f.appendChild(s);};
const f=document.getElementById('f'),gemList=C.gems.map(g=>[g.id,g.name]);
opt('theme',C.themes.map(t=>[t.id,t.name]),'Rahmen');opt('v',[['2','2 Kammern'],['3','3 Kammern'],['4','4 Kammern']],'Variante');
['energy','atk','def','element'].forEach(k=>opt(k,gemList,'Stein '+({energy:'Energie',atk:'ATK',def:'DEF',element:'Element'})[k]));
opt('e1',C.elements.map(e=>[e.id,e.name]),'Element');opt('e2',[['','–']].concat(C.elements.map(e=>[e.id,e.name])),'2. Element');
opt('race',C.races.map(e=>[e.id,e.name]),'Rasse');opt('cls',C.classes.map(e=>[e.id,e.name]),'Klasse');opt('rarity',C.rarities.map(e=>[e.id,e.name]),'Seltenheit');
opt('atkCol',C.arrowColors.map(e=>[e.id,e.name]),'Angriffspfeile');opt('movCol',C.arrowColors.map(e=>[e.id,e.name]),'Laufpfeile');opt('font',C.fontSets.map(e=>[e.id,e.name]),'Schriftsatz');
const dirBox=(key,lab,max)=>{const l=document.createElement('label');l.textContent=lab;f.appendChild(l);const d=document.createElement('div');d.className='dirs';C.directions.forEach(x=>{const s=document.createElement('select');[['0',x.id+' –']].concat([...Array(max)].map((_,i)=>[String(i+1),x.id+' '+(i+1)])).forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;if(String(S[key][x.id]||0)===v)o.selected=true;s.appendChild(o);});s.onchange=()=>{const n=+s.value;if(n)S[key][x.id]=n;else delete S[key][x.id];draw();};d.appendChild(s);});f.appendChild(d);};
dirBox('ad','Angriff',3);dirBox('md','Laufen',3);
const card=document.getElementById('card');
function put(src,r){if(!src)return;const i=new Image();i.src='../'+src;Object.assign(i.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'});card.appendChild(i);}
function slot(t,id){return T[t].slots.find(s=>s.id===id);}
function draw(){card.innerHTML='';const tid='hero_v'+S.v,th=C.themes.find(t=>t.id===S.theme);
 put(th.frames['v'+S.v],{x:0,y:0,w:1,h:1});
 ['energy','atk','def','element'].forEach(k=>{if(S[k]==='original')return;const g=C.gems.find(x=>x.id===S[k]);const o=g.overlays.find(o=>o.field===k&&o.variants.includes(+S.v));if(o)put(o.path,o.rect);});
 const badge=S.e2&&S.e2!==S.e1?(C.elementPairs.find(p=>p.elements[0]===S.e1&&p.elements[1]===S.e2)||{}).badge:(C.elements.find(e=>e.id===S.e1)||{}).badge;put(badge,slot(tid,'elementBadge').rect);
 const crests=[(C.races.find(r=>r.id===S.race)||{}).crest,(C.classes.find(r=>r.id===S.cls)||{}).crest];crests.forEach((c,i)=>{const s=slot(tid,'slot'+(i+1)+'Crest');if(s)put(c,s.rect);});
 put((C.rarities.find(r=>r.id===S.rarity)||{}).crest,slot(tid,'rarityCrest').rect);
 for(const [kind,col,dirs] of [['attack',S.atkCol,S.ad],['move',S.movCol,S.md]]){const g=C.grids[kind];put(g.titles[S.font]||g.titles.original,g.rect);Object.entries(dirs).forEach(([d,n])=>{const a=g.arrows.find(a=>a.color===col&&a.dir===d&&a.length===n);if(a)put(a.path,g.rect);});put(g.center,g.rect);}
}
draw();
const gal=document.getElementById('gal');const sec=(t,items)=>{const h=document.createElement('h2');h.textContent=t+' ('+items.length+')';gal.appendChild(h);const d=document.createElement('div');d.className='gal';items.forEach(([src,cap])=>{if(!src)return;const fg=document.createElement('figure');const i=new Image();i.loading='lazy';i.src='../'+src;fg.appendChild(i);const c=document.createElement('figcaption');c.textContent=cap;fg.appendChild(c);d.appendChild(fg);});gal.appendChild(d);};
sec('Rahmen',C.themes.flatMap(t=>Object.entries(t.frames).map(([v,p])=>[p,t.name+' '+v])));
sec('Steine',C.gems.flatMap(g=>g.overlays.map(o=>[o.path,g.name+' · '+o.field])));
sec('Rassen',C.races.map(x=>[x.crest,x.name]));sec('Klassen',C.classes.map(x=>[x.crest,x.name]));sec('Elemente',C.elements.map(x=>[x.badge,x.name]));
sec('Geteilte Elemente',C.elementPairs.map(x=>[x.badge,x.elements.join(' + ')]));sec('Seltenheiten',C.rarities.map(x=>[x.crest,x.name]));sec('Gaben',C.gifts.map(x=>[x.crest,x.name]));
sec('Pfeile Angriff (Länge 1)',C.grids.attack.arrows.filter(a=>a.length===1).map(a=>[a.path,a.color+' '+a.dir]));
<\/script></body></html>
`;
