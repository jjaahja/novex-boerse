// Konto: Verrechnungskonto, Zinsen, Festgeld, Kredit, Währungen, Sparpläne, Geldfluss, Orders
import { S, E, esc, sc, pctS, signE, parseNum, act, actions, inputs, changes, $ } from '../store.js';
import { info } from '../glossary.js';
import { openReview } from './order.js';
const { fmt, fmtE, fmtQty, fmtPx, dig, fDate, fTime, totals, availCash, creditLimit, lombardValue, CCYS, ccyEur, TIERS, DEPOSIT_PREMIUM, CASH_RATE_CAP, depositRate, quoteExchange, nextPlanDate, isOpen, dayStart, DAY } = E;
const TABS = [['cash', 'Geld & Zinsen'], ['credit', 'Kredit'], ['fx', 'Währungen'], ['plans', 'Sparpläne'], ['flow', 'Geldfluss'], ['orders', 'Orders']];
const CATN = { start: 'Startkapital', div: 'Dividenden', int: 'Zinsen', cpn: 'Kupons', pe: 'Ausschüttungen eigener Firmen', prize: 'Prämien & Boni', pnl: 'Realisierte Gewinne', fee: 'Gebühren', debt: 'Kreditzinsen', fx: 'Währungsgewinne', loan: 'Unternehmenskredit', ma: 'Übernahmen (Eigenanteil)', spend: 'Lizenzen & Luxus' };

