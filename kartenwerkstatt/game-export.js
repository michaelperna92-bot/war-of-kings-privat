/* War of Kings Kartenwerkstatt – Export fürs Probe-Spiel (Ergänzung, ändert keine bestehende Funktion).
 * Erzeugt ein Spielpaket (.wokspiel = ZIP ohne Kompression):
 *   spielpaket.json        Format, Version, alle Karten mit Spielwerten im Werkstatt-Format, Prüfergebnis
 *   karten/<id>.webp       fertig gezeichnete Karte, exakt wie in der Werkstatt (Layout, Wappen, Vorlagen, Schriften)
 *   figuren/<id>.webp      Bildfenster der Karte als Spielfigur
 * PC: landet zusätzlich in „Dokumente\War of Kings Spielpakete“, dort holt das Probe-Spiel es automatisch ab.
 */
const GX_FORMAT = 'wok-spielpaket', GX_VERSION = 1;
function gxScopes() { const s = libDlScopes(), all = ST.list(); return Object.assign({ aktuell: G.cardId && ST.get(G.cardId) ? [ST.get(G.cardId)] : [], starter: all.filter(c => c.pool === 'starter'), packs: all.filter(c => c.pool === 'pack') }, s); }
// Prüft das Starter-Set: höchstens 50 Karten (Kopien zählen mit), mindestens ein König und genug für ein 40er-Deck
function gxStarterCheck(list) {
  const total = list.reduce((a, c) => a + (+c.starterCount || 1), 0), kings = list.filter(c => c.type === 'king').length;
  const rest = list.filter(c => c.type !== 'king').reduce((a, c) => a + (+c.starterCount || 1), 0), err = [], warn = [];
  if (total > STARTER_MAX) err.push('Das Starter-Set hat ' + total + ' Karten – höchstens ' + STARTER_MAX + ' erlaubt. Nimm ' + (total - STARTER_MAX) + ' heraus (z. B. „📦 In die Packs“).');
  if (!kings) warn.push('Kein König im Starter-Set – damit kann niemand ein Deck bauen.');
  if (rest < 39) warn.push('Nur ' + rest + ' Karten außer dem König – für ein Deck braucht man 39.');
  if (total < STARTER_MAX && !err.length) warn.push('Noch ' + (STARTER_MAX - total) + ' Plätze frei (' + total + ' / ' + STARTER_MAX + ').');
  return { total, err, warn };
}
function gxPool(raw) { return raw.pool === 'starter' ? { pool: 'starter', starterCount: Math.max(1, +raw.starterCount || 1) } : raw.pool === 'pack' ? { pool: 'pack' } : {}; }
function gameExportDialog() {
  G.menu = false; if ($('#menu')) $('#menu').hidden = true;
  const sc = gxScopes(), p = G.gx || (G.gx = { scope: sc.freigegeben.length ? 'freigegeben' : 'alle' });
  if (!sc[p.scope] || !sc[p.scope].length) p.scope = 'alle';
  const opt = (k, t, n) => '<label class="inline"><input type="radio" name="gx-scope" value="' + k + '" ' + (p.scope === k ? 'checked' : '') + ' ' + (n ? '' : 'disabled') + '> ' + t + ' <span class="muted">(' + n + ')</span></label>';
  showModal('Fürs Probe-Spiel exportieren', `<p style="font-size:13.5px">Erstellt ein <b>Spielpaket</b> mit allen Spielwerten und den fertig gezeichneten Karten im vollen Werkstatt-Design. Im Probe-Spiel unter „Karten &amp; Decks → Spielpaket laden“ einlesen.${window.WOK_DESKTOP ? ' Am PC wird es außerdem in „Dokumente\\War of Kings Spielpakete“ abgelegt; ein geöffnetes Probe-Spiel bietet es dann von selbst an.' : ''}</p>
    <div style="display:grid;gap:6px">${opt('freigegeben', 'Nur freigegebene (fertige) Karten', sc.freigegeben.length)}${opt('alle', 'Alle Karten', sc.alle.length)}${opt('filter', 'Wie in der Bibliothek gefiltert', sc.filter.length)}${sc.ordner.length ? opt('ordner', 'Ordner „' + esc(G.filters.folder) + '“', sc.ordner.length) : ''}${opt('auswahl', 'Nur die ausgewählten Karten', sc.auswahl.length)}${opt('aktuell', 'Nur die geöffnete Karte', sc.aktuell.length)}</div>
    <p class="eyebrow" style="margin:12px 0 4px">Für die Verteilung im Spiel</p>
    <div style="display:grid;gap:6px">${opt('starter', '🎁 Starter-Set (für jeden Spieler gleich) · ' + starterTotal() + ' / ' + STARTER_MAX + ' Karten', sc.starter.length)}${opt('packs', '📦 Pack-Karten (nur aus Packs erhältlich)', sc.packs.length)}</div>
    <p class="muted" style="font-size:12.5px">Das Probe-Spiel übernimmt Starter-Set und Packs genau so. Was nicht mehr drin ist, fliegt dort heraus. Eine Karte aus dem Starter in die Packs schieben: markieren → „📦 In die Packs“ → beide neu exportieren.</p>
    <p class="muted" style="font-size:13px">Decks stellst du im Probe-Spiel zusammen. Karten mit Fehlern werden mitgeliefert und dort markiert.</p>
    <p id="gx-status" style="font-size:13px"></p>`,
    '<button data-act="close">Schließen</button><button class="gold" data-act="gx-go" id="gx-go">Spielpaket erstellen</button>');
}
async function gameExportRun() {
  if (G.gxBusy) return;
  const p = G.gx; p.scope = ($('input[name=gx-scope]:checked') || {}).value || p.scope;
  const list = gxScopes()[p.scope] || [], st = $('#gx-status');
  if (!list.length) { st.textContent = 'Keine Karten in dieser Auswahl.'; return; }
  const kind = p.scope === 'starter' ? 'starter' : p.scope === 'packs' ? 'packs' : 'test';
  if (kind === 'starter') { const ck = gxStarterCheck(list); if (ck.err.length) { st.innerHTML = '<b style="color:#e66">' + esc(ck.err.join(' ')) + '</b>'; return; } if (ck.warn.length) toast('Hinweis: ' + ck.warn.join(' '), 7000); }
  G.gxBusy = true; const go = $('#gx-go'); if (go) go.disabled = true;
  const webp = cv => new Promise(r => cv.toBlob(b => r(b), 'image/webp', 0.9)).then(b => b && b.type === 'image/webp' ? b : new Promise(r => cv.toBlob(r, 'image/png')));
  const ext = b => b.type === 'image/webp' ? '.webp' : '.png';
  const files = [], cards = [], enc = new TextEncoder(), used = new Set();
  let failed = 0;
  try {
    for (let i = 0; i < list.length; i++) {
      const raw = list[i]; st.textContent = 'Karte ' + (i + 1) + ' von ' + list.length + ': ' + (raw.name || 'Ohne Namen') + ' …';
      try {
        const card = normalize(clone(raw)), L = G.layout, k = 0.75;
        let id = String(raw.id || ('karte_' + i)).replace(/[^\w-]/g, '_'); while (used.has(id)) id += '_'; used.add(id);
        const cv = document.createElement('canvas'); cv.width = Math.round(L.W * k); cv.height = Math.round(L.H * k);
        const issues = await renderTo(cv, card, { placeholder: false, watermark: false });
        const full = await webp(cv), fullPath = 'karten/' + id + ext(full);
        files.push({ name: fullPath, data: new Uint8Array(await full.arrayBuffer()) });
        let tokPath = '';
        if (card.art && card.art.id) {
          const Wn = isSpellCard(card) ? R.SPELL_L.window : L.window, side = Math.min(Wn.w, Wn.h), rect = { x: Wn.x + (Wn.w - side) / 2, y: Wn.y + (Wn.h - side) / 2, w: side, h: side };
          const tok = await webp(cropCanvas(cv, rect, k)); tokPath = 'figuren/' + id + ext(tok);
          files.push({ name: tokPath, data: new Uint8Array(await tok.arrayBuffer()) });
        }
        const v = validate(card, issues);
        if (isSpellCard(card)) {
          const out = clone(card); delete out.art; delete out.giftDetails; delete out.attack; delete out.move; delete out.gifts; delete out.style;
          const sst = window.WOK_EFFECTS.status(card, D);
          cards.push(Object.assign(out, gxPool(raw), { id: raw.id || id, image: fullPath, token: tokPath, spellFormat: window.WOK_EFFECTS.FORMAT, spellVersion: window.WOK_EFFECTS.VERSION, ruleTextShown: card.ruleText && card.ruleText.trim() ? card.ruleText : window.WOK_EFFECTS.describe(card, D),
            playable: sst.playable, notPlayableReasons: sst.reasons,
            validation: { errors: v.filter(x => x.level === 'error').map(x => x.text), warnings: v.filter(x => x.level === 'warn').map(x => x.text) } }));
          await new Promise(r => setTimeout(r, 0)); continue;
        }
        const ev = PW.evaluate(Object.assign({}, card, { rarity: null }));
        const out = clone(card); delete out.art; delete out.giftDetails;
        cards.push(Object.assign(out, gxPool(raw), { id: raw.id || id, image: fullPath, token: tokPath, power: { total: ev.total, rarity: ev.rarity, version: PW.SOURCE },
          giftDetails: (card.gifts || []).map(s => { const g = D.GIFTS.concat(D.ROYAL_GIFTS || []).find(x => x.id === s.id); return g ? { id: g.id, name: g.name, kind: g.kind, ct: g.ct || 0, text: D.giftText(g, g.royal ? s : undefined) } : { id: s.id }; }),
          validation: { errors: v.filter(x => x.level === 'error').map(x => x.text), warnings: v.filter(x => x.level === 'warn').map(x => x.text) } }));
      } catch (e) { failed++; }
      await new Promise(r => setTimeout(r, 0));
    }
    const doc = { format: GX_FORMAT, version: GX_VERSION, kind, created: new Date().toISOString(), source: 'War of Kings Kartenwerkstatt' + (window.WOK_APPVER ? ' ' + window.WOK_APPVER : ''), data: D.SOURCE, cards };
    files.unshift({ name: 'spielpaket.json', data: enc.encode(JSON.stringify(doc, null, 1)) });
    const zip = makeZip(files), nw = new Date(), z = n => String(n).padStart(2, '0');
    const name = (kind === 'starter' ? 'WoK_Starter_' : kind === 'packs' ? 'WoK_Packs_' : 'WoK_Spielpaket_') + nw.getFullYear() + '-' + z(nw.getMonth() + 1) + '-' + z(nw.getDate()) + '_' + z(nw.getHours()) + '-' + z(nw.getMinutes()) + '.wokspiel';
    const mb = (zip.size / 1048576).toFixed(1).replace('.', ',') + ' MB';
    if (window.WOK_DESKTOP) {
      try {
        const r = await fetch('/api/spielpaket?name=' + encodeURIComponent(name), { method: 'POST', body: zip });
        if (!r.ok) throw new Error(r.status);
        st.textContent = cards.length + ' Karten (' + mb + ') liegen in „Dokumente\\War of Kings Spielpakete“. Ein geöffnetes Probe-Spiel bietet das Paket jetzt an.' + (failed ? ' ' + failed + ' Karte(n) fehlgeschlagen.' : '');
        toast('Spielpaket ans Probe-Spiel übergeben.', 6000); return;
      } catch (e) { /* weiter über normales Speichern */ }
    }
    // Cloud: Downloads erlauben nur bekannte Endungen, darum als .zip (das Probe-Spiel liest beides)
    const saved = await saveFile(window.WOK_DESKTOP ? name : name.replace(/\.wokspiel$/, '.zip'), zip);
    st.textContent = saved ? 'Spielpaket mit ' + cards.length + ' Karten gespeichert (' + mb + ').' + (failed ? ' ' + failed + ' Karte(n) fehlgeschlagen.' : '') + ' Im Probe-Spiel unter „Spielpaket laden“ die Datei wählen.' : 'Nicht gespeichert.';
  } finally { G.gxBusy = false; const b = $('#gx-go'); if (b) b.disabled = false; }
}
