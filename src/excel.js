'use strict';
const ExcelJS = require('exceljs');
const { BONUS_LABEL } = require('./calc');

const SECTION = { flow: 'Potok', rustilida: 'Rustilida.uz', bonus: 'Kurator bonusi', qc: 'Sifat nazorati' };
const monthTitle = (m) => {
  const names = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
  const [y, mm] = m.split('-');
  return `${names[Number(mm) - 1]} ${y}`;
};
const cardFmt = (c) => String(c || '').replace(/(\d{4})(?=\d)/g, '$1 ');

async function buildWorkbook(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kuratorlar oyligi';
  const head = (ws) => {
    const r = ws.getRow(ws.rowCount > 1 ? 3 : 1);
    ws.getRow(3).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E5F' } };
    return r;
  };

  // 1-varaq: umumiy
  const s1 = wb.addWorksheet('Umumiy');
  s1.addRow([`Kuratorlar oyligi — ${monthTitle(report.month)}${report.closed ? ' (oy yopilgan)' : ''}`]).font = { bold: true, size: 14 };
  s1.addRow([]);
  s1.addRow(['№', 'Xodim', 'Bo\'lim', 'Karta raqami', 'Potok oyligi', 'Rustilida.uz', 'Sifat nazorati', "JAMI (so'm)"]);
  head(s1);
  report.curators.forEach((c, i) => s1.addRow([i + 1, c.name, c.isStaff ? (c.staffRole === 'head' ? 'Sifat nazorati rahbari' : 'Sifat nazoratchisi') : 'Kurator', cardFmt(c.cardNumber), c.totals.flow, c.totals.rustilida, c.totals.qc, c.total]));
  const tr = s1.addRow(['', 'JAMI', '', '', report.totals.flow, report.totals.rustilida, report.totals.qc, report.grandTotal]);
  tr.font = { bold: true };
  s1.columns = [{ width: 5 }, { width: 28 }, { width: 22 }, { width: 24 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 18 }];
  for (const col of [5, 6, 7, 8]) s1.getColumn(col).numFmt = '#,##0';

  // 2-varaq: batafsil
  const s2 = wb.addWorksheet('Batafsil hisob');
  s2.addRow([`Batafsil hisob — ${monthTitle(report.month)}`]).font = { bold: true, size: 14 };
  s2.addRow([]);
  s2.addRow(['Kurator', 'Bo\'lim', 'Guruh / Bonus', 'Davr', 'Ishlangan kun', 'Qoida', 'Qanday hisoblandi', "Summa (so'm)", "To'lov sanasi"]);
  head(s2);
  for (const c of report.curators) {
    for (const l of c.lines) {
      s2.addRow([c.name, SECTION[l.section], l.title, l.period || '', l.workedDays ?? '', l.ruleName, l.formula, l.amount, l.payDate || '']);
    }
    const r = s2.addRow([`${c.name} — jami`, '', '', '', '', '', '', c.total]);
    r.font = { bold: true };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3F4' } };
  }
  s2.columns = [{ width: 26 }, { width: 14 }, { width: 34 }, { width: 24 }, { width: 14 }, { width: 24 }, { width: 52 }, { width: 18 }, { width: 16 }];
  s2.getColumn(8).numFmt = '#,##0';

  if (report.warnings.length) {
    const s3 = wb.addWorksheet('Ogohlantirishlar');
    s3.addRow(['Diqqat: quyidagi holatlarni tekshiring']).font = { bold: true };
    report.warnings.forEach((w) => s3.addRow([w.text]));
    s3.getColumn(1).width = 120;
  }
  return wb;
}
module.exports = { buildWorkbook, BONUS_LABEL };
