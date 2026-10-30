// Asset-Set: Aufbau, Zählung, exakte Zusammensetzung (Rahmen + Stein-Überlagerungen = gerenderter Rahmen)
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1300, height: 950 } })).newPage();
  p.on('pageerror', e => console.log('Seitenfehler:', e.message));
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1500);
  const r = await p.evaluate(async () => {
    const t0 = performance.now();
    const kit = await buildAssetKit({ target: 'generic', scale: 1 }, () => {});
    const ms = performance.now() - t0;
    // Zusammensetzung prüfen: Karmesin + Smaragd/Topas/Amethyst/Onyx
    const load = path => new Promise(res => { const u8 = kit.files.get(path); const im = new Image(); im.onload = () => res(im); im.src = URL.createObjectURL(new Blob([u8], { type: 'image/png' })); });
    const diffs = [];
    for (const [th, v, set] of [['karmesin', 2, { energy: 'smaragd', atk: 'topas', def: 'amethyst', element: 'onyx' }], ['elfenbein', 4, { energy: 'rubin', atk: 'saphir', def: 'jade', element: 'citrin' }], ['obsidian', 3, { energy: 'mondstein', atk: 'aquamarin', def: 'granat', element: 'smaragd' }]]) {
      const C = kit.catalog, c = document.createElement('canvas'); c.width = 1024; c.height = 1536; const g = c.getContext('2d');
      g.drawImage(await load(C.themes.find(t => t.id === th).frames['v' + v]), 0, 0);
      for (const [f, gk] of Object.entries(set)) { const o = C.gems.find(x => x.id === gk).overlays.find(o => o.field === f && o.variants.includes(v)); g.drawImage(await load(o.path), o.rectPx.x, o.rectPx.y, o.rectPx.w, o.rectPx.h); }
      const ref = R.styleFrame(G.frames[v - 1], G.layout, Object.assign({}, STYLE_DEFAULT, { theme: th }, set));
      const c2 = document.createElement('canvas'); c2.width = 1024; c2.height = 1536; c2.getContext('2d').drawImage(ref, 0, 0, 1024, 1536);
      const A = g.getImageData(0, 0, 1024, 1536).data, B = c2.getContext('2d').getImageData(0, 0, 1024, 1536).data; let n = 0, mx = 0;
      for (let i = 0; i < A.length; i++) { const d = Math.abs(A[i] - B[i]); if (d > 2) n++; if (d > mx) mx = d; }
      diffs.push(th + ' v' + v + ': ' + n + ' abweichende Werte, max ' + mx);
    }
    return { ms: Math.round(ms), files: kit.files.size, counts: kit.manifest.counts, missing: kit.manifest.check.missingReferences, noCrest: kit.manifest.check.withoutCrest, mb: [...kit.files.values()].reduce((a, u) => a + u.length, 0) / 1048576, diffs,
      gemFiles: kit.catalog.gems.map(g => g.id + ':' + g.overlays.length).join(' ') };
  });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
