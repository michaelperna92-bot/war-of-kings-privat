'use strict';
/* ================= AI-Modus: viele Illustrationen → fertige Kartenentwürfe =================
 * Claude sieht sich die Bilder an und schlägt Name, Element, Rasse und Klasse vor.
 * Werte, Richtungen, Gaben, Energie und Seltenheit würfelt der Generator nach dem Power-Scaling.
 */
const AIM = { queue: [], cur: null, fix: (() => { try { return Object.assign({ element: '', element2: '', race: '', race2: '', class1: '', class2: '' }, JSON.parse(localStorage.getItem('wok-ai-fix') || '{}')); } catch (e) { return { element: '', element2: '', race: '', race2: '', class1: '', class2: '' }; } })(), files: [], rarity: 'gemischt', useAI: true, indoor: true, season1: false, keepStyle: false, running: false, ctl: null, results: [], sample: null, limits: null, log: '' };

async function aiAvailability() {
  if (AIM.sample && AIM.limits) return AIM.sample;
  try {
    if (!(window.claude && window.claude.use)) return null;
    const s = await window.claude.use('sample'); if (!s) return null;
    const lim = await s.limits().catch(() => null);
    if (!lim || !lim.images) return null;
    AIM.sample = s; AIM.limits = lim; return s;
  } catch (e) { return null; }
}
/* ---------- Gemeinsame KI-Schicht ----------
 * Cloud/Handy: Claude über die Seite (nutzt dein Claude-Abo, keine Extrakosten; schnellstes Modell für Namen).
 * Windows: die in „KI-Verbindung“ gewählte Verbindung (Ollama lokal, Gemini, ChatGPT-API, Claude-API).
 */
