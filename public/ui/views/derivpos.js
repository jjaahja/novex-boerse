// Detailansicht einer Hebelposition (Turbo, Faktor, Optionsschein, CFD): Wert, Rendite, Hebel, Knock-out-Abstand
// und ein Chart vom Kaufzeitpunkt bis jetzt – wahlweise als eigener Positionswert oder als Kurs des Basiswerts.
import { S, E, esc, sc, pctS, signE, act, actions, $ } from '../store.js';
import { info } from '../glossary.js';
import { drawChart } from '../chart.js';
import { av, sinceBars, newsItem, whyText } from '../parts.js';
import { autoRow } from './detail.js';
const { fmt, fmtE, fmtPx, fDate, fTime, dig, derivValue, derivLev, derivName, q2e } = E;
const KIND = { ko: 'Turbo-Optionsschein (Knock-out)', fac: 'Faktor-Zertifikat', opt: 'Optionsschein', cfd: 'CFD' };
const TERM = { ko: 'ko', fac: 'fac', opt: 'opt', cfd: 'cfd' };

export const posOf = pid => (S.A.derivs || []).find(p => String(p.pid) === String(pid));
// Kurs des Basiswerts beim Kauf: gespeichert (neue Positionen) oder aus dem Kursverlauf (ältere)
function entryUnd(p, u) {
  if (p.S0 > 0) return p.S0; if (p.entry > 0) return p.entry;
  const find = arr => { let best = null; for (const k of arr || []) if (k[0] <= p.t) best = k; return best ? best[4] : null; };
  return find(u.c1) || find(u.cH) || find(u.cD) || null;
}
// Wert der Position für einen Kurs des Basiswerts (für die Wert-Kurve)
function valueAt(p, u, S) {
  const q = q2e(u);
  if (p.kind === 'ko') return p.n * Math.max(0, Math.max(0, p.dir * (S - p.K)) * p.r * q - E.KO_SPR * S * p.r * q); // wie „Aktueller Wert“ (inkl. Spread)
  if (p.kind === 'cfd') return Math.max(0, p.margin + p.dir * p.units * (S - p.entry) * q - (p.fin || 0));
  return null;
}
function series(p, u, mode) {
  const S0 = entryUnd(p, u), { bars, gran } = sinceBars(u, p.t, S0);
  if (mode === 'und' || p.kind === 'opt') return { bars, gran, S0 };
  if (p.kind === 'fac') { // täglich neu gehebelt: Wert entwickelt sich je Schritt mit Faktor × Kursänderung
    let v = p.cost; const out = bars.map((k, i) => { if (i) v *= Math.max(0.02, 1 + p.F * p.dir * (k[4] / bars[i - 1][4] - 1)); return [k[0], v, v, v, v, 0]; });
    const now = derivValue(p); if (out.length) out[out.length - 1] = [out[out.length - 1][0], now, now, now, now, 0]; // letzter Punkt: tatsächlicher Rücknahmewert
    return { bars: out, gran, S0, val: true };
  }
  const out = bars.map(k => { const v = valueAt(p, u, k[4]); return [k[0], v, v, v, v, 0]; });
  if (out.length) { out[0] = [out[0][0], p.cost, p.cost, p.cost, p.cost, 0]; const now = derivValue(p); out[out.length - 1] = [out[out.length - 1][0], now, now, now, now, 0]; } // Start = Einsatz, Ende = aktueller Wert
  return { bars: out, gran, S0, val: true };
}

