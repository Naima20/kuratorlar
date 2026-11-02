// sql.js (brauzerdagi SQLite) adapteri + IndexedDB'ga saqlash. API server adapteri bilan bir xil.
import schema from '../db/schema.js';
import { migrate } from '../db/migrate.js';

const IDB_NAME = 'kurator-oflayn', STORE = 'kv', KEY = 'db';
const idb = () => new Promise((res, rej) => { const r = indexedDB.open(IDB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function loadBytes() {
  try {
    const d = await idb();
    const v = await new Promise((res, rej) => { const q = d.transaction(STORE).objectStore(STORE).get(KEY); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    if (v) return v;
  } catch { /* IndexedDB yo'q */ }
  try { const b = localStorage.getItem('kurator_db_b64'); if (b) return Uint8Array.from(atob(b), (c) => c.charCodeAt(0)); } catch { /* ignore */ }
  return null;
}
async function saveBytes(bytes) {
  try {
    const d = await idb();
    await new Promise((res, rej) => { const t = d.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(bytes, KEY); t.oncomplete = res; t.onerror = () => rej(t.error); });
    return true;
  } catch { /* localStorage'ga urinamiz */ }
  try {
    let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    localStorage.setItem('kurator_db_b64', btoa(s)); return true;
  } catch { window.dispatchEvent(new Event('offline-save-failed')); return false; }
}

const clean = (p) => (p || []).map((v) => (v === undefined ? null : v));

export async function createSqlJsDb(SQL) {
  const bytes = await loadBytes();
  let sdb = bytes ? new SQL.Database(bytes) : new SQL.Database();
  for (const s of schema) sdb.run(s);
  let timer = null;
  const persist = () => { clearTimeout(timer); timer = setTimeout(flush, 200); };
  const flush = () => { clearTimeout(timer); return saveBytes(sdb.export()); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  const raw = {
    all: async (sql, p) => { const st = sdb.prepare(sql); try { st.bind(clean(p)); const out = []; while (st.step()) out.push(st.getAsObject()); return out; } finally { st.free(); } },
    run: async (sql, p) => { sdb.run(sql, clean(p)); persist(); return { changes: sdb.getRowsModified() }; },
  };
  raw.get = async (sql, p) => (await raw.all(sql, p))[0];
  let chain = Promise.resolve();
  const lock = (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
  await migrate({ all: raw.all, run: raw.run });
  const db = {
    kind: 'browser',
    all: (s, p) => lock(() => raw.all(s, p)),
    get: (s, p) => lock(() => raw.get(s, p)),
    run: (s, p) => lock(() => raw.run(s, p)),
    tx: (fn) => lock(async () => {
      sdb.run('BEGIN');
      try { const r = await fn(raw); sdb.run('COMMIT'); persist(); return r; } catch (e) { sdb.run('ROLLBACK'); throw e; }
    }),
    exportBytes: () => sdb.export(),
    async replaceWith(newBytes) { const t = new SQL.Database(newBytes); const ok = t.exec("SELECT name FROM sqlite_master WHERE name='curators'").length; t.close(); if (!ok) throw new Error("Bu fayl Kuratorlar oyligi zaxira nusxasi emas."); await saveBytes(newBytes); },
  };
  return db;
}
