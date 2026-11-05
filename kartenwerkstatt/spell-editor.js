/* War of Kings Kartenwerkstatt – Editor für Zauber- und Fluchkarten (Ergänzung).
 * Strukturierte Effekte (verbindlich fürs Spiel) + freier Regeltext + optionaler Stimmungstext.
 * Format und Prüfung: effects.js (gemeinsam mit dem Probe-Spiel).
 */
const EF = window.WOK_EFFECTS;
const SPX = { parse: null, words: null, flavor: null, busy: '' };
const isSpellCard = c => !!c && (c.type === 'spell' || c.type === 'curse');
function spPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
function spSet(obj, path, val) { const ks = path.split('.'), last = ks.pop(); const o = ks.reduce((x, k) => (x[k] == null ? (x[k] = /^\d+$/.test(k) ? [] : {}) : x[k]), obj); o[last] = val; }
const spOpt = (map, cur) => Object.entries(map).map(([k, v]) => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + esc(v) + '</option>').join('');
const spSel = (path, map, cur, label, attrs) => '<label>' + label + '<select data-sp="' + path + '" ' + (attrs || '') + '>' + spOpt(map, cur) + '</select></label>';
const spNum = (path, val, label, attrs) => '<label>' + label + '<input type="number" data-sp="' + path + '" data-t="num" value="' + (val === undefined || val === null ? '' : esc(val)) + '" ' + (attrs || '') + '></label>';
const listMap = list => Object.fromEntries(list.map(x => [x.id, x.name]));

