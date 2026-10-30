// Übernimmt Namen und Gabentexte aus der Kartenwerkstatt (nur lesend) für die Anzeige im Spiel.
const fs = require('fs'), vm = require('vm');
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(require('path').join(require('../ccpath.js'), 'data.js'), 'utf8'), ctx);
const D = ctx.window.WOK_DATA;
const pick = (l, ...k) => l.map(x => Object.fromEntries(k.filter(q => x[q] !== undefined).map(q => [q, x[q]])));
const out = {
  source: D.SOURCE,
  races: pick(D.RACES, 'id', 'name'), classes: pick(D.CLASSES, 'id', 'name'), elements: pick(D.ELEMENTS, 'id', 'name'),
  rarities: pick(D.RARITIES, 'id', 'name', 'limit'),
  gifts: D.GIFTS.map(g => ({ id: g.id, name: g.name, kind: g.kind, ct: g.ct || 0, short: g.short, text: g.text })),
  royal: D.ROYAL_GIFTS.map(g => ({ id: g.id, name: g.name, text: g.text, param: g.param }))
};
fs.writeFileSync(__dirname + '/../src/gamedata.js', '// automatisch erzeugt von tools/mkdata.js aus der Kartenwerkstatt (data.js)\nwindow.WOK_GD = ' + JSON.stringify(out) + ';\n');
console.log('ok', out.gifts.length, out.royal.length);
