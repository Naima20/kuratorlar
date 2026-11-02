'use strict';
// Ma'lumotlar bazasi adapteri: PostgreSQL (DATABASE_URL bor bo'lsa) yoki SQLite (fayl).
// Ikkalasida ham bir xil API: all / get / run / tx. SQL'da "?" belgilari ishlatiladi.
const fs = require('fs');
const path = require('path');
const schema = require('./schema');
const { migrate } = require('./migrate');

const clean = (p) => (p || []).map((v) => (v === undefined ? null : v));

function makePg(cfg) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: cfg.databaseUrl,
    ssl: cfg.databaseSsl ? { rejectUnauthorized: false } : undefined,
  });
  const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); };
  const api = (q) => ({
    all: async (sql, p) => (await q.query(toPg(sql), clean(p))).rows,
    get: async (sql, p) => (await q.query(toPg(sql), clean(p))).rows[0],
    run: async (sql, p) => ({ changes: (await q.query(toPg(sql), clean(p))).rowCount }),
  });
  const base = api(pool);
  return {
    kind: 'postgres',
    ...base,
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const r = await fn(api(client));
        await client.query('COMMIT');
        return r;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

function makeSqlite(cfg) {
  let db;
  fs.mkdirSync(path.dirname(cfg.sqlitePath), { recursive: true });
  try {
    const Better = require('better-sqlite3');
    db = new Better(cfg.sqlitePath);
    db.pragma('journal_mode = WAL');
  } catch (e1) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      db = new DatabaseSync(cfg.sqlitePath);
      db.exec('PRAGMA journal_mode = WAL');
    } catch (e2) {
      throw new Error("SQLite ishga tushmadi. .env faylida DATABASE_URL (PostgreSQL) ni kiriting. Sabab: " + e1.message);
    }
  }
  const raw = {
    all: async (sql, p) => db.prepare(sql).all(...clean(p)).map((r) => ({ ...r })),
    get: async (sql, p) => { const r = db.prepare(sql).get(...clean(p)); return r ? { ...r } : undefined; },
    run: async (sql, p) => ({ changes: db.prepare(sql).run(...clean(p)).changes }),
  };
  // Hamma so'rovlar navbat bilan bajariladi (tranzaksiyalar aralashib ketmasligi uchun)
  let chain = Promise.resolve();
  const lock = (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
  return {
    kind: 'sqlite',
    all: (s, p) => lock(() => raw.all(s, p)),
    get: (s, p) => lock(() => raw.get(s, p)),
    run: (s, p) => lock(() => raw.run(s, p)),
    tx: (fn) => lock(async () => {
      db.exec('BEGIN');
      try { const r = await fn(raw); db.exec('COMMIT'); return r; }
      catch (err) { db.exec('ROLLBACK'); throw err; }
    }),
    close: () => db.close(),
  };
}

async function createDb(cfg) {
  const db = cfg.databaseUrl ? makePg(cfg) : makeSqlite(cfg);
  for (const stmt of schema) await db.run(stmt);
  await migrate(db);
  return db;
}

module.exports = { createDb };
