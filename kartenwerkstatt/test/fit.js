const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1500);
  const res = await p.evaluate(async () => {
    const R = WOK_RENDER, D = WOK_DATA, L = R.defaultLayout(), out = [];
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1536; const ctx = cv.getContext('2d');
    // Extremfall: breite Ersatzschrift für alle Text-Schriften
    R.FONTS.__wide = { name: 'Breit', family: 'DejaVu Serif', w: [400, 700], k: 1.0, kind: 'Test' };
    const sets = Object.keys(R.FONT_SETS).map(k => ({ fontSet: k })).concat([{ fontSet: 'original', fonts: { text: '__wide', title: '__wide' } }]);
    for (const st of sets) {
      const fams = R.fontsNeeded(st); await Promise.all(fams.map(f => document.fonts.load(f).catch(() => 0)));
      for (let i = 0; i < D.GIFTS.length; i += 3) {
        for (let rot = 0; rot < 3; rot++) {
          const gs = [0, 1, 2].map(j => ({ id: D.GIFTS[(i + (j + rot) % 3) % D.GIFTS.length].id }));
          const card = { name: 'Test', style: st, attack: { dirs: {} }, move: { dirs: {} }, classes: [], gifts: gs };
          const iss = R.draw(ctx, card, L, { crests: {}, giftCrests: {} }, { placeholder: false });
          for (const x of iss) if (x.code === 'giftOverflow' || x.code === 'giftSmall') out.push((st.fonts ? 'BREIT' : st.fontSet) + ': ' + x.code + ' ' + x.info);
        }
      }
      // kleinste Schriftgröße messen
    }
    return out;
  });
  console.log('Probleme:', res.length ? [...new Set(res)] : 'keine');
  await b.close();
})();
