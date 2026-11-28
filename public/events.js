// NOVEX Börse – Marktereignisse: Marktphasen, Zentralbank & Inflation, Quartalszahlen, Dividenden, Gerüchte, Sektor-Termine.
// Geheimes (vorab gezogene Überraschungen, Wahrheit von Gerüchten, nächste Marktphase) liegt in M.sec und verlässt den Server nie.
import { M, hook, ENV, WK, byCls, all, addNews, setWhy, gauss, pick, clamp, pct, fmt, fmtE, fmtBig, fDate, dayStart, isTradingDay, DAY, MIN, book, recomputeDerived, unitNav, executeMarket, maxBuyQty, isTradable, r2, logHist, bumpCmd } from './engine.js';
import { REGIMES, FUNDA, SECTOR_EVENTS, RUMORS, OWNER, SECTORS, TIERS, sensOf } from './data.js';
import { taylor, macroRevFactor } from './macro.js';

const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const uni = (a, b) => a + Math.random() * (b - a);
export function nextTradingDay(d) { d = dayStart(d); while (!isTradingDay(d)) d += DAY; return d; }
export function addTradingDays(d, n) { d = dayStart(d); while (n > 0) { d += DAY; if (isTradingDay(d)) n--; } return d; }
const at = (day, h, m) => day + (h * 60 + m) * MIN;
const stocksOf = sec => byCls('stock').filter(x => x.sector === sec);

/* ---------- Initialisierung (auch für bereits laufende Märkte) ---------- */
hook('init', () => {
  if (!M.sec) M.sec = { pre: {}, rumors: [], nextReg: null };
  if (!M.sec.pre) M.sec.pre = {}; if (!M.sec.rumors) M.sec.rumors = [];
  if (M.lz === undefined) M.lz = Math.round(M.r * 400) / 400;
  if (M.infl === undefined) M.infl = 2.3;
  if (!M.events) M.events = [];
  if (!M.reg) startRegime('bull', true);
  M.rp = rpOf(M.reg.k);
  if (!M.cb) M.cb = { next: nextCb(M.t), p: null, last: null };
  if (!M.cpi) M.cpi = { next: nextCpi(M.t), exp: null, last: null };
  cbExpect(); if (M.cpi.exp === null) cpiExpect();
  for (const x of byCls('stock')) if (!x.fin) initFin(x);
});

/* ---------- Marktphasen ---------- */
const rpOf = k => ({ mu: REGIMES[k].mu, vol: REGIMES[k].vol, tilt: REGIMES[k].tilt });
function drawNext(k) { const n = REGIMES[k].next, u = Math.random(); let a = 0; for (const key in n) { a += n[key]; if (u < a) return key; } return Object.keys(n)[0]; }
function startRegime(k, silent) {
  const R = REGIMES[k], prev = M.reg ? M.reg.k : null, days = R.dur[0] + Math.floor(Math.random() * (R.dur[1] - R.dur[0] + 1));
  M.reg = { k, since: dayStart(M.t), until: addTradingDays(M.t, Math.round(days * 7 / 5)) }; // Dauer in Wochen gerechnet (früher 5 Handelstage je Woche)
  M.rp = rpOf(k);
  if (M.sec) M.sec.nextReg = drawNext(k);
  if (!silent) {
    addNews(`Neue Marktphase: ${R.name}`, R.mu > 0.05 ? 1 : R.mu < -0.05 ? -1 : 0, ['WELTIX'], { cat: 'macro', sub: R.desc });
    for (const A of ENV.accounts()) {
      if (prev === 'rec' && A.crisis) { if (unitNav(A) > A.crisis) ENV.event(A, 'crisis'); delete A.crisis; }
      if (k === 'rec') A.crisis = unitNav(A);
    }
  }
}

