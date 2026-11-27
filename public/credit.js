// NOVEX Börse – Kredite: Wertpapierkredit (Lombard) mit Live-Monitor und Margin Call, Unternehmenskredit nach Bonität.
import { M, hook, ENV, I, CCYS, ccyEur, totals, book, executeMarket, roundQty, posValue, isTradable, lombardValue, ltvOf, availCash, creditRate, applyTrade, avgRatio, fmtE, fmt, r2, MIN, YR, LTV_FX, LTV_DEP, coEbit } from './engine.js';
import { TIERS } from './data.js';
import { FX_PAIR } from './wealth.js';

export const MC_AT = 1.0;        // Margin Call: Kredit über dem Beleihungswert
export const MC_HARD = 1.25;     // Notverkauf sofort
export const MC_TARGET = 0.85;   // nach einer Liquidation
export const MC_WARN = 0.75;     // Bernstein-Warnung
export const MC_MINUTES = 240;   // Reaktionsfrist in Handelsminuten

/* ---------- Monitor ---------- */
export function creditInfo(A) {
  const lv = lombardValue(A), debt = Math.max(0, -A.cash), use = lv > 0 ? debt / lv : debt > 0 ? Infinity : 0;
  // Puffer: um wie viel % darf der beliehene Bestand fallen, bevor der Kredit den Beleihungswert übersteigt?
  const buffer = debt > 0 && lv > 0 ? Math.max(0, 1 - debt / lv) : 1;
  const status = !(debt > 0) ? 'none' : use >= MC_AT ? 'call' : use >= 0.9 ? 'critical' : use >= MC_WARN ? 'warn' : 'ok';
  return { lv, debt, use, buffer, bufferEur: Math.max(0, lv - debt), rate: creditRate(A), status, mc: A.mc, on: !!A.credit, avail: A.credit ? Math.max(0, lv - debt) : 0 };
}
// Zeilen für die Tabelle: Wert, Quote, Beleihungswert je Position
export function collateralRows(A) {
  const rows = [];
  for (const id in A.pos) { const x = I(id); if (!x) continue; const v = posValue(id, A.pos[id]), q = ltvOf(x); rows.push({ id, name: x.name, v, q, lv: v * q }); }
  for (const c of CCYS) if (A.fxc && A.fxc[c] > 0) { const v = A.fxc[c] * ccyEur(c); rows.push({ id: '', name: `Fremdwährung ${c}`, v, q: LTV_FX, lv: v * LTV_FX }); }
  for (const d of A.deps || []) rows.push({ id: '', name: `Festgeld ${d.months} Monate`, v: d.amt, q: LTV_DEP, lv: d.amt * LTV_DEP });
  return rows.sort((a, b) => b.lv - a.lv);
}

/* ---------- Margin Call ---------- */
hook('step', dtMs => {
  for (const A of ENV.accounts()) {
    if (!A.agg) continue;
    const debt = -A.cash;
    if (!(debt > 0.5)) { if (A.mc) { A.mc = null; ENV.note(A, 'Margin Call erledigt: Dein Kredit ist getilgt.', 'up'); ENV.dirty(A); } continue; }
    const lv = lombardValue(A), use = lv > 0 ? debt / lv : Infinity;
    if (use >= MC_HARD) { liquidate(A, 'Notverkauf: Kredit lag über 125 % des Beleihungswerts'); A.mc = null; ENV.dirty(A); continue; }
    if (use >= MC_AT) {
      if (!A.mc) { A.mc = { t: M.t, left: MC_MINUTES, need: r2(debt - lv) }; ENV.note(A, `Margin Call! Dein Kredit (${fmtE(debt)}) übersteigt den Beleihungswert (${fmtE(lv)}). Bring ${fmtE(debt - lv)} auf oder verkaufe Positionen – sonst verkauft die Bank in ${MC_MINUTES / 60} Handelsstunden.`, 'dn'); ENV.event(A, 'margincall'); ENV.dirty(A); }
      else { A.mc.left -= dtMs / MIN; A.mc.need = r2(debt - lv); if (A.mc.left <= 0) { liquidate(A, 'Frist des Margin Calls abgelaufen'); A.mc = null; } ENV.dirty(A); }
    } else if (A.mc) { A.mc = null; ENV.note(A, 'Margin Call aufgehoben: Der Kredit ist wieder gedeckt.', 'up'); ENV.dirty(A); }
  }
});
// Teil-Liquidation: zuerst Werte mit niedriger Beleihungsquote (sie senken die Schuld, ohne viel Beleihungswert zu kosten)
export function liquidate(A, reason) {
  let guard = 0, sold = 0;
  while (guard++ < 25) {
    const debt = -A.cash, lv = lombardValue(A); if (!(debt > 0) || debt <= MC_TARGET * lv + 0.5) break;
    const cand = Object.keys(A.pos).map(id => I(id)).filter(x => x && isTradable(x) && A.pos[x.id].qty > 0).sort((a, b) => ltvOf(a) - ltvOf(b) || posValue(b.id, A.pos[b.id]) - posValue(a.id, A.pos[a.id]))[0];
    if (!cand) { if (!sellFx(A)) break; continue; }
    const L = ltvOf(cand), need = (debt - MC_TARGET * lv) / Math.max(0.15, 1 - MC_TARGET * L), unit = posValue(cand.id, { qty: 1 });
    const q = Math.min(A.pos[cand.id].qty, roundQty(cand, need / unit * 1.03 + (cand.cls === 'bond' ? 999 : 0)) || A.pos[cand.id].qty);
    const e = q > 0 ? executeMarket(A, cand, 'sell', q, { label: 'Zwangsverkauf' }) : null; if (!e) break;
    sold += e.total; ENV.note(A, `${reason}: ${cand.name} für ${fmtE(e.total)} verkauft`, 'dn');
  }
  return sold;
}
function sellFx(A) {
  for (const c of CCYS) if (A.fxc[c] > 1) {
    const pair = I(FX_PAIR[c]); if (!pair) continue; const amt = A.fxc[c], Q = amt / pair.price, r = avgRatio(pair, 1, Q), got = amt / (pair.price * r);
    const cost = A.fxCost[c]; A.fxc[c] = 0; A.fxCost[c] = 0; A.cash += got; book(A, 'fx', got - cost, `${c} zwangsgetauscht`); applyTrade(pair, 1, Q, true);
    ENV.note(A, `Margin Call: ${fmt(amt, 2)} ${c} in ${fmtE(got)} getauscht`, 'dn'); return true;
  }
  const d = (A.deps || []).shift(); if (d) { A.cash += d.amt; ENV.note(A, `Margin Call: Festgeld (${fmtE(d.amt)}) vorzeitig aufgelöst – ohne Zinsen`, 'dn'); return true; }
  return false;
}
export function setCredit(A, on) {
  if (!on && A.cash < 0) return 'Zahle zuerst den Kredit zurück (Verrechnungskonto ins Plus bringen).';
  A.credit = !!on; ENV.dirty(A); return null;
}

