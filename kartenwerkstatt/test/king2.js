// Könige: Höchstwerte 20.000 HP / 3.500 ATK, Bewertung HP+ATK 25 %, drei Gaben +20 %, Gabenstärke 55 %
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  await p.click('[data-cardtype="king"]'); await p.waitForTimeout(300);
  await p.fill('#in-hp', '25000'); await p.press('#in-hp', 'Tab'); await p.waitForTimeout(300);
  const t1 = await p.evaluate(() => document.body.innerText.match(/HP 25\\.000[^\\n]*|liegt nicht zwischen 10\\.000 und 20\\.000[^\\n]*/g));
  console.log('Fehler bei 25.000 HP:', t1);
  await p.fill('#in-hp', '20000'); await p.press('#in-hp', 'Tab'); await p.fill('#in-atk', '3500'); await p.press('#in-atk', 'Tab'); await p.waitForTimeout(300);
  console.log('Power-Zeilen:', await p.evaluate(() => (document.body.innerText.match(/(ATK 3500[^\\n]*|HP 20\\.000[^\\n]*|Drei königliche Gaben[^\\n]*|Bonus für drei Gaben[^\\n]*)/g) || []).slice(0, 4)));
  await p.screenshot({ path: '/tmp/claude-0/sf/shots/werk-koenig.png' });
  console.log('Fehler:', errs); await b.close();
})();
