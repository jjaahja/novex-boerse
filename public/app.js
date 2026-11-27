// NOVEX Börse – Browser-Einstieg: Anmeldung, Live-Verbindung, Navigation, Ereignisse
import { S, E, $, esc, toast, getJSON, post, actions, inputs, changes, setRefresh, berlinNow, act } from './ui/store.js';
import { togglePop, hidePop } from './ui/glossary.js';
import { hover } from './ui/chart.js';
import * as Home from './ui/views/home.js';
import * as Markets from './ui/views/markets.js';
import * as Detail from './ui/views/detail.js';
import * as News from './ui/views/news.js';
import * as Account from './ui/views/account.js';
import * as Progress from './ui/views/progress.js';
import * as Order from './ui/views/order.js';
const { fDate, fTime, dayStart, nextOpenFrom, MIN } = E;

S.toast = toast; S.berlin = berlinNow;
const VIEWS = { home: Home, markt: Markets, news: News, konto: Account, fortschritt: Progress };
const ICON = {
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  markt: '<path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/>',
  news: '<path d="M5 5h11v14H6a1 1 0 0 1-1-1z"/><path d="M16 9h3v9a1 1 0 0 1-1 1h-2M8 9h5M8 12h5M8 15h3"/>',
  konto: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  fortschritt: '<path d="M6 20V10M12 20V4M18 20v-7"/>'
};
const NAV = [['home', 'Übersicht'], ['markt', 'Markt'], ['news', 'News'], ['konto', 'Konto'], ['fortschritt', 'Fortschritt']];
let WS = null, wsRetry = 1000, hideTimer = null, loading = false;

