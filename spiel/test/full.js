const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  // Zwei Spieler
  await pg.click('[data-hplay="ai"]'); await pg.click('[data-mode="hot"]'); await pg.click('#start'); await pg.waitForTimeout(400);
  for (let i = 0; i < 12; i++) { await pg.waitForTimeout(400); const go = await pg.$('#ov:not([hidden]) [data-act="go"]'); if (go && !(await pg.$('#dlg .mhand'))) { await go.click(); continue; } const k = await pg.$('#ov:not([hidden]) #dlg [data-act="keep"]'); if (k) { await k.click(); continue; } if (await pg.evaluate(() => WOK_APP.game && WOK_APP.game.s.phase !== 'mulligan')) break; } // Starthand: beide behalten (4.5)
  console.log('Übergabe sichtbar beim Start?', await pg.isVisible('#ov'));
  await pg.click('#mainbtn'); await pg.click('#mainbtn'); await pg.click('#mainbtn'); const y = await pg.$('#ov:not([hidden]) [data-act="yes"]'); if (y) await y.click(); await pg.click('#mainbtn');
  await pg.waitForTimeout(300); console.log('Übergabe nach Zugende:', await pg.isVisible('#ov'), await pg.textContent('#dlg h2'));
  await pg.screenshot({ path: '/tmp/claude-0/wokui/hot-handover.png' });
  await pg.click('#dlg [data-act="go"]');
  console.log('Ansicht jetzt Spieler', await pg.evaluate(() => WOK_APP.game.view), 'aktiv', await pg.evaluate(() => WOK_APP.game.s.active));
  // bis zum Ende spielen (beide Seiten per KI-Entscheidung, über dispatch)
  await pg.evaluate(async () => { const g = WOK_APP.game, m = [{ seed: 1 }, { seed: 2 }]; let n = 0; while (!WOK_APP.game.s.result && n++ < 20000) { const s = WOK_APP.game.s; const p = WOK.actor(s); WOK_APP.game.handover = false; const a = WOK_AI.decide(s, p, 'mittel', m[p]); if (WOK_APP.dispatch(a) === false) WOK_APP.dispatch({ type: 'endPhase', p }); } });
  await pg.waitForTimeout(500);
  console.log('Ende:', await pg.textContent('#dlg'));
  await pg.screenshot({ path: '/tmp/claude-0/wokui/gameover.png' });
  console.log(errs);
  await b.close();
})();
