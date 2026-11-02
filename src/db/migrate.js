'use strict';
// Eski bazalarni yangilash (xavfsiz: ikki marta ishga tushsa ham zarar qilmaydi).
const ALTERS = [
  'ALTER TABLE flows ADD COLUMN start_date TEXT',
  'ALTER TABLE flows ADD COLUMN end_date TEXT',
  "ALTER TABLE curators ADD COLUMN kind TEXT NOT NULL DEFAULT 'curator'",
  'ALTER TABLE curators ADD COLUMN department TEXT',
  'ALTER TABLE curators ADD COLUMN staff_role TEXT',
  'ALTER TABLE curators ADD COLUMN monthly_salary DOUBLE PRECISION',
  'ALTER TABLE bonuses ADD COLUMN month_no INTEGER',
  'ALTER TABLE flows ADD COLUMN closed_at TEXT',
  'ALTER TABLE course_groups ADD COLUMN closed_at TEXT',
];
const addYear = (iso) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;

// q: { all(sql, params), run(sql, params) }
async function migrate(q) {
  for (const sql of ALTERS) { try { await q.run(sql); } catch { /* ustun allaqachon bor */ } }
  const flows = await q.all('SELECT * FROM flows WHERE start_date IS NULL OR end_date IS NULL');
  for (const f of flows) {
    const g = (await q.all('SELECT MIN(start_date) AS a, MAX(end_date) AS b FROM course_groups WHERE flow_id = ?', [f.id]))[0] || {};
    const start = g.a || f.created_at.slice(0, 10);
    const end = g.b || addYear(start);
    await q.run('UPDATE flows SET start_date = ?, end_date = ? WHERE id = ?', [start, end, f.id]);
    await q.run('UPDATE course_groups SET start_date = ?, end_date = ? WHERE flow_id = ?', [start, end, f.id]);
  }
}
module.exports = { migrate };
