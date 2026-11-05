'use strict';
// Bonuslar (sifat nazorati, sotuvlar), hisobot, oyni yopish, Excel
const express = require('express');
const { adminOnly } = require('../auth');
const { wrap, bad, HttpError, uid, nowIso, parseDate, overlap, isMonth, optStr, reqNum, periodOf } = require('../util');
const { BONUS_RULE_TYPE, snapshotOf, describe } = require('../rules');
const { computeMonth } = require('../calc');
const { loadCalcData, closedMonths, assertMonthsOpen, attachTerms } = require('../data');
const { buildWorkbook } = require('../excel');
const { buildItems } = require('../payments');

module.exports = (db) => {
  const r = express.Router();

  // ---------- BONUSLAR ----------
  async function pickRule(kind, ruleId) {
    const type = BONUS_RULE_TYPE[kind];
    let row;
    if (ruleId) row = await db.get('SELECT * FROM salary_rules WHERE id = ?', [ruleId]);
    else {
      const all = await db.all('SELECT * FROM salary_rules WHERE type = ? AND active = 1', [type]);
      if (all.length === 1) row = all[0];
      else if (!all.length) throw bad("Bu bonus uchun narx/foiz qoidasi yo'q. Admin avval \"Oylik qoidalari\" bo'limida yaratishi kerak.");
      else throw bad('Qoidani tanlang.');
    }
    if (!row || row.type !== type) throw bad("Bu bonus turiga mos qoida tanlanmagan.");
    if (!Number(row.active)) throw bad('Bu qoida faol emas.');
    return snapshotOf(row);
  }
  async function readBonus(b, existing) {
    const kind = existing ? existing.kind : b.kind;
    if (!BONUS_RULE_TYPE[kind]) throw bad('Bonus turini tanlang.');
    const month = existing ? existing.month : b.month;
    if (!isMonth(month)) throw bad('Oyni tanlang.');
    const curatorId = existing ? existing.curator_id : b.curator_id;
    const person = curatorId && await db.get('SELECT * FROM curators WHERE id = ?', [curatorId]);
    if (!person) throw bad('Xodimni tanlang.');
    let groupId = existing ? existing.group_id : (b.group_id || null);
    let monthNo = existing ? existing.month_no : null;
    const inspector = person.kind === 'staff' && person.staff_role !== 'head';
    if (!inspector) throw bad("Bu bonus faqat sifat nazoratchilariga kiritiladi (kuratorlarga emas).");
    if (kind === 'flow_sales') {
      groupId = null; monthNo = null;
    } else {
      if (!groupId) throw bad('Guruhni tanlang.');
      const g = await db.get('SELECT * FROM course_groups WHERE id = ?', [groupId]);
      if (!g) throw bad('Guruh topilmadi.');
      if (kind === 'messages') {
        if (g.section !== 'flow') throw bad('Xabar tekshiruvi potok guruhlari uchun kiritiladi.');
        monthNo = null;
      } else {
        if (g.section !== 'rustilida') throw bad('Bu bonus Rustilida.uz guruhi uchun.');
        if (!existing) monthNo = reqNum(b.month_no, 'Nechanchi oy uchun to\'lov', { int: true, min: 1, max: 5 });
      }
    }
    const isMoney = kind === 'flow_sales';
    const quantity = reqNum(b.quantity, isMoney ? "Sotuv hajmi (so'm)" : kind === 'rustilida_sales' ? "To'lov qilgan o'quvchilar soni" : 'Soni', { int: !isMoney, max: isMoney ? 1e12 : 10000 });
    return { kind, month, curatorId, groupId, monthNo, quantity, note: optStr(b.note, 200) };
  }

  r.get('/bonuses', wrap(async (req, res) => {
    const month = req.query.month;
    if (!isMonth(month)) throw bad('Oyni tanlang.');
    const rows = await db.all('SELECT * FROM bonuses WHERE month = ? ORDER BY created_at', [month]);
    res.json(rows.map((x) => ({ ...x, rule_snapshot: JSON.parse(x.rule_snapshot) })));
  }));
  r.post('/bonuses', wrap(async (req, res) => {
    if ((req.body || {}).kind === 'rustilida_sales' && req.role !== 'admin') throw new HttpError(403, "Rustilida.uz sotuvini faqat Admin kiritadi.");
    const x = await readBonus(req.body || {});
    await assertMonthsOpen(db, [x.month]);
    const dup = await db.get('SELECT id FROM bonuses WHERE month=? AND kind=? AND curator_id=? AND COALESCE(group_id, \'\') = ? AND COALESCE(month_no, 0) = ?', [x.month, x.kind, x.curatorId, x.groupId || '', x.monthNo || 0]);
    if (dup) throw bad("Bu kurator uchun shu oyda allaqachon kiritilgan. Qatorni tahrirlang (qalam belgisi).");
    const snap = await pickRule(x.kind, req.body.rule_id);
    const id = uid();
    await db.run('INSERT INTO bonuses (id, month, kind, curator_id, group_id, month_no, quantity, rule_id, rule_snapshot, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, x.month, x.kind, x.curatorId, x.groupId, x.monthNo, x.quantity, snap.id, JSON.stringify(snap), x.note, nowIso()]);
    res.status(201).json({ id });
  }));
  r.put('/bonuses/:id', wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM bonuses WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Yozuv topilmadi.');
    if (old.kind === 'rustilida_sales' && req.role !== 'admin') throw new HttpError(403, "Rustilida.uz sotuvini faqat Admin o'zgartiradi.");
    await assertMonthsOpen(db, [old.month]);
    const x = await readBonus(req.body || {}, old);
    await db.run('UPDATE bonuses SET quantity=?, note=? WHERE id=?', [x.quantity, x.note, old.id]);
    res.json({ ok: true });
  }));
  r.delete('/bonuses/:id', wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM bonuses WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Yozuv topilmadi.');
    if (old.kind === 'rustilida_sales' && req.role !== 'admin') throw new HttpError(403, "Rustilida.uz sotuvini faqat Admin o'chiradi.");
    await assertMonthsOpen(db, [old.month]);
    await db.run('DELETE FROM bonuses WHERE id = ?', [old.id]);
    res.json({ ok: true });
  }));
  r.post('/bonuses/:id/refresh', adminOnly, wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM bonuses WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Yozuv topilmadi.');
    await assertMonthsOpen(db, [old.month]);
    const snap = await pickRule(old.kind, old.rule_id);
    await db.run('UPDATE bonuses SET rule_snapshot = ? WHERE id = ?', [JSON.stringify(snap), old.id]);
    res.json({ ok: true });
  }));

  // ---------- HISOBOT ----------
  async function getReport(month) {
    if (!isMonth(month)) throw bad("Oy noto'g'ri formatda (YYYY-OO).");
    const snap = await db.get('SELECT * FROM month_snapshots WHERE month = ?', [month]);
    if (snap) return { ...JSON.parse(snap.data), closed: true, closedAt: snap.closed_at };
    return { ...computeMonth(await loadCalcData(db, month), month), closed: false };
  }

  // ---------- TO'LOVLAR (oylik o'tkazildimi yoki kutilmoqdami) ----------
  const addMonths = (m, n) => { const [y, mm] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mm - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
  const withStatus = (items, paid) => items.map((it) => {
    const p = paid.get(`${it.month}|${it.scope}|${it.personId}`);
    return { ...it, paid: !!p, paidAt: p ? p.paid_at : null, paidAmount: p ? p.amount : null, changed: p ? Math.round(p.amount) !== it.amount : false };
  });
  r.get('/payments', wrap(async (req, res) => {
    const month = req.query.month;
    if (!isMonth(month)) throw bad('Oyni tanlang.');
    const items = buildItems(await getReport(month));
    const paid = new Map((await db.all('SELECT * FROM payments WHERE month = ?', [month])).map((p) => [`${p.month}|${p.scope}|${p.person_id}`, p]));
    res.json(withStatus(items, paid));
  }));
  r.get('/payments/upcoming', wrap(async (req, res) => {
    const today = req.query.today;
    if (!Number.isFinite(parseDate(today))) throw bad('Sana noto\'g\'ri.');
    const dueMonth = isMonth(req.query.due_month) ? req.query.due_month : null;
    const cur = dueMonth || today.slice(0, 7);
    const paid = new Map((await db.all('SELECT * FROM payments')).map((p) => [`${p.month}|${p.scope}|${p.person_id}`, p]));
    const out = [];
    // tanlangan oyda o'tkazilishi kerak bo'lganlar (hisob oyi oldingi oy bo'lishi mumkin)
    for (let i = dueMonth ? -2 : -2; i <= (dueMonth ? 0 : 1); i++) out.push(...withStatus(buildItems(await getReport(addMonths(cur, i))), paid).filter((x) => !x.paid && (!dueMonth || x.dueISO.slice(0, 7) === dueMonth)));
    out.sort((a, b) => (a.dueISO < b.dueISO ? -1 : 1));
    res.json(out);
  }));
  // Hali o'tkazilmagan hamma oyliklar (barcha oylar bo'yicha): kimga, nima uchun, qancha
  r.get('/payments/unpaid', wrap(async (req, res) => {
    const today = req.query.today;
    if (!Number.isFinite(parseDate(today))) throw bad("Sana noto'g'ri.");
    const cur = today.slice(0, 7);
    const gs = await db.all('SELECT MIN(start_date) AS a FROM course_groups');
    let first = gs[0] && gs[0].a ? gs[0].a.slice(0, 7) : cur;
    if (first > cur) first = cur;
    let months = [];
    for (let m = first; m <= addMonths(cur, 1) && months.length < 60; m = addMonths(m, 1)) months.push(m);
    months = months.slice(-36);
    const paid = new Map((await db.all('SELECT * FROM payments')).map((p) => [`${p.month}|${p.scope}|${p.person_id}`, p]));
    const out = [];
    for (const m of months) out.push(...withStatus(buildItems(await getReport(m)), paid).filter((x) => !x.paid));
    const lim = new Date(parseDate(today) + 31 * 864e5).toISOString().slice(0, 10); // faqat 1 oy ichida o'tkazilishi kerak bo'lganlargacha
    out.sort((a, b) => (a.dueISO < b.dueISO ? -1 : a.dueISO > b.dueISO ? 1 : a.name.localeCompare(b.name)));
    res.json(out.filter((x) => x.dueISO <= lim));
  }));
  r.post('/payments/status', adminOnly, wrap(async (req, res) => {
    const { month, scope, person_id: personId, paid } = req.body || {};
    if (!isMonth(month)) throw bad('Oyni tanlang.');
    const item = buildItems(await getReport(month)).find((x) => x.scope === scope && x.personId === personId);
    if (!item) throw new HttpError(404, "To'lov topilmadi. Sahifani yangilang.");
    await db.run('DELETE FROM payments WHERE month = ? AND scope = ? AND person_id = ?', [month, scope, personId]);
    if (paid) await db.run('INSERT INTO payments (month, scope, person_id, amount, paid_at, paid_by) VALUES (?,?,?,?,?,?)', [month, scope, personId, item.amount, nowIso(), req.role]);
    res.json({ ok: true });
  }));

  // Hamma kerakli ma'lumot bitta so'rovda (frontend uchun)
  r.get('/bootstrap', wrap(async (req, res) => {
    const month = req.query.month;
    if (!isMonth(month)) throw bad('Oyni tanlang.');
    const [curators, rules, flows, groups, assignments, bonuses, stats, closed, terms] = await Promise.all([
      db.all('SELECT * FROM curators ORDER BY last_name, first_name'),
      db.all('SELECT * FROM salary_rules ORDER BY type, name'),
      db.all('SELECT * FROM flows ORDER BY created_at'),
      db.all('SELECT * FROM course_groups ORDER BY start_date, name'),
      db.all('SELECT * FROM assignments ORDER BY start_date'),
      db.all('SELECT * FROM bonuses WHERE month = ? ORDER BY created_at', [month]),
      db.all('SELECT * FROM group_students WHERE month = ?', [month]),
      closedMonths(db),
      db.all('SELECT * FROM group_terms'),
    ]);
    const report = await getReport(month);
    res.json({
      month, closedMonths: closed, isClosed: closed.includes(month),
      curators: curators.filter((c) => c.kind !== 'staff').map((c) => ({ ...c, active: Number(c.active) })),
      staff: curators.filter((c) => c.kind === 'staff').map((c) => ({ ...c, active: Number(c.active) })),
      rules: rules.map((x) => { const o = { ...x, params: JSON.parse(x.params), active: Number(x.active) }; o.summary = describe(o); return o; }),
      flows, groups: attachTerms(groups, terms),
      assignments: assignments.map((a) => ({ ...a, rule_snapshot: JSON.parse(a.rule_snapshot) })),
      bonuses: bonuses.map((b) => ({ ...b, rule_snapshot: JSON.parse(b.rule_snapshot) })),
      students: Object.fromEntries(stats.map((s) => [s.group_id, s.students])),
      report,
    });
  }));

  r.get('/report/:month', wrap(async (req, res) => res.json(await getReport(req.params.month))));

  r.post('/report/:month/close', adminOnly, wrap(async (req, res) => {
    const month = req.params.month;
    if (!isMonth(month)) throw bad('Oy xato.');
    if (await db.get('SELECT month FROM month_snapshots WHERE month = ?', [month])) throw bad('Bu oy allaqachon yopilgan.');
    const data = computeMonth(await loadCalcData(db, month), month);
    if (!data.curators.length) throw bad("Bu oyda hisoblanadigan ma'lumot yo'q — yopishga hojat yo'q.");
    await db.run('INSERT INTO month_snapshots (month, data, closed_at, closed_by) VALUES (?,?,?,?)', [month, JSON.stringify(data), nowIso(), req.role]);
    res.json({ ok: true });
  }));
  r.delete('/report/:month/close', adminOnly, wrap(async (req, res) => {
    await db.run('DELETE FROM month_snapshots WHERE month = ?', [req.params.month]);
    res.json({ ok: true });
  }));

  r.get('/report/:month/excel', wrap(async (req, res) => {
    const rep = await getReport(req.params.month);
    const wb = await buildWorkbook(rep);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="oylik-${req.params.month}.xlsx"`);
    res.end(await wb.xlsx.writeBuffer());
  }));

  return r;
};
