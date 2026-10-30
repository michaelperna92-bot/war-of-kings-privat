const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
  await pg.click('[data-go="decks"]');
  await pg.setInputFiles('#imp', process.argv[2]); await pg.waitForTimeout(4000);
  console.log(await pg.textContent('#toast'));
  const r = await pg.evaluate(() => Object.values(WOK_APP.POOL.cards).filter(c => !c.id.startsWith('demo')).map(c => ({ n: c.name, t: c.type, e: c.energy, a: c.atk, d: c.def, hp: c.hp, mv: c.move, at: c.attack, g: c.gifts, img: !!WOK_APP.POOL.art[c.id], full: !!WOK_APP.POOL.full[c.id] })));
  console.log(JSON.stringify(r, null, 0));
  await pg.fill('#q', ''); await pg.screenshot({ path: '/tmp/claude-0/wokui/import.png' });
  // reload persists?
  await pg.reload(); await pg.waitForTimeout(1200); console.log('nach Neuladen:', await pg.evaluate(() => [Object.keys(WOK_APP.POOL.cards).length, Object.keys(WOK_APP.POOL.art).length])); console.log(await pg.textContent('#decksum'));
  console.log(errs);
  await b.close();
})();
