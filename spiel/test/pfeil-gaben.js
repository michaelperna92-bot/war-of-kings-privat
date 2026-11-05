// 4.7 (31.10.2026): Angriffspfeil beginnt beim Angreifer (Spielfeld 5 Reihen); Gaben stehen in der Spielerleiste, nichts verdeckt Ziele.
const { chromium } = require('playwright');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
async function run(b, name, vp, touch) {
  const ctx = await b.newContext(Object.assign({ viewport: vp }, touch ? { hasTouch: true, isMobile: true } : {})); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const tap = sel => touch ? pg.tap(sel) : pg.click(sel);
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500); await tap('[data-hplay="ai"]'); await tap('#start'); await require('./mull.js')(pg);
  for (let i = 0; i < 100; i++) { if (await pg.evaluate(() => WOK_APP.game.s.active === 0 && WOK_APP.game.s.phase === 'summon1')) break; await pg.waitForTimeout(300); }
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const G = WOK_APP.game, s = G.s; G.aiSide = -1; for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    const hero = Object.values(s.cards).find(c => c.type === 'hero'); hero.gifts = [{ id: 'entwaffnen' }, { id: 'mordlust' }]; hero.attack = { dirs: { n: 1, s: 1, w: 1, e: 1 } };
    const foe = Object.values(s.cards).filter(c => c.type === 'hero')[1];
    const mk = (uid, cid, owner, pos) => s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] };
    mk('me', hero.id, 0, 'C3'); mk('vorn', foe.id, 1, 'C2'); mk('hinten', foe.id, 1, 'C4'); s.phase = 'battle'; s.decl = {}; WOK_APP.renderNow(); });
  await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => WOK.attackTargets(WOK_APP.game.s, 'me').includes('hinten')), name + ': Testaufbau – Ziel hinter dem Helden angreifbar');
  await tap('.tok[data-uid="me"]'); await pg.waitForTimeout(400);
  ok(!(await pg.$('#board #qgifts')), name + ': kein Gaben-Kästchen mehr auf dem Spielfeld');
  const bar = await pg.evaluate(() => { const b = document.getElementById('pb-bot'); return { info: b.classList.contains('info'), btns: [...b.querySelectorAll('[data-qg]')].map(x => x.dataset.qg) }; });
  ok(bar.info && bar.btns.includes('entwaffnen') && bar.btns.includes('mordlust'), name + ': Gaben als Knöpfe in der Spielerleiste: ' + JSON.stringify(bar));
  // Ziel hinter dem Helden ist frei antippbar
  const free = await pg.evaluate(() => { const t = document.querySelector('.tok[data-uid="hinten"]').getBoundingClientRect(); const e = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2); return !!(e && e.closest('.tok[data-uid="hinten"],.cell[data-f="C4"]')); });
  ok(free, name + ': Ziel hinter dem Helden ist nicht verdeckt');
  await tap('.tok[data-uid="hinten"]'); await pg.waitForTimeout(400);
  if (await pg.isVisible('#dlg [data-act="go"]')) { await tap('#dlg [data-act="go"]'); await pg.waitForTimeout(300); }
  ok(await pg.evaluate(() => (WOK_APP.game.s.decl.me || { targets: [] }).targets.includes('hinten')), name + ': Angriff auf das Ziel hinter dem Helden festgelegt');
  // Pfeil liegt zwischen Angreifer und Ziel (nicht beim König)
  const geo = await pg.evaluate(() => { const svg = document.getElementById('arrows'), sb = svg.getBoundingClientRect(), bb = document.getElementById('board').getBoundingClientRect(), l = svg.querySelector('line'); if (!l) return null;
    const px = (x, y) => [sb.left + x / 700 * sb.width, sb.top + y / 700 * sb.height]; const c = f => { const r = document.querySelector('.cell[data-f="' + f + '"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    return { svgH: Math.round(sb.height), boardH: Math.round(bb.height), p1: px(+l.getAttribute('x1'), +l.getAttribute('y1')), p2: px(+l.getAttribute('x2'), +l.getAttribute('y2')), a: c('C3'), t: c('C4') }; });
  ok(geo && Math.abs(geo.svgH - geo.boardH) <= 1, name + ': Pfeil-Ebene so groß wie das Spielfeld: ' + JSON.stringify(geo && [geo.svgH, geo.boardH]));
  const between = v => geo && v[1] >= Math.min(geo.a[1], geo.t[1]) - 1 && v[1] <= Math.max(geo.a[1], geo.t[1]) + 1 && Math.abs(v[0] - geo.a[0]) < 3;
  ok(geo && between(geo.p1) && between(geo.p2) && Math.abs(geo.p1[1] - geo.a[1]) < Math.abs(geo.p2[1] - geo.a[1]), name + ': Pfeil verläuft vom Angreifer zum Ziel: ' + JSON.stringify(geo));
  await pg.screenshot({ path: '/tmp/claude-0/wokui/pfeil-' + name + '.png' });
  // Angriff wieder abwählen: (1) Ziel nochmal antippen, (2) Knopf in der Leiste
  const D = () => pg.evaluate(() => (WOK_APP.game.s.decl.me || { targets: [] }).targets.slice());
  if (!(await pg.evaluate(() => WOK_APP.game.sel && WOK_APP.game.sel.uid === 'me'))) { await tap('.tok[data-uid="me"]'); await pg.waitForTimeout(300); }
  await tap('.tok[data-uid="hinten"]'); await pg.waitForTimeout(400);
  ok((await D()).length === 0, name + ': Ziel nochmal antippen nimmt den Angriff zurück: ' + JSON.stringify(await D()));
  await tap('.tok[data-uid="hinten"]'); await pg.waitForTimeout(400); if (await pg.isVisible('#dlg [data-act="go"]')) { await tap('#dlg [data-act="go"]'); await pg.waitForTimeout(300); }
  ok((await D()).includes('hinten'), name + ': erneut angreifen klappt');
  if (!(await pg.$('#pb-bot [data-popact="undecl"]'))) { await tap('.tok[data-uid="me"]'); await pg.waitForTimeout(400); }
  if (!(await pg.$('#pb-bot [data-popact="undecl"]'))) { await tap('.tok[data-uid="me"]'); await pg.waitForTimeout(400); }
  ok(/zurücknehmen/.test(await pg.textContent('#pb-bot')), name + ': Leiste zeigt „Angriff … zurücknehmen“');
  await pg.screenshot({ path: '/tmp/claude-0/wokui/undecl-' + name + '.png' });
  await tap('#pb-bot [data-popact="undecl"]'); await pg.waitForTimeout(400);
  ok((await D()).length === 0 && /Battlephase abschließen/.test(await pg.textContent('#mainbtn')) && !/Angriff\)/.test(await pg.textContent('#mainbtn')), name + ': Knopf nimmt den Angriff zurück, Pfeil weg: ' + await pg.textContent('#mainbtn'));
  ok(await pg.evaluate(() => !document.querySelector('#arrows line')), name + ': kein Pfeil mehr');
  // Gabe über die Leiste einsetzen
  if (!(await pg.$('#pb-bot [data-qg="mordlust"]'))) { await tap('.tok[data-uid="me"]'); await pg.waitForTimeout(400); }
  if (!(await pg.$('#pb-bot [data-qg="mordlust"]'))) { await tap('.tok[data-uid="me"]'); await pg.waitForTimeout(400); }
  await tap('#pb-bot [data-qg="mordlust"]'); await pg.waitForTimeout(400);
  if (await pg.isVisible('#dlg [data-act="go"]')) { await tap('#dlg [data-act="go"]'); await pg.waitForTimeout(400); }
  ok(await pg.evaluate(() => WOK_APP.game.s.units.me.fx.some(e => e.id === 'mordlust')), name + ': Gabe über die Leiste eingesetzt');
  console.log(name, 'Seitenfehler:', errs); if (errs.length) failN++; await ctx.close();
}
(async () => { const b = await chromium.launch(); await run(b, 'handy', { width: 390, height: 844 }, true); await run(b, 'pc', { width: 1366, height: 900 }, false); await b.close();
  console.log('Pfeil und Gaben: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); process.exit(failN ? 1 : 0); })();
