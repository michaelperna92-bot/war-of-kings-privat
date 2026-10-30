// Decks umbenennen, löschen (auch Demo), mehrere löschen; gelöschte Demo-Decks kommen nicht wieder
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500); await pg.click('[data-go="decks"]'); await pg.waitForTimeout(300);
  const names = () => pg.evaluate(() => [...document.querySelectorAll('.dtile .dinfo b')].map(x => x.textContent).join(' | '));
  console.log('vorher:', await names());
  const first = await pg.evaluate(() => document.querySelector('[data-rename]').dataset.rename);
  await pg.click('[data-rename="' + first + '"]'); await pg.fill('#rn-name', 'Mein Lieblingsdeck'); await pg.click('#dlg [data-act="ok"]'); await pg.waitForTimeout(300);
  console.log('umbenannt:', await names());
  await pg.click('#newdeck'); await pg.fill('#deckname', 'Wegwerf 1'); await pg.click('#ed-save'); await pg.waitForTimeout(300);
  await pg.click('#newdeck'); await pg.fill('#deckname', 'Wegwerf 2'); await pg.click('#ed-save'); await pg.waitForTimeout(300);
  await pg.click('#deckmulti'); await pg.waitForTimeout(200);
  for (const n of ['Wegwerf 1', 'Wegwerf 2', 'Demo B (Platzhalter)']) await pg.click('.dtile:has-text("' + n + '") .dpick');
  console.log('Auswahl:', await pg.textContent('#dpickbar b')); await pg.click('[data-dbulk="del"]'); await pg.click('#dlg [data-act="yes"]'); await pg.waitForTimeout(400);
  console.log('nach Löschen:', await names());
  await pg.reload(); await pg.waitForTimeout(900); await pg.click('[data-go="decks"]'); await pg.waitForTimeout(300);
  console.log('nach Neuladen:', await names());
  console.log('Fehler:', errs); await b.close(); })();
