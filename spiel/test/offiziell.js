// Echte Karten des Entwicklers (server/data/offiziell.wokspiel): Erstbesuch lädt sie automatisch, nur das Probe-Deck, KI-Partie und Online-Duell damit
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const SH = '/tmp/claude-0/sf/shots/', PORT = 8794, BASE = 'http://127.0.0.1:' + PORT + '/', sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('node', [__dirname + '/../server/server.js'], { env: Object.assign({}, process.env, { PORT }) }); await sleep(800);
  const b = await chromium.launch();
  async function page(name, w, h) { const ctx = await b.newContext({ viewport: { width: w, height: h } }); await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); await pg.goto(BASE); await pg.waitForTimeout(700);
    await pg.evaluate(n => { const s = JSON.parse(localStorage.getItem('wok-spiel-setup') || '{}'); s.name1 = n; localStorage.setItem('wok-spiel-setup', JSON.stringify(s)); }, name); await pg.reload();
    await pg.waitForFunction(() => window.WOK_APP && Object.keys(WOK_APP.POOL.cards).length > 40, null, { timeout: 30000 }); await pg.waitForTimeout(800); return pg; }
  const A = await page('Anna', 1280, 860), B = await page('Ben', 390, 844);
  console.log('Karten:', await A.evaluate(() => Object.keys(WOK_APP.POOL.cards).length), '| Decks:', await A.evaluate(() => WOK_APP.POOL.decks.map(d => d.name + (d.origin === 'demo' ? '(Demo)' : '')).join(', ')));
  await A.click('[data-go="decks"]'); await A.waitForTimeout(500); await A.screenshot({ path: SH + 'off-decks.png' });
  console.log('Kacheln:', await A.evaluate(() => [...document.querySelectorAll('.dtile')].map(t => t.querySelector('.dname b').textContent + ' · ' + t.querySelector('.dinfo span').textContent).join(' | ')));
  await A.click('[data-dtab="cards"]'); await A.waitForTimeout(1500); await A.screenshot({ path: SH + 'off-cards.png' });
  console.log('Bilder in der Sammlung:', await A.evaluate(() => document.querySelectorAll('#pool .ctile img').length));
  await A.click('[data-dtab="decks"]'); await A.evaluate(() => document.querySelector('[data-go="home"]').click()).catch(() => {}); await A.waitForTimeout(300);
  // Online-Duell mit den echten Karten
  await A.evaluate(() => document.querySelector('[data-hplay="online"]').click()); await A.waitForTimeout(800); await A.click('#dlg [data-act="host:srv"]'); await A.waitForSelector('#onl-link'); const link = await A.inputValue('#onl-link');
  await B.goto(link); await B.waitForTimeout(1500); await B.click('#dlg [data-act="go"]'); await B.waitForTimeout(3000);
  console.log('Online-Partie:', await A.textContent('#turnwho'), '|', await B.textContent('#turnwho'));
  const playTurn = async (P) => P.evaluate(() => { const g = WOK_APP.game; if (!g || g.s.result) return 'ende'; const s = g.s; const actor = WOK.mulliganOpen(s, g.view) ? g.view : WOK.actor(s); if (actor !== g.view) return 'wartet'; if (g.online.pending) return 'unterwegs'; const a = WOK_AI.decide(s, actor, 'mittel', g.memo) || { type: 'endPhase', p: actor }; const ok = WOK_APP.dispatch(a); if (ok === false) { WOK_APP.dispatch({ type: s.phase === 'counter' ? 'pass' : 'endPhase', p: actor }); return 'ersatz'; } return a.type; });
  const cnt = {}; for (let i = 0; i < 3000; i++) { const ra = await playTurn(A), rb = await playTurn(B); cnt[ra] = (cnt[ra] || 0) + 1; cnt[rb] = (cnt[rb] || 0) + 1; if (ra === 'ende' && rb === 'ende') break; if (i === 40) { await A.screenshot({ path: SH + 'off-A.png' }); await B.screenshot({ path: SH + 'off-B.png' }); } await sleep(25); }
  const sum = P => P.evaluate(() => { const s = WOK_APP.game.s; return JSON.stringify({ turn: s.turn, hp: s.players.map(p => s.units[p.king] ? s.units[p.king].hp : 0), units: Object.keys(s.units).length, result: s.result && s.result.reason }); });
  console.log('Aktionen:', JSON.stringify(cnt)); const sa = await sum(A), sb = await sum(B); console.log('A:', sa, '\nidentisch:', sa === sb);
  console.log('Fehler:', A.errs, B.errs); await b.close(); srv.kill(); })();
