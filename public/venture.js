// NOVEX Börse – Ventures: das eigene Startup von der Garage bis zur Börse.
// Läuft im Spieltakt automatisch mit (Autopilot), der Spieler steuert über Strategie-Regler, Quartals-Board-Meetings und eine ruhige Entscheidungs-Inbox.
// Verzahnt mit Börse (Marktanteile kosten gelistete Rivalen Gewinn), Makro (Zinsen, Konsumklima, Zölle) und Neobroker-Depot (Börsengang als echte Aktie).
import { M, hook, ENV, I, addNews, setWhy, book, availCash, applyTrade, addStock, recomputeDerived, fmt, fmtE, fmtBig, pct, r2, clamp, gauss, pick, dayStart, DAY } from './engine.js';
import { BIZ_MODELS, VENTURE_STAGES, VENTURE_MIN, VENTURE_SHARES, IPO_MIN_QUARTERS, EXECS, EXEC_PAY, EXEC_ESOP, VC_ROUNDS, VC_NAMES, CAMPAIGNS, SECTOR_SENS } from './data.js';
import { sectorRev, peerPS, rivalsOf, rivalProfile, rateFactor } from './company.js';
import { addTradingDays, scheduleReport, payDividend, qLabel } from './events.js';

const PRICE = { low: { arpu: 0.8, conv: 1.3, churn: 0.85, name: 'Günstig' }, normal: { arpu: 1, conv: 1, churn: 1, name: 'Marktüblich' }, premium: { arpu: 1.25, conv: 0.7, churn: 1.2, name: 'Premium' } };
const GROWTH = { lean: 0.12, normal: 0.25, aggressive: 0.45 };
const RD_NEED = { saas: 8000, b2c: 6000, fintech: 10000, deeptech: 16000, cleantech: 16000, biotech: 0 };
const OPEX_K = [0.40, 0.40, 0.33, 0.28]; // Team- und Verwaltungskosten in % vom Rohertrag je Phase (margenschwache Modelle haben schlankere Teams)
const TRIAL = [{ name: 'Präklinik', cost: 6000, p: 0.75, minQ: 2 }, { name: 'Phase I', cost: 60000, p: 0.7, minQ: 3 }, { name: 'Phase II', cost: 600000, p: 0.65, minQ: 5 }, { name: 'Phase III & Zulassung', cost: 4000000, p: 0.75, minQ: 6 }]; // minQ: Mindestdauer in Quartalen – Studien lassen sich nicht beliebig beschleunigen
const PIPE = [300000, 3000000, 25000000, 150000000];                // Bewertung der Wirkstoff-Pipeline je erreichter Studienphase
const TICKET = [0.3, 0.6, 1, 1.3];                                  // erst kleine Kunden (Mittelstand), später Konzerne
const SAL_MAX = [800, 2500, 10000, 30000];                          // marktübliches Gründergehalt je Quartal und Phase (mehr akzeptieren die Investoren nicht)
export const salaryOf = v => Math.min(v.salary || 0, SAL_MAX[Math.min(v.stage, 3)]);
const HUSTLE = { saas: 3.2, b2c: 700, fintech: 160, deeptech: 0.9, cleantech: 0.7, biotech: 0.6 }; // vom Gründer selbst gewonnene Kunden je Quartal
export { PRICE, GROWTH, TRIAL, PIPE, SAL_MAX };
export const vm = v => BIZ_MODELS[v.model];
export const vstage = v => VENTURE_STAGES[v.stage];
// Dauer eines Startup-Quartals in Handelstagen: Phase × Branchentempo ab dem Scale-Up (Hardware, Energie und Pharma haben längere Zyklen)
export const qDays = v => v.status === 'public_listed' ? 63 : Math.max(3, Math.round(vstage(v).qd * (v.stage >= 2 || vm(v).trial ? vm(v).pace || 1 : 1))); // Garage & Traction: wöchentliches Board-Meeting (Pharma folgt dem Studienkalender)
const qName = qi => `Q${qi % 4 + 1} J${Math.floor(qi / 4) + 1}`;

