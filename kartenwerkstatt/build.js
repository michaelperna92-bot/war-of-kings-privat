const fs = require('fs');
const src = fs.readFileSync('studio.src.html', 'utf8');
const parts = { '/*ASSETS*/': 'assets.js', '/*DATA*/': 'data.js', '/*RENDER*/': 'render.js', '/*POWER*/': 'power.js', '/*INDOOR*/': 'indoor.js', '/*STORE*/': 'store.js', '/*AIMODE*/': 'aimode.js', '/*STUDIO*/': 'studio.js', '/*ENGINE*/': 'engine-export.js', '/*KIT*/': 'asset-kit.js', '/*GAMEX*/': 'game-export.js', '/*EFFECTS*/': 'effects.js', '/*SPELLGEN*/': 'spell-gen.js', '/*SPELLED*/': 'spell-editor.js' };
function inline(h) {
  for (const [k, f] of Object.entries(parts)) { if (!h.includes(k)) throw new Error(k); const s = fs.readFileSync(f, 'utf8'); if (/<\/script/i.test(s)) throw new Error('script-Ende in ' + f); h = h.replace(k, () => s); }
  return h;
}
const h = inline(src);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/kartenwerkstatt.html', h);
const wrap = (head, body) => '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' + head + '</head><body>' + body + '</body></html>';
fs.writeFileSync('dist/test.html', wrap('', h));

/* Windows-Version: Schriften und pdf-lib kommen vom eingebauten Server, Daten als Dateien */
let d = src.replace(/<link rel="preconnect"[^>]*>\n?/g, '').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/g, '');
if (/googleapis/.test(d)) throw new Error('Google-Links übrig');
d = '<link rel="stylesheet" href="/fonts.css">\n<link rel="icon" href="/icon.png">\n<script>window.WOK_DESKTOP = true;\n'
  + 'setInterval(function(){ fetch("/api/ping",{method:"POST"}).catch(function(){}); }, 4000); fetch("/api/ping",{method:"POST"}).catch(function(){});\n'
  + 'addEventListener("pagehide", function(){ try { navigator.sendBeacon("/api/bye"); } catch(e){} });\n'
  + '(function(){ var n=0; function chk(){ fetch("/api/status").then(function(r){return r.json()}).then(function(j){ window.WOK_APPVER=j.version; if(j.fonts){ if(n>0){ var l=document.createElement("link"); l.rel="stylesheet"; l.href="/fonts.css?v="+Date.now(); l.onload=function(){ document.fonts.ready.then(function(){ try{ if(typeof G!=="undefined"&&G.thumbs) G.thumbs.clear(); redraw(); renderLib(); toast("Originalschriften geladen und dauerhaft gespeichert."); }catch(e){} }); }; document.head.appendChild(l);} } else if(n++<40){ if(n===2) try{ toast("Originalschriften fehlen noch: einmal mit Internet starten, dann bleiben sie für immer gespeichert. Bis dahin ähnliche Windows-Schriften.", 8000);}catch(e){} setTimeout(chk,3000);} }).catch(function(){}); } setTimeout(chk,1500); })();</script>\n' + d;
d = inline(d);
fs.mkdirSync('desktop/app', { recursive: true });
fs.writeFileSync('desktop/app/index.html', wrap('', d));
console.log('Größe', (h.length / 1024 / 1024).toFixed(2), 'MB; Desktop', (d.length / 1024 / 1024).toFixed(2), 'MB');
