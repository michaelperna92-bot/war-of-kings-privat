const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500); await pg.click('.htut'); await pg.waitForTimeout(400);
  console.log(await pg.evaluate(() => ({ tut: !document.querySelector('#v-tutorial').hidden, n: document.querySelectorAll('[data-tut]').length, home: !document.querySelector('#v-home').hidden })), errs);
  await pg.screenshot({ path: '/tmp/claude-0/sf/shots/dbg.png' }); await b.close(); })();