function spFilterEditor(path, f) {
  f = f || { op: 'and', items: [] };
  const kinds = EF.FILTER_KINDS;
  const valSel = (it, i) => {
    const p = path + '.items.' + i + '.v';
    if (it.k === 'race') return '<select data-sp="' + p + '"><option value="">– wählen –</option>' + spOpt(listMap(D.RACES), it.v) + '</select>';
    if (it.k === 'class') return '<select data-sp="' + p + '"><option value="">– wählen –</option>' + spOpt(listMap(D.CLASSES), it.v) + '</select>';
    if (it.k === 'element') return '<select data-sp="' + p + '"><option value="">– wählen –</option>' + spOpt(listMap(D.ELEMENTS), it.v) + '</select>';
    if (it.k === 'unitType') return '<select data-sp="' + p + '">' + spOpt({ hero: 'Held', king: 'König', spell: 'Zauber', curse: 'Fluch' }, it.v) + '</select>';
    return '<span class="muted" style="font-size:12px">ohne Auswahl</span>';
  };
  return '<div class="spfilter"><div class="inline"><span class="eyebrow">Einschränken auf</span>' + (f.items.length > 1 ? '<select data-sp="' + path + '.op">' + spOpt({ and: 'alle Bedingungen (UND)', or: 'eine davon (ODER)' }, f.op) + '</select>' : '') + '</div>'
    + f.items.map((it, i) => '<div class="sprow"><select data-sp="' + path + '.items.' + i + '.k" data-rebuild="1">' + spOpt(kinds, it.k) + '</select>' + valSel(it, i) + '<button class="ghost" data-spact="del:' + path + '.items.' + i + '" aria-label="Einschränkung entfernen">✕</button></div>').join('')
    + '<button class="ghost" data-spact="addfilter:' + path + '">+ Einschränkung (Rasse, Klasse, Element …)</button></div>';
}
function spCondEditor(path, g, depth) {
  g = g || { op: 'and', items: [] }; depth = depth || 0;
  const row = (c, i) => {
    const p = path + '.items.' + i;
    if (c.items) return '<div class="spgroup">' + spCondEditor(p, c, depth + 1) + '<button class="ghost danger" data-spact="del:' + p + '">Gruppe entfernen</button></div>';
    let body = '<select data-sp="' + p + '.k" data-rebuild="1">' + spOpt(EF.COND_KINDS, c.k) + '</select>';
    if (['control', 'enemyControl', 'discard', 'attacked', 'fieldAny', 'hand'].includes(c.k)) body += '<label class="inline">mindestens <input type="number" min="1" data-sp="' + p + '.min" data-t="num" value="' + esc(c.min || 1) + '" style="width:64px"></label>';
    if (c.k === 'discard') body += '<select data-sp="' + p + '.side">' + spOpt({ own: 'eigener Ablagestapel', enemy: 'gegnerischer Ablagestapel' }, c.side || 'own') + '</select>';
    if (c.k === 'kingHp') body += '<select data-sp="' + p + '.side">' + spOpt({ own: 'eigener König', enemy: 'gegnerischer König' }, c.side || 'own') + '</select><select data-sp="' + p + '.cmp">' + spOpt({ '<=': 'höchstens', '>=': 'mindestens' }, c.cmp || '<=') + '</select><input type="number" data-sp="' + p + '.value" data-t="num" value="' + esc(c.value || 0) + '" style="width:90px"> HP';
    if (c.k === 'onField') { const heroes = ST.list().filter(x => x.type !== 'spell' && x.type !== 'curse'); body += '<select data-sp="' + p + '.card" data-rebuild="1"><option value="">– Karte wählen –</option>' + heroes.map(x => '<option value="' + esc(x.id) + '"' + (x.id === c.card ? ' selected' : '') + '>' + esc(x.name || 'Ohne Namen') + '</option>').join('') + '</select>'; }
    const fil = ['control', 'enemyControl', 'discard', 'fieldAny'].includes(c.k) ? spFilterEditor(p + '.filter', c.filter) : '';
    return '<div class="spcond"><div class="sprow">' + body + '<button class="ghost" data-spact="del:' + p + '" aria-label="Bedingung entfernen">✕</button></div>' + fil + '</div>';
  };
  return '<div class="spcondgrp">' + (g.items.length > 1 ? '<div class="inline"><span class="eyebrow">Verknüpfung</span><select data-sp="' + path + '.op">' + spOpt({ and: 'UND – alle müssen erfüllt sein', or: 'ODER – eine genügt' }, g.op) + '</select></div>' : '')
    + (g.items.length ? g.items.map(row).join(g.op === 'or' ? '<div class="spjoin">ODER</div>' : '<div class="spjoin">UND</div>') : '<p class="muted" style="font-size:12.5px">Keine.</p>')
    + '<div class="inline"><button class="ghost" data-spact="addcond:' + path + '">+ Bedingung</button>' + (depth < 2 ? '<button class="ghost" data-spact="addgroup:' + path + '">+ Gruppe (Klammer)</button>' : '') + '</div></div>';
}
function spEffectHTML(c, e, i, n) {
  const K = EF.KINDS[e.kind] || {}, p = 'spell.effects.' + i, t = e.target || {}, P = e.params || {};
  const kinds = Object.fromEntries(Object.entries(EF.KINDS).map(([k, v]) => [k, v.name + (v.for.includes(c.type) ? '' : ' (' + (v.for[0] === 'curse' ? 'eher Fluch' : 'eher Zauber') + ')') + (v.defined ? '' : ' – Regel offen')]));
  const targets = Object.fromEntries((K.targets || ['unit']).map(x => [x, { unit: 'Held', king: 'König', field: 'Spielfeld', discard: 'Ablagestapel', card: 'Gespielter Zauber/Fluch', player: 'Spieler' }[x]]));
  const trig = { play: EF.TRIGGERS.play, enemyAttack: EF.TRIGGERS.enemyAttack }; if (e.kind === 'deathWard') trig.destruction = EF.TRIGGERS.destruction;
  let par = '';
  if (e.kind === 'stat') par = '<div class="row3">' + spSel(p + '.params.stat', t.what === 'king' ? { atk: 'ATK' } : EF.STATS, P.stat, 'Wert', 'data-rebuild="1"') + spSel(p + '.params.mode', { add: 'verändern um', set: 'setzen auf' }, P.mode, 'Art', 'data-rebuild="1"') + spNum(p + '.params.amount', P.amount, P.mode === 'set' ? 'neuer Wert' : 'Betrag (− verringert)', 'step="' + (P.stat === 'move' ? 1 : 100) + '"') + '</div>';
  if (e.kind === 'status') par = spSel(p + '.params.status', Object.fromEntries(Object.entries(EF.STATUSES).map(([k, v]) => [k, v.name + (v.defined ? '' : ' – Regel offen')])), P.status, 'Zustand', 'data-rebuild="1"') + '<p class="muted sphelp">' + esc((EF.STATUSES[P.status] || {}).help || (EF.STATUSES[P.status] || {}).open || '') + '</p>';
  if (e.kind === 'giftBlock' || e.kind === 'giftRemove') {
    const all = P.gifts === 'all', royal = t.what === 'king', list = royal ? D.ROYAL_GIFTS : D.GIFTS;
    par = '<label class="inline"><input type="checkbox" data-spgift="' + i + ':all" ' + (all ? 'checked' : '') + '> alle Gaben</label>' + (all ? '' : '<div class="spgifts">' + list.map(g => '<label class="inline"><input type="checkbox" data-spgift="' + i + ':' + g.id + '" ' + ((P.gifts || []).includes(g.id) ? 'checked' : '') + '> ' + esc(g.name) + '</label>').join('') + '</div>');
  }
  if (e.kind === 'fieldLock') par = '<label class="inline"><input type="checkbox" data-sp="' + p + '.params.noSummon" data-t="bool" ' + (P.noSummon ? 'checked' : '') + '> Auf gesperrten Feldern kann auch nicht beschworen werden</label>';
  if (e.kind === 'control') par = '<p class="muted sphelp"><b>Umgeht Sperren:</b> Der übernommene Held kann sofort laufen und angreifen. Beschwörungssperre, Fesseln und Bewegungssperren auf ihm gelten nicht, solange er übernommen ist. Endet die Dauer, geht er an seinen Besitzer zurück; stirbt er vorher, kommt er auf den Ablagestapel seines Besitzers. Göttlicher Segen schützt davor.</p><p class="muted sphelp"><b>⚔ Sofort in der Battlephase:</b> In deiner Battlephase gewirkt, wirkt die Kontrolle sofort – noch vor den Angriffen. Der Held greift in derselben Battlephase mit an; danach hat der Gegner seine Konterphase und kann darauf reagieren, dann folgt die Schadensberechnung. <b>Bis Zugende</b> = nur dieser Angriff. <b>1–3 Runden</b> = er läuft und kämpft zusätzlich in deinen nächsten Zügen – dazwischen kann der Gegner ihn angreifen und zerstören. In der <b>Konterphase</b> auf einen gegnerischen Angreifer gewirkt, fällt dessen Angriff weg.</p>';
  if (e.kind === 'revive') par = '<div class="row2">' + spSel(p + '.params.place', { player: 'Feld wählt der Spieler', auto: 'erstes freies Beschwörungsfeld' }, P.place, 'Platzierung') + '<label class="inline" style="align-self:end"><input type="checkbox" data-sp="' + p + '.params.lock" data-t="bool" ' + (P.lock !== false ? 'checked' : '') + '> mit Beschwörungssperre</label></div><p class="muted sphelp">Kontrolle: der Wirkende. Stirbt der Held wieder, kommt er auf den Ablagestapel seines Besitzers (Abschnitt 8).</p>';
  if (e.kind === 'protect') par = spSel(p + '.params.from', { attacks: 'Angriffen', curses: 'gegnerischen Flüchen', both: 'Angriffen und gegnerischen Flüchen' }, P.from || 'attacks', 'Schützt vor', 'data-rebuild="1"') + '<p class="muted sphelp">Gilt, solange der Zauber wirkt. Wähle „Runden“: Sie zählen die Züge deines Gegners – dort greift er an und spielt Flüche.</p>';
  // 31.10.2026: Zerstören in der Konterphase – Angriff abwehren oder durchgehen lassen (steht so auf der Karte)
  if (e.kind === 'destroy' && (c.spell.timing || 'both') !== 'battle' && (t.side === 'enemy' || t.side === 'both')) par = '<label>Was passiert in deiner Konterphase mit dem gegnerischen Angriff?<select data-sp="' + p + '.params.block" data-t="boolsel" data-rebuild="1">' + spOpt(Object.assign(P.block === undefined ? { '': '– bitte festlegen (ohne Angabe: abwehren) –' } : {}, { true: '🛡 Angriff abwehren – der Angreifer kommt nicht mehr zum Angriff', false: '⚔ Angriff geht durch – der Angreifer wird erst danach zerstört' }), P.block === undefined ? '' : String(P.block)) + '</select></label><p class="muted sphelp">' + (P.block === false ? '<b>Durchgehen lassen:</b> Erst wird ganz normal gekämpft – dein Held kann dabei fallen. Danach wird der Angreifer trotzdem zerstört.' : '<b>Abwehren:</b> Der Fluch wirkt vor dem Kampf. Ein zerstörter Angreifer greift gar nicht mehr an, dein Held bekommt nichts ab.') + ' Das steht automatisch im Kartentext.</p>';
  // 31.10.2026: Kontrolle/Wiederbeleben – in der eigenen Battlephase greift der Held noch an; optional darf er vorher laufen
  if ((e.kind === 'revive' || e.kind === 'control') && (c.spell.timing || 'both') !== 'counter') par += '<label>Was darf der Held in deiner Battlephase noch tun?<select data-sp="' + p + '.params.extraMove" data-t="boolsel" data-rebuild="1">' + spOpt({ false: '⚔ Sofort angreifen', true: '👣 Erst laufen (wie auf seiner Karte), dann angreifen' }, String(!!P.extraMove)) + '</select></label><p class="muted sphelp">Der Held kann <b>immer</b> noch in derselben Battlephase angreifen – das steht automatisch auf der Karte. Mit „erst laufen“ darf er sich vorher einmal nach seiner eigenen Laufrichtung und Schrittzahl bewegen.</p>';
  if (e.kind === 'deathWard') par = spNum(p + '.params.uses', P.uses, 'Wie oft je Einheit (0 = unbegrenzt während der Dauer)', 'min="0"');
  if (e.kind === 'heal') par = '<div class="row2">' + spNum(p + '.params.amount', P.amount, 'HP', 'min="0" step="100"') + spSel(p + '.params.cap', { start: 'höchstens bis zu den Start-HP', none: 'ohne Obergrenze' }, P.cap, 'Grenze') + '</div>';
  if (e.kind === 'damage') {
    const per = P.per || 'fixed';
    par = '<div class="row2">' + spSel(p + '.params.per', { fixed: 'fester Betrag', discard: 'je Karte im Ablagestapel (Friedhof)', field: 'je Karte auf dem Spielfeld' }, per, 'Berechnung', 'data-rebuild="1"') + spNum(p + '.params.amount', P.amount, per === 'fixed' ? 'Schaden (HP)' : 'Schaden je Karte (HP)', 'min="0" step="100"') + '</div>'
      + (per === 'fixed' ? '' : '<div class="row2">' + spSel(p + '.params.from', { own: per === 'field' ? 'dein Spielfeld' : 'dein Ablagestapel', enemy: per === 'field' ? 'gegnerisches Spielfeld' : 'gegnerischer Ablagestapel', both: 'beide' }, P.from || 'own', 'Gezählt wird in') + spNum(p + '.params.max', P.max || 0, 'Höchstschaden (0 = ohne Grenze)', 'min="0" step="100"') + '</div>' + spFilterEditor(p + '.params.count', P.count).replace('Einschränken auf', 'Nur Karten zählen mit'));
  }
  if (e.kind === 'draw') par = spNum(p + '.params.n', P.n, 'Anzahl Karten (1–10)', 'min="1" max="10"');
  if (e.kind === 'maxHp' || e.kind === 'tempHp') par = spNum(p + '.params.amount', P.amount, 'HP', 'min="0" step="100"');
  const durKinds = K.lasting ? { turn: EF.DURATIONS.turn, rounds: EF.DURATIONS.rounds, permanent: EF.DURATIONS.permanent, while: EF.DURATIONS.while } : null;
  const dur = durKinds ? '<div class="row2">' + spSel(p + '.duration.kind', durKinds, e.duration.kind, 'Dauer', 'data-rebuild="1"') + (e.duration.kind === 'rounds' ? spNum(p + '.duration.n', e.duration.n, 'Runden', 'min="1"') : '<span></span>') + '</div>'
    + (e.duration.kind === 'rounds' ? '<p class="muted sphelp">„n Runden“ endet zu Beginn des n-ten folgenden eigenen Zuges des Wirkenden (wie „zwei Runden“ in Abschnitt 9).</p>' : '')
    + (e.duration.kind === 'while' ? '<div class="spsub"><span class="eyebrow">Solange gilt</span>' + spCondEditor(p + '.duration.cond', e.duration.cond || { op: 'and', items: [] }) + '</div>' : '')
    + (e.duration.kind === 'permanent' ? '<p class="muted sphelp">Permanent heißt zeitlich unbefristet; die Wirkung endet trotzdem, wenn das Ziel das Spielfeld verlässt (Abschnitt 8).</p>' : '')
    : '<p class="muted sphelp">Dauer: ' + (e.kind === 'giftRemove' ? 'dauerhaft, endet wenn die Karte das Spielfeld verlässt' : e.kind === 'status' ? 'nach den Regeln des Zustands' : 'sofort, einmalig') + '.</p>';
  const tgt = t.what === 'player' ? spSel(p + '.target.side', { own: 'du (der Wirkende)', enemy: 'dein Gegner' }, t.side, e.kind === 'draw' ? 'Wer zieht' : 'Welcher Spieler')
    : t.what === 'king' ? spSel(p + '.target.side', { own: 'eigener König', enemy: 'gegnerischer König' }, t.side, 'Welcher König') + (c.type === 'curse' || e.kind !== 'heal' ? '' : '')
    : t.what === 'card' ? '<p class="muted sphelp">Ziel: ein gegnerischer Zauber oder Fluch, der in dieser Battlephase gespielt wurde.</p>'
    : '<div class="row3">' + spSel(p + '.target.side', t.what === 'discard' ? { own: 'eigener', enemy: 'gegnerischer', both: 'beide' } : EF.SIDES, t.side, t.what === 'discard' ? 'Ablagestapel' : 'Seite')
      + spSel(p + '.target.count', { one: 'eins', n: 'Anzahl …', all: 'alle passenden' }, t.count, 'Wie viele', 'data-rebuild="1"')
      + (t.count === 'n' ? spNum(p + '.target.n', t.n, 'Anzahl', 'min="1"') : t.count === 'all' ? '<span class="muted sphelp" style="align-self:end">automatisch alle</span>' : spSel(p + '.target.pick', { player: 'Spieler wählt', auto: 'automatisch' }, t.pick, 'Auswahl')) + '</div>'
      + (t.count === 'n' ? spSel(p + '.target.pick', { player: 'Spieler wählt', auto: 'automatisch' }, t.pick, 'Auswahl') : '')
      + (t.what === 'unit' || t.what === 'discard' ? spFilterEditor(p + '.target.filter', t.filter) : '');
  // Effektart-Auswahl nach Thema gruppiert
  const groups = [['Gegen Helden', ['destroy', 'stat', 'status', 'moveBlock', 'giftBlock', 'giftRemove', 'control']], ['Gegen den König und den Spieler', ['damage', 'discard', 'mill']], ['Hilfe für deine Helden', ['protect', 'deathWard', 'revive']], ['König und Karten', ['heal', 'draw', 'maxHp', 'tempHp']], ['Spielfeld und Zauber', ['fieldLock', 'neutralize']]];
  const kindSel = '<select data-sp="' + p + '.kind" data-rebuild="1" data-kindchange="' + i + '" aria-label="Effektart">' + groups.map(([g, ks]) => '<optgroup label="' + g + '">' + ks.filter(k => kinds[k]).map(k => '<option value="' + k + '"' + (k === e.kind ? ' selected' : '') + '>' + esc(kinds[k]) + '</option>').join('') + '</optgroup>').join('') + '</select>';
  const more = (e.trigger && e.trigger !== 'play') || K.help;
  return '<div class="speffect" data-fx="' + i + '"><div class="sphead"><span class="spnum">' + (i + 1) + '</span>' + kindSel
    + '<span class="spops"><button class="ghost" data-spact="up:' + i + '" ' + (i ? '' : 'disabled') + ' aria-label="nach oben" title="nach oben">↑</button><button class="ghost" data-spact="down:' + i + '" ' + (i < n - 1 ? '' : 'disabled') + ' aria-label="nach unten" title="nach unten">↓</button><button class="ghost danger" data-spact="delfx:' + i + '" aria-label="Effekt entfernen" title="Effekt entfernen">✕</button></span></div>'
    + '<p class="spdesc">' + esc(EF.describeEffect(e, D)) + '</p>'
    + (K.defined ? '' : '<p class="spopen">⚠ ' + esc(K.open) + '</p>')
    + '<div class="sptiles">'
    + '<div class="sptile"><span class="eyebrow">🎯 Wen trifft es</span>' + (Object.keys(targets).length > 1 ? spSel(p + '.target.what', targets, t.what, 'Zielart', 'data-rebuild="1"') : '') + tgt + '</div>'
    + (par ? '<div class="sptile"><span class="eyebrow">⚖ Wie stark</span>' + par + '</div>' : '')
    + (K.lasting || e.kind === 'status' || e.kind === 'giftRemove' ? '<div class="sptile"><span class="eyebrow">⏳ Wie lange</span>' + dur + '</div>' : '') + '</div>'
    + '<details class="spmore"' + (e.trigger && e.trigger !== 'play' ? ' open' : '') + '><summary>Mehr: Auslöser' + (K.help ? ' und Erklärung' : '') + '</summary>' + spSel(p + '.trigger', trig, e.trigger || 'play', 'Auslöser', 'data-rebuild="1"') + (K.help ? '<p class="muted sphelp">' + esc(K.help) + '</p>' : '') + '</details></div>';
}
function spLiveHTML(c) {
  const st = EF.status(c, D), tc = st.text, v = st.validation;
  return '<div class="splive"><span class="eyebrow">So führt das Spiel die Karte aus</span><p class="spgen">' + esc(EF.describe(c, D) || '–') + '</p>'
    + (tc.synced ? '<p class="ok-t">✓ Regeltext und Effekte sind als übereinstimmend bestätigt' + (!(c.ruleText || '').trim() ? ' (auf der Karte steht der erzeugte Text)' : '') + '.</p>'
      : '<p class="warn-t">⚠ Regeltext und Effekte sind noch nicht abgestimmt.</p>' + (tc.hints.length ? '<ul class="sphints">' + tc.hints.map(h => '<li>' + esc(h) + '</li>').join('') + '</ul>' : '')
        + '<div class="inline"><button data-spact="syncok" ' + (v.errors.length ? 'disabled title="Erst die Fehler in den Effekten beheben"' : '') + '>Text und Effekte stimmen überein – bestätigen</button><button class="ghost" data-spact="fromfx">Erzeugten Text als Regeltext übernehmen</button></div>')
    + ((c.spell.effects || []).some(e => EF.needsOppFix(e, c.spell.timing || 'both')) ? '<div class="spfix"><b>⏳ Dauer passt nicht:</b> Diese Wirkung zählt erst im Zug deines Gegners (z. B. weniger ATK oder Schritte für Gegner, Schutz für eigene Helden). „Bis zum Ende des Zuges“ wäre dann schon vorbei. <button class="gold" data-spact="fixdur">Auf 1 Zug des Gegners setzen</button></div>' : '')
    + (v.open.length ? '<ul class="sphints open">' + v.open.map(h => '<li>Regel offen: ' + esc(h) + '</li>').join('') + '</ul>' : '')
    + '<p style="font-size:13.5px;margin-top:6px">' + (st.playable ? '<b class="ok-t">Spielbar:</b> wird vom Probe-Spiel ausgeführt.' : '<b class="bad-t">Noch nicht spielbar</b> – als Entwurf speicherbar, beim Export als „nicht spielbar“ markiert.') + '</p></div>';
}
function spAIHTML() {
  let h = '';
  if (SPX.busy) h += '<p class="muted">✦ ' + esc(SPX.busy) + ' …</p>';
  if (SPX.parse) {
    const pr = SPX.parse;
    h += '<div class="spai"><b>Vorschlag aus dem Regeltext</b>' + (pr.effects.length ? '<ol>' + pr.effects.map(e => '<li>' + esc(EF.describeEffect(e, D)) + '</li>').join('') + '</ol>' : '<p>Keine Effekte erkannt.</p>')
      + (pr.require && pr.require.items && pr.require.items.length ? '<p>Voraussetzung: ' + esc(EF.condText(pr.require, D)) + '</p>' : '')
      + (pr.missing.length ? '<p class="warn-t">Fehlt oder ist mehrdeutig:</p><ul class="sphints">' + pr.missing.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '')
      + (pr.errors.length ? '<ul class="sphints">' + pr.errors.map(m => '<li class="bad-t">' + esc(m) + '</li>').join('') + '</ul>' : '')
      + '<div class="inline"><button class="gold" data-spact="accept-parse" ' + (pr.effects.length ? '' : 'disabled') + '>Effekte übernehmen</button><button class="ghost" data-spact="dismiss">Verwerfen</button></div><p class="muted sphelp">Übernehmen ersetzt die Effekte und Voraussetzungen; Regeltext und Kartenwerte bleiben, wie sie sind.</p></div>';
  }
  if (SPX.words) {
    h += '<div class="spai"><b>Formulierungsvorschläge</b>' + SPX.words.map((w, i) => '<div class="spword"><p>' + esc(w.text) + '</p>' + (w.issues.length ? '<p class="warn-t">' + esc(w.issues.join(' ')) + '</p>' : '<p class="ok-t" style="font-size:12px">Zahlen und Begriffe geprüft: keine Änderung der Spielwirkung erkannt.</p>') + '<button data-spact="accept-word:' + i + '" ' + (w.issues.length ? 'class="ghost"' : 'class="gold"') + '>Diesen Text übernehmen</button></div>').join('')
      + '<button class="ghost" data-spact="dismiss">Verwerfen</button><p class="muted sphelp">Dein bisheriger Text bleibt erhalten, bis du einen Vorschlag übernimmst.</p></div>';
  }
  if (SPX.flavor) h += '<div class="spai"><b>Stimmungstext</b><p><i>' + esc(SPX.flavor) + '</i></p>' + (/\d/.test(SPX.flavor) ? '<p class="warn-t">Enthält eine Zahl – ein Stimmungstext sollte keine Spielwerte nennen.</p>' : '') + '<div class="inline"><button class="gold" data-spact="accept-flavor">Übernehmen</button><button class="ghost" data-spact="dismiss">Verwerfen</button></div></div>';
  return h;
}
// Schnell-Bausteine: [Beschriftung, Effektart, Änderungen]
const SP_PRESETS = {
  curse: [['Held zerstören', 'destroy', {}], ['ATK senken', 'stat', { 'params.amount': -500, 'duration.kind': 'turn' }], ['Alle Helden schwächen', 'stat', { 'target.count': 'all', 'params.amount': -300, 'duration.kind': 'turn' }], ['Vergiften', 'status', { 'params.status': 'poison' }], ['Bewegung sperren', 'moveBlock', { 'duration.kind': 'rounds', 'duration.n': 1 }], ['Gaben blockieren', 'giftBlock', { 'params.gifts': 'all', 'duration.kind': 'rounds', 'duration.n': 1 }],
    ['Schaden am König', 'damage', { 'params.amount': 1000 }], ['Schaden je Karte im Friedhof', 'damage', { 'params.amount': 300, 'params.per': 'discard', 'params.from': 'own' }], ['Schaden je gegnerischem Held', 'damage', { 'params.amount': 250, 'params.per': 'field', 'params.from': 'enemy' }], ['König schwächen (ATK)', 'stat', { 'target.what': 'king', 'target.pick': 'auto', 'params.amount': -800, 'duration.kind': 'turn' }], ['Königsgaben blockieren', 'giftBlock', { 'target.what': 'king', 'target.pick': 'auto', 'params.gifts': 'all', 'duration.kind': 'rounds', 'duration.n': 1 }],
    ['Handkarten abwerfen', 'discard', { 'params.n': 1 }], ['Stapel abtragen', 'mill', { 'params.n': 3 }], ['Felder sperren', 'fieldLock', { 'target.count': 'n', 'target.n': 2, 'duration.kind': 'rounds', 'duration.n': 1 }], ['Kontrolle übernehmen', 'control', { 'duration.kind': 'rounds', 'duration.n': 1 }], ['Alle Helden (beide Seiten) schwächen', 'stat', { 'target.side': 'both', 'target.count': 'all', 'params.amount': -400, 'duration.kind': 'turn' }]],
  spell: [['Held stärken', 'stat', { 'params.amount': 500, 'duration.kind': 'turn' }], ['Alle Helden stärken', 'stat', { 'target.count': 'all', 'params.stat': 'def', 'params.amount': 300, 'duration.kind': 'turn' }], ['Schutz bei Angriff', 'protect', { trigger: 'enemyAttack', 'duration.kind': 'turn' }], ['Vor Zerstörung bewahren', 'deathWard', {}], ['Wiederbeleben', 'revive', {}], ['König heilen', 'heal', { 'params.amount': 2000 }],
    ['Karten ziehen', 'draw', { 'params.n': 2 }], ['Schaden am gegnerischen König', 'damage', { 'params.amount': 800 }], ['Mehr Bewegung', 'stat', { 'params.stat': 'move', 'params.amount': 1, 'duration.kind': 'rounds', 'duration.n': 1 }], ['Zauber/Fluch neutralisieren', 'neutralize', {}], ['Gegnerischen Helden übernehmen', 'control', { 'duration.kind': 'rounds', 'duration.n': 1 }], ['Schutz für alle eigenen Helden', 'protect', { 'target.count': 'all', 'duration.kind': 'rounds', 'duration.n': 1 }], ['Unzerstörbar (Angriffe und Flüche)', 'protect', { 'params.from': 'both', 'duration.kind': 'rounds', 'duration.n': 1 }], ['Gegner wirft Handkarte ab', 'discard', { 'params.n': 1 }]]
};
// Schnell-Voraussetzungen (danach Rasse/Klasse/Element in der Bedingung wählen)
const SP_CONDS = [['Ich kontrolliere einen Helden einer Rasse …', { k: 'control', min: 1, filter: { op: 'and', items: [{ k: 'race', v: '' }] } }], ['Mind. 3 eigene einer Klasse auf dem Feld …', { k: 'control', min: 3, filter: { op: 'and', items: [{ k: 'class', v: '' }] } }],
  ['Mind. 3 einer Rasse im eigenen Friedhof …', { k: 'discard', side: 'own', min: 3, filter: { op: 'and', items: [{ k: 'race', v: '' }] } }], ['Gegner hat mind. 2 Helden', { k: 'enemyControl', min: 2, filter: { op: 'and', items: [] } }],
  ['Mind. 4 Helden auf dem ganzen Feld', { k: 'fieldAny', min: 4, filter: { op: 'and', items: [] } }], ['Eigener König höchstens 5.000 HP', { k: 'kingHp', side: 'own', cmp: '<=', value: 5000 }], ['Eigener Held wird angegriffen', { k: 'attacked', min: 1 }], ['Mind. 3 weitere Handkarten', { k: 'hand', min: 3 }]];
