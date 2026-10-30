/* Speicher: im Claude-Konto (db + assets) oder, wenn das nicht verfügbar ist, lokal im Browser (IndexedDB). */
window.WOK_STORE = (function () {
  'use strict';
  const S = { mode: 'none', canWrite: false, cards: new Map(), listeners: new Set(), db: null, assets: null, idb: null, urls: new Map() };

  function emit() { for (const f of S.listeners) try { f(); } catch (e) { console.error(e); } }
  function onChange(f) { S.listeners.add(f); return () => S.listeners.delete(f); }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function init() {
    if (window.WOK_DESKTOP) { try { await initDisk(); return S.mode; } catch (e) { console.warn('Dateispeicher nicht erreichbar', e); } }
    let tries = 0;
    while (!(window.claude && window.claude.use) && tries++ < 12) await sleep(250);
    if (window.claude && window.claude.use) {
      try {
        const [db, assets, user] = await Promise.all([window.claude.use('db'), window.claude.use('assets'), window.claude.use('user')]);
        if (db) {
          S.db = db; S.assets = assets; S.mode = 'cloud';
          const can = user ? await user.can('data.write') : null;
          S.canWrite = can !== false && !!assets;
          await new Promise((resolve) => {
            let first = true;
            db.collection('cards').onSnapshot(snap => {
              S.cards = new Map(snap.docs.map(d => [d.id, Object.assign({}, d.data(), { id: d.id })]));
              emit(); if (first) { first = false; resolve(); }
            }, err => { S.error = err && err.code; emit(); if (first) { first = false; resolve(); } });
            setTimeout(() => { if (first) { first = false; resolve(); } }, 8000);
          });
          return S.mode;
        }
      } catch (e) { console.warn('Claude-Speicher nicht verfügbar', e); }
    }
    await initLocal();
    return S.mode;
  }

  /* ---------- Windows-Version: Dateien im Ordner „Dokumente\War of Kings Kartenwerkstatt“ ---------- */
  async function api(method, path, body, type) {
    const r = await fetch('/api/' + path, { method, body, headers: type ? { 'Content-Type': type } : undefined });
    if (!r.ok) throw new Error(method + ' ' + path + ' ' + r.status);
    return r;
  }
  async function initDisk() {
    const all = await (await api('GET', 'cards')).json();
    S.cards = new Map(Object.entries(all).map(([k, v]) => [k, Object.assign({}, v, { id: k })]));
    S.mode = 'disk'; S.canWrite = true; emit();
  }

  /* ---------- IndexedDB ---------- */
  function idbOpen() {
    return new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open('wok-kartenwerkstatt', 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { const d = r.result; for (const n of ['cards', 'blobs', 'config']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  function tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = S.idb.transaction(store, mode), st = t.objectStore(store); let out;
      const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  async function initLocal() {
    try {
      S.idb = await idbOpen(); S.mode = 'local'; S.canWrite = true;
      const keys = await tx('cards', 'readonly', st => st.getAllKeys());
      const vals = await tx('cards', 'readonly', st => st.getAll());
      S.cards = new Map(keys.map((k, i) => [k, Object.assign({}, vals[i], { id: k })]));
    } catch (e) { S.mode = 'memory'; S.canWrite = true; S.mem = { blobs: new Map(), config: new Map() }; }
    emit();
  }

  /* ---------- Karten ---------- */
  function list() { return [...S.cards.values()]; }
  function get(id) { return S.cards.get(id) || null; }
  function newId() { return 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  async function put(card, keepUpdated) {
    const c = JSON.parse(JSON.stringify(card)); const id = c.id || newId(); delete c.id;
    c.updated = keepUpdated || Date.now(); if (!c.created) c.created = c.updated;
    if (S.mode === 'cloud') await S.db.collection('cards').doc(id).set(c);
    else if (S.mode === 'local') await tx('cards', 'readwrite', st => st.put(c, id));
    else if (S.mode === 'disk') await api('PUT', 'cards/' + id, JSON.stringify(c), 'application/json');
    S.cards.set(id, Object.assign({}, c, { id })); emit();
    return id;
  }
  async function del(id) {
    if (S.mode === 'cloud') await S.db.collection('cards').doc(id).delete();
    else if (S.mode === 'local') await tx('cards', 'readwrite', st => st.delete(id));
    else if (S.mode === 'disk') await api('DELETE', 'cards/' + id);
    S.cards.delete(id); emit();
  }

  /* ---------- Bilder (Originaldateien unverändert) ---------- */
  async function putImage(blob) {
    if (S.mode === 'cloud') {
      if (!S.assets) throw { code: 'not_granted' };
      const r = await S.assets.upload(blob);
      S.urls.set(r.id, r.url || ('/_blob/' + r.id));
      return { id: r.id, url: r.url || ('/_blob/' + r.id) };
    }
    if (S.mode === 'disk') {
      const r = await (await api('POST', 'blobs', blob, blob.type || 'application/octet-stream')).json();
      const u = '/api/blobs/' + r.id; S.urls.set(r.id, u); return { id: r.id, url: u };
    }
    const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    if (S.mode === 'local') await tx('blobs', 'readwrite', st => st.put(blob, id)); else S.mem.blobs.set(id, blob);
    const url = URL.createObjectURL(blob); S.urls.set(id, url);
    return { id, url };
  }
  async function imageURL(id) {
    if (!id) return null;
    if (S.urls.has(id)) return S.urls.get(id);
    if (S.mode === 'cloud') { const u = '/_blob/' + id; S.urls.set(id, u); return u; }
    if (S.mode === 'disk') { const u = '/api/blobs/' + id; S.urls.set(id, u); return u; }
    let blob = null;
    if (S.mode === 'local') blob = await tx('blobs', 'readonly', st => st.get(id)); else blob = S.mem.blobs.get(id);
    if (!blob) return null;
    const u = URL.createObjectURL(blob); S.urls.set(id, u); return u;
  }
  async function imageBlob(id) {
    const u = await imageURL(id); if (!u) return null;
    try { const r = await fetch(u); return await r.blob(); } catch (e) { return null; }
  }

  /* ---------- Einstellungen (Layout, eigene Wappen) ---------- */
  async function getConfig(key) {
    try {
      if (S.mode === 'cloud') { const d = await S.db.doc('config/' + key).get(); return d.exists ? d.data() : null; }
      if (S.mode === 'local') return (await tx('config', 'readonly', st => st.get(key))) || null;
      if (S.mode === 'disk') { const r = await fetch('/api/config/' + key); return r.ok ? await r.json() : null; }
      return S.mem.config.get(key) || null;
    } catch (e) { return null; }
  }
  async function setConfig(key, val) {
    const v = JSON.parse(JSON.stringify(val));
    if (S.mode === 'cloud') await S.db.doc('config/' + key).set(v);
    else if (S.mode === 'local') await tx('config', 'readwrite', st => st.put(v, key));
    else if (S.mode === 'disk') await api('PUT', 'config/' + key, JSON.stringify(v), 'application/json');
    else S.mem.config.set(key, v);
  }

  return { init, onChange, list, get, put, del, newId, putImage, imageURL, imageBlob, getConfig, setConfig, state: S };
})();
