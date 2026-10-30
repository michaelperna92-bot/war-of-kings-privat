'use strict';
/* ================= War of Kings · Kartenwerkstatt ================= */
const PW = window.WOK_POWER;
const D = window.WOK_DATA, R = window.WOK_RENDER, ST = window.WOK_STORE, A = window.WOK_ASSETS;
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(t, ms) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms || 3200); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const G = {
  layout: null, frames: { 1: null, 2: null, 3: null }, tplImgs: { 1: null, 2: null, 3: null }, crests: {}, crestOverrides: {}, giftCrests: {},
  card: null, cardId: null, dirty: false, focus: null, tab: 'card', search: '', filters: { race: '', cls: '', element: '', rarity: '', status: '', folder: '', type: '', pool: '' }, libPick: null,
  thumbs: new Map(), artImg: null, artSrc: null, renderIssues: [], ready: false, menu: false, pan: null
};

/* ---------- Vorlagen und Wappen ---------- */
function mergeLayout(saved) {
  const L = R.defaultLayout();
  if (!saved) return L;
  const deep = (a, b) => { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) deep(a[k], b[k]); else a[k] = b[k]; } return a; };
  return deep(L, saved);
}
async function loadTemplates() {
  for (const v of ['1', '2', '3']) {
    const custom = G.layout.templates && G.layout.templates[v];
    let src = A.templates[v];
    if (custom) { const u = await ST.imageURL(custom); if (u) src = u; }
    if (v !== '1' && G.layout.templates && G.layout.templates['1'] && !G.layout.templates[v]) src = null; // eigene Vorlage ohne verlängerte Variante
    const img = src ? await R.loadImage(src) : null;
    G.tplImgs[v] = img;
    G.frames[v] = img ? R.computeFrame(img, G.layout.mask, +v).canvas : null;
  }
  frameCache.clear();
}
async function loadCrests() {
  G.crests = {};
  const keys = Object.keys(A.crests);
  await Promise.all(keys.map(async k => { G.crests[k] = await R.loadImage(A.crests[k]); }));
  for (const [k, o] of Object.entries(G.crestOverrides)) {
    const u = await ST.imageURL(o.id); if (u) G.crests[k] = await R.loadImage(u);
  }
  G.giftCrests = {};
  for (const g of D.GIFTS.concat(D.ROYAL_GIFTS || [])) {
    const key = g.crest || ('gabe_' + g.id);
    if (G.crests[key]) G.giftCrests[g.id] = G.crests[key];
  }
}
function crestKeyOfGift(g) { return g.crest || ('gabe_' + g.id); }
function crestSrc(key) { const im = G.crests[key]; return im ? im.src : ''; }

/* ---------- Karte ---------- */
const STYLE_DEFAULT = { theme: 'blau', name: 'normal', energy: 'original', atk: 'original', def: 'original', element: 'original', atkArrow: '#e3261d', movArrow: '#2f8df5', fontSet: 'original', fonts: {} };
const ARROW_COLORS = [['Rubin', '#d4202a'], ['Saphir', '#2f7fe6'], ['Smaragd', '#1fa463'], ['Gold', '#e8b13a'], ['Amethyst', '#9a5cf0'], ['Aquamarin', '#22b8c4'], ['Kupfer', '#d0743a'], ['Silber', '#d8dee6']];
const FONT_ROLES = [['name', 'Heldenname'], ['num', 'Zahlen (Energie, ATK, DEF)'], ['title', 'Überschriften und Beschriftungen'], ['text', 'Regeltext der Gaben']];
const loadedFonts = new Set();
async function ensureFonts(style) {
  const list = R.fontsNeeded(style).filter(x => !loadedFonts.has(x)); if (!list.length) return;
  await Promise.race([Promise.all(list.map(f => document.fonts.load(f).catch(() => null))), sleep(5000)]);
  list.forEach(x => loadedFonts.add(x));
}
function gemSwatch(k) { const g = R.GEMS[k]; return g && g.swatch ? 'radial-gradient(circle at 35% 30%,' + g.swatch[0] + ' 0,' + g.swatch[1] + ' 45%,' + g.swatch[2] + ' 100%)' : 'repeating-linear-gradient(45deg,#2a3346 0 4px,#1a2130 4px 8px)'; }
const frameCache = new Map();
function framesFor(style) {
  const st = Object.assign({}, STYLE_DEFAULT, style || {});
  const key = [st.theme, st.energy, st.atk, st.def, st.element].join('|');
  if (!frameCache.has(key)) frameCache.set(key, { 1: G.frames[1] && R.styleFrame(G.frames[1], G.layout, st), 2: G.frames[2] && R.styleFrame(G.frames[2], G.layout, st), 3: G.frames[3] && R.styleFrame(G.frames[3], G.layout, st) });
  return frameCache.get(key);
}
function blankCard() {
  return { type: 'hero', hp: '', style: clone(STYLE_DEFAULT), name: '', nameScale: 100, energy: '', atk: '', def: '', element: null, element2: null, race: null, race2: null, classes: [null, null], rarity: null,
    attack: { dirs: {}, showNumber: false, number: 1 }, move: { dirs: {}, showNumber: false, number: 1 }, gifts: [], art: null, status: 'entwurf' };
}
function normalize(c) {
  const b = blankCard(); const o = Object.assign(b, c || {});
  o.classes = [(o.classes || [])[0] || null, (o.classes || [])[1] || null];
  o.element2 = o.element2 || null; o.race2 = o.race2 || null;
  o.attack = Object.assign({ dirs: {}, showNumber: false, number: 1 }, o.attack || {});
  o.move = Object.assign({ dirs: {}, showNumber: false, number: 1 }, o.move || {});
  o.gifts = (o.gifts || []).filter(g => g && g.id).slice(0, 3);
  o.style = Object.assign(clone(STYLE_DEFAULT), (c && c.style) || {});
  o.synergy = +(o.synergy || 0);
  o.type = o.type === 'king' ? 'king' : (o.type === 'spell' || o.type === 'curse') ? o.type : 'hero'; if (o.hp === undefined) o.hp = '';
  if (o.type === 'spell' || o.type === 'curse') { o.spell = window.WOK_EFFECTS.normalizeSpell(o.spell, o.type); o.ruleText = o.ruleText || ''; o.flavor = o.flavor || ''; o.subtitle = o.subtitle || ''; o.autoRarity = false; o.autoEnergy = false; return o; }
  if (o.autoRarity === undefined || o.autoEnergy === undefined) { // bestehende Karten: bewusste Abweichungen behalten
    const ev = PW.evaluate(Object.assign({}, o, { rarity: null }));
    if (o.autoRarity === undefined) o.autoRarity = !o.rarity || o.rarity === ev.rarity;
    if (o.autoEnergy === undefined) o.autoEnergy = o.energy === '' || o.energy == null || +o.energy === ev.suggestedEnergy;
  }
  return o;
}
async function ensureArt(card) {
  const id = card && card.art && card.art.id;
  if (!id) { G.artImg = null; G.artSrc = null; return null; }
  if (G.artSrc === id && G.artImg) return G.artImg;
  const u = await ST.imageURL(id);
  const img = u ? await R.loadImage(u) : null;
  if (card === G.card || (G.card && G.card.art && G.card.art.id === id)) { G.artImg = img; G.artSrc = id; }
  return img;
}
function resFor(art, card) { const f = framesFor(card && card.style); return { frame1: f[1], frame2: f[2], frame3: f[3], art, crests: G.crests, giftCrests: G.giftCrests, spellFrames: G.spellFrames }; }
async function loadSpellFrames() { G.spellFrames = {}; const T = A.spellTemplates || {}; for (const k of ['spell', 'curse']) if (T[k]) G.spellFrames[k] = await R.loadImage(T[k]); }
async function renderTo(canvas, card, opts) {
  await ensureFonts(card.style);
  const art = card === G.card ? await ensureArt(card) : await loadArtFor(card);
  const ctx = canvas.getContext('2d');
  return R.draw(ctx, card, G.layout, resFor(art, card), Object.assign({ scale: canvas.width / G.layout.W }, opts || {}));
}
async function loadArtFor(card) { const id = card.art && card.art.id; if (!id) return null; const u = await ST.imageURL(id); return u ? R.loadImage(u) : null; }

let drawQueued = false;
function redraw() {
  if (drawQueued) return; drawQueued = true;
  requestAnimationFrame(async () => {
    drawQueued = false;
    const cv = $('#preview'); if (!cv || !G.card) return;
    G.renderIssues = await renderTo(cv, G.card, { watermark: false });
    updateIssues();
  });
}

/* ---------- Prüfung ---------- */
function validate(card, rIssues) {
  if (card.type === 'spell' || card.type === 'curse') return spellValidate(card, rIssues);
  const out = [], add = (level, text, sec) => out.push({ level, text, sec });
  const has = v => v !== '' && v !== null && v !== undefined;
  const king = card.type === 'king';
  if (!card.name) add('error', (king ? 'Königsname' : 'Heldenname') + ' fehlt.', 'name');
  if (!king && !has(card.energy)) add('error', 'Energie fehlt.', 'werte');
  if (!has(card.atk)) add('error', 'ATK fehlt.', 'werte');
  if (king ? !has(card.hp) : !has(card.def)) add('error', (king ? 'HP' : 'DEF') + ' fehlt.', 'werte');
  if (king) add('info', 'Königskarte: Krone statt Energie, HP statt DEF, kein Laufen, höchstens 3 Angriffsrichtungen (gerade, schräg links, schräg rechts) und bis zu 3 königliche Gaben.', 'werte');
  if (!card.rarity) add('error', 'Seltenheit fehlt.', 'werte');
  if (!card.element) add('error', 'Element fehlt.', 'herkunft');
  if (!card.race) add('error', 'Rasse fehlt.', 'herkunft');
  if (!card.classes[0]) add('error', 'Klasse fehlt.', 'herkunft');
  if (card.classes[1] && card.classes[1] === card.classes[0]) add('error', 'Zweite Klasse ist gleich der ersten.', 'herkunft');
  if (card.race2 && card.race2 === card.race) add('error', 'Zweite Rasse ist gleich der ersten.', 'herkunft');
  if (card.element2 && card.element2 === card.element) add('error', 'Zweites Element ist gleich dem ersten.', 'herkunft');
  if (card.element2 || card.race2) add('info', 'Zwei Elemente oder zwei Rassen sind eine Erweiterung der Werkstatt. Wie sie im Spiel wirken (z. B. Element-Vorteile), legt das Regelwerk noch nicht fest.', 'herkunft');
  if (!(card.art && card.art.id)) add('error', 'Illustration fehlt.', 'bild');
  const ids = card.gifts.map(g => g.id);
  if (new Set(ids).size !== ids.length) add('error', 'Eine Gabe ist doppelt eingetragen.', 'gaben');
  for (const s of card.gifts) {
    const g = (king ? (D.ROYAL_GIFTS || []) : D.GIFTS).find(x => x.id === s.id);
    if (!g) { add('error', 'Die Gabe „' + s.id + '“ gibt es nicht mehr. Entferne sie von der Karte.', 'gaben'); continue; }
    if (!G.giftCrests[g.id]) add('warn', 'Für „' + g.name + '“ gibt es noch kein Wappen. In der Wappenbibliothek hochladen.', 'gaben');
  }
  if (!Object.values(card.attack.dirs || {}).some(Boolean)) add('warn', 'Keine Angriffsrichtung gewählt.', 'richtungen');
  if (!king && Object.values(card.attack.dirs || {}).some(v => +v >= 2) && !card.gifts.some(g => g.id === 'schuetze')) add('warn', 'Angriffspfeil der Länge 2: Im Spiel greifen Helden nur angrenzende Felder an – 2 Felder weit nur mit der Gabe Schütze.', 'richtungen');
  if (!king && !Object.values(card.move.dirs || {}).some(Boolean)) add('warn', 'Keine Laufrichtung gewählt.', 'richtungen');
  for (const [lab, sp] of [['Laufweite', card.move], ['Angriffsweite', card.attack]]) {
    if (sp.showNumber && +sp.number > 3) add('warn', lab + ' ' + sp.number + ': Mehr als 3 Felder sieht das Regelwerk nicht vor.', 'richtungen');
    else if (sp.showNumber && +sp.number === 3 && lab === 'Laufweite') add('info', 'Laufweite 3 ist laut Regelwerk eine absolute Ausnahme.', 'richtungen');
  }
  // Grenzen (Energie 0–10, ATK/DEF 0–3.500 in 100er-Schritten, Gabenlimit) prüft das Power-System, siehe unten
  const crestCheck = (list, id, what) => {
    const it = list.find(x => x.id === id); if (!it) return;
    if (G.crestOverrides[it.crest]) return;
    if (it.crestStatus === 'Entwurf') add('warn', what + 'wappen „' + it.name + '“ ist laut Regelwerk noch ein Entwurf.', 'herkunft');
    if (it.crestStatus === 'Abweichung') add('warn', 'Seltenheitswappen „' + it.name + '“: ' + it.note, 'werte');
  };
  crestCheck(D.RACES, card.race, 'Rassen'); crestCheck(D.RACES, card.race2, 'Rassen'); crestCheck(D.CLASSES, card.classes[0], 'Klassen'); crestCheck(D.CLASSES, card.classes[1], 'Klassen');
  crestCheck(D.RARITIES, card.rarity, 'Seltenheits');
  const seen = new Set();
  for (const r of rIssues || []) {
    const k = r.code + (r.info || ''); if (seen.has(k)) continue; seen.add(k);
    if (r.code === 'nameOverflow') add('error', 'Der Name ist zu lang für das Namensbanner.', 'name');
    if (r.code === 'bannerOverflow') add('error', 'Rasse und Klassen passen nicht ins Banner.', 'herkunft');
    if (r.code === 'giftOverflow') add('error', 'Der Kurztext von „' + r.info + '“ passt mit dieser Schrift nicht ins Gabenfeld. Wähle eine schmalere Schrift für den Regeltext.', 'gaben');
    if (r.code === 'giftSmall') add('warn', 'Der Text von „' + r.info + '“ wird sehr klein und ist im Druck schwer lesbar.', 'gaben');
    if (r.code === 'arrowClip') add('info', 'Ein Pfeil der Länge 2 ist länger als das Raster und wird gekürzt. Zeige die Reichweite besser mit der Zahl.', 'richtungen');
    if (r.code === 'noFrame2') add('warn', 'Für so viele Rassen und Klassen fehlt eine passende (verlängerte) Vorlage. Was nicht in die Leiste passt, steht nur im Banner.', 'herkunft');
  }
  if (card.status !== 'freigegeben') {
    add('info', 'Teststand: „Berechnung gültig“ ist noch keine endgültige Balancefreigabe. Die Karte wird nicht automatisch freigegeben.', 'status');
    add('info', 'Lauf- und Angriffsrichtungen jeder neuen Karte müssen laut Regelwerk separat freigegeben werden.', 'richtungen');
  }
  for (const n of PW.evaluate(card).notes) add(n.level, n.text, 'power');
  return out;
}

