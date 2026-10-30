/* War of Kings – Spielserver (serverautoritativ), ohne externe Pakete (nur Node.js ≥ 18).
 *
 * Aufgaben:
 *  - liefert die Web-Version aus (Ordner ../dist/web) – auch unter https, wenn der Hoster TLS davorschaltet
 *  - private Räume mit Code und Einladungslink  https://<adresse>/?raum=CODE
 *  - die Spiel-Engine läuft HIER: jede Aktion wird auf dem Server geprüft und angewendet, erst dann an beide verteilt.
 *    Clients können keine illegalen Züge ausführen und nicht auseinanderlaufen.
 *  - Wiederverbinden (gleiche Spieler-ID), doppelte Aktionen (laufende Nummer), Raumauflösung, ungültige Codes
 *
 * Start:  node server/server.js            (Port aus $PORT, sonst 8080)
 * Protokoll (WebSocket /ws, JSON):
 *   → hello {id, name}                       ← hello {ok, version}
 *   → create {deck}                          ← created {code}
 *   → join {code, deck}                      ← start {...} an beide
 *   → resume {code}                          ← start {..., acts}
 *   → act {code, n, a}                       ← act {n, a, p} an beide | reject {n, error}
 *   → img {code, id, full, art}              → an den Gegner weitergereicht (und im Raum gemerkt)
 *   → leave {code}
 *   ← peer {online: true|false}              Gegner verbunden / getrennt
 *   ← error {code?, msg}
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
global.window = global; require(path.join(__dirname, 'vendor', 'data.js')); delete global.window;
const W = require(path.join(__dirname, '..', 'src', 'engine.js'));

const PORT = +process.env.PORT || 8080;
const WEB = process.env.WOK_WEB || path.join(__dirname, '..', 'dist', 'web');
const VERSION = (() => { try { return (fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1] || '?'; } catch (e) { return '?'; } })();
// Offizielle Karten: der Entwickler veröffentlicht ein Spielpaket aus der Kartenwerkstatt (Schlüssel WOK_ADMIN_KEY),
// alle Spieler bekommen es beim Start angeboten. Gespeichert in WOK_DATA_DIR (Standard: server/data).
const DATA_DIR = process.env.WOK_DATA_DIR || path.join(__dirname, 'data'), ADMIN_KEY = process.env.WOK_ADMIN_KEY || '';
const PACK = path.join(DATA_DIR, 'offiziell.wokspiel'), PACK_META = path.join(DATA_DIR, 'offiziell.json');
const ROOM_TTL = 6 * 3600 * 1000, OPEN_TTL = 2 * 3600 * 1000, MAX_ROOMS = 500, MAX_MSG = 600 * 1024;
const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ---------- Räume ---------- */
const rooms = new Map(); // code -> room
const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { for (;;) { let c = ''; for (let i = 0; i < 6; i++) c += A[crypto.randomInt(A.length)]; if (!rooms.has(c)) return c; } }
function cleanDeck(d) {
  if (!d || !Array.isArray(d.ids) || d.ids.length !== 40 || typeof d.cards !== 'object') throw new Error('Ungültiges Deck.');
  const cards = {}; for (const id of new Set(d.ids)) { const c = d.cards[id]; if (!c || typeof c !== 'object') throw new Error('Karte ' + id + ' fehlt im Deck.'); cards[id] = W.normalizeCard(c); }
  const v = W.validateDeck(d.ids, cards); if (!v.ok) throw new Error('Deck nicht spielbereit: ' + (v.errors[0] || ''));
  return { name: String(d.name || 'Deck').slice(0, 40), ids: d.ids.map(String), cards };
}
function startRoom(r) {
  r.seed = crypto.randomInt(1, 2 ** 31);
  const cards = Object.assign({}, r.decks[1].cards, r.decks[0].cards);
  const res = W.newGame({ cards, decks: [r.decks[0].ids, r.decks[1].ids], fixedSides: true, seed: r.seed, sideNames: [r.names[0], r.names[1]], timer: false, counterReserve: false });
  r.state = res.state; r.acts = []; r.status = 'running'; r.started = Date.now();
}
// light = Abgleich einer laufenden Partie: ohne Kartenbilder (die hat der Client schon) – hält die Nachricht klein
function startMsg(r, slot, light) { return { t: 'start', code: r.code, me: slot, seed: r.seed, names: r.names, decks: r.decks.map(d => ({ name: d.name, ids: d.ids, cards: d.cards })), acts: r.acts, imgs: light ? {} : r.imgs, light: !!light, result: r.state && r.state.result || null }; }
function actorOf(s) { return s.pendingDiscard !== null ? s.pendingDiscard : s.phase === 'counter' ? s.counter : s.active; }

