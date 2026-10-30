/* War of Kings – Power-Scaling-System 2.0 (Teststand vom 28.10.2026, Vorgabe des Nutzers) und Zufallsgenerator.
 * Gesamt-Power = ATK-Power + DEF-Power + Energie-Power + Laufrichtungen + Angriffsfelder + Laufschritte
 *               + Gaben + Gabenanzahlbonus + Gaben-Harmonie + Sonder-Synergie
 * Alle Tabellenwerte stammen 1:1 aus dem Dokument „Power-Scaling-System 2.0“. Seltenheitsgrenzen sind dort ausdrücklich vorläufig.
 * Gaben-Harmonie: Es gibt noch keine bestätigte Liste. Sie wird deshalb mit 0 gerechnet und als „ungeprüft“ gekennzeichnet;
 * die Paarliste unten ist nur ein Werkstatt-Vorschlag zur Information.
 * Noch nicht ins Master-Regelwerk übernommen – das Master-Regelwerk hat Vorrang.
 */
window.WOK_POWER = (function () {
  'use strict';
  const D = window.WOK_DATA;
  const SOURCE = 'Power-Scaling-System 3.5 (Teststand)';
  const VERSION = '3.5';
  const STAT_MAX = 3500;
  // Abschnitt 13 (vorläufig), angepasst am 28.10.2026: Gewöhnlich bis unter 70, Legendär ab 140; ab 200 Balancewarnung
  const BANDS = [
    { id: 'gewoehnlich', lo: 0, hi: 69.99 },
    { id: 'ungewoehnlich', lo: 70, hi: 119.99 },
    { id: 'selten', lo: 120, hi: 150 },                 // 28.10.2026: Selten bis einschließlich 150
    { id: 'legendaer', lo: 150, hi: 200, above: true }  // Legendär = über 150
  ];
  const WARN_AT = 200;
  // Abschnitt 14 (bestätigt): höchstens so viele Gaben je Seltenheit
  const GIFT_LIMIT = { gewoehnlich: 1, ungewoehnlich: 1, selten: 2, legendaer: 3 };
  // Abschnitte 3/4: Stützpunkte, dazwischen linear. 28.10.2026 +10 % (11/16,5/22/44/66), 29.10.2026 −10 % davon
  // 29.10.2026 01:07: ATK/DEF nochmals −5 %
  // 29.10.2026 09:19: ATK/DEF nochmals +10 %
  // 29.10.2026 10:13: ATK/DEF nochmals +20 %
  // 29.10.2026 10:26: ATK/DEF nochmals +10 %
  const STAT_TABLE = [[0, 0], [500, 13.6561], [1000, 20.4842], [1500, 27.3121], [2000, 54.6242], [3500, 81.9364]];
  // Abschnitt 5: feste Tabelle. Ursprünglich +50/+40/+35/+30/+15/+10/+5/0/−5/−10/−15; 28.10.2026 −15 %, 29.10.2026 nochmals −10 %
  // 29.10.2026: 7 Energie = 0; 8/9/10 Energie wieder Minuspunkte (−5/−10/−15, Vorgabe vom Nutzer)
  // 29.10.2026 10:26: Minuswerte (8–10 Energie) um 20 % verstärkt (−5/−10/−15 → −6/−12/−18)
  // 29.10.2026 12:28: Pluswerte −20 %, Minuswerte +15 %
  const ENERGY_PTS = { 0: 30.6, 1: 24.48, 2: 21.42, 3: 18.36, 4: 9.18, 5: 6.12, 6: 3.06, 7: 0, 8: -6.9, 9: -13.8, 10: -20.7 };
  // Abschnitt 8: feste Tabellenwerte
  // 29.10.2026: 2 Laufschritte +20 % (8 → 9,6), 3 Laufschritte +40 % (16 → 22,4)
  // 29.10.2026 01:13: 2 und 3 Laufschritte nochmals +25 % (9,6 → 12, 22,4 → 28)
  // 29.10.2026 10:26: 2 Schritte +20 % (12 → 14,4), 3 Schritte +10 % (28 → 30,8)
  const MOVE_PTS = { 1: 2, 2: 14.4, 3: 30.8 };
  // Abschnitte 6/7: je Richtung bzw. Feld 2 Punkte, höchstens 8
  // 29.10.2026 10:26: Angriffsfelder +15 % (2,3 je Feld); Laufrichtungen bleiben 2 je Richtung
  // 29.10.2026 12:28: Angriffs- und Laufrichtungen je +25 % (Angriff 2,875 je Feld, Laufen 2,5 je Richtung)
  const FIELD_PTS = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => Math.round(n * 2.875 * 1000) / 1000);
  const MOVE_DIR_PTS = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => n * 2.5);
  // Abschnitt 9
  // Am 28.10.2026 alle um 15 % schwächer gewertet (vorher 6/7/8/8/9/10/13/14/15/8/10/9/12)
  // 29.10.2026: alle Gaben +10 % gegenüber dem Stand davor
  // 29.10.2026 (zweite Anpassung): feste Werte vom Nutzer; Entwaffnen, Heilung, Fesseln, Durchbruch und Poison unverändert; Schütze neu
  // 29.10.2026 01:07: alle Gaben nochmals +15 %
  // 29.10.2026 01:13: alle Gaben +25 % und auf ganze Punkte aufgerundet
  const GIFT_PTS = { rueckzug: 11, eisenpanzer: 15, mordlust: 15, entwaffnen: 11, blitzschritt: 13, tausch: 16, poison: 18, doppelschlag: 21, goettlicher_segen: 21, heilung: 11, fesseln: 14, durchbruch: 13, ansturm: 18, schuetze: 22 };
  const UNSCORED = [];
  // Abschnitt 10: Gesamtbonus nach Anzahl (3 Gaben = +5, nicht +2 und +5)
  const COUNT_PTS = [0, 0, 2, 5];
  // Abschnitt 11: höchstens 9, nur mit bestätigter Grundlage. Liste = Werkstatt-Vorschlag (V1.5), wird NICHT gezählt.
  const HARMONY_CONFIRMED = false;
  const HARMONY = [
    ['poison', 'doppelschlag', 6, 'vergiftet zwei Gegner pro Angriff'],
    ['mordlust', 'doppelschlag', 4, '+500 ATK auf beide Ziele'],
    ['mordlust', 'entwaffnen', 3, '1000 Punkte Unterschied in einem Kampf'],
    ['entwaffnen', 'doppelschlag', 2, 'geschwächtes Ziel plus zweiter Angriff'],
    ['eisenpanzer', 'goettlicher_segen', 3, 'Panzer, der nicht geschwächt werden kann'],
    ['poison', 'goettlicher_segen', 3, 'Giftträger ohne Schwächen'],
    ['tausch', 'rueckzug', 2, 'doppelte Fluchtmöglichkeit'],
    ['tausch', 'blitzschritt', 2, 'hohe Beweglichkeit'],
    ['blitzschritt', 'rueckzug', 2, 'vorstoßen und wieder zurückweichen'],
    ['ansturm', 'doppelschlag', 3, 'trifft gleich beim Beschwören zwei Gegner'],
    ['ansturm', 'mordlust', 3, 'Überraschungsangriff mit +500 ATK'],
    ['ansturm', 'durchbruch', 2, 'sofortiger Angriff auf 2 Felder Entfernung'],
    ['durchbruch', 'poison', 3, 'vergiftet aus der Distanz'],
    ['fesseln', 'durchbruch', 3, 'festhalten und aus der Ferne treffen'],
    ['fesseln', 'entwaffnen', 2, 'Gegner festgehalten und geschwächt'],
    ['heilung', 'eisenpanzer', 2, 'zäher Verteidiger, der sich selbst reinigt']
  ];
  const HARMONY_MAX = 9;
  // Abschnitt 12: höchstens 9, von Hand und manuell zu prüfen
  const SYNERGY = [[0, 'Keine Sonder-Synergie'], [3, 'Sinnvolles Gesamtpaket'], [6, 'Sehr starkes Gesamtpaket'], [9, 'Außergewöhnliches Gesamtpaket']];
  const MIX = [['gewoehnlich', 0.64], ['ungewoehnlich', 0.24], ['selten', 0.10], ['legendaer', 0.02]];
  const SEASON1 = { races: ['mensch', 'tierwesen', 'bestien', 'maschinen', 'drachen'], classes: ['pirat', 'samurai', 'magier', 'baendiger'], elements: ['feuer', 'wasser', 'wind', 'erde', 'blitz'] };
  // Statusmeldungen laut Abschnitt 16
  const STATUS = {
    ok: 'Berechnung gültig', giftLimit: 'Gabenlimit überschritten', band: 'Power-Bereich passt nicht zur Seltenheit', unknownGift: 'Unbekannte Gabe',
    invalid: 'Ungültiger Kartenwert', balance: 'Balanceprüfung erforderlich', incomplete: 'Regelprüfung unvollständig'
  };

  function lerp(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
    return pts[pts.length - 1][1];
  }
  const statPts = v => lerp(STAT_TABLE, Math.min(STAT_MAX, Math.max(0, +v || 0)));
  // Umkehrung für den Generator: Wert zu gewünschten Punkten
  function statFor(p) { const T = STAT_TABLE; p = Math.max(0, Math.min(T[T.length - 1][1], p)); for (let i = 1; i < T.length; i++) if (p <= T[i][1]) { const [x0, y0] = T[i - 1], [x1, y1] = T[i]; return x0 + (x1 - x0) * (p - y0) / (y1 - y0); } return STAT_MAX; }
  function moveRange(card) {
    const m = card.move || {}; const dirs = Object.values(m.dirs || {}).filter(Boolean);
    if (m.showNumber && +m.number) return +m.number;
    if (!dirs.length) return 0;
    return Math.max(...dirs.map(v => v === true ? 1 : +v));
  }
  function moveDirs(card) { return Object.values((card.move || {}).dirs || {}).filter(Boolean).length; }
  function attackFields(card) { return Object.values((card.attack || {}).dirs || {}).filter(Boolean).length; }
  function bandOf(total) { for (let i = BANDS.length - 1; i > 0; i--) if (BANDS[i].above ? total > BANDS[i].lo : total >= BANDS[i].lo) return BANDS[i]; return BANDS[0]; }
  const bandFrom = b => (b.above ? 'über ' : 'ab ') + b.lo;
  function rarityName(id) { return (D.RARITIES.find(r => r.id === id) || {}).name || id; }
  const r2 = x => Math.round(x * 100) / 100;
  const fmt = x => String(r2(x)).replace('.', ',');
  function harmonyOf(ids) {
    const hits = HARMONY.filter(([a, b]) => ids.includes(a) && ids.includes(b));
    let sum = 0; const used = [];
    for (const h of hits.sort((x, y) => y[2] - x[2])) { const add = Math.min(h[2], HARMONY_MAX - sum); if (add <= 0) break; sum += add; used.push([h[0], h[1], add, h[3]]); }
    return { sum, used };
  }
  // Kompatibilität: Energie wird nicht mehr aus der Stärke abgeleitet (Abschnitt 5: nur feste Tabelle)
  function energyFor() { return null; }
  function fairEnergy() { return null; }

  /* Gesamt-Power einer Karte mit offengelegter Aufschlüsselung, Prüfungen A–E und Statusmeldungen */
  /* ================= Könige (Vorgabe des Entwicklers vom 30.10.2026) =================
   * Höchstwerte: 20.000 HP, 3.500 ATK, höchstens 3 königliche Gaben (permanent oder mit CT).
   * Bewertung auf einer Skala bis 200 Punkte (gleiche Seltenheitsgrenzen wie bei Helden):
   *   HP + ATK zusammen 25 % (50 Punkte), HP über 15.000 bekommt einen deutlichen Schub,
   *   drei Gaben +20 % (40 Punkte), die Stärke der Gaben den Rest (55 %, 110 Punkte = bis zu 36,7 je Gabe).
   * Die genaue Aufteilung innerhalb dieser Anteile ist ein Werkstatt-Vorschlag. Die Seltenheit kann von Hand umgestellt werden.
   */
  const KING = { atk: [2000, 3500], hp: [10000, 20000], dirs: ['nw', 'n', 'ne'], gifts: 3 };
  const KING_SCALE = 200, KING_SHARE = { stats: 0.25, three: 0.20, gifts: 0.55 };
  // HP: 10.000 → 0, 15.000 → 8, 20.000 → 30 (über 15.000 steiler = „guter Schub“); ATK: 2.000 → 0, 3.500 → 20. Zusammen höchstens 50.
  const KING_HP_TABLE = [[0, 0], [10000, 0], [15000, 8], [20000, 30]];
  const KING_ATK_TABLE = [[0, 0], [2000, 0], [3500, 20]];
  const KING_GIFT_MAX = KING_SCALE * KING_SHARE.gifts / 3;          // 36,67 je Gabe
  const KING_GIFT_BASE = 0.35;                                       // schon die schwächste Stufe einer Gabe zählt 35 %
  const ROYAL_SCOPE_FACTOR = { all: 1, race: 0.6, class: 0.6, element: 0.6 };
  const ROYAL_GIFT_PTS = { gebot_der_krone: {}, zorn_des_imperators: {}, ewiges_bollwerk: {}, blitzkrieg: {} };   // Gaben mit festgelegten Werten
  function royalPts(g, sel) {
    if (!g.param) return null;
    const p = g.param, a = D.royalAmount(g, sel), frac = p.max > p.min ? (a - p.min) / (p.max - p.min) : 1, sc = (sel && sel.scope) || 'all';
    const ctF = g.kind === 'ct' ? 0.85 : 1;                          // aktivierbar mit Abklingzeit zählt etwas weniger als permanent (Vorschlag)
    return Math.floor(100 * KING_GIFT_MAX * (KING_GIFT_BASE + (1 - KING_GIFT_BASE) * Math.pow(frac, 1.2)) * (ROYAL_SCOPE_FACTOR[sc] || 1) * ctF) / 100;
  }
  const hpPts = v => lerp(KING_HP_TABLE, Math.min(KING.hp[1], Math.max(0, +v || 0)));
  const katkPts = v => lerp(KING_ATK_TABLE, Math.min(KING.atk[1], Math.max(0, +v || 0)));
  function evaluateKing(card) {
    const rows = [], notes = [], status = new Set();
    const has = v => v !== '' && v !== null && v !== undefined && !isNaN(+v);
    const bad = text => { notes.push({ level: 'error', text: STATUS.invalid + ': ' + text }); status.add('invalid'); };
    if (has(card.atk)) { if (+card.atk < KING.atk[0] || +card.atk > KING.atk[1]) bad('Königs-ATK ' + card.atk + ' liegt nicht zwischen 2.000 und 3.500.'); else if (+card.atk % 100) bad('ATK ' + card.atk + ' ist kein 100er-Schritt.'); }
    if (has(card.hp)) { if (+card.hp < KING.hp[0] || +card.hp > KING.hp[1]) bad('HP ' + Number(card.hp).toLocaleString('de-DE') + ' liegt nicht zwischen 10.000 und 20.000 (Höchstwert 20.000).'); }
    const atk = katkPts(card.atk), hp = hpPts(card.hp);
    rows.push(['ATK ' + (has(card.atk) ? card.atk : 0) + ' (Werte zusammen höchstens 50)', r2(atk)], ['HP ' + (has(card.hp) ? Number(card.hp).toLocaleString('de-DE') : 0) + (+card.hp > 15000 ? ' – Schub über 15.000' : ''), r2(hp)]);
    const dirs = Object.keys((card.attack || {}).dirs || {}).filter(k => card.attack.dirs[k]);
    const wrong = dirs.filter(d => !KING.dirs.includes(d));
    if (wrong.length) bad('Könige greifen nur gerade, schräg links oder schräg rechts an (nicht: ' + wrong.join(', ') + ').');
    if (Object.values((card.move || {}).dirs || {}).some(Boolean)) bad('Könige können nicht laufen. Laufrichtungen entfernen.');
    let gp = 0; const sels = card.gifts || [], ids = sels.map(g => g.id);
    if (ids.length > KING.gifts) bad('Höchstens 3 königliche Gaben.');
    if (new Set(ids).size !== ids.length) bad('Eine königliche Gabe ist doppelt eingetragen.');
    for (const sel of sels) {
      const id = sel.id, g = (D.ROYAL_GIFTS || []).find(x => x.id === id), nm = g ? g.name : ((D.GIFTS.find(x => x.id === id) || {}).name || id);
      if (g && sel.scope && sel.scope !== 'all' && !sel.target) { status.add('incomplete'); notes.push({ level: 'warn', text: nm + ': Für „nur ' + ({ race: 'eine Rasse', class: 'eine Klasse', element: 'ein Element' }[sel.scope] || '') + '“ fehlt noch die Auswahl.' }); }
      const rp = g ? royalPts(g, sel) : null;
      if (g && rp !== null) { rows.push([nm + ' (' + D.royalShort(g, sel) + (g.kind === 'ct' ? ', CT ' + g.ct : ', permanent') + ')', rp]); gp += rp; }
      else if (g) { rows.push([nm, null]); status.add('incomplete'); notes.push({ level: 'warn', text: 'Königliche Gabe „' + nm + '“ hat noch keine Werte im Power-Scaling.' }); }
      else { rows.push([nm, null]); status.add('unknownGift'); notes.push({ level: 'error', text: STATUS.unknownGift + ': „' + nm + '“ ist keine königliche Gabe. Könige haben eigene Gaben, keine Heldengaben.' }); }
    }
    const three = ids.length >= 3 ? r2(KING_SCALE * KING_SHARE.three) : 0;
    rows.push([ids.length >= 3 ? 'Drei königliche Gaben (+20 %)' : 'Bonus für drei Gaben (erst ab 3 Gaben)', three]);
    const base = r2(atk + hp + gp + three), total = base, band = bandOf(total);
    if (card.rarity && card.rarity !== band.id) { status.add('band'); notes.push({ level: 'warn', text: STATUS.band + ': gewählt ist ' + rarityName(card.rarity) + ', die Gesamt-Power ' + fmt(total) + ' ergibt ' + rarityName(band.id) + '. Von Hand umstellen ist erlaubt.' }); }
    if (total >= WARN_AT) { status.add('balance'); notes.push({ level: 'warn', text: STATUS.balance + ': ' + fmt(total) + ' Power.' }); }
    notes.push({ level: 'info', text: 'Königs-Bewertung nach Vorgabe vom 30.10.2026: HP + ATK 25 %, drei Gaben +20 %, Stärke der Gaben 55 %. Aufteilung innerhalb der Anteile ist ein Werkstatt-Vorschlag. Angriffsrichtungen zählen nicht.' });
    const st = [...status]; if (!st.some(s => s !== 'incomplete')) st.unshift('ok');
    return { rows, base, energyPts: 0, total, rarity: band.id, giftLimit: KING.gifts, notes, status: st.map(k => ({ code: k, text: STATUS[k] })), suggestedEnergy: null, fairEnergy: null, king: true };
  }
  // Würfel für Könige: Angriffsrichtungen aus gerade/schräg, ATK und HP so, dass die Ziel-Seltenheit passt
  function generateKing(rarityChoice, rng, opts) {
    opts = opts || {}; rng = rng || Math.random; const F = opts.fixed || {};
    const want = rollRarity(rng, rarityChoice), band = BANDS.find(b => b.id === want);
    for (let attempt = 0; attempt < 400; attempt++) {
      const n = 1 + Math.floor(rng() * 3), dirs = F.attack ? JSON.parse(JSON.stringify(F.attack)) : { dirs: Object.fromEntries(shuffle(rng, KING.dirs).slice(0, n).map(k => [k, 1])), showNumber: false, number: 1 };
      const card = { type: 'king', atk: F.atk !== undefined ? +F.atk : 2000 + Math.floor(rng() * 16) * 100, hp: F.hp !== undefined ? +F.hp : 10000 + Math.floor(rng() * 21) * 500,
        attack: dirs, move: { dirs: {}, showNumber: false, number: 1 }, gifts: F.giftObjs ? JSON.parse(JSON.stringify(F.giftObjs)) : (F.gifts || []).map(id => ({ id })), energy: '' };
      if (F.rollGifts) { const R = (D.ROYAL_GIFTS || []).filter(g => g.param), cnt = { gewoehnlich: [0, 1], ungewoehnlich: [1, 2], selten: [2, 3], legendaer: [3, 3] }[want] || [0, 1], k = Math.min(R.length, cnt[0] + Math.floor(rng() * (cnt[1] - cnt[0] + 1)));
        card.gifts = shuffle(rng, R).slice(0, k).map(g => { const p = g.param, steps = Math.round((p.max - p.min) / p.step); return { id: g.id, scope: 'all', amount: p.min + Math.floor(rng() * (steps + 1)) * p.step }; }); }
      let ev = evaluateKing(card), g = 0;
      const canH = F.hp === undefined, canA = F.atk === undefined;
      while (ev.total >= band.hi + 0.01 && g++ < 80) { if (canH && card.hp > KING.hp[0]) card.hp -= 500; else if (canA && card.atk > KING.atk[0]) card.atk -= 100; else break; ev = evaluateKing(card); }
      while (ev.total < band.lo + (band.above ? 0.01 : 0) && g++ < 160) { if (canH && card.hp < KING.hp[1]) card.hp += 500; else if (canA && card.atk < KING.atk[1]) card.atk += 100; else break; ev = evaluateKing(card); }
      if (ev.rarity !== want) continue;
      card.rarity = ev.rarity; card.power = ev.total; return card;
    }
    return null;
  }
  function evaluate(card) {
    if (card && card.type === 'king') return evaluateKing(card);
    const rows = [], notes = [], status = new Set();
    const has = v => v !== '' && v !== null && v !== undefined && !isNaN(+v);
    const bad = text => { notes.push({ level: 'error', text: STATUS.invalid + ': ' + text }); status.add('invalid'); };
    // Prüfung A
    for (const [k, v] of [['ATK', card.atk], ['DEF', card.def]]) {
      if (!has(v)) continue;
      if (+v < 0 || +v > STAT_MAX) bad(k + ' ' + v + ' liegt nicht zwischen 0 und 3.500.' + (+v > STAT_MAX ? ' Gerechnet wird mit 3.500.' : ''));
      else if (+v % 100) bad(k + ' ' + v + ' ist kein 100er-Schritt.');
    }
    const atk = statPts(card.atk), def = statPts(card.def);
    rows.push(['ATK ' + (has(card.atk) ? card.atk : 0), r2(atk)], ['DEF ' + (has(card.def) ? card.def : 0), r2(def)]);
    const hasE = has(card.energy);
    let ep = 0;
    if (hasE) {
      const e = +card.energy;
      if (e < 0 || e > 10 || e % 1) { bad('Energie ' + e + ' liegt nicht zwischen 0 und 10.'); ep = ENERGY_PTS[Math.max(0, Math.min(10, Math.round(e)))]; }
      else ep = ENERGY_PTS[e];
      rows.push(['Energie ' + e, ep]);
    } else { rows.push(['Energie (noch offen)', 0]); status.add('incomplete'); }
    const md = moveDirs(card), af = attackFields(card), mr = moveRange(card);
    if (md > 8) bad('Mehr als 8 Laufrichtungen.');
    if (af > 8) bad('Mehr als 8 Angriffsfelder.');
    const mdp = MOVE_DIR_PTS[Math.min(8, md)], afp = FIELD_PTS[Math.min(8, af)];
    rows.push([md + (md === 1 ? ' Laufrichtung' : ' Laufrichtungen'), mdp], [af + (af === 1 ? ' Angriffsfeld' : ' Angriffsfelder'), afp]);
    let mp = 0;
    if (mr >= 1 && mr <= 3) mp = MOVE_PTS[mr];
    else if (md) bad('Laufschritte ' + mr + ': erlaubt sind 1, 2 oder 3.');
    rows.push([mr + (mr === 1 ? ' Laufschritt' : ' Laufschritte'), mp]);
    // Prüfung B
    let gp = 0; const ids = (card.gifts || []).map(g => g.id);
    for (const id of ids) {
      const g = D.GIFTS.find(x => x.id === id), nm = g ? D.giftTitle(g) : id;
      if (g && GIFT_PTS[id] !== undefined) { rows.push([nm, GIFT_PTS[id]]); gp += GIFT_PTS[id]; }
      else { rows.push([nm, null]); notes.push({ level: 'error', text: STATUS.unknownGift + ': „' + nm + '“ steht nicht im aktuellen Master-Regelwerk.' }); status.add('unknownGift'); }
    }
    const cp = COUNT_PTS[Math.min(3, ids.length)] || 0;
    if (ids.length >= 2) rows.push(['Gabenanzahlbonus (' + ids.length + ' Gaben)', cp]);
    let hp = 0;
    if (ids.length >= 2) {
      const hm = harmonyOf(ids);
      if (HARMONY_CONFIRMED) hp = hm.sum;
      rows.push(['Gaben-Harmonie (ungeprüft)', hp]);
      status.add('incomplete');
      notes.push({ level: 'info', text: 'Gaben-Harmonie ist ungeprüft: Es gibt noch keine bestätigte Grundlage, gerechnet wird mit 0.' + (hm.sum ? ' Werkstatt-Vorschlag wäre +' + hm.sum + ' (' + hm.used.map(u => u[3]).join(', ') + '), nicht gezählt.' : '') });
    }
    const syn = Math.max(0, Math.min(9, +(card.synergy || 0)));
    rows.push(['Sonder-Synergie (von Hand)', syn]);
    if (syn) { status.add('incomplete'); notes.push({ level: 'info', text: 'Sonder-Synergie +' + syn + ' ist von Hand vergeben und muss manuell geprüft werden.' }); }
    const base = r2(atk + def + mdp + afp + mp + gp + cp + hp + syn);
    const total = r2(base + ep);
    const band = bandOf(total);
    // Prüfung D – Seltenheit (die gewählte, sonst die berechnete) und Gabenlimit
    const rar = card.rarity || band.id, lim = GIFT_LIMIT[rar];
    if (lim !== undefined && ids.length > lim) {
      status.add('giftLimit');
      notes.push({ level: 'error', text: STATUS.giftLimit + ': ' + rarityName(rar) + ' erlaubt höchstens ' + lim + (lim === 1 ? ' Gabe' : ' Gaben') + ', die Karte hat ' + ids.length + '.'
        + (ids.length === 3 ? ' Drei Gaben erfordern Legendär (' + bandFrom(BANDS[3]) + ' Power), die Karte hat ' + fmt(total) + '.' : ids.length === 2 ? ' Zwei Gaben erfordern Selten (ab ' + BANDS[2].lo + ') oder Legendär, die Karte hat ' + fmt(total) + '.' : '') });
    }
    if (card.rarity && card.rarity !== band.id) { status.add('band'); notes.push({ level: 'warn', text: STATUS.band + ': gewählt ist ' + rarityName(card.rarity) + ', die Gesamt-Power ' + fmt(total) + ' ergibt ' + rarityName(band.id) + '.' }); }
    // Prüfung E – Balance
    if (total >= WARN_AT) { status.add('balance'); notes.push({ level: 'warn', text: STATUS.balance + ': ' + fmt(total) + ' Power (ab ' + WARN_AT + ' manuell prüfen).' }); }
    const st = [...status]; if (!st.some(s => s !== 'incomplete')) st.unshift('ok');
    return { rows, base, energyPts: ep, total, rarity: band.id, giftLimit: GIFT_LIMIT[rar], notes, status: st.map(k => ({ code: k, text: STATUS[k] })), suggestedEnergy: null, fairEnergy: null };
  }

  /* ---------- Zufallsgenerator (hält Gabenlimit und Power-Bereich ein) ---------- */
  function pickW(rng, list) { let s = 0; for (const [, w] of list) s += w; let r = rng() * s; for (const [v, w] of list) { r -= w; if (r <= 0) return v; } return list[list.length - 1][0]; }
  function pick(rng, a) { return a[Math.floor(rng() * a.length)]; }
  function shuffle(rng, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Generatorprofile: Gaben laut Vorgabe vom 28.10.2026 – Gewöhnlich 0 oder 1, Ungewöhnlich genau 1, Selten genau 2, Legendär genau 3; immer Laufrichtung nach vorne
  const PROFILE = {
    gewoehnlich: { target: [40, 69], energy: [[3, 0.1], [4, 0.3], [5, 0.35], [6, 0.25]], gifts: [[0, 0.5], [1, 0.5]], move: [[1, 0.85], [2, 0.15]], fields: [[1, 0.25], [2, 0.4], [3, 0.35]], dirs: [[1, 0.4], [2, 0.3], [3, 0.3]] },
    ungewoehnlich: { target: [70, 119], energy: [[3, 0.25], [4, 0.3], [5, 0.25], [6, 0.2]], gifts: [[1, 1]], move: [[1, 0.6], [2, 0.35], [3, 0.05]], fields: [[2, 0.35], [3, 0.5], [4, 0.15]], dirs: [[2, 0.3], [3, 0.4], [4, 0.3]] },
    selten: { target: [120, 150], energy: [[4, 0.2], [5, 0.3], [6, 0.3], [7, 0.2]], gifts: [[2, 1]], move: [[1, 0.35], [2, 0.5], [3, 0.15]], fields: [[3, 0.5], [4, 0.4], [5, 0.1]], dirs: [[3, 0.3], [4, 0.5], [6, 0.2]] },
    legendaer: { target: [151, 199], energy: [[6, 0.2], [7, 0.3], [8, 0.3], [9, 0.15], [10, 0.05]], gifts: [[3, 1]], move: [[1, 0.2], [2, 0.5], [3, 0.3]], fields: [[3, 0.3], [4, 0.45], [5, 0.25]], dirs: [[4, 0.5], [6, 0.35], [8, 0.15]] }
  };
  const ATK_PATTERNS = { 1: [['n']], 2: [['n', 's'], ['w', 'e'], ['nw', 'ne']], 3: [['n', 'w', 'e'], ['n', 'nw', 'ne']], 4: [['n', 's', 'w', 'e'], ['n', 'nw', 'ne', 's']], 5: [['n', 'w', 'e', 'nw', 'ne']] };
  // Jede gewürfelte Karte kann nach vorne laufen (n ist immer dabei)
  const MOVE_PATTERNS = { 1: [['n']], 2: [['n', 's'], ['n', 'e'], ['n', 'w']], 3: [['n', 'w', 'e'], ['n', 'nw', 'ne']], 4: [['n', 'w', 'e', 's']], 6: [['n', 'w', 'e', 's', 'nw', 'ne']], 8: [['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']] };
  function rollRarity(rng, choice) { return choice === 'gemischt' ? pickW(rng, MIX) : choice; }

  // opts.fixed: Teile, die bleiben sollen – { energy, atk, def, attack, move, gifts: [ids] }. Der Rest wird passend zur Seltenheit gewürfelt.
  // (opts.gifts = alte Schreibweise für fixed.gifts)
  function generate(rarityChoice, rng, opts) {
    opts = opts || {}; rng = rng || Math.random;
    const F = Object.assign({}, opts.fixed || {}); if (Array.isArray(opts.gifts)) F.gifts = opts.gifts;
    const want = rollRarity(rng, rarityChoice), P = PROFILE[want], band = BANDS.find(b => b.id === want);
    if (F.gifts && (F.gifts.length > GIFT_LIMIT[want] || !F.gifts.every(g => GIFT_PTS[g] !== undefined))) return null;
    const statsFixed = F.atk !== undefined && F.def !== undefined;
    for (let attempt = 0; attempt < 400; attempt++) {
      const T = P.target[0] + rng() * (P.target[1] - P.target[0]);
      const mr = pickW(rng, P.move), nf = pickW(rng, P.fields), nd = pickW(rng, P.dirs), ng = Math.min(GIFT_LIMIT[want], pickW(rng, P.gifts));
      const en = F.energy !== undefined ? F.energy : pickW(rng, P.energy);
      const gifts = F.gifts ? F.gifts.slice() : shuffle(rng, Object.keys(GIFT_PTS)).slice(0, ng);
      if (!F.gifts && want !== 'legendaer' && gifts.includes('poison') && gifts.includes('doppelschlag')) continue;
      const card = { atk: 0, def: 0, energy: en, synergy: 0, gifts: gifts.map(id => ({ id })),
        attack: F.attack ? JSON.parse(JSON.stringify(F.attack)) : { dirs: Object.fromEntries(pick(rng, ATK_PATTERNS[nf]).map(k => [k, 1])), showNumber: false, number: 1 },
        move: F.move ? JSON.parse(JSON.stringify(F.move)) : { dirs: Object.fromEntries(pick(rng, MOVE_PATTERNS[nd]).map(k => [k, Math.min(2, mr)])), showNumber: true, number: mr } };
      if (statsFixed) { card.atk = +F.atk; card.def = +F.def; }
      else {
        const sp = T - evaluate(card).total; if (sp < 8 || sp > 120) continue;
        const ratio = 0.35 + rng() * 0.3, clamp = v => Math.max(300, Math.min(3500, Math.round(v / 100) * 100));
        card.atk = F.atk !== undefined ? +F.atk : clamp(statFor(sp * ratio)); card.def = F.def !== undefined ? +F.def : clamp(statFor(sp * (1 - ratio)));
      }
      let ev = evaluate(card), guard = 0;
      const canA = F.atk === undefined, canD = F.def === undefined;
      while (ev.total >= band.hi + 0.01 && guard++ < 60) { if (canA && (card.atk >= card.def || !canD) && card.atk > 300) card.atk -= 100; else if (canD && card.def > 300) card.def -= 100; else break; ev = evaluate(card); }
      while (ev.total < band.lo && guard++ < 120) { if (canA && (card.atk <= card.def || !canD) && card.atk < 3500) card.atk += 100; else if (canD && card.def < 3500) card.def += 100; else break; ev = evaluate(card); }
      if (ev.rarity !== want || ev.total >= WARN_AT) continue;
      card.rarity = ev.rarity; card.power = ev.total; card.energyShift = 0;
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
  return { SOURCE, VERSION, STAT_MAX, STAT_TABLE, ENERGY_PTS, WARN_AT, GIFT_LIMIT, STATUS, BANDS, MOVE_PTS, MOVE_DIR_PTS, FIELD_PTS, GIFT_PTS, COUNT_PTS, HARMONY, HARMONY_CONFIRMED, HARMONY_MAX, UNSCORED, SYNERGY, MIX, SEASON1,
    KING, KING_HP_TABLE, KING_ATK_TABLE, KING_SHARE, ROYAL_GIFT_PTS, ROYAL_SCOPE_FACTOR, royalPts, hpPts, generateKing, evaluate, bandFrom, statPts, energyFor, fairEnergy, generate, randomIdentity, rarityName };
})();