/* ================= Oberfläche ================= */
function shell() {
  const S = ST.state;
  const store = S.mode === 'cloud' ? (S.canWrite ? '<span class="pill ok">Im Claude-Konto gespeichert</span>' : '<span class="pill warn">Nur ansehen</span>')
    : S.mode === 'disk' ? '<span class="pill ok" title="Dokumente\\War of Kings Kartenwerkstatt">Auf diesem PC gespeichert · offline</span>'
    : S.mode === 'local' ? '<span class="pill warn" title="Karten liegen nur in diesem Browser. Sichere sie regelmäßig als JSON.">Nur in diesem Browser</span>'
    : '<span class="pill bad">Speichern nicht möglich</span>';
  $('#app').innerHTML = `
  <header class="bar">
    <div class="brand"><h1>War <span>of</span> Kings</h1><small>Kartenwerkstatt · Heldenkarten</small></div>
    <button class="aichip" id="ai-chip" data-act="ai-chip" title="Status der KI-Verbindung" data-s="aus">KI …</button>
    <button class="pwfloat" id="pw-float" data-goto="power" title="Gesamt-Power dieser Karte · antippen für die Aufschlüsselung" hidden></button>
    ${store}
    <div class="acts">
      <button data-act="new">Neue Karte</button>
      <button class="gold" data-act="save" id="btn-save" ${S.canWrite ? '' : 'disabled'}>Speichern<span id="dirty" class="dirty-dot" hidden></span></button>
      <div class="menu"><button data-act="menu" aria-expanded="false" aria-haspopup="true">Exportieren ▾</button><div class="menu-list" id="menu" hidden>
        <button data-act="export-png">Bild (PNG): online oder Yu-Gi-Oh</button>
        <button data-act="export-pdf">Druck-PDF: Yu-Gi-Oh 59 × 86 mm u. a.</button>
        <button data-act="export-json">Karte als JSON</button>
        <button data-act="backup">Bibliothek auf anderes Gerät übertragen: Datei erstellen</button>
        <button data-act="lib-dl">Ganze Bibliothek als Bilder (PNG) …</button>
        <button data-act="engine-export">✦ Für Spiel-Engine exportieren (Unity, Godot …) …</button>
        <button data-act="game-export">♛ Fürs Probe-Spiel exportieren (Spielpaket) …</button>
        <button data-act="import" ${S.canWrite ? '' : 'disabled'}>Bibliothek abgleichen: Datei einlesen …</button>
        ${S.mode === 'disk' ? '<button data-act="open-folder">Exporte-Ordner öffnen</button>' : ''}
        <button data-act="sync-cfg">☁ Abgleich über Google Drive / OneDrive …</button>
        ${window.WOK_DESKTOP ? '<button data-act="aicfg">KI-Verbindung (Namen &amp; Motive) …</button>' : ''}
      </div></div>
      <button data-act="ai" class="ai-btn">✦ AI-Modus</button>
      <button data-act="crests">Wappen</button>
      <button data-act="layout" ${S.canWrite ? '' : 'disabled'}>Vorlage einrichten</button>
    </div>
  </header>
  <nav class="mobile-tabs"><button data-tab="lib">Bibliothek</button><button data-tab="card">Karte</button></nav>
  <main class="ws" data-tab="${G.tab}">
    <aside class="lib" aria-label="Kartenbibliothek"><div class="lib-head">
      <input type="search" id="q" placeholder="Heldenname suchen" value="${esc(G.search)}" aria-label="Heldenname suchen">
      <div class="filters">
        ${filterSel('race', 'Rasse', D.RACES)}${filterSel('cls', 'Klasse', D.CLASSES)}${filterSel('element', 'Element', D.ELEMENTS)}${filterSel('rarity', 'Seltenheit', D.RARITIES)}
        <select id="f-type" aria-label="Kartenart"><option value="">Alle Kartenarten</option>${[['hero', 'Helden'], ['king', 'Könige'], ['spell', 'Zauber'], ['curse', 'Flüche']].map(([k, t]) => '<option value="' + k + '"' + (G.filters.type === k ? ' selected' : '') + '>' + t + '</option>').join('')}</select>
        <select id="f-pool" aria-label="Verteilung im Spiel"><option value="">Alle Verteilungen</option>${[['starter', '🎁 Starter-Set'], ['pack', '📦 In Packs'], ['test', 'Nur Test']].map(([k, t]) => '<option value="' + k + '"' + (G.filters.pool === k ? ' selected' : '') + '>' + t + '</option>').join('')}</select>
        <select id="f-status" aria-label="Status"><option value="">Alle Status</option><option value="entwurf" ${G.filters.status === 'entwurf' ? 'selected' : ''}>Entwürfe</option><option value="freigegeben" ${G.filters.status === 'freigegeben' ? 'selected' : ''}>Freigegeben</option></select>
      </div></div>
      <div class="folders" id="folders"></div>
      <div class="pickbar" id="pickbar"></div>
      <div class="lib-list" id="liblist"></div>
      <div class="lib-foot" id="libfoot"></div>
      <div class="lib-dl"><button data-act="lib-dl">⬇ Bibliothek als Bilder</button><button data-act="engine-export">✦ Für Spiel-Engine exportieren</button><button data-act="game-export">♛ Fürs Probe-Spiel</button></div>
    </aside>
    <section class="stage" aria-label="Kartenvorschau">
      <div class="cardwrap" id="wrap"><canvas id="preview" width="1024" height="1536" aria-label="Vorschau der Karte"></canvas></div>
      <div class="stagebar" id="stagebar"></div>
      <p class="hint" id="stagehint"></p>
    </section>
    <aside class="panel" id="panel" aria-label="Kartendaten"></aside>
  </main>
  <input type="file" id="file-art" accept="image/png,image/jpeg,image/webp" hidden>
  <input type="file" id="file-json" accept="application/json,.json" hidden>
  <input type="file" id="file-crest" accept="image/png,image/jpeg,image/webp" hidden>
  <input type="file" id="file-tpl" accept="image/png,image/jpeg,image/webp" hidden>`;
  bindPreview();
}
function filterSel(key, label, list) {
  return '<select id="f-' + key + '" aria-label="' + label + '"><option value="">' + label + ': alle</option>' + list.map(x => '<option value="' + x.id + '"' + (G.filters[key] === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select>';
}

/* ---------- Bibliothek ---------- */
function filteredCards() {
  const q = G.search.trim().toLowerCase(), f = G.filters;
  return ST.list().filter(c => (!q || (c.name || '').toLowerCase().includes(q))
    && (!f.race || c.race === f.race || c.race2 === f.race) && (!f.cls || (c.classes || []).includes(f.cls)) && (!f.element || c.element === f.element || c.element2 === f.element)
    && (!f.rarity || c.rarity === f.rarity) && (!f.status || (c.status || 'entwurf') === f.status)
    && (!f.folder || (f.folder === '-' ? !c.folder : c.folder === f.folder)) && (!f.type || (c.type || 'hero') === f.type) && (!f.pool || (c.pool || 'test') === f.pool))
    .sort((a, b) => (b.updated || 0) - (a.updated || 0));
}
function renderLib() {
  const el = $('#liblist'); if (!el) return;
  const cards = filteredCards(), all = ST.list().length;
  const nm = (list, id) => (list.find(x => x.id === id) || {}).name || '';
  el.innerHTML = cards.length ? cards.map(c => {
    const th = G.thumbs.get(c.id);
    const pk = G.libPick;
    return '<button class="libitem' + (c.id === G.cardId ? ' on' : '') + (pk ? ' picking' + (pk.has(c.id) ? ' picked' : '') : '') + '" ' + (pk ? 'data-pick-card="' + c.id + '" aria-pressed="' + pk.has(c.id) + '"' : 'data-open="' + c.id + '"') + '>'
      + (pk ? '<span class="pickbox" aria-hidden="true">' + (pk.has(c.id) ? '✓' : '') + '</span>' : '')
      + (th && th.updated === c.updated ? '<img src="' + th.url + '" alt="">' : '<span class="ph">…</span>')
      + '<span style="min-width:0"><b>' + esc(c.name || 'Ohne Namen') + '</b>' + (isSpellCard(c) ? '<small>' + esc((c.type === 'curse' ? '☠ Fluch' : '✦ Zauber') + (c.subtitle ? ' · ' + c.subtitle : '')) + '</small><small>' + esc([nm(D.RARITIES, c.rarity), c.energy !== '' && c.energy != null ? c.energy + ' Energie' : ''].filter(Boolean).join(' · ')) + '</small></span>' : '<small>' + esc([nm(D.RACES, c.race), nm(D.RACES, c.race2), nm(D.CLASSES, (c.classes || [])[0]), nm(D.CLASSES, (c.classes || [])[1])].filter(Boolean).join(' / ') || '–')
      + '</small><small>' + esc([c.type === 'king' ? '👑 König' : '', [nm(D.ELEMENTS, c.element), nm(D.ELEMENTS, c.element2)].filter(Boolean).join('/'), nm(D.RARITIES, c.rarity), c.type === 'king' ? (c.hp ? Number(c.hp).toLocaleString('de-DE') + ' HP' : '') : (c.energy !== '' && c.energy != null ? c.energy + ' Energie' : '')].filter(Boolean).join(' · ')) + '</small></span>')
      + '<span class="chip ' + (c.status === 'freigegeben' ? 'rel">Freigegeben' : 'draft">Entwurf') + '</span>' + (c.folder && G.filters.folder !== c.folder ? '<span class="fchip" title="Ordner">📁 ' + esc(c.folder) + '</span>' : '') + poolChip(c) + '</button>';
  }).join('') : '<p class="muted" style="padding:8px">' + (all ? 'Keine Karte passt zu Suche und Filtern.' : 'Noch keine Karten. Lege mit „Neue Karte“ deine erste an und speichere sie.') + '</p>';
  $('#libfoot').textContent = cards.length + ' von ' + all + ' Karten';
  renderFolders(cards);
  queueThumbs(cards);
}
/* ---------- Verteilung im Spiel: Starter-Set (für alle gleich, max. 50 Karten) oder Packs (Ergänzung 30.10.2026) ---------- */
const STARTER_MAX = 50;
function starterLimit(c) { return c.type === 'king' ? 1 : ((D.RARITIES.find(r => r.id === (c.rarity || 'gewoehnlich')) || {}).limit || 1); } // ohne Seltenheit zählt die Karte im Spiel als Gewöhnlich
function starterTotal(list) { return (list || ST.list()).filter(c => c.pool === 'starter').reduce((a, c) => a + (+c.starterCount || 1), 0); }
function poolChip(c) { return c.pool === 'starter' ? '<span class="fchip pool st" title="Starter-Set: jeder Spieler hat diese Karte von Anfang an">🎁 Starter ×' + (+c.starterCount || 1) + '</span>' : c.pool === 'pack' ? '<span class="fchip pool pk" title="Nur aus Packs erhältlich">📦 Pack</span>' : ''; }
async function setPool(ids, pool, count) {
  let n = 0, capped = 0;
  for (const id of ids) {
    const c = ST.get(id); if (!c) continue; const d = clone(c);
    if (pool) d.pool = pool; else delete d.pool;
    if (pool === 'starter') { const lim = starterLimit(d), k = Math.max(1, Math.min(lim, +count || 1)); if (k < (+count || 1)) capped++; d.starterCount = k; } else delete d.starterCount;
    try { await ST.put(d, c.updated); n++; } catch (e) { }
    if (id === G.cardId && G.card) { if (pool) G.card.pool = pool; else delete G.card.pool; if (d.starterCount) G.card.starterCount = d.starterCount; else delete G.card.starterCount; }
  }
  renderLib(); return { n, capped };
}
function starterDialog(ids) {
  const now = starterTotal(), add = ST.list().filter(c => ids.includes(c.id) && c.pool !== 'starter').length;
  showModal('Ins Starter-Set legen', '<p>' + ids.length + (ids.length === 1 ? ' Karte' : ' Karten') + '. Das Starter-Set hat jeder Spieler von Anfang an, für alle gleich. Höchstens <b>' + STARTER_MAX + ' Karten</b> insgesamt, Kopien zählen mit.</p>'
    + '<label>Wie viele Kopien bekommt jeder Spieler?<select id="st-count"><option value="1">1×</option><option value="2">2×</option><option value="3">3×</option></select></label>'
    + '<p class="muted" style="font-size:13px">Legendäre Karten und Könige gibt es höchstens 1×, Seltene höchstens 2× (wie das Kopien-Limit im Deck). Jetzt im Starter-Set: <b>' + now + ' / ' + STARTER_MAX + '</b>' + (add ? ', dazu kommen ' + add + ' neue Karte(n).' : '.') + '</p>',
    '<button data-act="close">Abbrechen</button><button class="gold" data-act="pool-starter-go">🎁 Ins Starter-Set</button>');
  G.poolIds = ids;
}
function starterBadge() { const n = starterTotal(); return '<button class="fbtn pool' + (G.filters.pool === 'starter' ? ' on' : '') + (n > STARTER_MAX ? ' over' : '') + '" data-act="pool-show" data-pool="starter" title="Starter-Set: Karten, mit denen jeder Spieler anfängt">🎁 Starter <span>' + n + '/' + STARTER_MAX + '</span></button>'
  + '<button class="fbtn pool' + (G.filters.pool === 'pack' ? ' on' : '') + '" data-act="pool-show" data-pool="pack" title="Karten, die es nur aus Packs gibt">📦 Packs <span>' + ST.list().filter(c => c.pool === 'pack').length + '</span></button>'; }
/* ---------- Ordner und Mehrfachauswahl in der Bibliothek ---------- */
function folderNames() {
  let extra = []; try { extra = JSON.parse(localStorage.getItem('wok-folders') || '[]'); } catch (e) { }
  return [...new Set(ST.list().map(c => c.folder).filter(Boolean).concat(extra))].sort((a, b) => a.localeCompare(b, 'de'));
}
function saveFolderList(list) { try { localStorage.setItem('wok-folders', JSON.stringify([...new Set(list)])); } catch (e) { } }
function renderFolders(visible) {
  const el = $('#folders'), pb = $('#pickbar'); if (!el) return;
  const all = ST.list(), f = G.filters.folder, cnt = n => all.filter(c => n === '' ? true : n === '-' ? !c.folder : c.folder === n).length;
  const chip = (v, t) => '<button class="fbtn' + (f === v ? ' on' : '') + '" data-folder="' + esc(v) + '">' + t + ' <span>' + cnt(v) + '</span></button>';
  el.innerHTML = chip('', 'Alle') + chip('-', 'Ohne Ordner') + folderNames().map(n => chip(n, '📁 ' + esc(n))).join('')
    + '<button class="fbtn add" data-act="folder-new" title="Neuen Ordner anlegen">+ Ordner</button>'
    + '<button class="fbtn pick' + (G.libPick ? ' on' : '') + '" data-act="lib-pick">' + (G.libPick ? '✓ Auswahl beenden' : '☑ Auswählen') + '</button>' + starterBadge();
  if (!G.libPick) { pb.hidden = true; pb.innerHTML = ''; return; }
  const n = G.libPick.size; pb.hidden = false;
  pb.innerHTML = '<b>' + n + (n === 1 ? ' Karte' : ' Karten') + ' ausgewählt</b><button data-act="pick-all">Alle sichtbaren (' + visible.length + ')</button><button data-act="pick-none" ' + (n ? '' : 'disabled') + '>Keine</button>'
    + '<button class="gold" data-act="pick-move" ' + (n ? '' : 'disabled') + '>📁 In Ordner …</button><button data-act="pick-unfolder" ' + (n ? '' : 'disabled') + '>Aus dem Ordner nehmen</button>'
    + '<button data-act="pick-starter" ' + (n ? '' : 'disabled') + ' title="Jeder Spieler hat diese Karten von Anfang an">🎁 Ins Starter-Set …</button><button data-act="pick-pack" ' + (n ? '' : 'disabled') + ' title="Nur aus Packs erhältlich">📦 In die Packs</button><button data-act="pick-nopool" ' + (n ? '' : 'disabled') + ' title="Weder Starter noch Pack – nur zum Testen">Nur Test</button>'
    + '<button data-act="pick-release" ' + (n ? '' : 'disabled') + '>Freigeben</button><button data-act="pick-export" ' + (n ? '' : 'disabled') + '>♛ Fürs Probe-Spiel exportieren</button>';
}
async function moveToFolder(ids, name) {
  let n = 0;
  for (const id of ids) { const c = ST.get(id); if (!c) continue; const d = clone(c); if (name) d.folder = name; else delete d.folder; try { await ST.put(d, c.updated); n++; } catch (e) { } if (id === G.cardId && G.card) { if (name) G.card.folder = name; else delete G.card.folder; } }
  if (name) saveFolderList(folderNames().concat(name));
  renderLib(); return n;
}
function folderDialog(ids) {
  const names = folderNames();
  showModal(ids ? 'In welchen Ordner?' : 'Neuer Ordner', (ids ? '<p class="muted">' + ids.length + (ids.length === 1 ? ' Karte' : ' Karten') + ' verschieben.</p>' + (names.length ? '<div class="fpick">' + names.map(n => '<button data-act="folder-to" data-name="' + esc(n) + '">📁 ' + esc(n) + '</button>').join('') + '</div>' : '') : '')
    + '<label>' + (ids ? 'Oder neuer Ordner' : 'Name des Ordners') + '<input type="text" id="folder-name" maxlength="40" placeholder="z. B. Season 1, Für das Probe-Spiel, Drachen-Deck"></label>'
    + (!ids && names.length ? '<p class="muted" style="font-size:12.5px;margin-top:10px">Vorhandene Ordner: ' + names.map(n => '<button class="ghost" data-act="folder-del" data-name="' + esc(n) + '" title="Ordner auflösen (Karten bleiben erhalten)">📁 ' + esc(n) + ' ✕</button>').join(' ') + '</p>' : ''),
    '<button data-act="close">Abbrechen</button><button class="gold" data-act="folder-create">' + (ids ? 'Anlegen und verschieben' : 'Anlegen') + '</button>');
  G.folderIds = ids || null; setTimeout(() => { const i = $('#folder-name'); if (i) i.focus(); }, 30);
}
let thumbBusy = false;
async function queueThumbs(cards) {
  if (thumbBusy) return; thumbBusy = true;
  try {
    for (const c of cards) {
      const th = G.thumbs.get(c.id); if (th && th.updated === c.updated) continue;
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 192;
      await renderTo(cv, normalize(c), { placeholder: false });
      G.thumbs.set(c.id, { updated: c.updated, url: cv.toDataURL('image/jpeg', 0.8) });
      const btn = $('[data-open="' + c.id + '"] .ph'); if (btn) { const img = new Image(); img.src = G.thumbs.get(c.id).url; img.alt = ''; btn.replaceWith(img); }
      await sleep(10);
    }
  } finally { thumbBusy = false; }
}

/* ---------- Bühne ---------- */
function artFits() {
  const im = G.artImg, W = artWin(); if (!im) return null;
  return { cover: R.coverFit(im.naturalWidth, im.naturalHeight, W), contain: R.containFit(im.naturalWidth, im.naturalHeight, W) };
}
function renderStagebar() {
  const c = G.card, hasArt = !!(c.art && c.art.id), canW = ST.state.canWrite, f = artFits();
  const scalePct = f && c.art.scale ? Math.round(100 * c.art.scale / f.cover.scale) : 100;
  const minPct = f ? Math.floor(100 * f.contain.scale / f.cover.scale) : 100;
  $('#stagebar').innerHTML = hasArt
    ? '<label class="inline" style="color:var(--silver)">Bildgröße <input type="range" id="art-zoom" min="' + minPct + '" max="300" step="1" value="' + scalePct + '" aria-label="Bildgröße"> <span class="tnum" id="zoomv">' + scalePct + ' %</span></label>'
      + '<button data-act="art-fit" title="Bild füllt das ganze Bildfenster">Füllen</button><button data-act="art-contain" title="Ganzes Bild sichtbar, Rand wird gefüllt">Ganz zeigen</button><button data-act="art-pick" ' + (canW ? '' : 'disabled') + '>Bild ersetzen</button>'
    : '<button class="gold" data-act="art-pick" ' + (canW ? '' : 'disabled') + '>Illustration hochladen</button>';
  $('#stagehint').textContent = hasArt ? 'Bild im Bildfenster ziehen, um es zu verschieben. Mit dem Regler auch kleiner machen, bis es ganz in die Karte passt. Das Original bleibt dabei unverändert.'
    : 'PNG, JPG oder WebP. Das Originalbild wird unverändert gespeichert. Klicke auf einen Bereich der Karte, um ihn zu bearbeiten.';
  const z = $('#art-zoom');
  if (z) z.oninput = () => {
    const f2 = artFits(), W = artWin();
    const a = G.card.art, old = a.scale || f2.cover.scale, ns = f2.cover.scale * (+z.value / 100);
    const cx = W.x + W.w / 2, cy = W.y + W.h / 2, ox = a.x !== undefined ? a.x : f2.cover.x, oy = a.y !== undefined ? a.y : f2.cover.y;
    a.x = cx - (cx - ox) * ns / old; a.y = cy - (cy - oy) * ns / old; a.scale = ns;
    clampArt(); $('#zoomv').textContent = z.value + ' %'; markDirty(); redraw(); updateFillUI();
  };
}
function clampArt() {
  const a = G.card.art, im = G.artImg, W = artWin(); if (!a || !im) return;
  const f = artFits();
  if (!a.scale) a.scale = f.cover.scale;
  if (a.scale < f.contain.scale) a.scale = f.contain.scale;
  const w = im.naturalWidth * a.scale, h = im.naturalHeight * a.scale;
  if (a.x === undefined) a.x = W.x + (W.w - w) / 2; if (a.y === undefined) a.y = W.y + (W.h - h) / 2;
  // größer als das Fenster: Fenster bleibt bedeckt; kleiner: Bild bleibt ganz im Fenster
  a.x = w >= W.w ? Math.min(W.x, Math.max(W.x + W.w - w, a.x)) : Math.max(W.x, Math.min(W.x + W.w - w, a.x));
  a.y = h >= W.h ? Math.min(W.y, Math.max(W.y + W.h - h, a.y)) : Math.max(W.y, Math.min(W.y + W.h - h, a.y));
}
const isSpell = c => !!c && (c.type === 'spell' || c.type === 'curse');
function artWin() { return isSpell(G.card) ? R.SPELL_L.window : G.layout.window; }
function artHasGap() { const a = G.card.art, f = artFits(); return !!(a && f && (a.scale || f.cover.scale) < f.cover.scale - 1e-6); }
function updateFillUI() { const el = $('#fillrow'); if (el) el.hidden = !artHasGap(); }
function canvasPoint(ev) { const cv = $('#preview'), r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * G.layout.W, y: (ev.clientY - r.top) / r.height * G.layout.H }; }
function hitSection(p) {
  const L = G.layout, inC = (P, r) => Math.hypot(p.x - P.x, p.y - P.y) <= (r || P.r);
  const inR = (B) => p.x >= B.x && p.x <= B.x + B.w && p.y >= B.y && p.y <= B.y + B.h;
  if (isSpell(G.card)) { if (inC(L.energy, 75)) return 'werte'; if (p.y < 140 && p.x > 200 && p.x < 840) return 'name'; if (inR(R.SPELL_L.window)) return 'bild'; if (p.y > 950 && p.y < 1020) return 'werte'; if (p.y >= 1020) return 'wirkung'; return null; }
  if (inC(L.energy, 75)) return 'werte';
  if (p.y < 160 && p.x > 200 && p.x < 840) return 'name';
  if (inC(L.element, 70) || (p.y >= 165 && p.y < 210 && p.x > 835)) return 'herkunft';
  if (p.x < 165 && p.y > 200 && p.y < 760) return 'herkunft';
  if (inR(L.attackGrid) || inR(L.moveGrid) || (p.y > 770 && p.y < 935 && p.x > 325 && p.x < 705)) return 'richtungen';
  if (p.y > 770 && p.y < 945) return 'werte';
  if (p.y > 945 && p.y < 1020) return 'herkunft';
  if (p.y > 1030 && p.y < 1380) return 'gaben';
  if (p.y >= 1380) return 'werte';
  if (inR(isSpell(G.card) ? R.SPELL_L.window : L.window)) return 'bild';
  return null;
}
// Werte direkt auf der Karte ändern: Energie, ATK oder DEF antippen und nach oben/unten ziehen (oder Mausrad)
const VALUE_DRAG = { energy: { step: 1, min: 0, max: 10, label: 'Energie' }, atk: { step: 100, min: 0, max: 3500, label: 'ATK' }, def: { step: 100, min: 0, max: 3500, label: 'DEF' }, hp: { step: 500, min: 10000, max: 20000, label: 'HP' } };
function hitValue(p) {
  const L = G.layout, near = (P, r) => P && Math.hypot(p.x - P.x, p.y - P.y) <= r, king = G.card && G.card.type === 'king';
  if (near(L.energy, 82)) return king ? null : 'energy';
  if (isSpell(G.card)) return null;
  if (near(L.atk, 82)) return 'atk';
  if (near(L.def, 82)) return king ? 'hp' : 'def';
  return null;
}
function valueBubble(ev, key) {
  let b = $('#vbubble'); if (!b) { b = document.createElement('div'); b.id = 'vbubble'; b.className = 'vbubble'; document.body.appendChild(b); }
  if (!key) { b.remove(); return; }
  const c = G.card, ev2 = isSpell(c) ? null : PW.evaluate(Object.assign({}, c, { rarity: null })), v = c[key];
  b.innerHTML = '<b>' + VALUE_DRAG[key].label + ' ' + (key === 'energy' ? v : Number(v).toLocaleString('de-DE')) + '</b>' + (ev2 ? '<span>' + String(ev2.total).replace('.', ',') + ' Punkte · ' + esc(PW.rarityName(ev2.rarity)) + '</span>' : '') + '<small>↑ mehr · ↓ weniger</small>';
  if (ev) { b.style.left = Math.min(window.innerWidth - 190, ev.clientX + 26) + 'px'; b.style.top = Math.max(8, ev.clientY - 70) + 'px'; }
}
function setValue(key, v) {
  const c = G.card, D2 = VALUE_DRAG[key]; v = Math.max(D2.min, Math.min(D2.max, v));
  if (+c[key] === v && c[key] !== '' && c[key] != null) return false;
  c[key] = v; const inp = $('#in-' + key); if (inp && document.activeElement !== inp) inp.value = v;
  markDirty(); redraw(); return true;
}
function bindPreview() {
  const cv = $('#preview'), wrap = $('#wrap');
  // Auf dem Handy: Wischen über Energie/ATK/DEF ändert den Wert statt die Seite zu scrollen
  cv.addEventListener('touchstart', ev => { const t = ev.touches[0]; if (t && hitValue(canvasPoint(t))) ev.preventDefault(); }, { passive: false });
  cv.addEventListener('pointerdown', ev => {
    const vk = hitValue(canvasPoint(ev));
    if (vk && ST.state.canWrite) {
      const cur = G.card[vk], base = cur === '' || cur == null || isNaN(+cur) ? VALUE_DRAG[vk].min : +cur;
      G.vdrag = { key: vk, y0: ev.clientY, base, moved: false }; cv.setPointerCapture(ev.pointerId); ev.preventDefault(); aiSnapValue();
      return;
    }
    const p = canvasPoint(ev);
    G.pan = { start: p, moved: false, ox: G.card.art && G.card.art.x, oy: G.card.art && G.card.art.y, inWin: G.artImg && hitSection(p) === 'bild' };
    if (G.pan.inWin) { clampArt(); G.pan.ox = G.card.art.x; G.pan.oy = G.card.art.y; cv.setPointerCapture(ev.pointerId); wrap.classList.add('dragging'); }
  });
  cv.addEventListener('pointermove', ev => {
    if (G.vdrag) {
      const d = G.vdrag, steps = Math.trunc((d.y0 - ev.clientY) / 12);
      if (steps || d.moved) { d.moved = true; setValue(d.key, d.base + steps * VALUE_DRAG[d.key].step); valueBubble(ev, d.key); }
      return;
    }
    if (!G.pan) { const vk = hitValue(canvasPoint(ev)); wrap.classList.toggle('vdrag', !!vk); const p = canvasPoint(ev); wrap.classList.toggle('pan', !!(G.artImg && hitSection(p) === 'bild')); return; }
    if (!G.pan.inWin) return;
    const p = canvasPoint(ev), dx = p.x - G.pan.start.x, dy = p.y - G.pan.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) G.pan.moved = true;
    if (G.pan.moved) { G.card.art.x = G.pan.ox + dx; G.card.art.y = G.pan.oy + dy; clampArt(); markDirty(); redraw(); }
  });
  const end = ev => {
    if (G.vdrag) { const d = G.vdrag; G.vdrag = null; valueBubble(null, null); if (!d.moved) focusSection('werte'); else syncPowerUI(); return; }
    if (!G.pan) return;
    const moved = G.pan.moved, p = G.pan.start; G.pan = null; wrap.classList.remove('dragging');
    if (!moved) { const sec = hitSection(p); if (sec) focusSection(sec); }
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', ev => {
    const vk = hitValue(canvasPoint(ev));
    if (vk && ST.state.canWrite) {
      ev.preventDefault(); const cur = G.card[vk], base = cur === '' || cur == null || isNaN(+cur) ? 0 : +cur;
      setValue(vk, base - Math.sign(ev.deltaY) * VALUE_DRAG[vk].step); valueBubble(ev, vk); clearTimeout(G.vbT); G.vbT = setTimeout(() => valueBubble(null, null), 1200); return;
    }
    if (!G.artImg || hitSection(canvasPoint(ev)) !== 'bild') return;
    ev.preventDefault();
    const z = $('#art-zoom'); if (!z) return;
    z.value = Math.max(100, Math.min(300, +z.value - Math.sign(ev.deltaY) * 4)); z.oninput();
  }, { passive: false });
}
function focusSection(sec) {
  G.focus = sec;
  $$('.sec').forEach(s => s.classList.toggle('focus', s.dataset.sec === sec));
  const el = $('.sec[data-sec="' + sec + '"]');
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); const f = el.querySelector('input,select,button'); if (f && sec !== 'gaben') f.focus({ preventScroll: true }); }
  if (sec === 'bild' && !(G.card.art && G.card.art.id)) $('#file-art').click();
}

