// NOVEX Börse – Beteiligungen & Übernahmen: Stimmrecht ab 25 %, Übernahmeangebot mit Prämie, Finanzierung aus Cash,
// Wertpapierkredit und LBO-Kredit, Rückzug von der Börse, eigene Unternehmen mit Strategien und späterem Börsengang.
import { M, hook, ENV, I, all, addNews, setWhy, recomputeDerived, closeDeriv, isOpen, book, logHist, availCash, roundQty, q2e, fmtE, fmt, pct, r2, clamp, gauss, dayStart, DAY, coEbit, coValue } from './engine.js';
import { addTradingDays, qLabel, scheduleReport } from './events.js';
import { BID_MIN_SHARE, LBO_SPREAD, LBO_MAX_X, LBO_MAX_SHARE, PE_STRATS } from './data.js';
import { macroRevFactor } from './macro.js';
import { peerMult, removeFromBaskets } from './company.js';

const listed = x => !!x && x.cls === 'stock' && !x.delisted && M.ids.includes(x.id);
export const shareOf = (A, x) => x && A.pos[x.id] ? A.pos[x.id].qty / x.shares : 0;

ENV.bidReq = x => bidReq(x); // für Insider-Einblicke (events.js)
hook('init', () => { if (!M.ma) M.ma = { bids: [] }; if (!M.sec) M.sec = {}; if (!M.sec.bid) M.sec.bid = {}; if (!M.sec.req) M.sec.req = {}; if (M.idsV === undefined) M.idsV = 0; });

/* ---------- Kennzahlen eines Ziels ---------- */
// Operativer Jahresgewinn (EBIT) und Umsatz aus den letzten vier Quartalen
export function targetFigures(x) {
  const h = x.fin ? x.fin.hist.slice(-4) : [], rev = h.length === 4 ? h.reduce((s, k) => s + k.rev, 0) : (x.fin ? x.fin.rev * 4 : x.shares * x.price / 2);
  const epsA = h.length === 4 ? h.reduce((s, k) => s + k.eps, 0) : x.eps, ebit = Math.max(0, epsA * x.shares * 1.3);
  return { rev, ebit, margin: rev > 0 ? ebit / rev : 0, mcap: x.shares * x.price };
}
export function lboMax(x, P) { const f = targetFigures(x); return Math.max(0, Math.min(LBO_MAX_X * f.ebit, LBO_MAX_SHARE * P * x.shares)); }
// Grobe Einschätzung, ohne Geheimwissen: Wie gut stehen die Chancen bei dieser Prämie?
export function bidOutlook(prem) { return prem < 0.15 ? { k: 'low', t: 'gering' } : prem < 0.22 ? { k: 'mid', t: 'unsicher' } : prem < 0.32 ? { k: 'good', t: 'gut' } : { k: 'high', t: 'sehr gut' }; }
export function quoteBid(A, x, prem, lbo) {
  const own = A.pos[x.id] ? A.pos[x.id].qty : 0, rem = x.shares - own, P = x.price * (1 + prem), cost = rem * P, fee = 0.01 * cost;
  const lmax = lboMax(x, P), l = clamp(lbo || 0, 0, Math.min(lmax, cost)), need = cost + fee - l, cash = Math.max(0, A.cash), avail = availCash(A);
  return { own, rem, P, cost, fee, lmax, lbo: l, need, fromCash: Math.min(cash, need), fromCredit: Math.max(0, need - cash), avail, ok: need <= avail + 1e-6, share: own / x.shares, total: P * x.shares };
}