/* ---------- Zentralbank & Inflation ---------- */
const CB_ANCHOR = Date.UTC(2026, 0, 22); // ein Donnerstag; Sitzung alle 6 Wochen um 14:15
function nextCb(t) { let d = CB_ANCHOR; while (at(nextTradingDay(d), 14, 15) <= t) d += 42 * DAY; return at(nextTradingDay(d), 14, 15); }
function nextCpi(t) { // zweiter Handelstag des Monats, 11:00
  const d = new Date(t); for (let k = 0; k < 3; k++) { const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1); const rel = at(addTradingDays(nextTradingDay(first), 1), 11, 0); if (rel > t) return rel; }
  return t + 30 * DAY;
}
export function cbTarget() { return taylor(); }
function cbExpect() {
  const gap = cbTarget() - M.lz;
  M.cb.p = gap > 0.004 ? { up: 0.75, hold: 0.25, down: 0 } : gap > 0.0015 ? { up: 0.45, hold: 0.55, down: 0 } : gap < -0.004 ? { up: 0, hold: 0.25, down: 0.75 } : gap < -0.0015 ? { up: 0, hold: 0.55, down: 0.45 } : { up: 0.08, hold: 0.84, down: 0.08 };
}
function shockStocks(shock, why, finBonus = 0) {
  for (const x of byCls('stock')) { const s = sensOf(x), j = shock * (0.5 * x.beta + 0.5 * s.rate) + (x.sector === 'fin' ? finBonus : 0); x.f *= Math.exp(j); x.price = x.f * Math.exp(x.tr); if (why && Math.abs(j) >= 0.004) setWhy(x, `${pct(j, 1)} ${why}`, j); }
}
function refreshFx() { for (const f of byCls('fx')) f.price = M.U[f.base] / M.U[f.quote]; }
function cbDecision() {
  const p = M.cb.p, u = Math.random(), d = u < p.up ? 0.0025 : u < p.up + p.hold ? 0 : -0.0025;
  const exp = 0.0025 * (p.up - p.down), sur = d - exp, old = M.lz;
  M.lz = clamp(M.lz + d, 0, 0.08); M.r = clamp(M.r + 0.5 * d + 0.5 * sur, -0.01, 0.12);
  const shock = -12 * sur;
  shockStocks(shock, 'wegen des Zinsentscheids', 4 * d);
  bumpCmd('GOLD', Math.exp(-6 * sur)); M.U.EUR *= Math.exp(4 * sur); refreshFx(); recomputeDerived();
  const likely = p.up >= p.hold && p.up >= p.down ? 'eine Erhöhung' : p.down >= p.hold ? 'eine Senkung' : 'keine Änderung';
  const title = d > 0 ? `Zentralbank erhöht den Leitzins auf ${fmt(M.lz * 100, 2)} %` : d < 0 ? `Zentralbank senkt den Leitzins auf ${fmt(M.lz * 100, 2)} %` : `Zentralbank lässt den Leitzins bei ${fmt(M.lz * 100, 2)} %`;
  const surpriseTxt = Math.abs(sur) < 0.0006 ? 'Das war so erwartet – die Reaktion bleibt verhalten.' : sur > 0 ? 'Straffer als erwartet: Aktien und Anleihen geben nach, der Euro steigt, Banken profitieren.' : 'Lockerer als erwartet: Aktien und Anleihen legen zu, der Euro gibt nach.';
  addNews(title, d < 0 ? 1 : d > 0 ? -1 : 0, ['WELTIX', 'EURUSD', 'TEUT34'], { cat: 'macro', eff: shock, sub: `Der Markt hatte zu ${Math.round(Math.max(p.up, p.hold, p.down) * 100)} % mit ${likely} gerechnet. ${surpriseTxt} Guthabenzinsen richten sich ab jetzt nach ${fmt(M.lz * 100, 2)} %.` });
  M.cb.last = { t: M.t, d, sur, old }; M.cb.next = nextCb(M.t + DAY); cbExpect();
}
function cpiExpect() { const tgt = M.mac ? M.mac.inflT : REGIMES[M.reg.k].infl; M.cpi.exp = Math.round((M.infl + 0.35 * (tgt - M.infl)) * 10) / 10; }
function cpiRelease() {
  const exp = M.cpi.exp, act = clamp(Math.round((exp + gauss() * 0.25) * 10) / 10, -1, 12), sur = act - exp, prev = M.infl;
  M.infl = act; M.r = clamp(M.r + 0.001 * sur, -0.01, 0.12); M.slope = clamp(M.slope + 0.0005 * sur, -0.03, 0.05);
  const shock = -0.012 * sur; shockStocks(shock, Math.abs(sur) >= 0.2 ? (sur > 0 ? 'nach überraschend hoher Inflation' : 'nach überraschend niedriger Inflation') : null);
  bumpCmd('GOLD', Math.exp(0.01 * sur)); recomputeDerived();
  addNews(`Inflation ${act > prev + 0.05 ? 'steigt' : act < prev - 0.05 ? 'sinkt' : 'verharrt'} auf ${fmt(act, 1)} %`, sur > 0.1 ? -1 : sur < -0.1 ? 1 : 0, ['WELTIX', 'TEUT34'], { cat: 'macro', eff: shock, sub: `Erwartet waren ${fmt(exp, 1)} %. ${sur > 0.1 ? 'Höher als erwartet – eine Zinserhöhung wird wahrscheinlicher.' : sur < -0.1 ? 'Niedriger als erwartet – Zinssenkungen rücken näher.' : 'Im Rahmen der Erwartungen.'}` });
  M.cpi.last = { t: M.t, act, exp, sur }; M.cpi.next = nextCpi(M.t + DAY); cpiExpect(); cbExpect();
}

