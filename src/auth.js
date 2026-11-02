'use strict';
// Oddiy va xavfsiz kirish: ikki rol (admin / operator), parol .env faylida.
const crypto = require('crypto');
const config = require('./config');
const { HttpError, wrap } = require('./util');

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const same = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (p) => crypto.createHmac('sha256', config.sessionSecret).update(p).digest('base64url');

function makeToken(role) {
  const payload = b64({ role, exp: Date.now() + config.sessionHours * 3600 * 1000 });
  return `${payload}.${sign(payload)}`;
}
function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expect = sign(payload);
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() && ['admin', 'operator'].includes(data.role) ? data : null;
  } catch { return null; }
}

const attempts = new Map(); // ip -> {n, until}
const login = wrap(async (req, res) => {
  const ip = req.ip;
  const rec = attempts.get(ip) || { n: 0, until: 0 };
  if (rec.until > Date.now()) throw new HttpError(429, "Juda ko'p xato urinish. 5 daqiqadan keyin qayta urinib ko'ring.");
  const { role, password } = req.body || {};
  const expected = role === 'admin' ? config.adminPassword : role === 'operator' ? config.operatorPassword : null;
  if (!expected || !same(password || '', expected)) {
    rec.n += 1;
    if (rec.n >= 8) { rec.until = Date.now() + 5 * 60 * 1000; rec.n = 0; }
    attempts.set(ip, rec);
    throw new HttpError(401, "Parol noto'g'ri.");
  }
  attempts.delete(ip);
  res.json({ token: makeToken(role), role, warnDefaults: role === 'admin' && config.usingDefaults });
});

function authenticate(req, res, next) {
  const h = req.headers.authorization || '';
  const data = readToken(h.startsWith('Bearer ') ? h.slice(7) : '');
  if (!data) return next(new HttpError(401, 'Iltimos, qaytadan kiring.'));
  req.role = data.role;
  next();
}
const adminOnly = (req, res, next) =>
  req.role === 'admin' ? next() : next(new HttpError(403, 'Bu amal faqat Admin uchun.'));

module.exports = { login, authenticate, adminOnly };
