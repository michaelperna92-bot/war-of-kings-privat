// Verteilung: Starter-Set / Packs in der Bibliothek, Exporte "starter" und "packs"
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 980 }, acceptDownloads: true });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => { const dl = { save: async ({ filename, data }) => { const buf = new Uint8Array(await data.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); (window.__dls = window.__dls || []).push({ filename, b64: btoa(s) }); } }; window.claude = { use: async n => n === 'downloads' ? dl : null }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  const mk = async (t, name) => {
    await p.click('[data-act="new"]'); await p.waitForTimeout(200);
    if (await p.isVisible('#modal [data-act="discard"]')) { await p.click('#modal [data-act="discard"]'); await p.waitForTimeout(200); }
    await p.click('[data-act="newtype"][data-t="' + t + '"]'); await p.waitForTimeout(300);
    await p.fill('#in-name', name); await p.press('#in-name', 'Tab'); await p.click('#btn-save'); await p.waitForTimeout(400);
  };
  await mk('king', 'Starterkönig'); await mk('hero', 'Knappe'); await mk('hero', 'Wache'); await mk('hero', 'Packritter'); await mk('spell', 'Packzauber');
  await p.click('[data-act="lib-pick"]');
  for (const n of ['Starterkönig', 'Knappe', 'Wache']) await p.click('.libitem >> text=' + n);
  await p.click('[data-act="pick-starter"]'); await p.selectOption('#st-count', '3'); await p.click('[data-act="pool-starter-go"]'); await p.waitForTimeout(500);
  console.log('Toast:', await p.textContent('#toast').catch(() => ''));
  await p.click('[data-act="pick-none"]'); for (const n of ['Packritter', 'Packzauber']) await p.click('.libitem >> text=' + n);
  await p.click('[data-act="pick-pack"]'); await p.waitForTimeout(500);
  console.log('Chips:', await p.evaluate(() => [...document.querySelectorAll('.libitem')].map(x => x.querySelector('b').textContent + '=' + ((x.querySelector('.fchip.pool') || {}).textContent || '-')).join(' | ')));
  console.log('Zähler:', await p.evaluate(() => [...document.querySelectorAll('.fbtn.pool')].map(x => x.textContent).join(' | ')));
  await p.screenshot({ path: OUT + 'pool-lib.png' });
  await p.click('[data-act="lib-pick"]');
  // Verteilung bleibt beim Speichern
  await p.click('.libitem >> text=Knappe'); await p.waitForTimeout(300); await p.fill('#in-name', 'Knappe II'); await p.press('#in-name', 'Tab'); await p.click('#btn-save'); await p.waitForTimeout(400);
  console.log('Knappe II nach Speichern:', await p.evaluate(() => [...document.querySelectorAll('.libitem')].filter(x => /Knappe II/.test(x.textContent)).map(x => (x.querySelector('.fchip.pool') || {}).textContent)));
  await p.selectOption('#f-pool', 'pack'); await p.waitForTimeout(200); console.log('Filter Packs:', await p.evaluate(() => [...document.querySelectorAll('.libitem b')].map(x => x.textContent).join(', '))); await p.selectOption('#f-pool', '');
  for (const sc of ['starter', 'packs']) {
    await p.click('.lib-dl button[data-act="game-export"]'); await p.waitForTimeout(300);
    if (sc === 'starter') await p.screenshot({ path: OUT + 'pool-export.png' });
    await p.check('input[name=gx-scope][value=' + sc + ']'); await p.click('[data-act="gx-go"]');
    await p.waitForFunction(() => /gespeichert|Nicht/i.test(document.querySelector('#gx-status').textContent), null, { timeout: 120000 }).catch(() => {});
    console.log(sc, ':', await p.textContent('#gx-status')); await p.click('#modal [data-act="close"]'); await p.waitForTimeout(200);
  }
  const d = await p.evaluate(() => window.__dls || []); for (const f of d) { require('fs').writeFileSync(OUT + f.filename, Buffer.from(f.b64, 'base64')); console.log('Datei:', f.filename); }
  console.log('Fehler:', errs); await b.close();
})();
