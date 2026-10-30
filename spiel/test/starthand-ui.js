// Oberfläche: Starthand-Auswahl (KI, zu zweit) und Handkarten-Schnellvorschau (Maus, Finger). Braucht test/serve.js (Port 8765).
const { chromium } = require('playwright');
const SH = '/tmp/claude-0/wokui/';
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
(async () => {
  const b = await chromium.launch(); const errs = [];
  /* ---------- PC ---------- */
  const pg = await b.newPage({ viewport: { width: 1366, height: 900 } }); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  await pg.click('[data-hplay="ai"]'); await pg.click('[data-mode="ai"]'); await pg.click('#start'); await pg.waitForSelector('#dlg .mhand', { timeout: 6000 }).catch(() => {});
  ok(await pg.isVisible('#dlg .mhand'), 'Starthand-Auswahl erscheint vor dem ersten Zug');
  const h2 = await pg.textContent('#dlg h2'); ok(/behalten oder einmalig neu ziehen/.test(h2), 'Frage: ' + h2);
  ok(await pg.isVisible('#dlg [data-act="keep"]') && /Hand behalten/.test(await pg.textContent('#dlg [data-act="keep"]')), 'Knopf Hand behalten');
  ok(/Neue 5 Karten ziehen/.test(await pg.textContent('#dlg [data-act="new"]')), 'Knopf Neue 5 Karten ziehen');
  ok(/zurück ins Deck gemischt. Die neue Hand musst du behalten/.test(await pg.textContent('#dlg')), 'Hinweistext');
  ok((await pg.$$('#dlg .mhand [data-pcid]')).length === 5, '5 Karten in der Auswahl');
  const st0 = await pg.evaluate(() => { const g = WOK_APP.game; return { ph: g.s.phase, turn: g.s.turn, hand: g.s.players[g.view].hand.map(h => h.iid).join(), view: g.view, ai: g.aiSide, mull: g.s.mull.slice() }; });
  ok(st0.ph === 'mulligan' && st0.turn === 0, 'Partie wartet auf die Entscheidung');
  // Vorschau in der Auswahl
  const mc = await pg.$$('#dlg .mhand [data-pcid]'); const seen = [];
  for (const c of mc) { await c.hover(); await pg.waitForTimeout(130); seen.push(await pg.evaluate(() => { const p = document.getElementById('peek'); return p && !p.hidden && p.classList.contains('on') ? (p.querySelector('img') ? 'img' : 'txt') : '-'; })); }
  ok(seen.every(x => x === 'img'), 'Vorschau in der Auswahl zeigt jede Karte als Kartenbild: ' + seen.join());
  await pg.screenshot({ path: SH + 'mull-pc.png' });
  await pg.click('#dlg [data-act="new"]'); await pg.waitForTimeout(1600);
  const st1 = await pg.evaluate(() => { const g = WOK_APP.game; const P = g.s.players[g.view]; return { ph: g.s.phase, turn: g.s.turn, n: P.hand.length + P.deck.length, hand: P.hand.map(h => h.iid).join(), mull: g.s.mull.slice(), first: g.s.first }; });
  ok(st1.mull[st0.view] === 'neu' && st1.mull[st0.ai] !== null, 'beide haben entschieden (KI auch): ' + JSON.stringify(st1.mull));
  ok(st1.ph !== 'mulligan' && st1.turn >= 1, 'erster Zug läuft: ' + st1.ph + ' Zug ' + st1.turn);
  ok(st1.n === 39, 'keine Karte verloren (39 = Hand + Stapel, ggf. minus Beschwörungen): ' + st1.n);
  ok(st1.hand !== st0.hand, 'neue Hand');
  ok(!(await pg.isVisible('#dlg .mhand')), 'keine zweite Auswahl');
  ok(await pg.evaluate(() => WOK_APP.dispatch({ type: 'mulligan', p: WOK_APP.game.view, redraw: true })) === false, 'zweiter Tausch abgelehnt');
  // warten, bis der Mensch am Zug ist (falls KI begonnen hat)
  for (let i = 0; i < 60 && await pg.evaluate(() => WOK.actor(WOK_APP.game.s) !== WOK_APP.game.view); i++) await pg.waitForTimeout(300);
  // Hover über die Hand
  await pg.screenshot({ path: SH + 'dbg.png' }); console.log('dbg', await pg.evaluate(() => ({ ov: !document.getElementById('ov').hidden, h2: (document.querySelector('#dlg h2') || {}).textContent, ph: WOK_APP.game.s.phase, act: WOK.actor(WOK_APP.game.s), v: WOK_APP.game.view })));
  const hc = await pg.$$('#hand [data-pcid]'); ok(hc.length >= 5, 'Hand: ' + hc.length);
  const cids = [], times = [];
  for (const c of hc) { const t0 = Date.now(); await c.hover(); await pg.waitForFunction(() => { const p = document.getElementById('peek'); return p && !p.hidden; }, null, { timeout: 2000 }); times.push(Date.now() - t0); cids.push(await pg.evaluate(() => { const p = document.getElementById('peek'); return p.querySelector('img') ? p.querySelector('img').getAttribute('src').slice(-12) : ''; })); }
  const handCids = await pg.evaluate(() => [...document.querySelectorAll('#hand [data-pcid]')].map(e => e.dataset.pcid));
  ok(new Set(cids).size === new Set(handCids).size, 'Vorschau wechselt zu jeder Karte (' + new Set(cids).size + '/' + new Set(handCids).size + ')');
  console.log('Reaktionszeit Hover (inkl. Playwright):', Math.max(...times), 'ms');
  const pos = await pg.evaluate(() => { const p = document.getElementById('peek').getBoundingClientRect(), h = document.getElementById('hand').getBoundingClientRect(); return { pb: p.bottom, ht: h.top, w: p.width, h: p.height, l: p.left }; });
  ok(pos.pb <= pos.ht + 1 && pos.h > 300, 'Vorschau oberhalb der Hand und groß: ' + JSON.stringify(pos));
  const handPosBefore = await pg.evaluate(() => [...document.querySelectorAll('#hand [data-pcid]')].map(e => Math.round(e.getBoundingClientRect().left)).join());
  await hc[0].hover(); await pg.waitForTimeout(150); const p1 = await pg.evaluate(() => document.getElementById('peek').getBoundingClientRect().left);
  await hc[hc.length - 1].hover(); await pg.waitForTimeout(150); const p2 = await pg.evaluate(() => document.getElementById('peek').getBoundingClientRect().left);
  ok(Math.abs(p1 - p2) < 1, 'Vorschau bleibt an fester Stelle (kein Springen)');
  ok(handPosBefore === await pg.evaluate(() => [...document.querySelectorAll('#hand [data-pcid]')].map(e => Math.round(e.getBoundingClientRect().left)).join()), 'Handkarten verschieben sich nicht');
  ok(await pg.evaluate(() => { const r = document.getElementById('peek').getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !t.closest('#peek'); }), 'Vorschau fängt keine Mausereignisse ab');
  await pg.screenshot({ path: SH + 'peek-pc.png' });
  await pg.mouse.move(5, 5); await pg.waitForTimeout(150); ok(await pg.evaluate(() => document.getElementById('peek').hidden), 'Maus verlässt die Hand → Vorschau weg');
  await hc[0].dblclick(); await pg.waitForTimeout(800); ok(await pg.isVisible('#insp'), 'Doppelklick: große Kartenansicht wie bisher');
  ok(await pg.evaluate(() => document.getElementById('peek').hidden), 'Vorschau schließt sich bei der großen Ansicht');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(600);
  // Klick wählt weiterhin aus
  await pg.click('#hand [data-pcid]:nth-child(2)'); await pg.waitForTimeout(200); ok(await pg.evaluate(() => !!WOK_APP.game.sel), 'Klick auf Handkarte wählt sie aus');
  /* ---------- zu zweit an einem Gerät ---------- */
  const hp = await b.newPage({ viewport: { width: 1280, height: 900 } }); hp.on('pageerror', e => errs.push(e.message));
  await hp.goto('http://127.0.0.1:8765/index.html'); await hp.waitForTimeout(500);
  await hp.click('[data-hplay="ai"]'); await hp.click('[data-mode="hot"]'); await hp.click('#start'); await hp.waitForTimeout(500);
  const step = async () => { if (await hp.isVisible('#dlg [data-act="go"]')) { await hp.click('#dlg [data-act="go"]'); await hp.waitForTimeout(300); } };
  await hp.waitForTimeout(2800); await step(); await hp.waitForSelector('#dlg .mhand', { timeout: 6000 }).catch(() => {}); const firstP = await hp.evaluate(() => WOK_APP.game.view);
  ok(await hp.isVisible('#dlg .mhand'), 'zu zweit: Auswahl für den ersten Spieler');
  await hp.click('#dlg [data-act="keep"]'); await hp.waitForTimeout(400);
  ok(await hp.isVisible('#dlg [data-act="go"]'), 'zu zweit: danach Gerät übergeben (Hand verdeckt)');
  await step(); await hp.waitForSelector('#dlg .mhand', { timeout: 6000 }).catch(() => {}); ok(await hp.evaluate(() => WOK_APP.game.view) === 1 - firstP && await hp.isVisible('#dlg .mhand'), 'zu zweit: Auswahl für den zweiten Spieler');
  await hp.click('#dlg [data-act="new"]'); await hp.waitForTimeout(400); await step();
  ok(await hp.evaluate(() => { const s = WOK_APP.game.s; return s.phase !== 'mulligan' && s.turn === 1 && s.mull[s.first] === 'behalten' && s.mull[1 - s.first] === 'neu'; }), 'zu zweit: beide entschieden, Zug 1 läuft');
  /* ---------- Handy (Finger) ---------- */
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const mp = await ctx.newPage(); mp.on('pageerror', e => errs.push(e.message));
  await mp.goto('http://127.0.0.1:8765/index.html'); await mp.waitForTimeout(600);
  await mp.tap('[data-hplay="ai"]'); await mp.tap('[data-mode="ai"]'); await mp.tap('#start'); await mp.waitForSelector('#dlg .mhand', { timeout: 6000 }).catch(() => {});
  ok(await mp.isVisible('#dlg .mhand'), 'Handy: Auswahl erscheint');
  await mp.screenshot({ path: SH + 'mull-phone.png' });
  await mp.tap('#dlg [data-act="keep"]'); await mp.waitForTimeout(1500);
  for (let i = 0; i < 60 && await mp.evaluate(() => WOK.actor(WOK_APP.game.s) !== WOK_APP.game.view || WOK_APP.game.s.phase === 'mulligan'); i++) await mp.waitForTimeout(300);
  // 10 Handkarten erzwingen (Testzustand), damit die Hand überläuft
  await mp.evaluate(() => { const g = WOK_APP.game, P = g.s.players[g.view]; while (P.hand.length < 10 && P.deck.length) P.hand.push(P.deck.shift()); WOK_APP.renderNow(); });
  await mp.waitForTimeout(300);
  const cdp = await ctx.newCDPSession(mp);
  const rects = await mp.evaluate(() => [...document.querySelectorAll('#hand [data-pcid]')].map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, cid: e.dataset.pcid }; }));
  const hr = await mp.evaluate(() => { const r = document.getElementById('hand').getBoundingClientRect(); return { l: r.left, r: r.right, y: r.top + r.height / 2 }; });
  ok(rects.length === 10, 'Handy: 10 Handkarten');
  const before = await mp.evaluate(() => ({ n: WOK_APP.game.rec.acts.length, st: JSON.stringify(WOK_APP.game.s.units), sel: WOK_APP.game.sel }));
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const shown = [];
  await touch('touchStart', rects[0].x, rects[0].y); await mp.waitForTimeout(60);
  shown.push(await mp.evaluate(() => { const p = document.getElementById('peek'); return p && !p.hidden ? 'auf' : 'zu'; }));
  // ein Streichen nach rechts bis an den Rand, kurz am Rand halten (rollt weiter), dann zurück
  const path = []; for (let x = rects[0].x; x <= hr.r - 8; x += 12) path.push(x);  for (let x = hr.r - 8; x >= hr.l + 60; x -= 14) path.push(x);
  const seenM = new Set();
  const dbg = []; for (const x of path) { if (x === path[path.findIndex(v => v >= hr.r - 8)]) { await touch('touchMove', hr.r - 8, hr.y); for (let w = 0; w < 12; w++) { await mp.waitForTimeout(80); if (w === 11) console.log('beim Halten', await mp.evaluate(() => document.getElementById('hand').scrollLeft)); seenM.add(await mp.evaluate(() => { const p = document.getElementById('peek'); return p && !p.hidden ? (p.querySelector('img') || {}).src || 'x' : ''; })); } } await touch('touchMove', x, hr.y); dbg.push(Math.round(x) + ':' + await mp.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y); const c = t && t.closest('[data-pcid]'); const p = document.getElementById('peek'); return (c ? c.dataset.pcid : (t ? t.className : '-')) + '/' + (p.hidden ? 'zu' : (p.querySelector('img') ? p.querySelector('img').alt : '')); }, [x, hr.y])); seenM.add(await mp.evaluate(() => { const p = document.getElementById('peek'); return p && !p.hidden ? (p.querySelector('img') || {}).src || 'x' : ''; })); }
  console.log('scroll', await mp.evaluate(() => { const h = document.getElementById('hand'); return [h.scrollLeft, h.scrollWidth, h.clientWidth, getComputedStyle(h).touchAction]; }));
  await touch('touchEnd'); await mp.waitForTimeout(250);
  seenM.delete('');
  const allC = new Set(rects.map(r => r.cid));
  ok(seenM.size >= Math.min(allC.size, 10) - 1, 'Handy: Streichen zeigt nacheinander alle Karten (' + seenM.size + ' Bilder, ' + allC.size + ' verschiedene Karten)');
  ok(shown[0] === 'auf', 'Handy: Vorschau sofort beim Berühren');
  const after = await mp.evaluate(() => ({ n: WOK_APP.game.rec.acts.length, st: JSON.stringify(WOK_APP.game.s.units), sel: WOK_APP.game.sel, insp: !document.getElementById('insp').hidden }));
  ok(after.n === before.n && after.st === before.st && !after.sel && !after.insp, 'Handy: Streichen löst keine Aktion/Auswahl aus');
  ok(await mp.evaluate(() => { const p = document.getElementById('peek'); return !p.hidden && p.classList.contains('sticky'); }), 'Handy: nach dem Loslassen bleibt die Karte sichtbar');
  await mp.screenshot({ path: SH + 'peek-phone.png' });
  const pr = await mp.evaluate(() => { const r = document.getElementById('peek').getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: innerWidth, h: r.height }; });
  ok(pr.l >= 0 && pr.r <= pr.w && pr.t >= 0 && pr.h > 250, 'Handy: Vorschau passt auf den Bildschirm und ist groß: ' + JSON.stringify(pr));
  await mp.touchscreen.tap(195, 120); await mp.waitForTimeout(200);
  ok(await mp.evaluate(() => document.getElementById('peek').hidden), 'Handy: Tippen außerhalb schließt die Vorschau');
  // normales Antippen wählt weiterhin aus
  await mp.evaluate(() => { document.getElementById('hand').scrollLeft = 0; }); await mp.waitForTimeout(100);
  const r0 = await mp.evaluate(() => { const r = document.querySelector('#hand [data-pcid]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await mp.touchscreen.tap(r0.x, r0.y); await mp.waitForTimeout(300);
  ok(await mp.evaluate(() => !!WOK_APP.game.sel && !document.getElementById('peek').hidden), 'Handy: Antippen wählt aus und zeigt die Vorschau');
  // langes Gedrückthalten = große Ansicht
  await touch('touchStart', r0.x, r0.y); await mp.waitForTimeout(800); await touch('touchEnd'); await mp.waitForTimeout(700);
  ok(await mp.isVisible('#insp'), 'Handy: Gedrückthalten öffnet die große Kartenansicht');
  console.log('Seitenfehler:', errs);
  console.log('Starthand/Vorschau-Oberfläche: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN || errs.length ? 1 : 0);
})();
