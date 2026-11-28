// NOVEX Börse – Ventures: das eigene Startup von der Garage bis zur Börse.
// Läuft im Spieltakt automatisch mit (Autopilot), der Spieler steuert über Strategie-Regler, Quartals-Board-Meetings und eine ruhige Entscheidungs-Inbox.
// Verzahnt mit Börse (Marktanteile kosten gelistete Rivalen Gewinn), Makro (Zinsen, Konsumklima, Zölle) und Neobroker-Depot (Börsengang als echte Aktie).
import { M, hook, ENV, I, addNews, setWhy, book, availCash, applyTrade, addStock, recomputeDerived, fmt, fmtE, fmtBig, pct, r2, clamp, gauss, pick, dayStart, DAY } from './engine.js';
import { PRODUCT_TREE, RADAR, FOCUS, NODE_STEPS, NODE_COST, BIZ_MODELS, VENTURE_STAGES, VENTURE_MIN, VENTURE_SHARES, IPO_MIN_QUARTERS, EXECS, EXEC_PAY, EXEC_ESOP, VC_ROUNDS, VC_NAMES, CAMPAIGNS, SECTOR_SENS } from './data.js';
import { sectorRev, peerPS, rivalsOf, rivalProfile, rateFactor } from './company.js';
import { addTradingDays, scheduleReport, payDividend, qLabel } from './events.js';

const PRICE = { low: { arpu: 0.8, conv: 1.3, churn: 0.85, name: 'Günstig' }, normal: { arpu: 1, conv: 1, churn: 1, name: 'Marktüblich' }, premium: { arpu: 1.25, conv: 0.7, churn: 1.2, name: 'Premium' } };
const GROWTH = { lean: 0.12, normal: 0.25, aggressive: 0.45 };
const RD_NEED = { saas: 8000, b2c: 6000, fintech: 10000, deeptech: 16000, cleantech: 16000, biotech: 0 };
const OPEX_K = [0.40, 0.40, 0.33, 0.28]; // Team- und Verwaltungskosten in % vom Rohertrag je Phase (margenschwache Modelle haben schlankere Teams)
const TRIAL = [{ name: 'Präklinik', cost: 6000, p: 0.75, minQ: 2 }, { name: 'Phase I', cost: 60000, p: 0.7, minQ: 3 }, { name: 'Phase II', cost: 600000, p: 0.65, minQ: 5 }, { name: 'Phase III & Zulassung', cost: 4000000, p: 0.75, minQ: 6 }]; // minQ: Mindestdauer in Quartalen – Studien lassen sich nicht beliebig beschleunigen
const PIPE = [500000, 8000000, 250000000, 4000000000];                // Bewertung der Wirkstoff-Pipeline je erreichter Studienphase
const TICKET = [0.3, 0.6, 1, 1.3];                                  // erst kleine Kunden (Mittelstand), später Konzerne
const SAL_MAX = [800, 2500, 10000, 30000];                          // marktübliches Gründergehalt je Quartal und Phase (mehr akzeptieren die Investoren nicht)
export const salaryOf = v => Math.min(v.salary || 0, SAL_MAX[Math.min(v.stage, 3)]);
const HUSTLE = { saas: 3.2, b2c: 700, fintech: 160, deeptech: 0.9, cleantech: 0.7, biotech: 0.6 }; // vom Gründer selbst gewonnene Kunden je Quartal
export { PRICE, GROWTH, TRIAL, PIPE, SAL_MAX };
export const vm = v => BIZ_MODELS[v.model];
export const vstage = v => VENTURE_STAGES[v.stage];
// Dauer eines Startup-Quartals in Handelstagen: Phase × Branchentempo ab dem Scale-Up (Hardware, Energie und Pharma haben längere Zyklen)
export const qDays = v => v.status === 'public_listed' ? 91 : Math.max(4, Math.round(vstage(v).qd * (v.stage >= 2 || vm(v).trial ? vm(v).pace || 1 : 1))); // Garage & Traction: wöchentliches Board-Meeting (Pharma folgt dem Studienkalender)
const qName = qi => `Q${qi % 4 + 1} J${Math.floor(qi / 4) + 1}`;

/* ---------- Kennzahlen (Browser und Server) ---------- */
const approvedNow = v => !vm(v).trial || (v.trial && v.trial.phase >= 4);
function fxOf(v, k) { let f = 1; for (const e of v.fx || []) if (e.k === k && e.until > v.qi) f *= e.m; return f; }
const ex = (v, role) => v.execs && v.execs[role] ? EXECS[role].a.find(a => a.k === v.execs[role].k).fx : {};
export function segTAM(v) { const now = sectorRev(v.sector), base = v.tamBase || now; return vm(v).tam * (base > 0 ? clamp(now / base, 0.5, 2) : 1); }
export function vShare(v) { return clamp(v.arr / segTAM(v), 0, 0.95); }
export function unit(v) {
  const m = vm(v), P = priceOf(v), sh = vShare(v), tf = treeFx(v), mac = M.mac || { conf: -8 }, tar = M.mac ? M.mac.tarImp || 0 : 0;
  const confF = 1 - m.sens.cons * clamp((-8 - mac.conf) / 40, -0.3, 0.5); // schwaches Konsumklima drückt Preise und Abschlüsse
  const priceF = P.arpu * tf.arpu * fxOf(v, 'arpu') * (1 + 0.25 * m.moat * clamp(v.arr / 5e7, 0, 1)) * (m.sens.cons > 0.5 ? confF : 1), ticket = TICKET[Math.min(v.stage, 3)];
  const arpu = (v.arpuB || m.arpu * ticket) * priceF, arpuNew = m.arpu * ticket * priceF;
  const net = sh > 0.2 ? 1 - Math.min(1, m.net + tf.net) * clamp((sh - 0.2) * 2, 0, 0.5) : 1;                                  // Netzwerkeffekte senken die Akquisekosten
  const cac = m.cac * ticket * tf.cac * (ex(v, 'growth').cac || 1) * fxOf(v, 'cac') * net * (1 + 2 * Math.max(0, sh - 0.5)) / (0.45 + 0.55 * v.pmf) / (m.sens.cons > 0.5 ? confF : 1);
  const prem = v.hyper && v.hyper.on && !hyperReady(v);
  const churn = clamp(m.churn * P.churn * tf.churn * (ex(v, 'growth').churn || 1) * fxOf(v, 'churn') * (1.5 - 0.8 * v.pmf) * (1.3 - 0.3 * v.quality) * (1 - 0.3 * m.moat * clamp(v.arr / 2e7, 0, 1)) * (prem ? 2.6 : 1), 0.005, 0.6);
  const gm = clamp(m.gm + tf.gm + 0.02 * synergy(v) - complexity(v) + (ex(v, 'coo').gm || 0) + (m.hyper ? 0 : 0.15 * clamp(v.arr / 5e7, 0, 1)) - m.sens.tar * tar / 100 * 0.5 * (v.tarShield ? 0.2 : 1) - (v.reg && v.reg.until > v.qi ? 0.04 : 0), 0.05, 0.92);
  return { arpu, arpuNew, priceF, ticket, cac, churn, gm, ltv: arpuNew / 4 * gm / churn, ratio: cac > 0 ? arpuNew / 4 * gm / churn / cac : 0, share: sh, conv: m.conv * P.conv * tf.conv * effOf(v).conv * Math.min(1, 0.45 + 0.12 * v.qi + 0.3 * v.pmf) };
}
// Preisniveau (Regler 0,8–1,3): höherer Preis = mehr Umsatz je Kunde, weniger Abschlüsse, etwas mehr Kündigungen
const PL = { low: 0.85, normal: 1, premium: 1.2 };
export const plOf = v => v.pl !== undefined ? v.pl : PL[v.price] || 1;
export function priceOf(v) { const p = plOf(v); return { arpu: p, conv: Math.pow(p, -1.3), churn: Math.pow(p, 0.85) }; }
// Effizienz (Regler 0–1): schlanke Organisation senkt Fixkosten, kostet aber Vertriebskraft und etwas Produktqualität
export const effOf = v => { const e = v.eff === undefined ? 0.5 : v.eff; return { opex: (1.15 - 0.3 * e) * (1 - (v.burnCut || 0)), conv: 1.1 - 0.2 * e, q: 0.03 * (0.5 - e) }; };
// Wachstumsbudget je Quartal in % der Kasse: Vertrieb + F&E (alte Spielstände: Tempo-Stufe × Aufteilung)
const SPLIT = { lean: 0.12, normal: 0.25, aggressive: 0.45 };
export const ratesOf = v => v.sR !== undefined ? { s: v.sR, r: v.rR } : { s: (SPLIT[v.growth] || 0.25) * (1 - v.rd), r: (SPLIT[v.growth] || 0.25) * v.rd };
export function hyperReady(v) { const m = vm(v); if (!m.hyper) return false; const u = unitNoHyper(v); return v.pmf >= 0.8 && u.ratio >= 3; }
function unitNoHyper(v) { const h = v.hyper; v.hyper = { on: false }; const u = unit(v); v.hyper = h; return u; }
const cashMix = e => e.mix !== undefined ? e.mix : e.esop ? 1 : 0; // Anteil der Vergütung in Mitarbeiteranteilen
// Quartalskosten (Team, Infrastruktur, Führungskräfte) – ohne Marketing und F&E
export function opexQ(v) {
  let base = (900 * (1 + v.stage) + OPEX_K[Math.min(v.stage, 3)] * v.arr / 4 * unit(v).gm) * (ex(v, 'cfo').opex || 1) * (ex(v, 'coo').opex || 1); // wächst mit dem Geschäft, ohne Sprung beim Phasenwechsel
  for (const r in v.execs || {}) base += EXEC_PAY[Math.min(v.stage, 3)] * EXECS[r].a.find(a => a.k === v.execs[r].k).pay * (v.execs[r].pf || 1) * (1 - cashMix(v.execs[r]));
  const tf = treeFx(v), integ = (v.clk || []).some(c => c.k === 'int') ? 1.1 : 1; // Tech Debt, Fehlentwicklungen am Markt vorbei und Integrationen kosten laufend
  return base * effOf(v).opex * tf.opex * (1 + 0.3 * (v.debt || 0)) * (1 + 0.03 * (v.miss || 0)) * integ + hyperTeam(v) + capOpex(v) + salaryOf(v);
}
// Wachstumsbudget: wird beim Board-Meeting (oder bei Strategiewechsel) aus der Kasse festgelegt und dann im Quartal ausgegeben – auch wenn die Kasse schrumpft
export const budgetRate = v => { const r = ratesOf(v); return Math.min(0.95, (r.s + r.r) * (v.hyper && v.hyper.on ? 3 : 1)); };
export const rdShare = v => { const r = ratesOf(v); return r.s + r.r > 0 ? r.r / (r.s + r.r) : 0.5; };
// Aggressives Wachstum und Hyperscaling binden Ausgaben an den Umsatzplan statt an die Kasse (Teams, Verträge, Werbebuchungen) – reichen Kasse und Unit Economics nicht, droht die Pleite
export const budgetFloor = v => { const r = ratesOf(v); return Math.max(clamp((r.s + r.r - 0.25) / 0.2, 0, 1) * 0.35, v.hyper && v.hyper.on ? 1 : 0) * v.arr / 4; }; // ab 25 % der Kasse je Quartal werden Ausgaben fest verplant
export function setBudget(v) { v.budget = Math.max(Math.max(0, v.cash) * budgetRate(v), budgetFloor(v)); v.budgetLeft = v.budget; }
export function spendQ(v) { return v.budget === undefined ? Math.max(Math.max(0, v.cash) * budgetRate(v), budgetFloor(v)) : v.budget; }
// Hyperscaling baut Fixkosten auf (Leute, Server, Büros), die nicht sofort wieder verschwinden
export const hyperTeam = v => (v.hyperCost || 0);
// Fabriken, Anlagen und Labore kosten laufend Personal und Wartung – wer zu früh ausbaut, trägt hohe Fixkosten
export const capOpex = v => (v.capexSum || 0) * 0.05;
export function burnM(v) { const u = unit(v), net = v.arr / 4 * u.gm - opexQ(v) - spendQ(v); return Math.max(0, -net / 3); } // pro Startup-Monat
export function runway(v) { if (v.cash <= 0) return 0; const b = burnM(v); return b > 0 ? v.cash / b : Infinity; }
// Modellbewertung: ARR × Multiple (Peers, Wachstum, PMF, Zinsen) – nie unter der Kasse
export function valuation(v) {
  if (!v || v.status === 'failed') return 0;
  const m = vm(v), last = v.q.length ? v.q[v.q.length - 1] : null, prev = v.q.length > 1 ? v.q[v.q.length - 2] : null;
  const g = last && prev && prev.arr > 0 ? last.arr / prev.arr - 1 : 0.3;
  const peer = clamp(peerPS(v.sector) / 4, 0.6, 2), cfo = ex(v, 'cfo').val || 1;
  const mult = m.mult * (1 + 0.8 * m.moat) * clamp(1 + 1.8 * g, 0.5, 2.5) * (0.5 + 0.5 * v.pmf) * rateFactor(m.sens.rate) * peer * cfo * (1 + (v.pr || 0)) * (v.down || 1);
  let V = v.arr * mult;
  if (m.trial && v.trial && v.trial.phase < 4) V = Math.max(V, PIPE[v.trial.phase] * (0.5 + v.pmf) * clamp(0.3 + v.trial.prog, 0.3, 1.3) * rateFactor(m.sens.rate));
  V += (v.pat || []).reduce((s, p) => s + p.v * p.d / p.D, 0) * rateFactor(m.sens.rate); // befristete Patente (Erstanmelder, nicht verlängerbar)
  return Math.max(V, Math.max(0, v.cash) + (v.cap ? v.cap.level * m.cap.cost * 0.4 : 0));
}
export const founderPct = v => v.capt ? v.capt.founder : 1;
// Anrechnung im Nettovermögen (illiquide, mit Abschlag je Phase) und als Kreditsicherheit
export function ventureValue(A) { const v = A && A.venture; if (!v || v.status !== 'private_startup') return 0; return founderPct(v) * valuation(v) * vstage(v).liq; }
export function ventureLTV(v) { if (!v || v.status !== 'private_startup') return 0; return v.stage >= 2 || (v.rounds || []).some(r => r === 'a' || r === 'b' || r === 'c') ? 0.2 : 0; }
ENV.ventVal = ventureValue;
ENV.ventLV = A => { const v = A.venture; return v && v.status === 'private_startup' ? founderPct(v) * valuation(v) * ventureLTV(v) : 0; };

