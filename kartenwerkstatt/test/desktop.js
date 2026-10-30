const { chromium } = require('playwright');
const fs = require('fs');
const SH = '/home/claude/cc/test/', DOCS = '/tmp/claude-0/wd/docs/War of Kings Kartenwerkstatt/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 920 } });
  // Internet komplett sperren: nur der lokale Server
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage(); const errs = [], ext = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('request', r => { if (!r.url().startsWith('http://127.0.0.1')) ext.push(r.url()); });
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1200);
  console.log('Speicher-Anzeige:', await p.textContent('header .pill'));
  await p.setInputFiles('#file-art', SH + 'hoch.png'); await p.waitForTimeout(800);
  await p.fill('#in-name', 'Testheld Offline');
  await p.fill('#in-atk', '2000'); await p.fill('#in-def', '2000');
  for (const d of ['n', 'w', 'e']) await p.click(`[data-dir="atk:${d}"]`);
  await p.click('[data-dir="mov:n"]'); await p.click('[data-numshow="mov"]').catch(() => {});
  await p.fill('[data-num="mov"]', '3'); await p.dispatchEvent('[data-num="mov"]', 'input'); await p.waitForTimeout(200);
  await p.click('[data-act="gift-add"]'); await p.click('[data-giftpick="blitzschritt"]'); await p.waitForTimeout(300);
  const pw = await p.$eval('.sec[data-sec="power"]', e => e.innerText);
  console.log('Power-Abschnitt:\n' + pw.split('\n').filter(Boolean).slice(0, 16).join(' | '));
  await p.click('#btn-save'); await p.waitForTimeout(700);
  console.log('Kartendateien:', fs.readdirSync(DOCS + 'Karten').filter(f => f.endsWith('.json')), '| Bilder:', fs.readdirSync(DOCS + 'Bilder'));
  await p.screenshot({ path: SH + 'w1-card.png' });
  // PNG-Export → Exporte-Ordner
  await p.click('[data-act="menu"]'); await p.click('[data-act="export-png"]'); await p.click('[data-act="png-go"]'); await p.waitForTimeout(2500);
  await p.click('[data-act="menu"]'); await p.click('[data-act="export-pdf"]'); await p.waitForTimeout(200); await p.click('[data-act="pdf-go"]'); await p.waitForTimeout(5000);
  console.log('Exporte:', fs.readdirSync(DOCS + 'Exporte').map(f => f + ' ' + fs.statSync(DOCS + 'Exporte/' + f).size));
  // Neu laden
  await p.reload(); await p.waitForSelector('.libitem'); await p.waitForTimeout(1200);
  console.log('Nach Neustart:', await p.$$eval('.libitem b', e => e.map(x => x.textContent)));
  // AI-Modus offline
  await p.click('[data-act="ai"]'); await p.waitForTimeout(500);
  await p.setInputFiles('#ai-files', ['ai0.jpg', 'ai1.jpg', 'ai2.jpg', 'ai3.jpg', 'ai4.jpg'].map(f => SH + f)); await p.waitForTimeout(500);
  await p.click('[data-ai-rar="gemischt"]');
  await p.click('[data-ai="run"]'); await p.waitForFunction(() => !document.querySelector('[data-ai="stop"]'), null, { timeout: 60000 }); await p.waitForTimeout(500);
  console.log('Indoor-KI:\n  ' + (await p.$$eval('.ai-item', e => e.map(x => x.innerText.replace(/\n+/g, ' / ')))).join('\n  '));
  await p.screenshot({ path: SH + 'w2-ai.png' });
  console.log('Karten gesamt:', fs.readdirSync(DOCS + 'Karten').filter(f => f.endsWith('.json')).length);
  console.log('Externe Anfragen:', ext.length ? ext : 'keine');
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
