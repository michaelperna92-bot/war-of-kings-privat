// Fehlerfall vom 30.10.2026: „Todesapperatur“ (Fluch, Auslöser gegnerischer Angriff, Ziel gegnerischer Held) war nicht wirkbar.
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'), EF = W.EF, D = global.WOK_DATA, fs = require('fs'), zip = require('path').join(__dirname, '..', 'server', 'data', 'offiziell.wokspiel');
W.setLayout(7); // Regeltests mit festen Feldern des früheren 7-Reihen-Feldes (Mechanik unverändert); das 5-Reihen-Feld prüft test/feld5.js
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
// Originaldaten der Karten aus dem offiziellen Paket (ohne Bilder)
const buf = fs.readFileSync(zip); const { inflateRawSync } = require('zlib');
function entry(name) { let i = buf.length - 22; while (buf.readUInt32LE(i) !== 0x06054b50) i--; let o = buf.readUInt32LE(i + 16); const n = buf.readUInt16LE(i + 10);
  for (let k = 0; k < n; k++) { const m = buf.readUInt16LE(o + 10), sz = buf.readUInt32LE(o + 20), fl = buf.readUInt16LE(o + 28), ex = buf.readUInt16LE(o + 30), cm = buf.readUInt16LE(o + 32), lo = buf.readUInt32LE(o + 42), nm = buf.toString('utf8', o + 46, o + 46 + fl);
    if (nm === name) { const lfl = buf.readUInt16LE(lo + 26), lex = buf.readUInt16LE(lo + 28), d = buf.slice(lo + 30 + lfl + lex, lo + 30 + lfl + lex + sz); return m === 8 ? inflateRawSync(d) : d; } o += 46 + fl + ex + cm; } }
const pak = JSON.parse(entry('spielpaket.json'));
const raw = n => pak.cards.find(c => c.name.trim() === n);
const T = W.normalizeCard(raw('Todesapperatur')), G = W.normalizeCard(raw('Glockenwächter'));
const H = (id, o) => W.normalizeCard(Object.assign({ id, type: 'hero', name: id, rarity: 'gewoehnlich', energy: 1, atk: 1500, def: 1000, move: { dirs: { n: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1, s: 1 } }, gifts: [] }, o));
const K = id => W.normalizeCard({ id, type: 'king', name: id, rarity: 'selten', atk: 2000, hp: 10000, attack: { dirs: { n: 1 } }, gifts: [] });
console.log('Kartentext (Werkstatt):', EF.describeEffect(T.spell.effects[0], D, 'curse', T.spell.timing));
ok(/angreifenden gegnerischen Helden/.test(EF.describeEffect(T.spell.effects[0], D, 'curse', T.spell.timing)), 'Werkstatt-Text nennt jetzt „angreifenden gegnerischen Helden“');
ok(T.playable, 'Karte spielbar (Regeltext abgeglichen)');
const cards = { KA: K('KA'), KB: K('KB'), F: H('F'), A: H('A'), [T.id]: T, [G.id]: G };
const mk = () => { let s = W.newGame({ cards, decks: [['KA'].concat(Array(39).fill('F')), ['KB'].concat(Array(39).fill('F'))], seed: 5, fixedSides: true, mulligan: false }).state;
  for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid]; s.players.forEach(P => { P.hand = []; P.energy = 10; P.turns = 4; }); s.stack = []; return s; };
const put = (s, cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
// Spieler 1 hat den Glockenwächter (Maschinen) auf dem Feld und Todesapperatur auf der Hand; Spieler 0 greift an
let s = mk(); s.active = 0; s.phase = 'battle'; s.counter = null;
const g = put(s, G.id, 1, 'D4'), a = put(s, 'A', 0, 'D5'), other = put(s, 'A', 0, 'B5'); s.players[1].hand = [{ iid: 'hT', cid: T.id }]; s.players[1].energy = 3;
s = W.apply(s, { type: 'declare', uid: a, targets: [g] }).state; s = W.apply(s, { type: 'endPhase' }).state;
ok(s.phase === 'counter' && s.counter === 1, 'Konterphase für den Verteidiger: ' + s.phase);
const o = W.castOptions(s, 1, 'hT'); ok(o.ok, 'Todesapperatur wirkbar: ' + JSON.stringify(o.why || o));
const cand = W.effectCandidates(s, 1, T.spell.effects[0], T).map(x => x.id);
ok(cand.length === 1 && cand[0] === a, 'Ziel ist nur der angreifende Held (nicht der unbeteiligte): ' + JSON.stringify(cand));
let r = W.apply(s, { type: 'cast', p: 1, iid: 'hT', choices: [[a]] }); ok(!r.error, 'Wirken: ' + r.error); s = r.state || s;
s = W.apply(s, { type: 'pass', p: 1 }).state;
ok(!s.units[a] && s.units[other] && s.units[g], 'Angreifer zerstört, Glockenwächter überlebt, unbeteiligter Held bleibt');
// ohne Maschine auf dem Feld nicht wirkbar
let s2 = mk(); s2.active = 0; s2.phase = 'battle'; const f2 = put(s2, 'F', 1, 'D4'), a2 = put(s2, 'A', 0, 'D5'); s2.players[1].hand = [{ iid: 'hT', cid: T.id }]; s2.players[1].energy = 3;
s2 = W.apply(s2, { type: 'declare', uid: a2, targets: [f2] }).state; s2 = W.apply(s2, { type: 'endPhase' }).state;
ok(!W.castOptions(s2, 1, 'hT').ok, 'ohne Maschinen-Held nicht wirkbar (Voraussetzung)');
console.log('Todesapperatur-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0);
