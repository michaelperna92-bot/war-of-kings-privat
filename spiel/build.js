// Baut das Probe-Spiel als eine HTML-Datei (Cloud) und als vollständiges Dokument für den PC-Installer.
const fs = require('fs'), path = require('path');
const r = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
// Aus der Kartenwerkstatt nur gelesen und unverändert eingebettet: Stammdaten, Kartenrenderer, Vorlagen und Wappen
const CC = require('./ccpath.js');
const ccr = f => fs.readFileSync(path.join(CC, f), 'utf8');
const assets = (() => { const s = ccr('assets.js'); const o = JSON.parse(s.slice(s.indexOf('=') + 1).trim().replace(/;$/, '')); delete o.refs; return 'window.WOK_ASSETS=' + JSON.stringify(o) + ';'; })();
const rules = 'window.WOK_RULES = ' + JSON.stringify(fs.readFileSync(path.join(__dirname, 'tools', 'regelwerk.txt'), 'utf8')) + ';';
// Gemeinsames Effektformat für Zauber und Flüche: auch als Kopie in src/ (für die Tests in Node)
fs.writeFileSync(path.join(__dirname, 'src', 'effects.js'), ccr('effects.js'));
// Spielfeld-Grafik (Einbaupaket): Bild eingebettet, damit die Cloud-Fassung eine einzige Datei bleibt
const field = (() => { const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'spielfeld', 'layout.json'), 'utf8')); const img = 'data:image/webp;base64,' + fs.readFileSync(path.join(__dirname, 'assets', 'spielfeld', 'battlefield.webp')).toString('base64');
  const slots = {}; for (const x of L.slots) slots[x.id] = { x: x.x, y: x.y, w: x.width, h: x.height, role: x.role };
  return 'window.WOK_FIELD = ' + JSON.stringify({ slots, img }) + ';'; })();
// Kampfmusik: als eigene Dateien neben der Seite (Cloud: Begleitdateien des Artifacts, PC: eingebauter Server)
const MUSIC = fs.readdirSync(path.join(__dirname, 'assets', 'musik')).filter(f => /\.mp3$/.test(f)).sort();
fs.mkdirSync(path.join(__dirname, 'desktop', 'app', 'musik'), { recursive: true });
for (const f of MUSIC) fs.copyFileSync(path.join(__dirname, 'assets', 'musik', f), path.join(__dirname, 'desktop', 'app', 'musik', f));
const TITLES = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'musik', 'titel.json'), 'utf8')); } catch (e) { return {}; } })();
const music = 'window.WOK_MUSIC = ' + JSON.stringify(MUSIC.map(f => 'musik/' + f)) + '; window.WOK_MUSIC_TITLES = ' + JSON.stringify(Object.fromEntries(MUSIC.map(f => ['musik/' + f, TITLES[f] || f.replace(/\.mp3$/, '')]))) + ';';
// Hauptmenü und Königlicher Basar: Bilder eingebettet, das Händler-Video liegt als eigene Datei daneben (wie die Musik)
const menu = (() => { const b64 = (f, t) => 'data:' + t + ';base64,' + fs.readFileSync(path.join(__dirname, 'assets', f)).toString('base64');
  fs.mkdirSync(path.join(__dirname, 'desktop', 'app', 'basar'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'assets', 'basar', 'basar.mp4'), path.join(__dirname, 'desktop', 'app', 'basar', 'basar.mp4'));
  return 'window.WOK_MENU = ' + JSON.stringify({ menu: b64('menu/hauptmenue.webp', 'image/webp'), poster: b64('basar/basar-start.webp', 'image/webp'), pack7: b64('basar/pack-7.webp', 'image/webp'), pack12: b64('basar/pack-12.webp', 'image/webp'), video: 'basar/basar.mp4', mates: Object.fromEntries(['ritter', 'alter-koenig', 'junger-koenig', 'haendler'].map(k => [k, b64('menu/mate-' + k + '.webp', 'image/webp')])) }) + ';'; })();
// Adresse des Spielservers (nach der Bereitstellung in server-url.txt eintragen) – für PC-Version und Browser-Datei
const SERVER_URL = (() => { try { return fs.readFileSync(path.join(__dirname, 'server-url.txt'), 'utf8').trim(); } catch (e) { return ''; } })();
const serverCfg = 'window.WOK_SERVER_URL = ' + JSON.stringify(SERVER_URL) + ';';
const blocks = [['server', serverCfg], ['spielfeld', field], ['menu', menu], ['musik', music], ['werkstatt-assets', assets], ['regelwerk', rules], ['werkstatt-data', ccr('data.js')], ['werkstatt-effects', ccr('effects.js')], ['werkstatt-render', ccr('render.js')]]
  .concat(['gamedata.js', 'demo-cards.js', 'engine.js', 'ai.js', 'advisor.js', 'deckbuilder.js', 'cardart.js', 'app.js'].map(f => [f, r(f)]));
