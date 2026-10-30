// Werkstatt: Zeitpunkt-Knöpfe, Zusatzkosten, Schnell-Voraussetzungen, Kontrolle übernehmen
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  await p.click('[data-cardtype="curse"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'Seelenraub'); await p.fill('#sp-energy', '3');
  const k = await p.evaluate(() => [...document.querySelectorAll('[data-spact^="preset:"]')].find(b => /Kontrolle/.test(b.textContent)).dataset.spact);
  await p.click('[data-spact="delfx:0"]').catch(() => {}); await p.waitForTimeout(150);
  await p.click('[data-spact="' + k + '"]'); await p.waitForTimeout(200);
  await p.click('[data-spact="timing:battle"]'); await p.waitForTimeout(150);
  await p.fill('[data-sp="spell.cost.hp"]', '1500'); await p.press('[data-sp="spell.cost.hp"]', 'Tab'); await p.waitForTimeout(200);
  await p.click('[data-sec="voraussetzung"] summary').catch(() => {}); await p.waitForTimeout(150);
  const c = await p.evaluate(() => [...document.querySelectorAll('[data-spact^="condpreset:"]')].find(b => /Friedhof/.test(b.textContent)).dataset.spact);
  await p.click('[data-spact="' + c + '"]'); await p.waitForTimeout(250);
  await p.screenshot({ path: OUT + 'werk-fluch.png', fullPage: false });
  const panel = await p.evaluate(() => document.querySelector('#panel, .panel, aside') ? (document.body.innerText.match(/So führt das Spiel die Karte aus[\s\S]{0,400}/) || [''])[0] : '');
  console.log(panel.replace(/\s+/g, ' ').slice(0, 420));
  console.log('Zeitpunkt-Knopf aktiv:', await p.evaluate(() => document.querySelector('[data-spact="timing:battle"]').classList.contains('on')));
  console.log('Fehler:', errs); await b.close();
})();
