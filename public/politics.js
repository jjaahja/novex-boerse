// NOVEX Börse – Politik & Geopolitik: Zölle, Gegenzölle, Handelsabkommen, Konjunkturpakete, Steuerreform, Deregulierung,
// Kartellverfahren, Exportverbote, Verteidigungsetats. Jede Storyline kündigt sich an (Gerücht → Entwurf → Entscheidung).
// Ob sie wirklich kommt, liegt geheim in M.sec.pol; öffentlich ist nur die Markt-Einschätzung (Wahrscheinlichkeit).
import { M, hook, byCls, addNews, setWhy, gauss, pick, clamp, pct, fmt, fDate, dayStart, MIN, recomputeDerived, bumpCmd } from './engine.js';
import { POLICIES, sensOf, SECTORS, REGION } from './data.js';
import { addTradingDays } from './events.js';

const at = (day, h, m) => day + (h * 60 + m) * MIN;
const round5 = p => Math.round(p * 20) / 20;
const allStocks = () => Object.values(M.inst).filter(x => x.cls === 'stock');
export const TAR_KEYS = { us_eu: ['us', 'eu'], us_asia: ['us', 'asia'], eu_us: ['eu', 'us'], eu_asia: ['eu', 'asia'] };
export const tarLabel = k => { const [b, o] = TAR_KEYS[k]; return `${REGION[b]} auf Waren aus ${REGION[o]}`; };

hook('init', () => {
  if (!M.pol) M.pol = { tar: { us_eu: 0, us_asia: 0, eu_us: 0, eu_asia: 0 }, tax: 30, n: 0, log: [] };
  if (!M.sec) M.sec = {}; if (!M.sec.pol) M.sec.pol = [];
});