/* ---------- Navigation ---------- */
const validRoute = r => !!r && (VIEWS[r] || r === 'hebel' || (r.startsWith('i-') && E.M && E.M.inst[r.slice(2)]));
export function go(route) {
  if (!validRoute(route)) route = 'home';
  if (route === 'hebel') { S.UI.mkt = 'lever'; route = 'markt'; }
  if (!route.startsWith('i-') && route !== S.UI.route) S.UI.back = route;
  if (route.startsWith('i-') && !S.UI.route.startsWith('i-')) S.UI.back = S.UI.route;
  S.UI.route = route; hover.id = null; hidePop();
  try { if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route); } catch { }
  buildView(); window.scrollTo(0, 0);
}
S.go = go;
function navHTML(bottom) {
  const r = S.UI.route, active = r.startsWith('i-') ? S.UI.back : r, badge = S.A && S.A.bonus.day !== dayStart(berlinNow());
  return NAV.map(([k, l]) => `<button data-go="${k}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${bottom ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>` : ''}${l}${k === 'fortschritt' && badge ? '<span class="badge" aria-label="Tagesbonus verfügbar"></span>' : ''}</button>`).join('');
}
function buildNav() { $('#tabs').innerHTML = navHTML(false); $('#bnav').innerHTML = navHTML(true); }
function buildView() {
  buildNav(); const r = S.UI.route, v = $('#view');
  v.innerHTML = r.startsWith('i-') ? Detail.render(r.slice(2)) : VIEWS[r].render();
  update();
}
S.rebuild = buildView;
function updateView() { const r = S.UI.route; try { if (r.startsWith('i-')) Detail.update(r.slice(2)); else VIEWS[r].update(); } catch (e) { console.error(e); } }
S.redraw = updateView;
function update() {
  if (!S.booted) return;
  updateStatus(); updateView(); Order.updateOrder();
  const badge = S.A.bonus.day !== dayStart(berlinNow()); if (badge !== !!$('#tabs .badge')) buildNav();
}
setRefresh(update);
function updateStatus() {
  const M = E.M, now = berlinNow(), open = M.isOpen;
  const st = open ? `<span><span class="dot on"></span>Börse offen</span>` : `<span><span class="dot"></span>Geschlossen · ab ${dayStart(nextOpenFrom(M.t)) === dayStart(now) ? '' : fDate(nextOpenFrom(M.t), true).slice(0, 2) + ' '}08:00</span>`;
  $('#status').innerHTML = `${st}<span class="clk">${fTime(now)}</span><span class="clk" title="Verbindung">${S.wsOk ? '' : S.paused === 'tabs' ? 'in anderem Tab aktiv' : 'offline'}</span><button class="me" data-a="logout" title="Abmelden">${esc(S.ME.name)} · Abmelden</button>`;
}

/* ---------- Daten & Live-Verbindung ---------- */
async function loadState() {
  if (loading) return; loading = true;
  try {
    const r = await getJSON('/api/state');
    if (r.status === 401) { showAuth(); return; }
    if (r.status !== 200) { toast('Server nicht erreichbar.', 'dn'); return; }
    E.setMarket(r.data.M); S.A = E.normalizeAccount(r.data.acct); S.ins = r.data.ins || { hints: [] }; S.BANK = r.data.bank; S.BOARD = r.data.board; S.ME = r.data.me; S.lastTick = Date.now();
  } finally { loading = false; }
}
function connectWS() {
  if (WS) { const o = WS; WS = null; try { o.close(1000); } catch { } }
  S.paused = '';
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/ws'); WS = ws;
  ws.onopen = () => { S.wsOk = true; wsRetry = 1000; if (S.booted) updateStatus(); };
  ws.onmessage = ev => {
    if (ev.data === 'pong') return; let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === 'tick') applyTick(m);
    else if (m.type === 'acct') { S.A = E.normalizeAccount(m.acct); if (m.ins) S.ins = m.ins; for (const n of m.notes || []) toast(n.msg, n.tone); update(); }
    else if (m.type === 'board') { S.BOARD = m.board; S.BANK = m.bank; if (S.UI.route === 'fortschritt') updateView(); }
  };
  ws.onclose = ev => {
    if (WS !== ws) return; S.wsOk = false; if (S.booted) updateStatus();
    if (ev.code === 4001) { showAuth(); return; }
    if (ev.code === 4002) { S.paused = 'tabs'; WS = null; if (S.booted) updateStatus(); return; }
    setTimeout(() => { if (WS === ws && S.ME && !S.paused) connectWS(); }, wsRetry); wsRetry = Math.min(30000, wsRetry * 2);
  };
}
function pauseWS(reason) { S.paused = reason; if (WS) { const w = WS; WS = null; try { w.close(1000, 'pausiert'); } catch { } } S.wsOk = false; if (S.booted) updateStatus(); }
async function resumeWS() { if (!S.booted || (WS && WS.readyState <= 1)) return; if (Date.now() - S.lastTick > 15000) { await loadState(); update(); } connectWS(); }
setInterval(() => { if (WS && WS.readyState === 1 && !document.hidden) WS.send('ping'); }, 50000);
async function applyTick(m) {
  const M = E.M; if (!M) return;
  if (m.resync || (M.isOpen && m.t - M.t > 3 * MIN)) { await loadState(); update(); return; }
  Object.assign(M, { t: m.t, isOpen: m.isOpen, lv: m.lv, r: m.r, slope: m.slope, U: m.U, week: m.week, lastClose: m.lastClose, eqMark: m.eqMark });
  for (const k of ['lz', 'infl', 'reg', 'rp', 'cb', 'cpi', 'events']) if (m[k] !== undefined) M[k] = m[k];
  for (const id in m.d) {
    const x = M.inst[id], o = m.d[id]; if (!x) continue;
    x.price = o.p; x.lc = o.lc; x.do = o.do; x.pc = o.pc; x.hi = o.hi; x.lo = o.lo; x.dv = o.dv; x.dt = o.dt; x.liq = o.lq; x.ts = o.ts;
    for (const k of ['f', 'tr', 'dirty', 'acc', 'mdur', 'ytm', 'tri', 'spr', 'idio', 'matured', 'ci', 'nav', 'prem', 'ff', 'why', 'eps', 'fin', 'comp']) if (k in o) x[k] = o[k];
    for (const k of o.k) { const l = x.c1[x.c1.length - 1]; if (l && l[0] === k[0]) x.c1[x.c1.length - 1] = k; else if (!l || k[0] > l[0]) { x.c1.push(k); if (x.c1.length > 900) x.c1.shift(); } }
    if (o.cd) { const l = x.cD[x.cD.length - 1]; if (!l || o.cd[0] > l[0]) x.cD.push(o.cd); else if (l[0] === o.cd[0]) x.cD[x.cD.length - 1] = o.cd; }
  }
  const have = new Set(M.news.map(n => n.n)); for (const n of m.news.slice().reverse()) if (!have.has(n.n)) M.news.unshift(n);
  M.news.sort((a, b) => b.n - a.n); if (M.news.length > 200) M.news.length = 200;
  S.BANK = m.bank; S.lastTick = Date.now();
  update();
}

/* ---------- Anmeldung ---------- */
function showAuth() {
  S.ME = null; S.booted = false; if (WS) { const w = WS; WS = null; try { w.close(); } catch { } }
  $('#tabs').hidden = true; $('#bnav').hidden = true; $('#status').innerHTML = '';
  const mode = S.UI.authMode;
  $('#view').innerHTML = `<div class="auth"><div><span class="label">Börsenspiel für Freunde</span><h1 class="h1">NOVEX</h1><p class="lead">Ein gemeinsamer Markt mit erfundenen Unternehmen, echten Wirtschaftszyklen und Quartalszahlen. Starte klein, lerne den Markt kennen und bau dein Vermögen auf.</p></div>
    <div class="seg"><button data-a="authmode" data-v="login" class="${mode === 'login' ? 'on' : ''}">Anmelden</button><button data-a="authmode" data-v="register" class="${mode === 'register' ? 'on' : ''}">Registrieren</button></div>
    <form id="authform" class="stack" novalidate>
      <label class="field"><span>Spielername</span><input class="inp" id="au-name" autocomplete="username" maxlength="20" required></label>
      <label class="field"><span>Passwort</span><input class="inp" id="au-pw" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="8" required></label>
      ${mode === 'register' ? `<label class="field"><span>Einladungscode</span><input class="inp" id="au-inv" autocomplete="off" required></label><p class="note">Den Code bekommst du von der Person, die die Börse betreibt. Name: 3–20 Zeichen (Buchstaben, Ziffern, _ und -), Passwort ab 8 Zeichen.</p>` : ''}
      <button class="btn full" type="submit">${mode === 'login' ? 'Anmelden' : 'Konto eröffnen'}</button><p class="err" id="au-msg" role="status"></p></form></div>`;
  $('#authform').addEventListener('submit', async ev => {
    ev.preventDefault(); const body = { name: $('#au-name').value.trim(), pw: $('#au-pw').value }; if (mode === 'register') body.invite = $('#au-inv').value;
    const msg = $('#au-msg'); msg.className = 'note'; msg.textContent = 'Einen Moment …';
    const r = await post(mode === 'login' ? '/api/login' : '/api/register', body);
    if (!r.data.ok) { msg.className = 'err'; msg.textContent = r.data.error || 'Fehler.'; return; }
    await start();
  });
}
actions.authmode = el => { S.UI.authMode = el.dataset.v; showAuth(); };
actions.logout = async () => { await post('/api/logout', {}); S.UI.authMode = 'login'; Order.close(); showAuth(); };

/* ---------- Ereignisse ---------- */
document.addEventListener('click', ev => {
  const term = ev.target.closest('[data-term]'); if (term) { ev.preventDefault(); togglePop(term); return; }
  if (!ev.target.closest('.pop')) hidePop();
  const t = ev.target.closest('[data-go],[data-a]'); if (!t) return;
  if (t.dataset.go) { ev.preventDefault(); if (Order.isOpenSheet()) Order.close(); go(t.dataset.go); return; }
  const fn = actions[t.dataset.a]; if (fn) { if (t.tagName === 'BUTTON' || t.tagName === 'A') ev.preventDefault(); fn(t, ev); }
});
document.addEventListener('input', ev => { const f = inputs[ev.target.id]; if (f) f(ev.target, ev); });
document.addEventListener('change', ev => { const f = changes[ev.target.id]; if (f) f(ev.target, ev); });
document.addEventListener('toggle', () => updateView(), true);
let raf = 0;
document.addEventListener('pointermove', ev => {
  const cv = ev.target;
  if (!(cv instanceof HTMLCanvasElement) || !cv.classList.contains('chart')) { if (hover.id) { hover.id = null; if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateView(); }); } return; }
  const r = cv.getBoundingClientRect(); hover.id = cv.id; hover.x = ev.clientX - r.left;
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; updateView(); });
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { hidePop(); if (Order.isOpenSheet()) Order.close(); } });
window.addEventListener('resize', () => { if (S.booted) updateView(); });
window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (S.booted && r && r !== S.UI.route && validRoute(r)) go(r); });
document.addEventListener('visibilitychange', () => { clearTimeout(hideTimer); if (document.hidden) { if (S.booted) hideTimer = setTimeout(() => pauseWS('hidden'), 120000); } else resumeWS(); });
window.addEventListener('focus', () => { if (S.paused) resumeWS(); });
setInterval(() => { if (S.booted) updateStatus(); }, 15000);

/* ---------- Start ---------- */
async function start() {
  await loadState(); if (!E.M || !S.A) return;
  S.booted = true; $('#tabs').hidden = false; $('#bnav').hidden = false;
  connectWS();
  const h = location.hash.slice(1); go(validRoute(h) ? h : 'home');
}
(async function init() {
  try { const th = localStorage.getItem('novex-theme'); if (th === 'dark' || th === 'light') document.documentElement.setAttribute('data-theme', th); } catch { }
  const r = await getJSON('/api/session');
  if (r.status !== 200) { $('#view').innerHTML = '<div class="auth"><h1 class="h1">NOVEX</h1><p class="err">Der Server ist gerade nicht erreichbar. Bitte später noch einmal versuchen.</p></div>'; return; }
  if (!r.data.user) { showAuth(); return; }
  await start();
})();
