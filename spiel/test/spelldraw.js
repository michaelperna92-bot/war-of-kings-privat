// Werkstatt-Sicherung (JSON) mit Zauberkarte: das Spiel zeichnet die Karte selbst im Zauber-Layout
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const EF = require('../src/effects.js');
const { chromium } = require('playwright');
(async () => {
  const sp = EF.blankSpell('spell'); sp.effects = [EF.blankEffect('heal', 'spell')];
  const cards = [{ id: 'z_heil', type: 'spell', name: 'Licht der Krone', energy: 2, rarity: 'ungewoehnlich', subtitle: 'Heilzauber', ruleText: '', flavor: 'Die Krone erinnert sich.', spell: sp }];
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'warning') errs.push('warn: ' + m.text()); });
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(600);
  await pg.click('[data-go="decks"]'); await pg.click('[data-dtab="cards"]');
  await pg.setInputFiles('#imp', { name: 'sicherung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ cards })) });
  await pg.waitForFunction(() => !!WOK_APP.urls.full.z_heil, null, { timeout: 30000 });
  try { await pg.evaluate(async () => { const r = await WOK_CARDART.render(WOK_APP.POOL.raw.z_heil, null); return r.full.size; }); } catch (e) { console.log('render-Fehler:', e.message.slice(0, 300)); }
  const src = await pg.evaluate(() => WOK_APP.urls.full.z_heil);
  const pg2 = await b.newPage(); await pg2.goto('http://127.0.0.1:8765/index.html'); 
  const shot = await pg.evaluate(async u => { const r = await fetch(u); const bl = await r.blob(); return [bl.type, bl.size]; }, src);
  console.log('Gezeichnet:', shot, '| spielbar:', await pg.evaluate(() => WOK_APP.POOL.cards.z_heil.playable), '| Text:', await pg.evaluate(() => WOK_APP.POOL.cards.z_heil.ruleText));
  await pg.click('[data-zoom="z_heil"]'); await pg.waitForTimeout(500); await pg.screenshot({ path: '/tmp/claude-0/flow/s-zoom.png' });
  console.log('Fehler:', errs); await b.close();
})();
