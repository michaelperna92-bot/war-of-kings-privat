// Zauber-UI-Probelauf (31.10.2026): Hunderte Werkstatt-Zauber/Flüche werden über die ECHTE Oberfläche gewirkt –
// Handkarte antippen, Ziele auf dem Brett/in der Auswahl antippen (echte Klicks an der sichtbaren Stelle), bestätigen.
// Meldet jede Lage, in der man nicht weiterkommt (Ziel verdeckt, Knopf fehlt, Fenster hängt). Aufruf: node test/zauber-ui-fuzz.js [Karten]
global.window = global; const CC = require('../ccpath.js'); require(require('path').join(CC, 'data.js'));
const EF = require(require('path').join(CC, 'effects.js')); global.WOK_EFFECTS = EF; const GEN = require(require('path').join(CC, 'spell-gen.js')); delete global.window;
const W = require('../src/engine.js'); const D = global.WOK_DATA; const { chromium } = require('playwright');
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const NC = +process.argv[2] || 120; let seed = 1234; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const heroes = DEMO.cards.filter(c => c.type === 'hero').map(c => W.normalizeCard(c)), kings = DEMO.cards.filter(c => c.type === 'king').map(c => W.normalizeCard(c));
function scene(sp, counter) {
  const cards = {}; for (const h of heroes) cards[h.id] = h; for (const k of kings) cards[k.id] = k; cards[sp.id] = sp;
  const deck = k => [k].concat(heroes.slice(0, 13).flatMap(h => [h.id, h.id, h.id]));
  let s = W.newGame({ cards, decks: [deck(kings[0].id), deck(kings[1].id)], seed: 99, fixedSides: true, mulligan: false }).state;
  for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
  const put = (cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; };
  const pos0 = ['A5', 'B5', 'C5', 'E5', 'F5', 'G5', 'C6', 'E6'], pos1 = ['A2', 'B2', 'C2', 'E2', 'F2', 'G2', 'B3', 'F3', 'D3'];
  pos0.forEach((f, k) => put(heroes[k % heroes.length].id, 0, f)); pos1.forEach((f, k) => put(heroes[(k + 3) % heroes.length].id, 1, f));
  for (let p = 0; p < 2; p++) { s.players[p].discard = heroes.slice(0, 8).map((h, k) => ({ iid: 'dd' + p + k, cid: h.id })); s.players[p].energy = 10; s.players[p].turns = 5; s.players[p].hand = []; for (let k = 0; k < 3; k++) s.players[p].hand.push(s.players[p].deck.shift()); }
  s.stack = []; const me = counter ? 1 : 0; s.players[me].hand.push({ iid: 'cast', cid: sp.id }); s.active = 0; s.phase = 'battle'; s.counter = null; s.decl = {};
  if (counter) { const att = Object.values(s.units).filter(u => u.owner === 0 && !u.king); for (const a of att) { const t = W.targetsOf(s, a.uid); if (t.length) { const r = W.apply(s, { type: 'declare', uid: a.uid, targets: [t[0].uid] }); if (!r.error) s = r.state; } if (Object.keys(s.decl).length >= 2) break; }
    s = W.apply(s, { type: 'endPhase' }).state; if (s.phase !== 'counter') return null; }
  if (!W.castOptions(s, me, 'cast').ok) return null;
  return { s, me };
}
const jobs = [];
for (let i = 0; i < NC; i++) {
  const c = GEN.random({ type: i % 2 ? 'curse' : 'spell', rng, D }); if (!c) continue;
  c.id = 'fz' + i; c.ruleText = EF.describe(c, D); c.spell.sync = EF.hash(c); c.spell.v = EF.needVersion(c.spell); c.spellFormat = EF.FORMAT;
  let n; try { n = W.normalizeCard(JSON.parse(JSON.stringify(c))); } catch (x) { continue; } if (!n.playable) continue;
  for (const counter of (n.spell.timing === 'both' ? [false, true] : [n.spell.timing === 'counter'])) { const sc = scene(n, counter); if (sc) jobs.push({ name: n.name, counter, s: sc.s, me: sc.me, kinds: n.spell.effects.map(e => e.kind).join('+') }); }
}
console.log('Lagen:', jobs.length);
(async () => {
  const b = await chromium.launch(); const res = { ok: 0, haengt: [], verdeckt: 0, fehler: [] };
  const DEVS = [['handy', { width: 390, height: 844 }, true], ['pc', { width: 1366, height: 768 }, false], ['handy3d', { width: 390, height: 844 }, true]].filter(d => !process.env.DEV || process.env.DEV.split(',').includes(d[0]));
  for (const [dev, vp, touch] of DEVS) { const d3 = dev === 'handy3d', panel = d3 ? '#mdock' : touch ? '#pb-bot' : '#castfloat';
    const ctx = await b.newContext(Object.assign({ viewport: vp }, touch ? { hasTouch: true, isMobile: true } : {})); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html' + (d3 ? '?3d=1&low3d=1' : '')); await pg.waitForTimeout(500); await (touch ? pg.tap('[data-hplay="ai"]') : pg.click('[data-hplay="ai"]')); await (touch ? pg.tap('#start') : pg.click('#start')); await require('./mull.js')(pg); for (let w = 0; w < 120 && !(await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')); w++) await pg.waitForTimeout(300); /* erst warten, bis die Startrunde der KI vorbei ist */  await pg.waitForTimeout(1500);
    const tapXY = async (x, y) => { if (touch) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); };
    // tippt ein Element an seiner sichtbaren Stelle an; liefert false, wenn es komplett verdeckt ist
    const tapEl = async sel => { const pt = await pg.evaluate(sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width) return null; for (const [fx, fy] of [[.5, .5], [.3, .3], [.7, .3], [.3, .7], [.7, .7], [.5, .15], [.5, .85]]) { const x = r.left + r.width * fx, y = r.top + r.height * fy; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue; const h = document.elementFromPoint(x, y); if (h && (h === e || e.contains(h))) return { x, y, clean: fx === .5 && fy === .5 }; } return { cov: (document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) || {}).className || '?' }; }, sel);
      if (!pt) return 'fehlt'; if (pt.cov) return 'verdeckt von ' + String(pt.cov).slice(0, 40); if (!pt.clean) res.verdeckt++; await tapXY(pt.x, pt.y); await pg.waitForTimeout(160); return true; };
    // 3D: Feld/Held auf der Leinwand antippen; verdeckt, wenn dort nicht die Leinwand oben liegt
    const tap3D = async f => { const pt = await pg.evaluate(f => { const G = WOK_APP.game, W = window.WOK, r = W.rowOf(f), c = W.colOf(f) + 1, v = G.view === 1, slot = 'r' + (v ? W.ROWS + 1 - r : r) + 'c' + (v ? 8 - c : c);
        const q = WOK_BOARD3D.project(slot), cv = document.querySelector('canvas.b3d'); if (!q || !cv) return null; const rc = cv.getBoundingClientRect(); const x = rc.left + (q.left + q.w / 2) / 100 * rc.width, y = rc.top + (q.top + q.h * .6) / 100 * rc.height; const e = document.elementFromPoint(x, y);
        return { x, y, cov: e === cv ? null : (e && (e.id || e.className) || 'nichts') }; }, f);
      if (!pt) return 'fehlt'; if (pt.cov) return 'verdeckt von ' + String(pt.cov).slice(0, 40); await tapXY(pt.x, pt.y); await pg.waitForTimeout(450); return true; };
    for (let j = 0; j < (d3 ? Math.min(jobs.length, +process.env.N3D || 40) : jobs.length); j++) {
      const J = jobs[j];
      for (let w = 0; w < 40 && await pg.evaluate(() => { const l = document.querySelector('.fxlayer'); return !!(l && !l.hidden); }); w++) await pg.waitForTimeout(150); // laufende Einblendung abwarten
      await pg.evaluate(J => { const G = WOK_APP.game; document.getElementById('ov').hidden = true; G.s = J.s; G.view = J.me; G.aiSide = -1; G.sel = null; G.cast = null; G.gift = null; G.info = null; G.idea = null; G.handover = false; G.replay = false; document.querySelector('#board').dataset.view = ''; WOK_APP.renderNow(); }, J);
      await pg.waitForTimeout(120); if (d3) { for (let w = 0; w < 20 && await pg.evaluate(() => document.getElementById('v-game').classList.contains('handaway')); w++) await pg.waitForTimeout(100); await pg.waitForTimeout(600); } // Hand gleitet herein
      let why = null;
      const r0 = await tapEl('#hand [data-iid="cast"]'); if (r0 !== true) why = 'Handkarte: ' + r0;
      if (!why && touch && !(await pg.evaluate(() => !!WOK_APP.game.cast))) { const r1 = await tapEl((d3 ? '#mdock' : '#pb-bot') + ' [data-popact="cast"]'); if (r1 !== true) why = '„Wirken“-Knopf: ' + r1; }
      // Abbrechen und erneut wirken muss gehen (Meldung des Entwicklers 5.11.2026)
      if (!why && process.env.ABORT && await pg.evaluate(() => !!WOK_APP.game.cast && document.getElementById('ov').hidden && !document.querySelector('#castfloat .castbox [data-cpick]'))) { const ra = await tapEl(panel + ' [data-cabort]'); if (ra !== true) why = 'Abbrechen-Knopf: ' + ra;
        if (!why) { await pg.waitForTimeout(250); const rb = await tapEl('#hand [data-iid="cast"]'); if (rb !== true) why = 'Handkarte nach Abbruch: ' + rb; }
        if (!why && touch && !(await pg.evaluate(() => !!WOK_APP.game.cast))) { const rc = await tapEl((d3 ? '#mdock' : '#pb-bot') + ' [data-popact="cast"]'); if (rc !== true) why = '„Wirken“ nach Abbruch: ' + rc; }
        if (!why && !(await pg.evaluate(() => !!WOK_APP.game.cast))) why = 'nach Abbruch nicht erneut wirkbar'; }
      for (let k = 0; k < 30 && !why; k++) {
        const st = await pg.evaluate(() => { const G = WOK_APP.game, s = G.s; return { cast: !!G.cast, inHand: s.players[G.view].hand.some(h => h.iid === 'cast'), dlg: !document.getElementById('ov').hidden, step: WOK_APP.castStep() && (x => ({ k: G.cast.k, type: x.type, what: x.what, cands: x.cands, need: x.need, chosen: x.chosen.slice() }))(WOK_APP.castStep()) }; });
        if (!st.inHand) break; // gewirkt
        if (st.dlg) { const d = await pg.evaluate(() => { const q = s => !!document.querySelector('#dlg ' + s); return q('.cg:not(.on)') ? '.cg:not(.on)' : q('[data-act="yes"]') ? '[data-act="yes"]' : q('[data-act="next"]') ? '[data-act="next"]' : null; }); if (!d) { why = 'Fenster ohne passenden Knopf: ' + (await pg.textContent('#dlg')).slice(0, 80); break; } const r = await tapEl('#dlg ' + d); if (r !== true) { why = 'Fenster-Knopf ' + d + ': ' + r; break; } continue; }
        if (!st.cast) { why = 'Wirk-Vorgang beendet, Karte aber noch in der Hand'; break; }
        if (!st.step) { const r = await tapEl(panel + ' [data-cok]'); if (r !== true) { why = 'Bestätigen-Knopf: ' + r; break; } continue; }
        const S = st.step;
        if (S.need > 1 && S.chosen.length >= S.need) { const r = await tapEl(panel + ' [data-cnext]'); if (r !== true) { why = 'Weiter-Knopf: ' + r; break; } continue; }
        if (S.what === 'discard') { const r = await tapEl(panel + ' [data-cgal]'); if (r !== true) { why = 'Auswahl-Knopf: ' + r; break; } continue; }
        const id = S.cands.find(c => !S.chosen.includes(c)); if (!id) { why = 'kein wählbares Ziel mehr (' + JSON.stringify(S) + ')'; break; }
        const sel = S.type === 'place' || S.what === 'field' ? '#board .cell[data-f="' + id + '"]' : (S.what === 'unit' || S.what === 'king') ? '#board .tok[data-uid="' + id + '"]' : panel + ' [data-cpick="' + id + '"]';
        let r; if (d3 && (S.type === 'place' || S.what === 'field' || S.what === 'unit' || S.what === 'king')) { const f = S.type === 'place' || S.what === 'field' ? id : await pg.evaluate(u => WOK_APP.game.s.units[u] && WOK_APP.game.s.units[u].pos, id); r = f ? await tap3D(f) : 'fehlt'; } else r = await tapEl(sel);
        if (r !== true && (S.type === 'place' || S.what === 'field')) { const u = await pg.evaluate(f => { const x = Object.values(WOK_APP.game.s.units).find(u => u.pos === f); return x && x.uid; }, id); if (u) r = await tapEl('#board .tok[data-uid="' + u + '"]'); } // Held auf dem Zielfeld antippen zählt als das Feld
        if (r !== true) { why = 'Ziel ' + id + ' (' + (S.what || S.type) + '): ' + r; break; }
        const after = await pg.evaluate(() => { const x = WOK_APP.castStep(), C = WOK_APP.game.cast; return { n: x ? x.chosen.length : -1, k: C ? C.k : -1, dlg: !document.getElementById('ov').hidden }; });
        if (after.n === S.chosen.length && after.k === S.k && !after.dlg) { why = 'Antippen von ' + id + ' ohne Wirkung (' + (S.what || S.type) + ')'; break; }
      }
      const fin = await pg.evaluate(() => { const G = WOK_APP.game; return { inHand: G.s.players[G.view].hand.some(h => h.iid === 'cast'), cast: !!G.cast }; });
      if (!why && fin.inHand) why = 'nach 30 Schritten nicht gewirkt';
      if (why) { res.haengt.push(dev + ' · ' + J.name + ' [' + J.kinds + (J.counter ? ', Konter' : '') + ']: ' + why); if (res.haengt.length <= 3) await pg.screenshot({ path: '/tmp/claude-0/wokui/fuzz-' + dev + '-' + j + '.png' }); }
      else res.ok++;
      if (errs.length) { res.fehler.push(dev + ' · ' + J.name + ': ' + errs.join(' | ')); errs.length = 0; }
    }
    await ctx.close();
  }
  await b.close();
  console.log('Gewirkt über die Oberfläche:', res.ok, '| teils verdeckte Ziele (anders erreicht):', res.verdeckt);
  console.log('HÄNGT (' + res.haengt.length + '):\n  ' + res.haengt.join('\n  '));
  console.log('Seitenfehler (' + res.fehler.length + '):\n  ' + res.fehler.join('\n  '));
  console.log('Zauber-UI-Probelauf: ' + res.ok + ' bestanden, ' + (res.haengt.length + res.fehler.length) + ' fehlgeschlagen.'); process.exit(res.haengt.length || res.fehler.length ? 1 : 0);
})();
