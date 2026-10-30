// Zustandssymbole: gefesselt, Debuffs/Buffs, Poison, Kontrolle – auf dem Feld und in der Kartenansicht
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h, n] of [[1366, 900, 'pc'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: n === 'phone' ? 2 : 1 }); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
    await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await pg.waitForTimeout(600);
    for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
    const uid = await pg.evaluate(() => {
      const G = WOK_APP.game, s = G.s; G.aiSide = -1;
      for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
      const hero = Object.values(s.cards).find(x => x.type === 'hero');
      const mk = (owner, pos, o) => { const uid = 'u' + (s.nextId++); s.units[uid] = Object.assign({ uid, cid: hero.id, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }, o); return uid; };
      const a = mk(0, 'D5', { fx: [{ id: 'fesseln', negative: true, until: { p: 1, turn: s.players[1].turns + 2 } }, { id: 'entwaffnen', stat: 'def', amount: -500, endTurn: true, negative: true }, { id: 'mordlust', stat: 'atk', amount: 500, endTurn: true }, { kind: 'giftBlock', gifts: 'all', negative: true, until: { p: 1, turn: s.players[1].turns + 1 } }], poison: { by: 1 } });
      mk(0, 'C5', { fx: [{ kind: 'protect', endTurn: true }, { kind: 'deathWard', uses: 1, used: 0, permanent: true }] });
      mk(1, 'D3', { fx: [{ kind: 'control', to: 1, negative: true, untilEnd: { p: 1, turn: s.players[1].turns + 1 } }, { stat: 'move', amount: -1, negative: true, endTurn: true }] });
      WOK_APP.renderNow(); return a;
    });
    await pg.waitForTimeout(900); await pg.screenshot({ path: OUT + n + '-status-board.png', clip: n === 'pc' ? { x: 180, y: 60, width: 700, height: 700 } : undefined });
    await pg.dblclick('.tok[data-uid="' + uid + '"]'); await pg.waitForTimeout(900);
    const rows = await pg.evaluate(() => [...document.querySelectorAll('#insp-info .strow')].map(r => r.className.split(' ')[1] + ': ' + r.textContent));
    console.log(n, rows.join('\n   '));
    await pg.evaluate(() => { const r = document.querySelector('#insp-info .stlist'); if (r) r.scrollIntoView(); });
    await pg.screenshot({ path: OUT + n + '-status-insp.png' });
    console.log(n, 'Symbole auf dem Feld:', await pg.evaluate(u => document.querySelectorAll('.tok[data-uid="' + u + '"] .sb').length, uid));
    await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
