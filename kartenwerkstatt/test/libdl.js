const { chromium } = require('playwright');
const fs = require('fs');
const SH = '/home/claude/cc/test/', MODE = process.argv[2] || 'desk';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext(MODE === 'phone' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 1000 } });
  if (MODE === 'desk') await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  else {
    await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 302, headers: { location: 'http://localhost:8770/css?' + r.request().url().split('?')[1] } }));
    await ctx.addInitScript(() => { const dl = { save: async ({ filename, data }) => { const buf = new Uint8Array(await data.arrayBuffer()); window.__dl = { filename, size: buf.length, b64: btoa(Array.from(buf, c => String.fromCharCode(c)).join('')) }; } };
      window.claude = { use: async n => n === 'downloads' ? dl : null }; });
  }
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(MODE === 'desk' ? 'http://127.0.0.1:47831/' : 'http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1200);
  const pill = async t => console.log(t.padEnd(26), (await p.textContent('#pw-float')).trim(), '| Farbe:', await p.getAttribute('#pw-float', 'data-r'));
  const mk = async (name, atk, def, dirs, release) => {
    await p.click('[data-act="new"]').catch(() => {}); await p.waitForTimeout(400);
    if (MODE === 'phone') { await p.click('[data-tab="card"]').catch(() => {}); }
    await p.setInputFiles('#file-art', SH + 'akuma_art.png'); await p.waitForTimeout(1500);
    await p.fill('#in-name', name); await p.fill('#in-atk', String(atk)); await p.fill('#in-def', String(def));
    await p.click('[data-pick="element"][data-val="feuer"]'); await p.click('[data-pick="race"][data-val="mensch"]'); await p.click('[data-pick="class0"][data-val="krieger"]');
    await p.click('[data-dir="atk:n"]'); for (const d of dirs) await p.click(`[data-dir="mov:${d}"]`);
    await p.waitForTimeout(300); await pill(name + ':');
    await p.click('#btn-save'); await p.waitForTimeout(500);
    if (release) { await p.click('[data-status="freigegeben"]'); await p.click('#btn-save'); await p.waitForTimeout(500); }
  };
  await mk('Testheld Eins', 800, 600, ['n'], true);
  await mk('Testheld Zwei', 2000, 2000, ['n', 'w', 'e', 's', 'nw', 'ne', 'sw', 'se'], true);
  await mk('Testheld Drei', 1500, 1200, ['n', 'w', 'e'], false);
  const pw = await p.$eval('.sec[data-sec="power"]', e => e.innerText.match(/\d+ Laufrichtungen?\s+\d+/g));
  console.log('Laufrichtungen im Scaling:', pw);
  if (MODE === 'phone') { await p.evaluate(() => document.querySelector('.sec[data-sec="gaben"]').scrollIntoView()); await p.waitForTimeout(300); await p.screenshot({ path: SH + 'l-phone-scrolled.png' }); }
  else { await p.evaluate(() => { const s = document.querySelector('.sec[data-sec="gaben"]'); s.scrollIntoView(); }); await p.screenshot({ path: SH + 'l-desk.png' }); }
  // Bibliothek herunterladen
  if (MODE === 'phone') await p.click('[data-tab="lib"]');
  await p.click('.lib-dl button'); await p.waitForTimeout(300);
  console.log('Dialog:', (await p.textContent('#modal')).replace(/\s+/g, ' ').slice(0, 260));
  await p.click('[data-act="lib-dl-go"]');
  await p.waitForFunction(() => document.querySelector('#ld-go') && document.querySelector('#ld-go').dataset.act === 'lib-dl-go' && /gespeichert|ZIP|Keine/.test(document.querySelector('#ld-status').textContent), null, { timeout: 90000 });
  console.log('Status:', await p.textContent('#ld-status'));
  if (MODE !== 'desk') { const d = await p.evaluate(() => window.__dl); fs.writeFileSync('/tmp/claude-0/lib.zip', Buffer.from(d.b64, 'base64')); console.log('ZIP:', d.filename, d.size); }
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
