// Mini-MQTT-Broker über WebSocket für Tests (CONNECT, SUBSCRIBE mit #, PUBLISH mit retain, PING). Aufruf: node test/mqbroker.js 8899
const http = require('http'), crypto = require('crypto');
const port = +process.argv[2] || 8899, retained = new Map(), clients = new Set();
const vlen = n => { const o = []; do { let b = n % 128; n = Math.floor(n / 128); if (n > 0) b |= 128; o.push(b); } while (n > 0); return Buffer.from(o); };
const pkt = (h, body) => Buffer.concat([Buffer.from([h]), vlen(body.length), body]);
const match = (f, t) => { if (f.endsWith('#')) return t.startsWith(f.slice(0, -1)); return f === t; };
function wsSend(sock, data) { const len = data.length; let head; if (len < 126) head = Buffer.from([0x82, len]); else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x82; head[1] = 126; head.writeUInt16BE(len, 2); } else { head = Buffer.alloc(10); head[0] = 0x82; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); } try { sock.write(Buffer.concat([head, data])); } catch (e) { } }
const srv = http.createServer((q, s) => { s.end('mqtt test'); });
srv.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'], acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\nSec-WebSocket-Protocol: mqtt\r\n\r\n');
  const c = { sock, subs: [] }; clients.add(c); let wbuf = Buffer.alloc(0), mbuf = Buffer.alloc(0);
  sock.on('data', d => {
    wbuf = Buffer.concat([wbuf, d]);
    for (;;) { if (wbuf.length < 2) break; const op = wbuf[0] & 15; let len = wbuf[1] & 127, off = 2; if (len === 126) { if (wbuf.length < 4) break; len = wbuf.readUInt16BE(2); off = 4; } else if (len === 127) { if (wbuf.length < 10) break; len = Number(wbuf.readBigUInt64BE(2)); off = 10; } const masked = wbuf[1] & 128; const mk = masked ? wbuf.slice(off, off + 4) : null; if (masked) off += 4; if (wbuf.length < off + len) break; let pl = Buffer.from(wbuf.slice(off, off + len)); if (mk) for (let i = 0; i < pl.length; i++) pl[i] ^= mk[i & 3]; wbuf = wbuf.slice(off + len); if (op === 8) { sock.end(); return; } if (op === 2 || op === 0) { mbuf = Buffer.concat([mbuf, pl]); mq(); } }
  });
  sock.on('close', () => clients.delete(c)); sock.on('error', () => clients.delete(c));
  function mq() {
    for (;;) { if (mbuf.length < 2) return; let mul = 1, len = 0, i = 1, b; do { if (i >= mbuf.length) return; b = mbuf[i++]; len += (b & 127) * mul; mul *= 128; } while (b & 128); if (mbuf.length < i + len) return; const h = mbuf[0], body = mbuf.slice(i, i + len); mbuf = mbuf.slice(i + len); const t = h >> 4;
      if (t === 1) wsSend(sock, pkt(0x20, Buffer.from([0, 0])));
      else if (t === 8) { const id = body.slice(0, 2); let o = 2; const qs = []; while (o < body.length) { const l = body.readUInt16BE(o); const f = body.slice(o + 2, o + 2 + l).toString(); o += 2 + l + 1; c.subs.push(f); qs.push(0); for (const [tp, m] of retained) if (match(f, tp)) wsSend(sock, m); } wsSend(sock, pkt(0x90, Buffer.concat([id, Buffer.from(qs)]))); }
      else if (t === 3) { const tl = body.readUInt16BE(0), tp = body.slice(2, 2 + tl).toString(), pay = body.slice(2 + tl), m = pkt(0x30, Buffer.concat([body.slice(0, 2 + tl), pay])); if (h & 1) { if (pay.length) retained.set(tp, m); else retained.delete(tp); } for (const x of clients) if (x.subs.some(f => match(f, tp))) wsSend(x.sock, m); }
      else if (t === 12) wsSend(sock, Buffer.from([0xD0, 0]));
    }
  }
});
srv.listen(port, () => console.log('MQTT-Testbroker auf', port));
