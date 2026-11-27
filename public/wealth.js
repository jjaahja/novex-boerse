// NOVEX Börse – Vermögensaufbau: Zinsen, Festgeld, Sparpläne, Währungskonten, Wertpapierkredit, Stufen, Analyse.
import { M, hook, ENV, I, byCls, CCYS, ccyEur, totals, book, unitNav, executeMarket, maxBuyQty, roundQty, posValue, creditLimit, availCash, placeFundOrder, applyTrade, avgRatio, isTradable, fmtE, fmt, fDate, r2, dayStart, DAY, YR, rateOf, derivValue, derivLev } from './engine.js';
import { TIERS, DEPOSIT_PREMIUM, CASH_RATE_CAP, LOMBARD } from './data.js';
import { ownerLevel, nextTradingDay } from './events.js';

const monthKey = t => { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const okNum = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
export const FX_PAIR = { USD: 'EURUSD', CHF: 'EURCHF', GBP: 'EURGBP' };
export const tierOf = T => { let t = 0; TIERS.forEach((x, i) => { if (T >= x.min) t = i; }); return t; };

/* ---------- Tagesabschluss bei Börseneröffnung ---------- */
hook('open', days => {
  const lz = M.lz === undefined ? M.r : M.lz;
  for (const A of ENV.accounts()) {
    if (!A.agg) continue;
    // Guthabenzinsen (täglich berechnet, monatlich gutgeschrieben) und Kreditzinsen
    if (A.cash > 0) A.intAcc += Math.min(A.cash, CASH_RATE_CAP) * Math.max(0, lz) * days / 365;
    for (const c of CCYS) if (A.fxc[c] > 0) A.fxAcc[c] += A.fxc[c] * ccyEur(c) * Math.max(0, rateOf(c)) * days / 365;
    if (A.cash < 0) { const k = r2(-A.cash * (lz + 0.03) * days / 365); if (k > 0) { A.cash -= k; ENV.collect(k); book(A, 'debt', -k, 'Kreditzinsen'); ENV.dirty(A); } }
    const mk = monthKey(M.t);
    if (A.intMonth && A.intMonth !== mk) {
      const eur = r2(A.intAcc), fx = r2(CCYS.reduce((s, c) => s + A.fxAcc[c], 0));
      if (eur >= 0.01) ENV.pay(A, eur, 'int', 'Guthabenzinsen');
      if (fx >= 0.01) ENV.pay(A, fx, 'int', 'Zinsen auf Fremdwährungskonten');
      A.intAcc = 0; for (const c of CCYS) A.fxAcc[c] = 0; ENV.dirty(A);
    }
    A.intMonth = mk;
    // Festgeld fällig
    for (const d of [...A.deps]) if (M.t >= d.end) {
      A.deps.splice(A.deps.indexOf(d), 1); A.cash += d.amt;
      const z = r2(d.amt * d.rate * (d.end - d.start) / YR); if (z >= 0.01) ENV.pay(A, z, 'int', `Festgeld ${d.months} Monate`);
      ENV.note(A, `Festgeld fällig: ${fmtE(d.amt)} zurück auf dem Verrechnungskonto`, 'up'); ENV.dirty(A);
    }
    // Sparpläne
    const today = dayStart(M.t);
    for (const pl of A.plans) if (pl.next <= today) { runPlan(A, pl); pl.next = nextPlanDate(pl, today + DAY); ENV.dirty(A); }
  }
});
function runPlan(A, pl) {
  const x = I(pl.iid); if (!x) return;
  if (availCash(A, undefined, true) < pl.amt) { ENV.note(A, `Sparplan ${x.name} ausgesetzt: zu wenig Guthaben (${fmtE(pl.amt)} nötig)`, 'dn'); return; }
  if (x.cls === 'fund') { if (placeFundOrder(A, x.id, 'buy', pl.amt)) return; }
  else { const q = maxBuyQty(x, pl.amt, 0, A, true); if (!(q > 0) || !executeMarket(A, x, 'buy', q, { noFee: true, label: 'Sparplan' })) return; }
  A.stats.plans = (A.stats.plans || 0) + 1; pl.runs = (pl.runs || 0) + 1;
  ENV.note(A, `Sparplan ausgeführt: ${fmtE(pl.amt)} in ${x.name}`, 'up'); ENV.event(A, 'plan');
}
export function nextPlanDate(pl, from) {
  let d = dayStart(from);
  if (pl.freq === 'w') { while (new Date(d).getUTCDay() !== pl.day) d += DAY; }
  else { const t = new Date(d); let c = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), pl.day); if (c < d) c = Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, pl.day); d = c; }
  return nextTradingDay(d);
}

