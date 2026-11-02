import { api } from '../api.js';
import { h, som, badge, monthLabel, toast, todayISO, daysUntil, MONTHS, termForMonth } from '../ui.js';
import { state, isAdmin, studentsFor } from '../state.js';
import { counts, closedAt, countBadges } from './groupinfo.js';
import { fmtDate } from '../ui.js';

export async function render(root, { go }) {
  const d = state.data, rep = d.report;
  const warn = rep.warnings.filter((w) => w.level === 'warn');
  const info = rep.warnings.filter((w) => w.level === 'info');
  const rus = d.groups.filter((g) => g.section === 'rustilida');
  const rusActive = rus.filter((g) => d.report.curators.some((c) => c.lines.some((l) => l.groupId === g.id)));
  const missingStudents = rusActive.filter((g) => !studentsFor(g).entered && !(termForMonth(g, state.month) && termForMonth(g, state.month).start_students !== null));
  const msgMissing = info.length;
  const hasMsg = d.bonuses.some((b) => b.kind === 'messages');

  const stat = (l, v, cls = '') => h('div', { class: 'stat ' + cls }, h('div', { class: 'l' }, l), h('div', { class: 'v' }, v));
  root.append(h('div', { class: 'pagehead' },
    h('div', null, h('h1', null, `Assalomu alaykum!`), h('p', null, `${monthLabel(state.month)} oyi uchun oylik hisob-kitob holati.`)),
    d.isClosed ? badge('Oy yopilgan', 'ok') : badge('Oy ochiq — hisoblanmoqda', 'warn')));

  root.append(h('div', { class: 'grid stats', style: 'margin-bottom:16px' },
    stat("To'lanadigan jami", som(rep.grandTotal), 'hero'),
    stat('Kuratorlar jami', som(rep.totals.flow + rep.totals.rustilida)),
    stat('Potok oyliklari', som(rep.totals.flow)),
    stat('Rustilida.uz', som(rep.totals.rustilida)),
    stat('Sifat nazorati jami', som(rep.totals.qc || 0))));

  // Potoklar va guruhlar holati (yopilganlar ham shu yerda saqlanadi)
  const blocks = [...d.flows.map((f) => ({ name: f.name, groups: d.groups.filter((g) => g.flow_id === f.id), flowClosed: f.closed_at })), { name: 'Rustilida.uz', groups: rus }];
  const all = counts(d.groups);
  root.append(h('div', { class: 'card' }, h('div', { class: 'cardhead' }, h('h2', null, 'Potoklar va guruhlar holati'), h('span', { class: 'inline' }, badge(`Jami: ${all.total}`, 'gray'), badge(`Faol: ${all.active}`, 'ok'), badge(`Yopilgan: ${all.closed}`, all.closed ? 'warn' : 'gray'))),
    blocks.some((b) => b.groups.length || b.flowClosed) ? h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Potok / bo\'lim', 'Faol guruhlar', 'Yopilgan guruhlar', 'Yopilganlar ro\'yxati'].map((t) => h('th', null, t)))),
      h('tbody', null, blocks.map((b) => { const c = counts(b.groups); return h('tr', null, h('td', null, h('b', null, b.name), b.flowClosed ? [' ', badge(`potok yopilgan ${fmtDate(b.flowClosed)}`, 'warn')] : null), h('td', null, String(c.active)), h('td', null, String(c.closed)),
        h('td', { class: 'small' }, b.groups.filter((g) => closedAt(g)).map((g) => `${g.name} (${fmtDate(closedAt(g))})`).join(', ') || '—')); }))))
      : h('div', { class: 'muted' }, "Hali potok va guruh yo'q.")));

  // Kutilayotgan to'lovlar — eslatma (qizil: muddati o'tgan yoki 3 kun qolgan)
  let pend = [];
  try { pend = await api(`/payments/upcoming?today=${todayISO()}&due_month=${state.month}`); } catch { /* ignore */ }
  const near = pend;
  const chips = h('div', { class: 'tabs', role: 'group', 'aria-label': 'Oyni tanlang' }, MONTHS.map((n, i) => h('button', { type: 'button', class: 'tab' + (+state.month.slice(5) === i + 1 ? ' active' : ''),
    onclick: () => { const sel = document.querySelector('#monthbar select[aria-label=Oy]'); if (sel) { sel.value = String(i + 1); sel.dispatchEvent(new Event('change')); } } }, n)));
  root.append(h('div', { class: 'card' }, h('div', { class: 'cardhead' }, h('h2', null, `Kutilayotgan oyliklar — ${monthLabel(state.month)}`), h('a', { class: 'btn sm', href: '#/tolovlar' }, "To'lovlar sahifasi")),
    h('p', { class: 'muted small' }, `Faqat ${monthLabel(state.month)} oyida o'tkazilishi kerak bo'lgan, hali o'tkazilmagan oyliklar. Boshqa oyni tanlang:`), chips,
    near.length ? h('div', null, near.slice(0, 60).map((x) => {
      const d = daysUntil(x.dueISO);
      const when = d < 0 ? `${-d} kun kechikdi` : d === 0 ? 'bugun' : `${d} kun qoldi`;
      return h('div', { class: 'remind' + (d <= 3 ? ' red' : '') },
        h('span', null, h('b', null, x.name), ` — ${x.label}: `, h('b', null, som(x.amount)), ` — bu oylik `, h('b', null, x.due), ' sanada o\'tishi kerak'),
        h('span', null, badge(when, d <= 3 ? 'bad' : d <= 7 ? 'warn' : 'gray')));
    }), near.length > 60 ? h('div', { class: 'muted' }, `… va yana ${near.length - 60} ta (To'lovlar sahifasida)`) : null)
      : h('div', { class: 'alert ok' }, `✓ ${monthLabel(state.month)} oyida o'tkazilmagan oylik yo'q.`)));

  const firstTime = isAdmin() && (!d.curators.length || !d.rules.length || !d.flows.length);
  if (firstTime) {
    const step = (n, done, text, path) => h('li', { class: done ? 'done' : '' }, h('span', { class: 'n' }, done ? '✓' : n), h('span', { class: 't' }, text), h('a', { class: 'btn sm', href: '#' + path }, 'Ochish'));
    root.append(h('div', { class: 'card' }, h('h2', null, 'Birinchi marta ishlatyapsizmi? Shu tartibda boshlang'),
      h('ol', { class: 'steps' },
        step(1, d.curators.length > 0, "Kuratorlarni qo'shing (ism, karta raqami)", '/kuratorlar'),
        step(2, d.rules.length > 0, 'Oylik qoidalarini yarating (yoki tayyor namunalarni oling)', '/qoidalar'),
        step(3, d.flows.length > 0, "Potok va guruhlarni sanalari bilan yarating", '/boshqaruv'),
        step(4, d.assignments.length > 0, 'Guruhlarga kurator va qoidani biriktiring', '/potok'))));
  }

  const ok = (v) => v;
  const step = (n, done, text, path) => h('li', { class: done ? 'done' : '' }, h('span', { class: 'n' }, done ? '✓' : n), h('span', { class: 't' }, text), h('a', { class: 'btn sm', href: '#' + path }, 'Ochish'));
  root.append(h('div', { class: 'card' }, h('h2', null, `Oy oxirigacha qilinadigan ishlar`),
    h('ol', { class: 'steps' },
      step(1, !warn.some((w) => /kurator belgilanmagan/.test(w.text)) && rep.curators.length > 0, "Hamma guruhlarda kurator va ishlagan sanalar to'g'ri ekanini tekshiring", '/potok'),
      step(2, rus.length === 0 || missingStudents.length === 0, missingStudents.length ? `Rustilida.uz: ${missingStudents.length} ta guruh uchun talabalar sonini kiriting` : 'Rustilida.uz talabalar soni kiritilgan', '/rustilida'),
      step(3, hasMsg && msgMissing === 0, msgMissing ? `Sifat nazorati: ${msgMissing} ta eslatma (xabar tekshiruvi kam)` : 'Sifat nazorati: xabar tekshiruvlari sonini kiriting (guruhga 4 tadan)', '/nazorat'),
      step(4, d.bonuses.some((b) => b.kind !== 'messages'), "Sifat nazorati: sotuvlarni kiriting (5% va Rustilida.uz sotuvi)", '/nazorat'),
      step(5, d.isClosed, "To'lovlarni o'tkazib, holatini belgilang; hisobotni tekshiring" + (isAdmin() ? " va oyni yoping" : ''), '/tolovlar'))));

  root.append(h('div', { class: 'card' }, h('h2', null, 'Diqqat talab qiladigan joylar'),
    !warn.length && !info.length ? h('div', { class: 'alert ok' }, '✓ Hozircha hammasi joyida.') :
      h('div', null, warn.length ? h('div', { class: 'alert warn' }, h('b', null, `${warn.length} ta ogohlantirish`), h('ul', null, warn.slice(0, 12).map((w) => h('li', null, w.text)), warn.length > 12 ? h('li', null, `… va yana ${warn.length - 12} ta (hisobotda ko'ring)`) : null)) : null,
        info.length ? h('div', { class: 'alert' }, h('b', null, `${info.length} ta eslatma`), h('ul', null, info.slice(0, 8).map((w) => h('li', null, w.text)), info.length > 8 ? h('li', null, `… va yana ${info.length - 8} ta`) : null)) : null)));
}
