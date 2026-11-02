'use strict';
// .env faylini (agar mavjud bo'lsa) oddiy usulda o'qiydi — qo'shimcha kutubxona kerak emas.
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

const e = process.env;
const config = {
  port: Number(e.PORT) || 3000,
  databaseUrl: e.DATABASE_URL || '',
  databaseSsl: String(e.DATABASE_SSL || '').toLowerCase() === 'true',
  sqlitePath: e.SQLITE_PATH || path.join(__dirname, '..', 'data', 'kurator.db'),
  adminPassword: e.ADMIN_PASSWORD || 'admin123',
  operatorPassword: e.OPERATOR_PASSWORD || 'operator123',
  sessionSecret: e.SESSION_SECRET || 'dev-secret-change-me',
  sessionHours: Number(e.SESSION_HOURS) || 12,
};
config.usingDefaults =
  !e.ADMIN_PASSWORD || !e.OPERATOR_PASSWORD || !e.SESSION_SECRET ||
  config.adminPassword === 'admin123' || config.operatorPassword === 'operator123' ||
  config.sessionSecret === 'dev-secret-change-me';

module.exports = config;
