const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1000);
  await p.fill('#in-atk', '1500'); await p.fill('#in-def', '1000');
  await p.click('[data-act="gift-add"]'); await p.waitForTimeout(200);
  console.log('Gaben zur Auswahl:', await p.$$eval('[data-giftpick]', e => e.map(x => x.dataset.giftpick).join(', ')));
  await p.click('[data-giftpick="ansturm"]'); await p.click('[data-act="gift-add"]'); await p.click('[data-giftpick="heilung"]'); await p.waitForTimeout(300);
  console.log('Power:', (await p.$eval('.sec[data-sec="power"]', e => e.innerText)).split('\n').filter(l => /Ansturm|Heilung|Gesamt-Power|Grundwert/.test(l)).join(' | '));
  console.log('Hinweise:', await p.$$eval('#issues .issue', e => e.map(x => x.textContent).filter(t => /Ansturm|Heilung|bewertet/.test(t))));
  await p.locator('#preview').screenshot({ path: '/home/claude/cc/test/g-ansturm.png' });
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
