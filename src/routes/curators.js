'use strict';
const express = require('express');
const { requireAdmin } = require('../auth');
const { wrap, bad, HttpError, text, num, isDate } = require('../util');

const router = express.Router();

function cleanCard(v) {
  const digits = String(v == null ? '' : v).replace(/\D/g, '');
  if (digits.length !== 16) throw bad("Karta raqami 16 ta raqamdan iborat bo'lishi kerak.");
  return digits;
}

function fields(b) {
  const first_name = text(b.first_name, { required: true, label: 'Ism', max: 60 });
  const last_name = text(b.last_name, { required: true, label: 'Familiya', max: 60 });
  const birth_date = b.birth_date ? b.birth_date : null;
  if (birth_date && !isDate(birth_date)) throw bad("Tug'ilgan sana noto'g'ri.");
  if (!isDate(b.hire_date)) throw bad('Ishga olingan sana kiritilishi shart.');
  return { first_name, last_name, birth_date, hire_date: b.hire_date, card_number: cleanCard(b.card_number) };
}

router.get('/', wrap(async (req, res) => {
  res.json(await req.app.locals.db.all('SELECT * FROM curators ORDER BY last_name, first_name'));
}));

router.post('/', requireAdmin, wrap(async (req, res) => {
  const db = req.app.locals.db;
  const id = await db.insert('curators', { ...fields(req.body || {}), active: 1 });
  res.json(await db.get('SELECT * FROM curators WHERE id=?', [id]));
}));

router.put('/:id', requireAdmin, wrap(async (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  if (!(await db.get('SELECT id FROM curators WHERE id=?', [id]))) throw new HttpError(404, 'Kurator topilmadi.');
  const b = req.body || {};
  const data = fields(b);
  if (b.active !== undefined) data.active = b.active ? 1 : 0;
  await db.update('curators', id, data);
  res.json(await db.get('SELECT * FROM curators WHERE id=?', [id]));
}));

router.post('/:id/active', requireAdmin, wrap(async (req, res) => {
  const db = req.app.locals.db;
  await db.update('curators', Number(req.params.id), { active: req.body && req.body.active ? 1 : 0 });
  res.json({ ok: true });
}));

router.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const db = req.app.locals.db;
  const id = Number(req.params.id);
  const used = (await db.get('SELECT COUNT(*) AS n FROM assignments WHERE curator_id=?', [id])).n;
  const used2 = (await db.get('SELECT COUNT(*) AS n FROM bonus_entries WHERE curator_id=?', [id])).n;
  if (Number(used) + Number(used2) > 0) {
    throw new HttpError(409, "Bu kurator oldin ishlagan, shuning uchun o'chirib bo'lmaydi (tarix saqlanadi). Uni «Arxivlash» tugmasi bilan yashiring.");
  }
  await db.run('DELETE FROM curators WHERE id=?', [id]);
  res.json({ ok: true });
}));

module.exports = router;
