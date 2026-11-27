// NOVEX Börse – Absicherung & Auto-Orders: Stop-Loss, Take-Profit und Trailing-Stop für bestehende Positionen.
// Die Menge wird als Anteil der Position gespeichert: Verkaufst du vorher Anteile, schrumpft die Auto-Order mit (keine „Geister-Orders“).
// OCO (One-Cancels-the-Other): Löst eine Order der Gruppe aus, werden die anderen derselben Position gestrichen.
import { M, hook, ENV, I, executeMarket, closeDeriv, roundQty, reservedUnits, isTradable, derivName, ccyEur, CCYS, fmt, fmtE, fmtQty, fmtPx, r2 } from './engine.js';
import { exchange } from './wealth.js';

export const AUTO_KINDS = { sl: 'Stop-Loss', tp: 'Take-Profit', tr: 'Trailing-Stop' };
const MAX_PER = 5, MAX_ALL = 40;

/* ---------- Ziele: Wertpapier, Hebelprodukt (auf den Basiswert), Fremdwährung ---------- */
// Warum ein Produkt keine Auto-Orders kennt (oder null, wenn es geht)
export function autoBlocked(x) {
  if (!x) return 'Nicht gefunden.';
  if (x.delisted) return 'Nicht mehr an der Börse – für eigene Unternehmen gibt es keinen Börsenkurs, auf den eine Stop-Order reagieren könnte.';
  if (x.cls === 'fund') return 'Fonds werden nur einmal täglich zum Inventarwert abgerechnet. Stop-Orders setzen einen laufenden Börsenkurs voraus.';
  if (x.cls === 'bond' && x.matured) return 'Die Anleihe ist getilgt.';
  if (!isTradable(x)) return 'Für dieses Produkt gibt es keine Auto-Orders.';
  return null;
}
export function autoTarget(A, o) {
  if (o.tg === 'pos') { const x = I(o.ref), p = A.pos[o.ref]; return x && p && p.qty > 0 && !autoBlocked(x) ? { x, px: x.price, qty: p.qty, name: x.name, fmtP: v => fmtPx(x, v) } : null; }
  if (o.tg === 'der') { const p = A.derivs.find(d => String(d.pid) === String(o.ref)); if (!p) return null; const u = I(p.und); return u ? { x: u, px: u.price, qty: 1, name: derivName(p), fmtP: v => fmtPx(u, v), der: p } : null; }
  if (o.tg === 'fx') { const c = o.ref; return CCYS.includes(c) && A.fxc[c] > 0.005 ? { x: null, px: ccyEur(c), qty: A.fxc[c], name: `${c}-Guthaben`, fmtP: v => fmt(v, 4) + ' €', ccy: c } : null; }
  return null;
}
// Auslöseschwelle (bei Trailing aus dem bisherigen Hoch)
export const trigOf = o => o.k === 'tr' ? (o.tm === 'pct' ? o.hi * (1 - o.dist) : o.hi - o.dist) : o.trig;
const hit = (o, px) => o.k === 'tp' ? px >= trigOf(o) : px <= trigOf(o);

