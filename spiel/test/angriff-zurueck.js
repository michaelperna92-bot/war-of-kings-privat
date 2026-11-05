// 5.11.2026 (Entwickler): Angriff festlegen und wieder zurücknehmen – Ziel nochmal antippen, ✕ in der Angriffsliste, Angreifer abwählen.
// Basis: Angreifen mit einem Helden, der eine Gabe einsetzen KÖNNTE – nichts darf das Ziel blockieren.
// abgeleitet aus effekt-knoepfe.js. Alt: Gaben freiwillig, NIE auf dem Spielfeld. Handy (3D): Karte antippen → Knöpfe im Kasten oben; 1. Tipp: Text + Ziele; 2. Tipp: wirkt.
// PC: Gaben-Knöpfe in der Leiste. Zusätzlich: Angreifen geht, ohne die Gabe zu nutzen (nichts blockiert das Ziel), keine Spielhilfe drängt sich auf.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); let ok = 0, bad = 0; const chk = (c, m) => { if (c) ok++; else { bad++; console.log('FEHLER', m); } };
  for (const mode of ['handy', 'pc']) {
    const ctx = mode === 'pc' ? await b.newContext({ viewport: { width: 1366, height: 800 } }) : await b.newContext({ ...devices['iPhone 13'] }); const d3 = mode === 'handy';
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html' + (d3 ? '?3d=1&low3d=1' : '')); await pg.waitForTimeout(500); await pg.evaluate(() => document.querySelector('[data-hplay="ai"]').click()); await pg.waitForTimeout(200); await pg.evaluate(() => document.querySelector('#start').click()); await require('./mull.js')(pg);
    let found = null; const t0 = Date.now();
    while (Date.now() - t0 < 240000 && !found) {
      const st = await pg.evaluate(() => { const s = WOK_APP.game.s; return { a: s.active, ph: s.phase, c: s.counter, dlg: !document.getElementById('ov').hidden, res: !!s.result }; }); if (st.res) break;
      if (st.dlg) { await pg.evaluate(() => { const d = document.querySelector('#dlg [data-act="go"],#dlg [data-act="yes"],#dlg [data-act="close"],#dlg button'); if (d) d.click(); }); await pg.waitForTimeout(200); continue; }
      const mine = (st.a === 0 && st.ph !== 'counter') || (st.ph === 'counter' && st.c === 0);
      if (mine) { found = await pg.evaluate(() => { const s = WOK_APP.game.s, p = s.phase === 'counter' ? s.counter : s.active;
          if ((s.phase === 'battle' && s.active === 0) || (s.phase === 'counter' && s.counter === 0)) { const u = s.phase === 'battle' && Object.values(s.units).find(u => u.owner === 0 && WOK.attackTargets(s, u.uid).length && !s.decl[u.uid]); if (u) return { uid: u.uid, ph: s.phase, t: WOK.attackTargets(s, u.uid)[0] }; }
          window.__m = window.__m || {}; let a = WOK_AI.decide(s, p, 'mittel', __m) || { type: 'endPhase' }; if (a.type === 'gift') a = s.phase === 'counter' ? { type: 'pass', p } : { type: 'endPhase', p }; WOK_APP.dispatch(a); return null; }); }
      await pg.waitForTimeout(250); }
    chk(found, mode + ': keine Lage mit einsetzbarer Gabe gefunden'); if (!found) { await ctx.close(); continue; }
    await pg.waitForTimeout(800);
    chk(await pg.evaluate(() => !document.querySelector('#fxchips .fxb')), mode + ': Knöpfe liegen auf dem Spielfeld');
    const tapUnit = async uid => { if (d3) { const pt = await pg.evaluate(f => { const S = WOK_BOARD3D._dbg(); const g = S.units.get(f); const c = document.querySelector('canvas.b3d').getBoundingClientRect(); const v = g.position.clone(); v.y = .3; v.project(S.camera); return { x: c.left + (v.x + 1) / 2 * c.width, y: c.top + (1 - v.y) / 2 * c.height }; }, uid); await pg.touchscreen.tap(pt.x, pt.y); } else await pg.locator('.tok[data-uid="' + uid + '"]').click(); await pg.waitForTimeout(900); };
    await tapUnit(found.uid);
    const D = () => pg.evaluate(f => !!(WOK_APP.game.s.decl[f.uid] && WOK_APP.game.s.decl[f.uid].targets.includes(f.t)), found);
    await tapUnit(found.t); chk(await D(), mode + ': Angriff nicht festgelegt');
    await tapUnit(found.t); chk(!(await D()), mode + ': Ziel nochmal antippen nimmt den Angriff NICHT zurück');
    // erneut festlegen, dann über ✕ in der Angriffsliste zurücknehmen
    if (!(await pg.evaluate(f => WOK_APP.game.sel && WOK_APP.game.sel.uid === f.uid, found))) await tapUnit(found.uid);
    await tapUnit(found.t); chk(await D(), mode + ': Angriff (2) nicht festgelegt');
    const x = pg.locator(d3 ? '#mdock [data-undecl]' : '#atklist [data-undecl]').first(); chk(await x.isVisible(), mode + ': ✕ in der Angriffsliste nicht sichtbar');
    if (await x.isVisible()) { if (d3) await x.tap(); else await x.click(); await pg.waitForTimeout(600); chk(!(await D()), mode + ': ✕ nimmt den Angriff NICHT zurück'); }
    // Angreifer antippen und wieder abwählen
    if (!(await pg.evaluate(f => WOK_APP.game.sel && WOK_APP.game.sel.uid === f.uid, found))) await tapUnit(found.uid);
    await tapUnit(found.uid); chk(await pg.evaluate(() => !WOK_APP.game.sel), mode + ': Angreifer lässt sich nicht abwählen');
    chk(await pg.evaluate(() => document.getElementById('ov').hidden), mode + ': Fenster hat sich aufgedrängt');
    chk(!errs.length, mode + ': Seitenfehler ' + errs.join(' | ')); await ctx.close(); }
  await b.close(); console.log('Angriff zurücknehmen: ' + ok + ' bestanden, ' + bad + ' fehlgeschlagen.'); process.exit(bad ? 1 : 0); })();
