'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeMonth, matchTier } = require('../src/calc');
const { periodOf, fmtDate } = require('../src/util');
const { normalizeParams } = require('../src/rules');

const snap = (type, params, name = 'Q') => ({ id: 'r', name, type, params });
const base = () => ({
  curators: [
    { id: 'c1', first_name: 'Ali', last_name: 'Valiyev', card_number: '8600123412341234' },
    { id: 'c2', first_name: 'Vali', last_name: 'Aliyev', card_number: '8600999988887777' },
  ],
  flows: [{ id: 'f1', name: '5-potok' }],
  groups: [{ id: 'g1', section: 'flow', flow_id: 'f1', name: 'A-1', start_date: '2026-10-01', end_date: '2026-12-31', student_count: 20 }],
  assignments: [],
  bonuses: [],
  studentsByGroup: {},
});

test('Fixed: butun oy — to\'liq summa', () => {
  const d = base();
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-01', end_date: '2026-12-31', rule_snapshot: snap('fixed', { amount: 3100000, proportional: true }) });
  const r = computeMonth(d, '2026-10');
  assert.equal(r.grandTotal, 3100000);
});

test('Oy o\'rtasida kurator almashsa — ulushlar yig\'indisi 100%', () => {
  const d = base();
  const rule = snap('fixed', { amount: 3100000, proportional: true });
  d.assignments.push(
    { id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-01', end_date: '2026-10-10', rule_snapshot: rule },
    { id: 'a2', group_id: 'g1', curator_id: 'c2', start_date: '2026-10-11', end_date: '2026-12-31', rule_snapshot: rule },
  );
  const r = computeMonth(d, '2026-10');
  const c1 = r.curators.find((c) => c.curatorId === 'c1');
  const c2 = r.curators.find((c) => c.curatorId === 'c2');
  assert.equal(c1.total, 1000000); // 3 100 000 × 10/31
  assert.equal(c2.total, 2100000); // 3 100 000 × 21/31
  assert.equal(c1.total + c2.total, 3100000);
  assert.equal(r.warnings.filter((w) => /belgilanmagan\./.test(w.text) && /kun uchun/.test(w.text)).length, 0);
});

test('Guruh oy o\'rtasida boshlansa — denominator guruhning faol kunlari', () => {
  const d = base();
  d.groups[0].start_date = '2026-10-16';
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-16', end_date: '2026-12-31', rule_snapshot: snap('fixed', { amount: 1600000, proportional: true }) });
  assert.equal(computeMonth(d, '2026-10').grandTotal, 1600000);
});

test('Kunlik stavka', () => {
  const d = base();
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-05', end_date: '2026-10-14', rule_snapshot: snap('daily', { rate: 100000 }) });
  assert.equal(computeMonth(d, '2026-10').curators[0].total, 1000000);
});

test('Daraja (tiers): talaba soniga mos', () => {
  const tiers = [{ from: 1, to: 10, amount: 50000 }, { from: 11, to: 20, amount: 80000 }, { from: 21, to: null, amount: 100000 }];
  assert.equal(matchTier(tiers, 15).amount, 80000);
  assert.equal(matchTier(tiers, 50).amount, 100000);
  assert.equal(matchTier(tiers, 0), null);
  const d = base();
  d.groups[0] = { ...d.groups[0], section: 'rustilida', flow_id: null };
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-01', end_date: '2026-10-31', rule_snapshot: snap('tiers', { tiers }) });
  d.studentsByGroup.g1 = { count: 13, fallback: false };
  const r = computeMonth(d, '2026-10');
  assert.equal(r.totals.rustilida, 13 * 80000); // talaba soni × 1 talaba stavkasi
  d.studentsByGroup.g1 = { count: 21, fallback: false };
  assert.equal(computeMonth(d, '2026-10').totals.rustilida, 21 * 100000);
});

test('Bonuslar va sifat nazorati: xabar tekshiruvi, 5% sotuv, Rustilida sotuvi, rahbar oyligi', () => {
  const d = base();
  d.curators.push(
    { id: 's1', kind: 'staff', staff_role: 'inspector', first_name: 'Nodira', last_name: 'Sifatova', card_number: '8600000000000001', active: 1 },
    { id: 'h1', kind: 'staff', staff_role: 'head', monthly_salary: 5000000, first_name: 'Rahbar', last_name: 'Nazoratov', card_number: '8600000000000002', active: 1 });
  d.groups.push({ id: 'g2', section: 'rustilida', flow_id: null, name: 'RU-1', start_date: '2026-09-15', end_date: '2027-02-15', student_count: 10 });
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-01', end_date: '2026-10-31', rule_snapshot: snap('fixed', { amount: 1000000, proportional: true }) });
  d.bonuses.push(
    { id: 'b1', month: '2026-10', kind: 'messages', curator_id: 's1', group_id: 'g1', quantity: 3, rule_snapshot: snap('per_unit', { price: 50000, expected: 4 }) },
    { id: 'b2', month: '2026-10', kind: 'flow_sales', curator_id: 's1', group_id: null, quantity: 20000000, rule_snapshot: snap('percent', { percent: 5 }) },
    { id: 'b3', month: '2026-10', kind: 'rustilida_sales', curator_id: 's1', group_id: 'g2', month_no: 2, quantity: 4, rule_snapshot: snap('per_sale', { amount: 100000 }) },
    // eski/noto'g'ri yozuvlar hisobga olinmaydi: kuratorga yozilgan bonuslar
    { id: 'b4', month: '2026-10', kind: 'messages', curator_id: 'c1', group_id: 'g1', quantity: 9, rule_snapshot: snap('per_unit', { price: 50000, expected: 4 }) });
  const r = computeMonth(d, '2026-10');
  assert.equal(r.totals.bonus, 0);
  assert.equal(r.totals.qc, 1000000 + 150000 + 400000 + 5000000);
  assert.equal(r.curators.find((c) => c.curatorId === 'h1').total, 5000000);
  assert.ok(r.warnings.some((w) => /xabar tekshiruvi 3 ta \(me'yor 4 ta\)/.test(w.text)));
  assert.equal(r.curators.find((c) => c.curatorId === 's1').lines.find((l) => l.bonusKind === 'rustilida_sales').payISO, '2026-11-01');
});

test('Rustilida: to\'lov guruh tugash sanasining kunida (har oy), davr oldingi to\'lovdan keyin boshlanadi', () => {
  const { periodByEndDay } = require('../src/util');
  const f = (a, b, m) => { const p = periodByEndDay(a, b, m); return p && [fmtDate(p[0]), fmtDate(p[1])]; };
  assert.deepEqual(f('2026-09-20', '2027-02-15', '2026-09'), null);
  assert.deepEqual(f('2026-09-20', '2027-02-15', '2026-10'), ['2026-09-20', '2026-10-15']);
  assert.deepEqual(f('2026-09-20', '2027-02-15', '2026-11'), ['2026-10-16', '2026-11-15']);
  assert.deepEqual(f('2026-09-20', '2027-02-15', '2027-02'), ['2027-01-16', '2027-02-15']);
  assert.equal(f('2026-09-20', '2027-02-15', '2027-03'), null);
  // boshlanish kuni to'lov kuni bo'lsa — birinchi to'lov keyingi oyda (61-guruh)
  assert.equal(f('2026-09-22', '2026-10-22', '2026-09'), null);
  assert.deepEqual(f('2026-09-22', '2026-10-22', '2026-10'), ['2026-09-22', '2026-10-22']);
  assert.deepEqual(f('2026-10-01', '2026-10-22', '2026-10'), ['2026-10-01', '2026-10-22']); // bir oylik guruh
  assert.deepEqual(f('2026-08-31', '2026-12-31', '2026-11'), ['2026-11-01', '2026-11-30']); // 31-kun, qisqa oy
});

test('Snapshot: qoida o\'zgarsa ham eski biriktirish o\'zgarmaydi', () => {
  const d = base();
  const rule = { id: 'r1', name: 'Eski', type: 'daily', params: { rate: 100000 } };
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-01', end_date: '2026-10-02', rule_snapshot: JSON.parse(JSON.stringify(rule)) });
  rule.params.rate = 999999; // admin keyin narxni o'zgartirdi
  assert.equal(computeMonth(d, '2026-10').grandTotal, 200000);
});

test('Kurator belgilanmagan kunlar haqida ogohlantirish', () => {
  const d = base();
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-01', end_date: '2026-10-20', rule_snapshot: snap('fixed', { amount: 1000, proportional: true }) });
  const r = computeMonth(d, '2026-10');
  assert.ok(r.warnings.some((w) => /11 kun uchun kurator belgilanmagan/.test(w.text)));
});

test('Darajalar kesishsa — xato', () => {
  assert.throws(() => normalizeParams('tiers', { tiers: [{ from: 1, to: 10, amount: 1 }, { from: 5, to: 20, amount: 2 }] }));
  assert.throws(() => normalizeParams('percent', { percent: 150 }));
});

test('Hisob davri potok boshlangan kunga bog\'liq (31-sana)', () => {
  const f = (a, b, m) => { const p = periodOf(a, b, m); return p && [fmtDate(p[0]), fmtDate(p[1])]; };
  assert.deepEqual(f('2026-10-31', '2027-03-31', '2026-10'), ['2026-10-31', '2026-11-29']);
  assert.deepEqual(f('2026-10-31', '2027-03-31', '2026-11'), ['2026-11-30', '2026-12-30']);
  assert.deepEqual(f('2026-10-31', '2027-03-31', '2026-12'), ['2026-12-31', '2027-01-30']);
  assert.deepEqual(f('2026-10-31', '2027-03-31', '2027-02'), ['2027-02-28', '2027-03-30']);
  assert.equal(f('2026-10-31', '2027-03-31', '2026-09'), null);
  assert.deepEqual(f('2026-10-01', '2026-12-31', '2026-12'), ['2026-12-01', '2026-12-31']);
  assert.deepEqual(f('2026-10-15', '2026-12-20', '2026-12'), ['2026-12-15', '2026-12-20']); // oxirgi davr potok tugashida kesiladi
});

test('31-sanadan boshlangan potok: kurator almashsa davr kunlariga bo\'linadi, almashmasa to\'liq', () => {
  const d = base();
  d.flows[0] = { id: 'f1', name: '9-potok' };
  d.groups[0] = { ...d.groups[0], start_date: '2026-10-31', end_date: '2027-03-31' };
  const rule = snap('fixed', { amount: 3000000, proportional: true });
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-31', end_date: '2026-11-30', rule_snapshot: rule });
  d.assignments.push({ id: 'a2', group_id: 'g1', curator_id: 'c2', start_date: '2026-12-01', end_date: '2027-03-31', rule_snapshot: rule });
  const nov = computeMonth(d, '2026-11'); // davr 30.11–30.12: c1 faqat 1 kun, c2 30 kun / 31
  const l1 = nov.curators.find((c) => c.curatorId === 'c1').lines[0];
  assert.equal(l1.workedDays, 1);
  assert.equal(l1.cycle, '30.11.2026 – 30.12.2026');
  assert.equal(l1.payDate, '31.12.2026');
  assert.equal(nov.grandTotal, 3000000);
  const oct = computeMonth(d, '2026-10'); // 31.10–29.11, c1 to'liq ishladi
  assert.equal(oct.curators.length, 1);
  assert.equal(oct.grandTotal, 3000000);
});

test('Yopilgan guruh: yopilgan sanadan keyingi oylarda hisobotda va ogohlantirishda chiqmaydi', () => {
  const d = base();
  d.assignments.push({ id: 'a1', group_id: 'g1', curator_id: 'c1', start_date: '2026-10-01', end_date: '2026-12-31', rule_snapshot: snap('fixed', { amount: 1000000, proportional: true }) });
  d.groups[0].closed_at = '2026-10-15';
  assert.equal(computeMonth(d, '2026-10').grandTotal, 1000000); // yopilgan oyning o'zi hisoblanadi
  const nov = computeMonth(d, '2026-11');
  assert.equal(nov.grandTotal, 0);
  assert.equal(nov.warnings.length, 0);
  d.groups[0].closed_at = null; d.flows[0].closed_at = '2026-10-20'; // potok yopilsa — guruhlari ham
  assert.equal(computeMonth(d, '2026-11').grandTotal, 0);
});

test('Rustilida: oy davri sanalari va chiqib ketgan talaba (13 darsdan 8 tasi) — kasr bo\'yicha hisob', () => {
  const d = base();
  d.groups = [{ id: 'g2', section: 'rustilida', flow_id: null, name: 'RU-61', start_date: '2026-09-22', end_date: '2027-02-22', student_count: 19,
    terms: [{ group_id: 'g2', month_no: 1, start_date: '2026-09-22', end_date: '2026-10-25', start_students: 19, end_students: 18, lessons_total: 13, leavers: [8] }] }];
  d.assignments.push({ id: 'a1', group_id: 'g2', curator_id: 'c1', start_date: '2026-09-22', end_date: '2027-02-22',
    rule_snapshot: snap('tiers', { tiers: [{ from: 1, to: 8, amount: 100000 }, { from: 9, to: 25, amount: 80000 }] }) });
  const r = computeMonth(d, '2026-10');
  const l = r.curators[0].lines[0];
  assert.equal(l.amount, Math.round((18 + 8 / 13) * 80000));
  assert.equal(l.payISO, '2026-10-25');
  assert.equal(l.warnings.length, 0);
  // dars soni kiritilmagan bo'lsa ogohlantirish
  d.groups[0].terms[0].leavers = [];
  const w = computeMonth(d, '2026-10').curators[0].lines[0];
  assert.equal(w.amount, 18 * 80000);
  assert.ok(w.warnings.some((x) => /dars soni kiritilmagan/.test(x)));
  // keyingi oyda davr oldingi tugash sanasidan keyin boshlanadi (23.10 emas, 26.10)
  const nov = computeMonth(d, '2026-11').curators[0].lines[0];
  assert.equal(nov.from, '2026-10-26');
});
