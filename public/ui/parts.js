// Wiederverwendbare Bausteine: Listenzeilen, Kursbegründung, Nachrichten, Termine
import { S, E, esc, sc, pctS, initials } from './store.js';
import { info } from './glossary.js';
const { fmt, fmtPx, fDate, fTime, dig, chg, dayStart, DAY, SECTORS, CSECT, REGIMES } = E;

export const CLS = { stock: 'Aktie', etf: 'ETF', fund: 'Fonds', bond: 'Anleihe', fx: 'Devisen', index: 'Index', cmd: 'Rohstoff' };
export const isEtc = x => x.cls === 'etf' && x.comp.every(c => E.M.inst[c.id] && E.M.inst[c.id].cls === 'cmd');
export const subOf = x => x.cls === 'stock' ? `${x.id} · ${SECTORS[x.sector]}` : x.cls === 'cmd' ? `${CSECT[x.sector]} · je ${x.unit}` : x.cls === 'bond' ? `${x.rating} · fällig ${fDate(x.mat).slice(3)}` : x.cls === 'fund' ? x.type : x.cls === 'fx' ? 'Devisen' : isEtc(x) ? 'ETC' : x.cls === 'etf' ? 'ETF' : CLS[x.cls];
export const av = x => `<span class="av" aria-hidden="true">${esc(x.cls === 'fx' ? x.base : x.cls === 'stock' ? x.id.slice(0, 2) : initials(x.name))}</span>`;
export function spark(x, w = 72, h = 26) {
  const a = (x.c1.length > 10 ? x.c1.slice(-120) : x.cD.slice(-30)).map(k => k[4]); if (a.length < 2) return '';
  const lo = Math.min(...a), hi = Math.max(...a), r = hi - lo || 1;
  return `<svg class="spark spk" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline fill="none" stroke="var(--${chg(x) >= 0 ? 'up' : 'dn'})" stroke-width="1.5" stroke-linejoin="round" points="${a.map((v, i) => (i / (a.length - 1) * w).toFixed(1) + ',' + (h - 3 - (v - lo) / r * (h - 6)).toFixed(1)).join(' ')}"/></svg>`;
}
export function row(x, o = {}) {
  const c = chg(x), right = o.right || `<b>${fmtPx(x, x.price)}</b><small class="${sc(c)}">${pctS(c)}</small>`;
  return `<button class="r" data-go="i-${x.id}">${av(x)}<span style="min-width:0"><span class="nm" style="display:block">${esc(x.name)}</span><span class="sub" style="display:block">${esc(o.sub || subOf(x))}</span></span>${o.noSpark ? '<span></span>' : spark(x)}<span class="val">${right}</span></button>`;
}
// „Warum bewegt sich der Kurs?“ – Grund von heute oder Einordnung gegenüber Markt und Branche
export function whyText(x) {
  const c = chg(x), today = dayStart(E.M.t);
  if (x.why && x.why.t >= today - (E.M.isOpen ? 0 : 3 * DAY) && Math.abs(c) > 0.002) return x.why.txt;
  const ix = E.M.inst.WELTIX, mc = chg(ix);
  if (Math.abs(c) < 0.003) return 'Kaum bewegt heute.';
  if (x.cls === 'stock') {
    const peers = E.byCls('stock').filter(y => y.sector === x.sector && y.id !== x.id), pc = peers.length ? peers.reduce((s, y) => s + chg(y), 0) / peers.length : 0;
    if (Math.abs(pc) > 0.008 && Math.sign(pc) === Math.sign(c)) return `${pctS(c, 1)} – die ganze Branche ${SECTORS[x.sector]} bewegt sich (im Schnitt ${pctS(pc, 1)}).`;
    if (Math.sign(mc) === Math.sign(c) && Math.abs(mc) > 0.003) return `${pctS(c, 1)} – im Sog des Gesamtmarkts (WELTIX ${pctS(mc, 1)}, Beta ${fmt(x.beta, 1)}).`;
    return `${pctS(c, 1)} – ohne besondere Nachricht, normale Schwankung.`;
  }
  if (x.cls === 'bond') return `${pctS(c, 2)} – Anleihen bewegen sich mit den Zinsen (Leitzins ${fmt(E.M.lz * 100, 2)} %).`;
  if (x.cls === 'fx') return `${pctS(c, 2)} – Devisen schwanken mit Zinsunterschieden und Nachrichten.`;
  return `${pctS(c, 1)} heute.`;
}
export const CAT = { earn: 'Quartalszahlen', macro: 'Makro & Zentralbank', sector: 'Sektoren', company: 'Unternehmen', rumor: 'Gerücht' };
export function newsItem(n) {
  const ids = (n.ids || (n.id ? [n.id] : [])).filter(id => E.M.inst[id]);
  const d = dayStart(n.t) === dayStart(E.M.t) ? fTime(n.t) : fDate(n.t).slice(0, 6) + ' ' + fTime(n.t);
  const eff = n.eff !== null && n.eff !== undefined && isFinite(n.eff) && Math.abs(n.eff) >= 0.001 ? `<span class="eff ${sc(n.eff)}">${pctS(n.eff, 1)}</span>` : '';
  return `<article class="news"><div class="meta"><span>${d}</span><span>·</span><span>${CAT[n.cat] || 'Unternehmen'}</span>${n.rumor ? `<span class="rumor">Gerücht · unbestätigt</span>${info('rumor')}` : ''}</div>
    <h3>${esc(n.txt)}</h3>${n.sub ? `<p>${esc(n.sub)}</p>` : ''}
    ${ids.length || eff ? `<div class="tags">${ids.map(id => `<button class="tag" data-go="i-${id}">${esc(E.M.inst[id].cls === 'fx' ? E.M.inst[id].name : id)}</button>`).join('')}${eff}</div>` : ''}</article>`;
}
export const holdingIds = A => { const s = new Set(Object.keys(A.pos)); for (const p of A.derivs) s.add(p.und); for (const o of A.orders) if (E.isOpen(o)) s.add(o.iid); return s; };
// Termine: Quartalszahlen, Zinsentscheid, Inflationsdaten, Sektor-Termine, Fälligkeiten
export function upcoming(days = 21, onlyMine = false) {
  const M = E.M, A = S.A, now = M.t, until = now + days * DAY, out = [], mine = holdingIds(A);
  for (const x of E.byCls('stock')) if (x.fin && x.fin.next && x.fin.next >= dayStart(now) && x.fin.next <= until && (!onlyMine || mine.has(x.id))) {
    const epsE = x.fin.eps >= 0 ? x.fin.eps * (1 + x.fin.g / 4 * 0.9) : x.fin.eps * 0.96, h = S.ins.hints.find(h => h.id === x.id);
    out.push({ t: x.fin.next + 8 * 60 * 60000, kind: 'Zahlen', id: x.id, txt: `${x.name} legt Quartalszahlen vor`, sub: `Erwartet: Gewinn je Aktie ${fmt(epsE, 2)} €` + (h ? ` · ${h.src}: ${h.dir > 0 ? 'eher besser' : h.dir < 0 ? 'eher schlechter' : 'im Rahmen'}` : ''), mine: mine.has(x.id), sector: x.sector });
  }
  if (M.cb && M.cb.next <= until) { const p = M.cb.p || {}, k = p.up >= p.hold && p.up >= p.down ? 'Erhöhung' : p.down >= p.hold ? 'Senkung' : 'keine Änderung'; out.push({ t: M.cb.next, kind: 'Zentralbank', txt: `Zinsentscheid (aktuell ${fmt(M.lz * 100, 2)} %)`, sub: `Markt erwartet ${k} (${Math.round(Math.max(p.up || 0, p.hold || 0, p.down || 0) * 100)} %)`, mine: true }); }
  if (M.cpi && M.cpi.next <= until) out.push({ t: M.cpi.next, kind: 'Inflation', txt: 'Inflationsdaten', sub: `Erwartet: ${fmt(M.cpi.exp, 1)} % (zuletzt ${fmt(M.infl, 1)} %)`, mine: true });
  for (const ev of M.events || []) if (!ev.done && ev.t <= until) out.push({ t: ev.t, kind: 'Sektor', txt: ev.title, sub: `Betrifft ${SECTORS[ev.sector]}`, mine: E.byCls('stock').some(x => x.sector === ev.sector && mine.has(x.id)) });
  for (const d of A.deps || []) if (d.end <= until) out.push({ t: d.end, kind: 'Festgeld', txt: `Festgeld über ${E.fmtE(d.amt)} wird fällig`, sub: '', mine: true });
  out.sort((a, b) => a.t - b.t);
  return onlyMine ? out.filter(e => e.mine) : out;
}
export function phaseLine() { const r = E.M.reg; if (!r) return ''; return `${REGIMES[r.k].name}`; }
