'use strict';
// Boshqaruv markazi: potoklar, guruhlar, kurator biriktirish (pro-rata + snapshot)
const express = require('express');
const { adminOnly } = require('../auth');
const U = require('../util');
const { wrap, bad, HttpError, uid, nowIso, parseDate, fmtDate, overlap, reqStr, reqNum, reqDate, isMonth, periodOf } = U;
const { snapshotOf } = require('../rules');
const { assertMonthsOpen, periodMonths } = require('../data');

module.exports = (db) => {
  const r = express.Router();

  // ---------- POTOKLAR ----------
  // Potokning boshlanish/tugash sanasi bor; ichidagi guruhlar shu sanalarni oladi.
  // Oylik hisob davri har oy potok boshlangan kunda boshlanadi (31-sana bo'lsa, qisqa oylarda oxirgi kunda).
  function readFlow(b) {
    const name = reqStr(b.name, 'Potok nomi', 80);
    const start = reqDate(b.start_date, 'Potok boshlanish sanasi');
    const end = reqDate(b.end_date, 'Potok tugash sanasi');
    if (parseDate(end) < parseDate(start)) throw bad("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.");
    return { name, start, end, note: U.optStr(b.note, 300) };
  }
  r.get('/flows', wrap(async (req, res) => res.json(await db.all('SELECT * FROM flows ORDER BY created_at'))));
  r.post('/flows', adminOnly, wrap(async (req, res) => {
    const f = readFlow(req.body || {});
    if (await db.get('SELECT id FROM flows WHERE LOWER(name) = LOWER(?)', [f.name])) throw bad('Bunday nomli potok allaqachon bor.');
    const id = uid();
    await db.run('INSERT INTO flows (id, name, note, start_date, end_date, created_at) VALUES (?,?,?,?,?,?)', [id, f.name, f.note, f.start, f.end, nowIso()]);
    res.status(201).json({ id });
  }));
  r.put('/flows/:id', adminOnly, wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM flows WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Potok topilmadi.');
    const f = readFlow(req.body || {});
    const dup = await db.get('SELECT id FROM flows WHERE LOWER(name) = LOWER(?) AND id <> ?', [f.name, req.params.id]);
    if (dup) throw bad('Bunday nomli potok allaqachon bor.');
    if (old.start_date !== f.start || old.end_date !== f.end) {
      const asg = await db.all('SELECT a.* FROM assignments a JOIN course_groups g ON g.id = a.group_id WHERE g.flow_id = ?', [old.id]);
      for (const a of asg) {
        if (parseDate(a.start_date) < parseDate(f.start) || parseDate(a.end_date) > parseDate(f.end)) {
          throw bad(`Sanalarni bunday o'zgartirib bo'lmaydi: kurator biriktirish (${a.start_date} – ${a.end_date}) yangi potok sanalaridan tashqarida qoladi. Avval biriktirishni o'zgartiring.`);
        }
      }
      if (asg.length) await assertMonthsOpen(db, [...new Set([...periodMonths(old.start_date, old.end_date), ...periodMonths(f.start, f.end)])]);
    }
    await db.tx(async (q) => {
      await q.run('UPDATE flows SET name=?, note=?, start_date=?, end_date=? WHERE id=?', [f.name, f.note, f.start, f.end, old.id]);
      await q.run('UPDATE course_groups SET start_date=?, end_date=? WHERE flow_id=?', [f.start, f.end, old.id]);
    });
    res.json({ ok: true });
  }));
  r.delete('/flows/:id', adminOnly, wrap(async (req, res) => {
    const n = await db.get('SELECT COUNT(*) AS n FROM course_groups WHERE flow_id = ?', [req.params.id]);
    if (Number(n.n) > 0) throw new HttpError(409, "Potok ichida guruhlar bor. Avval guruhlarni o'chiring.");
    await db.run('DELETE FROM flows WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  }));

  // ---------- GURUHLAR ----------
  async function readGroup(b, id) {
    const section = b.section === 'rustilida' ? 'rustilida' : 'flow';
    const name = reqStr(b.name, 'Guruh nomi', 80);
    let start, end, flowId = null;
    if (section === 'flow') {
      flowId = b.flow_id;
      const flow = flowId && await db.get('SELECT * FROM flows WHERE id = ?', [flowId]);
      if (!flow) throw bad('Potokni tanlang.');
      start = flow.start_date; end = flow.end_date; // guruh potok sanalarini oladi
    } else {
      start = reqDate(b.start_date, 'Boshlanish sanasi (majburiy)');
      end = reqDate(b.end_date, 'Tugash sanasi (majburiy)');
      if (parseDate(end) < parseDate(start)) throw bad("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.");
    }
    const students = reqNum(b.student_count ?? 0, 'Talaba soni', { int: true, max: 10000 });
    const dup = await db.get(
      'SELECT id FROM course_groups WHERE section = ? AND COALESCE(flow_id, \'\') = ? AND LOWER(name) = LOWER(?) AND id <> ?',
      [section, flowId || '', name, id || '']);
    if (dup) throw bad('Bu potok/bo\'limda bunday nomli guruh allaqachon bor.');
    return { section, name, start, end, flowId, students };
  }
  r.get('/groups', wrap(async (req, res) => res.json(await db.all('SELECT * FROM course_groups ORDER BY start_date, name'))));
  r.post('/groups', adminOnly, wrap(async (req, res) => {
    const g = await readGroup(req.body || {});
    const id = uid();
    await db.run('INSERT INTO course_groups (id, section, flow_id, name, start_date, end_date, student_count, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, g.section, g.flowId, g.name, g.start, g.end, g.students, nowIso()]);
    res.status(201).json({ id });
  }));
  r.put('/groups/:id', adminOnly, wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM course_groups WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Guruh topilmadi.');
    const g = await readGroup(req.body || {}, req.params.id);
    const asg = await db.all('SELECT * FROM assignments WHERE group_id = ?', [req.params.id]);
    if (asg.length) {
      // Guruh sanalari o'zgarsa, kuratorlarning davri guruhdan tashqariga chiqib ketmasin
      for (const a of asg) {
        if (parseDate(a.start_date) < parseDate(g.start) || parseDate(a.end_date) > parseDate(g.end)) {
          throw bad(`Sanalarni bunday o'zgartirib bo'lmaydi: kurator biriktirish (${a.start_date} – ${a.end_date}) yangi guruh sanalaridan tashqarida qoladi. Avval biriktirishni o'zgartiring.`);
        }
      }
      const months = new Set([...periodMonths(old.start_date, old.end_date), ...periodMonths(g.start, g.end)]);
      if (old.start_date !== g.start || old.end_date !== g.end) await assertMonthsOpen(db, [...months]);
    }
    await db.run('UPDATE course_groups SET name=?, start_date=?, end_date=?, flow_id=?, student_count=? WHERE id=?',
      [g.name, g.start, g.end, g.flowId, g.students, req.params.id]);
    res.json({ ok: true });
  }));
  // Guruh / potokni yopish (yakunlash) va qayta ochish
  const closeRoutes = (table, label) => {
    r.post(`/${table === 'flows' ? 'flows' : 'groups'}/:id/close`, adminOnly, wrap(async (req, res) => {
      const row = await db.get(`SELECT id FROM ${table} WHERE id = ?`, [req.params.id]);
      if (!row) throw new HttpError(404, `${label} topilmadi.`);
      const date = reqDate((req.body || {}).date, 'Yopilgan sana');
      await db.run(`UPDATE ${table} SET closed_at = ? WHERE id = ?`, [date, req.params.id]);
      res.json({ ok: true });
    }));
    r.post(`/${table === 'flows' ? 'flows' : 'groups'}/:id/reopen`, adminOnly, wrap(async (req, res) => {
      await db.run(`UPDATE ${table} SET closed_at = NULL WHERE id = ?`, [req.params.id]);
      res.json({ ok: true });
    }));
  };
  closeRoutes('flows', 'Potok'); closeRoutes('course_groups', 'Guruh');
  r.delete('/groups/:id', adminOnly, wrap(async (req, res) => {
    const n = await db.get('SELECT COUNT(*) AS n FROM assignments WHERE group_id = ?', [req.params.id]);
    if (Number(n.n) > 0) throw new HttpError(409, "Bu guruhda kurator biriktirilgan. Avval biriktirishlarni o'chiring.");
    const b = await db.get('SELECT COUNT(*) AS n FROM bonuses WHERE group_id = ?', [req.params.id]);
    if (Number(b.n) > 0) throw new HttpError(409, "Bu guruh bo'yicha bonus yozuvlari bor. Avval ularni o'chiring.");
    await db.run('DELETE FROM group_students WHERE group_id = ?', [req.params.id]);
    await db.run('DELETE FROM group_terms WHERE group_id = ?', [req.params.id]);
    await db.run('DELETE FROM course_groups WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  }));
  // Oylik talaba soni (Operator ham kirita oladi)
  r.put('/groups/:id/students', wrap(async (req, res) => {
    const month = req.body?.month;
    if (!isMonth(month)) throw bad('Oyni tanlang.');
    const students = reqNum(req.body?.students, 'Talaba soni', { int: true, max: 10000 });
    if (!(await db.get('SELECT id FROM course_groups WHERE id = ?', [req.params.id]))) throw new HttpError(404, 'Guruh topilmadi.');
    await assertMonthsOpen(db, [month]);
    await db.run('INSERT INTO group_students (group_id, month, students) VALUES (?,?,?) ON CONFLICT (group_id, month) DO UPDATE SET students = excluded.students',
      [req.params.id, month, students]);
    res.json({ ok: true });
  }));

  // Rustilida.uz guruhining 1–5 oylik davrlari: sanalar, oy boshi/oxiridagi talabalar, chiqib ketganlarning dars soni
  r.put('/groups/:id/terms/:no', wrap(async (req, res) => {
    const g = await db.get('SELECT * FROM course_groups WHERE id = ?', [req.params.id]);
    if (!g) throw new HttpError(404, 'Guruh topilmadi.');
    if (g.section !== 'rustilida') throw bad('Oy davrlari faqat Rustilida.uz guruhlari uchun.');
    const no = Number(req.params.no);
    if (!Number.isInteger(no) || no < 1 || no > 5) throw bad('Oy raqami 1 dan 5 gacha bo\'lishi kerak.');
    const b = req.body || {};
    const old = await db.get('SELECT * FROM group_terms WHERE group_id = ? AND month_no = ?', [g.id, no]);
    if (req.role !== 'admin' && !old) throw new HttpError(403, "Oy sanalarini faqat Admin belgilaydi. Avval Admin sanalarni kiritsin.");
    const start = req.role === 'admin' ? reqDate(b.start_date, 'Oy boshlanish sanasi') : old.start_date;
    const end = req.role === 'admin' ? reqDate(b.end_date, 'Oy tugash sanasi') : old.end_date;
    if (parseDate(end) < parseDate(start)) throw bad("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.");
    if (parseDate(start) < parseDate(g.start_date) || parseDate(end) > parseDate(g.end_date)) throw bad(`Sanalar guruh muddati (${g.start_date} – ${g.end_date}) ichida bo'lishi kerak.`);
    const others = await db.all('SELECT * FROM group_terms WHERE group_id = ? AND month_no <> ?', [g.id, no]);
    for (const o of others) {
      if (o.end_date.slice(0, 7) === end.slice(0, 7)) throw bad(`${o.month_no}-oy ham ${end.slice(0, 7)} oyida tugaydi. Har oyda bitta davr tugashi kerak.`);
      if (overlap(parseDate(start), parseDate(end), parseDate(o.start_date), parseDate(o.end_date))) throw bad(`Sanalar ${o.month_no}-oy (${o.start_date} – ${o.end_date}) bilan kesishadi.`);
    }
    const opt = (v, label) => (v === '' || v === null || v === undefined ? null : reqNum(v, label, { int: true, max: 10000 }));
    const s0 = opt(b.start_students, "Oy boshidagi talabalar soni"), s1 = opt(b.end_students, "Oy oxiridagi talabalar soni");
    if ((s0 === null) !== (s1 === null)) throw bad("Oy boshi va oxiridagi talabalar sonini ikkalasini ham kiriting.");
    const total = b.lessons_total === undefined || b.lessons_total === '' ? 13 : reqNum(b.lessons_total, 'Oydagi jami darslar soni', { int: true, min: 1, max: 60 });
    const leavers = (Array.isArray(b.leavers) ? b.leavers : []).map((x) => reqNum(x, "Chiqib ketgan o'quvchining dars soni", { int: true, min: 0, max: total }));
    if (s0 !== null && leavers.length > s0 - s1) throw bad("Chiqib ketgan o'quvchilar soni talabalar farqidan ko'p bo'lishi mumkin emas.");
    await assertMonthsOpen(db, [...new Set([end.slice(0, 7), old && old.end_date.slice(0, 7)].filter(Boolean))]);
    await db.run('DELETE FROM group_terms WHERE group_id = ? AND month_no = ?', [g.id, no]);
    await db.run('INSERT INTO group_terms (group_id, month_no, start_date, end_date, start_students, end_students, lessons_total, leavers) VALUES (?,?,?,?,?,?,?,?)',
      [g.id, no, start, end, s0, s1, total, JSON.stringify(leavers)]);
    res.json({ ok: true });
  }));
  r.delete('/groups/:id/terms/:no', adminOnly, wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM group_terms WHERE group_id = ? AND month_no = ?', [req.params.id, Number(req.params.no)]);
    if (!old) throw new HttpError(404, 'Oy topilmadi.');
    await assertMonthsOpen(db, [old.end_date.slice(0, 7)]);
    await db.run('DELETE FROM group_terms WHERE group_id = ? AND month_no = ?', [req.params.id, Number(req.params.no)]);
    res.json({ ok: true });
  }));

  // ---------- KURATOR BIRIKTIRISH ----------
  const ASSIGNABLE = ['fixed', 'daily', 'tiers'];

  async function ruleSnapshot(ruleId) {
    const row = await ruleId && await db.get('SELECT * FROM salary_rules WHERE id = ?', [ruleId]);
    if (!row) throw bad('Oylik qoidasini tanlang.');
    if (!ASSIGNABLE.includes(row.type)) throw bad("Bu qoida guruhga biriktirilmaydi (u bonus uchun).");
    if (!Number(row.active)) throw bad('Bu qoida o\'chirilgan (faol emas). Boshqasini tanlang.');
    return snapshotOf(row);
  }
  async function readAssignment(b, group, q = db) {
    const curator = b.curator_id && await q.get('SELECT * FROM curators WHERE id = ?', [b.curator_id]);
    if (!curator) throw bad('Kuratorni tanlang.');
    const start = reqDate(b.start_date, 'Boshlanish sanasi');
    const end = reqDate(b.end_date, 'Tugash sanasi');
    if (parseDate(end) < parseDate(start)) throw bad("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.");
    if (parseDate(start) < parseDate(group.start_date) || parseDate(end) > parseDate(group.end_date)) {
      throw bad(`Sanalar guruh muddati (${group.start_date} – ${group.end_date}) ichida bo'lishi kerak.`);
    }
    return { curator, start, end };
  }
  async function assertNoOverlap(q, groupId, start, end, exceptIds = []) {
    const rows = await q.all('SELECT a.*, c.first_name, c.last_name FROM assignments a JOIN curators c ON c.id = a.curator_id WHERE a.group_id = ?', [groupId]);
    for (const a of rows) {
      if (exceptIds.includes(a.id)) continue;
      if (overlap(parseDate(start), parseDate(end), parseDate(a.start_date), parseDate(a.end_date))) {
        throw bad(`${a.last_name} ${a.first_name} bu guruhda ${a.start_date} – ${a.end_date} kunlari ishlagan. Bir guruhda bir vaqtda ikki kurator bo'lmaydi — sanalarni tekshiring yoki "Kuratorni almashtirish" tugmasidan foydalaning.`);
      }
    }
  }
  const getGroup = async (id) => {
    const g = id && await db.get('SELECT * FROM course_groups WHERE id = ?', [id]);
    if (!g) throw bad('Guruhni tanlang.');
    return g;
  };

  r.get('/assignments', wrap(async (req, res) => {
    const rows = await db.all('SELECT * FROM assignments ORDER BY start_date');
    res.json(rows.map((a) => ({ ...a, rule_snapshot: JSON.parse(a.rule_snapshot) })));
  }));

  r.post('/assignments', adminOnly, wrap(async (req, res) => {
    const b = req.body || {};
    const group = await getGroup(b.group_id);
    const { curator, start, end } = await readAssignment(b, group);
    if (!Number(curator.active)) throw bad('Bu kurator "faol emas". Avval uni faollashtiring.');
    const snap = await ruleSnapshot(b.rule_id);
    await assertNoOverlap(db, group.id, start, end);
    await assertMonthsOpen(db, periodMonths(start, end));
    const id = uid();
    await db.run('INSERT INTO assignments (id, group_id, curator_id, rule_id, rule_snapshot, start_date, end_date, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, group.id, curator.id, b.rule_id, JSON.stringify(snap), start, end, nowIso()]);
    res.status(201).json({ id });
  }));

  r.put('/assignments/:id', adminOnly, wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Biriktirish topilmadi.');
    const b = req.body || {};
    const group = await getGroup(old.group_id);
    const { curator, start, end } = await readAssignment(b, group);
    const snap = b.rule_id && b.rule_id !== old.rule_id ? await ruleSnapshot(b.rule_id) : JSON.parse(old.rule_snapshot);
    await assertNoOverlap(db, group.id, start, end, [old.id]);
    await assertMonthsOpen(db, [...periodMonths(old.start_date, old.end_date), ...periodMonths(start, end)]);
    await db.run('UPDATE assignments SET curator_id=?, rule_id=?, rule_snapshot=?, start_date=?, end_date=? WHERE id=?',
      [curator.id, b.rule_id || old.rule_id, JSON.stringify(snap), start, end, old.id]);
    res.json({ ok: true });
  }));

  r.delete('/assignments/:id', adminOnly, wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Biriktirish topilmadi.');
    await assertMonthsOpen(db, periodMonths(old.start_date, old.end_date));
    await db.run('DELETE FROM assignments WHERE id = ?', [old.id]);
    res.json({ ok: true });
  }));

  // Kuratorni almashtirish: eskisi (almashtirish sanasidan bir kun oldin) tugaydi, yangisi boshlanadi
  r.post('/assignments/:id/replace', adminOnly, wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Biriktirish topilmadi.');
    const b = req.body || {};
    const group = await getGroup(old.group_id);
    const change = reqDate(b.start_date, 'Yangi kurator boshlanish sanasi');
    const t = parseDate(change);
    if (t <= parseDate(old.start_date) || t > parseDate(old.end_date)) {
      throw bad(`Almashtirish sanasi ${old.start_date} dan keyin va ${old.end_date} dan oldin bo'lishi kerak (eski kurator kamida 1 kun ishlagan bo'lishi kerak).`);
    }
    const { curator, start, end } = await readAssignment({ ...b, start_date: change }, group);
    if (!Number(curator.active)) throw bad('Bu kurator "faol emas".');
    if (curator.id === old.curator_id) throw bad('Yangi kurator eskisidan farq qilishi kerak.');
    const snap = b.rule_id ? await ruleSnapshot(b.rule_id) : JSON.parse(old.rule_snapshot);
    const oldNewEnd = fmtDate(t - U.MS);
    await assertNoOverlap(db, group.id, start, end, [old.id]);
    await assertMonthsOpen(db, [...periodMonths(old.start_date, old.end_date), ...periodMonths(start, end)]);
    const id = uid();
    await db.tx(async (q) => {
      await q.run('UPDATE assignments SET end_date = ? WHERE id = ?', [oldNewEnd, old.id]);
      await q.run('INSERT INTO assignments (id, group_id, curator_id, rule_id, rule_snapshot, start_date, end_date, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, group.id, curator.id, b.rule_id || old.rule_id, JSON.stringify(snap), start, end, nowIso()]);
    });
    res.status(201).json({ id });
  }));

  // Qoidaning hozirgi (yangi) qiymatini mavjud biriktirishga qo'llash
  r.post('/assignments/:id/refresh', adminOnly, wrap(async (req, res) => {
    const old = await db.get('SELECT * FROM assignments WHERE id = ?', [req.params.id]);
    if (!old) throw new HttpError(404, 'Biriktirish topilmadi.');
    const snap = await ruleSnapshot(old.rule_id);
    await assertMonthsOpen(db, periodMonths(old.start_date, old.end_date));
    await db.run('UPDATE assignments SET rule_snapshot = ? WHERE id = ?', [JSON.stringify(snap), old.id]);
    res.json({ ok: true });
  }));

  return r;
};
