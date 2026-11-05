import { api, download } from '../api.js';
import { h, som, badge, copyButton, copyText, fmtCard, monthLabel, confirmBox, toast, empty, select } from '../ui.js';
import { entriesOf, textOf } from '../copytext.js';
import { state, isAdmin, SECTION_LABEL as SECTION } from '../state.js';

const matches = (l, sec) => sec === 'all' || (sec === 'curators' ? l.section === 'flow' || l.section === 'rustilida' : false) || (sec.startsWith('flow:') ? l.section === 'flow' && l.flowId === sec.slice(5) : sec === l.section);
const labelOf = (l) => (l.section === 'flow' ? l.flowName || 'Potok' : l.section === 'rustilida' ? `Rustilida.uz / ${l.groupName}`
  : l.section === 'qc' ? (l.kind === 'head' ? 'Sifat nazorati rahbari' : l.bonusKind === 'rustilida_sales' ? 'Rustilida.uz sotuvi' : l.bonusKind === 'flow_sales' ? "Yangi potok sotuvi (5%)" : l.flowName || 'Sifat nazorati') : 'Kurator bonusi');

export async function render(root, { refresh }) {
  const rep = state.data.report;
  const sec = state.reportSection || 'all';
  const secName = { all: "Hamma bo'limlar", rustilida: 'Rustilida.uz', qc: 'Sifat nazoratchilari', curators: 'Kuratorlar' }[sec] || state.data.flows.find((f) => 'flow:' + f.id === sec)?.name || '';
  const warn = rep.warnings;
  root.append(h('div', { class: 'pagehead' },
    h('div', null, h('h1', null, `Oylik hisobot — ${secName}, ${monthLabel(state.month)}`),
      h('p', null, "Har bir kuratorning oyligi qanday hisoblangani batafsil ko'rsatilgan. Pastdagi tugmalar orqali Excel yoki PDF qilib oling."),
      h('div', { style: 'margin-top:8px' }, rep.closed ? badge(`Oy yopilgan (${new Date(rep.closedAt).toLocaleDateString('uz-UZ')})`, 'ok') : badge('Oy hali ochiq — raqamlar o\'zgarishi mumkin', 'warn'))),
    h('div', { class: 'inline noprint' },
      h('button', { class: 'btn', onclick: async (e) => { e.target.disabled = true; try { await download(`/report/${state.month}/excel`, `oylik-${state.month}.xlsx`); } catch (ex) { toast(ex.message, true); } e.target.disabled = false; } }, '⬇ Excel'),
      h('button', { class: 'btn', onclick: () => window.print() }, '⎙ PDF / Chop etish'),
      isAdmin() ? (rep.closed
        ? h('button', { class: 'btn danger', onclick: async () => {
          if (!(await confirmBox({ title: 'Oyni qayta ochish', message: "Oy qayta ochilsa, o'zgartirishlar yana mumkin bo'ladi va hisob qayta hisoblanadi. Davom etasizmi?", okLabel: 'Ha, qayta ochish', danger: true }))) return;
          try { await api(`/report/${state.month}/close`, { method: 'DELETE' }); toast('Oy qayta ochildi'); refresh(); } catch (e) { toast(e.message, true); }
        } }, '🔓 Oyni qayta ochish')
        : h('button', { class: 'btn primary', onclick: async () => {
          const w = rep.warnings.filter((x) => x.level === 'warn');
          const msg = h('div', null, h('p', null, `${monthLabel(state.month)} oyi yopiladi: hisob-kitob "muzlatiladi" va keyin qoida narxlari o'zgarsa ham bu oyning natijasi o'zgarmaydi. Jami: `, h('b', null, som(rep.grandTotal))),
            w.length ? h('div', { class: 'alert warn' }, h('b', null, `Diqqat: ${w.length} ta ogohlantirish bor:`), h('ul', null, w.slice(0, 6).map((x) => h('li', null, x.text)))) : null);
          if (!(await confirmBox({ title: 'Oyni yopish', message: msg, okLabel: 'Ha, oyni yopish' }))) return;
          try { await api(`/report/${state.month}/close`, { method: 'POST' }); toast('Oy yopildi ✓'); refresh(); } catch (e) { toast(e.message, true); }
        } }, '🔒 Oyni yopish')) : null)));

  if (warn.length) root.append(h('div', { class: 'alert warn noprint' }, h('b', null, 'Yopishdan oldin tekshiring:'), h('ul', null, warn.map((w) => h('li', null, w.text)))));
  // Tanlangan bo'lim bo'yicha qatorlar
  const people = rep.curators.map((c) => { const lines = c.lines.filter((l) => matches(l, sec)); return { ...c, lines, sum: lines.reduce((a, l) => a + l.amount, 0) }; }).filter((c) => c.lines.length);
  if (!people.length) { root.append(h('div', { class: 'card' }, empty("Bu bo'limda shu oy hisoblangan oylik yo'q", "Boshqa bo'lim yoki oyni tanlang (yuqoridagi tanlovlar)."))); return; }
  const kur = people.filter((c) => !c.isStaff), qc = people.filter((c) => c.isStaff);
  const sumL = (c, f) => c.lines.filter(f).reduce((a, l) => a + l.amount, 0);
  const cardCell = (c) => h('td', null, h('div', { class: 'inline' }, h('span', { class: 'cardno' }, fmtCard(c.cardNumber) || '—'), h('span', { class: 'noprint' }, copyButton(c.cardNumber))));

  // Nusxalash uchun matn: karta / ism / potok (guruhlar) / summa — bo'lim tanlanadi
  const rows = people.flatMap((c) => entriesOf(c, c.lines));
  const spaced = h('input', { type: 'checkbox', checked: true });
  const ta = h('textarea', { class: 'input copybox', readonly: true, 'aria-label': 'Nusxalash uchun matn' });
  const fill = () => { ta.value = textOf(rows, spaced.checked); };
  spaced.addEventListener('change', fill); fill();
  const secOpts = [['all', "Hamma bo'limlar"], ['curators', 'Faqat kuratorlar (potoklar + Rustilida.uz)'], ...state.data.flows.map((f) => ['flow:' + f.id, f.name]), ['rustilida', 'Faqat Rustilida.uz'], ['qc', 'Faqat sifat nazoratchilari']];
  const secSel = select(secOpts, sec, { 'aria-label': "Nusxalanadigan bo'lim", style: 'width:auto;min-width:230px;font-weight:600', onchange: (e) => { state.reportSection = e.target.value; refresh(); } });
  root.append(h('div', { class: 'card noprint' }, h('div', { class: 'cardhead' }, h('h2', null, 'Nusxalash uchun matn'),
    h('div', { class: 'inline' }, secSel, h('button', { class: 'btn primary', type: 'button', onclick: () => copyText(ta.value, `${rows.length} ta to'lov nusxalandi ✓`) }, '📋 Nusxalash'))),
    h('p', { class: 'muted small' }, `Tanlangan: ${secName} — ${rows.length} ta to'lov. Har bir to'lov 4 qatorda: karta raqami, ism, potok (guruhlari) yoki bo'lim, oylik summasi.`),
    rows.length ? ta : h('div', { class: 'muted' }, "Matn uchun ma'lumot yo'q."), h('label', { class: 'check' }, spaced, "Summani bo'sh joy bilan yozish (1 500 000)")));

  const tfoot = (cols, vals) => h('tfoot', null, h('tr', null, h('td', { colspan: cols }, 'JAMI'), ...vals.map((v) => h('td', { class: 'num' }, som(v)))));
  if (kur.length) {
    const t = (f) => kur.reduce((a, c) => a + sumL(c, f), 0);
    root.append(h('h2', { style: 'margin:18px 0 10px' }, 'Kuratorlar'), h('div', { class: 'card flush' }, h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['№', 'Kurator', 'Karta raqami', 'Potok', 'Rustilida.uz', 'JAMI'].map((x, i) => h('th', { class: i > 2 ? 'num' : '' }, x)))),
      h('tbody', null, kur.map((c, i) => h('tr', null, h('td', null, i + 1), h('td', null, h('b', null, c.name)), cardCell(c),
        h('td', { class: 'num' }, som(sumL(c, (l) => l.section === 'flow'))), h('td', { class: 'num' }, som(sumL(c, (l) => l.section === 'rustilida'))),
        h('td', { class: 'num' }, h('b', null, som(c.sum)))))),
      tfoot(3, [t((l) => l.section === 'flow'), t((l) => l.section === 'rustilida'), kur.reduce((a, c) => a + c.sum, 0)])))));
  }
  if (qc.length) {
    // Sifat nazorati: potok / nazoratchi / guruhlar soni / jami
    const detail = [];
    for (const c of qc) {
      const byFlow = new Map();
      for (const l of c.lines) if (l.kind === 'bonus' && l.bonusKind === 'messages') {
        const k = l.flowName || 'Potok'; const o = byFlow.get(k) || { groups: new Set(), amount: 0 }; o.groups.add(l.groupId); o.amount += l.amount; byFlow.set(k, o);
      }
      for (const [k, o] of byFlow) detail.push([k, c.name, o.groups.size, o.amount]);
      const fs = sumL(c, (l) => l.bonusKind === 'flow_sales'); if (fs) detail.push(["Yangi potok sotuvi (5%)", c.name, '—', fs]);
      const rs = sumL(c, (l) => l.bonusKind === 'rustilida_sales'); if (rs) detail.push(['Rustilida.uz sotuvi', c.name, '—', rs]);
      const hd = sumL(c, (l) => l.kind === 'head'); if (hd) detail.push(["Bo'lim rahbari (stabil oylik)", c.name, '—', hd]);
    }
    root.append(h('h2', { style: 'margin:18px 0 10px' }, 'Sifat nazorati'), h('div', { class: 'card flush' }, h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Potok', 'Nazoratchi ismi', 'Potok bo\'yicha guruhlari soni', 'Shu potokdagi jami oyligi'].map((x, i) => h('th', { class: i > 1 ? 'num' : '' }, x)))),
      h('tbody', null, detail.map((r) => h('tr', null, h('td', null, r[0]), h('td', null, h('b', null, r[1])), h('td', { class: 'num' }, String(r[2])), h('td', { class: 'num' }, som(r[3]))))),
      tfoot(3, [detail.reduce((a, r) => a + r[3], 0)])))));
    root.append(h('div', { class: 'card flush' }, h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Xodim', 'Karta raqami', 'Xabar tekshiruvi', 'Potok sotuvi (5%)', 'Rustilida.uz sotuvi', 'Stabil oylik', 'JAMI'].map((x, i) => h('th', { class: i > 1 ? 'num' : '' }, x)))),
      h('tbody', null, qc.map((c) => h('tr', null, h('td', null, h('b', null, c.name), c.staffRole === 'head' ? [' ', badge('rahbar')] : null), cardCell(c),
        h('td', { class: 'num' }, som(sumL(c, (l) => l.bonusKind === 'messages'))), h('td', { class: 'num' }, som(sumL(c, (l) => l.bonusKind === 'flow_sales'))), h('td', { class: 'num' }, som(sumL(c, (l) => l.bonusKind === 'rustilida_sales'))), h('td', { class: 'num' }, som(sumL(c, (l) => l.kind === 'head'))),
        h('td', { class: 'num' }, h('b', null, som(c.sum)))))),
      tfoot(2, [qc.reduce((a, c) => a + sumL(c, (l) => l.bonusKind === 'messages'), 0), qc.reduce((a, c) => a + sumL(c, (l) => l.bonusKind === 'flow_sales'), 0), qc.reduce((a, c) => a + sumL(c, (l) => l.bonusKind === 'rustilida_sales'), 0), qc.reduce((a, c) => a + sumL(c, (l) => l.kind === 'head'), 0), qc.reduce((a, c) => a + c.sum, 0)])))));
  }
  root.append(h('div', { class: 'alert' }, h('b', null, `${secName} bo'yicha umumiy jami: ${som(people.reduce((a, c) => a + c.sum, 0))}`)));

  // Batafsil hisob
  root.append(h('h2', { style: 'margin:22px 0 10px' }, 'Qanday hisoblandi? (batafsil)'));
  for (const c of people) {
    root.append(h('details', { class: 'cur', open: true },
      h('summary', null, h('span', null, c.name), h('span', null, som(c.sum))),
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Bo\'lim', 'Guruh / bonus', 'Davr', 'Qoida', 'Hisob-kitob', 'Summa'].map((x, i) => h('th', { class: i === 5 ? 'num' : '' }, x)))),
        h('tbody', null, c.lines.map((l) => h('tr', null,
          h('td', null, badge(SECTION[l.section], l.section === 'bonus' ? 'warn' : l.section === 'qc' ? 'gray' : '')),
          h('td', null, l.title, l.warnings.map((w) => h('div', { class: 'small', style: 'color:var(--accent)' }, '⚠ ' + w))),
          h('td', { class: 'nowrap' }, l.period || '—', l.payDate ? h('div', { class: 'formula' }, `To'lov sanasi: ${l.payDate}`) : null, l.cycle ? h('div', { class: 'formula' }, `Hisob davri: ${l.cycle}`) : null),
          h('td', null, l.ruleName),
          h('td', null, l.formula, l.workedDays ? h('div', { class: 'formula' }, `Ishlagan: ${l.workedDays} kun`) : null),
          h('td', { class: 'num' }, h('b', null, som(l.amount)))))),
        h('tfoot', null, h('tr', null, h('td', { colspan: 5 }, `${c.name} — jami`), h('td', { class: 'num' }, som(c.sum))))))));
  }
}
