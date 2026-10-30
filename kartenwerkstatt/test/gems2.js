const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1200);
  const out = await p.evaluate(async () => {
    const res = [], themes = Object.keys(R.THEMES), gems = Object.keys(R.GEMS).filter(g => g !== 'original');
    // Rest-Prüfung: Anteil Pixel im erkannten Stein, die noch den Ursprungs-Farbton haben
    const stat = (base, f, k) => {
      const P = G.layout.gems[k], R0 = P.r + 12, a = base.getContext ? base : null;
      const c1 = document.createElement('canvas'), c2 = document.createElement('canvas'); c1.width = c2.width = c1.height = c2.height = R0 * 2;
      c1.getContext('2d').drawImage(base, P.x - R0, P.y - R0, R0 * 2, R0 * 2, 0, 0, R0 * 2, R0 * 2); c2.getContext('2d').drawImage(f, P.x - R0, P.y - R0, R0 * 2, R0 * 2, 0, 0, R0 * 2, R0 * 2);
      const A = c1.getContext('2d').getImageData(0, 0, R0 * 2, R0 * 2).data, B = c2.getContext('2d').getImageData(0, 0, R0 * 2, R0 * 2).data;
      const hsl = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; };
      let gemPx = 0, left = 0;
      for (let i = 0; i < A.length; i += 4) { const [h, s] = hsl(A[i], A[i + 1], A[i + 2]); if (s < 0.35) continue; const src = k === 'atk' ? 0 : 218; const dd = Math.min(Math.abs(h - src), 360 - Math.abs(h - src)); if (dd > 40) continue; gemPx++; const [h2, s2] = hsl(B[i], B[i + 1], B[i + 2]); const d2 = Math.min(Math.abs(h2 - src), 360 - Math.abs(h2 - src)); if (s2 > 0.35 && d2 < 25) left++; }
      return [gemPx, left];
    };
    for (const v of [1, 2, 3]) for (const gk of gems) {
      const st = Object.assign({}, STYLE_DEFAULT, { energy: gk, atk: gk, def: gk });
      const f = R.styleFrame(G.frames[v], G.layout, st);
      for (const k of ['energy', 'atk', 'def']) { const [n, l] = stat(G.frames[v], f, k); const tgt = R.GEMS[gk].h; const srcH = k === 'atk' ? 0 : 218; const same = Math.min(Math.abs(tgt - srcH), 360 - Math.abs(tgt - srcH)) < 25; if (!same && l / Math.max(1, n) > 0.01) res.push('v' + v + ' ' + gk + ' ' + k + ': ' + l + '/' + n + ' Pixel Restfarbe'); }
    }
    // Rahmenfarben: Steine im Original sollen unverändert bleiben
    for (const t of themes) { const st = Object.assign({}, STYLE_DEFAULT, { theme: t }); const f = R.styleFrame(G.frames[1], G.layout, st); for (const k of ['energy', 'atk', 'def']) { const [n, l] = stat(G.frames[1], f, k); if (l / Math.max(1, n) < 0.97) res.push('Rahmen ' + t + ' verändert Stein ' + k + ': nur ' + l + '/' + n + ' unverändert'); } }
    const pic = []; for (const [t, gk] of [['karmesin', 'smaragd'], ['obsidian', 'topas'], ['elfenbein', 'amethyst'], ['blau', 'onyx']]) { const st = Object.assign({}, STYLE_DEFAULT, { theme: t, energy: gk, atk: gk, def: gk }); const f = R.styleFrame(G.frames[1], G.layout, st); const c = document.createElement('canvas'); c.width = 1024; c.height = 230; c.getContext('2d').drawImage(f, 0, 740, 1024, 230, 0, 0, 1024, 230); pic.push(c.toDataURL()); }
    return { res, themes, pic };
  });
  console.log('Rahmen:', out.themes.join(', ')); console.log('Auffälligkeiten:', out.res.length ? out.res : 'keine');
  out.pic.forEach((d, i) => fs.writeFileSync('/tmp/claude-0/chk/combo' + i + '.png', Buffer.from(d.split(',')[1], 'base64')));
  await b.close();
})();