const AIX = { desk: undefined };
const PROVIDER_NAMES = { ollama: 'Ollama (lokal)', gemini: 'Google Gemini', openai: 'ChatGPT (OpenAI-API)', anthropic: 'Claude-API' };
async function desktopAI(force) {
  if (!window.WOK_DESKTOP) return null;
  if (AIX.desk !== undefined && !force) return AIX.desk;
  try {
    const j = await (await fetch('/api/ai/config')).json();
    AIX.desk = j.provider && j.provider !== 'aus' && (j.provider === 'ollama' || (j.hasKey || {})[j.provider]) ? j : null;
  } catch (e) { AIX.desk = null; }
  return AIX.desk;
}
async function aiCan() { return !!(await desktopAI()) || !!(await aiAvailability()); }
async function aiLabel() { const d = await desktopAI(); if (d) return PROVIDER_NAMES[d.provider]; return (await aiAvailability()) ? 'Claude' : null; }
function parseJSONText(t) {
  t = String(t || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(t); } catch (e) {}
  const a = t.search(/[\[{]/); if (a < 0) return undefined;
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  try { return JSON.parse(t.slice(a, end + 1)); } catch (e) { return undefined; }
}
function blobB64(b) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(b); }); }
async function aiJSON(prompt, blobs, opts) {
  opts = opts || {};
  const dk = await desktopAI();
  if (dk) {
    const images = []; for (const b of blobs || []) images.push({ mime: b.type || 'image/jpeg', data: await blobB64(b) });
    let r;
    try { r = await fetch('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, images }), signal: opts.signal }); }
    catch (e) { if (e && e.name === 'AbortError') throw { code: 'cancelled' }; throw { code: 'offline' }; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { code: j.code || 'error', message: j.message || '' };
    const v = parseJSONText(j.text); if (v === undefined) throw { code: 'bad_answer', message: 'Die KI hat kein gültiges JSON geliefert.' };
    return v;
  }
  if (await aiAvailability()) return await AIM.sample.json(prompt, { images: blobs, signal: opts.signal, modelTier: opts.tier || 'default' });
  throw { code: 'unavailable' };
}
function aiErrText(e) {
  const c = e && e.code;
  return ({ not_granted: 'Claude wurde nicht erlaubt.', rate_limited: 'Die KI ist gerade ausgelastet oder das Tageskontingent ist aufgebraucht.', refused: 'Die KI hat das Bild abgelehnt.',
    offline: (e && e.message && /11434|Ollama/.test(e.message)) ? 'Ollama läuft gerade nicht auf diesem PC (Ollama-Programm starten).' : 'Keine Internetverbindung oder der Dienst ist gerade nicht erreichbar.', auth: 'Der API-Schlüssel wurde abgelehnt.', no_key: 'Für die KI-Verbindung fehlt der API-Schlüssel.',
    no_model: (e && e.message) || 'Das Modell wurde nicht gefunden.', timeout: 'Die KI hat zu lange gebraucht.', bad_answer: 'Die Antwort der KI war unbrauchbar.', unavailable: 'Keine KI-Verbindung verfügbar.' }[c])
    || ('KI-Fehler' + (e && e.message ? ': ' + String(e.message).slice(0, 140) : '.'));
}

// kleiner Knopf unten rechts, solange der AI-Modus im Hintergrund arbeitet
function aiBgChip() {
  let c = document.getElementById('ai-bg'); const el = document.getElementById('aimode');
  const show = (AIM.running || AIM.queue.length || AIM.results.length) && (!el || el.hidden);
  if (!show) { if (c) c.remove(); return; }
  if (!c) { c = document.createElement('button'); c.id = 'ai-bg'; c.className = 'ai-bg'; c.onclick = () => openAI(); document.body.appendChild(c); }
  const done = AIM.results.filter(r => r.status === 'fertig').length, all = AIM.results.length;
  c.textContent = (AIM.running ? '✦ AI-Modus läuft · ' : '✦ AI-Modus fertig · ') + done + ' / ' + all + (AIM.queue.length ? ' · ' + AIM.queue.length + ' warten' : '') + ' – öffnen';
}
function openAI() {
  const ex = document.getElementById('aimode');
  if (!AIM.running && !AIM.queue.length && !(ex && !ex.hidden)) AIM.typeChosen = false;
  if (ex) { ex.hidden = false; document.body.classList.add('noscroll'); renderAI(); aiBgChip(); return; }
  const el = document.createElement('div'); el.className = 'aimode'; el.id = 'aimode';
  document.body.appendChild(el); document.body.classList.add('noscroll');
  renderAI();
  Promise.all([aiCan(), aiLabel()]).then(([can, lab]) => { AIM.canAI = can; AIM.aiName = lab; renderAI(); });
}
function closeAI() {
  const el = document.getElementById('aimode');
  if (AIM.running || AIM.queue.length) { if (el) el.hidden = true; document.body.classList.remove('noscroll'); aiBgChip(); toast('AI-Modus läuft im Hintergrund weiter. Unten rechts kommst du zurück.', 5000); return; }
  if (el) el.remove(); document.body.classList.remove('noscroll'); aiBgChip();
  for (const f of AIM.files) if (f.url) URL.revokeObjectURL(f.url);
  AIM.files = []; AIM.results = [];
}
// Grenzen und Gabenlimit kommen direkt aus dem Power-Scaling (aktuell System 2.0)
const RARITY_OPTS = [['gemischt', 'Gemischt', '64 % · 24 % · 10 % · 2 %']].concat(PW.BANDS.map((b, i) => {
  const nx = PW.BANDS[i + 1], g = PW.GIFT_LIMIT[b.id];
  return [b.id, PW.rarityName(b.id), (nx ? b.lo + '–' + (nx.above ? nx.lo : nx.lo - 1) + ' Punkte' : PW.bandFrom(b) + ' Punkte') + ' · bis ' + g + (g === 1 ? ' Gabe' : ' Gaben')];
}));
const AI_FIX = [['element', 'Element', 'ELEMENTS', false], ['element2', '2. Element', 'ELEMENTS', true], ['race', 'Rasse', 'RACES', false], ['race2', '2. Rasse', 'RACES', true], ['class1', 'Klasse', 'CLASSES', false], ['class2', '2. Klasse', 'CLASSES', true]];
// Einstellungen des gerade laufenden Auftrags (die Oberfläche darf sich währenddessen ändern)
function aiCfg() { return AIM.cur || AIM; }
function aiSnapshot() { return { ctype: AIM.ctype || 'hero', rarity: AIM.rarity, fix: Object.assign({}, AIM.fix), useAI: AIM.useAI && !!AIM.canAI, indoor: AIM.indoor, season1: AIM.season1, keepStyle: AIM.keepStyle, style: AIM.keepStyle && G.card ? clone(G.card.style) : null, canAI: AIM.canAI, aiName: AIM.aiName }; }
function aiFixSelects() {
  return AI_FIX.map(([k, lab, list, opt]) => '<label>' + lab + '<select data-aifix="' + k + '" ' + '' + '><option value="">' + 'KI entscheidet' + '</option>' + (opt ? '<option value="-"' + (AIM.fix[k] === '-' ? ' selected' : '') + '>Keins</option>' : '')
    + D[list].map(x => '<option value="' + x.id + '"' + (AIM.fix[k] === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>').join('');
}
// Festlegungen auf eine Identität anwenden (zweite Werte nie gleich dem ersten)
function applyFix(idn) {
  const f = aiCfg().fix, o = Object.assign({}, idn, { classes: (idn.classes || [null, null]).slice() });
  if (f.element) o.element = f.element; if (f.race) o.race = f.race; if (f.class1) o.classes[0] = f.class1;
  if (f.element2) o.element2 = f.element2 === '-' ? null : f.element2; if (f.race2) o.race2 = f.race2 === '-' ? null : f.race2; if (f.class2) o.classes[1] = f.class2 === '-' ? null : f.class2;
  const fixed = AI_FIX.filter(([k]) => f[k]).map(([, lab]) => lab);
  if (fixed.length) o.reason = String(o.reason || '').replace(/\s*Rasse und Klasse zufällig\.?/, '').trim() + ' Festgelegt: ' + fixed.join(', ') + '.';
  if (o.element2 === o.element) o.element2 = null; if (o.race2 === o.race) o.race2 = null; if (o.classes[1] === o.classes[0]) o.classes[1] = null;
  return o;
}
function renderAI() {
  const el = document.getElementById('aimode'); if (!el) return;
  const canAI = !!AIM.canAI, n = AIM.files.length;
  const done = AIM.results.filter(r => r.status === 'fertig').length;
  if (!AIM.typeChosen) {
    const T = [['hero', '⚔', 'Helden', 'Kämpfer mit ATK, DEF, Laufen und Gaben'], ['king', '👑', 'Könige', 'HP, ATK und königliche Gaben'], ['spell', '✦', 'Zauber', 'Helfen dir und deinen Helden'], ['curse', '☠', 'Flüche', 'Schaden dem Gegner'], ['all', '🎲', 'Gemischt', 'Mehrere Bilder, jedes wird zu einer anderen Kartenart']];
    el.innerHTML = '<div class="ai-bar"><div><div class="eyebrow">Kartenwerkstatt</div><h2>✦ AI-Modus</h2></div><span class="muted ai-sub">Was möchtest du erzeugen? Danach lädst du die Illustrationen hoch und stellst die Einzelheiten ein.</span><button data-ai="close">Schließen</button></div>'
      + '<div class="typepick"><h3>Welche Kartenart?</h3><div class="tp-grid">' + T.map(([k, ic, t, sub]) => '<button class="tp ' + k + '" data-ai-pick="' + k + '"><span class="tp-ic">' + ic + '</span><b>' + t + '</b><small>' + sub + '</small></button>').join('') + '</div></div>';
    return;
  }
  el.innerHTML = `<div class="ai-bar"><div><div class="eyebrow">Kartenwerkstatt</div><h2>✦ AI-Modus</h2></div>
      <span class="muted ai-sub">Illustrationen hochladen, Seltenheit wählen, Karten erzeugen. Alles landet als Entwurf in deiner Bibliothek.</span>
      <button data-ai="close" >Schließen</button></div>
    <div class="ai-body">
      <section class="ai-col">
        <div class="ai-step"><span class="num">1</span><h3>Illustrationen</h3></div>
        <div class="drop ai-drop" id="ai-drop"><span>Beliebig viele Bilder hierher ziehen</span><button data-ai="pick" ${!ST.state.canWrite ? 'disabled' : ''}>Bilder auswählen</button>
          <small class="muted">PNG, JPG oder WebP. Querformat 1536 × 1024 passt am besten ins Bildfenster.</small></div>
        <div class="ai-thumbs">${AIM.files.map((f, i) => '<figure><img src="' + f.url + '" alt=""><button data-ai-rm="' + i + '" aria-label="Bild entfernen" ' + '' + '>✕</button></figure>').join('')}</div>
        ${n ? '<p class="muted" style="font-size:13px">' + n + (n === 1 ? ' Bild' : ' Bilder') + ' bereit. <button class="ghost" data-ai="clear" style="padding:2px 8px" ' + '' + '>Alle entfernen</button></p>' : ''}
        <div class="ai-step"><span class="num">2</span><h3>Kartenart und Seltenheit</h3></div>
        <div class="ai-ctype">${[['hero', '⚔ Helden'], ['king', '👑 Könige'], ['spell', '✦ Zauber'], ['curse', '☠ Flüche'], ['mixed', '✦☠ Zauber und Flüche'], ['all', '🎲 Gemischt (alle Arten)']].map(([k, t]) => '<button class="' + ((AIM.ctype || 'hero') === k ? 'on' : '') + '" data-ai-ctype="' + k + '">' + t + '</button>').join('')}</div>
        ${(AIM.ctype || 'hero') === 'king' ? '<p class="muted" style="font-size:12.5px;margin:0">Könige: Die KI erkennt Name, Element und Rasse; die Indoor-KI würfelt HP (8.000–12.000), ATK (höchstens 3.500), Angriffsrichtungen und bis zu drei königliche Gaben passend zur Seltenheit.</p>' : ''}
        ${(AIM.ctype || 'hero') === 'all' ? '<p class="muted" style="font-size:12.5px;margin:0">Gemischt: Jedes Bild wird zufällig zu einem Helden (etwa die Hälfte), Zauber, Fluch oder König. Du kannst jede Karte danach einzeln neu erzeugen.</p>' : ''}
        ${['spell', 'curse', 'mixed'].includes(AIM.ctype || 'hero') ? '<p class="muted" style="font-size:12.5px;margin:0">Zauber und Flüche: Die KI erkennt das Motiv und schlägt Name, Untertyp, Stimmungstext und Effekte vor; die Werkstatt prüft alles nach dem Effektformat. Offline (oder wenn die KI-Antwort nicht passt) würfelt sie gültige Effekte passend zur Farbe des Bildes. Energie ist ein Werkstatt-Vorschlag.</p>' : ''}
        <div class="ai-rar">${RARITY_OPTS.map(([k, t, sub]) => '<button class="' + (AIM.rarity === k ? 'on' : '') + '" data-ai-rar="' + k + '" ' + '' + '><b>' + t + '</b><small>' + sub + '</small></button>').join('')}</div>
        <div class="ai-step"><span class="num">3</span><h3>Festlegen (optional)</h3></div>
        <p class="muted" style="font-size:12.5px;margin-top:-4px">Was du hier festlegst, gilt für alle Karten dieses Durchgangs. KI und Indoor-KI kümmern sich dann nur noch um den Rest.</p>
        <div class="ai-fix">${aiFixSelects()}</div>
        ${Object.values(AIM.fix).some(Boolean) ? '<p style="font-size:12.5px"><button class="ghost" data-ai="fix-clear" style="padding:2px 8px" ' + '' + '>Festlegungen löschen</button></p>' : ''}
        <div class="ai-step"><span class="num">4</span><h3>Optionen</h3></div>
        <label class="ai-opt"><input type="checkbox" id="ai-useai" ${AIM.useAI && canAI ? 'checked' : ''} ${canAI ? '' : 'disabled'}> <span><b>${window.WOK_DESKTOP ? 'Online-KI erkennt das Motiv' : 'Claude erkennt das Motiv'}${canAI && AIM.aiName ? ' · ' + esc(AIM.aiName) : ''}</b><small>${canAI ? (window.WOK_DESKTOP ? 'Name, Element, Rasse und Klasse passend zum Bild, über deine KI-Verbindung. Ohne Internet übernimmt die Indoor-KI.' : 'Name, Element, Rasse und Klasse passend zum Bild. Läuft über dein Claude-Abo, ohne Extrakosten; beim ersten Mal fragt Claude nach deiner Erlaubnis.') : (window.WOK_DESKTOP ? 'Noch keine KI-Verbindung eingerichtet (oben „KI-Verbindung“). Bis dahin übernimmt die Indoor-KI.' : 'In dieser Ansicht nicht verfügbar. Dann übernimmt die Indoor-KI oder der Zufall.')}</small></span></label>
        <label class="ai-opt"><input type="checkbox" id="ai-indoor" ${AIM.indoor ? 'checked' : ''} > <span><b>Indoor-KI (offline)</b><small>Farbanalyse des Bildes wählt das Element, dazu ein Namensvorschlag. Läuft ohne Internet direkt im Gerät${canAI ? ' und springt ein, wo Claude kein Ergebnis liefert' : ''}. Rasse und Klasse zufällig.</small></span></label>
        <label class="ai-opt"><input type="checkbox" id="ai-s1" ${AIM.season1 ? 'checked' : ''} > <span><b>Nur Season-1-Inhalte</b><small>Rassen, Klassen und Elemente aus „Spielinhalt am Anfang (Season 1)“ des Regelwerks.</small></span></label>
        <label class="ai-opt"><input type="checkbox" id="ai-style" ${AIM.keepStyle ? 'checked' : ''} > <span><b>Gestaltung der geöffneten Karte übernehmen</b><small>Schriften, Rahmen, Edelsteine und Pfeilfarben der Karte im Editor.</small></span></label>
        <div class="ai-go"><button class="gold" data-ai="run" ${n && ST.state.canWrite ? '' : 'disabled'}>${n ? (AIM.running ? '+ ' + n + (n === 1 ? ' Karte' : ' Karten') + ' in die Warteschlange' : n + (n === 1 ? ' Karte' : ' Karten') + ' erzeugen') : (AIM.running ? 'Weitere Bilder hochladen' : 'Erst Bilder hochladen')}</button>${AIM.running ? '<button class="danger" data-ai="stop">Alles anhalten</button>' : ''}
          <span class="muted" id="ai-log">${esc(AIM.log)}</span></div>
        ${AIM.running ? '<p style="font-size:12.5px">Läuft im Hintergrund weiter: Du kannst schon die nächsten Bilder und Einstellungen vorbereiten und in die Warteschlange legen, oder „Schließen“ und im Editor weiterarbeiten.' + (AIM.queue.length ? ' <b>' + AIM.queue.length + (AIM.queue.length === 1 ? ' Auftrag wartet.' : ' Aufträge warten.') + '</b>' : '') + '</p>' : ''}
        <p class="muted" style="font-size:12px">Werte nach ${esc(PW.SOURCE)}. Die Indoor-KI würfelt Energie (0–10), Laufschritte, Richtungen und Gaben und passt ATK/DEF (100er-Schritte, höchstens 3.500) so an, dass die Gesamt-Power im Bereich der gewählten Seltenheit liegt: ${esc(bandText())}. Karten mit ${PW.WARN_AT} oder mehr Punkten erzeugt sie nicht. Gaben: Gewöhnlich keine oder 1, Ungewöhnlich genau 1, Selten genau 2, Legendär genau 3 – nur die ${D.GIFTS.length} Gaben der Werkstatt; Poison + Doppelschlag nur bei Legendär. Jede Karte kann nach vorne laufen.</p>
      </section>
      <section class="ai-col ai-res">
        <div class="ai-step"><span class="num">5</span><h3>Ergebnis ${AIM.results.length ? '<span class="muted tnum" style="font-family:var(--f-ui);font-size:13px;letter-spacing:0">' + done + ' / ' + AIM.results.length + '</span>' : ''}</h3></div>
        ${AIM.results.length ? '<div class="roll-row" style="margin:0 0 10px"><button class="gold" data-ai="redo-all" ' + '' + '>↻ Alles nochmal (' + AIM.results.length + (AIM.results.length === 1 ? ' Karte' : ' Karten') + ')</button><span class="muted" style="font-size:12.5px">Gleiche Bilder, aktuelle Einstellungen (Seltenheit, Festlegungen). Die Karten werden ersetzt, nicht verdoppelt.</span></div>' : ''}
        ${AIM.results.length ? '<div class="ai-list">' + AIM.results.map((r, i) => resultRow(r, i)).join('') + '</div>' : '<p class="muted">Hier erscheinen die erzeugten Karten. Du kannst jede neu würfeln oder direkt im Editor öffnen.</p>'}
      </section>
    </div>
    <input type="file" id="ai-files" accept="image/png,image/jpeg,image/webp" multiple hidden>`;
  bindAI();
  AIM.results.forEach((r, i) => { if (r.status === 'fertig' && r.thumb) { const im = el.querySelector('[data-ai-thumb="' + i + '"]'); if (im) im.src = r.thumb; } });
}
function resultRow(r, i) {
  const c = r.card, rar = c && PW.rarityName(c.rarity), nm = (list, id) => (list.find(x => x.id === id) || {}).name || '';
  const st = { warte: 'wartet', bild: 'Bild wird gespeichert …', ai: 'Die KI sieht sich das Bild an …', wuerfel: 'Indoor-KI würfelt nach Power-Scaling …', fertig: '', fehler: r.error || 'Fehler' }[r.status];
  return '<div class="ai-item ' + r.status + '"><img data-ai-thumb="' + i + '" alt="" src="' + (r.thumb || r.src) + '">'
    + '<div style="min-width:0"><b>' + esc(c && c.name ? c.name : (r.status === 'fertig' ? 'Ohne Namen' : r.fileName)) + '</b>'
    + (c && r.status === 'fertig' && (c.type === 'spell' || c.type === 'curse') ? '<small>' + esc((c.type === 'curse' ? '☠ Fluch' : '✦ Zauber') + (c.subtitle ? ' · ' + c.subtitle : '') + ' · ' + c.energy + ' Energie · ' + PW.rarityName(c.rarity)) + '</small><small class="muted">' + esc(window.WOK_EFFECTS.describe(c, D)) + '</small>' + (c.ai && c.ai.reason ? '<small class="muted">' + esc(c.ai.reason) + '</small>' : '')
    : c && r.status === 'fertig' ? '<small>' + esc([[nm(D.ELEMENTS, c.element), nm(D.ELEMENTS, c.element2)].filter(Boolean).join('/'), [nm(D.RACES, c.race), nm(D.RACES, c.race2)].filter(Boolean).join('/'), nm(D.CLASSES, c.classes[0]), nm(D.CLASSES, c.classes[1])].filter(Boolean).join(' · ')) + '</small><small><span class="rchip r-' + c.rarity + '">' + esc(rar) + '</span> ' + String(PW.evaluate(c).total).replace('.', ',') + ' Punkte · ' + (c.type === 'king' ? '👑 König · ATK ' + c.atk + ' · ' + Number(c.hp).toLocaleString('de-DE') + ' HP · ' + (c.gifts || []).length + (c.gifts.length === 1 ? ' Gabe' : ' Gaben') : c.energy + ' Energie · ' + c.atk + '/' + c.def) + '</small>' + (r.reason ? '<small class="muted">' + esc(r.reason) + '</small>' : '') : '<small class="muted">' + esc(st) + '</small>')
    + '</div><div class="ops">' + (r.status === 'fertig' ? '<button data-ai-redo="' + i + '" title="Name, Herkunft und Werte für dieses Bild komplett neu" ' + '' + '>↻ Komplett neu</button><button data-ai-reroll="' + i + '" title="Nur die Werte neu würfeln" ' + '' + '>🎲 Werte neu</button><button data-ai-open="' + i + '">Öffnen</button>' : r.status === 'fehler' && r.retry ? '<button data-ai-retry="' + i + '" ' + '' + '>Erneut</button>' : '') + '</div></div>';
}
function bindAI() {
  const el = document.getElementById('aimode');
  const drop = el.querySelector('#ai-drop');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); };
  el.querySelector('#ai-files').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  const u = el.querySelector('#ai-useai'); if (u) u.onchange = () => { AIM.useAI = u.checked; };
  el.querySelector('#ai-indoor').onchange = e => { AIM.indoor = e.target.checked; };
  el.querySelector('#ai-s1').onchange = e => { AIM.season1 = e.target.checked; };
  el.querySelectorAll('[data-aifix]').forEach(sel => sel.onchange = () => { AIM.fix[sel.dataset.aifix] = sel.value; try { localStorage.setItem('wok-ai-fix', JSON.stringify(AIM.fix)); } catch (e) {} renderAI(); });
  el.querySelector('#ai-style').onchange = e => { AIM.keepStyle = e.target.checked; };
}
function addFiles(list) {
  let skipped = 0;
  for (const f of list) {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 20 * 1024 * 1024) { skipped++; continue; }
    AIM.files.push({ file: f, url: URL.createObjectURL(f) });
  }
  if (skipped) toast(skipped + (skipped === 1 ? ' Datei wurde' : ' Dateien wurden') + ' übersprungen: nur PNG, JPG oder WebP bis 20 MB.');
  renderAI();
}
function setLog(t) { AIM.log = t; const l = document.getElementById('ai-log'); if (l) l.textContent = t; aiBgChip(); }
function updRow(i) {
  const el = document.getElementById('aimode'); if (!el) return;
  const list = el.querySelector('.ai-list'); if (!list) { renderAI(); return; }
  const row = list.children[i]; if (!row) { renderAI(); return; }
  const t = document.createElement('div'); t.innerHTML = resultRow(AIM.results[i], i); row.replaceWith(t.firstElementChild);
}

/* Bild für Claude verkleinern (spart Übertragung; die Plattform verkleinert ohnehin auf ca. 1,2 MP) */
async function aiImageBlob(file, maxSide) {
  const url = URL.createObjectURL(file);
  try {
    const im = await R.loadImage(url); if (!im) return file;
    const k = Math.min(1, (maxSide || 1024) / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}
function aiPrompt(count) {
  const allowed = list => list.map(x => x.id + ' = ' + x.name).join(', ');
  const R1 = aiCfg().season1 ? D.RACES.filter(x => PW.SEASON1.races.includes(x.id)) : D.RACES;
  const C1 = aiCfg().season1 ? D.CLASSES.filter(x => PW.SEASON1.classes.includes(x.id)) : D.CLASSES;
  const E1 = aiCfg().season1 ? D.ELEMENTS.filter(x => PW.SEASON1.elements.includes(x.id)) : D.ELEMENTS;
  return 'Du hilfst beim Gestalten von Heldenkarten für das Fantasy-Kartenspiel „War of Kings“. Du bekommst ' + count + (count === 1 ? ' Illustration' : ' Illustrationen') + ' in der angehängten Reihenfolge. '
    + 'Regeln: Erfinde keine neuen Rassen, Klassen, Elemente, Seltenheiten, Gaben oder Sonderregeln, nutze nur die unten genannten ids. Werte, Energie, Richtungen, Gaben und Seltenheit berechnet das Programm nach dem Power-Scaling-System 2.0, nicht du.\n'
    + (Object.values(aiCfg().fix).some(Boolean) ? 'Fest vorgegeben (übernimm das genau so und wähle Name und den Rest passend dazu): ' + AI_FIX.filter(([k]) => aiCfg().fix[k]).map(([k, lab, list]) => lab + ' = ' + (aiCfg().fix[k] === '-' ? 'keins' : ((D[list].find(x => x.id === aiCfg().fix[k]) || {}).name || aiCfg().fix[k]))).join(', ') + '.\n' : '')
    + 'Bestimme für jede Illustration, was das Motiv zeigt, und wähle passend dazu:\n'
    + '- name: ein einprägsamer Heldenname im Stil von „Sturmklinge Raiden“ oder „Akuma no Klinge“, höchstens 22 Zeichen, kein Name einer bekannten Figur aus Filmen, Spielen oder Büchern.\n'
    + '- element: genau eine id aus: ' + allowed(E1) + '\n'
    + '- element2: null, oder ein zweites, anderes Element aus derselben Liste, aber nur wenn das Motiv eindeutig zwei Elemente zeigt (z. B. Feuer und Eis/Wasser).\n'
    + '- race: genau eine id aus: ' + allowed(R1) + '\n'
    + '- race2: null, oder eine zweite, andere Rasse aus derselben Liste, nur wenn das Motiv eindeutig ein Mischwesen ist (z. B. halb Mensch, halb Drache).\n'
    + '- class1: genau eine id aus: ' + allowed(C1) + '\n'
    + '- class2: null, oder eine zweite, andere id aus derselben Liste, aber nur wenn das Motiv eindeutig zwei Rollen zeigt.\n'
    + '- reason: ein kurzer deutscher Halbsatz, woran du das erkennst (höchstens 80 Zeichen).\n'
    + 'Antworte nur mit einem JSON-Objekt {"cards": [...]} mit genau ' + count + ' Objekten in Bildreihenfolge, zum Beispiel:\n'
    + '{"cards":[{"name":"Glutschwinge Kael","element":"feuer","element2":null,"race":"drachen","race2":null,"class1":"samurai","class2":null,"reason":"Drachenkrieger in Rüstung, umgeben von Flammen"}]}';
}
function cleanIdentity(o) {
  const ok = (list, id) => list.some(x => x.id === id) ? id : null;
  const R1 = aiCfg().season1 ? D.RACES.filter(x => PW.SEASON1.races.includes(x.id)) : D.RACES;
  const C1 = aiCfg().season1 ? D.CLASSES.filter(x => PW.SEASON1.classes.includes(x.id)) : D.CLASSES;
  const E1 = aiCfg().season1 ? D.ELEMENTS.filter(x => PW.SEASON1.elements.includes(x.id)) : D.ELEMENTS;
  const fallback = PW.randomIdentity(Math.random, aiCfg().season1);
  const c1 = ok(C1, o && o.class1) || fallback.classes[0];
  let c2 = ok(C1, o && o.class2); if (c2 === c1) c2 = null;
  const e1 = ok(E1, o && o.element) || fallback.element, r1 = ok(R1, o && o.race) || fallback.race;
  let e2 = ok(E1, o && o.element2); if (e2 === e1) e2 = null;
  let r2 = ok(R1, o && o.race2); if (r2 === r1) r2 = null;
  const nm0 = o && (o.name || o.Name || o.heldenname || o.Heldenname || o.title || o.titel);
  return { name: String(nm0 || '').replace(/\s+/g, ' ').trim().slice(0, 28), element: e1, element2: e2, race: r1, race2: r2, classes: [c1, c2], reason: String((o && o.reason) || '').slice(0, 100) };
}
function buildCard(identity, rarityChoice) {
  identity = applyFix(identity);
  if (!identity.name && window.WOK_INDOOR) identity.name = window.WOK_INDOOR.makeName(identity);
  const gen = PW.generate(rarityChoice, Math.random);
  if (!gen) return null;
  const card = normalize(Object.assign(blankCard(), {
    name: identity.name || '', element: identity.element, element2: identity.element2 || null, race: identity.race, race2: identity.race2 || null, classes: identity.classes,
    atk: gen.atk, def: gen.def, energy: gen.energy, rarity: gen.rarity, synergy: 0, gifts: gen.gifts, attack: gen.attack, move: gen.move,
    status: 'entwurf', autoRarity: true, autoEnergy: false, ai: { generated: new Date().toISOString(), rarityChoice, power: gen.power, energyShift: gen.energyShift || 0, motif: !!identity.fromAI, reason: identity.reason || '' }
  }));
  const cf = aiCfg(); if (cf.keepStyle && (cf.style || G.card)) card.style = clone(cf.style || G.card.style);
  return card;
}
// König: Name, Element und Rasse aus der Motiverkennung, Werte und königliche Gaben passend zur Seltenheit
function buildKingCard(identity, rarityChoice) {
  identity = applyFix(identity);
  if (!identity.name && window.WOK_INDOOR) identity.name = window.WOK_INDOOR.makeName(identity);
  const gen = PW.generateKing(rarityChoice || 'gemischt', Math.random, { fixed: { rollGifts: true } });
  if (!gen) return null;
  const card = normalize(Object.assign(blankCard(), { type: 'king', name: identity.name || '', element: identity.element, element2: identity.element2 || null, race: identity.race, race2: identity.race2 || null, classes: identity.classes,
    atk: gen.atk, hp: gen.hp, def: '', energy: '', rarity: gen.rarity, gifts: gen.gifts, attack: gen.attack, move: { dirs: {}, showNumber: false, number: 1 }, status: 'entwurf', autoRarity: true, autoEnergy: false,
    ai: { generated: new Date().toISOString(), rarityChoice, power: gen.power, motif: !!identity.fromAI, reason: identity.reason || '' } }));
  const cf = aiCfg(); if (cf.keepStyle && (cf.style || G.card)) card.style = clone(cf.style || G.card.style);
  return card;
}
// Zauber/Fluch aus KI-Vorschlag (geprüft) oder offline aus dem Generator
function buildSpellCard(idn, ctype, rarityChoice) {
  const GEN = window.WOK_SPELLGEN; if (!GEN) return null;
  const a = idn.spellAI, type = ctype === 'mixed' ? (a && (a.type === 'curse' || a.type === 'spell') ? a.type : Math.random() < .5 ? 'spell' : 'curse') : ctype;
  const rar = rarityChoice === 'gemischt' ? null : rarityChoice;
  let g = a ? GEN.fromAI(a, type, rar, D) : null, why = g ? (idn.reason || 'Effekt von der KI, geprüft') : '';
  if (!g) { g = GEN.random({ type, rarity: rar, element: idn.element || null, name: idn.fromAI ? idn.name || '' : '', D }); why = (a ? 'KI-Effekt passte nicht, ' : '') + 'Effekt gewürfelt' + (idn.element ? ' passend zu ' + ((D.ELEMENTS.find(x => x.id === idn.element) || {}).name || idn.element) : ''); }
  if (!g) return null;
  const card = normalize(Object.assign(blankCard(), { type, name: g.name, subtitle: g.subtitle, flavor: g.flavor, energy: g.energy, rarity: g.rarity, ruleText: '', spell: g.spell, status: 'entwurf', ai: { generated: new Date().toISOString(), rarityChoice, motif: !!idn.fromAI, reason: why } }));
  const cf = aiCfg(); if (cf.keepStyle && (cf.style || G.card)) card.style = clone(cf.style || G.card.style);
  return card;
}
async function saveResult(r) {
  r.card.art = r.art; r.card.id = r.cardId || undefined;
  r.cardId = await ST.put(r.card);
  const cv = document.createElement('canvas'); cv.width = 200; cv.height = 300;
  await renderTo(cv, normalize(clone(r.card)), { placeholder: false });
  r.thumb = cv.toDataURL('image/jpeg', 0.82);
}

// redo: vorhandene Ergebnisse mit den aktuellen Einstellungen noch einmal erzeugen (gleiche Bilder, gleiche Karten werden überschrieben)
// Aufträge kommen in eine Warteschlange; so kann man den nächsten schon geben, während einer läuft
function runAI(redo) {
  if (!redo && !AIM.files.length) return;
  if (!ST.state.canWrite) { toast('Du kannst hier nur ansehen.'); return; }
  let items;
  if (redo) { items = redo.filter(r => (r.file || r.art) && !AIM.queue.some(q => q.items.includes(r)) && r.status !== 'bild' && r.status !== 'ai' && r.status !== 'wuerfel'); if (!items.length) return; for (const r of items) { r.status = 'warte'; r.error = ''; r.retry = false; } }
  else { const start = AIM.results.length; for (const f of AIM.files.splice(0)) AIM.results.push({ status: 'warte', src: f.url, fileName: f.file.name, file: f.file }); items = AIM.results.slice(start); }
  AIM.queue.push({ items, cfg: aiSnapshot(), redo: !!redo });
  if (AIM.running) toast('In der Warteschlange: ' + items.length + (items.length === 1 ? ' Karte' : ' Karten') + '. Startet, sobald der laufende Auftrag fertig ist.');
  renderAI(); aiBgChip();
  if (!AIM.running) aiPump();
}
async function aiPump() {
  if (AIM.running) return;
  while (AIM.queue.length) {
    const job = AIM.queue.shift();
    AIM.cur = job.cfg;
    try { await runJob(job.items, job.redo); } finally { AIM.cur = null; }
    if (AIM.stopAll) break;
  }
  if (AIM.stopAll) { for (const j of AIM.queue.splice(0)) for (const r of j.items) { r.status = 'fehler'; r.error = 'Angehalten.'; r.retry = !!(r.file || r.art); } AIM.stopAll = false; }
  renderAI(); aiBgChip();
}
async function runJob(items, redo) {
  AIM.running = true; AIM.ctl = new AbortController();
  renderAI(); aiBgChip();
  const useAI = aiCfg().useAI;
  try {
    // 1. Originalbilder speichern
    for (let k = 0; k < items.length; k++) {
      if (AIM.ctl.signal.aborted) break;
      const r = items[k], i = AIM.results.indexOf(r); if (r.art) continue; r.status = 'bild'; updRow(i); setLog('Bilder werden gespeichert … ' + (k + 1) + ' / ' + items.length);
      try {
        const up = await ST.putImage(r.file); const im = await R.loadImage(up.url);
        r.art = { id: up.id, name: r.file.name, w: im ? im.naturalWidth : 0, h: im ? im.naturalHeight : 0 };
      } catch (e) { r.status = 'fehler'; r.error = 'Bild konnte nicht gespeichert werden.'; updRow(i); }
    }
    // 2. Motive erkennen (mehrere Bilder je Anfrage)
    const ok = items.filter(r => r.art && r.status !== 'fehler');
    const per = !useAI ? 0 : (AIM.limits && AIM.limits.images && !(await desktopAI())) ? Math.max(1, Math.min(AIM.limits.images.maxCount || 1, 6)) : 4;
    const ids = new Map();
    if (useAI) {
      for (let k = 0; k < ok.length && !AIM.ctl.signal.aborted; k += per) {
        const group = ok.slice(k, k + per);
        group.forEach(r => { r.status = 'ai'; updRow(AIM.results.indexOf(r)); });
        setLog((aiCfg().aiName || 'Die KI') + ' sieht sich ' + (group.length === 1 ? 'das Bild' : group.length + ' Bilder') + ' an … (' + Math.min(ok.length, k + group.length) + ' / ' + ok.length + ')');
        try {
          const blobs = []; for (const r of group) blobs.push(await aiImageBlob(r.file || await ST.imageBlob(r.art.id)));
          const spellMode = ['spell', 'curse', 'mixed'].includes(aiCfg().ctype);
          const ans = await aiJSON(spellMode ? window.WOK_SPELLGEN.prompt(group.length, aiCfg().ctype, D) : aiPrompt(group.length), blobs, { signal: AIM.ctl.signal, tier: 'default' });
          const arr = Array.isArray(ans) ? ans : (ans && Array.isArray(ans.cards) ? ans.cards : []);
          group.forEach((r, j) => ids.set(r, spellMode ? { spellAI: arr[j] || null, fromAI: !!arr[j], name: String((arr[j] && arr[j].name) || '').slice(0, 28), reason: String((arr[j] && arr[j].reason) || '').slice(0, 100) } : Object.assign(cleanIdentity(arr[j]), { fromAI: !!arr[j] })));
        } catch (e) {
          if (e && e.code === 'cancelled') break;
          toast(aiErrText(e) + ' Die übrigen Karten macht die Indoor-KI.', 6000);
          if (e && ['not_granted', 'sampling_disabled', 'rate_limited', 'offline', 'auth', 'no_key', 'no_model', 'unavailable'].includes(e.code)) { k = ok.length; }
        }
      }
    }
    // 3. Werte würfeln und speichern
    for (let k = 0; k < ok.length; k++) {
      if (AIM.ctl.signal.aborted) break;
      const r = ok[k], i = AIM.results.indexOf(r); r.status = 'wuerfel'; updRow(i);
      let idn = ids.get(r);
      if (!idn && aiCfg().indoor && window.WOK_INDOOR) { setLog('Indoor-KI analysiert … ' + (k + 1) + ' / ' + ok.length); idn = await window.WOK_INDOOR.identify(r.file || await ST.imageBlob(r.art.id), aiCfg().season1); }
      if (!idn) idn = Object.assign(PW.randomIdentity(Math.random, aiCfg().season1), { name: '', fromAI: false });
      r.identity = idn; r.reason = idn.reason || (useAI ? '' : 'Ohne Motiverkennung: Element, Rasse und Klasse zufällig.');
      const ct = aiCfg().ctype || 'hero', kind = ct === 'all' ? (() => { const x = Math.random(); return x < .5 ? 'hero' : x < .62 ? 'king' : x < .81 ? 'spell' : 'curse'; })() : ct;
      r.card = kind === 'king' ? buildKingCard(idn, aiCfg().rarity) : ['spell', 'curse', 'mixed'].includes(kind) ? buildSpellCard(idn, kind, aiCfg().rarity) : buildCard(idn, aiCfg().rarity);
      if (!r.card) { r.status = 'fehler'; r.error = 'Keine gültige Kombination gefunden.'; updRow(i); continue; }
      try { await saveResult(r); r.status = 'fertig'; } catch (e) { r.status = 'fehler'; r.error = 'Speichern fehlgeschlagen.'; }
      updRow(i); setLog((k + 1) + ' / ' + ok.length + ' Karten gespeichert');
    }
    for (const r of items) if (r.status === 'warte' || r.status === 'bild' || r.status === 'ai' || r.status === 'wuerfel') { r.status = 'fehler'; r.error = 'Angehalten.'; r.retry = !!r.art; }
    const n = items.filter(r => r.status === 'fertig').length;
    setLog(n + (n === 1 ? ' Karte' : ' Karten') + (redo ? ' neu erzeugt (gleiche Bilder, Karten überschrieben).' : ' als Entwurf in der Bibliothek.'));
  } finally {
    AIM.running = false; AIM.ctl = null; renderAI(); renderLib(); aiBgChip();
  }
}
async function rerollAI(i) {
  const r = AIM.results[i]; if (!r || !r.card) return;
  if (r.card.type === 'spell' || r.card.type === 'curse') {
    const g = window.WOK_SPELLGEN.random({ type: r.card.type, rarity: AIM.rarity === 'gemischt' ? null : AIM.rarity, element: (r.identity || {}).element || null, name: r.card.name, D }); if (!g) return;
    Object.assign(r.card, { subtitle: g.subtitle, energy: g.energy, rarity: g.rarity, spell: g.spell, ruleText: '' });
    try { await saveResult(r); updRow(i); renderLib(); toast('Effekt neu gewürfelt.'); } catch (e) { toast('Speichern fehlgeschlagen.'); } return;
  }
  const keepName = r.card.name;
  if (r.card.type === 'king') {
    const fk = buildKingCard(Object.assign({}, r.identity || {}, { name: keepName, element: r.card.element, element2: r.card.element2, race: r.card.race, race2: r.card.race2, classes: r.card.classes }), AIM.rarity === 'gemischt' ? (r.card.ai && r.card.ai.rarityChoice) || 'gemischt' : AIM.rarity);
    if (!fk) { toast('Keine gültige Kombination gefunden.'); return; }
    fk.style = r.card.style; r.card = fk;
    try { await saveResult(r); updRow(i); renderLib(); toast('Neu gewürfelt: König, ' + PW.rarityName(fk.rarity) + ', ' + String(PW.evaluate(fk).total).replace('.', ',') + ' Punkte.'); } catch (e) { toast('Speichern fehlgeschlagen.'); } return;
  }
  const fresh = buildCard(Object.assign({}, r.identity || {}, { name: keepName, element: r.card.element, element2: r.card.element2, race: r.card.race, race2: r.card.race2, classes: r.card.classes }), AIM.rarity === 'gemischt' ? r.card.ai.rarityChoice : AIM.rarity);
  if (!fresh) { toast('Keine gültige Kombination gefunden.'); return; }
  fresh.style = r.card.style; r.card = fresh;
  try { await saveResult(r); updRow(i); renderLib(); toast('Neu gewürfelt: ' + PW.rarityName(fresh.rarity) + ', ' + String(PW.evaluate(fresh).total).replace('.', ',') + ' Punkte.'); } catch (e) { toast('Speichern fehlgeschlagen.'); }
}

document.addEventListener('click', e => {
  const b = e.target.closest('#aimode button'); if (!b) return;
  const d = b.dataset;
  if (d.ai === 'close') closeAI();
  else if (d.ai === 'pick') document.getElementById('ai-files').click();
  else if (d.ai === 'fix-clear') { for (const k in AIM.fix) AIM.fix[k] = ''; try { localStorage.removeItem('wok-ai-fix'); } catch (e) {} renderAI(); }
  else if (d.ai === 'clear') { AIM.files.forEach(f => URL.revokeObjectURL(f.url)); AIM.files = []; renderAI(); }
  else if (d.ai === 'run') runAI();
  else if (d.ai === 'redo-all') runAI(AIM.results.slice());
  else if (d.aiRedo !== undefined) { const r = AIM.results[+d.aiRedo]; if (r) runAI([r]); }
  else if (d.ai === 'stop') { AIM.stopAll = true; if (AIM.ctl) AIM.ctl.abort(); setLog('Wird angehalten …'); }
  else if (d.aiRm !== undefined) { const f = AIM.files.splice(+d.aiRm, 1)[0]; if (f) URL.revokeObjectURL(f.url); renderAI(); }
  else if (d.aiRar) { AIM.rarity = d.aiRar; renderAI(); }
  else if (d.aiCtype) { AIM.ctype = d.aiCtype; renderAI(); }
  else if (d.aiPick) { AIM.ctype = d.aiPick; AIM.typeChosen = true; renderAI(); }
  else if (d.aiReroll !== undefined) rerollAI(+d.aiReroll);
  else if (d.aiRetry !== undefined) { const r = AIM.results[+d.aiRetry]; if (r && r.file) { AIM.results.splice(+d.aiRetry, 1); AIM.files.push({ file: r.file, url: URL.createObjectURL(r.file) }); renderAI(); } }
  else if (d.aiOpen !== undefined) { const r = AIM.results[+d.aiOpen]; if (r && r.cardId) { const id = r.cardId; closeAI(); guard(() => openCard(id)); } }
});
