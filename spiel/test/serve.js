const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'desktop', 'app');
http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); r.end(d); }); }).listen(8765, '127.0.0.1');
