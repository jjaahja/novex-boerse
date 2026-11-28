// NOVEX Börse – Startup 4.0: reine Spiel-Funktionen ohne eigenen Zustand (Browser und Worker rechnen identisch).
// Launches mit Live-Impulsen, Compliance-Risiko bei Front-Running, IPO-Bookbuilding, Büro-Stufen, Rivalen-Archetypen.
import { M, I, clamp } from './engine.js';

// Deterministischer Zufall (gleicher Seed → gleicher Ablauf im Browser und auf dem Server)
export function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Releases: alle 2–3 Wochen ein Launch mit Pre-Launch-Fokus und Launch-Day-Ticker ---------- */
export const RELEASE = { every: [14, 19], window: 5, points: 6, maxReact: 2 };
// Engpass je Geschäftsmodell: digital = Serverlast, physisch = Lieferkette/Fertigung, Pharma = Studienzentren
export const BOTTLENECK = { saas: 'Serverlast', b2c: 'Serverlast', fintech: 'Transaktions-Last', deeptech: 'Lieferkette', cleantech: 'Fertigung & Netzanschluss', biotech: 'Studienzentren' };
export const ALLOC = [['q', 'Produktqualität', 'Weniger Bugs, bessere Reviews.'], ['s', 'Skalierung', 'Kapazität für den Ansturm.'], ['h', 'Marketing-Hype', 'Mehr Aufmerksamkeit am Launch-Tag.']];
export const REACTIONS = {
  hotfix: { name: 'Hotfix priorisieren', desc: 'Das Team stoppt alles andere und behebt die Fehler.', cost: 0.03, fix: ['bug', 'reviews'] },
  capacity: { name: 'Kapazität zukaufen', desc: 'Zusätzliche Server, Schichten oder Zulieferer – teuer, aber der Ansturm wird bedient.', cost: 0.06, fix: ['spike', 'jam'] },
  promo: { name: 'Aggressive Promo', desc: 'Rabatte und Werbung in die Welle hinein – mehr Reichweite, aber mehr Last.', cost: 0.05, boost: 1 }
};
// Die drei Live-Impulse eines Launches – abhängig von der Fokus-Verteilung, dem Modell und dem Zufall
export function launchImpulses(model, a, seed, major) {
  const r = rng(seed), q = a.q / RELEASE.points, s = a.s / RELEASE.points, h = a.h / RELEASE.points, bn = BOTTLENECK[model] || 'Kapazität';
  const pool = [
    { k: 'reviews', good: q + 0.25 * r() > 0.4, gT: 'Erste Reviews: begeistert', bT: 'Erste Reviews: holprig, viele Kinderkrankheiten' },
    { k: 'spike', good: s + 0.3 * r() > 0.35 + 0.3 * h, gT: `Nutzer-Spike – ${bn} hält`, bT: `Nutzer-Spike – ${bn} am Limit, Wartelisten` },
    { k: 'press', good: h + 0.3 * r() > 0.35, gT: 'Presse und Social Media greifen den Launch auf', bT: 'Kaum Resonanz in den Medien' },
    { k: 'bug', good: q + 0.3 * r() > 0.3, gT: 'Kein kritischer Fehler gemeldet', bT: 'Kritischer Fehler in der Kernfunktion gemeldet' },
    { k: 'jam', good: s + 0.25 * r() > 0.3, gT: 'Lieferung und Betrieb laufen rund', bT: `Engpass: ${bn} bremst die Auslieferung` }
  ];
  const digital = model === 'saas' || model === 'b2c' || model === 'fintech', order = digital ? ['reviews', 'spike', 'press', 'bug'] : ['reviews', 'jam', 'press', 'spike'];
  const pick = [order[0], order[1], r() < 0.5 ? order[2] : order[3]];
  return pick.map(k => { const p = pool.find(x => x.k === k); return { k, ok: p.good, t: p.good ? p.gT : p.bT, w: major ? 1.5 : 1 }; });
}
// Ergebnis eines Launches: Score −1 … +2 → Kunden, Qualität, PMF, Marktanteil zulasten des Ziel-Rivalen
export function launchResolve(model, a, reacts, seed, major) {
  const imp = launchImpulses(model, a, seed, major), R = (reacts || []).filter(k => REACTIONS[k]).slice(0, RELEASE.maxReact);
  let score = 0, cost = 0; const lines = [];
  for (const i of imp) { const fixed = !i.ok && R.some(k => (REACTIONS[k].fix || []).includes(i.k)); score += i.ok ? 0.5 : fixed ? 0.15 : -0.4; }
  if (R.includes('promo')) score += imp.some(i => i.k === 'spike' && !i.ok) && !R.includes('capacity') ? -0.2 : 0.35;
  for (const k of R) cost += REACTIONS[k].cost;
  score = clamp(score * (major ? 1.5 : 1), -1, 2);
  return { imp, R, score, cost, cust: 0.03 + 0.08 * Math.max(0, score), quality: imp.some(i => i.k === 'bug' && !i.ok) && !R.includes('hotfix') ? -0.05 : 0.02 * (a.q / 2), pmf: score > 0.8 ? 0.03 : score < 0 ? -0.02 : 0.01, hit: Math.max(0, score) * 0.012 };
}
export const releaseSeed = (v, id) => (id * 2246822519 + (v.t0 || 0) % 1e9) >>> 0;

