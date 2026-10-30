const { chromium } = require('playwright');
const fs = require('fs');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1000);
  await require('./expsetup.js')(p, SH);
  const oldSrc = fs.readFileSync('/tmp/claude-0/old_render.js', 'utf8').replace('window.WOK_RENDER =', 'window.WOK_RENDER_OLD =');
  const res = await p.evaluate(async (oldSrc) => {
    eval(oldSrc);
    const out = [];
    const ALL = ['art','frame','energy','name','elementCrest','elementLabel','slotCrests','slotLabels','stats','grids','banner','giftsTitle','giftEmpty','giftCrests','giftTexts','giftCtBg','giftCtText','rarityCrest','rarityLabel'];
    for (const raw of ST.list()) {
      const card = normalize(clone(raw)); const art = await loadArtFor(card); const res = resFor(art, card);
      const mk = () => { const c = document.createElement('canvas'); c.width = 1024; c.height = 1536; return c; };
      await ensureFonts(card.style);
      const a = mk(), o = mk(), l = mk();
      R.draw(a.getContext('2d'), card, G.layout, res, { placeholder: false });
      window.WOK_RENDER_OLD.draw(o.getContext('2d'), card, G.layout, res, { placeholder: false });
      const lg = l.getContext('2d'); lg.fillStyle = '#07090b'; lg.fillRect(0, 0, 1024, 1536);
      const t = mk(); R.draw(t.getContext('2d'), card, G.layout, res, { placeholder: false, layers: new Set(ALL) }); lg.drawImage(t, 0, 0);
      const diff = (x, y) => { const A = x.getContext('2d').getImageData(0, 0, 1024, 1536).data, B = y.getContext('2d').getImageData(0, 0, 1024, 1536).data; let n = 0, mx = 0; for (let i = 0; i < A.length; i += 4) { const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); if (d > 12) n++; if (d > mx) mx = d; } return { pixels: n, max: mx }; };
      out.push({ name: card.name, newVsOld: diff(a, o), layersVsFull: diff(a, l) });
    }
    return out;
  }, oldSrc);
  console.log(JSON.stringify(res, null, 1));
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
