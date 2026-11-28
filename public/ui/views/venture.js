// Ventures: das eigene Startup – Strategy War Room mit Prognose-Korridoren, Firmen-Puls, Gründer-Sprints, Markt-Duell, Verhandlungen, Börsengang, CEO
// Alle Regler, Vorschauen und Verhandlungen rechnen lokal im Browser (gleiches Modul wie im Worker). Erst „Kurs setzen“ bzw. „Starten“ schickt eine Aktion.
import { S, E, esc, sc, pctS, signE, parseNum, act, actions, inputs, changes, $ } from '../store.js';
import { info, tip } from '../glossary.js';
import { drawBars } from '../chart.js';
import { openReview, refreshReview } from './order.js';
const { fmt, fmtE, fmtBig, BIZ_MODELS, VENTURE_STAGES, VENTURE_MIN, EXECS, EXEC_PAY, EXEC_ESOP, CAMPAIGNS, SECTORS } = E;
const pctx = (v, d = 0) => fmt(v * 100, d) + ' %';
const big = v => Math.abs(v) >= 1e7 ? fmtBig(v) + ' €' : fmtE(v, 0); // große Beträge kompakt
const kE = v => Math.abs(v) >= 1e6 ? fmtBig(v) + ' €' : Math.abs(v) >= 1e4 ? fmt(v / 1000, 0) + 'k €' : fmtE(v, 0);
const sgn = (x, d = 0) => (x > 0 ? '+' : x < 0 ? '−' : '±') + fmt(Math.abs(x) * 100, d) + ' %';
const pp = x => (x > 0 ? '+' : x < 0 ? '−' : '±') + fmt(Math.abs(x) * 100, Math.abs(x) < 0.01 ? 1 : 0) + ' Pkt.';
const phi = z => 1 / (1 + Math.exp(-1.702 * z)); // Normalverteilung (Näherung) für Beat-Chancen

const modeOf = v => !v || v.status === 'failed' || v.status === 'exited' ? 'found' : v.status === 'public_listed' ? 'ceo' : 'run';
export function render() {
  const v = S.A.venture; S.vMode = modeOf(v); S.UI.vd = null;
  if (!v || v.status === 'failed' || v.status === 'exited') return foundHTML(v);
  if (v.status === 'public_listed') return ceoHTML(v);
  const tab = S.UI.vTab || 'cockpit', T = (k, html) => `<div data-vtab="${k}" ${tab === k ? '' : 'hidden'}>${html}</div>`;
  return `<div id="v-head"></div>
    <div class="vtabs" role="tablist">${[['cockpit', 'Cockpit & Produkt'], ['market', 'Markt & Rivalen'], ['team', 'Team, Cap Table & Finanzen']].map(([k, l]) => `<button role="tab" data-a="vtab" data-v="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
    ${T('cockpit', `<div class="grid2"><div class="stack" style="gap:0">
      <section class="sec" style="border-top:0"><h2>Nächster Launch ${info('release')}</h2><div id="v-rel"></div></section>
      <section class="sec"><h2>Laufende Maßnahmen ${info('sprint')}</h2><div id="v-clk"></div></section>
      <section class="sec"><h2>Produktbaum ${info('ptree')}</h2><div id="v-tree"></div></section>
      <section class="sec"><h2>Strategy War Room ${info('fcconf')}</h2><div class="vwar" id="v-war"></div></section>
      <section class="sec"><h2>Board-Berichte · Plan vs. Ist ${info('planist')}</h2><canvas class="bars" id="v-bars" aria-label="ARR je Quartal"></canvas><div class="tbl vq" id="v-q" style="margin-top:8px"></div></section>
    </div><aside class="stack">
      <section class="sec" style="border-top:0;padding-top:0"><h2>Hintergrund & Risiken ${info('cyc')}</h2><div id="v-cyc"></div></section>
      <section class="sec"><h2>Firmen-Puls</h2><div id="v-pulse"></div></section>
      <section class="sec"><h2>Unit Economics</h2><div class="lines" id="v-unit"></div></section>
      <section class="sec"><h2>Firmen-Ticker</h2><ul class="vtick" id="v-tick"></ul></section>
    </aside></div>`)}
    ${T('market', `<div class="grid2"><div class="stack" style="gap:0">
      <section class="sec" style="border-top:0"><h2>Markt-Duell ${info('segment')}</h2><div id="v-duel"></div></section>
    </div><aside class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Taktische Züge ${info('focus')}</h2><div id="v-spr"></div></section><section class="sec"><h2>Strategische Beteiligungen ${info('stake')}</h2><div id="v-stake"></div></section></aside></div>`)}
    ${T('team', `<div class="grid2"><div class="stack" style="gap:0">
      <section class="sec" style="border-top:0"><h2 id="v-inbox-h">Entscheidungen</h2><div id="v-inbox"></div></section>
      <section class="sec"><h2>Führungsteam</h2><div id="v-exec"></div></section>
      <section class="sec"><h2>Büro ${info('office')}</h2><div id="v-off"></div></section>
    </div><aside class="stack">
      <section class="sec" style="border-top:0;padding-top:0"><h2>Board & Finanzierung ${info('mandate')}</h2><div id="v-fund"></div></section>
      <section class="sec"><h2>Cap Table ${info('captable')}</h2><div id="v-cap"></div></section>
      <section class="sec" id="v-ipo-sec" hidden><h2>Börsengang ${info('ipo')}</h2><div id="v-ipo"></div></section>
    </aside></div>`)}`;
}
actions.vtab = el => { S.UI.vTab = el.dataset.v; document.querySelectorAll('[data-vtab]').forEach(d => { d.hidden = d.dataset.vtab !== el.dataset.v; }); document.querySelectorAll('.vtabs button').forEach(b => { const on = b.dataset.v === el.dataset.v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); }); update(); };

/* ---------- Fokus-Leiste (mit Vorschau beim Hovern über eine Aktion) ---------- */
const focusBar = v => `<div class="vfoc" id="v-focus"><span>Fokus ${info('focus')}</span><span class="segs">${Array.from({ length: E.FOCUS.max }, (_, i) => `<i class="${i < (v.focus || 0) ? 'on' : ''}"></i>`).join('')}</span><b>${v.focus || 0} / ${E.FOCUS.max}</b><span class="small">+${(v.debt || 0) > 0.5 || (v.moral ?? 1) < 0.4 ? 1 : 2} je Handelstag</span></div>`;
function focusPreview(cost) {
  const box = $("#v-focus"), v = S.A && S.A.venture; if (!box || !v) return; const segs = box.querySelectorAll('.segs i'), f = v.focus || 0;
  segs.forEach((el, i) => { el.classList.toggle('pv', cost > 0 && i < f && i >= f - cost); el.classList.toggle('miss', cost > f && i >= f && i < cost); });
}
document.addEventListener('mouseover', ev => { const t = ev.target.closest && ev.target.closest('[data-fc]'); focusPreview(t ? +t.dataset.fc : 0); const c = ev.target.closest && ev.target.closest('[data-cp]'); document.querySelectorAll('.vclk.hov').forEach(x => { if (!c || x.id !== 'clk-' + c.dataset.cp) x.classList.remove('hov'); }); if (c) { const el = document.getElementById('clk-' + c.dataset.cp); if (el) el.classList.add('hov'); } });
/* ---------- Nächster sinnvoller Schritt (verschwindet, sobald man im Flow ist) ---------- */
function nextStep(v) {
  if (S.UI.vNextOff || (v.flow || 0) >= 3) return '';
  const u = E.unit(v), rw = E.runway(v), node = (v.clk || []).some(c => c.k === 'node'), ti = (v.tree || []).findIndex(x => !x), neg = v.inbox.find(i => i.k === 'vc' || i.k === 'deal');
  let t = '';
  if (v.cash < 0) t = 'Die Kasse ist im Minus: Lege Kapital ein oder nimm eine Finanzierung an (Tab „Team, Cap Table & Finanzen“).';
  else if (neg) t = `Offene Verhandlung: ${neg.title} – im Tab „Team, Cap Table & Finanzen“ in drei Runden verhandeln.`;
  else if ((v.debt || 0) > 0.5) t = `Technische Schuld bei ${pctx(v.debt)}: Ein Refactoring (1 Fokus) senkt Ausfälle und Fixkosten.`;
  else if (ti >= 0 && !node && v.pmf < E.pmfCap(v) + 0.01) t = `PMF liegt bei ${pctx(v.pmf)} und stößt an die Decke von ${pctx(E.pmfCap(v))}: Starte Stufe ${ti + 1} im Produktbaum, bevor du Marketing erhöhst.`;
  else if (rw < 6) t = 'Runway unter 6 Monaten: Senke im War Room Vertrieb oder Effizienz-Kosten oder plane eine Finanzierung.';
  else if (node && (v.focus || 0) >= 4) t = 'Fokus angespart: Beschleunige die laufende Entwicklung mit „+1 Schritt“.';
  return t ? `<div class="vnext" role="note"><span><b>Nächster Schritt:</b> ${esc(t)}</span><button data-a="vnextx" aria-label="Hinweis ausblenden">×</button></div>` : '';
}
actions.vnextx = () => { S.UI.vNextOff = 1; update(); };

// Kompakte Kennzahl mit Balken und Veränderung seit dem letzten Board-Meeting
function kpi(name, term, val, prev, tone) {
  const d = prev === null || prev === undefined ? null : val - prev;
  return `<div><span>${name} ${term ? info(term) : ''}</span><b class="num">${pctx(val)}</b><span class="meter" style="display:block;margin:4px 0 2px"><i class="${tone}" style="width:${(Math.max(0, Math.min(1, val)) * 100).toFixed(0)}%"></i></span><small class="${d === null || Math.abs(d) < 0.005 ? '' : d > 0 ? 'up' : 'dn'}">${d === null ? '&nbsp;' : Math.abs(d) < 0.005 ? '± 0 Pkt. seit Board' : `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d) * 100, 0)} Pkt. seit Board`}</small></div>`;
}
/* ---------- Trend-Badges: Veränderung seit dem letzten Board-Meeting mit Haupttreiber ---------- */
function trend(now, prev, driver) {
  if (!(prev > 0) || !isFinite(now)) return '';
  const d = now / prev - 1; if (Math.abs(d) < 0.005) return `<span class="trend">± 0 % · ${esc(driver)}</span>`;
  return `<span class="trend ${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d) * 100, Math.abs(d) < 0.1 ? 1 : 0)} % · ${esc(driver)}</span>`;
}

