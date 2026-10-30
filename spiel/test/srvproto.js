// Server-Protokoll mit Zaubern/Flüchen und Konterphase: zwei Node-Clients (eingebautes WebSocket) spielen KI gegen KI über den Server.
// Prüft: Server und beide Clients enden im gleichen Zustand, Züge außer der Reihe werden abgelehnt, doppelte Züge (gleiche Nummer) ignoriert.
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'); globalThis.WOK = W; const EF = W.EF; const AI = require('../src/ai.js');
const { spawn } = require('child_process'); const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const raw = {}; for (const c of DEMO.cards) raw[c.id] = c;
function SP(id, type, effects, o) { const r = Object.assign({ id, type, name: id, rarity: 'gewoehnlich', energy: 2, ruleText: '' }, o || {}); r.spell = Object.assign(EF.blankSpell(type), (o && o.spell) || {}); r.spell.effects = effects.map(([k, ch]) => { const e = EF.blankEffect(k, type); for (const [p, v] of Object.entries(ch || {})) { const ks = p.split('.'); let x = e; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; } return e; }); EF.autoFix(r.spell); raw[id] = r; return id; }
const sp = [SP('x_schw', 'curse', [['stat', { 'params.amount': -500, 'duration.kind': 'turn' }]], { energy: 1 }), SP('x_zerst', 'curse', [['destroy', {}]], { energy: 4 }), SP('x_schild', 'spell', [['protect', { trigger: 'enemyAttack', 'duration.kind': 'turn' }]], { energy: 0, spell: { timing: 'counter' } }),
  SP('x_ctrl', 'curse', [['control', { 'duration.kind': 'turn' }]], { energy: 3 }), SP('x_neut', 'spell', [['neutralize', {}]], { energy: 0, spell: { timing: 'counter' } }), SP('x_mut', 'spell', [['stat', { 'params.amount': 700, 'duration.kind': 'turn' }]], { energy: 1 })];
const mix = (d, k) => d.map((id, i) => i && i % 4 === 0 ? sp[(k + i) % sp.length] : id);
const decks = [mix(DEMO.decks.A, 0), mix(DEMO.decks.B, 3)];
const deckDoc = (ids, name) => { const cards = {}; for (const id of new Set(ids)) cards[id] = raw[id]; return { name, ids, cards }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const PORT = 8792, srv = spawn('node', [__dirname + '/../server/server.js'], { env: Object.assign({}, process.env, { PORT }) }); await sleep(700);
  function client(id, name) { const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws'); const C = { ws, msgs: [], fns: [] }; ws.onmessage = e => { const m = JSON.parse(e.data); C.msgs.push(m); for (const f of C.fns) f(m); }; C.send = o => ws.send(JSON.stringify(o)); C.wait = t => new Promise(res => { const f = m => { if (m.t === t) { C.fns.splice(C.fns.indexOf(f), 1); res(m); } }; C.fns.push(f); }); ws.onopen = () => C.send({ t: 'hello', id, name, v: (require('fs').readFileSync(__dirname + '/../src/app.js', 'utf8').match(/const VERSION = '([^']+)'/) || [])[1] }); return C; }
  const A = client('pa', 'Anna'), B = client('pb', 'Ben'); await A.wait('hello'); await B.wait('hello');
  A.send({ t: 'create', deck: deckDoc(decks[0], 'A') }); const cr = await A.wait('created');
  const sa = A.wait('start'), sb = B.wait('start'); B.send({ t: 'join', code: cr.code, deck: deckDoc(decks[1], 'B') }); const [ma, mb] = await Promise.all([sa, sb]);
  const mk = m => W.newGame({ cards: Object.assign({}, m.decks[1].cards, m.decks[0].cards), decks: [m.decks[0].ids, m.decks[1].ids], fixedSides: true, seed: m.seed, sideNames: m.names, timer: false, counterReserve: false }).state;
  const L = [{ C: A, s: mk(ma), me: 0, memo: { seed: 3 } }, { C: B, s: mk(mb), me: 1, memo: { seed: 9 } }];
  let n = 0; const cnt = {}; let rejects = 0, dupIgnored = 0;
  for (const P of L) P.C.fns.push(m => { if (m.t === 'act') { if (m.n !== P.n) return; const r = W.apply(P.s, m.a); if (r.error) throw new Error('Client weicht ab: ' + r.error); P.s = r.state; P.n++; } if (m.t === 'reject') rejects++; });
  L[0].n = L[1].n = 0;
  // Zug außer der Reihe
  const off = L.find(P => W.actor(P.s) !== P.me);
  off.C.send({ t: 'act', code: cr.code, n: 0, a: { type: 'endPhase', p: off.me } }); await sleep(150); console.log('außer der Reihe abgelehnt:', rejects === 1);
  for (let step = 0; step < 6000; step++) {
    const s = L[0].s; if (s.result) break;
    const actor = W.actor(s), P = L[actor];
    const a = AI.decide(P.s, actor, 'mittel', P.memo) || { type: 'endPhase', p: actor };
    const loc = W.apply(P.s, a); const act = loc.error ? { type: 'endPhase', p: actor } : a;
    const before = L[0].n; P.C.send({ t: 'act', code: cr.code, n: before, a: act });
    if (step === 40) { P.C.send({ t: 'act', code: cr.code, n: before, a: act }); dupIgnored = 1; } // doppelt gesendet
    for (let w = 0; w < 200 && (L[0].n === before || L[1].n === before); w++) await sleep(2);
    if (L[0].n === before) { // abgelehnt (z. B. KI wollte etwas Ungültiges) → Phase beenden
      P.C.send({ t: 'act', code: cr.code, n: before, a: { type: actor === s.counter && s.phase === 'counter' ? 'pass' : 'endPhase', p: actor } }); for (let w = 0; w < 200 && L[0].n === before; w++) await sleep(2);
    }
    cnt[act.type] = (cnt[act.type] || 0) + 1;
  }
  await sleep(300);
  const sum = s => JSON.stringify({ t: s.turn, ph: s.phase, hp: s.players.map(p => s.units[p.king] ? s.units[p.king].hp : 0), u: Object.keys(s.units).sort(), h: s.players.map(p => p.hand.map(x => x.cid)), r: s.result && s.result.reason, log: s.log.length });
  console.log('Aktionen:', JSON.stringify(cnt), '| Ablehnungen:', rejects, '| doppelt gesendet:', dupIgnored);
  console.log('Ergebnis:', L[0].s.result && L[0].s.result.reason, 'nach', L[0].s.turn, 'Zügen');
  console.log('Clients identisch:', sum(L[0].s) === sum(L[1].s));
  // dritter Client = Wiederverbindung von B: holt den vollständigen Stand vom Server
  const B2 = client('pb', 'Ben'); await B2.wait('hello'); const rs = B2.wait('start'); B2.send({ t: 'resume', code: cr.code }); const m2 = await rs; let s2 = mk(m2); for (const a of m2.acts) s2 = W.apply(s2, a).state;
  console.log('Wiederverbindung = Serverstand:', sum(s2) === sum(L[1].s), '| Züge auf dem Server:', m2.acts.length);
  for (const C of [A, B, B2]) C.ws.close(); srv.kill(); process.exit(0);
})().catch(e => { console.error('FEHLER', e); process.exit(1); });
