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
  return `<div class="grid2"><div class="stack" style="gap:0">
    <div id="v-head"></div>
    <section class="sec"><h2>Firmen-Puls</h2><div id="v-pulse"></div></section>
    <section class="sec"><h2>Strategy War Room ${info('fcconf')}</h2><div class="vwar" id="v-war"></div></section>
    <section class="sec"><h2>Gründer-Sprints ${info('sprint')}</h2><div id="v-spr"></div></section>
    <section class="sec"><h2>Markt-Duell ${info('segment')}</h2><div id="v-duel"></div></section>
    <section class="sec"><h2>Unit Economics</h2><div class="lines" id="v-unit"></div></section>
    <section class="sec"><h2>Board-Berichte · Plan vs. Ist ${info('planist')}</h2><canvas class="bars" id="v-bars" aria-label="ARR je Quartal"></canvas><div class="tbl vq" id="v-q" style="margin-top:8px"></div></section>
  </div><aside class="stack">
    <section class="sec" style="border-top:0;padding-top:0"><h2 id="v-inbox-h">Entscheidungen</h2><div id="v-inbox"></div></section>
    <section class="sec"><h2>Firmen-Ticker</h2><ul class="vtick" id="v-tick"></ul></section>
    <section class="sec"><h2>Finanzierung</h2><div id="v-fund"></div></section>
    <section class="sec"><h2>Cap Table ${info('captable')}</h2><div id="v-cap"></div></section>
    <section class="sec"><h2>Führungsteam</h2><div id="v-exec"></div></section>
    <section class="sec" id="v-ipo-sec" hidden><h2>Börsengang ${info('ipo')}</h2><div id="v-ipo"></div></section>
  </aside></div>`;
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
    ${v.cash < 0 ? `<div class="alert" style="margin-top:14px"><div class="t"><b>Die Kasse ist leer</b>Lege Kapital ein, nimm eine Finanzierung an oder senke im War Room die Ausgaben – nach drei Quartalen im Minus ist ${esc(v.name)} insolvent.</div></div>` : rw < 6 ? `<div class="alert amb" style="margin-top:14px"><div class="t"><b>Runway unter 6 Monaten</b>Plane die nächste Finanzierung oder senke im War Room das Tempo.</div></div>` : ''}`;
  pulseUpdate(v); warUpdate(v); sprintUpdate(v); duelUpdate(v, u);
  const ltvTone = u.ratio >= 3 ? 'up' : u.ratio >= 1 ? 'amb' : 'dn';
  $('#v-unit').innerHTML = `<div><span>Product-Market Fit ${info('pmf')}</span><b style="min-width:160px"><span class="meter" style="display:block;margin-bottom:4px"><i class="${v.pmf >= 0.8 ? 'ok' : v.pmf >= 0.5 ? 'warn' : 'crit'}" style="width:${(v.pmf * 100).toFixed(0)}%"></i></span>${pctx(v.pmf)}</b></div>
    <div><span>Kunden</span><b class="num">${fmt(v.customers, v.customers < 100 ? 1 : 0)}</b></div>
    <div><span>Kundenakquisekosten (CAC) ${info('cac')}</span><b class="num">${fmtE(u.cac, 0)}</b></div>
    <div><span>Kundenwert (LTV) ${info('ltv')}</span><b class="num">${fmtE(u.ltv, 0)}</b></div>
    <div><span>LTV / CAC ${info('ltvcac')}</span><b class="num ${ltvTone}">${fmt(u.ratio, 1)}</b></div>
    <div><span>Abwanderung pro Quartal ${info('churn')}</span><b class="num ${u.churn > 0.12 ? 'dn' : ''}">${pctx(u.churn, 1)}</b></div>
    <div><span>Bruttomarge ${info('margcost')}</span><b class="num">${pctx(u.gm)}</b></div>
    <div><span>Burn Rate ${info('burn')}</span><b class="num">${E.burnM(v) > 0 ? fmtE(E.burnM(v), 0) + ' / Monat' : 'kein Burn'}</b></div>
    <div><span>Produktqualität</span><b class="num ${v.quality < 0.8 ? 'amb' : ''}">${pctx(Math.min(1, v.quality))}</b></div>
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

