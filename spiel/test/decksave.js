// Speichern führt immer zur Deck-Übersicht, Name wird abgefragt, Übersicht sortiert, Mehr-Menü
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(600);
  // vom Hauptmenü aus bearbeiten → speichern → Übersicht
  await pg.click('[data-hplay="ai"]'); await pg.waitForTimeout(300); await pg.click('#editdeck'); await pg.waitForTimeout(400);
  await pg.click('#ed-save'); await pg.waitForTimeout(500);
  console.log('nach Speichern sichtbar: Decks', await pg.isVisible('#dv-decks'), '| Home', await pg.isVisible('#v-home'));
  // neues Deck mit Standardname → Namensabfrage
  await pg.click('#newdeck'); await pg.waitForTimeout(300); await pg.click('#autofill'); await pg.click('#ed-save'); await pg.waitForTimeout(300);
  console.log('Namensabfrage:', await pg.isVisible('#sv-name'));
  await pg.fill('#sv-name', 'Sturmflut'); await pg.press('#sv-name', 'Enter'); await pg.waitForTimeout(500);
  console.log('Übersicht:', await pg.evaluate(() => [...document.querySelectorAll('.dsec')].map(h => h.textContent).join(' | ')), '|', await pg.evaluate(() => [...document.querySelectorAll('.dtile .dname b')].map(x => x.textContent).join(', ')), '| frisch:', await pg.evaluate(() => (document.querySelector('.dtile.fresh .dname b') || {}).textContent));
  // gleicher Name nochmal → eindeutig
  await pg.click('#newdeck'); await pg.waitForTimeout(300); await pg.fill('#deckname', 'Sturmflut'); await pg.click('#autofill'); await pg.click('#ed-save'); await pg.waitForTimeout(500);
  console.log('doppelter Name:', await pg.evaluate(() => [...document.querySelectorAll('.dtile .dname b')].map(x => x.textContent).join(', ')));
  // Name antippen → umbenennen
  await pg.click('.dtile:has-text("Sturmflut (2)") .dname'); await pg.fill('#rn-name', 'Ebbe'); await pg.click('#dlg [data-act="ok"]'); await pg.waitForTimeout(300);
  // Sortieren A–Z
  await pg.selectOption('#decksort', 'name'); await pg.waitForTimeout(200);
  console.log('A–Z:', await pg.evaluate(() => [...document.querySelectorAll('.dtile .dname b')].map(x => x.textContent).join(', ')));
  // Mehr-Menü → Kopieren
  await pg.click('.dtile:has-text("Ebbe") [data-more]'); await pg.waitForTimeout(200); await pg.click('#dlg [data-act="copy"]'); await pg.waitForTimeout(400);
  console.log('nach Kopie:', await pg.evaluate(() => [...document.querySelectorAll('.dtile .dname b')].map(x => x.textContent).join(', ')));
  // Papierkorb
  await pg.click('.dtile:has-text("Ebbe (Kopie)") [data-del]'); await pg.click('#dlg [data-act="yes"]'); await pg.waitForTimeout(300);
  console.log('nach Löschen:', await pg.evaluate(() => [...document.querySelectorAll('.dtile .dname b')].map(x => x.textContent).join(', ')));
  console.log('Fehler:', errs); await b.close(); })();
