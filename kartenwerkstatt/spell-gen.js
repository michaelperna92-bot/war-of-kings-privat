/* War of Kings – Zauber- und Fluchkarten automatisch erzeugen (offline-Zufall und KI-Vorschlag prüfen).
 * Ergebnis ist immer gültig nach effects.js (also im Probe-Spiel spielbar). Energie und Stärke sind ein
 * Werkstatt-Vorschlag: Für Zauber und Flüche gibt es im Regelwerk noch kein Power-Scaling.
 */
(function (root) {
  'use strict';
  const EF = root.WOK_EFFECTS || (typeof require !== 'undefined' ? require('./effects.js') : null);
  const RAR = ['gewoehnlich', 'ungewoehnlich', 'selten', 'legendaer'];
  const MULT = { gewoehnlich: 1, ungewoehnlich: 1.35, selten: 1.8, legendaer: 2.4 };
  const pickR = (rng, a) => a[Math.floor(rng() * a.length)];
  const r100 = v => Math.max(100, Math.round(v / 100) * 100);
  // Namensbausteine je Element (das Motiv bzw. die Farbanalyse liefert das Element)
  const THEME = {
    feuer: { adj: ['Glühend', 'Brennend', 'Lodernd'], nouns: ['Glut', 'Flamme', 'Asche', 'Feuersbrunst'], who: ['des Phönix', 'der Esse', 'des Vulkans'] },
    wasser: { adj: ['Eisig', 'Tosend', 'Tief'], nouns: ['Flut', 'Frost', 'Strömung', 'Gischt'], who: ['der Tiefe', 'des Gletschers', 'der Gezeiten'] },
    erde: { adj: ['Steinern', 'Uralt', 'Wurzelnd'], nouns: ['Fels', 'Dorn', 'Wurzel', 'Erdbeben'], who: ['der Berge', 'des Waldes', 'der Tiefe'] },
    wind: { adj: ['Heulend', 'Schneidend', 'Flüsternd'], nouns: ['Sturm', 'Böe', 'Wirbel', 'Himmelsruf'], who: ['der Gipfel', 'des Ostwinds', 'der Wolken'] },
    blitz: { adj: ['Zuckend', 'Grollend', 'Gleißend'], nouns: ['Donner', 'Blitz', 'Funkenregen', 'Gewitter'], who: ['des Donnergotts', 'der Gewitter', 'des Himmels'] },
    licht: { adj: ['Heilig', 'Strahlend', 'Golden'], nouns: ['Segen', 'Schild', 'Licht', 'Morgenröte'], who: ['der Krone', 'der Ahnen', 'des Tempels'] },
    dunkelheit: { adj: ['Finster', 'Verflucht', 'Schwarz'], nouns: ['Schatten', 'Bann', 'Seelenfäule', 'Nacht'], who: ['der Gruft', 'des Abgrunds', 'der Verdammten'] }
  };
  const CURSE_SUB = { discard: 'Vergessensfluch', mill: 'Zerfallsfluch', stat: 'Schwächungsfluch', status: 'Giftfluch', destroy: 'Vernichtungsfluch', moveBlock: 'Bannfluch', giftBlock: 'Siegelfluch', fieldLock: 'Sperrfluch', damage: 'Schadensfluch' };
  const SPELL_SUB = { damage: 'Angriffszauber', stat: 'Stärkungszauber', protect: 'Schutzzauber', deathWard: 'Schutzzauber', revive: 'Beschwörungszauber', heal: 'Heilzauber', draw: 'Wissenszauber', neutralize: 'Bannzauber' };
  const FLAVOR = { curse: ['Was einmal verflucht ist, vergisst nie.', 'Der Schatten fragt nicht um Erlaubnis.', 'Wer den Bann bricht, zahlt mit Blut.', 'Kein Schild hält, was die Nacht beschließt.'], spell: ['Wo das Licht steht, bricht kein Stahl.', 'Ein Wort der Alten, und die Reihen stehen.', 'Die Krone erinnert sich an ihre Treuen.', 'Selbst der Sturm beugt sich dem Schwur.'] };
  // Vorlagen: Gewicht je Element, Effekt bauen (m = Stärke nach Seltenheit)
  const CURSES = [
    { k: 'stat', w: { feuer: 3, blitz: 2, dunkelheit: 2 }, make: (m, g) => eff('stat', 'curse', { 'params.stat': g() < .7 ? 'atk' : 'def', 'params.amount': -r100(300 * m + g() * 300), 'duration.kind': g() < .5 ? 'turn' : 'rounds', 'duration.n': 1 + (g() < m / 3 ? 1 : 0) }), v: e => Math.abs(e.params.amount) / 1000 * 1.6 * (e.duration.kind === 'rounds' ? 1.3 : 1) },
    { k: 'stat', all: true, w: { wind: 2, wasser: 2, dunkelheit: 1 }, make: (m, g) => eff('stat', 'curse', { 'target.count': 'all', 'params.stat': 'atk', 'params.amount': -r100(150 * m + g() * 150), 'duration.kind': 'turn' }), v: e => Math.abs(e.params.amount) / 1000 * 1.6 * 2.2 },
    { k: 'status', w: { dunkelheit: 4, erde: 1 }, make: () => eff('status', 'curse', { 'params.status': 'poison' }), v: () => 2.4 },
    { k: 'destroy', w: { dunkelheit: 2, blitz: 2, feuer: 1 }, min: 1.6, make: () => eff('destroy', 'curse', {}), v: () => 3.2 },
    { k: 'moveBlock', w: { wasser: 4, erde: 2 }, make: (m, g) => eff('moveBlock', 'curse', { 'duration.kind': 'rounds', 'duration.n': m > 1.5 ? 2 : 1, 'target.count': m > 2 ? 'n' : 'one', 'target.n': 2 }), v: e => 1 * (e.duration.n || 1) * (e.target.count === 'n' ? 1.6 : 1) },
    { k: 'giftBlock', w: { licht: 1, dunkelheit: 2, wind: 1 }, make: (m) => eff('giftBlock', 'curse', { 'params.gifts': 'all', 'duration.kind': 'rounds', 'duration.n': m > 1.5 ? 2 : 1 }), v: e => 1.1 * (e.duration.n || 1) },
    { k: 'fieldLock', w: { erde: 3, wasser: 1 }, make: (m) => eff('fieldLock', 'curse', { 'target.count': 'n', 'target.n': m > 1.5 ? 3 : 2, 'target.side': 'own', 'duration.kind': 'rounds', 'duration.n': 1 }), v: e => 0.35 * e.target.n },
    { k: 'damage', w: { feuer: 4, blitz: 3 }, make: (m, g) => eff('damage', 'curse', { 'params.amount': r100(500 * m + g() * 500) }), v: e => e.params.amount / 1000 * 1.3 },
    { k: 'stat', king: true, w: { wasser: 2, dunkelheit: 2, erde: 1 }, make: (m, g) => eff('stat', 'curse', { 'target.what': 'king', 'target.pick': 'auto', 'params.stat': 'atk', 'params.amount': -r100(400 * m + g() * 400), 'duration.kind': g() < .5 ? 'turn' : 'rounds', 'duration.n': 1 }), v: e => Math.abs(e.params.amount) / 1000 * 1.2 },
    { k: 'giftBlock', king: true, w: { dunkelheit: 2, licht: 1, wind: 1 }, make: (m) => eff('giftBlock', 'curse', { 'target.what': 'king', 'target.pick': 'auto', 'params.gifts': 'all', 'duration.kind': 'rounds', 'duration.n': m > 1.5 ? 2 : 1 }), v: e => 1.4 * (e.duration.n || 1) },
    { k: 'damage', per: true, w: { blitz: 2, feuer: 2, wind: 1 }, make: (m, g) => eff('damage', 'curse', { 'params.amount': r100(200 * m + g() * 200), 'params.per': 'field', 'params.from': 'enemy', 'params.max': r100(1800 * m) }), v: e => e.params.amount / 1000 * 3.5 * 1.2 },
    { k: 'damage', per: true, w: { wasser: 2, wind: 2 }, make: (m, g) => eff('damage', 'curse', { 'params.amount': r100(150 * m + g() * 150), 'params.per': 'hand', 'params.from': 'enemy', 'params.max': r100(1500 * m) }), v: e => e.params.amount / 1000 * 4 * 1.2 },
    { k: 'discard', w: { dunkelheit: 2, wind: 2 }, make: (m) => eff('discard', 'curse', { 'params.n': m > 1.8 ? 2 : 1 }), v: e => e.params.n * 1.1 },
    { k: 'mill', w: { wasser: 2, erde: 2 }, make: (m) => eff('mill', 'curse', { 'params.n': Math.round(2 + m) }), v: e => e.params.n * 0.35 },
    { k: 'damage', per: true, w: { dunkelheit: 3, feuer: 1 }, make: (m, g, D) => { const race = D && D.RACES && D.RACES.length ? pickR(g, D.RACES).id : null; return eff('damage', 'curse', { 'params.amount': r100(150 * m + g() * 150), 'params.per': 'discard', 'params.from': 'own', 'params.count': g() < .55 && race ? { op: 'and', items: [{ k: 'race', v: race }] } : { op: 'and', items: [] }, 'params.max': r100(1500 * m) }); }, v: e => e.params.amount / 1000 * 4 * 1.2 },
    { k: 'control', w: { dunkelheit: 4, wind: 1, blitz: 1 }, min: 1.3, make: (m) => eff('control', 'curse', { 'duration.kind': m >= 2.4 ? 'permanent' : m >= 1.6 ? 'rounds' : 'turn', 'duration.n': 1 }), v: e => e.duration.kind === 'permanent' ? 4.4 : e.duration.kind === 'turn' ? 1.9 : 2.6 }, // „turn“ = greift nur in dieser Battlephase mit an
    { k: 'stat', both: true, w: { blitz: 2, dunkelheit: 2, feuer: 1 }, make: (m, g) => eff('stat', 'curse', { 'target.side': 'both', 'target.count': 'all', 'params.stat': g() < .5 ? 'atk' : 'def', 'params.amount': -r100(250 * m + g() * 250), 'duration.kind': 'turn' }), v: e => Math.abs(e.params.amount) / 1000 * 1.4 },
    { k: 'destroy', both: true, w: { feuer: 2, dunkelheit: 2 }, min: 2.4, make: (m, g, D) => { const cl = D && D.CLASSES && D.CLASSES.length ? pickR(g, D.CLASSES).id : null; return eff('destroy', 'curse', { 'target.side': 'both', 'target.count': 'all', 'target.filter': { op: 'and', items: cl ? [{ k: 'class', v: cl }] : [] } }); }, v: () => 4.2 }
  ];
  const SPELLS = [
    { k: 'stat', w: { feuer: 2, blitz: 2, licht: 1 }, make: (m, g) => eff('stat', 'spell', { 'params.stat': g() < .6 ? 'atk' : 'def', 'params.amount': r100(300 * m + g() * 300), 'duration.kind': g() < .5 ? 'turn' : 'rounds', 'duration.n': 1 + (g() < m / 3 ? 1 : 0) }), v: e => e.params.amount / 1000 * 1.6 * (e.duration.kind === 'rounds' ? 1.3 : 1) },
    { k: 'stat', all: true, w: { licht: 2, wind: 2 }, make: (m, g) => eff('stat', 'spell', { 'target.count': 'all', 'params.stat': 'def', 'params.amount': r100(150 * m + g() * 150), 'duration.kind': 'turn' }), v: e => e.params.amount / 1000 * 1.6 * 2.2 },
    { k: 'stat', move: true, w: { wind: 4 }, make: () => eff('stat', 'spell', { 'params.stat': 'move', 'params.amount': 1, 'duration.kind': 'rounds', 'duration.n': 1 }), v: () => 0.8 },
    { k: 'protect', w: { licht: 4, erde: 1 }, make: () => Object.assign(eff('protect', 'spell', { 'duration.kind': 'turn' }), { trigger: 'enemyAttack' }), counter: true, v: () => 1.6 },
    { k: 'deathWard', w: { licht: 3, erde: 2 }, make: (m) => eff('deathWard', 'spell', { 'duration.kind': 'turn', 'params.uses': 1, 'target.count': m > 2 ? 'all' : 'one' }), v: e => 1.6 * (e.target.count === 'all' ? 1.8 : 1) },
    { k: 'revive', w: { dunkelheit: 2, licht: 2 }, min: 1.3, make: () => eff('revive', 'spell', { 'params.place': 'player', 'params.lock': true }), v: () => 2.8 },
    { k: 'heal', w: { licht: 4, wasser: 2 }, make: (m, g) => eff('heal', 'spell', { 'params.amount': r100(1000 * m + g() * 1000), 'params.cap': 'start' }), v: e => e.params.amount / 1500 },
    { k: 'draw', w: { wasser: 2, wind: 2, licht: 1, blitz: 1 }, make: (m) => eff('draw', 'spell', { 'params.n': Math.min(4, Math.max(1, Math.round(m + .4))) }), v: e => e.params.n * 0.9 },
    { k: 'damage', w: { feuer: 3, blitz: 3, licht: 1 }, make: (m, g) => eff('damage', 'spell', { 'params.amount': r100(400 * m + g() * 400) }), v: e => e.params.amount / 1000 * 1.3 },
    { k: 'neutralize', w: { licht: 2, wind: 1 }, counter: true, make: () => eff('neutralize', 'spell', {}), v: () => 1.5 },
    { k: 'control', w: { licht: 1, wind: 2, dunkelheit: 2 }, min: 1.3, make: () => eff('control', 'spell', { 'target.side': 'enemy', 'duration.kind': 'rounds', 'duration.n': 1 }), v: () => 2.6 },
    { k: 'protect', all: true, w: { licht: 3, erde: 2 }, make: () => eff('protect', 'spell', { 'target.count': 'all', 'duration.kind': 'turn' }), v: () => 2.4 },
    { k: 'stat', all: true, w: { feuer: 2, blitz: 1 }, make: (m, g, D) => { const r = D && D.RACES && D.RACES.length ? pickR(g, D.RACES).id : null; return eff('stat', 'spell', { 'target.count': 'all', 'target.filter': { op: 'and', items: r ? [{ k: 'race', v: r }] : [] }, 'params.stat': 'atk', 'params.amount': r100(300 * m + g() * 300), 'duration.kind': 'turn' }); }, v: e => e.params.amount / 1000 * 1.5 }
  ];
  // Baukasten-Zusätze: Voraussetzung (macht die Karte billiger), Zusatzkosten, Ausspielzeitpunkt
  function addTwists(sp, type, rarity, rng, D, eff0) {
    let disc = 0;
    const idOf = l => l && l.length ? pickR(rng, l).id : null;
    const cat = () => { const x = rng(); return x < .4 ? ['race', idOf(D && D.RACES)] : x < .75 ? ['class', idOf(D && D.CLASSES)] : ['element', idOf(D && D.ELEMENTS)]; };
    if (rng() < .38) {
      const [k, v] = cat(), fil = v ? { op: 'and', items: [{ k, v }] } : { op: 'and', items: [] }, x = rng();
      const c = x < .3 ? { k: 'control', min: 1, filter: fil } : x < .5 ? { k: 'discard', side: 'own', min: 2 + Math.floor(rng() * 3), filter: fil } : x < .65 ? { k: 'fieldAny', min: 3 + Math.floor(rng() * 2), filter: { op: 'and', items: [] } } : x < .78 ? { k: 'control', min: 3, filter: { op: 'and', items: [] } } : x < .9 ? { k: 'kingHp', side: 'own', cmp: '<=', value: 4000 + Math.floor(rng() * 3) * 1000 } : { k: 'enemyControl', min: 3, filter: { op: 'and', items: [] } };
      sp.require = { op: 'and', items: [c] }; disc += c.k === 'kingHp' || c.min >= 3 ? 1.6 : 1.1;
    }
    if (rng() < .22) {
      if (rng() < .65) { sp.cost.hp = r100((500 + rng() * 700) * MULT[rarity]); disc += sp.cost.hp / 1000 * 1.1; }
      else { sp.cost.discard = 1; disc += 1; }
    }
    if (sp.timing === 'both' && !sp.effects.some(e => e.kind === 'neutralize')) { const x = rng(); if (x < .2) sp.timing = 'battle'; else if (x < .32) sp.timing = 'counter'; }
    return disc;
  }
  function eff(kind, type, ch) { const e = EF.blankEffect(kind, type); for (const [p, v] of Object.entries(ch || {})) { const ks = p.split('.'); let x = e; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; } return e; }
  function weightedPick(list, element, rng, m) {
    const pool = list.filter(t => !t.min || m >= t.min), ws = pool.map(t => 1 + ((t.w || {})[element] || 0) * 1.5), sum = ws.reduce((a, b) => a + b, 0);
    let x = rng() * sum; for (let i = 0; i < pool.length; i++) { x -= ws[i]; if (x <= 0) return pool[i]; } return pool[pool.length - 1];
  }
  function chooseRarity(r, rng) { if (RAR.includes(r)) return r; const x = rng(); return x < .5 ? 'gewoehnlich' : x < .8 ? 'ungewoehnlich' : x < .95 ? 'selten' : 'legendaer'; }
  function makeName(type, element, rng, kind) {
    const T = THEME[element] || pickR(rng, Object.values(THEME));
    const pat = rng();
    if (type === 'curse') return pat < .4 ? 'Fluch ' + pickR(rng, T.who) : pat < .75 ? pickR(rng, T.adj) + 'er ' + pickR(rng, ['Bann', 'Fluch', 'Hauch', 'Schwur']) : pickR(rng, T.nouns) + pickR(rng, ['bann', 'fluch', 'siegel']);
    return pat < .4 ? pickR(rng, T.nouns) + ' ' + pickR(rng, T.who) : pat < .75 ? pickR(rng, T.adj) + 'er ' + pickR(rng, ['Segen', 'Schild', 'Ruf', 'Schwur']) : pickR(rng, ['Segen', 'Zauber', 'Ruf']) + ' ' + pickR(rng, T.who);
  }
  // Energie aus der geschätzten Stärke (Vorschlag der Werkstatt)
  function energyFor(value) { return Math.max(0, Math.min(10, Math.round(value * 1.25))); }
  function estimate(sp, type) {
    let v = 0; const all = type === 'curse' ? CURSES : SPELLS;
    for (const e of sp.effects) { const t = all.find(x => x.k === e.kind); if (!t) { v += 1; continue; } try { v += t.v(e); } catch (x) { v += 1; } }
    return v;
  }
  // Zufällige, gültige Karte. o: { type, rarity, element, name, rng, D }
  function random(o) {
    o = o || {}; const rng = o.rng || Math.random, type = o.type === 'curse' ? 'curse' : 'spell', rarity = chooseRarity(o.rarity, rng), m = MULT[rarity];
    const element = o.element || pickR(rng, Object.keys(THEME));
    for (let tries = 0; tries < 20; tries++) {
      const list = type === 'curse' ? CURSES : SPELLS, t1 = weightedPick(list, element, rng, m), effects = [t1.make(m, rng, o.D)];
      let timing = t1.counter ? 'counter' : 'both';
      if ((rarity === 'selten' && rng() < .4) || rarity === 'legendaer') { const t2 = weightedPick(list.filter(t => t.k !== t1.k && !t.counter), element, rng, m * .7); effects.push(t2.make(m * .7, rng, o.D)); }
      const sp = EF.normalizeSpell(Object.assign(EF.blankSpell(type), { timing, effects }), type);
      EF.autoFix(sp);
      const disc = o.plain ? 0 : addTwists(sp, type, rarity, rng, o.D); EF.autoFix(sp);
      const card = { type, name: o.name || makeName(type, element, rng, t1.k), subtitle: (type === 'curse' ? CURSE_SUB : SPELL_SUB)[t1.k] || (type === 'curse' ? 'Fluch' : 'Zauber'), flavor: pickR(rng, FLAVOR[type]), rarity, ruleText: '', spell: sp };
      card.energy = energyFor(Math.max(0.4, estimate(sp, type) - disc * 0.6));
      if (EF.validate(card, o.D).errors.length === 0) return Object.assign(card, { element, generator: 'zufall' });
    }
    return null;
  }
  // KI-Antwort übernehmen, sofern gültig; sonst null (dann Zufall mit dem KI-Namen)
  function fromAI(a, type, rarity, D) {
    if (!a || !Array.isArray(a.effects) || !a.effects.length) return null;
    const effects = a.effects.filter(e => e && EF.KINDS[e.kind] && EF.KINDS[e.kind].defined).slice(0, 2).map(e => { const b = EF.blankEffect(e.kind, type); return Object.assign(b, { target: Object.assign(b.target, e.target || {}), params: Object.assign(b.params, e.params || {}), duration: Object.assign(b.duration, e.duration || {}), trigger: e.trigger || b.trigger }); });
    effects.forEach(e => { if (!e.target.filter || !Array.isArray(e.target.filter.items)) e.target.filter = { op: 'and', items: [] }; });
    if (!effects.length) return null;
    const sp = EF.normalizeSpell(Object.assign(EF.blankSpell(type), { effects, timing: EF.TIMINGS[a.timing] ? a.timing : effects.some(e => e.trigger === 'enemyAttack') ? 'counter' : 'both' }), type);
    EF.autoFix(sp);
    // Voraussetzung und Zusatzkosten der KI nur übernehmen, wenn sie gültig sind
    if (a.require && Array.isArray(a.require.items)) { const t = Object.assign({}, sp, { require: { op: a.require.op === 'or' ? 'or' : 'and', items: a.require.items.slice(0, 2) } }); if (!EF.validate({ type, name: 'x', rarity: 'gewoehnlich', energy: 1, ruleText: '', spell: t }, D).errors.length) sp.require = t.require; }
    if (a.cost) sp.cost = { hp: Math.max(0, Math.min(5000, Math.round((+a.cost.hp || 0) / 100) * 100)), discard: Math.max(0, Math.min(3, Math.round(+a.cost.discard || 0))) };
    const card = { type, name: String(a.name || '').trim().slice(0, 28), subtitle: String(a.subtitle || '').trim().slice(0, 30), flavor: String(a.flavor || '').replace(/\d/g, '').trim().slice(0, 120), rarity: RAR.includes(rarity) ? rarity : chooseRarity(null, Math.random), ruleText: '', spell: sp };
    card.energy = Number.isFinite(+a.energy) ? Math.max(0, Math.min(10, Math.round(+a.energy))) : energyFor(estimate(sp, type));
    return EF.validate(card, D).errors.length ? null : Object.assign(card, { generator: 'ki' });
  }
  function prompt(count, type, D) {
    const ids = l => (l || []).map(x => x.id + '=' + x.name).join(', ');
    const kinds = Object.entries(EF.KINDS).filter(([, v]) => v.defined && v.for.includes(type === 'mixed' ? 'spell' : type) || (type === 'mixed' && v.defined)).map(([k, v]) => k + ' (' + v.name + ', Ziel ' + v.targets.join('/') + ')').join('; ');
    return 'Du gestaltest ' + (type === 'curse' ? 'Fluchkarten' : type === 'spell' ? 'Zauberkarten' : 'Zauber- oder Fluchkarten') + ' für das Fantasy-Kartenspiel „War of Kings“. Du bekommst ' + count + (count === 1 ? ' Illustration' : ' Illustrationen') + '. Erkenne für jede, was das Motiv zeigt, und gestalte dazu passend:\n'
      + '- name: einprägsam, deutsch, höchstens 22 Zeichen, kein Name bekannter Figuren.\n- subtitle: Untertyp für das Banner (z. B. „Schutzzauber“, „Giftfluch“).\n- flavor: ein atmosphärischer Satz ohne Zahlen und ohne Spielwirkung.\n'
      + (type === 'mixed' ? '- type: "spell" (hilfreich für den Wirkenden) oder "curse" (schadet dem Gegner), passend zum Motiv.\n' : '')
      + '- effects: 1 (selten 2) Effekte NUR aus diesen Arten: ' + kinds + '.\n'
      + '  Formate: target {what: unit|king|field|discard|card|player, side: own|enemy|both, count: one|n|all, n, pick: player|auto, filter: {op: and, items: [{k: race|class|element, v: id}]}}; duration {kind: instant|turn|rounds|permanent, n}; trigger play|enemyAttack.\n'
      + '  params: stat {stat: atk|def|move, mode: add|set, amount (negativ = senken)}; status {status: poison}; giftBlock {gifts: "all"}; fieldLock {noSummon: false}; revive {place: player, lock: true}; deathWard {uses: 1}; heal {amount, cap: start}; damage (Ziel king) {amount, per: fixed|discard|field|hand, from: own|enemy|both, count: {op: and, items: []}, max}; draw (Ziel {what: player, side: own}) {n}; discard (Ziel {what: player, side: enemy}) {n}; mill (Ziel {what: player, side: enemy}) {n}. Für Flüche gern auch direkt auf den König (Schaden, ATK senken, königliche Gaben blockieren). control übernimmt einen gegnerischen Helden. Logik für control: In der eigenen Battlephase gewirkt, wirkt control sofort, noch vor den Angriffen – der übernommene Held greift in derselben Battlephase mit an, danach Konterphase des Gegners und Schadensberechnung. duration turn = nur dieser Angriff (günstig); rounds n (1–3) = zusätzlich laufen und angreifen in den nächsten n eigenen Zügen, der Gegner kann ihn dazwischen angreifen (mittel); permanent = am teuersten. timing counter = nimmt einem gegnerischen Angreifer seinen Angriff weg.\n'
      + '- optional timing: both|battle|counter (nur Battlephase / nur Konterphase).\n- optional require: {op: and, items: [Bedingung]} mit Bedingung {k: control|enemyControl|fieldAny, min, filter} (Helden auf dem Feld: eigene, gegnerische, beide Seiten), {k: discard, side: own|enemy, min, filter} (im Friedhof), {k: kingHp, side: own|enemy, cmp: <=|>=, value}, {k: hand, min}. Eine Voraussetzung macht die Karte günstiger.\n- optional cost: {hp: König-HP-Opfer, discard: abzuwerfende Handkarten} als Zusatzkosten (dafür stärker oder billiger).\n'
      + '- Dauer (wichtig): Wirkungen, die erst im Zug des Gegners zählen (gegnerische ATK oder Schritte senken, gegnerische Bewegung/Gaben sperren, Felder sperren, eigene DEF erhöhen, eigene Helden schützen), brauchen duration rounds (n = Anzahl der Gegnerzüge, 1–3) – nie "turn", außer die Karte ist nur in der Konterphase spielbar. Eigene Stärkungen (ATK, Schritte) mit rounds zählen deine eigenen Züge. protect hat params {from: attacks|curses|both}.\n- energy: 0–10, passend zur Stärke (schwach 1–2, mittel 3–4, stark 5–7).\n- reason: kurzer Halbsatz, was das Motiv zeigt.\n'
      + 'Erfinde keine Regeln und keine anderen Effektarten. Kein Einfrieren. Werte in 100er-Schritten. Nutze nur diese IDs: Rassen ' + ids(D && D.RACES) + '; Klassen ' + ids(D && D.CLASSES) + '; Elemente ' + ids(D && D.ELEMENTS) + '.\n'
      + 'Antworte NUR mit JSON: {"cards": [ {name, subtitle, flavor,' + (type === 'mixed' ? ' type,' : '') + ' energy, timing, require, cost, effects: [...], reason} ]} in Bildreihenfolge.';
  }
  const api = { random, fromAI, prompt, estimate, energyFor, RAR, THEME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WOK_SPELLGEN = api;
})(typeof window !== 'undefined' ? window : globalThis);
