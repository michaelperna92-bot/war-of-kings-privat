/* War of Kings – Power-Scaling V1.4 (Entwurf vom 27.10.2026) und Zufallsgenerator.
 * Rohstärke: ATK + DEF + Bewegung + angreifbare Nachbarfelder + Gaben + Synergie. Seltenheit nach Rohstärke.
 * Balancepunkte = Rohstärke × Energiefaktor (gerundet), nur als Effizienz-Diagnose.
 */
window.WOK_POWER = (function () {
  'use strict';
  const D = window.WOK_DATA;
  const SOURCE = 'Power-Scaling V1.4, Entwurf vom 27.10.2026';
  const BANDS = [
    { id: 'gewoehnlich', lo: 0, hi: 29, energy: [1, 3] },
    { id: 'ungewoehnlich', lo: 30, hi: 49, energy: [3, 5] },
    { id: 'selten', lo: 50, hi: 74, energy: [5, 7] },
    { id: 'legendaer', lo: 75, hi: 100, energy: [7, 10] }
  ];
  const MOVE_PTS = { 1: 3, 2: 8, 3: 13 };          // V1.4: 3 Felder wieder zugelassen
  const ENERGY_FACTOR = { 1: 1.35, 2: 1.30, 3: 1.25, 4: 1.15, 5: 1.00, 6: 0.95, 7: 0.90, 8: 0.85, 9: 0.80, 10: 0.75 };
  const FIELD_PTS = [0, 2, 5, 8, 11, 14, 14, 14, 14];
  const GIFT_PTS = { rueckzug: 6, eisenpanzer: 7, mordlust: 8, entwaffnen: 8, blitzschritt: 9, tausch: 10, poison: 13, doppelschlag: 14, goettlicher_segen: 15 };
  const UNSCORED = ['heilung', 'fesseln', 'durchbruch']; // offene Entwürfe laut V1.4
  const SYNERGY = [[0, 'Keine relevante Synergie'], [3, 'Sinnvolle Kombination'], [6, 'Sehr starke Kombination'], [9, 'Außergewöhnliche Kombination']];
  const MANUAL_CHECK = [['poison', 'doppelschlag']];   // vom Power-Scaling ausdrücklich genannt
  // Verteilung für „Gemischt“ aus Balancing.xlsx (Wahrscheinlichkeiten Gewöhnlich/Ungewöhnlich/Selten/Legendär)
  const MIX = [['gewoehnlich', 0.64], ['ungewoehnlich', 0.24], ['selten', 0.10], ['legendaer', 0.02]];
  // Season-1-Spielinhalt laut Master-Regelwerk
  const SEASON1 = { races: ['mensch', 'tierwesen', 'bestien', 'maschinen', 'drachen'], classes: ['pirat', 'samurai', 'magier', 'baendiger'], elements: ['feuer', 'wasser', 'wind', 'erde', 'blitz'] };

  const statPts = v => (+v || 0) / 500 * 3;
  function moveRange(card) {
    const m = card.move || {}; const dirs = Object.values(m.dirs || {}).filter(Boolean);
    if (m.showNumber && +m.number) return +m.number;
    if (!dirs.length) return 0;
    return Math.max(...dirs.map(v => v === true ? 1 : +v));
  }
  function attackFields(card) { return Object.values((card.attack || {}).dirs || {}).filter(Boolean).length; }
  // Schwellen: unter 30 Gewöhnlich, unter 50 Ungewöhnlich, unter 75 Selten, ab 75 Legendär (auch bei Nachkommastellen)
  function bandOf(total) { return total < 30 ? BANDS[0] : total < 50 ? BANDS[1] : total < 75 ? BANDS[2] : BANDS[3]; }
  function rarityName(id) { return (D.RARITIES.find(r => r.id === id) || {}).name || id; }
  const r1 = x => Math.round(x * 10) / 10;

  /* Gesamt-Power einer Karte mit offengelegter Aufschlüsselung */
  function evaluate(card) {
    const rows = [], notes = [];
    const atk = statPts(card.atk), def = statPts(card.def);
    rows.push(['ATK ' + (card.atk || 0), r1(atk)], ['DEF ' + (card.def || 0), r1(def)]);
    const mr = moveRange(card); let mp = 0;
    if (mr > 3) notes.push({ level: 'warn', text: 'Bewegung über 3 Felder ist im Power-Scaling nicht vorgesehen.' });
    else mp = MOVE_PTS[mr] || 0;
    rows.push(['Bewegung ' + mr + (mr === 1 ? ' Feld' : ' Felder'), mp]);
    const af = attackFields(card);
    rows.push([af + ' angreifbare Nachbarfelder', FIELD_PTS[Math.min(8, af)]]);
    let gp = 0; const ids = (card.gifts || []).map(g => g.id);
    for (const id of ids) {
      const g = D.GIFTS.find(x => x.id === id), nm = g ? D.giftTitle(g) : id;
      if (GIFT_PTS[id] !== undefined) { rows.push([nm, GIFT_PTS[id]]); gp += GIFT_PTS[id]; }
      else { rows.push([nm, null]); notes.push({ level: 'warn', text: nm + ' ist im Power-Scaling V1.4 noch nicht bewertet (offener Entwurf). Die Summe ist deshalb zu niedrig.' }); }
    }
    for (const [a, b] of MANUAL_CHECK) if (ids.includes(a) && ids.includes(b)) notes.push({ level: 'warn', text: 'Poison + Doppelschlag ist laut Power-Scaling eine starke Kombination und muss manuell geprüft werden. Wähle einen passenden Synergiebonus.' });
    const syn = +(card.synergy || 0);
    rows.push(['Synergiebonus', syn]);
    const total = r1(atk + def + mp + FIELD_PTS[Math.min(8, af)] + gp + syn);
    const band = bandOf(total);
    if (total > 100) notes.push({ level: 'warn', text: 'Über 100 Punkte: laut Power-Scaling gesondert prüfen.' });
    const e = +card.energy, hasE = card.energy !== '' && card.energy != null && ENERGY_FACTOR[e] !== undefined;
    const balance = hasE ? Math.round(total * ENERGY_FACTOR[e]) : null;
    if (card.energy !== '' && card.energy != null && (e < band.energy[0] || e > band.energy[1])) notes.push({ level: 'info', text: 'Energie ' + e + ' liegt außerhalb der typischen ' + band.energy[0] + '–' + band.energy[1] + ' für ' + rarityName(band.id) + '.' });
    if (card.rarity && card.rarity !== band.id) notes.push({ level: 'warn', text: 'Gewählt ist ' + rarityName(card.rarity) + ', das Power-Scaling ergibt ' + rarityName(band.id) + ' (' + total + ' Punkte).' });
    return { rows, total, rarity: band.id, energy: band.energy, suggestedEnergy: energyFor(total), balance, factor: hasE ? ENERGY_FACTOR[e] : null, notes };
  }
  function energyFor(total) {
    // Gewöhnlich: kleinste mögliche Karte (300/300, 1 Feld, 1 Richtung) hat etwa 9 Punkte, darum Skala ab 9
    const b = bandOf(total), lo = b.id === 'gewoehnlich' ? 9 : b.lo, t = Math.max(0, Math.min(1, (total - lo) / (b.hi - lo)));
    return b.energy[0] + Math.round(t * (b.energy[1] - b.energy[0]));
  }

  /* ---------- Zufallsgenerator ---------- */
  function pickW(rng, list) { let s = 0; for (const [, w] of list) s += w; let r = rng() * s; for (const [v, w] of list) { r -= w; if (r <= 0) return v; } return list[list.length - 1][0]; }
  function pick(rng, a) { return a[Math.floor(rng() * a.length)]; }
  function shuffle(rng, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const PROFILE = {
    gewoehnlich: { target: [9, 29], gifts: [[0, 0.5], [1, 0.5]], move: [[1, 0.88], [2, 0.12]], fields: [[1, 0.25], [2, 0.4], [3, 0.35]] },
    ungewoehnlich: { target: [30, 49], gifts: [[0, 0.15], [1, 0.7], [2, 0.15]], move: [[1, 0.6], [2, 0.35], [3, 0.05]], fields: [[2, 0.35], [3, 0.5], [4, 0.15]] },
    selten: { target: [50, 74], gifts: [[1, 0.45], [2, 0.55]], move: [[1, 0.35], [2, 0.5], [3, 0.15]], fields: [[3, 0.5], [4, 0.4], [5, 0.1]] },
    legendaer: { target: [75, 100], gifts: [[2, 0.6], [3, 0.4]], move: [[1, 0.2], [2, 0.5], [3, 0.3]], fields: [[3, 0.3], [4, 0.45], [5, 0.25]] }
  };
  const ATK_PATTERNS = { 1: [['n']], 2: [['n', 's'], ['w', 'e'], ['nw', 'ne']], 3: [['n', 'w', 'e'], ['n', 'nw', 'ne']], 4: [['n', 's', 'w', 'e'], ['n', 'w', 'e', 's'], ['n', 'nw', 'ne', 's']], 5: [['n', 'w', 'e', 'nw', 'ne']] };
  const MOVE_PATTERNS = { gewoehnlich: [['n'], ['n', 'w', 'e']], ungewoehnlich: [['n', 'w', 'e'], ['n', 's']], selten: [['n', 'w', 'e', 's']], legendaer: [['n', 'w', 'e', 's'], ['n', 'w', 'e', 's', 'nw', 'ne']] };
  function rollRarity(rng, choice) { return choice === 'gemischt' ? pickW(rng, MIX) : choice; }

  // Erzeugt Kampfwerte, Richtungen, Gaben, Energie und Seltenheit. identity = {element, race, classes}
  function generate(rarityChoice, rng, opts) {
    opts = opts || {}; rng = rng || Math.random;
    const want = rollRarity(rng, rarityChoice), P = PROFILE[want], band = BANDS.find(b => b.id === want);
    for (let attempt = 0; attempt < 80; attempt++) {
      const T = P.target[0] + rng() * (P.target[1] - P.target[0]);
      const mr = pickW(rng, P.move), nf = pickW(rng, P.fields), ng = pickW(rng, P.gifts);
      let gifts = shuffle(rng, Object.keys(GIFT_PTS)).slice(0, ng);
      if (MANUAL_CHECK.some(([a, b]) => gifts.includes(a) && gifts.includes(b))) continue;
      const fixed = MOVE_PTS[mr] + FIELD_PTS[nf] + gifts.reduce((s, g) => s + GIFT_PTS[g], 0);
      const statPoints = T - fixed; if (statPoints < 4) continue;
      let sum = statPoints / 3 * 500, ratio = 0.35 + rng() * 0.3;
      let atk = Math.round(sum * ratio / 100) * 100, def = Math.round(sum * (1 - ratio) / 100) * 100;
      atk = Math.max(300, Math.min(3500, atk)); def = Math.max(300, Math.min(3500, def));
      const card = { atk, def, synergy: 0, gifts: gifts.map(id => ({ id })),
        attack: { dirs: Object.fromEntries(pick(rng, ATK_PATTERNS[nf]).map(k => [k, 1])), showNumber: false, number: 1 },
        move: { dirs: Object.fromEntries(pick(rng, MOVE_PATTERNS[want]).map(k => [k, mr])), showNumber: true, number: mr } };
      // auf das Band der gewünschten Seltenheit nachjustieren
      let ev = evaluate(card), guard = 0;
      while (ev.total > band.hi && guard++ < 40) { if (card.atk >= card.def && card.atk > 300) card.atk -= 100; else if (card.def > 300) card.def -= 100; else break; ev = evaluate(card); }
      while (ev.total < band.lo && guard++ < 80) { if (card.atk <= card.def && card.atk < 3500) card.atk += 100; else if (card.def < 3500) card.def += 100; else break; ev = evaluate(card); }
      if (ev.rarity !== want) continue;
      card.rarity = ev.rarity; card.energy = ev.suggestedEnergy; card.power = ev.total;
      return card;
    }
    return null;
  }
  function randomIdentity(rng, season1) {
    const R = season1 ? D.RACES.filter(r => SEASON1.races.includes(r.id)) : D.RACES;
    const C = season1 ? D.CLASSES.filter(r => SEASON1.classes.includes(r.id)) : D.CLASSES;
    const E = season1 ? D.ELEMENTS.filter(r => SEASON1.elements.includes(r.id)) : D.ELEMENTS;
    return { element: pick(rng, E).id, race: pick(rng, R).id, classes: [pick(rng, C).id, null] };
  }
  return { SOURCE, BANDS, MOVE_PTS, ENERGY_FACTOR, FIELD_PTS, GIFT_PTS, UNSCORED, SYNERGY, MIX, SEASON1, evaluate, energyFor, generate, randomIdentity, rarityName };
})();
