// Cloud-Ablauf: Deck-Datei laden (Beispiel-Deck), Demo verschwindet, Deck als Datei speichern über claude.use('downloads')
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.claude = { use: async n => n === 'downloads' ? { save: async ({ filename, data }) => { if (!/\.(zip|json|png|txt)$/i.test(filename)) throw { code: 'rejected_extension' }; window.__dl = { filename, size: data.size }; } } : null }; });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(1500);
  console.log('vorher:', await pg.evaluate(() => [Object.keys(WOK_APP.POOL.cards).length, WOK_APP.POOL.decks.map(d => d.name)]));
  await pg.click('[data-go="decks"]'); await pg.setInputFiles('#imp', '/tmp/claude-0/chk/WoK_Deck_Mein_Testdeck.wokspiel'); await pg.waitForTimeout(3000);
  console.log('nachher:', await pg.evaluate(() => [Object.keys(WOK_APP.POOL.cards).length, Object.keys(WOK_APP.POOL.cards).filter(i => i.startsWith('demo_')).length, WOK_APP.POOL.decks.map(d => d.name + ':' + d.cards.length + ':' + d.origin), Object.keys(WOK_APP.POOL.full).length]));
  await pg.click('#exportdeck'); await pg.waitForTimeout(1500); console.log('Download:', await pg.evaluate(() => window.__dl));
  console.log(errs); await b.close();
})();
