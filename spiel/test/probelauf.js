// Großer Probelauf (31.10.2026): Der Generator der Kartenwerkstatt baut Hunderte zufällige Zauber und Flüche in allen
// Einstellungen. Jede Karte muss im Spiel laden, spielbar sein, in passenden Lagen gültige Ziele haben und ohne Fehler wirken;
// dazu ganze KI-Partien mit diesen Karten. Aufruf: node test/probelauf.js [Karten] [Partien]
global.window = global; const CC = require('../ccpath.js'); require(require('path').join(CC, 'data.js'));
const EF = require(require('path').join(CC, 'effects.js')); global.WOK_EFFECTS = EF; const GEN = require(require('path').join(CC, 'spell-gen.js')); delete global.window;
const W = require('../src/engine.js'); globalThis.WOK = W; const AI = require('../src/ai.js'); const D = global.WOK_DATA;
const fs = require('fs'); const src = fs.readFileSync(__dirname + '/../src/demo-cards.js', 'utf8'); const DEMO = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
const NC = +process.argv[2] || 600, NG = +process.argv[3] || 60;
let seed = 4711; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const out = { karten: 0, ladefehler: 0, nichtSpielbar: [], wirkfehler: 0, ohneZiel: 0, partien: 0, partieFehler: 0, ausnahmen: 0, gewirkt: 0, version2: 0, arten: {} };
// 1) Karten bauen wie der Export der Werkstatt (Regeltext, Abgleich, Formatversion)
const spells = [];
for (let i = 0; i < NC; i++) {
  const c = GEN.random({ type: i % 2 ? 'curse' : 'spell', rng, D }); if (!c) continue;
  c.id = 'pz' + i; c.ruleText = EF.describe(c, D); c.spell.sync = EF.hash(c); c.spell.v = EF.needVersion(c.spell); c.spellFormat = EF.FORMAT;
  out.karten++; if (c.spell.v === 2) out.version2++;
  for (const e of c.spell.effects) { const k = e.kind + (e.params.extraMove ? '+lauf' : '') + (e.params.block === false ? '+durch' : e.params.block === true ? '+abwehr' : '') + (e.trigger === 'enemyAttack' ? '@angriff' : ''); out.arten[k] = (out.arten[k] || 0) + 1; }
  let n; try { n = W.normalizeCard(JSON.parse(JSON.stringify(c))); } catch (x) { out.ladefehler++; console.log('Ladefehler', c.name, x.message); continue; }
  if (!n.playable) { out.nichtSpielbar.push(c.name + ': ' + n.notPlayable.join(' ')); continue; }
  spells.push(n);
}
// 2) Jede Karte in einer passenden Lage wirken (eigene Battlephase bzw. Konterphase mit Angriff)
const heroes = DEMO.cards.filter(c => c.type === 'hero').map(c => W.normalizeCard(c)), kings = DEMO.cards.filter(c => c.type === 'king').map(c => W.normalizeCard(c));
function scene(sp, counter) {
  const cards = {}; for (const h of heroes) cards[h.id] = h; for (const k of kings) cards[k.id] = k; cards[sp.id] = sp;
  const deck = k => [k].concat(heroes.slice(0, 13).flatMap(h => [h.id, h.id, h.id]));
  let s = W.newGame({ cards, decks: [deck(kings[0].id), deck(kings[1].id)], seed: 99, fixedSides: true, mulligan: false }).state;
  for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
  const put = (cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
  // Helden aller Rassen/Klassen/Elemente auf beiden Seiten, Ablagestapel gefüllt (für Bedingungen und Wiederbeleben)
  const pos0 = ['A5', 'B5', 'C5', 'E5', 'F5', 'G5', 'C6', 'E6'], pos1 = ['A2', 'B2', 'C2', 'E2', 'F2', 'G2', 'B3', 'F3', 'D3'];
  pos0.forEach((f, k) => put(heroes[k % heroes.length].id, 0, f)); pos1.forEach((f, k) => put(heroes[(k + 3) % heroes.length].id, 1, f));
  for (let p = 0; p < 2; p++) { s.players[p].discard = heroes.slice(0, 8).map((h, k) => ({ iid: 'dd' + p + k, cid: h.id })); s.players[p].energy = 10; s.players[p].turns = 5; s.players[p].hand = []; for (let k = 0; k < 4; k++) s.players[p].hand.push(s.players[p].deck.shift()); }
  s.stack = [];
  const me = counter ? 1 : 0; s.players[me].hand.push({ iid: 'cast', cid: sp.id });
  s.active = 0; s.phase = 'battle'; s.counter = null; s.decl = {};
  if (counter) { // Spieler 0 greift mit zwei Helden an, Spieler 1 kontert
    const att = Object.values(s.units).filter(u => u.owner === 0 && !u.king);
    for (const a of att) { const t = W.targetsOf(s, a.uid); if (t.length) { const r = W.apply(s, { type: 'declare', uid: a.uid, targets: [t[0].uid] }); if (!r.error) s = r.state; } if (Object.keys(s.decl).length >= 2) break; }
    const r = W.apply(s, { type: 'endPhase' }); s = r.state;
    if (s.phase !== 'counter') return null; // Konterphase nicht zustande gekommen (kann bei manchen Lagen vorkommen)
  }
  return { s, me };
}
for (const sp of spells) {
  const timings = sp.spell.timing === 'both' ? [false, true] : [sp.spell.timing === 'counter'];
  for (const counter of timings) {
    let sc; try { sc = scene(sp, counter); } catch (x) { out.ausnahmen++; console.log('Ausnahme Szene', sp.name, x.message); continue; }
    if (!sc) continue; let { s, me } = sc;
    let o; try { o = W.castOptions(s, me, 'cast'); } catch (x) { out.ausnahmen++; console.log('Ausnahme castOptions', sp.name, x.message); continue; }
    if (!o.ok) { out.ohneZiel++; const why = String(o.why || ''); const k = /Voraussetzung/.test(why) ? 'Voraussetzung der Karte in der Testlage nicht erfüllt' : why.replace(/„[^“]*“/g, '…').slice(0, 80); out.gruende = out.gruende || {}; out.gruende[k] = (out.gruende[k] || 0) + 1; if (/nur in deiner/.test(why) || !/Voraussetzung|kein gültiges Ziel/.test(why)) console.log('PRÜFEN', sp.name, sp.spell.timing, counter, s.phase, s.counter, me, sp.ruleText, why); if (!/Voraussetzung/.test(why) && (out.andere = (out.andere || 0) + 1) <= 0) console.log('nicht wirkbar:', sp.name, '|', sp.spell.timing, counter ? 'Konter' : 'Battle', '|', sp.ruleText, '|', why); continue; }
    const choices = o.effects.map(eo => eo.pick === 'player' ? eo.candidates.slice(0, Math.max(1, eo.max || 1)).map(x => x.id) : []);
    const place = o.effects.map(eo => eo.place ? eo.place.slice(0, 1) : []);
    try {
      let r = W.apply(s, { type: 'cast', p: me, iid: 'cast', choices, place });
      if (r.error) { out.wirkfehler++; if (out.wirkfehler <= 5) console.log('Wirkfehler', sp.name, r.error); continue; }
      s = r.state; out.gewirkt++;
      // bis zur Auswertung weiterspielen
      for (let k = 0; k < 12 && !s.result && s.turn < 4; k++) { const p = W.actor(s); const a = s.phase === 'counter' ? { type: 'pass', p } : { type: 'endPhase', p }; r = W.apply(s, a); if (r.error) break; s = r.state; if (s.phase === 'summon2') break; }
    } catch (x) { out.ausnahmen++; console.log('Ausnahme beim Wirken', sp.name, x.stack.split('\n').slice(0, 3).join(' | ')); }
  }
}
// 3) Ganze KI-Partien mit diesen Karten (jedes Deck: König + 30 Helden + 9 Zufallskarten)
for (let g = 0; g < NG; g++) {
  const cards = {}; for (const h of heroes) cards[h.id] = h; for (const k of kings) cards[k.id] = k;
  const pick = () => spells[Math.floor(rng() * spells.length)];
  const mk = k => { const ids = [k]; for (let i = 0; i < 30; i++) ids.push(heroes[i % 10].id); const used = {}; while (ids.length < 40) { const sp = pick(); if ((used[sp.id] || 0) >= 1) continue; used[sp.id] = 1; cards[sp.id] = sp; ids.push(sp.id); } return ids; };
  let state; try { state = W.newGame({ cards, decks: [mk(kings[0].id), mk(kings[1].id)], seed: 500 + g }).state; } catch (x) { out.ausnahmen++; console.log('Ausnahme newGame', x.message); continue; }
  const memo = [{ seed: g + 1 }, { seed: g + 7 }]; let steps = 0;
  try {
    while (!state.result && steps++ < 20000) {
      const p = W.actor(state); const a = AI.decide(state, p, 'mittel', memo[p]) || { type: state.phase === 'counter' ? 'pass' : 'endPhase', p };
      let r = W.apply(state, a);
      if (r.error) { r = W.apply(state, { type: state.phase === 'counter' ? 'pass' : state.phase === 'mulligan' ? 'mulligan' : 'endPhase', p }); if (r.error) { out.partieFehler++; console.log('Partie hängt:', r.error, state.phase); break; } }
      state = r.state;
    }
    if (!state.result) { out.partieFehler++; console.log('Partie ohne Ende nach', steps, 'Schritten'); }
    out.partien++;
  } catch (x) { out.ausnahmen++; console.log('Ausnahme in Partie', g, x.stack.split('\n').slice(0, 3).join(' | ')); }
}
const bad = out.ladefehler + out.nichtSpielbar.length + out.wirkfehler + out.ausnahmen + out.partieFehler;
console.log(JSON.stringify(Object.assign({}, out, { nichtSpielbar: out.nichtSpielbar.slice(0, 5) }), null, 1));
console.log('Probelauf: ' + out.karten + ' Werkstatt-Karten, ' + out.gewirkt + ' Mal gewirkt, ' + out.partien + ' KI-Partien – ' + (bad ? bad + ' FEHLER' : 'fehlerfrei') + (out.ohneZiel ? ' (' + out.ohneZiel + ' Lagen ohne passendes Ziel – kein Fehler, nur zur Info)' : '') + '.');
process.exit(bad ? 1 : 0);
