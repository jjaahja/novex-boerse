// Ventures: das eigene Startup – Gründung, Unit Economics, Hyperscaling, Markt-Duell, Inbox, Cap Table, C-Suite, Finanzierung, Börsengang, CEO
import { S, E, esc, sc, pctS, signE, parseNum, act, actions, inputs, changes, $ } from '../store.js';
import { info } from '../glossary.js';
import { drawBars } from '../chart.js';
import { openReview } from './order.js';
const { fmt, fmtE, fmtBig, BIZ_MODELS, VENTURE_STAGES, VENTURE_MIN, EXECS, EXEC_PAY, EXEC_ESOP, CAMPAIGNS, SECTORS } = E;
const pctx = (v, d = 0) => fmt(v * 100, d) + ' %';
const big = v => Math.abs(v) >= 1e7 ? fmtBig(v) + ' €' : fmtE(v, 0); // große Beträge kompakt

const modeOf = v => !v || v.status === 'failed' || v.status === 'exited' ? 'found' : v.status === 'public_listed' ? 'ceo' : 'run';
export function render() {
  const v = S.A.venture; S.vMode = modeOf(v);
  if (!v || v.status === 'failed' || v.status === 'exited') return foundHTML(v);
  if (v.status === 'public_listed') return ceoHTML(v);
  return `<div class="grid2"><div class="stack" style="gap:0">
    <div id="v-head"></div>
    <section class="sec"><h2>Unit Economics</h2><div class="lines" id="v-unit"></div></section>
    <section class="sec" id="v-hyp-sec"><h2>Wachstum ${info('hyper')}</h2><div id="v-hyp"></div></section>
    <section class="sec"><h2>Strategie</h2><div id="v-strat"></div></section>
    <section class="sec"><h2>Markt-Duell ${info('segment')}</h2><div id="v-duel"></div></section>
    <section class="sec"><h2>Board-Berichte</h2><canvas class="bars" id="v-bars" aria-label="ARR je Quartal"></canvas><div class="tbl" id="v-q" style="margin-top:8px"></div></section>
  </div><aside class="stack">
    <section class="sec" style="border-top:0;padding-top:0"><h2>Entscheidungen</h2><div id="v-inbox"></div></section>
    <section class="sec"><h2>Finanzierung</h2><div id="v-fund"></div></section>
    <section class="sec"><h2>Cap Table ${info('captable')}</h2><div id="v-cap"></div></section>
    <section class="sec"><h2>Führungsteam</h2><div id="v-exec"></div></section>
    <section class="sec" id="v-ipo-sec" hidden><h2>Börsengang ${info('ipo')}</h2><div id="v-ipo"></div></section>
  </aside></div>`;
}
export function update() {
  const v = S.A.venture;
  if (modeOf(v) !== S.vMode) { S.rebuild(); return; } // Gründung, Börsengang, Exit oder Insolvenz: andere Ansicht
  if (!v || v.status !== 'private_startup') { if (v && v.status === 'public_listed') ceoUpdate(v); else foundUpdate(); return; }
  const m = E.vm(v), u = E.unit(v), st = E.vstage(v), V = E.valuation(v), rw = E.runway(v), mine = E.founderPct(v) * V;
  const left = Math.max(0, st.qd - v.day);
  $('#v-head').innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px"><div><span class="label">${esc(m.name)} · ${esc(SECTORS[m.sector])}</span><h1 class="h1" style="margin:2px 0 0">${esc(v.name)}</h1></div>
      <div style="text-align:right"><span class="pill ${v.stage >= 3 ? 'ok' : 'n'}">${esc(st.name)}</span><div class="small fg2" style="margin-top:4px">Board-Meeting in ${left} Handelstag${left === 1 ? '' : 'en'} · ${E.vm(v).hyper ? 'hyperscale-fähig' : 'wächst über CapEx'}</div></div></div>
    <div class="figs"><div><span class="label">ARR ${info('arr')}</span><b>${big(v.arr)}</b><span class="small fg2">MRR ${big(v.arr / 12)}</span></div>
      <div><span class="label">Firmenkasse ${info('runway')}</span><b class="${v.cash < 0 ? 'dn' : ''}">${big(v.cash)}</b><span class="small ${rw < 6 ? 'dn' : 'fg2'}">${isFinite(rw) ? `Runway ${fmt(rw, 0)} Monate` : 'profitabel'}</span></div>
      <div><span class="label">Bewertung</span><b>${big(V)}</b><span class="small fg2">dein Anteil ${pctx(E.founderPct(v), 1)}</span></div>
      <div><span class="label">Im Nettovermögen ${info('liqdisc')}</span><b>${big(mine * st.liq)}</b><span class="small fg2">${pctx(st.liq)} angerechnet</span></div></div>
    ${v.cash < 0 ? `<div class="alert" style="margin-top:14px"><div class="t"><b>Die Kasse ist leer</b>Lege Kapital ein oder nimm eine Finanzierungsrunde an – nach drei Quartalen im Minus ist ${esc(v.name)} insolvent.</div></div>` : rw < 6 ? `<div class="alert amb" style="margin-top:14px"><div class="t"><b>Runway unter 6 Monaten</b>Plane jetzt die nächste Finanzierung oder senke das Tempo.</div></div>` : ''}`;
  const ltvTone = u.ratio >= 3 ? 'up' : u.ratio >= 1 ? 'amb' : 'dn';
  $('#v-unit').innerHTML = `<div><span>Product-Market Fit ${info('pmf')}</span><b style="min-width:160px"><span class="meter" style="display:block;margin-bottom:4px"><i class="${v.pmf >= 0.8 ? 'ok' : v.pmf >= 0.5 ? 'warn' : 'crit'}" style="width:${(v.pmf * 100).toFixed(0)}%"></i></span>${pctx(v.pmf)}</b></div>
    <div><span>Kunden</span><b>${fmt(v.customers, v.customers < 100 ? 1 : 0)}</b></div>
    <div><span>Kundenakquisekosten (CAC) ${info('cac')}</span><b>${fmtE(u.cac, 0)}</b></div>
    <div><span>Kundenwert (LTV) ${info('ltv')}</span><b>${fmtE(u.ltv, 0)}</b></div>
    <div><span>LTV / CAC ${info('ltvcac')}</span><b class="${ltvTone}">${fmt(u.ratio, 1)}</b></div>
    <div><span>Abwanderung pro Quartal ${info('churn')}</span><b class="${u.churn > 0.12 ? 'dn' : ''}">${pctx(u.churn, 1)}</b></div>
    <div><span>Bruttomarge ${info('margcost')}</span><b>${pctx(u.gm)}</b></div>
    <div><span>Burn Rate ${info('burn')}</span><b>${E.burnM(v) > 0 ? fmtE(E.burnM(v), 0) + ' / Monat' : 'kein Burn'}</b></div>
    <div><span>Produktqualität</span><b class="${v.quality < 0.8 ? 'amb' : ''}">${pctx(Math.min(1, v.quality))}</b></div>`;
  // Wachstum: Hyperscaling oder Kapazität
  if (m.hyper) {
    const ready = E.hyperReady(v), on = v.hyper.on;
    $('#v-hyp').innerHTML = `<div class="setting" style="border:0;padding:0"><div class="t"><b>Hyperscaling ${on ? '<span class="pill ' + (ready ? 'ok' : 'crit') + '">' + (ready ? 'aktiv' : 'Premature Scaling') + '</span>' : ''}</b><small>Verdreifacht das Marketingbudget. ${m.why}</small></div><button class="toggle ${on ? 'on' : ''}" data-a="vhyper" aria-pressed="${on}" aria-label="Hyperscaling"></button></div>
      <div class="lines" style="margin-top:8px"><div><span>PMF ≥ 80 %</span><b class="${v.pmf >= 0.8 ? 'up' : 'dn'}">${v.pmf >= 0.8 ? 'erfüllt' : pctx(v.pmf)}</b></div><div><span>LTV / CAC ≥ 3</span><b class="${u.ratio >= 3 ? 'up' : 'dn'}">${u.ratio >= 3 ? 'erfüllt' : fmt(u.ratio, 1)}</b></div><div><span>Marktanteil für Netzwerkeffekt ${info('network')}</span><b>${pctx(u.share, 1)} / 20 %</b></div></div>
      ${on && !ready ? `<p class="warn" style="margin-top:8px">Premature Scaling ${info('premature')}: Kunden springen sofort wieder ab, die Runway schmilzt.</p>` : ''}`;
  } else {
    const cap = E.capacity(v), sub = m.subsidy && E.M.mac && E.M.mac.stim > 0.3;
    $('#v-hyp').innerHTML = `<p class="note" style="margin:0 0 8px">${esc(m.why)} ${info('capex')}</p>
      <div class="lines"><div><span>Kapazität (Stufe ${v.cap.level})</span><b>${fmt(v.customers, 0)} / ${fmt(cap, 0)} Kunden</b></div>
      ${v.trial ? `<div><span>Studie</span><b>${v.trial.phase >= 4 ? 'zugelassen' : `${esc(E.TRIAL[v.trial.phase].name)} · ${pctx(Math.min(1, v.trial.prog))}`}</b></div>` : ''}
      <div><span>Burggraben ${info('moat')}</span><b>${m.moat >= 0.7 ? 'tief' : 'mittel'}</b></div></div>
      <div style="margin-top:10px"><span class="meter"><i class="${v.customers / cap > 0.85 ? 'warn' : 'ok'}" style="width:${Math.min(100, v.customers / cap * 100).toFixed(0)}%"></i></span></div>
      <button class="btn sm ${v.customers / cap > 0.7 ? '' : 'ghost'}" style="margin-top:10px" data-a="vcap" ${v.cap.building ? 'disabled' : ''}>${v.cap.building ? `Ausbau läuft (${v.cap.qLeft} Quartal${v.cap.qLeft > 1 ? 'e' : ''})` : `Kapazität ausbauen · ${fmtE(E.capCost(v), 0)}${sub ? ' (gefördert)' : ''}`}</button>`;
  }
  // Strategie
  $('#v-strat').innerHTML = `<div class="stack" style="gap:10px"><div><span class="label">Tempo (Anteil der Kasse fürs Wachstum je Quartal)</span><div class="seg" style="margin-top:6px">${[['lean', 'Schlank'], ['normal', 'Ausgewogen'], ['aggressive', 'Aggressiv']].map(([k, l]) => `<button data-a="vset" data-f="growth" data-v="${k}" class="${v.growth === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div><span class="label">Preismodell</span><div class="seg" style="margin-top:6px">${Object.entries(E.PRICE).map(([k, p]) => `<button data-a="vset" data-f="price" data-v="${k}" class="${v.price === k ? 'on' : ''}">${p.name}</button>`).join('')}</div></div>
    <label class="field"><span>Budget-Aufteilung: <b id="v-rdv">${pctx(v.rd)} F&E</b> · ${pctx(1 - v.rd)} Vertrieb</span><input type="range" id="v-rd" min="0" max="100" step="5" value="${Math.round(v.rd * 100)}"></label>
    <div class="row2"><label class="field"><span>Gründergehalt je Quartal</span><input class="inp" id="v-sal" inputmode="decimal" value="${fmt(v.salary || 0, 0)}"></label><label class="field"><span>Kapital einlegen ${info('credit')}</span><input class="inp" id="v-amt" inputmode="decimal" placeholder="z. B. 2.000"></label></div>
    <div class="btns"><button class="btn sm ghost" data-a="vsal">Gehalt speichern</button><button class="btn sm" data-a="vfund">Einlegen</button></div>
    <p class="note" style="margin:0">Einlagen kosten keine Anteile. Reicht dein Guthaben nicht, nutzt du deinen Wertpapierkredit – das Depot wird zur Gründer-Finanzierung.</p></div>`;
  // Markt-Duell
  const T = E.segTAM(v);
  const rows = v.rivals.map(id => E.I(id)).filter(Boolean).map(x => { const pr = E.rivalProfile(x); return `<div><span style="display:block"><button class="link" data-go="i-${x.id}">${esc(x.name)}</button><small class="fg2" style="display:block">${esc(pr.name)} – ${esc(pr.desc)}</small></span><b style="white-space:nowrap">${pctx((1 - u.share) * (v.w[x.id] || 0), 1)}${v.lost[x.id] ? `<small class="dn" style="display:block;font-weight:400">−${fmt(v.lost[x.id] * 100, 1)} Pp an euch</small>` : ''}</b></div>`; }).join('');
  $('#v-duel').innerHTML = `<div class="lines"><div><span>Marktsegment (TAM)</span><b>${big(T)}</b></div><div><span><b>${esc(v.name)}</b></span><b class="up">${pctx(u.share, 2)}</b></div>${rows}</div>
    <div class="row2" style="margin-top:12px"><label class="field"><span>Kampagne gegen</span><select class="inp" id="v-riv">${v.rivals.map(id => `<option value="${id}">${esc(E.I(id) ? E.I(id).name : id)}</option>`).join('')}</select></label><span></span></div>
    <div class="btns" style="margin-top:8px">${Object.entries(CAMPAIGNS).map(([k, c]) => `<button class="btn sm ghost" data-a="vcamp" data-v="${k}" title="${esc(c.desc)}">${esc(c.name)}</button>`).join('')}</div>`;
  // Board-Berichte
  const q = v.q.slice(-8);
  drawBars($('#v-bars'), q.map((r, i) => ({ label: r.q.replace(' J', '/'), a: i ? q[i - 1].arr / 1e3 : r.arr / 1e3, b: r.arr / 1e3, good: !i || r.arr >= q[i - 1].arr })), { fmt: x => x >= 1000 ? fmt(x / 1000, 1) + 'M' : fmt(x, 0) + 'k' });
  $('#v-q').innerHTML = q.length ? `<table><thead><tr><th>Quartal</th><th>Umsatz</th><th>EBIT</th><th>Kasse</th><th class="hide-m">PMF</th><th class="hide-m">Board</th></tr></thead><tbody>${q.slice().reverse().map(r => `<tr><td>${esc(r.q)}</td><td>${fmtBig(r.rev)} €</td><td class="${sc(r.ebit)}">${fmtBig(r.ebit)} €</td><td>${fmtBig(r.cash)} €</td><td class="hide-m">${pctx(r.pmf)}</td><td class="hide-m">${fmt(r.board, 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="note">Das erste Board-Meeting kommt nach dem ersten Quartal.</p>';
  inboxUpdate(v); fundUpdate(v); capUpdate(v); execUpdate(v); ipoUpdate(v);
}
function inboxUpdate(v) {
  $('#v-inbox').innerHTML = v.inbox.length ? v.inbox.map(it => `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><b>${esc(it.title)}</b><p class="note" style="margin:4px 0 8px">${esc(it.text)}</p>
      ${it.opts ? `<div class="stack" style="gap:6px">${it.opts.map(o => `<button class="btn sm ${o.k === it.opts[it.def].k ? 'ghost' : 'ghost'}" style="text-align:left" data-a="vdec" data-id="${it.id}" data-v="${o.k}">${esc(o.label)}${o.desc ? `<small class="fg2" style="display:block;font-weight:400">${esc(o.desc)}</small>` : ''}</button>`).join('')}</div><p class="small fg2" style="margin:6px 0 0">Ohne Antwort gilt nach zwei Quartalen: ${esc(it.opts[it.def].label)}</p>` : `<button class="btn sm ghost" data-a="vdec" data-id="${it.id}" data-v="">Gelesen</button>`}</div>`).join('')
    : '<p class="note" style="margin:0">Keine offenen Entscheidungen. Das Tagesgeschäft läuft auf Autopilot.</p>';
}
function fundUpdate(v) {
  const next = E.VC_ROUNDS.find(r => !v.rounds.includes(r.k));
  $('#v-fund').innerHTML = `<div class="lines"><div><span>Eingelegt</span><b>${fmtE(v.invested, 0)}</b></div><div><span>Finanzierungsrunden</span><b>${v.rounds.length ? v.rounds.map(r => E.VC_ROUNDS.find(x => x.k === r).name).join(', ') : 'keine'}</b></div>
    ${next ? `<div><span>Nächste Runde (${next.name}) ${info('termsheet')}</span><b>${E.vm(v).trial ? 'nach Studienfortschritt' : `ab ${fmtE(next.arr * (E.vm(v).hyper ? 1 : 0.6), 0)} ARR`}</b></div>` : ''}
    ${v.target ? `<div><span>Ziel der Investoren</span><b class="amb">${fmtE(v.target.arr, 0)} ARR bis Quartal ${v.target.q + 1}</b></div>` : ''}</div>`;
}
function capUpdate(v) {
  const rows = [['Du (Gründer)', v.capt.founder], ['Mitarbeiter (ESOP) ' + info('esop'), v.capt.esop], ...v.capt.inv.map(i => [`${esc(i.name)} · ${esc(i.round)}`, i.pct])].filter(r => r[1] > 0);
  $('#v-cap').innerHTML = `<div class="lines">${rows.map(([n, p]) => `<div><span>${n}</span><b>${pctx(p, 1)}</b></div>`).join('')}</div><div class="meter" style="margin-top:8px;display:flex;overflow:hidden">${rows.map(([, p], i) => `<i style="width:${(p * 100).toFixed(1)}%;border-radius:0;background:${i === 0 ? 'var(--fg)' : i === 1 ? 'var(--fg2)' : 'var(--line2)'}"></i>`).join('')}</div><p class="note" style="margin-top:8px">Verwässerung ${info('dilution')}: Jede Runde gibt Anteile ab – dafür wächst die Bewertung.</p>`;
}
function execUpdate(v) {
  const pay = EXEC_PAY[Math.min(v.stage, 3)];
  $('#v-exec').innerHTML = Object.entries(EXECS).map(([role, R]) => { const e = v.execs[role], a = e && R.a.find(x => x.k === e.k);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><span class="label">${esc(R.name)}</span>${a ? `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span><b>${esc(a.name)}</b><small class="fg2" style="display:block">${esc(a.desc)} ${e.esop ? '· ESOP' : `· ${fmtE(pay * a.pay, 0)} / Quartal`}</small></span><button class="btn sm ghost" data-a="vfire" data-v="${role}">Entlassen</button></div>`
      : `<div class="stack" style="gap:6px;margin-top:4px">${R.a.map(x => `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="flex:1;min-width:150px"><b style="font-weight:500">${esc(x.name)}</b><small class="fg2" style="display:block">${esc(x.desc)}</small></span><button class="btn sm ghost" data-a="vhire" data-r="${role}" data-v="${x.k}">${fmtE(pay * x.pay, 0)}/Q</button><button class="btn sm ghost" data-a="vhire" data-r="${role}" data-v="${x.k}" data-esop="1">${pctx(EXEC_ESOP)} ESOP</button></div>`).join('')}</div>`}</div>`; }).join('');
}
function ipoUpdate(v) {
  const sec = $('#v-ipo-sec'); sec.hidden = v.stage < 3; if (sec.hidden) return;
  const U = S.UI, disc = U.vDisc ?? 0.1, float = U.vFloat ?? 0.25, lock = U.vLock ?? 60, q = E.vIpoQuote(v, disc, float);
  const busy = document.activeElement && sec.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
  if (busy) { $('#v-ipo-prev').innerHTML = ipoLines(q, float); return; }
  $('#v-ipo').innerHTML = `<p class="note" style="margin:0 0 8px">${esc(v.name)} ist börsenreif. Mit der Börsenglocke wird das Startup eine normale Aktie – deine Anteile liegen danach im Depot.</p>
    <label class="field"><span>Abschlag auf die Bewertung: <b id="v-dv">${pctx(disc)}</b></span><input type="range" id="v-disc" min="0" max="20" value="${Math.round(disc * 100)}"></label>
    <label class="field"><span>Free Float (neue Aktien): <b id="v-fv">${pctx(float)}</b></span><input type="range" id="v-float" min="15" max="40" value="${Math.round(float * 100)}"></label>
    <div><span class="label">Lock-up ${info('lockup')}</span><div class="seg" style="margin-top:6px">${[30, 60, 90].map(d => `<button data-a="vlock" data-v="${d}" class="${lock === d ? 'on' : ''}">${d} Tage</button>`).join('')}</div></div>
    <div class="lines" id="v-ipo-prev" style="margin-top:10px">${ipoLines(q, float)}</div><button class="btn" style="margin-top:10px" data-a="vipo">Börsengang prüfen</button>`;
}
const ipoLines = (q) => `<div><span>Emissionspreis</span><b>${fmt(q.P, 2)} €</b></div><div><span>Börsenwert</span><b>${fmtE(q.P * q.shares, 0)}</b></div><div><span>Erlös für die Firmenkasse</span><b>${fmtE(q.raise, 0)}</b></div><div><span>Deine Aktien</span><b>${fmtE(q.after, 0)}</b></div><div><span>Neubewertung im Nettovermögen ${info('liqdisc')}</span><b class="${sc(q.reval)}">${signE(q.reval, 0)}</b></div>`;
function ipoRefresh() { const U = S.UI; U.vDisc = +$('#v-disc').value / 100; U.vFloat = +$('#v-float').value / 100; $('#v-dv').textContent = pctx(U.vDisc); $('#v-fv').textContent = pctx(U.vFloat); $('#v-ipo-prev').innerHTML = ipoLines(E.vIpoQuote(S.A.venture, U.vDisc, U.vFloat)); }
inputs['v-disc'] = ipoRefresh; inputs['v-float'] = ipoRefresh;
inputs['v-rd'] = el => { $('#v-rdv').textContent = el.value + ' % F&E'; };
changes['v-rd'] = el => act({ type: 'vset', rd: +el.value / 100 });

/* ---------- Gründung ---------- */
function foundHTML(v) {
  const prev = v ? (v.status === 'failed' ? `<div class="alert" style="margin-bottom:16px"><div class="t"><b>${esc(v.name)} ist insolvent</b>Die Beteiligung ist verloren, Schulden bleiben dir nicht. Gründe neu – mit dem Wissen von heute.</div></div>` : `<div class="alert amb" style="margin-bottom:16px"><div class="t"><b>${esc(v.name)} wurde verkauft</b>Exit für ${fmtE(v.exitPrice || 0, 0)} – dein Anteil: ${fmtE(v.exitMine || 0, 0)}.</div></div>`) : '';
  return `<div class="stack" style="gap:16px"><div><h1 class="h1">Ventures</h1><p class="lead" style="margin:6px 0 0">Gründe dein eigenes Startup, kämpfe um Marktanteile gegen die Börsenkonzerne und bring es an die Börse. Den Rest deines Geldes handelst du parallel weiter.</p></div>${prev}
    <div class="mgrid" id="v-models"></div>
    <div class="grid2"><div class="stack"><div class="row2"><label class="field"><span>Name deines Startups</span><input class="inp" id="v-name" maxlength="28" placeholder="z. B. Nimbus AI"></label><label class="field"><span>Startkapital (ab ${fmtE(VENTURE_MIN, 0)})</span><input class="inp" id="v-start" inputmode="decimal" value="4.000"></label></div>
      <div class="lines" id="v-fprev"></div><button class="btn" data-a="vfound">Gründung prüfen</button></div>
      <aside><p class="note">Im Nettovermögen zählt dein Startup mit Abschlag ${info('liqdisc')}: 60 % in der Garage, 75 % in der Traction-Phase, 85 % im Scale-Up – erst nach dem Börsengang voll. Empfehlung: 3.000–5.000 € gründen, den Rest weiter an der Börse anlegen.</p></aside></div></div>`;
}
function foundUpdate() {
  const sel = S.UI.vModel || 'saas';
  $('#v-models').innerHTML = Object.entries(BIZ_MODELS).map(([k, m]) => `<div style="cursor:pointer;${sel === k ? 'outline:2px solid var(--fg);outline-offset:-2px;border-radius:10px;padding-left:12px' : ''}" data-a="vmodel" data-v="${k}" role="button" tabindex="0" aria-pressed="${sel === k}">
      <span class="label">${esc(SECTORS[m.sector])} · <span class="pill ${m.hyper ? 'ok' : 'n'}">${m.hyper ? 'Hyperscaling möglich' : 'wächst über CapEx'}</span></span><b style="font-size:16px">${esc(m.name)}</b><span class="small fg2">${esc(m.sub)}</span>
      <span class="small" style="margin-top:6px"><span class="up">+</span> ${esc(m.pro)}</span><span class="small"><span class="dn">−</span> ${esc(m.con)}</span><span class="small fg2" style="margin-top:4px">${esc(m.why)}</span>
      <span class="small fg2" style="margin-top:4px">Gegner: ${E.rivalsOf(m.sector).map(x => esc(x.name)).join(', ')}</span></div>`).join('');
  const amt = parseNum(($('#v-start') || {}).value), av = E.availCash(S.A, undefined, true);
  if ($('#v-fprev')) $('#v-fprev').innerHTML = `<div><span>Verfügbares Guthaben</span><b>${fmtE(av, 0)}</b></div><div><span>Bleibt zum Handeln</span><b class="${av - amt < 0 ? 'dn' : ''}">${fmtE(av - (amt || 0), 0)}</b></div><div><span>Anrechnung im Nettovermögen anfangs</span><b>${fmtE((amt || 0) * 0.6, 0)} (60 %)</b></div>`;
}
inputs['v-start'] = () => foundUpdate();
actions.vmodel = el => { S.UI.vModel = el.dataset.v; foundUpdate(); };
actions.vfound = () => {
  const model = S.UI.vModel || 'saas', m = BIZ_MODELS[model], name = ($('#v-name').value || '').trim(), amt = parseNum($('#v-start').value);
  if (name.length < 2) { S.toast('Bitte gib deinem Startup einen Namen.', 'dn'); return; }
  const reset = S.A.venture ? () => act({ type: 'vreset' }, true) : () => Promise.resolve({ ok: true });
  openReview({ title: `${name} gründen`, lines: [['Geschäftsmodell', esc(m.name)], ['Hyperscaling', m.hyper ? 'möglich' : 'nein – Wachstum über Kapazität'], ['Startkapital', fmtE(amt, 0)], ['Anfangs im Nettovermögen', fmtE(amt * 0.6, 0) + ' (60 %)']], warn: `Das Geld wandert vom Verrechnungskonto in die Firmenkasse. Bis zum Börsengang ist es nicht frei verfügbar. ${m.why}`, confirm: 'Gründen', run: async () => { const r = await reset(); if (!r.ok) return r; return act({ type: 'vfound', model, name, amt }, true); } });
};

/* ---------- Aktionen im laufenden Betrieb ---------- */
actions.vhyper = el => { const v = S.A.venture, on = !v.hyper.on; if (on && !E.hyperReady(v)) { openReview({ title: 'Hyperscaling trotzdem zünden?', lines: [['PMF', pctx(v.pmf)], ['LTV / CAC', fmt(E.unit(v).ratio, 1)]], warn: 'Die Voraussetzungen (PMF ≥ 80 %, LTV/CAC ≥ 3) sind nicht erfüllt. Das ist Premature Scaling: Die gewonnenen Kunden springen schnell wieder ab, die Kasse leert sich.', confirm: 'Trotzdem skalieren', run: () => act({ type: 'vhyper', on: true }, true) }); return; } el.disabled = true; act({ type: 'vhyper', on }); };
actions.vset = el => act({ type: 'vset', [el.dataset.f]: el.dataset.v });
actions.vsal = () => act({ type: 'vset', salary: parseNum($('#v-sal').value) || 0 });
actions.vfund = () => { const amt = parseNum($('#v-amt').value); if (!(amt > 0)) { S.toast('Bitte einen Betrag eingeben.', 'dn'); return; } const own = Math.max(0, S.A.cash); openReview({ title: 'Kapital einlegen', lines: [['Betrag', fmtE(amt, 0)], ['Aus Guthaben', fmtE(Math.min(own, amt), 0)], ['Über Wertpapierkredit', fmtE(Math.max(0, amt - own), 0)]], warn: amt > own ? 'Ein Teil wird über deinen Wertpapierkredit finanziert. Fallen deine Aktien, droht ein Margin Call.' : 'Keine Verwässerung – du behältst alle Anteile.', confirm: 'Einlegen', run: () => act({ type: 'vfund', amt }, true) }); };
actions.vcap = () => act({ type: 'vcap' });
actions.vcamp = el => { const k = el.dataset.v, rival = $('#v-riv').value, C = CAMPAIGNS[k]; openReview({ title: C.name, lines: [['Gegen', esc(E.I(rival).name)], ['Kosten', fmtE(Math.max(2000, S.A.venture.cash * C.cost), 0)]], warn: C.desc, confirm: 'Kampagne starten', run: () => act({ type: 'vcamp', k, rival }, true) }); };
actions.vdec = el => act({ type: 'vdecide', id: +el.dataset.id, opt: el.dataset.v });
actions.vhire = el => act({ type: 'vhire', role: el.dataset.r, k: el.dataset.v, esop: !!el.dataset.esop });
actions.vfire = el => act({ type: 'vfire', role: el.dataset.v });
actions.vlock = el => { S.UI.vLock = +el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); };
actions.vipo = () => { const v = S.A.venture, U = S.UI, disc = U.vDisc ?? 0.1, float = U.vFloat ?? 0.25, lock = U.vLock ?? 60, q = E.vIpoQuote(v, disc, float);
  openReview({ title: `Börsengang ${v.name}`, lines: [['Emissionspreis', fmt(q.P, 2) + ' €'], ['Free Float', pctx(float)], ['Lock-up', lock + ' Handelstage'], ['Erlös für die Firma', fmtE(q.raise, 0)], ['Deine Aktien zum Emissionspreis', fmtE(q.after, 0)], ['Neubewertung im Nettovermögen', signE(q.reval, 0)]], warn: 'Danach ist dein Unternehmen eine normale Aktie: Chart, Quartalszahlen, Stop-Orders und Beleihung (55 %) funktionieren wie bei jedem Wert. Während des Lock-ups kannst du nicht verkaufen.', confirm: 'Börsenglocke läuten', run: () => act({ type: 'vipo', disc, float, lock }, true) }); };

/* ---------- Nach dem Börsengang: CEO ---------- */
function ceoHTML(v) {
  return `<div class="grid2"><div class="stack" style="gap:0"><div id="c-head"></div>
    <section class="sec"><h2>Nächste Quartalszahlen ${info('guidance2')}</h2><div id="c-guid"></div></section>
    <section class="sec"><h2>Geschäft</h2><div class="lines" id="c-biz"></div></section>
  </div><aside class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Kapital an Aktionäre</h2><div id="c-cap"></div></section>
    <section class="sec"><h2>Entscheidungen</h2><div id="v-inbox"></div></section></aside></div>`;
}
function ceoUpdate(v) {
  const x = E.I(v.listedId); if (!x) return; const p = S.A.pos[x.id], u = E.unit(v);
  $('#c-head').innerHTML = `<span class="label">CEO · börsennotiert als ${esc(x.id)}</span><h1 class="h1" style="margin:2px 0 12px">${esc(v.name)}</h1>
    <div class="figs"><div><span class="label">Aktienkurs</span><b>${fmt(x.price, 2)} €</b><span class="small ${sc(E.chg(x))}">${pctS(E.chg(x))} heute</span></div><div><span class="label">Börsenwert</span><b>${big(x.price * x.shares)}</b><span class="small fg2">${fmt(x.shares / 1e6, 1)} Mio. Aktien</span></div>
      <div><span class="label">Deine Aktien</span><b>${p ? big(p.qty * x.price) : '–'}</b><span class="small fg2">${p ? pctx(p.qty / x.shares, 1) : ''}${p && p.lock > E.M.t ? ` · Lock-up bis ${E.fDate(p.lock)}` : ''}</span></div><div><span class="label">Firmenkasse</span><b>${big(v.cash)}</b></div></div>
    <div class="btns" style="margin-top:12px"><button class="btn sm ghost" data-go="i-${x.id}">Zur Aktie (Chart, Zahlen, Stop-Orders)</button></div>`;
  const sugRev = v.arr / 4, last = v.q[v.q.length - 1], sugEps = last ? last.ebit * 0.75 / x.shares : 0;
  const busy = document.activeElement && ['c-rev', 'c-eps', 'c-bb', 'c-dv'].includes(document.activeElement.id);
  if (!busy) {
    $('#c-guid').innerHTML = `<div class="lines"><div><span>Termin</span><b>${E.fDate(x.fin.next, true)}</b></div>${v.guid ? `<div><span>Deine Guidance</span><b>${fmtBig(v.guid.rev)} € · ${fmt(v.guid.eps, 2)} € je Aktie</b></div>` : '<div><span>Deine Guidance</span><b class="amb">noch keine – es zählt die Analystenerwartung</b></div>'}</div>
      <div class="row2" style="margin-top:10px"><label class="field"><span>Umsatz im Quartal</span><input class="inp" id="c-rev" inputmode="decimal" value="${fmt(sugRev * 0.95, 0)}"></label><label class="field"><span>Gewinn je Aktie</span><input class="inp" id="c-eps" inputmode="decimal" value="${fmt(sugEps * 0.9, 3)}"></label></div>
      <p class="note">Vorschlag aus der aktuellen Laufrate, leicht vorsichtig. Übertriffst du deine Prognose, steigt der Kurs.</p><button class="btn sm" data-a="cguid">Guidance veröffentlichen</button>`;
    $('#c-cap').innerHTML = `<label class="field"><span>Aktienrückkauf aus der Firmenkasse</span><input class="inp" id="c-bb" inputmode="decimal" placeholder="Betrag"></label><button class="btn sm ghost" style="margin-top:6px" data-a="cbb">Zurückkaufen</button>
      <label class="field" style="margin-top:12px"><span>Sonderdividende</span><input class="inp" id="c-dv" inputmode="decimal" placeholder="Betrag"></label><button class="btn sm ghost" style="margin-top:6px" data-a="cdv">Ausschütten</button>
      <p class="note" style="margin-top:10px">Rivalen übernehmen: Kaufe 5 % an der Börse und gib in der Detailansicht ein Übernahmeangebot ab.</p>`;
  }
  $('#c-biz').innerHTML = `<div><span>ARR</span><b>${fmtE(v.arr, 0)}</b></div><div><span>Kunden</span><b>${fmt(v.customers, 0)}</b></div><div><span>Marktanteil</span><b>${pctx(u.share, 1)}</b></div><div><span>LTV / CAC</span><b>${fmt(u.ratio, 1)}</b></div><div><span>Bruttomarge</span><b>${pctx(u.gm)}</b></div>`;
  inboxUpdate(v);
}
actions.cguid = () => act({ type: 'vguid', rev: parseNum($('#c-rev').value), eps: parseNum($('#c-eps').value) });
actions.cbb = () => { const amt = parseNum($('#c-bb').value); openReview({ title: 'Aktienrückkauf', lines: [['Betrag', fmtE(amt, 0)]], warn: 'Weniger Aktien, mehr Gewinn je Aktie. Der Kauf bewegt den Kurs.', confirm: 'Zurückkaufen', run: () => act({ type: 'vbuyback', amt }, true) }); };
actions.cdv = () => { const amt = parseNum($('#c-dv').value); openReview({ title: 'Sonderdividende', lines: [['Betrag', fmtE(amt, 0)]], warn: 'Alle Aktionäre – auch du – erhalten ihren Anteil. Die Firmenkasse sinkt.', confirm: 'Ausschütten', run: () => act({ type: 'vdiv', amt }, true) }); };