/* ---------- Gründung & Steuerung ---------- */
export function found(A, b) {
  if (A.venture && A.venture.status === 'private_startup') return 'Du führst bereits ein Startup.';
  if (A.venture && A.venture.status === 'public_listed') return 'Du bist bereits CEO eines börsennotierten Unternehmens.';
  const m = BIZ_MODELS[b.model]; if (!m) return 'Unbekanntes Geschäftsmodell.';
  const name = String(b.name || '').trim().replace(/\s+/g, ' ').slice(0, 28); if (name.length < 2) return 'Bitte einen Namen (2–28 Zeichen) angeben.';
  const amt = Number(b.amt); if (!(amt >= VENTURE_MIN)) return `Startkapital: mindestens ${fmtE(VENTURE_MIN, 0)}.`;
  if (amt > availCash(A) + 1e-6) return `Nicht genug Guthaben (verfügbar ${fmtE(Math.max(0, availCash(A)))}).`;
  A.cash -= amt; book(A, 'venture', -amt, `Gründung ${name}`);
  const rivals = rivalsOf(m.sector).map(x => x.id), w = {}; let tot = 0; for (const id of rivals) { const x = I(id); tot += x.fin.rev; } for (const id of rivals) w[id] = tot > 0 ? I(id).fin.rev / tot : 1 / rivals.length;
  A.venture = { status: 'private_startup', name, model: b.model, sector: m.sector, t0: M.t, stage: 0, qi: 0, day: 0, cash: amt, invested: amt, customers: 0, arr: 0, pmf: m.trial ? 0.35 : 0.25, quality: 1, price: 'normal', growth: 'normal', rd: m.trial ? 0.8 : 0.5, salary: 0,
    hyper: { on: false, since: 0 }, cap: m.cap ? { level: 1, building: 0, qLeft: 0, cost: m.cap.cost } : null, trial: m.trial ? { phase: 0, prog: 0 } : null, rdSum: 0,
    tamBase: sectorRev(m.sector), rivals, w, lost: {}, lastShare: 0, capt: { founder: 1, esop: 0, inv: [] }, execs: {}, fx: [], inbox: [], q: [], cur: blankCur(), board: 70, rounds: [], target: null, seq: 1, news: 0 };
  migrate(A.venture); A.venture.shk = drawShock(A.venture); A.venture.plan = planOf(A.venture);
  addNews(`Neues Startup: ${name} will den Markt für ${m.sub} aufmischen`, 0, rivals.slice(0, 2), { cat: 'company', sub: `Gegründet von ${A.name} mit ${fmtE(amt, 0)} Startkapital. Gegner sind etablierte Konzerne wie ${rivals.map(id => I(id).name).slice(0, 2).join(' und ')}.` });
  note(A, `${name} ist gegründet! Erstes Board-Meeting in ${qDays(A.venture)} Tagen.`, 'tier'); ENV.event(A, 'founder'); ENV.dirty(A); return null;
}
// Benachrichtigung + Eintrag in der Chronik des Startups (die Oberfläche zeigt, was deine Entscheidungen bewirkt haben)
function note(A, msg, tone) { ENV.note(A, msg, tone); const v = A.venture; if (v) chron(v, msg, tone); }
// Firmen-Ticker: die letzten 10 Ereignisse mit Handelstag seit Gründung (hält A.venture klein)
function chron(v, msg, tone) { if (v._sim) return; (v.log = Array.isArray(v.log) ? v.log : []).unshift({ d: v.age || 0, t: M.t, m: String(msg).slice(0, 160), k: tone || '' }); if (v.log.length > 10) v.log.length = 10; }
const blankCur = () => ({ rev: 0, gross: 0, opex: 0, mkt: 0, rd: 0, capex: 0, newC: 0, churnC: 0, days: 0 });
const own = A => { const v = A.venture; return v && v.status === 'private_startup' ? v : null; };
export function fund(A, amt) {
  const v = A.venture; if (!v || (v.status !== 'private_startup' && v.status !== 'public_listed')) return 'Kein aktives Unternehmen.';
  amt = Number(amt); if (!(amt >= 100)) return 'Mindestens 100 €.';
  if (amt > availCash(A) + 1e-6) return `Nicht genug Guthaben (verfügbar inkl. Wertpapierkredit ${fmtE(Math.max(0, availCash(A)))}).`;
  A.cash -= amt; v.cash += amt; v.invested += amt; book(A, 'venture', -amt, `Einlage ${v.name}`);
  note(A, `${fmtE(amt)} in ${v.name} eingelegt – ohne Verwässerung.${A.cash < 0 ? ' Finanziert über deinen Wertpapierkredit.' : ''}`, 'up'); ENV.dirty(A); return null;
}
export function vSetStrategy(A, b) { // ältere Einzel-Aktionen (Tempo-Stufe, Preisstufe, Aufteilung, Gehalt) – intern auf die Regler abgebildet
  const v = A.venture; if (!v || v.status === 'failed' || v.status === 'exited') return 'Kein aktives Unternehmen.';
  const r = ratesOf(v), tot = b.growth && SPLIT[b.growth] ? SPLIT[b.growth] : r.s + r.r, sh = b.rd !== undefined && Number(b.rd) >= 0 && Number(b.rd) <= 1 ? Number(b.rd) : rdShare(v);
  return vSlider(A, { sR: tot * (1 - sh), rR: tot * sh, pl: b.price && PL[b.price] ? PL[b.price] : undefined, salary: b.salary });
}
const GN = t => t < 0.18 ? 'lean' : t < 0.35 ? 'normal' : 'aggressive';
// „Kurs setzen“: alle Regler in einer Aktion (Vertrieb %, F&E %, Effizienz, Preisniveau, Gehalt, Hyperscaling, CapEx-Ausbau)
export function vSlider(A, b) {
  const v = A.venture; if (!v || (v.status !== 'private_startup' && v.status !== 'public_listed')) return 'Kein aktives Unternehmen.';
  const num = (x, lo, hi) => x === undefined || x === null || x === '' || !isFinite(Number(x)) ? undefined : clamp(Number(x), lo, hi);
  const sR = num(b.sR, 0, 0.6), rR = num(b.rR, 0, 0.6), eff = num(b.eff, 0, 1), pl = num(b.pl, 0.8, 1.3), sal = num(b.salary, 0, 1e7);
  const r = ratesOf(v), was = { s: r.s, r: r.r, eff: v.eff ?? 0.5, pl: plOf(v), sal: salaryOf(v) }, parts = [];
  if (sR !== undefined || rR !== undefined) { v.sR = sR ?? r.s; v.rR = rR ?? r.r; const t = v.sR + v.rR; v.growth = GN(t); v.rd = t > 0 ? v.rR / t : 0.5; }
  if (eff !== undefined) v.eff = eff;
  if (pl !== undefined) { v.pl = pl; v.price = pl < 0.93 ? 'low' : pl > 1.1 ? 'premium' : 'normal'; }
  if (sal !== undefined) v.salary = r2(sal);
  let err = null;
  if (b.hyper !== undefined && !!b.hyper !== !!(v.hyper && v.hyper.on) && v.status === 'private_startup') err = setHyper(A, !!b.hyper);
  if (b.capex && v.status === 'private_startup') err = buildCapacity(A) || err;
  setBudget(v);
  const nr = ratesOf(v), pc = x => Math.round(x * 100) + ' %';
  if (Math.abs(nr.s - was.s) > 0.004) parts.push(`Vertrieb ${pc(nr.s)}`); if (Math.abs(nr.r - was.r) > 0.004) parts.push(`F&E ${pc(nr.r)}`);
  if (Math.abs((v.eff ?? 0.5) - was.eff) > 0.01) parts.push(`Effizienz ${pc(v.eff)}`); if (Math.abs(plOf(v) - was.pl) > 0.005) parts.push(`Preisniveau ${pc(plOf(v))}`);
  if (Math.abs(salaryOf(v) - was.sal) > 1) parts.push(`Gehalt ${fmtE(salaryOf(v), 0)}`);
  if (parts.length) chron(v, `Kurs gesetzt: ${parts.join(' · ')} – Budget ${fmtE(v.budget, 0)} je Quartal.`, '');
  if (v.status === 'private_startup') v.plan = planOf(v); // neuer Prognose-Korridor bis zum Board-Meeting
  ENV.dirty(A); return err;
}

/* ---------- Prognose mit Unsicherheit (läuft identisch im Browser und im Worker) ---------- */
// Bandbreite der Prognose (±): junge Firmen haben kaum Daten, ein CFO plant genauer, Hyperscaling macht alles schwerer planbar
export function confBand(v) {
  let b = [0.30, 0.18, 0.16, 0.12][Math.min(v.stage, 3)];
  if (v.status === 'public_listed') b = 0.12;
  const c = v.execs && v.execs.cfo; if (c) b *= c.k === 'eff' ? 0.4 : 0.5;
  if (v.hyper && v.hyper.on) b += 0.10;
  return b + 0.1 * (v.debt || 0); // technische Schuld macht Ergebnisse unberechenbarer
}
export const confLabel = b => b > 0.22 ? 'Niedrig' : b > 0.13 ? 'Mittel' : 'Hoch';
// Ein Quartal vorausrechnen (ohne Zufall): Kopie des Startups, Regler-Entwurf anwenden, restliche Tage simulieren
export function forecast(v, patch = {}, days) {
  const w = JSON.parse(JSON.stringify(v)); w._sim = 1; w.shk = { n: 1, c: 1 }; w.inbox = []; w.log = [];
  for (const k of ['sR', 'rR', 'eff', 'pl', 'salary']) if (patch[k] !== undefined) w[k] = patch[k];
  if (patch.sR !== undefined && patch.rR === undefined) w.rR = ratesOf(v).r; if (patch.rR !== undefined && patch.sR === undefined) w.sR = ratesOf(v).s;
  if (patch.hyper !== undefined && vm(w).hyper) w.hyper = { on: !!patch.hyper, since: w.qi };
  if (patch.capex && w.cap && !w.cap.building) { const c = capCost(w); w.cash -= c; w.capexSum = (w.capexSum || 0) + c; }
  setBudget(w);
  const n = Math.max(1, days || (qDays(w) - (w.day || 0))), A = { cash: 0 }, a0 = w.arr, c0 = w.cash, p0 = w.pmf, q0 = w.quality, s0 = vShare(w);
  let gross = 0, lost = 0; const cu0 = w.customers;
  for (let i = 0; i < n; i++) { const u = unit(w), ch = w.customers * u.churn / qDays(w); lost += ch * (w.arpuB || 0) * u.priceF; dayStep(A, w); }
  const b = confBand(v), burnM = Math.max(0, (c0 - w.cash) / (n / qDays(w)) / 3), add = Math.max(0, w.arr - a0 + lost);
  const lo = a0 + add * (1 - b) - lost * (1 + b / 2), hi = a0 + add * (1 + b) - lost * (1 - b / 2), u1 = unit(w);
  return { days: n, arr0: a0, arr: w.arr, lo: Math.max(0, lo), hi, g: a0 > 0 ? w.arr / a0 - 1 : null, gLo: a0 > 0 ? lo / a0 - 1 : null, gHi: a0 > 0 ? hi / a0 - 1 : null,
    burn: burnM, burnLo: burnM * (1 - b / 2), burnHi: burnM * (1 + b / 2), cash: w.cash, runwayQ: burnM > 0 ? Math.max(0, w.cash) / (burnM * 3) : Infinity,
    pmf: w.pmf - p0, quality: w.quality - q0, share: vShare(w) - s0, cust: w.customers - cu0, rev: w.cur.rev - (v.cur ? v.cur.rev : 0), qrev: w.cur.rev, qebit: w.cur.gross - w.cur.opex - w.cur.mkt - w.cur.rd - w.cur.capex, band: b, prem: !!(w.hyper && w.hyper.on && !hyperReady(w)), ratio: u1.ratio };
}
export function planOf(v) { const f = forecast(v); return { lo: Math.round(f.lo), base: Math.round(f.arr), hi: Math.round(f.hi), b: f.band }; }
// Echte Abweichungen je Quartal: Werbekosten, Großkunden, Kündigungen, Konsumklima – Streuung wie die Prognose-Bandbreite
function drawShock(v) {
  const s = confBand(v) / 2, m = vm(v), conf = M.mac ? M.mac.conf : -8, tilt = -0.5 * s * clamp((-8 - conf) / 20, -1, 1) * (0.3 + m.sens.cons);
  const deal = Math.random() < 0.12 ? s * (1 + Math.random()) : 0; // gelegentlich ein Großkunde (Größe skaliert mit der Planungsunsicherheit)
  return { n: Math.round(clamp(Math.exp(s * gauss() + tilt) + deal, 0.4, 2.2) * 1000) / 1000, c: Math.round(clamp(Math.exp(0.6 * s * gauss()), 0.5, 1.8) * 1000) / 1000, deal: deal > 0 ? 1 : 0, macro: tilt < -0.02 ? 1 : 0 };
}
// Begründung für Plan-vs.-Ist im Board-Bericht
function deviationWhy(v, dev) {
  const k = v.shk || { n: 1, c: 1 }, out = [];
  if (dev < 0) { if (k.n < 0.95) out.push(k.macro ? 'schwächeres Konsumklima und höhere CAC' : 'höhere Werbekosten (CAC-Spitze) und längere Vertriebszyklen'); if (k.c > 1.08) out.push('mehr Kündigungen als erwartet'); if (!out.length) out.push('Verzögerungen in Vertrieb und Produkt'); }
  else { if (v.cur && v.cur.sx) out.push('der Enterprise-Deal aus deinem Gründer-Sprint'); if (k.deal) out.push('ein Großkunden-Deal'); if (k.n > 1.05) out.push('starke organische Empfehlungen'); if (k.c < 0.93) out.push('treuere Kunden als geplant'); if (!out.length) out.push('günstigere Werbekosten'); }
  return out.slice(0, 2).join(' und ');
}

