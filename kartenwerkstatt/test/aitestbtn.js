const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1000);
  await p.setInputFiles('#file-art', '/home/claude/cc/test/akuma_art.png'); await p.waitForTimeout(1500);
  await p.click('#ai-chip'); await p.waitForTimeout(300); await p.selectOption('#aic-prov', 'ollama'); await p.click('[data-act="aicfg-test"]');
  await p.waitForFunction(() => /Bilderkennung klappt|Bilderkennung:|✗/.test(document.querySelector('#aic-status').textContent), null, { timeout: 30000 });
  console.log('Test Ollama:', await p.textContent('#aic-status'));
  await p.evaluate(() => document.querySelector('#aic-status').textContent = ''); await p.selectOption('#aic-prov', 'openai'); await p.fill('#aic-key', 'sk-test'); await p.click('[data-act="aicfg-test"]');
  await p.waitForTimeout(9000);
  console.log('Test ChatGPT (ohne Internet):', await p.textContent('#aic-status'));
  await p.evaluate(() => document.querySelector('#aic-status').textContent = ''); await p.selectOption('#aic-prov', 'gemini'); await p.fill('#aic-key', 'AIza-test'); await p.click('[data-act="aicfg-test"]');
  await p.waitForTimeout(9000);
  console.log('Test Gemini (ohne Internet):', await p.textContent('#aic-status'));
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
