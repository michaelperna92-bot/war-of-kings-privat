// „Du bist dran“ (31.10.2026): Einblendung bei jedem eigenen Zug, Leuchten solange man dran ist, Handy-Ansicht.
const { chromium } = require('playwright');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { window.__calls = []; new MutationObserver(() => { const t = document.querySelector('.turncall'); if (t && !t.__seen) { t.__seen = 1; window.__calls.push({ kind: t.className, t: performance.now(), text: t.textContent }); } }).observe(document, { subtree: true, childList: true }); navigator.vibrate = p => { window.__vib = (window.__vib || 0) + 1; return true; }; });
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  await pg.tap('[data-hplay="ai"]'); await pg.tap('#start'); await require('./mull.js')(pg);
  // eigener Zug abwarten
  for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
  await pg.waitForTimeout(400);
  let c = await pg.evaluate(() => window.__calls.length); ok(c >= 1, 'Einblendung beim ersten eigenen Zug: ' + JSON.stringify(await pg.evaluate(() => window.__calls)));
  ok(await pg.evaluate(() => document.getElementById('v-game').classList.contains('myturn')), 'Leuchten aktiv, solange du dran bist');
  ok(/DEIN ZUG/.test(await pg.textContent('#turnwho')), 'Anzeige „DEIN ZUG“: ' + await pg.textContent('#turnwho'));
  ok(await pg.evaluate(() => window.__vib >= 1), 'Vibration ausgelöst (wo verfügbar)');
  await pg.waitForTimeout(1500); await pg.screenshot({ path: '/tmp/claude-0/wokui/zug-handy.png' });
  // Zug beenden → Gegner → wieder ich
  for (let k = 0; k < 8; k++) { const st = await pg.evaluate(() => ({ a: WOK_APP.game.s.active, ph: WOK_APP.game.s.phase })); if (st.a !== 0) break; await pg.evaluate(() => { const d = document.querySelector('#ov:not([hidden]) #dlg [data-act="go"],#ov:not([hidden]) #dlg [data-act="yes"]'); if (d) d.click(); }); await pg.tap('#mainbtn').catch(() => {}); await pg.waitForTimeout(500); await pg.evaluate(() => { const d = document.querySelector('#ov:not([hidden]) #dlg [data-act="go"],#ov:not([hidden]) #dlg [data-act="yes"]'); if (d) d.click(); }); }
  ok(!(await pg.evaluate(() => document.getElementById('v-game').classList.contains('myturn'))) || await pg.evaluate(() => WOK_APP.game.s.active === 0), 'im Gegnerzug kein Leuchten');
  const before = await pg.evaluate(() => window.__calls.length);
  for (let i = 0; i < 120; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && ['summon1', 'prep'].includes(WOK_APP.game.s.phase))) break; await pg.waitForTimeout(300); }
  await pg.waitForTimeout(600);
  ok(await pg.evaluate(() => window.__calls.length) > before, 'Einblendung beim nächsten eigenen Zug wieder');
  ok(await pg.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'Spielfeld im Blick');
  console.log('Fehler:', errs); if (errs.length) failN++;
  console.log('Zug-Einblendung: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN ? 1 : 0);
})();