export function setHyper(A, on) {
  const v = own(A); if (!v) return 'Kein Startup.';
  if (on && !vm(v).hyper) return `${vm(v).name} ist nicht hyperscale-fähig: ${vm(v).why}`;
  v.hyper = { on: !!on, since: on ? v.qi : 0 }; setBudget(v); v.plan = planOf(v);
  if (!on) chron(v, 'Hyperscaling gestoppt – das aufgebaute Team kostet noch eine Weile weiter.', '');
  if (on) note(A, hyperReady(v) ? 'Hyperscaling gezündet: Das Marketingbudget verdreifacht sich.' : 'Achtung, Premature Scaling: Product-Market Fit oder Unit Economics reichen noch nicht – Kunden springen schnell wieder ab.', hyperReady(v) ? 'up' : 'dn');
  ENV.dirty(A); return null;
}
export function buildCapacity(A) {
  const v = own(A); if (!v) return 'Kein Startup.'; const m = vm(v); if (!m.cap) return 'Dein Geschäftsmodell braucht keine Fabriken – es skaliert digital.';
  migrate(v); if (v.cap.building || v.clk.some(c => c.k === 'cap')) return 'Es wird bereits ausgebaut.';
  const sub = subsidyActive(v), cost = capCost(v);
  if (v.cash < cost) return `Der Ausbau kostet ${fmtE(cost, 0)} – in der Firmenkasse sind ${fmtE(v.cash, 0)}.`;
  v.cash -= cost; v.cur.capex += cost; v.capexSum = (v.capexSum || 0) + cost; v.cap.building = 1; v.cap.qLeft = Math.max(1, m.cap.q + (ex(v, 'coo').capQ || 0)); clockAdd(v, { k: 'cap', s: 0, S: v.cap.qLeft * qDays(v) }); v.plan = planOf(v);
  note(A, `Kapazitätsausbau gestartet (${fmtE(cost, 0)}${sub ? ', 30 % Förderung' : ''}) – fertig in ${v.cap.qLeft} Quartal${v.cap.qLeft > 1 ? 'en' : ''}.`, 'up'); ENV.dirty(A); return null;
}
export const capCost = v => vm(v).cap ? r2(vm(v).cap.cost * Math.pow(1.9, v.cap.level - 1) * (subsidyActive(v) ? 0.7 : 1) * (1 - 0.1 * synergy(v))) : 0;
export const capacity = v => { const m = vm(v); return m.cap ? v.cap.level * m.cap.unit * (ex(v, 'coo').capU || 1) * treeFx(v).capU * (1 - (v.cap.wear || 0)) * Math.pow(1.6, v.cap.level - 1) : Infinity; };
function subsidyActive(v) { const m = vm(v); return !!(m.subsidy && M.mac && M.mac.stim > 0.3); }
export function hire(A, b) {
  const v = A.venture; if (!v || (v.status !== 'private_startup' && v.status !== 'public_listed')) return 'Kein aktives Unternehmen.';
  const R = EXECS[b.role]; if (!R) return 'Unbekannte Rolle.'; const a = R.a.find(x => x.k === b.k); if (!a) return 'Unbekannter Archetyp.';
  if (v.execs[b.role]) return `${R.name} ist bereits besetzt.`;
  let mix = b.mix !== undefined && isFinite(Number(b.mix)) ? clamp(Number(b.mix), 0, 1) : b.esop ? 1 : 0, pf = 1;
  if (Array.isArray(b.moves)) { // 3-Runden-Verhandlung mit Gegenangebot eines Börsenkonzerns
    migrate(v); if ((v.focus ?? 0) < FOCUS.cost.neg) return `Eine Verhandlung kostet ${FOCUS.cost.neg} Fokus.`; v.focus -= FOCUS.cost.neg;
    const moves = b.moves.map(String).filter(m => NEG_MOVES.exec[m]).slice(0, 4), st = negPlay('exec', Object.assign(negCtx(v), { rival: execRival(v) }), negSeed(v, hashS(b.role + b.k)), moves.includes('fix') ? moves : moves.concat('fix'));
    if (!st.ok) { note(A, `${a.name} hat abgesagt und geht zu ${execRival(v)}. ${st.why || ''}`, 'dn'); ENV.dirty(A); return null; }
    const T = negTermsOf('exec', st); mix = T.mix; pf = T.pay;
  }
  const pct = r2(EXEC_ESOP * mix * 1e4) / 1e4; // Mischung aus Gehalt und Mitarbeiteranteilen
  if (pct > 0) { if (v.capt.founder < pct + 0.05) return 'Zu wenig Gründeranteile für ein Aktienpaket.'; v.capt.founder -= pct; v.capt.esop += pct; }
  v.execs[b.role] = { k: a.k, mix: Math.round(mix * 100) / 100, pf: Math.round(pf * 100) / 100, t: v.qi };
  const pay = EXEC_PAY[Math.min(v.stage, 3)] * a.pay * pf * (1 - mix);
  note(A, `${a.name} als ${R.name} eingestellt – ${pay > 0 ? `${fmtE(pay, 0)} je Quartal` : ''}${pay > 0 && pct > 0 ? ' plus ' : ''}${pct > 0 ? `${fmt(pct * 100, 1)} % Mitarbeiteranteile` : ''}.`, 'up');
  if (v.status === 'private_startup') { setBudget(v); v.plan = planOf(v); } ENV.dirty(A); return null;
}
export function fire(A, role) { const v = A.venture; if (!v || !v.execs[role]) return 'Position ist nicht besetzt.'; delete v.execs[role]; chron(v, `${EXECS[role].name} entlassen – Board −5.`, 'dn'); v.board = clamp(v.board - 5, 0, 100); ENV.dirty(A); return null; }
/* ---------- Gründer-Sprints: aktive, optionale Hands-on-Aktionen mit Erfolgs-Spanne ---------- */
export const SPRINTS = {
  deal: { name: 'Enterprise-Deal-Pitch', days: 4, desc: 'Du pitchst selbst bei einem Konzern. Kostet Vertriebsbudget; Chance und Deal-Größe steigen mit Product-Market Fit und VP Growth.' },
  product: { name: 'Produkt- & Architektur-Sprint', days: 5, desc: 'Ein fokussierter Sprint am Produkt: Qualität und PMF steigen, Stress aus dem Hyperscaling wird abgebaut. Kostet F&E-Budget.' },
  audit: { name: 'Kosten- & Effizienz-Audit', days: 3, desc: 'Alle Verträge und Prozesse auf den Prüfstand: Die Burn Rate sinkt dauerhaft ein Stück, das Wachstum lahmt ein Quartal lang leicht.' },
  attack: { name: 'Konkurrenten-Attacke', days: 3, desc: 'Gezielter Angriff auf einen gelisteten Rivalen – Preisbrecher, Talent-Abwerbung, Patente oder PR-Blitz.' }
};
// Kosten, Dauer und Erfolgschance eines Sprints (Browser-Vorschau und Server-Ausführung nutzen dieselbe Rechnung)
export function sprintQuote(v, k, sub) {
  const S = SPRINTS[k]; if (!S) return null; const sp = spendQ(v), sh = rdShare(v), gx = v.execs && v.execs.growth, cx = v.execs && v.execs.cto, fx = v.execs && v.execs.cfo;
  if (k === 'deal') { const n = Math.max(1, v.customers * 0.025 * (0.5 + v.pmf)); return { k, days: S.days, cost: r2(Math.max(300, sp * (1 - sh) * 0.3)), p: clamp(0.2 + 0.6 * v.pmf + (gx ? (gx.k === 'eff' ? 0.12 : 0.06) : 0), 0.1, 0.9), lo: n * 0.6, hi: n * 1.4, arr: n * unit(v).arpuNew * 1.3 }; }
  if (k === 'product') return { k, days: S.days, cost: r2(Math.max(300, sp * sh * 0.3)), p: clamp(0.7 + (cx ? 0.15 : 0), 0, 0.92) };
  if (k === 'audit') return { k, days: S.days, cost: r2(Math.max(200, opexQ(v) * 0.05)), p: clamp(0.85 + (fx && fx.k === 'eff' ? 0.1 : 0), 0, 0.95), cut: (v.burnCut || 0) < 0.15 ? 0.03 : 0 };
  if (k === 'attack') { const C = CAMPAIGNS[sub]; if (!C) return null; return { k, sub, days: S.days, cost: r2(Math.max(2000, Math.max(0, v.cash) * C.cost)), p: clamp(0.6 + 0.2 * v.pmf, 0, 0.85) }; }
}
export function vSprint(A, b) { // ältere Aktion: Attacke und Audit laufen jetzt als Fokus-Züge mit Uhr
  const k = String(b.k || ''); if (k === 'attack' || k === 'audit') return vFocus(A, { op: k, sub: b.sub, rival: b.rival });
  return k === 'deal' ? 'Großdeals verhandelst du jetzt direkt in der Inbox.' : 'Produktentwicklung läuft jetzt über den Produktbaum.';
}
export function campaign(A, b) { return vSprint(A, { k: 'attack', sub: b.k, rival: b.rival }); } // alte Aktion: Kampagne = Attacke-Sprint
function sprintDone(A, v, s) {
  {
    const ok = Math.random() < s.p, u = unit(v), x = s.r ? I(s.r) : null;
    if (s.k === 'deal') {
      if (!ok) { chron(v, 'Enterprise-Pitch ohne Abschluss – der Konzern hat sich für den Platzhirsch entschieden.', 'dn'); return; }
      const q = sprintQuote(v, 'deal'), n = Math.min(Math.max(0, capacity(v) - v.customers), q.lo + Math.random() * (q.hi - q.lo)), add = n * u.arpuNew * 1.3;
      const base = v.arpuB || u.arpuNew / u.priceF; v.arpuB = (v.customers * base + n * base * 1.3) / Math.max(1e-9, v.customers + n); v.customers += n; v.arr = v.customers * v.arpuB * u.priceF;
      v.cur.sx = (v.cur.sx || 0) + add;
      note(A, `Enterprise-Sprint erfolgreich – +${fmtE(add, 0)} ARR (${fmt(n, n < 10 ? 1 : 0)} neue Kunden).`, 'up');
    } else if (s.k === 'product') {
      const g = ok ? 1 : 0.35, cv = v.execs && v.execs.cto && v.execs.cto.k === 'vision' ? 0.02 : 0;
      v.quality = clamp(v.quality + 0.06 * g, 0.3, 1.15); v.pmf = clamp(v.pmf + (0.03 + cv) * g, 0, 1); v.hyperCost = (v.hyperCost || 0) * (ok ? 0.85 : 0.95);
      chron(v, ok ? `Produkt-Sprint abgeschlossen – Qualität +${fmt(6, 0)}, PMF +${fmt((0.03 + cv) * 100, 0)} Punkte, weniger Team-Stress.` : 'Produkt-Sprint nur teilweise geschafft – kleine Verbesserungen.', ok ? 'up' : '');
    } else if (s.k === 'audit') {
      if (ok) v.burnCut = Math.min(0.15, (v.burnCut || 0) + 0.03);
      v.fx.push({ k: 'conv', m: 0.9, until: v.qi + 1 });
      chron(v, ok ? `Kosten-Audit: Fixkosten dauerhaft −3 % (insgesamt −${fmt(v.burnCut * 100, 0)} %), Vertrieb kurz gebremst.` : 'Kosten-Audit ohne große Einsparungen – der Vertrieb war trotzdem abgelenkt.', ok ? 'up' : 'dn');
    } else if (s.k === 'attack') {
      const g = ok ? 1 : 0.5, U = v.qi + 2;
      if (s.sub === 'price') v.fx.push({ k: 'arpu', m: 1 - 0.12 * g, until: U, camp: 1 }, { k: 'conv', m: 1 + 0.4 * g, until: U, camp: 1 });
      if (s.sub === 'poach') { v.pmf = clamp(v.pmf + 0.06 * g, 0, 1); if (x) x.padj = (x.padj || 0) - 0.01 * g; }
      if (s.sub === 'patent') { v.fx.push({ k: 'churn', m: 1 - 0.2 * g, until: U, camp: 1 }); if (x) x.padj = (x.padj || 0) - (vm(v).moat > 0.5 ? 0.03 : 0.01) * g; }
      if (s.sub === 'pr') { v.fx.push({ k: 'cac', m: 1 - 0.25 * g, until: U, camp: 1 }); v.pr = 0.1 * g; }
      v.target2 = s.r; const C = CAMPAIGNS[s.sub];
      if (x) addNews(`${v.name} ${ok ? 'trifft' : 'attackiert'} ${x.name}: ${C.name}`, 0, [x.id], { cat: 'company', sub: C.desc });
      chron(v, `${C.name} gegen ${x ? x.name : 'Rivalen'} ${ok ? 'voll erfolgreich' : 'mit halber Wirkung'}.`, ok ? 'up' : '');
    }
  }
}

