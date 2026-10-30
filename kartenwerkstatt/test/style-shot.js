const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2048, height: 1536 } });
  p.on('pageerror', e => console.log('pageerror', e.message));
  for (const q of ['c,d']) {
    await p.goto('file:///home/claude/cc/test/style-test.html?' + q); await p.waitForFunction(() => document.title === 'done', null, { timeout: 60000 });
    await p.locator('#c').screenshot({ path: '/home/claude/cc/test/style_' + q.replace(',', '_') + '.png' });
  }
  await b.close();
})();
