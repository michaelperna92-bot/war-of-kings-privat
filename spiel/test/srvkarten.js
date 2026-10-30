// Offizielle Karten über den Server: veröffentlichen (mit/ohne Schlüssel), Info, Laden im Spiel (Web-Version)
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const fs = require('fs');
const SH = '/tmp/claude-0/sf/shots/', PORT = 8793, BASE = 'http://127.0.0.1:' + PORT + '/', sleep = ms => new Promise(r => setTimeout(r, ms));
const pick = k => SH + fs.readdirSync(SH).filter(f => new RegExp('^WoK_' + k + '_.*\\.zip$').test(f)).sort().pop();
(async () => {
  const dir = '/tmp/claude-0/-home-claude/6eaa5b5e-216d-5bed-8d22-ca88b85fcffb/scratchpad/srvdata'; fs.rmSync(dir, { recursive: true, force: true });
  const srv = spawn('node', [__dirname + '/../server/server.js'], { env: Object.assign({}, process.env, { PORT, WOK_ADMIN_KEY: 'geheim', WOK_DATA_DIR: dir }), stdio: ['ignore', 'inherit', 'inherit'] }); await sleep(700);
  const zip = fs.readFileSync(pick('Packs'));
  let r = await fetch(BASE + 'api/karten', { method: 'POST', headers: { 'x-wok-key': 'falsch' }, body: zip }); console.log('falscher Schlüssel:', r.status, (await r.json()).error);
  r = await fetch(BASE + 'api/karten', { method: 'POST', headers: { 'x-wok-key': 'geheim', 'x-wok-name': encodeURIComponent('Season Ä 1') }, body: zip }); console.log('veröffentlicht:', r.status, JSON.stringify(await r.json()));
  console.log('Info:', await (await fetch(BASE + 'api/karten?info')).text());
  const b = await chromium.launch(); const ctx = await b.newContext(); await ctx.route('https://fonts.googleapis.com/**', x => x.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); await pg.goto(BASE); await pg.waitForTimeout(2600);
  console.log('Angebot:', await pg.textContent('#dlg h2').catch(() => '-'), '|', (await pg.textContent('#dlg p').catch(() => '')).slice(0, 40));
  // seit 4.2: erster Besuch ohne eigene Karten lädt sofort (ohne Rückfrage); sonst Angebot bestätigen
  if (await pg.isVisible('#dlg [data-act="load"]')) await pg.click('#dlg [data-act="load"]');
  await pg.waitForTimeout(2500); console.log('Toast:', await pg.textContent('#toast'));
  console.log('Karten geladen:', await pg.evaluate(() => (localStorage.getItem('wok-spiel-offiziell') || '-')));
  await pg.reload(); await pg.waitForTimeout(2600); console.log('nach Neuladen kein zweites Angebot:', !(await pg.isVisible('#dlg [data-act="load"]')));
  console.log('Fehler:', errs); await b.close(); srv.kill(); })();
