const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
  await ctx.addInitScript(() => {
    window.__calls = [];
    const sample = async () => ({ text: '' });
    sample.limits = async () => ({ images: { maxCount: 4, maxInputBytes: 2e7, mediaTypes: ['image/jpeg', 'image/png'] } });
    sample.json = async (prompt, opts) => { window.__calls.push({ tier: opts.modelTier, n: (opts.images || []).length, names: /"names"/.test(prompt) }); await new Promise(r => setTimeout(r, 200));
      return { names: ['Höllenglut Akuma', 'Rotklinge Kenshi', 'Flammenmaske Oni'], reason: 'Gehörnter Samurai in brennender Stadt' }; };
    window.claude = { use: async n => n === 'sample' ? sample : null };
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1200);
  await p.setInputFiles('#file-art', SH + 'akuma_art.png'); await p.waitForTimeout(2500);
  console.log('Automatisch nach Upload:', await p.inputValue('#in-name'), '|', await p.textContent('#name-sugg'));
  console.log('Claude-Aufrufe:', JSON.stringify(await p.evaluate(() => window.__calls)));
  await p.locator('.sec[data-sec="name"]').scrollIntoViewIfNeeded(); await p.locator('.sec[data-sec="name"]').screenshot({ path: SH + 'n3-phone.png' });
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
