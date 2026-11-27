// NOVEX Börse – Volkswirtschaft: BIP, Arbeitslosigkeit, Konsumklima, Geldmenge, Energie, Inflationstrend, Staatsschulden.
// Alles hängt kausal zusammen und wirkt über Sensitivitäten auf Aktien, Devisen und Anleihen. Fortschreibung einmal je Handelstag.
import { M, hook, byCls, gauss, clamp, dayStart } from './engine.js';
import { REGIMES, sensOf } from './data.js';

// Grundtempo der Wirtschaft je Marktphase (BIP-Wachstum in % p. a.)
const GDP_BASE = { bull: 2.6, side: 1.3, infl: 1.1, hike: 0.6, rec: -1.8, recov: 2.4 };
export const NEUTRAL = { gdp: 1.5, unemp: 5.5, conf: -8, lz: 0.025, infl: 2.0 };
export const FOREIGN = { USD: 0.040, GBP: 0.040, JPY: 0.005, CHF: 0.0025, AUD: 0.036 };

// Zollniveau: Importzölle der EU (wirken auf Preise) und Belastung des Exports (wirkt aufs Wachstum)
export function tariffIndex() {
  const t = (M.pol && M.pol.tar) || {};
  const imp = 0.45 * (t.eu_us || 0) + 0.45 * (t.eu_asia || 0);
  const drag = 0.35 * (t.us_eu || 0) + 0.08 * (t.us_asia || 0) + 0.2 * imp;
  return { imp, drag };
}

hook('init', () => {
  const brnt = M.inst.BRNT ? M.inst.BRNT.price : 80;
  if (!M.mac) M.mac = { gdp: GDP_BASE[M.reg ? M.reg.k : 'bull'] || 1.8, unemp: 5.6, conf: -7, m2: 4.5, oilRef: brnt, energy: 0, debt: 64, stim: 0, inflT: M.infl || 2.3, tarImp: 0, tarDrag: 0, h: [], day: 0 };
  if (!M.fr) M.fr = Object.assign({}, FOREIGN);
  for (const k in FOREIGN) if (M.fr[k] === undefined) M.fr[k] = FOREIGN[k];
  if (!M.mac.h.length) seedHistory();
});

// Startverlauf für das Makro-Dashboard (rückwärts geschätzt, damit die Kurven nicht leer sind)
function seedHistory() {
  const m = M.mac, ix = M.inst.WELTIX; const days = ix && ix.cD ? ix.cD.slice(-60).map(k => k[0]) : [];
  let g = m.gdp - 0.4, u = m.unemp + 0.2, c = m.conf - 2, i = (M.infl || 2.3) + 0.2;
  for (const t of days) { g += 0.07 * (m.gdp - g) + 0.04 * gauss(); u += 0.07 * (m.unemp - u) + 0.01 * gauss(); c += 0.07 * (m.conf - c) + 0.3 * gauss(); i += 0.07 * ((M.infl || 2.3) - i) + 0.02 * gauss(); m.h.push([t, +g.toFixed(2), +u.toFixed(2), +c.toFixed(1), +i.toFixed(2), +((M.lz || 0.02) * 100).toFixed(2), 0, +i.toFixed(2)]); }
}

