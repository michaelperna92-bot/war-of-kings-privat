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
// Effekt-Bilder (1.11.2026, aufbereitet mit tools/fx/build-fx.py): eingebettet, Spritesheets als Streifen mit Bildzahl
const fxPack = (() => { const D = path.join(__dirname, 'assets', 'fx'); const frames = JSON.parse(fs.readFileSync(path.join(D, 'frames.json'), 'utf8')); const img = {};
  for (const f of fs.readdirSync(D).filter(f => /\.webp$/.test(f))) img[f.replace(/\.webp$/, '')] = 'data:image/webp;base64,' + fs.readFileSync(path.join(D, f)).toString('base64');
  return 'window.WOK_FX = ' + JSON.stringify({ img, frames }) + ';'; })();
// Arena hinter dem 3D-Spielfeld (4.12): assets/arena/arena.mp4 (Video, als eigene Datei daneben wie die Musik) und/oder arena.webp (Standbild, eingebettet)
const ARENA = (() => { const D = path.join(__dirname, 'assets', 'arena'), has = f => fs.existsSync(path.join(D, f)), o = {};
  if (has('arena.webp')) o.image = 'data:image/webp;base64,' + fs.readFileSync(path.join(D, 'arena.webp')).toString('base64');
  if (has('arena.mp4')) { o.video = 'arena/arena.mp4'; for (const d of [path.join(__dirname, 'desktop', 'app', 'arena'), path.join(__dirname, 'dist', 'web', 'arena')]) { fs.mkdirSync(d, { recursive: true }); fs.copyFileSync(path.join(D, 'arena.mp4'), path.join(d, 'arena.mp4')); } }
  try { Object.assign(o, JSON.parse(fs.readFileSync(path.join(D, 'arena.json'), 'utf8'))); } catch (e) {}
  return 'window.WOK_ARENA = window.WOK_ARENA || ' + JSON.stringify(o) + ';'; })();
// Kartenrückseite (5.11.2026, vom Entwickler, Higgsfield): eingebettet, groß (Ziehen, große Ansicht) und klein (gegnerische Hand)
const BACK = (() => { const D = path.join(__dirname, 'assets', 'rueckseite'), b = f => 'data:image/webp;base64,' + fs.readFileSync(path.join(D, f)).toString('base64');
  return 'window.WOK_BACK = ' + JSON.stringify({ big: b('rueckseite.webp'), small: b('rueckseite-klein.webp') }) + ';'; })();
// Adresse des Spielservers (nach der Bereitstellung in server-url.txt eintragen) – für PC-Version und Browser-Datei
const SERVER_URL = (() => { try { return fs.readFileSync(path.join(__dirname, 'server-url.txt'), 'utf8').trim(); } catch (e) { return ''; } })();
const serverCfg = 'window.WOK_SERVER_URL = ' + JSON.stringify(SERVER_URL) + ';';
const blocks = [['server', serverCfg], ['arena', ARENA], ['rueckseite', BACK], ['spielfeld', field], ['effekte', fxPack], ['menu', menu], ['musik', music], ['werkstatt-assets', assets], ['regelwerk', rules], ['werkstatt-data', ccr('data.js')], ['werkstatt-effects', ccr('effects.js')], ['werkstatt-render', ccr('render.js')]]
  .concat([['3d-three', fs.readFileSync(path.join(__dirname, 'assets', '3d', 'three-bundle.js'), 'utf8')], ['3d-gsap', fs.readFileSync(path.join(__dirname, 'assets', '3d', 'gsap.min.js'), 'utf8')]]) // 4.11.2026: three.js r169 (MIT) + GSAP 3.12.5 – tools/3d/build-3d.sh
  .concat(['gamedata.js', 'demo-cards.js', 'engine.js', 'ai.js', 'advisor.js', 'deckbuilder.js', 'cardart.js', 'board3d.js', 'app.js'].map(f => [f, r(f)]));
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
