// PC: Sammlung bleibt dauerhaft im Ordner, auch in einem frischen Browser
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const errs = [];
  const fresh = async () => { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); return pg; };
  let pg = await fresh();
  await pg.goto('http://127.0.0.1:47851/'); await pg.waitForTimeout(2500);
  for (let i = 0; i < 2; i++) { if (await pg.isVisible('#ov')) { await pg.click('#dlg [data-act="load"]'); await pg.waitForTimeout(3000); } await pg.waitForTimeout(5500); }
  await pg.click('[data-go="decks"]'); await pg.click('#newdeck'); await pg.fill('#deckname', 'Bleibt da'); await pg.click('#autofill'); await pg.waitForTimeout(4000);
  console.log('A:', await pg.evaluate(() => [Object.keys(WOK_APP.POOL.cards).length, WOK_APP.POOL.decks.map(d => d.name)]), await pg.textContent('#v-decks .storeinfo'));
  await pg.context().close();
  pg = await fresh(); // leerer Browser-Speicher
  await pg.goto('http://127.0.0.1:47851/'); await pg.waitForTimeout(3000);
  console.log('B (frischer Browser):', await pg.evaluate(() => [Object.keys(WOK_APP.POOL.cards).length, Object.keys(WOK_APP.POOL.cards).filter(i => i.startsWith('demo_')).length, WOK_APP.POOL.decks.map(d => d.name + ':' + d.cards.length)]));
  const img = await pg.evaluate(async () => { const id = Object.keys(WOK_APP.POOL.cards).find(i => !i.startsWith('my_')); const el = document.createElement('img'); el.src = document.querySelector('[data-zoom]') ? '' : ''; return id; });
  await pg.click('[data-go="decks"]'); await pg.waitForTimeout(800);
  const loaded = await pg.evaluate(() => [...document.querySelectorAll('.pc .th')].filter(e => /url\(/.test(e.style.backgroundImage)).length);
  console.log('Vorschaubilder:', loaded, '|', await pg.textContent('#v-decks .storeinfo'));
  await pg.screenshot({ path: '/tmp/claude-0/wokui/persist-pc.png' });
  console.log(errs); await b.close();
})();