export function update() {
  const v = S.A.venture;
  if (modeOf(v) !== S.vMode) { S.rebuild(); return; } // Gründung, Börsengang, Exit oder Insolvenz: andere Ansicht
  if (!v || v.status !== 'private_startup') { if (v && v.status === 'public_listed') ceoUpdate(v); else foundUpdate(); return; }
  const m = E.vm(v), u = E.unit(v), st = E.vstage(v), V = E.valuation(v), rw = E.runway(v), mine = E.founderPct(v) * V;
  const left = Math.max(0, E.qDays(v) - v.day), last = v.q[v.q.length - 1], c = v.cur;
  const arrDrv = c.newC > c.churnC * 1.4 ? 'Neukunden' : c.churnC > c.newC ? 'Abwanderung' : 'Bestand';
  const cashDrv = last && v.cash > last.cash ? (v.rounds.length && last.cash < v.cash * 0.5 ? 'Finanzierung' : 'Überschuss') : 'Burn';
  $('#v-head').innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:14px"><div><span class="label">${esc(m.name)} · ${esc(SECTORS[m.sector])}</span><h1 class="h1" style="margin:2px 0 0">${esc(v.name)}</h1></div>
      <div style="text-align:right"><span class="pill ${v.stage >= 3 ? 'ok' : 'n'}">${esc(st.name)}</span><div class="small fg2" style="margin-top:4px">Board-Meeting in ${left} Tag${left === 1 ? '' : 'en'} · ${m.hyper ? 'hyperscale-fähig' : 'wächst über CapEx'}</div></div></div>
    <div class="figs"><div><span class="label">ARR ${info('arr')}</span><b class="num">${big(v.arr)}</b>${trend(v.arr, last && last.arr, arrDrv) || `<span class="small fg2">MRR ${big(v.arr / 12)}</span>`}</div>
      <div><span class="label">Firmenkasse ${info('runway')}</span><b class="num ${v.cash < 0 ? 'dn' : ''}">${big(v.cash)}</b><span class="small ${rw < 6 ? 'dn' : 'fg2'}">${isFinite(rw) ? `Runway ${fmt(rw, 0)} Monate` : 'profitabel'}</span>${trend(v.cash, last && last.cash, cashDrv)}</div>
      <div><span class="label">Bewertung</span><b class="num">${big(V)}</b>${trend(V, last && last.val, v.pmf > (last ? last.pmf : 0) ? 'PMF & Wachstum' : 'Multiple')}<span class="small fg2">dein Anteil ${pctx(E.founderPct(v), 1)}</span></div>
      <div><span class="label">Im Nettovermögen ${info('liqdisc')}</span><b class="num">${big(mine * st.liq)}</b><span class="small fg2">${pctx(st.liq)} angerechnet</span></div></div>
    <div class="vkpi">${kpi('Product-Market Fit', 'pmf', v.pmf, last && last.pmf, v.pmf >= 0.8 ? 'ok' : v.pmf >= 0.5 ? 'warn' : 'crit')}${kpi('Produktqualität', '', Math.min(1, v.quality), null, v.quality >= 0.9 ? 'ok' : v.quality >= 0.75 ? 'warn' : 'crit')}
      <div><span>LTV / CAC ${info('ltvcac')}</span><b class="num ${u.ratio >= 3 ? 'up' : u.ratio >= 1 ? 'amb' : 'dn'}">${fmt(u.ratio, 1)}</b><small>${u.ratio >= 3 ? 'gesund' : u.ratio >= 1 ? 'knapp' : 'verbrennt Geld'}</small></div>
      <div><span>Abwanderung ${info('churn')}</span><b class="num ${u.churn > 0.12 ? 'dn' : ''}">${pctx(u.churn, 1)}</b><small>pro Quartal</small></div></div>
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;margin-top:12px">${focusBar(v)}${ambient(v)}</div>${benchLine(v)}${nextStep(v)}
    ${v.cash < 0 ? `<div class="alert" style="margin-top:14px"><div class="t"><b>Die Kasse ist leer</b>Lege Kapital ein, nimm eine Finanzierung an oder senke im War Room die Ausgaben – nach drei Quartalen im Minus ist ${esc(v.name)} insolvent.</div></div>` : rw < 6 ? `<div class="alert amb" style="margin-top:14px"><div class="t"><b>Runway unter 6 Monaten</b>Plane die nächste Finanzierung oder senke im War Room das Tempo.</div></div>` : ''}`;
  pulseUpdate(v); warUpdate(v); tacticsUpdate(v); duelUpdate(v, u); clocksUpdate(v); cycUpdate(v, u); treeUpdate(v); relUpdate(v); stakeUpdate(v); officeUpdate(v);
  const ltvTone = u.ratio >= 3 ? 'up' : u.ratio >= 1 ? 'amb' : 'dn';
  $('#v-unit').innerHTML = `<div><span>Kunden</span><b class="num">${fmt(v.customers, v.customers < 100 ? 1 : 0)}</b></div>
    <div><span>Kundenakquisekosten (CAC) ${info('cac')}</span><b class="num">${fmtE(u.cac, 0)}</b></div>
    <div><span>Kundenwert (LTV) ${info('ltv')}</span><b class="num">${fmtE(u.ltv, 0)}</b></div>
    <div><span>Bruttomarge ${info('margcost')}</span><b class="num">${pctx(u.gm)}</b></div>
    <div><span>Burn Rate ${info('burn')}</span><b class="num">${E.burnM(v) > 0 ? fmtE(E.burnM(v), 0) + ' / Monat' : 'kein Burn'}</b></div>
    ${v.trial ? `<div><span>Studie</span><b>${v.trial.phase >= 4 ? 'zugelassen' : `${esc(E.TRIAL[v.trial.phase].name)} · ${pctx(Math.min(1, v.trial.prog))}`}</b></div>` : ''}
    ${v.cap ? `<div><span>Kapazität (Stufe ${v.cap.level}) ${info('capex')}</span><b class="num">${fmt(v.customers, 0)} / ${fmt(E.capacity(v), 0)}${v.cap.building ? ' · Ausbau läuft' : ''}</b></div>` : ''}`;
  // Board-Berichte mit Prognose-Korridor
  const q = v.q.slice(-8);
  drawBars($('#v-bars'), q.map((r, i) => ({ label: r.q.replace(' J', '/'), a: r.plan ? r.plan[1] / 1e3 : i ? q[i - 1].arr / 1e3 : r.arr / 1e3, b: r.arr / 1e3, good: r.plan ? r.arr >= r.plan[1] : !i || r.arr >= q[i - 1].arr })), { fmt: x => x >= 1000 ? fmt(x / 1000, 1) + 'M' : fmt(x, 0) + 'k' });
  $('#v-q').innerHTML = q.length ? `<table><thead><tr><th>Quartal</th><th>Plan (Korridor)</th><th>Ist ARR</th><th>Abw.</th><th class="hide-m">Begründung</th><th class="hide-m">EBIT</th></tr></thead><tbody>${q.slice().reverse().map(r => { const d = r.plan && r.plan[1] > 0 ? r.arr / r.plan[1] - 1 : null, out = r.plan && (r.arr < r.plan[0] || r.arr > r.plan[2]);
    return `<tr><td>${esc(r.q)}</td><td>${r.plan ? `${kE(r.plan[0])} – ${kE(r.plan[2])}` : '–'}</td><td>${kE(r.arr)}</td><td class="${d === null ? '' : sc(d)}">${d === null ? '–' : sgn(d)}${out ? ' ·' : ''}</td><td class="hide-m small">${esc(r.why || (d !== null ? 'im Plan' : ''))}</td><td class="hide-m ${sc(r.ebit)}">${kE(r.ebit)}</td></tr>`; }).join('')}</tbody></table><p class="small fg2" style="margin:6px 0 0">Balken: hell = Basisplan, dunkel = Ist. „·“ = außerhalb des Korridors.</p>` : '<p class="note">Das erste Board-Meeting kommt nach dem ersten Quartal.</p>';
  inboxUpdate(v); tickUpdate(v); fundUpdate(v); capUpdate(v); execUpdate(v); ipoUpdate(v);
}

/* ---------- Firmen-Puls: laufendes Quartal gegen den Prognose-Korridor ---------- */
function pulseUpdate(v) {
  const qd = E.qDays(v), c = v.cur, P = v.plan, prog = Math.min(1, v.day / qd);
  let band = '';
  if (P && P.hi > P.lo) {
    const lo = Math.min(P.lo, v.arr) * 0.97, hi = Math.max(P.hi, v.arr) * 1.03, x = a => ((a - lo) / (hi - lo) * 100).toFixed(1) + '%';
    const tone = v.arr > P.hi ? 'up' : v.arr < P.lo * (0.6 + 0.4 * prog) ? 'dn' : '';
    band = `<div class="vband" title="Prognose-Korridor bis zum Board-Meeting"><div class="rail"></div><div class="cor" style="left:${x(P.lo)};width:calc(${x(P.hi)} - ${x(P.lo)})"></div><div class="base" style="left:${x(P.base)}"></div><div class="now ${tone}" style="left:${x(v.arr)}"></div></div>
      <div class="small fg2" style="display:flex;justify-content:space-between;font-variant-numeric:tabular-nums"><span>Plan ${kE(P.lo)} – ${kE(P.hi)} (Basis ${kE(P.base)})</span><span>jetzt ${kE(v.arr)}</span></div>`;
  }
  $('#v-pulse').innerHTML = `<div class="vlive"><span class="dot on"></span>Quartal läuft · Tag ${Math.min(v.day, qd)} von ${qd} · der Autopilot rechnet jeden Handelstag zur Eröffnung</div>
    <div class="vprog" role="progressbar" aria-valuemin="0" aria-valuemax="${qd}" aria-valuenow="${v.day}"><i style="width:${(prog * 100).toFixed(0)}%"></i></div>
    <div class="vmini"><div><span>Neukunden</span><b>+${fmt(c.newC, c.newC < 100 ? 1 : 0)}</b></div><div><span>Abgewandert</span><b>−${fmt(c.churnC, c.churnC < 100 ? 1 : 0)}</b></div><div><span>Umsatz</span><b>${kE(c.rev)}</b></div><div><span>Ausgaben</span><b>${kE(c.opex + c.mkt + c.rd + c.capex)}</b></div></div>${band}`;
}
function tickUpdate(v) {
  const L = Array.isArray(v.log) ? v.log : [];
  $('#v-tick').innerHTML = L.length ? L.map(e => `<li class="${esc(e.k)}"><span>Tag ${e.d}</span><b>${esc(e.m)}</b></li>`).join('') : '<li><span></span><b class="fg2">Noch keine Ereignisse – der erste Handelstag kommt zur Börseneröffnung.</b></li>';
}

/* ---------- Strategy War Room: Entwurf lokal, Prognose-Bandbreiten sofort, „Kurs setzen“ = eine Aktion ---------- */
const PRESETS = {
  freemium: { name: 'Freemium-Wachstum', sR: 0.30, rR: 0.12, eff: 0.35, pl: 0.85, why: 'Viel Vertrieb, günstige Preise, großzügiges Team: maximale Reichweite, dafür hoher Burn.' },
  enterprise: { name: 'Enterprise-Fokus', sR: 0.22, rR: 0.14, eff: 0.5, pl: 1.2, why: 'Weniger, dafür zahlungskräftige Kunden mit höheren Preisen. Braucht guten Product-Market Fit.' },
  margin: { name: 'Margen-Optimierung', sR: 0.08, rR: 0.07, eff: 0.85, pl: 1.1, why: 'Kosten runter, Preise leicht rauf: längere Runway, langsameres Wachstum.' }
};
const draft0 = v => { const r = E.ratesOf(v); return { sR: r.s, rR: r.r, eff: v.eff ?? 0.5, pl: E.plOf(v), salary: v.salary || 0, hyper: !!(v.hyper && v.hyper.on), capex: false }; };
const draftOf = v => S.UI.vd || draft0(v);
const changed = (v, d) => { const o = draft0(v); return Object.keys(o).some(k => typeof o[k] === 'number' ? Math.abs(o[k] - d[k]) > 1e-6 : o[k] !== d[k]); };
const SL = [
  ['sR', 'Vertrieb', 0, 0.5, 0.01, x => pctx(x) + ' / Q', 'Anteil der Firmenkasse, der je Quartal in Marketing und Vertrieb fließt. Bringt Neukunden – über 25 % der Kasse (Vertrieb + F&E) werden Ausgaben fest verplant.', 'Mehr Neukunden und schnelleres ARR-Wachstum, aber höherer Burn.'],
  ['rR', 'F&E', 0, 0.5, 0.01, x => pctx(x) + ' / Q', 'Anteil der Firmenkasse für Produktentwicklung (bei Biotech: Studien). Steigert Product-Market Fit und Qualität.', 'PMF und Qualität steigen – das senkt die Kundenkosten und die Abwanderung, wirkt aber mit Verzögerung.'],
  ['eff', 'Effizienz', 0, 1, 0.05, x => pctx(x), 'Wie schlank die Organisation geführt wird.', 'Hohe Effizienz senkt die Fixkosten bis −15 %, kostet aber Vertriebskraft und langsam Produktqualität.'],
  ['pl', 'Preisniveau', 0.8, 1.3, 0.01, x => pctx(x), '100 % = Marktpreis.', 'Höherer Preis: mehr Umsatz je Kunde, weniger Abschlüsse, etwas mehr Kündigungen.'],
];
function warUpdate(v) {
  const box = $('#v-war'); if (!box) return;
  const busy = box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
  if (!busy) box.innerHTML = warHTML(v);
  fcUpdate(v);
}
function warHTML(v) {
  const d = draftOf(v), m = E.vm(v), smax = E.SAL_MAX[Math.min(v.stage, 3)];
  return `<div class="vpills">${Object.entries(PRESETS).map(([k, p]) => `<button type="button" data-a="vpre" data-v="${k}" title="${esc(p.why)}">${esc(p.name)}</button>`).join('')}</div>
    ${SL.map(([k, n, lo, hi, step, f, d1, fx]) => `<label class="vsl"><span>${n} ${tip(n, d1, fx)}</span><input type="range" id="vw-${k}" min="${lo}" max="${hi}" step="${step}" value="${d[k]}" aria-label="${n}"><b id="vw-${k}-v">${f(d[k])}</b></label>`).join('')}
    <label class="vsl"><span>Gründergehalt ${tip('Gründergehalt', `Dein Gehalt je Quartal aus der Firmenkasse aufs Verrechnungskonto. Maximal ${fmtE(smax, 0)} in dieser Phase – mehr akzeptieren die Investoren nicht.`, 'Mehr Geld für dich, kürzere Runway für die Firma.')}</span><input type="range" id="vw-salary" min="0" max="${smax}" step="${Math.max(50, Math.round(smax / 40))}" value="${Math.min(d.salary, smax)}" aria-label="Gründergehalt"><b id="vw-salary-v">${fmtE(Math.min(d.salary, smax), 0)}</b></label>
    ${m.hyper ? `<div class="vtog"><span><b>Hyperscaling</b> ${info('hyper')}<small>${E.hyperReady(v) ? 'Voraussetzungen erfüllt (PMF ≥ 80 %, LTV/CAC ≥ 3)' : `Noch nicht bereit: PMF ${pctx(v.pmf)} · LTV/CAC ${fmt(E.unit(v).ratio, 1)} – Gefahr von Premature Scaling`}</small></span><button type="button" class="toggle ${d.hyper ? 'on' : ''}" data-a="vwhyper" aria-pressed="${d.hyper}" aria-label="Hyperscaling"></button></div>` : ''}
    ${v.cap ? `<div class="vtog"><span><b>Kapazität ausbauen</b> ${info('capex')}<small>${v.cap.building ? `Ausbau läuft (${v.cap.qLeft} Quartal${v.cap.qLeft > 1 ? 'e' : ''})` : `${fmtE(E.capCost(v), 0)} einmalig, danach ${fmtE(E.capCost(v) * 0.05, 0)} laufende Kosten je Quartal · Auslastung ${pctx(Math.min(1, v.customers / E.capacity(v)))}`}</small></span><button type="button" class="toggle ${d.capex ? 'on' : ''}" data-a="vwcap" aria-pressed="${d.capex}" aria-label="Kapazität ausbauen" ${v.cap.building ? 'disabled' : ''}></button></div>` : ''}
    <div class="vfc" id="v-fc"></div>
    <div class="vbtns"><button type="button" class="btn sm ghost" data-a="vwreset" id="vw-reset">Zurücksetzen</button><button type="button" class="btn sm" data-a="vwset" id="vw-set">Kurs setzen</button></div>`;
}
function fcUpdate(v) {
  const box = $('#v-fc'); if (!box) return;
  const d = draftOf(v), f = E.forecast(v, d), b = f.band, isNew = changed(v, d);
  const g = f.g === null ? null : f.g, rqLo = f.burnHi > 0 ? Math.max(0, f.cash) / (f.burnHi * 3) : Infinity, rqHi = f.burnLo > 0 ? Math.max(0, f.cash) / (f.burnLo * 3) : Infinity;
  const rq = x => isFinite(x) ? fmt(x, x < 10 ? 1 : 0) : '∞', warn = [];
  if (f.prem) warn.push(`Premature Scaling ${info('premature')}: Kunden springen schnell wieder ab, die Runway schmilzt.`);
  if (f.quality < -0.02) warn.push('Die Produktqualität sinkt – Abwanderung steigt mit Verzögerung.');
  if (rqLo < 2) warn.push('Runway unter 2 Quartalen – Finanzierung oder Kostenbremse einplanen.');
  if (d.capex && v.cash < E.capCost(v)) warn.push(`Für den Ausbau fehlen ${fmtE(E.capCost(v) - v.cash, 0)} in der Firmenkasse.`);
  box.innerHTML = `<div class="head"><span>Prognose bis zum Board-Meeting (${f.days} Tag${f.days === 1 ? '' : 'e'})${isNew ? ' · Entwurf' : ''}</span><span class="pill ${b > 0.22 ? 'warn' : b > 0.13 ? 'n' : 'ok'}">Genauigkeit ${E.confLabel(b)} ±${fmt(b * 100, 0)} %</span></div>
    <div class="lines">
      <div><span>ARR-Wachstum</span><b>${g === null ? `${kE(f.lo)} – ${kE(f.hi)} ARR` : `${sgn(f.gLo)} bis ${sgn(f.gHi)} <span class="fg2" style="font-weight:400">(Basis ${sgn(g)})</span>`}</b></div>
      <div><span>Burn Rate ${info('burn')}</span><b>${f.burn > 0 ? `~${kE(f.burnLo)} – ${kE(f.burnHi)} / Monat` : 'kein Burn'}</b></div>
      <div><span>Cash Runway</span><b class="${rqLo < 2 ? 'dn' : ''}">${isFinite(rqLo) ? `~${rq(rqLo)} – ${rq(rqHi)} Quartale` : 'profitabel'}</b></div>
      <div><span>Product-Market Fit</span><b class="${sc(f.pmf)}">${pp(f.pmf)}</b></div>
      <div><span>Produktqualität</span><b class="${sc(f.quality)}">${pp(f.quality)}</b></div>
      <div><span>Marktanteil</span><b class="${sc(f.share)}">${pp(f.share)}</b></div>
    </div>${warn.map(w => `<p class="warn" style="margin:8px 0 0">${w}</p>`).join('')}`;
  const set = $('#vw-set'), rs = $('#vw-reset'); if (set) set.disabled = !isNew; if (rs) rs.disabled = !isNew;
}
function warInput(k, el) {
  const v = S.A.venture; if (!v) return; const d = S.UI.vd = Object.assign({}, draftOf(v), { [k]: +el.value });
  const L = SL.find(x => x[0] === k), lab = $(`#vw-${k}-v`); if (lab) lab.textContent = L ? L[5](d[k]) : fmtE(d[k], 0);
  fcUpdate(v); // nur lokal – kein Request beim Schieben
}
for (const k of ['sR', 'rR', 'eff', 'pl', 'salary']) inputs['vw-' + k] = el => warInput(k, el);
actions.vpre = el => { const v = S.A.venture, p = PRESETS[el.dataset.v]; S.UI.vd = Object.assign({}, draftOf(v), { sR: p.sR, rR: p.rR, eff: p.eff, pl: p.pl }); $('#v-war').innerHTML = warHTML(v); fcUpdate(v); };
actions.vwhyper = () => { const v = S.A.venture, d = draftOf(v); S.UI.vd = Object.assign({}, d, { hyper: !d.hyper }); $('#v-war').innerHTML = warHTML(v); fcUpdate(v); };
actions.vwcap = () => { const v = S.A.venture, d = draftOf(v); S.UI.vd = Object.assign({}, d, { capex: !d.capex }); $('#v-war').innerHTML = warHTML(v); fcUpdate(v); };
actions.vwreset = () => { S.UI.vd = null; const v = S.A.venture; $('#v-war').innerHTML = warHTML(v); fcUpdate(v); };
actions.vwset = async el => {
  const v = S.A.venture, d = draftOf(v); el.disabled = true;
  const go = async () => { const r = await act({ type: 'vslider', sR: d.sR, rR: d.rR, eff: d.eff, pl: d.pl, salary: d.salary, hyper: d.hyper, capex: d.capex }, true); if (r.ok) { S.UI.vd = null; S.toast('Kurs gesetzt – neuer Prognose-Korridor bis zum Board-Meeting.', 'up'); } else S.toast(r.error || 'Das hat nicht geklappt.', 'dn'); const w = $('#v-war'); if (w) { w.innerHTML = warHTML(S.A.venture); fcUpdate(S.A.venture); } return r; };
  if (d.hyper && !(v.hyper && v.hyper.on) && !E.hyperReady(v)) { openReview({ title: 'Hyperscaling trotzdem zünden?', lines: [['PMF', pctx(v.pmf)], ['LTV / CAC', fmt(E.unit(v).ratio, 1)]], warn: 'Die Voraussetzungen (PMF ≥ 80 %, LTV/CAC ≥ 3) sind nicht erfüllt. Das ist Premature Scaling: Die gewonnenen Kunden springen schnell wieder ab, die Kasse leert sich.', confirm: 'Trotzdem Kurs setzen', run: go }); el.disabled = false; return; }
  await go();
};

