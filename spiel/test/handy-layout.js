// Handy-Ansicht (31.10.2026): alles Wichtige ohne Scrollen sichtbar – auch im kleineren Fenster wie in der Claude-App.
const { chromium } = require('playwright');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const vp of [{ width: 390, height: 844, n: 'iphone' }, { width: 390, height: 700, n: 'claude-app' }, { width: 360, height: 640, n: 'klein' }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(vp.n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
    await pg.tap('[data-hplay="ai"]'); await pg.tap('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(500);
    for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
    await pg.evaluate(() => { const g = WOK_APP.game, P = g.s.players[0]; while (P.hand.length < 7 && P.deck.length) P.hand.push(P.deck.shift()); WOK_APP.renderNow(); window.scrollTo(0, 0); });
    await pg.waitForTimeout(400);
    const r = await pg.evaluate(() => { const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), h: Math.round(r.height), vis: getComputedStyle(e).display !== 'none' }; }; return { vh: innerHeight, doc: document.documentElement.scrollHeight, top: q('#pb-top'), board: q('#board'), bot: q('#pb-bot'), hand: q('#hand'), main: q('#mainbtn'), log: q('#log'), detail: q('#detailbox'), logbtn: q('#logbtn') }; });
    ok(r.main.b <= r.vh, vp.n + ': Hauptknopf ohne Scrollen sichtbar (unten ' + r.main.b + ' ≤ ' + r.vh + ')');
    ok(r.board.t >= 0 && r.hand.b <= r.vh, vp.n + ': Spielfeld und Hand vollständig sichtbar');
    ok(!r.log.vis || r.log.h === 0, vp.n + ': Spielverlauf ausgeblendet'); ok(r.logbtn.vis, vp.n + ': 📜-Knopf da');
    ok(r.board.h >= 200, vp.n + ': Spielfeld groß genug (' + r.board.h + ' px hoch)');
    console.log(vp.n, JSON.stringify({ vh: r.vh, doc: r.doc, board: r.board.h, mainUnten: r.main.b }));
    await pg.screenshot({ path: '/tmp/claude-0/wokui/layout-' + vp.n + '.png' });
    // 📜 öffnet den Spielverlauf, ☰ das Menü
    await pg.tap('#logbtn'); await pg.waitForTimeout(250); ok(await pg.isVisible('#dlg .dlglog'), vp.n + ': 📜 zeigt den Spielverlauf'); await pg.tap('#dlg [data-act="close"]'); await pg.waitForTimeout(200);
    await pg.tap('#mmenu'); await pg.waitForTimeout(250); ok(await pg.isVisible('#dlg [data-act="concede"]'), vp.n + ': ☰ zeigt Aufgeben/Menü'); await pg.tap('#dlg [data-act="close"]'); await pg.waitForTimeout(200);
    // Werte-Leiste: Handkarte antippen → eigene Leiste zeigt Werte; wegtippen → zurück
    const before = await pg.textContent('#pb-bot');
    const c = await pg.evaluate(() => { const e = document.querySelector('#hand [data-pcid]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; });
    await pg.touchscreen.tap(c.x, c.y); await pg.waitForTimeout(350);
    const info = await pg.evaluate(() => ({ on: document.getElementById('pb-bot').classList.contains('info'), txt: document.getElementById('pb-bot').textContent, pop: !!document.getElementById('pop') && !document.getElementById('pop').hidden, name: WOK_APP.game.s.cards[document.querySelector('#hand [data-pcid]').dataset.pcid].name }));
    ok(info.on && info.txt.includes(info.name) && /ATK|Zauber|Fluch|☾|✦/.test(info.txt), vp.n + ': Leiste zeigt die Werte der Karte (' + info.txt.slice(0, 50) + ')');
    ok(!info.pop, vp.n + ': kein Pop-up über dem Spielfeld');
    await pg.screenshot({ path: '/tmp/claude-0/wokui/infobar-' + vp.n + '.png' });
    await pg.touchscreen.tap(vp.width / 2, (r.board.t + r.board.b) / 2); await pg.waitForTimeout(350);
    ok(await pg.evaluate(() => !document.getElementById('pb-bot').classList.contains('info')) && /HP/.test(await pg.textContent('#pb-bot')), vp.n + ': wegtippen → wieder König-HP und Energie');
    // Gegnerischen Helden antippen → Gegnerleiste zeigt seine Werte
    const t = await pg.evaluate(() => { const u = Object.values(WOK_APP.game.s.units).find(x => x.owner === 1 && !x.king) || Object.values(WOK_APP.game.s.units).find(x => x.owner === 1); const e = document.querySelector('.tok[data-uid="' + u.uid + '"]'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await pg.touchscreen.tap(t.x, t.y); await pg.waitForTimeout(350);
    ok(await pg.evaluate(() => document.getElementById('pb-top').classList.contains('info')), vp.n + ': gegnerischer Held → Gegnerleiste zeigt Werte');
    await ctx.close();
  }
  console.log('Seitenfehler:', errs); if (errs.length) failN++;
  console.log('Handy-Ansicht: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN ? 1 : 0);
})();
