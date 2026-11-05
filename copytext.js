// Nusxalash uchun matn: har bir to'lov 4 qatorda —
// karta raqami / ism / potok (guruhlar) yoki bo'lim / summa. To'lovlar orasida bo'sh qator.
import { money } from './ui.js';

// Qatorlardan (hisobot yoki to'lov tafsiloti) nusxalash yozuvlarini yig'adi
export function entriesOf(person, lines) {
  const map = new Map();
  const add = (key, label, groups, amount) => {
    const o = map.get(key) || { label, groups: new Set(), amount: 0 };
    if (groups) o.groups.add(groups);
    o.amount += amount; map.set(key, o);
  };
  for (const l of lines) {
    if (!l.amount) continue;
    if (l.kind === 'head') add('head', 'Sifat nazorati rahbari', null, l.amount);
    else if (l.bonusKind === 'rustilida_sales') add('rs:' + l.groupName, `Rustilida.uz sotuvi (${l.groupName}${l.monthNo ? ', ' + l.monthNo + '-oy' : ''})`, null, l.amount);
    else if (l.bonusKind === 'flow_sales') add('fs', 'Yangi potok sotuvi (5%)', null, l.amount);
    else if (l.section === 'rustilida') add('r:' + l.groupName, `Rustilida.uz (${l.groupName})`, null, l.amount);
    else add('f:' + (l.flowName || ''), l.flowName || 'Potok', l.groupName, l.amount);
  }
  return [...map.values()].map((o) => ({
    card: String(person.cardNumber || '').replace(/\D/g, ''), name: person.name,
    label: o.groups.size ? `${o.label} (${[...o.groups].join(', ')})` : o.label, amount: Math.round(o.amount),
  }));
}
export const textOf = (rows, spaced = true) => rows.map((r) => [r.card || "(karta yo'q)", r.name, r.label, spaced ? money(r.amount) : String(r.amount)].join('\n')).join('\n\n');