/* ---------- Gründer vs. Markt (passiver Index) und Compliance ---------- */
function benchLine(v) {
  const b = E.benchmark(v.bm), nw = E.totals(S.A).total, c = E.complianceLabel(v.cpl || 0);
  return `<div class="vamb" style="margin-top:8px">${b ? `<span>Gründer vs. Markt ${info('bench')}: <b class="${nw >= b ? 'up' : 'dn'}">${big(nw)}</b> statt <b>${big(b)}</b> im Index (${nw / b >= 10 ? `×${fmt(nw / b, 0)}` : sgn(nw / b - 1)})</span>` : '<span></span>'}<span>Compliance ${info('compliance')}: <span class="pill ${c[1]}">${c[0]}</span>${S.A.halt > E.M.t ? ' · <b class="dn">Handelsstopp</b>' : ''}</span></div>`;
}
/* ---------- Release-Fenster und Launch-Day-Ticker ---------- */
function relUpdate(v) {
  const box = $('#v-rel'); if (!box) return; const R = v.rel || { n: 0, next: 8 }, it = v.inbox.find(i => i.k === 'release'), ag = v.age || 0;
  if (it) { const left = Math.max(0, E.RELEASE.window - (ag - it.data.d0)), x = E.I(it.data.r);
    box.innerHTML = `<div class="vclk"><div class="t"><b style="font-weight:600">${esc(it.title)}</b><small>Standard-Launch in ${left} Tag${left === 1 ? '' : 'en'}</small></div><div class="bar"><i class="warn" style="width:${((E.RELEASE.window - left) / E.RELEASE.window * 100).toFixed(0)}%"></i></div>
      <span class="fx">${it.data.major ? 'Major-Launch: Wirkung ×1,5. ' : ''}Ziel: ${x ? esc(x.name) : 'der Markt'} – ein guter Launch kostet den Rivalen Marktanteile und Kurs. Wer vorher auf fallende Kurse setzt, riskiert Insider-Verdacht.</span>
      <div class="vbtns" style="justify-content:flex-start"><button class="btn sm" data-a="vrelopen" data-id="${it.id}">Launch planen</button></div></div>`; return; }
  const d = Math.max(0, R.next - ag), span = 17;
  box.innerHTML = `<div class="vclk"><div class="t"><b style="font-weight:500">Release ${R.n + 1}${R.major ? ' · Major-Launch' : ''}</b><small>Fenster öffnet in ${d} Tag${d === 1 ? '' : 'en'} · bisher ${R.n} Launch${R.n === 1 ? '' : 'es'}</small></div><div class="bar"><i style="width:${(Math.max(0, 1 - d / span) * 100).toFixed(0)}%"></i></div>
    <span class="fx">Alle 2–3 Wochen ein Release. Ein fertiger Knoten im Produktbaum macht den nächsten zum Major-Launch und holt ihn vor.</span></div>`;
}
actions.vrelopen = el => {
  const v = S.A.venture, it = v.inbox.find(i => i.id === +el.dataset.id); if (!it) return;
  const L = { a: { q: 2, s: 2, h: 2 }, r: [], step: 0, shown: 0 }, P = E.RELEASE.points, seed = E.releaseSeed(v, it.id), major = !!it.data.major, x = E.I(it.data.r);
  const used = () => L.a.q + L.a.s + L.a.h, res = () => E.launchResolve(v.model, L.a, L.r, seed, major);
  const body = () => { if (L.step === 0) return `<p class="note" style="margin:0 0 8px">Engpass in deiner Branche: <b>${esc(E.BOTTLENECK[v.model])}</b>. Noch <b>${P - used()}</b> von ${P} Punkten frei.</p>${E.ALLOC.map(([k, n, d]) => `<div class="nb" style="grid-template-columns:130px 1fr auto"><span>${n} ${tip(n, d, '')}</span><span class="bar"><i style="width:${(L.a[k] / P * 100).toFixed(0)}%;background:var(--fg)"></i></span><span style="display:flex;gap:4px;align-items:center"><button class="btn sm ghost" data-a="lpt" data-k="${k}" data-d="-1" ${L.a[k] ? '' : 'disabled'}>−</button><b style="min-width:16px;text-align:center">${L.a[k]}</b><button class="btn sm ghost" data-a="lpt" data-k="${k}" data-d="1" ${used() < P ? '' : 'disabled'}>+</button></span></div>`).join('')}
      <div class="vbtns"><button class="btn sm" data-a="lgo">Launch-Tag starten</button></div>`;
    const imp = E.launchImpulses(v.model, L.a, seed, major);
    return `<div class="vtick" style="list-style:none">${imp.slice(0, L.shown).map((i, n) => `<div class="vclk"><div class="t"><b style="font-weight:500" class="${i.ok ? 'up' : 'dn'}">${n + 1}. ${esc(i.t)}</b><small>${i.ok ? 'positiv' : 'Problem'}</small></div></div>`).join('')}${L.shown < 3 ? '<p class="note">Signale laufen ein …</p>' : ''}</div>
      ${L.shown >= 1 ? `<p class="small fg2" style="margin:8px 0 4px">Reagiere (höchstens ${E.RELEASE.maxReact}):</p><div class="mv">${Object.entries(E.REACTIONS).map(([k, R]) => `<button class="btn sm ${L.r.includes(k) ? '' : 'ghost'}" data-a="lrx" data-v="${k}" ${!L.r.includes(k) && L.r.length >= E.RELEASE.maxReact ? 'disabled' : ''} title="${esc(R.desc)}">${esc(R.name)} · ${fmt(R.cost * 100, 0)} % Kasse</button>`).join('')}</div>` : ''}`; };
  const lines = () => { if (L.step === 0) return [['Wirkung', major ? 'Major-Launch (×1,5)' : 'Feature-Release'], ['Ziel-Rivale', x ? esc(x.name) : '–']]; const r = res(); return [['Launch-Ergebnis', r.score >= 1 ? 'voller Erfolg' : r.score > 0.2 ? 'gelungen' : r.score > -0.3 ? 'durchwachsen' : 'Fehlstart'], ['Neue Kunden', `+${fmt(r.cust * 100, 1)} % sofort, Abschlüsse ${r.score >= 0 ? '+' : ''}${fmt(25 * Math.max(-0.6, r.score), 0)} % bis zum Board`], ['Kosten der Reaktionen', fmtE(r.cost * Math.max(0, v.cash), 0)], ['Rivale verliert', x && r.hit > 0 ? `${esc(x.name)}: Gewinn −${fmt(r.hit * 100, 1)} %, Kurs ≈ −${fmt(r.hit * 200, 1)} %` : '–']]; };
  const redraw = () => { const b = $('#sh-neg'); if (b) b.innerHTML = body(); refreshReview(); const c = document.querySelector('[data-a="rconfirm"]'); if (c) c.disabled = L.step === 0 || L.shown < 3; };
  actions.lpt = e => { const k = e.dataset.k, d = +e.dataset.d; if (d > 0 && used() >= P) return; L.a[k] = Math.max(0, L.a[k] + d); redraw(); };
  actions.lgo = () => { L.step = 1; L.shown = 0; redraw(); const tick = () => { L.shown++; redraw(); if (L.shown < 3) setTimeout(tick, 1100); }; setTimeout(tick, 700); };
  actions.lrx = e => { const k = e.dataset.v; L.r = L.r.includes(k) ? L.r.filter(z => z !== k) : L.r.concat(k).slice(0, E.RELEASE.maxReact); redraw(); };
  openReview({ title: it.title, sub: 'Pre-Launch-Fokus verteilen, dann live reagieren', body: `<div class="vneg" id="sh-neg">${body()}</div>`, lines, totalLast: false, warn: () => L.step === 0 ? 'Die Verteilung bestimmt, welche Signale am Launch-Tag kommen.' : 'Erst wenn alle drei Signale da sind, kannst du abschließen. Der Server rechnet mit demselben Ablauf.', confirm: 'Launch abschließen', run: () => act({ type: 'vlaunch', id: it.id, a: L.a, r: L.r }, true) });
  redraw();
};
/* ---------- Strategische Beteiligungen über das Depot ---------- */
function stakeUpdate(v) {
  const box = $('#v-stake'); if (!box) return; const sup = E.SUPPLY[v.model] || [], sb = v.sb || { ids: [], calm: [] };
  const held = sb.ids.map(id => { const x = E.I(id); return x ? `<div><span>${esc(x.name)} <small class="fg2">${v.rivals.includes(id) ? '· Rivale' : '· Zulieferer'}</small></span><b class="num">${pctx(S.A.pos[id] ? S.A.pos[id].qty / x.shares : 0, 1)}</b></div>` : ''; }).join('');
  box.innerHTML = `<p class="note" style="margin:0 0 8px">Ab ${fmt(E.STAKE_MIN * 100, 0)} % an einem Unternehmen aus ${sup.map(k => esc(E.SECTORS[k])).join(' oder ')}: Kapazitätsausbau 15 % günstiger, Entwicklung 20 % schneller. Ab 5 % an einem Rivalen greift er dich seltener an.</p>
    ${held ? `<div class="lines">${held}</div>` : '<p class="small fg2" style="margin:0">Noch keine qualifizierende Beteiligung im Depot.</p>'}
    <div class="vbtns" style="justify-content:flex-start"><button class="btn sm ghost" data-go="markt">Zum Markt</button></div>`;
}
/* ---------- Büro-Stufen ---------- */
function officeUpdate(v) {
  const box = $('#v-off'); if (!box) return; const cur = E.OFFICE[v.off || 0], nx = E.OFFICE[(v.off || 0) + 1];
  box.innerHTML = `<div class="vamb" style="margin-bottom:8px">${E.OFFICE.map((o, i) => `<span class="${i <= (v.off || 0) ? '' : 'fg2'}">${i <= (v.off || 0) ? '<b>' : ''}${esc(o.name)}${i <= (v.off || 0) ? '</b>' : ''}</span>`).join(' → ')}</div>
    <div class="lines"><div><span>Jetzt</span><b>${esc(cur.name)} · Tempo ×${fmt(cur.speed, 2)}</b></div>${nx ? `<div><span>Nächste Stufe</span><b>${esc(nx.name)}: ${fmtE(nx.cost, 0)}, +${fmtE(nx.opex, 0)} Fixkosten/Q</b></div><div><span>Bonus</span><b>Entwicklung ×${fmt(nx.speed, 2)}, Abschlüsse +${fmt((nx.conv - 1) * 100, 0)} %, Gehälter −${fmt((1 - nx.talent) * 100, 0)} %</b></div>` : ''}</div>
    ${nx ? `<div class="vbtns" style="justify-content:flex-start"><button class="btn sm ${v.stage >= nx.stage && v.cash >= nx.cost ? '' : 'ghost'}" data-a="voff" ${v.stage >= nx.stage && v.cash >= nx.cost ? '' : 'disabled'}>${v.stage < nx.stage ? `ab Phase „${esc(E.VENTURE_STAGES[nx.stage].name)}“` : `Umziehen · ${fmtE(nx.cost, 0)}`}</button></div>` : ''}`;
}
actions.voff = el => { el.disabled = true; act({ type: 'voffice' }); };
/* ---------- Ambient-Puls: letzter Handelstag in Klartext + Uhr bis zum nächsten Tag ---------- */
function ambient(v) {
  const L = v.last || [0, 0, 0], nx = E.nextOpenFrom(E.M.t), prog = Math.max(0, Math.min(1, 1 - (nx - E.M.t) / 864e5));
  return `<div class="vamb" style="flex:1;min-width:240px;justify-content:flex-end"><span>Tag ${v.age || 0} aktiv · <b>${L[0] >= 0 ? '+' : ''}${fmt(L[0], L[0] < 10 ? 1 : 0)} Kunden</b>, <b>${L[1] >= 0 ? '+' : '−'}${kE(Math.abs(L[1]))} ARR</b>, <b class="${L[2] < 0 ? 'dn' : 'up'}">${L[2] >= 0 ? '+' : '−'}${kE(Math.abs(L[2]))} Kasse</b></span>
    <span style="display:flex;align-items:center;gap:6px">nächster Handelstag <span class="meter" style="width:70px;display:inline-block"><i style="width:${(prog * 100).toFixed(0)}%"></i></span></span></div>`;
}
/* ---------- Step Clocks: laufende Maßnahmen mit Restschritten, Effekt-Vorschau und „+1 Schritt“ ---------- */
function clockName(v, c) {
  if (c.k === 'node') { const N = E.nodeOf(v, c.t, c.n); return [`Entwicklung: ${N ? N.name : ''}`, `${c.m === 'mvp' ? 'MVP (Tech Debt +15 %)' : 'Saubere Architektur'} · danach PMF-Decke +17 Pkt.${N && N.tags.some(t => (v.radar || []).includes(t)) ? ' und Radar-Treffer (PMF +5)' : ''} · braucht Entwicklungsbudget`]; }
  if (c.k === 'cap') return ['Kapazitätsausbau', `Danach Stufe ${v.cap.level + 1} – mehr Kunden möglich${v.model === 'cleantech' && E.synergy(v) ? `, Förder-Synergie Stufe ${E.synergy(v)}` : ''}`];
  if (c.k === 'atk') return [`${CAMPAIGNS[c.sub] ? CAMPAIGNS[c.sub].name : 'Attacke'} gegen ${E.I(c.r) ? E.I(c.r).name : 'Rivalen'}`, `Erfolgschance ~${fmt((c.p || 0) * 100, 0)} % – bei Misserfolg halbe Wirkung`];
  if (c.k === 'audit') return ['Kosten- & Effizienz-Audit', `Chance ~${fmt((c.p || 0) * 100, 0)} %: Fixkosten dauerhaft −3 %`];
  if (c.k === 'int') return ['Post-Merger-Integration', 'Tech Debt +15 %, Fixkosten +10 % bis zum Abschluss'];
  return [c.k, ''];
}
function clocksUpdate(v) {
  const box = $('#v-clk'); if (!box) return; const C = v.clk || [];
  box.innerHTML = C.length ? C.map(c => { const [n, fx] = clockName(v, c), w = c.s / c.S * 100, pv = Math.min(100, (c.s + 1) / c.S * 100), canPush = c.k !== 'int';
    return `<div class="vclk" id="clk-${c.i}"><div class="t"><b style="font-weight:500">${esc(n)}</b><small>${fmt(c.s, c.s % 1 ? 1 : 0)} / ${c.S} Schritte · noch ~${Math.ceil(c.S - c.s)} Tag${Math.ceil(c.S - c.s) === 1 ? '' : 'e'}</small></div>
      <div class="bar"><i class="pv" style="width:${pv.toFixed(0)}%"></i><i style="width:${w.toFixed(0)}%"></i></div>
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span class="fx">${esc(fx)}</span>${canPush ? `<button class="btn sm ghost" data-a="vpush" data-v="${c.i}" data-fc="${E.FOCUS.cost.push}" data-cp="${c.i}" ${(v.focus || 0) < E.FOCUS.cost.push ? 'disabled' : ''}>+1 Schritt · ${E.FOCUS.cost.push} Fokus</button>` : ''}</div></div>`; }).join('')
    : '<p class="note" style="margin:0">Gerade läuft keine Maßnahme. Starte einen Knoten im Produktbaum oder eine Attacke im Tab „Markt & Rivalen“.</p>';
}
actions.vpush = el => fact({ op: 'push', i: +el.dataset.v }, el);
async function fact(b, el) { if (el) el.disabled = true; await act(Object.assign({ type: 'vfocus' }, b)); }
/* ---------- Cycle Clocks: Hintergrund- und Risiko-Uhren ---------- */
function cycUpdate(v, u) {
  const box = $('#v-cyc'); if (!box) return; const qd = E.qDays(v), rows = [], bar = (name, val, tone, txt, fx) => rows.push(`<div class="vclk"><div class="t"><b style="font-weight:500">${name}</b><small>${txt}</small></div><div class="bar"><i class="${tone}" style="width:${(Math.max(0, Math.min(1, val)) * 100).toFixed(0)}%"></i></div>${fx ? `<span class="fx">${fx}</span>` : ''}</div>`);
  bar('Nächstes Board-Meeting', v.day / qd, '', `Tag ${v.day} von ${qd}`, v.mand ? `Mandat: ${kE(v.mand.arr)} ARR bis Quartal ${v.mand.q + 1} (jetzt ${pctx(Math.min(1, v.arr / v.mand.arr))})` : 'Bericht mit Plan vs. Ist');
  const copy = Math.min(0.95, v.rivals.reduce((s, id) => { const x = E.I(id); if (!x) return s; const pr = E.rivalProfile(x); return s + (0.03 + 1.6 * u.share + (v.lost[id] || 0) * 2) * pr.aggr * 0.25; }, 0));
  bar('Rivalen-Kopie', copy, copy > 0.3 ? 'crit' : copy > 0.12 ? 'warn' : 'ok', `~${fmt(copy * 100, 0)} % je Board-Meeting`, 'Ein Rivale baut eure Funktionen nach (PMF −5). Neue Produktstufen und Patente halten den Vorsprung.');
  if (E.vm(v).hyper) bar('Kartellprüfung', u.share / 0.4, u.share > 0.32 ? 'crit' : u.share > 0.2 ? 'warn' : 'ok', `${pctx(u.share, 1)} von 40 % Marktanteil`, 'Ab 40 % prüfen Behörden die Marktmacht.');
  if (v.cash < 0) bar('Insolvenz-Rettungsfrist', (v.fail || 0) / 3, 'crit', `${3 - (v.fail || 0)} Board-Meeting${3 - (v.fail || 0) === 1 ? '' : 's'} bleiben`, 'Kapital einlegen oder Finanzierung annehmen.');
  if ((v.debt || 0) > 0) bar('Technische Schuld', v.debt, v.debt > 0.5 ? 'crit' : v.debt > 0.25 ? 'warn' : 'ok', pctx(v.debt), `Fixkosten +${fmt(v.debt * 30, 0)} %${v.debt > 0.5 ? ', Fokus nur +1 je Tag' : ''}${v.hyper && v.hyper.on ? ', Ausfallrisiko im Hyperscaling' : ''}`);
  if ((v.moral ?? 1) < 0.8) bar('Team-Moral', v.moral, v.moral < 0.4 ? 'crit' : 'warn', pctx(v.moral), 'Dauer-Hyperscaling zehrt am Team. Unter 40 % lädt sich Fokus nur +1 je Tag auf.');
  for (const c of v.cp || []) { const x = E.I(c.r), left = Math.max(0, c.at - (v.age || 0)); bar(`Fast-Follower: ${x ? esc(x.name) : 'Rivale'}`, 1 - left / 28, left < 7 ? 'crit' : 'warn', `Kopie in ~${left} Tagen`, 'Ein Patent oder saubere Architektur mit Qualität über 95 % blockiert die Kopie.'); }
  if (v.bomb) bar('Vertuschte Sicherheitslücke', 0.5, 'crit', 'Leak-Risiko aktiv', 'Ein Whistleblower kann sich jederzeit melden – womöglich kurz vor dem Börsengang.');
  if ((v.cpl || 0) > 0) { const c = E.complianceLabel(v.cpl); bar('Compliance', v.cpl / 100, c[1], c[0], 'Steigt, wenn du vor eigenen Launches oder Attacken gegen den Ziel-Rivalen wettest. Baut sich langsam ab.'); }
  for (const p of v.pat || []) bar(`Patent: ${esc(p.n)}`, p.d / p.D, p.d / p.D < 0.25 ? 'warn' : 'ok', `noch ${p.d} Tage`, `Bewertung +${kE(p.v * p.d / p.D)} · Erstanmelder, nicht verlängerbar`);
  if (v.model === 'cleantech') bar('Förder-Synergie', E.synergy(v) / 3, E.synergy(v) ? 'ok' : '', `Stufe ${E.synergy(v)} von 3`, 'Energie-/Konjunktur-Storylines: Baukosten −10 % und Marge +2 Pkt. je Stufe.');
  if (v.model === 'deeptech' && v.cap) bar('Anlagen-Verschleiß', (v.cap.wear || 0) / 0.2, (v.cap.wear || 0) > 0.1 ? 'warn' : 'ok', `−${pctx(v.cap.wear || 0)} Kapazität`, E.complexity(v) ? `Komplexität ohne Plattform: Marge −${fmt(E.complexity(v) * 100, 0)} Pkt.` : 'Ein neuer Ausbau setzt den Verschleiß zurück.');
  box.innerHTML = rows.join('');
}
/* ---------- Produktbaum mit Kunden-Radar ---------- */
function treeUpdate(v) {
  const box = $('#v-tree'); if (!box) return; const T = E.PRODUCT_TREE[v.model] || [], R = v.radar || [], run = (v.clk || []).find(c => c.k === 'node'), C = E.FOCUS.cost;
  box.innerHTML = `<div class="vradar">${R.map(k => `<span title="${esc(E.RADAR[k].desc)}">${esc(E.RADAR[k].name)}</span>`).join('')}<small class="fg2" style="align-self:center">Kunden-Radar ${info('radar')}</small></div><div class="vtree">${T.map((tier, i) => {
    const ch = (v.tree || [])[i], prevOk = i === 0 || ((v.tree || [])[i - 1] && v.tree[i - 1].d);
    return `<div class="vtier"><span>Stufe ${i + 1}</span>${tier.map(N => { const done = ch && ch.k === N.k && ch.d, isRun = run && run.t === i && run.n === N.k, lock = (ch && ch.k !== N.k) || (run && run.t === i && run.n !== N.k), qC = E.focusQuote(v, { op: 'node', t: i, n: N.k, m: 'clean' }), qM = E.focusQuote(v, { op: 'node', t: i, n: N.k, m: 'mvp' }), can = !done && !isRun && !lock && prevOk && !run;
      const fx = Object.entries(N.fx).map(([k, x]) => ({ cac: `Kundenkosten ${sgn(x - 1)}`, arpu: `Umsatz/Kunde ${sgn(x - 1)}`, churn: `Abwanderung ${sgn(x - 1)}`, conv: `Abschlüsse ${sgn(x - 1)}`, gm: `Marge ${x > 0 ? '+' : '−'}${fmt(Math.abs(x) * 100, 0)} Pkt.`, net: 'Netzwerkeffekt +', capU: `Kapazität ${sgn(x - 1)}`, opex: `Fixkosten ${sgn(x - 1)}`, plat: 'keine Komplexitätsstrafe', pat: `Patent ${kE(x * (1 + v.stage))}` }[k])).join(' · ');
      return `<div class="vnode ${done ? 'done' : isRun ? 'run' : lock || !prevOk ? 'lock' : ''}">${tip(N.name, N.desc, fx)}<b>${esc(N.name)}</b><small>${esc(fx)}</small><span class="tags">${N.tags.map(t => `<em class="${R.includes(t) ? 'hit' : ''}">${esc(E.RADAR[t].name.split(' ')[0])}</em>`).join('')}</span>
        ${done ? `<small class="up">fertig${ch.m === 'mvp' ? ' (MVP)' : ''}</small>${i < 2 || true ? `<button class="link" style="align-self:flex-start;font-size:12px" data-a="vrepath" data-v="${i}" data-fc="${C.repath}">Pfad umbauen · ${C.repath} Fokus</button>` : ''}` : isRun ? '<small>in Entwicklung …</small>' : lock ? '<small>anderer Pfad gewählt</small>' : !prevOk ? '<small>erst vorherige Stufe</small>'
          : `<span class="btns2"><button class="btn sm" data-a="vnode" data-t="${i}" data-v="${N.k}" data-m="clean" data-fc="${qC.f}" ${can && (v.focus || 0) >= qC.f ? '' : 'disabled'} title="${qC.S} Schritte · ~${fmtE(qC.budget, 0)} Entwicklungsbudget · keine Tech Debt">Sauber · ${qC.f} Fokus</button><button class="btn sm ghost" data-a="vnode" data-t="${i}" data-v="${N.k}" data-m="mvp" data-fc="${qM.f}" ${can && (v.focus || 0) >= qM.f ? '' : 'disabled'} title="${qM.S} Schritte · ~${fmtE(qM.budget, 0)} Entwicklungsbudget · Tech Debt +15 %">MVP · ${qM.f}</button></span>`}</div>`; }).join('')}</div>`; }).join('')}</div>
    <p class="small fg2" style="margin:8px 0 0">Jede Stufe hebt die PMF-Decke (jetzt ${pctx(E.pmfCap(v))}). Trifft ein Knoten ein Radar-Signal, gibt es PMF +5; Entwicklungen am Markt vorbei kosten laufend Fixkosten.</p>`;
}
actions.vnode = el => fact({ op: 'node', t: +el.dataset.t, n: el.dataset.v, m: el.dataset.m }, el);
actions.vrepath = el => { const t = +el.dataset.v, q = E.focusQuote(S.A.venture, { op: 'repath', t }); openReview({ title: `Pfad ab Stufe ${t + 1} umbauen?`, lines: [['Fokus', String(q.f)], ['Kosten', fmtE(q.cost, 0)], ['Technische Schuld', '+10 %']], warn: 'Die gewählten Knoten ab dieser Stufe werden zurückgebaut – ihre Effekte entfallen. Danach ist der andere Pfad wieder offen.', confirm: 'Umbauen', run: () => act({ type: 'vfocus', op: 'repath', t }, true) }); };
/* ---------- Taktische Züge (Markt-Tab): A/B-Test, Audit, Refactoring ---------- */
function tacticsUpdate(v) {
  const box = $('#v-spr'); if (!box) return; const busy = k => (v.clk || []).some(c => c.k === k);
  const cards = [['ab', 'A/B-Test Vertriebskanal', 'Zwei Kanäle gegeneinander testen.', 'Bei Erfolg (~65 %) Kundengewinnung 5 % günstiger bis zum Board-Meeting.'], ['audit', 'Kosten- & Effizienz-Audit', 'Alle Verträge auf den Prüfstand.', 'Läuft 3 Tage. Bei Erfolg Fixkosten dauerhaft −3 % (max. −15 %), ein Quartal etwas weniger Abschlüsse.'], ['refactor', 'Refactoring', 'Code und Infrastruktur aufräumen.', `Tech Debt −15 Pkt. (jetzt ${pctx(v.debt || 0)}), Qualität +2.`]];
  box.innerHTML = `<div class="vspr" style="grid-template-columns:1fr">${cards.map(([k, n, d, fx]) => { const q = E.focusQuote(v, { op: k }), dis = (v.focus || 0) < q.f || (q.cost && v.cash < q.cost) || (k === 'audit' && busy('audit')) || (k === 'refactor' && !(v.debt > 0));
    return `<div><b style="font-size:14px;padding-right:22px">${n}</b>${tip(n, d, fx)}<span class="num">${q.f} Fokus${q.cost ? ` · ${fmtE(q.cost, 0)}` : ''}</span><small>${esc(fx)}</small><button class="btn sm ${dis ? 'ghost' : ''}" style="margin-top:6px" data-a="vtac" data-v="${k}" data-fc="${q.f}" ${dis ? 'disabled' : ''}>${k === 'audit' && busy('audit') ? 'Läuft' : 'Ausführen'}</button></div>`; }).join('')}</div>
    <p class="small fg2" style="margin:8px 0 0">Attacken auf Rivalen startest du links über das Profil eines Rivalen (2 Fokus).</p>`;
}
actions.vtac = el => fact({ op: el.dataset.v }, el);

