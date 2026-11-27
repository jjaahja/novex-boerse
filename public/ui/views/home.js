// Übersicht: Vermögen, Verlauf, Depot, Termine, Analyse
import { S, E, esc, sc, pctS, signE, actions, $ } from '../store.js';
import { info } from '../glossary.js';
import { drawChart } from '../chart.js';
import { row, upcoming, av } from '../parts.js';
import { phaseTone } from './macro.js';
const { fmt, fmtE, fmtQty, fmtPx, fDate, fTime, dayStart, DAY, chg, totals, unitNav, posValue, derivValue, derivName, REGIMES, TIERS } = E;

const ALLOC_SHADE = [100, 72, 50, 34, 22, 14, 9];
export const allocBar = list => `<div class="alloc" role="img" aria-label="Aufteilung">${list.map((a, i) => `<i style="flex:${Math.max(a.w, 0.004)};background:color-mix(in srgb, var(--fg) ${ALLOC_SHADE[Math.min(i, 6)]}%, var(--bg))"></i>`).join('')}</div>
  <div class="legend">${list.map((a, i) => `<div><i style="background:color-mix(in srgb, var(--fg) ${ALLOC_SHADE[Math.min(i, 6)]}%, var(--bg))"></i>${esc(a.label)}<b>${fmt(a.w * 100, 0)} %</b></div>`).join('')}</div>`;