/* ---------- Verbindungen ---------- */
const sockets = new Set();
function send(c, o) { if (!c || c.dead) return; try { wsSend(c.sock, JSON.stringify(o)); } catch (e) { } }
function peerOf(r, slot) { return r.conn[1 - slot]; }
function handle(c, m) {
  if (!m || typeof m.t !== 'string') return;
  if (m.t === 'hello') { c.id = String(m.id || '').slice(0, 40) || 'g' + crypto.randomUUID(); c.name = String(m.name || 'Spieler').slice(0, 30); send(c, { t: 'hello', ok: true, version: VERSION }); return; }
  if (!c.id) { send(c, { t: 'error', msg: 'Erst anmelden (hello).' }); return; }
  const r = m.code ? rooms.get(String(m.code).toUpperCase()) : null;
  switch (m.t) {
    case 'create': {
      if (rooms.size >= MAX_ROOMS) return send(c, { t: 'error', msg: 'Server voll – bitte später.' });
      let deck; try { deck = cleanDeck(m.deck); } catch (e) { return send(c, { t: 'error', msg: e.message }); }
      const code = newCode();
      rooms.set(code, { code, status: 'open', created: Date.now(), touched: Date.now(), ids: [c.id, null], names: [c.name, ''], decks: [deck, null], conn: [c, null], imgs: {}, acts: [], state: null });
      c.room = code; c.slot = 0; log('Raum', code, 'von', c.name);
      return send(c, { t: 'created', code });
    }
    case 'join': {
      if (!r) return send(c, { t: 'error', code: 'no_room', msg: 'Diesen Raum gibt es nicht (mehr). Code oder Link prüfen.' });
      if (r.ids[0] === c.id || r.ids[1] === c.id) return handle(c, { t: 'resume', code: r.code });
      if (r.status !== 'open') return send(c, { t: 'error', code: 'full', msg: 'In diesem Raum wird schon gespielt.' });
      let deck; try { deck = cleanDeck(m.deck); } catch (e) { return send(c, { t: 'error', msg: e.message }); }
      r.ids[1] = c.id; r.names[1] = c.name; r.decks[1] = deck; r.conn[1] = c; c.room = r.code; c.slot = 1; r.touched = Date.now();
      try { startRoom(r); } catch (e) { r.ids[1] = null; r.decks[1] = null; r.conn[1] = null; return send(c, { t: 'error', msg: 'Start fehlgeschlagen: ' + e.message }); }
      log('Raum', r.code, 'startet:', r.names.join(' gegen '));
      for (const s of [0, 1]) send(r.conn[s], startMsg(r, s));
      return;
    }
    case 'resume': {
      if (!r) return send(c, { t: 'error', code: 'no_room', msg: 'Diese Partie gibt es nicht mehr.' });
      const slot = r.ids.indexOf(c.id); if (slot < 0) return send(c, { t: 'error', code: 'not_member', msg: 'Du gehörst nicht zu diesem Raum.' });
      const before = r.conn[slot]; r.conn[slot] = c; c.room = r.code; c.slot = slot; r.touched = Date.now(); if (process.env.WOK_DEBUG) log('resume', r.code, 'p' + slot, r.acts.length, m.light ? 'leicht' : 'voll');
      if (r.status === 'open') return send(c, { t: 'created', code: r.code });
      const wasHere = before === c; send(c, startMsg(r, slot, !!m.light)); if (!wasHere) send(peerOf(r, slot), { t: 'peer', online: true });
      send(c, { t: 'peer', online: !!(peerOf(r, slot) && !peerOf(r, slot).dead) });
      return;
    }
    case 'act': {
      if (!r || r.status !== 'running') return send(c, { t: 'error', msg: 'Keine laufende Partie.' });
      const slot = r.ids.indexOf(c.id); if (slot < 0) return send(c, { t: 'error', msg: 'Nicht in diesem Raum.' });
      const a = m.a; if (!a || typeof a.type !== 'string') return;
      if (m.n !== r.acts.length) { if (process.env.WOK_DEBUG) log('veraltet', r.code, 'p' + slot, 'n', m.n, 'server', r.acts.length, a.type); return send(c, { t: 'reject', n: m.n, error: 'veraltet', sync: r.acts.length }); } // doppelt oder zu früh → Client gleicht ab
      if (a.type === 'concede') a.p = slot; // Aufgeben nur für sich selbst
      else if (actorOf(r.state) !== slot) return send(c, { t: 'reject', n: m.n, error: 'Du bist nicht am Zug.' });
      if (a.p !== undefined && a.p !== slot) return send(c, { t: 'reject', n: m.n, error: 'Fremde Aktion.' });
      const res = W.apply(r.state, a);
      if (res.error) return send(c, { t: 'reject', n: m.n, error: res.error });
      r.state = res.state; r.acts.push(a); r.touched = Date.now();
      const out = { t: 'act', n: m.n, a, p: slot };
      for (const s of [0, 1]) send(r.conn[s], out);
      if (process.env.WOK_DEBUG) log('act', r.code, m.n, a.type, 'p' + slot, 'an', r.conn.map(x => x ? (x.dead ? 'tot' : 'ok') : '-').join('/'));
      if (r.state.result) { r.status = 'done'; r.ended = Date.now(); log('Raum', r.code, 'beendet:', r.state.result.reason); }
      return;
    }
    case 'img': {
      if (!r) return; const slot = r.ids.indexOf(c.id); if (slot < 0) return;
      const id = String(m.id || '').slice(0, 80), full = typeof m.full === 'string' && m.full.startsWith('data:image/') ? m.full : '', art = typeof m.art === 'string' && m.art.startsWith('data:image/') ? m.art : '';
      if (!id || (!full && !art) || full.length + art.length > 400000) return;
      r.imgs[id] = { full, art }; send(peerOf(r, slot), { t: 'img', id, full, art }); return;
    }
    case 'leave': {
      if (!r) return; const slot = r.ids.indexOf(c.id); if (slot < 0) return;
      if (r.status === 'open' && slot === 0) { rooms.delete(r.code); log('Raum', r.code, 'geschlossen'); }
      r.conn[slot] = null; send(peerOf(r, slot), { t: 'peer', online: false }); return;
    }
    case 'ping': return send(c, { t: 'pong' });
  }
}
function gone(c) {
  if (process.env.WOK_DEBUG && !c.dead) log('getrennt', c.room, 'p' + c.slot, c.id);
  c.dead = true; sockets.delete(c);
  const r = c.room && rooms.get(c.room); if (!r) return;
  if (r.conn[c.slot] === c) { r.conn[c.slot] = null; send(peerOf(r, c.slot), { t: 'peer', online: false }); }
}
setInterval(() => { const now = Date.now(); for (const [k, r] of rooms) { const idle = now - r.touched; if ((r.status === 'open' && idle > OPEN_TTL) || idle > ROOM_TTL) { rooms.delete(k); log('Raum', k, 'aufgeräumt'); } } }, 60000).unref();

