// Karte groß: Antippen auf dem Brett und in der Hand, Aktionen aus der Großansicht, PC und Handy
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h, n] of [[1366, 900, 'pc'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
    await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await pg.waitForTimeout(600);
    for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
    await pg.evaluate(() => { const s = WOK_APP.game.s; s.players[0].energy = 10; WOK_APP.renderNow(); });
    // Handkarte antippen
    const iid = await pg.evaluate(() => { const s = WOK_APP.game.s; return s.players[0].hand.find(h => WOK.summonOptions(s, h.iid).length).iid; });
    await pg.click('.hcard[data-iid="' + iid + '"]'); await pg.waitForTimeout(300); console.log(n, 'einfacher Klick öffnet nichts:', await pg.isHidden('#insp'));
    await pg.dblclick('.hcard[data-iid="' + iid + '"]'); await pg.waitForTimeout(250);
    await pg.screenshot({ path: OUT + n + '-insp-flip.png' }); await pg.waitForTimeout(600);
    await pg.screenshot({ path: OUT + n + '-insp-hand.png' });
    const vis = await pg.evaluate(() => { const r = document.querySelector('#insp-info').getBoundingClientRect(), c = document.querySelector('#insp-hold').getBoundingClientRect(); return { info: [Math.round(r.top), Math.round(r.bottom)], card: [Math.round(c.width), Math.round(c.height)], scroll: document.querySelector('#insp-info').scrollHeight - document.querySelector('#insp-info').clientHeight, buttons: [...document.querySelectorAll('.insp-acts button')].map(x => x.textContent) }; });
    console.log(n, 'Großansicht Hand:', JSON.stringify(vis));
    await pg.click('.insp-acts [data-ix="pick"]'); await pg.waitForTimeout(500);
    const f = await pg.evaluate(() => [...document.querySelectorAll('#board .cell.hl-summon')].map(e => e.dataset.f)[0]);
    await pg.click('#board .cell[data-f="' + f + '"]', { force: true }); await pg.waitForTimeout(500);
    console.log(n, 'beschworen auf', f, await pg.evaluate(f => !!WOK.unitAt(WOK_APP.game.s, f), f));
    // eigenen König antippen
    const k = await pg.evaluate(() => WOK_APP.game.s.players[0].king);
    const box = await pg.locator('.tok[data-uid="' + k + '"]').boundingBox(); await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await pg.mouse.down(); await pg.waitForTimeout(700); await pg.mouse.up(); await pg.waitForTimeout(500); console.log(n, 'gedrückt halten öffnet:', await pg.isVisible('#insp'));
    await pg.screenshot({ path: OUT + n + '-insp-koenig.png' });
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
    console.log(n, 'geschlossen:', await pg.isHidden('#insp'));
    await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
