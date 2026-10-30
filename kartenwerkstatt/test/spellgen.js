// Schnellstart: Zufallskarte offline, KI aus dem Bild (nachgebildet), Bausteine; AI-Modus mit Flüchen
const { chromium } = require('playwright');
const SH = '/home/claude/cc/test/', OUT = '/tmp/claude-0/sf/shots/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => {
    const sample = { limits: async () => ({ images: { maxCount: 5 } }), json: async (prompt) => {
      if (/Zauber- oder Fluchkarten|Fluchkarten|Zauberkarten/.test(prompt)) { const n = +(prompt.match(/bekommst (\d+)/) || [0, 1])[1]; return { cards: Array.from({ length: n }, (_, i) => i === 1 ? { name: 'Kaputt', effects: [{ kind: 'zeitreise' }] } : { name: 'Bohrer der Verdammnis', subtitle: 'Schadensfluch', flavor: 'Der Fels gibt nach, die Seelen nicht.', type: 'curse', energy: 4, effects: [{ kind: 'damage', target: { what: 'king', side: 'enemy', count: 'one', pick: 'auto' }, params: { amount: 300, per: 'discard', from: 'own', count: { op: 'and', items: [{ k: 'race', v: 'maschinen' }] }, max: 2400 } }], reason: 'riesige Bohrmaschine im Eis' }) }; }
      return {};
    } };
    window.claude = { use: async n => n === 'sample' ? sample : null };
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(900);
  await p.setInputFiles('#file-art', SH + 'ai0.jpg'); await p.waitForTimeout(800);
  await p.click('[data-cardtype="curse"]'); await p.waitForTimeout(300);
  for (let k = 0; k < 3; k++) { await p.click('[data-spact="gen-rnd"]'); await p.waitForTimeout(500); console.log('Zufall', k + 1, ':', await p.inputValue('#in-name'), '|', await p.evaluate(() => [G.card.energy, G.card.rarity, G.card.subtitle, WOK_EFFECTS.describe(G.card, D), WOK_EFFECTS.status(G.card, D).playable].join(' | '))); }
  await p.click('[data-spact="gen-ai"]'); await p.waitForTimeout(1200);
  console.log('KI:', await p.inputValue('#in-name'), '|', await p.evaluate(() => [G.card.energy, WOK_EFFECTS.describe(G.card, D), WOK_EFFECTS.status(G.card, D).playable].join(' | ')));
  await p.click('[data-spact="gen-undo"]'); await p.waitForTimeout(400); console.log('Rückgängig →', await p.inputValue('#in-name'));
  await p.click('[data-spact="gen-ai"]'); await p.waitForTimeout(1200);
  for (const lab of ['Schaden je gegnerischem Held', 'Handkarten abwerfen', 'König schwächen (ATK)']) await p.click('.sppresets button:has-text("' + lab + '")');
  await p.waitForTimeout(300);
  console.log('Mit Bausteinen:', await p.evaluate(() => WOK_EFFECTS.describe(G.card, D)), '| spielbar:', await p.evaluate(() => WOK_EFFECTS.status(G.card, D).playable));
  await p.click('#btn-save'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'w-schnellstart.png' }); await (await p.$('#preview')).screenshot({ path: OUT + 'w-karte.png' });
  await p.evaluate(() => { document.querySelector('#panel').scrollTop = 600; }); await p.waitForTimeout(200); await p.screenshot({ path: OUT + 'w-effekte.png' });
  // AI-Modus mit Flüchen
  await p.click('[data-act="ai-mode"], button:has-text("AI-Modus")'); await p.waitForTimeout(500);
  await p.click('[data-ai-pick="curse"]');
  await p.setInputFiles('#ai-files', [SH + 'ai0.jpg', SH + 'ai1.jpg', SH + 'ai2.jpg']); await p.waitForTimeout(500);
  await p.click('[data-ai="run"]'); await p.waitForFunction(() => !AIM.running, null, { timeout: 60000 }); await p.waitForTimeout(500);
  console.log('AI-Modus:', await p.evaluate(() => AIM.results.map(r => r.status + ' · ' + (r.card ? r.card.type + ' · ' + r.card.name + ' · ' + WOK_EFFECTS.status(r.card, D).playable + ' · ' + (r.card.ai && r.card.ai.reason) : r.error))));
  await p.screenshot({ path: OUT + 'w-aimodus.png' });
  console.log('Fehler:', errs); await b.close();
})();
