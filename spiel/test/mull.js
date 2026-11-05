// Hilfe für Oberflächentests (ab 4.5): Starthand-Auswahl abschließen – alle menschlichen Seiten behalten ihre Hand.
module.exports = async (pg, redraw) => {
  for (let i = 0; i < 40; i++) {
    const st = await pg.evaluate(() => { const g = window.WOK_APP && WOK_APP.game; return g ? g.s.phase : 'kein'; }).catch(() => 'kein');
    if (st !== 'mulligan') { if (st !== 'kein' || i > 10) return; await pg.waitForTimeout(150); continue; }
    const go = await pg.$('#ov:not([hidden]) #dlg [data-act="go"]'); if (go && !(await pg.$('#dlg .mhand'))) { await go.evaluate(e => e.click()); await pg.waitForTimeout(150); continue; }
    const k = await pg.$('#ov:not([hidden]) #dlg [data-act="' + (redraw ? 'new' : 'keep') + '"]'); if (k) { await k.evaluate(e => e.click()); await pg.waitForTimeout(250); continue; }
    await pg.waitForTimeout(250);
  }
};