/* ---------- Kennzahlen (Browser und Server) ---------- */
const approvedNow = v => !vm(v).trial || (v.trial && v.trial.phase >= 4);
function fxOf(v, k) { let f = 1; for (const e of v.fx || []) if (e.k === k && e.until > v.qi) f *= e.m; return f; }
const ex = (v, role) => v.execs && v.execs[role] ? EXECS[role].a.find(a => a.k === v.execs[role].k).fx : {};
export function segTAM(v) { const now = sectorRev(v.sector), base = v.tamBase || now; return vm(v).tam * (base > 0 ? clamp(now / base, 0.5, 2) : 1); }
export function vShare(v) { return clamp(v.arr / segTAM(v), 0, 0.95); }
export function unit(v) {
  const m = vm(v), P = PRICE[v.price] || PRICE.normal, sh = vShare(v), mac = M.mac || { conf: -8 }, tar = M.mac ? M.mac.tarImp || 0 : 0;
  const confF = 1 - m.sens.cons * clamp((-8 - mac.conf) / 40, -0.3, 0.5); // schwaches Konsumklima drückt Preise und Abschlüsse
  const priceF = P.arpu * fxOf(v, 'arpu') * (1 + 0.25 * m.moat * clamp(v.arr / 5e7, 0, 1)) * (m.sens.cons > 0.5 ? confF : 1), ticket = TICKET[Math.min(v.stage, 3)];
  const arpu = (v.arpuB || m.arpu * ticket) * priceF, arpuNew = m.arpu * ticket * priceF;
  const net = sh > 0.2 ? 1 - m.net * clamp((sh - 0.2) * 2, 0, 0.5) : 1;                                  // Netzwerkeffekte senken die Akquisekosten
  const cac = m.cac * ticket * (ex(v, 'growth').cac || 1) * fxOf(v, 'cac') * net * (1 + 2 * Math.max(0, sh - 0.5)) / (0.45 + 0.55 * v.pmf) / (m.sens.cons > 0.5 ? confF : 1);
  const prem = v.hyper && v.hyper.on && !hyperReady(v);
  const churn = clamp(m.churn * P.churn * (ex(v, 'growth').churn || 1) * fxOf(v, 'churn') * (1.5 - 0.8 * v.pmf) * (1.3 - 0.3 * v.quality) * (1 - 0.3 * m.moat * clamp(v.arr / 2e7, 0, 1)) * (prem ? 2.6 : 1), 0.005, 0.6);
  const gm = clamp(m.gm + (ex(v, 'coo').gm || 0) + (m.hyper ? 0 : 0.15 * clamp(v.arr / 5e7, 0, 1)) - m.sens.tar * tar / 100 * 0.5 * (v.tarShield ? 0.2 : 1) - (v.reg && v.reg.until > v.qi ? 0.04 : 0), 0.05, 0.92);
  return { arpu, arpuNew, priceF, ticket, cac, churn, gm, ltv: arpuNew / 4 * gm / churn, ratio: cac > 0 ? arpuNew / 4 * gm / churn / cac : 0, share: sh, conv: m.conv * P.conv * Math.min(1, 0.45 + 0.12 * v.qi + 0.3 * v.pmf) };
}
export function hyperReady(v) { const m = vm(v); if (!m.hyper) return false; const u = unitNoHyper(v); return v.pmf >= 0.8 && u.ratio >= 3; }
function unitNoHyper(v) { const h = v.hyper; v.hyper = { on: false }; const u = unit(v); v.hyper = h; return u; }
// Quartalskosten (Team, Infrastruktur, Führungskräfte) – ohne Marketing und F&E
export function opexQ(v) {
  let base = (900 * (1 + v.stage) + OPEX_K[Math.min(v.stage, 3)] * v.arr / 4 * unit(v).gm) * (ex(v, 'cfo').opex || 1) * (ex(v, 'coo').opex || 1); // wächst mit dem Geschäft, ohne Sprung beim Phasenwechsel
  for (const r in v.execs || {}) if (!v.execs[r].esop) base += EXEC_PAY[Math.min(v.stage, 3)] * EXECS[r].a.find(a => a.k === v.execs[r].k).pay;
  return base + hyperTeam(v) + capOpex(v) + salaryOf(v);
}
// Wachstumsbudget: wird beim Board-Meeting (oder bei Strategiewechsel) aus der Kasse festgelegt und dann im Quartal ausgegeben – auch wenn die Kasse schrumpft
export const budgetRate = v => Math.min(0.95, (GROWTH[v.growth] || GROWTH.normal) * (v.hyper && v.hyper.on ? 3 : 1));
// Aggressives Wachstum und Hyperscaling binden Ausgaben an den Umsatzplan statt an die Kasse (Teams, Verträge, Werbebuchungen) – reichen Kasse und Unit Economics nicht, droht die Pleite
const FLOOR = { lean: 0, normal: 0, aggressive: 0.35 };
export const budgetFloor = v => Math.max(FLOOR[v.growth] || 0, v.hyper && v.hyper.on ? 1 : 0) * v.arr / 4;
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
  addNews(`Neues Startup: ${name} will den Markt für ${m.sub} aufmischen`, 0, rivals.slice(0, 2), { cat: 'company', sub: `Gegründet von ${A.name} mit ${fmtE(amt, 0)} Startkapital. Gegner sind etablierte Konzerne wie ${rivals.map(id => I(id).name).slice(0, 2).join(' und ')}.` });
  ENV.note(A, `${name} ist gegründet! Erstes Board-Meeting in ${qDays(A.venture)} Handelstagen.`, 'tier'); ENV.event(A, 'founder'); ENV.dirty(A); return null;
}
const blankCur = () => ({ rev: 0, gross: 0, opex: 0, mkt: 0, rd: 0, capex: 0, newC: 0, churnC: 0, days: 0 });
const own = A => { const v = A.venture; return v && v.status === 'private_startup' ? v : null; };
export function fund(A, amt) {
  const v = A.venture; if (!v || (v.status !== 'private_startup' && v.status !== 'public_listed')) return 'Kein aktives Unternehmen.';
  amt = Number(amt); if (!(amt >= 100)) return 'Mindestens 100 €.';
  if (amt > availCash(A) + 1e-6) return `Nicht genug Guthaben (verfügbar inkl. Wertpapierkredit ${fmtE(Math.max(0, availCash(A)))}).`;
  A.cash -= amt; v.cash += amt; v.invested += amt; book(A, 'venture', -amt, `Einlage ${v.name}`);
  ENV.note(A, `${fmtE(amt)} in ${v.name} eingelegt – ohne Verwässerung.${A.cash < 0 ? ' Finanziert über deinen Wertpapierkredit.' : ''}`, 'up'); ENV.dirty(A); return null;
}
export function vSetStrategy(A, b) {
  const v = A.venture; if (!v || v.status === 'failed' || v.status === 'exited') return 'Kein aktives Unternehmen.';
  if (b.growth && GROWTH[b.growth]) { v.growth = b.growth; setBudget(v); }
  if (b.price && PRICE[b.price]) v.price = b.price;
  if (b.rd !== undefined) { const r = Number(b.rd); if (r >= 0 && r <= 1) v.rd = r; }
  if (b.salary !== undefined) { const s = Number(b.salary); if (s >= 0 && s <= 1e7) v.salary = r2(s); }
  ENV.dirty(A); return null;
}
export function setHyper(A, on) {
  const v = own(A); if (!v) return 'Kein Startup.';
  if (on && !vm(v).hyper) return `${vm(v).name} ist nicht hyperscale-fähig: ${vm(v).why}`;
  v.hyper = { on: !!on, since: on ? v.qi : 0 }; setBudget(v);
  if (on) ENV.note(A, hyperReady(v) ? 'Hyperscaling gezündet: Das Marketingbudget verdreifacht sich.' : 'Achtung, Premature Scaling: Product-Market Fit oder Unit Economics reichen noch nicht – Kunden springen schnell wieder ab.', hyperReady(v) ? 'up' : 'dn');
  ENV.dirty(A); return null;
}
export function buildCapacity(A) {
  const v = own(A); if (!v) return 'Kein Startup.'; const m = vm(v); if (!m.cap) return 'Dein Geschäftsmodell braucht keine Fabriken – es skaliert digital.';
  if (v.cap.building) return 'Es wird bereits ausgebaut.';
  const sub = subsidyActive(v), cost = r2(m.cap.cost * Math.pow(1.9, v.cap.level - 1) * (sub ? 0.7 : 1));
  if (v.cash < cost) return `Der Ausbau kostet ${fmtE(cost, 0)} – in der Firmenkasse sind ${fmtE(v.cash, 0)}.`;
  v.cash -= cost; v.cur.capex += cost; v.capexSum = (v.capexSum || 0) + cost; v.cap.building = 1; v.cap.qLeft = Math.max(1, m.cap.q + (ex(v, 'coo').capQ || 0));
  ENV.note(A, `Kapazitätsausbau gestartet (${fmtE(cost, 0)}${sub ? ', 30 % Förderung' : ''}) – fertig in ${v.cap.qLeft} Quartal${v.cap.qLeft > 1 ? 'en' : ''}.`, 'up'); ENV.dirty(A); return null;
}
export const capCost = v => vm(v).cap ? r2(vm(v).cap.cost * Math.pow(1.9, v.cap.level - 1) * (subsidyActive(v) ? 0.7 : 1)) : 0;
export const capacity = v => { const m = vm(v); return m.cap ? v.cap.level * m.cap.unit * (ex(v, 'coo').capU || 1) * Math.pow(1.6, v.cap.level - 1) : Infinity; };
function subsidyActive(v) { const m = vm(v); return !!(m.subsidy && M.mac && M.mac.stim > 0.3); }
export function hire(A, b) {
  const v = A.venture; if (!v || (v.status !== 'private_startup' && v.status !== 'public_listed')) return 'Kein aktives Unternehmen.';
  const R = EXECS[b.role]; if (!R) return 'Unbekannte Rolle.'; const a = R.a.find(x => x.k === b.k); if (!a) return 'Unbekannter Archetyp.';
  if (v.execs[b.role]) return `${R.name} ist bereits besetzt.`;
  const esop = !!b.esop;
  if (esop) { if (v.capt.founder < EXEC_ESOP + 0.05) return 'Zu wenig Gründeranteile für ein Aktienpaket.'; v.capt.founder -= EXEC_ESOP; v.capt.esop += EXEC_ESOP; }
  v.execs[b.role] = { k: a.k, esop, t: v.qi };
  ENV.note(A, `${a.name} als ${R.name} eingestellt${esop ? ` – bezahlt mit ${fmt(EXEC_ESOP * 100, 0)} % Mitarbeiteranteilen` : ''}.`, 'up'); ENV.dirty(A); return null;
}
export function fire(A, role) { const v = A.venture; if (!v || !v.execs[role]) return 'Position ist nicht besetzt.'; delete v.execs[role]; v.board = clamp(v.board - 5, 0, 100); ENV.dirty(A); return null; }
export function campaign(A, b) {
  const v = own(A); if (!v) return 'Kein Startup.'; const C = CAMPAIGNS[b.k]; if (!C) return 'Unbekannte Kampagne.';
  if (!v.rivals.includes(b.rival)) return 'Bitte einen Rivalen wählen.';
  if ((v.fx || []).some(e => e.camp && e.until > v.qi)) return 'Es läuft bereits eine Kampagne. Die nächste ist nach ihrem Ende möglich.';
  const cost = r2(Math.max(2000, v.cash * C.cost)); if (v.cash < cost) return `Die Kampagne kostet ${fmtE(cost, 0)}.`;
  v.cash -= cost; v.cur.mkt += cost; const u = v.qi + 2, x = I(b.rival);
  if (b.k === 'price') v.fx.push({ k: 'arpu', m: 0.88, until: u, camp: 1 }, { k: 'conv', m: 1.4, until: u, camp: 1 });
  if (b.k === 'poach') { v.pmf = clamp(v.pmf + 0.06, 0, 1); v.fx.push({ k: 'none', m: 1, until: u, camp: 1 }); if (x) x.padj = (x.padj || 0) - 0.01; }
  if (b.k === 'patent') { v.fx.push({ k: 'churn', m: 0.8, until: u, camp: 1 }); if (x) x.padj = (x.padj || 0) - (vm(v).moat > 0.5 ? 0.03 : 0.01); }
  if (b.k === 'pr') { v.fx.push({ k: 'cac', m: 0.75, until: u, camp: 1 }); v.pr = 0.1; }
  v.target2 = b.rival;
  if (x) addNews(`${v.name} startet ${C.name.toLowerCase()} gegen ${x.name}`, 0, [x.id], { cat: 'company', sub: C.desc });
  ENV.note(A, `${C.name} gegen ${x ? x.name : 'den Rivalen'} gestartet (${fmtE(cost, 0)}).`, 'up'); ENV.dirty(A); return null;
}

