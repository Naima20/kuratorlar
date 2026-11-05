import { api, getToken, setToken, getServer, setServer } from './api.js';
import { h, MONTHS, select, toast } from './ui.js';
import { state, setMonth, loadData, isAdmin } from './state.js';

const ROUTES = {
  '/bosh': { title: 'Bosh sahifa', n: '⌂', load: () => import('./views/dashboard.js') },
  '/kuratorlar': { title: 'Kuratorlar', n: '1', group: 'KURATORLAR', load: () => import('./views/curators.js') },
  '/boshqaruv': { title: 'Potoklar va guruhlar', n: '2', load: () => import('./views/hub.js') },
  '/potok': { title: 'Potok oyliklari', n: '3', load: () => import('./views/potok.js') },
  '/rustilida': { title: 'Rustilida.uz oyliklari', n: '4', load: () => import('./views/rustilida.js') },
  '/nazorat': { title: 'Sifat nazorati', n: '5', group: 'SIFAT NAZORATI', load: () => import('./views/nazorat.js') },
  '/tolovlar': { title: "To'lovlar (o'tkazildi / kutilmoqda)", n: '₸', group: 'NATIJA', load: () => import('./views/tolovlar.js') },
  '/qarzlar': { title: "To'lanmagan oyliklar", n: '!', load: () => import('./views/qarzlar.js') },
  '/hisobot': { title: 'Oylik hisobot', n: '7', load: () => import('./views/report.js') },
  '/qoidalar': { title: 'Oylik qoidalari', n: '⚙', admin: true, group: 'SOZLAMALAR', load: () => import('./views/rules.js') },
};
const app = document.getElementById('app');
let token = 0;

const currentPath = () => {
  const p = location.hash.replace(/^#/, '') || '/bosh';
  return ROUTES[p] && !(ROUTES[p].admin && !isAdmin()) ? p : '/bosh';
};

async function show({ reload = true } = {}) {
  const content = document.getElementById('content');
  if (!content) return;
  const path = currentPath();
  const my = ++token;
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.path === path));
  document.getElementById('sidebar').classList.remove('open');
  if (reload) content.replaceChildren(h('div', { class: 'loading' }, 'Yuklanmoqda…'));
  try {
    const [mod] = await Promise.all([ROUTES[path].load(), reload ? loadData() : null]);
    renderSectionBar(path);
    const holder = h('div');
    await mod.render(holder, { refresh: () => show({ reload: true }), go: (p) => { location.hash = p; } });
    if (my === token) {
      const y = window.scrollY;
      content.replaceChildren(holder);
      if (!reload) window.scrollTo(0, y);
      document.title = `${ROUTES[path].title} — Kuratorlar oyligi`;
    }
  } catch (e) {
    if (my === token) content.replaceChildren(h('div', { class: 'alert danger' }, e.message || 'Xatolik yuz berdi.'));
  }
}

// Hisobot sahifasida: bo'lim tanlash (potoklar, Rustilida.uz, sifat nazorati)
function renderSectionBar(path) {
  const box = document.getElementById('sectionbar');
  if (!box) return;
  if (path !== '/hisobot' || !state.data) { box.replaceChildren(); return; }
  const opts = [['all', 'Hamma bo\'limlar'], ...state.data.flows.map((f) => ['flow:' + f.id, f.name]), ['curators', 'Faqat kuratorlar'], ['rustilida', 'Rustilida.uz'], ['qc', 'Sifat nazoratchilari']];
  if (!opts.some(([v]) => v === state.reportSection)) state.reportSection = 'all';
  box.replaceChildren(select(opts, state.reportSection, { 'aria-label': "Bo'lim", style: 'width:auto;min-width:190px;font-weight:600', onchange: (e) => { state.reportSection = e.target.value; show({ reload: false }); } }));
}

function monthPicker() {
  const [y, m] = state.month.split('-').map(Number);
  const set = (yy, mm) => { setMonth(`${yy}-${String(mm).padStart(2, '0')}`); show(); renderMonthBar(); };
  const step = (d) => { const dt = new Date(y, m - 1 + d, 1); set(dt.getFullYear(), dt.getMonth() + 1); };
  const cy = new Date().getFullYear(); const years = []; for (let i = Math.min(cy - 5, y); i <= Math.max(cy + 2, y); i++) years.push([i, i]);
  const ms = select(MONTHS.map((n, i) => [i + 1, n]), m, { 'aria-label': 'Oy', onchange: (e) => set(y, +e.target.value) });
  const ys = select(years, y, { 'aria-label': 'Yil', onchange: (e) => set(+e.target.value, m) });
  return h('div', { class: 'monthpick' },
    h('button', { class: 'btn icon-btn', type: 'button', title: 'Oldingi oy', 'aria-label': 'Oldingi oy', onclick: () => step(-1) }, '‹'),
    ms, ys,
    h('button', { class: 'btn icon-btn', type: 'button', title: 'Keyingi oy', 'aria-label': 'Keyingi oy', onclick: () => step(1) }, '›'));
}
function renderMonthBar() { const box = document.getElementById('monthbar'); if (box) box.replaceChildren(monthPicker()); }

