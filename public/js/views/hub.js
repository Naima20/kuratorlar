import { api } from '../api.js';
import { h, field, formModal, confirmBox, toast, empty, fmtDate } from '../ui.js';
import { state, isAdmin } from '../state.js';
import { assignmentBlock } from './assignments.js';
import { countBadges, closeButton, closedAt } from './groupinfo.js';

function flowForm(f, refresh) {
  const name = h('input', { class: 'input', value: f?.name || '', maxlength: 80, placeholder: 'Masalan: 5-potok' });
  const s = h('input', { class: 'input', type: 'date', value: f?.start_date || '' });
  const e = h('input', { class: 'input', type: 'date', value: f?.end_date || '' });
  formModal({
    title: f ? 'Potokni tahrirlash' : 'Yangi potok',
    intro: "Potokning boshlanish va tugash sanasi — ichidagi hamma guruhlar uchun umumiy. Oylik har oy potok boshlangan kunda hisoblanadi (masalan, 31-sana bo'lsa, qisqa oylarda 30 yoki 28-sana).",
    fields: [field('Potok nomi', name), h('div', { class: 'row' }, field('Boshlanish sanasi *', s), field('Tugash sanasi *', e))],
    onSubmit: async () => { await api(f ? '/flows/' + f.id : '/flows', { method: f ? 'PUT' : 'POST', body: { name: name.value, start_date: s.value, end_date: e.value } }); toast('Saqlandi ✓'); refresh(); },
  });
}

// section='flow': faqat nom (sanalar potokdan olinadi). section='rustilida': sanalar majburiy.
export function groupForm(g, { flowId, section = 'flow', refresh }) {
  const sec = g?.section || section;
  const name = h('input', { class: 'input', value: g?.name || '', maxlength: 80, placeholder: 'Masalan: A-12' });
  const s = h('input', { class: 'input', type: 'date', value: g?.start_date || '', required: true });
  const e = h('input', { class: 'input', type: 'date', value: g?.end_date || '', required: true });
  const n = h('input', { class: 'input', type: 'number', min: 0, value: g?.student_count ?? 0, inputmode: 'numeric' });
  const flow = flowId || g?.flow_id ? state.idx.flow[flowId || g.flow_id] : null;
  formModal({
    title: g ? 'Guruhni tahrirlash' : sec === 'flow' ? "Yangi guruh qo'shish" : 'Yangi Rustilida.uz guruhi',
    intro: sec === 'flow' && flow ? `Guruh "${flow.name}" potokining sanalarini oladi: ${fmtDate(flow.start_date)} – ${fmtDate(flow.end_date)}.` : "Guruh uchun boshlanish va tugash sanasi majburiy. Oylik har oy shu tugash sanasining kunida to'lanadi.",
    fields: [field('Guruh nomi', name),
      sec === 'rustilida' ? h('div', { class: 'row' }, field('Boshlanish sanasi *', s), field('Tugash sanasi *', e)) : null,
      field(sec === 'rustilida' ? "Talabalar soni (boshlang'ich)" : 'Talabalar soni (ixtiyoriy)', n, 'Keyin har oy uchun alohida yangilab borasiz.')],
    onSubmit: async () => {
      await api(g ? '/groups/' + g.id : '/groups', { method: g ? 'PUT' : 'POST', body: { section: sec, flow_id: g?.flow_id || flowId, name: name.value, start_date: s.value, end_date: e.value, student_count: n.value } });
      toast('Saqlandi ✓'); refresh();
    },
  });
}

export async function render(root, { refresh }) {
  const flows = state.data.flows;
  root.append(h('div', { class: 'pagehead' },
    h('div', null, h('h1', null, 'Potoklar va guruhlar'),
      h('p', null, "Avval potokni boshlanish va tugash sanasi bilan yarating, keyin ichiga guruhlarni qo'shing (guruhlar potok sanalarini oladi). Kurator biriktirishda ishlagan davri majburiy. Oylik har oy potok boshlangan kunda hisoblanadi; kurator davr o'rtasida almashsa, oylik kunlarga qarab bo'linadi.")),
    isAdmin() ? h('button', { class: 'btn primary', onclick: () => flowForm(null, refresh) }, '+ Yangi potok') : null));
  if (!flows.length) { root.append(h('div', { class: 'card' }, empty("Hali potok yo'q", isAdmin() ? '"+ Yangi potok" tugmasi bilan boshlang.' : 'Admin potok yaratadi.'))); return; }
  for (const f of flows) {
    const groups = state.data.groups.filter((g) => g.flow_id === f.id);
    const day = Number(f.start_date.slice(8));
    root.append(h('div', { class: 'card' },
      h('div', { class: 'cardhead' },
        h('div', null, h('h2', null, f.name, ' ', countBadges(groups), f.closed_at ? [' ', h('span', { class: 'badge warn' }, `Yopilgan ${fmtDate(f.closed_at)}`)] : null),
          h('div', { class: 'muted small' }, `Muddati: ${fmtDate(f.start_date)} – ${fmtDate(f.end_date)} · oylik davri har oyning ${day}-sanasidan${day > 28 ? " (qisqa oylarda oxirgi kundan)" : ''}`)),
        isAdmin() ? h('div', { class: 'inline' },
          h('button', { class: 'btn sm primary', onclick: () => groupForm(null, { flowId: f.id, refresh }) }, "+ Guruh qo'shish"),
          h('button', { class: 'btn sm', onclick: () => flowForm(f, refresh) }, 'Potokni tahrirlash'), closeButton('flows', f, refresh),
          h('button', { class: 'btn sm danger', onclick: async () => {
            if (!(await confirmBox({ title: "Potokni o'chirish", message: `"${f.name}" potoki o'chirilsinmi?`, okLabel: "Ha, o'chirish", danger: true }))) return;
            try { await api('/flows/' + f.id, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (e) { toast(e.message, true); }
          } }, "O'chirish")) : null),
      groups.length ? groups.map((g) => h('div', null,
        isAdmin() ? h('div', { class: 'inline', style: 'margin:0 0 6px' },
          h('button', { class: 'btn sm', onclick: () => groupForm(g, { refresh }) }, 'Guruh nomini/talaba sonini tahrirlash'), closeButton('groups', g, refresh), closedAt(g) ? h('span', { class: 'badge warn' }, `Yopilgan ${fmtDate(closedAt(g))}`) : null,
          h('button', { class: 'btn sm danger', onclick: async () => {
            if (!(await confirmBox({ title: "Guruhni o'chirish", message: `"${g.name}" guruhi o'chirilsinmi?`, okLabel: "Ha, o'chirish", danger: true }))) return;
            try { await api('/groups/' + g.id, { method: 'DELETE' }); toast("O'chirildi"); refresh(); } catch (e) { toast(e.message, true); }
          } }, "Guruhni o'chirish")) : null,
        assignmentBlock(g, { refresh, amounts: false }))) : empty("Bu potokda hali guruh yo'q", '')));
  }
}