/* ---------- Kreditlinie: Zwangsverkauf, wenn der Rahmen überschritten wird ---------- */
hook('step', () => {
  for (const A of ENV.accounts()) {
    if (!(A.cash < 0)) continue;
    let guard = 0;
    while (A.cash < 0 && -A.cash > creditLimit(A) + 1 && guard++ < 20) {
      const lim = creditLimit(A), f = (TIERS[A.tier || 0] || TIERS[0]).credit;
      const cand = Object.keys(A.pos).map(id => I(id)).filter(x => isTradable(x)).sort((a, b) => posValue(b.id, A.pos[b.id]) - posValue(a.id, A.pos[a.id]))[0];
      if (!cand) break;
      const need = (-A.cash - 0.9 * lim) / Math.max(0.2, 1 - (LOMBARD[cand.cls] || 0) * f), unit = posValue(cand.id, { qty: 1 });
      const q = Math.min(A.pos[cand.id].qty, roundQty(cand, need / unit * 1.02 + (cand.cls === 'bond' ? 1000 : 0)));
      const e = q > 0 ? executeMarket(A, cand, 'sell', q, { label: 'Zwangsverkauf' }) : null; if (!e) break;
      ENV.note(A, `Kreditrahmen überschritten: ${cand.name} für ${fmtE(e.total)} zwangsverkauft`, 'dn');
    }
  }
});

/* ---------- Meilensteine bei jedem Vermögens-Schnappschuss ---------- */
hook('mark', (A, T) => {
  if (!A.agg) return;
  const t = tierOf(T); A.tier = t;
  if (t > (A.tierMax || 0)) { for (let i = (A.tierMax || 0) + 1; i <= t; i++) ENV.event(A, 'tier', { tier: i }); A.tierMax = t; ENV.dirty(A); }
  const nav = unitNav(A, T), day = dayStart(M.t);
  if (nav > (A.ath || 0)) { if (A.ath && nav > 100.5 && A.athDay !== day) { A.athDay = day; ENV.event(A, 'ath', { nav }); } A.ath = nav; }
  const has = k => A.ach && A.ach[k];
  for (const id in A.pos) {
    const x = I(id), p = A.pos[id];
    if (!has('tenbagger') && p.cost >= 100 && posValue(id, p) >= 10 * p.cost) ENV.event(A, 'tenbagger', { id });
    if (!has('owner') && x.cls === 'stock' && p.qty / x.shares >= 0.01) ENV.event(A, 'owner', { id });
  }
  if (!has('passive100') && (A.agg.div || 0) + (A.agg.int || 0) + (A.agg.cpn || 0) >= 100) ENV.event(A, 'passive100');
});

