'use strict';
// Kuratorlar va oylik qoidalari
const express = require('express');
const { adminOnly } = require('../auth');
const { wrap, bad, HttpError, uid, nowIso, parseDate, reqStr, optStr, reqNum } = require('../util');
const { TYPES, normalizeParams, describe } = require('../rules');

module.exports = (db) => {
  const r = express.Router();

  // ---------- KURATORLAR ----------
  function readCurator(b) {
    const first = reqStr(b.first_name, 'Ism', 60);
    const last = reqStr(b.last_name, 'Familiya', 60);
    const day = reqNum(b.birth_day, "Tug'ilgan kun", { int: true, min: 1, max: 31 });
    const month = reqNum(b.birth_month, "Tug'ilgan oy", { int: true, min: 1, max: 12 });
    const year = reqNum(b.birth_year, "Tug'ilgan yil", { int: true, min: 1940, max: new Date().getFullYear() - 14 });
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!Number.isFinite(parseDate(iso))) throw bad("Tug'ilgan sana noto'g'ri (masalan, 31-fevral bo'lmaydi).");
    const hire = typeof b.hire_date === 'string' ? b.hire_date : '';
    if (!Number.isFinite(parseDate(hire))) throw bad("Ishga qabul qilingan sanani to'g'ri kiriting.");
    const card = String(b.card_number || '').replace(/\D/g, '');
    if (card.length !== 16) throw bad("Karta raqami 16 ta raqamdan iborat bo'lishi kerak.");
    return { first, last, day, month, year, hire, card, active: b.active === false || b.active === 0 ? 0 : 1 };
  }
  // Bir xodim ham kurator, ham sifat nazorati xodimi bo'lishi mumkin — shuning uchun bir xil karta raqami qabul qilinadi.
  async function assertCardFree() { /* takroriy karta raqami rad etilmaydi */ }

  r.get('/curators', wrap(async (req, res) => {
    res.json(await db.all("SELECT * FROM curators WHERE kind = 'curator' ORDER BY last_name, first_name"));
  }));
  r.post('/curators', adminOnly, wrap(async (req, res) => {
    const c = readCurator(req.body || {});
    await assertCardFree(c.card);
    const id = uid();
    await db.run(
      'INSERT INTO curators (id, first_name, last_name, birth_day, birth_month, birth_year, hire_date, card_number, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, c.first, c.last, c.day, c.month, c.year, c.hire, c.card, c.active, nowIso()]);
    res.status(201).json({ id });
  }));
  r.put('/curators/:id', adminOnly, wrap(async (req, res) => {
    const c = readCurator(req.body || {});
    await assertCardFree(c.card, req.params.id);
    const out = await db.run(
      "UPDATE curators SET first_name=?, last_name=?, birth_day=?, birth_month=?, birth_year=?, hire_date=?, card_number=?, active=? WHERE id=? AND kind='curator'",
      [c.first, c.last, c.day, c.month, c.year, c.hire, c.card, c.active, req.params.id]);
    if (!out.changes) throw new HttpError(404, 'Kurator topilmadi.');
    res.json({ ok: true });
  }));
  r.delete('/curators/:id', adminOnly, wrap(async (req, res) => {
    const used = await db.get('SELECT (SELECT COUNT(*) FROM assignments WHERE curator_id = ?) + (SELECT COUNT(*) FROM bonuses WHERE curator_id = ?) AS n', [req.params.id, req.params.id]);
    if (Number(used.n) > 0) throw new HttpError(409, "Bu kurator hisob-kitoblarda qatnashgan, o'chirib bo'lmaydi (tarix saqlanishi kerak). O'rniga \"Faol emas\" holatiga o'tkazing.");
    await db.run('DELETE FROM curators WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  }));

  // ---------- BOSHQA BO'LIM XODIMLARI (sifat nazorati va h.k.) ----------
  function readStaff(b) {
    const first = reqStr(b.first_name, 'Ism', 60);
    const last = reqStr(b.last_name, 'Familiya', 60);
    const dep = optStr(b.department, 60);
    const card = String(b.card_number || '').replace(/\D/g, '');
    if (card.length !== 16) throw bad("Karta raqami 16 ta raqamdan iborat bo'lishi kerak.");
    const role = b.staff_role === 'head' ? 'head' : 'inspector';
    const salary = role === 'head' ? reqNum(b.monthly_salary, "Rahbarning stabil oyligi", { int: true, min: 1 }) : null;
    const hire = b.hire_date ? (Number.isFinite(parseDate(b.hire_date)) ? b.hire_date : (() => { throw bad("Ish boshlagan sanani to'g'ri kiriting."); })()) : null;
    return { first, last, dep, card, role, salary, hire, active: b.active === false || b.active === 0 ? 0 : 1 };
  }
  r.get('/staff', wrap(async (req, res) => {
    res.json(await db.all("SELECT * FROM curators WHERE kind = 'staff' ORDER BY last_name, first_name"));
  }));
  r.post('/staff', wrap(async (req, res) => {
    const c = readStaff(req.body || {});
    await assertCardFree(c.card);
    const id = uid();
    await db.run("INSERT INTO curators (id, first_name, last_name, card_number, kind, department, staff_role, monthly_salary, hire_date, active, created_at) VALUES (?,?,?,?,'staff',?,?,?,?,?,?)",
      [id, c.first, c.last, c.card, c.dep, c.role, c.salary, c.hire, c.active, nowIso()]);
    res.status(201).json({ id });
  }));
  r.put('/staff/:id', wrap(async (req, res) => {
    const c = readStaff(req.body || {});
    await assertCardFree(c.card, req.params.id);
    const out = await db.run("UPDATE curators SET first_name=?, last_name=?, card_number=?, department=?, staff_role=?, monthly_salary=?, hire_date=?, active=? WHERE id=? AND kind='staff'",
      [c.first, c.last, c.card, c.dep, c.role, c.salary, c.hire, c.active, req.params.id]);
    if (!out.changes) throw new HttpError(404, 'Xodim topilmadi.');
    res.json({ ok: true });
  }));
  r.delete('/staff/:id', wrap(async (req, res) => {
    const used = await db.get('SELECT COUNT(*) AS n FROM bonuses WHERE curator_id = ?', [req.params.id]);
    if (Number(used.n) > 0) throw new HttpError(409, "Bu xodim hisob-kitoblarda qatnashgan, o'chirib bo'lmaydi. O'rniga \"Faol emas\" holatiga o'tkazing.");
    await db.run("DELETE FROM curators WHERE id = ? AND kind = 'staff'", [req.params.id]);
    res.json({ ok: true });
  }));

  // ---------- OYLIK QOIDALARI ----------
  const present = (row) => {
    const params = JSON.parse(row.params);
    const rule = { ...row, params, active: Number(row.active) };
    rule.summary = describe(rule);
    return rule;
  };
  r.get('/rules', wrap(async (req, res) => {
    const rows = await db.all('SELECT * FROM salary_rules ORDER BY type, name');
    res.json({ types: TYPES, rules: rows.map(present) });
  }));
  const readRule = (b) => {
    if (!TYPES[b.type]) throw bad('Qoida turini tanlang.');
    return {
      name: reqStr(b.name, 'Qoida nomi', 80),
      type: b.type,
      params: JSON.stringify(normalizeParams(b.type, b.params || {})),
      note: optStr(b.note, 300),
      active: b.active === false || b.active === 0 ? 0 : 1,
    };
  };
  r.post('/rules', adminOnly, wrap(async (req, res) => {
    const x = readRule(req.body || {});
    const id = uid();
    const t = nowIso();
    await db.run('INSERT INTO salary_rules (id, name, type, params, note, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, x.name, x.type, x.params, x.note, x.active, t, t]);
    res.status(201).json({ id });
  }));
  r.put('/rules/:id', adminOnly, wrap(async (req, res) => {
    const x = readRule(req.body || {});
    const out = await db.run('UPDATE salary_rules SET name=?, type=?, params=?, note=?, active=?, updated_at=? WHERE id=?',
      [x.name, x.type, x.params, x.note, x.active, nowIso(), req.params.id]);
    if (!out.changes) throw new HttpError(404, 'Qoida topilmadi.');
    res.json({ ok: true });
  }));
  r.delete('/rules/:id', adminOnly, wrap(async (req, res) => {
    await db.run('DELETE FROM salary_rules WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  }));

  return r;
};
