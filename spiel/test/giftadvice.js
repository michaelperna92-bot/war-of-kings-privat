// Spielhilfe für Heldengaben: Prognose vor der Aktivierung (Konterphase und Battlephase), Warnung bei wirkungslosen Gaben, kein Verbot
const { chromium } = require('playwright'); const SH = '/tmp/claude-0/sf/shots/';
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 860 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:8765/index.html'); await pg.waitForTimeout(700);
  await pg.evaluate(() => { localStorage.removeItem('wok-spiel-save'); }); await pg.click('[data-hnav="quick"]'); await pg.waitForTimeout(1200);
  // Testaufstellung in die laufende Partie setzen
  const setup = (sc) => pg.evaluate((sc) => {
    const W = window.WOK, g = WOK_APP.game, s = W.clone(g.s);
    const H = (id, o) => W.normalizeCard(Object.assign({ id, type: 'hero', name: o.name || id, rarity: 'gewoehnlich', energy: 1, atk: 1000, def: 1000, move: { dirs: { n: 1 }, showNumber: true, number: 1 }, attack: { dirs: { n: 1 } }, gifts: [] }, o));
    for (const u of Object.values(s.units)) if (!u.king) delete s.units[u.uid];
    const put = (cid, owner, pos) => { const uid = 'u' + (s.nextId++); s.units[uid] = { uid, cid, owner, pos, king: false, summonTurn: -5, moved: false, cd: {}, fx: [], poison: null, flags: {}, attached: [] }; return uid; };
    s.cards.T_PZ = H('T_PZ', { name: 'Panzerwache', atk: 500, def: 900, gifts: [{ id: 'eisenpanzer' }] }); s.cards.T_EW = H('T_EW', { name: 'Klingenmeister', atk: 500, def: 900, gifts: [{ id: 'entwaffnen' }] });
    s.cards.T_ML = H('T_ML', { name: 'Berserker', atk: 800, def: 800, gifts: [{ id: 'mordlust' }] }); s.cards.T_A1 = H('T_A1', { name: 'Ork', atk: 1100, def: 1000 }); s.cards.T_A2 = H('T_A2', { name: 'Riese', atk: 2000, def: 1000 }); s.cards.T_D = H('T_D', { name: 'Wache', atk: 300, def: 1100 });
    s.stack = []; s.decl = {}; s.pendingDiscard = null; s.result = null;
    let mine;
    if (sc === 'counterGood' || sc === 'counterUseless' || sc === 'entwaffnen') {
      const att = put(sc === 'counterUseless' ? 'T_A2' : 'T_A1', 1, 'D4'); mine = put(sc === 'entwaffnen' ? 'T_EW' : 'T_PZ', 0, 'D5');
      s.active = 1; s.phase = 'counter'; s.counter = 0; s.decl[att] = { targets: [mine] };
    } else { mine = put('T_ML', 0, 'D5'); put('T_D', 1, 'D4'); s.active = 0; s.phase = 'battle'; s.counter = null; }
    g.s = s; g.sel = { kind: 'unit', uid: mine }; g.gift = null; g.view = 0; WOK_APP.renderNow(); return mine;
  }, sc);
  const giftBtn = async () => { await pg.waitForTimeout(300); const r = await pg.evaluate(() => { const bt = document.querySelector('#qgifts button:not([disabled])'); if (!bt) return 'kein Knopf: ' + (document.querySelector('#qgifts') ? document.querySelector('#qgifts').textContent : '-'); bt.click(); return 'ok'; }); await pg.waitForTimeout(400); return r; };
  const res = async (label) => { const dlg = await pg.isVisible('#dlg [data-act="go"]'); const t = dlg ? await pg.textContent('#dlg') : await pg.textContent('#toast'); console.log(label, dlg ? '[Warnung]' : '[Hinweis]', t.replace(/\s+/g, ' ').slice(0, 260)); return dlg; };
  // 1. Konterphase: Eisenpanzer rettet den Helden
  let me = await setup('counterGood'); console.log('Knopf:', await giftBtn()); await res('1 Eisenpanzer sinnvoll:'); await pg.screenshot({ path: SH + 'gift-good.png' });
  console.log('   aktiviert:', await pg.evaluate(u => WOK.defOf(WOK_APP.game.s, WOK_APP.game.s.units[u]), me));
  // 2. Konterphase: Eisenpanzer wirkungslos (2000 ATK)
  me = await setup('counterUseless'); await giftBtn(); const w2 = await res('2 Eisenpanzer wirkungslos:'); await pg.screenshot({ path: SH + 'gift-warn.png' });
  if (w2) { await pg.click('#dlg [data-act="no"]'); await pg.waitForTimeout(200); console.log('   abgebrochen, DEF:', await pg.evaluate(u => WOK.defOf(WOK_APP.game.s, WOK_APP.game.s.units[u]), me)); }
  // 3. Entwaffnen in der Konterphase auf den Angreifer
  me = await setup('entwaffnen'); await giftBtn(); await pg.waitForTimeout(200); const tgt = await pg.evaluate(() => Object.values(WOK_APP.game.s.units).find(u => u.owner === 1 && !u.king).uid);
  await pg.click('.tok[data-uid="' + tgt + '"]', { force: true }).catch(async () => { await pg.evaluate(t => document.querySelector('[data-uid="' + t + '"]').click(), tgt); }); await pg.waitForTimeout(400); await res('3 Entwaffnen auf Angreifer:');
  if (await pg.isVisible('#dlg [data-act="go"]')) { await pg.click('#dlg [data-act="go"]'); await pg.waitForTimeout(300); console.log('   trotzdem aktiviert, DEF Angreifer:', await pg.evaluate(t => WOK.defOf(WOK_APP.game.s, WOK_APP.game.s.units[t]), tgt)); }
  // 4. Battlephase: Mordlust macht den Angriff auf die Wache erfolgreich (800 → 1300 gegen 1100 DEF)
  me = await setup('battle'); await giftBtn(); await res('4 Mordlust Battlephase:');
  console.log('Fehler:', errs); await b.close(); })();