/* ==================== Startup 3.0: Fokus, Produktbaum, Uhren, Tech Debt, Radar, Mandate, Verhandlungen ==================== */
// Effekte aller fertigen Produktknoten (≤ 3 Einträge – billig genug für jeden unit()-Aufruf)
export function treeFx(v) {
  const o = { cac: 1, arpu: 1, churn: 1, conv: 1, gm: 0, net: 0, capU: 1, opex: 1, plat: 0, pat: 0, done: 0 }, T = PRODUCT_TREE[v.model] || [];
  (v.tree || []).forEach((n, i) => { if (!n || !n.d) return; const N = T[i] && T[i].find(x => x.k === n.k); if (!N) return; o.done++;
    for (const k in N.fx) { if (k === 'gm' || k === 'net' || k === 'plat' || k === 'pat') o[k] += N.fx[k]; else o[k] *= N.fx[k]; } });
  return o;
}
export const nodeOf = (v, i, k) => (PRODUCT_TREE[v.model] || [])[i] && PRODUCT_TREE[v.model][i].find(x => x.k === k);
// PMF-Decke: ohne fertige Produktknoten bleibt der Product-Market Fit begrenzt; Treffer im Kunden-Radar heben sie zusätzlich
export const pmfCap = v => Math.min(1, 0.45 + 0.17 * treeFx(v).done + 0.05 * (v.hits || 0));
// CleanTech: Förder-Synergie aus aktiven Energie-/Konjunktur-Storylines, Konjunkturpaket und Energiepreis (Stufe 0–3)
export function synergy(v) {
  if (v.model !== 'cleantech') return 0; let n = 0;
  if ((M.sec && M.sec.pol || []).some(e => !e.done && e.sectors && (e.sectors === 'all' || e.sectors.includes('energy')) && (e.k === 'stimulus' || e.k === 'dereg'))) n++;
  if (M.mac && M.mac.stim > 0.3) n++; if (M.mac && M.mac.energy > 0.1) n++;
  return Math.min(3, n);
}
// DeepTech: ohne gemeinsame Plattform wird jede weitere Ausbaustufe komplexer (−2 Punkte Bruttomarge je Stufe)
export const complexity = v => v.model === 'deeptech' && v.cap && !treeFx(v).plat ? 0.02 * Math.max(0, v.cap.level - 1) : 0;
// Kunden-Radar: drei stärkste Marktsignale
export function radarNow() {
  const mac = M.mac || { conf: -8, gdp: 1.5, stim: 0, energy: 0, tarImp: 0 }, lz = M.lz === undefined ? 0.02 : M.lz, pol = (M.sec && M.sec.pol) || [];
  const sc = { cost: lz * 25 + Math.max(0, -mac.conf - 8) / 8, ai: 1 + 0.3 * (mac.gdp - 1.5) + (pol.some(e => e.k === 'exportban' && !e.done) ? 0.6 : 0), privacy: 0.6 + 0.5 * pol.filter(e => !e.done && (e.k === 'antitrust' || e.k === 'dereg')).length,
    green: 0.4 + 2 * Math.max(0, mac.stim) + 3 * Math.max(0, mac.energy || 0), security: 0.4 + (mac.tarImp || 0) / 20 + (pol.some(e => e.k === 'defense' && !e.done) ? 0.8 : 0), scale: 0.6 + Math.max(0, 0.03 - lz) * 40 + Math.max(0, mac.conf + 8) / 10 };
  return Object.keys(sc).sort((a, b) => sc[b] - sc[a]).slice(0, 3);
}
const focusRegen = v => (v.debt || 0) > 0.5 || (v.moral ?? 1) < 0.4 ? FOCUS.regenLow : FOCUS.regen;
export const nodeScale = v => Math.sqrt(1 + v.arr / 5e5);
// Ältere Spielstände auf das neue Modell heben (Sprints → Uhren, Kapazitätsausbau → Bau-Uhr, Investorenziel → Mandat)
function migrate(v) {
  if (v.focus === undefined) { v.focus = 4; v.tree = [null, null, null]; v.debt = 0; v.moral = 0.9; v.auth = 50; v.clk = []; v.pat = []; v.radar = radarNow(); v.hits = 0; v.miss = 0; }
  if (v.sp) { for (const s of v.sp) if (s.k === 'attack' || s.k === 'audit') v.clk.push({ i: v.seq++, k: s.k === 'attack' ? 'atk' : 'audit', sub: s.sub, r: s.r, s: s.D - s.d, S: s.D, p: s.p }); delete v.sp; }
  if (v.cap && v.cap.building && !v.clk.some(c => c.k === 'cap')) { v.clk.push({ i: v.seq++, k: 'cap', s: 0, S: Math.max(1, v.cap.qLeft) * qDays(v) }); }
  if (v.target && !v.mand) { v.mand = { arr: v.target.arr, q: v.target.q }; delete v.target; }
}
export function clockAdd(v, c) { c.i = v.seq++; (v.clk = v.clk || []).push(c); if (v.clk.length > 6) v.clk.shift(); return c; }
// Täglicher Betrieb (im open-Hook, einmal je Handelstag): Fokus, Uhren, Patente, Ausfälle, Kurz-Bilanz des Tages
function daily(A, v, before) {
  migrate(v);
  v.focus = Math.min(FOCUS.max, (v.focus || 0) + focusRegen(v));
  const rdDay = v.cur.rd - before.rd;
  for (const c of [...v.clk]) {
    if (c.k === 'node') { const step = NODE_COST[c.t] * nodeScale(v) / NODE_STEPS[c.t]; c.s = Math.min(c.S, c.s + Math.min(1, step > 0 ? rdDay / step : 1)); }
    else c.s = Math.min(c.S, c.s + 1);
    if (c.s >= c.S - 1e-9) { v.clk.splice(v.clk.indexOf(c), 1); clockDone(A, v, c); }
  }
  for (const p of v.pat || []) p.d--; if (v.pat) v.pat = v.pat.filter(p => p.d > 0);
  if (v.hyper && v.hyper.on && Math.random() < 0.03 * (v.debt || 0)) { v.customers *= 0.97; v.quality = clamp(v.quality - 0.03, 0.3, 1.15); chron(v, `Ausfall unter Last: Technische Schuld ${Math.round(v.debt * 100)} % – 3 % der Kunden gehen, Qualität −3.`, 'dn'); }
  v.last = [Math.round((v.cur.newC - before.newC) * 10) / 10, Math.round(v.arr - before.arr), Math.round(v.cash - before.cash)]; // Tages-Puls: Neukunden, ΔARR, ΔKasse
}
function clockDone(A, v, c) {
  if (c.k === 'node') {
    const N = nodeOf(v, c.t, c.n); v.tree[c.t] = { k: c.n, d: 1, m: c.m };
    const hit = N.tags.some(t => (v.radar || []).includes(t)); if (hit) { v.hits = (v.hits || 0) + 1; v.pmf = clamp(v.pmf + 0.05, 0, 1); } else v.miss = (v.miss || 0) + 1;
    if (N.fx.pat) { const D = 120; (v.pat = v.pat || []).push({ k: c.n, n: N.name, d: D, D, v: N.fx.pat * (1 + v.stage) }); if (v.pat.length > 3) v.pat.shift(); }
    if (v.trial) v.pmf = clamp(v.pmf + 0.03, 0, 1);
    addInbox(v, { k: 'launch', title: `${N.name} ist fertig – wie launchen?`, text: `Die Entwicklung ist abgeschlossen${hit ? ' und trifft ein aktuelles Marktsignal (PMF +5)' : ' – sie trifft gerade kein Marktsignal, das kostet laufend etwas Fixkosten'}.`, opts: [{ k: 'silent', label: 'Silent Beta' }, { k: 'keynote', label: 'Keynote-Launch' }], def: 0, data: { n: c.n } });
    note(A, `${N.name} fertig${N.fx.pat ? ` – Patent angemeldet (${fmtE(N.fx.pat * (1 + v.stage), 0)}, 120 Tage)` : ''}.`, 'up');
  } else if (c.k === 'cap') { v.cap.level++; v.cap.building = 0; v.cap.wear = 0; note(A, `${v.name}: Neue Kapazität ist in Betrieb (Stufe ${v.cap.level}).`, 'up'); }
  else if (c.k === 'int') chron(v, `Integration abgeschlossen – die Organisation läuft wieder normal.`, 'up');
  else if (c.k === 'atk' || c.k === 'audit') sprintDone(A, v, { k: c.k === 'atk' ? 'attack' : 'audit', sub: c.sub, r: c.r, p: c.p });
}
// Sofortige taktische Züge mit Fokus-Punkten (eine Aktion, keine Wartezeit)
export function focusQuote(v, b) {
  const C = FOCUS.cost, op = b.op;
  if (op === 'node') { const t = Number(b.t), N = nodeOf(v, t, b.n); if (!N) return { err: 'Unbekannter Produktknoten.' };
    const mvp = b.m === 'mvp', S = Math.max(2, Math.round(NODE_STEPS[t] * (mvp ? 0.5 : 1))); return { f: mvp ? C.mvp : C.clean, S, cost: r2(NODE_COST[t] * nodeScale(v) * (mvp ? 0.5 : 1)), debt: mvp ? 0.15 : 0, N }; }
  if (op === 'push') return { f: C.push };
  if (op === 'refactor') return { f: C.refactor, cost: r2(Math.max(200, spendQ(v) * rdShare(v) * 0.1)), debt: -0.15 };
  if (op === 'ab') return { f: C.ab, cost: r2(Math.max(150, spendQ(v) * (1 - rdShare(v)) * 0.05)), p: 0.65 };
  if (op === 'audit') { const q = sprintQuote(v, 'audit'); return { f: C.audit, cost: q.cost, p: q.p }; }
  if (op === 'attack') { const q = sprintQuote(v, 'attack', b.sub); return q ? { f: C.attack, cost: q.cost, p: q.p, days: q.days } : { err: 'Unbekannte Attacke.' }; }
  if (op === 'repath') { const t = Number(b.t); return { f: C.repath, cost: r2(NODE_COST[t] * nodeScale(v) * 0.6), debt: 0.1 }; }
  return { err: 'Unbekannter Zug.' };
}
export function vFocus(A, b) {
  const v = own(A); if (!v) return 'Fokus-Züge gibt es nur für ein laufendes Startup.'; migrate(v);
  const q = focusQuote(v, b); if (q.err) return q.err;
  if ((v.focus || 0) < q.f) return `Dafür brauchst du ${q.f} Fokus – du hast ${v.focus}. Fokus lädt sich jeden Handelstag auf.`;
  if (q.cost && v.cash < q.cost) return `Das kostet ${fmtE(q.cost, 0)} – in der Firmenkasse sind ${fmtE(v.cash, 0)}.`;
  const op = b.op, t = Number(b.t);
  if (op === 'node') {
    if (v.tree[t] && v.tree[t].k !== b.n) return 'Diese Stufe ist schon auf den anderen Pfad festgelegt – nur ein teures Umbauen (Refactoring des Pfads) öffnet sie wieder.';
    if (v.tree[t]) return 'Dieser Knoten ist schon fertig.'; if (t > 0 && !(v.tree[t - 1] && v.tree[t - 1].d)) return 'Erst die vorherige Produktstufe fertigstellen.';
    if (v.clk.some(c => c.k === 'node')) return 'Es läuft bereits eine Produktentwicklung.';
    clockAdd(v, { k: 'node', t, n: b.n, m: b.m === 'mvp' ? 'mvp' : 'clean', s: 0, S: q.S });
    v.debt = clamp((v.debt || 0) + q.debt, 0, 1);
    chron(v, `Entwicklung gestartet: ${q.N.name} (${b.m === 'mvp' ? 'MVP, +15 % Tech Debt' : 'saubere Architektur'}) – ${q.S} Schritte.`, 'up');
  } else if (op === 'push') {
    const c = v.clk.find(x => x.i === Number(b.i)); if (!c) return 'Diese Maßnahme läuft nicht mehr.'; if (c.k === 'int') return 'Die Integration lässt sich nicht beschleunigen.';
    c.s = Math.min(c.S, c.s + 1); if (c.s >= c.S - 1e-9) { v.clk.splice(v.clk.indexOf(c), 1); clockDone(A, v, c); } else chron(v, 'Fokus eingesetzt: +1 Schritt.', '');
  } else if (op === 'refactor') { v.debt = clamp((v.debt || 0) + q.debt, 0, 1); v.quality = clamp(v.quality + 0.02, 0.3, 1.15); chron(v, `Refactoring: Technische Schuld jetzt ${Math.round(v.debt * 100)} %.`, 'up'); }
  else if (op === 'ab') { const ok = Math.random() < q.p; if (ok) v.fx.push({ k: 'cac', m: 0.95, until: v.qi + 1 }); chron(v, ok ? 'A/B-Test erfolgreich: Kundengewinnung 5 % günstiger bis zum Board-Meeting.' : 'A/B-Test ohne klaren Sieger – nichts gewonnen, nichts verloren.', ok ? 'up' : ''); }
  else if (op === 'audit' || op === 'attack') {
    if (v.clk.some(c => c.k === (op === 'attack' ? 'atk' : 'audit'))) return 'Läuft bereits.';
    if (op === 'attack' && !v.rivals.includes(b.rival)) return 'Bitte einen Rivalen wählen.';
    clockAdd(v, { k: op === 'attack' ? 'atk' : 'audit', sub: b.sub, r: b.rival, s: 0, S: op === 'attack' ? 3 : 3, p: Math.round(q.p * 100) / 100 });
    const x = op === 'attack' ? I(b.rival) : null; chron(v, `${op === 'attack' ? `${CAMPAIGNS[b.sub].name} gegen ${x ? x.name : 'Rivalen'}` : 'Kosten-Audit'} gestartet (Chance ~${Math.round(q.p * 100)} %).`, 'up');
  } else if (op === 'repath') {
    if (!v.tree[t]) return 'Auf dieser Stufe ist noch kein Pfad gewählt.';
    for (let i = t; i < 3; i++) v.tree[i] = null; v.clk = v.clk.filter(c => !(c.k === 'node' && c.t >= t)); v.debt = clamp((v.debt || 0) + q.debt, 0, 1);
    chron(v, `Pfad ab Stufe ${t + 1} zurückgebaut – teuer, aber der andere Weg ist wieder offen.`, 'dn');
  }
  v.flow = (v.flow || 0) + 1; v.focus -= q.f; if (q.cost) { v.cash -= q.cost; if (op === 'node' || op === 'refactor' || op === 'repath') v.cur.rd += q.cost; else v.cur.mkt += q.cost; }
  v.plan = planOf(v); ENV.dirty(A); return null;
}

