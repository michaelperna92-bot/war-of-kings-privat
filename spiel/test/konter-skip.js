// 1.11.2026: Konterphase wird nur übersprungen, wenn der Verteidiger nichts tun kann (Zauber/Flüche brauchen Energie, Gaben nicht).
const W = require('../src/engine.js'); const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
const cards = {}; for (const c of DEMO.cards) { const n = W.normalizeCard(c); cards[n.id] = n; }
const heroes = Object.values(cards).filter(c => c.type === 'hero'), kings = Object.values(cards).filter(c => c.type === 'king'), spell = Object.values(cards).find(c => (c.type === 'spell' || c.type === 'curse') && c.playable && c.energy > 0);
const deck = k => [k].concat(heroes.slice(0, 13).flatMap(h => [h.id, h.id, h.id]));
function lage(energy, gift) {
  let s = W.newGame({ cards: JSON.parse(JSON.stringify(cards)), decks: [deck(kings[0].id), deck(kings[1].id)], seed: 5, fixedSides: true, mulligan: false }).state;
  for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
  const A = heroes[0], D = heroes[1]; s.cards[A.id].attack = { dirs: { n: 1, s: 1, w: 1, e: 1 } }; s.cards[D.id].gifts = gift ? [{ id: 'eisenpanzer' }] : [];
  s.units.a = { uid: 'a', cid: A.id, owner: 0, pos: 'D3', king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] };
  s.units.d = { uid: 'd', cid: D.id, owner: 1, pos: 'D2', king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] };
  s.players[1].hand = spell ? [{ iid: 'sp', cid: spell.id }] : []; s.players[1].energy = energy; s.players[1].reserve = energy;
  s.active = 0; s.phase = 'battle'; s.decl = {}; s.stack = [];
  let r = W.apply(s, { type: 'declare', p: 0, uid: 'a', targets: ['d'] }); if (r.error) { console.log('declare', r.error); return null; }
  r = W.apply(r.state, { type: 'endPhase', p: 0 }); return r;
}
let r = lage(0, false); ok(r && r.state.phase !== 'counter' && r.events.some(e => e.t === 'counterPass' && e.auto), '0 Energie, keine Gabe → Konter übersprungen');
r = lage(0, true); ok(r && r.state.phase === 'counter', '0 Energie, aber einsetzbare Heldengabe → Konterphase läuft: ' + (r && r.state.phase));
// Konter mit Zaubern/Flüchen und Energie: abgedeckt in test/spells.js und test/energiereserve.js
console.log('Konter-Überspringen: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0);