/* ---------- Übernahmeangebot ---------- */
// Geheime Mindestprämie, ab der die Mehrheit der Aktionäre verkauft (wachstumsstarke Firmen verlangen mehr)
export function bidReq(x) {
  if (!M.sec.req) M.sec.req = {};
  if (M.sec.req[x.id] === undefined) M.sec.req[x.id] = clamp(0.15 + Math.random() * 0.17 + 0.1 * Math.max(0, (x.fin ? x.fin.g : 0) - 0.1) - (x.cD.length > 200 && x.price < 0.7 * Math.max(...x.cD.slice(-365).map(k => k[2])) ? 0.05 : 0), 0.08, 0.45);
  return M.sec.req[x.id];
}
export function placeBid(A, b) {
  const x = I(String(b.id)), prem = Number(b.prem), lbo = Number(b.lbo) || 0;
  if (!listed(x)) return 'Dieses Unternehmen ist nicht (mehr) an der Börse.';
  if (!M.isOpen) return 'Übernahmeangebote gibst du zu Börsenzeiten ab.';
  if (M.ma.bids.some(k => k.id === x.id)) return 'Für dieses Unternehmen läuft bereits ein Angebot.';
  if (M.ma.bids.some(k => k.uid === A.uid)) return 'Du hast schon ein laufendes Übernahmeangebot.';
  if (!(prem >= 0.05 && prem <= 0.8)) return 'Prämie: 5 bis 80 % auf den aktuellen Kurs.';
  if (A.bidCool && A.bidCool[x.id] > M.t) return 'Nach einem gescheiterten Angebot musst du vier Wochen warten.';
  if (shareOf(A, x) < BID_MIN_SHARE) return `Ein Übernahmeangebot setzt mindestens ${fmt(BID_MIN_SHARE * 100, 0)} % Beteiligung voraus.`;
  const q = quoteBid(A, x, prem, lbo);
  if (lbo > q.lmax + 1) return `Der LBO-Kredit ist auf ${fmtE(q.lmax, 0)} begrenzt (4,5 × EBIT, höchstens 60 % des Kaufpreises).`;
  if (!q.ok) return `Finanzierung reicht nicht: Du brauchst ${fmtE(q.need, 0)}, verfügbar sind ${fmtE(Math.max(0, q.avail), 0)} (inkl. Wertpapierkredit).`;
  const pre = x.price;
  const req = bidReq(x); delete M.sec.req[x.id];
  M.sec.bid[x.id] = { req };
  const until = dayStart(addTradingDays(M.t, 1)) + 8 * 60 * 60000;
  M.ma.bids.push({ uid: A.uid, name: A.name, id: x.id, prem, P: q.P, lbo: q.lbo, pre, t: M.t, until });
  // Arbitrage: Der Kurs springt in Richtung Angebotspreis, mit Abschlag für das Risiko des Scheiterns
  const pAcc = 1 / (1 + Math.exp(-(prem - req) / 0.05)), target = q.P * (0.9 + 0.07 * pAcc), j = Math.log(target / x.price);
  x.f *= Math.exp(j); x.tr = 0; x.price = x.f; setWhy(x, `${pct(j, 1)} nach Übernahmeangebot von ${A.name}`, j); recomputeDerived();
  addNews(`${A.name} bietet ${fmt(q.P, 2)} € je Aktie für ${x.name}`, 1, [x.id], { cat: 'ma', eff: j, sub: `Übernahmeangebot mit ${fmt(prem * 100, 0)} % Prämie, Gesamtwert ${fmtE(q.total, 0)}${q.lbo ? `, davon ${fmtE(q.lbo, 0)} über einen LBO-Kredit` : ''}. Die Annahmefrist endet zur nächsten Börseneröffnung. Gelingt die Übernahme (über 50 %), wird ${x.name} von der Börse genommen und alle Aktionäre bekommen ${fmt(q.P, 2)} €.` });
  ENV.note(A, `Übernahmeangebot für ${x.name} abgegeben: ${fmt(q.P, 2)} € je Aktie. Ergebnis zur nächsten Börseneröffnung.`, 'up'); ENV.dirty(A);
  return null;
}
hook('open', () => {
  if (!M.ma || !M.ma.bids.length) return;
  const accts = [...ENV.accounts()];
  for (const b of [...M.ma.bids]) {
    if (M.t < b.until) continue;
    M.ma.bids.splice(M.ma.bids.indexOf(b), 1);
    const x = I(b.id), A = accts.find(a => a.uid === b.uid), sec = M.sec.bid[b.id] || { req: 0.25 }; delete M.sec.bid[b.id];
    if (!listed(x)) continue;
    if (!A) { revert(x, b); continue; }
    const accept = clamp(1 / (1 + Math.exp(-(b.prem - sec.req) / 0.035)) + 0.05 * gauss(), 0, 1);
    const own = A.pos[x.id] ? A.pos[x.id].qty : 0, rem = x.shares - own, reach = (own + accept * rem) / x.shares;
    const cost = rem * b.P, fee = 0.01 * cost, need = cost + fee - b.lbo;
    if (reach >= 0.501 && own / x.shares >= BID_MIN_SHARE * 0.5 && need <= availCash(A) + 1e-6) complete(A, x, b, accts, accept);
    else fail(A, x, b, reach < 0.501 ? `Nur ${fmt(reach * 100, 1)} % der Aktien wurden angedient – nötig sind 50,1 %.` : 'Die Finanzierung reichte zum Stichtag nicht mehr aus.');
  }
});
function revert(x, b) { const j = 0.85 * Math.log(b.pre / x.price); x.f *= Math.exp(j); x.price = x.f * Math.exp(x.tr); setWhy(x, `${pct(j, 1)} – Übernahme geplatzt`, j); recomputeDerived(); return j; }
function fail(A, x, b, why) {
  const j = revert(x, b), fee = r2(0.003 * b.P * x.shares);
  A.cash -= fee; ENV.fee(fee); book(A, 'fee', -fee, `Beraterkosten Übernahme ${x.name}`);
  (A.bidCool || (A.bidCool = {}))[x.id] = M.t + 28 * DAY;
  addNews(`Übernahme von ${x.name} gescheitert`, -1, [x.id], { cat: 'ma', eff: j, sub: `${why} Der Kurs fällt zurück.` });
  ENV.note(A, `Übernahme von ${x.name} gescheitert. ${why} Beraterkosten: ${fmtE(fee)}`, 'dn'); ENV.dirty(A);
}
function complete(A, x, b, accts, accept) {
  const P = b.P; x.f = P; x.tr = 0; x.price = P;
  // Alle anderen Aktionäre werden ausgezahlt (Squeeze-out), Hebelprodukte und Orders aufgelöst
  for (const B of accts) {
    for (const p of [...B.derivs]) if (p.und === x.id) closeDeriv(B, p.pid, 1, 'Übernahme');
    for (const o of B.orders) if (o.iid === x.id && isOpen(o)) { o.status = 'gestrichen'; o.note = 'Wert von der Börse genommen'; }
    B.plans = (B.plans || []).filter(pl => pl.iid !== x.id);
    const p = B.pos[x.id];
    if (B !== A && p) {
      const amt = r2(p.qty * P), pnl = amt - p.cost; B.cash += amt; B.realized += pnl; book(B, 'pnl', pnl, `Übernahme ${x.name}`);
      logHist(B, { t: M.t, id: x.id, nm: x.name, side: 'Squeeze-out', q: p.qty, px: P, amt, fee: 0, pnl }); delete B.pos[x.id];
      ENV.note(B, `${x.name} wurde übernommen: Deine Aktien wurden zu ${fmt(P, 2)} € abgefunden (${fmtE(amt)}).`, pnl >= 0 ? 'up' : 'dn');
    }
    ENV.dirty(B);
  }
  const own = A.pos[x.id] || { qty: 0, cost: 0 }, rem = x.shares - own.qty, cost = rem * P, fee = r2(0.01 * cost);
  delete A.pos[x.id];
  A.cash -= r2(cost + fee - b.lbo); ENV.fee(fee);
  book(A, 'fee', -fee, `Übernahmeberatung ${x.name}`); book(A, 'ma', -r2(cost - b.lbo), `Kauf ${x.name} (Eigenanteil)`);
  logHist(A, { t: M.t, id: x.id, nm: x.name, side: 'Übernahme', q: rem, px: P, amt: r2(cost), fee, pnl: null });
  removeFromBaskets(x.id); // Index, ETFs und Fonds bereinigen, ohne Sprung im Kurs
  if (M.sec.pre) delete M.sec.pre[x.id];
  if (M.sec.rumors) M.sec.rumors = M.sec.rumors.filter(r => r.id !== x.id);
  if (M.sec.pol) for (const e of M.sec.pol) if (e.id2 === x.id) e.done = true;
  M.ids = M.ids.filter(id => id !== x.id); x.delisted = { t: M.t, by: A.name, P }; x.gov = null; M.idsV++;
  recomputeDerived();
  // Eigenes Unternehmen anlegen
  const f = targetFigures(x), m = f.ebit > 0 && f.rev > 0 ? clamp(f.margin, 0.02, 0.6) : 0.03, ebit = f.rev * m;
  const co = { id: x.id, name: x.name, sector: x.sector, shares: x.shares, rev: f.rev, m, mBase: m, g: clamp(x.fin ? x.fin.g : 0.03, -0.05, 0.3), debt: b.lbo, spread: LBO_SPREAD, rate: (M.lz || 0) + LBO_SPREAD, mult: ebit > 0 ? (P * x.shares) / ebit : 10, cost: r2(own.cost + cost + fee - b.lbo), t0: M.t, next: dayStart(addTradingDays(M.t, 91)), q: [], st: null, qs: 0, neg: 0, spec: -1, P };
  A.pe.push(co);
  addNews(`${A.name} übernimmt ${x.name} und nimmt das Unternehmen von der Börse`, 1, [x.id], { cat: 'ma', sub: `${fmt(accept * 100, 0)} % der freien Aktionäre haben angedient. Alle übrigen Aktien werden zu ${fmt(P, 2)} € abgefunden. ${x.name} verlässt Index, ETFs und Fonds.` });
  ENV.note(A, `Übernahme geglückt! ${x.name} gehört jetzt dir – zu finden unter „Unternehmen“.`, 'tier'); ENV.event(A, 'takeover', { id: x.id }); ENV.dirty(A);
}