/* ---------- 3-Runden-Verhandlungen: deterministisch (fester Seed), läuft im Browser und wird im Worker nachgespielt ---------- */
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const NEG_MOVES = {
  vc: { demo: 'CTO-Produktdemo', milestone: 'Meilenstein anbieten', push: 'Höhere Bewertung fordern', fix: 'Jetzt abschließen' },
  deal: { demo: 'CTO-Produktdemo', milestone: 'Laufzeit-Bindung anbieten', push: 'Rabatt verweigern', fix: 'Jetzt abschließen' },
  exec: { demo: 'Vision pitchen', esop: 'Gehalt gegen ESOP tauschen', push: 'Gehalt drücken', fix: 'Jetzt abschließen' }
};
export function negInit(kind, ctx) {
  const st = { int: kind === 'exec' ? 45 : 50, pat: 3, str: 15, push: 0, ms: 0, mix: kind === 'exec' ? 0.3 : 0, done: 0, ok: 0, r: 0 };
  st.att = kind === 'vc' ? (ctx.g > 0.25 ? 'Investor achtet stark auf Wachstumstempo' : 'Investor achtet auf solide Unit Economics') : kind === 'deal' ? 'Einkauf will Rabatt und lange Bindung' : `${ctx.rival || 'Ein Börsenkonzern'} bietet mit – Kandidat fordert Beteiligung`;
  return st;
}
export function negStep(kind, st, mv, ctx, rnd) {
  if (st.done) return st; const s = Object.assign({}, st), u = (lo, hi) => lo + (hi - lo) * rnd();
  if (mv === 'fix') { s.done = 1; s.ok = s.int >= 30 ? 1 : 0; return s; }
  if (mv === 'demo') { s.int += u(6, 10) + 22 * (ctx.pmf || 0.5) + (ctx.cto ? 5 : 0); s.str += 5; }
  else if (mv === 'milestone') { s.int += u(8, 14); s.ms++; s.str -= 8; }
  else if (mv === 'esop' && kind === 'exec') { s.mix = Math.min(1, s.mix + 0.25); s.int += u(4, 9); }
  else if (mv === 'push') { s.push++; s.int -= u(6, 12); s.str += u(18, 30); }
  else return s;
  s.r++; s.pat--; s.int = clamp(s.int, 0, 100); s.str = clamp(s.str, 0, 100);
  if (s.str >= 100) { s.done = 1; s.ok = 0; s.why = 'Zu viel Druck – die Gegenseite bricht ab.'; }
  else if (s.pat <= 0) { s.done = 1; s.ok = s.int >= 40 ? 1 : 0; if (!s.ok) s.why = 'Die Geduld ist aufgebraucht.'; }
  return s;
}
export function negPlay(kind, ctx, seed, moves) { const rnd = rng(seed); let st = negInit(kind, ctx); for (const m of (moves || []).slice(0, 4)) st = negStep(kind, st, m, ctx, rnd); return st; }
// Konditionen aus dem Verhandlungsstand
export function negTermsOf(kind, st, d) {
  const i = st.int / 100;
  if (kind === 'vc') { const pre = r2(d.loPre + (d.hiPre - d.loPre) * i * (1 + 0.06 * st.push)), dil = Math.round((d.dLo - (d.dLo - d.dHi) * i) * 1000) / 1000; return { pre, dil, raise: r2(pre * dil / (1 - dil)), tgt: r2(d.tgt * (0.75 + 0.1 * st.push + 0.12 * st.ms)) }; }
  if (kind === 'deal') return { n: Math.max(1, Math.round(d.n * (0.6 + 0.8 * i))), disc: clamp(0.3 - 0.15 * i - 0.04 * st.push, 0.05, 0.35), lock: st.ms };
  return { pay: clamp(1.15 - 0.3 * i - 0.08 * st.push, 0.6, 1.3), mix: st.mix };
}
export const negSeed = (v, salt) => (Number(salt) * 2654435761 + (v.t0 || 0) % 1e9 + (v.qi || 0) * 97) >>> 0;

/* ---------- Tagesgeschäft (Autopilot) ---------- */
function dayStep(A, v) {
  const m = vm(v), u = unit(v), f = 1 / qDays(v), sh = v.shk || { n: 1, c: 1 };
  if (v.budget === undefined) setBudget(v);
  const commit = budgetFloor(v) * f, spend = Math.max(Math.min(v.budget * f, Math.max(0, v.cash + v.arr / 4 * f)), Math.min(commit, v.budget * f)), rdS = spend * rdShare(v), mktS = spend - rdS; // frei verfügbares Budget nur mit Geld, gebundene Ausgaben laufen weiter
  v.budgetLeft -= spend; if (v.hyper && v.hyper.on) v.cur.hyp = (v.cur.hyp || 0) + spend;
  const opex = (opexQ(v) - salaryOf(v)) * f; // Gründergehalt separat (nur wenn Geld da ist)
  // F&E: Product-Market Fit und Qualität (bei Biotech: Studienfortschritt)
  v.rdSum += rdS;
  if (m.trial) { const T = TRIAL[Math.min(v.trial.phase, 3)]; if (v.trial.phase < 4) v.trial.prog = Math.min(1.2, v.trial.prog + Math.min(rdS / T.cost * (ex(v, 'cto').pmf || 1), f / T.minQ)); v.pmf = clamp(v.pmf + f * 0.04 * (v.trial.phase >= 4 ? 1 : 0.3), 0, 1); }
  else { const pT = 0.25 + 0.75 * (1 - Math.exp(-v.rdSum / (RD_NEED[v.model] * Math.pow(1 + v.arr / 2e6, 0.35)))); v.pmf = clamp(v.pmf + f * 0.35 * (ex(v, 'cto').pmf || 1) * (Math.min(pT, pmfCap(v)) * (0.6 + 0.4 * v.quality) - v.pmf) , 0.05, 1); }
  const stress = v.hyper && v.hyper.on ? 0.07 * (ex(v, 'cto').stress || 1) : 0;
  if (stress && !v._sim && v.hypQ !== v.qi && v.quality < 0.95) { v.hypQ = v.qi; chron(v, `Hyperscaling erhöht die Serverlast – Produktqualität ${fmt(v.quality * 100, 0)} %.`, 'dn'); }
  v.quality = clamp(v.quality + f * (0.05 * (1 - v.quality) + (ex(v, 'cto').quality || 0) - stress + 0.04 * (rdShare(v) - 0.4) + effOf(v).q - 0.03 * (v.debt || 0)), 0.3, 1.15);
  // Kunden: bezahlt + organisch (Mundpropaganda, Netzwerkeffekt) − Abwanderung, begrenzt durch Kapazität und Zulassung
  const approved = !m.trial || v.trial.phase >= 4;
  let newC = mktS / u.cac * u.conv * fxOf(v, 'conv');
  if (v.stage < 2 && v.status === 'private_startup') newC += f * HUSTLE[v.model] * (1 + 2 * v.pmf) * (v.stage === 0 ? 1 : 0.5) * (approvedNow(v) ? 1 : 0.4);
  const nt = Math.min(1, m.net + treeFx(v).net); newC += v.customers * f * (0.05 * v.pmf * v.pmf * (0.4 + nt) + (u.share > 0.2 ? 0.12 * nt * (u.share - 0.2) : 0)) * (v.growthPen && v.growthPen > v.qi ? 0.7 : 1);
  if (!approved) newC = Math.min(newC, Math.max(0, 2 + v.trial.phase - v.customers)); // vor der Zulassung nur Lizenz- und Forschungspartner
  if (m.trial && approved) newC += v.customers * f * 0.3; // Markteinführung: Ärzte und Kliniken verschreiben das zugelassene Produkt weiter
  newC *= Math.pow(Math.max(0, 1 - u.share), 1.6) * sh.n; // Sättigung + Quartals-Schwankung (Werbekosten, Deals, Konjunktur)
  const churnC = v.customers * u.churn * f * sh.c;
  const c0 = v.customers, c1 = Math.max(0, Math.min(capacity(v), c0 + newC - churnC)), added = Math.max(0, c1 - (c0 - churnC));
  v.arpuB = c1 > 0 ? ((c0 - churnC > 0 ? (c0 - churnC) * (v.arpuB || u.arpuNew / u.priceF) : 0) + added * u.arpuNew / u.priceF) / Math.max(1e-9, Math.max(0, c0 - churnC) + added) : (v.arpuB || 0);
  v.customers = c1;
  v.arr = v.customers * (v.arpuB || 0) * u.priceF * (approved ? 1 : 0.6);
  const rev = v.arr / 4 * f, gross = rev * u.gm;
  if (salaryOf(v) > 0 && v.cash > 0) { const s = Math.min(v.cash, salaryOf(v) * f); v.cash -= s; v.cur.opex += s; if (!v._sim) { A.cash += s; v.paid = (v.paid || 0) + s; book(A, 'venture', r2(s), `Gründergehalt ${v.name}`); } }
  v.cash += gross - opex - spend;
  Object.assign(v.cur, { rev: v.cur.rev + rev, gross: v.cur.gross + gross, opex: v.cur.opex + opex, mkt: v.cur.mkt + mktS, rd: v.cur.rd + rdS, newC: v.cur.newC + newC, churnC: v.cur.churnC + churnC, days: v.cur.days + 1 });
}
const active = v => v && (v.status === 'private_startup' || v.status === 'public_listed');
// Autopilot: genau ein Schritt je Handelstag (idempotent – ein zweites „open“ am selben Tag rechnet nichts doppelt)
hook('open', () => {
  const today = dayStart(M.t);
  for (const A of ENV.accounts()) {
    const v = A.venture; if (!active(v) || v.lastDay === today) continue;
    v.lastDay = today; v.age = (v.age || 0) + 1; migrate(v);
    const before = { rd: v.cur.rd, newC: v.cur.newC, arr: v.arr, cash: v.cash };
    dayStep(A, v); daily(A, v, before);
    if (v.status === 'public_listed') { const x = I(v.listedId); if (x && x.fin) x.fin.rev = v.arr / 4; }
    else if (v.status === 'private_startup' && ++v.day >= qDays(v)) board(A, v);
    ENV.dirty(A);
  }
});

