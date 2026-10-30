// Online-Duell über 🌐 Internet: zwei Browser mit der Browser-Datei, zwei Test-Broker (+ ein toter), Ausfall eines Brokers mitten im Spiel
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const SH = '/tmp/claude-0/sf/shots/', FILE = 'file://' + require('path').join(__dirname, '..') + '/dist/WoK-Probe-Spiel-Browser.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const bA = spawn('node', [__dirname + '/mqbroker.js', '8899']), bB = spawn('node', [__dirname + '/mqbroker.js', '8897']); await sleep(500);
  const b = await chromium.launch();
  async function page(name, w, h) { const ctx = await b.newContext({ viewport: { width: w, height: h } }); await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.addInitScript(() => { window.WOK_MQTT_BROKERS = ['ws://127.0.0.1:8899/mqtt', 'ws://127.0.0.1:8898/mqtt', 'ws://127.0.0.1:8897/mqtt']; });
    const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); await pg.goto(FILE); await pg.waitForTimeout(900);
    await pg.evaluate(n => { const s = JSON.parse(localStorage.getItem('wok-spiel-setup') || '{}'); s.name1 = n; localStorage.setItem('wok-spiel-setup', JSON.stringify(s)); }, name); await pg.reload(); await pg.waitForTimeout(900); return pg; }
  const A = await page('Anna', 1280, 860), B = await page('Ben', 390, 844);
  await A.click('[data-hplay="online"]'); await A.waitForTimeout(1500); console.log('A Verbindung:', await A.textContent('#onl-net')); await A.screenshot({ path: SH + 'net-dialog.png' });
  await A.click('#dlg [data-act="host:net"]'); await A.waitForTimeout(800); const code = (await A.textContent('.onl-code')).trim(); console.log('Code:', code);
  await B.click('[data-hplay="online"]'); await B.waitForTimeout(1200); await B.screenshot({ path: SH + 'net-dialog-phone.png' });
  await B.fill('#onl-code', code.toLowerCase()); await B.click('#dlg [data-act="code:net"]'); await B.waitForTimeout(4000);
  console.log('Spiel offen:', await A.isVisible('#v-game'), await B.isVisible('#v-game'));
  const st = pg => pg.textContent('#turnwho');
  console.log('A:', await st(A), '| B:', await st(B));
  const play = async (rounds) => { for (let k = 0; k < rounds; k++) { for (const P of [A, B]) { if (/\(du\)/.test(await st(P)) && await P.evaluate(() => !document.querySelector('#mainbtn').disabled)) { await P.click('#mainbtn'); await P.waitForTimeout(200); for (const s of ['go', 'yes']) if (await P.isVisible('#dlg [data-act="' + s + '"]')) await P.click('#dlg [data-act="' + s + '"]'); await P.waitForTimeout(300); } } await sleep(400); } };
  // Beschwören über die UI: eine Handkarte und ein goldenes Feld
  await play(6);
  console.log('nach 6 Runden – A:', await st(A), '| B:', await st(B));
  bA.kill(); console.log('Broker 8899 abgeschaltet');
  await play(6); await sleep(1200);
  console.log('nach Ausfall – A:', await st(A), '| B:', await st(B));
  const sig = pg => pg.evaluate(() => { const l = [...document.querySelectorAll('#log > *')].slice(0, 6).map(x => x.textContent).join('|'); return l.length; });
  // Neu laden B und fortsetzen
  await B.reload(); await B.waitForTimeout(1200); await B.click('[data-hplay="online"]'); await B.waitForTimeout(1500); await B.click('#dlg [data-act="resume"]'); await B.waitForTimeout(3500);
  console.log('B nach Neuladen:', await st(B), '| A:', await st(A));
  await play(3); await sleep(800);
  console.log('weiter – A:', await st(A), '| B:', await st(B));
  await A.screenshot({ path: SH + 'net-A.png' }); await B.screenshot({ path: SH + 'net-B.png' });
  await B.click('#menu').catch(() => {}); await B.waitForTimeout(300); const cb = await B.$('#dlg [data-act="concede"]'); if (cb) { await cb.click(); await B.waitForTimeout(200); await B.click('#dlg [data-act="yes"]'); }
  await sleep(2000);
  console.log('Ende A:', (await A.textContent('#dlg').catch(() => '')).slice(0, 50), '| Ende B:', (await B.textContent('#dlg').catch(() => '')).slice(0, 50));
  console.log('Fehler:', A.errs, B.errs); await b.close(); bB.kill(); bA.kill(); })();
