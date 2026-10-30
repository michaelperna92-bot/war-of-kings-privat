const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/', MODE = process.argv[2] || 'first';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1200);
  if (MODE === 'first') await require('./expsetup.js')(p, SH);
  if (MODE === 'rename') { await p.click('.libitem >> text=Nebelpfeil Syra'); await p.waitForTimeout(800); await p.fill('#in-name', 'Nebelpfeil Syra II'); await p.click('#btn-save'); await p.waitForTimeout(600); }
  if (MODE === 'delete') { await p.click('.libitem >> text=Nebelpfeil Syra II'); await p.waitForTimeout(800); await p.click('[data-act="delete"]'); await p.click('[data-act="delete-ok"]'); await p.waitForTimeout(600); }
  await p.click('[data-act="menu"]'); await p.click('[data-act="engine-export"]'); await p.waitForTimeout(400);
  if (MODE === 'first') {
    console.log('Ziele:', await p.$$eval('.ex-target b', e => e.map(x => x.textContent).join(', ')));
    await p.click('input[name=ex-target][value=unity]'); await p.waitForTimeout(300);
    console.log('Vorher:', await p.textContent('#ex-dest'));
    await p.click('[data-act="ex-pick"]'); await p.waitForTimeout(600);
    console.log('Nachher:', await p.textContent('#ex-dest'));
    await p.screenshot({ path: SH + 'ex-dialog.png' });
  }
  await p.check('input[name=ex-scope][value=alle]');
  await p.click('[data-act="ex-go"]');
  await p.waitForFunction(() => /✓|fehlgeschlagen/.test(document.querySelector('#ex-status').textContent), null, { timeout: 120000 });
  console.log('Status:', (await p.textContent('#ex-status')).replace(/\s+/g, ' '));
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
