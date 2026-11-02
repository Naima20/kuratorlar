'use strict';
const crypto = require('crypto');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

const MS = 86400000;
function parseDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return NaN;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return NaN;
  return t;
}
const fmtDate = (t) => new Date(t).toISOString().slice(0, 10);
const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return [Date.UTC(y, m - 1, 1), Date.UTC(y, m, 0)];
}
const overlap = (aS, aE, bS, bE) => {
  const s = Math.max(aS, bS), e = Math.min(aE, bE);
  return e >= s ? [s, e] : null;
};
const daysIn = (s, e) => Math.round((e - s) / MS) + 1;
function monthsBetween(startStr, endStr) {
  const s = parseDate(startStr), e = parseDate(endStr);
  const out = [];
  const d = new Date(s);
  let y = d.getUTCFullYear(), m = d.getUTCMonth();
  const end = new Date(e);
  const ey = end.getUTCFullYear(), em = end.getUTCMonth();
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m + 1).padStart(2, '0')}`);
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}
// Hisob davri: guruh/potok boshlangan KUN har oy takrorlanadi (31-sana bo'lsa, qisqa oylarda oyning oxirgi kuni).
// "month" — davr BOSHLANADIGAN oy. Davr: [shu oydagi boshlanish kuni, keyingi oydagi boshlanish kunidan 1 kun oldin].
function clampDay(y, m0, d) {
  const last = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  return Date.UTC(y, m0, Math.min(d, last));
}
function periodOf(startStr, endStr, month) {
  const s = parseDate(startStr), e = parseDate(endStr);
  const d = new Date(s).getUTCDate();
  const [y, m] = month.split('-').map(Number);
  const ps = clampDay(y, m - 1, d);
  if (ps < s || ps > e) return null;
  return [ps, Math.min(clampDay(y, m, d) - MS, e)];
}
// Rustilida.uz: to'lov kuni — guruh TUGAYDIGAN sananing kuni har oy takrorlanadi (oxirgi to'lov — guruh tugash sanasining o'zi).
// "month" — to'lov bo'ladigan oy. Davr: [oldingi to'lovdan keyingi kun (yoki guruh boshlanishi), shu oydagi to'lov kuni].
function periodByEndDay(startStr, endStr, month) {
  const s = parseDate(startStr), e = parseDate(endStr);
  const d = new Date(e).getUTCDate();
  const [y, m] = month.split('-').map(Number);
  const pay = clampDay(y, m - 1, d);
  if (pay <= s || pay > e) return null; // boshlanish kuni to'lov kuni emas
  const prev = clampDay(y, m - 2, d);
  return [prev > s ? prev + MS : s, pay]; // birinchi davr guruh boshlangan kundan
}
// Rustilida.uz: guruhning 1–5 oylik "davr"lari (terms) qo'lda kiritilgan bo'lsa — davr shu sanalardan olinadi (tugash sanasi oyi = to'lov oyi).
const termForMonth = (g, month) => ((g && g.terms) || []).find((t) => t.end_date && t.end_date.slice(0, 7) === month) || null;
function groupPeriod(g, month) {
  if (g.section !== 'rustilida') return periodOf(g.start_date, g.end_date, month);
  const t = termForMonth(g, month);
  if (t) return [parseDate(t.start_date), parseDate(t.end_date)];
  const p = periodByEndDay(g.start_date, g.end_date, month);
  if (p && g.terms && g.terms.length) { // oldingi qo'lda kiritilgan davr tugagandan keyin boshlanadi
    const before = g.terms.map((x) => parseDate(x.end_date)).filter((x) => x < p[1] && x >= p[0] - MS).sort((a, b) => b - a)[0];
    if (before !== undefined) p[0] = before + MS;
  }
  return p;
}
const money = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function reqStr(v, label, max = 100) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) throw bad(`"${label}" maydonini to'ldiring.`);
  if (s.length > max) throw bad(`"${label}" juda uzun (eng ko'pi ${max} belgi).`);
  return s;
}
function optStr(v, max = 500) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length > max) throw bad(`Izoh juda uzun (eng ko'pi ${max} belgi).`);
  return s;
}
function reqNum(v, label, { min = 0, max = 1e12, int = false } = {}) {
  const n = typeof v === 'string' ? Number(v.replace(/\s/g, '').replace(',', '.')) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw bad(`"${label}" — raqam kiriting.`);
  if (int && !Number.isInteger(n)) throw bad(`"${label}" — butun son bo'lishi kerak.`);
  if (n < min) throw bad(`"${label}" ${min} dan kichik bo'lmasligi kerak.`);
  if (n > max) throw bad(`"${label}" juda katta.`);
  return n;
}
function reqDate(v, label) {
  if (!Number.isFinite(parseDate(v))) throw bad(`"${label}" — to'g'ri sana kiriting.`);
  return v;
}

module.exports = {
  HttpError, bad, wrap, uid, nowIso, parseDate, fmtDate, isMonth, monthRange, overlap,
  daysIn, monthsBetween, periodOf, periodByEndDay, groupPeriod, termForMonth, money, reqStr, optStr, reqNum, reqDate, MS,
};
