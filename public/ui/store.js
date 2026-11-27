// Gemeinsamer Client-Zustand, Server-Aufrufe und kleine Helfer
import * as E from '../market.js';
export { E };

export const S = {
  A: null, ins: { hints: [], phase: null }, BANK: null, BOARD: [], ME: null,
  lastTick: 0, booted: false, wsOk: false, paused: '',
  UI: {
    route: 'home', back: 'home', mkt: 'stock', sort: 'cap', q: '', newsCat: 'all', newsView: 'feed', range: '1T', pRange: 'Max', cmp: false, candle: false, earn: 'eps', acct: 'cash', authMode: 'login',
    dv: { und: 'WELTIX', kind: 'ko', dir: 1, lev: 5, fac: 3, cp: 'C', exp: 1, strike: 4, cfdLev: 2, budget: '500', margin: '500' }
  }
};
// Registrierte Handler der Ansichten (Ereignis-Delegation in app.js)
export const actions = {}, inputs = {}, changes = {};
let refreshFn = () => { };
export const setRefresh = fn => { refreshFn = fn; };
export const refresh = () => refreshFn();

export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sc = n => n > 1e-9 ? 'up' : n < -1e-9 ? 'dn' : '';
export const signE = (n, d = 2) => (n > 0 ? '+' : n < 0 ? '−' : '') + E.fmt(Math.abs(n), d) + ' €';
export const pctS = (n, d = 2) => isFinite(n) ? (n > 0 ? '+' : n < 0 ? '−' : '') + E.fmt(Math.abs(n) * 100, d) + ' %' : '–';
export const initials = s => String(s).replace(/[^A-Za-zÄÖÜäöü ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·';
export function parseNum(s) {
  if (s === null || s === undefined) return NaN;
  s = String(s).trim().toLowerCase().replace(/\s|€|\$/g, ''); if (!s) return NaN;
  let mult = 1; const m = s.match(/(bio|mrd|mio|tsd|k|m)$/);
  if (m) { mult = { bio: 1e12, mrd: 1e9, mio: 1e6, m: 1e6, tsd: 1e3, k: 1e3 }[m[1]]; s = s.slice(0, -m[1].length); }
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const v = parseFloat(s); return isFinite(v) ? v * mult : NaN;
}
const BF = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
export function berlinNow() { const n = Date.now(), p = {}; for (const x of BF.formatToParts(new Date(n))) p[x.type] = x.value; return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second); }

/* ---------- Server ---------- */
export async function getJSON(path) { try { const r = await fetch(path, { credentials: 'same-origin', cache: 'no-store' }); let d = {}; try { d = await r.json(); } catch { } return { status: r.status, data: d }; } catch { return { status: 0, data: {} }; } }
export async function post(path, body) {
  try { const r = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); let d = {}; try { d = await r.json(); } catch { } return { status: r.status, data: d }; }
  catch { return { status: 0, data: { error: 'Keine Verbindung zum Server.' } }; }
}
// Aktion ausführen. quiet: Meldungen nicht als Toast zeigen (z. B. weil das Order-Sheet sie selbst anzeigt)
export async function act(body, quiet) {
  const r = await post('/api/action', body);
  if (r.status === 401) { location.reload(); return { ok: false, error: 'Bitte neu anmelden.' }; }
  const d = r.data || {};
  if (d.acct) S.A = E.normalizeAccount(d.acct);
  if (d.ins) S.ins = d.ins;
  if (d.bank) S.BANK = d.bank;
  if (!quiet) { for (const n of d.notes || []) toast(n.msg, n.tone); if (!d.ok) toast(d.error || 'Das hat nicht geklappt.', 'dn'); }
  refresh();
  return { ok: !!d.ok, error: d.error, notes: d.notes || [] };
}

/* ---------- Rückmeldungen ---------- */
export function toast(msg, tone) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast ' + (tone || '');
  el.innerHTML = `<span class="m"></span><span>${esc(msg)}</span>`; box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), tone === 'tier' || tone === 'ath' ? 7000 : 5000);
  if (tone === 'tier' || tone === 'ath') S.celebrate = { msg, tone, t: Date.now() };
}
