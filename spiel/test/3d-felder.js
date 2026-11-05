// 4.11: 3D-Spielfeld – jedes der 30 Felder wird per Mausklick auf die 3D-Leinwand richtig getroffen; Beschwören über 3D; keine Seitenfehler.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); let bad = 0;
  for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 1100, height: 900 }]) {
    const pg = await (await b.newContext({ viewport: vp })).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html?3d=1&low3d=1'); await pg.waitForTimeout(500); await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await require('./mull.js')(pg);
    for (let i = 0; i < 100; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); } await pg.waitForTimeout(1200);
    if (!await pg.evaluate(() => WOK_BOARD3D.active())) { console.log('FEHLER 3D nicht aktiv', vp); bad++; continue; }
    const slots = await pg.evaluate(() => { const S = WOK_BOARD3D._dbg(); window.__hits = []; S.handlers = { tap: t => __hits.push(t.slot || t.uid), long: () => {} }; return Object.keys(S.slots); });
    let miss = [];
    for (const sl of slots) { const p = await pg.evaluate(slot => { const c = document.querySelector('canvas.b3d').getBoundingClientRect(); const q = WOK_BOARD3D.project(slot); return { x: c.left + (q.left + q.w / 2) / 100 * c.width, y: c.top + (q.top + q.h * .8) / 100 * c.height }; }, sl);
      await pg.evaluate(() => { __hits = []; }); await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(30);
      const h = await pg.evaluate(() => __hits[0]); const ok = h === sl || (typeof h === 'string' && h.startsWith('u')); if (!ok) miss.push(sl + '→' + h); }
    const rect = await pg.evaluate(() => { const c = document.querySelector('canvas.b3d').getBoundingClientRect(); return [c.width, c.height].map(Math.round).join('x'); });
    console.log(vp.width + 'x' + vp.height, 'Leinwand', rect, 'Felder', slots.length, 'Fehlgriffe', miss.length ? miss.join(' ') : 'keine', 'Seitenfehler', errs.length);
    await pg.screenshot({ path: '/tmp/claude-0/wokui/3d-' + vp.width + '.png' });
    bad += miss.length + errs.length; await pg.context().close(); }
  await b.close(); console.log(bad ? 'FEHLER ' + bad : 'OK 3D-Felder'); process.exit(bad ? 1 : 0); })();
