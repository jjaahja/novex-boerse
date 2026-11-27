// NOVEX Börse – Browser-Client. Kurse kommen live vom Server; Vorschauen rechnet die gemeinsame Engine lokal.
import * as E from './engine.js';
const { fmt, fmtE, fmtBig, pct, fDate, fTime, dig, fmtPx, fmtQty, fmtD, I, byCls, chg, bidAsk, marginal, bookP, isBook, maxQ, qAtLimit, unitVal, q2e, rateOf, members, isOpen, totals, availCash, reservedUnits, roundQty, estimateExchange, maxBuyQty, estDeriv, derivValue, derivLev, derivName, optT, strikeList, EXPIRIES, undCarry, cfdRate, LIC, LUX, LUX_BUYBACK, ACH, SECTORS, CSECT, FACTORS, FAC_PX, FAC_SPR, facRate, avgRatio, clamp, MIN, DAY } = E;

const $ = (s, r = document) => r.querySelector(s);
const sc = n => n > 1e-12 ? 'up' : n < -1e-12 ? 'dn' : '';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CLS = { stock: 'Aktie', etf: 'ETF', fund: 'Fonds', bond: 'Anleihe', fx: 'Devisen', index: 'Index', cmd: 'Rohstoff' };
const isEtc = x => x.cls === 'etf' && x.comp.every(c => E.M.inst[c.id] && E.M.inst[c.id].cls === 'cmd');
let A = null, BANK = null, BOARD = [], ME = null, WS = null, WS_OK = false, WS_PAUSED = '', lastTickAt = 0, wsRetry = 1000, booted = false, loading = false, hideTimer = null;
const UI = {
  route: 'markt', lastRoute: 'markt', tf: '1m', ctype: 'candle', hover: null,
  tk: { side: 'buy', type: 'market', val: 'day' }, fund: { side: 'buy' },
  dv: { und: 'WELTIX', kind: 'ko', dir: 1, lev: 10, fac: 3, cp: 'C', exp: 1, strike: 4, cfdLev: 5, budget: '1000', margin: '1000' }, admin: null
};
function parseNum(s) {
  if (s === null || s === undefined) return NaN;
  s = String(s).trim().toLowerCase().replace(/\s|€/g, ''); if (!s) return NaN;
  let mult = 1; const m = s.match(/(bio|mrd|mio|tsd|bn|k|m|b)$/);
  if (m) { mult = { bio: 1e12, mrd: 1e9, bn: 1e9, b: 1e9, mio: 1e6, m: 1e6, tsd: 1e3, k: 1e3 }[m[1]]; s = s.slice(0, -m[1].length); }
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const v = parseFloat(s); return isFinite(v) ? v * mult : NaN;
}

/* ---------- Server ---------- */
async function getJSON(path) { const r = await fetch(path, { credentials: 'same-origin', cache: 'no-store' }); let d = {}; try { d = await r.json(); } catch { } return { status: r.status, data: d }; }
async function post(path, body) {
  try { const r = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); let d = {}; try { d = await r.json(); } catch { } return { status: r.status, data: d }; }
  catch { return { status: 0, data: { error: 'Keine Verbindung zum Server.' } }; }
}
async function act(body, msgEl) {
  const r = await post('/api/action', body);
  if (r.status === 401) { showAuth(); return false; }
  if (r.data.acct) A = r.data.acct;
  if (r.data.bank) BANK = r.data.bank;
  for (const n of r.data.notes || []) toast(n.msg, n.tone);
  if (msgEl) { msgEl.className = r.data.ok ? 'ok' : 'err'; msgEl.textContent = r.data.ok ? 'Erledigt.' : (r.data.error || 'Fehler.'); }
  else if (!r.data.ok) toast(r.data.error || 'Fehler.', 'dn');
  update();
  return !!r.data.ok;
}
async function loadState() {
  if (loading) return; loading = true;
  try {
    const r = await getJSON('/api/state');
    if (r.status === 401) { showAuth(); return; }
    if (r.status !== 200) { toast('Server nicht erreichbar.', 'dn'); return; }
    E.setMarket(r.data.M); A = r.data.acct; BANK = r.data.bank; BOARD = r.data.board; ME = r.data.me; lastTickAt = Date.now();
  } finally { loading = false; }
}
function connectWS() {
  if (WS) { const old = WS; WS = null; try { old.close(1000); } catch { } }
  WS_PAUSED = '';
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/ws'); WS = ws;
  ws.onopen = () => { WS_OK = true; wsRetry = 1000; setConn(); };
  ws.onmessage = ev => {
    if (ev.data === 'pong') return;
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === 'tick') applyTick(m);
    else if (m.type === 'acct') { A = m.acct; for (const n of m.notes || []) toast(n.msg, n.tone); update(); }
    else if (m.type === 'board') { BOARD = m.board; BANK = m.bank; if (UI.route === 'rangliste' || UI.route === 'bank') update(); }
  };
  ws.onclose = ev => {
    if (WS !== ws) return; WS_OK = false; setConn();
    if (ev.code === 4001) { showAuth(); return; }
    if (ev.code === 4002) { WS_PAUSED = 'tabs'; WS = null; setConn(); return; } // in anderem Tab geöffnet
    setTimeout(() => { if (WS === ws && ME && !WS_PAUSED) connectWS(); }, wsRetry); wsRetry = Math.min(30000, wsRetry * 2);
  };
}
// Verbindung schonen: Hintergrund-Tabs trennen sich nach 2 Minuten und verbinden sich beim Zurückkehren neu.
function pauseWS(reason) { WS_PAUSED = reason; if (WS) { const w = WS; WS = null; try { w.close(1000, 'pausiert'); } catch { } } WS_OK = false; setConn(); }
async function resumeWS() { if (!booted || !ME || (WS && WS.readyState <= 1)) return; if (Date.now() - lastTickAt > 15000) { await loadState(); update(); } connectWS(); }
setInterval(() => { if (WS && WS.readyState === 1 && !document.hidden) WS.send('ping'); }, 50000);
function setConn() { const c = $('#conn'); if (!c) return; c.className = 'conn' + (WS_OK ? ' on' : ''); c.textContent = WS_OK ? 'live' : WS_PAUSED === 'tabs' ? 'in anderem Tab aktiv' : WS_PAUSED ? 'pausiert' : 'getrennt'; c.title = WS_PAUSED ? 'Klicken zum Verbinden' : ''; }
async function applyTick(m) {
  const M = E.M; if (!M) return;
  if (m.resync || (M.isOpen && m.t - M.t > 3 * MIN)) { await loadState(); update(); return; }
  Object.assign(M, { t: m.t, isOpen: m.isOpen, lv: m.lv, r: m.r, slope: m.slope, U: m.U, week: m.week, lastClose: m.lastClose, eqMark: m.eqMark });
  for (const id in m.d) {
    const x = M.inst[id], o = m.d[id]; if (!x) continue;
    x.price = o.p; x.lc = o.lc; x.do = o.do; x.pc = o.pc; x.hi = o.hi; x.lo = o.lo; x.dv = o.dv; x.dt = o.dt; x.liq = o.lq; x.ts = o.ts;
    for (const k of ['f', 'tr', 'dirty', 'acc', 'mdur', 'ytm', 'tri', 'spr', 'idio', 'matured', 'ci', 'nav', 'prem', 'ff']) if (k in o) x[k] = o[k];
    for (const k of o.k) { const l = x.c1[x.c1.length - 1]; if (l && l[0] === k[0]) x.c1[x.c1.length - 1] = k; else if (!l || k[0] > l[0]) { x.c1.push(k); if (x.c1.length > 900) x.c1.shift(); } }
    if (o.cd) { const l = x.cD[x.cD.length - 1]; if (!l || o.cd[0] > l[0]) x.cD.push(o.cd); else if (l[0] === o.cd[0]) x.cD[x.cD.length - 1] = o.cd; }
  }
  const have = new Set(M.news.map(n => n.n));
  for (const n of m.news.slice().reverse()) if (!have.has(n.n)) M.news.unshift(n);
  M.news.sort((a, b) => b.n - a.n); if (M.news.length > 150) M.news.length = 150;
  BANK = m.bank; lastTickAt = Date.now();
  update();
}

/* ---------- Toasts ---------- */
function toast(msg, tone) {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div'); el.className = 'toast ' + (tone || ''); el.textContent = msg; box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), 5500);
}

/* ---------- Anmeldung ---------- */
function showAuth(registration) {
  ME = null; booted = false; if (WS) { const w = WS; WS = null; try { w.close(); } catch { } }
  $('#nav').hidden = true; $('#tapebar').hidden = true; $('#acct').innerHTML = ''; $('#user').innerHTML = ''; $('#mstat').textContent = 'Abgemeldet'; $('#clk').textContent = '';
  const mode = UI.authMode || 'login';
  $('#view').innerHTML = `<div class="auth">
    <div><div class="eyebrow">Börsenspiel für Freunde</div><h1>NOVEX Börse</h1></div>
    <p>Ein gemeinsamer Markt mit 32 erfundenen Unternehmen, Anleihen, ETFs, Fonds, Devisen, Rohstoffen und Hebelprodukten. Alle handeln an denselben Kursen – und große Orders bewegen den Markt für alle.</p>
    <div class="card">
      <div class="seg"><button class="n ${mode === 'login' ? 'on' : ''}" data-auth="login">Anmelden</button><button class="n ${mode === 'register' ? 'on' : ''}" data-auth="register">Registrieren</button></div>
      <form id="authform" class="stack" novalidate>
        <label class="fld"><span>Spielername</span><input id="au-name" autocomplete="username" maxlength="20" required></label>
        <label class="fld"><span>Passwort</span><input id="au-pw" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" minlength="8" required></label>
        ${mode === 'register' ? `<label class="fld"><span>Einladungscode</span><input id="au-inv" autocomplete="off" required></label>
        <p class="note">Den Einladungscode bekommst du von der Person, die die Börse betreibt. Name: 3–20 Zeichen (Buchstaben, Ziffern, _ und -). Passwort: mindestens 8 Zeichen.</p>` : ''}
        <button class="go n" type="submit">${mode === 'login' ? 'Anmelden' : 'Konto eröffnen'}</button>
        <div class="err" id="au-msg" role="status"></div>
      </form>
    </div>
  </div>`;
  $('#authform').addEventListener('submit', async ev => {
    ev.preventDefault();
    const body = { name: $('#au-name').value.trim(), pw: $('#au-pw').value };
    if (mode === 'register') body.invite = $('#au-inv').value;
    const msg = $('#au-msg'); msg.className = 'mute'; msg.textContent = 'Einen Moment …';
    const r = await post(mode === 'login' ? '/api/login' : '/api/register', body);
    if (!r.data.ok) { msg.className = 'err'; msg.textContent = r.data.error || 'Fehler.'; return; }
    await start();
  });
}