/* ---------- Anlegen, Ändern, Löschen ---------- */
export function setAuto(A, b) {
  if (!A.auto) A.auto = [];
  const tg = b.tg, ref = String(b.ref || ''), k = b.k, f = Number(b.f), oco = !!b.oco;
  if (!['pos', 'der', 'fx'].includes(tg)) return 'Ungültiges Ziel.';
  if (!AUTO_KINDS[k]) return 'Unbekannte Order-Art.';
  if (tg === 'pos') { const why = autoBlocked(I(ref)); if (why) return why; }
  const T = autoTarget(A, { tg, ref }); if (!T) return 'Diese Position hast du nicht (mehr) im Depot.';
  if (!(f > 0 && f <= 1)) return 'Menge: zwischen 1 % und 100 % der Position.';
  const o = { id: 0, tg, ref, k, f: Math.round(f * 1e4) / 1e4, oco, t: M.t };
  if (k === 'tr') {
    o.tm = b.tm === 'abs' ? 'abs' : 'pct'; o.dist = Number(b.dist); o.hi = T.px;
    if (o.tm === 'pct' ? !(o.dist >= 0.005 && o.dist <= 0.5) : !(o.dist > 0 && o.dist < T.px * 0.5)) return o.tm === 'pct' ? 'Abstand: 0,5 % bis 50 %.' : 'Abstand: größer als 0 und höchstens die Hälfte des Kurses.';
  } else {
    o.trig = Number(b.trig); if (!(o.trig > 0 && isFinite(o.trig))) return 'Bitte einen Zielkurs angeben.';
    if (k === 'sl' && o.trig >= T.px) return `Der Stop-Loss muss unter dem aktuellen Kurs (${T.fmtP(T.px)}) liegen – sonst würde sofort verkauft.`;
    if (k === 'tp' && o.trig <= T.px) return `Das Kursziel muss über dem aktuellen Kurs (${T.fmtP(T.px)}) liegen.`;
  }
  const same = A.auto.filter(a => a.tg === tg && a.ref === ref);
  if (b.id) { // bearbeiten: alte Order ersetzen, Trailing-Hoch beibehalten, wenn Art und Modus gleich bleiben
    const old = A.auto.find(a => a.id === Number(b.id)); if (!old) return 'Order nicht gefunden.';
    if (old.k === 'tr' && k === 'tr' && old.tm === o.tm) o.hi = Math.max(old.hi, T.px);
    o.id = old.id; A.auto[A.auto.indexOf(old)] = o;
  } else {
    if (same.length >= MAX_PER) return `Höchstens ${MAX_PER} Auto-Orders je Position.`;
    if (A.auto.length >= MAX_ALL) return `Höchstens ${MAX_ALL} Auto-Orders insgesamt.`;
    o.id = A.seq++; A.auto.push(o);
  }
  ENV.note(A, `${AUTO_KINDS[k]} ${b.id ? 'geändert' : 'eingerichtet'}: ${T.name}, ${k === 'tr' ? `${o.tm === 'pct' ? fmt(o.dist * 100, 1) + ' %' : T.fmtP(o.dist)} unter dem Hoch (jetzt ${T.fmtP(trigOf(o))})` : `bei ${T.fmtP(o.trig)}`}, ${fmt(o.f * 100, 0)} % der Position`, 'up');
  ENV.dirty(A); return null;
}
export function delAuto(A, id) {
  const i = (A.auto || []).findIndex(a => a.id === Number(id)); if (i < 0) return 'Order nicht gefunden.';
  A.auto.splice(i, 1); ENV.dirty(A); return null;
}
// Orders ohne Position entfernen (nach Verkauf, Knock-out, Übernahme …)
export function cleanAuto(A) {
  if (!A.auto || !A.auto.length) return false;
  const n = A.auto.length; A.auto = A.auto.filter(o => autoTarget(A, o)); return A.auto.length !== n;
}

