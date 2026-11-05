// Wiederbeleben über die Oberfläche (31.10.2026): Bild-Auswahl → automatisch zum Spielfeld → leuchtende Felder → „Bist du sicher?“
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const EF = require('../src/effects.js'); const { chromium } = require('playwright');
const SH = '/tmp/claude-0/wokui/';
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
const sp = EF.blankSpell('spell'); const e = EF.blankEffect('revive', 'spell'); e.params.extraMove = true; sp.effects = [e];
const RV = { id: 'q_rv', type: 'spell', name: 'Ruf der Ahnen', energy: 2, rarity: 'selten', ruleText: '', spell: sp }; RV.ruleText = EF.describe(RV, global.WOK_DATA); RV.spell.sync = EF.hash(RV); RV.spell.v = EF.needVersion(RV.spell);
async function run(b, name, vp, touch) {
  const ctx = await b.newContext(Object.assign({ viewport: vp }, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', x => errs.push(x.message));
  const tap = sel => touch ? pg.tap(sel) : pg.click(sel);
  const CF = touch ? '#pb-bot' : '#castfloat';
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  await tap('[data-hplay="ai"]'); await tap('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(500);
  for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
  await pg.evaluate(raw => { const G = WOK_APP.game, s = G.s; G.aiSide = -1; const c = WOK.normalizeCard(raw); s.cards[c.id] = c;
    for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    const heroes = Object.keys(s.cards).filter(id => s.cards[id].type === 'hero').slice(0, 4);
    s.players[0].discard = heroes.map((cid, k) => ({ iid: 'dd' + k, cid })); window.__h = heroes;
    s.units.foe = { uid: 'foe', cid: heroes[0], owner: 1, pos: 'C3', king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] };
    s.units.blk = { uid: 'blk', cid: heroes[1], owner: 0, pos: 'D5', king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] };
    s.players[0].hand = [{ iid: 'r1', cid: 'q_rv' }]; s.players[0].energy = 5; s.phase = 'battle'; s.decl = {}; s.stack = []; WOK_APP.renderNow(); }, RV);
  await pg.waitForTimeout(300);
  await tap('#hand [data-iid="r1"]'); await pg.waitForTimeout(300);
  if (touch) { await tap('#pb-bot [data-popact="cast"]'); await pg.waitForTimeout(300); }
  ok(await pg.isVisible('#dlg .cgal'), name + ': Auswahl aus dem Ablagestapel öffnet sich von selbst');
  const n = await pg.evaluate(() => document.querySelectorAll('#dlg .cgal .cg').length), imgs = await pg.evaluate(() => [...document.querySelectorAll('#dlg .cgal .cg')].filter(x => /url\(/.test(x.style.backgroundImage)).length);
  ok(n === 4 && imgs === 4, name + ': 4 Helden als Kartenbilder (' + n + '/' + imgs + ')');
  await pg.screenshot({ path: SH + 'revive-gal-' + name + '.png' });
  await tap('#dlg .cgal .cg:nth-child(2)'); await pg.waitForTimeout(400);
  ok(!(await pg.isVisible('#dlg .cgal')), name + ': nach der Wahl schließt die Auswahl – zurück zum Spielfeld');
  const glow = await pg.evaluate(() => [...document.querySelectorAll('#board .cell.hl-summon')].map(c => c.dataset.f).sort());
  ok(glow.length === 8 && !glow.includes('D5'), name + ': freie Beschwörungs- und Wachfelder leuchten (8, besetztes D5 nicht): ' + glow.join(','));
  const cf = await pg.textContent(CF); ok(/leuchtendes Feld/.test(cf) && !/\b[A-G][1-7]\b/.test(cf), name + ': Hinweis ohne Feldnamen: ' + cf.slice(0, 90));
  ok(cf.includes(await pg.evaluate(() => WOK_APP.game.s.cards[window.__h[1]].name)), name + ': Hinweis nennt den gewählten Helden');
  ok(await pg.evaluate(() => getComputedStyle(document.querySelector('#board .cell.hl-summon > div')).animationName) === 'wok-field', name + ': Felder leuchten pulsierend');
  await pg.screenshot({ path: SH + 'revive-fields-' + name + '.png' });
  // Feld antippen → Rückfrage; Nein → nochmal wählen; Ja → Held erscheint
  await pg.click('.cell[data-f="B5"]', { force: true }); await pg.waitForTimeout(300);
  ok(/Bist du sicher/.test(await pg.textContent('#dlg').catch(() => '')), name + ': Rückfrage „Bist du sicher?“');
  await tap('#dlg [data-act="no"]'); await pg.waitForTimeout(300);
  ok(!(await pg.isVisible('#ov')) && await pg.evaluate(() => document.querySelectorAll('#board .cell.hl-summon').length) === 8, name + ': „Nein“ → Felder leuchten wieder');
  await pg.click('.cell[data-f="F5"]', { force: true }); await pg.waitForTimeout(300); await tap('#dlg [data-act="yes"]'); await pg.waitForTimeout(900);
  const st = await pg.evaluate(() => { const s = WOK_APP.game.s, u = Object.values(s.units).find(x => x.pos === 'F5'); return { cid: u && u.cid, own: u && u.owner, lock: u && u.summonTurn, extra: u && u.flags.extraMove, att: u ? WOK.targetsOf(s, u.uid).length : -1, reach: u ? Object.keys(WOK.reachable(s, u.uid)).length : 0, h: window.__h }; });
  ok(st.cid === st.h[1] && st.own === 0, name + ': gewählter Held steht auf F5');
  ok(st.lock === -1 && st.reach > 0, name + ': kann in dieser Battlephase noch laufen (Karte: laufen und angreifen)');
  console.log(name, 'Seitenfehler:', errs); if (errs.length) failN++;
  await ctx.close();
}
(async () => { const b = await chromium.launch(); await run(b, 'pc', { width: 1366, height: 900 }, false); await run(b, 'handy', { width: 390, height: 844 }, true); await b.close();
  console.log('Wiederbeleben-Oberfläche: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0); })();
