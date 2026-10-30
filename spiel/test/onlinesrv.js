// Online-PvP über den echten Spielserver (server/server.js): Einladungslink, Beitritt, ganze Partie mit echten Zügen (KI steuert beide Seiten),
// illegale Züge, Verbindungsabbruch + Wiederverbindung, Spielende. Zwei unabhängige Browser-Sitzungen (getrennte Speicher = getrennte Spieler-IDs).
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const SH = '/tmp/claude-0/sf/shots/', PORT = 8791, BASE = 'http://127.0.0.1:' + PORT + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('node', [__dirname + '/../server/server.js'], { env: Object.assign({}, process.env, { PORT, WOK_DEBUG: '1' }) }); let slog = ''; srv.stdout.on('data', d => slog += d); srv.stderr.on('data', d => slog += d); await sleep(800);
  const b = await chromium.launch();
  async function page(name, w, h) { const ctx = await b.newContext({ viewport: { width: w, height: h } }); await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); await pg.goto(BASE); await pg.waitForTimeout(900);
    await pg.evaluate(n => { const s = JSON.parse(localStorage.getItem('wok-spiel-setup') || '{}'); s.name1 = n; localStorage.setItem('wok-spiel-setup', JSON.stringify(s)); }, name); await pg.reload(); await pg.waitForTimeout(900); return pg; }
  const A = await page('Anna', 1280, 860), B = await page('Ben', 390, 844);
  // 1. Raum eröffnen
  await A.click('[data-hplay="online"]'); await A.waitForTimeout(800); console.log('A Server:', await A.textContent('#onl-srv'));
  await A.screenshot({ path: SH + 'srv-dialog.png' });
  await A.click('#dlg [data-act="host:srv"]'); await A.waitForSelector('#onl-link', { timeout: 10000 });
  const link = await A.inputValue('#onl-link'); console.log('Einladungslink:', link); await A.screenshot({ path: SH + 'srv-host.png' });
  // 2. Ungültiger Link
  await B.goto(BASE + '?raum=ZZZZZZ'); await B.waitForTimeout(1200); if (await B.isVisible('#dlg [data-act="go"]')) await B.click('#dlg [data-act="go"]'); await B.waitForTimeout(1500); console.log('Ungültiger Link:', await B.textContent('#toast'));
  // 3. Einladungslink öffnen → direkt in der Lobby → beitreten
  await B.goto(link); await B.waitForTimeout(1200); await B.screenshot({ path: SH + 'srv-invite.png' }); console.log('Einladung:', (await B.textContent('#dlg h2')));
  await B.click('#dlg [data-act="go"]'); await B.waitForTimeout(2500);
  console.log('Spiel offen:', await A.isVisible('#v-game'), await B.isVisible('#v-game'), '| A:', await A.textContent('#turnwho'), '| B:', await B.textContent('#turnwho'));
  // 4. Illegaler Zug über eine rohe Verbindung (fremde ID) und Zug außer der Reihe
  const raw = await B.evaluate(async (code) => new Promise(res => { const ws = new WebSocket(location.origin.replace('http', 'ws') + '/ws'); const out = []; ws.onmessage = e => { out.push(JSON.parse(e.data)); if (out.length === 2) { ws.close(); res(out.map(m => m.t + ':' + (m.error || m.msg || ''))); } }; ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', id: 'eindringling', name: 'X', v: WOK_APP.VERSION })); ws.send(JSON.stringify({ t: 'act', code, n: 0, a: { type: 'endPhase' } })); }; }), link.split('=')[1]);
  console.log('Fremder Zug:', raw);
  const playTurn = async (P) => P.evaluate(() => { const g = WOK_APP.game; if (!g || g.s.result) return 'ende'; const s = g.s; const actor = WOK.mulliganOpen(s, g.view) ? g.view : WOK.actor(s); if (actor !== g.view) return 'wartet'; if (g.online.pending) return 'unterwegs'; g.memo = g.memo || {}; const a = WOK_AI.decide(s, actor, 'mittel', g.memo) || { type: 'endPhase', p: actor }; const ok = WOK_APP.dispatch(a); return ok ? a.type : 'abgelehnt:' + a.type; });
  // 5. Partie spielen (KI wählt für beide die Züge, gesendet über die normale Spielfunktion → Server)
  let steps = 0, log = {}, outA = '', dropped = false;
  for (; steps < 2500; steps++) {
    const ra = await playTurn(A), rb = await playTurn(B); log[ra] = (log[ra] || 0) + 1; log[rb] = (log[rb] || 0) + 1;
    if (ra === 'ende' && rb === 'ende') break;
    if (!dropped && steps === 60) { dropped = true; await B.reload(); await B.waitForTimeout(1500); await B.click('[data-hplay="online"]'); await B.waitForTimeout(700); await B.click('#dlg [data-act="resume"]'); await B.waitForTimeout(2000); console.log('B nach Abbruch/Wiederverbindung:', await B.textContent('#turnwho')); }
    if (steps === 30) { await A.screenshot({ path: SH + 'srv-A.png' }); await B.screenshot({ path: SH + 'srv-B.png' }); }
    await sleep(10);
  }
  await sleep(2500); // letzte Züge zu Ende übertragen lassen
  const sum = P => P.evaluate(() => { const s = WOK_APP.game.s; return JSON.stringify({ turn: s.turn, phase: s.phase, hp: s.players.map(p => s.units[p.king] ? s.units[p.king].hp : 0), units: Object.keys(s.units).length, hands: s.players.map(p => p.hand.length), result: s.result && s.result.reason }); });
  const sa = await sum(A), sb = await sum(B);
  console.log('Schritte:', steps, JSON.stringify(log));
  console.log('A:', sa); console.log('B:', sb); console.log('identisch:', sa === sb);
  const ra = await A.evaluate(() => ({ n: WOK_APP.game.online.n, acts: WOK_APP.game.rec.acts.map(x => JSON.stringify(x)) })), rb = await B.evaluate(() => ({ n: WOK_APP.game.online.n, acts: WOK_APP.game.rec.acts.map(x => JSON.stringify(x)) }));
  let k = 0; while (k < Math.min(ra.acts.length, rb.acts.length) && ra.acts[k] === rb.acts[k]) k++;

  console.log('Züge A/B:', ra.n, rb.n, ra.acts.length, rb.acts.length, '| erste Abweichung bei', k, ra.acts[k], rb.acts[k]);
  await sleep(1500); console.log('Ende A:', (await A.textContent('#dlg').catch(() => '')).slice(0, 60)); console.log('Ende B:', (await B.textContent('#dlg').catch(() => '')).slice(0, 60));
  await A.screenshot({ path: SH + 'srv-end-A.png' }); await B.screenshot({ path: SH + 'srv-end-B.png' });
  require('fs').writeFileSync('/tmp/claude-0/-home-claude/6eaa5b5e-216d-5bed-8d22-ca88b85fcffb/scratchpad/srvfull.log', slog); console.log('Fehler:', A.errs, B.errs); console.log('Server-Log:\n' + slog.split('\n').filter(l => !/ act /.test(l) || true).slice(-14).join('\n'));
  await b.close(); srv.kill(); })();
