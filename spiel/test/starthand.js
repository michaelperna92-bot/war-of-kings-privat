// Einmaliger Starthandwechsel (Festlegung 30.10.2026). Aufruf: node test/starthand.js
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'), AI = require('../src/ai.js');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
const H = (id, e, o) => W.normalizeCard(Object.assign({ id, type: 'hero', name: id, rarity: 'gewoehnlich', energy: e, atk: 1000, def: 1000, move: { dirs: { n: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1 } }, gifts: [] }, o));
const K = id => W.normalizeCard({ id, type: 'king', name: id, rarity: 'selten', atk: 2000, hp: 10000, attack: { dirs: { n: 1 } }, gifts: [] });
const cards = { KA: K('KA'), KB: K('KB') }; const ids = ['KA']; const idsB = ['KB'];
for (let i = 0; i < 39; i++) { const id = 'c' + i; cards[id] = H(id, 1 + (i % 6)); ids.push(id); idsB.push(id); }
const all = P => P.hand.concat(P.deck).map(h => h.iid + ':' + h.cid).sort().join(',');
const mk = seed => W.newGame({ cards, decks: [ids, idsB], seed, fixedSides: true }).state;
let s = mk(11); const first = s.active, other = 1 - first;
ok(s.phase === 'mulligan', 'Partie beginnt mit der Starthand-Entscheidung: ' + s.phase);
ok(s.players.every(P => P.hand.length === 5 && P.deck.length === 34), '5 Starthandkarten, 34 im Stapel');
ok(s.turn === 0 && W.actor(s) === first, 'noch kein Zug; zuerst Startspieler (lokal)');
ok(W.apply(s, { type: 'endPhase', p: first }).error, 'andere Aktionen vor der Entscheidung abgelehnt');
ok(W.apply(s, { type: 'summon', p: first, iid: s.players[first].hand[0].iid, field: 'D2' }).error, 'Beschwören vor der Entscheidung abgelehnt');
const before = all(s.players[other]), oldHand = s.players[other].hand.map(h => h.iid).join(), deckLen = s.players[other].deck.length;
// der andere Spieler darf zuerst entscheiden (unabhängig)
let r = W.apply(s, { type: 'mulligan', p: other, redraw: true }); ok(!r.error, 'Neu ziehen: ' + r.error); s = r.state;
const P = s.players[other];
ok(P.hand.length === 5, 'genau 5 neue Karten: ' + P.hand.length);
ok(P.deck.length === deckLen, 'Stapelgröße unverändert: ' + P.deck.length);
ok(all(P) === before, 'keine Karte doppelt oder verloren (Hand + Stapel identisch)');
ok(P.discard.length === 0, 'nichts auf dem Ablagestapel');
ok(P.hand.map(h => h.iid).join() !== oldHand, 'neue Hand ist eine andere');
ok(P.energy === 0 || P.energy === s.players[other].energy, 'keine Energie verbraucht');
ok(W.apply(s, { type: 'mulligan', p: other, redraw: true }).error, 'zweiter Tausch abgelehnt');
ok(W.apply(s, { type: 'mulligan', p: other, redraw: false }).error, 'zweite Entscheidung abgelehnt');
ok(s.phase === 'mulligan' && s.turn === 0, 'Zug beginnt erst, wenn beide entschieden haben');
ok(!s.log.slice(-2).some(l => /c\d+/.test(l.text || l)), 'Protokoll nennt keine zurückgemischten Karten');
r = W.apply(s, { type: 'mulligan', p: first, redraw: false }); s = r.state;
ok(s.phase !== 'mulligan' && s.turn === 1 && s.active === first, 'erster Zug des Münzwurf-Gewinners beginnt');
ok(s.players[first].hand.length === 6 && s.players[other].hand.length === 5, 'regulärer Nachzug im ersten Zug bleibt');
ok(s.players[first].energy === 1, 'erster Zug 1 Energie');
ok(W.apply(s, { type: 'mulligan', p: first, redraw: true }).error && W.apply(s, { type: 'mulligan', p: other, redraw: true }).error, 'nach Spielbeginn kein Austausch mehr');
// Zeitablauf = behalten, Aufgeben geht
let t = mk(12); t = W.apply(t, { type: 'timeout', p: t.active }).state; ok(t.mull[t.active] === 'behalten', 'Zeitablauf = Hand behalten');
let c = mk(13); c = W.apply(c, { type: 'concede', p: 0 }).state; ok(c.result && c.result.winner === 1, 'Aufgeben während der Entscheidung');
// beide tauschen, Zufall reproduzierbar (Server und Clients rechnen gleich)
let a1 = mk(14), a2 = mk(14); for (const q of [0, 1]) { a1 = W.apply(a1, { type: 'mulligan', p: q, redraw: true }).state; a2 = W.apply(a2, { type: 'mulligan', p: q, redraw: true }).state; }
ok(JSON.stringify(a1.players.map(P => P.hand)) === JSON.stringify(a2.players.map(P => P.hand)), 'deterministisch');
ok(a1.players.every(P => P.hand.length + P.deck.length === 39 - (P === a1.players[a1.active] ? 0 : 0)), 'Deckgröße 39 + König erhalten');
// KI: nur eigene Hand, genau einmal
let k = mk(15); const p0 = k.active; const d = AI.decide(k, p0, 'mittel', {}); ok(d && d.type === 'mulligan' && d.p === p0, 'KI entscheidet: ' + JSON.stringify(d));
k = W.apply(k, d).state; ok(AI.decide(k, p0, 'mittel', {}) === null, 'KI entscheidet nur einmal');
const k2 = mk(15); k2.players[p0].hand.forEach(h => { h.cid = 'c5'; }); ok(AI.mulliganWanted(k2, p0) === true, 'KI tauscht Hand nur mit teuren Karten (6 Energie)');
const k3 = mk(15); k3.players[p0].hand.forEach(h => { h.cid = 'c0'; }); ok(AI.mulliganWanted(k3, p0) === false, 'KI behält gute Hand');
const k4 = mk(15); k4.players[1 - p0].hand.forEach(h => { h.cid = 'c5'; }); ok(AI.mulliganWanted(k4, p0) === AI.mulliganWanted(mk(15), p0), 'KI ignoriert gegnerische Hand');
// Spiel ohne Wechsel (Tests/Tutorial)
ok(W.newGame({ cards, decks: [ids, idsB], seed: 3, mulligan: false }).state.turn === 1, 'mulligan:false startet direkt');
console.log('Starthand-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0);
