// Deckverwaltung: Deck bauen, speichern, auswählen, spielen; Bilder auf Spielfeld und im Detail
const { chromium } = require('playwright');
const URL0 = process.argv[2] || 'http://127.0.0.1:47851/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const vp = process.argv[3] === 'phone' ? { width: 390, height: 844 } : { width: 1366, height: 900 };
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL0); await pg.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { if (await pg.isVisible('#ov')) { await pg.click('#dlg [data-act="load"]'); await pg.waitForTimeout(3000); } await pg.waitForTimeout(5500); }
  await pg.click('[data-go="decks"]'); await pg.waitForTimeout(500);
  await pg.screenshot({ path: '/tmp/claude-0/wokui/dk-1-overview-' + vp.width + '.png', fullPage: true });
  await pg.click('#newdeck'); await pg.fill('#deckname', 'Meine Elite');
  // König und ein paar Karten per Klick, Rest auffüllen
  await pg.click('#eftype [data-ft="king"]'); await pg.click('#ed-pool [data-add]'); await pg.click('#eftype [data-ft=""]');
  for (let k = 2; k < 6; k++) await pg.locator('#ed-pool [data-add]').nth(k).click();
  await pg.screenshot({ path: '/tmp/claude-0/wokui/dk-2-edit-' + vp.width + '.png', fullPage: false });
  console.log('Zähler:', (await pg.textContent('#ed-count')).trim());
  await pg.click('#autofill'); console.log('Zähler:', (await pg.textContent('#ed-count')).trim());
  await pg.click('#ed-save'); await pg.waitForTimeout(500);
  console.log('Toast:', await pg.textContent('#toast'));
  const tiles = await pg.$$eval('.dtile .dinfo b', e => e.map(x => x.textContent)); console.log('Decks:', tiles);
  await pg.click('.dtile:has-text("Meine Elite") [data-play]'); await pg.waitForTimeout(300);
  console.log('Markierung:', await pg.textContent('.dtile.mine .playtag'));
  await pg.click('[data-go="home"]'); console.log('Start:', (await pg.textContent('#decksum')).replace(/\s+/g, ' ').slice(0, 160));
  await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await pg.waitForTimeout(1500);
  for (let i = 0; i < 80; i++) { const ok = await pg.evaluate(() => { const g = WOK_APP.game, s = g.s; if (s.active === 0 && !s.result && s.turn > 10) return true; if (s.active === 0) { const a = WOK_AI.decide(s, 0, 'mittel', g._m || (g._m = { seed: 4 })); if (a) WOK_APP.dispatch(a); } return false; }); if (ok) break; await pg.waitForTimeout(300); }
  const tok = await pg.evaluate(() => { const fs = [...document.querySelectorAll('.tok .face')]; return { tokens: fs.length, mitBild: fs.filter(f => /url\(/.test(f.style.backgroundImage)).length, deck: WOK_APP.game.s.players[0].deckName }; });
  console.log('Spielfeld:', JSON.stringify(tok));
  const t = await pg.$('.tok:not(.king):not(.foe)') || await pg.$('.tok:not(.king)'); if (t) { await t.click(); await pg.waitForTimeout(500); console.log('Detail:', await pg.evaluate(() => { const i = document.querySelector('#detail .fullcard img'); return i ? i.naturalWidth : 'kein Bild'; })); }
  await pg.screenshot({ path: '/tmp/claude-0/wokui/dk-3-game-' + vp.width + '.png' });
  console.log('Fehler:', errs); await b.close();
})();
