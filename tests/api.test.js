'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { createApp } = require('../server');

test('To\'liq oqim: kurator → qoida → potok → guruh → almashtirish → bonus → hisobot → yopish', async (t) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kur-')), 't.db');
  const { app, db } = await createApp({ sqlitePath: file, databaseUrl: '', adminPassword: 'a', operatorPassword: 'o', sessionSecret: 's', sessionHours: 1 });
  const server = app.listen(0);
  t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, url, body, token) => {
    const res = await fetch(base + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : await res.arrayBuffer() };
  };
  const login = async (role, password) => (await call('POST', '/login', { role, password })).body.token;

  assert.equal((await call('POST', '/login', { role: 'admin', password: 'x' })).status, 401);
  assert.equal((await call('GET', '/curators')).status, 401);
  const A = await login('admin', 'a');
  const O = await login('operator', 'o');
  assert.equal((await call('POST', '/curators', {}, O)).status, 403);

  const mk = async (first, last, card) => (await call('POST', '/curators', { first_name: first, last_name: last, birth_day: 5, birth_month: 3, birth_year: 1995, hire_date: '2025-01-10', card_number: card }, A));
  assert.equal((await mk('Ali', 'Valiyev', '8600 1234 1234 1234')).status, 201);
  assert.equal((await mk('Vali', 'Aliyev', '8600123412341234')).status, 400); // takroriy karta
  const c2 = await mk('Vali', 'Aliyev', '9860 1111 2222 3333');
  assert.equal((await call('POST', '/curators', { first_name: 'X', last_name: 'Y', birth_day: 31, birth_month: 2, birth_year: 1990, hire_date: '2025-01-01', card_number: '1111222233334444' }, A)).status, 400);

  const fixed = (await call('POST', '/rules', { name: 'Potok 3 100 000', type: 'fixed', params: { amount: 3100000, proportional: true } }, A)).body.id;
  const price = (await call('POST', '/rules', { name: 'Tekshiruv 50k', type: 'per_unit', params: { price: 50000, expected: 4 } }, A)).body.id;
  const pct = (await call('POST', '/rules', { name: 'Sotuv 5%', type: 'percent', params: { percent: 5 } }, A)).body.id;

  const flow = (await call('POST', '/flows', { name: '5-potok', start_date: '2026-10-01', end_date: '2026-12-31' }, A)).body.id;
  const grp = (await call('POST', '/groups', { section: 'flow', flow_id: flow, name: 'A-1', student_count: 15 }, A)).body.id;

  const boot0 = (await call('GET', '/bootstrap?month=2026-10', null, A)).body;
  const c1id = boot0.curators.find((c) => c.first_name === 'Ali').id;
  const asg = await call('POST', '/assignments', { group_id: grp, curator_id: c1id, rule_id: fixed, start_date: '2026-10-01', end_date: '2026-12-31' }, A);
  assert.equal(asg.status, 201);
  // kesishuvchi sana — rad etiladi
  assert.equal((await call('POST', '/assignments', { group_id: grp, curator_id: c2.body.id, rule_id: fixed, start_date: '2026-10-05', end_date: '2026-10-09' }, A)).status, 400);
  // guruh muddatidan tashqari — rad etiladi
  assert.equal((await call('POST', '/assignments', { group_id: grp, curator_id: c2.body.id, rule_id: fixed, start_date: '2027-01-01', end_date: '2027-01-09' }, A)).status, 400);
  // oy o'rtasida almashtirish
  assert.equal((await call('POST', `/assignments/${asg.body.id}/replace`, { curator_id: c2.body.id, start_date: '2026-10-11', end_date: '2026-12-31' }, A)).status, 201);

  // Qoida narxi keyin o'zgarsa ham eski biriktirish o'zgarmaydi (snapshot)
  await call('PUT', `/rules/${fixed}`, { name: 'Potok yangi', type: 'fixed', params: { amount: 9999999, proportional: true } }, A);

  // Sifat nazorati xodimlari (operator qo'sha oladi); kuratorlarga xabar tekshiruvi kiritilmaydi
  const st = await call('POST', '/staff', { first_name: 'Nodira', last_name: 'Sifatova', department: 'Sifat nazorati', staff_role: 'inspector', card_number: '8600 9999 8888 7777' }, O);
  assert.equal(st.status, 201);
  assert.equal((await call('POST', '/bonuses', { month: '2026-10', kind: 'messages', curator_id: c1id, group_id: grp, quantity: 4, rule_id: price }, O)).status, 400);
  assert.equal((await call('POST', '/bonuses', { month: '2026-10', kind: 'messages', curator_id: st.body.id, group_id: grp, quantity: 4, rule_id: price }, O)).status, 201);
  assert.equal((await call('POST', '/bonuses', { month: '2026-10', kind: 'messages', curator_id: st.body.id, group_id: grp, quantity: 4, rule_id: price }, O)).status, 400); // takror
  assert.equal((await call('POST', '/bonuses', { month: '2026-10', kind: 'flow_sales', curator_id: st.body.id, quantity: 20000000, rule_id: pct }, O)).status, 201);
  assert.equal((await call('POST', '/bonuses', { month: '2026-10', kind: 'flow_sales', curator_id: c1id, quantity: 1000, rule_id: pct }, O)).status, 400); // kuratorga 5% yo'q
  // Rustilida sotuvi — faqat Admin, faqat nazoratchiga, 1–5 oy
  const rg = (await call('POST', '/groups', { section: 'rustilida', name: 'RU-1', start_date: '2026-09-15', end_date: '2027-02-15', student_count: 10 }, A)).body.id;
  const ps = (await call('POST', '/rules', { name: 'Rustilida sotuv', type: 'per_sale', params: { amount: 25000 } }, A)).body.id;
  const rs = { month: '2026-10', kind: 'rustilida_sales', curator_id: st.body.id, group_id: rg, month_no: 2, quantity: 6, rule_id: ps };
  assert.equal((await call('POST', '/bonuses', rs, O)).status, 403);
  assert.equal((await call('POST', '/bonuses', { ...rs, month_no: 7 }, A)).status, 400);
  assert.equal((await call('POST', '/bonuses', { ...rs, curator_id: c1id }, A)).status, 400);
  assert.equal((await call('POST', '/bonuses', rs, A)).status, 201);
  // Nazorat rahbari — stabil oylik
  const head = await call('POST', '/staff', { first_name: 'Rahbar', last_name: 'Nazoratov', staff_role: 'head', monthly_salary: 5000000, card_number: '8600 1111 2222 3333' }, A);
  assert.equal(head.status, 201);
  assert.equal((await call('POST', '/staff', { first_name: 'X', last_name: 'Y', staff_role: 'head', card_number: '8600 1111 2222 4444' }, A)).status, 400); // oylik kiritilmagan

  const rep = (await call('GET', '/report/2026-10', null, O)).body;
  const ali = rep.curators.find((c) => c.curatorId === c1id);
  const vali = rep.curators.find((c) => c.curatorId === c2.body.id);
  assert.equal(ali.totals.flow, 1000000);
  assert.equal(vali.totals.flow, 2100000);
  assert.equal(ali.totals.bonus, 0);
  assert.equal(rep.curators.find((c) => c.curatorId === st.body.id).totals.qc, 200000 + 150000 + 1000000);
  assert.equal(rep.curators.find((c) => c.curatorId === head.body.id).total, 5000000);
  assert.equal(rep.grandTotal, 3100000 + 1000000 + 350000 + 5000000);

  // To'lovlar: kutilmoqda → o'tkazildi
  const pays = (await call('GET', '/payments?month=2026-10', null, O)).body;
  const sc = pays.find((x) => x.personId === c1id);
  assert.equal(sc.paid, false);
  assert.equal(sc.dueISO, '2026-11-01'); // potok 1-sanadan boshlangan: to'lov keyingi oyning 1-kuni
  assert.equal(pays.find((x) => x.personId === head.body.id).dueISO, '2026-11-01');
  assert.equal((await call('POST', '/payments/status', { month: '2026-10', scope: sc.scope, person_id: c1id, paid: true }, O)).status, 403);
  assert.equal((await call('POST', '/payments/status', { month: '2026-10', scope: sc.scope, person_id: c1id, paid: true }, A)).status, 200);
  assert.equal((await call('GET', '/payments?month=2026-10', null, O)).body.find((x) => x.personId === c1id).paid, true);
  const up = (await call('GET', '/payments/upcoming?today=2026-10-29', null, O)).body;
  assert.ok(up.length > 0 && !up.some((x) => x.personId === c1id && x.scope === sc.scope));

  const xl = await call('GET', '/report/2026-10/excel', null, O);
  assert.equal(xl.status, 200);
  assert.ok(xl.body.byteLength > 3000);

  // Oyni yopish va snapshot
  assert.equal((await call('POST', '/report/2026-10/close', null, O)).status, 403);
  assert.equal((await call('POST', '/report/2026-10/close', null, A)).status, 200);
  assert.equal((await call('PUT', `/bonuses/${(await call('GET', '/bonuses?month=2026-10', null, A)).body[0].id}`, { quantity: 1 }, O)).status, 409);
  assert.equal((await call('POST', '/assignments', { group_id: grp, curator_id: c1id, rule_id: fixed, start_date: '2026-10-01', end_date: '2026-10-02' }, A)).status, 400);
  const rep2 = (await call('GET', '/report/2026-10', null, O)).body;
  assert.equal(rep2.closed, true);
  assert.equal(rep2.grandTotal, rep.grandTotal);
  // Oyni qayta ochish
  assert.equal((await call('DELETE', '/report/2026-10/close', null, A)).status, 200);
  // O'chirish himoyasi
  assert.equal((await call('DELETE', `/curators/${c1id}`, null, A)).status, 409);
  assert.equal((await call('DELETE', `/flows/${flow}`, null, A)).status, 409);
});
