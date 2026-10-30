// Test: Export fürs Probe-Spiel (Cloud-Fassung, Download über claude.use('downloads'))
const { chromium } = require('playwright');
const fs = require('fs');
const SH = '/home/claude/cc/test/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { const dl = { save: async ({ filename, data }) => { if (!/\.(gif|png|jpe?g|webp|mp4|webm|txt|json|md|docx|pptx|csv|html|svg|pdf|xlsx|zip)$/i.test(filename)) throw { code: 'rejected_extension', message: 'Endung' }; const buf = new Uint8Array(await data.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); window.__dl = { filename, b64: btoa(s) }; } }; window.claude = { use: async n => n === 'downloads' ? dl : null }; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(1200);
  await require('./expsetup.js')(p, SH);
  await p.click('.lib-dl button[data-act="game-export"]'); await p.waitForTimeout(300);
  await p.check('input[name=gx-scope][value=alle]'); await p.click('[data-act="gx-go"]');
  await p.waitForFunction(() => /gespeichert|abgebrochen/.test(document.querySelector('#gx-status').textContent), null, { timeout: 120000 });
  console.log('Status:', await p.textContent('#gx-status'));
  const d = await p.evaluate(() => window.__dl); fs.writeFileSync('/tmp/claude-0/chk/' + d.filename, Buffer.from(d.b64, 'base64')); console.log('Datei:', d.filename);
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
