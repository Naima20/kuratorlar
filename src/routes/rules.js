'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');
const { wrap, bad, HttpError, text, num } = require('../util');

const router = express.Router();

const GROUP_TYPES = ['fixed', 'daily', 'tier'];
const BONUS_TYPES = ['per_message', 'percent', 'per_sale'];
const ALL_TYPES = [...GROUP_TYPES, ...BONUS_TYPES];

function parseRule(row) {
  return { ...row, tiers: JSON.parse(row.tiers || '[]') };
}

function validateTiers(raw) {
  if (!Array.isArray(raw) || raw.length === 0) throw bad("Kamida bitta pog'ona kiriting.");
  const tiers = raw.map((t, i) => {
    const from = num(t.from, { min: 0, max: 100000, int: true, label: `${i + 1}-pog'onaning boshlanishi` });
    const to = t.to === '' || t.to == null ? null : num(t.to, { min: 0, max: 100000, int: true, label: `${i + 1}-pog'onaning oxiri` });
    const amount = num(t.amount, { min: 0, label: `${i + 1}-pog'ona summasi` });
    if (to != null && to < from) throw bad(`${i + 1}-pog'ona: oxiri boshlanishidan kichik bo'lmasligi kerak.`);
    return { from, to, amount };
  }).sort((a, b) => a.from - b.from);
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].to == null && i < tiers.length - 1) throw bad("Faqat oxirgi pog'onaning oxiri bo'sh (cheksiz) bo'lishi mumkin.");
    if (i > 0) {
      const prev = tiers[i - 1];
      if (tiers[i].from <= prev.to) throw bad("Pog'onalar bir-biriga tushib qolgan.");
      if (tiers[i].from !== prev.to + 1) throw bad(`Pog'onalar orasida bo'sh oraliq bor (${prev.to + 1}–${tiers[i].from - 1} o'quvchi uchun pog'ona yo'q).`);
    }
  }
  return tiers;
}

function validate(b) {
  const name = text(b.name, { required: true, label: 'Qoida nomi', max: 80 });
  if (!ALL_TYPES.includes(b.type)) throw bad('Qoida turini tanlang.');
  const basis = b.basis === 'month' ? 'month' : 'group';
  const note = text(b.note, { max: 300 });
  let amount = 0;
  let tiers = [];
  if (b.type === 'tier') tiers = validateTiers(b.tiers);
  else {
    amount = num(b.amount, { min: 0, max: b.type === 'percent' ? 100 : 1e10, label: b.type === 'percent' ? 'Foiz' : 'Summa' });
  }
  return { name, type: b.type, amount, basis, tiers: JSON.stringify(tiers), note };
}

async function loadUsableRule(db, id, allowedTypes) {
  const row = await db.get('SELECT * FROM salary_rules WHERE id=?', [Number(id)]);
  if (!row) throw bad('Oylik qoidasi tanlanmagan yoki topilmadi.');
  if (!allowedTypes.includes(row.type)) throw bad("Bu qoida turi bu yerda ishlatilmaydi.");
  const rule = parseRule(row);
  if (rule.type !== 'tier' && !(rule.amount > 0)) {
    throw bad(`«${rule.name}» qoidasida narx kiritilmagan. Avval Admin «Oylik qoidalari» bo'limida narxni kiritsin.`);
  }
  return rule;
}

const snapshotOf = (rule) => JSON.stringify({ name: rule.name, type: rule.type, amount: rule.amount, basis: rule.basis, tiers: rule.tiers });

router.get('/rules', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const rows = (await db.all('SELECT * FROM salary_rules ORDER BY id')).map(parseRule);
  const a = await db.all('SELECT rule_id, COUNT(*) AS n FROM assignments GROUP BY rule_id');
  const b = await db.all('SELECT rule_id, COUNT(*) AS n FROM bonus_entries GROUP BY rule_id');
  const used = new Map();
  [...a, ...b].forEach((r) => used.set(r.rule_id, (used.get(r.rule_id) || 0) + Number(r.n)));
  res.json(rows.map((r) => ({ ...r, used: used.get(r.id) || 0 })));
}));

router.post('/rules', requireAdmin, wrap(async (req, res) => {
  const db = req.app.locals.db;
  const data = validate(req.body || {});
  if (await db.get('SELECT id FROM salary_rules WHERE name=?', [data.name])) throw new HttpError(409, 'Bunday nomli qoida allaqachon bor.');
  const id = await db.insert('salary_rules', data);
  res.json(parseRule(await db.get('SELECT * FROM salary_rules WHERE id=?', [id])));
}));

router.put('/rules/:id', requireAdmin, wrap(async (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  if (!(await db.get('SELECT id FROM salary_rules WHERE id=?', [id]))) throw new HttpError(404, 'Qoida topilmadi.');
  const data = validate(req.body || {});
  const dup = await db.get('SELECT id FROM salary_rules WHERE name=? AND id<>?', [data.name, id]);
  if (dup) throw new HttpError(409, 'Bunday nomli qoida allaqachon bor.');
  await db.update('salary_rules', id, data);
  res.json(parseRule(await db.get('SELECT * FROM salary_rules WHERE id=?', [id])));
}));

router.delete('/rules/:id', requireAdmin, wrap(async (req, res) => {
  await req.app.locals.db.run('DELETE FROM salary_rules WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

router.get('/settings', wrap(async (req, res) => {
  const rows = await req.app.locals.db.all('SELECT key, value FROM settings');
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}));

router.put('/settings', requireAdmin, wrap(async (req, res) => {
  const db = req.app.locals.db;
  const std = num((req.body || {}).message_check_standard, { min: 0, max: 100, int: true, label: "Xabar tekshiruvi me'yori" });
  await db.run(`DELETE FROM settings WHERE key='message_check_standard'`);
  await db.run(`INSERT INTO settings (key,value) VALUES ('message_check_standard', ?)`, [String(std)]);
  res.json({ message_check_standard: String(std) });
}));

module.exports = { router, loadUsableRule, snapshotOf, parseRule, GROUP_TYPES, BONUS_TYPES };