/* ---------- Gründer-Sprints ---------- */
const SPR_FX = {
  deal: q => `Bei Erfolg ${fmt(q.lo, q.lo < 10 ? 1 : 0)}–${fmt(q.hi, q.hi < 10 ? 1 : 0)} neue Großkunden mit 30 % höherem Ticket. Scheitert der Pitch, ist das Geld weg.`,
  product: () => 'Bei Erfolg Qualität +6, PMF +3 Punkte (mit Visionär-CTO +5) und weniger Fixkosten aus dem Hyperscaling-Team. Sonst etwa ein Drittel davon.',
  audit: q => q.cut ? 'Bei Erfolg Fixkosten dauerhaft −3 % (bis −15 % insgesamt). In jedem Fall ein Quartal lang 10 % weniger Abschlüsse.' : 'Die Fixkosten sind bereits maximal gesenkt – nur noch die Bremswirkung bleibt.'
};
function sprintUpdate(v) {
  const act0 = v.sp || [], used = v.spQ || {};
  const running = act0.map(s => { const done = (s.D - s.d) / s.D, name = s.k === 'attack' ? `${CAMPAIGNS[s.sub].name} · ${esc(E.I(s.r) ? E.I(s.r).name : '')}` : E.SPRINTS[s.k].name;
    return `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;font-size:14px"><b style="font-weight:500">${esc(name)}</b><span class="small fg2" style="font-variant-numeric:tabular-nums">noch ${s.d} Tag${s.d === 1 ? '' : 'e'} · Chance ~${fmt(s.p * 100, 0)} %</span></div><div class="vprog" style="margin:6px 0 0"><i style="width:${(done * 100).toFixed(0)}%"></i></div></div>`; }).join('');
  const cards = ['deal', 'product', 'audit'].map(k => { const S0 = E.SPRINTS[k], q = E.sprintQuote(v, k), busy = act0.some(s => s.k === k), once = used[k] === v.qi, full = act0.length >= 2, poor = v.cash < q.cost;
    return `<div><b style="font-size:14px;padding-right:22px">${esc(S0.name)}</b>${tip(S0.name, S0.desc, SPR_FX[k](q))}<span class="num">${fmtE(q.cost, 0)} · ${q.days} Tage · Chance ~${fmt(q.p * 100, 0)} %</span><small>${esc(SPR_FX[k](q))}</small>
      <button class="btn sm ${busy || once || full || poor ? 'ghost' : ''}" style="margin-top:6px" data-a="vspr" data-v="${k}" ${busy || once || full || poor ? 'disabled' : ''}>${busy ? 'Läuft' : once ? 'Nächstes Quartal wieder' : full ? 'Max. 2 aktiv' : poor ? 'Kasse reicht nicht' : 'Starten'}</button></div>`; }).join('');
  $('#v-spr').innerHTML = `${running ? `<div style="margin-bottom:12px">${running}</div>` : ''}<div class="vspr">${cards}</div><p class="small fg2" style="margin:8px 0 0">Optional: Der Autopilot läuft auch ohne Sprints. Attacken auf Rivalen startest du im Markt-Duell.</p>`;
}
actions.vspr = async el => { el.disabled = true; await act({ type: 'vsprint', k: el.dataset.v }); };

