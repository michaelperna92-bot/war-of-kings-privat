// Spielfeld mit 5 Reihen (Festlegung 31.10.2026): Felder, Könige, Beschwörung, Wachen, Laufen über die Mitte, Hälften, Angriffe.
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'); W.setLayout(5); // Test des früheren 5-Reihen-Feldes (Layout bleibt verfügbar)
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' – erwartet ' + JSON.stringify(b) + ', erhalten ' + JSON.stringify(a));
ok(W.ROWS === 5, '5-Reihen-Layout');
eq(W.FIELDS.length, 25, 'Felder: 3 + 7 + 5 + 7 + 3');
eq(W.KING_FIELD, ['D5', 'D1'], 'Könige');
eq(W.summonFields(0).sort(), ['A4', 'B4', 'C4', 'C5', 'D4', 'E4', 'E5', 'F4', 'G4'], 'Beschwörungsfelder unten: Reihe 4 + Wachen');
eq(W.summonFields(1).sort(), ['A2', 'B2', 'C1', 'C2', 'D2', 'E1', 'E2', 'F2', 'G2'], 'Beschwörungsfelder oben');
ok(W.exists('B3') && W.exists('F3') && !W.exists('A3') && !W.exists('G3') && !W.exists('D6') && !W.exists('D7'), 'Mittelreihe B–F, keine Reihen 6/7');
eq(W.step('D4', 'n', 0), 'D3', 'unten vorwärts: Beschwörungsreihe → Mitte'); eq(W.step('D3', 'n', 0), 'D2', 'Mitte → gegnerische Beschwörungsreihe');
eq(W.step('D2', 'n', 1), 'D3', 'oben vorwärts (Sicht Spieler 1)'); eq(W.step('A4', 'ne', 0), 'B3', 'diagonal in die Mitte'); ok(!W.exists(W.step('A4', 'n', 0)), 'A3 gibt es nicht');
const H = (id, o) => W.normalizeCard(Object.assign({ id, type: 'hero', name: id, rarity: 'gewoehnlich', energy: 1, atk: 1500, def: 1000, move: { dirs: { n: 1, e: 1, w: 1 }, showNumber: true, number: 2 }, attack: { dirs: { n: 1, ne: 1, nw: 1 } }, gifts: [] }, o));
const K = id => W.normalizeCard({ id, type: 'king', name: id, rarity: 'selten', atk: 2000, hp: 10000, attack: { dirs: { n: 1, ne: 1, nw: 1 } }, gifts: [] });
const cards = { KA: K('KA'), KB: K('KB'), F: H('F') };
let s = W.newGame({ cards, decks: [['KA'].concat(Array(39).fill('F')), ['KB'].concat(Array(39).fill('F'))], seed: 5, fixedSides: true, mulligan: false }).state;
ok(s.rows === 5 && W.kingOf(s, 0).pos === 'D5' && W.kingOf(s, 1).pos === 'D1', 'Partie: Könige auf D5 und D1');
for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
const put = (owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid: 'F', owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
s.active = 0; s.phase = 'move'; s.players[0].turns = 3;
const a = put(0, 'D4'); const r = Object.keys(W.reachable(s, a)).sort();
ok(r.includes('D3') && r.includes('D2') && !r.includes('D1'), '2 Schritte von der Beschwörungsreihe bis zur gegnerischen Beschwörungsreihe, nie auf den König: ' + r.join(','));
const g = put(0, 'C2'); ok(!Object.keys(W.reachable(s, g)).includes('C1'), 'gegnerisches Wachfeld nicht betretbar');
s.phase = 'battle'; const e = put(1, 'D2'); delete s.units[g]; s.units[a].pos = 'D3';
ok(W.targetsOf(s, a).some(t => t.uid === e), 'Angriff aus der Mitte auf die gegnerische Beschwörungsreihe');
s.units[a].pos = 'C2'; ok(W.targetsOf(s, a).some(t => t.uid === W.kingOf(s, 1).uid), 'von C2 diagonal auf den gegnerischen König');
eq(W.halfFields(0, 'own').map(f => +f.slice(1)).filter((x, i, l) => l.indexOf(x) === i).sort(), [4, 5], 'eigene Hälfte unten: Reihen 4–5');
eq(W.halfFields(0, 'enemy').map(f => +f.slice(1)).filter((x, i, l) => l.indexOf(x) === i).sort(), [1, 2], 'gegnerische Hälfte: Reihen 1–2 (Mitte gehört keinem)');
// Alte Spielstände (7 Reihen) werden nicht fehlerhaft weitergespielt
const old = JSON.parse(JSON.stringify(s)); delete old.rows; ok(/anderen Spielfeld/.test(W.apply(old, { type: 'endPhase' }).error || ''), 'alter Spielstand (7 Reihen): klare Meldung statt Fehlspiel');
console.log('Spielfeld-5-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0);
