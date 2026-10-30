const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  // Handy mit Touch
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
  const p = await m.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1200);
  await p.evaluate(() => window.scrollBy(0, 10)); await p.waitForTimeout(300);
  const tr = await p.$('.fs-track.page'); const vis = await tr.isVisible();
  const box = await (await p.$('.fs-track.page .fs-thumb')).boundingBox();
  console.log('Handy-Stab sichtbar:', vis, 'Griff', Math.round(box.width) + '×' + Math.round(box.height), 'bei x', Math.round(box.x));
  // Griff ziehen bis unten
  await p.mouse.move(box.x + box.width / 2, box.y + 10); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2, 840, { steps: 10 }); await p.mouse.up();
  await p.waitForTimeout(300);
  const y1 = await p.evaluate(() => [window.scrollY, document.scrollingElement.scrollHeight - innerHeight]);
  console.log('Nach Ziehen nach unten: scrollY', Math.round(y1[0]), 'von', y1[1]);
  await p.screenshot({ path: SH + 'scroll-phone.png' });
  // Tippen oben auf die Leiste
  const t = await tr.boundingBox(); await p.touchscreen.tap(t.x + t.width / 2, t.y + 8); await p.waitForTimeout(300);
  console.log('Nach Tippen oben: scrollY', await p.evaluate(() => Math.round(window.scrollY)));
  // Desktop: Bearbeitungsmenü
  const d = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await d.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
  const q = await d.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto('http://localhost:8770/'); await q.waitForSelector('#preview'); await q.waitForTimeout(1200);
  await q.hover('#panel'); await q.mouse.wheel(0, 50); await q.waitForTimeout(300);
  const tb = await (await q.$('.fs-track:not(.page):not(.slim) .fs-thumb')).boundingBox();
  await q.mouse.move(tb.x + 8, tb.y + 10); await q.mouse.down(); await q.mouse.move(tb.x + 8, tb.y + 400, { steps: 8 }); await q.mouse.up();
  console.log('Desktop-Menü scrollTop:', await q.evaluate(() => Math.round(document.getElementById('panel').scrollTop)));
  await q.screenshot({ path: SH + 'scroll-desk.png' });
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
