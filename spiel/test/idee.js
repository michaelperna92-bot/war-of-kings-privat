// „Idee übernehmen“ (31.10.2026; seit 5.11.2026 nur über den 💡-Knopf, nie von selbst): Spielhilfe zeigt einen Vorschlag; erst „Bestätigen“ führt aus, „Abbrechen“ nimmt alles zurück.
const { chromium } = require('playwright');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  await pg.tap('[data-hplay="ai"]'); await pg.tap('#start'); await require('./mull.js')(pg);
  const S = () => pg.evaluate(() => ({ a: WOK_APP.game.s.active, ph: WOK_APP.game.s.phase, n: WOK_APP.game.rec.acts.length, units: Object.keys(WOK_APP.game.s.units).length, hand: WOK_APP.game.s.players[0].hand.length, decl: Object.keys(WOK_APP.game.s.decl || {}).length, pos: Object.values(WOK_APP.game.s.units).map(u => u.pos).sort().join(), idea: !!WOK_APP.game.idea }));
  const dlgOpen = () => pg.evaluate(() => !document.getElementById('ov').hidden);
  // eigene Beschwörungsphase mit Vorschlag suchen (mehrere Züge, falls in einem Zug nichts zu tun ist)
  let found = false;
  for (let turn = 0; turn < 6 && !found; turn++) {
    for (let i = 0; i < 150; i++) { const st = await S(); if (st.a === 0 && st.ph === 'summon1') break; await pg.evaluate(() => { const s = WOK_APP.game.s; if (s.phase === 'counter' && s.counter === 0) { document.getElementById('ov').hidden = true; WOK_APP.dispatch({ type: 'pass', p: 0 }); } }); await pg.waitForTimeout(300); }
    await pg.waitForTimeout(1600);
    if (await dlgOpen()) { console.log('offenes Fenster:', (await pg.textContent('#dlg')).slice(0, 120)); if (await pg.$('#dlg [data-act="idea"]')) { found = true; break; } await pg.evaluate(() => { const d = document.querySelector('#dlg [data-act="close"],#dlg [data-act="ok"]') || document.querySelector('#dlg [data-act]'); if (d) d.click(); }); await pg.waitForTimeout(300); } /* z. B. Handlimit: eine Karte ablegen */
    await pg.evaluate(() => { const t = document.getElementById('tips'); if (t && !t.hidden) t.click(); }); await pg.waitForTimeout(300);
    if (await pg.$('#dlg [data-act="idea"]')) { found = true; break; }
    // kein Vorschlag → weiter bis zum Zugende
    for (let k = 0; k < 10; k++) { const st = await S(); if (st.a !== 0) break; await pg.evaluate(() => { const d = document.querySelector('#ov:not([hidden]) #dlg [data-act="go"],#ov:not([hidden]) #dlg [data-act="yes"]'); if (d) d.click(); }); await pg.tap('#mainbtn').catch(() => {}); await pg.waitForTimeout(400); }
  }
  ok(found, 'Spielhilfe bietet „Idee übernehmen“ an');
  if (found) {
    const txt = await pg.textContent('#dlg');
    ok(/Selbst machen/.test(txt), '„Selbst machen“ vorhanden (Spielhilfe nur auf Wunsch)'); ok(await pg.$('#dlg .dlg-x'), '✕ vorhanden');
    // ✕ schließt, nichts passiert
    const s0 = await S(); await pg.tap('#dlg .dlg-x'); await pg.waitForTimeout(200);
    ok(!(await dlgOpen()), '✕ schließt das Fenster'); let s1 = await S(); ok(s1.n === s0.n && s1.ph === s0.ph, '✕ führt nichts aus');
    // daneben tippen schließt
    await pg.evaluate(() => { const t = document.getElementById('tips'); if (t && !t.hidden) t.click(); }); await pg.waitForTimeout(300); await pg.mouse.click(5, 5); await pg.waitForTimeout(200); ok(!(await dlgOpen()), 'daneben tippen schließt');
    // Idee übernehmen → Vorschau
    await pg.evaluate(() => { const t = document.getElementById('tips'); if (t && !t.hidden) t.click(); }); await pg.waitForTimeout(300); await pg.tap('#dlg [data-act="idea"]'); await pg.waitForTimeout(400);
    s1 = await S(); ok(s1.idea, 'Vorschau aktiv'); ok(s1.n === s0.n, 'Vorschau führt noch nichts aus (Züge ' + s0.n + '→' + s1.n + ')');
    ok(s1.units !== s0.units || s1.hand !== s0.hand || s1.decl !== s0.decl || s1.pos !== s0.pos, 'Vorschau zeigt den Vorschlag auf dem Feld (Phase ' + s0.ph + ')');
    ok(await pg.isVisible('#ideabar'), 'Vorschlagsleiste sichtbar'); ok(/Bestätigen/.test(await pg.textContent('#ideabar')), 'Bestätigen-Knopf');
    await pg.screenshot({ path: '/tmp/claude-0/wokui/idee-vorschau.png' });
    // Eingaben gesperrt
    await pg.tap('#mainbtn'); await pg.waitForTimeout(200); { const q = await S(); ok(q.ph === s0.ph && q.n === s0.n && q.idea, 'Hauptknopf während Vorschau gesperrt'); }
    // Abbrechen
    await pg.tap('#ideabar [data-idea="no"]'); await pg.waitForTimeout(300);
    let s2 = await S(); ok(!s2.idea && s2.n === s0.n && s2.units === s0.units && s2.hand === s0.hand && s2.decl === s0.decl && s2.pos === s0.pos, 'Abbrechen stellt alles wieder her');
    ok(!(await pg.isVisible('#ideabar')), 'Leiste nach Abbrechen weg');
    // Bestätigen
    await pg.evaluate(() => { const t = document.getElementById('tips'); if (t && !t.hidden) t.click(); }); await pg.waitForTimeout(300); await pg.tap('#dlg [data-act="idea"]'); await pg.waitForTimeout(300);
    const plan = await pg.evaluate(() => WOK_APP.game.idea.plan.length);
    await pg.tap('#ideabar [data-idea="ok"]'); await pg.waitForTimeout(500);
    const s3 = await S(); ok(!s3.idea && s3.n === s0.n + plan, 'Bestätigen führt den Plan aus (' + plan + ' Aktionen, Züge ' + s0.n + '→' + s3.n + ')');
    ok(s3.ph === s0.ph && s3.a === 0, 'Phase bleibt – Spieler entscheidet selbst weiter');
    // Nein, weiter → nächste Phase
    await pg.tap('#mainbtn'); await pg.waitForTimeout(400);
    ok(!(await dlgOpen()), 'Weiter-Knopf öffnet KEINE Spielhilfe mehr'); ok((await S()).ph !== s0.ph, 'Weiter geht direkt zur nächsten Phase');
    // Kampfphase: Vorschlag mit Angriffen probieren
    for (let i = 0; i < 6; i++) { const st = await S(); if (st.ph === 'battle' || st.a !== 0) break; await pg.tap('#mainbtn'); await pg.waitForTimeout(300); if (await dlgOpen() && await pg.$('#dlg [data-act="go"]')) await pg.tap('#dlg [data-act="go"]'); await pg.waitForTimeout(300); }
  }
  // ganze Partie mit „Idee übernehmen“ ohne Fehler: jede eigene Phase den Vorschlag bestätigen
  let used = 0, ended = false;
  for (let step = 0; step < 3000; step++) {
    const st = await pg.evaluate(() => ({ r: !!WOK_APP.game.s.result, a: WOK_APP.game.s.active, ph: WOK_APP.game.s.phase, c: WOK_APP.game.s.counter, my: document.getElementById('v-game').classList.contains('myturn') || document.getElementById('v-game').classList.contains('mycounter') }));
    if (st.r) { ended = true; console.log('Partie beendet nach Schritt', step); break; }
    if (step % 300 === 0) console.log('Schritt', step, JSON.stringify(st), 'Fenster:', await dlgOpen(), (await pg.$('#dlg [data-act="idea"]')) ? 'MIT IDEE' : 'ohne', (await pg.textContent('#dlg')).slice(0, 200));
    if (!st.my) { await pg.waitForTimeout(250); continue; }
    if (await dlgOpen()) { if (await pg.$('#dlg [data-act="idea"]')) { await pg.tap('#dlg [data-act="idea"]'); await pg.waitForTimeout(150); if (await pg.isVisible('#ideabar')) { await pg.tap('#ideabar [data-idea="ok"]'); used++; } } else { await pg.evaluate(() => { const d = ['go', 'yes', 'ok', 'close'].map(a => document.querySelector('#dlg [data-act="' + a + '"]')).find(Boolean) || document.querySelector('#dlg [data-act]'); if (d) d.click(); /* auch Handlimit: eine Karte ablegen */ }); } await pg.waitForTimeout(250); continue; }
    { const tb = await pg.evaluate(() => { const t = document.getElementById('tips'); return !!(t && !t.hidden); }); if (tb && step % 2 === 0) { await pg.evaluate(() => document.getElementById('tips').click()); await pg.waitForTimeout(200); if (await dlgOpen()) continue; } }
    await pg.tap('#mainbtn').catch(() => {}); await pg.waitForTimeout(250);
    if (false) { await pg.screenshot({ path: '/tmp/claude-0/wokui/idee-haengt.png' }); console.log('mainbtn:', await pg.evaluate(() => { const b = document.getElementById('mainbtn'); const r = b.getBoundingClientRect(); return b.textContent + ' disabled=' + b.disabled + ' vis=' + (r.width > 0) + ' ' + JSON.stringify(r); }), await pg.evaluate(() => WOK_APP.game.rec.acts.slice(-4).map(a => JSON.stringify(a)).join(' ; '))); }
    
  }
  ok(used >= 2 && ended, 'Vorschläge in der Partie mehrfach übernommen: ' + used);
  console.log('Fehler:', errs); if (errs.length) failN++;
  console.log('Idee übernehmen: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN ? 1 : 0);
})();
