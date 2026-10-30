// Kampfmusik: startet mit der Partie, nächster Song nach Ende, aus/an
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(400);
  console.log('Liste:', await pg.evaluate(() => window.WOK_MUSIC));
  await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await pg.waitForTimeout(2500);
  const st = () => pg.evaluate(() => { const a = document.querySelector('audio') || null; return null; });
  console.log('läuft:', await pg.evaluate(() => [WOK_APP_MUSIC.playing, WOK_APP_MUSIC.now, WOK_APP_MUSIC.au.duration.toFixed(0), WOK_APP_MUSIC.au.currentTime > 0]));
  const first = await pg.evaluate(() => WOK_APP_MUSIC.now);
  const seq = []; for (let k = 0; k < 6; k++) { await pg.evaluate(() => WOK_APP_MUSIC.au.dispatchEvent(new Event('ended'))); await pg.waitForTimeout(700); seq.push(await pg.evaluate(() => WOK_APP_MUSIC.now)); } console.log('Folge:', seq.join(' | '));
  console.log('nach Songende:', first, '→', await pg.evaluate(() => WOK_APP_MUSIC.now), await pg.evaluate(() => WOK_APP_MUSIC.playing));
  await pg.click('#music'); await pg.waitForTimeout(300); console.log('aus:', await pg.evaluate(() => [WOK_APP_MUSIC.playing, document.querySelector('#music').textContent]));
  await pg.click('#music'); await pg.waitForTimeout(1500); console.log('an:', await pg.evaluate(() => WOK_APP_MUSIC.playing));
  console.log('Fehler:', errs); await b.close();
})();
