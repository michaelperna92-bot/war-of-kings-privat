const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1000);
  await p.click('[data-act="new"]'); await p.waitForTimeout(300);
  const state = async (label) => { await p.waitForTimeout(150); const r = await p.evaluate(() => ({ badge: document.querySelector('#pw-live').innerText.replace(/\s+/g, ' '), energy: document.querySelector('#in-energy').value, rar: (document.querySelector('[data-pick="rarity"].on') || {}).textContent || '–' })); console.log(label.padEnd(34), '|', r.badge.padEnd(26), '| Energie', r.energy || '–', '| Seltenheit markiert:', r.rar.replace(/ohne Krone/, '').trim()); };
  await p.click('[data-dir="atk:n"]'); await p.click('[data-dir="atk:w"]'); await p.click('[data-dir="atk:e"]'); await p.click('[data-dir="mov:n"]');
  for (const g of ['mordlust', 'entwaffnen', 'doppelschlag']) { await p.click('[data-act="gift-add"]'); await p.click(`[data-giftpick="${g}"]`); }
  await p.locator('#in-atk').pressSequentially('800'); await state('ATK 800 getippt (DEF leer)');
  await p.locator('#in-def').pressSequentially('600'); await state('DEF 600 → Raiden-Werte');
  await p.fill('#in-atk', ''); await p.locator('#in-atk').pressSequentially('3000'); await state('ATK 3000');
  await p.fill('#in-def', ''); await p.locator('#in-def').pressSequentially('3000'); await state('DEF 3000');
  await p.click('[data-dir="mov:n"]'); await state('Bewegung 2 Felder');
  await p.selectOption('#in-synergy', '6'); await state('Synergie +6');
  await p.click('[data-pick="rarity"][data-val="selten"]'); await state('Seltenheit von Hand: Selten');
  await p.fill('#in-def', ''); await p.locator('#in-def').pressSequentially('500'); await state('DEF 500 (Seltenheit bleibt Hand)');
  await p.locator('#in-energy').fill('9'); await state('Energie von Hand 9');
  console.log('Hinweise:', await p.$$eval('#issues .issue', e => e.map(x => x.textContent).filter(t => /Power|Gewählt|Energie/.test(t))));
  await p.click('[data-act="power-apply"]'); await state('Vorschlag übernehmen');
  await p.evaluate(() => { const s = document.querySelector('.sec[data-sec="werte"]'); document.querySelector('#panel').scrollTop = s.offsetTop - 60; });
  await p.waitForTimeout(300); await p.screenshot({ path: '/home/claude/cc/test/live.png' });
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
