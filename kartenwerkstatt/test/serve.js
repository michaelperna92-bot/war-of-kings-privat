const fs = require('fs'), path = require('path');
const FD = '/mnt/skills/examples/canvas-design/canvas-fonts/';
const map = { 'Cinzel': 'Italiana-Regular.ttf', 'Cinzel Decorative': 'Gloock-Regular.ttf', 'Cormorant Garamond': 'CrimsonPro-Regular.ttf', 'Cormorant SC': 'LibreBaskerville-Regular.ttf',
  'Marcellus': 'YoungSerif-Regular.ttf', 'Marcellus SC': 'ArsenalSC-Regular.ttf', 'Spectral': 'Lora-Regular.ttf', 'Spectral SC': 'ArsenalSC-Regular.ttf', 'IM Fell English': 'InstrumentSerif-Regular.ttf',
  'IM Fell English SC': 'Italiana-Regular.ttf', 'Alegreya': 'Lora-Regular.ttf', 'Alegreya SC': 'ArsenalSC-Regular.ttf', 'Playfair Display SC': 'Gloock-Regular.ttf', 'Almendra SC': 'YoungSerif-Regular.ttf',
  'Grenze Gotisch': 'KaTeX_Fraktur-Bold.ttf', 'UnifrakturMaguntia': 'KaTeX_Fraktur-Regular.ttf', 'Pirata One': 'KaTeX_Fraktur-Bold.ttf', 'Uncial Antiqua': 'PoiretOne-Regular.ttf', 'Forum': 'Italiana-Regular.ttf', 'EB Garamond': 'CrimsonPro-Bold.ttf' };
require('http').createServer((q, r) => {
  if (q.url.startsWith('/css')) {
    const fam = decodeURIComponent((q.url.match(/family=([^&:]+)/) || [])[1] || '').replace(/\+/g, ' ');
    r.setHeader('content-type', 'text/css'); r.setHeader('access-control-allow-origin', '*');
    r.end(map[fam] ? '@font-face{font-family:"' + fam + '";font-weight:100 900;src:url(/font/' + map[fam] + ')}' : ''); return;
  }
  if (q.url.startsWith('/font/')) { const f = path.basename(q.url); const p = fs.existsSync(FD + f) ? FD + f : '/opt/npm-tools/node_modules/katex/dist/fonts/' + f; r.setHeader('content-type', 'font/ttf'); r.setHeader('access-control-allow-origin', '*'); r.end(fs.readFileSync(p)); return; }
  r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync('/home/claude/cc/dist/test.html'));
}).listen(8770);