// Tagesveränderung zeitgewichtet (Ein-/Auszahlungen und Prämien zählen nicht als Gewinn)
export function todayDelta(A) {
  const T = totals(A).total, navNow = unitNav(A, T), d0 = dayStart(E.M.t);
  let ref = null; for (const e of A.eq) { if (e[0] < d0 && e[2]) ref = e[2]; else if (ref === null && e[2]) { ref = e[2]; break; } else break; }
  if (!(ref > 0)) return { abs: 0, rel: 0 };
  const rel = navNow / ref - 1; return { abs: T - T / (1 + rel), rel };
}
function eqSeries(range) {
  const A = S.A, T = totals(A).total, pts = A.eq.map(e => [e[0], e[1], e[2] || null, e[3] || null]).concat([[E.M.t, T, unitNav(A, T), E.M.inst.WELTIX.price]]);
  const now = E.M.t, from = range === '1T' ? dayStart(now) : range === '1W' ? now - 7 * DAY : range === '1M' ? now - 30 * DAY : 0;
  let s = pts.filter(p => p[0] >= from); if (s.length < 2) s = pts.slice(-Math.min(pts.length, 60));
  return s;
}
export function render() {
  const U = S.UI;
  return `<div class="grid2"><div class="stack">
    <div id="h-mc"></div><div id="h-cele"></div>
    <section class="hero" aria-live="polite">
      <span class="label">Nettovermögen ${info('networth')}</span>
      <span class="big" id="h-total">–</span>
      <span class="delta" id="h-delta"></span>
    </section>
    <div class="chart-wrap"><canvas id="pchart" class="chart" aria-label="Verlauf deines Vermögens"></canvas></div><p class="note" id="h-empty" hidden>Dein Verlauf startet gerade – der Chart füllt sich mit jedem Handelstag.</p>
    <div class="ranges">${['1T', '1W', '1M', 'Max'].map(r => `<button data-a="prange" data-v="${r}" class="${U.pRange === r ? 'on' : ''}">${r}</button>`).join('')}<span class="sp"></span><button data-a="cmp" class="${U.cmp ? 'on' : ''}" aria-pressed="${U.cmp}">Mit WELTIX vergleichen</button>${info('bench')}</div>
    <div class="figs" id="h-figs" style="margin-top:18px"></div>
    <section class="sec" style="margin-top:8px"><h2>Depot <span class="sp"></span></h2><div class="rows" id="h-pos"></div></section>
    <section class="sec" id="h-der-sec" hidden><h2>Hebelprodukte ${info('lever')}</h2><div class="rows" id="h-der"></div></section>
  </div>
  <aside class="stack">
    <section class="sec" id="h-bonus" hidden></section>
    <section class="sec"><h2>Demnächst</h2><div id="h-up"></div></section>
    <section class="sec"><h2>Dein Depot unter der Lupe ${info('divers')}</h2><div id="h-an"></div></section>
    <section class="sec"><h2>Markt heute</h2><div id="h-mkt"></div></section>
  </aside></div>`;
}
export function update() {
  const A = S.A, M = E.M, T = totals(A), U = S.UI;
  const cel = S.celebrate && Date.now() - S.celebrate.t < 60000 ? S.celebrate : null;
  $('#h-cele').innerHTML = cel ? `<div class="celebrate"><span class="av" style="background:var(--upbg);color:var(--up)">${cel.tone === 'tier' ? '↑' : '★'}</span><span><b>${esc(cel.msg)}</b><br><span class="small fg2">${cel.tone === 'tier' ? 'Schau unter Fortschritt, was neu freigeschaltet ist.' : 'Dein Portfolio war noch nie so viel wert.'}</span></span></div>` : '';
  $('#h-total').textContent = fmtE(T.total);
  const ci = E.creditInfo(A);
  $('#h-mc').innerHTML = A.mc ? `<div class="alert" role="alert" style="margin-bottom:16px"><div class="t"><b>Margin Call – noch ${fmt(Math.max(0, A.mc.left) / 60, 1)} Handelsstunden</b>Dein Kredit liegt ${fmtE(A.mc.need)} über dem Beleihungswert. Verkaufe Positionen oder tilge, sonst verkauft die Bank.</div><button class="btn sm" data-a="gocredit">Zum Kredit-Monitor</button></div>`
    : ci.status === 'warn' || ci.status === 'critical' ? `<div class="alert amb" style="margin-bottom:16px"><div class="t"><b>Kredit zu ${fmt(ci.use * 100, 0)} % ausgelastet</b>Ein Kursrückgang von ${fmt(ci.buffer * 100, 1)} % löst einen Margin Call aus.</div></div>` : '';
  const td = todayDelta(A), nav = unitNav(A, T);
  $('#h-delta').innerHTML = `<span class="${sc(td.abs)}">${signE(td.abs)} (${pctS(td.rel)})</span> <span class="fg2">heute ${info('today')}</span> &nbsp;·&nbsp; <span class="${sc(nav / 100 - 1)}">${pctS(nav / 100 - 1)}</span> <span class="fg2">seit Start ${info('twr')}</span>`;
  const s = eqSeries(U.pRange);
  $('#h-empty').hidden = s.length >= 4;
  if (U.cmp) drawChart($('#pchart'), s.map(p => [p[0], p[2] || p[1], 0, 0, p[2] || p[1]]), { cmp: s.filter(p => p[3]).map(p => [p[0], p[3]]), pct: true, daily: U.pRange === 'Max' || U.pRange === '1M' });
  else drawChart($('#pchart'), s.map(p => [p[0], p[1], p[1], p[1], p[1]]), { digits: 2, daily: U.pRange === 'Max' || U.pRange === '1M', fmtV: v => fmtE(v) });
  $('#h-figs').innerHTML = `<div><span class="label">Depot ${info('invested')}</span><b>${fmtE(T.invested)}</b><span class="small fg2">Aktien, ETFs, Anleihen, Hebel</span></div>
    <div><span class="label">Verrechnungskonto ${info('cash')}</span><b class="${T.cash < 0 ? 'dn' : ''}">${fmtE(T.cash)}</b><span class="small fg2">${T.cash < 0 ? 'Wertpapierkredit genutzt' : `+ ${fmtE(T.dep + T.fxv, 0)} Festgeld & Währung`}</span></div>
    ${T.pe > 0 || A.pe.length ? `<div><span class="label">Beteiligungen ${info('evmult')}</span><b>${fmtE(T.pe, 0)}</b><span class="small fg2">${A.pe.length} eigene${A.pe.length === 1 ? 's Unternehmen' : ' Unternehmen'}</span></div>` : ''}
    ${T.debt > 0 ? `<div><span class="label">Kredite ${info('credit')}</span><b class="dn">−${fmtE(T.debt, 0)}</b><span class="small fg2">${T.loans > 0 ? 'inkl. Unternehmenskredit' : 'Wertpapierkredit'}</span></div>` : `<div><span class="label">Stufe ${info('tier')}</span><b>${esc(TIERS[A.tier || 0].name)}</b></div>`}`;
  const ids = Object.keys(A.pos).sort((a, b) => posValue(b, A.pos[b]) - posValue(a, A.pos[a]));
  $('#h-pos').innerHTML = ids.length ? ids.map(id => {
    const x = E.I(id), p = A.pos[id], v = posValue(id, p), g = v - p.cost;
    return row(x, { sub: `${fmtQty(x, p.qty)} · ${fmt(chg(x) * 100, 2).replace(/^(?!-)/, '+')} % heute`, right: `<b>${fmtE(v)}</b><small class="${sc(g)}">${signE(g)} (${pctS(p.cost ? g / p.cost : 0)})</small>` });
  }).join('') : `<p class="empty">Noch keine Wertpapiere. Unter <button class="link" data-go="markt">Markt</button> findest du Aktien, ETFs und mehr – ein Sparplan auf den WELTIX-ETF ist ein guter Start.</p>`;
  $('#h-der-sec').hidden = !A.derivs.length;
  $('#h-der').innerHTML = A.derivs.map(p => { const u = E.I(p.und), v = derivValue(p), g = v - p.cost; return `<button class="r" data-go="hebel">${av(u)}<span style="min-width:0"><span class="nm" style="display:block">${esc(derivName(p))}</span><span class="sub" style="display:block">Einsatz ${fmtE(p.cost)}</span></span><span></span><span class="val"><b>${fmtE(v)}</b><small class="${sc(g)}">${pctS(p.cost ? g / p.cost : 0)}</small></span></button>`; }).join('');
  // Tagesbonus
  const claim = A.bonus.day !== dayStart(S.berlin());
  $('#h-bonus').hidden = !claim;
  if (claim) { const b = S.BANK, streak = A.bonus.day === dayStart(S.berlin()) - DAY ? A.bonus.streak + 1 : 1, amt = Math.min(b.reserve, b.bonusBase * (1 + 0.15 * (Math.min(streak, 7) - 1))); $('#h-bonus').innerHTML = `<h2>Tagesbonus</h2><div class="setting" style="border:0;padding:0"><div class="t"><b>+${fmtE(amt)} abholen</b><small>Tag ${streak} deiner Serie – je länger, desto mehr.</small></div><button class="btn sm" data-a="bonus">Abholen</button></div>`; }
  const up = upcoming(14).slice(0, 6);
  $('#h-up').innerHTML = up.length ? up.map(e => `<div class="cal-item" style="padding:8px 0;border-bottom:1px solid var(--line)"><span class="k">${dayStart(e.t) === dayStart(M.t) ? 'Heute ' + fTime(e.t) : fDate(e.t, true).slice(0, 9)}</span><span style="flex:1;min-width:0">${e.id ? `<button class="link" data-go="i-${e.id}">${esc(e.txt)}</button>` : esc(e.txt)}${e.sub ? `<br><span class="small fg2">${esc(e.sub)}</span>` : ''}</span>${e.mine && e.id ? '<span class="tag">im Depot</span>' : ''}</div>`).join('') : '<p class="empty">Keine Termine in den nächsten zwei Wochen.</p>';
  const an = E.analyze(A), adv = (A.tierMax || 0) >= 1;
  $('#h-an').innerHTML = allocBar(an.alloc.slice(0, 7)) + `<div class="lines" style="margin-top:12px">${an.verdicts.map(v => `<div><span style="color:var(--fg)">${esc(v)}</span></div>`).join('')}</div>` +
    (adv ? `<div class="lines"><div><span>Effektive Positionen ${info('divers')}</span><b>${fmt(an.effN, 1)}</b></div><div><span>Beta ${info('beta')}</span><b>${fmt(an.beta, 2)}</b></div><div><span>Erwartete Schwankung ${info('vola')}</span><b>±${fmt(an.vol * 100, 0)} % p. a.</b></div></div>` : `<p class="note" style="margin-top:8px">Beta und Schwankungsrechnung schaltest du als „Aktiver Trader“ frei (ab 25.000 €).</p>`);
  const ix = M.inst.WELTIX, R = REGIMES[M.reg.k];
  $('#h-mkt').innerHTML = `<div class="rows">${row(ix, { sub: 'Leitindex' })}</div><div class="lines" style="margin-top:6px">
    <div><span>Marktphase ${info('phase')}</span><b><span class="pill ${phaseTone(M.reg.k)}">${esc(R.name)}</span></b></div>
    <div><span>Leitzins ${info('leitzins')}</span><b>${fmt(M.lz * 100, 2)} %</b></div>
    <div><span>Inflation ${info('inflation')}</span><b>${fmt(M.infl, 1)} %</b></div>
    ${M.mac ? `<div><span>BIP-Wachstum ${info('gdp')}</span><b>${fmt(M.mac.gdp, 1)} %</b></div>` : ''}
    <div><span>EUR/USD</span><b>${fmt(M.inst.EURUSD.price, 4)} <span class="${sc(chg(M.inst.EURUSD))}">${pctS(chg(M.inst.EURUSD))}</span></b></div></div>
    <p class="note" style="margin-top:8px">${esc(R.desc)}</p>`;
}
actions.gocredit = () => { S.UI.acct = 'credit'; S.go('konto'); };
actions.prange = el => { S.UI.pRange = el.dataset.v; el.parentElement.querySelectorAll('[data-a="prange"]').forEach(b => b.classList.toggle('on', b === el)); update(); };
actions.cmp = el => { S.UI.cmp = !S.UI.cmp; el.classList.toggle('on', S.UI.cmp); el.setAttribute('aria-pressed', S.UI.cmp); update(); };
export function redraw() { update(); }
