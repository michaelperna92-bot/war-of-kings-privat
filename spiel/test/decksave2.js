// Speichern über den Verlassen-Dialog, am Handy; jeder Weg muss speichern
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch();
  for (const [w, h, n] of [[1280, 900, 'pc'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(600); await pg.click('[data-go="decks"]'); await pg.waitForTimeout(200);
    const names = () => pg.evaluate(() => [...document.querySelectorAll('.dtile .dname b')].map(x => x.textContent).join(', '));
    // Weg 1: Neues Deck → auffüllen → „← Decks“ → „Speichern“ im Rückfrage-Dialog
    await pg.click('#newdeck'); await pg.waitForTimeout(300); await pg.click('#autofill'); await pg.click('#ed-back'); await pg.waitForTimeout(200);
    await pg.click('#dlg [data-act="save"]'); await pg.waitForTimeout(300);
    console.log(n, 'Namensfeld nach Verlassen-Dialog:', await pg.isVisible('#sv-name'));
    if (await pg.isVisible('#sv-name')) { await pg.fill('#sv-name', 'Weg Eins'); await pg.click('#dlg [data-act="ok"]'); await pg.waitForTimeout(400); }
    console.log(n, 'Decks:', await names());
    // Weg 2: „Deck speichern“ direkt, Namen behalten (Standardname)
    await pg.click('#newdeck'); await pg.waitForTimeout(300); await pg.click('#autofill'); await pg.click('#ed-save'); await pg.waitForTimeout(300);
    await pg.click('#dlg [data-act="ok"]'); await pg.waitForTimeout(400);
    console.log(n, 'Decks:', await names(), '| Übersicht:', await pg.isVisible('#dv-decks'));
    // Weg 3: leeres Deck speichern (nicht spielbereit) mit Namen
    await pg.click('#newdeck'); await pg.waitForTimeout(300); await pg.fill('#deckname', 'Entwurf'); await pg.click('#ed-save'); await pg.waitForTimeout(400);
    console.log(n, 'Decks:', await names());
    await pg.reload(); await pg.waitForTimeout(900); await pg.click('[data-go="decks"]'); await pg.waitForTimeout(300);
    console.log(n, 'nach Neuladen:', await names());
    console.log(n, 'Fehler:', errs); await pg.close(); }
  await b.close(); })();
