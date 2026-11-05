/* WAR OF KINGS – 3D-Spielfeld (4.11.2026, Prototyp)
 * Echte 3D-Darstellung mit three.js: schräge Kamera auf das Spielfeld, Karten als Objekte mit Schatten und Licht,
 * Leuchten (Bloom), Animationen mit GSAP. Regeln und Bedienung bleiben unverändert: Antippen meldet Feld bzw. Held
 * an die Spieloberfläche (app.js), die wie bisher entscheidet. Ohne WebGL bleibt die 2D-Ansicht.
 * API: WOK_BOARD3D.mount(wrap, board, img, slots, handlers) · sync(view) · project(field) · shake() · unmount() · supported()
 */
(function (root) {
  const L = root.WOK_THREE, gsap = root.gsap;
  const api = { supported, mount, unmount, sync, project, shake, active: () => !!S, onEvents, setFit, _dbg: () => S, _hires: pr => { if (!S) return; S.renderer.setPixelRatio(pr); S.composer.setPixelRatio(pr); S.renderer.shadowMap.enabled = true; resize(); } };
  // Bildbereich (NDC −1…1), in den das Spielfeld eingepasst wird – auf der PC-Bühne bleibt Platz für Hand, Leisten und Seitenfelder
  let FIT = null;
  function setFit(f) { const sm = !!(f && f.smooth); if (f) { f = Object.assign({}, f); delete f.smooth; } const k = JSON.stringify(f || null); if (k === JSON.stringify(FIT)) return; FIT = f || null; if (S) resize(sm); }
  root.WOK_BOARD3D = api;
  if (!L || !gsap) return;
  const T = L.THREE;
  let S = null; // Szene

  function supported() { if (!L || !gsap) return false; try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

  const BOARD = 10; // Kantenlänge des Spielfelds in Szenen-Einheiten (Bild ist quadratisch)
  const uv2xz = (u, v) => [(u - .5) * BOARD, (v - .5) * BOARD];

  // ---------- Feuer (Shader, keine Bilddatei) ----------
  const FIRE_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const FIRE_FS = [
    'uniform float uT; uniform float uSeed; varying vec2 vUv;',
    'float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + 1.0), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }',
    'void main(){',
    '  vec2 uv = vUv; float t = uT * 1.7 + uSeed * 13.0;',
    '  vec2 q = vec2(uv.x * 3.2 + uSeed, uv.y * 2.4 - t);',
    '  float f = fbm(q + vec2(fbm(q * 1.6 + vec2(0.0, -t * 0.6)) * 1.3, 0.0));',
    '  float sway = (n(vec2(t * 0.8, uSeed)) - 0.5) * 0.18 * uv.y;',
    '  float w = 1.0 - abs(uv.x - 0.5 - sway) * 2.0;',
    '  float body = clamp(w * 1.35 - uv.y * 0.95, 0.0, 1.0);',
    '  float flame = clamp(body * (0.55 + f * 1.25) * 1.25 - uv.y * 0.25, 0.0, 1.0);',
    '  flame *= smoothstep(0.0, 0.08, uv.y);',
    '  vec3 col = mix(vec3(0.75, 0.10, 0.01), vec3(1.0, 0.48, 0.06), smoothstep(0.12, 0.45, flame));',
    '  col = mix(col, vec3(1.0, 0.82, 0.45), smoothstep(0.65, 0.98, flame));',
    '  float a = smoothstep(0.06, 0.32, flame);',
    '  gl_FragColor = vec4(col * (0.25 + flame * 0.85), a * 0.85);',
    '}'].join('\n');
  let EMBER_TEX = null;
  function emberTex() {
    if (EMBER_TEX) return EMBER_TEX; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,245,200,1)'); gr.addColorStop(.25, 'rgba(255,170,60,.9)'); gr.addColorStop(.6, 'rgba(255,90,20,.25)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); EMBER_TEX = new T.CanvasTexture(c); EMBER_TEX.colorSpace = T.SRGBColorSpace; return EMBER_TEX;
  }
  function makeFire(scene, x, z, i) {
    const u = { uT: { value: 0 }, uSeed: { value: i * 1.37 + .2 } }, meshes = [];
    for (let k = 0; k < 2; k++) { // zwei versetzte Flammen = mehr Volumen
      const mat = new T.ShaderMaterial({ uniforms: k ? { uT: u.uT, uSeed: { value: u.uSeed.value + 4.1 } } : u, vertexShader: FIRE_VS, fragmentShader: FIRE_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
      const fw = k ? .58 : .82, fh = k ? 1.05 : 1.4; const geo = new T.PlaneGeometry(fw, fh); geo.translate(0, fh / 2 - .05, 0);
      const m = new T.Mesh(geo, mat); m.position.set(x + (k ? .05 : 0), .02, z + (k ? .03 : 0)); m.renderOrder = 5; scene.add(m); meshes.push(m);
    }
    const glow = new T.Mesh(new T.CircleGeometry(.9, 32), new T.MeshBasicMaterial({ map: emberTex(), transparent: true, opacity: .35, depthWrite: false, blending: T.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2; glow.position.set(x, .015, z); scene.add(glow);
    return { x, z, u, meshes, glow, ph: i * 2.1 };
  }
  // Glut: steigt aus den Feuerschalen auf, dazu feine Funken über dem ganzen Feld
  function makeEmbers(scene, fires) {
    const N = 260, pos = new Float32Array(N * 3), P = [];
    for (let i = 0; i < N; i++) P.push(spawnEmber({}, fires, i, true));
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ map: emberTex(), size: .075, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, color: 0xffb060 });
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    return { P, pos, geo, fires, last: 0 };
  }
  function spawnEmber(e, fires, i, init) {
    const fromFire = i % 3 !== 0;
    if (fromFire) { const f = fires[i % fires.length]; e.x = f.x + (Math.random() - .5) * .3; e.z = f.z + (Math.random() - .5) * .3; e.y = .2 + Math.random() * .3; e.vy = .5 + Math.random() * .7; e.life = 1.6 + Math.random() * 1.8; }
    else { e.x = (Math.random() - .5) * BOARD; e.z = (Math.random() - .5) * BOARD; e.y = Math.random() * .4; e.vy = .12 + Math.random() * .25; e.life = 3 + Math.random() * 4; }
    e.vx = (Math.random() - .5) * .25; e.vz = (Math.random() - .5) * .15; e.age = init ? Math.random() * e.life : 0; e.fire = fromFire; return e;
  }
  function stepEmbers(E, t) {
    const dt = Math.min(.05, E.last ? t - E.last : .016); E.last = t; const a = E.pos;
    E.P.forEach((e, i) => {
      e.age += dt; if (e.age > e.life) spawnEmber(e, E.fires, i, false);
      e.x += (e.vx + Math.sin(t * 1.3 + i) * .12) * dt; e.z += e.vz * dt; e.y += e.vy * dt;
      const k = e.age / e.life, vis = k < .15 ? k / .15 : 1 - (k - .15) / .85; // ein- und ausblenden über die Höhe
      a[i * 3] = e.x; a[i * 3 + 1] = vis > .02 ? e.y : -5; a[i * 3 + 2] = e.z;
    });
    E.geo.attributes.position.needsUpdate = true;
  }

  function mount(wrap, board, img, slots, handlers) {
    if (S || !supported()) return !!S;
    const canvas = document.createElement('canvas'); canvas.className = 'b3d'; wrap.appendChild(canvas);
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    const LOW = /[?&]low3d=1/.test(root.location ? root.location.search : ''); // nur für Tests in Umgebungen ohne Grafikkarte: kleine Auflösung, ohne Schatten
    renderer.setPixelRatio(LOW ? .35 : Math.min(2, root.devicePixelRatio || 1));
    renderer.shadowMap.enabled = !LOW; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = T.SRGBColorSpace;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 100);
    // Licht: weiches Grundlicht, warmes Hauptlicht mit Schatten, vier flackernde Fackeln
    scene.add(new T.HemisphereLight(0xfff1d6, 0x2a2018, 0.85));
    const key = new T.DirectionalLight(0xffe2b8, 1.55); key.position.set(-3.5, 12, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 }); key.shadow.bias = -0.0008; key.shadow.radius = 4;
    scene.add(key);
    const torches = [[.085, .045], [.915, .045], [.085, .9], [.915, .9]].map(([u, v], i) => { const [x, z] = uv2xz(u, v); const l = new T.PointLight(0xff8a30, 4.5, 6.5, 1.6); l.position.set(x, 1.7, z); scene.add(l); return { l, base: 4.5, ph: i * 1.7 }; });
    // Echtes Feuer in den vier Feuerschalen des Spielfeldbilds + Glut, die aufsteigt (4.12)
    const fires = [[.111, .02], [.887, .022], [.111, .884], [.889, .884]].map(([u, v], i) => makeFire(scene, ...uv2xz(u, v), i));
    const embers = makeEmbers(scene, fires);
    const sideLight = new T.PointLight(0xffc97a, 0, 9, 1.4); sideLight.position.set(0, 2.2, 3.6); scene.add(sideLight);
    // Spielfeld
    const tex = new T.TextureLoader().load(img); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ground = new T.Mesh(new T.PlaneGeometry(BOARD, BOARD), new T.MeshStandardMaterial({ map: tex, roughness: .92, metalness: .05 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    // Unterlage unter dem Spielfeld (Tischkante)
    const base = new T.Mesh(new T.BoxGeometry(BOARD + .3, .5, BOARD + .3), new T.MeshStandardMaterial({ color: 0x18120c, roughness: .8 })); base.position.y = -.26; base.receiveShadow = true; scene.add(base);
    // Boden der Halle rund ums Spielfeld (dunkler Stein, vom Feuer angeleuchtet) – bis die Arena (Bild/Video) da ist
    { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.fillStyle = '#1b130d'; g.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 9000; i++) { const v = 18 + Math.random() * 26 | 0; g.fillStyle = 'rgba(' + (v + 12) + ',' + (v + 4) + ',' + v + ',' + (.25 + Math.random() * .35) + ')'; g.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1 + Math.random() * 3); }
      g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; for (let y = 0; y <= 512; y += 64) for (let x = (y / 64) % 2 ? 32 : 0; x <= 512; x += 128) { g.strokeRect(x, y, 128, 64); }
      const ft = new T.CanvasTexture(c); ft.wrapS = ft.wrapT = T.RepeatWrapping; ft.repeat.set(7, 7); ft.colorSpace = T.SRGBColorSpace; ft.anisotropy = 8;
      const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ map: ft, roughness: .95, metalness: 0 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.52; floor.receiveShadow = true; scene.add(floor); scene.userData.floor = floor;
      scene.fog = new T.Fog(0x070405, 14, 34); }
    // Arena (4.12): Video oder Bild hinter dem Spielfeld, an die Kamera gehängt und unverzerrt bildfüllend (wie object-fit: cover)
    let arena = null; const AR = root.WOK_ARENA;
    if (AR && (AR.video || AR.image)) {
      // Standbild sofort; das Video erst, wenn es wirklich läuft (iPhone im Stromsparmodus blockiert Videos – dann bleibt das Standbild)
      const ratio = AR.ratio || 16 / 9, still = AR.image ? new T.TextureLoader().load(AR.image) : null; if (still) still.colorSpace = T.SRGBColorSpace;
      const am = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: still, fog: false, depthWrite: false, depthTest: false, toneMapped: false, color: 0xd8d0c8 }));
      am.renderOrder = -10; am.visible = !!still; camera.add(am); scene.add(camera); arena = { mesh: am, ratio };
      if (AR.video) { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto'; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.src = AR.video;
        const vt = new T.VideoTexture(v); vt.colorSpace = T.SRGBColorSpace; arena.v = v;
        v.addEventListener('playing', () => { if (!S || !S.arena) return; am.material.map = vt; am.material.needsUpdate = true; am.visible = true; scene.userData.floor.visible = false; });
        const tryPlay = () => { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }; tryPlay();
        canvas.addEventListener('pointerdown', tryPlay, { once: true }); // manche Handys starten Videos erst nach dem ersten Antippen
      }
      if (still) scene.userData.floor.visible = false;
    }
    // Nachbearbeitung: Leuchten
    const composer = new L.EffectComposer(renderer); composer.addPass(new L.RenderPass(scene, camera));
    const bloom = new L.UnrealBloomPass(new T.Vector2(512, 512), .42, .45, .9); composer.addPass(bloom); composer.addPass(new L.OutputPass());
    const groups = { hl: new T.Group(), units: new T.Group(), fx: new T.Group() }; Object.values(groups).forEach(g => scene.add(g));
    S = { wrap, board, canvas, renderer, scene, camera, composer, bloom, key, torches, fires, embers, arena, sideLight, slots, handlers, groups, units: new Map(), hl: new Map(), tex: new Map(), lbl: new Map(), view: null, raf: 0, t0: performance.now(), shakeT: 0, ro: null };
    board.classList.add('b3d-on'); const vg = document.getElementById('v-game'); if (vg) vg.classList.add('v3d');
    S.ro = new ResizeObserver(resize); S.ro.observe(wrap); resize();
    input(); loop();
    return true;
  }
  function unmount() { if (!S) return; if (S.arena && S.arena.v) { try { S.arena.v.pause(); S.arena.v.removeAttribute('src'); S.arena.v.load(); } catch (e) {} } cancelAnimationFrame(S.raf); S.ro.disconnect(); S.renderer.dispose(); S.canvas.remove(); S.board.classList.remove('b3d-on'); const vg = document.getElementById('v-game'); if (vg) vg.classList.remove('v3d', 'duel', 'mstage'); S = null; }

  // Kamera: schräg von vorn auf das Feld, so eingestellt, dass das ganze Brett die Fläche füllt
  function resize(smooth) { if (smooth && typeof smooth !== 'boolean') smooth = false;
    if (!S) return; const r = S.board.getBoundingClientRect(), w = Math.max(50, r.width), h = Math.max(50, r.height);
    S.canvas.style.left = S.board.offsetLeft + 'px'; S.canvas.style.top = S.board.offsetTop + 'px'; S.canvas.style.width = w + 'px'; S.canvas.style.height = h + 'px';
    S.renderer.setSize(w, h, false); S.composer.setSize(w, h); S.camera.aspect = w / h;
    const ar = (w * (FIT ? (FIT.x[1] - FIT.x[0]) / 2 : 1)) / (h * (FIT ? (FIT.y[1] - FIT.y[0]) / 2 : 1)), tilt = FIT && FIT.tilt ? FIT.tilt : ar > 1.5 ? 0.72 : ar > 1.15 ? 0.62 : 0.5, look = new T.Vector3(0, 0, .2), half = BOARD / 2 + .05; // Neigung (Radiant von der Senkrechten)
    let ext = [-half, half, -half, half]; // Ausschnitt: ganzes Brett – oder (Handy-Bühne) nur die Felder, der Zierrand darf aus dem Bild
    if (FIT && FIT.cells && S.slots) { const xs = [], zs = []; for (const sl of Object.values(S.slots)) { const [x0, z0] = uv2xz(sl.x, sl.y), [x1, z1] = uv2xz(sl.x + sl.w, sl.y + sl.h); xs.push(x0, x1); zs.push(z0, z1); } const m = FIT.cells === true ? .15 : FIT.cells; ext = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...zs) - m, Math.max(...zs) + m * 2.2]; }
    const corners = [[ext[0], ext[2]], [ext[1], ext[2]], [ext[0], ext[3]], [ext[1], ext[3]]].map(([x, z]) => new T.Vector3(x, 0, z));
    S.camera.updateProjectionMatrix();
    const place = d => { S.camera.position.set(0, Math.cos(tilt) * d, Math.sin(tilt) * d + look.z); S.camera.lookAt(look); S.camera.updateMatrixWorld(); return corners.map(c => c.clone().project(S.camera)); };
    const F = FIT || { x: [-.995, .995], y: [-.985, .985] }, ym = (F.y[0] + F.y[1]) / 2;
    const fits = d => place(d).every(q => q.z > -1 && q.z < 1 && q.x >= F.x[0] && q.x <= F.x[1] && q.y >= F.y[0] && q.y <= F.y[1]);
    let dist = 6;
    for (let pass = 0; pass < 3; pass++) { // kleinster Abstand, bei dem das ganze Spielfeld ins Bild passt; dann senkrecht mittig ausrichten
      let lo = 2, hi = 40; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; } dist = hi;
      const qs = place(dist), mid = (Math.min(...qs.map(q => q.y)) + Math.max(...qs.map(q => q.y))) / 2;
      if (Math.abs(mid - ym) < .005) break; look.z -= (mid - ym) * 2.2; }
    place(dist);
    if (smooth === true && S.camPos && S.camLook && gsap) { const toP = S.camera.position.clone(), toL = look.clone(); S.camera.position.copy(S.camPos); S.camera.lookAt(S.camLook); // weiche Kamerafahrt
      gsap.to(S.camPos, { x: toP.x, y: toP.y, z: toP.z, duration: .65, ease: 'power2.inOut', overwrite: true }); gsap.to(S.camLook, { x: toL.x, y: toL.y, z: toL.z, duration: .65, ease: 'power2.inOut', overwrite: true, onUpdate: () => { if (S) { S.camera.position.copy(S.camPos); S.camera.lookAt(S.camLook); } } }); }
    else { S.camPos = S.camera.position.clone(); S.camLook = look; }
    if (S.scene.fog) { const cd = S.camera.position.distanceTo(look); S.scene.fog.near = cd + 5; S.scene.fog.far = cd + 26; } // Nebel erst hinter dem Spielfeld (sonst wird es bei weiter Kamera dunkel)
    if (S.arena) { const D = 40, hh = 2 * D * Math.tan(S.camera.fov * Math.PI / 360), ww = hh * S.camera.aspect; let aw = ww, ah = ww / S.arena.ratio; if (ah < hh) { ah = hh; aw = hh * S.arena.ratio; }
      S.arena.mesh.position.set(0, 0, -D); S.arena.mesh.scale.set(aw * 1.02, ah * 1.02, 1); }
  }
  function loop() {
    if (!S) return; S.raf = requestAnimationFrame(loop); const t = (performance.now() - S.t0) / 1000;
    for (const k of S.torches) k.l.intensity = k.base * (.82 + .1 * Math.sin(t * 7.3 + k.ph) + .08 * Math.sin(t * 13.1 + k.ph * 2));
    const cp = S.camera.position;
    for (const f of S.fires) { f.u.uT.value = t; for (const m of f.meshes) m.rotation.y = Math.atan2(cp.x - m.position.x, cp.z - m.position.z); f.glow.material.opacity = .3 + .08 * Math.sin(t * 9 + f.ph) + .08 * Math.sin(t * 23 + f.ph); }
    stepEmbers(S.embers, t);
    for (const g of S.units.values()) if (g.userData.atk) g.userData.rim.material.opacity = .75 + .25 * Math.sin(t * 6);
    for (const g of S.units.values()) if (g.userData.fxm && g.userData.fxm.visible) { const k = .42 * (1 + .12 * Math.sin(t * 4.5)); g.userData.fxm.scale.set(k, k, 1); g.userData.fxm.material.opacity = .8 + .2 * Math.sin(t * 4.5); }
    { const dt = Math.min(.05, S.lastT ? t - S.lastT : .016); S.lastT = t; stepAttacks(t, dt); }
    for (const m of S.hl.values()) if (m.material.userData.pulse) m.material.opacity = m.material.userData.op * (.72 + .28 * Math.sin(t * 4.2));
    if (S.shakeT > 0) { S.shakeT = Math.max(0, S.shakeT - 1 / 60); const a = S.shakeT * .18; S.camera.position.set(S.camPos.x + (Math.random() - .5) * a, S.camPos.y + (Math.random() - .5) * a, S.camPos.z + (Math.random() - .5) * a); S.camera.lookAt(S.camLook); }
    else if (S.camera.position.distanceToSquared(S.camPos) > 1e-6) { S.camera.position.copy(S.camPos); S.camera.lookAt(S.camLook); }
    S.composer.render();
  }
  function shake(s) { if (S) S.shakeT = Math.max(S.shakeT, s || .35); }

  // Feld → Szenen-Rechteck (Spieler unten = Sicht des eigenen Spielers; Spiegelung macht app.js über die Slot-Kennung)
  function slotRect(slotId) { const s = S && S.slots[slotId]; if (!s) return null; const [x0, z0] = uv2xz(s.x, s.y), [x1, z1] = uv2xz(s.x + s.w, s.y + s.h); return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 }; }
  // Bildschirm-Position eines Feldes in Prozent des Brett-Elements (für Pfeile, Einblendungen, Effekte)
  function project(slotId) {
    const R = slotRect(slotId); if (!R) return null; const pts = [[R.x - R.w / 2, R.z - R.d / 2], [R.x + R.w / 2, R.z - R.d / 2], [R.x - R.w / 2, R.z + R.d / 2], [R.x + R.w / 2, R.z + R.d / 2]].map(([x, z]) => new T.Vector3(x, .05, z).project(S.camera));
    const xs = pts.map(p => (p.x + 1) / 2 * 100), ys = pts.map(p => (1 - p.y) / 2 * 100), l = Math.min(...xs), t = Math.min(...ys);
    return { left: l, top: t, w: Math.max(...xs) - l, h: Math.max(...ys) - t };
  }

  // ---------- Texturen ----------
  function cardTex(key, url, name) {
    if (S.tex.has(key)) return S.tex.get(key);
    let t;
    if (url) { t = new T.TextureLoader().load(url); }
    else { const c = document.createElement('canvas'); c.width = 256; c.height = 360; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, '#3a2e22'); gr.addColorStop(1, '#16110b'); g.fillStyle = gr; g.fillRect(0, 0, 256, 360); g.fillStyle = '#ecd08f'; g.font = 'bold 34px serif'; g.textAlign = 'center'; (name || '').split(' ').slice(0, 3).forEach((w, i) => g.fillText(w, 128, 150 + i * 40)); t = new T.CanvasTexture(c); }
    t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; S.tex.set(key, t); return t;
  }
  function labelTex(text, col1, col2, king, side) {
    const k = text + col1 + col2 + king + (side ? side.lab : ''); if (S.lbl.has(k)) return S.lbl.get(k);
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.font = '800 74px "Barlow Semi Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const parts = king ? [[text, '#ffe6a8']] : text.split('/').map((p, i) => [p, i ? col2 : col1]);
    const widths = parts.map(p => g.measureText(p[0]).width), sep = king ? 0 : 34, total = widths.reduce((a, b) => a + b, 0) + sep;
    if (side) { const bw = Math.min(500, total + 70); const gr = g.createLinearGradient(0, 14, 0, 116); gr.addColorStop(0, side.lab); gr.addColorStop(1, '#0b0a0c'); g.fillStyle = gr; rr(g, 256 - bw / 2, 16, bw, 98, 40); g.fill(); g.lineWidth = 5; g.strokeStyle = side.labEdge; g.stroke(); }
    let x = 256 - total / 2;
    parts.forEach((p, i) => { const cx = x + widths[i] / 2; g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(p[0], cx, 67); g.fillStyle = p[1]; g.fillText(p[0], cx, 67); x += widths[i]; if (i === 0 && !king) { g.fillStyle = '#d9d2c2'; g.lineWidth = 10; g.strokeText('/', x + sep / 2, 67); g.fillText('/', x + sep / 2, 67); x += sep; } });
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; S.lbl.set(k, t); return t;
  }

  // ---------- Karten auf dem Feld ----------
  // 4.13: Seiten klar unterscheidbar – eigene Karten blau-silbern (wie die blauen Banner unten), Gegner dunkelrot (rote Banner oben),
  // Gegnerkarten stehen auf dem Kopf (zeigen zu ihrem Besitzer), Sockel + Wappen-Siegel in Seitenfarbe, Werte-Schild in Seitenfarbe.
  // Karten haben das echte Kartenformat 2:3 (nicht mehr gestaucht) und sind leicht zur Kamera aufgestellt.
  const SIDE = { me: { glow: 0x5aa8ff, plate: 0x14243a, emis: 0x0a1a33, lab: '#173a6e', labEdge: '#8cc4ff' }, foe: { glow: 0xff3a2e, plate: 0x3a1010, emis: 0x2a0606, lab: '#6e1717', labEdge: '#ff9a8a' } };
  const TILT = .3; // Aufstellwinkel der Karten (Radiant)
  const edgeMat = () => new T.MeshStandardMaterial({ color: 0x2a1f12, roughness: .5, metalness: .6 });
  function frameTex() { // leuchtender Rahmen (Mitte durchsichtig)
    if (FXT.frame) return FXT.frame; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    for (let k = 0; k < 18; k++) { g.strokeStyle = 'rgba(255,255,255,' + (0.06 + (k === 9 ? .6 : 0)) + ')'; g.lineWidth = 2 + k * 1.6; rr(g, 26, 26, 204, 204, 22); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 5; rr(g, 26, 26, 204, 204, 22); g.stroke();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return (FXT.frame = t);
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function crestTex(foe) { // Wappen-Siegel: Schild mit Krone, blau/silber bzw. rot/schwarz
    const key = foe ? 'crestF' : 'crestM'; if (FXT[key]) return FXT[key]; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.beginPath(); g.moveTo(64, 8); g.lineTo(114, 22); g.lineTo(110, 70); g.quadraticCurveTo(100, 104, 64, 122); g.quadraticCurveTo(28, 104, 18, 70); g.lineTo(14, 22); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, 128); if (foe) { gr.addColorStop(0, '#c4302a'); gr.addColorStop(1, '#5a0c0c'); } else { gr.addColorStop(0, '#4f94e8'); gr.addColorStop(1, '#173f7a'); }
    g.fillStyle = gr; g.fill(); g.lineWidth = 7; g.strokeStyle = foe ? '#2a0a08' : '#dfe8f4'; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#e9c46a'; g.stroke();
    g.fillStyle = foe ? '#1a0606' : '#f6e7b6'; g.font = 'bold 58px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♛', 64, 66);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return (FXT[key] = t);
  }
  function boltTex() { // ⚡-Zeichen: diese Karte kann gerade einen Effekt einsetzen
    if (FXT.bolt) return FXT.bolt; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 10, 64, 64, 62); gr.addColorStop(0, 'rgba(255,230,140,.95)'); gr.addColorStop(.45, 'rgba(255,170,40,.55)'); gr.addColorStop(1, 'rgba(255,140,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.beginPath(); g.arc(64, 64, 34, 0, 7); g.fillStyle = '#1a1008'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#ffd25a'; g.stroke();
    g.fillStyle = '#ffe27a'; g.beginPath(); g.moveTo(70, 38); g.lineTo(50, 68); g.lineTo(63, 68); g.lineTo(56, 92); g.lineTo(80, 58); g.lineTo(66, 58); g.closePath(); g.fill();
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return (FXT.bolt = t); }
  function makeUnit(u) {
    const R = slotRect(u.slot), side = u.foe ? SIDE.foe : SIDE.me;
    const h = Math.min(R.d * 1.02, R.w * 1.5 * .86), w = h * 2 / 3;
    const g = new T.Group();
    // Sockel (Platte in Seitenfarbe) + leuchtender Rahmen
    const plate = new T.Mesh(new T.PlaneGeometry(R.w * .92, R.d * .92), new T.MeshStandardMaterial({ color: side.plate, emissive: side.emis, roughness: .45, metalness: .7, transparent: true, opacity: .92 }));
    plate.rotation.x = -Math.PI / 2; plate.position.y = .008; plate.receiveShadow = true; g.add(plate);
    const rim = new T.Mesh(new T.PlaneGeometry(R.w * 1.06, R.d * 1.06), new T.MeshBasicMaterial({ map: frameTex(), color: side.glow, transparent: true, opacity: .8, depthWrite: false, blending: T.AdditiveBlending }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = .014; g.add(rim);
    // Karte: aufgestellt um die vordere Kante, Gegnerkarte auf dem Kopf
    let tex = cardTex(u.cid, u.img, u.name); if (u.foe) { const k = u.cid + '|kopf'; if (!S.tex.has(k)) { const t2 = tex.clone(); t2.center.set(.5, .5); t2.rotation = Math.PI; t2.needsUpdate = true; S.tex.set(k, t2); } tex = S.tex.get(k); }
    const top = new T.MeshStandardMaterial({ map: tex, roughness: .5, metalness: .08 });
    const pivot = new T.Group(); pivot.position.set(0, 0, h / 2 - .02); pivot.rotation.x = TILT; g.add(pivot);
    const card = new T.Mesh(new T.BoxGeometry(w, .06, h), [edgeMat(), edgeMat(), top, edgeMat(), edgeMat(), edgeMat()]);
    card.castShadow = true; card.receiveShadow = true; card.position.set(0, .05, -h / 2); pivot.add(card);
    // Wappen-Siegel an der vorderen linken Ecke
    const crest = new T.Mesh(new T.PlaneGeometry(R.w * .24, R.w * .24), new T.MeshBasicMaterial({ map: crestTex(u.foe), transparent: true, depthWrite: false }));
    crest.rotation.x = -Math.PI / 2 + .6; crest.position.set(-R.w * .4, .12, R.d * .36); crest.renderOrder = 3; g.add(crest);
    // große Werte vor der Karte, auf einem Schild in Seitenfarbe
    const lab = new T.Mesh(new T.PlaneGeometry(R.w * 1.0, R.w * 1.0 / 4), new T.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    lab.rotation.x = -Math.PI / 2 + .62; lab.position.set(R.w * .06, .2, R.d * .42); lab.renderOrder = 4; g.add(lab);
    g.userData = { uid: u.uid, card, pivot, plate, rim, crest, lab, w, d: h, key: '', foe: !!u.foe, side };
    g.position.set(R.x, 0, R.z); S.groups.units.add(g); return g;
  }
  function updUnit(g, u) {
    const k = u.stat + '|' + u.atkCls + '|' + u.defCls;
    g.userData.lab.visible = !!u.stat && g.userData.card.visible; // König: Leben stehen in der Leiste
    if (g.userData.key !== k && u.stat) { g.userData.key = k; const col = c => c === 'up' ? '#7dff9a' : c === 'down' ? '#ff8a7a' : null; g.userData.lab.material.map = labelTex(u.stat, col(u.atkCls) || '#ffd2c8', col(u.defCls) || '#d4e8ff', u.king, g.userData.side); g.userData.lab.material.needsUpdate = true; }
    const lift = u.sel ? .3 : 0; gsap.to(g.position, { y: lift, duration: .18, overwrite: 'auto' });
    const rim = g.userData.rim.material; rim.opacity = u.sel ? 1 : u.target || u.gtarget || u.csel ? .95 : .7;
    rim.color.set(u.target ? 0xffffff : u.gtarget ? 0xb070ff : u.csel ? 0xd7a6ff : u.atk ? (u.foe ? 0xff2a4a : 0xff8a2a) : g.userData.side.glow); if (u.atk) rim.opacity = 1;
    g.userData.atk = !!u.atk;
    if (u.fxr && !g.userData.fxm) { const sp = new T.Sprite(new T.SpriteMaterial({ map: boltTex(), transparent: true, depthTest: false, depthWrite: false, fog: false })); sp.scale.set(.42, .42, 1); sp.position.set(g.userData.w * .5, .75, -g.userData.d * .25); sp.renderOrder = 22; g.add(sp); g.userData.fxm = sp; }
    if (g.userData.fxm) g.userData.fxm.visible = !!u.fxr;
    g.userData.target = !!u.target;
  }

  // ---------- Hervorhebungen (Beschwören, Laufen, Ziele) ----------
  const HLCOL = { 'hl-summon': 0xffc84a, 'hl-move': 0x4fe08a, 'hl-csel': 0xc58bff, 'hl-cast': 0xb070ff, 'hl-target': 0xff3a2a };

  // ---------- Abgleich mit dem Spielzustand ----------
  // view = { units: [{uid, slot, cid, img, name, foe, king, stat, atkCls, defCls, sel, target, gtarget, csel}], hl: {key: cls}, myturn, counter }
  function sync(view) {
    if (!S) return; resize(); const seen = new Set();
    for (const u of view.units) {
      seen.add(u.uid); let g = S.units.get(u.uid);
      if (!g) { g = makeUnit(u); S.units.set(u.uid, g); g.userData.slot = u.slot; if (S.view) dropIn(g); }
      else if (g.userData.slot !== u.slot) { const R = slotRect(u.slot); g.userData.slot = u.slot; if (R) { gsap.to(g.position, { x: R.x, z: R.z, duration: .42, ease: 'power2.inOut' }); gsap.fromTo(g.userData.card.position, { y: .05 }, { y: .6, duration: .21, yoyo: true, repeat: 1, ease: 'sine.out' }); } }
      updUnit(g, u);
    }
    for (const [uid, g] of S.units) if (!seen.has(uid)) { S.units.delete(uid); dieOut(g); }
    setHLSlots(view.hl || {}); // Schlüssel = Slot-Kennung (Spiegelung für Spieler 2 macht app.js)
    try { setAttacks(view.attacks || [], view.cand || []); } catch (e) { console.warn('[3D] Pfeile', e); }
    S.sideLight.intensity = view.myturn ? 10 : 0; S.sideLight.color.set(view.counter ? 0x6fa8ff : 0xffc97a);
    S.view = view;
  }
  function setHLSlots(m) { const map = {}; for (const [slot, cls] of Object.entries(m)) map[slot] = cls; for (const [k, mesh] of S.hl) if (!map[k]) { S.groups.hl.remove(mesh); mesh.geometry.dispose(); S.hl.delete(k); }
    for (const [slot, cls] of Object.entries(map)) { const col = HLCOL[cls] || 0xffffff; let mesh = S.hl.get(slot); if (!mesh) { const R = slotRect(slot); if (!R) continue; mesh = new T.Mesh(new T.PlaneGeometry(R.w * .96, R.d * .96), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .4, depthWrite: false, blending: T.AdditiveBlending })); mesh.rotation.x = -Math.PI / 2; mesh.position.set(R.x, .02, R.z); mesh.material.userData = { pulse: true, op: .42 }; S.groups.hl.add(mesh); S.hl.set(slot, mesh); } mesh.material.color.set(col); } }

  // ---------- Angriffe (4.13): leuchtende Bögen mit Spitze und Nummer, Ausgang groß über dem Ziel, Fadenkreuz am Ziel ----------
  const ATKCOL = { mine: 0xff8a2a, foe: 0xff2a4a, king: 0xffd24a };
  const OUTTXT = { win: ['BESIEGT', '#7dff9a'], lose: ['FÄLLT SELBST', '#ff7a6a'], both: ['BEIDE FALLEN', '#ffb35a'], none: ['WIRKUNGSLOS', '#c8c8c8'] };
  function stripeTex() { if (FXT.stripe) return FXT.stripe; const c = document.createElement('canvas'); c.width = 128; c.height = 16; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,.35)'); gr.addColorStop(.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,.35)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 16);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return (FXT.stripe = t); }
  function reticleTex() { if (FXT.ret) return FXT.ret; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), m = 128; g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8;
    g.lineWidth = 9; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(m, m, 96, k * Math.PI / 2 + .25, k * Math.PI / 2 + Math.PI / 2 - .25); g.stroke(); }
    g.lineWidth = 7; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.beginPath(); g.moveTo(m + Math.cos(a) * 70, m + Math.sin(a) * 70); g.lineTo(m + Math.cos(a) * 118, m + Math.sin(a) * 118); g.stroke(); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return (FXT.ret = t); }
  function textSprite(text, col, bg, scale) { // Schild mit Text (immer zur Kamera)
    const key = 'ts|' + text + col + bg; let tex = FXT[key];
    if (!tex) { const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d'); g.font = '800 70px "Barlow Semi Condensed", Arial Narrow, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const w = Math.min(500, g.measureText(text).width + 64); const gr = g.createLinearGradient(0, 12, 0, 116); gr.addColorStop(0, bg); gr.addColorStop(1, '#0b0908'); g.fillStyle = gr; rr(g, 256 - w / 2, 12, w, 104, 34); g.fill(); g.lineWidth = 5; g.strokeStyle = col; g.stroke();
      g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineJoin = 'round'; g.strokeText(text, 256, 66); g.fillStyle = col; g.fillText(text, 256, 66); tex = FXT[key] = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; }
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false })); sp.scale.set(scale, scale / 4, 1); sp.renderOrder = 20; return sp;
  }
  function numSprite(n, col) { const key = 'num|' + n + col; let tex = FXT[key];
    if (!tex) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.beginPath(); g.arc(64, 64, 52, 0, 7); g.fillStyle = '#120c08'; g.fill(); g.lineWidth = 9; g.strokeStyle = col; g.stroke();
      g.font = '800 70px "Barlow Semi Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(n), 64, 68); tex = FXT[key] = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; }
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false })); sp.scale.set(.42, .42, 1); sp.renderOrder = 21; return sp; }
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  function outLabel(out) { if (!out) return null; if (out.kind === 'king') return ['−' + Number(out.dmg).toLocaleString('de-DE'), '#ffe08a', '#5a3a08']; const o = OUTTXT[out.kind]; return o ? [o[0], o[1], out.kind === 'win' ? '#0f3a1c' : out.kind === 'lose' ? '#4a0d0a' : out.kind === 'both' ? '#4a2a08' : '#2a2a2a'] : null; }
  function setAttacks(list, cand) {
    if (!S.atk) { S.atk = { g: new T.Group(), key: '' }; S.scene.add(S.atk.g); }
    const key = JSON.stringify([list.map(a => [a.from, a.to, a.n, a.mine, a.king, a.out && a.out.kind, a.out && a.out.dmg]), cand.map(c => [c.to, c.out && c.out.kind, c.out && c.out.dmg])]);
    if (key === S.atk.key) return; S.atk.key = key;
    const G = S.atk.g; for (const ch of [...G.children]) { G.remove(ch); ch.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
    for (const st of S.atk.flow || []) st.dispose(); S.atk.flow = []; S.atk.spin = [];
    const lab = new Map(); // Ziel-Slot → Liste der Ausgänge
    for (const a of list) {
      const A = slotRect(a.from), B = slotRect(a.to); if (!A || !B) continue; const col = a.king ? ATKCOL.king : a.mine ? ATKCOL.mine : ATKCOL.foe;
      const p0 = new T.Vector3(A.x, .45, A.z), p2 = new T.Vector3(B.x, .45, B.z), dist = p0.distanceTo(p2), mid = p0.clone().add(p2).multiplyScalar(.5); mid.y += .9 + dist * .28;
      const curve = new T.QuadraticBezierCurve3(p0, mid, p2), pts = []; for (let k = 0; k <= 40; k++) { const t = .1 + (.84 - .1) * k / 40; pts.push(curve.getPoint(t)); }
      const path = new T.CatmullRomCurve3(pts), st = stripeTex().clone(); st.needsUpdate = true; st.repeat.set(Math.max(2, dist * 1.6), 1);
      const core = new T.Mesh(new T.TubeGeometry(path, 48, .055, 10, false), new T.MeshBasicMaterial({ map: st, color: col, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      const glow = new T.Mesh(new T.TubeGeometry(path, 48, .14, 10, false), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .22, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      const end = curve.getPoint(.84), tan = curve.getTangent(.84).normalize();
      const head = new T.Mesh(new T.ConeGeometry(.2, .46, 18), new T.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      head.position.copy(end).addScaledVector(tan, .12); head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), tan);
      const num = numSprite(a.n, hex(col)); num.position.copy(curve.getPoint(dist < 2.2 ? .2 : .45)).add(new T.Vector3(0, .22, 0));
      const ret = new T.Mesh(new T.PlaneGeometry(B.w * 1.25, B.w * 1.25), new T.MeshBasicMaterial({ map: reticleTex(), color: col, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
      ret.rotation.x = -Math.PI / 2; ret.position.set(B.x, .03, B.z);
      G.add(glow, core, head, num, ret); S.atk.flow.push(st); S.atk.spin.push(ret);
      const L = outLabel(a.out); if (L) { if (!lab.has(a.to)) lab.set(a.to, []); lab.get(a.to).push(L); }
    }
    for (const c of cand) { if (lab.has(c.to)) continue; const L = outLabel(c.out); if (L) lab.set(c.to, [L.concat([.75])]); } // mögliche Ziele beim Zielen (etwas kleiner)
    for (const [slot, Ls] of lab) { const B = slotRect(slot); if (!B) continue; Ls.forEach((L, k) => { const sp = textSprite(L[0], L[1], L[2], (L[3] || 1) * 1.25); sp.position.set(B.x, .9 + k * .34, B.z - B.d * .22); G.add(sp); }); }
  }
  function stepAttacks(t, dt) { if (!S.atk) return; for (const st of S.atk.flow || []) st.offset.x -= dt * 1.6; for (const r of S.atk.spin || []) { r.rotation.z += dt * .9; const k = 1 + .06 * Math.sin(t * 5); r.scale.set(k, k, k); } }

  // ---------- Animationen ----------
  // ---------- Effekte (4.12, ohne Bilddateien): weiche Texturen aus Canvas ----------
  const FXT = {};
  function fxTex(kind) {
    if (FXT[kind]) return FXT[kind]; const c = document.createElement('canvas'), N = kind === 'sigil' ? 512 : 128; c.width = c.height = N; const g = c.getContext('2d'), m = N / 2;
    if (kind === 'glow') { const gr = g.createRadialGradient(m, m, 0, m, m, m); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
    if (kind === 'shock') { const gr = g.createRadialGradient(m, m, m * .45, m, m, m); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.6, 'rgba(255,255,255,.55)'); gr.addColorStop(.78, 'rgba(255,255,255,.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
    if (kind === 'smoke') { for (let k = 0; k < 14; k++) { const x = m + (Math.random() - .5) * m * .7, y = m + (Math.random() - .5) * m * .7, r = m * (.35 + Math.random() * .35); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); } }
    if (kind === 'spark') { const gr = g.createRadialGradient(m, m, 0, m, m, m); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.15, 'rgba(255,220,140,.9)'); gr.addColorStop(.5, 'rgba(255,150,40,.25)'); gr.addColorStop(1, 'rgba(255,100,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
    if (kind === 'beam') { const gr = g.createLinearGradient(0, N, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N);
      const sx = g.createLinearGradient(0, 0, N, 0); sx.addColorStop(0, 'rgba(0,0,0,1)'); sx.addColorStop(.5, 'rgba(0,0,0,0)'); sx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = sx; g.fillRect(0, 0, N, N); }
    if (kind === 'sigil') { // Beschwörungskreis: zwei Ringe, Runenzeichen, Stern
      g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.lineWidth = 6; g.beginPath(); g.arc(m, m, m * .92, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(m, m, m * .78, 0, 7); g.stroke(); g.beginPath(); g.arc(m, m, m * .36, 0, 7); g.stroke();
      g.lineWidth = 3; g.beginPath(); for (let k = 0; k <= 6; k++) { const a = -Math.PI / 2 + k * Math.PI * 4 / 6 * 1.25 * .8; const r = m * .76; const x = m + Math.cos(-Math.PI / 2 + k * 2.513) * r, y = m + Math.sin(-Math.PI / 2 + k * 2.513) * r; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      g.font = 'bold ' + (m * .12 | 0) + 'px serif'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; const R = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
      for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; g.save(); g.translate(m + Math.cos(a) * m * .85, m + Math.sin(a) * m * .85); g.rotate(a + Math.PI / 2); g.fillText(R[k], 0, 0); g.restore(); } }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return (FXT[kind] = t);
  }
  const addMat = (tex, col, op) => new T.MeshBasicMaterial({ map: fxTex(tex), color: col, transparent: true, opacity: op == null ? 1 : op, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false });
  const gone = m => { if (!S) return; m.parent && m.parent.remove(m); m.geometry && m.geometry.dispose(); m.material && m.material.dispose(); };
  function groundFx(x, z, tex, col, size, from, to, dur, op, y) { // flacher Effekt auf dem Boden (Kreis, Druckwelle, Leuchten)
    const m = new T.Mesh(new T.PlaneGeometry(size, size), addMat(tex, col, op)); m.rotation.x = -Math.PI / 2; m.position.set(x, y || .03, z); m.scale.setScalar(from); S.groups.fx.add(m);
    gsap.to(m.scale, { x: to, y: to, z: to, duration: dur, ease: 'power2.out' }); gsap.to(m.material, { opacity: 0, duration: dur * .9, delay: dur * .1, ease: 'power1.in', onComplete: () => gone(m) }); return m;
  }
  function particles(x, y, z, o) { // Sprites fliegen auseinander (Staub, Funken, Splitter)
    for (let k = 0; k < o.n; k++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: fxTex(o.tex), color: o.col, transparent: true, opacity: o.op || 1, depthWrite: false, blending: o.normal ? T.NormalBlending : T.AdditiveBlending, fog: false }));
      const a = Math.random() * Math.PI * 2, sp0 = o.speed * (.5 + Math.random() * .8), sz = o.size * (.6 + Math.random() * .8), life = o.life * (.7 + Math.random() * .6);
      sp.position.set(x + Math.cos(a) * o.r0, y, z + Math.sin(a) * o.r0); sp.scale.setScalar(sz * (o.grow ? .4 : 1)); S.groups.fx.add(sp);
      gsap.to(sp.position, { x: sp.position.x + Math.cos(a) * sp0, z: sp.position.z + Math.sin(a) * sp0, y: y + o.up * (.4 + Math.random()), duration: life, ease: 'power2.out' });
      if (o.grow) gsap.to(sp.scale, { x: sz, y: sz, duration: life, ease: 'power1.out' });
      gsap.to(sp.material, { opacity: 0, duration: life * .8, delay: life * .2, onComplete: () => { if (S) S.groups.fx.remove(sp); sp.material.dispose(); } });
    }
  }
  function pillar(x, z, col, h) { // Lichtsäule
    const m = new T.Mesh(new T.PlaneGeometry(1.3, h), addMat('beam', col, 0)); m.position.set(x, h / 2, z); const cp = S.camera.position; m.rotation.y = Math.atan2(cp.x - x, cp.z - z); S.groups.fx.add(m);
    gsap.to(m.material, { opacity: .75, duration: .18 }); gsap.to(m.scale, { x: .25, duration: .8, delay: .2, ease: 'power2.in' }); gsap.to(m.material, { opacity: 0, duration: .45, delay: .5, onComplete: () => gone(m) });
  }
  function flash(x, z, col, power) {
    const l = new T.PointLight(col || 0xffc070, power || 30, 5, 1.5); l.position.set(x, 1, z); S.scene.add(l);
    gsap.to(l, { intensity: 0, duration: .5, ease: 'power2.out', onComplete: () => S && S.scene.remove(l) });
  }
  // Beschwören: Runenkreis leuchtet auf und dreht sich, Lichtsäule, Karte fällt durch, Staubwolke + Druckwelle + Funken beim Aufprall
  function dropIn(g) {
    const c = g.userData.card, x = g.position.x, z = g.position.z, col = g.userData.foe ? 0xff6a4a : 0xffc66a;
    c.position.y = 3.6; c.rotation.x = -.55; c.rotation.z = .3; c.visible = false; g.userData.rim.material.opacity = 0; g.userData.lab.visible = false; g.userData.crest.visible = false;
    const sig = groundFx(x, z, 'sigil', col, 1.7, .3, 1, .01, 1, .025); gsap.killTweensOf(sig.scale); gsap.killTweensOf(sig.material); sig.material.opacity = 0;
    gsap.to(sig.material, { opacity: .95, duration: .25 }); gsap.to(sig.scale, { x: 1, y: 1, z: 1, duration: .35, ease: 'back.out(2)' }); gsap.to(sig.rotation, { z: 2.4, duration: 1.6, ease: 'power1.out' });
    gsap.to(sig.material, { opacity: 0, duration: .6, delay: .95, onComplete: () => gone(sig) });
    pillar(x, z, col, 4.5); flash(x, z, col, 18);
    gsap.delayedCall(.28, () => { if (!S) return; c.visible = true;
      gsap.to(c.position, { y: .05, duration: .36, ease: 'power3.in', onComplete: () => { if (!S) return; shake(.25); g.userData.lab.visible = true; g.userData.crest.visible = true;
        groundFx(x, z, 'shock', 0xfff0c8, 1, .5, 3.6, .55, .9); groundFx(x, z, 'glow', col, 1.6, .6, 1.6, .5, .8);
        particles(x, .12, z, { n: 16, tex: 'smoke', col: 0x9a8670, size: .9, speed: 1.1, up: .35, life: 1.1, r0: .25, grow: true, normal: true, op: .55 });
        particles(x, .2, z, { n: 18, tex: 'spark', col: 0xffd08a, size: .16, speed: 1.4, up: 1.2, life: .7, r0: .1 }); flash(x, z, 0xffd9a0, 26); } });
      gsap.to(c.rotation, { x: 0, z: 0, duration: .36, ease: 'power2.in' });
      gsap.to(g.userData.rim.material, { opacity: .7, duration: .3, delay: .36 }); });
  }
  // Zerstören: Karte bekommt einen Riss, zerspringt in Splitter, dunkler Rauch, rote Glut
  function dieOut(g) {
    const c = g.userData.card, x = g.position.x, z = g.position.z, mats = Array.isArray(c.material) ? c.material : [c.material], top = mats[2] && mats[2].map;
    gsap.to(c.position, { y: .35, duration: .14, ease: 'power2.out' }); gsap.to(c.rotation, { z: .08, duration: .07, yoyo: true, repeat: 3 });
    gsap.delayedCall(.2, () => { if (!S) return; c.visible = false; g.userData.lab.visible = false; g.userData.crest.visible = false; g.userData.plate.visible = false; gsap.to(g.userData.rim.material, { opacity: 0, duration: .2 });
      const n = 4, w = g.userData.w / n, d = g.userData.d / n; // Splitter mit dem Kartenbild
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const geo = new T.PlaneGeometry(w, d); const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + uv.getX(k)) / n, 1 - (j + 1 - uv.getY(k)) / n);
        const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: top || null, color: top ? 0xffffff : 0x553322, transparent: true, side: T.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(x - g.userData.w / 2 + w * (i + .5), .38, z - g.userData.d / 2 + d * (j + .5)); S.groups.fx.add(m);
        const dx = m.position.x - x, dz = m.position.z - z, life = .7 + Math.random() * .4;
        gsap.to(m.position, { x: m.position.x + dx * 2.4 + (Math.random() - .5) * .4, z: m.position.z + dz * 2.4 + (Math.random() - .5) * .4, y: .4 + Math.random() * 1.4, duration: life, ease: 'power2.out' });
        gsap.to(m.rotation, { x: m.rotation.x + (Math.random() - .5) * 6, y: (Math.random() - .5) * 6, z: (Math.random() - .5) * 6, duration: life });
        gsap.to(m.material, { opacity: 0, duration: .35, delay: life - .3, onComplete: () => gone(m) });
      }
      particles(x, .3, z, { n: 14, tex: 'smoke', col: 0x2a2220, size: 1.1, speed: .9, up: .9, life: 1.3, r0: .2, grow: true, normal: true, op: .7 });
      particles(x, .3, z, { n: 20, tex: 'spark', col: 0xff6a3a, size: .15, speed: 1.6, up: 1.1, life: .8, r0: .1 });
      groundFx(x, z, 'glow', 0xff4a2a, 1.6, .5, 1.8, .6, .9); flash(x, z, 0xff5030, 24); shake(.3); });
    setTimeout(() => S && S.groups.units.remove(g), 1300);
  }
  function ring(x, z, col) { if (!S) return; groundFx(x, z, 'shock', col, 1, .4, 3.2, .5, .85); groundFx(x, z, 'glow', col, 1.4, .6, 1.4, .45, .7); }
  function hitFx(x, z, col) { if (!S) return; groundFx(x, z, 'shock', 0xffffff, 1, .4, 3.4, .45, .9); particles(x, .35, z, { n: 22, tex: 'spark', col: col || 0xffc070, size: .17, speed: 1.8, up: 1.3, life: .6, r0: .05 }); flash(x, z, col || 0xffc070, 34); }
  // Kampf: Angreifer stößt auf das Ziel und zurück, Treffer-Blitz und Kamerawackeln
  function onEvents(evs, uidSlot) {
    if (!S) return;
    for (const e of evs) {
      if (e.t === 'combat') e.hits.forEach((h, i) => { const A = S.units.get(h.a), Tg = S.units.get(h.t) || null; const tp = Tg ? Tg.position : (uidSlot[h.t] && slotRect(uidSlot[h.t])); if (!A || !tp) return;
        const ax = A.position.x, az = A.position.z, tx = tp.x, tz = tp.z;
        gsap.timeline({ delay: i * .12 }).to(A.position, { x: ax + (tx - ax) * .72, z: az + (tz - az) * .72, y: .5, duration: .2, ease: 'power3.in', onComplete: () => { shake(.4); hitFx(tx, tz, A.userData.foe ? 0xff7a50 : 0xffc070); } }).to(A.position, { x: ax, z: az, y: 0, duration: .32, ease: 'power2.out' }); });
      if (e.t === 'kingDamage') { shake(.5); }
      if (e.t === 'cast' || e.t === 'spellFx') { const g = e.uid && S.units.get(e.uid); if (g) { ring(g.position.x, g.position.z, 0xb88cff); flash(g.position.x, g.position.z, 0x9a6bff); } }
    }
  }

  // ---------- Eingabe: Antippen → Feld/Held, Gedrückthalten → große Ansicht ----------
  function input() {
    const ray = new T.Raycaster(), p = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
    const pick = ev => { const r = S.canvas.getBoundingClientRect(); p.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(p, S.camera);
      // zuerst Karten (auch angehobene), dann Boden
      const hits = ray.intersectObjects(S.groups.units.children, true); if (hits.length) { let o = hits[0].object; while (o && !o.userData.uid) o = o.parent; if (o) return { uid: o.userData.uid, slot: o.userData.slot }; }
      if (!ray.ray.intersectPlane(plane, hit)) return null; const u = hit.x / BOARD + .5, v = hit.z / BOARD + .5;
      for (const [id, s] of Object.entries(S.slots)) if (u >= s.x && u <= s.x + s.w && v >= s.y && v <= s.y + s.h) return { slot: id };
      return null; };
    let press = 0, down = null, longDone = false;
    S.canvas.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY }; longDone = false; clearTimeout(press); const t = pick(ev); press = setTimeout(() => { if (t) { longDone = true; S.handlers.long(t); } }, 480); });
    S.canvas.addEventListener('pointermove', ev => { if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 10) clearTimeout(press); });
    S.canvas.addEventListener('pointerup', () => clearTimeout(press));
    S.canvas.addEventListener('pointerleave', () => clearTimeout(press));
    S.canvas.addEventListener('click', ev => { if (longDone) { longDone = false; return; } const t = pick(ev); if (!t) return; S.handlers.tap(t, ev); });
    S.canvas.addEventListener('dblclick', ev => { const t = pick(ev); if (t) S.handlers.long(t); });
    S.canvas.addEventListener('contextmenu', ev => ev.preventDefault());
    let hov = null; S.canvas.addEventListener('pointermove', ev => { if (ev.pointerType !== 'mouse') return; const t = pick(ev); const uid = t && t.uid || null; if (uid !== hov) { hov = uid; S.canvas.style.cursor = t ? 'pointer' : 'default'; for (const [id, g] of S.units) if (!g.userData.sel) gsap.to(g.userData.card.position, { y: id === uid ? .14 : .05, duration: .12 }); if (S.handlers.hover) S.handlers.hover(uid); } });
    S.canvas.addEventListener('pointerleave', () => { if (hov && S && S.handlers.hover) S.handlers.hover(null); hov = null; });
  }
})(typeof window !== 'undefined' ? window : globalThis);
