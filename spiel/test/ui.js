// Oberflächentest im Browser: Start, Beschwören, Laufen, Angreifen, KI-Zug, Handy-Ansicht.
const { chromium } = require('playwright');
const path = require('path');
const OUT = process.argv[2] || '/tmp/claude-0/wokui';
// Großansicht (ab 1.8): nach dem Antippen „Feld/Ziel wählen“ bzw. schließen
const pick = async pg => { await pg.waitForTimeout(120); if (await pg.isVisible('#insp')) { const b = await pg.$('#insp [data-ix="pick"]'); if (b) await b.click(); else await pg.keyboard.press('Escape'); await pg.waitForTimeout(450); } };
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const vp of [{ w: 1366, h: 900, n: 'pc' }, { w: 390, h: 844, n: 'phone' }]) {
    const pg = await b.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.n === 'phone' ? 2 : 1 });
    pg.on('pageerror', e => errs.push(vp.n + ': ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(vp.n + ' console: ' + m.text()); });
    await pg.goto('http://127.0.0.1:8765/index.html');
    await pg.waitForTimeout(600);
    await pg.screenshot({ path: OUT + '/' + vp.n + '-1-home.png', fullPage: true });
    await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await require('./mull.js')(pg);
    await pg.waitForTimeout(800);
    // falls die KI beginnt: warten bis wir dran sind
    for (let i = 0; i < 80; i++) { const mine = await pg.evaluate(() => { const g = WOK_APP.game; return g.s.active === 0 && g.s.phase === 'summon1'; }); if (mine) break; await pg.waitForTimeout(400); }
    await pg.screenshot({ path: OUT + '/' + vp.n + '-2-start.png' });
    // Handkarte wählen und beschwören
    const info = await pg.evaluate(() => { const g = WOK_APP.game, s = g.s; const h = s.players[0].hand.find(h => WOK.summonOptions(s, h.iid).length); return h ? { iid: h.iid, f: WOK.summonOptions(s, h.iid)[3] || WOK.summonOptions(s, h.iid)[0] } : null; });
    if (info) {
      await pg.click('.hcard[data-iid="' + info.iid + '"]'); await pick(pg); await pg.waitForTimeout(250);
      await pg.screenshot({ path: OUT + '/' + vp.n + '-3-select.png' });
      await pg.click('.cell[data-f="' + info.f + '"]', { force: true }); await pg.waitForTimeout(500);
      const ok = await pg.evaluate(f => !!WOK.unitAt(WOK_APP.game.s, f), info.f); if (!ok) errs.push(vp.n + ': Beschwören über Klick hat nicht geklappt');
    } else errs.push(vp.n + ': keine beschwörbare Karte');
    // Phasen weiterschalten bis zum KI-Zug und zurück
    for (let k = 0; k < 4; k++) { await pg.click('#mainbtn'); await pg.waitForTimeout(250); const d = await pg.$('#ov:not([hidden]) [data-act="yes"], #ov:not([hidden]) [data-act="go"]'); if (d) await d.click(); }
    for (let i = 0; i < 120; i++) { const mine = await pg.evaluate(() => { const g = WOK_APP.game; return g.s.active === 0 && g.s.phase === 'summon1' || !!g.s.result; }); if (mine) break; await pg.waitForTimeout(400); }
    // ein paar Runden automatisch mit legalen Klicks spielen
    for (let round = 0; round < 6; round++) {
      await pg.evaluate(() => { const g = WOK_APP.game, s = g.s; });
      // Beschwören, Laufen, Angreifen über die API-Klicks
      for (let step = 0; step < 30; step++) {
        const a = await pg.evaluate(() => { const g = WOK_APP.game, s = g.s; if (s.result || s.active !== 0) return null; return WOK_AI.decide(s, 0, 'mittel', g._tm || (g._tm = { seed: 3 })); });
        if (!a) break;
        if (a.type === 'summon') { await pg.click('.hcard[data-iid="' + a.iid + '"]'); await pick(pg); await pg.click('.cell[data-f="' + a.field + '"]', { force: true }); }
        else if (a.type === 'move') { await pg.click('.tok[data-uid="' + a.uid + '"]'); await pick(pg); await pg.click('.cell[data-f="' + a.to + '"]', { force: true }); }
        else if (a.type === 'declare') { await pg.click('.tok[data-uid="' + a.uid + '"]'); await pick(pg); for (const t of a.targets) await pg.click('.tok[data-uid="' + t + '"]'); if (vp.n === 'pc' && round === 1) await pg.screenshot({ path: OUT + '/' + vp.n + '-4-attack.png' }); await pg.click('.tok[data-uid="' + a.uid + '"]'); await pick(pg); }
        else if (a.type === 'gift') { await pg.evaluate(a => WOK_APP.dispatch(a), a); }
        else if (a.type === 'discard') { await pg.click('#dlg [data-act="d:' + a.iid + '"]'); }
        else { await pg.click('#mainbtn'); const d = await pg.$('#ov:not([hidden]) [data-act="yes"], #ov:not([hidden]) [data-act="go"]'); if (d) await d.click(); }
        await pg.waitForTimeout(120);
      }
      for (let i = 0; i < 120; i++) { const mine = await pg.evaluate(() => { const g = WOK_APP.game; return g.s.active === 0 && g.s.phase === 'summon1' || !!g.s.result; }); if (mine) break; await pg.waitForTimeout(300); }
    }
    await pg.screenshot({ path: OUT + '/' + vp.n + '-5-later.png', fullPage: vp.n === 'phone' });
    const st = await pg.evaluate(() => { const s = WOK_APP.game.s; return { turn: s.turn, units: Object.keys(s.units).length, hp: [0, 1].map(p => WOK.kingOf(s, p).hp), result: s.result, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
    console.log(vp.n, JSON.stringify(st));
    if (st.sw > st.cw) errs.push(vp.n + ': waagerechtes Scrollen ' + st.sw + '>' + st.cw);
    // Decks-Ansicht
    await pg.evaluate(() => { document.querySelector('#menu').click(); }); await pg.click('#dlg [data-act="leave"]'); await pg.click('[data-go="decks"]'); await pg.waitForTimeout(300);
    await pg.screenshot({ path: OUT + '/' + vp.n + '-6-decks.png' });
    await pg.close();
  }
  console.log(errs.length ? 'FEHLER:\n' + errs.join('\n') : 'keine Fehler');
  await b.close();
})();
