// Schnellwirken (4.5): spielbare Zauber/Flüche glühen auf der Hand; Antippen zeigt die Wirkung über dem Spielfeld; Ziel wählen, bestätigen.
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const EF = require('../src/effects.js'); const { chromium } = require('playwright');
const SH = '/tmp/claude-0/wokui/';
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
function card(id, type, name, kind, energy, ch) { const sp = EF.blankSpell(type); const e = EF.blankEffect(kind, type); Object.assign(e.target, ch || {}); sp.effects = [e]; const r = { id, type, name, energy, rarity: 'gewoehnlich', ruleText: '', spell: sp }; r.ruleText = EF.describe(r, global.WOK_DATA); r.spell.sync = EF.hash(r); return r; }
const curse = card('q_fluch', 'curse', 'Bannstrahl', 'destroy', 2, { side: 'enemy' });
const spell = card('q_zauber', 'spell', 'Lichtgabe', 'draw', 1); spell.spell.effects[0].params = { n: 1 }; spell.ruleText = EF.describe(spell, global.WOK_DATA); spell.spell.sync = EF.hash(spell);
const dear = card('q_teuer', 'spell', 'Sternenregen', 'draw', 9);
async function run(b, name, vp, touch) {
  const ctx = await b.newContext(Object.assign({ viewport: vp }, touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const tap = sel => touch ? pg.tap(sel) : pg.click(sel);
  const CF = touch ? '#pb-bot' : '#castfloat';
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  await tap('[data-hplay="ai"]'); await tap('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(500);
  for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
  await pg.evaluate(cs => { const G = WOK_APP.game, s = G.s; G.aiSide = -1; G.view = 0; for (const raw of cs) { const c = WOK.normalizeCard(raw); s.cards[c.id] = c; }
    for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    const mk = (cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
    const hero = Object.values(s.cards).find(x => x.type === 'hero' && !x.gifts.length) || Object.values(s.cards).find(x => x.type === 'hero');
    window.__foe = mk(hero.id, 1, 'C2'); window.__mine = mk(hero.id, 0, 'D5');
    s.players[0].hand = [{ iid: 'q1', cid: 'q_fluch' }, { iid: 'q2', cid: 'q_zauber' }, { iid: 'q3', cid: 'q_teuer' }, { iid: 'q4', cid: hero.id }]; s.players[0].energy = 5; s.phase = 'battle'; s.decl = {}; s.stack = []; WOK_APP.renderNow(); }, [curse, spell, dear]);
  await pg.waitForTimeout(300);
  const ready = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll('#hand [data-iid]')].map(e => [e.dataset.iid, e.dataset.ready || '-'])));
  ok(ready.q1 === 'curse' && ready.q2 === 'spell', name + ': Fluch glüht violett, Zauber grün: ' + JSON.stringify(ready));
  ok(ready.q3 === '-' && ready.q4 === '-', name + ': zu teure Karte und Held glühen nicht');
  const anim = await pg.evaluate(() => getComputedStyle(document.querySelector('#hand [data-iid="q1"]'), '::before').animationName);
  ok(/wok-ember/.test(anim), name + ': Glut-Animation läuft: ' + anim);
  await pg.screenshot({ path: SH + 'glow-' + name + '.png' });
  // Fluch: PC Klick → Wirk-Fenster; Handy: Antippen → Werte mit „Fluch wirken“ → Wirk-Fenster. Dann Ziel auf dem Brett, bestätigen
  await tap('#hand [data-iid="q1"]'); await pg.waitForTimeout(250);
  if (touch) { ok(await pg.isVisible('#pb-bot [data-popact="cast"]'), name + ': Spielerleiste mit „Wirken“'); ok(/Zerstöre/.test(await pg.textContent('#pb-bot')), name + ': Wirkungstext in der Spielerleiste'); await tap('#pb-bot [data-popact="cast"]'); await pg.waitForTimeout(250); }
  ok(await pg.isVisible(CF + ' .castbox'), name + ': ein Antippen öffnet die Wirkung' + (touch ? ' in der Spielerleiste' : ' über dem Spielfeld'));
  const txt = await pg.textContent(CF); ok(/Zerstöre/.test(txt) && /Bannstrahl/.test(txt), name + ': Wirkungstext direkt sichtbar: ' + txt.slice(0, 80));
  if (!touch) { const fl = await pg.evaluate(() => document.getElementById('castfloat').className); ok(/at-bottom/.test(fl), name + ': Fenster liegt nicht über dem Ziel (Ziel oben → Fenster unten): ' + fl); } else ok(await pg.evaluate(() => document.getElementById('castfloat').hidden), name + ': Handy – nichts liegt über dem Spielfeld');
  await pg.screenshot({ path: SH + 'cast-' + name + '.png' });
  await tap('.tok[data-uid="' + await pg.evaluate(() => window.__foe) + '"]'); await pg.waitForTimeout(250);
  ok(await pg.isVisible(CF + ' [data-cok]'), name + ': nach der Zielwahl nur noch bestätigen');
  await tap(CF + ' [data-cok]'); await pg.waitForTimeout(500);
  const st = await pg.evaluate(() => ({ stack: WOK_APP.game.s.stack.length, e: WOK_APP.game.s.players[0].energy, open: !!document.querySelector('#castfloat:not([hidden]) .castbox, #pb-bot .castbox') }));
  ok(st.stack === 1 && st.e === 3 && !st.open, name + ': Fluch gewirkt, Energie bezahlt, Fenster zu: ' + JSON.stringify(st));
  // Zauber ohne Ziel: Antippen → bestätigen
  const cast2 = async () => { await tap('#hand [data-iid="q2"]'); await pg.waitForTimeout(250); if (touch) { await tap('#pb-bot [data-popact="cast"]'); await pg.waitForTimeout(250); } };
  await pg.waitForTimeout(600); await cast2();
  ok(await pg.isVisible(CF + ' [data-cok]'), name + ': Zauber ohne Ziel – direkt bestätigen');
  // Abbrechen: nochmal die Karte antippen schließt
  await pg.waitForTimeout(600); await tap('#hand [data-iid="q2"]'); await pg.waitForTimeout(250); ok(!(await pg.isVisible(CF + ' .castbox')), name + ': nochmal antippen bricht ab');
  await pg.waitForTimeout(600); await cast2(); await tap(CF + ' [data-cabort]'); await pg.waitForTimeout(250); ok(!(await pg.isVisible(CF + ' .castbox')), name + ': Abbrechen');
  // zu teure Karte: kein Fenster, Erklärung wie bisher
  await pg.waitForTimeout(600); await tap('#hand [data-iid="q3"]'); await pg.waitForTimeout(250); ok(!(await pg.isVisible(CF + ' .castbox')), name + ': nicht wirkbare Karte öffnet kein Wirk-Fenster');
  // im gegnerischen Zug ohne Konterphase glüht nichts
  await pg.evaluate(() => { const s = WOK_APP.game.s; s.active = 1; s.phase = 'move'; WOK_APP.renderNow(); }); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => !document.querySelector('#hand [data-ready]')), name + ': im gegnerischen Zug glüht nichts');
  console.log(name, 'Seitenfehler:', errs); if (errs.length) failN++;
  await ctx.close();
}
(async () => { const b = await chromium.launch(); await run(b, 'pc', { width: 1366, height: 900 }, false); await run(b, 'handy', { width: 390, height: 844 }, true); await b.close();
  console.log('Schnellwirken: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0); })();