/* ---------- Quartalszahlen ---------- */
function quarterEnds(fy, from, to) {
  const out = []; let y = new Date(from).getUTCFullYear() - 1;
  for (let guard = 0; guard < 8; guard++, y++) for (let m = 0; m < 12; m++) {
    if ((((m - 2 - fy) % 3) + 3) % 3 !== 0) continue;
    const e = Date.UTC(y, m + 1, 0); if (e > to) return out; if (e >= from) out.push(e);
  }
  return out;
}
const reportDate = (x, qEnd) => nextTradingDay(qEnd + (20 + hash(x.id) % 26) * DAY);
export const qLabel = e => { const d = new Date(e); return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`; };
function drawPre(x) {
  const sv = Math.sqrt(x.vol / 0.3), s = 0.025 + 0.07 * sv * gauss(), rs = 0.006 + 0.022 * gauss(), r = Math.random();
  const guid = s > 0.04 ? (r < 0.5 ? 'up' : 'keep') : s < -0.03 ? (r < 0.5 ? 'down' : 'keep') : (r < 0.15 ? 'up' : r < 0.27 ? 'down' : 'keep');
  return { s, rs, guid, u: Math.random() };
}
export function scheduleReport(x) { nextReport(x); }
function nextReport(x) {
  const fin = x.fin, today = dayStart(M.t), lastEnd = fin.hist.length ? fin.hist[fin.hist.length - 1].end : 0;
  for (const e of quarterEnds(fin.fy, M.t - 200 * DAY, M.t + 420 * DAY)) { const rd = reportDate(x, e); if (rd > today && e > lastEnd) { fin.next = rd; fin.nq = e; break; } }
  if (M.sec) M.sec.pre[x.id] = drawPre(x);
}
const GUID = { up: 'angehoben', keep: 'bestätigt', down: 'gesenkt' };
function summary(x, h, yoy) {
  const tone = h.verdict === 'beat' ? 'spricht von einem „sehr starken Quartal“' : h.verdict === 'miss' ? 'räumt ein „herausforderndes Quartal“ ein' : 'zeigt sich „zufrieden“';
  const g = isFinite(yoy) ? `Der Umsatz ${yoy >= 0 ? 'wuchs' : 'sank'} um ${fmt(Math.abs(yoy) * 100, 1)} % zum Vorjahr` : 'Der Umsatz lag im Rahmen';
  const m = isFinite(h.margin) ? `, die operative Marge lag bei ${fmt(h.margin * 100, 1)} %` : '';
  const o = h.guid === 'up' ? ' Die Prognose fürs Gesamtjahr wird angehoben.' : h.guid === 'down' ? ' Die Jahresprognose wird gesenkt – das Management nennt schwächere Nachfrage.' : ' Die Jahresprognose bleibt unverändert.';
  return `Das Management ${tone}. ${g}${m}.${o}`;
}
function initFin(x) {
  const F = FUNDA[x.id] || { g: 0.05, psr: 3, fy: 0 }, revQ = x.shares * x.price / F.psr / 4, epsA = x.eps || x.price / 20;
  const fin = x.fin = { g: F.g, fy: F.fy, rev: revQ, eps: epsA / 4, hist: [], next: 0, nq: 0, fv: 1 };
  const ends = quarterEnds(F.fy, M.t - 760 * DAY, M.t).filter(e => reportDate(x, e) <= dayStart(M.t)).slice(-8);
  let rev = revQ / Math.pow(1 + F.g, ends.length / 4), eps = epsA / 4 * (epsA > 0 ? 1 / Math.pow(1 + F.g * 0.8, ends.length / 4) : 1 + 0.05 * ends.length);
  for (const e of ends) {
    const pre = drawPre(x), revE = rev * (1 + F.g / 4), r = revE * (1 + pre.rs), epsE = eps >= 0 ? eps * (1 + F.g / 4 * 0.9) : eps * 0.96, ep = epsE + Math.abs(epsE) * pre.s;
    fin.hist.push({ q: qLabel(e), end: e, date: reportDate(x, e), revE, rev: r, epsE, eps: ep, margin: ep * x.shares / r * 1.3, guid: pre.guid, verdict: pre.s > 0.02 ? 'beat' : pre.s < -0.02 ? 'miss' : 'inline', move: 0, sum: '' });
    rev = r; eps = ep;
  }
  // auf die aktuellen Bewertungskennzahlen skalieren (KGV, Kurs-Umsatz)
  const n = fin.hist.length, last4 = fin.hist.slice(-4), ttmE = last4.reduce((a, h) => a + h.eps, 0), ttmR = last4.reduce((a, h) => a + h.rev, 0);
  const fe = ttmE && Math.sign(ttmE) === Math.sign(epsA) ? epsA / ttmE : 1, fr = ttmR ? revQ * 4 / ttmR : 1;
  fin.hist.forEach((h, i) => { h.eps *= fe; h.epsE *= fe; h.rev *= fr; h.revE *= fr; h.margin = h.eps * x.shares / h.rev * 1.3; h.sum = summary(x, h, i >= 4 ? h.rev / fin.hist[i - 4].rev - 1 : NaN); });
  if (n) { fin.rev = fin.hist[n - 1].rev; fin.eps = fin.hist[n - 1].eps; }
  nextReport(x);
}
function report(x) {
  const fin = x.fin, pre = (M.sec && M.sec.pre[x.id]) || drawPre(x);
  // Konjunktur und Politik (Zölle, Steuern, Strafen): Analysten preisen nur einen Teil ein
  const mac = macroRevFactor(x), padj = clamp(x.padj || 0, -0.6, 0.6); x.padj = 0;
  let revE = fin.rev * (1 + fin.g / 4) * (1 + 0.5 * mac), rev = revE * (1 + pre.rs + 0.5 * mac);
  const epsE0 = fin.eps >= 0 ? fin.eps * (1 + fin.g / 4 * 0.9) : fin.eps * 0.96;
  let epsE = epsE0 * (1 + mac + 0.5 * padj), eps = (epsE0 + Math.abs(epsE0) * pre.s) * (1 + 2 * mac + padj);
  // Börsennotiertes Spieler-Startup: echte Zahlen aus der Startup-Simulation, Erwartung = eigene Guidance (falls abgegeben)
  const vr = x.player && ENV.ventReport ? ENV.ventReport(x) : null;
  if (vr) { rev = vr.rev; eps = vr.eps; revE = vr.revE; epsE = vr.epsE; }
  const sur = epsE ? (eps - epsE) / Math.abs(epsE) : pre.s, verdict = sur > 0.02 ? 'beat' : sur < -0.02 ? 'miss' : 'inline';
  const j = clamp((0.9 * clamp(sur, -0.5, 0.5) + 0.5 * (vr ? clamp(rev / revE - 1, -0.3, 0.3) : pre.rs) + (pre.guid === 'up' ? 0.03 : pre.guid === 'down' ? -0.045 : 0) + 0.012 * gauss()) * Math.sqrt(x.vol / 0.3), -0.3, 0.3);
  x.f *= Math.exp(j); x.tr = 0; x.price = x.f; x.vb = 3.5;
  const q = qLabel(fin.nq), yoy = fin.hist.length >= 4 ? rev / fin.hist[fin.hist.length - 4].rev - 1 : NaN;
  const h = { q, end: fin.nq, date: dayStart(M.t), revE, rev, epsE, eps, margin: eps * x.shares / rev * 1.3, guid: pre.guid, verdict, move: j, sum: '' };
  h.sum = summary(x, h, yoy);
  fin.hist.push(h); if (fin.hist.length > 8) fin.hist.shift();
  fin.rev = rev; fin.eps = eps; fin.g = clamp(0.8 * fin.g + 0.2 * (fin.g + pre.rs * 4), -0.4, 1.2); fin.fv = (fin.fv || 0) + 1;
  const l4 = fin.hist.slice(-4); x.eps = l4.length === 4 ? l4.reduce((a, k) => a + k.eps, 0) : eps * 4;
  const vw = verdict === 'beat' ? 'starken' : verdict === 'miss' ? 'schwachen' : 'soliden';
  const title = verdict === 'beat' ? `${x.name} übertrifft die Erwartungen: Gewinn je Aktie ${fmt(eps, 2)} € statt ${fmt(epsE, 2)} €` : verdict === 'miss' ? `${x.name} verfehlt die Erwartungen: Gewinn je Aktie ${fmt(eps, 2)} € statt ${fmt(epsE, 2)} €` : `${x.name} liefert Zahlen im Rahmen der Erwartungen`;
  addNews(title, j > 0.005 ? 1 : j < -0.005 ? -1 : 0, [x.id], { cat: 'earn', eff: j, sub: `${q}: Umsatz ${fmtBig(rev)} € (${pct(rev / revE - 1, 1)} gegenüber der Erwartung), Ausblick ${GUID[pre.guid]}. Aktie ${pct(j, 1)} zur Eröffnung.` });
  setWhy(x, `${pct(j, 1)} nach ${vw} ${q}-Zahlen${pre.guid !== 'keep' ? ' und ' + (pre.guid === 'up' ? 'angehobener' : 'gesenkter') + ' Prognose' : ''}${padj < -0.02 ? ' – Zölle und Politik drücken die Marge' : padj > 0.02 ? ' – Rückenwind aus der Politik' : ''}`, j);
  const gov = x.gov && x.gov.pay, pm = gov === 'div' ? 1.8 : gov === 're' ? 0.3 : 1;
  if (gov === 're') fin.g = clamp(fin.g + 0.01, -0.4, 1.2); else if (gov === 'div') fin.g = clamp(fin.g - 0.005, -0.4, 1.2);
  if (x.dy > 0) payDividend(x, x.dy * pm * x.price / 4, q);
  nextReport(x);
}

/* ---------- Dividenden ---------- */
export function ownerLevel(share) { let lv = null; for (const o of OWNER) if (share >= o.min) lv = o; return lv; }
export function payDividend(x, dps, q) {
  if (!(dps > 0) || !(x.price > dps * 2)) return;
  const ex = 1 - dps / x.price;
  for (const y of all()) if (y.cls === 'etf' || y.cls === 'fund') for (const c of y.comp) if (c.id === x.id) c.c /= ex; // thesaurierend: Fonds legen die Dividende wieder an
  x.f *= ex; x.price = x.f * Math.exp(x.tr); x.fin.lastDiv = { t: M.t, dps, q };
  for (const A of ENV.accounts()) {
    const p = A.pos[x.id]; if (!p || !(p.qty > 0)) continue;
    const lv = ownerLevel(p.qty / x.shares), bonus = lv ? lv.div : 0, amt = r2(p.qty * dps * (1 + bonus)); if (!(amt >= 0.01)) continue;
    A.cash += amt; p.inc = r2((p.inc || 0) + amt); book(A, 'div', amt, `${x.name} ${q}`);
    logHist(A, { t: M.t, id: x.id, nm: x.name, side: 'Dividende', q: p.qty, px: dps, amt, fee: 0, pnl: amt });
    ENV.note(A, `Dividende von ${x.name}: +${fmtE(amt)}${bonus ? ` inkl. ${Math.round(bonus * 100)} % Sonderdividende` : ''}`, 'div'); ENV.event(A, 'div', { amt });
    if (A.drip && isTradable(x)) {
      const qty = maxBuyQty(x, amt, 0, A, true), e = qty > 0 ? executeMarket(A, x, 'buy', qty, { noFee: true, label: 'Wiederanlage' }) : null;
      if (e) { ENV.note(A, `Dividende automatisch wieder angelegt: ${fmt(e.q, 4)} ${x.name}`, 'up'); ENV.event(A, 'drip'); }
    }
    ENV.dirty(A);
  }
  recomputeDerived();
}

/* ---------- Sektor-Termine ---------- */
function maybeScheduleSector() {
  const pending = M.events.filter(e => !e.done && e.kind === 'sector');
  if (pending.length >= 2 || Math.random() > 0.3 * WK) return;
  const opts = SECTOR_EVENTS.filter(s => !pending.some(p => p.sector === s.sector)); if (!opts.length) return;
  const s = pick(opts), d = addTradingDays(M.t, 2 + Math.floor(Math.random() * 4)), ev = { id: M.nseq, kind: 'sector', sector: s.sector, title: s.title, t: at(d, 15, 0), done: false };
  M.events.push(ev);
  addNews(`Termin am ${fDate(ev.t, true).slice(0, 9)}: ${s.title}`, 0, stocksOf(s.sector).slice(0, 4).map(x => x.id), { cat: 'politics', sub: `Das Ergebnis kann ${SECTORS[s.sector]}-Werte deutlich bewegen – in beide Richtungen. Wer vorbereitet sein will, prüft jetzt seine Positionen.` });
}
function resolveSector(ev) {
  const pos = Math.random() < 0.55, j = (pos ? 1 : -1) * uni(0.02, 0.05), head = ev.title.split(':')[0];
  for (const x of stocksOf(ev.sector)) { const jj = j * uni(0.7, 1.3) * Math.sqrt(x.vol / 0.3); x.f *= Math.exp(jj); x.price = x.f * Math.exp(x.tr); setWhy(x, `${pct(jj, 1)} nach ${head}`, jj); }
  if (ev.sector === 'energy') bumpCmd('BRNT', Math.exp(j));
  recomputeDerived();
  addNews(`${head}: ${pos ? 'Entscheidung fällt zugunsten der Branche aus' : 'Entscheidung belastet die Branche'}`, pos ? 1 : -1, stocksOf(ev.sector).slice(0, 4).map(x => x.id), { cat: 'politics', eff: j, sub: `${SECTORS[ev.sector]}-Werte reagieren im Schnitt mit ${pct(j, 1)}.` });
  ev.done = true; ev.res = j;
}

/* ---------- Gerüchte ---------- */
function maybeRumor() {
  if (Math.random() > 0.35 * WK || M.sec.rumors.length >= 3) return;
  const cands = byCls('stock').filter(x => !M.sec.rumors.some(r => r.id === x.id)); if (!cands.length) return;
  const x = pick(cands), today = dayStart(M.t);
  M.sec.rumors.push({ id: x.id, tpl: Math.floor(Math.random() * RUMORS.length), truth: Math.random() < 0.4, at: today + (9 * 60 + Math.floor(Math.random() * 660)) * MIN, res: at(addTradingDays(M.t, 1 + Math.floor(Math.random() * 3)), 9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60)), out: false, mv: 0 });
}
function publishRumor(r) {
  const x = M.inst[r.id], T = RUMORS[r.tpl]; if (!x) { r.res = 0; return; }
  const mv = uni(T.up[0], T.up[1]) * 0.4 * Math.sqrt(x.vol / 0.3), txt = T.txt.replace('{n}', x.name);
  x.f *= Math.exp(mv); x.price = x.f * Math.exp(x.tr); r.mv = mv; r.out = true;
  addNews(txt, mv > 0 ? 1 : -1, [x.id], { cat: r.tpl === 0 ? 'ma' : 'company', rumor: true, p: r.tpl === 0 ? 0.4 : null, eff: mv, sub: 'Unbestätigt. Ob etwas dran ist, zeigt sich in den nächsten Tagen – Gerüchte stimmen längst nicht immer.' });
  setWhy(x, `${pct(mv, 1)} wegen eines Gerüchts`, mv);
}
function resolveRumor(r) {
  const x = M.inst[r.id], T = RUMORS[r.tpl]; if (!x) return;
  let j, txt;
  if (r.truth) { const full = uni(T.up[0], T.up[1]) * Math.sqrt(x.vol / 0.3); const prem = Math.round(25 + Math.random() * 20); j = (r.tpl === 0 ? prem / 100 * 0.8 : full) - r.mv; txt = T.yes.replace('{n}', x.name).replace('{p}', prem); }
  else { j = -r.mv * 0.9; txt = T.no.replace('{n}', x.name); }
  x.f *= Math.exp(j); x.price = x.f * Math.exp(x.tr);
  addNews(txt, j > 0 ? 1 : -1, [x.id], { cat: r.tpl === 0 ? 'ma' : 'company', eff: j, sub: r.truth ? 'Das Gerücht hat sich bestätigt.' : 'Das Gerücht war falsch – der Kurs gibt den Gerüchte-Aufschlag wieder ab.' });
  setWhy(x, `${pct(j, 1)} – ${txt}`, j);
}

/* ---------- Ablauf ---------- */
hook('gap', () => {
  const today = dayStart(M.t);
  if (today >= M.reg.until) startRegime((M.sec && M.sec.nextReg) || drawNext(M.reg.k));
  for (const x of byCls('stock')) if (x.fin && x.fin.next && x.fin.next <= today) report(x);
  maybeScheduleSector(); maybeRumor();
  M.events = M.events.filter(e => !e.done || M.t - e.t < 4 * DAY);
  cbExpect();
});
hook('step', () => {
  if (M.cb.next && M.t >= M.cb.next) cbDecision();
  if (M.cpi.next && M.t >= M.cpi.next) cpiRelease();
  let changed = false;
  for (const ev of M.events) if (!ev.done && ev.kind === 'sector' && M.t >= ev.t) { resolveSector(ev); changed = true; }
  for (const r of M.sec.rumors) { if (!r.out && M.t >= r.at) { publishRumor(r); changed = true; } else if (r.out && M.t >= r.res) { resolveRumor(r); r.done = true; changed = true; } }
  if (changed) { M.sec.rumors = M.sec.rumors.filter(r => !r.done && r.res); recomputeDerived(); }
});

/* ---------- Einblicke (nur serverseitig berechnet, je Spieler) ---------- */
export function insightsFor(A) {
  const out = { hints: [], phase: null }, tier = TIERS[A.tierMax || 0] || TIERS[0];
  if (!M.sec) return out;
  for (const x of byCls('stock')) {
    const pre = M.sec.pre[x.id]; if (!pre || !x.fin) continue;
    const p = A.pos[x.id], lv = ownerLevel(p ? p.qty / x.shares : 0), acc = lv ? lv.hint : tier.hint ? 0.65 : 0; if (!acc) continue;
    const ts = pre.s + 0.5 * (x.padj || 0) + macroRevFactor(x), truth = ts > 0.01 ? 1 : ts < -0.01 ? -1 : 0, ok = pre.u < acc;
    out.hints.push({ id: x.id, dir: ok ? truth : (truth === 0 ? (pre.u < (1 + acc) / 2 ? 1 : -1) : -truth), acc, src: lv ? lv.name : 'Analystentendenz', date: x.fin.next });
  }
  if (tier.phase && M.sec.nextReg) out.phase = { next: M.sec.nextReg, until: M.reg.until };
  // Bilanz-Einblicke ab 5 % (interne Planung), Insider-Wissen zur Übernahmeprämie ab 25 %
  out.deep = {};
  for (const id in A.pos) {
    const x = M.inst[id]; if (!x || x.cls !== 'stock' || !x.fin) continue; const sh = A.pos[id].qty / x.shares; if (sh < 0.05) continue;
    const pre = M.sec.pre[id] || { s: 0, rs: 0 }, mac = macroRevFactor(x), fin = x.fin;
    const rev = fin.rev * (1 + fin.g / 4) * (1 + pre.rs + mac), eps = (fin.eps >= 0 ? fin.eps * (1 + fin.g / 4 * 0.9) : fin.eps * 0.96) * (1 + pre.s + 2 * mac + (x.padj || 0));
    const d = out.deep[id] = { rev: rev * (1 + 0.02 * gauss()), eps: eps * (1 + 0.03 * gauss()), padj: x.padj || 0 };
    if (sh >= 0.25 && ENV.bidReq) d.req = Math.round((ENV.bidReq(x) + 0.03 * gauss()) * 100) / 100;
  }
  return out;
}
