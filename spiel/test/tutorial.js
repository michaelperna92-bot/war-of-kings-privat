// Tutorial: alle Lektionen über die Oberfläche durchspielen
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const pg = await b.newPage({ viewport: { width: +process.argv[2] || 1366, height: +process.argv[3] || 900 } }); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  await pg.click('.htut'); await pg.waitForTimeout(300);
  const ids = await pg.evaluate(() => [...document.querySelectorAll('[data-tut]')].map(b => b.dataset.tut));
  console.log('Lektionen:', ids.join(', '));
  const step = () => pg.evaluate(() => { const t = document.querySelector('#tutbox'); return t.hidden ? null : t.querySelector('.tb-step').textContent; });
  const hasNext = () => pg.isVisible('[data-tutx="next"]');
  const clickHl = async (i) => { const n = await pg.evaluate(i => { const l = [...document.querySelectorAll('.tut-hl')]; return l.length; }, i); const el = (await pg.$$('.tut-hl'))[i || 0]; if (!el) throw new Error('kein Hinweisziel bei ' + await step()); await pg.waitForTimeout(500); await el.click(); await pg.waitForTimeout(350); };
  for (const id of ids) {
    await pg.click('[data-tut="' + id + '"]'); await pg.waitForTimeout(600);
    let guard = 0;
    while (guard++ < 30) {
      if (await pg.isVisible('#dlg') && await pg.evaluate(() => /geschafft/.test(document.querySelector('#dlg').textContent))) break;
      const st = await step(); if (!st) break;
      await pg.waitForFunction(() => document.querySelector('#fxlayer').hidden, null, { timeout: 8000 }).catch(() => {});
      if (await hasNext()) { await pg.click('[data-tutx="next"]'); await pg.waitForTimeout(300); continue; }
      const txt = await pg.textContent('#tutbox p');
      if (/Doppelklick/.test(txt)) { const el = (await pg.$$('.tut-hl'))[0]; await el.dblclick({ force: true }); await pg.waitForTimeout(900); continue; }
      if (/Schließe sie/.test(txt)) { await pg.click('.insp-x'); await pg.waitForTimeout(600); continue; }
      if (await pg.isVisible('#ov') && !(await pg.evaluate(() => /geschafft/.test(document.querySelector('#dlg').textContent)))) { const bt = await pg.$('#dlg [data-act="yes"], #dlg [data-act="go"]'); if (bt) { await bt.click(); await pg.waitForTimeout(400); continue; } }
      const hl = await pg.$$('.tut-hl'); if (!hl.length) { await pg.waitForTimeout(800); continue; }
      // Zielwahl beim Ausspielen: erst Ziel, dann bestätigen
      if (await pg.$('.tut-hl[data-cok]')) { const t = await pg.$('.tok.tut-hl'); if (t) { await t.click({ force: true }); await pg.waitForTimeout(300); } await pg.$eval('[data-cok]', e => e.scrollIntoView({ block: 'center' })); await pg.click('[data-cok]'); await pg.waitForTimeout(500); continue; }
      if (await pg.$('.hcard.tut-hl') && !(await pg.evaluate(() => WOK_APP.game && WOK_APP.game.sel))) { await pg.waitForTimeout(500); await pg.click('.hcard.tut-hl'); await pg.waitForTimeout(500); const c = await pg.$('[data-cast]'); if (c && await c.isVisible()) { await c.evaluate(e => e.scrollIntoView({ block: 'center' })); await c.click(); await pg.waitForTimeout(350); } continue; }
      await clickHl(0);
      if (await pg.isVisible('#ov')) { const bt = await pg.$('#dlg [data-act="yes"], #dlg [data-act="go"]'); if (bt) { await bt.click(); await pg.waitForTimeout(400); } }
      await pg.waitForTimeout(700);
    }
    const ok = await pg.evaluate(() => /geschafft/.test(document.querySelector('#dlg').textContent));
    console.log(id, ok ? '✓ geschafft' : '✗ hängt bei ' + await step() + ': ' + (await pg.textContent('#tutbox p')).slice(0, 90));
    if (id === 'zauber') await pg.screenshot({ path: OUT + 'tut-zauber.png' });
    if (ok) await pg.click('#dlg [data-act="list"]'); else { await pg.screenshot({ path: OUT + 'tut-' + id + '-fehler.png' }); await pg.click('[data-tutx="quit"]').catch(() => {}); }
    await pg.waitForTimeout(400);
  }
  console.log('Fortschritt:', await pg.textContent('#tutgrid .hint'));
  await pg.screenshot({ path: OUT + 'tut-liste.png' });
  console.log('Fehler:', errs); await b.close();
})();
