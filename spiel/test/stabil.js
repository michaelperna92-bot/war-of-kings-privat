// Stabilität (31.10.2026): Fälle aus der Code-Prüfung – Handlimit-Fenster kommt immer wieder, Wiederbeleben mit 2 Helden,
// Zuguhr in der Konterphase, veraltete Fenster handeln nicht für den Gegner.
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const EF = require('../src/effects.js'); const { chromium } = require('playwright');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
const sp = EF.blankSpell('spell'); const e = EF.blankEffect('revive', 'spell'); e.target.count = 'n'; e.target.n = 2; sp.effects = [e];
const RV2 = { id: 'q_rv2', type: 'spell', name: 'Ruf der Zwei', energy: 2, rarity: 'selten', ruleText: '', spell: sp }; RV2.ruleText = EF.describe(RV2, global.WOK_DATA); RV2.spell.sync = EF.hash(RV2); RV2.spell.v = EF.needVersion(RV2.spell);
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 768 } }); const errs = []; pg.on('pageerror', x => errs.push(x.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500); await pg.click('[data-hplay="ai"]'); await pg.click('#start'); await require('./mull.js')(pg);
  for (let i = 0; i < 100; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
  await pg.waitForTimeout(1500);
  // 1) Handlimit: Fenster weg (z. B. durch Abgleich) → Hauptknopf öffnet es wieder
  await pg.evaluate(() => { const G = WOK_APP.game, s = G.s, P = s.players[0]; G.aiSide = -1; while (P.hand.length < 11 && P.deck.length) P.hand.push(P.deck.shift()); s.pendingDiscard = 0; document.getElementById('ov').hidden = true; WOK_APP.renderNow(); });
  await pg.waitForTimeout(200);
  ok(/Karte ablegen/.test(await pg.textContent('#mainbtn')) && !(await pg.isDisabled('#mainbtn')), 'Handlimit: Hauptknopf „Karte ablegen“ aktiv');
  await pg.click('#mainbtn'); await pg.waitForTimeout(200); ok(await pg.isVisible('#dlg [data-act^="d:"]'), 'Handlimit: Fenster wieder offen');
  await pg.click('#dlg [data-act^="d:"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => WOK_APP.game.s.pendingDiscard === null && WOK_APP.game.s.players[0].hand.length === 10), 'Handlimit: abgelegt, weiter geht es');
  // 2) Wiederbeleben mit 2 Helden: Auswahl → 2 Felder → „Bist du sicher?“ → beide stehen
  await pg.evaluate(raw => { const G = WOK_APP.game, s = G.s; const c = WOK.normalizeCard(raw); s.cards[c.id] = c; for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    const heroes = Object.keys(s.cards).filter(id => s.cards[id].type === 'hero').slice(0, 3); s.players[0].discard = heroes.map((cid, k) => ({ iid: 'dd' + k, cid }));
    s.players[0].hand = [{ iid: 'r2', cid: 'q_rv2' }]; s.players[0].energy = 5; s.phase = 'battle'; s.decl = {}; s.stack = []; WOK_APP.renderNow(); }, RV2);
  await pg.waitForTimeout(300);
  const o = await pg.evaluate(() => { const o = WOK.castOptions(WOK_APP.game.s, 0, 'r2'); return { ok: o.ok, why: o.why, max: o.effects && o.effects[0].max }; });
  ok(o.ok && o.max === 2, 'Testkarte: Wiederbeleben 2 Helden spielbar: ' + JSON.stringify(o));
  await pg.click('#hand [data-iid="r2"]'); await pg.waitForTimeout(400);
  await pg.click('#dlg .cgal .cg:nth-child(1)'); await pg.waitForTimeout(200);
  ok(await pg.isVisible('#dlg .cgal'), 'nach 1 von 2 Helden bleibt die Auswahl offen');
  await pg.click('#dlg .cgal .cg:nth-child(2)'); await pg.waitForTimeout(400);
  const glow = await pg.evaluate(() => [...document.querySelectorAll('#board .cell.hl-summon')].map(c => c.dataset.f));
  ok(glow.length >= 2, 'freie Felder leuchten: ' + glow.length);
  await pg.click('.cell[data-f="' + glow[0] + '"]', { force: true }); await pg.waitForTimeout(250);
  ok(!(await pg.isVisible('#dlg [data-act="yes"]')), 'nach dem 1. Feld noch keine Rückfrage');
  const glow2 = await pg.evaluate(() => [...document.querySelectorAll('#board .cell.hl-summon')].map(c => c.dataset.f));
  await pg.click('.cell[data-f="' + glow2[0] + '"]', { force: true }); await pg.waitForTimeout(250);
  ok(await pg.isVisible('#dlg [data-act="yes"]'), 'nach dem 2. Feld: „Bist du sicher?“');
  await pg.click('#dlg [data-act="yes"]'); await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => Object.values(WOK_APP.game.s.units).filter(u => u.owner === 0 && !u.king).length === 2 && !WOK_APP.game.s.players[0].hand.some(h => h.iid === 'r2')), 'beide Helden stehen auf dem Feld');
  // 3) Zuguhr in der Konterphase: Verteidiger passt automatisch
  await pg.evaluate(() => { const G = WOK_APP.game, s = G.s; s.phase = 'counter'; s.counter = 0; s.active = 1; s.decl = {}; G.aiSide = 1; G.timer = true; G.deadline = Date.now() - 10; G.timeoutSent = false; WOK_APP.renderNow(); });
  await pg.waitForTimeout(1500);
  ok(await pg.evaluate(() => WOK_APP.game.s.phase !== 'counter' || WOK_APP.game.s.counter !== 0), 'Zeit abgelaufen in der Konterphase → gepasst: ' + await pg.evaluate(() => WOK_APP.game.s.phase));
  console.log('Seitenfehler:', errs); if (errs.length) failN++;
  console.log('Stabilität: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN ? 1 : 0);
})();
