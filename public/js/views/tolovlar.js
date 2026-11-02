// To'lovlar: kim, qancha, qaysi sanada o'tkazilishi kerak va holati (admin tugma bosadi).
import { api } from '../api.js';
import { h, som, badge, copyButton, fmtCard, monthLabel, toast, empty, daysUntil, todayISO } from '../ui.js';
import { state, isAdmin } from '../state.js';

export const dueBadge = (iso, paid) => {
  if (paid) return badge("O'tkazildi ✓", 'ok');
  const d = daysUntil(iso);
  if (d < 0) return badge(`${-d} kun kechikdi`, 'bad');
  if (d === 0) return badge('Bugun', 'bad');
  return badge(`${d} kun qoldi`, d <= 3 ? 'bad' : d <= 7 ? 'warn' : 'gray');
};

export async function render(root, { refresh }) {
  const items = await api('/payments?month=' + state.month);
  const total = items.reduce((a, x) => a + x.amount, 0);
  const paidSum = items.filter((x) => x.paid).reduce((a, x) => a + x.amount, 0);
  root.append(h('div', { class: 'pagehead' }, h('div', null, h('h1', null, `To'lovlar — ${monthLabel(state.month)}`),
    h('p', null, "Har bir xodimga oylik qaysi sanada o'tkazilishi kerakligi ko'rsatilgan. Oylikni o'tkazgach, admin \"Kutilmoqda\" tugmasini bosib \"O'tkazildi\" qiladi. Potoklar — potok boshlangan kuni, Rustilida.uz — guruh tugash kuni, Sifat nazorati va bonuslar — oyning 1-sanasi.")),
    h('div', { class: 'inline' }, badge(`O'tkazilgan: ${som(paidSum)}`, 'ok'), badge(`Kutilmoqda: ${som(total - paidSum)}`, total - paidSum ? 'warn' : 'gray'))));
  if (!isAdmin()) root.append(h('div', { class: 'alert' }, "Holatni faqat admin o'zgartira oladi. Siz ko'rish rejimidasiz."));
  if (!items.length) { root.append(h('div', { class: 'card' }, empty("Bu oy uchun to'lov yo'q", "Kurator biriktirilgach yoki xabar/sotuv kiritilgach bu yerda ko'rinadi."))); return; }
  const order = []; const by = new Map();
  for (const it of items) { if (!by.has(it.scope)) { by.set(it.scope, []); order.push(it.scope); } by.get(it.scope).push(it); }
  const rank = (s) => (s.startsWith('flow') ? 0 : s.startsWith('rus') ? 1 : s === 'bonus' ? 2 : 3);
  order.sort((a, b) => rank(a) - rank(b) || by.get(a)[0].dueISO.localeCompare(by.get(b)[0].dueISO));
  for (const scope of order) {
    const list = by.get(scope), sum = list.reduce((a, x) => a + x.amount, 0);
    root.append(h('div', { class: 'card flush' }, h('div', { class: 'cardhead', style: 'padding:16px 18px 0' }, h('h2', null, list[0].label), h('span', { class: 'muted small' }, `Jami: ${som(sum)}`)),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Xodim', 'Karta raqami', 'Oylik summasi', "O'tkazish sanasi", 'Oylik holati'].map((t, i) => h('th', { class: i === 2 ? 'num' : '' }, t)))),
        h('tbody', null, list.map((x) => {
          const btn = h('button', { type: 'button', class: 'btn sm ' + (x.paid ? 'primary' : 'warnbtn'), disabled: !isAdmin(), title: isAdmin() ? 'Holatni almashtirish' : 'Faqat admin o\'zgartiradi',
            onclick: async () => {
              btn.disabled = true;
              try { await api('/payments/status', { method: 'POST', body: { month: x.month, scope: x.scope, person_id: x.personId, paid: !x.paid } }); toast(x.paid ? 'Kutilmoqdaga qaytarildi' : "O'tkazildi deb belgilandi ✓"); refresh(); }
              catch (e) { toast(e.message, true); btn.disabled = false; }
            } }, x.paid ? "O'tkazildi ✓" : 'Kutilmoqda');
          return h('tr', null, h('td', null, h('b', null, x.name), x.isStaff ? [' ', badge('nazorat', 'gray')] : null),
            h('td', null, h('div', { class: 'inline' }, h('span', { class: 'cardno' }, fmtCard(x.cardNumber) || '—'), copyButton(x.cardNumber))),
            h('td', { class: 'num' }, h('b', null, som(x.amount)), x.changed ? h('div', { class: 'small', style: 'color:var(--accent)' }, `⚠ O'tkazilgan: ${som(x.paidAmount)} — summa keyin o'zgargan`) : null),
            h('td', { class: 'nowrap' }, x.due, ' ', dueBadge(x.dueISO, x.paid)), h('td', null, btn));
        }))))));
  }
}
