const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  // 1) PC: Neuberechnung beim Start + Übertragungsdatei erstellen
  const pc = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage(); const errs = []; pc.on('pageerror', e => errs.push('PC: ' + e.message));
  await pc.context().route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await pc.goto('http://127.0.0.1:47831/'); await pc.waitForSelector('#preview'); await pc.waitForTimeout(2500);
  console.log('PC Toast:', await pc.textContent('#toast'));
  const disk = JSON.parse(fs.readFileSync('/tmp/claude-0/wd/docs/War of Kings Kartenwerkstatt/Karten/kalt001.json', 'utf8'));
  console.log('Alte Karte nach Start:', disk.rarity, '| Energie', disk.energy, '| Version', disk.powerVersion, '| Live:', (await pc.textContent('#pw-float')).trim());
  await pc.click('[data-act="menu"]'); await pc.click('[data-act="backup"]'); await pc.waitForTimeout(1500);
  const ex = fs.readdirSync('/tmp/claude-0/wd/docs/War of Kings Kartenwerkstatt/Exporte').filter(f => f.endsWith('.json'));
  const syncFile = '/tmp/claude-0/wd/docs/War of Kings Kartenwerkstatt/Exporte/' + ex[0]; console.log('Übertragungsdatei:', ex[0]);
  // 2) Cloud (Handy): Datei einlesen, zweimal
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await ctx2.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
  const cl = await ctx2.newPage(); cl.on('pageerror', e => errs.push('Cloud: ' + e.message));
  await cl.goto('http://localhost:8770/'); await cl.waitForSelector('#preview'); await cl.waitForTimeout(1200);
  await cl.setInputFiles('#file-json', syncFile); await cl.waitForTimeout(2500); console.log('Cloud 1. Abgleich:', await cl.textContent('#toast'));
  await cl.setInputFiles('#file-json', syncFile); await cl.waitForTimeout(2500); console.log('Cloud 2. Abgleich:', await cl.textContent('#toast'));
  console.log('Cloud-Bibliothek:', await cl.$$eval('.libitem b', e => e.map(x => x.textContent)));
  // 3) In der Cloud ändern, Datei zurück zum PC
  await cl.click('[data-tab="lib"]').catch(() => {}); await cl.click('.libitem >> text=Alte Testkarte'); await cl.waitForTimeout(800);
  await cl.fill('#in-name', 'Alte Testkarte (Handy)'); await cl.click('#btn-save'); await cl.waitForTimeout(600);
  const [d] = await Promise.all([cl.waitForEvent('download'), (async () => { await cl.click('[data-act="menu"]'); await cl.click('[data-act="backup"]'); })()]);
  await d.saveAs('/tmp/claude-0/chk/vomhandy.json');
  await pc.setInputFiles('#file-json', '/tmp/claude-0/chk/vomhandy.json'); await pc.waitForTimeout(2500);
  console.log('PC Abgleich:', await pc.textContent('#toast'));
  console.log('PC-Bibliothek:', await pc.$$eval('.libitem b', e => e.map(x => x.textContent)));
  console.log('Fehler:', errs.length ? errs : 'keine'); await b.close();
})();
