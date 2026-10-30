// Profilbilder, Duell-Start mit Profilen, Gaben-Schnellwahl, Glanz nur kurz
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const [w, h, n] of [[1366, 900, 'pc'], [390, 844, 'phone']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(n + ': ' + e.message));
    await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(500);
    await pg.click('[data-hplay="ai"]'); await pg.waitForTimeout(200);
    await pg.click('[data-av="p1"]'); await pg.waitForTimeout(200);
    await pg.setInputFiles('#avup', require('path').join(__dirname, '..', 'assets') + '/menu/mate-haendler.webp'); await pg.waitForTimeout(600);
    await pg.click('#dlg [data-act="close"]'); await pg.waitForTimeout(200);
    await pg.click('[data-av="ai"]'); await pg.click('#dlg [data-act="b:alter-koenig"]'); await pg.click('#dlg [data-act="close"]'); await pg.waitForTimeout(200);
    await pg.screenshot({ path: OUT + n + '-prof-setup.png' });
    await pg.click('#start'); await require('./mull.js')(pg); await pg.waitForTimeout(900); await pg.screenshot({ path: OUT + n + '-prof-vs.png' });
    console.log(n, 'Profile im VS:', await pg.evaluate(() => [...document.querySelectorAll('#fxlayer .vs-av')].map(e => !!e.style.backgroundImage).join()));
    await pg.waitForFunction(() => document.querySelector('#fxlayer').hidden, null, { timeout: 8000 });
    console.log(n, 'Profil in Leiste:', await pg.evaluate(() => document.querySelectorAll('.pbar .pb-av').length));
    // Gaben-Schnellwahl
    const uid = await pg.evaluate(() => { const G = WOK_APP.game, s = G.s; G.aiSide = -1; const hero = Object.values(s.cards).find(c => c.type === 'hero' && c.gifts.some(g => ['mordlust', 'eisenpanzer'].includes(g.id))) || Object.values(s.cards).find(c => c.type === 'hero');
      if (!hero.gifts.some(g => g.id === 'mordlust')) hero.gifts.push({ id: 'mordlust' });
      const uid = 'uq'; s.units[uid] = { uid, cid: hero.id, owner: 0, pos: 'D5', king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; s.active = 0; s.phase = 'battle'; s.pendingDiscard = null; WOK_APP.renderNow(); return uid; });
    await pg.waitForTimeout(300); await pg.click('.tok[data-uid="' + uid + '"]'); await pg.waitForTimeout(300);
    console.log(n, 'Schnellwahl:', await pg.evaluate(() => { const q = document.querySelector('#qgifts'); return q ? [...q.querySelectorAll('button')].map(b => b.textContent + (b.disabled ? '(aus)' : '')).join(' | ') : 'keine'; }));
    await pg.screenshot({ path: OUT + n + '-qgifts.png' });
    await pg.click('#qgifts [data-qg="mordlust"]'); await pg.waitForTimeout(500);
    console.log(n, 'Mordlust benutzt:', await pg.evaluate(u => WOK_APP.game.s.units[u].fx.some(e => e.id === 'mordlust'), uid), '| Großansicht offen:', await pg.isVisible('#insp'));
    await pg.close();
  }
  console.log('Fehler:', errs); await b.close();
})();
