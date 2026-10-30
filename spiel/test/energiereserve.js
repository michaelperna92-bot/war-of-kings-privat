// Festlegung 30.10.2026: Restenergie bleibt nach dem eigenen Zugende für die gegnerische Konterphase. Aufruf: node test/energiereserve.js
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'), EF = W.EF;
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
const H = (id, o) => W.normalizeCard(Object.assign({ id, type: 'hero', name: id, rarity: 'gewoehnlich', energy: 1, atk: 1000, def: 1000, move: { dirs: { n: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1 } }, gifts: [] }, o));
const K = id => W.normalizeCard({ id, type: 'king', name: id, rarity: 'selten', atk: 2000, hp: 10000, attack: { dirs: { n: 1 } }, gifts: [] });
const raw = { id: 'P3', type: 'spell', name: 'P3', rarity: 'gewoehnlich', energy: 3, ruleText: '' }; raw.spell = EF.blankSpell('spell');
raw.spell.effects = [EF.blankEffect('protect', 'spell')]; raw.spell.effects[0].duration.kind = 'turn'; EF.autoFix(raw.spell); const P3 = W.normalizeCard(raw);
const cards = { KA: K('KA'), KB: K('KB'), F: H('F'), A: H('A', { atk: 3000 }), P3 };
let s = W.newGame({ cards, decks: [['KA'].concat(Array(39).fill('F')), ['KB'].concat(Array(39).fill('F'))], seed: 7, fixedSides: true }).state;
ok(s.counterReserve === true, 'Regel ist immer aktiv (auch ohne Option)');
const s2 = W.newGame({ cards, decks: [['KA'].concat(Array(39).fill('F')), ['KB'].concat(Array(39).fill('F'))], seed: 7, fixedSides: true, counterReserve: false }).state;
ok(s2.counterReserve === true, 'auch online/Server (counterReserve:false wird ignoriert)');
// Spieler 1 hat 5 Energie, beendet seinen Zug über die normalen Phasen
for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
s.active = 1; s.phase = 'summon2'; s.counter = null; s.pendingDiscard = null; s.players[1].energy = 5; s.players[1].turns = 5; s.players[0].turns = 5;
s.players[1].hand = [{ iid: 'hP', cid: 'P3' }];
let g = 0; while (s.active === 1 && g++ < 20) { const r = W.apply(s, { type: 'endPhase' }); if (r.error) { console.log('endPhase:', r.error, s.phase); break; } s = r.state; }
ok(s.active === 0, 'Zug an Spieler 0 übergeben');
ok(s.players[1].energy === 5, 'Restenergie bleibt nach Zugende: ' + s.players[1].energy);
// Spieler 0 greift an → Spieler 1 kontert mit 3 Energie
while (s.phase !== 'battle' && g++ < 40) { if (s.pendingDiscard) break; const r = W.apply(s, { type: 'endPhase' }); if (r.error) { console.log('endPhase:', r.error, s.phase); break; } s = r.state; }
const a = 'u' + (s.nextId++), t = 'u' + (s.nextId++);
s.units[a] = { uid: a, cid: 'A', owner: 0, pos: 'D5', king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] };
s.units[t] = { uid: t, cid: 'F', owner: 1, pos: 'D4', king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] };
ok(s.phase === 'battle', 'Battlephase des Gegners erreicht: ' + s.phase);
s = W.apply(s, { type: 'declare', uid: a, targets: [t] }).state; s = W.apply(s, { type: 'endPhase' }).state;
ok(s.phase === 'counter', 'Konterphase möglich (Energie 5): ' + s.phase);
let r = W.apply(s, { type: 'cast', p: 1, iid: 'hP', choices: [[t]] }); ok(!r.error, 'Konter mit 3 Energie: ' + r.error); s = r.state || s;
ok(s.players[1].energy === 2, 'Energie bezahlt: ' + s.players[1].energy);
s = W.apply(s, { type: 'pass', p: 1 }).state; ok(s.units[t], 'Konter hat geschützt');
ok(s.players[1].energy === 0, 'Rest verfällt nach der Schadensberechnung');
g = 0; while (s.active === 0 && g++ < 20) { const r2 = W.apply(s, { type: 'endPhase' }); if (r2.error) break; s = r2.state; }
ok(s.active === 1 && s.players[1].energy === Math.min(s.players[1].turns, 10), 'eigener Zug: normal aufgefüllt, kein Ansparen: ' + s.players[1].energy);
console.log('Energie-Reserve-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0);
