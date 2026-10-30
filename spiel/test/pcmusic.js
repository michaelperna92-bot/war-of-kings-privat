const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const pg = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:47851/'); await pg.waitForTimeout(2500);
  if (await pg.isVisible('#ov')) await pg.keyboard.press('Escape');

  await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await pg.waitForTimeout(3000);
  console.log('PC Musik:', await pg.evaluate(() => [WOK_APP_MUSIC.playing, WOK_APP_MUSIC.now, WOK_APP_MUSIC.au.currentTime.toFixed(1)]), '| Spielfeld:', await pg.evaluate(() => document.querySelector('#board').classList.contains('art')));
  await pg.evaluate(() => { WOK_APP_MUSIC.au.currentTime = WOK_APP_MUSIC.au.duration - 1; }); await pg.waitForTimeout(2500);
  console.log('Spulen + nächster Song:', await pg.evaluate(() => WOK_APP_MUSIC.now));
  console.log(errs); await b.close();
})();
