'use strict';
// Hisobotdan "kimga, qaysi bo'lim bo'yicha, qancha, qaysi sanada o'tkazilishi kerak" ro'yxatini yasaydi.
function buildItems(report) {
  const map = new Map();
  for (const c of report.curators) {
    for (const l of c.lines) {
      if (!l.amount) continue;
      let scope, label, section;
      if (l.section === 'flow') { scope = 'flow:' + l.flowId; label = l.flowName || 'Potok'; section = 'flow'; }
      else if (l.section === 'rustilida') { scope = 'rus:' + l.groupId; label = 'Rustilida.uz / ' + l.groupName; section = 'rustilida'; }
      else if (l.section === 'qc') { scope = 'qc'; label = 'Sifat nazorati'; section = 'qc'; }
      else { scope = 'bonus'; label = "Kuratorlar bonusi (sotuv)"; section = 'bonus'; }
      const key = scope + '|' + c.curatorId;
      let it = map.get(key);
      if (!it) {
        it = { month: report.month, scope, section, label, personId: c.curatorId, name: c.name, cardNumber: c.cardNumber, isStaff: c.isStaff, amount: 0, dueISO: l.payISO, due: l.payDate, details: [] };
        map.set(key, it);
      }
      it.amount += l.amount;
      it.details.push({ section: l.section, kind: l.kind, bonusKind: l.bonusKind || null, flowName: l.flowName || '', groupName: l.groupName || '', monthNo: l.monthNo || null, title: l.title, period: l.period || '', ruleName: l.ruleName || '', formula: l.formula || '', amount: l.amount });
      if (l.payISO < it.dueISO) { it.dueISO = l.payISO; it.due = l.payDate; }
    }
  }
  return [...map.values()].sort((a, b) => (a.dueISO + a.label + a.name).localeCompare(b.dueISO + b.label + b.name));
}
module.exports = { buildItems };
