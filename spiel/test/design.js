const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html');
  await pg.waitForFunction(() => Object.keys(WOK_APP.POOL.fullv).length >= 34, null, { timeout: 120000 });
  console.log('Demo gezeichnet:', await pg.evaluate(() => Object.values(WOK_APP.POOL.fullv).filter(v => v === WOK_CARDART.VERSION).length));
  await pg.click('[data-go="decks"]'); await pg.setInputFiles('#imp', '/tmp/claude-0/chk/sicherung.json');
  await pg.waitForFunction(() => WOK_APP.POOL.fullv.test_akuma === WOK_CARDART.VERSION, null, { timeout: 60000 });
  console.log('Import gezeichnet, Bildausschnitt:', await pg.evaluate(() => !!WOK_APP.POOL.art.test_akuma));
  await pg.click('[data-zoom="test_akuma"]'); await pg.waitForTimeout(400); await pg.screenshot({ path: '/tmp/claude-0/wokui/zoom.png' }); await pg.click('#dlg [data-act="close"]');
  await pg.click('[data-go="home"]'); await pg.click('[data-hplay="ai"]').then(() => pg.click('#start')); await pg.waitForTimeout(500);
  for (let i = 0; i < 200; i++) { const ok = await pg.evaluate(() => { const s = WOK_APP.game.s; return s.active === 0 && s.phase === 'summon1' && s.turn >= 8; }); if (ok) break; await pg.evaluate(() => { const g = WOK_APP.game, s = g.s; if (s.active === 0 && !s.result) { const a = WOK_AI.decide(s, 0, 'mittel', g._m || (g._m = { seed: 4 })); if (a) WOK_APP.dispatch(a); } }); await pg.waitForTimeout(150); }
  // eigene Karte und gegnerische Karte antippen
  const ids = await pg.evaluate(() => { const s = WOK_APP.game.s; const u = Object.values(s.units); return [u.find(x => x.owner === 0 && !x.king), u.find(x => x.owner === 1 && !x.king)].map(x => x && x.uid); });
  if (ids[0]) { await pg.click('.tok[data-uid="' + ids[0] + '"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: '/tmp/claude-0/wokui/detail-own.png' }); }
  if (ids[1]) { await pg.click('.tok[data-uid="' + ids[1] + '"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: '/tmp/claude-0/wokui/detail-foe.png' }); }
  // Spielhilfe: bis zur Battlephase und Abschluss versuchen
  await pg.click('#mainbtn'); await pg.waitForTimeout(200);
  if (await pg.isVisible('#ov')) { console.log('Hilfe bei summon1:', await pg.textContent('#dlg .advice')); await pg.click('#dlg [data-act="go"]'); }
  await pg.click('#mainbtn'); await pg.waitForTimeout(200);
  if (await pg.isVisible('#ov')) { console.log('Hilfe bei Bewegung:', await pg.textContent('#dlg .advice')); await pg.screenshot({ path: '/tmp/claude-0/wokui/help-move.png' }); await pg.click('#dlg [data-act="go"]'); }
  await pg.click('#mainbtn'); await pg.waitForTimeout(200);
  if (await pg.isVisible('#ov')) { console.log('Hilfe bei Battle:', await pg.textContent('#dlg .advice')); await pg.screenshot({ path: '/tmp/claude-0/wokui/help-battle.png' }); }
  console.log(errs);
  await b.close();
})();
