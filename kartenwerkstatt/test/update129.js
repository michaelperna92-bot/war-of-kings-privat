// Werkstatt 12.9 (31.10.2026): Abwehren/Durchgehen, Laufen nach Wiederbeleben/Kontrolle, Phasen-Vorschlag, Kartentexte
const { chromium } = require('playwright');
let pass = 0, failN = 0; const ok = (c, m) => { if (c) pass++; else { failN++; console.log('FEHLER:', m); } };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  await p.click('[data-cardtype="curse"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'Todesfalle');
  await p.selectOption('[data-sp="spell.effects.0.kind"]', 'destroy'); await p.waitForTimeout(250);
  const sel = '[data-sp="spell.effects.0.params.block"]';
  ok(await p.isVisible(sel), 'Zerstören: Auswahl „Angriff abwehren / durchgehen“ sichtbar');
  ok(/bitte festlegen/.test(await p.textContent(sel)), 'ohne Angabe: „bitte festlegen“');
  const rule = () => p.evaluate(() => document.querySelector('#sp-rule').placeholder);
  ok(/In deiner Konterphase wehrt das den Angriff ab/.test(await rule()), 'Kartentext ohne Angabe: abwehren – ' + await rule());
  await p.selectOption(sel, 'false'); await p.waitForTimeout(250);
  ok(/geht der Angriff trotzdem durch – erst danach wird zerstört/.test(await rule()), 'Kartentext Durchgehen: ' + await rule());
  ok(/Durchgehen lassen:/.test(await p.textContent('.sphelp:has-text("Durchgehen")').catch(() => '')), 'einfache Erklärung zum Durchgehen');
  ok(/Vorschlag:/.test(await p.textContent('.sphint')), 'Phasen-Vorschlag wird angezeigt: ' + (await p.textContent('.sphint')).trim());
  // Nur Battlephase: die Auswahl verschwindet (dort gibt es keinen gegnerischen Angriff)
  await p.click('[data-spact="timing:battle"]'); await p.waitForTimeout(250);
  ok(!(await p.isVisible(sel)), 'Nur Battlephase: keine Abwehr-Auswahl');
  // Wiederbeleben (Zauber): Laufen und angreifen
  await p.click('[data-cardtype="spell"]').catch(() => {}); await p.waitForTimeout(300);
  await p.selectOption('[data-sp="spell.effects.0.kind"]', 'revive'); await p.waitForTimeout(250);
  const em = '[data-sp="spell.effects.0.params.extraMove"]';
  ok(await p.isVisible(em), 'Wiederbeleben: Auswahl „sofort angreifen / erst laufen“ sichtbar');
  ok(/kann noch in dieser Battlephase angreifen/.test(await rule()), 'Kartentext Wiederbeleben: ' + await rule());
  await p.selectOption(em, 'true'); await p.waitForTimeout(250);
  ok(/laufen und angreifen/.test(await rule()), 'Kartentext mit Lauf: ' + await rule());
  const sg = (await p.textContent('.sphint')).trim(); ok(/Battlephase/.test(sg), 'Vorschlag Battlephase: ' + sg);
  // Konterphase wählen → Hinweis, Vorschlag übernehmen
  await p.click('[data-spact="timing:counter"]'); await p.waitForTimeout(250);
  ok(/geht nur in deiner Battlephase/.test(await p.textContent('body')), 'Hinweis bei „Laufen und angreifen“ nur im Konter');
  await p.click('.sphint [data-spact^="timing:"]'); await p.waitForTimeout(250);
  ok(await p.evaluate(() => document.querySelector('.sptiming button.on').dataset.spact) === 'timing:battle', 'Vorschlag übernommen');
  // Zufallsgenerator: viele Karten, alle ohne Phasen-Hinweis, passende Phasen
  const g = await p.evaluate(() => { const EF = window.WOK_EFFECTS, G = window.WOK_SPELLGEN, D = window.WOK_DATA; let n = 0, bad = 0, ex = 0, bl = 0; for (let i = 0; i < 400; i++) { const c = G.random({ type: i % 2 ? 'curse' : 'spell', D }); if (!c) continue; n++; if (EF.phaseIssues(c.spell).length || EF.validate(c, D).errors.length) bad++; if (c.spell.effects.some(e => e.params.extraMove)) ex++; if (c.spell.effects.some(e => e.params.block === false)) bl++; } return { n, bad, ex, bl }; });
  ok(g.n > 380 && g.bad === 0 && g.ex > 0 && g.bl > 0, 'Generator: ' + JSON.stringify(g));
  console.log('Fehler:', errs); if (errs.length) failN++;
  console.log('Werkstatt-12.9-Tests: ' + pass + ' bestanden, ' + failN + ' fehlgeschlagen.'); await b.close(); process.exit(failN ? 1 : 0);
})();
