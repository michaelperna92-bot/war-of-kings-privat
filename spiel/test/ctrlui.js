// Spieloberfläche: Fluch mit Zusatzkosten und Kontrolle übernehmen (Knopftext, Zielwahl, Seitenwechsel)
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const EF = require('../src/effects.js');
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const sp = EF.blankSpell('curse'); sp.effects = [EF.blankEffect('control', 'curse')]; sp.cost = { hp: 1000, discard: 0 };
  const raw = { id: 'f_ctrl', type: 'curse', name: 'Seelenraub', energy: 2, rarity: 'selten', subtitle: 'Bannfluch', ruleText: '', spell: sp };
  raw.ruleText = EF.describe(raw, global.WOK_DATA); raw.spell.sync = EF.hash(raw);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await pg.waitForTimeout(600);
  for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
  const info = await pg.evaluate(raw => {
    const G = WOK_APP.game, s = G.s; G.aiSide = -1; G.view = 0;
    const c = WOK.normalizeCard(raw); s.cards[c.id] = c;
    for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    const mk = (cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
    const hero = Object.values(s.cards).find(x => x.type === 'hero' && !x.gifts.some(g => g.id === 'goettlicher_segen'));
    window.__foe = mk(hero.id, 1, 'D3');
    s.players[0].hand = [{ iid: 'hc1', cid: 'f_ctrl' }, { iid: 'hc2', cid: hero.id }]; s.players[0].energy = 10; s.phase = 'battle'; s.decl = {}; s.stack = [];
    WOK_APP.renderNow(); return { playable: c.playable, why: c.notPlayable };
  }, raw);
  console.log('spielbar:', JSON.stringify(info));
  await pg.click('.hcard[data-iid="hc1"]'); await pg.waitForTimeout(400);
  console.log('Knopf:', (await pg.textContent('[data-cast]')).trim());
  await pg.click('[data-cast]'); await pg.waitForTimeout(300);
  await pg.click('.tok[data-uid="' + await pg.evaluate(() => window.__foe) + '"]'); await pg.waitForTimeout(250);
  if (await pg.isVisible('[data-cok]')) await pg.click('[data-cok]'); await pg.waitForTimeout(300);
  console.log('König nach Kosten:', await pg.evaluate(() => WOK.kingOf(WOK_APP.game.s, 0).hp));
  await pg.click('#mainbtn'); await pg.waitForTimeout(400); if (await pg.isVisible('#ov')) { await pg.click('#dlg [data-act="go"], #dlg [data-act="yes"]').catch(() => {}); }
  await pg.waitForFunction(() => WOK_APP.game.s.phase === 'summon2', null, { timeout: 15000 });
  console.log('Besitzer danach:', await pg.evaluate(() => WOK_APP.game.s.units[window.__foe].owner));
  await pg.screenshot({ path: OUT + 'ctrl.png' });
  console.log('Fehler:', errs); await b.close();
})();
