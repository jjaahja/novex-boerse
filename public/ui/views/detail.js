// Detailansicht: Kurs, Begründung, Chart, Handeln, Position, Kennzahlen mit Erklärungen, Quartalszahlen, Nachrichten, Profi-Bereich
import { S, E, esc, sc, pctS, signE, actions, $ } from '../store.js';
import { info } from '../glossary.js';
import { drawChart, drawBars } from '../chart.js';
import { av, subOf, whyText, newsItem, row, CLS, isEtc } from '../parts.js';
import { openOrder } from './order.js';
const { fmt, fmtE, fmtBig, fmtPx, fmtQty, dig, fDate, fTime, chg, dayStart, posValue, SECTORS, STORY, OWNER, ownerLevel, members, bookP, isBook, marginal, maxQ, qAtLimit, unitVal, q2e, bidAsk, rateOf } = E;
const RANGES = [['1T', '1T'], ['1M', '1M'], ['6M', '6M'], ['1J', '1J'], ['Max', 'Max']];

export function render(id) {
  const x = E.I(id), U = S.UI; if (!x) return '<p class="empty">Nicht gefunden.</p>';
  return `<div class="grid2"><div class="stack" style="gap:0">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><button class="x" data-go="${U.back}" aria-label="Zurück">←</button>${av(x)}<div style="min-width:0"><h1 class="h1" style="font-size:22px">${esc(x.name)}</h1><span class="small fg2">${esc(subOf(x))}${x.isin ? ' · ' + x.isin : ''}</span></div></div>
    <section class="hero"><span class="big" id="d-px">–</span><span class="delta" id="d-ch"></span><div class="why" id="d-why"></div></section>
    <div class="chart-wrap"><canvas id="d-chart" class="chart" aria-label="Kursverlauf"></canvas></div>
    <div class="ranges">${RANGES.map(r => `<button data-a="drange" data-v="${r[0]}" class="${U.range === r[0] ? 'on' : ''}">${r[1]}</button>`).join('')}<span class="sp"></span><button data-a="dcandle" class="${U.candle ? 'on' : ''}" aria-pressed="${U.candle}">Kerzen</button></div>
    <div class="btns" style="margin:22px 0 8px" id="d-act">${actionsHTML(x)}</div>
    <div id="d-pos"></div>
    <div id="d-hint"></div>
    <section class="sec" style="margin-top:16px"><h2>Über ${esc(x.cls === 'stock' ? 'das Unternehmen' : x.cls === 'bond' ? 'die Anleihe' : x.cls === 'fx' ? 'das Währungspaar' : x.cls === 'cmd' ? 'den Rohstoff' : 'das Produkt')}</h2>
      ${STORY[x.id] || x.desc ? `<p class="lead" style="margin:0 0 16px">${esc(STORY[x.id] || '')} ${STORY[x.id] ? '' : esc(x.desc || '')}</p>` : ''}<div class="kv" id="d-kv"></div></section>
    ${x.cls === 'stock' ? `<section class="sec"><h2>Quartalszahlen <span class="sp"></span><span class="seg"><button data-a="dearn" data-v="eps" class="${U.earn === 'eps' ? 'on' : ''}">Gewinn je Aktie</button><button data-a="dearn" data-v="rev" class="${U.earn === 'rev' ? 'on' : ''}">Umsatz</button></span></h2><div id="d-earn"></div></section>` : ''}
    ${x.comp ? `<section class="sec"><h2>Größte Bestandteile</h2><div class="rows" id="d-comp"></div></section>` : ''}
  </div><aside class="stack">
    <section class="sec"><h2>Nachrichten</h2><div id="d-news"></div></section>
    ${isBook(x) || x.cls === 'etf' ? `<details class="more"><summary>Für Profis: Orderbuch & Umsätze</summary><div class="stack" style="padding-bottom:16px"><p class="note">Jede Order läuft durch dieses Buch. Große Orders kaufen sich durch mehrere Preisstufen ${info('impact')}</p><div id="d-book"></div><h2 class="sh" style="margin-top:12px">Letzte Umsätze</h2><div id="d-ts"></div></div></details>` : ''}
  </aside></div>`;
}
function actionsHTML(x) {
  const p = S.A.pos[x.id], lever = (x.cls === 'stock' || x.cls === 'index' || x.cls === 'cmd' || x.cls === 'fx') ? `<button class="btn ghost" data-a="dlever" data-v="${x.id}">Mit Hebel handeln</button>` : '';
  if (E.isTradable(x) || x.cls === 'fund') return `<button class="btn" data-a="dbuy" data-v="${x.id}">Kaufen</button>${p ? `<button class="btn ghost" data-a="dsell" data-v="${x.id}">Verkaufen</button>` : ''}${x.cls !== 'bond' ? `<button class="btn ghost" data-a="dplan" data-v="${x.id}">Sparplan</button>` : ''}${x.cls === 'stock' ? lever : ''}`;
  if (x.cls === 'cmd') { const etc = E.byCls('etf').find(e => e.comp.length === 1 && e.comp[0].id === x.id); return (etc ? `<button class="btn" data-go="i-${etc.id}">${esc(x.name)}-ETC kaufen</button>` : `<button class="btn" data-go="i-CMDX">Rohstoff-ETF kaufen</button>`) + lever; }
  if (x.cls === 'index') return `<button class="btn" data-go="i-WLTX">WELTIX-ETF kaufen</button>${lever}`;
  if (x.cls === 'fx') return `<button class="btn" data-a="dfx">Währung tauschen</button>${lever}`;
  return '';
}
function bars(x, range) {
  const today = dayStart(E.M.t);
  if (range === '1T') { const t = x.c1.filter(k => k[0] >= today); return t.length > 5 ? t : x.c1.slice(-840); }
  const d = x.cD.concat(E.M.isOpen ? [[today, x.do, x.hi, x.lo, x.price, x.dv]] : []);
  return range === '1M' ? d.slice(-22) : range === '6M' ? d.slice(-126) : range === '1J' ? d.slice(-252) : d;
}
export function update(id) {
  const x = E.I(id), A = S.A, U = S.UI; if (!x) return;
  const c = chg(x), pxEl = $('#d-px'), old = pxEl.dataset.v ? +pxEl.dataset.v : null;
  pxEl.textContent = fmtPx(x, x.price); pxEl.dataset.v = x.price;
  if (old !== null && old !== x.price) { pxEl.classList.remove('flash-up', 'flash-dn'); void pxEl.offsetWidth; pxEl.classList.add(x.price > old ? 'flash-up' : 'flash-dn'); }
  { const d = x.price - x.pc, abs = x.cls === 'bond' ? fmt(Math.abs(d), 2) + ' Pkt.' : fmtPx(x, Math.abs(d)); $('#d-ch').innerHTML = `<span class="${sc(c)}">${d > 0 ? '+' : d < 0 ? '−' : ''}${abs} (${pctS(c)})</span> <span class="fg2">heute ${info('today')}</span>`; }
  $('#d-why').innerHTML = `<b>Warum?</b><span>${esc(whyText(x))}</span>`;
  drawChart($('#d-chart'), bars(x, U.range), { candle: U.candle, digits: dig(x), daily: U.range !== '1T', ref: U.range === '1T' ? x.pc : undefined, fmtV: v => fmtPx(x, v) });
  // Position
  const p = A.pos[x.id];
  if (p) {
    const v = posValue(x.id, p), g = v - p.cost, share = x.cls === 'stock' ? p.qty / x.shares : 0, lv = ownerLevel(share), next = OWNER.find(o => o.min > share);
    $('#d-pos').innerHTML = `<section class="sec"><h2>Deine Position</h2><div class="figs"><div><span class="label">Wert</span><b>${fmtE(v)}</b></div><div><span class="label">Gesamt</span><b class="${sc(g)}">${signE(g)}</b><span class="small ${sc(g)}">${pctS(p.cost ? g / p.cost : 0)}</span></div><div><span class="label">Menge</span><b>${fmtQty(x, p.qty)}</b></div><div><span class="label">Einstand Ø</span><b>${x.cls === 'bond' ? fmt(p.cost / p.qty * 100, 2) + ' %' : fmtE(p.cost / p.qty)}</b></div></div>
      ${x.cls === 'stock' ? `<p class="note" style="margin-top:10px">${share < 1e-6 ? `Dein Anteil an ${esc(x.name)} liegt unter 0,0001 %` : `Du besitzt ${fmt(share * 100, share < 1e-4 ? 4 : 2)} % von ${esc(x.name)}`}${lv ? ` – <b>${esc(lv.name)}</b>: ${esc(lv.perk)}` : ''}.${next ? ` Ab ${fmt(next.min * 100, 0)} %: ${esc(next.perk)} (${fmtE(next.min * x.shares * x.price, 0)}).` : ''} ${info('owner')}</p>` : ''}</section>`;
  } else $('#d-pos').innerHTML = '';
  const h = S.ins.hints.find(h => h.id === x.id);
  $('#d-hint').innerHTML = h ? `<div class="celebrate" style="margin:16px 0 0"><span class="av">${h.dir > 0 ? '↑' : h.dir < 0 ? '↓' : '→'}</span><span><b>${esc(h.src)}: Die Zahlen am ${fDate(h.date, true).slice(0, 9)} werden ${h.dir > 0 ? 'eher besser' : h.dir < 0 ? 'eher schlechter' : 'eher im Rahmen'} als erwartet ausfallen.</b><br><span class="small fg2">Trefferquote etwa ${fmt(h.acc * 100, 0)} % – keine Garantie.</span></span></div>` : '';
  $('#d-kv').innerHTML = kv(x);
  if (x.cls === 'stock') earnings(x);
  const cp = $('#d-comp'); if (cp) cp.innerHTML = members(x).sort((a, b) => b.w - a.w).slice(0, 8).map(({ m, w }) => row(m, { right: `<b>${fmt(w * 100, 1)} %</b><small class="${sc(chg(m))}">${pctS(chg(m))}</small>`, noSpark: true })).join('');
  const news = E.M.news.filter(n => (n.ids || [n.id]).includes(x.id)).slice(0, 6);
  $('#d-news').innerHTML = news.length ? news.map(newsItem).join('') : '<p class="empty">Zuletzt keine Meldungen.</p>';
  if ($('#d-book') && $('details.more[open]')) { $('#d-book').innerHTML = bookHTML(x); $('#d-ts').innerHTML = tsHTML(x); }
}
function kv(x) {
  const r = (a, b, k) => `<div><span>${a} ${k ? info(k) : ''}</span><b>${b}</b></div>`, cd = x.cD.slice(-252), hi = Math.max(x.hi, ...cd.map(k => k[2])), lo = Math.min(x.lo, ...cd.map(k => k[3]));
  const rets = [], c30 = x.cD.slice(-31); for (let i = 1; i < c30.length; i++) rets.push(Math.log(c30[i][4] / c30[i - 1][4]));
  const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1), hv = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, rets.length - 1) * 252);
  const range = r('52 Wochen', `${fmt(lo, dig(x))} – ${fmt(hi, dig(x))}`, 'hilo');
  if (x.cls === 'stock') return r('Marktkapitalisierung', fmtBig(x.shares * x.price) + ' €', 'mcap') + r('KGV', x.eps > 0 ? fmt(x.price / x.eps, 1) : 'Verlust', 'kgv') + r('Gewinn je Aktie (12 M.)', fmtE(x.eps), 'eps') + r('Dividendenrendite', fmt(x.dy * 100, 2) + ' %', 'divy') + r('Beta', fmt(x.beta, 2), 'beta') + r('Volatilität', fmt(hv * 100, 0) + ' %', 'vola') + range + r('Branche', SECTORS[x.sector]) + r('Spread', fmt(bookP(x).s * 2e4, 1) + ' Bp', 'spread');
  if (x.cls === 'etf') return r('Inventarwert', fmtE(x.nav), 'nav') + r('Abweichung zum NAV', pctS(x.prem, 2), 'nav') + r('Laufende Kosten', fmt(x.ter * 100, 2) + ' % p. a.', 'ter') + r('Volatilität', fmt(hv * 100, 0) + ' %', 'vola') + range + r('Art', isEtc(x) ? 'ETC, physisch hinterlegt' : 'ETF, thesaurierend');
  if (x.cls === 'fund') return r('Inventarwert', fmtE(x.nav), 'nav') + r('Ausgabepreis', fmtE(x.nav * (1 + x.aa)), 'aa') + r('Ausgabeaufschlag', fmt(x.aa * 100, 2) + ' %', 'aa') + r('Laufende Kosten', fmt(x.ter * 100, 2) + ' % p. a.', 'ter') + r('Volatilität', fmt(hv * 100, 0) + ' %', 'vola') + range;
  if (x.cls === 'bond') return r('Rendite', x.matured ? '–' : fmt(x.ytm * 100, 2) + ' %', 'ytm') + r('Kupon', fmt(x.cpn, 3) + ' % p. a.', 'coupon') + r('Fälligkeit', fDate(x.mat)) + r('Duration', fmt(x.mdur, 1), 'duration') + r('Stückzinsen', fmt(x.acc, 3) + ' %', 'accrued') + r('Rating', x.rating, 'rating') + r('Nächster Kupon', x.matured || !(x.cpn > 0) ? '–' : fDate(x.cds[x.ci])) + r('Emittent', esc(x.issuer));
  if (x.cls === 'cmd') return r('Kurs in Euro', fmtE(x.price * q2e(x)), null) + r('Einheit', x.unit) + r('Beta zum Aktienmarkt', fmt(x.beta, 2), 'beta') + r('Volatilität', fmt(hv * 100, 0) + ' %', 'vola') + range + r('Spread', fmt(bookP(x).s * 2e4, 1) + ' Bp', 'spread');
  if (x.cls === 'fx') { const [b, a] = bidAsk(x); return r('Geld / Brief', `${fmt(b, x.dec)} / ${fmt(a, x.dec)}`, 'spread') + r(`Zins ${x.base}`, fmt(rateOf(x.base) * 100, 2) + ' %', 'leitzins') + r(`Zins ${x.quote}`, fmt(rateOf(x.quote) * 100, 2) + ' %') + r('Volatilität', fmt(hv * 100, 1) + ' %', 'vola') + range; }
  return r('Bestandteile', x.comp.length) + r('Volatilität', fmt(hv * 100, 0) + ' %', 'vola') + range;
}
function earnings(x) {
  const f = x.fin, box = $('#d-earn'); if (!f || !box) return;
  const isEps = S.UI.earn === 'eps', hist = f.hist.slice(-8), last = hist[hist.length - 1];
  const epsE = f.eps >= 0 ? f.eps * (1 + f.g / 4 * 0.9) : f.eps * 0.96;
  box.innerHTML = `<div class="lines" style="margin-bottom:10px"><div><span>Nächste Zahlen</span><b>${fDate(f.next, true)}, vor Börsenbeginn</b></div><div><span>Erwartung Gewinn je Aktie ${info('consensus')}</span><b>${fmtE(epsE)}</b></div></div>
    <canvas class="bars" id="d-bars" aria-label="Quartalszahlen: Erwartung gegen Ergebnis"></canvas>
    <p class="note" style="margin:6px 0 14px">Umriss = Erwartung der Analysten, gefüllt = Ergebnis (grün übertroffen, rot verfehlt).</p>
    ${last ? `<div class="lines"><div><span>Zuletzt (${esc(last.q)})</span><b class="${last.verdict === 'beat' ? 'up' : last.verdict === 'miss' ? 'dn' : ''}">${{ beat: 'Erwartungen übertroffen', miss: 'Erwartungen verfehlt', inline: 'Im Rahmen der Erwartungen' }[last.verdict]}</b></div>
    <div><span>Gewinn je Aktie ${info('eps')}</span><b>${fmtE(last.eps)} <span class="fg2">statt ${fmtE(last.epsE)}</span></b></div>
    <div><span>Umsatz ${info('rev')}</span><b>${fmtBig(last.rev)} € <span class="fg2">statt ${fmtBig(last.revE)} €</span></b></div>
    <div><span>Operative Marge ${info('margin')}</span><b>${fmt(last.margin * 100, 1)} %</b></div>
    <div><span>Ausblick ${info('guidance')}</span><b>${{ up: 'angehoben', keep: 'bestätigt', down: 'gesenkt' }[last.guid]}</b></div>
    ${last.move ? `<div><span>Kursreaktion</span><b class="${sc(last.move)}">${pctS(last.move, 1)}</b></div>` : ''}</div>
    <p class="lead" style="margin-top:10px">${esc(last.sum)}</p>` : ''}`;
  drawBars($('#d-bars'), hist.map(h => ({ label: h.q.replace(' 20', " '"), a: isEps ? h.epsE : h.revE / 1e9, b: isEps ? h.eps : h.rev / 1e9, good: (isEps ? h.eps >= h.epsE : h.rev >= h.revE) })), { fmt: v => isEps ? fmt(v, 2) : fmt(v, 1) });
}
function bookHTML(x) {
  if (x.matured) return '<p class="empty">Anleihe getilgt.</p>';
  const mid = x.price, uv = unitVal(x), d = dig(x), L = 7, tick = x.cls === 'fx' ? x.pip / 10 : x.cls === 'bond' ? 0.001 : mid < 10 ? 0.001 : 0.01;
  const ask0 = mid * marginal(x, 1, 0), bid0 = mid * marginal(x, -1, 0), qref = Math.min(maxQ(x), (isBook(x) ? bookP(x).D : x.adv) * 0.004);
  let stp = Math.max(tick, (mid * marginal(x, 1, qref) - ask0) / L); stp = Math.ceil(stp / tick) * tick;
  const rows = []; let pa = 0, pb = 0; const a0 = Math.ceil(ask0 / tick - 1e-9) * tick, b0 = Math.floor(bid0 / tick + 1e-9) * tick, asks = [], bids = [];
  for (let i = 0; i < L; i++) { const pA = a0 + i * stp, pB = b0 - i * stp, qa = qAtLimit(x, 1, pA), qb = pB > 0 ? qAtLimit(x, -1, pB) : pb; asks.push([pA, Math.max(0, qa - pa)]); bids.push([pB, Math.max(0, qb - pb)]); pa = qa; pb = qb; }
  const mx = Math.max(...asks.map(a => a[1]), ...bids.map(a => a[1]), 1e-9), eur = q => fmtBig(q) + ' €';
  const r = (p, q, cls) => `<tr><td class="${cls}">${fmt(p, d)}</td><td><span style="display:inline-block;height:6px;border-radius:3px;background:var(--${cls === 'up' ? 'upbg' : 'dnbg'});width:${(q / mx * 80).toFixed(0)}px;vertical-align:middle;margin-right:8px"></span>${eur(q)}</td></tr>`;
  return `<div class="tbl"><table><thead><tr><th>Kurs</th><th>Volumen</th></tr></thead><tbody>${asks.slice().reverse().map(a => r(a[0], a[1], 'dn')).join('')}<tr><td colspan="2" class="fg2" style="text-align:center">Spread ${fmt((ask0 - bid0) / mid * 1e4, 1)} Bp</td></tr>${bids.map(b => r(b[0], b[1], 'up')).join('')}</tbody></table></div>`;
}
function tsHTML(x) { return x.ts.length ? `<div class="tbl"><table><tbody>${x.ts.slice(0, 8).map(t => `<tr><td class="fg2">${fTime(t[0])}</td><td class="${t[3] > 0 ? 'up' : 'dn'}">${fmt(t[1], dig(x))}</td><td>${fmtBig(t[2])}${t[4] ? ' · Spieler' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Noch keine Umsätze.</p>'; }

actions.drange = el => { S.UI.range = el.dataset.v; el.parentElement.querySelectorAll('[data-a="drange"]').forEach(b => b.classList.toggle('on', b === el)); S.redraw(); };
actions.dcandle = el => { S.UI.candle = !S.UI.candle; el.classList.toggle('on', S.UI.candle); el.setAttribute('aria-pressed', S.UI.candle); S.redraw(); };
actions.dearn = el => { S.UI.earn = el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); S.redraw(); };
actions.dbuy = el => openOrder(el.dataset.v, 'buy');
actions.dsell = el => openOrder(el.dataset.v, 'sell');
actions.dlever = el => { S.UI.dv.und = el.dataset.v; S.UI.mkt = 'lever'; S.go('markt'); };
actions.dplan = el => { S.UI.acct = 'plans'; S.planPre = el.dataset.v; S.go('konto'); };
actions.dfx = () => { S.UI.acct = 'fx'; S.go('konto'); };
