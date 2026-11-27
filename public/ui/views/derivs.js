// Hebelprodukte: Turbo, Faktor, Optionsschein, CFD – mit Vorschau, Prüfschritt und Positionsliste
import { S, E, esc, sc, pctS, signE, parseNum, act, actions, inputs, changes, $ } from '../store.js';
import { info } from '../glossary.js';
import { drawChart } from '../chart.js';
import { av } from '../parts.js';
import { openReview } from './order.js';
const { fmt, fmtE, fmtD, fmtBig, fmtPx, dig, fDate, chg, LIC, FACTORS, EXPIRIES, strikeList, estDeriv, derivValue, derivLev, derivName, optT, facRate, facMark, undCarry, cfdRate, availCash } = E;
const KINDS = [['ko', 'Turbo'], ['fac', 'Faktor'], ['opt', 'Option'], ['cfd', 'CFD']];
const LEVS = [2, 3, 5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 300, 500], CLEV = [1, 2, 5, 10, 20, 30, 50, 75, 100, 150, 200];

export function render(fixed) {
  const d = S.UI.dv; if (fixed) d.und = fixed;
  return `<div class="grid2" style="gap:48px"><div class="stack" style="gap:16px">
    ${fixed ? '' : `<p class="lead" style="margin:0">Mit Hebel auf steigende oder fallende Kurse setzen. Hohe Chancen, hohes Risiko – Totalverlust ist möglich. Der Emittent sichert jede Position am Markt ab, große Positionen bewegen also den Kurs.</p>`}
    <div class="stack" id="dv-form">${form(fixed)}</div>
  </div><div class="stack">
    ${fixed ? '' : `<div><span class="label" id="dv-uname"></span><canvas id="dv-chart" class="chart sm"></canvas></div>`}
    <section class="sec"${fixed ? ' style="border-top:0;padding-top:0"' : ''}><h2>Deine Hebelpositionen</h2><div class="rows" id="dv-pos"></div></section>
  </div></div>`;
}
function form(fixed) {
  const d = S.UI.dv, u = E.I(d.und), L = LIC[S.A.lic || 0];
  if (d.lev > L.ko) d.lev = Math.max(...LEVS.filter(l => l <= L.ko)); if (d.cfdLev > L.cfd) d.cfdLev = Math.max(...CLEV.filter(l => l <= L.cfd)); if (d.fac > L.fac) d.fac = Math.max(...FACTORS.filter(f => f <= L.fac));
  if (d.kind === 'opt' && !L.opt) d.kind = 'ko';
  const strikes = strikeList(u); if (d.strike >= strikes.length) d.strike = Math.floor(strikes.length / 2); S.dvStrikes = strikes;
  const und = fixed ? '' : `<label class="field"><span>Basiswert</span><select class="inp" id="dv-und">
    <optgroup label="Index"><option value="WELTIX" ${d.und === 'WELTIX' ? 'selected' : ''}>WELTIX 24</option></optgroup>
    ${[['stock', 'Aktien'], ['cmd', 'Rohstoffe'], ['fx', 'Devisen']].map(([c, l]) => `<optgroup label="${l}">${E.byCls(c).map(s => `<option value="${s.id}" ${d.und === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
  const dir = `<div class="seg" role="group" aria-label="Richtung"><button data-a="dvdir" data-v="1" class="${d.dir > 0 ? 'on' : ''}">Steigt (Long)</button><button data-a="dvdir" data-v="-1" class="${d.dir < 0 ? 'on' : ''}">Fällt (Short)</button></div>`;
  const budget = `<label class="field"><span>Betrag</span><input class="inp" id="dv-budget" inputmode="decimal" autocomplete="off" value="${esc(d.budget)}"></label>`;
  let body = '';
  if (d.kind === 'ko') body = dir + `<div class="row2"><label class="field"><span>Hebel ${info('lever')}</span><select class="inp" id="dv-lev">${LEVS.map(l => `<option value="${l}" ${d.lev === l ? 'selected' : ''} ${l > L.ko ? 'disabled' : ''}>${l}×${l > L.ko ? ' – Lizenz nötig' : ''}</option>`).join('')}</select></label>${budget}</div>`;
  else if (d.kind === 'fac') body = dir + `<div class="row2"><label class="field"><span>Faktor ${info('fac')}</span><select class="inp" id="dv-fac">${FACTORS.map(f => `<option value="${f}" ${d.fac === f ? 'selected' : ''} ${f > L.fac ? 'disabled' : ''}>${f}×${f > L.fac ? ' – Lizenz nötig' : ''}</option>`).join('')}</select></label>${budget}</div>`;
  else if (d.kind === 'opt') body = `<div class="seg" role="group"><button data-a="dvcp" data-v="C" class="${d.cp === 'C' ? 'on' : ''}">Call (steigt)</button><button data-a="dvcp" data-v="P" class="${d.cp === 'P' ? 'on' : ''}">Put (fällt)</button></div>
    <div class="row2"><label class="field"><span>Laufzeit</span><select class="inp" id="dv-exp">${EXPIRIES.map((e, i) => `<option value="${i}" ${d.exp === i ? 'selected' : ''}>${e.l}</option>`).join('')}</select></label>
    <label class="field"><span>Basispreis</span><select class="inp" id="dv-strike">${strikes.map((k, i) => `<option value="${i}" ${d.strike === i ? 'selected' : ''}>${fmt(k, dig(u))}</option>`).join('')}</select></label></div>${budget}`;
  else body = dir + `<div class="row2"><label class="field"><span>Hebel ${info('cfd')}</span><select class="inp" id="dv-clev">${CLEV.map(l => `<option value="${l}" ${d.cfdLev === l ? 'selected' : ''} ${l > L.cfd ? 'disabled' : ''}>1:${l}${l > L.cfd ? ' – Lizenz nötig' : ''}</option>`).join('')}</select></label>
    <label class="field"><span>Sicherheit (Margin)</span><input class="inp" id="dv-margin" inputmode="decimal" autocomplete="off" value="${esc(d.margin)}"></label></div>
    <div class="row2"><label class="field"><span>Stop-Loss (optional)</span><input class="inp" id="dv-sl" inputmode="decimal" autocomplete="off"></label><label class="field"><span>Take-Profit (optional)</span><input class="inp" id="dv-tp" inputmode="decimal" autocomplete="off"></label></div>`;
  return `${und}<div class="seg" role="tablist" aria-label="Produkt">${KINDS.map(k => `<button data-a="dvkind" data-v="${k[0]}" class="${d.kind === k[0] ? 'on' : ''}" ${k[0] === 'opt' && !L.opt ? 'title="Braucht die Derivate-Lizenz"' : ''}>${k[1]}</button>`).join('')}</div>
    ${body}<div class="chips">${[['100', '100 €'], ['500', '500 €'], ['1000', '1.000 €'], ['5000', '5.000 €'], ['max', 'Alles']].map(c => `<button class="chip" data-a="dvamt" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>
    <div class="lines" id="dv-est"></div>
    <button class="btn full" data-a="dvreview">Prüfen</button>
    ${(S.A.lic || 0) < 2 ? `<p class="note">Deine Lizenz: ${esc(L.name)}. Höhere Hebel und Optionsscheine schaltest du unter <button class="link" data-go="fortschritt">Fortschritt</button> frei.</p>` : ''}`;
}
export function readDv() {
  const d = S.UI.dv, b = $('#dv-budget'), m = $('#dv-margin'); if (b) d.budget = b.value; if (m) d.margin = m.value;
  const s = { kind: d.kind, und: d.und, dir: d.dir, lev: d.lev, fac: d.fac, cp: d.cp, exp: d.exp, K: (S.dvStrikes || [])[d.strike], cfdLev: d.cfdLev, budget: parseNum(d.budget), margin: parseNum(d.margin) };
  if (d.kind === 'cfd') { s.sl = parseNum(($('#dv-sl') || {}).value) || 0; s.tp = parseNum(($('#dv-tp') || {}).value) || 0; }
  return s;
}
// Vorschau als Zeilen [Bezeichnung, Wert, Begriff]
export function estLines(s) {
  const u = E.I(s.und), dg = dig(u); if (!((s.kind === 'cfd' ? s.margin : s.budget) > 0)) return null;
  const e = estDeriv(s);
  if (s.kind === 'ko') return { e, cost: e.cost, lines: [['Knock-out-Schwelle', `${fmtPx(u, e.p.K)} (${pctS((e.p.K - u.price) / u.price, 1)})`, 'ko'], ['Hebel', fmt(e.lev, 1) + '×', 'lever'], ['Stückzahl', fmt(e.n, 0)], ['Preis je Stück', fmtD(e.px)], ['Wirkt wie', fmtBig(e.exposure) + ' € im Basiswert'], ['Kurs bewegt sich durch Absicherung um', pctS(e.move, 3), 'impact']], warn: e.capped ? 'Begrenzt durch die Markttiefe des Basiswerts.' : `Fällt der Kurs um ${fmt(Math.abs((e.p.K - u.price) / u.price) * 100, 1)} %, ist der Einsatz komplett weg.` };
  if (s.kind === 'fac') return { e, cost: e.cost, lines: [['Hebel (täglich angepasst)', s.fac + '×', 'fac'], ['Stückzahl', fmt(e.n, 0)], ['Preis je Stück', fmtD(e.px)], ['Wirkt wie', fmtBig(e.exposure) + ' € im Basiswert'], [e.rate >= 0 ? 'Laufende Kosten' : 'Zinsertrag', fmt(Math.abs(e.rate) * 100, 2) + ' % p. a.']], warn: `Bewegt sich der Basiswert um ${fmt(100 / s.fac, 1)} % gegen dich, droht Totalverlust. In Seitwärtsphasen verliert das Zertifikat an Wert.` };
  if (s.kind === 'opt') return { e, cost: e.cost, lines: [['Basispreis', fmtPx(u, e.p.K)], ['Fälligkeit', fDate(e.p.exp, true)], ['Effektiver Hebel', fmt(e.omega, 1) + '×', 'opt'], ['Stückzahl', fmt(e.n, 0)], ['Preis je Stück', fmtD(e.px)], ['Lohnt sich ab Kurs', fmt(e.be, dg)]], warn: 'Bewegt sich bis zur Fälligkeit zu wenig, verfällt der Schein wertlos.' };
  return { e, cost: s.margin, lines: [['Positionsgröße', fmtBig(e.Q) + ' €'], ['Einstieg ca.', fmt(e.Se, dg)], ['Zwangsschließung bei', fmt(e.liq, dg), 'cfd'], ['Finanzierung über Nacht', fmt(cfdRate(u, s.dir) * 100, 2) + ' % p. a.']], warn: e.tooBig ? 'Übersteigt die Markttiefe – nicht ausführbar.' : 'Fällt dein Kapital auf 50 % der Margin, wird automatisch geschlossen.' };
}
export function updateEst() {
  const box = $('#dv-est'); if (!box) return;
  const s = readDv(), r = (() => { try { return estLines(s); } catch { return null; } })();
  const closed = E.M.isOpen ? '' : `<p class="warn">Börse geschlossen – Hebelprodukte gibt es ab ${E.fDate(E.nextOpenFrom(E.M.t), true).slice(0, 9)} 08:00.</p>`;
  if (!r) { box.innerHTML = `<p class="note">Betrag eingeben, um die Vorschau zu sehen.</p>${closed}`; return; }
  box.innerHTML = r.lines.map(l => `<div><span>${l[0]} ${l[2] ? info(l[2]) : ''}</span><b>${l[1]}</b></div>`).join('') + `<div class="tot"><span>Kosten</span><b>${fmtE(r.cost)}</b></div><p class="note">${esc(r.warn)}</p>${r.cost > availCash(S.A, undefined, true) + 1e-6 ? '<p class="warn">Übersteigt dein freies Guthaben.</p>' : ''}${closed}`;
}
export function update() {
  const u = E.I(S.UI.dv.und), nm = $('#dv-uname');
  if (nm) { nm.innerHTML = `${esc(u.name)} · <span class="${sc(chg(u))}">${fmtPx(u, u.price)} ${pctS(chg(u))}</span>`; drawChart($('#dv-chart'), u.c1.length > 20 ? u.c1 : u.cD.slice(-120), { digits: dig(u), daily: u.c1.length <= 20, ref: u.pc }); }
  updateEst();
  const A = S.A;
  $('#dv-pos').innerHTML = A.derivs.length ? A.derivs.map(p => {
    const v = derivValue(p), g = v - p.cost, lev = derivLev(p), un = E.I(p.und);
    const extra = p.kind === 'ko' ? `Abstand zum Knock-out ${pctS((p.K - un.price) / un.price, 1)}` : p.kind === 'opt' ? `noch ${fmt(optT(p) * 365, 0)} Tage` : p.kind === 'fac' ? `Kosten ${fmt(facRate(un, p.dir, p.F) * 100, 1)} % p. a.` : `Einstieg ${fmt(p.entry, dig(un))}`;
    const conf = S.confirmClose === p.pid;
    return `<div class="r" style="cursor:default">${av(un)}<span style="min-width:0"><span class="nm" style="display:block">${esc(derivName(p))}</span><span class="sub" style="display:block">${esc(extra)} · Hebel ${isFinite(lev) ? fmt(lev, 1) + '×' : '–'}</span></span><span class="val"><b>${fmtE(v)}</b><small class="${sc(g)}">${signE(g)} (${pctS(p.cost ? g / p.cost : 0)})</small></span><span class="btns" style="flex-wrap:nowrap"><button class="btn sm ghost" data-a="aedit" data-tg="der" data-ref="${p.pid}" data-id="0" title="Stop-Loss / Take-Profit auf den Basiswert">${(S.A.auto || []).some(o => o.tg === 'der' && String(o.ref) === String(p.pid)) ? 'SL/TP ✓' : 'SL/TP'}</button><button class="btn sm ghost" data-a="dvclose" data-v="${p.pid}" data-f="0.5">½</button><button class="btn sm ${conf ? '' : 'ghost'}" data-a="dvclose" data-v="${p.pid}" data-f="1">${conf ? 'Wirklich?' : 'Schließen'}</button></span></div>`;
  }).join('') : '<p class="empty">Keine offenen Hebelpositionen.</p>';
}
export function rebuild() { const f = $('#dv-form'); if (!f) return; const fixed = S.UI.route.startsWith("i-") ? S.UI.route.slice(2) : null; f.innerHTML = form(fixed); update(); }
actions.dvkind = el => { readDv(); const L = LIC[S.A.lic || 0]; if (el.dataset.v === 'opt' && !L.opt) { S.toast('Optionsscheine brauchen die Derivate-Lizenz (unter Fortschritt).', 'dn'); return; } S.UI.dv.kind = el.dataset.v; rebuild(); };
actions.dvdir = el => { readDv(); S.UI.dv.dir = +el.dataset.v; rebuild(); };
actions.dvcp = el => { readDv(); S.UI.dv.cp = el.dataset.v; rebuild(); };
actions.dvamt = el => { const f = S.UI.dv.kind === 'cfd' ? $('#dv-margin') : $('#dv-budget'); f.value = el.dataset.v === 'max' ? String(Math.floor(Math.max(0, availCash(S.A, undefined, true)) * 100) / 100).replace('.', ',') : el.dataset.v; readDv(); updateEst(); };
actions.dvreview = () => {
  const s = readDv(), r = (() => { try { return estLines(s); } catch { return null; } })(); if (!r) { S.toast('Bitte einen Betrag eingeben.', 'dn'); return; }
  const u = E.I(s.und), name = s.kind === 'opt' ? `${s.cp === 'C' ? 'Call' : 'Put'} auf ${u.name}` : `${{ ko: 'Turbo', fac: `Faktor ${s.fac}×`, cfd: 'CFD' }[s.kind]} ${s.dir > 0 ? 'Long' : 'Short'} auf ${u.name}`;
  openReview({ title: name, lines: r.lines.concat([['Kosten', fmtE(r.cost)]]), warn: r.warn, confirm: 'Jetzt kaufen', run: () => act(Object.assign({ type: 'deriv' }, s), true) });
};
actions.dvclose = async el => {
  const pid = +el.dataset.v, f = +el.dataset.f;
  if (f === 1 && S.confirmClose !== pid) { S.confirmClose = pid; update(); setTimeout(() => { if (S.confirmClose === pid) { S.confirmClose = null; if ($('#dv-pos')) update(); } }, 4000); return; }
  S.confirmClose = null; el.disabled = true; await act({ type: 'close', pid, frac: f });
};
changes['dv-und'] = el => { readDv(); S.UI.dv.und = el.value; S.UI.dv.strike = 4; rebuild(); };
changes['dv-lev'] = el => { S.UI.dv.lev = +el.value; updateEst(); };
changes['dv-fac'] = el => { S.UI.dv.fac = +el.value; updateEst(); };
changes['dv-clev'] = el => { S.UI.dv.cfdLev = +el.value; updateEst(); };
changes['dv-exp'] = el => { S.UI.dv.exp = +el.value; updateEst(); };
changes['dv-strike'] = el => { S.UI.dv.strike = +el.value; updateEst(); };
for (const id of ['dv-budget', 'dv-margin', 'dv-sl', 'dv-tp']) inputs[id] = () => { readDv(); updateEst(); };
