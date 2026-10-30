// Zwei PCs (A, B) teilen einen „Drive“-Ordner
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const open = async port => { const p = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage(); p.on('pageerror', e => console.log(port, 'Seitenfehler:', e.message)); await p.goto('http://127.0.0.1:' + port + '/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1500); return p; };
  const A = await open(47831), B = await open(47832);
  const names = p => p.evaluate(() => ST.list().map(c => c.name + (c.art && c.art.id ? '+Bild' : '')).sort().join(', '));
  // A: Ordner wählen, Karte anlegen
  for (const P of [A, B]) { await P.evaluate(() => syncPick(false)); await P.waitForTimeout(800); await P.click('[data-act="close"]', { timeout: 500 }).catch(() => {}); }
  await A.setInputFiles('#file-art', '/home/claude/cc/test/hoch.png'); await A.waitForTimeout(900);
  await A.fill('#in-name', 'Drivetest Eins'); await A.click('#btn-save'); await A.waitForTimeout(800);
  await A.evaluate(() => syncNow(true)); await A.waitForTimeout(1500);
  console.log('Drive-Ordner:', fs.readdirSync('/tmp/claude-0/s4/drive/WoK_Sync/Karten').length, 'Karten,', fs.readdirSync('/tmp/claude-0/s4/drive/WoK_Sync/Bilder').length, 'Bilder');
  await B.evaluate(() => syncNow(true)); await B.waitForTimeout(2000);
  console.log('B nach Abgleich:', await names(B));
  // B ändert den Namen
  await B.evaluate(async () => { const c = ST.list().find(x => x.name === 'Drivetest Eins'); c.name = 'Drivetest Geändert'; await ST.put(c); });
  await B.evaluate(() => syncNow(true)); await B.waitForTimeout(1200); await A.evaluate(() => syncNow(true)); await A.waitForTimeout(1500);
  console.log('A nach Änderung auf B:', await names(A));
  // A löscht
  await A.evaluate(async () => { const c = ST.list().find(x => x.name === 'Drivetest Geändert'); syncTombstone(c.id); await ST.del(c.id); });
  await A.evaluate(() => syncNow(true)); await A.waitForTimeout(1200); await B.evaluate(() => syncNow(true)); await B.waitForTimeout(1500);
  console.log('B nach Löschen auf A:', (await names(B)) || '(leer)');
  console.log('Doppelte Abgleiche ändern nichts:', await A.evaluate(async () => { await syncNow(true); return SYNC.msg; }));
  await b.close();
})();