export function render() {
  const t = S.UI.acct;
  return `<div class="stack" style="gap:20px"><h1 class="h1">Konto</h1>
    <div class="figs" id="a-figs"></div>
    <div class="seg" role="tablist">${TABS.map(x => `<button data-a="atab" data-v="${x[0]}" class="${t === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
    <div id="a-body">${body(t)}</div></div>`;
}
function body(t) {
  const A = S.A, tier = TIERS[A.tierMax || 0];
  if (t === 'cash') return `<div class="grid2"><div class="stack" style="gap:0">
    <section class="sec" style="border-top:0;padding-top:0"><h2>Zinsen auf dein Guthaben ${info('cash')}</h2><div class="lines" id="a-int"></div></section>
    <section class="sec"><h2>Festgeld ${info('festgeld')}</h2><div class="rows" id="a-deps"></div>
      <div class="stack" style="margin-top:14px"><div class="seg" role="group">${[3, 6, 12].map(m => `<button data-a="dterm" data-v="${m}" class="${(S.dterm || 3) === m ? 'on' : ''}" ${tier.terms.includes(m) ? '' : 'disabled title="Ab Stufe Aktiver Trader"'}>${m} Monate</button>`).join('')}</div>
      <label class="field"><span>Betrag (ab 1.000 €)</span><input class="inp" id="d-amt" inputmode="decimal" autocomplete="off" placeholder="z. B. 5.000"></label><div class="lines" id="d-prev"></div><button class="btn" data-a="dreview">Festgeld prüfen</button></div></section>
  </div><aside class="stack" style="gap:0"><section class="sec" style="border-top:0;padding-top:0"><h2>Einstellungen</h2><div id="a-set"></div></section></aside></div>`;
  if (t === 'credit') return `<div class="grid2"><div class="stack" style="gap:0">
    <div id="cr-alert"></div>
    <section class="sec" style="border-top:0;padding-top:0"><h2>Wertpapierkredit ${info('credit')} <span class="sp"></span><span id="cr-tog"></span></h2><div id="cr-mon"></div></section>
    <section class="sec"><h2>Deine Sicherheiten ${info('ltv')}</h2><div id="cr-col"></div></section>
  </div><aside class="stack" style="gap:0">
    <section class="sec" style="border-top:0;padding-top:0"><h2>Unternehmenskredit ${info('acqloan')}</h2><div id="cr-acq"></div></section>
    <section class="sec"><h2>So funktioniert's</h2><p class="note">Der Wertpapierkredit ist ein Dispo auf dein Depot: Kaufst du mehr, als du Guthaben hast, rutscht das Verrechnungskonto ins Minus. Zinsen werden täglich berechnet. Fallen die Kurse, sinkt der Beleihungswert – übersteigt der Kredit ihn, kommt der Margin Call ${info('margincall')}.</p></section>
  </aside></div>`;
  if (t === 'fx') return `<div class="grid2"><div class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Fremdwährungskonten ${info('fxacc')}</h2><div class="rows" id="fx-bal"></div></section></div>
    <aside class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Währung tauschen</h2>
      <div class="row2"><label class="field"><span>Von</span><select class="inp" id="fx-from">${['EUR', ...CCYS].map(c => `<option ${S.fxFrom === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="field"><span>Nach</span><select class="inp" id="fx-to">${['EUR', ...CCYS].map(c => `<option ${(S.fxTo || 'USD') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label></div>
      <label class="field"><span>Betrag</span><input class="inp" id="fx-amt" inputmode="decimal" autocomplete="off" placeholder="0"></label><div class="lines" id="fx-prev"></div><button class="btn" data-a="fxreview">Tausch prüfen</button></section></aside></div>`;
  if (t === 'plans') {
    const opts = [['etf', 'ETFs & ETCs'], ['stock', 'Aktien'], ['fund', 'Fonds']].map(([c, l]) => `<optgroup label="${l}">${E.byCls(c).map(x => `<option value="${x.id}" ${(S.planPre || 'WLTX') === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
    return `<div class="grid2"><div class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Deine Sparpläne ${info('sparplan')}</h2><div class="rows" id="pl-list"></div></section></div>
      <aside class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Neuer Sparplan</h2>
      <label class="field"><span>Wertpapier</span><select class="inp" id="pl-iid">${opts}</select></label>
      <label class="field"><span>Sparrate (€)</span><input class="inp" id="pl-amt" inputmode="decimal" value="100"></label>
      <div class="seg"><button data-a="plfreq" data-v="m" class="${(S.plFreq || 'm') === 'm' ? 'on' : ''}">Monatlich</button><button data-a="plfreq" data-v="w" class="${S.plFreq === 'w' ? 'on' : ''}">Wöchentlich</button></div>
      <label class="field"><span>${(S.plFreq || 'm') === 'm' ? 'Am Tag des Monats' : 'Am Wochentag'}</span><select class="inp" id="pl-day">${(S.plFreq || 'm') === 'm' ? [1, 5, 10, 15, 20, 25].map(d => `<option value="${d}">${d}.</option>`).join('') : [['1', 'Montag'], ['2', 'Dienstag'], ['3', 'Mittwoch'], ['4', 'Donnerstag'], ['5', 'Freitag']].map(d => `<option value="${d[0]}">${d[1]}</option>`).join('')}</select></label>
      <p class="note">Ohne Ordergebühr, auch in Bruchstücken. Fehlt Guthaben, wird die Ausführung ausgesetzt.</p>
      <button class="btn" data-a="pladd">Sparplan anlegen</button></section></aside></div>`;
  }
  if (t === 'flow') return `<div class="grid2"><div class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Bewegungen</h2><div id="fl-list"></div></section></div><aside class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Summen seit Start</h2><div class="lines" id="fl-sum"></div></section></aside></div>`;
  return `<section class="sec" style="border-top:0;padding-top:0"><h2>Offene Orders ${info('limit')}</h2><div id="or-open"></div></section><section class="sec"><h2>Erledigte Orders</h2><div id="or-done"></div></section>`;
}
export function update() {
  const A = S.A, T = totals(A), lz = E.M.lz, lim = creditLimit(A), tier = TIERS[A.tier || 0];
  $('#a-figs').innerHTML = `<div><span class="label">Verfügbar ${info('cash')}</span><b class="${A.cash < 0 ? 'dn' : ''}">${fmtE(availCash(A, undefined, true))}</b><span class="small fg2">Kontostand ${fmtE(A.cash)}</span></div>
    <div><span class="label">Zinssatz ${info('leitzins')}</span><b>${fmt(lz * 100, 2)} %</b><span class="small fg2">bis ${fmtE(CASH_RATE_CAP, 0)}</span></div>
    <div><span class="label">Festgeld</span><b>${fmtE(T.dep)}</b><span class="small fg2">${A.deps.length} Anlage${A.deps.length === 1 ? '' : 'n'}</span></div>
    <div><span class="label">Fremdwährung</span><b>${fmtE(T.fxv)}</b><span class="small fg2">in Euro bewertet</span></div>`;
  const t = S.UI.acct;
  if (t === 'cash') {
    $('#a-int').innerHTML = `<div><span>Guthabenzins (= Leitzins)</span><b>${fmt(lz * 100, 2)} % p. a.</b></div><div><span>Diesen Monat aufgelaufen</span><b>${fmtE(A.intAcc + CCYS.reduce((s, c) => s + A.fxAcc[c], 0))}</b></div><div><span>Gutschrift</span><b>am ersten Handelstag des Monats</b></div><div><span>Bisher erhalten</span><b>${fmtE(A.agg.int || 0)}</b></div>`;
    $('#a-deps').innerHTML = A.deps.length ? A.deps.map(d => `<div class="r noav" style="cursor:default"><span><span class="nm" style="display:block">${fmtE(d.amt)} · ${d.months} Monate</span><span class="sub" style="display:block">${fmt(d.rate * 100, 2)} % p. a. · fällig ${fDate(d.end)}</span></span><span></span><span class="val"><b>+${fmtE(d.amt * d.rate * (d.end - d.start) / E.YR)}</b><small class="fg2">Zinsen bei Fälligkeit</small></span></div>`).join('') : '<p class="empty">Noch kein Festgeld. Sicherer Hafen, wenn die Märkte wackeln.</p>';
    depPrev();
    const used = Math.max(0, -A.cash), lv = lombardValue(A);
    $('#a-set').innerHTML = `<div class="setting"><div class="t"><b>Dividenden wieder anlegen ${info('drip')}</b><small>Dividenden kaufen automatisch neue Anteile derselben Aktie.</small></div><button class="toggle ${A.drip ? 'on' : ''}" data-a="drip" aria-pressed="${A.drip}" aria-label="Dividenden wieder anlegen"></button></div>
      <div class="setting"><div class="t"><b>Wertpapierkredit ${info('credit')}</b><small>${A.credit ? `Aktiv · genutzt ${fmtE(Math.max(0, -A.cash))} von ${fmtE(lombardValue(A))}` : 'Depot beleihen, ohne zu verkaufen.'}</small></div><button class="btn sm ghost" data-a="atab" data-v="credit">Kredit-Monitor</button></div>`;
  } else if (t === 'credit') creditView(A, T);
  else if (t === 'fx') {
    $('#fx-bal').innerHTML = CCYS.map(c => { const v = A.fxc[c] * ccyEur(c), g = v - A.fxCost[c]; return `<div class="r noav" style="cursor:default"><span><span class="nm" style="display:block">${c} · ${fmt(A.fxc[c], 2)}</span><span class="sub" style="display:block">Zins ${fmt(E.rateOf(c) * 100, 2)} % p. a. · 1 ${c} = ${fmt(ccyEur(c), 4)} €</span></span><span></span><span class="val"><b>${fmtE(v)}</b>${A.fxc[c] > 0 ? `<small class="${sc(g)}">${signE(g)} Währungseffekt</small>` : '<small class="fg2">leer</small>'}</span></div>${A.fxc[c] > 0.005 ? `<div class="qmenu" style="padding-left:0"><button class="btn sm ghost" data-a="aedit" data-tg="fx" data-ref="${c}" data-id="0">${(A.auto || []).some(o => o.tg === 'fx' && o.ref === c) ? 'Stop-Loss / Take-Profit ändern' : 'Stop-Loss / Take-Profit'}</button></div>` : ''}`; }).join('') + '<p class="note" style="margin-top:10px">Auch Währungsguthaben lassen sich absichern: Fällt oder steigt der Euro-Wert der Fremdwährung auf deine Schwelle, wird automatisch in Euro zurückgetauscht.</p>';
    fxPrev();
  } else if (t === 'plans') {
    $('#pl-list').innerHTML = A.plans.length ? A.plans.map(p => { const x = E.I(p.iid); return `<div class="r noav" style="cursor:default"><span><span class="nm" style="display:block">${esc(x.name)}</span><span class="sub" style="display:block">${fmtE(p.amt)} ${p.freq === 'w' ? 'wöchentlich' : 'monatlich'} · nächste Ausführung ${fDate(p.next, true).slice(0, 9)} · ${p.runs || 0}× ausgeführt</span></span><span></span><span class="val"><button class="btn sm ghost" data-a="plrm" data-v="${p.id}">${S.confirmPlan === p.id ? 'Wirklich löschen?' : 'Löschen'}</button></span></div>`; }).join('') : '<p class="empty">Noch kein Sparplan. Schon 50 € im Monat in einen breiten ETF bauen über die Jahre ein ordentliches Vermögen auf.</p>';
  } else if (t === 'flow') {
    $('#fl-sum').innerHTML = Object.keys(CATN).filter(k => A.agg[k]).map(k => `<div><span>${CATN[k]}</span><b class="${k === 'start' ? '' : sc(A.agg[k])}">${signE(A.agg[k])}</b></div>`).join('') || '<p class="empty">Noch keine Bewegungen.</p>';
    $('#fl-list').innerHTML = A.flows.length ? `<div class="tbl"><table><thead><tr><th>Datum</th><th>Art</th><th>Vorgang</th><th>Betrag</th></tr></thead><tbody>${A.flows.slice(0, 80).map(f => `<tr><td>${fDate(f.t).slice(0, 6)} ${fTime(f.t)}</td><td style="text-align:left">${CATN[f.cat] || f.cat}</td><td style="text-align:left;white-space:normal">${esc(f.txt)}</td><td class="${f.cat === 'start' ? '' : sc(f.amt)}">${signE(f.amt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Noch keine Bewegungen.</p>';
  } else {
    const row = (o, open) => { const x = E.I(o.iid); return `<tr><td>${fDate(o.t).slice(0, 6)} ${fTime(o.t)}</td><td style="text-align:left">${esc(x.name)}<br><span class="small fg2">${esc(o.note || '')}</span></td><td class="${o.side === 'buy' ? '' : ''}">${o.side === 'buy' ? 'Kauf' : 'Verkauf'}</td><td>${{ market: 'Market', limit: 'Limit', stop: 'Stop', stoplimit: 'Stop-Limit', fund: 'Fonds' }[o.otype] || o.otype}${o.limit ? ' ' + fmt(o.limit, dig(x)) : ''}${o.stop ? ' / S ' + fmt(o.stop, dig(x)) : ''}</td><td>${o.type === 'fund' && o.side === 'buy' && o.status !== 'ausgeführt' ? fmtE(o.amount) : fmtQty(x, o.qty)}</td><td>${o.status}</td>${open ? `<td><button class="btn sm ghost" data-a="ocancel" data-v="${o.id}">Löschen</button></td>` : ''}</tr>`; };
    const op = A.orders.filter(isOpen), dn = A.orders.filter(o => !isOpen(o)).slice(0, 60);
    $('#or-open').innerHTML = op.length ? `<div class="tbl"><table><thead><tr><th>Zeit</th><th>Wertpapier</th><th>Art</th><th>Typ</th><th>Menge</th><th>Status</th><th></th></tr></thead><tbody>${op.map(o => row(o, true)).join('')}</tbody></table></div>` : '<p class="empty">Keine offenen Orders.</p>';
    $('#or-done').innerHTML = dn.length ? `<div class="tbl"><table><thead><tr><th>Zeit</th><th>Wertpapier</th><th>Art</th><th>Typ</th><th>Menge</th><th>Status</th></tr></thead><tbody>${dn.map(o => row(o, false)).join('')}</tbody></table></div>` : '<p class="empty">Noch keine Orders.</p>';
  }
}
function creditView(A, T) {
  const c = E.creditInfo(A), pct = v => fmt(v * 100, 1) + ' %', tone = c.status === 'call' || c.status === 'critical' ? 'crit' : c.status === 'warn' ? 'warn' : 'ok';
  $('#cr-tog').innerHTML = `<button class="toggle ${A.credit ? 'on' : ''}" data-a="credit" aria-pressed="${A.credit}" aria-label="Wertpapierkredit ${A.credit ? 'ausschalten' : 'einschalten'}"></button>`;
  $('#cr-alert').innerHTML = A.mc ? `<div class="alert" role="alert" style="margin-bottom:18px"><div class="t"><b>Margin Call – noch ${fmt(Math.max(0, A.mc.left) / 60, 1)} Handelsstunden</b>Dein Kredit liegt ${fmtE(A.mc.need)} über dem Beleihungswert. Verkaufe Positionen, tausche Fremdwährung oder löse Festgeld auf. Danach verkauft die Bank selbst – zuerst Werte mit niedriger Beleihungsquote.</div><button class="btn sm" data-go="home">Positionen ansehen</button></div>`
    : c.status === 'critical' || c.status === 'warn' ? `<div class="alert amb" style="margin-bottom:18px"><div class="t"><b>Dein Kredit ist ${c.status === 'critical' ? 'fast' : 'stark'} ausgelastet</b>Schon ein Kursrückgang von ${pct(c.buffer)} löst einen Margin Call aus.</div></div>` : '';
  const w = Math.min(100, (c.use || 0) * 100);
  $('#cr-mon').innerHTML = `<div class="figs"><div><span class="label">Beleihungswert ${info('lv')}</span><b>${fmtE(c.lv)}</b><span class="small fg2">maximaler Kredit</span></div>
      <div><span class="label">Genutzter Kredit</span><b>${fmtE(c.debt)}</b><span class="small fg2">${A.credit ? `frei ${fmtE(c.avail)}` : 'Kredit ausgeschaltet'}</span></div>
      <div><span class="label">Auslastung ${info('ltvuse')}</span><b class="${c.debt > 0 ? (tone === 'ok' ? '' : tone === 'warn' ? 'amb' : 'dn') : ''}">${c.debt > 0 ? (isFinite(c.use) ? pct(c.use) : '> 100 %') : '0 %'}</b><span class="small"><span class="pill ${c.debt > 0 ? tone : 'n'}">${{ none: 'kein Kredit', ok: 'entspannt', warn: 'erhöht', critical: 'kritisch', call: 'Margin Call' }[c.status]}</span></span></div>
      <div><span class="label">Zinssatz ${info('creditrate')}</span><b>${fmt(c.rate * 100, 2)} %</b><span class="small fg2">Leitzins + ${fmt((c.rate - E.M.lz) * 100, 1)} %</span></div></div>
    <div style="margin:16px 0 6px"><div class="meter big"><i class="${tone}" style="width:${w.toFixed(1)}%"></i><span class="mark" style="left:75%"></span><span class="mark" style="left:calc(100% - 2px)"></span></div>
    <div class="small fg2" style="display:flex;justify-content:space-between;margin-top:4px"><span>0 %</span><span>75 % Warnung</span><span>100 % Margin Call</span></div></div>
    <div class="lines"><div><span>Puffer bis zum Margin Call ${info('buffer')}</span><b>${c.debt > 0 ? `${pct(c.buffer)} Kursrückgang · ${fmtE(c.bufferEur)}` : '–'}</b></div>
      <div><span>Kreditzinsen pro Jahr</span><b>${fmtE(c.debt * c.rate)}</b></div></div>
    <p class="note" style="margin-top:8px">${A.credit ? 'Kaufst du mehr, als du Guthaben hast, nutzt du automatisch den Kredit. Getilgt wird mit jedem Euro, der aufs Verrechnungskonto fließt.' : 'Schalte den Kredit ein, um dein Depot zu beleihen – zum Beispiel für ein Übernahmeangebot.'}</p>`;
  const rows = E.collateralRows(A);
  $('#cr-col').innerHTML = rows.length ? `<div class="lines">${rows.map(r => `<div><span style="display:block">${r.id ? `<button class="link" data-go="i-${r.id}">${esc(r.name)}</button>` : esc(r.name)}<small class="fg2" style="display:block">${fmtE(r.v, r.v >= 1e5 ? 0 : 2)} × ${fmt(r.q * 100, 0)} %${r.q === 0 ? ' – zu riskant als Sicherheit' : ''}</small></span><b>${fmtE(r.lv, r.lv >= 1e5 ? 0 : 2)}</b></div>`).join('')}<div class="tot"><span>Beleihungswert gesamt</span><b>${fmtE(rows.reduce((a, r) => a + r.lv, 0), 0)}</b></div></div>
    ${A.deps.length ? `<div class="lines" style="margin-top:10px">${A.deps.map(d => `<div><span>Festgeld ${fmtE(d.amt)} (${d.months} M.)</span><b><button class="btn sm ghost" data-a="breakdep" data-v="${d.id}">${S.confirmDep === d.id ? 'Ohne Zinsen auflösen?' : 'Vorzeitig auflösen'}</button></b></div>`).join('')}</div>` : ''}`
    : '<p class="empty">Noch keine Sicherheiten. Kaufe Anleihen, ETFs oder große Aktien – sie zählen am meisten.</p>';
  const b = E.bonity(A);
  $('#cr-acq').innerHTML = !b.unlocked ? '<p class="note">Ab der Stufe „Fondsmanager“ (250.000 € Vermögen) leiht dir die Bank Geld für große Vorhaben – abhängig von Vermögen, Cashflow und Bonität.</p>'
    : `<div class="lines"><div><span>Bonität ${info('bonity')}</span><b><span class="pill ${/^A/.test(b.rating) ? 'ok' : b.rating === 'BBB' ? 'n' : 'warn'}">${b.rating}</span></b></div>
      <div><span>Zins</span><b>Leitzins + ${fmt(b.spread * 100, 1)} %</b></div><div><span>Cashflow (12 Monate)</span><b>${fmtE(b.cf, 0)}</b></div><div><span>Verfügbarer Rahmen</span><b>${fmtE(b.limit, 0)}</b></div></div>
      <label class="field" style="margin-top:12px"><span>Betrag (ab 10.000 €)</span><input class="inp" id="ln-amt" inputmode="decimal" autocomplete="off" placeholder="z. B. 100.000"></label>
      <button class="btn" data-a="lnreview" style="margin-top:10px">Kredit prüfen</button>
      ${(A.loans || []).length ? `<h3 class="sh" style="margin-top:18px">Laufende Kredite</h3>${A.loans.map(l => `<div class="setting"><div class="t"><b>${fmtE(l.amt)}</b><small>Leitzins + ${fmt(l.spread * 100, 1)} % · seit ${fDate(l.t0)}</small></div><button class="btn sm ghost" data-a="lnrepay" data-v="${l.id}">Tilgen</button></div>`).join('')}` : ''}`;
}
function depPrev() {
  const box = $('#d-prev'); if (!box) return; const m = S.dterm || 3, v = parseNum(($('#d-amt') || {}).value), r = depositRate(m);
  box.innerHTML = `<div><span>Zinssatz für ${m} Monate</span><b>${fmt(r * 100, 2)} % p. a.</b></div>` + (v > 0 ? `<div><span>Zinsen bei Fälligkeit</span><b>+${fmtE(v * r * m / 12)}</b></div>` : '') + (v > availCash(S.A, undefined, true) ? '<p class="warn">Übersteigt dein freies Guthaben.</p>' : '');
}
function fxPrev() {
  const box = $('#fx-prev'); if (!box) return; const from = $('#fx-from').value, to = $('#fx-to').value, v = parseNum($('#fx-amt').value);
  if (from === to || (from !== 'EUR' && to !== 'EUR')) { box.innerHTML = '<p class="note">Getauscht wird zwischen Euro und USD, CHF oder GBP.</p>'; return; }
  const q = v > 0 ? quoteExchange(from, to, v) : null, have = from === 'EUR' ? availCash(S.A, undefined, true) : S.A.fxc[from];
  box.innerHTML = `<div><span>Verfügbar</span><b>${fmt(have, 2)} ${from}</b></div>` + (q ? `<div><span>Kurs inkl. Spread</span><b>1 EUR = ${fmt(q.rate, 4)} ${q.ccy}</b></div><div class="tot"><span>Du bekommst</span><b>${fmt(q.got, 2)} ${to}</b></div>` : '') + (v > have + 1e-9 ? '<p class="warn">Mehr als verfügbar.</p>' : '') + (!E.M.isOpen ? '<p class="warn">Getauscht wird zu Börsenzeiten (Mo–Fr 08:00–22:00).</p>' : '');
}
actions.breakdep = async el => { const id = +el.dataset.v; if (S.confirmDep !== id) { S.confirmDep = id; update(); return; } S.confirmDep = null; await act({ type: 'breakdep', id }); };
actions.lnreview = () => { const v = parseNum($('#ln-amt').value), b = E.bonity(S.A); if (!(v > 0)) { S.toast('Bitte einen Betrag eingeben.', 'dn'); return; } openReview({ title: 'Unternehmenskredit aufnehmen', lines: [['Betrag', fmtE(v)], ['Bonität', b.rating], ['Zins heute', fmt((E.M.lz + b.spread) * 100, 2) + ' % p. a. (variabel)'], ['Zinsen pro Jahr', fmtE(v * (E.M.lz + b.spread))]], warn: 'Der Kredit wird von deinem Nettovermögen abgezogen und kostet laufend Zinsen. Steigt der Leitzins, steigt auch dein Zins.', confirm: 'Kredit aufnehmen', run: () => act({ type: 'loan', amt: v }, true) }); };
actions.lnrepay = el => { const l = S.A.loans.find(k => k.id === +el.dataset.v); if (!l) return; const amt = Math.min(l.amt, Math.max(0, E.availCash(S.A, undefined, true))); if (!(amt > 0)) { S.toast('Kein freies Guthaben zum Tilgen.', 'dn'); return; } openReview({ title: 'Kredit tilgen', lines: [['Offen', fmtE(l.amt)], ['Tilgung', fmtE(amt)], ['Danach offen', fmtE(l.amt - amt)]], confirm: 'Jetzt tilgen', run: () => act({ type: 'repay', id: l.id, amt }, true) }); };
actions.atab = el => { S.UI.acct = el.dataset.v; S.rebuild(); };
actions.drip = async el => { el.disabled = true; await act({ type: 'drip', on: !S.A.drip }); };
actions.credit = async el => { el.disabled = true; await act({ type: 'credit', on: !S.A.credit }); };
actions.dterm = el => { S.dterm = +el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); depPrev(); };
actions.dreview = () => { const m = S.dterm || 3, v = parseNum($('#d-amt').value); if (!(v > 0)) { S.toast('Bitte einen Betrag eingeben.', 'dn'); return; } openReview({ title: `Festgeld über ${m} Monate`, lines: [['Betrag', fmtE(v)], ['Zinssatz', fmt(depositRate(m) * 100, 2) + ' % p. a.'], ['Laufzeit', `${m} Monate`], ['Zinsen bei Fälligkeit', '+' + fmtE(v * depositRate(m) * m / 12)]], warn: 'Während der Laufzeit kommst du nicht an das Geld.', confirm: 'Festgeld anlegen', run: () => act({ type: 'deposit', months: m, amt: v }, true) }); };
actions.fxreview = () => { const from = $('#fx-from').value, to = $('#fx-to').value, v = parseNum($('#fx-amt').value), q = v > 0 ? quoteExchange(from, to, v) : null; if (!q) { S.toast('Bitte Betrag und Währungen prüfen.', 'dn'); return; } openReview({ title: `${from} in ${to} tauschen`, lines: [['Du gibst', `${fmt(v, 2)} ${from}`], ['Kurs inkl. Spread', `1 EUR = ${fmt(q.rate, 4)} ${q.ccy}`], ['Du bekommst', `${fmt(q.got, 2)} ${to}`]], confirm: 'Jetzt tauschen', run: () => act({ type: 'exchange', from, to, amt: v }, true) }); };
actions.plfreq = el => { S.plFreq = el.dataset.v; S.planPre = $('#pl-iid').value; S.rebuild(); };
actions.pladd = async el => { el.disabled = true; const r = await act({ type: 'plan', iid: $('#pl-iid').value, amt: parseNum($('#pl-amt').value), freq: S.plFreq || 'm', day: +$('#pl-day').value }); if (!r.ok) el.disabled = false; };
actions.plrm = async el => { const id = +el.dataset.v; if (S.confirmPlan !== id) { S.confirmPlan = id; update(); return; } S.confirmPlan = null; await act({ type: 'unplan', id }); };
actions.ocancel = async el => { el.disabled = true; await act({ type: 'cancel', id: +el.dataset.v }); };
inputs['d-amt'] = () => depPrev();
inputs['fx-amt'] = () => fxPrev();
changes['fx-from'] = el => { S.fxFrom = el.value; if (el.value !== 'EUR') { $('#fx-to').value = 'EUR'; S.fxTo = 'EUR'; } fxPrev(); };
changes['fx-to'] = el => { S.fxTo = el.value; if (el.value !== 'EUR') { $('#fx-from').value = 'EUR'; S.fxFrom = 'EUR'; } fxPrev(); };