function layout() {
  let lastGroup = '';
  const links = [];
  for (const [path, r] of Object.entries(ROUTES)) {
    if (r.admin && !isAdmin()) continue;
    if (r.group && r.group !== lastGroup) { lastGroup = r.group; links.push(h('div', { class: 'nav-group' }, r.group)); }
    links.push(h('a', { href: '#' + path, 'data-path': path }, h('b', null, r.n), r.title));
  }
  const sidebar = h('aside', { class: 'sidebar', id: 'sidebar' },
    h('div', { class: 'brand' }, h('i', null, '✓'), 'Kuratorlar oyligi'),
    h('nav', { class: 'nav' }, links));
  const top = h('div', { class: 'topbar' },
    h('div', { class: 'left' },
      h('button', { class: 'btn icon-btn burger', type: 'button', 'aria-label': 'Menyu', onclick: () => sidebar.classList.toggle('open') }, '☰'),
      h('span', { id: 'sectionbar' }), h('span', { id: 'monthbar' }, monthPicker())),
    h('div', { class: 'right' },
      h('span', { class: 'badge ' + (isAdmin() ? '' : 'gray') }, isAdmin() ? 'Admin' : "Bo'lim boshlig'i"),
      h('button', { class: 'btn sm', type: 'button', onclick: logout }, 'Chiqish')));
  app.replaceChildren(h('div', { class: 'shell' }, sidebar, h('div', { class: 'main' }, top, h('main', { class: 'content', id: 'content' }))));
  if (window.__OFFLINE__) import('./offline-tools.js').then((m) => m.mount(sidebar, isAdmin()));
}

function logout() { setToken(null); state.user = null; showLogin(); }

function showLogin(message) {
  let role = 'operator';
  const pw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Parol', required: true });
  const err = h('div', { class: 'alert danger hidden', role: 'alert' });
  const roleBtn = (r, title, sub) => h('button', { type: 'button', class: 'role', 'data-r': r, onclick: () => pick(r) }, h('b', null, title), h('span', null, sub));
  const roles = h('div', { class: 'roles' },
    roleBtn('operator', "Bo'lim boshlig'i", 'Raqamlarni kiritish va hisobot'),
    roleBtn('admin', 'Admin', "To'liq sozlamalar"));
  const pick = (r) => { role = r; roles.querySelectorAll('.role').forEach((b) => b.classList.toggle('active', b.dataset.r === r)); };
  const offline = !!window.__OFFLINE__;
  const needServer = !offline && location.protocol === 'file:' || !!getServer();
  const srv = h('input', { class: 'input', type: 'url', placeholder: 'https://sizning-server.onrender.com', value: getServer(), autocomplete: 'off' });
  const srvBox = h('details', { class: 'field', open: needServer }, h('summary', { class: 'small muted' }, 'Server manzili'),
    h('div', { style: 'margin-top:8px' }, srv, h('div', { class: 'hint' }, "Bu sahifa serverning o'zidan ochilgan bo'lsa, bo'sh qoldiring. Alohida HTML fayl bo'lsa, server manzilini yozing.")));
  const btn = h('button', { class: 'btn primary', type: 'submit', style: 'width:100%' }, 'Kirish');
  const form = h('form', { class: 'card box', onsubmit: async (e) => {
    e.preventDefault(); err.classList.add('hidden'); btn.disabled = true;
    if (!offline) setServer(srv.value);
    try {
      const r = await api('/login', { method: 'POST', body: { role, password: pw.value } });
      setToken(r.token); state.user = { role: r.role };
      start(r.warnDefaults);
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); pw.select(); }
    finally { btn.disabled = false; }
  } },
    h('h1', null, 'Kuratorlar oyligi'),
    h('p', { class: 'muted' }, 'Tizimga kirish uchun rolingizni tanlang va parolni kiriting.'),
    message ? h('div', { class: 'alert warn' }, message) : null,
    roles, err,
    h('div', { class: 'field' }, h('label', null, h('span', { class: 'lbl' }, 'Parol'), pw)), offline ? null : srvBox, btn);
  app.replaceChildren(h('div', { class: 'login' }, form));
  pick('operator'); pw.focus();
}

function start(warnDefaults) {
  layout();
  if (!location.hash) location.hash = '/bosh';
  show();
  if (warnDefaults) toast("Diqqat: standart parol ishlatilmoqda. .env faylida parollarni o'zgartiring!", true);
}

window.addEventListener('hashchange', () => show());
window.addEventListener('auth-lost', () => { if (state.user) { setToken(null); state.user = null; showLogin('Sessiya tugadi. Iltimos, qaytadan kiring.'); } });

(async function init() {
  if (getToken()) {
    try { state.user = await api('/me'); start(); return; } catch { setToken(null); }
  }
  showLogin();
})();
