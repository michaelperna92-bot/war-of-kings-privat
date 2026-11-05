// 4.12: Handy mit 3D-Feld (Fingertipps): Handkarte antippen → goldenes Feld im 3D antippen → beschwört; im nächsten Zug Held antippen → Feld antippen → läuft.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); let ok = 0, bad = 0;
  const chk = (c, m) => { if (c) ok++; else { bad++; console.log('FEHLER', m); } };
  for (const dev of ['iPhone 13', 'Pixel 7']) {
    const pg = await (await b.newContext({ ...devices[dev] })).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html?3d=1&low3d=1'); await pg.waitForTimeout(500); await pg.tap('[data-hplay="ai"]'); await pg.tap('#start'); await require('./mull.js')(pg);
    const myPhase = async ph => { for (let i = 0; i < 200; i++) { const st = await pg.evaluate(() => { const s = WOK_APP.game.s; return { a: s.active, ph: s.phase, c: s.counter, dlg: !document.getElementById('ov').hidden }; });
      if (st.a === 0 && st.ph === ph && !st.dlg) return true; if (st.dlg) await pg.evaluate(() => { const d = document.querySelector('#dlg [data-act="go"],#dlg [data-act="yes"],#dlg [data-act="close"],#dlg button'); if (d) d.click(); });
      else if (st.ph === 'counter' && st.c === 0) await pg.evaluate(() => WOK_APP.dispatch({ type: 'pass', p: 0 })); await pg.waitForTimeout(300); } return false; };
    const tapSlot = async slot => { const p = await pg.evaluate(sl => { const c = document.querySelector('canvas.b3d').getBoundingClientRect(); const q = WOK_BOARD3D.project(sl); return { x: c.left + (q.left + q.w / 2) / 100 * c.width, y: c.top + (q.top + q.h * .6) / 100 * c.height }; }, slot); await pg.touchscreen.tap(p.x, p.y); await pg.waitForTimeout(900); };
    chk(await myPhase('summon1'), dev + ': eigener Zug kommt nicht'); await pg.waitForTimeout(1200);
    chk(await pg.evaluate(() => WOK_BOARD3D.active()), dev + ': 3D nicht aktiv');
    // Karten-Info beim Antippen einer Feldkarte – auch wenn der Browser beim Klick keinen Zeigertyp meldet (Safari)
    for (const o of [1, 0]) { const ok2 = await pg.evaluate(own => { const s = WOK_APP.game.s; const u = Object.values(s.units).find(u => u.owner === own); const S = WOK_BOARD3D._dbg(); const g = S.units.get(u.uid); const c = document.querySelector('canvas.b3d'), rc = c.getBoundingClientRect(); const v = g.position.clone(); v.y = .3; v.project(S.camera);
        WOK_APP.game.info = null; c.dispatchEvent(new MouseEvent('click', { clientX: rc.left + (v.x + 1) / 2 * rc.width, clientY: rc.top + (1 - v.y) / 2 * rc.height, bubbles: true })); return u.uid; }, o); await pg.waitForTimeout(700);
      chk(await pg.evaluate(id => !!(WOK_APP.game.info && WOK_APP.game.info.uid === id) && !!document.querySelector('#mdock:not([hidden]) .pop-g'), ok2), dev + ': Karten-Info (Kasten oben) beim Antippen einer Feldkarte fehlt (' + (o ? 'Gegner' : 'eigene') + ')');
      await pg.evaluate(() => { WOK_APP.game.info = null; WOK_APP.renderNow(); }); }
    await pg.evaluate(() => { WOK_APP.game.s.players[0].energy = 20; WOK_APP.renderNow(); }); await pg.waitForTimeout(300);
    await pg.locator('#hand .hcard:not(.no):not(.sp)').first().tap(); await pg.waitForTimeout(500);
    await tapSlot('r5c3');
    chk(await pg.evaluate(() => Object.values(WOK_APP.game.s.units).some(u => u.owner === 0 && u.pos === 'C5')), dev + ': Beschwören per Fingertipp ging nicht');
    // Zug beenden, Gegner spielt, im nächsten Zug laufen
    for (let k = 0; k < 6; k++) { const a = await pg.evaluate(() => WOK_APP.game.s.active); if (a !== 0) break; await pg.evaluate(() => WOK_APP.dispatch({ type: 'endPhase', p: 0 })); await pg.waitForTimeout(500); await pg.evaluate(() => { const d = document.querySelector('#ov:not([hidden]) #dlg [data-act="go"],#ov:not([hidden]) #dlg [data-act="yes"]'); if (d) d.click(); }); }
    chk(await myPhase('summon1'), dev + ': zweiter Zug kommt nicht'); await pg.evaluate(() => WOK_APP.dispatch({ type: 'endPhase', p: 0 })); await pg.waitForTimeout(800);
    const u = await pg.evaluate(() => { const s = WOK_APP.game.s; const x = Object.values(s.units).find(u => u.owner === 0 && u.pos === 'C5'); if (!x) return null; const r = Object.keys(WOK.reachable(s, x.uid)); return { uid: x.uid, r }; });
    chk(u && u.r.length, dev + ': Held kann nicht laufen ' + JSON.stringify(u));
    if (u && u.r.length) { await tapSlot('r5c3'); await pg.waitForTimeout(300); const to = u.r[0], m = /^([A-G])(\d)$/.exec(to);
      await tapSlot('r' + m[2] + 'c' + ('ABCDEFG'.indexOf(m[1]) + 1));
      chk(await pg.evaluate(uid => WOK_APP.game.s.units[uid] && WOK_APP.game.s.units[uid].pos, u.uid) === to, dev + ': Laufen per Fingertipp ging nicht (Ziel ' + to + ')'); }
    chk(!errs.length, dev + ': Seitenfehler ' + errs.join(' | ')); await pg.context().close(); }
  await b.close(); console.log('3D-Handy: ' + ok + ' bestanden, ' + bad + ' fehlgeschlagen.'); process.exit(bad ? 1 : 0); })();