/* ---------- Markt-Duell: TAM-Balken, Rivalen-Profile, gezielte Attacken ---------- */
const RIVC = ['var(--fg2)', 'var(--line2)', 'var(--mute)'];
function duelUpdate(v, u) {
  const T = E.segTAM(v), riv = v.rivals.map(id => E.I(id)).filter(Boolean), open = S.UI.vRiv;
  const seg = [[`${esc(v.name)}`, u.share, 'var(--up)'], ...riv.map((x, i) => [esc(x.name), (1 - u.share) * (v.w[x.id] || 0) * 0.6, RIVC[i % 3]])], rest = Math.max(0, 1 - seg.reduce((s, r) => s + r[1], 0));
  const busyAtk = (v.sp || []).some(s => s.k === 'attack'), onceAtk = (v.spQ || {}).attack === v.qi;
  const rows = riv.map((x, i) => { const pr = E.rivalProfile(x), sh = (1 - u.share) * (v.w[x.id] || 0) * 0.6, isO = open === x.id;
    return `<button type="button" class="vriv" data-a="vriv" data-v="${x.id}" aria-expanded="${isO}"><span><span class="sw" style="background:${RIVC[i % 3]}"></span>${esc(x.name)} <small class="fg2">· ${esc(pr.name)}</small></span><b>${pctx(sh, 1)}${v.lost[x.id] ? ` <small class="up" style="font-weight:400">−${fmt(v.lost[x.id] * 100, 1)} Pp</small>` : ''}</b></button>
      ${isO ? `<div class="vprof"><p class="small" style="margin:0 0 8px">${esc(pr.desc)}</p><div class="lines"><div><span>Aktie</span><b>${fmt(x.price, 2)} € <span class="${sc(E.chg(x))}" style="font-weight:400">${pctS(E.chg(x))}</span></b></div><div><span>Quartalsumsatz</span><b>${fmtBig(x.fin ? x.fin.rev : 0)} €</b></div></div>
        <div class="vspr" style="margin-top:10px">${Object.entries(CAMPAIGNS).map(([k, C]) => { const q = E.sprintQuote(v, 'attack', k), dis = busyAtk || onceAtk || (v.sp || []).length >= 2 || v.cash < q.cost;
          return `<div><b style="font-size:13px;padding-right:22px">${esc(C.name)}</b>${tip(C.name, C.desc, `Läuft ${q.days} Handelstage. Erfolgschance ~${fmt(q.p * 100, 0)} % – bei Misserfolg halbe Wirkung.`)}<span class="num">${fmtE(q.cost, 0)} · ~${fmt(q.p * 100, 0)} %</span><button class="btn sm ghost" data-a="vatk" data-r="${x.id}" data-v="${k}" ${dis ? 'disabled' : ''}>${busyAtk ? 'Attacke läuft' : onceAtk ? 'Nächstes Quartal' : 'Angreifen'}</button></div>`; }).join('')}</div>
        <button class="btn sm ghost" style="margin-top:10px" data-go="i-${x.id}">Zur Aktie ${esc(x.id)}</button></div>` : ''}`; }).join('');
  $('#v-duel').innerHTML = `<div class="lines"><div><span>Marktsegment (TAM)</span><b class="num">${big(T)}</b></div><div><span><b>${esc(v.name)}</b></span><b class="up num">${pctx(u.share, 2)}</b></div></div>
    <div class="vtam" role="img" aria-label="Marktanteile im Segment">${seg.map(r => `<i style="width:${Math.max(r[1] > 0 ? 0.6 : 0, r[1] * 100).toFixed(2)}%;background:${r[2]}" title="${r[0]}: ${pctx(r[1], 1)}"></i>`).join('')}<i style="width:${(rest * 100).toFixed(2)}%;background:var(--bg2)" title="Übrige Anbieter"></i></div>${rows}
    <p class="small fg2" style="margin:8px 0 0">Tippe auf einen Rivalen für sein Profil und gezielte Attacken. Gewonnene Anteile kosten ihn echten Umsatz in den nächsten Quartalszahlen.</p>`;
}
actions.vriv = el => { S.UI.vRiv = S.UI.vRiv === el.dataset.v ? null : el.dataset.v; duelUpdate(S.A.venture, E.unit(S.A.venture)); };
actions.vatk = async el => { el.disabled = true; await act({ type: 'vsprint', k: 'attack', sub: el.dataset.v, rival: el.dataset.r }); };

