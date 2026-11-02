import initSqlJs from 'sql.js/dist/sql-wasm.js';
import wasm from 'sql.js/dist/sql-wasm.wasm';
import { createSqlJsDb } from './db.js';
import { run, makeRes } from './express-shim.js';
import { HttpError } from '../util.js';
import people from '../routes/people.js';
import hub from '../routes/hub.js';
import money from '../routes/money.js';

window.__OFFLINE__ = true;
const PW_KEY = 'kurator_offline_pw';
const passwords = () => { try { return { admin: 'admin123', operator: 'operator123', ...JSON.parse(localStorage.getItem(PW_KEY) || '{}') }; } catch { return { admin: 'admin123', operator: 'operator123' }; } };
const usingDefaults = () => { const p = passwords(); return p.admin === 'admin123' || p.operator === 'operator123'; };

function install(db) {
  const routers = [people(db), hub(db), money(db)];
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, 'http://local/');
    const idx = url.pathname.indexOf('/api/');
    if (idx < 0) return realFetch(input, init);
    const path = url.pathname.slice(idx + 4);
    const method = (init.method || 'GET').toUpperCase();
    let body; try { body = init.body ? JSON.parse(init.body) : undefined; } catch { body = undefined; }
    const out = await handle(method, path, Object.fromEntries(url.searchParams), body, (init.headers || {}).Authorization || '');
    return new Response(out.body, { status: out.status, headers: out.headers });
  };
  const json = (status, o) => ({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });

  async function handle(method, path, query, body, auth) {
    if (path === '/health') return json(200, { ok: true, db: 'browser' });
    if (path === '/login' && method === 'POST') {
      const pw = passwords();
      if (!body || !pw[body.role] || body.password !== pw[body.role]) return json(401, { error: "Parol noto'g'ri." });
      return json(200, { token: 'offline-' + body.role, role: body.role, warnDefaults: body.role === 'admin' && usingDefaults() });
    }
    const role = /^Bearer offline-(admin|operator)$/.test(auth) ? auth.slice(15) : null;
    if (!role) return json(401, { error: 'Iltimos, qaytadan kiring.' });
    if (path === '/me') return json(200, { role });
    for (const r of routers) {
      const m = r.match(method, path);
      if (!m) continue;
      const req = { params: m.params, query, body, role, headers: {} };
      const res = makeRes();
      const { error } = await run(m.handlers, req, res);
      if (error) {
        const status = error.status || 500;
        if (status >= 500) console.error(error);
        return json(status, { error: status >= 500 ? "Xatolik yuz berdi. Qayta urinib ko'ring." : error.message });
      }
      const ct = res._headers['content-type'] || '';
      const b = ct.includes('json') || res._body === null ? res._body : new Blob([res._body], { type: ct });
      return { status: res._status, headers: res._headers, body: b };
    }
    return json(404, { error: "Bunday yo'l topilmadi." });
  }
}

(async () => {
  const SQL = await initSqlJs({ wasmBinary: wasm });
  const db = await createSqlJsDb(SQL);
  install(db);
  window.__offline = {
    exportBytes: () => db.exportBytes(),
    restore: (bytes) => db.replaceWith(bytes),
    setPasswords: (admin, operator) => {
      if (String(admin).length < 6 || String(operator).length < 6) throw new Error("Parol kamida 6 belgidan iborat bo'lsin.");
      if (admin === operator) throw new Error('Ikkala parol har xil bo\'lsin.');
      localStorage.setItem(PW_KEY, JSON.stringify({ admin, operator }));
    },
  };
  await import('../../public/js/main.js');
})();
