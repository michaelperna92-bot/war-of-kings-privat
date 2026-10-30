// Spielfeld-Grafik: alle 39 Positionen, beide Perspektiven, mehrere Fenstergrößen
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h, n] of [[1366, 900, 'pc'], [1920, 1080, 'fullhd'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
    await pg.click('[data-hplay="ai"]'); await pg.click('[data-mode="hot"]'); await pg.click('#start'); await pg.waitForTimeout(500);
    if (await pg.isVisible('#ov')) await pg.click('#dlg [data-act="go"]');
    for (const view of [0, 1]) {
      const r = await pg.evaluate(v => {
        const G = WOK_APP.game; G.view = v; G.handover = false; document.querySelector('#board').dataset.view = ''; 
        const s = G.s; for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
        WOK_APP.renderNow && WOK_APP.renderNow();
        const bd = document.querySelector('#board').getBoundingClientRect(), out = {}; let bad = 0;
        for (const el of document.querySelectorAll('#board .cell')) { const r = el.getBoundingClientRect(); out[el.dataset.f] = el.dataset.slot; if (r.left < bd.left - 1 || r.right > bd.right + 1 || r.top < bd.top - 1 || r.bottom > bd.bottom + 1) bad++; }
        return { n: Object.keys(out).length, slots: new Set(Object.values(out)).size, d7: out.D7, d1: out.D1, c7: out.C7, a2: out.A2, bad, ratio: (bd.width / bd.height).toFixed(3) };
      }, view);
      console.log(n, 'Sicht', view, JSON.stringify(r));
      await pg.screenshot({ path: OUT + n + '-v' + view + '.png' });
    }
    await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
