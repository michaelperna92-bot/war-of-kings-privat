const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 1500 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('requestfailed', r => { if (!/fonts\.googleapis/.test(r.url())) errs.push('fehlt: ' + r.url()); });
  await p.goto('file:///tmp/claude-0/chk/z/WoK_Kartenwerkstatt/web/index.html'); await p.waitForTimeout(2500);
  const n = await p.$$eval('.card', e => e.length);
  const imgs = await p.$$eval('.card img', e => e.map(i => i.naturalWidth > 0).filter(x => !x).length);
  console.log('Karten im Viewer:', n, '| nicht geladene Bilder:', imgs);
  await p.screenshot({ path: '/home/claude/cc/test/viewer.png', fullPage: true });
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
