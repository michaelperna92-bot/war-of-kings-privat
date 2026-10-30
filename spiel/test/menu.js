// Hauptmenü, Schlachtvorbereitung (Deck bearbeiten neben Partie starten), Basar mit Video und Packs, Deckbau-Filter
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const errs = [];
  for (const [w, h, n] of [[1366, 768, 'pc'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(900);
    await pg.screenshot({ path: OUT + n + '-menu.png' });
    const hs = await pg.evaluate(() => { const r = document.documentElement; return { scrollW: r.scrollWidth, w: innerWidth }; }); console.log(n, 'Breite', JSON.stringify(hs));
    await pg.click('[data-hplay="ai"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: OUT + n + '-setup.png' });
    console.log(n, 'Knöpfe:', await pg.evaluate(() => [...document.querySelectorAll('.hs-go button')].map(b => b.textContent.trim() + (b.disabled ? ' (aus)' : ''))));
    await pg.click('#editdeck'); await pg.waitForTimeout(500); console.log(n, 'Editor offen:', await pg.isVisible('#dv-edit'));
    if (n === 'phone') { await pg.click('[data-etab="pool"]'); await pg.waitForTimeout(200); }
    const before = await pg.evaluate(() => document.querySelectorAll('#ed-pool .ptile').length);
    const opt = await pg.evaluate(() => { const s = document.querySelector('[data-facet="e:race"]'); return s && s.options[1] ? s.options[1].value : null; });
    if (opt) { await pg.selectOption('[data-facet="e:race"]', opt); await pg.waitForTimeout(200); }
    await pg.selectOption('#esort', 'energyDesc'); await pg.waitForTimeout(200);
    const after = await pg.evaluate(() => [...document.querySelectorAll('#ed-pool .ptile .pe')].map(e => e.textContent).slice(0, 8));
    console.log(n, 'Filter Rasse', opt, before, '→', await pg.evaluate(() => document.querySelectorAll('#ed-pool .ptile').length), '| Energie ↓:', after.join(','));
    await pg.screenshot({ path: OUT + n + '-editor.png' });
    await pg.click('#ed-back'); await pg.waitForTimeout(400); console.log(n, 'zurück im Hauptmenü mit Vorbereitung:', await pg.isVisible('#hsetup'));
    await pg.click('[data-hs="close"]'); await pg.waitForTimeout(200);
    await pg.evaluate(() => { WOK_MENU.video = 'basar/test.webm'; }); // Test-Chromium kann kein H.264
    await pg.click('[data-go="bazar"]'); await pg.waitForTimeout(1500); await pg.screenshot({ path: OUT + n + '-bazar-video.png' });
    console.log(n, 'Video läuft:', await pg.evaluate(() => { const v = document.querySelector('#bz-video'); return [!v.paused, v.currentTime.toFixed(1), v.duration, v.readyState]; }));
    await pg.waitForFunction(() => document.querySelector('#v-bazar').classList.contains('done'), null, { timeout: 15000 }); await pg.waitForTimeout(2000);
    await pg.screenshot({ path: OUT + n + '-bazar-packs.png' });
    await pg.click('[data-buy="p12:eur"]'); await pg.waitForTimeout(300); console.log(n, 'Kauf-Dialog:', (await pg.textContent('#dlg')).slice(0, 90));
    await pg.click('#dlg [data-act="close"]'); await pg.click('.bz-top [data-go="home"]'); await pg.waitForTimeout(300);
    console.log(n, 'Video pausiert nach Verlassen:', await pg.evaluate(() => document.querySelector('#bz-video').paused));
    await pg.click('[data-hnav="settings"]'); await pg.waitForTimeout(300); await pg.screenshot({ path: OUT + n + '-settings.png' }); await pg.click('#dlg [data-act="close"]');
    await pg.click('[data-hnav="quick"]'); await pg.waitForTimeout(1200); console.log(n, 'Schnelles Spiel startet:', await pg.isVisible('#v-game'));
    await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
