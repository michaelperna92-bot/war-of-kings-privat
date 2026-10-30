// Gesamtablauf Zauber/Flüche: Werkstatt anlegen → speichern → neu öffnen → exportieren → Probe-Spiel importieren → ausspielen → Wirkung → Ablauf → Speichern/Laden
const { chromium } = require('playwright');
const fs = require('fs');
const SH = '/home/claude/cc/test/', OUT = '/tmp/claude-0/flow/';
const log = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch();
  /* ---------- A. Werkstatt ---------- */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => { const dl = { save: async ({ filename, data }) => { if (!/\.(png|json|zip)$/i.test(filename)) throw { code: 'rejected_extension' }; const buf = new Uint8Array(await data.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); window.__dl = { filename, b64: btoa(s) }; } }; window.claude = { use: async n => n === 'downloads' ? dl : null }; });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('werkstatt: ' + e.message));
  await p.goto('http://localhost:8770/'); await p.waitForSelector('#preview'); await p.waitForTimeout(800);
  // König und Helden schnell über den Speicher (Heldenerstellung ist in e2e.js getestet)
  await p.evaluate(async () => {
    const base = { style: {}, nameScale: 100, element2: null, race2: null, status: 'freigegeben', gifts: [], art: null, autoRarity: false, autoEnergy: false };
    await ST.put(Object.assign({}, base, { id: 'koenig', type: 'king', name: 'König Testor', atk: 2000, hp: 10000, rarity: 'selten', element: 'licht', race: 'mensch', classes: ['ritter', null], attack: { dirs: { n: 1, ne: 1, nw: 1 }, showNumber: false, number: 1 }, move: { dirs: {}, showNumber: false, number: 1 } }));
    for (let i = 1; i <= 9; i++) await ST.put(Object.assign({}, base, { id: 'held' + i, type: 'hero', name: 'Held ' + i, energy: 1 + (i % 4), atk: 800 + i * 100, def: 700 + i * 100, rarity: 'gewoehnlich', element: 'feuer', race: 'mensch', classes: [i % 2 ? 'krieger' : 'tueftler', null], attack: { dirs: { n: 1 }, showNumber: false, number: 1 }, move: { dirs: { n: 1, w: 1, e: 1 }, showNumber: true, number: 1 }, gifts: i === 3 ? [{ id: 'schuetze' }] : [] }));
  });
  await p.reload(); await p.waitForSelector('.libitem'); await p.waitForTimeout(800);
  // Fluch über die Oberfläche
  await p.evaluate(() => openCard(null)); await p.waitForTimeout(400);
  await p.setInputFiles('#file-art', SH + 'ai0.jpg'); await p.waitForTimeout(800);
  await p.click('[data-cardtype="curse"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'Fluch der Schwäche'); await p.fill('#sp-energy', '0'); await p.click('[data-pick="rarity"][data-val="gewoehnlich"]');
  await p.fill('[data-sp="subtitle"]', 'Schwächungsfluch');
  await p.selectOption('[data-sp="spell.effects.0.target.side"]', 'enemy');
  await p.fill('[data-sp="spell.effects.0.params.amount"]', '-500');
  await p.selectOption('[data-sp="spell.effects.0.duration.kind"]', 'rounds'); await p.fill('[data-sp="spell.effects.0.duration.n"]', '1');
  await p.click('[data-spact="addfx"]'); await p.waitForTimeout(150);
  await p.selectOption('[data-sp="spell.effects.1.kind"]', 'giftBlock'); await p.waitForTimeout(150);
  await p.check('[data-spgift="1:schuetze"]'); await p.waitForTimeout(150);
  await p.selectOption('[data-sp="spell.effects.1.target.side"]', 'enemy');
  await p.selectOption('[data-sp="spell.effects.1.duration.kind"]', 'rounds'); await p.fill('[data-sp="spell.effects.1.duration.n"]', '2');
  await p.fill('#sp-rule', 'Eine gegnerische Einheit erhält −500 ATK bis zum Ende des Zuges.'); await p.waitForTimeout(200);
  log('A1 Abgleich (absichtlich unvollständig):', (await p.textContent('#sp-live')).replace(/\s+/g, ' ').slice(0, 260));
  await p.click('#btn-save'); await p.waitForTimeout(500);
  log('A2 Prüfung:', await p.$$eval('#issues .issue', els => els.map(e => e.textContent).filter(t => /abgestimmt|übereinstimmend/.test(t))));
  await p.click('[data-spact="fromfx"]'); await p.waitForTimeout(200); await p.click('#btn-save'); await p.waitForTimeout(500);
  // Schutzzauber für die Konterphase
  await p.evaluate(() => openCard(null)); await p.waitForTimeout(400);
  await p.setInputFiles('#file-art', SH + 'ai1.jpg'); await p.waitForTimeout(800);
  await p.click('[data-cardtype="spell"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'Schild des Lichts'); await p.fill('#sp-energy', '0'); await p.click('[data-pick="rarity"][data-val="gewoehnlich"]');
  await p.selectOption('[data-sp="spell.effects.0.kind"]', 'protect'); await p.waitForTimeout(150);
  await p.click('[data-fx="0"] .spmore summary'); await p.waitForTimeout(100); await p.selectOption('[data-sp="spell.effects.0.trigger"]', 'enemyAttack'); await p.waitForTimeout(150);
  await p.click('[data-spact="timing:counter"]'); await p.waitForTimeout(150);
  await p.fill('[data-sp="flavor"]', 'Wo das Licht steht, bricht kein Stahl.');
  await p.click('#btn-save'); await p.waitForTimeout(500);
  // Nicht unterstützte Wirkung (Einfrieren) als Entwurf
  await p.evaluate(() => openCard(null)); await p.waitForTimeout(400);
  await p.click('[data-cardtype="curse"]'); await p.waitForTimeout(300);
  await p.fill('#in-name', 'Eisiger Hauch'); await p.fill('#sp-energy', '1'); await p.click('[data-pick="rarity"][data-val="gewoehnlich"]');
  await p.selectOption('[data-sp="spell.effects.0.kind"]', 'status'); await p.waitForTimeout(150);
  await p.selectOption('[data-sp="spell.effects.0.params.status"]', 'freeze'); await p.waitForTimeout(150);
  await p.click('#btn-save'); await p.waitForTimeout(500);
  log('A3 Freeze-Hinweis:', (await p.textContent('#sp-live')).replace(/\s+/g, ' ').match(/Noch nicht spielbar[^.]*/)?.[0]);
  // neu laden und öffnen
  await p.reload(); await p.waitForSelector('.libitem'); await p.waitForTimeout(1000);
  await p.click('.libitem >> text=Fluch der Schwäche'); await p.waitForTimeout(700);
  log('A4 neu geöffnet:', await p.inputValue('#in-name'), '| Effekte:', await p.$$eval('.speffect', e => e.length), '|', (await p.textContent('#sp-live')).replace(/\s+/g, ' ').slice(0, 120));
  await (await p.$('#preview')).screenshot({ path: OUT + 'w-fluch.png' });
  await p.click('.libitem >> text=Schild des Lichts'); await p.waitForTimeout(700); await (await p.$('#preview')).screenshot({ path: OUT + 'w-zauber.png' });
  // Export
  await p.click('.lib-dl button[data-act="game-export"]'); await p.waitForTimeout(300);
  await p.check('input[name=gx-scope][value=alle]'); await p.click('[data-act="gx-go"]');
  await p.waitForFunction(() => /gespeichert|abgebrochen/.test(document.querySelector('#gx-status').textContent), null, { timeout: 120000 });
  log('A5 Export:', await p.textContent('#gx-status'));
  const d = await p.evaluate(() => window.__dl); const zipPath = OUT + d.filename; fs.writeFileSync(zipPath, Buffer.from(d.b64, 'base64'));

  /* ---------- B. Probe-Spiel ---------- */
  const g = await b.newPage({ viewport: { width: 1366, height: 940 } });
  g.on('pageerror', e => errs.push('spiel: ' + e.message)); g.on('console', m => { if (m.type() === 'error' && !/net::|fonts/.test(m.text())) errs.push('spiel-console: ' + m.text()); });
  await g.goto('http://127.0.0.1:8765/index.html'); await g.waitForTimeout(700);
  await g.click('[data-go="decks"]'); await g.click('[data-dtab="cards"]');
  await g.setInputFiles('#imp', zipPath); await g.waitForTimeout(2500);
  const info = await g.evaluate(() => Object.values(WOK_APP.POOL.cards).filter(c => c.type === 'spell' || c.type === 'curse').map(c => c.name + ':' + c.type + ':' + (c.playable ? 'spielbar' : 'NICHT: ' + c.notPlayable.join(' '))));
  log('B1 Import:', info);
  await g.click('#ftype [data-ft="curse"]'); await g.waitForTimeout(300); await g.screenshot({ path: OUT + 's-sammlung.png' });
  // Deck: König, je 4 Zauber/Fluch, Rest Helden
  await g.evaluate(() => { const P = WOK_APP.POOL, h = Object.values(P.cards).find(c => c.type === 'hero'); for (let k = 0; k < 4; k++) P.cards['fill' + k] = Object.assign({}, h, { id: 'fill' + k, name: h.name + ' ' + (k + 2), rarity: 'gewoehnlich' }); }); // Kopienlimit 3: genug Helden für 40 Karten
  await g.click('[data-dtab="decks"]'); await g.click('#newdeck'); await g.fill('#deckname', 'Zaubertest');
  for (const n of ['Fluch der Schwäche', 'Schild des Lichts']) for (let i = 0; i < 3; i++) await g.click('#ed-pool .ptile:has-text("' + n + '") .cimg');
  await g.click('#autofill'); await g.waitForTimeout(300); await g.click('#ed-save'); await g.waitForTimeout(500);
  log('B2 Deck:', (await g.textContent('#deckgrid')).replace(/\s+/g, ' ').slice(0, 140));
  await g.click('#v-decks [data-go="home"]'); await g.click('[data-hplay="ai"]'); await g.selectOption('[data-deckpick="deckA"]', { label: 'Zaubertest' }); await g.selectOption('[data-deckpick="deckB"]', { label: 'Zaubertest' });
  await g.click('#start'); await g.waitForTimeout(800);
  // Szene: Spieler 0 in der Battlephase, gegnerischer Held 3 (Schütze) vor uns, Fluch auf der Hand
  await g.evaluate(() => {
    const G = WOK_APP.game, s = G.s; for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    s.active = 0; s.phase = 'battle'; s.counter = null; s.pendingDiscard = null; s.players[0].energy = 5; s.players[0].turns = 5; s.players[1].turns = 5;
    const mk = (cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
    window.__foe = mk('held3', 1, 'D4'); window.__me = mk('held9', 0, 'D5');
    const cid = Object.values(s.cards).find(c => c.name === 'Fluch der Schwäche').id, sid = Object.values(s.cards).find(c => c.name === 'Schild des Lichts').id;
    s.players[0].hand = [{ iid: 'hx1', cid }, { iid: 'hx2', cid: s.players[0].deck[0].cid }]; s.players[1].hand = s.players[1].hand.filter(h => s.cards[h.cid].type === 'hero');
    WOK_APP.game.sel = null; WOK_APP.dispatch({ type: 'declare', uid: window.__me, targets: [] });
  });
  await g.waitForTimeout(300);
  const atk0 = await g.evaluate(() => WOK.atkOf(WOK_APP.game.s, WOK_APP.game.s.units[window.__foe]));
  await g.click('.hcard[data-iid="hx1"]'); await g.waitForTimeout(300);
  await g.screenshot({ path: OUT + 's-hand.png' });
  await g.waitForTimeout(300); await g.click('[data-cast]'); await g.waitForTimeout(300);
  log('B3 Zielwahl:', (await g.textContent('.castbox')).replace(/\s+/g, ' ').slice(0, 160));
  const foeUid = await g.evaluate(() => window.__foe);
  await g.click('.tok[data-uid="' + foeUid + '"]'); await g.waitForTimeout(250);
  await g.click('.tok[data-uid="' + foeUid + '"]'); await g.waitForTimeout(250);
  await g.screenshot({ path: OUT + 's-cast.png' });
  await g.click('[data-cok]'); await g.waitForTimeout(300);
  log('B4 bereit zur Auswertung:', (await g.textContent('.stackbox')).replace(/\s+/g, ' '));
  await g.click('#mainbtn'); await g.waitForTimeout(400); if (await g.isVisible('#ov')) { await g.click('#dlg [data-act="go"], #dlg [data-act="yes"]').catch(() => {}); }
  await g.waitForFunction(() => WOK_APP.game.s.phase === 'summon2', null, { timeout: 15000 });
  const r1 = await g.evaluate(() => { const s = WOK_APP.game.s, u = s.units[window.__foe]; return { atk: WOK.atkOf(s, u), schuetze: WOK.has(s, u, 'schuetze'), fx: WOK.effectsOn(s, u).map(e => e.text) }; });
  log('B5 Wirkung: ATK', atk0, '→', r1.atk, '| Schütze aktiv:', r1.schuetze, '|', r1.fx.join(' / '));
  await g.click('.tok[data-uid="' + foeUid + '"]'); await g.waitForTimeout(250); await g.screenshot({ path: OUT + 's-wirkung.png' });
  // Speichern/Laden mit laufender Wirkung
  await g.reload(); await g.waitForTimeout(800); await g.click('#resume'); await g.waitForTimeout(600);
  const r2 = await g.evaluate(() => { const s = WOK_APP.game.s, u = s.units[window.__foe] || Object.values(s.units).find(x => x.cid === 'held3'); return { atk: WOK.atkOf(s, u), schuetze: WOK.has(s, u, 'schuetze') }; });
  log('B6 nach Neuladen:', JSON.stringify(r2));
  // Zugende: ATK-Senkung endet, Gabenblock läuft weiter
  await g.evaluate(() => { WOK_APP.game.aiSide = -1; });
  await g.click('#mainbtn'); await g.waitForTimeout(400); if (await g.isVisible('#ov')) { await g.click('#dlg [data-act="go"]'); await g.waitForTimeout(400); }
  const r3 = await g.evaluate(() => { const s = WOK_APP.game.s, u = Object.values(s.units).find(x => x.cid === 'held3'); return { atk: WOK.atkOf(s, u), schuetze: WOK.has(s, u, 'schuetze'), active: s.active }; });
  log('B7 nach Zugende:', JSON.stringify(r3));
  /* ---------- C. Konterphase: Schutzzauber gegen einen Angriff ---------- */
  await g.evaluate(() => {
    const G = WOK_APP.game, s = G.s; G.aiSide = -1; G.mode = 'ai'; G.view = 0;
    for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    const mk = (cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
    window.__att = mk('held9', 1, 'D4'); window.__def = mk('held1', 0, 'D5');
    const sid = Object.values(s.cards).find(c => c.name === 'Schild des Lichts').id;
    s.players[0].hand = [{ iid: 'hs1', cid: sid }]; s.active = 1; s.phase = 'battle'; s.decl = {}; s.stack = [];
    WOK_APP.dispatch({ type: 'declare', p: 1, uid: window.__att, targets: [window.__def] });
    WOK_APP.dispatch({ type: 'endPhase', p: 1 });
  });
  await g.waitForTimeout(400); if (await g.isVisible('#ov')) await g.evaluate(() => { document.querySelector('#ov').hidden = true; });
  log('C1 Phase:', await g.evaluate(() => WOK_APP.game.s.phase + ' / Konter: ' + WOK_APP.game.s.counter), '| Knopf:', await g.textContent('#mainbtn'));
  await g.click('.hcard[data-iid="hs1"]'); await g.waitForTimeout(300); await g.click('[data-cast]'); await g.waitForTimeout(300);
  const defUid = await g.evaluate(() => window.__def);
  await g.click('.tok[data-uid="' + defUid + '"]'); await g.waitForTimeout(250); await g.click('[data-cok]'); await g.waitForTimeout(250);
  await g.screenshot({ path: OUT + 's-konter.png' });
  await g.click('#mainbtn'); await g.waitForTimeout(400); if (await g.isVisible('#ov')) { log('C2 Spielhilfe-Dialog:', (await g.textContent('#dlg')).replace(/\s+/g, ' ').slice(0, 120)); await g.click('#dlg [data-act="go"]'); await g.waitForTimeout(400); }
  log('C2 Ergebnis:', await g.evaluate(() => { const s = WOK_APP.game.s; return 'Verteidiger lebt: ' + !!s.units[window.__def] + ', Angreifer lebt: ' + !!s.units[window.__att] + ' | ' + s.log.slice(-4).map(l => l.text).join(' / '); }));
  await g.screenshot({ path: OUT + 's-nachkonter.png' });
  // Regeln
  await g.evaluate(() => { WOK_APP.game = null; }); await g.goto('http://127.0.0.1:8765/index.html'); await g.waitForTimeout(500); await g.click('[data-hnav="settings"]'); await g.click('#dlg [data-act="rules"]'); await g.waitForTimeout(200);
  log('D Regeln:', (await g.textContent('#rules')).includes('Offene Regelfragen zu Zaubern'));
  log('Fehler:', errs.length ? errs : 'keine');
  await b.close();
})();