/* ---------- Aktionen ---------- */
export function setDrip(A, on) { A.drip = !!on; ENV.dirty(A); return null; }
export function setCredit(A, on) {
  if (on && !(TIERS[A.tier || 0].credit > 0)) return 'Der Wertpapierkredit wird ab der Stufe „Aktiver Trader“ (25.000 € Vermögen) freigeschaltet.';
  if (!on && A.cash < 0) return 'Zahle zuerst den Kredit zurück (Verrechnungskonto ins Plus bringen).';
  A.credit = !!on; ENV.dirty(A); return null;
}
export function addPlan(A, b) {
  const x = M.inst[b.iid];
  if (!x || !((isTradable(x) && x.cls !== 'bond') || x.cls === 'fund')) return 'Sparpläne gibt es für Aktien, ETFs und Fonds.';
  if (!okNum(b.amt, 10, 1e7)) return 'Sparrate: mindestens 10 €.';
  if (b.freq !== 'w' && b.freq !== 'm') return 'Ungültiger Rhythmus.';
  const day = Number(b.day); if (b.freq === 'w' ? !(day >= 1 && day <= 5) : !(day >= 1 && day <= 28)) return 'Ungültiger Ausführungstag.';
  if (A.plans.length >= 10) return 'Maximal 10 Sparpläne.';
  const pl = { id: A.seq++, iid: x.id, amt: r2(b.amt), freq: b.freq, day, runs: 0, next: 0 }; pl.next = nextPlanDate(pl, M.t + DAY);
  A.plans.push(pl); ENV.note(A, `Sparplan angelegt: ${fmtE(pl.amt)} ${pl.freq === 'w' ? 'wöchentlich' : 'monatlich'} in ${x.name}, erste Ausführung am ${fDate(pl.next, true)}`, 'up'); ENV.dirty(A); return null;
}
export function delPlan(A, id) { const i = A.plans.findIndex(p => p.id === id); if (i < 0) return 'Sparplan nicht gefunden.'; A.plans.splice(i, 1); ENV.dirty(A); return null; }
export const depositRate = months => (M.lz === undefined ? M.r : M.lz) + (DEPOSIT_PREMIUM[months] || 0);
export function openDeposit(A, months, amt) {
  if (!TIERS[A.tierMax || 0].terms.includes(months)) return `Festgeld über ${months} Monate wird ab der Stufe „Aktiver Trader“ freigeschaltet.`;
  if (!okNum(amt, 1000, 1e10)) return 'Festgeld ab 1.000 €.';
  if (amt > availCash(A, undefined, true) + 1e-6) return `Nicht genug freies Guthaben (verfügbar ${fmtE(availCash(A, undefined, true))}).`;
  if (A.deps.length >= 10) return 'Maximal 10 Festgeld-Anlagen.';
  const d = new Date(M.t), end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), 8, 0);
  const dep = { id: A.seq++, amt: r2(amt), rate: depositRate(months), months, start: M.t, end };
  A.cash -= dep.amt; A.deps.push(dep);
  ENV.note(A, `Festgeld angelegt: ${fmtE(dep.amt)} zu ${fmt(dep.rate * 100, 2)} % bis ${fDate(end)}`, 'up'); ENV.dirty(A); return null;
}
// Währungstausch EUR ⇄ USD/CHF/GBP über das Devisen-Orderbuch (Spread und Marktwirkung inklusive)
export function quoteExchange(from, to, amt) {
  const ccy = from === 'EUR' ? to : from, pair = M.inst[FX_PAIR[ccy]]; if (!pair || !(amt > 0)) return null;
  if (from === 'EUR') { const Q = amt, r = avgRatio(pair, -1, Q); return { ccy, pair, dir: -1, Q, got: amt * pair.price * r, rate: pair.price * r }; }
  const Q = amt / pair.price, r = avgRatio(pair, 1, Q); return { ccy, pair, dir: 1, Q, got: amt / (pair.price * r), rate: pair.price * r };
}
export function exchange(A, from, to, amt) {
  if (!M.isOpen) return 'Währungen tauschst du zu Börsenzeiten (Mo–Fr 08:00–22:00).';
  if (!((from === 'EUR' && CCYS.includes(to)) || (to === 'EUR' && CCYS.includes(from)))) return 'Getauscht wird zwischen Euro und USD, CHF oder GBP.';
  if (!okNum(amt, 10, 1e12)) return 'Mindestbetrag: 10.';
  const q = quoteExchange(from, to, amt); if (!q) return 'Kein Kurs verfügbar.';
  if (from === 'EUR') { if (amt > availCash(A, undefined, true) + 1e-6) return `Nicht genug Euro-Guthaben (verfügbar ${fmtE(availCash(A, undefined, true))}).`; A.cash -= amt; A.fxc[to] += q.got; A.fxCost[to] += amt; }
  else {
    if (amt > A.fxc[from] + 1e-9) return `Nicht genug ${from} (verfügbar ${fmt(A.fxc[from], 2)}).`;
    const cost = A.fxCost[from] * amt / A.fxc[from], pnl = q.got - cost;
    A.fxc[from] -= amt; A.fxCost[from] -= cost; if (A.fxc[from] < 1e-9) { A.fxc[from] = 0; A.fxCost[from] = 0; }
    A.cash += q.got; book(A, 'fx', pnl, `${from} in EUR getauscht`);
  }
  applyTrade(q.pair, q.dir, q.Q, true);
  A.hist.unshift({ t: M.t, id: q.pair.id, nm: `${from} → ${to}`, side: 'Tausch', q: amt, px: q.rate, amt: from === 'EUR' ? amt : q.got, fee: 0, pnl: null });
  ENV.note(A, `Getauscht: ${fmt(amt, 2)} ${from} → ${fmt(q.got, 2)} ${to}`, 'up'); ENV.event(A, 'fx'); ENV.dirty(A); return null;
}

