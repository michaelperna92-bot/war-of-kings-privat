/* WAR OF KINGS – Deck-KI: baut, prüft und repariert Decks nach den Regeln des Master-Regelwerks.
 * Läuft komplett ohne Internet. Ein Sprachmodell (Claude in der Cloud bzw. die KI-Verbindung der Werkstatt am PC)
 * kann darauf aufbauen, die Entscheidungen hier bleiben aber immer regelkonform (40 Karten, 1 König, Kopienlimit).
 */
(function (root) {
  'use strict';
  const W = root.WOK || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const GIFT_VALUE = { mordlust: 0.5, entwaffnen: 0.5, eisenpanzer: 0.45, tausch: 0.3, blitzschritt: 0.5, rueckzug: 0.35, heilung: 0.45, fesseln: 0.6, durchbruch: 0.5, doppelschlag: 0.9, poison: 0.9, goettlicher_segen: 0.6, ansturm: 0.6, schuetze: 0.8 };
  const STYLES = {
    ausgewogen: { name: 'Ausgewogen', wa: 1, wd: 1, curve: [7, 13, 11, 6, 2], rush: 0.6, spells: 8 },
    aggressiv: { name: 'Aggressiv (schnell Druck auf den König)', wa: 1.4, wd: 0.7, curve: [9, 14, 10, 5, 1], rush: 1, spells: 6 },
    defensiv: { name: 'Defensiv (halten, dann zurückschlagen)', wa: 0.75, wd: 1.4, curve: [6, 12, 11, 7, 3], rush: 0.4, spells: 10 }
  };
  const BUCKETS = [[0, 2], [3, 4], [5, 6], [7, 8], [9, 10]];
  const bucketOf = e => BUCKETS.findIndex(([a, b]) => e >= a && e <= b);
  const lim = c => c.type === 'king' ? 1 : (W.COPY_LIMIT[c.rarity] || 1);
  const FORWARD = ['n', 'ne', 'nw'];

  // Wie viel bringt eine Königsgabe dieser Karte?
  function royalFor(c, king, st) {
    if (!king) return 0; let v = 0;
    for (const g of king.gifts) {
      if (!W.matches(c, g)) continue;
      const R = W.ROYAL[g.id] || {};
      if (R.stat === 'atk') v += g.amount / 1000 * 1.2 * st.wa;
      if (R.stat === 'def') v += g.amount / 1000 * 1.2 * st.wd;
      if (R.stat === 'energy') v += Math.min(g.amount, c.energy) * 0.35;
    }
    return v;
  }
  function focusHit(c, focus) {
    if (!focus || !focus.scope) return false;
    return focus.scope === 'race' ? c.races.includes(focus.target) : focus.scope === 'class' ? c.classes.includes(focus.target) : focus.scope === 'element' ? c.elements.includes(focus.target) : false;
  }
  // Grundwert eines Helden, ohne Kosten
  function heroValue(c, king, st, focus) {
    let v = c.atk / 1000 * st.wa + c.def / 1000 * st.wd;
    for (const g of c.gifts) v += (GIFT_VALUE[g.id] || 0.3) * (g.id === 'ansturm' ? st.rush / 0.6 : 1);
    v += (c.move.steps || 0) * 0.22 + (c.move.dirs.includes('n') ? 0.3 : -0.6);
    const ad = Object.keys(c.attack.dirs); v += ad.length * 0.1 + ad.filter(d => FORWARD.includes(d)).length * 0.12;
    if (!ad.length) v -= 1;
    v += royalFor(c, king, st);
    if (focusHit(c, focus)) v *= 1.3;
    if (c.issues && c.issues.length) v *= 0.5;
    return v;
  }
  const effective = (c, king) => { let e = c.energy; if (king) for (const g of king.gifts) if ((W.ROYAL[g.id] || {}).stat === 'energy' && W.matches(c, g)) e -= g.amount; return Math.max(0, e); };
  const score = (c, king, st, focus) => heroValue(c, king, st, focus) * 4 / (effective(c, king) + 3);
  // Zauber/Fluch: grobe Werkstatt-Schätzung (kein Regelwert), damit die Deck-KI sie sinnvoll mischt
  const KIND_VALUE = { control: 2.6, discard: 1.1, mill: 0.4, destroy: 3.2, status: 2.4, moveBlock: 1.0, giftBlock: 0.9, giftRemove: 1.0, fieldLock: 0.7, revive: 2.8, protect: 1.6, deathWard: 1.6, neutralize: 1.5 };
  function spellValue(c, st) {
    if (!c.playable) return 0; let v = 0;
    for (const e of c.spell.effects) {
      const t = e.target || {}, mult = t.count === 'all' ? 1.8 : t.count === 'n' ? Math.min(3, +t.n || 1) * 0.8 : 1, P = e.params || {};
      const dur = !e.duration || e.duration.kind === 'turn' ? 1 : e.duration.kind === 'rounds' ? Math.min(2, 1 + 0.3 * ((+e.duration.n || 1) - 1)) : e.duration.kind === 'permanent' ? 1.8 : 1.3;
      let k = e.kind === 'damage' ? (+P.amount || 0) / 1000 * (P.per && P.per !== 'fixed' ? 3 : 1) * 1.3 : e.kind === 'draw' ? (+P.n || 1) * 0.9 : e.kind === 'stat' ? Math.abs(+P.amount || 0) / 1000 * 1.6 * (P.stat === 'move' ? 600 : 1) * (P.stat === 'def' ? st.wd : st.wa) : e.kind === 'heal' ? (+P.amount || 0) / 1500 : KIND_VALUE[e.kind] || 0.7;
      if (['stat', 'moveBlock', 'giftBlock', 'protect', 'deathWard', 'fieldLock'].includes(e.kind)) k *= dur;
      v += k * mult;
    }
    return v;
  }
  const spellScore = (c, st) => spellValue(c, st) * 1.25 * 4 / ((+c.energy || 0) + 3); // 1,25: flexibel einsetzbar, belegt kein Feld (Schätzung)
  function kingValue(k, st) { return k.atk / 1000 * st.wa + k.hp / 10000 + Object.keys(k.attack.dirs).length * 0.3 + k.gifts.length * 0.4; }

  // Deck bauen. opts: { style, kingId, focus: {scope, target}, keep: [ids] (Pflichtkarten) }
  function build(cards, opts) {
    opts = opts || {}; const st = STYLES[opts.style] || STYLES.ausgewogen;
    const all = Object.values(cards), kings = all.filter(c => c.type === 'king'), heroes = all.filter(c => c.type === 'hero'), spells = all.filter(c => W.isSpell(c) && c.playable);
    if (!kings.length) return { ok: false, error: 'In der Sammlung ist kein König. Lade zuerst einen König aus der Werkstatt.' };
    if (!heroes.length) return { ok: false, error: 'In der Sammlung sind keine Helden.' };
    const tryKing = k => {
      const ids = [k.id], cnt = {};
      const keep = (opts.keep || []).filter(id => cards[id] && (cards[id].type === 'hero' || W.isSpell(cards[id])));
      for (const id of keep) if ((cnt[id] || 0) < lim(cards[id]) && ids.length < 40) { ids.push(id); cnt[id] = (cnt[id] || 0) + 1; }
      const slots = heroes.flatMap(c => Array.from({ length: lim(c) }, (_, i) => ({ c, i, s: score(c, k, st, opts.focus) * (1 - 0.07 * i) })));
      const take = (list, n) => { for (const x of list) { if (n <= 0 || ids.length >= 40) break; if ((cnt[x.c.id] || 0) !== x.i) continue; ids.push(x.c.id); cnt[x.c.id] = x.i + 1; n--; } };
      // Zauber/Flüche: die besten, solange sie etwa so viel bringen wie der schwächste Held, der dafür weicht (höchstens st.spells)
      if (opts.spells !== false && spells.length) {
        const hs = slots.map(x => x.s).sort((a, b) => b - a), med = hs[Math.max(0, Math.min(hs.length - 1, 38 - st.spells))] || 0; // der Held, der für einen Zauber weichen würde
        const haveSp = ids.filter(id => W.isSpell(cards[id])).length;
        const spSlots = spells.flatMap(c => Array.from({ length: lim(c) }, (_, i) => ({ c, i, s: spellScore(c, st) * (1 - 0.12 * i) }))).filter(x => x.s >= med * 0.75).sort((a, b) => b.s - a.s);
        take(spSlots, Math.max(0, st.spells - haveSp));
      }
      // nach Kostenkurve füllen (auf die freien Plätze umgerechnet), dann Rest nach Wert
      const free = 39 - ids.slice(1).filter(id => W.isSpell(cards[id])).length, curveLeft = st.curve.map(n => Math.round(n * free / 39));
      for (const id of ids.slice(1)) { if (W.isSpell(cards[id])) continue; const b = bucketOf(effective(cards[id], k)); if (b >= 0) curveLeft[b]--; }
      BUCKETS.forEach((_, b) => take(slots.filter(x => bucketOf(effective(x.c, k)) === b).sort((p, q) => q.s - p.s), Math.max(0, curveLeft[b])));
      take(slots.slice().sort((p, q) => q.s - p.s), 40 - ids.length);
      const total = ids.slice(1).reduce((a, id) => a + (W.isSpell(cards[id]) ? spellScore(cards[id], st) : score(cards[id], k, st, opts.focus)), 0) + kingValue(k, st) * 3;
      return { ids, total };
    };
    const cand = opts.kingId && cards[opts.kingId] ? [cards[opts.kingId]] : kings;
    const best = cand.map(k => Object.assign(tryKing(k), { king: k })).sort((a, b) => b.total - a.total)[0];
    const v = W.validateDeck(best.ids, cards);
    return { ok: v.ok, ids: best.ids, king: best.king, why: explainBuild(best.ids, cards, best.king, st, opts), validation: v };
  }

  // Bestehendes Deck reparieren und auffüllen, ohne gewählte Karten unnötig zu entfernen
  function repair(ids, cards, opts) {
    const keep = [], cnt = {}; let king = null;
    for (const id of ids) { const c = cards[id]; if (!c) continue; if (c.type === 'king') { if (!king) king = c; continue; } if (W.isSpell(c) && !c.playable) continue; if ((cnt[id] || 0) < lim(c)) { keep.push(id); cnt[id] = (cnt[id] || 0) + 1; } }
    return build(cards, Object.assign({}, opts, { kingId: (king || {}).id || (opts && opts.kingId), keep: keep.slice(0, 39) }));
  }

  function explainBuild(ids, cards, king, st, opts) {
    const a = analyze(ids, cards), out = [];
    out.push('König: ' + king.name + ' (ATK ' + king.atk + ', ' + king.hp + ' HP' + (king.gifts.length ? ', ' + king.gifts.length + ' königliche Gabe(n)' : '') + ').');
    for (const s of a.synergy) out.push(s.text);
    if (a.spells) out.push(a.spells + ' Zauber/Flüche: ' + a.spellNames + '.');
    out.push('Kostenkurve der Helden: ' + a.curveText + ' (Durchschnitt ' + a.avgCost.toFixed(1).replace('.', ',') + ' Energie). Stil: ' + st.name + '.');
    if (opts && opts.focus && opts.focus.scope) out.push('Schwerpunkt: ' + a.focusCount(opts.focus) + ' Karten passen zum gewählten Schwerpunkt.');
    return out;
  }

  // Deck prüfen: Zahlen, Synergien und konkrete Hinweise
  function analyze(ids, cards) {
    const list = ids.map(id => cards[id]).filter(Boolean), king = list.find(c => c.type === 'king'), heroes = list.filter(c => c.type === 'hero'), sp = list.filter(c => W.isSpell(c));
    const curve = [0, 0, 0, 0, 0], perCost = Array(11).fill(0);
    let sum = 0; for (const c of heroes) { const e = effective(c, king); curve[bucketOf(e)]++; perCost[Math.min(10, e)]++; sum += e; }
    const avgCost = heroes.length ? sum / heroes.length : 0;
    const gifts = {}; for (const c of heroes) for (const g of c.gifts) gifts[g.id] = (gifts[g.id] || 0) + 1;
    const synergy = [];
    if (king) for (const g of king.gifts) {
      const n = heroes.filter(c => W.matches(c, g)).length, nm = (W.ROYAL[g.id] || {}).name || g.id;
      const who = g.scope === 'all' || !g.scope ? 'alle Helden' : g.target;
      synergy.push({ gift: g.id, n, text: nm + ' wirkt auf ' + n + ' von ' + heroes.length + ' Helden' + (g.scope && g.scope !== 'all' ? ' (nur ' + ({ race: 'Rasse', class: 'Klasse', element: 'Element' }[g.scope]) + ' ' + who + ')' : '') + '.' });
    }
    const v = W.validateDeck(ids, cards), tips = [], warn = v.errors.slice();
    const cheap = perCost.slice(0, 4).reduce((a, b) => a + b, 0);
    if (heroes.length >= 20 && cheap < 8) tips.push('Nur ' + cheap + ' Helden kosten 0–3 Energie. In den Zügen 1–3 hast du nur 1–3 Energie, du stehst dann lange ohne Kämpfer da. Ziel: 8–12 billige Helden.');
    const pricey = perCost.slice(7).reduce((a, b) => a + b, 0);
    if (pricey > 9) tips.push(pricey + ' Helden kosten 7 oder mehr. Die kannst du erst ab Zug 7 spielen; mehr als 6–8 machen die Hand schwer.');
    for (const s of synergy) if (s.n < heroes.length * 0.4 && s.n < 12) tips.push(s.text + ' Mehr passende Helden würden die Königsgabe besser nutzen.');
    const noFwd = heroes.filter(c => !c.move.dirs.includes('n')).length;
    if (noFwd > 4) tips.push(noFwd + ' Helden können nicht vorwärts laufen. Sie kommen kaum an den gegnerischen König heran.');
    const noAtk = heroes.filter(c => !Object.keys(c.attack.dirs).length).length;
    if (noAtk) tips.push(noAtk + ' Helden haben keine Angriffsrichtung und können nie angreifen.');
    const fwdAtk = heroes.filter(c => Object.keys(c.attack.dirs).some(d => FORWARD.includes(d))).length;
    if (heroes.length >= 20 && fwdAtk < heroes.length * 0.6) tips.push('Nur ' + fwdAtk + ' Helden greifen nach vorn an. Gegen den König zählen Angriffe nach vorn und schräg vorn.');
    if (heroes.length >= 20 && !gifts.heilung && (gifts.poison || 0) === 0) tips.push('Keine Heilung im Deck: gegnerisches Poison oder Fesseln kannst du nicht entfernen.');
    const dead = [...new Set(sp.filter(c => !c.playable).map(c => c.name))];
    if (dead.length) tips.push('Nicht spielbare Zauber/Flüche im Deck: ' + dead.slice(0, 5).join(', ') + '. Sie können nicht ausgespielt werden – in der Werkstatt Abgleich bestätigen bzw. offene Regeln klären.');
    if (sp.length > 14) tips.push(sp.length + ' Zauber/Flüche: Zauber brauchen Helden auf dem Feld als Ziel. Mehr als 10–12 machen das Deck schwach (Werkstatt-Vorschlag, keine Regel).');
    const bad = [...new Set(list.filter(c => c.issues && c.issues.length).map(c => c.name))];
    if (bad.length) tips.push('Karten mit Fehlern aus der Werkstatt: ' + bad.slice(0, 5).join(', ') + (bad.length > 5 ? ' …' : '') + '. Am besten dort reparieren und neu exportieren.');
    const curveText = BUCKETS.map(([a, b], i) => (a === b ? a : a + '–' + b) + ': ' + curve[i]).join(' · ');
    const atk = heroes.reduce((a, c) => a + c.atk, 0) / (heroes.length || 1), def = heroes.reduce((a, c) => a + c.def, 0) / (heroes.length || 1);
    const spNames = [...new Set(sp.map(c => c.name))];
    return { count: list.length, king, heroes: heroes.length, spells: sp.length, spellNames: spNames.slice(0, 6).join(', ') + (spNames.length > 6 ? ' …' : ''), curve, perCost, curveText, avgCost, avgAtk: atk, avgDef: def, gifts, synergy, tips, warnings: warn, valid: v.ok,
      focusCount: f => heroes.filter(c => focusHit(c, f)).length };
  }

  // Kompakte Kartenliste für ein Sprachmodell
  function cardLine(c, names) {
    const n = (k, id) => (names && names[k] && names[k][id]) || id;
    if (W.isSpell(c)) return [c.id, c.name, c.type === 'curse' ? 'FLUCH' : 'ZAUBER', n('rarities', c.rarity) + ' (max ' + lim(c) + '×)', 'Kosten ' + c.energy, 'Wirkung: ' + c.ruleText, c.playable ? '' : 'NICHT SPIELBAR: ' + c.notPlayable[0]].filter(Boolean).join(' | ');
    const g = c.gifts.map(x => c.type === 'king' ? n('gifts', x.id) + '[' + (x.scope || 'all') + (x.target ? ':' + n(x.scope === 'race' ? 'races' : x.scope === 'class' ? 'classes' : 'elements', x.target) : '') + ' ' + x.amount + ']' : n('gifts', x.id)).join(', ');
    return [c.id, c.name, c.type === 'king' ? 'KÖNIG' : 'Held', n('rarities', c.rarity) + ' (max ' + lim(c) + '×)', c.type === 'king' ? 'ATK ' + c.atk + ' HP ' + c.hp : 'Kosten ' + c.energy + ' ATK ' + c.atk + ' DEF ' + c.def,
      [].concat(c.races.map(x => n('races', x)), c.classes.map(x => n('classes', x)), c.elements.map(x => n('elements', x))).join('/'),
      c.type === 'king' ? '' : 'läuft ' + c.move.steps + ' [' + c.move.dirs.join(',') + ']', 'greift an [' + Object.entries(c.attack.dirs).map(([d, l]) => l > 1 ? d + l : d).join(',') + ']', g ? 'Gaben: ' + g : '', c.issues && c.issues.length ? 'FEHLER: ' + c.issues[0] : ''].filter(Boolean).join(' | ');
  }

  const api = { build, repair, analyze, cardLine, STYLES, score, heroValue, spellValue };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WOK_DECKAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
