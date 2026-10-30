const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1300, height: 950 } })).newPage();
  p.on('pageerror', e => console.log('Seitenfehler:', e.message));
  await p.goto('http://127.0.0.1:47831/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1500);
  await p.evaluate(() => engineExportDialog());
  await p.check('input[name=ex-target][value=generic]'); await p.check('input[name=ex-what][value=' + (process.argv[2] || 'kit') + ']');
  await p.screenshot({ path: '/home/claude/cc/test/kit-dialog.png' });
  console.log('Kartenauswahl gesperrt:', await p.evaluate(() => [...document.querySelectorAll('input[name=ex-scope]')].every(i => i.disabled)));
  await p.click('#ex-go');
  await p.waitForFunction(() => /✓|fehlgeschlagen|Keine/.test(document.querySelector('#ex-status').textContent), null, { timeout: 300000 });
  console.log(await p.textContent('#ex-status')); await b.close();
})();
