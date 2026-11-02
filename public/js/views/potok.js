import { h, empty, som, select, groupPeriod, fmtDate } from '../ui.js';
import { state } from '../state.js';
import { assignmentBlock } from './assignments.js';
import { countBadges, summaryTable, hiddenInMonth, isClosed } from './groupinfo.js';

let chosen = '';
export async function render(root, { refresh }) {
  const flows = state.data.flows;
  root.append(h('div', { class: 'pagehead' }, h('div', null, h('h1', null, 'Potok oyliklari'),
    h('p', null, "Har bir potok o'z jadvali bo'yicha hisoblanadi: oylik davri potok boshlangan kundan boshlanadi (masalan, 31-sana bo'lsa, keyingi oy 30 yoki 31-sana). Pastda tanlangan oy uchun har bir kuratorning ishlagan kunlari va oyligi avtomatik ko'rsatiladi. Kurator va qoidani biriktirish uchun Admin \"+ Kurator biriktirish\" tugmasidan foydalanadi."))));
  if (!flows.length) { root.append(h('div', { class: 'card' }, empty("Hali potok yo'q", '"Potoklar va guruhlar" bo\'limida potok yarating.'))); return; }

  const sel = select([['', 'Hamma potoklar'], ...flows.map((f) => [f.id, f.name])], chosen, { 'aria-label': 'Potok', style: 'max-width:260px', onchange: (e) => { chosen = e.target.value; refresh(); } });
  const onlyActive = h('input', { type: 'checkbox', checked: true, onchange: () => draw() });
  const showClosed = h('input', { type: 'checkbox', checked: false, onchange: () => draw() });
  const box = h('div');
  const monthLines = state.data.report.curators.flatMap((c) => c.lines.filter((l) => l.section === 'flow'));
  const draw = () => {
    const out = [];
    for (const f of flows.filter((x) => !chosen || x.id === chosen)) {
      const all = state.data.groups.filter((g) => g.flow_id === f.id);
      let groups = all;
      if (!showClosed.checked) groups = groups.filter((g) => !isClosed(g));
      if (onlyActive.checked) groups = groups.filter((g) => groupPeriod(g, state.month) && (showClosed.checked || !hiddenInMonth(g)));
      const ids = new Set(state.data.groups.filter((g) => g.flow_id === f.id).map((g) => g.id));
      const total = monthLines.filter((l) => ids.has(l.groupId)).reduce((s, l) => s + l.amount, 0);
      out.push(h('div', { class: 'card' },
        h('div', { class: 'cardhead' }, h('div', null, h('h2', null, f.name, ' ', countBadges(all)), h('div', { class: 'muted small' }, `Potok muddati: ${fmtDate(f.start_date)} – ${fmtDate(f.end_date)}`)), h('div', null, 'Shu oy jami: ', h('b', null, som(total)))),
        summaryTable(showClosed.checked ? all : all.filter((g) => !isClosed(g)), refresh),
        groups.length ? groups.map((g) => assignmentBlock(g, { refresh, amounts: true, students: g.student_count > 0 || state.data.assignments.some((a) => a.group_id === g.id && a.rule_snapshot.type === 'tiers') })) : empty('Shu oyda faol guruh yo\'q', "\"Faqat shu oyda hisob davri bor guruhlar\" belgisini olib tashlab, hammasini ko'rishingiz mumkin.")));
    }
    box.replaceChildren(...out);
  };
  root.append(h('div', { class: 'card' }, h('div', { class: 'inline' }, sel, h('label', { class: 'check' }, onlyActive, 'Faqat shu oyda hisob davri bor guruhlar'), h('label', { class: 'check' }, showClosed, 'Yopilgan guruhlarni ham ko\'rsatish'))), box);
  draw();
}
