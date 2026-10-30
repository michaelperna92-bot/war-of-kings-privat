/* War of Kings – gemeinsames Effektformat für Zauber- und Fluchkarten (Kartenwerkstatt und Probe-Spiel).
 * Eine Datei für beide Anwendungen: Das Probe-Spiel übernimmt sie beim Bauen unverändert.
 * Die strukturierten Effekte sind verbindlich für die Ausführung; der Regeltext ist frei, wird aber abgeglichen.
 * Regelgrundlage: Master-Regelwerk 29.10.2026, Abschnitte 8, 9, 11, 13 und 15. Offene Fragen werden markiert, nicht entschieden.
 */
(function (root) {
  'use strict';
  const FORMAT = 'wok-zauber', VERSION = 1;

  // Effektarten. side: wofür gedacht; targets: erlaubte Zielarten; lasting: braucht eine Dauer; defined: Regelgrundlage vorhanden
  const KINDS = {
    destroy: { name: 'Zerstören', for: ['curse', 'spell'], targets: ['unit'], lasting: false, defined: true, help: 'Die Ziele werden zerstört und kommen auf den Ablagestapel ihres Besitzers. Könige können nicht zerstört werden (sie verlieren nur über HP).' },
    status: { name: 'Zustand verursachen', for: ['curse'], targets: ['unit'], lasting: false, defined: true, help: 'Legt einen im Regelwerk vorhandenen Zustand an. Es gelten die Regeln des Zustands, nicht die Dauer dieser Karte.' },
    moveBlock: { name: 'Bewegung sperren', for: ['curse'], targets: ['unit'], lasting: true, defined: true, help: 'Frei eingestellte Bewegungssperre: Das Ziel kann für die Dauer nicht laufen (auch nicht per Blitzschritt, Rückzug oder Tausch). Angriffe und Gaben bleiben erlaubt.' },
    stat: { name: 'Wert verändern', for: ['curse', 'spell'], targets: ['unit', 'king'], lasting: true, defined: true, help: 'ATK oder DEF um einen Betrag ändern oder auf einen Betrag setzen; Bewegung (Schritte) ebenso. Könige besitzen nur ATK (und HP).' },
    giftBlock: { name: 'Gaben blockieren', for: ['curse'], targets: ['unit', 'king'], lasting: true, defined: true, help: 'Die gewählten Gaben wirken für die Dauer nicht: aktivierbare sind nicht einsetzbar, permanente und königliche haben keine Wirkung.' },
    giftRemove: { name: 'Gaben entfernen', for: ['curse'], targets: ['unit', 'king'], lasting: false, defined: true, help: 'Hebt die gewählten Gaben der Karte dauerhaft auf (Abschnitt 13: Aufhebung durch einen dafür geeigneten Effekt). Endet, wenn die Karte das Spielfeld verlässt.' },
    fieldLock: { name: 'Felder sperren', for: ['curse'], targets: ['field'], lasting: true, defined: true, help: 'Gesperrte Felder dürfen nicht betreten werden; wer schon darauf steht, bleibt stehen.' },
    revive: { name: 'Wiederbeleben', for: ['spell'], targets: ['discard'], lasting: false, defined: true, help: 'Holt einen Helden aus einem Ablagestapel zurück und beschwört ihn auf einem freien Beschwörungsfeld des Wirkenden, unter dessen Kontrolle.' },
    protect: { name: 'Schützen (Angriffe / Flüche)', for: ['spell'], targets: ['unit'], lasting: true, defined: true, help: 'Solange der Zauber wirkt: Angriffe gegen das Ziel sind wirkungslos (kein Vergleich, niemand fällt durch diese Angriffe) und/oder gegnerische Flüche wirken nicht auf das Ziel – je nach Einstellung „Schützt vor“.' },
    deathWard: { name: 'Vor Zerstörung bewahren', for: ['spell'], targets: ['unit'], lasting: true, defined: true, help: 'Würde das Ziel zerstört (Kampf, Poison, Fluch), bleibt es stattdessen im Spiel. Wie oft das greift, stellst du ein.' },
    heal: { name: 'König heilen', for: ['spell'], targets: ['king'], lasting: false, defined: true, help: 'Stellt HP des Königs wieder her. Die Grenze stellst du ein.' },
    maxHp: { name: 'Maximale HP erhöhen', for: ['spell'], targets: ['king'], lasting: true, defined: false, open: 'Maximale HP sind im Regelwerk nicht vorgesehen. Bitte im Regelwerk festlegen, bevor diese Wirkung spielbar wird.' },
    tempHp: { name: 'Vorübergehender HP-Bonus', for: ['spell'], targets: ['king'], lasting: true, defined: false, open: 'Ein vorübergehender HP-Bonus ist im Regelwerk nicht vorgesehen (Was passiert mit Schaden, wenn er abläuft?).' },
    damage: { name: 'Schaden am König', for: ['curse', 'spell'], targets: ['king'], lasting: false, defined: true, help: 'Der König verliert HP: ein fester Betrag oder ein Betrag je passender Karte (z. B. je Untoter im Ablagestapel). Helden haben keine HP und können daher keinen Schaden nehmen.' },
    draw: { name: 'Karten ziehen', for: ['spell', 'curse'], targets: ['player'], lasting: false, defined: true, help: 'Der Spieler zieht die eingestellte Anzahl Karten vom Nachziehstapel. Mehr als 10 Handkarten: überzählige werden abgelegt (Handlimit).' },
    control: { name: 'Kontrolle übernehmen', for: ['curse', 'spell'], targets: ['unit'], lasting: true, defined: true, help: 'Der Wirkende übernimmt den Helden für die Dauer: Er gehört dann zu seiner Seite und kann sofort laufen, angreifen und Gaben nutzen. Beschwörungssperre, Fesseln und Bewegungssperren auf ihm werden umgangen, solange er übernommen ist. Läuft die Wirkung ab, kehrt er zurück. Stirbt er vorher, kommt er auf den Ablagestapel seines Besitzers. Göttlicher Segen schützt davor, Könige nie. In deiner Battlephase gewirkt, wirkt die Karte sofort – noch vor den Angriffen: Der Held greift in derselben Battlephase mit an, danach kommt die Konterphase des Gegners (er kann darauf reagieren) und dann die Schadensberechnung. Dauer „bis Zugende“ = nur dieser Angriff; „N Runden“ = zusätzlich laufen und angreifen in deinen nächsten Zügen – dazwischen kann der Gegner ihn angreifen und zerstören. In der Konterphase auf einen Angreifer gewirkt, fällt dessen Angriff weg.' },
    discard: { name: 'Handkarten abwerfen', for: ['curse'], targets: ['player'], lasting: false, defined: true, help: 'Der Spieler legt zufällig gewählte Handkarten auf seinen Ablagestapel.' },
    mill: { name: 'Nachziehstapel abtragen', for: ['curse'], targets: ['player'], lasting: false, defined: true, help: 'Die obersten Karten des Nachziehstapels kommen ungesehen auf den Ablagestapel. (Leerer Stapel: Zugbeginn-Regel mit 1.000 HP Verlust gilt weiter.)' },
    neutralize: { name: 'Zauber/Fluch neutralisieren', for: ['spell', 'curse'], targets: ['card'], lasting: false, defined: true, help: 'Hebt einen in dieser Battlephase gespielten gegnerischen Zauber oder Fluch auf (Abschnitt 8). Beide Karten sind verbraucht, die Energie bleibt bezahlt.' }
  };
  const STATUSES = {
    poison: { name: 'Poison', defined: true, help: 'Wie im Regelwerk (Abschnitt 11): stirbt zu Beginn des nächsten eigenen Zuges des Wirkenden, nicht stapelbar, Heilung entfernt, Göttlicher Segen wehrt ab, nie Könige.' },
    freeze: { name: 'Einfrieren (Freeze)', defined: false, open: 'Einfrieren ist im Regelwerk nur als Begriff genannt (Göttlicher Segen wehrt es ab). Wirkung und Dauer sind nicht festgelegt. Für eine frei eingestellte Bewegungssperre „Bewegung sperren“ wählen.' }
  };
  const STATS = { atk: 'ATK', def: 'DEF', move: 'Bewegung (Schritte)' };
  const DURATIONS = { instant: 'Sofort, einmalig', turn: 'Bis zum Ende des Zuges', rounds: 'Für eine Anzahl Runden', permanent: 'Permanent', while: 'Solange eine Bedingung erfüllt ist' };
  const TRIGGERS = { play: 'Beim Ausspielen (Auswertung nach der Konterphase)', enemyAttack: 'Bei einem gegnerischen Angriff (nur in der eigenen Konterphase, Ziele: angegriffene eigene Helden)', destruction: 'Bei drohender Zerstörung (greift, wenn das Ziel zerstört würde)' };
  const TIMINGS = { both: 'Eigene Battlephase oder eigene Konterphase', battle: 'Nur in der eigenen Battlephase', counter: 'Nur in der eigenen Konterphase' };
  const SIDES = { own: 'eigene', enemy: 'gegnerische', both: 'eigene oder gegnerische' };
  const COND_KINDS = {
    control: 'Ich kontrolliere mindestens … passende Helden',
    enemyControl: 'Der Gegner kontrolliert mindestens … passende Helden',
    onField: 'Eine bestimmte Karte ist auf meinem Feld',
    discard: 'In einem Ablagestapel liegen mindestens … passende Helden',
    kingHp: 'HP eines Königs',
    attacked: 'Mindestens … eigene Helden werden gerade angegriffen',
    fieldAny: 'Auf dem ganzen Spielfeld stehen mindestens … passende Helden (eigene und gegnerische)',
    hand: 'Ich habe mindestens … Handkarten'
  };
  const FILTER_KINDS = { race: 'Rasse', class: 'Klasse', element: 'Element', unitType: 'Kartenart', attacked: 'wird gerade angegriffen' };

  const uid = () => 'e' + Math.random().toString(36).slice(2, 9);
  const clone = o => JSON.parse(JSON.stringify(o));
  function blankEffect(kind, cardType) {
    kind = kind || (cardType === 'curse' ? 'stat' : 'stat');
    const e = { id: uid(), kind, target: { what: (KINDS[kind] || KINDS.stat).targets[0], side: cardType === 'curse' ? 'enemy' : 'own', count: 'one', n: 1, pick: 'player', filter: { op: 'and', items: [] } }, params: {}, duration: { kind: (KINDS[kind] || {}).lasting ? 'rounds' : 'instant', n: 2 }, trigger: 'play' };
    if (kind === 'stat') e.params = { stat: 'atk', mode: 'add', amount: cardType === 'curse' ? -500 : 500 };
    if (kind === 'status') e.params = { status: 'poison' };
    if (kind === 'giftBlock' || kind === 'giftRemove') e.params = { gifts: [] };
    if (kind === 'fieldLock') { e.params = { noSummon: false }; e.target.side = 'both'; }
    if (kind === 'revive') { e.params = { from: 'own', place: 'player', lock: true }; e.target.side = 'own'; }
    if (kind === 'protect') { e.duration = { kind: 'rounds', n: 1 }; e.target.side = 'own'; e.params = { from: 'attacks' }; }
    if (kind === 'deathWard') { e.params = { uses: 1 }; e.duration = { kind: 'turn', n: 1 }; e.target.side = 'own'; e.trigger = 'destruction'; }
    if (kind === 'heal') { e.params = { amount: 1000, cap: 'start' }; e.target = { what: 'king', side: 'own', count: 'one', n: 1, pick: 'auto', filter: { op: 'and', items: [] } }; }
    if (kind === 'maxHp' || kind === 'tempHp') { e.params = { amount: 1000 }; e.target = { what: 'king', side: 'own', count: 'one', n: 1, pick: 'auto', filter: { op: 'and', items: [] } }; }
    if (kind === 'neutralize') { e.target = { what: 'card', side: 'enemy', count: 'one', n: 1, pick: 'player', filter: { op: 'and', items: [] } }; }
    if (kind === 'destroy') e.target.side = 'enemy';
    if (kind === 'damage') { e.target = { what: 'king', side: 'enemy', count: 'one', n: 1, pick: 'auto', filter: { op: 'and', items: [] } }; e.params = { amount: 500, per: 'fixed', from: 'own', count: { op: 'and', items: [] }, max: 0 }; }
    if (kind === 'control') { e.target.side = 'enemy'; e.params = {}; e.duration = { kind: 'rounds', n: 1 }; }
    if (kind === 'discard' || kind === 'mill') { e.target = { what: 'player', side: 'enemy', count: 'one', n: 1, pick: 'auto', filter: { op: 'and', items: [] } }; e.params = { n: kind === 'discard' ? 1 : 3 }; }
    if (kind === 'draw') { e.target = { what: 'player', side: 'own', count: 'one', n: 1, pick: 'auto', filter: { op: 'and', items: [] } }; e.params = { n: 2 }; }
    return e;
  }
  function blankSpell(cardType) { return { v: VERSION, timing: 'both', require: { op: 'and', items: [] }, effects: [blankEffect(cardType === 'curse' ? 'stat' : 'stat', cardType)], sync: '' }; }
  function normalizeSpell(sp, cardType) {
    const s = Object.assign(blankSpell(cardType), sp ? clone(sp) : {});
    if (!s.require || !Array.isArray(s.require.items)) s.require = { op: 'and', items: [] };
    s.cost = Object.assign({ hp: 0, discard: 0 }, s.cost || {});
    if (!Array.isArray(s.effects)) s.effects = [];
    s.effects = s.effects.map(e => Object.assign({ id: uid(), params: {}, duration: { kind: 'instant', n: 1 }, trigger: 'play' }, e, { target: Object.assign({ what: 'unit', side: 'enemy', count: 'one', n: 1, pick: 'player', filter: { op: 'and', items: [] } }, e.target || {}) }));
    for (const e of s.effects) if (!e.target.filter || !Array.isArray(e.target.filter.items)) e.target.filter = { op: 'and', items: [] };
    return s;
  }

  /* ---------- Text aus den Daten ---------- */
  function nameOf(D, list, id) { const L = D && D[list]; return ((L || []).find(x => x.id === id) || {}).name || id; }
  function filterText(f, D) {
    if (!f || !f.items || !f.items.length) return '';
    const part = it => it.items ? '(' + filterText(it, D) + ')' : it.k === 'race' ? nameOf(D, 'RACES', it.v) : it.k === 'class' ? nameOf(D, 'CLASSES', it.v) : it.k === 'element' ? nameOf(D, 'ELEMENTS', it.v) + '-Element' : it.k === 'unitType' ? (it.v === 'king' ? 'König' : 'Held') : it.k === 'attacked' ? 'gerade angegriffen' : it.k;
    return f.items.map(part).join(f.op === 'or' ? ' oder ' : ' und ');
  }
  // Fall: 'nom' (Subjekt), 'acc' (Objekt), 'dat' (nach „von“)
  function targetText(t, D, cas) {
    const nom = cas === true || cas === 'nom', dat = cas === 'dat';
    const fil = filterText(t.filter, D), words = [t.attackedTag ? 'angegriffene' : '', SIDES[t.side] || ''].filter(Boolean);
    const side = words.join(' '), sideN = words.map(w => w + 'n').join(' ');
    const pick = t.pick === 'auto' || t.count === 'all' ? '' : ' nach Wahl';
    const many = t.count !== 'one', cnt = t.count === 'all' ? (dat ? 'allen ' : 'alle ') : t.count === 'n' ? (t.n || 1) + ' ' : '';
    if (t.what === 'king') { const adj = t.side === 'enemy' ? 'gegnerische' : t.side === 'both' ? '' : 'eigene'; return nom ? (adj ? 'der ' + adj + ' König' : 'ein König') : dat ? (adj ? 'dem ' + adj + 'n König' : 'einem König') : (adj ? 'den ' + adj + 'n König' : 'einen König'); }
    if (t.what === 'field') return (many ? cnt + 'Felder' : 'ein Feld') + pick;
    if (t.what === 'discard') return (many ? cnt + 'Helden' : (nom ? 'ein Held' : 'einen Helden')) + (fil ? ' (' + fil + ')' : '') + ' aus dem ' + (t.side === 'enemy' ? 'gegnerischen' : t.side === 'both' ? 'eigenen oder gegnerischen' : 'eigenen') + ' Ablagestapel' + pick;
    if (t.what === 'player') return t.side === 'enemy' ? (nom ? 'dein Gegner' : 'deinen Gegner') : (nom ? 'du' : 'dich');
    if (t.what === 'card') return nom ? 'ein gegnerischer Zauber oder Fluch dieser Battlephase' : 'einen gegnerischen Zauber oder Fluch dieser Battlephase';
    // Ziel „unit“ = Held (Könige nur, wenn ausdrücklich „König“ gewählt ist). Starke Beugung von „Held“.
    const stems = t.side === 'both' ? ['eigen', 'gegnerisch'] : [t.side === 'enemy' ? 'gegnerisch' : 'eigen'];
    const adj = end => (t.attackedTag ? 'angegriffen' + end + ' ' : '') + stems.map(x => x + end).join(' oder ');
    let core;
    if (!many) core = nom ? 'ein ' + adj('er') + ' Held' : dat ? 'einem ' + adj('en') + ' Helden' : 'einen ' + adj('en') + ' Helden';
    else if (t.count === 'all') core = t.side === 'both' && !t.attackedTag ? (dat ? 'allen' : 'alle') + ' Helden auf dem Spielfeld (eigene und gegnerische)' : (dat ? 'allen ' : 'alle ') + adj('en') + ' Helden';
    else core = (t.n || 1) + ' ' + adj(dat ? 'en' : 'e') + ' Helden';
    return core + (fil ? ' (' + fil + ')' : '') + pick;
  }
  const cap = x => x ? x[0].toUpperCase() + x.slice(1) : '';
  /* Wann eine Dauerwirkung überhaupt zählt (Festlegung des Entwicklers vom 30.10.2026):
   *  'opp' = im Zug des Gegners: gegnerische ATK/Schritte senken, gegnerische Bewegung oder Gaben sperren, Felder sperren, eigene DEF erhöhen, eigene Helden schützen.
   *          „Runden“ zählen dann die Züge des Gegners; „bis Zugende“ ergibt nur in der Konterphase Sinn (sie liegt im Zug des Gegners).
   *  'own' = in deinen Zügen: eigene ATK/Schritte erhöhen, gegnerische DEF senken. „Runden“ zählen dann deine eigenen Züge.
   *  null  = gemischt oder ohne feste Seite (z. B. beide Seiten, Vor Zerstörung bewahren): Runden wie bisher. */
  function phaseOf(e) {
    const t = e.target || {}, p = e.params || {}, side = t.side || 'enemy', k = e.kind;
    if (side === 'both' && k !== 'fieldLock') return null;
    if (k === 'moveBlock' || k === 'giftBlock') return side === 'own' ? null : 'opp';
    if (k === 'fieldLock' || k === 'protect') return 'opp';
    if (k === 'stat') {
      if (t.what === 'king') return side === 'enemy' ? 'opp' : 'own';
      if (side === 'enemy') return p.stat === 'def' ? 'own' : 'opp';
      return p.stat === 'def' ? 'opp' : 'own';
    }
    return null;
  }
  function durText(d, D, e, timing) {
    if (!d) return '';
    const ph = e ? phaseOf(e) : null, n = Math.max(1, +d.n || 1);
    if (d.kind === 'turn') return timing === 'counter' && ph === 'opp' ? ' bis zum Ende dieses gegnerischen Zuges' : ' bis zum Ende dieses Zuges';
    if (d.kind === 'rounds') {
      if (ph === 'opp') { if (timing === 'counter') return n === 1 ? ' bis zum Ende dieses gegnerischen Zuges' : ' für diesen und ' + (n === 2 ? 'den nächsten Zug' : 'die nächsten ' + (n - 1) + ' Züge') + ' deines Gegners'; if (timing === 'battle') return ' für ' + (n === 1 ? 'den nächsten Zug' : 'die nächsten ' + n + ' Züge') + ' deines Gegners'; return ' für ' + (n === 1 ? 'einen Zug' : n + ' Züge') + ' deines Gegners'; }
      if (ph === 'own') return n === 1 ? ' bis zum Ende deines nächsten Zuges' : ' bis zum Ende deines ' + n + '. nächsten Zuges';
      return ' für ' + n + (n === 1 ? ' Runde' : ' Runden');
    }
    if (d.kind === 'permanent') return ' dauerhaft';
    if (d.kind === 'while') return ' solange gilt: ' + condText(d.cond, D);
    return '';
  }
  // Ungültige Dauer automatisch korrigieren: „bis Zugende“ bei Wirkungen im Gegnerzug → 1 Zug des Gegners (außer reine Konterphase)
  function needsOppFix(e, timing) { return !!(e && e.duration && e.duration.kind === 'turn' && phaseOf(e) === 'opp' && timing !== 'counter' && e.trigger !== 'enemyAttack'); }
  function autoFix(sp) { let n = 0; for (const e of (sp && sp.effects) || []) if (needsOppFix(e, sp.timing || 'both')) { e.duration = { kind: 'rounds', n: 1 }; n++; } return n; }
  function condText(c, D) {
    if (!c) return '–';
    if (c.items) return c.items.length ? c.items.map(x => x.items ? '(' + condText(x, D) + ')' : condText(x, D)).join(c.op === 'or' ? ' ODER ' : ' UND ') : 'keine';
    const fil = filterText(c.filter, D);
    switch (c.k) {
      case 'control': return 'du kontrollierst mindestens ' + (c.min || 1) + ' Held' + ((c.min || 1) > 1 ? 'en' : '') + (fil ? ' (' + fil + ')' : '');
      case 'enemyControl': return 'der Gegner kontrolliert mindestens ' + (c.min || 1) + ' Held' + ((c.min || 1) > 1 ? 'en' : '') + (fil ? ' (' + fil + ')' : '');
      case 'onField': return '„' + (c.cardName || c.card || '?') + '“ ist auf deinem Feld';
      case 'discard': return 'im ' + (c.side === 'enemy' ? 'gegnerischen' : 'eigenen') + ' Ablagestapel liegen mindestens ' + (c.min || 1) + ' Helden' + (fil ? ' (' + fil + ')' : '');
      case 'kingHp': return 'der ' + (c.side === 'enemy' ? 'gegnerische' : 'eigene') + ' König hat ' + (c.cmp === '>=' ? 'mindestens' : 'höchstens') + ' ' + (c.value || 0) + ' HP';
      case 'fieldAny': return 'auf dem Spielfeld stehen insgesamt mindestens ' + (c.min || 1) + ' Held' + ((c.min || 1) > 1 ? 'en' : '') + (fil ? ' (' + fil + ')' : '');
      case 'hand': return 'du hast mindestens ' + (c.min || 1) + ' weitere Handkarte' + ((c.min || 1) > 1 ? 'n' : '');
      case 'attacked': return 'mindestens ' + (c.min || 1) + ' eigene' + ((c.min || 1) > 1 ? ' Helden werden' : 'r Held wird') + ' gerade angegriffen';
    }
    return c.k || '?';
  }
  function giftNames(list, D) { const all = ((D && D.GIFTS) || []).concat((D && D.ROYAL_GIFTS) || []); return list === 'all' ? 'alle Gaben' : (list || []).length ? (list || []).map(id => (all.find(g => g.id === id) || {}).name || id).join(', ') : '(Gabe wählen)'; }
  function describeEffect(e, D, cardType, timing) {
    const K = KINDS[e.kind] || {}, lastingD = K.lasting && e.kind !== 'control' && e.kind !== 'giftRemove' && e.duration && e.duration.kind !== 'instant';
    if (lastingD) {
      // Dauerwirkungen immer klar: „Solange dieser Zauber wirkt (…): …“
      const inner = describeEffect(Object.assign({}, e, { duration: { kind: 'instant' } }), D, null, timing), wer = cardType === 'curse' ? 'dieser Fluch' : cardType === 'spell' ? 'dieser Zauber' : 'diese Karte';
      const dt = durText(e.duration, D, e, timing).trim();
      if (e.duration.kind === 'permanent') return 'Dauerhaft, solange ' + wer + ' am Ziel liegt: ' + inner;
      if (e.duration.kind === 'while') return 'Solange ' + wer + ' wirkt (' + dt + '): ' + inner;
      return 'Solange ' + wer + ' wirkt (' + dt + '): ' + inner;
    }
    const T = e.trigger === 'enemyAttack' && (e.target || {}).what === 'unit' ? Object.assign({}, e.target, { attackedTag: true }) : e.target || {}, t = targetText(T, D, 'acc'), tn = targetText(T, D, 'nom'), td = targetText(T, D, 'dat'), many = T.count !== 'one' && T.what !== 'king', d = durText(e.duration, D, e, timing), p = e.params || {};
    const v = (one, more) => many ? more : one;
    switch (e.kind) {
      case 'destroy': return 'Zerstöre ' + t + '.';
      case 'status': return cap(tn) + ' ' + v('wird', 'werden') + ' ' + (p.status === 'freeze' ? 'eingefroren' : 'vergiftet (Poison)') + '.';
      case 'moveBlock': return cap(tn) + ' ' + v('kann', 'können') + d + ' nicht laufen.';
      case 'stat': { const st = STATS[p.stat] || p.stat; if (p.mode === 'set') return st + ' von ' + td + ' wird' + d + ' auf ' + p.amount + ' gesetzt.'; return cap(tn) + ' ' + v('erhält', 'erhalten') + ' ' + ((+p.amount || 0) >= 0 ? '+' : '−') + Math.abs(+p.amount || 0) + ' ' + st + d + '.'; }
      case 'giftBlock': return cap(giftNames(p.gifts, D)) + ' von ' + td + ' ' + (p.gifts === 'all' || (p.gifts || []).length > 1 ? 'sind' : 'ist') + d + ' blockiert.';
      case 'giftRemove': return 'Entferne ' + giftNames(p.gifts, D) + ' von ' + td + '.';
      case 'fieldLock': return 'Sperre ' + t + d + (p.noSummon ? '; dort kann auch nicht beschworen werden' : '') + '.';
      case 'revive': return 'Belebe ' + t + ' wieder und beschwöre ' + v('ihn', 'sie') + ' unter deiner Kontrolle auf ' + (p.place === 'auto' ? 'einem freien' : 'einem frei wählbaren') + ' Beschwörungsfeld' + (p.lock === false ? ' (ohne Beschwörungssperre)' : '') + '.';
      case 'protect': { const f = p.from || 'attacks'; if (f === 'curses') return 'Gegnerische Flüche wirken' + d + ' nicht auf ' + t + '.'; if (f === 'both') return cap(tn) + ' ' + v('kann', 'können') + d + ' weder durch Angriffe noch durch gegnerische Flüche besiegt oder geschwächt werden (Angriffe gegen ' + v('ihn', 'sie') + ' sind wirkungslos, Flüche wirken nicht).'; return 'Angriffe gegen ' + t + ' sind' + d + ' wirkungslos.'; }
      case 'deathWard': return cap(tn) + ' ' + v('wird', 'werden') + d + ' vor Zerstörung bewahrt' + (p.uses ? ' (' + p.uses + '× je Held)' : '') + '.';
      case 'heal': return 'Heile ' + t + ' um ' + (p.amount || 0) + ' HP' + (p.cap === 'none' ? ' (ohne Obergrenze)' : ' (höchstens bis zu seinen Start-HP)') + '.';
      case 'maxHp': return 'Die maximalen HP ' + (T.side === 'enemy' ? 'des gegnerischen' : 'des eigenen') + ' Königs steigen um ' + (p.amount || 0) + d + '.';
      case 'tempHp': return cap(tn) + ' erhält ' + (p.amount || 0) + ' vorübergehende HP' + d + '.';
      case 'neutralize': return 'Neutralisiere ' + t + '.';
      case 'damage': { const amt = Math.abs(+p.amount || 0); if (p.per === 'fixed' || !p.per) return cap(tn) + ' verliert ' + amt + ' HP.'; const pile = p.per === 'hand' ? (p.from === 'enemy' ? 'auf der Hand deines Gegners' : p.from === 'both' ? 'auf beiden Händen' : 'auf deiner Hand') : p.per === 'field' ? (p.from === 'enemy' ? 'auf dem gegnerischen Spielfeld' : p.from === 'both' ? 'auf dem Spielfeld' : 'auf deinem Spielfeld') : (p.from === 'enemy' ? 'im gegnerischen Ablagestapel' : p.from === 'both' ? 'in beiden Ablagestapeln' : 'in deinem Ablagestapel'); const f = filterText(p.count, D); const what = p.per === 'field' ? 'Held' : 'Karte'; return cap(tn) + ' verliert ' + amt + ' HP je ' + (f ? what + ' (' + f + ')' : what) + ' ' + pile + (+p.max > 0 ? ' (höchstens ' + p.max + ' HP)' : '') + '.'; }
      case 'control': return 'Übernimm die Kontrolle über ' + t + (e.duration && e.duration.kind === 'rounds' ? ' bis zum Ende deines ' + ((+e.duration.n || 1) === 1 ? 'nächsten Zuges' : (+e.duration.n) + '. nächsten Zuges') : d) + '. Er umgeht Beschwörungssperre, Fesseln und Bewegungssperren und kann sofort handeln'
        + (timing === 'counter' ? '; sein festgelegter Angriff entfällt.' : timing === 'battle' ? '. Wirkt sofort, noch vor den Angriffen: Er greift in dieser Battlephase mit an.' : '. In deiner Battlephase wirkt das sofort, noch vor den Angriffen: Er greift in dieser Battlephase mit an. In der Konterphase entfällt sein Angriff.');
      case 'discard': { const n = Math.max(1, +p.n || 1); return (T.side === 'enemy' ? 'Dein Gegner legt ' : 'Lege ') + (n === 1 ? 'eine zufällige Handkarte' : n + ' zufällige Handkarten') + ' ab.'; }
      case 'mill': { const n = Math.max(1, +p.n || 1); return (n === 1 ? 'Die oberste Karte' : 'Die obersten ' + n + ' Karten') + ' ' + (T.side === 'enemy' ? 'des gegnerischen' : 'deines') + ' Nachziehstapels ' + (n === 1 ? 'kommt' : 'kommen') + ' auf den Ablagestapel.'; }
      case 'draw': { const n = Math.max(1, +p.n || 1); return (T.side === 'enemy' ? 'Dein Gegner zieht ' : 'Ziehe ') + (n === 1 ? 'eine Karte' : n + ' Karten') + '.'; }
    }
    return '?';
  }
  function costText(c) { if (!c) return ''; const a = []; if (+c.hp > 0) a.push('dein König verliert ' + (+c.hp) + ' HP'); if (+c.discard > 0) a.push('du legst ' + (+c.discard === 1 ? 'eine zufällige Handkarte' : +c.discard + ' zufällige Handkarten') + ' ab'); return a.length ? 'Zusätzliche Kosten beim Ausspielen: ' + a.join(', und ') + '.' : ''; }
  function describe(card, D) {
    const sp = card.spell || {}, out = [];
    const req = sp.require && sp.require.items && sp.require.items.length ? 'Voraussetzung: ' + condText(sp.require, D) + '.' : '';
    if (req) out.push(req);
    const co = costText(sp.cost); if (co) out.push(co);
    if (sp.timing === 'battle') out.push('Nur in deiner Battlephase spielbar.');
    if (sp.timing === 'counter') out.push('Nur in deiner Konterphase spielbar.');
    for (const e of sp.effects || []) out.push((e.trigger === 'enemyAttack' ? 'Bei einem gegnerischen Angriff: ' : '') + describeEffect(e, D, card.type, sp.timing || 'both'));
    return out.join(' ');
  }

  /* ---------- Prüfung ---------- */
  function validate(card, D) {
    const errors = [], warnings = [], open = [];
    const sp = card.spell; const ct = card.type;
    const has = (list, id) => ((D && D[list]) || []).some(x => x.id === id);
    if (!sp || !Array.isArray(sp.effects)) { errors.push('Keine Effektdaten.'); return { errors, warnings, open, playable: false }; }
    if (sp.v > VERSION) errors.push('Effektformat Version ' + sp.v + ' ist neuer als diese Anwendung (' + VERSION + ').');
    if (!sp.effects.length) errors.push('Die Karte hat noch keinen Effekt.');
    if (card.energy === '' || card.energy === null || card.energy === undefined || isNaN(+card.energy)) errors.push('Energiekosten fehlen.');
    else if (+card.energy < 0 || +card.energy > 10) errors.push('Energiekosten müssen zwischen 0 und 10 liegen.');
    if (!TIMINGS[sp.timing || 'both']) errors.push('Unbekannter Ausspielzeitpunkt.');
    const checkFilter = (f, where) => { for (const it of (f && f.items) || []) { if (it.items) { checkFilter(it, where); continue; } if (it.k === 'race' && !has('RACES', it.v)) errors.push(where + ': unbekannte Rasse „' + it.v + '“.'); if (it.k === 'class' && !has('CLASSES', it.v)) errors.push(where + ': unbekannte Klasse „' + it.v + '“.'); if (it.k === 'element' && !has('ELEMENTS', it.v)) errors.push(where + ': unbekanntes Element „' + it.v + '“.'); if (!FILTER_KINDS[it.k]) errors.push(where + ': unbekannter Filter „' + it.k + '“.'); if (['race', 'class', 'element', 'unitType'].includes(it.k) && !it.v) errors.push(where + ': Filter ohne Auswahl.'); } };
    const checkCond = (c, where) => { if (!c) return; if (c.items) { if (!['and', 'or'].includes(c.op)) errors.push(where + ': Verknüpfung muss UND oder ODER sein.'); c.items.forEach(x => checkCond(x, where)); return; } if (!COND_KINDS[c.k]) { errors.push(where + ': unbekannte Bedingung „' + c.k + '“.'); return; } if (['control', 'enemyControl', 'discard', 'attacked', 'fieldAny', 'hand'].includes(c.k) && !(+c.min >= 1)) errors.push(where + ': Mindestanzahl fehlt.'); if (c.k === 'onField' && !c.card) errors.push(where + ': Karte nicht gewählt.'); if (c.k === 'kingHp' && !(+c.value >= 0)) errors.push(where + ': HP-Wert fehlt.'); checkFilter(c.filter, where); };
    checkCond(sp.require, 'Voraussetzung');
    if (sp.cost) { if (+sp.cost.hp < 0 || isNaN(+sp.cost.hp)) errors.push('Kosten: König-HP können nicht negativ sein.'); if (+sp.cost.discard < 0 || +sp.cost.discard > 9 || isNaN(+sp.cost.discard)) errors.push('Kosten: 0 bis 9 Handkarten abwerfen.'); }
    sp.effects.forEach((e, i) => {
      const w = 'Effekt ' + (i + 1), K = KINDS[e.kind], t = e.target || {}, p = e.params || {};
      if (!K) { errors.push(w + ': Effektart „' + e.kind + '“ wird nicht unterstützt.'); return; }
      if (!K.defined) open.push(w + ' (' + K.name + '): ' + K.open);
      if (!K.for.includes(ct)) warnings.push(w + ': „' + K.name + '“ ist eher eine ' + (K.for[0] === 'curse' ? 'Fluch' : 'Zauber') + '-Wirkung.');
      if (!K.targets.includes(t.what)) errors.push(w + ': Zielart passt nicht zu „' + K.name + '“.');
      if (!SIDES[t.side]) errors.push(w + ': Seite fehlt.');
      if (t.count === 'n' && !(+t.n >= 1)) errors.push(w + ': Zielanzahl fehlt.');
      if (t.what === 'king' && t.count !== 'one') errors.push(w + ': Es gibt nur einen König je Seite.');
      checkFilter(t.filter, w);
      if (K.lasting && (!e.duration || e.duration.kind === 'instant')) errors.push(w + ': „' + K.name + '“ braucht eine Dauer.');
      if (e.duration && e.duration.kind === 'rounds' && !(+e.duration.n >= 1)) errors.push(w + ': Rundenzahl fehlt.');
      if (needsOppFix(e, sp.timing || 'both')) errors.push(w + ': „bis zum Ende des Zuges“ wirkt hier nie – diese Wirkung zählt erst im Zug deines Gegners. Wähle „Runden“ (zählt die Züge des Gegners) oder „Nur Konterphase“. [Dauer korrigieren]');
      if (e.kind === 'protect' && !['attacks', 'curses', 'both'].includes((e.params || {}).from || 'attacks')) errors.push(w + ': „Schützt vor“ wählen.');
      if (e.duration && e.duration.kind === 'while') { if (!e.duration.cond || !(e.duration.cond.items || e.duration.cond.k)) errors.push(w + ': Bedingung für „solange“ fehlt.'); else checkCond(e.duration.cond, w + ' (Dauer)'); }
      if (!TRIGGERS[e.trigger || 'play']) errors.push(w + ': unbekannter Auslöser.');
      if (e.trigger === 'destruction' && e.kind !== 'deathWard') errors.push(w + ': „bei drohender Zerstörung“ passt nur zu „Vor Zerstörung bewahren“.');
      if (e.trigger === 'enemyAttack' && sp.timing === 'battle') errors.push(w + ': Auslöser „gegnerischer Angriff“ geht nur in der Konterphase, die Karte ist aber nur in der Battlephase spielbar.');
      if (e.kind === 'stat') {
        if (!STATS[p.stat]) errors.push(w + ': Wert wählen (ATK, DEF oder Bewegung).');
        if (!['add', 'set'].includes(p.mode)) errors.push(w + ': „verändern um“ oder „setzen auf“ wählen.');
        if (p.amount === '' || p.amount === undefined || isNaN(+p.amount)) errors.push(w + ': Betrag fehlt.');
        if (t.what === 'king' && p.stat !== 'atk') errors.push(w + ': Könige besitzen keine ' + (STATS[p.stat] || p.stat) + '.');
        if (p.stat === 'move' && p.mode === 'set' && (+p.amount < 0 || +p.amount > 3)) errors.push(w + ': Bewegung kann nur 0 bis 3 Schritte betragen (Regelwerk: 1–3 Schritte).');
        if ((p.stat === 'atk' || p.stat === 'def') && p.mode === 'set' && +p.amount < 0) errors.push(w + ': ATK/DEF können nicht negativ sein.');
      }
      if (e.kind === 'status') { const S = STATUSES[p.status]; if (!S) errors.push(w + ': Zustand wählen.'); else if (!S.defined) open.push(w + ': ' + S.open); if (e.duration && e.duration.kind !== 'instant') warnings.push(w + ': Zustände folgen ihren eigenen Regeln; die eingestellte Dauer wird nicht verwendet.'); }
      if ((e.kind === 'giftBlock' || e.kind === 'giftRemove') && p.gifts !== 'all') {
        if (!Array.isArray(p.gifts) || !p.gifts.length) errors.push(w + ': Mindestens eine Gabe wählen (oder „alle Gaben“).');
        for (const g of p.gifts || []) if (!has('GIFTS', g) && !has('ROYAL_GIFTS', g)) errors.push(w + ': unbekannte Gabe „' + g + '“.');
      }
      if (e.kind === 'heal' || e.kind === 'maxHp' || e.kind === 'tempHp') { if (!(+p.amount > 0)) errors.push(w + ': HP-Betrag fehlt.'); }
      if (e.kind === 'heal' && !['start', 'none'].includes(p.cap)) errors.push(w + ': Grenze der Heilung wählen.');
      if (e.kind === 'revive') { if (!['own', 'enemy', 'both'].includes(t.side)) errors.push(w + ': Ablagestapel wählen.'); if (t.count === 'all') warnings.push(w + ': „alle“ belebt nur so viele Helden wieder, wie freie Beschwörungsfelder da sind.'); }
      if (e.kind === 'deathWard' && !(+p.uses >= 0)) errors.push(w + ': Anzahl (0 = unbegrenzt während der Dauer) fehlt.');
      if (e.kind === 'damage') { if (!(+p.amount > 0)) errors.push(w + ': Schadensbetrag fehlt.'); if (!['fixed', 'discard', 'field', 'hand'].includes(p.per || 'fixed')) errors.push(w + ': Berechnung wählen.'); if (p.per && p.per !== 'fixed' && !['own', 'enemy', 'both'].includes(p.from)) errors.push(w + ': Wo gezählt wird, fehlt.'); if (p.per && p.per !== 'fixed') checkFilter(p.count, w + ' (gezählte Karten)'); if (+p.max < 0) errors.push(w + ': Höchstschaden kann nicht negativ sein.'); }
      if (e.kind === 'discard' || e.kind === 'mill') { if (!(+p.n >= 1 && +p.n <= 10)) errors.push(w + ': Anzahl (1–10) fehlt.'); if (!['own', 'enemy'].includes(t.side)) errors.push(w + ': Welcher Spieler?'); }
      if (e.kind === 'draw') { if (!(+p.n >= 1 && +p.n <= 10)) errors.push(w + ': Anzahl der Karten (1–10) fehlt.'); if (!['own', 'enemy'].includes(t.side)) errors.push(w + ': Wer zieht? (du oder dein Gegner)'); }
      if (e.kind === 'neutralize' && sp.timing === 'battle' && ct) warnings.push(w + ': Neutralisieren in der eigenen Battlephase trifft nur Karten, die der Gegner schon gespielt hat (normalerweise erst in seiner Konterphase).');
    });
    return { errors, warnings, open, playable: !errors.length && !open.length };
  }

  /* ---------- Abgleich Regeltext ↔ Effekte ---------- */
  function hash(card) {
    const sp = card.spell || {}, co = sp.cost && (+sp.cost.hp > 0 || +sp.cost.discard > 0) ? [+sp.cost.hp || 0, +sp.cost.discard || 0] : null;
    const s = JSON.stringify([card.ruleText || '', sp.timing, sp.require, (sp.effects || []).map(e => [e.kind, e.target, e.params, e.duration, e.trigger])].concat(co ? [co] : []));
    let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16);
  }
  const KEYWORDS = { destroy: /zerstör|vernicht/i, status: /poison|gift|vergift|einfrier|freeze/i, moveBlock: /bewegungsunfähig|nicht (mehr )?(laufen|bewegen)|fessel|sperr/i, stat: /atk|angriff|def|verteidig|bewegung|schritt/i, giftBlock: /gabe|fähigkeit|blockier/i, giftRemove: /gabe|fähigkeit|entfern|verlier/i, fieldLock: /feld/i, revive: /wiederbeleb|zurück|beschwör/i, protect: /schütz|schutz|angriff/i, deathWard: /zerstör|tod|stirbt|bewahr/i, heal: /heil|hp/i, maxHp: /hp/i, tempHp: /hp/i, neutralize: /neutralis|aufheb/i, damage: /schaden|hp|verliert/i, draw: /zieh|karte/i, discard: /ablegen|abwerf|legt|hand/i, control: /kontroll|übernimm|übernehm/i, mill: /stapel|nachzieh|oberst/i };
  const WORDS = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10 };
  const nums = t => (String(t || '').match(/\d[\d.]*/g) || []).map(x => +x.replace(/\./g, '')).concat((String(t || '').toLowerCase().match(/\b(zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\b/g) || []).map(w => WORDS[w]));
  function textCheck(card, D) {
    const text = card.ruleText || '', sp = card.spell || {}, out = [];
    if (!text.trim()) out.push('Kein Regeltext: Auf der Karte steht dann der aus den Effekten erzeugte Text.');
    else {
      const want = new Set(nums(describe(card, D)).filter(n => n > 1)), have = new Set(nums(text).concat([1]));
      for (const n of want) if (!have.has(n)) out.push('Im Regeltext fehlt die Zahl ' + n + ', die in den Effekten steht.');
      for (const n of have) if (!want.has(n) && n > 1) out.push('Die Zahl ' + n + ' im Regeltext kommt in den Effekten nicht vor.');
      for (const e of sp.effects || []) if (KEYWORDS[e.kind] && !KEYWORDS[e.kind].test(text) && !((e.kind === 'giftBlock' || e.kind === 'giftRemove') && Array.isArray(e.params && e.params.gifts) && e.params.gifts.some(g => text.toLowerCase().includes(String(giftNames([g], D)).toLowerCase())))) out.push('Der Regeltext erwähnt „' + (KINDS[e.kind] || {}).name + '“ (Effekt ' + ((sp.effects || []).indexOf(e) + 1) + ') anscheinend nicht.');
    }
    const synced = !text.trim() || (!!sp.sync && sp.sync === hash(card));
    return { synced, hints: out, hash: hash(card) };
  }
  // Gesamtstatus für Export und Spiel
  function status(card, D) {
    const v = validate(card, D), tc = textCheck(card, D);
    const reasons = v.errors.concat(v.open);
    if (!tc.synced) reasons.push('Regeltext und Effekte sind nicht als übereinstimmend bestätigt.');
    return { playable: !reasons.length, reasons, validation: v, text: tc };
  }

  const api = { phaseOf, autoFix, needsOppFix, durText, costText, FORMAT, VERSION, KINDS, STATUSES, STATS, DURATIONS, TRIGGERS, TIMINGS, SIDES, COND_KINDS, FILTER_KINDS, blankEffect, blankSpell, normalizeSpell, describe, describeEffect, condText, filterText, validate, textCheck, status, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WOK_EFFECTS = api;
})(typeof window !== 'undefined' ? window : globalThis);
