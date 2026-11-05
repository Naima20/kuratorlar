// To'lanmagan oyliklar: hamma oylar bo'yicha, bo'limlarga ajratilgan, hisob-kitobi bilan.
import { api } from '../api.js';
import { h, som, badge, copyButton, copyText, fmtCard, toast, empty, daysUntil, todayISO } from '../ui.js';
import { entriesOf, textOf } from '../copytext.js';
import { state, isAdmin } from '../state.js';

let tab = 'all';
const GROUPS = [
  ['flow', 'Kuratorlar — potoklar'],
  ['rustilida', 'Kuratorlar — Rustilida.uz'],
  ['qc', 'Sifat nazorati'],
  ['bonus', 'Boshqa bonuslar'],
];
const rowsOf = (list) => list.flatMap((x) => entriesOf(x, x.details));
const monthName = (m) => { const M = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr']; return `${M[+m.slice(5) - 1]} ${m.slice(0, 4)}`; };

export async function render(root, { refresh }) {
  const items = await api('/payments/unpaid?today=' + todayISO());
  const total = items.reduce((a, x) => a + x.amount, 0);
  const sec = (x) => x.section;
  const late = items.filter((x) => daysUntil(x.dueISO) <= 0);
  root.append(h('div', { class: 'pagehead' }, h('div', null, h('h1', null, "To'lanmagan oyliklar"),
    h('p', null, "Hali \"O'tkazildi\" deb belgilanmagan barcha oyliklar (hamma oylar bo'yicha): kimga, qaysi ish uchun, qancha va qanday hisoblangani. Muddati kelgan yoki o'tganlar qizil rangda. Faqat muddati 1 oy ichida bo'lganlar ko'rsatiladi."))));
  root.append(h('div', { class: 'grid stats', style: 'margin-bottom:16px' },
    h('div', { class: 'stat hero' }, h('div', { class: 'l' }, "Jami to'lanmagan"), h('div', { class: 'v' }, som(total))),
    ...GROUPS.filter(([k]) => k !== 'bonus' || items.some((x) => sec(x) === 'bonus')).map(([k, n]) => h('div', { class: 'stat' }, h('div', { class: 'l' }, n), h('div', { class: 'v' }, som(items.filter((x) => sec(x) === k).reduce((a, x) => a + x.amount, 0))))),
    h('div', { class: 'stat' }, h('div', { class: 'l' }, "Muddati kelgan / o'tgan"), h('div', { class: 'v' }, `${late.length} ta`))));
  if (!items.length) { root.append(h('div', { class: 'card' }, h('div', { class: 'alert ok' }, "✓ Hamma oyliklar o'tkazilgan. To'lanmagan oylik yo'q."))); return; }

  const opts = [['all', 'Hammasi'], ...GROUPS.filter(([k]) => items.some((x) => sec(x) === k)).map(([k, n]) => [k, n])];
  if (!opts.some(([k]) => k === tab)) tab = 'all';
  root.append(h('div', { class: 'tabs', role: 'tablist' }, opts.map(([k, n]) => {
    const c = k === 'all' ? items.length : items.filter((x) => sec(x) === k).length;
    return h('button', { type: 'button', class: 'tab' + (k === tab ? ' active' : ''), role: 'tab', onclick: () => { tab = k; refresh(); } }, `${n} (${c})`);
  })));

  root.append(h('div', { class: 'inline noprint', style: 'margin:0 0 12px' }, h('button', { class: 'btn', type: 'button', onclick: () => { const l = tab === 'all' ? items : items.filter((x) => sec(x) === tab); copyText(textOf(rowsOf(l)), `${l.length} ta to'lov nusxalandi ✓`); } }, "📋 Ko'rsatilganlarni nusxalash"), h('span', { class: 'muted small' }, 'Format: karta / ism / potok (guruhlar) / summa')));
  for (const [k, name] of GROUPS) {
    if (tab !== 'all' && tab !== k) continue;
    const list = items.filter((x) => sec(x) === k);
    if (!list.length) continue;
    const sum = list.reduce((a, x) => a + x.amount, 0);
    root.append(h('div', { class: 'card flush' }, h('div', { class: 'cardhead', style: 'padding:16px 18px 0' }, h('h2', null, name), h('div', { class: 'inline' }, h('span', { class: 'muted small' }, `${list.length} ta · jami: `, h('b', null, som(sum))), h('button', { class: 'btn sm', type: 'button', onclick: () => copyText(textOf(rowsOf(list)), `${name}: ${list.length} ta to'lov nusxalandi ✓`) }, '📋 Nusxalash'))),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Xodim', 'Qaysi ish uchun va hisobi', 'Summa', "O'tkazish sanasi", 'Holati'].map((t, i) => h('th', { class: i === 2 ? 'num' : '' }, t)))),
        h('tbody', null, list.map((x) => {
          const d = daysUntil(x.dueISO);
          const btn = h('button', { type: 'button', class: 'btn sm warnbtn', disabled: !isAdmin(), title: isAdmin() ? "O'tkazildi deb belgilash" : 'Faqat admin belgilaydi', onclick: async () => {
            btn.disabled = true;
            try { await api('/payments/status', { method: 'POST', body: { month: x.month, scope: x.scope, person_id: x.personId, paid: true } }); toast("O'tkazildi deb belgilandi ✓"); refresh(); }
            catch (e) { toast(e.message, true); btn.disabled = false; }
          } }, 'Kutilmoqda → belgilash');
          return h('tr', null,
            h('td', null, h('b', null, x.name), h('div', { class: 'inline' }, h('span', { class: 'cardno small' }, fmtCard(x.cardNumber) || '—'), copyButton(x.cardNumber))),
            h('td', null, h('b', null, x.label), ' ', h('span', { class: 'muted small' }, `(${monthName(x.month)} hisobi)`),
              x.details.map((l) => h('div', { class: 'small', style: 'margin-top:4px' }, `${l.title}${l.period ? ' · ' + l.period : ''}: `, h('span', { class: 'formula' }, `${l.formula} = `), h('b', null, som(l.amount))))),
            h('td', { class: 'num' }, h('b', null, som(x.amount))),
            h('td', { class: 'nowrap' }, x.due, ' ', badge(d < 0 ? `${-d} kun kechikdi` : d === 0 ? 'Bugun' : `${d} kun qoldi`, d <= 3 ? 'bad' : d <= 7 ? 'warn' : 'gray')),
            h('td', null, btn));
        })),
        h('tfoot', null, h('tr', null, h('td', { colspan: 2 }, `${name} — jami`), h('td', { class: 'num' }, som(sum)), h('td'), h('td')))))));
  }
}
