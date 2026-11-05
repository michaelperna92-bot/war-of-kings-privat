// 1.11.2026 (Entwickler): Ohne Energie laufen die eigenen Phasen ganz normal weiter (keine Abkürzung „Zug beenden“).
// Übersprungen wird nur die Konterphase, wenn nichts möglich ist – siehe test/konter-skip.js.
const { chromium } = require('playwright');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500); await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await require('./mull.js')(pg);
  for (let i = 0; i < 150; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const s = WOK_APP.game.s; WOK_APP.game.aiSide = 1; s.players[0].energy = 0; WOK_APP.renderNow(); });
  const go = async () => { await pg.click('#mainbtn'); await pg.waitForTimeout(300); const d = await pg.$('#ov:not([hidden]) #dlg [data-act="go"]'); if (d) { await d.click(); await pg.waitForTimeout(300); } };
  ok(/Weiter: Bewegung/.test(await pg.textContent('#mainbtn')), 'Energie 0 in der Beschwörung → normaler Knopf: ' + await pg.textContent('#mainbtn'));
  await go(); ok(await pg.evaluate(() => WOK_APP.game.s.phase === 'move' && WOK_APP.game.s.active === 0), 'weiter zur Bewegung (nicht Zugende)');
  await go(); ok(await pg.evaluate(() => WOK_APP.game.s.phase === 'battle' && WOK_APP.game.s.active === 0), 'weiter zur Battlephase');
  console.log('Seitenfehler:', errs); if (errs.length) failN++;
  console.log('Phasen ohne Energie: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN ? 1 : 0);
})();