/* ---------- Tagesgeschäft (Autopilot) ---------- */
function dayStep(A, v) {
  const m = vm(v), u = unit(v), f = 1 / qDays(v);
  if (v.budget === undefined) setBudget(v);
  const commit = budgetFloor(v) * f, spend = Math.max(Math.min(v.budget * f, Math.max(0, v.cash + v.arr / 4 * f)), Math.min(commit, v.budget * f)), rdS = spend * v.rd, mktS = spend - rdS; // frei verfügbares Budget nur mit Geld, gebundene Ausgaben laufen weiter
  v.budgetLeft -= spend; if (v.hyper && v.hyper.on) v.cur.hyp = (v.cur.hyp || 0) + spend;
  const opex = (opexQ(v) - salaryOf(v)) * f; // Gründergehalt separat (nur wenn Geld da ist)
  // F&E: Product-Market Fit und Qualität (bei Biotech: Studienfortschritt)
  v.rdSum += rdS;
  if (m.trial) { const T = TRIAL[Math.min(v.trial.phase, 3)]; if (v.trial.phase < 4) v.trial.prog = Math.min(1.2, v.trial.prog + Math.min(rdS / T.cost * (ex(v, 'cto').pmf || 1), f / T.minQ)); v.pmf = clamp(v.pmf + f * 0.04 * (v.trial.phase >= 4 ? 1 : 0.3), 0, 1); }
  else { const pT = 0.25 + 0.75 * (1 - Math.exp(-v.rdSum / (RD_NEED[v.model] * Math.pow(1 + v.arr / 2e6, 0.35)))); v.pmf = clamp(v.pmf + f * 0.35 * (ex(v, 'cto').pmf || 1) * (pT * (0.6 + 0.4 * v.quality) - v.pmf) , 0.05, 1); }
  const stress = v.hyper && v.hyper.on ? 0.07 * (ex(v, 'cto').stress || 1) : 0;
  v.quality = clamp(v.quality + f * (0.05 * (1 - v.quality) + (ex(v, 'cto').quality || 0) - stress + 0.04 * (v.rd - 0.4)), 0.3, 1.15);
  // Kunden: bezahlt + organisch (Mundpropaganda, Netzwerkeffekt) − Abwanderung, begrenzt durch Kapazität und Zulassung
  const approved = !m.trial || v.trial.phase >= 4;
  let newC = mktS / u.cac * u.conv * fxOf(v, 'conv');
  if (v.stage < 2 && v.status === 'private_startup') newC += f * HUSTLE[v.model] * (1 + 2 * v.pmf) * (v.stage === 0 ? 1 : 0.5) * (approvedNow(v) ? 1 : 0.4);
  newC += v.customers * f * (0.05 * v.pmf * v.pmf * (0.4 + m.net) + (u.share > 0.2 ? 0.12 * m.net * (u.share - 0.2) : 0)) * (v.growthPen && v.growthPen > v.qi ? 0.7 : 1);
  if (!approved) newC = Math.min(newC, Math.max(0, 2 + v.trial.phase - v.customers)); // vor der Zulassung nur Lizenz- und Forschungspartner
  if (m.trial && approved) newC += v.customers * f * 0.3; // Markteinführung: Ärzte und Kliniken verschreiben das zugelassene Produkt weiter
  newC *= Math.pow(Math.max(0, 1 - u.share), 1.6); // Sättigung: je voller das Segment, desto schwerer neue Kunden
  const churnC = v.customers * u.churn * f;
  const c0 = v.customers, c1 = Math.max(0, Math.min(capacity(v), c0 + newC - churnC)), added = Math.max(0, c1 - (c0 - churnC));
  v.arpuB = c1 > 0 ? ((c0 - churnC > 0 ? (c0 - churnC) * (v.arpuB || u.arpuNew / u.priceF) : 0) + added * u.arpuNew / u.priceF) / Math.max(1e-9, Math.max(0, c0 - churnC) + added) : (v.arpuB || 0);
  v.customers = c1;
  v.arr = v.customers * (v.arpuB || 0) * u.priceF * (approved ? 1 : 0.6);
  const rev = v.arr / 4 * f, gross = rev * u.gm;
  if (salaryOf(v) > 0 && v.cash > 0) { const s = Math.min(v.cash, salaryOf(v) * f); A.cash += s; v.cash -= s; v.cur.opex += s; v.paid = (v.paid || 0) + s; book(A, 'venture', r2(s), `Gründergehalt ${v.name}`); }
  v.cash += gross - opex - spend;
  Object.assign(v.cur, { rev: v.cur.rev + rev, gross: v.cur.gross + gross, opex: v.cur.opex + opex, mkt: v.cur.mkt + mktS, rd: v.cur.rd + rdS, newC: v.cur.newC + newC, churnC: v.cur.churnC + churnC, days: v.cur.days + 1 });
}
hook('open', () => {
  for (const A of ENV.accounts()) {
    const v = A.venture; if (!v || (v.status !== 'private_startup' && v.status !== 'public_listed')) continue;
    dayStep(A, v);
    if (v.status === 'public_listed') { const x = I(v.listedId); if (x && x.fin) x.fin.rev = v.arr / 4; }
    else if (++v.day >= qDays(v)) board(A, v);
    ENV.dirty(A);
  }
});

