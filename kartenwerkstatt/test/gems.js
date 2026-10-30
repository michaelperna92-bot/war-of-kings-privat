const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1200);
  const out = await p.evaluate(async () => {
    const res = {};
    const st = Object.assign({}, STYLE_DEFAULT, { energy: 'rubin', atk: 'saphir', def: 'smaragd', element: 'amethyst' });
    for (const [v, base] of [[2, G.frames[1]], [4, G.frames[3]]]) {
      const f = R.styleFrame(base, G.layout, st);
      for (const k of ['energy', 'atk', 'def']) {
        const P = G.layout.gems[k], R0 = P.r + 30, c = document.createElement('canvas'); c.width = c.height = R0 * 2;
        c.getContext('2d').drawImage(f, P.x - R0, P.y - R0, R0 * 2, R0 * 2, 0, 0, R0 * 2, R0 * 2);
        res['v' + v + '_' + k] = c.toDataURL('image/png');
        const o = document.createElement('canvas'); o.width = o.height = R0 * 2; o.getContext('2d').drawImage(base, P.x - R0, P.y - R0, R0 * 2, R0 * 2, 0, 0, R0 * 2, R0 * 2);
        res['v' + v + '_' + k + '_orig'] = o.toDataURL('image/png');
      }
    }
    res.gems = JSON.stringify(G.layout.gems); res.keys = Object.keys(R.GEMS).join(',');
    return res;
  });
  for (const [k, v] of Object.entries(out)) if (v.startsWith('data:')) fs.writeFileSync('/tmp/claude-0/chk/gem_' + k + '.png', Buffer.from(v.split(',')[1], 'base64'));
  console.log(out.gems); console.log(out.keys);
  await b.close();
})();
