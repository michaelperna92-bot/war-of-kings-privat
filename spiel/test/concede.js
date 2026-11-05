// Aufgeben: sichtbarer Knopf mit Rückfrage, auch über das Menü
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h, n] of [[1366, 900, 'pc'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
    await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(700);
    if (await pg.isVisible('#concede')) await pg.click('#concede'); else { await pg.click('#mmenu'); await pg.click('#dlg [data-act="concede"]'); } await pg.waitForTimeout(200); console.log(n, 'Rückfrage:', (await pg.textContent('#dlg h2')));
    await pg.click('#dlg [data-act="no"]'); await pg.waitForTimeout(200); console.log(n, 'nach „Weiterspielen“ läuft:', await pg.evaluate(() => !WOK_APP.game.s.result));
    await pg.click(await pg.isVisible('#menu') ? '#menu' : '#mmenu'); await pg.click('#dlg [data-act="concede"]'); await pg.waitForTimeout(200); await pg.click('#dlg [data-act="yes"]'); await pg.waitForTimeout(600);
    console.log(n, 'Ergebnis:', await pg.evaluate(() => JSON.stringify(WOK_APP.game.s.result)), '| Dialog:', (await pg.textContent('#dlg')).slice(0, 80));
    await pg.screenshot({ path: '/tmp/claude-0/sf/shots/' + n + '-concede.png' }); await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
