'use strict';
const path = require('path');
const express = require('express');
const config = require('./src/config');
const { createDb } = require('./src/db');
const { login, authenticate } = require('./src/auth');
const { HttpError } = require('./src/util');

async function createApp(cfg = config) {
  if (cfg !== config) Object.assign(config, cfg); // testlar uchun
  const db = await createDb(cfg);
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  // Alohida HTML fayldan ulanish uchun (CORS). Kirish Bearer token bilan, cookie yo'q — shuning uchun xavfsiz.
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, db: db.kind }));
  app.post('/api/login', login);
  app.use('/api', authenticate);
  app.get('/api/me', (req, res) => res.json({ role: req.role }));
  app.use('/api', require('./src/routes/people')(db));
  app.use('/api', require('./src/routes/hub')(db));
  app.use('/api', require('./src/routes/money')(db));
  app.use('/api', (req, res, next) => next(new HttpError(404, 'Bunday yo\'l topilmadi.')));

  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: "So'rov formati noto'g'ri." });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "Serverda xatolik yuz berdi. Iltimos, qayta urinib ko'ring." : err.message });
  });
  return { app, db };
}

module.exports = { createApp };

if (require.main === module) {
  createApp().then(({ app, db }) => {
    app.listen(config.port, '0.0.0.0', () => {
      console.log(`✔ Kuratorlar oyligi paneli ishga tushdi: http://localhost:${config.port}  (baza: ${db.kind})`);
      if (config.usingDefaults) console.warn("⚠ DIQQAT: standart parollar ishlatilmoqda! .env faylida ADMIN_PASSWORD, OPERATOR_PASSWORD va SESSION_SECRET ni o'zgartiring.");
    });
  }).catch((e) => { console.error('Ishga tushmadi:', e.message); process.exit(1); });
}