/* ---------- Ausführung bei jedem Markt-Schritt ---------- */
hook('step', () => {
  for (const A of ENV.accounts()) {
    if (!A.auto || !A.auto.length) continue;
    if (cleanAuto(A)) ENV.dirty(A);
    for (const o of [...A.auto]) {
      if (!A.auto.includes(o)) continue;               // durch OCO bereits gestrichen
      const T = autoTarget(A, o); if (!T) continue;
      if (o.k === 'tr' && T.px > o.hi) { o.hi = T.px; o.dirt = (o.dirt || 0) + 1; if (o.dirt % 20 === 0) ENV.dirty(A); } // Trailing-Hoch nachziehen (gespeichert wird gebündelt)
      if (hit(o, T.px)) fire(A, o, T);
    }
  }
});
function fire(A, o, T) {
  const trig = trigOf(o), gap = o.k === 'tp' ? T.px > trig * 1.005 : T.px < trig * 0.995, label = AUTO_KINDS[o.k];
  let res = null, txt = '';
  if (o.tg === 'pos') {
    const x = T.x, avail = A.pos[x.id].qty - reservedUnits(A, x.id); let q = o.f >= 0.9999 ? avail : roundQty(x, A.pos[x.id].qty * o.f);
    if (!(q > 0)) q = Math.min(avail, A.pos[x.id].qty); q = Math.min(q, avail);
    if (q > 0) { const e = executeMarket(A, x, 'sell', q, { label }); if (e) { res = e; txt = `${fmtQty(x, e.q)} ${x.name} zu ${fmtPx(x, e.px)} verkauft – Erlös ${fmtE(e.total)}`; } }
  } else if (o.tg === 'der') {
    const before = A.cash, err = closeDeriv(A, T.der.pid, o.f >= 0.9999 ? 1 : o.f, label);
    if (!err) { res = { total: A.cash - before }; txt = `${T.name} ${o.f >= 0.9999 ? 'geschlossen' : 'zu ' + fmt(o.f * 100, 0) + ' % geschlossen'} – Erlös ${fmtE(res.total)}`; }
  } else {
    const amt = r2(A.fxc[T.ccy] * o.f), before = A.cash, err = amt >= 10 ? exchange(A, T.ccy, 'EUR', amt) : 'Betrag zu klein.';
    if (!err) { res = { total: A.cash - before }; txt = `${fmt(amt, 2)} ${T.ccy} in ${fmtE(res.total)} getauscht`; }
  }
  A.auto.splice(A.auto.indexOf(o), 1);
  if (!res) { ENV.note(A, `${label} für ${T.name} konnte nicht ausgeführt werden und wurde gestrichen.`, 'dn'); ENV.dirty(A); return; }
  if (o.oco) A.auto = A.auto.filter(a => !(a.oco && a.tg === o.tg && a.ref === o.ref));
  cleanAuto(A);
  const gapTxt = gap ? ` Kurslücke: Der Kurs ${o.k === 'tp' ? 'sprang über' : 'fiel unter'} deine Schwelle von ${T.fmtP(trig)} direkt auf ${T.fmtP(T.px)} – ausgeführt zum nächsten Marktpreis.` : '';
  ENV.note(A, `${label} ausgelöst: ${txt}.${gapTxt}`, o.k === 'tp' ? 'up' : 'dn');
  feed(A, { t: M.t, ids: T.x ? [T.x.id] : [], txt: `${label} ausgelöst: ${T.name}`, sub: `${txt}.${gapTxt}`, eff: null });
  ENV.event(A, 'auto', { k: o.k }); ENV.dirty(A);
}
// Persönliche Meldungen (erscheinen im News-Feed unter „Mein Portfolio“)
export function feed(A, n) { if (!A.feed) A.feed = []; A.feed.unshift(Object.assign({ n: -M.t, cat: 'mine', own: true }, n)); if (A.feed.length > 30) A.feed.length = 30; }

/* ---------- Vorschau (Browser): Menge, Erlös, Gewinn/Verlust ---------- */
export function autoPreview(A, o) {
  const T = autoTarget(A, o); if (!T) return null;
  const trig = o.k === 'tr' ? (o.tm === 'pct' ? T.px * (1 - o.dist) : T.px - o.dist) : o.trig;
  if (o.tg === 'pos') {
    const x = T.x, p = A.pos[x.id], q = o.f >= 0.9999 ? p.qty : roundQty(x, p.qty * o.f), unit = x.cls === 'bond' ? (trig + x.acc) / 100 : trig;
    const buyIn = x.cls === 'bond' ? p.cost / p.qty * 100 : p.cost / p.qty, val = q * unit, cost = p.cost * q / p.qty;
    return { T, q, trig, buyIn, val, pnl: val - cost, cost, qtyTxt: fmtQty(x, q) };
  }
  if (o.tg === 'der') { const p = T.der; return { T, q: o.f, trig, buyIn: p.entry || null, val: null, pnl: null, cost: p.cost * o.f, qtyTxt: fmt(o.f * 100, 0) + ' % der Position' }; }
  const amt = A.fxc[T.ccy] * o.f, cost = A.fxCost[T.ccy] * o.f, val = amt * trig;
  return { T, q: amt, trig, buyIn: A.fxc[T.ccy] > 0 ? A.fxCost[T.ccy] / A.fxc[T.ccy] : null, val, pnl: val - cost, cost, qtyTxt: `${fmt(amt, 2)} ${T.ccy}` };
}
