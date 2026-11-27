// Makro-Dashboard: Konjunktur, Inflation, Zinsen, Zölle, Politik – und was das für dein Geld bedeutet
import { S, E, esc, sc, pctS, $ } from '../store.js';
import { info } from '../glossary.js';
const { fmt, fmtE, fDate, fTime, chg, REGIMES, SECTORS, SECTOR_SENS, tariffList, NEUTRAL, taylor } = E;

// Verlauf als kleine Linie (Spalte k aus M.mac.h)
function line(k, w = 220, h = 34) {
  const a = (E.M.mac && E.M.mac.h || []).slice(-120).map(r => r[k]).filter(v => isFinite(v)); if (a.length < 2) return '';
  const lo = Math.min(...a), hi = Math.max(...a), r = hi - lo || 1;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="var(--fg2)" stroke-width="1.5" stroke-linejoin="round" points="${a.map((v, i) => (i / (a.length - 1) * w).toFixed(1) + ',' + (h - 3 - (v - lo) / r * (h - 6)).toFixed(1)).join(' ')}"/></svg>`;
}
const ago = (k, n = 20) => { const h = (E.M.mac && E.M.mac.h) || []; return h.length > n ? h[h.length - 1 - n][k] : null; };
const dlt = (v, k, d = 1, unit = '') => { const o = ago(k); if (o === null || !isFinite(v)) return ''; const x = v - o; return `<span class="small fg2">${x > 0 ? '+' : x < 0 ? '−' : '±'}${fmt(Math.abs(x), d)}${unit} in 4 Wochen</span>`; };
export const phaseTone = k => k === 'bull' || k === 'recov' ? 'ok' : k === 'rec' ? 'crit' : k === 'infl' || k === 'hike' ? 'warn' : 'n';

export function render() {
  return `<div class="grid2"><div class="stack" style="gap:20px">
    <div><h1 class="h1">Makro</h1><p class="lead" style="margin:6px 0 0">Wie es der Wirtschaft geht – und was das für dein Geld bedeutet.</p></div>
    <div id="mc-phase"></div>
    <div class="mgrid" id="mc-grid"></div>
    <section class="sec"><h2>Zentralbank ${info('leitzins')}</h2><div class="lines" id="mc-cb"></div></section>
    <section class="sec"><h2>Zölle & Handel ${info('tariff')}</h2><div id="mc-tar"></div></section>
    <section class="sec"><h2>Politik: Was ansteht ${info('polprob')}</h2><div id="mc-pol"></div></section>
  </div><aside class="stack">
    <section class="sec" style="border-top:0;padding-top:0"><h2>Was bedeutet das für mein Geld?</h2><div id="mc-me"></div></section>
    <section class="sec"><h2>Rückenwind & Gegenwind</h2><div id="mc-sec"></div></section>
    <section class="sec"><h2>Devisen</h2><div class="lines" id="mc-fx"></div></section>
  </aside></div>`;
}
export function update() {
  const M = E.M, m = M.mac; if (!m) { $('#mc-grid').innerHTML = '<p class="empty">Noch keine Makrodaten.</p>'; return; }
  const R = REGIMES[M.reg.k], lz = M.lz, infl = M.infl, tl = taylor();
  $('#mc-phase').innerHTML = `<div class="setting" style="border:0;padding:0"><div class="t"><b>Marktphase <span class="pill ${phaseTone(M.reg.k)}">${esc(R.name)}</span> ${info('phase')}</b><small>${esc(R.desc)}</small></div></div>`;
  const tile = (label, k, val, sub, spark) => `<div><span class="label">${label} ${info(k)}</span><b class="v">${val}</b>${sub || ''}${spark || ''}</div>`;
  $('#mc-grid').innerHTML = [
    tile('Inflation (VPI)', 'vpi', fmt(infl, 1) + ' %', dlt(infl, 4, 1, ' Pp'), line(4)),
    tile('Inflationstrend', 'infltrend', fmt(m.inflT, 1) + ' %', `<span class="small fg2">${m.inflT > infl + 0.3 ? 'Preisdruck nimmt zu' : m.inflT < infl - 0.3 ? 'Preisdruck lässt nach' : 'stabil'}</span>`, line(7)),
    tile('Leitzins', 'leitzins', fmt(lz * 100, 2) + ' %', `<span class="small fg2">Taylor-Regel ${fmt(tl * 100, 2)} % ${info('taylor')}</span>`, line(5)),
    tile('BIP-Wachstum', 'gdp', fmt(m.gdp, 1) + ' %', dlt(m.gdp, 1, 1, ' Pp'), line(1)),
    tile('Arbeitslosigkeit', 'unemp', fmt(m.unemp, 1) + ' %', dlt(m.unemp, 2, 1, ' Pp'), line(2)),
    tile('Konsumklima', 'conf', fmt(m.conf, 1), dlt(m.conf, 3, 1), line(3)),
    tile('Ölpreis (Brent)', 'vpi', fmt(M.inst.BRNT.price, 2) + ' $', `<span class="small fg2">${m.energy > 0.05 ? 'über dem Schnitt – treibt die Inflation' : m.energy < -0.05 ? 'unter dem Schnitt – dämpft die Inflation' : 'im üblichen Rahmen'}</span>`),
    tile('Zölle auf EU-Importe', 'tariff', fmt(m.tarImp, 1) + ' %', `<span class="small fg2">Exportbelastung ${fmt(m.tarDrag, 1)} %</span>`, line(6)),
    tile('Staatsschulden', 'debtgdp', fmt(m.debt, 1) + ' % des BIP', `<span class="small fg2">Geldmenge ${fmt(m.m2, 1)} % p. a. ${info('m2')}</span>`)
  ].join('');
  const p = M.cb.p || { up: 0, hold: 1, down: 0 };
  $('#mc-cb').innerHTML = `<div><span>Nächster Zinsentscheid</span><b>${fDate(M.cb.next, true)}, ${fTime(M.cb.next)}</b></div>
    <div><span>Markt erwartet</span><b>Erhöhung ${Math.round(p.up * 100)} % · gleich ${Math.round(p.hold * 100)} % · Senkung ${Math.round(p.down * 100)} %</b></div>
    <div><span>Nächste Inflationsdaten</span><b>${fDate(M.cpi.next, true)} · erwartet ${fmt(M.cpi.exp, 1)} %</b></div>
    ${M.cb.last ? `<div><span>Letzte Entscheidung</span><b>${M.cb.last.d > 0 ? 'Erhöhung' : M.cb.last.d < 0 ? 'Senkung' : 'unverändert'} am ${fDate(M.cb.last.t)}</b></div>` : ''}`;
  const tl2 = tariffList();
  $('#mc-tar').innerHTML = `<div class="lines">${tl2.map(t => `<div><span>${esc(t.label)}</span><b class="${t.rate > 0 ? 'amb' : ''}">${t.rate > 0 ? fmt(t.rate, 0) + ' %' : 'kein Zoll'}</b></div>`).join('')}<div><span>Unternehmenssteuer</span><b>${fmt(M.pol ? M.pol.tax : 30, 0)} %</b></div></div>
    <p class="note" style="margin-top:8px">Zölle belasten Exporteure (Autos, Chemie, Luxus) und Firmen mit Lieferketten in Fernost. Heimische Anbieter gewinnen Marktanteile, die Inflation steigt. Die Wirkung auf die Gewinne zeigt sich in den nächsten Quartalszahlen.</p>`;
  const pend = (M.events || []).filter(e => e.kind === 'policy' && !e.done).sort((a, b) => a.t - b.t), log = (M.pol && M.pol.log) || [];
  $('#mc-pol').innerHTML = (pend.length ? pend.map(e => `<div class="cal-item"><span class="k">${fDate(e.t, true).slice(0, 9)}</span><span style="flex:1;min-width:0"><b style="font-weight:500">${esc(e.title)}</b><br><span class="stage">${e.stage ? 'Gesetzentwurf liegt vor' : 'bisher nur Gerüchte'} · Markt-Einschätzung ${Math.round(e.p * 100)} %</span>${(e.ids || []).length ? `<br>${e.ids.map(id => M.inst[id] && !M.inst[id].delisted ? `<button class="tag" data-go="i-${id}">${id}</button> ` : '').join('')}` : ''}</span></div>`).join('') : '<p class="empty">Gerade keine politischen Entscheidungen in Sicht.</p>')
    + (log.length ? `<h3 class="sh" style="margin-top:16px">Zuletzt entschieden</h3><div class="lines">${log.slice(0, 6).map(l => `<div><span>${esc(l.title)}</span><b class="small fg2">${fDate(l.t).slice(0, 6)}</b></div>`).join('')}</div>` : '');
  // Persönliche Einordnung
  const A = S.A, T = E.totals(A), cash = Math.max(0, A.cash), real = lz * 100 - infl, loss = cash * infl / 100 - Math.min(cash, E.CASH_RATE_CAP) * Math.max(0, lz);
  const debt = T.lomb, cr = E.creditRate(A);
  $('#mc-me').innerHTML = `<div class="lines">
    <div><span>Realzins auf Guthaben ${info('realrate')}</span><b class="${sc(real)}">${real > 0 ? '+' : real < 0 ? '−' : ''}${fmt(Math.abs(real), 2)} %</b></div>
    <div><span>Kaufkraft deines Guthabens</span><b class="${sc(-loss)}">${loss > 0 ? '−' : '+'}${fmtE(Math.abs(loss), 0)} pro Jahr</b></div>
    ${debt > 0 ? `<div><span>Dein Kreditzins ${info('creditrate')}</span><b>${fmt(cr * 100, 2)} %</b></div>` : ''}</div>
    <p class="note" style="margin-top:8px">${real < 0 ? 'Die Inflation liegt über dem Zins: Wer nur Bargeld hält, verliert real. Sachwerte, Rohstoffe und Unternehmen mit Preissetzungsmacht schützen.' : 'Der Zins liegt über der Inflation: Cash und Festgeld bringen real etwas. Hoch bewertete Wachstumsaktien haben es schwerer.'}</p>`;
  // Branchen: Wer profitiert vom aktuellen Umfeld?
  const comp = k => { const s = SECTOR_SENS[k]; return { gdp: 0.6 * s.cyc * (m.gdp - 1.5), rate: -40 * s.rate * (lz - NEUTRAL.lz), infl: 0.25 * s.infl * (infl - 2.2), conf: (k === 'cons' || k === 'auto') ? 0.08 * (m.conf - NEUTRAL.conf) : 0 }; };
  const all = Object.keys(SECTOR_SENS).map(k => { const c = comp(k); return [k, c.gdp + c.rate + c.infl + c.conf, c]; }), mu = all.reduce((a, r) => a + r[1], 0) / all.length;
  all.sort((a, b) => b[1] - a[1]);
  const TXT = { gdp: [m.gdp > 1.5 ? 'starke Konjunktur' : 'schwache Konjunktur'], rate: [lz > NEUTRAL.lz ? 'hohe Zinsen' : 'niedrige Zinsen'], infl: [infl > 2.2 ? (null) : 'wenig Preisdruck'], conf: [m.conf > NEUTRAL.conf ? 'gute Konsumlaune' : 'schwache Konsumlaune'] };
  const why = (c, sign) => Object.entries(c).filter(([, v]) => Math.sign(v) === sign && Math.abs(v) > 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 2).map(([k]) => k === 'infl' ? (sign > 0 ? 'Preissetzungsmacht bei Inflation' : (infl > 2.2 ? 'Kostendruck durch Inflation' : 'wenig Preisdruck')) : k === 'rate' ? (sign > 0 ? (lz > NEUTRAL.lz ? 'profitiert von hohen Zinsen' : 'niedrige Zinsen helfen') : (lz > NEUTRAL.lz ? 'hohe Zinsen bremsen' : 'niedrige Zinsen drücken die Marge')) : TXT[k][0]).join(', ') || 'kaum betroffen';
  const li = (a, sign) => a.map(([k, v, c]) => `<div><span>${SECTORS[k]}</span><b class="small fg2" style="font-weight:400">${why(c, sign)}</b></div>`).join('');
  $('#mc-sec').innerHTML = `<h3 class="sh"><span class="up">Rückenwind</span></h3><div class="lines">${li(all.slice(0, 3).filter(r => r[1] > mu), 1)}</div>
    <h3 class="sh" style="margin-top:12px"><span class="dn">Gegenwind</span></h3><div class="lines">${li(all.slice(-3).reverse().filter(r => r[1] < mu), -1)}</div>
    <p class="note" style="margin-top:8px">Einschätzung aus Konjunktur, Zinsen und Inflation im Vergleich der Branchen – keine Garantie für einzelne Aktien.</p>`;
  const eu = M.inst.EURUSD, ec = M.inst.EURCHF, diff = (lz - M.fr.USD) * 100;
  $('#mc-fx').innerHTML = `<div><span>EUR/USD</span><b>${fmt(eu.price, 4)} <span class="${sc(chg(eu))}">${pctS(chg(eu))}</span></b></div>
    <div><span>EUR/CHF</span><b>${fmt(ec.price, 4)} <span class="${sc(chg(ec))}">${pctS(chg(ec))}</span></b></div>
    <div><span>Zinsdifferenz Euro – Dollar</span><b>${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff), 2)} Pp</b></div>
    <p class="note" style="margin-top:8px">${diff < -0.5 ? 'Der Dollar bringt mehr Zins – das stützt ihn gegenüber dem Euro.' : diff > 0.5 ? 'Der Euro bringt mehr Zins – das stützt ihn.' : 'Kaum Zinsunterschied.'} Zölle der USA auf EU-Waren schwächen den Euro, in unsicheren Zeiten ist der Franken gefragt.</p>`;
}
