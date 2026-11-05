// Flüssigkeit messen (Handy-Simulation, CPU 4× gedrosselt): Bildrate beim Wischen der Hand, im Leerlauf mit Glühen,
// Dauer eines Neuzeichnens, Reaktionszeit beim Antippen. Aufruf: node test/perf.js [Bezeichnung]
const { chromium } = require('playwright');
(async () => {
  const label = process.argv[2] || 'messung';
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(600);
  await pg.tap('[data-hplay="ai"]'); await pg.tap('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(600);
  for (let i = 0; i < 80; i++) { if (await pg.evaluate(() => { const s = WOK_APP.game.s; return s.active === 0 && s.phase === 'summon1'; })) break; await pg.waitForTimeout(300); }
  // Testzustand: 10 Handkarten inkl. spielbarer Zauber (glühen), eigene Battlephase, einige Helden auf dem Feld
  await pg.evaluate(() => { const G = WOK_APP.game, s = G.s; G.aiSide = -1; const ids = Object.keys(s.cards), heroes = ids.filter(id => s.cards[id].type === 'hero');
    const P = s.players[0]; while (P.hand.length < 10 && P.deck.length) P.hand.push(P.deck.shift()); P.energy = 10;
    const fields = ['B4', 'C4', 'E4', 'F4', 'C2', 'D2', 'E2']; fields.forEach((f, k) => { const uid = 'pu' + k; s.units[uid] = { uid, cid: heroes[k % heroes.length], owner: k < 4 ? 0 : 1, pos: f, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; });
    s.phase = 'battle'; s.decl = {}; WOK_APP.renderNow(); });
  await pg.mouse.move(1, 1); await pg.evaluate(() => { const p = document.getElementById('pop'); if (p) p.hidden = true; }); await pg.waitForTimeout(500);
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const fps = ms => pg.evaluate(ms => new Promise(res => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = t => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else res({ fps: Math.round(n * 1000 / (t - t0)), worstFrameMs: Math.round(worst) }); }; requestAnimationFrame(f); }), ms);
  const idle = await fps(2000);
  // Wischen über die Hand (echte Touch-Ereignisse)
  const hr = await pg.evaluate(() => { const r = document.getElementById('hand').getBoundingClientRect(); return { l: r.left, r: r.right, y: r.top + r.height / 2 }; });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const swipeP = fps(1600);
  await touch('touchStart', hr.r - 30, hr.y); for (let k = 0; k < 30; k++) { await touch('touchMove', hr.r - 30 - k * 10, hr.y); } await touch('touchEnd');
  const swipe = await swipeP;
  const scrolled = await pg.evaluate(() => document.getElementById('hand').scrollLeft);
  // Neuzeichnen
  const render = await pg.evaluate(() => { const t = []; for (let i = 0; i < 15; i++) { const a = performance.now(); WOK_APP.renderNow(); t.push(performance.now() - a); } t.sort((x, y) => x - y); return { medianMs: Math.round(t[7] * 10) / 10, maxMs: Math.round(t[14] * 10) / 10 }; });
  // Reaktion beim Antippen einer Handkarte (bis etwas Sichtbares reagiert)
  await pg.waitForTimeout(700);
  const r0 = await pg.evaluate(() => { const h = document.getElementById('hand'); h.scrollLeft = 0; const e = h.querySelector('[data-pcid]').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; });
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { window.__t0 = 0; window.__mo = new MutationObserver(() => { if (!window.__t1 && window.__t0) window.__t1 = performance.now(); }); window.__mo.observe(document.body, { subtree: true, childList: true, attributes: true }); window.__t1 = 0; addEventListener('pointerdown', () => { window.__t0 = performance.now(); }, { once: true, capture: true }); });
  await pg.touchscreen.tap(r0.x, r0.y); await pg.waitForTimeout(800);
  const tapMs = await pg.evaluate(() => Math.round(window.__t1 - window.__t0));
  const covered = await pg.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(); let cov = 0; for (const el of document.querySelectorAll('#peek:not([hidden]), .pop:not([hidden]), #insp:not([hidden]), #castfloat:not([hidden])')) { const r = el.getBoundingClientRect(); const w = Math.max(0, Math.min(b.right, r.right) - Math.max(b.left, r.left)), h = Math.max(0, Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top)); cov = Math.max(cov, w * h / (b.width * b.height)); } return Math.round(cov * 100); });
  await pg.screenshot({ path: '/tmp/claude-0/wokui/perf-' + label + '.png' });
  const res = { label, leerlaufMitGluehen: idle, wischen: swipe, handGescrollt: scrolled, neuzeichnen: render, antippenBisReaktionMs: tapMs, spielfeldVerdecktProzent: covered, fehler: errs };
  console.log(JSON.stringify(res)); require('fs').writeFileSync('/tmp/claude-0/wokui/perf-' + label + '.json', JSON.stringify(res, null, 1));
  await b.close();
})();
