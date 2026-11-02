import { api } from '../api.js';
import { h, MONTHS, field, cardInput, copyButton, fmtCard, fmtDate, formModal, confirmBox, toast, empty, badge, select } from '../ui.js';
import { state, isAdmin } from '../state.js';

function curatorForm(c, refresh) {
  const first = h('input', { class: 'input', value: c?.first_name || '', maxlength: 60, autocomplete: 'off' });
  const last = h('input', { class: 'input', value: c?.last_name || '', maxlength: 60, autocomplete: 'off' });
  const day = h('input', { class: 'input', type: 'number', min: 1, max: 31, inputmode: 'numeric', placeholder: 'Kun', value: c?.birth_day || '' });
  const mon = select([['', 'Oy'], ...MONTHS.map((n, i) => [i + 1, n])], c?.birth_month || '');
  const year = h('input', { class: 'input', type: 'number', min: 1940, max: new Date().getFullYear() - 14, inputmode: 'numeric', placeholder: 'Yil', value: c?.birth_year || '' });
  const hire = h('input', { class: 'input', type: 'date', value: c?.hire_date || '' });
  const card = cardInput(c?.card_number);
  const active = h('input', { type: 'checkbox', checked: c ? !!c.active : true });
  formModal({
    title: c ? 'Kuratorni tahrirlash' : "Yangi kurator qo'shish",
    fields: [
      h('div', { class: 'row' }, field('Ism', first), field('Familiya', last)),
      h('div', { class: 'field' }, h('span', { class: 'lbl' }, "Tug'ilgan sana"), h('div', { class: 'row' }, day, mon, year)),
      field('Ishga qabul qilingan sana', hire),
      field('Plastik karta raqami (16 ta raqam)', card, "To'lov shu kartaga o'tkaziladi. Raqamni diqqat bilan tekshiring."),
      c ? h('label', { class: 'check' }, active, 'Faol (hozir ishlayapti)') : null,
    ],
    onSubmit: async () => {
      await api(c ? '/curators/' + c.id : '/curators', {
        method: c ? 'PUT' : 'POST',
        body: { first_name: first.value, last_name: last.value, birth_day: day.value, birth_month: mon.value, birth_year: year.value, hire_date: hire.value, card_number: card.value, active: c ? active.checked : true },
      });
      toast('Saqlandi ✓'); refresh();
    },
  });
}

export async function render(root, { refresh }) {
  const list = state.data.curators;
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Ism yoki familiya bo\'yicha qidirish…', style: 'max-width:340px', 'aria-label': 'Qidirish' });
  const body = h('div');
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    const rows = list.filter((c) => !q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q));
    if (!rows.length) { body.replaceChildren(empty(list.length ? 'Hech narsa topilmadi' : "Hali kuratorlar yo'q", isAdmin() ? "\"Yangi kurator\" tugmasi orqali birinchi kuratorni qo'shing." : 'Admin kuratorlarni qo\'shadi.')); return; }
    body.replaceChildren(h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Kurator', "Tug'ilgan sana", 'Ishga qabul', 'Karta raqami', 'Holat', isAdmin() ? '' : null].map((t) => t !== null && h('th', null, t)))),
      h('tbody', null, rows.map((c) => h('tr', null,
        h('td', null, h('b', null, `${c.last_name} ${c.first_name}`)),
        h('td', { class: 'nowrap' }, `${String(c.birth_day).padStart(2, '0')}.${String(c.birth_month).padStart(2, '0')}.${c.birth_year}`),
        h('td', { class: 'nowrap' }, fmtDate(c.hire_date)),
        h('td', null, h('div', { class: 'inline' }, h('span', { class: 'cardno' }, fmtCard(c.card_number) || '—'), copyButton(c.card_number))),
        h('td', null, c.active ? badge('Faol', 'ok') : badge('Faol emas', 'gray')),
        isAdmin() ? h('td', { class: 'right nowrap' },
          h('button', { class: 'btn sm', onclick: () => curatorForm(c, refresh) }, 'Tahrirlash'), ' ',
          h('button', { class: 'btn sm danger', onclick: async () => {
            if (!(await confirmBox({ title: "Kuratorni o'chirish", message: `${c.last_name} ${c.first_name} o'chirilsinmi? Agar u hisob-kitoblarda qatnashgan bo'lsa, o'chirilmaydi — "Faol emas" qiling.`, okLabel: "Ha, o'chirish", danger: true }))) return;
            try { await api('/curators/' + c.id, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (e) { toast(e.message, true); }
          } }, "O'chirish")) : null,
      ))))));
  };
  search.addEventListener('input', draw);
  root.append(
    h('div', { class: 'pagehead' },
      h('div', null, h('h1', null, 'Kuratorlar'), h('p', null, "Hamma kuratorlar ro'yxati. Karta raqami yonidagi tugma raqamni nusxalaydi — to'lov ilovasiga qo'yishingiz mumkin.")),
      isAdmin() ? h('button', { class: 'btn primary', onclick: () => curatorForm(null, refresh) }, "+ Yangi kurator") : null),
    h('div', { class: 'card' }, h('div', { class: 'cardhead' }, search, h('span', { class: 'muted small' }, `Jami: ${list.length} ta`)), body));
  draw();
}
