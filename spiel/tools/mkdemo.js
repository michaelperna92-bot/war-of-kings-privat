// Erzeugt Demo-Decks A und B mit dem Würfel der Kartenwerkstatt (Werkstatt-Dateien werden nur gelesen, nicht verändert).
const fs = require('fs'), vm = require('vm'), path = require('path');
const CC = require('../ccpath.js');
const ctx = { window: {}, console }; vm.createContext(ctx);
for (const f of ['data.js', 'power.js']) vm.runInContext(fs.readFileSync(path.join(CC, f), 'utf8'), ctx, { filename: f });
const D = ctx.window.WOK_DATA, PW = ctx.window.WOK_POWER;
let seed = 20261029; const rng = () => { let t = (seed = (seed + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rng() * a.length)];
const A1 = ['Asch', 'Brann', 'Dorn', 'Eis', 'Fels', 'Glut', 'Hain', 'Klinge', 'Mond', 'Nebel', 'Rost', 'Schatten', 'Sturm', 'Wolf', 'Zorn', 'Eisen', 'Blut', 'Stern', 'Frost', 'Donner'];
const A2 = ['wächter', 'reiter', 'jäger', 'brecher', 'seher', 'klaue', 'schwinge', 'hüter', 'läufer', 'bringer', 'schmied', 'rufer', 'zahn', 'fürst', 'wanderer'];
const used = new Set();
const nm = () => { for (;;) { const n = pick(A1) + pick(A2); if (!used.has(n)) { used.add(n); return n; } } };
function hero(rar, deck, i) {
  const c = PW.generate(rar, rng); if (!c) throw new Error('kein Ergebnis ' + rar);
  const id = PW.randomIdentity(rng, true);
  return Object.assign({ id: 'demo_' + deck + '_' + i, type: 'hero', name: nm(), status: 'entwurf' }, id, c, { rarity: c.rarity });
}
function king(deck, name, gifts) {
  const k = PW.generateKing('selten', rng, { fixed: { giftObjs: gifts } }) || {};
  return Object.assign({ id: 'demo_' + deck + '_koenig', type: 'king', name, rarity: k.rarity || 'selten', atk: k.atk || 2500, hp: k.hp || 15000, attack: k.attack || { dirs: { n: 1, ne: 1, nw: 1 } }, move: { dirs: {} }, gifts: gifts, element: pick(D.ELEMENTS).id, race: 'mensch', classes: ['ritter', null] });
}
const out = [], decks = {};
for (const [deck, kname, kg] of [['A', 'König Aldric', [{ id: 'zorn_des_imperators', scope: 'all', amount: 200 }]], ['B', 'Königin Morwen', [{ id: 'ewiges_bollwerk', scope: 'all', amount: 200 }, { id: 'gebot_der_krone', scope: 'all', amount: 1 }]]]) {
  const ids = []; let i = 0;
  const kc = king(deck, kname, kg); out.push(kc); ids.push(kc.id);
  for (const [rar, n, copies] of [['gewoehnlich', 8, 3], ['ungewoehnlich', 4, 2], ['selten', 3, 2], ['legendaer', 1, 1]]) for (let k = 0; k < n; k++) { const c = hero(rar, deck, i++); out.push(c); for (let j = 0; j < copies; j++) ids.push(c.id); }
  decks[deck] = ids;
}
const payload = { format: 'war-of-kings-kartenwerkstatt', version: 1, exported: new Date().toISOString(), source: 'Demo-Decks (Würfel der Kartenwerkstatt)', cards: out, decks };
fs.writeFileSync(path.join(__dirname, '../src/demo-cards.js'), '// automatisch erzeugt von tools/mkdemo.js\nwindow.WOK_DEMO = ' + JSON.stringify(payload) + ';\n');
console.log(out.length, 'Karten', Object.values(decks).map(d => d.length));
