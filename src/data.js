'use strict';
const { monthRange, fmtDate, parseDate, overlap, monthsBetween, bad, HttpError } = require('./util');

const attachTerms = (groups, rows) => groups.map((g) => ({ ...g, terms: rows.filter((t) => t.group_id === g.id).sort((a, b) => a.month_no - b.month_no).map((t) => ({ ...t, month_no: Number(t.month_no), start_students: t.start_students == null ? null : Number(t.start_students), end_students: t.end_students == null ? null : Number(t.end_students), lessons_total: Number(t.lessons_total) || 13, leavers: JSON.parse(t.leavers || '[]') })) }));
const parseSnap = (r) => ({ ...r, rule_snapshot: JSON.parse(r.rule_snapshot) });

async function loadCalcData(q, month) {
  const [curators, flows, groups, assignments, bonuses, stats, terms] = await Promise.all([
    q.all('SELECT * FROM curators'),
    q.all('SELECT * FROM flows'),
    q.all('SELECT * FROM course_groups'),
    q.all('SELECT * FROM assignments'),
    q.all('SELECT * FROM bonuses WHERE month = ?', [month]),
    q.all('SELECT * FROM group_students WHERE month = ?', [month]),
    q.all('SELECT * FROM group_terms'),
  ]);
  return {
    curators, flows, groups: attachTerms(groups, terms),
    assignments: assignments.map(parseSnap),
    bonuses: bonuses.map(parseSnap),
    studentsByGroup: Object.fromEntries(stats.map((s) => [s.group_id, { count: s.students, fallback: false }])),
  };
}

const closedMonths = async (q) => (await q.all('SELECT month FROM month_snapshots')).map((r) => r.month);

// Yopilgan oylarga tegadigan o'zgarishlarni bloklaydi
async function assertMonthsOpen(q, months) {
  if (!months.length) return;
  const closed = new Set(await closedMonths(q));
  const hit = months.filter((m) => closed.has(m));
  if (hit.length) {
    throw new HttpError(409, `${hit.join(', ')} oyi yopilgan, o'zgartirib bo'lmaydi. Avval "Hisobot" bo'limida oyni qayta oching.`);
  }
}
const periodMonths = (s, e) => monthsBetween(s, e);

module.exports = { attachTerms, loadCalcData, closedMonths, assertMonthsOpen, periodMonths, parseSnap };
