// Starter-Set + Packs: Import aus der Werkstatt, Spielermodus, Kaufen mit Test-Gold, Doppelte tauschen, Chancen-Simulation
const { chromium } = require('playwright');
const SH = '/tmp/claude-0/sf/shots/', fs = require('fs');
const pick = k => SH + fs.readdirSync(SH).filter(f => new RegExp('^WoK_' + k + '_.*\\.zip$').test(f)).sort().pop(); const zips = [pick('Starter'), pick('Packs')];
(async () => { const b = await chromium.launch();
  { const pg = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(600); await pg.click('[data-go="decks"]'); await pg.click('[data-dtab="cards"]'); await pg.waitForTimeout(200);
    await pg.setInputFiles('#imp', zips); await pg.waitForTimeout(2500);
    console.log('Toast:', await pg.textContent('#toast'));
    console.log('Econ:', await pg.evaluate(() => JSON.stringify({ st: WOK_ECON.E.starter, pk: WOK_ECON.E.pack.length })));
    await pg.click('[data-econ="mode"]'); await pg.waitForTimeout(300);
    console.log('Box:', (await pg.textContent('#econbox')).replace(/\s+/g, ' ').slice(0, 200));
    console.log('Sammlung sichtbar:', await pg.evaluate(() => [...document.querySelectorAll('#pool .ctile')].map(t => t.querySelector('b').textContent.trim() + ' ' + ((t.querySelector('.cnt-badge') || {}).textContent || '')).join(' | ')));
    await pg.screenshot({ path: SH + 'econ-coll.png' });
    // Deck-Editor: nur Besitz
    // Basar
    await pg.evaluate(() => { window.WOK_MENU && (WOK_MENU.video = 'basar/test.webm'); }); await pg.click('[data-go="home"]').catch(() => {}); await pg.evaluate(() => document.querySelector('[data-go="bazar"]').click()); await pg.waitForTimeout(500);
    await pg.click('#bz-skip').catch(() => {}); await pg.waitForTimeout(800);
    await pg.click('[data-buy="p7:gold"]'); await pg.waitForTimeout(400); console.log('ohne Gold:', await pg.textContent('#toast'));
    await pg.click('[data-tgold]'); await pg.click('[data-tgold]'); await pg.waitForTimeout(200); console.log('Gold:', await pg.textContent('#bz-gold'), '|', await pg.textContent('#bz-pity'));
    await pg.screenshot({ path: SH + 'econ-bazar.png' });
    await pg.click('[data-buy="p12:gold"]'); await pg.waitForTimeout(500); await pg.click('.po-pack'); await pg.waitForTimeout(1300); await pg.click('[data-po="all"]'); await pg.waitForTimeout(2200);
    console.log('Pack:', (await pg.textContent('.po-head')).trim(), '| NEU:', await pg.$$eval('.po-new', x => x.length));
    await pg.screenshot({ path: SH + 'econ-pack.png' }); await pg.click('.po-x, [data-po="close"]'); 
    for (let i = 0; i < 4; i++) { await pg.click('[data-buy="p12:gold"]'); await pg.waitForTimeout(150); await pg.evaluate(() => { const o = document.querySelector('#packov'); o.hidden = true; o.innerHTML = ''; }); }
    console.log('Gold danach:', await pg.textContent('#bz-gold'));
    await pg.evaluate(() => document.querySelector('.bz-tl [data-go="home"]').click()); await pg.evaluate(() => document.querySelector('[data-go="decks"]').click()); await pg.click('[data-dtab="cards"]'); await pg.waitForTimeout(300);
    console.log('Coll:', await pg.evaluate(() => JSON.stringify(WOK_ECON.E.coll)), 'Tausch-Knopf:', await pg.textContent('[data-econ="swap"]'));
    await pg.click('[data-econ="swap"]'); await pg.waitForTimeout(200); await pg.screenshot({ path: SH + 'econ-swap.png' }); await pg.click('#dlg [data-act="yes"]'); await pg.waitForTimeout(300);
    console.log('nach Tausch:', await pg.textContent('#toast'), await pg.evaluate(() => JSON.stringify(WOK_ECON.E.coll) + ' Gold ' + WOK_ECON.E.gold));
    await pg.screenshot({ path: SH + 'econ-coll2.png' });
    await pg.click('[data-dtab="decks"]'); await pg.click('#newdeck'); await pg.waitForTimeout(300);
    console.log('Editor-Karten:', await pg.evaluate(() => [...document.querySelectorAll('#ed-pool .ptile')].map(x => x.querySelector('b').textContent + ' ' + ((x.querySelector('.cnt-badge') || {}).textContent || '') + (x.classList.contains('full') ? ' voll' : '')).join(', ')));
    for (let i = 0; i < 4; i++) await pg.click('#ed-pool .ptile:has-text("Wache") .cimg', { force: true }); await pg.waitForTimeout(200);
    console.log('4× Wache:', await pg.textContent('#ed-pool .ptile:has-text("Wache") .cnt-badge'), '|', await pg.textContent('#toast'));
    console.log('Fehler A:', errs); await pg.close(); }
  { // Simulation der Chancen mit Demo-Karten
    const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(600);
    const r = await pg.evaluate(() => { const C = Object.values(window.__POOLCARDS || {}); return null; });
    const res = await pg.evaluate(() => {
      const E = WOK_ECON.E; const ids = Object.keys(WOK_ECON_POOL()); E.pack = ids; E.coll = {}; E.pity = { hero: 0, king: 0 };
      let hero = 0, king = 0, packs = 50000, gapH = 0, gapK = 0, lh = 0, lk = 0, rare = [0, 0, 0], sure = 0;
      for (let i = 1; i <= packs; i++) { const p = WOK_ECON.roll(7, true); const nh = p.cards.filter(c => c.rarity === 'legendaer' && c.type !== 'king').length, nk = p.cards.filter(c => c.rarity === 'legendaer' && c.type === 'king').length;
        if (nh) { hero++; gapH = Math.max(gapH, i - lh); lh = i; } if (nk) { king++; gapK = Math.max(gapK, i - lk); lk = i; } rare[Math.min(2, p.cards.filter(c => c.rarity === 'selten').length)]++; sure += p.pity.length; }
      return { packs, heroPer: (packs / hero).toFixed(1), kingPer: (packs / king).toFixed(1), gapH, gapK, rare0: (rare[0] / packs * 100).toFixed(1), rare1: (rare[1] / packs * 100).toFixed(1), rare2: (rare[2] / packs * 100).toFixed(1), garantien: sure };
    }).catch(e => 'Fehler: ' + e.message);
    console.log('Simulation:', res, errs); }
  await b.close(); })();
