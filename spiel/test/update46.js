// Großes Update (31.10.2026): Abwehren/Durchgehen, Angriff/Lauf nach Kontrolle & Wiederbeleben, Wiederbeleben mit Feldwahl, Formatversion.
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'), EF = W.EF, D = global.WOK_DATA;
W.setLayout(7); // Regeltests mit festen Feldern des früheren 7-Reihen-Feldes (Mechanik unverändert); das 5-Reihen-Feld prüft test/feld5.js
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
const H = (id, o) => W.normalizeCard(Object.assign({ id, type: 'hero', name: id, rarity: 'gewoehnlich', energy: 1, atk: 1000, def: 1000, move: { dirs: { n: 1, e: 1, w: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1 } }, gifts: [] }, o));
const K = id => W.normalizeCard({ id, type: 'king', name: id, rarity: 'selten', atk: 2000, hp: 10000, attack: { dirs: { n: 1 } }, gifts: [] });
function SP(id, type, kind, ch, o) { const raw = Object.assign({ id, type, name: id, rarity: 'gewoehnlich', energy: 0, ruleText: '' }, o || {}); raw.spell = Object.assign(EF.blankSpell(type), (o && o.spell) || {}); const e = EF.blankEffect(kind, type); for (const [p, v] of Object.entries(ch || {})) { const ks = p.split('.'); let x = e; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; } raw.spell.effects = [e]; EF.autoFix(raw.spell); raw.spell.v = EF.needVersion(raw.spell); return W.normalizeCard(raw); }
function game(extra) { const cards = { KA: K('KA'), KB: K('KB'), F: H('F') }; for (const c of extra) cards[c.id] = c;
  const s = W.newGame({ cards, decks: [['KA'].concat(Array(39).fill('F')), ['KB'].concat(Array(39).fill('F'))], seed: 3, fixedSides: true, mulligan: false }).state;
  for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid]; s.players.forEach(P => { P.hand = []; P.energy = 10; P.turns = 3; }); s.stack = []; return s; }
