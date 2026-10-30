/* WAR OF KINGS – Probe-Spiel: Oberfläche. Die Regeln stecken vollständig in engine.js; hier wird nur angezeigt und bedient. */
(function () {
  'use strict';
  const W = window.WOK, AI = window.WOK_AI, DAI = window.WOK_DECKAI, CARDART = window.WOK_CARDART, ADV = window.WOK_ADVISOR, GD = window.WOK_GD, DEMO = window.WOK_DEMO;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Number(n).toLocaleString('de-DE');
  const nameOf = (list, id) => ((GD[list] || []).find(x => x.id === id) || {}).name || id;
  const RAR = id => nameOf('rarities', id);
  const giftInfo = id => GD.gifts.find(g => g.id === id) || GD.royal.find(g => g.id === id) || { id, name: id, text: '' };
  const ARROW = { n: '↑', ne: '↗', e: '→', se: '↘', s: '↓', sw: '↙', w: '←', nw: '↖' };
  const GRID9 = ['nw', 'n', 'ne', 'w', null, 'e', 'sw', 's', 'se'];
  const ELCOL = { feuer: '#8a3324', wasser: '#24527a', erde: '#5b4a2c', wind: '#3d6b5a', blitz: '#6b5a1c', licht: '#7a6f44', dunkelheit: '#3a2a4a' };
  const VERSION = '4.2';
  const isSp = c => !!c && (c.type === 'spell' || c.type === 'curse');
  const TYPEN = c => c.type === 'king' ? 'König' : c.type === 'spell' ? 'Zauber' : c.type === 'curse' ? 'Fluch' : 'Held';
  const SPCOL = { spell: '#1f4a35', curse: '#3d2350' };

  /* ---------------- Speicher (IndexedDB, mit Rückfall) ---------------- */
  const DB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('wok-probespiel', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
    const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('kv', mode), st = t.objectStore('kv'); const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
    return {
      get: k => tx('readonly', st => st.get(k)).catch(() => undefined),
      set: (k, v) => tx('readwrite', st => st.put(v, k)).catch(() => undefined),
      del: k => tx('readwrite', st => st.delete(k)).catch(() => undefined),
      clear: () => tx('readwrite', st => st.clear()).catch(() => undefined)
    };
  })();
  const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* voll oder gesperrt */ } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };

  const SET = Object.assign({ mode: 'ai', level: 'mittel', name1: 'Spieler 1', name2: 'Spieler 2', timer: false, help: true, deckA: '', deckB: '', counterReserve: false }, LS.get('wok-spiel-setup') || {});

  /* ---------------- Kartensammlung ---------------- */
  // cards: Spielwerte · raw: Karte im Werkstatt-Format (für das volle Design) · src: Original-Illustration
  // full: fertiges Kartenbild · art: Bildausschnitt für die Spielfigur · fullv: womit das Kartenbild gezeichnet wurde
  // remote: wo die Bilder dauerhaft liegen ({ full, art, src } = Dateiname am PC bzw. Asset-ID in der Cloud)
  const POOL = { cards: {}, raw: {}, src: {}, art: {}, full: {}, fullv: {}, remote: {}, decks: [], source: '', layout: null, own: false };
  const urls = { art: {}, full: {}, src: {} };
  function remoteURL(ref) { return !ref ? '' : STORE.kind === 'cloud' ? '/_blob/' + ref : STORE.kind === 'pc' ? '/api/store/img?name=' + encodeURIComponent(ref) : ''; }
  function setImg(kind, id, blob) {
    if (urls[kind][id] && urls[kind][id].startsWith('blob:')) URL.revokeObjectURL(urls[kind][id]);
    const rem = POOL.remote[id]; if (rem && rem[kind]) { STORE.trash.push(rem[kind]); delete rem[kind]; }
    if (blob) { POOL[kind][id] = blob; urls[kind][id] = URL.createObjectURL(blob); } else { delete POOL[kind][id]; delete urls[kind][id]; }
  }
  function linkRemote() { for (const [id, r] of Object.entries(POOL.remote)) for (const k of ['full', 'art', 'src']) if (r[k] && !POOL[k][id]) urls[k][id] = remoteURL(r[k]); }
  const artURL = id => urls.art[id] || '';
  const fullURL = id => urls.full[id] || '';
  async function getBlob(kind, id) { if (POOL[kind][id]) return POOL[kind][id]; const u = urls[kind][id]; if (!u) return null; try { const r = await fetch(u); return r.ok ? await r.blob() : null; } catch (e) { return null; } }
  // Decks: [{ id, name, cards: [Karten-IDs], origin: 'eigen' | 'paket' | 'demo' }]
  async function savePool() {
    await DB.set('pool', { cards: Object.values(POOL.cards), raw: POOL.raw, src: POOL.src, decks: POOL.decks, source: POOL.source, art: POOL.art, full: POOL.full, fullv: POOL.fullv, remote: POOL.remote, layout: POOL.layout, own: POOL.own, store: STORE.kind });
    schedulePersist();
  }

  /* ---------------- Dauerhaft speichern: PC-Ordner oder Claude-Konto ---------------- */
  // PC: Dokumente\War of Kings Probe-Spiel (sammlung.json + bilder\)
  // Cloud: eigene, private Daten im Claude-Konto (db: data/users/<id>/…, Bilder als Assets). Sonst nur dieser Browser.
  const STORE = { kind: 'local', sig: {}, metaSig: '', trash: [], timer: 0, busy: false, again: false, db: null, assets: null, uid: null, state: 'idle', err: '' };
  const safeSeg = id => String(id).replace(/[^A-Za-z0-9_\-.~:@+]/g, '_').slice(0, 180) || 'karte';
  const ownIds = () => Object.keys(POOL.cards).filter(id => !isDemo(id));
  function metaDoc() { return { v: 1, decks: POOL.decks.filter(d => d.origin !== 'demo'), source: POOL.source, layout: POOL.layout, own: POOL.own, deckA: SET.deckA, deckB: SET.deckB, seen: IS_PC ? SEEN : undefined, saved: Date.now() }; }
  const cardRec = id => ({ id, card: POOL.cards[id], raw: POOL.raw[id] || null, remote: POOL.remote[id] || {}, fullv: POOL.fullv[id] || '' });
  async function initStore() {
    if (IS_PC) { try { const r = await fetch('/api/store/state', { cache: 'no-store' }); if (r.ok || r.status === 404) { STORE.kind = 'pc'; return r.ok ? await r.json() : null; } } catch (e) { } return null; }
    if (!(window.claude && window.claude.use)) return null;
    try {
      const [db, user, assets] = await Promise.all([window.claude.use('db'), window.claude.use('user'), window.claude.use('assets')]);
      if (!db || !user || !assets) return null;
      const uid = await user.id(); if (!uid) return null;
      Object.assign(STORE, { kind: 'cloud', db, assets, uid });
      const base = 'data/users/' + uid;
      const meta = await db.doc(base + '/meta').get();
      if (!meta.exists) return null;
      const snap = await db.doc(base + '/sammlung').collection('karten').limit(1000).get();
      // Daten aus der Datenbank sind schreibgeschützt (eingefroren) – als normale, änderbare Kopie übernehmen
      const plain = v => v == null ? v : JSON.parse(JSON.stringify(v));
      const cards = {}; for (const d of snap.docs) { const x = plain(d.data()); if (x && x.id && x.card) cards[x.id] = x; }
      return { meta: plain(meta.data()), cards };
    } catch (e) { STORE.kind = 'local'; return null; }
  }
  function applyRemote(st) {
    for (const id of Object.keys(POOL.cards)) { setImgSilent(id); }
    POOL.cards = {}; POOL.raw = {}; POOL.src = {}; POOL.art = {}; POOL.full = {}; POOL.fullv = {}; POOL.remote = {}; STORE.trash = [];
    for (const k of Object.keys(urls)) urls[k] = {};
    for (const [id, x] of Object.entries(st.cards || {})) { POOL.cards[id] = x.card; if (x.raw) POOL.raw[id] = x.raw; POOL.remote[id] = Object.assign({}, x.remote || {}); if (x.fullv) POOL.fullv[id] = x.fullv; STORE.sig[id] = JSON.stringify(cardRec(id)); }
    const m = st.meta || {};
    POOL.decks = Array.isArray(m.decks) ? m.decks : []; POOL.source = m.source || ''; POOL.layout = m.layout || null; POOL.own = !!m.own;
    if (m.deckA) SET.deckA = m.deckA; if (m.deckB) SET.deckB = m.deckB;
    if (m.seen && typeof m.seen === 'object') { Object.assign(SEEN, m.seen); LS.set('wok-spiel-inbox', SEEN); }
    linkRemote();
    if (!ownIds().length && !POOL.own) loadDemo();
    STORE.metaSig = JSON.stringify(Object.assign(metaDoc(), { saved: 0 }));
  }
  function setImgSilent(id) { for (const k of ['art', 'full', 'src']) if (urls[k][id] && urls[k][id].startsWith('blob:')) URL.revokeObjectURL(urls[k][id]); }
  function schedulePersist() { if (STORE.kind === 'local') return; clearTimeout(STORE.timer); STORE.timer = setTimeout(persist, 900); }
  async function putImg(id, kind, blob) {
    const ext = blob.type === 'image/webp' ? '.webp' : blob.type === 'image/jpeg' ? '.jpg' : '.png';
    if (STORE.kind === 'pc') { const name = safeSeg(id).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120) + '_' + kind + '_' + Date.now().toString(36) + ext; const r = await fetch('/api/store/img?name=' + encodeURIComponent(name), { method: 'POST', body: blob }); if (!r.ok) throw new Error('PC-Speicher ' + r.status); return name; }
    const type = ['image/webp', 'image/jpeg', 'image/png', 'image/gif'].includes(blob.type) ? blob.type : 'image/png';
    const res = await STORE.assets.upload(blob, { type }); return res.id;
  }
  async function dropImg(ref) { try { if (STORE.kind === 'pc') await fetch('/api/store/imgdel?name=' + encodeURIComponent(ref), { method: 'POST' }); else if (STORE.kind === 'cloud') await STORE.assets.delete(ref); } catch (e) { /* bleibt liegen */ } }
  async function persist() {
    if (STORE.kind === 'local') return;
    if (STORE.busy) { STORE.again = true; return; }
    STORE.busy = true; STORE.state = 'saving'; showStore();
    try {
      const ids = ownIds();
      for (const id of ids) {
        const rem = POOL.remote[id] || (POOL.remote[id] = {});
        for (const k of ['full', 'art', 'src']) if (POOL[k][id] && !rem[k]) rem[k] = await putImg(id, k, POOL[k][id]);
      }
      if (STORE.kind === 'pc') {
        const cards = {}; for (const id of ids) cards[id] = cardRec(id);
        const r = await fetch('/api/store/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'wok-probespiel-sammlung', meta: metaDoc(), cards }) });
        if (!r.ok) throw new Error('PC-Speicher ' + r.status);
        for (const id of ids) STORE.sig[id] = JSON.stringify(cardRec(id));
      } else {
        const base = 'data/users/' + STORE.uid, col = STORE.db.doc(base + '/sammlung').collection('karten');
        for (const id of ids) { const sig = JSON.stringify(cardRec(id)); if (STORE.sig[id] === sig) continue; await col.doc(safeSeg(id)).set(cardRec(id)); STORE.sig[id] = sig; }
        for (const id of Object.keys(STORE.sig)) if (!POOL.cards[id] || isDemo(id)) { const rem = JSON.parse(STORE.sig[id]).remote || {}; await col.doc(safeSeg(id)).delete(); for (const k of Object.keys(rem)) await dropImg(rem[k]); delete STORE.sig[id]; }
        const md = metaDoc(), ms = JSON.stringify(Object.assign({}, md, { saved: 0 }));
        if (ms !== STORE.metaSig) { await STORE.db.doc(base + '/meta').set(md); STORE.metaSig = ms; }
      }
      if (STORE.kind === 'pc') for (const id of Object.keys(STORE.sig)) if (!POOL.cards[id]) { const rem = JSON.parse(STORE.sig[id]).remote || {}; for (const k of Object.keys(rem)) await dropImg(rem[k]); delete STORE.sig[id]; }
      const trash = STORE.trash.splice(0); for (const ref of trash) await dropImg(ref);
      STORE.state = 'ok'; STORE.err = '';
      await DB.set('pool', { cards: Object.values(POOL.cards), raw: POOL.raw, src: POOL.src, decks: POOL.decks, source: POOL.source, art: POOL.art, full: POOL.full, fullv: POOL.fullv, remote: POOL.remote, layout: POOL.layout, own: POOL.own, store: STORE.kind });
    } catch (e) {
      STORE.state = 'error'; STORE.err = (e && (e.code || e.message)) || 'Fehler';
      toast('Speichern fehlgeschlagen (' + STORE.err + '). Die Karten bleiben in diesem Browser und werden beim nächsten Mal erneut gespeichert.', 8000);
    } finally { STORE.busy = false; showStore(); if (STORE.again) { STORE.again = false; schedulePersist(); } }
  }
  function storeText() {
    const where = STORE.kind === 'pc' ? 'dauerhaft auf diesem PC (Dokumente\\War of Kings Probe-Spiel)' : STORE.kind === 'cloud' ? 'dauerhaft in deinem Claude-Konto, auf jedem Gerät verfügbar' : 'nur in diesem Browser';
    return (STORE.state === 'saving' ? '⏳ Wird gespeichert … ' : STORE.state === 'error' ? '⚠ Letztes Speichern fehlgeschlagen. ' : '✓ ') + 'Karten und Decks liegen ' + where + '.';
  }
  function showStore() { for (const el of $$('.storeinfo')) el.textContent = storeText(); }
  const isDemo = id => String(id).startsWith('demo_');
  function migrateDecks(d) {
    if (Array.isArray(d)) return d;
    const out = []; if (d && typeof d === 'object') for (const k of ['A', 'B']) if (d[k] && d[k].length) out.push({ id: 'deck_' + k.toLowerCase() + '_' + Date.now().toString(36), name: 'Deck ' + k, cards: d[k].slice(), origin: d[k].every(isDemo) ? 'demo' : 'eigen' });
    return out;
  }
  async function loadPool() {
    const p = await DB.get('pool');
    if (p && (p.own || (p.cards && p.cards.length))) {
      for (const c of p.cards || []) POOL.cards[c.id] = c;
      POOL.decks = migrateDecks(p.decks); POOL.source = p.source || ''; POOL.raw = p.raw || {}; POOL.src = p.src || {}; POOL.fullv = p.fullv || {}; POOL.remote = p.remote || {}; POOL.layout = p.layout || null; POOL.own = !!p.own || Object.keys(POOL.cards).some(id => !isDemo(id));
      for (const [id, b] of Object.entries(p.art || {})) setImgKeep('art', id, b);
      for (const [id, b] of Object.entries(p.full || {})) setImgKeep('full', id, b);
      for (const [id, b] of Object.entries(p.src || {})) if (b) setImgKeep('src', id, b);
      STORE.kind = p.store || 'local'; linkRemote(); STORE.kind = 'local';
      if (!Object.keys(POOL.raw).length && Object.keys(POOL.cards).some(isDemo)) for (const c of DEMO.cards) POOL.raw[c.id] = c;
    } else loadDemo();
    fixDeckChoice();
  }
  function setImgKeep(kind, id, blob) { if (!blob) return; POOL[kind][id] = blob; urls[kind][id] = URL.createObjectURL(blob); }
  // Nach dem schnellen Start aus dem Browser-Speicher: dauerhaften Speicher anbinden
  async function connectStore() {
    const st = await initStore();
    if (STORE.kind === 'local') { showStore(); return; }
    if (st && ((st.cards && Object.keys(st.cards).length) || (st.meta && (st.meta.own || (st.meta.decks || []).length)))) {
      applyRemote(st); fixDeckChoice(); await DB.set('pool', { cards: Object.values(POOL.cards), raw: POOL.raw, src: POOL.src, decks: POOL.decks, source: POOL.source, art: POOL.art, full: POOL.full, fullv: POOL.fullv, remote: POOL.remote, layout: POOL.layout, own: POOL.own, store: STORE.kind });
      renderHome(); refreshViews(); drawQueue();
    } else {
      // Erster Start mit dauerhaftem Speicher: was hier im Browser liegt, übernehmen
      for (const id of Object.keys(POOL.remote)) POOL.remote[id] = {};
      STORE.sig = {}; STORE.metaSig = '';
      if (ownIds().length || POOL.own) persist();
    }
    showStore();
  }
  // Gelöschte Demo- und Beispiel-Decks merken, damit sie nicht wiederkommen
  const HIDDEN = () => LS.get('wok-spiel-hidden-decks') || [];
  function hideDeck(d) { if (d.origin === 'demo' || d.origin === 'paket') { const h = HIDDEN(); h.push(d.origin === 'demo' ? d.id : 'paket:' + d.name); LS.set('wok-spiel-hidden-decks', [...new Set(h)]); } }
  function loadDemo() {
    for (const c of DEMO.cards) { const n = W.normalizeCard(c); POOL.cards[n.id] = n; POOL.raw[n.id] = c; }
    const hid = HIDDEN();
    POOL.decks = POOL.decks.filter(d => d.origin !== 'demo').concat([{ id: 'demo_deck_a', name: 'Demo A (Platzhalter)', cards: DEMO.decks.A.slice(), origin: 'demo' }, { id: 'demo_deck_b', name: 'Demo B (Platzhalter)', cards: DEMO.decks.B.slice(), origin: 'demo' }].filter(d => !hid.includes(d.id)));
    POOL.source = 'Demo-Karten zum Ausprobieren. Sie verschwinden, sobald du eigene Karten lädst.';
  }
  // Sobald eigene Karten da sind: alle Platzhalter-Karten und -Decks entfernen
  function purgeDemo() {
    let n = 0; for (const id of Object.keys(POOL.cards)) if (isDemo(id)) { delete POOL.cards[id]; delete POOL.raw[id]; delete POOL.fullv[id]; setImg('art', id); setImg('full', id); setImg('src', id); delete POOL.remote[id]; n++; }
    POOL.decks = POOL.decks.filter(d => d.origin !== 'demo').map(d => Object.assign(d, { cards: d.cards.filter(id => !isDemo(id)) }));
    return n;
  }
  const deckById = id => POOL.decks.find(d => d.id === id);
  const deckOk = d => !!d && W.validateDeck(d.cards, POOL.cards).ok;
  function fixDeckChoice() {
    const valid = POOL.decks.filter(deckOk);
    if (!deckOk(deckById(SET.deckA))) SET.deckA = (valid[0] || {}).id || '';
    if (!deckOk(deckById(SET.deckB))) SET.deckB = (valid.find(d => d.id !== SET.deckA) || valid[0] || {}).id || '';
    LS.set('wok-spiel-setup', SET);
  }
  function newDeckId() { return 'deck_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  // Spielwerte eines alten Engine-Pakets ins Werkstatt-Format zurückführen (für Deck-Dateien)
  function toRaw(c) {
    return { id: c.id, name: c.name, type: c.type, rarity: c.rarity, energy: c.energy, atk: c.atk, def: c.def, hp: c.hp, race: c.races[0] || null, race2: c.races[1] || null, classes: [c.classes[0] || null, c.classes[1] || null], element: c.elements[0] || null, element2: c.elements[1] || null,
      attack: { dirs: Object.assign({}, c.attack.dirs), showNumber: false, number: 1 }, move: { dirs: Object.fromEntries(c.move.dirs.map(d => [d, Math.min(2, c.move.steps || 1)])), showNumber: true, number: c.move.steps }, gifts: c.gifts.map(g => Object.assign({}, g)) };
  }

  /* Volles Werkstatt-Design zeichnen, im Hintergrund nacheinander */
  let drawing = false, drawAgain = false;
  async function drawQueue() {
    if (!window.WOK_CARDART) return;
    if (drawing) { drawAgain = true; return; } // läuft schon: danach noch einmal (neu geladene Karten)
    drawing = true;
    try {
      await CARDART.init(POOL.layout);
      const todo = Object.keys(POOL.raw).filter(id => POOL.cards[id] && POOL.fullv[id] !== 'paket' && POOL.fullv[id] !== CARDART.VERSION);
      let n = 0;
      for (const id of todo) {
        try {
          if (!POOL.cards[id] || !POOL.raw[id]) continue; // inzwischen entfernt (z. B. Demo-Karten)
          const r = await CARDART.render(POOL.raw[id], POOL.src[id] || urls.src[id] || null);
          if (!POOL.cards[id] || !POOL.raw[id]) continue; // inzwischen entfernt
          setImg('full', id, r.full); if (r.art) setImg('art', id, r.art); POOL.fullv[id] = CARDART.VERSION;
        } catch (e) { POOL.fullv[id] = 'fehler'; try { console.warn('Kartenbild „' + id + '“ nicht gezeichnet:', e && (e.message || e)); } catch (x) { } }
        n++;
        if (todo.length > 3 && (n % 4 === 0 || n === todo.length)) toast('Kartenbilder im Werkstatt-Design: ' + n + ' von ' + todo.length + ' gezeichnet.', 2500);
        if (n % 6 === 0) { refreshViews(); await savePool(); }
      }
      if (todo.length) { await savePool(); refreshViews(); }
    } finally { drawing = false; if (drawAgain) { drawAgain = false; setTimeout(drawQueue, 0); } }
  }
  function refreshViews() { if (!$('#v-decks').hidden) renderDecks(); if (G && !$('#v-game').hidden) { for (const el of tokEls.values()) el._h = ''; render([]); } }

  /* ---------------- Import: Kartenpaket (ZIP) und Sicherung (JSON) ---------------- */
  async function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf), files = new Map();
    let eocd = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Das ist keine gültige ZIP-Datei.');
    const n = dv.getUint16(eocd + 10, true); let off = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true), loc = dv.getUint32(off + 42, true);
      const name = dec.decode(u8.subarray(off + 46, off + 46 + nlen));
      off += 46 + nlen + xlen + clen;
      const ln = dv.getUint16(loc + 26, true), lx = dv.getUint16(loc + 28, true), start = loc + 30 + ln + lx;
      files.set(name, { method, data: u8.subarray(start, start + csize) });
    }
    return {
      names: [...files.keys()],
      async get(name) {
        const f = files.get(name); if (!f) return null;
        if (f.method === 0) return f.data;
        if (f.method === 8 && typeof DecompressionStream !== 'undefined') { const s = new Blob([f.data]).stream().pipeThrough(new DecompressionStream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); }
        throw new Error('Komprimierung wird nicht unterstützt: ' + name);
      }
    };
  }
  // Spielpaket aus der Werkstatt (oder Deck-Datei aus dem Spiel) übernehmen
  async function importSpielpaket(z, notes, cnt) {
    const doc = JSON.parse(new TextDecoder().decode(await z.get('spielpaket.json')));
    if (doc.format !== 'wok-spielpaket') throw new Error('unbekanntes Format');
    if (doc.version > 1) notes.push('Das Paket ist neuer als dieses Spiel (Version ' + doc.version + '). Bitte das Probe-Spiel aktualisieren.');
    const mime = p => /\.webp$/i.test(p) ? 'image/webp' : /\.jpe?g$/i.test(p) ? 'image/jpeg' : 'image/png';
    for (const raw of doc.cards || []) {
      const c = W.normalizeCard(raw); if (POOL.cards[c.id]) cnt.replaced++; else cnt.added++; POOL.cards[c.id] = c;
      const r0 = JSON.parse(JSON.stringify(raw)); delete r0.image; delete r0.token; delete r0.validation; delete r0.power; delete r0.giftDetails; POOL.raw[c.id] = r0; setImg('src', c.id);
      setImg('full', c.id); setImg('art', c.id); POOL.fullv[c.id] = 'paket';
      if (raw.image) { const b = await z.get(raw.image); if (b) setImg('full', c.id, new Blob([b], { type: mime(raw.image) })); }
      if (raw.token) { const b = await z.get(raw.token); if (b) setImg('art', c.id, new Blob([b], { type: mime(raw.token) })); }
      if (!raw.image) delete POOL.fullv[c.id]; // ohne fertiges Bild: im Spiel nachzeichnen
    }
    if (doc.kind !== 'sicherung') { const en = ECON.applyImport(doc); if (en) notes.unshift(en); }
    if (doc.kind === 'sicherung') {
      if (doc.layout && typeof doc.layout === 'object') POOL.layout = doc.layout;
      for (const d of doc.decks || []) { if (!Array.isArray(d.cards)) continue; const old = POOL.decks.find(x => x.id === d.id); const nd = { id: d.id || newDeckId(), name: String(d.name || 'Deck').slice(0, 40), cards: d.cards.slice(), origin: d.origin === 'paket' ? 'paket' : 'eigen', look: d.look, saved: d.saved || Date.now() }; if (old) Object.assign(old, nd); else POOL.decks.push(nd); cnt.decks++; }
      if (doc.deckA && POOL.decks.some(x => x.id === doc.deckA)) SET.deckA = doc.deckA; if (doc.deckB && POOL.decks.some(x => x.id === doc.deckB)) SET.deckB = doc.deckB; LS.set('wok-spiel-setup', SET);
      return;
    }
    for (const d of doc.decks || []) {
      if (!Array.isArray(d.cards)) continue;
      const name = String(d.name || 'Beispiel-Deck').slice(0, 40);
      const old = POOL.decks.find(x => x.origin === 'paket' && x.name === name);
      if (HIDDEN().includes('paket:' + name)) continue; // vom Spieler gelöscht
      if (old) old.cards = d.cards.slice(); else POOL.decks.push({ id: newDeckId(), name, cards: d.cards.slice(), origin: 'paket' });
      cnt.decks++;
    }
  }
  async function importFiles(fileList, quiet) {
    const cnt = { added: 0, replaced: 0, decks: 0 }, notes = [];
    for (const file of fileList) {
      try {
        const isZip = /\.(zip|wokspiel)$/i.test(file.name) || /zip/.test(file.type);
        if (isZip) {
          const z = await unzip(await file.arrayBuffer());
          if (z.names.includes('spielpaket.json')) { await importSpielpaket(z, notes, cnt); continue; }
          const allName = z.names.find(n => /cards\/_alle_karten\.json$/.test(n));
          if (!allName) { notes.push(file.name + ': weder Spielpaket noch Kartenpaket. In der Werkstatt „Fürs Probe-Spiel exportieren“ wählen.'); continue; }
          const root = allName.replace(/cards\/_alle_karten\.json$/, '');
          const data = JSON.parse(new TextDecoder().decode(await z.get(allName)));
          for (const raw of data.cards || []) {
            const c = W.normalizeCard(raw); if (POOL.cards[c.id]) cnt.replaced++; else cnt.added++; POOL.cards[c.id] = c;
            const v = raw.visual || {};
            POOL.raw[c.id] = toRaw(c); setImg('src', c.id); POOL.fullv[c.id] = 'paket';
            for (const [kind, p] of [['full', v.preview], ['art', v.art]]) { if (!p) continue; const b = await z.get(root + p); if (b) setImg(kind, c.id, new Blob([b], { type: 'image/png' })); }
            if (!v.preview) { delete POOL.fullv[c.id]; notes.push('„' + c.name + '“: im Paket fehlt das fertige Kartenbild.'); }
          }
        } else {
          const data = JSON.parse(await file.text());
          const list = Array.isArray(data) ? data : data.cards;
          if (!Array.isArray(list)) { notes.push(file.name + ': keine Karten gefunden.'); continue; }
          for (const raw of list) {
            const c = W.normalizeCard(raw); if (POOL.cards[c.id]) cnt.replaced++; else cnt.added++; POOL.cards[c.id] = c;
            const r0 = JSON.parse(JSON.stringify(raw)); if (r0.art) delete r0.art.data; delete r0.giftDetails; POOL.raw[c.id] = r0; delete POOL.fullv[c.id];
            setImg('art', c.id); setImg('full', c.id);
            setImg('src', c.id); if (raw.art && raw.art.data) { try { setImg('src', c.id, await (await fetch(raw.art.data)).blob()); } catch (e) { /* Bild unlesbar */ } }
          }
          if (data.layout && typeof data.layout === 'object') { POOL.layout = data.layout; POOL.fullv = Object.fromEntries(Object.entries(POOL.fullv).filter(([, v]) => v === 'paket')); }
        }
      } catch (e) { notes.push(file.name + ': ' + e.message); }
    }
    let purged = 0;
    if (cnt.added + cnt.replaced) { purged = purgeDemo(); POOL.own = true; POOL.source = 'Deine Karten aus der Kartenwerkstatt'; }
    fixDeckChoice();
    await savePool();
    toast(cnt.added + ' Karten neu, ' + cnt.replaced + ' ersetzt' + (cnt.decks ? ', ' + cnt.decks + ' Deck' + (cnt.decks > 1 ? 's' : '') + ' übernommen' : '') + '.' + (purged ? ' Die Demo-Karten wurden entfernt.' : '') + (notes.length ? ' ' + notes.slice(0, 3).join(' ') : ''), 9000);
    renderDecks(); renderHome(); drawQueue();
  }

  /* ---------------- Dateien speichern (Deck als Datei) ---------------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = t[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
  function makeZip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let off = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), d = f.data, crc = CRC(d);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(h.buffer), nm, d);
      const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + d.length;
    }
    const csz = central.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  const IS_PC = location.protocol === 'http:' && /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && +location.port >= 47851 && +location.port <= 47860;
  async function saveBlob(name, blob) {
    if (IS_PC) { try { const r = await fetch('/api/save?name=' + encodeURIComponent(name), { method: 'POST', body: blob }); if (r.ok) { const j = await r.json(); seenInbox(j.name, j.mtime); toast('Gespeichert in Dokumente\\War of Kings Spielpakete\\' + j.name, 7000); return true; } } catch (e) { /* weiter */ } }
    if (!IS_PC) name = name.replace(/\.wokspiel$/i, '.zip'); // Cloud-Downloads erlauben nur bekannte Endungen
    try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: name, data: blob }); return true; } }
    catch (e) { if (e && e.code === 'declined') return false; toast('Speichern fehlgeschlagen (' + ((e && e.code) || 'Fehler') + ').', 7000); return false; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); return true;
  }
  async function exportDeck(d) {
    const ids = [...new Set(d.cards)].filter(id => POOL.cards[id]);
    if (!ids.length) { toast('Das Deck ist leer.'); return; }
    const enc = new TextEncoder(), files = [], cards = [];
    const ext = b => b.type === 'image/webp' ? '.webp' : b.type === 'image/jpeg' ? '.jpg' : '.png';
    for (const id of ids) {
      const raw = Object.assign({}, POOL.raw[id] || toRaw(POOL.cards[id]), { id }); const safe = id.replace(/[^\w-]/g, '_');
      const fb = await getBlob('full', id), ab = await getBlob('art', id);
      if (fb) { raw.image = 'karten/' + safe + ext(fb); files.push({ name: raw.image, data: new Uint8Array(await fb.arrayBuffer()) }); }
      if (ab) { raw.token = 'figuren/' + safe + ext(ab); files.push({ name: raw.token, data: new Uint8Array(await ab.arrayBuffer()) }); }
      cards.push(raw);
    }
    const doc = { format: 'wok-spielpaket', version: 1, created: new Date().toISOString(), source: 'War of Kings Probe-Spiel ' + VERSION, cards, decks: [{ name: d.name, cards: d.cards.slice() }] };
    files.unshift({ name: 'spielpaket.json', data: enc.encode(JSON.stringify(doc, null, 1)) });
    const name = 'WoK_Deck_' + d.name.replace(/[^\wÄÖÜäöüß-]+/g, '_').replace(/^_+|_+$/g, '') + '.wokspiel';
    const ok = await saveBlob(name, makeZip(files));
    if (ok && !IS_PC) toast('Deck „' + d.name + '“ als Datei gespeichert. Diese Datei kann jeder im Probe-Spiel als Beispiel-Deck laden.', 7000);
  }

  // Alles mitnehmen: alle eigenen Karten mit fertigen Bildern, alle eigenen Decks, Kartenvorlage – als eine Datei.
  // Einlesen in jeder Fassung (Cloud, PC, Browser-Datei) über „Spielpaket laden“.
  async function exportAll() {
    const ids = ownIds().filter(id => POOL.cards[id]);
    if (!ids.length) { toast('Noch keine eigenen Karten – zuerst ein Spielpaket aus der Werkstatt laden.'); return; }
    toast('Packe ' + ids.length + ' Karten und ' + POOL.decks.filter(d => d.origin !== 'demo').length + ' Decks …', 4000);
    const enc = new TextEncoder(), files = [], cards = [];
    const ext = b => b.type === 'image/webp' ? '.webp' : b.type === 'image/jpeg' ? '.jpg' : '.png';
    for (const id of ids) {
      const raw = Object.assign({}, POOL.raw[id] || toRaw(POOL.cards[id]), { id }); const safe = id.replace(/[^\w-]/g, '_');
      const fb = await getBlob('full', id), ab = await getBlob('art', id);
      if (fb) { raw.image = 'karten/' + safe + ext(fb); files.push({ name: raw.image, data: new Uint8Array(await fb.arrayBuffer()) }); }
      if (ab) { raw.token = 'figuren/' + safe + ext(ab); files.push({ name: raw.token, data: new Uint8Array(await ab.arrayBuffer()) }); }
      cards.push(raw);
    }
    const decks = POOL.decks.filter(d => d.origin !== 'demo').map(d => ({ id: d.id, name: d.name, cards: d.cards.slice(), origin: d.origin, look: d.look, saved: d.saved }));
    const doc = { format: 'wok-spielpaket', version: 1, kind: 'sicherung', created: new Date().toISOString(), source: 'War of Kings Probe-Spiel ' + VERSION, layout: POOL.layout || null, cards, decks, deckA: SET.deckA, deckB: SET.deckB };
    files.unshift({ name: 'spielpaket.json', data: enc.encode(JSON.stringify(doc)) });
    const nw = new Date(), z = n => String(n).padStart(2, '0');
    const ok = await saveBlob('WoK_Alles_' + nw.getFullYear() + '-' + z(nw.getMonth() + 1) + '-' + z(nw.getDate()) + '.wokspiel', makeZip(files));
    if (ok) toast('Fertig: ' + ids.length + ' Karten und ' + decks.length + ' Decks in einer Datei. In der anderen Fassung „Spielpaket laden“ und diese Datei wählen.', 9000);
  }

  /* ---------------- PC: Spielpakete aus der Werkstatt automatisch abholen ---------------- */
  const SEEN = Object.assign({}, LS.get('wok-spiel-inbox') || {});
  function seenInbox(name, mtime) { SEEN[name] = mtime || Date.now(); LS.set('wok-spiel-inbox', SEEN); schedulePersist(); }
  async function inboxList() { const r = await fetch('/api/inbox'); return r.ok ? r.json() : []; }
  async function inboxLoad(it) { const r = await fetch('/api/inbox/file?name=' + encodeURIComponent(it.name)); if (!r.ok) { toast('Datei konnte nicht gelesen werden.'); return; } seenInbox(it.name, it.mtime); await importFiles([new File([await r.blob()], it.name)]); }
  let inboxBusy = false;
  async function inboxPoll() {
    if (!IS_PC || inboxBusy || !$('#ov').hidden || (G && !$('#v-game').hidden)) return;
    inboxBusy = true;
    try {
      const fresh = (await inboxList()).filter(it => SEEN[it.name] !== it.mtime).sort((a, b) => b.mtime - a.mtime);
      if (fresh.length) {
        const it = fresh[0];
        dialog('<span class="eyebrow">Aus der Kartenwerkstatt</span><h2>Neues Spielpaket</h2><p><b>' + esc(it.name) + '</b> (' + (it.size / 1048576).toFixed(1).replace('.', ',') + ' MB) liegt in „Dokumente\\War of Kings Spielpakete“.</p><div class="row"><button class="btn primary" data-act="load">Jetzt laden</button><button class="btn" data-act="later">Nicht laden</button></div>',
          act => { if (act === 'load') inboxLoad(it); else seenInbox(it.name, it.mtime); });
      }
    } catch (e) { /* kein PC-Server */ } finally { inboxBusy = false; }
  }
  async function inboxDialog() {
    let list = []; try { list = await inboxList(); } catch (e) { }
    if (!list.length) { toast('Im Ordner „Dokumente\\War of Kings Spielpakete“ liegt noch kein Spielpaket. In der Werkstatt „Fürs Probe-Spiel exportieren“ wählen.', 8000); return; }
    list.sort((a, b) => b.mtime - a.mtime);
    dialog('<span class="eyebrow">Dokumente\\War of Kings Spielpakete</span><h2>Spielpaket laden</h2><div class="advice">' + list.map((it, i) => '<button data-act="i:' + i + '">' + esc(it.name) + ' · ' + new Date(it.mtime).toLocaleString('de-DE') + '</button>').join('') + '</div><button class="btn" data-act="close">Schließen</button>', act => { if (act.startsWith('i:')) inboxLoad(list[+act.slice(2)]); }, { dismiss: true });
  }

  /* ---------------- Ansichten ---------------- */
  function show(v) { for (const s of $$('main > section')) s.hidden = s.id !== 'v-' + v; window.scrollTo(0, 0); document.body.classList.toggle('full', v === 'home' || v === 'bazar'); if (v !== 'bazar') BAZAR.leave(); if (v !== 'home') closeSetup(); if (v === 'decks') renderDecks(); if (v === 'rules') renderRules(); if (v === 'home') renderHome(); if (v === 'bazar') BAZAR.enter(); if (v === 'tutorial') TUT.renderList(); if (v !== 'game') { const rb = $('#rpbar'); if (rb) rb.hidden = true; } }
  let toastT = 0;
  function toast(t, ms) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms || 3200); }
  let DLGN = 0;
  function dialog(html, onClick, opts) {
    const ov = $('#ov'), d = $('#dlg'), tok = String(++DLGN); d.innerHTML = html; d.dataset.tok = tok; ov.hidden = false; d.className = 'dialog' + (opts && opts.cls ? ' ' + opts.cls : '');
    d.onclick = e => { const b = e.target.closest('[data-act]'); if (!b) return; let r = null; try { r = onClick ? onClick(b.dataset.act, b) : null; } catch (x) { toast('Fehler: ' + (x && x.message || x), 8000); } if (r !== false && d.dataset.tok === tok) closeDialog(); };
    ov.onclick = e => { if (e.target === ov && opts && opts.dismiss) closeDialog(); };
    const f = d.querySelector('[data-act]'); if (f) f.focus();
  }
  function closeDialog() { $('#ov').hidden = true; $('#dlg').innerHTML = ''; }

  /* ---------------- Startseite ---------------- */
  function deckSummary(d) {
    if (!d) return { name: '–', king: '', ok: false, msg: 'kein Deck gewählt' };
    const v = W.validateDeck(d.cards, POOL.cards), king = d.cards.map(id => POOL.cards[id]).find(c => c && c.type === 'king');
    const miss = ECON.missing(d), mn = miss.reduce((a, x) => a + x.need - x.have, 0);
    return { name: d.name, king: king ? king.name : 'ohne König', ok: v.ok, miss: mn, msg: v.ok ? (mn ? '⚠ ' + mn + ' Karte' + (mn > 1 ? 'n' : '') + ' nicht in deiner Sammlung' : '✓ 40 Karten, spielbereit') : v.errors[0] };
  }
  function renderHome() {
    $$('#modes .mode').forEach(b => b.classList.toggle('on', b.dataset.mode === SET.mode));
    $$('#ai-level button').forEach(b => b.classList.toggle('on', b.dataset.lv === SET.level));
    $('#ai-row').hidden = SET.mode !== 'ai'; $('#name2-wrap').hidden = SET.mode !== 'hot';
    $('#name1').value = SET.name1; $('#name2').value = SET.name2; $('#timer').checked = SET.timer; $('#help').checked = SET.help !== false; $('#rsides').checked = !!SET.randomSides; $('#creserve').checked = !!SET.counterReserve;
    const valid = POOL.decks.filter(deckOk);
    const sel = (key, label) => { const cur = deckById(SET[key]), sm = deckSummary(cur);
      return '<div><span class="eyebrow">' + label + '</span>' + (valid.length ? '<select class="search" data-deckpick="' + key + '" aria-label="' + label + '">' + valid.map(d => '<option value="' + esc(d.id) + '"' + (d.id === SET[key] ? ' selected' : '') + '>' + esc(d.name) + (d.origin === 'paket' ? ' (Beispiel)' : d.origin === 'demo' ? ' (Demo)' : '') + '</option>').join('') + '</select>' : '<b>noch kein spielbereites Deck</b>')
        + '<span class="' + (sm.ok ? 'ok' : 'bad') + '">' + esc(sm.ok ? '♛ ' + sm.king + ' · ' + sm.msg : sm.msg) + '</span></div>'; };
    const la = SET.randomSides ? 'Deck A' : SET.mode === 'ai' ? 'Dein Deck' : 'Deck von ' + SET.name1, lb = SET.randomSides ? 'Deck B' : SET.mode === 'ai' ? 'Deck der KI' : 'Deck von ' + SET.name2;
    $('#decksum').innerHTML = sel('deckA', la) + sel('deckB', lb) + '<div><span class="eyebrow">Karten</span><span class="muted">' + esc(POOL.source || 'Noch keine Karten. Unter „Karten & Decks“ ein Spielpaket laden.') + '</span></div>';
    $('#start').disabled = !(deckOk(deckById(SET.deckA)) && deckOk(deckById(SET.deckB)));
    $('#resume').hidden = !LS.get('wok-spiel-save');
    const mine = deckById(SET.deckA), msm = deckSummary(mine);
    $('#hdeck').innerHTML = mine ? '<span>' + (msm.ok ? '♛ ' : '⚠ ') + esc(mine.name) + ' · ' + esc(msm.ok ? msm.king : msm.msg) + '</span><button data-hedit="1">✎ Deck bearbeiten</button>' : '<span>Noch kein Deck</span><button data-go="decks">Kriegsdecks öffnen</button>';
    $('#editdeck').disabled = !mine;
    $('#avrow').innerHTML = [['p1', SET.name1], SET.mode === 'ai' ? ['ai', 'KI-Gegner'] : ['p2', SET.name2]].map(([k, n]) => '<button class="avbtn" data-av="' + k + '">' + avHTML(PROF.src(k)) + '<span><b>' + esc(n) + '</b><small>Profilbild ändern</small></span></button>').join('<span class="avvs">VS</span>'); $('#hs-title').textContent = SET.mode === 'ai' ? 'Gegen die KI' : 'Zwei Spieler an einem Gerät';
    $$('#decksum [data-deckpick]').forEach(el => { const b = document.createElement('button'); b.className = 'btn small'; b.dataset.edeck = el.dataset.deckpick; b.textContent = '✎ Bearbeiten'; el.after(b); });
    showStore();
  }
  /* ---------------- Hauptmenü ---------------- */
  function openSetup(mode) { if (mode) { SET.mode = mode; saveSetup(); } renderHome(); $('#hsetup').hidden = false; const f = $('#start'); if (f && !f.disabled) f.focus(); }
  function closeSetup() { const el = $('#hsetup'); if (el) el.hidden = true; }
  function editFromHome(key) { const id = SET[key || 'deckA']; if (!deckById(id)) return; show('decks'); openEditor(id); ED.ret = 'home'; }
  function quickPlay() {
    if (deckOk(deckById(SET.deckA)) && deckOk(deckById(SET.deckB))) { SET.mode = 'ai'; saveSetup(); startGame(); }
    else { openSetup('ai'); toast('Für ein schnelles Spiel brauchen du und die KI je ein spielbereites Deck.', 5000); }
  }
  function onlineDialog() { ONLINE.open(); }

  function settingsDialog() {
    const on = v => v ? 'an' : 'aus';
    dialog('<h2>Einstellungen</h2><div class="row setrow">'
      + ((window.WOK_MUSIC || []).length ? '<button class="btn" data-act="music">Kampfmusik: ' + on(SET.music !== false) + '</button><label class="field" style="flex:1 1 100%">Lautstärke (Musik und Basar)<input type="range" id="vol" min="0" max="1" step="0.05" value="' + (SET.volume === undefined ? 0.55 : SET.volume) + '" aria-label="Lautstärke"></label>' : '')
      + '<button class="btn" data-act="help">Spielhilfe: ' + on(SET.help !== false) + '</button><button class="btn" data-act="timer">Zuguhr (120 s): ' + on(SET.timer) + '</button>'
      + '<button class="btn" data-act="big">Karte groß zeigen: ' + (bigOn() ? 'schon beim Antippen' : 'Doppelklick oder gedrückt halten') + '</button>'
      + '<button class="btn" data-act="anim">Auftritts-Animationen &amp; Einblendungen: ' + on(ANIM()) + '</button><button class="btn" data-act="sfx">Soundeffekte: ' + on(SET.sfx !== false) + '</button><button class="btn" data-act="mate">Begleiter auf dem Spielfeld: ' + on(SET.mate !== false) + '</button>'
      + '<button class="btn" data-act="avatar">👤 Mein Profilbild</button><button class="btn" data-act="walls">🖼 Hintergründe</button><button class="btn" data-act="replays">▶ Wiederholungen</button><button class="btn" data-act="tutorial">📜 Tutorial</button>'
      + '<button class="btn" data-act="econ">Kartenbesitz: ' + (ECON.player() ? 'Spielermodus (Starter + Packs)' : 'Testmodus (alle Karten frei)') + '</button>'
      + '<button class="btn" data-act="rules">Regeln &amp; offene Punkte</button><button class="btn" data-act="decks">Karten &amp; Decks</button><button class="btn primary" data-act="close">Fertig</button></div><p class="muted storeinfo" style="font-size:13px">' + esc(storeText()) + '</p>', act => {
      if (act === 'music') { MUSIC.toggle(); settingsDialog(); return false; }
      if (act === 'help') { SET.help = SET.help === false; LS.set('wok-spiel-setup', SET); settingsDialog(); return false; }
      if (act === 'timer') { SET.timer = !SET.timer; LS.set('wok-spiel-setup', SET); settingsDialog(); return false; }
      if (act === 'big') { SET.bigTap = !bigOn(); LS.set('wok-spiel-setup', SET); settingsDialog(); return false; }
      if (act === 'anim' || act === 'sfx' || act === 'mate') { SET[act] = SET[act] === false; LS.set('wok-spiel-setup', SET); if (act === 'sfx' && SET.sfx !== false) SFX.thump(.6); settingsDialog(); return false; }
      if (act === 'walls') { setTimeout(WALLS.dialog, 0); return; } if (act === 'avatar') { setTimeout(() => PROF.dlg('p1', () => renderHome()), 0); return; } if (act === 'replays') { setTimeout(replaysDialog, 0); return; } if (act === 'tutorial') show('tutorial');
      if (act === 'econ') { ECON.setMode(ECON.player() ? 'test' : 'player'); renderHome(); settingsDialog(); return false; }
      if (act === 'rules') show('rules'); if (act === 'decks') show('decks');
    }, { dismiss: true });
  }
  // Königlicher Basar: Video beim Betreten von vorn, endet im Standbild, dann blenden die Packs ein (nur Vorschau)
  const BAZAR = (() => {
    const M = window.WOK_MENU || {};
    const PACKS = [{ id: 'p7', img: M.pack7, n: 7, eur: '6,99 €', gold: 1000, cls: 'violet' }, { id: 'p12', img: M.pack12, n: 12, eur: '10,99 €', gold: 2000, cls: 'green' }];
    let wired = false;
    const v = () => $('#bz-video');
    function reveal() { const sec = $('#v-bazar'); if (sec) sec.classList.add('done'); }
    function render() {
      $('#bz-packs').innerHTML = PACKS.map((p, k) => '<div class="bz-pack ' + p.cls + '" style="--d:' + (k * 180) + 'ms"><div class="bz-img">' + (p.img ? '<img src="' + p.img + '" alt="Boosterpack mit ' + p.n + ' Karten">' : '') + '<i class="shine"></i></div>'
        + '<b>Boosterpack · ' + p.n + ' Karten</b><button class="bz-open" data-open="' + p.id + '">✦ Öffnen (Vorschau)</button><div class="bz-buy"><button class="bz-price eur" data-buy="' + p.id + ':eur">' + p.eur + '</button><span class="muted">oder</span><button class="bz-price gold" data-buy="' + p.id + ':gold">🪙 ' + fmt(p.gold) + '</button></div></div>').join('');
    }
    function wire() {
      if (wired) return; wired = true; render();
      const el = v(); if (M.video) el.src = M.video; if (M.poster) el.poster = M.poster;
      el.addEventListener('ended', reveal);
      el.addEventListener('error', reveal);
      $('#bz-skip').onclick = () => { const e = v(); try { if (e.duration) e.currentTime = Math.max(0, e.duration - 0.04); e.pause(); } catch (x) {} reveal(); };
      $('#bz-replay').onclick = () => enter();
      $('#v-bazar').addEventListener('click', e => { if (e.target.closest('[data-tgold]')) { ECON.addGold(5000); SFX.chime(true); goldUI(); } if (e.target.closest('[data-odds]')) dialog(ECON.oddsHTML() + '<div class="row"><button class="btn primary" data-act="close">Schließen</button></div>', null, { dismiss: true }); });
      $('#bz-packs').onclick = e => { const o = e.target.closest('[data-open]'); if (o) { openPack(PACKS.find(x => x.id === o.dataset.open)); return; } const b = e.target.closest('[data-buy]'); if (!b) return; const [id, how] = b.dataset.buy.split(':'), p = PACKS.find(x => x.id === id);
        if (how === 'gold') { const r = ECON.buy(p); goldUI(); if (r) openPack(p, r); return; }
        dialog('<h2>Boosterpack · ' + p.n + ' Karten</h2><p>' + (how === 'eur' ? 'Kauf für ' + p.eur + '.' : 'Tausch für ' + fmt(p.gold) + ' Goldmünzen.') + '</p><p class="muted">Das ist eine Vorschau: Echtgeld-Käufe und Goldmünzen kommen in einer späteren Version. Goldmünzen verdienst du dann mit Partien und Events. Es wird nichts berechnet.</p><div class="row"><button class="btn primary" data-act="close">Verstanden</button></div>', null, { dismiss: true }); };
    }
    function goldUI() { const g = $('#bz-gold'); if (g) g.innerHTML = '🪙 <b>' + fmt(ECON.E.gold) + '</b> Goldmünzen <button class="bz-tgold" data-tgold="1" title="Gold zum Testen – echtes Gold verdienst du später mit Partien und Events">+5.000 Test</button>'; const pi = $('#bz-pity'); if (pi) pi.innerHTML = '<button class="bz-odds" data-odds="1">ⓘ Chancen</button>'; }
    function enter() {
      wire(); goldUI(); const sec = $('#v-bazar'), el = v(); sec.classList.remove('done');
      if (!M.video) { reveal(); return; }
      el.muted = false; el.volume = Math.max(0, Math.min(1, SET.volume === undefined ? 0.55 : +SET.volume));
      try { el.currentTime = 0; } catch (x) {}
      const pr = el.play(); if (pr && pr.catch) pr.catch(() => { el.muted = true; el.play().catch(reveal); });
    }
    function leave() { const el = $('#bz-video'); if (el && !el.paused) el.pause(); }
    return { enter, leave, reveal, PACKS, goldUI };
  })();
  function saveSetup() { SET.name1 = $('#name1').value.trim() || 'Spieler 1'; SET.name2 = $('#name2').value.trim() || 'Spieler 2'; SET.timer = $('#timer').checked; SET.help = $('#help').checked; SET.randomSides = $('#rsides').checked; SET.counterReserve = $('#creserve').checked; LS.set('wok-spiel-setup', SET); }

  /* ---------------- Regeln ---------------- */
  function renderRules() {
    const S = (h, items) => '<section><h3>' + h + '</h3><ul>' + items.map(i => '<li>' + i + '</li>').join('') + '</ul></section>';
    $('#rules').innerHTML = [
      S('Ziel', ['Ein König mit 0 oder weniger HP verliert. Fallen beide Könige im selben Angriffspaket: unentschieden.', 'Wer gleichzeitig keine Handkarten und keinen Nachziehstapel hat, verliert sofort.', 'Scheitert der Nachzug am leeren Stapel, verliert der eigene König 1.000 HP. Der Ablagestapel wird nie neu gemischt.']),
      S('Zugablauf', ['Vorbereitung: Karte ziehen, Energie auffüllen (Zug n = n Energie, höchstens 10), Abklingzeiten −1, abgelaufene Wirkungen enden, dann Poison.', '1. Beschwörung → Bewegung → Battlephase → Konterphase des Gegners → gemeinsame Auswertung → Nachbeschwörung.', 'Beschworen wird auf der ganzen Reihe vor dem eigenen König und auf den Feldern links und rechts des Königs.', 'Frisch beschworene Helden laufen, greifen und nutzen aktivierbare Gaben erst im nächsten eigenen Zug (außer Ansturm).']),
      S('Bewegung und Kampf', ['1–3 Schritte in den erlaubten Richtungen der Karte, Richtungswechsel zwischen den Schritten erlaubt. Besetzte und fehlende Felder sind tabu, es wird nicht gesprungen.', 'Richtungen gelten aus Sicht der eigenen Seite. Die Felder neben dem gegnerischen König darf man nicht betreten, dort stehende Verteidiger aber angreifen.', 'Jeder Held greift höchstens einmal pro Battlephase an. Angriffe bleiben bis zum Abschluss der Battlephase änderbar, Gaben sind sofort verbindlich.', 'Alle Angriffe werden gleichzeitig berechnet: ATK > DEF Verteidiger fällt, ATK < DEF Angreifer fällt, gleich: beide fallen. Mehrere Angreifer addieren ATK nicht.', 'Der König bewegt sich nie, greift einmal gerade oder schräg nach vorn an, hat keine DEF und verliert bei Treffern HP. Greift er einen Helden an: ATK ≥ DEF besiegt ihn, sonst passiert nichts.']),
      S('Gaben', GD.gifts.map(g => '<b>' + esc(g.name) + '</b>' + (g.kind === 'ct' ? ' (CT ' + g.ct + ')' : ' (permanent)') + ': ' + esc(g.text)).concat(GD.royal.map(g => '<b>' + esc(g.name) + '</b> (Königsgabe): ' + esc(g.text)))),
      S('Zauber und Flüche (Abschnitt 8)', ['Nur in der eigenen Battlephase oder der eigenen Konterphase, soweit Energie und Kartentext es erlauben. Ausspielen ist sofort verbindlich, die Energie bleibt bezahlt.', 'Alle gespielten Karten werden erst nach der Konterphase gemeinsam ausgewertet, vor den Angriffen. Eine Neutralisierung hebt den betroffenen Zauber auf, beide Karten sind verbraucht.', '„Bis zum Ende des Zuges“ endet am Zugende. „Runden“ zählen dort, wo die Wirkung gebraucht wird (Festlegung 30.10.2026): Schwächungen des Gegners (ATK, Schritte, Bewegung, Gaben), Feldsperren, eigener Schutz und eigene DEF gelten für so viele Züge des Gegners; eigene Stärkungen (ATK, Schritte) und gegnerische DEF-Senkungen bis zum Ende deines n-ten nächsten Zuges. Ohne Frist ist die Wirkung permanent.', 'Wirkungen, die erst im Zug des Gegners zählen, dürfen nicht nur „bis Zugende“ gelten, außer die Karte ist nur in der Konterphase spielbar (die liegt im Zug des Gegners). Schutz kann vor Angriffen, vor gegnerischen Flüchen oder vor beidem schützen.', 'Permanente Einzelziel-Karten bleiben am Monster und gehen mit ihm auf den Ablagestapel ihres Besitzers. Flächeneffekte bleiben bestehen und erfassen auch neu beschworene passende Monster.', 'Könige sind nur Ziel, wenn die Karte es ausdrücklich sagt. Ein Monster zeigt höchstens ein Zauber- (✦) und ein Fluchsymbol (☾); antippen zeigt alle Wirkungen mit Laufzeit.', 'Die strukturierten Effekte aus der Werkstatt sind verbindlich. Karten mit offenen Regeln oder nicht abgeglichenem Text sind als „nicht spielbar“ markiert und lassen sich nicht ausspielen.']),
      S('So setzt das Probe-Spiel offene Stellen um (bitte bestätigen oder ändern)', W.ASSUMPTIONS.map(esc)),
      S('Offene Regelfragen zu Zaubern und Flüchen', W.SPELL_OPEN.map(esc)),
      S('Noch nicht enthalten', ['Online-Partien, Matchmaking, Wiederverbindung und die dritte KI-Stufe.', 'Schütze steht noch nicht im Master-Regelwerk (Werkstatt-Ergänzung).'])
    ].join('');
  }

  /* ---------------- Decks ---------------- */
  // Decks: Übersicht · Sammlung · Bearbeiten (mit Arbeitskopie, erst „Deck speichern“ übernimmt)
  let DPICK = null, FRESH = null; // Mehrfachauswahl zum Löschen; zuletzt gespeichertes Deck
  let dtab = 'decks', ftype = '', eftype = '', ED = null; // ED = { id|null, name, cards: [] }
  function cardSearchText(c) { return [c.name, c.folder || '', RAR(c.rarity), TYPEN(c), c.ruleText || '', c.subtitle || ''].concat(c.races.map(x => nameOf('races', x)), c.classes.map(x => nameOf('classes', x)), c.elements.map(x => nameOf('elements', x)), c.gifts.map(g => giftInfo(g.id).name)).join(' ').toLowerCase(); }
  function thumb(c, cls) { const u = artURL(c.id) || fullURL(c.id); return '<button class="' + cls + '" data-zoom="' + esc(c.id) + '" style="' + (u ? 'background-image:url(' + u + ')' : 'background-color:' + (ELCOL[c.elements[0]] || '#2a3242')) + '" aria-label="Karte ansehen: ' + esc(c.name) + '">' + (u ? '' : esc(initials(c.name))) + '</button>'; }
  const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const sortCards = list => list.sort((a, b) => (a.type === 'king' ? -1 : 0) - (b.type === 'king' ? -1 : 0) || (isSp(a) ? 1 : 0) - (isSp(b) ? 1 : 0) || a.energy - b.energy || a.name.localeCompare(b.name, 'de'));
  function filtered(q, ft) { q = (q || '').toLowerCase().trim(); return sortCards(Object.values(POOL.cards).filter(c => (!q || cardSearchText(c).includes(q)) && (!ft || c.type === ft))); }
  // Kartenkachel mit fertigem Kartenbild (oder Ersatz), optional mit Anzahl im Deck
  let SHOWALL = false;
  function econBox() {
    const E = ECON.E, pl = ECON.player(), sur = ECON.surplus(), sg = sur.reduce((a, x) => a + x.n * (ECON.VALUE[x.c.rarity] || 1), 0), sn = sur.reduce((a, x) => a + x.n, 0);
    const own = Object.values(POOL.cards).filter(c => ECON.owned(c.id)).length;
    return '<div class="econ' + (pl ? ' pl' : '') + '"><div class="ec-mode"><b>' + (pl ? '🛡 Spielermodus' : '🧪 Testmodus') + '</b><span class="muted">' + (pl ? 'Du hast nur dein Starter-Set und was du aus Packs ziehst.' : 'Alle geladenen Karten sind frei – zum Ausprobieren.') + '</span><button class="btn small" data-econ="mode">' + (pl ? 'Zum Testmodus' : 'Zum Spielermodus') + '</button></div>'
      + '<div class="ec-stats"><span>🎁 Starter <b>' + ECON.starterTotal() + '</b> / 50</span><span>📦 In Packs <b>' + ECON.packCards().length + '</b></span><span>🃏 Besitzt <b>' + own + '</b> Karten</span><span>🪙 <b>' + fmt(E.gold) + '</b> Gold</span><span>Packs geöffnet <b>' + E.opened + '</b></span></div>'
      + '<div class="row">' + (pl ? '<button class="btn small" data-econ="all">' + (SHOWALL ? 'Nur meine Karten' : 'Auch fehlende zeigen') + '</button>' : '') + '<button class="btn small primary" data-econ="swap" ' + (sn ? '' : 'disabled') + '>⇄ Doppelte eintauschen' + (sn ? ' (' + sn + ' → ' + fmt(sg) + ' Gold)' : '') + '</button><button class="btn small" data-econ="odds">ⓘ Chancen</button><button class="btn small" data-go="bazar">🛒 Zum Basar</button><button class="btn small danger" data-econ="reset">Sammlung zurücksetzen (Test)</button></div></div>';
  }
  function econAct(k) {
    if (k === 'mode') { ECON.setMode(ECON.player() ? 'test' : 'player'); toast(ECON.player() ? 'Spielermodus: nur Starter-Set und Pack-Karten.' + (ECON.starterTotal() ? '' : ' Noch kein Starter-Set geladen – in der Werkstatt exportieren.') : 'Testmodus: alle Karten frei.', 6000); renderDecks(); renderHome(); }
    if (k === 'all') { SHOWALL = !SHOWALL; renderDecks(); }
    if (k === 'odds') dialog(ECON.oddsHTML() + '<div class="row"><button class="btn primary" data-act="close">Schließen</button></div>', null, { dismiss: true });
    if (k === 'reset') dialog('<h2>Sammlung zurücksetzen?</h2><p>Alle aus Packs gezogenen Karten und das Gold gehen auf 0. Das Starter-Set bleibt.</p><div class="row"><button class="btn danger" data-act="yes">Zurücksetzen</button><button class="btn" data-act="no">Abbrechen</button></div>', a => { if (a === 'yes') { ECON.reset(); renderDecks(); } });
    if (k === 'swap') { const sur = ECON.surplus(); if (!sur.length) return; const g = sur.reduce((a, x) => a + x.n * (ECON.VALUE[x.c.rarity] || 1), 0);
      dialog('<h2>Doppelte eintauschen</h2><p>Du behältst von jeder Karte so viele, wie ins Deck dürfen. Den Rest tauschst du gegen Gold:</p><ul class="swaplist">' + sur.map(x => '<li><span class="chip r-' + x.c.rarity + '">' + esc(RAR(x.c.rarity)) + '</span> ' + esc(x.c.name) + ' ×' + x.n + ' <b>' + fmt(x.n * (ECON.VALUE[x.c.rarity] || 1)) + ' Gold</b></li>').join('') + '</ul><p>Zusammen <b>🪙 ' + fmt(g) + ' Gold</b>.</p><div class="row"><button class="btn primary" data-act="yes">Eintauschen</button><button class="btn" data-act="no">Abbrechen</button></div>', a => { if (a !== 'yes') return; const r = ECON.exchange(); SFX.chime(true); toast(r.cards + ' Karten gegen ' + fmt(r.gold) + ' Gold getauscht.'); renderDecks(); }); }
  }
  function cardTile(c, n, lim, pick, owned) {
    const f = fullURL(c.id), bad = (c.issues && c.issues.length) || (isSp(c) && !c.playable);
    const img = f ? '<img src="' + f + '" alt="" loading="lazy">' : '<div class="noimg" style="background:' + (SPCOL[c.type] || ELCOL[c.elements[0]] || '#2a3242') + '"><b>' + esc(c.name) + '</b><span>' + (c.type === 'king' ? 'ATK ' + fmt(c.atk) + ' · HP ' + fmt(c.hp) : isSp(c) ? '⚡' + c.energy + ' · ' + TYPEN(c) : '⚡' + c.energy + ' · ' + c.atk + ' / ' + c.def) + '</span></div>';
    return '<div class="ctile' + (n ? ' in' : '') + (pick && n >= lim ? ' full' : '') + (owned && !n ? ' missing' : '') + '">'
      + '<button class="cimg" ' + (pick ? 'data-add="' + esc(c.id) + '"' : 'data-zoom="' + esc(c.id) + '"') + ' aria-label="' + esc(c.name) + (pick ? ' ins Deck legen' : ' ansehen') + '">' + img + (n ? '<span class="cnt-badge">' + n + '×</span>' : '') + (owned && !n ? '<span class="cnt-badge none">nicht im Besitz</span>' : '') + '</button>'
      + '<div class="cmeta"><b>' + (c.type === 'king' ? '♛ ' : c.type === 'spell' ? '✦ ' : c.type === 'curse' ? '☾ ' : '') + esc(c.name) + '</b><span class="chip r-' + c.rarity + '">' + esc(RAR(c.rarity)) + '</span>' + (bad ? '<span class="bad" title="' + esc(isSp(c) && !c.playable ? 'Nicht spielbar: ' + c.notPlayable.join(' ') : c.issues.join(' ')) + '">⚠' + (isSp(c) && !c.playable ? ' nicht spielbar' : '') + '</span>' : '') + '</div>'
      + (pick ? '<div class="cnt"><button data-dec="' + esc(c.id) + '" ' + (n ? '' : 'disabled') + ' aria-label="eine weniger">−</button><span>' + n + '/' + lim + '</span><button data-inc="' + esc(c.id) + '" ' + (n >= lim ? 'disabled' : '') + ' aria-label="eine mehr">+</button><button class="zoombtn" data-zoom="' + esc(c.id) + '" aria-label="groß ansehen">⤢</button></div>' : '')
      + '</div>';
  }
  function showDTab(t) {
    dtab = t; $$('.dtabs button').forEach(b => b.classList.toggle('on', b.dataset.dtab === t));
    $('#dv-decks').hidden = t !== 'decks'; $('#dv-cards').hidden = t !== 'cards'; $('#dv-edit').hidden = t !== 'edit';
    $('.dtabs').hidden = t === 'edit';
    renderDecks(); window.scrollTo(0, 0);
  }
  function renderDecks() {
    showStore();
    $('#inbox').hidden = !IS_PC;
    if (dtab === 'cards') return renderCollection();
    if (dtab === 'edit') return renderEditor();
    const DS = LS.get('wok-spiel-decksort') || 'saved';
    const sorter = { saved: (a, b) => (b.saved || 0) - (a.saved || 0) || a.name.localeCompare(b.name, 'de'), name: (a, b) => a.name.localeCompare(b.name, 'de'), ready: (a, b) => (deckOk(b) ? 1 : 0) - (deckOk(a) ? 1 : 0) || a.name.localeCompare(b.name, 'de') }[DS];
    const tile = d => {
      const sm = deckSummary(d), cs = d.cards.map(id => POOL.cards[id]).filter(Boolean), k = cs.find(c => c.type === 'king'), img = k && fullURL(k.id);
      const he = cs.filter(c => c.type === 'hero'), nS = cs.filter(c => c.type === 'spell').length, nF = cs.filter(c => c.type === 'curse').length, avg = he.length ? (he.reduce((a, c) => a + c.energy, 0) / he.length).toFixed(1).replace('.', ',') : '–';
      const mine = d.id === SET.deckA, foe = d.id === SET.deckB, pk = DPICK && DPICK.has(d.id), when = d.saved ? new Date(d.saved).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      return '<div class="dtile' + (mine ? ' mine' : '') + (foe ? ' foe' : '') + (DPICK ? ' picking' : '') + (pk ? ' picked' : '') + (FRESH === d.id ? ' fresh' : '') + '" data-deck="' + esc(d.id) + '">' + (DPICK ? '<button class="dpick" data-dpick="' + esc(d.id) + '" aria-pressed="' + !!pk + '" aria-label="Deck auswählen">' + (pk ? '✓' : '') + '</button>' : '')
        + '<button class="dimgk" data-edit="' + esc(d.id) + '" aria-label="Deck umbauen">' + (img ? '<img src="' + img + '" alt="">' : '<div class="noimg"><b>' + esc(k ? k.name : 'kein König') + '</b></div>') + '</button>'
        + '<div class="dinfo"><button class="dname" data-rename="' + esc(d.id) + '" title="Antippen zum Umbenennen"><b>' + esc(d.name) + '</b><i aria-hidden="true">✎</i></button>'
        + '<span class="' + (sm.ok && !sm.miss ? 'ok' : 'bad') + '">' + d.cards.length + '/40 · ' + (sm.ok ? (sm.miss ? '⚠ ' + sm.miss + ' nicht in Sammlung' : '✓ spielbereit') : esc(sm.msg)) + '</span>'
        + '<small>' + (k ? '♛ ' + esc(k.name) : 'ohne König') + '</small><small class="dmix"><span>' + he.length + ' Helden</span><span>' + nS + ' Zauber</span><span>' + nF + ' Flüche</span><span>Ø ' + avg + ' ⚡</span></small>'
        + '<small class="muted">' + (d.origin === 'paket' ? 'Beispiel-Deck' : d.origin === 'demo' ? 'Demo' : 'eigenes Deck') + (when ? ' · gespeichert ' + when : '') + '</small>'
        + (mine || foe ? '<span class="playtag">' + (mine ? (SET.mode === 'ai' ? '▶ Du spielst damit' : '▶ ' + esc(SET.name1)) : '') + (mine && foe ? ' · ' : '') + (foe ? (SET.mode === 'ai' ? '⚔ KI spielt damit' : '⚔ ' + esc(SET.name2)) : '') + '</span>' : '') + '</div>'
        + '<div class="dacts"><button class="btn small primary" data-edit="' + esc(d.id) + '">✎ Umbauen</button>'
        + (mine ? '<span class="dmine">✓ Dein Deck</span>' : '<button class="btn small" data-play="' + esc(d.id) + '" ' + (sm.ok ? '' : 'disabled') + '>▶ Spielen</button>')
        + '<span class="dsp"></span><button class="btn small icon" data-more="' + esc(d.id) + '" title="Mehr: KI-Deck, Kopieren, Als Datei" aria-label="Mehr Aktionen">⋯</button><button class="btn small icon danger" data-del="' + esc(d.id) + '" title="Löschen" aria-label="Deck löschen">🗑</button></div></div>';
    };
    const own = POOL.decks.filter(d => d.origin === 'eigen').sort(sorter), other = POOL.decks.filter(d => d.origin !== 'eigen').sort(sorter);
    const tiles = (own.length ? '<h3 class="dsec">Meine Decks <span>' + own.length + '</span></h3><div class="deckgrid in">' + own.map(tile).join('') + '</div>' : '')
      + (other.length ? '<h3 class="dsec">Beispiel- und Demo-Decks <span>' + other.length + '</span></h3><div class="deckgrid in">' + other.map(tile).join('') + '</div>' : '');
    const so = $('#decksort'); if (so) so.value = DS;
    const bar = $('#dpickbar'); if (bar) { bar.hidden = !DPICK; if (DPICK) bar.innerHTML = '<b>' + DPICK.size + (DPICK.size === 1 ? ' Deck' : ' Decks') + ' ausgewählt</b><button class="btn small" data-dbulk="all">Alle</button><button class="btn small" data-dbulk="none">Keine</button><button class="btn small danger" data-dbulk="del" ' + (DPICK.size ? '' : 'disabled') + '>🗑 Ausgewählte löschen</button><button class="btn small" data-dbulk="done">Fertig</button>'; }
    $('#deckmulti').textContent = DPICK ? '✓ Auswahl beenden' : '☑ Mehrere löschen …';
    $('#deckgrid').innerHTML = tiles || '<div class="box"><p>Noch kein Deck. ' + (ownIds().length ? 'Bau dir mit „+ Neues Deck bauen“ eins aus deinen ' + ownIds().length + ' Karten.' : 'Lade zuerst deine Karten als Spielpaket aus der Kartenwerkstatt.') + '</p></div>';
  }
  function renderCollection() {
    const nOwn = ownIds().length;
    $('#poolinfo').textContent = Object.keys(POOL.cards).length + ' Karten · ' + (POOL.source || '–');
    $('#demo').hidden = Object.keys(POOL.cards).length > 0;
    $$('#ftype button').forEach(b => b.classList.toggle('on', b.dataset.ft === ftype));
    const clist = sortList(applyFacets(filtered($('#q').value, ftype), FACETS.c), FACETS.c.sort);
    $('#cfacets').innerHTML = facetBar('c', clist.length);
    $('#econbox').innerHTML = econBox();
    const pl = ECON.player(), list2 = pl && !SHOWALL ? clist.filter(c => ECON.owned(c.id)) : clist;
    $('#pool').innerHTML = list2.map(c => cardTile(c, pl ? ECON.owned(c.id) : 0, 0, false, pl)).join('') || '<p class="muted">Noch keine Karten. Lade ein Spielpaket aus der Kartenwerkstatt.</p>';
  }
  // Bearbeiten
  function openEditor(id) {
    const d = id ? deckById(id) : null;
    ED = d ? { id: d.id, name: d.name, cards: d.cards.slice(), origin: d.origin, look: lookOf(d) } : { id: null, name: 'Mein Deck ' + (POOL.decks.filter(x => x.origin === 'eigen').length + 1), cards: [], origin: 'eigen', look: lookOf(null) };
    ED.dirty = !d; $('#ai-out').hidden = true; $('#ai-state').textContent = ''; showDTab('edit'); $('#deckname').value = ED.name; if (!d) { $('#deckname').focus(); $('#deckname').select(); }
  }
  // Deck-Editor: links das Deck als Kartenbilder (König, Helden, Zauber/Flüche) mit Kurve, rechts die Sammlung
  let ESORT = 'energy', ERAR = '', ECOST = null, EONLY = false;
  // Filter nach Rasse, Klasse, Element, Gabe und Zauber-/Fluchwirkung (nur Werte, die in der Sammlung vorkommen)
  const FACETS = { e: { race: '', cls: '', el: '', gift: '', kind: '', folder: '' }, c: { race: '', cls: '', el: '', gift: '', kind: '', folder: '', sort: 'energy' } };
  function facetOptions() {
    const cs = Object.values(POOL.cards), uniq = a => [...new Set(a)];
    return { folder: uniq(cs.map(c => c.folder).filter(Boolean)).map(x => [x, '📁 ' + x]), race: uniq(cs.flatMap(c => c.races)).map(x => [x, nameOf('races', x)]), cls: uniq(cs.flatMap(c => c.classes)).map(x => [x, nameOf('classes', x)]), el: uniq(cs.flatMap(c => c.elements)).map(x => [x, nameOf('elements', x)]),
      gift: uniq(cs.flatMap(c => c.gifts.map(g => g.id))).map(x => [x, giftInfo(x).name]), kind: uniq(cs.filter(isSp).flatMap(c => ((c.spell || {}).effects || []).map(e => e.kind))).map(x => [x, ((window.WOK_EFFECTS && WOK_EFFECTS.KINDS[x]) || { name: x }).name]) };
  }
  function facetBar(key, n) {
    const st = FACETS[key], o = facetOptions(), lab = { folder: 'Alle Ordner', race: 'Alle Rassen', cls: 'Alle Klassen', el: 'Alle Elemente', gift: 'Alle Gaben', kind: 'Alle Zauber-/Fluchwirkungen' };
    const sel = f => o[f].length ? '<select class="search" data-facet="' + key + ':' + f + '" aria-label="' + lab[f] + '"><option value="">' + lab[f] + '</option>' + o[f].sort((a, b) => a[1].localeCompare(b[1], 'de')).map(([v, t]) => '<option value="' + esc(v) + '"' + (st[f] === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' : '';
    const sortSel = key === 'c' ? '<select class="search" data-facet="c:sort" aria-label="Sortieren">' + [['energy', 'Sortieren: Energie ↑'], ['energyDesc', 'Energie ↓'], ['name', 'Name A–Z'], ['atk', 'ATK (hoch zuerst)'], ['def', 'DEF (hoch zuerst)'], ['power', 'ATK + DEF'], ['rarity', 'Seltenheit (legendär zuerst)'], ['rarityAsc', 'Seltenheit (gewöhnlich zuerst)'], ['type', 'Kartenart']].map(([v, t]) => '<option value="' + v + '"' + (st.sort === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' : '';
    const active = ['folder', 'race', 'cls', 'el', 'gift', 'kind'].some(f => st[f]) || (key === 'e' && (ERAR || ECOST !== null || EONLY || $('#eq').value)) || (key === 'c' && $('#q').value);
    return sortSel + ['folder', 'race', 'cls', 'el', 'gift', 'kind'].map(sel).join('') + '<span class="fcount">' + n + (n === 1 ? ' Karte' : ' Karten') + '</span>' + (active ? '<button class="btn small" data-freset="' + key + '">Filter zurücksetzen</button>' : '');
  }
  function applyFacets(list, st) {
    return list.filter(c => (!st.folder || c.folder === st.folder) && (!st.race || c.races.includes(st.race)) && (!st.cls || c.classes.includes(st.cls)) && (!st.el || c.elements.includes(st.el)) && (!st.gift || c.gifts.some(g => g.id === st.gift)) && (!st.kind || (isSp(c) && ((c.spell || {}).effects || []).some(e => e.kind === st.kind))));
  }
  const TORD = { king: 0, hero: 1, spell: 2, curse: 3 };
  function sortList(list, mode) {
    const by = { name: (a, b) => a.name.localeCompare(b.name, 'de'), atk: (a, b) => b.atk - a.atk, def: (a, b) => b.def - a.def, power: (a, b) => (b.atk + b.def) - (a.atk + a.def), energyDesc: (a, b) => b.energy - a.energy || a.name.localeCompare(b.name, 'de'),
      rarity: (a, b) => RORD[b.rarity] - RORD[a.rarity] || a.energy - b.energy, rarityAsc: (a, b) => RORD[a.rarity] - RORD[b.rarity] || a.energy - b.energy, type: (a, b) => TORD[a.type] - TORD[b.type] || a.energy - b.energy || a.name.localeCompare(b.name, 'de') }[mode];
    return by ? list.slice().sort((a, b) => (a.type === 'king' ? -1 : 0) - (b.type === 'king' ? -1 : 0) || by(a, b)) : list;
  }
  const RORD = { gewoehnlich: 0, ungewoehnlich: 1, selten: 2, legendaer: 3 };
  const limOf = c => { const l = c.type === 'king' ? 1 : (W.COPY_LIMIT[c.rarity] || 1); return ECON.player() ? Math.min(l, ECON.owned(c.id)) : l; }; // Spielermodus: nur so viele, wie man besitzt
  function miniImg(c, cls) { const f = fullURL(c.id); return f ? '<img src="' + f + '" alt="" loading="lazy" draggable="false">' : '<div class="noimg ' + (cls || '') + '" style="background:' + (SPCOL[c.type] || ELCOL[c.elements[0]] || '#2a3242') + '"><b>' + esc(c.name) + '</b><span>' + (c.type === 'king' ? '♛ HP ' + fmt(c.hp) : isSp(c) ? TYPEN(c) : c.atk + ' / ' + c.def) + '</span></div>'; }
  function poolTile(c, n) {
    const lim = limOf(c), full = n >= lim, bad = isSp(c) && !c.playable;
    return '<div class="ptile' + (isSp(c) ? ' ' + c.type : '') + (n ? ' in' : '') + (full ? ' full' : '') + '" draggable="true" data-drag="' + esc(c.id) + '">'
      + '<button class="cimg" data-add="' + esc(c.id) + '" ' + (full ? 'aria-disabled="true"' : '') + ' aria-label="' + esc(c.name) + ' ins Deck legen (' + n + ' von ' + lim + ')">' + miniImg(c) + '<span class="plus" aria-hidden="true">' + (full ? 'voll' : '+') + '</span>' + (n ? '<span class="cnt-badge">' + n + '/' + lim + '</span>' : '') + (bad ? '<span class="badspell" title="' + esc(c.notPlayable.join(' ')) + '">⚠ nicht spielbar</span>' : '') + '</button>'
      + '<div class="pmeta"><span class="pe">' + (c.type === 'king' ? '♛' : c.energy) + '</span><b title="' + esc(c.name) + '">' + esc(c.name) + '</b><button class="zoombtn" data-zoom="' + esc(c.id) + '" aria-label="' + esc(c.name) + ' groß ansehen">⤢</button></div></div>';
  }
  let EVIEW = LS.get('wok-spiel-eview') || 'grid';
  function poolRow(c, n) {
    const lim = limOf(c), full = n >= lim;
    return '<div class="prow' + (isSp(c) ? ' ' + c.type : '') + (n ? ' in' : '') + (full ? ' full' : '') + '" draggable="true" data-drag="' + esc(c.id) + '"><span class="pe">' + (c.type === 'king' ? '♛' : c.energy) + '</span>'
      + '<button class="pr-name" data-zoom="' + esc(c.id) + '"><b>' + esc(c.name) + '</b><small>' + esc(TYPEN(c)) + ' · ' + esc([].concat(c.races.map(x => nameOf('races', x)), c.classes.map(x => nameOf('classes', x))).join(', ') || '–') + '</small></button>'
      + '<span class="pr-st">' + (c.type === 'king' ? fmt(c.hp) + ' HP' : isSp(c) ? '' : '<b class="a">' + c.atk + '</b> / <b class="d">' + c.def + '</b>') + '</span><span class="chip r-' + c.rarity + '">' + esc(RAR(c.rarity)) + '</span>'
      + '<span class="cnt"><button data-dec="' + esc(c.id) + '" ' + (n ? '' : 'disabled') + ' aria-label="eine weniger">−</button><span>' + n + '/' + lim + '</span><button data-inc="' + esc(c.id) + '" ' + (full ? 'disabled' : '') + ' aria-label="eine mehr">+</button></span></div>';
  }
  function renderLook() {
    const el = $('#lookctl'); if (!el || !ED) return; const L = ED.look || (ED.look = lookOf(null));
    const king = ED.cards.map(id => POOL.cards[id]).find(c => c && c.type === 'king');
    const opt = (k, list) => list.map(([v, t]) => '<button class="lk' + (L[k] === v ? ' on' : '') + '" data-look="' + k + ':' + v + '">' + (k === 'back' ? '<i class="bk" data-back="' + v + '"></i>' : k === 'field' ? '<i class="fs" data-skin="' + v + '" style="background-image:url(' + ((window.WOK_FIELD || {}).img || '') + ')"></i>' : '<i class="mt" style="background-image:url(' + (v === 'none' ? '' : mateImg(v, king && king.id)) + ')">' + (v === 'none' ? '–' : '') + '</i>') + '<span>' + esc(t) + '</span></button>').join('');
    el.innerHTML = '<span class="eyebrow">Kartenrücken</span><div class="lkrow">' + opt('back', BACKS) + '</div><span class="eyebrow">Spielfeld</span><div class="lkrow">' + opt('field', SKINS) + '</div><span class="eyebrow">Begleiter</span><div class="lkrow">' + opt('mate', MATES) + '</div>';
  }
  function deckTile(c, n) {
    return '<div class="dcard ' + (c.type || '') + '" draggable="true" data-dragdel="' + esc(c.id) + '"><button class="cimg" data-dec="' + esc(c.id) + '" aria-label="' + esc(c.name) + ': eine aus dem Deck nehmen (' + n + '× drin)">' + miniImg(c) + '<span class="minus" aria-hidden="true">−</span><span class="cnt-badge">×' + n + '</span></button><button class="zoombtn" data-zoom="' + esc(c.id) + '" aria-label="' + esc(c.name) + ' groß ansehen">⤢</button></div>';
  }
  function renderEditor() {
    if (!ED) return showDTab('decks');
    const cnt = {}; for (const id of ED.cards) cnt[id] = (cnt[id] || 0) + 1;
    $$('#eftype button').forEach(b => b.classList.toggle('on', b.dataset.ft === eftype));
    // Sammlung
    let list = applyFacets(filtered($('#eq').value, eftype).filter(c => (!ECON.player() || ECON.owned(c.id) > 0 || cnt[c.id]) && (!ERAR || c.rarity === ERAR) && (ECOST === null || (c.type !== 'king' && (ECOST === 7 ? c.energy >= 7 : c.energy === ECOST))) && (!EONLY || !cnt[c.id])), FACETS.e);
    list = sortList(list, ESORT);
    $('#efacets').innerHTML = facetBar('e', list.length);
    $('#ed-pool').classList.toggle('listview', EVIEW === 'list'); $$('#eview button').forEach(b => b.classList.toggle('on', b.dataset.ev === EVIEW));
    $('#ed-pool').innerHTML = list.map(c => EVIEW === 'list' ? poolRow(c, cnt[c.id] || 0) : poolTile(c, cnt[c.id] || 0)).join('') || '<p class="muted">Keine Karte passt zu Suche und Filtern.</p>';
    renderLook();
    $('#ecost').innerHTML = '<span class="muted">Energie:</span>' + [null, 0, 1, 2, 3, 4, 5, 6, 7].map(v => '<button class="' + (ECOST === v ? 'on' : '') + '" data-ecost="' + (v === null ? '' : v) + '">' + (v === null ? 'alle' : v === 7 ? '7+' : v) + '</button>').join('');
    // Deck
    const v = W.validateDeck(ED.cards, POOL.cards), cards = ED.cards.map(id => POOL.cards[id]).filter(Boolean), king = cards.find(c => c.type === 'king');
    const heroes = cards.filter(c => c.type === 'hero'), sp = cards.filter(c => isSp(c));
    const total = ED.cards.length, pct = Math.min(100, total / 40 * 100);
    $('#ed-count').innerHTML = '<div class="meter' + (v.ok ? ' ok' : total > 40 ? ' over' : '') + '"><i style="width:' + pct + '%"></i></div><span><b>' + total + '</b> / 40' + (v.ok ? ' · ✓ spielbereit' : !king ? ' · König fehlt' : total < 40 ? ' · noch ' + (40 - total) : '') + '</span>';
    $('#ed-tabn').textContent = total + '/40';
    $('#ed-king').innerHTML = king ? '<div class="dking">' + '<button class="cimg" data-zoom="' + esc(king.id) + '" aria-label="König ' + esc(king.name) + ' groß ansehen">' + miniImg(king) + '</button><div><span class="eyebrow">König</span><b>♛ ' + esc(king.name) + '</b><small class="muted">ATK ' + fmt(king.atk) + ' · ' + fmt(king.hp) + ' HP</small><button class="btn small" data-dec="' + esc(king.id) + '">Anderen König wählen</button></div></div>'
      : '<button class="dking empty" data-kingpick="1"><span>♛</span><b>König wählen</b><small>Genau einer pro Deck</small></button>';
    const tc = (n, t, cls) => '<span class="dt ' + (cls || '') + '"><b>' + n + '</b>' + t + '</span>';
    $('#ed-types').innerHTML = tc(heroes.length, 'Helden') + tc(sp.filter(c => c.type === 'spell').length, 'Zauber', 'spell') + tc(sp.filter(c => c.type === 'curse').length, 'Flüche', 'curse') + tc(heroes.length ? (heroes.reduce((a, c) => a + c.energy, 0) / heroes.length).toFixed(1).replace('.', ',') : '–', 'Ø Energie');
    const curve = Array(8).fill(0), curveS = Array(8).fill(0); for (const c of heroes) curve[Math.min(7, c.energy)]++; for (const c of sp) curveS[Math.min(7, c.energy)]++;
    const mx = Math.max(1, ...curve.map((x, i) => x + curveS[i]));
    $('#ed-curve').innerHTML = curve.map((x, i) => '<div class="cb" title="' + (i === 7 ? '7+' : i) + ' Energie: ' + x + ' Helden' + (curveS[i] ? ', ' + curveS[i] + ' Zauber/Flüche' : '') + '"><span class="cn">' + (x + curveS[i] || '') + '</span><i style="height:' + (x / mx * 100) + '%"></i><i class="s" style="height:' + (curveS[i] / mx * 100) + '%"></i><span class="cl">' + (i === 7 ? '7+' : i) + '</span></div>').join('');
    const uniq = ids => sortCards([...new Set(ids)].map(id => POOL.cards[id]).filter(Boolean));
    const grp = (title, arr) => arr.length ? '<div class="dgroup"><span class="eyebrow">' + title + ' <b>' + arr.reduce((a, c) => a + cnt[c.id], 0) + '</b></span><div class="dgrid">' + arr.map(c => deckTile(c, cnt[c.id])).join('') + '</div></div>' : '';
    const hIds = ED.cards.filter(id => POOL.cards[id] && POOL.cards[id].type === 'hero'), sIds = ED.cards.filter(id => isSp(POOL.cards[id]));
    $('#ed-list').innerHTML = (grp('Helden', uniq(hIds)) + grp('Zauber und Flüche', uniq(sIds))) || '<div class="dempty"><b>Noch leer.</b> Tippe rechts Karten an oder ziehe sie hierher. Ein Deck hat genau 40 Karten: 1 König und 39 Helden, Zauber oder Flüche.</div>';
    $('#ed-msgs').innerHTML = v.errors.length || v.warnings.length ? '<ul class="msgs">' + v.errors.map(e => '<li class="bad">' + esc(e) + '</li>').join('') + v.warnings.slice(0, 3).map(e => '<li class="muted">' + esc(e) + '</li>').join('') + '</ul>' : '';
    $('#ed-save').textContent = ED.id ? 'Änderungen speichern' : 'Deck speichern';
    $('#ed-save').classList.toggle('dirty', !!ED.dirty);
  }
  function bump(el) { const t = el.closest('.ptile'); if (!t) return; t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }
  function deckChange(id, delta) {
    if (!ED) return; const c = POOL.cards[id]; if (!c) return;
    const ids = ED.cards;
    if (delta > 0) {
      if (ECON.player() && ids.filter(x => x === id).length >= ECON.owned(id)) { toast(ECON.owned(id) ? 'Du besitzt „' + c.name + '“ nur ' + ECON.owned(id) + '×. Mehr gibt es aus Packs.' : '„' + c.name + '“ hast du noch nicht – nur aus Packs.', 5000); return; }
      if (c.type === 'king') { ED.cards = ids.filter(x => !POOL.cards[x] || POOL.cards[x].type !== 'king'); ED.cards.unshift(id); }
      else {
        const n = ids.filter(x => x === id).length, lim = W.COPY_LIMIT[c.rarity] || 1;
        if (n >= lim) { toast('„' + c.name + '“ darf höchstens ' + lim + '× ins Deck (' + RAR(c.rarity) + ').'); return; }
        const hasKing = ids.some(x => POOL.cards[x] && POOL.cards[x].type === 'king');
        if (ids.length >= (hasKing ? 40 : 39)) { toast(hasKing ? 'Das Deck hat schon 40 Karten.' : 'Lass einen Platz für den König frei.'); return; }
        ids.push(id);
      }
    } else { const i = ids.lastIndexOf(id); if (i >= 0) ids.splice(i, 1); }
    ED.dirty = true; renderEditor();
  }
  function autofill() {
    if (!ED) return; const ids = ED.cards, cards = Object.values(POOL.cards);
    if (!ids.some(id => POOL.cards[id] && POOL.cards[id].type === 'king')) { const k = cards.find(c => c.type === 'king' && (!ECON.player() || ECON.owned(c.id))); if (k) ids.unshift(k.id); }
    const heroes = cards.filter(c => c.type === 'hero');
    let guard = 0;
    while (ids.length < 40 && guard++ < 2000) {
      const cnt = {}; for (const id of ids) cnt[id] = (cnt[id] || 0) + 1;
      const free = heroes.filter(c => (cnt[c.id] || 0) < limOf(c)); if (!free.length) break;
      ids.push(free[Math.floor(Math.random() * free.length)].id);
    }
    if (ids.length < 40) toast('Zu wenige verschiedene Karten für 40. Lade weitere Karten aus der Werkstatt.');
    ED.dirty = true; renderEditor();
  }
  const DEFNAME = n => !n || /^(Mein Deck \d+|Ohne Namen|Neues Deck)$/i.test(n);
  function uniqueName(name, selfId) { let n = name, k = 2; while (POOL.decks.some(x => x.id !== selfId && x.name.toLowerCase() === n.toLowerCase())) n = (name.slice(0, 35) + ' (' + (k++) + ')'); return n; }
  function saveEditor(named) {
    try { return saveEditorRun(named); } catch (e) { toast('Speichern fehlgeschlagen: ' + (e && e.message || e), 9000); console.error(e); }
  }
  function saveEditorRun(named) {
    if (!ED) return;
    let name = ($('#deckname').value || '').trim().slice(0, 40);
    // Ohne eigenen Namen erst nach einem Namen fragen, damit die Übersicht ordentlich bleibt
    if (named !== true && DEFNAME(name)) {
      dialog('<h2>Wie soll das Deck heißen?</h2><label class="field">Name<input type="text" id="sv-name" maxlength="40" value="' + esc(name) + '" placeholder="z. B. Drachenfeuer, Eisenwall"></label><div class="row"><button class="btn primary" data-act="ok">Speichern</button><button class="btn" data-act="no">Zurück</button></div>', act => { if (act !== 'ok') return; const v = ($('#sv-name').value || '').trim().slice(0, 40); if (!v) { toast('Bitte einen Namen eingeben.'); return false; } $('#deckname').value = v; closeDialog(); saveEditor(true); return false; });
      setTimeout(() => { const i = $('#sv-name'); if (i) { i.focus(); i.select(); i.onkeydown = e => { if (e.key === 'Enter') { const b = $('#dlg [data-act="ok"]'); if (b) b.click(); } }; } }, 30); return;
    }
    name = uniqueName(name || 'Ohne Namen', ED.id);
    let d = ED.id && deckById(ED.id);
    if (d) { d.name = name; d.cards = ED.cards.slice(); d.look = Object.assign({}, ED.look); d.saved = Date.now(); if (d.origin === 'demo') { hideDeck(d); d.origin = 'eigen'; } }
    else { d = { id: newDeckId(), name, cards: ED.cards.slice(), origin: 'eigen', look: Object.assign({}, ED.look), saved: Date.now() }; POOL.decks.push(d); }
    const ok = deckOk(d);
    if (ok && (!deckOk(deckById(SET.deckA)) || !ED.id)) { if (!ED.id && !deckOk(deckById(SET.deckA))) SET.deckA = d.id; }
    fixDeckChoice(); savePool(); ED = null; FRESH = d.id;
    toast('Deck „' + name + '“ gespeichert' + (ok ? '.' : ' (noch nicht spielbereit).'), 4000);
    show('decks'); showDTab('decks'); renderHome();
    setTimeout(() => { const t = document.querySelector('.dtile.fresh'); if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
  }
  function leaveEditor() {
    if (ED && ED.dirty) { dialog('<h2>Änderungen verwerfen?</h2><p>Das Deck wurde noch nicht gespeichert.</p><div class="row"><button class="btn primary" data-act="save">Speichern</button><button class="btn danger" data-act="drop">Verwerfen</button><button class="btn" data-act="no">Weiter bearbeiten</button></div>', act => { if (act === 'save') saveEditor(); if (act === 'drop') { ED.dirty = false; leaveEditor(); } }); return; }
    const ret = ED && ED.ret; ED = null; if (ret === 'home') { show('home'); openSetup(); return; } showDTab('decks');
  }
  async function checkImages() {
    const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth > 0); i.onerror = () => res(false); i.src = u; });
    const ids = Object.keys(POOL.cards); let ok = 0, miss = 0, bad = [];
    toast('Bilder werden geprüft …', 20000);
    for (const id of ids) { const u = fullURL(id); if (!u) { miss++; continue; } if (await load(u)) ok++; else bad.push(POOL.cards[id].name); }
    dialog('<span class="eyebrow">Bilder prüfen</span><h2>' + ok + ' von ' + ids.length + ' Kartenbildern laden</h2>'
      + (miss ? '<p>' + miss + ' Karten haben kein fertiges Kartenbild' + (Object.keys(POOL.raw).length ? ' (werden, wenn möglich, im Spiel nachgezeichnet)' : '') + '.</p>' : '')
      + (bad.length ? '<p class="bad">Nicht ladbar: ' + esc(bad.slice(0, 8).join(', ')) + (bad.length > 8 ? ' …' : '') + '</p><p>Lade das Spielpaket bitte noch einmal. Meldet die Prüfung danach immer noch Fehler, schreib mir diese Zeile:</p><pre class="diag">' + esc(diagLine()) + '</pre>' : '<p class="hint">' + esc(diagLine()) + '</p>')
      + '<button class="btn" data-act="close">Schließen</button>', null, { dismiss: true });
  }
  function diagLine() { const ids = Object.keys(POOL.cards); return 'Spiel ' + VERSION + ' · Speicher ' + STORE.kind + (STORE.err ? ' (' + STORE.err + ')' : '') + ' · Karten ' + ids.length + ' · Bilder lokal ' + Object.keys(POOL.full).length + ' · gespeichert ' + Object.values(POOL.remote).filter(r => r.full).length + ' · ' + (navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/) || [''])[0]; }
  /* ---------------- Deck-KI ---------------- */
  const NAMES = { gifts: Object.fromEntries(GD.gifts.concat(GD.royal).map(g => [g.id, g.name])), races: Object.fromEntries(GD.races.map(x => [x.id, x.name])), classes: Object.fromEntries(GD.classes.map(x => [x.id, x.name])), elements: Object.fromEntries(GD.elements.map(x => [x.id, x.name])), rarities: Object.fromEntries(GD.rarities.map(x => [x.id, x.name])) };
  let LLM = null; // { kind: 'claude' | 'pc', name } oder { kind: 'none', why }
  async function llmInfo() {
    if (LLM) return LLM;
    if (IS_PC) {
      try { const j = await (await fetch('/api/ai/config')).json(); LLM = j.provider && j.provider !== 'aus' ? { kind: 'pc', name: { ollama: 'Ollama (lokal)', gemini: 'Gemini', openai: 'ChatGPT-API', anthropic: 'Claude-API' }[j.provider] || j.provider } : { kind: 'none', why: 'Für Fragen an die KI in der Kartenwerkstatt unter „Exportieren → KI-Verbindung“ einen Anbieter einstellen (z. B. Ollama, kostenlos). Bauen, Prüfen und Lücken füllen gehen auch ohne.' }; }
      catch (e) { LLM = { kind: 'none', why: 'KI-Verbindung nicht erreichbar.' }; }
      return LLM;
    }
    const smp = window.claude && window.claude.use ? await window.claude.use('sample').catch(() => null) : null;
    LLM = smp ? { kind: 'claude', name: 'Claude', fn: smp } : { kind: 'none', why: 'Fragen an Claude sind in dieser Ansicht nicht verfügbar. Bauen, Prüfen und Lücken füllen gehen trotzdem.' };
    return LLM;
  }
  function focusOptions() {
    const cnt = {}; for (const c of Object.values(POOL.cards)) if (c.type === 'hero') { for (const r of c.races) cnt['race:' + r] = (cnt['race:' + r] || 0) + 1; for (const r of c.classes) cnt['class:' + r] = (cnt['class:' + r] || 0) + 1; for (const r of c.elements) cnt['element:' + r] = (cnt['element:' + r] || 0) + 1; }
    const lab = k => { const [sc, id] = k.split(':'); return ({ race: 'Rasse ', class: 'Klasse ', element: 'Element ' }[sc]) + (NAMES[sc === 'race' ? 'races' : sc === 'class' ? 'classes' : 'elements'][id] || id); };
    return Object.entries(cnt).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, label: lab(k) + ' (' + n + ' Helden)' }));
  }
  function aiOut(html) { const o = $('#ai-out'); o.hidden = false; o.innerHTML = html; const d = $('#aibox'); if (d) d.open = true; }
  function buildDialog(fromOverview) {
    const kings = Object.values(POOL.cards).filter(c => c.type === 'king');
    if (!kings.length) { toast('In deiner Sammlung ist noch kein König.'); return; }
    let style = 'ausgewogen';
    dialog('<span class="eyebrow">✦ Deck-KI</span><h2>Deck bauen lassen</h2><p class="hint">Die KI baut aus deinen Karten ein gültiges Deck: 40 Karten, genau ein König, Kopienlimit, eine sinnvolle Kostenkurve und Helden, die zu den königlichen Gaben passen.</p>'
      + '<div class="field">Spielstil<div class="seg" id="bd-style">' + Object.entries(DAI.STYLES).map(([k, v]) => '<button data-st="' + k + '" class="' + (k === style ? 'on' : '') + '">' + esc(v.name.split(' (')[0]) + '</button>').join('') + '</div></div>'
      + '<label class="field">König<select class="search" id="bd-king"><option value="">Den besten automatisch wählen</option>' + kings.map(k => '<option value="' + esc(k.id) + '">' + esc(k.name) + '</option>').join('') + '</select></label>'
      + '<label class="field">Schwerpunkt<select class="search" id="bd-focus"><option value="">Keiner</option>' + focusOptions().map(o => '<option value="' + esc(o.k) + '">' + esc(o.label) + '</option>').join('') + '</select></label>'
      + '<div class="row"><button class="btn primary" data-act="go">Deck bauen</button><button class="btn" data-act="close">Abbrechen</button></div>',
      (act, btn) => {
        if (btn.closest('#bd-style')) return false;
        if (act !== 'go') return;
        const f = $('#bd-focus').value, [sc, tg] = f ? f.split(':') : [];
        const r = DAI.build(POOL.cards, { style, kingId: $('#bd-king').value || undefined, focus: f ? { scope: sc, target: tg } : null });
        if (!r.ids) { toast(r.error); return; }
        if (fromOverview || !ED) openEditor(null);
        ED.cards = r.ids.slice(); ED.dirty = true;
        if (!$('#deckname').value || /^Mein Deck/.test($('#deckname').value)) $('#deckname').value = r.king.name + ' · ' + DAI.STYLES[style].name.split(' (')[0];
        renderEditor();
        aiOut('<b>Gebaut' + (r.ok ? '' : ' (noch nicht ganz gültig)') + ':</b><ul>' + r.why.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' + (r.ok ? '' : '<p class="bad">' + esc(r.validation.errors.join(' ')) + '</p>') + '<p class="hint">Gefällt es dir, dann „Deck speichern“. Du kannst vorher noch Karten tauschen.</p>');
      });
    $('#bd-style').onclick = e => { const b = e.target.closest('[data-st]'); if (!b) return; style = b.dataset.st; $$('#bd-style button').forEach(x => x.classList.toggle('on', x === b)); };
  }
  function checkDeck() {
    if (!ED) return; const a = DAI.analyze(ED.cards, POOL.cards);
    aiOut('<b>Deck-Prüfung</b><ul><li>' + a.count + ' / 40 Karten' + (a.king ? ', König ' + esc(a.king.name) : ', <span class="bad">kein König</span>') + '</li><li>Kostenkurve ' + esc(a.curveText) + ' · Ø ' + a.avgCost.toFixed(1).replace('.', ',') + ' Energie</li><li>Ø ATK ' + Math.round(a.avgAtk) + ' · Ø DEF ' + Math.round(a.avgDef) + '</li>'
      + a.synergy.map(x => '<li>' + esc(x.text) + '</li>').join('') + '</ul>'
      + (a.warnings.length ? '<p class="bad">' + esc(a.warnings.join(' ')) + '</p>' : '')
      + (a.tips.length ? '<b>Hinweise</b><ul>' + a.tips.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p class="ok">Keine Auffälligkeiten.</p>'));
  }
  function fixDeck() {
    if (!ED) return; const before = ED.cards.length;
    const r = DAI.repair(ED.cards, POOL.cards, {}); if (!r.ids) { toast(r.error); return; }
    ED.cards = r.ids.slice(); ED.dirty = true; renderEditor();
    aiOut('<b>Aufgefüllt:</b> ' + before + ' → ' + ED.cards.length + ' Karten. Deine gewählten Karten sind geblieben' + (r.ok ? ', das Deck ist spielbereit.' : '.') + '<ul>' + r.why.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>');
  }
  function aiPrompt(question) {
    const a = DAI.analyze(ED.cards, POOL.cards), cnt = {}; for (const id of ED.cards) cnt[id] = (cnt[id] || 0) + 1;
    return 'Du bist der Deck-Berater für das Kartenspiel WAR OF KINGS. Antworte auf Deutsch, freundlich, kurz und konkret, mit Kartennamen. Halte dich streng an das Regelwerk unten. Erfinde keine Regeln, Gaben, Rassen, Klassen oder Karten. Verwende nur Karten aus der Sammlung des Spielers.\n\n'
      + 'DECKBAU-REGELN: genau 40 Karten, genau 1 König, gleiche Karten höchstens: Gewöhnlich 4, Ungewöhnlich 3, Selten 2, Legendär 1. Energie im Zug n = n (höchstens 10).\n\n'
      + '=== REGELWERK ===\n' + (window.WOK_RULES || '') + '\n\n'
      + '=== GABEN (Kartentexte) ===\n' + GD.gifts.map(g => g.name + (g.kind === 'ct' ? ' (CT ' + g.ct + ')' : ' (permanent)') + ': ' + g.text).join('\n') + '\n' + GD.royal.map(g => g.name + ' (Königsgabe): ' + g.text).join('\n') + '\n\n'
      + '=== SAMMLUNG DES SPIELERS (id | Name | Typ | Seltenheit | Werte | Rasse/Klasse/Element | Laufen | Angriff | Gaben). Richtungen: n=vorwärts, s=zurück, e=rechts, w=links, ne/nw=schräg vorwärts ===\n'
      + Object.values(POOL.cards).map(c => DAI.cardLine(c, NAMES)).join('\n') + '\n\n'
      + '=== AKTUELLES DECK „' + ($('#deckname').value || 'ohne Namen') + '“ (' + ED.cards.length + ' Karten) ===\n' + Object.entries(cnt).map(([id, n]) => n + '× ' + ((POOL.cards[id] || {}).name || id) + ' [' + id + ']').join('\n') + '\n'
      + 'Prüfung des Spiels: Kurve ' + a.curveText + '; ' + a.synergy.map(x => x.text).join(' ') + ' ' + a.tips.join(' ') + '\n\n'
      + 'Wenn du ein neues oder geändertes Deck vorschlägst, hänge GANZ AM ENDE genau einen Block an, mit dem VOLLSTÄNDIGEN Deck (genau 40 Karten, genau 1 König, Kopienlimit beachten, nur IDs aus der Sammlung):\n```deck\n{"name": "Deckname", "karten": [{"id": "…", "anzahl": 2}]}\n```\nSchlägst du kein Deck vor, lass den Block weg.\n\n'
      + 'FRAGE DES SPIELERS: ' + question;
  }
  async function askAI() {
    const q = ($('#ai-q').value || '').trim(); if (!q || !ED) return;
    const info = await llmInfo();
    if (info.kind === 'none') { aiOut('<p>' + esc(info.why) + '</p>'); return; }
    const st = $('#ai-state'); st.textContent = info.name + ' denkt nach …'; $('#ai-send').disabled = true;
    const show = t => { const vis = t.replace(/```deck[\s\S]*?(```|$)/, '').trim(); aiOut('<div class="aitext">' + esc(vis).replace(/\n/g, '<br>') + '</div>'); };
    try {
      let text;
      if (info.kind === 'claude') { const r = await info.fn(aiPrompt(q), { onText: ({ text }) => show(text) }); text = r.text; }
      else { const r = await fetch('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: aiPrompt(q) }) }); const j = await r.json(); if (!r.ok) throw new Error(j.message || r.status); text = j.text; }
      show(text);
      const m = text.match(/```deck\s*([\s\S]*?)```/);
      if (m) {
        let prop = null; try { prop = JSON.parse(m[1]); } catch (e) { }
        const ids = []; if (prop && Array.isArray(prop.karten)) for (const k of prop.karten) { if (!POOL.cards[k.id]) continue; for (let i = 0; i < Math.min(4, +k.anzahl || 1); i++) ids.push(k.id); }
        if (ids.length) {
          const v = W.validateDeck(ids, POOL.cards), fixed = v.ok ? null : DAI.repair(ids, POOL.cards, {});
          ED.proposal = { ids: v.ok ? ids : fixed.ids, name: prop.name };
          $('#ai-out').insertAdjacentHTML('beforeend', '<div class="row" style="margin-top:8px"><button class="btn small primary" id="ai-apply">Vorschlag übernehmen</button>' + (v.ok ? '' : '<span class="hint">Der Vorschlag war nicht ganz regelkonform (' + esc(v.errors[0]) + '); er wird beim Übernehmen automatisch korrigiert.</span>') + '</div>');
        }
      }
      st.textContent = 'Antwort von ' + info.name + '.';
    } catch (e) { aiOut('<p class="bad">Die KI hat nicht geantwortet (' + esc((e && (e.code || e.message)) || 'Fehler') + ').</p>'); st.textContent = ''; }
    finally { $('#ai-send').disabled = false; }
  }
  function applyProposal() {
    if (!ED || !ED.proposal) return; ED.cards = ED.proposal.ids.slice(); if (ED.proposal.name) $('#deckname').value = String(ED.proposal.name).slice(0, 40); ED.dirty = true; ED.proposal = null; renderEditor(); toast('Vorschlag übernommen. Mit „Deck speichern“ behalten.');
  }

  function zoomCard(id, from) { openInspector({ cid: id, from }); }
  function zoomCardOld(id) {
    const c = POOL.cards[id] || (G && G.s.cards[id]); if (!c) return;
    const f = fullURL(id);
    dialog((f ? '<div class="zoom"><img src="' + f + '" alt="Karte ' + esc(c.name) + '"></div>' : '') + cardDetail(c, null, null, { noImage: !!f }) + '<button class="btn" data-act="close">Schließen</button>', null, { dismiss: true, cls: 'wide' });
  }
  function miniGrid(dirs, kind, owner, steps) {
    return '<div class="mini ' + kind + '"><div class="g">' + GRID9.map(d => d ? '<i class="' + (dirs[d] ? 'on' : '') + '">' + (dirs[d] ? (dirs[d] > 1 ? dirs[d] : ARROW[d]) : '') + '</i>' : '<i class="c"></i>').join('') + '</div><span>' + (kind === 'atk' ? 'Angriff' : 'Laufen' + (steps ? ' · ' + steps + ' Schritt' + (steps > 1 ? 'e' : '') : '')) + '</span></div>';
  }
  const DIRWORD = { n: 'vorwärts', ne: 'schräg vorwärts rechts', e: 'rechts', se: 'schräg zurück rechts', s: 'zurück', sw: 'schräg zurück links', w: 'links', nw: 'schräg vorwärts links' };
  const dirList = ds => W.DIRS.filter(d => ds.includes(d)).map(d => DIRWORD[d]).join(', ');
  // Alles, was die Karte kann, in Worten
  function abilities(c, u, s) {
    const king = c.type === 'king', L = [];
    const atk = u && s ? W.atkOf(s, u) : c.atk;
    if (king) {
      L.push('Steht fest auf dem Königsfeld und bewegt sich nie. Verliert das Spiel, wenn die HP auf 0 fallen.');
      const ad = Object.keys(c.attack.dirs);
      L.push(ad.length ? 'Greift einmal pro Battlephase an: ' + dirList(ad) + ' (1 Feld). Besiegt dabei Helden mit DEF bis ' + fmt(atk) + ', sonst passiert nichts. Wird selbst nie durch einen Kampfvergleich besiegt.' : 'Hat keine Angriffsrichtung.');
      L.push('Hat keine DEF: Jeder Treffer zieht die ATK des Angreifers von den HP ab.');
    } else {
      const cost = s ? W.cost(s, u ? u.owner : actor(s), c.id) : c.energy;
      L.push('Beschwören kostet ' + c.energy + ' Energie' + (cost < c.energy ? ' (für dich jetzt ' + cost + ' durch Gebot der Krone)' : '') + '.');
      L.push(c.move.dirs.length && c.move.steps ? 'Läuft bis zu ' + c.move.steps + ' Feld' + (c.move.steps > 1 ? 'er' : '') + ' pro Zug, Richtungswechsel erlaubt: ' + dirList(c.move.dirs) + '.' : 'Kann nicht laufen.');
      const ad = Object.entries(c.attack.dirs);
      if (ad.length) {
        const far = ad.filter(([, n]) => n > 1).map(([d]) => d), sch = c.gifts.some(g => g.id === 'schuetze');
        L.push('Greift einmal pro Battlephase an: ' + dirList(ad.map(([d]) => d)) + '.' + (sch ? ' Durch Schütze auch Ziele 2 Felder entfernt.' : far.length ? ' Richtung ' + dirList(far) + ' reicht 2 Felder weit.' : ''));
        L.push('Mit ATK ' + fmt(atk) + ': besiegt Helden mit DEF unter ' + fmt(atk) + ', fällt bei höherer DEF, bei gleicher DEF fallen beide. Gegen den König: −' + fmt(atk) + ' HP' + (c.gifts.some(g => g.id === 'doppelschlag') ? ', mit Doppelschlag −' + fmt(atk * 2) : '') + '.');
      } else L.push('Hat keine Angriffsrichtung.');
      if (!c.gifts.some(g => g.id === 'ansturm')) L.push('Nach dem Beschwören: erst im nächsten eigenen Zug laufen, angreifen und Gaben nutzen.');
    }
    if (u && s && u.owner !== (G ? G.view : 0)) L.push('Gegnerische Karte: Richtungen gelten aus Sicht ihres Besitzers (für dich gespiegelt).');
    return '<div class="cando"><span class="eyebrow">Was die Karte kann</span><ul>' + L.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>';
  }
  // Phasen-Siegel wie auf der Karte: B = Battlephase, K = Konterphase
  const phaseSeals = tm => { tm = tm || 'both'; const B = '<span class="pseal b" title="In deiner Battlephase spielbar">B</span>', K = '<span class="pseal k" title="In deiner Konterphase spielbar">K</span>'; return '<span class="pseals" title="Wann spielbar">' + (tm === 'battle' ? B : tm === 'counter' ? K : B + K) + '<small>' + (tm === 'battle' ? 'nur Battlephase' : tm === 'counter' ? 'nur Konterphase' : 'Battle- oder Konterphase') + '</small></span>'; };
  function spellDetail(c, s, o) {
    o = o || {};
    const EF = W.EF, D = window.WOK_DATA, sp = c.spell || { effects: [] };
    const full = fullURL(c.id);
    const head = full && !o.noImage ? '<button class="fullcard" data-zoom="' + esc(c.id) + '" aria-label="Karte groß ansehen"><img src="' + full + '" alt="Karte ' + esc(c.name) + '"></button>' : '';
    const L = [];
    L.push((c.type === 'curse' ? 'Fluch' : 'Zauber') + ' · kostet ' + c.energy + ' Energie · ' + (EF ? EF.TIMINGS[sp.timing || 'both'] : '') + '.');
    if (sp.require && sp.require.items && sp.require.items.length) L.push('Voraussetzung: ' + EF.condText(sp.require, D) + '.');
    sp.effects.forEach((e, i) => L.push((sp.effects.length > 1 ? (i + 1) + '. ' : '') + (e.trigger === 'enemyAttack' ? 'Bei einem gegnerischen Angriff: ' : '') + EF.describeEffect(e, D, c.type, sp.timing || 'both')));
    L.push(sp.effects.some(e => e.kind === 'control') ? 'In deiner Battlephase gewirkt, wirkt diese Karte sofort – der übernommene Held kann noch in derselben Battlephase angreifen. Sonst (Konterphase) wird sie nach der Konterphase ausgewertet.' : 'Wird nach der Konterphase gemeinsam mit allen anderen gespielten Zaubern und Flüchen ausgewertet, vor den Angriffen.');
    const bad = !c.playable ? '<div class="spbad"><b>Nicht spielbar</b><ul>' + c.notPlayable.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul><span class="hint">In der Kartenwerkstatt prüfen und neu exportieren.</span></div>' : '';
    return '<div class="detail spelldetail ' + c.type + '">' + head
      + '<div style="display:grid;gap:6px;min-width:0"><span class="dname">' + (c.type === 'curse' ? '☾ ' : '✦ ') + esc(c.name) + '</span><div class="row" style="gap:6px"><span class="chip r-' + c.rarity + '">' + esc(RAR(c.rarity)) + '</span>' + phaseSeals(sp.timing) + '<span class="chip ' + c.type + '">' + TYPEN(c) + (c.subtitle ? ' · ' + esc(c.subtitle) : '') + '</span></div><div class="stats"><span class="stat e">⚡ ' + c.energy + '</span></div></div>'
      + '<div class="ruletext">' + esc(c.ruleText) + (c.flavor ? '<i>' + esc(c.flavor) + '</i>' : '') + '</div>' + bad
      + '<div class="cando"><span class="eyebrow">So wirkt die Karte im Spiel</span><ul>' + L.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>';
  }
  /* ---------------- Zustände: eigene Symbole für jede Art von Buff/Debuff ---------------- */
  const ICO = {
    chain: '<g transform="rotate(-45 12 12)"><rect x="2" y="9" width="11" height="6" rx="3"/><rect x="11" y="9" width="11" height="6" rx="3"/></g>',
    skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4 3 5v3.5h8V15c1.8-1 3-2.6 3-5a7 7 0 0 0-7-7z"/><circle cx="9.3" cy="10.5" r="1.4" fill="currentColor"/><circle cx="14.7" cy="10.5" r="1.4" fill="currentColor"/><path d="M10.5 18.5v2M13.5 18.5v2"/>',
    sword: '<path d="M19 4l-9.5 9.5M19 4h-3.5M19 4v3.5M7 11l6 6M5.5 18.5l3-3"/>',
    shield: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>',
    shieldok: '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    boot: '<path d="M8 3h5v8l6 3v4H6l1-5z"/><path d="M6 18v2h13v-2"/>',
    seal: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/><path d="M12 7.5l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" stroke-width="1.2"/>',
    cut: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    swords: '<path d="M4 4l10 10M20 4L10 14M14 14l3 3M10 14l-3 3M15.5 19.5l3-3M8.5 19.5l-3-3"/>',
    back: '<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 6 6"/>',
    field: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h16M12 4v16"/><path d="M15 15l4 4" stroke-width="2.4"/>',
    clip: '<path d="M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l7-7"/>'
  };
  const svgI = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICO[k] || '') + '</svg>';
  const nmP = (s, p) => s.players[p] ? s.players[p].name : 'Spieler ' + (p + 1);
  function durHuman(s, e) {
    if (e.endTurn) return 'bis zum Ende dieses Zuges';
    if (e.until) { const n = e.until.turn - s.players[e.until.p].turns; return n <= 1 ? 'endet zu Beginn des nächsten Zuges von ' + nmP(s, e.until.p) : 'endet in ' + n + ' Zügen von ' + nmP(s, e.until.p) + ' (zu Beginn des ' + e.until.turn + '. Zuges)'; }
    if (e.untilEnd) { const n = e.untilEnd.turn - s.players[e.untilEnd.p].turns; return n <= 0 ? 'bis zum Ende dieses Zuges von ' + nmP(s, e.untilEnd.p) : n === 1 ? 'bis zum Ende des nächsten Zuges von ' + nmP(s, e.untilEnd.p) : 'bis zum Ende des ' + n + '. nächsten Zuges von ' + nmP(s, e.untilEnd.p); }
    if (e.permanent) return 'dauerhaft';
    if (e.whileCond) return 'solange gilt: ' + (W.EF ? W.EF.condText(e.whileCond, window.WOK_DATA) : 'Bedingung');
    return '';
  }
  // Alle Zustände einer Einheit: { ic, cls (neg|pos|info), label, src, dur, cid }
  function statusList(s, u) {
    const out = [], c = s.cards[u.cid];
    const srcOf = e => e.cid ? ((e.src === 'curse' ? 'Fluch' : 'Zauber') + ' „' + s.cards[e.cid].name + '“') : e.id ? 'Gabe ' + giftInfo(e.id).name : '';
    const gl = g => g === 'all' ? 'alle Gaben' : (g || []).map(id => giftInfo(id).name).join(', ');
    const add = (e, area) => {
      const k = e.kind || e.id, sign = (+e.amount || 0) < 0, st = { atk: 'ATK', def: 'DEF', move: 'Schritte' }[e.stat];
      let x = null;
      const fr = (u.fx || []).some(z => z.kind === 'control');
      if (k === 'fesseln') x = fr ? { ic: 'chain', cls: 'info', label: 'Gefesselt – umgangen, solange übernommen' } : { ic: 'chain', cls: 'neg', label: 'Gefesselt – kann nicht laufen' };
      else if (k === 'moveBlock') x = fr ? { ic: 'chain', cls: 'info', label: 'Bewegungssperre – umgangen, solange übernommen' } : { ic: 'chain', cls: 'neg', label: 'Bewegungsunfähig – kann nicht laufen' };
      else if (k === 'control') x = { ic: 'swap', cls: 'neg', label: 'Unter der Kontrolle von ' + nmP(s, e.to) + ' – umgeht Sperren und Fesseln' };
      else if (e.stat) { const set = e.mode === 'set'; x = { ic: e.stat === 'atk' ? 'sword' : e.stat === 'def' ? 'shield' : 'boot', cls: set ? (e.negative ? 'neg' : 'pos') : sign ? 'neg' : 'pos', label: set ? st + ' festgesetzt auf ' + fmt(e.amount) : st + ' ' + (sign ? '−' : '+') + fmt(Math.abs(+e.amount)) + (e.id === 'entwaffnen' ? ' (entwaffnet)' : '') }; }
      else if (k === 'giftBlock') x = { ic: 'seal', cls: 'neg', label: 'Blockiert: ' + gl(e.gifts) };
      else if (k === 'giftRemove') x = { ic: 'cut', cls: 'neg', label: 'Entfernt: ' + gl(e.gifts) };
      else if (k === 'protect') x = { ic: 'shieldok', cls: 'pos', label: 'Geschützt – Angriffe gegen ihn wirkungslos' };
      else if (k === 'deathWard') { const left = e.uses ? Math.max(0, e.uses - (area ? ((e.used || {})[u.uid] || 0) : (e.used || 0))) : 0; x = { ic: 'heart', cls: 'pos', label: 'Vor Zerstörung bewahrt' + (e.uses ? ' (' + left + '× übrig)' : '') }; }
      if (!x) return;
      x.src = srcOf(e) + (area ? ' · Flächeneffekt' : ''); x.dur = durHuman(s, e); x.cid = e.cid || null; out.push(x);
    };
    if (u.poison) out.push({ ic: 'skull', cls: 'neg', label: 'Vergiftet (Poison)', src: '', dur: 'stirbt zu Beginn des nächsten Zuges von ' + nmP(s, u.poison.by) });
    for (const e of u.fx || []) add(e, false);
    for (const a of W.auraOn(s, u)) add(a, true);
    if (W.locked(s, u)) out.push({ ic: 'lock', cls: 'info', label: 'Beschwörungssperre', src: '', dur: 'kann in diesem Zug weder laufen noch angreifen' });
    if (!u.king && W.fieldLocked(s, u.pos)) out.push({ ic: 'field', cls: 'neg', label: 'Steht auf einem gesperrten Feld', src: '', dur: '' });
    if (s.decl[u.uid]) out.push({ ic: 'swords', cls: 'info', label: 'Greift an: ' + s.decl[u.uid].targets.map(t => s.cards[s.units[t].cid].name).join(' + '), src: '', dur: '' });
    if (s.retreat.includes(u.uid)) out.push({ ic: 'back', cls: 'info', label: 'Zieht nach dem Kampf zurück (Rückzug)', src: '', dur: '' });
    return out;
  }
  function statusBadges(s, u) {
    const L = statusList(s, u).filter(x => x.ic !== 'swords' && x.ic !== 'back'), seen = new Set(), list = [];
    for (const x of L) { const key = x.ic + x.cls; if (seen.has(key)) continue; seen.add(key); list.push(x); }
    list.sort((a, b) => ({ neg: 0, info: 1, pos: 2 }[a.cls] - { neg: 0, info: 1, pos: 2 }[b.cls]));
    const max = 4, show = list.slice(0, max);
    return show.map(x => '<span class="sb ' + x.cls + '" title="' + esc(x.label) + '">' + svgI(x.ic) + '</span>').join('') + (list.length > max ? '<span class="sb more" title="weitere Zustände">+' + (list.length - max) + '</span>' : '')
      + (s.decl[u.uid] ? '<span class="sb info" title="Angriff festgelegt">' + svgI('swords') + '</span>' : '') + (s.retreat.includes(u.uid) ? '<span class="sb info" title="Rückzug">' + svgI('back') + '</span>' : '');
  }
  function statusSection(s, u) {
    const L = statusList(s, u);
    if (!L.length) return '<div class="stlist"><span class="eyebrow">Zustände &amp; Effekte</span><p class="hint" style="margin:0">Keine Buffs oder Debuffs.</p></div>';
    const n = L.filter(x => x.cls === 'neg').length, pz = L.filter(x => x.cls === 'pos').length;
    return '<div class="stlist"><span class="eyebrow">Zustände &amp; Effekte' + (n ? ' · <span class="negc">' + n + ' negativ</span>' : '') + (pz ? ' · <span class="posc">' + pz + ' positiv</span>' : '') + '</span>'
      + L.map(x => '<div class="strow ' + x.cls + '"' + (x.cid ? ' data-zoom="' + esc(x.cid) + '"' : '') + '><span class="sb ' + x.cls + '">' + svgI(x.ic) + '</span><div><b>' + esc(x.label) + '</b>' + (x.src || x.dur ? '<small>' + esc([x.src, x.dur].filter(Boolean).join(' · ')) + '</small>' : '') + '</div></div>').join('') + '</div>';
  }
  function cardDetail(c, u, s, o) {
    if (isSp(c)) return spellDetail(c, s, o);
    o = o || {};
    const king = c.type === 'king';
    const statsHTML = [];
    if (!king) statsHTML.push('<span class="stat e">⚡ ' + c.energy + '</span>');
    if (u && s) {
      const a = W.atkOf(s, u), d = W.defOf(s, u);
      statsHTML.push('<span class="stat a">ATK ' + fmt(a) + (a !== c.atk ? ' <small>(' + fmt(c.atk) + ')</small>' : '') + '</span>');
      statsHTML.push(king ? '<span class="stat h">HP ' + fmt(u.hp) + ' <small>/ ' + fmt(c.hp) + '</small></span>' : '<span class="stat d">DEF ' + fmt(d) + (d !== c.def ? ' <small>(' + fmt(c.def) + ')</small>' : '') + '</span>');
    } else {
      statsHTML.push('<span class="stat a">ATK ' + fmt(c.atk) + '</span>');
      statsHTML.push(king ? '<span class="stat h">HP ' + fmt(c.hp) + '</span>' : '<span class="stat d">DEF ' + fmt(c.def) + '</span>');
    }
    const ident = [].concat(c.races.map(x => nameOf('races', x)), c.classes.map(x => nameOf('classes', x)), c.elements.map(x => nameOf('elements', x))).join(' · ');
    const md = {}; for (const d of c.move.dirs) md[d] = c.move.steps;
    const grids = '<div class="grids">' + miniGrid(c.attack.dirs, 'atk') + (king ? '' : miniGrid(md, 'mov', 0, c.move.steps)) + '</div>';
    const gifts = c.gifts.length ? '<div class="gifts"><span class="eyebrow">' + (king ? 'Königliche Gaben' : 'Gaben') + '</span>' + c.gifts.map(g => {
      const gi = giftInfo(g.id);
      if (king) return '<div class="gift royal"><b>♛ ' + esc(gi.name) + '</b><span>' + esc(royalText(g)) + '</span><span class="meta">PERMANENT · SOLANGE DER KÖNIG IM SPIEL IST</span></div>';
      const cd = u && u.cd[g.id];
      return '<div class="gift"><b>' + esc(gi.name) + '</b><span>' + esc(gi.text || gi.short || '') + '</span><span class="meta">' + (gi.kind === 'ct' ? 'AKTIVIERBAR · CT ' + gi.ct + (cd ? ' · NOCH ' + cd + ' ZUG' + (cd > 1 ? 'E' : '') + ' ABKLINGZEIT' : u ? ' · BEREIT' : '') : 'PERMANENT · WIRKT AUTOMATISCH') + '</span></div>';
    }).join('') + '</div>' : '<p class="hint">Keine Gaben.</p>';
    let fx = '';
    if (u && s) {
      const chips = [];
      chips.push('<span class="chip">' + (u.owner === (G ? G.view : 0) ? 'Eigene Karte' : 'Gegner') + ' · ' + u.pos + '</span>');
      if (!u.king && u.moved) chips.push('<span class="chip">schon gelaufen</span>');
      for (const at of u.attached || []) chips.push('<span class="chip" data-zoom="' + esc(at.cid) + '">📎 angebracht: ' + esc(s.cards[at.cid].name) + '</span>');
      if (u.flags.durchbruch) chips.push('<span class="chip">Durchbruch aktiv</span>');
      for (const st of ['atk', 'def', 'energy']) { const b = W.royalBonus(s, u.owner, c, st); if (b) chips.push('<span class="chip" style="color:var(--royal)">♛ ' + (st === 'energy' ? '−' + b + ' Energie' : '+' + b + ' ' + st.toUpperCase()) + ' vom König</span>'); }
      fx = '<div class="fx">' + chips.join('') + '</div>' + statusSection(s, u);
    }
    const full = fullURL(c.id), img = artURL(c.id);
    const head = full && !o.noImage
      ? '<button class="fullcard" data-zoom="' + esc(c.id) + '" aria-label="Karte groß ansehen"><img src="' + full + '" alt="Karte ' + esc(c.name) + '" onerror="this.parentNode.classList.add(\'broken\')"><span class="brokenmsg">Kartenbild konnte nicht geladen werden. Unter „Karten &amp; Decks → Kartensammlung → Bilder prüfen“ nachsehen.</span></button>'
      : o.noImage ? '' : '<div class="dimg" data-zoom="' + esc(c.id) + '" style="' + (img ? 'background-image:url(' + img + ')' : 'background-color:' + (ELCOL[c.elements[0]] || '#2a3242')) + '">' + (img ? '' : esc(initials(c.name))) + '</div>';
    return '<div class="detail">' + head
      + '<div style="display:grid;gap:6px;min-width:0"><span class="dname">' + (king ? '♛ ' : '') + esc(c.name) + '</span><div class="row" style="gap:6px"><span class="chip r-' + c.rarity + '">' + esc(RAR(c.rarity)) + '</span><span class="muted" style="font-size:13px">' + esc(ident) + '</span></div><div class="stats">' + statsHTML.join('') + '</div></div>'
      + fx + abilities(c, u, s) + grids + gifts + '</div>';
  }
  function royalText(g) {
    const R = GD.royal.find(x => x.id === g.id); if (!R) return g.id;
    const who = g.scope === 'race' ? 'Eigene ' + nameOf('races', g.target) : g.scope === 'class' ? 'Eigene ' + nameOf('classes', g.target) : g.scope === 'element' ? 'Eigene ' + nameOf('elements', g.target) + '-Monster' : 'Alle eigenen Monster';
    if (R.param.stat === 'energy') return who + ' kosten ' + g.amount + ' Energie weniger (nie unter 0).';
    return who + ' erhalten +' + g.amount + ' ' + R.param.unit + '.';
  }
  function fxName(e, s) {
    const till = e.endTurn ? ' (bis Zugende)' : e.until && s ? ' (endet zu Beginn von Zug ' + e.until.turn + ' von ' + s.players[e.until.p].name + ')' : '';
    return ({ mordlust: 'Mordlust +500 ATK', eisenpanzer: 'Eisenpanzer +300 DEF', entwaffnen: 'Entwaffnet −500 DEF', fesseln: '⛓ gefesselt: kann nicht laufen' }[e.id] || e.id) + till;
  }

  /* ---------------- Kampfmusik: die Songs in zufälliger Reihenfolge im Loop, solange eine Partie läuft ---------------- */
  const MUSIC = (() => {
    const list = (window.WOK_MUSIC || []).slice(), au = new Audio(); au.preload = 'auto';
    let order = [], i = 0, playing = false, failed = 0;
    const vol = () => Math.max(0, Math.min(1, SET.volume === undefined ? 0.55 : +SET.volume));
    const shuffle = () => { order = list.slice(); for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; } if (order.length > 1 && order[0] === au.dataset.last) order.push(order.shift()); i = 0; };
    const next = () => { if (!playing || !list.length) return; if (i >= order.length) shuffle(); const src = order[i++]; au.dataset.last = src; au.src = src; au.volume = vol(); au.play().catch(() => { playing = false; updBtn(); }); };
    au.addEventListener('ended', next);
    au.addEventListener('error', () => { if (++failed > list.length * 2) { playing = false; updBtn(); return; } setTimeout(next, 300); });
    au.addEventListener('playing', () => { failed = 0; });
    function updBtn() { const b = $('#music'); if (!b) return; b.hidden = !list.length; b.textContent = SET.music === false ? '🔇' : '🔊'; b.title = SET.music === false ? 'Musik aus – antippen zum Einschalten' : 'Musik an – antippen zum Ausschalten'; b.setAttribute('aria-label', b.title); }
    return {
      start() { updBtn(); if (SET.music === false || !list.length || playing) return; playing = true; shuffle(); next(); },
      stop() { playing = false; au.pause(); },
      toggle() { SET.music = SET.music === false; LS.set('wok-spiel-setup', SET); if (SET.music === false) this.stop(); else this.start(); updBtn(); },
      setVolume(v) { SET.volume = v; LS.set('wok-spiel-setup', SET); au.volume = vol(); },
      get now() { return playing ? ((window.WOK_MUSIC_TITLES || {})[au.dataset.last] || (window.WOK_MUSIC_TITLE_LIST || [])[list.indexOf(au.dataset.last)] || (/^data:/.test(au.dataset.last) ? '' : au.dataset.last) || '') : ''; },
      get playing() { return playing && !au.paused; }, au, updBtn
    };
  })();

  /* ---------------- Partie ---------------- */
  let G = null; // { s, mode, aiSide, view, sel, gift, memo, busy, deadline }
  function startGame() {
    saveSetup();
    const dA = deckById(SET.deckA), dB = deckById(SET.deckB);
    if (!deckOk(dA) || !deckOk(dB)) { toast('Bitte zwei spielbereite Decks wählen.'); return; }
    const miss = ECON.missing(dA); if (miss.length) { toast('Spielermodus: Dein Deck enthält Karten, die du nicht besitzt (' + miss.slice(0, 3).map(x => x.c.name + ' ' + x.have + '/' + x.need).join(', ') + '). Deck anpassen oder in den Einstellungen den Testmodus wählen.', 8000); return; }
    const cards = {}; for (const id of new Set(dA.cards.concat(dB.cards))) cards[id] = POOL.cards[id];
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    const ai = SET.mode === 'ai';
    const names = ai ? [SET.name1, 'KI · ' + (SET.level === 'leicht' ? 'Leicht' : 'Mittel')] : [SET.name1, SET.name2];
    const r = W.newGame({ cards, decks: [dA.cards, dB.cards], fixedSides: !SET.randomSides, seed, sideNames: names, timer: SET.timer, counterReserve: !!SET.counterReserve });
    G = { s: r.state, mode: SET.mode, level: SET.level, aiSide: ai ? 1 : -1, view: 0, sel: null, gift: null, memo: { seed: seed ^ 0x51 }, busy: false, timer: SET.timer, deadline: 0, handover: false };
    G.view = viewFor(); G.lastActive = -1;
    G.rec = { init: W.clone(r.state), acts: [] }; G.looks = { A: lookOf(dA), B: lookOf(dB) }; G.avatars = [PROF.src('p1'), PROF.src(ai ? 'ai' : 'p2')];
    show('game'); $('#log').innerHTML = ''; $('#rpbar').hidden = true; $('#tutbox').hidden = true;
    MUSIC.start(); MATE.setup();
    afterEvents(r.events);
  }
  function resumeGame() {
    const sv = LS.get('wok-spiel-save'); if (!sv) return;
    G = Object.assign({ sel: null, gift: null, busy: false, deadline: 0, handover: false, memo: { seed: 7 } }, sv); G.lastActive = G.s.active;
    show('game'); $('#rpbar').hidden = true; $('#tutbox').hidden = true; MUSIC.start(); MATE.setup(); afterEvents([]);
  }
  function saveGame() { if (!G || G.mode === 'online') return; if (G.s.result) { LS.del('wok-spiel-save'); return; } if (G.replay || G.tutorial) return; try { localStorage.setItem('wok-spiel-save', JSON.stringify({ s: G.s, mode: G.mode, level: G.level, aiSide: G.aiSide, view: G.view, timer: G.timer, rec: G.rec, looks: G.looks, avatars: G.avatars })); } catch (e) { LS.set('wok-spiel-save', { s: G.s, mode: G.mode, level: G.level, aiSide: G.aiSide, view: G.view, timer: G.timer, looks: G.looks }); } }
  const actor = s => s.pendingDiscard !== null ? s.pendingDiscard : s.phase === 'counter' ? s.counter : s.active;
  const isAI = p => G && G.aiSide === p;
  function viewFor() { return G.mode === 'ai' ? 0 : G.mode === 'online' ? G.view : actor(G.s); }

  function dispatch(a) {
    if (!G || G.s.result) return;
    if (G.mode === 'online' && ONLINE.R && ONLINE.R.kind === 'srv') { const r = W.apply(G.s, a); if (r.error) { toast(r.error); return false; } return ONLINE.srvSend(a); }
    const r = W.apply(G.s, a);
    if (r.error) { toast(r.error); return false; }
    G.s = r.state;
    if (G.rec && !G.replay && !G.tutorial) G.rec.acts.push(a);
    if (G.mode === 'online') ONLINE.send(a);
    afterEvents(r.events);
    return true;
  }
  function afterEvents(events) {
    const s = G.s;
    for (const e of events) {
      if (e.t === 'turn') { G.sel = null; G.gift = null; G.cast = null; G.memo.turn = null; if (G.timer) G.deadline = Date.now() + W.RULES.turnSeconds * 1000; }
      // Zuguhr pausiert während der Konterphase, die eigene 120 Sekunden hat
      if (e.t === 'phase' && e.phase === 'counter' && G.timer) { G.paused = Math.max(0, G.deadline - Date.now()); G.deadline = Date.now() + W.RULES.counterSeconds * 1000; }
      if (e.t === 'phase' && e.phase === 'resolve' && G.timer && G.paused !== undefined) { G.deadline = Date.now() + G.paused; G.paused = undefined; }
    }
    // Spielerwechsel im Zwei-Spieler-Modus: Gerät übergeben
    const who = actor(s);
    if (G.mode === 'hot' && !s.result && who !== G.view) { G.view = who; G.handover = true; }
    render(events);
    saveGame();
    if (G.tutorial) { if (G && G.tutorial) { TUT.scrollTo(); scheduleAI(); } return; }
    if (G.handover) handover();
    else if (s.result) gameOver();
    else if (s.pendingDiscard !== null && !isAI(s.pendingDiscard)) discardPrompt();
    scheduleAI();
  }
  function handover() {
    const P = G.s.players[G.view];
    $('#v-game').style.filter = 'blur(14px)';
    dialog('<span class="eyebrow">Spielerwechsel</span><h2>' + esc(P.name) + ' ist am Zug</h2><p class="muted">Gib das Gerät weiter. Die Hand wird erst nach dem Tippen sichtbar.</p><button class="btn primary" data-act="go">Ich bin ' + esc(P.name) + ' – weiter</button>', () => { G.handover = false; $('#v-game').style.filter = ''; render([]); if (G.s.pendingDiscard !== null) discardPrompt(); if (G.timer) G.deadline = Date.now() + W.RULES.turnSeconds * 1000; });
  }
  function discardPrompt() {
    const p = G.s.pendingDiscard, P = G.s.players[p];
    dialog('<span class="eyebrow">Handlimit</span><h2>Eine Karte ablegen</h2><p class="muted">Höchstens 10 Handkarten. Wähle die Karte, die auf den Ablagestapel geht.</p><div class="hand">' + P.hand.map(h => handCard(h, p, false, 'data-act="d:' + h.iid + '"')).join('') + '</div>',
      act => { if (act.startsWith('d:')) dispatch({ type: 'discard', p, iid: act.slice(2) }); });
  }
  function gameOver() {
    $('#v-game').style.filter = ''; saveReplay();
    const solo = G.mode === 'ai' || G.mode === 'online', meP = G.mode === 'online' ? G.view : 0;
    if (G.mode === 'online') ONLINE.finished();
    if (solo && G.s.result && !G.s.result.draw) FX.banner(G.s.result.winner === meP ? 'Sieg!' : 'Niederlage', G.s.result.winner === meP ? 'win' : 'lose');
    const r = G.s.result;
    const title = r.draw ? 'Unentschieden' : (solo ? (r.winner === meP ? 'Sieg!' : 'Niederlage') : G.s.players[r.winner].name + ' gewinnt');
    dialog('<span class="eyebrow">Partie beendet</span><h2>' + esc(title) + '</h2><p>' + esc(r.reason) + '</p><p class="muted">' + G.s.turn + ' Züge gespielt.</p><div class="row"><button class="btn primary" data-act="again">Neue Partie</button><button class="btn" data-act="board">Brett ansehen</button><button class="btn" data-act="replay">▶ Wiederholung ansehen</button><button class="btn" data-act="menu">Menü</button></div>',
      act => { if (act === 'replay') { const x = replayList()[0]; if (x) setTimeout(() => playReplay(x), 0); return; } if (act === 'again') { if (G && G.mode === 'online') { ONLINE.leave(); G = null; MUSIC.stop(); show('home'); setTimeout(() => ONLINE.open(), 0); } else startGame(); } if (act === 'menu') { if (G && G.mode === 'online') ONLINE.leave(); G = null; MUSIC.stop(); show('home'); } });
  }

  /* ================= Online-Duell =================
   * Zwei Wege, gleiche Spiellogik:
   *  🌐 Internet (ohne Konto): PC-Version und Browser-Datei. Verbindung über drei freie, öffentliche MQTT-Server
   *     gleichzeitig (wer erreichbar ist, trägt) – Code eingeben, fertig. In der Claude-Cloud gesperrt (keine Außenverbindungen).
   *  ☁ Claude-Cloud: beide öffnen dasselbe Artefakt, angemeldet, Gegner im Teilen-Menü mit Bearbeiten-Recht eingeladen.
   * Die Engine ist deterministisch: beide bauen die Partie aus demselben Startwert und spielen dieselben Aktionen nach.
   * Jeder schreibt nur seine eigenen Daten (Deck, Züge) – jede Nachricht ist der vollständige Stand, also verlustsicher. */

  // --- winziger MQTT-3.1.1-Client über WebSocket (QoS 0, retain) ---
  const MQ = (() => {
    const te = new TextEncoder(), td = new TextDecoder();
    const vlen = n => { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; o.push(b); } while (n > 0); return o; };
    const str = s => { const b = te.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
    const pkt = (h, body) => { const u = new Uint8Array(1 + vlen(body.length).length + body.length); const L = vlen(body.length); u[0] = h; u.set(L, 1); u.set(body, 1 + L.length); return u; };
    function connect(url, onMsg, onState) {
      let ws = null, up = false, buf = new Uint8Array(0), pid = 1, ping = 0, retry = 0, closed = false, timer = 0;
      const subs = new Set(), queue = [];
      function open() {
        if (closed) return;
        try { ws = new WebSocket(url, ['mqtt']); } catch (e) { schedule(); return; }
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => { const id = 'wok' + Math.random().toString(36).slice(2, 12); ws.send(pkt(0x10, Uint8Array.from([...str('MQTT'), 4, 2, 0, 40, ...str(id)]))); };
        ws.onmessage = e => { const d = new Uint8Array(e.data), n = new Uint8Array(buf.length + d.length); n.set(buf); n.set(d, buf.length); buf = n; parse(); };
        ws.onclose = ws.onerror = () => { if (ws) { ws.onclose = ws.onerror = ws.onmessage = null; } const was = up; up = false; clearInterval(ping); if (was) onState(false); schedule(); };
      }
      function schedule() { if (closed) return; clearTimeout(timer); timer = setTimeout(open, Math.min(15000, 1000 * Math.pow(2, retry++))); }
      function parse() {
        for (;;) {
          if (buf.length < 2) return;
          let mul = 1, len = 0, i = 1, b;
          do { if (i >= buf.length) return; b = buf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128);
          if (buf.length < i + len) return;
          const h = buf[0], body = buf.subarray(i, i + len); buf = buf.slice(i + len);
          const type = h >> 4;
          if (type === 2) { if (body[1] === 0) { up = true; retry = 0; clearInterval(ping); ping = setInterval(() => { try { ws.send(Uint8Array.from([0xC0, 0])); } catch (e) { } }, 20000); for (const f of subs) sendSub(f); while (queue.length) ws.send(queue.shift()); onState(true); } else { try { ws.close(); } catch (e) { } } }
          else if (type === 3) { const tl = (body[0] << 8) | body[1], topic = td.decode(body.subarray(2, 2 + tl)), qos = (h >> 1) & 3, off = 2 + tl + (qos ? 2 : 0); onMsg(topic, td.decode(body.subarray(off))); }
        }
      }
      function sendSub(f) { const id = pid++ & 0xffff || 1; ws.send(pkt(0x82, Uint8Array.from([id >> 8, id & 255, ...str(f), 0]))); }
      function sub(f) { subs.add(f); if (up) sendSub(f); }
      function pub(topic, text, retain) { const p = pkt(0x30 | (retain ? 1 : 0), Uint8Array.from([...str(topic), ...te.encode(text)])); if (up) { try { ws.send(p); } catch (e) { queue.push(p); } } else if (queue.length < 200) queue.push(p); }
      function close() { closed = true; clearInterval(ping); clearTimeout(timer); try { ws && ws.close(); } catch (e) { } }
      open();
      return { sub, pub, close, get up() { return up; }, url };
    }
    return { connect };
  })();

  // --- Backend „Internet“: drei öffentliche Server parallel, Nachrichten = vollständiger Stand mit Zeitstempel ---
  const NET = (() => {
    const BROKERS = window.WOK_MQTT_BROKERS || ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
    const PRE = 'warofkings/alpha1/';
    let conns = null, cache = {}, mine = {}, listeners = new Set(), stateFns = new Set(), seq = 0;
    function start() {
      if (conns) return;
      conns = BROKERS.map(u => MQ.connect(u, onMsg, up => { if (up) { for (const [t, txt] of Object.entries(mine)) c(u).pub(t, txt, true); } for (const f of stateFns) f(count()); }));
    }
    const c = u => conns.find(x => x.url === u);
    const count = () => conns ? conns.filter(x => x.up).length : 0;
    function onMsg(topic, text) {
      if (!topic.startsWith(PRE)) return; const k = topic.slice(PRE.length);
      if (!text) return; let o; try { o = JSON.parse(text); } catch (e) { return; }
      if (cache[k] && cache[k].t >= o.t) return; cache[k] = o;
      for (const f of listeners) f(k, o.d);
    }
    function pub(k, d) { const o = { t: Date.now() * 1000 + (seq++ % 1000), d }, txt = JSON.stringify(o); cache[k] = o; mine[PRE + k] = txt; start(); for (const x of conns) x.pub(PRE + k, txt, true); for (const f of listeners) f(k, d); }
    function clear(k) { delete mine[PRE + k]; if (conns) for (const x of conns) x.pub(PRE + k, '', true); }
    function sub(prefix) { start(); for (const x of conns) x.sub(PRE + prefix + '#'); }
    function get(k) { return cache[k] ? cache[k].d : null; }
    function wait(k, ms) { return new Promise(res => { if (cache[k]) return res(cache[k].d); const f = (kk, d) => { if (kk === k) { listeners.delete(f); clearTimeout(t); res(d); } }; listeners.add(f); const t = setTimeout(() => { listeners.delete(f); res(null); }, ms); }); }
    function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
    function onState(fn) { stateFns.add(fn); return () => stateFns.delete(fn); }
    function ready(ms) { start(); return new Promise(res => { if (count()) return res(true); const off = onState(n => { if (n) { off(); clearTimeout(t); res(true); } }); const t = setTimeout(() => { off(); res(count() > 0); }, ms); }); }
    return { start, pub, clear, sub, get, wait, on, onState, ready, count, BROKERS };
  })();

  // --- Verbindung zum eigenen Spielserver (server/server.js): der Server prüft und verteilt jeden Zug ---
  const SRV = (() => {
    let ws = null, up = false, want = false, retry = 0, timer = 0, queue = [];
    const fns = new Set(), stFns = new Set();
    function url() {
      if (window.WOK_SERVER_SAME_ORIGIN && /^https?:$/.test(location.protocol)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      const s = (LS.get('wok-spiel-server') || window.WOK_SERVER_URL || '').trim(); if (!s) return '';
      return s.replace(/^http/, 'ws').replace(/\/+$/, '').replace(/\/ws$/, '') + '/ws';
    }
    function webURL() { if (window.WOK_SERVER_SAME_ORIGIN && /^https?:$/.test(location.protocol)) return location.origin + '/'; const u = url(); return u ? u.replace(/^ws/, 'http').replace(/\/ws$/, '/') : ''; }
    function start() {
      want = true; if (ws || !url()) return;
      try { ws = new WebSocket(url()); } catch (e) { ws = null; again(); return; }
      ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', id: netId(), name: SET.name1 || 'Spieler' })); };
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.t === 'hello') { up = true; retry = 0; while (queue.length) ws.send(queue.shift()); for (const f of stFns) f(true); } for (const f of fns) f(m); };
      ws.onclose = ws.onerror = () => { if (!ws) return; ws.onclose = ws.onerror = ws.onmessage = null; ws = null; const was = up; up = false; if (was) for (const f of stFns) f(false); again(); };
    }
    function again() { if (!want) return; clearTimeout(timer); timer = setTimeout(start, Math.min(10000, 600 * Math.pow(2, retry++))); }
    function send(o) { const t = JSON.stringify(o); if (up && ws) { try { ws.send(t); return; } catch (e) { } } if (queue.length < 50) queue.push(t); start(); }
    function ready(ms) { start(); return new Promise(res => { if (up) return res(true); const f = s => { if (s) { stFns.delete(f); clearTimeout(t); res(true); } }; stFns.add(f); const t = setTimeout(() => { stFns.delete(f); res(up); }, ms); }); }
    return { start, send, ready, on: f => { fns.add(f); return () => fns.delete(f); }, onState: f => { stFns.add(f); return () => stFns.delete(f); }, get up() { return up; }, url, webURL };
  })();
  // Offizielle Karten vom Spielserver: beim Start prüfen, ob der Entwickler neue veröffentlicht hat
  async function officialCheck(manual) {
    const base = SRV.webURL(); if (!base || (window.claude && window.claude.use && !IS_PC && !window.WOK_SERVER_SAME_ORIGIN)) { if (manual) toast('Kein Spielserver eingestellt.'); return; }
    let meta; try { meta = await (await fetch(base + 'api/karten?info', { cache: 'no-store' })).json(); } catch (e) { if (manual) toast('Spielserver nicht erreichbar.'); return; }
    if (!meta || meta.none) { if (manual) toast('Auf dem Server sind noch keine offiziellen Karten.'); return; }
    if (!manual && LS.get('wok-spiel-offiziell') === meta.version) return;
    // Erster Besuch ohne eigene Karten: offizielle Karten samt Probe-Deck sofort laden (keine Demo-Decks)
    if (!manual && !ownIds().length) {
      try { const b = await (await fetch(base + 'api/karten', { cache: 'no-store' })).blob(); await importFiles([new File([b], 'offiziell.wokspiel', { type: 'application/zip' })], true); LS.set('wok-spiel-offiziell', meta.version);
        const pd = POOL.decks.find(d => d.origin === 'paket' && deckOk(d)); if (pd) { SET.deckA = pd.id; SET.deckB = pd.id; LS.set('wok-spiel-setup', SET); renderHome(); renderDecks(); } toast('Offizielle Karten geladen: ' + meta.name + '.', 5000); } catch (e) { toast('Offizielle Karten konnten nicht geladen werden: ' + e.message, 7000); }
      return;
    }
    dialog('<span class="eyebrow">Vom Spielserver</span><h2>Offizielle Karten</h2><p><b>' + esc(meta.name) + '</b> (' + (meta.size / 1048576).toFixed(1).replace('.', ',') + ' MB) · veröffentlicht ' + new Date(meta.version).toLocaleString('de-DE') + '</p><p class="muted">Lädt die aktuellen Karten des Entwicklers in deine Sammlung (deine Decks bleiben).</p><div class="row"><button class="btn primary" data-act="load">Jetzt laden</button><button class="btn" data-act="no">Später</button></div>', async act => {
      if (act !== 'load') { if (act === 'no') LS.set('wok-spiel-offiziell', meta.version); return; }
      toast('Lade offizielle Karten …', 4000);
      try { const b = await (await fetch(base + 'api/karten', { cache: 'no-store' })).blob(); await importFiles([new File([b], 'offiziell.wokspiel', { type: 'application/zip' })]); LS.set('wok-spiel-offiziell', meta.version); } catch (e) { toast('Laden fehlgeschlagen: ' + e.message, 7000); }
    });
  }
  function officialPublish() {
    const base = SRV.webURL(); if (!base) { toast('Kein Spielserver eingestellt (Online-Duell → Server-Adresse).', 6000); return; }
    dialog('<span class="eyebrow">Nur für den Entwickler</span><h2>Karten veröffentlichen</h2><p>Wähle ein Spielpaket aus der Kartenwerkstatt (z. B. „Alle Karten“ oder Starter + Packs). Alle Spieler bekommen es beim nächsten Start angeboten.</p><label class="field">Spielpaket<input type="file" id="pub-file" accept=".wokspiel,.zip"></label><label class="field">Name<input type="text" id="pub-name" maxlength="80" value="Offizielle Karten ' + new Date().toLocaleDateString('de-DE') + '"></label><label class="field">Entwickler-Schlüssel<input type="password" id="pub-key" value="' + esc(LS.get('wok-spiel-adminkey') || '') + '"></label><div class="row"><button class="btn primary" data-act="go">Veröffentlichen</button><button class="btn" data-act="no">Abbrechen</button></div>', act => {
      if (act !== 'go') return; const f = $('#pub-file').files[0], key = $('#pub-key').value; if (!f || !key) { toast('Datei und Schlüssel angeben.'); return false; }
      LS.set('wok-spiel-adminkey', key);
      fetch(base + 'api/karten', { method: 'POST', headers: { 'x-wok-key': key, 'x-wok-name': encodeURIComponent($('#pub-name').value || 'Offizielle Karten') }, body: f }).then(r => r.json()).then(j => toast(j.error ? 'Abgelehnt: ' + j.error : 'Veröffentlicht: ' + j.name + '. Alle Spieler bekommen es beim nächsten Start angeboten.', 8000)).catch(e => toast('Fehler: ' + e.message, 7000));
    });
  }
  function netId() { let id = LS.get('wok-spiel-netid'); if (!id) { id = 'n' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8); LS.set('wok-spiel-netid', id); } return id; }

  const ONLINE = (() => {
    const LINK = 'https://war-of-kings.onrender.com/', KEY = 'wok-spiel-online', FRESH = 3 * 3600 * 1000;
    const IN_CLOUD = !IS_PC && !!(window.claude && window.claude.use) && /claude/.test(location.hostname + document.referrer);
    let WHY = '', db = null, me = null, offs = [], R = null, writing = Promise.resolve(), mine = [];
    const myId = () => { let id = LS.get('wok-spiel-netid'); if (!id) { id = 'n' + Math.random().toString(36).slice(2, 12); LS.set('wok-spiel-netid', id); } return id; };
    async function cloudReady() {
      if (db) return true;
      if (!window.claude || !window.claude.use) { WHY = 'keine Claude-Umgebung'; return false; }
      try { const [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); if (!d) { WHY = 'Datenbank nicht freigegeben – meist nicht angemeldet'; return false; } if (!u) { WHY = 'Nutzer unbekannt'; return false; } const id = await u.id(); if (!id) { WHY = 'keine Nutzer-ID – nicht angemeldet'; return false; } db = d; me = id; return true; } catch (e) { WHY = 'Fehler: ' + ((e && (e.code || e.message)) || e); return false; }
    }
    const code = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += A[Math.floor(Math.random() * A.length)]; return c; };
    const plain = v => v == null ? v : JSON.parse(JSON.stringify(v));
    function stopAll() { for (const f of offs) try { f(); } catch (e) { } offs = []; }
    // Für den Spielserver: Originaldaten (der Server bereitet sie selbst auf – beide Spieler bekommen genau seine Fassung)
    function deckDocRaw(d) { const ids = d.cards.slice(), cards = {}; for (const id of new Set(ids)) cards[id] = plain(Object.assign({}, POOL.raw[id] || toRaw(POOL.cards[id]), { id })); return { name: d.name, ids, cards }; }
    function deckDoc(d) {
      const ids = d.cards.slice(), cards = {}, img = {};
      for (const id of new Set(ids)) { cards[id] = POOL.cards[id]; const r = POOL.remote[id]; if (r && (r.full || r.art)) img[id] = { full: r.full || '', art: r.art || '' }; }
      return { name: d.name, ids, cards: plain(cards), img };
    }
    // Kartenbilder fürs Internet: verkleinert als Daten-URL, eine Nachricht je Karte
    async function shrink(url, w) {
      if (!url) return '';
      try { const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); const k = Math.min(1, w / im.naturalWidth), cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); let q = .72, s = cv.toDataURL('image/webp', q); while (s.length > 150000 && q > .3) { q -= .14; s = cv.toDataURL('image/webp', q); } return s.startsWith('data:image/webp') || s.length < 150000 ? s : ''; } catch (e) { return ''; }
    }

    /* ---------- Backends: gleiche Befehle, einmal Claude-Datenbank, einmal Internet ---------- */
    const CLOUD = {
      kind: 'cloud', label: '☁ Claude-Cloud',
      room: c => db.doc('online/' + c),
      async create(c, meta, dd) { await this.room(c).collection('decks').doc('p0').set(dd); await this.room(c).set(meta); },
      async get(c) { const s = await this.room(c).get(); return s.exists ? plain(s.data()) : null; },
      watch(c, fn) { return this.room(c).onSnapshot(s => fn(plain(s.data()))); },
      async patch(c, p) { await this.room(c).update(p); },
      async join(c, info, dd) {
        const l = await this.room(c).acquire({ holder: me, ttlMs: 8000 }); if (!l.acquired) throw new Error('Gerade tritt schon jemand bei.');
        const again = await this.get(c); if (again.guestBy) throw new Error('Der Raum ist schon vergeben.');
        await this.room(c).collection('decks').doc('p1').set(dd); await this.room(c).update(Object.assign({ state: 'joined' }, info));
      },
      async load(c) { const g = p => this.room(c).collection(p.split('/')[0]).doc(p.split('/')[1]).get().then(s => s.exists ? plain(s.data()) : null); return Promise.all(['decks/p0', 'decks/p1', 'moves/p0', 'moves/p1'].map(g)); },
      watchMoves(c, fn) { return this.room(c).collection('moves').onSnapshot(q => { const l = []; for (const d of q.docs) l.push(...plain((d.data() || {}).acts || [])); fn(l); }, () => toast('Verbindung zum Raum unterbrochen – Seite neu laden setzt fort.', 8000)); },
      sendMoves(c, slot, acts) { return this.room(c).collection('moves').doc('p' + slot).set({ acts, at: Date.now() }); },
      lobby(fn) { return db.collection('online').where('state', '==', 'open').limit(50).onSnapshot(q => fn(q.docs.map(d => Object.assign({ code: d.id }, plain(d.data())))), () => fn(null)); },
      async images() { }
    };
    const INET = {
      kind: 'net', label: '🌐 Internet',
      async create(c, meta, dd) { NET.sub(c + '/'); NET.pub(c + '/deck0', dd); NET.pub(c + '/meta', meta); },
      async get(c) { NET.sub(c + '/'); return NET.wait(c + '/meta', 6000); },
      watch(c, fn) { NET.sub(c + '/'); const g = NET.get(c + '/meta'); if (g) setTimeout(() => fn(g), 0); return NET.on((k, d) => { if (k === c + '/meta') fn(d); if (k === c + '/join' && R && R.me === 0 && R.code === c) fn(Object.assign({}, NET.get(c + '/meta') || {}, { _join: d })); }); },
      async patch(c, p) { NET.pub(c + '/meta', Object.assign({}, NET.get(c + '/meta') || {}, p)); },
      async join(c, info, dd) { NET.pub(c + '/deck1', dd); NET.pub(c + '/join', info); },
      async load(c) { NET.sub(c + '/'); const [d0, d1] = await Promise.all([NET.wait(c + '/deck0', 8000), NET.wait(c + '/deck1', 8000)]); await new Promise(r => setTimeout(r, 400)); return [d0, d1, NET.get(c + '/mv0'), NET.get(c + '/mv1')]; },
      watchMoves(c, fn) { return NET.on((k, d) => { if (k === c + '/mv0' || k === c + '/mv1') fn([].concat((NET.get(c + '/mv0') || {}).acts || [], (NET.get(c + '/mv1') || {}).acts || [])); }); },
      sendMoves(c, slot, acts) { NET.pub(c + '/mv' + slot, { acts, at: Date.now() }); return Promise.resolve(); },
      lobby: null,
      // eigene Kartenbilder senden (verkleinert), fremde übernehmen
      async images(c, d) {
        const off = NET.on((k, v) => { const m = k.match(/^[^/]+\/img\/(.+)$/); if (!m || !v) return; const id = m[1]; if (v.full && !fullURL(id)) urls.full[id] = v.full; if (v.art && !artURL(id)) urls.art[id] = v.art; if (G) render([]); });
        offs.push(off);
        for (const id of new Set(d.cards)) { const f = fullURL(id), a = artURL(id); if (!f && !a) continue; const v = { full: await shrink(f, 420), art: await shrink(a, 200) }; if (v.full || v.art) NET.pub(c + '/img/' + id, v); }
      }
    };
    let B = null;

    function connBadge(n) { const el = $('#onl-net'); if (!el) return; el.className = 'onl-net ' + (n ? 'ok' : 'bad'); el.textContent = n ? '● verbunden über ' + n + ' von ' + NET.BROKERS.length + ' Servern' : '○ verbinde …'; }
    async function open() {
      const sv = LS.get(KEY), cloudOk = await cloudReady();
      const netOk = !IN_CLOUD;
      if (netOk) { NET.start(); offs.push(NET.onState(connBadge)); }
      const tab = cloudOk && !netOk ? 'cloud' : 'net';
      const srvOk = !IN_CLOUD && !!SRV.url(); if (srvOk) { srvListen(); SRV.start(); }
      dialog('<span class="eyebrow">Über das Internet</span><h2>⚔ Online-Duell</h2>'
        + (sv ? '<div class="box onl-resume"><b>Laufende Partie</b> · Raum ' + esc(sv.code) + '<div class="row"><button class="btn primary" data-act="resume">▶ Fortsetzen</button><button class="btn small" data-act="forget">Vergessen</button></div></div>' : '')
        + '<p>Dein Deck: <b>' + esc((deckById(SET.deckA) || {}).name || '–') + '</b> <button class="btn small" data-act="deck">Anderes Deck …</button></p>'
        + (srvOk ? '<div class="onl-way main"><b>🌐 Online über den Spielserver</b><span id="onl-srv" class="onl-net ' + (SRV.up ? 'ok">● mit dem Spielserver verbunden' : 'bad">○ verbinde mit dem Spielserver …') + '</span>'
          + '<div class="row"><button class="btn primary" data-act="host:srv">+ Raum eröffnen &amp; Link schicken</button></div>'
          + '<div class="row"><input type="text" id="onl-scode" maxlength="6" placeholder="oder Code eingeben" style="text-transform:uppercase;flex:1;min-width:0" autocomplete="off"><button class="btn" data-act="code:srv">Beitreten</button></div>'
          + '<p class="muted" style="font-size:12.5px">Kein Konto nötig. Der Server prüft jeden Zug – beide sehen immer denselben Stand.</p></div>' : '')
        + (!IN_CLOUD && !srvOk ? '<div class="onl-way"><b>🌐 Spielserver</b><p class="muted" style="font-size:13px">Adresse des Spielservers (bekommst du vom Entwickler), z. B. https://war-of-kings.onrender.com</p><div class="row"><input type="text" id="onl-surl" placeholder="https://…" style="flex:1;min-width:0"><button class="btn" data-act="srvurl">Speichern</button></div></div>' : '')
        + (netOk ? '<details class="onl-way"' + (srvOk ? '' : ' open') + '><summary><b>🛟 Notfall-Weg ohne Server</b> <span id="onl-net" class="onl-net">○ verbinde …</span></summary><span id="onl-net" class="onl-net">○ verbinde …</span>'
          + '<div class="row"><button class="btn primary" data-act="host:net">+ Raum eröffnen</button></div>'
          + '<div class="row"><input type="text" id="onl-code" maxlength="6" placeholder="Code vom Gegner, z. B. K7M2QX" style="text-transform:uppercase;flex:1;min-width:0" autocomplete="off"><button class="btn" data-act="code:net">Beitreten</button></div>'
          + '<p class="muted" style="font-size:12.5px">Beide brauchen die <b>PC-Version</b> oder die <b>Browser-Datei</b> des Probe-Spiels (gleiche Version). Einer eröffnet, schickt den 6-stelligen Code, der andere gibt ihn hier ein. Kein Konto, keine Einladung nötig.</p></details>' : '')
        + (cloudOk ? '<div class="onl-way"><b>☁ Claude-Cloud</b>' + (IN_CLOUD ? '' : ' <small class="muted">(nur wenn beide das Cloud-Probe-Spiel geöffnet haben)</small>')
          + '<div class="row"><button class="btn ' + (tab === 'cloud' ? 'primary' : '') + '" data-act="host:cloud">+ Raum eröffnen</button></div><h3 style="margin:10px 0 6px;font-size:15px">Offene Räume</h3><div id="onl-list" class="onl-list"><p class="muted">Suche …</p></div>'
          + '<div class="row" style="margin-top:8px"><input type="text" id="onl-ccode" maxlength="6" placeholder="Code" style="text-transform:uppercase;flex:1;min-width:0"><button class="btn" data-act="code:cloud">Beitreten</button></div>'
          + '<p class="muted" style="font-size:12.5px">Nur mit Claude-Konto: Lade deinen Gegner im <b>Teilen-Menü</b> dieses Probe-Spiels per E-Mail ein und gib ihm <b>Bearbeiten</b>. Mit „Jeder mit dem Link“ allein klappt es nicht.</p></div>'
          : IN_CLOUD ? '<div class="onl-way bad"><b>☁ Claude-Cloud: keine Verbindung</b><p>So klappt es (kein bezahltes Abo nötig):</p><ol class="onl-steps"><li>Ein kostenloses Claude-Konto mit <b>genau der E-Mail-Adresse</b>, an die die Einladung ging.</li><li>Den Link in einem <b>normalen Browser</b> öffnen (Safari, Chrome) – nicht im Browser von WhatsApp, Instagram usw.</li><li>Dort auf claude.ai mit dieser Adresse <b>angemeldet</b> sein, dann die Seite neu laden.</li></ol><p class="muted" style="font-size:12px">Grund: ' + esc(WHY || 'unbekannt') + '</p><p class="muted">Einfacher: beide nehmen die PC-Version oder die Browser-Datei und spielen über <b>🌐 Internet</b> mit Code.</p></div>' : '')
        + '<div class="row"><button class="btn" data-act="close">Schließen</button></div>', act => {
          if (act === 'close') { stopAll(); return; }
          if (act === 'deck') { stopAll(); show('home'); openSetup('ai'); return; }
          if (act === 'forget') { LS.del(KEY); stopAll(); setTimeout(open, 0); return; }
          if (act === 'resume') { stopAll(); resume(sv); return; }
          const [k, w] = (act || '').split(':');
          if (act === 'srvurl') { const u = ($('#onl-surl').value || '').trim(); if (!/^https?:\/\/[^\s]+$/.test(u)) { toast('Bitte die Adresse mit https:// eingeben.'); return false; } LS.set('wok-spiel-server', u); stopAll(); setTimeout(open, 0); return; }
          if (k === 'host' && w === 'srv') { stopAll(); srvHost(); return; }
          if (k === 'code' && w === 'srv') { const c = ($('#onl-scode').value || '').trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(c)) { toast('Der Code hat 6 Zeichen.'); return false; } stopAll(); srvJoin(c); return; }
          if (k === 'host') { B = w === 'cloud' ? CLOUD : INET; stopAll(); host(); return; }
          if (k === 'code') { const c = ((w === 'cloud' ? $('#onl-ccode') : $('#onl-code')).value || '').trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(c)) { toast('Der Code hat 6 Zeichen.'); return false; } B = w === 'cloud' ? CLOUD : INET; stopAll(); join(c); return; }
          if (k === 'join') { B = CLOUD; stopAll(); join(w); return; }
        });
      if (netOk) connBadge(NET.count());
      if (cloudOk) offs.push(CLOUD.lobby(list => {
        const el = $('#onl-list'); if (!el) return;
        if (!list) { el.innerHTML = '<p class="muted">Räume konnten nicht geladen werden.</p>'; return; }
        list = list.filter(r => Date.now() - (r.created || 0) < FRESH).sort((a, b) => b.created - a.created);
        el.innerHTML = list.length ? list.map(r => '<button class="onl-room" data-act="join:' + esc(r.code) + '"><b>' + esc(r.hostName || 'Spieler') + '</b><span>' + esc(r.deckName || '') + '</span><small>' + (r.hostBy === me ? 'dein Raum' : 'Raum ' + esc(r.code)) + '</small></button>').join('') : '<p class="muted">Gerade ist kein Raum offen.</p>';
      }));
    }
    function myDeck() { const d = deckById(SET.deckA); if (!deckOk(d)) { toast('Wähle zuerst ein spielbereites Deck (Hauptmenü → Gegen die KI → Deck).', 6000); return null; } return d; }
    const who = () => B.kind === 'cloud' ? me : myId();
    async function host() {
      const d = myDeck(); if (!d) return;
      if (B.kind === 'net' && !(await NET.ready(8000))) { toast('Keiner der Internet-Server ist erreichbar. Prüfe die Internetverbindung (oder Firewall) und versuche es nochmal.', 9000); return; }
      const c = code(), dd = deckDoc(d);
      if (JSON.stringify(dd).length > 240000) { toast('Das Deck ist zu groß für die Übertragung.'); return; }
      try { await B.create(c, { v: 1, state: 'open', created: Date.now(), hostBy: who(), hostName: SET.name1 || 'Spieler 1', deckName: d.name, guestBy: '', guestName: '', seed: 0 }, dd); }
      catch (e) { toast('Raum konnte nicht angelegt werden: ' + (e && e.code === 'not_permitted' ? 'keine Schreibrechte.' : (e && e.message) || e), 7000); return; }
      R = { code: c, me: 0, kind: B.kind };
      const inv = B.kind === 'net' ? 'Komm zu einem Duell in War of Kings! Öffne das Probe-Spiel (PC-Version oder Browser-Datei) → „Online-Duell“ → 🌐 Internet → Code ' + c + ' eingeben.' : 'Komm zu einem Duell in War of Kings! Öffne ' + LINK + ' → „Online-Duell“ → Raum ' + c + ' beitreten.';
      dialog('<span class="eyebrow">Raum eröffnet · ' + B.label + '</span><h2>Warte auf Gegner …</h2><p class="onl-code">' + c + '</p><p>Schick deinem Gegner diesen Code.</p><p><textarea id="onl-inv" readonly rows="3" style="width:100%">' + esc(inv) + '</textarea></p><div class="row"><button class="btn primary" data-act="copy">📋 Einladung kopieren</button><button class="btn danger" data-act="cancel">Raum schließen</button></div><p class="muted" id="onl-wait">Noch niemand da.</p>', act => {
        if (act === 'copy') { try { navigator.clipboard.writeText(inv).then(() => toast('Einladung kopiert.'), () => { $('#onl-inv').select(); toast('Text markiert – jetzt kopieren.'); }); } catch (e) { $('#onl-inv').select(); } return false; }
        if (act === 'cancel') { stopAll(); B.patch(c, { state: 'closed' }).catch(() => {}); R = null; toast('Raum geschlossen.'); return; }
        return false;
      });
      let starting = false;
      offs.push(B.watch(c, async r => {
        if (!r || !R || R.code !== c) return;
        const j = r._join; if (j && !r.guestBy && !starting) { starting = true; const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0; const w = $('#onl-wait'); if (w) w.textContent = (j.guestName || 'Gegner') + ' ist da – die Partie startet …'; await B.patch(c, { guestBy: j.guestBy, guestName: j.guestName, seed, state: 'running', started: Date.now() }); return; }
        if (r.state === 'joined' && r.guestBy && !r.seed && !starting) { starting = true; const w = $('#onl-wait'); if (w) w.textContent = (r.guestName || 'Gegner') + ' ist da – die Partie startet …'; const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0; try { await B.patch(c, { seed, state: 'running', started: Date.now() }); } catch (e) { toast('Start fehlgeschlagen: ' + ((e && e.message) || e)); } }
        if (r.state === 'running' && r.seed && !G) { stopAll(); begin({ code: c, me: 0, kind: B.kind }, r); }
      }));
    }
    async function join(c) {
      const d = myDeck(); if (!d) return;
      if (B.kind === 'net' && !(await NET.ready(8000))) { toast('Keiner der Internet-Server ist erreichbar. Prüfe die Internetverbindung und versuche es nochmal.', 9000); return; }
      toast('Suche Raum ' + c + ' …', 3000);
      let r; try { r = await B.get(c); } catch (e) { r = null; }
      if (!r || r.state === 'closed') { toast('Raum ' + c + ' nicht gefunden. Code prüfen – und ob der Gastgeber den Raum noch offen hat.', 8000); return; }
      if (r.state !== 'open') { if (r.guestBy === who() || r.hostBy === who()) { resume({ code: c, me: r.hostBy === who() ? 0 : 1, kind: B.kind }); return; } toast('In diesem Raum wird schon gespielt.'); return; }
      if (r.hostBy === who()) { toast('Das ist dein eigener Raum – der Gegner muss beitreten.'); return; }
      try { await B.join(c, { guestBy: who(), guestName: SET.name1 || 'Spieler 2' }, deckDoc(d)); }
      catch (e) { toast('Beitritt fehlgeschlagen: ' + (e && e.code === 'not_permitted' ? 'keine Schreibrechte – der Gastgeber muss dich im Teilen-Menü per E-Mail einladen und „Bearbeiten“ erlauben.' : (e && e.message) || e), 9000); return; }
      R = { code: c, me: 1, kind: B.kind };
      dialog('<h2>Beigetreten</h2><p>Warte auf den Start durch ' + esc(r.hostName || 'den Gastgeber') + ' …</p><div class="row"><button class="btn" data-act="close">Abbrechen</button></div>', act => { if (act === 'close') { stopAll(); R = null; } });
      offs.push(B.watch(c, x => { if (x && x.state === 'running' && x.seed && x.guestBy === who() && !G) { stopAll(); begin({ code: c, me: 1, kind: B.kind }, x); } else if (x && x.state === 'running' && x.guestBy && x.guestBy !== who()) { stopAll(); closeDialog(); toast('Jemand anderes war schneller – der Raum ist voll.'); } if (x && x.state === 'closed') { stopAll(); closeDialog(); toast('Der Gastgeber hat den Raum geschlossen.'); } }));
    }
    /* ---------- Spielserver (serverautoritativ) ---------- */
    let srvOff = null, srvWait = null;
    function srvListen() {
      if (srvOff) return;
      srvOff = SRV.on(m => {
        if (m.t === 'created') { if (srvWait) srvWait(m); return; }
        if (m.t === 'start') { srvStart(m); return; }
        if (m.t === 'act') { srvAct(m); return; }
        if (m.t === 'reject') { if (R && R.kind === 'srv') { R.pending = false; if (m.error !== 'veraltet') toast(m.error, 5000); else SRV.send({ t: 'resume', code: R.code }); } return; }
        if (m.t === 'img') { if (m.full && !fullURL(m.id)) urls.full[m.id] = m.full; if (m.art && !artURL(m.id)) urls.art[m.id] = m.art; if (G) render([]); return; }
        if (m.t === 'peer') { if (G && G.online === R) { const el = $('#netdot'); if (el) { el.hidden = false; el.className = m.online ? 'ok' : 'bad'; el.textContent = m.online ? '● Gegner online' : '○ Gegner getrennt'; } if (!m.online && !G.s.result) toast('Dein Gegner ist gerade nicht verbunden – die Partie wartet auf ihn.', 5000); } return; }
        if (m.t === 'error') { if (srvWait) srvWait(null); toast(m.msg, 8000); if (m.code === 'no_room' && LS.get(KEY) && LS.get(KEY).kind === 'srv') LS.del(KEY); return; }
      });
      SRV.onState(on => { const el = $('#onl-srv'); if (el) { el.className = 'onl-net ' + (on ? 'ok' : 'bad'); el.textContent = on ? '● mit dem Spielserver verbunden' : '○ verbinde mit dem Spielserver …'; } if (on && R && R.kind === 'srv') SRV.send({ t: 'resume', code: R.code }); });
    }
    async function srvHost() {
      const d = myDeck(); if (!d) return;
      srvListen(); toast('Verbinde mit dem Spielserver …', 3000);
      if (!(await SRV.ready(70000))) { toast('Der Spielserver antwortet nicht. Internet prüfen – beim kostenlosen Server kann das erste Aufwachen bis zu einer Minute dauern.', 9000); return; }
      const m = await new Promise(res => { srvWait = res; SRV.send({ t: 'create', deck: deckDocRaw(d) }); setTimeout(() => res(null), 15000); }); srvWait = null;
      if (!m) return;
      R = { code: m.code, me: 0, kind: 'srv', n: 0 }; LS.set(KEY, { code: m.code, me: 0, kind: 'srv' });
      const link = SRV.webURL() + '?raum=' + m.code, inv = 'Komm zu einem Duell in War of Kings! Einfach antippen: ' + link;
      dialog('<span class="eyebrow">Raum eröffnet · Spielserver</span><h2>Warte auf Gegner …</h2><p class="onl-code">' + m.code + '</p><p>Schick deinem Gegner diesen <b>Einladungslink</b> – er öffnet ihn im Browser und landet direkt in deinem Raum:</p><p><input type="text" id="onl-link" readonly value="' + esc(link) + '" style="width:100%" onclick="this.select()"></p><div class="row"><button class="btn primary" data-act="copy">📋 Einladung kopieren</button>' + (navigator.share ? '<button class="btn" data-act="share">↗ Teilen</button>' : '') + '<button class="btn danger" data-act="cancel">Raum schließen</button></div><p class="muted">In der PC-Version kann der Gegner auch den Code eingeben.</p>', act => {
        if (act === 'copy') { try { navigator.clipboard.writeText(inv).then(() => toast('Einladung kopiert.'), () => { $('#onl-link').select(); toast('Link markiert – jetzt kopieren.'); }); } catch (e) { $('#onl-link').select(); } return false; }
        if (act === 'share') { navigator.share({ title: 'War of Kings – Duell', text: 'Komm zu einem Duell in War of Kings!', url: link }).catch(() => {}); return false; }
        if (act === 'cancel') { SRV.send({ t: 'leave', code: m.code }); LS.del(KEY); R = null; toast('Raum geschlossen.'); return; }
        return false;
      });
    }
    async function srvJoin(code) {
      const d = myDeck(); if (!d) return;
      srvListen(); toast('Verbinde mit dem Spielserver …', 3000);
      if (!(await SRV.ready(70000))) { toast('Der Spielserver antwortet nicht. Internet prüfen – beim kostenlosen Server kann das erste Aufwachen bis zu einer Minute dauern.', 9000); return; }
      R = { code, me: 1, kind: 'srv', n: 0, joining: true };
      SRV.send({ t: 'join', code, deck: deckDocRaw(d) });
    }
    async function srvResume(sv) { srvListen(); R = { code: sv.code, me: sv.me, kind: 'srv', n: 0 }; if (!(await SRV.ready(70000))) { toast('Der Spielserver antwortet nicht.', 7000); return; } SRV.send({ t: 'resume', code: sv.code }); }
    // Start oder Wiederaufnahme: Partie aus den Server-Daten bauen und alle Züge des Servers nachspielen
    function srvStart(m) {
      closeDialog();
      const same = G && G.online && G.online.kind === 'srv' && G.online.code === m.code;
      const res = W.newGame({ cards: Object.assign({}, m.decks[1].cards, m.decks[0].cards), decks: [m.decks[0].ids, m.decks[1].ids], fixedSides: true, seed: m.seed, sideNames: m.names, timer: false, counterReserve: false });
      let s = res.state; for (const a of m.acts) { const r = W.apply(s, a); if (r.error) { toast('Abweichung beim Nachspielen: ' + r.error, 8000); break; } s = r.state; }
      for (const [id, im] of Object.entries(m.imgs || {})) { if (im.full && !fullURL(id)) urls.full[id] = im.full; if (im.art && !artURL(id)) urls.art[id] = im.art; }
      R = { code: m.code, me: m.me, kind: 'srv', n: m.acts.length };
      LS.set(KEY, { code: m.code, me: m.me, kind: 'srv' });
      if (same) { G.s = s; G.online = R; G.rec.acts = m.acts.slice(); render([]); if (s.result) gameOver(); return; }
      G = { s, mode: 'online', level: '', aiSide: -1, view: m.me, sel: null, gift: null, memo: { seed: 7 }, busy: false, timer: false, deadline: 0, handover: false, online: R };
      G.lastActive = -1; G.rec = { init: W.clone(res.state), acts: m.acts.slice() }; G.looks = { A: lookOf(m.me === 0 ? deckById(SET.deckA) : null), B: lookOf(m.me === 1 ? deckById(SET.deckA) : null) }; G.avatars = [PROF.src(m.me === 0 ? 'p1' : 'p2'), PROF.src(m.me === 0 ? 'p2' : 'p1')];
      show('game'); $('#log').innerHTML = ''; $('#rpbar').hidden = true; $('#tutbox').hidden = true; MUSIC.start(); MATE.setup();
      afterEvents(m.acts.length ? [] : res.events);
      const nd = $('#netdot'); if (nd) { nd.hidden = false; nd.className = 'ok'; nd.textContent = '● online'; }
      if (s.result) { gameOver(); return; }
      toast('Online-Partie: ' + m.names[0] + ' gegen ' + m.names[1] + '. Du spielst ' + m.names[m.me] + '.', 5000);
      // eigene Kartenbilder (verkleinert) an den Gegner, damit er dein Deck mit Bildern sieht
      (async () => { for (const id of new Set(m.decks[m.me].ids)) { const f = fullURL(id), a = artURL(id); if (!f && !a) continue; if (/^data:/.test(f || '') && !POOL.cards[id]) continue; const full = await shrink(f, 420), art = await shrink(a, 200); if (full || art) SRV.send({ t: 'img', code: m.code, id, full, art }); } })();
    }
    function srvAct(m) {
      if (!G || !R || R.kind !== 'srv' || G.online !== R) return;
      if (m.n < R.n) return; // schon angewendet
      if (m.n > R.n) { SRV.send({ t: 'resume', code: R.code }); return; } // Lücke → vollständig abgleichen
      const r = W.apply(G.s, m.a); if (r.error) { SRV.send({ t: 'resume', code: R.code }); return; }
      G.s = r.state; G.rec.acts.push(m.a); R.n++; if (m.p === R.me) R.pending = false;
      afterEvents(r.events);
    }
    function srvSend(a) { if (!R || R.kind !== 'srv') return false; if (R.pending && a.type !== 'concede') { toast('Einen Moment – der letzte Zug ist unterwegs.'); return false; } R.pending = a.type !== 'concede'; SRV.send({ t: 'act', code: R.code, n: R.n, a }); setTimeout(() => { if (R && R.pending) { R.pending = false; SRV.send({ t: 'resume', code: R.code }); } }, 8000); return true; }
    // Einladungslink ?raum=CODE: direkt in den Raum
    function openLink(code) {
      code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (code.length !== 6) return;
      const sv = LS.get(KEY); if (sv && sv.code === code && sv.kind === 'srv') { srvResume(sv); return; }
      const d = deckById(SET.deckA);
      dialog('<span class="eyebrow">Einladung</span><h2>⚔ Duell in Raum ' + esc(code) + '</h2><p>Du wurdest zu einem Online-Duell eingeladen.</p><label class="field">Dein Name<input type="text" id="lk-name" maxlength="30" value="' + esc(SET.name1 || '') + '"></label><p>Dein Deck: <b>' + esc(d ? d.name : '–') + '</b>' + (deckOk(d) ? ' ✓' : ' – <span class="bad">nicht spielbereit</span>') + '</p><div class="row"><button class="btn primary" data-act="go" ' + (deckOk(d) ? '' : 'disabled') + '>Beitreten</button><button class="btn" data-act="deck">Deck wählen …</button><button class="btn" data-act="no">Abbrechen</button></div>', act => {
        if (act === 'go') { const n = ($('#lk-name').value || '').trim().slice(0, 30); if (n) { SET.name1 = n; LS.set('wok-spiel-setup', SET); } closeDialog(); srvJoin(code); return false; }
        if (act === 'deck') { LS.set('wok-spiel-pendinglink', code); show('home'); openSetup('ai'); toast('Deck wählen – danach den Einladungslink nochmal öffnen oder „Online-Duell“ → Code ' + code + '.', 8000); }
      });
    }
    async function resume(sv) {
      if (sv.kind === 'srv') { srvResume(sv); return; }
      B = sv.kind === 'net' ? INET : CLOUD;
      if (B === CLOUD && !(await cloudReady())) { toast('Keine Verbindung zur Claude-Cloud.'); return; }
      if (B === INET && !(await NET.ready(8000))) { toast('Keiner der Internet-Server ist erreichbar.'); return; }
      let r; try { r = await B.get(sv.code); } catch (e) { r = null; }
      if (!r || !r.seed) { LS.del(KEY); toast('Diese Partie gibt es nicht mehr.'); return; }
      begin(sv, r);
    }
    // Partie aus Startwert + beiden Decks bauen, alle bisherigen Züge nachspielen, dann live mitlesen
    async function begin(sv, r) {
      closeDialog(); toast('Lade Partie …', 3000);
      let d0, d1, m0, m1;
      try { [d0, d1, m0, m1] = await B.load(sv.code); } catch (e) { toast('Partie konnte nicht geladen werden.'); return; }
      if (!d0 || !d1) { toast('Die Decks fehlen im Raum – bitte nochmal versuchen.', 7000); return; }
      for (const dd of [d0, d1]) for (const [id, im] of Object.entries(dd.img || {})) { if (B.kind !== 'cloud') break; if (!fullURL(id) && im.full) urls.full[id] = '/_blob/' + im.full; if (!artURL(id) && im.art) urls.art[id] = '/_blob/' + im.art; }
      const cards = Object.assign({}, d1.cards, d0.cards);
      const res = W.newGame({ cards, decks: [d0.ids, d1.ids], fixedSides: true, seed: r.seed, sideNames: [r.hostName || 'Spieler 1', r.guestName || 'Spieler 2'], timer: false, counterReserve: false });
      R = { code: sv.code, me: sv.me, kind: B.kind, n: 0 };
      mine = ((sv.me === 0 ? m0 : m1) || {}).acts || [];
      G = { s: res.state, mode: 'online', level: '', aiSide: -1, view: sv.me, sel: null, gift: null, memo: { seed: 7 }, busy: false, timer: false, deadline: 0, handover: false, online: R };
      G.lastActive = -1; G.rec = { init: W.clone(res.state), acts: [] }; G.looks = { A: lookOf(sv.me === 0 ? deckById(SET.deckA) : null), B: lookOf(sv.me === 1 ? deckById(SET.deckA) : null) }; G.avatars = [PROF.src(sv.me === 0 ? 'p1' : 'p2'), PROF.src(sv.me === 0 ? 'p2' : 'p1')];
      LS.set(KEY, { code: sv.code, me: sv.me, kind: B.kind });
      show('game'); $('#log').innerHTML = ''; $('#rpbar').hidden = true; $('#tutbox').hidden = true; MUSIC.start(); MATE.setup();
      catchUp([].concat((m0 || {}).acts || [], (m1 || {}).acts || []), true);
      afterEvents(res.events);
      offs.push(B.watchMoves(sv.code, list => catchUp(list, false)));
      offs.push(B.watch(sv.code, x => { if (x && x.state === 'closed' && G && G.online === R && !G.s.result) toast('Der Raum wurde geschlossen.'); }));
      if (B.kind === 'net') { B.images(sv.code, deckById(SET.deckA) || { cards: sv.me === 0 ? d0.ids : d1.ids }); offs.push(NET.onState(n => { const el = $('#netdot'); if (el) { el.hidden = false; el.className = n ? 'ok' : 'bad'; el.title = n ? 'Online verbunden' : 'Verbindung weg – verbinde neu …'; } })); }
      toast('Online-Partie gegen ' + (sv.me === 0 ? r.guestName : r.hostName) + '. Du spielst ' + G.s.players[sv.me].name + '.', 5000);
    }
    // Aktionen in globaler Reihenfolge anwenden (n = laufende Nummer); Aufgabe gilt sofort
    function catchUp(list, quiet) {
      if (!G || !R || G.online !== R) return;
      const by = {}; let conc = null; for (const x of list) { if (x.a && x.a.type === 'concede') conc = x; else by[x.n] = x; }
      // eigene, schon gesendete Züge (z. B. nach dem Neuladen später angekommen) nie verlieren
      const have = new Set(mine.map(x => x.n)); for (const x of list) if (x.p === R.me && !have.has(x.n)) { mine.push(x); have.add(x.n); } mine.sort((a, b) => a.n - b.n);
      let evs = [];
      while (by[R.n] && !G.s.result) { const x = by[R.n], r = W.apply(G.s, x.a); if (r.error) { toast('Abweichung bei Zug ' + R.n + ': ' + r.error + ' – bitte beide neu laden.', 9000); break; } G.s = r.state; G.rec.acts.push(x.a); R.n++; evs = evs.concat(r.events); }
      if (conc && !G.s.result) { const r = W.apply(G.s, conc.a); if (!r.error) { G.s = r.state; evs = evs.concat(r.events); } }
      if (evs.length && !quiet) afterEvents(evs);
    }
    // eigener Zug: lokal schon angewendet, jetzt senden (immer der vollständige Stand)
    function send(a) {
      if (!R) return;
      if (R.kind === 'srv') return srvSend(a);
      if (a.type === 'concede') mine.push({ n: -1, a, p: R.me }); else mine.push({ n: R.n++, a, p: R.me });
      const acts = mine.slice(), c = R.code, slot = R.me;
      writing = writing.then(() => B.sendMoves(c, slot, acts)).catch(e => toast('Zug konnte nicht gesendet werden: ' + ((e && e.message) || e) + ' – Seite neu laden setzt fort.', 9000));
    }
    function finished() { if (!R) return; LS.del(KEY); if (R.me === 0 && B) B.patch(R.code, { state: 'done', ended: Date.now() }).catch(() => {}); }
    function leave() { stopAll(); if (R && R.kind === 'srv') SRV.send({ t: 'leave', code: R.code }); R = null; }
    return { open, send, finished, leave, openLink, srvSend, get R() { return R; } };
  })();

  /* KI-Züge sichtbar nacheinander */
  let aiTimer = 0;
  function scheduleAI() {
    clearTimeout(aiTimer);
    if (!G || G.s.result || G.handover) return;
    const p = actor(G.s); if (!isAI(p)) return;
    aiTimer = setTimeout(() => {
      if (!G || G.s.result) return;
      const a = G.tutorial ? TUT.ai(p) : AI.decide(G.s, p, G.level, G.memo);
      if (!a) return;
      const ok = dispatch(a);
      if (ok === false) dispatch({ type: 'endPhase', p });
    }, aiDelay());
  }
  function aiDelay() { const ph = G.s.phase; return ph === 'battle' || ph === 'move' ? 650 : 480; }

  /* ---------------- Bedienung auf dem Brett ---------------- */
  function myTurn() { const s = G.s, p = actor(s); if (G.replay) return false; return !s.result && !isAI(p) && p === G.view && !G.handover; }
  function clickField(f) {
    if (!myTurn()) return;
    const s = G.s;
    if (G.cast) { const st = castStep(); if (st && (st.type === 'place' || st.what === 'field') && st.cands.includes(f)) castToggle(f); return; }
    if (G.gift && G.gift.id === 'blitzschritt') { if (G.gift.targets.includes(f)) { const g = G.gift; G.gift = null; dispatch({ type: 'gift', uid: g.uid, gift: g.id, target: f }); } else { G.gift = null; render([]); } return; }
    if (G.sel && G.sel.kind === 'hand' && W.summonOptions(s, G.sel.iid).includes(f)) {
      const P = s.players[s.active];
      if (P.hand.length === 1 && !P.deck.length) { dialog('<h2>Letzte Karte?</h2><p>Dein Stapel ist leer. Ohne Hand- und Stapelkarten verlierst du sofort.</p><div class="row"><button class="btn danger" data-act="yes">Trotzdem beschwören</button><button class="btn" data-act="no">Abbrechen</button></div>', act => { if (act === 'yes') { const iid = G.sel.iid; G.sel = null; dispatch({ type: 'summon', iid, field: f }); } }); return; }
      const iid = G.sel.iid; G.sel = null; dispatch({ type: 'summon', iid, field: f }); return;
    }
    if (G.sel && G.sel.kind === 'unit' && s.phase === 'move') { const r = W.reachable(s, G.sel.uid); if (r[f]) { const uid = G.sel.uid; G.sel = null; dispatch({ type: 'move', uid, to: f }); return; } }
    G.sel = null; render([]);
  }
  function clickUnit(uid) {
    const s = G.s, u = s.units[uid]; if (!u) return;
    if (myTurn() && G.cast) { const st = castStep(); if (st && st.type === 'pick' && st.cands.includes(uid)) { castToggle(uid); return; } }
    if (myTurn()) {
      if (G.gift && G.gift.targets.includes(uid)) { const g = G.gift; G.gift = null; dispatch({ type: 'gift', uid: g.uid, gift: g.id, target: uid }); return; }
      if (G.gift) { G.gift = null; }
      if (s.phase === 'battle' && G.sel && G.sel.kind === 'unit' && G.sel.uid !== uid) {
        const a = G.sel.uid, tg = W.attackTargets(s, a);
        if (tg.includes(uid)) {
          const cur = (s.decl[a] && s.decl[a].targets) || [];
          let next;
          if (cur.includes(uid)) next = cur.filter(x => x !== uid);
          else if (W.has(s, s.units[a], 'doppelschlag') && !s.units[a].king && cur.length === 1 && !s.units[uid].king && !s.units[cur[0]].king) next = cur.concat(uid);
          else next = [uid];
          dispatch({ type: 'declare', uid: a, targets: next }); return;
        }
      }
      if (s.phase === 'move' && G.sel && G.sel.kind === 'unit' && u.owner !== s.active) { G.sel = { kind: 'unit', uid }; render([]); if (bigOn()) openInspector({ uid, from: tokEls.get(uid) }); return; }
    }
    if (bigOn()) { G.sel = { kind: 'unit', uid }; render([]); openInspector({ uid, from: tokEls.get(uid) }); return; }
    G.sel = G.sel && G.sel.kind === 'unit' && G.sel.uid === uid ? null : { kind: 'unit', uid };
    render([]);
  }
  function clickHand(iid) {
    const from = $('.hcard[data-iid="' + iid + '"]');
    if (!myTurn()) { const h = G.s.players[G.view].hand.find(x => x.iid === iid); if (h) openInspector({ cid: h.cid, from }); return; }
    if (G.cast && G.cast.iid !== iid) G.cast = null;
    G.gift = null;
    if (bigOn()) { G.sel = { kind: 'hand', iid }; render([]); openInspector({ iid, from: $('.hcard[data-iid="' + iid + '"]') || from }); return; }
    G.sel = G.sel && G.sel.kind === 'hand' && G.sel.iid === iid ? null : { kind: 'hand', iid };
    render([]);
  }

  /* ---------------- Karte groß: dreht sich nach vorn, als hielte man sie in der Hand ---------------- */
  const bigOn = () => SET.bigTap === true; // Standard: Antippen wählt nur aus, groß per Doppelklick/Halten
  let INS = null; // { cid, uid, iid, from, ctx }
  function insCard() { if (!INS) return null; const s = G && G.s; if (INS.uid && s && s.units[INS.uid]) return s.cards[s.units[INS.uid].cid]; if (INS.iid && s) { const h = s.players.flatMap(P => P.hand).find(x => x.iid === INS.iid); if (h) return s.cards[h.cid]; } return POOL.cards[INS.cid] || (s && s.cards[INS.cid]) || null; }
  function insActions(c) {
    const out = [], btn = (act, label, cls, dis, title) => out.push('<button class="btn ' + (cls || '') + '" data-ix="' + act + '"' + (dis ? ' disabled' : '') + (title ? ' title="' + esc(title) + '"' : '') + '>' + label + '</button>');
    const why = t => out.push('<p class="hint">' + esc(t) + '</p>');
    if (INS.ctx === 'deck' && ED) {
      const n = ED.cards.filter(x => x === c.id).length, lim = c.type === 'king' ? 1 : (W.COPY_LIMIT[c.rarity] || 1);
      btn('deck-add', c.type === 'king' ? '♛ Als König nehmen' : '+ Ins Deck (' + n + '/' + lim + ')', 'primary', n >= lim);
      if (n) btn('deck-del', '− Eine entfernen');
    } else if (G && !G.s.result && myTurn() && (INS.uid || INS.iid)) {
      const s = G.s;
      if (INS.uid && s.units[INS.uid]) {
        const u = s.units[INS.uid];
        if (u.owner === s.active && s.phase === 'move' && !u.king) { const r = Object.keys(W.reachable(s, u.uid)); if (r.length) btn('pick', '➜ Laufen – grünes Feld wählen', 'primary'); else why(u.moved ? 'Ist in diesem Zug schon gelaufen.' : W.locked(s, u) ? 'Frisch beschworen: läuft erst im nächsten Zug.' : W.immobile(s, u) ? 'Bewegung gesperrt.' : 'Kein Feld erreichbar.'); }
        if (u.owner === s.active && s.phase === 'battle') {
          const tg = W.attackTargets(s, u.uid);
          if (tg.length) btn('pick', '⚔ ' + (s.decl[u.uid] ? 'Angriff ändern' : 'Angreifen') + ' – rotes Ziel wählen', 'primary'); else why(W.locked(s, u) ? 'Frisch beschworen: greift erst im nächsten Zug an.' : 'Kein Ziel in Angriffsreichweite.');
          if (!u.king) for (const o of W.giftOptions(s, u.uid)) out.push('<button class="btn small" data-ix="gift" data-gift="' + o.id + '" data-uid="' + u.uid + '" ' + (o.ok ? '' : 'disabled') + '>' + esc(o.name) + (o.ok ? '' : ' · ' + esc(o.why)) + '</button>');
        }
      } else if (INS.iid) {
        const p = actor(s), h = s.players[p].hand.find(x => x.iid === INS.iid);
        if (h && isSp(c)) { const o = W.castOptions(s, p, h.iid); if (o.ok) btn('cast', (c.type === 'curse' ? '☾ Fluch' : '✦ Zauber') + ' ausspielen (' + c.energy + ' Energie' + (o.hpCost ? ', ' + fmt(o.hpCost) + ' König-HP' : '') + (o.discardCost ? ', ' + o.discardCost + ' Handkarte' + (o.discardCost > 1 ? 'n' : '') : '') + ')', 'primary'); else why('Jetzt nicht ausspielbar: ' + o.why + '.'); }
        else if (h) { const k = W.cost(s, p, h.cid); if (W.summonOptions(s, h.iid).length) btn('pick', '✦ Beschwören – goldenes Feld wählen (' + k + ' Energie)', 'primary'); else why(['summon1', 'summon2'].includes(s.phase) ? (k > s.players[p].energy ? 'Zu wenig Energie (' + s.players[p].energy + ' von ' + k + ').' : 'Kein freies Beschwörungsfeld.') : 'Beschwören geht nur in den Beschwörungsphasen.'); }
      }
    }
    btn('close', 'Zurück zum Spielfeld'.replace('Spielfeld', INS.ctx === 'deck' ? 'Deck' : G && INS.ctx !== 'view' ? 'Spielfeld' : 'Überblick'), '');
    return '<div class="insp-acts">' + out.join('') + '</div>';
  }
  function insFront(c) {
    const f = fullURL(c.id);
    if (f) return '<img src="' + f + '" alt="Karte ' + esc(c.name) + '" draggable="false">';
    return '<div class="insp-noimg ' + (c.type || '') + '"><b>' + esc(c.name) + '</b><span>' + esc(TYPEN(c)) + '</span>' + (isSp(c) ? '<p>' + esc(c.ruleText) + '</p>' : '<span>' + (c.type === 'king' ? 'ATK ' + fmt(c.atk) + ' · HP ' + fmt(c.hp) : '⚡' + c.energy + ' · ATK ' + fmt(c.atk) + ' · DEF ' + fmt(c.def)) + '</span>') + '</div>';
  }
  function fillInspector() {
    const c = insCard(); if (!c) { closeInspector(); return; }
    const s = G && G.s, u = INS.uid && s ? s.units[INS.uid] : null;
    $('#insp-front').innerHTML = insFront(c) + '<i class="foil"></i>'; $('#insp-card').dataset.rar = c.rarity || '';
    $('#insp-info').innerHTML = insActions(c) + cardDetail(c, u, u ? s : (G ? s : null), { noImage: true }) + (INS.ctx !== 'game' ? relatedHTML(c) : '');
  }
  function openInspector(o) {
    INS = Object.assign({ ctx: G && !$('#v-game').hidden ? 'game' : !$('#dv-edit').hidden && ED ? 'deck' : 'view' }, o);
    if (!INS.cid && !INS.uid && !INS.iid) return;
    const box = $('#insp'); fillInspector(); if (!INS) return;
    box.hidden = false; box.classList.remove('closing'); void box.offsetWidth; box.classList.add('open');
    const card = $('#insp-card'), hold = $('#insp-hold'), to = hold.getBoundingClientRect(), fr = INS.from && INS.from.isConnected ? INS.from.getBoundingClientRect() : null;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (card.getAnimations) card.getAnimations().forEach(a => a.cancel());
    if (!reduce) {
      const start = fr && fr.width ? 'translate(' + (fr.left + fr.width / 2 - (to.left + to.width / 2)) + 'px,' + (fr.top + fr.height / 2 - (to.top + to.height / 2)) + 'px) scale(' + Math.max(.08, fr.width / to.width) + ') rotateY(180deg)' : 'translateY(40px) scale(.6) rotateY(180deg)';
      card.animate([{ transform: start, offset: 0 }, { transform: 'translateZ(60px) scale(1.04) rotateY(20deg)', offset: .7 }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.2,.75,.25,1)' });
    }
    { const ic = $('#insp-card'); ic.classList.remove('sheen'); void ic.offsetWidth; ic.classList.add('sheen'); clearTimeout(ic._sh); ic._sh = setTimeout(() => ic.classList.remove('sheen'), 2400); }
    if (G && G.tutorial) setTimeout(() => TUT.check([]), 0);
    setTimeout(() => { const b = box.querySelector('.insp-acts .primary') || box.querySelector('[data-ix="close"]'); if (b && !INS?.noFocus) try { b.focus({ preventScroll: true }); } catch (e) { } }, 50);
  }
  function closeInspector(after) {
    const box = $('#insp'); if (box.hidden) { if (after) after(); return; }
    const card = $('#insp-card'), hold = $('#insp-hold'), fr = INS && INS.from && INS.from.isConnected ? INS.from.getBoundingClientRect() : null, to = hold.getBoundingClientRect();
    INS = null; box.classList.remove('open'); box.classList.add('closing');
    const done = () => { box.hidden = true; box.classList.remove('closing'); $('#insp-tilt').style.transform = ''; if (after) after(); if (G && G.tutorial) TUT.check([]); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !card.animate) { done(); return; }
    const end = fr && fr.width ? 'translate(' + (fr.left + fr.width / 2 - (to.left + to.width / 2)) + 'px,' + (fr.top + fr.height / 2 - (to.top + to.height / 2)) + 'px) scale(' + Math.max(.08, fr.width / to.width) + ') rotateY(-180deg)' : 'translateY(40px) scale(.5)';
    const a = card.animate([{ transform: 'none', opacity: 1 }, { transform: end, opacity: fr ? 1 : 0 }], { duration: 380, easing: 'cubic-bezier(.5,0,.75,.4)' });
    a.onfinish = done; setTimeout(() => { if (!box.hidden && !INS) done(); }, 600);
  }
  function inspectorAct(b) {
    const ix = b.dataset.ix, o = INS;
    if (ix === 'close') { closeInspector(); return; }
    if (ix === 'deck-add' && o) { deckChange(insCard().id, 1); fillInspector(); return; }
    if (ix === 'relzoom' && o) { INS = Object.assign({}, o, { cid: b.dataset.cid, uid: null, iid: null }); fillInspector(); $('#insp-info').scrollTop = 0; return; }
    if (ix === 'reladd' && o) { deckChange(b.dataset.cid, 1); fillInspector(); return; }
    if (ix === 'deck-del' && o) { deckChange(insCard().id, -1); fillInspector(); return; }
    if (ix === 'pick') { if (o && o.iid) G.sel = { kind: 'hand', iid: o.iid }; else if (o && o.uid) G.sel = { kind: 'unit', uid: o.uid }; closeInspector(() => { render([]); toast(G.sel && G.sel.kind === 'hand' ? 'Goldenes Feld antippen.' : G.s.phase === 'battle' ? 'Rot markiertes Ziel antippen.' : 'Grünes Feld antippen.', 2200); }); return; }
    if (ix === 'cast' && o) { const iid = o.iid; closeInspector(() => startCast(iid)); return; }
    if (ix === 'gift') { const uid = b.dataset.uid, gid = b.dataset.gift; closeInspector(() => useGiftUI(uid, gid)); }
  }
  /* Spielhilfe */
  function advice() {
    if (!G || SET.help === false || !myTurn()) return [];
    if (G._advFor !== G.s) { G._advFor = G.s; try { G._adv = ADV.missed(G.s, actor(G.s)); } catch (e) { G._adv = []; } }
    return G._adv;
  }
  function adviceList(list) { return '<ul class="advice">' + list.map(x => '<li class="' + x.kind + '"><button data-act="' + (x.uid ? 'u:' + x.uid : x.iid ? 'h:' + x.iid : 'close') + '">' + esc(x.text) + '</button></li>').join('') + '</ul>'; }
  function adviceAct(act) { if (act.startsWith('u:')) { G.sel = { kind: 'unit', uid: act.slice(2) }; render([]); } else if (act.startsWith('h:')) { G.sel = { kind: 'hand', iid: act.slice(2) }; render([]); } }
  function showTips() {
    const list = advice(); if (!list.length) return;
    dialog('<span class="eyebrow">Spielhilfe</span><h2>Das könntest du jetzt tun</h2>' + adviceList(list) + '<p class="hint">Tippe einen Hinweis an, um die Karte auszuwählen. Die Spielhilfe lässt sich im Menü ausschalten.</p><button class="btn" data-act="close">Schließen</button>', act => adviceAct(act), { dismiss: true });
  }
  function mainAction() {
    if (!myTurn()) return;
    const s = G.s;
    const go = () => { G.sel = null; G.gift = null; G.cast = null; dispatch(s.phase === 'counter' ? { type: 'pass', p: s.counter } : { type: 'endPhase' }); };
    const list = advice();
    if (list.length) {
      const lab = { summon1: 'Weiter zur Bewegung', move: 'Weiter zur Battlephase', battle: 'Battlephase abschließen', counter: 'Passen', summon2: 'Zug beenden' }[s.phase] || 'Weiter';
      dialog('<span class="eyebrow">Spielhilfe</span><h2>Du hättest noch diese Möglichkeiten</h2>' + adviceList(list) + '<div class="row"><button class="btn" data-act="back">Zurück und nutzen</button><button class="btn primary" data-act="go">' + lab + '</button></div><p class="hint">Ausschalten: Menü → Spielhilfe.</p>', act => { if (act === 'go') go(); else adviceAct(act); });
      return;
    }
    if (s.phase === 'battle') {
      const n = Object.keys(s.decl).length;
      const idle = Object.values(s.units).filter(u => u.owner === s.active && W.attackTargets(s, u.uid).length && !s.decl[u.uid]).length;
      if (!n && idle && SET.help !== false) { dialog('<h2>Ohne Angriff abschließen?</h2><p>' + idle + ' Kämpfer könnten angreifen. Nach dem Abschluss lassen sich Angriffe nicht mehr festlegen.</p><div class="row"><button class="btn primary" data-act="yes">Abschließen</button><button class="btn" data-act="no">Zurück</button></div>', act => { if (act === 'yes') go(); }); return; }
    }
    go();
  }
  // Schnellwahl der Gaben direkt am angetippten Helden (ohne Großansicht)
  function quickGifts() {
    const board = $('#board'); let qb = $('#qgifts');
    const s = G.s, sel = G.sel && G.sel.kind === 'unit' && s.units[G.sel.uid];
    const opts = myTurn() && sel && !G.gift && !G.cast && !G.replay ? W.giftOptions(s, sel.uid) : [];
    if (!opts.length) { if (qb) qb.remove(); return; }
    if (!qb) { qb = document.createElement('div'); qb.id = 'qgifts'; qb.className = 'qgifts';
      for (const ev of ['pointerdown', 'pointerup', 'dblclick', 'contextmenu']) qb.addEventListener(ev, e => e.stopPropagation());
      qb.addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-qg]'); if (b && !b.disabled) useGiftUI(b.dataset.uid, b.dataset.qg); }); }
    if (qb.parentNode !== board) board.appendChild(qb);
    const P = pos(sel.pos), below = P.top + P.h < 80; // unter dem Helden, damit Angriffsziele davor frei bleiben
    qb.style.left = (P.left + P.w / 2) + '%'; qb.style.top = (below ? P.top + P.h : P.top) + '%'; qb.classList.toggle('below', below);
    qb.innerHTML = opts.map(o => '<button data-qg="' + o.id + '" data-uid="' + sel.uid + '" ' + (o.ok ? '' : 'disabled') + ' title="' + esc(giftInfo(o.id).short || giftInfo(o.id).text || '') + '"><b>' + esc(o.name) + '</b><small>' + (o.ok ? 'CT ' + o.ct : esc(o.why)) + '</small></button>').join('');
  }
  function useGiftUI(uid, gid) {
    const s = G.s, o = W.giftOptions(s, uid).find(x => x.id === gid); if (!o || !o.ok) return;
    const G0 = W.GIFTS[gid];
    if (G0.target === 'self') { dispatch({ type: 'gift', uid, gift: gid }); return; }
    G.gift = { uid, id: gid, targets: o.targets }; render([]);
    toast(gid === 'blitzschritt' ? 'Blitzschritt: Zielfeld antippen.' : giftInfo(gid).name + ': Ziel antippen (violett markiert).');
  }

  /* ---------------- Zauber und Flüche ausspielen ---------------- */
  // G.cast = { iid, cid, o: castOptions, steps: [{ i, type: 'pick'|'place' }], k: aktueller Schritt, choices, place }
  function startCast(iid) {
    const s = G.s, p = actor(s), o = W.castOptions(s, p, iid); if (!o.ok) { toast('Nicht ausspielbar: ' + o.why + '.'); return; }
    const h = s.players[p].hand.find(x => x.iid === iid), steps = [];
    for (const eo of o.effects) { if (eo.pick === 'player' && eo.candidates.length) steps.push({ i: eo.i, type: 'pick' }); if (eo.place && eo.candidates.length) steps.push({ i: eo.i, type: 'place' }); }
    G.cast = { iid, cid: h.cid, o, steps, k: 0, choices: o.effects.map(() => []), place: o.effects.map(() => []) };
    G.sel = { kind: 'hand', iid }; render([]);
  }
  function castStep() {
    const C = G.cast; if (!C) return null; const st = C.steps[C.k]; if (!st) return null;
    const eo = C.o.effects.find(x => x.i === st.i);
    if (st.type === 'place') return { type: 'place', eo, cands: eo.place, need: Math.min(eo.place.length, C.choices[st.i].length || 1), chosen: C.place[st.i], what: 'field' };
    return { type: 'pick', eo, what: eo.what, cands: eo.candidates.map(x => x.id), need: Math.min(eo.max, eo.candidates.length), chosen: C.choices[st.i] };
  }
  function castToggle(id) {
    const C = G.cast, st = castStep(); if (!st) return;
    const arr = st.chosen, i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else { if (arr.length >= st.need) { if (st.need === 1) arr.length = 0; else { toast('Schon ' + st.need + ' gewählt. Erst eins abwählen.'); return; } } arr.push(id); }
    if (st.need === 1 && arr.length === 1) C.k++;
    render([]);
  }
  function castLabel(eo, id) { const x = (eo.candidates || []).find(c => c.id === id); return x ? x.label : id; }
  function castPanel() {
    const C = G.cast; if (!C) return '';
    const c = G.s.cards[C.cid], st = castStep();
    let body;
    if (st) {
      const what = st.type === 'place' ? 'Feld für den zurückgeholten Helden (golden)' : st.what === 'unit' || st.what === 'king' ? 'Ziel auf dem Brett (violett) oder hier in der Liste' : st.what === 'field' ? 'Feld auf dem Brett (grün) oder hier in der Liste' : st.what === 'discard' ? 'Karte aus dem Ablagestapel' : 'gegnerische Karte, die neutralisiert wird';
      const list = (st.type === 'place' ? st.cands.map(f => ({ id: f, label: f })) : st.eo.candidates);
      body = '<p><b>Effekt ' + (st.eo.i + 1) + ':</b> ' + esc(st.eo.text) + '</p><p class="hint">Wähle ' + st.need + ' × ' + what + '. Gewählt: ' + st.chosen.length + ' / ' + st.need + '</p>'
        + '<div class="cpick">' + list.map(x => '<button class="btn small' + (st.chosen.includes(x.id) ? ' on' : '') + '" data-cpick="' + esc(x.id) + '">' + esc(x.label) + '</button>').join('') + '</div>'
        + '<div class="row">' + (st.need > 1 ? '<button class="btn small primary" data-cnext="1" ' + (st.chosen.length === st.need ? '' : 'disabled') + '>Weiter</button>' : '') + (C.k ? '<button class="btn small" data-cback="1">Zurück</button>' : '') + '<button class="btn small" data-cabort="1">Abbrechen</button></div>';
    } else {
      const sum = C.o.effects.map(eo => '<li>' + esc(eo.text) + (C.choices[eo.i].length ? ' <b>→ ' + esc(C.choices[eo.i].map(id => castLabel(eo, id)).join(', ')) + '</b>' : eo.pick === 'player' ? ' <span class="muted">(kein Ziel – verpufft)</span>' : ' <span class="muted">(Ziele bei der Auswertung)</span>') + (C.place[eo.i].length ? ' · Feld ' + esc(C.place[eo.i].join(', ')) : '') + '</li>').join('');
      body = '<ul>' + sum + '</ul><div class="row"><button class="btn primary" data-cok="1">Verbindlich ausspielen (' + c.energy + ' Energie)</button>' + (C.steps.length ? '<button class="btn small" data-cback="1">Zurück</button>' : '') + '<button class="btn small" data-cabort="1">Abbrechen</button></div><p class="hint">Danach nicht mehr rücknehmbar. Ausgewertet wird nach der Konterphase.</p>';
    }
    return '<div class="castbox ' + c.type + '"><span class="eyebrow">' + (c.type === 'curse' ? '☾ Fluch' : '✦ Zauber') + ' ausspielen: ' + esc(c.name) + '</span>' + body + '</div>';
  }
  function castHint() { const st = castStep(); return st ? '<b>' + esc(G.s.cards[G.cast.cid].name) + '</b>: ' + (st.type === 'place' ? 'Tippe ein goldenes Feld.' : st.what === 'field' ? 'Tippe grüne Felder.' : st.what === 'unit' || st.what === 'king' ? 'Tippe ein violett markiertes Ziel.' : 'Wähle rechts eine Karte.') + ' Gewählt ' + st.chosen.length + ' / ' + st.need + '.' : 'Ziele gewählt – rechts verbindlich ausspielen.'; }
  function castAct(ds) {
    const C = G.cast; if (!C) return;
    if (ds.cabort) { G.cast = null; render([]); return; }
    if (ds.cback) { C.k = Math.max(0, C.k - 1); const st = castStep(); if (st) st.chosen.length = 0; render([]); return; }
    if (ds.cnext) { C.k++; render([]); return; }
    if (ds.cpick !== undefined) { castToggle(ds.cpick); return; }
    if (ds.cok) { const a = { type: 'cast', p: actor(G.s), iid: C.iid, choices: C.choices, place: C.place }; G.cast = null; G.sel = null; dispatch(a); }
  }
  function stackPanel() {
    const s = G.s; if (!s.stack || !s.stack.length) return '';
    const lbl = id => s.units[id] ? s.cards[s.units[id].cid].name + ' (' + s.units[id].pos + ')' : /^[A-G]\d$/.test(id) ? id : /^\d:/.test(id) ? ((s.cards[(s.players[+id[0]].discard.find(d => d.iid === id.slice(2)) || {}).cid] || {}).name || id) : ((s.cards[(s.stack.find(x => x.sid === id) || {}).cid] || {}).name || id);
    return '<div class="stackbox"><span class="eyebrow">Gespielt – Auswertung nach der Konterphase</span>' + s.stack.map(x => { const c = s.cards[x.cid], t = (x.choices || []).flat().map(lbl); return '<button class="stk ' + c.type + '" data-zoom="' + esc(c.id) + '">' + (c.type === 'curse' ? '☾ ' : '✦ ') + '<b>' + esc(c.name) + '</b> · ' + esc(s.players[x.p].name) + (t.length ? ' → ' + esc(t.join(', ')) : '') + '</button>'; }).join('') + '</div>';
  }

  /* ---------------- Zeichnen ---------------- */
  // Spielfeld-Grafik: Engine-Feld → sichtbare Position (rZeileSpalte aus dem Einbaupaket).
  // Unten liegt immer die eigene Seite: Für Spieler 1 wird nur die Zuordnung gespiegelt, das Bild bleibt stehen.
  const FIELD = window.WOK_FIELD || null;
  function slotOf(f) { const r = W.rowOf(f), c = W.colOf(f) + 1, v = G && G.view === 1; return 'r' + (v ? 8 - r : r) + 'c' + (v ? 8 - c : c); }
  function pos(f) {
    const sl = FIELD && FIELD.slots[slotOf(f)];
    if (sl) return { left: sl.x * 100, top: sl.y * 100, w: sl.w * 100, h: sl.h * 100 };
    const c = W.colOf(f), r = W.rowOf(f), vc = G.view === 1 ? 6 - c : c, vr = G.view === 1 ? 7 - r : r - 1;
    return { left: vc * 100 / 7, top: vr * 100 / 7, w: 100 / 7, h: 100 / 7 };
  }
  const tokEls = new Map();
  function render(events) {
    if (!G) return;
    const s = G.s, p = G.view, me = s.players[p], foe = s.players[1 - p];
    const act = actor(s), mine = myTurn();
    // Hervorhebungen
    const hl = {}; let targets = [], gtargets = [], outs = {};
    if (mine && G.sel && G.sel.kind === 'hand') for (const f of W.summonOptions(s, G.sel.iid)) hl[f] = 'hl-summon';
    if (mine && G.sel && G.sel.kind === 'unit' && s.phase === 'move') { const r = W.reachable(s, G.sel.uid); for (const f of Object.keys(r)) hl[f] = 'hl-move'; }
    if (mine && G.sel && G.sel.kind === 'unit' && s.phase === 'battle' && s.units[G.sel.uid] && s.units[G.sel.uid].owner === s.active) {
      targets = W.attackTargets(s, G.sel.uid);
      const a = s.units[G.sel.uid], dbl = W.has(s, a, 'doppelschlag') && !a.king;
      for (const t of targets) { const pv = W.preview(s, G.sel.uid, t, dbl ? 2 : 1); outs[t] = pv; }
    }
    if (mine && G.gift) { if (G.gift.id === 'blitzschritt') for (const f of G.gift.targets) hl[f] = 'hl-move'; else gtargets = G.gift.targets; }
    let csel = [];
    if (mine && G.cast) { const st = castStep(); if (st) { csel = st.chosen; if (st.type === 'place') for (const f of st.cands) hl[f] = st.chosen.includes(f) ? 'hl-csel' : 'hl-summon'; else if (st.what === 'field') for (const f of st.cands) hl[f] = st.chosen.includes(f) ? 'hl-csel' : 'hl-move'; else if (st.what === 'unit' || st.what === 'king') gtargets = st.cands; } }
    // Felder
    const board = $('#board');
    if (!board.dataset.view || +board.dataset.view !== p) {
      board.innerHTML = W.FIELDS.map(f => { const P = pos(f); const r = W.rowOf(f); const cls = ['cell', (f === 'D1' || f === 'D7') ? 'k' : '', W.isGuard(f, 0) || W.isGuard(f, 1) ? 'guard' : '', r === 4 ? 'mid' : '', r === W.SUMMON_ROW[p] ? 'srow mine' : ''].join(' ');
        return '<div class="' + cls + '" data-f="' + f + '" style="left:' + P.left + '%;top:' + P.top + '%;width:' + P.w + '%;height:' + P.h + '%" data-slot="' + slotOf(f) + '" role="button" tabindex="-1" aria-label="Feld ' + f + '"><div><span class="lab">' + f + '</span></div></div>'; }).join('') + '<svg class="arrows" id="arrows" viewBox="0 0 700 700" preserveAspectRatio="none"></svg>';
      board.dataset.view = p; tokEls.clear();
      if (FIELD) { board.classList.add('art'); board.style.backgroundImage = 'url(' + FIELD.img + ')'; }
    }
    for (const el of board.querySelectorAll('.cell')) { const f = el.dataset.f; el.classList.remove('hl-summon', 'hl-move', 'hl-csel'); if (hl[f]) el.classList.add(hl[f]); el.tabIndex = hl[f] ? 0 : -1; el.classList.toggle('flock', W.fieldLocked(s, f)); el.classList.toggle('nosum', W.fieldLocked(s, f, true)); }
    // Einheiten
    const alive = new Set(Object.keys(s.units));
    const causes = {}; for (const e of events || []) if (e.t === 'death') for (const id of e.uids) causes[id] = e.cause;
    for (const [uid, el] of tokEls) if (!alive.has(uid)) { tokEls.delete(uid); destroyAnim(el, causes[uid]); }
    for (const u of Object.values(s.units)) {
      let el = tokEls.get(u.uid);
      const c = s.cards[u.cid];
      if (!el) { el = document.createElement('div'); el.className = 'tok appear'; el.dataset.uid = u.uid; el.tabIndex = 0; board.appendChild(el); tokEls.set(u.uid, el); setTimeout(() => el.classList.remove('appear'), 500); }
      const P = pos(u.pos); el.style.left = P.left + '%'; el.style.top = P.top + '%'; el.style.width = P.w + '%'; el.style.height = P.h + '%';
      el.classList.toggle('foe', u.owner !== p); el.classList.toggle('king', u.king);
      el.classList.toggle('sel', !!(G.sel && G.sel.kind === 'unit' && G.sel.uid === u.uid));
      el.classList.toggle('locked', W.locked(s, u) && u.owner === s.active);
      el.classList.toggle('target', targets.includes(u.uid)); el.classList.toggle('gtarget', gtargets.includes(u.uid)); el.classList.toggle('csel', csel.includes(u.uid));
      const img = artURL(c.id), a = W.atkOf(s, u), d = W.defOf(s, u);
      const sfx = W.effectsOn(s, u), hasSp = sfx.some(e => e.src === 'spell'), hasCu = sfx.some(e => e.src === 'curse');
      const badges = statusBadges(s, u) + (hasSp ? '<span class="bsp" title="Zauber wirkt">✦</span>' : '') + (hasCu ? '<span class="bcu" title="Fluch wirkt">☾</span>' : '');
      const st = u.king ? '<span class="h">' + fmt(u.hp) + '</span>' : '<span class="a ' + (a > c.atk ? 'up' : a < c.atk ? 'down' : '') + '">' + a + '</span><span class="d ' + (d > c.def ? 'up' : d < c.def ? 'down' : '') + '">' + d + '</span>';
      const o = outs[u.uid];
      const out = o ? '<span class="out ' + o.kind + '">' + (o.kind === 'king' ? '−' + fmt(o.dmg) : o.kind === 'win' ? 'besiegt' : o.kind === 'lose' ? 'fällt selbst' : o.kind === 'both' ? 'beide fallen' : 'wirkungslos') + '</span>' : '';
      const fimg = !img && fullURL(c.id);
      const html = '<div class="face' + (fimg ? ' fullbg' : '') + '" style="' + (img ? 'background-image:url(' + img + ')' : fimg ? 'background-image:url(' + fimg + ')' : 'background-color:' + (ELCOL[c.elements[0]] || '#2a3242')) + '">' + (img || fimg ? '' : '<span class="ph">' + esc(initials(c.name)) + '</span>') + (u.king ? '<span class="crown">♛</span>' : '') + '<span class="bd">' + badges + '</span><span class="st">' + st + '</span></div>' + out;
      if (el._h !== html) { el.innerHTML = html; el._h = html; }
      el.setAttribute('aria-label', (u.owner === p ? 'Eigene Karte ' : 'Gegnerische Karte ') + c.name + ' auf ' + u.pos);
    }
    // Pfeile der festgelegten Angriffe
    const svg = $('#arrows'); let lines = '';
    const ctr = f => { const P = pos(f); return [(P.left + P.w / 2) * 7, (P.top + P.h / 2) * 7]; };
    for (const [aUid, d] of Object.entries(s.decl)) { const a = s.units[aUid]; if (!a) continue; for (const t of d.targets) { const tu = s.units[t]; if (!tu) continue; const [x1, y1] = ctr(a.pos), [x2, y2] = ctr(tu.pos); const k = 0.28; lines += '<g class="' + (tu.king ? 'king' : '') + '"><line x1="' + (x1 + (x2 - x1) * k) + '" y1="' + (y1 + (y2 - y1) * k) + '" x2="' + (x2 - (x2 - x1) * k) + '" y2="' + (y2 - (y2 - y1) * k) + '"/></g>'; } }
    svg.innerHTML = lines;
    // Spielerleisten
    $('#pb-top').innerHTML = pbar(1 - p); $('#pb-bot').innerHTML = pbar(p);
    $('#pb-top').classList.toggle('active', s.active === 1 - p && !s.result); $('#pb-bot').classList.toggle('active', s.active === p && !s.result);
    // Hand
    const hand = $('#hand');
    if (G.handover) { hand.className = 'hand hidden-hand'; hand.innerHTML = 'Hand verdeckt'; }
    else { hand.className = 'hand'; hand.innerHTML = me.hand.map(h => handCard(h, p, G.sel && G.sel.kind === 'hand' && G.sel.iid === h.iid)).join('') || '<span class="muted" style="align-self:center">Keine Handkarten.</span>'; }
    // Phase, Hinweis, Hauptknopf
    const shown = ['summon1', 'move', 'battle', 'counter', 'summon2'], curI = shown.indexOf(s.phase === 'resolve' ? 'counter' : s.phase);
    $('#phases').innerHTML = shown.map((ph, i) => '<span class="' + (i === curI ? 'on' : i < curI ? 'done' : '') + '">' + W.PHASE_NAME[ph] + '</span>').join('');
    $('#turnwho').textContent = s.result ? 'Partie beendet' : s.phase === 'counter' ? 'Konterphase: ' + s.players[s.counter].name + (isAI(s.counter) ? ' überlegt …' : G.mode === 'ai' || (G.mode === 'online' && s.counter === G.view) ? ' (du)' : G.mode === 'online' ? ' (Gegner)' : '') : (isAI(s.active) ? s.players[s.active].name + ' zieht …' : s.players[s.active].name + (G.mode === 'ai' || (G.mode === 'online' && s.active === G.view) ? ' (du)' : G.mode === 'online' ? ' (Gegner)' : '')) + (s.result ? '' : ' · ' + W.PHASE_NAME[s.phase === 'resolve' ? 'counter' : s.phase]);
    $('#hint').innerHTML = hint();
    { const cb = $('#concede'); if (cb) cb.hidden = !!s.result; }
    const mb = $('#mainbtn'), lab = { summon1: 'Weiter: Bewegung', move: 'Weiter: Battlephase', battle: 'Battlephase abschließen', counter: 'Passen – Konterphase beenden', summon2: 'Zug beenden' }[s.phase];
    mb.textContent = s.result ? 'Partie beendet' : mine && G.cast ? 'Erst Ziele wählen oder abbrechen' : mine && lab ? lab + (s.phase === 'battle' ? ' (' + Object.keys(s.decl).length + ' Angriff' + (Object.keys(s.decl).length === 1 ? '' : 'e') + ')' : '') : 'Gegner ist am Zug';
    mb.disabled = !mine || !lab || s.pendingDiscard !== null || !!G.cast;
    const tips = advice(), tb = $('#tips'); tb.hidden = !tips.length;
    if (tips.length) tb.textContent = '💡 Spielhilfe: ' + tips.length + (tips.length === 1 ? ' Möglichkeit' : ' Möglichkeiten') + ' – anzeigen';
    renderDetail();
    if (INS && !$('#insp').hidden && INS.ctx === 'game') { const keep = $('#insp-info').scrollTop; fillInspector(); $('#insp-info').scrollTop = keep; }
    renderLog();
    quickGifts();
    playEvents(events || []);
    FX.onEvents(s, events || []); MATE.onEvents(s, events || []); MATE.track(s);
    applyLooks(); if (G.tutorial) TUT.check(events || []); if (G && G.replay) rpUpdate();
    { const cb = $('#concede'); if (cb && (G.replay || G.tutorial)) cb.hidden = true; } mb.hidden = !!G.replay; $('#tips').hidden = $('#tips').hidden || !!G.tutorial;
    tickTimer();
  }
  function pbar(p) {
    const s = G.s, P = s.players[p], k = W.kingOf(s, p), kc = s.cards[k.cid];
    const pct = Math.max(0, Math.min(100, k.hp / kc.hp * 100));
    const live = s.active === p || (s.phase === 'counter' && s.counter === p);
    const en = '<span class="energy" title="Energie ' + P.energy + '">' + Array.from({ length: Math.min(10, Math.max(P.turns, 1)) }, (_, i) => '<i class="' + (i < P.energy && live ? 'on' : '') + '"></i>').join('') + '</span>';
    return '<div class="pwho">' + avHTML((G.avatars || [])[p], 'pb-av') + '<div class="pname"><b>' + esc(P.name) + '</b><small>Deck ' + P.deckName + ' · ' + esc(kc.name) + '</small></div></div>'
      + '<div class="hp"><div class="hpbar"><i style="width:' + pct + '%"></i></div><span>♛ ' + fmt(Math.max(0, k.hp)) + ' / ' + fmt(kc.hp) + ' HP</span></div>'
      + (p !== G.view || G.replay ? '<div class="hbacks" aria-label="' + P.hand.length + ' Handkarten">' + Array.from({ length: Math.min(10, P.hand.length) }, () => '<i></i>').join('') + '</div>' : '')
      + '<div class="pstats">' + en + '<span title="Energie">⚡' + (live ? P.energy : 0) + '</span><span title="Handkarten">✋' + P.hand.length + '</span><span title="Nachziehstapel">▤' + P.deck.length + '</span><span title="Ablagestapel">⌫' + P.discard.length + '</span></div>';
  }
  function handCard(h, p, sel, extra) {
    const s = G.s, c = s.cards[h.cid], cost = W.cost(s, p, h.cid), full = fullURL(c.id), img = artURL(c.id);
    const can = isSp(c) ? W.castOptions(s, p, h.iid).ok : s.active === p && ['summon1', 'summon2'].includes(s.phase) && W.summonOptions(s, h.iid).length > 0;
    const bg = full ? 'background-image:url(' + full + ');background-size:cover;background-position:center' : img ? 'background-image:url(' + img + ')' : 'background-color:' + (SPCOL[c.type] || ELCOL[c.elements[0]] || '#2a3242');
    const label = esc(c.name) + (isSp(c) ? ', ' + TYPEN(c) + ', Kosten ' + cost + (c.playable ? '' : ', nicht spielbar') : ', Kosten ' + cost + ', ATK ' + c.atk + ', DEF ' + c.def);
    const seal = isSp(c) ? '<span class="hseal">' + ({ battle: '<i class="b">B</i>', counter: '<i class="k">K</i>' }[(c.spell || {}).timing] || '<i class="b">B</i><i class="k">K</i>') + '</span>' : '';
    if (isSp(c) && !full) return '<button class="hcard sp ' + c.type + ' ' + (sel ? 'sel ' : '') + (!can && !extra ? 'no' : '') + '" ' + (extra || 'data-iid="' + h.iid + '"') + ' style="' + bg + '" aria-label="' + label + '"><span class="cost">' + cost + '</span><span class="nm">' + (c.type === 'curse' ? '☾ ' : '✦ ') + esc(c.name) + '</span><span class="st"><span>' + TYPEN(c) + '</span></span>' + seal + '</button>';
    if (full) return '<button class="hcard full ' + (sel ? 'sel ' : '') + (!can && !extra ? 'no' : '') + '" ' + (extra || 'data-iid="' + h.iid + '"') + ' style="' + bg + '" aria-label="' + label + '" title="' + esc(c.name) + '">' + (cost < c.energy ? '<span class="cost red" title="Kosten durch Gebot der Krone gesenkt">' + cost + '</span>' : '') + '</button>';
    return '<button class="hcard ' + (sel ? 'sel ' : '') + (!can && !extra ? 'no' : '') + '" ' + (extra || 'data-iid="' + h.iid + '"') + ' style="' + bg + '" aria-label="' + label + '">'
      + (img ? '' : '<span class="ph">' + esc(initials(c.name)) + '</span>') + '<span class="cost ' + (cost < c.energy ? 'red' : '') + '">' + cost + '</span><span class="nm">' + esc(c.name) + '</span><span class="st"><span class="a">' + c.atk + '</span><span class="d">' + c.def + '</span></span></button>';
  }

  function hint() {
    const s = G.s; if (s.result) return esc(s.result.reason);
    if (G.handover) return 'Spielerwechsel …';
    const p = actor(s); if (isAI(p)) return 'Die KI plant ihren Zug.';
    if (s.pendingDiscard !== null) return 'Du hast ' + s.players[s.pendingDiscard].hand.length + ' Handkarten (höchstens 10). Lege eine ab.';
    if (G.cast) return castHint();
    if (G.gift) return '<b>' + esc(giftInfo(G.gift.id).name) + '</b>: ' + (G.gift.id === 'blitzschritt' ? 'tippe ein grünes Feld.' : 'tippe ein violett markiertes Ziel.') + ' Tippe woanders, um abzubrechen.';
    const P = s.players[s.active];
    switch (s.phase) {
      case 'summon1': case 'summon2': return (s.phase === 'summon1' ? 'Beschwören vor dem Laufen. ' : 'Nachbeschwörung mit der restlichen Energie. ') + 'Tippe eine Handkarte, dann ein goldenes Feld. Noch <b>' + P.energy + ' Energie</b>.';
      case 'move': return 'Tippe einen eigenen Helden, dann ein grünes Feld. Jeder Held läuft einmal pro Zug.';
      case 'battle': return 'Tippe einen eigenen Kämpfer, dann ein rot markiertes Ziel. Die Vorschau zeigt den Ausgang. Gaben stehen im Kartenfeld rechts, Zauber und Flüche spielst du aus der Hand.';
      case 'counter': return '<b>Deine Konterphase:</b> Der Gegner hat seine Angriffe festgelegt (rote Pfeile). Spiele Zauber oder Flüche aus der Hand oder passe. Danach wird alles gemeinsam ausgewertet.';
    }
    return '';
  }
  function renderDetail() {
    const s = G.s, box = $('#detail');
    let html = '';
    if (G.sel && G.sel.kind === 'unit' && s.units[G.sel.uid]) {
      const u = s.units[G.sel.uid], c = s.cards[u.cid];
      html = cardDetail(c, u, s);
      if (myTurn() && s.phase === 'battle' && u.owner === s.active) {
        const opts = W.giftOptions(s, u.uid);
        if (opts.length) html += '<div class="gifts"><span class="eyebrow">Gaben einsetzen</span>' + opts.map(o => '<button class="btn small" data-gift="' + o.id + '" data-uid="' + u.uid + '" ' + (o.ok ? '' : 'disabled') + '>' + esc(o.name) + (o.ok ? '' : ' · ' + esc(o.why)) + '</button>').join('') + '</div>';
        const tg = W.attackTargets(s, u.uid);
        html += '<p class="hint">' + (W.locked(s, u) ? 'Frisch beschworen: greift erst im nächsten Zug an.' : tg.length ? (s.decl[u.uid] ? 'Angriff festgelegt. Ziel erneut antippen zum Aufheben.' : tg.length + ' mögliche' + (tg.length === 1 ? 's Ziel' : ' Ziele') + ' – rot markiert.') + (W.has(s, u, 'doppelschlag') && !u.king ? ' Doppelschlag: bis zu zwei Helden.' : '') : 'Kein Ziel in Reichweite.') + '</p>';
      }
      if (myTurn() && s.phase === 'move' && u.owner === s.active && !u.king) html += '<p class="hint">' + (u.moved ? 'Ist in diesem Zug schon gelaufen.' : W.locked(s, u) ? 'Frisch beschworen: läuft erst im nächsten Zug.' : W.immobile(s, u) ? 'Bewegung gesperrt: kann nicht laufen.' : Object.keys(W.reachable(s, u.uid)).length ? 'Grüne Felder sind erreichbar.' : 'Kein Feld erreichbar.') + '</p>';
    } else if (G.sel && G.sel.kind === 'hand') {
      const P = s.players[actor(s)], h = P.hand.find(x => x.iid === G.sel.iid);
      if (h && isSp(s.cards[h.cid])) { const c = s.cards[h.cid], o = W.castOptions(s, actor(s), h.iid); html = (G.cast ? castPanel() : '') + cardDetail(c, null, s) + (G.cast ? '' : o.ok ? '<div class="row"><button class="btn primary" data-cast="' + esc(h.iid) + '">' + (c.type === 'curse' ? '☾ Fluch' : '✦ Zauber') + ' ausspielen (' + c.energy + ' Energie' + (o.hpCost ? ', ' + fmt(o.hpCost) + ' König-HP' : '') + (o.discardCost ? ', ' + o.discardCost + ' Handkarte' + (o.discardCost > 1 ? 'n' : '') : '') + ')</button></div><p class="hint">' + (o.hpCost || o.discardCost ? 'Die Zusatzkosten werden sofort bezahlt. ' : '') + 'Danach wählst du die Ziele. Ausspielen ist verbindlich; ausgewertet wird nach der Konterphase.</p>' : '<p class="hint">Jetzt nicht ausspielbar: ' + esc(o.why) + '.</p>'); }
      else if (h) { const c = s.cards[h.cid], k = W.cost(s, actor(s), h.cid); html = cardDetail(c, null, s) + '<p class="hint">Kosten jetzt: <b>' + k + ' Energie</b>' + (k < c.energy ? ' (Gebot der Krone)' : '') + '. ' + (W.summonOptions(s, h.iid).length ? 'Goldene Felder sind frei.' : ['summon1', 'summon2'].includes(s.phase) ? (k > P.energy ? 'Zu wenig Energie.' : 'Kein freies Beschwörungsfeld.') : 'Beschwören nur in den Beschwörungsphasen.') + '</p>'; }
    }
    if (G.cast && !(G.sel && G.sel.kind === 'hand')) html = castPanel() + html;
    html = stackPanel() + html;
    box.innerHTML = html || '<p class="hint">Tippe eine Karte auf dem Brett oder in der Hand an, um sie hier genau zu sehen. Doppelklick oder gedrückt halten zeigt die Karte groß.</p>';
  }
  let logLen = 0;
  function renderLog() {
    const s = G.s, el = $('#log');
    if (s.log.length < logLen) el.innerHTML = '';
    el.innerHTML = s.log.slice().reverse().map(l => '<p class="' + (l.text.startsWith('—') ? 'sep' : 'p' + (l.p === G.view ? 0 : 1)) + '">' + esc(l.text.replace(/^— | —$/g, '')) + '</p>').join('');
    logLen = s.log.length;
  }
  // Zerstörung: Kampf → Karte reißt in zwei Hälften, Poison → zerfällt in Stücke, Fluch/Zerstören → zersplittert
  function destroyAnim(el, cause) {
    const face = el.querySelector('.face');
    if (!face || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.style.opacity = 0; setTimeout(() => el.remove(), 350); return; }
    el.classList.add('dying', cause === 'poison' ? 'poison' : cause === 'destroy' ? 'destroy' : 'combat');
    const rnd = (a, b) => a + Math.random() * (b - a);
    // Risskante: zackige Linie von oben nach unten
    const pts = []; for (let i = 0; i <= 8; i++) pts.push([50 + rnd(-9, 9), i * 12.5]);
    const path = pts.map(p => p[0].toFixed(1) + '% ' + p[1] + '%').join(', '), back = pts.slice().reverse().map(p => p[0].toFixed(1) + '% ' + p[1] + '%').join(', ');
    let pieces;
    if (cause === 'poison') {
      // Zerfall: 3×3 Stücke, sinken nach unten
      pieces = []; const n = 3;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const x0 = c * 100 / n, x1 = (c + 1) * 100 / n, y0 = r * 100 / n, y1 = (r + 1) * 100 / n, j = () => rnd(-4, 4); pieces.push({ clip: 'polygon(' + (x0 + j()) + '% ' + (y0 + j()) + '%, ' + (x1 + j()) + '% ' + (y0 + j()) + '%, ' + (x1 + j()) + '% ' + (y1 + j()) + '%, ' + (x0 + j()) + '% ' + (y1 + j()) + '%)', dx: (c - 1) * rnd(20, 45), dy: rnd(40, 90), rot: rnd(-50, 50) }); }
    } else {
      // Zerspringen (Kampf und Zerstören): Risse vom Einschlagpunkt, Scherben fliegen nach außen
      const cx = rnd(38, 62), cy = rnd(36, 60), ring = [], N = 14;
      for (let k = 0; k < N; k++) { const a = (k + rnd(-.3, .3)) / N * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a); const t = Math.min(dx > 0 ? (100 - cx) / dx : dx < 0 ? -cx / dx : 1e9, dy > 0 ? (100 - cy) / dy : dy < 0 ? -cy / dy : 1e9); ring.push([cx + dx * t, cy + dy * t, a]); }
      // Ecken ergänzen, damit nichts fehlt
      const corners = [[0, 0], [100, 0], [100, 100], [0, 100]].map(([x, y]) => [x, y, Math.atan2(y - cy, x - cx)]);
      const pts = ring.concat(corners).map(p => [p[0], p[1], (p[2] + Math.PI * 2) % (Math.PI * 2)]).sort((a, b) => a[2] - b[2]);
      pieces = [];
      for (let k = 0; k < pts.length; k++) {
        const p1 = pts[k], p2 = pts[(k + 1) % pts.length], mx = (p1[0] + p2[0] + cx) / 3, my = (p1[1] + p2[1] + cy) / 3, d = Math.hypot(mx - cx, my - cy) || 1;
        const sp = rnd(60, 130) * (cause === 'destroy' ? 1.2 : 1);
        pieces.push({ clip: 'polygon(' + cx + '% ' + cy + '%, ' + p1[0].toFixed(1) + '% ' + p1[1].toFixed(1) + '%, ' + p2[0].toFixed(1) + '% ' + p2[1].toFixed(1) + '%)', dx: (mx - cx) / d * sp, dy: (my - cy) / d * sp + rnd(20, 60), rot: rnd(-160, 160) });
      }
      // Risslinien kurz aufblitzen lassen
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'cracks'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
      svg.innerHTML = ring.map(p => '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>').join('');
      el.appendChild(svg); svg.animate([{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 1, offset: .6 }, { opacity: 0 }], { duration: 420, fill: 'forwards' });
      const b = $('#board'); if (b && b.animate) b.animate([{ transform: 'none' }, { transform: 'translate(2px,-1px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'none' }], { duration: 260, delay: 150 });
    }
    const dur = cause === 'poison' ? 1400 : 1300;
    for (const pc of pieces) {
      const sh = document.createElement('div'); sh.className = 'shard'; sh.style.clipPath = pc.clip; sh.appendChild(face.cloneNode(true)); sh.firstChild.style.visibility = 'visible'; el.appendChild(sh);
      const z = cause === 'poison' ? 1 : .6;
      sh.animate([{ transform: 'none', opacity: 1 }, { transform: 'none', opacity: 1, offset: cause === 'poison' ? .05 : .26, easing: 'cubic-bezier(.15,.6,.35,1)' }, { transform: 'translate(' + pc.dx * .75 + '%, ' + pc.dy * .45 + '%) rotate(' + pc.rot * .75 + 'deg) scale(' + (z + .3) + ')', opacity: 1, offset: .7, easing: 'ease-in' }, { transform: 'translate(' + pc.dx + '%, ' + pc.dy + '%) rotate(' + pc.rot + 'deg) scale(' + z + ')', opacity: 0 }], { duration: dur, easing: 'linear', fill: 'forwards' });
    }
    const fl = document.createElement('div'); fl.className = 'tear-flash'; if (cause === 'poison') fl.style.background = 'radial-gradient(circle, #c8ff8a55 0, #6fbf2a44 35%, transparent 70%)'; if (cause === 'destroy') fl.style.background = 'radial-gradient(circle, #fff8 0, #9a5cf066 35%, transparent 70%)'; el.appendChild(fl);
    for (let i = 0; i < 14; i++) { const sp = document.createElement('i'); sp.className = 'spark'; el.appendChild(sp); const a = rnd(0, Math.PI * 2), d = rnd(30, 90); sp.animate([{ transform: 'translate(-50%,-50%)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + Math.cos(a) * d + 'px), calc(-50% + ' + Math.sin(a) * d + 'px)) scale(.3)', opacity: 0 }], { duration: rnd(500, 900), easing: 'ease-out', fill: 'forwards' }); }
    setTimeout(() => el.remove(), dur + 80);
  }
  function floatAt(f, text, cls) {
    const P = pos(f), el = document.createElement('div'); el.className = 'float ' + (cls || ''); el.textContent = text;
    el.style.left = (P.left + P.w / 2) + '%'; el.style.top = (P.top + P.h / 2) + '%'; $('#board').appendChild(el); setTimeout(() => el.remove(), 1400);
  }
  function playEvents(evs) {
    const s = G.s;
    for (const e of evs) {
      if (e.t === 'kingDamage') { const k = s.units[e.uid]; if (k) { floatAt(k.pos, '−' + fmt(e.dmg)); const el = tokEls.get(e.uid); if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } } }
      if (e.t === 'drawFail') { const k = s.units[e.uid]; if (k) floatAt(k.pos, '−' + fmt(e.dmg) + ' (Stapel leer)'); }
      if (e.t === 'poisoned') { const u = s.units[e.uid]; if (u) floatAt(u.pos, '☠ Poison', 'green'); }
      if (e.t === 'combat') for (const h of e.hits) for (const id of [h.a, h.t]) { const el = tokEls.get(id); if (el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } }
      if (e.t === 'blocked') { const u = s.units[e.uid]; if (u) floatAt(u.pos, 'abgewehrt', 'green'); }
      if (e.t === 'cast') { const k = W.kingOf(s, e.p); if (k) floatAt(k.pos, (s.cards[e.cid].type === 'curse' ? '☾ ' : '✦ ') + s.cards[e.cid].name, s.cards[e.cid].type === 'curse' ? 'purple' : 'green'); }
      if (e.t === 'spellFx') { const u = s.units[e.uid]; if (u) floatAt(u.pos, (s.cards[e.cid].type === 'curse' ? '☾ ' : '✦ ') + s.cards[e.cid].name, s.cards[e.cid].type === 'curse' ? 'purple' : 'green'); }
      if (e.t === 'control') { const u = s.units[e.uid]; if (u) floatAt(u.pos, '⇄ Kontrolle', 'gold'); }
      if (e.t === 'warded') { const u = s.units[e.uid]; if (u) floatAt(u.pos, 'bewahrt', 'green'); }
      if (e.t === 'kingHeal') { const k = s.units[e.uid]; if (k && e.amount) floatAt(k.pos, '+' + fmt(e.amount) + ' HP', 'green'); }
      if (e.t === 'lock') for (const f of e.fields) floatAt(f, '🔒', 'purple');
      if (e.t === 'neutralized') toast('Neutralisiert – beide Karten sind verbraucht.');
      if (e.t === 'gift') { const u = s.units[e.uid]; if (u) floatAt(u.pos, giftInfo(e.gift).name); const t = e.target && s.units[e.target]; if (t && t.uid !== e.uid) floatAt(t.pos, e.gift === 'fesseln' ? '⛓ gefesselt' : e.gift === 'entwaffnen' ? '−500 DEF' : e.gift === 'heilung' ? 'geheilt' : giftInfo(e.gift).name, e.gift === 'heilung' ? 'green' : 'red'); }
    }
  }
  function tickTimer() {
    const el = $('#clock');
    if (!G || !G.timer || G.s.result || !G.deadline) { el.textContent = ''; return; }
    const left = Math.max(0, Math.ceil((G.deadline - Date.now()) / 1000));
    el.textContent = '⏱ ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); el.classList.toggle('low', left <= 15);
    if (left === 0 && myTurn() && !G.timeoutSent) { G.timeoutSent = true; toast('Zeit abgelaufen – der Zug wird abgeschlossen.'); if (G.s.pendingDiscard !== null) { const P = G.s.players[G.s.pendingDiscard]; dispatch({ type: 'discard', p: G.s.pendingDiscard, iid: P.hand[P.hand.length - 1].iid }); closeDialog(); } dispatch({ type: 'timeout' }); }
    if (left > 0) G.timeoutSent = false;
  }
  setInterval(() => { if (G && G.timer && !$('#v-game').hidden) tickTimer(); }, 500);

  /* ================= Profilbilder ================= */
  const PROF = (() => {
    const KEY = 'wok-spiel-avatars', DEF = { p1: 'b:junger-koenig', p2: 'b:alter-koenig', ai: 'b:ritter' };
    const BUILT = [['ritter', 'Übungsritter'], ['junger-koenig', 'Junger König'], ['alter-koenig', 'Alter König'], ['haendler', 'Händler']];
    const all = () => Object.assign({}, DEF, LS.get(KEY) || {});
    const srcOf = v => !v ? '' : v.startsWith('b:') ? (((window.WOK_MENU || {}).mates || {})[v.slice(2)] || '') : v;
    const src = k => srcOf(all()[k]);
    function set(k, v) { const a = all(); a[k] = v; try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { toast('Der Browser-Speicher ist voll – Bild zu groß.'); } schedulePersist(); }
    const label = k => k === 'p1' ? SET.name1 : k === 'p2' ? SET.name2 : 'KI-Gegner';
    function dlg(k, after) {
      const cur = all()[k];
      dialog('<h2>Profilbild: ' + esc(label(k)) + '</h2><p class="muted">Erscheint zu Beginn jedes Duells und in der Spielerleiste.</p><div class="avpick">' + BUILT.map(([id, n]) => '<button class="avopt' + (cur === 'b:' + id ? ' on' : '') + '" data-act="b:' + id + '"><i style="background-image:url(' + srcOf('b:' + id) + ')"></i><span>' + esc(n) + '</span></button>').join('')
        + (cur && !cur.startsWith('b:') ? '<button class="avopt on" data-act="keep"><i style="background-image:url(' + cur + ')"></i><span>Eigenes Bild</span></button>' : '') + '</div><div class="row"><label class="btn" for="avup">📷 Eigenes Bild hochladen</label><input type="file" id="avup" accept="image/*" hidden><button class="btn primary" data-act="close">Fertig</button></div>',
        act => { if (act.startsWith('b:')) { set(k, act); if (after) after(); dlg(k, after); return false; } if (after) after(); }, { dismiss: true });
      $('#avup').onchange = async e => {
        const f = e.target.files[0]; if (!f) return; const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(f); }); if (!im) return;
        const side = Math.min(im.naturalWidth, im.naturalHeight), cv = document.createElement('canvas'); cv.width = cv.height = 256;
        cv.getContext('2d').drawImage(im, (im.naturalWidth - side) / 2, (im.naturalHeight - side) / 3, side, side, 0, 0, 256, 256);
        set(k, cv.toDataURL('image/jpeg', .82)); if (after) after(); dlg(k, after);
      };
    }
    return { src, dlg, all };
  })();
  const avHTML = (src, cls) => '<span class="av ' + (cls || '') + '"' + (src ? ' style="background-image:url(' + src + ')"' : '') + '>' + (src ? '' : '👤') + '</span>';

  /* ================= Präsentation: Auftritte, Zauber-Einblendung, Klang, Begleiter, Aussehen ================= */
  const ANIM = () => SET.anim !== false;            // Auftritts-Animationen und Einblendungen
  const SFX = (() => {
    let ctx = null;
    const ac = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx; };
    const vol = () => SET.sfx === false ? 0 : Math.max(0, Math.min(1, SET.volume === undefined ? 0.55 : +SET.volume));
    function thump(strength) {
      const c = ac(), v = vol(); if (!c || !v) return; const t = c.currentTime, k = strength || 1;
      const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(38, t + .55);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * v * k, t + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + .9); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 1);
      const len = Math.floor(c.sampleRate * .35), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const n = c.createBufferSource(), f = c.createBiquadFilter(), g2 = c.createGain(); n.buffer = buf; f.type = 'lowpass'; f.frequency.value = 420; g2.gain.value = 0.55 * v * k; n.connect(f).connect(g2).connect(c.destination); n.start(t);
    }
    function chime(up) {
      const c = ac(), v = vol(); if (!c || !v) return; const t = c.currentTime;
      (up ? [523, 659, 784] : [392, 330, 262]).forEach((fq, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = fq; g.gain.setValueAtTime(0.0001, t + i * .07); g.gain.exponentialRampToValueAtTime(.22 * v, t + i * .07 + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * .07 + .5); o.connect(g).connect(c.destination); o.start(t + i * .07); o.stop(t + i * .07 + .6); });
    }
    function swish() {
      const c = ac(), v = vol(); if (!c || !v) return; const t = c.currentTime, len = Math.floor(c.sampleRate * .4), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
      const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); n.buffer = buf; f.type = 'bandpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3200, t + .35); g.gain.value = .3 * v; n.connect(f).connect(g).connect(c.destination); n.start(t);
    }
    return { thump, chime, swish, unlock: ac };
  })();
  const ELGLOW = { feuer: '#ff7a3a', wasser: '#4aa8ff', erde: '#c8a060', wind: '#6fe0b0', blitz: '#ffe14a', licht: '#fff1b0', dunkelheit: '#b070ff' };
  const FX = (() => {
    const layer = () => $('#fxlayer');
    let q = [], busy = false;
    function push(fn, ms) { q.push([fn, ms]); if (!busy) next(); }
    function next() {
      const it = q.shift(); if (!it) { busy = false; const l = layer(); l.hidden = true; l.innerHTML = ''; l.onclick = null; return; }
      busy = true; const l = layer(); l.hidden = false; l.innerHTML = ''; let done = false;
      const end = () => { if (done) return; done = true; clearTimeout(t); l.classList.add('out'); setTimeout(() => { l.classList.remove('out'); next(); }, 260); };
      l.onclick = end; it[0](l); const t = setTimeout(end, it[1]);
    }
    const art = c => fullURL(c.id) ? '<img src="' + fullURL(c.id) + '" alt="">' : '<div class="fx-noimg ' + (c.type || '') + '"><b>' + esc(c.name) + '</b><span>' + esc(TYPEN(c)) + '</span></div>';
    function cutIn(c, owner) {
      if (!ANIM()) return;
      const col = ELGLOW[c.elements && c.elements[0]] || '#ecd08f', mine = G && owner === G.view;
      push(l => {
        l.innerHTML = '<div class="cutin ' + (mine ? 'mine' : 'foe') + '" style="--glow:' + col + '"><i class="rays"></i><div class="ci-card">' + art(c) + '<i class="ci-shine"></i></div><div class="ci-text"><small>' + (c.type === 'king' ? 'König' : esc(RAR(c.rarity)) + ' · ' + (mine ? 'deine Beschwörung' : 'gegnerische Beschwörung')) + '</small><b>' + esc(c.name) + '</b></div><span class="fx-skip">Antippen zum Überspringen</span></div>';
        SFX.thump(1);
      }, 1750);
    }
    function versus(s) {
      if (!ANIM()) return;
      const k = [0, 1].map(p => s.cards[W.kingOf(s, p).cid]), me = G ? G.view : 0;
      push(l => {
        const av = (G && G.avatars) || [];
        const side = (c, p, cls) => '<div class="vs-side ' + cls + '" style="--glow:' + (ELGLOW[c.elements[0]] || '#ecd08f') + '">' + avHTML(av[p], 'vs-av') + '<div class="vs-who"><b>' + esc(s.players[p].name) + '</b><small>♛ ' + esc(c.name) + '</small></div><div class="vs-card">' + art(c) + '</div></div>';
        l.innerHTML = '<div class="versus">' + side(k[1 - me], 1 - me, 'top') + '<div class="vs-mid"><span>VS</span><small>' + esc(s.players[s.active].name) + ' beginnt</small></div>' + side(k[me], me, 'bot') + '<span class="fx-skip">Antippen zum Überspringen</span></div>';
        SFX.thump(1.2);
      }, 2300);
    }
    // Zauber/Flüche dieser Auswertung: als Kette in der Mitte, neutralisierte zerbrechen
    function chain(s, list, title) {
      if (!ANIM() || !list.length) return;
      push(l => {
        l.innerHTML = '<div class="chainfx"><span class="eyebrow">' + esc(title || 'Auswertung nach der Konterphase') + '</span><div class="ch-row">' + list.map((x, i) => '<div class="ch-card ' + x.c.type + (x.canceled ? ' cancel' : '') + '" style="--i:' + i + '"><span class="ch-n">' + (i + 1) + '</span>' + art(x.c) + (x.canceled ? '' : x.c.type === 'curse' ? smokeHTML(8) : sparkHTML(10)) + '<small>' + esc(s.players[x.p] ? s.players[x.p].name : '') + '</small>' + (x.canceled ? '<em>neutralisiert</em>' : '') + '</div>').join('') + '</div><span class="fx-skip">Antippen zum Überspringen</span></div>';
        SFX.swish();
      }, 1300 + list.length * 450);
    }
    // Aktivierung: Flüche lassen dunklen Rauch aus der Karte steigen, Zauber leuchten mit Runen und Funken in Kartenfarbe
    const rnd = (a, b) => (a + Math.random() * (b - a)).toFixed(2);
    function smokeHTML(n) { let h = ''; for (let i = 0; i < n; i++) h += '<i style="--x:' + rnd(-46, 46) + '%;--dx:' + rnd(-30, 30) + 'vw;--d:' + rnd(0, .9) + 's;--s:' + rnd(1.6, 3.4) + ';--t:' + rnd(1.5, 2.3) + 's"></i>'; return '<span class="smoke">' + h + '</span>'; }
    function sparkHTML(n) { let h = ''; for (let i = 0; i < n; i++) h += '<i style="--x:' + rnd(-50, 50) + '%;--dx:' + rnd(-14, 14) + 'vw;--d:' + rnd(0, 1) + 's;--s:' + rnd(.5, 1.4) + ';--t:' + rnd(1.1, 1.9) + 's"></i>'; return '<span class="sparks">' + h + '</span>'; }
    function castFx(c, p) {
      if (!ANIM() || !c) return; const curse = c.type === 'curse', mine = G && p === G.view;
      push(l => {
        l.innerHTML = '<div class="castfx ' + (curse ? 'curse' : 'spell') + '">' + (curse ? '' : '<i class="runes"></i><i class="runes r2"></i><i class="burst"></i>') + '<div class="cf-card">' + art(c) + '<i class="cf-glow"></i></div>' + (curse ? smokeHTML(24) : sparkHTML(28))
          + '<div class="cf-text"><small>' + (mine ? 'Du aktivierst' : 'Gegner aktiviert') + ' ' + (curse ? 'einen Fluch' : 'einen Zauber') + '</small><b>' + esc(c.name) + '</b></div><span class="fx-skip">Antippen zum Überspringen</span></div>';
        if (curse) { SFX.swish(); SFX.thump(.35); } else SFX.chime(true);
      }, 1900);
    }
    function banner(text, cls) { if (!ANIM()) return; push(l => { l.innerHTML = '<div class="fxbanner ' + (cls || '') + '"><b>' + esc(text) + '</b></div>'; SFX.chime(cls !== 'lose'); }, 1500); }
    function onEvents(s, evs) {
      if (!G || G.replay && G.replay.silent) return;
      G.castMap = G.castMap || {};
      for (const e of evs) {
        if (e.t === 'start') versus(s);
        if (e.t === 'control' && evs.some(x => x.t === 'cast' && x.now)) banner('⚔ Übernommen – greift mit an!');
        if (e.t === 'summon' && !e.revive) { const c = s.cards[e.cid]; if (c && c.type === 'hero' && c.rarity === 'legendaer') cutIn(c, e.p); else SFX.swish(); }
        if (e.t === 'cast') { G.castMap[e.sid] = { cid: e.cid, p: e.p }; castFx(s.cards[e.cid], e.p); }
        if (e.t === 'spellsResolve') { const done = Object.fromEntries(evs.filter(x => x.t === 'spellDone').map(x => [x.sid, x.canceled])); chain(s, e.sids.map(sid => G.castMap[sid] && { c: s.cards[G.castMap[sid].cid], p: G.castMap[sid].p, canceled: !!done[sid] }).filter(x => x && x.c), evs.some(x => x.t === 'cast' && x.now) ? 'Wirkt sofort – vor den Angriffen' : ''); }
        if (e.t === 'death') SFX.thump(.45);
      }
    }
    return { cutIn, versus, chain, banner, onEvents, get busy() { return busy; } };
  })();

  // Begleiter („Mate“) und Aussehen je Deck
  const MATES = [['ritter', 'Übungsritter'], ['alter-koenig', 'Der alte König'], ['junger-koenig', 'Der junge König'], ['haendler', 'Der Händler'], ['koenig', 'Dein König (Kartenbild)'], ['none', 'Kein Begleiter']];
  const BACKS = [['blau', 'Königsblau'], ['rot', 'Blutrot'], ['gruen', 'Smaragd'], ['violett', 'Nachtviolett'], ['gold', 'Gold']];
  const SKINS = [['standard', 'Standard'], ['nacht', 'Mondnacht'], ['glut', 'Glut'], ['frost', 'Frost'], ['alt', 'Alte Chronik']];
  const lookOf = d => Object.assign({ back: 'blau', field: 'standard', mate: 'ritter' }, (d && d.look) || {});
  function mateImg(id, kingCid) { const M = (window.WOK_MENU || {}).mates || {}; if (id === 'koenig') return (kingCid && (artURL(kingCid) || fullURL(kingCid))) || M.ritter; return M[id] || ''; }
  const MATE = (() => {
    let t = 0;
    const LINES = { kill: ['Stark gespielt!', 'Der ist erledigt!', 'Weiter so!', 'Ein sauberer Treffer.'], lost: ['Das tat weh …', 'Wir verlieren Boden.', 'Nicht aufgeben!'], kingHit: ['Treffer am König!', 'Die Krone wackelt!', 'Er spürt es!'], ownKing: ['Halt die Stellung!', 'Schütze deinen König!', 'Vorsicht!'], cast: ['Mächtige Magie!', 'Gut gewählt.', 'Das wird ihnen nicht gefallen.'], win: ['Sieg für die Krone!', 'Ein glorreicher Tag!'], lose: ['Beim nächsten Mal …', 'Wir kommen wieder.'], start: ['Auf in die Schlacht!', 'Zeig ihnen, wer herrscht.', 'Ich bin an deiner Seite.'], legend: ['Eine Legende betritt das Feld!', 'Was für ein Auftritt!'] };
    const pick = a => a[Math.floor(Math.random() * a.length)];
    function say(kind) {
      const el = $('#mate'); if (!el || el.hidden) return; const b = $('#mate-say'); b.textContent = pick(LINES[kind] || ['…']);
      el.classList.remove('talk'); void el.offsetWidth; el.classList.add('talk'); clearTimeout(t); t = setTimeout(() => el.classList.remove('talk'), 2600);
    }
    function setup() {
      const el = $('#mate'); if (!el) return; if (!G || G.tutorial || !G.looks) { el.hidden = true; return; }
      const me = G.view, P = G.s.players[me], lk = G.looks[P.deckName] || lookOf(null);
      if (lk.mate === 'none' || SET.mate === false) { el.hidden = true; return; }
      el.hidden = false; el.querySelector('.mate-img').style.backgroundImage = 'url(' + mateImg(lk.mate, W.kingOf(G.s, me).cid) + ')'; el.title = (MATES.find(m => m[0] === lk.mate) || ['', ''])[1];
    }
    function onEvents(s, evs) {
      if (!G || G.tutorial) return; const me = G.view; let k = null;
      for (const e of evs) {
        if (e.t === 'start') k = 'start';
        if (e.t === 'death') { const ow = G.owners || {}; const lost = e.uids.some(u => ow[u] === me), won = e.uids.some(u => ow[u] !== undefined && ow[u] !== me); k = k || (won ? 'kill' : lost ? 'lost' : null); }
        if (e.t === 'kingDamage') k = s.units[e.uid] && s.units[e.uid].owner === me ? 'ownKing' : 'kingHit';
        if (e.t === 'cast' && e.p === me) k = k || 'cast';
        if (e.t === 'summon' && e.p === me && s.cards[e.cid] && s.cards[e.cid].rarity === 'legendaer') k = 'legend';
        if (e.t === 'gameOver') k = e.result.draw ? 'lose' : e.result.winner === me ? 'win' : 'lose';
      }
      if (k) say(k);
    }
    function track(s) { G.owners = Object.fromEntries(Object.values(s.units).map(u => [u.uid, u.owner])); }
    return { setup, say, onEvents, track };
  })();
  function applyLooks() {
    if (!G) return; const s = G.s, b = $('#board'), me = G.view;
    const own = G.looks ? G.looks[s.players[me].deckName] : null, foe = G.looks ? G.looks[s.players[1 - me].deckName] : null;
    b.dataset.skin = own ? own.field : 'standard';
    $('#pb-top').dataset.back = foe ? foe.back : 'blau'; $('#pb-bot').dataset.back = own ? own.back : 'blau';
    $('#insp').dataset.back = own ? own.back : 'blau';
  }

  /* ================= Wiederholungen ================= */
  const REPLAYS_KEY = 'wok-spiel-replays';
  function saveReplay() {
    if (!G || !G.rec || G.tutorial || G.replay || G.rec.saved) return; G.rec.saved = true;
    const r = G.s.result, item = { id: 'r' + Date.now().toString(36), date: Date.now(), names: G.s.players.map(P => P.name), result: r ? (r.draw ? 'Unentschieden' : G.s.players[r.winner].name + ' gewinnt') : '', turns: G.s.turn, init: G.rec.init, acts: G.rec.acts, looks: G.looks || null, avatars: G.avatars || null };
    let list = (LS.get(REPLAYS_KEY) || []).filter(x => x && x.id); list.unshift(item); list = list.slice(0, 5);
    while (list.length) { try { localStorage.setItem(REPLAYS_KEY, JSON.stringify(list)); break; } catch (e) { list.pop(); } }
  }
  function replayList() { return (LS.get(REPLAYS_KEY) || []).filter(x => x && x.init && x.acts); }
  function replaysDialog() {
    const L = replayList();
    dialog('<h2>Wiederholungen</h2>' + (L.length ? '<p class="muted">Die letzten ' + L.length + ' beendeten Partien. Du siehst jeden Zug noch einmal.</p><div class="rplist">' + L.map(x => '<button class="btn" data-act="rp:' + x.id + '"><b>' + esc(x.names.join(' gegen ')) + '</b><small>' + new Date(x.date).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) + ' · ' + esc(x.result) + ' · ' + x.acts.length + ' Aktionen</small></button>').join('') + '</div>' : '<p class="muted">Noch keine Wiederholung. Nach jeder beendeten Partie wird sie hier gespeichert (die letzten 5).</p>') + '<div class="row"><button class="btn" data-act="close">Schließen</button></div>',
      act => { if (act.startsWith('rp:')) { const x = L.find(y => y.id === act.slice(3)); if (x) setTimeout(() => playReplay(x), 0); } }, { dismiss: true });
  }
  let rpTimer = 0;
  function playReplay(x) {
    clearTimeout(aiTimer); clearTimeout(rpTimer); closeInspector();
    G = { s: W.clone(x.init), mode: 'replay', aiSide: -1, view: 0, sel: null, gift: null, memo: {}, busy: false, timer: false, deadline: 0, handover: false, looks: x.looks, avatars: x.avatars || [], replay: { x, i: 0, playing: true, speed: 1 } };
    show('game'); $('#log').innerHTML = ''; $('#rpbar').hidden = false; $('#rp-title').textContent = 'Wiederholung: ' + x.names.join(' gegen ');
    MUSIC.start(); render([]); FX.versus(G.s); rpSchedule();
  }
  function rpUpdate() {
    if (!G || !G.replay) return; const R = G.replay;
    $('#rp-pos').textContent = R.i + ' / ' + R.x.acts.length + (G.s.result ? ' · ' + (G.s.result.draw ? 'Unentschieden' : G.s.players[G.s.result.winner].name + ' gewinnt') : '');
    $('#rp-play').textContent = R.playing ? '⏸' : '▶';
  }
  function rpStep(silent) {
    const R = G.replay; if (R.i >= R.x.acts.length) { R.playing = false; rpUpdate(); return false; }
    const r = W.apply(G.s, R.x.acts[R.i]); R.i++;
    if (r.error) { R.playing = false; toast('Wiederholung weicht ab: ' + r.error); rpUpdate(); return false; }
    G.s = r.state; if (!silent) render(r.events); return true;
  }
  function rpSeek(n) {
    const R = G.replay; G.s = W.clone(R.x.init); R.i = 0; R.silent = true;
    while (R.i < n && rpStep(true)) { }
    R.silent = false; G.sel = null; $('#log').innerHTML = ''; logLen = 0; render([]); rpUpdate();
  }
  function rpSchedule() {
    clearTimeout(rpTimer); if (!G || !G.replay) return; rpUpdate(); const R = G.replay; if (!R.playing) return;
    const a = R.x.acts[R.i]; const base = a && (a.type === 'endPhase' || a.type === 'pass') ? 700 : 900;
    rpTimer = setTimeout(() => { if (!G || !G.replay || !R.playing) return; if (FX.busy) { rpSchedule(); return; } if (rpStep(false)) rpSchedule(); else rpUpdate(); }, base / R.speed);
  }
  function rpAct(k) {
    const R = G && G.replay; if (!R) return;
    if (k === 'play') { if (R.i >= R.x.acts.length) rpSeek(0); R.playing = !R.playing; rpSchedule(); }
    if (k === 'next') { R.playing = false; rpStep(false); rpSchedule(); }
    if (k === 'back') { R.playing = false; rpSeek(Math.max(0, R.i - 1)); }
    if (k === 'start') { R.playing = false; rpSeek(0); }
    if (k === 'end') { R.playing = false; rpSeek(R.x.acts.length); }
    if (k === 'close') { clearTimeout(rpTimer); G = null; MUSIC.stop(); $('#rpbar').hidden = true; show('home'); }
    rpUpdate();
  }

  /* ================= Tutorial ================= */
  const TUT = (() => {
    const EFX = window.WOK_EFFECTS, D = window.WOK_DATA;
    const H = (id, name, o) => W.normalizeCard(Object.assign({ id, type: 'hero', name, rarity: 'gewoehnlich', energy: 2, atk: 1000, def: 1000, move: { dirs: { n: 1, e: 1, s: 1, w: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1 } }, gifts: [] }, o));
    const K = (id, name, o) => W.normalizeCard(Object.assign({ id, type: 'king', name, rarity: 'legendaer', atk: 2000, hp: 20000, attack: { dirs: { n: 1, ne: 1, nw: 1 } }, gifts: [] }, o));
    function SP(id, name, type, effects, o) {
      const raw = Object.assign({ id, type, name, rarity: 'gewoehnlich', energy: 1, ruleText: '' }, o || {}); raw.spell = Object.assign(EFX.blankSpell(type), (o && o.spell) || {});
      raw.spell.effects = effects.map(([k, ch]) => { const e = EFX.blankEffect(k, type); for (const [p, v] of Object.entries(ch || {})) { const ks = p.split('.'); let x = e; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; } return e; });
      raw.ruleText = EFX.describe(raw, D); raw.spell.sync = EFX.hash(raw); return W.normalizeCard(raw);
    }
    const CARDS = () => {
      const L = [K('t_ka', 'König Aldric', { element: 'licht', race: 'mensch' }), K('t_kb', 'Königin Morwen', { element: 'dunkelheit', race: 'mensch' }),
        H('t_rek', 'Rekrut', { energy: 2, atk: 1200, def: 1000, element: 'erde', race: 'mensch' }), H('t_wae', 'Schildwächter', { energy: 3, atk: 900, def: 1600, element: 'erde', race: 'mensch' }),
        H('t_kli', 'Klingentänzerin', { energy: 3, atk: 1500, def: 900, element: 'wind', race: 'mensch', move: { dirs: { n: 1, e: 1, s: 1, w: 1 }, showNumber: true, number: 2 }, gifts: [{ id: 'mordlust' }] }),
        H('t_gra', 'Grabwächter', { energy: 2, atk: 800, def: 1000, element: 'dunkelheit', race: 'daemonen' }), H('t_kno', 'Knochenriese', { energy: 4, atk: 1900, def: 1800, element: 'dunkelheit', race: 'daemonen' }),
        H('t_ste', 'Steinwächter', { energy: 3, atk: 700, def: 1500, element: 'erde', race: 'daemonen' }), H('t_fil', 'Rekrut', { energy: 1 }),
        SP('t_flu', 'Schwächefluch', 'curse', [['stat', { 'params.stat': 'def', 'params.amount': -500, 'duration.kind': 'turn', 'target.side': 'enemy' }]], { energy: 1 }),
        SP('t_sch', 'Schild des Lichts', 'spell', [['protect', { trigger: 'enemyAttack', 'duration.kind': 'turn' }]], { energy: 0, spell: { timing: 'counter' } })];
      return Object.fromEntries(L.map(c => [c.id, c]));
    };
    function base(o) {
      const cards = CARDS(), deck = k => [k].concat(Array(39).fill('t_fil'));
      const s = W.newGame({ cards, decks: [deck('t_ka'), deck('t_kb')], seed: 11, fixedSides: true, sideNames: [SET.name1 || 'Du', 'Übungsgegner'] }).state;
      for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
      s.players.forEach(P => { P.hand = []; P.energy = 0; P.turns = 4; }); s.turn = 7; s.active = 0; s.phase = o.phase || 'summon1'; s.counter = null; s.pendingDiscard = null; s.stack = []; s.decl = {}; s.retreat = []; s.auras = []; s.locks = []; s.result = null;
      s.players[0].energy = o.energy || 0; s.log = [];
      return s;
    }
    const put = (s, cid, owner, pos, o) => { const uid = 'u' + (s.nextId++); s.units[uid] = Object.assign({ uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }, o || {}); return uid; };
    const hand = (s, p, cid) => { const iid = 'h' + (s.nextId++); s.players[p].hand.push({ iid, cid }); return iid; };
    const ev = (evs, t, f) => evs.some(e => e.t === t && (!f || f(e)));
    const sel = (G, uid) => G.sel && G.sel.uid === uid;
    const LESSONS = [
      { id: 'ziel', title: 'Ziel und Spielfeld', desc: 'Worum es geht, wo die Könige stehen und wie ein Zug abläuft.', min: 2,
        make() { const s = base({ phase: 'summon1', energy: 4 }); hand(s, 0, 't_rek'); hand(s, 0, 't_wae'); return { s }; },
        steps: [
          { text: 'Willkommen bei War of Kings! Unten steht <b>dein König</b>, oben der <b>gegnerische König</b>. Wer den gegnerischen König auf 0 HP bringt, gewinnt.', hl: (S) => ['.tok[data-uid="' + W.kingOf(S, 0).uid + '"]', '.tok[data-uid="' + W.kingOf(S, 1).uid + '"]'], next: true },
          { text: 'Jeder Zug läuft in festen Phasen: <b>1. Beschwörung → Bewegung → Battlephase → Konterphase des Gegners → Auswertung → Nachbeschwörung</b>. Die aktuelle Phase leuchtet hier.', hl: () => ['#phases'], next: true },
          { text: 'Unten siehst du deine <b>Handkarten</b> und deine <b>Energie ⚡</b>. In Zug n hast du n Energie (höchstens 10). Beschwören kostet Energie.', hl: () => ['#hand', '#pb-bot'], next: true },
          { text: 'Jede Karte kannst du groß ansehen: <b>Doppelklick</b> oder <b>gedrückt halten</b>. Probier es am gegnerischen König.', hl: (S) => ['.tok[data-uid="' + W.kingOf(S, 1).uid + '"]'], done: () => !$('#insp').hidden },
          { text: 'Super! In der großen Ansicht stehen alle Werte, Gaben und Zustände. Schließe sie mit ✕ oder Escape.', hl: () => ['.insp-x'], done: () => $('#insp').hidden }
        ] },
      { id: 'beschwoeren', title: 'Helden beschwören', desc: 'Karten aus der Hand aufs Feld bringen und Energie einteilen.', min: 2,
        make() { const s = base({ phase: 'summon1', energy: 5 }); const a = hand(s, 0, 't_rek'), b = hand(s, 0, 't_wae'); return { s, a, b }; },
        steps: [
          { text: 'Tippe den <b>Rekruten</b> in deiner Hand an (kostet 2 Energie).', hl: (S, T) => ['.hcard[data-iid="' + T.a + '"]'], done: (S, T, G) => G.sel && G.sel.iid === T.a },
          { text: 'Die <b>goldenen Felder</b> sind deine Beschwörungsfelder: die Reihe vor deinem König und die Felder links und rechts von ihm. Tippe ein goldenes Feld.', hl: () => ['.cell.hl-summon'], done: (S, T, G, e) => ev(e, 'summon') },
          { text: 'Gut! Ein frisch beschworener Held hat <b>Beschwörungssperre 🔒</b>: Er läuft und greift erst im nächsten Zug an (außer mit der Gabe Ansturm).', next: true },
          { text: 'Du hast noch 3 Energie. Beschwöre auch den <b>Schildwächter</b>: erst die Karte, dann ein goldenes Feld.', hl: (S, T, G) => G.sel && G.sel.iid === T.b ? ['.cell.hl-summon'] : ['.hcard[data-iid="' + T.b + '"]'], done: (S, T, G, e) => ev(e, 'summon') },
          { text: 'Energie verbraucht. Tippe den großen Knopf, um zur nächsten Phase zu gehen.', hl: () => ['#mainbtn'], done: (S) => S.phase === 'move' }
        ] },
      { id: 'laufen', title: 'Laufen', desc: 'Helden bewegen: Schritte, Richtungen und gesperrte Felder.', min: 2,
        make() { const s = base({ phase: 'move' }); const k = put(s, 't_kli', 0, 'D6'); put(s, 't_gra', 1, 'D3'); return { s, k }; },
        steps: [
          { text: 'Tippe deine <b>Klingentänzerin</b> an.', hl: (S, T) => ['.tok[data-uid="' + T.k + '"]'], done: (S, T, G) => sel(G, T.k) },
          { text: 'Die <b>blauen Felder</b> zeigen, wohin sie laufen darf: bis zu 2 Schritte in ihren Laufrichtungen, Richtungswechsel erlaubt, aber nie über besetzte Felder. Tippe <b>D4</b>.', hl: () => ['.cell[data-f="D4"]'], done: (S, T, G, e) => ev(e, 'move') },
          { text: 'Jeder Held läuft einmal pro Zug. Die Felder direkt neben dem gegnerischen König darf man nicht betreten. Jetzt steht deine Klingentänzerin direkt vor dem Grabwächter – bereit für den Angriff.', next: true }
        ] },
      { id: 'kampf', title: 'Angreifen und Kampf', desc: 'Angriffe festlegen und verstehen, wer gewinnt.', min: 3,
        make() { const s = base({ phase: 'battle' }); const k = put(s, 't_kli', 0, 'D4'), g = put(s, 't_gra', 1, 'D3'); return { s, k, g }; },
        steps: [
          { text: 'Battlephase! Tippe deine <b>Klingentänzerin</b> an. Angreifen geht nur auf direkt angrenzende Felder in ihren Angriffsrichtungen (Schütze: 2 Felder).', hl: (S, T) => ['.tok[data-uid="' + T.k + '"]'], done: (S, T, G) => sel(G, T.k) },
          { text: 'Mögliche Ziele sind markiert, mit Vorschau: Wer gewinnt? Tippe den <b>Grabwächter</b> an, um den Angriff festzulegen.', hl: (S, T) => ['.tok[data-uid="' + T.g + '"]'], done: (S, T, G, e) => ev(e, 'declare', x => (x.targets || []).length) },
          { text: 'Angriffe bleiben bis zum Abschluss änderbar. Tippe jetzt <b>Battlephase abschließen</b>. Danach hat der Gegner seine Konterphase, dann wird alles gleichzeitig ausgewertet.', hl: () => ['#mainbtn'], done: (S, T, G, e) => ev(e, 'combat') },
          { text: '<b>ATK 1.500 gegen DEF 1.000</b>: Der Verteidiger fällt. Ist die ATK kleiner als die DEF, fällt der Angreifer. Bei Gleichstand fallen beide. Mehrere Angreifer addieren ihre ATK nicht.', next: true }
        ] },
      { id: 'gaben', title: 'Gaben einsetzen', desc: 'Aktivierbare Fähigkeiten mit Abklingzeit (CT).', min: 3,
        make() { const s = base({ phase: 'battle' }); const k = put(s, 't_kli', 0, 'D4'), g = put(s, 't_kno', 1, 'D3'); return { s, k, g }; },
        steps: [
          { text: 'Der <b>Knochenriese</b> hat DEF 1.800 – deine Klingentänzerin (ATK 1.500) würde verlieren. Tippe sie einmal an.', hl: (S, T) => ['.tok[data-uid="' + T.k + '"]'], done: (S, T, G) => sel(G, T.k) },
          { text: 'Ihre Gaben erscheinen direkt am Helden. Setze <b>Mordlust</b> ein: +500 ATK bis zum Ende des Zuges.', hl: () => ['#qgifts [data-qg="mordlust"]'], done: (S, T, G, e) => ev(e, 'gift') },
          { text: 'Jetzt hat sie 2.000 ATK. „CT 3“ heißt: danach 3 Züge Abklingzeit. Tippe deine Klingentänzerin und dann den <b>Knochenriesen</b> an.', hl: (S, T, G) => sel(G, T.k) ? ['.tok[data-uid="' + T.g + '"]'] : ['.tok[data-uid="' + T.k + '"]'], done: (S, T, G, e) => ev(e, 'declare', x => (x.targets || []).length) },
          { text: 'Tippe <b>Battlephase abschließen</b>.', hl: () => ['#mainbtn'], done: (S, T, G, e) => ev(e, 'combat') },
          { text: 'Geschafft: 2.000 gegen 1.800. Gaben sind sofort verbindlich – setze sie überlegt ein.', next: true }
        ] },
      { id: 'zauber', title: 'Zauber, Flüche und Konterphase', desc: 'Karten ausspielen und auf gegnerische Angriffe antworten.', min: 4,
        make() { const s = base({ phase: 'battle', energy: 3 }); const r = put(s, 't_rek', 0, 'D4'), w = put(s, 't_ste', 1, 'D3'), f = hand(s, 0, 't_flu'); return { s, r, w, f }; },
        steps: [
          { text: 'Dein <b>Rekrut</b> (ATK 1.200) kommt nicht gegen den <b>Steinwächter</b> (DEF 1.500) an. Tippe den <b>Schwächefluch</b> in deiner Hand an und dann „Fluch ausspielen“.', hl: (S, T) => ['.hcard[data-iid="' + T.f + '"]', '[data-cast]'], scroll: '[data-cast]', done: (S, T, G) => !!G.cast },
          { text: 'Wähle den <b>Steinwächter</b> als Ziel und bestätige.', hl: (S, T) => ['.tok[data-uid="' + T.w + '"]', '[data-cok]'], scroll: '[data-cok]', done: (S, T, G, e) => ev(e, 'cast') },
          { text: 'Ausspielen ist verbindlich. Ausgewertet wird erst <b>nach der Konterphase</b> des Gegners. Lege jetzt den Angriff fest: Rekrut → Steinwächter.', hl: (S, T, G) => sel(G, T.r) ? ['.tok[data-uid="' + T.w + '"]'] : ['.tok[data-uid="' + T.r + '"]'], done: (S, T, G, e) => ev(e, 'declare', x => (x.targets || []).length) },
          { text: 'Tippe <b>Battlephase abschließen</b>. Zuerst wirkt der Fluch (DEF −500), dann kämpfen die Helden.', hl: () => ['#mainbtn'], done: (S, T, G, e) => ev(e, 'combat') },
          { text: 'Jetzt greift der Gegner an! Sein <b>Knochenriese</b> (ATK 1.900) zielt auf deinen <b>Schildwächter</b>. In seiner Konterphase bist du dran: Spiele „<b>Schild des Lichts</b>“ (0 Energie) auf deinen angegriffenen Helden.',
            enter(T, G) { const s = G.s; for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid]; T.d = put(s, 't_wae', 0, 'D5'); T.e = put(s, 't_kno', 1, 'D4'); T.p = hand(s, 0, 't_sch'); s.active = 1; s.phase = 'battle'; s.decl = {}; s.stack = []; s.players[1].energy = 0; s.players[0].energy = 0;
              let r = W.apply(s, { type: 'declare', p: 1, uid: T.e, targets: [T.d] }); r = W.apply(r.state, { type: 'endPhase', p: 1 }); G.s = r.state; },
            hl: (S, T, G) => G.cast ? ['.tok[data-uid="' + T.d + '"]', '[data-cok]'] : ['.hcard[data-iid="' + T.p + '"]', '[data-cast]'], scroll: '[data-cast],[data-cok]', done: (S, T, G, e) => ev(e, 'cast') },
          { text: 'Tippe <b>Passen – Konterphase beenden</b>. Dann wird ausgewertet.', hl: () => ['#mainbtn'], done: (S, T, G, e) => ev(e, 'spellsResolve') || ev(e, 'combat') },
          { text: 'Der Schild hat den Angriff abgewehrt! Zauber helfen dir, Flüche schaden dem Gegner. Manche sind nur in der Battlephase oder nur in der Konterphase spielbar – das steht auf der Karte.', next: true }
        ] },
      { id: 'sieg', title: 'Den König besiegen', desc: 'Den gegnerischen König angreifen und die Partie gewinnen.', min: 2,
        make() { const s = base({ phase: 'battle' }); const k = put(s, 't_kli', 0, 'D2'); W.kingOf(s, 1).hp = 1400; return { s, k }; },
        steps: [
          { text: 'Der gegnerische König hat nur noch <b>1.400 HP</b>, und deine Klingentänzerin steht direkt vor ihm. Tippe sie an und dann den <b>gegnerischen König</b>.', hl: (S, T, G) => sel(G, T.k) ? ['.tok[data-uid="' + W.kingOf(S, 1).uid + '"]'] : ['.tok[data-uid="' + T.k + '"]'], done: (S, T, G, e) => ev(e, 'declare', x => (x.targets || []).includes(W.kingOf(S, 1).uid)) },
          { text: 'Könige haben keine DEF – sie verlieren so viele HP, wie der Angreifer ATK hat. Tippe <b>Battlephase abschließen</b>.', hl: () => ['#mainbtn'], done: (S) => !!S.result },
          { text: 'Sieg! Du kennst jetzt die Grundlagen. Baue dir unter <b>Kriegsdecks</b> ein eigenes Deck und fordere die KI heraus.', next: true }
        ] }
    ];
    const done = () => Object.assign({}, LS.get('wok-spiel-tut') || {});
    function renderList() {
      const D0 = done();
      $('#tutgrid').innerHTML = LESSONS.map((L, i) => '<button class="tutcard' + (D0[L.id] ? ' done' : '') + '" data-tut="' + L.id + '"><span class="tn">' + (D0[L.id] ? '✓' : i + 1) + '</span><b>' + esc(L.title) + '</b><span>' + esc(L.desc) + '</span><small>ca. ' + L.min + ' Min.' + (D0[L.id] ? ' · abgeschlossen' : '') + '</small></button>').join('')
        + '<p class="hint">' + Object.keys(D0).filter(k => LESSONS.some(L => L.id === k)).length + ' von ' + LESSONS.length + ' Lektionen abgeschlossen.</p>';
    }
    function start(id) {
      const L = LESSONS.find(x => x.id === id); if (!L) return;
      clearTimeout(aiTimer); const T = L.make();
      G = { s: T.s, mode: 'ai', aiSide: 1, level: 'tutor', view: 0, sel: null, gift: null, memo: {}, busy: false, timer: false, deadline: 0, handover: false, avatars: [PROF.src('p1'), PROF.src('ai')], tutorial: { L, T, i: 0 } };
      show('game'); $('#log').innerHTML = ''; logLen = 0; render([]); enter(); 
    }
    function enter() { const tu = G.tutorial, st = tu.L.steps[tu.i]; if (st && st.enter) { st.enter(tu.T, G); render([]); } box(); setTimeout(() => { apply(); scrollTo(); }, 60); }
    function box() {
      const tu = G && G.tutorial, el = $('#tutbox'); if (!tu) { el.hidden = true; return; } const st = tu.L.steps[tu.i]; el.hidden = false;
      const narrow = innerWidth < 900, side = $('#v-game .side'), game = $('#v-game .game'); if (narrow && el.parentNode !== game) game.prepend(el); if (!narrow && el.parentNode !== side) side.prepend(el);
      const n = LESSONS.indexOf(tu.L) + 1;
      el.innerHTML = '<div class="tb-head"><span class="eyebrow">Lektion ' + n + ' · ' + esc(tu.L.title) + '</span><span class="tb-step">Schritt ' + (tu.i + 1) + ' / ' + tu.L.steps.length + '</span></div><p>' + st.text + '</p><div class="row">' + (st.next ? '<button class="btn small primary" data-tutx="next">' + (tu.i === tu.L.steps.length - 1 ? 'Lektion abschließen ✓' : 'Weiter →') + '</button>' : '<span class="tb-wait">👆 Du bist dran</span>') + '<button class="btn small" data-tutx="quit">Lektion verlassen</button></div>';
    }
    function apply() {
      $$('.tut-hl').forEach(e => e.classList.remove('tut-hl'));
      const tu = G && G.tutorial; if (!tu) return; const st = tu.L.steps[tu.i]; if (!st || !st.hl) return;
      for (const q of st.hl(G.s, tu.T, G) || []) $$(q).forEach(e => e.classList.add('tut-hl'));
    }
    let checking = false;
    function check(evs) {
      const tu = G && G.tutorial; if (!tu || checking) return; const st = tu.L.steps[tu.i];
      checking = true; let hit = false; try { hit = !!(st && st.done && st.done(G.s, tu.T, G, evs || [])); } finally { checking = false; }
      if (hit) advance(); else { apply(); setTimeout(scrollTo, 60); }
    }
    function advance() {
      const tu = G.tutorial; if (tu.i >= tu.L.steps.length - 1) { finish(); return; }
      tu.i++; enter();
    }
    function finish() {
      const tu = G.tutorial, D0 = done(); D0[tu.L.id] = Date.now(); LS.set('wok-spiel-tut', D0); schedulePersist();
      const k = LESSONS.indexOf(tu.L), nx = LESSONS[k + 1];
      FX.banner('Lektion geschafft!', 'win');
      dialog('<span class="eyebrow">Tutorial</span><h2>Lektion „' + esc(tu.L.title) + '“ geschafft ✓</h2><p class="muted">' + (nx ? 'Weiter mit „' + esc(nx.title) + '“?' : 'Du hast alle Lektionen abgeschlossen. Viel Erfolg in der Schlacht!') + '</p><div class="row">' + (nx ? '<button class="btn primary" data-act="next">Nächste Lektion</button>' : '<button class="btn primary" data-act="play">Gegen die KI spielen</button>') + '<button class="btn" data-act="list">Zur Übersicht</button></div>',
        act => { G = null; $('#tutbox').hidden = true; if (act === 'next') setTimeout(() => start(nx.id), 0); else if (act === 'play') { show('home'); openSetup('ai'); } else show('tutorial'); });
    }
    function quit() { closeInspector(); G = null; clearTimeout(aiTimer); $('#tutbox').hidden = true; $$('.tut-hl').forEach(e => e.classList.remove('tut-hl')); show('tutorial'); }
    // Übungsgegner: macht nichts außer weiterschalten und passen
    function ai(p) { const s = G.s; if (s.pendingDiscard !== null) return null; if (s.phase === 'counter') return { type: 'pass', p }; return { type: 'endPhase', p }; }
    let lastScroll = '';
    function scrollTo() {
      const tu = G && G.tutorial, st = tu && tu.L.steps[tu.i]; if (!st || innerWidth >= 900) return;
      const e = (st.scroll && $(st.scroll)) || $('.tut-hl'); if (!e) return; const key = tu.L.id + tu.i + (e.dataset.iid || e.dataset.uid || e.id || e.className);
      if (key === lastScroll) return; lastScroll = key; e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return { LESSONS, renderList, start, check, apply, box, quit, advance, ai, scrollTo };
  })();

  /* ================= Packs öffnen (Vorschau im Basar) ================= */

  /* ================= Starter-Set, Packs und Sammlung (Festlegung des Entwicklers vom 30.10.2026) =================
   * Starter-Set: für jeden Spieler gleich, höchstens 50 Karten (Kopien zählen mit) – kommt aus der Kartenwerkstatt.
   * Packs: alle übrigen verteilten Karten, nur über Packs. 7er- und 12er-Pack, ein 12er zählt beim Zähler als 1 Pack.
   * Pro Pack: Legendär (Held, Zauber, Fluch) 3 % – sicher nach 50 Packs ohne; Legendärer König 0,5 % – sicher nach 150 Packs ohne.
   *   Zwei getrennte Zähler, jeder springt auf 0, sobald eine Karte seiner Gruppe kommt.
   *   Selten: 40 % genau eine, 5 % zwei. Der Rest Gewöhnlich/Ungewöhnlich.
   * Doppelte gegen Gold: Legendär 1500, Selten 100, Ungewöhnlich 2, Gewöhnlich 1.
   * Annahmen der Werkstatt (änderbar): Gewöhnlich/Ungewöhnlich im Verhältnis 70 : 30; 12er-Pack mit gleichen Chancen;
   *   „doppelt“ = mehr Kopien als im Deck erlaubt (3/3/2/1, König 1); Starter-Karten werden nie eingetauscht;
   *   fehlt eine Gruppe in den Packs, läuft ihr Zähler nicht. Gold und Echtgeld kommen später – jetzt gibt es Test-Gold. */
  const ECON = (() => {
    const KEY = 'wok-spiel-econ';
    const ODDS = { hero: 0.03, king: 0.005, heroPity: 50, kingPity: 150, rare2: 0.05, rare1: 0.40, uncommon: 0.30 };
    const VALUE = { legendaer: 1500, selten: 100, ungewoehnlich: 2, gewoehnlich: 1 };
    let E = Object.assign({ mode: 'test', starter: {}, pack: [], coll: {}, gold: 0, pity: { hero: 0, king: 0 }, opened: 0 }, LS.get(KEY) || {});
    const save = () => LS.set(KEY, E);
    const player = () => E.mode === 'player';
    const card = id => POOL.cards[id];
    const starterIds = () => Object.keys(E.starter).filter(card);
    const starterTotal = () => starterIds().reduce((a, id) => a + E.starter[id], 0);
    const packCards = () => E.pack.map(card).filter(Boolean);
    const owned = id => (E.starter[id] || 0) + (E.coll[id] || 0);
    const lim = c => c.type === 'king' ? 1 : (W.COPY_LIMIT[c.rarity] || 1);
    // Werkstatt-Datei übernehmen: Starter-/Pack-Export ersetzt die ganze Gruppe; jede Karte bringt ihre Verteilung mit
    function applyImport(doc) {
      const list = doc.cards || [], kind = doc.kind || 'test';
      let st = 0, pk = 0;
      if (kind === 'starter') E.starter = {};
      if (kind === 'packs') E.pack = [];
      for (const raw of list) {
        const id = raw.id; if (!id) continue;
        if (raw.pool === 'starter' || kind === 'starter') { E.starter[id] = Math.max(1, Math.min(raw.type === 'king' ? 1 : (W.COPY_LIMIT[raw.rarity || 'gewoehnlich'] || 1), +raw.starterCount || 1)); E.pack = E.pack.filter(x => x !== id); st++; }
        else if (raw.pool === 'pack' || kind === 'packs') { if (!E.pack.includes(id)) E.pack.push(id); delete E.starter[id]; pk++; }
        else { delete E.starter[id]; E.pack = E.pack.filter(x => x !== id); }
      }
      save();
      if (kind === 'starter') return 'Starter-Set übernommen: ' + starterTotal() + ' / 50 Karten.';
      if (kind === 'packs') return pk + ' Karten liegen jetzt in den Packs.';
      return st || pk ? 'Verteilung: ' + st + ' Starter, ' + pk + ' Pack.' : '';
    }
    const pickOne = l => l[Math.floor(Math.random() * l.length)];
    // Ein Pack ziehen. commit = Sammlung und Zähler wirklich ändern; sonst nur Vorschau
    function roll(n, commit) {
      let P = packCards(); const preview = !commit || !P.length;
      if (!P.length) P = Object.values(POOL.cards);
      if (!P.length) return null;
      const legK = P.filter(c => c.rarity === 'legendaer' && c.type === 'king'), legH = P.filter(c => c.rarity === 'legendaer' && c.type !== 'king');
      const low = P.filter(c => c.rarity !== 'legendaer'), by = r => low.filter(c => c.rarity === r);
      const rare = by('selten'), unc = by('ungewoehnlich'), com = by('gewoehnlich');
      const pity = Object.assign({}, E.pity), out = [], why = [];
      if (legK.length) { pity.king++; const sure = pity.king >= ODDS.kingPity; if (sure || Math.random() < ODDS.king) { if (sure) why.push('king'); out.push(pickOne(legK)); pity.king = 0; } }
      if (legH.length) { pity.hero++; const sure = pity.hero >= ODDS.heroPity; if (sure || Math.random() < ODDS.hero) { if (sure) why.push('hero'); out.push(pickOne(legH)); pity.hero = 0; } }
      const x = Math.random(), nr = x < ODDS.rare2 ? 2 : x < ODDS.rare2 + ODDS.rare1 ? 1 : 0;
      for (let i = 0; i < nr && out.length < n; i++) out.push(pickOne(rare.length ? rare : unc.length ? unc : low.length ? low : P));
      while (out.length < n) { const l = Math.random() < ODDS.uncommon ? (unc.length ? unc : com) : (com.length ? com : unc); out.push(pickOne(l.length ? l : low.length ? low : P)); }
      out.sort((a, b) => RORD[a.rarity] - RORD[b.rarity]);
      const news = new Set();
      if (!preview) { for (const c of out) { if (!owned(c.id)) news.add(c.id); E.coll[c.id] = (E.coll[c.id] || 0) + 1; } E.pity = pity; E.opened++; save(); }
      return { cards: out, news, preview, credit: !preview, pity: preview ? [] : why };
    }
    function buy(pk) {
      if (!packCards().length) { toast('Es liegen noch keine Karten in den Packs. In der Kartenwerkstatt Karten markieren → „📦 In die Packs“ → „Fürs Probe-Spiel“ → Pack-Karten exportieren.', 8000); return null; }
      if (E.gold < pk.gold) { toast('Zu wenig Gold: ' + fmt(E.gold) + ' von ' + fmt(pk.gold) + '. Zum Testen im Basar „+ Test-Gold“ antippen.', 6000); return null; }
      E.gold -= pk.gold; save(); return roll(pk.n, true);
    }
    // Doppelte: alles über dem Deck-Limit; nur Kopien aus Packs, Starter-Karten bleiben
    function surplus() { return Object.keys(E.coll).map(card).filter(Boolean).map(c => ({ c, n: Math.min(E.coll[c.id], owned(c.id) - lim(c)) })).filter(x => x.n > 0); }
    function exchange() { let g = 0, k = 0; for (const { c, n } of surplus()) { E.coll[c.id] -= n; if (!E.coll[c.id]) delete E.coll[c.id]; g += n * (VALUE[c.rarity] || 1); k += n; } E.gold += g; save(); return { gold: g, cards: k }; }
    function missing(d) { if (!player() || !d) return []; const cnt = {}; for (const id of d.cards) cnt[id] = (cnt[id] || 0) + 1; return Object.keys(cnt).filter(id => card(id) && cnt[id] > owned(id)).map(id => ({ c: card(id), need: cnt[id], have: owned(id) })); }
    function setMode(m) { E.mode = m; save(); }
    function addGold(n) { E.gold += n; save(); }
    function reset() { E.coll = {}; E.gold = 0; E.pity = { hero: 0, king: 0 }; E.opened = 0; save(); }
    // Die Garantie (Zähler) bleibt verborgen – angezeigt werden nur die Chancen (Festlegung des Entwicklers vom 30.10.2026)
    function oddsHTML() {
      return '<h2>Chancen pro Pack</h2><table class="odds"><tr><td>Legendärer Held, Zauber oder Fluch</td><td><b>3 %</b></td></tr><tr><td>Legendärer König</td><td><b>0,5 %</b></td></tr><tr><td>Seltene Karte</td><td><b>40 %</b> eine · <b>5 %</b> zwei</td></tr><tr><td>Übrige Karten</td><td>Gewöhnlich und Ungewöhnlich</td></tr></table>'
        + '<p class="muted">Gleiche Chancen im 7er- und 12er-Pack.</p><p class="muted">Doppelte tauschen: Legendär 1500 · Selten 100 · Ungewöhnlich 2 · Gewöhnlich 1 Gold.</p>';
    }
    return { get E() { return E; }, ODDS, VALUE, player, owned, lim, starterIds, starterTotal, packCards, applyImport, roll, buy, surplus, exchange, missing, setMode, addGold, reset, oddsHTML };
  })();
  window.WOK_ECON = ECON; window.WOK_ECON_POOL = () => POOL.cards; // für Tests
  function openPack(pk, res) {
    res = res || ECON.roll(pk.n, false);
    const ov = $('#packov');
    if (!res) { toast('Für die Vorschau zuerst Karten laden (Kriegsdecks → Spielpaket laden).', 5000); return; }
    const cards = res.cards;
    ov.hidden = false; ov.className = 'packov stage1';
    ov.innerHTML = '<div class="po-pack ' + pk.cls + '"><img src="' + pk.img + '" alt=""><i class="po-tear"></i></div><p class="po-hint">Tippe auf das Pack, um es aufzureißen</p><button class="btn small po-x" data-po="close">✕ Schließen</button>';
    const tear = () => {
      ov.className = 'packov stage2'; SFX.swish(); setTimeout(() => SFX.thump(.6), 260);
      setTimeout(() => {
        ov.className = 'packov stage3';
        ov.innerHTML = '<div class="po-head"><b>Boosterpack · ' + pk.n + ' Karten</b><span class="muted">' + (res.credit ? 'In deine Sammlung gelegt.' : 'Vorschau – es wird nichts gutgeschrieben.') + '</span></div><div class="po-grid n' + pk.n + '">' + cards.map((c, i) => '<button class="po-card r-' + c.rarity + '" data-po="flip:' + i + '" style="--i:' + i + '" aria-label="Karte ' + (i + 1) + ' aufdecken">' + (res.news && res.news.has(c.id) && cards.findIndex(x => x.id === c.id) === i ? '<span class="po-new">NEU</span>' : '') + '<span class="po-in"><span class="po-back"><span>♛</span></span><span class="po-front">' + (fullURL(c.id) ? '<img src="' + fullURL(c.id) + '" alt="">' : '<span class="po-noimg"><b>' + esc(c.name) + '</b><small>' + esc(RAR(c.rarity)) + '</small></span>') + '</span></span></button>').join('') + '</div><div class="row"><button class="btn primary" data-po="all">Alle aufdecken</button><button class="btn" data-po="close">Fertig</button></div>';
      }, 650);
    };
    ov.onclick = e => {
      const b = e.target.closest('[data-po]');
      if (!b) { if (ov.classList.contains('stage1') && e.target.closest('.po-pack')) tear(); return; }
      const k = b.dataset.po;
      if (k === 'close') { ov.hidden = true; ov.innerHTML = ''; return; }
      const flip = el => { if (el.classList.contains('open')) return; el.classList.add('open'); const r = (el.className.match(/r-(\w+)/) || [])[1]; if (r === 'legendaer') { SFX.thump(.9); SFX.chime(true); } else if (r === 'selten') SFX.chime(true); else SFX.swish(); };
      if (k.startsWith('flip:')) flip(b);
      if (k === 'all') $$('.po-card', ov).forEach((el, i) => setTimeout(() => flip(el), i * 120));
    };
  }

  /* ================= Hintergründe (bis zu 10, wechseln bei jedem Start) ================= */
  const WALLS = (() => {
    const M = window.WOK_MENU || {};
    const BUILTIN = [['thron', 'Thronsaal', M.menu], ['basar', 'Königlicher Basar', M.poster], ['feld', 'Schlachtfeld', (window.WOK_FIELD || {}).img]].filter(x => x[2]);
    const own = () => (LS.get('wok-spiel-walls') || []).filter(x => x && x.src);
    const chosen = () => SET.walls || BUILTIN.map(x => x[0]);
    function all() { return BUILTIN.map(([id, name, src]) => ({ id, name, src })).concat(own()); }
    function pickNow() {
      const ids = chosen(), list = all().filter(x => ids.includes(x.id)); if (!list.length) return;
      const w = list[Math.floor(Math.random() * list.length)]; document.documentElement.style.setProperty('--wall', 'url(' + w.src + ')'); document.body.classList.add('walled');
    }
    function dialogW() {
      const ids = chosen(), A = all();
      dialog('<h2>Hintergründe</h2><p class="muted">Bis zu 10 Hintergründe. Bei jedem Start wechselt einer davon – hinter dem Hauptmenü, den Decks und der Partie.</p><div class="wallgrid">' + A.map(w => '<button class="wall' + (ids.includes(w.id) ? ' on' : '') + '" data-act="w:' + w.id + '" style="background-image:url(' + w.src + ')"><span>' + esc(w.name) + (ids.includes(w.id) ? ' ✓' : '') + '</span></button>').join('') + '</div><div class="row"><label class="btn" for="wallup">+ Eigenes Bild</label><input type="file" id="wallup" accept="image/*" hidden><button class="btn primary" data-act="close">Fertig</button></div>',
        act => {
          if (act.startsWith('w:')) { const id = act.slice(2), cur = chosen().slice(), k = cur.indexOf(id); if (k >= 0) { if (cur.length > 1) cur.splice(k, 1); } else if (cur.length < 10) cur.push(id); else toast('Höchstens 10 Hintergründe.'); SET.walls = cur; LS.set('wok-spiel-setup', SET); pickNow(); dialogW(); return false; }
        }, { dismiss: true });
      $('#wallup').onchange = async e => {
        const f = e.target.files[0]; if (!f) return; const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = URL.createObjectURL(f); }); if (!im) return;
        const sc = Math.min(1, 1280 / im.naturalWidth), cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * sc); cv.height = Math.round(im.naturalHeight * sc); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        const L = own(); if (L.length >= 7) { toast('Höchstens 10 Hintergründe insgesamt.'); return; }
        const item = { id: 'eigen' + Date.now().toString(36), name: (f.name || 'Eigenes Bild').replace(/\.[a-z]+$/i, '').slice(0, 24), src: cv.toDataURL('image/jpeg', .78) };
        try { localStorage.setItem('wok-spiel-walls', JSON.stringify(L.concat(item))); } catch (x) { toast('Der Browser-Speicher ist voll – das Bild ist zu groß.'); return; }
        const cur = chosen().slice(); if (cur.length < 10) cur.push(item.id); SET.walls = cur; LS.set('wok-spiel-setup', SET); pickNow(); dialogW();
      };
    }
    return { pickNow, dialog: dialogW };
  })();

  /* ================= Deckbau: „Passt dazu“ ================= */
  function relatedCards(c, n) {
    const pool = Object.values(POOL.cards).filter(x => x.id !== c.id && x.type !== 'king'), co = {};
    for (const d of POOL.decks) if (d.cards.includes(c.id)) for (const id of new Set(d.cards)) if (id !== c.id) co[id] = (co[id] || 0) + 1;
    const score = x => (co[x.id] || 0) * 3 + x.races.filter(r => c.races.includes(r)).length * 2 + x.classes.filter(r => c.classes.includes(r)).length * 2 + x.elements.filter(r => c.elements.includes(r)).length
      + (c.type === 'king' ? (c.gifts || []).reduce((a, g) => a + ((g.scope === 'race' && x.races.includes(g.target)) || (g.scope === 'class' && x.classes.includes(g.target)) || (g.scope === 'element' && x.elements.includes(g.target)) ? 4 : 0), 0) : 0);
    return pool.map(x => [x, score(x)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].energy - b[0].energy).slice(0, n || 8).map(([x]) => x);
  }
  function relatedHTML(c) {
    const L = relatedCards(c, 8); if (!L.length) return '';
    const cnt = {}; if (ED) for (const id of ED.cards) cnt[id] = (cnt[id] || 0) + 1;
    return '<div class="related"><span class="eyebrow">Passt dazu</span><div class="rel-row">' + L.map(x => '<div class="rel"><button class="cimg" data-ix="relzoom" data-cid="' + esc(x.id) + '" aria-label="' + esc(x.name) + ' ansehen">' + miniImg(x) + '</button><small>' + esc(x.name) + '</small>' + (ED ? '<button class="btn small" data-ix="reladd" data-cid="' + esc(x.id) + '" ' + ((cnt[x.id] || 0) >= limOf(x) ? 'disabled' : '') + '>+ ins Deck</button>' : '') + '</div>').join('') + '</div><p class="hint" style="margin:0">Gleiche Rasse, Klasse oder Element' + (c.type === 'king' ? ', passend zu den Königsgaben' : '') + ' und Karten, die in deinen Decks oft zusammen vorkommen.</p></div>';
  }

  /* ---------------- Ereignisse verdrahten ---------------- */
  function wire() {
    $('#modes').onclick = e => { const b = e.target.closest('[data-mode]'); if (!b) return; SET.mode = b.dataset.mode; saveSetup(); renderHome(); };
    $('#ai-level').onclick = e => { const b = e.target.closest('[data-lv]'); if (!b) return; SET.level = b.dataset.lv; saveSetup(); renderHome(); };
    $('#start').onclick = startGame; $('#resume').onclick = resumeGame;
    $('#editdeck').onclick = () => editFromHome('deckA');
    if (window.WOK_MENU && WOK_MENU.menu) document.documentElement.style.setProperty('--menu', 'url(' + WOK_MENU.menu + ')');
    if (window.WOK_MENU && WOK_MENU.poster) document.documentElement.style.setProperty('--bzposter', 'url(' + WOK_MENU.poster + ')');
    $('#v-home').addEventListener('click', e => {
      const n = e.target.closest('[data-hnav]'), pl = e.target.closest('[data-hplay]'), hs = e.target.closest('[data-hs]'), ed = e.target.closest('[data-edeck]'), he = e.target.closest('[data-hedit]');
      if (n && n.dataset.hnav === 'quick') quickPlay(); if (n && n.dataset.hnav === 'settings') settingsDialog();
      if (pl) { if (pl.dataset.hplay === 'ai') openSetup('ai'); else onlineDialog(); }
      if (hs || e.target === $('#hsetup')) closeSetup();
      if (ed) editFromHome(ed.dataset.edeck); if (he) editFromHome('deckA');
      const av = e.target.closest('[data-av]'); if (av) PROF.dlg(av.dataset.av, () => renderHome());
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#hsetup').hidden && $('#ov').hidden) closeSetup(); });
    for (const id of ['#name1', '#name2', '#timer', '#help', '#rsides', '#creserve']) $(id).onchange = () => { saveSetup(); renderHome(); };
    document.addEventListener('click', e => { const ec = e.target.closest('[data-econ]'); if (ec) econAct(ec.dataset.econ); const g = e.target.closest('[data-go]'); if (g) show(g.dataset.go); const z = e.target.closest('[data-zoom]'); if (z && !e.target.closest('#dlg') && !e.target.closest('#insp')) zoomCard(z.dataset.zoom, z); });
    $('#exportall').onclick = () => exportAll();
    $('#offcheck').onclick = () => officialCheck(true); $('#offpub').onclick = () => officialPublish();
    $('#imp').onchange = e => { if (e.target.files.length) importFiles([...e.target.files]); e.target.value = ''; };
    $('#demo').onclick = async () => { loadDemo(); fixDeckChoice(); await savePool(); renderDecks(); toast('Demo-Karten geladen. Sie verschwinden, sobald du eigene Karten lädst.'); drawQueue(); };
    $('#inbox').onclick = inboxDialog;
    $('#newdeck').onclick = () => openEditor(null);
    $('#deckmulti').onclick = () => { DPICK = DPICK ? null : new Set(); renderDecks(); };
    $('#dpickbar').onclick = e => { const b = e.target.closest('[data-dbulk]'); if (!b) return; const k = b.dataset.dbulk;
      if (k === 'all') POOL.decks.forEach(d => DPICK.add(d.id)); if (k === 'none') DPICK.clear(); if (k === 'done') DPICK = null;
      if (k === 'del') { const L = POOL.decks.filter(d => DPICK.has(d.id)); dialog('<h2>' + L.length + (L.length === 1 ? ' Deck' : ' Decks') + ' löschen?</h2><p>' + L.map(d => '„' + esc(d.name) + '“').join(', ') + '</p><p class="muted">Die Karten bleiben in der Sammlung.</p><div class="row"><button class="btn danger" data-act="yes">Löschen</button><button class="btn" data-act="no">Abbrechen</button></div>', act => { if (act !== 'yes') return; L.forEach(hideDeck); POOL.decks = POOL.decks.filter(d => !DPICK.has(d.id)); DPICK = null; fixDeckChoice(); savePool(); renderDecks(); renderHome(); toast(L.length + (L.length === 1 ? ' Deck' : ' Decks') + ' gelöscht.'); }); return; }
      renderDecks(); };
    $('#deckname').oninput = () => { if (ED) ED.dirty = true; };
    $('#ed-save').onclick = saveEditor; $('#ed-back').onclick = leaveEditor;
    $('.dtabs').onclick = e => { const t = e.target.closest('[data-dtab]'); if (t) showDTab(t.dataset.dtab); };
    $('#ftype').onclick = e => { const t = e.target.closest('[data-ft]'); if (t) { ftype = t.dataset.ft; renderCollection(); } };
    $('#eftype').onclick = e => { const t = e.target.closest('[data-ft]'); if (t) { eftype = t.dataset.ft; renderEditor(); } };
    $('#q').oninput = renderCollection; $('#eq').oninput = renderEditor;
    $('#v-decks').addEventListener('change', e => { const f = e.target.closest('[data-facet]'); if (!f) return; const [k, n] = f.dataset.facet.split(':'); FACETS[k][n] = f.value; if (k === 'e') renderEditor(); else renderCollection(); });
    $('#v-decks').addEventListener('click', e => { const r = e.target.closest('[data-freset]'); if (!r) return; const k = r.dataset.freset; for (const f of ['folder', 'race', 'cls', 'el', 'gift', 'kind']) FACETS[k][f] = '';
      if (k === 'e') { ERAR = ''; ECOST = null; EONLY = false; $('#erar').value = ''; $('#eonly').checked = false; $('#eq').value = ''; renderEditor(); } else { $('#q').value = ''; renderCollection(); } });
    $('#imgcheck').onclick = checkImages;
    $('#dv-edit').addEventListener('click', e => {
      const z = e.target.closest('[data-zoom]'); if (z) return;
      const a = e.target.closest('[data-add]'), i = e.target.closest('[data-inc]'), d = e.target.closest('[data-dec]');
      if (a) { deckChange(a.dataset.add, 1); bump(a); } if (i) deckChange(i.dataset.inc, 1); if (d) deckChange(d.dataset.dec, -1);
      const lk = e.target.closest('[data-look]'); if (lk && ED) { const [k, v] = lk.dataset.look.split(':'); ED.look[k] = v; ED.dirty = true; renderLook(); if (k === 'mate' && v !== 'none') MATE.say && 0; return; }
      const evb = e.target.closest('[data-ev]'); if (evb) { EVIEW = evb.dataset.ev; LS.set('wok-spiel-eview', EVIEW); renderEditor(); return; }
      const ec = e.target.closest('[data-ecost]'); if (ec) { ECOST = ec.dataset.ecost === '' ? null : +ec.dataset.ecost; renderEditor(); }
      const et = e.target.closest('[data-etab]'); if (et) { $('#dk2').dataset.tab = et.dataset.etab; $$('[data-etab]').forEach(b => b.classList.toggle('on', b === et)); }
      if (e.target.closest('[data-kingpick]')) { eftype = 'king'; renderEditor(); $('#dk2').dataset.tab = 'pool'; $$('[data-etab]').forEach(b => b.classList.toggle('on', b.dataset.etab === 'pool')); $('#poolpane').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    });
    $('#esort').onchange = e => { ESORT = e.target.value; renderEditor(); }; $('#erar').onchange = e => { ERAR = e.target.value; renderEditor(); }; $('#eonly').onchange = e => { EONLY = e.target.checked; renderEditor(); };
    $('#ed-aibtn').onclick = () => { const d = $('#aibox'); d.open = true; $('#dk2').dataset.tab = 'deck'; $$('[data-etab]').forEach(b => b.classList.toggle('on', b.dataset.etab === 'deck')); d.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
    // Ziehen: aus der Sammlung ins Deck, aus dem Deck zurück
    $('#dv-edit').addEventListener('dragstart', e => { const t = e.target.closest('[data-drag],[data-dragdel]'); if (!t) return; e.dataTransfer.setData('text/plain', (t.dataset.drag ? 'add:' : 'del:') + (t.dataset.drag || t.dataset.dragdel)); e.dataTransfer.effectAllowed = 'move'; });
    for (const [pane, kind] of [['#deckpane', 'add:'], ['#poolpane', 'del:']]) {
      const el = $(pane);
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('dropok'); });
      el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) el.classList.remove('dropok'); });
      el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('dropok'); const v = e.dataTransfer.getData('text/plain') || ''; if (v.startsWith(kind)) deckChange(v.slice(4), kind === 'add:' ? 1 : -1); });
    }
    $('#autofill').onclick = autofill;
    $('#ai-build').onclick = () => buildDialog(false); $('#ai-newdeck').onclick = () => buildDialog(true); $('#ai-check').onclick = checkDeck; $('#ai-fix').onclick = fixDeck; $('#ai-send').onclick = askAI;
    $('#ai-q').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) askAI(); });
    $('#ai-out').addEventListener('click', e => { if (e.target.closest('#ai-apply')) applyProposal(); });
    $('#cleardeck').onclick = () => { if (!ED) return; ED.cards = []; ED.dirty = true; renderEditor(); };
    $('#decksort').onchange = e => { LS.set('wok-spiel-decksort', e.target.value); renderDecks(); };
    $('#deckgrid').onclick = e => {
      const b = e.target.closest('button'); if (!b) return; const ds = b.dataset;
      if (ds.edit) openEditor(ds.edit);
      if (ds.play) { SET.deckA = ds.play; LS.set('wok-spiel-setup', SET); schedulePersist(); renderDecks(); renderHome(); toast('Du spielst mit „' + deckById(ds.play).name + '“.'); }
      if (ds.foe) { SET.deckB = ds.foe; LS.set('wok-spiel-setup', SET); schedulePersist(); renderDecks(); renderHome(); toast((SET.mode === 'ai' ? 'Die KI' : SET.name2) + ' spielt mit „' + deckById(ds.foe).name + '“.'); }
      if (ds.copy) { const d = deckById(ds.copy); const c = { id: newDeckId(), name: uniqueName((d.name + ' (Kopie)').slice(0, 40)), cards: d.cards.slice(), origin: 'eigen', look: d.look ? Object.assign({}, d.look) : undefined, saved: Date.now() }; FRESH = c.id; POOL.decks.push(c); savePool(); renderDecks(); toast('Kopie angelegt.'); }
      if (ds.file) exportDeck(deckById(ds.file));
      if (ds.del) { const d = deckById(ds.del); dialog('<h2>Deck löschen?</h2><p>„' + esc(d.name) + '“ wird entfernt. Die Karten bleiben in der Sammlung.' + (d.origin !== 'eigen' ? ' Es kommt auch beim nächsten Laden nicht wieder.' : '') + '</p><div class="row"><button class="btn danger" data-act="yes">Löschen</button><button class="btn" data-act="no">Abbrechen</button></div>', act => { if (act !== 'yes') return; hideDeck(d); POOL.decks = POOL.decks.filter(x => x !== d); fixDeckChoice(); savePool(); renderDecks(); renderHome(); }); }
      if (ds.rename) { const d = deckById(ds.rename); dialog('<h2>Deck umbenennen</h2><label class="field">Neuer Name<input type="text" id="rn-name" maxlength="40" value="' + esc(d.name) + '"></label><div class="row"><button class="btn primary" data-act="ok">Speichern</button><button class="btn" data-act="no">Abbrechen</button></div>', act => { if (act !== 'ok') return; const nm = ($('#rn-name').value || '').trim().slice(0, 40); if (!nm) return false; if (d.origin !== 'eigen') { hideDeck(d); d.origin = 'eigen'; } d.name = uniqueName(nm, d.id); d.saved = d.saved || Date.now(); FRESH = d.id; savePool(); renderDecks(); renderHome(); toast('Deck heißt jetzt „' + nm + '“.'); }); setTimeout(() => { const i = $('#rn-name'); if (i) { i.focus(); i.select(); } }, 30); }
      if (ds.more) { const d = deckById(ds.more), sm = deckSummary(d); dialog('<span class="eyebrow">Deck</span><h2>' + esc(d.name) + '</h2><div class="dmore"><button class="btn" data-act="foe" ' + (sm.ok ? '' : 'disabled') + '>⚔ ' + (SET.mode === 'ai' ? 'KI spielt damit' : esc(SET.name2) + ' spielt damit') + '</button><button class="btn" data-act="ren">✎ Umbenennen</button><button class="btn" data-act="copy">⧉ Kopieren</button><button class="btn" data-act="file">⬇ Als Datei speichern</button><button class="btn danger" data-act="del">🗑 Löschen</button><button class="btn primary" data-act="close">Schließen</button></div>', act => { const b = document.createElement('button'); const map = { foe: 'foe', ren: 'rename', copy: 'copy', file: 'file', del: 'del' }; if (!map[act]) return; setTimeout(() => { b.dataset[map[act]] = d.id; $('#deckgrid').appendChild(b); b.click(); b.remove(); }, 0); }, { dismiss: true }); }
      if (ds.dpick) { DPICK.has(ds.dpick) ? DPICK.delete(ds.dpick) : DPICK.add(ds.dpick); renderDecks(); }
    };
    const board = $('#board');
    // Antippen = auswählen/handeln (Spielfluss). Groß ansehen = Doppelklick oder gedrückt halten (Maus und Finger).
    const bigOf = t => t.dataset.uid ? (G.s.units[t.dataset.uid] ? { uid: t.dataset.uid, from: t } : null) : t.dataset.iid ? { iid: t.dataset.iid, from: t } : null;
    const openBig = t => { const o = bigOf(t); if (!o) return; if (o.iid && !myTurn()) { const h = G.s.players[G.view].hand.find(x => x.iid === o.iid); if (h) openInspector({ cid: h.cid, from: t }); return; } openInspector(o); };
    board.addEventListener('click', e => { if (!G) return; const t = e.target.closest('.tok'); if (t) { if (t._long) { t._long = false; return; } if (e.detail >= 2) { openBig(t); return; } clickUnit(t.dataset.uid); return; } const c = e.target.closest('.cell'); if (c) clickField(c.dataset.f); });
    board.addEventListener('keydown', e => { const t = e.target.closest('.tok,.cell'); if (!t) return; if ((e.key === 'i' || e.key === 'I') && t.classList.contains('tok')) { e.preventDefault(); openBig(t); return; } if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); t.click(); });
    let press = 0, pressPos = null;
    const longStart = e => { const t = e.target.closest('.tok,.hcard'); if (!t || !G || (e.button !== undefined && e.button !== 0)) return; clearTimeout(press); pressPos = [e.clientX, e.clientY]; press = setTimeout(() => { t._long = true; openBig(t); setTimeout(() => { t._long = false; }, 900); }, 480); };
    const longEnd = () => clearTimeout(press);
    const longMove = e => { if (pressPos && Math.hypot(e.clientX - pressPos[0], e.clientY - pressPos[1]) > 10) clearTimeout(press); };
    for (const el of [board, $('#hand')]) {
      el.addEventListener('pointerdown', longStart); el.addEventListener('pointerup', longEnd); el.addEventListener('pointercancel', longEnd); el.addEventListener('pointermove', longMove); el.addEventListener('pointerleave', longEnd);
      el.addEventListener('contextmenu', e => { const t = e.target.closest('.tok,.hcard'); if (t) e.preventDefault(); });
    }
    $('#hand').addEventListener('click', e => { const h = e.target.closest('.hcard'); if (!h || !G) return; if (h._long) { h._long = false; return; } if (e.detail >= 2) { openBig(h); return; } clickHand(h.dataset.iid); });
    $('#hand').addEventListener('keydown', e => { const h = e.target.closest('.hcard'); if (h && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); openBig(h); } });
    $('#mainbtn').onclick = mainAction; $('#tips').onclick = showTips;
    $('#music').onclick = () => MUSIC.toggle(); MUSIC.updBtn();
    document.addEventListener('input', e => { if (e.target.id === 'vol') MUSIC.setVolume(+e.target.value); });
    $('#insp').addEventListener('click', e => { const b = e.target.closest('[data-ix]'); if (b) { inspectorAct(b); return; } const z = e.target.closest('[data-zoom]'); if (z && z.dataset.zoom !== (INS && insCard() && insCard().id)) { INS.cid = z.dataset.zoom; INS.uid = INS.iid = null; INS.from = null; fillInspector(); } });
    const hold = $('#insp-hold'), tilt = $('#insp-tilt');
    hold.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; const r = hold.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; tilt.style.transform = 'rotateY(' + (x * 14).toFixed(2) + 'deg) rotateX(' + (-y * 12).toFixed(2) + 'deg)'; tilt.style.setProperty('--gx', (x * 100 + 50) + '%'); tilt.style.setProperty('--gy', (y * 100 + 50) + '%'); });
    hold.addEventListener('pointerleave', () => { tilt.style.transform = ''; });
    $('#detail').addEventListener('click', e => { const g = e.target.closest('[data-gift]'); if (g) useGiftUI(g.dataset.uid, g.dataset.gift); const c = e.target.closest('[data-cast]'); if (c && myTurn()) startCast(c.dataset.cast); const k = e.target.closest('[data-cpick],[data-cnext],[data-cback],[data-cabort],[data-cok]'); if (k && myTurn()) castAct(k.dataset); });
    $('#concede').onclick = concedeDialog;
    $('#rpbar').addEventListener('click', e => { const b = e.target.closest('[data-rp]'); if (b) rpAct(b.dataset.rp); });
    $('#rp-speed').onchange = e => { if (G && G.replay) { G.replay.speed = +e.target.value; rpSchedule(); } };
    $('#tutbox').addEventListener('click', e => { const b = e.target.closest('[data-tutx]'); if (!b || !G || !G.tutorial) return; if (b.dataset.tutx === 'next') TUT.advance(); else TUT.quit(); });
    $('#tutgrid').addEventListener('click', e => { const b = e.target.closest('[data-tut]'); if (b) TUT.start(b.dataset.tut); });
    document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });
    WALLS.pickNow();
    function concedeDialog() {
      if (!G || G.s.result) return;
      const p = G.mode === 'ai' ? 0 : G.mode === 'online' ? G.view : actor(G.s), who = G.s.players[p].name, foe = G.s.players[1 - p].name;
      dialog('<h2>🏳 Partie aufgeben?</h2><p>' + esc(who) + ' gibt auf, ' + esc(foe) + ' gewinnt die Partie sofort. Das lässt sich nicht rückgängig machen.</p><div class="row"><button class="btn danger" data-act="yes">Ja, aufgeben</button><button class="btn primary" data-act="no">Weiterspielen</button></div>', act => { if (act === 'yes') { closeDialog(); dispatch({ type: 'concede', p }); return false; } }, { dismiss: true });
    }
    $('#menu').onclick = () => dialog('<h2>Menü</h2><div class="row"><button class="btn" data-act="help">Spielhilfe: ' + (SET.help !== false ? 'an' : 'aus') + '</button>' + ((window.WOK_MUSIC || []).length ? '<label class="field" style="flex:1 1 100%">Musik' + (MUSIC.now ? ': „' + esc(MUSIC.now) + '“' : '') + '<input type="range" id="vol" min="0" max="1" step="0.05" value="' + (SET.volume === undefined ? 0.55 : SET.volume) + '" aria-label="Lautstärke"></label><button class="btn" data-act="music">Musik: ' + (SET.music === false ? 'aus' : 'an') + '</button>' : '') + '<button class="btn" data-act="big">Karte groß zeigen: ' + (bigOn() ? 'schon beim Antippen' : 'Doppelklick oder gedrückt halten') + '</button><button class="btn" data-act="rules">Regeln</button><button class="btn danger" data-act="concede">Aufgeben</button><button class="btn" data-act="leave">Zum Hauptmenü (Partie bleibt gespeichert)</button><button class="btn" data-act="close">Weiterspielen</button></div>', act => {
      if (act === 'music') { MUSIC.toggle(); toast('Musik ' + (SET.music === false ? 'aus.' : 'an.')); return; }
      if (act === 'big') { SET.bigTap = !bigOn(); LS.set('wok-spiel-setup', SET); toast(bigOn() ? 'Karten werden schon beim Antippen groß gezeigt.' : 'Antippen wählt aus und greift an. Groß ansehen: Doppelklick oder gedrückt halten.', 5000); return; }
      if (act === 'help') { SET.help = SET.help === false; LS.set('wok-spiel-setup', SET); G._advFor = null; render([]); toast('Spielhilfe ' + (SET.help ? 'eingeschaltet.' : 'ausgeschaltet.')); return; }
      if (act === 'rules') { renderRules(); dialog('<div class="rules">' + $('#rules').innerHTML + '</div><button class="btn" data-act="x">Schließen</button>', null, { dismiss: true }); return false; }
      if (act === 'concede') { setTimeout(concedeDialog, 0); return; }
      if (act === 'leave') { clearTimeout(aiTimer); if (G && G.mode === 'online') { ONLINE.leave(); toast('Die Online-Partie bleibt offen: „Online-Duell“ → Fortsetzen.', 6000); } G = null; MUSIC.stop(); show('home'); }
    }, { dismiss: true });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#insp').hidden) { closeInspector(); return; } if (e.key === 'Escape' && !$('#ov').hidden && !(G && (G.handover || (G.s.pendingDiscard !== null && !G.s.result)))) closeDialog(); });
  }

  // PC-Version: dem lokalen Programm zeigen, dass das Fenster noch offen ist
  function heartbeat() {
    if (location.protocol !== 'http:' || !/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return;
    fetch('/api/whoami').then(r => r.text()).then(t => {
      if (!t.startsWith('wok-probespiel')) return;
      const ping = () => fetch('/api/ping', { method: 'POST' }).catch(() => {});
      ping(); setInterval(ping, 20000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) ping(); });
      window.addEventListener('pagehide', () => { try { navigator.sendBeacon('/api/bye'); } catch (e) { } });
    }).catch(() => {});
  }
  async function boot() {
    heartbeat();
    wire();
    await loadPool();
    renderHome();
    connectStore().then(() => setTimeout(drawQueue, 300));
    if (IS_PC) { setInterval(inboxPoll, 5000); setTimeout(inboxPoll, 1500); }
    renderHome();
    setTimeout(() => officialCheck(false), 1500);
    try { const q = new URLSearchParams(location.search).get('raum'); if (q) { setTimeout(() => ONLINE.openLink(q), 400); history.replaceState(null, '', location.pathname); } } catch (e) { }
  }
  window.WOK_APP_MUSIC = MUSIC;
  window.WOK_INSPECT = { open: o => openInspector(o), close: () => closeInspector(), get state() { return INS; } };
  window.WOK_APP = { get game() { return G; }, dispatch: a => dispatch(a), POOL, VERSION, urls, STORE, renderNow: () => G && render([]), render: ev => G && render(ev) };
  boot();
})();
