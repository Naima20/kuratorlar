// Serverga so'rovlar. Token brauzer sessiyasida saqlanadi (yorliq yopilsa, chiqib ketiladi).
const KEY = 'kurator_token';
// Server manzili: bo'sh bo'lsa — shu sayt manzili. Alohida HTML fayl sifatida ochilganda, serverning to'liq manzili kiritiladi.
export const getServer = () => { try { return (localStorage.getItem('kurator_server') || '').replace(/\/+$/, ''); } catch { return ''; } };
export const setServer = (u) => { try { const v = (u || '').trim().replace(/\/+$/, ''); v ? localStorage.setItem('kurator_server', v) : localStorage.removeItem('kurator_server'); } catch { /* ignore */ } };
export const getToken = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* ignore */ } };

async function raw(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = getToken();
  if (t) headers.Authorization = 'Bearer ' + t;
  let res;
  try {
    res = await fetch(getServer() + '/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Serverga ulanib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring.");
  }
  if (res.status === 401 && !path.startsWith('/login')) window.dispatchEvent(new Event('auth-lost'));
  return res;
}

export async function api(path, opts) {
  const res = await raw(path, opts);
  let data = null;
  try { data = await res.json(); } catch { /* JSON emas */ }
  if (!res.ok) throw new Error((data && data.error) || "Xatolik yuz berdi. Qayta urinib ko'ring.");
  return data;
}

export async function download(path, filename) {
  const res = await raw(path);
  if (!res.ok) throw new Error('Faylni yuklab bo\'lmadi.');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