function spEff(kind, type, ch) { const e = spEff0(kind, type, ch); if (EF.needsOppFix(e, (G.card && G.card.spell && G.card.spell.timing) || 'both')) e.duration = { kind: 'rounds', n: 1 }; return e; }
function spEff0(kind, type, ch) { const e = EF.blankEffect(kind, type); for (const [p, v] of Object.entries(ch || {})) { const ks = p.split('.'); let x = e; while (ks.length > 1) x = x[ks.shift()]; x[ks[0]] = v; } return e; }
// Karte aus dem Generator übernehmen (Bild, Status, Gestaltung bleiben)
function spApplyGen(g) {
  const c = G.card; aiSnap();
  Object.assign(c, { name: g.name || c.name, subtitle: g.subtitle || '', flavor: g.flavor || '', energy: g.energy, rarity: g.rarity, ruleText: '', spell: EF.normalizeSpell(g.spell, c.type) });
  SPX.parse = SPX.words = SPX.flavor = null; spChanged(true);
}
async function spGenerate(useAI) {
  const c = G.card, GEN = window.WOK_SPELLGEN; if (!GEN) return;
  let element = null, name = '';
  const blob = c.art && c.art.id ? await ST.imageBlob(c.art.id).catch(() => null) : null;
  if (useAI && blob && await aiCan()) {
    SPX.busy = 'Die KI sieht sich das Bild an'; renderSpellPanel();
    try {
      const ans = await aiJSON(GEN.prompt(1, c.type, D), [await aiImageBlob(blob)], { tier: 'default' });
      const a = (ans && Array.isArray(ans.cards) ? ans.cards[0] : ans) || {};
      const g = GEN.fromAI(a, c.type, c.rarity || null, D);
      SPX.busy = '';
      if (g) { spApplyGen(g); toast('✦ ' + (g.name || 'Karte') + ': ' + (a.reason ? a.reason + ' – ' : '') + 'Effekt geprüft und spielbar. Gefällt nicht? „Rückgängig“ oder nochmal.', 7000); return; }
      name = String(a.name || '').slice(0, 28); toast('Der KI-Effekt war nicht regelkonform – Name übernommen, Effekt aus dem Zufall.', 6000);
    } catch (e) { SPX.busy = ''; toast(aiErrText(e) + ' Ich nehme die Offline-Variante.', 6000); }
  }
  if (blob && window.WOK_INDOOR) { try { const idn = await window.WOK_INDOOR.identify(blob, false); element = idn && idn.element; } catch (e) { } }
  const g = GEN.random({ type: c.type, rarity: c.rarity || null, element, name, D });
  SPX.busy = '';
  if (g) { spApplyGen(g); toast('🎲 ' + g.name + (element ? ' (passend zu ' + ((D.ELEMENTS.find(x => x.id === element) || {}).name || element) + ' im Bild)' : '') + '. Nochmal tippen für eine andere Variante.', 6000); }
  else { renderSpellPanel(); toast('Keine gültige Kombination gefunden – bitte nochmal.'); }
}
function renderSpellPanel() {
  const c = G.card, sc = $('#panel') ? $('#panel').scrollTop : 0, anc = panelAnchor();
  c.spell = EF.normalizeSpell(c.spell, c.type);
  const cur = c.type === 'curse', nm = cur ? 'Fluch' : 'Zauber';
  $('#panel').innerHTML = `
  <section class="sec" data-sec="status"><h3>Status <span class="chip ${c.status === 'freigegeben' ? 'rel' : 'draft'}">${c.status === 'freigegeben' ? 'Freigegeben' : 'Entwurf'}</span></h3>
    <div class="status-switch"><button class="draft ${c.status !== 'freigegeben' ? 'on' : ''}" data-status="entwurf">Entwurf</button><button class="rel ${c.status === 'freigegeben' ? 'on' : ''}" data-status="freigegeben">Freigegeben</button></div>
    <div class="issues" id="issues"></div></section>
  <section class="sec spquick" data-sec="schnell"><h3>Schnellstart</h3>
    <div class="spqbtns"><button class="gold" data-spact="gen-ai" ${c.art && c.art.id ? '' : 'disabled title="Erst eine Illustration hochladen"'}>✦ KI: Name und Effekt aus dem Bild</button><button data-spact="gen-rnd">🎲 Zufällige ${nm}karte (offline)</button>${G.undo ? '<button class="ghost" data-spact="gen-undo">↩ Rückgängig</button>' : ''}</div>
    <p class="muted" style="font-size:12px;margin:0">Erzeugt Name, Untertyp, Stimmungstext, Effekte und Energie passend zum Motiv – immer gültig und im Probe-Spiel spielbar. Ohne Internet nutzt die Werkstatt die Farbanalyse des Bildes. Energie ist ein Werkstatt-Vorschlag (für Zauber und Flüche gibt es noch kein Power-Scaling).</p></section>
  <section class="sec" data-sec="werte"><h3>Kartenart</h3>
    <div class="ctype ctype4"><button data-cardtype="hero">⚔ Held</button><button data-cardtype="king">👑 König</button><button class="${!cur ? 'on' : ''}" data-cardtype="spell">✦ Zauber</button><button class="${cur ? 'on' : ''}" data-cardtype="curse">☠ Fluch</button></div>
    <div class="row2"><label>Energiekosten (0–10)<input type="number" id="sp-energy" data-sp="energy" data-t="num" min="0" max="10" value="${c.energy === '' || c.energy == null ? '' : esc(c.energy)}"></label>
    <label>Untertyp im Banner<input type="text" data-sp="subtitle" data-t="str" maxlength="40" value="${esc(c.subtitle || '')}" placeholder="${cur ? 'z. B. Schwächungsfluch' : 'z. B. Schutzzauber'}"></label></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Seltenheit (Kopienlimit im Deck)</div>${pickerHTML('rarity', D.RARITIES, c.rarity)}</div>
    <div><div class="eyebrow" style="margin-bottom:6px">Wann spielbar</div><div class="sptiming">${Object.entries({ both: 'Battle- oder Konterphase', battle: 'Nur Battlephase', counter: 'Nur Konterphase' }).map(([k, t]) => '<button class="' + ((c.spell.timing || 'both') === k ? 'on' : '') + '" data-spact="timing:' + k + '">' + t + '</button>').join('')}</div>${(() => { const sg = EF.phaseSuggest(c.spell), cur = c.spell.timing || 'both'; if (!(c.spell.effects || []).length) return ''; const nm2 = { both: 'Battle- oder Konterphase', battle: 'Battlephase', counter: 'Konterphase' }; return '<p class="sphint" style="font-size:12.5px;margin:6px 0 0">💡 <b>Vorschlag: ' + nm2[sg.timing] + '</b> – diese Karte ' + esc(sg.why) + '.' + (sg.timing !== cur ? ' <button class="ghost" data-spact="timing:' + sg.timing + '">übernehmen</button>' : ' ✓') + '</p>'; })()}<p class="muted" style="font-size:12px;margin:5px 0 0">Auf der Karte oben rechts im Bild: Siegel <b style="color:#ff9a8a">B</b> = Battlephase, <b style="color:#9cc8ff">K</b> = Konterphase. Beide Siegel = in beiden Phasen spielbar.</p></div>
    <div><div class="eyebrow" style="margin-bottom:6px">Zusätzliche Kosten (optional)</div><div class="row2">${spNum('spell.cost.hp', c.spell.cost.hp || 0, 'Eigener König opfert HP', 'min="0" step="100"')}${spNum('spell.cost.discard', c.spell.cost.discard || 0, 'Handkarten abwerfen (zufällig)', 'min="0" max="9"')}</div><p class="muted" style="font-size:12px;margin:4px 0 0">Wird beim Ausspielen sofort bezahlt, auch wenn die Karte später neutralisiert wird. Der König darf dadurch nicht auf 0 HP fallen.</p></div>
    <p class="muted" style="font-size:12px">${nm}karten haben keine ATK, DEF, Lauf- oder Angriffsrichtungen und kein Elementwappen. Elemente, Rassen und Klassen nutzt du in Voraussetzungen und Zielen.</p></section>
  <section class="sec" data-sec="name"><h3>Name</h3>
    <input type="text" id="in-name" value="${esc(c.name || '')}" maxlength="40" aria-label="Name">
    <label>Schriftgröße für lange Namen · <span id="nsv">${c.nameScale || 100} %</span><input type="range" id="in-nscale" min="60" max="100" step="1" value="${c.nameScale || 100}"></label></section>
  <section class="sec" data-sec="bild"><h3>Illustration</h3>
    <div class="drop" id="drop">${c.art && c.art.id ? '<span>' + esc(c.art.name || 'Bild') + '</span>' : '<span>Bild hierher ziehen oder auswählen</span>'}
      <button data-act="art-pick" ${ST.state.canWrite ? '' : 'disabled'}>${c.art && c.art.id ? 'Bild ersetzen' : 'Bild auswählen'}</button></div></section>
  <section class="sec" data-sec="effekte"><h3>Effekte <span class="muted tnum" style="font-family:var(--f-ui);font-size:12px;letter-spacing:0">${c.spell.effects.length}</span></h3>
    <p class="muted" style="font-size:12.5px;margin-top:-4px">Werden in dieser Reihenfolge ausgeführt. Alle Beträge, Anzahlen und Runden sind frei einstellbar.</p>
    ${c.spell.effects.map((e, i) => spEffectHTML(c, e, i, c.spell.effects.length)).join('')}
    <div class="sppresets"><span class="eyebrow">Schnell hinzufügen</span>${SP_PRESETS[c.type].map((x, k) => '<button class="chip-btn" data-spact="preset:' + k + '">' + esc(x[0]) + '</button>').join('')}<button class="chip-btn" data-spact="addfx">+ leerer Effekt</button></div></section>
  <section class="sec" data-sec="voraussetzung"><details ${c.spell.require.items.length ? 'open' : ''}><summary><h3 style="display:inline">Voraussetzungen zum Ausspielen</h3> <span class="muted" style="font-size:12px">${c.spell.require.items.length ? c.spell.require.items.length + ' gesetzt' : 'keine – optional'}</span></summary>
    <p class="muted" style="font-size:12.5px">Muss erfüllt sein, damit die Karte gespielt werden darf (z. B. „du kontrollierst einen Krieger“). Unabhängig davon, wen die Effekte treffen.</p>
    <div class="sppresets"><span class="eyebrow">Schnell hinzufügen</span>${SP_CONDS.map((x, k) => '<button class="chip-btn" data-spact="condpreset:' + k + '">' + esc(x[0]) + '</button>').join('')}</div>
    ${spCondEditor('spell.require', c.spell.require)}</details></section>
  <section class="sec" data-sec="wirkung"><h3>Regeltext und Abgleich</h3>
    <label>Regeltext (steht auf der Karte; leer = aus den Effekten erzeugt)<textarea id="sp-rule" data-sp="ruleText" data-t="str" rows="4" placeholder="${esc(EF.describe(c, D))}">${esc(c.ruleText || '')}</textarea></label>
    <div class="inline"><button data-spact="ai-parse" ${(c.ruleText || '').trim() ? '' : 'disabled title="Erst einen Regeltext schreiben"'}>✦ Text in Effekte übersetzen</button><button data-spact="ai-word" ${(c.ruleText || '').trim() || c.spell.effects.length ? '' : 'disabled'}>✦ Mit KI formulieren</button></div>
    <div id="sp-ai">${spAIHTML()}</div>
    <div id="sp-live">${spLiveHTML(c)}</div>
    <label>Stimmungstext (optional, ohne Spielwirkung)<textarea data-sp="flavor" data-t="str" rows="2" placeholder="z. B. „Wo die Runen glühen, bricht kein Stahl.“">${esc(c.flavor || '')}</textarea></label>
    <div class="inline"><button class="ghost" data-spact="ai-flavor">✦ Stimmungstext vorschlagen</button></div></section>
  <section class="sec"><p class="muted" style="font-size:12px">${G.cardId ? 'Gespeicherte Karte' : 'Neue Karte, noch nicht gespeichert'}${G.cardId ? ' · <button class="ghost danger" data-act="delete" style="padding:2px 8px">Löschen</button> <button class="ghost" data-act="duplicate" style="padding:2px 8px">Duplizieren</button>' : ''}</p></section>`;
  restoreAnchor(anc, sc);
  if (G.focus) $$('.sec').forEach(s => s.classList.toggle('focus', s.dataset.sec === G.focus));
  bindSpellPanel(); updateIssues(); renderStagebar(); updateFloat();
}
function spRefreshLive() {
  const has = !!(G.card.ruleText || '').trim(), ap = $('[data-spact="ai-parse"]'), aw = $('[data-spact="ai-word"]');
  if (ap) { ap.disabled = !has; ap.title = has ? '' : 'Erst einen Regeltext schreiben'; }
  if (aw) aw.disabled = !(has || G.card.spell.effects.length);
  const el = $('#sp-live'); if (el) el.innerHTML = spLiveHTML(G.card); $$('.speffect').forEach(box => { const i = +box.dataset.fx, e = G.card.spell.effects[i], d = box.querySelector('.spdesc'); if (e && d) d.textContent = EF.describeEffect(e, D); }); updateIssues(); }