/* ---------- Quartals-Board-Meeting ---------- */
function board(A, v) {
  const m = vm(v), u = unit(v), c = v.cur, ebit = c.gross - c.opex - c.mkt - c.rd - c.capex;
  const prevArr = v.q.length ? v.q[v.q.length - 1].arr : 0, g = prevArr > 0 ? v.arr / prevArr - 1 : null;
  // Board-Zufriedenheit: Wachstum, Runway, Ziele der Investoren
  let mood = (g === null ? 0 : clamp(g * 40, -15, 15)) + (runway(v) < 6 ? -8 : 2) + (v.pmf > 0.7 ? 3 : 0) - (v.hyper.on && !hyperReady(v) ? 6 : 0);
  migrate(v);
  if (v.mand && v.qi >= v.mand.q) { if (v.arr >= v.mand.arr) { mood += 10; v.auth = clamp((v.auth ?? 50) + 15, 0, 100); chron(v, `Board-Mandat erfüllt (${fmtE(v.mand.arr, 0)} ARR) – Autorität +15.`, 'up'); } else { mood -= 15; v.auth = clamp((v.auth ?? 50) - 20, 0, 100); v.down = (v.down || 1) * 0.8; addInbox(v, { k: 'info', title: 'Board-Mandat verfehlt', text: `Das vereinbarte ARR-Ziel von ${fmtE(v.mand.arr, 0)} wurde verpasst. Autorität −20, die nächste Finanzierungsrunde wird mit Abschlag bewertet (Down Round).` }); } v.mand = null; }
  v.board = clamp(v.board + mood, 0, 100);
  const P = v.plan, dev = P && P.base > 0 ? v.arr / P.base - 1 : 0, why = P && Math.abs(dev) >= 0.05 ? deviationWhy(v, dev) : '';
  if (P && Math.abs(dev) >= 0.05) chron(v, `ARR ${dev > 0 ? '+' : ''}${fmt(dev * 100, 0)} % ${dev > 0 ? 'über' : 'unter'} Plan: ${why}.`, dev > 0 ? 'up' : 'dn');
  v.q.push({ q: qName(v.qi), t: M.t, plan: P ? [P.lo, P.base, P.hi] : null, why, rev: c.rev, gross: c.gross, ebit, arr: v.arr, cust: v.customers, newC: c.newC, churnC: c.churnC, cash: v.cash, gm: u.gm, cac: u.cac, ltv: u.ltv, churn: u.churn, pmf: v.pmf, share: u.share, board: v.board, val: valuation(v) });
  { const r = v.q[v.q.length - 1]; for (const k in r) if (typeof r[k] === 'number' && k !== 't') r[k] = +r[k].toPrecision(5); if (r.plan) r.plan = r.plan.map(x => +x.toPrecision(5)); } // kompakt speichern
  if (v.q.length > 12) v.q.shift();
  v.qi++; v.day = 0; v.cur = blankCur(); v.pr = 0;
  // Hyperscaling-Team: wächst mit, solange skaliert wird, und baut sich danach nur langsam ab
  v.hyperCost = (v.hyperCost || 0) * 0.5 + 0.2 * (c.hyp || 0);
  v.fx = (v.fx || []).filter(e => e.until > v.qi);
  // Kapazitätsausbau, Studien
  if (v.cap && v.model === 'deeptech') v.cap.wear = Math.min(0.2, (v.cap.wear || 0) + 0.02); // Verschleiß der Anlagen, ein neuer Ausbau setzt ihn zurück
  v.hq = v.hyper && v.hyper.on ? (v.hq || 0) + 1 : 0; v.moral = clamp((v.moral ?? 0.9) + (v.hq >= 2 ? -0.12 : 0.08), 0.1, 1); // Dauer-Hyperscaling zehrt am Team
  v.radar = radarNow();
  if (v.trial && v.trial.phase < 4 && v.trial.prog >= 1) trialReadout(A, v);
  setBudget(v); // Budget für das neue Quartal
  // Phase
  const ipoOk = v.qi >= IPO_MIN_QUARTERS && (v.arr >= (m.ipoArr || VENTURE_STAGES[3].min) || (m.trial && v.trial && v.trial.phase >= 3 && v.trial.prog >= 0.4 && valuation(v) >= 1e9)); // Biotech darf vor der Zulassung an die Börse
  const ns = ipoOk ? 3 : VENTURE_STAGES.reduce((k, s, i) => (i < 3 && v.arr >= s.min ? i : k), 0);
  if (ns !== v.stage) { const up = ns > v.stage; v.stage = ns; note(A, `${v.name} ${up ? 'erreicht' : 'fällt zurück in'} die Phase „${vstage(v).name}“.`, up ? 'tier' : 'dn'); if (up) addNews(`${v.name} wächst: ${fmtBig(v.arr)} € Jahresumsatz`, 1, [], { cat: 'company', sub: `Das Startup von ${A.name} ist jetzt in der Phase „${vstage(v).name}“.` }); }
  // Erfolge
  if (v.pmf >= 0.8) ENV.event(A, 'pmf'); if (v.arr >= 1e6) ENV.event(A, 'arr1m'); if (valuation(v) >= 1e9) ENV.event(A, 'unicorn');
  duel(A, v, u); rivalAI(A, v, u); government(A, v, u); offers(A, v, u);
  // Pleite-Gefahr
  if (v.cash < 0) { v.fail = (v.fail || 0) + 1; if (v.fail >= 3) return bankrupt(A, v); addInbox(v, { k: 'info', title: 'Kasse leer', text: `${v.name} ist im Minus (${fmtE(v.cash, 0)}). Lege Geld ein, nimm eine Finanzierungsrunde an oder senke die Kosten – nach ${3 - v.fail} weiteren Quartal${3 - v.fail > 1 ? 'en' : ''} droht die Insolvenz.` }); }
  else v.fail = 0;
  // Ignorierte Entscheidungen: nach zwei Quartalen greift der Standard
  for (const it of [...v.inbox]) if (it.opts && v.qi - it.q >= 2) { decideItem(A, v, it, it.def, true); v.board = clamp(v.board - 8, 0, 100); }
  v.inbox = v.inbox.filter(it => it.opts || v.qi - it.q < 3);
  if (v.board < 15 && v.capt.inv.length) addInbox(v, { k: 'info', title: 'Der Aufsichtsrat ist unzufrieden', text: 'Die Investoren drängen auf profitables Wachstum. Senke das Tempo oder verbessere die Unit Economics, sonst sinken die Bewertungen.' });
  v.shk = drawShock(v); v.plan = planOf(v); // neue Schwankung und neuer Prognose-Korridor fürs nächste Quartal
  note(A, `Board-Meeting ${v.q[v.q.length - 1].q}: ARR ${fmtE(v.arr, 0)}${g !== null ? ` (${pct(g, 0)})` : ''}, Kasse ${fmtE(v.cash, 0)}, Board ${Math.round(v.board)}/100`, g !== null && g < 0 ? 'dn' : 'up');
}
function trialReadout(A, v) {
  const T = TRIAL[v.trial.phase], ok = Math.random() < T.p + 0.15 * (v.pmf - 0.5);
  const dead = !ok && v.trial.phase >= 2 && Math.random() < 0.3; // der Wirkstoff ist gescheitert – zurück auf Anfang mit neuem Kandidaten
  if (ok) { v.trial.phase++; v.trial.prog = 0; v.pmf = clamp(v.pmf + 0.12, 0, 1); }
  else if (dead) { v.trial.phase = 1; v.trial.prog = 0; v.pmf = clamp(v.pmf - 0.2, 0.1, 1); v.down = (v.down || 1) * 0.7; }
  else v.trial.prog = 0.35;
  const done = v.trial.phase >= 4;
  addNews(ok ? `${v.name}: ${T.name} erfolgreich${done ? ' – Zulassung erteilt' : ''}` : dead ? `${v.name}: Wirkstoff scheitert in ${T.name}` : `${v.name}: ${T.name} verfehlt das Studienziel`, ok ? 1 : -1, [], { cat: 'company', sub: ok ? (done ? 'Das Medikament darf verkauft werden. Patente schützen es für Jahre.' : `Nächster Schritt: ${TRIAL[v.trial.phase].name}.`) : dead ? 'Der Kandidat wird eingestellt. Mit einem Nachfolger beginnt die klinische Entwicklung neu – die Bewertung bricht ein.' : 'Ein Teil der Studie muss wiederholt werden – das kostet Zeit und Geld.' });
  note(A, ok ? `${T.name} bestanden!${done ? ' Dein Produkt ist zugelassen.' : ''}` : dead ? `${T.name}: Wirkstoff gescheitert – ihr startet mit einem neuen Kandidaten in Phase I.` : `${T.name} gescheitert – Studie wird teilweise wiederholt.`, ok ? 'tier' : 'dn');
}
function bankrupt(A, v) {
  v.status = 'failed'; v.failedT = M.t;
  addNews(`${v.name} meldet Insolvenz an`, -1, [], { cat: 'company', sub: 'Das Geld ist ausgegangen. Die Gründer verlieren ihren Einsatz – persönlich haften sie nicht.' });
  book(A, 'venture', 0, `${v.name} insolvent – Beteiligung verloren`);
  note(A, `${v.name} ist insolvent. Deine Beteiligung ist verloren, weitere Schulden entstehen dir nicht. Du kannst jederzeit neu gründen.`, 'dn'); ENV.dirty(A);
}

/* ---------- Markt-Duell: Marktanteile kosten gelistete Rivalen echten Gewinn ---------- */
function duel(A, v, u) {
  const d = u.share - (v.lastShare || 0); v.lastShare = u.share; if (!(d > 0.0005)) return;
  const T = segTAM(v); let best = null;
  for (const id of v.rivals) {
    const x = I(id); if (!x || x.delisted || !x.fin) continue;
    const w = v.w[id] * (v.target2 === id ? 1.8 : 1), lostPts = d * w / (v.target2 ? 1.27 : 1), lostRev = lostPts * T, revA = x.fin.rev * 4;
    x.padj = (x.padj || 0) - clamp(1.5 * lostRev / revA, 0, 0.3);
    const before = v.lost[id] || 0; v.lost[id] = before + lostPts; if (!best || lostPts > best[1]) best = [x.name, lostPts];
    if (Math.floor(v.lost[id] / 0.05) > Math.floor(before / 0.05)) {
      const j = -clamp(3 * lostRev / revA + 0.01, 0.005, 0.08); x.f *= Math.exp(j); x.price = x.f * Math.exp(x.tr); setWhy(x, `${pct(j, 1)} – verliert Kunden an ${v.name}`, j); recomputeDerived();
      addNews(`${v.name} jagt ${x.name} Marktanteile ab`, -1, [x.id], { cat: 'company', eff: j, sub: `Seit dem Start hat ${x.name} rund ${fmt(v.lost[id] * 100, 0)} Prozentpunkte im Segment verloren. Das schlägt bei den nächsten Quartalszahlen durch.` });
    }
  }
  if (best && best[1] >= 0.0005) chron(v, `${fmt(best[1] * 100, best[1] < 0.01 ? 2 : 1)} Pp Marktanteil von ${best[0]} gewonnen.`, 'up');
}
function rivalAI(A, v, u) {
  for (const id of v.rivals) {
    const x = I(id); if (!x || x.delisted) continue; const pr = rivalProfile(x);
    const p = (0.03 + 1.6 * u.share + (v.lost[id] || 0) * 2) * pr.aggr; if (Math.random() > p) continue;
    const r = Math.random(), V = valuation(v);
    if (V > 3e6 && u.share > 0.01 && pr.cash >= 0.5 && r < 0.25 && !v.inbox.some(i => i.k === 'buyout')) {
      const price = r2(V * (1.2 + Math.random() * 0.4) * (ex(v, 'cfo').val || 1) * (1 + ((v.auth ?? 50) - 50) / 500));
      addInbox(v, { k: 'buyout', title: `${x.name} will ${v.name} kaufen`, text: `Angebot: ${fmtE(price, 0)} für das ganze Unternehmen (${pct(price / V - 1, 0)} über der aktuellen Bewertung). Dein Anteil (${fmt(founderPct(v) * 100, 1)} %) wäre ${fmtE(price * founderPct(v), 0)} wert – sofort und in bar. Lehnst du ab, bleibt der Weg zum eigenen Börsengang.`, opts: [{ k: 'accept', label: 'Verkaufen (Exit)' }, { k: 'reject', label: 'Ablehnen' }], def: 1, data: { id, price } });
      addNews(`Gerücht: ${x.name} prüft Übernahme von ${v.name}`, 0, [x.id], { cat: 'ma', rumor: true, p: 0.5 });
    } else if (r < 0.55) {
      addInbox(v, { k: 'pricewar', title: `${x.name} startet einen Preiskampf`, text: `${x.name} senkt die Preise, um Kunden zurückzuholen. Ziehst du mit, sinkt dein Umsatz pro Kunde; hältst du die Preise, verlierst du Kunden.`, opts: [{ k: 'match', label: 'Preiskampf mitgehen' }, { k: 'diff', label: 'Qualitäts-Konter via CTO' }, { k: 'hold', label: 'Nische verteidigen' }], def: 2, data: { id } });
      addNews(`${x.name} senkt die Preise – Kampfansage an ${v.name}`, -1, [x.id], { cat: 'company', sub: 'Preiskämpfe kosten beide Seiten Marge.' });
      x.padj = (x.padj || 0) - 0.01;
    } else if (r < 0.8) {
      v.pmf = clamp(v.pmf - 0.05, 0, 1);
      addNews(`${x.name} kopiert Funktionen von ${v.name}`, 0, [x.id], { cat: 'company', sub: 'Der Konzern baut die Ideen des Startups nach. Dessen Vorsprung schrumpft.' });
      note(A, `${x.name} kopiert eure Funktionen – Product-Market Fit −5 Punkte.`, 'dn');
    } else if (vm(v).sens.reg > 0.3) {
      addInbox(v, { k: 'lobby', title: `${x.name} macht Lobbyarbeit gegen ${v.name}`, text: 'In Berlin und Brüssel wird über strengere Regeln für euer Geschäftsmodell gesprochen. Gegenlobby kostet Geld, Abwarten riskiert Auflagen.', opts: [{ k: 'counter', label: 'Gegenlobby (5 % der Kasse)' }, { k: 'wait', label: 'Abwarten' }], def: 1, data: { id } });
    }
  }
}
function government(A, v, u) {
  if (vm(v).hyper && u.share > 0.4 && !(v.reg && v.reg.until > v.qi) && !v.inbox.some(i => i.k === 'antitrust')) {
    const k = vm(v).model === 'fintech' ? 'Finanzaufsicht' : pick(['Kartellamt', 'Datenschutzbehörde', 'Finanzministerium (Digitalsteuer)']);
    addInbox(v, { k: 'antitrust', title: `${k} nimmt ${v.name} ins Visier`, text: `Mit ${fmt(u.share * 100, 0)} % Marktanteil gilt ${v.name} als marktbeherrschend. Zugeständnisse bremsen das Wachstum, ein Rechtsstreit kann teuer werden.`, opts: [{ k: 'concede', label: 'Zugeständnisse (Wachstum gebremst)' }, { k: 'fight', label: 'Vor Gericht kämpfen' }], def: 0, data: {} });
    addNews(`${k} prüft Marktmacht von ${v.name}`, -1, [], { cat: 'politics', rumor: true, p: 0.6, sub: `Das Startup von ${A.name} dominiert seinen Markt – Regulierung oder Strafen drohen.` });
  }
  const m = vm(v);
  if (m.subsidy && subsidyActive(v) && !v.subT) { v.subT = M.t; const g = r2(Math.max(5000, (v.capexSum || 0) * 0.1)); v.cash += g; addNews(`Förderprogramm: ${v.name} erhält ${fmtE(g, 0)} Zuschuss`, 1, [], { cat: 'politics', sub: 'Das Konjunkturpaket fördert Investitionen in Schlüsseltechnologien. Kapazitätsausbau ist 30 % günstiger.' }); note(A, `Subvention: ${fmtE(g, 0)} für ${v.name}.`, 'up'); }
  if (!subsidyActive(v)) v.subT = 0;
}
// Finanzierungsangebote (Term Sheets) und Gelegenheiten
function offers(A, v, u) {
  const next = VC_ROUNDS.find(r => !v.rounds.includes(r.k));
  const ri = next ? VC_ROUNDS.indexOf(next) : -1, okTrial = !!next && vm(v).trial && v.trial && (v.trial.phase >= 4 ? v.arr >= next.arr : v.trial.phase >= ri && (ri > 0 || v.rdSum >= 2000));
  if (next && !v.inbox.some(i => i.k === 'vc') && (okTrial || (v.arr >= next.arr * (vm(v).hyper ? 1 : 0.6) && v.pmf >= next.pmf * (vm(v).hyper ? 1 : 0.75)))) {
    const V = valuation(v), cfo = ex(v, 'cfo').val || 1, inv = pick(VC_NAMES);
    const hiPre = r2(V * 1.35 * cfo), loPre = r2(V * 0.95 * cfo), dHi = next.dil[0], dLo = next.dil[1];
    const tgt = r2(v.arr * (next.k === 'seed' ? 4 : 2.6));
    addInbox(v, { k: 'vc', title: `Term Sheet: ${next.name} von ${inv}`, text: `${inv} möchte investieren. Höhere Bewertung heißt weniger Verwässerung, aber strenge Wachstumsziele.`, opts: [
      { k: 'hi', label: `Hohe Bewertung: ${fmtE(hiPre, 0)} vor Geld, ${fmt(dHi * 100, 0)} % abgeben → ${fmtE(hiPre * dHi / (1 - dHi), 0)}`, desc: `Ziel: ${fmtE(tgt, 0)} ARR in 4 Quartalen` },
      { k: 'lo', label: `Moderat: ${fmtE(loPre, 0)} vor Geld, ${fmt(dLo * 100, 0)} % abgeben → ${fmtE(loPre * dLo / (1 - dLo), 0)}`, desc: 'Keine harten Ziele' },
      { k: 'no', label: 'Ablehnen (Bootstrapping)' }], def: 2, data: { round: next.k, name: next.name, inv, hiPre, loPre, dHi, dLo, tgt } });
  }
  // Brückenfinanzierung: Bestandsinvestoren retten eine leere Kasse – teuer (Verwässerung, Abschlag), aber besser als die Insolvenz
  if (v.cash < 0 && v.capt.inv.length && v.board >= 25 && v.qi - (v.bridgeQ ?? -99) >= 4 && !v.inbox.some(i => i.k === 'bridge')) {
    const amt = r2(-v.cash + opexQ(v) * 2), dil = r2(clamp(amt / Math.max(1, valuation(v) * 0.6), 0.05, 0.35) * 1000) / 1000;
    addInbox(v, { k: 'bridge', title: 'Investoren bieten Brückenfinanzierung an', text: `Eure Investoren würden ${fmtE(amt, 0)} nachschießen, damit ${v.name} nicht insolvent wird – gegen ${fmt(dil * 100, 1)} % der Anteile und einen Bewertungsabschlag. Danach ist der Spielraum für weitere Rettungen erst einmal aufgebraucht.`, opts: [{ k: 'yes', label: `Annehmen (+${fmtE(amt, 0)}, ${fmt(dil * 100, 1)} % abgeben)` }, { k: 'no', label: 'Ablehnen' }], def: 1, data: { amt, dil } });
  }
  // Förderbank: Industrie, Energie und Biotech bekommen regelmäßig nicht verwässernde Zuschüsse (Schlüsseltechnologien)
  if (vm(v).subsidy && v.qi - (v.grantQ ?? -99) >= 4 && v.qi >= 2 && (v.grants || 0) < 4 && !v.inbox.some(i => i.k === 'grant')) {
    const own = (v.rdSum + (v.capexSum || 0)) - (v.grantBase || 0); // Förderung nur als Zuschuss zu eigenen Investitionen (Matching)
    const g = r2(Math.min(Math.max(4000, own * 0.6, v.arr * 0.15), 50e6) * (subsidyActive(v) ? 1.5 : 1));
    addInbox(v, { k: 'grant', title: 'Förderbank bietet Zuschuss an', text: `Für ${vm(v).sub} gibt es ${fmtE(g, 0)} aus dem Programm für Schlüsseltechnologien – ohne Anteile abzugeben. Bedingung: Ihr investiert in Kapazität und Arbeitsplätze im Inland.`, opts: [{ k: 'yes', label: `Annehmen (+${fmtE(g, 0)})` }, { k: 'no', label: 'Ablehnen' }], def: 1, data: { g } });
  }
  if (v.stage >= 1 && Math.random() < 0.25 && !v.inbox.some(i => i.k === 'deal')) {
    const n = Math.max(1, Math.round(v.customers * 0.15)), add = r2(n * u.arpu);
    addInbox(v, { k: 'deal', title: 'Großkunde will einsteigen', text: `Ein Konzern möchte ${fmt(n, 0)} Lizenzen bzw. Einheiten abnehmen (+${fmtE(add, 0)} ARR) – aber nur mit 30 % Rabatt und eigenen Sonderwünschen.`, opts: [{ k: 'yes', label: 'Annehmen (+Umsatz, −Marge)' }, { k: 'no', label: 'Ablehnen' }], def: 1, data: { n } });
  }
  if (vm(v).sens.tar >= 0.6 && M.mac && M.mac.tarImp > 10 && !v.inbox.some(i => i.k === 'tariff') && !v.tarDone) {
    addInbox(v, { k: 'tariff', title: 'Zölle verteuern eure Bauteile', text: `Bei ${fmt(M.mac.tarImp, 0)} % Importzoll schrumpft die Bruttomarge. Eine eigene Lieferkette in Europa kostet einmalig, schützt aber dauerhaft.`, opts: [{ k: 'move', label: 'Lieferkette verlagern (einmalige Kosten)' }, { k: 'price', label: 'Preise erhöhen' }], def: 1, data: {} });
  }
}
function addInbox(v, it) { it.id = v.seq++; it.q = v.qi; v.inbox.unshift(it); if (v.inbox.length > 12) v.inbox.length = 12; }