/* ---------- Chart ---------- */
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * p; }
function aggregate(c1, mins) {
  const out = []; let cur = null;
  for (const k of c1) { const b = Math.floor(k[0] / (mins * MIN)) * mins * MIN; if (!cur || cur[0] !== b) { cur = [b, k[1], k[2], k[3], k[4], k[5]]; out.push(cur); } else { cur[2] = Math.max(cur[2], k[2]); cur[3] = Math.min(cur[3], k[3]); cur[4] = k[4]; cur[5] += k[5]; } }
  return out;
}
function barsFor(x, tf) {
  if (tf === '1d') { const b = x.cD.slice(); if (E.M.isOpen || E.M.lastClose !== E.dayStart(E.M.t)) { if (E.M.isOpen) b.push([E.dayStart(E.M.t), x.do, x.hi, x.lo, x.price, x.dv]); } return b; }
  if (tf === '5m') return aggregate(x.c1, 5); if (tf === '15m') return aggregate(x.c1, 15); return x.c1;
}
function drawChart(cv, bars, o) {
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const cs = getComputedStyle(document.documentElement), col = n => cs.getPropertyValue(n).trim();
  const C = { grid: col('--grid'), mute: col('--mute'), up: col('--up'), dn: col('--dn'), fg: col('--fg'), acc: col('--accent'), panel: col('--panel'), line: col('--line2') };
  const padR = 70, padB = 20, padT = 8, pw = W - padR, ph = H - padB - padT, volH = o.vol ? ph * 0.17 : 0, prH = ph - volH - (o.vol ? 6 : 0);
  g.font = '11px ' + col('--f-mono');
  const cap = o.all ? bars.length : Math.max(10, Math.floor(pw / (o.line ? 3 : 7))), vis = bars.slice(-cap), n = vis.length;
  if (!n) { g.fillStyle = C.mute; g.fillText('Noch keine Kursdaten', 10, 20); return; }
  const sp = o.line ? pw / Math.max(n, 2) : Math.min(14, pw / Math.max(n, 1));
  let hi = -Infinity, lo = Infinity;
  for (const b of vis) { const h = o.line ? b[4] : b[2], l = o.line ? b[4] : b[3]; if (h > hi) hi = h; if (l < lo) lo = l; }
  const lines = (o.lines || []).filter(L => L.p > 0 && isFinite(L.p) && L.p > lo - (hi - lo) * 1.5 && L.p < hi + (hi - lo) * 1.5);
  for (const L of lines) { hi = Math.max(hi, L.p); lo = Math.min(lo, L.p); }
  if (hi - lo < Math.abs(hi) * 1e-6) { hi = hi * 1.0005 + 1e-9; lo = lo * 0.9995 - 1e-9; }
  const pad = (hi - lo) * 0.07; hi += pad; lo -= pad;
  const Y = p => padT + (hi - p) / (hi - lo) * prH, X = i => i * sp + sp / 2;
  const st = niceStep((hi - lo) / 5), dd = Math.max(0, Math.min(6, -Math.floor(Math.log10(st)) + (st / Math.pow(10, Math.floor(Math.log10(st))) === 2.5 ? 1 : 0)));
  g.strokeStyle = C.grid; g.lineWidth = 1; g.fillStyle = C.mute; g.textBaseline = 'middle';
  for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.fillText(fmt(v, dd), pw + 8, y); }
  g.textBaseline = 'alphabetic'; const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 90))));
  for (let i = 0; i < n; i += every) { const t = vis[i][0], lab = o.daily ? fDate(t).slice(0, 6) + fDate(t).slice(8) : fTime(t); g.fillStyle = C.mute; g.fillText(lab, Math.min(X(i) - 14, pw - 40), H - 5); const x = Math.round(X(i)) + 0.5; g.strokeStyle = C.grid; g.beginPath(); g.moveTo(x, padT); g.lineTo(x, padT + ph); g.stroke(); }
  if (o.vol) {
    let vmax = 0; for (const b of vis) vmax = Math.max(vmax, b[5]);
    if (vmax > 0) { const base = padT + ph; g.globalAlpha = 0.35; for (let i = 0; i < n; i++) { const b = vis[i], h = b[5] / vmax * volH; g.fillStyle = b[4] >= b[1] ? C.up : C.dn; g.fillRect(X(i) - Math.max(1, sp * 0.35), base - h, Math.max(1, sp * 0.7), h); } g.globalAlpha = 1; }
  }
  if (o.line) {
    const c = vis[n - 1][4] >= vis[0][4] ? C.up : C.dn;
    g.beginPath(); for (let i = 0; i < n; i++) { const x = X(i), y = Y(vis[i][4]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokeStyle = c; g.lineWidth = 1.6; g.stroke(); g.lineTo(X(n - 1), padT + prH); g.lineTo(X(0), padT + prH); g.closePath();
    const gr = g.createLinearGradient(0, padT, 0, padT + prH); gr.addColorStop(0, c + '44'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fill();
  } else {
    const bw = Math.max(1, sp * 0.68);
    for (let i = 0; i < n; i++) {
      const b = vis[i], c = b[4] >= b[1] ? C.up : C.dn, x = X(i);
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(Math.round(x) + 0.5, Y(b[2])); g.lineTo(Math.round(x) + 0.5, Y(b[3])); g.stroke();
      const y1 = Y(Math.max(b[1], b[4])), y2 = Y(Math.min(b[1], b[4])); g.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1));
    }
  }
  g.setLineDash([4, 4]);
  for (const L of lines) { const y = Math.round(Y(L.p)) + 0.5; g.strokeStyle = L.c || C.acc; g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.fillStyle = L.c || C.acc; g.fillText(L.t, 6, y - 4); }
  g.setLineDash([]);
  const last = vis[n - 1][4], ly = Y(last);
  g.fillStyle = last >= (o.ref || vis[0][1]) ? C.up : C.dn; g.fillRect(pw + 1, ly - 9, padR - 2, 18); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(fmt(last, o.digits), pw + 6, ly);
  const hv = UI.hover;
  if (hv && hv.id === cv.id && hv.x < pw) {
    const i = clamp(Math.floor(hv.x / sp), 0, n - 1), b = vis[i];
    g.strokeStyle = C.mute; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(Math.round(X(i)) + 0.5, padT); g.lineTo(Math.round(X(i)) + 0.5, padT + ph); g.moveTo(0, hv.y + 0.5); g.lineTo(pw, hv.y + 0.5); g.stroke(); g.setLineDash([]);
    if (hv.y > padT && hv.y < padT + prH) { const pv = hi - (hv.y - padT) / prH * (hi - lo); g.fillStyle = C.line; g.fillRect(pw + 1, hv.y - 9, padR - 2, 18); g.fillStyle = C.fg; g.fillText(fmt(pv, o.digits), pw + 6, hv.y); }
    const txt = (o.daily ? fDate(b[0]) : fDate(b[0]) + ' ' + fTime(b[0])) + (o.line ? '   ' + fmt(b[4], o.digits) : `   O ${fmt(b[1], o.digits)}  H ${fmt(b[2], o.digits)}  T ${fmt(b[3], o.digits)}  S ${fmt(b[4], o.digits)}`) + (o.vol ? '  V ' + fmtBig(b[5]) : '');
    g.textBaseline = 'top'; const tw = g.measureText(txt).width + 12; g.fillStyle = C.panel; g.globalAlpha = 0.92; g.fillRect(4, 4, Math.min(tw, pw - 8), 20); g.globalAlpha = 1; g.fillStyle = C.fg; g.fillText(txt, 10, 8);
  }
}
function chartHTML(id, small) {
  const tfs = [['1m', '1 Min'], ['5m', '5 Min'], ['15m', '15 Min'], ['1d', 'Tag']];
  return `<div class="tfbar">${tfs.map(t => `<button data-tf="${t[0]}" class="${UI.tf === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}<span class="sp"></span><button data-ct="candle" class="${UI.ctype === 'candle' ? 'on' : ''}">Kerzen</button><button data-ct="line" class="${UI.ctype === 'line' ? 'on' : ''}">Linie</button></div><canvas id="${id}" class="chart${small ? ' sm' : ''}"></canvas>`;
}
function renderChartFor(x, id) {
  const lines = [], dn = getComputedStyle(document.documentElement).getPropertyValue('--dn').trim();
  if (A.pos[x.id] && A.pos[x.id].qty > 0 && x.cls !== 'bond') lines.push({ p: A.pos[x.id].cost / A.pos[x.id].qty, t: 'Einstand' });
  for (const o of A.orders) if (o.iid === x.id && isOpen(o)) { if (o.limit) lines.push({ p: o.limit, t: (o.side === 'buy' ? 'Kauf' : 'Verkauf') + '-Limit' }); if (o.stop && (o.type === 'stop' || o.type === 'stoplimit')) lines.push({ p: o.stop, t: 'Stopp' }); }
  for (const p of A.derivs) if (p.und === x.id) { if (p.kind === 'ko') lines.push({ p: p.K, t: 'KO-Schwelle', c: dn }); if (p.kind === 'cfd') lines.push({ p: p.entry, t: 'CFD-Einstieg' }); }
  drawChart($('#' + id), barsFor(x, UI.tf), { vol: x.cls !== 'index' && x.cls !== 'fund', line: UI.ctype === 'line', digits: dig(x), daily: UI.tf === '1d', lines, ref: UI.tf === '1d' ? undefined : x.pc });
}
function drawEq() {
  const pts = A.eq.concat([[E.M.t, totals(A).total]]), stp = Math.max(1, Math.ceil(pts.length / 600));
  const s = pts.filter((e, i) => i % stp === 0 || i === pts.length - 1);
  drawChart($('#eqchart'), s.map(e => [e[0], e[1], e[1], e[1], e[1], 0]), { line: true, all: true, digits: 2, ref: A.start });
}

/* ---------- Navigation ---------- */
const TABS = [['markt', 'Markt'], ['aktien', 'Aktien'], ['etfs', 'ETFs'], ['fonds', 'Fonds'], ['anleihen', 'Anleihen'], ['devisen', 'Devisen'], ['rohstoffe', 'Rohstoffe'], ['derivate', 'Derivate'], ['depot', 'Depot'], ['orders', 'Orders'], ['bank', 'Bank & Prämien'], ['rangliste', 'Rangliste'], ['news', 'Nachrichten']];
const TAB_OF = { stock: 'aktien', etf: 'etfs', fund: 'fonds', bond: 'anleihen', fx: 'devisen', index: 'markt', cmd: 'rohstoffe' };
function validRoute(r) { if (!r) return false; if (r.startsWith('i-')) return !!(E.M && E.M.inst[r.slice(2)]); return TABS.some(t => t[0] === r); }
function go(route) {
  if (!validRoute(route)) route = 'markt';
  if (!route.startsWith('i-')) UI.lastRoute = route;
  UI.route = route; UI.hover = null;
  try { if (location.hash.slice(1) !== route) history.replaceState(null, '', '#' + route); } catch { }
  buildView(); window.scrollTo(0, 0);
}
function buildNav() {
  const active = UI.route.startsWith('i-') ? TAB_OF[I(UI.route.slice(2)).cls] : UI.route;
  $('#nav').innerHTML = TABS.map(t => `<button data-go="${t[0]}" class="${active === t[0] ? 'on' : ''}">${t[1]}${t[0] === 'bank' && canClaim() ? ' <span class="badge">Bonus</span>' : ''}</button>`).join('');
}
const canClaim = () => A && E.M && A.bonus.day !== E.dayStart(berlinNow());
function buildView() {
  buildNav();
  const r = UI.route, v = $('#view');
  const views = { markt: viewMarket, aktien: () => viewList('stock'), etfs: () => viewList('etf'), fonds: () => viewList('fund'), anleihen: () => viewList('bond'), devisen: () => viewList('fx'), rohstoffe: () => viewList('cmd'), derivate: viewDerivs, depot: viewDepot, orders: viewOrders, bank: viewBank, rangliste: viewBoard, news: () => `<div class="card"><h2>Nachrichten</h2><div id="newsall"></div></div>` };
  if (r.startsWith('i-')) { v.innerHTML = viewDetail(I(r.slice(2))); prefillTicket(I(r.slice(2))); } else v.innerHTML = views[r]();
  update();
}

