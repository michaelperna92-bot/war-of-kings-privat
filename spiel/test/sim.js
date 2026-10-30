// KI gegen KI: viele Partien, prüft, dass nur legale Aktionen entstehen und jede Partie endet. Aufruf: node test/sim.js [Anzahl]
global.window = undefined;
const W = require('../src/engine.js'); globalThis.WOK = W;
const AI = require('../src/ai.js');
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const cards = {}; for (const c of DEMO.cards) { const n = W.normalizeCard(c); cards[n.id] = n; }
const N = +process.argv[2] || 200;
const stats = { games: 0, wins: [0, 0], draws: 0, turns: [], errors: 0, reasons: {}, levelWins: {} };
for (let g = 0; g < N; g++) {
  const lv = g % 3 === 0 ? ['leicht', 'mittel'] : g % 3 === 1 ? ['mittel', 'leicht'] : ['mittel', 'mittel'];
  let { state } = W.newGame({ cards, decks: [DEMO.decks.A, DEMO.decks.B], seed: 1000 + g });
  const memo = [{ seed: g * 7 + 1 }, { seed: g * 13 + 5 }];
  let steps = 0;
  while (!state.result && steps < 20000) {
    const p = state.pendingDiscard !== null ? state.pendingDiscard : state.phase === 'counter' ? state.counter : state.active;
    const deck = state.players[p].deckName === 'A' ? 0 : 1;
    const a = AI.decide(state, p, lv[deck], memo[p]);
    const r = W.apply(state, a);
    if (r.error) { stats.errors++; if (stats.errors < 6) console.log('Fehler:', r.error, JSON.stringify(a), state.phase); const r2 = W.apply(state, { type: 'endPhase', p }); if (r2.error) { console.log('hängt', r2.error); break; } state = r2.state; }
    else state = r.state;
    steps++;
  }
  stats.games++;
  if (!state.result) { console.log('Partie ' + g + ' endet nicht'); continue; }
  const res = state.result; stats.reasons[res.reason.replace(/von .*? hat|Deck [AB]/g, '…')] = (stats.reasons[res.reason.replace(/von .*? hat|Deck [AB]/g, '…')] || 0) + 1;
  if (res.draw) stats.draws++; else { stats.wins[res.winner]++; const lvw = lv[state.players[res.winner].deckName === 'A' ? 0 : 1]; const lvl = lv[state.players[1 - res.winner].deckName === 'A' ? 0 : 1]; if (lvw !== lvl) stats.levelWins[lvw] = (stats.levelWins[lvw] || 0) + 1; }
  stats.turns.push(state.turn);
}
const avg = stats.turns.reduce((a, b) => a + b, 0) / stats.turns.length;
console.log(JSON.stringify({ games: stats.games, wins: stats.wins, draws: stats.draws, avgTurns: avg.toFixed(1), errors: stats.errors, reasons: stats.reasons, levelWinsVsOther: stats.levelWins }, null, 1));
process.exit(stats.errors ? 1 : 0);
