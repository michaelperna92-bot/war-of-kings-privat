/* WAR OF KINGS – Gegner-KI für das Probe-Spiel.
 * Nutzt ausschließlich die Engine (nur legale Aktionen). decide(state, p, level, memo) liefert die nächste Aktion.
 * Stufen: 'leicht' (vorsichtig zufällig, kaum Gaben), 'mittel' (bewertet Gefahr, Ziele und Gaben).
 */
(function (root) {
  'use strict';
  const W = root.WOK || (typeof require !== 'undefined' ? require('./engine.js') : null);

  function rnd(memo) { let t = (memo.seed = (memo.seed + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const cardOf = (s, u) => s.cards[u.cid];
  function value(s, u) { const c = cardOf(s, u); if (u.king) return 50; return W.atkOf(s, u) / 1000 + W.defOf(s, u) / 1000 + c.energy * 0.25 + c.gifts.length * 0.5 + 0.5; }
  function cardValue(c) { return c.atk / 1000 + c.def / 1000 + c.energy * 0.25 + c.gifts.length * 0.5; }

  // Welche Felder kann der Gegner im nächsten Zug mit welcher ATK angreifen?
  function threatMap(s, p) {
    const e = 1 - p, map = {};
    const t = W.clone(s); t.active = e; t.phase = 'move'; t.turn = s.turn + 1;
    for (const u of Object.values(t.units)) if (u.owner === e) { u.moved = false; u.flags = {}; }
    for (const u of Object.values(t.units)) {
      if (u.owner !== e) continue;
      const c = t.cards[u.cid];
      let atk = W.atkOf(t, u); if (W.has(t, u, 'mordlust') && (u.cd.mordlust || 0) <= 1) atk += 500;
      const spots = [u.pos].concat(u.king ? [] : Object.keys(W.reachable(t, u.uid)));
      for (const pos of spots) {
        for (const [d, len] of Object.entries(c.attack.dirs)) {
          const reach = u.king ? 1 : W.has(t, u, 'schuetze') ? 2 : 1;
          for (let n = 1; n <= reach; n++) { const f = W.step(pos, d, e, n); if (f && W.exists(f)) { const k = u.king ? 'k' : 'h'; map[f] = map[f] || { h: 0, k: 0 }; map[f][k] = Math.max(map[f][k], atk); } }
        }
      }
    }
    return map;
  }
  function danger(s, u, f, tm) {
    const m = tm[f]; if (!m) return 0; const d = W.defOf(s, u), v = value(s, u);
    if (m.h > d || m.k >= d) return v * 1.2;
    if (m.h === d) return v * 0.6;
    return 0;
  }
  // Wie gut ist Feld f für Einheit u (Angriffschancen im nächsten Angriff, Gefahr, Fortschritt)?
  function posScore(s, u, f, tm, level) {
    const t = W.clone(s); const tu = t.units[u.uid]; tu.pos = f; t.phase = 'battle'; tu.summonTurn = -1;
    let best = 0;
    for (const x of W.targetsOf(t, u.uid)) {
      const tg = t.units[x.uid], pv = W.preview(t, u.uid, x.uid);
      const sc = pv.kind === 'king' ? 3 + pv.dmg / 1000 * 1.5 : pv.kind === 'win' ? value(t, tg) + 1 : pv.kind === 'both' ? value(t, tg) - value(t, tu) + 0.3 : -1;
      best = Math.max(best, sc);
    }
    const forward = u.owner === 0 ? 7 - W.rowOf(f) : W.rowOf(f) - 1;
    const ek = W.kingOf(s, 1 - u.owner), near = 6 - dist(f, ek.pos);
    return best - danger(s, u, f, tm) * (level === 'leicht' ? 0.3 : 0.8) + forward * 0.25 + near * 0.3;
  }

  // Konterphase: eine Gabe nur einsetzen, wenn sie einen festgelegten gegnerischen Angriff zu unseren Gunsten verändert
  function counterGift(s, p, memo) {
    memo.cg = memo.cg || {}; let best = null, bv = 0;
    const score = st => { let v = 0; for (const [x, d] of Object.entries(st.decl || {})) for (const t of d.targets) { const A = st.units[x], T = st.units[t]; if (!A || !T || T.king || W.isProtected(st, T) || !W.targetsOf(st, x).some(o => o.uid === t)) continue; const k = W.preview(st, x, t).kind; if (k === 'win') v -= 1; else if (k === 'lose') v += 1; else if (k === 'both') v += 0; } return v; };
    const base = score(s);
    for (const u of Object.values(s.units)) { if (u.owner !== p || u.king) continue; for (const o of W.giftOptions(s, u.uid)) { if (!o.ok || memo.cg[u.uid + o.id + s.turn]) continue; const tg = W.GIFTS[o.id].target === 'self' ? [undefined] : o.targets; for (const t of tg) { const a = { type: 'gift', p, uid: u.uid, gift: o.id, target: t }; const r = W.apply(s, a); if (r.error) continue; const v = score(r.state) - base; if (v > bv) { bv = v; best = a; } } } }
    if (best) memo.cg[best.uid + best.gift + s.turn] = 1;
    return best;
  }
  // Starthandwechsel (Werkstatt-Vorschlag): nur die eigene Hand zählt – neu ziehen ohne Held oder ohne frühe Karte (höchstens 2 Energie)
  function mulliganWanted(s, p) {
    const hand = s.players[p].hand.filter(h => s.cards[h.cid]);
    const heroes = hand.filter(h => s.cards[h.cid].type === 'hero');
    return !heroes.length || !hand.some(h => W.cost(s, p, h.cid) <= 2);
  }
  function decide(s, p, level, memo) {
    level = level || 'mittel'; memo = memo || {};
    if (memo.turn !== s.turn) { memo.turn = s.turn; memo.done = {}; memo.seed = memo.seed || (s.seed ^ 0x9e37) >>> 0; }
    const P = s.players[p], easy = level === 'leicht';
    if (s.result) return null;
    if (s.pendingDiscard === p) { const h = P.hand.slice().sort((a, b) => cardValue(s.cards[a.cid]) - cardValue(s.cards[b.cid]))[0]; return { type: 'discard', p, iid: h.iid }; }
    if (s.phase === 'mulligan') return W.mulliganOpen(s, p) ? { type: 'mulligan', p, redraw: mulliganWanted(s, p) } : null;
    if (s.phase === 'counter') { if (s.counter !== p) return null; const c = spellChoice(s, p, level, memo); return c || counterGift(s, p, memo) || { type: 'pass', p }; }
    if (s.active !== p) return null;
    const mine = () => Object.values(s.units).filter(u => u.owner === p);

    if (s.phase === 'summon1' || s.phase === 'summon2') {
      // nie die letzte Handkarte spielen, wenn der Stapel leer ist (sonst sofortige Niederlage)
      if (!P.deck.length && P.hand.length <= 1) return { type: 'endPhase', p };
      const cand = P.hand.filter(h => W.summonOptions(s, h.iid).length)
        .filter(h => easy || s.phase === 'summon2' || W.has(s, { cid: h.cid }, 'ansturm') || W.summonOptions(s, h.iid).length <= 2)
        .sort((a, b) => cardValue(s.cards[b.cid]) - cardValue(s.cards[a.cid]));
      if (easy && rnd(memo) < 0.25 && s.phase === 'summon1') return { type: 'endPhase', p };
      const h = cand[0];
      if (h) {
        const fields = W.summonOptions(s, h.iid); const tm = easy ? {} : threatMap(s, p);
        const fake = { uid: '_n', cid: h.cid, owner: p, pos: fields[0], king: false, summonTurn: -1, moved: false, cd: {}, fx: [], poison: null, flags: {} };
        let best = fields[Math.floor(rnd(memo) * fields.length)], bs = -1e9;
        if (!easy) for (const f of fields) { const t = W.clone(s); t.units._n = Object.assign({}, fake, { pos: f }); let sc = posScore(t, t.units._n, f, tm, level) + (W.isGuard(f, p) ? 0.4 : 0) + (f[0] === 'D' ? 0.2 : 0); if (sc > bs) { bs = sc; best = f; } }
        return { type: 'summon', p, iid: h.iid, field: best };
      }
      return { type: 'endPhase', p };
    }

    if (s.phase === 'move') {
      const tm = easy ? {} : threatMap(s, p);
      for (const u of mine()) {
        if (u.king || memo.done['m' + u.uid]) continue;
        const r = W.reachable(s, u.uid); const opts = Object.keys(r);
        memo.done['m' + u.uid] = 1;
        if (!opts.length) continue;
        if (easy) {
          if (rnd(memo) < 0.3) continue;
          const fw = opts.filter(f => (p === 0 ? W.rowOf(f) < W.rowOf(u.pos) : W.rowOf(f) > W.rowOf(u.pos)));
          const list = fw.length && rnd(memo) < 0.7 ? fw : opts;
          return { type: 'move', p, uid: u.uid, to: list[Math.floor(rnd(memo) * list.length)] };
        }
        let best = null, bs = posScore(s, u, u.pos, tm, level) + 0.05;
        for (const f of opts) { const sc = posScore(s, u, f, tm, level); if (sc > bs) { bs = sc; best = f; } }
        if (best) return { type: 'move', p, uid: u.uid, to: best };
      }
      return { type: 'endPhase', p };
    }

    if (s.phase === 'battle') {
      const tm = easy ? {} : threatMap(s, p);
      // 1. Gaben
      for (const u of mine()) {
        if (u.king) continue;
        for (const o of W.giftOptions(s, u.uid)) {
          const key = 'g' + u.uid + o.id; if (memo.done[key] || !o.ok) continue; memo.done[key] = 1;
          if (easy && rnd(memo) > 0.3) continue;
          const a = giftChoice(s, u, o, tm, level);
          if (a) return Object.assign({ type: 'gift', p, uid: u.uid, gift: o.id }, a);
        }
      }
      // 2. Angriffe festlegen
      for (const u of mine()) {
        if (memo.done['a' + u.uid] || !W.canAttack(s, u.uid)) continue; memo.done['a' + u.uid] = 1;
        const tg = W.attackTargets(s, u.uid); if (!tg.length) continue;
        const scored = tg.map(t => { const pv = W.preview(s, u.uid, t); const tv = value(s, s.units[t]);
          const sc = pv.kind === 'king' ? 100 + pv.dmg : pv.kind === 'win' ? 10 + tv : pv.kind === 'both' ? (easy ? -1 : tv - value(s, u)) : -1; return { t, sc, king: pv.kind === 'king' }; })
          .filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc);
        if (!scored.length) continue;
        const dbl = W.has(s, u, 'doppelschlag') && !u.king;
        let targets = [scored[0].t];
        if (dbl && !scored[0].king) { const second = scored.find(x => x.t !== scored[0].t && !x.king); if (second) targets.push(second.t); }
        return { type: 'declare', p, uid: u.uid, targets };
      }
      // 3. Zauber und Flüche (nach den Angriffen, damit die Bewertung den Kampf einschließt)
      const sp = spellChoice(s, p, level, memo); if (sp) return sp;
      return { type: 'endPhase', p };
    }
    return { type: 'endPhase', p };
  }

  function giftChoice(s, u, o, tm, level) {
    const p = u.owner, opp = 1 - p;
    const outcome = (t, dA, dD) => { const a = W.atkOf(s, u) + (dA || 0), tu = s.units[t]; if (tu.king) return 'king'; const d = Math.max(0, W.defOf(s, tu) + (dD || 0)); return a > d ? 'win' : a < d ? 'lose' : 'both'; };
    const tg = W.canAttack(s, u.uid) ? W.attackTargets(s, u.uid) : [];
    switch (o.id) {
      case 'mordlust': return tg.some(t => s.units[t].king || (outcome(t) !== 'win' && outcome(t, 500) === 'win')) ? {} : null;
      case 'entwaffnen': { const t = o.targets.find(x => tg.includes(x) && outcome(x) !== 'win' && outcome(x, 0, -500) === 'win' && !W.has(s, s.units[x], 'goettlicher_segen')); return t ? { target: t } : null; }
      case 'eisenpanzer': return danger(s, u, u.pos, tm) > 0 ? {} : null;
      case 'heilung': { const t = o.targets.map(x => s.units[x]).filter(x => x.poison || x.fx.some(e => e.negative)).sort((a, b) => value(s, b) - value(s, a))[0]; return t ? { target: t.uid } : null; }
      case 'fesseln': { const k = W.kingOf(s, p); const t = o.targets.map(x => s.units[x]).filter(x => !W.bound(x) && !W.has(s, x, 'goettlicher_segen')).sort((a, b) => dist(a.pos, k.pos) - dist(b.pos, k.pos) || value(s, b) - value(s, a))[0]; return t && dist(t.pos, k.pos) <= 4 ? { target: t.uid } : null; }
      case 'durchbruch': { const t = W.clone(s); t.units[u.uid].flags.durchbruch = true; const more = W.attackTargets(t, u.uid).filter(x => !tg.includes(x) && outcome(x) === 'win'); return more.length && !tg.some(x => outcome(x) === 'win' || s.units[x].king) ? {} : null; }
      case 'blitzschritt': {
        if (tg.some(x => s.units[x].king || outcome(x) === 'win')) return null;
        for (const f of o.targets) { const t = W.clone(s); t.units[u.uid].pos = f; const nt = W.attackTargets(t, u.uid); if (nt.some(x => t.units[x].king || W.preview(t, u.uid, x).kind === 'win') && (level === 'leicht' || danger(s, u, f, tm) === 0 || nt.some(x => t.units[x].king))) return { target: f }; }
        return null;
      }
      case 'rueckzug': { const back = W.step(u.pos, 's', p); if (!back || !W.exists(back) || W.unitAt(s, back)) return null; return danger(s, u, u.pos, tm) > 0 && danger(s, u, back, tm) === 0 ? { target: u.uid } : null; }
      case 'tausch': return null; // im Probe-Spiel nutzt die KI Tausch noch nicht
    }
    return null;
  }
  /* ---------- Zauber und Flüche ----------
   * Allgemeines Verfahren für alle Effektarten: mögliche Ziele vorschlagen, den Rest der Battlephase
   * mit der Engine durchrechnen (Gegner passt) und mit „nicht ausspielen“ vergleichen.
   */
  function evalState(s, p) {
    if (s.result) return s.result.draw ? 0 : s.result.winner === p ? 1e6 : -1e6;
    let v = 0;
    for (const u of Object.values(s.units)) {
      if (u.king) continue; const val = value(s, u), sg = u.owner === p ? 1 : -1;
      v += sg * val; if (u.poison) v -= sg * val * 0.8;
      for (const e of W.effectsOn(s, u)) if (e.src === 'spell' || e.src === 'curse') v += sg * (e.negative ? -0.35 : 0.35);
    }
    v += (W.kingOf(s, p).hp - W.kingOf(s, 1 - p).hp) / 1000 * 1.2;
    v += (Math.min(10, s.players[p].hand.length) - Math.min(10, s.players[1 - p].hand.length)) * 0.55 + (Math.min(10, s.players[p].deck.length) - Math.min(10, s.players[1 - p].deck.length)) * 0.25; // Nachziehstapel zählt erst, wenn er knapp wird
    for (const l of s.locks || []) v += (l.by === p ? 0.15 : -0.15) * l.fields.length;
    return v;
  }
  // Rest der Battlephase durchspielen: Konterphase passt, Auswertung, Kampf
  function playOut(s, p) {
    let t = s, guard = 0;
    while (!t.result && (t.phase === 'battle' || t.phase === 'counter') && guard++ < 6) {
      const a = t.phase === 'counter' ? { type: 'pass', p: t.counter } : { type: 'endPhase', p: t.active };
      const r = W.apply(t, a); if (r.error) break; t = r.state;
    }
    return t;
  }
  function pickFor(s, p, eo, eff, cardType) {
    const cands = eo.candidates.slice(), need = Math.min(eo.max, cands.length);
    const unitVal = id => { const u = s.units[id]; return u ? value(s, u) : 0; };
    let order;
    if (eo.what === 'unit' || eo.what === 'king') {
      const helpful = !(eff.kind === 'destroy' || eff.kind === 'status' || eff.kind === 'moveBlock' || eff.kind === 'giftBlock' || eff.kind === 'giftRemove' || (eff.kind === 'stat' && ((eff.params.mode || 'add') === 'set' ? cardType === 'curse' : +eff.params.amount < 0)));
      order = cands.map(c => c.id).sort((a, b) => { const ua = s.units[a], ub = s.units[b]; const sa = (ua.owner === p) === helpful ? 1 : 0, sb = (ub.owner === p) === helpful ? 1 : 0; return sb - sa || unitVal(b) - unitVal(a); });
    } else if (eo.what === 'field') {
      // Felder, die gegnerische Einheiten im nächsten Zug betreten könnten (Richtung eigener König)
      const t = W.clone(s); t.active = 1 - p; t.phase = 'move'; const hot = {};
      for (const u of Object.values(t.units)) if (u.owner !== p && !u.king) { u.moved = false; u.summonTurn = -1; for (const f of Object.keys(W.reachable(t, u.uid))) hot[f] = (hot[f] || 0) + 1; }
      const k = W.kingOf(s, p);
      order = cands.map(c => c.id).sort((a, b) => (hot[b] || 0) - (hot[a] || 0) || dist(a, k.pos) - dist(b, k.pos));
    } else if (eo.what === 'discard') {
      order = cands.map(c => c.id).sort((a, b) => cardValue(s.cards[(s.players[+b[0]].discard.find(d => d.iid === b.slice(2)) || {}).cid] || { atk: 0, def: 0, energy: 0, gifts: [] }) - cardValue(s.cards[(s.players[+a[0]].discard.find(d => d.iid === a.slice(2)) || {}).cid] || { atk: 0, def: 0, energy: 0, gifts: [] }));
    } else order = cands.map(c => c.id);
    return order.slice(0, need);
  }
  function spellChoice(s, p, level, memo) {
    const P = s.players[p], easy = level === 'leicht';
    if (!P.deck.length && P.hand.length <= 1) return null; // letzte Karte nicht verbrauchen
    const list = P.hand.filter(h => W.isSpell(s.cards[h.cid])).map(h => ({ h, o: W.castOptions(s, p, h.iid) })).filter(x => x.o.ok && !memo.done['z' + x.h.iid]);
    if (!list.length) return null;
    const base = evalState(playOut(s, p), p);
    let best = null, bestGain = 0;
    for (const { h, o } of list) {
      memo.done['z' + h.iid] = 1;
      const c = s.cards[h.cid], choices = [], place = [];
      o.effects.forEach(eo => { choices[eo.i] = eo.pick === 'player' ? pickFor(s, p, eo, c.spell.effects[eo.i], c.type) : []; if (eo.place) place[eo.i] = eo.place.slice(0, 1); });
      const a = { type: 'cast', p, iid: h.iid, choices, place };
      const r = W.apply(s, a); if (r.error) continue;
      const gain = evalState(playOut(r.state, p), p) - base - c.energy * 0.2; // die Karte selbst verlässt die Hand (in evalState enthalten)
      if (gain > bestGain) { bestGain = gain; best = a; }
    }
    if (!best) return null;
    if (easy && rnd(memo) < 0.5) return null;
    return best;
  }
  function dist(a, b) { return Math.max(Math.abs(W.colOf(a) - W.colOf(b)), Math.abs(W.rowOf(a) - W.rowOf(b))); }

  const api = { decide, mulliganWanted, threatMap, danger, giftChoice, value, spellChoice, evalState, LEVELS: [{ id: 'leicht', name: 'Leicht' }, { id: 'mittel', name: 'Mittel' }] };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WOK_AI = api;
})(typeof window !== 'undefined' ? window : globalThis);
