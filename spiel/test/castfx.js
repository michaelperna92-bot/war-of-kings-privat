// Aktivierungs-Effekte: Rauch beim Fluch, Runen/Funken beim Zauber
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h, n] of [[1366, 900, 'pc'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
    await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(500);
    await pg.waitForFunction(() => document.querySelector('#fxlayer').hidden, null, { timeout: 8000 });
    await pg.waitForTimeout(7000); // Kartenbilder fertig zeichnen lassen
    for (const t of ['curse', 'spell']) {
      await pg.evaluate(t => { const s = WOK_APP.game.s; WOK_APP.game.aiSide = -1; let c = Object.values(s.cards).find(c => c.type === t); if (!c) { const base = Object.values(s.cards).find(c => c.type === 'hero'); c = Object.assign({}, base, { id: 'x' + t, type: t, name: t === 'curse' ? 'Schattenfluch' : 'Lichtzauber', spell: { timing: 'both', effects: [] } }); s.cards[c.id] = c; } WOK_APP.render([{ t: 'cast', p: 0, sid: 'z' + t, cid: c.id }]); }, t);
      await pg.waitForTimeout(600); await pg.screenshot({ path: OUT + n + '-cast-' + t + '-a.png' }); await pg.waitForTimeout(700); console.log(n, t, 'Effekt:', await pg.evaluate(() => { const l = document.querySelector('#fxlayer'); return l.hidden ? 'keiner' : (l.querySelector('.castfx') || {}).className + ' Teilchen ' + l.querySelectorAll('.smoke i, .sparks i').length; }));
      await pg.screenshot({ path: OUT + n + '-cast-' + t + '.png' });
      await pg.waitForFunction(() => document.querySelector('#fxlayer').hidden, null, { timeout: 8000 });
    }
    await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