/* ---------- Compliance: Front-Running eigener Ankündigungen (verdeckter Meter 0–100) ---------- */
// Netto-Exposure des Spielers in einer Aktie (Aktien + Hebelprodukte, grob delta-gewichtet)
export function exposure(A, id, derivValue) {
  const x = I(id); if (!x) return 0; let e = A.pos[id] ? A.pos[id].qty * x.price : 0;
  for (const p of A.derivs || []) if (p.und === id) { const sign = p.dir !== undefined ? Math.sign(p.dir) || 1 : p.cp === 'put' ? -1 : 1; e += sign * derivValue(p) * (p.lev || p.F || p.cfdLev || 3); }
  return e;
}
// Wer vor einer eigenen Attacke/einem Launch gegen einen Rivalen short geht (oder vor einem eigenen Übernahmeangebot kauft), fällt auf
export const complianceHit = (dExp, net, against) => { const d = against ? Math.max(0, -dExp) : Math.max(0, dExp); return clamp(d / Math.max(1000, net) * 350, 0, 80); };
export const complianceLabel = c => c >= 70 ? ['kritisch', 'crit'] : c >= 35 ? ['erhöht', 'warn'] : ['unauffällig', 'ok'];
export const COMPLIANCE = { decay: 3, fine: 0.05, halt: 3 };

/* ---------- IPO-Bookbuilding: Preisspanne entscheidet über Zeichnung und ersten Handelstag ---------- */
export const BANDS = { cons: { name: 'Konservativ', disc: 0.15, desc: 'Deutlicher Abschlag: hohe Überzeichnung, fast sicher ein First-Day-Pop.' }, fair: { name: 'Marktgerecht', disc: 0.07, desc: 'Fairer Preis: solide Zeichnung, kleiner Kursgewinn am ersten Tag.' }, aggr: { name: 'Aggressiv', disc: -0.04, desc: 'Über der Modellbewertung: mehr Erlös – wenn die Nachfrage reicht. Sonst Broken IPO.' } };
// Nachfrage (Überzeichnung) aus Marktlage, Produktstärke und Board-Autorität
export function bookDemand(ctx) { return clamp(0.7 + 0.8 * (ctx.pmf - 0.6) + 0.004 * ((ctx.auth ?? 50) - 50) + 0.6 * (ctx.mkt || 0) + (ctx.hype || 0), 0.4, 1.8); }
export function bookbuild(band, ctx, rnd) {
  const B = BANDS[band] || BANDS.fair, dem = bookDemand(ctx), sub = clamp(dem * (1 + 2.2 * B.disc) + 0.15 * (rnd() - 0.5), 0.3, 6);
  const move = sub >= 1 ? clamp(0.04 * Math.log2(sub) * 3 + 0.6 * B.disc + 0.04 * (rnd() - 0.5), -0.05, 0.4) : -clamp(0.08 + 0.25 * (1 - sub) + 0.04 * rnd(), 0.08, 0.3);
  return { sub, move, fill: Math.min(1, sub), label: sub >= 1 ? (move > 0.08 ? 'First-Day-Pop' : 'Solider Handelsstart') : 'Broken IPO' };
}

/* ---------- Büro-Stufen: schnelleres Team gegen höhere Fixkosten ---------- */
export const OFFICE = [
  { name: 'WG-Schreibtisch', cost: 0, opex: 0, speed: 1, conv: 1, talent: 1 },
  { name: 'Loft', cost: 6000, opex: 1200, speed: 1.12, conv: 1.03, talent: 0.97, stage: 0 },
  { name: 'Tech-Hub', cost: 120000, opex: 25000, speed: 1.25, conv: 1.06, talent: 0.93, stage: 1 },
  { name: 'Campus', cost: 4000000, opex: 600000, speed: 1.4, conv: 1.1, talent: 0.88, stage: 2 }
];

/* ---------- Rivalen-Archetypen (aus den echten Kennzahlen abgeleitet) ---------- */
export function archetype(profileK) { return profileK === 'legacy' ? 'legacy' : profileK === 'star' ? 'disruptor' : 'follower'; }
export const ARCH = {
  legacy: { name: 'Legacy-Konzern', desc: 'Reagiert träge – ab 15 % eurem Marktanteil folgen Patent- und Regulierungsklagen.' },
  disruptor: { name: 'Cash-Burn-Disruptor', desc: 'Rabattschlachten und Abwerbeversuche bei Schlüsselpersonal.' },
  follower: { name: 'Fast-Follower', desc: 'Kopiert jedes neue Produkt nach 3–4 Wochen – außer ein Burggraben (Patent, saubere Architektur) schützt.' }
};
// Zulieferer- und Partner-Sektoren: Beteiligungen ab 3 % daran bringen operative Boni
export const SUPPLY = { saas: ['semi', 'tel'], b2c: ['tel', 'tech'], fintech: ['tech', 'fin'], deeptech: ['ind', 'chem'], cleantech: ['ind', 'util'], biotech: ['chem', 'health'] };
export const STAKE_MIN = 0.03;
// Passive Vergleichsrechnung: Startkapital komplett in den Leitindex
export function benchmark(bm) { const ix = M.inst.WELTIX; return bm && ix && bm.ix0 > 0 ? bm.nw0 * ix.price / bm.ix0 : null; }
