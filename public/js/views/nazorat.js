// Sifat nazorati bo'limi: nazoratchilar, rahbarning stabil oyligi, xabar tekshiruvlari (potok bo'yicha), Rustilida.uz sotuvi.
import { api } from '../api.js';
import { h, som, money, moneyInput, badge, empty, toast, select, confirmBox, field, cardInput, copyButton, fmtCard, formModal, groupPeriod, monthLabel, fmtDate } from '../ui.js';
import { state, isAdmin, curatorName } from '../state.js';

let selFlow = '';
const isHead = (x) => x.staff_role === 'head';

function staffForm(x, refresh) {
  const first = h('input', { class: 'input', value: x?.first_name || '', maxlength: 60, autocomplete: 'off' });
  const last = h('input', { class: 'input', value: x?.last_name || '', maxlength: 60, autocomplete: 'off' });
  const role = select([['inspector', 'Nazoratchi (xabar tekshiradi)'], ['head', "Bo'lim rahbari (stabil oylik oladi)"]], x?.staff_role || 'inspector');
  const salary = moneyInput(x?.monthly_salary, { placeholder: "Masalan: 5 000 000" });
  const hire = h('input', { class: 'input', type: 'date', value: x?.hire_date || '' });
  const card = cardInput(x?.card_number);
  const active = h('input', { type: 'checkbox', checked: x ? !!x.active : true });
  const headBox = h('div', null, field("Stabil oylik (so'm / oyiga)", salary, "Har oy o'zgarmas summa; oyning 1-sanasida to'lanadi."), field('Ish boshlagan sana', hire, "Oylik shu oydan boshlab hisoblanadi (bo'sh bo'lsa — doim)."));
  const sync = () => headBox.classList.toggle('hidden', role.value !== 'head');
  role.addEventListener('change', sync); sync();
  formModal({
    title: x ? 'Xodimni tahrirlash' : "Sifat nazorati xodimini qo'shish",
    intro: "Bu bo'limga faqat sifat nazorati bo'limida ishlaydigan xodimlar qo'shiladi (kuratorlar emas).",
    fields: [h('div', { class: 'row' }, field('Ism', first), field('Familiya', last)), field('Lavozim', role), headBox,
      field('Plastik karta raqami (16 ta raqam)', card), x ? h('label', { class: 'check' }, active, 'Faol') : null],
    onSubmit: async () => {
      await api(x ? '/staff/' + x.id : '/staff', { method: x ? 'PUT' : 'POST', body: { first_name: first.value, last_name: last.value, department: 'Sifat nazorati', staff_role: role.value, monthly_salary: salary.num(), hire_date: hire.value || null, card_number: card.value, active: x ? active.checked : true } });
      toast('Saqlandi ✓'); refresh();
    },
  });
}

function staffCard(refresh) {
  const list = state.data.staff;
  return h('div', { class: 'card' },
    h('div', { class: 'cardhead' }, h('h2', null, 'Sifat nazorati xodimlari'), h('button', { class: 'btn sm primary', onclick: () => staffForm(null, refresh) }, "+ Xodim qo'shish")),
    list.length ? h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Xodim', 'Lavozim', 'Karta raqami', 'Stabil oylik', '', ''].map((t) => h('th', null, t)))),
      h('tbody', null, list.map((x) => h('tr', null,
        h('td', null, h('b', null, `${x.last_name} ${x.first_name}`)),
        h('td', null, isHead(x) ? badge("Bo'lim rahbari") : badge('Nazoratchi', 'gray')),
        h('td', null, h('div', { class: 'inline' }, h('span', { class: 'cardno' }, fmtCard(x.card_number)), copyButton(x.card_number))),
        h('td', null, isHead(x) ? som(x.monthly_salary) : '—'),
        h('td', null, x.active ? null : badge('Faol emas', 'gray')),
        h('td', { class: 'right nowrap' }, h('button', { class: 'btn sm', onclick: () => staffForm(x, refresh) }, 'Tahrirlash'), ' ',
          isAdmin() ? h('button', { class: 'btn sm danger', onclick: async () => {
            if (!(await confirmBox({ message: `${x.last_name} ${x.first_name} o'chirilsinmi? Hisob-kitobda qatnashgan bo'lsa, o'chirilmaydi.`, okLabel: "Ha, o'chirish", danger: true }))) return;
            try { await api('/staff/' + x.id, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (e) { toast(e.message, true); }
          } }, "O'chirish") : null))))))
      : h('div', { class: 'muted' }, "Hali xodim qo'shilmagan. \"+ Xodim qo'shish\" tugmasini bosing."));
}

