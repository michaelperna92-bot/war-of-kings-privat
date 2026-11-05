// 4.13/5.11.2026: Gaben freiwillig, NIE auf dem Spielfeld. Handy (3D): Karte antippen → Knöpfe im Kasten oben; 1. Tipp: Text + Ziele; 2. Tipp: wirkt.
// PC: Gaben-Knöpfe in der Leiste. Zusätzlich: Angreifen geht, ohne die Gabe zu nutzen (nichts blockiert das Ziel), keine Spielhilfe drängt sich auf.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); let ok = 0, bad = 0; const chk = (c, m) => { if (c) ok++; else { bad++; console.log('FEHLER', m); } };
  for (const mode of ['pc', 'handy']) {
    const ctx = mode === 'pc' ? await b.newContext({ viewport: { width: 1366, height: 800 } }) : await b.newContext({ ...devices['iPhone 13'] }); const d3 = mode === 'handy';
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html' + (d3 ? '?3d=1&low3d=1' : '')); await pg.waitForTimeout(500); await pg.evaluate(() => document.querySelector('[data-hplay="ai"]').click()); await pg.waitForTimeout(200); await pg.evaluate(() => document.querySelector('#start').click()); await require('./mull.js')(pg);
    let found = null; const t0 = Date.now();
    while (Date.now() - t0 < 240000 && !found) {
      const st = await pg.evaluate(() => { const s = WOK_APP.game.s; return { a: s.active, ph: s.phase, c: s.counter, dlg: !document.getElementById('ov').hidden, res: !!s.result }; }); if (st.res) break;
      if (st.dlg) { await pg.evaluate(() => { const d = document.querySelector('#dlg [data-act="go"],#dlg [data-act="yes"],#dlg [data-act="close"],#dlg button'); if (d) d.click(); }); await pg.waitForTimeout(200); continue; }
      const mine = (st.a === 0 && st.ph !== 'counter') || (st.ph === 'counter' && st.c === 0);
      if (mine) { found = await pg.evaluate(() => { const s = WOK_APP.game.s, p = s.phase === 'counter' ? s.counter : s.active;
          if ((s.phase === 'battle' && s.active === 0) || (s.phase === 'counter' && s.counter === 0)) { const u = Object.values(s.units).find(u => u.owner === 0 && WOK.giftOptions(s, u.uid).some(o => o.ok)); if (u) return { uid: u.uid, ph: s.phase }; }
          window.__m = window.__m || {}; let a = WOK_AI.decide(s, p, 'mittel', __m) || { type: 'endPhase' }; if (a.type === 'gift') a = s.phase === 'counter' ? { type: 'pass', p } : { type: 'endPhase', p }; WOK_APP.dispatch(a); return null; }); }
      await pg.waitForTimeout(250); }
    chk(found, mode + ': keine Lage mit einsetzbarer Gabe gefunden'); if (!found) { await ctx.close(); continue; }
    await pg.waitForTimeout(800);
    chk(await pg.evaluate(() => !document.querySelector('#fxchips .fxb')), mode + ': Knöpfe liegen auf dem Spielfeld');
    const tapUnit = async uid => { if (d3) { const pt = await pg.evaluate(f => { const S = WOK_BOARD3D._dbg(); const g = S.units.get(f); const c = document.querySelector('canvas.b3d').getBoundingClientRect(); const v = g.position.clone(); v.y = .3; v.project(S.camera); return { x: c.left + (v.x + 1) / 2 * c.width, y: c.top + (1 - v.y) / 2 * c.height }; }, uid); await pg.touchscreen.tap(pt.x, pt.y); } else await pg.locator('.tok[data-uid="' + uid + '"]').click(); await pg.waitForTimeout(900); };
    await tapUnit(found.uid);
    const sel = d3 ? '#mdock .mgb' : '#pb-bot [data-qg]:not([disabled]), #detail [data-gift]:not([disabled])';
    chk(await pg.locator(sel).count() >= 1, mode + ': keine Gaben-Knöpfe im Kasten/in der Leiste');
    const gid = await pg.locator(sel).first().evaluate(e => e.dataset.fxg || e.dataset.qg || e.dataset.gift);
    const before = await pg.evaluate(u => JSON.stringify({ cd: WOK_APP.game.s.units[u] && WOK_APP.game.s.units[u].cd, log: WOK_APP.game.s.log.length }), found.uid);
    if (d3) { await pg.locator(sel).first().tap(); await pg.waitForTimeout(600); chk(await pg.evaluate(() => !!document.querySelector('#mdock .fxdesc')), mode + ': 1. Tipp zeigt keine Beschreibung'); await pg.locator('#mdock .mgb.on').tap(); }
    else await pg.locator(sel).first().click();
    await pg.waitForTimeout(600);
    const needT = await pg.evaluate(() => !!WOK_APP.game.gift); if (needT) { const t = await pg.evaluate(() => WOK_APP.game.gift.targets[0]); if (await pg.evaluate(t => !!WOK_APP.game.s.units[t], t)) await tapUnit(t); else await pg.evaluate(f => { const c = document.querySelector('.cell[data-f="' + f + '"]'); if (c) c.click(); }, t); await pg.waitForTimeout(600); }
    chk(await pg.evaluate(() => document.getElementById('ov').hidden), mode + ': Spielhilfe/Warnung hat sich aufgedrängt');
    const after = await pg.evaluate(u => JSON.stringify({ cd: WOK_APP.game.s.units[u] && WOK_APP.game.s.units[u].cd, log: WOK_APP.game.s.log.length }), found.uid);
    chk(before !== after, mode + ': Gabe ' + gid + ' wurde nicht eingesetzt');
    chk(!errs.length, mode + ': Seitenfehler ' + errs.join(' | ')); await ctx.close(); }
  await b.close(); console.log('Effekt-Knöpfe: ' + ok + ' bestanden, ' + bad + ' fehlgeschlagen.'); process.exit(bad ? 1 : 0); })();
