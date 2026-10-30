// Zerstörungs-Animation: Karte zerspringt (Kampf). Bildfolge in Echtzeit.
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1100, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(400);
  await pg.click('[data-hplay="ai"]'); await pg.click('[data-mode="hot"]'); await pg.click('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(400); if (await pg.isVisible('#ov')) await pg.click('#dlg [data-act="go"]');
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => {
    const G = WOK_APP.game, s = G.s; G.view = 0; G.handover = false; for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    const ids = Object.values(s.cards).filter(c => c.type === 'hero' && c.attack.dirs.n).map(c => c.id);
    const mk = (cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
    window.__a = mk(ids[0], 0, 'D5'); window.__t = mk(ids[0], 1, 'D4'); s.active = 0; s.phase = 'battle'; s.players[1].hand = s.players[1].hand.filter(h => s.cards[h.cid].type === 'hero');
    WOK_APP.renderNow();
  });
  await pg.waitForTimeout(800);
  const r = await pg.evaluate(() => { const el = document.querySelector('.tok[data-uid="' + window.__a + '"]').getBoundingClientRect(); return [el.x, el.y, el.width]; });
  await pg.evaluate(() => { WOK_APP.dispatch({ type: 'declare', uid: window.__a, targets: [window.__t] }); WOK_APP.dispatch({ type: 'endPhase' }); });
  const t0 = Date.now(), shots = [];
  for (let k = 0; k < 9; k++) { const f = OUT + 'tod' + k + '.png'; await pg.screenshot({ path: f, clip: { x: r[0] - r[2] * 1.2, y: r[1] - r[2] * 1.2, width: r[2] * 3.4, height: r[2] * 3.4 } }); shots.push(Date.now() - t0); }
  console.log('Zeitpunkte (ms):', shots.join(', '), '| Scherben:', await pg.evaluate(() => document.querySelectorAll('.shard').length));
  console.log('Fehler:', errs); await b.close();
})();
