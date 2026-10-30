const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1024, height: 1536 } });
  p.on('pageerror', e => console.log('pageerror', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
  for (const which of ['akuma', 'raiden']) {
    await p.goto('file:///home/claude/cc/test/render-test.html?' + which + '#' + which); await p.waitForFunction(() => document.title === 'done', null, { timeout: 30000 });
    console.log(which, JSON.stringify(await p.evaluate(() => window.result)));
    await p.locator('#c').screenshot({ path: '/home/claude/cc/test/' + which + '.png' });
  }
  await b.close();
})();