/* ---------- Ansichten ---------- */
function viewMarket() {
  const ix = I('WELTIX');
  return `<section class="grid-mkt">
    <div class="card"><div class="idx-head"><div><div class="eyebrow">Leitindex · ${ix.comp.length} Werte</div><h1>${ix.name}</h1></div><div><span class="bigpx" id="ix-px"></span><span class="bigch" id="ix-ch"></span></div></div>${chartHTML('chart')}</div>
    <div class="card"><h2>Top-Bewegungen heute</h2><div class="movers" id="movers"></div></div>
    <div class="card span2"><h2>Heatmap · Fläche nach Marktkapitalisierung</h2><div class="heat" id="heat"></div></div>
    <div class="card"><h2>Zinsen, Devisen &amp; Fonds</h2><div class="tbl-wrap"><table><tbody id="macro"></tbody></table></div></div>
    <div class="card"><h2>Letzte Nachrichten</h2><div id="newsmini"></div></div>
  </section>`;
}
const INTRO = {
  stock: ['Aktien', '32 fiktive Unternehmen, davon 24 im Leitindex WELTIX. Jede Order läuft durch das Orderbuch: große Aufträge verschieben den Kurs für alle Spieler nach dem Square-Root-Gesetz.'],
  etf: ['ETFs & ETCs', 'Börsengehandelte Index- und Rohstofffonds. Käufe und Verkäufe lösen Creation/Redemption aus: Market Maker handeln dafür die enthaltenen Aktien, Anleihen oder Rohstoffe.'],
  fund: ['Investmentfonds', 'Aktiv gemanagte Fonds. Abrechnung zum NAV um 17:30 Uhr mit Ausgabeaufschlag und Swing Pricing bei großen Zu- und Abflüssen.'],
  bond: ['Anleihen', 'Kurse in % vom Nennwert (clean), zzgl. Stückzinsen. Kupons werden ausgezahlt, Fälligkeiten getilgt.'],
  fx: ['Devisen', 'Margin-Handel mit Hebel (je nach Lizenz bis 1:200). Overnight-Finanzierung nach Zinsdifferenz.'],
  cmd: ['Rohstoffe', 'Edelmetalle, Energie, Industriemetalle und Agrar, notiert in US-Dollar. Handelbar über ETCs oder Hebelprodukte (Turbo, Faktor, Optionsschein, CFD).']
};
function viewList(cls) {
  const [t, d] = INTRO[cls];
  const heads = { stock: ['Aktie', 'Kurs', 'Veränd.', 'Intraday', 'Geld', 'Brief', 'Umsatz', 'Marktkap.'], etf: ['ETF', 'Kurs', 'Veränd.', 'Intraday', 'NAV', 'Prämie', 'TER', 'Umsatz'], fund: ['Fonds', 'NAV', 'Veränd.', 'Intraday', 'Typ', 'Ausgabeaufschl.', 'TER', 'Im Depot'], bond: ['Anleihe', 'Kurs', 'Veränd.', 'Rendite', 'Kupon', 'Fälligkeit', 'Rating', 'Mod. Duration'], fx: ['Paar', 'Geld', 'Brief', 'Veränd.', 'Intraday', 'Spread', 'Zinsdiff.', 'Tagesvola'], cmd: ['Rohstoff', 'Kurs ($)', 'Veränd.', 'Intraday', 'Kurs (€)', 'Einheit', 'Tagesvola', 'Gruppe'] }[cls];
  return `<div class="list-head"><div><h1>${t}</h1><p>${d}</p></div></div><div class="card"><div class="tbl-wrap"><table><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody id="tbody"></tbody></table></div></div>`;
}
function spark(x) {
  const a = x.c1.slice(-90).map(k => k[4]); if (a.length < 2) return '';
  const lo = Math.min(...a), hi = Math.max(...a), w = 90, h = 24, r = hi - lo || 1;
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="var(--${chg(x) >= 0 ? 'up' : 'dn'})" stroke-width="1.4" points="${a.map((v, i) => (i / (a.length - 1) * w).toFixed(1) + ',' + (h - 2 - (v - lo) / r * (h - 4)).toFixed(1)).join(' ')}"/></svg>`;
}
function rowsFor(cls) {
  return byCls(cls).map(x => {
    const c = chg(x), [b, a] = bidAsk(x), nm = `<td class="nm"><b>${x.name}</b><small>${x.id}${x.cls === 'stock' ? ' · ' + SECTORS[x.sector] + (x.core ? '' : ' · nicht im WELTIX') : isEtc(x) ? ' · ETC' : ''}</small></td>`, ch = `<td><span class="chg ${sc(c)}">${pct(c)}</span></td>`, go = `class="click" data-go="i-${x.id}"`;
    if (cls === 'stock') return `<tr ${go}>${nm}<td>${fmtPx(x, x.price)}</td>${ch}<td>${spark(x)}</td><td>${fmt(b, dig(x))}</td><td>${fmt(a, dig(x))}</td><td>${fmtBig(x.dt)} €</td><td>${fmtBig(x.shares * x.price)} €</td></tr>`;
    if (cls === 'cmd') return `<tr ${go}>${nm}<td>${fmt(x.price, dig(x))}</td>${ch}<td>${spark(x)}</td><td>${fmt(x.price * q2e(x), dig(x))}</td><td>${x.unit}</td><td>${fmt(x.vol * 100 / Math.sqrt(252), 2)} %</td><td><span class="tag">${CSECT[x.sector]}</span></td></tr>`;
    if (cls === 'etf') return `<tr ${go}>${nm}<td>${fmtPx(x, x.price)}</td>${ch}<td>${spark(x)}</td><td>${fmt(x.nav, 2)}</td><td class="${sc(x.prem)}">${pct(x.prem, 2)}</td><td>${fmt(x.ter * 100, 2)} %</td><td>${fmtBig(x.dt)} €</td></tr>`;
    if (cls === 'fund') return `<tr ${go}>${nm}<td>${fmtPx(x, x.price)}</td>${ch}<td>${spark(x)}</td><td><span class="tag">${x.type}</span></td><td>${fmt(x.aa * 100, 2)} %</td><td>${fmt(x.ter * 100, 2)} %</td><td>${A.pos[x.id] ? fmt(A.pos[x.id].qty, 3) : '–'}</td></tr>`;
    if (cls === 'bond') return `<tr ${go}>${nm}<td>${x.matured ? 'getilgt' : fmt(x.price, 3)}</td>${ch}<td>${x.matured ? '–' : fmt(x.ytm * 100, 3) + ' %'}</td><td>${fmt(x.cpn, 3)} %</td><td>${fDate(x.mat)}</td><td><span class="tag">${x.rating}</span></td><td>${fmt(x.mdur, 2)}</td></tr>`;
    return `<tr ${go}>${nm}<td>${fmt(b, x.dec)}</td><td>${fmt(a, x.dec)}</td>${ch}<td>${spark(x)}</td><td>${fmt((a - b) / x.pip, 1)} Pips</td><td>${pct(rateOf(x.base) - rateOf(x.quote), 2)}</td><td>${fmt(x.volA * 100 / Math.sqrt(252), 2)} %</td></tr>`;
  }).join('');
}
function viewDetail(x) {
  const ticket = E.isTradable(x) ? ticketHTML(x) : x.cls === 'bond' ? `<h2>Handeln</h2><p class="note">Diese Anleihe ist getilgt.</p>` : x.cls === 'fund' ? fundTicketHTML(x) : x.cls === 'fx' ? `<h2>Devisen handeln</h2>${derivFormHTML(x.id)}` : x.cls === 'cmd' ? `<h2>${x.name} handeln</h2>${etcLink(x)}${derivFormHTML(x.id)}` : `<h2>Handeln</h2><p class="note">Ein Index ist nicht direkt handelbar. Nutze den ETF oder Hebelprodukte.</p><button class="go n" data-go="i-WLTX">ETF auf ${x.name} handeln</button><button class="go b" data-deriv="${x.id}">Hebelprodukte auf ${x.name}</button>`;
  const book = E.isTradable(x) || x.cls === 'fx' || x.cls === 'cmd';
  const comp = x.comp ? `<div class="card"><h2>Zusammensetzung</h2><div class="tbl-wrap"><table><thead><tr><th>Bestandteil</th><th>Gewicht</th><th>Kurs</th><th>Veränd.</th></tr></thead><tbody id="d-comp"></tbody></table></div></div>` : '';
  const derivBtn = (x.cls === 'stock' || x.cls === 'index') ? `<div style="margin-top:10px"><button class="btn-ghost" data-deriv="${x.id}">Hebelprodukte auf ${x.name} →</button></div>` : '';
  return `<div class="dhead"><button class="back" data-go="${UI.lastRoute}" aria-label="Zurück">←</button>
    <div class="ttl"><div class="eyebrow">${CLS[x.cls]} · ${x.id} · ISIN ${x.isin}</div><h1>${x.name}</h1></div>
    <div class="dpx"><span class="bigpx" id="d-px"></span><span class="bigch" id="d-ch"></span><div class="ba" id="d-ba"></div></div></div>
  <div class="detail">
    <div class="stack"><div class="card">${chartHTML('chart')}</div><div class="card"><h2>Kennzahlen</h2><div class="stats" id="d-stats"></div>${x.desc ? `<p class="desc">${x.desc}</p>` : ''}${derivBtn}</div>${comp}</div>
    <div class="stack"><div class="card ticket" id="ticket">${ticket}</div>${book ? `<div class="card"><h2>Orderbuch · Markttiefe</h2><div class="book" id="d-book"></div></div><div class="card"><h2>Time &amp; Sales</h2><div class="ts" id="d-ts"></div></div>` : ''}</div>
  </div>`;
}
function etcLink(x) { const etc = byCls('etf').find(e => e.comp.length === 1 && e.comp[0].id === x.id); return `<p class="note">${x.name} selbst ist nicht direkt handelbar. Ohne Hebel geht es über ${etc ? `den <a href="#i-${etc.id}" data-go="i-${etc.id}" style="color:inherit">${etc.name}</a> oder den Rohstoff-ETF` : 'den Rohstoff-ETF'}, mit Hebel direkt hier:</p>`; }
function ticketHTML(x) {
  const t = UI.tk, chips = [['1000', '1.000'], ['10k', '10 Tsd.'], ['100k', '100 Tsd.'], ['1m', '1 Mio.'], ['max', 'Max']];
  return `<h2>Order aufgeben</h2>
  <div class="seg" id="tk-side"><button data-side="buy" class="b ${t.side === 'buy' ? 'on' : ''}">Kaufen</button><button data-side="sell" class="s ${t.side === 'sell' ? 'on' : ''}">Verkaufen</button></div>
  <label class="fld"><span>Ordertyp</span><select id="tk-type">${[['market', 'Market (bestens / billigst)'], ['limit', 'Limit'], ['stop', 'Stop (Stop-Market)'], ['stoplimit', 'Stop-Limit']].map(o => `<option value="${o[0]}" ${t.type === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>
  <div class="row2"><label class="fld"><span>${x.cls === 'bond' ? 'Nominal (€)' : 'Stückzahl'}</span><input id="tk-qty" inputmode="decimal" autocomplete="off" placeholder="0"></label>
  <label class="fld"><span>oder Betrag (€)</span><input id="tk-amt" inputmode="decimal" autocomplete="off" placeholder="z. B. 5000"></label></div>
  <div class="chips">${chips.map(c => `<button data-amt="${c[0]}">${c[1]}</button>`).join('')}</div>
  <div class="row2"><label class="fld" id="lb-stop"><span>Stoppkurs</span><input id="tk-stop" inputmode="decimal" autocomplete="off"></label><label class="fld" id="lb-lim"><span>Limit</span><input id="tk-lim" inputmode="decimal" autocomplete="off"></label></div>
  <label class="fld" id="lb-val"><span>Gültigkeit</span><select id="tk-val"><option value="day" ${t.val === 'day' ? 'selected' : ''}>Bis Handelsschluss</option><option value="gtc" ${t.val === 'gtc' ? 'selected' : ''}>Bis auf Widerruf</option></select></label>
  <div class="est" id="tk-est"></div>
  <button class="go ${t.side === 'buy' ? 'b' : 's'}" id="tk-go">${t.side === 'buy' ? 'Kaufen' : 'Verkaufen'}</button>
  <div class="err" id="tk-msg" role="status"></div>`;
}
function fundTicketHTML(x) {
  const s = UI.fund.side;
  return `<h2>Fondsanteile ordern</h2>
  <div class="seg"><button data-fside="buy" class="b ${s === 'buy' ? 'on' : ''}">Kaufen</button><button data-fside="sell" class="s ${s === 'sell' ? 'on' : ''}">Verkaufen</button></div>
  <label class="fld"><span>${s === 'buy' ? 'Anlagebetrag (€)' : 'Anteile'}</span><input id="fd-val" inputmode="decimal" autocomplete="off" placeholder="${s === 'buy' ? 'z. B. 2000' : '0'}"></label>
  ${s === 'sell' ? `<div class="chips"><button data-fmax="1">Alle Anteile</button></div>` : ''}
  <div class="est" id="fd-est"></div>
  <p class="note">Abrechnung zum NAV um 17:30 Uhr an Börsentagen. Der Fonds handelt dann seine Bestandteile; große Aufträge tragen ihre Handelskosten selbst (Swing Pricing). Fondsorders gehen auch außerhalb der Handelszeit.</p>
  <button class="go ${s === 'buy' ? 'b' : 's'}" id="fd-go">${s === 'buy' ? 'Kauforder aufgeben' : 'Verkaufsorder aufgeben'}</button>
  <div class="err" id="fd-msg" role="status"></div>`;
}
function derivFormHTML(fixedUnd) {
  const d = UI.dv; if (fixedUnd) d.und = fixedUnd;
  const u = I(d.und), L = LIC[A.lic || 0];
  const sel = fixedUnd ? '' : `<label class="fld"><span>Basiswert</span><select id="dv-und">
    <optgroup label="Index"><option value="WELTIX" ${d.und === 'WELTIX' ? 'selected' : ''}>WELTIX 24</option></optgroup>
    <optgroup label="Aktien">${byCls('stock').map(s => `<option value="${s.id}" ${d.und === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</optgroup>
    <optgroup label="Devisen">${byCls('fx').map(s => `<option value="${s.id}" ${d.und === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</optgroup>
    <optgroup label="Rohstoffe">${byCls('cmd').map(s => `<option value="${s.id}" ${d.und === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</optgroup></select></label>
    <div class="est"><div><span>Kurs Basiswert</span><b id="dv-upx"></b></div></div>`;
  const levs = [2, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 300, 500], clev = [1, 2, 5, 10, 20, 30, 50, 75, 100, 150, 200];
  if (d.lev > L.ko) d.lev = Math.max(...levs.filter(l => l <= L.ko));
  if (d.cfdLev > L.cfd) d.cfdLev = Math.max(...clev.filter(l => l <= L.cfd));
  if (d.fac > (L.fac || 3)) d.fac = Math.max(...FACTORS.filter(f => f <= (L.fac || 3)));
  if (d.kind === 'opt' && !L.opt) d.kind = 'ko';
  const strikes = strikeList(u); if (d.strike >= strikes.length) d.strike = Math.floor(strikes.length / 2); UI.dvStrikes = strikes;
  const lockNote = `<p class="lock">Deine Lizenz: ${L.name}. Höhere Hebel und Optionsscheine schaltest du unter <a href="#bank" data-go="bank" style="color:inherit">Bank &amp; Prämien</a> frei.</p>`;
  let body = '';
  if (d.kind === 'ko') body = `<div class="seg"><button data-dir="1" class="b ${d.dir > 0 ? 'on' : ''}">Long</button><button data-dir="-1" class="s ${d.dir < 0 ? 'on' : ''}">Short</button></div>
    <div class="row2"><label class="fld"><span>Hebel</span><select id="dv-lev">${levs.map(l => `<option value="${l}" ${d.lev === l ? 'selected' : ''} ${l > L.ko ? 'disabled' : ''}>${l}×${l > L.ko ? ' (Lizenz)' : ''}</option>`).join('')}</select></label>
    <label class="fld"><span>Anlagebetrag (€)</span><input id="dv-budget" inputmode="decimal" autocomplete="off" value="${esc(d.budget)}"></label></div>`;
  else if (d.kind === 'fac') body = `<div class="seg"><button data-dir="1" class="b ${d.dir > 0 ? 'on' : ''}">Long</button><button data-dir="-1" class="s ${d.dir < 0 ? 'on' : ''}">Short</button></div>
    <div class="row2"><label class="fld"><span>Faktor</span><select id="dv-fac">${FACTORS.map(f => `<option value="${f}" ${d.fac === f ? 'selected' : ''} ${f > (L.fac || 3) ? 'disabled' : ''}>${f}×${f > (L.fac || 3) ? ' (Lizenz)' : ''}</option>`).join('')}</select></label>
    <label class="fld"><span>Anlagebetrag (€)</span><input id="dv-budget" inputmode="decimal" autocomplete="off" value="${esc(d.budget)}"></label></div>`;
  else if (d.kind === 'opt') body = `<div class="seg"><button data-cp="C" class="b ${d.cp === 'C' ? 'on' : ''}">Call</button><button data-cp="P" class="s ${d.cp === 'P' ? 'on' : ''}">Put</button></div>
    <div class="row2"><label class="fld"><span>Laufzeit</span><select id="dv-exp">${EXPIRIES.map((e, i) => `<option value="${i}" ${d.exp === i ? 'selected' : ''}>${e.l}</option>`).join('')}</select></label>
    <label class="fld"><span>Basispreis</span><select id="dv-strike">${strikes.map((k, i) => `<option value="${i}" ${d.strike === i ? 'selected' : ''}>${fmt(k, dig(u))}</option>`).join('')}</select></label></div>
    <label class="fld"><span>Anlagebetrag (€)</span><input id="dv-budget" inputmode="decimal" autocomplete="off" value="${esc(d.budget)}"></label>`;
  else body = `<div class="seg"><button data-dir="1" class="b ${d.dir > 0 ? 'on' : ''}">Long</button><button data-dir="-1" class="s ${d.dir < 0 ? 'on' : ''}">Short</button></div>
    <div class="row2"><label class="fld"><span>Hebel</span><select id="dv-clev">${clev.map(l => `<option value="${l}" ${d.cfdLev === l ? 'selected' : ''} ${l > L.cfd ? 'disabled' : ''}>1:${l}${l > L.cfd ? ' (Lizenz)' : ''}</option>`).join('')}</select></label>
    <label class="fld"><span>Margin (€)</span><input id="dv-margin" inputmode="decimal" autocomplete="off" value="${esc(d.margin)}"></label></div>
    <div class="row2"><label class="fld"><span>Stop-Loss (optional)</span><input id="dv-sl" inputmode="decimal" autocomplete="off"></label><label class="fld"><span>Take-Profit (optional)</span><input id="dv-tp" inputmode="decimal" autocomplete="off"></label></div>`;
  const chips = [['100', '100'], ['1000', '1.000'], ['10k', '10 Tsd.'], ['max', 'Max']];
  return `${sel}<div class="seg">${[['ko', 'Turbo'], ['fac', 'Faktor'], ['opt', 'Option'], ['cfd', 'CFD']].map(k => `<button data-kind="${k[0]}" class="n ${d.kind === k[0] ? 'on' : ''}" ${k[0] === 'opt' && !L.opt ? 'title="Braucht die Derivate-Lizenz"' : ''}>${k[1]}</button>`).join('')}</div>
    ${body}<div class="chips">${chips.map(c => `<button data-dvamt="${c[0]}">${c[1]}</button>`).join('')}</div>
    <div class="est" id="dv-est"></div>
    <button class="go ${d.kind === 'opt' ? (d.cp === 'C' ? 'b' : 's') : (d.dir > 0 ? 'b' : 's')}" id="dv-go">${d.kind === 'cfd' ? (d.dir > 0 ? 'Long eröffnen' : 'Short eröffnen') : 'Kaufen'}</button>
    <div class="err" id="dv-msg" role="status"></div>${A.lic < 2 ? lockNote : ''}`;
}
function readDv() {
  const d = UI.dv, b = $('#dv-budget'), m = $('#dv-margin'); if (b) d.budget = b.value; if (m) d.margin = m.value;
  const s = { kind: d.kind, und: d.und, dir: d.dir, lev: d.lev, fac: d.fac, cp: d.cp, exp: d.exp, K: (UI.dvStrikes || [])[d.strike], cfdLev: d.cfdLev, budget: parseNum(d.budget), margin: parseNum(d.margin) };
  if (d.kind === 'cfd') { s.sl = parseNum(($('#dv-sl') || {}).value) || 0; s.tp = parseNum(($('#dv-tp') || {}).value) || 0; }
  return s;
}
function updateDvEst() {
  const box = $('#dv-est'); if (!box) return;
  const s = readDv(), u = I(s.und), dg = dig(u), row = (a, b, c) => `<div class="${c || ''}"><span>${a}</span><b>${b}</b></div>`;
  const upx = $('#dv-upx'); if (upx) upx.innerHTML = `${fmtPx(u, u.price)} <span class="${sc(chg(u))}">${pct(chg(u))}</span>`;
  const closed = E.M.isOpen ? '' : `<div class="warn">Börse geschlossen – Hebelprodukte erst wieder ab ${nextOpenText()}.</div>`;
  if (!((s.kind === 'cfd' ? s.margin : s.budget) > 0)) { box.innerHTML = row('Vorschau', 'Betrag eingeben') + closed; return; }
  try {
    const e = estDeriv(s);
    if (s.kind === 'ko') box.innerHTML = row('KO-Schwelle = Basispreis', fmtPx(u, e.p.K)) + row('Abstand zum Kurs', pct((e.p.K - u.price) / u.price, 2)) + row('Bezugsverhältnis', fmt(e.p.r, e.p.r < 1 ? 4 : 0)) + row('Hebel', fmt(e.lev, 1) + '×') + row('Briefkurs je Zertifikat', fmtD(e.px)) + row('Stückzahl', fmt(e.n, 0)) + row('Basiswert-Exposure', fmtBig(e.exposure) + ' €') + row('Absicherung des Emittenten bewegt Kurs um', pct(e.move, 3)) + row('Kosten', fmtE(e.cost), 'tot') + `<div class="note">Finanzierung: KO-Schwelle wandert täglich um ca. ${fmt((s.dir > 0 ? undCarry(u) + 0.03 : undCarry(u) - 0.03) * 100, 2)} % p. a.</div>`;
    else if (s.kind === 'fac') box.innerHTML = row('Hebel (täglich angepasst)', s.fac + '×') + row('Ausgabepreis je Stück', fmtD(e.px)) + row('Stückzahl', fmt(e.n, 0)) + row('Basiswert-Exposure', fmtBig(e.exposure) + ' €') + row('Referenzkurs (inkl. Marktwirkung)', fmt(e.Se, dg)) + row('Absicherung bewegt Kurs um', pct(e.move, 3)) + row(e.rate >= 0 ? 'Laufende Kosten' : 'Zinsertrag', fmt(Math.abs(e.rate) * 100, 2) + ' % p. a.') + row('Kosten', fmtE(e.cost), 'tot') + (e.capped ? `<div class="warn">Begrenzt durch die Markttiefe des Basiswerts.</div>` : '') +
      `<div class="note">Kein Knock-out: Der Hebel wird laufend auf ${s.fac}× zurückgesetzt. Steigt der Basiswert um 1 %, gewinnt das Zertifikat ${s.fac} %. Pendelt der Kurs seitwärts, verliert es trotzdem an Wert (Volatilitätsverlust). Bewegt sich der Basiswert um mehr als ${fmt(100 / s.fac, 1)} % gegen dich, droht Totalverlust.</div>`;
    else if (s.kind === 'opt') box.innerHTML = row('Basispreis', fmtPx(u, e.p.K)) + row('Fälligkeit', fDate(e.p.exp, true) + ' 17:30') + row('Bezugsverhältnis', fmt(e.p.r, e.p.r < 1 ? 4 : 0)) + row('Impl. Volatilität', fmt(e.iv * 100, 1) + ' %') + row('Delta', fmt(e.delta, 3)) + row('Omega (eff. Hebel)', fmt(e.omega, 1) + '×') + row('Briefkurs', fmtD(e.px)) + row('Stückzahl', fmt(e.n, 0)) + row('Break-even', fmt(e.be, dg)) + row('Delta-Hedge bewegt Kurs um', pct(e.move, 3)) + row('Kosten', fmtE(e.cost), 'tot');
    else box.innerHTML = row('Positionsgröße', fmtBig(e.Q) + ' €') + row('Einheiten Basiswert', fmtBig(e.units)) + row('Erw. Einstieg (inkl. Marktwirkung)', fmt(e.Se, dg)) + row('Zwangsschließung bei ca.', fmt(e.liq, dg)) + row('Kurs bewegt sich um', pct(e.move, 3)) + row('Overnight-Finanzierung', pct(cfdRate(u, s.dir), 2) + ' p. a.') + row('Margin', fmtE(s.margin), 'tot') + (e.tooBig ? `<div class="warn">Übersteigt die Markttiefe – nicht ausführbar.</div>` : '') + `<div class="note">Zwangsschließung, wenn das Kapital auf 50 % der Margin fällt. Kein Nachschuss.</div>`;
    box.innerHTML += closed;
  } catch { box.innerHTML = row('Vorschau', 'nicht verfügbar'); }
}
function viewDerivs() {
  return `<div class="list-head"><div><h1>Derivate</h1><p>Turbos, Optionsscheine und CFDs auf den WELTIX, alle Aktien und Devisen. Der Emittent sichert jede Position am Basiswert ab – große Hebelpositionen bewegen den Kurs für alle.</p></div></div>
  <div class="dv-grid"><div class="card ticket" id="dv-form">${derivFormHTML()}</div>
  <div class="stack"><div class="card"><div class="eyebrow" id="dv-uname"></div>${chartHTML('chart', true)}</div><div class="card"><h2>Offene Hebelpositionen</h2><div class="tbl-wrap" id="dv-pos"></div></div></div></div>`;
}
function derivTable() {
  if (!A.derivs.length) return `<div class="empty">Keine offenen Hebelpositionen.</div>`;
  return `<table><thead><tr><th>Produkt</th><th>Menge</th><th>Basiswert</th><th>Einsatz</th><th>Wert</th><th>G/V</th><th>Hebel</th><th></th></tr></thead><tbody>${A.derivs.map(p => {
    const u = I(p.und), v = derivValue(p), pnl = v - p.cost, lev = derivLev(p);
    const extra = p.kind === 'ko' ? `Abstand KO ${pct((p.K - u.price) / u.price, 2)}` : p.kind === 'fac' ? `Wert je Stück ${fmtD(E.facMark(p, u.price))} · ${facRate(u, p.dir, p.F) >= 0 ? 'Kosten' : 'Zinsertrag'} ${fmt(Math.abs(facRate(u, p.dir, p.F)) * 100, 2)} % p. a.` : p.kind === 'opt' ? `Restlaufzeit ${fmt(optT(p) * 365, 0)} Tage` : `Einstieg ${fmt(p.entry, dig(u))} · Finanzierung ${fmtE(-p.fin)}`;
    return `<tr><td class="nm"><b>${derivName(p)}</b><small>${extra}</small></td><td>${p.kind === 'cfd' ? fmtBig(p.units) : fmt(p.n, 0)}</td><td>${fmt(u.price, dig(u))}</td><td>${fmtE(p.cost)}</td><td>${fmtE(v)}</td><td class="${sc(pnl)}">${fmtE(pnl)}<br><small>${pct(p.cost ? pnl / p.cost : 0)}</small></td><td>${isFinite(lev) ? fmt(lev, 1) + '×' : '–'}</td><td><button class="act" data-close="${p.pid}" data-frac="0.5">½</button> <button class="act x" data-close="${p.pid}" data-frac="1">Schließen</button></td></tr>`;
  }).join('')}</tbody></table>`;
}
function viewDepot() {
  return `<div class="list-head"><div><h1>Depot</h1><p>Bewertung zur Mitte des Orderbuchs. Luxusgüter zählen mit ihrem Rückkaufwert (80 %).</p></div></div>
  <div class="tiles" id="dp-tiles"></div>
  <div class="stack"><div class="card"><h2>Vermögensentwicklung</h2><canvas id="eqchart" class="chart sm"></canvas></div>
  <div class="card"><h2>Wertpapiere</h2><div class="tbl-wrap" id="dp-sec"></div></div>
  <div class="card"><h2>Hebelprodukte &amp; CFDs</h2><div class="tbl-wrap" id="dp-der"></div></div>
  <div class="card"><h2>Kontoumsätze</h2><div class="tbl-wrap" id="dp-hist"></div></div></div>`;
}
function viewOrders() {
  return `<div class="list-head"><div><h1>Orders</h1><p>Limit- und Stop-Orders kannst du auch bei geschlossener Börse aufgeben; sie werden ab der Eröffnung geprüft. Teilausführungen sind möglich.</p></div></div>
  <div class="stack"><div class="card"><h2>Offene Orders</h2><div class="tbl-wrap" id="or-open"></div></div><div class="card"><h2>Orderhistorie</h2><div class="tbl-wrap" id="or-done"></div></div></div>`;
}
const TYPE_L = { market: 'Market', limit: 'Limit', stop: 'Stop', stoplimit: 'Stop-Limit', fund: 'Fonds (NAV)' };
function orderRows(list, open) {
  if (!list.length) return `<div class="empty">${open ? 'Keine offenen Orders.' : 'Noch keine Orders.'}</div>`;
  return `<table><thead><tr><th>Zeit</th><th>Wertpapier</th><th>Art</th><th>Typ</th><th>Menge</th><th>Ausgeführt</th><th>Limit/Stopp</th><th>Ø Kurs</th><th>Status</th>${open ? '<th></th>' : ''}</tr></thead><tbody>${list.map(o => {
    const x = I(o.iid), qty = o.type === 'fund' && o.side === 'buy' && o.status !== 'ausgeführt' ? fmtE(o.amount) : fmtQty(x, o.qty);
    const ls = [o.stop ? 'S ' + fmt(o.stop, dig(x)) : '', o.limit ? 'L ' + fmt(o.limit, dig(x)) : ''].filter(Boolean).join(' / ') || '–';
    return `<tr><td>${fDate(o.t).slice(0, 6)} ${fTime(o.t)}</td><td class="nm"><b>${x.name}</b><small>${esc(o.note || '')}</small></td><td class="${o.side === 'buy' ? 'up' : 'dn'}">${o.side === 'buy' ? 'Kauf' : 'Verkauf'}</td><td>${TYPE_L[o.otype] || o.otype}${o.val === 'gtc' ? ' · GTC' : ''}</td><td>${qty}</td><td>${o.type === 'fund' ? (o.filled ? fmt(o.filled, 3) : '–') : fmt(o.filled, 0)}</td><td>${ls}</td><td>${o.avg ? fmt(o.avg, dig(x)) : '–'}</td><td>${o.status}</td>${open ? `<td><button class="act x" data-cancel="${o.id}">Löschen</button></td>` : ''}</tr>`;
  }).join('')}</tbody></table>`;
}
function viewBank() {
  return `<div class="list-head"><div><h1>Bank &amp; Prämien</h1><p>Spielgeld gibt die Zentralbank nur aus einer festen Reserve aus. Je leerer die Reserve, desto kleiner die Prämien. Gebühren, Lizenzen und Luxuskäufe fließen in die Reserve zurück.</p></div></div>
  <div class="bank-grid" id="bank"></div>`;
}
function viewBoard() {
  return `<div class="list-head"><div><h1>Rangliste</h1><p>Gesamtvermögen inklusive Depot, Hebelprodukten und Luxusgütern zum Rückkaufwert. Die Wochenliga wertet die Rendite seit Montag ohne Boni und Prämien.</p></div></div>
  <div class="stack"><div class="card"><h2>Alle Spieler</h2><div class="tbl-wrap" id="bd"></div></div><div class="card"><h2>Letzte Wochenligen</h2><div class="tbl-wrap" id="bd-hist"></div></div></div>`;
}

/* ---------- Aktualisierung ---------- */
const BERLIN_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function berlinNow() { const n = Date.now(), p = {}; for (const x of BERLIN_FMT.formatToParts(new Date(n))) p[x.type] = x.value; return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second); }
function nextOpenText() { const t = E.nextOpenFrom(E.M.t); return (E.dayStart(t) === E.dayStart(E.M.t) ? 'heute' : fDate(t, true).slice(0, 9)) + ' ' + fTime(t); }
function updateHeader() {
  const M = E.M, open = M.isOpen, now = berlinNow();
  $('#clk').textContent = fDate(now, true) + ' · ' + fTime(now);
  const st = $('#mstat'); st.textContent = open ? 'Handel offen bis 22:00' : 'Geschlossen · öffnet ' + nextOpenText(); st.className = 'pill ' + (open ? 'open' : 'closed');
  const T = totals(A), pnl = T.total - A.start;
  $('#acct').innerHTML = `<div><span>Gesamtvermögen</span><b>${fmtE(T.total)}</b></div><div><span>Verfügbar</span><b>${fmtE(availCash(A))}</b></div><div><span>G/V seit Start</span><b class="${sc(pnl)}">${fmtE(pnl)}</b></div>`;
  if (!$('#user').dataset.built) { $('#user').innerHTML = `<b>${esc(ME.name)}</b><button class="btn-ghost" id="btnRules">Regeln</button><button class="btn-ghost" id="btnLogout">Abmelden</button>`; $('#user').dataset.built = '1'; }
  const tp = $('#tape');
  if (!tp.dataset.built) { const items = [I('WELTIX'), ...byCls('stock'), ...byCls('cmd').slice(0, 3), ...byCls('fx').slice(0, 3)], one = items.map(x => `<span data-tp="${x.id}"></span>`).join(''); tp.innerHTML = one + one; tp.dataset.built = '1'; }
  for (const el of tp.children) { const x = I(el.dataset.tp); if (!x) continue; const c = chg(x); el.innerHTML = `<b>${x.id}</b>${fmt(x.price, dig(x))} <span class="${sc(c)}">${pct(c)}</span>`; }
}
function update() {
  if (!E.M || !A || !ME || !booted) return;
  updateHeader();
  const r = UI.route;
  if (r === 'markt') {
    const ix = I('WELTIX'), c = chg(ix);
    $('#ix-px').textContent = fmt(ix.price, 2); const ch = $('#ix-ch'); ch.textContent = `${c >= 0 ? '+' : ''}${fmt(ix.price - ix.pc, 2)} (${pct(c)})`; ch.className = 'bigch ' + sc(c);
    renderChartFor(ix, 'chart');
    const st = byCls('stock').slice().sort((a, b) => chg(b) - chg(a));
    const mv = (list, t) => `<div><div class="eyebrow">${t}</div>${list.map(x => `<div class="mv-row" data-go="i-${x.id}"><b>${x.name}</b><span class="mono">${fmt(x.price, dig(x))} <span class="${sc(chg(x))}">${pct(chg(x))}</span></span></div>`).join('')}</div>`;
    const act = byCls('stock').slice().sort((a, b) => b.dt - a.dt).slice(0, 3);
    $('#movers').innerHTML = mv(st.slice(0, 3), 'Gewinner') + mv(st.slice(-3).reverse(), 'Verlierer') + `<div><div class="eyebrow">Höchster Umsatz</div>${act.map(x => `<div class="mv-row" data-go="i-${x.id}"><b>${x.name}</b><span class="mono">${fmtBig(x.dt)} €</span></div>`).join('')}</div>`;
    const tot = byCls('stock').reduce((s, x) => s + Math.sqrt(x.shares * x.price), 0);
    $('#heat').innerHTML = byCls('stock').slice().sort((a, b) => b.shares * b.price - a.shares * a.price).map(x => { const c = chg(x), a = clamp(Math.abs(c) / 0.03, 0.15, 1), base = c >= 0 ? '37,160,115' : '214,64,78'; return `<div data-go="i-${x.id}" style="flex-grow:${(Math.sqrt(x.shares * x.price) / tot * 100).toFixed(2)};background:rgba(${base},${(0.35 + a * 0.6).toFixed(2)})"><b>${x.id}</b><span>${pct(c)}</span></div>`; }).join('');
    const mrow = (n, v, c, go) => `<tr ${go ? `class="click" data-go="i-${go}"` : ''}><td class="nm">${n}</td><td>${v}</td><td class="${c === null ? '' : sc(c)}">${c === null ? '' : pct(c)}</td></tr>`;
    $('#macro').innerHTML = mrow('Leitzins Eurozone', fmt(E.M.r * 100, 2) + ' %', null) + ['TEUT29', 'TEUT34', 'TEUT54'].map(id => mrow(I(id).name + ' · Rendite', I(id).matured ? 'getilgt' : fmt(I(id).ytm * 100, 3) + ' %', null, id)).join('') + byCls('fx').slice(0, 3).map(f => mrow(f.name, fmt(f.price, f.dec), chg(f), f.id)).join('') + ['GOLD', 'BRNT'].filter(id => E.M.inst[id]).map(id => mrow(I(id).name + ' ($)', fmt(I(id).price, dig(I(id))), chg(I(id)), id)).join('') + byCls('etf').slice(0, 2).map(f => mrow(f.name, fmt(f.price, 2), chg(f), f.id)).join('') + mrow(I('UNIG').name + ' (NAV)', fmt(I('UNIG').price, 2), chg(I('UNIG')), 'UNIG');
    $('#newsmini').innerHTML = newsHTML(8);
  } else if (['aktien', 'etfs', 'fonds', 'anleihen', 'devisen', 'rohstoffe'].includes(r)) $('#tbody').innerHTML = rowsFor({ aktien: 'stock', etfs: 'etf', fonds: 'fund', anleihen: 'bond', devisen: 'fx', rohstoffe: 'cmd' }[r]);
  else if (r === 'news') $('#newsall').innerHTML = newsHTML(150);
  else if (r === 'derivate') { const u = I(UI.dv.und); $('#dv-uname').textContent = `Basiswert: ${u.name} · ${CLS[u.cls]}`; renderChartFor(u, 'chart'); updateDvEst(); $('#dv-pos').innerHTML = derivTable(); }
  else if (r === 'depot') updateDepot();
  else if (r === 'orders') { $('#or-open').innerHTML = orderRows(A.orders.filter(isOpen), true); $('#or-done').innerHTML = orderRows(A.orders.filter(o => !isOpen(o)).slice(0, 100), false); }
  else if (r === 'bank') updateBank();
  else if (r === 'rangliste') updateBoard();
  else if (r.startsWith('i-')) updateDetail(I(r.slice(2)));
  const nb = $('#nav [data-go="bank"]'); if (nb) { const want = canClaim(); if (want !== nb.innerHTML.includes('badge')) buildNav(); }
}
function newsHTML(n) {
  if (!E.M.news.length) return `<div class="empty">Noch keine Meldungen.</div>`;
  return E.M.news.slice(0, n).map(a => `<div class="news-item ${a.tone > 0 ? 'pos' : a.tone < 0 ? 'neg' : ''}"><time>${fTime(a.t)}<br><small>${fDate(a.t).slice(0, 6)}</small></time><p>${a.id && E.M.inst[a.id] ? `<a href="#i-${a.id}" data-go="i-${a.id}" style="color:inherit">${esc(a.txt)}</a>` : esc(a.txt)}</p></div>`).join('');
}
function statRows(x) {
  const r = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`, cd = x.cD.slice(-252);
  const hi52 = Math.max(x.hi, ...cd.map(k => k[2])), lo52 = Math.min(x.lo, ...cd.map(k => k[3]));
  const rets = [], c30 = x.cD.slice(-31); for (let i = 1; i < c30.length; i++) rets.push(Math.log(c30[i][4] / c30[i - 1][4]));
  const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1), hv = Math.sqrt(rets.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, rets.length - 1) * 252);
  const common = r('Eröffnung', fmt(x.do, dig(x))) + r('Vortag', fmt(x.pc, dig(x))) + r('Tageshoch', fmt(x.hi, dig(x))) + r('Tagestief', fmt(x.lo, dig(x))) + r('52W-Hoch', fmt(hi52, dig(x))) + r('52W-Tief', fmt(lo52, dig(x))) + r('Vola 30 T.', fmt(hv * 100, 1) + ' %');
  if (x.cls === 'stock') return common + r('Marktkap.', fmtBig(x.shares * x.price) + ' €') + r('Aktien', fmtBig(x.shares)) + r('Umsatz heute', fmtBig(x.dt) + ' €') + r('Ø Tagesumsatz', fmtBig(x.advPct * x.shares * x.price) + ' €') + r('KGV', x.eps > 0 ? fmt(x.price / x.eps, 1) : 'neg.') + r('Div.-Rendite', fmt(x.dy * 100, 2) + ' %') + r('Beta', fmt(x.beta, 2)) + r('Spread', fmt(bookP(x).s * 2e4, 1) + ' Bp') + r('Liquidität', fmt(x.liq * 100, 0) + ' %') + r('Sektor', SECTORS[x.sector]);
  if (x.cls === 'etf') return common + r('NAV', fmt(x.nav, 2)) + r('Prämie/Abschlag', pct(x.prem, 3)) + r('TER', fmt(x.ter * 100, 2) + ' % p. a.') + r('Umsatz heute', fmtBig(x.dt) + ' €') + r('Replikation', 'physisch') + r('Ertragsverwendung', 'thesaurierend');
  if (x.cls === 'fund') return common + r('NAV', fmt(x.nav, 2)) + r('Ausgabepreis', fmt(x.nav * (1 + x.aa), 2)) + r('Ausgabeaufschlag', fmt(x.aa * 100, 2) + ' %') + r('TER', fmt(x.ter * 100, 2) + ' % p. a.') + r('Fondstyp', x.type) + r('Abrechnung', 'NAV 17:30');
  if (x.cls === 'bond') return r('Kurs (clean)', fmt(x.price, 3) + ' %') + r('Stückzinsen', fmt(x.acc, 4) + ' %') + r('Kurs (dirty)', fmt(x.dirty, 3) + ' %') + r('Rendite', x.matured ? '–' : fmt(x.ytm * 100, 3) + ' %') + r('Kupon', fmt(x.cpn, 3) + ' % p. a.') + r('Nächster Kupon', x.matured || !(x.cpn > 0) ? '–' : fDate(x.cds[x.ci])) + r('Fälligkeit', fDate(x.mat)) + r('Mod. Duration', fmt(x.mdur, 2)) + r('Spread zu Teutonien', fmt(x.spr * 1e4, 0) + ' Bp') + r('Rating', x.rating) + r('Emittent', x.issuer) + r('Stückelung', '1.000 €') + r('Umsatz heute', fmtBig(x.dt) + ' €') + r('Vortag', fmt(x.pc, 3));
  if (x.cls === 'cmd') return r('Kurs in Euro', fmt(x.price * q2e(x), dig(x)) + ' €') + r('Einheit', x.unit) + r('Notierung', 'US-Dollar') + common + r('Gruppe', CSECT[x.sector]) + r('Beta zum Aktienmarkt', fmt(x.beta, 2)) + r('Umsatz heute', fmtBig(x.dt) + ' €') + r('Ø Tagesumsatz', fmtBig(x.adv) + ' €') + r('Spread', fmt(bookP(x).s * 2e4, 1) + ' Bp') + r('Liquidität', fmt(x.liq * 100, 0) + ' %');
  if (x.cls === 'fx') { const [b, a] = bidAsk(x); return r('Geld', fmt(b, x.dec)) + r('Brief', fmt(a, x.dec)) + r('Spread', fmt((a - b) / x.pip, 1) + ' Pips') + common + r('Zins ' + x.base, fmt(rateOf(x.base) * 100, 2) + ' %') + r('Zins ' + x.quote, fmt(rateOf(x.quote) * 100, 2) + ' %') + r('Umsatz heute', fmtBig(x.dt) + ' €') + r('Ø Tagesumsatz', fmtBig(x.adv) + ' €'); }
  return common + r('Bestandteile', x.comp.length) + r('Gewichtung', 'Marktkap.') + r('Punkte Vortag', fmt(x.pc, 2));
}
function updateDetail(x) {
  const c = chg(x);
  $('#d-px').textContent = fmtPx(x, x.price);
  const ch = $('#d-ch'); ch.textContent = pct(c); ch.className = 'bigch ' + sc(c);
  if (x.cls === 'fund') $('#d-ba').textContent = `Ausgabepreis ${fmt(x.nav * (1 + x.aa), 2)} · Rücknahme ${fmt(x.nav, 2)}`;
  else if (x.cls !== 'index') { const [b, a] = bidAsk(x); $('#d-ba').textContent = `Geld ${fmt(b, dig(x))} · Brief ${fmt(a, dig(x))}`; }
  renderChartFor(x, 'chart');
  $('#d-stats').innerHTML = statRows(x);
  const cp = $('#d-comp'); if (cp) cp.innerHTML = members(x).sort((a, b) => b.w - a.w).map(({ m, w }) => `<tr class="click" data-go="i-${m.id}"><td class="nm"><b>${m.name}</b><small>${m.id}</small></td><td>${fmt(w * 100, 2)} %</td><td>${fmt(m.price, dig(m))}</td><td class="${sc(chg(m))}">${pct(chg(m))}</td></tr>`).join('');
  if ($('#d-book')) { $('#d-book').innerHTML = bookHTML(x); $('#d-ts').innerHTML = tsHTML(x); }
  if ($('#tk-est')) updateTicket(x);
  if ($('#fd-est')) updateFundEst(x);
  if ($('#dv-est')) updateDvEst();
}
function bookHTML(x) {
  if (x.matured) return '<div class="empty">Anleihe getilgt – kein Handel.</div>';
  const mid = x.price, uv = unitVal(x), d = dig(x), L = 8, tick = x.cls === 'fx' ? x.pip / 10 : x.cls === 'bond' ? 0.001 : x.cls === 'cmd' && mid < 10 ? 0.001 : mid < 2 ? 0.0001 : 0.01;
  const ask0 = mid * marginal(x, 1, 0), bid0 = mid * marginal(x, -1, 0), qref = Math.min(maxQ(x), (isBook(x) ? bookP(x).D : x.adv) * 0.004);
  let stp = Math.max(tick, (mid * marginal(x, 1, qref) - ask0) / L); stp = Math.ceil(stp / tick) * tick;
  const asks = [], bids = []; let pa = 0, pb = 0; const a0 = Math.ceil(ask0 / tick - 1e-9) * tick, b0 = Math.floor(bid0 / tick + 1e-9) * tick;
  for (let i = 0; i < L; i++) { const pA = a0 + i * stp, pB = b0 - i * stp, qa = qAtLimit(x, 1, pA), qb = pB > 0 ? qAtLimit(x, -1, pB) : pb; asks.push([pA, Math.max(0, qa - pa) / uv]); bids.push([pB, Math.max(0, qb - pb) / uv]); pa = qa; pb = qb; }
  const mx = Math.max(...asks.map(a => a[1]), ...bids.map(a => a[1]), 1e-9);
  const row = (cls, p, q) => `<div class="r ${cls}"><i style="width:${(q / mx * 100).toFixed(1)}%"></i><span>${fmt(p, d)}</span><span>${fmtBig(x.cls === 'fx' || x.cls === 'cmd' ? q : Math.round(q))}</span><span>${fmtBig(q * p * (x.cls === 'bond' ? 0.01 : 1) * (x.cls === 'fx' || x.cls === 'cmd' ? q2e(x) : 1))} €</span></div>`;
  return `<div class="r hd"><span>Kurs</span><span>${x.cls === 'bond' ? 'Nominal' : x.cls === 'fx' ? 'Einheiten' : x.cls === 'cmd' ? x.unit : 'Stück'}</span><span>Volumen</span></div>` + asks.slice().reverse().map(a => row('ask', a[0], a[1])).join('') + `<div class="mid">Spread ${fmt((ask0 - bid0) / mid * 1e4, 1)} Bp · Mitte ${fmt(mid, d)}</div>` + bids.map(b => row('bid', b[0], b[1])).join('');
}
function tsHTML(x) { if (!x.ts.length) return '<div class="empty">Noch keine Umsätze.</div>'; return x.ts.slice(0, 8).map(t => `<div class="r ${t[4] ? 'me' : ''}"><span class="mute">${fTime(t[0])}</span><span class="${t[3] > 0 ? 'up' : 'dn'}">${fmt(t[1], dig(x))}</span><span>${fmtBig(t[2])}${t[4] ? ' · Spieler' : ''}</span></div>`).join(''); }
function prefillTicket(x) {
  const lim = $('#tk-lim'), stp = $('#tk-stop'); if (!lim || !stp) return;
  const ty = UI.tk.type;
  if ((ty === 'limit' || ty === 'stoplimit') && !lim.value) lim.value = fmt(x.price, dig(x)).replace(/\./g, '');
  if ((ty === 'stop' || ty === 'stoplimit') && !stp.value) stp.value = fmt(x.price * (UI.tk.side === 'buy' ? 1.02 : 0.98), dig(x)).replace(/\./g, '');
}
function readTicket(x) { const t = UI.tk; return { side: t.side, type: t.type, val: t.val, qty: parseNum($('#tk-qty').value), limit: parseNum($('#tk-lim').value), stop: parseNum($('#tk-stop').value), iid: x.id }; }
function updateTicket(x) {
  const s = readTicket(x), box = $('#tk-est'), row = (a, b, c) => `<div class="${c || ''}"><span>${a}</span><b>${b}</b></div>`;
  $('#lb-lim').hidden = !(s.type === 'limit' || s.type === 'stoplimit'); $('#lb-stop').hidden = !(s.type === 'stop' || s.type === 'stoplimit'); $('#lb-val').hidden = s.type === 'market';
  const p = A.pos[x.id], head = row('Verfügbar', fmtE(availCash(A))) + (p ? row('Im Depot', fmtQty(x, p.qty)) : '');
  const closed = !E.M.isOpen ? `<div class="warn">Börse geschlossen – Market-Orders ab ${nextOpenText()}. Limit- und Stop-Orders gehen jetzt schon.</div>` : '';
  if (!(s.qty > 0)) { box.innerHTML = head + row('Vorschau', 'Menge oder Betrag eingeben') + closed; return; }
  const e = estimateExchange(x, s.side, s.qty, s.type === 'limit' && s.limit > 0 ? s.limit : 0);
  if (s.type === 'stop' || s.type === 'stoplimit') { box.innerHTML = head + row('Auslösung bei', fmt(s.stop, dig(x))) + row('Schätzung zum aktuellen Kurs', e.q ? fmt(e.px, dig(x)) : '–') + `<div class="note">Bei Auslösung wird die Order als ${s.type === 'stop' ? 'Market' : 'Limit'}-Order ins Buch gestellt.</div>` + closed; return; }
  if (!e.q) { box.innerHTML = head + row('Sofort ausführbar', s.type === 'limit' ? 'nichts – Order wartet im Buch' : '0') + closed; return; }
  box.innerHTML = head + row(s.type === 'limit' ? 'Sofort ausführbar' : 'Menge', fmtQty(x, e.q)) + row('Ø Ausführungskurs', fmt(e.px, dig(x))) + row('Marktwirkung (Slippage)', pct(e.impact, 3)) + row('Schlechtester Kurs im Buch', fmt(e.worst, dig(x))) + row('Kurs nach der Order', fmt(e.after, dig(x)) + ` (${pct(e.after / x.price - 1, 2)})`) + (x.cls === 'bond' ? row('Stückzinsen', fmtE(e.q * x.acc / 100)) : '') + row('Kurswert', fmtE(e.amount)) + row('Gebühr', fmtE(e.fee)) + row(s.side === 'buy' ? 'Gesamtkosten' : 'Erlös', fmtE(e.total), 'tot') +
    (e.capped ? `<div class="warn">Orderbuch reicht nicht für die volle Menge – Rest wird gestrichen.</div>` : '') + (e.limited && s.type === 'limit' ? `<div class="warn">Rest bleibt als Limit-Order im Buch.</div>` : '') + (s.side === 'buy' && e.total > availCash(A) ? `<div class="warn">Übersteigt dein verfügbares Guthaben.</div>` : '') + closed;
}
function updateFundEst(x) {
  const v = parseNum($('#fd-val').value), box = $('#fd-est'), s = UI.fund.side, row = (a, b, c) => `<div class="${c || ''}"><span>${a}</span><b>${b}</b></div>`, p = A.pos[x.id];
  const h = row('Verfügbar', fmtE(availCash(A))) + (p ? row('Im Depot', fmt(p.qty, 3) + ' Anteile') : '');
  if (!(v > 0)) { box.innerHTML = h + row('Ausgabepreis', fmt(x.nav * (1 + x.aa), 2)); return; }
  if (s === 'buy') { const net = v / (1 + x.aa), r = avgRatio(x, 1, net); box.innerHTML = h + row('Ausgabeaufschlag', fmtE(v - net)) + row('Swing Pricing (geschätzt)', pct(r - 1, 3)) + row('Anteile ca.', fmt(net / (x.nav * r), 3)) + row('Betrag', fmtE(v), 'tot'); }
  else { const g = v * x.nav, r = avgRatio(x, -1, g); box.innerHTML = h + row('Rücknahmepreis (aktuell)', fmt(x.nav, 2)) + row('Swing Pricing (geschätzt)', pct(r - 1, 3)) + row('Erlös ca.', fmtE(g * r), 'tot'); }
}
function updateDepot() {
  const T = totals(A), pnl = T.total - A.start;
  let unreal = 0; for (const id in A.pos) unreal += E.posValue(id, A.pos[id]) - A.pos[id].cost; for (const p of A.derivs) unreal += derivValue(p) - p.cost;
  const tile = (a, b, c) => `<div class="tile"><span>${a}</span><b class="${c || ''}">${b}</b></div>`;
  $('#dp-tiles').innerHTML = tile('Gesamtvermögen', fmtE(T.total)) + tile('Cash', fmtE(A.cash)) + tile('Wertpapiere', fmtE(T.sec)) + tile('Hebelprodukte', fmtE(T.der)) + tile('Luxusgüter', fmtE(T.lux)) + tile('Unrealisierte G/V', fmtE(unreal), sc(unreal)) + tile('Realisierte G/V', fmtE(A.realized), sc(A.realized));
  drawEq();
  const ids = Object.keys(A.pos);
  $('#dp-sec').innerHTML = ids.length ? `<table><thead><tr><th>Wertpapier</th><th>Bestand</th><th>Einstand Ø</th><th>Kurs</th><th>Wert</th><th>G/V</th><th>Heute</th><th></th></tr></thead><tbody>${ids.map(id => {
    const x = I(id), p = A.pos[id], v = E.posValue(id, p), g = v - p.cost, avg = x.cls === 'bond' ? p.cost / p.qty * 100 : p.cost / p.qty;
    return `<tr><td class="nm"><b>${x.name}</b><small>${CLS[x.cls]} · ${x.id}</small></td><td>${fmtQty(x, p.qty)}</td><td>${fmt(avg, dig(x))}</td><td>${fmt(x.price, dig(x))}</td><td>${fmtE(v)}</td><td class="${sc(g)}">${fmtE(g)}<br><small>${pct(p.cost ? g / p.cost : 0)}</small></td><td class="${sc(chg(x))}">${pct(chg(x))}</td><td><button class="act" data-go="i-${x.id}" data-sell="1">Handeln</button></td></tr>`;
  }).join('')}</tbody></table>` : `<div class="empty">Noch keine Wertpapiere. Starte unter Aktien, ETFs, Fonds oder Anleihen.</div>`;
  $('#dp-der').innerHTML = derivTable();
  $('#dp-hist').innerHTML = A.hist.length ? `<table><thead><tr><th>Zeit</th><th>Vorgang</th><th>Art</th><th>Menge</th><th>Kurs</th><th>Betrag</th><th>Gebühr</th><th>G/V</th></tr></thead><tbody>${A.hist.slice(0, 60).map(h => {
    const x = h.id ? E.M.inst[h.id] : null;
    return `<tr><td>${fDate(h.t).slice(0, 6)} ${fTime(h.t)}</td><td class="nm"><b>${esc(h.nm)}</b></td><td>${h.side}</td><td>${x && x.cls === 'bond' ? fmt(h.q, 0) + ' nom.' : Math.abs(h.q) >= 1e6 ? fmtBig(h.q) : fmt(h.q, h.q % 1 === 0 ? 0 : 3)}</td><td>${fmt(h.px, h.px < 1 ? 4 : h.px < 10 ? 3 : 2)}</td><td>${fmtE(h.amt)}</td><td>${fmtE(h.fee)}</td><td class="${h.pnl === null ? '' : sc(h.pnl)}">${h.pnl === null ? '–' : fmtE(h.pnl)}</td></tr>`;
  }).join('')}</tbody></table>` : `<div class="empty">Noch keine Umsätze.</div>`;
}
function updateBank() {
  const b = BANK, today = E.dayStart(berlinNow()), claimed = A.bonus.day === today;
  const streak = claimed ? A.bonus.streak : (A.bonus.day === today - DAY ? A.bonus.streak + 1 : 1);
  const bonusNow = Math.round(Math.min(b.reserve, b.bonusBase * (1 + 0.15 * (Math.min(streak, 7) - 1))) * 100) / 100;
  const T = totals(A).total, me = BOARD.find(x => x.name === ME.name), lic = A.lic || 0;
  const reliefOk = T < 1000 && !A.derivs.length && E.M.t - (A.reliefT || 0) >= 7 * DAY;
  const kv = (a, v) => `<div class="kv"><span>${a}</span><b>${v}</b></div>`;
  $('#bank').innerHTML = `
  <div class="card stack">
    <h2>Tagesbonus</h2>
    <div class="bigval">${claimed ? 'Abgeholt' : '+' + fmtE(bonusNow)}</div>
    <div class="streak" aria-label="Serie ${streak} von 7">${[1, 2, 3, 4, 5, 6, 7].map(i => `<span class="${i <= Math.min(7, claimed ? A.bonus.streak : streak - 1) ? 'on' : ''}"></span>`).join('')}</div>
    <p class="note">Jeden Tag einmal abholen. Wer an aufeinanderfolgenden Tagen kommt, bekommt bis zu 90 % mehr (ab Tag 7). Ein verpasster Tag setzt die Serie zurück. Der Betrag sinkt, wenn die Reserve schrumpft.</p>
    <button class="go n" data-econ="bonus" ${claimed ? 'disabled' : ''}>${claimed ? 'Morgen wieder' : 'Bonus abholen'}</button>
  </div>
  <div class="card stack">
    <h2>Zentralbank</h2>
    <div class="bigval">${fmtE(b.reserve, 0)}</div>
    <div class="meter" title="Füllstand der Reserve"><i style="width:${(b.scarcity * 100).toFixed(1)}%"></i></div>
    ${kv('Füllstand (bestimmt alle Prämien)', fmt(b.scarcity * 100, 1) + ' %')}${kv('Startreserve', fmtE(b.initial, 0))}${kv('Ausgeschüttet (Boni, Erfolge, Liga)', fmtE(b.paid, 0))}${kv('Zurückgeflossen (Gebühren, Lizenzen, Luxus)', fmtE(b.fees, 0))}${kv('Startkapital ausgegeben', fmtE(b.minted, 0) + ` (${b.players} von ${b.maxUsers} Plätzen)`)}${kv('Cash aller Spieler', fmtE(b.cash, 0))}
    <p class="note">Neues Geld entsteht nur hier – oder durch kluges Handeln am Markt. Ist die Reserve leer, gibt es keine Prämien mehr, bis Gebühren zurückfließen.</p>
  </div>
  <div class="card stack">
    <h2>Wochenliga</h2>
    <div class="bigval">${fmtE(b.prizePool, 0)}</div>
    ${kv('Preisgeld 1. / 2. / 3. Platz', '50 / 30 / 20 %')}${kv('Deine Rendite diese Woche', me ? `<span class="${sc(me.perf)}">${pct(me.perf)}</span>` : '–')}${kv('Deine Trades diese Woche', (me ? me.trades : 0) + ' von mind. 3')}
    <p class="note">Abrechnung jeden Montag um 0:00 Uhr. Gewertet wird die Rendite seit Wochenbeginn ohne Boni, Prämien, Lizenzen und Luxus. Teilnahme ab 3 Trades, Preisgeld nur bei positiver Rendite. Der Topf beträgt ${fmt((b.leagueShare || 0.01) * 100, 1)} % der Reserve.</p>
  </div>
  <div class="card stack">
    <h2>Erfolge</h2>
    <div>${ACH.map(a => `<div class="ach ${A.ach[a.id] ? 'done' : ''}"><b>${a.name}</b><span class="rw">+${fmtE(a.reward, 0)}</span><small>${a.desc}</small></div>`).join('')}</div>
    <p class="note">Jeder Erfolg zahlt einmal. Die Prämie kommt aus der Reserve.</p>
  </div>
  <div class="card stack">
    <h2>Handelslizenzen</h2>
    ${LIC.map((L, i) => `<div class="item ${i === lic ? 'own' : ''}"><div class="row"><h3>${L.name}</h3>${i === lic ? '<span class="badge">Deine Stufe</span>' : ''}</div><p>${L.desc}</p><div class="row"><span class="px">${L.price ? fmtE(L.price, 0) : 'gratis'}</span>${i > lic ? `<button class="btn" data-econ="license" data-level="${i}" ${availCash(A) < L.price ? 'disabled' : ''}>Freischalten</button>` : ''}</div></div>`).join('')}
    <p class="note">Lizenzen gelten dauerhaft. Der Preis fließt in die Reserve.</p>
  </div>
  <div class="card stack">
    <h2>Insolvenzhilfe</h2>
    ${kv('Dein Gesamtvermögen', fmtE(T))}${kv('Betrag', fmtE(b.relief, 0))}
    <p class="note">Wer unter 1.000 € fällt und keine Hebelpositionen offen hat, bekommt höchstens einmal pro Woche eine Starthilfe aus der Reserve.</p>
    <button class="btn ghost" data-econ="relief" ${reliefOk ? '' : 'disabled'}>Hilfe beantragen</button>
  </div>
  <div class="card stack" style="grid-column:1/-1">
    <h2>Luxusgüter · limitierte Auflage</h2>
    <div class="items">${LUX.map(it => { const own = A.lux[it.id] || 0, left = b.lux[it.id]; return `<div class="item ${own ? 'own' : ''}"><div class="row"><h3>${it.name}</h3>${own ? `<span class="badge">${own}× deins</span>` : ''}</div><p>${it.desc}</p><div class="row"><span class="px">${fmtE(it.price, 0)}</span><span class="mute">${left} von ${it.supply} verfügbar</span></div><div class="row"><button class="btn" data-econ="luxbuy" data-id="${it.id}" ${left > 0 && availCash(A) >= it.price ? '' : 'disabled'}>Kaufen</button>${own ? `<button class="btn ghost" data-econ="luxsell" data-id="${it.id}">Für ${fmtE(it.price * LUX_BUYBACK, 0)} zurückgeben</button>` : ''}</div></div>`; }).join('')}</div>
    <p class="note">Jedes Stück gibt es nur so oft wie angegeben. Die Bank kauft es jederzeit für 80 % zurück; erst dann kann es jemand anderes kaufen. Luxusgüter stehen in der Rangliste neben deinem Namen.</p>
  </div>
  ${ME.admin ? `<div class="card stack" style="grid-column:1/-1"><h2>Verwaltung</h2><p class="note">Nur du siehst diesen Bereich. Gelöschte Konten verlieren ihr Geld; ihre Luxusgüter gehen an die Bank zurück.</p><div id="admin">${UI.admin ? adminHTML() : '<button class="btn ghost" data-admin="load">Spielerliste laden</button>'}</div></div>` : ''}`;
}
function usageHTML() {
  const u = UI.usage; if (!u) return '';
  const bar = (v, max) => `<div class="meter" style="margin:4px 0 10px"><i style="width:${Math.min(100, v / max * 100).toFixed(1)}%;${v / max > 0.7 ? 'background:var(--dn)' : ''}"></i></div>`;
  return `<div class="kv"><span>Cloudflare-Anfragen heute (UTC ${u.day})</span><b>${fmt(u.req, 0)} / ${fmt(u.budget.req, 0)}</b></div>${bar(u.req, u.budget.req)}
  <div class="kv"><span>Geschriebene Zeilen heute</span><b>${fmt(u.wr, 0)} / ${fmt(u.budget.wr, 0)}</b></div>${bar(u.wr, u.budget.wr)}
  <div class="kv"><span>Live-Takt</span><b>alle ${fmt(u.tickMs / 1000, 0)} s</b></div><div class="kv"><span>Verbundene Tabs</span><b>${u.online}</b></div>
  <p class="note">Ab 50 % des Tageskontingents verlangsamt die Börse automatisch Takt und Speichern, damit das Free-Limit nicht erreicht wird. Die Zähler setzen um 0:00 UTC zurück.</p>`;
}
function adminHTML() { return usageHTML() + `<table><thead><tr><th>Spieler</th><th>Registriert</th><th></th></tr></thead><tbody>${UI.admin.map(u => `<tr><td class="nm"><b>${esc(u.name)}</b></td><td>${new Date(u.created).toLocaleDateString('de-DE')}</td><td>${u.name === ME.name ? '' : `<button class="act x" data-admin="del" data-name="${esc(u.name)}">${UI.adminConfirm === u.name ? 'Wirklich löschen?' : 'Löschen'}</button>`}</td></tr>`).join('')}</tbody></table>`; }
function updateBoard() {
  const luxNames = lux => LUX.filter(i => lux[i.id]).map(i => `<span class="tag">${i.name}${lux[i.id] > 1 ? ' ×' + lux[i.id] : ''}</span>`).join(' ');
  $('#bd').innerHTML = `<table><thead><tr><th>#</th><th class="l">Spieler</th><th>Gesamtvermögen</th><th>Woche</th><th>Trades (Woche)</th><th>Lizenz</th><th>Erfolge</th><th class="l">Besitz</th></tr></thead><tbody>${BOARD.map((p, i) => `<tr class="${p.name === ME.name ? 'me' : ''}"><td>${i + 1}</td><td class="nm l"><b>${esc(p.name)}</b></td><td>${fmtE(p.total)}</td><td class="${sc(p.perf)}">${pct(p.perf)}</td><td>${p.trades}</td><td>${LIC[p.lic || 0].name}</td><td>${p.ach} / ${ACH.length}</td><td class="nm l">${luxNames(p.lux || {}) || '–'}</td></tr>`).join('')}</tbody></table>`;
  const L = BANK.league || [];
  $('#bd-hist').innerHTML = L.length ? `<table><thead><tr><th>Woche ab</th><th>Topf</th><th>1. Platz</th><th>2. Platz</th><th>3. Platz</th></tr></thead><tbody>${L.map(w => `<tr><td>${fDate(w.week)}</td><td>${fmtE(w.pool, 0)}</td>${[0, 1, 2].map(i => w.results[i] ? `<td class="nm"><b>${esc(w.results[i].name)}</b><small>${pct(w.results[i].perf)} · +${fmtE(w.results[i].prize, 0)}</small></td>` : '<td>–</td>').join('')}</tr>`).join('')}</tbody></table>` : `<div class="empty">Die erste Wochenliga wird am Montag um 0:00 Uhr abgerechnet.</div>`;
}

/* ---------- Ereignisse ---------- */
document.addEventListener('click', async ev => {
  const t = ev.target.closest('button,[data-go],a[data-go]'); if (!t) return;
  if (t.dataset.auth) { UI.authMode = t.dataset.auth; showAuth(); return; }
  if (!E.M || !A) return;
  if (t.dataset.go) { ev.preventDefault(); if (t.dataset.sell) { UI.tk.side = 'sell'; UI.fund.side = 'sell'; } go(t.dataset.go); return; }
  if (t.dataset.deriv) { UI.dv.und = t.dataset.deriv; go('derivate'); return; }
  if (t.dataset.tf) { UI.tf = t.dataset.tf; t.parentElement.querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('on', b === t)); update(); return; }
  if (t.dataset.ct) { UI.ctype = t.dataset.ct; t.parentElement.querySelectorAll('[data-ct]').forEach(b => b.classList.toggle('on', b === t)); update(); return; }
  if (t.dataset.cancel) { act({ type: 'cancel', id: +t.dataset.cancel }); return; }
  if (t.dataset.close) { t.disabled = true; act({ type: 'close', pid: +t.dataset.close, frac: +t.dataset.frac }); return; }
  if (t.dataset.econ) { t.disabled = true; await act({ type: t.dataset.econ, level: t.dataset.level ? +t.dataset.level : undefined, id: t.dataset.id }); return; }
  if (t.dataset.admin === 'load') { const r = await post('/api/admin', { type: 'users' }); UI.admin = r.data.users || []; UI.usage = r.data.usage; update(); return; }
  if (t.dataset.admin === 'del') {
    if (UI.adminConfirm !== t.dataset.name) { UI.adminConfirm = t.dataset.name; update(); return; }
    const r = await post('/api/admin', { type: 'delete', name: t.dataset.name }); UI.adminConfirm = null;
    toast(r.data.ok ? `${t.dataset.name} gelöscht` : (r.data.error || 'Fehler'), r.data.ok ? '' : 'dn');
    const u = await post('/api/admin', { type: 'users' }); UI.admin = u.data.users || []; UI.usage = u.data.usage; update(); return;
  }
  if (t.id === 'btnLogout') { await post('/api/logout', {}); UI.authMode = 'login'; showAuth(); return; }
  if (t.id === 'btnRules') { openRules(); return; }
  if (t.dataset.modal === 'close') { $('#modal').hidden = true; return; }
  const x = UI.route.startsWith('i-') ? I(UI.route.slice(2)) : null;
  if (t.dataset.side && x) { UI.tk.side = t.dataset.side; $('#ticket').innerHTML = ticketHTML(x); prefillTicket(x); updateTicket(x); return; }
  if (t.dataset.amt && x) {
    const qi = $('#tk-qty'), ai = $('#tk-amt');
    if (t.dataset.amt === 'max') { const s = readTicket(x); if (UI.tk.side === 'buy') qi.value = maxBuyQty(x, Math.max(0, availCash(A)), s.type === 'limit' && s.limit > 0 ? s.limit : 0); else { const p = A.pos[x.id]; qi.value = p ? roundQty(x, p.qty - reservedUnits(A, x.id)) : 0; } ai.value = ''; }
    else { ai.value = t.dataset.amt; amtToQty(x); }
    updateTicket(x); return;
  }
  if (t.id === 'tk-go' && x) {
    const s = readTicket(x); t.disabled = true;
    const ok = await act({ type: 'order', iid: x.id, side: s.side, otype: s.type, qty: s.qty, limit: s.limit, stop: s.stop, val: s.val }, $('#tk-msg'));
    t.disabled = false; if (ok) { $('#tk-qty').value = ''; $('#tk-amt').value = ''; updateTicket(x); } return;
  }
  if (t.dataset.fside && x) { UI.fund.side = t.dataset.fside; $('#ticket').innerHTML = fundTicketHTML(x); updateFundEst(x); return; }
  if (t.dataset.fmax && x) { const p = A.pos[x.id]; $('#fd-val').value = p ? String(+(p.qty - reservedUnits(A, x.id)).toFixed(6)).replace('.', ',') : 0; updateFundEst(x); return; }
  if (t.id === 'fd-go' && x) { t.disabled = true; const ok = await act({ type: 'fund', iid: x.id, side: UI.fund.side, val: parseNum($('#fd-val').value) }, $('#fd-msg')); t.disabled = false; if (ok) $('#fd-val').value = ''; return; }
  if (t.dataset.kind) { readDv(); UI.dv.kind = t.dataset.kind; if (t.dataset.kind === 'opt' && !LIC[A.lic || 0].opt) toast('Optionsscheine brauchen die Derivate-Lizenz (Bank & Prämien).', 'dn'); rebuildDv(); return; }
  if (t.dataset.dir) { readDv(); UI.dv.dir = +t.dataset.dir; rebuildDv(); return; }
  if (t.dataset.cp) { readDv(); UI.dv.cp = t.dataset.cp; rebuildDv(); return; }
  if (t.dataset.dvamt) { const f = UI.dv.kind === 'cfd' ? $('#dv-margin') : $('#dv-budget'); f.value = t.dataset.dvamt === 'max' ? String(Math.floor(Math.max(0, availCash(A)) * 100) / 100).replace('.', ',') : t.dataset.dvamt; readDv(); updateDvEst(); return; }
  if (t.id === 'dv-go') { t.disabled = true; await act(Object.assign({ type: 'deriv' }, readDv()), $('#dv-msg')); t.disabled = false; return; }
});
function rebuildDv() { const fixed = UI.route.startsWith('i-') ? UI.route.slice(2) : null, host = fixed ? $('#ticket') : $('#dv-form'), u = fixed && I(fixed); host.innerHTML = (fixed ? (u.cls === 'cmd' ? `<h2>${u.name} handeln</h2>${etcLink(u)}` : '<h2>Devisen handeln</h2>') : '') + derivFormHTML(fixed); updateDvEst(); }
function amtToQty(x) { const a = parseNum($('#tk-amt').value); if (!(a > 0)) return; const s = readTicket(x); $('#tk-qty').value = UI.tk.side === 'buy' ? maxBuyQty(x, a, s.type === 'limit' && s.limit > 0 ? s.limit : 0) : roundQty(x, a / E.settleVal(x, x.price)); }
document.addEventListener('input', ev => {
  const t = ev.target; if (!E.M || !A) return;
  const x = UI.route.startsWith('i-') ? I(UI.route.slice(2)) : null;
  if (t.id === 'tk-amt' && x) { amtToQty(x); updateTicket(x); }
  else if (t.id && t.id.startsWith('tk-') && x) { if (t.id === 'tk-qty') $('#tk-amt').value = ''; updateTicket(x); }
  else if (t.id === 'fd-val' && x) updateFundEst(x);
  else if (t.id && t.id.startsWith('dv-')) { readDv(); updateDvEst(); }
});
document.addEventListener('change', ev => {
  const t = ev.target; if (!E.M || !A) return;
  const x = UI.route.startsWith('i-') ? I(UI.route.slice(2)) : null;
  if (t.id === 'tk-type' && x) { UI.tk.type = t.value; prefillTicket(x); updateTicket(x); }
  if (t.id === 'tk-val') UI.tk.val = t.value;
  if (t.id === 'dv-und') { readDv(); UI.dv.und = t.value; UI.dv.strike = 4; rebuildDv(); update(); }
  if (t.id === 'dv-lev') { UI.dv.lev = +t.value; updateDvEst(); }
  if (t.id === 'dv-clev') { UI.dv.cfdLev = +t.value; updateDvEst(); }
  if (t.id === 'dv-fac') { UI.dv.fac = +t.value; updateDvEst(); }
  if (t.id === 'dv-exp') { UI.dv.exp = +t.value; updateDvEst(); }
  if (t.id === 'dv-strike') { UI.dv.strike = +t.value; updateDvEst(); }
});
document.addEventListener('mousemove', ev => {
  const cv = ev.target; if (!(cv instanceof HTMLCanvasElement) || !E.M || !A) { if (UI.hover) { UI.hover = null; redrawCharts(); } return; }
  const r = cv.getBoundingClientRect(); UI.hover = { id: cv.id, x: ev.clientX - r.left, y: ev.clientY - r.top }; redrawCharts();
});
function redrawCharts() {
  if (!booted) return; const r = UI.route;
  if (r === 'markt') renderChartFor(I('WELTIX'), 'chart'); else if (r.startsWith('i-')) renderChartFor(I(r.slice(2)), 'chart'); else if (r === 'derivate') renderChartFor(I(UI.dv.und), 'chart'); else if (r === 'depot') drawEq();
}
window.addEventListener('resize', redrawCharts);
window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (booted && r && r !== UI.route && validRoute(r)) go(r); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').hidden = true; });
document.addEventListener('visibilitychange', () => {
  clearTimeout(hideTimer);
  if (document.hidden) { if (booted) hideTimer = setTimeout(() => pauseWS('hidden'), 120000); }
  else resumeWS();
});
window.addEventListener('focus', () => { if (WS_PAUSED) resumeWS(); });
$('#conn').addEventListener('click', () => { if (WS_PAUSED || !WS_OK) resumeWS(); });
setInterval(() => { if (booted && E.M) updateHeader(); }, 1000);
function openRules() {
  const m = $('#modal');
  m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-labelledby="m-t">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h1 id="m-t">So funktioniert NOVEX</h1><button class="btn-ghost" data-modal="close">Schließen</button></div>
    <p>Alle Unternehmen, Staaten, Fonds und Emittenten sind erfunden. Der Markt läuft in Echtzeit (Berliner Zeit) und ist für alle Spieler derselbe.</p>
    <h2 style="margin:0">Handelszeiten</h2>
    <ul><li>Mo–Fr 08:00–22:00 Uhr, an Feiertagen geschlossen. Nachts und am Wochenende entstehen Kurslücken.</li><li>Fondsorders werden um 17:30 Uhr zum NAV abgerechnet.</li><li>Limit- und Stop-Orders kannst du jederzeit aufgeben.</li></ul>
    <h2 style="margin:0">Marktwirkung</h2>
    <ul><li>Kursbewegung ≈ Tagesschwankung × √(Ordervolumen ÷ Tagesumsatz). Etwa drei Viertel davon bleiben, der Rest klingt in rund 45 Minuten ab.</li><li>Eine Market-Order arbeitet sich durch das Orderbuch – du zahlst den Durchschnitt aller Preisstufen.</li><li>ETF- und Fondsorders handeln die Bestandteile, Hebelprodukte werden am Basiswert abgesichert. Deine Orders bewegen die Kurse deiner Freunde.</li></ul>
    <h2 style="margin:0">Spielgeld</h2>
    <ul><li>Startkapital beim Konto-Eröffnen, danach nur: Tagesbonus, Erfolge, Wochenliga, Insolvenzhilfe – oder Gewinne am Markt.</li><li>Alle Prämien kommen aus einer festen Reserve der Zentralbank. Sie schrumpft mit jeder Auszahlung; Gebühren, Lizenzen und Luxuskäufe füllen sie wieder auf.</li><li>Ausgeben kannst du Geld für Handelslizenzen (höhere Hebel) und limitierte Luxusgüter, die in der Rangliste neben deinem Namen stehen.</li></ul>
    <h2 style="margin:0">Kosten</h2>
    <ul><li>Ordergebühr 0,05 % (mind. 1 €). Fonds: Ausgabeaufschlag. Derivate: Spanne des Emittenten. CFDs und Turbos: tägliche Finanzierung; CFDs werden bei 50 % Margin zwangsgeschlossen.</li></ul>
    <h2 style="margin:0">Darstellung</h2>
    <div class="chips"><button data-theme="auto">System</button><button data-theme="dark">Dunkel</button><button data-theme="light">Hell</button></div>
  </div>`;
  m.hidden = false;
}
document.addEventListener('click', e => { const t = e.target.closest('[data-theme]'); if (!t) return; const v = t.dataset.theme; if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); try { localStorage.setItem('novex-theme', v); } catch { } redrawCharts(); });

/* ---------- Start ---------- */
async function start() {
  await loadState(); if (!E.M || !A) return;
  booted = true; $('#nav').hidden = false; $('#tapebar').hidden = false; $('#user').dataset.built = ''; $('#tape').dataset.built = '';
  connectWS();
  const h = location.hash.slice(1); go(validRoute(h) ? h : 'markt');
}
(async function init() {
  try { const th = localStorage.getItem('novex-theme'); if (th === 'dark' || th === 'light') document.documentElement.setAttribute('data-theme', th); } catch { }
  const r = await getJSON('/api/session');
  if (r.status !== 200) { $('#view').innerHTML = `<div class="auth"><h1>NOVEX Börse</h1><p class="err">Der Server ist nicht erreichbar. Bitte später erneut versuchen.</p></div>`; return; }
  if (!r.data.user) { UI.authMode = r.data.registration ? 'login' : 'login'; showAuth(); return; }
  await start();
})();
