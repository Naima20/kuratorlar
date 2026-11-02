import { api } from './api.js';

export const state = { user: null, month: null, data: null, idx: null, reportSection: 'all' };

export const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
state.month = (() => { try { return sessionStorage.getItem('kurator_month'); } catch { return null; } })() || currentMonth();
export function setMonth(m) { state.month = m; try { sessionStorage.setItem('kurator_month', m); } catch { /* ignore */ } }
export const isAdmin = () => state.user?.role === 'admin';

// Qoida turlari — oddiy tilda
export const RULE_TYPES = {
  fixed: { label: "Qat'iy oylik summa", use: 'group', help: "Guruh uchun belgilangan oylik summa. Kurator oy o'rtasida almashsa, summa ishlagan kunlariga qarab avtomatik bo'linadi." },
  daily: { label: 'Kunlik stavka', use: 'group', help: "Ishlangan har bir kun uchun to'lanadi. Oylik = kunlik stavka × ishlagan kunlar." },
  tiers: { label: "Talaba soniga qarab (1 talaba uchun stavka)", use: 'group', help: "Talabalar soniga qarab 1 ta talaba uchun stavka o'zi tanlanadi (masalan, 1–10 ta talaba: 50 000, 11–20 ta: 60 000). Oylik = talabalar soni × stavka." },
  per_unit: { label: 'Xabar tekshiruvi narxi', use: 'bonus', help: "Har bir xabar tekshiruvi uchun to'lov. Tekshiruvlar soni \"Sifat nazorati\" bo'limida kiritiladi." },
  percent: { label: "Sotuvdan foiz (%)", use: 'bonus', help: "Sotuv hajmidan foiz (masalan, 5%)." },
  per_sale: { label: "Har bir sotuvga qat'iy summa", use: 'bonus', help: "Har bir sotuv uchun bir xil summa." },
};
export const BONUS_KINDS = {
  messages: { label: 'Xabar tekshiruvi', ruleType: 'per_unit' },
  flow_sales: { label: "Yangi potokka o'tish sotuvi", ruleType: 'percent' },
  rustilida_sales: { label: 'Rustilida.uz sotuvi', ruleType: 'per_sale' },
};
export const SECTION_LABEL = { flow: 'Potok', rustilida: 'Rustilida.uz', bonus: 'Kurator bonusi', qc: 'Sifat nazorati' };

function buildIndex(d) {
  const by = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  state.idx = { curator: by([...d.curators, ...d.staff]), group: by(d.groups), flow: by(d.flows), rule: by(d.rules) };
}
export async function loadData() {
  const d = await api('/bootstrap?month=' + state.month);
  state.data = d; buildIndex(d);
  return d;
}
export const curatorName = (id) => { const c = state.idx.curator[id]; return c ? `${c.last_name} ${c.first_name}` : "Noma'lum kurator"; };
export const groupLabel = (g) => (g.section === 'flow' ? `${state.idx.flow[g.flow_id]?.name || ''} / ${g.name}` : `Rustilida.uz / ${g.name}`);
// Shu oy uchun guruhdagi talaba soni (kiritilmagan bo'lsa guruhdagi boshlang'ich qiymat)
export const studentsFor = (g) => {
  const v = state.data.students[g.id];
  return v === undefined ? { count: g.student_count, entered: false } : { count: v, entered: true };
};
// Hisobotdagi shu biriktirishga tegishli qator
export function lineFor(assignmentId) {
  for (const c of state.data.report.curators) for (const l of c.lines) if (l.assignmentId === assignmentId) return l;
  return null;
}