const js = blocks.map(([n, src]) => { if (/<\/script/i.test(src)) throw new Error('script-Ende in ' + n); return '<script>\n' + src + '\n</script>'; }).join('\n');
const UI_FONTS = ['Alegreya+Sans:wght@400;500;700', 'Barlow+Semi+Condensed:wght@600;700', 'Marcellus+SC'];
const CARD_FONTS = ['Cinzel:wght@500;600;700;800;900', 'Cinzel+Decorative:wght@400;700;900', 'Cormorant+Garamond:wght@500;600;700', 'Cormorant+SC:wght@500;600;700', 'EB+Garamond:wght@500;600;700;800', 'Marcellus', 'Spectral:wght@400;500;600;700', 'Spectral+SC:wght@500;600;700', 'IM+Fell+English', 'IM+Fell+English+SC', 'Alegreya:wght@500;700;800', 'Alegreya+SC:wght@500;700;800', 'Playfair+Display+SC:wght@700;900', 'Almendra+SC', 'Grenze+Gotisch:wght@500;600;700;800', 'UnifrakturMaguntia', 'Pirata+One', 'Uncial+Antiqua', 'Forum'];
const gf = fams => '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + fams.join('&family=') + '&display=swap" media="print" onload="this.media=&#39;all&#39;">\n';
const title = '<title>War of Kings Probe-Spiel</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n';
const style = '<style>\n' + r('style.css') + '\n</style>\n';
const cloudHead = title + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' + gf(UI_FONTS) + gf(CARD_FONTS) + style;
const page = cloudHead + r('body.html') + '\n' + js + '\n';
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'wok-spiel.html'), page);
// PC: Schriften kommen vom eingebauten Server (einmal laden, dann offline)
const pcHead = title + '<link rel="stylesheet" href="/fonts.css">\n<link rel="icon" href="/icon.png">\n' + style;
const full = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + pcHead + '</head><body>\n' + r('body.html') + '\n' + js + '\n</body></html>\n';
fs.mkdirSync(path.join(__dirname, 'desktop', 'app'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'desktop', 'app', 'index.html'), full);
// Browser-Datei: läuft in jedem Browser ohne Installation (Online-Duell über 🌐 Internet); Schriften von Google.
// Händler-Video und Kampfmusik sind hier eingebettet, damit die eine Datei alles enthält.
{
  const b64f = (f, t) => 'data:' + t + ';base64,' + fs.readFileSync(path.join(__dirname, 'assets', f)).toString('base64');
  const media = 'window.WOK_MENU.video = ' + JSON.stringify(b64f('basar/basar.mp4', 'video/mp4')) + '; window.WOK_MUSIC = ' + JSON.stringify(MUSIC.map(f => b64f('musik/' + f, 'audio/mpeg'))) + '; window.WOK_MUSIC_TITLES = {}; window.WOK_MUSIC_TITLE_LIST = ' + JSON.stringify(MUSIC.map(f => TITLES[f] || f.replace(/\.mp3$/, ''))) + ';';
  const jsB = js.replace('<script>\n' + music + '\n</script>', '<script>\n' + music + '\n</script>\n<script>\n' + media + '\n</script>');
  if (jsB === js) throw new Error('Browser-Datei: Medien nicht eingesetzt');
  fs.writeFileSync(path.join(__dirname, 'dist', 'WoK-Probe-Spiel-Browser.html'), '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + cloudHead + '</head><body>\n' + r('body.html') + '\n' + jsB + '\n</body></html>\n');
}
// Web-Version für den Spielserver (server/server.js liefert dist/web aus): Medien als eigene Dateien daneben
{
  const web = path.join(__dirname, 'dist', 'web'); fs.mkdirSync(path.join(web, 'musik'), { recursive: true }); fs.mkdirSync(path.join(web, 'basar'), { recursive: true });
  for (const f of MUSIC) fs.copyFileSync(path.join(__dirname, 'assets', 'musik', f), path.join(web, 'musik', f));
  fs.copyFileSync(path.join(__dirname, 'assets', 'basar', 'basar.mp4'), path.join(web, 'basar', 'basar.mp4'));
  fs.writeFileSync(path.join(web, 'index.html'), '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<script>window.WOK_SERVER_SAME_ORIGIN = true;</script>\n' + cloudHead + '</head><body>\n' + r('body.html') + '\n' + js + '\n</body></html>\n');
  // Stammdaten für die Engine auf dem Server
  fs.mkdirSync(path.join(__dirname, 'server', 'vendor'), { recursive: true }); fs.copyFileSync(path.join(CC, 'data.js'), path.join(__dirname, 'server', 'vendor', 'data.js'));
}
fs.writeFileSync(path.join(__dirname, 'desktop', 'fonts.txt'), UI_FONTS.concat(CARD_FONTS).join('\n') + '\n');
console.log('gebaut', (page.length / 1024 / 1024).toFixed(2) + ' MB');
