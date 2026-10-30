// Deck-KI: baut gültige Decks, Analyse liefert Hinweise, gebautes Deck schlägt ein Zufallsdeck
const W = require('../src/engine.js'); globalThis.WOK = W; const AI = require('../src/ai.js'); const DB = require('../src/deckbuilder.js');
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const cards = {}; for (const c of DEMO.cards) { const n = W.normalizeCard(c); cards[n.id] = n; }
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FEHLER:', m); } };
for (const style of Object.keys(DB.STYLES)) { const r = DB.build(cards, { style }); ok(r.ok, 'Stil ' + style + ' ungültig: ' + JSON.stringify(r.validation)); console.log(style, '→', r.king.name, r.why.join(' / ')); }
const rep = DB.repair([DEMO.decks.A[0], DEMO.decks.A[1], DEMO.decks.A[1], DEMO.decks.A[1], DEMO.decks.A[1], DEMO.decks.A[1]], cards, {});
ok(rep.ok && rep.ids.filter(x => x === DEMO.decks.A[1]).length <= 4, 'Reparatur hält Kopienlimit nicht ein');
const a = DB.analyze(DEMO.decks.A, cards); console.log('Analyse Demo A:', a.curveText, '| Tipps:', a.tips.length);
console.log(DB.cardLine(cards[DEMO.decks.A[0]]), '\n' + DB.cardLine(cards[DEMO.decks.A[5]]));
// Zufallsdeck gleicher Sammlung
function randomDeck(seed) { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const ks = Object.values(cards).filter(c => c.type === 'king'), hs = Object.values(cards).filter(c => c.type === 'hero'); const ids = [ks[Math.floor(r() * ks.length)].id], cnt = {}; while (ids.length < 40) { const c = hs[Math.floor(r() * hs.length)]; if ((cnt[c.id] || 0) < (W.COPY_LIMIT[c.rarity] || 1)) { ids.push(c.id); cnt[c.id] = (cnt[c.id] || 0) + 1; } } return ids; }
const built = DB.build(cards, { style: 'ausgewogen' }).ids; let w = 0, n = 0;
for (let g = 0; g < 24; g++) {
  let { state } = W.newGame({ cards, decks: [built, randomDeck(77 + g)], seed: 500 + g, fixedSides: true }); const m = [{ seed: 1 }, { seed: 2 }];
  while (!state.result) { const p = W.actor(state); state = W.apply(state, AI.decide(state, p, 'mittel', m[p])).state; }
  n++; if (state.result.winner === 0) w++;
}
console.log('KI-Deck gewinnt gegen Zufallsdecks:', w, 'von', n);
process.exit(fail ? 1 : 0);