/* ---------- WebSocket (RFC 6455, nur was gebraucht wird) ---------- */
function wsSend(sock, text) {
  const data = Buffer.from(text), len = data.length; let head;
  if (len < 126) head = Buffer.from([0x81, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  sock.write(Buffer.concat([head, data]));
}
function upgrade(req, sock) {
  if (!/^\/ws\b/.test(req.url)) { sock.destroy(); return; }
  const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true); sock.setKeepAlive(true, 20000);
  const c = { sock, id: null, room: null, slot: -1, dead: false, alive: Date.now() }; sockets.add(c);
  let buf = Buffer.alloc(0), parts = [];
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 128, op = buf[0] & 15; let len = buf[1] & 127, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > MAX_MSG) { sock.destroy(); return; }
      const masked = buf[1] & 128, mk = masked ? buf.subarray(off, off + 4) : null; if (masked) off += 4;
      if (buf.length < off + len) return;
      const pl = Buffer.from(buf.subarray(off, off + len)); if (mk) for (let i = 0; i < pl.length; i++) pl[i] ^= mk[i & 3];
      buf = buf.subarray(off + len); c.alive = Date.now();
      if (op === 8) { sock.end(); return; }
      if (op === 9) { const h = Buffer.from([0x8A, pl.length]); sock.write(Buffer.concat([h, pl])); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) { parts.push(pl); if (!fin) continue; const txt = Buffer.concat(parts).toString('utf8'); parts = []; let m = null; try { m = JSON.parse(txt); } catch (e) { } try { handle(c, m); } catch (e) { log('Fehler', e && e.stack || e); send(c, { t: 'error', msg: 'Serverfehler: ' + (e && e.message) }); } }
    }
  });
  sock.on('close', () => gone(c)); sock.on('error', () => gone(c)); sock.on('end', () => gone(c));
}
// Tote Verbindungen erkennen (Ping alle 25 s)
setInterval(() => { for (const c of sockets) { if (Date.now() - c.alive > 70000) { try { c.sock.destroy(); } catch (e) { } gone(c); continue; } try { c.sock.write(Buffer.from([0x89, 0])); } catch (e) { } } }, 25000).unref();

