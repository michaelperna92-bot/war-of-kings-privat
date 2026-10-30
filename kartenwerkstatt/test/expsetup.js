// Legt Testkarten an (gemeinsam genutzt von den Export-Tests)
module.exports = async function setup(p, SH) {
  const pick = async (k, v) => { await p.click(`[data-pick="${k}"][data-val="${v}"]`); await p.waitForTimeout(120); };
  const gift = async id => { await p.click('[data-act="gift-add"]'); await p.click(`[data-giftpick="${id}"]`); await p.waitForTimeout(150); };
  const mk = async (o) => {
    await p.click('[data-act="new"]').catch(() => {}); await p.waitForTimeout(400);
    await p.setInputFiles('#file-art', SH + o.art); await p.waitForTimeout(1500);
    await p.fill('#in-name', o.name); await p.fill('#in-atk', String(o.atk)); await p.fill('#in-def', String(o.def));
    await pick('element', o.el); if (o.el2) await pick('element2', o.el2);
    await pick('race', o.race); if (o.race2) await pick('race2', o.race2);
    await pick('class0', o.cls); if (o.cls2) await pick('class1', o.cls2);
    for (const d of o.atkDirs) await p.click(`[data-dir="atk:${d}"]`);
    for (const d of o.movDirs) await p.click(`[data-dir="mov:${d}"]`);
    for (const g of o.gifts) await gift(g);
    await p.click('#btn-save'); await p.waitForTimeout(600);
    if (o.release) { await p.click('[data-status="freigegeben"]'); await p.click('#btn-save'); await p.waitForTimeout(500); }
  };
  await mk({ name: 'Glutschwinge Kael', art: 'akuma_art.png', atk: 2000, def: 1500, el: 'feuer', el2: 'wasser', race: 'mensch', race2: 'drachen', cls: 'samurai', cls2: 'ritter', atkDirs: ['n', 'w', 'e'], movDirs: ['n'], gifts: ['ansturm', 'doppelschlag', 'mordlust'], release: true });
  await mk({ name: 'Eisenwacht Toren', art: 'hoch.png', atk: 1200, def: 1800, el: 'erde', race: 'zwerge', cls: 'tueftler', atkDirs: ['n'], movDirs: ['n', 'w', 'e'], gifts: ['eisenpanzer', 'heilung'], release: true });
  await mk({ name: 'Nebelpfeil Syra', art: 'akuma_art.png', atk: 900, def: 700, el: 'wind', race: 'elfen', cls: 'magier', atkDirs: ['n', 'nw', 'ne'], movDirs: ['n', 's'], gifts: ['blitzschritt'], release: false });
};
