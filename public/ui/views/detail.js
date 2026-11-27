// Detailansicht: Kurs, Begründung, Chart, Handeln, Position, Kennzahlen mit Erklärungen, Quartalszahlen, Nachrichten, Profi-Bereich
import { S, E, esc, sc, pctS, signE, act, actions, inputs, $ } from '../store.js';
import { info } from '../glossary.js';
import { drawChart, drawBars } from '../chart.js';
import { av, subOf, whyText, newsItem, row, CLS, isEtc } from '../parts.js';
import { openOrder, openReview, openAuto } from './order.js';
const { fmt, fmtE, fmtBig, fmtPx, fmtQty, dig, fDate, fTime, chg, dayStart, posValue, SECTORS, STORY, OWNER, ownerLevel, members, bookP, isBook, marginal, maxQ, qAtLimit, unitVal, q2e, bidAsk, rateOf } = E;
const RANGES = [['1T', '1T'], ['1W', '1W'], ['1M', '1M'], ['1J', '1J'], ['Max', 'Max']];

export function render(id) {
  const x = E.I(id), U = S.UI; if (!x) return '<p class="empty">Nicht gefunden.</p>';
  if (x.delisted) return `<div class="stack"><button class="x" data-go="${U.back}" aria-label="Zurück">←</button><h1 class="h1">${esc(x.name)}</h1><p class="lead">Von der Börse genommen: ${esc(x.delisted.by)} hat das Unternehmen am ${fDate(x.delisted.t)} zu ${fmt(x.delisted.P || x.price, 2)} € je Aktie übernommen.</p>${S.A.pe.some(c => c.id === id) ? '<button class="btn" data-go="firmen">Zu deinem Unternehmen</button>' : ''}</div>`;
  return `<div class="grid2"><div class="stack" style="gap:0">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px"><button class="x" data-go="${U.back}" aria-label="Zurück">←</button>${av(x)}<div style="min-width:0"><h1 class="h1" style="font-size:22px">${esc(x.name)}</h1><span class="small fg2">${esc(subOf(x))}${x.isin ? ' · ' + x.isin : ''}</span></div></div>
    <div id="d-me"></div>
    <section class="hero"><span class="big" id="d-px">–</span><span class="delta" id="d-ch"></span><div class="why" id="d-why"></div></section>
    <div class="chart-wrap"><canvas id="d-chart" class="chart" aria-label="Kursverlauf"></canvas></div>
    <div class="ranges">${RANGES.map(r => `<button data-a="drange" data-v="${r[0]}" class="${U.range === r[0] ? 'on' : ''}">${r[1]}</button>`).join('')}<span class="sp"></span><button data-a="dmarks" id="d-mk" class="${U.marks !== false ? 'on' : ''}" aria-pressed="${U.marks !== false}" hidden>Meine Marker</button><button data-a="dcandle" class="${U.candle ? 'on' : ''}" aria-pressed="${U.candle}">Kerzen</button></div>
    <div class="btns" style="margin:22px 0 8px" id="d-act">${actionsHTML(x)}</div>
    <section class="sec" id="d-auto-sec" hidden><h2>Absicherung & Auto-Orders ${info('autosl')}</h2><div id="d-auto"></div></section>
    <div id="d-hint"></div>
    ${x.cls === 'stock' ? `<section class="sec" id="d-own-sec" style="margin-top:16px"><h2>Beteiligung & Übernahme ${info('owner')}</h2><div id="d-own"></div></section>` : ''}
    <section class="sec" style="margin-top:16px"><h2>Über ${esc(x.cls === 'stock' ? 'das Unternehmen' : x.cls === 'bond' ? 'die Anleihe' : x.cls === 'fx' ? 'das Währungspaar' : x.cls === 'cmd' ? 'den Rohstoff' : 'das Produkt')}</h2>
      ${STORY[x.id] || x.desc ? `<p class="lead" style="margin:0 0 16px">${esc(STORY[x.id] || '')} ${STORY[x.id] ? '' : esc(x.desc || '')}</p>` : ''}<div class="kv" id="d-kv"></div></section>
    ${x.cls === 'stock' ? `<section class="sec"><h2>Quartalszahlen <span class="sp"></span><span class="seg"><button data-a="dearn" data-v="eps" class="${U.earn === 'eps' ? 'on' : ''}">Gewinn je Aktie</button><button data-a="dearn" data-v="rev" class="${U.earn === 'rev' ? 'on' : ''}">Umsatz</button></span></h2><div id="d-earn"></div></section>` : ''}
    ${x.comp ? `<section class="sec"><h2>Größte Bestandteile</h2><div class="rows" id="d-comp"></div></section>` : ''}
  </div><aside class="stack side-sticky">
    <section class="sec"><h2>Nachrichten</h2><p class="note" style="margin:-6px 0 8px">Zu diesem Wert, seiner Branche und Politik, die ihn betrifft.</p><div id="d-news"></div></section>
    ${isBook(x) || x.cls === 'etf' ? `<details class="more"><summary>Für Profis: Orderbuch & Umsätze</summary><div class="stack" style="padding-bottom:16px"><p class="note">Jede Order läuft durch dieses Buch. Große Orders kaufen sich durch mehrere Preisstufen ${info('impact')}</p><div id="d-book"></div><h2 class="sh" style="margin-top:12px">Letzte Umsätze</h2><div id="d-ts"></div></div></details>` : ''}
  </aside></div>`;
}
function actionsHTML(x) {
  const p = S.A.pos[x.id], lever = (x.cls === 'stock' || x.cls === 'index' || x.cls === 'cmd' || x.cls === 'fx') ? `<button class="btn ghost" data-a="dlever" data-v="${x.id}">Mit Hebel handeln</button>` : '';
  if (E.isTradable(x) || x.cls === 'fund') return `<button class="btn" data-a="dbuy" data-v="${x.id}">Kaufen</button>${p ? `<button class="btn ghost" data-a="dsell" data-v="${x.id}">Verkaufen</button>` : ''}${p && !E.autoBlocked(x) ? `<button class="btn ghost" data-a="dauto" data-v="${x.id}">Absichern</button>` : ''}${x.cls !== 'bond' ? `<button class="btn ghost" data-a="dplan" data-v="${x.id}">Sparplan</button>` : ''}${x.cls === 'stock' ? lever : ''}`;
  if (x.cls === 'cmd') { const etc = E.byCls('etf').find(e => e.comp.length === 1 && e.comp[0].id === x.id); return (etc ? `<button class="btn" data-go="i-${etc.id}">${esc(x.name)}-ETC kaufen</button>` : `<button class="btn" data-go="i-CMDX">Rohstoff-ETF kaufen</button>`) + lever; }
  if (x.cls === 'index') return `<button class="btn" data-go="i-WLTX">WELTIX-ETF kaufen</button>${lever}`;
  if (x.cls === 'fx') return `<button class="btn" data-a="dfx">Währung tauschen</button>${lever}`;
  return '';
}
function bars(x, range) {
  const today = dayStart(E.M.t);
  if (range === '1T') { const t = x.c1.filter(k => k[0] >= today); return t.length > 5 ? t : x.c1.slice(-840); }
  if (range === '1W') { const h = (x.cH || []).filter(k => k[0] >= E.M.t - 7 * 864e5); if (h.length >= 8) return h; }
  const d = x.cD.concat(E.M.isOpen ? [[today, x.do, x.hi, x.lo, x.price, x.dv]] : []);
  return range === '1W' ? d.slice(-6) : range === '1M' ? d.slice(-22) : range === '6M' ? d.slice(-126) : range === '1J' ? d.slice(-252) : d;
}
export function update(id) {
  const x = E.I(id), A = S.A, U = S.UI; if (!x || x.delisted) return;
  const c = chg(x), pxEl = $('#d-px'), old = pxEl.dataset.v ? +pxEl.dataset.v : null;
  pxEl.textContent = fmtPx(x, x.price); pxEl.dataset.v = x.price;
  if (old !== null && old !== x.price) { pxEl.classList.remove('flash-up', 'flash-dn'); void pxEl.offsetWidth; pxEl.classList.add(x.price > old ? 'flash-up' : 'flash-dn'); }
  { const d = x.price - x.pc, abs = x.cls === 'bond' ? fmt(Math.abs(d), 2) + ' Pkt.' : fmtPx(x, Math.abs(d)); $('#d-ch').innerHTML = `<span class="${sc(c)}">${d > 0 ? '+' : d < 0 ? '−' : ''}${abs} (${pctS(c)})</span> <span class="fg2">heute ${info('today')}</span>`; }
  $('#d-why').innerHTML = `<b>Warum?</b><span>${esc(whyText(x))}</span>`;
  if (S.ensureHist) S.ensureHist(x.id);
  const b = bars(x, U.range), hourly = U.range === '1W' && b.length && b.length > 7, p = A.pos[x.id], showMk = p && U.marks !== false;
  const mk = $('#d-mk'); if (mk) mk.hidden = !p;
  const lines = [], marks = [];
  if (showMk) {
    lines.push({ v: x.cls === 'bond' ? p.cost / p.qty * 100 - x.acc : p.cost / p.qty, label: 'Einstand ' + fmt(x.cls === 'bond' ? p.cost / p.qty * 100 - x.acc : p.cost / p.qty, dig(x)), tone: 'fg' });
    for (const o of (A.auto || []).filter(o => o.tg === 'pos' && o.ref === x.id)) { const v = E.trigOf(o); lines.push({ v, label: `${o.k === 'tp' ? 'TP' : o.k === 'tr' ? 'Trailing' : 'SL'} ${fmt(v, dig(x))}`, tone: o.k === 'tp' ? 'up' : 'dn' }); }
    for (const h of A.hist) if (h.id === x.id && h.px > 0 && /Kauf|Verkauf|Sparplan|Wiederanlage|Stop|Take|Trailing|Zwangs/.test(h.side)) marks.push({ t: h.t, px: h.px, buy: /Kauf|Sparplan|Wiederanlage/.test(h.side) && !/Verkauf/.test(h.side) });
  }
  drawChart($('#d-chart'), b, { candle: U.candle, digits: dig(x), daily: U.range !== '1T' && !hourly, hourly, ref: U.range === '1T' ? x.pc : undefined, fmtV: v => fmtPx(x, v), lines, marks });
  $('#d-me').innerHTML = meHTML(x);
  autoSec(x);
  const act = $('#d-act'), ah = actionsHTML(x); if (act.dataset.h !== ah) { act.innerHTML = ah; act.dataset.h = ah; }
  const h = S.ins.hints.find(h => h.id === x.id);
  $('#d-hint').innerHTML = h ? `<div class="celebrate" style="margin:16px 0 0"><span class="av">${h.dir > 0 ? '↑' : h.dir < 0 ? '↓' : '→'}</span><span><b>${esc(h.src)}: Die Zahlen am ${fDate(h.date, true).slice(0, 9)} werden ${h.dir > 0 ? 'eher besser' : h.dir < 0 ? 'eher schlechter' : 'eher im Rahmen'} als erwartet ausfallen.</b><br><span class="small fg2">Trefferquote etwa ${fmt(h.acc * 100, 0)} % – keine Garantie.</span></span></div>` : '';
  $('#d-kv').innerHTML = kv(x);
  if (x.cls === 'stock') { earnings(x); ownership(x); }
  const cp = $('#d-comp'); if (cp) cp.innerHTML = members(x).sort((a, b) => b.w - a.w).slice(0, 8).map(({ m, w }) => row(m, { right: `<b>${fmt(w * 100, 1)} %</b><small class="${sc(chg(m))}">${pctS(chg(m))}</small>`, noSpark: true })).join('');
  const peers = x.cls === 'stock' ? new Set(E.byCls('stock').filter(y => y.sector === x.sector).map(y => y.id)) : null, mine = (A.feed || []).filter(n => (n.ids || []).includes(x.id));
  const news = mine.concat(E.M.news.filter(n => { const ids = n.ids || [n.id]; return ids.includes(x.id) || (peers && (n.cat === 'politics' || n.cat === 'earn') && ids.some(id => peers.has(id)) && n.cat !== 'earn') || (x.comp && ids.some(id => x.comp.some(c => c.id === id)) && n.cat === 'politics'); })).sort((a, b) => b.t - a.t).slice(0, 8);
  $('#d-news').innerHTML = news.length ? news.map(newsItem).join('') : '<p class="empty">Zuletzt keine Meldungen.</p>';
  if ($('#d-book') && $('details.more[open]')) { $('#d-book').innerHTML = bookHTML(x); $('#d-ts').innerHTML = tsHTML(x); }
}
// Beteiligungsleiter, Bilanz-Einblicke (ab 5 %), Abstimmung (ab 25 %), Übernahmeangebot
function ownership(x) {
  const box = $('#d-own'); if (!box) return;
  const A = S.A, sh = E.shareOf(A, x), mcap = x.shares * x.price, M = E.M, bid = (M.ma && M.ma.bids || []).find(b => b.id === x.id), deep = S.ins.deep && S.ins.deep[x.id];
  const steps = [[0.01, 'Investor Relations'], [0.05, 'Meldepflicht'], [0.25, 'Sperrminorität'], [0.501, 'Kontrolle']];
  let h = `<div class="ladder">${steps.map(([m, l]) => `<div class="${sh >= m ? 'on' : ''}"><b>${fmt(m * 100, m < 0.5 ? 0 : 1)} %</b>${l}<br><span class="small">${sh >= m ? 'erreicht' : fmtBig((m - sh) * mcap) + ' € fehlen'}</span></div>`).join('')}</div>
    <div class="lines" style="margin-top:10px"><div><span>Dein Anteil</span><b>${sh >= 1e-6 ? fmt(sh * 100, sh < 0.01 ? 4 : 2) + ' %' : '–'}</b></div><div><span>Börsenwert</span><b>${fmtBig(mcap)} €</b></div>${x.gov ? `<div><span>Gewinnverwendung</span><b>${x.gov.pay === 'div' ? 'hohe Ausschüttung' : 'Reinvestition'} (${esc(x.gov.by)})</b></div>` : ''}</div>`;
  if (bid) h += `<div class="alert amb" style="margin-top:12px"><div class="t"><b>Übernahmeangebot läuft</b>${esc(bid.name)} bietet ${fmt(bid.P, 2)} € je Aktie (+${fmt(bid.prem * 100, 0)} %). Entscheidung zur Börseneröffnung am ${fDate(bid.until, true)}. Bei Erfolg werden alle Aktien zu diesem Preis abgefunden.</div></div>`;
  if (deep) h += `<h3 class="sh" style="margin-top:16px">Bilanz-Einblicke (interne Planung)</h3><div class="lines"><div><span>Umsatz nächstes Quartal</span><b>${fmtBig(deep.rev)} €</b></div><div><span>Gewinn je Aktie nächstes Quartal</span><b>${fmtE(deep.eps)}</b></div>${Math.abs(deep.padj) > 0.005 ? `<div><span>Politik-Effekt auf den Gewinn</span><b class="${sc(deep.padj)}">${pctS(deep.padj, 1)}</b></div>` : ''}${deep.req ? `<div><span>Insider: Mindestprämie für eine Mehrheit</span><b>etwa ${fmt(deep.req * 100, 0)} %</b></div>` : ''}</div>`;
  if (sh >= 0.25) h += `<h3 class="sh" style="margin-top:16px">Abstimmung: Gewinnverwendung ${info('sperrmin')}</h3><div class="seg">${[['div', 'Mehr Dividende'], ['bal', 'Ausgewogen'], ['re', 'Reinvestieren']].map(([k, l]) => `<button data-a="dvote" data-v="${k}" class="${(x.gov ? x.gov.pay : 'bal') === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (sh >= E.BID_MIN_SHARE && !bid) {
    const U = S.UI, prem = U.bidPrem ?? 0.25, P = x.price * (1 + prem), lmax = E.lboMax(x, P), lbo = lmax * (U.bidLboF ?? 0.5), q = E.quoteBid(A, x, prem, lbo), o = E.bidOutlook(prem);
    h += `<h3 class="sh" style="margin-top:16px">Übernahmeangebot ${info('takeover')}</h3>
      <label class="field"><span>Prämie auf den Kurs: <b id="bd-pv">${fmt(prem * 100, 0)} %</b> ${info('premium')}</span><input type="range" id="bd-prem" min="5" max="60" step="1" value="${Math.round(prem * 100)}"></label>
      <label class="field"><span>LBO-Kredit: <b id="bd-lv">${fmtE(lbo, 0)}</b> von max. ${fmtE(lmax, 0)} ${info('lbo')}</span><input type="range" id="bd-lbo" min="0" max="100" step="1" value="${Math.round((U.bidLboF ?? 0.5) * 100)}" ${lmax > 0 ? '' : 'disabled'}></label>
      <div class="lines" id="bd-prev">${bidLines(q, o)}</div>
      <button class="btn" data-a="dbid" style="margin-top:10px">Angebot prüfen</button>`;
  } else if (!bid && sh < E.BID_MIN_SHARE) h += `<p class="note" style="margin-top:10px">Ab ${fmt(E.BID_MIN_SHARE * 100, 0)} % Beteiligung kannst du ein Übernahmeangebot abgeben. Dafür fehlen dir noch etwa ${fmtBig((E.BID_MIN_SHARE - sh) * mcap)} € – große Käufe treiben dabei den Kurs.</p>`;
  const busy = document.activeElement && box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT'; // Schieberegler nicht unter dem Finger neu aufbauen
  if (!busy && (S.ownHTML !== h || !box.innerHTML)) { box.innerHTML = h; S.ownHTML = h; }
}
function bidLines(q, o) {
  return `<div><span>Angebotspreis je Aktie</span><b>${fmt(q.P, 2)} €</b></div><div><span>Kaufpreis restliche ${fmt((1 - q.share) * 100, 1)} %</span><b>${fmtE(q.cost, 0)}</b></div>
    <div><span>Beraterkosten (1 %)</span><b>${fmtE(q.fee, 0)}</b></div><div><span>Davon LBO-Kredit</span><b>−${fmtE(q.lbo, 0)}</b></div>
    <div class="tot"><span>Eigenanteil</span><b>${fmtE(q.need, 0)}</b></div>
    <div><span>Aus Guthaben / Wertpapierkredit</span><b>${fmtE(q.fromCash, 0)} / <span class="${q.fromCredit > 0 ? 'amb' : ''}">${fmtE(q.fromCredit, 0)}</span></b></div>
    <div><span>Erfolgschance (Einschätzung)</span><b class="${o.k === 'low' ? 'dn' : o.k === 'mid' ? 'amb' : 'up'}">${o.t}</b></div>
    ${q.ok ? '' : `<p class="warn">Finanzierung reicht nicht: verfügbar ${fmtE(Math.max(0, q.avail), 0)}${S.A.credit ? '' : ' – schalte den Wertpapierkredit ein'}.</p>`}`;
}
function bidRefresh() {
  const x = E.I(S.UI.route.slice(2)); if (!x) return; const U = S.UI, prem = +$('#bd-prem').value / 100, P = x.price * (1 + prem), lmax = E.lboMax(x, P), lbo = lmax * +$('#bd-lbo').value / 100;
  U.bidPrem = prem; U.bidLboF = +$('#bd-lbo').value / 100; $('#bd-pv').textContent = fmt(prem * 100, 0) + ' %'; $('#bd-lv').textContent = fmtE(lbo, 0);
  $('#bd-prev').innerHTML = bidLines(E.quoteBid(S.A, x, prem, lbo), E.bidOutlook(prem));
}
inputs['bd-prem'] = bidRefresh; inputs['bd-lbo'] = bidRefresh;
actions.dvote = el => { const id = S.UI.route.slice(2); act({ type: 'vote', id, v: el.dataset.v }); };
actions.dbid = () => {
  const x = E.I(S.UI.route.slice(2)); if (!x) return; const U = S.UI, prem = U.bidPrem ?? 0.25, P = x.price * (1 + prem), lbo = E.lboMax(x, P) * (U.bidLboF ?? 0.5), q = E.quoteBid(S.A, x, prem, lbo);
  openReview({ title: `Übernahmeangebot für ${x.name}`, lines: [['Angebot je Aktie', `${fmt(q.P, 2)} € (+${fmt(prem * 100, 0)} %)`], ['Gesamtwert des Unternehmens', fmtE(q.total, 0)], ['LBO-Kredit (trägt das Unternehmen)', fmtE(q.lbo, 0), 'lbo'], ['Beraterkosten', fmtE(q.fee, 0)], ['Dein Eigenanteil', fmtE(q.need, 0)]], warn: 'Die Aktionäre entscheiden zur nächsten Börseneröffnung. Bekommst du über 50 %, gehört dir das Unternehmen zu 100 % und es verlässt die Börse. Scheitert das Angebot, fällt der Kurs zurück und du zahlst 0,3 % Beraterkosten.', confirm: 'Angebot abgeben', run: () => act({ type: 'bid', id: x.id, prem, lbo }, true) });
};
// Größte Sektoren eines ETFs (nach Gewicht)
function etfFocus(x) {
  const w = {}; let tot = 0; for (const { m, w: g } of members(x)) { const k = m.cls === 'stock' ? SECTORS[m.sector] : m.cls === 'bond' ? 'Anleihen' : m.cls === 'cmd' ? m.name : 'Sonstiges'; w[k] = (w[k] || 0) + g; tot += g; }
  return Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${esc(k)} ${fmt(v / (tot || 1) * 100, 0)} %`).join(' · ') || '–';
}
// Meine Position ganz oben: Wert, Rendite, Tag, Gewichtung, Einstand gegen Kurs, Erträge
function meHTML(x) {
  const A = S.A, p = A.pos[x.id]; if (!p || !(p.qty > 0)) return '';
  const T = E.totals(A), v = posValue(x.id, p), g = v - p.cost, inv = T.sec + T.der, w = inv > 0 ? v / inv : 0;
  const buyIn = x.cls === 'bond' ? p.cost / p.qty * 100 - x.acc : p.cost / p.qty, vsBuy = x.price / buyIn - 1;
  const old = p.t0 && p.t0 < dayStart(E.M.t), today = old && x.pc > 0 ? v - v * x.pc / x.price : null, inc = p.inc || 0;
  return `<section class="mypos" aria-label="Deine Position"><div class="figs">
      <div><span class="label">Deine Position</span><b>${fmtE(v)}</b><span class="small fg2">${fmtQty(x, p.qty)}</span></div>
      <div><span class="label">Rendite gesamt ${info('unreal')}</span><b class="${sc(g)}">${signE(g)}</b><span class="small ${sc(g)}">${pctS(p.cost ? g / p.cost : 0)}</span></div>
      <div><span class="label">Heute ${info('today')}</span><b class="${today === null ? '' : sc(today)}">${today === null ? '–' : signE(today)}</b><span class="small ${today === null ? 'fg2' : sc(today)}">${today === null ? 'heute gekauft' : pctS(chg(x))}</span></div>
      <div><span class="label">Gewichtung ${info('weight')}</span><b>${fmt(w * 100, 1)} %</b><span class="small fg2">deines Depots</span></div></div>
    <div class="lines" style="margin-top:8px">
      <div><span>Einstand Ø ${info('avgcost')} → aktueller Kurs</span><b>${fmtPx(x, buyIn)} → ${fmtPx(x, x.price)} <span class="${sc(vsBuy)}">(${pctS(vsBuy, 1)})</span></b></div>
      <div><span>${x.cls === 'bond' ? 'Erhaltene Kupons' : 'Erhaltene Dividenden'}</span><b class="${inc > 0 ? 'up' : ''}">${inc > 0 ? '+' : ''}${fmtE(inc)}</b></div>
      ${p.rz ? `<div><span>Realisiert durch Teilverkäufe</span><b class="${sc(p.rz)}">${signE(p.rz)}</b></div>` : ''}
      ${p.t0 ? `<div><span>Im Depot seit</span><b>${fDate(p.t0)}</b></div>` : ''}</div></section>`;
}
// Absicherung & Auto-Orders dieser Position
function autoSec(x) {
  const A = S.A, p = A.pos[x.id], sec = $('#d-auto-sec'); if (!sec) return;
  if (!p) { sec.hidden = true; return; }
  sec.hidden = false; const why = E.autoBlocked(x), box = $('#d-auto');
  if (why) { box.innerHTML = `<p class="note">${esc(why)}</p>`; return; }
  const list = (A.auto || []).filter(o => o.tg === 'pos' && o.ref === x.id);
  box.innerHTML = (list.length ? `<div class="lines">${list.map(o => autoRow(A, o, v => fmtPx(x, v), x.price)).join('')}</div>` : `<p class="note" style="margin:0 0 10px">Noch keine Absicherung. Ein Stop-Loss begrenzt Verluste, ein Take-Profit nimmt Gewinne automatisch mit – auch wenn du nicht online bist.</p>`)
    + `<div class="btns" style="margin-top:10px"><button class="btn sm ghost" data-a="dauto" data-v="${x.id}" data-k="sl">+ Stop-Loss</button><button class="btn sm ghost" data-a="dauto" data-v="${x.id}" data-k="tp">+ Take-Profit</button><button class="btn sm ghost" data-a="dauto" data-v="${x.id}" data-k="tr">+ Trailing-Stop</button></div>`;
}
export function autoRow(A, o, fp, px) {
  const t = E.trigOf(o), pv = E.autoPreview(A, o), d = t / px - 1, nm = E.AUTO_KINDS[o.k];
  return `<div><span style="display:block"><b style="color:var(--fg);font-weight:600">${nm}</b> ${o.oco ? '<em class="tag" style="font-style:normal;display:inline-block;margin-left:6px">OCO</em>' : ''}<small class="fg2" style="display:block">${o.k === 'tr' ? `${o.tm === 'pct' ? fmt(o.dist * 100, 1) + ' %' : fp(o.dist)} unter dem Hoch von ${fp(o.hi)} · ` : ''}${pv ? pv.qtyTxt : ''}${o.f < 0.9999 ? ` (${fmt(o.f * 100, 0)} %)` : ''}${pv && pv.pnl !== null ? ` · <span class="${sc(pv.pnl)}">${pv.pnl >= 0 ? '+' : '−'}${fmtE(Math.abs(pv.pnl), 0)}</span>` : ''}</small></span>
    <b style="text-align:right">${fp(t)} <small class="fg2" style="display:block;font-weight:400">${pctS(d, 1)} vom Kurs</small>
    <span class="btns" style="justify-content:flex-end;margin-top:4px"><button class="btn sm ghost" data-a="aedit" data-tg="${o.tg}" data-ref="${esc(o.ref)}" data-id="${o.id}">Ändern</button><button class="btn sm ghost" data-a="adel" data-id="${o.id}">${S.confirmAuto === o.id ? 'Wirklich löschen?' : 'Löschen'}</button></span></b></div>`;
}
const kvStock = (x, r, hv, range) => r('Marktkapitalisierung', fmtBig(x.shares * x.price) + ' €', 'mcap') + r('KGV', x.eps > 0 ? fmt(x.price / x.eps, 1) : 'Verlust', 'kgv') + r('Gewinn je Aktie (12 M.)', fmtE(x.eps), 'eps') + r('Dividendenrendite', fmt(x.dy * 100, 2) + ' %', 'divy') + r('Beta', fmt(x.beta, 2), 'beta') + r('Volatilität', fmt(hv * 100, 0) + ' %', 'vola') + range + r('Branche', SECTORS[x.sector]) + r('Spread', fmt(bookP(x).s * 2e4, 1) + ' Bp', 'spread');
function kv(x) {
  const r = (a, b, k) => `<div><span>${a} ${k ? info(k) : ''}</span><b>${b}</b></div>`, cd = x.cD.slice(-252), hi = Math.max(x.hi, ...cd.map(k => k[2])), lo = Math.min(x.lo, ...cd.map(k => k[3]));
  const rets = [], c30 = x.cD.slice(-31); for (let i = 1; i < c30.length; i++) rets.push(Math.log(c30[i][4] / c30[i - 1][4]));
  const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1), hv = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, rets.length - 1) * 252);
  const range = r('52 Wochen', `${fmt(lo, dig(x))} – ${fmt(hi, dig(x))}`, 'hilo'), ltv = E.ltvOf(x), ltvR = r('Beleihungswert (LTV)', ltv > 0 ? fmt(ltv * 100, 0) + ' %' : 'nicht beleihbar', 'ltv');
  const lvl = v => v >= 1.3 ? 'hoch' : v >= 0.7 ? 'mittel' : v > 0.2 ? 'gering' : v < -0.2 ? 'profitiert' : 'kaum';
  if (x.cls === 'stock') { const sn = E.sensOf(x), tz = sn.exp * 0.8 + sn.sc * 0.5; return r('Umsatzwachstum p. a.', x.fin ? pctS(x.fin.g, 1) : '–', 'rev') + r('Zinsempfindlichkeit', lvl(sn.rate), 'sens') + r('Zollempfindlichkeit', tz >= 0.7 ? 'hoch' : tz >= 0.4 ? 'mittel' : 'gering', 'tariff') + r('Heimatmarkt', E.REGION[sn.home] + ` · ${fmt(sn.exp * 100, 0)} % Ausland`) + ltvR + kvStock(x, r, hv, range); }
  if (x.cls === 'etf') return r('Schwerpunkte', etfFocus(x)) + r('Ausschüttung', isEtc(x) ? 'keine (Rohstoff-ETC)' : 'thesaurierend – Erträge werden reinvestiert') + ltvR + r('Inventarwert', fmtE(x.nav), 'nav') + r('Abweichung zum NAV', pctS(x.prem, 2), 'nav') + r('Laufende Kosten', fmt(x.ter * 100, 2) + ' % p. a.', 'ter') + r('Volatilität', fmt(hv * 100, 0) + ' %', 'vola') + range + r('Art', isEtc(x) ? 'ETC, physisch hinterlegt' : 'ETF, thesaurierend');
  if (x.cls === 'fund') return r('Inventarwert', fmtE(x.nav), 'nav') + r('Ausgabepreis', fmtE(x.nav * (1 + x.aa)), 'aa') + r('Ausgabeaufschlag', fmt(x.aa * 100, 2) + ' %', 'aa') + r('Laufende Kosten', fmt(x.ter * 100, 2) + ' % p. a.', 'ter') + r('Volatilität', fmt(hv * 100, 0) + ' %', 'vola') + range;
  if (x.cls === 'bond') return r('Restlaufzeit', x.matured ? 'getilgt' : fmt((x.mat - E.M.t) / E.YR, 1) + ' Jahre') + ltvR + r('Rendite', x.matured ? '–' : fmt(x.ytm * 100, 2) + ' %', 'ytm') + r('Kupon', fmt(x.cpn, 3) + ' % p. a.', 'coupon') + r('Fälligkeit', fDate(x.mat)) + r('Duration', fmt(x.mdur, 1), 'duration') + r('Stückzinsen', fmt(x.acc, 3) + ' %', 'accrued') + r('Rating', x.rating, 'rating') + r('Nächster Kupon', x.matured || !(x.cpn > 0) ? '–' : fDate(x.cds[x.ci])) + r('Emittent', esc(x.issuer));
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
actions.dauto = el => openAuto({ tg: 'pos', ref: el.dataset.v, k: el.dataset.k || 'sl' });
actions.aedit = el => { let id = +el.dataset.id; if (!id) { const ex = (S.A.auto || []).find(o => o.tg === el.dataset.tg && String(o.ref) === String(el.dataset.ref)); if (ex) id = ex.id; } openAuto({ tg: el.dataset.tg, ref: el.dataset.ref, id }); };
actions.adel = async el => { const id = +el.dataset.id; if (S.confirmAuto !== id) { S.confirmAuto = id; S.redraw(); return; } S.confirmAuto = null; await act({ type: 'autodel', id }); };
actions.dmarks = el => { S.UI.marks = S.UI.marks === false; el.classList.toggle('on', S.UI.marks !== false); el.setAttribute('aria-pressed', S.UI.marks !== false); S.redraw(); };
actions.dsell = el => openOrder(el.dataset.v, 'sell');
actions.dlever = el => { S.UI.dv.und = el.dataset.v; S.UI.mkt = 'lever'; S.go('markt'); };
actions.dplan = el => { S.UI.acct = 'plans'; S.planPre = el.dataset.v; S.go('konto'); };
actions.dfx = () => { S.UI.acct = 'fx'; S.go('konto'); };
