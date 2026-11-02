// Guruhga kurator biriktirish bloki — "Potoklar va guruhlar", "Potok oyliklari" va "Rustilida.uz" sahifalarida umumiy.
import { api } from '../api.js';
import { h, field, select, formModal, confirmBox, toast, fmtDate, som, money, badge, addDays, groupPeriod, termForMonth } from '../ui.js';
import { state, isAdmin, curatorName, studentsFor, lineFor } from '../state.js';

export function ruleSummary(r) {
  const p = r.params;
  switch (r.type) {
    case 'fixed': return `${money(p.amount)} so'm${p.proportional ? ' (kunlarga mutanosib)' : " (to'liq)"}`;
    case 'daily': return `${money(p.rate)} so'm / kun`;
    case 'tiers': return p.tiers.map((t) => `${t.from}–${t.to ?? '∞'} ta: ${money(t.amount)}/talaba`).join(' · ');
    default: return '';
  }
}
const assignable = () => state.data.rules.filter((r) => ['fixed', 'daily', 'tiers'].includes(r.type));

function ruleSelect(current, { allowSame } = {}) {
  const opts = assignable().filter((r) => r.active || r.id === current);
  const list = opts.map((r) => [r.id, `${r.name} — ${r.summary}`]);
  return select(allowSame ? [['', 'Avvalgi qoida (o\'zgarishsiz)'], ...list] : [['', 'Qoidani tanlang…'], ...list], current || '');
}

function assignForm(g, a, refresh) {
  const asg = state.data.assignments.filter((x) => x.group_id === g.id && (!a || x.id !== a.id)).sort((x, y) => (x.end_date < y.end_date ? 1 : -1));
  const nextStart = asg.length && addDays(asg[0].end_date, 1) <= g.end_date ? addDays(asg[0].end_date, 1) : g.start_date;
  const cur = select([['', 'Kuratorni tanlang…'], ...state.data.curators.filter((c) => c.active || (a && c.id === a.curator_id)).map((c) => [c.id, `${c.last_name} ${c.first_name}`])], a?.curator_id || '');
  const rule = ruleSelect(a?.rule_id);
  const s = h('input', { class: 'input', type: 'date', value: a?.start_date || nextStart, min: g.start_date, max: g.end_date });
  const e = h('input', { class: 'input', type: 'date', value: a?.end_date || g.end_date, min: g.start_date, max: g.end_date });
  formModal({
    title: a ? 'Biriktirishni tahrirlash' : 'Kurator biriktirish',
    intro: `Guruh: ${g.name} (${fmtDate(g.start_date)} – ${fmtDate(g.end_date)}). Kurator ishlagan davrni aniq kiriting. Kurator butun hisob davri ishlasa — to'liq oylik; davr o'rtasida almashsa — ishlagan kunlariga qarab bo'linadi.`,
    fields: [field('Kurator', cur), field('Oylik qoidasi (shablon)', rule, assignable().length ? 'Qoidalar "Oylik qoidalari" bo\'limida yaratiladi.' : 'Avval Admin "Oylik qoidalari" bo\'limida qoida yaratishi kerak.'),
      h('div', { class: 'row' }, field('Boshlanish sanasi', s), field('Tugash sanasi', e))],
    onSubmit: async () => {
      const body = { group_id: g.id, curator_id: cur.value, rule_id: rule.value, start_date: s.value, end_date: e.value };
      await api(a ? '/assignments/' + a.id : '/assignments', { method: a ? 'PUT' : 'POST', body });
      toast('Saqlandi ✓'); refresh();
    },
  });
}

