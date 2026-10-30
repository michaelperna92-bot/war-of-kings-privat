// Online-Duell: zwei Browser, gemeinsame (simulierte) Artefakt-Datenbank, Raum eröffnen, beitreten, Züge synchron
const { chromium } = require('playwright');
const SH = '/tmp/claude-0/sf/shots/';
const STORE = {}; // Pfad -> Daten
const mock = (uid) => `(() => {
  const poll = (fn, ms) => { let last = ''; const t = setInterval(async () => { const v = await fn(); const j = JSON.stringify(v); if (j !== last) { last = j; cbs(v); } }, ms); let cbs = () => {}; return { set: f => { cbs = f; }, stop: () => clearInterval(t) }; };
  const snapDoc = (path, data) => ({ id: path.split('/').pop(), exists: data != null, data: () => data == null ? undefined : JSON.parse(JSON.stringify(data)) });
  const docRef = path => ({ id: path.split('/').pop(), path,
    get: async () => snapDoc(path, await window.__dbGet(path)),
    set: async d => { await window.__dbSet(path, d); }, update: async d => { const o = await window.__dbGet(path); if (!o) throw { code: 'invalid_argument' }; await window.__dbSet(path, Object.assign(o, d)); },
    delete: async () => window.__dbSet(path, null), acquire: async () => ({ acquired: true }),
    onSnapshot: (next) => { const p = poll(() => window.__dbGet(path), 250); p.set(v => next(snapDoc(path, v))); return p.stop; },
    collection: c => colRef(path + '/' + c) });
  const colRef = (path, filt) => { const q = { path,
    doc: id => docRef(path + '/' + (id || Math.random().toString(36).slice(2))),
    where: (f, op, v) => colRef(path, (filt || []).concat([[f, op, v]])), orderBy: () => q, limit: () => q,
    get: async () => { const l = await window.__dbList(path, filt || []); return { docs: l.map(([p, d]) => snapDoc(p, d)) }; },
    onSnapshot: (next) => { const p = poll(() => window.__dbList(path, filt || []), 250); p.set(l => next({ docs: l.map(([pp, d]) => snapDoc(pp, d)) })); return p.stop; } }; return q; };
  const db = { doc: docRef, collection: p => colRef(p) };
  const user = { id: async () => '${uid}', isOwner: () => true, canEdit: () => true };
  window.claude = { use: async n => n === 'db' ? db : n === 'user' ? user : null };
})();`;
async function page(b, uid, name) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.exposeBinding('__dbGet', (_, p) => STORE[p] == null ? null : JSON.parse(JSON.stringify(STORE[p])));
  await ctx.exposeBinding('__dbSet', (_, p, d) => { if (d == null) delete STORE[p]; else STORE[p] = JSON.parse(JSON.stringify(d)); });
  await ctx.exposeBinding('__dbList', (_, c, filt) => Object.entries(STORE).filter(([p]) => p.startsWith(c + '/') && p.slice(c.length + 1).split('/').length === 1).filter(([, d]) => filt.every(([f, op, v]) => op === '==' ? d[f] === v : true)));
  await ctx.addInitScript(mock(uid));
  const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(900);
  await pg.evaluate(n => { const s = JSON.parse(localStorage.getItem('wok-spiel-setup') || '{}'); s.name1 = n; localStorage.setItem('wok-spiel-setup', JSON.stringify(s)); }, name);
  await pg.reload(); await pg.waitForTimeout(900); return pg;
}
(async () => { const b = await chromium.launch();
  const A = await page(b, 'user-anna', 'Anna'), B = await page(b, 'user-ben', 'Ben');
  await A.click('[data-hplay="online"]'); await A.waitForTimeout(500); await A.screenshot({ path: SH + 'onl-dialog.png' });
  await A.click('#dlg [data-act="host:cloud"]'); await A.waitForTimeout(800);
  const code = (await A.textContent('.onl-code')).trim(); console.log('Raum:', code); await A.screenshot({ path: SH + 'onl-host.png' });
  await B.click('[data-hplay="online"]'); await B.waitForTimeout(900);
  console.log('Ben sieht:', (await B.textContent('#onl-list')).replace(/\s+/g, ' '));
  await B.screenshot({ path: SH + 'onl-list.png' });
  await B.click('.onl-room'); await B.waitForTimeout(2500);
  console.log('Spiel offen:', await A.isVisible('#v-game'), await B.isVisible('#v-game'));
  const st = pg => pg.evaluate(() => { const s = document.querySelector('#turnwho').textContent; return s; });
  console.log('A:', await st(A), '| B:', await st(B));
  // Starthand (ab 4.5) über die Oberfläche: A behält, B zieht neu (Cloud-Weg: nacheinander)
  for (let i = 0; i < 40; i++) { for (const [P, act] of [[A, 'keep'], [B, 'new']]) { const k = await P.$('#ov:not([hidden]) #dlg .mhand ~ .row [data-act="' + act + '"]'); if (k) { await k.click(); await P.waitForTimeout(600); } } if (await A.evaluate(() => WOK_APP.game.s.phase !== 'mulligan') && await B.evaluate(() => WOK_APP.game.s.phase !== 'mulligan')) break; await A.waitForTimeout(400); }
  console.log('Starthand – A:', await A.evaluate(() => JSON.stringify(WOK_APP.game.s.mull)), '| B:', await B.evaluate(() => JSON.stringify(WOK_APP.game.s.mull)), '| gleiche Hände:', await A.evaluate(() => JSON.stringify(WOK_APP.game.s.players.map(P => P.hand.map(h => h.iid)))) === await B.evaluate(() => JSON.stringify(WOK_APP.game.s.players.map(P => P.hand.map(h => h.iid)))));
  // Wer am Zug ist, beendet Phasen bis der Zug wechselt; beide Zustände vergleichen
  for (let k = 0; k < 14; k++) {
    for (const P of [A, B]) { const btn = await P.$('#mainbtn:not([disabled])'); const t = await st(P); if (/\(du\)|Anna|Ben/.test(t) && btn) { const vis = await btn.isVisible(); if (vis && await P.evaluate(() => !document.querySelector('#mainbtn').disabled)) { await btn.click(); await P.waitForTimeout(250); if (await P.isVisible('#dlg [data-act="go"]')) await P.click('#dlg [data-act="go"]'); if (await P.isVisible('#dlg [data-act="yes"]')) await P.click('#dlg [data-act="yes"]'); await P.waitForTimeout(300); } } }
    await A.waitForTimeout(500);
  }
  await A.waitForTimeout(1200);
  console.log('A:', await st(A), '| B:', await st(B));
  const mv = Object.entries(STORE).filter(([p]) => /moves/.test(p)).map(([p, d]) => p + ':' + d.acts.length);
  console.log('Züge in der DB:', mv.join(', '));
  await A.screenshot({ path: SH + 'onl-A.png' }); await B.screenshot({ path: SH + 'onl-B.png' });
  // Neu laden und fortsetzen
  await B.reload(); await B.waitForTimeout(1000); await B.click('[data-hplay="online"]'); await B.waitForTimeout(500); await B.click('#dlg [data-act="resume"]'); await B.waitForTimeout(1500);
  console.log('B nach Neuladen:', await st(B));
  // Aufgeben durch A
  await A.click('#menu'); await A.waitForTimeout(300); const cb = await A.$('#dlg [data-act="concede"]'); if (cb) { await cb.click(); await A.waitForTimeout(200); await A.click('#dlg [data-act="yes"]'); }
  await A.waitForTimeout(1800);
  console.log('Ende A:', (await A.textContent('#dlg').catch(() => '')).slice(0, 60), '| Ende B:', (await B.textContent('#dlg').catch(() => '')).slice(0, 60));
  console.log('Raum-Status:', STORE['online/' + code] && STORE['online/' + code].state);
  console.log('Fehler:', A.errs, B.errs); await b.close(); })();
