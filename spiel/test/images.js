// Prüft, ob Kartenbilder wirklich laden (Hand, Detail, Spielfeld) – nach Import, nach Neuladen und in frischem Browser
const { chromium } = require('playwright');
const URL0 = process.argv[2] || 'http://127.0.0.1:47851/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const fresh = async () => { const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_TUNNEL|404/.test(m.text())) errs.push(m.text()); }); return pg; };
  const check = async (pg, label) => {
    const r = await pg.evaluate(async () => {
      const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(-1); i.src = u; });
      const P = WOK_APP.POOL, ids = Object.keys(P.cards);
      let full = 0, fullOk = 0, art = 0, artOk = 0;
      for (const id of ids) {
        const el = document.createElement('div');
        const fu = (window.__urls || {}).full;
      }
      // über die öffentlichen Bildadressen gehen
      const u = window.WOK_APP.urls; const out = { full: 0, fullOk: 0, art: 0, artOk: 0 };
      for (const id of ids) { if (u.full[id]) { out.full++; if (await load(u.full[id]) > 0) out.fullOk++; } if (u.art[id]) { out.art++; if (await load(u.art[id]) > 0) out.artOk++; } }
      return Object.assign(out, { cards: ids.length });
    });
    console.log(label, JSON.stringify(r));
  };
  let pg = await fresh();
  await pg.goto(URL0); await pg.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { if (await pg.isVisible('#ov')) { await pg.click('#dlg [data-act="load"]'); await pg.waitForTimeout(3000); } await pg.waitForTimeout(5500); }
  await pg.waitForTimeout(4000);
  await check(pg, 'nach Import:');
  await pg.reload(); await pg.waitForTimeout(3500); await check(pg, 'nach Neuladen:');
  await pg.context().close();
  pg = await fresh(); await pg.goto(URL0); await pg.waitForTimeout(4000); await check(pg, 'frischer Browser:');
  // Spiel starten und Spielfeld prüfen
  await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await require('./mull.js')(pg); await pg.waitForTimeout(1500);
  for (let i = 0; i < 60; i++) { const ok = await pg.evaluate(() => { const g = WOK_APP.game, s = g.s; if (s.active === 0 && !s.result && s.turn > 10) return true; if (s.active === 0) { const a = WOK_AI.decide(s, 0, 'mittel', g._m || (g._m = { seed: 4 })); if (a) WOK_APP.dispatch(a); } return false; }); if (ok) break; await pg.waitForTimeout(300); }
  const tok = await pg.evaluate(async () => { const fs = [...document.querySelectorAll('.tok .face')]; const withImg = fs.filter(f => /url\(/.test(f.style.backgroundImage)); const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(-1); i.src = u; }); let ok = 0; for (const f of withImg) { const u = f.style.backgroundImage.match(/url\("?([^")]+)/)[1]; if (await load(u) > 0) ok++; } const hc = [...document.querySelectorAll('.hcard')]; return { tokens: fs.length, mitBild: withImg.length, laden: ok, hand: hc.length, handMitBild: hc.filter(h => /url\(/.test(h.style.backgroundImage)).length }; });
  console.log('Spielfeld:', JSON.stringify(tok));
  const any = await pg.$('.tok:not(.king)'); if (any) { await any.click(); await pg.waitForTimeout(400); console.log('Detail-Bild:', await pg.evaluate(() => { const i = document.querySelector('#detail .fullcard img'); return i ? i.naturalWidth : 'kein Bild'; })); }
  await pg.screenshot({ path: '/tmp/claude-0/wokui/images.png' });
  console.log('Fehler:', errs); await b.close();
})();
