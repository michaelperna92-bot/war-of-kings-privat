// Basar: nach dem Video sind Packs, Preise und Knöpfe bei allen Bildschirmgrößen vollständig sichtbar
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 650], [1024, 600], [390, 844], [375, 667], [360, 740], [430, 932], [844, 390]]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(400);
    await pg.evaluate(() => { WOK_MENU.video = ''; }); await pg.click('[data-go="bazar"]'); await pg.waitForTimeout(2200);
    const r = await pg.evaluate(() => { const H = innerHeight, W = innerWidth, out = []; for (const el of document.querySelectorAll('.bz-price, .bz-open, #bz-replay, .bz-img')) { const b = el.getBoundingClientRect(); if (b.bottom > H + 1 || b.right > W + 1 || b.top < 0) out.push(el.className + ' ' + Math.round(b.bottom)); } const o = document.querySelector('.bz-offer'); return { cut: out, scroll: o.scrollHeight > o.clientHeight + 2 }; });
    console.log(w + '×' + h, r.cut.length ? 'ABGESCHNITTEN: ' + r.cut.join(', ') : 'alles sichtbar', r.scroll ? '(scrollbar)' : '');
    await pg.screenshot({ path: '/tmp/claude-0/sf/shots/bz-' + w + 'x' + h + '.png' }); await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