function spChanged(rebuild) { markDirty(); redraw(); if (rebuild) renderSpellPanel(); else spRefreshLive(); }
function bindSpellPanel() {
  const c = G.card, panel = $('#panel');
  $$('[data-cardtype]').forEach(bt => bt.onclick = () => setCardType(bt.dataset.cardtype));
  $('#in-name').oninput = e => { c.name = e.target.value; markDirty(); redraw(); };
  $('#in-nscale').oninput = e => { c.nameScale = +e.target.value; $('#nsv').textContent = c.nameScale + ' %'; markDirty(); redraw(); };
  const drop = $('#drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) uploadArt(f); };
  const val = el => el.dataset.t === 'num' ? (el.value === '' ? '' : +el.value) : el.dataset.t === 'bool' ? el.checked : el.dataset.t === 'boolsel' ? (el.value === '' ? undefined : el.value === 'true') : el.value;
  panel.oninput = e => { const el = e.target; if (!el.dataset.sp || el.tagName === 'SELECT' || el.type === 'checkbox') return; spSet(c, el.dataset.sp, val(el)); spChanged(false); };
  panel.onchange = e => {
    const el = e.target;
    if (el.dataset.spgift) {
      const [i, gid] = el.dataset.spgift.split(':'), P = c.spell.effects[+i].params;
      if (gid === 'all') P.gifts = el.checked ? 'all' : []; else { const s = new Set(Array.isArray(P.gifts) ? P.gifts : []); if (el.checked) s.add(gid); else s.delete(gid); P.gifts = [...s]; }
      spChanged(true); return;
    }
    if (!el.dataset.sp) return;
    if (el.tagName !== 'SELECT' && el.type !== 'checkbox') return; // Text und Zahlen: schon per oninput übernommen (kein Neuaufbau, sonst gehen Klicks verloren)
    if (el.dataset.kindchange !== undefined) { const i = +el.dataset.kindchange, old = c.spell.effects[i], ne = EF.blankEffect(el.value, c.type); ne.id = old.id; if (old.target && EF.KINDS[el.value].targets.includes(old.target.what)) ne.target = Object.assign(ne.target, { side: old.target.side, count: old.target.count, n: old.target.n, pick: old.target.pick, filter: old.target.filter }); c.spell.effects[i] = ne; spChanged(true); return; }
    spSet(c, el.dataset.sp, val(el));
    // abhängige Felder bereinigen
    const m = el.dataset.sp.match(/^spell\.effects\.(\d+)\.(.*)$/);
    if (m) {
      const e = c.spell.effects[+m[1]];
      if (m[2] === 'target.what') { if (e.target.what === 'king') { e.target.count = 'one'; e.target.pick = 'auto'; if (e.kind === 'stat') e.params.stat = 'atk'; } if (e.kind === 'giftBlock' || e.kind === 'giftRemove') e.params.gifts = []; }
      if (m[2] === 'target.count' && e.target.count === 'all') e.target.pick = 'auto';
      if (m[2] === 'duration.kind' && e.duration.kind === 'while' && !e.duration.cond) e.duration.cond = { op: 'and', items: [{ k: 'control', min: 1, filter: { op: 'and', items: [] } }] };
      if (m[2] === 'trigger' && e.trigger === 'enemyAttack') { e.target.side = 'own'; c.spell.timing = c.spell.timing === 'battle' ? 'counter' : c.spell.timing; }
    }
    if (/\.k$/.test(el.dataset.sp)) { const it = spPath(c, el.dataset.sp.replace(/\.k$/, '')); if (it && /filter\.items/.test(el.dataset.sp)) it.v = el.value === 'unitType' ? 'hero' : ''; if (it && !/filter\.items/.test(el.dataset.sp)) { if (['control', 'enemyControl', 'discard', 'attacked', 'fieldAny', 'hand'].includes(it.k)) { it.min = it.min || 1; it.filter = it.filter || { op: 'and', items: [] }; } if (it.k === 'kingHp') { it.side = it.side || 'own'; it.cmp = it.cmp || '<='; it.value = it.value || 5000; } } }
    if (/\.card$/.test(el.dataset.sp)) { const it = spPath(c, el.dataset.sp.replace(/\.card$/, '')), x = ST.get(el.value); if (it) it.cardName = x ? x.name : ''; }
    spChanged(true);
  };
  panel.onclick = async e => {
    const b = e.target.closest('[data-spact]'); if (!b) return;
    const [act, arg] = [b.dataset.spact.split(':')[0], b.dataset.spact.slice(b.dataset.spact.indexOf(':') + 1)];
    const fx = c.spell.effects;
    if (act === 'preset') { const pr = SP_PRESETS[c.type][+arg]; if (pr) { fx.push(spEff(pr[1], c.type, pr[2])); if (pr[2].trigger === 'enemyAttack' && c.spell.timing === 'battle') c.spell.timing = 'counter'; spChanged(true); } return; }
    if (act === 'gen-rnd') { spGenerate(false); return; }
    if (act === 'timing') { c.spell.timing = arg; spChanged(true); return; }
    if (act === 'fixdur') { const n = EF.autoFix(c.spell); toast(n + (n === 1 ? ' Dauer' : ' Dauern') + ' korrigiert: wirkt jetzt bis zum Ende des nächsten Zuges deines Gegners.'); spChanged(true); return; }
    if (act === 'condpreset') { const pr = SP_CONDS[+arg]; if (pr) { c.spell.require.items.push(JSON.parse(JSON.stringify(pr[1]))); spChanged(true); } return; }
    if (act === 'gen-ai') { spGenerate(true); return; }
    if (act === 'gen-undo') { khUndo(); return; }
    if (act === 'addfx') { fx.push(EF.blankEffect(c.type === 'curse' ? 'stat' : 'stat', c.type)); spChanged(true); }
    else if (act === 'delfx') { fx.splice(+arg, 1); spChanged(true); }
    else if (act === 'up' || act === 'down') { const i = +arg, j = act === 'up' ? i - 1 : i + 1; if (j >= 0 && j < fx.length) { [fx[i], fx[j]] = [fx[j], fx[i]]; spChanged(true); } }
    else if (act === 'del') { const ks = arg.split('.'), idx = +ks.pop(), arr = spPath(c, ks.join('.')); if (Array.isArray(arr)) arr.splice(idx, 1); spChanged(true); }
    else if (act === 'addfilter') { const f = spPath(c, arg) || (spSet(c, arg, { op: 'and', items: [] }), spPath(c, arg)); f.items.push({ k: 'race', v: '' }); spChanged(true); }
    else if (act === 'addcond') { const g = spPath(c, arg); g.items.push({ k: 'control', min: 1, filter: { op: 'and', items: [] } }); spChanged(true); }
    else if (act === 'addgroup') { const g = spPath(c, arg); g.items.push({ op: 'or', items: [{ k: 'control', min: 1, filter: { op: 'and', items: [] } }] }); spChanged(true); }
    else if (act === 'syncok') { c.spell.sync = EF.hash(c); toast('Abgleich bestätigt: Regeltext und Effekte stimmen überein.'); spChanged(true); }
    else if (act === 'fromfx') { c.ruleText = EF.describe(c, D); c.spell.sync = EF.hash(c); toast('Erzeugten Text übernommen und als abgestimmt markiert.'); spChanged(true); }
    else if (act === 'dismiss') { SPX.parse = SPX.words = SPX.flavor = null; renderSpellPanel(); }
    else if (act === 'accept-parse' && SPX.parse) { c.spell.effects = SPX.parse.effects; if (SPX.parse.require) c.spell.require = SPX.parse.require; if (SPX.parse.timing) c.spell.timing = SPX.parse.timing; SPX.parse = null; toast('Effekte übernommen. Bitte prüfen und den Abgleich bestätigen.'); spChanged(true); }
    else if (act === 'accept-word' && SPX.words) { const w = SPX.words[+arg]; if (w) { c.ruleText = w.text; SPX.words = null; toast('Formulierung übernommen. Abgleich bitte bestätigen.'); spChanged(true); } }
    else if (act === 'accept-flavor' && SPX.flavor) { c.flavor = SPX.flavor; SPX.flavor = null; spChanged(true); }
    else if (act === 'ai-parse') spAIParse();
    else if (act === 'ai-word') spAIWord();
    else if (act === 'ai-flavor') spAIFlavor();
  };
}

/* ---------- KI: Text → Effekte, Formulieren, Stimmungstext ---------- */
function spSchemaText(c) {
  const ids = l => l.map(x => x.id + '=' + x.name).join(', ');
  return 'Effektarten (kind): ' + Object.entries(EF.KINDS).map(([k, v]) => k + ' (' + v.name + '; Ziele: ' + v.targets.join('/') + ')').join('; ') + '.\n'
    + 'Ziel (target): {what: unit|king|field|discard|card, side: own|enemy|both, count: one|n|all, n: Zahl, pick: player|auto, filter: {op: and|or, items: [{k: race|class|element|unitType|attacked, v: id}]}}.\n'
    + 'Parameter (params): stat → {stat: atk|def|move, mode: add|set, amount: Zahl (negativ = verringern)}; status → {status: poison|freeze}; giftBlock/giftRemove → {gifts: [Gaben-IDs] oder "all"}; fieldLock → {noSummon: bool}; revive → {place: player|auto, lock: bool}; deathWard → {uses: Zahl}; heal → {amount, cap: start|none}; damage (nur Ziel king) → {amount, per: fixed|discard|field, from: own|enemy|both, count: {op, items: [{k: race|class|element|unitType, v}]}, max: 0}; draw (Ziel {what: player, side: own|enemy}) → {n: 1–10}.\n'
    + 'Dauer (duration): {kind: instant|turn|rounds|permanent|while, n: Runden}. Auslöser (trigger): play|enemyAttack|destruction.\n'
    + 'Voraussetzung (require): {op: and|or, items: [{k: control|enemyControl|discard|kingHp|attacked|onField, min, filter, side, cmp, value}]}.\n'
    + 'IDs: Rassen ' + ids(D.RACES) + '. Klassen ' + ids(D.CLASSES) + '. Elemente ' + ids(D.ELEMENTS) + '. Gaben ' + ids(D.GIFTS) + '. Königliche Gaben ' + ids(D.ROYAL_GIFTS || []) + '.\n'
    + 'Regeln (Auszug Master-Regelwerk): Zauber und Flüche nur in der eigenen Battlephase oder eigenen Konterphase, Auswertung gemeinsam nach der Konterphase; „zwei Runden“ endet zu Beginn des zweiten folgenden eigenen Zuges; Könige nur Ziel, wenn der Text es ausdrücklich sagt; Poison nie auf Könige.';
}
async function spAIParse() {
  const c = G.card; if (!(await aiCan())) { toast(aiErrText({ code: 'unavailable' }), 6000); return; }
  SPX.busy = 'Text wird in Effekte übersetzt'; SPX.parse = null; renderSpellPanel();
  const prompt = 'Du übersetzt den Regeltext einer ' + (c.type === 'curse' ? 'Fluchkarte' : 'Zauberkarte') + ' des Kartenspiels WAR OF KINGS in strukturierte Effektdaten.\n'
    + 'STRENG: Erfinde keine Ziele, Zahlen, Kosten, Bedingungen oder Regeln. Was im Text fehlt oder mehrdeutig ist, trägst du NICHT selbst ein, sondern listest es unter "missing" auf (deutsch, konkret). Verwende nur die IDs unten.\n'
    + spSchemaText(c) + '\n\nREGELTEXT: „' + (c.ruleText || '') + '“\n\n'
    + 'Antworte NUR mit JSON: {"effects": [ {kind, target, params, duration, trigger} ], "require": {op, items} oder null, "timing": "both"|"battle"|"counter" oder null, "missing": ["…"]}';
  try {
    const r = await aiJSON(prompt, [], { tier: 'default' });
    const effects = (Array.isArray(r && r.effects) ? r.effects : []).filter(e => e && EF.KINDS[e.kind]).map(e => { const b = EF.blankEffect(e.kind, c.type); return Object.assign(b, { target: Object.assign(b.target, e.target || {}), params: Object.assign(b.params, e.params || {}), duration: Object.assign(b.duration, e.duration || {}), trigger: e.trigger || b.trigger }); });
    effects.forEach(e => { if (!e.target.filter || !Array.isArray(e.target.filter.items)) e.target.filter = { op: 'and', items: [] }; });
    const test = Object.assign({}, c, { spell: Object.assign({}, c.spell, { effects, require: r && r.require && r.require.items ? r.require : c.spell.require }) });
    SPX.parse = { effects, require: r && r.require && r.require.items ? r.require : null, timing: r && EF.TIMINGS[r.timing] ? r.timing : null, missing: (r && Array.isArray(r.missing) ? r.missing : []).map(String), errors: EF.validate(test, D).errors };
  } catch (e) { toast(aiErrText(e), 7000); }
  SPX.busy = ''; renderSpellPanel();
}
// Prüft einen Formulierungsvorschlag gegen das Original: gleiche Zahlen, gleiche Kernbegriffe
function spWordIssues(orig, text) {
  const W2N = { zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10 };
  const nums = t => (String(t).match(/\d[\d.]*/g) || []).map(x => +x.replace(/\./g, '')).concat((String(t).toLowerCase().match(/\b(zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\b/g) || []).map(w => W2N[w])).sort((a, b) => a - b).join(',');
  const iss = [];
  if (nums(orig) !== nums(text)) iss.push('Achtung: Die Zahlen weichen vom Original ab.');
  // gegen die verbindlichen Effektdaten prüfen (gleiche Prüfung wie beim Abgleich)
  const tc = EF.textCheck(Object.assign({}, G.card, { ruleText: text }), D);
  for (const h of tc.hints) if (!iss.includes(h)) iss.push(h);
  const keys = ['Runde', 'Zug', 'König', 'Poison', 'ATK', 'DEF', 'HP', 'Energie', 'Battlephase', 'Konterphase', 'alle', 'Feld'].filter(k => new RegExp(k, 'i').test(orig) && !new RegExp(k, 'i').test(text));
  if (keys.length) iss.push('Im Vorschlag fehlt: ' + keys.join(', ') + '.');
  return iss;
}
async function spAIWord() {
  const c = G.card; if (!(await aiCan())) { toast(aiErrText({ code: 'unavailable' }), 6000); return; }
  const base = (c.ruleText || '').trim() || EF.describe(c, D);
  SPX.busy = 'Formulierungen werden geschrieben'; SPX.words = null; renderSpellPanel();
  const prompt = 'Formuliere den Regeltext einer ' + (c.type === 'curse' ? 'Fluchkarte' : 'Zauberkarte') + ' für das Fantasy-Kartenspiel WAR OF KINGS klarer, atmosphärischer und hochwertiger, im Stil guter Fantasy-Sammelkarten.\n'
    + 'ZWINGEND: Alle Zahlenwerte, Ziele, Zielanzahlen, Dauer, Auslöser, Voraussetzungen und Einschränkungen bleiben exakt gleich. Keine zusätzlichen Wirkungen, Kosten oder Regeln. Regelbegriffe korrekt verwenden (Runde, Zug, Battlephase, Konterphase, ATK, DEF, HP, Poison, König, Held, Einheit). Der Text muss eindeutig spielbar bleiben. Höchstens 2 Sätze mehr als das Original.\n'
    + 'Die verbindliche Wirkung laut Effektdaten: „' + EF.describe(c, D) + '“\n'
    + 'ORIGINALTEXT: „' + base + '“\n\nAntworte NUR mit JSON: {"vorschlaege": ["Text 1", "Text 2", "Text 3"]}';
  try {
    const r = await aiJSON(prompt, [], { tier: 'default' });
    const list = (r && Array.isArray(r.vorschlaege) ? r.vorschlaege : []).map(String).filter(Boolean).slice(0, 3);
    SPX.words = list.map(t => ({ text: t, issues: spWordIssues(base, t) }));
  } catch (e) { toast(aiErrText(e), 7000); }
  SPX.busy = ''; renderSpellPanel();
}
async function spAIFlavor() {
  const c = G.card; if (!(await aiCan())) { toast(aiErrText({ code: 'unavailable' }), 6000); return; }
  SPX.busy = 'Stimmungstext wird geschrieben'; SPX.flavor = null; renderSpellPanel();
  const prompt = 'Schreibe einen kurzen atmosphärischen Stimmungstext (ein Satz, höchstens 16 Wörter, deutsch) für die ' + (c.type === 'curse' ? 'Fluchkarte' : 'Zauberkarte') + ' „' + (c.name || '') + '“ (' + (c.subtitle || '') + ') im Fantasy-Kartenspiel WAR OF KINGS. Kein Regeltext, keine Zahlen, keine Spielwirkung. Wirkung zur Orientierung: ' + EF.describe(c, D) + '\nAntworte NUR mit JSON: {"text": "…"}';
  try { const r = await aiJSON(prompt, [], { tier: 'quick' }); SPX.flavor = r && r.text ? String(r.text).trim() : null; } catch (e) { toast(aiErrText(e), 7000); }
  SPX.busy = ''; renderSpellPanel();
}

/* ---------- Prüfung für die Werkstatt-Liste ---------- */
function spellValidate(card, rIssues) {
  const out = [], add = (level, text, sec) => out.push({ level, text, sec });
  if (!card.name) add('error', 'Name fehlt.', 'name');
  if (!card.rarity) add('error', 'Seltenheit fehlt.', 'werte');
  if (!(card.art && card.art.id)) add('error', 'Illustration fehlt.', 'bild');
  const st = EF.status(card, D);
  for (const e of st.validation.errors) add('error', e, /Voraussetzung/.test(e) ? 'voraussetzung' : /Energie/.test(e) ? 'werte' : 'effekte');
  for (const e of st.validation.open) add('error', 'Regel offen – ' + e, 'effekte');
  for (const w of st.validation.warnings) add('warn', w, 'effekte');
  if (!st.text.synced) add('warn', 'Regeltext und Effekte sind nicht als übereinstimmend bestätigt. Die Karte wird als „nicht spielbar“ exportiert.', 'wirkung');
  for (const h of st.text.hints) if (!st.text.synced) add('info', h, 'wirkung');
  const seen = new Set();
  for (const r of rIssues || []) {
    const k = r.code + (r.info || ''); if (seen.has(k)) continue; seen.add(k);
    if (r.code === 'nameOverflow') add('error', 'Der Name ist zu lang für das Namensbanner.', 'name');
    if (r.code === 'bannerOverflow') add('error', 'Der Untertyp passt nicht ins Banner.', 'werte');
    if (r.code === 'giftOverflow') add('error', 'Der Regeltext passt nicht ins Wirkungsfeld. Bitte kürzen.', 'wirkung');
    if (r.code === 'giftSmall') add('warn', 'Der Regeltext wird sehr klein und ist im Druck schwer lesbar.', 'wirkung');
  }
  add('info', (card.type === 'curse' ? 'Fluchkarte' : 'Zauberkarte') + ': Auswertung im Spiel gemeinsam nach der Konterphase (Abschnitt 8). Kein Power-Scaling für diese Kartenart.', 'status');
  return out;
}
