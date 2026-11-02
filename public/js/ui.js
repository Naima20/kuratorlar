// Kichik UI yordamchilari: element yaratish, oyna, xabar, formatlash.
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'value') value = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = true;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = (list) => list.forEach((c) => {
    if (Array.isArray(c)) add(c);
    else if (c === null || c === undefined || c === false) return;
    else el.append(c.nodeType ? c : document.createTextNode(String(c)));
  });
  add(kids);
  if (value !== undefined) el.value = value;
  return el;
}

export const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
export const monthLabel = (m) => { const [y, mm] = m.split('-'); return `${MONTHS[+mm - 1]} ${y}`; };
export const money = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const som = (n) => `${money(n)} so'm`;
export const fmtDate = (s) => (s ? s.split('-').reverse().join('.') : '');
export const fmtCard = (c) => String(c || '').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
export const monthRangeOf = (month) => {
  const [y, m] = month.split('-').map(Number);
  const pad = (n) => String(n).padStart(2, '0');
  return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`];
};
export const overlaps = (aS, aE, bS, bE) => aS <= bE && bS <= aE; // ISO sanalar matn sifatida solishtiriladi
// Hisob davri (serverdagi bilan bir xil). Potok: boshlangan kun har oy takrorlanadi (month — davr boshlanadigan oy).
// Rustilida: to'lov kuni — guruh tugash sanasining kuni (month — to'lov oyi).
const MS = 864e5;
const clampDay = (yy, m0, d) => Date.UTC(yy, m0, Math.min(d, new Date(Date.UTC(yy, m0 + 1, 0)).getUTCDate()));
const isoOf = (t) => new Date(t).toISOString().slice(0, 10);
const ts = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const termForMonth = (g, month) => (g.terms || []).find((t) => t.end_date && t.end_date.slice(0, 7) === month) || null;
export function groupPeriod(g, month) {
  const s = ts(g.start_date), e = ts(g.end_date), [y, m] = month.split('-').map(Number);
  if (g.section === 'rustilida') {
    const t = termForMonth(g, month);
    if (t) return [t.start_date, t.end_date, t.end_date];
    const d = new Date(e).getUTCDate(), pay = clampDay(y, m - 1, d);
    if (pay <= s || pay > e) return null;
    const prev = clampDay(y, m - 2, d);
    let start = prev > s ? prev + MS : s;
    const before = (g.terms || []).map((x) => ts(x.end_date)).filter((x) => x < pay && x >= start - MS).sort((a, b) => b - a)[0];
    if (before !== undefined) start = before + MS;
    return [isoOf(start), isoOf(pay), isoOf(pay)]; // [boshlanish, tugash, to'lov sanasi]
  }
  const d = new Date(s).getUTCDate(), ps = clampDay(y, m - 1, d);
  if (ps < s || ps > e) return null;
  const pe = Math.min(clampDay(y, m, d) - MS, e);
  return [isoOf(ps), isoOf(pe), isoOf(pe + MS)];
}
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const daysUntil = (iso, from = todayISO()) => Math.round((ts(iso) - ts(from)) / MS);
export const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function toast(msg, isErr = false) {
  const t = h('div', { class: 'toast' + (isErr ? ' err' : ''), role: isErr ? 'alert' : 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), isErr ? 6000 : 3000);
}

export async function copyText(text, okMsg = 'Nusxalandi ✓') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }, text);
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
  }
  toast(okMsg);
}

const copyIcon = () => {
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '18'); s.setAttribute('height', '18');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>';
  return s;
};
export function copyButton(card) {
  const digits = String(card || '').replace(/\D/g, '');
  if (!digits) return h('span', { class: 'muted' }, '—');
  const b = h('button', {
    type: 'button', class: 'btn icon-btn sm', title: 'Karta raqamini nusxalash', 'aria-label': 'Karta raqamini nusxalash',
    onclick: async () => {
      await copyText(digits, 'Karta raqami nusxalandi ✓');
      b.replaceChildren('✓'); setTimeout(() => b.replaceChildren(copyIcon()), 1200);
    },
  }, copyIcon());
  return b;
}

export function modal({ title, content, buttons = [], wide = false }) {
  const prev = document.activeElement;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const footer = buttons.length ? h('footer', null, buttons) : null;
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('header', null, h('h2', null, title), h('button', { class: 'btn ghost icon-btn', type: 'button', 'aria-label': 'Yopish', onclick: close }, '✕')),
    h('div', { class: 'body' }, content), footer);
  const overlay = h('div', { class: 'overlay' }, box);
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  const first = box.querySelector('input,select,textarea');
  (first || box.querySelector('button')).focus();
  return close;
}

// Forma oynasi: tekshiruv xatolari oyna ichida ko'rsatiladi, oyna yopilib ketmaydi
export function formModal({ title, intro, fields, submitLabel = 'Saqlash', onSubmit, wide }) {
  const err = h('div', { class: 'alert danger hidden', role: 'alert' });
  const form = h('form', { novalidate: true }, intro ? h('p', { class: 'muted' }, intro) : null, err, fields);
  const submit = h('button', { class: 'btn primary', type: 'submit' }, submitLabel);
  const cancel = h('button', { class: 'btn', type: 'button' }, 'Bekor qilish');
  const close = modal({ title, content: form, wide, buttons: [cancel, submit] });
  cancel.onclick = close;
  submit.onclick = (e) => { e.preventDefault(); form.requestSubmit(); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden'); submit.disabled = true;
    try { await onSubmit(); close(); }
    catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); err.scrollIntoView({ block: 'nearest' }); }
    finally { submit.disabled = false; }
  });
  return close;
}

export function confirmBox({ title = 'Ishonchingiz komilmi?', message, okLabel = 'Ha, tasdiqlayman', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    const ok = h('button', { class: 'btn ' + (danger ? 'danger solid' : 'primary'), type: 'button' }, okLabel);
    const no = h('button', { class: 'btn', type: 'button' }, 'Bekor qilish');
    const body = typeof message === 'string' ? h('p', null, message) : message;
    const close = modal({ title, content: body, buttons: [no, ok] });
    ok.onclick = () => { fin(true); close(); };
    no.onclick = () => { fin(false); close(); };
    new MutationObserver((_, o) => { if (!document.body.contains(ok)) { fin(false); o.disconnect(); } }).observe(document.body, { childList: true });
  });
}

// <label> ichida joylashgani uchun matn bosilganda maydon fokus oladi
export const field = (label, control, hint) => h('div', { class: 'field' }, h('label', null, h('span', { class: 'lbl' }, label), control), hint ? h('div', { class: 'hint' }, hint) : null);

export function moneyInput(value, attrs = {}) {
  const i = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', class: 'input', ...attrs });
  i.value = value !== null && value !== undefined && value !== '' ? money(value) : '';
  i.addEventListener('input', () => { const d = i.value.replace(/\D/g, ''); i.value = d ? money(+d) : ''; });
  i.num = () => (i.value ? Number(i.value.replace(/\s/g, '')) : null);
  return i;
}
export function cardInput(value) {
  const i = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', class: 'input cardno', placeholder: '8600 0000 0000 0000', maxlength: 19 });
  i.value = fmtCard(value);
  i.addEventListener('input', () => { i.value = fmtCard(i.value.slice(0, 19)); });
  return i;
}
export const select = (options, value, attrs = {}) =>
  h('select', { class: 'input', ...attrs, value }, options.map(([v, l]) => h('option', { value: v }, l)));
export const empty = (title, text) => h('div', { class: 'empty' }, h('b', null, title), text);
export const badge = (text, kind = '') => h('span', { class: 'badge ' + kind }, text);

export async function busy(btn, fn) {
  btn.disabled = true;
  try { return await fn(); } finally { btn.disabled = false; }
}
