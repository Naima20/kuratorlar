'use strict';
// Oylik hisoblash mexanizmi — sof funksiyalar (bazaga murojaat qilmaydi), shuning uchun test qilish oson.
//
// Asosiy qoida (Pro-rata):
//   Hisob davri = potok (yoki Rustilida guruhi) boshlangan KUN har oy takrorlanadi (31-sana → qisqa oylarda oxirgi kun).
//   Kurator ishlagan kunlar = [biriktirish sanalari] ∩ [hisob davri]
//   Ulush = ishlangan kunlar / davr kunlari. Kurator butun davr ishlasa ulush = 1 (to'liq summa);
//   davr o'rtasida almashsa, ulushlar yig'indisi doim 100% bo'ladi.
const { parseDate, fmtDate, overlap, daysIn, money, groupPeriod, termForMonth, MS } = require('./util');
const { BONUS_RULE_TYPE } = require('./rules');

const BONUS_LABEL = {
  messages: 'Xabar tekshiruvi',
  flow_sales: "Yangi potokga o'tkazish sotuvi",
  rustilida_sales: 'Rustilida.uz sotuvi',
};

const SECTIONS = ['flow', 'rustilida', 'bonus', 'qc'];
const firstOfNextMonth = (month) => { const [y, m] = month.split('-').map(Number); return Date.UTC(y, m, 1); };
const shortDate = (t) => { const [y, m, d] = fmtDate(t).split('-'); return `${d}.${m}.${y}`; };

function matchTier(tiers, n) {
  return tiers.find((t) => n >= t.from && (t.to === null || t.to === undefined || n <= t.to)) || null;
}

function assignmentLine({ assignment: a, group: g, flowName, students, month }) {
  const period = groupPeriod(g, month);
  if (!period) return null;
  const worked = overlap(parseDate(a.start_date), parseDate(a.end_date), period[0], period[1]);
  if (!worked) return null;

  const workedDays = daysIn(worked[0], worked[1]);
  const groupDays = daysIn(period[0], period[1]);
  const full = workedDays === groupDays;
  const rule = a.rule_snapshot;
  const warnings = [];
  let amount = 0, formula = '', base = 0;
  const share = full ? '' : ` × ${workedDays}/${groupDays} kun`;
  const ratio = workedDays / groupDays;
  const payTs = g.section === 'rustilida' ? period[1] : period[1] + MS; // potok: keyingi hisob davri boshlanadigan kun; Rustilida: guruh tugash kuni

  if (rule.type === 'fixed') {
    base = rule.params.amount;
    if (rule.params.proportional && !full) { amount = base * ratio; formula = `${money(base)}${share}`; }
    else { amount = base; formula = `${money(base)}`; }
  } else if (rule.type === 'daily') {
    base = rule.params.rate;
    amount = base * workedDays;
    formula = `${money(base)} × ${workedDays} kun`;
  } else if (rule.type === 'tiers') {
    // Rustilida: oy boshi/oxiridagi talabalar va chiqib ketganlarning dars soni kiritilgan bo'lsa
    const term = g.section === 'rustilida' ? termForMonth(g, month) : null;
    const byTerm = term && term.start_students !== null && term.end_students !== null;
    let count = students.count, eff = students.count, leaveText = '';
    if (byTerm) {
      const total = term.lessons_total || 13;
      const departed = Math.max(0, term.start_students - term.end_students);
      const lv = term.leavers.slice(0, departed);
      count = term.start_students; // daraja oy boshidagi talabalar soniga qarab tanlanadi
      eff = term.end_students + lv.reduce((a, x) => a + x / total, 0);
      if (lv.length) leaveText = ` + chiqib ketgan ${lv.length} ta (${lv.map((x) => `${x}/${total}`).join(', ')} dars)`;
      if (departed > lv.length) warnings.push(`${departed - lv.length} ta chiqib ketgan o'quvchining dars soni kiritilmagan — 0 dars deb olindi.`);
    }
    const tier = matchTier(rule.params.tiers, count);
    if (!tier) {
      warnings.push(`Talaba soni (${count}) uchun mos daraja topilmadi — summa 0 deb olindi.`);
    } else {
      base = tier.amount; // 1 ta talaba uchun stavka
      amount = eff * base * (full ? 1 : ratio);
      formula = byTerm
        ? `${term.end_students} ta${leaveText} = ${Math.round(eff * 100) / 100} talaba × ${money(base)} (daraja ${tier.from}–${tier.to ?? '∞'}, oy boshida ${count} ta)${share}`
        : `${count} ta talaba × ${money(base)} (daraja ${tier.from}–${tier.to ?? '∞'})${share}`;
    }
    if (students.fallback && !byTerm) warnings.push(`Bu oy uchun talaba soni kiritilmagan, guruhdagi oxirgi qiymat (${students.count}) ishlatildi.`);
  } else {
    warnings.push(`"${rule.type}" turidagi qoida guruhga biriktirilmaydi.`);
  }

  return {
    kind: 'assignment',
    section: g.section,
    assignmentId: a.id,
    groupId: g.id,
    groupName: g.name,
    flowName: flowName || '',
    ruleName: rule.name,
    ruleType: rule.type,
    from: fmtDate(worked[0]),
    to: fmtDate(worked[1]),
    period: `${shortDate(worked[0])} – ${shortDate(worked[1])}`,
    cycle: `${shortDate(period[0])} – ${shortDate(period[1])}`,
    payDate: shortDate(payTs),
    payISO: fmtDate(payTs),
    flowId: g.flow_id || null,
    workedDays, groupDays,
    studentCount: rule.type === 'tiers' ? students.count : null,
    title: g.section === 'flow' ? `${flowName ? flowName + ' / ' : ''}${g.name}` : `Rustilida.uz / ${g.name}`,
    formula,
    amount: Math.round(amount),
    warnings,
  };
}

