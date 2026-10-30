const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  await p.setInputFiles('#file-art', SH + 'akuma_art.png'); await p.waitForTimeout(600);
  await p.fill('#in-name', 'Akuma no Klinge'); await p.fill('#in-energy', '6'); await p.fill('#in-atk', '900'); await p.fill('#in-def', '500');
  for (const [k, v] of [['rarity', 'legendaer'], ['element', 'feuer'], ['race', 'daemonen'], ['class0', 'samurai']]) await p.click(`[data-pick="${k}"][data-val="${v}"]`);
  for (const d of ['n', 'w', 'e']) await p.click(`[data-dir="atk:${d}"]`); await p.click('[data-dir="mov:n"]');
  for (const g of ['poison', 'entwaffnen', 'tausch']) { await p.click('[data-act="gift-add"]'); await p.click(`[data-giftpick="${g}"]`); }
  const shots = [['koeniglich', 'blattgold', 'karmesin', { def: 'topas' }], ['gotisch', 'silber', 'obsidian', { energy: 'amethyst', atk: 'rubin' }], ['elegant', 'altgold', 'elfenbein', { element: 'rubin' }]];
  let i = 0;
  for (const [fs, ns, th, gems] of shots) {
    await p.click(`[data-fontset="${fs}"]`); await p.click(`[data-style="name:${ns}"]`); await p.click(`[data-style="theme:${th}"]`);
    for (const [k, v] of Object.entries(gems)) await p.click(`[data-style="${k}:${v}"]`);
    await p.waitForTimeout(900);
    await p.locator('#preview').screenshot({ path: SH + 'd' + (++i) + '.png' });
  }
  // Einzelschrift überschreiben
  await p.click('.fontroles summary'); await p.selectOption('[data-fontrole="text"]', 'cormorant'); await p.waitForTimeout(500);
  await p.setViewportSize({ width: 1440, height: 2000 }); await p.evaluate(() => { const s = document.querySelector('.sec[data-sec="gestaltung"]'); document.querySelector('#panel').scrollTop = s.offsetTop - 60; }); await p.waitForTimeout(300); await p.screenshot({ path: SH + 'd-ui.png', clip: { x: 1060, y: 56, width: 380, height: 1940 } });
  console.log('Prüfung:', await p.$$eval('#issues .issue', e => e.map(x => x.textContent)));
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
