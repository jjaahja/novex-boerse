// NOVEX Börse – Gemeinsames Unternehmens-Fundament für gelistete Konzerne, übernommene Firmen und Spieler-Startups:
// Sektor-Umsätze (Marktvolumen), Bewertungs-Multiples aus Börsen-Peers, Rivalen-Profile, Index-/ETF-Bereinigung beim Delisting.
import { M, I, all, q2e, clamp, dayStart } from './engine.js';
import { sensOf } from './data.js';

const listedStocks = () => M.ids.map(id => M.inst[id]).filter(x => x && x.cls === 'stock' && !x.delisted);
const cache = { day: -1, rev: {} };
// Jahresumsatz aller gelisteten Unternehmen eines Sektors (aus den Quartalszahlen), einmal je Handelstag berechnet
export function sectorRev(sector) {
  const d = dayStart(M.t); if (cache.day !== d) { cache.day = d; cache.rev = {}; }
  if (cache.rev[sector] === undefined) cache.rev[sector] = listedStocks().filter(x => x.sector === sector && x.fin).reduce((s, x) => s + x.fin.rev * 4, 0);
  return cache.rev[sector];
}
// Typisches Verhältnis Unternehmenswert / operativer Gewinn (EV/EBIT) der Börsen-Peers
export function peerMult(sector) {
  const v = listedStocks().filter(x => x.sector === sector && x.eps > 0).map(x => x.price / (x.eps * 1.3)).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 12;
}
// Kurs-Umsatz-Verhältnis der Peers (für Unternehmen ohne Gewinn, z. B. Startups)
export function peerPS(sector) {
  const v = listedStocks().filter(x => x.sector === sector && x.fin && x.fin.rev > 0).map(x => x.shares * x.price / (x.fin.rev * 4)).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 3;
}
// Die drei wichtigsten Rivalen eines Sektors: Marktführer, ein mittlerer und der kleinste Wettbewerber
export function rivalsOf(sector, exclude) {
  const st = listedStocks().filter(x => x.sector === sector && x.id !== exclude && x.fin).sort((a, b) => b.shares * b.price - a.shares * a.price);
  if (st.length <= 3) return st;
  return [st[0], st[Math.floor(st.length / 2)], st[st.length - 1]];
}
// Rivalen-Profil aus echten Kennzahlen: wie gefährlich, wie träge, wie zinsempfindlich
export function rivalProfile(x) {
  const s = sensOf(x), mcap = x.shares * x.price, g = x.fin ? x.fin.g : 0, kgv = x.eps > 0 ? x.price / x.eps : 99;
  if (mcap > 3e11 && g < 0.1) return { k: 'legacy', name: 'Legacy-Marktführer', desc: 'Hoher Marktanteil und volle Kassen, aber träge bei Innovationen. Reagiert spät – dann mit Preiskampf oder Übernahmeangebot.', aggr: 0.6, cash: 1 };
  if (g >= 0.2 || kgv > 45) return { k: 'star', name: s.rate > 1.2 ? 'Schuldenfinanzierter Wachstums-Star' : 'Wachstums-Star', desc: 'Wächst schnell und kopiert gute Ideen sofort. ' + (s.rate > 1.2 ? 'Steigende Zinsen treffen ihn hart.' : 'Hohe Bewertung – Rückschläge werden bestraft.'), aggr: 1, cash: 0.6 };
  if (mcap < 1e9) return { k: 'niche', name: 'Nischenanbieter', desc: 'Klein und spezialisiert. Verliert schnell Kunden, wenn ein Angreifer besser ist – und wäre selbst ein Übernahmeziel.', aggr: 0.3, cash: 0.2 };
  return { k: 'solid', name: 'Etablierter Mittelständler', desc: 'Solide Zahlen, treue Kunden. Wehrt sich mit Lobbyarbeit und Partnerschaften.', aggr: 0.5, cash: 0.5 };
}
// Beim Delisting: Wert aus Index, ETFs und Fonds herausnehmen, ohne Kurssprung (Teiler bzw. Faktor anpassen)
const bpx = m => m.cls === 'bond' ? m.tri : m.cls === 'cmd' ? m.price * q2e(m) : m.price;
export function removeFromBaskets(id) {
  for (const y of all()) {
    if (!y.comp || !y.comp.some(c => c.id === id)) continue;
    if (y.cls === 'index') { const old = y.price; y.comp = y.comp.filter(c => c.id !== id); const s = y.comp.reduce((a, c) => a + c.c * I(c.id).price, 0); y.divisor = s / old; }
    else { const s0 = y.comp.reduce((a, c) => a + c.c * bpx(I(c.id)), 0); y.comp = y.comp.filter(c => c.id !== id); const s1 = y.comp.reduce((a, c) => a + c.c * bpx(I(c.id)), 0); if (s1 > 0) y.ff *= s0 / s1; }
  }
}
// Zinsfaktor für Bewertungen: Wachstumswerte und Startups leiden unter hohen Zinsen
export const rateFactor = (sens = 1.4) => clamp(1 - 4 * sens * ((M.lz === undefined ? 0.02 : M.lz) - 0.025), 0.4, 1.4);