/* ---------- Portfolio-Analyse (läuft im Browser) ---------- */
const SIG_MKT = 0.18;
function riskOf(x) {
  if (x.cls === 'stock') return { beta: x.beta, vol: x.vol, ccy: 'EUR', sector: x.sector };
  if (x.cls === 'bond') return { beta: 0.05, vol: x.volA || 0.05, ccy: 'EUR', sector: 'bond' };
  if (x.cls === 'etf' || x.cls === 'fund') {
    let b = 0, v = 0, cmd = 0, bond = 0, w = 0;
    for (const c of x.comp) { const m = I(c.id); const ww = c.c; const val = ww * (m.cls === 'bond' ? m.tri : m.cls === 'cmd' ? m.price * ccyEur('USD') : m.price); w += val; const r = m.cls === 'cmd' ? { beta: m.beta, vol: m.vol } : riskOf(m); b += val * r.beta; v += val * r.vol; if (m.cls === 'cmd') cmd += val; if (m.cls === 'bond') bond += val; }
    return { beta: w ? b / w : 1, vol: w ? v / w * 0.75 : 0.15, ccy: cmd / w > 0.5 ? 'USD' : 'EUR', sector: cmd / w > 0.5 ? 'cmd' : bond / w > 0.5 ? 'bond' : 'mixed' };
  }
  return { beta: 1, vol: 0.2, ccy: 'EUR', sector: 'mixed' };
}
export function analyze(A) {
  const T = totals(A), total = Math.max(T.total, 1e-9), rows = [];
  for (const id in A.pos) { const x = I(id); if (!x) continue; rows.push({ id, x, v: posValue(id, A.pos[id]), ...riskOf(x) }); }
  let lev = 0; for (const p of A.derivs) { const u = I(p.und), v = derivValue(p), L = derivLev(p); lev += isFinite(L) ? v * L : 0; rows.push({ id: p.pid, x: u, v, beta: (u.cls === 'stock' ? u.beta : u.cls === 'index' ? 1 : 0.2) * (isFinite(L) ? L : 1), vol: (u.vol || u.volA || 0.2) * (isFinite(L) ? L : 1), ccy: u.cls === 'fx' || u.cls === 'cmd' ? 'USD' : 'EUR', sector: 'lever', lev: true }); }
  const sec = rows.filter(r => !r.lev), secTot = sec.reduce((s, r) => s + r.v, 0);
  const wSec = sec.map(r => r.v / Math.max(secTot, 1e-9)), effN = wSec.length ? 1 / wSec.reduce((s, w) => s + w * w, 0) : 0;
  const top = sec.slice().sort((a, b) => b.v - a.v)[0];
  let beta = 0, idio = 0; for (const r of rows) { const w = r.v / total; beta += w * r.beta; idio += Math.pow(w * Math.sqrt(Math.max(0, r.vol * r.vol - Math.pow(r.beta * SIG_MKT, 2))), 2); }
  const vol = Math.sqrt(Math.pow(beta * SIG_MKT, 2) + idio);
  const group = (key, label) => { const m = {}; for (const r of rows) { const k = key(r); m[k] = (m[k] || 0) + r.v; } return Object.entries(m).map(([k, v]) => ({ k, label: label(k), v, w: v / total })).sort((a, b) => b.v - a.v); };
  const CLASS = { stock: 'Aktien', etf: 'ETFs & ETCs', fund: 'Fonds', bond: 'Anleihen', lever: 'Hebelprodukte' };
  const alloc = group(r => r.lev ? 'lever' : r.x.cls, k => CLASS[k] || k);
  if (T.cash > 0) alloc.push({ k: 'cash', label: 'Verrechnungskonto', v: T.cash, w: T.cash / total });
  if (T.dep > 0) alloc.push({ k: 'dep', label: 'Festgeld', v: T.dep, w: T.dep / total });
  if (T.fxv > 0) alloc.push({ k: 'fx', label: 'Fremdwährung', v: T.fxv, w: T.fxv / total });
  if (T.lux > 0) alloc.push({ k: 'lux', label: 'Luxusgüter', v: T.lux, w: T.lux / total });
  alloc.sort((a, b) => b.v - a.v);
  const ccy = group(r => r.ccy, k => k); const eurCash = Math.max(0, T.cash) + T.dep; if (eurCash > 0) { const e = ccy.find(c => c.k === 'EUR'); if (e) { e.v += eurCash; e.w = e.v / total; } else ccy.push({ k: 'EUR', label: 'EUR', v: eurCash, w: eurCash / total }); }
  for (const c of CCYS) if (A.fxc[c] > 0) { const v = A.fxc[c] * ccyEur(c), e = ccy.find(z => z.k === c); if (e) { e.v += v; e.w = e.v / total; } else ccy.push({ k: c, label: c, v, w: v / total }); }
  const verdicts = [];
  if (!sec.length) verdicts.push('Noch kein Depot: Dein Geld liegt auf dem Verrechnungskonto und bekommt Zinsen, aber keine Rendite vom Markt.');
  else {
    verdicts.push(effN < 3 ? `Klumpenrisiko: Dein Depot hängt im Kern an ${fmt(effN, 1)} Positionen. Fällt eine davon, spürst du es stark.` : effN < 8 ? `Mittlere Streuung: wie etwa ${fmt(effN, 0)} gleich große Positionen.` : `Breit gestreut: wie etwa ${fmt(effN, 0)} gleich große Positionen. Einzelne Ausreißer fallen kaum ins Gewicht.`);
    if (top && top.v / total > 0.25) verdicts.push(`${top.x.name} macht ${fmt(top.v / total * 100, 0)} % deines Vermögens aus.`);
  }
  verdicts.push(vol < 0.08 ? `Geringes Risiko: Erwartete Jahresschwankung um ±${fmt(vol * 100, 0)} %.` : vol < 0.2 ? `Mittleres Risiko: Erwartete Jahresschwankung um ±${fmt(vol * 100, 0)} %.` : `Hohes Risiko: Erwartete Jahresschwankung um ±${fmt(vol * 100, 0)} % – ein schlechtes Jahr kann dich viel kosten.`);
  verdicts.push(beta < 0.3 ? 'Kaum vom Aktienmarkt abhängig.' : beta < 0.9 ? `Bewegt sich etwas ruhiger als der Markt (Beta ${fmt(beta, 2)}).` : beta < 1.2 ? `Läuft ungefähr mit dem Markt (Beta ${fmt(beta, 2)}).` : `Schwankt stärker als der Markt (Beta ${fmt(beta, 2)}): Steigt der WELTIX um 1 %, steigt dein Depot im Schnitt um ${fmt(beta, 1)} %.`);
  return { T, rows, alloc, ccy: ccy.sort((a, b) => b.v - a.v), sectors: group(r => r.sector, k => k), effN, top, beta, vol, lev, verdicts };
}