/* ---------- Quartals-Board-Meeting ---------- */
function board(A, v) {
  const m = vm(v), u = unit(v), c = v.cur, ebit = c.gross - c.opex - c.mkt - c.rd - c.capex;
  const prevArr = v.q.length ? v.q[v.q.length - 1].arr : 0, g = prevArr > 0 ? v.arr / prevArr - 1 : null;
  // Board-Zufriedenheit: Wachstum, Runway, Ziele der Investoren
  let mood = (g === null ? 0 : clamp(g * 40, -15, 15)) + (runway(v) < 6 ? -8 : 2) + (v.pmf > 0.7 ? 3 : 0) - (v.hyper.on && !hyperReady(v) ? 6 : 0);
  if (v.target && v.qi >= v.target.q) { if (v.arr >= v.target.arr) { mood += 10; v.target = null; } else { mood -= 20; v.down = (v.down || 1) * 0.8; addInbox(v, { k: 'info', title: 'Ziel der Investoren verfehlt', text: `Das vereinbarte ARR-Ziel von ${fmtE(v.target.arr, 0)} wurde verpasst. Die nächste Finanzierungsrunde wird mit Abschlag bewertet (Down Round).` }); v.target = null; } }
  v.board = clamp(v.board + mood, 0, 100);
  v.q.push({ q: qName(v.qi), t: M.t, rev: c.rev, gross: c.gross, ebit, arr: v.arr, cust: v.customers, newC: c.newC, churnC: c.churnC, cash: v.cash, gm: u.gm, cac: u.cac, ltv: u.ltv, churn: u.churn, pmf: v.pmf, share: u.share, board: v.board, val: valuation(v) });
  if (v.q.length > 12) v.q.shift();
  v.qi++; v.day = 0; v.cur = blankCur(); v.pr = 0;
  // Hyperscaling-Team: wächst mit, solange skaliert wird, und baut sich danach nur langsam ab
  v.hyperCost = (v.hyperCost || 0) * 0.5 + 0.2 * (c.hyp || 0);
  v.fx = (v.fx || []).filter(e => e.until > v.qi);
  // Kapazitätsausbau, Studien
  if (v.cap && v.cap.building && --v.cap.qLeft <= 0) { v.cap.building = 0; v.cap.level++; ENV.note(A, `${v.name}: Neue Kapazität ist in Betrieb (Stufe ${v.cap.level}).`, 'up'); }
  if (v.trial && v.trial.phase < 4 && v.trial.prog >= 1) trialReadout(A, v);
  setBudget(v); // Budget für das neue Quartal
  // Phase
  const ipoOk = v.qi >= IPO_MIN_QUARTERS && (v.arr >= (m.ipoArr || VENTURE_STAGES[3].min) || (m.trial && v.trial && v.trial.phase >= 3 && v.trial.prog >= 0.4 && valuation(v) >= 2.5e8)); // Biotech darf vor der Zulassung an die Börse
  const ns = ipoOk ? 3 : VENTURE_STAGES.reduce((k, s, i) => (i < 3 && v.arr >= s.min ? i : k), 0);
  if (ns !== v.stage) { const up = ns > v.stage; v.stage = ns; ENV.note(A, `${v.name} ${up ? 'erreicht' : 'fällt zurück in'} die Phase „${vstage(v).name}“.`, up ? 'tier' : 'dn'); if (up) addNews(`${v.name} wächst: ${fmtBig(v.arr)} € Jahresumsatz`, 1, [], { cat: 'company', sub: `Das Startup von ${A.name} ist jetzt in der Phase „${vstage(v).name}“.` }); }
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
  ENV.note(A, `Board-Meeting ${v.q[v.q.length - 1].q}: ARR ${fmtE(v.arr, 0)}${g !== null ? ` (${pct(g, 0)})` : ''}, Kasse ${fmtE(v.cash, 0)}, Board ${Math.round(v.board)}/100`, g !== null && g < 0 ? 'dn' : 'up');
}
function trialReadout(A, v) {
  const T = TRIAL[v.trial.phase], ok = Math.random() < T.p + 0.15 * (v.pmf - 0.5);
  const dead = !ok && v.trial.phase >= 2 && Math.random() < 0.3; // der Wirkstoff ist gescheitert – zurück auf Anfang mit neuem Kandidaten
  if (ok) { v.trial.phase++; v.trial.prog = 0; v.pmf = clamp(v.pmf + 0.12, 0, 1); }
  else if (dead) { v.trial.phase = 1; v.trial.prog = 0; v.pmf = clamp(v.pmf - 0.2, 0.1, 1); v.down = (v.down || 1) * 0.7; }
  else v.trial.prog = 0.35;
  const done = v.trial.phase >= 4;
  addNews(ok ? `${v.name}: ${T.name} erfolgreich${done ? ' – Zulassung erteilt' : ''}` : dead ? `${v.name}: Wirkstoff scheitert in ${T.name}` : `${v.name}: ${T.name} verfehlt das Studienziel`, ok ? 1 : -1, [], { cat: 'company', sub: ok ? (done ? 'Das Medikament darf verkauft werden. Patente schützen es für Jahre.' : `Nächster Schritt: ${TRIAL[v.trial.phase].name}.`) : dead ? 'Der Kandidat wird eingestellt. Mit einem Nachfolger beginnt die klinische Entwicklung neu – die Bewertung bricht ein.' : 'Ein Teil der Studie muss wiederholt werden – das kostet Zeit und Geld.' });
  ENV.note(A, ok ? `${T.name} bestanden!${done ? ' Dein Produkt ist zugelassen.' : ''}` : dead ? `${T.name}: Wirkstoff gescheitert – ihr startet mit einem neuen Kandidaten in Phase I.` : `${T.name} gescheitert – Studie wird teilweise wiederholt.`, ok ? 'tier' : 'dn');
}
function bankrupt(A, v) {
  v.status = 'failed'; v.failedT = M.t;
  addNews(`${v.name} meldet Insolvenz an`, -1, [], { cat: 'company', sub: 'Das Geld ist ausgegangen. Die Gründer verlieren ihren Einsatz – persönlich haften sie nicht.' });
  book(A, 'venture', 0, `${v.name} insolvent – Beteiligung verloren`);
  ENV.note(A, `${v.name} ist insolvent. Deine Beteiligung ist verloren, weitere Schulden entstehen dir nicht. Du kannst jederzeit neu gründen.`, 'dn'); ENV.dirty(A);
}