/* ---------- Markt-Duell: TAM-Balken, Rivalen-Profile, gezielte Attacken ---------- */
const RIVC = ['var(--fg2)', 'var(--line2)', 'var(--mute)'];
function duelUpdate(v, u) {
  const T = E.segTAM(v), riv = v.rivals.map(id => E.I(id)).filter(Boolean), open = S.UI.vRiv;
  const seg = [[`${esc(v.name)}`, u.share, 'var(--up)'], ...riv.map((x, i) => [esc(x.name), (1 - u.share) * (v.w[x.id] || 0) * 0.6, RIVC[i % 3]])], rest = Math.max(0, 1 - seg.reduce((s, r) => s + r[1], 0));
  const busyAtk = (v.clk || []).some(c => c.k === 'atk'), onceAtk = false, fa = E.FOCUS.cost.attack;
  const rows = riv.map((x, i) => { const pr = E.rivalProfile(x), arc = E.ARCH[E.archetype(pr.k)], sh = (1 - u.share) * (v.w[x.id] || 0) * 0.6, isO = open === x.id;
    return `<button type="button" class="vriv" data-a="vriv" data-v="${x.id}" aria-expanded="${isO}"><span><span class="sw" style="background:${RIVC[i % 3]}"></span>${esc(x.name)} <small class="fg2">· ${esc(arc.name)}</small></span><b>${pctx(sh, 1)}${v.lost[x.id] ? ` <small class="up" style="font-weight:400">−${fmt(v.lost[x.id] * 100, 1)} Pp</small>` : ''}</b></button>
      ${isO ? `<div class="vprof"><p class="small" style="margin:0 0 8px"><b>${esc(arc.name)}:</b> ${esc(arc.desc)}${v.sb && v.sb.calm.includes(x.id) ? ' <span class="up">Deine Beteiligung dämpft seine Angriffe.</span>' : ''}</p><div class="lines"><div><span>Aktie</span><b>${fmt(x.price, 2)} € <span class="${sc(E.chg(x))}" style="font-weight:400">${pctS(E.chg(x))}</span></b></div><div><span>Quartalsumsatz</span><b>${fmtBig(x.fin ? x.fin.rev : 0)} €</b></div></div>
        <div class="vspr" style="margin-top:10px">${Object.entries(CAMPAIGNS).map(([k, C]) => { const q = E.sprintQuote(v, 'attack', k), dis = busyAtk || (v.focus || 0) < fa || v.cash < q.cost;
          return `<div><b style="font-size:13px;padding-right:22px">${esc(C.name)}</b>${tip(C.name, C.desc, `Läuft ${q.days} Handelstage. Erfolgschance ~${fmt(q.p * 100, 0)} % – bei Misserfolg halbe Wirkung.`)}<span class="num">${fa} Fokus · ${fmtE(q.cost, 0)} · ~${fmt(q.p * 100, 0)} %</span><button class="btn sm ghost" data-a="vatk" data-r="${x.id}" data-v="${k}" data-fc="${fa}" ${dis ? 'disabled' : ''}>${busyAtk ? 'Attacke läuft' : onceAtk ? 'Nächstes Quartal' : 'Angreifen'}</button></div>`; }).join('')}</div>
        <button class="btn sm ghost" style="margin-top:10px" data-go="i-${x.id}">Zur Aktie ${esc(x.id)}</button></div>` : ''}`; }).join('');
  $('#v-duel').innerHTML = `<div class="lines"><div><span>Marktsegment (TAM)</span><b class="num">${big(T)}</b></div><div><span><b>${esc(v.name)}</b></span><b class="up num">${pctx(u.share, 2)}</b></div></div>
    <div class="vtam" role="img" aria-label="Marktanteile im Segment">${seg.map(r => `<i style="width:${Math.max(r[1] > 0 ? 0.6 : 0, r[1] * 100).toFixed(2)}%;background:${r[2]}" title="${r[0]}: ${pctx(r[1], 1)}"></i>`).join('')}<i style="width:${(rest * 100).toFixed(2)}%;background:var(--bg2)" title="Übrige Anbieter"></i></div>${rows}
    <p class="small fg2" style="margin:8px 0 0">Tippe auf einen Rivalen für sein Profil und gezielte Attacken. Gewonnene Anteile kosten ihn echten Umsatz in den nächsten Quartalszahlen.</p>`;
}
actions.vriv = el => { S.UI.vRiv = S.UI.vRiv === el.dataset.v ? null : el.dataset.v; duelUpdate(S.A.venture, E.unit(S.A.venture)); };
actions.vatk = el => fact({ op: 'attack', sub: el.dataset.v, rival: el.dataset.r }, el);