/* ---------- Entscheidungen ---------- */
// Nachverhandeln: höhere Bewertung = weniger Verwässerung, aber geringere Abschlusschance und strengeres ARR-Ziel
export const negChance = ask => clamp(0.9 - 2.4 * ask, 0.15, 0.9);
export function negTerms(d, ask) { const pre = r2(d.hiPre * (1 + ask)), raise = r2(pre * d.dHi / (1 - d.dHi)); return { pre, raise, dil: d.dHi, tgt: r2(d.tgt * (1 + 1.5 * ask)), p: negChance(ask) }; }
export function decide(A, id, opt, extra = {}) {
  const v = A.venture; if (!v) return 'Kein Unternehmen.'; const it = v.inbox.find(i => i.id === Number(id)); if (!it) return 'Eintrag nicht gefunden.';
  if (!it.opts) { v.inbox.splice(v.inbox.indexOf(it), 1); ENV.dirty(A); return null; }
  if (opt === 'neg' && (it.k === 'vc' || it.k === 'deal') && Array.isArray(extra.moves)) { // 3-Runden-Verhandlung: Server spielt die Züge mit demselben Seed nach
    if ((v.focus ?? 0) < FOCUS.cost.neg) return `Eine Verhandlung kostet ${FOCUS.cost.neg} Fokus.`;
    const moves = extra.moves.map(String).filter(m => NEG_MOVES[it.k][m]).slice(0, 4), st = negPlay(it.k, negCtx(v), negSeed(v, it.id), moves.includes('fix') ? moves : moves.concat('fix'));
    v.focus -= FOCUS.cost.neg; v.inbox.splice(v.inbox.indexOf(it), 1);
    if (!st.ok) { v.board = clamp(v.board - 3, 0, 100); note(A, `Verhandlung gescheitert: ${st.why || 'kein Abschluss'} (${it.title}).`, 'dn'); ENV.dirty(A); return null; }
    const T = negTermsOf(it.k, st, it.data);
    if (it.k === 'vc') { applyRound(A, v, it.data, T.pre, T.dil); v.mand = { arr: T.tgt, q: v.qi + 4 }; note(A, `${it.data.name} verhandelt: ${fmtE(T.pre, 0)} vor Geld, ${fmt(T.dil * 100, 1)} % abgegeben, Mandat ${fmtE(T.tgt, 0)} ARR.`, 'tier'); }
    else { const n = Math.min(T.n, Math.max(0, capacity(v) - v.customers)); v.customers += n; v.fx.push({ k: 'arpu', m: 1 - T.disc * n / Math.max(1, v.customers), until: v.qi + 4 }); if (T.lock) v.fx.push({ k: 'churn', m: 0.9, until: v.qi + 4 }); note(A, `Großdeal verhandelt: +${fmt(n, 0)} Kunden mit ${fmt(T.disc * 100, 0)} % Rabatt${T.lock ? ', lange Bindung' : ''}.`, 'up'); }
    v.plan = planOf(v); ENV.dirty(A); return null;
  }
  if (opt === 'neg' && it.k === 'vc') {
    const ask = clamp(Number(extra.ask) || 0, 0.01, 0.3), t = negTerms(it.data, ask);
    if (Math.random() >= t.p) { v.inbox.splice(v.inbox.indexOf(it), 1); v.board = clamp(v.board - 3, 0, 100); note(A, `${it.data.inv} lehnt die Nachverhandlung (+${fmt(ask * 100, 0)} %) ab und steigt aus. Die nächste Runde kommt, sobald die Kennzahlen wieder passen.`, 'dn'); ENV.dirty(A); return null; }
    Object.assign(it.data, { hiPre: t.pre, tgt: t.tgt }); note(A, `Nachverhandlung erfolgreich: ${fmtE(t.pre, 0)} vor Geld (+${fmt(ask * 100, 0)} %).`, 'up');
    return decideItem(A, v, it, it.opts.findIndex(o => o.k === 'hi'), false);
  }
  const k = it.opts.findIndex(o => o.k === opt); if (k < 0) return 'Ungültige Wahl.';
  return decideItem(A, v, it, k, false);
}
function decideItem(A, v, it, k, auto) {
  const o = it.opts[k].k, d = it.data || {}, x = d.id ? I(d.id) : null;
  v.inbox.splice(v.inbox.indexOf(it), 1);
  if (!['vc', 'grant', 'bridge', 'buyout'].includes(it.k) || o === 'no' || o === 'reject') chron(v, `${auto ? 'Automatisch entschieden' : 'Entscheidung'}: ${it.title} → ${it.opts[k].label}`, auto ? 'dn' : '');
  if (it.k === 'vc' && o !== 'no') {
    const pre = o === 'hi' ? d.hiPre : d.loPre, dil = o === 'hi' ? d.dHi : d.dLo, raise = r2(pre * dil / (1 - dil));
    applyRound(A, v, d, pre, dil); v.mand = { arr: o === 'hi' ? d.tgt : r2(d.tgt * 0.75), q: v.qi + 4 }; // Kapital gegen Quartalsziel
  } else if (it.k === 'vc') note(A, auto ? 'Das Term Sheet ist verfallen.' : 'Finanzierungsrunde abgelehnt – du behältst alle Anteile.', '');
  if (it.k === 'buyout' && o === 'accept') return exit(A, v, d.price, x);
  if (it.k === 'pricewar') { if (o === 'match') v.fx.push({ k: 'arpu', m: 0.9, until: v.qi + 3 }); else if (o === 'hold') { v.customers *= 0.92; v.fx.push({ k: 'churn', m: 0.85, until: v.qi + 3 }); } else { const c = r2(Math.max(1000, Math.max(0, v.cash) * 0.08)); v.cash -= c; v.pmf = clamp(v.pmf + 0.04 + (v.execs && v.execs.cto ? 0.03 : 0), 0, 1); v.quality = clamp(v.quality + 0.03, 0.3, 1.15); } }
  if (it.k === 'lobby') { if (o === 'counter') v.cash -= r2(Math.max(0, v.cash) * 0.05); else if (Math.random() < 0.5) { v.reg = { until: v.qi + 4 }; addNews(`Neue Auflagen für ${vm(v).sub}`, -1, x ? [x.id] : [], { cat: 'politics', sub: `Die Lobbyarbeit hat gewirkt – ${v.name} muss strengere Regeln erfüllen. Das kostet Marge.` }); } }
  if (it.k === 'antitrust') { if (o === 'concede') { v.growthPen = v.qi + 4; v.fx.push({ k: 'arpu', m: 0.95, until: v.qi + 4 }); v.reg = { until: v.qi + 4 }; } else { v.cash -= r2(Math.max(0, v.cash) * 0.05); if (Math.random() < 0.45) { const fine = r2(v.arr * 0.1); v.cash -= fine; v.fx.push({ k: 'arpu', m: 0.9, until: v.qi + 4 }); addNews(`Strafe gegen ${v.name}: ${fmtE(fine, 0)}`, -1, [], { cat: 'politics', sub: 'Das Gericht sieht Marktmissbrauch. Dazu kommen Auflagen für die Preisgestaltung.' }); } else addNews(`${v.name} gewinnt vor Gericht`, 1, [], { cat: 'politics', sub: 'Die Vorwürfe wurden fallen gelassen.' }); } }
  if (it.k === 'grant') { v.grantQ = v.qi; if (o === 'yes') { v.cash += d.g; v.grants = (v.grants || 0) + 1; v.grantBase = v.rdSum + (v.capexSum || 0); addNews(`Förderung: ${v.name} erhält ${fmtE(d.g, 0)}`, 1, [], { cat: 'politics', sub: 'Die Förderbank unterstützt Investitionen in Schlüsseltechnologien.' }); note(A, `Zuschuss über ${fmtE(d.g, 0)} erhalten.`, 'up'); } }
  if (it.k === 'bridge') { v.bridgeQ = v.qi; if (o === 'yes') { for (const key of ['founder', 'esop']) v.capt[key] *= 1 - d.dil; for (const i of v.capt.inv) i.pct *= 1 - d.dil; const lead = v.capt.inv[v.capt.inv.length - 1]; lead.pct += d.dil; v.cash += d.amt; v.down = (v.down || 1) * 0.85; v.board = clamp(v.board - 5, 0, 100); addNews(`${v.name} erhält Brückenfinanzierung`, -1, [], { cat: 'ma', sub: `Die Investoren schießen ${fmtE(d.amt, 0)} nach. Die Bewertung leidet.` }); note(A, `Brückenfinanzierung: +${fmtE(d.amt, 0)}, Verwässerung ${fmt(d.dil * 100, 1)} %.`, 'dn'); } }
  if (it.k === 'launch') { const N = nodeOf(v, v.tree.findIndex(n => n && n.k === d.n), d.n) || { name: 'Produkt' };
    if (o === 'keynote') { if (Math.random() < 0.8 * (v.debt || 0)) { v.fx.push({ k: 'churn', m: 1.3, until: v.qi + 1 }); v.pmf = clamp(v.pmf - 0.05, 0, 1); chron(v, `Keynote zu ${N.name} geht schief: Bugs live auf der Bühne – Shitstorm, Abwanderung steigt.`, 'dn'); }
      else { v.fx.push({ k: 'conv', m: v.quality > 0.9 ? 1.3 : 1.15, until: v.qi + 1 }); chron(v, `Keynote-Launch von ${N.name}: Medien und Kunden ziehen mit – ${v.quality > 0.9 ? '+30' : '+15'} % Abschlüsse bis zum Board-Meeting.`, 'up'); } }
    else { v.fx.push({ k: 'conv', m: 1.08, until: v.qi + 1 }); chron(v, `${N.name} startet leise als Beta – +8 % Abschlüsse, kein Risiko.`, ''); } }
  if (it.k === 'deal' && o === 'yes') { v.customers += d.n; v.fx.push({ k: 'arpu', m: 0.93, until: v.qi + 4 }); }
  if (it.k === 'tariff') { v.tarDone = 1; if (o === 'move') { const c = r2(Math.max(2000, v.arr * 0.15)); v.cash -= c; v.tarShield = 1; } else v.fx.push({ k: 'conv', m: 0.85, until: v.qi + 3 }); }
  ENV.dirty(A); return null;
}
function applyRound(A, v, d, pre, dil) {
  const raise = r2(pre * dil / (1 - dil));
  for (const key of ['founder', 'esop']) v.capt[key] *= 1 - dil; for (const i of v.capt.inv) i.pct *= 1 - dil;
  v.capt.inv.push({ name: d.inv, round: d.name, pct: dil }); v.cash += raise; v.rounds.push(d.round); v.down = 1;
  addNews(`${v.name} sammelt ${fmtE(raise, 0)} ein (${d.name})`, 1, [], { cat: 'ma', sub: `${d.inv} führt die Runde an, Bewertung nach der Runde: ${fmtE(pre + raise, 0)}.` });
  note(A, `${d.name} abgeschlossen: +${fmtE(raise, 0)} in die Firmenkasse, Verwässerung ${fmt(dil * 100, 0)} %.`, 'tier');
}
export const hashS = t => { let h = 7; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
export const execRival = v => { const x = I(v.rivals[0]); return x ? x.name : 'Ein Börsenkonzern'; };
export const negCtx = v => { const l = v.q[v.q.length - 1], p = v.q[v.q.length - 2]; return { pmf: v.pmf, cto: !!(v.execs && v.execs.cto), g: l && p && p.arr > 0 ? l.arr / p.arr - 1 : 0.3 }; };
function exit(A, v, price, x) {
  const mine = r2(price * founderPct(v)), pnl = r2(mine - v.invested);
  A.cash += mine; A.realized += pnl; book(A, 'venture', mine, `Exit: ${v.name} an ${x ? x.name : 'Käufer'}`);
  v.status = 'exited'; v.exitT = M.t; v.exitPrice = price; v.exitMine = mine;
  if (x) { x.padj = (x.padj || 0) + clamp(v.arr / (x.fin.rev * 4) * 0.5, 0, 0.2); addNews(`${x.name} übernimmt ${v.name} für ${fmtE(price, 0)}`, 1, [x.id], { cat: 'ma', sub: `${A.name} verkauft das Startup und erhält für den eigenen Anteil ${fmtE(mine, 0)}.` }); }
  note(A, `Exit! Du erhältst ${fmtE(mine, 0)} für deinen Anteil an ${v.name}.`, 'tier'); ENV.event(A, 'exit'); ENV.dirty(A); return null;
}

/* ---------- Börsengang ---------- */
export function vIpoQuote(v, disc, float) {
  const V = valuation(v), N = VENTURE_SHARES, P = V * (1 - disc) * (1 + ((v.auth ?? 50) - 50) / 1000) / N, n = N * float / (1 - float), // Board-Autorität: bis ±5 % beim Emissionspreis
    raise = n * P * 0.97;
  const before = founderPct(v) * V * vstage(v).liq, after = founderPct(v) * N * P;
  return { V, P, n, raise, shares: N + n, mine: founderPct(v) * N, before, after, reval: after - before };
}
function ticker(name) {
  const base = name.toUpperCase().replace(/[^A-Z]/g, '').padEnd(4, 'X'); let t = base.slice(0, 4), i = 0;
  while (M.inst[t]) t = base.slice(0, 3) + String.fromCharCode(65 + (i++ % 26));
  return t;
}
export function vIpo(A, b) {
  const v = own(A); if (!v) return 'Kein Startup.';
  if (!M.isOpen) return 'Die Börsenglocke läutet nur zu Börsenzeiten.';
  if (v.stage < 3) return `Noch nicht börsenreif: nötig sind ${fmtE(VENTURE_STAGES[3].min, 0)} ARR und ${IPO_MIN_QUARTERS} abgeschlossene Quartale.`;
  const disc = clamp(Number(b.disc), 0, 0.2), float = clamp(Number(b.float), 0.15, 0.4), lock = [30, 60, 90].includes(Number(b.lock)) ? Number(b.lock) : 60;
  const q = vIpoQuote(v, disc, float), m = vm(v), sens = Object.assign({}, SECTOR_SENS[m.sector], { rate: m.sens.rate, home: 'eu', exp: 0.4, sc: m.sens.tar * 0.6 });
  const last4 = v.q.slice(-4), ebitA = last4.reduce((s, r) => s + r.ebit, 0) * (4 / Math.max(1, last4.length));
  const id = ticker(v.name), x = addStock({ id, name: v.name, sector: m.sector, shares: q.shares, price: q.P, beta: m.hyper ? 1.4 : 1.1, vol: m.hyper ? 0.55 : 0.42, eps: ebitA * 0.75 / q.shares, sens, player: A.uid, desc: `${m.name}: ${m.sub}. Gegründet von ${A.name}.` });
  const hist = v.q.slice(-8).map((r, i, a) => ({ q: r.q, end: r.t, date: r.t, revE: i ? a[i - 1].rev * 1.05 : r.rev, rev: r.rev, epsE: (i ? a[i - 1].ebit : r.ebit) * 0.75 / q.shares, eps: r.ebit * 0.75 / q.shares, margin: r.rev > 0 ? r.ebit / r.rev : 0, guid: 'keep', verdict: 'inline', move: 0, sum: `Quartal als Startup (${r.q}).` }));
  const gQ = last4.length > 1 && last4[0].arr > 0 ? Math.pow(v.arr / last4[0].arr, 1 / (last4.length - 1)) - 1 : 0.1;
  x.fin = { g: clamp(gQ * 4, -0.2, 1.2), fy: 0, rev: v.arr / 4, eps: ebitA * 0.75 / 4 / q.shares, hist, next: 0, nq: 0, fv: 1 };
  scheduleReport(x); M.idsV = (M.idsV || 0) + 1; recomputeDerived();
  v.cash += q.raise; v.status = 'public_listed'; v.listedId = id; v.ipoT = M.t; v.ipoP = q.P; v.lockUntil = addTradingDays(M.t, lock) + 8 * 3600000;
  A.pos[id] = { qty: q.mine, cost: r2(v.invested), t0: M.t, lock: v.lockUntil };
  book(A, 'reval', r2(q.reval), `Neubewertung durch Börsengang ${v.name}`);
  setWhy(x, `Börsengang zu ${fmt(q.P, 2)} €`, 0);
  addNews(`Börsengang: ${v.name} läutet die Glocke`, 1, [id], { cat: 'ma', sub: `${fmt(float * 100, 0)} % der Aktien gehen zu ${fmt(q.P, 2)} € an die Börse. Bewertung: ${fmtE(q.P * q.shares, 0)}. Gründer ${A.name} hält ${fmt(founderPct(v) * 100 * (1 - float), 1)} % und darf bis ${new Date(v.lockUntil).toISOString().slice(8, 10)}.${new Date(v.lockUntil).toISOString().slice(5, 7)}. nicht verkaufen (Lock-up).` });
  note(A, `Willkommen an der Börse! ${v.name} notiert als ${id} – deine Aktien liegen im Depot.`, 'tier'); ENV.event(A, 'ownipo'); ENV.dirty(A); return null;
}
// Quartalszahlen der börsennotierten Spieler-Firma: echte Zahlen aus der Simulation, Erwartung = eigene Guidance
ENV.ventReport = x => {
  let A = null; for (const B of ENV.accounts()) if (B.uid === x.player) { A = B; break; }
  const v = A && A.venture; if (!v || v.listedId !== x.id) return null;
  const c = v.cur, ebit = c.gross - c.opex - c.mkt - c.rd - c.capex, rev = c.rev, eps = ebit * 0.75 / x.shares;
  const revE = v.guid ? v.guid.rev : x.fin.rev * (1 + x.fin.g / 4), epsE = v.guid ? v.guid.eps : (x.fin.eps || eps * 0.95);
  v.q.push({ q: qLabel(M.t - 45 * DAY), t: M.t, rev, gross: c.gross, ebit, arr: v.arr, cust: v.customers, newC: c.newC, churnC: c.churnC, cash: v.cash, gm: unit(v).gm, cac: unit(v).cac, ltv: unit(v).ltv, churn: unit(v).churn, pmf: v.pmf, share: vShare(v), board: v.board, val: x.price * x.shares, guid: v.guid || null });
  if (v.q.length > 12) v.q.shift();
  if (v.cash > 2 * v.arr && v.cash > 1e6) { const o = r2(v.cash * 0.005); v.cash -= o; chron(v, `Verwaltungsaufwand für hohe Barbestände: −${fmtE(o, 0)}.`, ''); } // aufgeblähte Kasse kostet
  v.qi++; v.cur = blankCur(); v.guid = null; v.shk = drawShock(v); v.fx = (v.fx || []).filter(e => e.until > v.qi);
  const u = unit(v); duel(A, v, u); rivalAI(A, v, u); government(A, v, u);
  ENV.dirty(A);
  return { rev, eps, revE, epsE };
};
// Governance nach dem Börsengang: CEO-Entscheidungen nur mit mindestens 25 % eigenen Aktien
export const ceoStake = A => { const v = A.venture, x = v && I(v.listedId), p = x && A.pos[x.id]; return x && p ? p.qty / x.shares : 0; };
const govErr = A => ceoStake(A) < 0.25 ? `Als CEO brauchst du mindestens 25 % der Aktien (du hältst ${fmt(ceoStake(A) * 100, 1)} %).` : null;
// Solvenzsperre: keine Ausschüttung aus der Substanz, wenn das operative Geschäft Verluste schreibt und die Kasse knapp ist
export function solvencyErr(v) { const l4 = v.q.slice(-4), ebit = l4.reduce((s, r) => s + r.ebit, 0); return ebit < 0 && v.cash < burnM(v) * 6 ? 'Gesperrt: Das Unternehmen schreibt Verluste und die Kasse reicht keine zwei Quartale (Solvenzschutz).' : null; }
export function setGuidance(A, b) {
  const v = A.venture; if (!v || v.status !== 'public_listed') return 'Guidance gibt es erst nach dem Börsengang.'; { const g = govErr(A); if (g) return g; }
  const rev = Number(b.rev), eps = Number(b.eps); if (!(rev > 0) || !isFinite(eps)) return 'Bitte Umsatz und Gewinn je Aktie angeben.';
  v.guid = { rev, eps, t: M.t }; const x = I(v.listedId);
  if (x) addNews(`${v.name} gibt Prognose: ${fmtBig(rev)} € Umsatz im Quartal`, 0, [x.id], { cat: 'company', sub: `Gewinn je Aktie erwartet: ${fmt(eps, 2)} €. Die nächsten Zahlen werden an dieser Prognose gemessen.` });
  ENV.dirty(A); return null;
}
export function buyback(A, amt) {
  const v = A.venture; if (!v || v.status !== 'public_listed') return 'Nur für börsennotierte Unternehmen.'; const x = I(v.listedId); if (!x) return 'Aktie nicht gefunden.';
  if (!M.isOpen) return 'Rückkäufe laufen zu Börsenzeiten.'; { const g = govErr(A) || solvencyErr(v); if (g) return g; }
  amt = Number(amt); if (!(amt >= 1000)) return 'Mindestens 1.000 €.'; if (amt > v.cash) return `In der Firmenkasse sind ${fmtE(v.cash, 0)}.`;
  const p0 = x.price; applyTrade(x, 1, amt, true); const n = amt / ((p0 + x.price) / 2); x.shares -= n; v.cash -= amt; recomputeDerived();
  addNews(`${v.name} kauft eigene Aktien für ${fmtE(amt, 0)} zurück`, 1, [x.id], { cat: 'company', sub: 'Weniger Aktien bedeuten mehr Gewinn je Aktie – Aktionäre profitieren.' });
  note(A, `Rückkauf: ${fmt(n, 0)} Aktien eingezogen.`, 'up'); ENV.dirty(A); return null;
}
export function dividend(A, amt) {
  const v = A.venture; if (!v || v.status !== 'public_listed') return 'Nur für börsennotierte Unternehmen.'; const x = I(v.listedId); if (!x) return 'Aktie nicht gefunden.'; { const g = govErr(A) || solvencyErr(v); if (g) return g; }
  amt = Number(amt); if (!(amt >= 1000)) return 'Mindestens 1.000 €.'; if (amt > v.cash) return `In der Firmenkasse sind ${fmtE(v.cash, 0)}.`;
  v.cash -= amt; payDividend(x, amt / x.shares, 'Sonderdividende');
  note(A, `Sonderdividende über ${fmtE(amt, 0)} beschlossen – auch du erhältst deinen Anteil.`, 'div'); ENV.dirty(A); return null;
}
export function ventureReset(A) { const v = A.venture; if (!v || (v.status !== 'failed' && v.status !== 'exited')) return 'Erst nach Insolvenz oder Exit möglich.'; A.venture = null; ENV.dirty(A); return null; }
