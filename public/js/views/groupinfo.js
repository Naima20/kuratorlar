// Guruh/potok holati: faol va yopilgan sonlar, kuratorlar ro'yxati, yopish tugmalari.
import { api } from '../api.js';
import { h, badge, field, formModal, confirmBox, toast, todayISO, fmtDate, groupPeriod } from '../ui.js';
import { state, isAdmin, curatorName } from '../state.js';

export const closedAt = (g) => [g.closed_at, g.flow_id && state.idx.flow[g.flow_id]?.closed_at].filter(Boolean).sort()[0] || null;
export const isClosed = (g) => !!closedAt(g);
// Yopilgan sanadan keyin boshlanadigan hisob davri — hisobotda ko'rinmaydi
export function hiddenInMonth(g, month = state.month) {
  const c = closedAt(g);
  if (!c) return false;
  const p = groupPeriod(g, month);
  return c < (p ? p[0] : `${month}-01`);
}
export const counts = (groups) => { const closed = groups.filter(isClosed).length; return { total: groups.length, closed, active: groups.length - closed }; };
export const countText = (groups) => { const c = counts(groups); return `${c.total} ta guruh: ${c.active} ta faol, ${c.closed} ta yopilgan`; };
export const countBadges = (groups) => { const c = counts(groups); return h('span', { class: 'inline', style: 'display:inline-flex;gap:6px;vertical-align:middle' }, badge(`Guruhlar: ${c.total} ta`, 'gray'), badge(`Faol: ${c.active}`, 'ok'), badge(`Yopilgan: ${c.closed}`, c.closed ? 'warn' : 'gray')); };

// Hozirgi kurator(lar) va avvalgilari
export function curatorsOf(g) {
  const asg = state.data.assignments.filter((a) => a.group_id === g.id);
  if (!asg.length) return { current: [], former: [] };
  const today = todayISO();
  let cur = asg.filter((a) => a.start_date <= today && today <= a.end_date);
  if (!cur.length) { const last = asg.map((a) => a.end_date).sort().pop(); cur = asg.filter((a) => a.end_date === last); }
  const names = (list) => [...new Set(list.map((a) => curatorName(a.curator_id)))];
  const current = names(cur);
  const former = names(asg.filter((a) => !cur.includes(a))).filter((n) => !current.includes(n));
  return { current, former };
}

function closeModal(kind, row, refresh) {
  const d = h('input', { class: 'input', type: 'date', value: todayISO() });
  formModal({
    title: kind === 'flows' ? `"${row.name}" potokini yopish` : `"${row.name}" guruhini yopish`,
    intro: "Yopilgan sanadan keyingi oylarda bu " + (kind === 'flows' ? 'potok (barcha guruhlari)' : 'guruh') + " oylik hisobotda va ogohlantirishlarda ko'rinmaydi. Yopilgan oyning o'zi hisoblanadi. Bosh sahifada yopilganlar ro'yxati saqlanadi. Xato bo'lsa, qayta ochish mumkin.",
    fields: [field('Yopilgan sana', d)], submitLabel: 'Yopish',
    onSubmit: async () => { await api(`/${kind}/${row.id}/close`, { method: 'POST', body: { date: d.value } }); toast('Yopildi'); refresh(); },
  });
}
export function closeButton(kind, row, refresh) {
  if (!isAdmin()) return null;
  if (row.closed_at) return h('button', { class: 'btn sm', type: 'button', onclick: async () => {
    if (!(await confirmBox({ title: 'Qayta ochish', message: `"${row.name}" qayta ochilsinmi?`, okLabel: 'Ha, qayta ochish' }))) return;
    try { await api(`/${kind}/${row.id}/reopen`, { method: 'POST' }); toast('Qayta ochildi'); refresh(); } catch (e) { toast(e.message, true); }
  } }, `🔓 Qayta ochish (${fmtDate(row.closed_at)})`);
  return h('button', { class: 'btn sm', type: 'button', onclick: () => closeModal(kind, row, refresh) }, kind === 'flows' ? '🔒 Potokni yopish' : '🔒 Guruhni yopish');
}

// Guruh — kuratorlar ro'yxati
export function summaryTable(groups, refresh) {
  if (!groups.length) return null;
  return h('div', { class: 'tablewrap', style: 'margin-bottom:12px' }, h('table', null,
    h('thead', null, h('tr', null, h('th', null, 'Guruh'), h('th', null, 'Kurator (oldingilari qavsda)'), h('th', null, 'Holati'), isAdmin() ? h('th') : null)),
    h('tbody', null, groups.map((g) => {
      const { current, former } = curatorsOf(g);
      const c = closedAt(g);
      return h('tr', null, h('td', null, h('b', null, g.name)),
        h('td', null, current.length ? current.join(', ') : h('span', { class: 'muted' }, 'kurator biriktirilmagan'), former.length ? h('span', { class: 'muted' }, ` (${former.join(', ')})`) : null),
        h('td', null, c ? badge(`Yopilgan ${fmtDate(c)}`, 'warn') : badge('Faol', 'ok')),
        isAdmin() ? h('td', { class: 'right' }, g.closed_at || !c ? closeButton('groups', g, refresh) : h('span', { class: 'muted small' }, 'Potok yopilgan')) : null);
    }))));
}