/* ---------- Markt-Duell: Marktanteile kosten gelistete Rivalen echten Gewinn ---------- */
function duel(A, v, u) {
  const d = u.share - (v.lastShare || 0); v.lastShare = u.share; if (!(d > 0.0005)) return;
  const T = segTAM(v);
  for (const id of v.rivals) {
    const x = I(id); if (!x || x.delisted || !x.fin) continue;
    const w = v.w[id] * (v.target2 === id ? 1.8 : 1), lostPts = d * w / (v.target2 ? 1.27 : 1), lostRev = lostPts * T, revA = x.fin.rev * 4;
    x.padj = (x.padj || 0) - clamp(1.5 * lostRev / revA, 0, 0.3);
    const before = v.lost[id] || 0; v.lost[id] = before + lostPts;
    if (Math.floor(v.lost[id] / 0.05) > Math.floor(before / 0.05)) {
      const j = -clamp(3 * lostRev / revA + 0.01, 0.005, 0.08); x.f *= Math.exp(j); x.price = x.f * Math.exp(x.tr); setWhy(x, `${pct(j, 1)} – verliert Kunden an ${v.name}`, j); recomputeDerived();
      addNews(`${v.name} jagt ${x.name} Marktanteile ab`, -1, [x.id], { cat: 'company', eff: j, sub: `Seit dem Start hat ${x.name} rund ${fmt(v.lost[id] * 100, 0)} Prozentpunkte im Segment verloren. Das schlägt bei den nächsten Quartalszahlen durch.` });
    }
  }
}
function rivalAI(A, v, u) {
  for (const id of v.rivals) {
    const x = I(id); if (!x || x.delisted) continue; const pr = rivalProfile(x);
    const p = (0.03 + 1.6 * u.share + (v.lost[id] || 0) * 2) * pr.aggr; if (Math.random() > p) continue;
    const r = Math.random(), V = valuation(v);
    if (V > 3e6 && u.share > 0.01 && pr.cash >= 0.5 && r < 0.25 && !v.inbox.some(i => i.k === 'buyout')) {
      const price = r2(V * (1.2 + Math.random() * 0.4) * (ex(v, 'cfo').val || 1));
      addInbox(v, { k: 'buyout', title: `${x.name} will ${v.name} kaufen`, text: `Angebot: ${fmtE(price, 0)} für das ganze Unternehmen (${pct(price / V - 1, 0)} über der aktuellen Bewertung). Dein Anteil (${fmt(founderPct(v) * 100, 1)} %) wäre ${fmtE(price * founderPct(v), 0)} wert – sofort und in bar. Lehnst du ab, bleibt der Weg zum eigenen Börsengang.`, opts: [{ k: 'accept', label: 'Verkaufen (Exit)' }, { k: 'reject', label: 'Ablehnen' }], def: 1, data: { id, price } });
      addNews(`Gerücht: ${x.name} prüft Übernahme von ${v.name}`, 0, [x.id], { cat: 'ma', rumor: true, p: 0.5 });
    } else if (r < 0.55) {
      addInbox(v, { k: 'pricewar', title: `${x.name} startet einen Preiskampf`, text: `${x.name} senkt die Preise, um Kunden zurückzuholen. Ziehst du mit, sinkt dein Umsatz pro Kunde; hältst du die Preise, verlierst du Kunden.`, opts: [{ k: 'match', label: 'Preise senken (−10 % ARPU)' }, { k: 'hold', label: 'Preise halten (−8 % Kunden)' }, { k: 'diff', label: 'Mit Produkt differenzieren (Kosten, +PMF)' }], def: 1, data: { id } });
      addNews(`${x.name} senkt die Preise – Kampfansage an ${v.name}`, -1, [x.id], { cat: 'company', sub: 'Preiskämpfe kosten beide Seiten Marge.' });
      x.padj = (x.padj || 0) - 0.01;
    } else if (r < 0.8) {
      v.pmf = clamp(v.pmf - 0.05, 0, 1);
      addNews(`${x.name} kopiert Funktionen von ${v.name}`, 0, [x.id], { cat: 'company', sub: 'Der Konzern baut die Ideen des Startups nach. Dessen Vorsprung schrumpft.' });
      ENV.note(A, `${x.name} kopiert eure Funktionen – Product-Market Fit −5 Punkte.`, 'dn');
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
  if (m.subsidy && subsidyActive(v) && !v.subT) { v.subT = M.t; const g = r2(Math.max(5000, (v.capexSum || 0) * 0.1)); v.cash += g; addNews(`Förderprogramm: ${v.name} erhält ${fmtE(g, 0)} Zuschuss`, 1, [], { cat: 'politics', sub: 'Das Konjunkturpaket fördert Investitionen in Schlüsseltechnologien. Kapazitätsausbau ist 30 % günstiger.' }); ENV.note(A, `Subvention: ${fmtE(g, 0)} für ${v.name}.`, 'up'); }
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
export function decide(A, id, opt) {
  const v = A.venture; if (!v) return 'Kein Unternehmen.'; const it = v.inbox.find(i => i.id === Number(id)); if (!it) return 'Eintrag nicht gefunden.';
  if (!it.opts) { v.inbox.splice(v.inbox.indexOf(it), 1); ENV.dirty(A); return null; }
  const k = it.opts.findIndex(o => o.k === opt); if (k < 0) return 'Ungültige Wahl.';
  return decideItem(A, v, it, k, false);
}
function decideItem(A, v, it, k, auto) {
  const o = it.opts[k].k, d = it.data || {}, x = d.id ? I(d.id) : null;
  v.inbox.splice(v.inbox.indexOf(it), 1);
  if (it.k === 'vc' && o !== 'no') {
    const pre = o === 'hi' ? d.hiPre : d.loPre, dil = o === 'hi' ? d.dHi : d.dLo, raise = r2(pre * dil / (1 - dil));
    for (const key of ['founder', 'esop']) v.capt[key] *= 1 - dil; for (const i of v.capt.inv) i.pct *= 1 - dil;
    v.capt.inv.push({ name: d.inv, round: d.name, pct: dil }); v.cash += raise; v.rounds.push(d.round); v.down = 1;
    if (o === 'hi') v.target = { arr: d.tgt, q: v.qi + 4 };
    addNews(`${v.name} sammelt ${fmtE(raise, 0)} ein (${d.name})`, 1, [], { cat: 'ma', sub: `${d.inv} führt die Runde an, Bewertung nach der Runde: ${fmtE(pre + raise, 0)}.` });
    ENV.note(A, `${d.name} abgeschlossen: +${fmtE(raise, 0)} in die Firmenkasse, Verwässerung ${fmt(dil * 100, 0)} %.`, 'tier');
  } else if (it.k === 'vc') ENV.note(A, auto ? 'Das Term Sheet ist verfallen.' : 'Finanzierungsrunde abgelehnt – du behältst alle Anteile.', '');
  if (it.k === 'buyout' && o === 'accept') return exit(A, v, d.price, x);
  if (it.k === 'pricewar') { if (o === 'match') v.fx.push({ k: 'arpu', m: 0.9, until: v.qi + 3 }); else if (o === 'hold') v.customers *= 0.92; else { const c = r2(Math.max(1000, v.cash * 0.08)); v.cash -= c; v.pmf = clamp(v.pmf + 0.04, 0, 1); } }
  if (it.k === 'lobby') { if (o === 'counter') v.cash -= r2(Math.max(0, v.cash) * 0.05); else if (Math.random() < 0.5) { v.reg = { until: v.qi + 4 }; addNews(`Neue Auflagen für ${vm(v).sub}`, -1, x ? [x.id] : [], { cat: 'politics', sub: `Die Lobbyarbeit hat gewirkt – ${v.name} muss strengere Regeln erfüllen. Das kostet Marge.` }); } }
  if (it.k === 'antitrust') { if (o === 'concede') { v.growthPen = v.qi + 4; v.fx.push({ k: 'arpu', m: 0.95, until: v.qi + 4 }); v.reg = { until: v.qi + 4 }; } else { v.cash -= r2(Math.max(0, v.cash) * 0.05); if (Math.random() < 0.45) { const fine = r2(v.arr * 0.1); v.cash -= fine; v.fx.push({ k: 'arpu', m: 0.9, until: v.qi + 4 }); addNews(`Strafe gegen ${v.name}: ${fmtE(fine, 0)}`, -1, [], { cat: 'politics', sub: 'Das Gericht sieht Marktmissbrauch. Dazu kommen Auflagen für die Preisgestaltung.' }); } else addNews(`${v.name} gewinnt vor Gericht`, 1, [], { cat: 'politics', sub: 'Die Vorwürfe wurden fallen gelassen.' }); } }
  if (it.k === 'grant') { v.grantQ = v.qi; if (o === 'yes') { v.cash += d.g; v.grants = (v.grants || 0) + 1; v.grantBase = v.rdSum + (v.capexSum || 0); addNews(`Förderung: ${v.name} erhält ${fmtE(d.g, 0)}`, 1, [], { cat: 'politics', sub: 'Die Förderbank unterstützt Investitionen in Schlüsseltechnologien.' }); ENV.note(A, `Zuschuss über ${fmtE(d.g, 0)} erhalten.`, 'up'); } }
  if (it.k === 'bridge') { v.bridgeQ = v.qi; if (o === 'yes') { for (const key of ['founder', 'esop']) v.capt[key] *= 1 - d.dil; for (const i of v.capt.inv) i.pct *= 1 - d.dil; const lead = v.capt.inv[v.capt.inv.length - 1]; lead.pct += d.dil; v.cash += d.amt; v.down = (v.down || 1) * 0.85; v.board = clamp(v.board - 5, 0, 100); addNews(`${v.name} erhält Brückenfinanzierung`, -1, [], { cat: 'ma', sub: `Die Investoren schießen ${fmtE(d.amt, 0)} nach. Die Bewertung leidet.` }); ENV.note(A, `Brückenfinanzierung: +${fmtE(d.amt, 0)}, Verwässerung ${fmt(d.dil * 100, 1)} %.`, 'dn'); } }
  if (it.k === 'deal' && o === 'yes') { v.customers += d.n; v.fx.push({ k: 'arpu', m: 0.93, until: v.qi + 4 }); }
  if (it.k === 'tariff') { v.tarDone = 1; if (o === 'move') { const c = r2(Math.max(2000, v.arr * 0.15)); v.cash -= c; v.tarShield = 1; } else v.fx.push({ k: 'conv', m: 0.85, until: v.qi + 3 }); }
  ENV.dirty(A); return null;
}
function exit(A, v, price, x) {
  const mine = r2(price * founderPct(v)), pnl = r2(mine - v.invested);
  A.cash += mine; A.realized += pnl; book(A, 'venture', mine, `Exit: ${v.name} an ${x ? x.name : 'Käufer'}`);
  v.status = 'exited'; v.exitT = M.t; v.exitPrice = price; v.exitMine = mine;
  if (x) { x.padj = (x.padj || 0) + clamp(v.arr / (x.fin.rev * 4) * 0.5, 0, 0.2); addNews(`${x.name} übernimmt ${v.name} für ${fmtE(price, 0)}`, 1, [x.id], { cat: 'ma', sub: `${A.name} verkauft das Startup und erhält für den eigenen Anteil ${fmtE(mine, 0)}.` }); }
  ENV.note(A, `Exit! Du erhältst ${fmtE(mine, 0)} für deinen Anteil an ${v.name}.`, 'tier'); ENV.event(A, 'exit'); ENV.dirty(A); return null;
}

/* ---------- Börsengang ---------- */
export function vIpoQuote(v, disc, float) {
  const V = valuation(v), N = VENTURE_SHARES, P = V * (1 - disc) / N, n = N * float / (1 - float), raise = n * P * 0.97;
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
  ENV.note(A, `Willkommen an der Börse! ${v.name} notiert als ${id} – deine Aktien liegen im Depot.`, 'tier'); ENV.event(A, 'ownipo'); ENV.dirty(A); return null;
}
// Quartalszahlen der börsennotierten Spieler-Firma: echte Zahlen aus der Simulation, Erwartung = eigene Guidance
ENV.ventReport = x => {
  let A = null; for (const B of ENV.accounts()) if (B.uid === x.player) { A = B; break; }
  const v = A && A.venture; if (!v || v.listedId !== x.id) return null;
  const c = v.cur, ebit = c.gross - c.opex - c.mkt - c.rd - c.capex, rev = c.rev, eps = ebit * 0.75 / x.shares;
  const revE = v.guid ? v.guid.rev : x.fin.rev * (1 + x.fin.g / 4), epsE = v.guid ? v.guid.eps : (x.fin.eps || eps * 0.95);
  v.q.push({ q: qLabel(M.t - 45 * DAY), t: M.t, rev, gross: c.gross, ebit, arr: v.arr, cust: v.customers, newC: c.newC, churnC: c.churnC, cash: v.cash, gm: unit(v).gm, cac: unit(v).cac, ltv: unit(v).ltv, churn: unit(v).churn, pmf: v.pmf, share: vShare(v), board: v.board, val: x.price * x.shares, guid: v.guid || null });
  if (v.q.length > 12) v.q.shift();
  v.qi++; v.cur = blankCur(); v.guid = null; v.fx = (v.fx || []).filter(e => e.until > v.qi);
  const u = unit(v); duel(A, v, u); rivalAI(A, v, u); government(A, v, u);
  ENV.dirty(A);
  return { rev, eps, revE, epsE };
};
export function setGuidance(A, b) {
  const v = A.venture; if (!v || v.status !== 'public_listed') return 'Guidance gibt es erst nach dem Börsengang.';
  const rev = Number(b.rev), eps = Number(b.eps); if (!(rev > 0) || !isFinite(eps)) return 'Bitte Umsatz und Gewinn je Aktie angeben.';
  v.guid = { rev, eps, t: M.t }; const x = I(v.listedId);
  if (x) addNews(`${v.name} gibt Prognose: ${fmtBig(rev)} € Umsatz im Quartal`, 0, [x.id], { cat: 'company', sub: `Gewinn je Aktie erwartet: ${fmt(eps, 2)} €. Die nächsten Zahlen werden an dieser Prognose gemessen.` });
  ENV.dirty(A); return null;
}
export function buyback(A, amt) {
  const v = A.venture; if (!v || v.status !== 'public_listed') return 'Nur für börsennotierte Unternehmen.'; const x = I(v.listedId); if (!x) return 'Aktie nicht gefunden.';
  if (!M.isOpen) return 'Rückkäufe laufen zu Börsenzeiten.';
  amt = Number(amt); if (!(amt >= 1000)) return 'Mindestens 1.000 €.'; if (amt > v.cash) return `In der Firmenkasse sind ${fmtE(v.cash, 0)}.`;
  const p0 = x.price; applyTrade(x, 1, amt, true); const n = amt / ((p0 + x.price) / 2); x.shares -= n; v.cash -= amt; recomputeDerived();
  addNews(`${v.name} kauft eigene Aktien für ${fmtE(amt, 0)} zurück`, 1, [x.id], { cat: 'company', sub: 'Weniger Aktien bedeuten mehr Gewinn je Aktie – Aktionäre profitieren.' });
  ENV.note(A, `Rückkauf: ${fmt(n, 0)} Aktien eingezogen.`, 'up'); ENV.dirty(A); return null;
}
export function dividend(A, amt) {
  const v = A.venture; if (!v || v.status !== 'public_listed') return 'Nur für börsennotierte Unternehmen.'; const x = I(v.listedId); if (!x) return 'Aktie nicht gefunden.';
  amt = Number(amt); if (!(amt >= 1000)) return 'Mindestens 1.000 €.'; if (amt > v.cash) return `In der Firmenkasse sind ${fmtE(v.cash, 0)}.`;
  v.cash -= amt; payDividend(x, amt / x.shares, 'Sonderdividende');
  ENV.note(A, `Sonderdividende über ${fmtE(amt, 0)} beschlossen – auch du erhältst deinen Anteil.`, 'div'); ENV.dirty(A); return null;
}
export function ventureReset(A) { const v = A.venture; if (!v || (v.status !== 'failed' && v.status !== 'exited')) return 'Erst nach Insolvenz oder Exit möglich.'; A.venture = null; ENV.dirty(A); return null; }