function replaceForm(g, a, refresh) {
  const cur = select([['', 'Yangi kuratorni tanlang…'], ...state.data.curators.filter((c) => c.active && c.id !== a.curator_id).map((c) => [c.id, `${c.last_name} ${c.first_name}`])], '');
  const rule = ruleSelect('', { allowSame: true });
  const s = h('input', { class: 'input', type: 'date', min: addDays(a.start_date, 1), max: a.end_date });
  const e = h('input', { class: 'input', type: 'date', value: a.end_date, min: g.start_date, max: g.end_date });
  formModal({
    title: 'Kuratorni almashtirish',
    intro: `Hozirgi kurator: ${curatorName(a.curator_id)} (${fmtDate(a.start_date)} – ${fmtDate(a.end_date)}). Yangi kurator boshlagan kundan bir kun oldin eski kuratorning ishi avtomatik tugatiladi.`,
    fields: [field('Yangi kurator', cur), field('Yangi kurator qaysi kundan boshlaydi?', s), field('Yangi kurator qaysi kungacha ishlaydi?', e), field('Oylik qoidasi', rule)],
    onSubmit: async () => {
      await api(`/assignments/${a.id}/replace`, { method: 'POST', body: { curator_id: cur.value, rule_id: rule.value || undefined, start_date: s.value, end_date: e.value } });
      toast('Kurator almashtirildi ✓'); refresh();
    },
  });
}

export function studentsBox(g, refresh) {
  const st = studentsFor(g);
  const inp = h('input', { class: 'input', type: 'number', min: 0, max: 10000, value: st.count, style: 'width:90px', 'aria-label': 'Talabalar soni', inputmode: 'numeric' });
  const btn = h('button', { class: 'btn sm', type: 'button', onclick: async () => {
    btn.disabled = true;
    try { await api(`/groups/${g.id}/students`, { method: 'PUT', body: { month: state.month, students: inp.value } }); toast('Talaba soni saqlandi ✓'); refresh(); }
    catch (ex) { toast(ex.message, true); btn.disabled = false; }
  } }, 'Saqlash');
  return h('div', { class: 'inline' }, h('span', { class: 'small' }, 'Shu oydagi talabalar soni:'), inp, state.data.isClosed ? null : btn,
    st.entered ? badge('kiritilgan', 'ok') : badge('shu oy uchun kiritilmagan', 'warn'));
}

