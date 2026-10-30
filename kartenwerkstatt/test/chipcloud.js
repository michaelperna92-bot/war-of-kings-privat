const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
  await ctx.addInitScript(() => { const sample = async () => ({ text: '' }); sample.limits = async () => ({ images: { maxCount: 4 } }); sample.json = async () => ({}); window.claude = { use: async n => n === 'sample' ? sample : null }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(2500);
  console.log('Cloud:', (await p.textContent('#ai-chip')).trim(), '|', await p.getAttribute('#ai-chip', 'data-s'));
  await p.screenshot({ path: '/home/claude/cc/test/chip-phone.png', clip: { x: 0, y: 0, width: 390, height: 200 } });
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