/* ---------- Stimmrecht (ab 25 %) ---------- */
export function vote(A, id, v) {
  const x = I(String(id)); if (!listed(x)) return 'Unternehmen nicht gefunden.';
  if (shareOf(A, x) < 0.25) return 'Abstimmen kannst du ab 25 % Beteiligung (Sperrminorität).';
  if (!['div', 'bal', 're'].includes(v)) return 'Ungültige Wahl.';
  x.gov = v === 'bal' ? null : { pay: v, by: A.name, t: M.t };
  const txt = v === 'div' ? 'höhere Ausschüttung (Dividende × 1,8, etwas weniger Wachstum)' : v === 're' ? 'Reinvestition (Dividende × 0,3, mehr Wachstum)' : 'ausgewogene Ausschüttung';
  addNews(`Hauptversammlung ${x.name}: Großaktionär ${A.name} setzt ${v === 'div' ? 'höhere Dividende' : v === 're' ? 'Reinvestition der Gewinne' : 'ausgewogene Gewinnverwendung'} durch`, 0, [x.id], { cat: 'ma', sub: `Gilt ab den nächsten Quartalszahlen: ${txt}.` });
  ENV.note(A, `Abstimmung durchgesetzt: ${txt}`, 'up'); ENV.dirty(A); return null;
}

