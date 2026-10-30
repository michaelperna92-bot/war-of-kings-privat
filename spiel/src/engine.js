/* WAR OF KINGS – Regel-Engine (Probe-Spiel)
 * Reine Logik ohne Grafik: Zustand + Aktion → neuer Zustand + Ereignisse.
 * Deterministisch (eigener Zufallsgenerator im Zustand), JSON-serialisierbar,
 * damit sie später 1:1 nach Unity (C#) oder Unreal (C++) übertragen oder auf einem Server laufen kann.
 * Grundlage: Master-Regelwerk vom 29.10.2026 inkl. Abschnitt 15. Annahmen stehen in ASSUMPTIONS.
 */
(function (root) {
  'use strict';
  const VERSION = '1.1';
  // Gemeinsames Effektformat aus der Kartenwerkstatt (effects.js) und deren Stammdaten
  const EF = root.WOK_EFFECTS || (typeof require !== 'undefined' ? require('./effects.js') : null);
  const DATA = () => root.WOK_DATA || null;
  // Königs-HP 8.000–12.000 (Festlegung vom 30.10.2026): ältere Karten werden wie in der Werkstatt umgerechnet (data.js → kingHpFix)
  function kingHp(c) { const D = DATA(), hp = +c.hp || 0; if (!D || !D.kingHpFix) return hp; const v = D.kingHpFix(c.name, hp); if (v !== hp) (c._hpNote = 'HP ' + hp.toLocaleString('de-DE') + ' → ' + v.toLocaleString('de-DE') + ' (Regel 8.000–12.000)'); return v; }

  /* ---------------- Spielfeld (Abschnitt 15.6) ---------------- */
  const COLS = 'ABCDEFG';
  const ROW_COLS = { 1: 'CDE', 2: 'ABCDEFG', 3: 'ABCDEFG', 4: 'BCDEF', 5: 'ABCDEFG', 6: 'ABCDEFG', 7: 'CDE' };
  const FIELDS = [];
  for (let r = 1; r <= 7; r++) for (const ch of ROW_COLS[r]) FIELDS.push(ch + r);
  const FIELD_SET = new Set(FIELDS);
  const fid = (c, r) => (c >= 0 && c < 7 && r >= 1 && r <= 7 ? COLS[c] + r : null);
  const exists = f => !!f && FIELD_SET.has(f);
  const colOf = f => COLS.indexOf(f[0]), rowOf = f => +f.slice(1);
  // Spieler 0 sitzt unten (König D7), Spieler 1 oben (König D1). Richtungen gelten aus Sicht der eigenen Seite.
  const KING_FIELD = ['D7', 'D1'];
  const GUARD = [['C7', 'E7'], ['C1', 'E1']];
  const SUMMON_ROW = [6, 2];
  const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const DV = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
  function step(f, dir, owner, n) {
    n = n || 1; const v = DV[dir], m = owner === 1 ? -1 : 1;
    return fid(colOf(f) + v[0] * m * n, rowOf(f) + v[1] * m * n);
  }
  const isGuard = (f, p) => GUARD[p].includes(f);
  const summonFields = p => FIELDS.filter(f => rowOf(f) === SUMMON_ROW[p]).concat(GUARD[p]);

  /* ---------------- Regeldaten ---------------- */
  const GIFTS = {
    mordlust: { name: 'Mordlust', kind: 'ct', ct: 2, target: 'self' },
    entwaffnen: { name: 'Entwaffnen', kind: 'ct', ct: 2, target: 'enemyInRange' },
    eisenpanzer: { name: 'Eisenpanzer', kind: 'ct', ct: 5, target: 'self' },
    tausch: { name: 'Tausch', kind: 'ct', ct: 4, target: 'ownHero' },
    blitzschritt: { name: 'Blitzschritt', kind: 'ct', ct: 3, target: 'field' },
    rueckzug: { name: 'Rückzug', kind: 'ct', ct: 4, target: 'anyHero' },
    heilung: { name: 'Heilung', kind: 'ct', ct: 3, target: 'ownUnit' },
    fesseln: { name: 'Fesseln', kind: 'ct', ct: 4, target: 'enemyHero' },
    durchbruch: { name: 'Durchbruch', kind: 'ct', ct: 4, target: 'self' },
    doppelschlag: { name: 'Doppelschlag', kind: 'permanent' },
    poison: { name: 'Poison', kind: 'permanent' },
    goettlicher_segen: { name: 'Göttlicher Segen', kind: 'permanent' },
    ansturm: { name: 'Ansturm', kind: 'permanent' },
    schuetze: { name: 'Schütze', kind: 'permanent' }
  };
  // Königliche Gaben: Werte, Spannen und Wirkung kommen aus der Kartenwerkstatt (data.js), damit beide genau gleich rechnen.
  // stat energy = Kosten senken (nie unter 0), atk/def = Bonus. Wirkungsbereich: alle eigenen Monster oder eine Rasse/Klasse/ein Element.
  const ROYAL = (() => {
    const base = { gebot_der_krone: { name: 'Gebot der Krone', stat: 'energy', min: 1, max: 3, def: 1 }, zorn_des_imperators: { name: 'Zorn des Imperators', stat: 'atk', min: 100, max: 1000, def: 100 },
      ewiges_bollwerk: { name: 'Ewiges Bollwerk', stat: 'def', min: 100, max: 1000, def: 200 }, blitzkrieg: { name: 'Blitzkrieg', stat: 'energy', min: 1, max: 3, def: 1 } };
    const D = DATA(); for (const g of (D && D.ROYAL_GIFTS) || []) if (g.param) base[g.id] = { name: g.name, stat: g.param.stat, min: g.param.min, max: g.param.max, def: g.param.def };
    return base;
  })();
  const COPY_LIMIT = { gewoehnlich: 3, ungewoehnlich: 3, selten: 2, legendaer: 1 }; // Festlegung des Entwicklers vom 30.10.2026 (Regelwerkstext nennt noch 4 bei Gewöhnlich)
  const RULES = { deckSize: 40, startHand: 5, handMax: 10, energyMax: 10, drawFailDamage: 1000, turnSeconds: 120, counterSeconds: 120, reconnectSeconds: 120 };
  // Stellen, die das Regelwerk offen lässt – hier sichtbar festgehalten statt still angenommen.
  const ASSUMPTIONS = [
    'Könige haben 8.000–12.000 HP (Festlegung des Entwicklers vom 30.10.2026). Ältere Karten werden beim Laden umgerechnet: Grabeskönig Vorhaltar 10.000 (Festlegung), andere anteilig aus dem alten Bereich 10.000–20.000 (Werkstatt-Vorschlag).',
    'Heldengaben (Festlegung des Entwicklers vom 30.10.2026): Alle aktivierbaren Gaben gehen in der eigenen Battlephase und in der eigenen Konterphase, 0 Energie, Abklingzeiten unverändert, sofort und unwiderruflich. „Bis Zugende“ heißt in der Konterphase: bis zum Ende des laufenden (gegnerischen) Zuges. Die Konterphase bleibt einmalig. Werkstatt-Annahme: Durchbruch und Blitzschritt sind in der Konterphase erlaubt, Durchbruch bringt dort aber nichts (keine eigenen Angriffe).',
    'Kontrolle in der eigenen Battlephase (Festlegung des Entwicklers vom 30.10.2026): Ein Zauber oder Fluch mit „Kontrolle übernehmen“ wirkt sofort, noch vor den Angriffen und der Konterphase. Der übernommene Held kann so in derselben Battlephase Angriffe festlegen; der Gegner kann in seiner Konterphase darauf reagieren, danach folgt die Schadensberechnung. Werkstatt-Annahme: die ganze Karte wirkt dann sofort (auch weitere Effekte darauf) und kann nicht mehr neutralisiert werden. In der Konterphase auf einen Angreifer gewirkt, fällt dessen Angriff weg.',
    'Angriffe reichen nur auf unmittelbar angrenzende Felder (Festlegung des Entwicklers vom 30.10.2026). Nur Schütze erlaubt Ziele genau 2 Felder entfernt; ein Angriffspfeil der Länge 2 aus der Werkstatt allein verlängert die Reichweite nicht. Dazwischen stehende Karten blockieren Schütze nicht.',
    'Durchbruch: ein Held 2 Felder entfernt, nur in der Battlephase, in der die Gabe aktiviert wurde (so steht es im Gabentext).',
    'Kopienlimit (Festlegung des Entwicklers vom 30.10.2026): Gewöhnlich und Ungewöhnlich je 3, Selten 2, Legendär 1 je Karte. Verschiedene legendäre Karten dürfen beliebig viele ins Deck. Der Regelwerkstext nennt bei Gewöhnlich noch 4.',
    'Kontrolle übernehmen (Festlegung des Entwicklers vom 30.10.2026): Ein übernommener Held umgeht Beschwörungssperre, Fesseln und Bewegungssperren, solange er übernommen ist, und kann sofort laufen und angreifen (sofern er in diesem Zug noch nicht gelaufen ist bzw. angegriffen hat). Der Held wechselt bei der Auswertung die Seite, seine eigenen Angriffsansagen entfallen. „Für N Runden“ endet hier am Ende des N-ten nächsten Zuges des Wirkenden (sonst könnte der Held nie eingesetzt werden). Danach, durch Heilung oder bei Wegfall der Bedingung kehrt er zurück; stirbt er vorher, kommt er auf den Ablagestapel seines Besitzers. Göttlicher Segen schützt davor, Könige nie.',
    'Dauer von Zaubern/Flüchen (Festlegung des Entwicklers vom 30.10.2026): Wirkungen im Zug des Gegners (gegnerische ATK/Schritte senken, Bewegung/Gaben sperren, Felder sperren, eigene DEF erhöhen, eigene Helden schützen) zählen „Runden“ als Züge des Gegners und dürfen nicht nur „bis Zugende“ gelten, außer bei reinen Konterphase-Karten. Eigene Stärkungen (ATK, Schritte) und gegnerische DEF-Senkungen zählen eigene Züge (bis zum Ende des n-ten nächsten eigenen Zuges). Schutz wirkt wahlweise gegen Angriffe, gegen gegnerische Flüche oder gegen beides.',
    'Zusätzliche Kosten eines Zaubers/Fluchs (König-HP, Handkarten) werden beim Ausspielen sofort bezahlt und auch bei Neutralisierung nicht erstattet. Der König darf dadurch nicht auf 0 HP oder darunter fallen; abgeworfen wird zufällig.',
    'Fernangriffe über eine Lücke im Spielfeld sind erlaubt, wenn das Zielfeld existiert.',
    'Königliche Gaben wirken auf die eigenen Helden, nicht auf den König selbst.',
    'Fesseln wirkt auf jeden gegnerischen Helden (keine Reichweite angegeben); ein gefesselter Held kann weder laufen noch Blitzschritt nutzen noch per Rückzug ziehen.',
    'Rückzug und Tausch betreffen nur Helden, da Könige sich nie bewegen.',
    'Gleichzeitige Rückzüge auf dasselbe Feld: der zuerst gewählte zieht, der andere bleibt stehen.',
    'Doppelschlag gegen einen König: beide Treffer gehen auf den König (2 × ATK); ein zusätzlicher Held kann dann nicht gewählt werden.',
    'Zuguhr: Läuft sie ab, werden die restlichen Phasen ohne neue Aktionen abgeschlossen; bereits festgelegte Angriffe werden ausgeführt.',
    'Deckwahl: Jeder spielt das Deck, das er gewählt hat. Die zufällige Verteilung von Deck A und B (15.7) lässt sich auf der Startseite einschalten.',
    'Abschnitt 15.8 (Werte-Snapshot) ist offen: Zauber und Flüche wirken nach ihrer Auswertung sofort auf die Werte, mit denen danach gekämpft wird.',
    'Energie und Konterphase (Festlegung des Entwicklers vom 30.10.2026): Unverbrauchte Energie bleibt am eigenen Zugende erhalten und kann in der gegnerischen Konterphase für Konter (Zauber/Flüche/Gaben) genutzt werden. Nach der Schadensberechnung des gegnerischen Zuges bzw. spätestens am Ende des gegnerischen Zuges verfällt sie; zu Beginn des eigenen Zuges wird wie bisher aufgefüllt (kein Ansparen).',
    'Zauber/Flüche – Reihenfolge der Auswertung: zuerst alle Neutralisierungen, dann die übrigen Karten in Ausspielreihenfolge, die Effekte einer Karte in ihrer Reihenfolge. Weitere Effekte einer neutralisierenden Karte wirken trotzdem.',
    'Zauber/Flüche – Ziele: Vom Spieler gewählte Ziele werden beim Ausspielen festgelegt; sind sie bei der Auswertung nicht mehr gültig, verpufft die Wirkung auf sie. „Automatisch“ wählt das Spiel bei der Auswertung zufällig (fester Zufall der Partie) unter den gültigen Zielen.',
    'Zauber/Flüche – „Einheit“ meint Helden. Könige sind nur Ziel, wenn die Karte ausdrücklich „König“ als Ziel nennt (Abschnitt 8).',
    'Zauber/Flüche – „Auf Betrag setzen“ ersetzt den Wert samt Königsbonus; „um Betrag verändern“ wirkt danach zusätzlich. Mehrere Setzungen: die zuletzt ausgewertete gilt. Laufen bleibt zwischen 0 und 3 Schritten.',
    'Zauber/Flüche – Flächeneffekte (Ziel „alle“ mit Dauer) gelten dynamisch und erfassen auch später beschworene passende Einheiten (Abschnitt 8), auch wenn sie nicht permanent sind.',
    'Zauber/Flüche – „Solange …“: Die Wirkung endet endgültig, sobald die Bedingung bei einer Prüfung nicht mehr erfüllt ist (geprüft nach jeder Aktion und zu Zugbeginn/-ende).',
    'Zauber/Flüche – Göttlicher Segen wehrt die negativen Fluchwirkungen ab (Senkungen, Poison, Bewegungs- und Gabensperre, Gabenentzug). Ob Segen auch „Zerstören“ abwehrt, ist offen; im Probe-Spiel wehrt er es nicht ab. Heilung entfernt negative Fluchwirkungen, auch einen Gabenentzug.',
    'Zauber/Flüche – Wiederbelebung gilt als Beschwörung auf ein freies Beschwörungsfeld des Wirkenden (Kartenparameter: mit/ohne Beschwörungssperre). Ist das gewählte Feld bei der Auswertung belegt, wird das erste freie genommen; ist keins frei, bleibt die Karte im Ablagestapel. Stirbt ein übernommener Held, kommt er auf den Ablagestapel seines Besitzers.',
    'Zauber/Flüche – Bewahren vor Zerstörung greift bei Kampf, Poison und „Zerstören“. Rettet es vor dem Gifttod, wird Poison dabei entfernt.',
    'Zauber/Flüche – Feldsperren: gesperrte Felder können nicht betreten werden (Laufen, Blitzschritt, Rückzug, Tausch); wer darauf steht, bleibt. Beschwören dort nur verboten, wenn die Karte es sagt. Eigene Hälfte = die drei Reihen vor dem eigenen König, Reihe 4 nur bei „beide“.',
    'Zauber/Flüche – Karten mit permanenter Wirkung auf ein einzelnes Ziel bleiben am Monster und gehen mit ihm auf den Ablagestapel ihres Besitzers; alle anderen kommen nach der Auswertung sofort auf den Ablagestapel.',
    'Zauber/Flüche – ATK sinkt durch Abzüge höchstens auf 0 (wie DEF nach Abschnitt 7); ein König mit 0 ATK richtet keinen Schaden an.',
    'Zauber/Flüche – „Schaden am König“ trifft nur Könige (Helden haben keine HP). Bei „je Karte“ wird bei der Auswertung gezählt; Zauber und Flüche im Ablagestapel zählen mit, wenn kein Filter sie ausschließt.',
    'Zauber/Flüche – „Karten ziehen“: Ist der Nachziehstapel leer, wird einfach weniger gezogen, ohne den Verlust von 1.000 HP (der gilt laut Regelwerk für den Nachzug zu Zugbeginn). Über 10 Handkarten wird sofort bis auf 10 abgelegt.',
    'Zauber/Flüche – Kostenreduzierungen der Königsgaben (Gebot der Krone) gelten nur für Monster, nicht für Zauber und Flüche.'
  ];
  const SPELL_OPEN = [
    'Einfrieren (Freeze): Wirkung und Dauer sind im Regelwerk nicht festgelegt – Karten damit sind nicht spielbar.',
    'Maximale HP und vorübergehende HP: im Regelwerk nicht vorgesehen – Karten damit sind nicht spielbar.',
    'Neutralisieren eines bereits liegenden Flächeneffekts (Abschnitt 8) ist noch nicht umgesetzt; neutralisiert werden Karten, die in derselben Battlephase gespielt wurden.'
  ];

  /* ---------------- Zufall ---------------- */
  function rand(s) { let t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------------- Karten normalisieren ---------------- */
  // Nimmt Karten aus der Werkstatt-Sicherung (Rohformat) oder aus dem Kartenpaket (cards/_alle_karten.json)
  function normalizeCard(c) {
    if (c && (c.type === 'spell' || c.type === 'curse')) return normalizeSpellCard(c);
    const pack = Array.isArray(c.directions) || (c.attack && Array.isArray(c.attack.directions)) || Array.isArray(c.races);
    const dirsOf = spec => { const o = {}; if (!spec) return o; if (Array.isArray(spec.directions)) { for (const d of spec.directions) if (DV[d.dir]) o[d.dir] = Math.max(1, Math.min(3, +d.length || 1)); } else for (const [k, v] of Object.entries(spec.dirs || {})) if (v && DV[k]) o[k] = v === true ? 1 : Math.max(1, Math.min(3, +v || 1)); return o; };
    const type = c.type === 'king' ? 'king' : 'hero';
    const move = dirsOf(c.move || c.movement), atk = dirsOf(c.attack);
    const mv = c.movement || c.move || {};
    let steps = (mv.showNumber && +mv.number) || +mv.range || 0;
    if (!steps) steps = Math.max(0, ...Object.values(move));
    const races = pack ? (c.races || []).map(r => r.id || r) : [c.race, c.race2].filter(Boolean);
    const classes = pack ? (c.classes || []).map(r => r.id || r) : (c.classes || []).filter(Boolean);
    const elements = pack ? (c.elements || []).map(r => r.id || r) : [c.element, c.element2].filter(Boolean);
    const gifts = (c.gifts || []).map(g => {
      const id = g.id; if (type === 'king') { const R = ROYAL[id]; if (!R) return null; const amt = g.amount !== undefined && g.amount !== '' ? +g.amount : R.def; return { id, scope: g.scope || 'all', target: g.target || '', amount: Math.max(R.min, Math.min(R.max, amt)) }; }
      return GIFTS[id] ? { id } : null;
    }).filter(Boolean);
    return {
      id: String(c.sourceId || c.id || ('karte_' + Math.random().toString(36).slice(2))), name: c.name || 'Ohne Namen', type, folder: String(c.folder || '').slice(0, 40),
      rarity: c.rarity || 'gewoehnlich', energy: type === 'king' ? 0 : Math.max(0, +c.energy || 0), atk: +c.atk || 0, def: type === 'king' ? 0 : +c.def || 0,
      hp: type === 'king' ? kingHp(c) : 0, races: [...new Set(races)], classes: [...new Set(classes)], elements: [...new Set(elements)],
      move: { steps: type === 'king' ? 0 : Math.max(0, Math.min(3, steps)), dirs: type === 'king' ? [] : Object.keys(move) },
      attack: { dirs: type === 'king' ? Object.fromEntries(Object.keys(atk).filter(k => ['n', 'ne', 'nw'].includes(k)).map(k => [k, 1])) : atk },
      gifts, issues: ((c.validation && c.validation.errors) || []).slice(0, 3), unknownGifts: (c.gifts || []).filter(g => type === 'king' ? !ROYAL[g.id] : !GIFTS[g.id]).map(g => g.id)
    };
  }

  function normalizeSpellCard(c) {
    const type = c.type, reasons = [];
    let sp = null, text = c.ruleTextShown || c.ruleText || '';
    if (!EF) reasons.push('Das Effektmodul fehlt.');
    else {
      if (c.spellFormat && c.spellFormat !== EF.FORMAT) reasons.push('Unbekanntes Effektformat „' + c.spellFormat + '“.');
      if (c.spell && +c.spell.v > EF.VERSION) reasons.push('Die Karte nutzt Effektformat Version ' + c.spell.v + ', dieses Spiel kennt Version ' + EF.VERSION + '. Bitte das Probe-Spiel aktualisieren.');
      if (!c.spell) reasons.push('Die Karte enthält keine Effektdaten.');
      sp = EF.normalizeSpell(c.spell, type);
      const full = Object.assign({}, c, { spell: sp });
      const st = EF.status(full, DATA());
      for (const r of st.reasons) if (!reasons.includes(r)) reasons.push(r);
      for (const e of sp.effects) if (!SPELL_KINDS.has(e.kind) && !reasons.some(r => r.includes(e.kind))) reasons.push('Effektart „' + e.kind + '“ wird vom Probe-Spiel nicht unterstützt.');
      if (!text.trim()) text = EF.describe(full, DATA());
    }
    return {
      id: String(c.sourceId || c.id || ('karte_' + Math.random().toString(36).slice(2))), name: c.name || 'Ohne Namen', type, folder: String(c.folder || '').slice(0, 40),
      rarity: c.rarity || 'gewoehnlich', energy: Math.max(0, +c.energy || 0), atk: 0, def: 0, hp: 0, races: [], classes: [], elements: [],
      move: { steps: 0, dirs: [] }, attack: { dirs: {} }, gifts: [], unknownGifts: [],
      spell: sp, ruleText: text, flavor: c.flavor || '', subtitle: c.subtitle || '', playable: !reasons.length, notPlayable: reasons, issues: []
    };
  }
  const SPELL_KINDS = new Set(['destroy', 'status', 'moveBlock', 'stat', 'giftBlock', 'giftRemove', 'fieldLock', 'revive', 'protect', 'deathWard', 'heal', 'neutralize', 'damage', 'draw', 'discard', 'mill', 'control']);
  const isSpell = c => !!c && (c.type === 'spell' || c.type === 'curse');

  /* ---------------- Deckprüfung (Abschnitt 3) ---------------- */
  function validateDeck(ids, cards) {
    const errs = [], warn = [], cnt = {};
    for (const id of ids) cnt[id] = (cnt[id] || 0) + 1;
    if (ids.length !== RULES.deckSize) errs.push('Das Deck hat ' + ids.length + ' statt 40 Karten.');
    const kings = ids.filter(id => cards[id] && cards[id].type === 'king').length;
    if (kings !== 1) errs.push(kings ? 'Das Deck hat ' + kings + ' Könige – erlaubt ist genau einer.' : 'Im Deck fehlt der König.');
    for (const [id, n] of Object.entries(cnt)) {
      const c = cards[id]; if (!c) { errs.push('Unbekannte Karte: ' + id); continue; }
      const lim = COPY_LIMIT[c.rarity] || 1;
      if (n > lim) errs.push('„' + c.name + '“ ist ' + n + '× im Deck – erlaubt sind ' + lim + '.');
      if (c.unknownGifts && c.unknownGifts.length) warn.push('„' + c.name + '“: Gabe(n) ' + c.unknownGifts.join(', ') + ' sind im Spiel nicht bekannt und wirken nicht.');
      if (c.issues && c.issues.length) warn.push('„' + c.name + '“ meldet in der Kartenwerkstatt: ' + c.issues.join(' '));
      if (c.type === 'hero' && !c.move.dirs.length) warn.push('„' + c.name + '“ hat keine Laufrichtung.');
      if (isSpell(c) && !c.playable) warn.push('„' + c.name + '“ ist nicht spielbar: ' + c.notPlayable.join(' '));
    }
    return { ok: !errs.length, errors: errs, warnings: warn };
  }

  /* ---------------- Spiel anlegen ---------------- */
  // opts: { cards: {id: card}, decks: [idsA, idsB], names: ['A','B'], ai: [false,'leicht'], seed, timer }
  function newGame(opts) {
    const cards = {}; for (const [id, c] of Object.entries(opts.cards)) cards[id] = c;
    const s = { v: VERSION, rng: (opts.seed >>> 0) || 1, seed: (opts.seed >>> 0) || 1, cards, turn: 0, active: 0, phase: 'setup', players: [], units: {}, nextId: 1, decl: {}, retreat: [], pendingDiscard: null, result: null, log: [], timer: !!opts.timer, counter: null, stack: [], auras: [], locks: [], counterReserve: true };
    const ev = [];
    // A und B werden den Seiten zufällig zugewiesen (15.7)
    const deckOrder = opts.fixedSides ? [0, 1] : rand(s) < 0.5 ? [0, 1] : [1, 0];
    for (let p = 0; p < 2; p++) {
      const di = deckOrder[p], ids = opts.decks[di].slice();
      const kingId = ids.find(id => cards[id].type === 'king');
      ids.splice(ids.indexOf(kingId), 1);
      const deck = shuffle(s, ids.map(cid => ({ iid: 'k' + (s.nextId++), cid })));
      const P = { deckName: di === 0 ? 'A' : 'B', name: (opts.sideNames && opts.sideNames[p]) || (opts.names && opts.names[di]) || (di === 0 ? 'Deck A' : 'Deck B'), ai: (opts.sideAi && opts.sideAi[p]) || (opts.ai && opts.ai[di]) || false, deck, hand: [], discard: [], energy: 0, turns: 0, king: null };
      s.players.push(P);
      const ku = makeUnit(s, kingId, p, KING_FIELD[p]); ku.hp = cards[kingId].hp; ku.summonTurn = 0; P.king = ku.uid;
    }
    for (let p = 0; p < 2; p++) for (let i = 0; i < RULES.startHand; i++) s.players[p].hand.push(s.players[p].deck.shift());
    s.active = rand(s) < 0.5 ? 0 : 1; // Münzwurf
    s.first = s.active;
    ev.push({ t: 'start', sides: [s.players[0].deckName, s.players[1].deckName], first: s.active });
    log(s, 'Partie beginnt. Unten: ' + s.players[0].name + ', oben: ' + s.players[1].name + '. Münzwurf: ' + s.players[s.active].name + ' beginnt.');
    startTurn(s, ev);
    return { state: s, events: ev };
  }
  function makeUnit(s, cid, owner, pos) {
    const uid = 'u' + (s.nextId++), c = s.cards[cid];
    const u = { uid, cid, owner, pos, king: c.type === 'king', summonTurn: s.turn, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] };
    s.units[uid] = u; return u;
  }
  function log(s, text, p) { s.log.push({ turn: s.turn, p: p === undefined ? s.active : p, text }); if (s.log.length > 400) s.log.splice(0, s.log.length - 400); }

  /* ---------------- Abfragen ---------------- */
  const card = (s, u) => s.cards[u.cid];
  const unitAt = (s, f) => Object.values(s.units).find(u => u.pos === f) || null;
  const hasRaw = (s, u, gid) => card(s, u).gifts.some(g => g.id === gid);
  const has = (s, u, gid) => hasRaw(s, u, gid) && !giftBlocked(s, u, gid);
  const kingOf = (s, p) => s.units[s.players[p].king];
  function matches(c, g) {
    const sc = g.scope || 'all'; if (sc === 'all') return true;
    if (sc === 'race') return c.races.includes(g.target);
    if (sc === 'class') return c.classes.includes(g.target);
    if (sc === 'element') return c.elements.includes(g.target);
    return false;
  }
  function royalBonus(s, p, c, stat) {
    const k = kingOf(s, p); if (!k || c.type !== 'hero') return 0; let sum = 0;
    for (const g of card(s, k).gifts) { const R = ROYAL[g.id]; if (R && R.stat === stat && matches(c, g) && !giftBlocked(s, k, g.id)) sum += g.amount; }
    return sum;
  }
  function cost(s, p, cid) { const c = s.cards[cid]; return Math.max(0, c.energy - royalBonus(s, p, c, 'energy')); }
  function atkOf(s, u) { const c = card(s, u); return Math.max(0, applyMods(c.atk + royalBonus(s, u.owner, c, 'atk'), statMods(s, u, 'atk'))); }
  function defOf(s, u) { const c = card(s, u); if (u.king) return 0; return Math.max(0, applyMods(c.def + royalBonus(s, u.owner, c, 'def'), statMods(s, u, 'def'))); }
  function stepsOf(s, u) { const c = card(s, u); if (u.king) return 0; return Math.max(0, Math.min(3, applyMods(c.move.steps, statMods(s, u, 'move')))); }
  // Übernommene Helden (Kontrolle übernehmen) umgehen Beschwörungssperre, Fesseln und Bewegungssperren (Festlegung des Entwicklers vom 30.10.2026)
  const freed = u => (u.fx || []).some(e => e.kind === 'control');
  const bound = u => !freed(u) && (u.fx || []).some(e => e.id === 'fesseln' || e.kind === 'moveBlock');
  const immobile = (s, u) => !freed(u) && (bound(u) || auraOn(s, u).some(a => a.kind === 'moveBlock'));
  function locked(s, u) { return !u.king && !freed(u) && u.summonTurn === s.turn && !has(s, u, 'ansturm'); }
  const isEnemyGuard = (f, owner) => isGuard(f, 1 - owner);

  // Laufziele: 1..steps Schritte, Richtungswechsel erlaubt, nur existierende freie Felder, nie über Besetztes, nie auf gegnerische Wachfelder
  function reachable(s, uid) {
    const u = s.units[uid]; const out = {};
    if (!u || u.king || s.phase !== 'move' || u.owner !== s.active || u.moved || locked(s, u) || immobile(s, u)) return out;
    const c = card(s, u), max = stepsOf(s, u); if (!max) return out;
    let frontier = [[u.pos, [u.pos]]]; const seen = new Set([u.pos]);
    for (let k = 0; k < max; k++) {
      const next = [];
      for (const [f, path] of frontier) for (const d of c.move.dirs) {
        const t = step(f, d, u.owner); if (!exists(t) || seen.has(t) || unitAt(s, t) || isEnemyGuard(t, u.owner) || fieldLocked(s, t)) continue;
        seen.add(t); const np = path.concat(t); out[t] = np; next.push([t, np]);
      }
      frontier = next;
    }
    return out;
  }
  // mögliche Angriffsziele eines Helden/Königs (unabhängig von der Phase)
  function targetsOf(s, uid) {
    const u = s.units[uid]; if (!u) return [];
    const c = card(s, u), res = [], seen = new Set();
    const add = (f, dist) => { const t = unitAt(s, f); if (t && t.owner !== u.owner && !seen.has(t.uid)) { if (u.king && t.king) return; seen.add(t.uid); res.push({ uid: t.uid, dist }); } };
    for (const [d, len] of Object.entries(c.attack.dirs)) {
      const reach = u.king ? 1 : has(s, u, 'schuetze') ? 2 : 1; // nur Schütze verlängert die Reichweite
      for (let n = 1; n <= reach; n++) { const f = step(u.pos, d, u.owner, n); if (exists(f)) add(f, n); }
      if (!u.king && u.flags.durchbruch && reach < 2) { const f = step(u.pos, d, u.owner, 2); if (exists(f)) { const t = unitAt(s, f); if (t && !t.king) add(f, 2); } }
    }
    return res;
  }
  function canAttack(s, uid) {
    const u = s.units[uid];
    return !!u && s.phase === 'battle' && u.owner === s.active && !locked(s, u) && Object.keys(card(s, u).attack.dirs).length > 0;
  }
  function attackTargets(s, uid) { return canAttack(s, uid) ? targetsOf(s, uid).map(t => t.uid) : []; }
  // Vorschau eines Einzelvergleichs
  function preview(s, aUid, tUid, mult) {
    const a = s.units[aUid], t = s.units[tUid]; const A = atkOf(s, a);
    if (t.king) return { kind: 'king', dmg: A * (mult || 1) };
    const D = defOf(s, t);
    if (a.king) return { kind: A >= D ? 'win' : 'none', atk: A, def: D };
    return { kind: A > D ? 'win' : A < D ? 'lose' : 'both', atk: A, def: D };
  }

  /* ---------------- Aktionen, die die UI anbieten kann ---------------- */
  function summonOptions(s, iid) {
    const p = s.active, P = s.players[p];
    if (!['summon1', 'summon2'].includes(s.phase) || s.pendingDiscard !== null) return [];
    const h = P.hand.find(x => x.iid === iid); if (!h) return [];
    const c = s.cards[h.cid]; if (c.type !== 'hero' || cost(s, p, h.cid) > P.energy) return [];
    return summonFields(p).filter(f => !unitAt(s, f) && !fieldLocked(s, f, true));
  }
  function giftOptions(s, uid) {
    const u = s.units[uid], out = [];
    // Festlegung des Entwicklers vom 30.10.2026: aktivierbare Heldengaben in der eigenen Battlephase ODER der eigenen Konterphase
    if (!u || u.king || !((s.phase === 'battle' && u.owner === s.active) || (s.phase === 'counter' && u.owner === s.counter))) return out;
    for (const g of card(s, u).gifts) {
      const G = GIFTS[g.id]; if (!G || G.kind !== 'ct') continue;
      const o = { id: g.id, name: G.name, ct: G.ct, cd: u.cd[g.id] || 0, targets: [], ok: false, why: '' };
      if (giftBlocked(s, u, g.id)) o.why = 'durch einen Fluch blockiert';
      else if (locked(s, u)) o.why = 'Beschwörungssperre';
      else if (o.cd > 0) o.why = 'Abklingzeit ' + o.cd;
      else {
        o.targets = giftTargets(s, u, g.id);
        o.ok = G.target === 'self' ? true : o.targets.length > 0;
        if (!o.ok) o.why = 'kein gültiges Ziel';
      }
      out.push(o);
    }
    return out;
  }
  function giftTargets(s, u, gid) {
    const all = Object.values(s.units);
    switch (gid) {
      case 'mordlust': case 'eisenpanzer': return [u.uid];
      case 'durchbruch': return u.flags.durchbruch ? [] : [u.uid];
      case 'entwaffnen': return targetsOf(s, u.uid).map(t => s.units[t.uid]).filter(t => !t.king).map(t => t.uid);
      case 'fesseln': return all.filter(t => !t.king && t.owner !== u.owner).map(t => t.uid);
      case 'heilung': return all.filter(t => t.owner === u.owner).map(t => t.uid);
      case 'rueckzug': return all.filter(t => !t.king && !s.retreat.includes(t.uid)).map(t => t.uid);
      case 'tausch': return immobile(s, u) || fieldLocked(s, u.pos) ? [] : all.filter(t => !t.king && t.owner === u.owner && t.uid !== u.uid && !immobile(s, t) && !fieldLocked(s, t.pos)).map(t => t.uid);
      case 'blitzschritt': {
        if (immobile(s, u)) return [];
        return card(s, u).move.dirs.map(d => step(u.pos, d, u.owner)).filter(f => exists(f) && !unitAt(s, f) && !isEnemyGuard(f, u.owner) && !fieldLocked(s, f));
      }
    }
    return [];
  }

  /* ---------------- Zugablauf ---------------- */
  const PHASES = ['prep', 'summon1', 'move', 'battle', 'counter', 'resolve', 'summon2', 'end'];
  const PHASE_NAME = { prep: 'Vorbereitung', summon1: '1. Beschwörung', move: 'Bewegung', battle: 'Battlephase', counter: 'Konterphase', resolve: 'Auswertung', summon2: 'Nachbeschwörung', end: 'Zugende', over: 'Partie beendet', setup: 'Aufbau' };

  function startTurn(s, ev) {
    const p = s.active, P = s.players[p];
    s.turn++; P.turns++; s.phase = 'prep';
    ev.push({ t: 'turn', p, turn: s.turn, own: P.turns });
    log(s, '— Zug ' + P.turns + ' von ' + P.name + ' —', p);
    // 1. Karte ziehen
    if (P.deck.length) { const c = P.deck.shift(); P.hand.push(c); ev.push({ t: 'draw', p, iid: c.iid, cid: c.cid }); log(s, P.name + ' zieht eine Karte.', p); }
    else { const k = kingOf(s, p); k.hp -= RULES.drawFailDamage; ev.push({ t: 'drawFail', p, uid: k.uid, dmg: RULES.drawFailDamage, hp: k.hp }); log(s, 'Nachziehstapel leer: ' + P.name + 's König verliert ' + RULES.drawFailDamage + ' HP.', p); }
    // 2. Energie
    P.energy = Math.min(P.turns, RULES.energyMax); ev.push({ t: 'energy', p, energy: P.energy });
    // 3. Cooldowns
    for (const u of Object.values(s.units)) if (u.owner === p) for (const g of Object.keys(u.cd)) { if (u.cd[g] > 0) u.cd[g]--; if (!u.cd[g]) delete u.cd[g]; }
    // 4. Dauerwirkungen enden (vor Poison, 15.2)
    const due = e => e.until && e.until.p === p && P.turns >= e.until.turn;
    for (const u of Object.values(s.units)) {
      const keep = [];
      for (const e of u.fx) { if (due(e)) { ev.push({ t: 'fxEnd', uid: u.uid, id: e.id }); if (e.cid) log(s, '„' + s.cards[e.cid].name + '“ endet für ' + card(s, u).name + '.', p); } else keep.push(e); }
      u.fx = keep;
    }
    expireGlobal(s, ev, due, p);
    checkWhile(s, ev);
    syncControl(s, ev);
    // 5. Poison: alle fälligen Todesfälle gemeinsam (15.3)
    const dying = Object.values(s.units).filter(u => u.poison && u.poison.by === p).map(u => u.uid).sort();
    if (dying.length) { const names = Object.fromEntries(dying.map(uid => [uid, card(s, s.units[uid]).name])); kill(s, dying, ev, 'poison'); for (const uid of dying) if (!s.units[uid]) log(s, names[uid] + ' stirbt an Poison.', p); }
    if (checkEnd(s, ev)) return;
    if (P.hand.length > RULES.handMax) { s.pendingDiscard = p; ev.push({ t: 'mustDiscard', p }); log(s, P.name + ' hat 11 Handkarten und muss eine ablegen.', p); }
    setPhase(s, 'summon1', ev);
  }
  function setPhase(s, ph, ev) { s.phase = ph; ev.push({ t: 'phase', phase: ph, p: s.active }); }
  function kill(s, uids, ev, cause) {
    const dead = [];
    for (const uid of uids) {
      const u = s.units[uid]; if (!u || u.king) continue;
      if (useWard(s, u, ev, cause)) continue;
      delete s.units[uid]; s.players[u.origOwner === undefined ? u.owner : u.origOwner].discard.push({ iid: 'd' + uid, cid: u.cid });
      for (const at of u.attached || []) s.players[at.owner].discard.push({ iid: 'd' + uid + '_' + at.cid, cid: at.cid });
      delete s.decl[uid]; dead.push(uid);
    }
    // Angriffe auf tote Ziele entfallen
    for (const [a, d] of Object.entries(s.decl)) { d.targets = d.targets.filter(t => s.units[t]); if (!d.targets.length) delete s.decl[a]; }
    s.retreat = s.retreat.filter(x => s.units[x]);
    if (dead.length) ev.push({ t: 'death', uids: dead, cause });
    if (dead.length) checkWhile(s, ev);
  }
  function checkEnd(s, ev) {
    if (s.result) return true;
    const lost = [0, 1].map(p => kingOf(s, p).hp <= 0);
    const empty = [0, 1].map(p => !s.players[p].hand.length && !s.players[p].deck.length);
    let res = null;
    if (empty[0] || empty[1]) {
      if (empty[0] && empty[1]) res = { draw: true, reason: 'Beide Spieler haben weder Hand- noch Nachziehkarten.' };
      else { const l = empty[0] ? 0 : 1; res = { winner: 1 - l, reason: s.players[l].name + ' hat weder Handkarten noch einen Nachziehstapel.' }; }
    } else if (lost[0] && lost[1]) res = { draw: true, reason: 'Beide Könige sind im selben Angriffspaket gefallen.' };
    else if (lost[0] || lost[1]) { const l = lost[0] ? 0 : 1; res = { winner: 1 - l, reason: 'Der König von ' + s.players[l].name + ' hat keine HP mehr.' }; }
    if (!res) return false;
    s.result = res; s.phase = 'over';
    ev.push({ t: 'gameOver', result: res });
    log(s, res.draw ? 'Unentschieden: ' + res.reason : s.players[res.winner].name + ' gewinnt. ' + res.reason);
    return true;
  }
  function endTurn(s, ev) {
    const p = s.active;
    setPhase(s, 'end', ev);
    for (const u of Object.values(s.units)) { u.fx = u.fx.filter(e => { if (e.endTurn || (e.untilEnd && e.untilEnd.p === p && s.players[p].turns >= e.untilEnd.turn)) { ev.push({ t: 'fxEnd', uid: u.uid, id: e.id }); return false; } return true; }); u.moved = false; u.flags = {}; }
    expireGlobal(s, ev, e => e.endTurn || (e.untilEnd && e.untilEnd.p === p && s.players[p].turns >= e.untilEnd.turn), p);
    s.decl = {}; s.retreat = [];
    syncControl(s, ev);
    // Festlegung des Entwicklers vom 30.10.2026: unverbrauchte Energie bleibt bis nach der gegnerischen Konterphase (für Konter), danach verfällt sie; am eigenen Zugbeginn wird normal aufgefüllt
    if (s.counterReserve) s.players[p].reserve = true; else s.players[p].energy = 0;
    s.players[1 - p].energy = 0; s.players[1 - p].reserve = false;
    s.active = 1 - p;
    startTurn(s, ev);
  }

  /* ---------------- Kampf ---------------- */
  function resolveBattle(s, ev) {
    setPhase(s, 'resolve', ev);
    resolveSpells(s, ev);
    { const d = s.players[1 - s.active]; if (d.reserve) { d.energy = 0; d.reserve = false; } }
    if (checkEnd(s, ev)) return;
    const plan = [];
    for (const [aUid, d] of Object.entries(s.decl).sort((x, y) => x[0].localeCompare(y[0], 'en', { numeric: true }))) {
      const a = s.units[aUid]; if (!a) continue;
      const valid = new Set(targetsOf(s, aUid).map(t => t.uid));
      const tg = d.targets.filter(t => valid.has(t));
      if (tg.length < d.targets.length) log(s, card(s, a).name + ': ein Ziel ist nicht mehr erreichbar, dieser Angriff entfällt.');
      if (tg.length) plan.push({ a: aUid, targets: tg });
    }
    // Werte vor dem gleichzeitigen Kampf
    const A = {}, Dv = {};
    for (const u of Object.values(s.units)) { A[u.uid] = atkOf(s, u); Dv[u.uid] = defOf(s, u); }
    const deaths = new Set(), dmg = [0, 0], poisonTo = [], hits = [];
    for (const { a, targets } of plan) {
      const au = s.units[a];
      const kingTarget = targets.find(t => s.units[t].king);
      const list = kingTarget && targets.length === 1 && has(s, au, 'doppelschlag') ? [kingTarget, kingTarget] : targets;
      for (const t of list) {
        const tu = s.units[t];
        if (!tu.king && isProtected(s, tu)) { hits.push({ a, t, kind: 'protected' }); continue; }
        if (tu.king) { dmg[tu.owner] += A[a]; hits.push({ a, t, kind: 'king', dmg: A[a] }); continue; }
        const at = A[a], df = Dv[t];
        let r;
        if (au.king) { r = at >= df ? 'win' : 'none'; if (r === 'win') deaths.add(t); }
        else { r = at > df ? 'win' : at < df ? 'lose' : 'both'; if (r !== 'lose') deaths.add(t); if (r !== 'win') deaths.add(a); }
        hits.push({ a, t, kind: r, atk: at, def: df });
        if (!au.king && has(s, au, 'poison')) poisonTo.push({ v: t, by: au.owner, src: a });
        if (!au.king && has(s, tu, 'poison')) poisonTo.push({ v: a, by: tu.owner, src: t });
      }
    }
    ev.push({ t: 'combat', hits });
    for (const h of hits) {
      const an = card(s, s.units[h.a]).name, tn = card(s, s.units[h.t]).name;
      log(s, h.kind === 'protected' ? an + ' greift ' + tn + ' an – der Angriff ist durch einen Schutzzauber wirkungslos.' : h.kind === 'king' ? an + ' trifft den König: −' + h.dmg.toLocaleString('de-DE') + ' HP.'
        : h.kind === 'win' ? an + ' (' + h.atk + ') besiegt ' + tn + ' (' + h.def + ').'
        : h.kind === 'lose' ? an + ' (' + h.atk + ') scheitert an ' + tn + ' (' + h.def + ') und fällt.'
        : h.kind === 'both' ? an + ' und ' + tn + ' fallen beide (' + h.atk + ' = ' + h.def + ').'
        : an + ' (' + h.atk + ') kann ' + tn + ' (' + h.def + ') nichts anhaben.');
    }
    // Poison nur auf Überlebende, nicht stapeln, Göttlicher Segen wehrt ab
    for (const pz of poisonTo) {
      const v = s.units[pz.v]; if (!v || deaths.has(pz.v) || v.king || v.poison) continue;
      if (has(s, v, 'goettlicher_segen')) { ev.push({ t: 'blocked', uid: v.uid, id: 'poison' }); log(s, card(s, v).name + ': Göttlicher Segen wehrt Poison ab.'); continue; }
      v.poison = { by: pz.by }; ev.push({ t: 'poisoned', uid: v.uid, by: pz.by }); log(s, card(s, v).name + ' ist vergiftet und stirbt zu Beginn des nächsten Zuges von ' + s.players[pz.by].name + '.');
    }
    for (let p = 0; p < 2; p++) if (dmg[p]) { const k = kingOf(s, p); k.hp -= dmg[p]; ev.push({ t: 'kingDamage', uid: k.uid, dmg: dmg[p], hp: k.hp }); }
    kill(s, [...deaths], ev, 'combat');
    s.decl = {};
    if (checkEnd(s, ev)) return;
    // Rückzug nach der Schadensberechnung
    for (const uid of s.retreat) {
      const u = s.units[uid]; if (!u) continue;
      const f = step(u.pos, 's', u.owner);
      if (!immobile(s, u) && exists(f) && !unitAt(s, f) && !isEnemyGuard(f, u.owner) && !fieldLocked(s, f)) { const from = u.pos; u.pos = f; ev.push({ t: 'move', uid, path: [from, f], cause: 'rueckzug' }); log(s, card(s, u).name + ' zieht sich zurück (' + from + ' → ' + f + ').'); }
      else log(s, card(s, u).name + ' kann sich nicht zurückziehen.');
    }
    s.retreat = [];
    setPhase(s, 'summon2', ev);
  }

  /* ---------------- Aktion anwenden ---------------- */
  function apply(state, action) {
    const s = clone(state), ev = [];
    upgrade(s);
    const fail = msg => ({ state, events: [], error: msg });
    if (s.result) return fail('Die Partie ist beendet.');
    const p = action.p === undefined ? s.active : action.p, P = s.players[p];
    const a = action;
    if (a.type === 'concede') { s.result = { winner: 1 - p, reason: P.name + ' hat aufgegeben.' }; s.phase = 'over'; ev.push({ t: 'gameOver', result: s.result }); log(s, P.name + ' gibt auf.'); return { state: s, events: ev }; }
    if (s.pendingDiscard !== null) {
      if (a.type !== 'discard' || p !== s.pendingDiscard) return fail('Zuerst eine Handkarte ablegen (höchstens 10 Handkarten).');
      const i = P.hand.findIndex(h => h.iid === a.iid); if (i < 0) return fail('Diese Karte ist nicht auf der Hand.');
      const [h] = P.hand.splice(i, 1); P.discard.push(h); s.pendingDiscard = P.hand.length > RULES.handMax ? p : null;
      ev.push({ t: 'discard', p, iid: h.iid, cid: h.cid }); log(s, P.name + ' legt „' + s.cards[h.cid].name + '“ ab.', p);
      checkEnd(s, ev); return { state: s, events: ev };
    }
    if (s.phase === 'counter') {
      if (p !== s.counter) return fail('Jetzt ist die Konterphase des Verteidigers.');
      if (a.type === 'cast') { const r = castSpell(s, ev, p, a); if (r) return fail(r); checkWhile(s, ev); return { state: s, events: ev }; }
      if (a.type === 'gift') { const r = useGift(s, ev, p, a); if (r) return fail(r.error); checkWhile(s, ev); return { state: s, events: ev }; }
      if (a.type !== 'pass' && a.type !== 'timeout') return fail('In der Konterphase sind nur Zauber, Flüche und Heldengaben erlaubt.');
      ev.push({ t: 'counterPass', p }); log(s, s.players[p].name + ' passt in der Konterphase.', p);
      s.counter = null; resolveBattle(s, ev); return { state: s, events: ev };
    }
    if (p !== s.active) return fail('Du bist nicht am Zug.');
    switch (a.type) {
      case 'summon': {
        if (!['summon1', 'summon2'].includes(s.phase)) return fail('Beschwören geht nur in einer Beschwörungsphase.');
        const opts = summonOptions(s, a.iid); if (!opts.includes(a.field)) return fail('Hier kann diese Karte nicht beschworen werden.');
        const i = P.hand.findIndex(h => h.iid === a.iid), h = P.hand[i], c = s.cards[h.cid], k = cost(s, p, h.cid);
        P.hand.splice(i, 1); P.energy -= k;
        const u = makeUnit(s, h.cid, p, a.field);
        ev.push({ t: 'summon', p, uid: u.uid, cid: h.cid, iid: h.iid, field: a.field, cost: k });
        log(s, P.name + ' beschwört „' + c.name + '“ auf ' + a.field + ' (' + k + ' Energie).', p);
        checkEnd(s, ev); break;
      }
      case 'move': {
        if (s.phase !== 'move') return fail('Laufen geht nur in der Bewegungsphase.');
        const r = reachable(s, a.uid); if (!r[a.to]) return fail('Dieses Feld ist nicht erreichbar.');
        const u = s.units[a.uid], from = u.pos; u.pos = a.to; u.moved = true;
        ev.push({ t: 'move', uid: u.uid, path: r[a.to] }); log(s, card(s, u).name + ' läuft ' + from + ' → ' + a.to + '.', p); break;
      }
      case 'declare': {
        if (s.phase !== 'battle') return fail('Angriffe werden in der Battlephase festgelegt.');
        const u = s.units[a.uid]; if (!u || u.owner !== p) return fail('Kein eigener Kämpfer.');
        if (!canAttack(s, a.uid)) return fail(locked(s, u) ? 'Beschwörungssperre: greift erst im nächsten eigenen Zug an.' : 'Dieser Kämpfer kann nicht angreifen.');
        const valid = new Set(targetsOf(s, a.uid).map(t => t.uid));
        let tg = [...new Set(a.targets || [])];
        if (tg.some(t => !valid.has(t))) return fail('Dieses Ziel ist nicht in Angriffsreichweite.');
        if (!tg.length) { delete s.decl[a.uid]; ev.push({ t: 'declare', uid: a.uid, targets: [] }); break; }
        const max = has(s, u, 'doppelschlag') && !u.king ? 2 : 1;
        if (tg.length > max) return fail('Zu viele Ziele.');
        if (tg.length === 2 && tg.some(t => s.units[t].king)) return fail('Doppelschlag gegen einen König trifft den König zweimal – dann kein zweites Ziel.');
        s.decl[a.uid] = { targets: tg }; ev.push({ t: 'declare', uid: a.uid, targets: tg }); break;
      }
      case 'gift': { const r = useGift(s, ev, p, a); if (r) return fail(r.error); break; }
      case 'cast': { const r = castSpell(s, ev, p, a); if (r) return fail(r); break; }
      case 'endPhase': case 'timeout': {
        const ph = s.phase;
        if (ph === 'summon1') setPhase(s, 'move', ev);
        else if (ph === 'move') setPhase(s, 'battle', ev);
        else if (ph === 'battle') {
          ev.push({ t: 'battleClosed', decl: clone(s.decl) }); log(s, 'Battlephase abgeschlossen: ' + Object.keys(s.decl).length + ' Angriff(e) festgelegt.', p);
          s.phase = 'counter'; s.counter = 1 - p; ev.push({ t: 'phase', phase: 'counter', p: 1 - p });
          // Ohne ausspielbare Konterkarte wird automatisch gepasst
          if (!counterPlayable(s, 1 - p)) { ev.push({ t: 'counterPass', p: 1 - p, auto: true }); log(s, 'Konterphase von ' + s.players[1 - p].name + ': kein ausspielbarer Zauber oder Fluch und keine einsetzbare Gabe – automatisch gepasst.', 1 - p); s.counter = null; resolveBattle(s, ev); }
        }
        else if (ph === 'summon2') endTurn(s, ev);
        else return fail('In dieser Phase nicht möglich.');
        if (a.type === 'timeout' && !s.result && s.active === p && s.phase !== 'counter') { const r = apply(s, a); return { state: r.state, events: ev.concat(r.events) }; }
        break;
      }
      default: return fail('Unbekannte Aktion.');
    }
    checkWhile(s, ev);
    return { state: s, events: ev };
  }
  // Ältere Spielstände (vor Zaubern/Flüchen) ergänzen
  function upgrade(s) { s.stack = s.stack || []; s.auras = s.auras || []; s.locks = s.locks || []; for (const u of Object.values(s.units)) { u.attached = u.attached || []; u.fx = u.fx || []; } return s; }
  function counterPlayable(s, p) { return s.players[p].hand.some(h => isSpell(s.cards[h.cid]) && castOptions(s, p, h.iid).ok) || Object.values(s.units).some(u => u.owner === p && !u.king && giftOptions(s, u.uid).some(o => o.ok)); }

  function useGift(s, ev, p, a) {
    const fail = msg => ({ state: s, events: [], error: msg, keep: true });
    const u = s.units[a.uid]; if (!u || u.owner !== p) return fail('Kein eigener Held.');
    const o = giftOptions(s, a.uid).find(x => x.id === a.gift);
    if (!o) return fail('Diese Gabe ist jetzt nicht aktivierbar.');
    if (!o.ok) return fail(o.name + ': ' + o.why + '.');
    const G = GIFTS[a.gift], name = card(s, u).name;
    let tgt = a.target;
    if (G.target === 'self') tgt = u.uid;
    if (!o.targets.includes(tgt)) return fail('Ungültiges Ziel für ' + G.name + '.');
    const T = s.units[tgt];
    const negative = (target, fn) => { if (has(s, target, 'goettlicher_segen')) { ev.push({ t: 'blocked', uid: target.uid, id: a.gift }); log(s, card(s, target).name + ': Göttlicher Segen wehrt ' + G.name + ' ab.'); return; } fn(); };
    u.cd[a.gift] = G.ct;
    ev.push({ t: 'gift', uid: u.uid, gift: a.gift, target: tgt });
    switch (a.gift) {
      case 'mordlust': u.fx.push({ id: 'mordlust', stat: 'atk', amount: 500, endTurn: true }); log(s, name + ': Mordlust (+500 ATK bis Zugende).'); break;
      case 'eisenpanzer': u.fx.push({ id: 'eisenpanzer', stat: 'def', amount: 300, until: { p, turn: s.players[p].turns + 2 } }); log(s, name + ': Eisenpanzer (+300 DEF für zwei Runden).'); break;
      case 'durchbruch': u.flags.durchbruch = true; log(s, name + ': Durchbruch – kann in dieser Battlephase einen Helden 2 Felder entfernt angreifen.'); break;
      case 'entwaffnen': negative(T, () => { T.fx.push({ id: 'entwaffnen', stat: 'def', amount: -500, endTurn: true, negative: true }); log(s, name + ': Entwaffnen auf ' + card(s, T).name + ' (−500 DEF bis Zugende).'); }); break;
      case 'fesseln': negative(T, () => { T.fx = T.fx.filter(e => e.id !== 'fesseln'); T.fx.push({ id: 'fesseln', negative: true, until: { p, turn: s.players[p].turns + 2 } }); log(s, name + ': Fesseln auf ' + card(s, T).name + ' (zwei Runden bewegungsunfähig).'); }); break;
      case 'heilung': { const neg = auraOn(s, T).filter(x => x.negative); const n = T.fx.filter(e => e.negative).length + neg.length + (T.poison ? 1 : 0); T.fx = T.fx.filter(e => !e.negative); T.poison = null; for (const x of neg) x.exempt.push(T.uid); detachUnused(s, T); syncControl(s, ev); ev.push({ t: 'healed', uid: T.uid }); log(s, name + ': Heilung auf ' + card(s, T).name + (n ? ' – negative Effekte entfernt.' : ' – keine negativen Effekte vorhanden.')); break; }
      case 'rueckzug': s.retreat.push(T.uid); log(s, name + ': Rückzug für ' + card(s, T).name + ' (nach der Schadensberechnung).'); break;
      case 'tausch': { const f1 = u.pos, f2 = T.pos; u.pos = f2; T.pos = f1; ev.push({ t: 'swap', a: u.uid, b: T.uid }); log(s, name + ' tauscht mit ' + card(s, T).name + ' (' + f1 + ' ↔ ' + f2 + ').'); dropInvalid(s, ev); break; }
      case 'blitzschritt': { const from = u.pos; u.pos = tgt; ev.push({ t: 'move', uid: u.uid, path: [from, tgt], cause: 'blitzschritt' }); log(s, name + ': Blitzschritt ' + from + ' → ' + tgt + '.'); dropInvalid(s, ev); break; }
    }
    return null;
  }
  // Nach Positionswechseln in der Battlephase: nicht mehr erreichbare Ziele aus der Planung nehmen
  function dropInvalid(s, ev) {
    for (const [aUid, d] of Object.entries(s.decl)) {
      const valid = new Set(targetsOf(s, aUid).map(t => t.uid)); const tg = d.targets.filter(t => valid.has(t));
      if (tg.length !== d.targets.length) { if (tg.length) d.targets = tg; else delete s.decl[aUid]; ev.push({ t: 'declare', uid: aUid, targets: tg }); }
    }
  }

  /* ================= Zauber und Flüche (Abschnitt 8) =================
   * Datenformat: effects.js (gemeinsam mit der Kartenwerkstatt). Die strukturierten Effekte sind verbindlich.
   * Laufende Wirkungen liegen als fx-Einträge an Einheiten (Einzelziele), als s.auras (Flächeneffekte) und s.locks (Feldsperren).
   * Werte werden immer aus Grundwert + aktiven Wirkungen berechnet; nach dem Ablauf wird nichts „zurückgerechnet“.
   */
  const sideOk = (side, owner, caster) => side === 'both' || (side === 'own' ? owner === caster : owner !== caster);
  function attackedSet(s) { const set = new Set(); for (const d of Object.values(s.decl || {})) for (const t of d.targets) set.add(t); return set; }
  function matchFilter(s, c, f, uid) {
    if (!f || !f.items || !f.items.length) return true;
    const one = it => it.items ? matchFilter(s, c, it, uid)
      : it.k === 'race' ? c.races.includes(it.v) : it.k === 'class' ? c.classes.includes(it.v) : it.k === 'element' ? c.elements.includes(it.v)
      : it.k === 'unitType' ? c.type === (it.v || 'hero') : it.k === 'attacked' ? !!uid && attackedSet(s).has(uid) : false;
    return f.op === 'or' ? f.items.some(one) : f.items.every(one);
  }
  function evalCond(s, p, c) {
    if (!c) return true;
    if (c.items) { if (!c.items.length) return true; return c.op === 'or' ? c.items.some(x => evalCond(s, p, x)) : c.items.every(x => evalCond(s, p, x)); }
    const min = Math.max(1, +c.min || 1), units = Object.values(s.units);
    const fu = (u, wantKing) => (wantKing ? true : !u.king) && matchFilter(s, card(s, u), c.filter, u.uid);
    const kingWanted = !!(c.filter && c.filter.items || []).some(it => it.k === 'unitType' && it.v === 'king');
    switch (c.k) {
      case 'control': return units.filter(u => u.owner === p && fu(u, kingWanted)).length >= min;
      case 'enemyControl': return units.filter(u => u.owner !== p && fu(u, kingWanted)).length >= min;
      case 'onField': return units.some(u => u.owner === p && u.cid === c.card);
      case 'discard': { const P = s.players[c.side === 'enemy' ? 1 - p : p]; return P.discard.filter(d => s.cards[d.cid] && s.cards[d.cid].type === 'hero' && matchFilter(s, s.cards[d.cid], c.filter)).length >= min; }
      case 'kingHp': { const k = kingOf(s, c.side === 'enemy' ? 1 - p : p); return c.cmp === '>=' ? k.hp >= +c.value : k.hp <= +c.value; }
      case 'attacked': { const at = attackedSet(s); return units.filter(u => u.owner === p && at.has(u.uid)).length >= min; }
      case 'fieldAny': return units.filter(u => fu(u, kingWanted)).length >= min;
      case 'hand': return s.players[p].hand.filter(h => h.iid !== s.casting).length >= min;
    }
    return false;
  }
  // Flächeneffekte, die gerade auf diese Einheit wirken
  function auraOn(s, u, raw) {
    const out = [];
    const shield = !raw && curseShield(s, u);
    for (const a of s.auras || []) {
      if (shield && a.src === 'curse' && a.by !== u.owner && a.negative) continue; // Schutz vor Flüchen
      if ((a.exempt || []).includes(u.uid)) continue;
      if (a.what === 'king' ? !u.king : u.king) continue;
      if (!sideOk(a.side, u.owner, a.by)) continue;
      if (!matchFilter(s, card(s, u), a.filter, u.uid)) continue;
      if (a.negative && hasRaw(s, u, 'goettlicher_segen')) continue; // Göttlicher Segen wehrt negative Effekte ab
      out.push(a);
    }
    return out;
  }
  function giftBlocked(s, u, gid) {
    const hit = e => (e.kind === 'giftBlock' || e.kind === 'giftRemove') && (e.gifts === 'all' || (e.gifts || []).includes(gid));
    if (gid === 'goettlicher_segen') return false; // Segen wehrt jede negative Wirkung ab, also auch eine Sperre gegen sich selbst
    return (u.fx || []).some(hit) || auraOn(s, u).some(hit);
  }
  function statMods(s, u, stat) {
    const list = (u.fx || []).filter(e => e.stat === stat).concat(auraOn(s, u).filter(a => a.kind === 'stat' && a.stat === stat));
    return list.map(e => ({ mode: e.mode || 'add', amount: +e.amount || 0, ord: e.ord || 0 }));
  }
  function applyMods(base, list) {
    const sets = list.filter(m => m.mode === 'set').sort((a, b) => a.ord - b.ord);
    let v = sets.length ? sets[sets.length - 1].amount : base;
    for (const m of list) if (m.mode !== 'set') v += m.amount;
    return v;
  }
  function fieldLocked(s, f, summon) { return (s.locks || []).some(l => l.fields.includes(f) && (!summon || l.noSummon)); }
  // Schutz: „Angriffe“ (Standard), „Flüche“ oder beides (Festlegung des Entwicklers vom 30.10.2026)
  const shieldFrom = x => x.kind === 'protect' ? (x.from || 'attacks') : null;
  function isProtected(s, u) { return (u.fx || []).some(e => ['attacks', 'both'].includes(shieldFrom(e))) || auraOn(s, u).some(a => ['attacks', 'both'].includes(shieldFrom(a))); }
  function curseShield(s, u) { return (u.fx || []).some(e => ['curses', 'both'].includes(shieldFrom(e))) || auraOn(s, u, true).some(a => ['curses', 'both'].includes(shieldFrom(a))); }
  function useWard(s, u, ev, cause) {
    const fx = u.fx.find(e => e.kind === 'deathWard' && (!e.uses || (e.used || 0) < e.uses));
    let src = fx;
    if (!src) { const a = auraOn(s, u).find(a => a.kind === 'deathWard' && (!a.uses || ((a.used || {})[u.uid] || 0) < a.uses)); if (a) { a.used = a.used || {}; a.used[u.uid] = (a.used[u.uid] || 0) + 1; src = a; } }
    else fx.used = (fx.used || 0) + 1;
    if (!src) return false;
    if (cause === 'poison') u.poison = null;
    ev.push({ t: 'warded', uid: u.uid, cid: src.cid, cause });
    log(s, card(s, u).name + ' wird durch „' + (s.cards[src.cid] || {}).name + '“ vor der Zerstörung bewahrt' + (cause === 'poison' ? ' (Poison entfernt)' : '') + '.');
    return true;
  }
  // Ablauf von Flächeneffekten und Feldsperren (Zugbeginn: until, Zugende: endTurn)
  function expireGlobal(s, ev, due, p) {
    const end = (list, what) => list.filter(x => { if (!due(x)) return true; ev.push({ t: 'fxEnd', id: x.id, area: what }); log(s, '„' + (s.cards[x.cid] || {}).name + '“ endet' + (what === 'lock' ? ': Felder ' + x.fields.join(', ') + ' wieder frei.' : '.'), p); return false; });
    s.auras = end(s.auras || [], 'aura'); s.locks = end(s.locks || [], 'lock');
  }
  function checkWhile(s, ev) {
    const ok = x => !x.whileCond || evalCond(s, x.by, x.whileCond);
    for (const u of Object.values(s.units)) { const n = u.fx.length; u.fx = u.fx.filter(e => { if (ok(e)) return true; ev.push({ t: 'fxEnd', uid: u.uid, id: e.id }); log(s, '„' + (s.cards[e.cid] || {}).name + '“ endet für ' + card(s, u).name + ': Bedingung nicht mehr erfüllt.'); return false; }); if (u.fx.length !== n) detachUnused(s, u); }
    const keep = (list, what) => list.filter(x => { if (ok(x)) return true; ev.push({ t: 'fxEnd', id: x.id, area: what }); log(s, '„' + (s.cards[x.cid] || {}).name + '“ endet: Bedingung nicht mehr erfüllt.'); return false; });
    s.auras = keep(s.auras || [], 'aura'); s.locks = keep(s.locks || [], 'lock');
    syncControl(s, ev);
  }
  function isNegative(kind, e, cardType) {
    if (['status', 'moveBlock', 'giftBlock', 'giftRemove', 'control'].includes(kind)) return true;
    if (kind === 'stat') return (e.params.mode || 'add') === 'set' ? cardType === 'curse' : (+e.params.amount || 0) < 0;
    return false;
  }
  // „Runden“: Wirkungen im Gegnerzug enden zu Beginn deines n-ten nächsten Zuges (= n Züge des Gegners),
  // Wirkungen in deinen Zügen (eigene ATK/Schritte, gegnerische DEF) am Ende deines n-ten nächsten Zuges (Festlegung des Entwicklers vom 30.10.2026)
  function durFields(s, entry, d, e) {
    d = d || { kind: 'instant' };
    if (d.kind === 'turn') return { endTurn: true };
    if (d.kind === 'rounds' && e && EF && EF.phaseOf && EF.phaseOf(e) === 'own') return { untilEnd: { p: entry.p, turn: s.players[entry.p].turns + Math.max(1, +d.n || 1) } };
    if (d.kind === 'rounds') return { until: { p: entry.p, turn: s.players[entry.p].turns + Math.max(1, +d.n || 1) } };
    if (d.kind === 'permanent') return { permanent: true };
    if (d.kind === 'while') return { whileCond: d.cond || { op: 'and', items: [] }, by: entry.p };
    return {};
  }
  function halfFields(p, side) {
    const own = p === 0 ? [5, 6, 7] : [1, 2, 3], enemy = p === 0 ? [1, 2, 3] : [5, 6, 7];
    return FIELDS.filter(f => side === 'both' || (side === 'own' ? own : enemy).includes(rowOf(f)));
  }
  // Mögliche Ziele eines Effekts für Spieler p
  function effectCandidates(s, p, e, c) {
    const t = e.target || {}, units = Object.values(s.units), at = attackedSet(s);
    switch (t.what) {
      case 'unit': return units.filter(u => !u.king && sideOk(t.side, u.owner, p) && matchFilter(s, card(s, u), t.filter, u.uid) && (e.trigger !== 'enemyAttack' || (u.owner === p && at.has(u.uid)))
        && !(e.kind === 'status' && e.params.status === 'poison' && u.poison)).map(u => ({ id: u.uid, label: card(s, u).name + ' (' + u.pos + ')' }));
      case 'king': return [0, 1].filter(q => sideOk(t.side, q, p)).map(q => kingOf(s, q)).map(k => ({ id: k.uid, label: card(s, k).name + ' (König)' }));
      case 'field': return halfFields(p, t.side || 'both').map(f => ({ id: f, label: f }));
      case 'discard': { const out = []; for (const q of [0, 1]) if (sideOk(t.side || 'own', q, p)) for (const d of s.players[q].discard) { const dc = s.cards[d.cid]; if (dc && dc.type === 'hero' && matchFilter(s, dc, t.filter)) out.push({ id: q + ':' + d.iid, label: dc.name + (q === p ? '' : ' (gegnerisch)') }); } return out; }
      case 'card': return (s.stack || []).filter(x => x.p !== p).map(x => ({ id: x.sid, label: s.cards[x.cid].name }));
      case 'player': return [t.side === 'enemy' ? 1 - p : p].map(q => ({ id: 'p' + q, label: s.players[q].name }));
    }
    return [];
  }
  const maxOf = t => t.count === 'all' ? Infinity : t.count === 'n' ? Math.max(1, +t.n || 1) : 1;
  const playerPicks = t => t.count !== 'all' && t.pick !== 'auto' && t.what !== 'king' || (t.what === 'king' && t.side === 'both' && t.pick !== 'auto');
  function castOptions(s, p, iid) {
    const P = s.players[p], h = P.hand.find(x => x.iid === iid), out = { ok: false, why: '', cost: 0, effects: [] };
    if (!h) { out.why = 'nicht auf der Hand'; return out; }
    const c = s.cards[h.cid]; if (!isSpell(c)) { out.why = 'kein Zauber oder Fluch'; return out; }
    out.cost = c.energy;
    if (!c.playable) { out.why = 'nicht spielbar: ' + c.notPlayable.join(' '); return out; }
    if (s.result || s.pendingDiscard !== null) { out.why = 'jetzt nicht möglich'; return out; }
    const sp = c.spell, timing = sp.timing || 'both', needsCounter = sp.effects.some(e => e.trigger === 'enemyAttack');
    const inBattle = s.phase === 'battle' && p === s.active, inCounter = s.phase === 'counter' && p === s.counter;
    if (!inBattle && !inCounter) { out.why = 'nur in der eigenen Battlephase oder eigenen Konterphase'; return out; }
    if (inBattle && (timing === 'counter' || needsCounter)) { out.why = 'nur in deiner Konterphase spielbar'; return out; }
    if (inCounter && timing === 'battle') { out.why = 'nur in deiner Battlephase spielbar'; return out; }
    if (c.energy > P.energy) { out.why = 'zu wenig Energie (' + P.energy + ' von ' + c.energy + ')'; return out; }
    s.casting = iid; const reqOk = evalCond(s, p, sp.require); delete s.casting;
    if (!reqOk) { out.why = 'Voraussetzung nicht erfüllt: ' + (EF ? EF.condText(sp.require, DATA()) : ''); return out; }
    const cost = sp.cost || {}, hpCost = Math.max(0, +cost.hp || 0), dcCost = Math.max(0, +cost.discard || 0);
    if (hpCost && kingOf(s, p).hp <= hpCost) { out.why = 'dein König hat nicht mehr als ' + hpCost.toLocaleString('de-DE') + ' HP, um die Kosten zu bezahlen'; return out; }
    if (dcCost && P.hand.length - 1 < dcCost) { out.why = 'zu wenige weitere Handkarten zum Abwerfen (' + (P.hand.length - 1) + ' von ' + dcCost + ')'; return out; }
    out.hpCost = hpCost; out.discardCost = dcCost;
    let any = false;
    sp.effects.forEach((e, i) => {
      const cand = effectCandidates(s, p, e, h.cid), t = e.target || {};
      const o = { i, kind: e.kind, what: t.what, pick: playerPicks(t) ? 'player' : 'auto', max: maxOf(t), candidates: cand, text: EF ? EF.describeEffect(e, DATA()) : e.kind };
      if (e.kind === 'revive' && e.params.place === 'player') o.place = summonFields(p).filter(f => !unitAt(s, f) && !fieldLocked(s, f, true));
      if (cand.length && !(e.kind === 'revive' && o.place && !o.place.length)) any = true;
      out.effects.push(o);
    });
    if (!any) { out.why = 'kein gültiges Ziel'; return out; }
    out.ok = true; return out;
  }
  function castSpell(s, ev, p, a) {
    const o = castOptions(s, p, a.iid); if (!o.ok) return 'Diese Karte ist jetzt nicht ausspielbar: ' + o.why + '.';
    const P = s.players[p], i = P.hand.findIndex(h => h.iid === a.iid), h = P.hand[i], c = s.cards[h.cid];
    const choices = [], place = [];
    for (const eo of o.effects) {
      const want = ((a.choices || [])[eo.i] || []).map(String);
      if (eo.pick === 'player') {
        const ids = new Set(eo.candidates.map(x => x.id)), need = Math.min(eo.max, eo.candidates.length);
        if (want.some(x => !ids.has(x)) || new Set(want).size !== want.length) return 'Effekt ' + (eo.i + 1) + ': ungültiges Ziel.';
        if (want.length !== need) return 'Effekt ' + (eo.i + 1) + ': bitte ' + need + (need === 1 ? ' Ziel' : ' Ziele') + ' wählen.';
        choices[eo.i] = want;
      } else choices[eo.i] = [];
      if (eo.place) { const pl = ((a.place || [])[eo.i] || []).map(String); if (pl.some(f => !eo.place.includes(f))) return 'Effekt ' + (eo.i + 1) + ': dieses Feld ist kein freies Beschwörungsfeld.'; place[eo.i] = pl; }
    }
    P.hand.splice(i, 1); P.energy -= c.energy;
    // Zusätzliche Kosten werden sofort bezahlt (auch wenn die Karte später neutralisiert wird)
    if (o.hpCost) { const k = kingOf(s, p); k.hp -= o.hpCost; ev.push({ t: 'kingDamage', uid: k.uid, dmg: o.hpCost, hp: k.hp, cause: 'cost' }); log(s, P.name + 's König opfert ' + o.hpCost.toLocaleString('de-DE') + ' HP für „' + c.name + '“ (jetzt ' + k.hp.toLocaleString('de-DE') + ').', p); }
    for (let k = 0; k < (o.discardCost || 0) && P.hand.length; k++) { const [d] = P.hand.splice(Math.floor(rand(s) * P.hand.length), 1); P.discard.push(d); ev.push({ t: 'discard', p, iid: d.iid, cid: d.cid, cost: true }); log(s, P.name + ' wirft „' + s.cards[d.cid].name + '“ als Kosten für „' + c.name + '“ ab.', p); }
    const entry = { sid: 'z' + (s.nextId++), p, cid: h.cid, iid: h.iid, phase: s.phase, choices, place };
    // Kontrolle in der eigenen Battlephase wird vorgezogen: sofort auswerten, damit der Held noch angreifen kann
    const now = p === s.active && s.phase === 'battle' && c.spell.effects.some(e => e.kind === 'control');
    if (!now) s.stack.push(entry);
    ev.push({ t: 'cast', p, sid: entry.sid, cid: h.cid, iid: h.iid, cost: c.energy, now });
    const lbl = eo => (eo.candidates || []).filter(x => choices[eo.i].includes(x.id)).map(x => x.label).join(', ');
    const tg = o.effects.filter(eo => eo.pick === 'player' && choices[eo.i].length).map(lbl).filter(Boolean).join('; ');
    log(s, P.name + ' spielt ' + (c.type === 'curse' ? 'den Fluch' : 'den Zauber') + ' „' + c.name + '“ (' + c.energy + ' Energie)' + (tg ? ' auf ' + tg : '') + (now ? '. Kontrolle wirkt sofort – der Held kann noch in dieser Battlephase angreifen.' : '. Auswertung nach der Konterphase.'), p);
    if (now) { const keep = s.stack; s.stack = [entry]; resolveSpells(s, ev); s.stack = keep; }
    return null;
  }
  function resolveSpells(s, ev) {
    const stack = s.stack || []; if (!stack.length) return;
    ev.push({ t: 'spellsResolve', sids: stack.map(x => x.sid) });
    const canceled = new Set();
    // 1. Neutralisierungen
    for (const en of stack) {
      if (canceled.has(en.sid)) continue;
      s.cards[en.cid].spell.effects.forEach((e, i) => {
        if (e.kind !== 'neutralize') return;
        const t = (en.choices[i] || [])[0] || (stack.find(x => x.p !== en.p && !canceled.has(x.sid) && x.sid !== en.sid) || {}).sid;
        const tgt = stack.find(x => x.sid === t);
        if (!tgt || canceled.has(t) || tgt.p === en.p) { log(s, '„' + s.cards[en.cid].name + '“: nichts zu neutralisieren.', en.p); return; }
        canceled.add(t); ev.push({ t: 'neutralized', sid: t, by: en.sid });
        log(s, '„' + s.cards[en.cid].name + '“ neutralisiert „' + s.cards[tgt.cid].name + '“. Beide Karten sind verbraucht.', en.p);
      });
    }
    // 2. Übrige Karten in Ausspielreihenfolge
    for (const en of stack) {
      const c = s.cards[en.cid], attachTo = [];
      if (!canceled.has(en.sid)) {
        log(s, 'Auswertung: „' + c.name + '“ von ' + s.players[en.p].name + '.', en.p);
        c.spell.effects.forEach((e, i) => { if (e.kind !== 'neutralize') resolveEffect(s, ev, en, c, e, i, attachTo); });
      }
      if (attachTo.length) { for (const uid of attachTo) { const u = s.units[uid]; if (u) u.attached.push({ cid: en.cid, owner: en.p }); } }
      else s.players[en.p].discard.push({ iid: en.iid, cid: en.cid });
      ev.push({ t: 'spellDone', sid: en.sid, canceled: canceled.has(en.sid) });
      if (s.result || checkEnd(s, ev)) break;
    }
    s.stack = [];
    checkWhile(s, ev);
  }
  function pickTargets(s, en, e, i) {
    const cand = effectCandidates(s, en.p, e, en.cid), t = e.target || {}, ids = cand.map(x => x.id);
    if (playerPicks(t)) { const chosen = (en.choices[i] || []).filter(x => ids.includes(x)); if (chosen.length < (en.choices[i] || []).length) log(s, '„' + s.cards[en.cid].name + '“: ein gewähltes Ziel ist nicht mehr gültig, die Wirkung darauf verpufft.', en.p); return chosen; }
    if (t.count === 'all') return ids;
    const pool = ids.slice(), out = [], n = Math.min(maxOf(t), pool.length);
    for (let k = 0; k < n; k++) out.push(pool.splice(Math.floor(rand(s) * pool.length), 1)[0]);
    return out;
  }
  function resolveEffect(s, ev, en, c, e, i, attachTo) {
    const t = e.target || {}, P = e.params || {}, K = c.name, neg = isNegative(e.kind, e, c.type), dur = durFields(s, en, e.duration, e);
    const lasting = ['stat', 'moveBlock', 'giftBlock', 'protect', 'deathWard'].includes(e.kind);
    // Flächeneffekt: „alle“ mit Dauer → wirkt dynamisch auf alle passenden Einheiten
    if (lasting && t.count === 'all' && (t.what === 'unit' || t.what === 'king')) {
      const a = Object.assign({ id: 'a' + (s.nextId++), ord: s.nextId, cid: en.cid, src: c.type, by: en.p, kind: e.kind, what: t.what, side: t.side, filter: t.filter, negative: neg, stat: P.stat, mode: P.mode, amount: P.amount, gifts: P.gifts, uses: +P.uses || 0, from: e.kind === 'protect' ? (P.from || 'attacks') : undefined, exempt: [] }, dur);
      if (e.trigger === 'enemyAttack') { a.filter = { op: 'and', items: [t.filter || { op: 'and', items: [] }, { k: 'attacked' }] }; a.side = 'own'; }
      s.auras.push(a); ev.push({ t: 'aura', id: a.id, cid: en.cid });
      log(s, K + ': ' + (EF ? EF.describeEffect(e, DATA()) : e.kind));
      return;
    }
    const targets = pickTargets(s, en, e, i);
    if (!targets.length) { log(s, K + ': kein gültiges Ziel – Effekt ' + (i + 1) + ' verpufft.', en.p); return; }
    if (e.kind === 'fieldLock') {
      const l = Object.assign({ id: 'l' + (s.nextId++), cid: en.cid, by: en.p, fields: targets, noSummon: !!P.noSummon }, dur);
      s.locks.push(l); ev.push({ t: 'lock', id: l.id, fields: targets });
      log(s, K + ': Felder ' + targets.join(', ') + ' sind gesperrt' + (l.noSummon ? ' (auch für Beschwörungen)' : '') + '.'); return;
    }
    if (e.kind === 'revive') {
      const pl = (en.place[i] || []).slice();
      for (const id of targets) {
        const [q, diid] = [+id.split(':')[0], id.slice(id.indexOf(':') + 1)], pile = s.players[q].discard, k = pile.findIndex(d => d.iid === diid);
        if (k < 0) continue;
        const free = summonFields(en.p).filter(f => !unitAt(s, f) && !fieldLocked(s, f, true));
        let f = pl.shift(); if (!f || !free.includes(f)) f = free[0];
        if (!f) { log(s, K + ': kein freies Beschwörungsfeld – „' + s.cards[pile[k].cid].name + '“ bleibt im Ablagestapel.', en.p); continue; }
        const [d] = pile.splice(k, 1), u = makeUnit(s, d.cid, en.p, f);
        if (q !== en.p) u.origOwner = q;
        if (P.lock === false) u.summonTurn = -1;
        ev.push({ t: 'summon', p: en.p, uid: u.uid, cid: d.cid, field: f, cost: 0, revive: true });
        log(s, K + ': „' + s.cards[d.cid].name + '“ kehrt ' + (q !== en.p ? 'unter der Kontrolle von ' + s.players[en.p].name + ' ' : '') + 'auf ' + f + ' zurück' + (P.lock === false ? ' (ohne Beschwörungssperre)' : '') + '.', en.p);
      }
      return;
    }
    if (e.kind === 'heal') {
      for (const uid of targets) { const k = s.units[uid]; if (!k) continue; const before = k.hp, cap = P.cap === 'none' ? Infinity : card(s, k).hp; k.hp = Math.max(k.hp, Math.min(cap, k.hp + Math.max(0, +P.amount || 0))); ev.push({ t: 'kingHeal', uid, hp: k.hp, amount: k.hp - before }); log(s, K + ': ' + card(s, k).name + ' erhält ' + (k.hp - before).toLocaleString('de-DE') + ' HP (jetzt ' + k.hp.toLocaleString('de-DE') + ')' + (k.hp - before < +P.amount && P.cap !== 'none' ? ', begrenzt auf die Start-HP' : '') + '.', en.p); }
      return;
    }
    if (e.kind === 'damage') {
      let dmg = Math.max(0, +P.amount || 0);
      if (P.per && P.per !== 'fixed') {
        let n = 0;
        for (const q of [0, 1]) {
          if (!sideOk(P.from || 'own', q, en.p)) continue;
          if (P.per === 'discard') n += s.players[q].discard.filter(d => s.cards[d.cid] && matchFilter(s, s.cards[d.cid], P.count)).length;
          else if (P.per === 'hand') n += s.players[q].hand.filter(h => s.cards[h.cid] && matchFilter(s, s.cards[h.cid], P.count)).length;
          else { const kingWanted = ((P.count && P.count.items) || []).some(it => it.k === 'unitType' && it.v === 'king'); n += Object.values(s.units).filter(u => u.owner === q && (kingWanted || !u.king) && matchFilter(s, card(s, u), P.count, u.uid)).length; }
        }
        dmg = dmg * n; if (+P.max > 0) dmg = Math.min(dmg, +P.max);
        log(s, K + ': ' + n + (n === 1 ? ' passende Karte' : ' passende Karten') + ' gezählt.', en.p);
      }
      for (const uid of targets) { const k = s.units[uid]; if (!k || !k.king) continue; k.hp -= dmg; ev.push({ t: 'kingDamage', uid, dmg, hp: k.hp, cause: 'spell' }); log(s, K + ': ' + card(s, k).name + ' verliert ' + dmg.toLocaleString('de-DE') + ' HP (jetzt ' + k.hp.toLocaleString('de-DE') + ').', en.p); }
      return;
    }
    if (e.kind === 'discard' || e.kind === 'mill') {
      for (const id of targets) {
        const q = +String(id).slice(1), Q = s.players[q], n = Math.max(1, Math.min(10, +P.n || 1)); let got = 0;
        for (let k = 0; k < n; k++) {
          if (e.kind === 'discard') { if (!Q.hand.length) break; const [h] = Q.hand.splice(Math.floor(rand(s) * Q.hand.length), 1); Q.discard.push(h); ev.push({ t: 'discard', p: q, iid: h.iid, cid: h.cid, spell: true }); }
          else { if (!Q.deck.length) break; const c = Q.deck.shift(); Q.discard.push(c); ev.push({ t: 'mill', p: q, cid: c.cid }); }
          got++;
        }
        log(s, K + ': ' + Q.name + (e.kind === 'discard' ? ' legt ' + (got === 1 ? 'eine Handkarte' : got + ' Handkarten') + ' ab' : ' verliert ' + (got === 1 ? 'die oberste Karte' : 'die obersten ' + got + ' Karten') + ' des Nachziehstapels') + (got < n ? ' (mehr gab es nicht)' : '') + '.', en.p);
      }
      if (s.pendingDiscard !== null && s.players[s.pendingDiscard].hand.length <= RULES.handMax) s.pendingDiscard = null;
      return;
    }
    if (e.kind === 'draw') {
      for (const id of targets) {
        const q = +String(id).slice(1), Q = s.players[q], n = Math.max(1, Math.min(10, +P.n || 1)); let got = 0;
        for (let k = 0; k < n; k++) { if (!Q.deck.length) break; const c = Q.deck.shift(); Q.hand.push(c); ev.push({ t: 'draw', p: q, iid: c.iid, cid: c.cid, spell: true }); got++; }
        log(s, K + ': ' + Q.name + ' zieht ' + (got === 1 ? 'eine Karte' : got + ' Karten') + (got < n ? ' (Nachziehstapel leer, keine Strafe)' : '') + '.', en.p);
        if (Q.hand.length > RULES.handMax && s.pendingDiscard === null) { s.pendingDiscard = q; ev.push({ t: 'mustDiscard', p: q }); log(s, Q.name + ' hat ' + Q.hand.length + ' Handkarten und muss auf ' + RULES.handMax + ' ablegen.', q); }
      }
      return;
    }
    if (e.kind === 'destroy') {
      if (c.type === 'curse') for (const uid of targets) { const u = s.units[uid]; if (u && u.owner !== en.p && curseShield(s, u)) { ev.push({ t: 'blocked', uid, id: en.cid }); log(s, card(s, u).name + ' ist vor Flüchen geschützt – „' + K + '“ zerstört ihn nicht.', en.p); } }
      const list = targets.filter(uid => s.units[uid] && !s.units[uid].king && !(c.type === 'curse' && s.units[uid].owner !== en.p && curseShield(s, s.units[uid]))), names = Object.fromEntries(list.map(uid => [uid, card(s, s.units[uid]).name]));
      kill(s, list, ev, 'destroy');
      for (const uid of list) if (!s.units[uid]) log(s, K + ': ' + names[uid] + ' wird zerstört.', en.p);
      return;
    }
    for (const uid of targets) {
      const u = s.units[uid]; if (!u) continue; const nm = card(s, u).name;
      if (neg && hasRaw(s, u, 'goettlicher_segen')) { ev.push({ t: 'blocked', uid, id: en.cid }); log(s, nm + ': Göttlicher Segen wehrt „' + K + '“ ab.', en.p); continue; }
      if (c.type === 'curse' && u.owner !== en.p && curseShield(s, u)) { ev.push({ t: 'blocked', uid, id: en.cid }); log(s, nm + ' ist vor Flüchen geschützt – „' + K + '“ wirkt nicht.', en.p); continue; }
      if (e.kind === 'status') {
        if (P.status !== 'poison' || u.king) continue;
        if (u.poison) { log(s, nm + ' ist bereits vergiftet – Poison wird nicht erneuert.', en.p); continue; }
        u.poison = { by: en.p }; ev.push({ t: 'poisoned', uid, by: en.p }); log(s, K + ': ' + nm + ' ist vergiftet und stirbt zu Beginn des nächsten Zuges von ' + s.players[en.p].name + '.', en.p); continue;
      }
      if (dur.permanent && u.attached.some(x => x.cid === en.cid) && !attachTo.includes(uid)) { log(s, nm + ' trägt „' + K + '“ schon – zwei identische permanente Karten sind nicht erlaubt (Abschnitt 8).', en.p); continue; }
      const fx = Object.assign({ id: 'f' + (s.nextId++), ord: s.nextId, cid: en.cid, src: c.type, kind: e.kind, negative: neg }, dur);
      if (e.kind === 'stat') Object.assign(fx, { stat: P.stat, mode: P.mode || 'add', amount: +P.amount || 0 });
      if (e.kind === 'giftBlock' || e.kind === 'giftRemove') fx.gifts = P.gifts === 'all' ? 'all' : (P.gifts || []).slice();
      if (e.kind === 'giftRemove') { delete fx.endTurn; delete fx.until; delete fx.whileCond; fx.permanent = true; }
      if (e.kind === 'deathWard') { fx.uses = +P.uses || 0; fx.used = 0; }
      if (e.kind === 'protect') fx.from = P.from || 'attacks';
      if (e.kind === 'control') {
        if (u.king) continue;
        if (u.owner === en.p && !u.fx.some(x => x.kind === 'control')) { log(s, K + ': ' + nm + ' gehört schon ' + s.players[en.p].name + '.', en.p); continue; }
        fx.to = en.p;
        // „für N Runden“ heißt hier: bis zum Ende des N-ten nächsten eigenen Zuges, damit der Held auch eingesetzt werden kann
        if (fx.until) { fx.untilEnd = fx.until; delete fx.until; }
        if (u.baseOwner === undefined) u.baseOwner = u.owner;
      }
      u.fx.push(fx);
      if (e.kind === 'control') { setOwner(s, ev, u, en.p); } ev.push({ t: 'spellFx', uid, cid: en.cid, kind: e.kind });
      if (fx.permanent && !attachTo.includes(uid)) attachTo.push(uid);
      log(s, K + ' → ' + nm + ': ' + fxText(s, fx) + '.', en.p);
    }
  }
  // Kontrolle: Besitzer = Ziel der jüngsten Kontrollwirkung, sonst der ursprüngliche
  function setOwner(s, ev, u, q) {
    if (u.owner === q) return;
    const from = u.owner; u.owner = q; delete s.decl[u.uid]; s.retreat = s.retreat.filter(x => x !== u.uid);
    if (u.origOwner === undefined && u.baseOwner !== undefined) u.origOwner = u.baseOwner;
    if (u.origOwner === q && u.baseOwner === q) delete u.origOwner;
    ev.push({ t: 'control', uid: u.uid, from, to: q });
    log(s, card(s, u).name + ' steht jetzt unter der Kontrolle von ' + s.players[q].name + '.', q);
    dropInvalid(s, ev);
  }
  function syncControl(s, ev) {
    for (const u of Object.values(s.units)) {
      if (u.baseOwner === undefined) continue;
      const c = u.fx.filter(e => e.kind === 'control'), want = c.length ? c[c.length - 1].to : u.baseOwner;
      setOwner(s, ev, u, want);
      if (!c.length) delete u.baseOwner;
    }
  }
  // Angebrachte Karten ohne verbleibende Wirkung gehen auf den Ablagestapel ihres Besitzers
  function detachUnused(s, u) { u.attached = (u.attached || []).filter(at => { if (u.fx.some(e => e.cid === at.cid)) return true; s.players[at.owner].discard.push({ iid: 'd' + u.uid + '_' + at.cid, cid: at.cid }); return false; }); }
  // Kurzbeschreibung einer laufenden Wirkung (für Log und Anzeige)
  function fxText(s, e) {
    const st = { atk: 'ATK', def: 'DEF', move: 'Schritte' }[e.stat] || e.stat;
    const dur = e.endTurn ? ' bis Zugende' : e.untilEnd ? ' bis zum Ende des ' + e.untilEnd.turn + '. Zuges von ' + s.players[e.untilEnd.p].name : e.until ? ' bis zum ' + e.until.turn + '. Zug von ' + s.players[e.until.p].name : e.permanent ? ' permanent' : e.whileCond ? ' solange die Bedingung gilt' : '';
    const gn = g => g === 'all' ? 'alle Gaben' : (g || []).map(id => (GIFTS[id] || ROYAL[id] || { name: id }).name).join(', ');
    switch (e.kind) {
      case 'stat': return (e.mode === 'set' ? st + ' = ' + e.amount : (e.amount >= 0 ? '+' : '−') + Math.abs(e.amount) + ' ' + st) + dur;
      case 'moveBlock': return 'kann nicht laufen' + dur;
      case 'giftBlock': return gn(e.gifts) + ' blockiert' + dur;
      case 'giftRemove': return gn(e.gifts) + ' entfernt';
      case 'protect': return ({ curses: 'gegnerische Flüche wirken nicht', both: 'Angriffe wirkungslos, gegnerische Flüche wirken nicht' }[e.from] || 'Angriffe gegen die Einheit wirkungslos') + dur;
      case 'control': return 'unter der Kontrolle von ' + s.players[e.to].name + dur;
      case 'deathWard': return 'vor Zerstörung bewahrt' + (e.uses ? ' (' + Math.max(0, e.uses - (e.used || 0)) + '× übrig)' : '') + dur;
    }
    if (e.id === 'fesseln') return 'gefesselt' + dur;
    if (e.stat) return (e.amount >= 0 ? '+' : '−') + Math.abs(e.amount) + ' ' + st + dur;
    return e.id + dur;
  }
  // Alle Wirkungen auf einer Einheit, für die Anzeige
  function effectsOn(s, u) {
    const own = u.fx.map(e => ({ src: e.src || 'gift', cid: e.cid || null, name: e.cid ? s.cards[e.cid].name : (GIFTS[e.id] || { name: e.id }).name, text: fxText(s, e), negative: !!e.negative }));
    const ar = auraOn(s, u).map(a => ({ src: a.src, cid: a.cid, name: s.cards[a.cid].name, text: fxText(s, a) + ' (Flächeneffekt)', negative: !!a.negative, area: true }));
    return own.concat(ar);
  }

  /* ---------------- Sicht für einen Spieler (verdeckte Informationen) ---------------- */
  function viewFor(s, p) {
    const v = clone(s); delete v.rng;
    v.players.forEach((P, i) => { P.deckCount = P.deck.length; P.deck = []; if (i !== p) { P.handCount = P.hand.length; P.hand = []; } });
    return v;
  }

  const api = { VERSION, FIELDS, COLS, ROW_COLS, KING_FIELD, GUARD, SUMMON_ROW, DIRS, GIFTS, ROYAL, COPY_LIMIT, RULES, ASSUMPTIONS, PHASES, PHASE_NAME,
    exists, step, colOf, rowOf, summonFields, isGuard, normalizeCard, validateDeck, newGame, apply, viewFor, clone,
    unitAt, kingOf, cost, atkOf, defOf, stepsOf, locked, bound, immobile, has, hasRaw, reachable, targetsOf, attackTargets, canAttack, preview, summonOptions, giftOptions, royalBonus, matches,
    EF, SPELL_OPEN, upgrade, isSpell, castOptions, effectCandidates, evalCond, fieldLocked, isProtected, effectsOn, fxText, auraOn, giftBlocked, counterPlayable, halfFields };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WOK = api;
})(typeof window !== 'undefined' ? window : globalThis);
