// Präsentation: Duell-Start, Auftritt, Kette, Glanz, Begleiter, Aussehen, Liste, Passt dazu, Wiederholung, Pack öffnen, Hintergründe
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  const [w, h, n] = [+process.argv[2] || 1366, +process.argv[3] || 900, process.argv[4] || 'pc'];
  const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(600);
  // Aussehen im Deck setzen
  await pg.click('[data-hplay="ai"]'); await pg.click('#editdeck'); await pg.waitForTimeout(400);
  await pg.click('#lookbox summary'); await pg.click('[data-look="back:rot"]'); await pg.click('[data-look="field:nacht"]'); await pg.click('[data-look="mate:haendler"]');
  await pg.screenshot({ path: OUT + n + '-look.png' });
  if (n === 'phone') await pg.click('[data-etab="pool"]');
  await pg.click('[data-ev="list"]'); await pg.waitForTimeout(200); console.log('Listenansicht Zeilen:', await pg.evaluate(() => document.querySelectorAll('#ed-pool .prow').length));
  await pg.screenshot({ path: OUT + n + '-list.png' });
  const zid = await pg.evaluate(() => document.querySelector('#ed-pool .pr-name').dataset.zoom);
  await pg.click('#ed-pool .pr-name'); await pg.waitForTimeout(900);
  console.log('Passt dazu:', await pg.evaluate(() => document.querySelectorAll('#insp-info .rel').length), '| Glanz-Seltenheit:', await pg.evaluate(() => document.querySelector('#insp-card').dataset.rar));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(500);
  await pg.click('#ed-save'); await pg.waitForTimeout(400);
  console.log('zurück in Vorbereitung:', await pg.isVisible('#hsetup'));
  await pg.click('#start'); await pg.waitForTimeout(700);
  console.log('Duell-Start-Einblendung:', await pg.evaluate(() => !!document.querySelector('#fxlayer .versus')));
  await pg.screenshot({ path: OUT + n + '-versus.png' });
  await pg.waitForFunction(() => document.querySelector('#fxlayer').hidden, null, { timeout: 8000 });
  console.log('Spielfeld-Variante:', await pg.evaluate(() => document.querySelector('#board').dataset.skin), '| Begleiter sichtbar:', await pg.isVisible('#mate'));
  // Auftritt einer legendären Karte erzwingen + Kette
  await pg.evaluate(() => {
    const s = WOK_APP.game.s, leg = Object.values(s.cards).find(c => c.type === 'hero' && c.rarity === 'legendaer') || Object.values(s.cards).find(c => c.type === 'hero');
    leg.rarity = 'legendaer'; WOK_APP.render([{ t: 'summon', p: 0, cid: leg.id, uid: 'x', field: 'D6' }]);
  });
  await pg.waitForTimeout(700); console.log('Auftritt:', await pg.evaluate(() => !!document.querySelector('#fxlayer .cutin'))); await pg.screenshot({ path: OUT + n + '-cutin.png' });
  await pg.click('#fxlayer'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const s = WOK_APP.game.s, sp = Object.values(s.cards).filter(c => c.type === 'spell' || c.type === 'curse'); const a = sp[0] || Object.values(s.cards)[3], b2 = sp[1] || Object.values(s.cards)[4];
    WOK_APP.game.castMap = { z1: { cid: a.id, p: 0 }, z2: { cid: b2.id, p: 1 } }; WOK_APP.render([{ t: 'spellsResolve', sids: ['z1', 'z2'] }, { t: 'spellDone', sid: 'z1', canceled: true }, { t: 'spellDone', sid: 'z2', canceled: false }]); });
  await pg.waitForTimeout(1400); console.log('Kette:', await pg.evaluate(() => document.querySelectorAll('#fxlayer .ch-card').length)); await pg.screenshot({ path: OUT + n + '-chain.png' });
  await pg.click('#fxlayer'); await pg.waitForTimeout(500);
  await pg.screenshot({ path: OUT + n + '-game-look.png' });
  // Partie aufgeben -> Wiederholung
  await pg.click('#concede'); await pg.click('#dlg [data-act="yes"]'); await pg.waitForTimeout(800);
  await pg.waitForFunction(() => document.querySelector('#fxlayer').hidden, null, { timeout: 8000 });
  await pg.click('#dlg [data-act="replay"]'); await pg.waitForTimeout(900);
  await pg.waitForFunction(() => document.querySelector('#fxlayer').hidden, null, { timeout: 8000 });
  await pg.waitForTimeout(2500);
  console.log('Wiederholung:', await pg.textContent('#rp-pos'), '| Leiste:', await pg.isVisible('#rpbar'));
  await pg.click('[data-rp="end"]'); await pg.waitForTimeout(400); console.log('Ende:', await pg.textContent('#rp-pos'));
  await pg.click('[data-rp="start"]'); await pg.waitForTimeout(300); console.log('Anfang:', await pg.textContent('#rp-pos'));
  await pg.screenshot({ path: OUT + n + '-replay.png' });
  await pg.click('[data-rp="close"]'); await pg.waitForTimeout(300);
  // Pack öffnen
  await pg.evaluate(() => { WOK_MENU.video = ''; }); await pg.click('[data-go="bazar"]'); await pg.waitForTimeout(1600);
  await pg.click('[data-open="p12"]'); await pg.waitForTimeout(400); await pg.screenshot({ path: OUT + n + '-pack1.png' });
  await pg.click('.po-pack'); await pg.waitForTimeout(1200); await pg.screenshot({ path: OUT + n + '-pack2.png' });
  await pg.click('[data-po="all"]'); await pg.waitForTimeout(2400); console.log('aufgedeckt:', await pg.evaluate(() => document.querySelectorAll('.po-card.open').length)); await pg.screenshot({ path: OUT + n + '-pack3.png' });
  await pg.click('#packov [data-po="close"] >> nth=-1'); await pg.click('.bz-top [data-go="home"]');
  await pg.click('[data-hnav="settings"]'); await pg.click('#dlg [data-act="walls"]'); await pg.waitForTimeout(300); console.log('Hintergründe:', await pg.evaluate(() => document.querySelectorAll('.wall').length));
  await pg.screenshot({ path: OUT + n + '-walls.png' });
  console.log('Fehler:', errs); await b.close();
})();