export function render(pid) {
  const p = posOf(pid), U = S.UI; if (!p) return `<div class="stack"><button class="x" data-go="${U.back}" aria-label="Zurück">←</button><p class="empty">Diese Hebelposition gibt es nicht mehr – sie wurde geschlossen oder ist ausgeknockt. Details stehen im Geldfluss und unter Orders.</p></div>`;
  const u = E.I(p.und), mode = p.kind === 'opt' ? 'und' : (U.dpMode || 'val');
  return `<div class="grid2"><div class="stack" style="gap:0">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><button class="x" data-go="${U.back}" aria-label="Zurück">←</button>${av(u)}<div style="min-width:0"><h1 class="h1" style="font-size:22px">${esc(derivName(p))}</h1><span class="small fg2">${KIND[p.kind]} ${info(TERM[p.kind])} · auf <button class="link" data-go="i-${u.id}">${esc(u.name)}</button></span></div></div>
    <div id="dp-me"></div>
    <div class="ranges" style="margin:18px 0 6px"><span class="small fg2" id="dp-span"></span><span class="sp"></span>${p.kind !== 'opt' ? `<button data-a="dpmode" data-v="val" class="${mode === 'val' ? 'on' : ''}">Mein Wert</button><button data-a="dpmode" data-v="und" class="${mode === 'und' ? 'on' : ''}">Basiswert</button>` : ''}</div>
    <div class="chart-wrap"><canvas id="dp-chart" class="chart" aria-label="Verlauf seit dem Kauf"></canvas></div>
    <p class="note" id="dp-note" style="margin:6px 0 0"></p>
    <div class="btns" style="margin:20px 0 8px"><button class="btn ghost" data-a="dpclose" data-f="0.5">Hälfte verkaufen</button><button class="btn" data-a="dpclose" data-f="1" id="dp-c1">Ganz schließen</button><button class="btn ghost" data-a="aedit" data-tg="der" data-ref="${p.pid}" data-id="0">Stop-Loss / Take-Profit</button></div>
    <section class="sec"><h2>Absicherung & Auto-Orders ${info('autosl')}</h2><div id="dp-auto"></div></section>
    <section class="sec"><h2>So funktioniert dein Produkt</h2><p class="lead" style="margin:0" id="dp-how"></p></section>
  </div><aside class="stack side-sticky">
    <section class="sec" style="border-top:0;padding-top:0"><h2>Basiswert</h2><div id="dp-und"></div></section>
    <section class="sec"><h2>Nachrichten zum Basiswert</h2><div id="dp-news"></div></section>
  </aside></div>`;
}
export function update(pid) {
  const p = posOf(pid); if (!p) return; const u = E.I(p.und), U = S.UI, A = S.A, mode = p.kind === 'opt' ? 'und' : (U.dpMode || 'val');
  if (S.ensureHist) S.ensureHist(u.id);
  const v = derivValue(p), g = v - p.cost, lev = derivLev(p), S0 = entryUnd(p, u), du = S0 ? u.price / S0 - 1 : null;
  const koDist = p.kind === 'ko' ? p.dir * (u.price - p.K) / u.price : null;
  const mc = p.kind === 'cfd' ? E.cfdEquity(p) / p.margin : null;
  $('#dp-me').innerHTML = `<section class="mypos"><div class="figs">
      <div><span class="label">Aktueller Wert</span><b>${fmtE(v)}</b><span class="small fg2">${p.kind === 'cfd' ? 'Eigenkapital der Position' : fmt(p.n, 0) + ' Stück'}</span></div>
      <div><span class="label">Rendite ${info('unreal')}</span><b class="${sc(g)}">${signE(g)}</b><span class="small ${sc(g)}">${pctS(p.cost ? g / p.cost : 0)}</span></div>
      <div><span class="label">Einsatz</span><b>${fmtE(p.cost)}</b><span class="small fg2">gekauft ${fDate(p.t)} ${fTime(p.t)}</span></div>
      <div><span class="label">Hebel aktuell ${info('lever')}</span><b>${isFinite(lev) && lev > 0 ? fmt(lev, 1) + '×' : '–'}</b><span class="small fg2">${p.dir > 0 ? 'Long – setzt auf steigende Kurse' : 'Short – setzt auf fallende Kurse'}</span></div></div>
    <div class="lines" style="margin-top:8px">
      <div><span>Basiswert beim Kauf → jetzt</span><b>${S0 ? fmtPx(u, S0) + ' → ' : ''}${fmtPx(u, u.price)}${du !== null ? ` <span class="${sc(du * p.dir)}">(${pctS(du, 1)})</span>` : ''}</b></div>
      ${p.kind === 'ko' ? `<div><span>Knock-out-Schwelle ${info('ko')}</span><b>${fmtPx(u, p.K)}</b></div><div><span>Abstand zum Knock-out</span><b class="${koDist < 0.03 ? 'dn' : koDist < 0.08 ? 'amb' : ''}">${pctS(koDist, 1)}${koDist < 0.08 ? ' – knapp' : ''}</b></div>` : ''}
      ${p.kind === 'opt' ? `<div><span>Basispreis</span><b>${fmtPx(u, p.K)}</b></div><div><span>Verfall</span><b>${fDate(p.exp)} · noch ${Math.max(0, Math.ceil((p.exp - E.M.t) / 864e5))} Tage</b></div>` : ''}
      ${p.kind === 'fac' ? `<div><span>Faktor</span><b>${p.F}× täglich angepasst</b></div>` : ''}
      ${p.kind === 'cfd' ? `<div><span>Einstieg</span><b>${fmtPx(u, p.entry)}</b></div><div><span>Sicherheitsleistung (Margin)</span><b>${fmtE(p.margin)} · ${isFinite(mc) ? fmt(mc * 100, 0) + ' % gedeckt' : '–'}</b></div><div><span>Finanzierungskosten bisher</span><b>${fmtE(p.fin || 0)}</b></div>` : ''}
    </div></section>`;
  const s = series(p, u, mode);
  const lines = [];
  if (mode === 'und' || p.kind === 'opt') {
    if (S0) lines.push({ v: S0, label: 'Kauf ' + fmt(S0, dig(u)), tone: 'fg' });
    if (p.kind === 'ko') lines.push({ v: p.K, label: 'KO ' + fmt(p.K, dig(u)), tone: 'dn' });
    if (p.kind === 'opt') lines.push({ v: p.K, label: 'Basis ' + fmt(p.K, dig(u)), tone: 'fg' });
    for (const o of (A.auto || []).filter(o => o.tg === 'der' && String(o.ref) === String(p.pid))) { const t = E.trigOf(o); lines.push({ v: t, label: (o.k === 'tp' ? 'TP ' : o.k === 'tr' ? 'Trailing ' : 'SL ') + fmt(t, dig(u)), tone: o.k === 'tp' ? 'up' : 'dn' }); }
  } else lines.push({ v: p.cost, label: 'Einsatz ' + fmt(p.cost, 2), tone: 'fg' });
  const fmtV = s.val ? (x => fmtE(x)) : (x => fmtPx(u, x));
  drawChart($('#dp-chart'), s.bars, { digits: s.val ? 2 : dig(u), daily: s.gran === 'day', hourly: s.gran === 'hour', ref: s.val ? p.cost : (S0 || (s.bars.length ? s.bars[0][4] : undefined)), fmtV, lines, marks: [{ t: p.t, px: s.bars.length ? s.bars[0][4] : 0, buy: true }] });
  $('#dp-span').textContent = `Seit dem Kauf am ${fDate(p.t)} · ${s.gran === 'min' ? 'Minuten' : s.gran === 'hour' ? 'Stunden' : 'Tage'}`;
  $('#dp-note').textContent = s.val ? (p.kind === 'fac' ? 'Wert näherungsweise aus der täglichen Hebelanpassung berechnet; der letzte Punkt ist der aktuelle Rücknahmewert.' : 'Wert der Position, berechnet aus dem Kurs des Basiswerts (ohne Spread).') : 'Kurs des Basiswerts mit deinem Einstieg' + (p.kind === 'ko' ? ' und der Knock-out-Schwelle.' : '.');
  const list = (A.auto || []).filter(o => o.tg === 'der' && String(o.ref) === String(p.pid));
  $('#dp-auto').innerHTML = list.length ? `<div class="lines">${list.map(o => autoRow(A, o, x => fmtPx(u, x), u.price)).join('')}</div>` : '<p class="note" style="margin:0">Noch keine Absicherung. Stop-Loss und Take-Profit beziehen sich auf den Kurs des Basiswerts.</p>';
  $('#dp-how').textContent = p.kind === 'ko' ? `Du gewinnst ${p.dir > 0 ? 'bei steigenden' : 'bei fallenden'} Kursen von ${u.name} – mit Hebel. Erreicht der Kurs ${fmtPx(u, p.K)}, verfällt der Turbo sofort (Knock-out) und der Einsatz ist weg.`
    : p.kind === 'fac' ? `Jede Tagesbewegung von ${u.name} wirkt ${p.F}-fach ${p.dir > 0 ? '' : 'umgekehrt '}auf deinen Wert. Weil der Hebel täglich neu angepasst wird, kostet Seitwärtsgeschwanke über die Zeit Geld.`
    : p.kind === 'opt' ? `Ein ${p.cp === 'C' ? 'Call' : 'Put'} gewinnt, wenn ${u.name} ${p.cp === 'C' ? 'über' : 'unter'} ${fmtPx(u, p.K)} steht. Mit jedem Tag verliert er an Zeitwert – bis zum Verfall am ${fDate(p.exp)}.`
    : `Ein CFD bildet ${u.name} ${p.lev}-fach ab. Sinkt deine Sicherheit auf 50 %, wird die Position automatisch geschlossen.`;
  $('#dp-und').innerHTML = `<div class="lines"><div><span><button class="link" data-go="i-${u.id}">${esc(u.name)}</button></span><b>${fmtPx(u, u.price)} <span class="${sc(E.chg(u))}">${pctS(E.chg(u))}</span></b></div></div><p class="note" style="margin-top:6px">${esc(whyText(u))}</p>`;
  const news = E.M.news.filter(n => (n.ids || [n.id]).includes(u.id)).slice(0, 5);
  $('#dp-news').innerHTML = news.length ? news.map(newsItem).join('') : '<p class="empty">Zuletzt keine Meldungen.</p>';
  const c1 = $('#dp-c1'); if (c1) c1.textContent = S.confirmClose === p.pid ? 'Wirklich schließen?' : 'Ganz schließen';
}
actions.dpmode = el => { S.UI.dpMode = el.dataset.v; el.parentElement.querySelectorAll('[data-a="dpmode"]').forEach(b => b.classList.toggle('on', b === el)); S.redraw(); };
actions.dpclose = async el => {
  const pid = S.UI.route.slice(2), p = posOf(pid), f = +el.dataset.f; if (!p) return;
  if (f === 1 && S.confirmClose !== p.pid) { S.confirmClose = p.pid; S.redraw(); setTimeout(() => { if (S.confirmClose === p.pid) { S.confirmClose = null; S.redraw(); } }, 4000); return; }
  S.confirmClose = null; el.disabled = true; const r = await act({ type: 'close', pid: p.pid, frac: f }); el.disabled = false;
  if (r.ok && !posOf(pid)) S.go(S.UI.back || 'home');
};