// ---- Xabar tekshiruvi: potok tanlanadi, jadval: guruhlar × nazoratchilar
function messagesCard(refresh) {
  const closed = state.data.isClosed;
  const rules = state.data.rules.filter((r) => r.type === 'per_unit' && r.active);
  const inspectors = state.data.staff.filter((x) => x.active && !isHead(x));
  const flows = state.data.flows;
  const card = h('div', { class: 'card' }, h('h2', null, 'Xabar tekshiruvi (potok bo\'yicha)'));
  if (!rules.length) { card.append(h('div', { class: 'alert danger' }, `Xabar tekshiruvi narxi qoidasi yo'q. ${isAdmin() ? '"Oylik qoidalari" bo\'limida yarating.' : 'Admin yaratishi kerak.'}`)); return card; }
  if (!inspectors.length) { card.append(h('div', { class: 'muted' }, "Avval yuqoridan nazoratchi xodimni qo'shing.")); return card; }
  if (!flows.length) { card.append(h('div', { class: 'muted' }, "Hali potok yo'q.")); return card; }
  if (!flows.some((f) => f.id === selFlow)) selFlow = flows[0].id;
  let rule = rules[0];
  const entries = state.data.bonuses.filter((b) => b.kind === 'messages');
  const body = h('div');
  const draw = () => {
    const groups = state.data.groups.filter((g) => g.flow_id === selFlow && groupPeriod(g, state.month));
    if (!groups.length) { body.replaceChildren(empty('Bu potokda shu oyda hisob davri bo\'lgan guruh yo\'q', '')); return; }
    const cells = new Map(); // `${gid}|${sid}` -> {input, entry}
    const price = (e) => (e ? e.rule_snapshot : rule).params.price;
    const expected = rule.params.expected;
    const sumRow = h('tr'), moneyRow = h('tr');
    const totals = () => {
      sumRow.replaceChildren(h('td', null, h('b', null, 'Jami (soni)')), ...inspectors.map((s) => h('td', { class: 'num' }, String(groups.reduce((a, g) => a + (Number(cells.get(g.id + '|' + s.id).input.value) || 0), 0)))), h('td'));
      moneyRow.replaceChildren(h('td', null, h('b', null, 'Shu potokdagi oylik')), ...inspectors.map((s) => h('td', { class: 'num' }, h('b', null, som(groups.reduce((a, g) => { const c = cells.get(g.id + '|' + s.id); return a + (Number(c.input.value) || 0) * price(c.entry); }, 0))))), h('td'));
    };
    const rows = groups.map((g) => {
      const total = h('td');
      const tr = h('tr', null, h('td', null, h('b', null, g.name)),
        ...inspectors.map((s) => {
          const entry = entries.find((e) => e.group_id === g.id && e.curator_id === s.id);
          const input = h('input', { class: 'input', type: 'number', min: 0, step: 1, inputmode: 'numeric', value: entry ? entry.quantity : '', style: 'width:84px', 'aria-label': `${s.last_name} — ${g.name}`, disabled: closed });
          cells.set(g.id + '|' + s.id, { input, entry });
          input.addEventListener('input', () => { totals(); paintRow(); });
          return h('td', null, input);
        }), total);
      const paintRow = () => {
        const n = inspectors.reduce((a, s) => a + (Number(cells.get(g.id + '|' + s.id).input.value) || 0), 0);
        total.replaceChildren(n >= expected ? badge(`${n} ta ✓`, 'ok') : badge(`${n} / ${expected} ta`, 'warn'));
      };
      paintRow();
      return tr;
    });
    totals();
    const save = h('button', { class: 'btn primary', type: 'button', disabled: closed, onclick: async () => {
      save.disabled = true;
      try {
        for (const [key, c] of cells) {
          const [gid, sid] = key.split('|');
          const v = c.input.value === '' ? null : Number(c.input.value);
          if (c.entry && v === null) await api('/bonuses/' + c.entry.id, { method: 'DELETE' });
          else if (c.entry && v !== Number(c.entry.quantity)) await api('/bonuses/' + c.entry.id, { method: 'PUT', body: { quantity: v } });
          else if (!c.entry && v !== null) await api('/bonuses', { method: 'POST', body: { month: state.month, kind: 'messages', curator_id: sid, group_id: gid, quantity: v, rule_id: rule.id } });
        }
        toast('Saqlandi ✓'); refresh();
      } catch (e) { toast(e.message, true); save.disabled = false; }
    } }, 'Saqlash');
    body.replaceChildren(
      h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Guruh'), ...inspectors.map((s) => h('th', null, `${s.last_name} ${s.first_name}`)), h('th', null, `Guruh jami (me'yor ${expected})`))),
        h('tbody', null, rows), h('tfoot', null, sumRow, moneyRow))),
      h('div', { style: 'margin-top:12px' }, save));
  };
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, flows.map((f) => h('button', { class: 'tab' + (f.id === selFlow ? ' active' : ''), type: 'button', role: 'tab', onclick: () => { selFlow = f.id; refresh(); } }, f.name)));
  card.append(tabs);
  if (rules.length > 1) card.append(h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Narx qoidasi'), select(rules.map((r) => [r.id, `${r.name} — ${r.summary}`]), rule.id, { onchange: (e) => { rule = rules.find((r) => r.id === e.target.value); draw(); } })));
  else card.append(h('p', { class: 'muted small' }, `Amaldagi qoida: ${rule.name} — ${rule.summary}. Faqat sonlarni yozing, summa o'zi hisoblanadi.`));
  card.append(body);
  draw();
  return card;
}

// ---- Rustilida.uz sotuvi (faqat Admin kiritadi)
function rustilidaSalesCard(refresh) {
  const closed = state.data.isClosed;
  const rules = state.data.rules.filter((r) => r.type === 'per_sale' && r.active);
  const inspectors = state.data.staff.filter((x) => x.active && !isHead(x));
  const groups = state.data.groups.filter((g) => g.section === 'rustilida');
  const entries = state.data.bonuses.filter((b) => b.kind === 'rustilida_sales');
  const card = h('div', { class: 'card' }, h('h2', null, 'Rustilida.uz sotuvi'),
    h('p', { class: 'muted small' }, "Nazoratchi qaysi Rustilida.uz guruhi va nechanchi oy bo'yicha, keyingi oy uchun to'lov qilgan o'quvchilar sonini admin kiritadi. Bonus = o'quvchilar soni × bitta sotuv uchun belgilangan summa."));
  if (!rules.length) { card.append(h('div', { class: 'alert danger' }, `Rustilida.uz sotuvi uchun summa qoidasi yo'q. ${isAdmin() ? '"Oylik qoidalari" bo\'limida "Har bir sotuvga qat\'iy summa" turini yarating.' : 'Admin yaratishi kerak.'}`)); }
  if (isAdmin() && rules.length && !closed) {
    if (!inspectors.length || !groups.length) card.append(h('div', { class: 'muted' }, !inspectors.length ? "Avval nazoratchi xodim qo'shing." : "Avval Rustilida.uz guruhini yarating."));
    else {
      const who = select([['', 'Nazoratchini tanlang…'], ...inspectors.map((s) => [s.id, `${s.last_name} ${s.first_name}`])], '');
      const grp = select([['', 'Guruhni tanlang…'], ...groups.map((g) => [g.id, g.name])], '');
      const mno = select([['', 'Nechanchi oy…'], ...[1, 2, 3, 4, 5].map((n) => [n, `${n}-oy uchun`])], '');
      const cnt = h('input', { class: 'input', type: 'number', min: 0, inputmode: 'numeric', placeholder: "To'lov qilgan o'quvchilar soni" });
      const rsel = rules.length > 1 ? select(rules.map((r) => [r.id, `${r.name} — ${r.summary}`]), rules[0].id) : null;
      const go = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
        go.disabled = true;
        try { await api('/bonuses', { method: 'POST', body: { month: state.month, kind: 'rustilida_sales', curator_id: who.value, group_id: grp.value, month_no: mno.value, quantity: cnt.value, rule_id: rsel ? rsel.value : rules[0].id } }); toast('Saqlandi ✓'); refresh(); }
        catch (e) { toast(e.message, true); go.disabled = false; }
      } }, "Qo'shish");
      card.append(h('div', { class: 'inline', style: 'margin-bottom:12px' }, who, grp, mno, cnt, rsel, go));
    }
  }
  card.append(entries.length ? h('div', { class: 'tablewrap' }, h('table', null,
    h('thead', null, h('tr', null, ['Nazoratchi', 'Guruh', 'Oy', "O'quvchilar soni", 'Bonus', ''].map((t) => h('th', null, t)))),
    h('tbody', null, entries.map((b) => h('tr', null,
      h('td', null, h('b', null, curatorName(b.curator_id))), h('td', null, state.idx.group[b.group_id]?.name || ''), h('td', null, `${b.month_no}-oy`),
      h('td', null, String(b.quantity)), h('td', null, h('b', null, som(b.quantity * b.rule_snapshot.params.amount))),
      h('td', { class: 'right' }, isAdmin() && !closed ? h('button', { class: 'btn sm danger', 'aria-label': "O'chirish", onclick: async () => {
        if (!(await confirmBox({ message: "Bu yozuv o'chirilsinmi?", okLabel: "Ha, o'chirish", danger: true }))) return;
        try { await api('/bonuses/' + b.id, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (e) { toast(e.message, true); }
      } }, '✕') : null)))))) : h('div', { class: 'muted' }, "Bu oy uchun hali yozuv yo'q."));
  return card;
}

// ---- Yangi potokka o'tish sotuvi (5%): faqat nazoratchilar
function flowSalesCard(refresh) {
  const closed = state.data.isClosed;
  const rules = state.data.rules.filter((r) => r.type === 'percent' && r.active);
  const inspectors = state.data.staff.filter((x) => x.active && !isHead(x));
  const entries = state.data.bonuses.filter((b) => b.kind === 'flow_sales');
  const card = h('div', { class: 'card' }, h('h2', null, "Yangi potokka o'tish sotuvi (5%)"),
    h('p', { class: 'muted small' }, "Nazoratchi yangi potokka o'tkazgan sotuv hajmini (so'mda) kiriting — bonus qoidadagi foiz bo'yicha o'zi hisoblanadi."));
  if (!rules.length) { card.append(h('div', { class: 'alert danger' }, `Foiz qoidasi yo'q. ${isAdmin() ? '"Oylik qoidalari" bo\'limida "Sotuvdan foiz" turini yarating.' : 'Admin yaratishi kerak.'}`)); return card; }
  if (!inspectors.length) { card.append(h('div', { class: 'muted' }, "Avval nazoratchi xodim qo'shing.")); return card; }
  const rule = rules[0];
  const rows = inspectors.map((s) => {
    const entry = entries.find((b) => b.curator_id === s.id);
    const params = (entry ? entry.rule_snapshot : rule).params;
    const inp = moneyInput(entry?.quantity, { 'aria-label': 'Sotuv hajmi', disabled: closed });
    const amount = h('td', { class: 'num' });
    const paint = () => { const q = inp.num(); amount.replaceChildren(q === null ? '—' : h('b', null, som((q * params.percent) / 100))); };
    inp.addEventListener('input', paint); paint();
    const save = h('button', { class: 'btn sm primary', type: 'button', disabled: closed, onclick: async () => {
      const q = inp.num();
      save.disabled = true;
      try {
        if (entry && q === null) await api('/bonuses/' + entry.id, { method: 'DELETE' });
        else if (entry) await api('/bonuses/' + entry.id, { method: 'PUT', body: { quantity: q } });
        else if (q === null) { toast('Avval hajmni kiriting', true); save.disabled = false; return; }
        else await api('/bonuses', { method: 'POST', body: { month: state.month, kind: 'flow_sales', curator_id: s.id, quantity: q, rule_id: rule.id } });
        toast('Saqlandi ✓'); refresh();
      } catch (e) { toast(e.message, true); save.disabled = false; }
    } }, entry ? 'Yangilash' : 'Saqlash');
    return h('tr', null, h('td', null, h('b', null, `${s.last_name} ${s.first_name}`)), h('td', null, inp), h('td', null, badge(`${params.percent}%`)), amount, h('td', { class: 'right' }, save));
  });
  card.append(h('div', { class: 'tablewrap' }, h('table', null,
    h('thead', null, h('tr', null, ['Nazoratchi', "Sotuv hajmi (so'm)", 'Foiz', 'Bonus summasi', ''].map((t) => h('th', null, t)))), h('tbody', null, rows))),
    h('p', { class: 'muted small' }, `Amaldagi qoida: ${rule.name} — ${rule.summary}. Qiymatni o'chirib "Yangilash" bosilsa yozuv o'chadi.`));
  return card;
}

// ---- Xodimlar bo'yicha jami oylik
function totalsCard() {
  const people = state.data.report.curators.filter((c) => c.isStaff);
  const sumKind = (c, f) => c.lines.filter(f).reduce((a, l) => a + l.amount, 0);
  const grand = people.reduce((a, c) => a + c.total, 0);
  return h('div', { class: 'card flush' }, h('div', { class: 'cardhead', style: 'padding:16px 18px 0' }, h('h2', null, `Sifat nazorati — ${monthLabel(state.month)} oyi jami oyliklar`), h('span', { class: 'muted small' }, "To'lov sanasi: keyingi oyning 1-sanasi")),
    people.length ? h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Xodim', 'Xabar tekshiruvi', 'Potok sotuvi (5%)', 'Rustilida.uz sotuvi', 'Stabil oylik', 'JAMI'].map((t, i) => h('th', { class: i ? 'num' : '' }, t)))),
      h('tbody', null, people.map((c) => h('tr', null, h('td', null, h('b', null, c.name), ' ', c.staffRole === 'head' ? badge("rahbar") : null),
        h('td', { class: 'num' }, som(sumKind(c, (l) => l.bonusKind === 'messages'))), h('td', { class: 'num' }, som(sumKind(c, (l) => l.bonusKind === 'flow_sales'))), h('td', { class: 'num' }, som(sumKind(c, (l) => l.bonusKind === 'rustilida_sales'))),
        h('td', { class: 'num' }, som(sumKind(c, (l) => l.kind === 'head'))), h('td', { class: 'num' }, h('b', null, som(c.total)))))),
      h('tfoot', null, h('tr', null, h('td', null, 'UMUMIY JAMI'), h('td', { class: 'num' }, som(people.reduce((a, c) => a + sumKind(c, (l) => l.bonusKind === 'messages'), 0))), h('td', { class: 'num' }, som(people.reduce((a, c) => a + sumKind(c, (l) => l.bonusKind === 'flow_sales'), 0))), h('td', { class: 'num' }, som(people.reduce((a, c) => a + sumKind(c, (l) => l.bonusKind === 'rustilida_sales'), 0))), h('td', { class: 'num' }, som(people.reduce((a, c) => a + sumKind(c, (l) => l.kind === 'head'), 0))), h('td', { class: 'num' }, som(grand))))))
      : h('div', { class: 'empty' }, h('b', null, "Bu oy uchun hisoblangan oylik yo'q"), "Xabar tekshiruvi sonini kiriting yoki rahbar uchun stabil oylik belgilang."));
}

export async function render(root, { refresh }) {
  root.append(h('div', { class: 'pagehead' }, h('div', null, h('h1', null, 'Sifat nazorati'),
    h('p', null, `${monthLabel(state.month)} oyi. Bu bo'lim kuratorlardan alohida: nazoratchilar xabar tekshiruvi uchun, bo'lim rahbari esa stabil oylik oladi. Oylik har oyning 1-sanasida to'lanadi.`))));
  if (state.data.isClosed) root.append(h('div', { class: 'alert warn' }, `${monthLabel(state.month)} oyi yopilgan — o'zgartirib bo'lmaydi.`));
  root.append(staffCard(refresh), messagesCard(refresh), flowSalesCard(refresh), rustilidaSalesCard(refresh), totalsCard());
}
