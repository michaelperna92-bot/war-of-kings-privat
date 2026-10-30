/* WAR OF KINGS – Spielhilfe: findet Möglichkeiten, die der Spieler in der aktuellen Phase übersehen hat.
 * Nur Hinweise, keine Züge. Nutzt die Engine (legal) und die Bewertungen der KI.
 */
(function (root) {
  'use strict';
  const W = root.WOK || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const AI = root.WOK_AI || (typeof require !== 'undefined' ? require('./ai.js') : null);
  const nm = (s, u) => s.cards[u.cid].name;
  const fmt = n => Number(n).toLocaleString('de-DE');
  // Liefert [{ text, uid?, kind: 'chance'|'warn' }]
  function missed(s, p) {
    const out = [], P = s.players[p];
    if (s.result || s.pendingDiscard !== null) return out;
    if (s.phase === 'counter') { if (s.counter === p) spellHint(s, p, out, true); return out; }
    if (s.active !== p) return out;
    const mine = Object.values(s.units).filter(u => u.owner === p);
    if (s.phase === 'summon1' || s.phase === 'summon2') {
      const can = P.hand.filter(h => W.summonOptions(s, h.iid).length);
      const lastCard = !P.deck.length && P.hand.length <= 1;
      if (can.length && !lastCard) {
        const rush = can.filter(h => s.cards[h.cid].gifts.some(g => g.id === 'ansturm'));
        if (s.phase === 'summon1' && rush.length) out.push({ kind: 'chance', iid: rush[0].iid, text: '„' + s.cards[rush[0].cid].name + '“ hat Ansturm: jetzt beschworen kann die Karte in diesem Zug schon laufen und angreifen.' });
        if (s.phase === 'summon2') out.push({ kind: 'chance', iid: can[0].iid, text: 'Du hast noch ' + P.energy + ' Energie und könntest ' + can.slice(0, 3).map(h => '„' + s.cards[h.cid].name + '“').join(', ') + (can.length > 3 ? ' oder weitere' : '') + ' beschwören. Unverbrauchte Energie verfällt am Zugende.' });
      }
    }
    if (s.phase === 'move') {
      const tm = AI.threatMap(s, p);
      for (const u of mine) {
        if (u.king) continue;
        const r = W.reachable(s, u.uid), fields = Object.keys(r); if (!fields.length) continue;
        const best = bestFrom(s, u, u.pos);
        let alt = null;
        for (const f of fields) { const b = bestFrom(s, u, f); if (b && (!alt || b.score > alt.score)) alt = Object.assign({ f }, b); }
        if (alt && (!best || alt.score > best.score + 0.5)) out.push({ kind: 'chance', uid: u.uid, field: alt.f, text: '„' + nm(s, u) + '“ könnte nach ' + alt.f + ' laufen und dort ' + alt.text + '.' });
        else if (AI.danger(s, u, u.pos, tm) > 0) {
          const safe = fields.find(f => AI.danger(s, u, f, tm) === 0);
          if (safe) out.push({ kind: 'warn', uid: u.uid, field: safe, text: '„' + nm(s, u) + '“ steht in Gefahr: ein Gegner könnte die Karte im nächsten Zug besiegen. Auf ' + safe + ' wäre sie sicher.' });
        }
      }
    }
    if (s.phase === 'battle') {
      const tm = AI.threatMap(s, p);
      for (const u of mine) {
        // Gaben, die sich jetzt lohnen
        if (!u.king) for (const o of W.giftOptions(s, u.uid)) {
          if (!o.ok) continue;
          if (o.id === 'fesseln') { const t = o.targets.map(x => s.units[x]).find(x => !W.bound(x) && !W.has(s, x, 'goettlicher_segen') && reachesKing(s, x)); if (t) out.push({ kind: 'chance', uid: u.uid, text: '„' + nm(s, u) + '“ kann Fesseln einsetzen: „' + nm(s, t) + '“ könnte sonst im nächsten Zug deinen König angreifen.' }); continue; }
          const a = AI.giftChoice(s, u, o, tm, 'mittel'); if (!a) continue;
          const t = a.target && s.units[a.target];
          const why = { mordlust: 'die +500 ATK entscheiden einen Kampf für dich', entwaffnen: '−500 DEF beim Ziel „' + (t ? nm(s, t) : '') + '“ lassen deinen Angriff gewinnen', eisenpanzer: 'die Karte steht in Gefahr, +300 DEF schützen sie', heilung: '„' + (t ? nm(s, t) : '') + '“ hat einen negativen Effekt oder Gift', fesseln: '„' + (t ? nm(s, t) : '') + '“ kommt deinem König gefährlich nahe', durchbruch: 'damit erreicht sie einen Helden 2 Felder entfernt und besiegt ihn', blitzschritt: 'mit einem Feld mehr erreicht sie ein lohnendes Ziel (' + (a.target || '') + ')', rueckzug: 'nach dem Kampf zieht sie aus der Gefahr zurück' }[o.id];
          out.push({ kind: 'chance', uid: u.uid, text: '„' + nm(s, u) + '“ kann ' + o.name + ' einsetzen: ' + (why || 'die Gabe ist bereit') + '.' });
        }
        if (!W.canAttack(s, u.uid)) continue;
        const tg = W.attackTargets(s, u.uid);
        const d = s.decl[u.uid];
        if (d) {
          for (const t of d.targets) { const pv = W.preview(s, u.uid, t); if (pv.kind === 'lose') out.push({ kind: 'warn', uid: u.uid, text: 'Achtung: „' + nm(s, u) + '“ (' + pv.atk + ') verliert gegen „' + nm(s, s.units[t]) + '“ (' + pv.def + ') und fällt.' }); }
          continue;
        }
        const k = tg.find(t => s.units[t].king);
        if (k) { const dbl = W.has(s, u, 'doppelschlag') && !u.king ? 2 : 1; out.push({ kind: 'chance', uid: u.uid, text: '„' + nm(s, u) + '“ kann den gegnerischen König angreifen (−' + fmt(W.atkOf(s, u) * dbl) + ' HP).' }); continue; }
        const win = tg.filter(t => W.preview(s, u.uid, t).kind === 'win');
        if (win.length) out.push({ kind: 'chance', uid: u.uid, text: (u.king ? 'Dein König' : '„' + nm(s, u) + '“') + ' kann „' + nm(s, s.units[win[0]]) + '“ besiegen' + (win.length > 1 ? ' (oder ' + (win.length - 1) + ' weitere)' : '') + ' und überlebt.' });
      }
    }
    if (s.phase === 'battle') spellHint(s, p, out, false);
    return out.slice(0, 6);
  }
  // Zauber/Flüche, die sich jetzt lohnen würden (Bewertung wie die KI: Rest der Battlephase durchrechnen)
  function spellHint(s, p, out, counter) {
    if (!AI.spellChoice) return;
    const a = AI.spellChoice(s, p, 'mittel', { done: {}, seed: 1, turn: s.turn });
    if (!a) { if (counter && !(s.stack || []).some(x => x.p === p)) { const at = Object.values(s.units).filter(u => u.owner === p && Object.values(s.decl).some(d => d.targets.includes(u.uid))); if (at.length) out.push({ kind: 'warn', text: 'Konterphase: ' + at.length + ' deiner Karten ' + (at.length === 1 ? 'wird' : 'werden') + ' angegriffen. Prüfe, ob ein Zauber oder Fluch hilft, sonst „Passen“.' }); } return; }
    const c = s.cards[s.players[p].hand.find(h => h.iid === a.iid).cid];
    out.push({ kind: 'chance', iid: a.iid, text: (counter ? 'Konterphase: ' : '') + '„' + c.name + '“ (' + (c.type === 'curse' ? 'Fluch' : 'Zauber') + ', ' + c.energy + ' Energie) würde dir jetzt helfen: ' + c.ruleText });
  }
  // Kann der gegnerische Held im nächsten Zug (nach dem Laufen) den König angreifen?
  function reachesKing(s, e) {
    const t = W.clone(s); t.active = e.owner; t.phase = 'move'; t.turn = s.turn + 1; const tu = t.units[e.uid]; tu.moved = false; tu.flags = {};
    const k = W.kingOf(s, 1 - e.owner).uid;
    if (W.targetsOf(t, e.uid).some(x => x.uid === k)) return false; // greift ohnehin schon an, Fesseln hilft nicht
    for (const f of Object.keys(W.reachable(t, e.uid))) { tu.pos = f; if (W.targetsOf(t, e.uid).some(x => x.uid === k)) return true; }
    return false;
  }
  // Bestes Angriffsziel einer Karte, wenn sie auf Feld f stünde
  function bestFrom(s, u, f) {
    const t = W.clone(s); const tu = t.units[u.uid]; tu.pos = f; t.phase = 'battle'; tu.summonTurn = -1;
    let best = null;
    for (const x of W.targetsOf(t, u.uid)) {
      const pv = W.preview(t, u.uid, x.uid), tg = t.units[x.uid];
      let r = null;
      if (pv.kind === 'king') r = { score: 5 + pv.dmg / 1000, text: 'den gegnerischen König angreifen (−' + fmt(pv.dmg) + ' HP)' };
      else if (pv.kind === 'win') r = { score: 2 + AI.value(t, tg), text: '„' + t.cards[tg.cid].name + '“ besiegen' };
      if (r && (!best || r.score > best.score)) best = r;
    }
    return best;
  }
  const api = { missed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.WOK_ADVISOR = api;
})(typeof window !== 'undefined' ? window : globalThis);
