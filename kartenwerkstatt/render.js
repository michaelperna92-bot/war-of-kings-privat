/* War of Kings Kartenwerkstatt – Kartenrenderer
 * Alle Positionen in Vorlagen-Koordinaten (Standard 1024 × 1536). Vorschau und Export nutzen denselben Code.
 */
window.WOK_RENDER = (function () {
  'use strict';
  const D = window.WOK_DATA;

  /* ---------- Standard-Layout (aus Vorlage und Akuma/Raiden vermessen) ---------- */
  function defaultLayout() {
    const row = (dy) => ({
      crest: { x: 90, y: 1077 + dy, w: 116, h: 86 },
      text: { x: 226, y: 1074 + dy, w: 572, h: 96 },
      ct: { x: 810, y: 1084 + dy, w: 128, h: 74 }
    });
    return {
      version: 1, W: 1024, H: 1536,
      font: 'EB Garamond',
      window: { x: 42, y: 142, w: 946, h: 656 },
      mask: {
        lum: 60, sat: 16, seed: [512, 445], rect: [40, 140, 990, 800], rects: [[325, 765, 705, 940]],
        poly1: [[49, 206], [161, 206], [161, 490], [105, 527], [49, 490]],
        poly2: [[49, 206], [161, 206], [161, 627], [105, 664], [49, 627]],
        poly3: [[49, 206], [161, 206], [161, 721], [105, 758], [49, 721]]
      },
      energy: { x: 115, y: 112, size: 108 },
      name: { x: 520, y: 98, w: 570, size: 62 },
      element: { x: 912, y: 94, r: 60 },
      elementLabel: { x: 912, y: 186, w: 132, size: 27 },
      race: { x: 105, y: 263, r: 46 }, raceLabel: { x: 105, y: 324, w: 100, size: 19 },
      class1: { x: 105, y: 408, r: 46 }, class1Label: { x: 105, y: 466, w: 100, size: 19 },
      // Variante mit zwei Klassen (dritte Kammer in der linken Leiste)
      class1b: { x: 105, y: 402, r: 43 }, class1bLabel: { x: 105, y: 455, w: 100, size: 19 },
      class2: { x: 105, y: 540, r: 43 }, class2Label: { x: 105, y: 593, w: 100, size: 19 },
      // Variante mit vier Kammern (2 Rassen + 2 Klassen), Leiste automatisch verlängert
      slot4a: { x: 105, y: 262, r: 40 }, slot4aLabel: { x: 105, y: 317, w: 100, size: 18 },
      slot4b: { x: 105, y: 392, r: 40 }, slot4bLabel: { x: 105, y: 447, w: 100, size: 18 },
      slot4c: { x: 105, y: 522, r: 40 }, slot4cLabel: { x: 105, y: 577, w: 100, size: 18 },
      slot4d: { x: 105, y: 652, r: 40 }, slot4dLabel: { x: 105, y: 707, w: 100, size: 18 },
      atk: { x: 233, y: 850, size: 88 }, atkLabel: { x: 233, y: 905, size: 33 },
      def: { x: 797, y: 850, size: 88 }, defLabel: { x: 797, y: 905, size: 33 },
      attackGrid: { x: 345, y: 807, w: 152, h: 108, titleY: 789, titleSize: 19 },
      moveGrid: { x: 527, y: 807, w: 154, h: 108, titleY: 789, titleSize: 19 },
      banner: { x: 512, y: 983, w: 780, size: 30 },
      giftsTitle: { x: 112, y: 1050, size: 30 },
      gifts: [row(0), row(101), row(205)],
      rarity: { x: 512, y: 1405, size: 70 },
      rarityLabel: { x: 512, y: 1454, w: 270, size: 34 },
      protect: [[58, 1036, 966, 1378], [325, 770, 705, 935]],
      gems: { energy: { x: 114, y: 110, r: 70 }, atk: { x: 232, y: 852, r: 70 }, def: { x: 797, y: 852, r: 70 }, element: { x: 912, y: 93, r: 58 }, elementLabel: { x: 846, y: 170, w: 134, h: 30 } }
    };
  }

  /* ---------- Bilder laden ---------- */
  const imgCache = new Map();
  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((res) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
    imgCache.set(src, p);
    return p;
  }

  /* ---------- Bildfenster freistellen (Flutfüllung über dunklen, ungesättigten Pixeln) ---------- */
  function computeFrame(templateImg, mp, variant) {
    const W = templateImg.naturalWidth || templateImg.width, H = templateImg.naturalHeight || templateImg.height;
    const sx = W / 1024, sy = H / 1536;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(templateImg, 0, 0, W, H);
    const id = g.getImageData(0, 0, W, H), px = id.data, N = W * H;
    const ok = new Uint8Array(N);
    const [rx0, ry0, rx1, ry1] = mp.rect.map((v, i) => Math.round(v * (i % 2 ? sy : sx)));
    for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
      const i = y * W + x, r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2];
      const lum = (r * 299 + gg * 587 + b * 114) / 1000, sat = Math.max(r, gg, b) - Math.min(r, gg, b);
      if (lum < mp.lum && sat < mp.sat) ok[i] = 1;
    }
    for (const [a, b2, cc, d] of mp.rects || []) {
      for (let y = Math.round(b2 * sy); y < Math.round(d * sy); y++) for (let x = Math.round(a * sx); x < Math.round(cc * sx); x++) ok[y * W + x] = 0;
    }
    const poly = variant === 3 ? (mp.poly3 || [[49, 206], [161, 206], [161, 721], [105, 758], [49, 721]]) : variant === 2 ? mp.poly2 : mp.poly1;
    if (poly) {
      const pc = document.createElement('canvas'); pc.width = W; pc.height = H;
      const pg = pc.getContext('2d'); pg.fillStyle = '#fff'; pg.beginPath();
      poly.forEach(([x, y], i) => i ? pg.lineTo(x * sx, y * sy) : pg.moveTo(x * sx, y * sy)); pg.closePath(); pg.fill();
      const pd = pg.getImageData(0, 0, W, H).data;
      for (let i = 0; i < N; i++) if (pd[i * 4 + 3] > 0) ok[i] = 0;
    }
    // Flutfüllung ab Startpunkt
    const m = new Uint8Array(N), stack = new Int32Array(N);
    let sp = 0; const s0 = Math.round(mp.seed[1] * sy) * W + Math.round(mp.seed[0] * sx);
    if (ok[s0]) { stack[sp++] = s0; m[s0] = 1; }
    while (sp) {
      const i = stack[--sp], x = i % W;
      if (x > 0 && ok[i - 1] && !m[i - 1]) { m[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < W - 1 && ok[i + 1] && !m[i + 1]) { m[i + 1] = 1; stack[sp++] = i + 1; }
      if (i >= W && ok[i - W] && !m[i - W]) { m[i - W] = 1; stack[sp++] = i - W; }
      if (i < N - W && ok[i + W] && !m[i + W]) { m[i + W] = 1; stack[sp++] = i + W; }
    }
    // Schließen (5er Max, 5er Min), leicht verkleinern (3er Min)
    let a = morph(m, W, H, 2, true); a = morph(a, W, H, 2, false); a = morph(a, W, H, 1, false);
    // Alpha setzen: Fenster durchsichtig, weiche Kante
    const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
    const mg = mc.getContext('2d'); const md = mg.createImageData(W, H);
    for (let i = 0; i < N; i++) { md.data[i * 4 + 3] = a[i] ? 255 : 0; }
    mg.putImageData(md, 0, 0);
    const bc = document.createElement('canvas'); bc.width = W; bc.height = H;
    const bg = bc.getContext('2d'); bg.filter = 'blur(' + (1.2 * sx).toFixed(2) + 'px)'; bg.drawImage(mc, 0, 0);
    const bd = bg.getImageData(0, 0, W, H).data;
    for (let i = 0; i < N; i++) px[i * 4 + 3] = 255 - bd[i * 4 + 3];
    g.putImageData(id, 0, 0);
    let area = 0; for (let i = 0; i < N; i++) if (a[i]) area++;
    return { canvas: c, area: area / N };
  }
  function morph(src, W, H, r, isMax) {
    const tmp = new Uint8Array(src.length), out = new Uint8Array(src.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = isMax ? 0 : 1;
      for (let k = -r; k <= r; k++) { const xx = x + k; const s = xx < 0 || xx >= W ? (isMax ? 0 : 1) : src[y * W + xx]; if (isMax ? s : !s) { v = isMax ? 1 : 0; break; } }
      tmp[y * W + x] = v;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = isMax ? 0 : 1;
      for (let k = -r; k <= r; k++) { const yy = y + k; const s = yy < 0 || yy >= H ? (isMax ? 0 : 1) : tmp[yy * W + x]; if (isMax ? s : !s) { v = isMax ? 1 : 0; break; } }
      out[y * W + x] = v;
    }
    return out;
  }

  /* ---------- Text ---------- */
  /* ---------- Schriften ---------- */
  // w: verfügbare Schnitte, k: Größenausgleich (Schriften mit kleinem Mittelband etwas größer)
  const FONTS = {
    cinzel: { name: 'Cinzel', family: 'Cinzel', w: [500, 600, 700, 800, 900], k: 0.9, kind: 'Versalien' },
    cinzeldeco: { name: 'Cinzel Decorative', family: 'Cinzel Decorative', w: [400, 700, 900], k: 0.88, kind: 'Versalien, verziert' },
    cormorant: { name: 'Cormorant Garamond', family: 'Cormorant Garamond', w: [500, 600, 700], k: 1.12, kind: 'Antiqua' },
    cormorantsc: { name: 'Cormorant SC', family: 'Cormorant SC', w: [500, 600, 700], k: 1.08, kind: 'Kapitälchen' },
    garamond: { name: 'EB Garamond', family: 'EB Garamond', w: [500, 600, 700, 800], k: 1, kind: 'Antiqua' },
    marcellus: { name: 'Marcellus', family: 'Marcellus', w: [400], k: 0.97, kind: 'Römisch' },
    marcellussc: { name: 'Marcellus SC', family: 'Marcellus SC', w: [400], k: 0.95, kind: 'Römisch, Kapitälchen' },
    spectral: { name: 'Spectral', family: 'Spectral', w: [400, 500, 600, 700], k: 0.94, kind: 'Buchschrift' },
    spectralsc: { name: 'Spectral SC', family: 'Spectral SC', w: [500, 600, 700], k: 0.92, kind: 'Kapitälchen' },
    fell: { name: 'IM Fell English', family: 'IM Fell English', w: [400], k: 1.02, kind: 'Alter Buchdruck' },
    fellsc: { name: 'IM Fell English SC', family: 'IM Fell English SC', w: [400], k: 1, kind: 'Alter Buchdruck' },
    alegreya: { name: 'Alegreya', family: 'Alegreya', w: [500, 700, 800], k: 1, kind: 'Kalligrafisch' },
    alegreyasc: { name: 'Alegreya SC', family: 'Alegreya SC', w: [500, 700, 800], k: 0.98, kind: 'Kapitälchen' },
    playfairsc: { name: 'Playfair Display SC', family: 'Playfair Display SC', w: [700, 900], k: 0.9, kind: 'Kontrastreich' },
    almendrasc: { name: 'Almendra SC', family: 'Almendra SC', w: [400], k: 1, kind: 'Mittelalterlich' },
    grenze: { name: 'Grenze Gotisch', family: 'Grenze Gotisch', w: [500, 600, 700, 800], k: 1.02, kind: 'Gotisch, gut lesbar' },
    fraktur: { name: 'UnifrakturMaguntia', family: 'UnifrakturMaguntia', w: [400], k: 1.02, kind: 'Fraktur' },
    pirata: { name: 'Pirata One', family: 'Pirata One', w: [400], k: 1.05, kind: 'Gotisch, schmal' },
    uncial: { name: 'Uncial Antiqua', family: 'Uncial Antiqua', w: [400], k: 0.86, kind: 'Keltisch' },
    forum: { name: 'Forum', family: 'Forum', w: [400], k: 1.02, kind: 'Antik, schlank' }
  };
  // Schriftsätze: name / num (Zahlen) / title (Überschriften, Beschriftungen) / text (Regeltext)
  const FONT_SETS = {
    original: { name: 'Original', fonts: { name: 'garamond', num: 'garamond', title: 'garamond', text: 'garamond' } },
    klassisch: { name: 'Klassisch', fonts: { name: 'cinzel', num: 'cinzel', title: 'cinzel', text: 'garamond' } },
    koeniglich: { name: 'Königlich', fonts: { name: 'cinzeldeco', num: 'cinzel', title: 'cinzel', text: 'cormorant' } },
    antiqua: { name: 'Antiqua', fonts: { name: 'cormorantsc', num: 'cormorantsc', title: 'cormorantsc', text: 'cormorant' } },
    roemisch: { name: 'Römisch', fonts: { name: 'marcellussc', num: 'marcellus', title: 'marcellussc', text: 'spectral' } },
    chronik: { name: 'Alte Chronik', fonts: { name: 'fellsc', num: 'cinzel', title: 'fellsc', text: 'fell' } },
    gotisch: { name: 'Gotisch', fonts: { name: 'grenze', num: 'cinzel', title: 'alegreyasc', text: 'alegreya' } },
    fraktur: { name: 'Fraktur', fonts: { name: 'fraktur', num: 'cinzel', title: 'garamond', text: 'garamond' } },
    elegant: { name: 'Elegant', fonts: { name: 'playfairsc', num: 'playfairsc', title: 'spectralsc', text: 'spectral' } }
  };
  function resolveFonts(style) {
    const st = style || {}, set = (FONT_SETS[st.fontSet] || FONT_SETS.original).fonts;
    const out = {};
    for (const r of ['name', 'num', 'title', 'text']) out[r] = FONTS[(st.fonts && st.fonts[r]) || set[r]] || FONTS.garamond;
    return out;
  }
  function nearestW(f, w) { let b = f.w[0]; for (const x of f.w) if (Math.abs(x - w) < Math.abs(b - w)) b = x; return b; }
  let ACTIVE = null; // während draw() gesetzt
  function fontStr(L, weight, size, role) {
    const f = (ACTIVE || resolveFonts(null))[role || 'title'];
    return nearestW(f, weight) + ' ' + (size * f.k).toFixed(2) + 'px "' + f.family + '", "EB Garamond", Georgia, serif';
  }
  function fontsNeeded(style) { const F = resolveFonts(style); return Object.values(F).map(f => f.w.map(w => w + ' 40px "' + f.family + '"')).flat(); }
  function fitSize(ctx, L, text, weight, size, maxW, minSize, role) {
    let s = size;
    ctx.font = fontStr(L, weight, s, role);
    while (s > minSize && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = fontStr(L, weight, s, role); }
    return { size: s, overflow: ctx.measureText(text).width > maxW };
  }
  function strokeText(ctx, text, x, y, fill, stroke, lw) {
    if (stroke) { ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(text, x, y); }
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean), lines = []; let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ---------- Pfeile ---------- */
  const DIRS = { n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1] };
  function arrow(ctx, x0, y0, dx, dy, len, color, scale) {
    const l = Math.hypot(dx, dy); const ux = dx / l, uy = dy / l;
    const start = 10 * scale, head = 19 * scale, hw = 12.5 * scale, sw = 5.2 * scale;
    const x1 = x0 + ux * len, y1 = y0 + uy * len;
    const bx = x1 - ux * head, by = y1 - uy * head;
    const px = -uy, py = ux;
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(x0 + ux * start + px * sw, y0 + uy * start + py * sw);
      ctx.lineTo(bx + px * sw, by + py * sw); ctx.lineTo(bx + px * hw, by + py * hw);
      ctx.lineTo(x1, y1);
      ctx.lineTo(bx - px * hw, by - py * hw); ctx.lineTo(bx - px * sw, by - py * sw);
      ctx.lineTo(x0 + ux * start - px * sw, y0 + uy * start - py * sw); ctx.closePath();
    };
    const rgb = hex2rgb(color), mix = (t, k) => 'rgb(' + rgb.map(v => Math.round(t > 0 ? v + (255 - v) * t : v * (1 + t))).join(',') + ')';
    ctx.save();
    // weicher Schein in der Pfeilfarbe, dann feine dunkle Kante, helle Innenkante, Edelstein-Verlauf quer zum Pfeil
    ctx.shadowColor = 'rgba(' + rgb.join(',') + ',.75)'; ctx.shadowBlur = 9 * scale;
    shape(); ctx.lineJoin = 'round'; ctx.lineWidth = 3.6 * scale; ctx.strokeStyle = mix(-0.72); ctx.stroke();
    ctx.shadowBlur = 0;
    const gx = ctx.createLinearGradient(x0 + px * hw, y0 + py * hw, x0 - px * hw, y0 - py * hw);
    gx.addColorStop(0, mix(0.55)); gx.addColorStop(0.42, mix(0.12)); gx.addColorStop(0.58, color); gx.addColorStop(1, mix(-0.45));
    shape(); ctx.fillStyle = gx; ctx.fill();
    shape(); ctx.lineWidth = 1.2 * scale; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
    ctx.restore();
  }
  function darken(h) { const c = hex2rgb(h); return 'rgb(' + c.map(v => Math.round(v * 0.55)).join(',') + ')'; }
  function hex2rgb(h) { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  // parts (optional, Set): 'title', 'arrows', 'dot', 'number' – einzelne Teile für den Asset-Export
  // Königsrahmen: Das Doppelfeld (Angriff | Laufen) wird zu einem einzigen, mittig zentrierten Angriffsfeld.
  // Innenfläche wird mit der Hintergrundschattierung des Rahmens übermalt (Trennsteg und beide Raster verschwinden), dann ein Raster in der Mitte.
  const KF = new WeakMap();
  function kingFrame(base, L) {
    if (KF.has(base)) return KF.get(base);
    const W = base.width, H = base.height, sx = W / L.W, sy = H / L.H;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(base, 0, 0);
    const A = L.attackGrid, M = L.moveGrid, box = kingBox(L);
    const x0 = Math.round((A.x - 9) * sx), x1 = Math.round((M.x + M.w + 9) * sx), y0 = Math.round((A.titleY - 13) * sy), y1 = Math.round((A.y + A.h + 9) * sy);
    // Schattierung aus einer rasterfreien Spalte (zwischen Rand und linkem Raster) übernehmen und über die Fläche ziehen
    const colX = Math.round((A.x - 5) * sx), col = g.getImageData(colX, y0, 1, y1 - y0);
    const tmp = document.createElement('canvas'); tmp.width = 1; tmp.height = y1 - y0; tmp.getContext('2d').putImageData(col, 0, 0);
    g.drawImage(tmp, 0, 0, 1, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    // ein mittiges Raster im Stil des Originals (5 × 4 Zellen)
    g.save(); g.scale(sx, sy); g.strokeStyle = 'rgba(190,200,215,.30)'; g.lineWidth = 1.2;
    for (let i = 0; i <= 5; i++) { const x = box.x + box.w * i / 5; g.beginPath(); g.moveTo(x, box.y); g.lineTo(x, box.y + box.h); g.stroke(); }
    for (let j = 0; j <= 4; j++) { const y = box.y + box.h * j / 4; g.beginPath(); g.moveTo(box.x, y); g.lineTo(box.x + box.w, y); g.stroke(); }
    g.restore();
    KF.set(base, c); return c;
  }
  // mittiges Angriffsfeld der Könige: gleiche Größe wie das Angriffsfeld der Helden, zwischen beiden Rastern zentriert
  function kingBox(L) { const A = L.attackGrid, M = L.moveGrid, cx = (A.x + M.x + M.w) / 2; return { x: Math.round(cx - A.w / 2), y: A.y, w: A.w, h: A.h, titleY: A.titleY, titleSize: A.titleSize }; }
  // Königskrone statt Energiekosten (eigene Vektorzeichnung)
  function drawCrown(ctx, x, y, size) {
    const w = size * 1.05, h = size * 0.78, l = x - w / 2, t = y - h / 2;
    ctx.save();
    const path = () => { ctx.beginPath(); ctx.moveTo(l, t + h); ctx.lineTo(l + w * 0.02, t + h * 0.28); ctx.lineTo(l + w * 0.27, t + h * 0.58); ctx.lineTo(l + w * 0.5, t); ctx.lineTo(l + w * 0.73, t + h * 0.58); ctx.lineTo(l + w * 0.98, t + h * 0.28); ctx.lineTo(l + w, t + h); ctx.closePath(); };
    ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = size * 0.12; ctx.shadowOffsetY = size * 0.04;
    const g = ctx.createLinearGradient(0, t, 0, t + h); g.addColorStop(0, '#fff4c8'); g.addColorStop(0.35, '#f3cf6a'); g.addColorStop(0.7, '#c9932f'); g.addColorStop(1, '#7a5216');
    path(); ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = size * 0.035; ctx.strokeStyle = '#4a300a'; ctx.lineJoin = 'round'; path(); ctx.stroke();
    // Band und Edelsteine
    const bandY = t + h * 0.78, bandH = h * 0.2;
    const bg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH); bg.addColorStop(0, '#ffe9a6'); bg.addColorStop(1, '#a9741f');
    ctx.fillStyle = bg; ctx.fillRect(l + w * 0.01, bandY, w * 0.98, bandH); ctx.strokeRect(l + w * 0.01, bandY, w * 0.98, bandH);
    const gem = (gx, gy, r, c1, c2) => { const rg = ctx.createRadialGradient(gx - r * 0.3, gy - r * 0.3, r * 0.1, gx, gy, r); rg.addColorStop(0, c1); rg.addColorStop(1, c2); ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.fillStyle = rg; ctx.fill(); ctx.lineWidth = size * 0.02; ctx.stroke(); };
    gem(x, bandY + bandH / 2, bandH * 0.36, '#ffb3b8', '#b0101e'); gem(x - w * 0.3, bandY + bandH / 2, bandH * 0.28, '#b8d8ff', '#1d4fb0'); gem(x + w * 0.3, bandY + bandH / 2, bandH * 0.28, '#b8d8ff', '#1d4fb0');
    for (const [px, py] of [[l + w * 0.02, t + h * 0.28], [l + w * 0.5, t], [l + w * 0.98, t + h * 0.28]]) gem(px, py, size * 0.06, '#fff6d6', '#d9a634');
    ctx.restore();
  }
  // Könige können nicht laufen: Laufraster bleibt leer mit Hinweis
  function drawNoMove(ctx, L, G) {
    const cx = G.x + G.w / 2, cy = G.y + G.h / 2;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = fontStr(L, 600, G.titleSize); strokeText(ctx, 'Laufrichtung', cx, G.titleY, '#f1ead8', 'rgba(0,0,0,.75)', 3);
    ctx.font = fontStr(L, 700, 21); strokeText(ctx, 'Kann nicht', cx, cy - 12, '#f1ead8', 'rgba(0,0,0,.8)', 4); strokeText(ctx, 'laufen', cx, cy + 14, '#f1ead8', 'rgba(0,0,0,.8)', 4);
    ctx.restore();
  }
  function drawGrid(ctx, L, G, spec, title, color, warn, parts) {
    const cx = G.x + G.w / 2, cy = G.y + G.h / 2, pt = k => !parts || parts.has(k);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = fontStr(L, 600, G.titleSize);
    if (pt('title')) strokeText(ctx, title, cx, G.titleY, '#f1ead8', 'rgba(0,0,0,.75)', 3);
    const cellX = G.w / 5, cellY = G.h / 4;
    for (const [k, [dx, dy]] of Object.entries(DIRS)) {
      if (!pt('arrows') || !spec || !spec.dirs || !spec.dirs[k]) continue;
      const n = Math.max(1, Math.min(3, spec.dirs[k] === true ? (spec.len || 1) : spec.dirs[k]));
      // Länge: je Feld eine Zellbreite, im Raster begrenzt
      const step = Math.hypot(dx * cellX, dy * cellY) * 0.95;
      const maxLen = Math.min(dx ? (G.w / 2 - 3) / Math.abs(dx) * Math.hypot(dx, dy) : 1e9, dy ? (G.h / 2 - 3) / Math.abs(dy) * Math.hypot(dx, dy) : 1e9);
      const len = Math.min(maxLen, step * n + 12);
      if (step * n + 12 > maxLen + 0.5 && warn) warn('arrowClip');
      arrow(ctx, cx, cy, dx, dy, len, color, 1);
    }
    if (pt('dot')) { ctx.beginPath(); ctx.arc(cx, cy, 7.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 4; ctx.fill(); }
    if (pt('number') && spec && spec.showNumber && spec.number) {
      const nx = G.x + G.w - 15, ny = G.y + 15;
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(nx, ny, 13, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#f5f0e2'; ctx.stroke();
      if (!parts || parts.has('digit')) { ctx.font = fontStr(L, 700, 19, 'num'); ctx.fillStyle = '#fff'; ctx.fillText(String(spec.number), nx, ny + 1); }
    }
    ctx.restore();
  }

  /* ---------- Zwei Elemente: Kreis diagonal geteilt ---------- */
  function drawSplitElement(ctx, L, res, e1, e2, warn) {
    const { x, y, r } = L.element, a = -Math.PI / 4; // Trennlinie von unten links nach oben rechts
    const halves = [[e1, a + Math.PI, a + 2 * Math.PI, -1], [e2, a, a + Math.PI, 1]];
    for (const [e, s0, s1, side] of halves) {
      const im = res.crests[e.crest];
      if (!im) { warn('missingCrest', e.name); continue; }
      ctx.save(); ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, s0, s1); ctx.closePath(); ctx.clip();
      // Wappen leicht verkleinert und in die eigene Hälfte verschoben, damit das Motiv sichtbar bleibt
      const off = r * 0.3;
      drawCrest(ctx, im, x + side * off * Math.SQRT1_2, y + side * off * Math.SQRT1_2, r * 2 / 0.84 * 0.82);
      ctx.restore();
    }
    // Metallische Trennlinie
    const dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
    g.addColorStop(0, '#6b5428'); g.addColorStop(0.35, '#f6e2a6'); g.addColorStop(0.5, '#fff7dc'); g.addColorStop(0.65, '#e2c27a'); g.addColorStop(1, '#5d4520');
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 7.5; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
    ctx.strokeStyle = g; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
    ctx.restore();
  }

  /* ---------- Karte zeichnen ---------- */
  // res = { frame1, frame2, art, crests: {key: img}, giftCrests }
  function draw(ctx, card, L, res, opt) {
    opt = opt || {};
    const issues = [];
    const warn = (code, info) => issues.push({ code, info });
    const S = opt.scale || 1;
    // opt.layers (Set): nur diese Ebenen zeichnen, auf transparentem Grund (für den Engine-Export)
    const on = k => !opt.layers || opt.layers.has(k);
    ACTIVE = resolveFonts(card.style);
    ctx.save();
    ctx.scale(S, S);
    ctx.clearRect(0, 0, L.W, L.H);
    if (!opt.layers) { ctx.fillStyle = '#07090b'; ctx.fillRect(0, 0, L.W, L.H); }
    if (card.type === 'spell' || card.type === 'curse') { drawSpell(ctx, card, L, res, opt, warn, on, S); ctx.restore(); ACTIVE = null; return issues; }
    // Kammern links: Rassen zuerst, dann Klassen. 2 = Grundvorlage, 3 = verlängert, 4 = doppelt verlängert
    const race = D.RACES.find(r => r.id === card.race);
    const race2 = card.race2 && card.race2 !== card.race ? D.RACES.find(r => r.id === card.race2) : null;
    const c1 = D.CLASSES.find(c => c.id === (card.classes || [])[0]);
    const c2 = D.CLASSES.find(c => c.id === (card.classes || [])[1]);
    const slotItems = [race, race2, c1, c2].filter(Boolean);
    const nSlots = Math.max(2, slotItems.length);
    // 1. Illustration im Fenster
    const Wn = L.window;
    if (!on('art')) { /* Ebene ausgelassen */ }
    else if (res.art) {
      const a = card.art || {};
      const im = res.art, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      const fit = coverFit(iw, ih, Wn);
      const sc = a.scale || fit.scale, x = a.x !== undefined ? a.x : fit.x, y = a.y !== undefined ? a.y : fit.y;
      const dw = iw * sc, dh = ih * sc;
      ctx.save(); ctx.beginPath(); ctx.rect(Wn.x, Wn.y, Wn.w, Wn.h); ctx.clip();
      const gap = x > Wn.x + 0.5 || y > Wn.y + 0.5 || x + dw < Wn.x + Wn.w - 0.5 || y + dh < Wn.y + Wn.h - 0.5;
      if (gap) {
        if (a.fill === 'color') { ctx.fillStyle = a.fillColor || '#0b0f16'; ctx.fillRect(Wn.x, Wn.y, Wn.w, Wn.h); }
        else { // weichgezeichnete, abgedunkelte Version desselben Bildes als Hintergrund
          const tiny = blurSource(im);
          ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(tiny, fit.x, fit.y, iw * fit.scale, ih * fit.scale);
          ctx.fillStyle = 'rgba(4,6,10,.42)'; ctx.fillRect(Wn.x, Wn.y, Wn.w, Wn.h);
        }
      }
      drawImageHQ(ctx, im, x, y, dw, dh, S);
      ctx.restore();
      if (gap && a.fill === 'none') warn('artGap');
    } else {
      warn('noArt');
      if (opt.placeholder !== false) {
        ctx.save(); ctx.fillStyle = 'rgba(214,180,106,.06)'; ctx.fillRect(Wn.x, Wn.y, Wn.w, Wn.h);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontStr(L, 600, 34); ctx.fillStyle = 'rgba(214,180,106,.55)';
        ctx.fillText('Illustration hochladen', Wn.x + Wn.w / 2, Wn.y + Wn.h / 2 - 40);
        ctx.restore();
      }
    }
    // 2. Rahmen darüber
    let frame = res.frame1, variant = 2;
    if (nSlots === 4 && res.frame3) { frame = res.frame3; variant = 4; }
    else if (nSlots >= 3 && res.frame2) { frame = res.frame2; variant = 3; }
    if (frame && card.type === 'king') frame = kingFrame(frame, L);
    if (frame && on('frame')) ctx.drawImage(frame, 0, 0, L.W, L.H);
    if (nSlots > variant) warn('noFrame2');
    if (opt.info) { opt.info.variant = variant; opt.info.slotKeys = (variant === 4 ? ['slot4a', 'slot4b', 'slot4c', 'slot4d'] : variant === 3 ? ['race', 'class1b', 'class2'] : ['race', 'class1']).slice(0, slotItems.length); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 3. Energie
    const isKing = card.type === 'king';
    if (isKing && (on('energy') || on('crown'))) drawCrown(ctx, L.energy.x, L.energy.y + 2, L.energy.size * 0.95);
    else if (on('energy') && card.energy !== '' && card.energy !== null && card.energy !== undefined) {
      ctx.save(); ctx.font = fontStr(L, 700, L.energy.size, 'num');
      ctx.shadowColor = 'rgba(0,0,10,.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      strokeText(ctx, String(card.energy), L.energy.x, L.energy.y + 4, '#f3f6ff', (GEMS[gemKey((card.style || {}).energy)] || {}).swatch ? darken(GEMS[gemKey(card.style.energy)].swatch[2]) : '#0b1a3d', 7);
      ctx.restore();
    }
    // 4. Name
    if (on('name') && card.name) {
      const ns = Math.round(L.name.size * (card.nameScale || 100) / 100);
      const f = fitSize(ctx, L, card.name, 700, ns, L.name.w, Math.round(L.name.size * 0.5), 'name');
      if (f.overflow) warn('nameOverflow');
      const nst = (card.style || {}).name || 'normal';
      if (nst === 'normal' || !NAME_STYLES[nst]) {
        ctx.save(); ctx.fillStyle = '#1a120b'; ctx.shadowColor = 'rgba(255,245,220,.55)'; ctx.shadowOffsetY = 1.5;
        ctx.fillText(card.name, L.name.x, L.name.y + 2); ctx.restore();
      } else shinyText(ctx, card.name, L.name.x, L.name.y + 2, f.size, NAME_STYLES[nst]);
    }
    // 5. Element
    const el = D.ELEMENTS.find(e => e.id === card.element);
    const el2 = card.element2 && card.element2 !== card.element ? D.ELEMENTS.find(e => e.id === card.element2) : null;
    if (!on('elementCrest')) { /* ausgelassen */ }
    else if (el && el2) drawSplitElement(ctx, L, res, el, el2, warn);
    else if (el || el2) {
      const e = el || el2, im = res.crests[e.crest];
      if (im) { ctx.save(); ctx.beginPath(); ctx.arc(L.element.x, L.element.y, L.element.r, 0, Math.PI * 2); ctx.clip(); drawCrest(ctx, im, L.element.x, L.element.y, L.element.r * 2 / 0.84); ctx.restore(); } else warn('missingCrest', e.name);
    }
    if (on('elementLabel') && (el || el2)) {
      const t = [el, el2].filter(Boolean).map(e => e.name).join(' · ');
      fitSize(ctx, L, t, 600, L.elementLabel.size, L.elementLabel.w, 13);
      strokeText(ctx, t, L.elementLabel.x, L.elementLabel.y, '#f4ecd6', 'rgba(0,0,0,.6)', 3);
    }
    // 6. Rasse / Klassen
    const slot = (item, P, PL) => {
      if (!item) return;
      const im = res.crests[item.crest];
      if (on('slotCrests')) { if (im) drawCrest(ctx, im, P.x, P.y, P.r * 2); else warn('missingCrest', item.name); }
      if (on('slotLabels')) { fitSize(ctx, L, item.name, 600, PL.size, PL.w, 12);
      strokeText(ctx, item.name, PL.x, PL.y, '#efe6d2', 'rgba(0,0,0,.75)', 3); }
    };
    const POS = variant === 4 ? ['slot4a', 'slot4b', 'slot4c', 'slot4d'] : variant === 3 ? ['race', 'class1b', 'class2'] : ['race', 'class1'];
    const D4 = defaultLayout();
    slotItems.slice(0, POS.length).forEach((it, i) => { const k = POS[i]; slot(it, L[k] || D4[k], L[k + 'Label'] || D4[k + 'Label']); });
    // 7. ATK / DEF
    const num = (v, P, PL, label, stroke, fmt) => {
      if (v === '' || v === null || v === undefined) return;
      const t = fmt ? Number(v).toLocaleString('de-DE') : String(v);
      const f = fitSize(ctx, L, t, 700, P.size, 118, fmt ? 26 : 40, 'num');
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      strokeText(ctx, t, P.x, P.y - 4, '#ffffff', stroke, 7); ctx.restore();
      ctx.font = fontStr(L, 700, PL.size);
      strokeText(ctx, label, PL.x, PL.y, '#ffffff', stroke, 5);
    };
    const st0 = card.style || {}, edgeOf = (k, dflt) => { const g = GEMS[gemKey(st0[k])]; return g && g.swatch ? darken(g.swatch[2]) : dflt; };
    if (on('stats')) {
      num(card.atk, L.atk, L.atkLabel, 'ATK', edgeOf('atk', '#3a0907'));
      if (isKing) num(card.hp, L.def, L.defLabel, 'HP', edgeOf('def', '#07173a'), true);
      else num(card.def, L.def, L.defLabel, 'DEF', edgeOf('def', '#07173a'));
    }
    // 8. Raster
    if (on('grids')) {
      if (!opt.gridOnly || opt.gridOnly === 'attack') drawGrid(ctx, L, isKing ? kingBox(L) : L.attackGrid, card.attack, 'Angriffsrichtung', ((card.style || {}).atkArrow) || '#e3261d', warn, opt.gridParts);
      if (isKing) { /* Könige: kein Laufraster */ }
      else if (!opt.gridOnly || opt.gridOnly === 'move') drawGrid(ctx, L, L.moveGrid, card.move, 'Laufrichtung', ((card.style || {}).movArrow) || '#2f8df5', warn, opt.gridParts);
    }
    // 9. Banner Rasse / Klasse
    const parts = slotItems.map(x => x.name);
    if (on('banner') && parts.length) {
      const t = parts.join(' / ');
      const f = fitSize(ctx, L, t, 600, L.banner.size, L.banner.w, 18);
      if (f.overflow) warn('bannerOverflow');
      ctx.fillStyle = '#1d150d'; ctx.fillText(t, L.banner.x, L.banner.y + 1);
    }
    // 10. Gaben
    ctx.textAlign = 'left';
    ctx.font = fontStr(L, 700, L.giftsTitle.size);
    if (on('giftsTitle')) strokeText(ctx, isKing ? 'Königliche Gaben:' : 'Gaben:', L.giftsTitle.x, L.giftsTitle.y, '#f2ecdc', 'rgba(0,0,0,.8)', 4);
    const gifts = (card.gifts || []).slice(0, 3), GL = isKing ? (D.ROYAL_GIFTS || []) : D.GIFTS;
    for (let i = 0; i < 3; i++) {
      const R = L.gifts[i], gsel = gifts[i], g = gsel && GL.find(x => x.id === gsel.id);
      if (!g) { if (on('giftEmpty')) { drawDash(ctx, L, R.crest); drawDash(ctx, L, R.ct); } continue; }
      const crest = res.giftCrests[g.id];
      if (on('giftCrests')) { if (crest) drawCrestBox(ctx, crest, R.crest); else { drawDash(ctx, L, R.crest, '?'); warn('giftNoCrest', g.name); } }
      if (on('giftTexts')) {
      // Titel
      const title = D.giftTitle(g);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      fitSize(ctx, L, title, 700, 26, R.text.w, 18);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 4;
      const grd = ctx.createLinearGradient(0, R.text.y, 0, R.text.y + 26); grd.addColorStop(0, '#ffe08a'); grd.addColorStop(1, '#e2a22c');
      ctx.fillStyle = grd; ctx.fillText(title, R.text.x, R.text.y + 22); ctx.restore();
      // Beschreibung: Schrift so groß wie möglich
      const body = D.giftShort(g, gsel); // Kurztext auf der Karte (königliche Gaben mit eingestelltem Bereich/Wert)
      // Feld: von unter dem Titel bis knapp über die Trennlinie. Text wird nie über diese Grenze gezeichnet.
      const tTop = R.text.y + 29, tBot = R.text.y + R.text.h - 4, avail = tBot - tTop;
      const kT = ACTIVE ? ACTIVE.text.k : 1;
      let fs = 21, lines, lh;
      for (; fs >= 13; fs -= 0.5) {
        ctx.font = fontStr(L, 500, fs, 'text'); lines = wrap(ctx, body, R.text.w);
        lh = fs * kT * 1.14;
        if (lines.length * lh - (lh - fs * kT) <= avail) break;
      }
      if (lines.length * lh - (lh - fs * kT) > avail + 0.5) warn('giftOverflow', g.name);
      if (fs < 15) warn('giftSmall', g.name);
      ctx.save(); ctx.beginPath(); ctx.rect(R.text.x - 4, tTop - 2, R.text.w + 8, avail + 4); ctx.clip();
      ctx.fillStyle = '#ece5d3'; ctx.textBaseline = 'top';
      lines.forEach((ln, j) => ctx.fillText(ln, R.text.x, tTop + j * lh));
      ctx.restore();
      }
      // CT-Feld
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const C = R.ct, mx = C.x + C.w / 2;
      if (g.kind === 'permanent') {
        if (on('giftCtBg')) {
        ctx.save();
        roundRect(ctx, C.x - 1, C.y - 1, C.w + 2, C.h + 2, 7);
        const bgd = ctx.createLinearGradient(0, C.y, 0, C.y + C.h); bgd.addColorStop(0, '#232a35'); bgd.addColorStop(1, '#0e1218');
        ctx.fillStyle = bgd; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#c9a25a'; ctx.stroke(); ctx.restore();
        }
        if (on('giftCtText')) {
        ctx.font = fontStr(L, 700, 21); strokeText(ctx, 'Permanent', mx, C.y + C.h * 0.33, '#f4eedc', 'rgba(0,0,0,.6)', 3);
        ctx.font = fontStr(L, 600, 18); ctx.fillStyle = '#d9d2c0'; ctx.fillText('Kein CT', mx, C.y + C.h * 0.7);
        }
      } else if (on('giftCtText')) {
        ctx.font = fontStr(L, 700, 24); strokeText(ctx, 'CT', mx, C.y + C.h * 0.3, '#ffffff', 'rgba(40,0,0,.8)', 4);
        ctx.font = fontStr(L, 700, 22); strokeText(ctx, g.ct + (g.ct === 1 ? ' Runde' : ' Runden'), mx, C.y + C.h * 0.7, '#ffffff', 'rgba(40,0,0,.8)', 4);
      }
    }
    // 11. Seltenheit
    const ra = D.RARITIES.find(r => r.id === card.rarity);
    if (ra) {
      const im = res.crests[ra.crest];
      if (on('rarityCrest')) { if (im) drawCrest(ctx, im, L.rarity.x, L.rarity.y, L.rarity.size); else warn('missingCrest', ra.name); }
      if (on('rarityLabel')) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      fitSize(ctx, L, ra.name, 700, L.rarityLabel.size, L.rarityLabel.w, 20);
      const RG = { gewoehnlich: ['rgba(210,220,235,.4)', '#1a1f27'], ungewoehnlich: ['rgba(80,220,130,.42)', '#082013'], selten: ['rgba(80,160,255,.45)', '#0a1630'], legendaer: ['rgba(255,196,80,.5)', '#2a1803'] }[ra.id] || ['rgba(80,160,255,.45)', '#0a1630'];
      ctx.save(); ctx.shadowColor = RG[0]; ctx.shadowBlur = 8;
      strokeText(ctx, ra.name, L.rarityLabel.x, L.rarityLabel.y, '#f4f6ff', RG[1], 5); ctx.restore();
      }
    }
    // 12. Entwurfsstempel (optional)
    if (opt.watermark && on('watermark')) {
      ctx.save(); ctx.translate(L.W / 2, L.H * 0.42); ctx.rotate(-0.42);
      ctx.font = fontStr(L, 800, 120); ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.fillStyle = 'rgba(200,30,30,.28)'; ctx.fillText('ENTWURF', 0, 0); ctx.strokeText('ENTWURF', 0, 0); ctx.restore();
    }
    ctx.restore();
    ACTIVE = null;
    return issues;
  }
  /* ---------- Bild in hoher Qualität verkleinern (stufenweise halbieren) ---------- */
  const hqCache = new WeakMap();
  /* ---------- Zauber- und Fluchkarten (eigene Vorlage: grün bzw. lila) ---------- */
  // Positionen in Vorlagen-Koordinaten 1024 × 1536, vermessen an den Layout-Bildern vom 29.10.2026
  const SPELL_L = { window: { x: 47, y: 150, w: 932, h: 796 }, energy: { x: 112, y: 112, size: 108 }, name: { x: 515, y: 97, w: 560, size: 62 },
    subtitle: { x: 512, y: 986, w: 600, size: 30 }, text: { x: 120, y: 1128, w: 786, h: 300 }, rarity: { x: 512, y: 1490, size: 74 } };
  function spellText(card) { const E = window.WOK_EFFECTS; return (card.ruleText && card.ruleText.trim()) || (E && card.spell ? E.describe(card, D) : ''); }
  function drawSpell(ctx, card, L, res, opt, warn, on, S) {
    const SL = SPELL_L, Wn = SL.window, a = card.art || {};
    if (on('art') && res.art) {
      const im = res.art, iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, fit = coverFit(iw, ih, Wn);
      const sc = a.scale || fit.scale, x = a.x !== undefined ? a.x : fit.x, y = a.y !== undefined ? a.y : fit.y;
      ctx.save(); roundRect(ctx, Wn.x, Wn.y, Wn.w, Wn.h, 36); ctx.clip(); drawImageHQ(ctx, im, x, y, iw * sc, ih * sc, S); ctx.restore();
    } else if (on('art')) { warn('noArt'); if (opt.placeholder !== false) { ctx.save(); ctx.fillStyle = 'rgba(214,180,106,.06)'; ctx.fillRect(Wn.x, Wn.y, Wn.w, Wn.h); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontStr(L, 600, 34); ctx.fillStyle = 'rgba(214,180,106,.55)'; ctx.fillText('Illustration hochladen', Wn.x + Wn.w / 2, Wn.y + Wn.h / 2); ctx.restore(); } }
    const fr = res.spellFrames && res.spellFrames[card.type];
    if (fr && on('frame')) ctx.drawImage(fr, 0, 0, L.W, L.H); else if (!fr) warn('noFrame2');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (on('energy') && card.energy !== '' && card.energy !== null && card.energy !== undefined) {
      ctx.save(); ctx.font = fontStr(L, 700, SL.energy.size, 'num'); ctx.shadowColor = 'rgba(0,0,10,.8)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      strokeText(ctx, String(card.energy), SL.energy.x, SL.energy.y + 4, '#f3fff6', card.type === 'curse' ? '#2a0b44' : '#08341d', 7); ctx.restore();
    }
    if (on('name') && card.name) {
      const ns = Math.round(SL.name.size * (card.nameScale || 100) / 100);
      const f = fitSize(ctx, L, card.name, 700, ns, SL.name.w, Math.round(SL.name.size * 0.5), 'name'); if (f.overflow) warn('nameOverflow');
      const nst = (card.style || {}).name || 'normal';
      if (nst === 'normal' || !NAME_STYLES[nst]) { ctx.save(); ctx.fillStyle = '#1a120b'; ctx.shadowColor = 'rgba(255,245,220,.55)'; ctx.shadowOffsetY = 1.5; ctx.fillText(card.name, SL.name.x, SL.name.y + 2); ctx.restore(); }
      else shinyText(ctx, card.name, SL.name.x, SL.name.y + 2, f.size, NAME_STYLES[nst]);
    }
    if (on('banner') && card.subtitle) { const f = fitSize(ctx, L, card.subtitle, 600, SL.subtitle.size, SL.subtitle.w, 16); if (f.overflow) warn('bannerOverflow'); ctx.fillStyle = '#1d150d'; ctx.fillText(card.subtitle, SL.subtitle.x, SL.subtitle.y + 1); }
    // Phasen-Siegel oben rechts im Bildfenster: wann die Karte gespielt werden darf (B = Battlephase, K = Konterphase)
    if (on('name') && card.spell) { const tm = card.spell.timing || 'both'; drawPhaseSeals(ctx, L, tm === 'battle' ? ['B'] : tm === 'counter' ? ['K'] : ['B', 'K'], Wn.x + Wn.w - 24, Wn.y + 66); }
    // Regeltext (frei oder aus den Effekten erzeugt) und optionaler Stimmungstext: so groß wie möglich, nie abgeschnitten
    if (on('giftTexts')) {
      const T = SL.text, body = spellText(card), flav = (card.flavor || '').trim(), kT = ACTIVE ? ACTIVE.text.k : 1;
      let fs = 32, lines = [], fl = [], lh = 0, flh = 0, total = 0;
      for (; fs >= 13; fs -= 0.5) {
        ctx.font = fontStr(L, 500, fs, 'text'); lines = body ? body.split(/\n/).flatMap(p => wrap(ctx, p, T.w)) : []; lh = fs * kT * 1.2;
        const ff = Math.max(12, fs * 0.82); ctx.font = 'italic ' + fontStr(L, 500, ff, 'text'); fl = flav ? wrap(ctx, flav, T.w) : []; flh = ff * kT * 1.18;
        total = lines.length * lh + (fl.length ? 18 + fl.length * flh : 0);
        if (total <= T.h) break;
      }
      if (total > T.h + 0.5) warn('giftOverflow', 'Regeltext'); if (fs < 16) warn('giftSmall', 'Regeltext');
      ctx.save(); ctx.beginPath(); ctx.rect(T.x - 6, T.y - 4, T.w + 12, T.h + 8); ctx.clip(); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.font = fontStr(L, 500, fs, 'text'); ctx.fillStyle = '#f1ece0'; ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 3;
      lines.forEach((ln, j) => ctx.fillText(ln, T.x, T.y + j * lh));
      if (fl.length) {
        const y0 = T.y + lines.length * lh + 18; ctx.font = 'italic ' + fontStr(L, 500, Math.max(12, fs * 0.82), 'text'); ctx.fillStyle = 'rgba(232,222,196,.78)';
        fl.forEach((ln, j) => ctx.fillText(ln, T.x, y0 + j * flh));
      }
      ctx.restore();
    }
    const ra = D.RARITIES.find(r => r.id === card.rarity);
    if (ra && on('rarityCrest')) { const im = res.crests && res.crests[ra.crest]; if (im) drawCrest(ctx, im, SL.rarity.x, SL.rarity.y, SL.rarity.size); }
    if (opt.watermark && on('watermark')) {
      ctx.save(); ctx.translate(L.W / 2, L.H * 0.42); ctx.rotate(-0.42); ctx.font = fontStr(L, 800, 120); ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.fillStyle = 'rgba(200,30,30,.28)'; ctx.fillText('ENTWURF', 0, 0); ctx.strokeText('ENTWURF', 0, 0); ctx.restore();
    }
  }
  function drawImageHQ(ctx, im, x, y, dw, dh, S) {
    const iw = im.naturalWidth || im.width, tw = Math.max(1, Math.round(dw * (S || 1)));
    let src = im;
    if (tw < iw / 2) {
      let m = hqCache.get(im); if (!m) { m = new Map(); hqCache.set(im, m); }
      const key = Math.round(Math.log2(iw / tw));
      if (!m.has(key)) {
        let cur = im, cw = iw, ch = im.naturalHeight || im.height;
        for (let i = 0; i < key; i++) {
          const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(cw / 2)); c.height = Math.max(1, Math.round(ch / 2));
          const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, c.width, c.height);
          cur = c; cw = c.width; ch = c.height;
        }
        m.set(key, cur);
      }
      src = m.get(key);
    }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, x, y, dw, dh);
  }
  const blurCache = new WeakMap();
  function blurSource(im) {
    if (blurCache.has(im)) return blurCache.get(im);
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = 28 / Math.max(iw, ih);
    const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(iw * k)); c.height = Math.max(2, Math.round(ih * k));
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height);
    blurCache.set(im, c); return c;
  }
  function containFit(iw, ih, Wn) { const sc = Math.min(Wn.w / iw, Wn.h / ih); return { scale: sc, x: Wn.x + (Wn.w - iw * sc) / 2, y: Wn.y + (Wn.h - ih * sc) / 2 }; }

  /* ---------- Namensveredelung: Metallfolie wie bei Premium-Karten ---------- */
  // stops: Verlauf von oben nach unten mit "Horizontlinie" (typisch für polierte Metallfolie)
  const NAME_STYLES = {
    praegung: { name: 'Prägung', kind: 'emboss' },
    blattgold: { name: 'Blattgold', stops: ['#fff4cf', '#f3d68a', '#d4a849', '#8f6420', '#c99a42', '#f0d48d', '#b8893a'], edge: '#3e2a0b', hi: 'rgba(255,251,230,.85)', lo: 'rgba(70,40,5,.55)' },
    altgold: { name: 'Altgold', stops: ['#f4e6bd', '#dcc184', '#b08d4e', '#6b4f22', '#a7854b', '#d3b97f', '#8d6d3a'], edge: '#33240c', hi: 'rgba(255,246,220,.7)', lo: 'rgba(50,30,5,.55)' },
    silber: { name: 'Silber', stops: ['#ffffff', '#eef1f5', '#c3cad3', '#6f7884', '#aeb6c0', '#e6eaef', '#9aa2ad'], edge: '#262b32', hi: 'rgba(255,255,255,.9)', lo: 'rgba(20,25,35,.5)' },
    platin: { name: 'Platin', stops: ['#fbfcfd', '#e3e8ee', '#b9c2cc', '#8792a0', '#c4ccd6', '#eef2f6', '#a9b2bd'], edge: '#30363f', hi: 'rgba(255,255,255,.95)', lo: 'rgba(30,35,45,.45)' },
    rosegold: { name: 'Roségold', stops: ['#fff0ea', '#f1c7b6', '#cf9580', '#7f4b3b', '#c38a74', '#ecc0ae', '#a36e5b'], edge: '#3c1e15', hi: 'rgba(255,244,238,.85)', lo: 'rgba(60,25,15,.5)' },
    bronze: { name: 'Bronze', stops: ['#f8e1bf', '#ddae74', '#b07a3d', '#62391a', '#a8713a', '#d8a56b', '#86562a'], edge: '#2f1b08', hi: 'rgba(255,240,215,.75)', lo: 'rgba(45,25,5,.55)' }
  };
  let grainTile = null;
  function grain() { // feine Metallstruktur (gebürstet), einmal erzeugt
    if (grainTile) return grainTile;
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
    const id = g.createImageData(256, 64); let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < 64; y++) { let row = rnd(); for (let x = 0; x < 256; x++) { row = row * 0.9 + rnd() * 0.1; const v = Math.round(row * 255); const i = (y * 256 + x) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } }
    g.putImageData(id, 0, 0); grainTile = c; return c;
  }
  function textLayer(ctx, text, size, pad) {
    const m = ctx.measureText(text), w = Math.ceil(m.width + pad * 2), h = Math.ceil(size * 1.7 + pad * 2);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.font = ctx.font; g.textAlign = 'center'; g.textBaseline = 'middle';
    return { c, g, w, h, cx: w / 2, cy: h / 2 };
  }
  function shinyText(ctx, text, x, y, size, st) {
    const tr = ctx.getTransform(), S = Math.hypot(tr.a, tr.b) || 1; // in Ausgabeauflösung zeichnen
    const pad = Math.ceil(size * 0.2), fs = size;
    ctx.save();
    const base = textLayer(ctx, text, fs, pad);
    // Ebenen in Gerätepixeln
    const k = S, W = Math.ceil(base.w * k), H = Math.ceil(base.h * k);
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.font = ctx.font; g.textAlign = 'center'; g.textBaseline = 'middle'; return [c, g]; };
    const [mask, mg] = mk(); mg.fillStyle = '#000'; mg.fillText(text, base.cx, base.cy);
    const out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d');
    const top = base.cy - fs * 0.5, bot = base.cy + fs * 0.42;
    if (st.kind === 'emboss') {
      // Tinte in das Pergament geprägt: dunkle Füllung, helle Unterkante, dunkle Oberkante innen
      const [c1, g1] = mk(); g1.fillStyle = 'rgba(255,250,235,.75)'; g1.fillText(text, base.cx, base.cy + fs * 0.035);
      og.drawImage(c1, 0, 0);
      const [c2, g2] = mk(); const gr = g2.createLinearGradient(0, top, 0, bot); gr.addColorStop(0, '#2a1a0c'); gr.addColorStop(1, '#4a3220');
      g2.fillStyle = gr; g2.fillText(text, base.cx, base.cy); og.drawImage(c2, 0, 0);
      bevel(og, mask, W, H, Math.max(1, fs * 0.03 * k), 'rgba(0,0,0,.55)', 'rgba(255,240,215,.18)');
    } else {
      // 1. weicher, kurzer Schlagschatten auf dem Banner
      const [sh, sg] = mk(); sg.fillStyle = 'rgba(30,18,5,.5)'; sg.fillText(text, base.cx, base.cy + fs * 0.04);
      og.save(); og.filter = 'blur(' + (fs * 0.035 * k).toFixed(1) + 'px)'; og.drawImage(sh, 0, 0); og.restore();
      // 2. feine dunkle Gravurkante
      const [ed, eg] = mk(); eg.lineJoin = 'round'; eg.strokeStyle = st.edge; eg.lineWidth = Math.max(1.6, fs * 0.055); eg.strokeText(text, base.cx, base.cy); eg.fillStyle = st.edge; eg.fillText(text, base.cx, base.cy);
      og.drawImage(ed, 0, 0);
      // 3. Metallfläche: Verlauf + gebürstete Struktur, auf die Buchstaben begrenzt
      const [mt, mtg] = mk();
      const gr = mtg.createLinearGradient(0, top, 0, bot);
      const pos = [0, 0.2, 0.44, 0.52, 0.6, 0.82, 1];
      st.stops.forEach((c, i) => gr.addColorStop(pos[i], c));
      mtg.fillStyle = gr; mtg.fillText(text, base.cx, base.cy);
      mtg.setTransform(1, 0, 0, 1, 0, 0); mtg.globalCompositeOperation = 'source-atop';
      mtg.globalAlpha = 0.09; mtg.globalCompositeOperation = 'overlay';
      const gt = grain(); for (let gx = 0; gx < W; gx += 256) for (let gy = 0; gy < H; gy += 64) mtg.drawImage(gt, gx, gy);
      mtg.globalAlpha = 1; mtg.globalCompositeOperation = 'destination-in'; mtg.drawImage(mask, 0, 0);
      // schräger Glanzstreifen
      mtg.globalCompositeOperation = 'source-atop';
      const sx = W * 0.18, sheen = mtg.createLinearGradient(sx, 0, sx + H * 0.9, H);
      sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(255,255,255,.28)'); sheen.addColorStop(0.56, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
      mtg.fillStyle = sheen; mtg.fillRect(0, 0, W, H);
      og.drawImage(mt, 0, 0);
      // 4. Prägekante: Licht oben, Schatten unten
      bevel(og, mask, W, H, Math.max(1, fs * 0.028 * k), st.hi, st.lo);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(out, Math.round(tr.e + (x - base.cx) * tr.a), Math.round(tr.f + (y - base.cy) * tr.d));
    ctx.restore();
  }
  // Innenkante: Streifen = Maske minus verschobene Maske
  function bevel(og, mask, W, H, d, hiCol, loCol) {
    for (const [dy, col] of [[d, hiCol], [-d, loCol]]) {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      g.fillStyle = col; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0);
      g.globalCompositeOperation = 'destination-out'; g.drawImage(mask, 0, dy);
      og.drawImage(c, 0, 0);
    }
  }

  /* ---------- Edelsteine und Rahmen umfärben ----------
   * Es wird nur der Farbton der gesättigten (farbigen) Pixel verschoben. Helligkeit, Struktur und weiße
   * Glanzlichter bleiben erhalten, Silber- und Goldfassungen werden nicht verändert. */
  // h: Ziel-Farbton, sk: Sättigung, lf: Helligkeitskurve, spread: wie viel Farbtonvariation erhalten bleibt
  const GEMS = {
    original: { name: 'Original' },
    saphir: { name: 'Saphir', h: 218, sk: 1.0, lf: 'same', spread: 0.6, swatch: ['#9cc8ff', '#2f6ee0', '#0b2a6b'] },
    rubin: { name: 'Rubin', h: 352, sk: 0.92, lf: 'deep', spread: 0.35, swatch: ['#ff9aa6', '#c4142c', '#4a0511'] },
    granat: { name: 'Granat', h: 343, sk: 0.7, lf: 'darker', spread: 0.3, swatch: ['#e4889a', '#8e1530', '#33040f'] },
    smaragd: { name: 'Smaragd', h: 148, sk: 0.78, lf: 'deep', spread: 0.4, swatch: ['#9be8bd', '#13915a', '#04351f'] },
    jade: { name: 'Jade', h: 165, sk: 0.42, lf: 'same', spread: 0.3, swatch: ['#c2e8d8', '#4a9c84', '#163d33'] },
    amethyst: { name: 'Amethyst', h: 276, sk: 0.62, lf: 'same', spread: 0.45, swatch: ['#d8b4ff', '#7a3fc4', '#2a0f4d'] },
    topas: { name: 'Topas', h: 36, sk: 0.95, lf: 'bright', spread: 0.35, swatch: ['#ffe2a1', '#e0911c', '#6a3a05'] },
    citrin: { name: 'Citrin', h: 48, sk: 0.85, lf: 'bright', spread: 0.3, swatch: ['#fff1b0', '#d9b01c', '#5f4a05'] },
    aquamarin: { name: 'Aquamarin', h: 192, sk: 0.62, lf: 'bright', spread: 0.4, swatch: ['#c8f2ff', '#3aa6c4', '#0f3f52'] },
    onyx: { name: 'Onyx', h: 220, sk: 0.06, lf: 'onyx', spread: 0, swatch: ['#9aa0a8', '#2a2d33', '#07080a'] },
    mondstein: { name: 'Mondstein', h: 215, sk: 0.14, lf: 'pearl', spread: 0.2, swatch: ['#ffffff', '#c9d3e2', '#6c7a90'] }
  };
  const THEMES = {
    blau: { name: 'Saphirblau (Original)' },
    karmesin: { name: 'Karmesin', h: 350, sk: 0.95, lf: 'same', spread: 0.25 },
    obsidian: { name: 'Obsidian', h: 222, sk: 0.07, lf: 'onyx', spread: 0 },
    elfenbein: { name: 'Elfenbein', h: 40, sk: 0.22, lf: 'ivory', spread: 0 },
    smaragd: { name: 'Smaragd', h: 152, sk: 0.62, lf: 'deep', spread: 0.25 },
    amethyst: { name: 'Amethyst', h: 274, sk: 0.55, lf: 'same', spread: 0.3 },
    bernstein: { name: 'Bernstein', h: 32, sk: 0.78, lf: 'same', spread: 0.2 }
  };
  // ältere Karten (Version 2) weiterhin lesbar
  const LEGACY = { theme: { rot: 'karmesin', schwarz: 'obsidian', weiss: 'elfenbein' }, gem: { blau: 'saphir', rot: 'rubin', gruen: 'smaragd', violett: 'amethyst', gold: 'topas', silber: 'mondstein', schwarz: 'onyx', weiss: 'mondstein', tuerkis: 'aquamarin', orange: 'topas' } };
  function gemKey(v) { return GEMS[v] ? v : (LEGACY.gem[v] || 'original'); }
  function themeKey(v) { return THEMES[v] ? v : (LEGACY.theme[v] || 'blau'); }
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
    if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
    return [h, s, l];
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }
  function curve(kind, l) {
    switch (kind) {
      case 'deep': return Math.pow(l, 1.12) * 0.96;               // satter, etwas dunkler
      case 'darker': return Math.pow(l, 1.25) * 0.9;
      case 'bright': return Math.min(0.97, Math.pow(l, 0.88) * 1.06);
      case 'onyx': return l < 0.55 ? l * 0.5 : 0.275 + (l - 0.55) * 1.6; // tiefschwarz, Glanz bleibt
      case 'pearl': return Math.min(0.96, 0.3 + Math.pow(l, 0.7) * 0.68);
      case 'ivory': return Math.min(0.9, 0.2 + Math.pow(l, 0.75) * 1.25);
      default: return l;
    }
  }
  function hueDist(a, b) { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  // Farbton-Verschiebung eines Bereichs; srcHue: ursprünglicher Farbton (wird gemessen), mask: optional
  function shiftRegion(px, W, H, x0, y0, x1, y1, inside, P, srcHue, minSat) {
    for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
      const w0 = inside(x, y); if (w0 <= 0) continue;
      const i = (y * W + x) * 4; if (px[i + 3] === 0) continue;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const [h, sat, l] = rgb2hsl(r, g, b);
      if (sat < minSat || hueDist(h, srcHue) > 55) continue;          // Silber, Gold, Weißglanz unverändert
      const w = w0 * Math.min(1, (sat - minSat) / 0.12);
      const nh = P.h + (((h - srcHue + 540) % 360) - 180) * P.spread;
      const o = hsl2rgb(nh, Math.min(1, sat * P.sk), curve(P.lf, l));
      px[i] = Math.round(r + (o[0] - r) * w); px[i + 1] = Math.round(g + (o[1] - g) * w); px[i + 2] = Math.round(b + (o[2] - b) * w);
    }
  }
  function measureHue(px, W, cx, cy, R) { // mittlerer Farbton der gesättigten Pixel eines Steins
    let sx = 0, sy = 0;
    for (let y = Math.round(cy - R); y < cy + R; y += 2) for (let x = Math.round(cx - R); x < cx + R; x += 2) {
      if (Math.hypot(x - cx, y - cy) > R) continue; const i = (y * W + x) * 4;
      const [h, s] = rgb2hsl(px[i], px[i + 1], px[i + 2]); if (s < 0.35) continue;
      if (h > 25 && h < 65) continue; sx += Math.cos(h * Math.PI / 180) * s; sy += Math.sin(h * Math.PI / 180) * s;
    }
    return ((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360;
  }
  // Erkennt die tatsächliche Form eines Steins: Flutfüllung ab der Mitte über farbige Pixel ähnlichen Farbtons.
  // Ergebnis: Gewichte 0–255 je Pixel (weicher Rand), damit keine Reste der alten Farbe stehen bleiben.
  function gemMask(px, W, H, cc, src, minSat) {
    const Rs = cc.R * 1.22, x0 = Math.max(0, Math.floor(cc.cx - Rs)), x1 = Math.min(W - 1, Math.ceil(cc.cx + Rs)), y0 = Math.max(0, Math.floor(cc.cy - Rs)), y1 = Math.min(H - 1, Math.ceil(cc.cy + Rs));
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, wt = new Uint8Array(bw * bh), seen = new Uint8Array(bw * bh), st = [];
    const ok = (x, y) => {
      if (Math.hypot(x - cc.cx, y - cc.cy) > Rs) return 0;
      const i = (y * W + x) * 4; if (px[i + 3] === 0) return 0;
      const [h, sat] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
      if (sat < minSat || hueDist(h, src) > 62) return 0;
      return Math.max(0.15, Math.min(1, (sat - minSat) / 0.12));
    };
    // Startpunkte: farbige Pixel im inneren Bereich
    for (let y = Math.round(cc.cy - cc.R * 0.5); y <= cc.cy + cc.R * 0.5; y += 3) for (let x = Math.round(cc.cx - cc.R * 0.5); x <= cc.cx + cc.R * 0.5; x += 3) {
      if (x < x0 || x > x1 || y < y0 || y > y1) continue; const j = (y - y0) * bw + (x - x0); if (seen[j]) continue;
      const w = ok(x, y); if (w) { seen[j] = 1; wt[j] = Math.round(w * 255); st.push(x, y); }
    }
    while (st.length) {
      const y = st.pop(), x = st.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
        const j = (ny - y0) * bw + (nx - x0); if (seen[j]) continue; seen[j] = 1;
        const w = ok(nx, ny); if (w) { wt[j] = Math.round(w * 255); st.push(nx, ny); }
      }
    }
    // weicher Übergang: ein Ring um die Fläche, nur wenn der Farbton passt
    const ring = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const j = (y - y0) * bw + (x - x0); if (wt[j]) continue;
      let nb = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const nx = x + dx, ny = y + dy; if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1 && wt[(ny - y0) * bw + (nx - x0)] > 120) { nb = 1; break; } }
      if (!nb) continue; const i = (y * W + x) * 4; const [h, sat] = rgb2hsl(px[i], px[i + 1], px[i + 2]);
      if (sat >= minSat * 0.6 && hueDist(h, src) <= 60) ring.push(j);
    }
    for (const j of ring) wt[j] = 110;
    return { x0, y0, bw, bh, wt, src };
  }
  function applyMask(px, W, M, P) {
    for (let yy = 0; yy < M.bh; yy++) for (let xx = 0; xx < M.bw; xx++) {
      const wv = M.wt[yy * M.bw + xx]; if (!wv) continue;
      const i = ((yy + M.y0) * W + (xx + M.x0)) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      const [h, sat, l] = rgb2hsl(r, g, b), w = wv / 255;
      const nh = P.h + (((h - M.src + 540) % 360) - 180) * P.spread;
      const o = hsl2rgb(nh, Math.min(1, sat * P.sk), curve(P.lf, l));
      px[i] = Math.round(r + (o[0] - r) * w); px[i + 1] = Math.round(g + (o[1] - g) * w); px[i + 2] = Math.round(b + (o[2] - b) * w);
    }
  }
  function maskShare(M, cc) { let n = 0; for (let j = 0; j < M.wt.length; j++) if (M.wt[j] > 120) n++; return n / (Math.PI * cc.R * cc.R); }
  function inMask(M, x, y) { const xx = x - M.x0, yy = y - M.y0; return xx >= 0 && yy >= 0 && xx < M.bw && yy < M.bh && M.wt[yy * M.bw + xx] > 0; }
  // Bereiche, die beim Umfärben eines Steins verändert werden können (fester Kreis ∪ erkannte Steinfläche, beim Element auch das Schild).
  // Ergebnis je Feld: { x, y, w, h, alpha } in Pixeln des Rahmens. Diese Bereiche färbt das Rahmen-Design nie um.
  function gemRegions(base, L) {
    const W = base.width, H = base.height, sx = W / L.W, sy = H / L.H;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(base, 0, 0);
    const px = g.getImageData(0, 0, W, H).data, gems = L.gems, EL = gems.elementLabel, out = {};
    for (const k of ['energy', 'atk', 'def', 'element']) {
      const P = gems[k], cc = { cx: P.x * sx, cy: P.y * sy, R: P.r * sx }, kc = { cx: cc.cx, cy: cc.cy, R: (P.r + 2) * sx };
      const M = gemMask(px, W, H, cc, measureHue(px, W, cc.cx, cc.cy, cc.R * 0.85), 0.2);
      let x0 = Math.min(M.x0, Math.floor(kc.cx - kc.R)), y0 = Math.min(M.y0, Math.floor(kc.cy - kc.R)), x1 = Math.max(M.x0 + M.bw - 1, Math.ceil(kc.cx + kc.R)), y1 = Math.max(M.y0 + M.bh - 1, Math.ceil(kc.cy + kc.R));
      const lab = k === 'element' ? [Math.floor(EL.x * sx), Math.floor(EL.y * sy), Math.ceil((EL.x + EL.w) * sx), Math.ceil((EL.y + EL.h) * sy)] : null;
      if (lab) { x0 = Math.min(x0, lab[0]); y0 = Math.min(y0, lab[1]); x1 = Math.max(x1, lab[2]); y1 = Math.max(y1, lab[3]); }
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
      const w = x1 - x0 + 1, h = y1 - y0 + 1, alpha = new Uint8Array(w * h);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const inside = Math.hypot(x - kc.cx, y - kc.cy) < kc.R || inMask(M, x, y) || (lab && x >= EL.x * sx && x <= (EL.x + EL.w) * sx && y >= EL.y * sy && y <= (EL.y + EL.h) * sy);
        if (inside) alpha[(y - y0) * w + (x - x0)] = 255;
      }
      out[k] = { x: x0, y: y0, w, h, alpha };
    }
    return out;
  }
  function styleFrame(base, L, style) {
    const theme = themeKey(style.theme), W = base.width, H = base.height, sx = W / L.W, sy = H / L.H;
    const fields = ['energy', 'atk', 'def', 'element'].filter(k => gemKey(style[k]) !== 'original');
    if (theme === 'blau' && !fields.length) return base;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(base, 0, 0);
    const id = g.getImageData(0, 0, W, H), px = id.data;
    const gems = L.gems, circ = (P, pad) => { const cx = P.x * sx, cy = P.y * sy, R = (P.r + (pad || 0)) * sx; return { cx, cy, R }; };
    // Steine und Elementschild vom Rahmen-Umfärben ausnehmen, damit sie eigenständig bleiben
    const keep = [gems.energy, gems.atk, gems.def, gems.element].map(P => circ(P, 2));
    const EL = gems.elementLabel;
    // tatsächliche Steinflächen aus dem unveränderten Rahmen
    const masks = {};
    for (const k of ['energy', 'atk', 'def', 'element']) { const cc = circ(gems[k]); masks[k] = gemMask(px, W, H, cc, measureHue(px, W, cc.cx, cc.cy, cc.R * 0.85), 0.2); }
    const inGem = (x, y) => { for (const k of keep) if (Math.hypot(x - k.cx, y - k.cy) < k.R) return true; for (const k in masks) if (inMask(masks[k], x, y)) return true; return x >= EL.x * sx && x <= (EL.x + EL.w) * sx && y >= EL.y * sy && y <= (EL.y + EL.h) * sy; };
    if (theme !== 'blau') {
      const P = THEMES[theme];
      if (P.lf === 'ivory') {
        // helle Rahmen: nur das äußere Ornament aufhellen, Textfelder bleiben dunkel und lesbar
        const prot = (L.protect || []).map(r => [r[0] * sx, r[1] * sy, r[2] * sx, r[3] * sy]);
        const inProt = (x, y) => prot.some(r => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);
        shiftRegion(px, W, H, 0, 0, W, H, (x, y) => inGem(x, y) || inProt(x, y) ? 0 : 1, P, 218, 0.06);
        shiftRegion(px, W, H, 0, 0, W, H, (x, y) => !inGem(x, y) && inProt(x, y) ? 1 : 0, Object.assign({}, P, { lf: 'same', sk: 0.25 }), 218, 0.06);
      } else shiftRegion(px, W, H, 0, 0, W, H, (x, y) => inGem(x, y) ? 0 : 1, P, 218, 0.1);
    }
    for (const k of fields) {
      const P = GEMS[gemKey(style[k])];
      if (k === 'element') { // Namensschild unter dem Elementwappen
        const x0 = Math.round(EL.x * sx), x1 = Math.round((EL.x + EL.w) * sx), y0 = Math.round(EL.y * sy), y1 = Math.round((EL.y + EL.h) * sy);
        shiftRegion(px, W, H, x0, y0, x1, y1, () => 1, Object.assign({}, P, { lf: P.lf === 'onyx' ? 'onyx' : P.lf === 'pearl' ? 'same' : 'same' }), 212, 0.12);
        const cc = circ(gems.element);
        if (maskShare(masks.element, cc) > 0.3) applyMask(px, W, masks.element, P);
        else shiftRegion(px, W, H, Math.floor(cc.cx - cc.R), Math.floor(cc.cy - cc.R), Math.ceil(cc.cx + cc.R), Math.ceil(cc.cy + cc.R), (x, y) => Math.hypot(x - cc.cx, y - cc.cy) < cc.R ? 1 : 0, P, 212, 0.12); // dunkler Stein ohne Farbfläche
        continue;
      }
      const cc = circ(gems[k]);
      if (maskShare(masks[k], cc) > 0.3) applyMask(px, W, masks[k], P);
      else { const src = masks[k].src, soft = (x, y) => { const d = Math.hypot(x - cc.cx, y - cc.cy); return d > cc.R ? 0 : Math.min(1, (cc.R - d) / (3 * sx)); }; shiftRegion(px, W, H, Math.floor(cc.cx - cc.R), Math.floor(cc.cy - cc.R), Math.ceil(cc.cx + cc.R), Math.ceil(cc.cy + cc.R), soft, P, src, 0.14); }
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  /* ---------- Druckformat: Karte in Zielmaß setzen (strecken oder unverzerrt), Beschnitt aus dem Rand ---------- */
  function composeFormat(src, wmm, hmm, bleedmm, fitMode, dpmm) {
    const tw = Math.round(wmm * dpmm), th = Math.round(hmm * dpmm), b = Math.round(bleedmm * dpmm);
    const out = document.createElement('canvas'); out.width = tw + 2 * b; out.height = th + 2 * b;
    const g = out.getContext('2d'); g.imageSmoothingQuality = 'high';
    let dx = b, dy = b, dw = tw, dh = th;
    if (fitMode === 'contain') { const k = Math.min(tw / src.width, th / src.height); dw = Math.round(src.width * k); dh = Math.round(src.height * k); dx = b + Math.round((tw - dw) / 2); dy = b + Math.round((th - dh) / 2); }
    g.drawImage(src, dx, dy, dw, dh);
    // Ränder (Beschnitt und ggf. Seitenstreifen) aus den äußersten Pixeln verlängern
    const e = 2, W = out.width, H = out.height, sw = src.width, sh = src.height;
    if (dx > 0) { g.drawImage(src, 0, 0, e, sh, 0, dy, dx, dh); g.drawImage(src, sw - e, 0, e, sh, dx + dw, dy, W - dx - dw, dh); }
    if (dy > 0) { g.drawImage(src, 0, 0, sw, e, dx, 0, dw, dy); g.drawImage(src, 0, sh - e, sw, e, dx, dy + dh, dw, H - dy - dh); }
    if (dx > 0 && dy > 0) {
      g.drawImage(src, 0, 0, e, e, 0, 0, dx, dy); g.drawImage(src, sw - e, 0, e, e, dx + dw, 0, W - dx - dw, dy);
      g.drawImage(src, 0, sh - e, e, e, 0, dy + dh, dx, H - dy - dh); g.drawImage(src, sw - e, sh - e, e, e, dx + dw, dy + dh, W - dx - dw, H - dy - dh);
    }
    return out;
  }

  function coverFit(iw, ih, Wn) { const sc = Math.max(Wn.w / iw, Wn.h / ih); return { scale: sc, x: Wn.x + (Wn.w - iw * sc) / 2, y: Wn.y + (Wn.h - ih * sc) / 2 }; }
  function drawCrest(ctx, im, cx, cy, size) {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, s = size / Math.max(iw, ih);
    ctx.save(); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, cx - iw * s / 2, cy - ih * s / 2, iw * s, ih * s); ctx.restore();
  }
  function drawCrestBox(ctx, im, B) {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, s = Math.min((B.w - 6) / iw, (B.h - 2) / ih);
    ctx.save(); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, B.x + (B.w - iw * s) / 2, B.y + (B.h - ih * s) / 2, iw * s, ih * s); ctx.restore();
  }
  function drawDash(ctx, L, B, ch) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontStr(L, 600, ch ? 34 : 26);
    ctx.fillStyle = ch ? 'rgba(240,200,110,.8)' : 'rgba(230,226,214,.75)'; ctx.fillText(ch || '–', B.x + B.w / 2, B.y + B.h / 2); ctx.restore();
  }
  // Kleine Siegel: B (Battlephase, rot) und K (Konterphase, blau); rechtsbündig ab x, oben bei y
  function drawPhaseSeals(ctx, L, list, xr, y) {
    const R = 34, gap = 12, col = { B: ['#9a2a24', '#ffd2a8', 'BATTLE'], K: ['#1f4f8a', '#cfe6ff', 'KONTER'] };
    ctx.save();
    list.slice().reverse().forEach((k, i) => {
      const cx = xr - R - i * (2 * R + gap), cy = y + R, c = col[k];
      ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = c[0]; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.lineWidth = 4; ctx.strokeStyle = '#e8c477'; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R - 7, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,230,170,.55)'; ctx.stroke();
      ctx.fillStyle = c[1]; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = fontStr(L, 800, 34, 'num'); ctx.fillText(k, cx, cy - 4);
      ctx.font = fontStr(L, 700, 10.5, 'num'); ctx.fillText(c[2], cx, cy + 19);
    });
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  return { SPELL_L, FONTS, FONT_SETS, resolveFonts, fontsNeeded, defaultLayout, loadImage, computeFrame, draw, coverFit, containFit, styleFrame, gemRegions, kingFrame, kingBox, composeFormat, NAME_STYLES, GEMS, THEMES, gemKey, themeKey, DIRS };
})();
