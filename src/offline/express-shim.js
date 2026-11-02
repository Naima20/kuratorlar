// "express" o'rniga brauzerda ishlatiladigan juda kichik Router (faqat get/post/put/delete).
function compile(path) {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:([A-Za-z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  return { re, keys };
}
function Router() {
  const routes = [];
  const add = (method) => (path, ...handlers) => { routes.push({ method, ...compile(path), handlers }); };
  return {
    routes, get: add('GET'), post: add('POST'), put: add('PUT'), delete: add('DELETE'),
    match(method, path) {
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = path.match(r.re);
        if (m) return { handlers: r.handlers, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      }
      return null;
    },
  };
}
function run(handlers, req, res) {
  return new Promise((resolve) => {
    res._resolve = resolve;
    let i = 0;
    const next = (err) => {
      if (err) return resolve({ error: err });
      const h = handlers[i++];
      if (!h) return resolve({});
      try { const r = h(req, res, next); if (r && r.catch) r.catch((e) => resolve({ error: e })); } catch (e) { resolve({ error: e }); }
    };
    next();
  });
}
function makeRes() {
  const res = { _status: 200, _headers: {}, _body: null, _resolve: () => {} };
  res.status = (c) => { res._status = c; return res; };
  res.setHeader = (k, v) => { res._headers[k.toLowerCase()] = v; };
  res.json = (o) => { res._headers['content-type'] = 'application/json'; res._body = JSON.stringify(o); res._resolve({}); };
  res.sendStatus = (c) => { res._status = c; res._resolve({}); };
  res.end = (b) => { if (b !== undefined) res._body = b; res._resolve({}); };
  return res;
}
module.exports = { Router, run, makeRes };
module.exports.default = { Router };
