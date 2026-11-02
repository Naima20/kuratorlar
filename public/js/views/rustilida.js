import { api } from '../api.js';
import { h, empty, som, badge, groupPeriod, money, confirmBox, toast } from '../ui.js';
import { state, isAdmin } from '../state.js';
import { assignmentBlock } from './assignments.js';
import { groupForm } from './hub.js';
import { ruleForm } from './rules.js';
import { countBadges, summaryTable, closeButton, isClosed, hiddenInMonth } from './groupinfo.js';

let showClosed = false;

export async function render(root, { refresh }) {
  const allGroups = state.data.groups.filter((g) => g.section === 'rustilida');
  const groups = showClosed ? allGroups : allGroups.filter((g) => !isClosed(g));
  const scales = state.data.rules.filter((r) => r.type === 'tiers');
  const lines = state.data.report.curators.flatMap((c) => c.lines.filter((l) => l.section === 'rustilida'));
  const total = lines.reduce((s, l) => s + l.amount, 0);

  root.append(h('div', { class: 'pagehead' },
    h('div', null, h('h1', null, 'Rustilida.uz oyliklari'),
      h('p', null, "Guruh yarating, har oy talabalar sonini kiriting — tizim talabalar soniga mos darajani topib, oylikni hisoblaydi: talabalar soni × 1 talaba uchun stavka. Har bir guruhning boshlanish va tugash sanasi majburiy. Oylik har oy guruh TUGAYDIGAN sananing kunida to'lanadi (oxirgi to'lov — tugash sanasida).")),
    isAdmin() ? h('button', { class: 'btn primary', onclick: () => groupForm(null, { section: 'rustilida', refresh }) }, '+ Yangi guruh') : null));

  // Darajalar shkalasi
  root.append(h('div', { class: 'card' },
    h('div', { class: 'cardhead' }, h('h2', null, 'Talaba soniga qarab stavka (1 talaba uchun)'),
      isAdmin() ? h('button', { class: 'btn sm', onclick: () => ruleForm(null, refresh, 'tiers') }, '+ Yangi shkala') : null),
    scales.length ? scales.map((r) => h('div', { style: 'margin-bottom:12px' },
      h('div', { class: 'inline' }, h('b', null, r.name), r.active ? null : badge('Faol emas', 'gray'), isAdmin() ? h('button', { class: 'btn sm', onclick: () => ruleForm(r, refresh) }, 'Tahrirlash') : null),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Talabalar soni'), h('th', { class: 'num' }, "1 talaba uchun (so'm)"))),
        h('tbody', null, r.params.tiers.map((t) => h('tr', null, h('td', null, `${t.from} – ${t.to ?? "va undan ko'p"}`), h('td', { class: 'num' }, money(t.amount))))))))) :
      h('div', { class: 'muted' }, isAdmin() ? "Hali daraja shkalasi yo'q. \"+ Yangi shkala\" tugmasini bosing." : "Admin hali daraja shkalasini yaratmagan.")));

  root.append(h('div', { class: 'cardhead', style: 'margin:6px 0 10px' }, h('h2', null, 'Guruhlar ', countBadges(allGroups)), h('div', null, 'Shu oy jami: ', h('b', null, som(total)))));
  root.append(h('div', { class: 'card' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: showClosed, onchange: (e) => { showClosed = e.target.checked; refresh(); } }), "Yopilgan guruhlarni ham ko'rsatish"), summaryTable(groups, refresh)));
  if (!groups.length) { root.append(h('div', { class: 'card' }, empty("Hali Rustilida.uz guruhi yo'q", isAdmin() ? '"+ Yangi guruh" tugmasini bosing.' : 'Admin guruh yaratadi.'))); return; }
  for (const g of groups.filter((x) => showClosed || !hiddenInMonth(x))) {
    const active = !!groupPeriod(g, state.month);
    root.append(h('div', null,
      isAdmin() ? h('div', { class: 'inline', style: 'margin:0 0 6px' },
        h('button', { class: 'btn sm', onclick: () => groupForm(g, { refresh }) }, 'Guruh ma\'lumotlarini tahrirlash'), closeButton('groups', g, refresh),
        h('button', { class: 'btn sm danger', onclick: async () => {
          if (!(await confirmBox({ title: "Guruhni o'chirish", message: `"${g.name}" guruhi o'chirilsinmi?`, okLabel: "Ha, o'chirish", danger: true }))) return;
          try { await api('/groups/' + g.id, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (e) { toast(e.message, true); }
        } }, "Guruhni o'chirish")) : null,
      assignmentBlock(g, { refresh, amounts: true, students: active })));
  }
}
