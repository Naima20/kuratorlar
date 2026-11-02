// Faqat oflayn (bitta HTML fayl) versiyada: zaxira nusxa, tiklash, parollarni o'zgartirish.
import { h, field, formModal, confirmBox, toast } from './ui.js';

const today = () => new Date().toISOString().slice(0, 10);

export function mount(sidebar, admin) {
  const backup = () => {
    const url = URL.createObjectURL(new Blob([window.__offline.exportBytes()], { type: 'application/octet-stream' }));
    const a = h('a', { href: url, download: `kurator-zaxira-${today()}.db` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    try { localStorage.setItem('kurator_last_backup', today()); } catch { /* ignore */ }
    toast('Zaxira nusxa yuklandi ✓');
  };
  const file = h('input', { type: 'file', accept: '.db', class: 'hidden', onchange: async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!(await confirmBox({ title: 'Zaxiradan tiklash', message: "Hozirgi barcha ma'lumotlar o'chib, zaxira fayldagi ma'lumotlar o'rnatiladi. Davom etasizmi?", okLabel: 'Ha, tiklash', danger: true }))) return;
    try { await window.__offline.restore(new Uint8Array(await f.arrayBuffer())); toast('Tiklandi. Sahifa yangilanmoqda…'); setTimeout(() => location.reload(), 800); }
    catch (ex) { toast(ex.message, true); }
  } });
  const pw = () => {
    const a = h('input', { class: 'input', type: 'text', autocomplete: 'off' }), o = h('input', { class: 'input', type: 'text', autocomplete: 'off' });
    formModal({ title: "Parollarni o'zgartirish", intro: "Yangi parollar shu kompyuterdagi brauzerda saqlanadi.", fields: [field('Admin paroli (kamida 6 belgi)', a), field("Bo'lim boshlig'i paroli (kamida 6 belgi)", o)],
      onSubmit: async () => { window.__offline.setPasswords(a.value, o.value); toast("Parollar o'zgartirildi ✓"); } });
  };
  const btn = (t, fn) => h('button', { class: 'btn sm', type: 'button', style: 'width:100%;margin-top:6px;justify-content:flex-start;background:rgba(255,255,255,.12);color:inherit;border-color:transparent', onclick: fn }, t);
  const last = (() => { try { return localStorage.getItem('kurator_last_backup'); } catch { return null; } })();
  sidebar.append(h('div', { class: 'nav-group' }, "MA'LUMOTLAR XAVFSIZLIGI"),
    h('div', { style: 'padding:0 10px;font-size:.8rem;opacity:.85' }, "Ma'lumotlar faqat shu brauzerda saqlanadi. Muntazam zaxira nusxa oling!", h('div', null, last ? `Oxirgi zaxira: ${last}` : 'Zaxira hali olinmagan')),
    h('div', { style: 'padding:0 10px' }, btn('⬇ Zaxira nusxa olish', backup), btn('⬆ Zaxiradan tiklash', () => file.click()), admin ? btn('🔑 Parollarni o\'zgartirish', pw) : null, file));
}