/* ---------- Inbox: Optionen mit Erklärbutton und Vorschau, Term-Sheet-Nachverhandlung ---------- */
function explain(v, it, o) {
  const u = E.unit(v), cash = Math.max(0, v.cash), d = it.data || {}, cto = !!(v.execs && v.execs.cto);
  const T = {
    vc: { hi: ['Hohe Bewertung', 'Weniger Verwässerung, dafür ein hartes ARR-Ziel in 4 Quartalen.', `Verfehlst du ${fmtE(d.tgt || 0, 0)} ARR, sinkt die Board-Stimmung um 20 und die nächste Runde wird mit Abschlag bewertet (Down Round).`],
      lo: ['Moderate Bewertung', 'Du gibst mehr Anteile ab, bekommst aber Geld ohne harte Ziele.', 'Sicherer Weg zu frischem Kapital – ideal, wenn die Runway knapp ist.'],
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
      ${it.k === 'vc' ? negHTML(it) : ''}
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
    ${v.target ? `<div><span>Ziel der Investoren</span><b class="amb">${fmtE(v.target.arr, 0)} ARR bis Quartal ${v.target.q + 1}</b></div>` : ''}</div>
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
      : `<div class="stack" style="gap:6px;margin-top:4px">${R.a.map(x => `<div style="display:flex;gap:8px;align-items:center"><span style="flex:1;min-width:0"><b style="font-weight:500">${esc(x.name)}</b> ${tip(x.name, x.desc, role === 'cfo' ? `Prognose-Genauigkeit: Abweichung ${x.k === 'eff' ? '−60 %' : '−50 %'}.` : '')}<small class="fg2" style="display:block">${esc(x.desc)}</small></span><button class="btn sm ghost" data-a="vhire" data-r="${role}" data-v="${x.k}">Verhandeln</button></div>`).join('')}</div>`}</div>`; }).join('');
}
actions.vhire = el => {
  const v = S.A.venture, role = el.dataset.r, R = EXECS[role], a = R.a.find(x => x.k === el.dataset.v), pay = EXEC_PAY[Math.min(v.stage, 3)] * a.pay;
  S.UI.vMix = 0.5; const mix = () => S.UI.vMix;
  const after = () => { const w = JSON.parse(JSON.stringify(v)); w.execs = Object.assign({}, w.execs, { [role]: { k: a.k, mix: mix() } }); return w; };
  inputs['sh-mix'] = el2 => { S.UI.vMix = +el2.value / 100; $('#sh-mix-v').textContent = `${fmt((1 - mix()) * 100, 0)} % Gehalt · ${fmt(mix() * 100, 0)} % Anteile`; refreshReview(); };
  openReview({ title: `${a.name} als ${R.name}`, sub: esc(a.desc),
    body: `<label class="vsl" style="margin-bottom:8px"><span>Vergütung ${tip('Gehalt oder Anteile', 'Gehalt belastet jedes Quartal die Firmenkasse. Mitarbeiteranteile (ESOP) kosten kein Geld, verwässern aber deinen Gründeranteil.', 'Bei knapper Runway lieber Anteile, bei großem Gründeranteil eher Gehalt.')}</span><input type="range" id="sh-mix" min="0" max="100" step="5" value="50" aria-label="Anteil der Vergütung in Mitarbeiteranteilen"><b id="sh-mix-v" style="min-width:150px">50 % Gehalt · 50 % Anteile</b></label>`,
    lines: () => { const w = after(), rw0 = E.runway(v), rw1 = E.runway(w), b0 = E.confBand(v), b1 = E.confBand(w), pct = EXEC_ESOP * mix();
      return [['Gehalt je Quartal', fmtE(pay * (1 - mix()), 0)], ['Mitarbeiteranteile', fmt(pct * 100, 1) + ' %'], ['Runway', `${isFinite(rw0) ? fmt(rw0, 1) : '∞'} → ${isFinite(rw1) ? fmt(rw1, 1) : '∞'} Monate`, 'runway'], ...(role === 'cfo' ? [['Prognose-Genauigkeit', `±${fmt(b0 * 100, 0)} % → ±${fmt(b1 * 100, 0)} %`, 'fcconf']] : []), ['Dein Gründeranteil danach', pctx(Math.max(0, v.capt.founder - pct), 1)]]; },
    warn: () => mix() > 0 ? 'Die Anteile kommen aus deinem Gründeranteil – Verwässerung ohne frisches Geld.' : 'Reines Gehalt: kein Anteil geht verloren, aber die Burn Rate steigt.',
    confirm: 'Einstellen', run: () => act({ type: 'vexec', role, k: a.k, mix: mix() }, true) });
};
actions.vfire = el => act({ type: 'vfire', role: el.dataset.v });
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
actions.vipo = () => { const v = S.A.venture, U = S.UI, disc = U.vDisc ?? 0.1, float = U.vFloat ?? 0.25, lock = U.vLock ?? 60, q = E.vIpoQuote(v, disc, float);
  openReview({ title: `Börsengang ${v.name}`, lines: [['Emissionspreis', fmt(q.P, 2) + ' €'], ['Free Float', pctx(float)], ['Lock-up', lock + ' Tage'], ['Erlös für die Firma', fmtE(q.raise, 0)], ['Deine Aktien zum Emissionspreis', fmtE(q.after, 0)], ['Neubewertung im Nettovermögen', signE(q.reval, 0)]], warn: 'Danach ist dein Unternehmen eine normale Aktie: Chart, Quartalszahlen, Stop-Orders und Beleihung (55 %) funktionieren wie bei jedem Wert. Während des Lock-ups kannst du nicht verkaufen.', confirm: 'Börsenglocke läuten', run: () => act({ type: 'vipo', disc, float, lock }, true) }); };

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
