// Bibliothek: Ordner, Mehrfachauswahl, Export der Auswahl; Phasen-Siegel auf Zauber/Fluch
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 980 }, acceptDownloads: true });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(() => { const dl = { save: async ({ filename, data }) => { if (!/\.(png|json|zip)$/i.test(filename)) throw { code: 'rejected_extension' }; const buf = new Uint8Array(await data.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); window.__dl = { filename, b64: btoa(s) }; } }; window.claude = { use: async n => n === 'downloads' ? dl : null }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  const mk = async (t, name, timing) => {
    await p.click('[data-act="new"]'); await p.waitForTimeout(200);
    if (await p.isVisible('#modal [data-act="discard"]')) { await p.click('#modal [data-act="discard"]'); await p.waitForTimeout(200); }
    await p.click('[data-act="newtype"][data-t="' + t + '"]'); await p.waitForTimeout(300);
    await p.fill('#in-name', name); await p.press('#in-name', 'Tab');
    if (timing) { await p.click('[data-spact="timing:' + timing + '"]'); await p.waitForTimeout(150); }
    await p.click('#btn-save'); await p.waitForTimeout(400);
  };
  await mk('curse', 'Nebelbann', 'battle'); await (await p.$('#preview')).screenshot({ path: OUT + 'seal-battle.png' });
  await mk('spell', 'Wächterlicht', 'counter'); await (await p.$('#preview')).screenshot({ path: OUT + 'seal-counter.png' });
  await mk('spell', 'Morgenruf', 'both'); await (await p.$('#preview')).screenshot({ path: OUT + 'seal-both.png' });
  await mk('hero', 'Testritter'); await mk('king', 'Testkönig');
  console.log('Bibliothek:', await p.evaluate(() => document.querySelectorAll('.libitem').length));
  await p.click('[data-act="lib-pick"]'); await p.waitForTimeout(200);
  await p.click('.libitem >> text=Nebelbann'); await p.click('.libitem >> text=Wächterlicht'); await p.click('.libitem >> text=Morgenruf');
  console.log('ausgewählt:', await p.textContent('#pickbar b'));
  await p.screenshot({ path: OUT + 'werk-pick.png' });
  await p.click('[data-act="pick-move"]'); await p.fill('#folder-name', 'Magie Season 1'); await p.click('[data-act="folder-create"]'); await p.waitForTimeout(500);
  console.log('Ordner:', await p.evaluate(() => [...document.querySelectorAll('.fbtn')].map(b => b.textContent.trim()).join(' | ')));
  await p.click('[data-act="lib-pick"]');
  await p.click('.fbtn >> text=Magie Season 1'); await p.waitForTimeout(200);
  console.log('im Ordner sichtbar:', await p.evaluate(() => [...document.querySelectorAll('.libitem b')].map(x => x.textContent).join(', ')));
  await p.screenshot({ path: OUT + 'werk-folder.png' });
  // Ordner bleibt beim Speichern der geöffneten Karte
  await p.click('.libitem >> text=Morgenruf'); await p.waitForTimeout(300); await p.fill('#in-name', 'Morgenruf II'); await p.press('#in-name', 'Tab'); await p.click('#btn-save'); await p.waitForTimeout(400);
  console.log('nach Speichern noch im Ordner:', await p.evaluate(() => [...document.querySelectorAll('.libitem b')].map(x => x.textContent).join(', ')));
  // Export des Ordners
  await p.click('.lib-dl button[data-act="game-export"]'); await p.waitForTimeout(300);
  console.log('Export-Optionen:', await p.evaluate(() => [...document.querySelectorAll('input[name=gx-scope]')].map(i => i.value + (i.disabled ? '(aus)' : '')).join(', ')));
  await p.check('input[name=gx-scope][value=ordner]'); await p.click('[data-act="gx-go"]');
  await p.waitForFunction(() => /gespeichert|abgebrochen|heruntergeladen|fertig/i.test(document.querySelector('#gx-status').textContent), null, { timeout: 120000 }).catch(() => {});
  console.log('Export:', await p.textContent('#gx-status'));
  const d = await p.evaluate(() => window.__dl); if (d) { require('fs').writeFileSync(OUT + 'ordner.zip', Buffer.from(d.b64, 'base64')); console.log('Datei:', d.filename); }
  console.log('Fehler:', errs); await b.close();
})();
