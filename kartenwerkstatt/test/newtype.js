// Neue Karte: zuerst Kartenart wählen; AI-Modus: zuerst Kartenart (auch Könige und Gemischt)
const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  await p.click('[data-act="new"]'); await p.waitForTimeout(300);
  console.log('Auswahl:', await p.evaluate(() => [...document.querySelectorAll('[data-act="newtype"] b')].map(x => x.textContent).join(', ')));
  await p.screenshot({ path: '/tmp/claude-0/sf/shots/werk-newtype.png' }); await p.click('#modal [data-act="close"]'); await p.waitForTimeout(200);
  for (const t of ['king', 'curse', 'spell', 'hero']) {
    await p.click('[data-act="new"]'); await p.waitForTimeout(200);
    if (await p.isVisible('#modal [data-act="newtype"]') === false) { const d = await p.$('#modal button.danger, #modal [data-act="discard"]'); if (d) await d.click(); await p.waitForTimeout(200); }
    await p.click('[data-act="newtype"][data-t="' + t + '"]'); await p.waitForTimeout(300);
    console.log(t, '→ Editor:', await p.evaluate(() => [...document.querySelectorAll('[data-cardtype].on')].map(x => x.dataset.cardtype).join()));
  }
  // AI-Modus
  await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(x => /AI-Modus/.test(x.textContent)); bt.click(); }); await p.waitForTimeout(400);
  console.log('AI-Auswahl:', await p.evaluate(() => [...document.querySelectorAll('[data-ai-pick] b')].map(x => x.textContent).join(', ')));
  await p.screenshot({ path: '/tmp/claude-0/sf/shots/werk-aitype.png' });
  await p.click('[data-ai-pick="all"]'); await p.waitForTimeout(300);
  console.log('danach Parameter:', await p.isVisible('#ai-drop'), '| gewählt:', await p.evaluate(() => document.querySelector('[data-ai-ctype].on').textContent));
  const u = await p.$('#ai-useai'); if (u && await u.isChecked()) await u.uncheck();
  await p.setInputFiles('#ai-files', [SH + 'ai0.jpg', SH + 'ai1.jpg', SH + 'ai2.jpg', SH + 'ai3.jpg', SH + 'ai4.jpg', SH + 'ai0.jpg']); await p.waitForTimeout(400);
  await p.click('[data-ai="run"]'); await p.waitForFunction(() => !/läuft|wird/i.test(document.querySelector('#ai-log').textContent) && document.querySelectorAll('.ai-item.fertig').length >= 6, null, { timeout: 60000 }).catch(() => {});
  console.log('Ergebnisse:', await p.evaluate(() => [...document.querySelectorAll('.ai-item')].map(x => x.className.split(' ')[1] + ':' + x.querySelector('small') ?.textContent.slice(0, 40)).join(' | ')));
  await p.click('[data-ai="close"]'); await p.waitForTimeout(300);
  await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(x => /AI-Modus/.test(x.textContent)); bt.click(); }); await p.waitForTimeout(300);
  await p.click('[data-ai-pick="king"]'); await p.waitForTimeout(200);
  await p.setInputFiles('#ai-files', [SH + 'ai1.jpg', SH + 'ai2.jpg']); await p.click('[data-ai="run"]');
  await p.waitForFunction(() => document.querySelectorAll('.ai-item.fertig').length >= 2, null, { timeout: 60000 }).catch(() => {});
  console.log('Könige:', await p.evaluate(() => [...document.querySelectorAll('.ai-item')].map(x => x.textContent.slice(0, 70)).join(' | ')));
  console.log('Bibliothek Könige:', await p.evaluate(async () => { const all = await window.WOK_STORE_DEBUG?.list?.(); return all ? all.length : 'n/a'; }));
  console.log('Fehler:', errs); await b.close();
})();