function bonusLine({ bonus: b, group, flowName, month }) {
  const rule = b.rule_snapshot;
  const q = Number(b.quantity);
  let amount = 0, formula = '', title = '', section = 'qc';
  if (b.kind === 'messages') {
    section = 'qc';
    amount = q * rule.params.price;
    formula = `${q} ta tekshiruv × ${money(rule.params.price)}`;
    title = `${flowName ? flowName + ' / ' : ''}${group ? group.name : ''}`;
  } else if (b.kind === 'flow_sales') {
    amount = (q * rule.params.percent) / 100;
    formula = `${money(q)} sotuv × ${rule.params.percent}%`;
    title = BONUS_LABEL.flow_sales;
  } else if (b.kind === 'rustilida_sales') {
    section = 'qc';
    amount = q * rule.params.amount;
    formula = `${q} ta o'quvchi (keyingi oy uchun to'lov qilgan) × ${money(rule.params.amount)}`;
    title = `Rustilida.uz sotuvi — ${group ? group.name : ''}, ${b.month_no}-oy`;
  }
  const payTs = firstOfNextMonth(month);
  return {
    kind: 'bonus', section, bonusId: b.id, bonusKind: b.kind,
    groupId: b.group_id || null, groupName: group ? group.name : '',
    flowId: group ? group.flow_id || null : null, flowName: flowName || '',
    monthNo: b.month_no || null,
    ruleName: rule.name, quantity: q, title, formula,
    payDate: shortDate(payTs), payISO: fmtDate(payTs),
    amount: Math.round(amount), warnings: [],
  };
}

// Guruhning oydagi kunlaridan qanchasiga kurator belgilanmagan?
function uncoveredDays(group, assignments, month) {
  const act = groupPeriod(group, month);
  if (!act) return null;
  const parts = assignments
    .map((a) => overlap(parseDate(a.start_date), parseDate(a.end_date), act[0], act[1]))
    .filter(Boolean)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0, curEnd = -Infinity, curStart = null;
  for (const [s, e] of parts) {
    if (curStart === null) { curStart = s; curEnd = e; continue; }
    if (s <= curEnd + MS) curEnd = Math.max(curEnd, e);
    else { covered += daysIn(curStart, curEnd); curStart = s; curEnd = e; }
  }
  if (curStart !== null) covered += daysIn(curStart, curEnd);
  return daysIn(act[0], act[1]) - covered;
}

/**
 * data: { curators, flows, groups, assignments (rule_snapshot — obyekt), bonuses (rule_snapshot — obyekt), studentsByGroup }
 */
