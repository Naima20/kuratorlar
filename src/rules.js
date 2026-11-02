'use strict';
// Oylik qoidalari turlari va ularni tekshirish.
const { bad, reqNum, money } = require('./util');

const TYPES = {
  fixed:   { label: "Qat'iy oylik summa", where: 'assignment' },
  daily:   { label: 'Kunlik stavka (kunga hisoblanadi)', where: 'assignment' },
  tiers:   { label: "Talaba soniga qarab daraja (1 talaba uchun stavka)", where: 'assignment' },
  per_unit:{ label: 'Har bir xabar tekshiruvi uchun narx', where: 'bonus:messages' },
  percent: { label: 'Sotuvdan foiz', where: 'bonus:flow_sales' },
  per_sale:{ label: 'Har bir sotuv uchun qat\'iy summa', where: 'bonus:rustilida_sales' },
};
const BONUS_RULE_TYPE = { messages: 'per_unit', flow_sales: 'percent', rustilida_sales: 'per_sale' };

function normalizeParams(type, p = {}) {
  switch (type) {
    case 'fixed':
      return { amount: reqNum(p.amount, 'Summa', { int: true }), proportional: p.proportional !== false };
    case 'daily':
      return { rate: reqNum(p.rate, 'Kunlik stavka', { int: true }) };
    case 'per_unit':
      return {
        price: reqNum(p.price, 'Bitta tekshiruv narxi', { int: true }),
        expected: reqNum(p.expected ?? 4, 'Oylik me\'yor', { int: true, max: 1000 }),
      };
    case 'percent':
      return { percent: reqNum(p.percent, 'Foiz', { max: 100 }) };
    case 'per_sale':
      return { amount: reqNum(p.amount, 'Bitta sotuv uchun summa', { int: true }) };
    case 'tiers': {
      if (!Array.isArray(p.tiers) || p.tiers.length === 0) throw bad("Kamida bitta daraja qo'shing.");
      const tiers = p.tiers.map((t, i) => {
        const from = reqNum(t.from, `${i + 1}-daraja "dan"`, { int: true });
        const to = t.to === '' || t.to === null || t.to === undefined ? null : reqNum(t.to, `${i + 1}-daraja "gacha"`, { int: true });
        if (to !== null && to < from) throw bad(`${i + 1}-darajada "gacha" qiymati "dan" qiymatidan kichik.`);
        return { from, to, amount: reqNum(t.amount, `${i + 1}-daraja (1 talaba uchun summa)`, { int: true }) };
      }).sort((a, b) => a.from - b.from);
      for (let i = 1; i < tiers.length; i++) {
        const prev = tiers[i - 1];
        if (prev.to === null || tiers[i].from <= prev.to) {
          throw bad(`Darajalar kesishmasligi kerak: ${prev.from}–${prev.to ?? '∞'} va ${tiers[i].from}–${tiers[i].to ?? '∞'}.`);
        }
      }
      return { tiers };
    }
    default:
      throw bad("Noma'lum qoida turi.");
  }
}

function describe(rule) {
  const p = rule.params;
  switch (rule.type) {
    case 'fixed': return `${money(p.amount)} so'm${p.proportional ? ' (kunlarga mutanosib)' : ' (to\'liq)'}`;
    case 'daily': return `${money(p.rate)} so'm / kun`;
    case 'per_unit': return `${money(p.price)} so'm / tekshiruv (me'yor: ${p.expected} ta)`;
    case 'percent': return `${p.percent}%`;
    case 'per_sale': return `${money(p.amount)} so'm / sotuv`;
    case 'tiers': return p.tiers.map((t) => `${t.from}–${t.to ?? '∞'} ta: ${money(t.amount)} / talaba`).join('; ');
    default: return '';
  }
}

const snapshotOf = (row) => ({
  id: row.id, name: row.name, type: row.type,
  params: typeof row.params === 'string' ? JSON.parse(row.params) : row.params,
});

module.exports = { TYPES, BONUS_RULE_TYPE, normalizeParams, describe, snapshotOf };
