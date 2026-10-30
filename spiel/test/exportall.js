// „Alles als Datei“: Karten + Bilder + Decks aus einer Fassung in die Browser-Datei übernehmen; Medien in der Browser-Datei
const { chromium } = require('playwright'); const fs = require('fs');
const SH = '/tmp/claude-0/sf/shots/', pick = k => SH + fs.readdirSync(SH).filter(f => new RegExp('^WoK_' + k + '_.*\\.zip$').test(f)).sort().pop();
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(700); await pg.click('[data-go="decks"]'); await pg.click('[data-dtab="cards"]');
  await pg.setInputFiles('#imp', [pick('Starter'), pick('Packs')]); await pg.waitForTimeout(2500);
  await pg.click('[data-dtab="decks"]'); await pg.click('#newdeck'); await pg.fill('#deckname', 'Mein Testdeck'); await pg.click('#autofill'); await pg.click('#ed-save'); await pg.waitForTimeout(500);
  await pg.click('[data-dtab="cards"]');
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 30000 }), pg.click('#exportall')]);
  const file = SH + dl.suggestedFilename(); await dl.saveAs(file); console.log('Datei:', dl.suggestedFilename(), (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
  // Browser-Datei öffnen und einlesen
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 860 } }); await ctx2.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p2 = await ctx2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.goto('file://' + require('path').join(__dirname, '..') + '/dist/WoK-Probe-Spiel-Browser.html'); await p2.waitForTimeout(1500);
  console.log('Medien eingebettet:', await p2.evaluate(() => [String(WOK_MENU.video).slice(0, 15), (WOK_MUSIC || []).length, String((WOK_MUSIC || [])[0]).slice(0, 16)]));
  await p2.click('[data-go="decks"]'); await p2.click('[data-dtab="cards"]'); await p2.setInputFiles('#imp', file); await p2.waitForTimeout(3000);
  console.log('Toast:', await p2.textContent('#toast'));
  console.log('Karten:', await p2.evaluate(() => [...document.querySelectorAll('#pool .ctile b')].map(x => x.textContent.trim()).join(', ')));
  console.log('Bilder:', await p2.evaluate(() => [...document.querySelectorAll('#pool .ctile img')].length));
  await p2.click('[data-dtab="decks"]'); await p2.waitForTimeout(300);
  console.log('Decks:', await p2.evaluate(() => [...document.querySelectorAll('.dtile .dname b')].map(x => x.textContent).join(', ')));
  await p2.screenshot({ path: SH + 'exportall.png' });
  console.log('Fehler:', errs, e2); await b.close(); })();
