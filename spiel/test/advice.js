// Spielhilfe über viele Spielstände: keine Fehler, sinnvolle Hinweise
const W = require('../src/engine.js'); globalThis.WOK = W; const AI = require('../src/ai.js'); globalThis.WOK_AI = AI; const ADV = require('../src/advisor.js');
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const cards = {}; for (const c of DEMO.cards) { const n = W.normalizeCard(c); cards[n.id] = n; }
const seen = {}; let n = 0, errs = 0;
for (let g = 0; g < 6; g++) {
  let { state } = W.newGame({ cards, decks: [DEMO.decks.A, DEMO.decks.B], seed: 300 + g }); const m = [{ seed: 1 }, { seed: 2 }];
  while (!state.result) {
    const p = state.pendingDiscard !== null ? state.pendingDiscard : state.phase === 'counter' ? state.counter : state.active;
    try { for (const x of ADV.missed(state, p)) { n++; const k = state.phase + ':' + x.text.replace(/„[^“]*“/g, '„…“').replace(/\d[\d.]*/g, '#').replace(/[A-G]\d/g, 'F'); seen[k] = (seen[k] || 0) + 1; } } catch (e) { errs++; if (errs < 3) console.log(e); }
    state = W.apply(state, AI.decide(state, p, 'leicht', m[p])).state;
  }
}
console.log('Hinweise:', n, 'Fehler:', errs); for (const [k, v] of Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(v, k);
