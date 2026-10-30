// KI-Funktionen im Zauber-Editor mit nachgebildeter Claude-Schnittstelle
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => {
    window.__prompts = [];
    const sample = { limits: async () => ({ images: 5 }), json: async (prompt) => {
      window.__prompts.push(prompt);
      if (/in strukturierte Effektdaten/.test(prompt)) return { effects: [{ kind: 'destroy', target: { what: 'unit', side: 'enemy', count: 'one', pick: 'player' } }, { kind: 'status', target: { what: 'unit', side: 'enemy', count: 'n', n: 2, pick: 'player' }, params: { status: 'poison' } }], require: null, timing: null, missing: ['Ob die zwei vergifteten Einheiten andere sein müssen als die zerstörte, sagt der Text nicht.'] };
      if (/Formuliere den Regeltext/.test(prompt)) return { vorschlaege: ['Vernichte einen feindlichen Helden. Danach vergiften dunkle Nebel zwei weitere Feinde (Poison).', 'Vernichte einen feindlichen Helden und vergifte drei weitere (Poison).'] };
      if (/Stimmungstext/.test(prompt)) return { text: 'Wo der Schatten fällt, verstummt 1 Lied.' };
      return {};
    } };
    window.claude = { use: async n => n === 'sample' ? sample : null };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(900);
  await p.click('[data-cardtype="curse"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'Schattenurteil'); await p.fill('#sp-energy', '6'); await p.click('[data-pick="rarity"][data-val="selten"]');
  await p.fill('#sp-rule', 'Zerstöre einen gegnerischen Helden. Vergifte dann zwei weitere gegnerische Helden.'); await p.waitForTimeout(200);
  const before = await p.evaluate(() => JSON.stringify(G.card.spell.effects.map(e => e.kind)));
  await p.click('[data-spact="ai-parse"]'); await p.waitForSelector('.spai'); await p.waitForTimeout(200);
  console.log('Vorschlag:', (await p.textContent('.spai')).replace(/\s+/g, ' ').slice(0, 300));
  console.log('Effekte unverändert bis zur Übernahme:', before === await p.evaluate(() => JSON.stringify(G.card.spell.effects.map(e => e.kind))));
  console.log('Prompt verbietet Erfinden:', await p.evaluate(() => /Erfinde keine/.test(window.__prompts[0])));
  await p.click('[data-spact="accept-parse"]'); await p.waitForTimeout(300);
  console.log('Nach Übernahme:', await p.textContent('.spgen'));
  await p.click('[data-spact="syncok"]'); await p.waitForTimeout(200);
  const hash1 = await p.evaluate(() => [G.card.spell.sync, JSON.stringify(G.card.spell.effects)]);
  await p.click('[data-spact="ai-word"]'); await p.waitForSelector('.spword'); await p.waitForTimeout(200);
  console.log('Formulierungen:', (await p.$$eval('.spword', e => e.map(x => x.textContent.replace(/\s+/g, ' ')))).join(' || '));
  console.log('Original bleibt bis zur Wahl:', await p.inputValue('#sp-rule'));
  await p.click('[data-spact="accept-word:0"]'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => [G.card.ruleText, JSON.stringify(G.card.spell.effects), WOK_EFFECTS.textCheck(G.card, D).synced]);
  console.log('Text übernommen:', after[0], '| Effekte gleich:', after[1] === hash1[1], '| Abgleich muss neu bestätigt werden:', !after[2]);
  await p.click('[data-spact="ai-flavor"]'); await p.waitForSelector('.spai'); console.log('Stimmung (Zahlen entfernt):', await p.textContent('.spai i'));
  console.log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
