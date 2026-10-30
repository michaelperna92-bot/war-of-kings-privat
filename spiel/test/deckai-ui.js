// Deck-KI in der Oberfläche: bauen, prüfen, auffüllen, Frage an Claude (nachgebildet) mit Deckvorschlag
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript(() => {
    const sample = async (prompt, o) => {
      window.__prompt = prompt;
      const ids = [...prompt.matchAll(/^(demo_[AB]_\w+) \| /gm)].map(m => m[1]);
      const king = ids.find(i => /koenig/.test(i)), heroes = ids.filter(i => !/koenig/.test(i));
      const karten = [{ id: king, anzahl: 1 }].concat(heroes.slice(0, 13).map(id => ({ id, anzahl: 3 })));
      const text = 'Hier ist ein Vorschlag mit vielen günstigen Helden.\n```deck\n' + JSON.stringify({ name: 'Claude-Vorschlag', karten }) + '\n```';
      if (o && o.onText) o.onText({ text: text.slice(0, 30), delta: '' });
      return { text, truncated: false };
    };
    window.claude = { use: async n => n === 'sample' ? sample : null };
  });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(1500);
  await pg.click('[data-go="decks"]'); await pg.click('#ai-newdeck'); await pg.waitForTimeout(200);
  await pg.click('#bd-style [data-st="aggressiv"]'); await pg.click('#dlg [data-act="go"]'); await pg.waitForTimeout(500);
  console.log('Gebaut:', (await pg.textContent('#ed-count')).trim(), '|', (await pg.textContent('#ai-out')).slice(0, 220));
  await pg.click('#ai-check'); console.log('Prüfung:', (await pg.textContent('#ai-out')).slice(0, 300));
  await pg.click('#cleardeck'); await pg.locator('#ed-pool [data-add]').nth(3).click(); await pg.click('#ai-fix'); console.log('Auffüllen:', (await pg.textContent('#ed-count')).trim());
  await pg.fill('#ai-q', 'Bau mir ein schnelles Deck'); await pg.click('#ai-send'); await pg.waitForTimeout(800);
  console.log('Antwort:', (await pg.textContent('#ai-out')).slice(0, 120), '| Prompt-Länge:', await pg.evaluate(() => window.__prompt.length));
  await pg.click('#ai-apply'); await pg.waitForTimeout(200); console.log('Nach Übernahme:', (await pg.textContent('#ed-count')).trim(), await pg.inputValue('#deckname'));
  await pg.screenshot({ path: '/tmp/claude-0/wokui/deckai.png' });
  await pg.click('#ed-save'); await pg.waitForTimeout(300); console.log('Decks:', await pg.$$eval('.dtile .dinfo b', e => e.map(x => x.textContent)));
  console.log('Fehler:', errs); await b.close();
})();
