// Order-Sheet: Eingabe → Prüfen → Bestätigung. Für Wertpapiere, Fonds und als Prüfschritt für Hebelprodukte und Kontoaktionen.
import { S, E, esc, sc, pctS, parseNum, act, actions, inputs, changes, $ } from '../store.js';
import { info } from '../glossary.js';
const { fmt, fmtE, fmtPx, fmtQty, dig, availCash, estimateExchange, maxBuyQty, roundQty, settleVal, reservedUnits, avgRatio, fDate } = E;

let cur = null; // { kind: 'order'|'fund'|'review', ... }
const host = () => $('#sheet');
export const isOpenSheet = () => !!cur;
export function close() { cur = null; host().innerHTML = ''; document.body.style.overflow = ''; if (S.lastFocus && S.lastFocus.focus) S.lastFocus.focus(); }
function frame(inner) { host().innerHTML = `<div class="scrim" data-a="sheetbg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">${inner}</div></div>`; document.body.style.overflow = 'hidden'; }
const top = (title, sub) => `<div class="top"><div><h3 id="sh-t">${esc(title)}</h3>${sub ? `<span class="small fg2">${sub}</span>` : ''}</div><button class="x" data-a="sheetx" aria-label="Schließen">×</button></div>`;
const doneHTML = (ok, title, text) => `<div class="done ${ok ? '' : 'fail'}"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28"/>${ok ? '<path d="M20 33l8 8 16-17"/>' : '<path d="M23 23l18 18M41 23L23 41"/>'}</svg><h3>${esc(title)}</h3><p class="fg2" style="margin:0">${text}</p></div><button class="btn full" data-a="${ok ? 'sheetx' : 'sheetback'}">${ok ? 'Fertig' : 'Zurück'}</button>`;

