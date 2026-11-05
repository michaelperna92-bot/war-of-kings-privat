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
  // Werte in der Auswahl (31.10.2026: Pop-up statt großer Vorschau)
  const mc = await pg.$$('#dlg .mhand [data-pcid]'); const seen = [];
  for (const c of mc) { await c.hover(); await pg.waitForTimeout(130); seen.push(await pg.evaluate(() => { const p = document.getElementById('pop'); return p && !p.hidden ? (/ATK|☾|✦/.test(p.textContent) ? 'werte' : 'leer') : '-'; })); }
  ok(seen.every(x => x === 'werte'), 'Pop-up mit Werten in der Auswahl für jede Karte: ' + seen.join());
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
  // Maus über die Hand: Werte ploppen an der Karte auf
  const hc = await pg.$$('#hand [data-pcid]'); ok(hc.length >= 5, 'Hand: ' + hc.length);
  const names = [], times = [];
  for (const c of hc) { const t0 = Date.now(); await c.hover(); await pg.waitForFunction(() => { const p = document.getElementById('pop'); return p && !p.hidden; }, null, { timeout: 2000 }); times.push(Date.now() - t0); names.push(await pg.evaluate(() => document.querySelector('#pop .pop-h b').textContent)); }
  const handNames = await pg.evaluate(() => [...document.querySelectorAll('#hand [data-pcid]')].map(e => WOK_APP.game.s.cards[e.dataset.pcid].name));
  ok(names.join('|').replace(/[☾✦♛] /g, '') === handNames.join('|'), 'Pop-up wechselt zu jeder Karte');
  console.log('Reaktionszeit Hover (inkl. Playwright):', Math.max(...times), 'ms');
  const pos = await pg.evaluate(() => { const p = document.getElementById('pop').getBoundingClientRect(), h = document.getElementById('hand').getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(); return { pb: p.bottom, ht: h.top, ph: p.height, bh: b.height }; });
  ok(pos.pb <= pos.ht + 1 && pos.ph < pos.bh * .45, 'Pop-up über der Hand und klein (verdeckt das Spielfeld nicht): ' + JSON.stringify(pos));
  const txt = await pg.textContent('#pop'); ok(/ATK|Zauber|Fluch|☾|✦/.test(txt), 'Werte sichtbar: ' + txt.slice(0, 80));
  await hc[0].hover(); await pg.waitForTimeout(150); // Hand ggf. dorthin gescrollt – danach darf Darüberfahren nichts mehr verschieben
  const handPosBefore = await pg.evaluate(() => [...document.querySelectorAll('#hand [data-pcid]')].map(e => Math.round(e.getBoundingClientRect().left)).join());
  await hc[1].hover(); await pg.waitForTimeout(150); await hc[0].hover(); await pg.waitForTimeout(150);
  ok(handPosBefore === await pg.evaluate(() => [...document.querySelectorAll('#hand [data-pcid]')].map(e => Math.round(e.getBoundingClientRect().left)).join()), 'Handkarten verschieben sich nicht');
  ok(await pg.evaluate(() => { const r = document.getElementById('pop').getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return !t.closest('#pop'); }), 'Pop-up fängt keine Mausereignisse ab');
  await pg.screenshot({ path: SH + 'pop-pc.png' });
  await pg.mouse.move(5, 5); await pg.waitForTimeout(150); ok(await pg.evaluate(() => document.getElementById('pop').hidden), 'Maus weg → Pop-up weg');
  await hc[0].dblclick(); await pg.waitForTimeout(700); ok(await pg.isVisible('#insp'), 'Doppelklick: ganze Karte groß');
  ok(await pg.evaluate(() => document.getElementById('pop').hidden), 'Pop-up schließt sich bei der großen Ansicht');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  // Klick wählt weiterhin aus
  await pg.mouse.move(5, 5); await pg.evaluate(() => { WOK_APP.game.sel = null; WOK_APP.renderNow(); });
  await pg.click('#hand [data-pcid]:nth-child(2)'); await pg.waitForTimeout(250); ok(await pg.evaluate(() => !!WOK_APP.game.sel || !!WOK_APP.game.cast), 'Klick auf Handkarte wählt sie aus');
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
  await mp.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(mp);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const hr = await mp.evaluate(() => { const r = document.getElementById('hand').getBoundingClientRect(); return { l: r.left, r: r.right, y: r.top + r.height / 2 }; });
  ok(await mp.evaluate(() => document.querySelectorAll('#hand [data-pcid]').length) === 10, 'Handy: 10 Handkarten');
  const before = await mp.evaluate(() => ({ n: WOK_APP.game.rec.acts.length, sel: WOK_APP.game.sel, sl: document.getElementById('hand').scrollLeft }));
  // Wischen: Hand blättert nativ, nichts geht auf, nichts wird ausgewählt
  await touch('touchStart', hr.r - 30, hr.y); for (let k = 1; k <= 25; k++) { await touch('touchMove', hr.r - 30 - k * 11, hr.y); } await touch('touchEnd'); await mp.waitForTimeout(700);
  const after = await mp.evaluate(() => ({ n: WOK_APP.game.rec.acts.length, sel: WOK_APP.game.sel, sl: document.getElementById('hand').scrollLeft, pop: !!document.getElementById('pop') && !document.getElementById('pop').hidden, insp: !document.getElementById('insp').hidden }));
  ok(after.sl > before.sl + 100, 'Handy: Wischen blättert die Hand (' + before.sl + ' → ' + after.sl + ')');
  ok(!after.pop && !after.insp && !after.sel && after.n === before.n, 'Handy: Wischen öffnet nichts und löst nichts aus');
  // Antippen: Werte ploppen auf; nochmal tippen schließt; daneben tippen schließt
  await mp.evaluate(() => { document.getElementById('hand').scrollLeft = 0; }); await mp.waitForTimeout(200);
  const r0 = await mp.evaluate(() => { const r = document.querySelector('#hand [data-pcid]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await mp.touchscreen.tap(r0.x, r0.y); await mp.waitForTimeout(350);
  ok(await mp.evaluate(() => document.getElementById('pb-bot').classList.contains('info')) && /ATK|Zauber|Fluch|☾|✦/.test(await mp.textContent('#pb-bot')), 'Handy: Antippen → Kartenwerte in der eigenen Spielerleiste (4.7)');
  const pr = await mp.evaluate(() => { const r = document.getElementById('pb-bot').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth, pop: !!document.getElementById('pop') && !document.getElementById('pop').hidden }; });
  ok(pr.l >= 0 && pr.r <= pr.w && !pr.pop, 'Handy: Werte-Leiste passt auf den Bildschirm, kein Pop-up über dem Spielfeld: ' + JSON.stringify(pr));
  await mp.screenshot({ path: SH + 'pop-phone.png' });
  await mp.waitForTimeout(500); await mp.touchscreen.tap(r0.x, r0.y); await mp.waitForTimeout(300);
  ok(await mp.evaluate(() => !document.getElementById('pb-bot').classList.contains('info')), 'Handy: nochmal antippen → wieder König-Leben und Energie');
  await mp.waitForTimeout(500); await mp.touchscreen.tap(r0.x, r0.y); await mp.waitForTimeout(300); await mp.touchscreen.tap(195, 40); await mp.waitForTimeout(250);
  ok(await mp.evaluate(() => !document.getElementById('pb-bot').classList.contains('info')), 'Handy: daneben tippen → wieder König-Leben und Energie');
  // Doppeltipp = ganze Karte
  await mp.waitForTimeout(500); await mp.touchscreen.tap(r0.x, r0.y); await mp.waitForTimeout(60); await mp.touchscreen.tap(r0.x, r0.y); await mp.waitForTimeout(700);
  ok(await mp.isVisible('#insp'), 'Handy: Doppeltipp → ganze Karte groß');
  await mp.evaluate(() => document.querySelector('#insp [data-ix="close"]') && document.querySelector('#insp [data-ix="close"]').click()); await mp.waitForTimeout(600);
  // Held auf dem Brett antippen: Werte ploppen auf
  const tok = await mp.evaluate(() => { const t = document.querySelector('.tok[data-uid]'); if (!t) return null; const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (tok) { await mp.waitForTimeout(500); await mp.touchscreen.tap(tok.x, tok.y); await mp.waitForTimeout(350); ok(await mp.evaluate(() => ['pb-bot', 'pb-top'].some(id => document.getElementById(id).classList.contains('info') && /ATK/.test(document.getElementById(id).textContent))), 'Handy: Held auf dem Brett antippen → Werte in der Spielerleiste'); }
  // langes Gedrückthalten = große Ansicht
  await mp.touchscreen.tap(195, 40); await mp.waitForTimeout(300);
  await touch('touchStart', r0.x, r0.y); await mp.waitForTimeout(800); await touch('touchEnd'); await mp.waitForTimeout(700);
  ok(await mp.isVisible('#insp'), 'Handy: Gedrückthalten öffnet die große Kartenansicht');
  console.log('Seitenfehler:', errs);
  console.log('Starthand/Vorschau-Oberfläche: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN || errs.length ? 1 : 0);
})();