/* ---------- Wirkung einer Entscheidung ---------- */
// Liefert je Aktie Kurseffekt j (log) und Gewinneffekt adj (Anteil am Gewinn je Aktie) sowie Makro- und Devisenwirkungen.
function impact(e) {
  const st = {}, out = { st, fx: {}, gold: 0, lv: 0, stim: 0, debt: 0, slope: 0 }, add = (id, j, adj = 0) => { const o = st[id] || (st[id] = [0, 0]); o[0] += j; o[1] += adj; };
  const tariff = (by, on, r, sectors) => {
    for (const x of allStocks()) {
      const s = sensOf(x), inScope = sectors === 'all' || sectors.includes(x.sector), vs = Math.sqrt(x.vol / 0.3);
      if (s.home === on && inScope) { const hit = r * s.exp * 0.55; add(x.id, -0.8 * hit * vs, -0.6 * hit); }          // Exporteure verlieren
      if (s.home === by && inScope) add(x.id, 0.12 * r * (1 - s.exp) * vs, 0.1 * r * (1 - s.exp));                    // heimische Anbieter gewinnen Marktanteile
      if (s.home === by) { const f = on === 'asia' ? 1 : 0.5; add(x.id, -0.25 * r * s.sc * f * vs, -0.2 * r * s.sc * f); } // teurere Vorprodukte
      if (s.steel && by === 'eu' && on === 'asia') add(x.id, 0.5 * r * vs, 0.4 * r);                                     // Schutz vor Billigstahl
    }
    if (by === 'us' && on === 'eu') { out.fx.EUR = -0.06 * r; out.fx.CHF = 0.02 * r; }
    else if (by === 'eu') out.fx.EUR = -0.02 * r;
    else if (by === 'us' && on === 'asia') { out.fx.USD = 0.02 * r; out.fx.JPY = -0.03 * r; out.fx.AUD = -0.03 * r; }
    out.gold += 0.05 * Math.abs(r); out.lv += 1.5 * r;
  };
  if (e.k === 'tariff') tariff(e.by, e.on, e.rate / 100, e.sectors);
  else if (e.k === 'deal') for (const k in e.cut) { const [b, o] = TAR_KEYS[k]; tariff(b, o, -e.cut[k] / 100, 'all'); }
  else if (e.k === 'stimulus') { for (const x of byCls('stock')) { const s = sensOf(x), boost = e.sectors.includes(x.sector) ? 0.045 : 0; add(x.id, (boost + 0.008 * s.cyc) * Math.sqrt(x.vol / 0.3), boost * 0.6 + 0.01 * s.cyc); } out.stim = 0.8; out.debt = 3; out.slope = 0.002; out.fx.EUR = 0.005; }
  else if (e.k === 'taxcut') { for (const x of allStocks()) if (sensOf(x).home === 'eu') add(x.id, 0.05, 0.0714); out.debt = 1.5; out.slope = 0.001; out.stim = 0.2; }
  else if (e.k === 'dereg') { for (const x of byCls('stock')) if (e.sectors.includes(x.sector)) add(x.id, (x.sector === 'fin' ? 0.04 : 0.03) * Math.sqrt(x.vol / 0.3), 0.03); }
  else if (e.k === 'antitrust') { const x = M.inst[e.id]; if (x) add(x.id, -0.08 * Math.sqrt(x.vol / 0.3), -0.05); }
  else if (e.k === 'exportban') { for (const x of byCls('stock')) if (x.sector === 'semi' || e.ids.includes(x.id)) add(x.id, x.id === 'MVDA' ? -0.10 : e.ids.includes(x.id) ? -0.08 : -0.05, x.id === 'MVDA' ? -0.06 : -0.03); if (M.inst.RHST) add('RHST', 0.01); out.lv += 0.2; }
  else if (e.k === 'defense') { const w = { RHST: 0.10, ABZZ: 0.04, SIMZ: 0.03 }; for (const id in w) if (M.inst[id] && !M.inst[id].delisted) add(id, w[id], w[id] * 0.5); out.debt = 1; }
  return out;
}
// Kurse bewegen (scale: Anteil der Wirkung). full: auch Makro, Gewinne und Zölle übernehmen
function apply(e, scale, full, why) {
  const I = impact(e), moved = [];
  for (const id in I.st) {
    const x = M.inst[id]; if (!x) continue; const [j, adj] = I.st[id], jj = j * scale;
    if (!x.delisted && Math.abs(jj) > 1e-6) { x.f *= Math.exp(jj); x.price = x.f * Math.exp(x.tr); if (why && Math.abs(jj) >= 0.004) setWhy(x, `${pct(jj, 1)} ${why}`, jj); moved.push([id, jj]); }
    if (full) x.padj = (x.padj || 0) + adj;
  }
  for (const c in I.fx) if (M.U[c]) M.U[c] *= Math.exp(I.fx[c] * scale);
  for (const f of byCls('fx')) f.price = M.U[f.base] / M.U[f.quote];
  if (I.gold) bumpCmd('GOLD', Math.exp(I.gold * Math.sign(scale) * Math.min(1, Math.abs(scale))));
  M.lv = clamp(M.lv + I.lv * Math.abs(scale), -0.7, 1.6);
  if (full && M.mac) { M.mac.stim += I.stim; M.mac.debt += I.debt; M.slope = clamp(M.slope + I.slope, -0.03, 0.05); }
  if (full && e.k === 'tariff') M.pol.tar[e.by + '_' + e.on] = e.rate;
  if (full && e.k === 'deal') for (const k in e.cut) M.pol.tar[k] = Math.max(0, M.pol.tar[k] - e.cut[k]);
  if (full && e.k === 'taxcut') M.pol.tax = 25;
  recomputeDerived();
  moved.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return moved;
}