// Rustilida.uz: 1–5 oylik davrlar — sanalar, oy boshi/oxiridagi talabalar, chiqib ketganlarning dars soni
const pickedTerm = {};
export function termBox(g, refresh) {
  const terms = g.terms || [];
  const cur = termForMonth(g, state.month);
  if (!pickedTerm[g.id]) pickedTerm[g.id] = cur ? cur.month_no : (terms.length ? Math.min(5, Math.max(...terms.map((t) => t.month_no)) + 1) : 1);
  const no = pickedTerm[g.id];
  const t = terms.find((x) => x.month_no === no);
  const closed = state.data.isClosed;
  const tabs = h('div', { class: 'tabs', role: 'tablist', style: 'margin:0 0 10px' }, [1, 2, 3, 4, 5].map((n) => {
    const x = terms.find((q) => q.month_no === n);
    return h('button', { type: 'button', class: 'tab' + (n === no ? ' active' : ''), role: 'tab', onclick: () => { pickedTerm[g.id] = n; refresh(); } }, `${n}-oy`, x ? ' ✓' : '');
  }));
  const dis = !isAdmin();
  const s = h('input', { class: 'input', type: 'date', value: t?.start_date || '', min: g.start_date, max: g.end_date, disabled: dis || closed });
  const e = h('input', { class: 'input', type: 'date', value: t?.end_date || '', min: g.start_date, max: g.end_date, disabled: dis || closed });
  const n0 = h('input', { class: 'input', type: 'number', min: 0, inputmode: 'numeric', value: t?.start_students ?? '', style: 'width:110px' });
  const n1 = h('input', { class: 'input', type: 'number', min: 0, inputmode: 'numeric', value: t?.end_students ?? '', style: 'width:110px' });
  const tot = h('input', { class: 'input', type: 'number', min: 1, max: 60, inputmode: 'numeric', value: t?.lessons_total ?? 13, style: 'width:90px' });
  const lvBox = h('div');
  const info = h('div', { class: 'small muted' });
  const lvInputs = [];
  const drawLeavers = () => {
    const dep = Math.max(0, (Number(n0.value) || 0) - (Number(n1.value) || 0));
    const old = lvInputs.map((i) => i.value); lvInputs.length = 0;
    const saved = t?.leavers || [];
    for (let i = 0; i < dep; i++) lvInputs.push(h('input', { class: 'input', type: 'number', min: 0, max: Number(tot.value) || 13, inputmode: 'numeric', style: 'width:90px', value: old[i] ?? saved[i] ?? '', 'aria-label': `${i + 1}-chiqib ketgan o'quvchi: o'qigan darslar soni` }));
    lvBox.replaceChildren(dep ? h('div', null, h('div', { class: 'small', style: 'margin:6px 0' }, `Chiqib ketgan ${dep} ta o'quvchi — har biri nechta dars o'qiganini yozing (jami ${tot.value || 13} ta darsdan):`),
      h('div', { class: 'inline' }, lvInputs.map((i, k) => h('label', { class: 'small' }, `${k + 1}-o'quvchi: `, i, ' ta dars')))) : null);
    paintInfo();
  };
  const paintInfo = () => {
    if (n0.value === '' || n1.value === '') { info.textContent = "Talabalar sonini kiritsangiz, oylik hisoblanadi."; return; }
    const T = Number(tot.value) || 13, frac = lvInputs.reduce((a, i) => a + (Number(i.value) || 0) / T, 0);
    info.textContent = `Hisobga olinadigan talaba: ${n1.value} ta + chiqib ketganlar ${Math.round(frac * 100) / 100} = ${Math.round((Number(n1.value) + frac) * 100) / 100} ta (daraja oy boshidagi ${n0.value} ta bo'yicha tanlanadi).`;
  };
  for (const i of [n0, n1, tot]) i.addEventListener('input', drawLeavers);
  const save = h('button', { class: 'btn sm primary', type: 'button', disabled: closed, onclick: async () => {
    save.disabled = true;
    try {
      await api(`/groups/${g.id}/terms/${no}`, { method: 'PUT', body: { start_date: s.value, end_date: e.value, start_students: n0.value, end_students: n1.value, lessons_total: tot.value, leavers: lvInputs.map((i) => (i.value === '' ? 0 : i.value)) } });
      toast(`${no}-oy saqlandi ✓`); refresh();
    } catch (ex) { toast(ex.message, true); save.disabled = false; }
  } }, `${no}-oyni saqlash`);
  const del = t && isAdmin() && !closed ? h('button', { class: 'btn sm danger', type: 'button', onclick: async () => {
    if (!(await confirmBox({ message: `${no}-oy ma'lumotlari o'chirilsinmi?`, okLabel: "Ha, o'chirish", danger: true }))) return;
    try { await api(`/groups/${g.id}/terms/${no}`, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (ex) { toast(ex.message, true); }
  } }, "O'chirish") : null;
  drawLeavers();
  return h('div', null, h('div', { class: 'small', style: 'margin-bottom:6px' }, h('b', null, 'Guruh oylari (1–5): '), "oyni tanlang, uning sanalarini va talabalar sonini kiriting."), tabs,
    h('div', { class: 'row' }, field(`${no}-oy boshlanish sanasi`, s), field(`${no}-oy tugash sanasi (oylik shu kuni to'lanadi)`, e)),
    h('div', { class: 'inline', style: 'margin-top:6px' }, h('label', { class: 'small' }, 'Oy boshidagi talabalar: ', n0), h('label', { class: 'small' }, 'Oy oxiridagi talabalar: ', n1), h('label', { class: 'small' }, 'Oydagi jami darslar: ', tot)),
    lvBox, info, h('div', { class: 'inline', style: 'margin-top:8px' }, save, del, !t && dis ? h('span', { class: 'muted small' }, 'Sanalarni Admin kiritadi.') : null));
}

export function assignmentBlock(g, { refresh, amounts = true, students = false }) {
  const list = state.data.assignments.filter((a) => a.group_id === g.id).sort((x, y) => (x.start_date < y.start_date ? -1 : 1));
  const per = groupPeriod(g, state.month);
  const head = h('div', { class: 'gh' },
    h('div', null, h('b', null, g.name), ' ', h('span', { class: 'muted small' }, `Muddati: ${fmtDate(g.start_date)} – ${fmtDate(g.end_date)}`),
      per ? h('div', { class: 'small' }, `Shu oy hisob davri: ${fmtDate(per[0])} – ${fmtDate(per[1])} · to'lov sanasi: ${fmtDate(per[2])}`) : h('div', null, badge('shu oyda hisob davri yo\'q', 'gray'))),
    isAdmin() ? h('button', { class: 'btn sm primary', onclick: () => assignForm(g, null, refresh) }, '+ Kurator biriktirish') : null);
  let body;
  if (!list.length) {
    body = h('div', { class: 'empty' }, h('b', null, 'Kurator biriktirilmagan'), isAdmin() ? '"+ Kurator biriktirish" tugmasini bosing.' : 'Admin kurator biriktiradi.');
  } else {
    body = h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Kurator', 'Ishlagan davri', 'Oylik qoidasi', amounts ? 'Shu oy uchun' : null, isAdmin() ? '' : null].map((x) => x !== null && h('th', null, x)))),
      h('tbody', null, list.map((a) => {
        const line = amounts ? lineFor(a.id) : null;
        const cur = state.idx.rule[a.rule_id];
        const stale = cur && JSON.stringify(cur.params) !== JSON.stringify(a.rule_snapshot.params);
        return h('tr', null,
          h('td', null, h('b', null, curatorName(a.curator_id))),
          h('td', { class: 'nowrap' }, `${fmtDate(a.start_date)} – ${fmtDate(a.end_date)}`),
          h('td', null, a.rule_snapshot.name, h('div', { class: 'muted small' }, ruleSummary(a.rule_snapshot)),
            stale ? h('div', null, badge("Qoida keyin o'zgargan", 'warn'), isAdmin() && !state.data.isClosed ? [' ', h('button', { class: 'btn sm', title: "Yangi qiymatni qo'llash", onclick: async () => {
              if (!(await confirmBox({ message: `Hozirgi qoida: ${cur.summary}. Shu biriktirishga yangi qiymat qo'llansinmi? Hisob o'zgaradi.`, okLabel: "Ha, qo'llash" }))) return;
              try { await api(`/assignments/${a.id}/refresh`, { method: 'POST' }); toast('Yangilandi ✓'); refresh(); } catch (e) { toast(e.message, true); }
            } }, '↻ Yangilash')] : null) : null),
          amounts ? h('td', null, line ? [h('b', null, som(line.amount)), h('div', { class: 'formula' }, `${line.workedDays} kun · ${line.formula}`), line.warnings.map((w) => h('div', null, badge(w, 'warn')))] : h('span', { class: 'muted' }, 'bu oyda emas')) : null,
          isAdmin() ? h('td', { class: 'right nowrap' },
            h('button', { class: 'btn sm', onclick: () => replaceForm(g, a, refresh) }, 'Almashtirish'), ' ',
            h('button', { class: 'btn sm', 'aria-label': 'Tahrirlash', onclick: () => assignForm(g, a, refresh) }, '✎'), ' ',
            h('button', { class: 'btn sm danger', 'aria-label': "O'chirish", onclick: async () => {
              if (!(await confirmBox({ title: "Biriktirishni o'chirish", message: `${curatorName(a.curator_id)} — ${g.name} biriktirishi o'chirilsinmi?`, okLabel: "Ha, o'chirish", danger: true }))) return;
              try { await api('/assignments/' + a.id, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (e) { toast(e.message, true); }
            } }, '✕')) : null);
      }))));
  }
  const needOld = students && !(g.section === 'rustilida' && termForMonth(g, state.month) && termForMonth(g, state.month).start_students !== null);
  return h('div', { class: 'groupbox' }, head,
    g.section === 'rustilida' ? h('div', { style: 'padding:10px 16px;border-bottom:1px solid var(--line)' }, termBox(g, refresh)) : null,
    needOld ? h('div', { style: 'padding:10px 16px;border-bottom:1px solid var(--line)' }, studentsBox(g, refresh)) : null, body);
}
