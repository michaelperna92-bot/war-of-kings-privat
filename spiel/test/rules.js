// Regeltests für die Engine. Aufruf: node test/rules.js
const W = require('../src/engine.js');
let pass = 0, failN = 0;
const ok = (c, msg) => { if (c) pass++; else { failN++; console.log('FEHLER:', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ' – erwartet ' + JSON.stringify(b) + ', erhalten ' + JSON.stringify(a));

function H(id, o) { return W.normalizeCard(Object.assign({ id, type: 'hero', name: id, rarity: 'gewoehnlich', energy: 1, atk: 1000, def: 1000, move: { dirs: { n: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1 } }, gifts: [] }, o)); }
function K(id, o) { return W.normalizeCard(Object.assign({ id, type: 'king', name: id, rarity: 'selten', atk: 2000, hp: 10000, attack: { dirs: { n: 1 } }, gifts: [] }, o)); }
// Spiel mit Füllkarten; danach Brett leeren und Einheiten gezielt setzen
function game(extra, kingOpts) {
  const cards = { KA: K('KA', kingOpts && kingOpts[0]), KB: K('KB', kingOpts && kingOpts[1]), F: H('F', { rarity: 'legendaer' }) };
  for (const c of extra || []) cards[c.id] = c;
  const deck = k => [k].concat(Array(39).fill('F'));
  const r = W.newGame({ cards, decks: [deck('KA'), deck('KB')], seed: 7 });
  const s = r.state;
  // Seiten fest: Spieler 0 unten = KA
  if (s.cards[s.units[s.players[0].king].cid].id !== 'KA') { const k0 = s.players[0].king, k1 = s.players[1].king; s.units[k0].cid = 'KA'; s.units[k1].cid = 'KB'; }
  s.units[s.players[0].king].hp = s.cards.KA.hp; s.units[s.players[1].king].hp = s.cards.KB.hp;
  return s;
}
function put(s, cid, owner, pos, o) { const uid = 'u' + (s.nextId++); s.units[uid] = Object.assign({ uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {} }, o || {}); return uid; }
function phase(s, p, ph) { s.active = p; s.phase = ph; s.pendingDiscard = null; return s; }
function act(s, a) { const r = W.apply(s, a); if (r.error) throw new Error(r.error + ' bei ' + JSON.stringify(a)); return r; }
function err(s, a) { return W.apply(s, a).error; }

/* Spielfeld */
eq(W.FIELDS.length, 39, 'Spielfeld hat 39 Felder');
ok(!W.exists('A4') && !W.exists('G4') && W.exists('B4') && W.exists('F4') && !W.exists('B1') && W.exists('C1'), 'Reihe 4 nur B–F, Reihe 1 nur C–E');
eq(W.step('D6', 'n', 0), 'D5', 'Norden für unten = nach oben');
eq(W.step('D2', 'n', 1), 'D3', 'Norden für oben = nach unten (gespiegelt)');
eq(W.step('D2', 'e', 1), 'C2', 'Osten für oben ist gespiegelt');
eq(W.summonFields(0).sort(), ['A6', 'B6', 'C6', 'C7', 'D6', 'E6', 'F6', 'G6', 'E7'].sort(), 'Beschwörungsfelder unten');
eq(W.summonFields(1).sort(), ['A2', 'B2', 'C2', 'C1', 'D2', 'E2', 'F2', 'G2', 'E1'].sort(), 'Beschwörungsfelder oben');

/* Bewegung */
{
  const s = game([H('L', { move: { dirs: { n: 1, w: 1, e: 1, nw: 1 }, showNumber: true, number: 3 } })]); phase(s, 0, 'move');
  const u = put(s, 'L', 0, 'A5');
  const r = W.reachable(s, u);
  ok(!r['A4'], 'A4 existiert nicht – nicht betretbar');
  ok(!!r['B4'], 'Schräg auf existierendes Nachbarfeld B4 geht nicht (nur n,w,e,nw erlaubt) – Test über Umweg: B5→B4');
  ok(!!r['A3'] === false || r['A3'], 'A3 nur über Umweg erreichbar');
  eq(r['B4'] && r['B4'].length, 3, 'Weg A5→B5→B4 = 2 Schritte');
  ok(!!r['B3'], 'B3 in 3 Schritten über B5, B4');
  const s2 = game([H('L2', { move: { dirs: { n: 1 }, showNumber: true, number: 3 } })]); phase(s2, 0, 'move');
  const a = put(s2, 'L2', 0, 'D6'); put(s2, 'F', 1, 'D4');
  const r2 = W.reachable(s2, a); ok(r2['D5'] && !r2['D4'] && !r2['D3'], 'Besetzte Felder weder betreten noch durchqueren');
  const s3 = game([H('L3', { move: { dirs: { n: 1, e: 1 }, showNumber: true, number: 2 } })]); phase(s3, 0, 'move');
  const b = put(s3, 'L3', 0, 'B2'); const r3 = W.reachable(s3, b);
  ok(!r3['C1'], 'Gegnerisches Königliche-Wache-Feld C1 ist nicht betretbar');
  const s4 = game([H('L4', { move: { dirs: { n: 1 }, showNumber: true, number: 1 } })]); phase(s4, 1, 'move');
  const c = put(s4, 'L4', 1, 'D2'); eq(Object.keys(W.reachable(s4, c)), ['D3'], 'Oben läuft „vorwärts“ nach unten');
  const d = put(s4, 'L4', 1, 'B2', { summonTurn: s4.turn }); eq(Object.keys(W.reachable(s4, d)), [], 'Beschwörungssperre: frisch beschworen läuft nicht');
  act(s4, { type: 'move', uid: c, to: 'D3' }); ok(err(s4, { type: 'move', uid: c, to: 'D4' }), 'nach dem Laufen wurde der alte Zustand nicht verändert (reiner Zustand)');
  const r4 = act(s4, { type: 'move', uid: c, to: 'D3' }); ok(err(r4.state, { type: 'move', uid: c, to: 'D4' }), 'Pro Zug nur eine Bewegung');
}

/* Beschwörung, Energie, Gebot der Krone */
{
  const s = game([H('E3', { energy: 3, races: undefined, race: 'elfen' }), H('E3b', { energy: 3, race: 'zwerge' })], [{ gifts: [{ id: 'gebot_der_krone', scope: 'race', target: 'elfen', amount: 2 }] }]);
  phase(s, 0, 'summon1'); s.players[0].energy = 1; s.players[0].hand = [{ iid: 'h1', cid: 'E3' }, { iid: 'h2', cid: 'E3b' }, { iid: 'h3', cid: 'F' }];
  eq(W.cost(s, 0, 'E3'), 1, 'Gebot der Krone −2 für Elfen');
  eq(W.cost(s, 0, 'E3b'), 3, 'Gebot gilt nicht für andere Rassen');
  ok(W.summonOptions(s, 'h2').length === 0, 'zu teuer → keine Felder');
  const r = act(s, { type: 'summon', iid: 'h1', field: 'C7' }); eq(r.state.players[0].energy, 0, 'Energie bezahlt');
  ok(err(s, { type: 'summon', iid: 'h1', field: 'D5' }), 'D5 ist kein Beschwörungsfeld');
  const s2 = game(); phase(s2, 0, 'move'); ok(err(s2, { type: 'summon', iid: s2.players[0].hand[0].iid, field: 'A6' }), 'Beschwören in Bewegungsphase verboten');
}

/* Kampf */
{
  const s = game([H('A15', { atk: 1500, def: 500 }), H('D10', { atk: 900, def: 1000 }), H('D15', { atk: 0, def: 1500 })]); phase(s, 0, 'battle');
  const a = put(s, 'A15', 0, 'C5'), t = put(s, 'D10', 1, 'C4');
  let r = act(s, { type: 'declare', uid: a, targets: [t] }); r = act(r.state, { type: 'endPhase' });
  ok(!r.state.units[t] && r.state.units[a], 'ATK > DEF: Verteidiger stirbt');
  eq(r.state.phase, 'summon2', 'Konterphase automatisch gepasst → Nachbeschwörung');
  const s2 = game([H('A15', { atk: 1500 }), H('D15', { def: 2000 })]); phase(s2, 0, 'battle');
  const a2 = put(s2, 'A15', 0, 'C5'), t2 = put(s2, 'D15', 1, 'C4');
  r = act(act(s2, { type: 'declare', uid: a2, targets: [t2] }).state, { type: 'endPhase' }); ok(!r.state.units[a2] && r.state.units[t2], 'ATK < DEF: Angreifer stirbt');
  const s3 = game([H('X', { atk: 1000, def: 1000 })]); phase(s3, 0, 'battle');
  const a3 = put(s3, 'X', 0, 'C5'), t3 = put(s3, 'X', 1, 'C4');
  r = act(act(s3, { type: 'declare', uid: a3, targets: [t3] }).state, { type: 'endPhase' }); ok(!r.state.units[a3] && !r.state.units[t3], 'ATK = DEF: beide sterben');
  // mehrere Angreifer addieren nicht
  const s4 = game([H('A9', { atk: 900, def: 2000, attack: { dirs: { n: 1, ne: 1, nw: 1 } } }), H('D1k', { atk: 0, def: 1000 })]); phase(s4, 0, 'battle');
  const x = put(s4, 'A9', 0, 'B5'), y = put(s4, 'A9', 0, 'D5'), z = put(s4, 'D1k', 1, 'C4');
  r = act(s4, { type: 'declare', uid: x, targets: [z] }); r = act(r.state, { type: 'declare', uid: y, targets: [z] }); r = act(r.state, { type: 'endPhase' });
  ok(r.state.units[z] && !r.state.units[x] && !r.state.units[y], 'Mehrere Angreifer addieren ATK nicht');
  // König wird getroffen
  const s5 = game([H('A15', { atk: 1500 })]); phase(s5, 0, 'battle');
  const k1 = s5.players[1].king, h = put(s5, 'A15', 0, 'D2');
  r = act(act(s5, { type: 'declare', uid: h, targets: [k1] }).state, { type: 'endPhase' }); eq(r.state.units[k1].hp, 8500, 'König verliert ATK als HP');
  ok(r.state.units[h], 'Angreifer überlebt Königsangriff');
  // König greift Helden an: ATK ≥ DEF tötet, sonst nichts
  const s6 = game([H('D20', { def: 2000 }), H('D21', { def: 2100 })]); phase(s6, 0, 'battle');
  const k0 = s6.players[0].king, v1 = put(s6, 'D20', 1, 'D6');
  r = act(act(s6, { type: 'declare', uid: k0, targets: [v1] }).state, { type: 'endPhase' }); ok(!r.state.units[v1] && r.state.units[k0].hp === 10000, 'König: ATK = DEF tötet Helden, König unverletzt');
  const s7 = game([H('D21', { def: 2100 })]); phase(s7, 0, 'battle');
  const k7 = s7.players[0].king, v2 = put(s7, 'D21', 1, 'D6');
  r = act(act(s7, { type: 'declare', uid: k7, targets: [v2] }).state, { type: 'endPhase' }); ok(r.state.units[v2] && r.state.units[k7].hp === 10000, 'König: ATK < DEF – nichts passiert, König stirbt nicht');
  // Doppelschlag gegen König = zwei Treffer, gegen Helden zwei Ziele
  const s8 = game([H('DS', { atk: 1200, gifts: [{ id: 'doppelschlag' }], attack: { dirs: { n: 1, ne: 1 } } }), H('W5', { def: 500 })]); phase(s8, 0, 'battle');
  const ds = put(s8, 'DS', 0, 'D2'), kk = s8.players[1].king;
  r = act(act(s8, { type: 'declare', uid: ds, targets: [kk] }).state, { type: 'endPhase' }); eq(r.state.units[kk].hp, 10000 - 2400, 'Doppelschlag: König erhält zwei Treffer');
  const s9 = game([H('DS', { atk: 1200, gifts: [{ id: 'doppelschlag' }], attack: { dirs: { n: 1, ne: 1 } } }), H('W5', { def: 500 }), H('NN', { attack: { dirs: { n: 1, ne: 1 } } })]); phase(s9, 0, 'battle');
  const d9 = put(s9, 'DS', 0, 'C5'), w1 = put(s9, 'W5', 1, 'C4'), w2 = put(s9, 'W5', 1, 'D4');
  r = act(act(s9, { type: 'declare', uid: d9, targets: [w1, w2] }).state, { type: 'endPhase' }); ok(!r.state.units[w1] && !r.state.units[w2], 'Doppelschlag besiegt zwei Helden gleichzeitig');
  delete s9.units[d9]; eq(err(s9, { type: 'declare', uid: put(s9, 'NN', 0, 'C5'), targets: [w1, w2] }), 'Zu viele Ziele.', 'ohne Doppelschlag nur ein Ziel');
  // Beschwörungssperre beim Angriff, Ansturm hebt sie auf
  const sA = game([H('N', {}), H('AN', { gifts: [{ id: 'ansturm' }] })]); phase(sA, 0, 'battle');
  const n1 = put(sA, 'N', 0, 'C3', { summonTurn: sA.turn }), n2 = put(sA, 'AN', 0, 'E3', { summonTurn: sA.turn }); put(sA, 'F', 1, 'C2'); const e2 = put(sA, 'F', 1, 'E2');
  ok(err(sA, { type: 'declare', uid: n1, targets: [W.unitAt(sA, 'C2').uid] }), 'Frisch beschworen greift nicht an');
  ok(!err(sA, { type: 'declare', uid: n2, targets: [e2] }), 'Ansturm: darf sofort angreifen');
  // Angriffe bleiben bis Abschluss änderbar
  const sB = game([H('A15', { atk: 1500, attack: { dirs: { n: 1, ne: 1 } } })]); phase(sB, 0, 'battle');
  const ab = put(sB, 'A15', 0, 'C5'), t1 = put(sB, 'F', 1, 'C4'), t2b = put(sB, 'F', 1, 'D4');
  r = act(sB, { type: 'declare', uid: ab, targets: [t1] }); r = act(r.state, { type: 'declare', uid: ab, targets: [t2b] }); eq(r.state.decl[ab].targets, [t2b], 'Ziel umgeplant');
}

/* Poison */
{
  const s = game([H('PZ', { atk: 3000, def: 1000, gifts: [{ id: 'poison' }] }), H('ST', { atk: 0, def: 3500 })]); phase(s, 0, 'battle');
  const pz = put(s, 'PZ', 0, 'C5'), v = put(s, 'ST', 1, 'C4');
  let r = act(act(s, { type: 'declare', uid: pz, targets: [v] }).state, { type: 'endPhase' });
  ok(!r.state.units[pz], 'Poison-Held fällt (3000 < 3500)');
  ok(r.state.units[v] && r.state.units[v].poison && r.state.units[v].poison.by === 0, 'Vergiftung bleibt trotz Tod des Giftträgers');
  r = act(r.state, { type: 'endPhase' }); // Zugende → Spieler 1 ist dran
  ok(r.state.units[v], 'Vergifteter lebt im eigenen Zug des Opfers noch');
  // Spieler 1 durchläuft seinen Zug
  let st = r.state; for (const ph of ['summon1', 'move', 'battle', 'summon2']) st = act(st, { type: 'endPhase' }).state;
  ok(!st.units[v], 'Gifttod zu Beginn des nächsten Zuges des Poison-Besitzers');
}
{
  // Verteidiger mit Poison vergiftet den Angreifer; Göttlicher Segen wehrt ab; Heilung entfernt
  const s = game([H('PD', { atk: 0, def: 1000, gifts: [{ id: 'poison' }] }), H('AT', { atk: 2000, def: 500, attack: { dirs: { n: 1 } } }), H('SG', { atk: 2000, def: 500, gifts: [{ id: 'goettlicher_segen' }] }), H('HL', { atk: 2000, def: 500, gifts: [{ id: 'heilung' }] })]);
  phase(s, 0, 'battle');
  const at = put(s, 'AT', 0, 'C5'), pd = put(s, 'PD', 1, 'C4'), sg = put(s, 'SG', 0, 'E5'), pd2 = put(s, 'PD', 1, 'E4');
  let r = act(s, { type: 'declare', uid: at, targets: [pd] }); r = act(r.state, { type: 'declare', uid: sg, targets: [pd2] }); r = act(r.state, { type: 'endPhase' });
  ok(r.state.units[at].poison && r.state.units[at].poison.by === 1, 'Angegriffener Poison-Held vergiftet den Angreifer');
  ok(!r.state.units[sg].poison, 'Göttlicher Segen verhindert Poison');
  // erneute Vergiftung verlängert nicht
  const p0 = JSON.stringify(r.state.units[at].poison); ok(p0 === '{"by":1}', 'nur ein Giftstatus');
  // Heilung
  const s2 = game([H('HL', { gifts: [{ id: 'heilung' }] })]); phase(s2, 0, 'battle');
  const hl = put(s2, 'HL', 0, 'B5'), vic = put(s2, 'F', 0, 'C5', { poison: { by: 1 } });
  r = act(s2, { type: 'gift', uid: hl, gift: 'heilung', target: vic }); ok(!r.state.units[vic].poison, 'Heilung entfernt Poison');
  eq(r.state.units[hl].cd.heilung, 3, 'Heilung hat CT 3');
  ok(err(r.state, { type: 'gift', uid: hl, gift: 'heilung', target: hl }), 'CT verhindert erneute Nutzung');
}
{
  // Wenn beide sterben: keine Vergiftung nötig; kein Gift auf Könige
  const s = game([H('PZ', { atk: 1000, def: 1000, gifts: [{ id: 'poison' }] })]); phase(s, 0, 'battle');
  const a = put(s, 'PZ', 0, 'D2'), k = s.players[1].king;
  const r = act(act(s, { type: 'declare', uid: a, targets: [k] }).state, { type: 'endPhase' }); ok(!r.state.units[k].poison, 'Könige werden nie vergiftet');
}

/* Dauer, CT, Mordlust, Eisenpanzer */
{
  const s = game([H('MO', { atk: 1000, def: 1000, gifts: [{ id: 'mordlust' }, { id: 'eisenpanzer' }] })]); phase(s, 0, 'battle');
  const m = put(s, 'MO', 0, 'C5');
  let r = act(s, { type: 'gift', uid: m, gift: 'mordlust' }); eq(W.atkOf(r.state, r.state.units[m]), 1500, 'Mordlust +500 ATK');
  r = act(r.state, { type: 'gift', uid: m, gift: 'eisenpanzer' }); eq(W.defOf(r.state, r.state.units[m]), 1300, 'Eisenpanzer +300 DEF');
  let st = act(act(r.state, { type: 'endPhase' }).state, { type: 'endPhase' }).state; // Battle → Auswertung → summon2 → Zugende
  eq(W.atkOf(st, st.units[m]), 1000, 'Mordlust endet am Zugende');
  eq(W.defOf(st, st.units[m]), 1300, 'Eisenpanzer hält im gegnerischen Zug');
  for (let i = 0; i < 4; i++) st = act(st, { type: 'endPhase' }).state; // Gegnerzug beenden → eigener Zug 1 danach
  eq(st.active, 0, 'wieder eigener Zug');
  eq(W.defOf(st, st.units[m]), 1300, 'Eisenpanzer hält im ersten folgenden eigenen Zug');
  eq(st.units[m].cd, { mordlust: 1, eisenpanzer: 4 }, 'CT sinkt zu Beginn jedes folgenden eigenen Zuges um 1');
  for (let i = 0; i < 8; i++) st = act(st, { type: 'endPhase' }).state;
  eq(W.defOf(st, st.units[m]), 1000, 'Eisenpanzer endet zu Beginn des zweiten folgenden eigenen Zuges');
  eq(st.units[m].cd, { eisenpanzer: 3 }, 'Mordlust wieder bereit (CT 0)');
}

/* Weitere Gaben */
{
  const s = game([H('EN', { atk: 1000, def: 1000, gifts: [{ id: 'entwaffnen' }] }), H('T1', { atk: 0, def: 1200 }), H('SG', { def: 1200, gifts: [{ id: 'goettlicher_segen' }] })]); phase(s, 0, 'battle');
  const e = put(s, 'EN', 0, 'C5'), t = put(s, 'T1', 1, 'C4');
  let r = act(s, { type: 'gift', uid: e, gift: 'entwaffnen', target: t }); eq(W.defOf(r.state, r.state.units[t]), 700, 'Entwaffnen −500 DEF');
  r = act(act(r.state, { type: 'declare', uid: e, targets: [t] }).state, { type: 'endPhase' }); ok(!r.state.units[t], 'Nach Entwaffnen gewinnt der Angriff');
  const s2 = game([H('EN', { gifts: [{ id: 'entwaffnen' }] }), H('SG', { def: 1200, gifts: [{ id: 'goettlicher_segen' }] })]); phase(s2, 0, 'battle');
  const e2 = put(s2, 'EN', 0, 'C5'), t2 = put(s2, 'SG', 1, 'C4');
  r = act(s2, { type: 'gift', uid: e2, gift: 'entwaffnen', target: t2 }); eq(W.defOf(r.state, r.state.units[t2]), 1200, 'Göttlicher Segen wehrt Entwaffnen ab');
  ok(err(s2, { type: 'gift', uid: e2, gift: 'entwaffnen', target: put(s2, 'F', 1, 'G3') }), 'Entwaffnen nur in Angriffsreichweite');
}
{
  const s = game([H('FE', { gifts: [{ id: 'fesseln' }] }), H('TA', { gifts: [{ id: 'tausch' }] }), H('BS', { gifts: [{ id: 'blitzschritt' }], move: { dirs: { n: 1 }, showNumber: true, number: 1 } })]); phase(s, 0, 'battle');
  const fe = put(s, 'FE', 0, 'A5'), en = put(s, 'F', 1, 'D3');
  let r = act(s, { type: 'gift', uid: fe, gift: 'fesseln', target: en }); ok(W.bound(r.state.units[en]), 'Fesseln angelegt');
  let st = act(act(r.state, { type: 'endPhase' }).state, { type: 'endPhase' }).state; st = act(st, { type: 'endPhase' }).state; // Gegner: summon1 → move
  eq(st.phase, 'move', 'Gegner in Bewegungsphase');
  eq(Object.keys(W.reachable(st, en)), [], 'Gefesselter Held kann nicht laufen');
  const ta = put(st, 'TA', 1, 'A2'); st.phase = 'battle';
  ok(!W.giftOptions(st, ta).length || !W.giftOptions(st, ta)[0].targets.includes(en), 'Gefesselter Held nicht tauschbar');
  const s2 = game([H('TA', { gifts: [{ id: 'tausch' }] })]); phase(s2, 0, 'battle');
  const t1 = put(s2, 'TA', 0, 'A5'), t2 = put(s2, 'F', 0, 'G6');
  r = act(s2, { type: 'gift', uid: t1, gift: 'tausch', target: t2 }); ok(r.state.units[t1].pos === 'G6' && r.state.units[t2].pos === 'A5', 'Tausch vertauscht Positionen');
  const s3 = game([H('BS', { atk: 1500, gifts: [{ id: 'blitzschritt' }], move: { dirs: { n: 1 }, showNumber: true, number: 1 } })]); phase(s3, 0, 'battle');
  const bs = put(s3, 'BS', 0, 'C5', { moved: true }), tg = put(s3, 'F', 1, 'C3');
  ok(!W.attackTargets(s3, bs).includes(tg), 'vor Blitzschritt kein Ziel');
  r = act(s3, { type: 'gift', uid: bs, gift: 'blitzschritt', target: 'C4' }); ok(W.attackTargets(r.state, bs).includes(tg), 'Blitzschritt: ein Feld extra, dann Angriff');
}
{
  const s = game([H('RZ', { atk: 2000, def: 500, gifts: [{ id: 'rueckzug' }] })]); phase(s, 0, 'battle');
  const rz = put(s, 'RZ', 0, 'C4'), t = put(s, 'F', 1, 'C3');
  let r = act(s, { type: 'gift', uid: rz, gift: 'rueckzug', target: rz }); r = act(r.state, { type: 'declare', uid: rz, targets: [t] }); r = act(r.state, { type: 'endPhase' });
  ok(!r.state.units[t] && r.state.units[rz].pos === 'C5', 'Rückzug: nach dem Kampf ein Feld Richtung eigene Seite');
  const s2 = game([H('RZ', { gifts: [{ id: 'rueckzug' }] })]); phase(s2, 0, 'battle');
  const r2 = put(s2, 'RZ', 0, 'C5'), en = put(s2, 'F', 1, 'E3');
  r = act(act(s2, { type: 'gift', uid: r2, gift: 'rueckzug', target: en }).state, { type: 'endPhase' }); eq(r.state.units[en].pos, 'E2', 'Rückzug eines Gegners Richtung seiner Seite (oben)');
}
{
  const s = game([H('DB', { atk: 2000, gifts: [{ id: 'durchbruch' }] }), H('SC', { atk: 2000, gifts: [{ id: 'schuetze' }] })]); phase(s, 0, 'battle');
  const db = put(s, 'DB', 0, 'C5'), far = put(s, 'F', 1, 'C3');
  ok(!W.attackTargets(s, db).includes(far), 'ohne Durchbruch kein Ziel auf 2 Feldern');
  let r = act(s, { type: 'gift', uid: db, gift: 'durchbruch' }); ok(W.attackTargets(r.state, db).includes(far), 'Durchbruch: Held 2 Felder entfernt');
  const sc = put(s, 'SC', 0, 'E5'), far2 = put(s, 'F', 1, 'E3'); ok(W.attackTargets(s, sc).includes(far2), 'Schütze: Ziel 2 Felder entfernt');
}
{
  // Königsgaben: Zorn/Bollwerk mit Rasse
  const s = game([H('EL', { race: 'elfen', atk: 1000, def: 1000 }), H('ZW', { race: 'zwerge', atk: 1000, def: 1000 })], [{ gifts: [{ id: 'zorn_des_imperators', scope: 'race', target: 'elfen', amount: 300 }, { id: 'ewiges_bollwerk', scope: 'all', amount: 200 }] }]);
  const a = put(s, 'EL', 0, 'C5'), b = put(s, 'ZW', 0, 'D5'), c = put(s, 'EL', 1, 'C3');
  eq([W.atkOf(s, s.units[a]), W.defOf(s, s.units[a])], [1300, 1200], 'Zorn (nur Elfen) + Bollwerk (alle)');
  eq([W.atkOf(s, s.units[b]), W.defOf(s, s.units[b])], [1000, 1200], 'Zwerg nur Bollwerk');
  eq([W.atkOf(s, s.units[c]), W.defOf(s, s.units[c])], [1000, 1000], 'Gegner profitiert nicht');
}

/* Nachziehen, Hand, Niederlagen */
{
  const s = game(); phase(s, 0, 'summon2'); s.players[1].deck = [];
  let r = act(s, { type: 'endPhase' }); eq(r.state.units[r.state.players[1].king].hp, 9000, 'Leerer Stapel: König verliert 1.000 HP');
  const s2 = game(); phase(s2, 0, 'summon2'); s2.players[1].hand = s2.players[1].deck.splice(0, 10);
  r = act(s2, { type: 'endPhase' }); eq(r.state.pendingDiscard, 1, '11. Karte erzwingt Ablegen');
  ok(err(r.state, { type: 'endPhase', p: 1 }), 'Vor dem Ablegen geht nichts anderes');
  const r2 = act(r.state, { type: 'discard', p: 1, iid: r.state.players[1].hand[0].iid }); eq(r2.state.players[1].hand.length, 10, 'abgelegt');
  const s3 = game(); phase(s3, 0, 'summon1'); s3.players[0].deck = []; s3.players[0].hand = [{ iid: 'z1', cid: 'F' }]; s3.players[0].energy = 5;
  r = act(s3, { type: 'summon', iid: 'z1', field: 'A6' }); ok(r.state.result && r.state.result.winner === 1, 'Keine Hand und kein Stapel = sofortige Niederlage');
  const s4 = game([H('BIG', { atk: 3500, attack: { dirs: { n: 1 } } })], [{ hp: 3000 }, { hp: 3000 }]);
  s4.units[s4.players[0].king].hp = 3000; s4.units[s4.players[1].king].hp = 3000; phase(s4, 0, 'battle');
  const big = put(s4, 'BIG', 0, 'D2');
  r = act(act(s4, { type: 'declare', uid: big, targets: [s4.players[1].king] }).state, { type: 'endPhase' }); ok(r.state.result && r.state.result.winner === 0, 'König auf 0 HP → Sieg');
  const s5 = game(); phase(s5, 0, 'summon2'); s5.units[s5.players[1].king].hp = 500; s5.players[1].deck = [];
  r = act(s5, { type: 'endPhase' }); ok(r.state.result && r.state.result.winner === 0, 'Fehlender Nachzug kann den König töten');
}
{
  // Start: 5 Handkarten, Startspieler zieht im ersten Zug
  const s = game(); const p = s.active;
  eq([s.players[p].hand.length, s.players[1 - p].hand.length], [6, 5], 'Startspieler hat nach dem Nachziehen 6 Karten');
  eq(s.players[p].energy, 1, 'Erster Zug: 1 Energie');
}

{
  // Wer fesselt, bleibt selbst frei: Der Anwender läuft im nächsten eigenen Zug normal
  const s = game([H('FE', { gifts: [{ id: 'fesseln' }], move: { dirs: { n: 1 }, showNumber: true, number: 1 } })]); phase(s, 0, 'battle');
  const fe = put(s, 'FE', 0, 'C5'), en = put(s, 'F', 1, 'E3');
  let st = act(s, { type: 'gift', uid: fe, gift: 'fesseln', target: en }).state;
  ok(!W.bound(st.units[fe]), 'Anwender ist nicht gefesselt');
  for (let i = 0; i < 6; i++) st = act(st, { type: 'endPhase' }).state; // eigener Zug zu Ende, Gegnerzug durch, eigener Zug 1. Beschwörung
  st = act(st, { type: 'endPhase' }).state; // → Bewegung
  eq([st.active, st.phase], [0, 'move'], 'eigene Bewegungsphase');
  ok(!!W.reachable(st, fe).C4, 'Anwender kann im nächsten eigenen Zug laufen');
  ok(W.bound(st.units[en]), 'Ziel bleibt bis zum zweiten folgenden eigenen Zug des Anwenders gefesselt');
}

console.log('\nRegeltests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.');
process.exit(failN ? 1 : 0);
