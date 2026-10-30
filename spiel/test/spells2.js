// Tests für Kontrolle, Zusatzkosten, neue Voraussetzungen, Ausspielzeitpunkt, Kopienlimit, Reichweite. Aufruf: node test/spells2.js
global.window = global; require(require('path').join(require('../ccpath.js'), 'data.js')); delete global.window;
const W = require('../src/engine.js'), EF = W.EF, D = global.WOK_DATA;
let pass = 0, failN = 0;
const ok = (c, msg) => { if (c) pass++; else { failN++; console.log('FEHLER:', msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg + ' – erwartet ' + JSON.stringify(b) + ', erhalten ' + JSON.stringify(a));
function H(id, o) { return W.normalizeCard(Object.assign({ id, type: 'hero', name: id, rarity: 'gewoehnlich', energy: 1, atk: 1000, def: 1000, move: { dirs: { n: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1 } }, gifts: [] }, o)); }
function K(id, o) { return W.normalizeCard(Object.assign({ id, type: 'king', name: id, rarity: 'selten', atk: 2000, hp: 10000, attack: { dirs: { n: 1 } }, gifts: [] }, o)); }
// Zauber/Fluch bauen: effects = Liste von [kind, änderungen]
function SP(id, type, effects, o) {
  const raw = Object.assign({ id, type, name: id, rarity: 'gewoehnlich', energy: 0, ruleText: '' }, o || {});
  raw.spell = Object.assign(EF.blankSpell(type), (o && o.spell) || {});
  raw.spell.effects = effects.map(([k, ch]) => { const e = EF.blankEffect(k, type); for (const [p, v] of Object.entries(ch || {})) { const ks = p.split('.'); let x = e; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; } return e; });
  return W.normalizeCard(raw);
}
function game(extra, kingOpts, opts) {
  const cards = { KA: K('KA', kingOpts && kingOpts[0]), KB: K('KB', kingOpts && kingOpts[1]), F: H('F', { rarity: 'legendaer' }) };
  for (const c of extra || []) cards[c.id] = c;
  const deck = k => [k].concat(Array(39).fill('F'));
  const s = W.newGame(Object.assign({ cards, decks: [deck('KA'), deck('KB')], seed: 7, fixedSides: true }, opts || {})).state;
  for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
  s.players.forEach(P => { P.hand = []; P.energy = 10; P.turns = 3; });
  s.stack = []; s.auras = []; s.locks = [];
  return s;
}
function put(s, cid, owner, pos, o) { const uid = 'u' + (s.nextId++); s.units[uid] = Object.assign({ uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }, o || {}); return uid; }
function hand(s, p, cid) { const iid = 'h' + (s.nextId++); s.players[p].hand.push({ iid, cid }); return iid; }
function phase(s, p, ph) { s.active = p; s.phase = ph; s.pendingDiscard = null; s.counter = ph === 'counter' ? 1 - p : null; return s; }
function act(s, a) { const r = W.apply(s, a); if (r.error) throw new Error(r.error + ' bei ' + JSON.stringify(a)); return r.state; }
function err(s, a) { return W.apply(s, a).error; }
// Battlephase abschließen; der Verteidiger passt, falls eine Konterphase entsteht
function finishBattle(s) { s = act(s, { type: 'endPhase' }); if (s.phase === 'counter') s = act(s, { type: 'pass', p: s.counter }); return s; }

const endTurn = s => { while (s.phase !== 'summon2' && !s.result) s = s.phase === 'counter' ? act(s, { type: 'pass', p: s.counter }) : act(s, { type: 'endPhase' }); return act(s, { type: 'endPhase' }); };
const pName = s => s.players[s.active].name;

/* 1. Kontrolle übernehmen bis Ende des nächsten eigenen Zuges */
{
  const C = SP('CT', 'curse', [['control', { 'duration.kind': 'rounds', 'duration.n': 1 }]]);
  let s = game([C, H('G', { gifts: [{ id: 'goettlicher_segen' }] })]); phase(s, 0, 'battle');
  const t = put(s, 'F', 1, 'D3'), g = put(s, 'G', 1, 'E3');
  const o = W.castOptions(s, 0, hand(s, 0, 'CT')); ok(o.ok, 'Kontrolle spielbar: ' + o.why);
  ok(!o.effects[0].candidates.some(x => s.units[x.id].king), 'Könige sind kein Ziel');
  s = act(s, { type: 'cast', iid: s.players[0].hand[0].iid, choices: [[t]] });
  s = finishBattle(s);
  eq(s.units[t].owner, 0, 'Held gehört nach der Auswertung Spieler 0');
  ok(!W.locked(s, s.units[t]), 'umgeht die Beschwörungssperre');
  ok(W.canAttack(s, t) || s.phase !== 'battle', 'kann sofort handeln');
  s = endTurn(s); eq(s.units[t].owner, 0, 'während des gegnerischen Zuges weiter unter Kontrolle');
  s = endTurn(s); eq(s.units[t].owner, 0, 'im nächsten eigenen Zug noch unter Kontrolle');
  ok(!W.locked(s, s.units[t]), 'keine Sperre im nächsten Zug');
  s = endTurn(s); eq(s.units[t].owner, 1, 'am Ende des nächsten eigenen Zuges zurück');
  eq(s.units[t].origOwner, undefined, 'kein Fremdbesitz mehr');
  s = game([C, H('G', { gifts: [{ id: 'goettlicher_segen' }] })]); phase(s, 0, 'battle');
  const g2 = put(s, 'G', 1, 'E3');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'CT'), choices: [[g2]] }); s = finishBattle(s);
  eq(s.units[g2].owner, 1, 'Göttlicher Segen schützt vor Kontrolle');
}
/* 2. Permanente Kontrolle, Tod: Held zum Besitzer, Fluch zum Wirkenden */
{
  const C = SP('CP', 'curse', [['control', { 'duration.kind': 'permanent', 'params.lock': false }]]);
  const D = SP('DS', 'spell', [['destroy', { 'target.side': 'own' }]]);
  let s = game([C, D]); phase(s, 0, 'battle');
  const t = put(s, 'F', 1, 'D3');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'CP'), choices: [[t]] }); s = finishBattle(s);
  eq(s.units[t].owner, 0, 'permanent übernommen'); ok(!W.locked(s, s.units[t]), 'ohne Sperre');
  ok(s.units[t].attached.some(a => a.cid === 'CP'), 'Fluch hängt am Helden');
  s = endTurn(s); s = endTurn(s); s = endTurn(s); eq(s.units[t].owner, 0, 'bleibt dauerhaft');
  phase(s, 0, 'battle'); s = act(s, { type: 'cast', iid: hand(s, 0, 'DS'), choices: [[t]] }); s = finishBattle(s);
  ok(!s.units[t], 'zerstört');
  ok(s.players[1].discard.some(d => d.cid === 'F'), 'Held auf den Ablagestapel des Besitzers');
  ok(s.players[0].discard.some(d => d.cid === 'CP'), 'Fluch auf den Ablagestapel des Wirkenden');
}
/* 3. Kontrolle solange Bedingung; Ansagen auf den übernommenen Helden entfallen */
{
  const C = SP('CW', 'curse', [['control', { 'duration.kind': 'while', 'duration.cond': { op: 'and', items: [{ k: 'kingHp', side: 'own', cmp: '>=', value: 5000 }] } }]]);
  let s = game([C]); phase(s, 0, 'battle');
  const t = put(s, 'F', 1, 'D3'), a = put(s, 'F', 0, 'D4');
  s = act(s, { type: 'declare', uid: a, targets: [t] });
  s = act(s, { type: 'cast', iid: hand(s, 0, 'CW'), choices: [[t]] }); s = finishBattle(s);
  ok(s.units[a] && s.units[t] && s.units[t].owner === 0, 'kein Kampf gegen den eigenen, übernommenen Helden');
  W.kingOf(s, 0).hp = 4000; s = endTurn(s);
  eq(s.units[t].owner, 1, 'Bedingung weg → Held kehrt zurück');
}
/* 3b. Übernommener Held umgeht Fesseln, Bewegungssperre und Beschwörungssperre */
{
  const C = SP('CF', 'curse', [['control', { 'duration.kind': 'rounds', 'duration.n': 1 }]]);
  let s = game([C]); phase(s, 0, 'battle');
  const t = put(s, 'F', 1, 'D3', { summonTurn: s.turn, fx: [{ id: 'fesseln', negative: true, until: { p: 1, turn: s.players[1].turns + 2 } }, { kind: 'moveBlock', negative: true, permanent: true }] });
  ok(W.bound(s.units[t]), 'vorher gefesselt');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'CF'), choices: [[t]] }); s = finishBattle(s);
  ok(!W.bound(s.units[t]) && !W.immobile(s, s.units[t]) && !W.locked(s, s.units[t]), 'nach der Übernahme: Fesseln, Bewegungssperre und Beschwörungssperre umgangen');
  s = endTurn(s); s = endTurn(s); s.phase = 'move';
  ok(Object.keys(W.reachable(s, t)).length > 0, 'kann im nächsten eigenen Zug laufen');
  ok(/umgeht Beschwörungssperre, Fesseln und Bewegungssperren/.test(EF.describe(C, D)), 'Kartentext nennt das Umgehen: ' + EF.describe(C, D));
}
/* 4. Zusatzkosten: König-HP und Handkarten */
{
  const C = SP('KO', 'curse', [['damage', { 'params.amount': 2000, 'target.side': 'enemy' }]], { spell: { cost: { hp: 1500, discard: 1 } } });
  ok(C.playable, 'Karte mit Kosten ist gültig: ' + (C.notPlayable || []).join(' '));
  let s = game([C]); phase(s, 0, 'battle');
  const iid = hand(s, 0, 'KO');
  let o = W.castOptions(s, 0, iid); ok(!o.ok && /Handkarten/.test(o.why), 'ohne weitere Handkarte nicht spielbar: ' + o.why);
  hand(s, 0, 'F'); hand(s, 0, 'F');
  o = W.castOptions(s, 0, iid); ok(o.ok, 'mit weiteren Handkarten spielbar: ' + o.why);
  s = act(s, { type: 'cast', iid, choices: [] });
  eq(W.kingOf(s, 0).hp, 8500, 'König opfert 1.500 HP sofort'); eq(s.players[0].hand.length, 1, 'eine Handkarte abgeworfen');
  ok(s.players[0].discard.some(d => d.cid === 'F'), 'abgeworfene Karte im Ablagestapel');
  s = finishBattle(s); eq(W.kingOf(s, 1).hp, 8000, 'Schaden beim Gegner');
  s = game([C]); phase(s, 0, 'battle'); W.kingOf(s, 0).hp = 1500; hand(s, 0, 'F');
  o = W.castOptions(s, 0, hand(s, 0, 'KO')); ok(!o.ok && /König/.test(o.why), 'König würde sterben → nicht spielbar: ' + o.why);
  ok(/opfert|verliert 1500|1.500/.test(EF.describe(C, D)) || /König verliert/.test(EF.describe(C, D)), 'Kostentext im Kartentext: ' + EF.describe(C, D));
}
/* 5. Voraussetzungen: eigene Rasse, Friedhof, ganzes Feld, Hand */
{
  const req = items => ({ spell: { require: { op: 'and', items } } });
  const R1 = SP('R1', 'curse', [['damage', { 'params.amount': 1000, 'target.side': 'enemy' }]], req([{ k: 'control', min: 1, filter: { op: 'and', items: [{ k: 'race', v: 'drachen' }] } }]));
  const R2 = SP('R2', 'spell', [['draw', { 'params.n': 1 }]], req([{ k: 'discard', side: 'own', min: 2, filter: { op: 'and', items: [{ k: 'race', v: 'drachen' }] } }]));
  const R3 = SP('R3', 'curse', [['stat', { 'target.side': 'both', 'target.count': 'all', 'params.amount': -300, 'duration.kind': 'turn' }]], req([{ k: 'fieldAny', min: 3, filter: { op: 'and', items: [] } }]));
  const R4 = SP('R4', 'spell', [['draw', { 'params.n': 1 }]], req([{ k: 'hand', min: 2 }]));
  const Dr = H('DR', { race: 'drachen' });
  let s = game([R1, R2, R3, R4, Dr]); phase(s, 0, 'battle');
  const i1 = hand(s, 0, 'R1'), i2 = hand(s, 0, 'R2'), i3 = hand(s, 0, 'R3');
  ok(!W.castOptions(s, 0, i1).ok, 'ohne Drachen nicht aktivierbar');
  put(s, 'DR', 0, 'D6'); ok(W.castOptions(s, 0, i1).ok, 'mit eigenem Drachen aktivierbar');
  ok(!W.castOptions(s, 0, i2).ok, 'Friedhof leer → nicht aktivierbar');
  s.players[0].discard.push({ iid: 'x1', cid: 'DR' }, { iid: 'x2', cid: 'DR' }); ok(W.castOptions(s, 0, i2).ok, '2 Drachen im Friedhof → aktivierbar');
  ok(!W.castOptions(s, 0, i3).ok, 'nur 1 Held auf dem Feld → nicht aktivierbar');
  put(s, 'F', 1, 'C3'); put(s, 'F', 1, 'E3'); ok(W.castOptions(s, 0, i3).ok, '3 Helden beider Seiten → aktivierbar');
  const u0 = Object.values(s.units).filter(u => !u.king).map(u => u.uid);
  s = act(s, { type: 'cast', iid: i3, choices: [] }); s = finishBattle(s);
  ok(u0.every(uid => W.atkOf(s, s.units[uid]) === 700), 'alle Helden beider Seiten −300 ATK');
  s = game([R4]); phase(s, 0, 'battle'); const i4 = hand(s, 0, 'R4'); hand(s, 0, 'F');
  ok(!W.castOptions(s, 0, i4).ok, 'nur 1 weitere Handkarte → nicht aktivierbar'); hand(s, 0, 'F'); ok(W.castOptions(s, 0, i4).ok, '2 weitere Handkarten → aktivierbar');
}
/* 6. Zeitpunkt: nur Battle / nur Konter */
{
  const B = SP('TB', 'spell', [['draw', {}]], { spell: { timing: 'battle' } }), C = SP('TC', 'spell', [['draw', {}]], { spell: { timing: 'counter' } });
  let s = game([B, C]); phase(s, 0, 'battle'); const b = hand(s, 0, 'TB'), c = hand(s, 0, 'TC');
  ok(W.castOptions(s, 0, b).ok, 'Battle-Karte in der Battlephase'); ok(!W.castOptions(s, 0, c).ok, 'Konter-Karte nicht in der Battlephase');
  s = game([B, C]); phase(s, 1, 'counter'); const b2 = hand(s, 0, 'TB'), c2 = hand(s, 0, 'TC');
  ok(!W.castOptions(s, 0, b2).ok, 'Battle-Karte nicht in der Konterphase'); ok(W.castOptions(s, 0, c2).ok, 'Konter-Karte in der Konterphase: ' + W.castOptions(s, 0, c2).why);
}
/* 7. Reichweite und Kopienlimit */
{
  const L = H('LONG', { attack: { dirs: { n: 2 } } }), S = H('SCH', { attack: { dirs: { n: 2 } }, gifts: [{ id: 'schuetze' }] });
  let s = game([L, S]); phase(s, 0, 'battle');
  const a = put(s, 'LONG', 0, 'D5'), b = put(s, 'SCH', 0, 'B5'), t1 = put(s, 'F', 1, 'D3'), t2 = put(s, 'F', 1, 'B3');
  ok(!W.targetsOf(s, a).some(x => x.uid === t1), 'Pfeil Länge 2 ohne Schütze reicht nicht 2 Felder');
  ok(W.targetsOf(s, b).some(x => x.uid === t2), 'Schütze reicht 2 Felder');
  const cards = { KA: K('KA'), G: H('G'), U: H('U', { rarity: 'ungewoehnlich' }), S: H('S', { rarity: 'selten' }), L1: H('L1', { rarity: 'legendaer' }), L2: H('L2', { rarity: 'legendaer' }) };
  const errs = ids => W.validateDeck(ids, cards).errors || W.validateDeck(ids, cards).errs || [];
  const base = ['KA', 'L1', 'L2'], fill = n => Array(n).fill(0).map((_, k) => { const id = 'X' + k; cards[id] = H(id); return id; });
  const ok3 = base.concat(['G', 'G', 'G', 'U', 'U', 'U', 'S', 'S'], fill(29));
  eq(errs(ok3).length, 0, 'Gewöhnlich 3, Ungewöhnlich 3, Selten 2, verschiedene Legendäre erlaubt');
  ok(errs(ok3.slice(0, -1).concat(['G'])).some(e => /4×/.test(e)), 'Gewöhnlich 4× verboten');
  ok(errs(ok3.slice(0, -1).concat(['S'])).some(e => /3×/.test(e)), 'Selten 3× verboten');
  ok(errs(ok3.slice(0, -1).concat(['L1'])).some(e => /2×/.test(e)), 'Legendär doppelt verboten');
}
/* 8. Königliche Gaben: Wirkungsbereich, Stärke, Blitzkrieg, nie unter 0 */
{
  const KR = K('KR', { gifts: [{ id: 'zorn_des_imperators', scope: 'race', target: 'drachen', amount: 400 }, { id: 'ewiges_bollwerk', scope: 'class', target: 'ritter', amount: 300 }, { id: 'blitzkrieg', scope: 'element', target: 'feuer', amount: 2 }] });
  const KA2 = K('KA2', { gifts: [{ id: 'blitzkrieg', amount: 3 }, { id: 'gebot_der_krone', amount: 2 }, { id: 'zorn_des_imperators', amount: 9999 }] });
  const cards = { KR, KA2, KB: K('KB'), F: H('F'), DR: H('DR', { race: 'drachen', energy: 4 }), RI: H('RI', { classes: ['ritter'], energy: 4 }), FE: H('FE', { element: 'feuer', energy: 3 }), CH: H('CH', { energy: 1 }) };
  const deck = k => [k].concat(Array(39).fill('F'));
  let s = W.newGame({ cards, decks: [deck('KR'), deck('KB')], seed: 3, fixedSides: true }).state;
  const u = (cid, pos) => { const uid = 'q' + cid; s.units[uid] = { uid, cid, owner: 0, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return s.units[uid]; };
  eq(W.atkOf(s, u('DR', 'B6')), 1400, 'Zorn nur für Drachen: +400 ATK'); eq(W.atkOf(s, u('RI', 'C6')), 1000, 'Ritter bekommt keinen ATK-Bonus');
  eq(W.defOf(s, s.units.qRI), 1300, 'Bollwerk nur für Ritter: +300 DEF'); eq(W.defOf(s, s.units.qDR), 1000, 'Drache bekommt keinen DEF-Bonus');
  eq(W.cost(s, 0, 'FE'), 1, 'Blitzkrieg nur für Feuer: 3 − 2 = 1'); eq(W.cost(s, 0, 'DR'), 4, 'Drache (kein Feuer) kostet voll');
  s = W.newGame({ cards, decks: [deck('KA2'), deck('KB')], seed: 3, fixedSides: true }).state;
  eq(W.cost(s, 0, 'DR'), 0, 'Blitzkrieg 3 + Gebot 2 für alle: 4 → 0 (nie unter 0)'); eq(W.cost(s, 0, 'CH'), 0, '1 Energie → 0');
  eq(W.cost(s, 1, 'DR'), 4, 'der Gegner zahlt voll');
  const k = s.cards.KA2.gifts.find(g => g.id === 'zorn_des_imperators'); eq(k.amount, 1000, 'Stärke wird auf die Spanne der Werkstatt begrenzt (höchstens 1000)');
  eq(W.ROYAL.blitzkrieg.stat, 'energy', 'Blitzkrieg ist im Spiel bekannt');
}
/* 9. Dauer muss in den Gegnerzug reichen; Schutz vor Angriffen und Flüchen */
{
  const bad = SP('BAD', 'curse', [['stat', { 'params.stat': 'move', 'params.amount': -1, 'duration.kind': 'turn' }]]);
  ok(!bad.playable && /Zug deines Gegners/.test(bad.notPlayable.join(' ')), 'Schritte senken nur „bis Zugende“ in der Battlephase ist ungültig');
  const fixedSp = JSON.parse(JSON.stringify(bad.spell)); eq(EF.autoFix(fixedSp), 1, 'automatische Korrektur greift'); eq(fixedSp.effects[0].duration, { kind: 'rounds', n: 1 }, '→ 1 Zug des Gegners');
  const okC = SP('OKC', 'curse', [['stat', { 'params.stat': 'move', 'params.amount': -1, 'duration.kind': 'turn' }]], { spell: { timing: 'counter' } });
  ok(okC.playable, 'in der Konterphase ist „bis Zugende“ sinnvoll (läuft im Gegnerzug)');
  const SH = SP('SH', 'spell', [['protect', { 'params.from': 'both', 'duration.kind': 'rounds', 'duration.n': 1 }]]);
  const CU = SP('CU', 'curse', [['stat', { 'params.amount': -500, 'duration.kind': 'rounds', 'duration.n': 1 }]]), DE = SP('DE', 'curse', [['destroy', {}]]);
  let s = game([SH, CU, DE]); phase(s, 0, 'battle');
  const mine = put(s, 'F', 0, 'D5'), foe = put(s, 'F', 1, 'D4');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'SH'), choices: [[mine]] }); s = finishBattle(s);
  ok(/weder durch Angriffe noch durch gegnerische Flüche/.test(EF.describe(SH, D)) && /^Solange dieser Zauber wirkt/.test(EF.describe(SH, D)), 'Text: ' + EF.describe(SH, D));
  // Gegnerzug: Fluch und Zerstörung prallen ab, Angriff wirkungslos
  s = endTurn(s); phase(s, 1, 'battle'); s.players[1].energy = 10;
  s = act(s, { type: 'cast', p: 1, iid: hand(s, 1, 'CU'), choices: [[mine]] });
  s = act(s, { type: 'cast', p: 1, iid: hand(s, 1, 'DE'), choices: [[mine]] });
  s = act(s, { type: 'declare', p: 1, uid: foe, targets: [mine] });
  s = act(s, { type: 'endPhase', p: 1 }); if (s.phase === 'counter') s = act(s, { type: 'pass', p: 0 });
  ok(!!s.units[mine], 'geschützter Held lebt (Fluch-Zerstörung und Angriff abgewehrt)'); eq(W.atkOf(s, s.units[mine]), 1000, 'ATK-Fluch wirkt nicht auf ihn');
  const AT = SP('AT', 'spell', [['stat', { 'params.amount': 500, 'duration.kind': 'rounds', 'duration.n': 1 }]]);
  s = game([AT]); phase(s, 0, 'battle'); const a = put(s, 'F', 0, 'D5');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'AT'), choices: [[a]] }); s = finishBattle(s);
  s = endTurn(s); s = endTurn(s); eq(W.atkOf(s, s.units[a]), 1500, 'eigene ATK-Stärkung „1 Runde“ gilt noch im eigenen nächsten Zug');
  ok(/bis zum Ende deines nächsten Zuges/.test(EF.describe(AT, D)), 'Text eigene Stärkung: ' + EF.describe(AT, D));
}
/* Kontrolle in der eigenen Battlephase wirkt sofort – der Held greift in derselben Battlephase mit an */
{
  const C = SP('CN', 'curse', [['control', { 'duration.kind': 'turn' }]]);
  const NX = SP('NX', 'spell', [['destroy', { 'target.side': 'enemy' }]]);
  const WK = H('WK', { atk: 100, def: 100 });
  let s = game([C, NX, WK]); phase(s, 0, 'battle');
  const t = put(s, 'F', 1, 'D4'), v = put(s, 'WK', 1, 'D3');
  s = act(s, { type: 'cast', iid: hand(s, 0, 'CN'), choices: [[t]] });
  eq(s.phase, 'battle', 'noch in der Battlephase');
  eq(s.units[t].owner, 0, 'Kontrolle sofort übernommen – vor Konterphase und Schadensberechnung');
  eq(s.stack.length, 0, 'Fluch liegt nicht auf dem Stapel');
  ok(W.canAttack(s, t), 'übernommener Held kann sofort angreifen');
  s = act(s, { type: 'declare', uid: t, targets: [v] });
  s = finishBattle(s);
  ok(!s.units[v], 'Angriff des übernommenen Helden wurde ausgewertet');
  s = endTurn(s); eq(s.units[t].owner, 1, 'Kontrolle „bis Zugende“ endet am Zugende');
  // Gegner verhindert den Angriff in seiner Konterphase (zerstört den übernommenen Helden)
  let s2 = game([C, NX]); phase(s2, 0, 'battle'); const t2 = put(s2, 'F', 1, 'D4'), v2 = put(s2, 'F', 1, 'D3');
  s2 = act(s2, { type: 'cast', iid: hand(s2, 0, 'CN'), choices: [[t2]] }); s2 = act(s2, { type: 'declare', uid: t2, targets: [v2] });
  s2.players[1].hand.push({ iid: 'hx', cid: 'NX' }); s2 = act(s2, { type: 'endPhase' }); eq(s2.phase, 'counter', 'Konterphase mit Antwort');
  s2 = act(s2, { type: 'cast', p: 1, iid: 'hx', choices: [[t2]] }); if (s2.phase === 'counter') s2 = act(s2, { type: 'pass', p: s2.counter });
  ok(!s2.units[t2] && !!s2.units[v2], 'Gegner zerstört den übernommenen Helden in der Konterphase – sein Angriff entfällt');
  // Kontrolle in der Konterphase des Verteidigers: Angriff des übernommenen Angreifers entfällt
  let s3 = game([C]); phase(s3, 0, 'battle'); const a3 = put(s3, 'F', 0, 'D4'), b3 = put(s3, 'F', 1, 'D3');
  s3 = act(s3, { type: 'declare', uid: a3, targets: [b3] }); s3.players[1].hand.push({ iid: 'hy', cid: 'CN' });
  s3 = act(s3, { type: 'endPhase' }); s3 = act(s3, { type: 'cast', p: 1, iid: 'hy', choices: [[a3]] }); if (s3.phase === 'counter') s3 = act(s3, { type: 'pass', p: s3.counter });
  ok(!!s3.units[b3] && s3.units[a3].owner === 1, 'Verteidiger übernimmt den Angreifer – kein Angriff');
}
console.log('Erweiterte Zauber/Fluch-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.');
process.exit(failN ? 1 : 0);