/* ---------- Unternehmenskredit ---------- */
const RATINGS = [['AAA', 0.10, 0.010], ['AA', 0.20, 0.013], ['A', 0.35, 0.017], ['BBB', 0.50, 0.023], ['BB', 0.65, 0.035], ['B', Infinity, 0.055]];
// Laufender Cashflow: passive Einnahmen der letzten 12 Monate + operative Gewinne eigener Unternehmen (abzüglich Zinsen)
export function cashflowOf(A) {
  const from = M.t - YR; let cf = 0;
  for (const f of A.flows || []) if (f.t >= from && (f.cat === 'div' || f.cat === 'int' || f.cat === 'cpn')) cf += f.amt;
  for (const co of A.pe || []) cf += 0.5 * Math.max(0, coEbit(co) - co.debt * co.rate);
  return cf;
}
export function bonity(A) {
  const T = totals(A), lev = T.gross > 0 ? T.debt / T.gross : 1, cf = cashflowOf(A);
  const intA = Math.max(0, -A.cash) * creditRate(A) + (A.loans || []).reduce((s, l) => s + l.amt * ((M.lz || 0) + l.spread), 0);
  let k = RATINGS.findIndex(r => lev < r[1]); if (intA > 0 && cf / intA < 1.5) k = Math.min(RATINGS.length - 1, k + 1);
  const tier = TIERS[A.tierMax || 0] || TIERS[0], liquid = Math.max(0, A.cash) + T.sec + T.fxv + T.dep;
  const limit = Math.max(0, Math.min(tier.acq * Math.max(0, T.total), 8 * cf + 0.3 * liquid) - (A.loans || []).reduce((s, l) => s + l.amt, 0));
  return { rating: RATINGS[k][0], spread: RATINGS[k][2], lev, cf, intA, cover: intA > 0 ? cf / intA : Infinity, limit, unlocked: tier.acq > 0 };
}
export function drawLoan(A, amt) {
  const b = bonity(A);
  if (!b.unlocked) return 'Unternehmenskredite gibt es ab der Stufe „Fondsmanager“ (250.000 € Vermögen).';
  if (!(typeof amt === 'number' && isFinite(amt) && amt >= 10000)) return 'Kreditbetrag: mindestens 10.000 €.';
  if (amt > b.limit + 0.01) return `Dein Kreditrahmen liegt bei ${fmtE(b.limit)} (Bonität ${b.rating}). Er hängt an Vermögen und laufendem Cashflow.`;
  const l = { id: A.seq++, amt: r2(amt), spread: b.spread, rating: b.rating, t0: M.t };
  A.loans.push(l); A.cash += l.amt; book(A, 'loan', l.amt, `Unternehmenskredit (${b.rating})`);
  ENV.note(A, `Unternehmenskredit über ${fmtE(l.amt)} ausgezahlt – Zins: Leitzins + ${fmt(b.spread * 100, 1)} %`, 'up'); ENV.dirty(A); return null;
}
export function repayLoan(A, id, amt) {
  const l = (A.loans || []).find(k => k.id === id); if (!l) return 'Kredit nicht gefunden.';
  if (!(typeof amt === 'number' && isFinite(amt) && amt > 0)) return 'Ungültiger Betrag.';
  amt = r2(Math.min(amt, l.amt));
  if (amt > availCash(A, undefined, true) + 1e-6) return `Nicht genug freies Guthaben (verfügbar ${fmtE(Math.max(0, availCash(A, undefined, true)))}).`;
  A.cash -= amt; l.amt = r2(l.amt - amt); book(A, 'loan', -amt, 'Tilgung Unternehmenskredit');
  if (l.amt < 0.01) A.loans.splice(A.loans.indexOf(l), 1);
  ENV.note(A, `${fmtE(amt)} getilgt`, 'up'); ENV.dirty(A); return null;
}
// Festgeld vorzeitig auflösen (ohne Zinsen) – z. B. um einen Margin Call zu bedienen
export function breakDeposit(A, id) {
  const d = (A.deps || []).find(k => k.id === id); if (!d) return 'Festgeld nicht gefunden.';
  A.deps.splice(A.deps.indexOf(d), 1); A.cash += d.amt;
  ENV.note(A, `Festgeld vorzeitig aufgelöst: ${fmtE(d.amt)} zurück aufs Verrechnungskonto (ohne Zinsen)`, ''); ENV.dirty(A); return null;
}
