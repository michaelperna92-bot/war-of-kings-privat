// PC: Spielpaket mit Zaubern aus dem Dokumente-Ordner, dauerhaft gespeichert, Zauber spielbar markiert
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const fresh = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); return pg; };
  let pg = await fresh();
  await pg.goto('http://127.0.0.1:47851/'); await pg.waitForTimeout(3000);
  if (await pg.isVisible('#ov')) { console.log('Angebot:', (await pg.textContent('#dlg')).replace(/\s+/g, ' ').slice(0, 120)); await pg.click('#dlg [data-act="load"]'); await pg.waitForTimeout(4000); }
  const a = await pg.evaluate(() => Object.values(WOK_APP.POOL.cards).map(c => c.type).reduce((o, t) => (o[t] = (o[t] || 0) + 1, o), {}));
  console.log('A Typen:', JSON.stringify(a), '|', WOK_APP_VERSION = await pg.evaluate(() => WOK_APP.VERSION));
  await pg.waitForTimeout(2500); await pg.context().close();
  pg = await fresh(); await pg.goto('http://127.0.0.1:47851/'); await pg.waitForTimeout(3500);
  const bb = await pg.evaluate(() => Object.values(WOK_APP.POOL.cards).filter(c => c.type === 'spell' || c.type === 'curse').map(c => c.name + ':' + (c.playable ? 'spielbar' : 'nicht spielbar')));
  console.log('B frischer Browser:', bb, '| Bilder:', await pg.evaluate(() => Object.keys(WOK_APP.urls.full).length));
  console.log('Fehler:', errs); await b.close();
})();
