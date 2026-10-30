// KI gegen KI mit Zauber- und Fluchkarten: nur legale Aktionen, jede Partie endet, Zauber werden genutzt. Aufruf: node test/spellsim.js [Anzahl]
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'); globalThis.WOK = W; const EF = W.EF;
const AI = require('../src/ai.js');
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const cards = {}; for (const c of DEMO.cards) { const n = W.normalizeCard(c); cards[n.id] = n; }
function SP(id, type, effects, o) {
  const raw = Object.assign({ id, type, name: id, rarity: 'gewoehnlich', energy: 2, ruleText: '' }, o || {});
  raw.spell = Object.assign(EF.blankSpell(type), (o && o.spell) || {});
  raw.spell.effects = effects.map(([k, ch]) => { const e = EF.blankEffect(k, type); for (const [p, v] of Object.entries(ch || {})) { const ks = p.split('.'); let x = e; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; } return e; });
  EF.autoFix(raw.spell); const n = W.normalizeCard(raw); if (!n.playable) throw new Error(id + ': ' + n.notPlayable.join(' ')); return n;
}
const spells = [
  SP('s_schw', 'curse', [['stat', { 'params.amount': -500, 'duration.kind': 'turn' }]], { energy: 1 }),
  SP('s_gift', 'curse', [['status', { 'params.status': 'poison' }]], { energy: 3 }),
  SP('s_zerst', 'curse', [['destroy', {}]], { energy: 5 }),
  SP('s_bann', 'curse', [['moveBlock', { 'duration.kind': 'rounds', 'duration.n': 2 }], ['giftBlock', { 'params.gifts': 'all', 'duration.kind': 'rounds', 'duration.n': 2 }]], { energy: 2 }),
  SP('s_feld', 'curse', [['fieldLock', { 'target.count': 'n', 'target.n': 2, 'duration.kind': 'rounds', 'duration.n': 1 }]], { energy: 1 }),
  SP('s_mut', 'spell', [['stat', { 'params.amount': 700, 'duration.kind': 'turn' }]], { energy: 1 }),
  SP('s_schild', 'spell', [['protect', { trigger: 'enemyAttack', 'duration.kind': 'turn' }]], { energy: 0, spell: { timing: 'counter' } }),
  SP('s_leben', 'spell', [['revive', { 'params.place': 'auto' }]], { energy: 4 }),
  SP('s_heil', 'spell', [['heal', { 'params.amount': 2000 }]], { energy: 2 }),
  SP('s_wall', 'spell', [['deathWard', { 'target.count': 'all', 'duration.kind': 'turn' }]], { energy: 3 }),
  SP('s_neut', 'spell', [['neutralize', {}]], { energy: 0, spell: { timing: 'counter' } }),
  SP('s_dmg', 'curse', [['damage', { 'params.amount': 300, 'params.per': 'discard', 'params.from': 'both', 'params.max': 3000 }]], { energy: 3 }),
  SP('s_kdmg', 'curse', [['damage', { 'params.amount': 1200 }], ['stat', { 'target.what': 'king', 'target.pick': 'auto', 'params.amount': -500, 'duration.kind': 'turn' }]], { energy: 4 }),
  SP('s_draw', 'spell', [['draw', { 'params.n': 2 }]], { energy: 2 }),
  SP('s_disc', 'curse', [['discard', { 'params.n': 1 }], ['mill', { 'params.n': 2 }]], { energy: 2 })
];
spells.push(SP('s_ctrl', 'curse', [['control', { 'duration.kind': 'rounds', 'duration.n': 1 }]], { energy: 3 }),
  SP('s_ctrlp', 'curse', [['control', { 'duration.kind': 'permanent', 'params.lock': false }]], { energy: 5, spell: { cost: { hp: 1000, discard: 0 } } }),
  SP('s_opfer', 'curse', [['damage', { 'params.amount': 2500 }]], { energy: 1, spell: { cost: { hp: 1200, discard: 1 }, timing: 'battle' } }),
  SP('s_all', 'curse', [['stat', { 'target.side': 'both', 'target.count': 'all', 'params.amount': -400, 'duration.kind': 'turn' }]], { energy: 1, spell: { require: { op: 'and', items: [{ k: 'fieldAny', min: 3, filter: { op: 'and', items: [] } }] } } }));
for (const c of spells) cards[c.id] = c;
const mix = (deck, k0) => { const d = deck.slice(); const out = [d[0]]; let k = k0 || 0; for (let i = 1; i < d.length; i++) out.push(i % 3 === 0 ? spells[(k++) % spells.length].id : d[i]); return out; };
const DA = mix(DEMO.decks.A, 6), DB = mix(DEMO.decks.B, 13);
const N = +process.argv[2] || 40;
const st = { games: 0, wins: [0, 0], draws: 0, errors: 0, casts: {}, counter: 0, turns: [] };
for (let g = 0; g < N; g++) {
  const lv = g % 2 ? ['mittel', 'leicht'] : ['mittel', 'mittel'];
  let { state } = W.newGame({ cards, decks: [DA, DB], seed: 500 + g, counterReserve: g % 3 === 0 });
  const memo = [{ seed: g * 7 + 1 }, { seed: g * 13 + 5 }]; let steps = 0;
  while (!state.result && steps < 20000) {
    const p = W.actor(state);
    const a = AI.decide(state, p, lv[p], memo[p]);
    const r = W.apply(state, a);
    if (r.error) { st.errors++; if (st.errors < 6) console.log('Fehler:', r.error, JSON.stringify(a).slice(0, 200), state.phase); const r2 = W.apply(state, state.phase === 'counter' ? { type: 'pass', p } : { type: 'endPhase', p }); if (r2.error) { console.log('hängt', r2.error); break; } state = r2.state; }
    else { if (a.type === 'cast') { const cid = state.players[p].hand.find(h => h.iid === a.iid).cid; st.casts[cid] = (st.casts[cid] || 0) + 1; if (state.phase === 'counter') st.counter++; } state = r.state; }
    steps++;
  }
  // Speichern/Laden mitten in der Partie darf nichts ändern
  const re = JSON.parse(JSON.stringify(state)); if (JSON.stringify(re) !== JSON.stringify(state)) st.errors++;
  st.games++; if (!state.result) { console.log('Partie ' + g + ' endet nicht'); continue; }
  if (state.result.draw) st.draws++; else st.wins[state.result.winner]++; st.turns.push(state.turn);
}
console.log(JSON.stringify({ games: st.games, wins: st.wins, draws: st.draws, errors: st.errors, avgTurns: (st.turns.reduce((a, b) => a + b, 0) / st.turns.length).toFixed(1), counterCasts: st.counter, casts: st.casts }, null, 1));
if (st.errors) process.exitCode = 1;
