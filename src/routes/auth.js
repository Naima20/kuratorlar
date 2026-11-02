'use strict';
const express = require('express');
const config = require('../config');
const { login, logout, safeEqual } = require('../auth');
const { wrap, bad } = require('../util');

const router = express.Router();
const attempts = new Map();

function limited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.reset < now) { attempts.set(ip, { count: 0, reset: now + 15 * 60 * 1000 }); return false; }
  return rec.count >= 10;
}

router.post('/login', wrap(async (req, res) => {
  const ip = req.ip;
  if (limited(ip)) throw Object.assign(bad("Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring."), { status: 429 });
  const { role, password } = req.body || {};
  const expected = role === 'admin' ? config.adminPassword : role === 'operator' ? config.operatorPassword : null;
  if (!expected || typeof password !== 'string' || !safeEqual(password, expected)) {
    attempts.get(ip).count++;
    throw Object.assign(bad("Parol noto'g'ri."), { status: 401 });
  }
  login(req, res, role);
  res.json({ user: { role } });
}));

router.post('/logout', (req, res) => { logout(res); res.json({ ok: true }); });

router.get('/me', (req, res) => {
  res.json({
    user: req.user,
    defaultPasswords: !!(req.user && req.user.role === 'admin' && config.usingDefaultPasswords),
  });
});

module.exports = router;
