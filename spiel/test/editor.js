// Deck-Editor neu: König wählen, Karten hinzufügen (Klick und Ziehen), entfernen, Filter, speichern, Handy-Tabs
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h, n] of [[1366, 900, 'pc'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(2500);
    await pg.click('[data-go="decks"]'); await pg.click('#newdeck'); await pg.waitForTimeout(300);
    await pg.screenshot({ path: OUT + n + '-ed-leer.png' });
    if (n === 'phone') { await pg.click('[data-kingpick]'); await pg.waitForTimeout(300); } else await pg.click('#eftype [data-ft="king"]');
    await pg.click('#ed-pool .ptile .cimg >> nth=0'); await pg.waitForTimeout(200);
    await pg.click('#eftype [data-ft=""]');
    for (let i = 0; i < 14; i++) await pg.click('#ed-pool .ptile:not(.full) .cimg >> nth=' + (i % 6 + 1));
    await pg.click('#ecost [data-ecost="3"]'); await pg.waitForTimeout(200);
    const c3 = await pg.$$eval('#ed-pool .ptile', e => e.length);
    await pg.click('#ecost [data-ecost=""]');
    if (n === 'pc') {
      const before = await pg.textContent('#ed-count');
      await pg.locator('#ed-pool .ptile:not(.full)').nth(8).dragTo(pg.locator('#deckpane')); await pg.waitForTimeout(200);
      console.log('Ziehen:', before, '→', await pg.textContent('#ed-count'));
    } else { await pg.click('[data-etab="deck"]'); await pg.waitForTimeout(200); }
    const st = await pg.evaluate(() => [document.querySelector('#ed-count').textContent, document.querySelectorAll('#ed-list .dcard').length]);
    console.log(n, 'nach Hinzufügen:', st, '| Energie-3-Filter:', c3);
    await pg.screenshot({ path: OUT + n + '-ed-deck.png' });
    await pg.click('#ed-list .dcard .cimg >> nth=0'); await pg.waitForTimeout(200);
    console.log(n, 'nach Entfernen:', await pg.textContent('#ed-count'));
    await pg.click('#autofill'); await pg.waitForTimeout(300); console.log(n, 'aufgefüllt:', await pg.textContent('#ed-count'));
    await pg.click('#ed-list .dcard .zoombtn >> nth=0'); await pg.waitForTimeout(800);
    await pg.screenshot({ path: OUT + n + '-ed-insp.png' });
    console.log(n, 'Großansicht im Editor:', await pg.$$eval('.insp-acts button', e => e.map(x => x.textContent)));
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
    if (n === 'pc') { await pg.click('#ed-aibtn'); await pg.waitForTimeout(300); console.log('Deck-KI offen:', await pg.evaluate(() => document.querySelector('#aibox').open)); }
    await pg.fill('#deckname', 'Editor-Test ' + n); await pg.click('#ed-save'); await pg.waitForTimeout(400);
    console.log(n, 'gespeichert:', (await pg.textContent('#deckgrid')).includes('Editor-Test ' + n));
    await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
