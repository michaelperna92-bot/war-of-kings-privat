// Königliche Gaben in der Werkstatt: Blitzkrieg wählbar, Wirkungsbereich und Stärke einstellbar, Wappen auf der Karte
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  await p.click('[data-act="new"]'); await p.click('[data-act="newtype"][data-t="king"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'König Testor'); await p.fill('#in-hp', '16000'); await p.fill('#in-atk', '2800'); await p.press('#in-atk', 'Tab');
  for (const id of ['blitzkrieg', 'zorn_des_imperators', 'ewiges_bollwerk']) { await p.click('[data-act="gift-add"]'); await p.waitForTimeout(200); await p.click('[data-royalpick="' + id + '"]'); await p.waitForTimeout(250); }
  console.log('Gaben:', await p.evaluate(() => [...document.querySelectorAll('.giftslot b')].map(x => x.textContent).join(', ')));
  console.log('Steuerung:', await p.evaluate(() => [...document.querySelectorAll('.giftslot')].map(g => [...g.querySelectorAll('select, input')].map(x => x.tagName + (x.dataset ? JSON.stringify(Object.assign({}, x.dataset)) : '')).join(' ')).join(' || ').slice(0, 400)));
  await (await p.$('#preview')).screenshot({ path: '/tmp/claude-0/sf/shots/werk-royal.png' });
  console.log('Fehler:', errs); await b.close();
})();