/* ---------- Börsenorder ---------- */
export function openOrder(id, side) {
  const x = E.I(id); if (!x) return;
  S.lastFocus = document.activeElement;
  if (x.cls === 'fund') { cur = { kind: 'fund', id, side: side || 'buy', step: 'form', val: '' }; renderFund(); return; }
  cur = { kind: 'order', id, side: side || 'buy', mode: x.cls === 'bond' ? 'qty' : 'amt', type: E.M.isOpen ? 'market' : 'limit', val: '', limit: '', stop: '', gtc: false, step: 'form' };
  renderOrder(); setTimeout(() => { const i = $('#o-amt'); if (i) i.focus(); }, 30);
}
function orderSpec() {
  const o = cur, x = E.I(o.id), A = S.A, v = parseNum(o.val), lim = o.type === 'limit' || o.type === 'stoplimit' ? parseNum(o.limit) : 0;
  let qty = 0;
  if (v > 0) {
    if (o.mode === 'qty') qty = roundQty(x, v);
    else if (o.side === 'buy') qty = maxBuyQty(x, v, o.type === 'limit' && lim > 0 ? lim : 0, A);
    else qty = roundQty(x, v / settleVal(x, x.price));
  }
  const e = qty > 0 ? estimateExchange(x, o.side, qty, o.type === 'limit' && lim > 0 ? lim : 0, A) : null;
  return { x, qty, e, lim, stop: parseNum(o.stop) };
}
function renderOrder() {
  const o = cur, x = E.I(o.id), buy = o.side === 'buy';
  if (o.step === 'form') {
    const unit = o.mode === 'amt' ? '€' : x.cls === 'bond' ? '€ nom.' : 'Stk.', p = S.A.pos[x.id];
    frame(`${top(buy ? 'Kaufen' : 'Verkaufen', `${esc(x.name)} · ${fmtPx(x, x.price)}`)}
      <div class="seg" role="group"><button data-a="oside" data-v="buy" class="${buy ? 'on' : ''}">Kaufen</button><button data-a="oside" data-v="sell" class="${!buy ? 'on' : ''}" ${p ? '' : 'disabled'}>Verkaufen</button></div>
      <div><div class="amount-wrap"><input class="amount" id="o-amt" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(o.val)}" aria-label="${o.mode === 'amt' ? 'Betrag in Euro' : 'Stückzahl'}"><span class="unit">${unit}</span></div>
      ${x.cls !== 'bond' ? `<div class="chips" style="margin-top:10px"><button class="chip ${o.mode === 'amt' ? 'on' : ''}" data-a="omode" data-v="amt">Betrag</button><button class="chip ${o.mode === 'qty' ? 'on' : ''}" data-a="omode" data-v="qty">Stück</button></div>` : ''}</div>
      <div class="chips">${(buy ? (o.mode === 'amt' ? [['50', '50 €'], ['100', '100 €'], ['500', '500 €'], ['1000', '1.000 €'], ['max', 'Max']] : [['1', '1'], ['5', '5'], ['10', '10'], ['max', 'Max']]) : [['0.25', '25 %'], ['0.5', '50 %'], ['1', 'Alles']]).map(c => `<button class="chip" data-a="oquick" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>
      <details class="more" ${o.type !== 'market' ? 'open' : ''}><summary>Ordertyp: ${{ market: 'Market (sofort)', limit: 'Limit', stop: 'Stop', stoplimit: 'Stop-Limit' }[o.type]}</summary>
        <div class="stack" style="padding-bottom:12px"><label class="field"><span>Ordertyp ${info('limit')}</span><select class="inp" id="o-type">${[['market', 'Market – sofort zum besten Kurs'], ['limit', 'Limit – nur zu meinem Kurs oder besser'], ['stop', 'Stop – auslösen ab Kurs'], ['stoplimit', 'Stop-Limit']].map(t => `<option value="${t[0]}" ${o.type === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></label>
        ${o.type !== 'market' ? `<div class="row2">${o.type !== 'limit' ? `<label class="field"><span>Stoppkurs</span><input class="inp" id="o-stop" inputmode="decimal" value="${esc(o.stop)}"></label>` : ''}${o.type !== 'stop' ? `<label class="field"><span>Limit</span><input class="inp" id="o-lim" inputmode="decimal" value="${esc(o.limit)}"></label>` : ''}</div>
        <label class="setting" style="border:0;padding:0"><span class="t"><b>Bis auf Widerruf gültig</b><small>Sonst verfällt die Order um 22:00 Uhr.</small></span><button type="button" class="toggle ${o.gtc ? 'on' : ''}" data-a="ogtc" aria-pressed="${o.gtc}" aria-label="Bis auf Widerruf"></button></label>` : ''}</div></details>
      <div class="lines" id="o-prev"></div>
      <button class="btn full" id="o-go" data-a="oreview">Order prüfen</button>`);
    updateOrder();
  } else if (o.step === 'review') {
    const s = orderSpec(), e = s.e, A = S.A, after = buy ? availCash(A) - (e ? e.total : 0) : availCash(A) + (e ? e.total : 0);
    frame(`${top('Order prüfen', esc(x.name))}
      <div class="lines">
        <div><span>Richtung</span><b>${buy ? 'Kauf' : 'Verkauf'}</b></div>
        <div><span>Ordertyp</span><b>${{ market: 'Market', limit: `Limit ${fmt(s.lim, dig(x))}`, stop: `Stop ${fmt(s.stop, dig(x))}`, stoplimit: `Stop ${fmt(s.stop, dig(x))} / Limit ${fmt(s.lim, dig(x))}` }[o.type]}</b></div>
        <div><span>Menge</span><b>${fmtQty(x, s.qty)}</b></div>
        ${e && e.q ? `<div><span>Kurs ca.</span><b>${fmtPx(x, e.px)}</b></div><div><span>Gebühr ${info('fee')}</span><b>${fmtE(e.fee)}</b></div><div class="tot"><span>${buy ? 'Gesamt' : 'Erlös'}</span><b>${fmtE(e.total)}</b></div>` : '<div><span>Ausführung</span><b>sobald der Kurs erreicht ist</b></div>'}
        <div><span>Danach verfügbar</span><b>${fmtE(after)}</b></div>
        ${buy && e && A.cash - e.total < 0 ? `<div><span>Davon auf Kredit ${info('credit')}</span><b class="amb">${fmtE(Math.min(e.total, e.total - Math.max(0, A.cash)))}</b></div>` : ''}
      </div>
      ${buy && e && A.cash - e.total < 0 ? (() => { const debt = e.total - A.cash, lv = E.lombardValue(A) + e.total * E.ltvOf(x), u = lv > 0 ? debt / lv : 9; return `<p class="note">${u >= 0.75 ? '<b class="amb">Achtung:</b> ' : ''}Kredit-Auslastung danach etwa ${fmt(u * 100, 0)} %. ${u >= 0.75 ? 'Schon ein kleiner Kursrückgang kann einen Margin Call auslösen.' : 'Zinsen: Leitzins + Bankmarge.'}</p>`; })() : ''}
      ${o.type === 'market' ? '<p class="note">Market-Orders werden sofort zum besten verfügbaren Kurs ausgeführt. Der endgültige Kurs kann minimal abweichen.</p>' : ''}
      <div class="btns"><button class="btn ghost" data-a="sheetback">Zurück</button><button class="btn" data-a="oconfirm">${buy ? 'Jetzt kaufen' : 'Jetzt verkaufen'}</button></div>`);
  } else frame(doneHTML(o.ok, o.ok ? (buy ? 'Gekauft' : 'Verkauft') : 'Nicht ausgeführt', o.msg));
}
export function updateOrder() {
  if (!cur) return;
  if (cur.kind === 'fund') { updateFund(); return; }
  if (cur.kind === 'auto') { if (cur.step === 'form') autoPrev(); return; }
  if (cur.kind !== 'order' || cur.step !== 'form') return;
  const box = $('#o-prev'); if (!box) return;
  const s = orderSpec(), e = s.e, x = s.x, A = S.A, buy = cur.side === 'buy', av = availCash(A), p = A.pos[x.id];
  const closed = !E.M.isOpen && cur.type === 'market' ? '<p class="warn">Die Börse ist geschlossen. Wähle unter „Ordertyp“ eine Limit-Order oder handle ab 08:00 Uhr.</p>' : '';
  let html = '', ok = false;
  if (!(s.qty > 0)) html = `<div><span>${buy ? 'Verfügbar' : 'Im Depot'}</span><b>${buy ? fmtE(av) : p ? fmtQty(x, p.qty - reservedUnits(A, x.id)) : '–'}</b></div>`;
  else if (cur.type === 'stop' || cur.type === 'stoplimit') { html = `<div><span>Menge</span><b>${fmtQty(x, s.qty)}</b></div><div><span>Wird aktiv ab</span><b>${s.stop > 0 ? fmtPx(x, s.stop) : '–'}</b></div>`; ok = s.stop > 0 && (cur.type === 'stop' || s.lim > 0); }
  else if (!e || !e.q) { html = `<div><span>Menge</span><b>${fmtQty(x, s.qty)}</b></div><div><span>Sofort ausführbar</span><b>${cur.type === 'limit' ? 'nein – wartet auf dein Limit' : '–'}</b></div>`; ok = cur.type === 'limit' && s.lim > 0; }
  else {
    html = `<div><span>Menge</span><b>${fmtQty(x, e.q)}</b></div><div><span>Kurs ca.</span><b>${fmtPx(x, e.px)}</b></div>` +
      (Math.abs(e.impact) > 0.0005 ? `<div><span>Marktwirkung ${info('impact')}</span><b>${pctS(e.impact, 2)}</b></div>` : '') +
      `<div><span>Gebühr ${info('fee')}</span><b>${fmtE(e.fee)}</b></div><div class="tot"><span>${buy ? 'Gesamt' : 'Erlös'}</span><b>${fmtE(e.total)}</b></div>` +
      `<div><span>${buy ? 'Verfügbar' : 'Im Depot'}</span><b>${buy ? fmtE(av) : fmtQty(x, p ? p.qty : 0)}</b></div>`;
    ok = !buy || e.total <= av + 1e-6;
    if (buy && e.total > av + 1e-6) html += '<p class="warn">Das übersteigt dein verfügbares Guthaben.</p>';
    if (e.capped) html += '<p class="warn">Das Orderbuch reicht nicht für die ganze Menge.</p>';
  }
  if (!buy && p && s.qty > p.qty - reservedUnits(A, x.id) + 1e-9) { html += '<p class="warn">So viele hast du nicht im Depot.</p>'; ok = false; }
  box.innerHTML = html + closed;
  const go = $('#o-go'); if (go) go.disabled = !ok || (!E.M.isOpen && cur.type === 'market');
}
async function confirmOrder() {
  const s = orderSpec(), o = cur, btn = document.querySelector('[data-a="oconfirm"]'); if (btn) btn.disabled = true;
  const r = await act({ type: 'order', iid: o.id, side: o.side, otype: o.type, qty: s.qty, limit: s.lim, stop: s.stop, val: o.gtc ? 'gtc' : 'day' }, true);
  if (!cur) return;
  cur.step = 'done'; cur.ok = r.ok; cur.msg = r.ok ? esc((r.notes.find(n => /ausgeführt|liegt|angelegt|Stop/.test(n.msg)) || r.notes[0] || { msg: 'Order übermittelt.' }).msg) : esc(r.error || 'Fehler.');
  renderOrder(); for (const n of r.notes) if (n.tone === 'tier' || n.tone === 'ath' || /^Erfolg/.test(n.msg)) S.toast(n.msg, n.tone);
}

/* ---------- Fonds ---------- */
function renderFund() {
  const o = cur, x = E.I(o.id), buy = o.side === 'buy';
  if (o.step === 'form') {
    frame(`${top(buy ? 'Fondsanteile kaufen' : 'Fondsanteile verkaufen', `${esc(x.name)} · Inventarwert ${fmt(x.nav, 2)} €`)}
      <div class="seg"><button data-a="oside" data-v="buy" class="${buy ? 'on' : ''}">Kaufen</button><button data-a="oside" data-v="sell" class="${!buy ? 'on' : ''}" ${S.A.pos[x.id] ? '' : 'disabled'}>Verkaufen</button></div>
      <div class="amount-wrap"><input class="amount" id="o-amt" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(o.val)}"><span class="unit">${buy ? '€' : 'Anteile'}</span></div>
      <div class="chips">${(buy ? [['100', '100 €'], ['500', '500 €'], ['1000', '1.000 €']] : [['0.5', '50 %'], ['1', 'Alles']]).map(c => `<button class="chip" data-a="oquick" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>
      <div class="lines" id="o-prev"></div>
      <p class="note">Fonds werden einmal täglich um 17:30 Uhr zum Inventarwert abgerechnet ${info('aa')}</p>
      <button class="btn full" id="o-go" data-a="oreview">Order prüfen</button>`);
    updateFund();
  } else if (o.step === 'review') {
    const v = parseNum(o.val);
    frame(`${top('Order prüfen', esc(x.name))}<div class="lines">${buy ? `<div><span>Anlagebetrag</span><b>${fmtE(v)}</b></div><div><span>Ausgabeaufschlag</span><b>${fmtE(v - v / (1 + x.aa))}</b></div>` : `<div><span>Anteile</span><b>${fmt(v, 3)}</b></div><div><span>Erlös ca.</span><b>${fmtE(v * x.nav)}</b></div>`}<div><span>Abrechnung</span><b>heute 17:30 Uhr</b></div></div>
      <div class="btns"><button class="btn ghost" data-a="sheetback">Zurück</button><button class="btn" data-a="oconfirm">${buy ? 'Jetzt kaufen' : 'Jetzt verkaufen'}</button></div>`);
  } else frame(doneHTML(o.ok, o.ok ? 'Order angenommen' : 'Nicht angenommen', o.msg));
}
function updateFund() {
  if (!cur || cur.kind !== 'fund' || cur.step !== 'form') return; const box = $('#o-prev'); if (!box) return;
  const x = E.I(cur.id), v = parseNum(cur.val), A = S.A, buy = cur.side === 'buy', p = A.pos[x.id], have = p ? p.qty - reservedUnits(A, x.id) : 0;
  let ok = v > 0;
  if (!(v > 0)) box.innerHTML = `<div><span>${buy ? 'Verfügbar' : 'Im Depot'}</span><b>${buy ? fmtE(availCash(A)) : fmt(have, 3) + ' Anteile'}</b></div>`;
  else if (buy) { const net = v / (1 + x.aa), r = avgRatio(x, 1, net); box.innerHTML = `<div><span>Ausgabeaufschlag ${info('aa')}</span><b>${fmtE(v - net)}</b></div><div><span>Anteile ca.</span><b>${fmt(net / (x.nav * r), 3)}</b></div><div class="tot"><span>Betrag</span><b>${fmtE(v)}</b></div>`; if (v < 10) { ok = false; box.innerHTML += '<p class="warn">Mindestens 10 €.</p>'; } if (v > availCash(A) + 1e-6) { ok = false; box.innerHTML += '<p class="warn">Übersteigt dein Guthaben.</p>'; } }
  else { box.innerHTML = `<div><span>Rücknahme ca.</span><b>${fmtE(v * x.nav * avgRatio(x, -1, v * x.nav))}</b></div>`; if (v > have + 1e-9) { ok = false; box.innerHTML += '<p class="warn">So viele Anteile hast du nicht.</p>'; } }
  const go = $('#o-go'); if (go) go.disabled = !ok;
}
async function confirmFund() {
  const btn = document.querySelector('[data-a="oconfirm"]'); if (btn) btn.disabled = true;
  const r = await act({ type: 'fund', iid: cur.id, side: cur.side, val: parseNum(cur.val) }, true); if (!cur) return;
  cur.step = 'done'; cur.ok = r.ok; cur.msg = r.ok ? 'Abrechnung heute um 17:30 Uhr zum Inventarwert. Du findest die Order unter Konto → Orders.' : esc(r.error || 'Fehler.'); renderFund();
}

/* ---------- Allgemeiner Prüfschritt ---------- */
export function openReview(o) {
  S.lastFocus = document.activeElement; cur = Object.assign({ kind: 'review', step: 'review' }, o); renderReview();
}
// Zeilen dürfen eine Funktion sein: Verhandlungs-Sheets (Regler im body) rechnen die Vorschau live im Browser neu
const reviewLines = o => { const L = typeof o.lines === 'function' ? o.lines() : o.lines; return L.map((l, i) => `<div class="${i === L.length - 1 && o.totalLast !== false ? 'tot' : ''}"><span>${l[0]} ${l[2] ? info(l[2]) : ''}</span><b>${l[1]}</b></div>`).join(''); };
export function refreshReview() { const o = cur; if (!o || o.step !== 'review') return; const l = document.getElementById('sh-lines'); if (l) l.innerHTML = reviewLines(o); const w = document.getElementById('sh-warn'); if (w && typeof o.warn === 'function') w.textContent = o.warn(); }
function renderReview() {
  const o = cur;
  if (o.step === 'review') frame(`${top(o.title, o.sub || '')}${o.body || ''}<div class="lines" id="sh-lines">${reviewLines(o)}</div>${o.warn ? `<p class="note" id="sh-warn">${esc(typeof o.warn === 'function' ? o.warn() : o.warn)}</p>` : ''}<div class="btns"><button class="btn ghost" data-a="sheetx">Abbrechen</button><button class="btn" data-a="rconfirm">${esc(o.confirm || 'Bestätigen')}</button></div>`);
  else frame(doneHTML(o.ok, o.ok ? (o.doneTitle || 'Erledigt') : 'Das hat nicht geklappt', o.msg));
}

/* ---------- Ereignisse ---------- */
actions.sheetx = () => close();
actions.sheetbg = (el, ev) => { if (ev.target === el) close(); };
actions.sheetback = () => { if (!cur) return; if (cur.kind === 'review') { close(); return; } cur.step = 'form'; cur.kind === 'fund' ? renderFund() : cur.kind === 'auto' ? renderAuto() : renderOrder(); };
actions.oside = el => { cur.side = el.dataset.v; cur.val = ''; cur.kind === 'fund' ? renderFund() : renderOrder(); };
actions.omode = el => { cur.mode = el.dataset.v; cur.val = ''; renderOrder(); };
actions.ogtc = el => { cur.gtc = !cur.gtc; el.classList.toggle('on', cur.gtc); el.setAttribute('aria-pressed', cur.gtc); };
actions.oquick = el => {
  const x = E.I(cur.id), A = S.A, v = el.dataset.v, p = A.pos[x.id], have = p ? p.qty - reservedUnits(A, x.id) : 0;
  if (cur.kind === 'fund') cur.val = cur.side === 'buy' ? v : String(+(have * +v).toFixed(6)).replace('.', ',');
  else if (cur.side === 'sell') { cur.mode = 'qty'; cur.val = String(roundQty(x, have * +v)).replace('.', ','); renderOrder(); return; }
  else if (v === 'max') { cur.val = cur.mode === 'amt' ? String(Math.floor(Math.max(0, availCash(A)) * 100) / 100).replace('.', ',') : String(maxBuyQty(x, Math.max(0, availCash(A)), 0, A)).replace('.', ','); }
  else cur.val = v;
  const i = $('#o-amt'); if (i) i.value = cur.val; updateOrder();
};
actions.oreview = () => { if (!cur) return; cur.step = 'review'; cur.kind === 'fund' ? renderFund() : renderOrder(); };
actions.oconfirm = () => cur && (cur.kind === 'fund' ? confirmFund() : confirmOrder());
actions.rconfirm = async () => {
  const btn = document.querySelector('[data-a="rconfirm"]'); if (btn) btn.disabled = true;
  const o = cur, r = await o.run(); if (cur !== o) return;
  o.step = 'done'; o.ok = r.ok; o.msg = r.ok ? esc((r.notes && r.notes[0] && r.notes[0].msg) || 'Erledigt.') : esc(r.error || 'Fehler.'); renderReview();
  for (const n of (r.notes || []).slice(1)) S.toast(n.msg, n.tone);
};
inputs['o-amt'] = el => { cur.val = el.value; updateOrder(); };
inputs['o-lim'] = el => { cur.limit = el.value; updateOrder(); };
inputs['o-stop'] = el => { cur.stop = el.value; updateOrder(); };
changes['o-type'] = el => {
  const x = E.I(cur.id); cur.type = el.value;
  if ((cur.type === 'limit' || cur.type === 'stoplimit') && !cur.limit) cur.limit = fmt(x.price, dig(x)).replace(/\./g, '');
  if ((cur.type === 'stop' || cur.type === 'stoplimit') && !cur.stop) cur.stop = fmt(x.price * (cur.side === 'buy' ? 1.03 : 0.97), dig(x)).replace(/\./g, '');
  renderOrder();
};

/* ---------- Absicherung & Auto-Orders: Stop-Loss, Take-Profit, Trailing-Stop ---------- */
// t: { tg: 'pos'|'der'|'fx', ref, id? (bearbeiten), k? }
const nfmt = (v, d) => isFinite(v) ? String(+v.toFixed(d)).replace('.', ',') : '';
export function openAuto(t) {
  S.lastFocus = document.activeElement;
  const A = S.A, old = t.id ? (A.auto || []).find(o => o.id === t.id) : null, T = E.autoTarget(A, t); if (!T) { S.toast('Diese Position hast du nicht mehr.', 'dn'); return; }
  const k = old ? old.k : t.k || 'sl', d = T.x ? dig(T.x) : 4;
  cur = { kind: 'auto', step: 'form', tg: t.tg, ref: String(t.ref), id: old ? old.id : 0, k, f: old ? old.f : 1, oco: old ? old.oco : true, tm: old && old.tm ? old.tm : 'pct', dist: old && old.k === 'tr' ? (old.tm === 'pct' ? old.dist * 100 : old.dist) : 8, d };
  cur.trig = old && old.k !== 'tr' ? old.trig : T.px * (k === 'tp' ? 1.1 : 0.92);
  renderAuto();
}
const spec = () => ({ tg: cur.tg, ref: cur.ref, k: cur.k, f: cur.f, oco: cur.oco, trig: cur.trig, tm: cur.tm, dist: cur.tm === 'pct' ? cur.dist / 100 : cur.dist });
function renderAuto() {
  const o = cur, A = S.A, T = E.autoTarget(A, o); if (!T) { close(); return; }
  if (o.step === 'form') {
    const pv = E.autoPreview(A, spec()), hasBuy = pv && pv.buyIn > 0 && o.tg !== 'der', hasPl = pv && pv.pnl !== null;
    frame(`${top(o.id ? 'Auto-Order ändern' : 'Absichern & Gewinne mitnehmen', `${esc(T.name)} · aktuell ${T.fmtP(T.px)}${o.tg === 'der' ? ' (Basiswert)' : ''}`)}
      <div class="seg" role="group">${[['sl', 'Stop-Loss'], ['tp', 'Take-Profit'], ['tr', 'Trailing-Stop']].map(([k, l]) => `<button data-a="auk" data-v="${k}" class="${o.k === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="note" style="margin:0">${o.k === 'sl' ? `Verkauft automatisch, wenn der Kurs auf oder unter dein Limit fällt ${info('autosl')}` : o.k === 'tp' ? `Verkauft automatisch, sobald der Kurs dein Kursziel erreicht ${info('autotp')}` : `Zieht bei steigenden Kursen automatisch nach und bleibt bei fallenden stehen ${info('autotr')}`}</p>
      ${o.k === 'tr' ? `<div class="seg" role="group"><button data-a="autm" data-v="pct" class="${o.tm === 'pct' ? 'on' : ''}">Abstand in %</button><button data-a="autm" data-v="abs" class="${o.tm === 'abs' ? 'on' : ''}">Abstand in ${o.tg === 'fx' ? '€' : T.x && T.x.cls === 'bond' ? 'Punkten' : T.x && T.x.cls === 'cmd' ? '$' : '€'}</button></div>
        <label class="field"><span>Abstand zum Höchstkurs</span><input class="inp" id="au-dist" inputmode="decimal" autocomplete="off" value="${nfmt(o.dist, o.tm === 'pct' ? 1 : o.d)}"></label>`
      : `<div class="row2"><label class="field"><span>${o.k === 'sl' ? 'Stop-Kurs' : 'Kursziel'}</span><input class="inp" id="au-trig" inputmode="decimal" autocomplete="off" value="${nfmt(o.trig, o.d)}"></label>
          <label class="field"><span>Abstand zum Kurs (%)</span><input class="inp" id="au-pk" inputmode="decimal" autocomplete="off"></label></div>
        <div class="row2">${hasBuy ? `<label class="field"><span>Abstand zum Einstand (%) ${info('avgcost')}</span><input class="inp" id="au-pb" inputmode="decimal" autocomplete="off"></label>` : '<span></span>'}
          ${hasPl ? `<label class="field"><span>Gewinn/Verlust (€)</span><input class="inp" id="au-pl" inputmode="decimal" autocomplete="off"></label>` : '<span></span>'}</div>`}
      <div><span class="label">Menge</span><div class="chips" style="margin-top:6px">${[0.25, 0.5, 0.75, 1].map(f => `<button class="chip ${Math.abs(o.f - f) < 1e-6 ? 'on' : ''}" data-a="auf" data-v="${f}">${f === 1 ? 'Ganze Position' : fmt(f * 100, 0) + ' %'}</button>`).join('')}</div>
        ${o.tg === 'pos' && T.x.cls !== 'bond' ? `<label class="field" style="margin-top:8px"><span>oder Stückzahl (von ${fmtQty(T.x, T.qty)})</span><input class="inp" id="au-q" inputmode="decimal" autocomplete="off" value="${nfmt(pv ? pv.q : 0, 4)}"></label>` : ''}</div>
      <label class="setting" style="border:0;padding:0"><span class="t"><b>OCO – eine streicht die andere ${info('oco')}</b><small>Löst diese Order aus, werden deine anderen OCO-Orders dieser Position gestrichen.</small></span><button type="button" class="toggle ${o.oco ? 'on' : ''}" data-a="auoco" aria-pressed="${o.oco}" aria-label="OCO"></button></label>
      <div id="au-prev"></div>
      <button class="btn full" data-a="aureview">Order prüfen</button>`);
    autoPrev(true);
  } else if (o.step === 'review') {
    const sp = spec(), oid = o.id, pv = E.autoPreview(A, sp); if (!pv) { close(); return; } // Daten festhalten: openReview ersetzt den Sheet-Zustand
    const lines = autoLines(pv), sentence = autoSentence(pv);
    openReview({ title: `${E.AUTO_KINDS[o.k]} ${o.id ? 'ändern' : 'einrichten'}`, sub: esc(T.name), totalLast: false, lines, warn: sentence + ' Bei Kurslücken (etwa über Nacht oder nach Quartalszahlen) wird zum nächsten verfügbaren Kurs verkauft – das kann ungünstiger sein als deine Schwelle.', confirm: oid ? 'Änderung speichern' : 'Order aktivieren', run: () => act(Object.assign({ type: 'auto', id: oid || undefined }, sp), true) });
  }
}
function autoLines(pv) {
  const o = cur, T = pv.T, L = [['Art', E.AUTO_KINDS[o.k]], [o.k === 'tr' ? 'Stop aktuell' : o.k === 'sl' ? 'Stop-Kurs' : 'Kursziel', `${T.fmtP(pv.trig)} (${pctS(pv.trig / T.px - 1, 1)})`], ['Menge', pv.qtyTxt + (o.f < 0.9999 ? ` · ${fmt(o.f * 100, 0)} % der Position` : '')]];
  if (o.k === 'tr') L.push(['Abstand', o.tm === 'pct' ? fmt(o.dist, 1) + ' % unter dem Hoch' : `${T.fmtP(o.dist)} unter dem Hoch`]);
  if (pv.val !== null) L.push(['Erlös bei Auslösung ca.', fmtE(pv.val)]);
  if (pv.pnl !== null) L.push(['Gewinn/Verlust ggü. Einstand', `<span class="${sc(pv.pnl)}">${pv.pnl >= 0 ? '+' : '−'}${fmtE(Math.abs(pv.pnl))}</span>`]);
  L.push(['OCO', o.oco ? 'ja' : 'nein']);
  return L;
}
function autoSentence(pv) {
  const o = cur, T = pv.T, pk = pctS(pv.trig / T.px - 1, 1), pl = pv.pnl;
  const tail = pl === null ? '' : o.k === 'tp' ? ` Gewinn gegenüber deinem Einstand: etwa ${fmtE(pl)}.` : pl < 0 ? ` So begrenzt du deinen Verlust auf etwa ${fmtE(-pl)}.` : ` So sicherst du einen Gewinn von etwa ${fmtE(pl)}.`;
  if (o.k === 'tr') return `Der Stop liegt ${o.tm === 'pct' ? fmt(o.dist, 1) + ' %' : T.fmtP(o.dist)} unter dem höchsten Kurs seit Aktivierung – jetzt bei ${T.fmtP(pv.trig)} (${pk}). Steigt der Kurs, zieht er nach; fällt er, bleibt er stehen. Wird er erreicht, verkauft NOVEX automatisch ${pv.qtyTxt}.${tail}`;
  return o.k === 'sl' ? `Verkauft automatisch ${pv.qtyTxt}, falls der Kurs auf ${T.fmtP(pv.trig)} (${pk}) fällt.${tail}` : `Verkauft automatisch ${pv.qtyTxt}, sobald der Kurs ${T.fmtP(pv.trig)} (${pk}) erreicht.${tail}`;
}
// Felder live verknüpfen: Zielkurs ⇄ Abstand zum Kurs ⇄ Abstand zum Einstand ⇄ Gewinn/Verlust
function autoPrev(all) {
  const o = cur, A = S.A, pv = E.autoPreview(A, spec()), box = $('#au-prev'); if (!box || !pv) return;
  const T = pv.T, set = (id, v) => { const el = $('#' + id); if (el && (all || document.activeElement !== el)) el.value = v; };
  if (o.k !== 'tr') { set('au-trig', nfmt(pv.trig, o.d)); set('au-pk', nfmt((pv.trig / T.px - 1) * 100, 2)); if (pv.buyIn) set('au-pb', nfmt((pv.trig / pv.buyIn - 1) * 100, 2)); if (pv.pnl !== null) set('au-pl', nfmt(pv.pnl, 2)); }
  if (o.tg === 'pos' && T.x.cls !== 'bond') set('au-q', nfmt(pv.q, 4));
  const bad = o.k === 'sl' ? pv.trig >= T.px : o.k === 'tp' ? pv.trig <= T.px : !(o.dist > 0) || (o.tm === 'pct' && o.dist > 50);
  box.innerHTML = `<p class="lead" style="margin:4px 0 0;font-size:15px">${autoSentence(pv)}</p>${bad ? `<p class="warn">${o.k === 'sl' ? 'Der Stop-Kurs muss unter dem aktuellen Kurs liegen.' : o.k === 'tp' ? 'Das Kursziel muss über dem aktuellen Kurs liegen.' : 'Bitte einen Abstand zwischen 0,5 und 50 % wählen.'}</p>` : ''}`;
  const b = document.querySelector('[data-a="aureview"]'); if (b) b.disabled = bad;
}
function fromTrig(v) { if (v > 0) { cur.trig = v; autoPrev(); } }
inputs['au-trig'] = el => fromTrig(parseNum(el.value));
inputs['au-pk'] = el => { const v = parseNum(el.value), T = E.autoTarget(S.A, cur); if (isFinite(v) && T) fromTrig(T.px * (1 + v / 100)); };
inputs['au-pb'] = el => { const v = parseNum(el.value), pv = E.autoPreview(S.A, spec()); if (isFinite(v) && pv && pv.buyIn) fromTrig(pv.buyIn * (1 + v / 100)); };
inputs['au-pl'] = el => { // Gewinn/Verlust → Zielkurs (bei Anleihen inkl. Stückzinsen)
  const v = parseNum(el.value), pv = E.autoPreview(S.A, spec()); if (!isFinite(v) || !pv || !(pv.q > 0)) return;
  const unit = (v + pv.cost) / pv.q, x = pv.T.x; fromTrig(cur.tg === 'fx' ? unit : x && x.cls === 'bond' ? unit * 100 - x.acc : unit);
};
inputs['au-dist'] = el => { const v = parseNum(el.value); if (v > 0) { cur.dist = v; autoPrev(); } };
inputs['au-q'] = el => { const v = parseNum(el.value), T = E.autoTarget(S.A, cur); if (v > 0 && T) { cur.f = Math.min(1, v / T.qty); document.querySelectorAll('[data-a="auf"]').forEach(b => b.classList.toggle('on', Math.abs(+b.dataset.v - cur.f) < 1e-6)); autoPrev(); } };
actions.auk = el => { const T = E.autoTarget(S.A, cur); cur.k = el.dataset.v; if (cur.k === 'sl' && !(cur.trig < T.px)) cur.trig = T.px * 0.92; if (cur.k === 'tp' && !(cur.trig > T.px)) cur.trig = T.px * 1.1; renderAuto(); };
actions.autm = el => { const T = E.autoTarget(S.A, cur); cur.tm = el.dataset.v; cur.dist = cur.tm === 'pct' ? 8 : +(T.px * 0.08).toFixed(cur.d); renderAuto(); };
actions.auf = el => { cur.f = +el.dataset.v; el.parentElement.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === el)); autoPrev(); };
actions.auoco = el => { cur.oco = !cur.oco; el.classList.toggle('on', cur.oco); el.setAttribute('aria-pressed', cur.oco); };
actions.aureview = () => { cur.step = 'review'; renderAuto(); };
