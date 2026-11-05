// Stabilität (31.10.2026): Eine fehlerhafte KI-Entscheidung, eine kaputte Einblendung oder ein Zeichenfehler darf die Partie nie dauerhaft blockieren.
const { chromium } = require('playwright');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500); await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await require('./mull.js')(pg);
  for (let i = 0; i < 100; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
  // 1) KI wirft Ausnahmen → Ersatzaktion, Partie läuft weiter
  await pg.evaluate(() => { window.__orig = WOK_AI.decide; window.__n = 0; WOK_AI.decide = function () { if (window.__n++ < 3) throw new Error('Testfehler in der KI'); return window.__orig.apply(this, arguments); }; });
  for (let k = 0; k < 6; k++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 1)) break; await pg.evaluate(() => { const d = ['go', 'yes'].map(a => document.querySelector('#ov:not([hidden]) #dlg [data-act="' + a + '"]')).find(Boolean); if (d) d.click(); }); await pg.click('#mainbtn').catch(() => {}); await pg.waitForTimeout(400); }
  let back = false; for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && !WOK_APP.game.s.result)) { back = true; break; } await pg.waitForTimeout(300); }
  ok(back, 'trotz KI-Ausnahmen kommt der Zug zurück zum Spieler');
  const log = await pg.evaluate(() => JSON.parse(localStorage.getItem('wok-spiel-fehler') || '[]'));
  ok(log.some(e => e.kind === 'KI') && log.some(e => e.kind === 'KI-Ersatzaktion'), 'Fehlerprotokoll enthält KI-Fehler und Ersatzaktion: ' + log.map(e => e.kind).join(', '));
  await pg.evaluate(() => { WOK_AI.decide = window.__orig; });
  // 2) KI-Timer verloren (z. B. nach einem Fehler beim Zeichnen) → Wächter stößt neu an
  for (let k = 0; k < 6; k++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 1)) break; await pg.evaluate(() => { const d = ['go', 'yes'].map(a => document.querySelector('#ov:not([hidden]) #dlg [data-act="' + a + '"]')).find(Boolean); if (d) d.click(); }); await pg.click('#mainbtn').catch(() => {}); await pg.waitForTimeout(400); }
  // 3) Menü zeigt das Protokoll
  for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0)) break; await pg.waitForTimeout(300); }
  await pg.evaluate(() => { document.getElementById('ov').hidden = true; }); await pg.evaluate(() => document.getElementById('mmenu').click()); await pg.waitForTimeout(200);
  await pg.click('#dlg [data-act="errlog"]'); await pg.waitForTimeout(200);
  ok(/Testfehler in der KI/.test(await pg.textContent('#dlg')), 'Menü → Fehlerprotokoll zeigt den Eintrag');
  console.log('Wächter: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN ? 1 : 0);
})();