/* ---------- HTTP: Web-Version ausliefern ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) { res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', 'x-wok-key, x-wok-name, content-type'); res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS'); if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; } }
  if (u.pathname === '/api/karten' && req.method === 'GET') {
    let meta = null; try { meta = JSON.parse(fs.readFileSync(PACK_META, 'utf8')); } catch (e) { }
    if (u.searchParams.get('info') !== null || !meta) { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }); res.end(JSON.stringify(meta || { none: true })); return; }
    res.writeHead(200, { 'content-type': 'application/zip', 'cache-control': 'no-cache' }); fs.createReadStream(PACK).pipe(res); return;
  }
  if (u.pathname === '/api/karten' && req.method === 'POST') {
    if (!ADMIN_KEY || req.headers['x-wok-key'] !== ADMIN_KEY) { res.writeHead(403, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: ADMIN_KEY ? 'Falscher Schlüssel.' : 'Auf dem Server ist kein WOK_ADMIN_KEY gesetzt.' })); return; }
    const chunks = []; let size = 0;
    req.on('data', d => { size += d.length; if (size > 80 * 1024 * 1024) { req.destroy(); return; } chunks.push(d); });
    req.on('end', () => { try { const buf = Buffer.concat(chunks); if (buf.readUInt32LE(0) !== 0x04034b50) throw new Error('Keine ZIP-Datei.'); fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(PACK, buf); const meta = { version: Date.now(), size: buf.length, name: (() => { try { return decodeURIComponent(String(req.headers['x-wok-name'] || 'Offizielle Karten')).slice(0, 80); } catch (e) { return 'Offizielle Karten'; } })() }; fs.writeFileSync(PACK_META, JSON.stringify(meta)); log('Offizielle Karten veröffentlicht', meta); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(meta)); } catch (e) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: e.message })); } });
    return;
  }
  if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, version: VERSION, rooms: rooms.size, players: sockets.size })); return; }
  let p = decodeURIComponent(u.pathname); if (p === '/' || p === '') p = '/index.html';
  const f = path.join(WEB, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(WEB)) { res.writeHead(403); res.end(); return; }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Nicht gefunden'); return; }
    const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    const head = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': /\.html$/.test(f) ? 'no-cache' : 'public, max-age=86400' };
    if (range) { const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : st.size - 1; if (a >= st.size) { res.writeHead(416, { 'content-range': 'bytes */' + st.size }); res.end(); return; } res.writeHead(206, Object.assign(head, { 'content-range': 'bytes ' + a + '-' + b + '/' + st.size, 'content-length': b - a + 1 })); fs.createReadStream(f, { start: a, end: b }).pipe(res); return; }
    res.writeHead(200, Object.assign(head, { 'content-length': st.size })); fs.createReadStream(f).pipe(res);
  });
});
srv.on('upgrade', upgrade);
srv.listen(PORT, () => log('War of Kings Server ' + VERSION + ' auf Port ' + PORT + ' – Web-Version aus ' + WEB));
module.exports = { srv, rooms };
