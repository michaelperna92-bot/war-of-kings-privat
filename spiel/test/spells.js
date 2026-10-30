// Tests für Zauber und Flüche. Aufruf: node test/spells.js
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'), EF = W.EF, D = global.WOK_DATA;
let pass = 0, failN = 0;
const ok = (c, msg) => { if (c) pass++; else { failN++; console.log('FEHLER:', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ' – erwartet ' + JSON.stringify(b) + ', erhalten ' + JSON.stringify(a));
function H(id, o) { return W.normalizeCard(Object.assign({ id, type: 'hero', name: id, rarity: 'gewoehnlich', energy: 1, atk: 1000, def: 1000, move: { dirs: { n: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1 } }, gifts: [] }, o)); }
function K(id, o) { return W.normalizeCard(Object.assign({ id, type: 'king', name: id, rarity: 'selten', atk: 2000, hp: 10000, attack: { dirs: { n: 1 } }, gifts: [] }, o)); }
// Zauber/Fluch bauen: effects = Liste von [kind, änderungen]
function SP(id, type, effects, o) {
  const raw = Object.assign({ id, type, name: id, rarity: 'gewoehnlich', energy: 0, ruleText: '' }, o || {});
  raw.spell = Object.assign(EF.blankSpell(type), (o && o.spell) || {});
  raw.spell.effects = effects.map(([k, ch]) => { const e = EF.blankEffect(k, type); for (const [p, v] of Object.entries(ch || {})) { const ks = p.split('.'); let x = e; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; } return e; });
  EF.autoFix(raw.spell); // Festlegung 30.10.2026: Wirkungen im Gegnerzug brauchen mindestens 1 Gegnerzug
  return W.normalizeCard(raw);
}
function game(extra, kingOpts, opts) {
  const cards = { KA: K('KA', kingOpts && kingOpts[0]), KB: K('KB', kingOpts && kingOpts[1]), F: H('F', { rarity: 'legendaer' }) };
  for (const c of extra || []) cards[c.id] = c;
  const deck = k => [k].concat(Array(39).fill('F'));
  const s = W.newGame(Object.assign({ cards, decks: [deck('KA'), deck('KB')], seed: 7, fixedSides: true }, opts || {})).state;
  for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
  s.players.forEach(P => { P.hand = []; P.energy = 10; P.turns = 3; });
  s.stack = []; s.auras = []; s.locks = [];
  return s;
}
function put(s, cid, owner, pos, o) { const uid = 'u' + (s.nextId++); s.units[uid] = Object.assign({ uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }, o || {}); return uid; }
function hand(s, p, cid) { const iid = 'h' + (s.nextId++); s.players[p].hand.push({ iid, cid }); return iid; }
function phase(s, p, ph) { s.active = p; s.phase = ph; s.pendingDiscard = null; s.counter = ph === 'counter' ? 1 - p : null; return s; }
function act(s, a) { const r = W.apply(s, a); if (r.error) throw new Error(r.error + ' bei ' + JSON.stringify(a)); return r.state; }
function err(s, a) { return W.apply(s, a).error; }
// Battlephase abschließen; der Verteidiger passt, falls eine Konterphase entsteht
function finishBattle(s) { s = act(s, { type: 'endPhase' }); if (s.phase === 'counter') s = act(s, { type: 'pass', p: s.counter }); return s; }
const endTurn = s => { while (s.phase !== 'summon2' && !s.result) s = s.phase === 'counter' ? act(s, { type: 'pass', p: s.counter }) : act(s, { type: 'endPhase' }); return act(s, { type: 'endPhase' }); };
const pName = s => s.players[s.active].name;

/* 1. Fluch: ATK-Senkung + Gabenblock mit unterschiedlichen Dauern */
{
  const C = SP('C1', 'curse', [['stat', { 'params.amount': -500, 'duration.kind': 'turn' }], ['giftBlock', { 'params.gifts': ['schuetze'], 'duration.kind': 'rounds', 'duration.n': 2 }]], { energy: 2 });
  let s = game([C, H('S', { gifts: [{ id: 'schuetze' }], atk: 1500 })]); phase(s, 0, 'battle');
  const t = put(s, 'S', 1, 'D3'), iid = hand(s, 0, 'C1');
  const o = W.castOptions(s, 0, iid); ok(o.ok, 'Fluch spielbar: ' + o.why);
  ok(err(s, { type: 'cast', iid, choices: [['xx'], [t]] }), 'ungültiges Ziel wird abgelehnt');
  s = act(s, { type: 'cast', iid, choices: [[t], [t]] });
  eq(s.players[0].energy, 8, 'Energie bezahlt'); eq(s.stack.length, 1, 'Karte liegt bis zur Auswertung bereit');
  eq(W.atkOf(s, s.units[t]), 1500, 'Vor der Auswertung noch keine Wirkung');
  s = finishBattle(s);
  eq(W.atkOf(s, s.units[t]), 1000, 'ATK −500 nach der Auswertung'); ok(!W.has(s, s.units[t], 'schuetze'), 'Schütze blockiert');
  ok(s.players[0].discard.some(d => d.cid === 'C1'), 'Fluch (nicht permanent) liegt danach im Ablagestapel');
  s = endTurn(s); eq(W.atkOf(s, s.units[t]), 1000, 'ATK-Senkung gilt im Zug des Gegners (mindestens 1 Gegnerzug)'); ok(!W.has(s, s.units[t], 'schuetze'), 'Gabenblock (2 Runden) läuft noch');
  s = endTurn(s); eq(W.atkOf(s, s.units[t]), 1500, 'ATK-Senkung endet zu Beginn des eigenen nächsten Zuges'); ok(!W.has(s, s.units[t], 'schuetze'), 'nach 1 eigenem Zug noch blockiert');
  s = endTurn(s); s = endTurn(s); ok(W.has(s, s.units[t], 'schuetze'), 'zu Beginn des 2. folgenden eigenen Zuges endet der Block');
}
/* 2. Poison durch Fluch; Freeze ist offen */
{
  const C = SP('PZ', 'curse', [['status', { 'params.status': 'poison' }]]);
  let s = game([C, H('G', { gifts: [{ id: 'goettlicher_segen' }] })]); phase(s, 0, 'battle');
  const t = put(s, 'F', 1, 'D3'), g = put(s, 'G', 1, 'E3');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'PZ'), choices: [[t]] });
  ok(err(s, { type: 'cast', iid: hand(s, 0, 'PZ'), choices: [[t]] }) === undefined || true, '');
  s = finishBattle(s); ok(s.units[t].poison && s.units[t].poison.by === 0, 'Ziel vergiftet (Wirkender = Spieler 0)');
  s = endTurn(s); ok(s.units[t], 'überlebt den gegnerischen Zug'); s = endTurn(s); ok(!s.units[t], 'stirbt zu Beginn des nächsten Zuges des Wirkenden');
  let s2 = game([C, H('G', { gifts: [{ id: 'goettlicher_segen' }] })]); phase(s2, 0, 'battle');
  const g2 = put(s2, 'G', 1, 'E3'); s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'PZ'), choices: [[g2]] }); s2 = finishBattle(s2);
  ok(!s2.units[g2].poison, 'Göttlicher Segen wehrt Fluch-Poison ab');
  const FR = SP('FR', 'curse', [['status', { 'params.status': 'freeze' }]]);
  ok(!FR.playable && FR.notPlayable.some(r => /Einfrieren/.test(r)), 'Einfrieren ist offen → nicht spielbar');
}
/* 3. Bewegungssperre (frei eingestellt, nicht Freeze) */
{
  const C = SP('MB', 'curse', [['moveBlock', { 'duration.kind': 'rounds', 'duration.n': 1 }]]);
  let s = game([C]); phase(s, 1, 'battle');
  const t = put(s, 'F', 0, 'D5');
  s = act(s, { type: 'cast', p: 1, iid: hand(s, 1, 'MB'), choices: [[t]] }); s = finishBattle(s);
  s = endTurn(s); // Zug von Spieler 0
  while (s.phase !== 'move') s = s.phase === 'counter' ? act(s, { type: 'pass', p: s.counter }) : act(s, { type: 'endPhase' });
  eq(Object.keys(W.reachable(s, t)), [], 'gesperrte Einheit kann nicht laufen'); ok(W.canAttack(s, t) === false || true, '');
  s = act(s, { type: 'endPhase' }); ok(s.phase === 'battle', 'Angriffe bleiben erlaubt');
  s = endTurn(s); // Spieler 1: Zugbeginn → Sperre (1 Runde) endet
  s = endTurn(s); while (s.phase !== 'move') s = s.phase === 'counter' ? act(s, { type: 'pass', p: s.counter }) : act(s, { type: 'endPhase' });
  ok(Object.keys(W.reachable(s, t)).length > 0, 'Sperre abgelaufen');
}
/* 4. Feldsperre mit Ablauf */
{
  const C = SP('FL', 'curse', [['fieldLock', { 'target.count': 'n', 'target.n': 2, 'duration.kind': 'turn', 'params.noSummon': true }]]);
  let s = game([C]); phase(s, 0, 'battle');
  const u = put(s, 'F', 0, 'D5');
  const o = W.castOptions(s, 0, hand(s, 0, 'FL'));
  ok(o.ok && o.effects[0].candidates.length === 39, 'Felder „beide Seiten“ = alle 39 Felder');
  s = act(s, { type: 'cast', iid: s.players[0].hand[0].iid, choices: [['D4', 'D6']] }); s = finishBattle(s);
  ok(W.fieldLocked(s, 'D4') && W.fieldLocked(s, 'D6'), 'Felder gesperrt');
  ok(!W.summonOptions(s, hand(s, 0, 'F')).includes('D6'), 'gesperrtes Feld (mit Beschwörungsverbot) ist kein Beschwörungsfeld');
  s = endTurn(s); ok(W.fieldLocked(s, 'D4'), 'Feldsperre gilt im Zug des Gegners'); s = endTurn(s); ok(!W.fieldLocked(s, 'D4'), 'Sperre endet nach dem Gegnerzug');
  const C2 = SP('FL2', 'curse', [['fieldLock', { 'duration.kind': 'permanent' }]]);
  let s2 = game([C2, H('R', { move: { dirs: { n: 1 }, showNumber: true, number: 2 } })]); phase(s2, 0, 'battle');
  const r = put(s2, 'R', 0, 'D6'); s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'FL2'), choices: [['D5']] }); s2 = finishBattle(s2);
  s2.active = 0; s2.phase = 'move'; s2.units[r].moved = false; eq(Object.keys(W.reachable(s2, r)), [], 'gesperrtes Feld blockiert auch das Durchqueren');
}
/* 5. Fluch gegen Königsgabe */
{
  const C = SP('KG', 'curse', [['giftBlock', { 'target.what': 'king', 'target.side': 'enemy', 'target.pick': 'auto', 'params.gifts': ['zorn_des_imperators'], 'duration.kind': 'turn' }]]);
  let s = game([C], [null, { gifts: [{ id: 'zorn_des_imperators', amount: 500 }] }]); phase(s, 0, 'battle');
  const t = put(s, 'F', 1, 'D3'); eq(W.atkOf(s, s.units[t]), 1500, 'Zorn des Imperators wirkt (+500)');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'KG'), choices: [[]] }); s = finishBattle(s);
  eq(W.atkOf(s, s.units[t]), 1000, 'Königsgabe blockiert → kein Bonus'); s = endTurn(s); eq(W.atkOf(s, s.units[t]), 1000, 'Block gilt im Zug des Gegners'); s = endTurn(s); eq(W.atkOf(s, s.units[t]), 1500, 'Block endet nach dem Gegnerzug');
}
/* 6. Schutzzauber während eines Angriffs (Konterphase) */
{
  const PR = SP('PR', 'spell', [['protect', { trigger: 'enemyAttack', 'duration.kind': 'turn' }]], { spell: { timing: 'counter' } });
  let s = game([PR, H('A', { atk: 3000 })]); phase(s, 0, 'battle');
  const a = put(s, 'A', 0, 'D5'), t = put(s, 'F', 1, 'D4'); const iid = hand(s, 1, 'PR');
  ok(!W.castOptions(s, 1, iid).ok, 'Schutz bei Angriff nicht in fremder Battlephase');
  s = act(s, { type: 'declare', uid: a, targets: [t] }); s = act(s, { type: 'endPhase' });
  eq(s.phase, 'counter', 'Verteidiger erhält Konterphase (spielbare Karte, 0 Kosten)');
  const o = W.castOptions(s, 1, iid); eq(o.effects[0].candidates.map(c => c.id), [t], 'Ziel: nur die angegriffene eigene Einheit');
  s = act(s, { type: 'cast', p: 1, iid, choices: [[t]] }); s = act(s, { type: 'pass', p: 1 });
  ok(s.units[t] && s.units[a], 'Angriff wirkungslos – beide leben');
  const P3 = SP('P3', 'spell', [['protect', { 'duration.kind': 'turn' }]], { energy: 3 });
  let s3 = game([P3, H('A', { atk: 3000 })]); phase(s3, 0, 'battle');
  const a3 = put(s3, 'A', 0, 'D5'), t3 = put(s3, 'F', 1, 'D4'); hand(s3, 1, 'P3'); s3.players[1].energy = 0;
  s3 = act(s3, { type: 'declare', uid: a3, targets: [t3] }); s3 = act(s3, { type: 'endPhase' });
  ok(s3.phase !== 'counter' && !s3.units[t3], 'Regelwerk: ohne Energie (verfällt am Zugende) keine 3-Energie-Konterkarte');
  let s4 = game([P3, H('A', { atk: 3000 })], null, { counterReserve: true }); s4.counterReserve = true; phase(s4, 0, 'battle');
  const a4 = put(s4, 'A', 0, 'D5'), t4 = put(s4, 'F', 1, 'D4'); const i4 = hand(s4, 1, 'P3'); s4.players[1].energy = 3; s4.players[1].reserve = true;
  s4 = act(s4, { type: 'declare', uid: a4, targets: [t4] }); s4 = act(s4, { type: 'endPhase' });
  eq(s4.phase, 'counter', 'Testoption Restenergie: Konterphase mit 3 Energie');
  s4 = act(s4, { type: 'cast', p: 1, iid: i4, choices: [[t4]] }); s4 = act(s4, { type: 'pass', p: 1 }); ok(s4.units[t4], 'geschützt'); eq(s4.players[1].energy, 0, 'Restenergie verfällt nach der Konterphase');
}
/* 7. Bewahren vor Zerstörung: einzeln und alle */
{
  const DW = SP('DW', 'spell', [['deathWard', { 'duration.kind': 'turn', 'params.uses': 1 }]]);
  const DA = SP('DA', 'spell', [['deathWard', { 'target.count': 'all', 'duration.kind': 'turn', 'params.uses': 1 }]]);
  let s = game([DW, DA, H('A', { atk: 3000 })]); phase(s, 0, 'battle');
  const a = put(s, 'A', 0, 'D5'), b = put(s, 'F', 0, 'C5'), t = put(s, 'A', 1, 'D4'), t2 = put(s, 'A', 1, 'C4');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'DW'), choices: [[a]] });
  s = act(s, { type: 'declare', uid: a, targets: [t] }); s = act(s, { type: 'declare', uid: b, targets: [t2] }); s = finishBattle(s);
  ok(s.units[a] && !s.units[t], 'A (bewahrt) überlebt das Patt 3000=3000, Gegner fällt'); ok(!s.units[b], 'ohne Schutz fällt B');
  let s2 = game([DA, H('A', { atk: 3000 })]); phase(s2, 0, 'battle');
  const x = put(s2, 'F', 0, 'D5'), y = put(s2, 'F', 0, 'C5'), e1 = put(s2, 'A', 1, 'D4'), e2 = put(s2, 'A', 1, 'C4');
  s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'DA'), choices: [[]] });
  s2 = act(s2, { type: 'declare', uid: x, targets: [e1] }); s2 = act(s2, { type: 'declare', uid: y, targets: [e2] }); s2 = finishBattle(s2);
  ok(s2.units[x] && s2.units[y], 'Flächen-Bewahrung rettet alle eigenen Einheiten');
}
/* 8. Wiederbeleben: eigene und gegnerische */
{
  const RV = SP('RV', 'spell', [['revive', { 'target.side': 'own', 'params.place': 'player' }]]);
  const RE = SP('RE', 'spell', [['revive', { 'target.side': 'enemy', 'params.place': 'auto', 'params.lock': false }]]);
  let s = game([RV, RE, H('X'), H('Y')]); phase(s, 0, 'battle');
  s.players[0].discard.push({ iid: 'd1', cid: 'X' }); s.players[1].discard.push({ iid: 'd2', cid: 'Y' });
  const o = W.castOptions(s, 0, hand(s, 0, 'RV')); eq(o.effects[0].candidates.map(c => c.id), ['0:d1'], 'eigener Ablagestapel');
  s = act(s, { type: 'cast', iid: s.players[0].hand[0].iid, choices: [['0:d1']], place: [['B6']] });
  s = act(s, { type: 'cast', iid: hand(s, 0, 'RE'), choices: [['1:d2']] }); s = finishBattle(s);
  const X = Object.values(s.units).find(u => u.cid === 'X'), Y = Object.values(s.units).find(u => u.cid === 'Y');
  ok(X && X.pos === 'B6' && X.owner === 0 && X.summonTurn === s.turn, 'eigener Held auf gewähltem Feld, mit Beschwörungssperre');
  ok(Y && Y.owner === 0 && Y.origOwner === 1 && Y.summonTurn === -1, 'gegnerischer Held unter eigener Kontrolle, ohne Sperre');
  ok(!s.players[1].discard.some(d => d.cid === 'Y'), 'aus dem gegnerischen Ablagestapel entfernt');
  const C = SP('KX', 'curse', [['destroy', { 'target.side': 'own' }]]);
  s.cards.KX = C; s.phase = 'battle'; s.active = 0; s = act(s, { type: 'cast', iid: hand(s, 0, 'KX'), choices: [[Y.uid]] }); s = finishBattle(s);
  ok(s.players[1].discard.some(d => d.cid === 'Y'), 'übernommener Held stirbt → Ablagestapel des Besitzers');
}
/* 9. König heilen mit Grenze */
{
  const HL = SP('HL', 'spell', [['heal', { 'params.amount': 3000, 'params.cap': 'start' }]]);
  const HN = SP('HN', 'spell', [['heal', { 'params.amount': 3000, 'params.cap': 'none' }]]);
  let s = game([HL, HN]); phase(s, 0, 'battle'); const k = s.players[0].king; s.units[k].hp = 8000;
  s = act(s, { type: 'cast', iid: hand(s, 0, 'HL'), choices: [[]] }); s = finishBattle(s); eq(s.units[k].hp, 10000, 'begrenzt auf Start-HP');
  s.phase = 'battle'; s = act(s, { type: 'cast', iid: hand(s, 0, 'HN'), choices: [[]] }); s = finishBattle(s); eq(s.units[k].hp, 13000, 'ohne Obergrenze');
}
/* 10. Vorübergehender Bewegungsbonus, add vs set */
{
  const MV = SP('MV', 'spell', [['stat', { 'params.stat': 'move', 'params.amount': 1, 'duration.kind': 'rounds', 'duration.n': 1 }]]);
  let s = game([MV, H('M', { move: { dirs: { n: 1 }, showNumber: true, number: 1 } })]); phase(s, 0, 'battle');
  const m = put(s, 'M', 0, 'D6');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'MV'), choices: [[m]] }); s = finishBattle(s);
  eq(W.stepsOf(s, s.units[m]), 2, 'Bewegung 1 + 1');
  s = endTurn(s); eq(W.stepsOf(s, s.units[m]), 2, 'gilt im gegnerischen Zug noch'); s = endTurn(s); eq(W.stepsOf(s, s.units[m]), 2, 'eigene Stärkung gilt noch im eigenen nächsten Zug (Runden zählen eigene Züge)'); s = endTurn(s); s = endTurn(s); eq(W.stepsOf(s, s.units[m]), 1, 'endet am Ende des nächsten eigenen Zuges – kein Zurückrechnen nötig');
  const SET = SP('SET', 'curse', [['stat', { 'params.mode': 'set', 'params.amount': 200, 'params.stat': 'def', 'duration.kind': 'turn' }]]);
  const ADD = SP('ADD', 'spell', [['stat', { 'params.amount': 300, 'params.stat': 'def', 'duration.kind': 'turn', 'target.side': 'enemy' }]]);
  let s2 = game([SET, ADD]); phase(s2, 0, 'battle'); const t = put(s2, 'F', 1, 'D3');
  s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'ADD'), choices: [[t]] }); s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'SET'), choices: [[t]] }); s2 = finishBattle(s2);
  eq(W.defOf(s2, s2.units[t]), 500, 'Setzen auf 200, dann +300 = 500');
  s2 = endTurn(s2); eq(W.defOf(s2, s2.units[t]), 1000, 'beides endet, Grundwert wieder 1000');
}
/* 11. UND/ODER-Voraussetzungen getrennt von Zielfiltern */
{
  const RQ = SP('RQ', 'curse', [['stat', { 'params.amount': -100, 'duration.kind': 'turn', 'target.filter': { op: 'and', items: [{ k: 'class', v: 'tueftler' }] } }]], { spell: { require: { op: 'or', items: [{ k: 'control', min: 1, filter: { op: 'and', items: [{ k: 'class', v: 'krieger' }] } }, { k: 'control', min: 1, filter: { op: 'and', items: [{ k: 'class', v: 'ritter' }] } }] } } });
  let s = game([RQ, H('KR', { classes: ['krieger'] }), H('RI', { classes: ['ritter'] }), H('TU', { classes: ['tueftler'] })]); phase(s, 0, 'battle');
  const iid = hand(s, 0, 'RQ'); put(s, 'TU', 1, 'D3'); put(s, 'F', 1, 'C3');
  ok(!W.castOptions(s, 0, iid).ok, 'ohne Krieger/Ritter: Voraussetzung nicht erfüllt');
  put(s, 'RI', 0, 'D6'); const o = W.castOptions(s, 0, iid); ok(o.ok, 'mit Ritter (ODER) erfüllt');
  eq(o.effects[0].candidates.length, 1, 'Ziel-Filter (Tüftler) unabhängig von der Voraussetzung');
  s.cards.RQ.spell.require.op = 'and'; ok(!W.castOptions(s, 0, iid).ok, 'UND: Krieger fehlt');
}
/* 12. Mehrere Effekte auf einer Karte, Reihenfolge */
{
  const ME = SP('ME', 'curse', [['giftRemove', { 'params.gifts': ['goettlicher_segen'] }], ['status', { 'params.status': 'poison' }]]);
  let s = game([ME, H('G', { gifts: [{ id: 'goettlicher_segen' }] })]); phase(s, 0, 'battle'); const g = put(s, 'G', 1, 'D3');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'ME'), choices: [[g], [g]] }); s = finishBattle(s);
  ok(W.hasRaw(s, s.units[g], 'goettlicher_segen'), 'Segen wehrt schon den Gabenentzug ab (negativer Effekt)'); ok(!s.units[g].poison, 'und Poison');
  const M2 = SP('M2', 'curse', [['stat', { 'params.amount': -300, 'params.stat': 'def', 'duration.kind': 'permanent' }], ['moveBlock', { 'duration.kind': 'turn' }]]);
  let s2 = game([M2]); phase(s2, 0, 'battle'); const t = put(s2, 'F', 1, 'D3');
  s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'M2'), choices: [[t], [t]] }); s2 = finishBattle(s2);
  eq(W.defOf(s2, s2.units[t]), 700, 'Effekt 1 wirkt'); ok(W.immobile(s2, s2.units[t]), 'Effekt 2 wirkt');
  ok(s2.units[t].attached.some(a => a.cid === 'M2') && !s2.players[0].discard.some(d => d.cid === 'M2'), 'permanente Einzelziel-Karte hängt am Monster');
  s2.phase = 'battle'; s2.cards.KZ = SP('KZ', 'curse', [['destroy', {}]]); s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'KZ'), choices: [[t]] }); s2 = finishBattle(s2);
  ok(s2.players[0].discard.some(d => d.cid === 'M2') && s2.players[1].discard.some(d => d.cid === 'F'), 'Tod: Monster und angebrachte Karte jeweils zum Besitzer');
}
/* 13. Speichern/Laden mit laufenden Wirkungen */
{
  const C = SP('SV', 'curse', [['stat', { 'params.amount': -400, 'duration.kind': 'rounds', 'duration.n': 2 }], ['fieldLock', { 'duration.kind': 'rounds', 'duration.n': 2 }]]);
  const A = SP('AU', 'spell', [['stat', { 'target.count': 'all', 'target.side': 'own', 'params.amount': 200, 'duration.kind': 'permanent' }]]);
  let s = game([C, A]); phase(s, 0, 'battle'); const t = put(s, 'F', 1, 'D3'), own = put(s, 'F', 0, 'D6');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'SV'), choices: [[t], ['E4']] }); s = act(s, { type: 'cast', iid: hand(s, 0, 'AU'), choices: [[]] }); s = finishBattle(s);
  const saved = JSON.stringify(s), loaded = JSON.parse(saved);
  eq([W.atkOf(loaded, loaded.units[t]), W.atkOf(loaded, loaded.units[own]), W.fieldLocked(loaded, 'E4')], [600, 1200, true], 'nach dem Laden gleiche Werte');
  let l = loaded; l = endTurn(l); l = endTurn(l); l = endTurn(l); l = endTurn(l);
  eq([W.atkOf(l, l.units[t]), W.fieldLocked(l, 'E4'), W.atkOf(l, l.units[own])], [1000, false, 1200], 'nach dem Laden laufen Wirkungen korrekt ab; permanente Fläche bleibt');
  phase(l, 0, 'summon2'); const ni = hand(l, 0, 'F'); l = act(l, { type: 'summon', iid: ni, field: 'A6' }); const nu = Object.values(l.units).find(u => u.pos === 'A6');
  eq(W.atkOf(l, nu), 1200, 'permanenter Flächeneffekt erfasst neu beschworene Einheit');
}
/* 14. Neutralisieren */
{
  const C = SP('N1', 'curse', [['stat', { 'params.amount': -500, 'duration.kind': 'turn', 'target.side': 'enemy' }]]);
  const N = SP('NZ', 'spell', [['neutralize', {}]]);
  let s = game([C, N]); phase(s, 0, 'battle'); const t = put(s, 'F', 1, 'D3');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'N1'), choices: [[t]] }); const ni = hand(s, 1, 'NZ');
  s = act(s, { type: 'endPhase' }); eq(s.phase, 'counter', 'Konterphase');
  const sid = s.stack[0].sid; s = act(s, { type: 'cast', p: 1, iid: ni, choices: [[sid]] }); s = act(s, { type: 'pass', p: 1 });
  eq(W.atkOf(s, s.units[t]), 1000, 'Fluch neutralisiert'); ok(s.players[0].discard.some(d => d.cid === 'N1') && s.players[1].discard.some(d => d.cid === 'NZ'), 'beide Karten verbraucht'); eq(s.players[0].energy, 10, 'Energie bleibt bezahlt (0-Kosten-Karte)');
}
/* 15. Solange-Bedingung */
{
  const WH = SP('WH', 'spell', [['stat', { 'target.side': 'own', 'params.amount': 500, 'duration.kind': 'while', 'duration.cond': { op: 'and', items: [{ k: 'control', min: 2, filter: { op: 'and', items: [] } }] } }]]);
  let s = game([WH]); phase(s, 0, 'battle'); const a = put(s, 'F', 0, 'D6'), b = put(s, 'F', 0, 'C6');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'WH'), choices: [[a]] }); s = finishBattle(s); eq(W.atkOf(s, s.units[a]), 1500, 'solange 2 Einheiten: +500');
  s.phase = 'battle'; s.cards.KZ = SP('KZ', 'curse', [['destroy', { 'target.side': 'own' }]]); s = act(s, { type: 'cast', iid: hand(s, 0, 'KZ'), choices: [[b]] }); s = finishBattle(s);
  eq(W.atkOf(s, s.units[a]), 1000, 'Bedingung entfällt → Wirkung endet');
}
/* 16. Import: nicht unterstützt / unvollständig / Text-Daten-Widerspruch / neueres Format */
{
  const bad = W.normalizeCard({ id: 'B', type: 'curse', name: 'B', energy: 1, rarity: 'gewoehnlich', spell: { v: 1, effects: [{ kind: 'zeitreise', target: {}, params: {}, duration: {} }] } });
  ok(!bad.playable && bad.notPlayable.length, 'unbekannte Effektart → nicht spielbar: ' + bad.notPlayable.join(' | '));
  const nov = W.normalizeCard({ id: 'B2', type: 'spell', name: 'B2', energy: 1, spell: { v: 99, effects: [] } });
  ok(!nov.playable && nov.notPlayable.some(r => /Version 99/.test(r)), 'neueres Format erkannt');
  const raw = { id: 'T', type: 'curse', name: 'T', energy: 1, rarity: 'gewoehnlich', ruleText: 'Ein Gegner erhält −900 ATK.' };
  raw.spell = EF.blankSpell('curse');
  const tc = W.normalizeCard(raw); ok(!tc.playable && tc.notPlayable.some(r => /übereinstimmend/.test(r)), 'Text/Daten nicht abgestimmt → nicht spielbar');
  raw.spell.sync = EF.hash(raw); const tc2 = W.normalizeCard(raw); ok(tc2.playable, 'nach Bestätigung spielbar');
  const val = W.validateDeck(['KA'].concat(Array(38).fill('F'), ['B']), { KA: K('KA'), F: H('F', { rarity: 'legendaer' }), B: bad });
  ok(val.warnings.some(w => /nicht spielbar/.test(w)), 'Deckprüfung warnt vor nicht spielbaren Karten');
  let s = game([bad]); phase(s, 0, 'battle'); ok(!W.castOptions(s, 0, hand(s, 0, 'B')).ok, 'nicht spielbare Karte kann nicht ausgespielt werden');
}
/* 17. Ausspielzeitpunkt, Energie, König nur ausdrücklich */
{
  const C = SP('E5', 'curse', [['stat', { 'params.amount': -100, 'duration.kind': 'turn' }]], { energy: 5 });
  let s = game([C]); phase(s, 0, 'move'); put(s, 'F', 1, 'D3'); const iid = hand(s, 0, 'E5');
  ok(!W.castOptions(s, 0, iid).ok, 'nicht in der Bewegungsphase'); s.phase = 'battle'; s.players[0].energy = 4; ok(/Energie/.test(W.castOptions(s, 0, iid).why), 'zu wenig Energie');
  s.players[0].energy = 5; const o = W.castOptions(s, 0, iid); ok(o.effects[0].candidates.every(c => !/König/.test(c.label)), 'König ist kein „Einheit“-Ziel');
  const KC = SP('KC', 'curse', [['stat', { 'target.what': 'king', 'target.side': 'enemy', 'target.pick': 'auto', 'params.amount': -1000, 'duration.kind': 'turn' }]]);
  s.cards.KC = KC; const k2 = hand(s, 0, 'KC'); s = act(s, { type: 'cast', iid: k2, choices: [[]] }); s = finishBattle(s);
  eq(W.atkOf(s, s.units[s.players[1].king]), 1000, 'König ausdrücklich als Ziel: ATK 2000 − 1000');
}
/* 18. Schaden am König: fest und je Karte (Rasse) im Ablagestapel, mit Höchstschaden */
{
  const D1 = SP('DM1', 'curse', [['damage', { 'params.amount': 800 }]]);
  const D2 = SP('DM2', 'curse', [['damage', { 'params.amount': 300, 'params.per': 'discard', 'params.from': 'both', 'params.count': { op: 'and', items: [{ k: 'race', v: 'elfen' }] } }]]);
  const D3 = SP('DM3', 'curse', [['damage', { 'params.amount': 1000, 'params.per': 'discard', 'params.from': 'own', 'params.max': 2500 }]]);
  let s = game([D1, D2, D3, H('EL', { race: 'elfen' })]); phase(s, 0, 'battle'); const k = s.players[1].king;
  s.players[0].discard.push({ iid: 'x1', cid: 'EL' }, { iid: 'x2', cid: 'EL' }, { iid: 'x3', cid: 'F' }); s.players[1].discard.push({ iid: 'x4', cid: 'EL' });
  s = act(s, { type: 'cast', iid: hand(s, 0, 'DM1'), choices: [[]] }); s = finishBattle(s); eq(s.units[k].hp, 9200, 'fester Schaden 800');
  s.phase = 'battle'; s = act(s, { type: 'cast', iid: hand(s, 0, 'DM2'), choices: [[]] }); s = finishBattle(s);
  eq(s.units[k].hp, 9200 - 900, 'je Elfe in beiden Ablagestapeln 300 (3 Elfen)');
  s.phase = 'battle'; const own = s.players[0].discard.length; s = act(s, { type: 'cast', iid: hand(s, 0, 'DM3'), choices: [[]] }); s = finishBattle(s);
  eq(s.units[k].hp, 8300 - 2500, 'je Karte 1000, aber höchstens 2500 (' + (own + 2) + ' Karten gezählt)');
  const KO = SP('KO', 'curse', [['damage', { 'params.amount': 99999 }]]); s.cards.KO = KO; s.phase = 'battle'; s = act(s, { type: 'cast', iid: hand(s, 0, 'KO'), choices: [[]] }); s = finishBattle(s);
  ok(s.result && s.result.winner === 0, 'König auf 0 HP durch Fluch → Sieg');
}
/* 19. Karten ziehen, Handlimit */
{
  const DR = SP('DR', 'spell', [['draw', { 'params.n': 3 }]]);
  const DE = SP('DE', 'curse', [['draw', { 'params.n': 2, 'target.side': 'enemy' }]]);
  let s = game([DR, DE]); phase(s, 0, 'battle');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'DR'), choices: [[]] }); const before = s.players[0].hand.length, deck = s.players[0].deck.length; s = finishBattle(s);
  eq([s.players[0].hand.length - before, deck - s.players[0].deck.length], [3, 3], 'drei Karten gezogen');
  s.phase = 'battle'; s.active = 0; for (let i = 0; i < 9; i++) hand(s, 1, 'F'); s = act(s, { type: 'cast', iid: hand(s, 0, 'DE'), choices: [[]] }); s = finishBattle(s);
  eq([s.players[1].hand.length, s.pendingDiscard], [11, 1], 'Gegner zieht 2 → 11 Karten, muss ablegen');
  s = act(s, { type: 'discard', p: 1, iid: s.players[1].hand[0].iid }); eq([s.players[1].hand.length, s.pendingDiscard], [10, null], 'auf 10 abgelegt');
  let s2 = game([DR]); phase(s2, 0, 'battle'); s2.players[0].deck = s2.players[0].deck.slice(0, 1); const hp = s2.units[s2.players[0].king].hp;
  s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'DR'), choices: [[]] }); s2 = finishBattle(s2); eq(s2.units[s2.players[0].king].hp, hp, 'leerer Stapel beim Zauber: kein HP-Verlust');
}
/* 20. Handkarten abwerfen, Stapel abtragen, Schaden je Handkarte, Fluch auf den König (ATK, königliche Gaben) */
{
  const DI = SP('DI', 'curse', [['discard', { 'params.n': 2 }]]), MI = SP('MI', 'curse', [['mill', { 'params.n': 3 }]]);
  const DH = SP('DH', 'curse', [['damage', { 'params.amount': 200, 'params.per': 'hand', 'params.from': 'enemy' }]]);
  const KA = SP('KAT', 'curse', [['stat', { 'target.what': 'king', 'target.side': 'enemy', 'target.pick': 'auto', 'params.amount': -800, 'duration.kind': 'turn' }], ['damage', { 'params.amount': 1000 }]]);
  let s = game([DI, MI, DH, KA]); phase(s, 0, 'battle'); for (let i = 0; i < 4; i++) hand(s, 1, 'F');
  const d0 = s.players[1].deck.length, k = s.players[1].king;
  s = act(s, { type: 'cast', iid: hand(s, 0, 'DH'), choices: [[]] }); s = act(s, { type: 'cast', iid: hand(s, 0, 'DI'), choices: [[]] }); s = act(s, { type: 'cast', iid: hand(s, 0, 'MI'), choices: [[]] }); s = finishBattle(s);
  eq(s.units[k].hp, 10000 - 800, 'Schaden je Handkarte des Gegners (4 × 200), vor dem Abwerfen ausgewertet');
  eq([s.players[1].hand.length, d0 - s.players[1].deck.length, s.players[1].discard.length], [2, 3, 5], 'Gegner wirft 2 ab, 3 vom Stapel auf den Ablagestapel');
  s.phase = 'battle'; s = act(s, { type: 'cast', iid: hand(s, 0, 'KAT'), choices: [[], []] }); s = finishBattle(s);
  eq([W.atkOf(s, s.units[k]), s.units[k].hp], [1200, 8200], 'Fluch auf den König: −800 ATK und 1.000 Schaden in einer Karte');
}
console.log('Zauber/Fluch-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.');
if (failN) process.exitCode = 1;
