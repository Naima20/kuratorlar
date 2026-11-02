'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');
const { wrap, bad, HttpError, isMonth, num, text } = require('../util');
const { loadUsableRule, snapshotOf, BONUS_TYPES } = require('./rules');
const { buildReport, calcBonus } = require('../calc');
const { buildWorkbook } = require('../export');

const router = express.Router();

const KIND_RULE_TYPE = { message: 'per_message', transition_sale: 'percent', rustilida_sale: 'per_sale' };

function monthOf(req) {
  const m = req.query.month || (req.body && req.body.month) || req.params.month;
  if (!isMonth(m)) throw bad("Oy noto'g'ri tanlangan.");
  return m;
}

async function loadReport(db, month) {
  const snap = await db.get('SELECT * FROM month_snapshots WHERE month=?', [month]);
  if (snap) return { ...JSON.parse(snap.data), closed: true, closed_at: snap.closed_at };
  const [curators, flows, groups, assignments, entries, srows] = await Promise.all([
    db.all('SELECT * FROM curators'),
    db.all('SELECT * FROM flows'),
    db.all('SELECT * FROM groups'),
    db.all('SELECT * FROM assignments'),
    db.all('SELECT * FROM bonus_entries WHERE month=?', [month]),
    db.all('SELECT key, value FROM settings'),
  ]);
  const settings = Object.fromEntries(srows.map((r) => [r.key, r.value]));
  return { ...buildReport({ month, curators, flows, groups, assignments, entries, settings }), closed: false };
}

async function assertOpen(db, month) {
  if (await db.get('SELECT month FROM month_snapshots WHERE month=?', [month])) {
    throw new HttpError(409, "Bu oy yopilgan. O'zgartirish uchun Admin oyni qayta ochishi kerak.");
  }
}

router.get('/months', wrap(async (req, res) => {
  const rows = await req.app.locals.db.all('SELECT month, closed_at FROM month_snapshots ORDER BY month DESC');
  res.json(rows);
}));

router.get('/report', wrap(async (req, res) => {
  res.json(await loadReport(req.app.locals.db, monthOf(req)));
}));

router.get('/report/export', wrap(async (req, res) => {
  const month = monthOf(req);
  const report = await loadReport(req.app.locals.db, month);
  const buf = await buildWorkbook(report, { closed: report.closed });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="oylik-${month}.xlsx"`);
  res.send(Buffer.from(buf));
}));

router.post('/months/:month/close', requireAdmin, wrap(async (req, res) => {
  const db = req.app.locals.db;
  const month = monthOf(req);
  await assertOpen(db, month);
  const report = await loadReport(db, month);
  await db.run('INSERT INTO month_snapshots (month, data, closed_at) VALUES (?,?,?)', [month, JSON.stringify(report), new Date().toISOString()]);
  res.json({ ok: true });
}));

router.post('/months/:month/reopen', requireAdmin, wrap(async (req, res) => {
  await req.app.locals.db.run('DELETE FROM month_snapshots WHERE month=?', [monthOf(req)]);
  res.json({ ok: true });
}));

// ---- Bonuslar (sifat nazorati va savdo)
router.get('/entries', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const rows = await db.all(
    `SELECT e.*, c.first_name, c.last_name FROM bonus_entries e LEFT JOIN curators c ON c.id=e.curator_id WHERE e.month=? ORDER BY e.id`,
    [monthOf(req)]
  );
  res.json(rows.map((e) => {
    const rule = JSON.parse(e.rule_snapshot);
    const r = calcBonus(e, rule);
    return { ...e, curator: `${e.last_name || ''} ${e.first_name || ''}`.trim(), rule_name: rule.name, amount: r.amount, formula: r.formula };
  }));
}));

async function entryData(db, b, month) {
  const kind = b.kind;
  if (!KIND_RULE_TYPE[kind]) throw bad("Bonus turi noto'g'ri.");
  const curator = await db.get('SELECT id FROM curators WHERE id=?', [Number(b.curator_id)]);
  if (!curator) throw bad('Kuratorni tanlang.');
  let group_id = null;
  if (b.group_id) {
    const g = await db.get('SELECT id FROM groups WHERE id=?', [Number(b.group_id)]);
    if (!g) throw bad('Guruh topilmadi.');
    group_id = g.id;
  }
  if (kind === 'message' && !group_id) throw bad('Xabar tekshiruvi uchun guruhni tanlang.');
  const rule = await loadUsableRule(db, b.rule_id, BONUS_TYPES);
  if (rule.type !== KIND_RULE_TYPE[kind]) throw bad("Tanlangan qoida bu bonus turiga mos kelmaydi.");
  const label = kind === 'transition_sale' ? 'Savdo hajmi' : kind === 'message' ? 'Tekshiruvlar soni' : 'Savdolar soni';
  const quantity = num(b.quantity, { min: 0, max: 1e12, label, int: kind !== 'transition_sale' });
  return { month, kind, curator_id: curator.id, group_id, rule_id: rule.id, rule_snapshot: snapshotOf(rule), quantity, note: text(b.note, { max: 200 }) };
}

router.post('/entries', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const month = monthOf(req);
  await assertOpen(db, month);
  res.json({ id: await db.insert('bonus_entries', await entryData(db, req.body || {}, month)) });
}));

router.put('/entries/:id', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const e = await db.get('SELECT * FROM bonus_entries WHERE id=?', [Number(req.params.id)]);
  if (!e) throw new HttpError(404, 'Yozuv topilmadi.');
  await assertOpen(db, e.month);
  const data = await entryData(db, req.body || {}, e.month);
  await db.update('bonus_entries', e.id, data);
  res.json({ ok: true });
}));

router.delete('/entries/:id', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const e = await db.get('SELECT * FROM bonus_entries WHERE id=?', [Number(req.params.id)]);
  if (!e) return res.json({ ok: true });
  await assertOpen(db, e.month);
  await db.run('DELETE FROM bonus_entries WHERE id=?', [e.id]);
  res.json({ ok: true });
}));

module.exports = router;
