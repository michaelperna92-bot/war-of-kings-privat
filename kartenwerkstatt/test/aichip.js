const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(2500);
  const chip = async t => console.log(t.padEnd(22), (await p.textContent('#ai-chip')).trim(), '|', await p.getAttribute('#ai-chip', 'data-s'), '|', (await p.getAttribute('#ai-chip', 'title')).slice(0, 110));
  await chip('Ohne Verbindung:');
  await p.click('#ai-chip'); await p.waitForTimeout(300); await p.selectOption('#aic-prov', 'ollama'); await p.click('[data-act="aicfg-save"]'); await p.waitForTimeout(1500);
  await chip('Ollama:');
  await p.click('#ai-chip'); await p.waitForTimeout(300); await p.selectOption('#aic-prov', 'gemini'); await p.click('[data-act="aicfg-save"]'); await p.waitForTimeout(1500);
  await chip('Gemini ohne Schlüssel:');
  await p.click('#ai-chip'); await p.waitForTimeout(300); await p.fill('#aic-key', 'TEST'); await p.click('[data-act="aicfg-save"]'); await p.waitForTimeout(3000);
  await chip('Gemini offline:');
  await p.click('#ai-chip'); await p.waitForTimeout(300); await p.selectOption('#aic-prov', 'ollama'); await p.click('[data-act="aicfg-save"]'); await p.waitForTimeout(1500);
  // Gabentexte
  await p.fill('#in-atk', '1000'); await p.fill('#in-def', '1000');
  await p.click('[data-act="gift-add"]'); await p.click('[data-giftpick="blitzschritt"]'); await p.click('[data-act="gift-add"]'); await p.click('[data-giftpick="rueckzug"]'); await p.waitForTimeout(500);
  console.log('Hinweise zu Texten:', await p.$$eval('#issues .issue', e => e.map(x => x.textContent).filter(t => /passt|klein/.test(t))));
  await p.screenshot({ path: SH + 'chip-desk.png', clip: { x: 0, y: 0, width: 1440, height: 60 } });
  await p.locator('#preview').screenshot({ path: SH + 'gifts-blitz.png' });
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