/* ---------- Inbox: Optionen mit Erklärbutton und Vorschau, Term-Sheet-Nachverhandlung ---------- */
function explain(v, it, o) {
  const u = E.unit(v), cash = Math.max(0, v.cash), d = it.data || {}, cto = !!(v.execs && v.execs.cto);
  const T = {
    vc: { hi: ['Shark-VC', 'Viel Kapital bei hoher Bewertung – mit hartem Wachstums-Covenant.', `Verfehlst du ${fmtE(d.tgt || 0, 0)} ARR in 4 Quartalen: 5 % Straf-Verwässerung an den Investor, Autorität −20, Down Round.`],
      lo: ['Smart-Money-VC', 'Weniger Geld, mehr Anteile abgeben – dafür Netzwerk und Kunden.', 'Sofort +8 % Kunden, zwei Quartale 10 % günstigere Kundengewinnung, nur ein weiches Ziel.'],
      no: ['Ablehnen', 'Bootstrapping: Du behältst alle Anteile und wächst aus eigener Kasse.', 'Die nächste Gelegenheit kommt, wenn die Kennzahlen wieder passen.'] },
    buyout: { accept: ['Verkaufen (Exit)', 'Dein Anteil wird sofort in bar ausgezahlt, das Startup gehört danach dem Käufer.', `Du erhältst ${fmtE((d.price || 0) * E.founderPct(v), 0)} und kannst neu gründen.`], reject: ['Ablehnen', 'Du bleibst unabhängig.', 'Der Weg zum eigenen Börsengang bleibt offen – mit Risiko.'] },
    pricewar: { match: ['Preiskampf mitgehen', 'Du senkst die Preise wie der Rivale.', `Marge: Umsatz je Kunde −10 % für 3 Quartale (≈ ${kE(v.arr * 0.1)} ARR) · Marktanteil: hält · PMF: unverändert.`],
      diff: ['Qualitäts-Konter via CTO', `Du antwortest mit Produkt statt Preis${cto ? ' – dein CTO verstärkt den Effekt' : ''}.`, `Kostet ~${kE(Math.max(1000, cash * 0.08))} · PMF +${cto ? 7 : 4} Punkte, Qualität +3 · Marktanteil: leichter Verlust möglich.`],
      hold: ['Nische verteidigen', 'Preise halten, auf treue Kernkunden setzen.', `Marge: unverändert · Marktanteil: −8 % Kunden sofort (≈ ${fmt(v.customers * 0.08, 0)}) · danach 3 Quartale 15 % weniger Kündigungen.`] },
    lobby: { counter: ['Gegenlobby', 'Eigene Lobbyarbeit in Berlin und Brüssel.', `Kostet 5 % der Kasse (~${kE(cash * 0.05)}) – dafür keine neuen Auflagen.`], wait: ['Abwarten', 'Kostet nichts.', 'Mit 50 % Wahrscheinlichkeit kommen Auflagen: 4 Quartale lang −4 Punkte Bruttomarge.'] },
    antitrust: { concede: ['Zugeständnisse', 'Du kommst der Behörde entgegen.', '4 Quartale gebremstes organisches Wachstum (−30 %), Preise −5 % und Auflagen auf die Marge – aber kein Risiko einer Strafe.'], fight: ['Vor Gericht kämpfen', 'Du lässt es auf einen Prozess ankommen.', `Prozesskosten 5 % der Kasse. 45 % Risiko: Strafe von 10 % des ARR (≈ ${kE(v.arr * 0.1)}) und 4 Quartale Preise −10 %. Sonst Freispruch.`] },
    grant: { yes: ['Zuschuss annehmen', 'Geld von der Förderbank – ohne Anteile abzugeben.', `+${kE(d.g || 0)} in die Firmenkasse. Höchstens vier Zuschüsse insgesamt.`], no: ['Ablehnen', 'Du verzichtest auf die Förderung.', 'Ein neues Angebot kommt frühestens in 4 Quartalen.'] },
    deal: { yes: ['Großkunde annehmen', 'Ein Konzern kauft in großem Stil – mit Rabatt.', `+${fmt(d.n || 0, 0)} Kunden sofort, aber 4 Quartale lang 7 % weniger Umsatz je Kunde.`], no: ['Ablehnen', 'Kein Rabatt, keine Sonderwünsche.', 'Es ändert sich nichts.'] },
    tariff: { move: ['Lieferkette verlagern', 'Eigene Fertigung in Europa.', `Einmalig ~${kE(Math.max(2000, v.arr * 0.15))}, danach treffen dich Zölle kaum noch.`], price: ['Preise erhöhen', 'Die Zölle werden an die Kunden weitergegeben.', 'Keine Kosten, aber 3 Quartale lang 15 % weniger Abschlüsse.'] },
    launch: { silent: ['Silent Beta', 'Leiser Start mit ausgewählten Kunden.', 'Sicher: +8 % Abschlüsse bis zum Board-Meeting.'], keynote: ['Keynote-Launch', 'Große Bühne, Presse, Live-Demo.', `Bei hoher Qualität +30 % Abschlüsse. Risiko eines Shitstorms: ~${fmt(80 * (v.debt || 0), 0)} % (steigt mit der Tech Debt).`] },
    release: { go: ['Standard-Launch', 'Je 2 Punkte auf Qualität, Skalierung und Hype, keine Reaktionen.', 'Solide, aber verschenkt Potenzial – „Launch planen“ holt mehr heraus.'] },
    bomb: { fix: ['Sofort beheben', 'Transparenz statt Risiko.', `Kostet ~${kE(d.c || 0)} und wirft die laufende Entwicklung 2 Schritte zurück.`], cover: ['Stillschweigend weitermachen', 'Das Wachstum läuft ungebremst weiter.', 'In 4–7 Wochen meldet sich mit 70 % Wahrscheinlichkeit ein Whistleblower: Bewertung −30 %, Board −20, Kündigungswelle – womöglich kurz vor dem Börsengang.'] },
    talent: { esop: ['0,6 % ESOP geben', 'Sie bleibt und das Tempo auch.', 'Dein Gründeranteil sinkt um 0,6 Punkte.'], let: ['Gehen lassen', 'Keine Verwässerung.', 'Drei Wochen lang 30 % langsamere Entwicklung.'] },
    partner: { yes: ['Kooperation annehmen', 'Ein Partner verkauft mit.', '+25 % Abschlüsse, aber 10 Punkte weniger Bruttomarge – zwei Quartale lang.'], no: ['Ablehnen', 'Volle Marge.', 'Es ändert sich nichts.'] },
    suit: { settle: ['Vergleich', 'Zahlen und weitermachen.', `Kostet ${kE(d.c || 0)}, kein weiteres Risiko.`], fight: ['Prozess führen', 'Du hältst dagegen.', `60 % Sieg. Bei Niederlage ${kE((d.c || 0) * 1.8)} und die Entwicklung wird 3 Schritte zurückgeworfen.`] },
    poach: { retain: ['Halteprämie', '0,5 % Anteile aus deinem Gründeranteil.', 'Die Führungskraft bleibt.'], let: ['Gehen lassen', 'Keine Verwässerung.', 'Die Position ist frei, Board −3.'] },
    bridge: { yes: ['Brückenfinanzierung annehmen', 'Bestandsinvestoren retten die Kasse.', `+${kE(d.amt || 0)}, du gibst ${fmt((d.dil || 0) * 100, 1)} % ab, Bewertung −15 %, Board −5. Nächste Brücke frühestens in 4 Quartalen.`], no: ['Ablehnen', 'Du suchst selbst nach Geld.', 'Bleibt die Kasse drei Quartale im Minus, ist das Startup insolvent.'] }
  };
  return (T[it.k] && T[it.k][o.k]) || [o.label, o.desc || '', ''];
}
function inboxUpdate(v) {
  const busy = document.activeElement && document.activeElement.id && document.activeElement.id.startsWith('vneg-'); if (busy) return;
  const n = v.inbox.filter(i => i.opts).length; const h = $('#v-inbox-h'); if (h) h.innerHTML = `Entscheidungen${n ? ` <span class="pill warn">${n} offen</span>` : ''}`;
  $('#v-inbox').innerHTML = v.inbox.length ? v.inbox.map(it => `<div class="vdec"><b>${esc(it.title)}</b><p class="note" style="margin:4px 0 10px">${esc(it.text)}</p>
      ${it.opts ? `<div class="vopts">${it.opts.map(o => { const [t, d, fx] = explain(v, it, o);
        return `<div class="vopt" role="button" tabindex="0" data-a="vdec" data-id="${it.id}" data-v="${o.k}">${tip(t, d, fx)}<b>${esc(o.label)}</b>${o.desc ? `<small>${esc(o.desc)}</small>` : ''}${fx ? `<small>${esc(fx)}</small>` : ''}</div>`; }).join('')}</div>
      ${it.k === 'vc' || it.k === 'deal' ? `<div class="vbtns" style="justify-content:flex-start"><button class="btn sm" data-a="vnegopen" data-id="${it.id}" data-fc="${E.FOCUS.cost.neg}" ${(v.focus || 0) < E.FOCUS.cost.neg ? 'disabled' : ''}>In 3 Runden verhandeln · ${E.FOCUS.cost.neg} Fokus</button></div>` : ''}
      <p class="small fg2" style="margin:8px 0 0">Ohne Antwort gilt nach zwei Quartalen: ${esc(it.opts[it.def].label)}</p>` : `<button class="btn sm ghost" data-a="vdec" data-id="${it.id}" data-v="">Gelesen</button>`}</div>`).join('')
    : '<p class="note" style="margin:0">Keine offenen Entscheidungen. Das Tagesgeschäft läuft auf Autopilot.</p>';
}
const negAsk = id => (S.UI.vNeg && S.UI.vNeg[id]) ?? 0.1;
function negLines(it) { const t = E.negTerms(it.data, negAsk(it.id)); return `<div><span>Bewertung vor Geld</span><b>${fmtE(t.pre, 0)}</b></div><div><span>Frisches Kapital</span><b>${fmtE(t.raise, 0)}</b></div><div><span>Verwässerung</span><b>${pctx(t.dil)}</b></div><div><span>ARR-Ziel in 4 Quartalen</span><b class="amb">${fmtE(t.tgt, 0)}</b></div><div><span>Abschluss-Chance</span><b class="${t.p < 0.5 ? 'dn' : ''}">~${fmt(t.p * 100, 0)} %</b></div>`; }
const negHTML = it => `<div class="vfc"><label class="vsl"><span>Nachverhandeln ${tip('Nachverhandeln', 'Du forderst eine höhere Bewertung als im besten Angebot.', 'Weniger Verwässerung, aber strengere Board-Ziele – und der Investor kann abspringen. Dann ist das Term Sheet weg.')}</span><input type="range" id="vneg-${it.id}" min="0.01" max="0.3" step="0.01" value="${negAsk(it.id)}" aria-label="Aufschlag auf die Bewertung"><b id="vneg-${it.id}-v">+${pctx(negAsk(it.id))}</b></label><div class="lines" id="vneg-${it.id}-l">${negLines(it)}</div><div class="vbtns"><button class="btn sm" data-a="vneg" data-id="${it.id}">Nachverhandeln</button></div></div>`;
document.addEventListener('input', ev => { const id = ev.target.id || ''; if (!id.startsWith('vneg-')) return; const iid = +id.slice(5), it = S.A.venture && S.A.venture.inbox.find(i => i.id === iid); if (!it) return; (S.UI.vNeg = S.UI.vNeg || {})[iid] = +ev.target.value; $(`#vneg-${iid}-v`).textContent = '+' + pctx(+ev.target.value); $(`#vneg-${iid}-l`).innerHTML = negLines(it); });
actions.vneg = async el => { const id = +el.dataset.id; el.disabled = true; await act({ type: 'vdecide', id, opt: 'neg', ask: negAsk(id) }); };
actions.vdec = el => act({ type: 'vdecide', id: +el.dataset.id, opt: el.dataset.v });