function computeMonth(data, month) {
  const flowClosed = Object.fromEntries(data.flows.map((f) => [f.id, f.closed_at || null]));
  // Yopilgan guruh/potok: yopilgan sanadan keyin boshlanadigan hisob davrlarida hisobotda ham, ogohlantirishda ham chiqmaydi
  const hidden = (g) => {
    if (!g) return false;
    const cs = [g.closed_at, g.flow_id ? flowClosed[g.flow_id] : null].filter(Boolean).sort();
    if (!cs.length) return false;
    const p = groupPeriod(g, month);
    const start = p ? p[0] : parseDate(`${month}-01`);
    return parseDate(cs[0]) < start;
  };
  const flowName = Object.fromEntries(data.flows.map((f) => [f.id, f.name]));
  const groupById = Object.fromEntries(data.groups.map((g) => [g.id, g]));
  const curatorById = Object.fromEntries(data.curators.map((c) => [c.id, c]));
  const perCurator = new Map();
  const warnings = [];

  const bucket = (cid) => {
    if (!perCurator.has(cid)) {
      const c = curatorById[cid] || { first_name: "Noma'lum", last_name: 'kurator', card_number: '', kind: 'curator' };
      perCurator.set(cid, {
        curatorId: cid,
        name: `${c.last_name} ${c.first_name}`,
        cardNumber: c.card_number || '',
        isStaff: c.kind === 'staff',
        department: c.department || '',
        staffRole: c.kind === 'staff' ? (c.staff_role || 'inspector') : null,
        lines: [],
        totals: { flow: 0, rustilida: 0, bonus: 0, qc: 0 },
        total: 0,
      });
    }
    return perCurator.get(cid);
  };

  // 1) Guruhlardagi oyliklar
  const asgByGroup = {};
  for (const a of data.assignments) {
    const g = groupById[a.group_id];
    if (!g || hidden(g)) continue;
    (asgByGroup[g.id] ||= []).push(a);
    const sInfo = data.studentsByGroup[g.id] || { count: g.student_count, fallback: true };
    const line = assignmentLine({ assignment: a, group: g, flowName: flowName[g.flow_id], students: sInfo, month });
    if (!line) continue;
    bucket(a.curator_id).lines.push(line);
  }

  // 2) Bonuslar (xabar tekshiruvi, 5% sotuv, Rustilida sotuvi) — faqat sifat nazoratchilariga.
  for (const b of data.bonuses) {
    if (b.month !== month) continue;
    const person = curatorById[b.curator_id];
    const isStaff = person && person.kind === 'staff';
    if (!isStaff) continue; // barcha bonuslar faqat sifat nazorati xodimlariga
    const g = b.group_id ? groupById[b.group_id] : null;
    if (hidden(g)) continue;
    bucket(b.curator_id).lines.push(bonusLine({ bonus: b, group: g, flowName: g ? flowName[g.flow_id] : '', month }));
  }

  // 2b) Sifat nazorati rahbarining stabil oyligi
  for (const c of data.curators) {
    if (c.kind !== 'staff' || c.staff_role !== 'head' || !Number(c.active) || !(Number(c.monthly_salary) > 0)) continue;
    if (c.hire_date && c.hire_date.slice(0, 7) > month) continue;
    const payTs = firstOfNextMonth(month);
    bucket(c.id).lines.push({
      kind: 'head', section: 'qc', title: "Sifat nazorati rahbari — stabil oylik", ruleName: 'Stabil oylik',
      formula: `${money(c.monthly_salary)} (stabil oylik)`, amount: Math.round(Number(c.monthly_salary)),
      payDate: shortDate(payTs), payISO: fmtDate(payTs), warnings: [], flowId: null, flowName: '', groupId: null, groupName: '',
    });
  }

  // 3) Umumiy ogohlantirishlar
  for (const g of data.groups) {
    if (hidden(g)) continue;
    const gap = uncoveredDays(g, asgByGroup[g.id] || [], month);
    if (gap && gap > 0) {
      const label = g.section === 'flow' ? `${flowName[g.flow_id] || ''} / ${g.name}` : `Rustilida.uz / ${g.name}`;
      warnings.push({ level: 'warn', text: `"${label}" guruhida ${gap} kun uchun kurator belgilanmagan.` });
    }
  }
  // Xabar tekshiruvi me'yori: har bir potok guruhi uchun oyiga (barcha nazoratchilar yig'indisi)
  const msgByGroup = {};
  let expected = 4;
  for (const b of data.bonuses) {
    if (b.month !== month || b.kind !== 'messages' || !curatorById[b.curator_id] || curatorById[b.curator_id].kind !== 'staff') continue;
    msgByGroup[b.group_id] = (msgByGroup[b.group_id] || 0) + Number(b.quantity);
    expected = b.rule_snapshot.params.expected ?? expected;
  }
  for (const g of data.groups) {
    if (g.section !== 'flow' || hidden(g) || !groupPeriod(g, month) || !(asgByGroup[g.id] || []).length) continue;
    const n = msgByGroup[g.id] || 0;
    if (n < expected) warnings.push({ level: 'info', text: `"${flowName[g.flow_id] || ''} / ${g.name}" guruhi: xabar tekshiruvi ${n} ta (me'yor ${expected} ta).` });
  }

  const curators = [...perCurator.values()].filter((c) => c.lines.length);
  const totals = { flow: 0, rustilida: 0, bonus: 0, qc: 0 };
  for (const c of curators) {
    for (const l of c.lines) {
      c.totals[l.section] += l.amount;
      c.total += l.amount;
      for (const w of l.warnings) warnings.push({ level: 'warn', text: `${c.name} — ${l.title}: ${w}` });
    }
    c.lines.sort((x, y) => (x.section === y.section ? x.title.localeCompare(y.title) : SECTIONS.indexOf(x.section) - SECTIONS.indexOf(y.section)));
    if (c.total > 0 && !c.cardNumber) warnings.push({ level: 'warn', text: `${c.name}: karta raqami kiritilmagan.` });
    for (const k of Object.keys(totals)) totals[k] += c.totals[k];
  }
  curators.sort((a, b) => a.name.localeCompare(b.name));

  return {
    month,
    generatedAt: new Date().toISOString(),
    curators,
    totals,
    grandTotal: totals.flow + totals.rustilida + totals.bonus + totals.qc,
    warnings,
  };
}

module.exports = { computeMonth, assignmentLine, bonusLine, matchTier, uncoveredDays, BONUS_LABEL, BONUS_RULE_TYPE };
