import { api } from '../api.js';
import { h, field, moneyInput, formModal, confirmBox, toast, empty, badge, select, money } from '../ui.js';
import { state, RULE_TYPES } from '../state.js';

const SAMPLES = [
  { name: 'Potok kuratori — oylik 3 000 000', type: 'fixed', params: { amount: 3000000, proportional: true } },
  { name: 'Kunlik stavka 100 000', type: 'daily', params: { rate: 100000 } },
  { name: 'Rustilida.uz — 1 talaba uchun stavka', type: 'tiers', params: { tiers: [{ from: 1, to: 10, amount: 50000 }, { from: 11, to: 20, amount: 60000 }, { from: 21, to: null, amount: 70000 }] } },
  { name: 'Xabar tekshiruvi (1 ta = 50 000)', type: 'per_unit', params: { price: 50000, expected: 4 } },
  { name: "Potokka o'tish sotuvi — 5%", type: 'percent', params: { percent: 5 } },
  { name: 'Rustilida.uz sotuvi (1 ta = 100 000)', type: 'per_sale', params: { amount: 100000 } },
];

// Boshqa sahifalardan ham chaqiriladi (masalan, Rustilida darajalar shkalasi)
export function ruleForm(rule, refresh, presetType) {
  const type = select(Object.entries(RULE_TYPES).map(([k, v]) => [k, `${v.use === 'group' ? 'Guruh uchun' : 'Bonus uchun'}: ${v.label}`]), rule?.type || presetType || 'fixed');
  const name = h('input', { class: 'input', value: rule?.name || '', maxlength: 80, placeholder: "Masalan: Potok kuratori — 3 000 000" });
  const note = h('input', { class: 'input', value: rule?.note || '', maxlength: 300, placeholder: "Ixtiyoriy izoh" });
  const active = h('input', { type: 'checkbox', checked: rule ? !!rule.active : true });
  const dyn = h('div');
  const help = h('div', { class: 'alert' });
  let get = () => ({});

  const draw = () => {
    const t = type.value; const p = rule && rule.type === t ? rule.params : {};
    help.textContent = RULE_TYPES[t].help;
    if (t === 'fixed') {
      const a = moneyInput(p.amount); const pr = h('input', { type: 'checkbox', checked: p.proportional !== false });
      dyn.replaceChildren(field("Oylik summa (so'm)", a), h('label', { class: 'check' }, pr, "Kunlarga mutanosib bo'lsin (tavsiya etiladi)"),
        h('div', { class: 'hint muted small' }, "Yoqilgan bo'lsa: kurator oy o'rtasida almashsa, har biri ishlagan kuniga qarab ulush oladi. Ulushlar yig'indisi doim to'liq summaga teng bo'ladi."));
      get = () => ({ amount: a.num(), proportional: pr.checked });
    } else if (t === 'daily') {
      const a = moneyInput(p.rate); dyn.replaceChildren(field("1 kunlik stavka (so'm)", a)); get = () => ({ rate: a.num() });
    } else if (t === 'per_unit') {
      const a = moneyInput(p.price); const e = h('input', { class: 'input', type: 'number', min: 0, value: p.expected ?? 4 });
      dyn.replaceChildren(field("1 ta xabar tekshiruvi narxi (so'm)", a), field("Oylik me'yor (har bir guruh uchun, ta)", e, "Kiritilgan son me'yordan kam bo'lsa, tizim ogohlantiradi.")); get = () => ({ price: a.num(), expected: e.value });
    } else if (t === 'percent') {
      const a = h('input', { class: 'input', inputmode: 'decimal', value: p.percent ?? 5 }); dyn.replaceChildren(field('Foiz (%)', a, 'Masalan: 5')); get = () => ({ percent: a.value });
    } else if (t === 'per_sale') {
      const a = moneyInput(p.amount); dyn.replaceChildren(field("1 ta sotuv uchun summa (so'm)", a)); get = () => ({ amount: a.num() });
    } else {
      const tiers = (p.tiers && p.tiers.length ? p.tiers : [{ from: 1, to: 10, amount: '' }]).map((x) => ({ ...x }));
      const list = h('div');
      const drawTiers = () => {
        list.replaceChildren(h('div', { class: 'tablewrap' }, h('table', null,
          h('thead', null, h('tr', null, ['Talaba soni: dan', 'gacha', "1 talaba uchun (so'm)", ''].map((x) => h('th', null, x)))),
          h('tbody', null, tiers.map((tr, i) => {
            const f = h('input', { class: 'input', type: 'number', min: 0, value: tr.from, 'aria-label': 'dan', oninput: (e) => { tr.from = e.target.value; } });
            const to = h('input', { class: 'input', type: 'number', min: 0, value: tr.to ?? '', placeholder: '∞ (cheksiz)', 'aria-label': 'gacha', oninput: (e) => { tr.to = e.target.value; } });
            const am = moneyInput(tr.amount, { 'aria-label': 'summa' }); am.addEventListener('input', () => { tr.amount = am.num(); });
            return h('tr', null, h('td', null, f), h('td', null, to), h('td', null, am),
              h('td', null, tiers.length > 1 ? h('button', { type: 'button', class: 'btn sm danger', 'aria-label': "Darajani o'chirish", onclick: () => { tiers.splice(i, 1); drawTiers(); } }, '✕') : null));
          })))),
          h('button', { type: 'button', class: 'btn sm', onclick: () => {
            const last = tiers[tiers.length - 1]; const next = last && last.to !== '' && last.to != null ? Number(last.to) + 1 : '';
            tiers.push({ from: next, to: '', amount: '' }); drawTiers();
          } }, "+ Daraja qo'shish"));
      };
      drawTiers();
      dyn.replaceChildren(h('p', { class: 'muted small' }, "Masalan: 1–10 talaba bo'lsa har bir talaba uchun 50 000, 11–20 talaba bo'lsa 60 000. Oylik = talabalar soni × stavka. Oxirgi darajaning \"gacha\" qismini bo'sh qoldirsangiz, \"va undan ko'p\" degani. Darajalar kesishmasligi kerak."), list);
      get = () => ({ tiers: tiers.map((x) => ({ from: x.from, to: x.to === '' ? null : x.to, amount: x.amount })) });
    }
  };
  type.addEventListener('change', draw);
  draw();
  formModal({
    title: rule ? 'Qoidani tahrirlash' : 'Yangi oylik qoidasi', wide: true,
    intro: rule ? "Diqqat: o'zgartirish faqat YANGI biriktirishlarga ta'sir qiladi. Allaqachon biriktirilgan va yopilgan oylar o'zgarmaydi." : null,
    fields: [field('Qoida turi', type), help, field('Qoida nomi', name, "Nomni tushunarli yozing — keyin ro'yxatdan shu nom bo'yicha tanlanadi."), dyn, field('Izoh', note),
      rule ? h('label', { class: 'check' }, active, 'Faol (yangi biriktirishlarda tanlash mumkin)') : null],
    onSubmit: async () => {
      await api(rule ? '/rules/' + rule.id : '/rules', { method: rule ? 'PUT' : 'POST', body: { name: name.value, type: type.value, params: get(), note: note.value, active: rule ? active.checked : true } });
      toast('Saqlandi ✓'); refresh();
    },
  });
}

