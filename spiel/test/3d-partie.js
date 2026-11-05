// 4.12: Ganze Partie in der 3D-Bühne (PC 1920×1080): Seite 0 spielt über WOK_AI.decide + WOK_APP.dispatch, Seite 1 ist die normale KI.
// Prüft: keine Seitenfehler, kein Eintrag im Fehlerprotokoll, 3D bleibt aktiv, Einheiten im 3D = Einheiten im Spiel, Partie läuft weiter.
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html?3d=1&low3d=1'); await pg.waitForTimeout(500); await pg.evaluate(() => localStorage.removeItem('wok-spiel-fehler'));
  await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await require('./mull.js')(pg);
  let bad = 0, maxUnits = 0, mism = 0; const t0 = Date.now(); const memo = {};
  while (Date.now() - t0 < 240000) {
    const st = await pg.evaluate(() => { const s = WOK_APP.game.s; return { a: s.active, ph: s.phase, c: s.counter, res: !!s.result, turn: s.turn, n: Object.keys(s.units).length, n3: WOK_BOARD3D._dbg() ? WOK_BOARD3D._dbg().units.size : -1, on: WOK_BOARD3D.active(), dlg: !document.getElementById('ov').hidden }; });
    if (st.res) break; maxUnits = Math.max(maxUnits, st.n); if (!st.on) { console.log('FEHLER 3D aus'); bad++; break; }
    if (st.dlg) { await pg.evaluate(() => { const d = document.querySelector('#dlg [data-act="go"],#dlg [data-act="yes"],#dlg [data-act="keep"],#dlg [data-act="close"],#dlg [data-act^="d:"],#dlg button'); if (d) d.click(); }); await pg.waitForTimeout(250); continue; }
    const mine = (st.a === 0 && st.ph !== 'counter') || (st.ph === 'counter' && st.c === 0);
    if (mine) { const ok = await pg.evaluate(() => { const s = WOK_APP.game.s, p = s.phase === 'counter' ? s.counter : s.active; window.__m = window.__m || {}; let a = null; try { a = WOK_AI.decide(s, p, 'mittel', __m); } catch (e) { return 'KI: ' + e.message; } WOK_APP.dispatch(a || { type: 'endPhase' }); return 'ok'; }); if (ok !== 'ok') { console.log('FEHLER', ok); bad++; } await pg.waitForTimeout(450); }
    else await pg.waitForTimeout(400);
    if (st.n !== st.n3 && st.n3 >= 0) { await pg.waitForTimeout(1200); const again = await pg.evaluate(() => Object.keys(WOK_APP.game.s.units).length === WOK_BOARD3D._dbg().units.size); if (!again) mism++; }
  }
  const fin = await pg.evaluate(() => ({ turn: WOK_APP.game.s.turn, res: WOK_APP.game.s.result, log: JSON.parse(localStorage.getItem('wok-spiel-fehler') || '[]') }));
  await pg.screenshot({ path: '/tmp/claude-0/wokui/3d-partie.png' });
  console.log('Züge', fin.turn, 'Ergebnis', fin.res ? JSON.stringify(fin.res).slice(0, 80) : 'noch offen (Zeitlimit)', 'max. Einheiten', maxUnits, '3D≠Spiel', mism);
  if (fin.log.length) { console.log('FEHLER Fehlerprotokoll:', fin.log.map(e => e.kind + ': ' + e.msg).join(' | ').slice(0, 600)); bad++; }
  if (errs.length) { console.log('FEHLER Seitenfehler:', errs.join(' | ').slice(0, 600)); bad++; }
  if (mism) bad++; if (fin.turn < 6) { console.log('FEHLER Partie kam nicht voran'); bad++; }
  await b.close(); console.log(bad ? 'FEHLER 3D-Partie' : 'OK 3D-Partie'); process.exit(bad ? 1 : 0); })();