// Einmal je Handelstag nach der Eröffnungslücke
hook('open', () => {
  const m = M.mac, today = dayStart(M.t); if (!m || m.day === today) return; m.day = today;
  const reg = M.reg ? M.reg.k : 'side', lz = M.lz === undefined ? M.r : M.lz, infl = M.infl === undefined ? 2.2 : M.infl;
  const ti = tariffIndex(); m.tarImp = ti.imp; m.tarDrag = ti.drag;
  // Energie: Ölpreis gegenüber seinem gleitenden Mittel
  const oil = M.inst.BRNT ? M.inst.BRNT.price : m.oilRef; m.energy = Math.log(oil / m.oilRef); m.oilRef += 0.02 * (oil - m.oilRef);
  // BIP: Marktphase + Konjunkturpakete − Zölle − Realzins + Konsumklima
  const real = lz * 100 - infl;
  const gdpT = (GDP_BASE[reg] ?? 1.5) + m.stim - 0.06 * ti.drag - 0.25 * (real - 0.5) + 0.04 * (m.conf - NEUTRAL.conf);
  m.gdp = clamp(m.gdp + 0.08 * (gdpT - m.gdp) + 0.06 * gauss(), -6, 7);
  // Arbeitslosigkeit (Okun-Gesetz): Wachstum unter Potenzial lässt sie steigen
  m.unemp = clamp(m.unemp - 0.012 * (m.gdp - 1.3) + 0.002 * (NEUTRAL.unemp - m.unemp) + 0.015 * gauss(), 2.5, 14);
  // Konsumklima: Wachstum, Preise, Jobs, Börse, Zölle
  const ix = M.inst.WELTIX, c = ix && ix.cD.length > 21 ? ix.price / ix.cD[ix.cD.length - 21][4] - 1 : 0;
  const confT = NEUTRAL.conf + 2.5 * (m.gdp - 1.5) - 1.2 * (infl - 2) - 1.5 * (m.unemp - NEUTRAL.unemp) + 40 * c - 0.15 * ti.imp - 0.08 * ti.drag;
  m.conf = clamp(m.conf + 0.15 * (confT - m.conf) + 0.4 * gauss(), -40, 15);
  // Geldmenge: hohe Zinsen bremsen die Kreditvergabe, Konjunkturpakete erhöhen sie
  m.m2 = clamp(m.m2 + 0.05 * (5 - 120 * (lz - 0.02) + 1.5 * m.stim - m.m2), -4, 14);
  // Inflationstrend: Konjunktur, Geldmenge, Energie, Zölle (Grundlage der nächsten VPI-Erwartung)
  const regI = REGIMES[reg] ? REGIMES[reg].infl : 2.2;
  m.inflT = clamp(2.0 + 0.45 * (m.gdp - 1.5) + 0.12 * (m.m2 - 5) + 6 * m.energy + 0.06 * ti.imp + 0.5 * (regI - 2.2), -1.5, 11);
  // Staatsschulden: steigen mit Paketen und in Krisen, sinken langsam im Aufschwung
  m.debt = clamp(m.debt + 0.004 * m.stim + 0.003 * (1.5 - m.gdp), 20, 200);
  m.stim *= 0.985;
  // Zinsstruktur: hohe Schulden erhöhen die Laufzeitprämie
  M.slope = clamp(M.slope + 0.05 * (0.009 + 0.0004 * (m.debt - 64) - M.slope), -0.03, 0.05);
  // Auslandszinsen: US-Zentralbank reagiert auf eigene Zölle (Inflation importiert)
  const usT = 0.035 + 0.0002 * ((M.pol && M.pol.tar && (M.pol.tar.us_eu + M.pol.tar.us_asia)) || 0) + 0.002 * (m.gdp - 1.5);
  M.fr.USD = clamp(M.fr.USD + 0.03 * (usT - M.fr.USD) + 0.0004 * gauss(), 0, 0.09);
  M.fr.GBP = clamp(M.fr.GBP + 0.02 * (M.fr.USD - M.fr.GBP) + 0.0003 * gauss(), 0, 0.09);
  // Devisen: Zinsdifferenz (Carry) und sicherer Hafen Franken bei schlechter Stimmung
  if (M.U) {
    M.U.EUR *= Math.exp(0.0003 * (lz - M.fr.USD) * 100 + 0.0002 * (m.gdp - 1.5) + 0.00015 * gauss());
    M.U.CHF *= Math.exp(-0.00015 * (m.conf - NEUTRAL.conf) / 5);
    for (const f of byCls('fx')) f.price = M.U[f.base] / M.U[f.quote];
  }
  macroDrift(lz, infl);
  m.h.push([today, +m.gdp.toFixed(2), +m.unemp.toFixed(2), +m.conf.toFixed(1), +infl.toFixed(2), +(lz * 100).toFixed(2), +ti.imp.toFixed(1), +m.inflT.toFixed(2)]);
  if (m.h.length > 260) m.h.splice(0, m.h.length - 260);
});

// Branchenunterschiede durch Konjunktur, Zinsen und Inflation (marktneutral: der Index bleibt unberührt, die Gewichte verschieben sich)
function macroDrift(lz, infl) {
  const m = M.mac, st = byCls('stock'); if (!st.length) return;
  const raw = st.map(x => { const s = sensOf(x); return 0.0006 * s.cyc * (m.gdp - 1.5) + 0.00025 * s.infl * (infl - 2.2) - 0.04 * s.rate * (lz - NEUTRAL.lz) + ((x.sector === 'cons' || x.sector === 'auto') ? 0.00008 * (m.conf - NEUTRAL.conf) : 0); });
  let w = 0, mu = 0; st.forEach((x, i) => { if (!x.core) return; const c = x.shares * x.price; w += c; mu += c * raw[i]; }); mu = w ? mu / w : 0;
  st.forEach((x, i) => { const j = clamp(raw[i] - mu, -0.01, 0.01); x.f *= Math.exp(j); x.price = x.f * Math.exp(x.tr); });
}

// Erwartete Änderung der Gewinne durch die Konjunktur (für Quartalszahlen und eigene Unternehmen)
export function macroRevFactor(x) {
  const m = M.mac; if (!m) return 0; const s = sensOf(x);
  return 0.003 * s.cyc * (m.gdp - 1.5) + 0.0004 * (m.conf - NEUTRAL.conf) * (x.sector === 'cons' || x.sector === 'auto' ? 1 : 0.3);
}
// Taylor-Regel: Leitzins, den die Zentralbank anstrebt
export function taylor() {
  const m = M.mac, infl = M.infl === undefined ? 2.2 : M.infl;
  const base = 2.0 + 1.5 * (infl - 2) + (m ? 0.5 * (m.gdp - 1.5) - 0.25 * (m.unemp - NEUTRAL.unemp) : 0);
  return clamp(base / 100, 0, 0.08);
}
