// PC-Ablauf: Spielpakete aus „Dokumente\War of Kings Spielpakete“, Demo verschwindet, Decks bauen, Deck speichern
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:47851/'); await pg.waitForTimeout(2500);
  console.log('Angebot 1:', await pg.isVisible('#ov') && await pg.textContent('#dlg h2'), '|', await pg.textContent('#dlg p').catch(() => ''));
  await pg.click('#dlg [data-act="load"]'); await pg.waitForTimeout(2500);
  let st = await pg.evaluate(() => ({ cards: Object.keys(WOK_APP.POOL.cards).length, demo: Object.keys(WOK_APP.POOL.cards).filter(i => i.startsWith('demo_')).length, decks: WOK_APP.POOL.decks.map(d => d.name + ':' + d.cards.length + ':' + d.origin) }));
  console.log('nach Laden:', JSON.stringify(st));
  await pg.waitForTimeout(6000);
  if (await pg.isVisible('#ov')) { console.log('Angebot 2:', await pg.textContent('#dlg p')); await pg.click('#dlg [data-act="load"]'); await pg.waitForTimeout(2500); }
  st = await pg.evaluate(() => ({ cards: Object.keys(WOK_APP.POOL.cards).length, demo: Object.keys(WOK_APP.POOL.cards).filter(i => i.startsWith('demo_')).length, decks: WOK_APP.POOL.decks.map(d => d.name + ':' + d.cards.length + ':' + d.origin), full: Object.keys(WOK_APP.POOL.full).length }));
  console.log('nach zweitem Paket:', JSON.stringify(st));
  console.log('Startseite:', (await pg.textContent('#decksum')).replace(/\s+/g, ' '));
  // eigenes Deck bauen
  await pg.click('[data-go="decks"]'); await pg.click('#newdeck'); await pg.fill('#deckname', 'Mein Testdeck'); await pg.click('#autofill'); await pg.waitForTimeout(300);
  console.log('Deckinfo:', (await pg.textContent('#deckinfo')).replace(/\s+/g, ' ').slice(0, 80));
  await pg.screenshot({ path: '/tmp/claude-0/wokui/decks2.png' });
  await pg.click('#exportdeck'); await pg.waitForTimeout(1500);
  console.log('Toast:', await pg.textContent('#toast'));
  // Spiel mit eigenem Deck gegen Beispiel-Deck
  await pg.click('[data-go="home"]'); await pg.selectOption('[data-deckpick="deckA"]', { label: 'Mein Testdeck' }); await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await require('./mull.js')(pg); await pg.waitForTimeout(800);
  console.log('Partie:', await pg.evaluate(() => WOK_APP.game.s.players.map(p => p.name + '/' + p.deckName + '/' + p.deck.length)));
  console.log(errs);
  await b.close();
})();
