// Starthandwechsel über den Spielserver: beide gleichzeitig, Wiederverbindung, kein doppelter Tausch. Aufruf: node test/srvstarthand.js
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'); const { spawn } = require('child_process'); const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const raw = {}; for (const c of DEMO.cards) raw[c.id] = c;
const deckDoc = (ids, name) => { const cards = {}; for (const id of new Set(ids)) cards[id] = raw[id]; return { name, ids, cards }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
(async () => {
  const PORT = 8794, srv = spawn('node', [__dirname + '/../server/server.js'], { env: Object.assign({}, process.env, { PORT, WOK_DATA_DIR: '/tmp/claude-0/srvsh' }) }); await sleep(700);
  function client(id, name) { const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws'); const C = { ws, msgs: [], fns: [] }; ws.onmessage = e => { const m = JSON.parse(e.data); C.msgs.push(m); for (const f of C.fns) f(m); }; C.send = o => ws.send(JSON.stringify(o)); C.wait = t => new Promise(res => { const f = m => { if (m.t === t) { C.fns.splice(C.fns.indexOf(f), 1); res(m); } }; C.fns.push(f); }); ws.onopen = () => C.send({ t: 'hello', id, name, v: (require('fs').readFileSync(__dirname + '/../src/app.js', 'utf8').match(/const VERSION = '([^']+)'/) || [])[1] }); return C; }
  const A = client('sa', 'Anna'), B = client('sb', 'Ben'); await A.wait('hello'); await B.wait('hello');
  A.send({ t: 'create', deck: deckDoc(DEMO.decks.A, 'A') }); const cr = await A.wait('created');
  const pa = A.wait('start'), pb = B.wait('start'); B.send({ t: 'join', code: cr.code, deck: deckDoc(DEMO.decks.B, 'B') }); const [ma] = await Promise.all([pa, pb]);
  const mk = m => { let s = W.newGame({ cards: Object.assign({}, m.decks[1].cards, m.decks[0].cards), decks: [m.decks[0].ids, m.decks[1].ids], fixedSides: true, seed: m.seed, sideNames: m.names, timer: false }).state; for (const a of m.acts) s = W.apply(s, a).state; return s; };
  let s = mk(ma); ok(s.phase === 'mulligan', 'Online-Partie beginnt mit Starthand-Entscheidung');
  // beide schicken gleichzeitig mit derselben Nummer → einer kommt durch, der andere bekommt „veraltet“ und schickt neu
  const rejA = [], rejB = []; A.fns.push(m => m.t === 'reject' && rejA.push(m)); B.fns.push(m => m.t === 'reject' && rejB.push(m));
  A.send({ t: 'act', code: cr.code, n: 0, a: { type: 'mulligan', p: 0, redraw: true } }); B.send({ t: 'act', code: cr.code, n: 0, a: { type: 'mulligan', p: 1, redraw: true } });
  await sleep(300); const late = rejA.length ? A : B, lp = late === A ? 0 : 1;
  ok(rejA.length + rejB.length === 1 && (rejA[0] || rejB[0]).error === 'veraltet', 'zweiter gleichzeitiger Wunsch: veraltet (Client schickt neu)');
  // Verbindungsabbruch des späteren Spielers, dann Wiederaufnahme und Neusenden
  late.ws.close(); await sleep(200);
  const L2 = client(lp ? 'sb' : 'sa', 'x'); await L2.wait('hello'); const rs = L2.wait('start'); L2.send({ t: 'resume', code: cr.code }); const m2 = await rs;
  let s2 = mk(m2); ok(W.mulliganOpen(s2, lp), 'nach Wiederverbindung: Entscheidung noch offen');
  const rej2 = []; L2.fns.push(m => m.t === 'reject' && rej2.push(m));
  L2.send({ t: 'act', code: cr.code, n: m2.acts.length, a: { type: 'mulligan', p: lp, redraw: true } }); await sleep(300);
  // nochmal (z. B. doppelter Klick nach Abbruch) → abgelehnt
  L2.send({ t: 'act', code: cr.code, n: m2.acts.length + 1, a: { type: 'mulligan', p: lp, redraw: true } }); await sleep(300);
  ok(rej2.length === 1, 'doppelter Tausch abgelehnt: ' + JSON.stringify(rej2.map(r => r.error)));
  const other = late === A ? B : A; other.send({ t: 'act', code: cr.code, n: 2, a: { type: 'mulligan', p: 1 - lp, redraw: false } }); await sleep(300);
  const L3 = client('sz', 'y'); await L3.wait('hello'); // fremder Client darf nicht entscheiden
  const fin = L2.wait('start'); L2.send({ t: 'resume', code: cr.code }); const m3 = await fin; const s3 = mk(m3);
  ok(m3.acts.filter(a => a.type === 'mulligan').length === 2, 'genau zwei Entscheidungen auf dem Server');
  ok(s3.phase !== 'mulligan' && s3.turn === 1, 'erster Zug beginnt nach beiden Entscheidungen: ' + s3.phase);
  ok(s3.players.every(P => P.hand.length + P.deck.length + P.discard.length === 39), 'keine Karte verloren/dupliziert');
  ok(s3.players[s3.active].hand.length === 6, 'Startspieler zieht wie bisher im ersten Zug');
  // alte Version (ohne v) bekommt eine klare Meldung statt einer hängenden Partie
  const old = new WebSocket('ws://127.0.0.1:' + PORT + '/ws'); const om = []; old.onmessage = e => om.push(JSON.parse(e.data)); await new Promise(r => old.onopen = r);
  old.send(JSON.stringify({ t: 'hello', id: 'alt', name: 'Alt' })); await sleep(100); old.send(JSON.stringify({ t: 'join', code: cr.code, deck: deckDoc(DEMO.decks.B, 'B') })); await sleep(200);
  ok(om.some(m => m.t === 'error' && m.code === 'version' && /Spielversion/.test(m.msg)), 'alte Version: Hinweis auf neue Version');
  console.log('Server-Starthand-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); srv.kill(); process.exit(failN ? 1 : 0);
})();
