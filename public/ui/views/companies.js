// Meine Unternehmen: übernommene Firmen führen (Strategien, Quartale, Sonderdividende, Börsengang) und Übernahmeziele finden
import { S, E, esc, sc, pctS, signE, act, actions, $ } from '../store.js';
import { info } from '../glossary.js';
import { openReview } from './order.js';
import { av } from '../parts.js';
const { fmt, fmtE, fmtBig, fDate, coEbit, coValue, PE_STRATS, SECTORS, ipoQuote, shareOf, BID_MIN_SHARE } = E;

export function render() {
  return `<div class="grid2"><div class="stack" style="gap:20px">
    <div><h1 class="h1">Unternehmen</h1><p class="lead" style="margin:6px 0 0">Kauf dich ein, übernimm die Kontrolle, steigere den Wert – und bring die Firma später zurück an die Börse.</p></div>
    <div id="co-bids"></div><div id="co-list"></div>
    <section class="sec"><h2>Übernahmeziele ${info('takeover')}</h2><p class="note" style="margin:0 0 8px">Kleinere Unternehmen sind realistische Ziele. Ab ${fmt(BID_MIN_SHARE * 100, 0)} % Beteiligung kannst du in der Detailansicht ein Angebot abgeben.</p><div class="tbl" id="co-targets"></div></section>
  </div><aside class="stack">
    <section class="sec" style="border-top:0;padding-top:0"><h2>Beteiligungsstufen ${info('owner')}</h2><div class="lines">
      <div><span>1 % · Investor Relations</span><b>Tendenz vor den Zahlen</b></div>
      <div><span>5 % · Meldepflicht</span><b>Bilanz-Einblicke, Angebot möglich</b></div>
      <div><span>25 % · Sperrminorität ${info('sperrmin')}</span><b>Abstimmung über Dividende</b></div>
      <div><span>50,1 % · Kontrolle</span><b>Übernahme & Delisting</b></div></div></section>
    <section class="sec"><h2>So läuft eine Übernahme</h2><p class="note">1. Baue über die Börse eine Beteiligung auf – große Käufe treiben den Kurs.<br>2. Gib ein Angebot mit Prämie ab ${info('premium')}. Finanzierung: Guthaben, Wertpapierkredit und LBO-Kredit ${info('lbo')}.<br>3. Zur nächsten Börseneröffnung entscheiden die Aktionäre. Bei über 50 % gehört dir das Unternehmen zu 100 %.<br>4. Führe es über Quartale und bring es per Börsengang zurück ${info('ipo')} – oder behalte es als Cash-Cow.</p></section>
  </aside></div>`;
}
export function update() {
  const A = S.A, M = E.M;
  const mine = (M.ma && M.ma.bids || []).filter(b => b.uid === S.ME.uid);
  $('#co-bids').innerHTML = mine.map(b => { const x = M.inst[b.id]; return `<div class="alert amb"><div class="t"><b>Laufendes Angebot für ${esc(x ? x.name : b.id)}</b>${fmt(b.P, 2)} € je Aktie (+${fmt(b.prem * 100, 0)} %). Die Aktionäre entscheiden zur Börseneröffnung am ${fDate(b.until, true)}.</div></div>`; }).join('');
  $('#co-list').innerHTML = A.pe.length ? A.pe.map(coHTML).join('') : `<section class="sec" style="border-top:0;padding-top:0"><p class="empty">Du besitzt noch kein eigenes Unternehmen. Der Weg dahin: Beteiligung aufbauen, Übernahmeangebot abgeben, Mehrheit gewinnen.</p></section>`;
  const t = E.byCls('stock').map(x => ({ x, mcap: x.shares * x.price, sh: shareOf(A, x) })).filter(r => r.mcap < 1.5e9 || r.sh >= 0.01).sort((a, b) => a.mcap - b.mcap).slice(0, 12);
  $('#co-targets').innerHTML = `<table><thead><tr><th>Unternehmen</th><th>Börsenwert</th><th>5 % kosten etwa</th><th>Dein Anteil</th></tr></thead><tbody>${t.map(r => `<tr><td style="text-align:left"><button class="link" data-go="i-${r.x.id}">${esc(r.x.name)}</button><br><span class="small fg2">${SECTORS[r.x.sector]}</span></td><td>${fmtBig(r.mcap)} €</td><td>${fmtBig(r.mcap * 0.05)} €</td><td>${r.sh >= 0.0001 ? fmt(r.sh * 100, 2) + ' %' : '–'}</td></tr>`).join('')}</tbody></table>`;
}
function coHTML(co) {
  const ebit = coEbit(co), val = coValue(co), g = val - co.cost, lev = ebit > 0 ? co.debt / ebit : Infinity;
  const levTone = lev < 2.5 ? 'ok' : lev < 4.5 ? 'warn' : 'crit', st = co.st ? PE_STRATS[co.st.k] : null;
  const q = co.q.slice(-6);
  return `<section class="sec" style="border-top:0;padding-top:0">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">${av({ cls: 'stock', id: co.id, name: co.name })}<div style="min-width:0"><h2 style="margin:0">${esc(co.name)}</h2><span class="small fg2">${SECTORS[co.sector]} · dein Unternehmen seit ${fDate(co.t0)}</span></div></div>
    <div class="figs"><div><span class="label">Eigenkapitalwert</span><b>${fmtE(val, 0)}</b><span class="small ${sc(g)}">${signE(g, 0)} ggü. Einsatz</span></div>
      <div><span class="label">Schulden (LBO) ${info('lbo')}</span><b>${fmtE(co.debt, 0)}</b><span class="small"><span class="pill ${levTone}">${isFinite(lev) ? fmt(lev, 1) + ' × EBIT' : 'kein Gewinn'}</span></span></div>
      <div><span class="label">EBIT pro Jahr ${info('ebit')}</span><b>${fmtE(ebit, 0)}</b><span class="small fg2">Marge ${fmt(co.m * 100, 1)} %</span></div>
      <div><span class="label">Bewertung ${info('evmult')}</span><b>${fmt(co.mult, 1)} × EBIT</b><span class="small fg2">Umsatz ${fmtBig(co.rev)} € / Jahr</span></div></div>
    <div class="lines" style="margin-top:10px"><div><span>Nächster Quartalsabschluss</span><b>${fDate(co.next, true)}</b></div><div><span>Laufende Strategie</span><b>${st ? esc(st.name) + ` (Quartal ${co.st.q + 1})` : 'keine'}</b></div><div><span>Zins auf die Schulden</span><b>${fmt(co.rate * 100, 2)} %</b></div></div>
    ${q.length ? `<div class="tbl" style="margin-top:12px"><table><thead><tr><th>Quartal</th><th>Umsatz</th><th>EBIT</th><th>Ausschüttung</th><th>Schulden</th><th>Wert</th></tr></thead><tbody>${q.slice().reverse().map(r => `<tr><td>${esc(r.q)}</td><td>${fmtBig(r.rev)} €</td><td class="${sc(r.ebit)}">${fmtBig(r.ebit)} €</td><td>${fmtBig(r.div)} €</td><td>${fmtBig(r.debt)} €</td><td>${fmtBig(r.val)} €</td></tr>`).join('')}</tbody></table></div>` : '<p class="note" style="margin-top:10px">Das erste Quartal unter deiner Führung läuft noch.</p>'}
    <h3 class="sh" style="margin-top:16px">Strategie festlegen</h3>
    <div class="btns">${Object.entries(PE_STRATS).map(([k, s]) => `<button class="btn sm ghost" data-a="costrat" data-co="${co.id}" data-v="${k}" ${co.st && k !== 'special' ? 'disabled' : ''}>${esc(s.name)}</button>`).join('')}</div>
    <h3 class="sh" style="margin-top:16px">Börsengang ${info('ipo')}</h3>
    <div class="btns">${[0.25, 0.5, 1].map(f => `<button class="btn sm ${f === 1 ? '' : 'ghost'}" data-a="coipo" data-co="${co.id}" data-v="${f}" ${co.qs < 1 ? 'disabled' : ''}>${f === 1 ? 'Komplett verkaufen' : fmt(f * 100, 0) + ' % platzieren'}</button>`).join('')}</div>
    ${co.qs < 1 ? '<p class="note" style="margin-top:6px">Möglich nach dem ersten Quartal unter deiner Führung.</p>' : ''}
  </section>`;
}
actions.costrat = el => {
  const co = S.A.pe.find(c => c.id === el.dataset.co), k = el.dataset.v, s = PE_STRATS[k]; if (!co) return;
  const lines = [['Unternehmen', esc(co.name)], ['Strategie', esc(s.name)]];
  if (k === 'special') { const add = Math.max(0, 3.5 * coEbit(co) - co.debt); lines.push(['Neue Schulden des Unternehmens', fmtE(add, 0)], ['Auszahlung an dich', fmtE(add, 0)]); }
  openReview({ title: 'Strategie beschließen', lines, totalLast: k === 'special', warn: s.desc, confirm: 'Beschließen', run: () => act({ type: 'strat', co: co.id, k }, true) });
};
actions.coipo = el => {
  const co = S.A.pe.find(c => c.id === el.dataset.co), f = +el.dataset.v; if (!co) return; const q = ipoQuote(co, f), pnl = q.net - q.cost;
  openReview({ title: `Börsengang ${co.name}`, lines: [['Platzierte Aktien', fmt(f * 100, 0) + ' %'], ['Unternehmenswert (Eigenkapital)', fmtE(q.V, 0)], ['Ausgabepreis je Aktie', fmt(q.px, 2) + ' € (7 % Abschlag)'], ['Bankgebühren', fmtE(q.fee, 0)], ['Gewinn ggü. Einsatz', `<span class="${sc(pnl)}">${signE(pnl, 0)}</span>`], ['Erlös für dich', fmtE(q.net, 0)]], warn: f < 1 ? `Du behältst ${fmt((1 - f) * 100, 0)} % als Aktien im Depot. Das Unternehmen notiert wieder an der Börse.` : 'Du verkaufst alles. Das Unternehmen notiert wieder an der Börse.', confirm: 'An die Börse bringen', run: () => act({ type: 'ipo', co: co.id, frac: f }, true) });
};