function fundUpdate(v) {
  const next = E.VC_ROUNDS.find(r => !v.rounds.includes(r.k));
  $('#v-fund').innerHTML = `<div class="lines"><div><span>Eingelegt</span><b class="num">${fmtE(v.invested, 0)}</b></div><div><span>Finanzierungsrunden</span><b>${v.rounds.length ? v.rounds.map(r => E.VC_ROUNDS.find(x => x.k === r).name).join(', ') : 'keine'}</b></div>
    ${next ? `<div><span>Nächste Runde (${next.name}) ${info('termsheet')}</span><b>${E.vm(v).trial ? 'nach Studienfortschritt' : `ab ${fmtE(next.arr * (E.vm(v).hyper ? 1 : 0.6), 0)} ARR`}</b></div>` : ''}
    <div><span>Board-Autorität ${info('mandate')}</span><b class="num ${(v.auth ?? 50) >= 60 ? 'up' : (v.auth ?? 50) < 40 ? 'dn' : ''}">${fmt(v.auth ?? 50, 0)} / 100</b></div>
    ${v.mand ? `<div><span>Board-Mandat</span><b class="amb">${fmtE(v.mand.arr, 0)} ARR bis Quartal ${v.mand.q + 1} · ${pctx(Math.min(1, v.arr / v.mand.arr))}</b></div>` : '<div><span>Board-Mandat</span><b class="fg2">keins</b></div>'}</div>
    <div class="row2" style="margin-top:10px"><label class="field"><span>Kapital einlegen ${info('credit')}</span><input class="inp" id="v-amt" inputmode="decimal" placeholder="z. B. 2.000"></label><span style="display:flex;align-items:flex-end"><button class="btn sm" data-a="vfund">Einlegen</button></span></div>`;
}
function capUpdate(v) {
  const rows = [['Du (Gründer)', v.capt.founder], ['Mitarbeiter (ESOP) ' + info('esop'), v.capt.esop], ...v.capt.inv.map(i => [`${esc(i.name)} · ${esc(i.round)}`, i.pct])].filter(r => r[1] > 0);
  $('#v-cap').innerHTML = `<div class="lines">${rows.map(([n, p]) => `<div><span>${n}</span><b class="num">${pctx(p, 1)}</b></div>`).join('')}</div><div class="meter" style="margin-top:8px;display:flex;overflow:hidden">${rows.map(([, p], i) => `<i style="width:${(p * 100).toFixed(1)}%;border-radius:0;background:${i === 0 ? 'var(--fg)' : i === 1 ? 'var(--fg2)' : 'var(--line2)'}"></i>`).join('')}</div><p class="note" style="margin-top:8px">Verwässerung ${info('dilution')}: Jede Runde gibt Anteile ab – dafür wächst die Bewertung.</p>`;
}
/* ---------- Führungsteam: Einstellung als Verhandlung (Gehalt ↔ Mitarbeiteranteile) ---------- */
function execUpdate(v) {
  const pay = EXEC_PAY[Math.min(v.stage, 3)];
  $('#v-exec').innerHTML = Object.entries(EXECS).map(([role, R]) => { const e = v.execs[role], a = e && R.a.find(x => x.k === e.k), mix = e ? (e.mix ?? (e.esop ? 1 : 0)) : 0;
    return `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><span class="label">${esc(R.name)}</span>${a ? `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><span><b>${esc(a.name)}</b><small class="fg2" style="display:block">${esc(a.desc)} · ${mix < 1 ? `${fmtE(pay * a.pay * (1 - mix), 0)} / Quartal` : ''}${mix > 0 && mix < 1 ? ' + ' : ''}${mix > 0 ? `${fmt(EXEC_ESOP * mix * 100, 1)} % ESOP` : ''}</small></span><button class="btn sm ghost" data-a="vfire" data-v="${role}">Entlassen</button></div>`
      : `<div class="stack" style="gap:6px;margin-top:4px">${R.a.map(x => `<div style="display:flex;gap:8px;align-items:center"><span style="flex:1;min-width:0"><b style="font-weight:500">${esc(x.name)}</b> ${tip(x.name, x.desc, role === 'cfo' ? `Prognose-Genauigkeit: Abweichung ${x.k === 'eff' ? '−60 %' : '−50 %'}.` : '')}<small class="fg2" style="display:block">${esc(x.desc)}</small></span><button class="btn sm ghost" data-a="vhire" data-r="${role}" data-v="${x.k}" data-fc="${E.FOCUS.cost.neg}">Verhandeln · ${E.FOCUS.cost.neg} Fokus</button></div>`).join('')}</div>`}</div>`; }).join('');
}
/* ---------- 3-Runden-Verhandlung: Balken für Interesse, Geduld, Stress; Züge rechnen lokal, Abschluss = 1 Request ---------- */
function openNeg(kind, title, sub, ctxExtra, seedSalt, terms, send) {
  const v = S.A.venture, ctx = Object.assign(E.negCtx(v), ctxExtra || {}), seed = E.negSeed(v, seedSalt), N = { moves: [] }, MV = E.NEG_MOVES[kind];
  const st = () => E.negPlay(kind, ctx, seed, N.moves);
  const nb = (n, val, col, txt) => `<div class="nb"><span>${n}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, val)).toFixed(0)}%;background:${col}"></i></span><b>${txt}</b></div>`;
  const body = () => { const S0 = st(); return `${nb('Interesse', S0.int, 'var(--up)', fmt(S0.int, 0))}${nb('Geduld', S0.pat / 3 * 100, 'var(--fg)', `${Math.max(0, S0.pat)}/3`)}${nb('Stress', S0.str, 'var(--dn)', fmt(S0.str, 0))}
    <div class="att">${esc(S0.att)}${S0.done ? ` · <b class="${S0.ok ? 'up' : 'dn'}">${S0.ok ? 'Einigung möglich' : esc(S0.why || 'kein Abschluss')}</b>` : ` · Runde ${S0.r + 1} von 3`}</div>
    ${N.moves.length ? `<div class="hist">Bisher: ${N.moves.map(m => esc(MV[m])).join(' → ')}</div>` : ''}
    <div class="mv">${Object.entries(MV).filter(([k]) => k !== 'fix').map(([k, l]) => `<button class="btn sm ghost" data-a="nmv" data-v="${k}" ${S0.done ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div>`; };
  actions.nmv = el => { N.moves.push(el.dataset.v); const b = $('#sh-neg'); if (b) b.innerHTML = body(); refreshReview(); };
  openReview({ title, sub, body: `<div class="vneg" id="sh-neg">${body()}</div>`, lines: () => terms(st()), totalLast: false,
    warn: () => { const S0 = st(); return S0.done && !S0.ok ? 'So kommt kein Abschluss zustande – der Fokus-Punkt ist trotzdem verbraucht.' : 'Die Gegenseite reagiert auf jeden Zug. „Abschließen“ sendet das Ergebnis – der Server spielt die Züge mit demselben Ausgang nach.'; },
    confirm: 'Abschließen', run: () => send(N.moves) });
}
actions.vnegopen = el => {
  const v = S.A.venture, it = v.inbox.find(i => i.id === +el.dataset.id); if (!it) return;
  if (it.k === 'vc') openNeg('vc', it.title, esc(it.data.inv), {}, it.id, S0 => { const T = E.negTermsOf('vc', S0, it.data); return [['Bewertung vor Geld', fmtE(T.pre, 0)], ['Frisches Kapital', fmtE(T.raise, 0)], ['Verwässerung', pctx(T.dil, 1), 'dilution'], ['Board-Mandat (4 Quartale)', `${fmtE(T.tgt, 0)} ARR`, 'mandate']]; }, moves => act({ type: 'vdecide', id: it.id, opt: 'neg', moves }, true));
  else openNeg('deal', it.title, 'Enterprise-Großdeal', {}, it.id, S0 => { const T = E.negTermsOf('deal', S0, it.data); return [['Neue Kunden', fmt(T.n, 0)], ['Rabatt', pctx(T.disc)], ['Laufzeit-Bindung', T.lock ? 'ja – weniger Kündigungen' : 'nein']]; }, moves => act({ type: 'vdecide', id: it.id, opt: 'neg', moves }, true));
};
actions.vhire = el => {
  const v = S.A.venture, role = el.dataset.r, R = EXECS[role], a = R.a.find(x => x.k === el.dataset.v), pay = EXEC_PAY[Math.min(v.stage, 3)] * a.pay;
  if ((v.focus || 0) < E.FOCUS.cost.neg) { S.toast(`Eine Verhandlung kostet ${E.FOCUS.cost.neg} Fokus.`, 'dn'); return; }
  openNeg('exec', `${a.name} als ${R.name}`, esc(a.desc), { rival: E.execRival(v) }, E.hashS(role + a.k), S0 => { const T = E.negTermsOf('exec', S0), w = JSON.parse(JSON.stringify(v)); w.execs = Object.assign({}, w.execs, { [role]: { k: a.k, mix: T.mix, pf: T.pay } });
    const rw0 = E.runway(v), rw1 = E.runway(w); return [['Gehalt je Quartal', fmtE(pay * T.pay * (1 - T.mix), 0)], ['Mitarbeiteranteile', fmt(EXEC_ESOP * T.mix * 100, 1) + ' %', 'esop'], ['Runway', `${isFinite(rw0) ? fmt(rw0, 1) : '∞'} → ${isFinite(rw1) ? fmt(rw1, 1) : '∞'} Monate`], ...(role === 'cfo' ? [['Prognose-Genauigkeit', `±${fmt(E.confBand(v) * 100, 0)} % → ±${fmt(E.confBand(w) * 100, 0)} %`, 'fcconf']] : [])]; },
    moves => act({ type: 'vexec', role, k: a.k, moves }, true));
};
actions.vfire = el => act({ type: 'vfire', role: el.dataset.v });
function ipoUpdate(v) {
  const sec = $('#v-ipo-sec'); sec.hidden = v.stage < 3; if (sec.hidden) return;
  const U = S.UI, band = U.vBand || 'fair', float = U.vFloat ?? 0.25, lock = U.vLock ?? 60, q = E.vIpoQuote(v, E.BANDS[band].disc, float);
  const busy = document.activeElement && sec.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
  if (busy) { $('#v-ipo-prev').innerHTML = ipoLines(q, float); return; }
  const ix = E.M.inst.WELTIX, mkt = ix && ix.cD && ix.cD.length > 20 ? ix.price / ix.cD[ix.cD.length - 20][4] - 1 : 0, dem = E.bookDemand({ pmf: v.pmf, auth: v.auth, mkt, hype: 0.03 * Math.min(5, (v.rel && v.rel.n) || 0) });
  $('#v-ipo').innerHTML = `<p class="note" style="margin:0 0 8px">${esc(v.name)} ist börsenreif. Erwartete Nachfrage der Investoren: <b>${dem >= 1.1 ? 'stark' : dem >= 0.9 ? 'ordentlich' : 'schwach'}</b> (PMF, Autorität, Launches, Marktlage).</p>
    <div class="vopts">${Object.entries(E.BANDS).map(([k, B]) => `<div class="vopt ${band === k ? 'on' : ''}" role="button" tabindex="0" data-a="vband" data-v="${k}">${tip(B.name, B.desc, k === 'aggr' ? 'Bei schwacher Nachfrage: Teil-Zeichnung, weniger Erlös und Kurssturz am ersten Tag.' : '')}<b>${B.name}</b><small>${B.disc >= 0 ? `${fmt(B.disc * 100, 0)} % Abschlag` : `${fmt(-B.disc * 100, 0)} % Aufschlag`}</small><small>${esc(B.desc)}</small></div>`).join('')}</div>
    <label class="field" style="margin-top:10px"><span>Free Float (neue Aktien): <b id="v-fv">${pctx(float)}</b></span><input type="range" id="v-float" min="15" max="40" value="${Math.round(float * 100)}"></label>
    <div><span class="label">Lock-up ${info('lockup')}</span><div class="seg" style="margin-top:6px">${[30, 60, 90].map(d => `<button data-a="vlock" data-v="${d}" class="${lock === d ? 'on' : ''}">${d} Tage</button>`).join('')}</div></div>
    <div class="lines" id="v-ipo-prev" style="margin-top:10px">${ipoLines(q, float)}</div><button class="btn" style="margin-top:10px" data-a="vipo">Bookbuilding starten</button>`;
}
actions.vband = el => { S.UI.vBand = el.dataset.v; ipoUpdate(S.A.venture); };
const ipoLines = (q) => `<div><span>Emissionspreis</span><b>${fmt(q.P, 2)} €</b></div><div><span>Börsenwert</span><b>${fmtE(q.P * q.shares, 0)}</b></div><div><span>Erlös für die Firmenkasse</span><b>${fmtE(q.raise, 0)}</b></div><div><span>Deine Aktien</span><b>${fmtE(q.after, 0)}</b></div><div><span>Neubewertung im Nettovermögen ${info('liqdisc')}</span><b class="${sc(q.reval)}">${signE(q.reval, 0)}</b></div>`;
function ipoRefresh() { const U = S.UI; U.vFloat = +$('#v-float').value / 100; $('#v-fv').textContent = pctx(U.vFloat); $('#v-ipo-prev').innerHTML = ipoLines(E.vIpoQuote(S.A.venture, E.BANDS[U.vBand || 'fair'].disc, U.vFloat)); }
inputs['v-float'] = ipoRefresh;

/* ---------- Gründung ---------- */
function foundHTML(v) {
  const prev = v ? (v.status === 'failed' ? `<div class="alert" style="margin-bottom:16px"><div class="t"><b>${esc(v.name)} ist insolvent</b>Die Beteiligung ist verloren, Schulden bleiben dir nicht. Gründe neu – mit dem Wissen von heute.</div></div>` : `<div class="alert amb" style="margin-bottom:16px"><div class="t"><b>${esc(v.name)} wurde verkauft</b>Exit für ${fmtE(v.exitPrice || 0, 0)} – dein Anteil: ${fmtE(v.exitMine || 0, 0)}.</div></div>`) : '';
  return `<div class="stack" style="gap:16px"><div><h1 class="h1">Ventures</h1><p class="lead" style="margin:6px 0 0">Gründe dein eigenes Startup, kämpfe um Marktanteile gegen die Börsenkonzerne und bring es an die Börse. Den Rest deines Geldes handelst du parallel weiter.</p></div>${prev}
    <div class="mgrid" id="v-models"></div>
    <div class="grid2"><div class="stack"><div class="row2"><label class="field"><span>Name deines Startups</span><input class="inp" id="v-name" maxlength="28" placeholder="z. B. Nimbus AI"></label><label class="field"><span>Startkapital (ab ${fmtE(VENTURE_MIN, 0)})</span><input class="inp" id="v-start" inputmode="decimal" value="4000"></label></div>
      <div class="lines" id="v-fprev"></div><button class="btn" data-a="vfound">Gründung prüfen</button></div>
      <aside><p class="note">Im Nettovermögen zählt dein Startup mit Abschlag ${info('liqdisc')}: 60 % in der Garage, 75 % in der Traction-Phase, 85 % im Scale-Up – erst nach dem Börsengang voll. Empfehlung: 3.000–5.000 € gründen, den Rest weiter an der Börse anlegen.</p></aside></div></div>`;
}
// Typische Dauer bis zur Börsenreife bei gutem Spiel (Simulation, Handelstage in Echtzeit)
const ROAD = { b2c: 'schnell, ca. 3–4 Monate', fintech: 'schnell, ca. 3–4 Monate', saas: 'mittel, ca. 4–5 Monate', deeptech: 'länger, ca. 5–7 Monate', cleantech: 'lang, ca. 6–8 Monate', biotech: 'lang und riskant, ca. 7–10 Monate' };
function foundUpdate() {
  const sel = S.UI.vModel || 'saas';
  $('#v-models').innerHTML = Object.entries(BIZ_MODELS).map(([k, m]) => `<div style="cursor:pointer;${sel === k ? 'outline:2px solid var(--fg);outline-offset:-2px;border-radius:10px;padding-left:12px' : ''}" data-a="vmodel" data-v="${k}" role="button" tabindex="0" aria-pressed="${sel === k}">
      <span class="label">${esc(SECTORS[m.sector])} · <span class="pill ${m.hyper ? 'ok' : 'n'}">${m.hyper ? 'Hyperscaling möglich' : 'wächst über CapEx'}</span></span><b style="font-size:16px">${esc(m.name)}</b><span class="small fg2">${esc(m.sub)}</span>
      <span class="small" style="margin-top:6px"><span class="up">+</span> ${esc(m.pro)}</span><span class="small"><span class="dn">−</span> ${esc(m.con)}</span><span class="small fg2" style="margin-top:4px">${esc(m.why)}</span>
      <span class="small" style="margin-top:4px">Weg zur Börse: <b>${ROAD[k] || ''}</b></span><span class="small fg2" style="margin-top:4px">Gegner: ${E.rivalsOf(m.sector).map(x => esc(x.name)).join(', ')}</span></div>`).join('');
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
actions.vfund = () => { const amt = parseNum($('#v-amt').value); if (!(amt > 0)) { S.toast('Bitte einen Betrag eingeben.', 'dn'); return; } const own = Math.max(0, S.A.cash); openReview({ title: 'Kapital einlegen', lines: [['Betrag', fmtE(amt, 0)], ['Aus Guthaben', fmtE(Math.min(own, amt), 0)], ['Über Wertpapierkredit', fmtE(Math.max(0, amt - own), 0)]], warn: amt > own ? 'Ein Teil wird über deinen Wertpapierkredit finanziert. Fallen deine Aktien, droht ein Margin Call.' : 'Keine Verwässerung – du behältst alle Anteile.', confirm: 'Einlegen', run: () => act({ type: 'vfund', amt }, true) }); };
actions.vlock = el => { S.UI.vLock = +el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); };
actions.vipo = () => { const v = S.A.venture, U = S.UI, band = U.vBand || 'fair', B = E.BANDS[band], float = U.vFloat ?? 0.25, lock = U.vLock ?? 60, q = E.vIpoQuote(v, B.disc, float);
  openReview({ title: `Bookbuilding ${v.name}`, lines: [['Preisspanne', B.name], ['Emissionspreis', fmt(q.P, 2) + ' €'], ['Free Float', pctx(float)], ['Lock-up', lock + ' Tage'], ['Erlös bei voller Zeichnung', fmtE(q.raise, 0)], ['Deine Aktien zum Emissionspreis', fmtE(q.after, 0)]], warn: `${B.desc} Danach ist dein Unternehmen eine normale Aktie mit Chart, Quartalszahlen und Beleihung (55 %). Während des Lock-ups kannst du nicht verkaufen.`, confirm: 'Börsenglocke läuten', run: () => act({ type: 'vipo', band, float, lock }, true) }); };

/* ---------- Nach dem Börsengang: CEO mit Guidance-Risiko ---------- */
function ceoHTML(v) {
  return `<div class="grid2"><div class="stack" style="gap:0"><div id="c-head"></div>
    <section class="sec"><h2>Nächste Quartalszahlen ${info('beatmiss')}</h2><div id="c-guid"></div></section>
    <section class="sec"><h2>Geschäft</h2><div class="lines" id="c-biz"></div></section>
    <section class="sec"><h2>Firmen-Ticker</h2><ul class="vtick" id="v-tick"></ul></section>
  </div><aside class="stack"><section class="sec" style="border-top:0;padding-top:0"><h2>Kapital an Aktionäre</h2><div id="c-cap"></div></section>
    <section class="sec"><h2 id="v-inbox-h">Entscheidungen</h2><div id="v-inbox"></div></section></aside></div>`;
}
// Quartalsprognose der gelisteten Firma: bisher verbucht + Vorschau bis zum Berichtstermin, Streuung wie im Startup
function ceoFc(v, x) {
  const days = Math.max(1, Math.round((x.fin.next - E.M.t) / 864e5)), f = E.forecast(v, {}, days), u = E.unit(v);
  const sRev = Math.max(1, (f.qrev - v.cur.rev) * f.band / 2), eps = f.qebit * 0.75 / x.shares, sEps = Math.max(1e-6, sRev * u.gm * 0.75 / x.shares);
  return { days, rev: f.qrev, eps, sRev, sEps, band: f.band };
}
function ceoUpdate(v) {
  const x = E.I(v.listedId); if (!x) return; const p = S.A.pos[x.id], u = E.unit(v);
  $('#c-head').innerHTML = `<span class="label">CEO · börsennotiert als ${esc(x.id)}</span><h1 class="h1" style="margin:2px 0 12px">${esc(v.name)}</h1>
    <div class="figs"><div><span class="label">Aktienkurs</span><b class="num">${fmt(x.price, 2)} €</b><span class="small ${sc(E.chg(x))}">${pctS(E.chg(x))} heute</span></div><div><span class="label">Börsenwert</span><b class="num">${big(x.price * x.shares)}</b><span class="small fg2">${fmt(x.shares / 1e6, 1)} Mio. Aktien</span></div>
      <div><span class="label">Deine Aktien</span><b class="num">${p ? big(p.qty * x.price) : '–'}</b><span class="small fg2">${p ? pctx(p.qty / x.shares, 1) : ''}${p && p.lock > E.M.t ? ` · Lock-up bis ${E.fDate(p.lock)}` : ''}</span></div><div><span class="label">Firmenkasse</span><b class="num">${big(v.cash)}</b></div></div>
    <div class="btns" style="margin-top:12px"><button class="btn sm ghost" data-go="i-${x.id}">Zur Aktie (Chart, Zahlen, Stop-Orders)</button></div>`;
  const busy = document.activeElement && ['c-buf', 'c-bb', 'c-dv'].includes(document.activeElement.id);
  if (!busy) {
    $('#c-guid').innerHTML = `<div class="lines"><div><span>Termin</span><b>${E.fDate(x.fin.next, true)}</b></div>${v.guid ? `<div><span>Deine Guidance</span><b class="num">${fmtBig(v.guid.rev)} € · ${fmt(v.guid.eps, 3)} € je Aktie</b></div>` : '<div><span>Deine Guidance</span><b class="amb">noch keine – es zählt die Analystenerwartung</b></div>'}</div>
      <label class="vsl" style="margin-top:10px"><span>Sicherheitspuffer ${tip('Sicherheitspuffer', 'Wie weit deine Guidance unter der Basisprognose liegt.', 'Mehr Puffer = höhere Chance auf einen Earnings Beat. Ohne Puffer oder darüber droht ein Miss mit Kursrücksetzer.')}</span><input type="range" id="c-buf" min="-10" max="20" step="1" value="${S.UI.cBuf ?? 5}" aria-label="Sicherheitspuffer"><b id="c-buf-v">${fmt(S.UI.cBuf ?? 5, 0)} %</b></label>
      <div class="lines" id="c-gl"></div>
      <div class="vbtns"><button class="btn sm" data-a="cguid">Guidance veröffentlichen</button></div>`;
    $('#c-cap').innerHTML = `<label class="field"><span>Aktienrückkauf aus der Firmenkasse</span><input class="inp" id="c-bb" inputmode="decimal" placeholder="Betrag"></label><button class="btn sm ghost" style="margin-top:6px" data-a="cbb">Zurückkaufen</button>
      <label class="field" style="margin-top:12px"><span>Sonderdividende</span><input class="inp" id="c-dv" inputmode="decimal" placeholder="Betrag"></label><button class="btn sm ghost" style="margin-top:6px" data-a="cdv">Ausschütten</button>
      <p class="note" style="margin-top:10px">Rivalen übernehmen: Kaufe 5 % an der Börse und gib in der Detailansicht ein Übernahmeangebot ab.</p>`;
  }
  guidLines(v, x);
  $('#c-biz').innerHTML = `<div><span>ARR</span><b class="num">${fmtE(v.arr, 0)}</b></div><div><span>Kunden</span><b class="num">${fmt(v.customers, 0)}</b></div><div><span>Marktanteil</span><b class="num">${pctx(u.share, 1)}</b></div><div><span>LTV / CAC</span><b class="num">${fmt(u.ratio, 1)}</b></div><div><span>Bruttomarge</span><b class="num">${pctx(u.gm)}</b></div>`;
  inboxUpdate(v); tickUpdate(v);
}
function guidLines(v, x) {
  const box = $('#c-gl'); if (!box) return; const g = ceoFc(v, x), buf = (S.UI.cBuf ?? 5) / 100, rev = g.rev * (1 - buf), eps = g.eps - Math.abs(g.eps) * buf * 1.5 - (g.eps < 0 ? 0 : 0);
  const pBeat = phi((g.eps - eps) / g.sEps - 0.02 * Math.abs(g.eps) / g.sEps), pMiss = 1 - phi((g.eps - eps) / g.sEps + 0.02 * Math.abs(g.eps) / g.sEps);
  S.UI.cG = { rev, eps };
  box.innerHTML = `<div><span>Basisprognose Umsatz</span><b class="num">${fmtBig(g.rev)} € <span class="fg2" style="font-weight:400">±${fmt(g.band * 50, 0)} %</span></b></div><div><span>Basisprognose Gewinn je Aktie</span><b class="num">${fmt(g.eps, 3)} €</b></div>
    <div><span>Deine Guidance</span><b class="num">${fmtBig(rev)} € · ${fmt(eps, 3)} €</b></div>
    <div><span>Chance auf Beat</span><b class="num ${pBeat > 0.6 ? 'up' : ''}">~${fmt(pBeat * 100, 0)} %</b></div><div><span>Risiko eines Miss</span><b class="num ${pMiss > 0.35 ? 'dn' : ''}">~${fmt(pMiss * 100, 0)} %</b></div>`;
}
inputs['c-buf'] = el => { S.UI.cBuf = +el.value; $('#c-buf-v').textContent = el.value + ' %'; const v = S.A.venture; guidLines(v, E.I(v.listedId)); };
actions.cguid = () => { const g = S.UI.cG; if (!g) return; act({ type: 'vguid', rev: g.rev, eps: g.eps }); };
actions.cbb = () => { const amt = parseNum($('#c-bb').value); openReview({ title: 'Aktienrückkauf', lines: [['Betrag', fmtE(amt, 0)]], warn: 'Weniger Aktien, mehr Gewinn je Aktie. Der Kauf bewegt den Kurs.', confirm: 'Zurückkaufen', run: () => act({ type: 'vbuyback', amt }, true) }); };
actions.cdv = () => { const amt = parseNum($('#c-dv').value); openReview({ title: 'Sonderdividende', lines: [['Betrag', fmtE(amt, 0)]], warn: 'Alle Aktionäre – auch du – erhalten ihren Anteil. Die Firmenkasse sinkt.', confirm: 'Ausschütten', run: () => act({ type: 'vdiv', amt }, true) }); };