/* ---------- Eigene Unternehmen ---------- */
hook('open', () => { for (const A of ENV.accounts()) if (A.pe && A.pe.length) for (const co of [...A.pe]) if (M.t >= co.next) quarter(A, co); });
function quarter(A, co) {
  const x = M.inst[co.id] || { id: co.id, sector: co.sector, vol: 0.3 };
  const padj = clamp(x.padj || 0, -0.5, 0.5); x.padj = 0; co.m *= 1 + padj; co.mBase *= 1 + padj;
  let gq = co.g / 4 + macroRevFactor(x) + 0.02 * gauss(), one = 0; const st = co.st;
  if (st) {
    if (st.k === 'cost') { if (st.q < 2) co.mBase += 0.02; if (st.q === 0) one = 0.02 * co.rev; if (st.q < 4) gq -= 0.03 / 4; }
    else if (st.k === 'rnd') { if (st.q < 3) co.mBase -= 0.01; if (st.q === 3) { co.mBase += 0.03; st.ok = Math.random() < 0.7; } if (st.q >= 3 && st.q < 9) gq += (st.ok ? 0.06 : 0.01) / 4; }
    else if (st.k === 'price') { if (st.q === 0) co.mBase += 0.03; if (st.q < 4) gq -= 0.02 / 4 + (M.mac && M.mac.conf < -15 ? 0.03 / 4 : 0); }
    st.q++; if ((st.k === 'cost' && st.q >= 4) || (st.k === 'rnd' && st.q >= 9) || (st.k === 'price' && st.q >= 4)) co.st = null;
  }
  co.rev *= Math.exp(gq); co.m = clamp(co.m + 0.4 * (co.mBase - co.m) + 0.003 * gauss(), -0.1, 0.7);
  co.rate = (M.lz || 0) + co.spread;
  const revQ = co.rev / 4, ebitQ = revQ * co.m, intQ = co.debt * co.rate / 4, pre = ebitQ - intQ - one, tax = 0.25 * Math.max(0, pre), ni = pre - tax;
  const fcf = ni > 0 ? ni * 0.85 : ni, amort = fcf > 0 ? Math.min(co.debt, fcf * 0.6) : 0;
  co.debt = Math.max(0, co.debt - amort + (fcf < 0 ? -fcf : 0));
  const div = fcf > 0 ? r2(fcf - amort) : 0;
  if (div >= 0.01) { A.cash += div; book(A, 'pe', div, `Ausschüttung ${co.name}`); }
  // Nicht börsennotiert und klein: Abschlag gegenüber großen Konkurrenten (Illiquidität), Zuschlag für Wachstum
  const tgt = clamp(peerMult(co.sector) * 0.65 * (1 + 2 * (co.g - 0.05)), 4, 30); co.mult += 0.25 * (tgt - co.mult);
  const val = coValue(co);
  co.q.push({ q: qLabel(M.t - 45 * DAY), t: M.t, rev: revQ, ebit: ebitQ, int: intQ, ni, div, debt: co.debt, val, m: co.m }); if (co.q.length > 12) co.q.shift();
  co.qs++; co.next = dayStart(addTradingDays(M.t, 91));
  if (val <= 0) co.neg++; else co.neg = 0;
  if (co.neg >= 2) {
    A.pe.splice(A.pe.indexOf(co), 1);
    addNews(`${co.name} meldet Insolvenz an`, -1, [], { cat: 'ma', sub: 'Die Schulden aus der Übernahme waren nicht mehr tragbar. Der Eigentümer verliert seinen Einsatz.' });
    ENV.note(A, `${co.name} ist insolvent – deine Beteiligung ist verloren. Die LBO-Schulden trägt das Unternehmen, nicht du.`, 'dn');
  } else ENV.note(A, `${co.name}: Quartal abgeschlossen – EBIT ${fmtE(ebitQ, 0)}, Ausschüttung ${fmtE(div, 0)}, Schulden ${fmtE(co.debt, 0)}`, div > 0 ? 'div' : '');
  ENV.dirty(A);
}
export function setStrategy(A, coId, k) {
  const co = (A.pe || []).find(c => c.id === coId); if (!co) return 'Unternehmen nicht gefunden.';
  if (!PE_STRATS[k]) return 'Unbekannte Strategie.';
  if (k === 'special') {
    if (co.spec === co.qs) return 'Eine Sonderdividende ist einmal je Quartal möglich.';
    const add = r2(Math.max(0, 3.5 * coEbit(co) - co.debt)); if (add < 1000) return 'Kein Spielraum: Die Schulden liegen schon bei 3,5 × EBIT.';
    co.debt += add; co.spec = co.qs; A.cash += add; book(A, 'pe', add, `Sonderdividende ${co.name}`);
    ENV.note(A, `${co.name} schüttet ${fmtE(add)} Sonderdividende aus (kreditfinanziert).`, 'div'); ENV.dirty(A); return null;
  }
  if (co.st) return `Es läuft bereits: ${PE_STRATS[co.st.k].name}.`;
  co.st = { k, q: 0 }; ENV.note(A, `${co.name}: ${PE_STRATS[k].name} beschlossen – wirkt ab dem nächsten Quartal.`, 'up'); ENV.dirty(A); return null;
}
export function ipoQuote(co, frac) { const V = coValue(co), px = V / co.shares * 0.93, gross = frac * co.shares * px, fee = 0.03 * gross; return { V, px, gross, fee, net: gross - fee, cost: co.cost * frac }; }
export function ipo(A, coId, frac) {
  const co = (A.pe || []).find(c => c.id === coId); if (!co) return 'Unternehmen nicht gefunden.';
  if (!M.isOpen) return 'Ein Börsengang findet zu Börsenzeiten statt.';
  if (co.qs < 1) return 'Führe das Unternehmen mindestens ein Quartal, bevor du es an die Börse bringst.';
  frac = Number(frac); if (!(frac >= 0.25 && frac <= 1)) return 'Platziere zwischen 25 % und 100 % der Aktien.';
  const q = ipoQuote(co, frac); if (!(q.px > 0.01)) return 'Das Unternehmen hat aktuell keinen positiven Eigenkapitalwert.';
  const x = M.inst[co.id]; if (!x) return 'Unternehmen nicht gefunden.';
  A.cash += r2(q.net); ENV.fee(r2(q.fee));
  const pnl = r2(q.net - q.cost); A.realized += pnl; book(A, 'pnl', pnl, `Börsengang ${co.name}`);
  logHist(A, { t: M.t, id: x.id, nm: x.name, side: 'Börsengang', q: frac * co.shares, px: q.px, amt: r2(q.net), fee: r2(q.fee), pnl });
  // Wieder an die Börse: Kurs, Gewinne und Quartalstermine neu setzen
  const ebitA = coEbit(co), niA = (ebitA - co.debt * co.rate) * 0.75;
  Object.assign(x, { delisted: null, gov: null, f: q.px, tr: 0, price: q.px, liq: 1, eps: niA / co.shares, do: q.px, pc: q.px, hi: q.px, lo: q.px, lc: q.px, dv: 0, dt: 0, padj: 0 });
  if (x.fin) { x.fin.rev = co.rev / 4; x.fin.eps = niA / co.shares / 4; x.fin.g = co.g; x.fin.fv = (x.fin.fv || 0) + 1; scheduleReport(x); }
  M.ids.push(x.id); M.idsV++;
  if (frac < 1) A.pos[x.id] = { qty: roundQty(x, (1 - frac) * co.shares), cost: r2(co.cost * (1 - frac)), t0: M.t };
  A.pe.splice(A.pe.indexOf(co), 1);
  setWhy(x, `Börsengang zu ${fmt(q.px, 2)} €`, 0);
  addNews(`Börsengang: ${x.name} kehrt an die NOVEX zurück`, 1, [x.id], { cat: 'ma', sub: `${A.name} platziert ${fmt(frac * 100, 0)} % der Aktien zu ${fmt(q.px, 2)} € (Bewertung ${fmtE(q.V, 0)}, ${fmt(q.V / co.P / co.shares * 100 - 100, 0)} % gegenüber dem Übernahmepreis).` });
  ENV.note(A, `Börsengang geglückt: ${fmtE(q.net)} Erlös, ${pnl >= 0 ? 'Gewinn' : 'Verlust'} ${fmtE(pnl)}`, pnl >= 0 ? 'tier' : 'dn'); ENV.event(A, 'ipo'); ENV.dirty(A);
  return null;
}
