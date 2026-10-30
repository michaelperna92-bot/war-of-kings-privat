const { chromium } = require('playwright');
const fs = require('fs');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 980 }, acceptDownloads: true });
  await ctx.route('**/pdf-lib.min.js', r => r.fulfill({ path: '/opt/npm-tools/node_modules/pdf-lib/dist/pdf-lib.min.js', contentType: 'text/javascript' }));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  await p.screenshot({ path: SH + 'e1-start.png' });
  // Karte anlegen
  await p.setInputFiles('#file-art', SH + 'hoch.png'); await p.waitForTimeout(800);
  await p.fill('#in-name', 'Akuma no Klinge');
  await p.fill('#in-energy', '6'); await p.fill('#in-atk', '3500'); await p.fill('#in-def', '3000');
  const pick = async (kind, val) => { await p.click(`[data-pick="${kind}"][data-val="${val}"]`); await p.waitForTimeout(80); };
  await pick('rarity', 'legendaer'); await pick('element', 'feuer'); await pick('race', 'daemonen'); await pick('class0', 'samurai');
  for (const d of ['n', 'w', 'e']) await p.click(`[data-dir="atk:${d}"]`);
  await p.click('[data-dir="mov:n"]');
  await p.click('[data-numshow="mov"]');
  await p.click('[data-act="gift-add"]'); await p.click('[data-giftpick="mordlust"]');
  await p.click('[data-act="gift-add"]'); await p.click('[data-giftpick="poison"]');
  await p.click('[data-act="gift-add"]'); await p.fill('#giftq', 'durch'); await p.click('[data-giftpick="durchbruch"]');
  console.log('Gaben zur Auswahl:', await (async () => { await p.click('[data-act="gift-add"]').catch(() => {}); const n = await p.$$eval('.giftopt', e => e.length).catch(() => 0); await p.click('[data-act="close"]').catch(() => {}); return n; })());
  // Gestaltung
  await p.click('[data-style="theme:karmesin"]'); await p.click('[data-style="name:blattgold"]'); await p.click('[data-fontset="koeniglich"]');
  await p.click('[data-style="def:topas"]'); await p.click('[data-style="element:amethyst"]');
  await p.click('[data-style="movArrow:#22b8c4"]');
  // Bild ganz zeigen
  await p.click('[data-act="art-contain"]'); await p.waitForTimeout(300);
  console.log('Randfüllung sichtbar:', await p.isVisible('#fillrow'), '| Regler-Minimum:', await p.getAttribute('#art-zoom', 'min'));
  await p.waitForTimeout(400);
  // Bild im Fenster ziehen
  const box = await p.locator('#preview').boundingBox();
  await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.33, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(300);
  const issues = await p.$$eval('#issues .issue', els => els.map(e => e.className.split(' ')[1] + ': ' + e.textContent));
  console.log('Prüfung:\n  ' + issues.join('\n  '));
  await p.click('#btn-save'); await p.waitForTimeout(500);
  await p.click('[data-status="freigegeben"]'); await p.waitForTimeout(200);
  await p.click('#btn-save'); await p.waitForTimeout(600);
  await p.screenshot({ path: SH + 'e2-card.png' });
  // zweite Karte mit zwei Klassen + Duplizieren
  await p.click('[data-act="duplicate"]'); await p.waitForTimeout(700);
  await pick('class1', 'geist'); await p.fill('#in-name', 'Akuma der Geisterklinge'); await p.click('#btn-save'); await p.waitForTimeout(600);
  console.log('Bibliothek:', await p.$$eval('.libitem b', e => e.map(x => x.textContent)));
  // Neu laden: Daten bleiben
  await p.reload(); await p.waitForSelector('.libitem'); await p.waitForTimeout(1500);
  console.log('Nach Neuladen:', await p.$$eval('.libitem b', e => e.map(x => x.textContent)), '| Name im Editor:', await p.inputValue('#in-name'));
  await p.screenshot({ path: SH + 'e3-reload.png' });
  // Filter
  await p.selectOption('#f-cls', 'geist'); await p.waitForTimeout(200);
  console.log('Filter Geist:', await p.$$eval('.libitem b', e => e.map(x => x.textContent)));
  await p.selectOption('#f-cls', '');
  // Export PNG
  const dl = async (fn) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), fn()]); const path = SH + 'out_' + d.suggestedFilename(); await d.saveAs(path); return path; };
  await p.click('[data-act="menu"]');
  await p.click('[data-act="export-png"]'); await p.selectOption('#png-fmt', 'ygo'); await p.check('input[name=png-fit][value=contain]');
  const png = await dl(() => p.click('[data-act="png-go"]'));
  console.log('PNG-Maße:', await p.evaluate(async (u) => 0, png));
  console.log('PNG:', png, fs.statSync(png).size);
  await p.click('[data-act="menu"]'); await p.click('[data-act="export-pdf"]'); await p.waitForTimeout(200);
  console.log('PDF-Hinweis:', await p.textContent('#pdf-note'));
  await p.check('input[name=pdf-fit][value=contain]');
  const pdf = await dl(() => p.click('[data-act="pdf-go"]'));
  console.log('PDF:', pdf, fs.statSync(pdf).size);
  await p.click('[data-act="menu"]');
  const js = await dl(() => p.click('[data-act="backup"]'));
  const data = JSON.parse(fs.readFileSync(js, 'utf8')); console.log('Sicherung:', data.cards.length, 'Karten, Bild eingebettet:', !!(data.cards[0].art && data.cards[0].art.data));
  // Wappenbibliothek + Vorlage
  await p.click('[data-act="crests"]'); await p.waitForTimeout(300); await p.click('[data-crtab="gifts"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: SH + 'e4-crests.png' }); await p.click('[data-act="close"]');
  await p.click('[data-act="layout"]'); await p.waitForTimeout(800);
  await p.selectOption('#ly-ref', 'akuma'); await p.waitForTimeout(400);
  await p.screenshot({ path: SH + 'e5-layout.png' });
  await p.click('[data-ly="cancel"]'); await p.waitForTimeout(200);
  // Ungespeicherte Änderung + Schutz
  await p.fill('#in-name', 'Geändert'); await p.click('[data-act="new"]'); await p.waitForTimeout(200);
  console.log('Schutzdialog:', await p.$eval('#modal', e => e.innerText.slice(0, 60).replace(/\n/g, ' ')));
  await p.click('[data-act="discard"]');
  // Handy
  const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 844 });
  m.on('pageerror', e => errs.push('mobile: ' + e.message));
  await m.goto('http://localhost:8770/'); await m.waitForSelector('#preview'); await m.waitForTimeout(1500);
  await m.screenshot({ path: SH + 'e6-phone.png', fullPage: true });
  console.log('Handy Breite:', await m.evaluate(() => document.documentElement.scrollWidth));
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
