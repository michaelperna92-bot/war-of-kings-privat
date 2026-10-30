// Cloud: Sammlung im Claude-Konto (db + assets nachgebildet), frischer Browser lädt sie wieder
const { chromium } = require('playwright');
const STORE = new Map(), BLOBS = new Map(); let nid = 0;
(async () => {
  const b = await chromium.launch(); const errs = [];
  async function fresh() {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.exposeBinding('__db', (src, op, path, data) => {
      if (op === 'get') return STORE.has(path) ? STORE.get(path) : null;
      if (op === 'set') { STORE.set(path, data); return true; }
      if (op === 'del') { STORE.delete(path); return true; }
      if (op === 'list') return [...STORE.entries()].filter(([k]) => k.startsWith(path + '/') && k.slice(path.length + 1).split('/').length === 1).map(([k, v]) => ({ id: k.split('/').pop(), v }));
    });
    await ctx.exposeBinding('__up', (src, b64, type) => { const id = (++nid).toString(16).padStart(32, '0'); BLOBS.set(id, { b64, type }); return id; });
    await ctx.route('**/_blob/*', r => { const x = BLOBS.get(r.request().url().split('/').pop()); x ? r.fulfill({ status: 200, contentType: x.type, body: Buffer.from(x.b64, 'base64') }) : r.fulfill({ status: 404 }); });
    await ctx.addInitScript(() => {
      const snap = (id, v) => ({ id, exists: v != null, data: () => v || undefined });
      const docRef = path => ({ path, get: async () => snap(path.split('/').pop(), await __db('get', path)), set: async d => __db('set', path, JSON.parse(JSON.stringify(d))), delete: async () => __db('del', path), collection: n => colRef(path + '/' + n) });
      const colRef = path => ({ path, doc: id => docRef(path + '/' + id), limit: () => colRef(path), get: async () => { const l = await __db('list', path); return { docs: l.map(x => snap(x.id, x.v)), size: l.length, empty: !l.length }; } });
      const db = { doc: docRef, collection: colRef };
      const assets = { upload: async (blob, o) => { const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); const id = await __up(btoa(s), o.type); return { id, url: '/_blob/' + id }; }, delete: async () => ({ deleted: true }) };
      const user = { id: async () => 'nutzer1' };
      window.claude = { use: async n => ({ db, assets, user, downloads: null }[n] || null) };
    });
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); return pg;
  }
  let pg = await fresh();
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(1500);
  await pg.click('[data-go="decks"]'); await pg.setInputFiles('#imp', '/tmp/claude-0/chk/WoK_Deck_Mein_Testdeck.wokspiel'); await pg.waitForTimeout(3000);
  await pg.click('#newdeck'); await pg.fill('#deckname', 'Cloud-Deck'); await pg.click('#autofill'); await pg.click('#ed-save'); await pg.waitForTimeout(5000);
  console.log('A:', await pg.evaluate(() => [Object.keys(WOK_APP.POOL.cards).length, WOK_APP.POOL.decks.map(d => d.name)]), await pg.textContent('#v-decks .storeinfo'));
  console.log('Im Konto:', [...STORE.keys()].length, 'Dokumente,', BLOBS.size, 'Bilder');
  await pg.context().close();
  pg = await fresh();
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(2500);
  console.log('B:', await pg.evaluate(() => [Object.keys(WOK_APP.POOL.cards).length, Object.keys(WOK_APP.POOL.cards).filter(i => i.startsWith('demo_')).length, WOK_APP.POOL.decks.map(d => d.name + ':' + d.cards.length)]));
  await pg.click('[data-go="decks"]'); await pg.waitForTimeout(1500);
  const ok = await pg.evaluate(async () => { const u = document.querySelector('.dtile img').src; const r = await fetch(u); return [u.slice(0, 12), r.status]; });
  console.log('Bild aus dem Konto:', ok, '|', await pg.textContent('#v-decks .storeinfo'));
  console.log(errs); await b.close();
})();