/* ---------- Bearbeitungsmenü ---------- */
function pickerHTML(kind, list, current, allowNone) {
  return '<div class="picker" role="group">' + (allowNone ? '<button class="pick none' + (!current ? ' on' : '') + '" data-pick="' + kind + '" data-val="">keine</button>' : '')
    + list.map(x => '<button class="pick' + (current === x.id ? ' on' : '') + '" data-pick="' + kind + '" data-val="' + x.id + '" title="' + esc(x.name + ' · Wappen: ' + (G.crestOverrides[x.crest] ? 'eigenes Bild' : x.crestStatus)) + '">'
      + (crestSrc(x.crest) ? '<img src="' + crestSrc(x.crest) + '" alt="">' : '<span class="ph" style="width:40px;height:40px">?</span>') + '<span>' + esc(x.name) + '</span>'
      + (x.crestStatus === 'Entwurf' && !G.crestOverrides[x.crest] ? '<span class="st">Entwurf</span>' : x.crestStatus === 'Abweichung' ? '<span class="st">ohne Krone</span>' : '') + '</button>').join('') + '</div>';
}
const GRID_ORDER = ['nw', 'n', 'ne', 'w', null, 'e', 'sw', 's', 'se'];
const ARROWS = { nw: '↖', n: '↑', ne: '↗', w: '←', e: '→', sw: '↙', s: '↓', se: '↘' };
function dirBlock(kind, title, spec, only) {
  return '<div class="dirblock"><div class="t ' + kind + '">' + title + '<button class="ghost" data-dirclear="' + kind + '" style="padding:2px 8px;font-size:12px">alle aus</button></div>'
    + '<div class="gridpick">' + GRID_ORDER.map(k => k ? '<button class="' + kind + (spec.dirs[k] ? ' on' : '') + '" data-dir="' + kind + ':' + k + '" aria-pressed="' + !!spec.dirs[k] + '" aria-label="' + title + ' ' + k + '"' + (only && !only.includes(k) ? ' disabled' : '') + '>' + ARROWS[k] + (spec.dirs[k] === 2 ? '<span class="n">2</span>' : '') + '</button>' : '<span class="hero" aria-hidden="true"></span>').join('') + '</div>'
    + '<div class="inline"><label><input type="checkbox" data-numshow="' + kind + '" ' + (spec.showNumber ? 'checked' : '') + '> Zahl neben dem Raster</label><input type="number" min="1" max="9" step="1" data-num="' + kind + '" value="' + esc(spec.number || 1) + '" aria-label="Zahl für ' + title + '" ' + (spec.showNumber ? '' : 'disabled') + '></div></div>';
}
function royalCtl(s, i, g) {
  const sc = s.scope || 'all', lists = { race: D.RACES, class: D.CLASSES, element: D.ELEMENTS }, p = g.param;
  return '<div class="royalctl"><label>Wirkt auf<select data-rgscope="' + i + '">' + [['all', 'alle eigenen Monster'], ['race', 'nur eine Rasse'], ['class', 'nur eine Klasse'], ['element', 'nur ein Element']].map(([k, t]) => '<option value="' + k + '"' + (sc === k ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>'
    + (sc !== 'all' ? '<label>' + ({ race: 'Rasse', class: 'Klasse', element: 'Element' }[sc]) + '<select data-rgtarget="' + i + '"><option value="">bitte wählen</option>' + lists[sc].map(x => '<option value="' + x.id + '"' + (s.target === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' : '')
    + '<label>Stärke (' + p.sign + ' ' + p.unit + ', ' + p.min + '–' + p.max + ')<input type="number" data-rgamount="' + i + '" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + D.royalAmount(g, s) + '"></label></div>';
}
function giftSlotHTML(s, i) {
  const g = (G.card.type === 'king' ? (D.ROYAL_GIFTS || []) : D.GIFTS).find(x => x.id === s.id); if (!g) return '';
  const src = G.giftCrests[g.id] ? G.giftCrests[g.id].src : '';
  if (g.royal) return '<div class="giftslot">' + (src ? '<img src="' + src + '" alt="">' : '<span class="ph">?</span>') + '<div style="min-width:0"><b>' + esc(g.name) + '</b><small>' + (g.kind === 'ct' ? 'CT ' + g.ct : 'Permanent') + ' · ' + String(PW.royalPts(g, s)).replace('.', ',') + ' Punkte</small><small class="short">' + esc(D.giftShort(g, s)) + '</small>' + royalCtl(s, i, g)
    + '</div><div class="ops"><button data-giftmove="' + i + ':-1" aria-label="nach oben" ' + (i === 0 ? 'disabled' : '') + '>↑</button><button data-giftmove="' + i + ':1" aria-label="nach unten" ' + (i === G.card.gifts.length - 1 ? 'disabled' : '') + '>↓</button><button class="danger" data-giftdel="' + i + '" aria-label="entfernen">✕</button></div></div>';
  return '<div class="giftslot">' + (src ? '<img src="' + src + '" alt="">' : '<span class="ph">?</span>')
    + '<div style="min-width:0"><b>' + esc(D.giftTitle(g)) + '</b><small>' + (g.kind === 'ct' ? 'CT ' + g.ct + ' Runden' : 'Permanent') + (src ? '' : ' · kein Wappen') + '</small><small class="short">' + esc(D.giftShort(g)) + '</small><details class="full"><summary>Ausführlicher Text</summary><small>' + esc(D.giftText(g)) + '</small></details>'
    + '</div><div class="ops"><button data-giftmove="' + i + ':-1" aria-label="nach oben" ' + (i === 0 ? 'disabled' : '') + '>↑</button><button data-giftmove="' + i + ':1" aria-label="nach unten" ' + (i === G.card.gifts.length - 1 ? 'disabled' : '') + '>↓</button><button class="danger" data-giftdel="' + i + '" aria-label="entfernen">✕</button></div></div>';
}
// Scroll-Anker: der Abschnitt, in dem zuletzt getippt wurde, bleibt beim Neuzeichnen an derselben Stelle
document.addEventListener('pointerdown', e => { const s = e.target && e.target.closest && e.target.closest('#panel .sec'); G.anchor = s ? { sec: s.dataset.sec, at: Date.now() } : null; }, true);
// Auf dem Handy scrollt die ganze Seite, am PC nur die Spalte
function panelScroller() { const p = $('#panel'); return p && p.scrollHeight > p.clientHeight + 1 && getComputedStyle(p).overflowY !== 'visible' ? p : document.scrollingElement; }
function scrollerTop(sc) { return sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top; }
function panelAnchor() {
  const panel = $('#panel'); if (!panel) return null;
  const sc = panelScroller(), top = Math.max(scrollerTop(sc), 0), secs = [...panel.querySelectorAll('.sec')];
  const want = G.anchor && Date.now() - G.anchor.at < 4000 ? panel.querySelector('.sec[data-sec="' + G.anchor.sec + '"]') : null;
  const el = want || secs.find(s => s.getBoundingClientRect().bottom > top + 4);
  return el ? { sec: el.dataset.sec, off: el.getBoundingClientRect().top - top, idx: secs.indexOf(el), sc, st: sc.scrollTop } : null;
}
function restoreAnchor(a, fallback) {
  const panel = $('#panel'); if (!panel) return;
  if (!a) { panel.scrollTop = fallback; return; }
  const sc = a.sc, secs = [...panel.querySelectorAll('.sec')], el = panel.querySelector('.sec[data-sec="' + a.sec + '"]') || secs[a.idx];
  if (sc === panel) panel.scrollTop = fallback; else sc.scrollTop = a.st;
  if (!el) return;
  sc.scrollTop += (el.getBoundingClientRect().top - Math.max(scrollerTop(sc), 0)) - a.off;
}
function renderPanel() {
  if (isSpellCard(G.card)) return renderSpellPanel();
  const c = G.card, sc = $('#panel') ? $('#panel').scrollTop : 0, anc = panelAnchor();
  const v = (x) => x === null || x === undefined ? '' : esc(x);
  $('#panel').innerHTML = `
  <section class="sec" data-sec="status"><h3>Status <span class="chip ${c.status === 'freigegeben' ? 'rel' : 'draft'}">${c.status === 'freigegeben' ? 'Freigegeben' : 'Balanceentwurf'}</span></h3>
    <div class="status-switch"><button class="draft ${c.status !== 'freigegeben' ? 'on' : ''}" data-status="entwurf">Entwurf</button><button class="rel ${c.status === 'freigegeben' ? 'on' : ''}" data-status="freigegeben">Freigegeben</button></div>
    <div class="issues" id="issues"></div></section>
  <section class="sec kh" data-sec="ki"><h3>✦ KI-Helfer <span class="muted" style="font-family:var(--f-ui);letter-spacing:0;font-size:12.5px">${esc(G.aiLabelText || '')}</span></h3>
    <p class="muted" style="font-size:12.5px;margin:-2px 0 8px">Kein Bock auf Handarbeit? Ein Tipp genügt. Alles lässt sich mit „Rückgängig“ zurücknehmen.</p>
    <div class="kh-grid">
      <button class="gold kh-all" data-act="kh-all" ${c.art && c.art.id ? '' : 'disabled title="Erst eine Illustration hochladen"'}>✦ Alles automatisch<small>Herkunft, Name, Werte und Steinfarben</small></button>
      <button data-act="name-ai" ${c.art && c.art.id ? '' : 'disabled'}>✦ Name<small>passend zum Bild</small></button>
      <button data-act="ident-ai" ${c.art && c.art.id ? '' : 'disabled'}>✦ Herkunft<small>Element, Rasse, Klasse</small></button>
      <button data-act="kh-roll">🎲 Werte<small>passend zur Seltenheit</small></button>
      <button data-act="kh-colors" ${c.element ? '' : 'disabled title="Erst ein Element wählen"'}>🎨 Farben<small>Steine passend zum Element</small></button>
    </div>
    <div class="eyebrow" style="margin:10px 0 6px">Ziel-Seltenheit für alle KI-Werkzeuge</div>
    <div class="kh-target">${[['', 'Wie auf der Karte'], ...D.RARITIES.map(r => [r.id, r.name]), ['zufall', 'Zufall']].map(([k, t]) => '<button class="' + ((G.khRar || '') === k ? 'on' : '') + '" data-khrar="' + k + '">' + esc(t) + '</button>').join('')}</div>
    <p class="muted" style="font-size:12px;margin:6px 0 0">Jetzt: <b>${esc(khTargetLabel())}</b>. Alles, was gewürfelt wird, bleibt in dieser Seltenheit – nichts wird aus Versehen zu stark.</p>
    ${G.undo ? '<div class="roll-row"><button data-act="kh-undo">↶ Rückgängig</button></div>' : ''}</section>
  <section class="sec" data-sec="bild"><h3>Illustration</h3>
    <div class="drop" id="drop">${c.art && c.art.id ? '<span>' + esc(c.art.name || 'Bild') + (c.art.w ? ' · ' + c.art.w + ' × ' + c.art.h + ' Pixel' : '') + '</span>' : '<span>Bild hierher ziehen oder auswählen</span>'}
      <button data-act="art-pick" ${ST.state.canWrite ? '' : 'disabled'}>${c.art && c.art.id ? 'Bild ersetzen' : 'Bild auswählen'}</button></div>
    <div id="fillrow" class="inline" ${artHasGap() ? '' : 'hidden'}><span>Freien Rand füllen mit</span>
      <select id="in-fill" aria-label="Randfüllung"><option value="blur" ${(c.art && c.art.fill) !== 'color' ? 'selected' : ''}>Unschärfe des Bildes</option><option value="color" ${(c.art && c.art.fill) === 'color' ? 'selected' : ''}>Farbe</option></select>
      <input type="color" id="in-fillcolor" value="${esc((c.art && c.art.fillColor) || '#0b0f16')}" aria-label="Randfarbe" ${(c.art && c.art.fill) === 'color' ? '' : 'hidden'}></div>
    <p class="muted" style="font-size:12.5px">Zum Verkleinern den Regler unter der Karte nach links ziehen oder „Ganz zeigen“ wählen. Hintergrund entfernen ist hier nicht eingerichtet.</p></section>
  <section class="sec" data-sec="name"><h3>${c.type === 'king' ? 'Königsname' : 'Heldenname'}</h3>
    <div class="namerow"><input type="text" id="in-name" value="${v(c.name)}" maxlength="40" aria-label="Heldenname"><button data-act="name-ai" id="btn-nameai" title="Passenden Namen zur Illustration finden">✦ Name finden</button></div>
    <label class="inline" style="font-size:13px"><input type="checkbox" id="in-autoname" ${autoNameOn() ? 'checked' : ''}> Beim Hochladen einer Illustration automatisch benennen (wenn das Namensfeld leer ist)</label>
    <div id="name-sugg">${nameSuggHTML()}</div>
    <label>Schriftgröße für lange Namen · <span id="nsv">${c.nameScale || 100} %</span><input type="range" id="in-nscale" min="60" max="100" step="1" value="${c.nameScale || 100}"></label></section>
  <section class="sec" data-sec="werte"><h3>Spielwerte <span id="pw-live" class="pwlive">${liveBadge(c)}</span></h3>
    <div class="ctype ctype4"><button class="${c.type !== 'king' ? 'on' : ''}" data-cardtype="hero">⚔ Held</button><button class="${c.type === 'king' ? 'on' : ''}" data-cardtype="king">👑 König</button><button data-cardtype="spell">✦ Zauber</button><button data-cardtype="curse">☠ Fluch</button></div>
    ${c.type === 'king' ? `<div class="row2"><label>ATK (2.000–3.500)<input type="number" id="in-atk" min="2000" max="3500" step="100" value="${v(c.atk)}"></label>
    <label>HP (10.000–20.000)<input type="number" id="in-hp" min="10000" max="20000" step="500" value="${v(c.hp)}"></label></div>
    <p class="muted" style="font-size:12px;margin:0">Könige haben keine Energiekosten (Krone auf der Karte) und keine DEF.</p>` : `<div class="row3"><label>Energie<input type="number" id="in-energy" min="0" max="10" value="${v(c.energy)}"></label>
    <label>ATK<input type="number" id="in-atk" min="0" max="3500" step="100" value="${v(c.atk)}"></label>
    <label>DEF<input type="number" id="in-def" min="0" max="3500" step="100" value="${v(c.def)}"></label></div>`}
    <div><div class="eyebrow" style="margin-bottom:6px">Seltenheit</div>${pickerHTML('rarity', D.RARITIES, c.rarity)}</div>
    ${c.type === 'king' ? aiRow([['roll-all', '🎲 Alle Werte'], ['roll-stats', '🎲 ATK/HP']]) : aiRow([['roll-all', '🎲 Alle Werte'], ['roll-energy', '🎲 Energie'], ['roll-stats', '🎲 ATK/DEF']])}
    <p class="muted" style="font-size:12px;margin:0">Tipp: Auf der Karte Energie, ATK oder DEF antippen und nach oben oder unten ziehen (am PC auch Mausrad) – Energie in 1er-, ATK/DEF in 100er-Schritten.</p>
    <label class="inline" style="font-size:12.5px"><input type="checkbox" id="in-rollkeep" ${G.rollKeepGifts ? 'checked' : ''}> bei „Alle Werte“ eigene Gaben behalten</label>
    <p class="muted" style="font-size:12px">Einzeln würfeln ändert nur diesen Teil; der Rest bleibt, und alles passt zusammen in die Ziel-Seltenheit.</p></section>
  ${powerSection(c)}
  <section class="sec" data-sec="herkunft"><h3>Element, Rasse, Klasse</h3>
    ${aiRow([['ident-ai', '✦ Alles aus dem Bild', 'btn-identai'], ['ident-element', '✦ Element'], ['ident-race', '✦ Rasse'], ['ident-class', '✦ Klasse']], !(c.art && c.art.id))}
    <div><div class="eyebrow" style="margin-bottom:6px">Element</div>${pickerHTML('element', D.ELEMENTS, c.element)}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">Zweites Element (optional, Kreis wird geteilt)</div>${pickerHTML('element2', D.ELEMENTS.filter(x => x.id !== c.element), c.element2, true)}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">Rasse</div>${pickerHTML('race', D.RACES, c.race)}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">Zweite Rasse (optional)</div>${pickerHTML('race2', D.RACES.filter(x => x.id !== c.race), c.race2, true)}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">Klasse</div>${pickerHTML('class0', D.CLASSES, c.classes[0])}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">Zweite Klasse (optional)</div>${pickerHTML('class1', D.CLASSES.filter(x => x.id !== c.classes[0]), c.classes[1], true)}</div>
    <p class="muted" style="font-size:12px">Die Leiste links wächst automatisch: 2 Kammern als Grundform, 3 oder 4 Kammern, sobald du eine zweite Rasse oder Klasse wählst.</p></section>
  <section class="sec" data-sec="gestaltung"><h3>Gestaltung</h3>
    ${aiRow([['kh-colors', '🎨 Steine passend zum Element'], ['kh-theme', '🎨 Rahmen passend zum Bild']])}
    <div><div class="eyebrow" style="margin-bottom:6px">Schriftsatz</div>
      <div class="fontsets">${Object.entries(R.FONT_SETS).map(([k, fs]) => { const F = fs.fonts; return '<button class="fontset' + ((c.style.fontSet || 'original') === k && !Object.keys(c.style.fonts || {}).length ? ' on' : '') + '" data-fontset="' + k + '"><span class="fs-name" style="font-family:\'' + R.FONTS[F.name].family + '\',serif">' + esc(fs.name) + '</span><span class="fs-text" style="font-family:\'' + R.FONTS[F.text].family + '\',serif">Kann zwei Helden angreifen</span></button>'; }).join('')}</div>
      <details class="fontroles" ${Object.keys(c.style.fonts || {}).length ? 'open' : ''}><summary>Schrift für einzelne Bereiche wählen</summary>
        ${FONT_ROLES.map(([r, n]) => { const cur = R.resolveFonts(c.style)[r]; const curKey = Object.keys(R.FONTS).find(k => R.FONTS[k] === cur); return '<label>' + n + '<select data-fontrole="' + r + '" style="font-family:\'' + cur.family + '\',serif;font-size:16px">' + Object.entries(R.FONTS).map(([k, f]) => '<option value="' + k + '"' + (k === curKey ? ' selected' : '') + ' style="font-family:\'' + f.family + '\',serif">' + esc(f.name) + ' · ' + esc(f.kind) + '</option>').join('') + '</select></label>'; }).join('')}
      </details></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Veredelung des Namens</div><div class="namestyles">
      <button class="ns ${(c.style.name || 'normal') === 'normal' ? 'on' : ''}" data-style="name:normal"><span style="color:#2a1a0c">Tinte</span></button>
      ${Object.entries(R.NAME_STYLES).map(([k, v]) => '<button class="ns' + (c.style.name === k ? ' on' : '') + '" data-style="name:' + k + '"><span class="' + (v.stops ? 'metal' : 'emboss') + '" style="' + (v.stops ? '--m:linear-gradient(180deg,' + v.stops.map((x, i) => x + ' ' + [0, 20, 44, 52, 60, 82, 100][i] + '%').join(',') + ');--e:' + v.edge : '') + '">' + esc(v.name) + '</span></button>').join('')}
    </div><p class="muted" style="font-size:12px;margin-top:4px">Metallfolie für epische Karten. Wird im Export in voller Auflösung berechnet.</p></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Kartenrahmen</div><div class="swatches">${Object.entries(R.THEMES).map(([k, t]) => '<button class="sw theme' + (R.themeKey(c.style.theme) === k ? ' on' : '') + '" data-style="theme:' + k + '"><i class="th th-' + k + '"></i>' + esc(t.name) + '</button>').join('')}</div></div>
    <div class="eyebrow">Edelsteine der Wertefelder</div>
    ${[['energy', 'Energie'], ['atk', 'ATK'], ['def', 'DEF'], ['element', 'Elementschild']].map(([k, n]) => '<div class="gemrow"><div class="gemhead"><span class="eyebrow">' + n + '</span><span class="muted">' + esc(R.GEMS[R.gemKey(c.style[k])].name) + '</span></div><div class="gems">' + Object.entries(R.GEMS).map(([g, v]) => '<button class="gem' + (R.gemKey(c.style[k]) === g ? ' on' : '') + '" data-style="' + k + ':' + g + '" title="' + esc(v.name) + '" aria-label="' + n + ' ' + esc(v.name) + '"><i style="background:' + gemSwatch(g) + '"></i></button>').join('') + '</div></div>').join('')}
    <div class="row2">${[['atkArrow', 'Angriffspfeile'], ['movArrow', 'Laufpfeile']].map(([k, n]) => '<div><div class="eyebrow" style="margin-bottom:6px">' + n + '</div><div class="swatches dots">' + ARROW_COLORS.map(([t, col]) => '<button class="dot' + (c.style[k] === col ? ' on' : '') + '" data-style="' + k + ':' + col + '" style="background:radial-gradient(circle at 35% 30%,#fff8 0,' + col + ' 45%,#0008 120%)" aria-label="' + n + ' ' + t + '" title="' + t + '"></button>').join('') + '</div></div>').join('')}</div>
    <button class="ghost" data-act="style-reset" style="justify-self:start">Gestaltung zurücksetzen</button></section>
  <section class="sec" data-sec="richtungen"><h3>Richtungen</h3>
    ${aiRow([['roll-dirs', '🎲 Richtungen & Laufschritte']])}
    <p class="muted" style="font-size:12.5px">Pfeil antippen: an, noch einmal: doppelte Länge, dritter Tipp: aus. Die Zahl zeigt die Reichweite.</p>
    ${c.type === 'king' ? '<div class="row2">' + dirBlock('atk', 'Angriff', c.attack, PW.KING.dirs) + '<div class="dirblock"><div class="t mov">Laufen</div><p class="muted" style="font-size:13px">Könige können nicht laufen.</p></div></div><p class="muted" style="font-size:12px">Könige greifen höchstens in 3 Richtungen an: gerade, schräg links, schräg rechts.</p>' : '<div class="row2">' + dirBlock('atk', 'Angriff', c.attack) + dirBlock('mov', 'Laufen', c.move) + '</div>'}</section>
  <section class="sec" data-sec="gaben"><h3>${c.type === 'king' ? 'Königliche Gaben' : 'Gaben'} <span class="muted tnum" style="font-family:var(--f-ui);font-size:12px;letter-spacing:0">${c.gifts.length} / 3</span></h3>
    ${aiRow([['roll-gifts', '🎲 Gaben würfeln']])}
    ${c.gifts.map(giftSlotHTML).join('') || '<p class="muted" style="font-size:13px">' + (c.type === 'king' ? 'Keine königlichen Gaben. Bis zu 3 je König: Gebot der Krone, Zorn des Imperators, Ewiges Bollwerk.' : 'Keine Gaben. Karten ohne Gaben sind erlaubt.') + '</p>'}
    <button data-act="gift-add" ${c.gifts.length >= 3 ? 'disabled' : ''}>+ Gabe hinzufügen</button>
    <p class="muted" style="font-size:12px">Auf der Karte steht der Kurztext. Die ausführliche Fassung aus der ${esc(D.SOURCE)} wird beim JSON-Export mitgegeben, für die Anzeige beim Antippen im Online-Spiel.</p></section>
  <section class="sec"><p class="muted" style="font-size:12px">${G.cardId ? 'Gespeicherte Karte' : 'Neue Karte, noch nicht gespeichert'}${G.cardId ? ' · <button class="ghost danger" data-act="delete" style="padding:2px 8px">Löschen</button> <button class="ghost" data-act="duplicate" style="padding:2px 8px">Duplizieren</button>' : ''}</p></section>`;
  restoreAnchor(anc, sc);
  if (G.focus) $$('.sec').forEach(s => s.classList.toggle('focus', s.dataset.sec === G.focus));
  bindPanel(); updateIssues(); renderStagebar(); updateFloat();
}
function bandText() {
  const B = PW.BANDS;
  return 'unter ' + B[1].lo + ' Gewöhnlich, ' + PW.bandFrom(B[1]) + ' Ungewöhnlich, ' + PW.bandFrom(B[2]) + ' Selten, ' + PW.bandFrom(B[3]) + ' Legendär; ab ' + PW.WARN_AT + ' Balanceprüfung. Gaben höchstens: '
    + B.map(b => PW.rarityName(b.id) + ' ' + PW.GIFT_LIMIT[b.id]).join(', ');
}
function powerSection(c) {
  const ev = PW.evaluate(c), band = PW.BANDS.find(b => b.id === ev.rarity);
  const pct = Math.min(100, Math.max(0, ev.total) / PW.WARN_AT * 100);
  return '<section class="sec" data-sec="power"><h3>Powerscaling <span class="muted tnum" style="font-family:var(--f-ui);letter-spacing:0;font-size:13px">' + String(ev.total).replace('.', ',') + ' Punkte</span></h3>'
    + '<div class="pbar" aria-hidden="true">' + PW.BANDS.map(b => '<span class="pb-' + b.id + '" style="flex:' + Math.round(b.hi - b.lo + 0.01) + '"></span>').join('') + '<i style="left:' + pct + '%"></i></div>'
    + '<div class="pbar-l pbar-l2"><span>0</span>' + PW.BANDS.slice(1).map(b => '<span style="left:' + (b.lo / PW.WARN_AT * 100) + '%">' + b.lo + '</span>').join('') + '<span>' + PW.WARN_AT + '</span></div>'
    + '<div class="pstat">' + ev.status.map(x => '<span class="pst pst-' + x.code + '">' + esc(x.text) + '</span>').join('') + '</div>'
    + '<table class="ptab">' + ev.rows.map(([k, v, sub]) => '<tr' + (sub ? ' class="sum"' : '') + '><td>' + esc(k) + '</td><td class="tnum">' + (v === null ? '<span class="muted">nicht bewertet</span>' : (!sub && v > 0 && /^Energie/.test(k) ? '+' : '') + String(v).replace('.', ',')) + '</td></tr>').join('') + '<tr class="sum"><td>Gesamt-Power</td><td class="tnum">' + String(ev.total).replace('.', ',') + '</td></tr></table>'
    + '<p class="muted" style="font-size:12px">Alle Bestandteile werden getrennt berechnet und addiert. Energie zählt nach fester Tabelle (0 Energie +50 … 10 Energie −15). Seltenheit (vorläufig): ' + bandText() + '.</p>'
    + '<label>Sonder-Synergie (Gesamtpaket, von Hand)<select id="in-synergy">' + PW.SYNERGY.map(([v, t]) => '<option value="' + v + '"' + (+c.synergy === v ? ' selected' : '') + '>' + (v ? '+' + v : '0') + ' · ' + t + '</option>').join('') + '</select></label>'
    + '<p style="font-size:13.5px">Ergebnis: <b>' + esc(PW.rarityName(ev.rarity)) + '</b> · höchstens ' + PW.GIFT_LIMIT[ev.rarity] + (PW.GIFT_LIMIT[ev.rarity] === 1 ? ' Gabe' : ' Gaben') + '.</p>'
    + '<label class="ai-opt"><input type="checkbox" id="in-autorar" ' + (c.autoRarity !== false ? 'checked' : '') + '> <span><b>Seltenheit automatisch</b><small>Folgt beim Eintippen der Gesamt-Power, auch wenn du die Energie änderst.</small></span></label>'
    + (c.autoRarity === false && c.rarity !== ev.rarity ? '<button data-act="power-apply">Berechnete Seltenheit übernehmen</button>' : '')
    + '<p class="muted" style="font-size:12px"><b>' + (window.WOK_DESKTOP ? 'PC-Version ' + esc(window.WOK_APPVER || '') : 'Cloud-Version') + ' · ' + esc(PW.SOURCE) + '</b>. Noch nicht im Master-Regelwerk; das Regelwerk hat Vorrang. Fehler werden angezeigt, nie still korrigiert.</p></section>';
}
function bindPanel() {
  const c = G.card;
  const num = (id, key) => { const el = $(id); el.oninput = () => { c[key] = el.value === '' ? '' : Math.max(0, Math.round(+el.value)); markDirty(); redraw(); }; };
  $('#in-name').oninput = e => { c.name = e.target.value; markDirty(); redraw(); };
  const an = $('#in-autoname'); if (an) an.onchange = () => { try { localStorage.setItem('wok-autoname', an.checked ? '1' : '0'); } catch (e) {} };
  $('#in-nscale').oninput = e => { c.nameScale = +e.target.value; $('#nsv').textContent = c.nameScale + ' %'; markDirty(); redraw(); };
  if ($('#in-energy')) num('#in-energy', 'energy'); num('#in-atk', 'atk'); if ($('#in-def')) num('#in-def', 'def'); if ($('#in-hp')) num('#in-hp', 'hp');
  $$('[data-cardtype]').forEach(bt => bt.onclick = () => setCardType(bt.dataset.cardtype));
  const sy = $('#in-synergy'); if (sy) sy.onchange = () => { c.synergy = +sy.value; markDirty(); renderPanel(); };
  bindPowerToggles();
  const rk = $('#in-rollkeep'); if (rk) rk.onchange = () => { G.rollKeepGifts = rk.checked; };
  $$('[data-rgscope]').forEach(el => el.onchange = () => { const g = c.gifts[+el.dataset.rgscope]; g.scope = el.value; g.target = null; markDirty(); renderPanel(); redraw(); });
  $$('[data-rgtarget]').forEach(el => el.onchange = () => { c.gifts[+el.dataset.rgtarget].target = el.value || null; markDirty(); renderPanel(); redraw(); });
  $$('[data-rgamount]').forEach(el => el.onchange = () => { const g = c.gifts[+el.dataset.rgamount], R0 = D.ROYAL_GIFTS.find(x => x.id === g.id); g.amount = D.royalAmount(R0, { amount: +el.value }); markDirty(); renderPanel(); redraw(); });
  $$('[data-khrar]').forEach(bt => bt.onclick = () => { G.khRar = bt.dataset.khrar; try { localStorage.setItem('wok-kh-rar', G.khRar); } catch (e) {} renderPanel(); });

  const fs = $('#in-fill'), fc = $('#in-fillcolor');
  if (fs) fs.onchange = () => { if (!c.art) return; c.art.fill = fs.value; fc.hidden = fs.value !== 'color'; markDirty(); redraw(); };
  if (fc) fc.oninput = () => { if (!c.art) return; c.art.fillColor = fc.value; c.art.fill = 'color'; markDirty(); redraw(); };
  $$('[data-fontrole]').forEach(el => el.onchange = () => { c.style.fonts = Object.assign({}, c.style.fonts || {}, { [el.dataset.fontrole]: el.value }); markDirty(); renderPanel(); redraw(); });
  const drop = $('#drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) uploadArt(f); };
}
function updateIssues() {
  const el = $('#issues'); if (!el || !G.card) return;
  const anc = panelAnchor(), st0 = $('#panel').scrollTop;
  const list = validate(G.card, G.renderIssues);
  const ord = { error: 0, warn: 1, info: 2 };
  list.sort((a, b) => ord[a.level] - ord[b.level]);
  const ne = list.filter(x => x.level === 'error').length, nw = list.filter(x => x.level === 'warn').length;
  el.innerHTML = '<p style="font-size:13px">' + (ne ? '<b style="color:var(--bad)">' + ne + ' fehlt oder passt nicht</b>' : '<b style="color:var(--ok)">Alles Nötige ist ausgefüllt</b>') + (nw ? ' · <span style="color:var(--warn)">' + nw + ' Hinweise</span>' : '') + '</p>'
    + list.map(x => '<button class="issue ' + x.level + '" data-goto="' + (x.sec || '') + '"><i></i><span>' + esc(x.text) + '</span></button>').join('');
  G.lastIssues = list;
  restoreAnchor(anc, st0);
}
function bindPowerToggles() {
  const ar = $('#in-autorar'), ae = null;
  if (ar) ar.onchange = () => { G.card.autoRarity = ar.checked; markDirty(); renderPanel(); redraw(); };
  if (ae) ae.onchange = () => { G.card.autoEnergy = ae.checked; markDirty(); renderPanel(); redraw(); };
}
function refreshPower() { const old = $('.sec[data-sec="power"]'); if (!old || !G.card) return; const t = document.createElement('div'); t.innerHTML = powerSection(G.card); old.replaceWith(t.firstElementChild); const sy = $('#in-synergy'); if (sy) sy.onchange = () => { G.card.synergy = +sy.value; markDirty(); renderPanel(); }; bindPowerToggles(); updateIssues(); }
function liveBadge(c) {
  const ev = PW.evaluate(Object.assign({}, c, { rarity: null }));
  return '<span class="tnum">' + String(ev.total).replace('.', ',') + ' Punkte</span> <span class="rchip r-' + ev.rarity + '">' + esc(PW.rarityName(ev.rarity)) + '</span>';
}
function applyAuto() {
  const c = G.card; if (!c || isSpellCard(c)) return false;
  const has = v => v !== '' && v !== null && v !== undefined;
  if (!has(c.atk) || !has(c.type === 'king' ? c.hp : c.def)) return false;   // erst rechnen, wenn ATK und DEF eingetragen sind
  let changed = false;
  // Power-System 2.0: Energie wird nie automatisch gesetzt, nur die Seltenheit folgt der Gesamt-Power
  const ev = PW.evaluate(Object.assign({}, c, { rarity: null }));
  if (c.autoRarity !== false && c.rarity !== ev.rarity) { c.rarity = ev.rarity; changed = true; }
  return changed;
}
let powerQueued = false;
function syncPowerUI() {
  if (powerQueued) return; powerQueued = true;
  requestAnimationFrame(() => {
    powerQueued = false; const c = G.card; if (!c) return;
    refreshPower();
    const b = $('#pw-live'); if (b) b.innerHTML = liveBadge(c);
    updateFloat();
    const en = $('#in-energy'); if (en && document.activeElement !== en && String(en.value) !== String(c.energy ?? '')) en.value = c.energy ?? '';
    $$('[data-pick="rarity"]').forEach(x => x.classList.toggle('on', x.dataset.val === c.rarity));
  });
}
function markDirty() { G.dirty = true; const d = $('#dirty'); if (d) d.hidden = false; if (applyAuto()) redraw(); syncPowerUI(); }
function clearDirty() { G.dirty = false; const d = $('#dirty'); if (d) d.hidden = true; }

/* ---------- Aktionen ---------- */
// Wurde die geöffnete Karte woanders geändert (AI-Modus, Abgleich, anderes Gerät) und hier nichts verändert, neu laden
function refreshOpenCard() {
  if (!G.cardId || G.dirty || G.khBusy || G.identing || G.naming) return;
  const s = ST.get(G.cardId); if (!s) return;
  if (s.updated === G.loadedUpdated) return;
  const keepTab = G.tab; G.card = normalize(clone(s)); delete G.card.id; G.loadedUpdated = s.updated; G.artSrc = null; G.artImg = null;
  renderPanel(); redraw(); ensureArt(G.card).then(() => { renderStagebar(); redraw(); }); G.tab = keepTab;
}
function openCard(id) {
  const c = id ? ST.get(id) : null; G.loadedUpdated = c ? c.updated : null;
  G.card = normalize(c ? clone(c) : blankCard()); G.cardId = c ? c.id : null; delete G.card.id;
  G.artImg = null; G.artSrc = null; G.focus = null; clearDirty();
  renderPanel(); renderLib(); redraw();
  ensureArt(G.card).then(() => { renderStagebar(); redraw(); });
  if (window.innerWidth <= 980) { G.tab = 'card'; $('.ws').dataset.tab = 'card'; markTabs(); }
}
function guard(next) {
  if (!G.dirty) { next(); return; }
  showModal('Ungespeicherte Änderungen', '<p>Die Karte „' + esc(G.card.name || 'Ohne Namen') + '“ hat Änderungen, die noch nicht gespeichert sind.</p>',
    '<button data-act="close">Zurück</button><button class="danger" data-act="discard">Verwerfen</button><button class="gold" data-act="save-continue" ' + (ST.state.canWrite ? '' : 'disabled') + '>Speichern und weiter</button>');
  G.pendingNext = next;
}
async function save() {
  if (!ST.state.canWrite) { toast('Du kannst diese Karten nur ansehen.'); return false; }
  try {
    const data = clone(G.card); if (G.cardId) data.id = G.cardId;
    const old = G.cardId && ST.get(G.cardId); if (old && old.created) data.created = old.created;
    if (old && old.folder !== undefined && G.card.folder === undefined) data.folder = old.folder; // Ordner bleibt beim Speichern erhalten
    if (old && old.pool !== undefined && G.card.pool === undefined) { data.pool = old.pool; if (old.starterCount) data.starterCount = old.starterCount; } // Verteilung ebenso
    G.cardId = await ST.put(data); G.loadedUpdated = (ST.get(G.cardId) || {}).updated; clearDirty(); renderLib();
    toast('Gespeichert.'); return true;
  } catch (e) {
    toast(e && e.code === 'quota_exceeded' ? 'Der Speicher ist voll. Lösche alte Karten oder Bilder.' : 'Speichern fehlgeschlagen. Bitte noch einmal versuchen.'); return false;
  }
}
async function uploadArt(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast('Bitte ein PNG-, JPG- oder WebP-Bild wählen.'); return; }
  if (file.size > 20 * 1024 * 1024) { toast('Das Bild ist größer als 20 MB. Bitte eine kleinere Datei wählen.'); return; }
  toast('Bild wird gespeichert …', 8000);
  try {
    const r = await ST.putImage(file);
    const img = await R.loadImage(r.url);
    if (!img) throw new Error('decode');
    G.card.art = { id: r.id, name: file.name, w: img.naturalWidth, h: img.naturalHeight };
    G.artImg = img; G.artSrc = r.id; clampArt();
    markDirty(); renderPanel(); redraw(); toast('Illustration eingesetzt. Ziehe sie im Bildfenster zurecht.');
    if (!G.card.name && autoNameOn()) findName(true);
    if (img.naturalWidth < 900) toast('Hinweis: Das Bild ist nur ' + img.naturalWidth + ' Pixel breit und kann im Druck unscharf wirken.', 5000);
  } catch (e) { toast(e && e.code === 'not_granted' ? 'Bilder hochladen dürfen nur Personen mit Bearbeitungsrecht.' : 'Das Bild konnte nicht gespeichert werden.'); }
}
function setStatus(st) {
  if (st === 'freigegeben') {
    const err = (G.lastIssues || []).filter(x => x.level === 'error');
    if (err.length) { toast('Freigabe nicht möglich: ' + err.length + ' Punkte fehlen noch. Siehe Prüfung.'); return; }
    G.card.released = new Date().toISOString().slice(0, 10);
  }
  G.card.status = st; markDirty(); renderPanel(); redraw();
}
function cycleDir(kind, k) {
  if (G.card.type === 'king') {
    if (kind !== 'atk') { toast('Könige können nicht laufen.'); return; }
    if (!PW.KING.dirs.includes(k)) { toast('Könige greifen nur gerade, schräg links oder schräg rechts an.'); return; }
    if (G.card.attack.dirs[k]) delete G.card.attack.dirs[k]; else G.card.attack.dirs[k] = 1;
    markDirty(); renderPanel(); redraw(); return;
  }
  const spec = kind === 'atk' ? G.card.attack : G.card.move;
  const v = spec.dirs[k] || 0; const n = v === true ? 1 : v;
  spec.dirs[k] = n === 0 ? 1 : n === 1 ? 2 : 0; if (!spec.dirs[k]) delete spec.dirs[k];
  markDirty(); renderPanel(); redraw();
}

/* ---------- Gaben-Auswahl ---------- */
function giftPicker() {
  if (G.card.type === 'king') {
    const used0 = new Set(G.card.gifts.map(g => g.id));
    showModal('Königliche Gabe auswählen', '<div class="giftlist">' + D.ROYAL_GIFTS.map(g => { const src = G.giftCrests[g.id] ? G.giftCrests[g.id].src : '';
      return '<button class="giftopt" data-royalpick="' + g.id + '" ' + (used0.has(g.id) ? 'disabled' : '') + '>' + (src ? '<img src="' + src + '" alt="">' : '<span class="ph">?</span>') + '<span style="min-width:0"><b>' + esc(g.name) + '</b><small class="short">Karte: ' + esc(D.giftShort(g, { scope: 'all' })) + '</small><small>' + esc(g.text) + '</small></span><span class="tags"><span class="chip">Permanent</span>' + (used0.has(g.id) ? '<span class="chip">schon auf der Karte</span>' : '') + '</span></button>'; }).join('') + '</div>'
      + '<p class="muted" style="font-size:12.5px">Wirkungsbereich (alle eigenen Monster oder nur eine Rasse, Klasse oder ein Element) und Stärke stellst du danach direkt an der Gabe ein.</p>', '<button data-act="close">Abbrechen</button>');
    return;
  }
  const used = new Set(G.card.gifts.map(g => g.id));
  const row = g => {
    const src = G.giftCrests[g.id] ? G.giftCrests[g.id].src : '';
    const dis = used.has(g.id);
    return '<button class="giftopt" data-giftpick="' + g.id + '" ' + (dis ? 'disabled' : '') + ' data-q="' + esc((g.name + ' ' + g.text).toLowerCase()) + '">' + (src ? '<img src="' + src + '" alt="">' : '<span class="ph">?</span>')
      + '<span style="min-width:0"><b>' + esc(D.giftTitle(g)) + '</b><small class="short">Karte: ' + esc(D.giftShort(g)) + '</small><small>Ausführlich: ' + esc(D.giftText(g)) + '</small></span>'
      + '<span class="tags"><span class="chip">' + (g.kind === 'ct' ? 'CT ' + g.ct : 'Permanent') + '</span>' + (src ? '' : '<span class="chip draft">kein Wappen</span>') + (used.has(g.id) ? '<span class="chip">schon auf der Karte</span>' : '') + '</span></button>';
  };
  const hero = D.GIFTS;
  showModal('Gabe auswählen', '<input type="search" id="giftq" placeholder="Gabe suchen" aria-label="Gabe suchen">'
    + '<div class="eyebrow">Permanente Gaben</div><div class="giftlist">' + hero.filter(g => g.kind === 'permanent').map(row).join('') + '</div>'
    + '<div class="eyebrow">CT-Gaben</div><div class="giftlist">' + hero.filter(g => g.kind === 'ct').map(row).join('') + '</div>',
    '<button data-act="close">Abbrechen</button>');
  $('#giftq').oninput = e => { const q = e.target.value.toLowerCase(); $$('.giftopt').forEach(b => b.hidden = q && !b.dataset.q.includes(q)); };
  $('#giftq').focus();
}

/* ---------- Dialoge ---------- */
// Neue Karte: zuerst die Kartenart wählen, dann erst die Einzelheiten
function newTypeDialog() {
  const T = [['hero', '⚔', 'Held', 'ATK, DEF, Energie, Laufen, Angreifen und bis zu drei Gaben'], ['king', '👑', 'König', 'HP bis 20.000, ATK bis 3.500, bis zu drei königliche Gaben'], ['spell', '✦', 'Zauber', 'Hilft dir: Stärken, Schützen, Heilen, Ziehen …'], ['curse', '☠', 'Fluch', 'Schadet dem Gegner: Schwächen, Vergiften, Schaden …']];
  showModal('Neue Karte – was möchtest du machen?', '<div class="tp-grid tp4">' + T.map(([k, ic, t, sub]) => '<button class="tp ' + k + '" data-act="newtype" data-t="' + k + '"><span class="tp-ic">' + ic + '</span><b>' + t + '</b><small>' + sub + '</small></button>').join('') + '</div>', '');
}
function showModal(title, body, foot) {
  $('#modal').innerHTML = '<div class="modalback" data-act="close-back"><section class="modal" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><header><h2>' + esc(title) + '</h2><button data-act="close" aria-label="Schließen">✕</button></header>' + body + (foot ? '<footer>' + foot + '</footer>' : '') + '</section></div>';
}
function closeModal() { $('#modal').innerHTML = ''; }

/* ---------- Wappenbibliothek ---------- */
let crestTab = 'races';
function crestLibrary() {
  const cats = { races: ['Rassen', D.RACES], classes: ['Klassen', D.CLASSES], elements: ['Elemente', D.ELEMENTS], rarities: ['Seltenheit', D.RARITIES], gifts: ['Gaben', D.GIFTS.map(g => ({ id: g.id, name: D.giftTitle(g), crest: crestKeyOfGift(g), crestStatus: g.crest ? 'Designreferenz' : 'kein Wappen' }))] };
  const [title, list] = cats[crestTab];
  showModal('Wappenbibliothek', '<p class="muted" style="font-size:13px">Die Wappen stammen aus deinen Übersichten. Ein Wappen wird auf jeder Karte identisch eingesetzt. Ein eigenes Bild ersetzt das Wappen überall; „Original“ stellt es wieder her.</p>'
    + '<div class="tabs">' + Object.entries(cats).map(([k, [t]]) => '<button data-crtab="' + k + '" class="' + (k === crestTab ? 'on' : '') + '">' + t + '</button>').join('') + '</div>'
    + '<div class="crestgrid">' + list.map(x => {
      const src = crestSrc(x.crest), own = !!G.crestOverrides[x.crest];
      return '<div class="cresttile">' + (src ? '<img src="' + src + '" alt="">' : '<span class="ph">?</span>') + '<b>' + esc(x.name) + '</b><span class="chip ' + (own ? 'rel' : x.crestStatus === 'bestätigt' ? 'rel' : 'draft') + '">' + (own ? 'eigenes Bild' : esc(x.crestStatus)) + '</span>'
        + '<span class="btns"><button data-crestup="' + esc(x.crest) + '" ' + (ST.state.canWrite ? '' : 'disabled') + '>Eigenes Bild</button>' + (own ? '<button data-crestreset="' + esc(x.crest) + '">Original</button>' : '') + '</span></div>';
    }).join('') + '</div>', '<button data-act="close">Fertig</button>');
}
async function uploadCrest(key, file) {
  try {
    const r = await ST.putImage(file);
    G.crestOverrides[key] = { id: r.id }; await ST.setConfig('crests', G.crestOverrides);
    await loadCrests(); crestLibrary(); renderPanel(); redraw(); G.thumbs.clear(); renderLib(); toast('Wappen ersetzt. Es gilt ab jetzt auf allen Karten.');
  } catch (e) { toast('Das Wappen konnte nicht gespeichert werden.'); }
}
async function resetCrest(key) {
  delete G.crestOverrides[key]; await ST.setConfig('crests', G.crestOverrides);
  await loadCrests(); crestLibrary(); renderPanel(); redraw(); G.thumbs.clear(); renderLib(); toast('Originalwappen wiederhergestellt.');
}

/* ---------- Export ---------- */
async function saveFile(filename, blob) {
  if (window.WOK_DESKTOP) {
    try {
      const r = await fetch('/api/export?name=' + encodeURIComponent(filename), { method: 'POST', body: blob });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json(); G.lastExport = j.path;
      toast('Gespeichert: Dokumente\\War of Kings Kartenwerkstatt\\Exporte\\' + j.name, 6000); return true;
    } catch (e) { toast('Speichern im Exporte-Ordner fehlgeschlagen, Datei geht in „Downloads“.'); }
  }
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) { await dl.save({ filename, data: blob }); return true; }
  } catch (e) {
    if (e && e.code === 'declined') return false;
    if (e && e.code !== 'unavailable' && e.code !== 'not_granted') { toast('Speichern der Datei fehlgeschlagen (' + (e.code || 'Fehler') + ').'); return false; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); return true;
}
function fileBase(c) { return (c.name || 'Karte').replace(/[^\wÄÖÜäöüß\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Karte'; }
const FORMATS = {
  ygo: { name: 'Yu-Gi-Oh (59 × 86 mm)', w: 59, h: 86 },
  online: { name: 'Online-Format 2:3 (59 × 88,5 mm)', w: 59, h: 88.5 },
  tcg: { name: 'Standard-Sammelkarte (63 × 88 mm)', w: 63, h: 88 },
  custom: { name: 'Eigene Maße', w: null, h: null }
};
function pngDialog() {
  const p = G.png || (G.png = { fmt: 'online', fit: 'stretch', mark: false });
  showModal('Bild exportieren (PNG)', `<label>Format<select id="png-fmt">
      <option value="online" ${p.fmt === 'online' ? 'selected' : ''}>Online-Format 2:3 · 2048 × 3072 Pixel</option>
      <option value="ygo" ${p.fmt === 'ygo' ? 'selected' : ''}>Yu-Gi-Oh 59 × 86 mm · 600 dpi (1394 × 2031 Pixel)</option></select></label>
    <div class="inline" id="png-fitrow" ${p.fmt === 'ygo' ? '' : 'hidden'}><label><input type="radio" name="png-fit" value="stretch" ${p.fit !== 'contain' ? 'checked' : ''}> leicht strecken</label><label><input type="radio" name="png-fit" value="contain" ${p.fit === 'contain' ? 'checked' : ''}> unverzerrt, schmaler Rand wird verlängert</label></div>
    <div class="inline"><label><input type="checkbox" id="png-mark" ${p.mark ? 'checked' : ''}> „Entwurf“-Stempel auf nicht freigegebenen Karten</label></div>`,
    '<button data-act="close">Abbrechen</button><button class="gold" data-act="png-go">PNG erstellen</button>');
  $('#png-fmt').onchange = e => { $('#png-fitrow').hidden = e.target.value !== 'ygo'; };
}
async function exportPNG() {
  const p = G.png; p.fmt = $('#png-fmt').value; p.fit = ($('input[name=png-fit]:checked') || {}).value || 'stretch'; p.mark = $('#png-mark').checked;
  closeModal();
  const mark = p.mark && G.card.status !== 'freigegeben';
  const cv = document.createElement('canvas'); cv.width = G.layout.W * 2; cv.height = G.layout.H * 2;
  await renderTo(cv, G.card, { placeholder: false, watermark: mark });
  const out = p.fmt === 'ygo' ? R.composeFormat(cv, 59, 86, 0, p.fit, 600 / 25.4) : cv;
  const blob = await new Promise(r => out.toBlob(r, 'image/png'));
  if (await saveFile(fileBase(G.card) + (p.fmt === 'ygo' ? '_YuGiOh' : '') + '.png', blob)) toast('PNG erstellt (' + out.width + ' × ' + out.height + ' Pixel).');
}
let pdfLibLoading = null;
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  const urls = (window.WOK_DESKTOP ? ['/lib/pdf-lib.min.js'] : []).concat(['https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js']);
  const tryLoad = (i, res, rej) => { const s = document.createElement('script'); s.src = urls[i]; s.onload = () => window.PDFLib ? res(window.PDFLib) : rej(new Error('pdf-lib')); s.onerror = () => { s.remove(); if (i + 1 < urls.length) tryLoad(i + 1, res, rej); else { pdfLibLoading = null; rej(new Error('pdf-lib')); } }; document.head.appendChild(s); };
  if (!pdfLibLoading) pdfLibLoading = new Promise((res, rej) => tryLoad(0, res, rej));
  return pdfLibLoading;
}
function pdfDialog() {
  const p = G.pdf || (G.pdf = { fmt: 'ygo', w: 59, h: 86, bleed: 3, marks: true, scope: 'one', mark: false, fit: 'stretch' });
  showModal('Druck-PDF', `<label>Format<select id="pdf-fmt">${Object.entries(FORMATS).map(([k, f]) => '<option value="' + k + '"' + (p.fmt === k ? ' selected' : '') + '>' + f.name + '</option>').join('')}</select></label>
    <div class="row3"><label>Breite (mm)<input type="number" id="pdf-w" min="30" max="200" step="0.5" value="${p.w}"></label><label>Höhe (mm)<input type="number" id="pdf-h" min="30" max="300" step="0.5" value="${p.h}"></label><label>Beschnitt (mm)<input type="number" id="pdf-b" min="0" max="10" step="0.5" value="${p.bleed}"></label></div>
    <div class="inline"><span>Anpassung an das Format:</span><label><input type="radio" name="pdf-fit" value="stretch" ${p.fit !== 'contain' ? 'checked' : ''}> leicht strecken</label><label><input type="radio" name="pdf-fit" value="contain" ${p.fit === 'contain' ? 'checked' : ''}> unverzerrt (Rand wird verlängert)</label></div>
    <div class="inline"><label><input type="checkbox" id="pdf-marks" ${p.marks ? 'checked' : ''}> Schnittmarken</label><label><input type="checkbox" id="pdf-mark" ${p.mark ? 'checked' : ''}> „Entwurf“-Stempel auf nicht freigegebenen Karten</label></div>
    <div class="inline"><label><input type="radio" name="pdf-scope" value="one" ${p.scope === 'one' ? 'checked' : ''}> Diese Karte</label><label><input type="radio" name="pdf-scope" value="list" ${p.scope === 'list' ? 'checked' : ''}> Alle Karten der Bibliotheksansicht (${filteredCards().length}), je eine Seite</label></div>
    <p class="muted" style="font-size:12.5px" id="pdf-note"></p>`,
    '<button data-act="close">Abbrechen</button><button class="gold" data-act="pdf-go">PDF erstellen</button>');
  const note = () => {
    const w = +$('#pdf-w').value, h = +$('#pdf-h').value, r = w / h, diff = Math.round(Math.abs(r / (2 / 3) - 1) * 1000) / 10;
    $('#pdf-note').textContent = diff < 0.2 ? 'Dieses Maß hat genau das Format der Vorlage (2:3). Es wird nichts gestreckt.'
      : 'Die Vorlage hat das Format 2:3. Für ' + w + ' × ' + h + ' mm wird die Karte um ' + String(diff).replace('.', ',') + ' % angepasst: beim Strecken minimal verzerrt, unverzerrt mit verlängertem Rand. Der Beschnitt entsteht aus dem Kartenrand. Druckauflösung 600 dpi.';
  };
  $('#pdf-fmt').onchange = e => { const f = FORMATS[e.target.value]; if (f.w) { $('#pdf-w').value = f.w; $('#pdf-h').value = f.h; } note(); };
  $('#pdf-w').oninput = $('#pdf-h').oninput = () => { $('#pdf-fmt').value = 'custom'; note(); };
  note();
}
async function exportPDF() {
  const p = G.pdf;
  p.fmt = $('#pdf-fmt').value; p.w = +$('#pdf-w').value || 59; p.h = +$('#pdf-h').value || 86; p.bleed = Math.max(0, +$('#pdf-b').value || 0); p.marks = $('#pdf-marks').checked; p.mark = $('#pdf-mark').checked;
  p.fit = ($('input[name=pdf-fit]:checked') || {}).value || 'stretch';
  p.scope = ($('input[name=pdf-scope]:checked') || {}).value || 'one';
  closeModal(); toast('PDF wird erstellt …', 20000);
  let lib; try { lib = await loadPdfLib(); } catch (e) { toast('Die PDF-Bibliothek konnte nicht geladen werden. Prüfe die Internetverbindung.'); return; }
  const cards = p.scope === 'list' ? filteredCards().map(c => normalize(clone(c))) : [G.card];
  const margin = p.marks ? 8 : 0, pw = p.w + 2 * p.bleed + 2 * margin, ph = p.h + 2 * p.bleed + 2 * margin;
  const MM = 72 / 25.4;
  const doc = await lib.PDFDocument.create();
  doc.setTitle(cards.length > 1 ? 'War of Kings – Karten' : 'War of Kings – ' + (cards[0].name || 'Karte'));
  doc.setCreator('War of Kings Kartenwerkstatt');
  const dpmm = 600 / 25.4;
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const src = document.createElement('canvas'); src.width = Math.round(G.layout.W * 1.4); src.height = Math.round(G.layout.H * 1.4);
    await renderTo(src, card, { placeholder: false, watermark: p.mark && card.status !== 'freigegeben' });
    const out = R.composeFormat(src, p.w, p.h, p.bleed, p.fit, dpmm);
    const jpgBlob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.95));
    const jpg = await doc.embedJpg(new Uint8Array(await jpgBlob.arrayBuffer()));
    const page = doc.addPage([pw * MM, ph * MM]);
    page.drawImage(jpg, { x: margin * MM, y: margin * MM, width: (p.w + 2 * p.bleed) * MM, height: (p.h + 2 * p.bleed) * MM });
    if (p.marks) {
      const k = lib.rgb(0, 0, 0), t = 0.4, gap = 1;
      const x0 = margin + p.bleed, x1 = x0 + p.w, yb0 = margin + p.bleed, yb1 = yb0 + p.h; // PDF: y von unten
      const ln = (ax, ay, bx, by) => page.drawLine({ start: { x: ax * MM, y: ay * MM }, end: { x: bx * MM, y: by * MM }, thickness: t, color: k });
      for (const x of [x0, x1]) { ln(x, 0, x, margin - gap); ln(x, ph - margin + gap, x, ph); }
      for (const y of [yb0, yb1]) { ln(0, y, margin - gap, y); ln(pw - margin + gap, y, pw, y); }
    }
    await sleep(5);
  }
  const blob = new Blob([await doc.save()], { type: 'application/pdf' });
  const name = cards.length > 1 ? 'War_of_Kings_Karten.pdf' : fileBase(cards[0]) + '.pdf';
  if (await saveFile(name, blob)) toast('PDF erstellt: ' + cards.length + (cards.length === 1 ? ' Karte' : ' Karten') + ', ' + p.w + ' × ' + p.h + ' mm' + (p.bleed ? ' mit ' + p.bleed + ' mm Beschnitt' : '') + '.');
}
async function blobToDataURL(b) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
async function exportJSON(all) {
  toast('Sicherung wird erstellt …', 15000);
  const cards = all ? ST.list().map(c => clone(c)) : [Object.assign(clone(G.card), G.cardId ? { id: G.cardId } : {})];
  for (const c of cards) c.giftDetails = (c.gifts || []).map(s => { const g = D.GIFTS.concat(D.ROYAL_GIFTS || []).find(x => x.id === s.id); if (g && g.royal) return { id: g.id, name: g.name, typ: 'Königliche Gabe (permanent)', wirkung: D.giftShort(g, s), bereich: s.scope || 'all', ziel: s.target || null, wert: D.royalAmount(g, s) }; return g ? { id: g.id, name: D.giftTitle(g), typ: g.kind === 'ct' ? 'CT' : 'Permanent', ct: g.ct || null, kurz: D.giftShort(g), ausfuehrlich: D.giftText(g) } : { id: s.id }; });
  for (const c of cards) if (c.art && c.art.id) { const b = await ST.imageBlob(c.art.id); if (b) c.art.data = await blobToDataURL(b); }
  const payload = { format: 'war-of-kings-kartenwerkstatt', version: 1, exported: new Date().toISOString(), source: D.SOURCE, cards };
  if (all) payload.layout = G.layout;
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const name = all ? 'War_of_Kings_Sicherung_' + new Date().toISOString().slice(0, 10) + '.json' : fileBase(G.card) + '.json';
  if (await saveFile(name, blob)) toast(all ? cards.length + ' Karten gesichert.' : 'Karte als JSON gespeichert.');
}
// Abgleich statt blindem Import: gleiche Karten-ID → nur die neuere Fassung gewinnt, keine Duplikate
async function importJSON(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast('Die Datei ist kein gültiges JSON.'); return; }
  const cards = Array.isArray(data) ? data : data && data.cards;
  if (!Array.isArray(cards) || !cards.length) { toast('In der Datei sind keine Karten.'); return; }
  toast('Abgleich läuft …', 20000);
  let added = 0, updated = 0, same = 0;
  for (const raw of cards) {
    const local = raw.id ? ST.get(raw.id) : null;
    if (local && (+local.updated || 0) >= (+raw.updated || 0)) { same++; continue; } // hier ist schon die gleiche oder neuere Fassung
    const c = normalize(raw); delete c.giftDetails;
    const keepUpdated = +raw.updated || Date.now();
    if (raw.art && raw.art.data) {
      try { const b = await (await fetch(raw.art.data)).blob(); const r = await ST.putImage(b); c.art = Object.assign({}, raw.art, { id: r.id }); delete c.art.data; } catch (e) { c.art = local ? local.art : null; }
    } else if (c.art) delete c.art.data;
    if (raw.id) c.id = raw.id;
    await ST.put(c, keepUpdated);
    if (local) updated++; else added++;
  }
  await recalcLibrary(true);
  G.thumbs.clear(); renderLib(); if (G.cardId && ST.get(G.cardId)) openCard(G.cardId);
  toast('Abgleich fertig: ' + added + ' neu, ' + updated + ' aktualisiert, ' + same + ' schon aktuell.', 7000);
}

/* Bestehende Karten automatisch an das aktuelle Power-Scaling anpassen (Seltenheit/Energie mit Automatik) */
async function recalcLibrary(quiet) {
  if (!ST.state.canWrite) return;
  let n = 0, rar = 0;
  for (const raw of ST.list()) {
    const c = normalize(clone(raw)); let changed = false;
    // 2.0: Sonder-Synergie wieder 0/3/6/9 (V1.7 hatte halbiert)
    if (raw.powerVersion === '1.7' && [1.5, 3, 4.5].includes(+c.synergy)) { c.synergy = +c.synergy * 2; changed = true; }
    const has = v => v !== '' && v !== null && v !== undefined;
    if (has(c.atk) && has(c.type === 'king' ? c.hp : c.def)) {
      const ev = PW.evaluate(Object.assign({}, c, { rarity: null }));
      if (c.autoRarity !== false && c.rarity !== ev.rarity) { c.rarity = ev.rarity; changed = true; rar++; }
    }
    if (changed || raw.powerVersion !== PW.VERSION) {
      c.powerVersion = PW.VERSION; c.id = raw.id;
      try { await ST.put(c, changed ? undefined : raw.updated); if (changed) n++; } catch (e) { }
    }
  }
  if (n && !quiet) setTimeout(() => toast(PW.SOURCE + ': ' + n + (n === 1 ? ' Karte' : ' Karten') + ' neu berechnet' + (rar ? ', ' + rar + ' mit neuer Seltenheit' : '') + '.', 7000), 1200);
  if (n) G.thumbs.clear();
}

/* ================= Vorlage einrichten ================= */
const LAYOUT_ITEMS = [
  ['window', 'Bildfenster', 'rect'], ['energy', 'Energie', 'num'], ['name', 'Heldenname', 'text'], ['element', 'Elementwappen', 'circle'], ['elementLabel', 'Elementname', 'text'],
  ['race', 'Rassenwappen', 'circle'], ['raceLabel', 'Rassenname', 'text'], ['class1', 'Klassenwappen', 'circle'], ['class1Label', 'Klassenname', 'text'],
  ['class1b', 'Kammer 2 (bei 3 Kammern)', 'circle'], ['class1bLabel', 'Name Kammer 2 (bei 3)', 'text'], ['class2', 'Kammer 3 (bei 3 Kammern)', 'circle'], ['class2Label', 'Name Kammer 3 (bei 3)', 'text'],
  ['slot4a', 'Kammer 1 (bei 4)', 'circle'], ['slot4aLabel', 'Name Kammer 1 (bei 4)', 'text'], ['slot4b', 'Kammer 2 (bei 4)', 'circle'], ['slot4bLabel', 'Name Kammer 2 (bei 4)', 'text'],
  ['slot4c', 'Kammer 3 (bei 4)', 'circle'], ['slot4cLabel', 'Name Kammer 3 (bei 4)', 'text'], ['slot4d', 'Kammer 4 (bei 4)', 'circle'], ['slot4dLabel', 'Name Kammer 4 (bei 4)', 'text'],
  ['atk', 'ATK-Wert', 'num'], ['atkLabel', 'ATK-Schrift', 'num'], ['def', 'DEF-Wert', 'num'], ['defLabel', 'DEF-Schrift', 'num'],
  ['attackGrid', 'Angriffsraster', 'rect'], ['moveGrid', 'Bewegungsraster', 'rect'], ['banner', 'Banner Rasse/Klasse', 'text'], ['giftsTitle', '„Gaben:“', 'num'],
  ['gifts.0.crest', 'Gabe 1 · Wappen', 'rect'], ['gifts.0.text', 'Gabe 1 · Text', 'rect'], ['gifts.0.ct', 'Gabe 1 · CT', 'rect'],
  ['gifts.1.crest', 'Gabe 2 · Wappen', 'rect'], ['gifts.1.text', 'Gabe 2 · Text', 'rect'], ['gifts.1.ct', 'Gabe 2 · CT', 'rect'],
  ['gifts.2.crest', 'Gabe 3 · Wappen', 'rect'], ['gifts.2.text', 'Gabe 3 · Text', 'rect'], ['gifts.2.ct', 'Gabe 3 · CT', 'rect'],
  ['rarity', 'Seltenheitskristall', 'num'], ['rarityLabel', 'Seltenheitsname', 'text']
];
const LY = { sel: 'name', ref: 'none', refAlpha: 0.5, two: false, slots: 2, drag: null, L: null, showMask: false };
function getP(L, path) { return path.split('.').reduce((o, k) => o[k], L); }
function itemBox(type, P) {
  if (type === 'rect') return { x: P.x, y: P.y, w: P.w, h: P.h };
  if (type === 'circle') return { x: P.x - P.r, y: P.y - P.r, w: P.r * 2, h: P.r * 2 };
  if (type === 'text') return { x: P.x - P.w / 2, y: P.y - P.size * 0.7, w: P.w, h: P.size * 1.4 };
  const s = P.size || 40; return { x: P.x - s * 0.9, y: P.y - s * 0.6, w: s * 1.8, h: s * 1.2 };
}
function openLayout() {
  LY.L = clone(G.layout); LY.dirty = false;
  const el = document.createElement('div'); el.className = 'layout'; el.id = 'layout';
  document.body.appendChild(el); renderLayout();
}
function renderLayout() {
  const L = LY.L, item = LAYOUT_ITEMS.find(i => i[0] === LY.sel), P = getP(L, LY.sel), type = item[2];
  const fields = type === 'rect' ? ['x', 'y', 'w', 'h'] : type === 'circle' ? ['x', 'y', 'r'] : type === 'text' ? ['x', 'y', 'w', 'size'] : ['x', 'y', 'size'];
  const names = { x: 'X', y: 'Y', w: 'Breite', h: 'Höhe', r: 'Radius', size: 'Größe' };
  const custom = L.templates && L.templates['1'];
  $('#layout').innerHTML = `<div class="lbar"><h2>Vorlage einrichten</h2>
      <label class="inline">Referenz <select id="ly-ref"><option value="none">keine</option><option value="akuma" ${LY.ref === 'akuma' ? 'selected' : ''}>Akuma no Klinge</option><option value="raiden" ${LY.ref === 'raiden' ? 'selected' : ''}>Sturmklinge Raiden</option></select></label>
      <label class="inline">Deckkraft <input type="range" id="ly-alpha" min="0" max="1" step="0.05" value="${LY.refAlpha}"></label>
      <label class="inline">Leiste <select id="ly-two"><option value="2" ${LY.slots === 2 ? 'selected' : ''}>2 Kammern</option><option value="3" ${LY.slots === 3 ? 'selected' : ''}>3 Kammern</option><option value="4" ${LY.slots === 4 ? 'selected' : ''}>4 Kammern</option></select></label>
      <label class="inline"><input type="checkbox" id="ly-mask" ${LY.showMask ? 'checked' : ''}> Bildfenster einfärben</label>
      <button data-ly="reset">Standard</button><button data-ly="cancel">Abbrechen</button><button class="gold" data-ly="save">Layout speichern</button></div>
    <div class="lside">${LAYOUT_ITEMS.map(i => '<button data-lysel="' + i[0] + '" class="' + (i[0] === LY.sel ? 'on' : '') + '">' + esc(i[1]) + '</button>').join('')}</div>
    <div class="lstage"><div class="cardwrap"><canvas id="lycv" width="1024" height="1536" aria-label="Layoutvorschau"></canvas></div></div>
    <div class="lprops"><div class="eyebrow">Ausgewählt</div><h3 style="font-size:16px">${esc(item[1])}</h3>
      <div class="row2">${fields.map(f => '<label>' + names[f] + '<input type="number" step="1" data-lyf="' + f + '" value="' + Math.round(P[f] * 10) / 10 + '"></label>').join('')}</div>
      <p class="muted" style="font-size:12.5px">Auf der Karte ziehen verschiebt das Element. Pfeiltasten verschieben um 1 Pixel, mit Umschalt um 10.</p>
      <div class="warnbox">Diese Positionen gelten danach für alle Karten. Im Karteneditor sind sie gesperrt.</div>
      <div class="eyebrow" style="margin-top:8px">Kartenvorlage</div>
      <p style="font-size:13px">${custom ? 'Eigene Vorlage aktiv.' : 'Deine leere Raiden-Vorlage ist aktiv.'}</p>
      <div class="inline"><button data-ly="tpl1">Vorlage ersetzen</button><button data-ly="tpl2">Vorlage mit 3 Kammern</button><button data-ly="tpl3">Vorlage mit 4 Kammern</button>${custom ? '<button data-ly="tplreset">Standardvorlage</button>' : ''}</div>
      <p class="muted" style="font-size:12.5px">Eine Vorlage muss leer sein: Rahmen, Banner und Felder ohne Text, Zahlen, Wappen, Pfeile oder Figur. Das Bildfenster wird automatisch erkannt.</p>
      <div class="row2"><label>Erkennung Helligkeit<input type="number" data-lymask="lum" value="${L.mask.lum}"></label><label>Erkennung Farbe<input type="number" data-lymask="sat" value="${L.mask.sat}"></label></div>
      <button data-ly="remask">Bildfenster neu erkennen</button>
    </div>`;
  bindLayout(); drawLayout();
}
function lyVisible(path) {
  const n = LY.slots;
  if (/^(race|class1)(Label)?$/.test(path)) return n === 2 || (n === 3 && path.startsWith('race'));
  if (/^(class1b|class2)/.test(path)) return n === 3;
  if (/^slot4/.test(path)) return n === 4;
  return true;
}
async function drawLayout() {
  const cv = $('#lycv'); if (!cv) return;
  const ctx = cv.getContext('2d'), L = LY.L;
  const demo = { name: 'Akuma no Klinge', energy: 6, atk: 900, def: 500, element: 'feuer', element2: LY.slots === 4 ? 'dunkelheit' : null, race: 'daemonen', race2: LY.slots === 4 ? 'drachen' : null, classes: ['samurai', LY.slots >= 3 ? 'geist' : null], rarity: 'selten',
    attack: { dirs: { n: 1, w: 1, e: 1 } }, move: { dirs: { n: 1 }, showNumber: true, number: 1 }, gifts: [{ id: 'mordlust' }, { id: 'poison' }, { id: 'doppelschlag' }], art: null };
  const frames = LY.frames || { 1: G.frames[1], 2: G.frames[2], 3: G.frames[3] };
  R.draw(ctx, demo, L, { frame1: frames[1], frame2: frames[2], frame3: frames[3], art: null, crests: G.crests, giftCrests: G.giftCrests }, { placeholder: false });
  if (LY.ref !== 'none') { const ref = await R.loadImage(A.refs[LY.ref]); ctx.globalAlpha = LY.refAlpha; ctx.drawImage(ref, 0, 0, 1024, 1536); ctx.globalAlpha = 1; }
  if (LY.showMask) { ctx.save(); ctx.fillStyle = 'rgba(255,0,80,.35)'; ctx.globalCompositeOperation = 'source-over'; const f = frames[LY.slots - 1]; if (f) { const t = document.createElement('canvas'); t.width = 1024; t.height = 1536; const g = t.getContext('2d'); g.fillStyle = '#ff0050'; g.fillRect(0, 0, 1024, 1536); g.globalCompositeOperation = 'destination-out'; g.drawImage(f, 0, 0, 1024, 1536); ctx.globalAlpha = .45; ctx.drawImage(t, 0, 0); } ctx.restore(); }
  for (const [path, , type] of LAYOUT_ITEMS) {
    if (!lyVisible(path)) continue;
    const b = itemBox(type, getP(L, path)), on = path === LY.sel;
    ctx.save(); ctx.lineWidth = on ? 3 : 1.2; ctx.strokeStyle = on ? '#f0cd7a' : 'rgba(120,200,255,.55)'; ctx.setLineDash(on ? [] : [6, 4]);
    ctx.strokeRect(b.x, b.y, b.w, b.h); ctx.restore();
  }
}
function bindLayout() {
  const cv = $('#lycv');
  const pt = ev => { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * 1024, y: (ev.clientY - r.top) / r.height * 1536 }; };
  cv.onpointerdown = ev => {
    const p = pt(ev);
    // Treffer: kleinstes Element unter dem Zeiger
    let best = null;
    for (const [path, , type] of LAYOUT_ITEMS) {
      if (!lyVisible(path)) continue;
      const b = itemBox(type, getP(LY.L, path));
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { const a = b.w * b.h; if (!best || a < best.a) best = { path, a }; }
    }
    if (best) { const P = getP(LY.L, best.path); LY.sel = best.path; LY.drag = { p, ox: P.x, oy: P.y }; cv.setPointerCapture(ev.pointerId); renderLayout(); }
  };
  cv.onpointermove = ev => {
    if (!LY.drag) return; const p = pt(ev), P = getP(LY.L, LY.sel);
    P.x = Math.round(LY.drag.ox + p.x - LY.drag.p.x); P.y = Math.round(LY.drag.oy + p.y - LY.drag.p.y); LY.dirty = true;
    $$('[data-lyf]').forEach(i => { if (i.dataset.lyf === 'x') i.value = P.x; if (i.dataset.lyf === 'y') i.value = P.y; });
    drawLayout();
  };
  cv.onpointerup = () => { LY.drag = null; };
  $$('[data-lyf]').forEach(inp => inp.oninput = () => { const P = getP(LY.L, LY.sel); P[inp.dataset.lyf] = +inp.value; LY.dirty = true; drawLayout(); });
  $$('[data-lymask]').forEach(inp => inp.oninput = () => { LY.L.mask[inp.dataset.lymask] = +inp.value; LY.dirty = true; });
  $('#ly-ref').onchange = e => { LY.ref = e.target.value; drawLayout(); };
  $('#ly-alpha').oninput = e => { LY.refAlpha = +e.target.value; drawLayout(); };
  $('#ly-two').onchange = e => { LY.slots = +e.target.value; drawLayout(); };
  $('#ly-mask').onchange = e => { LY.showMask = e.target.checked; drawLayout(); };
}
async function layoutTemplate(variant, file) {
  try {
    const r = await ST.putImage(file);
    const img = await R.loadImage(r.url);
    if (!img) throw new Error('decode');
    const ratio = img.naturalWidth / img.naturalHeight;
    if (Math.abs(ratio - 2 / 3) > 0.02) toast('Hinweis: Die Vorlage hat nicht das Format 2:3 (' + img.naturalWidth + ' × ' + img.naturalHeight + '). Sie wird auf 2:3 gestreckt.', 6000);
    LY.L.templates = Object.assign({}, LY.L.templates || {}, { [variant]: r.id });
    LY.frames = LY.frames || { 1: G.frames[1], 2: G.frames[2], 3: G.frames[3] };
    const fr = R.computeFrame(img, LY.L.mask, +variant);
    LY.frames[variant] = fr.canvas; LY.dirty = true;
    if (fr.area < 0.1 || fr.area > 0.6) toast('Das Bildfenster wurde nicht sicher erkannt (' + Math.round(fr.area * 100) + ' % der Fläche). Prüfe es mit „Bildfenster einfärben“.', 6000);
    renderLayout();
  } catch (e) { toast('Die Vorlage konnte nicht gespeichert werden.'); }
}
async function layoutRemask() {
  LY.frames = LY.frames || {};
  for (const v of ['1', '2', '3']) {
    let img = G.tplImgs[v];
    const id = LY.L.templates && LY.L.templates[v];
    if (id) { const u = await ST.imageURL(id); if (u) img = await R.loadImage(u); }
    if (img) LY.frames[v] = R.computeFrame(img, LY.L.mask, +v).canvas;
  }
  LY.showMask = true; renderLayout();
}
async function layoutSave() {
  try {
    await ST.setConfig('layout', LY.L); G.layout = mergeLayout(LY.L); await loadTemplates();
    LY.dirty = false; $('#layout').remove(); G.thumbs.clear(); renderLib(); redraw(); toast('Layout gespeichert. Es gilt jetzt für alle Karten.');
  } catch (e) { toast('Das Layout konnte nicht gespeichert werden.'); }
}

/* ================= Ereignisse ================= */
function markTabs() { $$('.mobile-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === G.tab)); }
document.addEventListener('click', async e => {
  const back = e.target.closest('[data-act="close-back"]'); if (back && e.target === back) { closeModal(); return; }
  const b = e.target.closest('button'); if (!b) { if (G.menu && !e.target.closest('.menu')) { G.menu = false; $('#menu').hidden = true; } return; }
  if (G.menu && !b.closest('.menu-list') && b.dataset.act !== 'menu') { G.menu = false; $('#menu').hidden = true; }
  const d = b.dataset;
  if (d.tab) { G.tab = d.tab; $('.ws').dataset.tab = d.tab; markTabs(); if (d.tab === 'lib') renderLib(); return; }
  if (d.folder !== undefined && b.classList.contains('fbtn')) { G.filters.folder = d.folder; renderLib(); return; }
  if (d.pickCard) { const k = G.libPick; if (k) { if (k.has(d.pickCard)) k.delete(d.pickCard); else k.add(d.pickCard); renderLib(); } return; }
  if (d.open) { if (d.open === G.cardId) { if (window.innerWidth <= 980) { G.tab = 'card'; $('.ws').dataset.tab = 'card'; markTabs(); } return; } guard(() => openCard(d.open)); return; }
  if (d.goto) { focusSection(d.goto); return; }
  if (d.namepick !== undefined) { const n = G.nameSugg && G.nameSugg.names[+d.namepick]; if (n && G.card) { G.card.name = n; $('#in-name').value = n; markDirty(); redraw(); $('#name-sugg').innerHTML = nameSuggHTML(); } return; }
  if (d.pick !== undefined) {
    const v = d.val || null, c = G.card;
    if (d.pick === 'rarity') { c.rarity = v; if (c.autoRarity) { c.autoRarity = false; toast('Seltenheit von Hand gesetzt: Automatik für die Seltenheit ist aus.'); } } else if (d.pick === 'element') { c.element = v; if (c.element2 === v) c.element2 = null; } else if (d.pick === 'race') { c.race = v; if (c.race2 === v) c.race2 = null; }
    else if (d.pick === 'element2') c.element2 = v; else if (d.pick === 'race2') c.race2 = v;
    else if (d.pick === 'class0') { c.classes[0] = v; if (c.classes[1] === v) c.classes[1] = null; } else if (d.pick === 'class1') c.classes[1] = v;
    markDirty(); renderPanel(); redraw(); return;
  }
  if (d.dir) { const [k, dir] = d.dir.split(':'); cycleDir(k, dir); return; }
  if (d.dirclear) { (d.dirclear === 'atk' ? G.card.attack : G.card.move).dirs = {}; markDirty(); renderPanel(); redraw(); return; }
  if (d.status) { setStatus(d.status); return; }
  if (d.fontset) { G.card.style.fontSet = d.fontset; G.card.style.fonts = {}; markDirty(); renderPanel(); redraw(); return; }
  if (d.style) { const i = d.style.indexOf(':'); G.card.style[d.style.slice(0, i)] = d.style.slice(i + 1); markDirty(); renderPanel(); redraw(); return; }
  if (d.royalpick) { const g = D.ROYAL_GIFTS.find(x => x.id === d.royalpick); if (g && G.card.gifts.length < 3) G.card.gifts.push({ id: g.id, scope: 'all', target: null, amount: g.param.def }); closeModal(); markDirty(); renderPanel(); redraw(); return; }
  if (d.giftpick) { G.card.gifts.push({ id: d.giftpick }); closeModal(); markDirty(); renderPanel(); redraw(); return; }
  if (d.giftdel !== undefined) { G.card.gifts.splice(+d.giftdel, 1); markDirty(); renderPanel(); redraw(); return; }
  if (d.giftmove) { const [i, dir] = d.giftmove.split(':').map(Number), a = G.card.gifts, j = i + dir; if (j >= 0 && j < a.length) { [a[i], a[j]] = [a[j], a[i]]; markDirty(); renderPanel(); redraw(); } return; }
  if (d.crtab) { crestTab = d.crtab; crestLibrary(); return; }
  if (d.crestup) { G.crestKey = d.crestup; $('#file-crest').click(); return; }
  if (d.crestreset) { resetCrest(d.crestreset); return; }
  if (d.lysel) { LY.sel = d.lysel; renderLayout(); return; }
  if (d.ly) {
    if (d.ly === 'save') layoutSave();
    else if (d.ly === 'cancel') { if (LY.dirty) { showModal('Layout verwerfen?', '<p>Die Änderungen am Layout gehen verloren.</p>', '<button data-act="close">Zurück</button><button class="danger" data-act="ly-discard">Verwerfen</button>'); } else $('#layout').remove(); }
    else if (d.ly === 'reset') { const keep = LY.L.templates; LY.L = R.defaultLayout(); if (keep) LY.L.templates = keep; LY.dirty = true; renderLayout(); }
    else if (d.ly === 'tpl1' || d.ly === 'tpl2' || d.ly === 'tpl3') { G.tplVariant = d.ly.slice(3); $('#file-tpl').click(); }
    else if (d.ly === 'tplreset') { delete LY.L.templates; LY.frames = { 1: null, 2: null, 3: null }; for (const v of ['1', '2', '3']) { const t = await R.loadImage(A.templates[v]); LY.frames[v] = R.computeFrame(t, LY.L.mask, +v).canvas; } LY.dirty = true; renderLayout(); }
    else if (d.ly === 'remask') layoutRemask();
    return;
  }
  switch (d.act) {
    case 'close': closeModal(); return;
    case 'menu': G.menu = !G.menu; $('#menu').hidden = !G.menu; b.setAttribute('aria-expanded', G.menu); return;
    case 'new': guard(() => newTypeDialog()); return;
    case 'lib-pick': G.libPick = G.libPick ? null : new Set(); renderLib(); return;
    case 'pick-all': for (const c of filteredCards()) G.libPick.add(c.id); renderLib(); return;
    case 'pick-none': G.libPick.clear(); renderLib(); return;
    case 'pick-move': folderDialog([...G.libPick]); return;
    case 'pick-unfolder': { const n = await moveToFolder([...G.libPick], ''); toast(n + (n === 1 ? ' Karte' : ' Karten') + ' ohne Ordner.'); return; }
    case 'pick-release': { let n = 0; for (const id of G.libPick) { const c = ST.get(id); if (!c || c.status === 'freigegeben') continue; const x = clone(c); x.status = 'freigegeben'; try { await ST.put(x, c.updated); n++; if (id === G.cardId && G.card) G.card.status = 'freigegeben'; } catch (e) { } } renderLib(); if (G.card) renderPanel(); toast(n + (n === 1 ? ' Karte' : ' Karten') + ' freigegeben.'); return; }
    case 'pick-export': G.gx = Object.assign(G.gx || {}, { scope: 'auswahl' }); gameExportDialog(); return;
    case 'pick-starter': starterDialog([...G.libPick]); return;
    case 'pool-starter-go': { const ids = G.poolIds || [], k = +($('#st-count') || {}).value || 1; closeModal(); const r = await setPool(ids, 'starter', k); const t = starterTotal();
      toast(r.n + (r.n === 1 ? ' Karte' : ' Karten') + ' im Starter-Set' + (r.capped ? ' (' + r.capped + '× aufs Kopien-Limit gekürzt)' : '') + '. Starter jetzt ' + t + ' / ' + STARTER_MAX + (t > STARTER_MAX ? ' – zu viele, bitte ' + (t - STARTER_MAX) + ' herausnehmen.' : '.'), 6500); return; }
    case 'pick-pack': { const r = await setPool([...G.libPick], 'pack'); toast(r.n + (r.n === 1 ? ' Karte kommt' : ' Karten kommen') + ' in die Packs. Starter jetzt ' + starterTotal() + ' / ' + STARTER_MAX + '.', 5000); return; }
    case 'pick-nopool': { const r = await setPool([...G.libPick], ''); toast(r.n + (r.n === 1 ? ' Karte ist' : ' Karten sind') + ' wieder nur zum Testen.'); return; }
    case 'pool-show': { G.filters.pool = G.filters.pool === d.pool ? '' : d.pool; renderLib(); const sel = $('#f-pool'); if (sel) sel.value = G.filters.pool; return; }
    case 'folder-new': folderDialog(null); return;
    case 'folder-to': { const ids = G.folderIds || []; closeModal(); const n = await moveToFolder(ids, d.name); toast(n + (n === 1 ? ' Karte' : ' Karten') + ' im Ordner „' + d.name + '“.'); return; }
    case 'folder-create': { const nm = ($('#folder-name').value || '').trim().slice(0, 40); if (!nm) { toast('Bitte einen Namen eingeben.'); return; } const ids = G.folderIds; closeModal();
      if (ids && ids.length) { const n = await moveToFolder(ids, nm); toast(n + (n === 1 ? ' Karte' : ' Karten') + ' im neuen Ordner „' + nm + '“.'); } else { saveFolderList(folderNames().concat(nm)); G.filters.folder = nm; renderLib(); toast('Ordner „' + nm + '“ angelegt. Mit „☑ Auswählen“ legst du Karten hinein.', 5000); } return; }
    case 'folder-del': { const nm = d.name; closeModal(); const ids = ST.list().filter(c => c.folder === nm).map(c => c.id); await moveToFolder(ids, ''); saveFolderList(folderNames().filter(x => x !== nm)); if (G.filters.folder === nm) G.filters.folder = ''; renderLib(); toast('Ordner „' + nm + '“ aufgelöst, die Karten bleiben erhalten.'); return; }
    case 'newtype': { const t = d.t; closeModal(); openCard(null); if (t !== 'hero') { G.snapLock = true; setCardType(t); G.snapLock = false; } toast({ hero: 'Neue Heldenkarte', king: 'Neue Königskarte: HP bis 20.000, ATK bis 3.500, bis zu drei königliche Gaben', spell: 'Neue Zauberkarte', curse: 'Neue Fluchkarte' }[t] + '.', 4000); return; }
    case 'save': save(); return;
    case 'discard': closeModal(); clearDirty(); if (G.pendingNext) G.pendingNext(); return;
    case 'save-continue': closeModal(); if (await save() && G.pendingNext) G.pendingNext(); return;
    case 'art-pick': $('#file-art').click(); return;
    case 'art-fit': if (G.card.art) { delete G.card.art.x; delete G.card.art.y; delete G.card.art.scale; clampArt(); markDirty(); renderStagebar(); updateFillUI(); redraw(); } return;
    case 'gift-add': giftPicker(); return;
    case 'roll-all': rollPart('all'); return;
    case 'roll-energy': rollPart('energy'); return;
    case 'roll-dirs': rollPart('dirs'); return;
    case 'roll-gifts': rollPart('gifts'); return;
    case 'ident-element': identifyFromArt(false, 'element'); return;
    case 'ident-race': identifyFromArt(false, 'race'); return;
    case 'ident-class': identifyFromArt(false, 'class'); return;
    case 'kh-theme': khTheme(); return;
    case 'kh-roll': rollPart('all'); return;
    case 'kh-roll-old': { const v = G.khRar || ''; if (v) { aiSnap(); G.snapLock = true; try { G.card.rarity = v === 'zufall' ? PW.MIX[Math.min(PW.MIX.length - 1, (() => { let r = Math.random(), i = 0; for (; i < PW.MIX.length; i++) { r -= PW.MIX[i][1]; if (r <= 0) break; } return i; })())][0] : v; rollStats(); } finally { G.snapLock = false; } } else rollStats(); return; }
    case 'kh-colors': { khColors(); return; }
    case 'kh-all': { khAll(); return; }
    case 'kh-undo': { khUndo(); return; }
    case 'roll-stats': rollPart('stats'); return;
    case 'ident-ai': { identifyFromArt(); return; }
    case 'power-apply': { G.card.autoRarity = true; markDirty(); renderPanel(); redraw(); return; }
    case 'ai': openAI(); return;
    case 'open-folder': fetch('/api/open-folder', { method: 'POST' }).catch(() => {}); return;
    case 'name-ai': aiSnap(); findName(false); return;
    case 'lib-dl': libDlDialog(); return;
    case 'engine-export': G.menu = false; if ($('#menu')) $('#menu').hidden = true; engineExportDialog(); return;
    case 'ex-go': engineExportRun(); return;
    case 'game-export': gameExportDialog(); return;
    case 'gx-go': gameExportRun(); return;
    case 'ex-pick': exPickFolder(); return;
    case 'ex-reset': exResetFolder(); return;
    case 'lib-dl-go': libDlRun(); return;
    case 'lib-dl-stop': G.libDlStop = true; return;
    case 'aicfg': aiConfigDialog(); return;
    case 'ai-chip': if (window.WOK_DESKTOP) aiConfigDialog(); else toast(AICHIP.text || 'KI-Status wird geprüft …', 7000); return;
    case 'aicfg-models': aiCfgModels(); return;
    case 'aicfg-test': aiCfgSave(true); return;
    case 'aicfg-save': aiCfgSave(false); return;
    case 'style-reset': G.card.style = clone(STYLE_DEFAULT); markDirty(); renderPanel(); redraw(); return;
    case 'art-contain': if (G.card.art && G.artImg) { const f = artFits(); Object.assign(G.card.art, { scale: f.contain.scale, x: f.contain.x, y: f.contain.y }); if (!G.card.art.fill) G.card.art.fill = 'blur'; markDirty(); renderStagebar(); renderPanel(); redraw(); } return;
    case 'crests': crestLibrary(); return;
    case 'layout': guard(() => openLayout()); return;
    case 'ly-discard': closeModal(); $('#layout') && $('#layout').remove(); return;
    case 'export-png': pngDialog(); return;
    case 'png-go': exportPNG(); return;
    case 'export-pdf': pdfDialog(); return;
    case 'pdf-go': exportPDF(); return;
    case 'sync-cfg': syncDialog(); return;
    case 'sync-pick': syncPick(false); return;
    case 'sync-reset': syncPick(true); return;
    case 'sync-now': syncNow(false); return;
    case 'sync-open': fetch('/api/sync/open', { method: 'POST' }).catch(() => {}); return;
    case 'sync-import': { const i = $('#sync-files'); if (i) i.click(); return; }
    case 'sync-zip': syncExportZip(); return;
    case 'export-json': exportJSON(false); return;
    case 'backup': exportJSON(true); return;
    case 'import': $('#file-json').click(); return;
    case 'delete': showModal('Karte löschen?', '<p>„' + esc(G.card.name || 'Ohne Namen') + '“ wird endgültig aus der Bibliothek entfernt.</p>', '<button data-act="close">Abbrechen</button><button class="danger" data-act="delete-ok">Löschen</button>'); return;
    case 'delete-ok': closeModal(); try { syncTombstone(G.cardId); await ST.del(G.cardId); toast('Karte gelöscht.'); clearDirty(); openCard(null); } catch (err) { toast('Löschen fehlgeschlagen.'); } return;
    case 'duplicate': {
      const c = clone(G.card); c.name = (c.name || 'Karte') + ' (Kopie)'; c.status = 'entwurf'; delete c.released; delete c.created;
      try { const id = await ST.put(c); openCard(id); toast('Kopie angelegt.'); } catch (err) { toast('Duplizieren fehlgeschlagen.'); } return;
    }
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'file-art' && t.files[0]) { uploadArt(t.files[0]); t.value = ''; }
  else if (t.id === 'file-json' && t.files[0]) { importJSON(t.files[0]); t.value = ''; }
  else if (t.id === 'file-crest' && t.files[0]) { uploadCrest(G.crestKey, t.files[0]); t.value = ''; }
  else if (t.id === 'file-tpl' && t.files[0]) { layoutTemplate(G.tplVariant, t.files[0]); t.value = ''; }
  else if (t.dataset.numshow) { const sp = t.dataset.numshow === 'atk' ? G.card.attack : G.card.move; sp.showNumber = t.checked; markDirty(); renderPanel(); redraw(); }
  else if (t.dataset.giftparam !== undefined) { G.card.gifts[+t.dataset.giftparam].param = +t.value; markDirty(); redraw(); }
  else if (t.id && t.id.startsWith('f-')) { G.filters[t.id.slice(2)] = t.value; renderLib(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { G.search = t.value; renderLib(); }
  else if (t.dataset.num) { const sp = t.dataset.num === 'atk' ? G.card.attack : G.card.move; sp.number = Math.max(1, Math.min(9, Math.round(+t.value || 1))); markDirty(); redraw(); }
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!$('#layout')) save(); }
  if (e.key === 'Escape') { if ($('#modal').innerHTML) closeModal(); else if (G.menu) { G.menu = false; $('#menu').hidden = true; } }
  if ($('#layout') && !$('#modal').innerHTML && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
    e.preventDefault(); const st = e.shiftKey ? 10 : 1, P = getP(LY.L, LY.sel);
    if (e.key === 'ArrowLeft') P.x -= st; if (e.key === 'ArrowRight') P.x += st; if (e.key === 'ArrowUp') P.y -= st; if (e.key === 'ArrowDown') P.y += st;
    LY.dirty = true; renderLayout();
  }
});
window.addEventListener('beforeunload', e => { if (G.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ================= Scrollstab am rechten Rand ================= */
// Greifbarer Balken zum schnellen Hoch- und Runterscrollen (Handy: ganze Seite, Desktop: Bearbeitungsmenü und Bibliothek)
const FS = [];
function fastScroll(getTarget, opts) {
  const track = document.createElement('div'); track.className = 'fs-track' + (opts.cls ? ' ' + opts.cls : ''); track.setAttribute('aria-hidden', 'true');
  const thumb = document.createElement('div'); thumb.className = 'fs-thumb'; track.appendChild(thumb); document.body.appendChild(track);
  const st = { track, thumb, getTarget, opts, drag: null, raf: 0, idle: 0 };
  const sc = () => { const t = getTarget(); return t === window ? document.scrollingElement : t; };
  st.update = () => {
    cancelAnimationFrame(st.raf);
    st.raf = requestAnimationFrame(() => {
      const t = getTarget(), el = sc();
      if (!el || !opts.active()) { track.hidden = true; return; }
      const r = t === window ? { top: 0, bottom: window.innerHeight, right: window.innerWidth } : t.getBoundingClientRect();
      const top = Math.max(r.top, opts.minTop ? opts.minTop() : 0) + 6, bottom = Math.min(r.bottom, window.innerHeight) - 6;
      const sh = el.scrollHeight, ch = el.clientHeight;
      if (sh <= ch + 8 || bottom - top < 80) { track.hidden = true; return; }
      track.hidden = false;
      track.style.top = top + 'px'; track.style.height = (bottom - top) + 'px';
      track.style.left = (r.right - (opts.inset || 30)) + 'px';
      const th = Math.max(56, (bottom - top) * ch / sh), max = (bottom - top) - th;
      thumb.style.height = th + 'px'; thumb.style.transform = 'translateY(' + (max * el.scrollTop / (sh - ch)) + 'px)';
      st.max = max; st.range = sh - ch; st.th = th;
      track.classList.add('show'); clearTimeout(st.idle);
      if (!st.drag) st.idle = setTimeout(() => track.classList.remove('show'), 1600);
    });
  };
  const toScroll = (clientY, grab) => {
    const el = sc(), r = track.getBoundingClientRect();
    const y = Math.max(0, Math.min(st.max, clientY - r.top - grab));
    el.scrollTop = st.max ? y / st.max * st.range : 0;
  };
  track.addEventListener('pointerdown', e => {
    e.preventDefault();
    const tr = thumb.getBoundingClientRect();
    const onThumb = e.clientY >= tr.top && e.clientY <= tr.bottom;
    const grab = onThumb ? e.clientY - tr.top : st.th / 2;
    st.drag = { grab }; track.classList.add('drag', 'show'); track.setPointerCapture(e.pointerId);
    if (!onThumb) toScroll(e.clientY, grab);
  });
  track.addEventListener('pointermove', e => { if (st.drag) { e.preventDefault(); toScroll(e.clientY, st.drag.grab); } });
  const end = () => { st.drag = null; track.classList.remove('drag'); st.update(); };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
  FS.push(st); return st;
}
function bindScrollers() {
  const mobile = () => window.innerWidth <= 980;
  const head = () => { const b = document.querySelector('.bar'); return b ? b.getBoundingClientRect().bottom : 0; };
  fastScroll(() => window, { active: () => mobile() && !document.getElementById('layout'), minTop: head, inset: 34, cls: 'page' });
  fastScroll(() => document.getElementById('panel'), { active: () => !mobile() && !!document.getElementById('panel') && !document.getElementById('layout'), inset: 30 });
  fastScroll(() => document.getElementById('liblist'), { active: () => !mobile() && !!document.getElementById('liblist') && !document.getElementById('layout'), inset: 26, cls: 'slim' });
  const upd = () => FS.forEach(f => f.update());
  window.addEventListener('scroll', upd, { passive: true });
  window.addEventListener('resize', upd);
  document.addEventListener('scroll', upd, { passive: true, capture: true });
  new MutationObserver(upd).observe(document.getElementById('app'), { childList: true, subtree: true });
  upd();
}

/* ================= Start ================= */
(async function start() {
  $('#app').innerHTML = '<div style="padding:40px;text-align:center" class="muted">Kartenwerkstatt wird geladen …</div>';
  await ST.init();
  G.layout = mergeLayout(await ST.getConfig('layout'));
  G.crestOverrides = (await ST.getConfig('crests')) || {};
  try { await Promise.all([document.fonts.load('700 40px "' + G.layout.font + '"'), document.fonts.load('500 20px "' + G.layout.font + '"'), document.fonts.load('600 20px "' + G.layout.font + '"')]); } catch (e) { }
  await Promise.all([loadTemplates(), loadCrests(), loadSpellFrames()]);
  G.ready = true;
  await recalcLibrary();
  syncStart();
  shell(); markTabs(); bindScrollers();
  const recent = filteredCards()[0];
  openCard(recent ? recent.id : null);
  ST.onChange(() => { renderLib(); refreshOpenCard(); });
  document.fonts.ready.then(() => { G.thumbs.clear(); redraw(); renderLib(); });
})();

/* ================= KI-Namensfindung ================= */
function autoNameOn() { try { return localStorage.getItem('wok-autoname') !== '0'; } catch (e) { return true; } }
function nameSuggHTML() {
  const S = G.nameSugg; if (!S || !G.card || S.cardRef !== G.card) return '';
  return '<div class="namesugg">' + S.names.map((n, i) => '<button class="pick' + (G.card.name === n ? ' on' : '') + '" data-namepick="' + i + '">' + esc(n) + '</button>').join('')
    + '</div><p class="muted" style="font-size:12px">' + esc(S.src) + (S.reason ? ' · ' + esc(S.reason) : '') + '</p>';
}
function namePrompt(c) {
  const nm = (list, id) => (list.find(x => x.id === id) || {}).name;
  const facts = [['Element', [nm(D.ELEMENTS, c.element), nm(D.ELEMENTS, c.element2)].filter(Boolean).join(' und ')], ['Rasse', [nm(D.RACES, c.race), nm(D.RACES, c.race2)].filter(Boolean).join(' und ')], ['Klasse', [nm(D.CLASSES, c.classes[0]), nm(D.CLASSES, c.classes[1])].filter(Boolean).join(' und ')]].filter(x => x[1]);
  return 'Du benennst eine Heldenkarte für das Fantasy-Kartenspiel „War of Kings“. Sieh dir die angehängte Illustration genau an.'
    + (facts.length ? ' Bekannt ist bereits: ' + facts.map(x => x[0] + ': ' + x[1]).join(', ') + '.' : '')
    + ' Schlage 3 verschiedene, einprägsame Heldennamen vor, die zum Motiv passen, im Stil von „Sturmklinge Raiden“ oder „Akuma no Klinge“.'
    + ' Regeln: höchstens 22 Zeichen, kein Name einer bekannten Figur aus Filmen, Serien, Spielen oder Büchern, keine Markennamen.'
    + ' Antworte nur mit JSON: {"names":["…","…","…"],"reason":"kurzer deutscher Halbsatz, was du im Bild erkennst (höchstens 80 Zeichen)"}';
}
/* Werte passend zur gewählten Seltenheit würfeln (gleicher Generator wie im KI-Modus) */
// Ziel-Seltenheit der KI-Werkzeuge: gewählt im KI-Helfer, sonst die der Karte, sonst Gewöhnlich (nie zufällig zu stark)
try { G.khRar = localStorage.getItem('wok-kh-rar') || ''; } catch (e) { G.khRar = ''; }
function khTarget() {
  const v = G.khRar || '';
  if (v === 'zufall') { let r = Math.random(); for (const [id, w] of PW.MIX) { r -= w; if (r <= 0) return id; } return 'gewoehnlich'; }
  return v || (G.card && G.card.rarity) || 'gewoehnlich';
}
function khTargetLabel() { const v = G.khRar || ''; return v === 'zufall' ? 'Zufall (meist Gewöhnlich, selten Legendär)' : v ? PW.rarityName(v) : (G.card && G.card.rarity ? PW.rarityName(G.card.rarity) + ' (wie auf der Karte)' : 'Gewöhnlich (die Karte hat noch keine Seltenheit)'); }
function aiRow(btns, disabled) {
  return '<div class="ai-row">' + btns.map(([act, t, id]) => '<button class="ai-chip2" data-act="' + act + '"' + (id ? ' id="' + id + '"' : '') + (disabled ? ' disabled title="Erst eine Illustration hochladen"' : '') + '>' + t + '</button>').join('') + '<span class="ai-tgt">Ziel: ' + esc(PW.rarityName(G.khRar && G.khRar !== 'zufall' ? G.khRar : (G.card && G.card.rarity) || 'gewoehnlich')) + '</span></div>';
}
// Würfelt nur einen Teil der Karte; alles andere bleibt, und die Karte landet in der Ziel-Seltenheit
function rollPart(part) {
  const c = G.card; if (!c) return; aiSnap();
  if (c.type === 'king') {
    const want = khTarget(), has = v => v !== '' && v !== null && v !== undefined, fixed = (c.gifts || []).length ? { giftObjs: c.gifts } : part === 'all' ? { rollGifts: true } : { giftObjs: [] };
    if (part === 'gifts') { toast('Königliche Gaben stellst du selbst ein (Wirkungsbereich und Stärke) – sie werden nicht gewürfelt.', 6000); return; }
    if (part !== 'all' && part !== 'stats') { if (has(c.atk)) fixed.atk = +c.atk; if (has(c.hp)) fixed.hp = +c.hp; }
    if (part !== 'all' && part !== 'dirs' && Object.values(c.attack.dirs || {}).some(Boolean)) fixed.attack = c.attack;
    const gen = PW.generateKing(want, Math.random, { fixed });
    if (!gen) { toast('Mit den übrigen Werten passt das nicht in ' + PW.rarityName(want) + '. Bei Königen entscheiden vor allem die königlichen Gaben (Anzahl und Stärke) über die Seltenheit.', 7000); return; }
    for (const k of (part === 'all' ? ['atk', 'hp', 'attack'] : part === 'stats' ? ['atk', 'hp'] : ['attack'])) c[k] = gen[k];
    if (fixed.rollGifts) c.gifts = gen.gifts;
    c.move = { dirs: {}, showNumber: false, number: 1 };
    c.rarity = PW.evaluate(Object.assign({}, c, { rarity: null })).rarity; c.autoRarity = true;
    markDirty(); renderPanel(); redraw();
    if (!G.snapLock) toast('🎲 König: ' + PW.rarityName(c.rarity) + ', ' + String(PW.evaluate(c).total).replace('.', ',') + ' Punkte · ATK ' + c.atk + ' · HP ' + Number(c.hp).toLocaleString('de-DE') + '.');
    return;
  }
  const want = khTarget(), has = v => v !== '' && v !== null && v !== undefined;
  const dirsSet = sp => Object.values((sp || {}).dirs || {}).some(Boolean);
  const fixed = {};
  if (part !== 'all' && part !== 'energy' && has(c.energy)) fixed.energy = +c.energy;
  if (part !== 'all' && part !== 'stats') { if (has(c.atk)) fixed.atk = +c.atk; if (has(c.def)) fixed.def = +c.def; }
  if (part !== 'all' && part !== 'dirs') { if (dirsSet(c.attack)) fixed.attack = c.attack; if (dirsSet(c.move)) fixed.move = c.move; }
  if ((part !== 'all' && part !== 'gifts') || (part === 'all' && G.rollKeepGifts)) fixed.gifts = c.gifts.map(g => g.id);
  if (fixed.gifts && fixed.gifts.length > PW.GIFT_LIMIT[want]) { toast(PW.rarityName(want) + ' erlaubt höchstens ' + PW.GIFT_LIMIT[want] + (PW.GIFT_LIMIT[want] === 1 ? ' Gabe' : ' Gaben') + ', die Karte hat ' + fixed.gifts.length + '. Erst eine Gabe entfernen oder die Gaben mitwürfeln.', 7000); return; }
  const gen = PW.generate(want, Math.random, { fixed });
  const what = { all: 'alle Werte', energy: 'die Energie', stats: 'ATK und DEF', dirs: 'Richtungen und Laufschritte', gifts: 'die Gaben' }[part];
  if (!gen) { toast('Mit den übrigen Werten passt ' + what + ' nicht in ' + PW.rarityName(want) + '. Tipp: „Alle Werte“ würfeln oder ein anderes Ziel wählen.', 7000); return; }
  const set = { all: ['atk', 'def', 'energy', 'attack', 'move', 'gifts'], energy: ['energy'], stats: ['atk', 'def'], dirs: ['attack', 'move'], gifts: ['gifts'] }[part];
  for (const k of set) c[k] = gen[k];
  if (part !== 'all') { for (const k of ['atk', 'def', 'energy']) if (!has(c[k])) c[k] = gen[k]; if (!dirsSet(c.attack)) c.attack = gen.attack; if (!dirsSet(c.move)) c.move = gen.move; }
  c.rarity = PW.evaluate(Object.assign({}, c, { rarity: null })).rarity; c.autoRarity = true;
  markDirty(); renderPanel(); redraw();
  if (!G.snapLock) toast('🎲 ' + what[0].toUpperCase() + what.slice(1) + ' neu: ' + PW.rarityName(c.rarity) + ', ' + String(PW.evaluate(c).total).replace('.', ',') + ' Punkte. Nochmal tippen für eine andere Variante.');
}
// Rahmenfarbe passend zum Bild (Farbanalyse der Indoor-KI, nur Gestaltung)
const ELEMENT_THEME = { feuer: 'karmesin', wasser: 'blau', erde: 'bernstein', wind: 'smaragd', blitz: 'bernstein', licht: 'elfenbein', dunkelheit: 'obsidian' };
async function khTheme() {
  const c = G.card; if (!c) return; aiSnap();
  let el = c.element;
  if (c.art && c.art.id && window.WOK_INDOOR) { const b = await ST.imageBlob(c.art.id).catch(() => null); if (b) { const a = await window.WOK_INDOOR.analyzeImage(b); if (a && a.element) el = a.element; } }
  if (!el) { toast('Erst eine Illustration hochladen oder ein Element wählen.'); return; }
  c.style = Object.assign({}, c.style, { theme: ELEMENT_THEME[el] || 'blau' });
  markDirty(); renderPanel(); redraw(); toast('Rahmen „' + R.THEMES[c.style.theme].name + '“ passend zu den Bildfarben.');
}
function setCardType(t) {
  const c = G.card; if (!c || c.type === t) return; aiSnapValue();
  const wasSpell = isSpellCard(c);
  if (t === 'spell' || t === 'curse') {
    const keep = wasSpell && c.spell ? c.spell : null;
    c.type = t; c.atk = ''; c.def = ''; c.hp = ''; c.element = null; c.element2 = null; c.race = null; c.race2 = null; c.classes = [null, null]; c.gifts = [];
    c.attack = { dirs: {}, showNumber: false, number: 1 }; c.move = { dirs: {}, showNumber: false, number: 1 };
    c.autoRarity = false; c.autoEnergy = false; c.ruleText = c.ruleText || ''; c.flavor = c.flavor || ''; c.subtitle = c.subtitle || '';
    c.spell = keep ? window.WOK_EFFECTS.normalizeSpell(keep, t) : window.WOK_EFFECTS.blankSpell(t);
    if (c.art) { c.art = Object.assign({}, c.art); delete c.art.scale; delete c.art.x; delete c.art.y; }
    toast(t === 'curse' ? 'Jetzt eine Fluchkarte: Energie, Seltenheit, Effekte und Regeltext. Keine ATK/DEF und keine Richtungen.' : 'Jetzt eine Zauberkarte: Energie, Seltenheit, Effekte und Regeltext. Keine ATK/DEF und keine Richtungen.', 6000);
    markDirty(); renderPanel(); redraw(); return;
  }
  if (wasSpell) { delete c.spell; c.autoRarity = true; c.autoEnergy = true; if (c.art) { c.art = Object.assign({}, c.art); delete c.art.scale; delete c.art.x; delete c.art.y; } }
  if (t === 'king') {
    c.type = 'king'; c.energy = ''; c.def = ''; c.move = { dirs: {}, showNumber: false, number: 1 };
    c.attack.dirs = Object.fromEntries(Object.keys(c.attack.dirs || {}).filter(k => c.attack.dirs[k] && PW.KING.dirs.includes(k)).map(k => [k, 1])); c.attack.showNumber = false;
    const had = c.gifts.length; c.gifts = []; if (c.atk !== '' && +c.atk < 2000) c.atk = 2000; if (c.hp === '' || c.hp == null) c.hp = 10000;
    toast('Jetzt eine Königskarte: Krone statt Energie, HP statt DEF, kein Laufen.' + (had ? ' Die Heldengaben wurden entfernt (Könige haben eigene königliche Gaben).' : ''), 6000);
  } else { c.type = 'hero'; c.hp = ''; c.gifts = []; toast('Jetzt wieder eine Heldenkarte.'); }
  markDirty(); renderPanel(); redraw();
}
function aiSnapValue() { if (G.card) G.undo = { card: clone(G.card), at: Date.now() }; }
function aiSnap() { if (G.card && !G.snapLock) { G.undo = { card: clone(G.card), at: Date.now() }; } }
function khUndo() {
  if (!G.undo || !G.card) return; const u = G.undo.card; G.undo = null;
  for (const k of Object.keys(G.card)) delete G.card[k]; Object.assign(G.card, clone(u));
  markDirty(); renderPanel(); redraw(); toast('Rückgängig gemacht.');
}
// Edelsteine passend zum Element (nur Gestaltung, keine Regel)
const ELEMENT_GEM = { feuer: 'rubin', wasser: 'saphir', erde: 'topas', wind: 'jade', blitz: 'citrin', licht: 'mondstein', dunkelheit: 'amethyst' };
function khColors(quiet) {
  const c = G.card; if (!c || !c.element) return; if (!quiet) aiSnap();
  const g = ELEMENT_GEM[c.element] || 'original', g2 = c.element2 ? ELEMENT_GEM[c.element2] || g : g;
  c.style = Object.assign({}, c.style, { energy: g, element: g2, atk: g, def: g2 });
  markDirty(); renderPanel(); redraw(); if (!quiet) toast('Steine passend zu ' + (D.ELEMENTS.find(e => e.id === c.element) || {}).name + (c.element2 ? ' und ' + (D.ELEMENTS.find(e => e.id === c.element2) || {}).name : '') + ' gefärbt.');
}
async function khAll() {
  const c = G.card; if (!c || G.khBusy) return;
  if (!(c.art && c.art.id)) { toast('Erst eine Illustration hochladen.'); return; }
  aiSnap(); G.snapLock = true; G.khBusy = true;
  try {
    toast('✦ KI sieht sich das Bild an …', 15000);
    await identifyFromArt(true);
    const oldName = c.name; c.name = ''; await findName(true); if (!c.name) c.name = oldName;
    rollPart('all'); khColors(true);
    toast('✦ Fertig: ' + (c.name || 'Ohne Namen') + ' · ' + PW.rarityName(c.rarity) + ' · ' + String(PW.evaluate(c).total).replace('.', ',') + ' Punkte. Gefällt nicht? „Rückgängig“ oder nochmal tippen.', 7000);
  } finally { G.snapLock = false; G.khBusy = false; renderPanel(); }
}
function rollStats(quiet) {
  const c = G.card; if (!c) return; aiSnap();
  if (!c.rarity) { toast('Erst eine Seltenheit anwählen, dann würfle ich passende Werte dazu.'); return; }
  const keep = G.rollKeepGifts ? c.gifts.map(g => g.id) : null;
  if (keep && keep.length > PW.GIFT_LIMIT[c.rarity]) { toast(PW.rarityName(c.rarity) + ' erlaubt höchstens ' + PW.GIFT_LIMIT[c.rarity] + (PW.GIFT_LIMIT[c.rarity] === 1 ? ' Gabe' : ' Gaben') + '. Entferne erst eine Gabe oder würfle ohne „eigene Gaben behalten“.', 6000); return; }
  const gen = PW.generate(c.rarity, Math.random, { gifts: keep });
  if (!gen) { toast('Mit diesen Gaben passt keine Kombination in ' + PW.rarityName(c.rarity) + '. Ohne „eigene Gaben behalten“ würfeln.', 6000); return; }
  Object.assign(c, { atk: gen.atk, def: gen.def, energy: gen.energy, attack: gen.attack, move: gen.move, gifts: gen.gifts, autoRarity: true, rarity: gen.rarity });
  markDirty(); renderPanel(); redraw();
  if (!quiet) toast('Gewürfelt: ' + PW.rarityName(gen.rarity) + ', ' + String(gen.power).replace('.', ',') + ' Punkte · ' + gen.energy + ' Energie · ' + gen.atk + '/' + gen.def + '. Nochmal tippen für eine andere Kombination.');
}
/* Element, Rasse, Klasse (und Name, falls leer) aus der Illustration bestimmen */
async function identifyFromArt(quiet, only) {
  const c = G.card; if (!c || G.identing) return; aiSnap();
  if (!(c.art && c.art.id)) { toast('Erst eine Illustration hochladen.'); return; }
  G.identing = true; const btn = $('#btn-identai'); if (btn) { btn.disabled = true; btn.textContent = '✦ sieht sich das Bild an …'; }
  let idn = null, src = '', err = '';
  const blob = await ST.imageBlob(c.art.id).catch(() => null);
  try {
    if (blob && await aiCan()) {
      const fix = AIM.fix; AIM.fix = {};
      let ans; try { ans = await aiJSON(aiPrompt(1), [await aiImageBlob(blob, 768)], { tier: 'default' }); } finally { AIM.fix = fix; }
      const o = ans && Array.isArray(ans.cards) ? ans.cards[0] : null;
      if (o) { idn = cleanIdentity(o); src = (await aiLabel()) || 'die KI'; }
    }
  } catch (e) { err = aiErrText(e); }
  if (!idn && blob && window.WOK_INDOOR) { idn = await window.WOK_INDOOR.identify(blob, AIM.season1); src = 'die Indoor-KI (Element aus den Bildfarben, Rasse und Klasse zufällig)'; }
  G.identing = false;
  const b2 = $('#btn-identai'); if (b2) { b2.disabled = false; b2.textContent = '✦ Aus dem Bild bestimmen'; }
  if (!idn || G.card !== c) { if (err) toast(err, 6000); return; }
  if (!only || only === 'element') Object.assign(c, { element: idn.element, element2: idn.element2 || null });
  if (!only || only === 'race') Object.assign(c, { race: idn.race, race2: idn.race2 || null });
  if (!only || only === 'class') c.classes = [idn.classes[0], idn.classes[1] || null];
  if (c.element2 === c.element) c.element2 = null; if (c.race2 === c.race) c.race2 = null; if (c.classes[1] === c.classes[0]) c.classes[1] = null;
  if (!only && !c.name && idn.name) c.name = idn.name;
  markDirty(); renderPanel(); redraw();
  const nm = (l, id) => (l.find(x => x.id === id) || {}).name;
  if (!quiet) toast('Bestimmt von ' + src + ': ' + [nm(D.ELEMENTS, c.element), nm(D.RACES, c.race), nm(D.CLASSES, c.classes[0])].filter(Boolean).join(' · ') + (idn.reason ? ' – ' + idn.reason : '') + (err ? ' (' + err + ')' : ''), 7000);
}
async function findName(auto) {
  const c = G.card; if (!c || G.naming) return;
  if (!(c.art && c.art.id)) { if (!auto) toast('Erst eine Illustration hochladen, dann findet die KI einen passenden Namen.'); return; }
  G.naming = true; const btn = $('#btn-nameai'); if (btn) { btn.disabled = true; btn.textContent = '✦ sucht …'; }
  let names = [], src = '', reason = '', errMsg = '';
  try {
    if (await aiCan()) {
      const blob = await ST.imageBlob(c.art.id);
      const small = blob ? await aiImageBlob(blob, 768) : null;
      if (small) {
        const ans = await aiJSON(namePrompt(c), [small], { tier: 'quick' });
        const raw = Array.isArray(ans) ? ans : (ans && Array.isArray(ans.names) ? ans.names : []);
        names = [...new Set(raw.map(n => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 28)).filter(Boolean))].slice(0, 3);
        reason = ans && ans.reason ? String(ans.reason).slice(0, 100) : '';
        src = 'Vorschläge von ' + ((await aiLabel()) || 'der KI');
      }
    }
  } catch (e) { if (!(auto && e && e.code === 'not_granted')) errMsg = aiErrText(e); }
  if (!names.length && window.WOK_INDOOR) {
    const idn = { element: c.element || 'licht', race: c.race, classes: c.classes }, set = new Set();
    for (let i = 0; i < 12 && set.size < 3; i++) set.add(window.WOK_INDOOR.makeName(idn));
    names = [...set]; src = 'Indoor-KI (offline, ohne Bilderkennung, passend zu Element und Rasse)';
  }
  G.naming = false;
  const b2 = $('#btn-nameai'); if (b2) { b2.disabled = false; b2.textContent = '✦ Name finden'; }
  if (G.card !== c || !names.length) return;
  if (!auto || !c.name) { c.name = names[0]; const el = $('#in-name'); if (el) el.value = c.name; markDirty(); redraw(); }
  G.nameSugg = { names, src, reason, cardRef: c };
  const box = $('#name-sugg'); if (box) box.innerHTML = nameSuggHTML();
  if (errMsg) toast(errMsg + ' Die Indoor-KI hat „' + c.name + '“ vorgeschlagen.', 7000);
  else if (!auto) toast('Name eingesetzt: ' + c.name + '. Andere Vorschläge darunter antippen.');
}

/* ================= Abgleich über einen Cloud-Ordner (Google Drive, OneDrive, Dropbox) =================
 * Ordnerinhalt: WoK_Sync/Karten/<karten-id>.json und WoK_Sync/Bilder/<sha1>.<endung>
 * Je Karte gewinnt die neuere Fassung (Feld „updated“). Gelöschte Karten hinterlassen einen Grabstein ({deleted:true}).
 * PC-Version: läuft automatisch (Start, jede Minute, kurz nach jeder Änderung). Cloud-Version: Ordner einlesen bzw. als ZIP speichern. */
const SYNC = { busy: false, timer: null, last: 0, info: null, msg: '' };
function syncLS() { try { return Object.assign({ hash: {}, local: {}, deleted: {} }, JSON.parse(localStorage.getItem('wok-sync') || '{}')); } catch (e) { return { hash: {}, local: {}, deleted: {} }; } }
function syncSave(o) { try { localStorage.setItem('wok-sync', JSON.stringify(o)); } catch (e) {} }
function syncTombstone(id) { if (!id) return; const ls = syncLS(); ls.deleted[id] = Date.now(); syncSave(ls); }
async function syncWhere() { try { SYNC.info = await (await fetch('/api/sync/where')).json(); } catch (e) { SYNC.info = null; } return SYNC.info; }
const extOf = b => '.' + (((b.type || '').split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg').replace(/[^a-z0-9]/g, '') || 'png');
async function syncImageName(ls, artId) {
  if (ls.hash[artId]) return ls.hash[artId];
  const b = await ST.imageBlob(artId); if (!b) return '';
  const n = (await sha1Hex(await b.arrayBuffer())) + extOf(b); ls.hash[artId] = n; ls.local[n] = artId; return n;
}
// Gemeinsame Abgleichlogik. src: { cards: Map(id → Karte), image(name) → Blob|null }, dst: { putCard(id, obj), putImage(name, blob), hasImage(name) } oder null (nur einlesen)
async function syncMerge(src, dst) {
  const ls = syncLS(); let up = 0, down = 0, del = 0;
  for (const [id, R] of src.cards) {
    const loc = ST.get(id);
    if (R.deleted) { if (loc && (+loc.updated || 0) <= (+R.updated || 0)) { await ST.del(id); del++; } continue; }
    if (loc && (+loc.updated || 0) >= (+R.updated || 0)) continue;
    if (ls.deleted[id] && ls.deleted[id] >= (+R.updated || 0)) continue; // hier gelöscht, nachdem die Fassung entstand
    const c = normalize(clone(R)); delete c.syncImage; delete c.giftDetails;
    if (R.syncImage && c.art) {
      let lid = ls.local[R.syncImage];
      if (!lid || !(await ST.imageURL(lid))) {
        const blob = await src.image(R.syncImage);
        if (blob) { const r = await ST.putImage(blob); lid = r.id; ls.local[R.syncImage] = lid; ls.hash[lid] = R.syncImage; }
        else lid = loc && loc.art ? loc.art.id : null;
      }
      c.art.id = lid; if (!lid) c.art = null;
    }
    c.id = id; await ST.put(c, +R.updated || Date.now()); down++;
  }
  if (dst) {
    for (const loc of ST.list()) {
      const R = src.cards.get(loc.id); if (R && (+R.updated || 0) >= (+loc.updated || 0)) continue;
      const out = clone(loc); delete out.giftDetails;
      if (loc.art && loc.art.id) {
        const n = await syncImageName(ls, loc.art.id);
        if (n) { if (!dst.hasImage(n)) { const b = await ST.imageBlob(loc.art.id); if (b) await dst.putImage(n, b); } out.syncImage = n; }
      }
      await dst.putCard(loc.id, out); up++;
    }
    for (const [id, at] of Object.entries(ls.deleted)) { if (!ST.get(id)) { const R = src.cards.get(id); if (!R || (!R.deleted && (+R.updated || 0) <= at)) await dst.putCard(id, { id, deleted: true, updated: at }); } }
  }
  syncSave(ls);
  if (down || del) { await recalcLibrary(true); G.thumbs.clear(); renderLib(); if (G.cardId && !G.dirty) { if (ST.get(G.cardId)) openCard(G.cardId); else openCard(null); } }
  return { up, down, del };
}
async function syncNow(quiet) {
  if (!window.WOK_DESKTOP || SYNC.busy || !ST.state.canWrite) return;
  const inf = await syncWhere(); if (!inf || !inf.dir) { if (!quiet) syncDialog(); return; }
  if (!inf.ok) { SYNC.msg = 'Ordner nicht erreichbar: ' + inf.dir; if (!quiet) toast(SYNC.msg + '. Läuft Google Drive / OneDrive?', 7000); syncDlgUpdate(); return; }
  SYNC.busy = true; syncDlgUpdate();
  try {
    const L = await (await fetch('/api/sync/list')).json();
    const imgs = new Set((L.images || []).map(x => x.name)), cards = new Map(), seen = syncLS().seen || {};
    const cache = SYNC.cache || (SYNC.cache = new Map());
    for (const f of L.cards || []) {
      if (!/^[A-Za-z0-9._-]+\.json$/.test(f.name)) continue;
      const id = f.name.slice(0, -5), ck = cache.get(f.name);
      if (ck && ck.mtime === f.mtime && ck.size === f.size) { cards.set(id, ck.obj); continue; }
      try { const j = await (await fetch('/api/sync/file?path=' + encodeURIComponent('Karten/' + f.name))).json(); if (j && j.id === id) { cards.set(id, j); cache.set(f.name, { mtime: f.mtime, size: f.size, obj: j }); } } catch (e) {}
    }
    const put = (path, body) => fetch('/api/sync/file?path=' + encodeURIComponent(path), { method: 'POST', body }).then(r => { if (!r.ok) throw new Error(path + ': ' + r.status); });
    const res = await syncMerge({ cards, image: async n => { const r = await fetch('/api/sync/file?path=' + encodeURIComponent('Bilder/' + n)); return r.ok ? r.blob() : null; } },
      { putCard: (id, o) => { cache.delete(id + '.json'); return put('Karten/' + id + '.json', JSON.stringify(o)); }, putImage: async (n, b) => { await put('Bilder/' + n, b); imgs.add(n); }, hasImage: n => imgs.has(n) });
    SYNC.last = Date.now();
    SYNC.msg = 'Zuletzt abgeglichen ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + (res.up || res.down || res.del ? ': ' + res.up + ' hochgeladen, ' + res.down + ' übernommen' + (res.del ? ', ' + res.del + ' gelöscht' : '') : ': alles aktuell');
    if (!quiet || res.down || res.del) toast('☁ ' + SYNC.msg + '.', 5000);
  } catch (e) { SYNC.msg = 'Abgleich fehlgeschlagen: ' + (e && e.message || e); if (!quiet) toast(SYNC.msg, 7000); }
  finally { SYNC.busy = false; syncDlgUpdate(); }
}
function syncSoon() { if (!window.WOK_DESKTOP) return; clearTimeout(SYNC.timer); SYNC.timer = setTimeout(() => SYNC.info && SYNC.info.dir && syncNow(true), 4000); }
async function syncStart() {
  if (!window.WOK_DESKTOP) return;
  const inf = await syncWhere(); if (inf && inf.dir) syncNow(true);
  setInterval(() => { if (SYNC.info && SYNC.info.dir && !document.hidden) syncNow(true); }, 60000);
  ST.onChange(() => { if (!SYNC.busy) syncSoon(); });
}
async function syncPick(reset) {
  const st = $('#sync-st'); if (st && !reset) st.textContent = 'Ordnerauswahl ist geöffnet …';
  try { const r = await fetch('/api/sync/pick' + (reset ? '?reset=1' : ''), { method: 'POST' }); const j = await r.json().catch(() => ({})); if (!r.ok) toast(j.message || 'Ordnerauswahl nicht möglich.'); }
  catch (e) { toast('Ordnerauswahl nicht möglich.'); }
  await syncWhere(); SYNC.cache = null; syncDialog(); if (SYNC.info && SYNC.info.dir) syncNow(false);
}
function syncDlgUpdate() { const el = $('#sync-st'); if (el) el.textContent = SYNC.busy ? 'Abgleich läuft …' : SYNC.msg; }
async function syncDialog() {
  if (window.WOK_DESKTOP) {
    const inf = await syncWhere();
    showModal('Abgleich über Google Drive / OneDrive', `<p style="font-size:13.5px">Wähle einen Ordner, den <b>Google Drive für Desktop</b> (oder OneDrive, Dropbox) mit deinen anderen Geräten teilt, z. B. <code>G:\\Meine Ablage</code>. Die Werkstatt legt darin <code>WoK_Sync</code> an und gleicht deine Karten und Bilder automatisch ab: beim Start, jede Minute und kurz nach jeder Änderung. Je Karte gewinnt die neuere Fassung, gelöschte Karten werden auch auf den anderen Geräten gelöscht.</p>
      <p style="font-size:13.5px">${inf && inf.dir ? 'Ordner: <b>' + esc(inf.dir) + '</b>' + (inf.ok ? '' : ' <span style="color:var(--bad)">(gerade nicht erreichbar)</span>') : '<span class="muted">Noch kein Ordner gewählt.</span>'}</p>
      <p id="sync-st" class="muted" style="font-size:13px">${esc(SYNC.busy ? 'Abgleich läuft …' : SYNC.msg)}</p>
      <p class="muted" style="font-size:12.5px">Am Handy und in der Cloud-Version: Dort sind deine Karten über dein Claude-Konto ohnehin auf allen Geräten gleich. Mit dem Drive-Ordner abgleichen kannst du sie dort über „Abgleich über Google Drive / OneDrive“ → „Ordner einlesen“.</p>`,
      '<button data-act="close">Schließen</button>' + (inf && inf.dir ? '<button data-act="sync-reset">Trennen</button><button data-act="sync-open">Ordner öffnen</button><button data-act="sync-pick">Anderen Ordner …</button><button class="gold" data-act="sync-now">Jetzt abgleichen</button>' : '<button class="gold" data-act="sync-pick">Ordner wählen …</button>'));
    return;
  }
  showModal('Abgleich über Google Drive / OneDrive', `<p style="font-size:13.5px">In der Cloud-Version sind deine Karten über dein Claude-Konto auf <b>Handy, PC und Laptop</b> automatisch gleich. Mit dem Drive-Ordner der PC-Version (<code>WoK_Sync</code>) gleichst du so ab:</p>
    <ul style="font-size:13.5px;margin:0 0 8px 18px;padding:0"><li><b>Ordner einlesen:</b> den Ordner <code>WoK_Sync</code> (oder die Dateien aus <code>Karten</code> und <code>Bilder</code>) auswählen. Neuere Karten werden übernommen, nichts doppelt.</li>
    <li><b>Für Drive speichern:</b> erzeugt <code>WoK_Sync.zip</code>. In deinen Drive-Ordner entpacken (vorhandene Dateien ersetzen); die PC-Version übernimmt die Karten beim nächsten Abgleich.</li></ul>
    <input type="file" id="sync-files" multiple webkitdirectory hidden><input type="file" id="sync-files2" multiple accept=".json,image/*" hidden>
    <p id="sync-st" class="muted" style="font-size:13px"></p>`,
    '<button data-act="close">Schließen</button><button data-act="sync-zip">Für Drive speichern (ZIP)</button><button id="sync-pickfiles">Dateien wählen …</button><button class="gold" data-act="sync-import">Ordner einlesen …</button>');
  const onFiles = async files => {
    const st = $('#sync-st'); const list = [...files]; if (!list.length) return;
    st.textContent = 'Wird eingelesen …';
    const cards = new Map(), byName = new Map();
    for (const f of list) { byName.set(f.name, f); }
    for (const f of list) if (/\.json$/i.test(f.name) && (!f.webkitRelativePath || /Karten\//.test(f.webkitRelativePath) || !/Bilder\//.test(f.webkitRelativePath))) {
      try { const j = JSON.parse(await f.text()); if (j && j.id && (j.updated || j.deleted)) cards.set(j.id, j); else if (j && Array.isArray(j.cards)) { await importJSON(f); } } catch (e) {}
    }
    try { const r = await syncMerge({ cards, image: async n => byName.get(n) || null }, null); st.textContent = '✓ ' + r.down + ' Karten übernommen' + (r.del ? ', ' + r.del + ' gelöscht' : '') + ', ' + (cards.size - r.down - r.del) + ' schon aktuell.'; }
    catch (e) { st.textContent = 'Einlesen fehlgeschlagen: ' + (e && e.message || e); }
  };
  $('#sync-files').onchange = e => onFiles(e.target.files);
  $('#sync-files2').onchange = e => onFiles(e.target.files);
  $('#sync-pickfiles').onclick = () => $('#sync-files2').click();
}
async function syncExportZip() {
  const st = $('#sync-st'); if (st) st.textContent = 'ZIP wird erstellt …';
  const ls = syncLS(), entries = [], imgs = new Set();
  for (const loc of ST.list()) {
    const out = clone(loc);
    if (loc.art && loc.art.id) { const n = await syncImageName(ls, loc.art.id); if (n) { out.syncImage = n; if (!imgs.has(n)) { const b = await ST.imageBlob(loc.art.id); if (b) { entries.push({ name: 'WoK_Sync/Bilder/' + n, data: new Uint8Array(await b.arrayBuffer()) }); imgs.add(n); } } } }
    entries.push({ name: 'WoK_Sync/Karten/' + loc.id + '.json', data: new TextEncoder().encode(JSON.stringify(out)) });
  }
  for (const [id, at] of Object.entries(ls.deleted)) if (!ST.get(id)) entries.push({ name: 'WoK_Sync/Karten/' + id + '.json', data: new TextEncoder().encode(JSON.stringify({ id, deleted: true, updated: at })) });
  syncSave(ls);
  const ok = await saveFile('WoK_Sync.zip', makeZip(entries));
  if (st) st.textContent = ok ? '✓ WoK_Sync.zip gespeichert (' + ST.list().length + ' Karten). In den Drive-Ordner entpacken.' : 'Speichern abgebrochen.';
}

/* ================= KI-Verbindung (nur Windows-Version) ================= */
const AI_PROVIDERS = [
  ['aus', 'Aus (nur Indoor-KI, offline)', ''],
  ['ollama', 'Ollama – lokal auf deinem PC, kostenlos', 'Läuft komplett auf deinem PC, ohne Internet und ohne Kosten. Ollama von ollama.com installieren und ein Bildmodell laden, z. B. in der Eingabeaufforderung: ollama pull gemma3 (braucht etwa 8 GB Arbeitsspeicher, mit Grafikkarte deutlich schneller).'],
  ['gemini', 'Google Gemini – kostenloses Kontingent', 'Kostenloser API-Schlüssel unter aistudio.google.com (Google-Konto). Begrenzte Anfragen pro Tag. Achtung: Im kostenlosen Kontingent darf Google Eingaben zur Verbesserung nutzen.'],
  ['openai', 'ChatGPT (OpenAI-API) – kostenpflichtig', 'Eigener API-Schlüssel von platform.openai.com. Wird pro Anfrage abgerechnet (für Namen meist Bruchteile eines Cents). Ein ChatGPT-Plus-Abo gilt hier nicht.'],
  ['anthropic', 'Claude-API – kostenpflichtig', 'Eigener API-Schlüssel von console.anthropic.com. Wird pro Anfrage abgerechnet. Ein Claude-Abo gilt hier nicht.']
];
async function aiConfigDialog() {
  let cfg = { provider: 'aus', models: {}, hasKey: {}, ollamaURL: 'http://127.0.0.1:11434' };
  try { cfg = Object.assign(cfg, await (await fetch('/api/ai/config')).json()); } catch (e) {}
  G.aicfg = cfg;
  showModal('KI-Verbindung', `<p style="font-size:13.5px">Für „Name finden“ und den AI-Modus. Die Verbindung wird nur benutzt, wenn der PC online ist (Ollama auch offline). Ohne Verbindung übernimmt die Indoor-KI.</p>
    <label>Anbieter<select id="aic-prov">${AI_PROVIDERS.map(([k, t]) => '<option value="' + k + '"' + (cfg.provider === k ? ' selected' : '') + '>' + t + '</option>').join('')}</select></label>
    <p class="muted" id="aic-help" style="font-size:12.5px"></p>
    <label id="aic-keyrow">API-Schlüssel <span class="muted" id="aic-keyst"></span><input type="password" id="aic-key" autocomplete="off" placeholder="Schlüssel einfügen"></label>
    <label id="aic-urlrow">Ollama-Adresse<input type="text" id="aic-url" value="${esc(cfg.ollamaURL)}"></label>
    <label id="aic-modelrow">Modell <span class="muted">(leer = automatisch ein günstiges Bildmodell)</span><div class="inline"><input type="text" id="aic-model" list="aic-models" style="flex:1"><datalist id="aic-models"></datalist><button data-act="aicfg-models">Modelle laden</button></div></label>
    <p id="aic-status" style="font-size:13px"></p>
    <p class="muted" style="font-size:12px">Schlüssel werden nur auf diesem PC gespeichert (im App-Ordner, nicht in „Dokumente“) und nie angezeigt.</p>`,
    '<button data-act="close">Schließen</button><button data-act="aicfg-test">Speichern und testen</button><button class="gold" data-act="aicfg-save">Speichern</button>');
  const upd = () => {
    const p = $('#aic-prov').value, info = AI_PROVIDERS.find(x => x[0] === p);
    $('#aic-help').textContent = info[2];
    $('#aic-keyrow').hidden = !['gemini', 'openai', 'anthropic'].includes(p);
    $('#aic-urlrow').hidden = p !== 'ollama'; $('#aic-modelrow').hidden = p === 'aus';
    $('#aic-keyst').textContent = (G.aicfg.hasKey || {})[p] ? '· gespeichert (zum Ändern neu einfügen)' : '';
    $('#aic-model').value = (G.aicfg.models || {})[p] || '';
  };
  $('#aic-prov').onchange = upd; upd();
}
async function aiCfgPut() {
  const p = $('#aic-prov').value, body = { provider: p, models: { [p]: $('#aic-model').value }, key: $('#aic-key').value, ollamaURL: $('#aic-url').value };
  const r = await fetch('/api/ai/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw { code: 'error', message: await r.text() };
  G.aicfg = await (await fetch('/api/ai/config')).json(); $('#aic-key').value = ''; AIX.desk = undefined;
  $('#aic-keyst').textContent = (G.aicfg.hasKey || {})[p] ? '· gespeichert (zum Ändern neu einfügen)' : '';
  return p;
}
async function aiCfgModels() {
  const st = $('#aic-status'); st.textContent = 'Modelle werden geladen …';
  try {
    const p = await aiCfgPut();
    const r = await fetch('/api/ai/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: p }) });
    const j = await r.json(); if (!r.ok) throw j;
    $('#aic-models').innerHTML = (j.models || []).map(m => '<option value="' + esc(m) + '">').join('');
    if (!$('#aic-model').value && j.suggested) $('#aic-model').value = j.suggested;
    st.textContent = (j.models || []).length + ' Modelle gefunden' + (j.suggested ? ', vorgeschlagen: ' + j.suggested : '') + '.';
  } catch (e) { st.textContent = aiErrText(e); }
}
async function aiCfgSave(test) {
  const st = $('#aic-status');
  try {
    const p = await aiCfgPut();
    aiChipRefresh();
    if (!test) { toast(p === 'aus' ? 'KI-Verbindung aus: Namen kommen von der Indoor-KI.' : 'KI-Verbindung gespeichert.'); closeModal(); return; }
    if (p === 'aus') { st.textContent = 'Aus: nichts zu testen.'; return; }
    st.textContent = 'Teste die Verbindung …';
    const v = await aiJSON('Antworte nur mit JSON: {"ok":true,"name":"ein erfundener Fantasy-Heldenname"}', [], {});
    if (!(v && v.ok)) { st.textContent = 'Antwort erhalten, aber unerwartet: ' + JSON.stringify(v).slice(0, 120); return; }
    let line = '✓ Verbindung zu ' + (PROVIDER_NAMES[p] || p) + ' klappt. Testname: ' + (v.name || '–') + '.';
    // Bilderkennung prüfen, wenn eine Karte mit Illustration offen ist
    if (G.card && G.card.art && G.card.art.id) {
      st.textContent = line + ' Prüfe jetzt die Bilderkennung mit der Illustration der offenen Karte …';
      try {
        const blob = await ST.imageBlob(G.card.art.id), small = blob ? await aiImageBlob(blob, 512) : null;
        const w = small ? await aiJSON('Beschreibe das Motiv der Illustration in höchstens 8 deutschen Wörtern. Antworte nur mit JSON: {"motiv":"…"}', [small], {}) : null;
        line += w && w.motiv ? ' ✓ Bilderkennung klappt: „' + String(w.motiv).slice(0, 80) + '“' : ' Bilderkennung: keine verwertbare Antwort (Modell kann eventuell keine Bilder).';
      } catch (e) { line += ' ✗ Bilderkennung: ' + aiErrText(e) + ' (Modell kann eventuell keine Bilder; ein anderes Modell wählen).'; }
    } else line += ' Für einen Test der Bilderkennung vorher eine Karte mit Illustration öffnen.';
    st.textContent = line; aiChipRefresh();
  } catch (e) { st.textContent = '✗ ' + aiErrText(e); }
}

/* ---------- Immer sichtbare Gesamt-Power ---------- */
function updateFloat() {
  const el = $('#pw-float'); if (!el) return;
  const c = G.card; if (!c || isSpellCard(c)) { el.hidden = true; return; }
  const ev = PW.evaluate(Object.assign({}, c, { rarity: null }));
  el.hidden = false;
  if (el.dataset.r && el.dataset.r !== ev.rarity) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  el.dataset.r = ev.rarity;
  el.innerHTML = '<i></i><b>' + String(ev.total).replace('.', ',') + '</b><small>' + esc(PW.rarityName(ev.rarity)) + '</small>';
  el.setAttribute('aria-label', 'Gesamt-Power ' + String(ev.total).replace('.', ',') + ' Punkte, ' + PW.rarityName(ev.rarity));
}

/* ================= Ganze Bibliothek als Bilder ================= */
// Minimaler ZIP-Schreiber (ohne Kompression – PNGs sind schon komprimiert)
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function makeZip(files) { // files: [{name, data: Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true);
    c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + sz;
  }
  const csz = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
function libDlScopes() {
  const all = ST.list(), rel = all.filter(c => c.status === 'freigegeben'), filt = filteredCards();
  const pick = G.libPick ? all.filter(c => G.libPick.has(c.id)) : [], fold = G.filters.folder && G.filters.folder !== '-' ? all.filter(c => c.folder === G.filters.folder) : [];
  return { freigegeben: rel, alle: all, filter: filt, auswahl: pick, ordner: fold };
}
function libDlDialog() {
  const sc = libDlScopes(), p = G.libdl || (G.libdl = { scope: sc.freigegeben.length ? 'freigegeben' : 'alle', fmt: 'online', mark: false });
  const opt = (k, t, n) => '<label class="inline"><input type="radio" name="ld-scope" value="' + k + '" ' + (p.scope === k ? 'checked' : '') + ' ' + (n ? '' : 'disabled') + '> ' + t + ' <span class="muted">(' + n + ')</span></label>';
  showModal('Bibliothek als Bilder herunterladen', `<p style="font-size:13.5px">${window.WOK_DESKTOP ? 'Jede Karte wird als eigene PNG-Datei in einen neuen Ordner unter „Dokumente\\War of Kings Kartenwerkstatt\\Exporte“ gespeichert.' : 'Alle Karten kommen als PNG-Dateien in eine ZIP-Datei. Auf dem Handy öffnest du sie in der Dateien-App, dort entpacken und die Bilder sichern.'}</p>
    <div style="display:grid;gap:6px">${opt('freigegeben', 'Nur freigegebene (fertige) Karten', sc.freigegeben.length)}${opt('alle', 'Alle Karten', sc.alle.length)}${opt('filter', 'Wie in der Bibliothek gefiltert', sc.filter.length)}${sc.ordner.length ? opt('ordner', 'Ordner „' + esc(G.filters.folder) + '“', sc.ordner.length) : ''}${opt('auswahl', 'Nur die ausgewählten Karten', sc.auswahl.length)}</div>
    <label>Format<select id="ld-fmt">
      <option value="online" ${p.fmt === 'online' ? 'selected' : ''}>Online-Format 1024 × 1536 (handlich)</option>
      <option value="online2" ${p.fmt === 'online2' ? 'selected' : ''}>Online-Format hoch 2048 × 3072</option>
      <option value="ygo" ${p.fmt === 'ygo' ? 'selected' : ''}>Yu-Gi-Oh 59 × 86 mm · 600 dpi</option></select></label>
    <div class="inline"><label><input type="checkbox" id="ld-mark" ${p.mark ? 'checked' : ''}> „Entwurf“-Stempel auf nicht freigegebenen Karten</label></div>
    <p id="ld-status" style="font-size:13px"></p>`,
    '<button data-act="close">Schließen</button><button class="gold" data-act="lib-dl-go" id="ld-go">Bilder erstellen</button>');
}
function uniqueName(base, used) { let n = base, i = 2; while (used.has(n.toLowerCase())) n = base + ' (' + i++ + ')'; used.add(n.toLowerCase()); return n; }
async function libDlRun() {
  if (G.libDlBusy) return;
  const p = G.libdl; p.scope = ($('input[name=ld-scope]:checked') || {}).value || 'alle'; p.fmt = $('#ld-fmt').value; p.mark = $('#ld-mark').checked;
  const list = libDlScopes()[p.scope] || [];
  if (!list.length) { $('#ld-status').textContent = 'Keine Karten in dieser Auswahl.'; return; }
  G.libDlBusy = true; G.libDlStop = false;
  const go = $('#ld-go'); go.textContent = 'Anhalten'; go.dataset.act = 'lib-dl-stop'; go.classList.remove('gold');
  const st = $('#ld-status'), used = new Set(), files = [];
  const nw = new Date(), z = n => String(n).padStart(2, '0');
  const stamp = nw.getFullYear() + '-' + z(nw.getMonth() + 1) + '-' + z(nw.getDate()) + '_' + z(nw.getHours()) + '-' + z(nw.getMinutes());
  const folder = 'Bibliothek_' + stamp;
  let done = 0, failed = 0;
  try {
    for (const raw of list) {
      if (G.libDlStop) break;
      st.textContent = 'Karte ' + (done + 1) + ' von ' + list.length + ': ' + (raw.name || 'Ohne Namen') + ' …';
      try {
        const card = normalize(clone(raw));
        const k = p.fmt === 'online' ? 1 : 2;
        const cv = document.createElement('canvas'); cv.width = G.layout.W * k; cv.height = G.layout.H * k;
        await renderTo(cv, card, { placeholder: false, watermark: p.mark && card.status !== 'freigegeben' });
        const out = p.fmt === 'ygo' ? R.composeFormat(cv, 59, 86, 0, 'stretch', 600 / 25.4) : cv;
        const blob = await new Promise(r => out.toBlob(r, 'image/png'));
        const name = uniqueName(fileBase(card) + (p.fmt === 'ygo' ? '_YuGiOh' : ''), used) + '.png';
        if (window.WOK_DESKTOP) {
          const r = await fetch('/api/export?dir=' + encodeURIComponent(folder) + '&name=' + encodeURIComponent(name), { method: 'POST', body: blob });
          if (!r.ok) throw new Error(r.status);
        } else files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
        done++;
      } catch (e) { failed++; done++; }
      await new Promise(r => setTimeout(r, 0));
    }
    const ok = done - failed;
    if (window.WOK_DESKTOP) {
      st.textContent = ok + ' Bilder gespeichert in Exporte\\' + folder + (failed ? ' · ' + failed + ' fehlgeschlagen' : '') + (G.libDlStop ? ' (angehalten)' : '') + '.';
      if (ok) fetch('/api/open-folder?dir=' + encodeURIComponent(folder), { method: 'POST' }).catch(() => {});
    } else if (files.length) {
      st.textContent = 'ZIP wird gepackt …';
      const zip = makeZip(files);
      const saved = await saveFile('War_of_Kings_Bibliothek_' + stamp + '.zip', zip);
      st.textContent = saved ? files.length + ' Bilder als ZIP (' + (zip.size / 1048576).toFixed(1).replace('.', ',') + ' MB)' + (failed ? ' · ' + failed + ' fehlgeschlagen' : '') + '.' : 'Speichern abgebrochen.';
    } else st.textContent = 'Keine Bilder erstellt.';
  } finally {
    G.libDlBusy = false; const b = $('#ld-go'); if (b) { b.textContent = 'Bilder erstellen'; b.dataset.act = 'lib-dl-go'; b.classList.add('gold'); }
  }
}

/* ---------- KI-Status im Kopf: zeigt, womit Namensfindung und AI-Modus gerade arbeiten ---------- */
const AICHIP = { text: '' };
async function aiChipRefresh() {
  const el = $('#ai-chip'); if (!el) return;
  const set = (state, label, text) => { el.dataset.s = state; el.textContent = label; el.title = text; AICHIP.text = text; };
  if (!window.WOK_DESKTOP) {
    const ok = await aiAvailability();
    if (ok) set('ok', 'KI: Claude ✓', 'Namensfindung und Motiverkennung laufen über Claude (dein Claude-Abo, keine Extrakosten).');
    else set('aus', 'KI: Indoor', 'Claude ist in dieser Ansicht nicht verfügbar. Namen und Elemente kommen von der Indoor-KI (offline, ohne Bilderkennung).');
    return;
  }
  let cfg = null;
  try { cfg = await (await fetch('/api/ai/config')).json(); } catch (e) {}
  if (!cfg || !cfg.provider || cfg.provider === 'aus') { set('aus', 'KI: Indoor', 'Keine KI-Verbindung eingerichtet. Antippen zum Einrichten. Bis dahin arbeitet die Indoor-KI (offline, ohne Bilderkennung).'); return; }
  const nm = PROVIDER_NAMES[cfg.provider] || cfg.provider, short = { ollama: 'Ollama', gemini: 'Gemini', openai: 'ChatGPT', anthropic: 'Claude-API' }[cfg.provider] || nm;
  if (cfg.provider !== 'ollama' && !(cfg.hasKey || {})[cfg.provider]) { set('bad', 'KI: ' + short + ' ✗', nm + ': Es fehlt der API-Schlüssel. Antippen zum Eintragen.'); return; }
  set('wait', 'KI: ' + short + ' …', 'Verbindung zu ' + nm + ' wird geprüft …');
  try {
    const r = await fetch('/api/ai/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: cfg.provider }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const model = (cfg.models || {})[cfg.provider] || j.suggested || '';
      set('ok', 'KI: ' + short + ' ✓', 'Verbunden mit ' + nm + (model ? ' · Modell ' + model : '') + '. Namensfindung und AI-Modus nutzen diese Verbindung.' + (cfg.provider === 'ollama' ? ' Läuft lokal und kostenlos.' : cfg.provider === 'gemini' ? ' Kostenloses Kontingent mit Tageslimit.' : ' Kostenpflichtig pro Anfrage.'));
    } else {
      const off = j.code === 'offline';
      set(off ? 'off' : 'bad', 'KI: ' + short + (off ? ' – offline' : ' ✗'), (off ? (cfg.provider === 'ollama' ? 'Ollama läuft gerade nicht auf diesem PC.' : 'Keine Internetverbindung.') : aiErrText(j)) + ' Bis dahin übernimmt die Indoor-KI. Antippen für die Einstellungen.');
    }
  } catch (e) { set('off', 'KI: ' + short + ' – offline', 'Die Verbindung konnte nicht geprüft werden. Die Indoor-KI springt ein.'); }
}
setTimeout(aiChipRefresh, 1500);
if (window.WOK_DESKTOP) { setInterval(aiChipRefresh, 120000); addEventListener('online', aiChipRefresh); addEventListener('offline', aiChipRefresh); }
