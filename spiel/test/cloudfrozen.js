// Cloud-Speicher liefert eingefrorene Daten: Deck umbauen, umbenennen, speichern, löschen muss trotzdem gehen
const { chromium } = require('playwright');
const STORE = {};
const mock = `(() => {
  const deep = o => { if (o && typeof o === 'object') { Object.values(o).forEach(deep); Object.freeze(o); } return o; };
  const snapDoc = (path, data) => ({ id: path.split('/').pop(), exists: data != null, data: () => data == null ? undefined : deep(JSON.parse(JSON.stringify(data))) });
  const docRef = path => ({ id: path.split('/').pop(), path, get: async () => snapDoc(path, await window.__dbGet(path)), set: async d => { await window.__dbSet(path, d); }, update: async d => { const o = await window.__dbGet(path) || {}; await window.__dbSet(path, Object.assign(o, d)); }, delete: async () => window.__dbSet(path, null), onSnapshot: () => () => {}, collection: c => colRef(path + '/' + c) });
  const colRef = path => { const q = { path, doc: id => docRef(path + '/' + id), where: () => q, orderBy: () => q, limit: () => q, get: async () => { const l = await window.__dbList(path); return { docs: l.map(([p, d]) => snapDoc(p, d)) }; }, onSnapshot: () => () => {} }; return q; };
  const db = { doc: docRef, collection: colRef };
  const user = { id: async () => 'u_test', isOwner: () => true, canEdit: () => true };
  const assets = { upload: async () => ({ id: 'a' + Math.random().toString(36).slice(2), url: '' }), delete: async () => {}, list: async () => ({ assets: [] }) };
  window.claude = { use: async n => n === 'db' ? db : n === 'user' ? user : n === 'assets' ? assets : null };
})();`;
(async () => { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.exposeBinding('__dbGet', (_, p) => STORE[p] == null ? null : JSON.parse(JSON.stringify(STORE[p])));
  await ctx.exposeBinding('__dbSet', (_, p, d) => { if (d == null) delete STORE[p]; else STORE[p] = JSON.parse(JSON.stringify(d)); });
  await ctx.exposeBinding('__dbList', (_, c) => Object.entries(STORE).filter(([p]) => p.startsWith(c + '/') && p.slice(c.length + 1).split('/').length === 1));
  await ctx.addInitScript(mock);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(900);
  const names = () => pg.evaluate(() => [...document.querySelectorAll('.dtile .dname b')].map(x => x.textContent).join(', '));
  // 1. Deck anlegen und speichern → landet in der (simulierten) Cloud
  await pg.click('[data-go="decks"]'); await pg.click('#newdeck'); await pg.fill('#deckname', 'Wolkenfeste'); await pg.click('#autofill'); await pg.click('#ed-save'); await pg.waitForTimeout(2500);
  console.log('in der Cloud:', Object.keys(STORE).filter(k => /meta/.test(k)), (STORE['data/users/u_test/meta'] || {}).decks ? STORE['data/users/u_test/meta'].decks.map(d => d.name) : '-');
  // 2. neu laden → Decks kommen eingefroren aus der Datenbank
  await pg.reload(); await pg.waitForTimeout(1500); await pg.click('[data-go="decks"]'); await pg.waitForTimeout(300);
  console.log('nach Neuladen:', await names());
  // 3. umbauen + speichern
  await pg.click('.dtile:has-text("Wolkenfeste") [data-edit]'); await pg.waitForTimeout(300); await pg.click('#ed-save'); await pg.waitForTimeout(600);
  console.log('Umbauen gespeichert, Toast:', await pg.textContent('#toast'));
  // 4. umbenennen
  await pg.click('.dtile:has-text("Wolkenfeste") .dname'); await pg.fill('#rn-name', 'Wolkenburg'); await pg.click('#dlg [data-act="ok"]'); await pg.waitForTimeout(400);
  console.log('umbenannt:', await names());
  // 5. löschen
  await pg.click('.dtile:has-text("Demo B") [data-del]'); await pg.click('#dlg [data-act="yes"]'); await pg.waitForTimeout(400);
  console.log('gelöscht:', await names());
  await pg.waitForTimeout(2000); await pg.reload(); await pg.waitForTimeout(1500); await pg.click('[data-go="decks"]'); await pg.waitForTimeout(300);
  console.log('nach erneutem Neuladen:', await names());
  console.log('Fehler:', errs); await b.close(); })();