export async function render(root, { refresh }) {
  const rules = state.data.rules;
  const section = (title, use) => {
    const rows = rules.filter((r) => RULE_TYPES[r.type].use === use);
    return h('div', { class: 'card flush' },
      h('div', { class: 'cardhead', style: 'padding:16px 18px 0' }, h('h2', null, title)),
      rows.length ? h('div', { class: 'tablewrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Nomi', 'Turi', 'Qiymati', 'Holat', ''].map((x) => h('th', null, x)))),
        h('tbody', null, rows.map((r) => h('tr', null,
          h('td', null, h('b', null, r.name), r.note ? h('div', { class: 'muted small' }, r.note) : null),
          h('td', null, RULE_TYPES[r.type].label), h('td', null, r.summary),
          h('td', null, r.active ? badge('Faol', 'ok') : badge('Faol emas', 'gray')),
          h('td', { class: 'right nowrap' },
            h('button', { class: 'btn sm', onclick: () => ruleForm(r, refresh) }, 'Tahrirlash'), ' ',
            h('button', { class: 'btn sm danger', onclick: async () => {
              if (!(await confirmBox({ title: "Qoidani o'chirish", message: `"${r.name}" o'chirilsinmi? Avval shu qoida bilan hisoblangan oylar o'zgarmaydi (ularning nusxasi saqlangan).`, okLabel: "Ha, o'chirish", danger: true }))) return;
              try { await api('/rules/' + r.id, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (e) { toast(e.message, true); }
            } }, "O'chirish"))))))) : empty("Hali qoida yo'q", ''));
  };
  const sampleBtn = h('button', { class: 'btn', onclick: async (e) => {
    e.target.disabled = true;
    try { for (const s of SAMPLES) await api('/rules', { method: 'POST', body: s }); toast("Namunalar yaratildi. Summalarni o'zingizga moslab tahrirlang."); refresh(); } catch (ex) { toast(ex.message, true); e.target.disabled = false; }
  } }, 'Tayyor namunalarni yaratish');
  root.append(
    h('div', { class: 'pagehead' },
      h('div', null, h('h1', null, 'Oylik qoidalari'), h('p', null, "Bu yerda oylik hisoblash \"shablonlari\" yaratiladi. Keyin ularni kuratorga biriktirasiz — tizim o'zi hisoblaydi.")),
      h('div', { class: 'inline' }, !rules.length ? sampleBtn : null, h('button', { class: 'btn primary', onclick: () => ruleForm(null, refresh) }, '+ Yangi qoida'))),
    h('div', { class: 'alert' }, "Qoida narxini o'zgartirsangiz, eski hisoblar buzilmaydi: har bir biriktirishda qoidaning o'sha paytdagi nusxasi (snapshot) saqlanadi. Yangi narxni mavjud biriktirishga qo'llash uchun \"Potok oyliklari\" sahifasidagi ↻ tugmasidan foydalaning."),
    section('Guruhlarga biriktiriladigan qoidalar (potok va Rustilida.uz)', 'group'),
    section('Bonus qoidalari (sifat nazorati va sotuv)', 'bonus'));
}
