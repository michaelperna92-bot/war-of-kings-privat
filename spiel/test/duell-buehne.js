// 4.12: PC/TV-Bühne (Master-Duel-Aufbau) – Bühne an am PC, aus am Handy; Hand als Fächer; Kartendetails links beim Drüberfahren;
// Beschwören per Handkarte + Klick ins 3D-Feld; Spielverlauf-Knopf; nichts ragt aus dem Bildschirm.
const { chromium, devices } = require('playwright');
(async () => { const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); let ok = 0, bad = 0;
  const chk = (c, m) => { if (c) ok++; else { bad++; console.log('FEHLER', m); } };
  const start = async ctx => { const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html?3d=1&low3d=1'); await pg.waitForTimeout(500); await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await require('./mull.js')(pg);
    for (let i = 0; i < 100; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); } await pg.waitForTimeout(1200); return { pg, errs }; };
  for (const vp of (process.env.VP ? [JSON.parse(process.env.VP)] : [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }])) {
    const ctx = await b.newContext({ viewport: vp }); const { pg, errs } = await start(ctx); const tag = vp.width + 'x' + vp.height + ': ';
    chk(await pg.evaluate(() => document.querySelector('#v-game').classList.contains('duel')), tag + 'Bühne nicht aktiv');
    const fan = await pg.evaluate(() => [...document.querySelectorAll('#hand .hcard')].map(c => c.style.getPropertyValue('--r')));
    chk(fan.length >= 5 && fan.some(r => +r !== 0), tag + 'Hand nicht gefächert ' + fan);
    const sz = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight }));
    chk(sz.sw <= sz.iw + 1 && sz.sh <= sz.ih + 1, tag + 'Seite scrollt ' + JSON.stringify(sz));
    // Bedienelemente im Bild
    const vis = await pg.evaluate(() => ['#pb-top', '#pb-bot', '#mainbtn', '#logbtn', '#mmenu'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return s + ':' + (r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1); }));
    chk(vis.every(v => v.endsWith('true')), tag + 'Element außerhalb ' + vis.join(' '));
    // Drüberfahren → Details links
    await pg.locator('#hand .hcard').nth(1).hover(); await pg.waitForTimeout(400);
    const dp = await pg.evaluate(() => { const p = document.querySelector('.pop.duelpeek'); if (!p || p.hidden) return null; const r = p.getBoundingClientRect(); return { l: r.left, w: r.width }; });
    chk(dp && dp.l < 40, tag + 'Kartendetails links fehlen ' + JSON.stringify(dp));
    await pg.mouse.move(Math.round(vp.width * .3), 6); await pg.waitForTimeout(300);
    chk(await pg.evaluate(() => { const p = document.querySelector('.pop'); return !p || p.hidden; }), tag + 'Details bleiben stehen');
    // Beschwören: Energie geben, Karte wählen, Feld im 3D anklicken
    await pg.evaluate(() => { WOK_APP.game.s.players[0].energy = 20; WOK_APP.renderNow(); }); await pg.waitForTimeout(300);
    await pg.locator('#hand .hcard:not(.no):not(.sp)').first().click({ force: true }); await pg.waitForTimeout(300);
    const p = await pg.evaluate(() => { const c = document.querySelector('canvas.b3d').getBoundingClientRect(); const q = WOK_BOARD3D.project('r5c3'); return { x: c.left + (q.left + q.w / 2) / 100 * c.width, y: c.top + (q.top + q.h * .7) / 100 * c.height }; });
    await pg.mouse.click(p.x, p.y); await pg.waitForTimeout(900);
    chk(await pg.evaluate(() => Object.values(WOK_APP.game.s.units).some(u => u.owner === 0 && u.pos === 'C5')), tag + 'Beschwören über 3D-Feld ging nicht');
    // Volle Hand (10 Karten): Fächer bleibt zwischen den Leisten
    await pg.evaluate(() => { const P = WOK_APP.game.s.players[0]; let k = 900; while (P.hand.length < 10) P.hand.push(Object.assign({}, P.hand[0], { iid: 'x' + (k++) })); WOK_APP.renderNow(); }); await pg.waitForTimeout(400);
    const hb = await pg.evaluate(() => { const h = [...document.querySelectorAll('#hand .hcard')].map(c => c.getBoundingClientRect()), l = Math.min(...h.map(r => r.left)), r = Math.max(...h.map(r => r.right)), pb = document.querySelector('#pb-bot').getBoundingClientRect(), m = document.querySelector('.mate') && document.querySelector('.mate').getBoundingClientRect(); return { n: h.length, l, r, pbr: pb.right, ml: m ? m.left : innerWidth }; });
    chk(hb.n === 10 && hb.l >= hb.pbr - 2 && hb.r <= hb.ml + 2, tag + 'Fächer ragt in die Leisten ' + JSON.stringify(hb));
    // Spielverlauf-Knopf
    await pg.click('#logbtn'); await pg.waitForTimeout(300); chk(await pg.evaluate(() => !document.querySelector('#ov').hidden && /Spielverlauf/.test(document.querySelector('#dlg').textContent)), tag + 'Spielverlauf öffnet nicht');
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
    await pg.screenshot({ path: '/tmp/claude-0/wokui/buehne-' + vp.width + '.png' });
    chk(!errs.length, tag + 'Seitenfehler ' + errs.join(' | ')); await ctx.close(); }
  // Handy: keine Bühne
  { const ctx = await b.newContext({ ...devices['iPhone 13'] }); const pg = await ctx.newPage(); await pg.goto('http://127.0.0.1:8765/index.html?3d=1&low3d=1'); await pg.waitForTimeout(500); await pg.tap('[data-hplay="ai"]'); await pg.tap('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(1500);
    chk(await pg.evaluate(() => !document.querySelector('#v-game').classList.contains('duel')), 'Handy: Bühne fälschlich an'); await ctx.close(); }
  await b.close(); console.log('Bühne: ' + ok + ' bestanden, ' + bad + ' fehlgeschlagen.'); process.exit(bad ? 1 : 0); })();
