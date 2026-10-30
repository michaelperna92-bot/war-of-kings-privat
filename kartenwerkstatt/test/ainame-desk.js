const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1000);
  // 1) ohne Verbindung: Indoor-Vorschläge
  await p.click('[data-pick="element"][data-val="feuer"]'); await p.click('[data-pick="race"][data-val="daemonen"]');
  await p.setInputFiles('#file-art', SH + 'akuma_art.png'); await p.waitForTimeout(2500);
  console.log('Ohne KI-Verbindung, automatisch:', await p.inputValue('#in-name'), '|', await p.textContent('#name-sugg'));
  // 2) KI-Verbindung Ollama einrichten
  await p.click('[data-act="menu"]'); await p.click('[data-act="aicfg"]'); await p.waitForTimeout(300);
  await p.selectOption('#aic-prov', 'ollama'); await p.click('[data-act="aicfg-models"]'); await p.waitForTimeout(800);
  console.log('Modelle:', await p.textContent('#aic-status'), '| Feld:', await p.inputValue('#aic-model'));
  await p.click('[data-act="aicfg-test"]'); await p.waitForTimeout(800);
  console.log('Test:', await p.textContent('#aic-status'));
  await p.screenshot({ path: SH + 'n1-aicfg.png' });
  await p.click('[data-act="aicfg-save"]'); await p.waitForTimeout(300);
  // 3) Name finden
  await p.click('[data-act="name-ai"]'); await p.waitForTimeout(1500);
  console.log('Name finden:', await p.inputValue('#in-name'), '|', await p.textContent('#name-sugg'));
  await p.click('[data-namepick="2"]'); await p.waitForTimeout(200);
  console.log('Nach Antippen:', await p.inputValue('#in-name'));
  await p.locator('.sec[data-sec="name"]').screenshot({ path: SH + 'n2-name.png' });
  // 4) Gemini ohne Internet → Fallback
  await p.click('[data-act="menu"]'); await p.click('[data-act="aicfg"]'); await p.waitForTimeout(300);
  await p.selectOption('#aic-prov', 'gemini'); await p.fill('#aic-key', 'TESTKEY'); await p.fill('#aic-model', 'gemini-flash-latest'); await p.click('[data-act="aicfg-save"]'); await p.waitForTimeout(300);
  await p.click('[data-act="name-ai"]'); await p.waitForTimeout(4000);
  console.log('Gemini offline:', await p.inputValue('#in-name'), '|', await p.textContent('#toast'));
  // zurück auf Ollama, AI-Modus
  await p.click('[data-act="menu"]'); await p.click('[data-act="aicfg"]'); await p.waitForTimeout(300); await p.selectOption('#aic-prov', 'ollama'); await p.click('[data-act="aicfg-save"]'); await p.waitForTimeout(300);
  await p.click('[data-act="ai"]'); await p.waitForTimeout(800);
  console.log('AI-Modus Option:', (await p.textContent('label.ai-opt')).trim().slice(0, 120));
  await p.setInputFiles('#ai-files', ['ai0.jpg', 'ai1.jpg', 'ai2.jpg'].map(f => SH + f)); await p.click('[data-ai="run"]');
  await p.waitForFunction(() => !document.querySelector('[data-ai="stop"]'), null, { timeout: 60000 }); await p.waitForTimeout(500);
  console.log('AI-Modus:\n  ' + (await p.$$eval('.ai-item', e => e.map(x => x.innerText.replace(/\n+/g, ' / ').slice(0, 160)))).join('\n  '));
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
