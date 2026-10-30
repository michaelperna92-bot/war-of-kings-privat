const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  await p.setInputFiles('#file-art', SH + 'ai0.jpg'); await p.waitForTimeout(800);
  await p.click('[data-cardtype="curse"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'Fluch der Schwäche');
  await p.fill('#sp-energy', '4');
  await p.click('[data-pick="rarity"][data-val="selten"]');
  // Effekt 1 (Standard): ATK -500 auf eine gegnerische Einheit, 2 Runden
  await p.selectOption('[data-sp="spell.effects.0.target.side"]', 'enemy');
  await p.fill('[data-sp="spell.effects.0.params.amount"]', '-500');
  await p.selectOption('[data-sp="spell.effects.0.duration.kind"]', 'rounds');
  await p.fill('[data-sp="spell.effects.0.duration.n"]', '2');
  // Effekt 2: Gabenblock Schütze
  await p.click('[data-spact="addfx"]'); await p.waitForTimeout(150);
  await p.selectOption('[data-sp="spell.effects.1.kind"]', 'giftBlock'); await p.waitForTimeout(150);
  await p.check('[data-spgift="1:schuetze"]'); await p.waitForTimeout(150);
  await p.selectOption('[data-sp="spell.effects.1.target.side"]', 'enemy');
  // Filter: Klasse Tüftler
  await p.click('[data-spact="addfilter:spell.effects.0.target.filter"]'); await p.waitForTimeout(150);
  await p.selectOption('[data-sp="spell.effects.0.target.filter.items.0.k"]', 'class'); await p.waitForTimeout(150);
  await p.selectOption('[data-sp="spell.effects.0.target.filter.items.0.v"]', 'tueftler'); await p.waitForTimeout(150);
  // Voraussetzung: kontrolliere einen Krieger ODER einen Ritter
  await p.click('[data-sec="voraussetzung"] summary'); await p.waitForTimeout(150);
  await p.click('[data-spact="addcond:spell.require"]'); await p.waitForTimeout(150);
  await p.click('[data-spact="addcond:spell.require"]'); await p.waitForTimeout(150);
  await p.selectOption('[data-sp="spell.require.op"]', 'or'); await p.waitForTimeout(150);
  for (const [i, cls] of [[0, 'krieger'], [1, 'ritter']]) {
    await p.click('[data-spact="addfilter:spell.require.items.' + i + '.filter"]'); await p.waitForTimeout(120);
    await p.selectOption('[data-sp="spell.require.items.' + i + '.filter.items.0.k"]', 'class'); await p.waitForTimeout(120);
    await p.selectOption('[data-sp="spell.require.items.' + i + '.filter.items.0.v"]', cls); await p.waitForTimeout(120);
  }
  console.log('Erzeugt:', await p.textContent('.spgen'));
  await p.fill('#sp-rule', 'Eine gegnerische Tüftler-Einheit erhält ATK -500 für 2 Runden.');
  await p.waitForTimeout(200);
  console.log('Abgleich:', (await p.textContent('#sp-live')).replace(/\s+/g, ' ').slice(0, 400));
  await p.screenshot({ path: SH + 'sp1-curse-panel.png' });
  await p.click('[data-spact="fromfx"]'); await p.waitForTimeout(300);
  console.log('Nach Übernahme:', (await p.textContent('#sp-live')).replace(/\s+/g, ' ').slice(0, 300));
  await p.click('#btn-save'); await p.waitForTimeout(600);
  // Zauber
  await p.evaluate(() => openCard(null)); await p.waitForTimeout(600);
  await p.setInputFiles('#file-art', SH + 'ai0.jpg'); await p.waitForTimeout(800);
  await p.click('[data-cardtype="spell"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'Schild des Lichts'); await p.fill('#sp-energy', '3'); await p.click('[data-pick="rarity"][data-val="gewoehnlich"]');
  await p.selectOption('[data-sp="spell.effects.0.kind"]', 'protect'); await p.waitForTimeout(150);
  await p.click('[data-fx="0"] .spmore summary'); await p.waitForTimeout(100); await p.selectOption('[data-sp="spell.effects.0.trigger"]', 'enemyAttack'); await p.waitForTimeout(150);
  await p.fill('[data-sp="flavor"]', 'Wo das Licht steht, bricht kein Stahl.');
  await p.click('#btn-save'); await p.waitForTimeout(600);
  await p.screenshot({ path: SH + 'sp2-spell.png' });
  const cv = await p.$('#preview'); await cv.screenshot({ path: SH + 'sp3-spell-card.png' });
  console.log('Bibliothek:', await p.$$eval('.libitem', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim())));
  await p.reload(); await p.waitForSelector('.libitem'); await p.waitForTimeout(1200);
  await p.click('.libitem >> text=Fluch der Schwäche'); await p.waitForTimeout(800);
  console.log('Neu geöffnet:', await p.inputValue('#in-name'), '|', await p.textContent('.spgen'));
  const cv2 = await p.$('#preview'); await cv2.screenshot({ path: SH + 'sp4-curse-card.png' });
  console.log('Fehler:', errs);
  await b.close();
})();