/* ---------- Storylines planen ---------- */
function candidates() {
  const busy = new Set(M.sec.pol.map(e => e.key)), t = M.pol.tar, out = [];
  POLICIES.forEach((P, i) => {
    if (P.k === 'tariff' && t[P.by + '_' + P.on] > 0) return;                                   // Zoll besteht schon
    if (P.k === 'deal' && !Object.values(t).some(v => v > 0)) return;                            // nichts zu verhandeln
    if (P.k === 'taxcut' && M.pol.tax <= 25) return;
    const key = P.k + (P.by || '') + (P.on || ''); if (busy.has(key)) return;
    out.push({ i, key, w: P.k === 'tariff' ? 1.2 : P.k === 'deal' ? 2.5 : 1 });
  });
  return out;
}
function schedule() {
  if (M.sec.pol.length >= 2 || Math.random() > 0.1) return;
  const c = candidates(); if (!c.length) return;
  let u = Math.random() * c.reduce((s, x) => s + x.w, 0), ch = c[0]; for (const x of c) { u -= x.w; if (u <= 0) { ch = x; break; } }
  const P = POLICIES[ch.i], e = { id: ++M.pol.n, i: ch.i, key: ch.key, k: P.k, by: P.by, on: P.on, sectors: P.sectors, ids: P.ids, stage: 0, priced: 0 };
  if (P.k === 'tariff') e.rate = Math.round((P.rate[0] + Math.random() * (P.rate[1] - P.rate[0])) / 5) * 5;
  if (P.k === 'deal') { e.cut = {}; for (const k in M.pol.tar) if (M.pol.tar[k] > 0) e.cut[k] = Math.round(M.pol.tar[k] / 2); }
  if (P.k === 'antitrust') { const ok = P.ids.filter(id => M.inst[id] && !M.inst[id].delisted); if (!ok.length) return; e.id2 = pick(ok); }
  e.truth = Math.random() < P.p;
  e.p = clamp(round5(P.p + 0.15 * gauss()), 0.2, 0.85);
  const today = dayStart(M.t), hasDraft = Math.random() < 0.7;
  e.tR = at(today, 9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
  e.tD = hasDraft ? at(addTradingDays(M.t, 2 + Math.floor(Math.random() * 3)), 10, 30) : 0;
  e.tX = at(addTradingDays(e.tD || M.t, 2 + Math.floor(Math.random() * 4)), Math.random() < 0.5 ? 14 : 16, 30);
  M.sec.pol.push(e);
}
const fill = (s, e) => s.replace('{r}', e.rate).replace('{n}', e.id2 && M.inst[e.id2] ? M.inst[e.id2].name : '');
function affectedIds(e) { const I = impact(e); return Object.entries(I.st).sort((a, b) => Math.abs(b[1][0]) - Math.abs(a[1][0])).slice(0, 4).map(a => a[0]); }
function explain(e) {
  const P = POLICIES[e.i];
  if (e.k === 'tariff') { const sec = e.sectors === 'all' ? 'alle Branchen' : e.sectors.map(s => SECTORS[s]).join(', '); return `Betroffen: ${sec}. Exporteure aus ${REGION[e.on]} verlieren Marge, heimische Anbieter in ${REGION[e.by]} gewinnen Marktanteile. Zölle verteuern Importe – die Inflation zieht an.`; }
  if (e.k === 'deal') return 'Weniger Zölle entlasten Exporteure und senken den Preisdruck. Der Euro dürfte zulegen.';
  if (e.k === 'stimulus') return 'Mehr Staatsausgaben treiben Bau, Industrie, Netze und Chips – aber auch Schulden und Anleiherenditen.';
  if (e.k === 'taxcut') return 'Niedrigere Steuern erhöhen den Nettogewinn europäischer Unternehmen um rund 7 %. Die Staatsschulden steigen.';
  if (e.k === 'dereg') return 'Weniger Kapitalvorschriften und schnellere Genehmigungen erhöhen die Gewinne von Banken und Energiekonzernen.';
  if (e.k === 'antitrust') return 'Drohen eine Milliardenstrafe und Auflagen, die das Geschäftsmodell beschneiden.';
  if (e.k === 'exportban') return 'Chip-Hersteller verlieren einen großen Absatzmarkt. Rüstung und heimische Fertigung profitieren leicht.';
  if (e.k === 'defense') return 'Rüstungs- und Luftfahrtwerte bekommen volle Auftragsbücher.';
  return P ? '' : '';
}
function publish(e, stage) {
  const P = POLICIES[e.i], ids = affectedIds(e), prev = e.priced;
  e.stage = stage;
  if (stage === 1) e.p = clamp(round5(e.p + (e.truth ? 0.15 : -0.1) + 0.05 * gauss()), 0.1, 0.95);
  const target = e.p * 0.6, moved = apply(e, target - prev, false, stage === 0 ? 'wegen politischer Gerüchte' : 'wegen eines Gesetzentwurfs'); e.priced = target;
  const avg = moved.length ? moved.slice(0, 4).reduce((s, m) => s + m[1], 0) / Math.min(4, moved.length) : 0;
  addNews(fill(stage === 0 ? P.rumor : P.draft, e), avg > 0 ? 1 : avg < 0 ? -1 : 0, ids, { cat: 'politics', rumor: true, p: e.p, eff: avg, sub: `Markt-Einschätzung: ${Math.round(e.p * 100)} % Wahrscheinlichkeit. Entscheidung am ${fDate(e.tX, true).slice(0, 9)}. ${explain(e)}` });
  syncEvent(e);
}
function decide(e) {
  const P = POLICIES[e.i], ids = affectedIds(e);
  let moved;
  if (e.truth) moved = apply(e, 1 - e.priced, true, `wegen: ${fill(P.yes, e)}`);
  else moved = apply(e, -e.priced, false, 'nach politischer Entwarnung');
  const avg = moved.length ? moved.slice(0, 4).reduce((s, m) => s + m[1], 0) / Math.min(4, moved.length) : 0;
  const title = fill(e.truth ? P.yes : P.no, e);
  addNews(title, avg > 0 ? 1 : avg < 0 ? -1 : 0, ids, { cat: 'politics', eff: avg, sub: e.truth ? `Bestätigt. ${explain(e)}` : 'Die Maßnahme kommt nicht – der Markt gibt den Gerüchte-Effekt wieder ab.' });
  M.pol.log.unshift({ t: M.t, title, yes: e.truth, k: e.k }); if (M.pol.log.length > 12) M.pol.log.length = 12;
  const ev = M.events.find(v => v.kind === 'policy' && v.pid === e.id); if (ev) { ev.done = true; ev.res = e.truth ? 1 : 0; }
  e.done = true;
}
// Öffentlicher Kalendereintrag (ohne die geheime Wahrheit)
function syncEvent(e) {
  let ev = M.events.find(v => v.kind === 'policy' && v.pid === e.id);
  if (!ev) { ev = { id: M.nseq, kind: 'policy', pid: e.id, t: e.tX, done: false }; M.events.push(ev); }
  ev.title = 'Entscheidung: ' + labelOf(e); ev.p = e.p; ev.stage = e.stage; ev.k = e.k; ev.ids = affectedIds(e);
}

export function labelOf(e) {
  const n = e.id2 && M.inst[e.id2] ? M.inst[e.id2].name : '';
  return { tariff: `${e.rate} % Zoll ${REGION[e.by]} auf Waren aus ${REGION[e.on]}`, deal: 'Handelsabkommen zum Zollabbau', stimulus: '500-Mrd.-Konjunkturpaket', taxcut: 'Unternehmenssteuer auf 25 %', dereg: 'Deregulierung Banken & Energie', antitrust: `Kartellverfahren gegen ${n}`, exportban: 'Exportverbot für KI-Chips', defense: 'Verteidigungsetat' }[e.k] || 'Politische Entscheidung';
}

/* ---------- Ablauf ---------- */
hook('gap', () => { schedule(); });
hook('step', () => {
  if (!M.sec || !M.sec.pol) return;
  for (const e of M.sec.pol) {
    if (e.done) continue;
    if (!e.out && M.t >= e.tR) { e.out = true; publish(e, 0); }
    else if (e.out && e.stage === 0 && e.tD && M.t >= e.tD) publish(e, 1);
    else if (e.out && M.t >= e.tX) decide(e);
  }
  M.sec.pol = M.sec.pol.filter(e => !e.done);
});

// Zollsätze für die Anzeige (Ausgangsland → Zielregion)
export function tariffList() { return Object.entries(M.pol ? M.pol.tar : {}).map(([k, v]) => ({ k, label: tarLabel(k), rate: v })); }