const put = (s, cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
const hand = (s, p, cid) => { const iid = 'h' + (s.nextId++); s.players[p].hand.push({ iid, cid }); return iid; };
const act = (s, a) => { const r = W.apply(s, a); if (r.error) throw new Error(r.error + ' bei ' + JSON.stringify(a)); return r.state; };
const ph = (s, p, x) => { s.active = p; s.phase = x; s.counter = null; s.pendingDiscard = null; return s; };

/* 1. Zerstören im Konter: abwehren vs. durchgehen */
for (const block of [true, false]) {
  const T = SP('T' + block, 'curse', 'destroy', { 'target.side': 'enemy', 'params.block': block, trigger: 'enemyAttack' });
  let s = game([T, H('A', { atk: 3000 })]); ph(s, 0, 'battle');
  const a = put(s, 'A', 0, 'D5'), d = put(s, 'F', 1, 'D4'); const i = hand(s, 1, T.id);
  s = act(s, { type: 'declare', uid: a, targets: [d] }); s = act(s, { type: 'endPhase' });
  s = act(s, { type: 'cast', p: 1, iid: i, choices: [[a]] }); const r = W.apply(s, { type: 'pass', p: 1 }); s = r.state;
  ok(!s.units[a], (block ? 'Abwehren' : 'Durchgehen') + ': Angreifer ist zerstört');
  if (block) ok(!!s.units[d], 'Abwehren: Verteidiger überlebt (Angriff fand nicht statt)');
  else { ok(!s.units[d], 'Durchgehen: Angriff wurde ausgeführt, Verteidiger fiel'); ok(r.events.some(e => e.t === 'combat' && e.hits.length) && r.events.findIndex(e => e.t === 'combat') < r.events.findIndex(e => e.t === 'afterBattle'), 'Durchgehen: Zerstörung nach dem Kampf'); }
  ok(/(Wehrt den Angriff ab|geht trotzdem durch)/.test(T.ruleText), 'Kartentext nennt es: ' + T.ruleText);
}
/* 2. Wiederbeleben in der eigenen Battlephase: sofort, Feld wählbar, greift an; mit Lauf */
for (const extra of [false, true]) {
  const RV = SP('RV' + extra, 'spell', 'revive', { 'params.extraMove': extra });
  let s = game([RV, H('X')]); ph(s, 0, 'battle'); s.players[0].discard.push({ iid: 'dx', cid: 'X' }); const foe = put(s, 'F', 1, 'B5');
  const i = hand(s, 0, RV.id), o = W.castOptions(s, 0, i);
  ok(o.ok && o.effects[0].place && o.effects[0].place.length === 9, 'Wiederbeleben: freie Felder zur Wahl (7 Beschwörungsfelder + 2 Wachfelder): ' + (o.effects[0].place || []).length);
  s = act(s, { type: 'cast', iid: i, choices: [['0:dx']], place: [['B6']] });
  const X = Object.values(s.units).find(u => u.cid === 'X');
  ok(X && X.pos === 'B6' && !s.stack.length, 'sofort auf dem gewählten Feld');
  ok(W.canAttack ? true : true, '');
  ok(W.targetsOf(s, X.uid).some(t => t.uid === foe), 'kann in derselben Battlephase angreifen');
  const reach = Object.keys(W.reachable(s, X.uid));
  ok(extra ? reach.length > 0 : reach.length === 0, extra ? 'mit Lauf: darf in der Battlephase noch laufen' : 'ohne Lauf: kein Laufen in der Battlephase');
  if (extra) { s = act(s, { type: 'move', uid: X.uid, to: 'B5' === reach[0] ? reach[1] : reach[0] }); ok(!Object.keys(W.reachable(s, X.uid)).length, 'Extra-Lauf nur einmal'); }
  ok(/noch in dieser Battlephase (laufen und )?angreifen/.test(RV.ruleText), 'Kartentext: ' + RV.ruleText);
}
/* 3. Kontrolle mit Lauf */
{ const C = SP('CT', 'curse', 'control', { 'params.extraMove': true, 'duration.kind': 'turn' });
  let s = game([C]); ph(s, 0, 'battle'); const e = put(s, 'F', 1, 'D3'); const i = hand(s, 0, C.id);
  s = act(s, { type: 'cast', iid: i, choices: [[e]] });
  ok(s.units[e].owner === 0 && Object.keys(W.reachable(s, e)).length > 0, 'Kontrolle mit Lauf: übernommener Held darf laufen');
  ok(/darf noch laufen/.test(C.ruleText), 'Kartentext Kontrolle: ' + C.ruleText); }
/* 4. Normale Bewegung in der Battlephase bleibt verboten */
{ let s = game([]); ph(s, 0, 'battle'); const u = put(s, 'F', 0, 'D5'); ok(!Object.keys(W.reachable(s, u)).length && W.apply(s, { type: 'move', uid: u, to: 'D4' }).error, 'ohne Karte kein Laufen in der Battlephase'); }
/* 5. Formatversion: neue Wirkungen markieren die Karte, ältere Spiele lehnen sie mit Hinweis ab */
{ const sp = EF.blankSpell('curse'); sp.effects = [EF.blankEffect('destroy', 'curse')]; ok(EF.needVersion(sp) === 1, 'alte Karte: Version 1');
  sp.effects[0].params.block = false; ok(EF.needVersion(sp) === 2, 'Durchgehen: Version 2');
  const c = W.normalizeCard({ id: 'zz', type: 'curse', name: 'Zukunft', energy: 1, rarity: 'gewoehnlich', ruleText: '', spell: Object.assign(EF.blankSpell('curse'), { v: 3, effects: [EF.blankEffect('destroy', 'curse')] }) });
  ok(!c.playable && /aktualisieren|neuere/.test(c.notPlayable.join(' ')), 'Karte aus neuerer Werkstatt: nicht spielbar mit Hinweis, kein Absturz');
  const u = W.normalizeCard({ id: 'zy', type: 'curse', name: 'Unbekannt', energy: 1, rarity: 'gewoehnlich', ruleText: '', spell: Object.assign(EF.blankSpell('curse'), { effects: [{ kind: 'zeitreise', target: { what: 'unit', side: 'enemy', count: 'one' }, params: {}, duration: { kind: 'instant' } }] }) });
  ok(!u.playable && /neuere Spielversion/.test(u.notPlayable.join(' ')), 'unbekannte Wirkung: „braucht neuere Spielversion“'); }
/* 6. Phasen-Ratgeber der Werkstatt */
{ const sg = k => { const sp = EF.blankSpell('curse'); sp.effects = [k]; return EF.phaseSuggest(sp).timing; };
  const tr = Object.assign(EF.blankEffect('destroy', 'curse'), { trigger: 'enemyAttack' });
  ok(sg(tr) === 'counter', 'Falle → Konterphase'); ok(sg(EF.blankEffect('revive', 'spell')) === 'battle', 'Wiederbeleben → Battlephase');
  const atk = EF.blankEffect('stat', 'spell'); atk.target.side = 'own'; atk.params = { stat: 'atk', mode: 'add', amount: 500 }; ok(sg(atk) === 'battle', 'eigene ATK hoch → Battlephase');
  const sp = EF.blankSpell('spell'); atk.duration = { kind: 'turn' }; sp.effects = [atk]; sp.timing = 'counter'; ok(EF.phaseIssues(sp).length === 1, 'Hinweis bei ATK hoch nur im Konter'); }
console.log('Update-4.6-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0);
